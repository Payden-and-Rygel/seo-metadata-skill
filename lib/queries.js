const SEO_METADATA_FIELDS = `
  seoMetadata {
    title
    description
    keywords
    canonicalUrl
    priority
    enableSearchEngineIndexing
    imagesCollection(limit: 3) {
      items { url title }
    }
  }
`;

const ARTICLE_FIELDS = `
  sys { id publishedAt }
  title
  slug
  summary
  publishedDate
  series
  strategy
  subStrategy
  type
  thumbnailImage { url title }
  hero {
    eyebrowText
    heading
    image { url title }
  }
  content { json }
  ${SEO_METADATA_FIELDS}
`;

const ARTICLE_BY_SLUG = `
  query ArticleBySlug($slug: String!) {
    articleCollection(where: { slug: $slug }, limit: 1) {
      items { ${ARTICLE_FIELDS} }
    }
  }
`;

const ARTICLE_BY_ID = `
  query ArticleById($id: String!) {
    article(id: $id) { ${ARTICLE_FIELDS} }
  }
`;

const ARTICLES_BY_SERIES = `
  query ArticlesBySeries($series: String!, $skip: Int!, $limit: Int!) {
    articleCollection(where: { series: $series }, skip: $skip, limit: $limit, order: publishedDate_DESC) {
      total
      items { ${ARTICLE_FIELDS} }
    }
  }
`;

const ARTICLES_MISSING_METADATA = `
  query ArticlesMissingMetadata($skip: Int!, $limit: Int!) {
    articleCollection(skip: $skip, limit: $limit, order: publishedDate_DESC) {
      total
      items { ${ARTICLE_FIELDS} }
    }
  }
`;

const POINT_OF_VIEW_HUB = `
  query PointOfViewHub($slug: String!) {
    pointOfViewPageCollection(where: { slug: $slug }, limit: 1) {
      items {
        sys { id }
        title
        slug
        ${SEO_METADATA_FIELDS}
        articlesCollection(limit: 20) {
          items { title slug series }
        }
      }
    }
  }
`;

module.exports = {
  ARTICLE_BY_SLUG,
  ARTICLE_BY_ID,
  ARTICLES_BY_SERIES,
  ARTICLES_MISSING_METADATA,
  POINT_OF_VIEW_HUB,
};
