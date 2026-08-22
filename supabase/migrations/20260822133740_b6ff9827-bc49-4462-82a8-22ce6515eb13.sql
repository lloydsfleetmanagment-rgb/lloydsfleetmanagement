CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_emp text; v_base text; v_role public.app_role; v_admins int; v_sups int; v_i int := 0;
BEGIN
  v_base := COALESCE(NULLIF(NEW.raw_user_meta_data->>'employee_id',''), 'EMP-' || upper(substr(replace(NEW.id::text,'-',''),1,6)));
  v_emp := v_base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE employee_id = v_emp) LOOP
    v_i := v_i + 1;
    v_emp := v_base || '-' || v_i::text;
  END LOOP;

  INSERT INTO public.profiles (id, employee_id, employee_name, email)
  VALUES (NEW.id, v_emp, COALESCE(NULLIF(NEW.raw_user_meta_data->>'employee_name',''), split_part(NEW.email,'@',1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  v_role := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'role','')::public.app_role,
    CASE
      WHEN (SELECT count(*) FROM public.user_roles WHERE role = 'admin') < 2 THEN 'admin'::public.app_role
      WHEN (SELECT count(*) FROM public.user_roles WHERE role = 'supervisor') < 3 THEN 'supervisor'::public.app_role
      ELSE 'operator'::public.app_role
    END
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role) ON CONFLICT DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END; $$;