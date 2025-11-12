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

// Diverse traffic scenarios for better ML training data
export const options = {
  scenarios: {
    // SCENARIO 1: Spike Test - Sudden traffic burst (creates 4-5 replicas)
    flash_sale_spike: {
      executor: 'ramping-vus',
      startTime: '0m',
      stages: [
        { duration: '1m', target: 50 },    // Baseline
        { duration: '2m', target: 400 },   // SPIKE! Force 4-5 replicas
        { duration: '5m', target: 450 },   // Sustained high load
        { duration: '2m', target: 100 },   // Drop fast
        { duration: '3m', target: 20 },    // Back to low
      ],
      gracefulStop: '30s',
      exec: 'flashSaleBooking',
    },

    // SCENARIO 2: Gradual ramp up/down - Creates all replica levels (1-5)
    gradual_increase: {
      executor: 'ramping-vus',
      startTime: '15m',
      stages: [
        { duration: '5m', target: 30 },    // 1 replica
        { duration: '5m', target: 80 },    // 2 replicas
        { duration: '5m', target: 150 },   // 3 replicas
        { duration: '5m', target: 250 },   // 4 replicas
        { duration: '5m', target: 350 },   // 5 replicas
        { duration: '5m', target: 250 },   // Down to 4
        { duration: '5m', target: 150 },   // Down to 3
        { duration: '5m', target: 80 },    // Down to 2
        { duration: '5m', target: 30 },    // Down to 1
      ],
      gracefulStop: '30s',
      exec: 'mixedActivity',
    },

    // SCENARIO 3: Oscillating load - Rapid up/down (many scaling events)
    oscillating_pattern: {
      executor: 'ramping-vus',
      startTime: '60m',
      stages: [
        { duration: '3m', target: 200 },   // Up
        { duration: '3m', target: 50 },    // Down
        { duration: '3m', target: 250 },   // Up higher
        { duration: '3m', target: 40 },    // Down lower
        { duration: '3m', target: 180 },   // Up medium
        { duration: '3m', target: 60 },    // Down medium
        { duration: '3m', target: 300 },   // Up high
        { duration: '3m', target: 30 },    // Down low
      ],
      gracefulStop: '30s',
      exec: 'oscillatingLoad',
    },

    // SCENARIO 4: Service-specific: Booking heavy (product service stress)
    booking_stress_product: {
      executor: 'constant-vus',
      startTime: '90m',
      vus: 150,
      duration: '20m',
      exec: 'bookingHeavy',
    },

    // SCENARIO 5: Service-specific: Browsing heavy (frontend stress)
    browsing_stress_frontend: {
      executor: 'ramping-vus',
      startTime: '115m',
      stages: [
        { duration: '5m', target: 200 },
        { duration: '15m', target: 300 },
        { duration: '5m', target: 100 },
      ],
      gracefulStop: '30s',
      exec: 'browsingHeavy',
    },

    // SCENARIO 6: Recommendation heavy (recommender service stress)
    recommendation_burst: {
      executor: 'ramping-arrival-rate',
      startTime: '145m',
      stages: [
        { duration: '3m', target: 100 },   // req/s
        { duration: '5m', target: 300 },   // High req/s
        { duration: '3m', target: 50 },
      ],
      preAllocatedVUs: 200,
      maxVUs: 400,
      exec: 'recommendationLoad',
    },

    // SCENARIO 7: Profile updates (profile service - usually low)
    profile_activity: {
      executor: 'constant-vus',
      startTime: '160m',
      vus: 40,
      duration: '15m',
      exec: 'profileUpdates',
    },

    // SCENARIO 8: Authentication stress (authen service)
    auth_burst: {
      executor: 'ramping-vus',
      startTime: '180m',
      stages: [
        { duration: '2m', target: 150 },
        { duration: '8m', target: 250 },
        { duration: '2m', target: 50 },
      ],
      gracefulStop: '30s',
      exec: 'authenticationLoad',
    },

    // SCENARIO 9: Mixed realistic - Evening peak simulation
    evening_peak_realistic: {
      executor: 'ramping-vus',
      startTime: '195m',
      stages: [
        { duration: '10m', target: 180 },
        { duration: '20m', target: 350 },
        { duration: '15m', target: 400 },  // Peak
        { duration: '20m', target: 280 },
        { duration: '10m', target: 150 },
      ],
      gracefulStop: '30s',
      exec: 'eveningPeakMix',
    },

    // SCENARIO 10: Stress test - Push to limits
    stress_test_max: {
      executor: 'ramping-vus',
      startTime: '270m',
      stages: [
        { duration: '5m', target: 300 },
        { duration: '10m', target: 500 },  // Max stress
        { duration: '5m', target: 300 },
        { duration: '3m', target: 100 },
      ],
      gracefulStop: '30s',
      exec: 'stressTestMax',
    },

    // SCENARIO 11: Idle period - Create low replica data
    idle_period: {
      executor: 'constant-vus',
      startTime: '295m',
      vus: 15,
      duration: '10m',
      exec: 'idleActivity',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<3000'],
    'errors': ['rate<0.3'],  // More lenient for stress tests
  },
};

// Flash sale - Heavy booking load
export function flashSaleBooking() {
  const endpoints = [
    '/booking/venues',
    '/booking/search',
    '/product/list',
  ];
  
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(`${BASE_URL}${endpoint}`, { headers: commonHeaders });
  
  check(res, {
    'status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  sleep(Math.random() * 0.5 + 0.2);
}

// Mixed activity - All services
export function mixedActivity() {
  const activities = [
    () => http.get(`${BASE_URL}/authen/health`, { headers: commonHeaders }),
    () => http.get(`${BASE_URL}/booking/venues`, { headers: commonHeaders }),
    () => http.get(`${BASE_URL}/product/list`, { headers: commonHeaders }),
    () => http.get(`${BASE_URL}/profile/me`, { headers: commonHeaders }),
    () => http.get(`${BASE_URL}/recommender/suggestions`, { headers: commonHeaders }),
  ];
  
  const activity = activities[Math.floor(Math.random() * activities.length)];
  const res = activity();
  
  check(res, {
    'status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  }) || errorRate.add(1);
  
  sleep(Math.random() * 1 + 0.5);
}

// Oscillating load
export function oscillatingLoad() {
  const res = http.get(`${BASE_URL}/booking/search`, { headers: commonHeaders });
  
  check(res, {
    'status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  sleep(Math.random() * 0.3 + 0.1);
}

// Booking heavy - Product service stress
export function bookingHeavy() {
  const actions = [
    '/booking/venues',
    '/booking/search',
    '/booking/availability',
    '/product/list',
    '/product/details',
  ];
  
  const action = actions[Math.floor(Math.random() * actions.length)];
  const res = http.get(`${BASE_URL}${action}`, { headers: commonHeaders });
  
  check(res, {
    'status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  sleep(Math.random() * 0.8 + 0.3);
}

// Browsing heavy - Frontend stress
export function browsingHeavy() {
  const pages = [
    '/',
    '/about',
    '/venues',
    '/products',
    '/contact',
  ];
  
  const page = pages[Math.floor(Math.random() * pages.length)];
  const res = http.get(`${BASE_URL}${page}`, { headers: commonHeaders });
  
  check(res, {
    'status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  sleep(Math.random() * 1.2 + 0.5);
}

// Recommendation load - Recommender service
export function recommendationLoad() {
  const res = http.get(`${BASE_URL}/recommender/suggestions`, { headers: commonHeaders });
  
  check(res, {
    'status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  }) || errorRate.add(1);
  
  sleep(Math.random() * 0.4 + 0.1);
}

// Profile updates - Profile service
export function profileUpdates() {
  const actions = [
    '/profile/me',
    '/profile/update',
    '/profile/history',
  ];
  
  const action = actions[Math.floor(Math.random() * actions.length)];
  const res = http.get(`${BASE_URL}${action}`, { headers: commonHeaders });
  
  check(res, {
    'status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  }) || errorRate.add(1);
  
  sleep(Math.random() * 1.5 + 0.8);
}

// Authentication load - Authen service
export function authenticationLoad() {
  const endpoints = [
    '/authen/health',
    '/authen/login',
    '/authen/register',
  ];
  
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(`${BASE_URL}${endpoint}`, { headers: commonHeaders });
  
  check(res, {
    'status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  }) || errorRate.add(1);
  
  sleep(Math.random() * 0.6 + 0.2);
}

// Evening peak realistic - Mixed load
export function eveningPeakMix() {
  const weights = Math.random();
  let endpoint;
  
  if (weights < 0.4) {
    // 40% booking
    endpoint = '/booking/venues';
  } else if (weights < 0.7) {
    // 30% browsing
    endpoint = '/';
  } else if (weights < 0.85) {
    // 15% product
    endpoint = '/product/list';
  } else {
    // 15% others
    const others = ['/recommender/suggestions', '/profile/me', '/authen/health'];
    endpoint = others[Math.floor(Math.random() * others.length)];
  }
  
  const res = http.get(`${BASE_URL}${endpoint}`, { headers: commonHeaders });
  
  check(res, {
    'status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  }) || errorRate.add(1);
  
  sleep(Math.random() * 0.7 + 0.3);
}

// Stress test max - All services under stress
export function stressTestMax() {
  const allEndpoints = [
    '/authen/health',
    '/booking/venues',
    '/booking/search',
    '/product/list',
    '/product/details',
    '/profile/me',
    '/recommender/suggestions',
    '/',
  ];
  
  const endpoint = allEndpoints[Math.floor(Math.random() * allEndpoints.length)];
  const res = http.get(`${BASE_URL}${endpoint}`, { headers: commonHeaders });
  
  check(res, {
    'status is 200 or 401 or 503': (r) => [200, 401, 503].includes(r.status),
  }) || errorRate.add(1);
  
  sleep(Math.random() * 0.3 + 0.1);
}

// Idle activity - Low load
export function idleActivity() {
  const res = http.get(`${BASE_URL}/authen/health`, { headers: commonHeaders });
  
  check(res, {
    'status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  sleep(Math.random() * 3 + 2);
}

