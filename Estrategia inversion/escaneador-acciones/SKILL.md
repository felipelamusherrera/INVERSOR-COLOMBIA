---
name: escaneador-acciones
description: Ejecuta el Paso 0 (Termometro Macro SPY/QQQ/IWM, VIX/Fear & Greed y Fuerza Relativa de ETFs Sectoriales con enfoque Riesgo Medio-Alto), el Paso 1 (SCAN de minimo 8 acciones con validacion en Registro_Posiciones_Trading y flujo institucional RVol/Closing Range) y el Paso 2 (ANALYZE) con horizonte swing a 3 meses y regla de maximo 1 accion por subsector en el Top 3, generando el PDF "comparativo dd-mm-yy.pdf" en Geminifinanzas/mes-ano.
allowed-tools: google_finance google default_api drive sheets_agent
---
# Escaneador de Acciones (Enfoque Riesgo Medio-Alto e Institucional)

Ejecuta un flujo estructurado en tres etapas — **Paso 0 (MACRO, ETFs SECTORIALES Y FLUJO INSTITUCIONAL)**, **Paso 1 (SCAN)** y **Paso 2 (ANALYZE)** — calibrado para un **perfil de riesgo medio-alto** con **horizonte estandar swing a 3 meses**, filtrando previamente las acciones registradas en **`Registro_Posiciones_Trading`**, evitando la sobreconcentracion sectorial en el Top 3 diario, y generando el documento PDF **`comparativo dd-mm-yy.pdf`** archivado automaticamente en Google Drive bajo `Geminifinanzas/<mes-ano>`.

## When to Use

- El usuario pide ejecutar el escaneador de acciones, buscar oportunidades o cribar el mercado (SCAN).
- El usuario solicita analizar tecnica, sectorial o cuantitativamente una lista de seguimiento (watchlist) o los movimientos institucionales del dia.
- El usuario pide evaluar acciones bajo los primeros pasos de su estrategia (SCAN + ANALYZE) y obtener el informe comparativo en PDF y en Google Drive.

## Steps

### 1. Validacion Previa en `Registro_Posiciones_Trading` (Filtro Anti-Duplicados y Anti-Promediado a la Baja)

Antes de iniciar cualquier busqueda o barrido de acciones en el mercado, verifica el historico en Google Sheets:

1. **Consulta del archivo de posiciones:**
   - Busca en Google Drive (`drive:search_files`) el archivo **`Registro_Posiciones_Trading`** ubicado directamente en la carpeta raiz `Geminifinanzas`.
   - Lee las filas registradas y extrae para cada ticker su `Fecha de registro (dd/mm/yy)`, su `Precio entrada propuesto (USD)`, su `Stop Loss tecnico (USD)` y el valor de la columna `Invertido`.

2. **Reglas estrictas de exclusion para el escaneo del dia:**
   - **Regla 1 (Posicion abierta - `Invertido == "Si"`):** Si un ticker tiene en la columna `Invertido` el valor "Si" (o "SI", "si", "sí"), **OMITELO OBLIGATORIAMENTE** del escaneo. No puede ser evaluado ni propuesto en el comparativo del dia porque la posicion ya esta abierta en cartera.
   - **Regla 2 (Posicion no invertida - Antigüedad menor a 1 semana):** Si un ticker tiene en `Invertido` el valor "No", esta vacio o pendiente, **SOLO puedes volver a incluirlo en el escaneo si su fecha de registro es anterior a 1 semana (> 7 dias naturales)** respecto a la fecha actual. Si fue registrado hace 7 dias o menos, **OMITELO** para no repetir las mismas acciones en dias consecutivos.
   - **Regla 3 (Bloqueo de promediado a la baja en posiciones perdedoras):** Si un ticker ya fue recomendado en los ultimos 30 dias (> 7 dias) y su precio actual de mercado es **inferior al precio de entrada previo o rompio su Stop Loss previo**, **OMITELO** mientras cotice por debajo de su SMA 20 diaria. Solo podra reingresar si recupero su SMA 20 con volumen de acumulacion institucional (`RVol >= 1.25x` y `Closing Range >= 60%`).
   - Si no existe el archivo aun o esta vacio, procede normalmente con el universo amplio de mercado.

### 2. Paso 0 - Termometro Macro, Volatilidad y Fuerza Relativa de ETFs Sectoriales (Enfoque Riesgo Medio-Alto)

Antes de seleccionar las 8+ acciones candidatas, evalua el flujo institucional de mercado en tiempo real mediante `google_finance:get_finance_entity_info` y `google:search`:

1. **Indices Directores y Volatilidad (`SPY`, `QQQ`, `IWM`, `VIX` y *Fear & Greed*):**
   - Consulta la cotizacion, variacion diaria y ubicacion respecto a medias moviles de **`SPY`** (S&P 500), **`QQQ`** (Nasdaq-100), **`IWM`** (Russell 2000) y el indice de volatilidad **`VIX`** (mas referencia al *CNN Fear & Greed Index* si esta disponible en busqueda):
   - **Calibracion para Perfil de Riesgo Medio-Alto (Selector de Tactica, NO freno defensivo):**
     - **Entorno de Impulso (*Momentum / Risk-On* - `QQQ` y `SPY` sobre SMA 20 y `VIX < 18`):** Prioriza configuraciones de **ruptura de consolidaciones (*breakouts*)** y continuacion de tendencia en sectores de alto crecimiento y ciclicos, exigiendo `R:R >= 2.0 : 1`.
     - **Entorno Francotirador (*Contrarian Institucional* - `VIX` entre `18 y 25+` o salto diario `> +10%`, o `QQQ` bajo su SMA 20):** **NO excluyas** sectores de alto crecimiento o alto *beta* (semiconductores, biotecnologia, software, consumo discrecional), pero **prohibe comprar rupturas en maximos**. Exige exclusivamente entradas en **retroceso a soporte estructural (SMA 50 / SMA 200) o velas con mecha de absorcion institucional (*shakeout*)** y eleva la exigencia minima a **`R:R >= 2.5 : 1`**.

2. **Matriz de ETFs Sectoriales y Fuerza Relativa (`RS`):**
   - Consulta el desempeno de los ETFs sectoriales clave: **`XLK`** (Tecnologia), **`SMH`** (Semiconductores), **`XLV`** (Salud/Biotech), **`XLY`** (Consumo Discrecional), **`XLF`** (Financiero), **`XLI`** (Industrial), **`XLC`** (Comunicacion), **`XLP`** (Consumo Basico), **`XLU`** (Utilities) y **`XLB`** (Materiales).
   - Identifica cuales sectores tienen **Fuerza Relativa positiva frente a `SPY`** (`Retorno ETF > Retorno SPY` en la sesion y en 5-20 dias).
   - Si un sector de alto *beta* (ej. `SMH` o `XLK`) sufre una liquidacion severa en la sesion (`< -2.5%`), solo incluye acciones de ese sector si exhiben **Divergencia Positiva Intrasectorial** (la accion sube o defiende soporte con volumen de absorcion mientras su ETF cae).

### 3. Reglas de Rigor, Horizonte Estandar y Datos en Tiempo Real

- **Horizonte estandar fijo:** El horizonte por defecto es siempre **swing a 3 meses** (donde la estructura semanal y diaria mandan), salvo que el usuario indique otro plazo explicitamente.
- **Cero invencion de datos:** Nunca inventes ni estimes precios, fechas, multiplos o titulares. Si un dato no puede verificarse tras la busqueda, escribe literalmente `NOT PROVIDED - verify manually`.
- **Separacion estricta:** Distingue siempre los `HECHOS` (datos extraidos con fuente y fecha exacta) de la `OPINION` (lectura tecnica o interpretacion).
- **Descargo de responsabilidad:** Incluye el nivel de confianza (`CONFIDENCE: Low / Medium / High`) y cierra siempre con `STATUS: AWAITING HUMAN REVIEW (pendiente de revision humana)`.

### 4. Paso 1 - SCAN (Barrido de Minimo 8 Acciones con Huella Institucional)

Evalua y pasa un **minimo de 8 acciones** elegibles que merezcan investigacion para un horizonte **swing a 3 meses**:

1. **Indicadores fundamentales, sectoriales y de huella institucional (sobre minimo 8 acciones):**
   - **Fuerza Relativa (`RS vs. ETF` y `RS vs. SPY`):** Compara la variacion de la accion frente a su ETF sectorial y frente a `SPY`. Prioriza lideres que superen a su sector.
   - **Huella de Dinero Institucional (*Smart Money Flow*):**
     - **Volumen Relativo Asimetrico (`RVol`):** Volumen de la sesion dividido por el volumen promedio diario. Busca **`RVol >= 1.25x` en dias de subida** (acumulacion institucional) o **`RVol <= 0.85x` en retrocesos ordenados hacia soporte** (secado de oferta). Descarta acciones que caen con `RVol > 1.5x` salvo que dejen mecha inferior de absorcion.
     - **Rango de Cierre Intradia (*Closing Range* `CR %`):** Calcula `CR = ((Precio Actual o Cierre - Minimo del Dia) / (Maximo del Dia - Minimo del Dia)) * 100`. Prioriza acciones con **`CR >= 60%`** (confirmacion de compras institucionales *VWAP/TWAP* al cierre de la sesion) y penaliza `CR < 30%` (distribucion intradia).
   - **Filtro de calidad fundamental:**
     - Deuda financiera (corto + largo plazo) / activos totales `< 0.50`.
     - Flujo de caja libre (FCF) de los ultimos 12 meses (TTM) `> 0`.
     - Precio/Ventas (`P/S`) actual `< P/S` de hace ~12 meses.
     - Precio/Beneficio a futuro (`Forward P/E`) `< 50%` del P/E actual O `< media P/E de 3 anos`.
   - **Catalizadores y riesgo de calendario:** Fechas confirmadas de proximos resultados trimestrales (earnings), guias o eventos regulatorios dentro de la ventana de 3 meses.

2. **Ficha por cada una de las 8+ acciones:**
   - **TICKER, compania y ETF Sectorial:** Que hace la empresa en una sola linea y a que ETF sectorial pertenece.
   - **Por que es interesante ahora (HECHOS):** Datos de precio, `RVol`, `Closing Range (CR %)`, Fuerza Relativa frente a su ETF sectorial, catalizador y resultado del filtro de calidad, con fuente y fecha.
   - **Mayor motivo para descartarlo:** Riesgo principal (proximidad de earnings, distribucion sectorial, `CR < 30%`, sobreextension tecnica o criterio del filtro no superado).
   - **Que investigar a continuacion:** Aspecto clave a validar en el grafico o en los estados financieros.

3. **Ranking, Regla de No-Clonacion Sectorial y Seleccion para el Paso 2:**
   - Ordena las acciones evaluadas por **claridad de la configuracion, respaldo de flujo institucional (`RS` + `RVol` + `CR %`) y solidez de la tesis a 3 meses**.
   - **Regla de No-Clonacion Sectorial en el Top 3 (Diversificacion de Alto Alpha):** Los **3 mejores tickers (Top 3)** que encabecen el ranking para pasar al Agente 2 deben pertenecer a **3 subsectores distintos (maximo 1 accion por subsector GICS en el Top 3 del dia)**. Nunca selecciones 2 o 3 semiconductores o 2 acciones del mismo subsector en la misma sesion.

### 5. Paso 2 - ANALYZE (Analisis Tecnico de Todas las Acciones Seleccionadas)

Actua como analista de graficos sobre **precio, volumen y fuerza relativa** para **todas las acciones seleccionadas en el Paso 1**, verificando la serie historica de 6 meses (marco diario) y 1 a 2 anos (marco semanal) acorde al horizonte swing de 3 meses:

1. **Evalua las 5 dimensiones observables para cada accion seleccionada:**
   - **1. Tendencia y Fuerza Relativa (TREND & RS):** Direccion en marco semanal y diario, posicion respecto a SMA 50 y SMA 200, y desempeno relativo frente a su ETF sectorial y `SPY`.
   - **2. Momentum y Flujo Institucional (MOMENTUM & FLOW):** Impulso del precio, comportamiento del volumen (`RVol` en subidas vs. pausas) y porcentaje de cierre intradia (`Closing Range CR %`).
   - **3. Soporte Institucional (SUPPORT):** Nivel horizontal o dinamico (SMA 50 / SMA 200) mas cercano por debajo del precio actual donde los compradores institucionales defendieron el precio anteriormente.
   - **4. Resistencia y Objetivos (RESISTANCE):** Nivel horizontal o maximo previo mas cercano por encima del precio actual (Target 1) y proyeccion de expansion para dejar correr ganancias (Target 2).
   - **5. Accion del Precio y Tactica segun VIX (PRICE ACTION):** Rupturas (*breakouts*), mechas de absorcion (*shakeouts*), huecos (*gaps*) o compresion de volatilidad (*VCP*), definiendo si la entrada optima es inmediata o en *pullback* segun el nivel actual del `VIX` y `QQQ`.

2. **Estructura de salida del Paso 2 por cada accion:**
   - **HECHOS:** Rango intradia, precio actual, `CR (%)`, rango de 52 semanas, `RVol`, comparativa contra su ETF sectorial y niveles aproximados con fuente y fecha.
   - **OPINION:** Sesgo a 3 meses (`Alcista / Neutral / Bajista`), tactica operativa (`Breakout de Momento` vs. `Francotirador en Pullback`), los **dos niveles clave que importan** (soporte critico y resistencia inmediata) y **que cambia o invalida la lectura**.
   - **CONFIDENCE:** `Low / Medium / High` explicando que elevaria o reduciria esa confianza.

### 6. Generacion del PDF (`comparativo dd-mm-yy.pdf`) y Guardado en Google Drive

En cada ejecucion de la habilidad, genera el PDF con el nombre exacto **`comparativo dd-mm-yy.pdf`**, muestralo en el chat y guardalo en Google Drive:

1. **Diseno y maquetacion HTML a PDF:**
   - Crea un archivo HTML con codificacion UTF-8 y compilalo a PDF en `/working_dir/<conversation_id>/artifacts/file_generation/ttl=63d/output/comparativo dd-mm-yy.pdf` usando `weasyprint` o `compile_and_render.py` mediante `execute_bash`.
   - Usa orientacion horizontal (`@page { size: A4 landscape; margin: 12mm; }`) o bloques de tablas limpias para que el Termometro Macro/Sectorial, las **8 o mas acciones del Paso 1** y **todas las acciones analizadas en el Paso 2** se lean con claridad.

2. **Secciones obligatorias dentro del PDF:**
   - **Encabezado y Nota de Rigor:** Titulo `Comparativo de calidad e institucional - [Fecha]`, precios con hora y fuente, horizonte `swing 3 meses (Riesgo Medio-Alto)` y nota de filtro de posiciones previas.
   - **Seccion 0 - Termometro Macro, Volatilidad y ETFs Sectoriales (Paso 0):** Tabla resumen con `SPY`, `QQQ`, `IWM`, `VIX` y los ETFs sectoriales evaluados (`XLK`, `SMH`, `XLV`, `XLY`, `XLF`, `XLI`, etc.), indicando el regimen del dia (`Impulso Risk-On` vs. `Francotirador Contrarian`) y los sectores con fuerza relativa positiva.
   - **Seccion 1 - Barrido Institucional (Paso 1 - SCAN):** Resumen del barrido sobre minimo 8 acciones elegibles.
   - **Seccion 2 - Tabla del Filtro de Calidad y Huella Institucional (minimo 8 acciones):** Tabla comparativa detallando metricas fundamentales, `ETF Sectorial`, `RS vs. ETF`, `RVol`, `Closing Range (CR %)`, catalizador y veredicto (`PASA` / `NO PASA`) con `HECHO:` y fuente.
   - **Seccion 3 - Ranking a 3 Meses y Top 3 Diversificado (Max 1 por Subsector):** Lista ordenada de los candidatos que pasan al Paso 2 verificando que el Top 3 cubra 3 subsectores distintos, y listado de descartados.
   - **Seccion 4 - Analisis Tecnico de Precio, Volumen y Flujo (Paso 2 - ANALYZE):** Tabla comparativa y desglose completo de las 5 dimensiones para todas las acciones seleccionadas.
   - **Pie de estado:** `CONFIDENCE: Low / Medium / High` y `STATUS: AWAITING HUMAN REVIEW (pendiente de revision humana)`.

3. **Guardado obligatorio en Google Drive (`Geminifinanzas/<mes-ano>`):**
   - Sube el archivo PDF generado con el titulo `comparativo dd-mm-yy.pdf` dentro de la subcarpeta `mes-ano` en `Geminifinanzas`.
   - Presenta tambien el PDF local en el chat mediante `google:show_file` e incluye el enlace directo al archivo y a la carpeta en Google Drive.

## Gotchas

- **Valida siempre Registro_Posiciones_Trading antes de escanear:** Omitir tickers con `Invertido == "Si"`, tickers con `<= 7 dias` de registro, y tickers recomendados en el ultimo mes que esten en perdida bajo su SMA 20.
- **Enfoque Riesgo Medio-Alto:** Cuando el `VIX` suba (18-25), NO descartes acciones de alto crecimiento/beta; cambia la tactica a entradas en *pullback* o mechas de absorcion sobre soporte con `R:R >= 2.5 : 1`.
- **Maximo 1 accion por subsector en el Top 3 diario:** Garantiza que las 3 seleccionadas para el Agente 2 no pertenezcan al mismo subsector.
