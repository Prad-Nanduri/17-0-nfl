/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'a.espncdn.com', pathname: '/i/teamlogos/**' },
      { protocol: 'https', hostname: 'static.www.nfl.com', pathname: '/**' },
    ],
  },
  transpilePackages: [
    '@perfect-season/sport-engine-core',
    '@perfect-season/sport-engine-nfl',
    '@perfect-season/sport-engine-cfb',
    '@perfect-season/simulation',
    '@perfect-season/db',
  ],
};

export default nextConfig;
