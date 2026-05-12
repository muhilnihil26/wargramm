REVOKE EXECUTE ON FUNCTION public.admin_grant_coins(integer, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_coins(integer, text, uuid) TO authenticated;