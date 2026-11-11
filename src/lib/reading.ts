/**
 * Minutes to read an MDX body: words at 230 per minute, rounded up, at least 1. Code blocks,
 * imports and JSX tags are skipped so a long snippet doesn't inflate the estimate.
 */
export function readingMinutes(body: string): number {
  const prose = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^(import|export) .*$/gm, ' ')
    .replace(/<[^>]+>/g, ' ');
  const words = prose.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return Math.max(1, Math.ceil(words / 230));
}
