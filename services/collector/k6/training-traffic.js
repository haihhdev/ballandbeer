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
for (let i = 1; i <= 100; i++) {
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
  const usePreAuthenUser = __VU <= 200;
  
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
        email: dynamicEmail,
        password: dynamicPassword,
      }), {
        headers: { ...commonHeaders, 'Content-Type': 'application/json' },
      });
      
      if (res.status !== 200) {
        http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
          email: dynamicEmail,
          password: dynamicPassword,
          fullName: dynamicName,
        }), {
          headers: { ...commonHeaders, 'Content-Type': 'application/json' },
        });
        
        sleep(0.2);
        
        res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
          email: dynamicEmail,
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
  
  if (Math.random() < 0.4) {
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
  
  if (Math.random() < 0.6) {
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
  
  if (Math.random() < 0.45) {
    const pageRes = http.get(`${BASE_URL}/profile`, {
      headers: {
        ...commonHeaders,
        'Authorization': `Bearer ${token}`,
      },
    });
    check(pageRes, { 'view profile page': (r) => r.status === 200 });
    sleep(0.1);
  }
  
  const res = http.get(`${BASE_URL}/api/profile/id/${userId}`, {
    headers: {
      ...commonHeaders,
      'Authorization': `Bearer ${token}`,
    },
  });
  
  check(res, { 'view profile API': (r) => r.status === 200 }) || errorRate.add(1);
  
  if (Math.random() > 0.7) {
    sleep(0.1);
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

// Pre-authenticate all users to avoid auth service overload
export function setup() {
  console.log('Setup: Pre-authenticating test users...');
  const tokens = {};
  
  for (let i = 0; i < TEST_USERS.length; i++) {
    const user = TEST_USERS[i];
    
    let res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
      email: user.email,
      password: user.password,
    }), {
      headers: { ...commonHeaders, 'Content-Type': 'application/json' },
    });
    
    if (res.status !== 200) {
      http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
        email: user.email,
        password: user.password,
        fullName: user.name,
      }), {
        headers: { ...commonHeaders, 'Content-Type': 'application/json' },
      });
      sleep(0.2);
      res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
        email: user.email,
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

// 7-hour training pattern: 1→2→3→4→5→4→3→2→3→4→3→2→3→4→5→4→3→2→1
// Target: 2-4 replicas (75%), threshold: CPU/Memory > 40%
export const options = {
  scenarios: {
    balanced_training_7h: {
      executor: 'ramping-vus',
      startTime: '0s',
      stages: [
        // Cycle 1: Full range 1-5 (0-175 min = 2h55m)
        { duration: '3m', target: 15 },    // 00:00-03 Ramp to 1 replica
        { duration: '12m', target: 15 },   // 03:00-15 Stable 1 replica (12 min)
        { duration: '3m', target: 35 },    // 15:00-18 Ramp to 2 replicas
        { duration: '20m', target: 35 },   // 18:00-38 Stable 2 replicas (20 min)
        { duration: '3m', target: 60 },    // 38:00-41 Ramp to 3 replicas
        { duration: '30m', target: 60 },   // 41:00-71 Stable 3 replicas (30 min) ← PEAK
        { duration: '3m', target: 90 },    // 71:00-74 Ramp to 4 replicas
        { duration: '24m', target: 90 },   // 74:00-98 Stable 4 replicas (24 min)
        { duration: '3m', target: 130 },   // 98:00-101 Ramp to 5 replicas
        { duration: '15m', target: 130 },  // 101-116 Stable 5 replicas (15 min)
        
        // Scale down gradually (116-200 min)
        { duration: '3m', target: 90 },    // 116-119 Down to 4
        { duration: '20m', target: 90 },   // 119-139 Stable 4 replicas (20 min)
        { duration: '3m', target: 60 },    // 139-142 Down to 3
        { duration: '30m', target: 60 },   // 142-172 Stable 3 replicas (30 min) ← PEAK
        { duration: '3m', target: 35 },    // 172-175 Down to 2
        { duration: '25m', target: 35 },   // 175-200 Stable 2 replicas (25 min)
        
        // Cycle 2: Focus on 2-4 (200-286 min = 1h26m)
        { duration: '3m', target: 60 },    // 200-203 Ramp to 3
        { duration: '30m', target: 60 },   // 203-233 Stable 3 replicas (30 min) ← PEAK
        { duration: '3m', target: 90 },    // 233-236 Ramp to 4
        { duration: '24m', target: 90 },   // 236-260 Stable 4 replicas (24 min)
        { duration: '3m', target: 60 },    // 260-263 Down to 3
        { duration: '20m', target: 60 },   // 263-283 Stable 3 replicas (20 min)
        { duration: '3m', target: 35 },    // 283-286 Down to 2
        { duration: '19m', target: 35 },   // 286-305 Stable 2 replicas (19 min)
        
        // Cycle 3: Final push 3-5 then cool down (305-420 min = 1h55m)
        { duration: '3m', target: 60 },    // 305-308 Ramp to 3
        { duration: '20m', target: 60 },   // 308-328 Stable 3 replicas (20 min)
        { duration: '3m', target: 90 },    // 328-331 Ramp to 4
        { duration: '17m', target: 90 },   // 331-348 Stable 4 replicas (17 min)
        { duration: '3m', target: 130 },   // 348-351 Ramp to 5
        { duration: '15m', target: 130 },  // 351-366 Stable 5 replicas (15 min)
        { duration: '3m', target: 90 },    // 366-369 Down to 4
        { duration: '17m', target: 90 },   // 369-386 Stable 4 replicas (17 min)
        { duration: '3m', target: 60 },    // 386-389 Down to 3
        { duration: '15m', target: 60 },   // 389-404 Stable 3 replicas (15 min)
        { duration: '3m', target: 35 },    // 404-407 Down to 2
        { duration: '5m', target: 35 },    // 407-412 Stable 2 replicas (5 min)
        { duration: '5m', target: 15 },    // 412-417 Cool down to 1
        { duration: '3m', target: 15 },    // 417-420 Final stable 1 replica (3 min)
      ],
      gracefulStop: '30s',
      exec: 'balancedTrafficFlow',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<8000'],
    'errors': ['rate<0.30'],
  },
  setupTimeout: '120s',
};

export function balancedTrafficFlow(data) {
  if (data && data.tokens && Object.keys(userTokens).length === 0) {
    userTokens = data.tokens;
  }
  
  const currentVUs = __VU;
  const session = getUserSession();
  
  // Very aggressive traffic to trigger 40% CPU with reduced requests
  let thinkTime;
  let requestIntensity;
  
  if (currentVUs <= 20) {
    // 1 replica: push to 40%+ CPU (booking needs 20m, order needs 30m, recommender needs 40m)
    thinkTime = Math.random() * 0.4 + 0.2;  // 0.2-0.6s
    requestIntensity = 4;
  } else if (currentVUs <= 40) {
    // 2 replicas: push to 50%+ CPU per pod
    thinkTime = Math.random() * 0.25 + 0.15;  // 0.15-0.4s
    requestIntensity = 5;
  } else if (currentVUs <= 70) {
    // 3 replicas: push to 60%+ CPU per pod
    thinkTime = Math.random() * 0.2 + 0.1;  // 0.1-0.3s
    requestIntensity = 6;
  } else if (currentVUs <= 100) {
    // 4 replicas: push to 70%+ CPU per pod
    thinkTime = Math.random() * 0.15 + 0.08;  // 0.08-0.23s
    requestIntensity = 7;
  } else {
    // 5 replicas: peak load >80% CPU per pod
    thinkTime = Math.random() * 0.12 + 0.05;  // 0.05-0.17s
    requestIntensity = 8;
  }
  
  // Execute multiple requests to increase CPU load
  for (let i = 0; i < requestIntensity; i++) {
    const serviceSelector = Math.random();
    
    if (serviceSelector < 0.14) {
      // Authen service - lightweight (50-150m CPU)
      if (session.token) {
        verifySession(session.token);
        verifySession(session.token);
        verifySession(session.token);
      } else {
        browseProducts();
        browseProducts();
      }
    } else if (serviceSelector < 0.28) {
      // Booking service - INCREASED LOAD (CPU request 50m, need 20m for 40%)
      viewBookings();
      viewBookings();
      viewBookings();
      if (session.token) {
        createBooking(session.token);
        viewBookings();
        if (Math.random() < 0.5) {
          createBooking(session.token);
        }
      }
    } else if (serviceSelector < 0.42) {
      // Order service - INCREASED LOAD (CPU request 75m, need 30m for 40%)
      if (session.token) {
        createOrder(session.token);
        viewMyOrders(session.token);
        viewMyOrders(session.token);
        if (Math.random() < 0.7) {
          createOrder(session.token);
        }
      } else {
        browseProducts();
        viewProductWithComments();
        browseProducts();
      }
    } else if (serviceSelector < 0.56) {
      // Product service - HEAVY (500-1000m CPU) - needs most load
      browseProducts();
      viewProductWithComments();
      browseProducts();
      viewProductWithComments();
    } else if (serviceSelector < 0.70) {
      // Profile service - very lightweight (25-100m CPU)
      if (session.token) {
        manageProfile(session.token, session.userId);
        manageProfile(session.token, session.userId);
      } else {
        browseProducts();
      }
    } else if (serviceSelector < 0.84) {
      // Frontend service - medium (100-150m CPU)
      browseProducts();
      viewProductWithComments();
      browseProducts();
    } else {
      // Recommender service - HEAVY COMPUTE (CPU request 100m, need 40m for 40%)
      // ML inference with Keras model - very CPU intensive
      getRecommendations();
      getRecommendations();
      getRecommendations();
      getRecommendations();
      if (Math.random() < 0.6) {
        getRecommendations();
        getRecommendations();
      }
    }
    
    if (i < requestIntensity - 1) {
      sleep(0.05);
    }
  }
  
  sleep(thinkTime);
}


