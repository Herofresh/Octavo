const { loadEnvFiles } = require("./env");
const { toOptionalString } = require("./normalize");

loadEnvFiles();

const runtimeProviders = new Map();
const OPENAI_BASE_URL = process.env.OCTAVO_OPENAI_BASE_URL || "https://api.openai.com/v1";
const GEMINI_BASE_URL =
  process.env.OCTAVO_GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_OPENAI_MODELS = ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "gpt-5-codex"];
const DEFAULT_GEMINI_MODELS = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro"];

function toRuntimeError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function parseModelList(envValue, fallback = []) {
  const normalized = toOptionalString(envValue);
  if (!normalized) {
    return fallback;
  }

  return normalized
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getApiKey(...keys) {
  for (const key of keys) {
    const value = toOptionalString(process.env[key]);
    if (value) {
      return value;
    }
  }

  return null;
}

function toOpenAiLikeText(content) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object" && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function toGeminiText(candidate) {
  const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n");
}

async function postJson(url, payload, options = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      toOptionalString(data?.error?.message) ||
      toOptionalString(data?.message) ||
      `Runtime provider request failed (${response.status}).`;
    throw toRuntimeError("RUNTIME_COMPLETION_FAILED", message);
  }

  return data;
}

function assertPrompt(prompt) {
  const normalized = toOptionalString(prompt);
  if (!normalized) {
    const error = new Error("Runtime prompt is required.");
    error.code = "INVALID_RUNTIME_PROMPT";
    throw error;
  }

  return normalized;
}

function registerRuntimeProvider(providerName, config) {
  if (typeof providerName !== "string" || !providerName.trim()) {
    throw new Error("Runtime provider name must be a non-empty string.");
  }

  const handler = typeof config === "function" ? config : config?.handler;
  if (typeof handler !== "function") {
    throw new Error("Runtime provider handler must be a function.");
  }

  runtimeProviders.set(providerName.trim(), {
    id: providerName.trim(),
    label:
      typeof config === "object" && config && toOptionalString(config.label)
        ? config.label
        : providerName.trim(),
    models:
      typeof config === "object" && config && Array.isArray(config.models) ? config.models : [],
    env:
      typeof config === "object" && config && Array.isArray(config.env) ? config.env : [],
    isConfigured:
      typeof config === "object" && config && typeof config.isConfigured === "function"
        ? config.isConfigured
        : () => true,
    handler
  });
}

function listRuntimeProviders() {
  return Array.from(runtimeProviders.values())
    .map((provider) => ({
      id: provider.id,
      label: provider.label,
      models: provider.models,
      env: provider.env,
      configured: provider.isConfigured()
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function getRuntimeProvider(providerName) {
  const provider = runtimeProviders.get(toOptionalString(providerName));
  if (!provider) {
    const error = new Error(`Unknown runtime provider: ${providerName}`);
    error.code = "RUNTIME_PROVIDER_NOT_FOUND";
    throw error;
  }

  return provider;
}

function pickDefaultProvider() {
  const configured = listRuntimeProviders().find((provider) => provider.configured);
  return (
    toOptionalString(process.env.OCTAVO_RUNTIME_PROVIDER) ||
    configured?.id ||
    "mock"
  );
}

function pickDefaultModel(providerName) {
  const explicitModel = toOptionalString(process.env.OCTAVO_RUNTIME_MODEL);
  if (explicitModel) {
    return explicitModel;
  }

  const provider = runtimeProviders.get(providerName);
  if (!provider || !Array.isArray(provider.models) || provider.models.length === 0) {
    return "mock-1";
  }

  return provider.models[0];
}

function getDefaultRuntimeConfig() {
  const provider = pickDefaultProvider();
  return {
    provider,
    model: pickDefaultModel(provider)
  };
}

async function runRuntimeCompletion(input = {}) {
  const prompt = assertPrompt(input.prompt);
  const defaults = getDefaultRuntimeConfig();
  const providerName = toOptionalString(input.provider) || defaults.provider;
  const model = toOptionalString(input.model) || defaults.model;
  const provider = getRuntimeProvider(providerName);
  if (!provider.isConfigured()) {
    throw toRuntimeError(
      "RUNTIME_PROVIDER_NOT_CONFIGURED",
      `Provider ${providerName} is not configured. Missing required key: ${provider.env.join(" or ")}.`
    );
  }

  const completion = await provider.handler({
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

registerRuntimeProvider("mock", {
  label: "Mock",
  models: parseModelList(process.env.OCTAVO_MOCK_MODELS, ["mock-1"]),
  handler: async ({ prompt, model }) => {
    return {
      output: `[${model}] ${prompt}`,
      finishReason: "stop",
      usage: {
        inputChars: prompt.length,
        outputChars: model.length + prompt.length + 3
      }
    };
  }
});

registerRuntimeProvider("openai", {
  label: "OpenAI",
  env: ["OPENAI_API_KEY", "OCTAVO_OPENAI_API_KEY"],
  models: parseModelList(process.env.OCTAVO_OPENAI_MODELS, [
    process.env.OCTAVO_OPENAI_MODEL || DEFAULT_OPENAI_MODELS[0],
    ...DEFAULT_OPENAI_MODELS.filter((model) => model !== process.env.OCTAVO_OPENAI_MODEL)
  ]),
  isConfigured: () => Boolean(getApiKey("OPENAI_API_KEY", "OCTAVO_OPENAI_API_KEY")),
  handler: async ({ prompt, model, system, metadata }) => {
    const apiKey = getApiKey("OPENAI_API_KEY", "OCTAVO_OPENAI_API_KEY");
    if (!apiKey) {
      throw toRuntimeError(
        "RUNTIME_PROVIDER_NOT_CONFIGURED",
        "OPENAI_API_KEY (or OCTAVO_OPENAI_API_KEY) is required for OpenAI runtime."
      );
    }

    const messages = [];
    if (toOptionalString(system)) {
      messages.push({
        role: "system",
        content: system
      });
    }
    messages.push({
      role: "user",
      content: prompt
    });

    const body = {
      model,
      messages
    };
    if (typeof metadata?.temperature === "number") {
      body.temperature = metadata.temperature;
    }

    const response = await postJson(`${OPENAI_BASE_URL}/chat/completions`, body, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });
    const firstChoice = Array.isArray(response.choices) ? response.choices[0] : null;
    return {
      output: toOpenAiLikeText(firstChoice?.message?.content),
      finishReason: toOptionalString(firstChoice?.finish_reason) || "stop",
      usage: response.usage || null
    };
  }
});

registerRuntimeProvider("gemini", {
  label: "Google Gemini",
  env: ["GEMINI_API_KEY", "OCTAVO_GEMINI_API_KEY"],
  models: parseModelList(process.env.OCTAVO_GEMINI_MODELS, [
    process.env.OCTAVO_GEMINI_MODEL || DEFAULT_GEMINI_MODELS[0],
    ...DEFAULT_GEMINI_MODELS.filter((model) => model !== process.env.OCTAVO_GEMINI_MODEL)
  ]),
  isConfigured: () => Boolean(getApiKey("GEMINI_API_KEY", "OCTAVO_GEMINI_API_KEY")),
  handler: async ({ prompt, model, system, metadata }) => {
    const apiKey = getApiKey("GEMINI_API_KEY", "OCTAVO_GEMINI_API_KEY");
    if (!apiKey) {
      throw toRuntimeError(
        "RUNTIME_PROVIDER_NOT_CONFIGURED",
        "GEMINI_API_KEY (or OCTAVO_GEMINI_API_KEY) is required for Gemini runtime."
      );
    }

    const body = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ]
    };
    if (toOptionalString(system)) {
      body.systemInstruction = {
        parts: [{ text: system }]
      };
    }
    if (typeof metadata?.temperature === "number") {
      body.generationConfig = {
        temperature: metadata.temperature
      };
    }

    const endpoint =
      `${GEMINI_BASE_URL}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await postJson(endpoint, body);
    const firstCandidate = Array.isArray(response.candidates) ? response.candidates[0] : null;
    return {
      output: toGeminiText(firstCandidate),
      finishReason: toOptionalString(firstCandidate?.finishReason) || "stop",
      usage: response.usageMetadata || null
    };
  }
});

module.exports = {
  getDefaultRuntimeConfig,
  listRuntimeProviders,
  registerRuntimeProvider,
  runRuntimeCompletion
};
