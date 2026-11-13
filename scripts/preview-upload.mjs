// Uploads a preview version of the site to Cloudflare, drafts included, without deploying it
// (`pnpm preview:upload`). Production keeps serving the current version; the preview gets its own
// HTTPS URL, printed by wrangler, where drafts can be read and timed on a real device. Drafts are
// marked noindex. Uses the wrangler login on this machine; no token involved.
import { execSync } from 'node:child_process';

const env = {
  ...process.env,
  PRECREASE_PREVIEW: '1',
  ASTRO_TELEMETRY_DISABLED: '1',
  WRANGLER_SEND_METRICS: 'false',
};
const run = (command) => execSync(command, { stdio: 'inherit', env });

run('corepack pnpm build');
run('corepack pnpm exec wrangler versions upload --message "Preview with drafts"');
