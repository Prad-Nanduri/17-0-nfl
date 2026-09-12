import { URL, fileURLToPath } from 'node:url';

// scripts/copy-data.mjs mirrors packages/sport-engine-*/data into apps/web/data
// so the files sit inside Vercel's function tracing scope (files outside the
// project dir are silently dropped from the bundle).
const nflDataDirectory = fileURLToPath(new URL('./data/nfl/', import.meta.url));
const cfbDataDirectory = fileURLToPath(new URL('./data/cfb/', import.meta.url));

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
    outputFileTracingIncludes: {
      '/*': ['data/**/*'],
    },
  },
};

export default nextConfig;
