import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  /** Served under Website CDN / GitHub Pages: https://ntgiahuy.github.io/home/san/ */
  basePath: "/home/san",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
