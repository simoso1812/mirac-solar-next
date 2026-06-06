---
name: mirac-solar-quote
description: >-
  Cotiza sistemas solares fotovoltaicos para Mirac Energy (Colombia) usando las
  herramientas del conector MCP "Calculadora Solar Mirac". Úsala siempre que el
  usuario pida dimensionar, cotizar o crear una propuesta de energía solar para
  un cliente — por ejemplo "cotiza una casa de 500 kWh/mes en Medellín",
  "necesito una propuesta solar para un cliente", "cuánto cuesta un sistema de
  10 kWp", o "genera un link de cotización". Nunca inventa cifras: todas las
  cifras vienen de las herramientas MCP.
---

# Cotización solar Mirac

Skill para generar cotizaciones de sistemas solares fotovoltaicos de **Mirac
Energy** (mercado: Colombia, moneda: COP). El cálculo real lo hacen las
herramientas del conector **Calculadora Solar Mirac** (MCP). Esta skill define
cómo recolectar los datos, qué herramienta usar y cómo presentar el resultado.

## Regla de oro

**Nunca calcules ni estimes cifras por tu cuenta.** Potencia, paneles, precio,
ahorro, TIR, VPN, payback y CO2 siempre provienen de las herramientas MCP. Si el
conector no responde, dilo claramente y no improvises números.

## Herramientas disponibles (conector "Calculadora Solar Mirac")

1. **`quote_solar_system`** — cotización completa (solo cifras). Devuelve
   tamaño del sistema, generación, inversión, ahorro, payback, TIR, VPN, ROI y
   CO2. Úsala cuando el usuario quiere los números.
2. **`create_quotation_link`** — genera una **propuesta virtual con link
   público `/s/<id>`** que el cliente abre, descarga en PDF y firma. Úsala
   cuando el usuario pide un link, una propuesta para enviar al cliente, o una
   cotización compartible. Requiere además `cliente_nombre`.
3. **`estimate_price`** — precio rápido (CAPEX) a partir del tamaño en `kwp`.
   Úsala solo cuando ya se conoce el tamaño y se quiere un precio aproximado.

## Cómo decidir qué herramienta usar

- Pide "cuánto cuesta", "cotiza", "dimensiona", "qué sistema necesita" →
  **`quote_solar_system`**.
- Pide "un link", "una propuesta", "algo para enviarle al cliente", "cotización
  para firmar" → **`create_quotation_link`** (pregunta el nombre del cliente si
  no lo dio).
- Da directamente un tamaño en kWp y solo quiere el precio →
  **`estimate_price`**.

Cuando haya duda entre números o link, ofrece ambos: primero corre
`quote_solar_system`, muestra las cifras, y pregunta si quiere generar el link.

## Datos a recolectar

**Mínimo indispensable:** `consumo_mensual_kwh` (de la factura) y `ciudad`.

Si falta el consumo, pregúntalo (es el dato más importante). Si falta la ciudad,
asume contexto pero confírmala. Ciudades soportadas (usa el valor exacto):
`MEDELLIN`, `BOGOTA`, `CALI`, `BARRANQUILLA`, `BUCARAMANGA`, `CARTAGENA`,
`PEREIRA`. Otras ciudades caen por defecto a la radiación de Medellín — avísalo.

**Parámetros opcionales** (omítelos si el usuario no los menciona; las
herramientas tienen valores por defecto sensatos):

| Parámetro | Default | Notas |
|---|---|---|
| `costo_kwh` | 850 | Tarifa COP/kWh del cliente. Pregúntala si la sabe; mejora la precisión. |
| `modo_conexion` | `net_metering` | `net_metering` (excedentes 1:1), `net_billing` (excedentes a `precio_excedentes`, default 300), `autoconsumo` (sin crédito). |
| `clima` | `templado` | `templado`, `calido`, `frio`. |
| `cubierta` | `metalica` | `metalica`, `teja` (sobrecosto), `losa`. |
| `incluir_baterias` | false | Si true, opcional `bateria_capacidad_kwh` y `bateria_horas_autonomia` (48). |
| `financiamiento_porcentaje` | 0 | % del CAPEX a crédito. Con crédito: `financiamiento_tasa_ea` (Tasa Efectiva Anual, ej 0.15 = 15%) y `financiamiento_plazo_anios` (5). |
| `beneficio_deduccion_renta` / `beneficio_depreciacion_acelerada` | false | Beneficios tributarios Ley 1715. |

Para `create_quotation_link`, además: `cliente_nombre` (requerido), y opcionales
`cliente_direccion`, `cliente_email`, `cliente_telefono`, `cliente_cedula`.

No abrumes al usuario preguntando los 15 parámetros. Pide lo mínimo, corre la
herramienta con defaults, y ofrece ajustar (batería, financiamiento, beneficios)
después.

## Cómo presentar el resultado

- Responde en **español**, tono profesional y cercano (cliente colombiano).
- Formatea valores en **COP** (ej. `$25.323.900`).
- Resalta las cifras clave: tamaño (kWp + paneles), inversión total, ahorro
  anual/mensual, payback y TIR.
- **TIR y ROI ya vienen como porcentaje** desde la herramienta: muéstralos tal
  cual (ej. "TIR 24,0%"); no los vuelvas a multiplicar ni recalcular.
- Si generaste un link con `create_quotation_link`, ponlo **al principio y
  visible**, y aclara que es válido 90 días y que el cliente puede ver,
  descargar el PDF y firmar.

## Ejemplos

**Solo cifras:**
> Usuario: "Cotiza una casa en Medellín, 500 kWh al mes."
> → `quote_solar_system` con `consumo_mensual_kwh: 500`, `ciudad: "MEDELLIN"`.
> Presenta el resumen y ofrece generar el link.

**Propuesta con link:**
> Usuario: "Hazme una propuesta para Juan Pérez, 700 kWh/mes en Bogotá, con
> financiación del 60%."
> → `create_quotation_link` con `cliente_nombre: "Juan Pérez"`,
> `consumo_mensual_kwh: 700`, `ciudad: "BOGOTA"`, `financiamiento_porcentaje: 60`.
> Entrega el link primero, luego el resumen de cifras.

**Precio por tamaño:**
> Usuario: "¿Cuánto vale un sistema de 10 kWp?"
> → `estimate_price` con `kwp: 10`.
