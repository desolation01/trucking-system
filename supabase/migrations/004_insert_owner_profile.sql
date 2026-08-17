-- Insert the Owner profile (replace with the actual auth UID)
INSERT INTO public.profiles (id, name, role, status) VALUES
  ('96517e60-3d98-4921-ba84-5bc8d0de4998', 'Owner / Admin', 'owner', 'active')
ON CONFLICT (id) DO NOTHING;