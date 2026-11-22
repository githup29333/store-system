create or replace function public.import_hotel_inventory(p_hotel_code text, p_rows jsonb)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, public, auth
as $$
declare
  v_row record;
  v_item_id integer;
  v_count integer := 0;
  v_seen text[] := array[]::text[];
begin
  if coalesce(auth.jwt()->>'email','') <> 'mhmdbwft09@gmail.com' then
    raise exception 'غير مصرح باستيراد المخزون';
  end if;
  if not exists (select 1 from public.hotels where code=p_hotel_code and active) then
    raise exception 'الفندق غير موجود أو موقوف';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows)=0 or jsonb_array_length(p_rows)>2000 then
    raise exception 'ملف الاستيراد فارغ أو يتجاوز 2000 صنف';
  end if;

  for v_row in
    select * from jsonb_to_recordset(p_rows)
      as x(sku text, quantity numeric, unit text, reorder_level numeric)
  loop
    if nullif(btrim(v_row.sku),'') is null or v_row.quantity is null or v_row.reorder_level is null then
      raise exception 'كل صف يحتاج SKU والكمية وحد إعادة الطلب';
    end if;
    if v_row.quantity < 0 or v_row.reorder_level < 0 then
      raise exception 'لا يمكن أن تكون الكمية أو حد الطلب سالباً';
    end if;
    if btrim(v_row.sku)=any(v_seen) then raise exception 'SKU مكرر في ملف الاستيراد: %',v_row.sku; end if;
    v_seen:=array_append(v_seen,btrim(v_row.sku));

    select i.id into v_item_id
    from public.items i
    where i.sku=btrim(v_row.sku)
      and (coalesce(cardinality(i.hotels),0)=0 or p_hotel_code=any(i.hotels))
    limit 1;
    if not found then raise exception 'SKU غير معروف أو غير مخصص لهذا الفندق: %',v_row.sku; end if;

    insert into public.hotel_stock_movements
      (hotel_code,item_id,movement_type,quantity,unit,note,reference,created_by)
    values
      (p_hotel_code,v_item_id,'adjust',v_row.quantity,
       coalesce(nullif(btrim(v_row.unit),''),'قطعة'),
       'استيراد رصيد افتتاحي من CSV','CSV-IMPORT',auth.uid());

    update public.hotel_inventory
      set reorder_level=v_row.reorder_level,updated_at=now()
      where hotel_code=p_hotel_code and item_id=v_item_id;
    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.import_hotel_inventory(text,jsonb) from public, anon, authenticated;
grant execute on function public.import_hotel_inventory(text,jsonb) to authenticated;
