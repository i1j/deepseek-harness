# Agent Note: Ultrawide dock with text-only chat mode

Status: implemented

English | [中文](2026-08-14-ultrawide-dock-text-only-chat.zh.md)

## Problem

On ultrawide viewports (≥1800px, e.g. the 3440×1440 display that motivated this work) the classic three-column shell — sidebar | conversation | details — wastes most of the horizontal space: the transcript stays at its fixed 748px measure inside wide empty gutters, and the conversation column mixes prose with inline tool cards and inline reasoning, so a long agent run reads as a dense, hard-to-scan wall. Nothing let the layout spend the extra width on what matters: a conversation that keeps its reading measure, plus a surface where think and tool activity are inspectable without pushing the prose around.

## Decision

**The frame solves a wide-dock track instead of the details column.** ui-layout's `resolveWideDock` activates at ≥1800px with a real session and the switch on: the dock width clamps into [320, 640]px (`viewport/3 − sidebar`), committing only while the conversation keeps ≥2/3 of the viewport. `AppFrame` renders the new `wide.dock` list slot (declared by the frame, `session` scope) in place of the details column and passes the resolved state to the conversation as an owner prop.

**The dock is one occupant from ui-conversation.** `WideDock` rides `slots.inject('wide.dock')` into the frame's list seat: a details pane on top (live Think with paged "write-down, push-up" auto-scroll; a clicked row's detail; ✕ returns to live) and a collapsible per-turn tool timeline below (compact = last turn only; expanded = every turn title).

**While wide, the conversation runs text-only.** `ChatView` filters tool-call nodes from the render order (they stay in the snapshot for the dock to read), `AssistantMarkdown` drops reasoning via `hideReasoning`, user bubbles go full-width, and the transcript measure widens to `min(1360px, calc(100% - 64px))`. The same PR makes chat markdown micro-typography token-driven (inline code takes the shiki keyword hue, blockquotes a brand accent edge, h6 and table heads step down), so it re-skins with every theme.

**The switch is durable.** `ui-layout.wideDock` (default on) persists through the Host settings scope and gains a General settings row (`WideDockRow`, order 30). The wide state flows down the slot chain as an optional owner prop via `exactOptionalPropertyTypes`-safe conditional spreads, so classic-layout owners never receive an explicit `undefined`.

## Alternatives considered

**Unconditional text-only chat.** Rejected: hiding tool rows and reasoning without a dock to host them would remove information, not reorganize it.

**A drag-resizable dock.** Rejected: the width is a solved contract ([320, 640]px plus the 2/3 rule), and drag-resizable side panels already exist in the details column.

**Keeping tool rows in the flow with a duplicate timeline.** Rejected: the text-only flow is the point — the dock timeline replaces the inline cards rather than doubling them.

## Consequences

Narrow and sub-1800px viewports are unchanged; the dock also requires a non-blank session and the 2/3 rule (a very wide sidebar disables it). In wide mode the details column unmounts, so Inspect-style opens stay inert by design — the dock panes own selection. Non-participating occupants (ui-tool, ui-trajectory, ui-workflow-run) receive an absent `wideDock` and keep the classic layout. Tool rows leave the transcript on ultrawide screens; the work-in-progress surface moves to the dock's timeline.
