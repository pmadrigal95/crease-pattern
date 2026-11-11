/**
 * Fills `{name}` placeholders in a sentence. Copy is never concatenated: dynamic values go through
 * here so a translation can reorder them. Throws on a missing value, so a typo fails the build (or
 * the test) instead of shipping "{count} posts".
 *
 * Dependency-free on purpose: browser scripts import it too, without pulling in the copy loader.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (!(key in values)) throw new Error(`Missing value for {${key}} in "${template}"`);
    return String(values[key]);
  });
}
