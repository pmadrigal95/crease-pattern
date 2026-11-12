/// <reference types="vitest/config" />
// getViteConfig lets unit tests render .astro components with Astro's container API.
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
