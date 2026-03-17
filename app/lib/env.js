const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ENV_FILE_NAMES = [".env", ".env.local"];
let loaded = false;

function stripSurroundingQuotes(value) {
  if (value.length < 2) {
    return value;
  }

  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }

  return value;
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null;
  }

  const rawValue = trimmed.slice(separatorIndex + 1).trim();
  const value = stripSurroundingQuotes(rawValue);
  return {
    key,
    value
  };
}

function loadEnvFile(absolutePath, options = {}) {
  const override = options.override === true;
  const preexisting = options.preexisting || new Set();
  let raw = "";
  try {
    raw = fs.readFileSync(absolutePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return;
    }
    throw error;
  }

  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const entry = parseEnvLine(line);
    if (!entry) {
      continue;
    }

    const isShellProvided = preexisting.has(entry.key);
    if (!isShellProvided && (typeof process.env[entry.key] === "undefined" || override)) {
      process.env[entry.key] = entry.value;
    }
  }
}

function loadEnvFiles() {
  if (loaded) {
    return;
  }

  const preexisting = new Set(Object.keys(process.env));
  loadEnvFile(path.join(REPO_ROOT, ".env"), {
    preexisting,
    override: false
  });
  loadEnvFile(path.join(REPO_ROOT, ".env.local"), {
    preexisting,
    override: true
  });
  loaded = true;
}

module.exports = {
  loadEnvFiles
};
