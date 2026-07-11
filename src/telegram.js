require('dotenv').config();
const { Telegraf } = require('telegraf');
const { streamOllama, getCurrentModel } = require('./models/aiRouter');

if (!process.env.TELEGRAM_TOKEN) {
  console.error("❌ Error: TELEGRAM_TOKEN is missing in .env");
  process.exit(1);
}

// Replace with your actual Cloudflare Worker URL
const CLOUDFLARE_WORKER_URL = 'https://momibat.u2025581.workers.dev/';

const bot = new Telegraf(process.env.TELEGRAM_TOKEN, {
  telegram: {
    apiRoot: CLOUDFLARE_WORKER_URL
  }
});

async function handleTelegramStream(userMessage, ctx) {
  const placeholder = await ctx.reply('⏳ Thinking...');

  getCurrentModel(async (model) => {
    let fullResponse = "";
    let lastSentResponse = "";

    // Keeps the "typing..." indicator active on Telegram
    const typingInterval = setInterval(() => {
      ctx.sendChatAction('typing').catch(() => {});
    }, 4000);

    // Decoupled UI update loop (every 2 seconds)
    const uiUpdateInterval = setInterval(async () => {
      if (fullResponse && fullResponse !== lastSentResponse) {
        lastSentResponse = fullResponse;
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          placeholder.message_id,
          null,
          fullResponse + ' ▌'
        ).catch(() => {});
      }
    }, 2000);

    try {
      await streamOllama(userMessage, model, (chunk) => {
        fullResponse += chunk;
      });
    } catch (error) {
      fullResponse += `\n\n❌ Error: ${error.message}`;
    } finally {
      clearInterval(typingInterval);
      clearInterval(uiUpdateInterval);

      const finalText = fullResponse.length > 4096
        ? fullResponse.substring(0, 4093) + '...'
        : fullResponse || "No response generated.";

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        placeholder.message_id,
        null,
        finalText
      ).catch(() => {});
    }
  });
}

bot.on('text', async (ctx) => {
  await handleTelegramStream(ctx.message.text, ctx);
});

bot.start((ctx) => ctx.reply('🤖 Local Ollama Bot linked via Telegram. Send me a message to begin.'));

bot.launch();
console.log('✅ Telegram bot listening smoothly...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
