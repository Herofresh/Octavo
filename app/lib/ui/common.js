export function byId(id) {
  return document.getElementById(id);
}

export function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatTimestamp(value) {
  if (!value) {
    return "n/a";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString();
}

export function toInputValue(value) {
  return typeof value === "string" ? value : "";
}

export function optionHtml(value, label, selected = false) {
  return `<option value="${escapeHtml(value)}"${selected ? " selected" : ""}>${escapeHtml(label)}</option>`;
}

export function setStatus(statusEl, message, type = "default") {
  statusEl.textContent = message;
  if (type === "error") {
    statusEl.className = "status error";
    return;
  }
  if (type === "ok") {
    statusEl.className = "status ok";
    return;
  }
  statusEl.className = "status";
}

export async function requestJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload && payload.message ? payload.message : "Request failed");
  }
  return payload;
}

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function toBacklogStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "done") {
    return "Done";
  }
  if (normalized === "executing" || normalized === "approved") {
    return "In Progress";
  }
  return "To Do";
}
