import { getEntry } from 'astro:content';

/**
 * The site owner's public profile, validated by the `profile` collection
 * (src/content.config.ts). Components read personal data only through this.
 */
export async function getProfile() {
  const entry = await getEntry('profile', 'owner');
  if (!entry) throw new Error('src/content/profile.json must define an "owner" entry.');
  return entry.data;
}
