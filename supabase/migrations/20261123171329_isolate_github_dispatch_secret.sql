-- The GitHub Actions dispatch token is used only by the sbfenv Edge Function.
-- Do not return it to authenticated browser clients or allow direct browser writes.
DROP POLICY IF EXISTS sec_admin ON public.app_secrets;

CREATE POLICY app_secrets_owner_select
ON public.app_secrets FOR SELECT TO authenticated
USING ((SELECT auth.jwt() ->> 'email') = 'mhmdbwft09@gmail.com' AND key <> 'gh_dispatch');

CREATE POLICY app_secrets_owner_insert
ON public.app_secrets FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.jwt() ->> 'email') = 'mhmdbwft09@gmail.com' AND key <> 'gh_dispatch');

CREATE POLICY app_secrets_owner_update
ON public.app_secrets FOR UPDATE TO authenticated
USING ((SELECT auth.jwt() ->> 'email') = 'mhmdbwft09@gmail.com' AND key <> 'gh_dispatch')
WITH CHECK ((SELECT auth.jwt() ->> 'email') = 'mhmdbwft09@gmail.com' AND key <> 'gh_dispatch');

CREATE POLICY app_secrets_owner_delete
ON public.app_secrets FOR DELETE TO authenticated
USING ((SELECT auth.jwt() ->> 'email') = 'mhmdbwft09@gmail.com' AND key <> 'gh_dispatch');
