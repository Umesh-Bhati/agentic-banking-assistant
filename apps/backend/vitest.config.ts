import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@boit/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
      '@': path.resolve(__dirname, './src'),
    },
  },
});