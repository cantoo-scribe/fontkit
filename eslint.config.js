import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      '**/dist/**',
      'coverage/**',
      'node_modules/**',
      '.parcel-cache/**',
      'src/opentype/shapers/generate-data.js',
      'src/opentype/shapers/gen-use.js',
      'src/opentype/shapers/gen-indic.js'
    ]
  },
  js.configs.recommended,
  stylistic.configs.customize({
    indent: 2,
    quotes: 'single',
    semi: true,
    jsx: false,
    arrowParens: false,
    braceStyle: '1tbs',
    commaDangle: 'never'
  }),
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node
      }
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

      // Style overrides for this codebase's historical patterns.
      '@stylistic/spaced-comment': ['error', 'always', { markers: ['!', '/'], exceptions: ['-', '='] }],
      '@stylistic/lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }],
      '@stylistic/max-statements-per-line': 'off',
      '@stylistic/multiline-ternary': 'off',
      '@stylistic/no-mixed-operators': 'off',
      '@stylistic/quote-props': ['error', 'as-needed']
    }
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
        vi: 'readonly'
      }
    }
  }
];
