// Benchmarks only (`pnpm bench:threads`); kept out of `pnpm test` because they take time and
// their numbers depend on the machine.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/bench/**/*.bench.ts'],
  },
});
