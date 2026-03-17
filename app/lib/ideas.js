const fs = require("node:fs/promises");
const path = require("node:path");

const { REPO_ROOT, resolveWorkspacePath } = require("./storage");

const IDEA_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const IDEA_STATUSES = new Set(["new", "approved", "executing", "done", "blocked"]);

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

function validateRunId(runId) {
  if (typeof runId !== "string" || !IDEA_ID_PATTERN.test(runId)) {
    const error = new Error(
      "Invalid runId. Use letters, numbers, dots, underscores, or hyphens."
    );
    error.code = "INVALID_RUN_ID";
    throw error;
  }

  return runId;
}

function toIdeaStatus(value, fallback = "new") {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (!IDEA_STATUSES.has(normalized)) {
    return fallback;
  }

  return normalized;
}

function toOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getIdeaPaths(ideaId) {
  const safeIdeaId = validateIdeaId(ideaId);
  const absolutePath = resolveWorkspacePath("ideas", `${safeIdeaId}.json`);

  return {
    ideaId: safeIdeaId,
    absolutePath,
    relativePath: toRepoRelativePath(absolutePath)
  };
}

async function readIdeaFile(absolutePath) {
  const raw = await fs.readFile(absolutePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in idea file (${absolutePath}): ${error.message}`);
  }
}

async function getIdea(ideaId) {
  const { absolutePath, relativePath, ideaId: safeIdeaId } = getIdeaPaths(ideaId);
  try {
    const idea = await readIdeaFile(absolutePath);
    return {
      ...idea,
      id: safeIdeaId,
      file: relativePath
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function requireIdea(ideaId) {
  const idea = await getIdea(ideaId);
  if (!idea) {
    const error = new Error(`Idea not found: ${ideaId}`);
    error.code = "IDEA_NOT_FOUND";
    throw error;
  }

  return idea;
}

async function listIdeas() {
  const ideasDir = resolveWorkspacePath("ideas");
  let entries = [];

  try {
    entries = await fs.readdir(ideasDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const ideas = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const ideaId = entry.name.replace(/\.json$/i, "");
    try {
      const idea = await getIdea(ideaId);
      if (idea) {
        ideas.push(idea);
      }
    } catch {
      // Skip invalid or non-conforming files to keep listing resilient.
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
    const { absolutePath } = getIdeaPaths(candidate);
    try {
      await fs.access(absolutePath);
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
  const { absolutePath, relativePath } = getIdeaPaths(ideaId);

  try {
    await fs.access(absolutePath);
    const error = new Error(`Idea already exists: ${ideaId}`);
    error.code = "IDEA_ALREADY_EXISTS";
    throw error;
  } catch (error) {
    if (error.code && error.code !== "ENOENT") {
      throw error;
    }
  }

  const now = new Date().toISOString();
  const rootTaskId = toOptionalString(input.rootTaskId);
  const rootMilestone = toOptionalString(input.rootMilestone);
  const idea = {
    id: ideaId,
    title,
    description: toOptionalString(input.description),
    status: toIdeaStatus(input.status, "new"),
    rootLink: {
      taskId: rootTaskId,
      milestone: rootMilestone
    },
    execution: {
      runs: [],
      lastRunId: null,
      currentRunId: null
    },
    createdAt: now,
    updatedAt: now
  };

  await fs.writeFile(absolutePath, `${JSON.stringify(idea, null, 2)}\n`, "utf8");

  return {
    ...idea,
    file: relativePath
  };
}

async function markIdeaExecutionStarted(ideaId, execution) {
  const idea = await requireIdea(ideaId);
  const now = new Date().toISOString();
  const runId = validateRunId(execution.runId);
  const rootTaskId = toOptionalString(execution.rootTaskId) || idea.rootLink?.taskId || null;
  const rootMilestone =
    toOptionalString(execution.rootMilestone) || idea.rootLink?.milestone || null;
  const runs = Array.isArray(idea.execution?.runs) ? [...idea.execution.runs] : [];

  if (!runs.some((run) => run.runId === runId)) {
    runs.push({
      runId,
      startedAt: now
    });
  }

  const updated = {
    ...idea,
    status: "executing",
    rootLink: {
      taskId: rootTaskId,
      milestone: rootMilestone
    },
    execution: {
      runs,
      lastRunId: runId,
      currentRunId: runId
    },
    updatedAt: now
  };

  const { absolutePath } = getIdeaPaths(ideaId);
  await fs.writeFile(absolutePath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");

  return updated;
}

module.exports = {
  createIdea,
  getIdea,
  listIdeas,
  markIdeaExecutionStarted,
  requireIdea,
  validateIdeaId
};
