const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile, spawn } = require("node:child_process");
const { promisify } = require("node:util");
const { toOptionalString } = require("./normalize");

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_BACKLOG_DIR_NAME = "backlog";
const BACKLOG_DIR = path.join(REPO_ROOT, DEFAULT_BACKLOG_DIR_NAME);
const BACKLOG_CONFIG_FILE = path.join(BACKLOG_DIR, "config.yml");
const LOCAL_BACKLOG_BIN = path.join(REPO_ROOT, "node_modules", ".bin", "backlog");
const LOCAL_BACKLOG_CLI = path.join(REPO_ROOT, "node_modules", "backlog.md", "cli.js");
const DEFAULT_BACKLOG_BROWSER_PORT = Number.parseInt(
  process.env.OCTAVO_BACKLOG_BROWSER_PORT || "6420",
  10
);

const SECTION_PATTERN = /^([A-Za-z ]+):$/;
const TASK_PATTERN = /^\s+([A-Z]+-\d+)\s+-\s+(.+)$/;
const MAX_BROWSER_LOG_LINES = 200;

let backlogBrowserProcess = null;
let backlogBrowserSession = null;
let backlogBrowserLogs = [];

function normalizeStatus(status) {
  return status.trim().toLowerCase();
}

function parseTaskListPlainText(output, options = {}) {
  const lines = output.split(/\r?\n/);
  const tasks = [];
  const byStatus = {};
  let currentStatus = null;

  for (const line of lines) {
    const sectionMatch = line.match(SECTION_PATTERN);
    if (sectionMatch) {
      currentStatus = sectionMatch[1].trim();
      continue;
    }

    const taskMatch = line.match(TASK_PATTERN);
    if (!taskMatch || !currentStatus) {
      continue;
    }

    const statusKey = normalizeStatus(currentStatus);
    byStatus[currentStatus] = (byStatus[currentStatus] || 0) + 1;
    tasks.push({
      id: taskMatch[1],
      title: taskMatch[2].trim(),
      status: currentStatus,
      done: statusKey === "done"
    });
  }

  const done = tasks.filter((task) => task.done).length;
  const projectDir = options.projectDir || BACKLOG_DIR;
  const configFile = options.configFile || BACKLOG_CONFIG_FILE;

  return {
    available: true,
    source: "backlog.md",
    projectDir,
    configFile,
    summary: {
      total: tasks.length,
      done,
      pending: tasks.length - done,
      byStatus
    },
    tasks
  };
}

function getBacklogProjectPaths(projectRoot, backlogDirName = DEFAULT_BACKLOG_DIR_NAME) {
  const projectDir = path.join(projectRoot, backlogDirName);
  const configFile = path.join(projectDir, "config.yml");

  return {
    projectRoot,
    projectDir,
    configFile
  };
}

async function fileExists(absolutePath) {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function runBacklogCommandFromCwd(cwd, args) {
  try {
    return await execFileAsync(process.execPath, [LOCAL_BACKLOG_CLI, ...args], {
      cwd,
      maxBuffer: 1024 * 1024
    });
  } catch (cliError) {
    try {
      return await execFileAsync(LOCAL_BACKLOG_BIN, args, {
        cwd,
        maxBuffer: 1024 * 1024
      });
    } catch (binError) {
      try {
        return await execFileAsync("npx", ["--yes", "backlog", ...args], {
          cwd,
          maxBuffer: 1024 * 1024
        });
      } catch (npxError) {
        const cliMessage = cliError.stderr || cliError.stdout || cliError.message;
        const binMessage = binError.stderr || binError.stdout || binError.message;
        const npxMessage = npxError.stderr || npxError.stdout || npxError.message;
        throw new Error(
          `Unable to execute backlog command.\nCLI: ${cliMessage}\nBin: ${binMessage}\nNpx: ${npxMessage}`
        );
      }
    }
  }
}

async function runBacklogCommand(args) {
  return runBacklogCommandFromCwd(REPO_ROOT, args);
}

function toTaskStatus(value) {
  const normalized = toOptionalString(value);
  if (!normalized) {
    return null;
  }

  const lowered = normalized.toLowerCase();
  if (lowered === "todo" || lowered === "to-do" || lowered === "to do") {
    return "To Do";
  }

  if (lowered === "in progress" || lowered === "in-progress" || lowered === "doing") {
    return "In Progress";
  }

  if (lowered === "done" || lowered === "complete" || lowered === "completed") {
    return "Done";
  }

  return normalized;
}

function validateTaskId(taskId) {
  if (typeof taskId !== "string" || !/^[A-Z]+-\d+$/.test(taskId)) {
    const error = new Error("Invalid taskId. Use format like TASK-10.");
    error.code = "INVALID_TASK_ID";
    throw error;
  }

  return taskId;
}

async function editBacklogTaskForProject(projectRoot, taskId, options = {}) {
  const safeTaskId = validateTaskId(taskId);
  const status = toTaskStatus(options.status);
  const appendNotes = toOptionalString(options.appendNotes);
  const appendFinalSummary = toOptionalString(options.appendFinalSummary);
  const args = ["task", "edit", safeTaskId];

  if (status) {
    args.push("--status", status);
  }

  if (appendNotes) {
    args.push("--append-notes", appendNotes);
  }

  if (appendFinalSummary) {
    args.push("--append-final-summary", appendFinalSummary);
  }

  if (args.length === 3) {
    const error = new Error("At least one update field is required.");
    error.code = "INVALID_BACKLOG_UPDATE";
    throw error;
  }

  await runBacklogCommandFromCwd(projectRoot, args);
  return readBacklogTasksForProject(projectRoot);
}

async function ensureBacklogProject(projectRoot, options = {}) {
  const backlogDirName = options.backlogDirName || DEFAULT_BACKLOG_DIR_NAME;
  const { projectDir, configFile } = getBacklogProjectPaths(projectRoot, backlogDirName);
  const isInitialized = await fileExists(configFile);

  if (!isInitialized) {
    const projectName =
      typeof options.projectName === "string" && options.projectName.trim()
        ? options.projectName.trim()
        : path.basename(projectRoot);

    await runBacklogCommandFromCwd(projectRoot, [
      "init",
      "--defaults",
      projectName,
      "--backlog-dir",
      backlogDirName,
      "--config-location",
      "folder",
      "--check-branches",
      "false",
      "--include-remote",
      "false",
      "--auto-open-browser",
      "false"
    ]);
  }

  return {
    available: true,
    projectDir,
    configFile,
    initialized: !isInitialized
  };
}

async function readBacklogTasksForProject(projectRoot, options = {}) {
  const backlogDirName = options.backlogDirName || DEFAULT_BACKLOG_DIR_NAME;
  const { projectDir, configFile } = getBacklogProjectPaths(projectRoot, backlogDirName);

  if (!(await fileExists(configFile))) {
    return {
      available: false,
      source: "backlog.md",
      projectDir,
      configFile,
      summary: {
        total: 0,
        done: 0,
        pending: 0,
        byStatus: {}
      },
      tasks: [],
      warnings: ["Backlog.md project is not initialized. Run `npx backlog init`."]
    };
  }

  const { stdout } = await runBacklogCommandFromCwd(projectRoot, ["task", "list", "--plain"]);

  if (stdout.includes("No tasks found.")) {
    return {
      available: true,
      source: "backlog.md",
      projectDir,
      configFile,
      summary: {
        total: 0,
        done: 0,
        pending: 0,
        byStatus: {}
      },
      tasks: []
    };
  }

  return parseTaskListPlainText(stdout, { projectDir, configFile });
}

async function readBacklogTasks() {
  return readBacklogTasksForProject(REPO_ROOT);
}

function stripOverviewPreamble(output) {
  const lines = String(output || "").split(/\r?\n/);
  const startIndex = lines.findIndex((line) => /^.*Project Overview/.test(line));
  if (startIndex < 0) {
    return lines.join("\n").trim();
  }

  return lines.slice(startIndex).join("\n").trim();
}

async function readBacklogOverview() {
  const args = ["overview"];

  const { stdout, stderr } = await runBacklogCommand(args);
  const output = `${stdout || ""}${stderr || ""}`;
  return {
    source: "backlog.md",
    generatedAt: new Date().toISOString(),
    command: `backlog ${args.join(" ")}`,
    output: stripOverviewPreamble(output)
  };
}

function appendBrowserLog(line) {
  const normalized = String(line || "").replace(/\r/g, "").split("\n").filter(Boolean);
  if (normalized.length === 0) {
    return;
  }

  backlogBrowserLogs = [...backlogBrowserLogs, ...normalized].slice(-MAX_BROWSER_LOG_LINES);
}

function isBacklogBrowserRunning() {
  return Boolean(backlogBrowserProcess && backlogBrowserProcess.exitCode === null);
}

function getBacklogBrowserStatus() {
  if (isBacklogBrowserRunning()) {
    return {
      running: true,
      pid: backlogBrowserProcess.pid || null,
      port: backlogBrowserSession?.port || null,
      url: backlogBrowserSession?.url || null,
      startedAt: backlogBrowserSession?.startedAt || null,
      command: backlogBrowserSession?.command || null,
      logs: backlogBrowserLogs
    };
  }

  return {
    running: false,
    pid: null,
    port: backlogBrowserSession?.port || null,
    url: backlogBrowserSession?.url || null,
    startedAt: backlogBrowserSession?.startedAt || null,
    stoppedAt: backlogBrowserSession?.stoppedAt || null,
    command: backlogBrowserSession?.command || null,
    logs: backlogBrowserLogs
  };
}

async function ensureBacklogBrowser(options = {}) {
  const port = Number.parseInt(String(options.port || DEFAULT_BACKLOG_BROWSER_PORT), 10);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    const error = new Error("Invalid backlog browser port.");
    error.code = "INVALID_BACKLOG_BROWSER_PORT";
    throw error;
  }

  if (isBacklogBrowserRunning()) {
    if (backlogBrowserSession?.port === port) {
      return getBacklogBrowserStatus();
    }

    backlogBrowserProcess.kill("SIGTERM");
  }

  backlogBrowserLogs = [];
  const args = [LOCAL_BACKLOG_CLI, "browser", "--no-open", "--port", String(port)];
  const child = spawn(process.execPath, args, {
    cwd: REPO_ROOT,
    stdio: ["ignore", "pipe", "pipe"]
  });
  backlogBrowserProcess = child;
  backlogBrowserSession = {
    port,
    url: `http://127.0.0.1:${port}`,
    startedAt: new Date().toISOString(),
    stoppedAt: null,
    command: `${process.execPath} ${args.join(" ")}`
  };

  child.stdout.on("data", (chunk) => {
    appendBrowserLog(chunk.toString("utf8"));
  });
  child.stderr.on("data", (chunk) => {
    appendBrowserLog(chunk.toString("utf8"));
  });
  child.on("error", (error) => {
    appendBrowserLog(`process error: ${error.message}`);
  });
  child.on("exit", (code, signal) => {
    backlogBrowserProcess = null;
    backlogBrowserSession = {
      ...(backlogBrowserSession || {}),
      stoppedAt: new Date().toISOString()
    };
    appendBrowserLog(`process exited (code=${code}, signal=${signal || "none"})`);
  });

  await new Promise((resolve) => {
    setTimeout(resolve, 350);
  });

  return getBacklogBrowserStatus();
}

module.exports = {
  BACKLOG_CONFIG_FILE,
  BACKLOG_DIR,
  editBacklogTaskForProject,
  ensureBacklogBrowser,
  ensureBacklogProject,
  getBacklogBrowserStatus,
  getBacklogProjectPaths,
  parseTaskListPlainText,
  readBacklogOverview,
  readBacklogTasks,
  readBacklogTasksForProject
};
