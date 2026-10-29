/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // These libraries read their own data files (fonts, OCR worker and language model) from node_modules
    // at run time, so they must not be bundled by Next.js.
    serverComponentsExternalPackages: ['pdfkit', 'tesseract.js', '@tesseract.js-data/eng'],
  },
};

export default nextConfig;
