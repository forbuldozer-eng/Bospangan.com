-- Import the five existing Bos Pangan static articles into the CMS.
-- Run once in the Bos Pangan Supabase SQL Editor after the CMS blog PR is merged and deployed.
-- Existing public URLs/slugs are preserved; this does not delete static pages or overwrite existing CMS rows.
begin;
insert into public.cms_articles
(title, slug, excerpt, content_markdown, featured_image_url, seo_title, seo_description, status, published_at)
values
('Cara Memulai Usaha Warung Sembako dari Nol', 'cara-memulai-usaha-warung-sembako', 'Pelajari cara memulai usaha warung sembako dari nol, mulai dari riset kebutuhan, modal, produk, pemasok, hingga pencatatan transaksi.', $article0$
Usaha warung sembako dapat dimulai secara bertahap dengan perencanaan yang jelas. Kunci awalnya adalah memahami kebutuhan warga sekitar, memilih barang yang perputarannya baik, dan menjaga pencatatan sederhana sejak hari pertama.

## 1. Kenali kebutuhan lingkungan

Amati kebiasaan belanja warga di sekitar lokasi. Perhatikan produk yang sering dicari, ukuran kemasan yang disukai, jam ramai, serta layanan yang dibutuhkan seperti pembelian eceran. Percakapan sederhana dengan tetangga dapat membantu menyusun daftar produk awal.

## 2. Susun modal dan anggaran

Pisahkan anggaran untuk persediaan, rak, perlengkapan, biaya operasional, dan dana cadangan. Mulailah sesuai kemampuan dan hindari menghabiskan seluruh modal untuk satu jenis produk. Besaran modal sangat bergantung pada lokasi, ukuran toko, pilihan barang, dan kondisi pemasok.

Buat catatan belanja awal beserta harga beli dan jumlah unit. Dengan begitu, pemilik warung lebih mudah menghitung kebutuhan pengisian ulang dan memantau arus kas.

## 3. Pilih produk awal

Prioritaskan kebutuhan sehari-hari seperti beras, minyak goreng, gula, tepung, mi instan, telur, kopi, teh, air minum, sabun, dan produk kebersihan. Sesuaikan variasi merek serta ukuran dengan daya beli dan kebiasaan pelanggan setempat.

Untuk daftar yang lebih terstruktur, baca panduan [daftar barang warung sembako](/blog/daftar-barang-warung-sembako/). Mulailah dengan variasi yang terukur, kemudian tambah produk berdasarkan permintaan nyata.

## 4. Cari pemasok tepercaya

Bandingkan harga, kualitas, ketepatan pengiriman, minimum pembelian, dan kebijakan retur. Simpan kontak beberapa pemasok untuk kategori produk berbeda agar pengadaan lebih fleksibel. Mintalah nota setiap transaksi dan periksa barang ketika diterima.

## 5. Tata ruang dan pelayanan

Susun produk berdasarkan kategori, tempatkan barang yang sering dibeli pada area mudah dijangkau, dan pastikan label harga mudah dibaca. Jaga kebersihan rak serta area transaksi. Pelayanan ramah, informasi yang jelas, dan jam buka yang konsisten membantu membangun kepercayaan pelanggan.

## 6. Catat transaksi dan evaluasi

Catat penjualan, pembelian stok, pengeluaran, dan uang yang masuk setiap hari. Periksa barang yang cepat terjual dan barang yang perlu pengadaan ulang. Panduan [cara mengatur stok warung](/blog/cara-mengatur-stok-warung/) dapat membantu membuat rutinitas persediaan lebih teratur.

**Langkah sederhana untuk memulai:**

Mulai dari kebutuhan lingkungan, belanja secara terukur, catat setiap transaksi, lalu kembangkan pilihan produk berdasarkan masukan pelanggan.

[Kunjungi Bos Pangan](/)
$article0$, null, 'Cara Memulai Usaha Warung Sembako dari Nol | Bos Pangan', 'Pelajari cara memulai usaha warung sembako dari nol, mulai dari riset kebutuhan, modal, produk, pemasok, hingga pencatatan transaksi.', 'published', '2026-11-04T00:00:00+07:00'::timestamptz),
('Daftar Barang Warung Sembako yang Perlu Disiapkan', 'daftar-barang-warung-sembako', 'Panduan daftar barang warung sembako untuk stok awal, mulai dari bahan pokok, kebutuhan dapur, makanan, minuman, hingga perlengkapan rumah.', $article1$
Daftar produk yang tepat membantu warung melayani kebutuhan pelanggan sehari-hari sekaligus membuat pengelolaan persediaan lebih terarah. Susunan berikut dapat menjadi titik awal dan perlu disesuaikan dengan kebiasaan belanja warga sekitar.

## 1. Bahan pokok

- Beras berbagai ukuran dan jenis sesuai permintaan.
- Minyak goreng kemasan dan minyak curah sesuai ketentuan yang berlaku.
- Gula pasir, tepung terigu, tepung tapioka, dan garam.
- Telur ayam serta bahan pokok lain yang memiliki pemasok rutin.

## 2. Kebutuhan dapur

- Mi instan, bihun, soun, dan pasta.
- Kecap manis, saus, sambal, kaldu, dan bumbu instan.
- Santan kemasan, margarin, dan bahan pelengkap memasak.
- Kopi, teh, susu, dan minuman serbuk.

## 3. Makanan dan minuman

- Air mineral dalam beberapa ukuran.
- Biskuit, wafer, roti kemasan, dan makanan ringan.
- Minuman siap konsumsi sesuai fasilitas penyimpanan.
- Camilan dengan variasi harga yang sesuai pelanggan sekitar.

## 4. Kebutuhan rumah tangga

- Sabun mandi, sampo, pasta gigi, dan sikat gigi.
- Deterjen, sabun cuci piring, dan pembersih lantai.
- Tisu, kantong sampah, korek api, dan perlengkapan rumah sederhana.
- Popok atau kebutuhan bayi jika memang dicari pelanggan.

## 5. Cara memilih stok awal

Gunakan tiga pertimbangan: seberapa sering produk dibutuhkan, berapa lama masa simpannya, dan berapa modal yang tertahan di persediaan. Untuk produk baru, beli dalam jumlah kecil dahulu lalu amati penjualannya. Produk dengan permintaan stabil dapat diberi prioritas pengadaan ulang.

Catat kategori, merek, ukuran, harga beli, jumlah stok, dan tanggal pembelian. Rutinitas ini akan membantu pemilik warung mengenali produk yang perlu ditambah atau dikurangi. Pelajari juga [cara mengatur stok warung](/blog/cara-mengatur-stok-warung/) dan [panduan memulai usaha warung sembako](/blog/cara-memulai-usaha-warung-sembako/).

**Catatan:** daftar ini bersifat panduan. Pilih produk berdasarkan permintaan lokal, kemampuan modal, fasilitas penyimpanan, dan ketentuan produk yang berlaku.

[Lihat katalog Bos Pangan](/)
$article1$, null, 'Daftar Barang Warung Sembako yang Perlu Disiapkan | Bos Pangan', 'Panduan daftar barang warung sembako untuk stok awal, mulai dari bahan pokok, kebutuhan dapur, makanan, minuman, hingga perlengkapan rumah.', 'published', '2026-11-04T00:00:00+07:00'::timestamptz),
('Cara Mengatur Stok Warung agar Lebih Terencana', 'cara-mengatur-stok-warung', 'Pelajari cara mengatur stok warung dengan pencatatan barang masuk keluar, stok minimum, pemeriksaan rutin, FIFO, dan FEFO.', $article2$
Pengelolaan stok yang rapi membantu pemilik warung mengetahui barang yang tersedia, menentukan waktu pemesanan ulang, dan merencanakan modal belanja. Sistemnya tidak harus rumit; buku catatan atau spreadsheet sederhana sudah dapat menjadi awal yang bermanfaat.

## 1. Buat daftar persediaan

Catat nama produk, kategori, satuan, jumlah stok, harga beli, pemasok, dan tanggal pembelian. Gunakan satuan yang konsisten, misalnya dus, pak, kilogram, atau pcs. Daftar yang konsisten membuat pencarian dan pemeriksaan lebih mudah.

## 2. Catat barang masuk dan keluar

Setiap penerimaan barang dan penjualan perlu dicatat. Catatan minimal memuat tanggal, nama produk, jumlah, dan keterangan. Jika ada barang rusak atau dikembalikan, catat sebagai penyesuaian agar angka persediaan tetap mendekati kondisi sebenarnya.

## 3. Lakukan pemeriksaan berkala

Periksa barang yang paling cepat bergerak setiap hari atau beberapa kali dalam seminggu. Lakukan pencocokan stok fisik dengan catatan secara berkala. Pemeriksaan ini membantu menemukan selisih lebih awal dan menjaga kualitas barang yang dijual.

## 4. Tentukan stok minimum

Tentukan batas minimum berdasarkan rata-rata penjualan dan waktu pengiriman pemasok. Produk yang cepat terjual dan mudah disimpan dapat memiliki batas pemesanan ulang yang lebih tinggi dibanding produk musiman. Evaluasi batas ini setelah melihat pola penjualan beberapa minggu.

## 5. Terapkan FIFO dan FEFO

FIFO (first in, first out) berarti barang yang lebih dahulu masuk diprioritaskan untuk dikeluarkan. Untuk produk dengan tanggal kedaluwarsa, perhatikan FEFO (first expired, first out), yaitu produk dengan tanggal kedaluwarsa paling dekat diprioritaskan. Simpan barang sesuai petunjuk pada kemasan dan pisahkan produk yang kualitasnya perlu diperiksa.

Pengelolaan stok menjadi lebih mudah ketika dipadukan dengan perencanaan pembelian. Baca juga [daftar barang warung sembako](/blog/daftar-barang-warung-sembako/) dan [panduan memulai usaha warung](/blog/cara-memulai-usaha-warung-sembako/) untuk melengkapi perencanaan usaha.

**Template pencatatan sederhana:**

Tanggal | Nama barang | Stok awal | Barang masuk | Terjual | Stok akhir | Catatan.

[Kunjungi halaman utama](/)
$article2$, null, 'Cara Mengatur Stok Warung agar Lebih Terencana | Bos Pangan', 'Pelajari cara mengatur stok warung dengan pencatatan barang masuk keluar, stok minimum, pemeriksaan rutin, FIFO, dan FEFO.', 'published', '2026-11-04T00:00:00+07:00'::timestamptz),
('Cara Menghitung Keuntungan Warung Sembako dengan Mudah', 'cara-menghitung-keuntungan-warung-sembako', 'Pelajari cara menghitung keuntungan warung sembako dengan mencatat omzet, harga pokok penjualan, biaya operasional, dan laba bersih secara sederhana.', $article3$
Pelajari cara menghitung keuntungan warung sembako dengan mencatat omzet, harga pokok penjualan, biaya operasional, dan laba bersih secara sederhana. Panduan ini membantu pemilik warung membuat keputusan berdasarkan catatan sederhana, kebutuhan pelanggan, dan kemampuan usaha masing-masing.

## 1. Bedakan omzet dan keuntungan

Omzet adalah total nilai penjualan dalam periode tertentu. Keuntungan adalah sisa pendapatan setelah biaya barang dan biaya usaha diperhitungkan. Omzet yang besar belum tentu menghasilkan keuntungan yang besar apabila biaya juga tinggi.

Catat transaksi setiap hari dan tentukan periode evaluasi, misalnya mingguan atau bulanan. Catatan yang konsisten membuat perbandingan antarperiode lebih mudah.

## 2. Hitung harga pokok barang terjual

Harga pokok penjualan (HPP) adalah biaya perolehan barang yang benar-benar terjual. Untuk pencatatan sederhana, gunakan rumus: **HPP = stok awal + pembelian bersih − stok akhir**. Pembelian bersih memperhitungkan retur atau potongan pembelian jika ada.

Contoh: stok awal senilai Rp2.000.000, pembelian bersih Rp5.000.000, dan stok akhir Rp1.500.000. HPP periode tersebut adalah Rp5.500.000. Gunakan nilai biaya perolehan yang tercatat pada nota.

## 3. Hitung laba kotor

Kurangi omzet dengan HPP untuk memperoleh laba kotor. Misalnya omzet selama satu bulan Rp7.000.000 dan HPP Rp5.500.000, maka laba kotor adalah Rp1.500.000.

Angka ini menunjukkan selisih penjualan dengan biaya barang, tetapi belum memperhitungkan biaya menjalankan warung.

## 4. Catat biaya operasional

Masukkan biaya yang terkait dengan kegiatan usaha, seperti listrik, transportasi pengadaan, kemasan, biaya administrasi, sewa, dan biaya tenaga kerja jika ada. Pisahkan pengeluaran pribadi dari uang usaha agar perhitungan lebih jelas.

Simpan nota dan tulis tanggal, kategori, serta jumlah setiap pengeluaran. Jika biaya dibayar untuk beberapa periode, catat dengan cara yang konsisten.

## 5. Hitung laba bersih dan evaluasi

Rumus sederhananya adalah **laba bersih = laba kotor − biaya operasional**. Jika laba kotor Rp1.500.000 dan biaya operasional Rp600.000, perkiraan laba bersih adalah Rp900.000 sebelum pajak atau kewajiban lain yang mungkin berlaku.

Periksa perubahan laba dari bulan ke bulan. Cari penyebabnya, misalnya perubahan harga pemasok, barang rusak, selisih stok, atau biaya pengiriman. Jangan mengambil kesimpulan dari satu hari penjualan saja.

## 6. Gunakan catatan sederhana

Buat tabel berisi tanggal, omzet, pembelian, stok awal, stok akhir, biaya operasional, dan catatan. Cocokkan uang kas dengan catatan transaksi secara berkala. Jika terdapat selisih, telusuri transaksi terkait dan perbaiki pencatatannya.

Perhitungan akan lebih akurat jika jumlah stok juga dikelola. Baca panduan [cara mengatur stok warung](/blog/cara-mengatur-stok-warung/) untuk membuat pemeriksaan persediaan rutin. Untuk menyusun pilihan barang, lihat [daftar barang warung sembako](/blog/daftar-barang-warung-sembako/). Jika sedang merintis, mulai dari [panduan memulai usaha warung sembako](/blog/cara-memulai-usaha-warung-sembako/).

**Langkah berikutnya:**

Terapkan satu atau dua langkah terlebih dahulu, catat hasilnya, lalu sesuaikan dengan kondisi warung. Untuk panduan lain, kunjungi [halaman artikel Bos Pangan](/blog/) atau kembali ke [halaman utama Bos Pangan](/).

## Artikel terkait

- [Tips Meningkatkan Penjualan Warung Sembako secara Bertahap](/blog/tips-meningkatkan-penjualan-warung-sembako/)
- [Cara Mengatur Stok Warung agar Lebih Terencana](/blog/cara-mengatur-stok-warung/)
- [Cara Memulai Usaha Warung Sembako dari Nol](/blog/cara-memulai-usaha-warung-sembako/)
$article3$, 'https://bospangan.com/blog/images/cara-menghitung-keuntungan-warung-sembako.svg', 'Cara Menghitung Keuntungan Warung Sembako dengan Mudah | Bos Pangan', 'Pelajari cara menghitung keuntungan warung sembako dengan mencatat omzet, harga pokok penjualan, biaya operasional, dan laba bersih secara sederhana.', 'published', '2026-11-04T00:00:00+07:00'::timestamptz),
('Tips Meningkatkan Penjualan Warung Sembako secara Bertahap', 'tips-meningkatkan-penjualan-warung-sembako', 'Pelajari tips meningkatkan penjualan warung sembako melalui pelayanan, penataan produk, ketersediaan stok, promosi lokal, dan evaluasi penjualan.', $article4$
Pelajari tips meningkatkan penjualan warung sembako melalui pelayanan, penataan produk, ketersediaan stok, promosi lokal, dan evaluasi penjualan. Panduan ini membantu pemilik warung membuat keputusan berdasarkan catatan sederhana, kebutuhan pelanggan, dan kemampuan usaha masing-masing.

## 1. Kenali kebutuhan pelanggan sekitar

Amati barang yang sering ditanyakan, ukuran kemasan yang diminati, serta waktu pelanggan biasanya berbelanja. Tanyakan masukan dengan ramah dan catat permintaan yang belum tersedia. Informasi ini membantu memilih perbaikan yang paling relevan.

Hindari menambah banyak barang hanya karena sedang tren. Uji dalam jumlah terukur dan evaluasi perputarannya.

## 2. Jaga ketersediaan barang penting

Barang yang sering dicari sebaiknya dipantau lebih rutin. Tetapkan batas stok minimum untuk produk utama dan jadwalkan pemeriksaan. Perhatikan tanggal kedaluwarsa dan gunakan prinsip FIFO atau FEFO sesuai jenis produk.

Pelajari langkah rinci melalui artikel [cara mengatur stok warung agar lebih terencana](/blog/cara-mengatur-stok-warung/). Daftar barang awal dapat disusun dengan bantuan [panduan daftar barang warung sembako](/blog/daftar-barang-warung-sembako/).

## 3. Tata produk agar mudah ditemukan

Kelompokkan produk berdasarkan kategori, pasang label harga yang terbaca, dan pastikan lorong atau area transaksi rapi. Tempatkan barang yang sering dibeli pada area yang mudah dijangkau tanpa menghalangi akses ke produk lain.

Periksa kebersihan rak dan kemasan secara rutin. Penataan yang konsisten membantu pelanggan menemukan kebutuhan dengan lebih nyaman.

## 4. Tingkatkan kualitas pelayanan

Sapa pelanggan dengan sopan, jawab pertanyaan secara jelas, dan berikan informasi harga yang transparan. Jika barang sedang kosong, sampaikan perkiraan ketersediaan hanya jika informasinya sudah diketahui. Catat keluhan dan tindak lanjuti dengan wajar.

Pelayanan yang ramah dan dapat diandalkan membantu membangun hubungan jangka panjang dengan warga sekitar.

## 5. Gunakan promosi lokal yang sederhana

Informasikan jam buka, lokasi, dan ketersediaan layanan melalui papan informasi atau kanal komunikasi yang digunakan pelanggan. Jika memakai WhatsApp, mintalah izin sebelum mengirim informasi promosi dan berikan pilihan untuk berhenti menerima pesan.

Promosi sebaiknya menjelaskan informasi yang benar, termasuk harga, periode, stok, dan syarat yang berlaku. Hindari klaim berlebihan atau informasi yang dapat membingungkan pelanggan.

## 6. Ukur hasil dan sesuaikan langkah

Catat jumlah transaksi, omzet, kategori produk yang banyak terjual, dan produk yang jarang bergerak. Bandingkan periode yang setara dan perhatikan faktor seperti hari libur atau perubahan pasokan. Uji satu perubahan pada satu waktu agar hasilnya lebih mudah dinilai.

Jika sedang menyiapkan usaha, baca [cara memulai usaha warung sembako dari nol](/blog/cara-memulai-usaha-warung-sembako/). Menghitung hasil usaha juga penting; gunakan panduan [cara menghitung keuntungan warung sembako](/blog/cara-menghitung-keuntungan-warung-sembako/) untuk memantau laba, bukan hanya omzet.

**Langkah berikutnya:**

Terapkan satu atau dua langkah terlebih dahulu, catat hasilnya, lalu sesuaikan dengan kondisi warung. Untuk panduan lain, kunjungi [halaman artikel Bos Pangan](/blog/) atau kembali ke [halaman utama Bos Pangan](/).

## Artikel terkait

- [Cara Menghitung Keuntungan Warung Sembako dengan Mudah](/blog/cara-menghitung-keuntungan-warung-sembako/)
- [Daftar Barang Warung Sembako yang Perlu Disiapkan](/blog/daftar-barang-warung-sembako/)
- [Cara Mengatur Stok Warung agar Lebih Terencana](/blog/cara-mengatur-stok-warung/)
$article4$, 'https://bospangan.com/blog/images/tips-meningkatkan-penjualan-warung-sembako.svg', 'Tips Meningkatkan Penjualan Warung Sembako secara Bertahap | Bos Pangan', 'Pelajari tips meningkatkan penjualan warung sembako melalui pelayanan, penataan produk, ketersediaan stok, promosi lokal, dan evaluasi penjualan.', 'published', '2026-11-04T00:00:00+07:00'::timestamptz)
on conflict (slug) do nothing;
commit;