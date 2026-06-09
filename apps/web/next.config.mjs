/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source; let Next transpile them.
  transpilePackages: ['@cadence/db', '@cadence/shared'],
  // Keep the Prisma engine out of the bundler — it's a native dependency.
  serverExternalPackages: ['@prisma/client', '.prisma/client'],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
