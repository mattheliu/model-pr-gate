import { copyFile, mkdir } from 'node:fs/promises';

// Ship the canonical verifier in the optional bundle without another dependency.
const root = new URL('../', import.meta.url);
const plugin = new URL('plugins/dsh/', root);
await mkdir(new URL('core/', plugin), { recursive: true });
for (const file of ['attestation.js', 'defaults.js']) {
  await copyFile(new URL(`src/${file}`, root), new URL(`core/${file}`, plugin));
}
await copyFile(new URL('LICENSE', root), new URL('LICENSE', plugin));
