/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@kontrolia/react", "@kontrolia/auth", "@kontrolia/permissions", "@kontrolia/shared"],
};

export default nextConfig;
