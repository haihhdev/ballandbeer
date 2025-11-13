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
for (let i = 1; i <= 80; i++) {
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
  const userIndex = (__VU - 1) % TEST_USERS.length;
  const user = TEST_USERS[userIndex];
  
  return { 
    user, 
    token: userTokens[user.email] || null,
    userId: user.email.replace('@test.local', '').replace('k6user', 'user'),
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
    } catch (e) {
      // Fallback to dummy IDs
    }
  }
  
  return ['prod1', 'prod2', 'prod3', 'prod4', 'prod5'];
}

function browseProducts() {
  const res = http.get(`${BASE_URL}/api/products`, {
    headers: commonHeaders,
  });
  
  check(res, { 'browse products': (r) => r.status === 200 }) || errorRate.add(1);
  
  if (res.status === 200 && Math.random() < 0.2) {
    try {
      const products = JSON.parse(res.body);
      if (Array.isArray(products) && products.length > 0) {
        const product = randomItem(products);
        const productId = product._id || product.id;
        
        sleep(0.2);
        const detailRes = http.get(`${BASE_URL}/api/products/${productId}`, {
          headers: commonHeaders,
        });
        check(detailRes, { 'view product detail': (r) => r.status === 200 });
      }
    } catch (e) {}
  }
}

function viewProductWithComments() {
  if (productIds.length === 0) {
    productIds = fetchProducts();
  }
  
  const productId = randomItem(productIds);
  
  // Get product details
  const res = http.get(`${BASE_URL}/api/products/${productId}`, {
    headers: commonHeaders,
  });
  check(res, { 'view product': (r) => r.status === 200 }) || errorRate.add(1);
  
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
  
  const res = http.get(`${BASE_URL}/api/bookings/${fieldId}/${date}`, {
    headers: commonHeaders,
  });
  
  check(res, { 'view bookings': (r) => r.status === 200 }) || errorRate.add(1);
}

function createBooking(token) {
  if (!token) return;
  
  const fieldId = randomInt(1, 5);
  const date = '2025-11-15';
  const startTime = randomInt(8, 20);
  
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
  
  // Get profile
  const res = http.get(`${BASE_URL}/api/profile/id/${userId}`, {
    headers: {
      ...commonHeaders,
      'Authorization': `Bearer ${token}`,
    },
  });
  
  check(res, { 'view profile': (r) => r.status === 200 }) || errorRate.add(1);
  
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
  console.log('🔧 Setup: Pre-authenticating all test users...');
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
        if (token) {
          tokens[user.email] = token;
          console.log(`✓ User ${i + 1}/${TEST_USERS.length} authenticated`);
        }
      } catch (e) {
        console.log(`✗ User ${i + 1} auth failed`);
      }
    }
    
    sleep(0.1);
  }
  
  console.log(`✓ Setup complete: ${Object.keys(tokens).length}/${TEST_USERS.length} users authenticated`);
  return { tokens };
}

// 7-hour training pattern: 1→2→3→4→5→4→3→2→3→4→5→3→2→1
// Optimized for t3.medium with HPA @ CPU 65%, Memory 70%
// Target: 600-1000 req/s at peak for balanced service scaling
export const options = {
  scenarios: {
    progressive_training: {
      executor: 'ramping-vus',
      startTime: '0m',
      stages: [
        // Phase 1: Ramp up 1→5 replicas (0-2.5h)
        { duration: '15m', target: 12 },
        { duration: '10m', target: 18 },
        { duration: '12m', target: 45 },
        { duration: '10m', target: 52 },
        { duration: '8m', target: 42 },
        { duration: '12m', target: 75 },
        { duration: '15m', target: 85 },
        { duration: '8m', target: 78 },
        { duration: '12m', target: 125 },
        { duration: '15m', target: 135 },
        { duration: '8m', target: 128 },
        { duration: '10m', target: 180 },
        { duration: '15m', target: 195 },
        
        // Phase 2: Scale down 4→2 replicas (2.5h-4h)
        { duration: '12m', target: 130 },
        { duration: '10m', target: 122 },
        { duration: '8m', target: 135 },
        { duration: '12m', target: 80 },
        { duration: '15m', target: 88 },
        { duration: '8m', target: 76 },
        { duration: '12m', target: 48 },
        { duration: '13m', target: 55 },
        
        // Phase 3: Second peak 3→5 replicas (4h-6h)
        { duration: '12m', target: 82 },
        { duration: '10m', target: 90 },
        { duration: '8m', target: 85 },
        { duration: '12m', target: 128 },
        { duration: '15m', target: 142 },
        { duration: '8m', target: 132 },
        { duration: '12m', target: 188 },
        { duration: '15m', target: 205 },
        { duration: '8m', target: 192 },
        
        // Phase 4: Cool down 3→1 replica (6h-7h)
        { duration: '15m', target: 85 },
        { duration: '15m', target: 78 },
        { duration: '15m', target: 50 },
        { duration: '15m', target: 42 },
        { duration: '10m', target: 22 },
        { duration: '10m', target: 10 },
      ],
      gracefulStop: '30s',
      exec: 'dynamicMixedTraffic',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<10000'],
    'errors': ['rate<0.4'],
  },
};

export function dynamicMixedTraffic(data) {
  if (data && data.tokens && Object.keys(userTokens).length === 0) {
    userTokens = data.tokens;
  }
  
  const currentVUs = __VU;
  let sleepTime;
  
  // Adaptive sleep: lower sleep = higher request rate = more CPU
  if (currentVUs <= 25) {
    sleepTime = Math.random() * 0.8 + 0.6;
  } else if (currentVUs <= 60) {
    sleepTime = Math.random() * 0.5 + 0.3;
  } else if (currentVUs <= 100) {
    sleepTime = Math.random() * 0.35 + 0.2;
  } else if (currentVUs <= 150) {
    sleepTime = Math.random() * 0.25 + 0.12;
  } else {
    sleepTime = Math.random() * 0.18 + 0.08;
  }
  
  // Random traffic variations
  if (Math.random() < 0.1) {
    sleepTime *= 0.7;
  } else if (Math.random() < 0.05) {
    sleepTime *= 1.5;
  }
  
  const action = Math.random();
  
  // 35% guest, 65% authenticated (realistic distribution)
  if (action < 0.35) {
    const guestAction = Math.random();
    if (guestAction < 0.45) {
      browseProducts();
    } else if (guestAction < 0.80) {
      viewBookings();
    } else if (guestAction < 0.95) {
      getRecommendations();
    } else {
      viewProductWithComments();
    }
  } else {
    const session = getUserSession();
    if (session.token) {
      const authAction = Math.random();
      
      if (authAction < 0.22) {
        if (Math.random() < 0.65) {
          createOrder(session.token);
        } else {
          viewMyOrders(session.token);
        }
      } else if (authAction < 0.44) {
        if (Math.random() < 0.7) {
          createBooking(session.token);
        } else {
          viewBookings();
        }
      } else if (authAction < 0.66) {
        manageProfile(session.token, session.userId);
      } else if (authAction < 0.84) {
        getRecommendations();
      } else if (authAction < 0.90) {
        if (Math.random() < 0.4) {
          postComment(session.token);
        } else {
          viewMyOrders(session.token);
        }
      } else if (authAction < 0.96) {
        verifySession(session.token);
        sleep(0.1);
        if (Math.random() < 0.5) {
          viewMyOrders(session.token);
        } else {
          viewBookings();
        }
      } else {
        viewMyOrders(session.token);
      }
    } else {
      viewBookings();
    }
  }
  
  sleep(sleepTime);
}

export function moderateMixedTraffic() {
  const action = Math.random();
  
  if (action < 0.35) {
    // 35% browse products (guest)
    browseProducts();
  } else if (action < 0.55) {
    // 20% view bookings (guest)
    viewBookings();
  } else if (action < 0.7) {
    // 15% view product with comments (guest)
    viewProductWithComments();
  } else if (action < 0.75) {
    // 5% get recommendations (guest)
    getRecommendations();
  } else {
    // 25% authenticated actions
    const session = getUserSession();
    if (session.token) {
      const authAction = Math.random();
      if (authAction < 0.5) {
        viewMyOrders(session.token);
      } else if (authAction < 0.8) {
        createBooking(session.token);
      } else {
        createOrder(session.token);
      }
    } else {
      browseProducts(); // Fallback to guest
    }
  }
  
  sleep(Math.random() * 0.3 + 0.1);
}

export function mediumMixedTraffic() {
  const action = Math.random();
  
  if (action < 0.3) {
    // 30% browse products
    browseProducts();
  } else if (action < 0.5) {
    // 20% view product with comments
    viewProductWithComments();
  } else if (action < 0.6) {
    // 10% view bookings
    viewBookings();
  } else if (action < 0.65) {
    // 5% recommendations
    getRecommendations();
  } else {
    // 35% authenticated actions
    const session = getUserSession();
    if (session.token) {
      const authAction = Math.random();
      if (authAction < 0.4) {
        viewMyOrders(session.token);
      } else if (authAction < 0.65) {
        createBooking(session.token);
      } else if (authAction < 0.85) {
        createOrder(session.token);
      } else {
        manageProfile(session.token, session.user.email);
      }
    } else {
      viewBookings(); // Fallback
    }
  }
  
  sleep(Math.random() * 0.2 + 0.1);
}

export function highMixedTraffic() {
  const action = Math.random();
  
  if (action < 0.25) {
    // 25% browse products
    browseProducts();
  } else if (action < 0.4) {
    // 15% view product with comments
    viewProductWithComments();
  } else if (action < 0.5) {
    // 10% view bookings
    viewBookings();
  } else if (action < 0.55) {
    // 5% recommendations
    getRecommendations();
  } else {
    // 45% authenticated - moderate backend usage
    const session = getUserSession();
    if (session.token) {
      const authAction = Math.random();
      if (authAction < 0.35) {
        viewMyOrders(session.token);
      } else if (authAction < 0.6) {
        createBooking(session.token);
      } else if (authAction < 0.8) {
        createOrder(session.token);
      } else {
        manageProfile(session.token, session.user.email);
      }
    } else {
      browseProducts(); // Fallback
    }
  }
  
  sleep(Math.random() * 0.15 + 0.05);
}

export function peakMixedTraffic() {
  const action = Math.random();
  
  if (action < 0.2) {
    // 20% browse products
    browseProducts();
  } else if (action < 0.35) {
    // 15% view product with comments
    viewProductWithComments();
  } else if (action < 0.43) {
    // 8% view bookings
    viewBookings();
  } else if (action < 0.45) {
    // 2% recommendations
    getRecommendations();
  } else {
    // 55% authenticated - balanced high load
    const session = getUserSession();
    if (session.token) {
      const authAction = Math.random();
      if (authAction < 0.3) {
        viewMyOrders(session.token);
      } else if (authAction < 0.55) {
        createBooking(session.token);
      } else if (authAction < 0.75) {
        createOrder(session.token);
      } else if (authAction < 0.9) {
        manageProfile(session.token, session.user.email);
      } else {
        postComment(session.token);
      }
    } else {
      viewProductWithComments(); // Fallback
    }
  }
  
  sleep(Math.random() * 0.1 + 0.02);
}

export function scalingDownTraffic() {
  const action = Math.random();
  
  if (action < 0.5) {
    // 50% browse products
    browseProducts();
  } else if (action < 0.75) {
    // 25% view bookings
    viewBookings();
  } else {
    // 25% light authenticated
    const session = getUserSession();
    if (session.token) {
      if (Math.random() < 0.5) {
        viewMyOrders(session.token);
      } else {
        viewBookings();
      }
    } else {
      viewProductWithComments();
    }
  }
  
  sleep(Math.random() * 1.2 + 0.6);
}

export function oscillatingTraffic() {
  const action = Math.random();
  let sleepTime;
  
  if (action < 0.5) {
    // 50% higher load (push to 4 replicas) - more authenticated
    const session = getUserSession();
    if (session.token) {
      const authAction = Math.random();
      if (authAction < 0.4) {
        createOrder(session.token);
      } else if (authAction < 0.7) {
        createBooking(session.token);
      } else {
        manageProfile(session.token, session.user.email);
      }
    } else {
      browseProducts();
    }
    sleepTime = Math.random() * 0.6 + 0.3;
  } else {
    // 50% lower load (drop to 3 replicas) - more guest
    if (Math.random() < 0.6) {
      browseProducts();
    } else {
      viewBookings();
    }
    sleepTime = Math.random() * 1.2 + 0.8;
  }
  
  sleep(sleepTime);
}

export function cooldownTraffic() {
  const action = Math.random();
  
  if (action < 0.7) {
    // 70% light guest browsing
    browseProducts();
  } else if (action < 0.9) {
    // 20% view bookings
    viewBookings();
  } else {
    // 10% minimal authenticated
    const session = getUserSession();
    if (session.token) {
      viewMyOrders(session.token);
    } else {
      viewProductWithComments();
    }
  }
  
  sleep(Math.random() * 4 + 2);
}

