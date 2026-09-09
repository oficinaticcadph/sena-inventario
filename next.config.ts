import type { NextConfig } from 'next';
const config: NextConfig = {
  serverExternalPackages: ['exceljs', '@prisma/client', 'bcryptjs'],
  outputFileTracingIncludes: {
    '/api/equipos/*/excel': ['./templates/**/*'],
    '/api/equipos/*/pdf': ['./templates/**/*'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
    ];
  },
};
export default config;
