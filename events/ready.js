/**
 * Ready Event - Triggered when bot logs in
 */

export default {
  name: 'ready',
  once: true,
  async execute(client, api) {
    console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} servers`);
    
    // Update bot stats in database
    try {
      const stats = {
        totalServers: client.guilds.cache.size,
        totalUsers: client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0),
      };
      
      await api.updateBotStats(stats);
      console.log('📈 Bot stats updated successfully');
    } catch (error) {
      console.error('Failed to update bot stats:', error);
    }
  },
};
