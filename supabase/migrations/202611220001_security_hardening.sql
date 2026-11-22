-- Harden company membership authorization and internal SECURITY DEFINER functions.
-- Hotel-key RPCs remain callable by anon because the public worker/department links rely on them.

create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.company_users cu
    where cu.company_id = target_company_id
      and cu.user_id = (select auth.uid())
  );
$function$;

create or replace function public.is_company_admin(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.company_users cu
    where cu.company_id = target_company_id
      and cu.user_id = (select auth.uid())
      and cu.role in ('owner', 'admin')
  );
$function$;

-- Membership is never self-assigned. Existing owners/admins can invite staff;
-- the first owner must be provisioned by a trusted administrator/backend.
alter policy "insert own membership" on public.company_users
  to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'staff'
    and public.is_company_admin(company_id)
  );

-- These policies belong to the signed-in company workspace, not anonymous hotel links.
alter policy "insert own company" on public.companies to authenticated;
alter policy "update own company" on public.companies to authenticated;
alter policy "view own company" on public.companies to authenticated;
alter policy "view company members" on public.company_users to authenticated;
alter policy "company access" on public.products to authenticated;
alter policy "company access" on public.purchase_request_items to authenticated;
alter policy "company access" on public.purchase_requests to authenticated;
alter policy "manage own profile" on public.profiles to authenticated;
alter policy "company access" on public.stock_movements to authenticated;
alter policy "company access" on public.suppliers to authenticated;
alter policy "company access" on public.warehouses to authenticated;

-- SECURITY DEFINER helpers are callable only by signed-in users.
revoke all on function public.is_company_member(uuid) from public, anon, authenticated;
grant execute on function public.is_company_member(uuid) to authenticated;
revoke all on function public.is_company_admin(uuid) from public, anon, authenticated;
grant execute on function public.is_company_admin(uuid) to authenticated;

-- Trigger/event-trigger functions are not API endpoints.
revoke all on function public.on_final_order() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
