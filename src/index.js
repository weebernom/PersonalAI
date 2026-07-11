require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ChannelType, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require('discord.js');
const db = require('./utils/db');
const { streamOllama, getCurrentModel } = require('./models/aiRouter');
const http = require('http');

// Dummy web server to keep Render happy
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is running online.');
}).listen(process.env.PORT || 3000);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel]
});

const commands = [
  new SlashCommandBuilder().setName('chat').setDescription('Chat with AI').addStringOption(opt => opt.setName('message').setDescription('Your message').setRequired(true)),
  new SlashCommandBuilder().setName('model').setDescription('Switch AI model').addStringOption(opt => opt.setName('name').setDescription('Select the AI model').setRequired(true)
    .addChoices(
      { name: 'Llama 3 (8B) - Fast', value: 'llama3-8b-8192' },
      { name: 'Llama 3 (70B) - Smart', value: 'llama3-70b-8192' },
      { name: 'Mixtral 8x7B', value: 'mixtral-8x7b-32768' }
    )),
  new SlashCommandBuilder().setName('status').setDescription('Check current model'),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
  console.log(`✅ Discord ready as ${client.user.tag}`);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands }).catch(console.error);
});

async function handleStream(userMessage, interactionOrMsg, isSlash) {
  return new Promise((resolve) => {
    getCurrentModel(async (model) => {
      let fullResponse = "";
      let lastEditTime = 0;
      let editTimeout = null;

      try {
        await streamOllama(userMessage, model, (chunk) => {
          fullResponse += chunk;
          if (Date.now() - lastEditTime > 1500) {
            lastEditTime = Date.now();
            if (editTimeout) clearTimeout(editTimeout);
            const displayText = fullResponse.length > 1997 ? fullResponse.substring(0, 1997) + '...' : fullResponse + ' ⏳';
            editTimeout = setTimeout(() => {
              if (isSlash) interactionOrMsg.editReply(displayText).catch(() => {});
              else interactionOrMsg.edit(displayText).catch(() => {});
            }, 100);
          }
        });

        if (editTimeout) clearTimeout(editTimeout);
        const finalText = fullResponse.length > 2000 ? fullResponse.substring(0, 1997) + '...' : fullResponse || "No response.";
        if (isSlash) await interactionOrMsg.editReply(finalText);
        else await interactionOrMsg.edit(finalText);
        resolve();
      } catch (error) {
        const errorMsg = `❌ Error: ${error.message}`;
        if (isSlash) await interactionOrMsg.editReply(errorMsg);
        else await interactionOrMsg.edit(errorMsg);
        resolve();
      }
    });
  });
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;
  if (interaction.commandName === 'chat') {
    await interaction.deferReply();
    await handleStream(interaction.options.getString('message'), interaction, true);
  }
  if (interaction.commandName === 'model') {
    const modelName = interaction.options.getString('name');
    db.run("UPDATE settings SET value = ? WHERE key = 'current_model'", [modelName], () => {
      interaction.reply(`🤖 Model switched to: **${modelName}**`);
    });
  }
  if (interaction.commandName === 'status') {
    getCurrentModel((model) => interaction.reply(`📊 Current model: **${model}**`));
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const isDM = message.channel.type === ChannelType.DM;
  const isMentioned = message.mentions.has(client.user);
  if (!isDM && !isMentioned) return;

  const userMessage = message.content.replace(`<@${client.user.id}>`, '').replace(`<@!${client.user.id}>`, '').trim();
  if (!userMessage) return;

  const replyMessage = await message.reply('Thinking...');
  await handleStream(userMessage, replyMessage, false);
});

client.login(process.env.DISCORD_TOKEN);
require('./telegram.js');
