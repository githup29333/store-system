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