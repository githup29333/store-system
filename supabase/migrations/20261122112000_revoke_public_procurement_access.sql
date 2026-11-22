revoke all on table public.hotel_suppliers, public.hotel_purchase_orders, public.hotel_purchase_order_items from public, anon;
grant select, insert, update, delete on table public.hotel_suppliers, public.hotel_purchase_orders, public.hotel_purchase_order_items to authenticated;

revoke all on table public.admin_audit_log from public, anon, authenticated;
grant select on table public.admin_audit_log to authenticated;
revoke all on sequence public.admin_audit_log_id_seq from public, anon, authenticated;
