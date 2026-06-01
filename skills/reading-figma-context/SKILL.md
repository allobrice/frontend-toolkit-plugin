---
name: reading-figma-context
description: Distills a single Figma node into implementation-ready blocks (identity, layout, design tokens, states/variants, assets, code-connect, gaps). Read-only extraction step that feeds frontend implementation. Adapted from av-figma-context. Invoke by name from an implementation flow, or manually via /reading-figma-context.
disable-model-invocation: true
context: fork
agent: Explore        # Haiku, read-only — keeps the raw Figma payload out of the main context. If Explore does not surface the Figma MCP server, switch to: agent: general-purpose
argument-hint: "[figma-node-url-or-id]"
allowed-tools: >
  mcp__figma__get_design_context
  mcp__figma__get_screenshot
  mcp__figma__get_variable_defs
  mcp__figma__get_code_connect_map
# ↑ adjust the `figma` server slug to match this repo's Figma MCP configuration
---

You distill one Figma node into a compact, implementation-ready brief. You read only: never write code, never edit the design, never run audits.

Target node: $ARGUMENTS

## Procedure
1. Resolve the node from $ARGUMENTS (URL or node-id). If it is missing or unresolvable, return only a `## Gaps` block stating what is needed — do not guess a node.
2. Pull context with `get_design_context` (screenshot + reference code + variables). Add `get_variable_defs` for token resolution and `get_code_connect_map` to detect an existing code link. The raw payload stays in this fork; only the distilled brief below returns.
3. Resolve every visual value to a **design-system token** when one exists (color, type, spacing, radius, shadow). Surface a raw value only when no token matches, and flag it.

## Output contract — return exactly these blocks, in order
**## Identity** — node name, type, node-id, parent frame / page.
**## Layout** — container model (flex/grid), direction, gap, padding, alignment, sizing (hug/fill/fixed). Describe structure, not pixels narrated as prose.
**## Tokens** — resolved DS variables grouped by color / typography / spacing / radius / shadow. Mark any unresolved value `⚠ raw`.
**## States & variants** — default plus every present state (hover, focus, active, disabled) and responsive breakpoints. Omit the block if none exist.
**## Assets** — images/icons to export, with suggested name and format.
**## Code Connect** — linked code component if a mapping exists; otherwise `none`.
**## Gaps** — anything missing, ambiguous, or contradictory the implementer will need clarified. An empty list means the node is implementation-ready.

Keep each block terse. This brief is the only thing that leaves the fork: everything an implementer needs must be in it, and nothing they don't.
