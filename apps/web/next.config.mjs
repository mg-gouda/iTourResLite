/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@itour/shared"],
  output: "standalone",
  // eslint is not a dependency in this repo; don't fail the production build on it.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
