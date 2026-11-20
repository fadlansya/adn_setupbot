const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, EmbedBuilder, MessageFlags } = require('discord.js');
const { countTemplate } = require('../templates');

function build(templates) {
  return new SlashCommandBuilder()
    .setName('template')
    .setDescription('Lihat template server yang tersedia')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName('daftar').setDescription('Daftar semua template'))
    .addSubcommand((s) =>
      s
        .setName('lihat')
        .setDescription('Lihat isi lengkap satu template')
        .addStringOption((o) =>
          o
            .setName('template')
            .setDescription('Template yang mau dilihat')
            .setRequired(true)
            .addChoices(...[...templates.values()].slice(0, 25).map((t) => ({ name: t.name, value: t.id }))),
        ),
    );
}

async function execute(interaction, { templates }) {
  if (interaction.options.getSubcommand() === 'daftar') {
    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('📋 Template tersedia');
    for (const t of templates.values()) {
      const c = countTemplate(t);
      embed.addFields({
        name: t.name,
        value: `${t.description || '-'}\n\`${c.roles} role · ${c.categories} kategori · ${c.text} teks · ${c.voice} voice\``,
      });
    }
    embed.setFooter({ text: 'Pakai /template lihat untuk detail, /setup untuk menerapkan.' });
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const t = templates.get(interaction.options.getString('template'));
  if (!t) return interaction.reply({ content: '❌ Template tidak ditemukan.', flags: MessageFlags.Ephemeral });

  const roles = t.roles.map((r) => `• ${r.name}${r.permissions?.length ? ` — ${r.permissions.includes('Administrator') ? 'Administrator' : `${r.permissions.length} izin`}` : ''}`).join('\n');
  const tree = t.categories
    .map((cat) => {
      const locked = cat.access?.['@everyone']?.deny?.includes('ViewChannel') ? ' 🔒' : '';
      const channels = cat.channels.map((ch) => `   ${ch.type === 'voice' ? '🔊' : '#'} ${ch.name}`).join('\n');
      return `**${cat.name}**${locked}\n${channels}`;
    })
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`Template: ${t.name}`)
    .setDescription(`${t.description || ''}\n\n${tree}`.slice(0, 4000))
    .addFields({ name: 'Role (urut dari atas)', value: roles.slice(0, 1024) || '-' })
    .setFooter({ text: '🔒 = tersembunyi dari member biasa' });
  return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

module.exports = { build, execute };
