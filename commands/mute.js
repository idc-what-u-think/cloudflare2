import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a user (timeout)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to mute')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('duration')
        .setDescription('Duration in minutes')
        .setMinValue(1)
        .setMaxValue(40320)
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the mute')
        .setRequired(false)),

  async execute(interaction, api) {
    const target = interaction.options.getUser('user');
    const duration = interaction.options.getInteger('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    
    if (!member) {
      return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    }

    if (member.id === interaction.user.id) {
      return interaction.reply({ content: 'You cannot mute yourself.', ephemeral: true });
    }

    if (member.id === interaction.guild.ownerId) {
      return interaction.reply({ content: 'You cannot mute the server owner.', ephemeral: true });
    }

    if (member.roles.highest.position >= interaction.member.roles.highest.position) {
      return interaction.reply({ content: 'You cannot mute someone with equal or higher role.', ephemeral: true });
    }

    if (!member.moderatable) {
      return interaction.reply({ content: 'I cannot mute this user. Check my role hierarchy.', ephemeral: true });
    }

    const durationMs = duration * 60 * 1000;

    try {
      await member.timeout(durationMs, `${reason} | Muted by ${interaction.user.tag}`);

      await api.logModAction({
        serverId: interaction.guildId,
        userId: target.id,
        moderatorId: interaction.user.id,
        action: 'mute',
        reason: reason,
        duration: duration * 60
      });

      const embed = new EmbedBuilder()
        .setColor('#808080')
        .setTitle('User Muted')
        .setDescription(`${target.tag} has been muted`)
        .addFields(
          { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
          { name: 'Duration', value: `${duration} minutes`, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Mute error:', error);
      return interaction.reply({ content: 'Failed to mute user. Please try again.', ephemeral: true });
    }
  },
};
