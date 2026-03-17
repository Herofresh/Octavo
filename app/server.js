const http = require("node:http");
const os = require("node:os");

const { readBacklogTasks } = require("./lib/backlog");
const { methodNotAllowed, notFound, sendHtml, sendJson } = require("./lib/http");
const { openRunWorkspace, startIdeaExecution, syncRunStatusToRootBacklog } = require("./lib/runs");
const { ensureWorkspaceFolders } = require("./lib/storage");

const PORT = Number.parseInt(process.env.PORT || "3000", 10);

function createHomePage(port) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Octavo Foundation</title>
  </head>
  <body>
    <h1>Octavo Foundation</h1>
    <p>Server is running on port ${port}.</p>
    <ul>
      <li><a href="/health">/health</a></li>
      <li><a href="/api/backlog">/api/backlog</a></li>
      <li>POST /api/runs/:runId/open</li>
      <li>POST /api/ideas/:ideaId/execute</li>
      <li>POST /api/runs/:runId/sync-root</li>
    </ul>
  </body>
</html>`;
}

function toOptionalParam(requestUrl, key) {
  const value = requestUrl.searchParams.get(key);
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function toBooleanParam(requestUrl, key, defaultValue) {
  const value = toOptionalParam(requestUrl, key);
  if (typeof value === "undefined") {
    return defaultValue;
  }

  return value.toLowerCase() !== "false";
}

async function routeRequest(req, res) {
  const method = req.method || "GET";
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname;
  const openRunMatch = pathname.match(/^\/api\/runs\/([A-Za-z0-9._-]+)\/open$/);
  const executeIdeaMatch = pathname.match(/^\/api\/ideas\/([A-Za-z0-9._-]+)\/execute$/);
  const syncRootMatch = pathname.match(/^\/api\/runs\/([A-Za-z0-9._-]+)\/sync-root$/);

  if (method === "POST" && openRunMatch) {
    try {
      const run = await openRunWorkspace(openRunMatch[1], {
        projectName: toOptionalParam(requestUrl, "projectName"),
        ideaId: toOptionalParam(requestUrl, "ideaId"),
        rootTaskId: toOptionalParam(requestUrl, "rootTaskId"),
        rootMilestone: toOptionalParam(requestUrl, "rootMilestone")
      });
      sendJson(res, run.created ? 201 : 200, run);
      return;
    } catch (error) {
      if (error.code === "INVALID_RUN_ID") {
        sendJson(res, 400, {
          error: "Bad Request",
          message: error.message
        });
        return;
      }

      throw error;
    }
  }

  if (method === "POST" && executeIdeaMatch) {
    try {
      const execution = await startIdeaExecution(executeIdeaMatch[1], {
        runId: toOptionalParam(requestUrl, "runId"),
        projectName: toOptionalParam(requestUrl, "projectName"),
        rootTaskId: toOptionalParam(requestUrl, "rootTaskId"),
        rootMilestone: toOptionalParam(requestUrl, "rootMilestone")
      });

      let sync = null;
      if (toBooleanParam(requestUrl, "syncRoot", true)) {
        sync = await syncRunStatusToRootBacklog(execution.run.runId);
      }

      sendJson(res, execution.run.created ? 201 : 200, {
        ...execution,
        sync
      });
      return;
    } catch (error) {
      if (error.code === "INVALID_IDEA_ID" || error.code === "INVALID_RUN_ID") {
        sendJson(res, 400, {
          error: "Bad Request",
          message: error.message
        });
        return;
      }

      throw error;
    }
  }

  if (method === "POST" && syncRootMatch) {
    try {
      const sync = await syncRunStatusToRootBacklog(syncRootMatch[1]);
      sendJson(res, 200, sync);
      return;
    } catch (error) {
      if (error.code === "RUN_NOT_FOUND") {
        sendJson(res, 404, {
          error: "Not Found",
          message: error.message
        });
        return;
      }

      if (error.code === "INVALID_RUN_ID") {
        sendJson(res, 400, {
          error: "Bad Request",
          message: error.message
        });
        return;
      }

      throw error;
    }
  }

  if (method !== "GET") {
    methodNotAllowed(res);
    return;
  }

  if (pathname === "/") {
    sendHtml(res, 200, createHomePage(PORT));
    return;
  }

  if (pathname === "/health") {
    sendJson(res, 200, {
      service: "octavo",
      status: "ok",
      hostname: os.hostname()
    });
    return;
  }

  if (pathname === "/api/backlog") {
    const backlog = await readBacklogTasks();
    sendJson(res, 200, backlog);
    return;
  }

  notFound(res);
}

async function start() {
  await ensureWorkspaceFolders();

  const server = http.createServer((req, res) => {
    routeRequest(req, res).catch((error) => {
      sendJson(res, 500, {
        error: "Internal Server Error",
        message: error.message
      });
    });
  });

  server.listen(PORT, () => {
    process.stdout.write(`Octavo server listening on http://localhost:${PORT}\n`);
  });
}

start().catch((error) => {
  process.stderr.write(`Failed to start server: ${error.message}\n`);
  process.exit(1);
});
