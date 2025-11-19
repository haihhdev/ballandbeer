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
for (let i = 1; i <= 60; i++) {
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
  const usePreAuthenUser = __VU <= 140;
  
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
    } catch (e) {
      // Fallback to dummy IDs
    }
  }
  
  return ['prod1', 'prod2', 'prod3', 'prod4', 'prod5'];
}

function browseProducts() {
  // 30% chance to load full page (initial visit), 70% just API (SPA navigation)
  if (Math.random() < 0.3) {
    const pageRes = http.get(`${BASE_URL}/product`, {
      headers: commonHeaders,
    });
    check(pageRes, { 'browse products page': (r) => r.status === 200 }) || errorRate.add(1);
    sleep(0.1); // Simulate page load time
  }
  
  // Always fetch API data (either from SSR or client-side)
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
        
        // 25% load page (new tab/refresh), 75% SPA navigation (API only)
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
  
  // 35% load page (direct link/refresh), 65% API only (already on site)
  if (Math.random() < 0.35) {
    const pageRes = http.get(`${BASE_URL}/product/${productId}`, {
      headers: commonHeaders,
    });
    check(pageRes, { 'view product page': (r) => r.status === 200 }) || errorRate.add(1);
    sleep(0.1);
  }
  
  // Get product details API
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
  
  // 40% load page (direct access), 60% API only (SPA)
  if (Math.random() < 0.4) {
    const pageRes = http.get(`${BASE_URL}/booking`, {
      headers: commonHeaders,
    });
    check(pageRes, { 'view bookings page': (r) => r.status === 200 }) || errorRate.add(1);
    sleep(0.1);
  }
  
  // Fetch booking data API
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
  
  // 50% load page first (navigating to booking), 50% already on page
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
  
  // Create booking via API
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
  
  // 60% load checkout page (typical flow: cart -> checkout), 40% API only
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
  
  // 35% load page (direct link), 65% API only (SPA navigation)
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
  
  // Fetch orders data API
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
  
  // 45% load profile page (navigation from menu), 55% API only
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
  
  // Get profile data API
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
        const userId = (body && (body.user && (body.user._id || body.user.id))) || body.userId || body.id || body._id || null;
        if (token) {
          tokens[user.email] = { token, userId };
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

// 6-hour realistic user behavior pattern: 2→3→4→3→2 replicas

export const options = {
  scenarios: {
    realistic_user_behavior: {
      executor: 'ramping-vus',
      startTime: '0m',
      stages: [
        // 3 cycles × 120 min = 360 min (6 hours)
        // Each cycle: 2→3→4→3 (30 min per stage)
        
        // Cycle 1: 2→3→4→3 replicas pattern
        { duration: '8m', target: 50 },   // Ramp to 2 replicas (10-40% CPU)
        { duration: '22m', target: 50 },  // Hold at 2 replicas
        { duration: '8m', target: 80 },   // Ramp to 3 replicas (40-70% CPU)
        { duration: '22m', target: 80 },  // Hold at 3 replicas
        { duration: '8m', target: 110 },  // Ramp to 4 replicas (>70% CPU)
        { duration: '22m', target: 110 }, // Hold at 4 replicas
        { duration: '8m', target: 80 },   // Drop to 3 replicas (40-70% CPU)
        { duration: '22m', target: 80 },  // Hold at 3 replicas
        
        // Cycle 2: 2→3→4→3 replicas pattern
        { duration: '8m', target: 50 },
        { duration: '22m', target: 50 },
        { duration: '8m', target: 80 },
        { duration: '22m', target: 80 },
        { duration: '8m', target: 110 },
        { duration: '22m', target: 110 },
        { duration: '8m', target: 80 },
        { duration: '22m', target: 80 },
        
        // Cycle 3: 2→3→4→3 replicas pattern
        { duration: '8m', target: 50 },
        { duration: '22m', target: 50 },
        { duration: '8m', target: 80 },
        { duration: '22m', target: 80 },
        { duration: '8m', target: 110 },
        { duration: '22m', target: 110 },
        { duration: '8m', target: 80 },
        { duration: '22m', target: 80 },
      ],
      gracefulStop: '30s',
      exec: 'realisticUserFlow',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<5000'],
    'errors': ['rate<0.25'],
  },
  setupTimeout: '90s',
};

export function realisticUserFlow(data) {
  if (data && data.tokens && Object.keys(userTokens).length === 0) {
    userTokens = data.tokens;
  }
  
  const currentVUs = __VU;
  let thinkTime;
  
  if (currentVUs <= 50) {
    thinkTime = Math.random() * 0.5 + 0.5;  // 0.5-1s for 2 replicas (10-40% CPU)
  } else if (currentVUs <= 80) {
    thinkTime = Math.random() * 0.4 + 0.3;  // 0.3-0.7s for 3 replicas (40-70% CPU)
  } else {
    thinkTime = Math.random() * 0.3 + 0.2;  // 0.2-0.5s for 4 replicas (>70% CPU)
  }
  
  const userType = Math.random();
  if (userType < 0.2) {
    thinkTime *= 0.7;
  } else if (userType < 0.3) {
    thinkTime *= 1.3;
  }
  
  const action = Math.random();
  
  if (action < 0.40) {
    const guestAction = Math.random();
    if (guestAction < 0.50) {
      browseProducts();
    } else if (guestAction < 0.75) {
      viewProductWithComments();
    } else if (guestAction < 0.90) {
      viewBookings();
    } else {
      getRecommendations();
    }
  } else {
    const session = getUserSession();
    if (session.token) {
      const authAction = Math.random();
      
      // Only verify session 30% of the time to reduce authen load
      if (Math.random() < 0.30) {
        verifySession(session.token);
      }
      
      if (authAction < 0.35) {
        browseProducts();
        
        if (Math.random() < 0.75) {
          createOrder(session.token);
          
          if (Math.random() < 0.3) {
            viewMyOrders(session.token);
          }
        } else {
          viewMyOrders(session.token);
        }
      } else if (authAction < 0.60) {
        viewBookings();
        
        if (Math.random() < 0.65) {
          createBooking(session.token);
        }
      } else if (authAction < 0.72) {
        manageProfile(session.token, session.userId);
        viewProductWithComments();
        
        if (Math.random() < 0.2) {
          postComment(session.token);
        }
      } else if (authAction < 0.97) {
        getRecommendations();
        
        if (Math.random() < 0.4) {
          viewProductWithComments();
        }
      } else {
        viewMyOrders(session.token);
        
        if (Math.random() < 0.5) {
          viewMyOrders(session.token);
        }
      }
    } else {
      browseProducts();
    }
  }
  
  sleep(thinkTime);
}

export function dynamicMixedTraffic(data) {
  realisticUserFlow(data);
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
          manageProfile(session.token, session.userId);
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
          manageProfile(session.token, session.userId);
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
          manageProfile(session.token, session.userId);
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
        manageProfile(session.token, session.userId);
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
          manageProfile(session.token, session.userId);
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

