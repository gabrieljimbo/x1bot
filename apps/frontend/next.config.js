/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@n9n/shared'],
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig

