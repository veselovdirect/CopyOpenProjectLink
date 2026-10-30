import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const extension = new URL('extension/', root);
const manifest = JSON.parse(await readFile(new URL('manifest.json', extension), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.action.default_popup, undefined);
assert.equal(manifest.host_permissions, undefined);
assert.deepEqual(manifest.permissions.slice().sort(), ['activeTab', 'scripting', 'contextMenus', 'clipboardWrite', 'offscreen'].sort());
for (const relative of [manifest.background.service_worker, 'offscreen.html', ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon)]) {
  await readFile(new URL(relative, extension));
}
for (const state of ['default', 'success']) {
  for (const size of [16, 32, 48, 128]) {
    const png = await readFile(new URL(`icons/${state}-${size}.png`, extension));
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
}
for (const name of await readdir(new URL('src/', extension))) {
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(`src/${name}`, extension))], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}
await readFile(new URL('vendor/LICENSE.txt', extension));
const vendorCheck = spawnSync(process.execPath, ['--check', fileURLToPath(new URL('vendor/text-fragments.js', extension))], { encoding: 'utf8' });
assert.equal(vendorCheck.status, 0, vendorCheck.stderr);
console.log('Manifest, local assets, icon sizes and JavaScript syntax: OK');
