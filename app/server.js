const http = require("node:http");
const os = require("node:os");
const fs = require("node:fs/promises");
const path = require("node:path");

const { loadEnvFiles } = require("./lib/env");
const {
  ensureBacklogBrowser,
  getBacklogBrowserStatus,
  readBacklogOverview,
  readBacklogTasks
} = require("./lib/backlog");
const { methodNotAllowed, notFound, sendHtml, sendJson } = require("./lib/http");
const {
  applyIdeaRefinement,
  appendIdeaConversation,
  chatIdea,
  createIdea,
  deleteIdea,
  getIdea,
  kickoffIdeaDocument,
  listIdeas,
  markIdeaProjectSpawned,
  setIdeaRuntimeProfile,
  updateIdeaDocument
} = require("./lib/ideas");
const { listAgentPresets } = require("./lib/agents");
const { createProjectFromIdea, getProject, listProjects } = require("./lib/projects");
const {
  ensureRunBranch,
  executeRunCommand,
  getRun,
  openRunWorkspace,
  startProjectRun,
  syncRunStatusToRootBacklog,
  updateRunBacklogTask
} = require("./lib/runs");
const { getDefaultRuntimeConfig, listRuntimeProviders, runRuntimeCompletion } = require("./lib/runtime");
const { ensureWorkspaceFolders } = require("./lib/storage");

loadEnvFiles();

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const UI_ROOT = path.join(__dirname, "lib", "ui");
const UI_CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8"
};

function resolveUiPath(relativePath) {
  const safeRelativePath = String(relativePath || "").replace(/^\/+/, "");
  const absolutePath = path.resolve(UI_ROOT, safeRelativePath);
  const isInsideUiRoot = absolutePath === UI_ROOT || absolutePath.startsWith(`${UI_ROOT}${path.sep}`);
  if (!isInsideUiRoot) {
    const error = new Error("UI asset path escapes UI root.");
    error.code = "INVALID_UI_ASSET";
    throw error;
  }
  return absolutePath;
}

async function readUiAsset(relativePath) {
  const absolutePath = resolveUiPath(relativePath);
  const extension = path.extname(absolutePath).toLowerCase();
  const contentType = UI_CONTENT_TYPES[extension] || "application/octet-stream";
  const content = await fs.readFile(absolutePath);
  return {
    content,
    contentType
  };
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

function toBooleanValue(value, defaultValue) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.trim().toLowerCase() !== "false";
  }

  return defaultValue;
}

async function readJsonBody(req) {
  const chunks = [];
  let totalBytes = 0;
  const maxBytes = 1024 * 1024;

  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      const error = new Error("Request body too large. Maximum size is 1MB.");
      error.code = "REQUEST_BODY_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Invalid JSON body.");
    error.code = "INVALID_JSON_BODY";
    throw error;
  }
}

async function routeRequest(req, res) {
  const method = req.method || "GET";
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname;
  const ideaMatch = pathname.match(/^\/api\/ideas\/([A-Za-z0-9._-]+)$/);
  const ideaDocumentMatch = pathname.match(/^\/api\/ideas\/([A-Za-z0-9._-]+)\/document$/);
  const ideaConversationMatch = pathname.match(/^\/api\/ideas\/([A-Za-z0-9._-]+)\/conversation$/);
  const ideaRefinementMatch = pathname.match(/^\/api\/ideas\/([A-Za-z0-9._-]+)\/refinement$/);
  const ideaRuntimeMatch = pathname.match(/^\/api\/ideas\/([A-Za-z0-9._-]+)\/runtime$/);
  const ideaKickoffMatch = pathname.match(/^\/api\/ideas\/([A-Za-z0-9._-]+)\/kickoff$/);
  const ideaChatMatch = pathname.match(/^\/api\/ideas\/([A-Za-z0-9._-]+)\/chat$/);
  const projectMatch = pathname.match(/^\/api\/projects\/([A-Za-z0-9._-]+)$/);
  const projectRunStartMatch = pathname.match(/^\/api\/projects\/([A-Za-z0-9._-]+)\/runs$/);
  const runMatch = pathname.match(/^\/api\/runs\/([A-Za-z0-9._-]+)$/);
  const openRunMatch = pathname.match(/^\/api\/runs\/([A-Za-z0-9._-]+)\/open$/);
  const branchRunMatch = pathname.match(/^\/api\/runs\/([A-Za-z0-9._-]+)\/branch$/);
  const sandboxExecMatch = pathname.match(/^\/api\/runs\/([A-Za-z0-9._-]+)\/sandbox\/exec$/);
  const backlogTaskUpdateMatch = pathname.match(
    /^\/api\/runs\/([A-Za-z0-9._-]+)\/backlog\/tasks\/([A-Z]+-\d+)$/
  );
  const syncRootMatch = pathname.match(/^\/api\/runs\/([A-Za-z0-9._-]+)\/sync-root$/);
  const runtimeCompletePath = pathname === "/api/runtime/complete";

  if (method === "POST" && pathname === "/api/ideas") {
    try {
      const payload = await readJsonBody(req);
      const idea = await createIdea(payload);
      sendJson(res, 201, idea);
      return;
    } catch (error) {
      if (
        error.code === "INVALID_JSON_BODY" ||
        error.code === "REQUEST_BODY_TOO_LARGE" ||
        error.code === "INVALID_IDEA_ID" ||
        error.code === "INVALID_IDEA_TITLE" ||
        error.code === "INVALID_IDEA_RUNTIME"
      ) {
        sendJson(res, 400, {
          error: "Bad Request",
          message: error.message
        });
        return;
      }

      if (error.code === "IDEA_ALREADY_EXISTS") {
        sendJson(res, 409, {
          error: "Conflict",
          message: error.message
        });
        return;
      }

      throw error;
    }
  }

  if (method === "DELETE" && ideaMatch) {
    try {
      const deleted = await deleteIdea(ideaMatch[1]);
      sendJson(res, 200, deleted);
      return;
    } catch (error) {
      if (error.code === "INVALID_IDEA_ID") {
        sendJson(res, 400, {
          error: "Bad Request",
          message: error.message
        });
        return;
      }

      if (error.code === "IDEA_NOT_FOUND") {
        sendJson(res, 404, {
          error: "Not Found",
          message: error.message
        });
        return;
      }

      throw error;
    }
  }

  if (method === "POST" && ideaDocumentMatch) {
    try {
      const payload = await readJsonBody(req);
      const idea = await updateIdeaDocument(ideaDocumentMatch[1], payload);
      sendJson(res, 200, idea);
      return;
    } catch (error) {
      if (
        error.code === "INVALID_JSON_BODY" ||
        error.code === "REQUEST_BODY_TOO_LARGE" ||
        error.code === "INVALID_IDEA_ID" ||
        error.code === "INVALID_IDEA_RUNTIME"
      ) {
        sendJson(res, 400, {
          error: "Bad Request",
          message: error.message
        });
        return;
      }

      if (error.code === "IDEA_NOT_FOUND") {
        sendJson(res, 404, {
          error: "Not Found",
          message: error.message
        });
        return;
      }

      throw error;
    }
  }

  if (method === "POST" && ideaConversationMatch) {
    try {
      const payload = await readJsonBody(req);
      const update = await appendIdeaConversation(ideaConversationMatch[1], payload);
      sendJson(res, 200, update);
      return;
    } catch (error) {
      if (
        error.code === "INVALID_JSON_BODY" ||
        error.code === "REQUEST_BODY_TOO_LARGE" ||
        error.code === "INVALID_IDEA_ID" ||
        error.code === "INVALID_IDEA_CONVERSATION"
      ) {
        sendJson(res, 400, {
          error: "Bad Request",
          message: error.message
        });
        return;
      }

      if (error.code === "IDEA_NOT_FOUND") {
        sendJson(res, 404, {
          error: "Not Found",
          message: error.message
        });
        return;
      }

      throw error;
    }
  }

  if (method === "POST" && ideaRefinementMatch) {
    try {
      const payload = await readJsonBody(req);
      const refinement = await applyIdeaRefinement(ideaRefinementMatch[1], payload);
      sendJson(res, 200, refinement);
      return;
    } catch (error) {
      if (
        error.code === "INVALID_JSON_BODY" ||
        error.code === "REQUEST_BODY_TOO_LARGE" ||
        error.code === "INVALID_IDEA_ID" ||
        error.code === "INVALID_IDEA_REFINEMENT"
      ) {
        sendJson(res, 400, {
          error: "Bad Request",
          message: error.message
        });
        return;
      }

      if (error.code === "IDEA_NOT_FOUND") {
        sendJson(res, 404, {
          error: "Not Found",
          message: error.message
        });
        return;
      }

      throw error;
    }
  }

  if (method === "POST" && ideaRuntimeMatch) {
    try {
      const payload = await readJsonBody(req);
      const update = await setIdeaRuntimeProfile(ideaRuntimeMatch[1], payload);
      sendJson(res, 200, update);
      return;
    } catch (error) {
      if (
        error.code === "INVALID_JSON_BODY" ||
        error.code === "REQUEST_BODY_TOO_LARGE" ||
        error.code === "INVALID_IDEA_ID" ||
        error.code === "INVALID_IDEA_RUNTIME"
      ) {
        sendJson(res, 400, {
          error: "Bad Request",
          message: error.message
        });
        return;
      }

      if (error.code === "IDEA_NOT_FOUND") {
        sendJson(res, 404, {
          error: "Not Found",
          message: error.message
        });
        return;
      }

      throw error;
    }
  }

  if (method === "POST" && ideaKickoffMatch) {
    try {
      const payload = await readJsonBody(req);
      const kickoff = await kickoffIdeaDocument(ideaKickoffMatch[1], payload);
      sendJson(res, 200, kickoff);
      return;
    } catch (error) {
      if (
        error.code === "INVALID_JSON_BODY" ||
        error.code === "REQUEST_BODY_TOO_LARGE" ||
        error.code === "INVALID_IDEA_ID" ||
        error.code === "INVALID_IDEA_RUNTIME" ||
        error.code === "INVALID_IDEA_REFINEMENT" ||
        error.code === "INVALID_RUNTIME_PROMPT" ||
        error.code === "RUNTIME_PROVIDER_NOT_FOUND" ||
        error.code === "RUNTIME_PROVIDER_NOT_CONFIGURED" ||
        error.code === "RUNTIME_COMPLETION_FAILED"
      ) {
        sendJson(res, 400, {
          error: "Bad Request",
          message: error.message
        });
        return;
      }

      if (error.code === "IDEA_NOT_FOUND") {
        sendJson(res, 404, {
          error: "Not Found",
          message: error.message
        });
        return;
      }

      throw error;
    }
  }

  if (method === "POST" && ideaChatMatch) {
    try {
      const payload = await readJsonBody(req);
      const chat = await chatIdea(ideaChatMatch[1], payload);
      sendJson(res, 200, chat);
      return;
    } catch (error) {
      if (
        error.code === "INVALID_JSON_BODY" ||
        error.code === "REQUEST_BODY_TOO_LARGE" ||
        error.code === "INVALID_IDEA_ID" ||
        error.code === "INVALID_IDEA_CHAT" ||
        error.code === "INVALID_IDEA_RUNTIME" ||
        error.code === "INVALID_RUNTIME_PROMPT" ||
        error.code === "RUNTIME_PROVIDER_NOT_FOUND" ||
        error.code === "RUNTIME_PROVIDER_NOT_CONFIGURED" ||
        error.code === "RUNTIME_COMPLETION_FAILED"
      ) {
        sendJson(res, 400, {
          error: "Bad Request",
          message: error.message
        });
        return;
      }

      if (error.code === "IDEA_NOT_FOUND") {
        sendJson(res, 404, {
          error: "Not Found",
          message: error.message
        });
        return;
      }

      throw error;
    }
  }

  if (method === "POST" && pathname === "/api/projects") {
    try {
      const payload = await readJsonBody(req);
      const sourceIdeaId = payload.ideaId;
      const idea = await getIdea(sourceIdeaId);
      if (!idea) {
        sendJson(res, 404, {
          error: "Not Found",
          message: `Idea not found: ${sourceIdeaId}`
        });
        return;
      }

      const project = await createProjectFromIdea(idea, {
        id: payload.id,
        title: payload.title,
        projectName: payload.projectName,
        executionHarness: payload.executionHarness,
        runtimeProvider: payload.runtimeProvider,
        runtimeModel: payload.runtimeModel,
        agentPreset: payload.agentPreset
      });
      const updatedIdea = await markIdeaProjectSpawned(idea.id, {
        projectId: project.id
      });
      sendJson(res, 201, {
        project,
        idea: updatedIdea
      });
      return;
    } catch (error) {
      if (
        error.code === "INVALID_JSON_BODY" ||
        error.code === "REQUEST_BODY_TOO_LARGE" ||
        error.code === "INVALID_PROJECT_ID" ||
        error.code === "INVALID_SOURCE_IDEA" ||
        error.code === "INVALID_IDEA_ID"
      ) {
        sendJson(res, 400, {
          error: "Bad Request",
          message: error.message
        });
        return;
      }

      if (error.code === "PROJECT_ALREADY_EXISTS") {
        sendJson(res, 409, {
          error: "Conflict",
          message: error.message
        });
        return;
      }

      throw error;
    }
  }

  if (method === "POST" && projectRunStartMatch) {
    try {
      const payload = await readJsonBody(req);
      const execution = await startProjectRun(projectRunStartMatch[1], {
        runId: payload.runId,
        projectName: payload.projectName,
        rootTaskId: payload.rootTaskId,
        rootMilestone: payload.rootMilestone,
        taskIds: Array.isArray(payload.taskIds) ? payload.taskIds : [],
        executionHarness: payload.executionHarness,
        runtimeProvider: payload.runtimeProvider,
        runtimeModel: payload.runtimeModel,
        agentPreset: payload.agentPreset
      });

      let sync = null;
      if (toBooleanValue(payload.syncRoot, true)) {
        sync = await syncRunStatusToRootBacklog(execution.run.runId);
      }

      sendJson(res, execution.run.created ? 201 : 200, {
        ...execution,
        sync
      });
      return;
    } catch (error) {
      if (
        error.code === "INVALID_JSON_BODY" ||
        error.code === "REQUEST_BODY_TOO_LARGE" ||
        error.code === "INVALID_RUN_ID" ||
        error.code === "INVALID_PROJECT_ID"
      ) {
        sendJson(res, 400, {
          error: "Bad Request",
          message: error.message
        });
        return;
      }

      if (error.code === "PROJECT_NOT_FOUND") {
        sendJson(res, 404, {
          error: "Not Found",
          message: error.message
        });
        return;
      }

      throw error;
    }
  }

  if (method === "POST" && runtimeCompletePath) {
    try {
      const payload = await readJsonBody(req);
      const completion = await runRuntimeCompletion(payload);
      sendJson(res, 200, completion);
      return;
    } catch (error) {
      if (error.code === "INVALID_JSON_BODY" || error.code === "REQUEST_BODY_TOO_LARGE") {
        sendJson(res, 400, {
          error: "Bad Request",
          message: error.message
        });
        return;
      }

      if (error.code === "INVALID_RUNTIME_PROMPT" || error.code === "RUNTIME_PROVIDER_NOT_FOUND") {
        sendJson(res, 400, {
          error: "Bad Request",
          message: error.message
        });
        return;
      }

      if (
        error.code === "RUNTIME_PROVIDER_NOT_CONFIGURED" ||
        error.code === "RUNTIME_COMPLETION_FAILED"
      ) {
        sendJson(res, 400, {
          error: "Bad Request",
          message: error.message
        });
        return;
      }

      throw error;
    }
  }

  if (method === "POST" && openRunMatch) {
    try {
      const run = await openRunWorkspace(openRunMatch[1], {
        projectId: toOptionalParam(requestUrl, "projectId"),
        projectName: toOptionalParam(requestUrl, "projectName"),
        rootTaskId: toOptionalParam(requestUrl, "rootTaskId"),
        rootMilestone: toOptionalParam(requestUrl, "rootMilestone"),
        executionHarness: toOptionalParam(requestUrl, "executionHarness"),
        runtimeProvider: toOptionalParam(requestUrl, "runtimeProvider"),
        runtimeModel: toOptionalParam(requestUrl, "runtimeModel"),
        agentPreset: toOptionalParam(requestUrl, "agentPreset")
      });
      sendJson(res, run.created ? 201 : 200, run);
      return;
    } catch (error) {
      if (
        error.code === "INVALID_RUN_ID" ||
        error.code === "INVALID_PROJECT_ID" ||
        error.code === "RUN_PROJECT_NOT_SET"
      ) {
        sendJson(res, 400, {
          error: "Bad Request",
          message: error.message
        });
        return;
      }

      throw error;
    }
  }

  if (method === "POST" && branchRunMatch) {
    try {
      const payload = await readJsonBody(req);
      const branch = await ensureRunBranch(branchRunMatch[1], {
        branchName: payload.branchName,
        baseRef: payload.baseRef
      });
      sendJson(res, 200, branch);
      return;
    } catch (error) {
      if (
        error.code === "INVALID_JSON_BODY" ||
        error.code === "REQUEST_BODY_TOO_LARGE" ||
        error.code === "INVALID_RUN_ID"
      ) {
        sendJson(res, 400, {
          error: "Bad Request",
          message: error.message
        });
        return;
      }

      if (error.code === "RUN_NOT_FOUND") {
        sendJson(res, 404, {
          error: "Not Found",
          message: error.message
        });
        return;
      }

      throw error;
    }
  }

  if (method === "POST" && sandboxExecMatch) {
    try {
      const payload = await readJsonBody(req);
      const execution = await executeRunCommand(sandboxExecMatch[1], {
        command: payload.command,
        cwd: payload.cwd,
        shell: payload.shell,
        timeoutMs: payload.timeoutMs,
        setupBranch: toBooleanValue(payload.setupBranch, true),
        branchName: payload.branchName,
        baseRef: payload.baseRef
      });
      sendJson(res, execution.success ? 200 : 422, execution);
      return;
    } catch (error) {
      if (
        error.code === "INVALID_JSON_BODY" ||
        error.code === "REQUEST_BODY_TOO_LARGE" ||
        error.code === "INVALID_RUN_ID" ||
        error.code === "INVALID_SANDBOX_COMMAND" ||
        error.code === "INVALID_SANDBOX_CWD"
      ) {
        sendJson(res, 400, {
          error: "Bad Request",
          message: error.message
        });
        return;
      }

      if (error.code === "RUN_NOT_FOUND") {
        sendJson(res, 404, {
          error: "Not Found",
          message: error.message
        });
        return;
      }

      throw error;
    }
  }

  if (method === "POST" && backlogTaskUpdateMatch) {
    try {
      const payload = await readJsonBody(req);
      const update = await updateRunBacklogTask(backlogTaskUpdateMatch[1], backlogTaskUpdateMatch[2], {
        status: payload.status,
        appendNotes: payload.appendNotes,
        appendFinalSummary: payload.appendFinalSummary,
        syncRoot: toBooleanValue(payload.syncRoot, true)
      });
      sendJson(res, 200, update);
      return;
    } catch (error) {
      if (
        error.code === "INVALID_JSON_BODY" ||
        error.code === "REQUEST_BODY_TOO_LARGE" ||
        error.code === "INVALID_RUN_ID" ||
        error.code === "INVALID_TASK_ID" ||
        error.code === "INVALID_BACKLOG_UPDATE" ||
        error.code === "RUN_PROJECT_NOT_SET"
      ) {
        sendJson(res, 400, {
          error: "Bad Request",
          message: error.message
        });
        return;
      }

      if (error.code === "RUN_NOT_FOUND") {
        sendJson(res, 404, {
          error: "Not Found",
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

      if (error.code === "RUN_PROJECT_NOT_SET") {
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

  if (pathname.startsWith("/ui/")) {
    try {
      const { content, contentType } = await readUiAsset(pathname.slice("/ui/".length));
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
      return;
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "INVALID_UI_ASSET") {
        notFound(res);
        return;
      }
      throw error;
    }
  }

  if (pathname === "/") {
    const home = await readUiAsset("home.html");
    sendHtml(res, 200, home.content.toString("utf8"));
    return;
  }

  if (pathname === "/ideas") {
    const ideas = await readUiAsset("ideas.html");
    sendHtml(res, 200, ideas.content.toString("utf8"));
    return;
  }

  if (pathname === "/projects") {
    const projects = await readUiAsset("projects.html");
    sendHtml(res, 200, projects.content.toString("utf8"));
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

  if (pathname === "/api/backlog/overview") {
    const overview = await readBacklogOverview();
    sendJson(res, 200, overview);
    return;
  }

  if (pathname === "/api/backlog/browser") {
    const ensure = toBooleanParam(requestUrl, "ensure", true);
    if (ensure) {
      const browser = await ensureBacklogBrowser({
        port: toOptionalParam(requestUrl, "port")
      });
      sendJson(res, 200, browser);
      return;
    }

    sendJson(res, 200, getBacklogBrowserStatus());
    return;
  }

  if (pathname === "/api/ideas") {
    const ideas = await listIdeas();
    sendJson(res, 200, ideas);
    return;
  }

  if (pathname === "/api/projects") {
    const projects = await listProjects();
    sendJson(res, 200, projects);
    return;
  }

  if (pathname === "/api/agents") {
    const agents = await listAgentPresets();
    sendJson(res, 200, agents);
    return;
  }

  if (pathname === "/api/runtime/providers") {
    sendJson(res, 200, {
      providers: listRuntimeProviders(),
      defaults: getDefaultRuntimeConfig()
    });
    return;
  }

  if (runMatch) {
    const run = await getRun(runMatch[1], {
      includeBacklog: toBooleanParam(requestUrl, "includeBacklog", true)
    });
    if (!run) {
      sendJson(res, 404, {
        error: "Not Found",
        message: `Run not found: ${runMatch[1]}`
      });
      return;
    }

    sendJson(res, 200, run);
    return;
  }

  if (projectMatch) {
    const project = await getProject(projectMatch[1], {
      includeRuns: toBooleanParam(requestUrl, "includeRuns", false)
    });
    if (!project) {
      sendJson(res, 404, {
        error: "Not Found",
        message: `Project not found: ${projectMatch[1]}`
      });
      return;
    }

    sendJson(res, 200, project);
    return;
  }

  if (ideaMatch) {
    const idea = await getIdea(ideaMatch[1], {
      includeConversation: toBooleanParam(requestUrl, "includeConversation", false)
    });
    if (!idea) {
      sendJson(res, 404, {
        error: "Not Found",
        message: `Idea not found: ${ideaMatch[1]}`
      });
      return;
    }

    sendJson(res, 200, idea);
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
