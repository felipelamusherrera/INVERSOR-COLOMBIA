-- ============================================================================
-- INVERSOR COLOMBIA · Disparador Automático Puntual (Supabase -> GitHub Actions)
-- ============================================================================
-- Objetivo:
--   Ejecutar el workflow `.github/workflows/daily_sync.yml` vía `workflow_dispatch`
--   en la cola INMEDIATA de GitHub Actions (~5-15 segundos) evitando los retrasos
--   de horas de la cola pública `on.schedule` de GitHub.
--
-- Horario configurado (Lunes a Viernes, Hora Colombia UTC-5):
--   1. 09:30 AM COL -> 14:30 UTC (Apertura Wall Street EST)
--   2. 11:30 AM COL -> 16:30 UTC (Media mañana)
--   3. 01:30 PM COL -> 18:30 UTC (Tarde bursátil)
--   4. 03:30 PM COL -> 20:30 UTC (Cierre EDT / Pre-cierre EST)
--   5. 04:15 PM COL -> 21:15 UTC (Cierre Wall Street EST)
--
-- INSTRUCCIONES:
--   1. Reemplaza 'PEGA_AQUI_TU_GITHUB_TOKEN' con tu Fine-Grained PAT de GitHub
--      (permiso único requerido: Actions -> Read and write en INVERSOR-COLOMBIA).
--   2. Ejecuta este script completo en Supabase -> SQL Editor.
--   3. Prueba el disparo inmediato con la consulta de verificación al final.
-- ============================================================================

-- 1. Habilitar extensiones requeridas (si aún no están activas)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Guardar o actualizar el token de GitHub de forma cifrada en Supabase Vault
DO $$
DECLARE
  v_secret_id uuid;
  v_github_token text := 'PEGA_AQUI_TU_GITHUB_TOKEN';
BEGIN
  IF v_github_token = 'PEGA_AQUI_TU_GITHUB_TOKEN' OR length(trim(v_github_token)) < 20 THEN
    RAISE EXCEPTION 'Debes reemplazar PEGA_AQUI_TU_GITHUB_TOKEN por tu token real de GitHub antes de ejecutar el script.';
  END IF;

  SELECT id INTO v_secret_id
  FROM vault.secrets
  WHERE name = 'github_actions_pat';

  IF v_secret_id IS NULL THEN
    PERFORM vault.create_secret(
      v_github_token,
      'github_actions_pat',
      'Fine-grained PAT (Actions: Read & Write) para disparar Daily Finviz Sync en GitHub'
    );
  ELSE
    PERFORM vault.update_secret(
      v_secret_id,
      v_github_token,
      'github_actions_pat',
      'Fine-grained PAT (Actions: Read & Write) para disparar Daily Finviz Sync en GitHub'
    );
  END IF;
END $$;

-- 3. Función interna que dispara `workflow_dispatch` en GitHub Actions
CREATE OR REPLACE FUNCTION public.trigger_github_daily_sync()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault, net
AS $$
DECLARE
  v_token text;
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_token
  FROM vault.decrypted_secrets
  WHERE name = 'github_actions_pat'
  LIMIT 1;

  IF v_token IS NULL OR length(trim(v_token)) = 0 THEN
    RAISE EXCEPTION 'No se encontró el secreto github_actions_pat en Supabase Vault.';
  END IF;

  SELECT net.http_post(
    url := 'https://api.github.com/repos/felipelamusherrera/INVERSOR-COLOMBIA/actions/workflows/daily_sync.yml/dispatches',
    headers := jsonb_build_object(
      'Accept', 'application/vnd.github+json',
      'Authorization', 'Bearer ' || v_token,
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'InversorColombia-Supabase-Cron',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('ref', 'main'),
    timeout_milliseconds := 10000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- Seguridad: impedir que usuarios del frontend (anon/authenticated) invoquen la función por API
REVOKE ALL ON FUNCTION public.trigger_github_daily_sync() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trigger_github_daily_sync() FROM anon;
REVOKE ALL ON FUNCTION public.trigger_github_daily_sync() FROM authenticated;

-- 4. Programar las 5 ejecuciones puntuales (idempotente: reemplaza si ya existen)
DO $$
DECLARE
  v_job text;
  v_jobs text[] := ARRAY[
    'inversor_sync_0930_col',
    'inversor_sync_1130_col',
    'inversor_sync_1330_col',
    'inversor_sync_1530_col',
    'inversor_sync_1615_col'
  ];
BEGIN
  FOREACH v_job IN ARRAY v_jobs LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = v_job) THEN
      PERFORM cron.unschedule(v_job);
    END IF;
  END LOOP;
END $$;

-- 9:30 AM Colombia (14:30 UTC, Lunes a Viernes)
SELECT cron.schedule('inversor_sync_0930_col', '30 14 * * 1-5', $$SELECT public.trigger_github_daily_sync();$$);
-- 11:30 AM Colombia (16:30 UTC, Lunes a Viernes)
SELECT cron.schedule('inversor_sync_1130_col', '30 16 * * 1-5', $$SELECT public.trigger_github_daily_sync();$$);
-- 1:30 PM Colombia (18:30 UTC, Lunes a Viernes)
SELECT cron.schedule('inversor_sync_1330_col', '30 18 * * 1-5', $$SELECT public.trigger_github_daily_sync();$$);
-- 3:30 PM Colombia (20:30 UTC, Lunes a Viernes)
SELECT cron.schedule('inversor_sync_1530_col', '30 20 * * 1-5', $$SELECT public.trigger_github_daily_sync();$$);
-- 4:15 PM Colombia (21:15 UTC, Lunes a Viernes - Cierre Wall Street EST)
SELECT cron.schedule('inversor_sync_1615_col', '15 21 * * 1-5', $$SELECT public.trigger_github_daily_sync();$$);

-- 5. Verificar que quedaron las 5 tareas activas
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname LIKE 'inversor_sync_%'
ORDER BY jobname;

-- ============================================================================
-- PRUEBA INMEDIATA (ejecuta estas 2 líneas por separado después del script):
-- ============================================================================
-- SELECT public.trigger_github_daily_sync();
--
-- Espera ~5 segundos y verifica que GitHub respondió con status_code = 204:
-- SELECT id, status_code, error_msg, created
-- FROM net._http_response
-- ORDER BY created DESC
-- LIMIT 5;
-- ============================================================================
