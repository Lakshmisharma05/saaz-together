
-- 1) Create private schema for internal helpers (not exposed via PostgREST)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

-- 2) Move is_room_participant into private schema
CREATE OR REPLACE FUNCTION private.is_room_participant(_room_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.room_participants WHERE room_id = _room_id AND user_id = _user_id);
$$;
REVOKE ALL ON FUNCTION private.is_room_participant(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 3) Rewrite policies that referenced public.is_room_participant

-- room_participants SELECT
DROP POLICY IF EXISTS "participants visible to room members" ON public.room_participants;
CREATE POLICY "participants visible to room members" ON public.room_participants
  FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.is_room_participant(room_id, auth.uid()));

-- room_participants INSERT — remove direct client INSERT entirely.
-- Joining goes through the server (joinRoomByCode) which uses the service role
-- after validating the invite code.
DROP POLICY IF EXISTS "user joins as self" ON public.room_participants;

-- chat_messages
DROP POLICY IF EXISTS "chat visible to participants" ON public.chat_messages;
CREATE POLICY "chat visible to participants" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (private.is_room_participant(room_id, auth.uid()));

DROP POLICY IF EXISTS "participants send chat" ON public.chat_messages;
CREATE POLICY "participants send chat" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()) AND private.is_room_participant(room_id, auth.uid()));

-- room_queue
DROP POLICY IF EXISTS "Participants read queue" ON public.room_queue;
CREATE POLICY "Participants read queue" ON public.room_queue
  FOR SELECT TO authenticated
  USING (private.is_room_participant(room_id, auth.uid()));

DROP POLICY IF EXISTS "Participants insert queue" ON public.room_queue;
CREATE POLICY "Participants insert queue" ON public.room_queue
  FOR INSERT TO authenticated
  WITH CHECK (private.is_room_participant(room_id, auth.uid()) AND (added_by = auth.uid()));

-- rooms visibility + update
DROP POLICY IF EXISTS "rooms visible to host or participants" ON public.rooms;
CREATE POLICY "rooms visible to host or participants" ON public.rooms
  FOR SELECT TO authenticated
  USING ((host_id = auth.uid()) OR private.is_room_participant(id, auth.uid()));

-- Drop overly permissive lookup policy
DROP POLICY IF EXISTS "any authed can lookup room by invite" ON public.rooms;

-- Host-only update; participants no longer directly update rooms (playback goes via server fns
-- using the user's client and the SELECT-visible row filter — but writes must be host).
DROP POLICY IF EXISTS "host updates room" ON public.rooms;
CREATE POLICY "host updates room" ON public.rooms
  FOR UPDATE TO authenticated
  USING (host_id = auth.uid())
  WITH CHECK (host_id = auth.uid());

-- Allow participants to update playback fields (but not host_id) via a separate policy
CREATE POLICY "participants update playback" ON public.rooms
  FOR UPDATE TO authenticated
  USING (private.is_room_participant(id, auth.uid()))
  WITH CHECK (
    private.is_room_participant(id, auth.uid())
    AND host_id = (SELECT r.host_id FROM public.rooms r WHERE r.id = rooms.id)
  );

-- 4) Now safe to drop the public is_room_participant
DROP FUNCTION IF EXISTS public.is_room_participant(uuid, uuid);

-- 5) Move gen_invite_code into private schema (only server/admin needs it)
CREATE OR REPLACE FUNCTION private.gen_invite_code()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN code;
END;
$$;
REVOKE ALL ON FUNCTION private.gen_invite_code() FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.gen_invite_code();

-- 6) Restrict profiles SELECT to self, room-mates, and friends
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;
CREATE POLICY "profiles visible to self, room-mates, and friends" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.friends f
      WHERE f.owner_id = auth.uid() AND f.friend_id = profiles.id
    )
    OR EXISTS (
      SELECT 1
      FROM public.room_participants rp_self
      JOIN public.room_participants rp_other ON rp_self.room_id = rp_other.room_id
      WHERE rp_self.user_id = auth.uid() AND rp_other.user_id = profiles.id
    )
  );
