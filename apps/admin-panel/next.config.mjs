/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@kontrolia/auth",
    "@kontrolia/next",
    "@kontrolia/permissions",
    "@kontrolia/react",
    "@kontrolia/shared",
    "@kontrolia/ui",
  ],
};

export default nextConfig;
