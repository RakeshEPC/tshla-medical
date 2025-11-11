import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import typescript from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default typescript.config(
  { ignores: ['dist', 'node_modules', 'server/node_modules', 'build'] },
  {
    extends: [js.configs.recommended, ...typescript.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'prettier': prettier,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Prettier integration
      'prettier/prettier': 'warn',

      // TypeScript-specific rules
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',

      // Custom rule: Ban deprecated auth services
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '../services/pumpAuth.service',
              message: '⚠️ pumpAuth.service is deprecated! Use supabaseAuth.service instead. See ARCHITECTURE.md for migration guide.',
            },
            {
              name: './pumpAuth.service',
              message: '⚠️ pumpAuth.service is deprecated! Use supabaseAuth.service instead. See ARCHITECTURE.md for migration guide.',
            },
            {
              name: '../../services/pumpAuth.service',
              message: '⚠️ pumpAuth.service is deprecated! Use supabaseAuth.service instead. See ARCHITECTURE.md for migration guide.',
            },
          ],
          patterns: [
            {
              group: ['**/pumpAuth.service'],
              message: '⚠️ pumpAuth.service is deprecated! Use supabaseAuth.service instead. See ARCHITECTURE.md for migration guide.',
            },
          ],
        },
      ],
    },
  },
  // Apply Prettier config last to override any conflicting rules
  prettierConfig
);
