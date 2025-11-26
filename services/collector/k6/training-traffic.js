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
  if (Math.random() < 0.5) {
    const pageRes = http.get(`${BASE_URL}/product`, {
      headers: commonHeaders,
    });
    check(pageRes, { 'browse products page': (r) => r.status === 200 }) || errorRate.add(1);
    sleep(0.1);
  }
  
  const res = http.get(`${BASE_URL}/api/products`, {
    headers: commonHeaders,
  });
  
  check(res, { 'browse products API': (r) => r.status === 200 }) || errorRate.add(1);
  
  if (res.status === 200 && Math.random() < 0.2) {
    try {
      const products = JSON.parse(res.body);
      if (Array.isArray(products) && products.length > 0) {
        const product = randomItem(products);
        const productId = product._id || product.id;
        
        sleep(0.2);
        
        if (Math.random() < 0.25) {
          const detailPageRes = http.get(`${BASE_URL}/product/${productId}`, {
            headers: commonHeaders,
          });
          check(detailPageRes, { 'view product detail page': (r) => r.status === 200 });
          sleep(0.1);
        }
        
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
    sleep(0.1);
  }
  
  const res = http.get(`${BASE_URL}/api/products/${productId}`, {
    headers: commonHeaders,
  });
  check(res, { 'view product API': (r) => r.status === 200 }) || errorRate.add(1);
  
  if (res.status === 200 && Math.random() < 0.3) {
    sleep(0.2);
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
  const date = '2025-11-15';
  
  if (Math.random() < 0.5) {
    const pageRes = http.get(`${BASE_URL}/booking`, {
      headers: commonHeaders,
    });
    check(pageRes, { 'view bookings page': (r) => r.status === 200 }) || errorRate.add(1);
    sleep(0.1);
  }
  
  const res = http.get(`${BASE_URL}/api/bookings/${fieldId}/${date}`, {
    headers: commonHeaders,
  });
  
  check(res, { 'view bookings API': (r) => r.status === 200 }) || errorRate.add(1);
}

function createBooking(token) {
  if (!token) return;
  
  const fieldId = randomInt(1, 5);
  const date = '2025-11-15';
  const startTime = randomInt(8, 20);
  
  if (Math.random() < 0.5) {
    const pageRes = http.get(`${BASE_URL}/booking`, {
      headers: {
        ...commonHeaders,
        'Authorization': `Bearer ${token}`,
      },
    });
    check(pageRes, { 'load booking page': (r) => r.status === 200 });
    sleep(0.15);
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
  
  if (Math.random() < 0.4) {
    const pageRes = http.get(`${BASE_URL}/checkout`, {
      headers: {
        ...commonHeaders,
        'Authorization': `Bearer ${token}`,
      },
    });
    check(pageRes, { 'load checkout page': (r) => r.status === 200 });
    sleep(0.2);
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
    sleep(0.1);
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
  
  // Always call API to increase load (remove page load randomness)
  const res = http.get(`${BASE_URL}/api/profile/id/${userId}`, {
    headers: {
      ...commonHeaders,
      'Authorization': `Bearer ${token}`,
    },
  });
  
  check(res, { 'view profile API': (r) => r.status === 200 }) || errorRate.add(1);
  
  // Always update profile (100%)
  if (Math.random() < 1.0) {
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
// Stage 1: ALL services rep1
//   - Authen: 1, Booking: 1, Order: 1, Product: 1, Profile: 1, Frontend: 1, Recommender: 1
// 
// Stage 2: Authen rep1, Profile rep1, OTHERS rep2
//   - Authen: 1, Profile: 1
//   - Booking: 2, Order: 2, Product: 2, Frontend: 2, Recommender: 2
// 
// Stage 3: Authen rep2, Profile rep1, OTHERS rep3
//   - Profile: 1
//   - Authen: 2
//   - Booking: 3, Order: 3, Product: 3, Frontend: 3, Recommender: 3
// 
// Stage 4: Authen rep3, Profile rep2, OTHERS rep4
//   - Profile: 2
//   - Authen: 3
//   - Booking: 4, Order: 4, Product: 4, Frontend: 4, Recommender: 4
// 
// Stage 5: Authen rep3, Profile rep2, OTHERS rep5 (or 4 if can't reach)
//   - Profile: 2
//   - Authen: 3
//   - Booking: 5, Order: 5, Product: 5, Frontend: 5, Recommender: 5
// 
// KEDA mechanism: CPU threshold 40%, cooldown 120s
// Formula: replicas = ceil(current_replicas × current_utilization / 40%)
// ===============================================================================
// Testing: 15min per stage for validation before full run
export const options = {
  scenarios: {
    realistic_workflow_training: {
      executor: 'ramping-vus',
      startTime: '0s',
      stages: [
        // COMMENTED - Stage 1: All rep1 (TESTED - OK)
        // { duration: '1m', target: 25 },    // 0-1: ramp to low load
        // { duration: '14m', target: 25 },   // 1-15: rep1 stable
        
        // COMMENTED - Stage 2: Authen 1, Profile 1, others 2 (TESTED - OK)
        // { duration: '1m', target: 65 },    // 0-1: ramp to moderate
        // { duration: '14m', target: 65 },   // 1-15: rep2 stable
        
        // COMMENTED - Stage 3: Authen 2, Profile 1, others 3 (TESTED)
        // { duration: '1m', target: 95 },    // 0-1: ramp to high
        // { duration: '14m', target: 95 },   // 1-15: rep3 stable
        
        // Stage 4: Authen 3, Profile 2, others 4 (0-15min)
        { duration: '1m', target: 140 },   // 0-1: ramp to very high
        { duration: '14m', target: 140 },  // 1-15: rep4 stable
        
        // COMMENTED - Stage 5: Authen 3, Profile 2, others 5
        // { duration: '1m', target: 160 },   // ramp to max
        // { duration: '14m', target: 160 },  // rep5 stable
        
        // Cooldown
        { duration: '2m', target: 10 },    // cooldown
        
        // COMMENTED OUT - All other blocks
        // // Block 2: rep5->4->3->2 (70-126min)
        // { duration: '2m', target: 140 },   // 70-72: down to rep4
        // { duration: '18m', target: 140 },  // 72-90: rep4 stable (18min)
        // { duration: '2m', target: 90 },    // 90-92: down to rep3
        // { duration: '18m', target: 90 },   // 92-110: rep3 stable (18min)
        // { duration: '2m', target: 55 },    // 110-112: down to rep2
        // { duration: '14m', target: 55 },   // 112-126: rep2 stable (14min)
        // 
        // // Block 3: rep2->3->4->3 (126-188min)
        // { duration: '2m', target: 90 },    // 126-128: ramp to rep3
        // { duration: '20m', target: 90 },   // 128-148: rep3 stable (20min)
        // { duration: '2m', target: 140 },   // 148-150: ramp to rep4
        // { duration: '18m', target: 140 },  // 150-168: rep4 stable (18min)
        // { duration: '2m', target: 90 },    // 168-170: down to rep3
        // { duration: '18m', target: 90 },   // 170-188: rep3 stable (18min)
        // 
        // // Block 4: rep3->2->1->2 (188-238min)
        // { duration: '2m', target: 55 },    // 188-190: down to rep2
        // { duration: '20m', target: 55 },   // 190-210: rep2 stable (20min)
        // { duration: '2m', target: 25 },    // 210-212: down to rep1
        // { duration: '12m', target: 25 },   // 212-224: rep1 stable (12min)
        // { duration: '2m', target: 55 },    // 224-226: ramp to rep2
        // { duration: '12m', target: 55 },   // 226-238: rep2 stable (12min)
        // 
        // // Block 5: rep2->3->4->5->4 (238-294min)
        // { duration: '2m', target: 90 },    // 238-240: ramp to rep3
        // { duration: '16m', target: 90 },   // 240-256: rep3 stable (16min)
        // { duration: '2m', target: 140 },   // 256-258: ramp to rep4
        // { duration: '16m', target: 140 },  // 258-274: rep4 stable (16min)
        // { duration: '2m', target: 200 },   // 274-276: ramp to rep5
        // { duration: '6m', target: 200 },   // 276-282: rep5 stable (6min)
        // { duration: '2m', target: 140 },   // 282-284: down to rep4
        // { duration: '10m', target: 140 },  // 284-294: rep4 stable (10min)
        // 
        // // Block 6: rep4->3->2->3 (294-348min)
        // { duration: '2m', target: 90 },    // 294-296: down to rep3
        // { duration: '18m', target: 90 },   // 296-314: rep3 stable (18min)
        // { duration: '2m', target: 55 },    // 314-316: down to rep2
        // { duration: '16m', target: 55 },   // 316-332: rep2 stable (16min)
        // { duration: '2m', target: 90 },    // 332-334: ramp to rep3
        // { duration: '14m', target: 90 },   // 334-348: rep3 stable (14min)
        // 
        // // Block 7: rep3->4->3->2->1 (348-420min) - final cooldown
        // { duration: '2m', target: 140 },   // 348-350: ramp to rep4
        // { duration: '14m', target: 140 },  // 350-364: rep4 stable (14min)
        // { duration: '2m', target: 90 },    // 364-366: down to rep3
        // { duration: '14m', target: 90 },   // 366-380: rep3 stable (14min)
        // { duration: '2m', target: 55 },    // 380-382: down to rep2
        // { duration: '18m', target: 55 },   // 382-400: rep2 stable (18min)
        // { duration: '2m', target: 25 },    // 400-402: down to rep1
        // { duration: '13m', target: 25 },   // 402-415: rep1 stable (13min)
        // { duration: '5m', target: 10 },    // 415-420: final cooldown
      ],
      gracefulStop: '30s',
      exec: 'balancedTrafficFlow',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<8000'],
    'errors': ['rate<0.30'],
  },
  setupTimeout: '300s',
};

export function balancedTrafficFlow(data) {
  if (data && data.tokens && Object.keys(userTokens).length === 0) {
    userTokens = data.tokens;
  }
  
  const session = getUserSession();
  
  // Realistic user workflow scenarios - each VU simulates real user behavior
  const scenario = Math.random();
  
  if (scenario < 0.28) {
    // Scenario 1: Browse & Buy Journey (28%)
    // Frontend → Product → Recommender → Order
    // Simulates user browsing products, getting recommendations, and purchasing
    
    // Browse products (skip homepage to reduce frontend load)
    browseProducts();
    sleep(0.1);
    
    // Get recommendations
    getRecommendations();
    sleep(0.05);
    
    // Authenticated users can create order (30% unified)
    if (session.token && Math.random() < 0.3) {
      verifySession(session.token);
      sleep(0.05);
      createOrder(session.token);
    }
    
  } else if (scenario < 0.53) {
    // Scenario 2: Profile & Orders Management (25%)
    // Authen → Profile → Order History
    // Simulates user managing their profile and checking orders
    
    if (session.token) {
      // Verify session
      verifySession(session.token);
      sleep(0.05);
      
      // View and update profile (3 calls for rep2)
      manageProfile(session.token, session.userId);
      sleep(0.07);
      manageProfile(session.token, session.userId);
      sleep(0.07);
      manageProfile(session.token, session.userId);
      sleep(0.07);
      
      // Check order history
      viewMyOrders(session.token);
      sleep(0.1);
      
      // Occasionally post comment
      if (Math.random() < 0.2) {
        postComment(session.token);
      }
      
      // Change password (unified 45%)
      if (Math.random() < 0.45) {
        changePassword(session.token);
      }
      
      // Extra verify session (unified 40%)
      if (Math.random() < 0.4) {
        verifySession(session.token);
      }
    }
    
  } else if (scenario < 0.68) {
    // Scenario 3: Booking Journey (15%)
    // Frontend → Booking → Create Booking
    // Simulates user checking and making field bookings
    
    // Always load booking page for frontend
    http.get(`${BASE_URL}/booking`, { headers: commonHeaders });
    sleep(0.1);
    
    // View available bookings (reduced to 1 call)
    viewBookings();
    sleep(0.1);
    
    // Authenticated users can create booking (unified 70%)
    if (session.token && Math.random() < 0.7) {
      createBooking(session.token);
      sleep(0.1);
      
      // Verify booking was created
      viewBookings();
    }
    
  } else {
    // Scenario 4: Quick Browse & Recommender (32%) - adjusted from 35%
    // Frontend → Product → Recommender (focus on recommender)
    // Simulates user quickly browsing and checking recommendations
    
    // Browse products directly (skip homepage to reduce frontend load)
    browseProducts();
    sleep(0.05);
    
    // Get recommendations (unified 4 calls)
    getRecommendations();
    sleep(0.05);
    getRecommendations();
    sleep(0.05);
    getRecommendations();
    sleep(0.05);
    getRecommendations();
    sleep(0.05);
    
    // View product details (unified 5% to reduce product)
    if (Math.random() < 0.05) {
      viewProductWithComments();
      sleep(0.05);
      getRecommendations();
    }
  }
  
  // Think time between scenarios - varies by stage to control load
  const currentVUs = __VU;
  if (currentVUs <= 25) {
    sleep(Math.random() * 1 + 2);  // 2-3s for stage 1 (rep1) - threshold increased to 25
  } else if (currentVUs <= 65) {
    sleep(Math.random() * 0.3 + 0.5);  // 0.5-0.8s for stage 2 (rep2) - threshold increased to 65
  } else if (currentVUs <= 95) {
    sleep(Math.random() * 0.15 + 0.2);  // 0.2-0.35s for stage 3 (rep3)
  } else if (currentVUs <= 140) {
    sleep(Math.random() * 0.15 + 0.2);  // 0.2-0.35s for stage 4 (rep4)
  } else {
    sleep(Math.random() * 0.1 + 0.1);  // 0.1-0.2s for stage 5 (rep5)
  }
}


