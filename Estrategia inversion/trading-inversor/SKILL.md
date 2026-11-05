---
name: trading-inversor
description: Ejecuta el calculo de tamano de posicion con enfoque de Riesgo Medio-Alto para posiciones de 1% ($15 USD), 2% ($30 USD) y 3% ($45 USD) sobre una cuenta de $1,500 USD (Acciones = Valor de posicion / Precio de entrada), asigna el tramo recomendado ($45, $30 o $15 USD) segun la matriz de Conviccion Institucional (ETF sectorial, SPY/QQQ, VIX, RVol y Closing Range), define la regla de Trailing Stop a breakeven en Target 1 rumbo a Target 2, consolida las 3 posiciones en Registro_Posiciones_Trading y genera los 3 PDFs en Geminifinanzas/mes-ano.
allowed-tools: google_finance google default_api drive sheets_agent
---
# Trading Inversor (Enfoque Riesgo Medio-Alto y Conviccion Institucional)

Completa la fase final del flujo de investigacion bursatil integrando los hallazgos de los pasos previos (`MACRO/SECTOR`, `SCAN`, `ANALYZE`, `RESEARCH`, `RISK`), calcula el **numero de acciones o fracciones a comprar** para que el **valor total de la posicion a abrir sea exactamente de $15.00 USD (1%), $30.00 USD (2%) o $45.00 USD (3%)** sobre una cuenta de **$1,500 USD**, determina el **tramo recomendado ($45, $30 o $15 USD)** segun la alineacion institucional de cada candidato, aplica la gestion de salida con **Trailing Stop a breakeven al alcanzar Target 1 para capturar Target 2**, consolida las 3 posiciones diarias en **`Registro_Posiciones_Trading`** en la raiz de **`Geminifinanzas`**, y genera el documento PDF **`plan de inversion {TICKER} dd-mm-yy.pdf`** en `Geminifinanzas/<mes-ano>`.

## When to Use

- El usuario pide generar el plan de inversion o plan de trading (Paso 5) para uno o varios tickers.
- El usuario solicita calcular cuantas acciones o fracciones comprar para abrir posiciones con valores fijos de $15, $30 o $45 USD (1%, 2% y 3% del capital de una cuenta de $1,500 USD).
- El usuario o el flujo `jefe-inversor` invoca la habilidad `trading-inversor` para consolidar las posiciones del dia en `Registro_Posiciones_Trading` y generar las hojas de ruta ejecutables en PDF sujetas a revision humana.

## Steps

### 1. Recopilacion de Insumos, Parametros de Cuenta y Matriz de Conviccion Institucional (Riesgo Medio-Alto)

1. **Parametros de capital y valores fijos de posicion:**
   - La cuenta de referencia tiene un saldo total de **$1,500 USD**.
   - Los 3 escenarios de asignacion corresponden a destinar el **1%, 2% y 3% del capital total de la cuenta como valor total de la posicion a abrir** (permitiendo fracciones de acciones):
     - **Escenario 1%:** Valor total de la posicion a abrir = **`$15.00 USD`**.
     - **Escenario 2%:** Valor total de la posicion a abrir = **`$30.00 USD`**.
     - **Escenario 3%:** Valor total de la posicion a abrir = **`$45.00 USD`**.

2. **Regla de Asignacion de Conviccion Institucional ($45 / $30 / $15 USD) para Perfil Riesgo Medio-Alto:**
   - Aunque la tabla del PDF y el registro en Google Sheets calculan siempre los 3 escenarios (`$15`, `$30` y `$45 USD`), debes recomendar explicitamente en cada Plan de Inversion cual es el **Tramo Sugerido** segun la alineacion institucional:
     - **Tramo 3% (`$45.00 USD` - Conviccion Alta / Triple Alineacion):** Reservado para la accion #1 del dia que combina: (a) Filtro fundamental superado, (b) ETF sectorial con Fuerza Relativa positiva frente a `SPY` (o divergencia alcista clara), y (c) Huella de acumulacion institucional (`RVol >= 1.25x` y `Closing Range CR >= 60%`).
     - **Tramo 2% (`$30.00 USD` - Conviccion Media-Alta):** Accion #2 del dia con solidez fundamental, Fuerza Relativa positiva frente a su ETF sectorial y `R:R >= 2.2 : 1`.
     - **Tramo 1% (`$15.00 USD` - Tactica / Francotirador Contrarian):** Accion #3 del dia o jugada agresiva de alto *beta* comprando en *pullback* sobre soporte estructural (SMA 50 / SMA 200) durante picos de volatilidad (`VIX >= 18`), exigiendo **`R:R >= 2.5 : 1`**.

3. **Integracion de los Pasos 0 a 4 (Drive + Tiempo Real):**
   - Busca primero en Google Drive (`drive:search_files`) dentro de `Geminifinanzas/<mes-ano>` si ya existen el informe `{TICKER}_analysis_dd-mm-yy.html` o `comparativo dd-mm-yy.pdf`.
   - Consulta siempre el precio actual de mercado, rango intradia (`CR %`), ETF sectorial, `SPY`/`QQQ`/`VIX`, soportes, resistencias y proxima fecha de resultados en tiempo real mediante `google_finance:get_finance_entity_info`, `google:search` y `google:browse`.
   - **Regla de oro:** No inventes ningun precio, cifra, fecha ni titular. Cualquier dato no disponible debe figurar literalmente como `NOT PROVIDED - verify manually`. Separa siempre los `HECHOS` (con fuente y fecha) de la `OPINION`.

### 2. Calculo Matematico del Numero de Acciones, R:R y Regla de Trailing Stop

1. **Definicion de niveles operativos y gestion asimetrica de salida:**
   - **Precio de Entrada (Entry):** Precio actual de mercado (si `QQQ`/`SPY` estan en impulso y el `R:R` cumple) o nivel exacto de retroceso (*pullback* limite) hacia soporte si el precio actual no ofrece el ratio `R:R` requerido o si el `VIX >= 18` exige entrada francotirador.
   - **Stop Loss Tecnico Inicial (Stop):** Precio exacto bajo soporte donde la tesis queda invalidada (tipicamente entre `-4%` y `-5.5%` desde la entrada).
   - **Objetivos y Regla de *Trailing Stop* (Asimetria Riesgo Medio-Alto):**
     - **Target 1 (Resistencia inmediata / +7% a +11%):** Al tocar Target 1, **NO se cierra toda la posicion prematuramente**; se activa el **Trailing Stop subiendo el Stop Loss al precio de entrada (*Breakeven* = 0% perdida)** (o tomando ganancia parcial del 30%-50% y dejando correr el resto sin riesgo).
     - **Target 2 (Expansion de tendencia / +12% a +20%+):** Objetivo principal para capturar los movimientos de alto *alpha* (como expansiones de +14% a +20% en 3 meses).

2. **Formula Matematica del Numero de Acciones / Fracciones:**
   - Para cada uno de los 3 valores de posicion (`$15.00`, `$30.00` y `$45.00 USD`):
     - **Valor de la posicion a abrir ($):** Fijo en `$15.00 USD` (1%), `$30.00 USD` (2%) o `$45.00 USD` (3%).
     - **Numero de acciones o fracciones:**  
       `Acciones = Valor de la Posicion ($) / Precio de Entrada ($)`.
     - **Riesgo monetario maximo si salta el Stop Loss inicial ($):**  
       `Riesgo Stop ($) = Acciones * (Precio de Entrada - Stop Loss)`.
     - **Beneficio potencial en Target 1 ($):**  
       `Beneficio T1 ($) = Acciones * (Target 1 - Precio de Entrada)`.
     - **Beneficio potencial en Target 2 ($):**  
       `Beneficio T2 ($) = Acciones * (Target 2 - Precio de Entrada)`.

3. **Evaluacion de Viabilidad y Relacion Riesgo / Beneficio (R:R):**
   - Calcula `R:R a T1 = (Target 1 - Precio de Entrada) / (Precio de Entrada - Stop Loss)` y `R:R a T2 = (Target 2 - Precio de Entrada) / (Precio de Entrada - Stop Loss)`.
   - **Filtro obligatorio R:R:** Exige `R:R >= 2.0 : 1` hacia Target 1 en condiciones normales (`VIX < 18`) y **`R:R >= 2.5 : 1`** cuando `VIX >= 18` o en jugadas *contrarian* de alto *beta*. Si al precio actual es menor, declara que **NO se entra a mercado** y fija como `Precio de Entrada Propuesto` el nivel exacto de *pullback* donde se cumple el ratio.

### 3. Registro Consolidado en Google Sheets (`Registro_Posiciones_Trading`)

El Agente 3 consolida diariamente las posiciones de las 3 acciones seleccionadas en una unica hoja de calculo ubicada directamente en la raiz de `Geminifinanzas` (fuera de las subcarpetas `mes-ano`):

1. **Ubicacion y verificacion del archivo:**
   - Busca en Google Drive (`drive:search_files`) el archivo con titulo exacto **`Registro_Posiciones_Trading`** dentro de la carpeta `Geminifinanzas`.
   - Si ya existe, agrega las 3 nuevas filas de la sesion conservando el historico.

2. **Columnas obligatorias de la hoja:**
   - `Fecha de registro (dd/mm/yy)`
   - `Ticker`
   - `Precio entrada propuesto (USD)`
   - `Stop Loss tecnico (USD)`
   - `Target 1 (USD)`
   - `Target 2 (USD)`
   - `Ratio R:R`
   - `Posicion 1% ($15) - Acciones`
   - `Posicion 1% ($15) - Valor Posicion (USD)` (Siempre `$15.00`)
   - `Posicion 2% ($30) - Acciones`
   - `Posicion 2% ($30) - Valor Posicion (USD)` (Siempre `$30.00`)
   - `Posicion 3% ($45) - Acciones`
   - `Posicion 3% ($45) - Valor Posicion (USD)` (Siempre `$45.00`)
   - `Invertido` (Valor por defecto "No" o pendiente; aqui el usuario registrara "Si" o "No")
   - `Valor final posicion (USD)` (Monto sugerido segun conviccion `$15.00`, `$30.00` o `$45.00` o pendiente de confirmacion por el usuario)

### 4. Consolidacion de la Plantilla del Plan de Inversion (Paso 5 - PLAN)

Estructura el contenido siguiendo exactamente los bloques del **Trade-Plan Template** del metodo, disenado para caber de forma ejecutiva y legible en el PDF:

- **ENCABEZADO:** `PLAN DE INVERSION (RIESGO MEDIO-ALTO) - [TICKER] - [FECHA dd-mm-yy]`
- **1. TESIS E IMPULSO SECTORIAL (THESIS & SECTOR FLOW):** Resumen de la idea en una oracion, incluyendo el estado de su ETF sectorial vs. `SPY`, lectura del `VIX` y huella institucional (`RVol` y `CR %`).
- **2. DIRECCION, TACTICA Y TRAMO RECOMENDADO (DIRECTION, TACTIC & CONVICTION TIER):** Direccion (`Long Breakout` vs. `Long Francotirador en Pullback`), horizonte (`Swing 3 meses`) y **Tramo Sugerido (`$45 USD [3% - Alta Conviccion]`, `$30 USD [2% - Media-Alta]` o `$15 USD [1% - Tactica Contrarian]`)**.
- **3. ENTRADA (ENTRY - precio o condicion):** Precio actual verificado y condicion exacta de activacion.
- **4. STOP LOSS (STOP - precio + motivo):** Precio exacto del stop inicial y justificacion tecnica basada en soporte.
- **5. OBJETIVOS Y REGLA DE TRAILING STOP (TARGET 1 / TARGET 2 & TRAILING STOP):** Precios de Target 1 y Target 2, especificando la regla de **subir Stop Loss a Breakeven ($Entrada) al alcanzar Target 1 para buscar Target 2 (+12% a +20%)**.
- **6. MATRIZ DE TAMANO DE POSICION (VALOR POSICION $15, $30 Y $45 USD):** Tabla comparativa mostrando para cada escenario (`$15.00`, `$30.00` y `$45.00 USD`): Valor de la posicion, Acciones/Fracciones compradas (`Valor / Precio Entrada`), Riesgo en Stop ($), Beneficio Potencial en Target 1 ($) y Beneficio Potencial en Target 2 ($), resaltando la fila del **Tramo Recomendado**.
- **7. RIESGO / BENEFICIO (RISK / REWARD):** Ratio `___ : 1` hacia Target 1 y `___ : 1` hacia Target 2, con veredicto (`Favorable / Even / Poor`).
- **8. INVALIDACION (INVALIDATION - 3 gatillos):**
  1. Nivel de cierre diario o semanal que anula la estructura o rompe el soporte con `RVol > 1.5x`.
  2. Riesgo de fecha de resultados (earnings) o deterioro brusco de su ETF sectorial.
  3. Evento fundamental o noticia que cancela la tesis.
- **9. FECHAS CLAVE (KEY DATES):** Fecha del proximo reporte de resultados (Next Earnings Date) y catalizadores a 60-90 dias.
- **10. DONDE DISCREPAN EL GRAFICO Y LA INVESTIGACION (WHERE CHART AND RESEARCH DISAGREE):** Contraste directo entre lectura tecnica/sectorial y fundamentales, incluyendo el **Supuesto Mas Debil (Weakest Assumption)**.
- **11. CONFIANZA (CONFIDENCE):** `Low / Medium / High` indicando que hecho concreto la cambiaria.
- **12. NUMEROS A VERIFICAR ANTES DE ACTUAR (NUMBERS TO VERIFY BEFORE ACTING):** Lista de datos puntuales a comprobar manualmente en el broker.
- **13. ESTADO DE REVISION HUMANA:** `STATUS: AWAITING HUMAN REVIEW - [ ] Revisado  [ ] Aprobado  [ ] Rechazado`.

### 5. Generacion del PDF (`plan de inversion {TICKER} dd-mm-yy.pdf`) y Archivo en Google Drive

1. **Maquetacion y compilacion del PDF:**
   - Genera un archivo HTML con codificacion UTF-8 y compilalo a PDF en `/working_dir/<conversation_id>/artifacts/file_generation/ttl=63d/output/plan de inversion {TICKER} dd-mm-yy.pdf` usando `weasyprint` o `compile_and_render.py` mediante `execute_bash`.
   - Disena el PDF en formato `A4 portrait` con margenes de `12mm`:
     - Cabecera destacada con tarjetas para **ENTRADA ($)**, **STOP LOSS ($)**, **TARGET 1 -> BREAKEVEN ($)**, **TARGET 2 ($)** y **R:R (X.X : 1)**.
     - **Tabla de Matriz de Posicion ($15, $30 y $45 USD)** incluyendo columna de Beneficio en Target 1 y Target 2 y destacando el Tramo Recomendado segun conviccion institucional.
     - Tabla estructurada con todos los campos del **Trade-Plan Template** diferenciando `HECHOS` y `OPINION`.
     - Recuadro inferior con `[ ] Revisado  [ ] Aprobado  [ ] Rechazado` y `STATUS: AWAITING HUMAN REVIEW`.

2. **Guardado obligatorio en Google Drive (`Geminifinanzas/<mes-ano>`):**
   - Sube el archivo PDF generado con el nombre exacto **`plan de inversion {TICKER} dd-mm-yy.pdf`** en `Geminifinanzas/<mes-ano>`.
   - Muestra el archivo PDF en el chat con `google:show_file` y entrega los enlaces directos al PDF en Google Drive, a la hoja consolidada `Registro_Posiciones_Trading` y a la carpeta `mes-ano`.

## Gotchas

- **El valor total de la posicion es $15, $30 o $45 USD:** El numero de acciones se calcula dividiendo ese monto entre el precio de entrada (`Acciones = Valor / Entrada`).
- **Hoja unica de registro en la raiz:** `Registro_Posiciones_Trading` debe ubicarse directamente dentro de `Geminifinanzas` y no dentro de las carpetas mensuales.
- **Asimetria Riesgo Medio-Alto:** Incluye siempre tanto el Beneficio en Target 1 (donde el Stop sube a Breakeven) como el Beneficio en Target 2 en la matriz de posicion.
