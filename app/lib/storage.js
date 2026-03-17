const fs = require("node:fs/promises");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const WORKSPACE_ROOT = path.join(REPO_ROOT, "workspace");
const DEFAULT_WORKSPACE_FOLDERS = ["ideas", "agents", "skills", "projects", "runs", "scheduler"];

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
  return dirPath;
}

function resolveWorkspacePath(...segments) {
  const resolvedPath = path.resolve(WORKSPACE_ROOT, ...segments);
  const isInsideWorkspace =
    resolvedPath === WORKSPACE_ROOT || resolvedPath.startsWith(`${WORKSPACE_ROOT}${path.sep}`);

  if (!isInsideWorkspace) {
    throw new Error(`Path escapes workspace: ${resolvedPath}`);
  }

  return resolvedPath;
}

async function ensureWorkspaceFolders(folders = DEFAULT_WORKSPACE_FOLDERS) {
  const created = [];
  for (const folder of folders) {
    const absoluteFolderPath = resolveWorkspacePath(folder);
    await ensureDir(absoluteFolderPath);
    created.push(absoluteFolderPath);
  }
  return created;
}

async function readTextFile(absolutePath) {
  return fs.readFile(absolutePath, "utf8");
}

async function writeTextFile(absolutePath, content) {
  await ensureDir(path.dirname(absolutePath));
  await fs.writeFile(absolutePath, content, "utf8");
  return absolutePath;
}

async function readMarkdown(relativeWorkspacePath) {
  return readTextFile(resolveWorkspacePath(relativeWorkspacePath));
}

async function writeMarkdown(relativeWorkspacePath, markdownContent) {
  return writeTextFile(resolveWorkspacePath(relativeWorkspacePath), markdownContent);
}

async function readJson(relativeWorkspacePath) {
  const raw = await readTextFile(resolveWorkspacePath(relativeWorkspacePath));
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${relativeWorkspacePath}: ${error.message}`);
  }
}

async function writeJson(relativeWorkspacePath, value) {
  const json = `${JSON.stringify(value, null, 2)}\n`;
  return writeTextFile(resolveWorkspacePath(relativeWorkspacePath), json);
}

module.exports = {
  DEFAULT_WORKSPACE_FOLDERS,
  REPO_ROOT,
  WORKSPACE_ROOT,
  ensureWorkspaceFolders,
  readJson,
  readMarkdown,
  resolveWorkspacePath,
  writeJson,
  writeMarkdown
};
