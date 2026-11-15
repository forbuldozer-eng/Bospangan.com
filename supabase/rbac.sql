-- Bos Pangan: focused CMS access rules (Super Admin, Admin, Customer only).
-- Apply after schema.sql and commerce-backend.sql.
-- This migration intentionally does not introduce operational sub-roles.

begin;

-- Keep only the three account classes currently required.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role is null or role in ('super_admin','admin','customer'));

-- Only Super Admin can assign/revoke Admin access.
-- Admin cannot promote another account, change a Super Admin, or change itself.
create or replace function public.admin_set_user_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_role text;
  v_new_role text;
begin
  if not public.is_super_admin() then
    raise exception 'Only the Super Admin can manage account access';
  end if;

  if p_user_id = (select auth.uid()) then
    raise exception 'Super Admin cannot change their own access';
  end if;

  if coalesce(p_role, '') not in ('admin','customer','none') then
    raise exception 'Invalid account role';
  end if;

  select role into v_current_role
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'User profile not found';
  end if;

  if v_current_role = 'super_admin' then
    raise exception 'The Super Admin account is protected';
  end if;

  v_new_role := case when p_role = 'none' then null else p_role end;

  update public.profiles
  set role = v_new_role,
      updated_at = now()
  where id = p_user_id;

  insert into public.admin_audit_log(actor_id, action, entity_type, entity_id, details)
  values (
    (select auth.uid()),
    'role_changed',
    'profile',
    p_user_id::text,
    jsonb_build_object('previous_role', v_current_role, 'new_role', v_new_role)
  );
end;
$$;

revoke all on function public.admin_set_user_role(uuid, text) from public;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;

-- Article CMS. Customers and visitors can read published articles only.
-- Super Admin and Admin can create, edit, publish, unpublish, and delete articles.
create table if not exists public.cms_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text not null default '',
  content_markdown text not null default '',
  featured_image_url text,
  seo_title text not null default '',
  seo_description text not null default '',
  status text not null default 'draft'
    check (status in ('draft','published')),
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_articles_slug_not_blank check (length(trim(slug)) > 0),
  constraint cms_articles_title_not_blank check (length(trim(title)) > 0)
);

create or replace function public.set_cms_article_audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $
begin
  if tg_op = 'INSERT' then
    if new.created_by is null then
      new.created_by := (select auth.uid());
    end if;
  end if;
  new.updated_by := (select auth.uid());
  new.updated_at := now();
  return new;
end;
$;

drop trigger if exists trg_set_cms_article_audit_fields on public.cms_articles;
create trigger trg_set_cms_article_audit_fields
before insert or update on public.cms_articles
for each row execute function public.set_cms_article_audit_fields();

create index if not exists cms_articles_status_published_idx
  on public.cms_articles(status, published_at desc);
create index if not exists cms_articles_updated_at_idx
  on public.cms_articles(updated_at desc);

alter table public.cms_articles enable row level security;

drop policy if exists "public reads published CMS articles" on public.cms_articles;
create policy "public reads published CMS articles"
on public.cms_articles
for select
to anon
using (status = 'published');

drop policy if exists "users read published or admins all CMS articles" on public.cms_articles;
create policy "users read published or admins all CMS articles"
on public.cms_articles
for select
to authenticated
using (status = 'published' or public.is_admin());

drop policy if exists "admins create CMS articles" on public.cms_articles;
create policy "admins create CMS articles"
on public.cms_articles
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "admins update CMS articles" on public.cms_articles;
create policy "admins update CMS articles"
on public.cms_articles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins delete CMS articles" on public.cms_articles;
create policy "admins delete CMS articles"
on public.cms_articles
for delete
to authenticated
using (public.is_admin());

grant select on public.cms_articles to anon, authenticated;
grant insert, update, delete on public.cms_articles to authenticated;

-- Keep profile access limited to the account owner and Admin/Super Admin.
drop policy if exists "users read own profile or authorized directory" on public.profiles;
drop policy if exists "admins read profiles" on public.profiles;
create policy "admins read profiles"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()) or public.is_admin());

commit;
