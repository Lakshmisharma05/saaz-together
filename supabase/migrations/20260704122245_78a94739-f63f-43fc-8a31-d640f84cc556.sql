
-- RLS policies run as the invoking role; SECURITY DEFINER still needs EXECUTE
-- granted on the function to the caller. Restore access for authenticated
-- (schema is not exposed to PostgREST, so this is safe).
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_room_participant(uuid, uuid) TO authenticated;
