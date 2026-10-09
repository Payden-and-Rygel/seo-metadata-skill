const fs = require('fs');
const os = require('os');
const path = require('path');

// Contentful credentials are stored once per user, outside any project, so
// they never end up in a repo. A real environment variable of the same name
// (e.g. in CI) takes precedence over the stored value.
const KEYS = {
  CONTENTFUL_SPACE_ID: 'spaceId',
  CONTENTFUL_ACCESS_TOKEN: 'accessToken',
  CONTENTFUL_PREVIEW_TOKEN: 'previewToken',
  CONTENTFUL_MANAGEMENT_TOKEN: 'managementToken',
  CONTENTFUL_ENVIRONMENT_ID: 'environmentId',
  CONTENTFUL_LOCALE: 'locale',
};
const SECRET_KEYS = new Set(['accessToken', 'previewToken', 'managementToken']);

function credentialsPath() {
  if (process.env.SEO_METADATA_CREDENTIALS) return path.resolve(process.env.SEO_METADATA_CREDENTIALS);
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(configHome, 'seo-metadata-skill', 'credentials.json');
}

function loadCredentials() {
  const file = credentialsPath();
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Merges `values` (camelCase keys) into the stored credentials. An empty
// string removes that key.
function saveCredentials(values) {
  const file = credentialsPath();
  const merged = { ...loadCredentials() };
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    if (value === '') delete merged[key];
    else merged[key] = value;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, JSON.stringify(merged, null, 2), { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  return merged;
}

function clearCredentials() {
  const file = credentialsPath();
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

// Looks up a value by its env-var name: real env var first, then the store.
function getCredential(envName) {
  if (process.env[envName]) return process.env[envName];
  const value = loadCredentials()[KEYS[envName]];
  return value || undefined;
}

const LABELS = {
  spaceId: 'Contentful space ID',
  accessToken: 'Contentful Content Delivery API access token',
  previewToken: 'Contentful Content Preview API token',
  managementToken: 'Contentful Content Management API token',
  environmentId: 'Contentful environment ID',
  locale: 'Contentful locale',
};

function setupFlag(key) {
  return '--' + key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

// Asks for one value on the terminal; secrets are not echoed.
function prompt(question, { secret } = {}) {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: true });
  if (secret) {
    rl._writeToOutput = (s) => {
      if (s.startsWith(question)) process.stderr.write(s);
    };
  }
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      if (secret) process.stderr.write('\n');
      resolve(answer.trim());
    });
  });
}

// Returns the stored/env value. If it's missing, asks for it in an
// interactive terminal and saves it; otherwise fails with the setup command.
async function requireCredential(envName) {
  const value = getCredential(envName);
  if (value) return value;
  const key = KEYS[envName];
  if (process.stdin.isTTY) {
    const answer = await prompt(`${LABELS[key]}: `, { secret: SECRET_KEYS.has(key) });
    if (answer) {
      saveCredentials({ [key]: answer });
      console.error(`Saved ${LABELS[key]} to ${credentialsPath()}`);
      return answer;
    }
  }
  throw new Error(`Missing ${LABELS[key]}. Save it once with: seo-metadata-skill setup ${setupFlag(key)} <value>`);
}

// { key: 'set (…abcd)' | 'not set' } with secrets masked — safe to print.
function describeCredentials() {
  const stored = loadCredentials();
  const out = {};
  for (const [envName, key] of Object.entries(KEYS)) {
    const fromEnv = process.env[envName];
    const value = fromEnv || stored[key];
    if (!value) out[key] = 'not set';
    else if (SECRET_KEYS.has(key)) out[key] = `set (…${String(value).slice(-4)})${fromEnv ? ' [from env]' : ''}`;
    else out[key] = `${value}${fromEnv ? ' [from env]' : ''}`;
  }
  return out;
}

module.exports = {
  KEYS,
  LABELS,
  setupFlag,
  credentialsPath,
  loadCredentials,
  saveCredentials,
  clearCredentials,
  getCredential,
  requireCredential,
  describeCredentials,
};
