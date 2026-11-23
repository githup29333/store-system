-- Validate worker identity consistency and make exact request/final submissions idempotent.
CREATE OR REPLACE FUNCTION public.hotel_log(
  k text, p_kind text, p_code text, p_dept text, p_no text, p_device text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE
  hc text; f text[]; z text[]; entry text; item_id bigint;
  qty numeric; req numeric; iss numeric; seen_ids bigint[] := ARRAY[]::bigint[];
  item_count integer := 0; part_no integer; part_total integer;
BEGIN
  SELECT h.code INTO hc FROM public.hotels h
  WHERE h.key = k AND h.active
    AND h.expires_at >= (now() AT TIME ZONE 'Africa/Tripoli')::date;
  IF hc IS NULL THEN RAISE EXCEPTION 'invalid key'; END IF;
  IF p_kind NOT IN ('request', 'final') THEN RAISE EXCEPTION 'invalid order kind'; END IF;
  IF p_code IS NULL OR length(p_code) > 30000 THEN RAISE EXCEPTION 'invalid order code'; END IF;
  IF p_dept IS NULL OR p_dept !~ '^[A-Za-z0-9_-]{1,16}$'
     OR p_no IS NULL OR p_no !~ '^[A-Za-z0-9_-]{1,64}$' THEN
    RAISE EXCEPTION 'invalid order identity';
  END IF;
  f := string_to_array(p_code, '|');
  IF f[2] IS DISTINCT FROM p_dept OR f[3] IS DISTINCT FROM p_no
     OR f[4] !~ '^[0-9]{6}$'
     OR to_char(to_date('20' || f[4], 'YYYYMMDD'), 'YYMMDD') <> f[4]
     OR f[6] !~ '^[A-Za-z0-9]{1,16}$'
     OR coalesce(length(f[8]), 0) > 120
     OR coalesce(length(p_device), 0) > 40 THEN
    RAISE EXCEPTION 'invalid order fields';
  END IF;
  IF p_kind = 'request' THEN
    IF f[1] <> 'EBR1' OR cardinality(f) < 8 THEN RAISE EXCEPTION 'invalid request code'; END IF;
    z := string_to_array(f[5], '/');
    IF cardinality(z) <> 2 OR z[1] !~ '^[0-9]{1,3}$' OR z[2] !~ '^[0-9]{1,3}$' THEN
      RAISE EXCEPTION 'invalid request part';
    END IF;
    part_no := z[1]::integer; part_total := z[2]::integer;
    IF part_total < 1 OR part_total > 100 OR part_no < 1 OR part_no > part_total THEN
      RAISE EXCEPTION 'request part out of range';
    END IF;
    FOREACH entry IN ARRAY string_to_array(f[7], ',') LOOP
      item_count := item_count + 1;
      IF item_count > 30 OR entry !~ '^[0-9]{1,10}:[0-9]{1,9}(\.[0-9]{1,3})?$' THEN
        RAISE EXCEPTION 'invalid requested item';
      END IF;
      z := string_to_array(entry, ':'); item_id := z[1]::bigint; qty := z[2]::numeric;
      IF item_id <= 0 OR qty <= 0 OR item_id = ANY(seen_ids) THEN RAISE EXCEPTION 'invalid requested quantity'; END IF;
      seen_ids := array_append(seen_ids, item_id);
    END LOOP;
  ELSE
    IF f[1] <> 'EBR1F' OR cardinality(f) < 9 OR f[5] !~ '^[0-9]{1,3}$' THEN
      RAISE EXCEPTION 'invalid final code';
    END IF;
    IF coalesce(f[9], '') IS DISTINCT FROM coalesce(p_device, '') THEN
      RAISE EXCEPTION 'device does not match final code';
    END IF;
    part_total := f[5]::integer;
    IF part_total < 1 OR part_total > 100 THEN RAISE EXCEPTION 'final part count out of range'; END IF;
    FOREACH entry IN ARRAY string_to_array(f[7], ',') LOOP
      item_count := item_count + 1;
      IF item_count > 500 OR entry !~ '^[0-9]{1,10}:[0-9]{1,9}(\.[0-9]{1,3})?:[0-9]{1,9}(\.[0-9]{1,3})?:[^,]*$' THEN
        RAISE EXCEPTION 'invalid issued item';
      END IF;
      item_id := split_part(entry, ':', 1)::bigint;
      req := split_part(entry, ':', 2)::numeric;
      iss := split_part(entry, ':', 3)::numeric;
      IF item_id <= 0 OR req <= 0 OR iss < 0 OR iss > req OR item_id = ANY(seen_ids) THEN
        RAISE EXCEPTION 'issued quantity must be between zero and requested quantity';
      END IF;
      seen_ids := array_append(seen_ids, item_id);
    END LOOP;
  END IF;
  IF item_count = 0 THEN RAISE EXCEPTION 'order has no items'; END IF;
  IF EXISTS (SELECT 1 FROM public.orders existing WHERE existing.hotel=hc AND existing.kind=p_kind AND existing.code=p_code) THEN
    RETURN;
  END IF;
  INSERT INTO public.orders(kind, code, dept, no, device, hotel)
  VALUES (p_kind, p_code, p_dept, p_no, left(coalesce(p_device, ''), 40), hc);
END
$function$;

REVOKE ALL ON FUNCTION public.hotel_log(text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hotel_log(text, text, text, text, text, text) TO service_role;
