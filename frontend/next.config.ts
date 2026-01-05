import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental:{
    globalNotFound: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'media0.giphy.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.pixabay.com',
      },
    ],
  },
};

export default nextConfig;
