// Jalankan dengan: npm run check
// Mengecek semua template tanpa perlu menyalakan bot.
const { loadTemplates, countTemplate } = require('./templates');

const { templates, problems } = loadTemplates();
for (const t of templates.values()) {
  const c = countTemplate(t);
  console.log(`✅ ${t.id}.json (${t.name}): ${c.roles} role, ${c.categories} kategori, ${c.text} teks, ${c.voice} voice`);
}
for (const p of problems) console.log(`❌ ${p}`);
process.exit(problems.length ? 1 : 0);
