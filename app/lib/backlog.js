const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_BACKLOG_DIR_NAME = "backlog";
const BACKLOG_DIR = path.join(REPO_ROOT, DEFAULT_BACKLOG_DIR_NAME);
const BACKLOG_CONFIG_FILE = path.join(BACKLOG_DIR, "config.yml");
const LOCAL_BACKLOG_BIN = path.join(REPO_ROOT, "node_modules", ".bin", "backlog");

const SECTION_PATTERN = /^([A-Za-z ]+):$/;
const TASK_PATTERN = /^\s+([A-Z]+-\d+)\s+-\s+(.+)$/;

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
    return await execFileAsync(LOCAL_BACKLOG_BIN, args, {
      cwd,
      maxBuffer: 1024 * 1024
    });
  } catch (primaryError) {
    try {
      return await execFileAsync("npx", ["--yes", "backlog", ...args], {
        cwd,
        maxBuffer: 1024 * 1024
      });
    } catch (fallbackError) {
      const primaryMessage = primaryError.stderr || primaryError.stdout || primaryError.message;
      const fallbackMessage =
        fallbackError.stderr || fallbackError.stdout || fallbackError.message;
      throw new Error(
        `Unable to execute backlog command.\nPrimary: ${primaryMessage}\nFallback: ${fallbackMessage}`
      );
    }
  }
}

async function runBacklogCommand(args) {
  return runBacklogCommandFromCwd(REPO_ROOT, args);
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

module.exports = {
  BACKLOG_CONFIG_FILE,
  BACKLOG_DIR,
  ensureBacklogProject,
  getBacklogProjectPaths,
  parseTaskListPlainText,
  readBacklogTasks,
  readBacklogTasksForProject
};
