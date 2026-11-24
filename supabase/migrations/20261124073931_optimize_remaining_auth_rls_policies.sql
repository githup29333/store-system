-- Keep auth identity lookups stable per statement in the remaining owner/profile policies.
DROP POLICY IF EXISTS "manage own profile" ON public.profiles;
CREATE POLICY "manage own profile" ON public.profiles
  FOR ALL
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "insert own company" ON public.companies;
CREATE POLICY "insert own company" ON public.companies
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
