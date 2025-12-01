import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(option =>
      option.setName('user_id')
        .setDescription('The user ID to unban')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the unban')
        .setRequired(false)),

  async execute(interaction, api) {
    const userId = interaction.options.getString('user_id');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!/^\d{17,19}$/.test(userId)) {
      return interaction.reply({ content: 'Invalid user ID format.', ephemeral: true });
    }

    try {
      const bans = await interaction.guild.bans.fetch();
      const bannedUser = bans.get(userId);

      if (!bannedUser) {
        return interaction.reply({ content: 'This user is not banned.', ephemeral: true });
      }

      await interaction.guild.bans.remove(userId, `${reason} | Unbanned by ${interaction.user.tag}`);

      await api.logModAction({
        serverId: interaction.guildId,
        userId: userId,
        moderatorId: interaction.user.id,
        action: 'unban',
        reason: reason
      });

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('User Unbanned')
        .setDescription(`<@${userId}> has been unbanned`)
        .addFields(
          { name: 'User ID', value: userId, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Unban error:', error);
      return interaction.reply({ content: 'Failed to unban user. Please check the user ID.', ephemeral: true });
    }
  },
};
