const {
  ChannelType,
  EmbedBuilder,
  GuildDefaultMessageNotifications,
  GuildVerificationLevel,
} = require('discord.js');

const REASON = 'Setup server via bot';

function hexToInt(hex) {
  return hex ? parseInt(hex.slice(1), 16) : 0;
}

/**
 * Gabungkan izin kategori dengan izin khusus channel.
 * Aturan channel menang kalau bentrok (allow di channel menghapus deny dari kategori, dan sebaliknya).
 */
function mergeAccess(base = {}, extra = {}) {
  const result = {};
  for (const key of new Set([...Object.keys(base), ...Object.keys(extra)])) {
    const b = base[key] || {};
    const e = extra[key] || {};
    const eAllow = e.allow || [];
    const eDeny = e.deny || [];
    result[key] = {
      allow: [...new Set([...(b.allow || []).filter((p) => !eDeny.includes(p)), ...eAllow])],
      deny: [...new Set([...(b.deny || []).filter((p) => !eAllow.includes(p)), ...eDeny])],
    };
  }
  return result;
}

function toOverwrites(access, guild, roleMap) {
  const overwrites = [];
  for (const [target, rule] of Object.entries(access || {})) {
    const id = target === '@everyone' ? guild.roles.everyone.id : roleMap.get(target)?.id;
    if (!id) continue; // role gagal dibuat, lewati
    overwrites.push({ id, allow: rule.allow || [], deny: rule.deny || [] });
  }
  return overwrites;
}

/**
 * Hapus semua channel dan role yang bisa dihapus bot.
 * Role yang posisinya di atas role bot, role bawaan integrasi, dan @everyone tidak disentuh.
 */
async function cleanupGuild(guild) {
  const result = { channels: 0, roles: 0, failed: [] };

  const channels = [...(await guild.channels.fetch()).values()].filter(Boolean);
  // Hapus channel biasa dulu, kategori terakhir.
  channels.sort((a, b) => (a.type === ChannelType.GuildCategory) - (b.type === ChannelType.GuildCategory));
  for (const channel of channels) {
    try {
      await channel.delete(REASON);
      result.channels++;
    } catch (err) {
      result.failed.push(`Hapus #${channel.name}: ${err.message}`);
    }
  }

  const roles = await guild.roles.fetch();
  for (const role of roles.values()) {
    if (role.id === guild.id || role.managed || !role.editable) continue;
    try {
      await role.delete(REASON);
      result.roles++;
    } catch (err) {
      result.failed.push(`Hapus role ${role.name}: ${err.message}`);
    }
  }

  return result;
}

/**
 * Terapkan template ke server.
 * Role yang namanya sudah ada di server dipakai ulang, tidak dibuat dobel.
 */
async function applyTemplate(guild, template, onProgress = async () => {}) {
  const result = {
    rolesCreated: 0,
    rolesReused: 0,
    categories: 0,
    channels: 0,
    messages: 0,
    failed: [],
    firstTextChannel: null,
  };

  // 1. Role. Urutan di template = atas ke bawah. Discord menaruh role baru tepat di atas
  //    @everyone, jadi dibuat dari bawah supaya role pertama di template berada paling atas.
  await onProgress('Membuat role...');
  const roleMap = new Map();
  const existingRoles = await guild.roles.fetch();
  for (const def of [...template.roles].reverse()) {
    const existing = existingRoles.find((r) => r.name === def.name && !r.managed);
    if (existing) {
      roleMap.set(def.name, existing);
      result.rolesReused++;
      continue;
    }
    try {
      const role = await guild.roles.create({
        name: def.name,
        colors: { primaryColor: hexToInt(def.color) },
        hoist: Boolean(def.hoist),
        mentionable: Boolean(def.mentionable),
        permissions: def.permissions || [],
        reason: REASON,
      });
      roleMap.set(def.name, role);
      result.rolesCreated++;
    } catch (err) {
      result.failed.push(`Buat role ${def.name}: ${err.message}`);
    }
  }

  // 2. Kategori dan channel.
  let afkChannel = null;
  let systemChannel = null;
  for (const [index, cat] of template.categories.entries()) {
    await onProgress(`Membuat kategori ${index + 1}/${template.categories.length}: ${cat.name}`);
    let category;
    try {
      category = await guild.channels.create({
        name: cat.name,
        type: ChannelType.GuildCategory,
        permissionOverwrites: toOverwrites(cat.access, guild, roleMap),
        reason: REASON,
      });
      result.categories++;
    } catch (err) {
      result.failed.push(`Buat kategori ${cat.name}: ${err.message}`);
      continue;
    }

    for (const def of cat.channels) {
      const isVoice = def.type === 'voice';
      const access = def.access ? mergeAccess(cat.access, def.access) : cat.access;
      const options = {
        name: def.name,
        type: isVoice ? ChannelType.GuildVoice : ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: toOverwrites(access, guild, roleMap),
        reason: REASON,
      };
      if (isVoice) {
        if (def.userLimit) options.userLimit = def.userLimit;
      } else {
        if (def.topic) options.topic = def.topic;
        if (def.slowmode) options.rateLimitPerUser = def.slowmode;
      }

      let channel;
      try {
        channel = await guild.channels.create(options);
        result.channels++;
      } catch (err) {
        result.failed.push(`Buat channel ${def.name}: ${err.message}`);
        continue;
      }

      if (!isVoice && !result.firstTextChannel) result.firstTextChannel = channel;
      if (def.afk) afkChannel = channel;
      if (def.systemChannel) systemChannel = channel;

      if (def.message) {
        try {
          await channel.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0x5865f2)
                .setDescription(def.message.replaceAll('{server}', guild.name)),
            ],
          });
          result.messages++;
        } catch (err) {
          result.failed.push(`Kirim pesan di ${def.name}: ${err.message}`);
        }
      }
    }
  }

  // 3. Pengaturan server. Fitur bawaan Discord ini tetap jalan walau bot sedang mati.
  await onProgress('Mengatur server...');
  const edit = {};
  if (afkChannel) Object.assign(edit, { afkChannel, afkTimeout: 300 });
  if (systemChannel) edit.systemChannel = systemChannel;
  const s = template.settings || {};
  if (s.defaultNotifications) edit.defaultMessageNotifications = GuildDefaultMessageNotifications[s.defaultNotifications];
  if (s.verificationLevel) edit.verificationLevel = GuildVerificationLevel[s.verificationLevel];
  if (Object.keys(edit).length) {
    try {
      await guild.edit({ ...edit, reason: REASON });
    } catch (err) {
      result.failed.push(`Pengaturan server: ${err.message}`);
    }
  }

  return result;
}

module.exports = { applyTemplate, cleanupGuild, mergeAccess };
