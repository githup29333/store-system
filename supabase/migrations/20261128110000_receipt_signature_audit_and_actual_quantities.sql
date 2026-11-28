CREATE TABLE IF NOT EXISTS public.receipt_confirmations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id bigint NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  hotel_code text NOT NULL,
  order_no text NOT NULL,
  department text NOT NULL,
  recipient_name text NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  items jsonb NOT NULL,
  signature_png text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS receipt_confirmations_hotel_time_idx
  ON public.receipt_confirmations (hotel_code, confirmed_at DESC);
CREATE INDEX IF NOT EXISTS receipt_confirmations_hotel_order_idx
  ON public.receipt_confirmations (hotel_code, order_no);

ALTER TABLE public.receipt_confirmations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.receipt_confirmations FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.receipt_confirmations TO authenticated;
GRANT ALL ON TABLE public.receipt_confirmations TO service_role;
DROP POLICY IF EXISTS receipt_confirmations_app_read ON public.receipt_confirmations;
CREATE POLICY receipt_confirmations_app_read
  ON public.receipt_confirmations
  FOR SELECT TO authenticated
  USING (
    private.can_access_hotel(hotel_code)
    AND private.has_app_permission('orders', 'read')
  );

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
    'received_at', o.received_at, 'created_at', o.created_at,
    'receipt', CASE WHEN rc.id IS NULL THEN NULL ELSE jsonb_build_object(
      'items', rc.items, 'signature_png', rc.signature_png,
      'recipient_name', rc.recipient_name, 'confirmed_at', rc.confirmed_at
    ) END
  ) INTO result
  FROM public.orders o
  JOIN public.hotels h ON h.code = o.hotel
  LEFT JOIN public.receipt_confirmations rc ON rc.order_id = o.id
  WHERE o.kind = 'final' AND o.receipt_token_hash = p_token_hash
  LIMIT 1;
  IF result IS NULL THEN RAISE EXCEPTION 'receipt link not found'; END IF;
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION public.hotel_receipt_confirm(
  p_token_hash text,
  p_name text,
  p_items jsonb,
  p_signature text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE
  o record;
  line text;
  line_parts text[];
  custom_line text;
  custom_parts text[];
  names_list text[];
  item_id bigint;
  requested_qty numeric;
  issued_qty numeric;
  received_qty numeric;
  received_text text;
  reviewed_text text;
  unit_name text;
  ar_name text;
  en_name text;
  item_count integer := 0;
  matches integer;
  snapshot jsonb := '[]'::jsonb;
  saved record;
  clean_name text;
BEGIN
  clean_name := btrim(coalesce(p_name, ''));
  IF p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$'
     OR length(clean_name) < 2 OR length(clean_name) > 80
     OR clean_name ~ '[[:cntrl:]]'
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 500
     OR p_signature IS NULL
     OR length(p_signature) > 60000
     OR p_signature !~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$'
  THEN RAISE EXCEPTION 'invalid receipt confirmation'; END IF;

  SELECT id, code, no, dept, hotel, received_by, received_at
    INTO o
  FROM public.orders
  WHERE kind = 'final' AND receipt_token_hash = p_token_hash
  LIMIT 1
  FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'receipt link not found'; END IF;

  IF o.received_at IS NOT NULL THEN
    SELECT * INTO saved FROM public.receipt_confirmations WHERE order_id = o.id;
    RETURN jsonb_build_object(
      'ok', false, 'already_received', true,
      'received_by', coalesce(saved.recipient_name, o.received_by),
      'received_at', coalesce(saved.confirmed_at, o.received_at),
      'items', saved.items, 'signature_png', saved.signature_png,
      'no', o.no
    );
  END IF;

  names_list := string_to_array(split_part(o.code, '|', 10), ';');
  FOREACH line IN ARRAY string_to_array(split_part(o.code, '|', 7), ',') LOOP
    line_parts := string_to_array(line, ':');
    IF array_length(line_parts, 1) < 4 OR line_parts[1] !~ '^[0-9]{1,10}$'
       OR line_parts[2] !~ '^[0-9]{1,9}(\.[0-9]{1,3})?$'
       OR line_parts[3] !~ '^[0-9]{1,9}(\.[0-9]{1,3})?$'
    THEN RAISE EXCEPTION 'invalid order item snapshot'; END IF;
    item_id := line_parts[1]::bigint;
    requested_qty := line_parts[2]::numeric;
    issued_qty := line_parts[3]::numeric;
    unit_name := line_parts[4];

    SELECT count(*) INTO matches
    FROM jsonb_array_elements(p_items) x
    WHERE x->>'id' = item_id::text;
    IF matches <> 1 THEN RAISE EXCEPTION 'receipt item mismatch'; END IF;

    SELECT x->>'received', x->>'reviewed'
      INTO received_text, reviewed_text
    FROM jsonb_array_elements(p_items) x
    WHERE x->>'id' = item_id::text
    LIMIT 1;
    IF reviewed_text <> 'true'
       OR received_text IS NULL
       OR received_text !~ '^[0-9]{1,9}(\.[0-9]{1,3})?$'
    THEN RAISE EXCEPTION 'receipt item not reviewed'; END IF;
    received_qty := received_text::numeric;

    SELECT ar, en INTO ar_name, en_name
    FROM public.items WHERE id = item_id;
    FOREACH custom_line IN ARRAY names_list LOOP
      custom_parts := string_to_array(custom_line, '~');
      IF array_length(custom_parts, 1) >= 2 AND custom_parts[1] = item_id::text THEN
        ar_name := coalesce(nullif(custom_parts[2], ''), ar_name);
        unit_name := coalesce(nullif(custom_parts[3], ''), unit_name);
        EXIT;
      END IF;
    END LOOP;

    snapshot := snapshot || jsonb_build_array(jsonb_build_object(
      'id', item_id,
      'name_ar', coalesce(ar_name, 'صنف ' || item_id::text),
      'name_en', coalesce(en_name, ''),
      'requested', requested_qty,
      'issued', issued_qty,
      'received', received_qty,
      'unit', coalesce(unit_name, '')
    ));
    item_count := item_count + 1;
  END LOOP;

  IF item_count <> jsonb_array_length(p_items) THEN
    RAISE EXCEPTION 'receipt contains unknown items';
  END IF;

  INSERT INTO public.receipt_confirmations (
    order_id, hotel_code, order_no, department, recipient_name,
    confirmed_at, items, signature_png
  ) VALUES (
    o.id, o.hotel, o.no, o.dept, clean_name,
    now(), snapshot, p_signature
  ) RETURNING * INTO saved;

  UPDATE public.orders
  SET received_by = clean_name, received_at = saved.confirmed_at
  WHERE id = o.id;

  RETURN jsonb_build_object(
    'ok', true, 'already_received', false,
    'received_by', saved.recipient_name,
    'received_at', saved.confirmed_at,
    'items', saved.items,
    'signature_png', saved.signature_png,
    'no', o.no
  );
END
$function$;

REVOKE ALL ON FUNCTION public.hotel_receipt_get(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hotel_receipt_confirm(text, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hotel_receipt_get(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hotel_receipt_confirm(text, text, jsonb, text) TO service_role;
