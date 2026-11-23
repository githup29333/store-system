-- Security audit hardening for the hotel worker portal.
-- Anonymous clients use only the narrow hotel-key RPCs; they must not access tables directly.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, PUBLIC;

-- This bucket stores generated Excel exports only.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    file_size_limit = 26214400
WHERE id = 'exports';

CREATE OR REPLACE FUNCTION public.hotel_info(k text)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
  SELECT json_build_object('code', h.code, 'name', h.name, 'expires_at', h.expires_at)
  FROM public.hotels h
  WHERE h.key = k AND h.active
    AND h.expires_at >= (now() AT TIME ZONE 'Africa/Tripoli')::date
$function$;

CREATE OR REPLACE FUNCTION public.hotel_items(k text)
RETURNS TABLE(id integer, ar text, en text, code text, sku text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
  SELECT i.id, i.ar, i.en, i.code, i.sku
  FROM public.items i JOIN public.hotels h ON h.key = k
  WHERE h.active
    AND h.expires_at >= (now() AT TIME ZONE 'Africa/Tripoli')::date
    AND (i.hotels = '{}' OR h.code = ANY(i.hotels))
  ORDER BY i.id
$function$;

CREATE OR REPLACE FUNCTION public.hotel_add_item(k text, p_ar text, p_en text)
RETURNS TABLE(id integer, ar text, en text, code text, sku text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE hc text; r public.items%rowtype;
BEGIN
  SELECT h.code INTO hc FROM public.hotels h
  WHERE h.key = k AND h.active
    AND h.expires_at >= (now() AT TIME ZONE 'Africa/Tripoli')::date;
  IF hc IS NULL THEN RAISE EXCEPTION 'invalid key'; END IF;
  p_ar := left(btrim(coalesce(p_ar, '')), 120);
  p_en := left(btrim(coalesce(p_en, '')), 120);
  IF p_ar = '' THEN RAISE EXCEPTION 'empty name'; END IF;
  SELECT * INTO r FROM public.items i
  WHERE (i.hotels = '{}' OR hc = ANY(i.hotels))
    AND (lower(i.ar) = lower(p_ar) OR lower(i.en) = lower(p_ar)) LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.items(ar, en, hotels) VALUES (p_ar, p_en, ARRAY[hc]) RETURNING * INTO r;
  END IF;
  RETURN QUERY SELECT r.id, r.ar, r.en, r.code, r.sku;
END
$function$;

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
  INSERT INTO public.orders(kind, code, dept, no, device, hotel)
  VALUES (p_kind, p_code, p_dept, p_no, left(coalesce(p_device, ''), 40), hc);
END
$function$;

REVOKE ALL ON FUNCTION public.hotel_add_item(text, text, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.hotel_add_item(text, text, text) TO anon;
REVOKE ALL ON FUNCTION public.hotel_info(text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.hotel_info(text) TO anon;
REVOKE ALL ON FUNCTION public.hotel_items(text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.hotel_items(text) TO anon;
REVOKE ALL ON FUNCTION public.hotel_log(text, text, text, text, text, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.hotel_log(text, text, text, text, text, text) TO anon;
