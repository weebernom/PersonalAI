const Groq = require('groq-sdk');
const db = require('../utils/db');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const AVAILABLE_MODELS = {
  'openai/gpt-oss-20b': { name: 'GPT OSS 20B (Lightning)', description: 'Ultra-fast inference, optimized for general chat and real-time responsiveness.' },
  'openai/gpt-oss-120b': { name: 'GPT OSS 120B (Smart)', description: 'High-parameter reasoning engine, optimized for complex debugging, algorithmic logic, and deep analysis.' },
  'llama-3.1-8b-instant': { name: 'Llama 3.1 8B (Alternative)', description: 'Balanced open-weights model by Meta, serving as a reliable structural alternative.' }
};

// Global memory cache to prevent SQLite read delays
let activeModelCache = null;

function getCurrentModel(callback) {
  if (activeModelCache) {
    return callback(activeModelCache);
  }

  db.get("SELECT value FROM settings WHERE key = 'current_model'", (err, row) => {
    activeModelCache = row?.value || 'openai/gpt-oss-20b';
    callback(activeModelCache);
  });
}

// Export a new function to instantly force the cache update when the Discord command is used
function forceModelCacheUpdate(newModel) {
  activeModelCache = newModel;
}

async function streamOllama(message, model, onChunk) {
  try {
    const currentModelDetails = AVAILABLE_MODELS[model] || { name: model, description: 'Custom system architecture.' };
    const alternativeModelsList = Object.entries(AVAILABLE_MODELS)
      .filter(([id]) => id !== model)
      .map(([id, details]) => `- **${details.name}** (ID: \`${id}\`): ${details.description}`)
      .join('\n');

    const systemPrompt = `You are a highly optimized, context-aware AI Assistant running inside a custom chat bot platform integrated into Discord and Telegram.

[SYSTEM CORE DATA]
- You are currently running on the server using the backend engine: **${currentModelDetails.name}** (\`${model}\`).
- Profile: ${currentModelDetails.description}

[AVAILABLE TOPOLOGY OPTIONS]
The user can switch your brain dynamically at any time using the /model command. The alternative models available in your infrastructure are:
${alternativeModelsList}

[OPERATIONAL PARAMETERS]
1. Self-Awareness: If the user queries your identity, current engine, or available choices, use the [SYSTEM CORE DATA] and [AVAILABLE TOPOLOGY OPTIONS] to give an explicit, professional, and accurate technical breakdown.
2. Capability Scope: You are currently operating in a text-based format. If requested to perform multi-modal generation tasks, explicitly state that your current infrastructure does not support direct output generation for those media formats, but you can thoroughly plan or draft text specifications for them.`;

    const stream = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      model: model,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) onChunk(content);
    }
  } catch (error) {
    console.error('Groq routing error:', error.message);
    throw error;
  }
}

module.exports = { streamOllama, getCurrentModel, forceModelCacheUpdate };
