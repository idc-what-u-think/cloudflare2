import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a user for specific duration')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to timeout')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('duration')
        .setDescription('Duration (e.g., 10m, 2h, 1d)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the timeout')
        .setRequired(false)),

  async execute(interaction, api) {
    const target = interaction.options.getUser('user');
    const durationStr = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    
    if (!member) {
      return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    }

    if (member.id === interaction.user.id) {
      return interaction.reply({ content: 'You cannot timeout yourself.', ephemeral: true });
    }

    if (member.id === interaction.guild.ownerId) {
      return interaction.reply({ content: 'You cannot timeout the server owner.', ephemeral: true });
    }

    if (member.roles.highest.position >= interaction.member.roles.highest.position) {
      return interaction.reply({ content: 'You cannot timeout someone with equal or higher role.', ephemeral: true });
    }

    if (!member.moderatable) {
      return interaction.reply({ content: 'I cannot timeout this user. Check my role hierarchy.', ephemeral: true });
    }

    const durationMs = parseDuration(durationStr);
    
    if (!durationMs) {
      return interaction.reply({ content: 'Invalid duration format. Use: 10m, 2h, 1d', ephemeral: true });
    }

    if (durationMs > 28 * 24 * 60 * 60 * 1000) {
      return interaction.reply({ content: 'Maximum timeout duration is 28 days.', ephemeral: true });
    }

    try {
      await member.timeout(durationMs, `${reason} | Timeout by ${interaction.user.tag}`);

      await api.logModAction({
        serverId: interaction.guildId,
        userId: target.id,
        moderatorId: interaction.user.id,
        action: 'timeout',
        reason: reason,
        duration: Math.floor(durationMs / 1000)
      });

      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('User Timeout')
        .setDescription(`${target.tag} has been timed out`)
        .addFields(
          { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
          { name: 'Duration', value: durationStr, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Timeout error:', error);
      return interaction.reply({ content: 'Failed to timeout user. Please try again.', ephemeral: true });
    }
  },
};

function parseDuration(str) {
  const regex = /^(\d+)([smhd])$/;
  const match = str.match(regex);
  
  if (!match) return null;
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  const units = {
    's': 1000,
    'm': 60 * 1000,
    'h': 60 * 60 * 1000,
    'd': 24 * 60 * 60 * 1000
  };
  
  return value * units[unit];
}
