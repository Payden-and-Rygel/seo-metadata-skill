const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const creds = require('../lib/credentials');

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-creds-home-'));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-creds-work-'));
const originalCwd = process.cwd();
const savedEnv = { XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME, SEO_METADATA_CREDENTIALS: process.env.SEO_METADATA_CREDENTIALS };

test.before(() => {
  process.env.XDG_CONFIG_HOME = home;
  delete process.env.SEO_METADATA_CREDENTIALS;
  process.chdir(work);
});

test.after(() => {
  process.chdir(originalCwd);
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

test('defaults to the per-user file when no local file exists', () => {
  assert.strictEqual(creds.credentialsPath(), path.join(home, 'seo-metadata-skill', 'credentials.json'));
});

test('saves to ./.seo-metadata/ with mode 600 and a gitignore when local', () => {
  creds.saveCredentials({ spaceId: 'space1' }, { local: true });
  const file = path.join(fs.realpathSync(work), '.seo-metadata', 'credentials.json');
  assert.strictEqual(fs.realpathSync(creds.credentialsPath()), file);
  assert.strictEqual(fs.statSync(file).mode & 0o777, 0o600);
  assert.strictEqual(fs.readFileSync(path.join(path.dirname(file), '.gitignore'), 'utf8'), '*\n');
  assert.strictEqual(creds.getCredential('CONTENTFUL_SPACE_ID'), 'space1');
});

test('later saves go to the existing local file', () => {
  creds.saveCredentials({ accessToken: 'tok' });
  assert.deepStrictEqual(creds.loadCredentials(), { spaceId: 'space1', accessToken: 'tok' });
  assert.ok(!fs.existsSync(path.join(home, 'seo-metadata-skill', 'credentials.json')));
});

test('SEO_METADATA_CREDENTIALS wins over the local file', () => {
  const override = path.join(home, 'override.json');
  process.env.SEO_METADATA_CREDENTIALS = override;
  try {
    assert.strictEqual(creds.credentialsPath(), override);
    creds.saveCredentials({ spaceId: 'x' }, { local: true });
    assert.ok(fs.existsSync(override));
  } finally {
    delete process.env.SEO_METADATA_CREDENTIALS;
  }
});

test('clear removes the local file and falls back to the per-user file', () => {
  creds.clearCredentials();
  assert.strictEqual(creds.credentialsPath(), path.join(home, 'seo-metadata-skill', 'credentials.json'));
});
