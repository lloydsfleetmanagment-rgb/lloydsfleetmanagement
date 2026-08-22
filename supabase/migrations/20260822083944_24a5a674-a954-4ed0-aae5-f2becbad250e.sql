ALTER TABLE public.operator_logs ALTER COLUMN shift SET DEFAULT 'A';
ALTER TABLE public.production_entries ALTER COLUMN shift SET DEFAULT 'A';

UPDATE public.operator_logs SET shift = CASE WHEN shift = 'DAY' THEN 'A' WHEN shift = 'NIGHT' THEN 'B' ELSE shift END WHERE shift IN ('DAY','NIGHT');
UPDATE public.production_entries SET shift = CASE WHEN shift = 'DAY' THEN 'A' WHEN shift = 'NIGHT' THEN 'B' ELSE shift END WHERE shift IN ('DAY','NIGHT');
UPDATE public.emergency_alerts SET shift = CASE WHEN shift = 'DAY' THEN 'A' WHEN shift = 'NIGHT' THEN 'B' ELSE shift END WHERE shift IN ('DAY','NIGHT');

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_emp text; v_role public.app_role; v_admins int; v_sups int;
BEGIN
  v_emp := COALESCE(NULLIF(NEW.raw_user_meta_data->>'employee_id',''), 'EMP-' || upper(substr(replace(NEW.id::text,'-',''),1,6)));
  INSERT INTO public.profiles (id, employee_id, employee_name, email)
  VALUES (NEW.id, v_emp, COALESCE(NULLIF(NEW.raw_user_meta_data->>'employee_name',''), split_part(NEW.email,'@',1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  SELECT count(*) INTO v_admins FROM public.user_roles WHERE role = 'admin';
  SELECT count(*) INTO v_sups FROM public.user_roles WHERE role = 'supervisor';

  v_role := CASE
    WHEN v_admins < 2 THEN 'admin'::public.app_role
    WHEN v_sups < 3 THEN 'supervisor'::public.app_role
    ELSE 'operator'::public.app_role
  END;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $function$;