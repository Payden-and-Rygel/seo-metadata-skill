function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

async function graphql(query, variables) {
  const spaceId = requireEnv('CONTENTFUL_SPACE_ID');
  const accessToken = requireEnv('CONTENTFUL_ACCESS_TOKEN');
  const environmentId = process.env.CONTENTFUL_ENVIRONMENT_ID || 'marketing-v2';

  const url = `https://graphql.contentful.com/content/v1/spaces/${spaceId}/environments/${environmentId}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (!res.ok || json.errors) {
    throw new Error(`Contentful GraphQL error: ${JSON.stringify(json.errors || json)}`);
  }
  return json.data;
}

async function managementRequest(path, options = {}) {
  const spaceId = requireEnv('CONTENTFUL_SPACE_ID');
  const managementToken = requireEnv('CONTENTFUL_MANAGEMENT_TOKEN');
  const environmentId = process.env.CONTENTFUL_ENVIRONMENT_ID || 'marketing-v2';

  const url = `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${managementToken}`,
      'Content-Type': 'application/vnd.contentful.management.v1+json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Contentful Management API error (${res.status}): ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

module.exports = { graphql, managementRequest, requireEnv };
