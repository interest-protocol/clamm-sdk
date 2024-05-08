// @ts-check

import eslint from '@eslint/js';
import sort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['src/scripts/**', 'dist/**', 'jest.config.js'],
  },
  {
    plugins: {
      'simple-import-sort': sort,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
