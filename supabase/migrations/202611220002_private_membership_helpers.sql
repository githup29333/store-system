-- Keep membership authorization helpers out of the exposed public API schema.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1 from public.company_users cu
    where cu.company_id = target_company_id
      and cu.user_id = (select auth.uid())
  );
$function$;

create or replace function private.is_company_admin(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1 from public.company_users cu
    where cu.company_id = target_company_id
      and cu.user_id = (select auth.uid())
      and cu.role in ('owner', 'admin')
  );
$function$;

revoke all on function private.is_company_member(uuid) from public, anon, authenticated;
grant execute on function private.is_company_member(uuid) to authenticated;
revoke all on function private.is_company_admin(uuid) from public, anon, authenticated;
grant execute on function private.is_company_admin(uuid) to authenticated;

alter policy "update own company" on public.companies
  using (private.is_company_member(id));
alter policy "view own company" on public.companies
  using (private.is_company_member(id));
alter policy "insert own membership" on public.company_users
  with check (
    user_id = (select auth.uid())
    and role = 'staff'
    and private.is_company_admin(company_id)
  );
alter policy "view company members" on public.company_users
  using (private.is_company_member(company_id));
alter policy "company access" on public.products
  using (private.is_company_member(company_id))
  with check (private.is_company_member(company_id));
alter policy "company access" on public.purchase_request_items
  using (exists (
    select 1 from public.purchase_requests pr
    where pr.id = purchase_request_items.purchase_request_id
      and private.is_company_member(pr.company_id)
  ))
  with check (exists (
    select 1 from public.purchase_requests pr
    where pr.id = purchase_request_items.purchase_request_id
      and private.is_company_member(pr.company_id)
  ));
alter policy "company access" on public.purchase_requests
  using (private.is_company_member(company_id))
  with check (private.is_company_member(company_id));
alter policy "company access" on public.stock_movements
  using (private.is_company_member(company_id))
  with check (private.is_company_member(company_id));
alter policy "company access" on public.suppliers
  using (private.is_company_member(company_id))
  with check (private.is_company_member(company_id));
alter policy "company access" on public.warehouses
  using (private.is_company_member(company_id))
  with check (private.is_company_member(company_id));

drop function public.is_company_member(uuid);
drop function public.is_company_admin(uuid);
