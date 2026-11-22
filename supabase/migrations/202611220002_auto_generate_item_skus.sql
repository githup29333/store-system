create or replace function public.set_item_sku()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.sku is null or btrim(new.sku) = '' then
    new.sku := 'ITM-' || lpad(new.id::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists items_set_sku on public.items;
create trigger items_set_sku before insert on public.items
for each row execute function public.set_item_sku();
revoke all on function public.set_item_sku() from public, anon, authenticated;
