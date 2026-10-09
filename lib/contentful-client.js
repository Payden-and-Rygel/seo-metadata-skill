const { getCredential, requireCredential } = require('./credentials');

async function graphql(query, variables, { preview } = {}) {
  const spaceId = await requireCredential('CONTENTFUL_SPACE_ID');
  const accessToken = preview ? await requireCredential('CONTENTFUL_PREVIEW_TOKEN') : await requireCredential('CONTENTFUL_ACCESS_TOKEN');
  const environmentId = getCredential('CONTENTFUL_ENVIRONMENT_ID') || 'master';

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
  const spaceId = await requireCredential('CONTENTFUL_SPACE_ID');
  const managementToken = await requireCredential('CONTENTFUL_MANAGEMENT_TOKEN');
  const environmentId = getCredential('CONTENTFUL_ENVIRONMENT_ID') || 'master';

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

module.exports = { graphql, managementRequest };
