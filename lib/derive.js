// Deterministic metadata fields — Canonical URL and Schema (JSON-LD) — built
// from config templates plus fetched entry data. Unlike Title/Description/
// Keywords these are never drafted by hand.
//
// Template tokens:
//   {dot.path}      a value from the fetched entry, e.g. {slug}, {hero.image.url}
//   {row.field}     a value from the drafted metadata row, e.g. {row.description}
//   {canonicalUrl}  the derived canonical URL (schema templates only)
// Filters: {publishedDate|date} -> YYYY-MM-DD, {row.keywords|join} -> "a, b"

const { getByPath, isEmpty } = require('./object-path');

const TOKEN_RE = /\{([^{}]+)\}/g;
const WHOLE_TOKEN_RE = /^\{([^{}]+)\}$/;

const FILTERS = {
  date: (v) => String(v).split('T')[0],
  join: (v) => (Array.isArray(v) ? v.join(', ') : v),
};

function resolveToken(token, ctx) {
  const [rawPath, ...filters] = token.split('|').map((s) => s.trim());
  let value;
  if (rawPath === 'canonicalUrl') {
    value = ctx.canonicalUrl;
  } else if (rawPath.startsWith('row.')) {
    value = getByPath(ctx.row || {}, rawPath.slice(4));
  } else {
    value = getByPath(ctx.entry || {}, rawPath);
  }
  for (const name of filters) {
    if (isEmpty(value)) break;
    if (!FILTERS[name]) throw new Error(`Unknown template filter "|${name}" in token {${token}}`);
    value = FILTERS[name](value);
  }
  return value;
}

// Substitutes every token in a string. Returns { value, missing } where
// missing lists the tokens that resolved empty (value is then null).
function fillString(template, ctx) {
  const whole = template.match(WHOLE_TOKEN_RE);
  if (whole) {
    const value = resolveToken(whole[1], ctx);
    return isEmpty(value) ? { value: null, missing: [whole[1]] } : { value, missing: [] };
  }
  const missing = [];
  const value = template.replace(TOKEN_RE, (_, token) => {
    const v = resolveToken(token, ctx);
    if (isEmpty(v)) {
      missing.push(token);
      return '';
    }
    return String(v);
  });
  return missing.length ? { value: null, missing } : { value, missing };
}

function buildCanonicalUrl(entry, canonicalCfg) {
  if (!canonicalCfg || !canonicalCfg.baseUrl) {
    return { url: null, error: 'config has no "canonicalUrl.baseUrl"' };
  }
  const rule = (canonicalCfg.rules || []).find((r) => !isEmpty(getByPath(entry, r.when)));
  const pattern = rule ? rule.pattern : canonicalCfg.default;
  if (!pattern) {
    return { url: null, error: 'no canonicalUrl rule matched and no "canonicalUrl.default" pattern is set' };
  }

  const { value, missing } = fillString(pattern, { entry });
  if (value === null) {
    return { url: null, error: `canonical URL pattern "${pattern}" has empty token(s): ${missing.join(', ')}` };
  }

  let pathPart = value.startsWith('/') ? value : `/${value}`;
  pathPart = pathPart.replace(/\/{2,}/g, '/');
  if (canonicalCfg.trailingSlash && !pathPart.endsWith('/')) pathPart += '/';
  if (!canonicalCfg.trailingSlash && pathPart.length > 1) pathPart = pathPart.replace(/\/+$/, '');

  return { url: canonicalCfg.baseUrl.replace(/\/+$/, '') + encodeURI(pathPart), error: null };
}

// Walks the template, filling tokens and dropping anything that resolves
// empty, so the output never contains placeholder or blank values.
function fillTemplate(node, ctx) {
  if (typeof node === 'string') {
    return fillString(node, ctx).value ?? undefined;
  }
  if (Array.isArray(node)) {
    const out = node.map((n) => fillTemplate(n, ctx)).filter((v) => !isEmpty(v));
    return out.length ? out : undefined;
  }
  if (node && typeof node === 'object') {
    const out = {};
    for (const [key, child] of Object.entries(node)) {
      const v = fillTemplate(child, ctx);
      if (!isEmpty(v)) out[key] = v;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return node;
}

function buildSchema(entry, row, canonicalUrl, schemaCfg) {
  if (!schemaCfg || !schemaCfg.template) return null;
  return fillTemplate(schemaCfg.template, { entry, row, canonicalUrl }) || null;
}

module.exports = { buildCanonicalUrl, buildSchema };
