const {
  credentialsPath,
  saveCredentials,
  clearCredentials,
  getCredential,
  requireCredential,
  describeCredentials,
} = require('../lib/credentials');

const VALUE_OPTS = ['spaceId', 'accessToken', 'previewToken', 'managementToken', 'environmentId', 'locale'];

// Only these are needed to fetch; the rest are asked for when first used.
const REQUIRED = ['CONTENTFUL_SPACE_ID', 'CONTENTFUL_ACCESS_TOKEN'];

async function run(opts) {
  if (opts.clear) {
    clearCredentials();
    console.error(`Cleared stored credentials (${credentialsPath()}).`);
    return;
  }

  const given = {};
  for (const key of VALUE_OPTS) {
    if (opts[key] !== undefined) given[key] = opts[key];
  }
  if (Object.keys(given).length) {
    saveCredentials(given);
    console.error(`Saved ${Object.keys(given).join(', ')} to ${credentialsPath()}`);
  } else if (process.stdin.isTTY) {
    for (const envName of REQUIRED) {
      if (!getCredential(envName)) await requireCredential(envName);
    }
  }

  const status = describeCredentials();
  console.log(JSON.stringify(status, null, 2));
  const missing = REQUIRED.filter((envName) => !getCredential(envName));
  if (missing.length) {
    console.error(`\nStill missing: ${missing.join(', ')}. Run \`setup\` with the matching flags to save them.`);
    process.exitCode = 1;
  }
}

module.exports = { run };
