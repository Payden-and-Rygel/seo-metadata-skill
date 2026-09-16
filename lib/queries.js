// Generic GraphQL query builders. Nothing here is tied to any specific
// Contentful space's content types or field names — those all come from
// the caller's config (see config.example.json).

function fieldsBlock(select) {
  return select.join('\n');
}

function buildEntryByFieldQuery(contentType, filterField, select) {
  return `
    query EntryByField($value: String!) {
      ${contentType}Collection(where: { ${filterField}: $value }, limit: 1) {
        items {
          sys { id }
          ${fieldsBlock(select)}
        }
      }
    }
  `;
}

function buildEntryByIdQuery(contentType, select) {
  // Contentful's GraphQL CDA exposes a singular field named after the
  // content type (lowerCamelCase) for fetch-by-id.
  const fieldName = contentType.charAt(0).toLowerCase() + contentType.slice(1);
  return `
    query EntryById($id: String!) {
      ${fieldName}(id: $id) {
        sys { id }
        ${fieldsBlock(select)}
      }
    }
  `;
}

function buildCollectionQuery(contentType, select, { filterField } = {}) {
  const varDecl = filterField ? '$value: String!, ' : '';
  const whereClause = filterField ? `where: { ${filterField}: $value },` : '';
  return `
    query Collection(${varDecl}$skip: Int!, $limit: Int!) {
      ${contentType}Collection(${whereClause} skip: $skip, limit: $limit) {
        total
        items {
          sys { id }
          ${fieldsBlock(select)}
        }
      }
    }
  `;
}

module.exports = { buildEntryByFieldQuery, buildEntryByIdQuery, buildCollectionQuery };
