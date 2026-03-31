-- ============================================================
-- SECURITY FIX: Prevent privilege escalation via signup metadata
-- handle_new_user() was reading role from raw_user_meta_data,
-- allowing anyone to self-assign admin/superadmin on registration.
-- Now always defaults to 'student'. Admins assign roles manually.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, establishment_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'student',  -- ALWAYS student — never trust user-supplied role
    CASE
      WHEN NEW.raw_user_meta_data->>'establishment_id' IS NOT NULL
      THEN (NEW.raw_user_meta_data->>'establishment_id')::UUID
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
