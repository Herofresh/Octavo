const fs = require("node:fs/promises");
const path = require("node:path");

const { parseFrontmatterDocument, stringifyFrontmatterDocument } = require("./frontmatter");
const { toOptionalString } = require("./normalize");
const { REPO_ROOT, resolveWorkspacePath } = require("./storage");

const IDEA_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const IDEA_STATUSES = new Set(["new", "planning", "approved", "executing", "done", "blocked"]);

function toRepoRelativePath(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath).split(path.sep).join("/");
}

function validateIdeaId(ideaId) {
  if (typeof ideaId !== "string" || !IDEA_ID_PATTERN.test(ideaId)) {
    const error = new Error(
      "Invalid ideaId. Use letters, numbers, dots, underscores, or hyphens."
    );
    error.code = "INVALID_IDEA_ID";
    throw error;
  }

  return ideaId;
}

function toIdeaStatus(value, fallback = "planning") {
  const normalized = toOptionalString(value);
  if (!normalized) {
    return fallback;
  }

  const lowered = normalized.toLowerCase();
  if (!IDEA_STATUSES.has(lowered)) {
    return fallback;
  }

  return lowered;
}

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getIdeaPaths(ideaId) {
  const safeIdeaId = validateIdeaId(ideaId);
  const ideaDir = resolveWorkspacePath("ideas", safeIdeaId);
  const ideaFile = path.join(ideaDir, "idea.md");
  const conversationFile = path.join(ideaDir, "conversation.ndjson");

  return {
    ideaId: safeIdeaId,
    ideaDir,
    ideaFile,
    conversationFile,
    relativeIdeaDir: toRepoRelativePath(ideaDir),
    relativeIdeaFile: toRepoRelativePath(ideaFile),
    relativeConversationFile: toRepoRelativePath(conversationFile)
  };
}

function createIdeaTemplate(title, description) {
  return [
    `# Idea: ${title}`,
    "",
    "## Summary",
    "",
    toOptionalString(description) || "_No summary yet._",
    "",
    "## Planning",
    "",
    "_No planning notes yet._",
    "",
    "## Discussion Highlights",
    "",
    "_No discussion highlights yet._"
  ].join("\n");
}

function appendDiscussionHighlight(markdown, highlightLine) {
  const sectionHeading = "## Discussion Highlights";
  const lines = markdown.split("\n");
  let sectionIndex = lines.findIndex((line) => line.trim() === sectionHeading);

  if (sectionIndex === -1) {
    const trimmed = markdown.replace(/\s*$/, "");
    return `${trimmed}\n\n${sectionHeading}\n\n${highlightLine}\n`;
  }

  let nextHeadingIndex = lines.findIndex((line, index) => index > sectionIndex && /^##\s+/.test(line));
  if (nextHeadingIndex === -1) {
    nextHeadingIndex = lines.length;
  }

  const sectionLines = lines.slice(sectionIndex + 1, nextHeadingIndex);
  const hasOnlyPlaceholder = sectionLines.every(
    (line) => !line.trim() || line.trim() === "_No discussion highlights yet._"
  );

  const nextSectionLines = hasOnlyPlaceholder ? [highlightLine] : [...sectionLines, highlightLine];
  lines.splice(sectionIndex + 1, nextHeadingIndex - (sectionIndex + 1), ...nextSectionLines);
  return `${lines.join("\n").replace(/\s*$/, "")}\n`;
}

async function readIdeaMarkdown(paths) {
  const raw = await fs.readFile(paths.ideaFile, "utf8");
  const { meta, body } = parseFrontmatterDocument(raw);
  return {
    meta,
    body
  };
}

async function readConversationEntries(paths, limit = null) {
  let raw = "";
  try {
    raw = await fs.readFile(paths.conversationFile, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const entries = raw
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  if (typeof limit === "number" && Number.isFinite(limit) && limit >= 0) {
    return entries.slice(-limit);
  }

  return entries;
}

async function writeIdeaMarkdown(paths, meta, body) {
  const content = stringifyFrontmatterDocument(meta, body);
  await fs.writeFile(paths.ideaFile, content, "utf8");
}

function normalizeIdeaRecord(paths, meta, body, conversationCount) {
  return {
    id: meta.id || paths.ideaId,
    title: meta.title || paths.ideaId,
    status: toIdeaStatus(meta.status, "planning"),
    rootLink: {
      taskId: toOptionalString(meta.rootTaskId),
      milestone: toOptionalString(meta.rootMilestone)
    },
    spawnedProjectId: toOptionalString(meta.spawnedProjectId),
    createdAt: toOptionalString(meta.createdAt),
    updatedAt: toOptionalString(meta.updatedAt),
    files: {
      ideaDir: paths.relativeIdeaDir,
      ideaFile: paths.relativeIdeaFile,
      conversationFile: paths.relativeConversationFile
    },
    markdown: body,
    conversationCount
  };
}

async function getIdea(ideaId, options = {}) {
  const paths = getIdeaPaths(ideaId);
  try {
    const { meta, body } = await readIdeaMarkdown(paths);
    const includeConversation = options.includeConversation === true;
    const conversationLimit = options.conversationLimit;
    const conversation = includeConversation
      ? await readConversationEntries(paths, conversationLimit)
      : [];
    const conversationCount = includeConversation
      ? conversation.length
      : (await readConversationEntries(paths)).length;
    const idea = normalizeIdeaRecord(paths, meta, body, conversationCount);

    if (includeConversation) {
      return {
        ...idea,
        conversation
      };
    }

    return idea;
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function requireIdea(ideaId, options = {}) {
  const idea = await getIdea(ideaId, options);
  if (!idea) {
    const error = new Error(`Idea not found: ${ideaId}`);
    error.code = "IDEA_NOT_FOUND";
    throw error;
  }

  return idea;
}

async function listIdeas() {
  const ideasRoot = resolveWorkspacePath("ideas");
  let entries = [];

  try {
    entries = await fs.readdir(ideasRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const ideas = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const idea = await getIdea(entry.name);
    if (idea) {
      ideas.push(idea);
    }
  }

  ideas.sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt || left.createdAt || 0);
    const rightTime = Date.parse(right.updatedAt || right.createdAt || 0);
    return rightTime - leftTime;
  });

  return ideas;
}

async function generateIdeaIdFromTitle(title) {
  const baseDate = new Date().toISOString().slice(0, 10);
  const slug = slugify(title || "idea") || "idea";
  const baseId = `${baseDate}-${slug}`;

  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const candidate = suffix === 0 ? baseId : `${baseId}-${suffix}`;
    const paths = getIdeaPaths(candidate);
    try {
      await fs.access(paths.ideaDir);
    } catch (error) {
      if (error.code === "ENOENT") {
        return candidate;
      }
      throw error;
    }
  }

  throw new Error("Unable to allocate idea id.");
}

async function createIdea(input = {}) {
  const title = toOptionalString(input.title);
  if (!title) {
    const error = new Error("Idea title is required.");
    error.code = "INVALID_IDEA_TITLE";
    throw error;
  }

  const requestedId = toOptionalString(input.id);
  const ideaId = requestedId ? validateIdeaId(requestedId) : await generateIdeaIdFromTitle(title);
  const paths = getIdeaPaths(ideaId);

  try {
    await fs.access(paths.ideaDir);
    const error = new Error(`Idea already exists: ${ideaId}`);
    error.code = "IDEA_ALREADY_EXISTS";
    throw error;
  } catch (error) {
    if (error.code && error.code !== "ENOENT") {
      throw error;
    }
  }

  await fs.mkdir(paths.ideaDir, { recursive: true });
  const now = new Date().toISOString();
  const meta = {
    id: ideaId,
    title,
    status: toIdeaStatus(input.status, "planning"),
    rootTaskId: toOptionalString(input.rootTaskId),
    rootMilestone: toOptionalString(input.rootMilestone),
    spawnedProjectId: null,
    createdAt: now,
    updatedAt: now
  };
  const body = createIdeaTemplate(title, input.description);
  await writeIdeaMarkdown(paths, meta, body);
  await fs.writeFile(paths.conversationFile, "", "utf8");

  return getIdea(ideaId);
}

async function updateIdeaDocument(ideaId, input = {}) {
  const paths = getIdeaPaths(ideaId);
  const existing = await requireIdea(ideaId);
  const { meta, body } = await readIdeaMarkdown(paths);
  const now = new Date().toISOString();

  const nextMeta = {
    ...meta,
    id: existing.id,
    title: toOptionalString(input.title) || meta.title || existing.title,
    status: toIdeaStatus(input.status, meta.status || existing.status || "planning"),
    rootTaskId:
      typeof input.rootTaskId === "string" ? toOptionalString(input.rootTaskId) : meta.rootTaskId,
    rootMilestone:
      typeof input.rootMilestone === "string"
        ? toOptionalString(input.rootMilestone)
        : meta.rootMilestone,
    spawnedProjectId: toOptionalString(meta.spawnedProjectId),
    createdAt: meta.createdAt || existing.createdAt || now,
    updatedAt: now
  };

  let nextBody = body;
  if (typeof input.markdown === "string") {
    nextBody = input.markdown;
  }

  if (typeof input.appendMarkdown === "string" && input.appendMarkdown.trim()) {
    const trimmedBody = nextBody.replace(/\s*$/, "");
    nextBody = `${trimmedBody}\n\n${input.appendMarkdown.trim()}\n`;
  }

  await writeIdeaMarkdown(paths, nextMeta, nextBody);
  return getIdea(ideaId);
}

async function appendIdeaConversation(ideaId, input = {}) {
  const paths = getIdeaPaths(ideaId);
  const { meta, body } = await readIdeaMarkdown(paths);
  const content = toOptionalString(input.content);
  if (!content) {
    const error = new Error("Conversation content is required.");
    error.code = "INVALID_IDEA_CONVERSATION";
    throw error;
  }

  const role = toOptionalString(input.role) || "user";
  const now = new Date().toISOString();
  const entry = {
    at: now,
    role,
    content,
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {}
  };

  await fs.appendFile(paths.conversationFile, `${JSON.stringify(entry)}\n`, "utf8");

  const nextMeta = {
    ...meta,
    updatedAt: now
  };
  const highlightLine = `- [${now}] **${role}**: ${content}`;
  const nextBody = appendDiscussionHighlight(body, highlightLine);
  await writeIdeaMarkdown(paths, nextMeta, nextBody);

  return {
    idea: await getIdea(ideaId),
    entry
  };
}

async function markIdeaProjectSpawned(ideaId, execution = {}) {
  const projectId = toOptionalString(execution.projectId);
  if (!projectId) {
    const error = new Error("projectId is required.");
    error.code = "INVALID_PROJECT_ID";
    throw error;
  }

  const paths = getIdeaPaths(ideaId);
  const { meta, body } = await readIdeaMarkdown(paths);
  const now = new Date().toISOString();
  const nextMeta = {
    ...meta,
    spawnedProjectId: projectId,
    status: toIdeaStatus(meta.status, "planning") === "planning" ? "approved" : meta.status,
    updatedAt: now
  };
  await writeIdeaMarkdown(paths, nextMeta, body);
  return getIdea(ideaId);
}

module.exports = {
  appendIdeaConversation,
  createIdea,
  getIdea,
  getIdeaPaths,
  listIdeas,
  markIdeaProjectSpawned,
  requireIdea,
  updateIdeaDocument,
  validateIdeaId
};
