// Turns a fragment of the built HTML into plain text for the command menu's index
// (scripts/build-command-index.mjs). The menu writes these strings with textContent, never as
// HTML, so this is about clean labels; still, the result must hold no markup at all.
//
// Order matters: entities are decoded first, then every tag is removed, repeatedly, until none is
// left (one pass over "<scr<b>ipt>" would leave "<script>"), and any stray angle bracket goes too.
// Decoding last would turn "&lt;script&gt;" back into a tag.

const ENTITIES = { '&#39;': "'", '&#x27;': "'", '&quot;': '"', '&lt;': '<', '&gt;': '>', '&amp;': '&' };

/** @param {string} html */
export function plainText(html) {
  let text = html.replace(/&(?:#39|#x27|quot|lt|gt|amp);/g, (entity) => ENTITIES[entity] ?? '');
  for (let previous = ''; previous !== text;) {
    previous = text;
    text = text.replace(/<[^<>]*>/g, '');
  }
  return text.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
}
