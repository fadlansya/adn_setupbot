require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env'), quiet: true });
const { Client, GatewayIntentBits, Events, MessageFlags, OAuth2Scopes, PermissionFlagsBits } = require('discord.js');
const { loadTemplates } = require('./templates');

const token = process.env.DISCORD_TOKEN;
if (!token || token === 'isi_token_bot_di_sini') {
  console.error('❌ DISCORD_TOKEN belum diisi. Salin .env.example menjadi .env lalu isi token bot.');
  process.exit(1);
}

const { templates, problems } = loadTemplates();
for (const p of problems) console.warn(`⚠️ Template dilewati: ${p}`);
if (templates.size === 0) {
  console.error('❌ Tidak ada template valid di folder templates/.');
  process.exit(1);
}

const commands = new Map(
  ['setup', 'template', 'role'].map((name) => {
    const mod = require(`./commands/${name}`);
    return [name, { ...mod, data: mod.build(templates) }];
  }),
);

// Hanya butuh intent Guilds: bot tidak membaca isi pesan dan tidak butuh privileged intent.
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (c) => {
  // Daftarkan slash command secara global setiap kali bot nyala, supaya template baru langsung muncul.
  await c.application.commands.set([...commands.values()].map((cmd) => cmd.data.toJSON()));

  const invite = c.generateInvite({
    scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
    permissions: [PermissionFlagsBits.Administrator],
  });
  console.log(`✅ Bot online sebagai ${c.user.tag}`);
  console.log(`📋 Template: ${[...templates.values()].map((t) => t.name).join(', ')}`);
  console.log(`🔗 Link invite: ${invite}`);
  console.log(`🏠 Ada di ${c.guilds.cache.size} server. Tekan Ctrl+C untuk mematikan bot.`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, { templates });
  } catch (err) {
    console.error(`Error di /${interaction.commandName}:`, err);
    const content = `❌ Terjadi error: ${err.message}`;
    const send = interaction.replied || interaction.deferred
      ? interaction.followUp({ content, flags: MessageFlags.Ephemeral })
      : interaction.reply({ content, flags: MessageFlags.Ephemeral });
    await send.catch(() => {});
  }
});

process.on('SIGINT', () => {
  console.log('\n👋 Mematikan bot...');
  client.destroy().finally(() => process.exit(0));
});

client.login(token);
