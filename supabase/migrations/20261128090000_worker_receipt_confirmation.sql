ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS receipt_token_hash text,
  ADD COLUMN IF NOT EXISTS received_by text,
  ADD COLUMN IF NOT EXISTS received_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS orders_receipt_token_hash_uidx
  ON public.orders (receipt_token_hash)
  WHERE receipt_token_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.hotel_receipt_issue(k text, p_no text, p_token_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE hc text; oid bigint; was_received timestamptz;
BEGIN
  SELECT h.code INTO hc FROM public.hotels h
  WHERE h.key = k AND h.active
    AND h.expires_at >= (now() AT TIME ZONE 'Africa/Tripoli')::date;
  IF hc IS NULL THEN RAISE EXCEPTION 'invalid key'; END IF;
  IF p_no IS NULL OR p_no !~ '^[A-Za-z0-9_-]{1,64}$'
     OR p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid receipt token';
  END IF;
  SELECT id, received_at INTO oid, was_received
  FROM public.orders
  WHERE hotel = hc AND kind = 'final' AND no = p_no
  ORDER BY created_at DESC, id DESC
  LIMIT 1 FOR UPDATE;
  IF oid IS NULL THEN RAISE EXCEPTION 'issued order not found'; END IF;
  IF was_received IS NOT NULL THEN RAISE EXCEPTION 'order already received'; END IF;
  UPDATE public.orders SET receipt_token_hash = p_token_hash WHERE id = oid;
  RETURN jsonb_build_object('ok', true);
END
$function$;

CREATE OR REPLACE FUNCTION public.hotel_receipt_get(p_token_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE result jsonb;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid receipt token'; END IF;
  SELECT jsonb_build_object(
    'code', o.code, 'dept', o.dept, 'no', o.no, 'hotel_name', h.name,
    'received_by', o.received_by, 'received_at', o.received_at, 'created_at', o.created_at
  ) INTO result
  FROM public.orders o JOIN public.hotels h ON h.code = o.hotel
  WHERE o.kind = 'final' AND o.receipt_token_hash = p_token_hash LIMIT 1;
  IF result IS NULL THEN RAISE EXCEPTION 'receipt link not found'; END IF;
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION public.hotel_receipt_confirm(p_token_hash text, p_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE oid bigint; result jsonb; clean_name text;
BEGIN
  clean_name := btrim(coalesce(p_name, ''));
  IF p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$'
     OR length(clean_name) < 2 OR length(clean_name) > 80
     OR clean_name ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'invalid receipt confirmation'; END IF;
  UPDATE public.orders SET received_by = clean_name, received_at = now()
  WHERE kind = 'final' AND receipt_token_hash = p_token_hash AND received_at IS NULL
  RETURNING id INTO oid;
  IF oid IS NOT NULL THEN
    SELECT jsonb_build_object('ok', true, 'received_by', received_by, 'received_at', received_at, 'no', no)
    INTO result FROM public.orders WHERE id = oid;
    RETURN result;
  END IF;
  SELECT jsonb_build_object('ok', false, 'already_received', true, 'received_by', received_by, 'received_at', received_at, 'no', no)
  INTO result FROM public.orders
  WHERE kind = 'final' AND receipt_token_hash = p_token_hash AND received_at IS NOT NULL LIMIT 1;
  IF result IS NULL THEN RAISE EXCEPTION 'receipt link not found'; END IF;
  RETURN result;
END
$function$;

REVOKE ALL ON FUNCTION public.hotel_receipt_issue(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hotel_receipt_get(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hotel_receipt_confirm(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hotel_receipt_issue(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hotel_receipt_get(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hotel_receipt_confirm(text, text) TO service_role;
