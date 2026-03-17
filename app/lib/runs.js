const fs = require("node:fs/promises");
const path = require("node:path");

const {
  ensureBacklogProject,
  getBacklogProjectPaths,
  readBacklogTasksForProject
} = require("./backlog");
const { REPO_ROOT, resolveWorkspacePath } = require("./storage");

const RUN_METADATA_FILE = "run.json";
const ROOT_BACKLOG_FILE = path.join(REPO_ROOT, "BACKLOG.md");
const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const IDEA_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function coerceOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

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
  if (typeof runId !== "string" || !RUN_ID_PATTERN.test(runId)) {
    const error = new Error(
      "Invalid runId. Use letters, numbers, dots, underscores, or hyphens."
    );
    error.code = "INVALID_RUN_ID";
    throw error;
  }

  return runId;
}

function getRunWorkspacePaths(runId) {
  const safeRunId = validateRunId(runId);
  const runDir = resolveWorkspacePath("runs", safeRunId);
  const metadataFile = path.join(runDir, RUN_METADATA_FILE);
  const backlogPaths = getBacklogProjectPaths(runDir);

  return {
    runId: safeRunId,
    runDir,
    metadataFile,
    backlogPaths
  };
}

async function readRunMetadata(metadataFile) {
  try {
    const raw = await fs.readFile(metadataFile, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in run metadata (${metadataFile}): ${error.message}`);
    }

    throw error;
  }
}

function getRunStatusFromSummary(summary) {
  if (summary.total === 0) {
    return "empty";
  }

  if (summary.pending === 0) {
    return "done";
  }

  if (summary.done === 0) {
    return "not-started";
  }

  return "in-progress";
}

function formatRunSyncLine(runId, metadata, syncTimestamp, summary, status) {
  const ideaId = metadata?.idea?.id || "n/a";
  const rootTaskId = metadata?.rootLink?.taskId || "n/a";
  const rootMilestone = metadata?.rootLink?.milestone || "n/a";
  const progressPercent = summary.total === 0 ? 0 : Math.round((summary.done / summary.total) * 100);

  return `- run: ${runId} | idea: ${ideaId} | root task: ${rootTaskId} | milestone: ${rootMilestone} | status: ${status} | progress: ${summary.done}/${summary.total} (${progressPercent}%) | updated: ${syncTimestamp}`;
}

function upsertRunSyncLine(rootBacklogMarkdown, runId, runSyncLine) {
  const lines = rootBacklogMarkdown.split(/\r?\n/);
  const sectionHeading = "## Run Sync";
  let sectionIndex = lines.findIndex((line) => line.trim() === sectionHeading);

  if (sectionIndex === -1) {
    const trimmed = rootBacklogMarkdown.replace(/\s*$/, "");
    return `${trimmed}\n\n${sectionHeading}\n\n${runSyncLine}\n`;
  }

  let nextHeadingIndex = lines.findIndex(
    (line, index) => index > sectionIndex && /^##\s+/.test(line)
  );
  if (nextHeadingIndex === -1) {
    nextHeadingIndex = lines.length;
  }

  const runLinePrefix = `- run: ${runId} |`;
  let existingRunLineIndex = -1;
  for (let index = sectionIndex + 1; index < nextHeadingIndex; index += 1) {
    if (lines[index].startsWith(runLinePrefix)) {
      existingRunLineIndex = index;
      break;
    }
  }

  if (existingRunLineIndex >= 0) {
    lines[existingRunLineIndex] = runSyncLine;
  } else {
    lines.splice(nextHeadingIndex, 0, runSyncLine);
  }

  return `${lines.join("\n").replace(/\s*$/, "")}\n`;
}

async function writeRunMetadata(metadataFile, metadata) {
  await fs.writeFile(metadataFile, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
}

async function openRunWorkspace(runId, options = {}) {
  const paths = getRunWorkspacePaths(runId);
  await fs.mkdir(paths.runDir, { recursive: true });

  const backlogProjectName =
    typeof options.projectName === "string" && options.projectName.trim()
      ? options.projectName.trim()
      : `Run ${paths.runId}`;

  const backlogResult = await ensureBacklogProject(paths.runDir, {
    projectName: backlogProjectName
  });

  const now = new Date().toISOString();
  const existingMetadata = await readRunMetadata(paths.metadataFile);
  const createdAt = existingMetadata?.createdAt || now;
  const backlogInitializedAt =
    existingMetadata?.backlog?.initializedAt || (backlogResult.initialized ? now : null);
  const ideaId = coerceOptionalString(options.ideaId) || existingMetadata?.idea?.id || null;
  const rootTaskId =
    coerceOptionalString(options.rootTaskId) || existingMetadata?.rootLink?.taskId || null;
  const rootMilestone =
    coerceOptionalString(options.rootMilestone) || existingMetadata?.rootLink?.milestone || null;

  const metadata = {
    ...existingMetadata,
    runId: paths.runId,
    workspacePath: toRepoRelativePath(paths.runDir),
    backlog: {
      ...(existingMetadata?.backlog || {}),
      projectDir: toRepoRelativePath(paths.backlogPaths.projectDir),
      configFile: toRepoRelativePath(paths.backlogPaths.configFile),
      initializedAt: backlogInitializedAt
    },
    idea: {
      id: ideaId
    },
    rootLink: {
      taskId: rootTaskId,
      milestone: rootMilestone
    },
    createdAt,
    updatedAt: now
  };

  await writeRunMetadata(paths.metadataFile, metadata);

  return {
    runId: paths.runId,
    created: !existingMetadata,
    workspacePath: metadata.workspacePath,
    metadataFile: toRepoRelativePath(paths.metadataFile),
    backlog: {
      projectDir: metadata.backlog.projectDir,
      configFile: metadata.backlog.configFile,
      initializedAt: metadata.backlog.initializedAt,
      initializedThisCall: backlogResult.initialized
    },
    idea: {
      id: metadata.idea.id
    },
    rootLink: {
      taskId: metadata.rootLink.taskId,
      milestone: metadata.rootLink.milestone
    }
  };
}

async function buildRunIdForIdea(ideaId) {
  const baseDate = new Date().toISOString().slice(0, 10);
  const ideaSlug = ideaId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const baseRunId = `${baseDate}-${ideaSlug || "idea"}`;

  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const candidateRunId = suffix === 0 ? baseRunId : `${baseRunId}-${suffix}`;
    const candidatePaths = getRunWorkspacePaths(candidateRunId);
    try {
      await fs.access(candidatePaths.metadataFile);
    } catch (error) {
      if (error.code === "ENOENT") {
        return candidateRunId;
      }
      throw error;
    }
  }

  throw new Error(`Unable to allocate runId for idea ${ideaId}`);
}

async function startIdeaExecution(ideaId, options = {}) {
  const safeIdeaId = validateIdeaId(ideaId);
  const resolvedRunId = coerceOptionalString(options.runId) || (await buildRunIdForIdea(safeIdeaId));
  const run = await openRunWorkspace(resolvedRunId, {
    projectName: options.projectName,
    ideaId: safeIdeaId,
    rootTaskId: options.rootTaskId,
    rootMilestone: options.rootMilestone
  });

  return {
    ideaId: safeIdeaId,
    run
  };
}

async function syncRunStatusToRootBacklog(runId) {
  const paths = getRunWorkspacePaths(runId);
  const metadata = await readRunMetadata(paths.metadataFile);

  if (!metadata) {
    const error = new Error(`Run metadata not found for ${runId}`);
    error.code = "RUN_NOT_FOUND";
    throw error;
  }

  const runBacklog = await readBacklogTasksForProject(paths.runDir);
  const summary = runBacklog.summary;
  const status = runBacklog.available ? getRunStatusFromSummary(summary) : "missing-backlog";
  const syncTimestamp = new Date().toISOString();

  const rootBacklogRaw = await fs.readFile(ROOT_BACKLOG_FILE, "utf8");
  const runSyncLine = formatRunSyncLine(runId, metadata, syncTimestamp, summary, status);
  const rootBacklogUpdated = upsertRunSyncLine(rootBacklogRaw, runId, runSyncLine);

  if (rootBacklogUpdated !== rootBacklogRaw) {
    await fs.writeFile(ROOT_BACKLOG_FILE, rootBacklogUpdated, "utf8");
  }

  const updatedMetadata = {
    ...metadata,
    sync: {
      ...(metadata.sync || {}),
      rootBacklog: {
        lastSyncedAt: syncTimestamp,
        status,
        summary
      }
    },
    updatedAt: syncTimestamp
  };

  await writeRunMetadata(paths.metadataFile, updatedMetadata);

  return {
    runId,
    syncedAt: syncTimestamp,
    status,
    summary,
    rootBacklogFile: toRepoRelativePath(ROOT_BACKLOG_FILE)
  };
}

module.exports = {
  openRunWorkspace,
  startIdeaExecution,
  syncRunStatusToRootBacklog,
  validateIdeaId,
  validateRunId
};
