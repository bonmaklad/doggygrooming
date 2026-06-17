/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    // Keep remote image rendering deterministic across deployment targets.
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
