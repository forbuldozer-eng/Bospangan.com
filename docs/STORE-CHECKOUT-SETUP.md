# Aktivasi Checkout Publik Bos Pangan

Dokumen ini melanjutkan setup awal pada docs/COMMERCE-BACKEND-SETUP.md. Jalankan tahap secara berurutan.

## 1. Jalankan migrasi checkout

Project Supabase Bos Pangan: flyndyrplyvalnhzhvz.

1. Buka Supabase Dashboard → SQL Editor.
2. Buat query baru.
3. Buka file supabase/checkout.sql dari repository ini.
4. Salin seluruh SQL, tempelkan ke SQL Editor, lalu klik Run.
5. Pastikan hasil menunjukkan Success.

Migrasi ini menambahkan alamat pengiriman dan idempotency key pada tabel pesanan; membuat fungsi aman untuk membaca tarif pajak default tanpa membuka email owner; membuat transaksi atomik yang memvalidasi produk tayang, harga, pajak, dan stok; mengurangi stok saat pesanan reguler dibuat dan mengembalikannya bila admin membatalkan pesanan; membatasi percobaan checkout per fingerprint alamat IP; serta mencabut hak insert langsung ke tabel orders dari klien publik.

Jangan jalankan file ini sebelum schema.sql dan commerce-backend.sql berhasil dijalankan.

## 2. Deploy Edge Function create-order

File sumber: supabase/functions/create-order/index.ts.

Deploy dari Supabase Dashboard:

1. Buka project Supabase Bos Pangan.
2. Pilih Edge Functions di sidebar.
3. Klik Deploy a new function → Via Editor.
4. Beri nama fungsi persis create-order.
5. Ganti isi editor dengan seluruh isi file supabase/functions/create-order/index.ts dari repository ini.
6. Klik Deploy function.
7. Buka detail fungsi create-order dan matikan Verify JWT untuk fungsi ini.

Checkout menerima pengunjung tanpa akun pelanggan. Karena itu pemeriksaan JWT bawaan gateway harus dimatikan untuk fungsi create-order; validasi transaksi dilakukan oleh fungsi server dan fungsi database yang hanya dapat dipanggil service role. File supabase/config.toml juga menyimpan pengaturan verify_jwt = false untuk deployment melalui Supabase CLI.

Jangan mematikan Verify JWT pada fungsi lain, terutama send-product-campaign.

## 3. Konfigurasi email owner

Pesanan tetap tersimpan meskipun provider email belum diatur. Agar notifikasi email otomatis dikirim, siapkan akun provider email seperti Resend, verifikasi domain pengirim, lalu masukkan secret di Supabase → Edge Functions → Secrets:

| Secret | Isi |
|---|---|
| RESEND_API_KEY | API key dari akun email provider |
| EMAIL_FROM | Alamat pengirim pada domain yang sudah diverifikasi, misalnya Bos Pangan <pesanan@bospangan.com> |
| ALLOWED_ORIGINS (opsional) | Daftar origin tambahan dipisahkan koma |

Jangan masukkan API key atau service/secret key ke auth-config.js, HTML, atau repository GitHub. Secret hanya disimpan di Supabase.

Origin default yang diizinkan oleh fungsi:
- https://bospangancom-theta.vercel.app
- https://bospangan.com
- https://www.bospangan.com

Jika menggunakan alamat preview lain, tambahkan alamat tersebut melalui secret ALLOWED_ORIGINS.

Bila RESEND_API_KEY atau EMAIL_FROM belum tersedia, pesanan masih tersimpan dan antrean email tetap berstatus pending; halaman checkout akan menjelaskan bahwa email owner belum dikonfigurasi.

## 4. Alur yang tersedia

### Pesanan reguler
- Pengunjung memilih produk yang berstatus Tayang di CMS.
- Harga dan stok selalu dibaca ulang dari database, bukan dipercaya dari browser.
- Tarif pajak per produk digunakan bila diisi; bila kosong, checkout menggunakan pajak default toko.
- Stok direservasi saat pesanan tersimpan.
- Admin melihat detail pelanggan, alamat, item, pajak, subtotal, dan total pada tab Transaksi.

### Transaksi khusus / permintaan penawaran
- Pengunjung mengisi kebutuhan khusus minimal 10 karakter.
- Dapat dibuat tanpa memilih produk atau dengan item dari keranjang.
- Status awal masuk sebagai quoted.
- Stok tidak dikurangi untuk permintaan penawaran.

Tidak ada pembayaran online atau biaya pengiriman otomatis pada versi ini. Admin menghubungi pelanggan untuk mengonfirmasi ketersediaan, biaya pengiriman, penawaran akhir, dan pembayaran.

## 5. Pengujian yang disarankan

1. Jalankan checkout.sql dan deploy create-order.
2. Pastikan pengaturan toko sudah berisi email owner forbuldozer@gmail.com, pajak default 5%, dan email notifications aktif.
3. Untuk tes reguler, tayangkan sementara produk percobaan TEST CMS - Beras dengan stok 1. Produk tersebut sebelumnya memiliki override pajak 7%.
4. Buka halaman utama menggunakan alamat development, masukkan produk tersebut ke keranjang, lalu kirim pesanan reguler dengan data uji.
5. Periksa tab Transaksi di CMS. Pesanan harus muncul dengan status new, pajak per item 7%, dan stok produk berkurang menjadi 0.
6. Ubah status pesanan uji menjadi cancelled dari CMS. Stok produk harus kembali menjadi 1.
7. Uji permintaan khusus dengan deskripsi minimal 10 karakter. Pesanan harus muncul dengan status quoted dan tidak mengurangi stok.

Setelah uji selesai, kembalikan produk percobaan ke status Draft agar tidak tampil pada katalog publik. Pembatalan pesanan reguler uji akan mengembalikan stok.