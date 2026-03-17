const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const BACKLOG_DIR = path.join(REPO_ROOT, "backlog");
const BACKLOG_CONFIG_FILE = path.join(BACKLOG_DIR, "config.yml");
const LOCAL_BACKLOG_BIN = path.join(REPO_ROOT, "node_modules", ".bin", "backlog");

const SECTION_PATTERN = /^([A-Za-z ]+):$/;
const TASK_PATTERN = /^\s+([A-Z]+-\d+)\s+-\s+(.+)$/;

function normalizeStatus(status) {
  return status.trim().toLowerCase();
}

function parseTaskListPlainText(output) {
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

  return {
    available: true,
    source: "backlog.md",
    projectDir: BACKLOG_DIR,
    configFile: BACKLOG_CONFIG_FILE,
    summary: {
      total: tasks.length,
      done,
      pending: tasks.length - done,
      byStatus
    },
    tasks
  };
}

async function runBacklogCommand(args) {
  try {
    return await execFileAsync(LOCAL_BACKLOG_BIN, args, {
      cwd: REPO_ROOT,
      maxBuffer: 1024 * 1024
    });
  } catch (primaryError) {
    try {
      return await execFileAsync("npx", ["--yes", "backlog", ...args], {
        cwd: REPO_ROOT,
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

async function readBacklogTasks() {
  try {
    await fs.access(BACKLOG_CONFIG_FILE);
  } catch {
    return {
      available: false,
      source: "backlog.md",
      projectDir: BACKLOG_DIR,
      configFile: BACKLOG_CONFIG_FILE,
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

  const { stdout } = await runBacklogCommand(["task", "list", "--plain"]);

  if (stdout.includes("No tasks found.")) {
    return {
      available: true,
      source: "backlog.md",
      projectDir: BACKLOG_DIR,
      configFile: BACKLOG_CONFIG_FILE,
      summary: {
        total: 0,
        done: 0,
        pending: 0,
        byStatus: {}
      },
      tasks: []
    };
  }

  return parseTaskListPlainText(stdout);
}

module.exports = {
  BACKLOG_CONFIG_FILE,
  BACKLOG_DIR,
  parseTaskListPlainText,
  readBacklogTasks
};
