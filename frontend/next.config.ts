import type { NextConfig } from "next";

const BACKEND_URL =
  process.env.BACKEND_PROXY_URL ||
  "https://renzobyns-ecowatch-backend.hf.space";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${BACKEND_URL}/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${BACKEND_URL}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
