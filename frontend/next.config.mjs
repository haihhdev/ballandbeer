/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  
  async rewrites() {
    return [
      // Auth Service - Port 4000
      {
        source: '/api/auth/:path*',
        destination: 'http://localhost:4000/api/auth/:path*',
      },
      // Admin routes - Port 4000
      {
        source: '/api/admin/:path*',
        destination: 'http://localhost:4000/api/admin/:path*',
      },
      // Booking Service - Port 4001
      {
        source: '/api/bookings/:path*',
        destination: 'http://localhost:4001/api/bookings/:path*',
      },
      // Product Service - Port 4003 (includes products and comments)
      {
        source: '/api/products/:path*',
        destination: 'http://localhost:4003/api/products/:path*',
      },
      {
        source: '/api/comments/:path*',
        destination: 'http://localhost:4003/api/comments/:path*',
      },
      // Profile Service - Port 4004
      {
        source: '/api/profile/:path*',
        destination: 'http://localhost:4004/api/profile/:path*',
      },
      // Order Service - Port 4002
      {
        source: '/api/orders/:path*',
        destination: 'http://localhost:4002/api/orders/:path*',
      },
      // Recommender Service - Port 4005
      {
        source: '/recommend',
        destination: 'http://localhost:4005/recommend',
      },
    ];
  },
};

export default nextConfig;
