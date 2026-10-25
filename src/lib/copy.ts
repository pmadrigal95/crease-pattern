import raw from '../content/copy/en.json';

/**
 * Interface copy (English). Strings never get concatenated in components: dynamic
 * values go through `fill`, so translations can reorder them freely.
 */
export const copy = raw;

/** Replaces `{name}` placeholders. Throws on a missing value so a typo fails the build. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (!(key in values)) throw new Error(`Missing value for {${key}} in "${template}"`);
    return String(values[key]);
  });
}
