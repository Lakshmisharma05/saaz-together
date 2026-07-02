
-- 1) Add mode column to rooms
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'listen';

-- Validate mode values via trigger (avoids problems with future changes)
CREATE OR REPLACE FUNCTION public.validate_room_mode()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.mode NOT IN ('listen','jam') THEN
    RAISE EXCEPTION 'invalid room mode: %', NEW.mode;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_room_mode_trigger ON public.rooms;
CREATE TRIGGER validate_room_mode_trigger
  BEFORE INSERT OR UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.validate_room_mode();

-- 2) Collaborative queue for jam sessions
CREATE TABLE IF NOT EXISTS public.room_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  video_id text NOT NULL,
  title text NOT NULL,
  channel text,
  thumbnail text,
  position integer NOT NULL DEFAULT 0,
  added_by uuid NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS room_queue_room_position_idx
  ON public.room_queue (room_id, position, added_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_queue TO authenticated;
GRANT ALL ON public.room_queue TO service_role;

ALTER TABLE public.room_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read queue"
  ON public.room_queue FOR SELECT
  TO authenticated
  USING (public.is_room_participant(room_id, auth.uid()));

CREATE POLICY "Participants insert queue"
  ON public.room_queue FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_room_participant(room_id, auth.uid())
    AND added_by = auth.uid()
  );

CREATE POLICY "Adder or host updates queue"
  ON public.room_queue FOR UPDATE
  TO authenticated
  USING (
    added_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_id AND r.host_id = auth.uid())
  );

CREATE POLICY "Adder or host deletes queue"
  ON public.room_queue FOR DELETE
  TO authenticated
  USING (
    added_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_id AND r.host_id = auth.uid())
  );

-- Enable realtime for the queue
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_queue;
