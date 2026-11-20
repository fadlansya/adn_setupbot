const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js');

const REASON = (user) => `Diatur oleh ${user.tag} via bot`;

const COLOR_NAMES = {
  merah: 0xe74c3c, red: 0xe74c3c,
  biru: 0x3498db, blue: 0x3498db,
  hijau: 0x2ecc71, green: 0x2ecc71,
  kuning: 0xf1c40f, yellow: 0xf1c40f,
  emas: 0xf1c40f, gold: 0xf1c40f,
  ungu: 0x9b59b6, purple: 0x9b59b6,
  oranye: 0xe67e22, orange: 0xe67e22,
  pink: 0xe91e63,
  tosca: 0x1abc9c, teal: 0x1abc9c,
  abu: 0x95a5a6, grey: 0x95a5a6, gray: 0x95a5a6,
  putih: 0xffffff, white: 0xffffff,
  hitam: 0x23272a, black: 0x23272a,
};

/** Terima "#ff0000", "ff0000", atau nama warna seperti "merah". Kembalikan null kalau tidak valid. */
function parseColor(input) {
  if (!input) return 0;
  const value = input.trim().toLowerCase();
  if (value in COLOR_NAMES) return COLOR_NAMES[value];
  const hex = value.replace(/^#/, '');
  return /^[0-9a-f]{6}$/.test(hex) ? parseInt(hex, 16) : null;
}

const MEMBER_PERMS = [
  'ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AddReactions', 'AttachFiles', 'EmbedLinks',
  'UseExternalEmojis', 'UseApplicationCommands', 'CreatePublicThreads', 'SendMessagesInThreads',
  'Connect', 'Speak', 'Stream', 'UseVAD', 'ChangeNickname',
];
const MOD_PERMS = [
  ...MEMBER_PERMS,
  'ManageMessages', 'ManageThreads', 'KickMembers', 'ModerateMembers', 'MuteMembers', 'MoveMembers', 'ManageNicknames',
];
const ADMIN_PERMS = [
  ...MOD_PERMS,
  'ManageGuild', 'ManageChannels', 'ManageRoles', 'ManageEvents', 'BanMembers', 'DeafenMembers', 'ViewAuditLog', 'MentionEveryone',
];
const PRESETS = {
  kosong: { label: 'Kosong (hanya hiasan/nama)', perms: [] },
  member: { label: 'Member biasa', perms: MEMBER_PERMS },
  moderator: { label: 'Moderator', perms: MOD_PERMS },
  admin: { label: 'Admin (tanpa Administrator penuh)', perms: ADMIN_PERMS },
  administrator: { label: 'Administrator penuh', perms: ['Administrator'] },
};

function build() {
  const colorOpt = (o) => o.setName('warna').setDescription('Contoh: #ff0000 atau merah/biru/hijau/kuning/ungu/pink');
  return new SlashCommandBuilder()
    .setName('role')
    .setDescription('Kelola role server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) =>
      s
        .setName('buat')
        .setDescription('Buat satu role baru')
        .addStringOption((o) => o.setName('nama').setDescription('Nama role').setRequired(true).setMaxLength(100))
        .addStringOption(colorOpt)
        .addStringOption((o) =>
          o.setName('izin').setDescription('Preset izin (default: kosong)')
            .addChoices(...Object.entries(PRESETS).map(([value, p]) => ({ name: p.label, value }))),
        )
        .addBooleanOption((o) => o.setName('pisah').setDescription('Tampil terpisah di daftar member (default: tidak)'))
        .addBooleanOption((o) => o.setName('bisa_mention').setDescription('Boleh di-@mention semua orang (default: tidak)')),
    )
    .addSubcommand((s) =>
      s
        .setName('massal')
        .setDescription('Buat banyak role sekaligus, urutan pertama = paling atas')
        .addStringOption((o) =>
          o.setName('daftar').setDescription('Pisahkan dengan koma. Contoh: VIP:#f1c40f, Gamer:ungu, Member').setRequired(true).setMaxLength(2000),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('hapus')
        .setDescription('Hapus role')
        .addRoleOption((o) => o.setName('role').setDescription('Role yang dihapus').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('kasih')
        .setDescription('Berikan role ke member')
        .addUserOption((o) => o.setName('member').setDescription('Member').setRequired(true))
        .addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('cabut')
        .setDescription('Cabut role dari member')
        .addUserOption((o) => o.setName('member').setDescription('Member').setRequired(true))
        .addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('izin')
        .setDescription('Ganti izin role pakai preset')
        .addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true))
        .addStringOption((o) =>
          o.setName('preset').setDescription('Preset izin').setRequired(true)
            .addChoices(...Object.entries(PRESETS).map(([value, p]) => ({ name: p.label, value }))),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('warna')
        .setDescription('Ganti warna role')
        .addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true))
        .addStringOption((o) => colorOpt(o).setRequired(true)),
    );
}

/** Pastikan bot boleh mengubah role ini. Kembalikan pesan error atau null. */
function roleProblem(role, guild) {
  if (role.id === guild.id) return '❌ Role @everyone tidak bisa diubah lewat command ini.';
  if (role.managed) return `❌ ${role} dikelola oleh integrasi/bot lain dan tidak bisa diubah.`;
  if (!role.editable) {
    return `❌ ${role} posisinya sama atau di atas role bot. Pindahkan role bot ke atasnya di Server Settings → Roles.`;
  }
  return null;
}

async function execute(interaction) {
  const { guild, user, options } = interaction;
  const sub = options.getSubcommand();
  const reply = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

  if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return reply('❌ Bot butuh izin **Manage Roles**.');
  }

  if (sub === 'buat') {
    const color = parseColor(options.getString('warna'));
    if (color === null) return reply('❌ Warna tidak valid. Pakai format #RRGGBB atau nama warna (merah, biru, ...).');
    const preset = PRESETS[options.getString('izin') ?? 'kosong'];
    const role = await guild.roles.create({
      name: options.getString('nama'),
      colors: { primaryColor: color },
      permissions: preset.perms,
      hoist: options.getBoolean('pisah') ?? false,
      mentionable: options.getBoolean('bisa_mention') ?? false,
      reason: REASON(user),
    });
    return reply(`✅ Role ${role} dibuat dengan izin **${preset.label}**.`);
  }

  if (sub === 'massal') {
    const entries = options.getString('daftar').split(',').map((e) => e.trim()).filter(Boolean);
    if (entries.length > 25) return reply('❌ Maksimal 25 role sekali jalan.');

    const parsed = [];
    for (const entry of entries) {
      const sep = entry.lastIndexOf(':');
      const name = (sep > 0 ? entry.slice(0, sep) : entry).trim();
      const color = parseColor(sep > 0 ? entry.slice(sep + 1) : '');
      if (!name || name.length > 100) return reply(`❌ Nama role tidak valid: \`${entry}\``);
      if (color === null) return reply(`❌ Warna tidak valid di \`${entry}\``);
      parsed.push({ name, color });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const existing = new Set(guild.roles.cache.map((r) => r.name.toLowerCase()));
    const created = [];
    const skipped = [];
    // Dibuat dari bawah supaya urutan pertama berakhir paling atas.
    for (const { name, color } of [...parsed].reverse()) {
      if (existing.has(name.toLowerCase())) {
        skipped.push(name);
        continue;
      }
      const role = await guild.roles.create({ name, colors: { primaryColor: color }, permissions: [], reason: REASON(user) });
      created.unshift(role.toString());
    }
    let msg = `✅ ${created.length} role dibuat: ${created.join(' ') || '-'}`;
    if (skipped.length) msg += `\n⏭️ Dilewati karena sudah ada: ${skipped.reverse().join(', ')}`;
    return interaction.editReply({ content: msg, allowedMentions: { parse: [] } });
  }

  const role = options.getRole('role');
  const problem = roleProblem(role, guild);
  if (problem) return reply(problem);

  if (sub === 'hapus') {
    const name = role.name;
    await role.delete(REASON(user));
    return reply(`🗑️ Role **${name}** dihapus.`);
  }

  if (sub === 'kasih' || sub === 'cabut') {
    const member = options.getMember('member');
    if (!member) return reply('❌ Member tidak ditemukan di server ini.');
    if (sub === 'kasih') {
      if (member.roles.cache.has(role.id)) return reply(`ℹ️ ${member} sudah punya ${role}.`);
      await member.roles.add(role, REASON(user));
      return reply(`✅ ${role} diberikan ke ${member}.`);
    }
    if (!member.roles.cache.has(role.id)) return reply(`ℹ️ ${member} tidak punya ${role}.`);
    await member.roles.remove(role, REASON(user));
    return reply(`✅ ${role} dicabut dari ${member}.`);
  }

  if (sub === 'izin') {
    const preset = PRESETS[options.getString('preset')];
    if (preset.perms.includes('Administrator') && !guild.members.me.permissions.has(PermissionFlagsBits.Administrator)) {
      return reply('❌ Bot sendiri harus punya Administrator untuk memberi izin Administrator.');
    }
    await role.setPermissions(preset.perms, REASON(user));
    return reply(`✅ Izin ${role} diganti ke preset **${preset.label}**.`);
  }

  if (sub === 'warna') {
    const color = parseColor(options.getString('warna'));
    if (color === null) return reply('❌ Warna tidak valid. Pakai format #RRGGBB atau nama warna (merah, biru, ...).');
    await role.setColors({ primaryColor: color }, REASON(user));
    return reply(`🎨 Warna ${role} diganti.`);
  }
}

module.exports = { build, execute, parseColor };
