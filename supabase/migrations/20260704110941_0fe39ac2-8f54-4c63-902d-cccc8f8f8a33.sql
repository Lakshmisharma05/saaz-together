
-- Enforce host_id immutability for non-host updates via trigger (WITH CHECK can't reference OLD)
CREATE OR REPLACE FUNCTION private.prevent_room_host_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.host_id IS DISTINCT FROM OLD.host_id AND OLD.host_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the host can change host_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rooms_prevent_host_change ON public.rooms;
CREATE TRIGGER rooms_prevent_host_change
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_room_host_change();

-- Replace the broken self-referential WITH CHECK with a straightforward policy;
-- the trigger above enforces that participants cannot alter host_id.
DROP POLICY IF EXISTS "participants update playback" ON public.rooms;
CREATE POLICY "participants update playback" ON public.rooms
  FOR UPDATE
  TO authenticated
  USING (private.is_room_participant(id, auth.uid()))
  WITH CHECK (private.is_room_participant(id, auth.uid()));
