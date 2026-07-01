
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_room_participant(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gen_invite_code() FROM PUBLIC, anon;
-- is_room_participant is used by RLS as auth.uid(); RLS runs as the definer so authenticated
-- callers don't need direct EXECUTE. Keep it callable only by service_role.
REVOKE EXECUTE ON FUNCTION public.is_room_participant(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.is_room_participant(UUID, UUID) TO service_role;
-- gen_invite_code is called from server functions with the admin client
GRANT EXECUTE ON FUNCTION public.gen_invite_code() TO service_role;
ALTER FUNCTION public.gen_invite_code() SET search_path = public;
