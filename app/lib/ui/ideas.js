import {
  byId,
  escapeHtml,
  formatTimestamp,
  optionHtml,
  requestJson,
  setStatus,
  toBacklogStatus,
  toInputValue
} from "./common.js";

const statusEl = byId("status-line");
const createModalEl = byId("create-modal");
const openCreateModalBtn = byId("open-create-modal-btn");
const closeCreateModalBtn = byId("close-create-modal-btn");
const createForm = byId("create-form");
const refreshIdeasBtn = byId("refresh-ideas-btn");
const ideaListEl = byId("idea-list");
const ideaEmptyEl = byId("idea-empty");
const workspaceEl = byId("idea-workspace");
const toggleDetailsBtn = byId("toggle-details-btn");
const detailsPanelEl = byId("idea-details-panel");
const ideaDocumentForm = byId("idea-document-form");
const migrateRuntimeBtn = byId("migrate-runtime-btn");
const reloadIdeaBtn = byId("reload-idea-btn");
const deleteIdeaBtn = byId("delete-idea-btn");
const kickoffForm = byId("kickoff-form");
const chatForm = byId("chat-form");
const chatSendBtn = byId("chat-send-btn");
const chatMessageEl = byId("chat-message");
const chatSendIndicatorEl = byId("chat-send-indicator");
const spawnProjectForm = byId("spawn-project-form");
const markdownEl = byId("idea-markdown");

const state = {
  ideas: [],
  selectedId: null,
  selectedIdea: null,
  detailsOpen: false,
  sendIndicatorTimer: null,
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
  if (!selectEl) {
    return;
  }

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
    : [
        {
          id: state.runtimeDefaults.provider,
          label: state.runtimeDefaults.provider,
          models: [state.runtimeDefaults.model],
          configured: true
        }
      ];

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

  const createProviderEl = byId("create-provider");
  const createModelEl = byId("create-model");
  const createAgentEl = byId("create-agent");

  createProviderEl.innerHTML = providerOptions
    .map((entry) => optionHtml(entry.value, entry.label, entry.value === defaultProvider))
    .join("");
  createProviderEl.value = defaultProvider;
  fillModelSelect(createModelEl, createProviderEl.value, state.runtimeDefaults.model);
  createAgentEl.innerHTML = agentOptions.map((entry) => optionHtml(entry.value, entry.label, false)).join("");

  const detailProviderEl = byId("idea-provider");
  const detailModelEl = byId("idea-model");
  const detailAgentEl = byId("idea-agent");
  const runtime = state.selectedIdea?.runtime || {};
  const detailProvider = toInputValue(runtime.provider) || defaultProvider;

  detailProviderEl.innerHTML = providerOptions
    .map((entry) => optionHtml(entry.value, entry.label, entry.value === detailProvider))
    .join("");
  detailProviderEl.value = detailProvider;
  fillModelSelect(detailModelEl, detailProviderEl.value, toInputValue(runtime.model));
  detailAgentEl.innerHTML = agentOptions
    .map((entry) => optionHtml(entry.value, entry.label, entry.value === toInputValue(runtime.agentPreset)))
    .join("");
}

function markdownInline(text) {
  let result = escapeHtml(text || "");
  result = result.replace(/`([^`]+)`/g, "<code>$1</code>");
  result = result.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return result;
}

function markdownToHtml(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  const html = [];
  let inList = false;
  let inCode = false;
  let codeLines = [];

  function closeList() {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (!inCode) {
        closeList();
        inCode = true;
        codeLines = [];
      } else {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        inCode = false;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (!trimmed) {
      closeList();
      continue;
    }

    if (trimmed.startsWith("- ")) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${markdownInline(trimmed.slice(2))}</li>`);
      continue;
    }

    closeList();

    if (trimmed.startsWith("#### ")) {
      html.push(`<h4>${markdownInline(trimmed.slice(5))}</h4>`);
      continue;
    }
    if (trimmed.startsWith("### ")) {
      html.push(`<h3>${markdownInline(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith("## ")) {
      html.push(`<h2>${markdownInline(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith("# ")) {
      html.push(`<h1>${markdownInline(trimmed.slice(2))}</h1>`);
      continue;
    }

    html.push(`<p>${markdownInline(trimmed)}</p>`);
  }

  if (inList) {
    html.push("</ul>");
  }
  if (inCode) {
    html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }

  return html.join("") || '<p class="empty">No markdown content yet.</p>';
}

function openCreateModal() {
  createModalEl.classList.remove("hidden");
}

function closeCreateModal() {
  createModalEl.classList.add("hidden");
}

function setChatSendIndicator(indicatorState, text = "") {
  if (state.sendIndicatorTimer) {
    clearTimeout(state.sendIndicatorTimer);
    state.sendIndicatorTimer = null;
  }

  const fallbackByState = {
    idle: "Ready",
    sending: "Sending...",
    sent: "Sent",
    error: "Send failed"
  };

  chatSendIndicatorEl.dataset.state = indicatorState;
  chatSendIndicatorEl.textContent = text || fallbackByState[indicatorState] || "Ready";
}

function queueSendIndicatorReset(delayMs = 1800) {
  if (state.sendIndicatorTimer) {
    clearTimeout(state.sendIndicatorTimer);
  }

  state.sendIndicatorTimer = setTimeout(() => {
    setChatSendIndicator("idle", "Ready");
  }, delayMs);
}

function setChatSending(isSending) {
  chatSendBtn.disabled = isSending;
  chatMessageEl.disabled = isSending;
}

function setDetailsOpen(nextOpen) {
  state.detailsOpen = Boolean(nextOpen);
  if (state.detailsOpen) {
    detailsPanelEl.classList.remove("hidden");
    toggleDetailsBtn.textContent = "Hide Details";
  } else {
    detailsPanelEl.classList.add("hidden");
    toggleDetailsBtn.textContent = "Show Details";
  }
}

function clearSelection() {
  state.selectedId = null;
  state.selectedIdea = null;
  state.detailsOpen = false;
}

function renderIdeaList() {
  if (!state.ideas.length) {
    ideaListEl.innerHTML = '<li class="empty">No ideas yet.</li>';
    return;
  }

  ideaListEl.innerHTML = state.ideas
    .map((idea) => {
      const active = idea.id === state.selectedId;
      return `<li>
        <button type="button" class="idea-card" data-idea-id="${escapeHtml(idea.id)}" data-active="${active}">
          <strong>${escapeHtml(idea.title || idea.id)}</strong>
          <small>${escapeHtml(idea.status || "planning")} | ${escapeHtml(idea.id)}</small><br/>
          <small>updated: ${escapeHtml(formatTimestamp(idea.updatedAt))} | messages: ${idea.conversationCount || 0}</small>
        </button>
      </li>`;
    })
    .join("");

  for (const button of ideaListEl.querySelectorAll(".idea-card")) {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-idea-id");
      if (!id) {
        return;
      }
      loadIdea(id, { resetDetails: true }).catch((error) => setStatus(statusEl, error.message, "error"));
    });
  }
}

function renderConversation(conversation) {
  const entries = Array.isArray(conversation) ? conversation : [];
  const chatStream = byId("chat-stream");
  const timeline = byId("idea-timeline");

  if (!entries.length) {
    chatStream.innerHTML = '<div class="empty">No chat messages yet.</div>';
    timeline.innerHTML = '<div class="empty">No timeline entries yet.</div>';
    return;
  }

  chatStream.innerHTML = entries
    .map((entry) => {
      const role = toInputValue(entry.role || "assistant");
      return `<article class="bubble ${escapeHtml(role)}">
        <div class="meta">${escapeHtml(role)} @ ${escapeHtml(formatTimestamp(entry.at))}</div>
        <div class="content">${escapeHtml(entry.content || "")}</div>
      </article>`;
    })
    .join("");
  chatStream.scrollTop = chatStream.scrollHeight;

  timeline.innerHTML = entries
    .slice()
    .reverse()
    .map((entry) => {
      const metadata = entry.metadata && typeof entry.metadata === "object" ? entry.metadata : {};
      const bits = [entry.role || "user", formatTimestamp(entry.at)];
      if (metadata.type) {
        bits.push(String(metadata.type));
      }
      return `<article class="timeline-item">
        <div class="meta">${escapeHtml(bits.join(" | "))}</div>
        <pre>${escapeHtml(entry.content || "")}</pre>
      </article>`;
    })
    .join("");
}

function renderIdeaWorkspace() {
  renderRuntimeSelectors();
  const idea = state.selectedIdea;

  if (!idea) {
    ideaEmptyEl.classList.remove("hidden");
    workspaceEl.classList.add("hidden");
    setChatSendIndicator("idle", "Ready");
    return;
  }

  ideaEmptyEl.classList.add("hidden");
  workspaceEl.classList.remove("hidden");

  byId("idea-heading").textContent = idea.title || idea.id;
  byId("idea-meta").textContent =
    `ideaId: ${idea.id} | updated: ${formatTimestamp(idea.updatedAt)} | ` +
    `provider/model: ${idea.runtime?.provider || "n/a"}/${idea.runtime?.model || "n/a"} | ` +
    `root backlog status: ${toBacklogStatus(idea.status)}`;
  byId("idea-status-pill").textContent = idea.status || "planning";

  byId("idea-title").value = toInputValue(idea.title);
  byId("idea-status").value = toInputValue(idea.status || "planning");
  byId("idea-root-task").value = toInputValue(idea.rootLink?.taskId);
  byId("idea-root-milestone").value = toInputValue(idea.rootLink?.milestone);

  const providerEl = byId("idea-provider");
  const modelEl = byId("idea-model");
  const agentEl = byId("idea-agent");
  providerEl.value = toInputValue(idea.runtime?.provider || state.runtimeDefaults.provider);
  fillModelSelect(modelEl, providerEl.value, toInputValue(idea.runtime?.model));
  agentEl.value = toInputValue(idea.runtime?.agentPreset);

  markdownEl.value = toInputValue(idea.markdown);
  byId("markdown-preview").innerHTML = markdownToHtml(idea.markdown);

  renderConversation(idea.conversation);
  setDetailsOpen(state.detailsOpen);
}

async function loadRuntimeContext() {
  const runtime = await requestJson("/api/runtime/providers");
  state.runtimeProviders = Array.isArray(runtime.providers) ? runtime.providers : [];
  state.runtimeDefaults = runtime.defaults || state.runtimeDefaults;
  state.agents = await requestJson("/api/agents");
}

async function loadIdeas(selectId, options = {}) {
  const preserveDetails = options.preserveDetails === true;
  const ideas = await requestJson("/api/ideas");
  state.ideas = Array.isArray(ideas) ? ideas : [];

  if (selectId) {
    state.selectedId = selectId;
  }

  if (state.selectedId && !state.ideas.some((idea) => idea.id === state.selectedId)) {
    clearSelection();
  }

  renderIdeaList();

  if (!state.selectedId) {
    clearSelection();
    renderIdeaWorkspace();
    return;
  }

  await loadIdea(state.selectedId, { resetDetails: !preserveDetails });
}

async function loadIdea(ideaId, options = {}) {
  const resetDetails = options.resetDetails !== false;
  const previousId = state.selectedId;
  const idea = await requestJson(`/api/ideas/${encodeURIComponent(ideaId)}?includeConversation=true`);
  state.selectedId = idea.id;
  state.selectedIdea = idea;

  if (resetDetails || previousId !== idea.id) {
    state.detailsOpen = false;
  }

  renderIdeaList();
  renderIdeaWorkspace();
}

byId("create-provider").addEventListener("change", (event) => {
  fillModelSelect(byId("create-model"), event.target.value, "");
});

byId("idea-provider").addEventListener("change", (event) => {
  fillModelSelect(byId("idea-model"), event.target.value, "");
});

markdownEl.addEventListener("input", () => {
  byId("markdown-preview").innerHTML = markdownToHtml(markdownEl.value);
});

openCreateModalBtn.addEventListener("click", () => {
  openCreateModal();
});

closeCreateModalBtn.addEventListener("click", () => {
  closeCreateModal();
});

createModalEl.addEventListener("click", (event) => {
  if (event.target === createModalEl) {
    closeCreateModal();
  }
});

refreshIdeasBtn.addEventListener("click", async () => {
  try {
    await loadIdeas(state.selectedId, { preserveDetails: true });
    setStatus(statusEl, "Ideas refreshed.", "ok");
  } catch (error) {
    setStatus(statusEl, error.message, "error");
  }
});

toggleDetailsBtn.addEventListener("click", () => {
  setDetailsOpen(!state.detailsOpen);
});

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = byId("create-title").value.trim();
  const summary = byId("create-summary").value;
  if (!title) {
    setStatus(statusEl, "Title is required.", "error");
    return;
  }

  try {
    const runtimeProvider = byId("create-provider").value;
    const runtimeModel = byId("create-model").value;
    const agentPreset = byId("create-agent").value || null;

    const created = await requestJson("/api/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: summary,
        runtimeProvider,
        runtimeModel,
        agentPreset
      })
    });

    let kickoffError = null;
    try {
      await requestJson(`/api/ideas/${encodeURIComponent(created.id)}/kickoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runtimeProvider,
          runtimeModel,
          agentPreset,
          context: summary || ""
        })
      });
    } catch (error) {
      kickoffError = error;
    }

    createForm.reset();
    closeCreateModal();
    renderRuntimeSelectors();
    await loadIdeas(created.id, { preserveDetails: false });

    if (kickoffError) {
      setStatus(statusEl, `Created ${created.id}, but kickoff failed: ${kickoffError.message}`, "error");
    } else {
      setStatus(statusEl, `Created ${created.id} and generated kickoff draft.`, "ok");
    }
  } catch (error) {
    setStatus(statusEl, error.message, "error");
  }
});

deleteIdeaBtn.addEventListener("click", async () => {
  if (!state.selectedId) {
    return;
  }

  const confirmed = window.confirm(
    `Delete idea ${state.selectedId}? This removes idea.md and conversation history permanently.`
  );
  if (!confirmed) {
    return;
  }

  try {
    const deletedId = state.selectedId;
    await requestJson(`/api/ideas/${encodeURIComponent(deletedId)}`, {
      method: "DELETE"
    });
    clearSelection();
    await loadIdeas();
    setStatus(statusEl, `Deleted ${deletedId}.`, "ok");
  } catch (error) {
    setStatus(statusEl, error.message, "error");
  }
});

ideaDocumentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.selectedId) {
    setStatus(statusEl, "Select an idea first.", "error");
    return;
  }

  try {
    await requestJson(`/api/ideas/${encodeURIComponent(state.selectedId)}/document`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: byId("idea-title").value.trim(),
        status: byId("idea-status").value,
        rootTaskId: byId("idea-root-task").value.trim(),
        rootMilestone: byId("idea-root-milestone").value.trim(),
        runtimeProvider: byId("idea-provider").value,
        runtimeModel: byId("idea-model").value,
        agentPreset: byId("idea-agent").value || null,
        markdown: markdownEl.value
      })
    });
    await loadIdeas(state.selectedId, { preserveDetails: true });
    setStatus(statusEl, "Saved idea.md.", "ok");
  } catch (error) {
    setStatus(statusEl, error.message, "error");
  }
});

migrateRuntimeBtn.addEventListener("click", async () => {
  if (!state.selectedId) {
    return;
  }

  try {
    await requestJson(`/api/ideas/${encodeURIComponent(state.selectedId)}/runtime`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runtimeProvider: byId("idea-provider").value,
        runtimeModel: byId("idea-model").value,
        agentPreset: byId("idea-agent").value || null
      })
    });
    await loadIdea(state.selectedId, { resetDetails: false });
    setStatus(statusEl, "Runtime profile migrated.", "ok");
  } catch (error) {
    setStatus(statusEl, error.message, "error");
  }
});

reloadIdeaBtn.addEventListener("click", async () => {
  if (!state.selectedId) {
    return;
  }

  try {
    await loadIdea(state.selectedId, { resetDetails: false });
    setStatus(statusEl, "Idea reloaded.", "ok");
  } catch (error) {
    setStatus(statusEl, error.message, "error");
  }
});

kickoffForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.selectedId) {
    return;
  }

  try {
    const kickoff = await requestJson(`/api/ideas/${encodeURIComponent(state.selectedId)}/kickoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runtimeProvider: byId("idea-provider").value,
        runtimeModel: byId("idea-model").value,
        agentPreset: byId("idea-agent").value || null,
        context: byId("kickoff-context").value,
        system: byId("kickoff-system").value
      })
    });
    await loadIdea(state.selectedId, { resetDetails: false });
    setStatus(
      statusEl,
      `Kickoff regenerated via ${kickoff.completion.provider}/${kickoff.completion.model}.`,
      "ok"
    );
  } catch (error) {
    setStatus(statusEl, error.message, "error");
  }
});

chatMessageEl.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
    return;
  }

  event.preventDefault();
  if (!chatSendBtn.disabled) {
    chatForm.requestSubmit();
  }
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.selectedId) {
    setStatus(statusEl, "Select an idea first.", "error");
    return;
  }

  const message = chatMessageEl.value.trim();
  if (!message) {
    setStatus(statusEl, "Chat message is required.", "error");
    return;
  }

  try {
    setChatSending(true);
    setChatSendIndicator("sending", "Sending...");

    const chatSystemEl = byId("chat-system");
    const chat = await requestJson(`/api/ideas/${encodeURIComponent(state.selectedId)}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        system: chatSystemEl ? chatSystemEl.value : "",
        runtimeProvider: byId("idea-provider").value,
        runtimeModel: byId("idea-model").value,
        agentPreset: byId("idea-agent").value || null
      })
    });

    chatMessageEl.value = "";
    await loadIdeas(chat.idea.id, { preserveDetails: true });

    const completionProvider = chat?.completion?.provider || "runtime";
    const completionModel = chat?.completion?.model || "model";
    setChatSendIndicator("sent", `Sent via ${completionProvider}/${completionModel}`);
    queueSendIndicatorReset();
    setStatus(statusEl, `LLM response received via ${completionProvider}/${completionModel}.`, "ok");
  } catch (error) {
    setChatSendIndicator("error", `Send failed: ${error.message}`);
    queueSendIndicatorReset(2800);
    setStatus(statusEl, error.message, "error");
  } finally {
    setChatSending(false);
  }
});

spawnProjectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.selectedId) {
    setStatus(statusEl, "Select an idea first.", "error");
    return;
  }

  try {
    const project = await requestJson("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ideaId: state.selectedId,
        id: byId("spawn-project-id").value.trim() || undefined,
        title: byId("spawn-project-title").value.trim() || undefined,
        runtimeProvider: byId("idea-provider").value,
        runtimeModel: byId("idea-model").value,
        agentPreset: byId("idea-agent").value || null
      })
    });

    setStatus(statusEl, `Project ${project.project.id} created. Open /projects to manage runs.`, "ok");
    await loadIdea(state.selectedId, { resetDetails: false });
  } catch (error) {
    setStatus(statusEl, error.message, "error");
  }
});

Promise.all([loadRuntimeContext(), loadIdeas()])
  .then(() => {
    renderIdeaWorkspace();
    setChatSendIndicator("idle", "Ready");
    setStatus(statusEl, "Ideas workspace ready.");
  })
  .catch((error) => {
    setStatus(statusEl, error.message, "error");
  });
