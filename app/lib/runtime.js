const DEFAULT_PROVIDER = process.env.OCTAVO_RUNTIME_PROVIDER || "mock";
const DEFAULT_MODEL = process.env.OCTAVO_RUNTIME_MODEL || "mock-1";
const { toOptionalString } = require("./normalize");

const runtimeProviders = new Map();

function assertPrompt(prompt) {
  const normalized = toOptionalString(prompt);
  if (!normalized) {
    const error = new Error("Runtime prompt is required.");
    error.code = "INVALID_RUNTIME_PROMPT";
    throw error;
  }

  return normalized;
}

function registerRuntimeProvider(providerName, handler) {
  if (typeof providerName !== "string" || !providerName.trim()) {
    throw new Error("Runtime provider name must be a non-empty string.");
  }

  if (typeof handler !== "function") {
    throw new Error("Runtime provider handler must be a function.");
  }

  runtimeProviders.set(providerName.trim(), handler);
}

function listRuntimeProviders() {
  return Array.from(runtimeProviders.keys()).sort((left, right) => left.localeCompare(right));
}

function getRuntimeProvider(providerName) {
  const provider = runtimeProviders.get(providerName);
  if (!provider) {
    const error = new Error(`Unknown runtime provider: ${providerName}`);
    error.code = "RUNTIME_PROVIDER_NOT_FOUND";
    throw error;
  }

  return provider;
}

function getDefaultRuntimeConfig() {
  return {
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL
  };
}

async function runRuntimeCompletion(input = {}) {
  const prompt = assertPrompt(input.prompt);
  const providerName = toOptionalString(input.provider) || DEFAULT_PROVIDER;
  const model = toOptionalString(input.model) || DEFAULT_MODEL;
  const provider = getRuntimeProvider(providerName);

  const completion = await provider({
    prompt,
    model,
    system: toOptionalString(input.system),
    metadata: typeof input.metadata === "object" && input.metadata !== null ? input.metadata : {}
  });

  return {
    provider: providerName,
    model,
    output: completion.output,
    finishReason: completion.finishReason || "stop",
    usage: completion.usage || {
      inputChars: prompt.length,
      outputChars: typeof completion.output === "string" ? completion.output.length : 0
    },
    createdAt: new Date().toISOString()
  };
}

registerRuntimeProvider("mock", async ({ prompt, model }) => {
  return {
    output: `[${model}] ${prompt}`,
    finishReason: "stop",
    usage: {
      inputChars: prompt.length,
      outputChars: model.length + prompt.length + 3
    }
  };
});

module.exports = {
  getDefaultRuntimeConfig,
  listRuntimeProviders,
  registerRuntimeProvider,
  runRuntimeCompletion
};
