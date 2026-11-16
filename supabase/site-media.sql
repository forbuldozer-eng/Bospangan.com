-- Bos Pangan shared media library: images and videos.
-- Run in Supabase SQL Editor on the dedicated Bos Pangan project.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-media',
  'site-media',
  true,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm'
  ]
)
on conflict (id) do update
set
  name = excluded.name,
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public reads Bos Pangan shared media" on storage.objects;
create policy "Public reads Bos Pangan shared media"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'site-media');

drop policy if exists "Admins upload Bos Pangan shared media" on storage.objects;
create policy "Admins upload Bos Pangan shared media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'site-media'
  and public.is_admin()
);

drop policy if exists "Admins update Bos Pangan shared media" on storage.objects;
create policy "Admins update Bos Pangan shared media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'site-media'
  and public.is_admin()
)
with check (
  bucket_id = 'site-media'
  and public.is_admin()
);

drop policy if exists "Admins delete Bos Pangan shared media" on storage.objects;
create policy "Admins delete Bos Pangan shared media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'site-media'
  and public.is_admin()
);

commit;
