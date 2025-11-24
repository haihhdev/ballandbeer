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

// 7-hour balanced training for even replica distribution across services
// Target distribution for most services (authen,booking,order,product,frontend,recommender): 
//   rep1: 15%, rep2: 25%, rep3: 25%, rep4: 25%, rep5: 10%
// Profile service only: rep1: 33%, rep2: 34%, rep3: 33%
// Total: 420 minutes = 7 hours
export const options = {
  scenarios: {
    balanced_training_7h: {
      executor: 'ramping-vus',
      startTime: '0s',
      stages: [
        // Block 1: rep1->2->3->4->5 (0-70min)
        { duration: '2m', target: 25 },    // 0-2: ramp to rep1
        { duration: '10m', target: 25 },   // 2-12: rep1 stable (10min)
        { duration: '2m', target: 55 },    // 12-14: ramp to rep2
        { duration: '18m', target: 55 },   // 14-32: rep2 stable (18min)
        { duration: '2m', target: 90 },    // 32-34: ramp to rep3
        { duration: '16m', target: 90 },   // 34-50: rep3 stable (16min)
        { duration: '2m', target: 140 },   // 50-52: ramp to rep4
        { duration: '8m', target: 140 },   // 52-60: rep4 stable (8min)
        { duration: '2m', target: 200 },   // 60-62: ramp to rep5
        { duration: '8m', target: 200 },   // 62-70: rep5 stable (8min)
        
        // Block 2: rep5->4->3->2 (70-126min)
        { duration: '2m', target: 140 },   // 70-72: down to rep4
        { duration: '18m', target: 140 },  // 72-90: rep4 stable (18min)
        { duration: '2m', target: 90 },    // 90-92: down to rep3
        { duration: '18m', target: 90 },   // 92-110: rep3 stable (18min)
        { duration: '2m', target: 55 },    // 110-112: down to rep2
        { duration: '14m', target: 55 },   // 112-126: rep2 stable (14min)
        
        // Block 3: rep2->3->4->3 (126-188min)
        { duration: '2m', target: 90 },    // 126-128: ramp to rep3
        { duration: '20m', target: 90 },   // 128-148: rep3 stable (20min)
        { duration: '2m', target: 140 },   // 148-150: ramp to rep4
        { duration: '18m', target: 140 },  // 150-168: rep4 stable (18min)
        { duration: '2m', target: 90 },    // 168-170: down to rep3
        { duration: '18m', target: 90 },   // 170-188: rep3 stable (18min)
        
        // Block 4: rep3->2->1->2 (188-238min)
        { duration: '2m', target: 55 },    // 188-190: down to rep2
        { duration: '20m', target: 55 },   // 190-210: rep2 stable (20min)
        { duration: '2m', target: 25 },    // 210-212: down to rep1
        { duration: '12m', target: 25 },   // 212-224: rep1 stable (12min)
        { duration: '2m', target: 55 },    // 224-226: ramp to rep2
        { duration: '12m', target: 55 },   // 226-238: rep2 stable (12min)
        
        // Block 5: rep2->3->4->5->4 (238-294min)
        { duration: '2m', target: 90 },    // 238-240: ramp to rep3
        { duration: '16m', target: 90 },   // 240-256: rep3 stable (16min)
        { duration: '2m', target: 140 },   // 256-258: ramp to rep4
        { duration: '16m', target: 140 },  // 258-274: rep4 stable (16min)
        { duration: '2m', target: 200 },   // 274-276: ramp to rep5
        { duration: '6m', target: 200 },   // 276-282: rep5 stable (6min)
        { duration: '2m', target: 140 },   // 282-284: down to rep4
        { duration: '10m', target: 140 },  // 284-294: rep4 stable (10min)
        
        // Block 6: rep4->3->2->3 (294-348min)
        { duration: '2m', target: 90 },    // 294-296: down to rep3
        { duration: '18m', target: 90 },   // 296-314: rep3 stable (18min)
        { duration: '2m', target: 55 },    // 314-316: down to rep2
        { duration: '16m', target: 55 },   // 316-332: rep2 stable (16min)
        { duration: '2m', target: 90 },    // 332-334: ramp to rep3
        { duration: '14m', target: 90 },   // 334-348: rep3 stable (14min)
        
        // Block 7: rep3->4->3->2->1 (348-420min) - final cooldown
        { duration: '2m', target: 140 },   // 348-350: ramp to rep4
        { duration: '14m', target: 140 },  // 350-364: rep4 stable (14min)
        { duration: '2m', target: 90 },    // 364-366: down to rep3
        { duration: '14m', target: 90 },   // 366-380: rep3 stable (14min)
        { duration: '2m', target: 55 },    // 380-382: down to rep2
        { duration: '18m', target: 55 },   // 382-400: rep2 stable (18min)
        { duration: '2m', target: 25 },    // 400-402: down to rep1
        { duration: '13m', target: 25 },   // 402-415: rep1 stable (13min)
        { duration: '5m', target: 10 },    // 415-420: final cooldown
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
  
  // Adaptive load based on VU count to trigger proper scaling
  // VU ranges calibrated for CPU thresholds: authen(20m), booking(20m), order(30m), product(200m), profile(10m), frontend(40m), recommender(40m)
  let thinkTime;
  let loadMultiplier;
  
  if (currentVUs <= 30) {
    // Target: 1 replica (low load, just above idle)
    thinkTime = Math.random() * 0.8 + 0.5;  // 0.5-1.3s think time
    loadMultiplier = 0.5;
  } else if (currentVUs <= 60) {
    // Target: 2 replicas (moderate load, ~50% CPU per pod)
    thinkTime = Math.random() * 0.5 + 0.3;  // 0.3-0.8s think time
    loadMultiplier = 1.0;
  } else if (currentVUs <= 100) {
    // Target: 3 replicas (high load, ~60% CPU per pod)
    thinkTime = Math.random() * 0.3 + 0.2;  // 0.2-0.5s think time
    loadMultiplier = 1.5;
  } else if (currentVUs <= 150) {
    // Target: 4 replicas (very high load, ~70% CPU per pod)
    thinkTime = Math.random() * 0.2 + 0.1;  // 0.1-0.3s think time
    loadMultiplier = 2.0;
  } else {
    // Target: 5 replicas (extreme load, >80% CPU per pod)
    thinkTime = Math.random() * 0.15 + 0.05; // 0.05-0.2s think time
    loadMultiplier = 2.5;
  }
  
  // Distribute traffic across services with proper weighting
  const serviceSelector = Math.random();
  
  if (serviceSelector < 0.15) {
    // Authen service (request: 50m, need 20m for scale)
    // Lightweight - increase from 2x to 2.5x for better scaling
    const iterations = Math.ceil(2.5 * loadMultiplier);
    for (let i = 0; i < iterations; i++) {
      if (session.token) {
        verifySession(session.token);
      } else {
        browseProducts();
      }
      if (i < iterations - 1) sleep(0.05);
    }
  } else if (serviceSelector < 0.30) {
    // Booking service (request: 50m, need 20m for scale) - 15%
    // Moderate - 3-4 calls per iteration
    const iterations = Math.ceil(2.5 * loadMultiplier);
    for (let i = 0; i < iterations; i++) {
      viewBookings();
      if (session.token && Math.random() < 0.4) {
        createBooking(session.token);
      }
      if (i < iterations - 1) sleep(0.08);
    }
  } else if (serviceSelector < 0.375) {
    // Order service (request: 75m, need 30m for scale) - 7.5% (REDUCED from 15%)
    // Extreme CPU intensive: Both writes and reads are expensive
    const iterations = Math.ceil(0.4 * loadMultiplier);
    for (let i = 0; i < iterations; i++) {
      if (session.token) {
        if (Math.random() < 0.05) {
          createOrder(session.token);
        } else {
          viewMyOrders(session.token);
        }
      } else {
        viewProductWithComments();
      }
      if (i < iterations - 1) sleep(0.1);
    }
  } else if (serviceSelector < 0.525) {
    // Product service (request: 500m, need 200m for scale) - 15%
    // VERY CPU intensive - reduce to 5x to maintain rep 2 at VU=55
    const iterations = Math.ceil(5 * loadMultiplier);
    for (let i = 0; i < iterations; i++) {
      if (Math.random() < 0.5) {
        browseProducts();
      } else {
        viewProductWithComments();
      }
      if (i < iterations - 1) sleep(0.03);
    }
  } else if (serviceSelector < 0.625) {
    // Profile service (request: 25m, need 10m for scale) - 10%
    // Very lightweight - 1-2 calls, target max 3 replicas
    const iterations = Math.min(Math.ceil(1 * loadMultiplier), 3);
    for (let i = 0; i < iterations; i++) {
      if (session.token) {
        manageProfile(session.token, session.userId);
      } else {
        browseProducts();
      }
      if (i < iterations - 1) sleep(0.1);
    }
  } else if (serviceSelector < 0.775) {
    // Frontend service (request: 100m, need 40m for scale) - 15%
    // Moderate Next.js SSR - 3-4 calls per iteration
    const iterations = Math.ceil(3 * loadMultiplier);
    for (let i = 0; i < iterations; i++) {
      browseProducts();
      if (Math.random() < 0.3) {
        viewProductWithComments();
      }
      if (i < iterations - 1) sleep(0.06);
    }
  } else {
    // Recommender service (request: 100m, need 40m for scale) - 22.5% (increased from 15%)
    // ML inference - increase from 5x to 6x for better scaling
    const iterations = Math.ceil(6 * loadMultiplier);
    for (let i = 0; i < iterations; i++) {
      getRecommendations();
      if (i < iterations - 1) sleep(0.04);
    }
  }
  
  sleep(thinkTime);
}


