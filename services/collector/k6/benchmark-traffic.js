import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

const BASE_URL = __ENV.BASE_URL || 'http://ingress-nginx-controller.ingress-nginx.svc.cluster.local';

const commonHeaders = {
  'Host': 'ballandbeer.com',
  'User-Agent': 'k6-benchmark-load-generator',
  'Accept': 'application/json',
};

// Deterministic user pool - fixed 100 users for reproducible traffic
const TEST_USERS = [];
for (let i = 1; i <= 100; i++) {
  TEST_USERS.push({
    email: `benchmark${i}@test.local`,
    password: 'Benchmark2024!',
    name: `Benchmark User ${i}`,
    token: null,
    userId: null,
  });
}

let productIds = [];
let userTokens = {};

// Seeded random for deterministic behavior
function seededRandom(vu, iteration) {
  const x = Math.sin(vu * 12345 + iteration * 67890) * 10000;
  return x - Math.floor(x);
}

function randomInt(min, max, vu, iteration) {
  return Math.floor(seededRandom(vu, iteration) * (max - min + 1)) + min;
}

function randomItem(arr, vu, iteration) {
  const idx = Math.floor(seededRandom(vu, iteration + 1) * arr.length);
  return arr[idx];
}

function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getUserSession(vu) {
  const userIndex = (vu - 1) % TEST_USERS.length;
  const user = TEST_USERS[userIndex];
  const stored = userTokens[user.email];
  return {
    user,
    token: stored ? stored.token : null,
    userId: stored ? stored.userId : null,
  };
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

function browseProducts(vu, iteration) {
  const res = http.get(`${BASE_URL}/api/products`, {
    headers: commonHeaders,
  });
  
  check(res, { 'browse products': (r) => r.status === 200 }) || errorRate.add(1);
  
  if (res.status === 200 && seededRandom(vu, iteration + 2) < 0.3) {
    try {
      const products = JSON.parse(res.body);
      if (Array.isArray(products) && products.length > 0) {
        const product = randomItem(products, vu, iteration + 3);
        const productId = product._id || product.id;
        
        sleep(0.1);
        
        const detailRes = http.get(`${BASE_URL}/api/products/${productId}`, {
          headers: commonHeaders,
        });
        check(detailRes, { 'view product detail': (r) => r.status === 200 });
      }
    } catch (e) {}
  }
}

function getRecommendations(vu, iteration) {
  if (productIds.length === 0) {
    productIds = fetchProducts();
  }
  
  const productId = randomItem(productIds, vu, iteration);
  
  const res = http.post(`${BASE_URL}/recommend`, JSON.stringify({
    product_id: productId,
  }), {
    headers: { ...commonHeaders, 'Content-Type': 'application/json' },
  });
  
  check(res, { 'get recommendations': (r) => r.status === 200 }) || errorRate.add(1);
}

function viewBookings(vu, iteration) {
  const fieldId = randomInt(1, 5, vu, iteration);
  const date = getTodayDate();
  
  const res = http.get(`${BASE_URL}/api/bookings/${fieldId}/${date}`, {
    headers: commonHeaders,
  });
  
  check(res, { 'view bookings': (r) => r.status === 200 }) || errorRate.add(1);
}

function createBooking(token, vu, iteration) {
  if (!token) return;
  
  const fieldId = randomInt(1, 5, vu, iteration);
  const date = getTodayDate();
  const startTime = randomInt(8, 20, vu, iteration + 1);
  
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
  
  check(res, { 'create booking': (r) => r.status === 200 || r.status === 201 || r.status === 400 }) || errorRate.add(1);
}

function createOrder(token, vu, iteration) {
  if (!token) return;
  
  if (productIds.length === 0) {
    productIds = fetchProducts();
  }
  
  const numItems = randomInt(1, 3, vu, iteration);
  const items = [];
  for (let i = 0; i < numItems; i++) {
    items.push({
      productId: randomItem(productIds, vu, iteration + i),
      quantity: randomInt(1, 5, vu, iteration + i + 10),
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
  
  const res = http.get(`${BASE_URL}/api/orders/my-orders`, {
    headers: {
      ...commonHeaders,
      'Authorization': `Bearer ${token}`,
    },
  });
  
  check(res, { 'view my orders': (r) => r.status === 200 }) || errorRate.add(1);
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
  
  const res = http.get(`${BASE_URL}/api/profile/id/${userId}`, {
    headers: {
      ...commonHeaders,
      'Authorization': `Bearer ${token}`,
    },
  });
  
  check(res, { 'view profile': (r) => r.status === 200 }) || errorRate.add(1);
}

// Pre-authenticate all users for deterministic token reuse
export function setup() {
  console.log('Setup: Pre-authenticating benchmark users...');
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
        username: user.email.split('@')[0],
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

// Benchmark scenario: deterministic traffic patterns
// Ramp up: 20 -> 40 -> 60 -> 80 -> 100 VUs (each stage 15min)
// Ramp down: 80 -> 60 -> 40 -> 20 VUs (each stage 15min)
// Total duration: 150 minutes (2.5 hours) for initial testing
export const options = {
  scenarios: {
    benchmark_workflow: {
      executor: 'ramping-vus',
      startTime: '0s',
      stages: [
        // Ramp up stages (each 15min)
        { duration: '2m', target: 20 },    // 0-2min: ramp to 20 VUs
        { duration: '13m', target: 20 },   // 2-15min: stable at 20 VUs
        
        { duration: '2m', target: 40 },    // 15-17min: ramp to 40 VUs
        { duration: '13m', target: 40 },   // 17-30min: stable at 40 VUs
        
        { duration: '2m', target: 60 },    // 30-32min: ramp to 60 VUs
        { duration: '13m', target: 60 },   // 32-45min: stable at 60 VUs
        
        { duration: '2m', target: 80 },    // 45-47min: ramp to 80 VUs
        { duration: '13m', target: 80 },   // 47-60min: stable at 80 VUs
        
        { duration: '2m', target: 100 },   // 60-62min: ramp to 100 VUs
        { duration: '13m', target: 100 },  // 62-75min: stable at 100 VUs
        
        // Ramp down stages (each 15min)
        { duration: '2m', target: 80 },    // 75-77min: ramp to 80 VUs
        { duration: '13m', target: 80 },   // 77-90min: stable at 80 VUs
        
        { duration: '2m', target: 60 },    // 90-92min: ramp to 60 VUs
        { duration: '13m', target: 60 },   // 92-105min: stable at 60 VUs
        
        { duration: '2m', target: 40 },    // 105-107min: ramp to 40 VUs
        { duration: '13m', target: 40 },   // 107-120min: stable at 40 VUs
        
        { duration: '2m', target: 20 },    // 120-122min: ramp to 20 VUs
        { duration: '13m', target: 20 },   // 122-135min: stable at 20 VUs
        
        // Cooldown
        { duration: '3m', target: 0 },     // 135-138min: cooldown
      ],
      gracefulStop: '30s',
      exec: 'benchmarkTraffic',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<15000'],
    'errors': ['rate<0.4'],
  },
  setupTimeout: '300s',
};

export function benchmarkTraffic(data) {
  if (data && data.tokens && Object.keys(userTokens).length === 0) {
    userTokens = data.tokens;
  }
  
  const vu = __VU;
  const iteration = __ITER;
  const session = getUserSession(vu);
  
  // Deterministic workflow selection based on VU and iteration
  const workflowSelector = seededRandom(vu, iteration);
  
  if (workflowSelector < 0.35) {
    // Workflow 1: Browse and Buy (35%)
    // Frontend -> Product -> Recommender -> Order
    
    for (let i = 0; i < 2; i++) {
      browseProducts(vu, iteration + i);
      sleep(0.2);
    }
    
    getRecommendations(vu, iteration);
    sleep(0.2);
    
    if (session.token && seededRandom(vu, iteration + 10) < 0.7) {
      verifySession(session.token);
      sleep(0.1);
      createOrder(session.token, vu, iteration);
      sleep(0.2);
      
      if (seededRandom(vu, iteration + 11) < 0.5) {
        viewMyOrders(session.token);
      }
    }
    
  } else if (workflowSelector < 0.60) {
    // Workflow 2: Booking Journey (25%)
    // Frontend -> Booking -> Authen
    
    for (let i = 0; i < 3; i++) {
      viewBookings(vu, iteration + i);
      sleep(0.15);
    }
    
    if (session.token && seededRandom(vu, iteration + 20) < 0.8) {
      verifySession(session.token);
      sleep(0.1);
      createBooking(session.token, vu, iteration);
    }
    
  } else if (workflowSelector < 0.80) {
    // Workflow 3: Profile and Orders (20%)
    // Authen -> Profile -> Order
    
    if (session.token) {
      verifySession(session.token);
      sleep(0.1);
      
      if (seededRandom(vu, iteration + 30) < 0.4) {
        manageProfile(session.token, session.userId);
        sleep(0.2);
      }
      
      for (let i = 0; i < 2; i++) {
        viewMyOrders(session.token);
        sleep(0.15);
      }
    }
    
  } else {
    // Workflow 4: Product Discovery (20%)
    // Frontend -> Product -> Recommender
    
    for (let i = 0; i < 3; i++) {
      browseProducts(vu, iteration + i);
      sleep(0.1);
    }
    
    for (let i = 0; i < 2; i++) {
      getRecommendations(vu, iteration + 40 + i);
      sleep(0.15);
    }
  }
  
  // Deterministic think time between workflows (1-3 seconds)
  const thinkTime = 1 + seededRandom(vu, iteration + 100) * 2;
  sleep(thinkTime);
}
