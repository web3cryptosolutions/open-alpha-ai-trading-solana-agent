/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Our workspace packages ship TypeScript source (exports -> src/index.ts),
  // so Next must transpile them rather than expecting prebuilt JS.
  transpilePackages: ["@openalpha/analytics", "@openalpha/types"],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
