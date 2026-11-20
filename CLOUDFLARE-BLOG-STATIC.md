# Blog statis Bos Pangan di Cloudflare Pages

## Halaman artikel
Setiap artikel disimpan sebagai file statis `blog/{slug}/index.html`. URL publik tetap `/blog/{slug}/`, tanpa redirect atau rewrite Blog.

## Build otomatis dari Supabase
Di Cloudflare Pages **bospangan-com → Settings → Builds**:
- Build command: `node scripts/generate-blog.mjs`
- Build output directory: `.`
- Root directory: kosong (root repository).

Generator membaca artikel Blog berstatus published dari Supabase dan menulis satu file HTML untuk setiap slug. `content_markdown` dikonversi ke HTML; `content_html` digunakan jika sudah terisi.

## Pemicu build sesudah Publish
1. Cloudflare → **Settings → Builds → Deploy Hooks** → buat hook untuk branch `infra/cloudflare-pages-alternative`.
2. Salin URL Deploy Hook.
3. Cloudflare → **Settings → Variables and secrets** → tambahkan secret bernama `BLOG_DEPLOY_HOOK_URL` berisi URL tersebut. Terapkan pada Production.
4. Saat Admin/Super Admin menekan Publish, CMS memanggil Pages Function `/api/blog-deploy`. Function memverifikasi sesi dan role Supabase Admin/Super Admin, lalu memanggil Deploy Hook dari secret server-side. URL rahasia tidak dikirim ke browser.
5. Cloudflare menjalankan generator dan menerbitkan HTML statis untuk artikel baru.

Jika Deploy Hook belum diatur, artikel tetap tersimpan di Supabase, tetapi CMS menampilkan bahwa halaman statis belum dibuat otomatis.

## Catatan
- Build ulang diperlukan setelah artikel diterbitkan, diedit, atau status publikasinya berubah.
- Generator menggunakan public key dari `auth-config.js`; tidak ada service-role key.
- Tidak ada perubahan schema, policy, atau isi database Supabase.
