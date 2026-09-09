import js from '@eslint/js';
import babelParser from '@babel/eslint-parser';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      '.parcel-cache/**',
      'src/opentype/shapers/generate-data.js',
      'src/opentype/shapers/gen-use.js',
      'src/opentype/shapers/gen-indic.js',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'test/**/*.js', '*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          plugins: [['@babel/plugin-proposal-decorators', { version: 'legacy' }]],
        },
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Legacy codebase: keep signal without blocking the toolchain migration.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-case-declarations': 'warn',
      'no-redeclare': 'warn',
      'no-cond-assign': ['warn', 'except-parens'],
      'no-dupe-keys': 'warn',
      'no-fallthrough': 'warn',
      'no-sparse-arrays': 'warn',
      'no-prototype-builtins': 'warn',
      'getter-return': 'warn',
      'no-useless-assignment': 'warn',
    },
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        describe: 'readonly',
        it: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
      },
    },
  },
];
