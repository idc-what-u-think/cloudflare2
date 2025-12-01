import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('clearwarnings')
    .setDescription('Clear user warnings')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to clear warnings for')
        .setRequired(true)),

  async execute(interaction, api) {
    const target = interaction.options.getUser('user');

    try {
      const data = await api.request(`/api/bot/warnings/${interaction.guildId}/${target.id}`);

      if (!data || !data.warnings || data.warnings.length === 0) {
        return interaction.reply({ content: `${target.tag} has no warnings to clear.`, ephemeral: true });
      }

      const warningCount = data.warnings.length;

      await api.request('/api/bot/warnings/clear', 'DELETE', {
        serverId: interaction.guildId,
        userId: target.id
      });

      await api.logModAction({
        serverId: interaction.guildId,
        userId: target.id,
        moderatorId: interaction.user.id,
        action: 'clear_warnings',
        reason: `Cleared ${warningCount} warnings`
      });

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('Warnings Cleared')
        .setDescription(`All warnings for ${target.tag} have been cleared`)
        .addFields(
          { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
          { name: 'Warnings Cleared', value: warningCount.toString(), inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Clear warnings error:', error);
      return interaction.reply({ content: 'Failed to clear warnings. Please try again.', ephemeral: true });
    }
  },
};
