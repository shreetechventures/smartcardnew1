/*
# Add admin_sessions table for secure server-side SuperAdmin sessions

## Purpose
Currently the admin login stores the SHA-256 password hash in browser sessionStorage
and sends it with every subsequent RPC/edge-function call. This is insecure — the
hash is effectively a password equivalent and any XSS would leak it.

This migration creates an `admin_sessions` table that stores short-lived,
single-use-rotation session tokens. The new `admin-session` edge function will:
1. Verify the admin email + password hash via `verify_admin_login()`
2. Insert a new session row with a random token + 2-hour expiry
3. Return the token to the browser

All admin edge functions and RPC calls will then authenticate using the session
token (which is revocable and expires) instead of the raw password hash.

## New Tables
- `admin_sessions`
  - `id` (uuid, primary key)
  - `token` (text, unique, not null) — random opaque session token
  - `admin_email` (text, not null) — the admin email from admin_settings
  - `expires_at` (timestamptz, not null) — when the session expires
  - `created_at` (timestamptz, default now)
  - `revoked` (boolean, default false) — allows manual revocation on logout

## Security
- RLS enabled on admin_sessions
- No policies — the table is only accessed via SECURITY DEFINER functions / service role
- An `is_valid_admin_session()` function checks token validity (not expired, not revoked)
- A `revoke_admin_session()` function revokes a session on logout
*/

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  admin_email text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  revoked boolean DEFAULT false
);

ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- No policies: only service-role (edge functions) and SECURITY DEFINER functions access this table

-- Function to validate a session token
CREATE OR REPLACE FUNCTION public.is_valid_admin_session(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session record;
BEGIN
  SELECT * INTO v_session
  FROM public.admin_sessions
  WHERE token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_session.revoked THEN
    RETURN false;
  END IF;

  IF v_session.expires_at < now() THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- Function to get admin email from a valid session token
CREATE OR REPLACE FUNCTION public.get_admin_session_email(p_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT admin_email INTO v_email
  FROM public.admin_sessions
  WHERE token = p_token
    AND revoked = false
    AND expires_at > now()
  LIMIT 1;

  RETURN v_email;
END;
$$;

-- Function to revoke a session (logout)
CREATE OR REPLACE FUNCTION public.revoke_admin_session(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.admin_sessions
  SET revoked = true
  WHERE token = p_token;

  RETURN true;
END;
$$;

-- Grant anon + authenticated execute on the session functions
-- (anon is needed because the admin page is not Supabase-Auth-authenticated)
GRANT EXECUTE ON FUNCTION public.is_valid_admin_session(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_session_email(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_admin_session(text) TO anon, authenticated;
