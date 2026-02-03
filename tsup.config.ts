import { defineConfig } from 'tsup';
import { cpSync } from 'fs';
import { join } from 'path';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  shims: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  onSuccess: async () => {
    cpSync(
      join(process.cwd(), 'src', 'templates'),
      join(process.cwd(), 'dist', 'templates'),
      { recursive: true }
    );
    console.log('Templates copied to dist/templates');
  },
});
