/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the development chrome quiet. Only affects `next dev`.
  devIndicators: { buildActivity: false },
};

export default nextConfig;
