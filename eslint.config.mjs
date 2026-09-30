import next from 'eslint-config-next'
import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

/**
 * Konfigurasi ESLint. `next lint` sudah dihapus di Next 16, jadi lint dijalankan
 * langsung lewat ESLint dengan flat config bawaan `eslint-config-next` v16.
 *
 * Catatan ditambahkan di sini memetakan kewaspadaan PRD bagian 9 dan 12.
 */
const config = [
  ...next,
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  {
    rules: {
      // Keamanan: tolak perbandingan longgar, eval, dan pembuatan fungsi dari string.
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',

      // Aksesibilitas (PRD 12): error, bukan warning.
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/no-static-element-interactions': 'error',

      // Setiap modul tidak boleh menyisakan kebocoran lewat placeholder tak terpakai.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // CLI, seeder, dan job boleh menulis ke stdout.
    files: ['scripts/**/*.{ts,mts}', 'prisma/**/*.{ts,mts}'],
    rules: { 'no-console': 'off' },
  },
  {
    // Test boleh memakai pola umum pengujian.
    files: ['tests/**/*.{ts,tsx}'],
    rules: { 'no-console': 'off' },
  },
]

export default config
