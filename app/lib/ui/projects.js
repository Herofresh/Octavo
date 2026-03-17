import {
  byId,
  escapeHtml,
  formatTimestamp,
  optionHtml,
  requestJson,
  setStatus,
  toInputValue
} from "./common.js";

const statusEl = byId("status-line");
const projectListEl = byId("project-list");
const refreshProjectsBtn = byId("refresh-projects-btn");
const createProjectForm = byId("create-project-form");
const projectEmptyEl = byId("project-empty");
const projectWorkspaceEl = byId("project-workspace");
const startRunForm = byId("start-run-form");
const runsBodyEl = byId("runs-body");
const refreshRunBtn = byId("refresh-run-btn");
const syncRootBtn = byId("sync-root-btn");
const rollbackForm = byId("rollback-form");

const state = {
  projects: [],
  ideas: [],
  selectedProjectId: null,
  selectedProject: null,
  selectedRunId: null,
  selectedRun: null,
  runtimeProviders: [],
  runtimeDefaults: { provider: "mock", model: "mock-1" },
  agents: []
};

function providerModels(providerId) {
  const provider = state.runtimeProviders.find((entry) => entry.id === providerId);
  if (!provider || !Array.isArray(provider.models)) {
    return [];
  }
  return provider.models;
}

function fillModelSelect(selectEl, providerId, preferredModel) {
  const models = providerModels(providerId);
  const fallback = preferredModel || state.runtimeDefaults.model || "mock-1";
  const resolved = models.length > 0 ? models : [fallback];
  const selected = preferredModel && resolved.includes(preferredModel) ? preferredModel : resolved[0];
  selectEl.innerHTML = resolved.map((model) => optionHtml(model, model, model === selected)).join("");
  selectEl.value = selected;
}

function renderRuntimeSelectors() {
  const providers = state.runtimeProviders.length
    ? state.runtimeProviders
    : [{ id: state.runtimeDefaults.provider, label: state.runtimeDefaults.provider, models: [state.runtimeDefaults.model], configured: true }];

  const providerOptions = providers.map((provider) => {
    return {
      value: provider.id,
      label: provider.configured ? provider.label : `${provider.label} (missing key)`
    };
  });
  const agentOptions = [{ value: "", label: "(none)" }].concat(
    state.agents.map((agent) => ({ value: agent.id, label: agent.title }))
  );

  const defaultProvider = state.runtimeDefaults.provider || providerOptions[0]?.value || "mock";

  const createProviderEl = byId("create-project-provider");
  const createModelEl = byId("create-project-model");
  const createAgentEl = byId("create-project-agent");

  createProviderEl.innerHTML = providerOptions
    .map((entry) => optionHtml(entry.value, entry.label, entry.value === defaultProvider))
    .join("");
  createProviderEl.value = defaultProvider;
  fillModelSelect(createModelEl, createProviderEl.value, state.runtimeDefaults.model);
  createAgentEl.innerHTML = agentOptions.map((entry) => optionHtml(entry.value, entry.label, false)).join("");

  const runProviderEl = byId("start-run-provider");
  const runModelEl = byId("start-run-model");
  const runAgentEl = byId("start-run-agent");
  const runtime = state.selectedProject?.execution || {};
  const runProvider = toInputValue(runtime.provider) || defaultProvider;

  runProviderEl.innerHTML = providerOptions
    .map((entry) => optionHtml(entry.value, entry.label, entry.value === runProvider))
    .join("");
  runProviderEl.value = runProvider;
  fillModelSelect(runModelEl, runProviderEl.value, toInputValue(runtime.model));
  runAgentEl.innerHTML = agentOptions
    .map((entry) => optionHtml(entry.value, entry.label, entry.value === toInputValue(runtime.agentPreset)))
    .join("");
}

function renderIdeaOptions() {
  const ideaSelect = byId("create-project-idea");
  if (!state.ideas.length) {
    ideaSelect.innerHTML = optionHtml("", "No ideas available", true);
    ideaSelect.disabled = true;
    return;
  }

  ideaSelect.disabled = false;
  ideaSelect.innerHTML = state.ideas
    .map((idea, index) => optionHtml(idea.id, `${idea.title || idea.id} (${idea.status || "planning"})`, index === 0))
    .join("");
}

function renderProjectList() {
  if (!state.projects.length) {
    projectListEl.innerHTML = '<li class="empty">No projects yet.</li>';
    return;
  }

  projectListEl.innerHTML = state.projects
    .map((project) => {
      const active = project.id === state.selectedProjectId;
      return `<li>
        <button type="button" class="project-card" data-project-id="${escapeHtml(project.id)}" data-active="${active}">
          <strong>${escapeHtml(project.title || project.id)}</strong>
          <small>${escapeHtml(project.status || "active")} | ${escapeHtml(project.id)}</small><br/>
          <small>source idea: ${escapeHtml(project.sourceIdeaId || "n/a")} | runs: ${project.runCount || 0}</small>
        </button>
      </li>`;
    })
    .join("");

  for (const button of projectListEl.querySelectorAll(".project-card")) {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-project-id");
      if (!id) {
        return;
      }
      loadProject(id).catch((error) => setStatus(statusEl, error.message, "error"));
    });
  }
}

function renderRunsTable(project) {
  const runs = Array.isArray(project.runs) ? project.runs : [];
  runsBodyEl.innerHTML = runs.length
    ? runs
        .slice()
        .reverse()
        .map((run) => {
          const runtime = run.execution || {};
          const selected = run.runId === state.selectedRunId;
          return `<tr>
            <td><code>${escapeHtml(run.runId || "")}</code></td>
            <td>${escapeHtml(run.status || "running")}${selected ? " (selected)" : ""}</td>
            <td>${escapeHtml(runtime.provider || "n/a")}/${escapeHtml(runtime.model || "n/a")}</td>
            <td>${escapeHtml(formatTimestamp(run.startedAt))}</td>
            <td><button type="button" data-run-id="${escapeHtml(run.runId || "")}">View</button></td>
          </tr>`;
        })
        .join("")
    : '<tr><td colspan="5" class="empty">No runs yet.</td></tr>';

  for (const button of runsBodyEl.querySelectorAll("button[data-run-id]")) {
    button.addEventListener("click", () => {
      const runId = button.getAttribute("data-run-id");
      if (!runId) {
        return;
      }
      loadRun(runId).catch((error) => setStatus(statusEl, error.message, "error"));
    });
  }
}

function renderRunDetail() {
  const run = state.selectedRun;
  if (!run) {
    byId("run-meta").textContent = "No run selected.";
    byId("run-metadata-json").textContent = "{}";
    byId("run-backlog-json").textContent = "{}";
    return;
  }

  const lifecycle = run.metadata?.lifecycle || {};
  const execution = run.metadata?.execution?.profile || {};
  byId("run-meta").textContent =
    `runId: ${run.runId} | status: ${lifecycle.status || "unknown"} | ` +
    `runtime: ${execution.provider || "n/a"}/${execution.model || "n/a"} | ` +
    `updated: ${formatTimestamp(run.metadata?.updatedAt)}`;

  byId("run-metadata-json").textContent = JSON.stringify(run.metadata || {}, null, 2);
  byId("run-backlog-json").textContent = JSON.stringify(run.backlog || {}, null, 2);

  if (!byId("rollback-branch-name").value) {
    const suffix = String(Date.now()).slice(-6);
    byId("rollback-branch-name").value = `octavo-rollback-${run.runId}-${suffix}`;
  }
}

function renderProjectWorkspace() {
  renderRuntimeSelectors();

  const project = state.selectedProject;
  if (!project) {
    projectEmptyEl.classList.remove("hidden");
    projectWorkspaceEl.classList.add("hidden");
    return;
  }

  projectEmptyEl.classList.add("hidden");
  projectWorkspaceEl.classList.remove("hidden");

  byId("project-title").textContent = project.title || project.id;
  byId("project-status-pill").textContent = project.status || "active";
  byId("project-meta").textContent =
    `projectId: ${project.id} | source idea: ${project.sourceIdeaId || "n/a"} | ` +
    `current run: ${project.currentRunId || "n/a"} | updated: ${formatTimestamp(project.updatedAt)}`;

  byId("start-run-harness").value = toInputValue(project.execution?.harness) || "pi";
  byId("start-run-provider").value = toInputValue(project.execution?.provider) || state.runtimeDefaults.provider;
  fillModelSelect(byId("start-run-model"), byId("start-run-provider").value, toInputValue(project.execution?.model));
  byId("start-run-agent").value = toInputValue(project.execution?.agentPreset);

  renderRunsTable(project);
  renderRunDetail();
}

async function loadRuntimeContext() {
  const runtime = await requestJson("/api/runtime/providers");
  state.runtimeProviders = Array.isArray(runtime.providers) ? runtime.providers : [];
  state.runtimeDefaults = runtime.defaults || state.runtimeDefaults;
  state.agents = await requestJson("/api/agents");
}

async function loadIdeas() {
  const ideas = await requestJson("/api/ideas");
  state.ideas = Array.isArray(ideas) ? ideas : [];
  renderIdeaOptions();
}

async function loadProjects(selectId) {
  const projects = await requestJson("/api/projects");
  state.projects = Array.isArray(projects) ? projects : [];

  if (selectId) {
    state.selectedProjectId = selectId;
  }
  if (state.selectedProjectId && !state.projects.some((project) => project.id === state.selectedProjectId)) {
    state.selectedProjectId = null;
  }
  if (!state.selectedProjectId && state.projects[0]) {
    state.selectedProjectId = state.projects[0].id;
  }

  renderProjectList();

  if (!state.selectedProjectId) {
    state.selectedProject = null;
    state.selectedRun = null;
    state.selectedRunId = null;
    renderProjectWorkspace();
    return;
  }

  await loadProject(state.selectedProjectId);
}

async function loadProject(projectId) {
  const project = await requestJson(`/api/projects/${encodeURIComponent(projectId)}?includeRuns=true`);
  state.selectedProjectId = project.id;
  state.selectedProject = project;
  renderProjectList();

  if (state.selectedRunId && !project.runs?.some((run) => run.runId === state.selectedRunId)) {
    state.selectedRun = null;
    state.selectedRunId = null;
  }

  renderProjectWorkspace();
}

async function loadRun(runId) {
  const run = await requestJson(`/api/runs/${encodeURIComponent(runId)}?includeBacklog=true`);
  state.selectedRunId = run.runId;
  state.selectedRun = run;
  renderProjectWorkspace();
}

byId("create-project-provider").addEventListener("change", (event) => {
  fillModelSelect(byId("create-project-model"), event.target.value, "");
});

byId("start-run-provider").addEventListener("change", (event) => {
  fillModelSelect(byId("start-run-model"), event.target.value, "");
});

refreshProjectsBtn.addEventListener("click", async () => {
  try {
    await loadProjects(state.selectedProjectId);
    setStatus(statusEl, "Projects refreshed.", "ok");
  } catch (error) {
    setStatus(statusEl, error.message, "error");
  }
});

createProjectForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const ideaId = byId("create-project-idea").value;
  if (!ideaId) {
    setStatus(statusEl, "Select an idea first.", "error");
    return;
  }

  try {
    const created = await requestJson("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ideaId,
        id: byId("create-project-id").value.trim() || undefined,
        title: byId("create-project-title").value.trim() || undefined,
        runtimeProvider: byId("create-project-provider").value,
        runtimeModel: byId("create-project-model").value,
        agentPreset: byId("create-project-agent").value || null
      })
    });

    await loadProjects(created.project.id);
    setStatus(statusEl, `Project ${created.project.id} created.`, "ok");
  } catch (error) {
    setStatus(statusEl, error.message, "error");
  }
});

startRunForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.selectedProjectId) {
    setStatus(statusEl, "Select a project first.", "error");
    return;
  }

  try {
    const execution = await requestJson(`/api/projects/${encodeURIComponent(state.selectedProjectId)}/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: byId("start-run-id").value.trim() || undefined,
        rootTaskId: byId("start-run-root-task").value.trim() || undefined,
        rootMilestone: byId("start-run-root-milestone").value.trim() || undefined,
        executionHarness: byId("start-run-harness").value.trim() || undefined,
        runtimeProvider: byId("start-run-provider").value,
        runtimeModel: byId("start-run-model").value,
        agentPreset: byId("start-run-agent").value || null,
        syncRoot: true
      })
    });

    await loadProject(state.selectedProjectId);
    await loadRun(execution.run.runId);
    setStatus(statusEl, `Run ${execution.run.runId} started.`, "ok");
  } catch (error) {
    setStatus(statusEl, error.message, "error");
  }
});

refreshRunBtn.addEventListener("click", async () => {
  if (!state.selectedRunId) {
    setStatus(statusEl, "Select a run first.", "error");
    return;
  }

  try {
    await loadRun(state.selectedRunId);
    setStatus(statusEl, `Run ${state.selectedRunId} refreshed.`, "ok");
  } catch (error) {
    setStatus(statusEl, error.message, "error");
  }
});

syncRootBtn.addEventListener("click", async () => {
  if (!state.selectedRunId) {
    setStatus(statusEl, "Select a run first.", "error");
    return;
  }

  try {
    const sync = await requestJson(`/api/runs/${encodeURIComponent(state.selectedRunId)}/sync-root`, {
      method: "POST"
    });
    await loadRun(state.selectedRunId);
    setStatus(statusEl, `Root backlog synced (${sync.status}).`, "ok");
  } catch (error) {
    setStatus(statusEl, error.message, "error");
  }
});

rollbackForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.selectedRunId) {
    setStatus(statusEl, "Select a run first.", "error");
    return;
  }

  try {
    const branchName = byId("rollback-branch-name").value.trim() || `octavo-rollback-${state.selectedRunId}-${String(Date.now()).slice(-6)}`;
    const baseRef = byId("rollback-base-ref").value.trim() || "HEAD~1";
    const branch = await requestJson(`/api/runs/${encodeURIComponent(state.selectedRunId)}/branch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branchName,
        baseRef
      })
    });

    await loadRun(state.selectedRunId);
    setStatus(statusEl, `Rollback branch ready: ${branch.branch.name} from ${branch.branch.baseRef}.`, "ok");
  } catch (error) {
    setStatus(statusEl, error.message, "error");
  }
});

Promise.all([loadRuntimeContext(), loadIdeas(), loadProjects()])
  .then(() => {
    renderProjectWorkspace();
    setStatus(statusEl, "Projects workspace ready.");
  })
  .catch((error) => {
    setStatus(statusEl, error.message, "error");
  });
