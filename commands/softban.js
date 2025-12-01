import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('softban')
    .setDescription('Ban and immediately unban a user (kicks + deletes messages)')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to softban')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the softban')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('delete_days')
        .setDescription('Delete message history (days)')
        .setMinValue(1)
        .setMaxValue(7)
        .setRequired(false)),

  async execute(interaction, api) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_days') || 7;

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    
    if (!member) {
      return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    }

    if (member.id === interaction.user.id) {
      return interaction.reply({ content: 'You cannot softban yourself.', ephemeral: true });
    }

    if (member.id === interaction.guild.ownerId) {
      return interaction.reply({ content: 'You cannot softban the server owner.', ephemeral: true });
    }

    if (member.roles.highest.position >= interaction.member.roles.highest.position) {
      return interaction.reply({ content: 'You cannot softban someone with equal or higher role.', ephemeral: true });
    }

    if (!member.bannable) {
      return interaction.reply({ content: 'I cannot softban this user. Check my role hierarchy.', ephemeral: true });
    }

    try {
      await target.send(
        `You have been soft-banned from ${interaction.guild.name}\n` +
        `Reason: ${reason}\n` +
        `Your messages from the last ${deleteDays} days have been deleted.`
      ).catch(() => {});
      
      await member.ban({ 
        deleteMessageDays: deleteDays,
        reason: `[SOFTBAN] ${reason} | By ${interaction.user.tag}` 
      });

      await interaction.guild.bans.remove(target.id, `Softban unban | By ${interaction.user.tag}`);

      await api.logModAction({
        serverId: interaction.guildId,
        userId: target.id,
        moderatorId: interaction.user.id,
        action: 'softban',
        reason: reason
      });

      const embed = new EmbedBuilder()
        .setColor('#FF6600')
        .setTitle('User Soft-Banned')
        .setDescription(`${target.tag} has been soft-banned (kicked with message cleanup)`)
        .addFields(
          { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
          { name: 'Messages Deleted', value: `${deleteDays} days`, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason }
        )
        .setFooter({ text: 'User can rejoin with an invite' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Softban error:', error);
      return interaction.reply({ content: 'Failed to softban user. Please try again.', ephemeral: true });
    }
  },
};
