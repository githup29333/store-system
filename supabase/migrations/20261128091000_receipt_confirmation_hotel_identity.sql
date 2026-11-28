CREATE OR REPLACE FUNCTION public.hotel_receipt_get(p_token_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE result jsonb;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid receipt token';
  END IF;
  SELECT jsonb_build_object(
    'code', o.code, 'dept', o.dept, 'no', o.no, 'hotel_code', h.code,
    'hotel_name', h.name, 'received_by', o.received_by,
    'received_at', o.received_at, 'created_at', o.created_at
  ) INTO result
  FROM public.orders o JOIN public.hotels h ON h.code = o.hotel
  WHERE o.kind = 'final' AND o.receipt_token_hash = p_token_hash
  LIMIT 1;
  IF result IS NULL THEN RAISE EXCEPTION 'receipt link not found'; END IF;
  RETURN result;
END
$function$;
REVOKE ALL ON FUNCTION public.hotel_receipt_get(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hotel_receipt_get(text) TO service_role;
