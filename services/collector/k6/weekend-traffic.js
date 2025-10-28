import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

const BASE_URL = __ENV.BASE_URL || 'http://ingress-nginx-controller.ingress-nginx.svc.cluster.local';

export const options = {
  scenarios: {
    // Sáng sớm cuối tuần - Nhiều người dậy sớm đặt sân
    early_morning_rush: {
      executor: 'ramping-vus',
      startTime: '0m',
      stages: [
        { duration: '5m', target: 40 },   // Ramp up nhanh
        { duration: '25m', target: 60 },  // Duy trì cao
        { duration: '10m', target: 50 },  // Giảm nhẹ
      ],
      gracefulStop: '30s',
      exec: 'morningBooking',
    },
    
    // Buổi sáng cuối tuần - Peak cho đặt sân sáng
    late_morning_peak: {
      executor: 'ramping-vus',
      startTime: '40m',
      stages: [
        { duration: '10m', target: 80 },
        { duration: '80m', target: 100 },
        { duration: '10m', target: 70 },
      ],
      gracefulStop: '30s',
      exec: 'peakBooking',
    },
    
    // Trưa cuối tuần - Giảm nhẹ, mọi người nghỉ trưa
    midday_moderate: {
      executor: 'ramping-vus',
      startTime: '140m',
      stages: [
        { duration: '10m', target: 50 },
        { duration: '50m', target: 60 },
        { duration: '10m', target: 55 },
      ],
      gracefulStop: '30s',
      exec: 'moderateActivity',
    },
    
    // Chiều cuối tuần - Tăng dần cho buổi tối
    afternoon_buildup: {
      executor: 'ramping-vus',
      startTime: '210m',
      stages: [
        { duration: '15m', target: 80 },
        { duration: '100m', target: 120 },
        { duration: '15m', target: 110 },
      ],
      gracefulStop: '30s',
      exec: 'busyActivity',
    },
    
    // Tối cuối tuần - Peak cao nhất
    evening_super_peak: {
      executor: 'ramping-vus',
      startTime: '340m',
      stages: [
        { duration: '20m', target: 150 },
        { duration: '40m', target: 250 },
        { duration: '80m', target: 300 },  // Peak tối đa
        { duration: '60m', target: 250 },
        { duration: '40m', target: 180 },
        { duration: '30m', target: 100 },
        { duration: '20m', target: 50 },
        { duration: '10m', target: 0 },
      ],
      gracefulStop: '30s',
      exec: 'superPeakBooking',
    },
    
    // Shopping activity - Hoạt động mua sắm đồ thể thao
    weekend_shopping: {
      executor: 'ramping-vus',
      startTime: '60m',
      stages: [
        { duration: '20m', target: 30 },
        { duration: '300m', target: 50 },
        { duration: '20m', target: 20 },
      ],
      gracefulStop: '30s',
      exec: 'shoppingActivity',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<2500'],  // Cho phép threshold cao hơn do traffic lớn
    'errors': ['rate<0.15'],
  },
};

export function morningBooking() {
  const headers = { 'Content-Type': 'application/json' };
  
  const email = `morning${Math.floor(Math.random() * 3000)}@example.com`;
  const password = 'password123';
  
  // Register hoặc login
  http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({
      email,
      password,
      name: 'Weekend Morning Player',
      phone: `090${Math.floor(Math.random() * 10000000)}`,
    }),
    { headers }
  );
  
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
    
    // Đặt sân buổi sáng (7:00-11:00)
    const bookingDate = new Date();
    const daysAhead = Math.random() > 0.5 ? 0 : Math.floor(Math.random() * 2) + 1;
    bookingDate.setDate(bookingDate.getDate() + daysAhead);
    
    const morningSlots = ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00'];
    const venueTypes = [
      { id: 1, name: 'San 5 nguoi A', price: 250000 },
      { id: 2, name: 'San 7 nguoi B', price: 350000 },
      { id: 3, name: 'San 11 nguoi C', price: 500000 },
    ];
    
    const venue = venueTypes[Math.floor(Math.random() * venueTypes.length)];
    const timeSlot = morningSlots[Math.floor(Math.random() * morningSlots.length)];
    
    const bookingRes = http.post(
      `${BASE_URL}/api/bookings`,
      JSON.stringify({
        venueId: venue.id,
        venueName: venue.name,
        date: bookingDate.toISOString().split('T')[0],
        time: timeSlot,
        duration: 90,
        totalPrice: venue.price,
        customerName: 'Weekend Morning Player',
        customerPhone: `090${Math.floor(Math.random() * 10000000)}`,
        customerEmail: email,
      }),
      { headers: authHeaders }
    );
    
    check(bookingRes, {
      'morning booking created': (r) => r.status === 201,
    }) || errorRate.add(1);
    
    sleep(1);
  }
}

export function moderateActivity() {
  const headers = { 'Content-Type': 'application/json' };
  
  const action = Math.random();
  
  if (action < 0.4) {
    // Browse products
    http.get(`${BASE_URL}/api/products`, { headers });
    sleep(2);
    
    const productId = Math.floor(Math.random() * 20) + 1;
    http.get(`${BASE_URL}/api/products/${productId}`, { headers });
    sleep(2);
    
    http.get(`${BASE_URL}/api/products/${productId}/comments`, { headers });
    sleep(2);
    
  } else if (action < 0.7) {
    // Check existing bookings
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
      
      http.get(`${BASE_URL}/api/bookings/my-bookings`, { headers: authHeaders });
      sleep(2);
      
      http.get(`${BASE_URL}/api/profile`, { headers: authHeaders });
      sleep(2);
    }
    
  } else {
    // Get recommendations
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
  
  if (action < 0.65) {
    // Heavy booking activity
    const email = `afternoon${Math.floor(Math.random() * 4000)}@example.com`;
    const password = 'password123';
    
    http.post(
      `${BASE_URL}/api/auth/register`,
      JSON.stringify({
        email,
        password,
        name: 'Weekend Afternoon Player',
        phone: `091${Math.floor(Math.random() * 10000000)}`,
      }),
      { headers }
    );
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
      
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + Math.floor(Math.random() * 3));
      
      const afternoonSlots = ['15:00', '15:30', '16:00', '16:30', '17:00', '17:30'];
      const venueTypes = [
        { id: 1, name: 'San 5 nguoi A', price: 300000 },
        { id: 2, name: 'San 7 nguoi B', price: 400000 },
        { id: 3, name: 'San 11 nguoi C', price: 600000 },
      ];
      
      const venue = venueTypes[Math.floor(Math.random() * venueTypes.length)];
      
      const bookingRes = http.post(
        `${BASE_URL}/api/bookings`,
        JSON.stringify({
          venueId: venue.id,
          venueName: venue.name,
          date: bookingDate.toISOString().split('T')[0],
          time: afternoonSlots[Math.floor(Math.random() * afternoonSlots.length)],
          duration: Math.random() > 0.3 ? 90 : 120,
          totalPrice: venue.price,
          customerName: 'Weekend Afternoon Player',
          customerPhone: `091${Math.floor(Math.random() * 10000000)}`,
          customerEmail: email,
        }),
        { headers: authHeaders }
      );
      
      check(bookingRes, {
        'afternoon booking created': (r) => r.status === 201,
      }) || errorRate.add(1);
      
      sleep(1);
    }
    
  } else {
    // Browse and get recommendations
    http.get(`${BASE_URL}/api/products`, { headers });
    sleep(1);
    
    http.post(
      `${BASE_URL}/recommend`,
      JSON.stringify({
        user_id: `user_${Math.floor(Math.random() * 200)}`,
        top_n: 5,
      }),
      { headers }
    );
    sleep(1);
  }
}

export function peakBooking() {
  const headers = { 'Content-Type': 'application/json' };
  
  const email = `peak${Math.floor(Math.random() * 6000)}@example.com`;
  const password = 'password123';
  
  const registerRes = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({
      email,
      password,
      name: 'Weekend Peak Player',
      phone: `092${Math.floor(Math.random() * 10000000)}`,
    }),
    { headers }
  );
  
  check(registerRes, {
    'register success or exists': (r) => r.status === 201 || r.status === 400,
  }) || errorRate.add(1);
  
  sleep(0.3);
  
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
    
    sleep(0.3);
    
    const bookingDate = new Date();
    const daysAhead = Math.random() > 0.6 ? 0 : Math.floor(Math.random() * 4) + 1;
    bookingDate.setDate(bookingDate.getDate() + daysAhead);
    
    const timeSlots = ['11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30'];
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
        duration: Math.random() > 0.4 ? 90 : 120,
        totalPrice: venue.price,
        customerName: 'Weekend Peak Player',
        customerPhone: `092${Math.floor(Math.random() * 10000000)}`,
        customerEmail: email,
      }),
      { headers: authHeaders }
    );
    
    check(bookingRes, {
      'peak booking created': (r) => r.status === 201,
    }) || errorRate.add(1);
    
    sleep(0.5);
    
    if (Math.random() > 0.5) {
      http.get(`${BASE_URL}/api/bookings/my-bookings`, { headers: authHeaders });
      sleep(0.3);
    }
  }
}

export function superPeakBooking() {
  const headers = { 'Content-Type': 'application/json' };
  
  const email = `superpeak${Math.floor(Math.random() * 10000)}@example.com`;
  const password = 'password123';
  
  const registerRes = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({
      email,
      password,
      name: 'Weekend Evening Player',
      phone: `093${Math.floor(Math.random() * 10000000)}`,
    }),
    { headers }
  );
  
  check(registerRes, {
    'register success or exists': (r) => r.status === 201 || r.status === 400,
  }) || errorRate.add(1);
  
  sleep(0.2);
  
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
    
    sleep(0.2);
    
    const bookingDate = new Date();
    const daysAhead = Math.random() > 0.7 ? 0 : Math.floor(Math.random() * 5) + 1;
    bookingDate.setDate(bookingDate.getDate() + daysAhead);
    
    // Prime time slots - cuối tuần
    const primeTimeSlots = ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'];
    const venueTypes = [
      { id: 1, name: 'San 5 nguoi A', price: 350000 },
      { id: 2, name: 'San 7 nguoi B', price: 450000 },
      { id: 3, name: 'San 11 nguoi C', price: 650000 },
    ];
    
    const venue = venueTypes[Math.floor(Math.random() * venueTypes.length)];
    const timeSlot = primeTimeSlots[Math.floor(Math.random() * primeTimeSlots.length)];
    
    const bookingRes = http.post(
      `${BASE_URL}/api/bookings`,
      JSON.stringify({
        venueId: venue.id,
        venueName: venue.name,
        date: bookingDate.toISOString().split('T')[0],
        time: timeSlot,
        duration: Math.random() > 0.3 ? 90 : 120,
        totalPrice: venue.price,
        customerName: 'Weekend Evening Player',
        customerPhone: `093${Math.floor(Math.random() * 10000000)}`,
        customerEmail: email,
      }),
      { headers: authHeaders }
    );
    
    check(bookingRes, {
      'super peak booking created': (r) => r.status === 201,
    }) || errorRate.add(1);
    
    sleep(0.5);
    
    if (Math.random() > 0.6) {
      http.get(`${BASE_URL}/api/bookings/my-bookings`, { headers: authHeaders });
      sleep(0.3);
    }
    
    if (Math.random() > 0.5) {
      http.get(`${BASE_URL}/api/products`, { headers: authHeaders });
      sleep(0.5);
      
      const productId = Math.floor(Math.random() * 20) + 1;
      http.get(`${BASE_URL}/api/products/${productId}`, { headers: authHeaders });
      sleep(0.3);
      
      // Có thể thêm vào giỏ hàng
      if (Math.random() > 0.7) {
        http.post(
          `${BASE_URL}/recommend`,
          JSON.stringify({
            user_id: `user_${Math.floor(Math.random() * 300)}`,
            top_n: 5,
          }),
          { headers: authHeaders }
        );
        sleep(0.3);
      }
    }
  } else {
    errorRate.add(1);
  }
}

export function shoppingActivity() {
  const headers = { 'Content-Type': 'application/json' };
  
  const action = Math.random();
  
  if (action < 0.6) {
    // Browse products extensively
    http.get(`${BASE_URL}/api/products`, { headers });
    sleep(2);
    
    const productId = Math.floor(Math.random() * 20) + 1;
    http.get(`${BASE_URL}/api/products/${productId}`, { headers });
    sleep(1.5);
    
    http.get(`${BASE_URL}/api/products/${productId}/comments`, { headers });
    sleep(1);
    
    // Get recommendations
    http.post(
      `${BASE_URL}/recommend`,
      JSON.stringify({
        user_id: `user_${Math.floor(Math.random() * 150)}`,
        top_n: 5,
      }),
      { headers }
    );
    sleep(1);
    
  } else {
    // Make purchase
    const email = `shopper${Math.floor(Math.random() * 2000)}@example.com`;
    const password = 'password123';
    
    http.post(
      `${BASE_URL}/api/auth/register`,
      JSON.stringify({
        email,
        password,
        name: 'Weekend Shopper',
        phone: `094${Math.floor(Math.random() * 10000000)}`,
      }),
      { headers }
    );
    
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
      
      // Browse products
      http.get(`${BASE_URL}/api/products`, { headers: authHeaders });
      sleep(1);
      
      // Create order
      const numProducts = Math.floor(Math.random() * 3) + 1;
      const products = [];
      
      for (let i = 0; i < numProducts; i++) {
        products.push({
          productId: Math.floor(Math.random() * 20) + 1,
          quantity: Math.floor(Math.random() * 2) + 1,
          price: 50000 + Math.floor(Math.random() * 200000),
        });
      }
      
      const orderRes = http.post(
        `${BASE_URL}/api/orders`,
        JSON.stringify({
          products,
          totalAmount: products.reduce((sum, p) => sum + (p.price * p.quantity), 0),
          shippingAddress: '123 Weekend St, HCM',
        }),
        { headers: authHeaders }
      );
      
      check(orderRes, {
        'order created': (r) => r.status === 201 || r.status === 200,
      }) || errorRate.add(1);
      
      sleep(1);
    }
  }
}
