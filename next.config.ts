import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // The MCP route renders proposal PDFs server-side from public/ fonts and backgrounds.
  outputFileTracingIncludes: {
    '/api/[transport]': ['./public/assets/fonts/**', './public/assets/pdf-backgrounds/**'],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
};

export default nextConfig;
