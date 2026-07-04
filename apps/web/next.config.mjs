/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@itour/shared"],
  output: "standalone",
};

export default nextConfig;
