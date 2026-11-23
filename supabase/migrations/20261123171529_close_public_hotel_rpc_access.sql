-- Anonymous worker requests must go through the validated hotel-portal Edge Function.
-- Only the server-side service role may invoke these SECURITY DEFINER database helpers.
REVOKE ALL ON FUNCTION public.hotel_add_item(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hotel_add_item(text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.hotel_info(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hotel_info(text) TO service_role;

REVOKE ALL ON FUNCTION public.hotel_items(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hotel_items(text) TO service_role;

REVOKE ALL ON FUNCTION public.hotel_log(text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hotel_log(text, text, text, text, text, text) TO service_role;
