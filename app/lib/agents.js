const fs = require("node:fs/promises");
const path = require("node:path");

const { parseFrontmatterDocument } = require("./frontmatter");
const { toOptionalString } = require("./normalize");
const { REPO_ROOT, resolveWorkspacePath } = require("./storage");

function toRepoRelativePath(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath).split(path.sep).join("/");
}

function normalizeAgentRecord(filePath, id, meta, body) {
  return {
    id,
    title: toOptionalString(meta.title) || id,
    description: toOptionalString(meta.description) || "",
    source: toOptionalString(meta.source) || null,
    tags: Array.isArray(meta.tags) ? meta.tags.map((tag) => toOptionalString(tag)).filter(Boolean) : [],
    systemPrompt: body,
    file: toRepoRelativePath(filePath)
  };
}

async function getAgentPreset(agentId) {
  const normalizedId = toOptionalString(agentId);
  if (!normalizedId) {
    return null;
  }

  const filePath = resolveWorkspacePath("agents", `${normalizedId}.md`);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const { meta, body } = parseFrontmatterDocument(raw);
    return normalizeAgentRecord(filePath, normalizedId, meta, body);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function listAgentPresets() {
  const agentsRoot = resolveWorkspacePath("agents");
  let entries = [];

  try {
    entries = await fs.readdir(agentsRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const presets = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    const id = entry.name.replace(/\.md$/, "");
    const preset = await getAgentPreset(id);
    if (preset) {
      presets.push(preset);
    }
  }

  presets.sort((left, right) => left.id.localeCompare(right.id));
  return presets;
}

module.exports = {
  getAgentPreset,
  listAgentPresets
};
