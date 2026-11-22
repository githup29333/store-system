-- Hotel-scoped procurement and append-only activity history.
-- Existing hotel inventory and price permissions are preserved: admin-only access.
create table if not exists public.hotel_suppliers (
  id uuid primary key default gen_random_uuid(),
  hotel_code text not null references public.hotels(code) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 180),
  contact text, phone text, email text, notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hotel_suppliers_hotel_idx on public.hotel_suppliers(hotel_code, active, name);

create table if not exists public.hotel_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  hotel_code text not null references public.hotels(code) on delete cascade,
  supplier_id uuid not null references public.hotel_suppliers(id) on delete restrict,
  order_no text not null default ('PO-' || to_char(now(),'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),
  status text not null default 'draft' check (status in ('draft','ordered','received','cancelled')),
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ordered_at timestamptz, received_at timestamptz,
  unique (hotel_code, order_no)
);
create index if not exists hotel_purchase_orders_hotel_idx on public.hotel_purchase_orders(hotel_code, created_at desc);
create index if not exists hotel_purchase_orders_status_idx on public.hotel_purchase_orders(status, created_at desc);

create table if not exists public.hotel_purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.hotel_purchase_orders(id) on delete cascade,
  item_id integer not null references public.items(id) on delete restrict,
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null default 'قطعة',
  unit_cost numeric(14,4) not null default 0 check (unit_cost >= 0),
  received_quantity numeric(14,3) not null default 0 check (received_quantity >= 0),
  note text,
  line_total numeric(18,4) generated always as (quantity * unit_cost) stored,
  created_at timestamptz not null default now()
);
create index if not exists hotel_purchase_order_items_order_idx on public.hotel_purchase_order_items(purchase_order_id);

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  hotel_code text, actor_id uuid, actor_email text,
  operation text not null, table_name text not null, entity_id text,
  old_data jsonb, new_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log(created_at desc);
create index if not exists admin_audit_log_hotel_created_idx on public.admin_audit_log(hotel_code, created_at desc);

alter table public.hotel_suppliers enable row level security;
alter table public.hotel_purchase_orders enable row level security;
alter table public.hotel_purchase_order_items enable row level security;
alter table public.admin_audit_log enable row level security;

drop policy if exists hotel_suppliers_admin on public.hotel_suppliers;
create policy hotel_suppliers_admin on public.hotel_suppliers for all to authenticated
using ((select auth.jwt() ->> 'email') = 'mhmdbwft09@gmail.com')
with check ((select auth.jwt() ->> 'email') = 'mhmdbwft09@gmail.com');
drop policy if exists hotel_purchase_orders_admin on public.hotel_purchase_orders;
create policy hotel_purchase_orders_admin on public.hotel_purchase_orders for all to authenticated
using ((select auth.jwt() ->> 'email') = 'mhmdbwft09@gmail.com')
with check ((select auth.jwt() ->> 'email') = 'mhmdbwft09@gmail.com');
drop policy if exists hotel_purchase_order_items_admin on public.hotel_purchase_order_items;
create policy hotel_purchase_order_items_admin on public.hotel_purchase_order_items for all to authenticated
using ((select auth.jwt() ->> 'email') = 'mhmdbwft09@gmail.com')
with check ((select auth.jwt() ->> 'email') = 'mhmdbwft09@gmail.com');
drop policy if exists admin_audit_log_read_admin on public.admin_audit_log;
create policy admin_audit_log_read_admin on public.admin_audit_log for select to authenticated
using ((select auth.jwt() ->> 'email') = 'mhmdbwft09@gmail.com');

grant select, insert, update, delete on public.hotel_suppliers to authenticated;
grant select, insert, update, delete on public.hotel_purchase_orders to authenticated;
grant select, insert, update, delete on public.hotel_purchase_order_items to authenticated;
grant select on public.admin_audit_log to authenticated;
grant usage, select on sequence public.admin_audit_log_id_seq to authenticated;

create or replace function public.write_admin_audit_log()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare v_old jsonb; v_new jsonb; v_row jsonb;
begin
  if tg_op = 'INSERT' then v_new := to_jsonb(new); v_row := v_new;
  elsif tg_op = 'UPDATE' then v_old := to_jsonb(old); v_new := to_jsonb(new); v_row := v_new;
  else v_old := to_jsonb(old); v_row := v_old;
  end if;
  insert into public.admin_audit_log
    (hotel_code, actor_id, actor_email, operation, table_name, entity_id, old_data, new_data)
  values
    (v_row->>'hotel_code', auth.uid(), auth.jwt()->>'email', tg_op, tg_table_name,
     coalesce(v_row->>'id', v_row->>'item_id', v_row->>'code', v_row->>'sku'), v_old, v_new);
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function public.write_admin_audit_log() from public, anon, authenticated;

drop trigger if exists audit_hotel_inventory on public.hotel_inventory;
create trigger audit_hotel_inventory after insert or update or delete on public.hotel_inventory for each row execute function public.write_admin_audit_log();
drop trigger if exists audit_hotel_stock_movements on public.hotel_stock_movements;
create trigger audit_hotel_stock_movements after insert or update or delete on public.hotel_stock_movements for each row execute function public.write_admin_audit_log();
drop trigger if exists audit_hotel_suppliers on public.hotel_suppliers;
create trigger audit_hotel_suppliers after insert or update or delete on public.hotel_suppliers for each row execute function public.write_admin_audit_log();
drop trigger if exists audit_hotel_purchase_orders on public.hotel_purchase_orders;
create trigger audit_hotel_purchase_orders after insert or update or delete on public.hotel_purchase_orders for each row execute function public.write_admin_audit_log();
drop trigger if exists audit_hotel_purchase_order_items on public.hotel_purchase_order_items;
create trigger audit_hotel_purchase_order_items after insert or update or delete on public.hotel_purchase_order_items for each row execute function public.write_admin_audit_log();
drop trigger if exists audit_prices on public.prices;
create trigger audit_prices after insert or update or delete on public.prices for each row execute function public.write_admin_audit_log();
drop trigger if exists audit_items on public.items;
create trigger audit_items after insert or update or delete on public.items for each row execute function public.write_admin_audit_log();

create or replace function public.receive_hotel_purchase_order(p_order_id uuid)
returns void language plpgsql security invoker
set search_path = pg_catalog, public, auth
as $$
declare v_order public.hotel_purchase_orders%rowtype; v_line record; v_count integer := 0;
begin
  if coalesce(auth.jwt()->>'email','') <> 'mhmdbwft09@gmail.com' then
    raise exception 'غير مصرح باستلام طلب الشراء';
  end if;
  select * into v_order from public.hotel_purchase_orders where id = p_order_id for update;
  if not found then raise exception 'طلب الشراء غير موجود'; end if;
  if v_order.status = 'received' then raise exception 'تم استلام طلب الشراء مسبقاً'; end if;
  if v_order.status <> 'ordered' then raise exception 'يجب اعتماد الطلب قبل الاستلام'; end if;
  for v_line in select * from public.hotel_purchase_order_items where purchase_order_id = p_order_id order by created_at, id loop
    insert into public.hotel_stock_movements
      (hotel_code, item_id, movement_type, quantity, unit, note, reference, created_by)
    values (v_order.hotel_code, v_line.item_id, 'in', v_line.quantity, v_line.unit,
      'استلام طلب شراء ' || v_order.order_no, v_order.order_no, auth.uid());
    update public.hotel_purchase_order_items set received_quantity = quantity where id = v_line.id;
    v_count := v_count + 1;
  end loop;
  if v_count = 0 then raise exception 'أضف صنفاً واحداً على الأقل قبل الاستلام'; end if;
  update public.hotel_purchase_orders set status='received', received_at=now(), updated_at=now() where id=p_order_id;
end;
$$;
revoke all on function public.receive_hotel_purchase_order(uuid) from public, anon, authenticated;
grant execute on function public.receive_hotel_purchase_order(uuid) to authenticated;
