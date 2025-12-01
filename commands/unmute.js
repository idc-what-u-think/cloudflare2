import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmute a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to unmute')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the unmute')
        .setRequired(false)),

  async execute(interaction, api) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    
    if (!member) {
      return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    }

    if (!member.communicationDisabledUntil) {
      return interaction.reply({ content: 'This user is not muted.', ephemeral: true });
    }

    try {
      await member.timeout(null, `${reason} | Unmuted by ${interaction.user.tag}`);

      await api.logModAction({
        serverId: interaction.guildId,
        userId: target.id,
        moderatorId: interaction.user.id,
        action: 'unmute',
        reason: reason
      });

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('User Unmuted')
        .setDescription(`${target.tag} has been unmuted`)
        .addFields(
          { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Unmute error:', error);
      return interaction.reply({ content: 'Failed to unmute user. Please try again.', ephemeral: true });
    }
  },
};
