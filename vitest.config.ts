import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: false,
      exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html', 'lcov'],
        reportsDirectory: './coverage',
        include: ['src/domain/**', 'src/persistence/**'],
        exclude: ['src/test/**', 'src/types/**'],
      },
    },
  })
);
