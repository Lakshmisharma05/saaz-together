
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Listener',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'Listener'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Rooms
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'Listening Session',
  is_active BOOLEAN NOT NULL DEFAULT true,
  current_video_id TEXT,
  current_video_title TEXT,
  current_video_channel TEXT,
  current_video_thumbnail TEXT,
  position_seconds NUMERIC NOT NULL DEFAULT 0,
  is_playing BOOLEAN NOT NULL DEFAULT false,
  last_state_change TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Room participants
CREATE TABLE public.room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_participants TO authenticated;
GRANT ALL ON public.room_participants TO service_role;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;

-- Helper: is caller a participant of a room
CREATE OR REPLACE FUNCTION public.is_room_participant(_room_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.room_participants WHERE room_id = _room_id AND user_id = _user_id);
$$;

CREATE POLICY "rooms visible to host or participants" ON public.rooms FOR SELECT TO authenticated
  USING (host_id = auth.uid() OR public.is_room_participant(id, auth.uid()));
CREATE POLICY "any authed can lookup room by invite" ON public.rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "user creates own room" ON public.rooms FOR INSERT TO authenticated WITH CHECK (host_id = auth.uid());
CREATE POLICY "host updates room" ON public.rooms FOR UPDATE TO authenticated USING (host_id = auth.uid() OR public.is_room_participant(id, auth.uid()));
CREATE POLICY "host deletes room" ON public.rooms FOR DELETE TO authenticated USING (host_id = auth.uid());

CREATE POLICY "participants visible to room members" ON public.room_participants FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_room_participant(room_id, auth.uid()));
CREATE POLICY "user joins as self" ON public.room_participants FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "user updates own participant row" ON public.room_participants FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user leaves as self" ON public.room_participants FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Chat
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'text',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_room_created_idx ON public.chat_messages(room_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat visible to participants" ON public.chat_messages FOR SELECT TO authenticated
  USING (public.is_room_participant(room_id, auth.uid()));
CREATE POLICY "participants send chat" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_room_participant(room_id, auth.uid()));

-- Friends (one row per direction; each user has their own nickname for the other)
CREATE TABLE public.friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT,
  first_shared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_shared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_shared_seconds NUMERIC NOT NULL DEFAULT 0,
  CHECK (owner_id <> friend_id),
  UNIQUE (owner_id, friend_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friends TO authenticated;
GRANT ALL ON public.friends TO service_role;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "friends readable by owner" ON public.friends FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "friends insertable by owner" ON public.friends FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "friends updatable by owner" ON public.friends FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "friends deletable by owner" ON public.friends FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- Playlists
CREATE TABLE public.playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Playlist',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlists TO authenticated;
GRANT ALL ON public.playlists TO service_role;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "playlists own" ON public.playlists FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.playlist_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  channel TEXT,
  thumbnail TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX playlist_tracks_playlist_pos_idx ON public.playlist_tracks(playlist_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlist_tracks TO authenticated;
GRANT ALL ON public.playlist_tracks TO service_role;
ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tracks via own playlist" ON public.playlist_tracks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.owner_id = auth.uid()));

-- Play history
CREATE TABLE public.play_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  channel TEXT,
  thumbnail TEXT,
  played_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX play_history_user_time_idx ON public.play_history(user_id, played_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.play_history TO authenticated;
GRANT ALL ON public.play_history TO service_role;
ALTER TABLE public.play_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "history own" ON public.play_history FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_participants;

-- Helper: generate short invite code
CREATE OR REPLACE FUNCTION public.gen_invite_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
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
