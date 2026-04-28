/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@socialpulse/shared'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.googleapis.com' },
      { protocol: 'https', hostname: '**.fbcdn.net' },
      { protocol: 'https', hostname: '**.cdninstagram.com' },
    ],
  },
}

export default nextConfig
