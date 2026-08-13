/**
 * Pure concession-chain column solver for the three-column AppFrame.
 * Chain order is fixed by contract: keep center >= CENTER_MIN by shrinking
 * details, then auto-closing it (derived zero width — preferred width
 * preferences are never rewritten, so widening the window restores them).
 * The sidebar never concedes: its rendered width is always the drag
 * preference (or the collapsed rail), and center absorbs any remaining
 * deficit as the last resort. Inputs are the layout store's plain width
 * preferences (0 = closed); a closed sidebar resolves to the fixed
 * SIDEBAR_COLLAPSED control rail while closed details resolve to zero width.
 * The SIDEBAR_AUTO_COLLAPSE breakpoint is consumed by AppFrame, which decides
 * the effective sidebar preference before solving; the solver itself stays
 * breakpoint-free.
 */

/** Resolved widths for one frame; center may drop below CENTER_MIN only at the final fallback. */
export interface Columns { sidebar: number; center: number; details: number }

// Contract-frozen geometry: the three-column concession chain's fixed points.
/** Center column floor; only the final fallback may go below it. */
export const CENTER_MIN = 640
/** Sidebar drag clamp floor. */
export const SIDEBAR_MIN = 264
/** Sidebar drag clamp ceiling. */
export const SIDEBAR_MAX = 420
/** Sidebar width before any user drag. */
export const SIDEBAR_DEFAULT = 280
/** Closed-sidebar rail: a 24px icon column between 16px horizontal paddings. */
export const SIDEBAR_COLLAPSED = 56
/** Viewport width below which the sidebar auto-collapses to the rail (deepsuite
 * LG breakpoint); a manual toggle below it re-expands over the squeezed center
 * (stores.ts narrowExpanded). */
export const SIDEBAR_AUTO_COLLAPSE = 1024
/** Details drag clamp floor. */
export const DETAILS_MIN = 300
/** Details drag clamp ceiling. */
export const DETAILS_MAX = 520
/** Details width before any user drag. */
export const DETAILS_DEFAULT = 360

/**
 * Ultrawide dock: viewport width at/above which the shell reserves a right
 * dock column (think + tool timeline panes) in addition to the classic
 * sidebar | center | details tracks. Sized so the conversation column keeps
 * at least 2/3 of the viewport (the ultrawide ergonomics contract).
 */
export const WIDE_BREAKPOINT = 1800
/** Dock width contract: [320, 640]px, clamped into the leftover of a 2/3
 * conversation column (viewport/3 minus the sidebar). */
export const WIDE_DOCK_MIN = 320
/** Dock width contract ceiling. */
export const WIDE_DOCK_MAX = 640

/** Resolved wide-dock geometry for one frame. */
export interface WideDockResolution {
  /** Whether the dock column is rendered this frame. */
  wide: boolean
  /** Rendered dock width in px (0 when not wide). */
  dock: number
}

/**
 * Resolve whether the ultrawide dock column renders and its width. The dock
 * may take at most `viewport/3 - sidebar` so the conversation column keeps
 * >= 2/3 of the viewport; it is disabled entirely when that would break the
 * 2/3 rule (a very wide sidebar on a smaller screen) or when no real session
 * is current (the dock panes are session-bound) or the feature is disabled.
 * Pure: the output is a function of the inputs only.
 * @param viewport - available frame width in px.
 * @param sidebarPx - the sidebar's rendered width in px (rail when collapsed).
 * @param hasSession - whether a non-blank session is current.
 * @param enabled - whether the wide dock is enabled by the layout setting.
 * @returns the resolved wide flag and dock width.
 */
export function resolveWideDock(
  viewport: number,
  sidebarPx: number,
  hasSession: boolean,
  enabled = true,
): WideDockResolution {
  if (!enabled || !hasSession || viewport < WIDE_BREAKPOINT) return { wide: false, dock: 0 }
  const dockCandidate = Math.min(WIDE_DOCK_MAX, Math.max(WIDE_DOCK_MIN, Math.round(viewport / 3 - sidebarPx)))
  const wide = viewport - sidebarPx - dockCandidate >= Math.round((viewport * 2) / 3)
  return wide ? { wide: true, dock: dockCandidate } : { wide: false, dock: 0 }
}

/**
 * Clamp a panel width into its contract range.
 * @param px - requested width.
 * @param min - range lower bound.
 * @param max - range upper bound.
 * @returns the clamped width.
 */
export function clampWidth(px: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(px)))
}

/**
 * Solve the three column widths for one viewport frame. Pure: no hysteresis —
 * the output is a function of (viewport, preferences) only, so recovery on
 * re-widening is automatic. Preferences re-clamp here because they cross the
 * store boundary and callers may still supply stale ranges.
 * @param viewport - available frame width in px.
 * @param sidebar - sidebar width preference in px (0 = closed).
 * @param details - details width preference in px (0 = closed).
 * @returns resolved widths; details 0 means visually closed (never unmounted), while a closed sidebar keeps its compact rail.
 */
export function computeColumns(viewport: number, sidebar: number, details: number): Columns {
  // The sidebar is fixed at its preference (or the rail) — it never concedes.
  const s = sidebar === 0 ? SIDEBAR_COLLAPSED : clampWidth(sidebar, SIDEBAR_MIN, SIDEBAR_MAX)
  const d0 = details === 0 ? 0 : clampWidth(details, DETAILS_MIN, DETAILS_MAX)

  // Step 1: everything fits at preferred widths.
  if (s + d0 + CENTER_MIN <= viewport) return { sidebar: s, center: viewport - s - d0, details: d0 }

  // Step 2: shrink details toward its minimum.
  const d1 = d0 === 0 ? 0 : Math.max(DETAILS_MIN, viewport - s - CENTER_MIN)
  if (s + d1 + CENTER_MIN <= viewport) return { sidebar: s, center: CENTER_MIN, details: d1 }

  // Step 3: auto-close details (derived — preferences untouched); center
  // absorbs any remaining deficit (may drop below CENTER_MIN).
  return { sidebar: s, center: Math.max(0, viewport - s), details: 0 }
}
