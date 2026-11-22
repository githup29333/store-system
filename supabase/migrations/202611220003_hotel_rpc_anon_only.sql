-- The hotel-key RPCs are used by the public worker/department portal with the anon key.
-- Keep that path, but do not let signed-in users inherit broader SECURITY DEFINER access.
revoke execute on function public.hotel_add_item(text,text,text) from public, authenticated;
grant execute on function public.hotel_add_item(text,text,text) to anon;

revoke execute on function public.hotel_info(text) from public, authenticated;
grant execute on function public.hotel_info(text) to anon;

revoke execute on function public.hotel_items(text) from public, authenticated;
grant execute on function public.hotel_items(text) to anon;

revoke execute on function public.hotel_log(text,text,text,text,text,text) from public, authenticated;
grant execute on function public.hotel_log(text,text,text,text,text,text) to anon;
