// Builds dist/seo-metadata.zip, the installable skill committed to the repo
// (upload it in Claude desktop under Customize → Add → Upload a skill).
// Rebuild and commit it whenever the skill changes; test/package.test.js
// fails when it's out of date. Only the allowlisted skill files are
// packaged, so a project's own config, rules, credentials and work files
// sitting in this folder never end up in it.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SKILL_NAME = 'seo-metadata';
const INCLUDE = ['.claude-plugin', 'SKILL.md', 'README.md', 'config.example.json', 'lib', 'scripts', 'vendor', 'rules', 'examples'];
// Within the included dirs: rules/ keeps only the generic templates; example
// source PDFs are dropped to keep the upload small.
const SKIP = [/^rules\/(?!.*\.template\.md$|reference-data\.example\.json$)/, /^examples\/[^/]+\/docs\//, /(^|\/)\.DS_Store$/];

function listFiles(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return [];
  if (!fs.statSync(abs).isDirectory()) return [rel];
  return fs.readdirSync(abs).flatMap((name) => listFiles(path.posix.join(rel, name)));
}

// Paths (relative to the repo root) that go into the zip.
function skillFiles() {
  return INCLUDE.flatMap(listFiles).filter((f) => !SKIP.some((re) => re.test(f)));
}

function main() {
  const files = skillFiles();

  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-metadata-pkg-'));
  const skillDir = path.join(stage, SKILL_NAME);
  for (const f of files) {
    const dest = path.join(skillDir, f);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(ROOT, f), dest);
  }
  fs.chmodSync(path.join(skillDir, 'scripts', 'cli.js'), 0o755);

  const distDir = path.join(ROOT, 'dist');
  const zipFile = path.join(distDir, `${SKILL_NAME}.zip`);
  fs.mkdirSync(distDir, { recursive: true });
  fs.rmSync(zipFile, { force: true });
  try {
    execFileSync('zip', ['-qr', zipFile, SKILL_NAME], { cwd: stage, stdio: 'inherit' });
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error('`zip` is required to build the package but was not found on PATH.');
    throw err;
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }

  console.error(`Packaged ${files.length} files -> ${path.relative(process.cwd(), zipFile)}`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('Error:', err.message);
    process.exitCode = 1;
  }
}

module.exports = { skillFiles, SKILL_NAME, ROOT };
