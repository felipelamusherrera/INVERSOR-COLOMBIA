---
name: escaneador-acciones
description: Ejecuta el Paso 0 (Termometro Macro SPY/QQQ/IWM, VIX/Fear & Greed y Fuerza Relativa de ETFs Sectoriales con enfoque Riesgo Medio-Alto), el Paso 1 (SCAN de minimo 8 acciones con validacion en Registro_Posiciones_Trading, filtro obligatorio de Descuento de Valor Intrinseco >= 20% [P/IV <= 0.80x] bajo DCF/GF Value/Multiplo Justo y flujo institucional RVol/Closing Range) y el Paso 2 (ANALYZE) con horizonte swing a 3 meses y regla de maximo 1 accion por subsector en el Top 3, generando el PDF "comparativo dd-mm-yy.pdf" en Geminifinanzas/mes-ano.
allowed-tools: google_finance google default_api drive sheets_agent
---
# Escaneador de Acciones (Enfoque Riesgo Medio-Alto, Valor Intrinseco con Descuento >= 20% e Institucional)

Ejecuta un flujo estructurado en tres etapas — **Paso 0 (MACRO, ETFs SECTORIALES Y FLUJO INSTITUCIONAL)**, **Paso 1 (SCAN CON FILTRO DE VALOR INTRINSECO >= 20% DE DESCUENTO)** y **Paso 2 (ANALYZE)** — calibrado para un **perfil de riesgo medio-alto** con **horizonte estandar swing a 3 meses**, filtrando previamente las acciones registradas en **`Registro_Posiciones_Trading`**, exigiendo que las candidatas seleccionadas coticen con un **descuento `>= 20%` respecto a su Valor Intrinseco (`Margen de Seguridad >= 20%` / `Ratio P/IV <= 0.80x`)**, evitando la sobreconcentracion sectorial en el Top 3 diario, y generando el documento PDF **`comparativo dd-mm-yy.pdf`** archivado automaticamente en Google Drive bajo `Geminifinanzas/<mes-ano>`.

## When to Use

- El usuario pide ejecutar el escaneador de acciones, buscar oportunidades o cribar el mercado (SCAN).
- El usuario solicita analizar tecnica, sectorial, cuantitativa o fundamentalmente (por Valor Intrinseco con margen de seguridad `>= 20%`) una lista de seguimiento (watchlist) o los movimientos institucionales del dia.
- El usuario pide evaluar acciones bajo los primeros pasos de su estrategia (SCAN + ANALYZE) y obtener el informe comparativo en PDF y en Google Drive.

## Steps

### 1. Validacion Previa en `Registro_Posiciones_Trading` (Filtro Anti-Duplicados y Anti-Promediado a la Baja)

Antes de iniciar cualquier busqueda o barrido de acciones en el mercado, verifica el historico en Google Sheets:

1. **Consulta del archivo de posiciones:**
   - Busca en Google Drive (`drive:search_files`) el archivo **`Registro_Posiciones_Trading`** ubicado directamente en la carpeta raiz `Geminifinanzas`.
   - Lee las filas registradas y extrae para cada ticker su `Fecha de registro (dd/mm/yy)`, su `Precio entrada propuesto (USD)`, su `Stop Loss tecnico (USD)` y el valor de la columna `Invertido`.

2. **Reglas estrictas de exclusion para el escaneo del dia:**
   - **Regla 1 (Posicion abierta - `Invertido == "Si"`):** Si un ticker tiene en la columna `Invertido` el valor "Si" (o "SI", "si", "sí"), **OMITELO OBLIGATORIAMENTE** del escaneo.
   - **Regla 2 (Posicion no invertida - Antiguedad menor a 1 semana):** Si fue registrado hace 7 dias o menos (`<= 7 dias`), **OMITELO** para no repetir las mismas acciones en dias consecutivos.
   - **Regla 3 (Bloqueo de promediado a la baja en posiciones perdedoras):** Si un ticker ya fue recomendado en los ultimos 30 dias (`> 7 dias`) y su precio actual de mercado es **inferior al precio de entrada previo o rompio su Stop Loss previo**, **OMITELO** mientras cotice por debajo de su SMA 20 diaria. Solo podra reingresar si recupero su SMA 20 con volumen de acumulacion institucional (`RVol >= 1.25x` y `Closing Range >= 60%`).

### 2. Paso 0 - Termometro Macro, Volatilidad y Fuerza Relativa de ETFs Sectoriales (Enfoque Riesgo Medio-Alto)

Antes de seleccionar las 8+ acciones candidatas, evalua el flujo institucional de mercado en tiempo real mediante `google_finance:get_finance_entity_info` y `google:search`:

1. **Indices Directores y Volatilidad (`SPY`, `QQQ`, `IWM`, `VIX` y *Fear & Greed*):**
   - Consulta la cotizacion, variacion diaria y ubicacion respecto a medias moviles de **`SPY`**, **`QQQ`**, **`IWM`** y el indice de volatilidad **`VIX`**:
   - **Calibracion para Perfil de Riesgo Medio-Alto:**
     - **Entorno de Impulso (*Momentum / Risk-On* - `QQQ` y `SPY` sobre SMA 20 y `VIX < 18`):** Prioriza configuraciones de **ruptura de consolidaciones (*breakouts*)** y continuacion de tendencia en sectores de alto crecimiento y ciclicos, exigiendo `R:R >= 2.0 : 1`.
     - **Entorno Francotirador (*Contrarian Institucional* - `VIX` entre `18 y 25+` o salto diario `> +10%`, o `QQQ` bajo su SMA 20):** Exige entradas en **retroceso a soporte estructural (SMA 50 / SMA 200) o velas con mecha de absorcion institucional (*shakeout*)** y eleva la exigencia minima a **`R:R >= 2.5 : 1`**.

2. **Matriz de ETFs Sectoriales y Fuerza Relativa (`RS`):**
   - Consulta el desempeno de los ETFs sectoriales clave: **`XLK`**, **`SMH`**, **`XLV`**, **`XLY`**, **`XLF`**, **`XLI`**, **`XLC`**, **`XLP`**, **`XLU`** y **`XLB`**.
   - Identifica cuales sectores tienen **Fuerza Relativa positiva frente a `SPY`**.

### 3. Estrategia y Calculo del Precio o Valor Intrinseco (`Descuento Obligatorio >= 20%`)

Todo candidato evaluado en el **Paso 1 (SCAN)** debe ser sometido al analisis de **Precio vs. Valor Intrinseco**, exigiendo un **Margen de Seguridad (Descuento) `>= 20%`** respecto a su Valor Intrinseco para clasificar como elegible al Top 3:

1. **¿Que es la Estrategia de Valor Intrinseco con Margen de Seguridad `>= 20%`?**
   - El **Valor Intrinseco (`IV`)** es el valor economico real de un negocio estimado a partir de la capacidad de generacion de efectivo futura descontada al presente y de sus multiplos historicos normalizados.
   - Exigir un **descuento `>= 20%` bajo el Valor Intrinseco (`Ratio P/IV <= 0.80x`)** en un horizonte **swing a 3 meses** garantiza que el inversor compre negocios excelentes con un colchon fundamental de al menos 20% (un potencial de *re-rating* `>= +25%` desde el precio de compra hasta su valor justo), blindando la posicion contra compresiones de multiplos y alineando el `Target 1` y `Target 2` con la zona de Valor Intrinseco.

2. **Triada de Calculo del Valor Intrinseco (`IV`):**
   - **Metodo A — Flujo de Caja Libre Descontado en 2 Etapas (`DCF / Projected FCF`) y `GF Value™`:**
     - Consulta en fuentes Tier-2/Tier-1 (`GuruFocus DCF Earnings-Based`, `DCF FCF-Based`, `GF Value™`, `Morningstar Fair Value` o `StockAnalysis`) o calcula el valor presente de los flujos de caja libres proyectados a 5-10 anos mas el Valor Terminal descontados al costo promedio ponderado de capital (`WACC ~8.5%-10.5%`):
       $$\text{Valor Intrínseco DCF por Acción} = \frac{\sum_{t=1}^{5} \frac{\text{FCF}_t}{(1+\text{WACC})^t} + \frac{\text{FCF}_5 (1+g_{\perp})}{(\text{WACC}-g_{\perp})(1+\text{WACC})^5} + \text{Caja Total} - \text{Deuda Total}}{\text{Acciones Diluidas}}$$
   - **Metodo B — Valor Intrinseco por Multiplo Historico Normalizado (3 Anos) y Crecimiento (*Fair P/E Multiple*):**
     - Calcula el precio justo aplicando el `P/E Promedio de los ultimos 3 anos` (o multiplo justo ajustado por crecimiento y ROIC) sobre el `EPS Forward`:
       $$\text{Valor Intrínseco por Múltiplo} = \text{EPS}_{\text{Forward}} \times \text{P/E Justo Normalizado 3A}$$
   - **Metodo C — Formula de Benjamin Graham Revisada:**
     - Ajustada al rendimiento actual del bono corporativo AAA / Treasury 10Y (`Y`):
       $$\text{Valor Graham Ajustado} = \frac{\text{EPS}_{\text{TTM}} \times (8.5 + 2g) \times 4.4}{Y}$$
   - **Calculo del % de Descuento (Margen de Seguridad) y Ratio `P/IV`:**
     $$\text{Descuento vs. Valor Intrínseco (\%)} = \left(\frac{\text{Valor Intrínseco} - \text{Precio Actual}}{\text{Valor Intrínseco}}\right) \times 100, \qquad \text{Ratio P/IV} = \frac{\text{Precio Actual}}{\text{Valor Intrínseco}}$$

3. **Regla Estricta de Eleccion en el Paso 1 (SCAN): Descuento `>= 20%` (`Ratio P/IV <= 0.80x`):**
   - **PASA (Subvaluada con Margen de Seguridad `>= 20%` | `Ratio P/IV <= 0.80x`):** La accion cotiza al menos un **`20.0%` por debajo de su Valor Intrinseco** (`Descuento >= +20.0%`, equivalente a `Precio Actual <= 0.80 × Valor Intrinseco`). Solo las acciones que cumplan este umbral de **`>= 20%` de descuento** pueden ser seleccionadas en el **Top 3**.
   - **NO PASA / EN ESPERA DE PULLBACK (Descuento `< 20%` | `Ratio P/IV > 0.80x`):** Si el descuento frente al Valor Intrinseco es menor al `20%` (o si cotiza con prima sobre su Valor Intrinseco), la accion **NO PASA al Top 3** (se clasifica como `DESCARTADA / ESPERAR PULLBACK` indicando el precio exacto al cual alcanzaria el `20%` de descuento: `Precio Meta Entrada = 0.80 × Valor Intrinseco`).

### 4. Paso 1 - SCAN (Barrido de Minimo 8 Acciones con Descuento de Valor Intrinseco `>= 20%` y Huella Institucional)

Evalua y pasa un **minimo de 8 acciones** elegibles que merezcan investigacion para un horizonte **swing a 3 meses**:

1. **Indicadores fundamentales, Valor Intrinseco (`>= 20%` descuento) y huella institucional (sobre minimo 8 acciones):**
   - **Precio vs. Valor Intrinseco (`IV USD`, `% Descuento >= 20%` y `Ratio P/IV <= 0.80x`):** Reporta en la tabla del Paso 1 el Valor Intrinseco (`USD`), el porcentaje exacto de descuento (`%`) y el `Ratio P/IV`.
   - **Fuerza Relativa (`RS vs. ETF` y `RS vs. SPY`):** Compara la variacion de la accion frente a su ETF sectorial y frente a `SPY`.
   - **Huella de Dinero Institucional (*Smart Money Flow*):**
     - **Volumen Relativo Asimetrico (`RVol`):** Busca **`RVol >= 1.25x` en dias de subida** o **`RVol <= 0.85x` en retrocesos ordenados hacia soporte**.
     - **Rango de Cierre Intradia (*Closing Range* `CR %`):** Prioriza **`CR >= 60%`** y penaliza `CR < 30%`.
   - **Filtro de calidad fundamental y comparativa P/E:**
     - Deuda financiera / activos totales `< 0.50`.
     - Flujo de caja libre (FCF TTM) `> 0`.
     - `P/E actual` y `Forward P/E` comparados contra el **`P/E Promedio de los ultimos 3 anos`** y el **`P/E Promedio del Sector`**.

2. **Ranking, Regla de No-Clonacion Sectorial y Seleccion para el Paso 2:**
   - Ordena las acciones evaluadas priorizando aquellas que cumplan simultaneamente **Descuento de Valor Intrinseco `>= 20%` (`P/IV <= 0.80x`), respaldo de flujo institucional (`RS` + `RVol` + `CR %`) y solidez de la tesis a 3 meses**.
   - **Regla de No-Clonacion Sectorial en el Top 3:** Maximo 1 accion por subsector GICS en el Top 3 diario.

### 5. Paso 2 - ANALYZE (Analisis Tecnico y Convergencia con Valor Intrinseco)

Para cada accion del Top 3, evalua las 5 dimensiones observables e integra la lectura de **Precio vs. Valor Intrinseco (`Descuento >= 20%`)**:
- **1. Tendencia, Fuerza Relativa y Convergencia con Valor Intrinseco (`>= 20%` Descuento):** Posicion respecto a SMA 50 y SMA 200, distancia al ATH y descuento `>= 20%` respecto al **Valor Intrinseco (`IV`)**, verificando que el `Target 1` y `Target 2` capturen el recorrido de *re-rating* hacia dicho Valor Intrinseco.
- **2. Flujo Institucional (`RS`, `RVol` y `CR %`).**
- **3. Soporte Clave y Stop Loss.**
- **4. Resistencias y Targets (`R:R >= 2.5:1` o `>= 2.0:1` segun VIX).**
- **5. Regla de Gestion Dinamica (*Trailing Stop* a *breakeven* en Target 1 rumbo a Target 2).**

### 6. Generacion del PDF (`comparativo dd-mm-yy.pdf`) y Guardado en Google Drive

Genera el PDF con el nombre exacto **`comparativo dd-mm-yy.pdf`** en orientacion horizontal A4 de 2 paginas (formato estandar `Georgia`/`Arial`), incluyendo en la tabla del **Paso 1 (SCAN)** y del **Paso 2 (ANALYZE)** el **Valor Intrinseco (`IV`), el `% de Descuento (umbral obligatorio >= 20%)` y el `Ratio P/IV (<= 0.80x)`** de cada accion evaluada, muestralo con `google:show_file` y subelo a `Geminifinanzas/<mes-ano>`.

## Gotchas

- **Exige siempre `>= 20%` de descuento frente al Valor Intrinseco (`Ratio P/IV <= 0.80x`) para pasar al Top 3:** Ninguna accion con menos de 20% de descuento bajo su Valor Intrinseco puede ser seleccionada en el Top 3 diario.
- **Valida siempre Registro_Posiciones_Trading antes de escanear:** Omitir tickers con `Invertido == "Si"`, tickers con `<= 7 dias` de registro, y tickers en perdida bajo su SMA 20.
- **Maximo 1 accion por subsector en el Top 3 diario.**
