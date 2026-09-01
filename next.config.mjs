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

  // En-têtes de sécurité — le backend NestJS les pose déjà sur ses propres
  // réponses, mais l'app Next.js elle-même (ce que le navigateur charge
  // réellement) n'en avait aucun : ni protection anti-clickjacking, ni CSP.
  async headers() {
    const backendUrl =
      process.env.NEXT_PUBLIC_GEO_BACKEND_URL ?? 'http://localhost:3000';
    const isDev = process.env.NODE_ENV !== 'production';
    const csp = [
      "default-src 'self'",
      // 'unsafe-eval' n'est nécessaire qu'en dev (Fast Refresh / webpack eval) — absent en build de production.
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
      // 'unsafe-inline' requis par les styles injectés dynamiquement par MUI/emotion.
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      // https: large pour couvrir les différents fournisseurs de tuiles de carte (OSM, Esri, CartoDB).
      "img-src 'self' data: blob: https:",
      `connect-src 'self' ${backendUrl}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ];
  },
};

export default nextConfig;
