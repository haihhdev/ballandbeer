/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  
  // Enable instrumentation to load Vault secrets on startup
  experimental: {
    instrumentationHook: true,
  },
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname: '/haihhdev/ballandbeer-image/**',
      },
    ],
  },
  
  async rewrites() {
    // Use explicit environment variables for service URLs
    // In Kubernetes: set via deployment.yaml
    // In local dev: defaults to localhost
    const authService = process.env.AUTH_SERVICE_URL || 'http://localhost:4000';
    const bookingService = process.env.BOOKING_SERVICE_URL || 'http://localhost:4001';
    const orderService = process.env.ORDER_SERVICE_URL || 'http://localhost:4002';
    const productService = process.env.PRODUCT_SERVICE_URL || 'http://localhost:4003';
    const profileService = process.env.PROFILE_SERVICE_URL || 'http://localhost:4004';
    const recommenderService = process.env.RECOMMENDER_SERVICE_URL || 'http://localhost:4005';
    
    return [
      // Auth Service - Port 4000
      {
        source: '/api/auth/:path*',
        destination: `${authService}/api/auth/:path*`,
      },
      // Admin routes - Port 4000
      {
        source: '/api/admin/:path*',
        destination: `${authService}/api/admin/:path*`,
      },
      // Booking Service - Port 4001
      {
        source: '/api/bookings/:path*',
        destination: `${bookingService}/api/bookings/:path*`,
      },
      // Product Service - Port 4003 (includes products and comments)
      {
        source: '/api/products/:path*',
        destination: `${productService}/api/products/:path*`,
      },
      {
        source: '/api/comments/:path*',
        destination: `${productService}/api/comments/:path*`,
      },
      // Profile Service - Port 4004
      {
        source: '/api/profile/:path*',
        destination: `${profileService}/api/profile/:path*`,
      },
      // Order Service - Port 4002
      {
        source: '/api/orders/:path*',
        destination: `${orderService}/api/orders/:path*`,
      },
      // Recommender Service - Port 4005
      {
        source: '/recommend',
        destination: `${recommenderService}/recommend`,
      },
    ];
  },
};

export default nextConfig;
