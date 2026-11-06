import type { NextConfig } from "next";

/**
 * Configuração do Next.js para o Frontend (cattle-vision-frontend)
 * Otimizado para Vercel e containers Docker.
 */
const backendUrl = process.env.NEXT_PUBLIC_API_URL || process.env.INTERNAL_API_URL || "http://localhost:3001";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  // Proxy de desenvolvimento/produção para o backend quando requisitado via mesmo domínio
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
