// Generic GraphQL query builders. Nothing here is tied to any specific
// Contentful space's content types or field names — those all come from
// the caller's config (see config.example.json).
//
// Every query declares optional $preview / $locale variables; passing null
// (or omitting them) gives Contentful's defaults (published content, default
// locale). Both are inherited by nested links.

const COMMON_VARS = '$preview: Boolean, $locale: String';
const COMMON_ARGS = 'preview: $preview, locale: $locale';

// Contentful's GraphQL API names query fields after the content type ID in
// lowerCamelCase: "Article" -> article(id:) / articleCollection(...).
function entryFieldName(contentType) {
  return contentType.charAt(0).toLowerCase() + contentType.slice(1);
}

function collectionFieldName(contentType) {
  return `${entryFieldName(contentType)}Collection`;
}

function fieldsBlock(select) {
  return select.join('\n');
}

function buildEntryByFieldQuery(contentType, filterField, select) {
  return `
    query EntryByField($value: String!, ${COMMON_VARS}) {
      ${collectionFieldName(contentType)}(where: { ${filterField}: $value }, limit: 1, ${COMMON_ARGS}) {
        items {
          sys { id }
          ${fieldsBlock(select)}
        }
      }
    }
  `;
}

function buildEntryByIdQuery(contentType, select) {
  return `
    query EntryById($id: String!, ${COMMON_VARS}) {
      ${entryFieldName(contentType)}(id: $id, ${COMMON_ARGS}) {
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
    query Collection(${varDecl}$skip: Int!, $limit: Int!, ${COMMON_VARS}) {
      ${collectionFieldName(contentType)}(${whereClause} skip: $skip, limit: $limit, ${COMMON_ARGS}) {
        total
        items {
          sys { id }
          ${fieldsBlock(select)}
        }
      }
    }
  `;
}

module.exports = { entryFieldName, collectionFieldName, buildEntryByFieldQuery, buildEntryByIdQuery, buildCollectionQuery };
