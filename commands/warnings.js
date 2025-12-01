import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View user warnings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to check warnings for')
        .setRequired(true)),

  async execute(interaction, api) {
    const target = interaction.options.getUser('user');

    try {
      const data = await api.request(`/api/bot/warnings/${interaction.guildId}/${target.id}`);

      if (!data || !data.warnings || data.warnings.length === 0) {
        return interaction.reply({ content: `${target.tag} has no warnings.`, ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor('#FFFF00')
        .setTitle(`Warnings for ${target.tag}`)
        .setThumbnail(target.displayAvatarURL())
        .setDescription(`Total warnings: ${data.warnings.length}`)
        .setTimestamp();

      data.warnings.slice(0, 10).forEach((warn, index) => {
        const date = new Date(warn.created_at).toLocaleDateString();
        embed.addFields({
          name: `Warning ${index + 1} - ${date}`,
          value: `Moderator: <@${warn.moderator_id}>\nReason: ${warn.reason}`,
          inline: false
        });
      });

      if (data.warnings.length > 10) {
        embed.setFooter({ text: `Showing 10 of ${data.warnings.length} warnings` });
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Warnings fetch error:', error);
      return interaction.reply({ content: 'Failed to fetch warnings. Please try again.', ephemeral: true });
    }
  },
};
