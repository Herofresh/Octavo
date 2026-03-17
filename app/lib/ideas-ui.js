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
        max-width: 1400px;
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
        grid-template-columns: 340px minmax(0, 1fr);
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
        max-height: 48vh;
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

      @media (max-width: 980px) {
        .layout {
          grid-template-columns: 1fr;
        }

        .idea-list, .timeline {
          max-height: 220px;
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
            <div class="actions">
              <button type="submit">Create</button>
            </div>
          </form>

          <h3 style="margin-top: 14px">Ideas</h3>
          <div class="idea-list" id="idea-list"></div>
        </aside>

        <section class="panel">
          <h2>Idea Document</h2>
          <p class="idea-meta" id="idea-meta">No idea selected.</p>
          <form id="idea-document-form">
            <label>Title
              <input id="idea-title" name="title" />
            </label>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;">
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
            <label>idea.md (markdown)
              <textarea id="idea-markdown" name="markdown" style="min-height:260px;"></textarea>
            </label>
            <div class="actions">
              <button type="submit">Save Document</button>
              <button class="secondary" type="button" id="reload-idea-btn">Reload</button>
            </div>
          </form>

          <section class="conversation">
            <h3>Conversation Timeline</h3>
            <ul class="timeline" id="idea-conversation"></ul>
            <form id="idea-conversation-form">
              <div style="display:grid;grid-template-columns:160px 1fr;gap:8px;">
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
      const reloadBtn = document.getElementById("reload-idea-btn");

      const state = {
        ideas: [],
        selectedId: null,
        selectedIdea: null
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
        reloadBtn.disabled = !enabled;
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
          setDetailEnabled(false);
          return;
        }

        setDetailEnabled(true);
        ideaMetaEl.textContent =
          "ideaId: " + idea.id +
          " | updated: " + formatTimestamp(idea.updatedAt) +
          " | conversation: " + String(idea.conversationCount || 0);

        document.getElementById("idea-title").value = toInputValue(idea.title);
        document.getElementById("idea-status").value = toInputValue(idea.status || "planning");
        document.getElementById("idea-root-task").value = toInputValue(idea.rootLink && idea.rootLink.taskId);
        document.getElementById("idea-root-milestone").value = toInputValue(idea.rootLink && idea.rootLink.milestone);
        document.getElementById("idea-markdown").value = toInputValue(idea.markdown);

        const conversation = Array.isArray(idea.conversation) ? idea.conversation : [];
        timelineEl.innerHTML = "";
        if (conversation.length === 0) {
          timelineEl.innerHTML = '<li class="empty">No conversation entries yet.</li>';
          return;
        }

        for (const entry of conversation.slice().reverse()) {
          const item = document.createElement("li");
          item.innerHTML =
            '<div class="meta">' +
            escapeHtml(entry.role || "user") +
            " @ " +
            escapeHtml(formatTimestamp(entry.at)) +
            "</div><div>" +
            escapeHtml(entry.content || "") +
            "</div>";
          timelineEl.appendChild(item);
        }
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

      createForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          const payload = {
            title: document.getElementById("create-title").value.trim(),
            id: document.getElementById("create-id").value.trim() || undefined,
            description: document.getElementById("create-description").value
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
      loadIdeas().catch((error) => {
        setStatus(error.message, true);
      });
    </script>
  </body>
</html>`;
}

module.exports = {
  createIdeasPage
};
