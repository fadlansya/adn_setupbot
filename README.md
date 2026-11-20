# Setup Bot

Bot Discord untuk membangun server dengan cepat dari template: role, kategori, channel, izin, dan pesan aturan. Bot hanya dinyalakan saat dibutuhkan, lalu boleh dimatikan lagi.

## Persiapan (sekali saja)

1. Buka https://discord.com/developers/applications lalu klik **New Application**.
2. Masuk menu **Bot**, klik **Reset Token**, lalu salin tokennya.
3. Salin `.env.example` menjadi `.env`, lalu isi `DISCORD_TOKEN=` dengan token tadi.
4. Bot ini **tidak** butuh *Privileged Gateway Intents*, jadi semua toggle di halaman Bot boleh dibiarkan mati.

## Cara pakai

1. Klik dua kali `start.bat` (atau jalankan `npm start`).
2. Console akan menampilkan **link invite**. Buka link itu dan undang bot ke server yang mau di-setup (bot minta izin Administrator).
3. Di server tersebut, ketik `/setup`, pilih template, lalu tekan tombol konfirmasi.
4. Setelah selesai:
   - Di **Server Settings → Roles**, geser role bot ke paling atas.
   - Pakai `/role kasih` untuk memberi dirimu role 👑 Owner.
5. Tutup jendela bot. Setelah setup beres, bot juga boleh di-kick dari server tersebut.

> Slash command didaftarkan otomatis setiap kali bot nyala. Kalau command belum muncul, tekan `Ctrl+R` di Discord.

## Daftar command

| Command | Fungsi |
|---|---|
| `/setup template [bersihkan] [nama_server]` | Bangun server dari template. Dengan `bersihkan: True`, semua channel dan role lama **dihapus permanen** dulu. |
| `/template daftar` | Lihat semua template |
| `/template lihat template` | Lihat isi lengkap satu template (channel dan role) |
| `/role buat nama [warna] [izin] [pisah] [bisa_mention]` | Buat satu role |
| `/role massal daftar` | Buat banyak role sekaligus, contoh: `VIP:#f1c40f, Gamer:ungu, Member` |
| `/role hapus role` | Hapus role |
| `/role kasih member role` / `/role cabut member role` | Beri atau cabut role dari member |
| `/role izin role preset` | Ganti izin role: kosong, member, moderator, admin, atau administrator |
| `/role warna role warna` | Ganti warna role (`#RRGGBB` atau merah, biru, hijau, kuning, ungu, oranye, pink, tosca, abu, putih, hitam) |

Semua command hanya bisa dipakai oleh member yang punya izin Administrator.

## Template bawaan

- **Nongkrong**: info, ngobrol, meme, mabar, voice santai/musik/nobar, channel AFK, area staff.
- **Komunitas**: informasi, perkenalan, diskusi, tanya-jawab, event + panggung, voice lounge, area staff dengan laporan member.
- **Toko**: aturan, cara order, metode pembayaran, katalog/promo/stok (hanya staff yang bisa posting), order, konfirmasi pembayaran, testimoni, garansi, area khusus reseller, area staff, dan laporan keuangan (khusus admin).

Setiap template juga memasang fitur bawaan Discord yang **tetap jalan walau bot mati**: pesan otomatis saat member join (di channel selamat-datang), channel AFK, dan notifikasi default "hanya mention".

> Pesan di channel **metode-pembayaran** (template Toko) masih berisi placeholder. Edit pesan itu dan isi data pembayaran tokomu.

## Membuat atau mengedit template

Template adalah file JSON di folder `templates/`. Salin salah satu file, ganti namanya (misalnya `sekolah.json`), lalu edit isinya. Setelah itu jalankan `npm run check` untuk memeriksa kesalahan, lalu nyalakan ulang bot. Template baru akan muncul otomatis di pilihan `/setup` (maksimal 25 template).

```jsonc
{
  "name": "Nama Template",
  "description": "Penjelasan singkat",
  "settings": { "defaultNotifications": "OnlyMentions", "verificationLevel": "Low" },
  "roles": [
    // urutan dari atas ke bawah; nama izin mengikuti PermissionFlagsBits discord.js
    { "name": "Admin", "color": "#E74C3C", "hoist": true, "mentionable": true, "permissions": ["ManageMessages"] }
  ],
  "categories": [
    {
      "name": "📌 INFO",
      // izin kategori, berlaku juga untuk semua channel di dalamnya
      "access": {
        "@everyone": { "deny": ["SendMessages"] },
        "Admin": { "allow": ["SendMessages"] }
      },
      "channels": [
        { "name": "aturan", "topic": "...", "message": "Isi pesan. {server} diganti nama server." },
        { "name": "selamat-datang", "systemChannel": true },
        { "name": "Voice", "type": "voice", "userLimit": 5, "afk": false,
          // izin tambahan khusus channel ini (digabung dengan izin kategori)
          "access": { "@everyone": { "deny": ["Speak"] } } }
      ]
    }
  ]
}
```

Opsi channel: `type` (`text`/`voice`), `topic`, `slowmode` (detik), `userLimit`, `message` (dikirim sebagai embed), `systemChannel` (channel pesan join), `afk` (channel AFK), dan `access`.

## Catatan

- Tanpa `bersihkan`, channel lama tetap ada dan role yang namanya sama dipakai ulang (tidak dibuat dobel).
- Dengan `bersihkan`, channel tempat kamu mengetik `/setup` ikut terhapus, jadi ringkasan hasil dikirim lewat DM.
- Role yang posisinya di atas role bot, dan channel wajib di server Community (rules/updates), tidak bisa dihapus. Bot akan melaporkannya sebagai langkah yang gagal.
- Fitur yang butuh bot terus menyala (reaction role, auto-role, verifikasi tombol) sengaja tidak dibuat, karena bot hanya dinyalakan saat dibutuhkan. Untuk member yang memilih role sendiri, pakai fitur bawaan **Onboarding** Discord (butuh server Community).
