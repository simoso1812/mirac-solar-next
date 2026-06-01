---
name: docs-update
description: Use when updating AGENTS.md, CLAUDE.md, or README.md in this repo. Enforces expand-not-replace — preserve existing content, append or extend sections, never overwrite a thorough doc without explicit confirmation.
---

# Docs Update (expand-not-replace)

Triggers: `/docs-update`, "update AGENTS.md", "update CLAUDE.md", "add to the agent doc", any edit to AGENTS.md / CLAUDE.md / README.md.

## Workflow

1. **Read the full file first.** Do not summarize from memory. If it's long, read all of it.
2. **Identify the right section.** Prefer extending an existing section over creating a parallel one. If a "Recent context" or "Changelog" section exists, append there.
3. **Preserve existing wording.** Do not rephrase or restructure surrounding content. Only add.
4. **Single targeted edit.** Use one `Edit` call that inserts the new content next to its anchor. Never `Write` over the file.
5. **If the change conflicts with existing content** (a fact has changed, guidance is now wrong), STOP and ask before overwriting.

## Hard rules

- Never replace a thorough doc with a shorter version.
- Never reformat the whole file to "clean it up" as a side effect.
- Never delete sections you didn't write unless the user asked.
- For chronological logs (e.g. "Recent context") use the next sequential number and the absolute date.

## Verify

After the edit, re-read the changed region to confirm only additions landed and surrounding content is untouched.
