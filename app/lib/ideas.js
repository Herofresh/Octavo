const fs = require("node:fs/promises");
const path = require("node:path");

const { parseFrontmatterDocument, stringifyFrontmatterDocument } = require("./frontmatter");
const { toOptionalString } = require("./normalize");
const { REPO_ROOT, resolveWorkspacePath } = require("./storage");

const IDEA_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const IDEA_STATUSES = new Set(["new", "planning", "approved", "executing", "done", "blocked"]);
const IDEA_REFINEMENT_STAGES = new Set(["discovery", "scope", "plan", "ready"]);

function toRepoRelativePath(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath).split(path.sep).join("/");
}

function validateIdeaId(ideaId) {
  if (typeof ideaId !== "string" || !IDEA_ID_PATTERN.test(ideaId)) {
    const error = new Error(
      "Invalid ideaId. Use letters, numbers, dots, underscores, or hyphens."
    );
    error.code = "INVALID_IDEA_ID";
    throw error;
  }

  return ideaId;
}

function toIdeaStatus(value, fallback = "planning") {
  const normalized = toOptionalString(value);
  if (!normalized) {
    return fallback;
  }

  const lowered = normalized.toLowerCase();
  if (!IDEA_STATUSES.has(lowered)) {
    return fallback;
  }

  return lowered;
}

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getIdeaPaths(ideaId) {
  const safeIdeaId = validateIdeaId(ideaId);
  const ideaDir = resolveWorkspacePath("ideas", safeIdeaId);
  const ideaFile = path.join(ideaDir, "idea.md");
  const conversationFile = path.join(ideaDir, "conversation.ndjson");

  return {
    ideaId: safeIdeaId,
    ideaDir,
    ideaFile,
    conversationFile,
    relativeIdeaDir: toRepoRelativePath(ideaDir),
    relativeIdeaFile: toRepoRelativePath(ideaFile),
    relativeConversationFile: toRepoRelativePath(conversationFile)
  };
}

function createIdeaTemplate(title, description) {
  return [
    `# Idea: ${title}`,
    "",
    "## Summary",
    "",
    toOptionalString(description) || "_No summary yet._",
    "",
    "## Planning",
    "",
    "_No planning notes yet._",
    "",
    "## Decisions",
    "",
    "_No decisions yet._",
    "",
    "## Open Questions",
    "",
    "_No open questions yet._",
    "",
    "## Next Steps",
    "",
    "_No next steps yet._",
    "",
    "## Discussion Highlights",
    "",
    "_No discussion highlights yet._"
  ].join("\n");
}

function parseH2SectionRange(lines, heading) {
  const sectionHeading = `## ${heading}`;
  const start = lines.findIndex((line) => line.trim() === sectionHeading);
  if (start === -1) {
    return null;
  }

  let end = lines.findIndex((line, index) => index > start && /^##\s+/.test(line));
  if (end === -1) {
    end = lines.length;
  }

  return {
    start,
    end
  };
}

function upsertIdeaSection(markdown, heading, sectionBody) {
  const lines = markdown.split("\n");
  const sectionRange = parseH2SectionRange(lines, heading);
  const safeBody =
    typeof sectionBody === "string" && sectionBody.trim()
      ? sectionBody.trim().split(/\r?\n/)
      : ["_No notes yet._"];
  const replacement = [`## ${heading}`, "", ...safeBody];

  if (!sectionRange) {
    const trimmed = markdown.replace(/\s*$/, "");
    return `${trimmed}\n\n${replacement.join("\n")}\n`;
  }

  lines.splice(sectionRange.start, sectionRange.end - sectionRange.start, ...replacement);
  return `${lines.join("\n").replace(/\s*$/, "")}\n`;
}

function appendDiscussionHighlight(markdown, highlightLine) {
  const sectionHeading = "## Discussion Highlights";
  const lines = markdown.split("\n");
  let sectionIndex = lines.findIndex((line) => line.trim() === sectionHeading);

  if (sectionIndex === -1) {
    const trimmed = markdown.replace(/\s*$/, "");
    return `${trimmed}\n\n${sectionHeading}\n\n${highlightLine}\n`;
  }

  let nextHeadingIndex = lines.findIndex((line, index) => index > sectionIndex && /^##\s+/.test(line));
  if (nextHeadingIndex === -1) {
    nextHeadingIndex = lines.length;
  }

  const sectionLines = lines.slice(sectionIndex + 1, nextHeadingIndex);
  const hasOnlyPlaceholder = sectionLines.every(
    (line) => !line.trim() || line.trim() === "_No discussion highlights yet._"
  );

  const nextSectionLines = hasOnlyPlaceholder ? [highlightLine] : [...sectionLines, highlightLine];
  lines.splice(sectionIndex + 1, nextHeadingIndex - (sectionIndex + 1), ...nextSectionLines);
  return `${lines.join("\n").replace(/\s*$/, "")}\n`;
}

function toRefinementStage(value, fallback = null) {
  if (typeof value === "undefined") {
    return fallback;
  }

  const normalized = toOptionalString(value);
  if (!normalized) {
    return null;
  }

  const lowered = normalized.toLowerCase();
  if (!IDEA_REFINEMENT_STAGES.has(lowered)) {
    const error = new Error(
      `Invalid refinement stage: ${value}. Use one of: ${Array.from(IDEA_REFINEMENT_STAGES).join(", ")}.`
    );
    error.code = "INVALID_IDEA_REFINEMENT";
    throw error;
  }

  return lowered;
}

function readRefinementStage(value, fallback = null) {
  const normalized = toOptionalString(value);
  if (!normalized) {
    return fallback;
  }

  const lowered = normalized.toLowerCase();
  return IDEA_REFINEMENT_STAGES.has(lowered) ? lowered : fallback;
}

function toRefinementList(value, fieldName) {
  if (typeof value === "undefined") {
    return null;
  }

  if (!Array.isArray(value)) {
    const error = new Error(`${fieldName} must be an array of strings.`);
    error.code = "INVALID_IDEA_REFINEMENT";
    throw error;
  }

  return value.map((item) => toOptionalString(item)).filter(Boolean);
}

function toOptionalRefinementString(value, fieldName) {
  if (typeof value === "undefined") {
    return undefined;
  }

  if (typeof value !== "string") {
    const error = new Error(`${fieldName} must be a string.`);
    error.code = "INVALID_IDEA_REFINEMENT";
    throw error;
  }

  return toOptionalString(value) || "";
}

function toRefinementConversation(value) {
  if (typeof value === "undefined") {
    return null;
  }

  if (!value || typeof value !== "object") {
    const error = new Error("conversation must be an object with content.");
    error.code = "INVALID_IDEA_REFINEMENT";
    throw error;
  }

  const content = toOptionalString(value.content);
  if (!content) {
    const error = new Error("conversation.content is required when conversation is provided.");
    error.code = "INVALID_IDEA_REFINEMENT";
    throw error;
  }

  return {
    role: toOptionalString(value.role) || "assistant",
    content,
    metadata: value.metadata && typeof value.metadata === "object" ? value.metadata : {}
  };
}

async function readIdeaMarkdown(paths) {
  const raw = await fs.readFile(paths.ideaFile, "utf8");
  const { meta, body } = parseFrontmatterDocument(raw);
  return {
    meta,
    body
  };
}

async function readConversationEntries(paths, limit = null) {
  let raw = "";
  try {
    raw = await fs.readFile(paths.conversationFile, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const entries = raw
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  if (typeof limit === "number" && Number.isFinite(limit) && limit >= 0) {
    return entries.slice(-limit);
  }

  return entries;
}

async function writeIdeaMarkdown(paths, meta, body) {
  const content = stringifyFrontmatterDocument(meta, body);
  await fs.writeFile(paths.ideaFile, content, "utf8");
}

function normalizeIdeaRecord(paths, meta, body, conversationCount) {
  return {
    id: meta.id || paths.ideaId,
    title: meta.title || paths.ideaId,
    status: toIdeaStatus(meta.status, "planning"),
    rootLink: {
      taskId: toOptionalString(meta.rootTaskId),
      milestone: toOptionalString(meta.rootMilestone)
    },
    spawnedProjectId: toOptionalString(meta.spawnedProjectId),
    refinement: {
      stage: readRefinementStage(meta.refinementStage, null)
    },
    createdAt: toOptionalString(meta.createdAt),
    updatedAt: toOptionalString(meta.updatedAt),
    files: {
      ideaDir: paths.relativeIdeaDir,
      ideaFile: paths.relativeIdeaFile,
      conversationFile: paths.relativeConversationFile
    },
    markdown: body,
    conversationCount
  };
}

async function getIdea(ideaId, options = {}) {
  const paths = getIdeaPaths(ideaId);
  try {
    const { meta, body } = await readIdeaMarkdown(paths);
    const includeConversation = options.includeConversation === true;
    const conversationLimit = options.conversationLimit;
    const conversation = includeConversation
      ? await readConversationEntries(paths, conversationLimit)
      : [];
    const conversationCount = includeConversation
      ? conversation.length
      : (await readConversationEntries(paths)).length;
    const idea = normalizeIdeaRecord(paths, meta, body, conversationCount);

    if (includeConversation) {
      return {
        ...idea,
        conversation
      };
    }

    return idea;
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function requireIdea(ideaId, options = {}) {
  const idea = await getIdea(ideaId, options);
  if (!idea) {
    const error = new Error(`Idea not found: ${ideaId}`);
    error.code = "IDEA_NOT_FOUND";
    throw error;
  }

  return idea;
}

async function listIdeas() {
  const ideasRoot = resolveWorkspacePath("ideas");
  let entries = [];

  try {
    entries = await fs.readdir(ideasRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const ideas = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const idea = await getIdea(entry.name);
    if (idea) {
      ideas.push(idea);
    }
  }

  ideas.sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt || left.createdAt || 0);
    const rightTime = Date.parse(right.updatedAt || right.createdAt || 0);
    return rightTime - leftTime;
  });

  return ideas;
}

async function generateIdeaIdFromTitle(title) {
  const baseDate = new Date().toISOString().slice(0, 10);
  const slug = slugify(title || "idea") || "idea";
  const baseId = `${baseDate}-${slug}`;

  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const candidate = suffix === 0 ? baseId : `${baseId}-${suffix}`;
    const paths = getIdeaPaths(candidate);
    try {
      await fs.access(paths.ideaDir);
    } catch (error) {
      if (error.code === "ENOENT") {
        return candidate;
      }
      throw error;
    }
  }

  throw new Error("Unable to allocate idea id.");
}

async function createIdea(input = {}) {
  const title = toOptionalString(input.title);
  if (!title) {
    const error = new Error("Idea title is required.");
    error.code = "INVALID_IDEA_TITLE";
    throw error;
  }

  const requestedId = toOptionalString(input.id);
  const ideaId = requestedId ? validateIdeaId(requestedId) : await generateIdeaIdFromTitle(title);
  const paths = getIdeaPaths(ideaId);

  try {
    await fs.access(paths.ideaDir);
    const error = new Error(`Idea already exists: ${ideaId}`);
    error.code = "IDEA_ALREADY_EXISTS";
    throw error;
  } catch (error) {
    if (error.code && error.code !== "ENOENT") {
      throw error;
    }
  }

  await fs.mkdir(paths.ideaDir, { recursive: true });
  const now = new Date().toISOString();
  const meta = {
    id: ideaId,
    title,
    status: toIdeaStatus(input.status, "planning"),
    refinementStage: toRefinementStage(input.refinementStage, "discovery"),
    rootTaskId: toOptionalString(input.rootTaskId),
    rootMilestone: toOptionalString(input.rootMilestone),
    spawnedProjectId: null,
    createdAt: now,
    updatedAt: now
  };
  const body = createIdeaTemplate(title, input.description);
  await writeIdeaMarkdown(paths, meta, body);
  await fs.writeFile(paths.conversationFile, "", "utf8");

  return getIdea(ideaId);
}

async function updateIdeaDocument(ideaId, input = {}) {
  const paths = getIdeaPaths(ideaId);
  const existing = await requireIdea(ideaId);
  const { meta, body } = await readIdeaMarkdown(paths);
  const now = new Date().toISOString();

  const nextMeta = {
    ...meta,
    id: existing.id,
    title: toOptionalString(input.title) || meta.title || existing.title,
    status: toIdeaStatus(input.status, meta.status || existing.status || "planning"),
    rootTaskId:
      typeof input.rootTaskId === "string" ? toOptionalString(input.rootTaskId) : meta.rootTaskId,
    rootMilestone:
      typeof input.rootMilestone === "string"
        ? toOptionalString(input.rootMilestone)
        : meta.rootMilestone,
    spawnedProjectId: toOptionalString(meta.spawnedProjectId),
    createdAt: meta.createdAt || existing.createdAt || now,
    updatedAt: now
  };

  let nextBody = body;
  if (typeof input.markdown === "string") {
    nextBody = input.markdown;
  }

  if (typeof input.appendMarkdown === "string" && input.appendMarkdown.trim()) {
    const trimmedBody = nextBody.replace(/\s*$/, "");
    nextBody = `${trimmedBody}\n\n${input.appendMarkdown.trim()}\n`;
  }

  await writeIdeaMarkdown(paths, nextMeta, nextBody);
  return getIdea(ideaId);
}

async function applyIdeaRefinement(ideaId, input = {}) {
  const paths = getIdeaPaths(ideaId);
  const existing = await requireIdea(ideaId);
  const { meta, body } = await readIdeaMarkdown(paths);
  const now = new Date().toISOString();
  const summary = toOptionalRefinementString(input.summary, "summary");
  const planning = toOptionalRefinementString(input.planning, "planning");
  const decisions = toRefinementList(input.decisions, "decisions");
  const openQuestions = toRefinementList(input.openQuestions, "openQuestions");
  const nextSteps = toRefinementList(input.nextSteps, "nextSteps");
  const highlight = toOptionalRefinementString(input.highlight, "highlight");
  const conversation = toRefinementConversation(input.conversation);
  const stage = toRefinementStage(
    input.stage,
    readRefinementStage(meta.refinementStage, readRefinementStage(existing.refinement?.stage, "discovery"))
  );
  const status =
    typeof input.status === "undefined"
      ? toIdeaStatus(meta.status || existing.status || "planning")
      : toIdeaStatus(input.status, meta.status || existing.status || "planning");

  const hasUpdate =
    typeof summary !== "undefined" ||
    typeof planning !== "undefined" ||
    decisions !== null ||
    openQuestions !== null ||
    nextSteps !== null ||
    typeof highlight !== "undefined" ||
    conversation !== null ||
    typeof input.stage !== "undefined" ||
    typeof input.status !== "undefined";

  if (!hasUpdate) {
    const error = new Error(
      "Refinement update requires at least one field (summary, planning, decisions, openQuestions, nextSteps, stage, status, highlight, or conversation)."
    );
    error.code = "INVALID_IDEA_REFINEMENT";
    throw error;
  }

  const updatedSections = [];
  let nextBody = body;

  if (typeof summary !== "undefined") {
    nextBody = upsertIdeaSection(nextBody, "Summary", summary || "_No summary yet._");
    updatedSections.push("Summary");
  }

  if (typeof planning !== "undefined") {
    nextBody = upsertIdeaSection(nextBody, "Planning", planning || "_No planning notes yet._");
    updatedSections.push("Planning");
  }

  if (decisions !== null) {
    const decisionBody =
      decisions.length > 0 ? decisions.map((item) => `- ${item}`).join("\n") : "_No decisions yet._";
    nextBody = upsertIdeaSection(nextBody, "Decisions", decisionBody);
    updatedSections.push("Decisions");
  }

  if (openQuestions !== null) {
    const openQuestionBody =
      openQuestions.length > 0
        ? openQuestions.map((item) => `- ${item}`).join("\n")
        : "_No open questions yet._";
    nextBody = upsertIdeaSection(nextBody, "Open Questions", openQuestionBody);
    updatedSections.push("Open Questions");
  }

  if (nextSteps !== null) {
    const nextStepsBody =
      nextSteps.length > 0 ? nextSteps.map((item) => `- ${item}`).join("\n") : "_No next steps yet._";
    nextBody = upsertIdeaSection(nextBody, "Next Steps", nextStepsBody);
    updatedSections.push("Next Steps");
  }

  const appendedHighlights = [];
  if (typeof highlight !== "undefined" && highlight) {
    const highlightLine = `- [${now}] **refinement**: ${highlight}`;
    nextBody = appendDiscussionHighlight(nextBody, highlightLine);
    appendedHighlights.push(highlightLine);
  }

  let entry = null;
  if (conversation) {
    entry = {
      at: now,
      role: conversation.role,
      content: conversation.content,
      metadata: {
        ...conversation.metadata,
        type: "refinement",
        stage
      }
    };
    await fs.appendFile(paths.conversationFile, `${JSON.stringify(entry)}\n`, "utf8");

    const conversationHighlight = `- [${now}] **${entry.role}** (refinement): ${entry.content}`;
    nextBody = appendDiscussionHighlight(nextBody, conversationHighlight);
    appendedHighlights.push(conversationHighlight);
  }

  const nextMeta = {
    ...meta,
    id: existing.id,
    title: meta.title || existing.title,
    status,
    refinementStage: stage,
    rootTaskId: toOptionalString(meta.rootTaskId) || existing.rootLink?.taskId || null,
    rootMilestone: toOptionalString(meta.rootMilestone) || existing.rootLink?.milestone || null,
    spawnedProjectId: toOptionalString(meta.spawnedProjectId) || existing.spawnedProjectId || null,
    createdAt: meta.createdAt || existing.createdAt || now,
    updatedAt: now
  };

  await writeIdeaMarkdown(paths, nextMeta, nextBody);

  return {
    idea: await getIdea(ideaId),
    refinement: {
      stage,
      updatedSections,
      appendedHighlights
    },
    entry
  };
}

async function appendIdeaConversation(ideaId, input = {}) {
  const paths = getIdeaPaths(ideaId);
  const { meta, body } = await readIdeaMarkdown(paths);
  const content = toOptionalString(input.content);
  if (!content) {
    const error = new Error("Conversation content is required.");
    error.code = "INVALID_IDEA_CONVERSATION";
    throw error;
  }

  const role = toOptionalString(input.role) || "user";
  const now = new Date().toISOString();
  const entry = {
    at: now,
    role,
    content,
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {}
  };

  await fs.appendFile(paths.conversationFile, `${JSON.stringify(entry)}\n`, "utf8");

  const nextMeta = {
    ...meta,
    updatedAt: now
  };
  const highlightLine = `- [${now}] **${role}**: ${content}`;
  const nextBody = appendDiscussionHighlight(body, highlightLine);
  await writeIdeaMarkdown(paths, nextMeta, nextBody);

  return {
    idea: await getIdea(ideaId),
    entry
  };
}

async function markIdeaProjectSpawned(ideaId, execution = {}) {
  const projectId = toOptionalString(execution.projectId);
  if (!projectId) {
    const error = new Error("projectId is required.");
    error.code = "INVALID_PROJECT_ID";
    throw error;
  }

  const paths = getIdeaPaths(ideaId);
  const { meta, body } = await readIdeaMarkdown(paths);
  const now = new Date().toISOString();
  const nextMeta = {
    ...meta,
    spawnedProjectId: projectId,
    status: toIdeaStatus(meta.status, "planning") === "planning" ? "approved" : meta.status,
    updatedAt: now
  };
  await writeIdeaMarkdown(paths, nextMeta, body);
  return getIdea(ideaId);
}

module.exports = {
  applyIdeaRefinement,
  appendIdeaConversation,
  createIdea,
  getIdea,
  getIdeaPaths,
  listIdeas,
  markIdeaProjectSpawned,
  requireIdea,
  updateIdeaDocument,
  validateIdeaId
};
