/** @type {import('next').NextConfig} */

// Images come from the Laravel API's /storage: production API, local dev server,
// and whatever host NEXT_PUBLIC_API_URL points at.
const storage = (url) => {
  try {
    const u = new URL(url)
    return {
      protocol: u.protocol.replace(':', ''),
      hostname: u.hostname,
      ...(u.port ? { port: u.port } : {}),
      pathname: '/storage/**',
    }
  } catch {
    return null
  }
}

const nextConfig = {
  images: {
    remotePatterns: [
      storage('https://api.choosetounsi.tn'),
      storage('http://localhost:8000'),
      process.env.NEXT_PUBLIC_API_URL && storage(process.env.NEXT_PUBLIC_API_URL),
    ].filter(Boolean),
  },
  async rewrites() {
    return [];
  },
};

module.exports = nextConfig;
