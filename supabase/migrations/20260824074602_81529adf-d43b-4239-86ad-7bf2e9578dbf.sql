CREATE OR REPLACE FUNCTION public.validate_operator_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_dest public.destinations%ROWTYPE; v_eq public.equipment%ROWTYPE; v_prof public.profiles%ROWTYPE; v_rate numeric;
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

  IF upper(NEW.material_code) = 'SHALE' THEN
    v_rate := CASE WHEN v_eq.equipment_type = 'DUMPER' THEN 90 ELSE 65 END;
  ELSE
    v_rate := CASE WHEN v_eq.equipment_type = 'DUMPER' THEN 100 ELSE 70 END;
  END IF;

  NEW.quantity_t := NEW.trips * v_rate;
  NEW.updated_at := now();
  RETURN NEW;
END; $function$;