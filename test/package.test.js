const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { skillFiles, SKILL_NAME, ROOT } = require('../scripts/package-skill');

const ZIP = path.join(ROOT, 'dist', `${SKILL_NAME}.zip`);
const hasUnzip = (() => {
  try {
    execFileSync('unzip', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

test('committed dist zip matches the skill source (run `npm run package` if this fails)', { skip: !hasUnzip && 'unzip not available' }, () => {
  assert.ok(fs.existsSync(ZIP), 'dist/seo-metadata.zip is missing — run `npm run package`');
  const prefix = `${SKILL_NAME}/`;
  const entries = execFileSync('unzip', ['-Z1', ZIP], { encoding: 'utf8' })
    .split('\n')
    .filter((e) => e && !e.endsWith('/'))
    .map((e) => e.slice(prefix.length))
    .sort();
  assert.deepStrictEqual(entries, skillFiles().sort(), 'zip file list differs from the source');

  for (const f of entries) {
    const zipped = execFileSync('unzip', ['-p', ZIP, prefix + f], { maxBuffer: 50 * 1024 * 1024 });
    assert.ok(zipped.equals(fs.readFileSync(path.join(ROOT, f))), `${f} in the zip is out of date`);
  }
});
