import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

const BASE_URL = __ENV.BASE_URL || 'http://ingress-nginx-controller.ingress-nginx.svc.cluster.local';

const commonHeaders = {
  'Host': 'ballandbeer.com',
  'User-Agent': 'k6-training-load-generator',
  'Accept': 'application/json',
};

const TEST_USERS = [];
for (let i = 1; i <= 40; i++) {
  TEST_USERS.push({
    email: `k6user${i}@test.local`,
    password: 'K6Test2024!',
    name: `K6 Test User ${i}`,
    token: null,
    userId: null,
  });
}

let productIds = [];
let userTokens = {};

// Helper functions
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getCurrentStage() {
  const currentVUs = __VU;
  if (currentVUs <= 35) return 1;
  if (currentVUs <= 80) return 2;
  if (currentVUs <= 160) return 3;
  if (currentVUs <= 190) return 4;
  return 5;
}

function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getUserSession() {
  const usePreAuthenUser = __VU <= 100;  // Only first 100 VUs use pre-auth, rest trigger register/login
  
  if (usePreAuthenUser) {
    const userIndex = (__VU - 1) % TEST_USERS.length;
    const user = TEST_USERS[userIndex];
    const stored = userTokens[user.email];
    return {
      user,
      token: stored ? stored.token : null,
      userId: stored ? stored.userId : null,
    };
  } else {
    const dynamicEmail = `k6dynamic${__VU}@test.local`;
    const dynamicPassword = 'K6Dynamic2024!';
    const dynamicName = `K6 Dynamic User ${__VU}`;
    
    let stored = userTokens[dynamicEmail];
    let token = stored ? stored.token : null;
    let storedUserId = stored ? stored.userId : null;
    
    if (!token) {
      let res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
        username: dynamicEmail.split('@')[0],
        password: dynamicPassword,
      }), {
        headers: { ...commonHeaders, 'Content-Type': 'application/json' },
      });
      
      if (res.status !== 200) {
        http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
          email: dynamicEmail,
          password: dynamicPassword,
          username: dynamicEmail.split('@')[0],  // Use email prefix as username
          fullName: dynamicName,
        }), {
          headers: { ...commonHeaders, 'Content-Type': 'application/json' },
        });
        
        sleep(0.2);
        
        res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
          username: dynamicEmail.split('@')[0],
          password: dynamicPassword,
        }), {
          headers: { ...commonHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (res.status === 200) {
        try {
          const body = JSON.parse(res.body);
          token = body.token || body.accessToken;
          const userId = (body && (body.user && (body.user._id || body.user.id))) || body.userId || body.id || body._id || storedUserId;
          if (token) {
            userTokens[dynamicEmail] = { token, userId };
          }
        } catch (e) {}
      }
    }
    
    return {
      user: { email: dynamicEmail, password: dynamicPassword, name: dynamicName },
      token: token || null,
      userId: storedUserId || null,
    };
  }
}

function fetchProducts() {
  const res = http.get(`${BASE_URL}/api/products`, {
    headers: commonHeaders,
  });
  
  check(res, { 'fetch products': (r) => r.status === 200 });
  
  if (res.status === 200) {
    try {
      const products = JSON.parse(res.body);
      if (Array.isArray(products) && products.length > 0) {
        return products.map(p => p._id || p.id).filter(id => id);
      }
    } catch (e) {}
  }
  
  return ['prod1', 'prod2', 'prod3', 'prod4', 'prod5'];
}

function browseProducts() {
  const stage = getCurrentStage();
  
  // Frontend page load - reduced to prevent overload
  const pageLoadProb = stage === 1 ? 0.3 : stage === 2 ? 0.5 : stage === 3 ? 0.5 : stage >= 4 ? 0.5 : 0.5;
  if (Math.random() < pageLoadProb) {
    const pageRes = http.get(`${BASE_URL}/product`, {
      headers: commonHeaders,
    });
    check(pageRes, { 'browse products page': (r) => r.status === 200 }) || errorRate.add(1);
    sleep(stage === 1 ? 0.15 : stage === 2 ? 0.05 : stage === 3 ? 0.01 : 0.01);
  }
  
  // Always call API (100%)
  const res = http.get(`${BASE_URL}/api/products`, {
    headers: commonHeaders,
  });
  
  check(res, { 'browse products API': (r) => r.status === 200 }) || errorRate.add(1);
  
  // Product detail view - reduce to prevent MongoDB overload
  const detailProb = stage === 1 ? 0.15 : stage === 2 ? 0.25 : stage === 3 ? 0.3 : stage >= 4 ? 0.3 : 0.3;
  if (res.status === 200 && Math.random() < detailProb) {
    try {
      const products = JSON.parse(res.body);
      if (Array.isArray(products) && products.length > 0) {
        const product = randomItem(products);
        const productId = product._id || product.id;
        
        sleep(stage === 2 ? 0.05 : stage === 3 ? 0.01 : 0.03);
        
        // Only API call - no page load to reduce queries
        const detailRes = http.get(`${BASE_URL}/api/products/${productId}`, {
          headers: commonHeaders,
        });
        check(detailRes, { 'view product detail API': (r) => r.status === 200 });
      }
    } catch (e) {}
  }
}

function viewProductWithComments() {
  if (productIds.length === 0) {
    productIds = fetchProducts();
  }
  
  const productId = randomItem(productIds);
  
  if (Math.random() < 0.35) {
    const pageRes = http.get(`${BASE_URL}/product/${productId}`, {
      headers: commonHeaders,
    });
    check(pageRes, { 'view product page': (r) => r.status === 200 }) || errorRate.add(1);
    sleep(0.01);
  }
  
  const res = http.get(`${BASE_URL}/api/products/${productId}`, {
    headers: commonHeaders,
  });
  check(res, { 'view product API': (r) => r.status === 200 }) || errorRate.add(1);
  
  if (res.status === 200 && Math.random() < 0.3) {
    sleep(0.01);
    const commentsRes = http.get(`${BASE_URL}/api/products/${productId}/comments`, {
      headers: commonHeaders,
    });
    check(commentsRes, { 'view comments': (r) => r.status === 200 });
  }
}

function getRecommendations() {
  if (productIds.length === 0) {
    productIds = fetchProducts();
  }
  
  const productId = randomItem(productIds);
  
  const res = http.post(`${BASE_URL}/recommend`, JSON.stringify({
    product_id: productId,
  }), {
    headers: { ...commonHeaders, 'Content-Type': 'application/json' },
  });
  
  check(res, { 'get recommendations': (r) => r.status === 200 }) || errorRate.add(1);
}

function viewBookings() {
  const fieldId = randomInt(1, 5);
  const date = getTodayDate();
  const stage = getCurrentStage();
  
  // Frontend page load - reduced to prevent overload
  const pageLoadProb = stage === 1 ? 0.3 : stage === 2 ? 0.5 : stage === 3 ? 0.5 : stage >= 4 ? 0.5 : 0.5;
  if (Math.random() < pageLoadProb) {
    const pageRes = http.get(`${BASE_URL}/booking`, {
      headers: commonHeaders,
    });
    check(pageRes, { 'view bookings page': (r) => r.status === 200 }) || errorRate.add(1);
    sleep(stage === 1 ? 0.15 : stage === 2 ? 0.05 : stage === 3 ? 0.01 : 0.01);
  }
  
  const res = http.get(`${BASE_URL}/api/bookings/${fieldId}/${date}`, {
    headers: commonHeaders,
  });
  
  check(res, { 'view bookings API': (r) => r.status === 200 }) || errorRate.add(1);
}

function createBooking(token) {
  if (!token) return;
  
  const fieldId = randomInt(1, 5);
  const date = getTodayDate();
  const startTime = randomInt(8, 20);
  
  if (Math.random() < 0.5) {
    const pageRes = http.get(`${BASE_URL}/booking`, {
      headers: {
        ...commonHeaders,
        'Authorization': `Bearer ${token}`,
      },
    });
    check(pageRes, { 'load booking page': (r) => r.status === 200 });
    sleep(0.01);
  }
  
  const res = http.post(`${BASE_URL}/api/bookings/book`, JSON.stringify({
    fieldId: fieldId,
    date: date,
    startTime: `${startTime}:00`,
    endTime: `${startTime + 2}:00`,
  }), {
    headers: {
      ...commonHeaders,
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  
  check(res, { 'create booking': (r) => r.status === 200 || r.status === 201 }) || errorRate.add(1);
}

function createOrder(token) {
  if (!token) return;
  
  if (productIds.length === 0) {
    productIds = fetchProducts();
  }
  
  if (Math.random() < 0.7) {
    const pageRes = http.get(`${BASE_URL}/checkout`, {
      headers: {
        ...commonHeaders,
        'Authorization': `Bearer ${token}`,
      },
    });
    check(pageRes, { 'load checkout page': (r) => r.status === 200 });
    sleep(0.01);
  }
  
  const numItems = randomInt(1, 3);
  const items = [];
  for (let i = 0; i < numItems; i++) {
    items.push({
      productId: randomItem(productIds),
      quantity: randomInt(1, 5),
    });
  }
  
  const res = http.post(`${BASE_URL}/api/orders`, JSON.stringify({
    items: items,
  }), {
    headers: {
      ...commonHeaders,
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  
  check(res, { 'create order': (r) => r.status === 200 || r.status === 201 }) || errorRate.add(1);
}

function viewMyOrders(token) {
  if (!token) return;
  
  if (Math.random() < 0.35) {
    const pageRes = http.get(`${BASE_URL}/profile/orders`, {
      headers: {
        ...commonHeaders,
        'Authorization': `Bearer ${token}`,
      },
    });
    check(pageRes, { 'view my orders page': (r) => r.status === 200 });
    sleep(0.01);
  }
  
  const res = http.get(`${BASE_URL}/api/orders/my-orders`, {
    headers: {
      ...commonHeaders,
      'Authorization': `Bearer ${token}`,
    },
  });
  
  check(res, { 'view my orders API': (r) => r.status === 200 }) || errorRate.add(1);
}

function verifySession(token) {
  if (!token) return;
  
  const res = http.get(`${BASE_URL}/api/auth/verify`, {
    headers: {
      ...commonHeaders,
      'Authorization': `Bearer ${token}`,
    },
  });
  
  check(res, { 'verify session': (r) => r.status === 200 || r.status === 401 });
}

function manageProfile(token, userId) {
  if (!token || !userId) return;
  
  // Keep profile at low load (rep1) for all stages - no page loads
  const res = http.get(`${BASE_URL}/api/profile/id/${userId}`, {
    headers: {
      ...commonHeaders,
      'Authorization': `Bearer ${token}`,
    },
  });
  
  check(res, { 'view profile API': (r) => r.status === 200 }) || errorRate.add(1);
  
  // Minimal updates to keep profile at rep1
  if (Math.random() < 0.25) {
    const updateRes = http.put(`${BASE_URL}/api/profile/id/${userId}`, JSON.stringify({
      phone: `09${randomInt(10000000, 99999999)}`,
      address: `Address ${randomInt(1, 100)}`,
    }), {
      headers: {
        ...commonHeaders,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    check(updateRes, { 'update profile': (r) => r.status === 200 });
  }
}

function postComment(token) {
  if (!token) return;
  
  if (productIds.length === 0) {
    productIds = fetchProducts();
  }
  
  const productId = randomItem(productIds);
  
  const res = http.post(`${BASE_URL}/api/products/${productId}/comments`, JSON.stringify({
    rating: randomInt(3, 5),
    comment: `Great product! K6 test at ${new Date().toISOString()}`,
  }), {
    headers: {
      ...commonHeaders,
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  
  check(res, { 'post comment': (r) => r.status === 200 || r.status === 201 }) || errorRate.add(1);
}

function changePassword(token) {
  if (!token) return;
  
  const res = http.put(`${BASE_URL}/api/auth/change-password`, JSON.stringify({
    currentPassword: 'K6Test2024!',
    newPassword: 'K6Test2024!',
  }), {
    headers: {
      ...commonHeaders,
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  
  check(res, { 'change password': (r) => r.status === 200 || r.status === 400 });
}

// Pre-authenticate all users to avoid auth service overload
export function setup() {
  console.log('Setup: Pre-authenticating test users...');
  const tokens = {};
  
  for (let i = 0; i < TEST_USERS.length; i++) {
    const user = TEST_USERS[i];
    
    let res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
      username: user.email.split('@')[0],
      password: user.password,
    }), {
      headers: { ...commonHeaders, 'Content-Type': 'application/json' },
    });
    
    if (res.status !== 200) {
      http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
        email: user.email,
        password: user.password,
        username: user.email.split('@')[0],  // Use email prefix as username
        fullName: user.name,
      }), {
        headers: { ...commonHeaders, 'Content-Type': 'application/json' },
      });
      sleep(0.2);
      res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
        username: user.email.split('@')[0],
        password: user.password,
      }), {
        headers: { ...commonHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (res.status === 200) {
      try {
        const body = JSON.parse(res.body);
        const token = body.token || body.accessToken;
        const userId = (body && (body.user && (body.user._id || body.user.id))) || body.userId || body.id || body._id || null;
        if (token) {
          tokens[user.email] = { token, userId };
          console.log(`User ${i + 1}/${TEST_USERS.length} authenticated`);
        }
      } catch (e) {
        console.log(`User ${i + 1} auth failed`);
      }
    }
    
    sleep(0.1);
  }
  
  console.log(`Setup complete: ${Object.keys(tokens).length}/${TEST_USERS.length} users authenticated`);
  return { tokens };
}

// ==================== CRITICAL: TARGET REPLICA DISTRIBUTION ====================
// User requirements for each stage - DO NOT FORGET!
// 
// Stage 1: ALL services rep1 (Profile always stays at 1)
//   - Authen: 1, Booking: 1, Order: 1, Product: 1, Profile: 1, Frontend: 1, Recommender: 1
// 
// Stage 2: Authen rep1, Profile rep1, OTHERS rep2
//   - Authen: 1, Profile: 1
//   - Booking: 2, Order: 2, Product: 2, Frontend: 2, Recommender: 2
// 
// Stage 3: Authen rep2, Profile rep1, OTHERS rep3
//   - Profile: 1, Authen: 2
//   - Booking: 3, Order: 3, Product: 3, Frontend: 3, Recommender: 3
// 
// Stage 4: Authen rep3, Profile rep1, OTHERS rep4
//   - Profile: 1, Authen: 3
//   - Booking: 4, Order: 4, Product: 4, Frontend: 4, Recommender: 4
// 
// Stage 5: Authen rep3, Profile rep1, OTHERS rep5
//   - Profile: 1, Authen: 3
//   - Booking: 5, Order: 5, Product: 5, Frontend: 5, Recommender: 5
// 
// KEDA mechanism: CPU+Memory threshold 60%, cooldown 120s
// Formula: replicas = ceil(current_replicas × current_utilization / 60%)
// ===============================================================================
export const options = {
  scenarios: {
    realistic_workflow_training: {
      executor: 'ramping-vus',
      startTime: '0s',
      stages: [
        // Stage 1: ALL rep1 (0-20min)
        //{ duration: '2m', target: 35 },    // 0-2: ramp to rep1
        //{ duration: '18m', target: 35 },   // 2-20: rep1 stable (18min)
        
        // Stage 2: Authen 1, others 2 (20-40min)
        //{ duration: '2m', target: 80 },    // 20-22: ramp to rep2
        //{ duration: '18m', target: 80 },   // 22-40: rep2 stable (18min)
        
        // Stage 3: Authen 2, others 3 (40-60min)
        //{ duration: '2m', target: 160 },   // 40-42: ramp to rep3
        //{ duration: '18m', target: 160 },  // 42-60: rep3 stable (18min)
        
        // Stage 4: Authen 3, others 4 (60-80min)
        //{ duration: '2m', target: 190 },   // 60-62: ramp to rep4
        //{ duration: '18m', target: 190 },  // 62-80: rep4 stable (18min)
        
        // Stage 5: Authen 3, others 5 (80-100min)
        { duration: '2m', target: 300 },   // 80-82: ramp to rep5
        { duration: '18m', target: 300 },  // 82-100: rep5 stable (18min)
        
        // Cooldown
        { duration: '3m', target: 10 },    // 100-103: cooldown
      ],
      gracefulStop: '30s',
      exec: 'balancedTrafficFlow',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<10000'],
    'errors': ['rate<0.35'],
  },
  setupTimeout: '300s',
};

export function balancedTrafficFlow(data) {
  if (data && data.tokens && Object.keys(userTokens).length === 0) {
    userTokens = data.tokens;
  }
  
  const session = getUserSession();
  const stage = getCurrentStage();
  const scenario = Math.random();
  
  if (scenario < 0.30) {
    // Scenario 1: Browse & Buy Journey (30%)
    // Frontend -> Product -> Recommender -> Order -> Authen
    
    const browseCount = stage === 1 ? 1 : stage === 2 ? 2 : stage === 3 ? 3 : stage === 4 ? 6 : 8;
    for (let i = 0; i < browseCount; i++) {
      browseProducts();
      sleep(stage === 1 ? 0.15 : stage === 2 ? 0.05 : stage === 3 ? 0.01 : stage === 4 ? 0.005 : 0.002);
    }
    
    // Recommender calls
    const recCount = stage === 1 ? 2 : stage === 2 ? 3 : stage === 3 ? 4 : stage === 4 ? 6 : 8;
    for (let i = 0; i < recCount; i++) {
      getRecommendations();
      sleep(stage === 1 ? 0.12 : stage === 2 ? 0.04 : stage === 3 ? 0.01 : stage === 4 ? 0.005 : 0.002);
    }
    
    if (session.token && Math.random() < (stage === 1 ? 0.3 : stage === 2 ? 0.6 : stage === 3 ? 0.85 : stage === 4 ? 0.9 : 0.95)) {
      verifySession(session.token);
      sleep(stage === 3 ? 0.01 : stage === 4 ? 0.01 : 0.015);
      createOrder(session.token);
      sleep(stage === 3 ? 0.01 : stage === 4 ? 0.01 : 0.02);
      if (Math.random() < (stage === 2 ? 0.5 : stage === 3 ? 0.7 : stage === 4 ? 0.75 : 0.8)) {
        viewMyOrders(session.token);
      }
    }
    
    // Add booking for Stage 2 and Stage 3
    if (stage === 2 && session.token && Math.random() < 0.65) {
      viewBookings();
      sleep(0.025);
      viewBookings();
      sleep(0.025);
      if (Math.random() < 0.55) {
        createBooking(session.token);
      }
    } else if (stage === 3 && session.token && Math.random() < 0.8) {
      viewBookings();
      sleep(0.02);
      viewBookings();
      sleep(0.02);
      if (Math.random() < 0.7) {
        createBooking(session.token);
      }
    } else if (stage >= 4 && session.token && Math.random() < 0.95) {
      viewBookings();
      sleep(0.01);
      viewBookings();
      sleep(0.01);
      if (Math.random() < 0.85) {
        createBooking(session.token);
      }
    }
    
  } else if (scenario < 0.60) {
    // Scenario 2: Profile & Orders Management (25%)
    // Authen -> Profile -> Order
    
    if (session.token) {
      const verifyCount = stage === 1 ? 1 : stage === 2 ? 2 : stage === 3 ? 4 : stage === 4 ? 5 : 6;
      for (let i = 0; i < verifyCount; i++) {
        verifySession(session.token);
        sleep(stage === 3 ? 0.02 : stage === 4 ? 0.02 : stage === 5 ? 0.015 : 0.03);
      }
      
      // Profile always low load (rep1 for all stages)
      if (Math.random() < 0.4) {
        manageProfile(session.token, session.userId);
        sleep(0.01);
      }
      
      const orderViewCount = stage === 1 ? 1 : stage === 2 ? 2 : stage === 3 ? 3 : stage === 4 ? 6 : 8;
      for (let i = 0; i < orderViewCount; i++) {
        viewMyOrders(session.token);
        sleep(stage === 2 ? 0.03 : stage === 3 ? 0.02 : stage === 4 ? 0.005 : stage === 5 ? 0.002 : 0.003);
      }
      
      if (Math.random() < (stage === 3 ? 0.5 : stage >= 4 ? 0.5 : 0.3)) {
        postComment(session.token);
        sleep(stage === 3 ? 0.02 : 0.03);
      }
      
      if (Math.random() < (stage === 1 ? 0.3 : stage === 2 ? 0.5 : stage === 3 ? 0.75 : 0.8)) {
        changePassword(session.token);
        sleep(stage === 3 ? 0.02 : 0.03);
      }
      
      // Add booking for Stage 2 and Stage 3
      if (stage === 2 && Math.random() < 0.5) {
        viewBookings();
        sleep(0.025);
        viewBookings();
        sleep(0.025);
      } else if (stage === 3 && Math.random() < 0.65) {
        viewBookings();
        sleep(0.02);
        viewBookings();
        sleep(0.02);
      } else if (stage >= 4 && Math.random() < 0.9) {
        viewBookings();
        sleep(0.01);
        viewBookings();
        sleep(0.01);
      }
    }
    
  } else if (scenario < 0.63) {
    // Scenario 3: Booking Journey (18%)
    // Frontend -> Booking
    
    const pageLoadProb = stage === 1 ? 0.4 : stage === 2 ? 0.6 : stage === 3 ? 0.5 : 0.5;
    if (Math.random() < pageLoadProb) {
      http.get(`${BASE_URL}/booking`, { headers: commonHeaders });
      sleep(stage === 1 ? 0.15 : stage === 2 ? 0.03 : stage === 3 ? 0.01 : 0.01);
    }
    
    const bookingViewCount = stage === 1 ? 1 : stage === 2 ? 4 : stage === 3 ? 5 : stage === 4 ? 8 : 10;
    for (let i = 0; i < bookingViewCount; i++) {
      viewBookings();
      sleep(stage === 1 ? 0.12 : stage === 2 ? 0.025 : stage === 3 ? 0.01 : stage === 4 ? 0.005 : 0.002);
    }
    
    if (session.token && Math.random() < (stage === 1 ? 0.4 : stage === 2 ? 0.8 : stage === 3 ? 0.9 : 0.9)) {
      verifySession(session.token);
      sleep(stage === 3 ? 0.02 : 0.015);
      createBooking(session.token);
      sleep(stage === 2 ? 0.03 : stage === 3 ? 0.02 : 0.04);
      if (Math.random() < (stage === 2 ? 0.8 : stage === 3 ? 0.8 : 0.7)) {
        viewBookings();
      }
    }
    
  } else if (scenario < 0.78) {
    // Scenario 4: Recommender Heavy (15%)
    // Recommender -> Product (PURE RECOMMENDER FOCUS)
    
    // Heavy recommender calls to ensure scaling
    const recCount = stage === 1 ? 4 : stage === 2 ? 4 : stage === 3 ? 4 : stage === 4 ? 6 : 8;
    for (let i = 0; i < recCount; i++) {
      getRecommendations();
      sleep(stage === 1 ? 0.05 : stage === 2 ? 0.03 : stage === 3 ? 0.01 : stage === 4 ? 0.005 : 0.002);
    }
    
    // Optional product view after recommendations
    if (Math.random() < 0.6) {
      browseProducts();
      sleep(stage === 3 ? 0.01 : 0.03);
      getRecommendations();
    }
    
  } else {
    // Scenario 5: Mixed Services (22%)
    // All services including booking
    
    const browseCount = stage === 1 ? 1 : stage === 2 ? 2 : stage === 3 ? 3 : stage === 4 ? 6 : 10;
    for (let i = 0; i < browseCount; i++) {
      browseProducts();
      sleep(stage === 1 ? 0.15 : stage === 2 ? 0.05 : stage === 3 ? 0.01 : stage === 4 ? 0.005 : 0.002);
    }
    
    // Recommender calls
    const recCount = stage === 1 ? 3 : stage === 2 ? 3 : stage === 3 ? 4 : stage === 4 ? 6 : 8;
    for (let i = 0; i < recCount; i++) {
      getRecommendations();
      sleep(stage === 1 ? 0.08 : stage === 2 ? 0.05 : stage === 3 ? 0.01 : stage === 4 ? 0.005 : 0.002);
    }
    
    if (session.token && Math.random() < (stage === 3 ? 0.7 : stage === 4 ? 0.75 : stage === 5 ? 0.8 : 0.4)) {
      viewMyOrders(session.token);
      sleep(stage === 3 ? 0.01 : 0.05);
    }
    
    // Extra booking calls for Stage 2 and Stage 3
    if (stage === 2 && Math.random() < 0.6) {
      viewBookings();
      sleep(0.025);
      viewBookings();
      sleep(0.025);
      if (session.token && Math.random() < 0.6) {
        createBooking(session.token);
      }
    } else if (stage === 3 && Math.random() < 0.75) {
      viewBookings();
      sleep(0.02);
      viewBookings();
      sleep(0.02);
      if (session.token && Math.random() < 0.75) {
        createBooking(session.token);
      }
    } else if (stage === 4) {
      viewBookings();
      sleep(0.01);
      viewBookings();
      sleep(0.01);
      if (session.token && Math.random() < 0.75) {
        createBooking(session.token);
      }
    } else if (stage >= 5) {
      viewBookings();
      sleep(0.01);
      viewBookings();
      sleep(0.01);
      if (session.token && Math.random() < 0.8) {
        createBooking(session.token);
      }
    }
  }
  
  // Think time between scenarios - varies by stage to control load
  if (stage === 1) {
    sleep(Math.random() * 2 + 3);      // 3-5s for stage 1 (rep1)
  } else if (stage === 2) {
    sleep(Math.random() * 0.3 + 0.4);  // 0.4-0.7s for stage 2 (rep2)
  } else if (stage === 3) {
    sleep(Math.random() * 0.1 + 0.15); // 0.15-0.25s for stage 3 (rep3) - increased for 160 VUs
  } else if (stage === 4) {
    sleep(Math.random() * 0.03 + 0.05); // 0.05-0.08s for stage 4 (rep4) - drastically reduced
  } else {
    sleep(Math.random() * 0.01 + 0.02);// 0.02-0.03s for stage 5 (rep5) - minimal wait
  }
}


