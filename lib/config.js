const fs = require('fs');
const path = require('path');
const { getCredential } = require('./credentials');

function loadConfig(configPathArg) {
  const configPath = path.resolve(
    configPathArg || process.env.SEO_METADATA_CONFIG || 'seo-metadata.config.json'
  );

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Config file not found at ${configPath}.\n` +
        `Copy config.example.json to seo-metadata.config.json in your project (or pass --config <path>) ` +
        `and fill in your Contentful content type / field mapping. See examples/ for a worked example.`
    );
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const configDir = path.dirname(configPath);

  if (!config.contentful || !config.contentful.contentType) {
    throw new Error(`Config at ${configPath} is missing required field "contentful.contentType"`);
  }
  if (!config.contentful.fields || !Array.isArray(config.contentful.fields.select)) {
    throw new Error(`Config at ${configPath} is missing required field "contentful.fields.select" (array of GraphQL field selections)`);
  }
  if (config.canonicalUrl && !/^https?:\/\//.test(config.canonicalUrl.baseUrl || '')) {
    throw new Error(`Config at ${configPath} has "canonicalUrl" but "canonicalUrl.baseUrl" is not an absolute http(s) URL`);
  }
  if (config.schema && (typeof config.schema.template !== 'object' || config.schema.template === null)) {
    throw new Error(`Config at ${configPath} has "schema" but "schema.template" is not a JSON object`);
  }

  return { config, configDir, configPath };
}

// --locale flag, then config, then the stored/env default. Returns undefined when none is set,
// so Contentful falls back to the space's default locale.
function resolveLocale(flagValue, config) {
  return flagValue || (config && config.contentful && config.contentful.locale) || getCredential('CONTENTFUL_LOCALE') || undefined;
}

function resolveFromConfigDir(configDir, relativeOrAbsolutePath) {
  if (!relativeOrAbsolutePath) return null;
  return path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.resolve(configDir, relativeOrAbsolutePath);
}

module.exports = { loadConfig, resolveFromConfigDir, resolveLocale };
