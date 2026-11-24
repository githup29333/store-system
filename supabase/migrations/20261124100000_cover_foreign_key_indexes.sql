-- Cover foreign-key lookups and owner activity history without changing row access.
create index if not exists app_user_activity_app_user_id_idx on public.app_user_activity (app_user_id);
create index if not exists app_user_activity_actor_auth_user_id_idx on public.app_user_activity (actor_auth_user_id);
create index if not exists app_users_created_by_idx on public.app_users (created_by);
create index if not exists company_users_user_id_idx on public.company_users (user_id);
create index if not exists hotel_inventory_item_id_idx on public.hotel_inventory (item_id);
create index if not exists hotel_purchase_order_items_item_id_idx on public.hotel_purchase_order_items (item_id);
create index if not exists hotel_purchase_orders_created_by_idx on public.hotel_purchase_orders (created_by);
create index if not exists hotel_purchase_orders_supplier_id_idx on public.hotel_purchase_orders (supplier_id);
create index if not exists hotel_stock_movements_created_by_idx on public.hotel_stock_movements (created_by);
create index if not exists hotel_stock_movements_item_id_idx on public.hotel_stock_movements (item_id);
create index if not exists item_price_link_price_id_idx on public.item_price_link (price_id);
create index if not exists products_company_id_idx on public.products (company_id);
create index if not exists purchase_request_items_product_id_idx on public.purchase_request_items (product_id);
create index if not exists purchase_request_items_purchase_request_id_idx on public.purchase_request_items (purchase_request_id);
create index if not exists purchase_requests_company_id_idx on public.purchase_requests (company_id);
create index if not exists purchase_requests_requested_by_idx on public.purchase_requests (requested_by);
create index if not exists purchase_requests_warehouse_id_idx on public.purchase_requests (warehouse_id);
create index if not exists stock_movements_company_id_idx on public.stock_movements (company_id);
create index if not exists stock_movements_created_by_idx on public.stock_movements (created_by);
create index if not exists stock_movements_product_id_idx on public.stock_movements (product_id);
create index if not exists stock_movements_warehouse_id_idx on public.stock_movements (warehouse_id);
create index if not exists suppliers_company_id_idx on public.suppliers (company_id);
create index if not exists warehouses_company_id_idx on public.warehouses (company_id);

-- Speed up the existing owner-only audit feed.
create index if not exists admin_audit_log_actor_created_idx on public.admin_audit_log (actor_id, created_at desc);
