const fs = require('node:fs');
const path = require('node:path');
const { PermissionFlagsBits, GuildDefaultMessageNotifications, GuildVerificationLevel } = require('discord.js');

const TEMPLATE_DIR = path.join(__dirname, '..', 'templates');
const CHANNEL_TYPES = ['text', 'voice'];
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * Membaca semua file templates/*.json.
 * Template yang tidak valid dilewati dan alasannya dikembalikan di `problems`.
 */
function loadTemplates() {
  const templates = new Map();
  const problems = [];

  const files = fs.readdirSync(TEMPLATE_DIR).filter((f) => f.endsWith('.json')).sort();
  for (const file of files) {
    const id = path.basename(file, '.json').toLowerCase();
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(TEMPLATE_DIR, file), 'utf8'));
    } catch (err) {
      problems.push(`${file}: bukan JSON yang valid (${err.message})`);
      continue;
    }
    const errors = validateTemplate(data);
    if (errors.length) {
      problems.push(`${file}:\n  - ${errors.join('\n  - ')}`);
      continue;
    }
    templates.set(id, { id, roles: [], ...data });
  }

  return { templates, problems };
}

function checkPermissions(list, where, errors) {
  if (list === undefined) return;
  if (!Array.isArray(list)) {
    errors.push(`${where}: harus berupa array`);
    return;
  }
  for (const perm of list) {
    if (!(perm in PermissionFlagsBits)) errors.push(`${where}: izin "${perm}" tidak dikenal`);
  }
}

function checkAccess(access, roleNames, where, errors) {
  if (access === undefined) return;
  if (typeof access !== 'object' || Array.isArray(access)) {
    errors.push(`${where}.access: harus berupa object`);
    return;
  }
  for (const [target, rule] of Object.entries(access)) {
    if (target !== '@everyone' && !roleNames.has(target)) {
      errors.push(`${where}.access: role "${target}" tidak ada di daftar roles template`);
    }
    checkPermissions(rule.allow, `${where}.access["${target}"].allow`, errors);
    checkPermissions(rule.deny, `${where}.access["${target}"].deny`, errors);
  }
}

function validateTemplate(t) {
  const errors = [];
  if (typeof t.name !== 'string' || !t.name.trim()) errors.push('"name" wajib diisi');
  if (t.roles !== undefined && !Array.isArray(t.roles)) errors.push('"roles" harus berupa array');
  if (!Array.isArray(t.categories) || t.categories.length === 0) errors.push('"categories" wajib berisi minimal 1 kategori');
  if (errors.length) return errors;

  if (t.settings) {
    const { defaultNotifications, verificationLevel } = t.settings;
    if (defaultNotifications !== undefined && !(defaultNotifications in GuildDefaultMessageNotifications)) {
      errors.push(`settings.defaultNotifications "${defaultNotifications}" tidak dikenal (pakai AllMessages atau OnlyMentions)`);
    }
    if (verificationLevel !== undefined && !(verificationLevel in GuildVerificationLevel)) {
      errors.push(`settings.verificationLevel "${verificationLevel}" tidak dikenal (None, Low, Medium, High, VeryHigh)`);
    }
  }

  const roleNames = new Set();
  (t.roles || []).forEach((role, i) => {
    const where = `roles[${i}]`;
    if (typeof role.name !== 'string' || !role.name.trim() || role.name.length > 100) {
      errors.push(`${where}: "name" wajib diisi (maks. 100 karakter)`);
      return;
    }
    if (roleNames.has(role.name)) errors.push(`${where}: nama role "${role.name}" dobel`);
    roleNames.add(role.name);
    if (role.color !== undefined && !HEX_COLOR.test(role.color)) errors.push(`${where}: warna harus format #RRGGBB`);
    checkPermissions(role.permissions, `${where}.permissions`, errors);
  });
  if (roleNames.size > 250) errors.push('maksimal 250 role per server');

  let totalChannels = 0;
  let afkCount = 0;
  let systemCount = 0;
  t.categories.forEach((cat, i) => {
    const where = `categories[${i}]`;
    if (typeof cat.name !== 'string' || !cat.name.trim() || cat.name.length > 100) {
      errors.push(`${where}: "name" wajib diisi (maks. 100 karakter)`);
    }
    checkAccess(cat.access, roleNames, where, errors);
    if (!Array.isArray(cat.channels)) {
      errors.push(`${where}: "channels" harus berupa array`);
      return;
    }
    if (cat.channels.length > 50) errors.push(`${where}: maksimal 50 channel per kategori`);
    totalChannels += 1 + cat.channels.length;

    cat.channels.forEach((ch, j) => {
      const cw = `${where}.channels[${j}]`;
      const type = ch.type ?? 'text';
      if (typeof ch.name !== 'string' || !ch.name.trim() || ch.name.length > 100) {
        errors.push(`${cw}: "name" wajib diisi (maks. 100 karakter)`);
      }
      if (!CHANNEL_TYPES.includes(type)) errors.push(`${cw}: type harus "text" atau "voice"`);
      if (ch.topic !== undefined && (typeof ch.topic !== 'string' || ch.topic.length > 1024)) {
        errors.push(`${cw}: topic maks. 1024 karakter`);
      }
      if (ch.slowmode !== undefined && !(Number.isInteger(ch.slowmode) && ch.slowmode >= 0 && ch.slowmode <= 21600)) {
        errors.push(`${cw}: slowmode harus angka 0-21600 (detik)`);
      }
      if (ch.userLimit !== undefined && !(Number.isInteger(ch.userLimit) && ch.userLimit >= 0 && ch.userLimit <= 99)) {
        errors.push(`${cw}: userLimit harus angka 0-99`);
      }
      if (ch.message !== undefined && (typeof ch.message !== 'string' || ch.message.length > 4000)) {
        errors.push(`${cw}: message maks. 4000 karakter`);
      }
      if (ch.message !== undefined && type !== 'text') errors.push(`${cw}: message hanya untuk channel text`);
      if (ch.afk) {
        afkCount++;
        if (type !== 'voice') errors.push(`${cw}: afk hanya untuk channel voice`);
      }
      if (ch.systemChannel) {
        systemCount++;
        if (type !== 'text') errors.push(`${cw}: systemChannel hanya untuk channel text`);
      }
      checkAccess(ch.access, roleNames, cw, errors);
    });
  });
  if (totalChannels > 500) errors.push('maksimal 500 channel (termasuk kategori) per server');
  if (afkCount > 1) errors.push('hanya boleh 1 channel dengan "afk": true');
  if (systemCount > 1) errors.push('hanya boleh 1 channel dengan "systemChannel": true');

  return errors;
}

function countTemplate(t) {
  const channels = t.categories.flatMap((c) => c.channels);
  return {
    roles: t.roles.length,
    categories: t.categories.length,
    text: channels.filter((c) => (c.type ?? 'text') === 'text').length,
    voice: channels.filter((c) => c.type === 'voice').length,
  };
}

module.exports = { loadTemplates, validateTemplate, countTemplate, TEMPLATE_DIR };
