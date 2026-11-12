import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import vue from 'eslint-plugin-vue';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/',
      '.astro/',
      'node_modules/',
      'src/generated/',
      '.wrangler/',
      'playwright-report/',
      '.lighthouseci/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  ...astro.configs['jsx-a11y-strict'],
  // essential, not recommended: Prettier owns formatting, so Vue's stylistic rules would only fight it.
  ...vue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  // Layers (ENGINEERING.md): config → lib → components → layouts → pages. Each layer imports only
  // from the layers before it, so data and logic never depend on markup.
  ...layer('src/config/**', ['lib', 'components', 'layouts', 'pages']),
  ...layer('src/lib/**', ['components', 'layouts', 'pages']),
  ...layer('src/components/**', ['layouts', 'pages']),
  ...layer('src/layouts/**', ['pages']),
];

/** Forbids `files` from importing any of the `later` layers. */
function layer(files, later) {
  return [
    {
      files: [files],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: later.map((name) => ({
              group: [`**/${name}/**`],
              message: `Layer rule (ENGINEERING.md): ${files.split('/')[1]} must not import from ${name}.`,
            })),
          },
        ],
      },
    },
  ];
}
