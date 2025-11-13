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

// 11-hour progressive training traffic - Gradual scaling from 1→5 replicas, then down to 2, then back up
// Target: 70% CPU utilization threshold
// Most services: 50m CPU request → need ~35m CPU usage per pod to trigger scale
// Strategy: Controlled, gradual load increase over 1-hour periods
export const options = {
  scenarios: {
    // PHASE 1: Hour 0-1 - Warm-up period (1 replica)
    // Target: Keep at 1 replica with light traffic
    phase1_warmup: {
      executor: 'ramping-vus',
      startTime: '0m',
      stages: [
        { duration: '10m', target: 8 },    // Very light load
        { duration: '50m', target: 12 },   // Stable light load
      ],
      gracefulStop: '30s',
      exec: 'lightMixedTraffic',
    },

    // PHASE 2: Hour 1-2 - Scale to 2 replicas
    // Need to push past 70% CPU on 1 pod → ~40-45m CPU total
    phase2_scale_to_2: {
      executor: 'ramping-vus',
      startTime: '60m',
      stages: [
        { duration: '15m', target: 25 },   // Gradual increase
        { duration: '30m', target: 35 },   // Sustained load for 2 replicas
        { duration: '15m', target: 32 },   // Slight reduction
      ],
      gracefulStop: '30s',
      exec: 'moderateMixedTraffic',
    },

    // PHASE 3: Hour 2-3 - Scale to 3 replicas
    // Need ~105m CPU total (70% of 150m across 3 pods)
    phase3_scale_to_3: {
      executor: 'ramping-vus',
      startTime: '120m',
      stages: [
        { duration: '15m', target: 50 },   // Push past 2 replica capacity
        { duration: '30m', target: 58 },   // Sustained for 3 replicas
        { duration: '15m', target: 55 },   // Hold steady
      ],
      gracefulStop: '30s',
      exec: 'mediumMixedTraffic',
    },

    // PHASE 4: Hour 3-4 - Scale to 4 replicas
    // Need ~140m CPU total (70% of 200m across 4 pods)
    phase4_scale_to_4: {
      executor: 'ramping-vus',
      startTime: '180m',
      stages: [
        { duration: '15m', target: 75 },   // Push past 3 replica capacity
        { duration: '30m', target: 85 },   // Sustained for 4 replicas
        { duration: '15m', target: 82 },   // Hold steady
      ],
      gracefulStop: '30s',
      exec: 'highMixedTraffic',
    },

    // PHASE 5: Hour 4-5 - Scale to 5 replicas (MAX)
    // Need ~175m CPU total (70% of 250m across 5 pods)
    phase5_scale_to_5: {
      executor: 'ramping-vus',
      startTime: '240m',
      stages: [
        { duration: '15m', target: 105 },  // Push to max
        { duration: '30m', target: 115 },  // Peak load
        { duration: '15m', target: 110 },  // Sustained max
      ],
      gracefulStop: '30s',
      exec: 'peakMixedTraffic',
    },

    // PHASE 6: Hour 5-6 - Scale down to 2 replicas
    // Gradually reduce load to trigger scale-down (with 5min stabilization window)
    phase6_scale_down_to_2: {
      executor: 'ramping-vus',
      startTime: '300m',
      stages: [
        { duration: '10m', target: 90 },   // Start reduction
        { duration: '10m', target: 65 },   // Continue down
        { duration: '10m', target: 45 },   // Approach 3 replica level
        { duration: '10m', target: 35 },   // Down to 2 replica level
        { duration: '20m', target: 30 },   // Hold at 2 replicas
      ],
      gracefulStop: '30s',
      exec: 'scalingDownTraffic',
    },

    // PHASE 7: Hour 6-7 - Maintain 2 replicas
    // Steady state at 2 replica level
    phase7_maintain_2: {
      executor: 'ramping-vus',
      startTime: '360m',
      stages: [
        { duration: '30m', target: 32 },   // Stable
        { duration: '30m', target: 28 },   // Slight variation
      ],
      gracefulStop: '30s',
      exec: 'moderateMixedTraffic',
    },

    // PHASE 8: Hour 7-8 - Scale back up to 3 replicas
    phase8_scale_to_3_again: {
      executor: 'ramping-vus',
      startTime: '420m',
      stages: [
        { duration: '20m', target: 50 },   // Ramp up
        { duration: '40m', target: 56 },   // Hold at 3 replicas
      ],
      gracefulStop: '30s',
      exec: 'mediumMixedTraffic',
    },

    // PHASE 9: Hour 8-9 - Scale to 4 replicas again
    phase9_scale_to_4_again: {
      executor: 'ramping-vus',
      startTime: '480m',
      stages: [
        { duration: '20m', target: 78 },   // Push to 4
        { duration: '40m', target: 84 },   // Hold at 4 replicas
      ],
      gracefulStop: '30s',
      exec: 'highMixedTraffic',
    },

    // PHASE 10: Hour 9-10 - Varied load (3-4 replicas oscillation)
    phase10_oscillate_3_4: {
      executor: 'ramping-vus',
      startTime: '540m',
      stages: [
        { duration: '15m', target: 70 },   // Drop to 3
        { duration: '15m', target: 82 },   // Back to 4
        { duration: '15m', target: 65 },   // Down to 3
        { duration: '15m', target: 80 },   // Up to 4
      ],
      gracefulStop: '30s',
      exec: 'oscillatingTraffic',
    },

    // PHASE 11: Hour 10-11 - Cool down to 1 replica
    phase11_cooldown: {
      executor: 'ramping-vus',
      startTime: '600m',
      stages: [
        { duration: '15m', target: 50 },   // Start reduction
        { duration: '15m', target: 30 },   // Down to 2
        { duration: '15m', target: 18 },   // Down to 1
        { duration: '15m', target: 10 },   // Minimal load
      ],
      gracefulStop: '30s',
      exec: 'cooldownTraffic',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<5000'],  // Lenient for training
    'errors': ['rate<0.4'],  // Allow some errors during high load
  },
};

// Light mixed traffic - Baseline load (1 replica)
// Sleep longer between requests to keep CPU low
export function lightMixedTraffic() {
  const endpoints = [
    '/authen/health',
    '/booking/venues',
    '/product/list',
  ];
  
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(`${BASE_URL}${endpoint}`, { headers: commonHeaders });
  
  check(res, {
    'status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  sleep(Math.random() * 3 + 2);  // Long sleep = low RPS
}

// Moderate mixed traffic - 2 replica level
// Balanced mix of services, moderate request rate
export function moderateMixedTraffic() {
  const weights = Math.random();
  let endpoint;
  
  if (weights < 0.4) {
    // 40% booking service
    endpoint = '/booking/venues';
  } else if (weights < 0.65) {
    // 25% product service
    endpoint = '/product/list';
  } else if (weights < 0.85) {
    // 20% authen service
    endpoint = '/authen/health';
  } else {
    // 15% others
    const others = ['/profile/me', '/recommender/suggestions'];
    endpoint = others[Math.floor(Math.random() * others.length)];
  }
  
  const res = http.get(`${BASE_URL}${endpoint}`, { headers: commonHeaders });
  
  check(res, {
    'status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  }) || errorRate.add(1);
  
  sleep(Math.random() * 1.5 + 0.8);  // Moderate sleep
}

// Medium mixed traffic - 3 replica level
// More requests, shorter sleep
export function mediumMixedTraffic() {
  const activities = [
    '/booking/venues',
    '/booking/search',
    '/product/list',
    '/authen/health',
    '/profile/me',
  ];
  
  const endpoint = activities[Math.floor(Math.random() * activities.length)];
  const res = http.get(`${BASE_URL}${endpoint}`, { headers: commonHeaders });
  
  check(res, {
    'status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  }) || errorRate.add(1);
  
  sleep(Math.random() * 1 + 0.5);  // Medium sleep
}

// High mixed traffic - 4 replica level
// Higher request rate across all services
export function highMixedTraffic() {
  const weights = Math.random();
  let endpoint;
  
  if (weights < 0.35) {
    // 35% booking
    const bookingEndpoints = ['/booking/venues', '/booking/search'];
    endpoint = bookingEndpoints[Math.floor(Math.random() * bookingEndpoints.length)];
  } else if (weights < 0.6) {
    // 25% product
    endpoint = '/product/list';
  } else if (weights < 0.8) {
    // 20% authen
    endpoint = '/authen/health';
  } else {
    // 20% profile + recommender
    const others = ['/profile/me', '/recommender/suggestions'];
    endpoint = others[Math.floor(Math.random() * others.length)];
  }
  
  const res = http.get(`${BASE_URL}${endpoint}`, { headers: commonHeaders });
  
  check(res, {
    'status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  }) || errorRate.add(1);
  
  sleep(Math.random() * 0.7 + 0.3);  // Short sleep = higher RPS
}

// Peak mixed traffic - 5 replica level (MAX)
// Maximum load across all services
export function peakMixedTraffic() {
  const allEndpoints = [
    '/booking/venues',
    '/booking/search',
    '/product/list',
    '/authen/health',
    '/profile/me',
    '/recommender/suggestions',
  ];
  
  const endpoint = allEndpoints[Math.floor(Math.random() * allEndpoints.length)];
  const res = http.get(`${BASE_URL}${endpoint}`, { headers: commonHeaders });
  
  check(res, {
    'status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  }) || errorRate.add(1);
  
  sleep(Math.random() * 0.5 + 0.2);  // Very short sleep = peak RPS
}

// Scaling down traffic - Gradual reduction
// Helping scale-down phase with decreasing load
export function scalingDownTraffic() {
  const lightEndpoints = [
    '/authen/health',
    '/booking/venues',
    '/product/list',
  ];
  
  const endpoint = lightEndpoints[Math.floor(Math.random() * lightEndpoints.length)];
  const res = http.get(`${BASE_URL}${endpoint}`, { headers: commonHeaders });
  
  check(res, {
    'status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  sleep(Math.random() * 1.2 + 0.6);  // Increasing sleep for scale-down
}

// Oscillating traffic - Variable load between 3-4 replicas
// Creates varied patterns for ML learning
export function oscillatingTraffic() {
  const weights = Math.random();
  let endpoint;
  let sleepTime;
  
  if (weights < 0.5) {
    // 50% higher load (push to 4 replicas)
    endpoint = '/booking/search';
    sleepTime = Math.random() * 0.6 + 0.3;
  } else {
    // 50% lower load (drop to 3 replicas)
    endpoint = '/authen/health';
    sleepTime = Math.random() * 1.2 + 0.8;
  }
  
  const res = http.get(`${BASE_URL}${endpoint}`, { headers: commonHeaders });
  
  check(res, {
    'status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  sleep(sleepTime);
}

// Cooldown traffic - Gradual reduction to minimum
// Final phase to scale back down to 1 replica
export function cooldownTraffic() {
  const res = http.get(`${BASE_URL}/authen/health`, { headers: commonHeaders });
  
  check(res, {
    'status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  sleep(Math.random() * 4 + 2);  // Long sleep for cooldown
}

