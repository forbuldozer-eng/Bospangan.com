# Aturan Program Affiliate Bos Pangan

Status: draft untuk review; belum diberlakukan di production.

## 1. Pendaftaran dan persetujuan
- Pendaftar harus memiliki akun pelanggan Bos Pangan dan mengisi data pendaftaran.
- Pengajuan berstatus Pending sampai Admin meninjau.
- Admin dapat menyetujui atau menolak pengajuan.
- Kode referral diterbitkan setelah pengajuan disetujui.
- Status affiliate terpisah dari role CMS.

## 2. Atribusi referral
- Setiap affiliate aktif memiliki kode referral unik dan tautan dengan parameter `?ref=KODE`.
- Masa atribusi adalah **90 hari** sejak calon pelanggan membuka tautan affiliate.
- Kunjungan baru melalui tautan affiliate lain mengganti atribusi sebelumnya (last-referral-click).
- Kode referral yang kedaluwarsa atau tidak valid tidak dikirim saat checkout.
- Satu pesanan hanya dapat dikaitkan dengan satu affiliate.
- Hanya pesanan baru yang diproses sebagai transaksi baru yang dapat menerima atribusi; pesanan duplikat/idempotent tidak diubah.
- Implementasi saat ini menyimpan masa berlaku di browser (localStorage). Sebelum production, pertimbangkan token atribusi bertanda tangan/server-side agar masa berlaku tidak dapat dimanipulasi oleh pengguna.

## 3. Komisi
- Komisi dicatat manual oleh Admin; tidak ada persentase otomatis.
- Admin mencatat nominal dan catatan/referensi komisi.
- Komisi memiliki status Available, Withdrawn, atau Void pada data komisi.
- Transaksi batal, fiktif, atau penyalahgunaan referral tidak boleh diberi komisi. Admin harus memeriksa status transaksi sebelum mencatat komisi.

## 4. Pencairan
- Affiliate aktif dapat mengajukan pencairan melalui dashboard akun pelanggan.
- Database memvalidasi saldo tersedia dan menahan nominal pengajuan Pending/Approved/Paid agar tidak diajukan berulang.
- Admin meninjau pengajuan, lalu menandai Approved, Rejected, atau Paid.
- Pembayaran harus dicatat dengan referensi transfer pada catatan review.

## 5. Larangan
- Pesanan palsu atau transaksi yang direkayasa.
- Menggunakan identitas atau akun orang lain tanpa izin.
- Spam atau promosi yang menyesatkan.
- Memanipulasi referral atau transaksi.
- Menjanjikan harga, diskon, atau komisi yang tidak ditetapkan Bos Pangan.

## 6. Batas implementasi
- Migration database dan deployment Edge Function belum dijalankan oleh perubahan branch ini.
- Penerapan memerlukan backup database, review migration, pengujian checkout/referral, dan pengujian dashboard sebelum rilis.
