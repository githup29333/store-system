create table if not exists public.stocktake_sessions (
  id uuid primary key default gen_random_uuid(),
  hotel_code text not null default 'EBR' references public.hotels(code),
  title text not null default 'جرد المواد الغذائية',
  status text not null default 'open' check (status in ('open','completed')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint stocktake_sessions_ebr_only check (hotel_code = 'EBR')
);
create index if not exists stocktake_sessions_hotel_created_idx on public.stocktake_sessions(hotel_code, created_at desc);
create table if not exists public.stocktake_lines (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.stocktake_sessions(id) on delete cascade,
  item_id integer not null references public.items(id),
  item_name_snapshot text not null,
  quantity numeric(14,3) not null check (quantity >= 0),
  unit text not null default 'وحدة',
  note text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id, item_id)
);
create index if not exists stocktake_lines_session_idx on public.stocktake_lines(session_id);
alter table public.stocktake_sessions enable row level security;
alter table public.stocktake_lines enable row level security;
drop policy if exists stocktake_sessions_read on public.stocktake_sessions;
create policy stocktake_sessions_read on public.stocktake_sessions for select to authenticated using (hotel_code = 'EBR' and private.has_app_permission('inventory','read'));
drop policy if exists stocktake_sessions_create on public.stocktake_sessions;
create policy stocktake_sessions_create on public.stocktake_sessions for insert to authenticated with check (hotel_code = 'EBR' and created_by = auth.uid() and private.has_app_permission('inventory','create'));
drop policy if exists stocktake_sessions_update on public.stocktake_sessions;
create policy stocktake_sessions_update on public.stocktake_sessions for update to authenticated using (hotel_code = 'EBR' and private.has_app_permission('inventory','update')) with check (hotel_code = 'EBR' and private.has_app_permission('inventory','update'));
drop policy if exists stocktake_sessions_delete on public.stocktake_sessions;
create policy stocktake_sessions_delete on public.stocktake_sessions for delete to authenticated using (hotel_code = 'EBR' and private.has_app_permission('inventory','delete'));
drop policy if exists stocktake_lines_read on public.stocktake_lines;
create policy stocktake_lines_read on public.stocktake_lines for select to authenticated using (private.has_app_permission('inventory','read') and exists (select 1 from public.stocktake_sessions s where s.id = session_id and s.hotel_code = 'EBR'));
drop policy if exists stocktake_lines_create on public.stocktake_lines;
create policy stocktake_lines_create on public.stocktake_lines for insert to authenticated with check (created_by = auth.uid() and private.has_app_permission('inventory','create') and exists (select 1 from public.stocktake_sessions s where s.id = session_id and s.hotel_code = 'EBR' and s.status = 'open'));
drop policy if exists stocktake_lines_update on public.stocktake_lines;
create policy stocktake_lines_update on public.stocktake_lines for update to authenticated using (private.has_app_permission('inventory','update') and exists (select 1 from public.stocktake_sessions s where s.id = session_id and s.hotel_code = 'EBR' and s.status = 'open')) with check (private.has_app_permission('inventory','update') and exists (select 1 from public.stocktake_sessions s where s.id = session_id and s.hotel_code = 'EBR' and s.status = 'open'));
drop policy if exists stocktake_lines_delete on public.stocktake_lines;
create policy stocktake_lines_delete on public.stocktake_lines for delete to authenticated using (private.has_app_permission('inventory','delete') and exists (select 1 from public.stocktake_sessions s where s.id = session_id and s.hotel_code = 'EBR'));
