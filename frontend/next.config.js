/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Server-side rewrite: when the browser hits /api/* on the frontend, Next's
  // dev server proxies to the API Gateway. Inside docker-compose the gateway
  // is reachable as `api-gateway:8000` (container network). On a developer's
  // bare machine without compose, fall back to localhost:8000.
  // NOTE: this URL is resolved on the SERVER (inside the frontend container),
  // never in the browser, so it must use container-internal DNS names.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination:
          (process.env.INTERNAL_API_GATEWAY_URL || "http://api-gateway:8000") + "/api/:path*",
      },
    ];
  },
};
module.exports = nextConfig;
