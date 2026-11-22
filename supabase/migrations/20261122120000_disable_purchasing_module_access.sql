-- Purchasing and supplier workflows are no longer part of the warehouse application.
-- Keep existing records and schema intact, but disable all authenticated API access.
revoke all on table public.hotel_suppliers, public.hotel_purchase_orders, public.hotel_purchase_order_items
from public, anon, authenticated;

revoke all on function public.receive_hotel_purchase_order(uuid)
from public, anon, authenticated;
