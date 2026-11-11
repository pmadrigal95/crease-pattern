import { z } from 'astro/zod';
import raw from '../content/copy/en.json';

/**
 * Interface copy (English). Strings never get concatenated in components: dynamic
 * values go through `fill`, so translations can reorder them freely.
 *
 * Validated on import: every leaf must be a non-empty string whose placeholders are
 * well formed (`{name}`), so a stray brace or an emptied string fails the build.
 */
type CopyTree = { [key: string]: string | CopyTree };

const leaf = z
  .string()
  .min(1)
  .refine((s) => !/\{(?!\w+\})|(?<!\{\w+)\}/.test(s), 'placeholders must look like {name}');
const tree: z.ZodType<CopyTree> = z.lazy(() => z.record(z.string(), z.union([leaf, tree])));

export const copy: typeof raw = tree.parse(raw) as typeof raw;

// `fill` lives in ./template so browser scripts can use it without the copy loader.
export { fill } from './template';
