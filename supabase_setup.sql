-- Repair tracker schema for Supabase.
-- Run this entire file in Supabase SQL Editor as project owner.
-- Then create an admin user in Authentication -> Users and copy that user's UUID.
-- Finally run the INSERT statement in README_AR.md to grant admin privileges.

create extension if not exists pgcrypto;

create table if not exists public.repair_devices (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[0-9]{8}$'),
  device_name text not null,
  device_type text not null default '',
  fault text not null,
  status text not null default 'قيد الانتظار'
    check (status in ('قيد الانتظار','جاري التجهيز','جاهز للاستلام','تم استلامه','ملغي')),
  work_done text not null default '',
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_settings (
  id integer primary key check (id = 1),
  store_name text not null default 'مركز الصيانة',
  whatsapp_number text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.repair_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into public.store_settings (id, store_name, whatsapp_number)
values (1, 'مركز الصيانة', '')
on conflict (id) do nothing;

alter table public.repair_devices enable row level security;
alter table public.store_settings enable row level security;
alter table public.repair_admins enable row level security;

-- Admin checking function uses a fixed search_path to avoid object substitution.
create or replace function public.is_repair_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.repair_admins a
    where a.user_id = (select auth.uid())
  );
$$;

-- Anonymous clients may only use this function to fetch public tracking fields.
-- The raw table itself is not readable to anonymous visitors.
create or replace function public.lookup_repair_device(p_code text)
returns table (
  code text,
  device_name text,
  device_type text,
  fault text,
  status text,
  work_done text,
  due_date date,
  store_name text,
  whatsapp_number text
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.code, d.device_name, d.device_type, d.fault, d.status,
         d.work_done, d.due_date, s.store_name, s.whatsapp_number
  from public.repair_devices d
  cross join public.store_settings s
  where d.code = upper(trim(p_code))
    and s.id = 1
  limit 1;
$$;

create or replace function public.public_store_settings()
returns table (store_name text, whatsapp_number text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.store_name, s.whatsapp_number
  from public.store_settings s
  where s.id = 1
  limit 1;
$$;

revoke all on function public.is_repair_admin() from public;
grant execute on function public.is_repair_admin() to authenticated;
revoke all on function public.lookup_repair_device(text) from public;
grant execute on function public.lookup_repair_device(text) to anon, authenticated;
revoke all on function public.public_store_settings() from public;
grant execute on function public.public_store_settings() to anon, authenticated;

-- No anonymous table access. Only authenticated admins can manage records.
revoke all on public.repair_devices from anon, authenticated;
revoke all on public.store_settings from anon, authenticated;
revoke all on public.repair_admins from anon, authenticated;

grant select, insert, update, delete on public.repair_devices to authenticated;
grant select, insert, update on public.store_settings to authenticated;

create policy "Admins manage repair devices"
on public.repair_devices
for all
to authenticated
using (public.is_repair_admin())
with check (public.is_repair_admin());

create policy "Admins read store settings"
on public.store_settings
for select
to authenticated
using (public.is_repair_admin());

create policy "Admins insert store settings"
on public.store_settings
for insert
to authenticated
with check (public.is_repair_admin());

create policy "Admins update store settings"
on public.store_settings
for update
to authenticated
using (public.is_repair_admin())
with check (public.is_repair_admin());

-- updated_at is refreshed automatically.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists repair_devices_touch_updated_at on public.repair_devices;
create trigger repair_devices_touch_updated_at
before update on public.repair_devices
for each row execute function public.touch_updated_at();

drop trigger if exists store_settings_touch_updated_at on public.store_settings;
create trigger store_settings_touch_updated_at
before update on public.store_settings
for each row execute function public.touch_updated_at();
