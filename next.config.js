/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: {
    // Disable Next.js image optimization when exporting static HTML
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

module.exports = nextConfig;
