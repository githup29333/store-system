-- Enforce tenant consistency and purchase-order lifecycle at the database boundary.
create or replace function public.guard_hotel_purchase_order()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare v_supplier_hotel text; v_supplier_active boolean;
begin
  select hotel_code, active into v_supplier_hotel, v_supplier_active
  from public.hotel_suppliers where id = new.supplier_id;
  if not found or v_supplier_hotel is distinct from new.hotel_code then
    raise exception 'المورد لا يتبع الفندق المحدد';
  end if;
  if not v_supplier_active then raise exception 'المورد موقوف'; end if;

  if tg_op = 'UPDATE' then
    if old.status in ('received','cancelled') then
      raise exception 'لا يمكن تعديل طلب شراء مستلم أو ملغي';
    end if;
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
drop trigger if exists guard_hotel_purchase_order on public.hotel_purchase_orders;
create trigger guard_hotel_purchase_order
before insert or update on public.hotel_purchase_orders
for each row execute function public.guard_hotel_purchase_order();

create or replace function public.guard_hotel_purchase_order_item()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare v_hotel text; v_status text;
begin
  if tg_op = 'DELETE' then
    select hotel_code, status into v_hotel, v_status from public.hotel_purchase_orders where id=old.purchase_order_id;
    if v_status <> 'draft' then raise exception 'لا يمكن حذف صنف بعد اعتماد طلب الشراء'; end if;
    return old;
  end if;

  select hotel_code, status into v_hotel, v_status from public.hotel_purchase_orders where id=new.purchase_order_id;
  if not found then raise exception 'طلب الشراء غير موجود'; end if;
  if tg_op = 'INSERT' and v_status <> 'draft' then raise exception 'لا يمكن إضافة أصناف بعد اعتماد طلب الشراء'; end if;

  if tg_op = 'UPDATE' then
    if old.purchase_order_id is distinct from new.purchase_order_id then
      raise exception 'لا يمكن نقل صنف بين طلبات شراء';
    end if;
    if v_status = 'ordered' then
      if new.item_id is distinct from old.item_id or new.quantity is distinct from old.quantity or
         new.unit is distinct from old.unit or new.unit_cost is distinct from old.unit_cost or
         new.note is distinct from old.note or
         not (old.received_quantity=0 and new.received_quantity=new.quantity) then
        raise exception 'بعد اعتماد الطلب لا يسمح إلا بتسجيل كمية الاستلام';
      end if;
    elsif v_status <> 'draft' then
      raise exception 'لا يمكن تعديل أصناف هذا الطلب';
    end if;
  end if;

  if not exists (
    select 1 from public.items i
    where i.id=new.item_id and (coalesce(cardinality(i.hotels),0)=0 or v_hotel=any(i.hotels))
  ) then raise exception 'الصنف غير مخصص لهذا الفندق'; end if;
  return new;
end;
$$;
revoke all on function public.guard_hotel_purchase_order_item() from public, anon, authenticated;
drop trigger if exists guard_hotel_purchase_order_item on public.hotel_purchase_order_items;
create trigger guard_hotel_purchase_order_item
before insert or update or delete on public.hotel_purchase_order_items
for each row execute function public.guard_hotel_purchase_order_item();
