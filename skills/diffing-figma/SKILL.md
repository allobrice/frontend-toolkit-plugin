---
name: diffing-figma
description: Compares a Figma node against its implemented frontend component (structure, spacing, tokens, states, responsive) and reports drift as a graded gap list. Read-only — it reports, it does not fix. Adapted from av-figma-diff. Invoke by name from a review flow, or manually via /diffing-figma.
disable-model-invocation: true
context: fork
agent: Explore        # Haiku, read-only. If Explore does not surface the Figma MCP server, switch to: agent: general-purpose
argument-hint: "[figma-node] [component-path]"
allowed-tools: >
  Read Glob Grep
  mcp__figma__get_design_context
  mcp__figma__get_variable_defs
# ↑ adjust the `figma` server slug to match this repo's Figma MCP configuration
---

You compare a Figma node ($ARGUMENTS[0]) against an implemented component ($ARGUMENTS[1]) and report the drift. You read only: list gaps, never edit the component or the design. Fixing is delegated by the caller to frontend-toolkit:vue-developer or frontend-toolkit:ui-engineer.

## Procedure
1. Obtain the Figma reference. Reuse the `reading-figma-context` output contract when the caller already produced it; otherwise pull it directly via `get_design_context` + `get_variable_defs`.
2. Read the implemented component at $ARGUMENTS[1] (template, style, props/variants).
3. Diff along each axis below. Compare **token to token**: a hard-coded value that matches the visual result but bypasses the DS token is a gap, not a match.

## Diff axes
Structure & hierarchy · spacing (padding / gap / margin) · tokens (color, typography, radius, shadow) · states & variants · responsive behaviour · visible accessibility affordances (focus order, labels) when present.

## Severity (P0–P3)
- **P0** — breaks the contract: wrong component structure, missing state, token that changes meaning (e.g. semantic color), broken responsive.
- **P1** — visible divergence a user would notice: wrong spacing scale, wrong type ramp, missing hover/focus.
- **P2** — token bypass with correct visual result (raw value instead of DS variable); minor spacing drift within one step.
- **P3** — cosmetic / non-functional nit.

## Fidelity grade (A–D)
- **A** — token-faithful, all states present, no P0/P1.
- **B** — minor drift: some P2, no P0/P1.
- **C** — noticeable drift: one or more P1, no P0.
- **D** — contract broken: at least one P0.

## Output contract — return exactly these blocks
**## Grade** — single A–D letter + one-line justification.
**## Gaps** — table `Axis | Expected (Figma) | Found (code) | Severity`, ordered P0 → P3.
**## Out of scope** — anything in the node not verifiable against code (assets, motion, …).

Report only. Do not propose or apply fixes.
