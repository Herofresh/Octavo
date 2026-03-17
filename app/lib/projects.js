const fs = require("node:fs/promises");
const path = require("node:path");

const { parseFrontmatterDocument, stringifyFrontmatterDocument } = require("./frontmatter");
const { ensureBacklogProject, getBacklogProjectPaths } = require("./backlog");
const { toOptionalString } = require("./normalize");
const { getDefaultRuntimeConfig } = require("./runtime");
const { REPO_ROOT, resolveWorkspacePath } = require("./storage");

const PROJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const RUNTIME_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;

function toRepoRelativePath(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath).split(path.sep).join("/");
}

function validateProjectId(projectId) {
  if (typeof projectId !== "string" || !PROJECT_ID_PATTERN.test(projectId)) {
    const error = new Error(
      "Invalid projectId. Use letters, numbers, dots, underscores, or hyphens."
    );
    error.code = "INVALID_PROJECT_ID";
    throw error;
  }

  return projectId;
}

function validateRunId(runId) {
  if (typeof runId !== "string" || !RUN_ID_PATTERN.test(runId)) {
    const error = new Error(
      "Invalid runId. Use letters, numbers, dots, underscores, or hyphens."
    );
    error.code = "INVALID_RUN_ID";
    throw error;
  }

  return runId;
}

function toRuntimeId(value) {
  const normalized = toOptionalString(value);
  if (!normalized) {
    return null;
  }

  if (!RUNTIME_ID_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

function resolveExecutionProfile(input = {}, fallback = {}) {
  const defaults = getDefaultRuntimeConfig();
  return {
    harness: toRuntimeId(input.executionHarness) || toRuntimeId(fallback.harness) || "pi",
    provider: toRuntimeId(input.runtimeProvider || input.provider) || toRuntimeId(fallback.provider) || defaults.provider,
    model: toRuntimeId(input.runtimeModel || input.model) || toRuntimeId(fallback.model) || defaults.model,
    agentPreset: toRuntimeId(input.agentPreset) || toRuntimeId(fallback.agentPreset) || null
  };
}

function getProjectWorkspacePaths(projectId) {
  const safeProjectId = validateProjectId(projectId);
  const projectDir = resolveWorkspacePath("projects", safeProjectId);
  const backlogPaths = getBacklogProjectPaths(projectDir);
  const projectFile = path.join(projectDir, "project.md");
  const runsFile = path.join(projectDir, "runs.ndjson");

  return {
    projectId: safeProjectId,
    projectDir,
    projectFile,
    runsFile,
    backlogPaths
  };
}

async function ensureProjectWorkspace(projectId, options = {}) {
  const paths = getProjectWorkspacePaths(projectId);
  await fs.mkdir(paths.projectDir, { recursive: true });
  const projectName =
    typeof options.projectName === "string" && options.projectName.trim()
      ? options.projectName.trim()
      : `Project ${paths.projectId}`;
  const backlogResult = await ensureBacklogProject(paths.projectDir, {
    projectName
  });

  return {
    projectId: paths.projectId,
    workspacePath: toRepoRelativePath(paths.projectDir),
    backlog: {
      projectDir: toRepoRelativePath(paths.backlogPaths.projectDir),
      configFile: toRepoRelativePath(paths.backlogPaths.configFile),
      initializedThisCall: backlogResult.initialized
    }
  };
}

function createProjectBody(title, sourceIdeaId) {
  return [
    `# Project: ${title}`,
    "",
    "## Source Idea",
    "",
    `- ideaId: ${sourceIdeaId}`,
    "",
    "## Scope",
    "",
    "_No scope notes yet._",
    "",
    "## Execution Notes",
    "",
    "_No execution notes yet._"
  ].join("\n");
}

async function readProjectMarkdown(paths) {
  const raw = await fs.readFile(paths.projectFile, "utf8");
  const { meta, body } = parseFrontmatterDocument(raw);
  return {
    meta,
    body
  };
}

async function readProjectRuns(paths, limit = null) {
  let raw = "";
  try {
    raw = await fs.readFile(paths.runsFile, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const runs = raw
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
    return runs.slice(-limit);
  }

  return runs;
}

function normalizeProjectRecord(paths, meta, body, runCount) {
  const execution = resolveExecutionProfile(
    {
      executionHarness: meta.executionHarness,
      runtimeProvider: meta.runtimeProvider,
      runtimeModel: meta.runtimeModel,
      agentPreset: meta.agentPreset
    },
    {}
  );

  return {
    id: meta.id || paths.projectId,
    title: meta.title || paths.projectId,
    status: toOptionalString(meta.status) || "active",
    sourceIdeaId: toOptionalString(meta.sourceIdeaId),
    createdAt: toOptionalString(meta.createdAt),
    updatedAt: toOptionalString(meta.updatedAt),
    currentRunId: toOptionalString(meta.currentRunId),
    lastRunId: toOptionalString(meta.lastRunId),
    execution,
    backlog: {
      projectDir: toRepoRelativePath(paths.backlogPaths.projectDir),
      configFile: toRepoRelativePath(paths.backlogPaths.configFile)
    },
    files: {
      projectDir: toRepoRelativePath(paths.projectDir),
      projectFile: toRepoRelativePath(paths.projectFile),
      runsFile: toRepoRelativePath(paths.runsFile)
    },
    markdown: body,
    runCount
  };
}

async function writeProjectMarkdown(paths, meta, body) {
  const content = stringifyFrontmatterDocument(meta, body);
  await fs.writeFile(paths.projectFile, content, "utf8");
}

async function getProject(projectId, options = {}) {
  const paths = getProjectWorkspacePaths(projectId);
  try {
    const { meta, body } = await readProjectMarkdown(paths);
    const includeRuns = options.includeRuns === true;
    const runsLimit = options.runsLimit;
    const runs = includeRuns ? await readProjectRuns(paths, runsLimit) : [];
    const runCount = includeRuns ? runs.length : (await readProjectRuns(paths)).length;
    const project = normalizeProjectRecord(paths, meta, body, runCount);

    if (includeRuns) {
      return {
        ...project,
        runs
      };
    }

    return project;
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function requireProject(projectId, options = {}) {
  const project = await getProject(projectId, options);
  if (!project) {
    const error = new Error(`Project not found: ${projectId}`);
    error.code = "PROJECT_NOT_FOUND";
    throw error;
  }

  return project;
}

async function listProjects() {
  const projectsRoot = resolveWorkspacePath("projects");
  let entries = [];

  try {
    entries = await fs.readdir(projectsRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const projects = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const project = await getProject(entry.name);
    if (project) {
      projects.push(project);
    }
  }

  projects.sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt || left.createdAt || 0);
    const rightTime = Date.parse(right.updatedAt || right.createdAt || 0);
    return rightTime - leftTime;
  });

  return projects;
}

async function createProjectFromIdea(idea, options = {}) {
  const sourceIdeaId = toOptionalString(idea?.id);
  if (!sourceIdeaId) {
    const error = new Error("source idea is required to create a project.");
    error.code = "INVALID_SOURCE_IDEA";
    throw error;
  }

  const projectId = validateProjectId(toOptionalString(options.id) || sourceIdeaId);
  const paths = getProjectWorkspacePaths(projectId);
  try {
    await fs.access(paths.projectFile);
    const error = new Error(`Project already exists: ${projectId}`);
    error.code = "PROJECT_ALREADY_EXISTS";
    throw error;
  } catch (error) {
    if (error.code && error.code !== "ENOENT") {
      throw error;
    }
  }

  const setup = await ensureProjectWorkspace(projectId, {
    projectName: toOptionalString(options.projectName) || toOptionalString(options.title) || idea.title
  });
  const now = new Date().toISOString();
  const title = toOptionalString(options.title) || toOptionalString(idea.title) || projectId;
  const meta = {
    id: projectId,
    title,
    status: "active",
    sourceIdeaId,
    executionHarness: toRuntimeId(options.executionHarness) || "pi",
    runtimeProvider: toRuntimeId(options.runtimeProvider) || toRuntimeId(idea.runtime?.provider) || getDefaultRuntimeConfig().provider,
    runtimeModel: toRuntimeId(options.runtimeModel) || toRuntimeId(idea.runtime?.model) || getDefaultRuntimeConfig().model,
    agentPreset: toRuntimeId(options.agentPreset) || toRuntimeId(idea.runtime?.agentPreset) || null,
    createdAt: now,
    updatedAt: now,
    currentRunId: null,
    lastRunId: null
  };
  const body = createProjectBody(title, sourceIdeaId);
  await writeProjectMarkdown(paths, meta, body);
  await fs.writeFile(paths.runsFile, "", "utf8");

  const project = await getProject(projectId);
  return {
    ...project,
    backlog: {
      ...project.backlog,
      initializedThisCall: setup.backlog.initializedThisCall
    }
  };
}

async function appendProjectRun(projectId, run) {
  const paths = getProjectWorkspacePaths(projectId);
  const { meta, body } = await readProjectMarkdown(paths);
  const safeRunId = validateRunId(run.runId);
  const now = new Date().toISOString();
  const record = {
    runId: safeRunId,
    startedAt: toOptionalString(run.startedAt) || now,
    status: toOptionalString(run.status) || "running",
    taskIds: Array.isArray(run.taskIds) ? run.taskIds : [],
    execution: resolveExecutionProfile(
      {
        executionHarness: run.executionHarness,
        runtimeProvider: run.runtimeProvider,
        runtimeModel: run.runtimeModel,
        agentPreset: run.agentPreset
      },
      {
        harness: meta.executionHarness,
        provider: meta.runtimeProvider,
        model: meta.runtimeModel,
        agentPreset: meta.agentPreset
      }
    )
  };
  await fs.appendFile(paths.runsFile, `${JSON.stringify(record)}\n`, "utf8");

  const nextMeta = {
    ...meta,
    currentRunId: safeRunId,
    lastRunId: safeRunId,
    updatedAt: now
  };
  await writeProjectMarkdown(paths, nextMeta, body);
  return getProject(projectId, {
    includeRuns: true
  });
}

module.exports = {
  appendProjectRun,
  createProjectFromIdea,
  ensureProjectWorkspace,
  getProject,
  getProjectWorkspacePaths,
  listProjects,
  requireProject,
  validateProjectId
};
