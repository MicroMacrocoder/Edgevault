/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfjs-dist is loaded at Node runtime by the European Commission connector.
  // Keep it external so the ESM parser is available in the deployed function.
  experimental: {
    serverComponentsExternalPackages: ["pdfjs-dist"],
  },
};

export default nextConfig;
