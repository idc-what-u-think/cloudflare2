import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to warn')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the warning')
        .setRequired(true)),

  async execute(interaction, api) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    
    if (!member) {
      return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    }

    if (member.id === interaction.user.id) {
      return interaction.reply({ content: 'You cannot warn yourself.', ephemeral: true });
    }

    if (member.id === interaction.guild.ownerId) {
      return interaction.reply({ content: 'You cannot warn the server owner.', ephemeral: true });
    }

    try {
      const warningId = `warn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await api.request('/api/bot/warnings/add', 'POST', {
        id: warningId,
        serverId: interaction.guildId,
        userId: target.id,
        moderatorId: interaction.user.id,
        reason: reason
      });

      const warnings = await api.request(`/api/bot/warnings/${interaction.guildId}/${target.id}`);
      const warnCount = warnings?.count || 1;

      await target.send(
        `You have been warned in ${interaction.guild.name}\n` +
        `Reason: ${reason}\n` +
        `Total warnings: ${warnCount}`
      ).catch(() => {});

      await api.logModAction({
        serverId: interaction.guildId,
        userId: target.id,
        moderatorId: interaction.user.id,
        action: 'warn',
        reason: reason
      });

      const embed = new EmbedBuilder()
        .setColor('#FFFF00')
        .setTitle('User Warned')
        .setDescription(`${target.tag} has been warned`)
        .addFields(
          { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
          { name: 'Total Warnings', value: warnCount.toString(), inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Warn error:', error);
      return interaction.reply({ content: 'Failed to warn user. Please try again.', ephemeral: true });
    }
  },
};
