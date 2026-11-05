@echo off
REM ============================================================
REM Sincronización Diaria Automática: Finviz -> Supabase
REM Aplicativo: Inversor Colombia
REM ============================================================

set PROJECT_DIR=C:\Users\felip\Documents\IA\ANALIZADOR ACCIONES
set UV_BIN=C:\Users\felip\AppData\Local\hermes\bin\uv.exe

cd /d "%PROJECT_DIR%"

echo [%date% %time%] Iniciando sincronizacion diaria... >> "%PROJECT_DIR%\data\sync.log"

"%UV_BIN%" run .agents/skills/finviz-inversor-colombia/scripts/finviz_sync.py sync --min-market-cap 1000 --retention-days 30 >> "%PROJECT_DIR%\data\sync.log" 2>&1

echo [%date% %time%] Sincronizacion finalizada. >> "%PROJECT_DIR%\data\sync.log"
