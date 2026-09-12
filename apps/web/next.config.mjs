import process from 'node:process';
import { URL, fileURLToPath } from 'node:url';

// scripts/copy-data.mjs mirrors packages/sport-engine-*/data into apps/web/data
// so the files sit inside Vercel's function tracing scope (files outside the
// project dir are silently dropped from the bundle). On Vercel the value is
// inlined into the server bundle, but lambdas run under /var/task, not the
// build machine's /vercel/path0 — emit the runtime path there.
const onVercel = process.env.VERCEL === '1';
const nflDataDirectory = onVercel
  ? '/var/task/apps/web/data/nfl'
  : fileURLToPath(new URL('./data/nfl/', import.meta.url));
const cfbDataDirectory = onVercel
  ? '/var/task/apps/web/data/cfb'
  : fileURLToPath(new URL('./data/cfb/', import.meta.url));

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
      // CFB data is large (~140MB minified across seasons); scope it to the
      // routes that read it so other functions stay under the 250MB limit.
      '/*': ['data/nfl/**/*'],
      '/api/cfb': ['data/cfb/**/*'],
      '/api/cfb/**': ['data/cfb/**/*'],
      '/play/cfb': ['data/cfb/**/*'],
      '/play/cfb/**': ['data/cfb/**/*'],
      '/api/nfl/drafts/[id]/og': [
        '../../node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-*.woff',
      ],
      '/api/cfb/drafts/[id]/og': [
        '../../node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-*.woff',
      ],
    },
  },
};

export default nextConfig;
