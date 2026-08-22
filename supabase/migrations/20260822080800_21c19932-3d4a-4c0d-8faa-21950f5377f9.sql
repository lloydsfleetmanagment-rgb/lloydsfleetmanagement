
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp text; v_role public.app_role; v_count int;
BEGIN
  v_emp := COALESCE(NULLIF(NEW.raw_user_meta_data->>'employee_id',''), 'EMP-' || upper(substr(replace(NEW.id::text,'-',''),1,6)));
  INSERT INTO public.profiles (id, employee_id, employee_name, email)
  VALUES (NEW.id, v_emp, COALESCE(NULLIF(NEW.raw_user_meta_data->>'employee_name',''), split_part(NEW.email,'@',1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  SELECT count(*) INTO v_count FROM public.user_roles;
  v_role := CASE WHEN v_count = 0 THEN 'admin'::public.app_role ELSE 'operator'::public.app_role END;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE POLICY "admin manage roles insert" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage roles update" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage roles delete" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
