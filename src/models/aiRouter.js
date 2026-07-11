const Groq = require('groq-sdk');
const db = require('../utils/db');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function getCurrentModel(callback) {
  db.get("SELECT value FROM settings WHERE key = 'current_model'", (err, row) => {
    callback(row?.value || 'llama3-8b-8192');
  });
}

async function streamOllama(message, model, onChunk) {
  try {
    console.log(`📡 Streaming from Groq API: ${model}`);
    const stream = await groq.chat.completions.create({
      messages: [{ role: "user", content: message }],
      model: model,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) onChunk(content);
    }
  } catch (error) {
    console.error('Groq error:', error.message);
    throw error;
  }
}

module.exports = { streamOllama, getCurrentModel };
