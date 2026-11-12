-- ==============================================================================
-- FASE 1: Tabla de Perfiles, Triggers y Políticas RLS en Supabase
-- Aplicativo: Inversor Colombia
-- ==============================================================================

-- 1. Crear tabla de perfiles de usuario
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    document_type VARCHAR(20) DEFAULT 'CC', -- 'CC', 'CE', 'PASAPORTE', 'OTRO'
    document_number VARCHAR(50),
    phone VARCHAR(30),
    country VARCHAR(100) DEFAULT 'Colombia',
    city VARCHAR(100),
    role VARCHAR(20) DEFAULT 'user',        -- 'user' o 'admin'
    status VARCHAR(20) DEFAULT 'active',     -- 'active', 'suspended'
    email_confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_doc_number ON public.profiles(document_number);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Función auxiliar de seguridad para evitar recursión en RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Políticas de Seguridad (RLS)
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

-- Actualización restringida: el usuario no puede cambiar su rol ni su estatus
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (
    auth.uid() = id AND 
    (public.is_admin() OR (
        role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) AND
        status = (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid())
    ))
);

DROP POLICY IF EXISTS "Admins have full access" ON public.profiles;
CREATE POLICY "Admins have full access" 
ON public.profiles FOR ALL 
USING (public.is_admin());

-- 3.1 Trigger de protección reforzada contra escalada de privilegios a nivel de motor SQL
CREATE OR REPLACE FUNCTION public.protect_profile_roles()
RETURNS TRIGGER AS $$
BEGIN
    -- Si no es admin y no es service_role, impedir cualquier alteración a 'role' o 'status'
    IF NOT (public.is_admin() OR current_setting('request.jwt.claim.role', true) = 'service_role') THEN
        IF NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION 'Operación no permitida: no tienes autorización para modificar el rol de usuario.';
        END IF;
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            RAISE EXCEPTION 'Operación no permitida: no tienes autorización para modificar el estatus de la cuenta.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_profile_roles ON public.profiles;
CREATE TRIGGER trg_protect_profile_roles
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_roles();

-- 4. Función y Trigger para sincronización automática desde auth.users
CREATE OR REPLACE FUNCTION public.handle_user_sync()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id, 
        email, 
        full_name, 
        document_type, 
        document_number, 
        phone, 
        country, 
        city, 
        role, 
        status,
        email_confirmed_at,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'document_type', 'CC'),
        COALESCE(NEW.raw_user_meta_data->>'document_number', ''),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        COALESCE(NEW.raw_user_meta_data->>'country', 'Colombia'),
        COALESCE(NEW.raw_user_meta_data->>'city', ''),
        CASE 
            WHEN LOWER(NEW.email) IN ('neuronata25@gmail.com', 'felipelamusherrera@gmail.com') THEN 'admin' 
            ELSE 'user' 
        END,
        'active',
        NEW.email_confirmed_at,
        NEW.created_at,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        email_confirmed_at = EXCLUDED.email_confirmed_at,
        full_name = CASE 
            WHEN EXCLUDED.full_name IS NOT NULL AND EXCLUDED.full_name <> '' THEN EXCLUDED.full_name 
            ELSE profiles.full_name 
        END,
        document_type = CASE 
            WHEN EXCLUDED.document_number IS NOT NULL AND EXCLUDED.document_number <> '' THEN EXCLUDED.document_type 
            ELSE profiles.document_type 
        END,
        document_number = CASE 
            WHEN EXCLUDED.document_number IS NOT NULL AND EXCLUDED.document_number <> '' THEN EXCLUDED.document_number 
            ELSE profiles.document_number 
        END,
        phone = CASE 
            WHEN EXCLUDED.phone IS NOT NULL AND EXCLUDED.phone <> '' THEN EXCLUDED.phone 
            ELSE profiles.phone 
        END,
        country = CASE 
            WHEN EXCLUDED.country IS NOT NULL AND EXCLUDED.country <> '' THEN EXCLUDED.country 
            ELSE profiles.country 
        END,
        city = CASE 
            WHEN EXCLUDED.city IS NOT NULL AND EXCLUDED.city <> '' THEN EXCLUDED.city 
            ELSE profiles.city 
        END,
        role = CASE 
            WHEN LOWER(EXCLUDED.email) IN ('neuronata25@gmail.com', 'felipelamusherrera@gmail.com') THEN 'admin' 
            ELSE profiles.role 
        END,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Disparador después de creación o actualización en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_user_sync();

