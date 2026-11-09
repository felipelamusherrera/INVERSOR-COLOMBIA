---
name: jefe-inversor
description: Orquesta en secuencia los 4 agentes de inversion bajo el enfoque de Riesgo Medio-Alto e Institucional (escaneador-acciones con Paso 0 Macro/ETFs + Filtro de Descuento de Valor Intrinseco >=20% [P/IV <=0.80x] + Max 1 accion por subsector; analista-inversor con plantilla HTML PLTR/AMZN incluyendo tabla proyectada 3-5 anos, P/E Sectorial/Percentil/Promedio 3A, Valor Intrinseco en Analisis Tecnico y Backlog vs Costos+CapEx; auditor-inversor y trading-inversor) y audita las posiciones con Invertido == "Si".
allowed-tools: google_finance google default_api drive sheets_agent
---
# Jefe Inversor (Orquestador de 4 Agentes - Riesgo Medio-Alto, Valor Intrinseco >= 20% Descuento y Auditoria de Formato/Fuentes)

Dirige y coordina de principio a fin el **Comite de 4 Agentes de Inversion** en una sola corrida autonoma, calibrado para un **perfil de riesgo medio-alto con confirmacion de flujo institucional, valoracion por Valor Intrinseco (`Descuento >= 20%`) y auditoria estricta de formato y fuentes**:

1. **Agente 1 (`escaneador-acciones`):**
   - Valida `Registro_Posiciones_Trading` (omitiendo posiciones con `Invertido == "Si"`, posiciones con `<= 7 dias` de registro, y posiciones recomendadas en los ultimos 30 dias que esten en perdida bajo su SMA 20).
   - Ejecuta el **Paso 0 (Termometro Macro `SPY`/`QQQ`/`IWM`, volatilidad `VIX` y Fuerza Relativa de ETFs Sectoriales)**.
   - Barre minimo 8 acciones elegibles exigiendo un **Descuento `>= 20%` respecto a su Valor Intrinseco (`DCF / GF Value / Multiplo Justo 3A`, equivalente a `Ratio P/IV <= 0.80x`)** junto con la huella institucional (`RS vs. ETF`, `RVol` y `Closing Range CR >= 60%`), selecciona el **Top 3 garantizando maximo 1 accion por subsector GICS** y genera el PDF `comparativo dd-mm-yy.pdf`.
2. **Agente 2 (`analista-inversor`):**
   - Analiza en profundidad el Top 3 generando los 3 informes HTML interactivos mediante `build_full_html` de `regenerate_3_htmls_full_template.py` (`>= 40 KB`, subidos con `mime_type: "application/octet-stream"` en `Geminifinanzas/<mes-ano>`) incluyendo obligatoriamente:
     - En **Datos Fundamentales:** `P/E Promedio del Sector`, `Percentil del P/E actual frente al sector`, y `P/E Promedio de los ultimos 3 anos` (indicando si el `P/E actual` y el `Forward P/E` estan por encima o por debajo de dicho promedio de 3 anos).
     - En **Analisis Tecnico (tarjeta "Lectura de Estructura y Accion del Precio" y `.tech-subdata`):** El **Valor Intrinseco (`USD`)**, su metodologia de calculo y su **Descuento `>= 20%`** frente al precio actual (`Ratio P/IV <= 0.80x` / `Margen de Seguridad %`).
     - En **Crecimiento Historico y Futuro (tarjeta "Proximos 3-5 anos"):** La **tabla de flujo proyectado (`.hist-table`) para las mismas 5 variables (`Año Proy. | Market Cap | Ventas | EPS Adj. | FCF`)** que la tarjeta de "Ultimos 5 anos", y en **"Motores de Crecimiento Clave"** el **Backlog de contratos (`RPO` / ingresos comprometidos) y su grado de cubrimiento en tiempo respecto a los `Costos Operativos + CapEx proyectados`** (proyeccion de FCF).
   - Consolida los 3 registros en `Consolidado_Metricas_Acciones`.
3. **Agente Auditor (`auditor-inversor`):**
   - Audita el formato estandar (`build_full_html >= 40 KB`, presencia de las 2 tablas `.hist-table`, P/E sectorial/percentil/3A, Valor Intrinseco con descuento `>= 20%`, Backlog vs Costos+CapEx, y subida a Drive con `mime_type: "application/octet-stream"` sin conversion a Google Doc), la seguridad de las fuentes (`https://` Tier-1/Tier-2), las 4 fechas internas y la consistencia cruzada de datos. Si detecta cualquier fallo, ordena regenerar y mover la version defectuosa a `_Archivo_Reemplazados_Auditor` (`1ykM6hltj1N-THlFZiRHLPpdosKxlysrG`).
4. **Agente 3 (`trading-inversor`):**
   - Calcula las fracciones exactas para **$15.00 USD (1%)**, **$30.00 USD (2%)** y **$45.00 USD (3%)** sobre una cuenta de **$1,500 USD**, asigna el **Tramo Recomendado ($45, $30 o $15 USD)**, establece la regla de **Trailing Stop a *breakeven* al tocar Target 1 rumbo a Target 2**, genera los 3 PDFs `plan de inversion {TICKER} dd-mm-yy.pdf` y consolida las 3 posiciones en `Registro_Posiciones_Trading`.
5. **Seguimiento de Cartera en Vivo:**
   - Audita en tiempo real todas las posiciones marcadas con `Invertido == "Si"`.
