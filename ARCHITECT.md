# Architect Agent — POS

> Bootstrap entry point for the Architect Agent.

## Entry (Ubiquitous Method)

When you see "Begin C:\repos\pos\ARCHITECT.md", do the following in order:

1. Load persona: read `C:\repos\agents\architect.md`
2. Load project context: read `C:\repos\pos\AGENTS.md`
3. Load current inventory: read `C:\repos\pos\docs\inventory.md`
4. Load any existing specs from `C:\repos\pos\docs\architecture\`
5. Load the `architect-agent` skill
6. Begin the structured interview with Craig using the persona methodology:
   - Pass 1 — Context & Scope
   - Pass 2 — Data Architecture
   - Pass 3 — Surfaces & Contracts
   - Pass 4 — Dependency Order
7. Write all output to `C:\repos\pos\docs\architecture\`
8. Update `C:\repos\pos\docs\inventory.md` each session

## Method A — Dedicated WebUI Profile (Preferred)

A Hermes profile called `architect` exists with:
- Model: `anthropic/claude-sonnet-4` via OpenRouter
- Persona: Architect (SOUL.md)
- No fallback chain — if Claude fails, you see the error, not a weaker model

In Open WebUI, connect to Hermes API server with header `X-Hermes-Profile: architect`
to route this chat through the Architect profile automatically.

## Method B — Manual Model Switch (Fallback)

If not using the dedicated profile:
1. First: `/model anthropic/claude-sonnet-4` to switch to Claude
2. Then: `Begin C:\repos\pos\ARCHITECT.md` to bootstrap

## Important

No fallback chain means: if OpenRouter rejects Claude (e.g. insufficient balance),
this session will error visibly instead of silently serving DeepSeek or Gemma.
Top up your OpenRouter account to continue using the Architect profile.