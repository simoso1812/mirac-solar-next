# mirac-solar-quote (Cowork skill)

Agent Skill que hace que Claude use el conector MCP **Calculadora Solar Mirac**
cada vez que pides cotizar un sistema solar para Mirac. El cálculo lo hacen las
herramientas MCP (`quote_solar_system`, `create_quotation_link`,
`estimate_price`); la skill solo enseña a Claude cuándo y cómo usarlas.

## Requisito previo

El conector **Calculadora Solar Mirac** debe estar agregado en Claude
(Settings → Connectors → Custom connector) apuntando a:

```
https://mirac-solar-next.vercel.app/api/mcp?key=<TU_MCP_AUTH_TOKEN>
```

La skill no funciona sin el conector: ella indica las herramientas, el conector
las provee.

## Cómo subir la skill a Claude / Cowork

1. Comprime la carpeta `mirac-solar-quote/` en un `.zip` (debe contener
   `SKILL.md` en la raíz del zip).
2. En Claude: **Settings → Capabilities → Skills → Upload skill** (o
   "Crear skill") y sube el `.zip`.
3. Activa la skill. A partir de ahí, cuando pidas una cotización solar de Mirac,
   Claude cargará esta skill y usará el conector automáticamente.

## Cómo se dispara

Frases como: "cotiza una casa de 500 kWh/mes en Medellín", "necesito una
propuesta solar para un cliente", "genera un link de cotización", "¿cuánto vale
un sistema de 10 kWp?".

## Probar

> "Cotiza 600 kWh/mes en Cali, net billing, con batería de 10 kWh."

Claude debe llamar a `quote_solar_system` (o `create_quotation_link` si pides un
link) y devolver las cifras reales del calculador.
