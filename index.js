/**
 * QuantumX Discord Bot - Main Entry Point
 * Render.com Deployment
 */

import { Client, GatewayIntentBits, Collection, REST, Routes, ActivityType } from 'discord.js';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Environment variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const API_URL = process.env.API_URL; // Your Cloudflare Worker URL
const API_KEY = process.env.API_KEY; // Secret key for API authentication

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

// Commands collection
client.commands = new Collection();

// API Helper - Communicate with Cloudflare Worker
class APIHelper {
  constructor(baseURL, apiKey) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
  }

  async request(endpoint, method = 'GET', body = null) {
    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${this.baseURL}${endpoint}`, options);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API Request Error:', error);
      return null;
    }
  }

  // Database operations through API
  async getServerConfig(serverId) {
    return await this.request(`/api/bot/servers/${serverId}/config`);
  }

  async updateServerConfig(serverId, config) {
    return await this.request(`/api/bot/servers/${serverId}/config`, 'PUT', config);
  }

  async logCommand(data) {
    return await this.request('/api/bot/commands/log', 'POST', data);
  }

  async awardXP(userId, serverId, xp) {
    return await this.request('/api/bot/levels/award', 'POST', { userId, serverId, xp });
  }

  async getUserLevel(userId, serverId) {
    return await this.request(`/api/bot/levels/${serverId}/${userId}`);
  }

  async getEconomy(userId, serverId) {
    return await this.request(`/api/bot/economy/${serverId}/${userId}`);
  }

  async updateEconomy(userId, serverId, data) {
    return await this.request(`/api/bot/economy/${serverId}/${userId}`, 'PUT', data);
  }

  async isBlacklisted(type, id) {
    return await this.request(`/api/bot/blacklist/${type}/${id}`);
  }

  async logModAction(data) {
    return await this.request('/api/bot/moderation/log', 'POST', data);
  }

  async updateBotStats(stats) {
    return await this.request('/api/bot/stats', 'PUT', stats);
  }
}

const api = new APIHelper(API_URL, API_KEY);

// Command Handler - Auto-loads all commands from /commands folder
async function loadCommands() {
  const commandsPath = join(__dirname, 'commands');
  const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  console.log(`📂 Loading ${commandFiles.length} commands...`);

  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    const command = await import(filePath);
    
    if ('data' in command.default && 'execute' in command.default) {
      client.commands.set(command.default.data.name, command.default);
      console.log(`✅ Loaded command: ${command.default.data.name}`);
    } else {
      console.log(`⚠️  Skipped ${file}: missing 'data' or 'execute'`);
    }
  }
}

// Event Handler - Auto-loads all events from /events folder
async function loadEvents() {
  const eventsPath = join(__dirname, 'events');
  const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  console.log(`📂 Loading ${eventFiles.length} events...`);

  for (const file of eventFiles) {
    const filePath = join(eventsPath, file);
    const event = await import(filePath);
    
    if (event.default.once) {
      client.once(event.default.name, (...args) => event.default.execute(...args, api));
    } else {
      client.on(event.default.name, (...args) => event.default.execute(...args, api));
    }
    
    console.log(`✅ Loaded event: ${event.default.name}`);
  }
}

// Register slash commands with Discord
async function registerCommands() {
  const commands = [];
  client.commands.forEach(cmd => commands.push(cmd.data.toJSON()));

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

  try {
    console.log('🔄 Registering slash commands...');
    
    await rest.put(
      Routes.applicationCommands(DISCORD_CLIENT_ID),
      { body: commands },
    );
    
    console.log('✅ Successfully registered slash commands!');
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
}

// Ready event
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  
  // Set bot status
  client.user.setPresence({
    activities: [{ name: '/help | QuantumX', type: ActivityType.Playing }],
    status: 'online',
  });

  // Update bot stats
  const stats = {
    totalServers: client.guilds.cache.size,
    totalUsers: client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0),
  };
  await api.updateBotStats(stats);

  console.log(`📊 Serving ${stats.totalServers} servers with ${stats.totalUsers} users`);
});

// Interaction handler (slash commands)
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    return interaction.reply({ content: '❌ Command not found!', ephemeral: true });
  }

  try {
    // Check if server is blacklisted
    const blacklisted = await api.isBlacklisted('server', interaction.guildId);
    if (blacklisted?.blacklisted) {
      return interaction.reply({ 
        content: '🚫 This server has been blacklisted from using this bot.', 
        ephemeral: true 
      });
    }

    // Check if user is blacklisted
    const userBlacklisted = await api.isBlacklisted('user', interaction.user.id);
    if (userBlacklisted?.blacklisted) {
      return interaction.reply({ 
        content: '🚫 You have been blacklisted from using this bot.', 
        ephemeral: true 
      });
    }

    // Execute command
    const startTime = Date.now();
    await command.execute(interaction, api);
    const executionTime = Date.now() - startTime;

    // Log command usage
    await api.logCommand({
      commandName: interaction.commandName,
      serverId: interaction.guildId,
      userId: interaction.user.id,
      success: true,
      executionTime,
    });

  } catch (error) {
    console.error('❌ Command error:', error);

    // Log failed command
    await api.logCommand({
      commandName: interaction.commandName,
      serverId: interaction.guildId,
      userId: interaction.user.id,
      success: false,
      errorMessage: error.message,
    });

    const errorMsg = { content: '❌ There was an error executing this command!', ephemeral: true };
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMsg);
    } else {
      await interaction.reply(errorMsg);
    }
  }
});

// Message handler (for XP system)
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.guild) return;

  try {
    // Get server config
    const config = await api.getServerConfig(message.guild.id);
    
    if (!config || config.leveling_enabled === 0) return;

    // Award XP
    const xpAmount = Math.floor(Math.random() * 15) + 10; // 10-25 XP
    const result = await api.awardXP(message.author.id, message.guild.id, xpAmount);

    // Check if user leveled up
    if (result?.leveledUp) {
      message.reply(`🎉 Congratulations ${message.author}! You've reached level **${result.newLevel}**!`);
    }
  } catch (error) {
    console.error('XP Error:', error);
  }
});

// Guild join event
client.on('guildCreate', async guild => {
  console.log(`✅ Joined new server: ${guild.name} (${guild.id})`);
  
  // Create server config via API
  await api.updateServerConfig(guild.id, {
    server_name: guild.name,
    prefix: '!',
  });

  // Update bot stats
  const stats = {
    totalServers: client.guilds.cache.size,
    totalUsers: client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
  };
  await api.updateBotStats(stats);
});

// Guild leave event
client.on('guildDelete', async guild => {
  console.log(`❌ Left server: ${guild.name} (${guild.id})`);
  
  // Update bot stats
  const stats = {
    totalServers: client.guilds.cache.size,
    totalUsers: client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
  };
  await api.updateBotStats(stats);
});

// Error handling
client.on('error', error => {
  console.error('Discord client error:', error);
});

client.on('warn', warning => {
  console.warn('Discord client warning:', warning);
});

// Express server for Render health check
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    bot: client.user?.tag || 'Starting...',
    servers: client.guilds.cache.size,
    uptime: process.uptime(),
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.listen(PORT, () => {
  console.log(`🌐 Health server running on port ${PORT}`);
});

// Start bot
async function start() {
  try {
    await loadCommands();
    await loadEvents();
    await registerCommands();
    await client.login(DISCORD_TOKEN);
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

start();
