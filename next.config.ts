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
  // Cache imutável para modelos ONNX locais e runtime WebAssembly offline
  async headers() {
    return [
      {
        source: "/models/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/ort/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
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
