import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

const BASE_URL = __ENV.BASE_URL || 'http://ingress-nginx-controller.ingress-nginx.svc.cluster.local';

export const options = {
  scenarios: {
    morning_light: {
      executor: 'ramping-vus',
      startTime: '0m',
      stages: [
        { duration: '5m', target: 10 },
        { duration: '55m', target: 15 },
      ],
      gracefulStop: '30s',
      exec: 'lightBrowsing',
    },
    
    midday_moderate: {
      executor: 'ramping-vus',
      startTime: '60m',
      stages: [
        { duration: '10m', target: 30 },
        { duration: '170m', target: 40 },
        { duration: '10m', target: 30 },
      ],
      gracefulStop: '30s',
      exec: 'moderateActivity',
    },
    
    afternoon_busy: {
      executor: 'ramping-vus',
      startTime: '250m',
      stages: [
        { duration: '15m', target: 60 },
        { duration: '165m', target: 80 },
        { duration: '10m', target: 70 },
      ],
      gracefulStop: '30s',
      exec: 'busyActivity',
    },
    
    evening_peak: {
      executor: 'ramping-vus',
      startTime: '440m',
      stages: [
        { duration: '20m', target: 120 },
        { duration: '60m', target: 180 },
        { duration: '60m', target: 200 },
        { duration: '60m', target: 150 },
        { duration: '20m', target: 100 },
        { duration: '20m', target: 50 },
        { duration: '20m', target: 0 },
      ],
      gracefulStop: '30s',
      exec: 'peakBooking',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<2000'],
    'errors': ['rate<0.2'],
  },
};

export function lightBrowsing() {
  const headers = { 'Content-Type': 'application/json' };
  
  http.get(`${BASE_URL}/`, { headers });
  sleep(5);
  
  if (Math.random() > 0.7) {
    http.get(`${BASE_URL}/api/products`, { headers });
    sleep(4);
    
    const productId = Math.floor(Math.random() * 20) + 1;
    http.get(`${BASE_URL}/api/products/${productId}`, { headers });
    sleep(3);
  }
}

export function moderateActivity() {
  const headers = { 'Content-Type': 'application/json' };
  
  const action = Math.random();
  
  if (action < 0.5) {
    http.get(`${BASE_URL}/api/products`, { headers });
    sleep(3);
    
    const productId = Math.floor(Math.random() * 20) + 1;
    http.get(`${BASE_URL}/api/products/${productId}`, { headers });
    sleep(2);
    
    http.get(`${BASE_URL}/api/products/${productId}/comments`, { headers });
    sleep(2);
    
  } else if (action < 0.8) {
    const email = `user${Math.floor(Math.random() * 1000)}@example.com`;
    const password = 'password123';
    
    const loginRes = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ email, password }),
      { headers }
    );
    
    if (loginRes.status === 200 && loginRes.json('token')) {
      const authHeaders = {
        ...headers,
        'Authorization': `Bearer ${loginRes.json('token')}`,
      };
      
      http.get(`${BASE_URL}/api/profile`, { headers: authHeaders });
      sleep(2);
      
      http.get(`${BASE_URL}/api/bookings/my-bookings`, { headers: authHeaders });
      sleep(2);
    }
    
  } else {
    http.post(
      `${BASE_URL}/recommend`,
      JSON.stringify({
        user_id: `user_${Math.floor(Math.random() * 100)}`,
        top_n: 5,
      }),
      { headers }
    );
    sleep(2);
  }
}

export function busyActivity() {
  const headers = { 'Content-Type': 'application/json' };
  
  const action = Math.random();
  
  if (action < 0.6) {
    const email = `afternoon${Math.floor(Math.random() * 2000)}@example.com`;
    const password = 'password123';
    
    http.post(
      `${BASE_URL}/api/auth/register`,
      JSON.stringify({
        email,
        password,
        name: 'Afternoon User',
        phone: '0901234567',
      }),
      { headers }
    );
    sleep(1);
    
    const loginRes = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ email, password }),
      { headers }
    );
    
    if (loginRes.status === 200 && loginRes.json('token')) {
      const authHeaders = {
        ...headers,
        'Authorization': `Bearer ${loginRes.json('token')}`,
      };
      
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + Math.floor(Math.random() * 5) + 1);
      
      const bookingRes = http.post(
        `${BASE_URL}/api/bookings`,
        JSON.stringify({
          venueId: Math.floor(Math.random() * 5) + 1,
          venueName: `San ${Math.floor(Math.random() * 3) + 5} nguoi`,
          date: bookingDate.toISOString().split('T')[0],
          time: ['17:00', '18:00', '19:00'][Math.floor(Math.random() * 3)],
          duration: Math.random() > 0.3 ? 90 : 60,
          totalPrice: Math.random() > 0.3 ? 500000 : 300000,
          customerName: 'Afternoon User',
          customerPhone: '0901234567',
          customerEmail: email,
        }),
        { headers: authHeaders }
      );
      
      check(bookingRes, {
        'booking created': (r) => r.status === 201,
      }) || errorRate.add(1);
      
      sleep(1);
    }
    
  } else if (action < 0.85) {
    http.get(`${BASE_URL}/api/products`, { headers });
    sleep(2);
    
    const productId = Math.floor(Math.random() * 20) + 1;
    http.get(`${BASE_URL}/api/products/${productId}`, { headers });
    sleep(1);
    
    http.post(
      `${BASE_URL}/recommend`,
      JSON.stringify({
        user_id: `user_${Math.floor(Math.random() * 100)}`,
        top_n: 5,
      }),
      { headers }
    );
    sleep(1);
    
  } else {
    const email = `shopper${Math.floor(Math.random() * 500)}@example.com`;
    const loginRes = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ email, password: 'password123' }),
      { headers }
    );
    
    if (loginRes.status === 200 && loginRes.json('token')) {
      const authHeaders = {
        ...headers,
        'Authorization': `Bearer ${loginRes.json('token')}`,
      };
      
      http.post(
        `${BASE_URL}/api/orders`,
        JSON.stringify({
          products: [
            {
              productId: Math.floor(Math.random() * 20) + 1,
              quantity: Math.floor(Math.random() * 3) + 1,
              price: 50000,
            },
          ],
          totalAmount: 150000,
          shippingAddress: '123 Test St, HCM',
        }),
        { headers: authHeaders }
      );
      sleep(1);
    }
  }
}

export function peakBooking() {
  const headers = { 'Content-Type': 'application/json' };
  
  const email = `evening${Math.floor(Math.random() * 5000)}@example.com`;
  const password = 'password123';
  
  const registerRes = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({
      email,
      password,
      name: 'Evening Player',
      phone: `090${Math.floor(Math.random() * 10000000)}`,
    }),
    { headers }
  );
  
  check(registerRes, {
    'register success or exists': (r) => r.status === 201 || r.status === 400,
  }) || errorRate.add(1);
  
  sleep(0.5);
  
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email, password }),
    { headers }
  );
  
  if (loginRes.status === 200 && loginRes.json('token')) {
    const authHeaders = {
      ...headers,
      'Authorization': `Bearer ${loginRes.json('token')}`,
    };
    
    sleep(0.5);
    
    const bookingDate = new Date();
    const daysAhead = Math.random() > 0.7 ? 0 : Math.floor(Math.random() * 3) + 1;
    bookingDate.setDate(bookingDate.getDate() + daysAhead);
    
    const timeSlots = ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'];
    const venueTypes = [
      { id: 1, name: 'San 5 nguoi A', price: 300000 },
      { id: 2, name: 'San 7 nguoi B', price: 400000 },
      { id: 3, name: 'San 11 nguoi C', price: 600000 },
    ];
    
    const venue = venueTypes[Math.floor(Math.random() * venueTypes.length)];
    const timeSlot = timeSlots[Math.floor(Math.random() * timeSlots.length)];
    
    const bookingRes = http.post(
      `${BASE_URL}/api/bookings`,
      JSON.stringify({
        venueId: venue.id,
        venueName: venue.name,
        date: bookingDate.toISOString().split('T')[0],
        time: timeSlot,
        duration: Math.random() > 0.3 ? 90 : 120,
        totalPrice: venue.price,
        customerName: 'Evening Player',
        customerPhone: `090${Math.floor(Math.random() * 10000000)}`,
        customerEmail: email,
      }),
      { headers: authHeaders }
    );
    
    check(bookingRes, {
      'peak booking created': (r) => r.status === 201,
    }) || errorRate.add(1);
    
    sleep(1);
    
    if (Math.random() > 0.6) {
      http.get(`${BASE_URL}/api/bookings/my-bookings`, { headers: authHeaders });
      sleep(0.5);
    }
    
    if (Math.random() > 0.7) {
      http.get(`${BASE_URL}/api/products`, { headers: authHeaders });
      sleep(1);
      
      const productId = Math.floor(Math.random() * 20) + 1;
      http.get(`${BASE_URL}/api/products/${productId}`, { headers: authHeaders });
      sleep(0.5);
    }
  } else {
    errorRate.add(1);
  }
}
