create or replace function public.guard_hotel_purchase_order()
returns trigger language plpgsql set search_path = pg_catalog, public
as $$
declare v_supplier_hotel text; v_supplier_active boolean;
begin
  select hotel_code, active into v_supplier_hotel, v_supplier_active
  from public.hotel_suppliers where id = new.supplier_id;
  if not found or v_supplier_hotel is distinct from new.hotel_code then
    raise exception 'المورد لا يتبع الفندق المحدد';
  end if;
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.supplier_id is distinct from old.supplier_id) then
    if not v_supplier_active then raise exception 'المورد موقوف'; end if;
  end if;
  if tg_op = 'UPDATE' then
    if old.status in ('received','cancelled') then raise exception 'لا يمكن تعديل طلب شراء مستلم أو ملغي'; end if;
    if old.status <> 'draft' and (
      new.hotel_code is distinct from old.hotel_code or
      new.supplier_id is distinct from old.supplier_id or
      new.order_no is distinct from old.order_no or
      new.notes is distinct from old.notes
    ) then raise exception 'لا يمكن تعديل تفاصيل الطلب بعد اعتماده'; end if;
    if new.status is distinct from old.status and not (
      (old.status='draft' and new.status in ('ordered','cancelled')) or
      (old.status='ordered' and new.status in ('received','cancelled'))
    ) then raise exception 'انتقال حالة طلب الشراء غير مسموح'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_hotel_purchase_order() from public, anon, authenticated;

create or replace function public.guard_hotel_supplier_hotel()
returns trigger language plpgsql set search_path = pg_catalog, public
as $$
begin
  if new.hotel_code is distinct from old.hotel_code and exists (
    select 1 from public.hotel_purchase_orders where supplier_id=old.id
  ) then raise exception 'لا يمكن نقل مورد مرتبط بطلبات شراء إلى فندق آخر'; end if;
  return new;
end;
$$;
revoke all on function public.guard_hotel_supplier_hotel() from public, anon, authenticated;
drop trigger if exists guard_hotel_supplier_hotel on public.hotel_suppliers;
create trigger guard_hotel_supplier_hotel before update on public.hotel_suppliers
for each row execute function public.guard_hotel_supplier_hotel();
