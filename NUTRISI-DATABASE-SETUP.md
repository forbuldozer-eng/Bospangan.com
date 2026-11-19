# Aktivasi Database Nutrisi Bos Pangan

1. Buka Supabase project Bos Pangan, lalu SQL Editor.
2. Jalankan seluruh file `supabase/nutrition-directory.sql`.
3. Setelah migrasi sukses, deploy branch ini melalui pull request.
4. Masukkan data bahan pangan ke `nutrition_foods`.
5. Masukkan angka zat gizi ke `nutrition_food_nutrients`, dengan sumber, satuan, dan basis yang jelas.
6. Set `is_published=true` hanya setelah data diverifikasi.

Tabel: `nutrition_categories`, `nutrition_foods`, `nutrition_nutrients`, `nutrition_food_nutrients`.

RLS aktif. Pembacaan publik dibatasi pada kategori aktif dan bahan pangan terbit. Penulisan hanya untuk akun yang lolos fungsi `public.is_admin()`. Tidak ada service-role key di frontend.

Tidak ada angka gizi sintetis yang dimasukkan. Dataset Panganku belum diimpor karena akses sumber terhalang dan lisensi penggunaan datanya belum diverifikasi.