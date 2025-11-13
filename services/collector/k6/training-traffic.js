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

// Generate 100 test users for realistic concurrent load
// Each VU will pick a random user to avoid token collision
const TEST_USERS = [];
for (let i = 1; i <= 100; i++) {
  TEST_USERS.push({
    email: `k6user${i}@test.local`,
    password: 'K6Test2024!',
    name: `K6 Test User ${i}`,
  });
}

// Shared state for tokens and product IDs
let productIds = [];
const userTokens = new Map(); // Cache tokens per user email

// Helper functions
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Get or create user session (cached to reduce auth service load)
function getUserSession() {
  const userIndex = randomInt(0, TEST_USERS.length - 1);
  const user = TEST_USERS[userIndex];
  
  // Check cache first
  if (userTokens.has(user.email)) {
    return { user, token: userTokens.get(user.email) };
  }
  
  // Try login first
  let res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password,
  }), {
    headers: { ...commonHeaders, 'Content-Type': 'application/json' },
  });
  
  // If login fails (user doesn't exist), register first
  if (res.status !== 200) {
    res = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
      email: user.email,
      password: user.password,
      fullName: user.name,
    }), {
      headers: { ...commonHeaders, 'Content-Type': 'application/json' },
    });
    
    // Now login
    if (res.status === 200 || res.status === 201) {
      sleep(0.1); // Brief pause before login
      res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
        email: user.email,
        password: user.password,
      }), {
        headers: { ...commonHeaders, 'Content-Type': 'application/json' },
      });
    }
  }
  
  let token = null;
  if (res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      token = body.token || body.accessToken;
      if (token) {
        userTokens.set(user.email, token); // Cache it
      }
    } catch (e) {
      // Invalid response
    }
  }
  
  return { user, token };
}

// Fetch available products (cache globally)
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

// === REALISTIC USER ACTIONS ===

// Browse products (Guest or Authenticated)
function browseProducts() {
  const res = http.get(`${BASE_URL}/api/products`, {
    headers: commonHeaders,
  });
  
  check(res, { 'browse products': (r) => r.status === 200 }) || errorRate.add(1);
  
  // Sometimes view product details
  if (res.status === 200 && Math.random() > 0.5) {
    try {
      const products = JSON.parse(res.body);
      if (Array.isArray(products) && products.length > 0) {
        const product = randomItem(products);
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

// View product with comments (triggers product service)
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
  
  sleep(0.1);
  
  // Get comments
  const commentsRes = http.get(`${BASE_URL}/api/products/${productId}/comments`, {
    headers: commonHeaders,
  });
  check(commentsRes, { 'view comments': (r) => r.status === 200 });
}

// Get recommendations (triggers recommender service)
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

// Browse bookings (Guest view)
function viewBookings() {
  const fieldId = randomInt(1, 5);
  const date = '2025-11-15'; // Fixed date for testing
  
  const res = http.get(`${BASE_URL}/api/bookings/${fieldId}/${date}`, {
    headers: commonHeaders,
  });
  
  check(res, { 'view bookings': (r) => r.status === 200 }) || errorRate.add(1);
}

// Create booking (Authenticated - triggers booking service)
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

// Create order (Authenticated - triggers order service)
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

// View my orders (Authenticated - triggers order service)
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

// View/Update profile (Authenticated - triggers profile service)
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
  
  // Sometimes update profile
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

// Post comment (Authenticated - triggers product service)
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

// Training Traffic: 10-hour gradual scaling (1→2→3→4→5→2→3→4→3→1 replicas)
// Purpose: Generate balanced ML training data with gradual CPU-based scaling
// Memory: 128Mi-1Gi requests (stable, won't trigger 70% threshold)
// CPU: 50-100m requests (65% threshold = primary scaling trigger)
// Pattern: Single scenario with progressive stages to avoid VU stacking
export const options = {
  scenarios: {
    progressive_training: {
      executor: 'ramping-vus',
      startTime: '0m',
      stages: [
        // PHASE 1: Hour 0-1 - Scale from 1 to 2 replicas
        { duration: '15m', target: 40 },   // Gentle ramp from 1 replica
        { duration: '30m', target: 60 },   // Sustain 2 replicas
        { duration: '15m', target: 55 },   // Hold
        
        // PHASE 2: Hour 1-2 - Scale to 3 replicas
        { duration: '15m', target: 80 },   // Increase load
        { duration: '30m', target: 100 },  // Sustain 3 replicas
        { duration: '15m', target: 95 },   // Hold
        
        // PHASE 3: Hour 2-3 - Scale to 4 replicas
        { duration: '15m', target: 130 },  // Push higher
        { duration: '30m', target: 150 },  // Sustain 4 replicas
        { duration: '15m', target: 145 },  // Hold
        
        // PHASE 4: Hour 3-4 - Scale to 5 replicas (MAX)
        { duration: '15m', target: 180 },  // Peak load
        { duration: '30m', target: 220 },  // Sustain 5 replicas
        { duration: '15m', target: 210 },  // Hold max
        
        // PHASE 5: Hour 4-5 - Scale down to 2 replicas
        { duration: '10m', target: 170 },  // Start reduction
        { duration: '10m', target: 110 },  // Continue down
        { duration: '10m', target: 80 },   // Approach 3 replica level
        { duration: '10m', target: 60 },   // Down to 2 replica level
        { duration: '20m', target: 55 },   // Hold at 2 replicas
        
        // PHASE 6: Hour 5-6 - Maintain 2 replicas
        { duration: '30m', target: 65 },   // Stable
        { duration: '30m', target: 58 },   // Slight variation
        
        // PHASE 7: Hour 6-7 - Scale back up to 3 replicas
        { duration: '20m', target: 85 },   // Ramp up
        { duration: '40m', target: 100 },  // Hold at 3 replicas
        
        // PHASE 8: Hour 7-8 - Scale to 4 replicas again
        { duration: '20m', target: 135 },  // Push to 4
        { duration: '40m', target: 150 },  // Hold at 4 replicas
        
        // PHASE 9: Hour 8-9 - Oscillate between 3-4 replicas
        { duration: '15m', target: 95 },   // Drop to 3
        { duration: '15m', target: 145 },  // Back to 4
        { duration: '15m', target: 90 },   // Down to 3
        { duration: '15m', target: 140 },  // Up to 4
        
        // PHASE 10: Hour 9-10 - Cool down to 1 replica
        { duration: '15m', target: 85 },   // Start reduction
        { duration: '15m', target: 55 },   // Down to 2
        { duration: '15m', target: 30 },   // Down to 1
        { duration: '15m', target: 10 },   // Minimal load
      ],
      gracefulStop: '30s',
      exec: 'dynamicMixedTraffic',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<8000'],  // Very lenient for aggressive training
    'errors': ['rate<0.5'],  // Allow more errors during high load
  },
};

// === TRAFFIC PATTERNS WITH REALISTIC USER FLOWS ===

// Dynamic mixed traffic - Single function adapts to VU count (replaces all phase functions)
// Low load (< 100 VUs): 75% guest browsing, 25% authenticated
// Medium load (100-150 VUs): 65% guest browsing, 35% authenticated
// High load (150-200 VUs): 55% guest browsing, 45% authenticated
// Peak load (200+ VUs): 45% guest browsing, 55% authenticated
export function dynamicMixedTraffic() {
  const currentVUs = __VU;
  let authRatio, sleepTime;
  
  // Determine traffic mix and sleep based on current VU count
  if (currentVUs < 70) {
    authRatio = 0.25;  // 25% authenticated (2 replicas)
    sleepTime = Math.random() * 0.5 + 0.2;  // 0.2-0.7s
  } else if (currentVUs < 110) {
    authRatio = 0.35;  // 35% authenticated (3 replicas)
    sleepTime = Math.random() * 0.3 + 0.15;  // 0.15-0.45s
  } else if (currentVUs < 160) {
    authRatio = 0.45;  // 45% authenticated (4 replicas)
    sleepTime = Math.random() * 0.2 + 0.1;  // 0.1-0.3s
  } else {
    authRatio = 0.55;  // 55% authenticated (5 replicas)
    sleepTime = Math.random() * 0.15 + 0.05;  // 0.05-0.2s
  }
  
  const action = Math.random();
  const guestRatio = 1 - authRatio;
  
  if (action < guestRatio) {
    // Guest browsing actions
    const guestAction = Math.random();
    if (guestAction < 0.5) {
      browseProducts();
    } else if (guestAction < 0.75) {
      viewBookings();
    } else if (guestAction < 0.9) {
      viewProductWithComments();
    } else {
      getRecommendations();
    }
  } else {
    // Authenticated actions
    const session = getUserSession();
    if (session.token) {
      const authAction = Math.random();
      if (authAction < 0.35) {
        viewMyOrders(session.token);
      } else if (authAction < 0.6) {
        createBooking(session.token);
      } else if (authAction < 0.8) {
        createOrder(session.token);
      } else if (authAction < 0.95) {
        manageProfile(session.token, session.user.email);
      } else {
        postComment(session.token);
      }
    } else {
      browseProducts(); // Fallback to guest
    }
  }
  
  sleep(sleepTime);
}

// Keep old functions for backwards compatibility (just delegate to dynamic)
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
  
  sleep(Math.random() * 0.3 + 0.1);  // Very short: 0.1-0.4s
}

// Medium mixed traffic - 3 replica level - BALANCED
// 65% guest, 35% authenticated - balanced load
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
  
  sleep(Math.random() * 0.2 + 0.1);  // Very short: 0.1-0.3s
}

// High mixed traffic - 4 replica level - BALANCED
// 55% guest, 45% authenticated - moderate backend load
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
  
  sleep(Math.random() * 0.15 + 0.05);  // Minimal: 0.05-0.2s
}

// Peak mixed traffic - 5 replica level (MAX) - BALANCED HIGH LOAD
// 45% guest, 55% authenticated - balanced high load
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
  
  sleep(Math.random() * 0.1 + 0.02);  // Ultra short: 0.02-0.12s
}

// Scaling down traffic - Gradual reduction
// More guest browsing, less authenticated actions
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
  
  sleep(Math.random() * 1.2 + 0.6);  // Increasing sleep for scale-down
}

// Oscillating traffic - Variable load between 3-4 replicas
// Creates varied patterns for ML learning
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

// Cooldown traffic - Gradual reduction to minimum
// Final phase to scale back down to 1 replica - mostly guest browsing
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
  
  sleep(Math.random() * 4 + 2);  // Long sleep for cooldown
}

