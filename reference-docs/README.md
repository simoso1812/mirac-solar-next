# Reference Docs

Drop source-of-truth files here so Claude can read them directly via the
`reference-docs` MCP server (configured in `.mcp.json`).

Good candidates:
- Excel/PDF financing models used to validate `lib/calculator/*` numbers
- Sample shared proposals (PDF exports) for reproducing dashboard math
- Spec sheets for inverters, panels, batteries, EV chargers
- DocuSeal contract templates

Notes:
- The MCP server exposes this folder read-only to Claude. Nothing outside
  `reference-docs/` is reachable through it.
- Large binaries are fine; Claude will only read what's asked for.
- This folder is local-only — see `.gitignore`.
