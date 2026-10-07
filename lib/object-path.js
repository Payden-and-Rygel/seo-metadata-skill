// Dot-path helpers for reading/writing nested values in fetched entries.
// Numeric segments index into arrays, e.g. "items.0.slug".

function getByPath(obj, dotPath) {
  return dotPath.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function deleteByPath(obj, dotPath) {
  const keys = dotPath.split('.');
  const last = keys.pop();
  const parent = keys.length ? getByPath(obj, keys.join('.')) : obj;
  if (parent && typeof parent === 'object') delete parent[last];
}

function isEmpty(value) {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)
  );
}

module.exports = { getByPath, deleteByPath, isEmpty };
