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
  if (Math.random() < 0.3) {
    const pageRes = http.get(`${BASE_URL}/product`, {
      headers: commonHeaders,
    });
    check(pageRes, { 'browse products page': (r) => r.status === 200 }) || errorRate.add(1);
    sleep(0.1);
  }
  
  // Only call API 80% of time (increased from 50% for Stage 5)
  if (Math.random() < 0.8) {
    const res = http.get(`${BASE_URL}/api/products`, {
      headers: commonHeaders,
    });
    
    check(res, { 'browse products API': (r) => r.status === 200 }) || errorRate.add(1);
    
    if (res.status === 200 && Math.random() < 0.1) {
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
  
  if (Math.random() < 0.7) {
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
        // Block 1: rep1->2->3->4->5 (0-125min) - Initial scale up with gradual transitions
        { duration: '2m', target: 25 },    // 0-2: ramp to rep1
        { duration: '23m', target: 25 },   // 2-25: rep1 stable (23min)
        { duration: '3m', target: 65 },    // 25-28: slow ramp to rep2 (3min for scale down)
        { duration: '22m', target: 65 },   // 28-50: rep2 stable (22min)
        { duration: '3m', target: 95 },    // 50-53: slow ramp to rep3 (3min for scale down)
        { duration: '22m', target: 95 },   // 53-75: rep3 stable (22min)
        { duration: '3m', target: 145 },   // 75-78: slow ramp to rep4 (3min for scale down)
        { duration: '22m', target: 145 },  // 78-100: rep4 stable (22min)
        { duration: '3m', target: 160 },   // 100-103: slow ramp to rep5 (3min for scale down)
        { duration: '22m', target: 160 },  // 103-125: rep5 stable (22min)
        
        // Block 2: rep5->4->3->2->1 (125-235min) - Gradual scale down with longer low traffic
        { duration: '3m', target: 145 },   // 125-128: down to rep4 (3min transition)
        { duration: '22m', target: 145 },  // 128-150: rep4 stable (22min)
        { duration: '3m', target: 95 },    // 150-153: down to rep3 (3min transition)
        { duration: '22m', target: 95 },   // 153-175: rep3 stable (22min)
        { duration: '3m', target: 65 },    // 175-178: down to rep2 (3min transition)
        { duration: '22m', target: 65 },   // 178-200: rep2 stable (22min)
        { duration: '4m', target: 25 },    // 200-204: down to rep1 (4min for scale down)
        { duration: '31m', target: 25 },   // 204-235: rep1 stable (31min - long for scale down)
        
        // Block 3: rep1->2->3->4->2 (235-310min) - Smooth progression
        { duration: '3m', target: 65 },    // 235-238: ramp to rep2
        { duration: '22m', target: 65 },   // 238-260: rep2 stable (22min)
        { duration: '3m', target: 95 },    // 260-263: ramp to rep3
        { duration: '22m', target: 95 },   // 263-285: rep3 stable (22min)
        { duration: '3m', target: 145 },   // 285-288: ramp to rep4
        { duration: '22m', target: 145 },  // 288-310: rep4 stable (22min)
        
        // Block 4: rep4->3->5->3 (310-385min) - High load pattern
        { duration: '3m', target: 95 },    // 310-313: down to rep3
        { duration: '22m', target: 95 },   // 313-335: rep3 stable (22min)
        { duration: '3m', target: 160 },   // 335-338: ramp to rep5
        { duration: '22m', target: 160 },  // 338-360: rep5 stable (22min)
        { duration: '3m', target: 95 },    // 360-363: down to rep3
        { duration: '22m', target: 95 },   // 363-385: rep3 stable (22min)
        
        // Block 5: rep3->2->1 (385-415min) - Final scale down with long low traffic
        { duration: '3m', target: 65 },    // 385-388: down to rep2
        { duration: '7m', target: 65 },    // 388-395: rep2 stable (7min)
        { duration: '4m', target: 25 },    // 395-399: down to rep1 (4min transition)
        { duration: '16m', target: 25 },   // 399-415: rep1 stable (16min - long for scale down)
        
        // Final cooldown
        { duration: '5m', target: 10 },    // 415-420: final cooldown (7 hours total)
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
    
    // Authenticated users can create order (25% for Stage 5 - reduced from 40%)
    if (session.token && Math.random() < 0.25) {
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
      
      // View and update profile (4 calls for Stage 5 rep2)
      manageProfile(session.token, session.userId);
      sleep(0.07);
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
      
      // Change password (40% for Stage 5 - reduced from 50%)
      if (Math.random() < 0.4) {
        changePassword(session.token);
      }
      
      // Extra verify session (35% for Stage 5 - reduced from 45%)
      if (Math.random() < 0.35) {
        verifySession(session.token);
      }
    }
    
  } else if (scenario < 0.68) {
    // Scenario 3: Booking Journey (15%)
    // Frontend → Booking → Create Booking
    // Simulates user checking and making field bookings
    
    // Always load booking page for frontend
    http.get(`${BASE_URL}/booking`, { headers: commonHeaders });
    sleep(0.12);
    
    // View available bookings (reduced to 1 call)
    viewBookings();
    sleep(0.1);
    
    // Authenticated users can create booking (40% for Stage 5 - reduced from 60%)
    if (session.token && Math.random() < 0.4) {
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
    
    // Get recommendations (2 calls for Stage 5 - reduced from 4)
    getRecommendations();
    sleep(0.05);
    getRecommendations();
    sleep(0.05);
    
    // View product details (8% for Stage 5 - increased from 3%)
    if (Math.random() < 0.08) {
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
  } else if (currentVUs <= 145) {
    sleep(Math.random() * 0.15 + 0.2);  // 0.2-0.35s for stage 4 (rep4)
  } else if (currentVUs <= 160) {
    sleep(Math.random() * 0.1 + 0.1);  // 0.1-0.2s for stage 5 (rep5)
  } else {
    sleep(Math.random() * 0.05 + 0.05);  // 0.05-0.1s for higher stages
  }
}


