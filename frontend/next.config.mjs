import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(isProd ? { output: "export" } : {}),
  outputFileTracingRoot: __dirname,
  reactStrictMode: true,
  devIndicators: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
