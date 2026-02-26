/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'chooseTounsi.com'],
  },
  async rewrites() {
    return [];
  },
};

module.exports = nextConfig;