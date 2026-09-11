import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['packages/simulation/**/*.{ts,tsx,js,jsx,mjs}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@perfect-season/sport-engine-nfl*',
            '@perfect-season/sport-engine-cfb*',
            '**/sport-engine-nfl/**',
            '**/sport-engine-cfb/**',
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx,js,jsx,mjs}'],
    plugins: {
      '@next/next': nextPlugin,
    },
    settings: {
      next: { rootDir: 'apps/web/' },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // Pages Router rule that uses an ESLint API removed in v9; N/A for App Router
      '@next/next/no-duplicate-head': 'off',
    },
  },
  prettier,
);
