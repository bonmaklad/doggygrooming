/** @type {import('next').NextConfig} */
const nextConfig = {
  // Export the site as static HTML to the `out` folder
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
