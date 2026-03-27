import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    exclude: [...configDefaults.exclude, '**/.worktrees/**', '**/e2e/**'],
  },
});
