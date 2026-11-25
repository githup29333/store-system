-- Add a dedicated permission for editing stock thresholds only.
drop policy if exists hotel_inventory_app_update on public.hotel_inventory;
create policy hotel_inventory_app_update
on public.hotel_inventory
for update
to authenticated
using (
  private.has_app_permission('inventory','update')
  or private.has_app_permission('inventory','thresholds')
)
with check (
  private.has_app_permission('inventory','update')
  or private.has_app_permission('inventory','thresholds')
);

create or replace function private.enforce_inventory_threshold_permission()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if private.has_app_permission('inventory','thresholds')
     and not private.has_app_permission('inventory','update') then
    if new.id is distinct from old.id
       or new.hotel_code is distinct from old.hotel_code
       or new.item_id is distinct from old.item_id
       or new.quantity is distinct from old.quantity
       or new.unit is distinct from old.unit then
      raise exception 'صلاحية تعديل الحدود تسمح بتغيير الحد الأدنى والأعلى فقط'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists hotel_inventory_threshold_permission_guard on public.hotel_inventory;
create trigger hotel_inventory_threshold_permission_guard
before update on public.hotel_inventory
for each row execute function private.enforce_inventory_threshold_permission();
