drop function if exists public.hotel_items(text);
create function public.hotel_items(k text)
returns table(id integer, ar text, en text, code text, sku text)
language sql stable security definer
set search_path = public
as $function$
  select i.id, i.ar, i.en, i.code, i.sku
  from public.items i, public.hotels h
  where h.key = k and h.active and (i.hotels = '{}' or h.code = any(i.hotels))
  order by i.id
$function$;

drop function if exists public.hotel_add_item(text,text,text);
create function public.hotel_add_item(k text, p_ar text, p_en text)
returns table(id integer, ar text, en text, code text, sku text)
language plpgsql security definer
set search_path = public
as $function$
declare hc text; r public.items%rowtype;
begin
  select h.code into hc from public.hotels h where h.key = k and h.active;
  if hc is null then raise exception 'invalid key'; end if;
  p_ar := left(btrim(coalesce(p_ar,'')),120);
  p_en := left(btrim(coalesce(p_en,'')),120);
  if p_ar = '' then raise exception 'empty name'; end if;
  select * into r from public.items i
    where (i.hotels = '{}' or hc = any(i.hotels))
      and (lower(i.ar)=lower(p_ar) or lower(i.en)=lower(p_ar))
    limit 1;
  if not found then
    insert into public.items(ar,en,hotels) values (p_ar,p_en,array[hc]) returning * into r;
  end if;
  return query select r.id, r.ar, r.en, r.code, r.sku;
end
$function$;

revoke all on function public.hotel_items(text) from public, authenticated;
grant execute on function public.hotel_items(text) to anon;
revoke all on function public.hotel_add_item(text,text,text) from public, authenticated;
grant execute on function public.hotel_add_item(text,text,text) to anon;
