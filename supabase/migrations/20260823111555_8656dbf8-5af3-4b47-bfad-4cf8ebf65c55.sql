DROP POLICY IF EXISTS "equipment update" ON public.equipment;
CREATE POLICY "equipment update" ON public.equipment
FOR UPDATE TO authenticated
USING (is_staff(auth.uid()) OR assigned_user_id = auth.uid() OR assigned_user_id IS NULL)
WITH CHECK (is_staff(auth.uid()) OR assigned_user_id = auth.uid() OR assigned_user_id IS NULL);