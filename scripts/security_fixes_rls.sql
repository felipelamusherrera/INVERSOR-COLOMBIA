-- ==============================================================================
-- MIGRACIÓN DE SEGURIDAD Y BLINDAJE RLS
-- Proyecto: Inversor Colombia (Supabase)
-- Hallazgos: Solicitud 1 de Auditoría de Seguridad (security-audit)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CORRECCIÓN RLS: TABLA DE PRECIOS HISTÓRICOS (stock_prices_history)
-- Eliminar política permisiva abierta y restringir escritura a service_role y admins
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.stock_prices_history ENABLE ROW LEVEL SECURITY;

-- Eliminar política insegura previa de escritura pública abierta si existiese
DROP POLICY IF EXISTS "Escritura precios historicos" ON public.stock_prices_history;
DROP POLICY IF EXISTS "Escritura segura solo service_role y admin" ON public.stock_prices_history;

-- Permitir lectura pública de precios históricos para usuarios autenticados y anónimos
DROP POLICY IF EXISTS "Lectura publica precios historicos" ON public.stock_prices_history;
CREATE POLICY "Lectura publica precios historicos"
ON public.stock_prices_history
FOR SELECT
TO anon, authenticated
USING (true);

-- Restringir inserción, actualización y borrado exclusivamente a service_role o admins
CREATE POLICY "Escritura segura solo service_role y admin"
ON public.stock_prices_history
FOR ALL
TO authenticated, service_role
USING (
    current_setting('request.jwt.claim.role', true) = 'service_role' OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
    current_setting('request.jwt.claim.role', true) = 'service_role' OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ------------------------------------------------------------------------------
-- 2. CORRECCIÓN RLS Y PROTECCIÓN CONTRA ESCALADA DE PRIVILEGIOS: TABLA profiles
-- Impedir que un usuario ordinario cambie su propio rol a 'admin' o altere su estatus
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- Actualizar política de actualización con WITH CHECK estricto
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (
    auth.uid() = id AND 
    (
        public.is_admin() OR (
            role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) AND
            status = (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid())
        )
    )
);

-- Trigger de validación a nivel de motor de base de datos
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

-- Confirmación de estado de políticas
SELECT tablename, policyname, roles, cmd 
FROM pg_policies 
WHERE tablename IN ('profiles', 'stock_prices_history')
ORDER BY tablename, policyname;
