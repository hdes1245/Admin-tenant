/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,

  experimental: {
    optimizePackageImports: [
      "@mui/material",
      "@mui/icons-material",
      "recharts",
      "framer-motion",
    ],
  },

  webpack(config, { dev }) {
    if (dev) {
      config.cache = {
        type: "filesystem",
        cacheDirectory: "C:\\tmp\\geotrust-admin-tenant-cache",
      };
    }
    return config;
  },

  async rewrites() {
    const backendUrl =
      process.env.NEXT_PUBLIC_GEO_BACKEND_URL ?? 'http://localhost:3000';
    return {
      beforeFiles: [
        {
          source: '/proxy/:path*',
          destination: `${backendUrl}/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
