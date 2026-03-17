import { byId, escapeHtml, requestJson, setStatus } from "./common.js";

const statusEl = byId("status-line");
const refreshBtn = byId("refresh-btn");
const browserMetaEl = byId("browser-meta");
const browserFrameEl = byId("browser-frame");

function renderBacklog(backlog) {
  byId("metric-total").textContent = String(backlog.summary?.total || 0);
  byId("metric-done").textContent = String(backlog.summary?.done || 0);
  byId("metric-pending").textContent = String(backlog.summary?.pending || 0);
  byId("metric-source").textContent = backlog.source || "backlog.md";

  const byStatus = backlog.summary?.byStatus || {};
  const statuses = Object.keys(byStatus);
  byId("status-breakdown").innerHTML = statuses.length
    ? statuses.map((name) => `<li>${escapeHtml(name)}: ${byStatus[name]}</li>`).join("")
    : "<li>No status groups found.</li>";

  const tasks = Array.isArray(backlog.tasks) ? backlog.tasks : [];
  byId("tasks-body").innerHTML = tasks.length
    ? tasks
        .map((task) => {
          return `<tr>
            <td><code>${escapeHtml(task.id || "")}</code></td>
            <td>${escapeHtml(task.title || "")}</td>
            <td>${escapeHtml(task.status || "")}</td>
          </tr>`;
        })
        .join("")
    : '<tr><td colspan="3" class="empty">No tasks found.</td></tr>';
}

function renderBacklogBrowser(browser) {
  if (!browser?.url) {
    browserMetaEl.textContent = "Backlog browser URL unavailable.";
    return;
  }

  const runningLabel = browser.running ? "running" : "starting";
  browserMetaEl.textContent = `Browser ${runningLabel} on ${browser.url} (pid: ${browser.pid || "n/a"}).`;

  if (browserFrameEl.getAttribute("src") !== browser.url) {
    browserFrameEl.setAttribute("src", browser.url);
  }
}

async function loadBacklogScreen() {
  const [backlog, browser] = await Promise.all([
    requestJson("/api/backlog"),
    requestJson("/api/backlog/browser?ensure=true")
  ]);
  renderBacklog(backlog);
  renderBacklogBrowser(browser);
}

refreshBtn.addEventListener("click", async () => {
  try {
    await loadBacklogScreen();
    setStatus(statusEl, "Backlog refreshed.", "ok");
  } catch (error) {
    setStatus(statusEl, error.message, "error");
  }
});

loadBacklogScreen()
  .then(() => {
    setStatus(statusEl, "Backlog overview loaded.");
  })
  .catch((error) => {
    setStatus(statusEl, error.message, "error");
  });
