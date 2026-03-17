const fs = require("node:fs/promises");
const path = require("node:path");

const { ensureBacklogProject, getBacklogProjectPaths } = require("./backlog");
const { REPO_ROOT, resolveWorkspacePath } = require("./storage");

const RUN_METADATA_FILE = "run.json";
const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function toRepoRelativePath(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath).split(path.sep).join("/");
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
    createdAt,
    updatedAt: now
  };

  await fs.writeFile(paths.metadataFile, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

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
    }
  };
}

module.exports = {
  openRunWorkspace,
  validateRunId
};
