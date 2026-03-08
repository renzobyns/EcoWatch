-- ============================================
-- EcoWatch SJDM — Database Schema
-- Run this in Supabase SQL Editor (supabase.com → SQL Editor → New Query)
-- ============================================

-- 1. Custom ENUM for user roles
CREATE TYPE user_role AS ENUM ('citizen', 'barangay', 'cenro');

-- 2. Custom ENUM for report status
CREATE TYPE report_status AS ENUM ('pending', 'verified', 'in_progress', 'resolved', 'rejected');

-- 3. Profiles table (extends Supabase Auth users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'citizen',
  barangay TEXT,                    -- Only for barangay admins: which barangay they manage
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Reports table (the core of the app)
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  barangay TEXT NOT NULL,            -- Auto-assigned by Ray-Casting
  description TEXT,
  photo_url TEXT,                     -- URL from Supabase Storage
  ai_confidence REAL,                -- Mask R-CNN confidence score (0.0 - 1.0)
  ai_verified BOOLEAN DEFAULT FALSE, -- Whether AI says it's legit
  status report_status NOT NULL DEFAULT 'pending',
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  resolution_photo_url TEXT,          -- "After cleanup" photo
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Auto-create a profile when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Citizen'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'citizen')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 6. Row Level Security (RLS) policies

-- Profiles: Users can read all profiles but only update their own
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Reports: Everyone can read, authenticated users can create, admins can update
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reports are viewable by everyone"
  ON reports FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create reports"
  ON reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Barangay and CENRO can update reports"
  ON reports FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('barangay', 'cenro')
    )
  );

-- 7. Create storage bucket for report photos
INSERT INTO storage.buckets (id, name, public) VALUES ('report-photos', 'report-photos', true);

-- Storage policy: anyone can view, authenticated users can upload
CREATE POLICY "Public can view report photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'report-photos');

CREATE POLICY "Authenticated users can upload report photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'report-photos' AND auth.role() = 'authenticated');
