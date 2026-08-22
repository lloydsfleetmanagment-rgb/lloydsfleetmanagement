
-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin','supervisor','operator');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id text UNIQUE,
  employee_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','supervisor'));
$$;

CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete profile" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "roles readable" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- new user -> profile + default operator role
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp text;
BEGIN
  v_emp := COALESCE(NULLIF(NEW.raw_user_meta_data->>'employee_id',''), 'EMP-' || upper(substr(replace(NEW.id::text,'-',''),1,6)));
  INSERT INTO public.profiles (id, employee_id, employee_name, email)
  VALUES (NEW.id, v_emp, COALESCE(NEW.raw_user_meta_data->>'employee_name', split_part(NEW.email,'@',1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'role','')::public.app_role, 'operator'))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- MASTER DATA
CREATE TABLE public.materials (
  code text PRIMARY KEY,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "materials read" ON public.materials FOR SELECT TO authenticated USING (true);

CREATE TABLE public.destinations (
  code text PRIMARY KEY,
  name text NOT NULL,
  material_code text NOT NULL REFERENCES public.materials(code) ON DELETE CASCADE,
  allowed_equipment_types text[] NOT NULL DEFAULT ARRAY['DUMPER','SANY'],
  is_crusher boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.destinations TO authenticated;
GRANT ALL ON public.destinations TO service_role;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "destinations read" ON public.destinations FOR SELECT TO authenticated USING (true);

INSERT INTO public.materials (code,name,sort_order) VALUES ('ROM','ROM',1),('BHQ','BHQ',2),('SHALE','Shale',3);
INSERT INTO public.destinations (code,name,material_code,allowed_equipment_types,is_crusher,sort_order) VALUES
 ('TH-1','TH-1','ROM',ARRAY['DUMPER','SANY'],true,1),
 ('TH-2','TH-2','ROM',ARRAY['SANY'],true,2),
 ('TH-3','TH-3','ROM',ARRAY['SANY'],true,3),
 ('TH-4','TH-4','ROM',ARRAY['DUMPER','SANY'],true,4),
 ('TH-5','TH-5','ROM',ARRAY['DUMPER','SANY'],true,5),
 ('BHQ Dump','BHQ Dump','BHQ',ARRAY['DUMPER','SANY'],false,6),
 ('Shale Dump Top','Shale Dump Top','SHALE',ARRAY['DUMPER','SANY'],false,7),
 ('Shale Dump Bottom','Shale Dump Bottom','SHALE',ARRAY['DUMPER','SANY'],false,8);

-- EQUIPMENT
CREATE TABLE public.equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  equipment_type text NOT NULL CHECK (equipment_type IN ('DUMPER','SANY')),
  status text NOT NULL DEFAULT 'IDLE',
  location text NOT NULL DEFAULT 'Yard',
  cycle_count int NOT NULL DEFAULT 0,
  capacity_t numeric NOT NULL DEFAULT 100,
  operator_employee_id text,
  operator_name text,
  assigned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment TO authenticated;
GRANT ALL ON public.equipment TO service_role;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_equipment_updated BEFORE UPDATE ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "equipment read" ON public.equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "equipment insert staff" ON public.equipment FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "equipment update" ON public.equipment FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()) OR assigned_user_id = auth.uid()) WITH CHECK (public.is_staff(auth.uid()) OR assigned_user_id = auth.uid());
CREATE POLICY "equipment delete admin" ON public.equipment FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

INSERT INTO public.equipment (code, equipment_type, capacity_t)
SELECT 'DMP-' || g::text, 'DUMPER', 100 FROM generate_series(101,114) g
UNION ALL
SELECT 'DMP-' || g::text, 'DUMPER', 100 FROM generate_series(301,330) g
UNION ALL
SELECT 'SANY-' || g::text, 'SANY', 70 FROM generate_series(1,58) g WHERE g NOT IN (8,13);

-- CRUSHERS
CREATE TABLE public.crushers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'RUNNING',
  capacity_tph numeric NOT NULL DEFAULT 500,
  sany_only boolean NOT NULL DEFAULT false,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crushers TO authenticated;
GRANT ALL ON public.crushers TO service_role;
ALTER TABLE public.crushers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_crushers_updated BEFORE UPDATE ON public.crushers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "crushers read" ON public.crushers FOR SELECT TO authenticated USING (true);
CREATE POLICY "crushers write staff" ON public.crushers FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "crushers update staff" ON public.crushers FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "crushers delete admin" ON public.crushers FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

INSERT INTO public.crushers (code,name,sany_only,capacity_tph) VALUES
 ('TH-1','Crusher TH-1',false,600),('TH-2','Crusher TH-2',true,600),('TH-3','Crusher TH-3',true,600),
 ('TH-4','Crusher TH-4',false,600),('TH-5','Crusher TH-5',false,600);

-- DIG FACES
CREATE TABLE public.dig_faces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  material_code text REFERENCES public.materials(code),
  bench text,
  status text NOT NULL DEFAULT 'ACTIVE',
  shovel text,
  remarks text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dig_faces TO authenticated;
GRANT ALL ON public.dig_faces TO service_role;
ALTER TABLE public.dig_faces ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_dig_faces_updated BEFORE UPDATE ON public.dig_faces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "dig_faces read" ON public.dig_faces FOR SELECT TO authenticated USING (true);
CREATE POLICY "dig_faces insert staff" ON public.dig_faces FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "dig_faces update staff" ON public.dig_faces FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "dig_faces delete admin" ON public.dig_faces FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

INSERT INTO public.dig_faces (name, material_code, bench, shovel) VALUES
 ('DF-North-01','ROM','B-880','EX-1200 #1'),
 ('DF-Central-02','ROM','B-865','EX-1900 #2'),
 ('DF-East-03','BHQ','B-850','EX-1200 #3'),
 ('DF-West-04','SHALE','B-895','EX-800 #4');

-- OPERATOR LOGS (single source of truth for trips)
CREATE TABLE public.operator_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  logged_at timestamptz NOT NULL DEFAULT now(),
  shift text NOT NULL DEFAULT 'DAY',
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id text,
  employee_name text,
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE RESTRICT,
  equipment_code text NOT NULL,
  equipment_type text NOT NULL,
  material_code text NOT NULL REFERENCES public.materials(code),
  destination_code text NOT NULL REFERENCES public.destinations(code),
  dig_face text,
  trips int NOT NULL CHECK (trips > 0),
  quantity_t numeric NOT NULL DEFAULT 0,
  loading_time_min numeric NOT NULL DEFAULT 0,
  unloading_time_min numeric NOT NULL DEFAULT 0,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operator_logs TO authenticated;
GRANT ALL ON public.operator_logs TO service_role;
ALTER TABLE public.operator_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operator_logs read" ON public.operator_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "operator_logs insert" ON public.operator_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "operator_logs update" ON public.operator_logs FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid())) WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "operator_logs delete admin" ON public.operator_logs FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- AUDIT
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  employee_id text,
  employee_name text,
  action text NOT NULL,
  entity text,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit read staff" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "audit insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- VALIDATION + AUTO QUANTITY + FLEET SYNC
CREATE OR REPLACE FUNCTION public.validate_operator_log() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dest public.destinations%ROWTYPE; v_eq public.equipment%ROWTYPE; v_prof public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_eq FROM public.equipment WHERE id = NEW.equipment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown equipment'; END IF;
  NEW.equipment_code := v_eq.code;
  NEW.equipment_type := v_eq.equipment_type;

  SELECT * INTO v_dest FROM public.destinations WHERE code = NEW.destination_code;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown destination'; END IF;
  IF v_dest.material_code <> NEW.material_code THEN
    RAISE EXCEPTION 'INVALID DESTINATION: % is not a valid destination for material %', NEW.destination_code, NEW.material_code;
  END IF;
  IF NOT (v_eq.equipment_type = ANY (v_dest.allowed_equipment_types)) THEN
    INSERT INTO public.audit_logs (user_id, employee_id, action, entity, details)
    VALUES (auth.uid(), NEW.employee_id, 'INVALID_EQUIPMENT_ATTEMPT', 'operator_logs',
      jsonb_build_object('destination', NEW.destination_code, 'equipment', v_eq.code, 'equipment_type', v_eq.equipment_type));
    RAISE EXCEPTION 'INVALID EQUIPMENT: % allows SANY equipment only.', NEW.destination_code;
  END IF;

  IF NEW.employee_id IS NULL OR NEW.employee_name IS NULL THEN
    SELECT * INTO v_prof FROM public.profiles WHERE id = NEW.user_id;
    IF FOUND THEN
      NEW.employee_id := COALESCE(NEW.employee_id, v_prof.employee_id);
      NEW.employee_name := COALESCE(NEW.employee_name, v_prof.employee_name);
    END IF;
  END IF;

  NEW.quantity_t := NEW.trips * (CASE WHEN v_eq.equipment_type = 'DUMPER' THEN 100 ELSE 70 END);
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_operator_log BEFORE INSERT OR UPDATE ON public.operator_logs
FOR EACH ROW EXECUTE FUNCTION public.validate_operator_log();

CREATE OR REPLACE FUNCTION public.sync_equipment_from_log() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.equipment SET
    cycle_count = cycle_count + NEW.trips,
    location = NEW.destination_code,
    status = 'ACTIVE',
    operator_employee_id = COALESCE(NEW.employee_id, operator_employee_id),
    operator_name = COALESCE(NEW.employee_name, operator_name),
    updated_at = now()
  WHERE id = NEW.equipment_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_sync_equipment AFTER INSERT ON public.operator_logs
FOR EACH ROW EXECUTE FUNCTION public.sync_equipment_from_log();

-- PRODUCTION ENTRIES (manual/supervisor entries)
CREATE TABLE public.production_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  shift text NOT NULL DEFAULT 'DAY',
  material_code text NOT NULL REFERENCES public.materials(code),
  destination_code text REFERENCES public.destinations(code),
  dig_face text,
  quantity_t numeric NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'MANUAL',
  remarks text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_entries TO authenticated;
GRANT ALL ON public.production_entries TO service_role;
ALTER TABLE public.production_entries ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_pe_updated BEFORE UPDATE ON public.production_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "production read" ON public.production_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "production insert staff" ON public.production_entries FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "production update staff" ON public.production_entries FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "production delete admin" ON public.production_entries FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- EMERGENCY ALERTS
CREATE TABLE public.emergency_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  employee_id text,
  employee_name text,
  login_id text,
  shift text,
  equipment_code text,
  material_code text,
  destination_code text,
  message text,
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','ACKNOWLEDGED','RESOLVED')),
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  resolved_by uuid,
  resolved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.emergency_alerts TO authenticated;
GRANT ALL ON public.emergency_alerts TO service_role;
ALTER TABLE public.emergency_alerts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_alerts_updated BEFORE UPDATE ON public.emergency_alerts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "alerts read" ON public.emergency_alerts FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "alerts insert" ON public.emergency_alerts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "alerts update staff" ON public.emergency_alerts FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

ALTER TABLE public.emergency_alerts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_alerts;
