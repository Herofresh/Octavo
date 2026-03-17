const http = require("node:http");
const os = require("node:os");

const { readBacklogTasks } = require("./lib/backlog");
const { methodNotAllowed, notFound, sendHtml, sendJson } = require("./lib/http");
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
    </ul>
  </body>
</html>`;
}

async function routeRequest(req, res) {
  const method = req.method || "GET";
  const url = req.url || "/";

  if (method !== "GET") {
    methodNotAllowed(res);
    return;
  }

  if (url === "/") {
    sendHtml(res, 200, createHomePage(PORT));
    return;
  }

  if (url === "/health") {
    sendJson(res, 200, {
      service: "octavo",
      status: "ok",
      hostname: os.hostname()
    });
    return;
  }

  if (url === "/api/backlog") {
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
