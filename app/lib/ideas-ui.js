function createIdeasPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Octavo Ideas</title>
    <style>
      :root {
        --bg: #07100f;
        --bg-alt: #0f1f1d;
        --panel: #132826;
        --panel-alt: #173330;
        --border: #2e5a54;
        --text: #d6f4eb;
        --muted: #89b0a5;
        --accent: #3dd9b2;
        --accent-alt: #f2b66d;
        --danger: #ff8d8d;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "JetBrains Mono", "IBM Plex Mono", "SF Mono", Menlo, Consolas, monospace;
        color: var(--text);
        background:
          radial-gradient(circle at 10% 10%, rgba(61, 217, 178, 0.18), transparent 40%),
          radial-gradient(circle at 90% 10%, rgba(242, 182, 109, 0.12), transparent 35%),
          linear-gradient(140deg, var(--bg), var(--bg-alt));
      }

      .shell {
        max-width: 1480px;
        margin: 0 auto;
        padding: 20px;
      }

      .topbar {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 14px;
      }

      h1 {
        margin: 0;
        font-size: 22px;
        letter-spacing: 0.04em;
      }

      .status {
        min-height: 1.5em;
        color: var(--muted);
        font-size: 13px;
      }

      .layout {
        display: grid;
        grid-template-columns: 360px minmax(0, 1fr);
        gap: 14px;
      }

      .panel {
        background: linear-gradient(180deg, var(--panel), var(--panel-alt));
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 14px;
      }

      h2, h3 {
        margin: 0 0 10px;
        font-size: 15px;
        color: var(--accent);
      }

      form {
        display: grid;
        gap: 8px;
      }

      .grid-2 {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      .grid-3 {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }

      label {
        display: grid;
        gap: 4px;
        font-size: 12px;
        color: var(--muted);
      }

      input, select, textarea, button {
        font: inherit;
        color: var(--text);
        background: #0c1716;
        border: 1px solid #2a4f49;
        border-radius: 8px;
        padding: 8px;
      }

      textarea {
        min-height: 88px;
        resize: vertical;
      }

      button {
        cursor: pointer;
        background: linear-gradient(180deg, #1d3834, #19322f);
      }

      button:hover {
        border-color: var(--accent);
      }

      button.secondary {
        border-color: #4d5352;
        background: #152322;
      }

      .actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .idea-list {
        display: grid;
        gap: 6px;
        margin-top: 10px;
        max-height: 46vh;
        overflow: auto;
      }

      .idea-item {
        width: 100%;
        text-align: left;
        padding: 10px;
        border-radius: 8px;
      }

      .idea-item[data-active="true"] {
        border-color: var(--accent);
        box-shadow: 0 0 0 1px rgba(61, 217, 178, 0.22) inset;
      }

      .idea-meta {
        margin: 0 0 8px;
        font-size: 12px;
        color: var(--muted);
      }

      .section {
        margin-top: 12px;
        border-top: 1px solid #2a4f49;
        padding-top: 12px;
      }

      .conversation {
        margin-top: 12px;
        display: grid;
        gap: 8px;
      }

      .timeline {
        margin: 0;
        padding: 0;
        list-style: none;
        max-height: 260px;
        overflow: auto;
        display: grid;
        gap: 8px;
      }

      .timeline li {
        border: 1px solid #2a4f49;
        border-radius: 8px;
        padding: 8px;
        background: #0d1a18;
        font-size: 12px;
      }

      .timeline .meta {
        color: var(--accent-alt);
        margin-bottom: 6px;
      }

      .empty {
        color: var(--muted);
        font-size: 13px;
      }

      .error {
        color: var(--danger);
      }

      @media (max-width: 1050px) {
        .layout {
          grid-template-columns: 1fr;
        }

        .grid-3 {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 680px) {
        .grid-2,
        .grid-3 {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <header class="topbar">
        <h1>Octavo Ideas Workspace</h1>
        <a href="/" style="color: var(--accent-alt)">Home</a>
      </header>
      <p class="status" id="ui-status">Loading ideas...</p>

      <section class="layout">
        <aside class="panel">
          <h2>Create Idea</h2>
          <form id="create-idea-form">
            <label>Title
              <input id="create-title" name="title" required />
            </label>
            <label>Idea ID (optional)
              <input id="create-id" name="id" />
            </label>
            <label>Summary (optional)
              <textarea id="create-description" name="description"></textarea>
            </label>
            <div class="grid-2">
              <label>LLM Provider
                <select id="create-provider"></select>
              </label>
              <label>LLM Model
                <select id="create-model"></select>
              </label>
            </div>
            <label>Agent Preset
              <select id="create-agent"></select>
            </label>
            <div class="actions">
              <button type="submit">Create</button>
            </div>
          </form>

          <div class="section">
            <h3>Ideas</h3>
            <div class="idea-list" id="idea-list"></div>
          </div>
        </aside>

        <section class="panel">
          <h2>Idea Document</h2>
          <p class="idea-meta" id="idea-meta">No idea selected.</p>
          <form id="idea-document-form">
            <label>Title
              <input id="idea-title" name="title" />
            </label>
            <div class="grid-3">
              <label>Status
                <select id="idea-status" name="status">
                  <option value="new">new</option>
                  <option value="planning">planning</option>
                  <option value="approved">approved</option>
                  <option value="executing">executing</option>
                  <option value="done">done</option>
                  <option value="blocked">blocked</option>
                </select>
              </label>
              <label>Root Task
                <input id="idea-root-task" name="rootTaskId" placeholder="TASK-9" />
              </label>
              <label>Root Milestone
                <input id="idea-root-milestone" name="rootMilestone" placeholder="Idea System" />
              </label>
            </div>

            <div class="grid-3">
              <label>LLM Provider
                <select id="idea-provider"></select>
              </label>
              <label>LLM Model
                <select id="idea-model"></select>
              </label>
              <label>Agent Preset
                <select id="idea-agent"></select>
              </label>
            </div>

            <label>idea.md (markdown)
              <textarea id="idea-markdown" name="markdown" style="min-height:260px;"></textarea>
            </label>
            <div class="actions">
              <button type="submit">Save Document</button>
              <button class="secondary" type="button" id="migrate-runtime-btn">Migrate Runtime</button>
              <button class="secondary" type="button" id="reload-idea-btn">Reload</button>
            </div>
          </form>

          <section class="section">
            <h3>LLM Kickoff</h3>
            <form id="kickoff-form">
              <label>Extra Context
                <textarea id="kickoff-context"></textarea>
              </label>
              <label>System Prompt (optional)
                <textarea id="kickoff-system"></textarea>
              </label>
              <div class="actions">
                <button type="submit">Generate Kickoff Draft</button>
              </div>
            </form>
          </section>

          <section class="conversation section">
            <h3>Conversation Timeline</h3>
            <ul class="timeline" id="idea-conversation"></ul>
            <form id="idea-conversation-form">
              <div class="grid-2">
                <label>Role
                  <select id="conversation-role" name="role">
                    <option value="user">user</option>
                    <option value="assistant">assistant</option>
                    <option value="system">system</option>
                  </select>
                </label>
                <label>Message
                  <textarea id="conversation-content" name="content" required></textarea>
                </label>
              </div>
              <div class="actions">
                <button type="submit">Append Message</button>
              </div>
            </form>
          </section>
        </section>
      </section>
    </main>

    <script>
      const statusEl = document.getElementById("ui-status");
      const ideaListEl = document.getElementById("idea-list");
      const ideaMetaEl = document.getElementById("idea-meta");
      const timelineEl = document.getElementById("idea-conversation");
      const createForm = document.getElementById("create-idea-form");
      const docForm = document.getElementById("idea-document-form");
      const conversationForm = document.getElementById("idea-conversation-form");
      const kickoffForm = document.getElementById("kickoff-form");
      const reloadBtn = document.getElementById("reload-idea-btn");
      const migrateRuntimeBtn = document.getElementById("migrate-runtime-btn");

      const state = {
        ideas: [],
        selectedId: null,
        selectedIdea: null,
        runtimeProviders: [],
        runtimeDefaults: { provider: "mock", model: "mock-1" },
        agents: []
      };

      function setStatus(message, isError) {
        statusEl.textContent = message;
        statusEl.className = isError ? "status error" : "status";
      }

      function escapeHtml(value) {
        return String(value == null ? "" : value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      }

      function formatTimestamp(value) {
        if (!value) {
          return "n/a";
        }
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
          return value;
        }
        return parsed.toLocaleString();
      }

      function toInputValue(value) {
        return typeof value === "string" ? value : "";
      }

      function setDetailEnabled(enabled) {
        for (const element of docForm.elements) {
          element.disabled = !enabled;
        }
        for (const element of conversationForm.elements) {
          element.disabled = !enabled;
        }
        for (const element of kickoffForm.elements) {
          element.disabled = !enabled;
        }
        reloadBtn.disabled = !enabled;
        migrateRuntimeBtn.disabled = !enabled;
      }

      async function requestJson(url, options) {
        const response = await fetch(url, options);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message = payload && payload.message ? payload.message : "Request failed";
          throw new Error(message);
        }
        return payload;
      }

      function optionHtml(value, label, selected) {
        const selectedAttr = selected ? " selected" : "";
        return "<option value=\\"" + escapeHtml(value) + "\\"" + selectedAttr + ">" + escapeHtml(label) + "</option>";
      }

      function providerModels(providerId) {
        const provider = state.runtimeProviders.find((entry) => entry.id === providerId);
        if (!provider || !Array.isArray(provider.models)) {
          return [];
        }
        return provider.models;
      }

      function fillModelSelect(selectEl, providerId, preferredValue) {
        const models = providerModels(providerId);
        const fallbackModel = preferredValue || state.runtimeDefaults.model || "";
        const resolvedModels = models.length > 0 ? models : [fallbackModel];
        const selectedModel =
          (preferredValue && resolvedModels.includes(preferredValue) ? preferredValue : null) ||
          resolvedModels[0] ||
          "";

        selectEl.innerHTML = resolvedModels
          .map((model) => optionHtml(model, model, model === selectedModel))
          .join("");
        selectEl.value = selectedModel;
      }

      function renderRuntimeSelectors() {
        const providerOptions = state.runtimeProviders.map((provider) => {
          const label = provider.configured ? provider.label : provider.label + " (missing key)";
          return { value: provider.id, label };
        });
        const agentOptions = [{ value: "", label: "(none)" }].concat(
          state.agents.map((agent) => ({ value: agent.id, label: agent.title }))
        );

        const createProviderEl = document.getElementById("create-provider");
        const ideaProviderEl = document.getElementById("idea-provider");
        const createAgentEl = document.getElementById("create-agent");
        const ideaAgentEl = document.getElementById("idea-agent");

        const defaultProvider = state.runtimeDefaults.provider || (providerOptions[0] && providerOptions[0].value) || "mock";
        createProviderEl.innerHTML = providerOptions.map((entry) => optionHtml(entry.value, entry.label, entry.value === defaultProvider)).join("");
        ideaProviderEl.innerHTML = providerOptions.map((entry) => optionHtml(entry.value, entry.label, entry.value === defaultProvider)).join("");

        createAgentEl.innerHTML = agentOptions.map((entry) => optionHtml(entry.value, entry.label, false)).join("");
        ideaAgentEl.innerHTML = agentOptions.map((entry) => optionHtml(entry.value, entry.label, false)).join("");

        fillModelSelect(document.getElementById("create-model"), createProviderEl.value, state.runtimeDefaults.model);
        fillModelSelect(document.getElementById("idea-model"), ideaProviderEl.value, state.runtimeDefaults.model);
      }

      function renderIdeaList() {
        ideaListEl.innerHTML = "";
        if (state.ideas.length === 0) {
          ideaListEl.innerHTML = '<p class="empty">No ideas yet. Create one to start planning.</p>';
          return;
        }

        for (const idea of state.ideas) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "idea-item";
          button.dataset.active = String(idea.id === state.selectedId);
          button.innerHTML =
            "<strong>" + escapeHtml(idea.title || idea.id) + "</strong><br/>" +
            '<span class="idea-meta">' + escapeHtml(idea.status || "planning") + " | " +
            escapeHtml(idea.id) + "</span>";
          button.addEventListener("click", () => {
            loadIdea(idea.id).catch((error) => {
              setStatus(error.message, true);
            });
          });
          ideaListEl.appendChild(button);
        }
      }

      function renderIdeaDetail() {
        const idea = state.selectedIdea;
        if (!idea) {
          ideaMetaEl.textContent = "No idea selected.";
          timelineEl.innerHTML = '<li class="empty">No conversation entries.</li>';
          docForm.reset();
          conversationForm.reset();
          kickoffForm.reset();
          setDetailEnabled(false);
          return;
        }

        setDetailEnabled(true);
        ideaMetaEl.textContent =
          "ideaId: " + idea.id +
          " | updated: " + formatTimestamp(idea.updatedAt) +
          " | provider/model: " + escapeHtml(idea.runtime?.provider || "n/a") + "/" + escapeHtml(idea.runtime?.model || "n/a") +
          " | conversation: " + String(idea.conversationCount || 0);

        document.getElementById("idea-title").value = toInputValue(idea.title);
        document.getElementById("idea-status").value = toInputValue(idea.status || "planning");
        document.getElementById("idea-root-task").value = toInputValue(idea.rootLink && idea.rootLink.taskId);
        document.getElementById("idea-root-milestone").value = toInputValue(idea.rootLink && idea.rootLink.milestone);
        document.getElementById("idea-markdown").value = toInputValue(idea.markdown);

        const providerEl = document.getElementById("idea-provider");
        const modelEl = document.getElementById("idea-model");
        const agentEl = document.getElementById("idea-agent");
        providerEl.value = toInputValue(idea.runtime?.provider || state.runtimeDefaults.provider);
        fillModelSelect(modelEl, providerEl.value, toInputValue(idea.runtime?.model || ""));
        agentEl.value = toInputValue(idea.runtime?.agentPreset || "");

        const conversation = Array.isArray(idea.conversation) ? idea.conversation : [];
        timelineEl.innerHTML = "";
        if (conversation.length === 0) {
          timelineEl.innerHTML = '<li class="empty">No conversation entries yet.</li>';
          return;
        }

        for (const entry of conversation.slice().reverse()) {
          const item = document.createElement("li");
          const metaBits = [entry.role || "user", formatTimestamp(entry.at)];
          if (entry.metadata && entry.metadata.type) {
            metaBits.push(String(entry.metadata.type));
          }
          item.innerHTML =
            '<div class="meta">' + escapeHtml(metaBits.join(" @ ")) + "</div>" +
            "<div>" + escapeHtml(entry.content || "") + "</div>";
          timelineEl.appendChild(item);
        }
      }

      async function loadRuntimeContext() {
        const runtime = await requestJson("/api/runtime/providers");
        state.runtimeProviders = Array.isArray(runtime.providers) ? runtime.providers : [];
        state.runtimeDefaults = runtime.defaults || state.runtimeDefaults;
        state.agents = await requestJson("/api/agents");
        renderRuntimeSelectors();
      }

      async function loadIdeas(selectId) {
        const ideas = await requestJson("/api/ideas");
        state.ideas = Array.isArray(ideas) ? ideas : [];
        if (selectId) {
          state.selectedId = selectId;
        }
        if (!state.selectedId && state.ideas[0]) {
          state.selectedId = state.ideas[0].id;
        }
        renderIdeaList();

        if (!state.selectedId) {
          state.selectedIdea = null;
          renderIdeaDetail();
          setStatus("No ideas found. Create one to begin.", false);
          return;
        }

        await loadIdea(state.selectedId);
      }

      async function loadIdea(ideaId) {
        const idea = await requestJson(
          "/api/ideas/" + encodeURIComponent(ideaId) + "?includeConversation=true"
        );
        state.selectedId = idea.id;
        state.selectedIdea = idea;
        renderIdeaList();
        renderIdeaDetail();
        setStatus("Loaded " + idea.id, false);
      }

      document.getElementById("create-provider").addEventListener("change", (event) => {
        fillModelSelect(document.getElementById("create-model"), event.target.value, "");
      });

      document.getElementById("idea-provider").addEventListener("change", (event) => {
        fillModelSelect(document.getElementById("idea-model"), event.target.value, "");
      });

      createForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          const payload = {
            title: document.getElementById("create-title").value.trim(),
            id: document.getElementById("create-id").value.trim() || undefined,
            description: document.getElementById("create-description").value,
            runtimeProvider: document.getElementById("create-provider").value,
            runtimeModel: document.getElementById("create-model").value,
            agentPreset: document.getElementById("create-agent").value || null
          };
          if (!payload.title) {
            throw new Error("Title is required.");
          }
          const created = await requestJson("/api/ideas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          createForm.reset();
          renderRuntimeSelectors();
          await loadIdeas(created.id);
          setStatus("Created " + created.id, false);
        } catch (error) {
          setStatus(error.message, true);
        }
      });

      docForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!state.selectedId) {
          setStatus("Select an idea first.", true);
          return;
        }

        try {
          const payload = {
            title: document.getElementById("idea-title").value.trim(),
            status: document.getElementById("idea-status").value,
            rootTaskId: document.getElementById("idea-root-task").value.trim(),
            rootMilestone: document.getElementById("idea-root-milestone").value.trim(),
            runtimeProvider: document.getElementById("idea-provider").value,
            runtimeModel: document.getElementById("idea-model").value,
            agentPreset: document.getElementById("idea-agent").value || null,
            markdown: document.getElementById("idea-markdown").value
          };
          await requestJson("/api/ideas/" + encodeURIComponent(state.selectedId) + "/document", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          await loadIdeas(state.selectedId);
          setStatus("Saved idea.md for " + state.selectedId, false);
        } catch (error) {
          setStatus(error.message, true);
        }
      });

      migrateRuntimeBtn.addEventListener("click", async () => {
        if (!state.selectedId) {
          setStatus("Select an idea first.", true);
          return;
        }

        try {
          await requestJson("/api/ideas/" + encodeURIComponent(state.selectedId) + "/runtime", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              runtimeProvider: document.getElementById("idea-provider").value,
              runtimeModel: document.getElementById("idea-model").value,
              agentPreset: document.getElementById("idea-agent").value || null
            })
          });
          await loadIdea(state.selectedId);
          setStatus("Migrated idea runtime profile.", false);
        } catch (error) {
          setStatus(error.message, true);
        }
      });

      kickoffForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!state.selectedId) {
          setStatus("Select an idea first.", true);
          return;
        }

        try {
          const kickoff = await requestJson("/api/ideas/" + encodeURIComponent(state.selectedId) + "/kickoff", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              runtimeProvider: document.getElementById("idea-provider").value,
              runtimeModel: document.getElementById("idea-model").value,
              agentPreset: document.getElementById("idea-agent").value || null,
              context: document.getElementById("kickoff-context").value,
              system: document.getElementById("kickoff-system").value
            })
          });
          await loadIdea(state.selectedId);
          setStatus(
            "Kickoff generated via " + kickoff.completion.provider + "/" + kickoff.completion.model,
            false
          );
        } catch (error) {
          setStatus(error.message, true);
        }
      });

      conversationForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!state.selectedId) {
          setStatus("Select an idea first.", true);
          return;
        }

        try {
          const payload = {
            role: document.getElementById("conversation-role").value,
            content: document.getElementById("conversation-content").value.trim()
          };
          if (!payload.content) {
            throw new Error("Message content is required.");
          }
          await requestJson("/api/ideas/" + encodeURIComponent(state.selectedId) + "/conversation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          document.getElementById("conversation-content").value = "";
          await loadIdeas(state.selectedId);
          setStatus("Appended conversation entry.", false);
        } catch (error) {
          setStatus(error.message, true);
        }
      });

      reloadBtn.addEventListener("click", async () => {
        if (!state.selectedId) {
          return;
        }
        try {
          await loadIdea(state.selectedId);
          setStatus("Reloaded " + state.selectedId, false);
        } catch (error) {
          setStatus(error.message, true);
        }
      });

      setDetailEnabled(false);
      loadRuntimeContext()
        .then(() => loadIdeas())
        .catch((error) => {
          setStatus(error.message, true);
        });
    </script>
  </body>
</html>`;
}

module.exports = {
  createIdeasPage
};
