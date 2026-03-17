const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const { getDefaultRuntimeConfig } = require("./runtime");
const { toOptionalString } = require("./normalize");
const {
  editBacklogTaskForProject,
  readBacklogTasksForProject
} = require("./backlog");
const {
  appendProjectRun,
  ensureProjectWorkspace,
  getProjectWorkspacePaths,
  requireProject,
  validateProjectId
} = require("./projects");
const { REPO_ROOT, resolveWorkspacePath } = require("./storage");

const execFileAsync = promisify(execFile);
const RUN_METADATA_FILE = "run.json";
const ROOT_BACKLOG_FILE = path.join(REPO_ROOT, "BACKLOG.md");
const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const TASK_ID_PATTERN = /^[A-Z]+-\d+$/;
const RUNTIME_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;
const RUN_DIRECTORIES = {
  logs: "logs",
  artifacts: "artifacts",
  context: "context",
  sandboxRoot: "sandbox",
  sandboxRepo: path.join("sandbox", "repo")
};

function toRepoRelativePath(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath).split(path.sep).join("/");
}

function toOptionalNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
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

function validateTaskId(taskId) {
  if (typeof taskId !== "string" || !TASK_ID_PATTERN.test(taskId)) {
    const error = new Error("Invalid taskId. Use format like TASK-10.");
    error.code = "INVALID_TASK_ID";
    throw error;
  }

  return taskId;
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
    provider: toRuntimeId(input.runtimeProvider) || toRuntimeId(input.provider) || toRuntimeId(fallback.provider) || defaults.provider,
    model: toRuntimeId(input.runtimeModel) || toRuntimeId(input.model) || toRuntimeId(fallback.model) || defaults.model,
    agentPreset: toRuntimeId(input.agentPreset) || toRuntimeId(fallback.agentPreset) || null
  };
}

function getRunWorkspacePaths(runId) {
  const safeRunId = validateRunId(runId);
  const runDir = resolveWorkspacePath("runs", safeRunId);
  const metadataFile = path.join(runDir, RUN_METADATA_FILE);

  return {
    runId: safeRunId,
    runDir,
    metadataFile,
    logsDir: path.join(runDir, RUN_DIRECTORIES.logs),
    artifactsDir: path.join(runDir, RUN_DIRECTORIES.artifacts),
    contextDir: path.join(runDir, RUN_DIRECTORIES.context),
    sandboxDir: path.join(runDir, RUN_DIRECTORIES.sandboxRoot),
    sandboxRepoDir: path.join(runDir, RUN_DIRECTORIES.sandboxRepo)
  };
}

function getDirectoryStructure(paths) {
  return {
    logsDir: toRepoRelativePath(paths.logsDir),
    artifactsDir: toRepoRelativePath(paths.artifactsDir),
    contextDir: toRepoRelativePath(paths.contextDir),
    sandboxDir: toRepoRelativePath(paths.sandboxDir),
    sandboxRepoDir: toRepoRelativePath(paths.sandboxRepoDir)
  };
}

async function ensureRunStructure(paths) {
  await fs.mkdir(paths.runDir, { recursive: true });
  await Promise.all([
    fs.mkdir(paths.logsDir, { recursive: true }),
    fs.mkdir(paths.artifactsDir, { recursive: true }),
    fs.mkdir(paths.contextDir, { recursive: true }),
    fs.mkdir(paths.sandboxDir, { recursive: true })
  ]);
}

async function fileExists(absolutePath) {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function runGit(args, options = {}) {
  return execFileAsync("git", args, {
    cwd: options.cwd || REPO_ROOT,
    maxBuffer: 1024 * 1024 * 8
  });
}

async function gitRefExists(refName) {
  try {
    await runGit(["rev-parse", "--verify", "--quiet", refName]);
    return true;
  } catch {
    return false;
  }
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

function requireRunMetadata(metadata, runId) {
  if (!metadata) {
    const error = new Error(`Run metadata not found for ${runId}`);
    error.code = "RUN_NOT_FOUND";
    throw error;
  }

  return metadata;
}

function getRunProjectInfo(metadata) {
  const projectId = toOptionalString(metadata?.project?.id);
  if (!projectId) {
    return null;
  }

  return getProjectWorkspacePaths(projectId);
}

async function readRunBacklogForMetadata(paths, metadata) {
  const projectInfo = getRunProjectInfo(metadata);
  if (projectInfo) {
    return readBacklogTasksForProject(projectInfo.projectDir);
  }

  return {
    available: false,
    source: "backlog.md",
    projectDir: null,
    configFile: null,
    summary: {
      total: 0,
      done: 0,
      pending: 0,
      byStatus: {}
    },
    tasks: [],
    warnings: ["Run is not linked to a project backlog."]
  };
}

function getRunBacklogProjectRoot(paths, metadata) {
  const projectInfo = getRunProjectInfo(metadata);
  if (projectInfo) {
    return projectInfo.projectDir;
  }

  const error = new Error(
    `Run ${paths.runId} is not linked to a project backlog. Set projectId when creating/opening the run.`
  );
  error.code = "RUN_PROJECT_NOT_SET";
  throw error;
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
  const projectId = metadata?.project?.id || "n/a";
  const rootTaskId = metadata?.rootLink?.taskId || "n/a";
  const rootMilestone = metadata?.rootLink?.milestone || "n/a";
  const progressPercent = summary.total === 0 ? 0 : Math.round((summary.done / summary.total) * 100);

  return `- run: ${runId} | project: ${projectId} | idea: ${ideaId} | root task: ${rootTaskId} | milestone: ${rootMilestone} | status: ${status} | progress: ${summary.done}/${summary.total} (${progressPercent}%) | updated: ${syncTimestamp}`;
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

function pushRunEvent(metadata, type, details = {}) {
  const events = Array.isArray(metadata.events) ? [...metadata.events] : [];
  events.push({
    type,
    at: new Date().toISOString(),
    details
  });

  return events.slice(-200);
}

function trimOutput(text, maxChars = 20000) {
  if (typeof text !== "string") {
    return "";
  }

  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars)}\n... output truncated ...`;
}

async function openRunWorkspace(runId, options = {}) {
  const paths = getRunWorkspacePaths(runId);
  await ensureRunStructure(paths);

  const now = new Date().toISOString();
  const existingMetadata = await readRunMetadata(paths.metadataFile);
  const createdAt = existingMetadata?.createdAt || now;
  const resolvedProjectId =
    toOptionalString(options.projectId) ||
    toOptionalString(existingMetadata?.project?.id);
  if (!existingMetadata && !resolvedProjectId) {
    const error = new Error(
      `Run ${runId} is not linked to a project backlog. Set projectId when creating/opening the run.`
    );
    error.code = "RUN_PROJECT_NOT_SET";
    throw error;
  }
  const project = resolvedProjectId
    ? await requireProject(validateProjectId(resolvedProjectId))
    : null;
  const projectSetup = project
    ? await ensureProjectWorkspace(project.id, {
        projectName: toOptionalString(options.projectName) || project.title
      })
    : null;
  const projectBacklogInitializedAt =
    existingMetadata?.project?.backlog?.initializedAt ||
    (projectSetup?.backlog.initializedThisCall ? now : null);
  const ideaId = project?.sourceIdeaId || existingMetadata?.idea?.id || null;
  const rootTaskId =
    toOptionalString(options.rootTaskId) || existingMetadata?.rootLink?.taskId || null;
  const rootMilestone =
    toOptionalString(options.rootMilestone) || existingMetadata?.rootLink?.milestone || null;
  const projectExecution = project?.execution || {};
  const executionProfile = resolveExecutionProfile(options, {
    harness: existingMetadata?.execution?.profile?.harness || projectExecution.harness,
    provider: existingMetadata?.execution?.profile?.provider || projectExecution.provider,
    model: existingMetadata?.execution?.profile?.model || projectExecution.model,
    agentPreset: existingMetadata?.execution?.profile?.agentPreset || projectExecution.agentPreset
  });

  const metadata = {
    ...existingMetadata,
    runId: paths.runId,
    workspacePath: toRepoRelativePath(paths.runDir),
    project: {
      ...(existingMetadata?.project || {}),
      id: resolvedProjectId || null,
      workspacePath: projectSetup?.workspacePath || existingMetadata?.project?.workspacePath || null,
      backlog: {
        ...(existingMetadata?.project?.backlog || {}),
        projectDir: projectSetup?.backlog.projectDir || existingMetadata?.project?.backlog?.projectDir || null,
        configFile: projectSetup?.backlog.configFile || existingMetadata?.project?.backlog?.configFile || null,
        initializedAt: projectBacklogInitializedAt
      }
    },
    structure: {
      ...(existingMetadata?.structure || {}),
      ...getDirectoryStructure(paths)
    },
    idea: {
      id: ideaId
    },
    rootLink: {
      taskId: rootTaskId,
      milestone: rootMilestone
    },
    lifecycle: {
      status: existingMetadata?.lifecycle?.status || "initialized",
      startedAt: existingMetadata?.lifecycle?.startedAt || createdAt,
      lastActionAt: now
    },
    execution: {
      ...(existingMetadata?.execution || {}),
      profile: executionProfile,
      commandCount: toOptionalNumber(existingMetadata?.execution?.commandCount) || 0
    },
    events: pushRunEvent(
      existingMetadata || {},
      existingMetadata ? "workspace-reopened" : "workspace-created",
      {
        runId: paths.runId
      }
    ),
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
      projectDir: metadata.project?.backlog?.projectDir || null,
      configFile: metadata.project?.backlog?.configFile || null,
      initializedAt: metadata.project?.backlog?.initializedAt || null,
      initializedThisCall: projectSetup?.backlog.initializedThisCall || false
    },
    project: {
      id: metadata.project?.id || null,
      workspacePath: metadata.project?.workspacePath || null
    },
    idea: {
      id: metadata.idea.id
    },
    rootLink: {
      taskId: metadata.rootLink.taskId,
      milestone: metadata.rootLink.milestone
    },
    execution: metadata.execution?.profile || null,
    structure: metadata.structure
  };
}

async function getRun(runId, options = {}) {
  const paths = getRunWorkspacePaths(runId);
  const metadata = await readRunMetadata(paths.metadataFile);
  if (!metadata) {
    return null;
  }

  const includeBacklog = options.includeBacklog !== false;
  const backlog = includeBacklog ? await readRunBacklogForMetadata(paths, metadata) : undefined;

  return {
    runId: paths.runId,
    workspacePath: toRepoRelativePath(paths.runDir),
    metadataFile: toRepoRelativePath(paths.metadataFile),
    metadata,
    backlog
  };
}

async function ensureRunBranch(runId, options = {}) {
  const paths = getRunWorkspacePaths(runId);
  const metadata = requireRunMetadata(await readRunMetadata(paths.metadataFile), runId);
  await ensureRunStructure(paths);

  const branchName =
    toOptionalString(options.branchName) ||
    toOptionalString(metadata.git?.branchName) ||
    `octavo-run-${runId}`;
  const baseRef = toOptionalString(options.baseRef) || toOptionalString(metadata.git?.baseRef) || "HEAD";
  const worktreeGitDir = path.join(paths.sandboxRepoDir, ".git");
  const worktreeExists = await fileExists(worktreeGitDir);
  let createdThisCall = false;
  let resolvedBranch = branchName;

  if (!worktreeExists) {
    const branchExists = await gitRefExists(`refs/heads/${branchName}`);
    if (branchExists) {
      await runGit(["worktree", "add", paths.sandboxRepoDir, branchName]);
    } else {
      await runGit(["worktree", "add", "-b", branchName, paths.sandboxRepoDir, baseRef]);
    }
    createdThisCall = true;
  } else {
    const { stdout } = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: paths.sandboxRepoDir
    });
    const currentBranch = stdout.trim();
    if (toOptionalString(options.branchName) && currentBranch !== branchName) {
      await runGit(["checkout", branchName], {
        cwd: paths.sandboxRepoDir
      });
      resolvedBranch = branchName;
    } else {
      resolvedBranch = currentBranch;
    }
  }

  const now = new Date().toISOString();
  const updatedMetadata = {
    ...metadata,
    git: {
      ...(metadata.git || {}),
      repoRoot: toRepoRelativePath(REPO_ROOT),
      worktreePath: toRepoRelativePath(paths.sandboxRepoDir),
      branchName: resolvedBranch,
      baseRef,
      attachedAt: metadata.git?.attachedAt || now,
      updatedAt: now
    },
    lifecycle: {
      ...(metadata.lifecycle || {}),
      status: "branch-ready",
      lastActionAt: now
    },
    events: pushRunEvent(metadata, "branch-ready", {
      branchName: resolvedBranch,
      baseRef,
      createdThisCall
    }),
    updatedAt: now
  };

  await writeRunMetadata(paths.metadataFile, updatedMetadata);

  return {
    runId,
    branch: {
      name: resolvedBranch,
      baseRef,
      worktreePath: toRepoRelativePath(paths.sandboxRepoDir),
      createdThisCall
    }
  };
}

function resolveRunCwd(worktreePath, requestedCwd) {
  const normalizedCwd = toOptionalString(requestedCwd) || ".";
  const resolved = path.resolve(worktreePath, normalizedCwd);
  const isInside = resolved === worktreePath || resolved.startsWith(`${worktreePath}${path.sep}`);
  if (!isInside) {
    const error = new Error("Sandbox cwd escapes run worktree.");
    error.code = "INVALID_SANDBOX_CWD";
    throw error;
  }

  return resolved;
}

async function executeRunCommand(runId, options = {}) {
  const command = toOptionalString(options.command);
  if (!command) {
    const error = new Error("Sandbox command is required.");
    error.code = "INVALID_SANDBOX_COMMAND";
    throw error;
  }

  const setupBranch = options.setupBranch !== false;
  if (setupBranch) {
    await ensureRunBranch(runId, {
      branchName: options.branchName,
      baseRef: options.baseRef
    });
  }

  const paths = getRunWorkspacePaths(runId);
  const metadata = requireRunMetadata(await readRunMetadata(paths.metadataFile), runId);
  const worktreeRelativePath = toOptionalString(metadata.git?.worktreePath);
  const worktreePath = worktreeRelativePath
    ? path.resolve(REPO_ROOT, worktreeRelativePath)
    : paths.sandboxRepoDir;

  await ensureRunStructure(paths);
  const cwd = resolveRunCwd(worktreePath, options.cwd);
  const shell = toOptionalString(options.shell) || "/bin/zsh";
  const timeoutMs = Math.max(1000, toOptionalNumber(options.timeoutMs) || 120000);
  const startedAt = new Date().toISOString();

  let success = true;
  let exitCode = 0;
  let stdout = "";
  let stderr = "";

  try {
    const result = await execFileAsync(shell, ["-lc", command], {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024 * 4
    });
    stdout = result.stdout || "";
    stderr = result.stderr || "";
  } catch (error) {
    success = false;
    stdout = typeof error.stdout === "string" ? error.stdout : "";
    stderr = typeof error.stderr === "string" ? error.stderr : error.message;
    exitCode =
      typeof error.code === "number"
        ? error.code
        : typeof error.status === "number"
          ? error.status
          : 1;
  }

  const finishedAt = new Date().toISOString();
  const startedTime = Date.parse(startedAt);
  const finishedTime = Date.parse(finishedAt);
  const durationMs = Number.isNaN(startedTime) || Number.isNaN(finishedTime) ? 0 : finishedTime - startedTime;
  const logFileName = `exec-${startedAt.replace(/[:.]/g, "-")}.log`;
  const logFile = path.join(paths.logsDir, logFileName);
  const logBody = [
    `command: ${command}`,
    `shell: ${shell}`,
    `cwd: ${toRepoRelativePath(cwd)}`,
    `startedAt: ${startedAt}`,
    `finishedAt: ${finishedAt}`,
    `durationMs: ${durationMs}`,
    `exitCode: ${exitCode}`,
    "",
    "stdout:",
    stdout,
    "",
    "stderr:",
    stderr,
    ""
  ].join("\n");
  await fs.writeFile(logFile, logBody, "utf8");

  const now = new Date().toISOString();
  const updatedMetadata = {
    ...metadata,
    execution: {
      ...(metadata.execution || {}),
      commandCount: (toOptionalNumber(metadata.execution?.commandCount) || 0) + 1,
      lastCommand: {
        command,
        shell,
        cwd: toRepoRelativePath(cwd),
        startedAt,
        finishedAt,
        durationMs,
        exitCode,
        success,
        logFile: toRepoRelativePath(logFile)
      }
    },
    lifecycle: {
      ...(metadata.lifecycle || {}),
      status: success ? "running" : "failed",
      lastActionAt: now
    },
    events: pushRunEvent(metadata, "sandbox-command", {
      command,
      success,
      exitCode
    }),
    updatedAt: now
  };

  await writeRunMetadata(paths.metadataFile, updatedMetadata);

  return {
    runId,
    success,
    exitCode,
    command,
    shell,
    cwd: toRepoRelativePath(cwd),
    startedAt,
    finishedAt,
    durationMs,
    logFile: toRepoRelativePath(logFile),
    stdout: trimOutput(stdout),
    stderr: trimOutput(stderr)
  };
}

async function updateRunBacklogTask(runId, taskId, options = {}) {
  const safeTaskId = validateTaskId(taskId);
  const paths = getRunWorkspacePaths(runId);
  const metadata = requireRunMetadata(await readRunMetadata(paths.metadataFile), runId);
  const backlogProjectRoot = getRunBacklogProjectRoot(paths, metadata);
  const backlog = await editBacklogTaskForProject(backlogProjectRoot, safeTaskId, {
    status: options.status,
    appendNotes: options.appendNotes,
    appendFinalSummary: options.appendFinalSummary
  });
  const now = new Date().toISOString();
  const task = backlog.tasks.find((item) => item.id === safeTaskId) || null;
  const updatedMetadata = {
    ...metadata,
    backlog: {
      ...(metadata.backlog || {}),
      lastTaskUpdate: {
        taskId: safeTaskId,
        status: task?.status || null,
        updatedAt: now
      }
    },
    lifecycle: {
      ...(metadata.lifecycle || {}),
      status: "running",
      lastActionAt: now
    },
    events: pushRunEvent(metadata, "backlog-task-updated", {
      taskId: safeTaskId,
      status: task?.status || options.status || null
    }),
    updatedAt: now
  };

  await writeRunMetadata(paths.metadataFile, updatedMetadata);
  const syncRoot = options.syncRoot !== false ? await syncRunStatusToRootBacklog(runId) : null;

  return {
    runId,
    taskId: safeTaskId,
    task,
    summary: backlog.summary,
    syncRoot
  };
}

async function buildRunIdForProject(projectId) {
  const baseDate = new Date().toISOString().slice(0, 10);
  const projectSlug = projectId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const baseRunId = `${baseDate}-${projectSlug || "project"}`;

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

  throw new Error(`Unable to allocate runId for project ${projectId}`);
}

async function startProjectRun(projectId, options = {}) {
  const safeProjectId = validateProjectId(projectId);
  const project = await requireProject(safeProjectId);
  const resolvedRunId = toOptionalString(options.runId) || (await buildRunIdForProject(safeProjectId));
  const run = await openRunWorkspace(resolvedRunId, {
    projectId: safeProjectId,
    projectName: options.projectName,
    rootTaskId: options.rootTaskId,
    rootMilestone: options.rootMilestone,
    executionHarness: options.executionHarness,
    runtimeProvider: options.runtimeProvider,
    runtimeModel: options.runtimeModel,
    agentPreset: options.agentPreset
  });
  await appendProjectRun(safeProjectId, {
    runId: run.runId,
    startedAt: new Date().toISOString(),
    taskIds: Array.isArray(options.taskIds) ? options.taskIds : [],
    executionHarness: run.execution?.harness,
    runtimeProvider: run.execution?.provider,
    runtimeModel: run.execution?.model,
    agentPreset: run.execution?.agentPreset
  });

  return {
    projectId: safeProjectId,
    run
  };
}

async function syncRunStatusToRootBacklog(runId) {
  const paths = getRunWorkspacePaths(runId);
  const metadata = requireRunMetadata(await readRunMetadata(paths.metadataFile), runId);

  const runBacklog = await readRunBacklogForMetadata(paths, metadata);
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
  ensureRunBranch,
  executeRunCommand,
  getRun,
  openRunWorkspace,
  startProjectRun,
  syncRunStatusToRootBacklog,
  updateRunBacklogTask,
  validateRunId
};
