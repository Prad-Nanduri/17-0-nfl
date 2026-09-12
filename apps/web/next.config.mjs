// Relative to the web app's working directory so it resolves both locally and inside the
// traced Vercel function bundle, which keeps the same monorepo layout.
const nflDataDirectory = '../../packages/sport-engine-nfl/data';

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    PERFECT_SEASON_NFL_DATA_DIR: nflDataDirectory,
  },
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
  experimental: {
    serverComponentsExternalPackages: ['@resvg/resvg-js'],
    outputFileTracingIncludes: {
      '/*': ['../../packages/sport-engine-nfl/data/**/*'],
      '/api/nfl/drafts/[id]/og': [
        '../../node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-*.woff',
      ],
    },
  },
};

export default nextConfig;
