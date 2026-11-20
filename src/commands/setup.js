const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  InteractionContextType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const { applyTemplate, cleanupGuild } = require('../apply');
const { countTemplate } = require('../templates');

const busyGuilds = new Set();

function build(templates) {
  return new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Bangun server dari template (role, kategori, channel, dan izin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) =>
      o
        .setName('template')
        .setDescription('Template yang dipakai')
        .setRequired(true)
        .addChoices(...[...templates.values()].slice(0, 25).map((t) => ({ name: t.name, value: t.id }))),
    )
    .addBooleanOption((o) =>
      o.setName('bersihkan').setDescription('Hapus SEMUA channel dan role lama dulu (default: tidak)'),
    )
    .addStringOption((o) =>
      o.setName('nama_server').setDescription('Ganti nama server sekalian (opsional)').setMaxLength(100),
    );
}

function failedText(failed) {
  if (!failed.length) return '';
  const shown = failed.slice(0, 8).map((f) => `• ${f}`).join('\n');
  const more = failed.length > 8 ? `\n…dan ${failed.length - 8} lainnya (lihat console)` : '';
  return `\n\n⚠️ **${failed.length} langkah gagal:**\n${shown}${more}`.slice(0, 1800);
}

async function execute(interaction, { templates }) {
  const template = templates.get(interaction.options.getString('template'));
  const wipe = interaction.options.getBoolean('bersihkan') ?? false;
  const newName = interaction.options.getString('nama_server');
  const guild = interaction.guild;

  if (!template) {
    return interaction.reply({ content: '❌ Template tidak ditemukan.', flags: MessageFlags.Ephemeral });
  }
  if (!guild.members.me.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ Bot butuh izin **Administrator** untuk setup server. Invite ulang bot pakai link yang muncul di console.',
      flags: MessageFlags.Ephemeral,
    });
  }
  if (busyGuilds.has(guild.id)) {
    return interaction.reply({ content: '⏳ Setup lain sedang berjalan di server ini.', flags: MessageFlags.Ephemeral });
  }

  const count = countTemplate(template);
  const preview = new EmbedBuilder()
    .setColor(wipe ? 0xed4245 : 0x5865f2)
    .setTitle(`Setup template: ${template.name}`)
    .setDescription(template.description || '')
    .addFields(
      { name: 'Akan dibuat', value: `${count.roles} role\n${count.categories} kategori\n${count.text} channel teks\n${count.voice} channel voice`, inline: true },
      {
        name: 'Mode',
        value: wipe
          ? '🧹 **Bersihkan dulu**\nSemua channel dan role lama akan **DIHAPUS PERMANEN**.'
          : '➕ **Tambah saja**\nChannel lama tetap ada. Role dengan nama sama dipakai ulang.',
        inline: true,
      },
    );
  if (newName) preview.addFields({ name: 'Nama server baru', value: newName });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:ok').setLabel(wipe ? 'Ya, hapus & setup' : 'Mulai setup').setStyle(wipe ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('setup:cancel').setLabel('Batal').setStyle(ButtonStyle.Secondary),
  );

  const response = await interaction.reply({
    embeds: [preview],
    components: [row],
    flags: MessageFlags.Ephemeral,
    withResponse: true,
  });

  let click;
  try {
    click = await response.resource.message.awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === interaction.user.id,
      time: 60_000,
    });
  } catch {
    return interaction.editReply({ content: '⌛ Waktu konfirmasi habis, setup dibatalkan.', embeds: [], components: [] });
  }
  if (click.customId === 'setup:cancel') {
    return click.update({ content: 'Setup dibatalkan.', embeds: [], components: [] });
  }

  busyGuilds.add(guild.id);
  await click.update({ content: '⏳ Memulai setup...', embeds: [], components: [] });

  // Kalau mode bersihkan, channel tempat command diketik ikut terhapus sehingga
  // balasan ini tidak bisa diedit lagi. Semua edit dibungkus supaya tidak bikin crash.
  const progress = async (text) => {
    await interaction.editReply({ content: `⏳ ${text}` }).catch(() => {});
  };

  try {
    const lines = [];
    const failed = [];
    if (wipe) {
      await progress('Menghapus channel dan role lama...');
      const cleaned = await cleanupGuild(guild);
      lines.push(`🧹 Dihapus: ${cleaned.channels} channel, ${cleaned.roles} role`);
      failed.push(...cleaned.failed);
    }
    if (newName) {
      await guild.setName(newName, 'Setup server via bot').catch((err) => failed.push(`Ganti nama: ${err.message}`));
    }

    const result = await applyTemplate(guild, template, progress);
    failed.push(...result.failed);
    if (failed.length) console.warn(`[setup ${guild.name}] langkah gagal:\n${failed.join('\n')}`);

    lines.push(
      `🎭 Role: ${result.rolesCreated} dibuat${result.rolesReused ? `, ${result.rolesReused} dipakai ulang` : ''}`,
      `📁 Kategori: ${result.categories}`,
      `💬 Channel: ${result.channels}`,
      `📝 Pesan otomatis: ${result.messages}`,
    );
    const summary = `✅ **Setup "${template.name}" selesai!**\n${lines.join('\n')}${failedText(failed)}\n\n` +
      'Langkah berikutnya: pindahkan role bot ke paling atas di Server Settings → Roles, lalu kasih dirimu role 👑 Owner dengan `/role kasih`.';

    const edited = await interaction.editReply({ content: summary }).then(() => true).catch(() => false);
    if (!edited) {
      // Channel asal sudah terhapus: kirim ringkasan lewat DM.
      await interaction.user.send(`**${guild.name}**\n${summary}`).catch(() => {
        console.log(`[setup ${guild.name}] ${summary}`);
      });
    }
  } catch (err) {
    console.error(err);
    const msg = `❌ Setup berhenti karena error: ${err.message}`;
    await interaction.editReply({ content: msg }).catch(() => interaction.user.send(msg).catch(() => {}));
  } finally {
    busyGuilds.delete(guild.id);
  }
}

module.exports = { build, execute };
