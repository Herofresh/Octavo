const http = require("node:http");
const os = require("node:os");

const { readBacklogTasks } = require("./lib/backlog");
const { methodNotAllowed, notFound, sendHtml, sendJson } = require("./lib/http");
const { openRunWorkspace } = require("./lib/runs");
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
    </ul>
  </body>
</html>`;
}

async function routeRequest(req, res) {
  const method = req.method || "GET";
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname;
  const openRunMatch = pathname.match(/^\/api\/runs\/([A-Za-z0-9._-]+)\/open$/);

  if (method === "POST" && openRunMatch) {
    try {
      const run = await openRunWorkspace(openRunMatch[1], {
        projectName: requestUrl.searchParams.get("projectName") || undefined
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
