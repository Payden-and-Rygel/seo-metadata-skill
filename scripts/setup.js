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
    const file = credentialsPath();
    clearCredentials();
    console.error(`Cleared stored credentials (${file}).`);
    return;
  }

  // `--local` with no values still switches this folder to the local store,
  // so values typed at the prompts below are saved there too.
  if (opts.local) saveCredentials({}, { local: true });

  const given = {};
  for (const key of VALUE_OPTS) {
    if (opts[key] !== undefined) given[key] = opts[key];
  }
  if (Object.keys(given).length) {
    saveCredentials(given, { local: opts.local });
    console.error(`Saved ${Object.keys(given).join(', ')} to ${credentialsPath()}`);
  } else if (process.stdin.isTTY) {
    for (const envName of REQUIRED) {
      if (!getCredential(envName)) await requireCredential(envName);
    }
  }

  const status = describeCredentials();
  console.log(JSON.stringify(status, null, 2));
  console.error(`Credentials file: ${credentialsPath()}`);
  const missing = REQUIRED.filter((envName) => !getCredential(envName));
  if (missing.length) {
    console.error(`\nStill missing: ${missing.join(', ')}. Run \`setup\` with the matching flags to save them.`);
    process.exitCode = 1;
  }
}

module.exports = { run };
