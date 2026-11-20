# Blog statis Bos Pangan di Cloudflare Pages

Halaman artikel berada di `blog/{slug}/index.html`. Setiap URL slug dilayani langsung dari file HTML statis tanpa redirect, rewrite, Pages Function, atau pemuat JavaScript.

## Build otomatis dari Supabase

Agar perubahan CMS ikut diperbarui pada build Cloudflare berikutnya, atur Cloudflare Pages **bospangan-com**:

1. Buka **Workers & Pages → bospangan-com → Settings → Build**.
2. **Build command:** `node scripts/generate-blog.mjs`
3. **Build output directory:** `.`
4. **Root directory:** kosong (root repository).
5. Simpan pengaturan.

Script memakai URL dan publishable key publik dari `auth-config.js`, membaca hanya artikel Blog berstatus published, lalu membuat HTML statis untuk setiap slug. Tidak ada service-role key atau secret database pada script.

Setelah perubahan Build command, deploy Preview branch dan uji URL artikelnya. Ketika CMS menerbitkan atau mengedit artikel, Cloudflare perlu menjalankan deployment/build lagi supaya HTML statis mengikuti data Supabase. Tanpa build ulang, file statis tetap menampilkan hasil build terakhir.

## Catatan
- `content_markdown` dikonversi ke HTML untuk artikel lama.
- `content_html` dipakai saat CMS sudah menyimpan HTML.
- Jika artikel tidak lagi published, generator menghapus halaman yang sebelumnya dihasilkan olehnya.
- Tidak ada perubahan schema, policy, atau isi database Supabase pada commit ini.
