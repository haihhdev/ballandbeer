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
      // Recommender service is disabled for local development
      // Order service requires Kafka/Vault - temporarily disabled
      {
        source: '/api/orders/:path*',
        destination: 'http://localhost:3000/api/orders-disabled/:path*', // Will return 404
      },
      {
        source: '/recommend',
        destination: 'http://localhost:3000/api/recommend-disabled', // Will return 404
      },
    ];
  },
};

export default nextConfig;
