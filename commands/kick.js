import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to kick')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the kick')
        .setRequired(false)),

  async execute(interaction, api) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    
    if (!member) {
      return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    }

    if (member.id === interaction.user.id) {
      return interaction.reply({ content: 'You cannot kick yourself.', ephemeral: true });
    }

    if (member.id === interaction.guild.ownerId) {
      return interaction.reply({ content: 'You cannot kick the server owner.', ephemeral: true });
    }

    if (member.roles.highest.position >= interaction.member.roles.highest.position) {
      return interaction.reply({ content: 'You cannot kick someone with equal or higher role.', ephemeral: true });
    }

    if (!member.kickable) {
      return interaction.reply({ content: 'I cannot kick this user. Check my role hierarchy.', ephemeral: true });
    }

    try {
      await target.send(`You have been kicked from ${interaction.guild.name}\nReason: ${reason}`).catch(() => {});
      
      await member.kick(`${reason} | Kicked by ${interaction.user.tag}`);

      await api.logModAction({
        serverId: interaction.guildId,
        userId: target.id,
        moderatorId: interaction.user.id,
        action: 'kick',
        reason: reason
      });

      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('User Kicked')
        .setDescription(`${target.tag} has been kicked`)
        .addFields(
          { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Kick error:', error);
      return interaction.reply({ content: 'Failed to kick user. Please try again.', ephemeral: true });
    }
  },
};
