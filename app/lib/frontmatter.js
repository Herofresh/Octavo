function parseFrontmatterDocument(markdown) {
  if (typeof markdown !== "string") {
    return {
      meta: {},
      body: ""
    };
  }

  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (lines[0] !== "---") {
    return {
      meta: {},
      body: normalized
    };
  }

  let boundaryIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === "---") {
      boundaryIndex = index;
      break;
    }
  }

  if (boundaryIndex === -1) {
    return {
      meta: {},
      body: normalized
    };
  }

  const metaLines = lines.slice(1, boundaryIndex);
  const body = lines.slice(boundaryIndex + 1).join("\n").replace(/^\n/, "");
  const meta = {};

  for (const line of metaLines) {
    const match = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    const rawValue = match[2];
    if (!rawValue || rawValue === "null") {
      meta[key] = null;
      continue;
    }

    try {
      meta[key] = JSON.parse(rawValue);
    } catch {
      meta[key] = rawValue;
    }
  }

  return {
    meta,
    body
  };
}

function stringifyFrontmatterDocument(meta = {}, body = "") {
  const lines = ["---"];
  for (const [key, value] of Object.entries(meta)) {
    lines.push(`${key}: ${JSON.stringify(value ?? null)}`);
  }
  lines.push("---");
  lines.push("");
  lines.push(typeof body === "string" ? body.replace(/^\n+/, "") : "");
  return `${lines.join("\n").replace(/\s*$/, "")}\n`;
}

module.exports = {
  parseFrontmatterDocument,
  stringifyFrontmatterDocument
};
