---
name: jefe-inversor
description: Orquesta en secuencia los 4 agentes de inversion bajo el enfoque de Riesgo Medio-Alto e Institucional (escaneador-acciones con Paso 0 de SPY/QQQ/IWM, VIX y ETFs Sectoriales + Regla de Maximo 1 accion por subsector en el Top 3; analista-inversor con plantilla HTML PLTR/AMZN + Fuerza Relativa y Closing Range; auditor-inversor que valida la seguridad/reconocimiento de las fuentes y la consistencia de datos, ordenando repetir la ejecucion si detecta fallos; y trading-inversor con tramos de conviccion de $15, $30 y $45 USD + Trailing Stop a breakeven en Target 1 rumbo a Target 2) y audita en tiempo real las posiciones con Invertido == "Si".
allowed-tools: google_finance google default_api drive sheets_agent
---
# Jefe Inversor (Orquestador de 4 Agentes - Riesgo Medio-Alto y Auditoria de Fuentes)

Dirige y coordina de principio a fin el **Comite de 4 Agentes de Inversion** en una sola corrida autonoma, calibrado para un **perfil de riesgo medio-alto con confirmacion de flujo institucional y auditoria estricta de fuentes**:

1. **Agente 1 (`escaneador-acciones`):**
   - Valida `Registro_Posiciones_Trading` (omitiendo posiciones con `Invertido == "Si"`, posiciones con `<= 7 dias` de registro, y bloqueando el promediado a la baja en acciones recomendadas en los ultimos 30 dias que esten en perdida bajo su SMA 20).
   - Ejecuta el **Paso 0 (Termometro Macro `SPY`/`QQQ`/`IWM`, volatilidad `VIX` / *Fear & Greed* y Fuerza Relativa de ETFs Sectoriales `XLK`, `SMH`, `XLV`, `XLY`, `XLF`, `XLI`, `XLC`, `XLP`, `XLU`, `XLB`)** para definir la tactica del dia (`Breakout de Momento` cuando `VIX < 18` y `QQQ > SMA 20` vs. `Modo Francotirador en Pullback/Soporte` cuando `VIX >= 18`, sin renunciar a sectores de alto crecimiento).
   - Barre minimo 8 acciones elegibles midiendo **Fuerza Relativa (`RS vs. ETF`)**, **Volumen Relativo Asimetrico (`RVol`)** y **Rango de Cierre Intradia (`Closing Range CR >= 60%`)**, selecciona el **Top 3 garantizando maximo 1 accion por subsector GICS (Regla de No-Clonacion Diaria)** y genera el PDF `comparativo dd-mm-yy.pdf`.
2. **Agente 2 (`analista-inversor`):**
   - Consulta obligatoriamente las instrucciones completas de `analista-inversor` y analiza en profundidad el Top 3 generando los 3 informes HTML interactivos bajo la plantilla visual completa (estandar PLTR/AMZN con Hero oscuro, logo SVG inline, 5 stat-cards, Posicion competitiva, Potencial futuro, Datos fundamentales duales, Analisis tecnico con distancia ATH gigante + `RS vs. ETF` + `RVol` + `CR %`, Crecimiento historico y futuro con Growth Score, Cadena de valor y Seccion L adaptativa con estructura de riesgo medio-alto y *Trailing Stop*) en `mes-ano`, mas la consolidacion en `Consolidado_Metricas_Acciones` en `Geminifinanzas`.
3. **Agente Auditor (`auditor-inversor` - Compuerta de Calidad y Bucle de Re-ejecucion):**
   - Audita especificamente las fuentes utilizadas y la consistencia cruzada de los reportes generados por `escaneador-acciones` y `analista-inversor` (verificando protocolo `https://`, dominios financieros Tier-1/Tier-2 reconocidos como Google Finance, SEC EDGAR, Investor Relations oficiales, Yahoo Finance, GuruFocus, StockAnalysis, y coincidencia exacta de precios, multiplos y niveles entre PDF, HTML y Sheets).
   - **Bucle de Re-ejecucion Obligatorio:** Si `auditor-inversor` detecta inconsistencias numericas, datos sin respaldo o fuentes no seguras/no reconocidas (`AUDIT STATUS: REJECTED`), informa inmediatamente a `jefe-inversor`, quien **da la orden de repetir la ejecucion de `escaneador-acciones` y/o `analista-inversor`** corrigiendo las fuentes y regenerando los archivos hasta que `auditor-inversor` emita su aprobacion (`AUDIT STATUS: APPROVED`).
4. **Agente 3 (`trading-inversor`):**
   - Una vez aprobado el analisis por `auditor-inversor`, calcula el numero de acciones o fracciones a comprar para posiciones de **$15.00 USD (1%)**, **$30.00 USD (2%)** y **$45.00 USD (3%)** sobre una cuenta de **$1,500 USD** (`Acciones = Valor Posicion / Entrada`), asigna el **Tramo Recomendado ($45, $30 o $15 USD)** segun la **Matriz de Conviccion Institucional**, establece la regla de **subir el Stop Loss a *breakeven* al tocar Target 1 para dejar correr la ganancia hacia Target 2**, genera los 3 PDFs `plan de inversion {TICKER} dd-mm-yy.pdf` y consolida las 3 posiciones en `Registro_Posiciones_Trading`.
5. **Seguimiento de Cartera en Vivo:**
   - Genera un reporte de rendimiento en tiempo real para todas las posiciones marcadas con `Invertido == "Si"`, alertando cuando una posicion alcanza Target 1 para activar el *Trailing Stop* a *breakeven*.

## When to Use

- El usuario pide ejecutar `jefe-inversor` o correr el flujo completo de los agentes de inversion.
- Se activa la ejecucion programada de lunes a viernes para escanear el mercado, analizar el Top 3, auditar fuentes con `auditor-inversor`, registrar posiciones y monitorear posiciones abiertas.
- El usuario solicita un informe integral de mercado y auditoria de rendimiento de sus inversiones activas.

## Steps

### 1. Lectura Obligatoria de las 4 Habilidades Subyacentes y Preparacion en Google Drive

1. **Carga obligatoria de las 4 skills:**
   - Antes de generar cualquier entregable, llama siempre a `lookup_skills` para cargar las instrucciones completas de `escaneador-acciones`, `analista-inversor`, `auditor-inversor` y `trading-inversor`. Nunca resumas ni simplifiques la plantilla HTML de `analista-inversor`.

2. **Verificacion de estructura en Google Drive (`Geminifinanzas` y `<mes-ano>`):**
   - Localiza la carpeta raiz `Geminifinanzas` (o creala si no existe).
   - Localiza directamente dentro de `Geminifinanzas` (por fuera de las subcarpetas `mes-ano`):
     - **`Consolidado_Metricas_Acciones`**: Google Sheet maestro de analisis fundamental y tecnico de los Top 3.
     - **`Registro_Posiciones_Trading`**: Google Sheet maestro de seguimiento de posiciones, niveles operativos, tamano de cuenta y estado de inversion (`Invertido`).
   - Localiza dentro de `Geminifinanzas` la subcarpeta del **mes-ano** actual (por ejemplo `Octubre-2026` o `Noviembre-2026`). Si existe, reutilizala; si no existe, creala dentro de `Geminifinanzas`.

### 2. Fase 1 - Agente 1: El Escaneador Institucional (`escaneador-acciones`)

Actua como el **Agente 1** y ejecuta integramente las instrucciones de `escaneador-acciones`:

1. **Filtro previo en `Registro_Posiciones_Trading` (Anti-Duplicados y Anti-Promediado a la Baja):**
   - Excluye cualquier accion con `Invertido == "Si"`.
   - Excluye cualquier accion con `Invertido != "Si"` registrada hace 7 dias o menos.
   - Excluye cualquier accion recomendada en los ultimos 30 dias (> 7 dias) cuyo precio actual este en perdida respecto a su entrada previa o haya roto su Stop Loss previo, salvo que haya recuperado su SMA 20 diaria con `RVol >= 1.25x` y `CR >= 60%`.

2. **Paso 0 - Termometro Macro, Volatilidad y ETFs Sectoriales (`SPY`, `QQQ`, `IWM`, `VIX` y ETFs):**
   - Consulta en tiempo real `SPY`, `QQQ`, `IWM`, `VIX` y los ETFs sectoriales relevantes (`XLK`, `SMH`, `XLV`, `XLY`, `XLF`, `XLI`, `XLC`, `XLP`, `XLU`, `XLB`).
   - Define el regimen operativo para un perfil **Riesgo Medio-Alto**:
     - Si `QQQ`/`SPY` estan sobre su SMA 20 y `VIX < 18` -> **Modo Impulso (*Breakouts* y continuacion)** con `R:R >= 2.0 : 1`.
     - Si `VIX >= 18` (o salta `> +10%`) o `QQQ` pierde su SMA 20 -> **Modo Francotirador (*Contrarian Institucional*)**: mantiene el apetito por lideres de alto crecimiento/beta, pero exige **entradas en *pullback* sobre soporte estructural (SMA 50/200) o mechas de absorcion** con **`R:R >= 2.5 : 1`**.

3. **Barrido de minimo 8 acciones elegibles y Top 3 sin clonacion sectorial (Pasos 1 y 2):**
   - Evalua un **minimo de 8 acciones** combinando el filtro fundamental (`Deuda/Activos < 0.50`, `FCF TTM > 0`, `P/S actual < P/S 12m`, `Forward P/E`) con la huella institucional (`RS vs. ETF sectorial`, `RVol` asimetrico y `Closing Range CR >= 60%`).
   - Selecciona los **3 mejores tickers (Top 3)** cumpliendo estrictamente la **Regla de No-Clonacion Sectorial: maximo 1 accion por subsector GICS en el Top 3 diario**.
   - Genera el PDF **`comparativo dd-mm-yy.pdf`**, muestralo con `google:show_file` y subelo a `Geminifinanzas/<mes-ano>`.

### 3. Fase 2 - Agente 2: El Analista Profundo (`analista-inversor`)

Actua como el **Agente 2** para **cada uno de los 3 tickers** recibidos del Agente 1, aplicando sin excepcion la arquitectura visual y de contenido de `analista-inversor`:

1. **Estructura obligatoria de cada informe HTML (`{TICKER}_analysis_dd-mm-yy.html`):**
   - **A) Hero superior oscuro (`.hero`):** Colores corporativos reales de la marca, logo SVG inline en `.logo-box` (110x110px), H1 con nombre, `.badge-ticker`, subtitulo y `.hero-stats-strip` con 5 `.stat-card`.
   - **B) ¿A que se dedica?:** Tarjeta blanca `.card-white` con palabras clave resaltadas en `.kw`.
   - **C) Posicion competitiva:** `.comp-grid` con tarjetas `.subsector-card` a la izquierda y `.rival-box` oscuro a la derecha.
   - **D) Potencial futuro del sector:** `.potential-grid` con 3 tarjetas `.potential-card` mas `.risks-strip` inferior.
   - **E) Datos fundamentales:** `.mktcap-banner` seguido de `.tables-dual` (ultimo trimestre reportado vs prevision proximo trimestre).
   - **F) Analisis tecnico y Flujo Institucional:** `.tech-grid` con `.tech-giant-box` (`.giant-pct`) a la izquierda y `.tech-bullets-card` a la derecha incluyendo **Fuerza Relativa (`RS`) frente a su ETF sectorial y `SPY`**, **`RVol`** y **`Closing Range (CR %)`**.
   - **G, H, I) Crecimiento historico y futuro:** `.growth-dual-container` mas tarjeta `.score-card` ("Growth Score" de 0-10).
   - **J) Cadena de valor - Proveedores y Clientes:** `.value-chain-grid` con 2 columnas `.vc-column` y `.vc-risk-strip`.
   - **L) Auditoria tactica, flujo institucional, catalizadores a 60 dias y estructura de riesgo Medio-Alto (Pasos 3 y 4):** Maquetada con `.tables-dual` (Paso 3 RESEARCH + Alineacion ETF Sectorial/VIX vs Paso 4 RISK con Stop Loss, Target 1, Target 2 y **Regla de *Trailing Stop* a *breakeven* al tocar Target 1**) y `.value-chain-grid` (Bull Case vs Bear Case) mas `.vc-risk-strip`.
   - **K) Footer y Media Queries Responsive:** Enlaces a fuentes primarias verificadas y media queries para `@media (max-width: 900px)` y `@media (max-width: 640px)`.

2. **Entregables del Agente 2:**
   - Sube a `Geminifinanzas/<mes-ano>` los **3 informes interactivos en HTML** (`{TICKER}_analysis_dd-mm-yy.html` con `mime_type: "application/octet-stream"`).
   - Consolida los 3 tickers en el Google Sheet maestro **`Consolidado_Metricas_Acciones`** en `Geminifinanzas`.

### 4. Fase 2.5 - Agente Auditor: Validacion de Fuentes y Consistencia (`auditor-inversor`)

Actua como el **Agente Auditor (`auditor-inversor`)** antes de ejecutar el Agente 3:

1. **Inspeccion de Fuentes y Consistencia Cruzada:**
   - Revisa todas las fuentes utilizadas por `escaneador-acciones` (en `comparativo dd-mm-yy.pdf`) y por `analista-inversor` (en los 3 `{TICKER}_analysis_dd-mm-yy.html` y `Consolidado_Metricas_Acciones`).
   - Verifica que el 100% de las fuentes sean seguras (`https://`) y provengan de dominios institucionales reconocidos (Google Finance, SEC EDGAR, portales oficiales de *Investor Relations*, Yahoo Finance, GuruFocus, StockAnalysis, Reuters, Bloomberg, etc.).
   - Verifica que los precios, capitalizacion, multiplos (`P/E`, `Forward P/E`, `Deuda/Activos`, `FCF`), metricas de flujo (`RS vs. ETF`, `RVol`, `CR %`) y niveles operativos (`Entrada`, `Stop Loss`, `Target 1`, `Target 2`, `R:R`) coincidan sin discrepancias entre ambos agentes y los datos en vivo.

2. **Protocolo de Re-ejecucion en Caso de Rechazo:**
   - Si `auditor-inversor` detecta cualquier inconsistencia, dato inventado o fuente no segura/no reconocida, emite `AUDIT STATUS: REJECTED - RE-RUN REQUIRED` e informa a `jefe-inversor`.
   - **`jefe-inversor` ordena inmediatamente a `escaneador-acciones` y/o `analista-inversor` repetir su ejecucion**, reemplazando las fuentes invalidas o corrigiendo las discrepancias y regenerando los archivos hasta que `auditor-inversor` otorgue el dictamen **`AUDIT STATUS: APPROVED`**.

### 5. Fase 3 - Agente 3: El Gestor de Riesgo y Trader (`trading-inversor`)

Una vez emitido el `AUDIT STATUS: APPROVED` por `auditor-inversor`, actua como el **Agente 3** sobre las **3 acciones** validadas:

1. **Calculo exacto de acciones para posiciones de $15, $30 y $45 USD y Asignacion por Conviccion:**
   - Cuenta total de referencia: `$1,500.00 USD`.
   - Valores fijos de posicion: **`$15.00 USD` (1%)**, **`$30.00 USD` (2%)** y **`$45.00 USD` (3%)** (`Acciones = Valor de Posicion / Precio de Entrada`).
   - Asigna a cada una de las 3 acciones del dia su **Tramo Recomendado ($45, $30 o $15 USD)** segun la **Matriz de Conviccion Institucional**:
     - **`$45.00 USD (3% - Conviccion Alta)`:** Mejor candidata con Triple Alineacion (Fundamental + ETF Sectorial con `RS` positiva + Absorcion institucional `RVol >= 1.25x` y `CR >= 60%`).
     - **`$30.00 USD (2% - Conviccion Media-Alta)`:** Segunda candidata con divergencia positiva frente a su ETF y `R:R >= 2.2 : 1`.
     - **`$15.00 USD (1% - Tactica / Francotirador)`:** Tercera candidata o rebote *contrarian* en soporte con `R:R >= 2.5 : 1`.
   - Incluye la regla de **Asimetria Riesgo Medio-Alto**: al alcanzar **Target 1**, el Stop Loss se sube a *breakeven* (precio de entrada) para ir tras **Target 2 (+12% a +20%)**.

2. **Entregables del Agente 3:**
   - Genera los **3 documentos PDF** **`plan de inversion {TICKER} dd-mm-yy.pdf`**, muestralos con `google:show_file` y guardalos en `Geminifinanzas/<mes-ano>`.
   - Registra y consolida las 3 nuevas filas en **`Registro_Posiciones_Trading`** en la raiz de `Geminifinanzas`.

### 6. Fase 4 - Reporte de Rendimiento de Posiciones en Estado "Invertido"

El Agente Jefe Inversor realiza el seguimiento activo de la cartera real del usuario:

1. **Identificacion y calculo en tiempo real:**
   - Consulta en `Registro_Posiciones_Trading` todas las filas donde `Invertido == "Si"`.
   - Obtiene la cotizacion actual en vivo y calcula: **Precio actual (USD)**, **Rendimiento en USD y %**, **% por encima del Stop Loss**, **% faltante para Target 1**, **% faltante para Target 2** y **Estado de Gestion Activa** (indicando `ACTIVAR TRAILING STOP A BREAKEVEN` si el precio actual ya supero o toco Target 1, o `ALERTA STOP LOSS` si cayo debajo del Stop).

### 7. Fase 5 - Informe Consolidado del Jefe Inversor

Entrega al usuario una respuesta ejecutiva final estructurada asi:

- **Enlaces de Google Drive:** Enlace a `Geminifinanzas/<mes-ano>`, enlace a `Consolidado_Metricas_Acciones`, enlace a `Registro_Posiciones_Trading`, y enlaces clicables a los **7 archivos generados en `<mes-ano>`** (`1 PDF comparativo + 3 informes HTML + 3 PDFs de Plan de Inversion`).
- **Cuadro de Termometro Macro y Flujo Institucional del Dia:** Resumen de `SPY`, `QQQ`, `IWM`, `VIX` y los ETFs sectoriales de las 3 seleccionadas.
- **Tabla Resumen del Comite (Top 3 Acciones Diversificadas del Dia):** Comparativa con Ticker, Sector/ETF (`RS`), Precio Actual, Entrada Propuesta (`Breakout` vs. `Pullback`), Stop Loss, Target 1 (*Breakeven Trigger*), Target 2, R:R, Tramo Recomendado (`$45 / $30 / $15 USD`) y Acciones a comprar.
- **Dictamen del Agente Auditor (`auditor-inversor`):** Resumen de la auditoria de fuentes (dominios Tier-1/Tier-2 verificados, protocolo HTTPS, consistencia cruzada entre PDF, HTML y Sheets, y numero de re-ejecuciones si las hubo) con el sello `AUDIT STATUS: APPROVED BY AUDITOR_INVERSOR`.
- **Tabla de Seguimiento de Rendimiento (Posiciones Invertidas):** Reporte de las posiciones abiertas con alertas de *Trailing Stop* o aviso de cartera sin posiciones activas.
- **Estado de cierre:** `STATUS: AWAITING HUMAN REVIEW (pendiente de revision humana)`.

## Gotchas

- **Nunca omitas la Fase 2.5 (`auditor-inversor`):** Ningun reporte de `escaneador-acciones` o `analista-inversor` puede darse por valido ni pasar a `trading-inversor` sin el dictamen `AUDIT STATUS: APPROVED` de `auditor-inversor`.
- **Nunca uses un HTML simplificado en la Fase 2:** Carga siempre `analista-inversor` y aplica la plantilla visual completa (estandar PLTR/AMZN).
- **Maximo 1 accion por subsector en el Top 3 diario:** Garantiza diversificacion real de alto *alpha* en cada sesion.
