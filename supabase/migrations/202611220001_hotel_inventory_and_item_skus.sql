alter table public.items
  add column if not exists sku text,
  add column if not exists barcode text;

update public.items
set sku = 'ITM-' || lpad(id::text, 6, '0')
where sku is null or btrim(sku) = '';

create unique index if not exists items_sku_uidx on public.items (sku);
create unique index if not exists items_barcode_uidx on public.items (barcode) where barcode is not null and btrim(barcode) <> '';

create table if not exists public.hotel_inventory (
  id bigint generated always as identity primary key,
  hotel_code text not null references public.hotels(code) on delete cascade,
  item_id integer not null references public.items(id) on delete restrict,
  quantity numeric(14,3) not null default 0 check (quantity >= 0),
  reorder_level numeric(14,3) not null default 0 check (reorder_level >= 0),
  unit text not null default 'قطعة',
  updated_at timestamptz not null default now(),
  unique (hotel_code, item_id)
);

create table if not exists public.hotel_stock_movements (
  id bigint generated always as identity primary key,
  hotel_code text not null references public.hotels(code) on delete cascade,
  item_id integer not null references public.items(id) on delete restrict,
  movement_type text not null check (movement_type in ('in','out','adjust')),
  quantity numeric(14,3) not null check (quantity >= 0),
  unit text not null default 'قطعة',
  note text,
  reference text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (movement_type = 'adjust' or quantity > 0)
);

create index if not exists hotel_inventory_hotel_idx on public.hotel_inventory(hotel_code);
create index if not exists hotel_stock_movements_hotel_created_idx on public.hotel_stock_movements(hotel_code, created_at desc);
create index if not exists hotel_stock_movements_item_idx on public.hotel_stock_movements(hotel_code, item_id);

alter table public.hotel_inventory enable row level security;
alter table public.hotel_stock_movements enable row level security;

drop policy if exists hotel_inventory_admin on public.hotel_inventory;
create policy hotel_inventory_admin on public.hotel_inventory for all to authenticated
  using ((select auth.jwt() ->> 'email') = 'mhmdbwft09@gmail.com')
  with check ((select auth.jwt() ->> 'email') = 'mhmdbwft09@gmail.com');

drop policy if exists hotel_stock_movements_read_admin on public.hotel_stock_movements;
create policy hotel_stock_movements_read_admin on public.hotel_stock_movements for select to authenticated
  using ((select auth.jwt() ->> 'email') = 'mhmdbwft09@gmail.com');
drop policy if exists hotel_stock_movements_insert_admin on public.hotel_stock_movements;
create policy hotel_stock_movements_insert_admin on public.hotel_stock_movements for insert to authenticated
  with check ((select auth.jwt() ->> 'email') = 'mhmdbwft09@gmail.com');

grant select, insert, update, delete on public.hotel_inventory to authenticated;
grant select, insert on public.hotel_stock_movements to authenticated;
grant usage, select on sequence public.hotel_stock_movements_id_seq to authenticated;
grant usage, select on sequence public.hotel_inventory_id_seq to authenticated;

create or replace function public.apply_hotel_stock_movement()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.movement_type = 'in' then
    insert into public.hotel_inventory (hotel_code, item_id, quantity, unit, updated_at)
    values (new.hotel_code, new.item_id, new.quantity, new.unit, now())
    on conflict (hotel_code, item_id) do update
      set quantity = public.hotel_inventory.quantity + excluded.quantity, unit = excluded.unit, updated_at = now();
  elsif new.movement_type = 'out' then
    update public.hotel_inventory set quantity = quantity - new.quantity, unit = new.unit, updated_at = now()
     where hotel_code = new.hotel_code and item_id = new.item_id and quantity >= new.quantity;
    if not found then raise exception 'رصيد المخزون غير كافٍ أو لم يتم تسجيل رصيد افتتاحي لهذا الصنف'; end if;
  elsif new.movement_type = 'adjust' then
    insert into public.hotel_inventory (hotel_code, item_id, quantity, unit, updated_at)
    values (new.hotel_code, new.item_id, new.quantity, new.unit, now())
    on conflict (hotel_code, item_id) do update
      set quantity = excluded.quantity, unit = excluded.unit, updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists hotel_stock_movement_apply on public.hotel_stock_movements;
create trigger hotel_stock_movement_apply after insert on public.hotel_stock_movements
for each row execute function public.apply_hotel_stock_movement();
revoke all on function public.apply_hotel_stock_movement() from public, anon, authenticated;
