
CREATE OR REPLACE FUNCTION private.set_receipt_department_label()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE order_code text;
BEGIN
  SELECT code INTO order_code FROM public.orders WHERE id = NEW.order_id;
  IF order_code IS NOT NULL THEN
    NEW.department := coalesce(nullif(split_part(order_code, '|', 8), ''), NEW.department);
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION private.set_receipt_department_label() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS receipt_department_label_before_insert ON public.receipt_confirmations;
CREATE TRIGGER receipt_department_label_before_insert
BEFORE INSERT ON public.receipt_confirmations
FOR EACH ROW EXECUTE FUNCTION private.set_receipt_department_label();
