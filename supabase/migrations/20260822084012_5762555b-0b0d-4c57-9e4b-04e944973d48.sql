REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_equipment_from_log() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_operator_log() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;