import { dirname, join } from 'node:path';
import { URL, fileURLToPath } from 'node:url';

const nflDataDirectory = fileURLToPath(
  new URL('../../packages/sport-engine-nfl/data/', import.meta.url),
);
const cfbDataDirectory = fileURLToPath(
  new URL('../../packages/sport-engine-cfb/data/', import.meta.url),
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    PERFECT_SEASON_NFL_DATA_DIR: nflDataDirectory,
    PERFECT_SEASON_CFB_DATA_DIR: cfbDataDirectory,
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
    // Data files live outside apps/web: include globs resolve against the
    // project dir (apps/web), and outputFileTracingRoot anchors emitted paths
    // at the repo root so they land at /var/task/packages/... on Vercel.
    outputFileTracingRoot: join(dirname(fileURLToPath(import.meta.url)), '..', '..'),
    outputFileTracingIncludes: {
      '/*': [
        '../../packages/sport-engine-nfl/data/**/*',
        '../../packages/sport-engine-cfb/data/**/*',
      ],
    },
  },
};

export default nextConfig;
