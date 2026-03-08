-- ============================================
-- FIX v2: Comprehensive trigger fix
-- Run this in Supabase SQL Editor
-- ============================================

-- First, delete any orphaned auth users that don't have profiles
-- (this cleans up the failed attempts)
DELETE FROM auth.users WHERE id NOT IN (SELECT id FROM public.profiles);

-- Drop the old trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Add INSERT policy for profiles (the trigger needs this!)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role can insert profiles'
  ) THEN
    CREATE POLICY "Service role can insert profiles"
      ON profiles FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- Recreate trigger function with explicit search_path
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Citizen'),
    'citizen'
  );
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
