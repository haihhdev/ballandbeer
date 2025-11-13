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

// Training Traffic: 10-hour aggressive scaling (SKIP warmup, start at 2→5→2→4→1 replicas)
// Purpose: Generate balanced ML training data with aggressive CPU-based scaling
// Memory: 128Mi-1Gi requests (stable, won't trigger 75% threshold)
// CPU: 50-100m requests (70% threshold = primary scaling trigger)
// Pattern: Start hot, aggressive VUs to force scaling immediately
export const options = {
  scenarios: {
    // PHASE 1: Hour 0-1 - Scale to 2 replicas (SKIP warmup, start hot)
    // Target: Immediately push past 70% CPU → ~40m CPU for 50m request services
    phase1_scale_to_2: {
      executor: 'ramping-vus',
      startTime: '0m',
      stages: [
        { duration: '10m', target: 100 },  // Start hot!
        { duration: '35m', target: 120 },  // Sustained for 2 replicas
        { duration: '15m', target: 110 },  // Hold
      ],
      gracefulStop: '30s',
      exec: 'moderateMixedTraffic',
    },

    // PHASE 2: Hour 1-2 - Scale to 3 replicas
    // Need ~105m CPU total (70% of 150m across 3 pods)
    phase2_scale_to_3: {
      executor: 'ramping-vus',
      startTime: '60m',
      stages: [
        { duration: '15m', target: 150 },  // Aggressive ramp
        { duration: '30m', target: 180 },  // Sustained for 3 replicas
        { duration: '15m', target: 170 },  // Hold
      ],
      gracefulStop: '30s',
      exec: 'mediumMixedTraffic',
    },

    // PHASE 3: Hour 2-3 - Scale to 4 replicas
    // Need ~140m CPU total (70% of 200m across 4 pods)
    phase3_scale_to_4: {
      executor: 'ramping-vus',
      startTime: '120m',
      stages: [
        { duration: '15m', target: 220 },  // Very high load
        { duration: '30m', target: 250 },  // Sustained for 4 replicas
        { duration: '15m', target: 240 },  // Hold
      ],
      gracefulStop: '30s',
      exec: 'highMixedTraffic',
    },

    // PHASE 4: Hour 3-4 - Scale to 5 replicas (MAX)
    // Need ~175m CPU total (70% of 250m across 5 pods)
    phase4_scale_to_5: {
      executor: 'ramping-vus',
      startTime: '180m',
      stages: [
        { duration: '15m', target: 300 },  // Maximum load
        { duration: '30m', target: 350 },  // Peak sustained
        { duration: '15m', target: 330 },  // Hold max
      ],
      gracefulStop: '30s',
      exec: 'peakMixedTraffic',
    },

    // PHASE 5: Hour 4-5 - Scale down to 2 replicas
    // Gradually reduce load to trigger scale-down (with 5min stabilization window)
    phase5_scale_down_to_2: {
      executor: 'ramping-vus',
      startTime: '240m',
      stages: [
        { duration: '10m', target: 250 },  // Start reduction
        { duration: '10m', target: 180 },  // Continue down
        { duration: '10m', target: 140 },  // Approach 3 replica level
        { duration: '10m', target: 110 },  // Down to 2 replica level
        { duration: '20m', target: 100 },  // Hold at 2 replicas
      ],
      gracefulStop: '30s',
      exec: 'scalingDownTraffic',
    },

    // PHASE 6: Hour 5-6 - Maintain 2 replicas
    // Steady state at 2 replica level
    phase6_maintain_2: {
      executor: 'ramping-vus',
      startTime: '300m',
      stages: [
        { duration: '30m', target: 115 },  // Stable
        { duration: '30m', target: 105 },  // Slight variation
      ],
      gracefulStop: '30s',
      exec: 'moderateMixedTraffic',
    },

    // PHASE 7: Hour 6-7 - Scale back up to 3 replicas
    phase7_scale_to_3_again: {
      executor: 'ramping-vus',
      startTime: '360m',
      stages: [
        { duration: '20m', target: 160 },  // Ramp up
        { duration: '40m', target: 180 },  // Hold at 3 replicas
      ],
      gracefulStop: '30s',
      exec: 'mediumMixedTraffic',
    },

    // PHASE 8: Hour 7-8 - Scale to 4 replicas again
    phase8_scale_to_4_again: {
      executor: 'ramping-vus',
      startTime: '420m',
      stages: [
        { duration: '20m', target: 230 },  // Push to 4
        { duration: '40m', target: 250 },  // Hold at 4 replicas
      ],
      gracefulStop: '30s',
      exec: 'highMixedTraffic',
    },

    // PHASE 9: Hour 8-9 - Varied load (3-4 replicas oscillation)
    phase9_oscillate_3_4: {
      executor: 'ramping-vus',
      startTime: '480m',
      stages: [
        { duration: '15m', target: 170 },  // Drop to 3
        { duration: '15m', target: 240 },  // Back to 4
        { duration: '15m', target: 165 },  // Down to 3
        { duration: '15m', target: 235 },  // Up to 4
      ],
      gracefulStop: '30s',
      exec: 'oscillatingTraffic',
    },

    // PHASE 10: Hour 9-10 - Cool down to 1 replica
    phase10_cooldown: {
      executor: 'ramping-vus',
      startTime: '540m',
      stages: [
        { duration: '15m', target: 150 },  // Start reduction
        { duration: '15m', target: 100 },  // Down to 2
        { duration: '15m', target: 60 },   // Down to 1
        { duration: '15m', target: 30 },   // Minimal load
      ],
      gracefulStop: '30s',
      exec: 'cooldownTraffic',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<8000'],  // Very lenient for aggressive training
    'errors': ['rate<0.5'],  // Allow more errors during high load
  },
};

// No more light traffic - removed to skip warmup phase

// Moderate mixed traffic - 2 replica level - AGGRESSIVE
// Balanced mix of services, high request rate
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
  
  sleep(Math.random() * 0.3 + 0.1);  // Very short: 0.1-0.4s
}

// Medium mixed traffic - 3 replica level - AGGRESSIVE
// More requests, very short sleep
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
  
  sleep(Math.random() * 0.2 + 0.1);  // Very short: 0.1-0.3s
}

// High mixed traffic - 4 replica level - AGGRESSIVE
// Maximum request rate across all services
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
  
  sleep(Math.random() * 0.15 + 0.05);  // Minimal: 0.05-0.2s
}

// Peak mixed traffic - 5 replica level (MAX) - ULTRA AGGRESSIVE
// Absolute maximum load across all services
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
  
  sleep(Math.random() * 0.1 + 0.02);  // Ultra short: 0.02-0.12s
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

