import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  /** GitHub Pages: https://ntgiahuy.github.io/san/ */
  basePath: "/san",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
