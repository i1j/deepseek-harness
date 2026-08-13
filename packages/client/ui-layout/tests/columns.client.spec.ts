import { describe, expect, it } from 'vitest'
import {
  CENTER_MIN, clampWidth, computeColumns, resolveWideDock,
  DETAILS_DEFAULT, DETAILS_MIN, SIDEBAR_COLLAPSED, SIDEBAR_DEFAULT, SIDEBAR_MIN,
  WIDE_BREAKPOINT, WIDE_DOCK_MAX, WIDE_DOCK_MIN,
} from '@deepseek-ai/dsh-client-ui-layout/src/client/columns.ts'

// Numeric preference form (0 = closed); helpers keep the scenario names readable.
const open = (width: number) => width
const closed = (_width: number) => 0

describe('clampWidth', () => {
  it('clamps into the range and rounds', () => {
    expect(clampWidth(250.4, 240, 420)).toBe(250)
    expect(clampWidth(100, 240, 420)).toBe(240)
    expect(clampWidth(9999, 240, 420)).toBe(420)
  })
})

describe('computeColumns', () => {
  it('step 1: everything fits at preferred widths', () => {
    const cols = computeColumns(1920, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT))
    expect(cols).toEqual({ sidebar: 280, center: 1920 - 280 - 360, details: 360 })
  })

  it('closed sidebar keeps its compact rail while closed details contribute zero width', () => {
    expect(computeColumns(1920, closed(300), closed(360)))
      .toEqual({ sidebar: SIDEBAR_COLLAPSED, center: 1920 - SIDEBAR_COLLAPSED, details: 0 })
  })

  it('preferences beyond the clamp range are clamped before solving', () => {
    const cols = computeColumns(1920, open(9999), open(1))
    expect(cols.sidebar).toBe(420)
    expect(cols.details).toBe(300)
    expect(computeColumns(1920, open(1), open(DETAILS_DEFAULT)).sidebar).toBe(SIDEBAR_MIN)
  })

  it('step 2: details shrinks first, center pinned at min', () => {
    // 280 + 360 + 640 = 1280 > 1250; details concedes to 1250-280-640 = 330.
    const cols = computeColumns(1250, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT))
    expect(cols).toEqual({ sidebar: 280, center: CENTER_MIN, details: 330 })
  })

  it('boundary: exactly at the step-1/step-2 seam', () => {
    const cols = computeColumns(300 + 360 + CENTER_MIN, open(300), open(360))
    expect(cols).toEqual({ sidebar: 300, center: CENTER_MIN, details: 360 })
    const one = computeColumns(300 + 360 + CENTER_MIN - 1, open(300), open(360))
    expect(one).toEqual({ sidebar: 300, center: CENTER_MIN, details: 359 })
  })

  it('step 3: details auto-closes when its min still starves center — sidebar holds its preference', () => {
    // 280 + 300 + 640 = 1220 > 1210 → details 0; sidebar untouched: center = 1210-280 = 930.
    const cols = computeColumns(1210, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT))
    expect(cols).toEqual({ sidebar: 280, center: 930, details: 0 })
  })

  it('the sidebar never concedes: center absorbs the deficit below CENTER_MIN', () => {
    // 700 < 280+640: sidebar keeps 280, center takes 420 < CENTER_MIN.
    const cols = computeColumns(700, open(SIDEBAR_DEFAULT), closed(DETAILS_DEFAULT))
    expect(cols).toEqual({ sidebar: SIDEBAR_DEFAULT, center: 420, details: 0 })
  })

  it('sidebar-closed narrow window: details concedes then auto-closes', () => {
    const fits = computeColumns(SIDEBAR_COLLAPSED + DETAILS_MIN + CENTER_MIN, closed(300), open(DETAILS_DEFAULT))
    expect(fits).toEqual({ sidebar: SIDEBAR_COLLAPSED, center: CENTER_MIN, details: DETAILS_MIN })
    const starved = computeColumns(SIDEBAR_COLLAPSED + DETAILS_MIN + CENTER_MIN - 1, closed(300), open(DETAILS_DEFAULT))
    expect(starved).toEqual({
      sidebar: SIDEBAR_COLLAPSED,
      center: DETAILS_MIN + CENTER_MIN - 1,
      details: 0,
    })
  })

  it('tiny viewport: details closes, sidebar holds, center takes the remainder', () => {
    const cols = computeColumns(400, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT))
    expect(cols.details).toBe(0)
    expect(cols.sidebar).toBe(SIDEBAR_DEFAULT)
    expect(cols.center).toBe(Math.max(0, 400 - SIDEBAR_DEFAULT))
  })

  it('recovery is pure: re-widening restores preferred widths untouched', () => {
    const squeezed = computeColumns(1100, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT))
    expect(squeezed.details).toBe(0)
    const restored = computeColumns(1920, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT))
    expect(restored.details).toBe(DETAILS_DEFAULT)
    expect(restored.sidebar).toBe(SIDEBAR_DEFAULT)
  })
})

describe('computeColumns — degenerate viewports', () => {
  it('sidebar closed and viewport below CENTER_MIN: details auto-closes, center takes the rest', () => {
    // Reaches step 3's auto-close with the compact rail sidebar.
    expect(computeColumns(500, closed(300), open(DETAILS_DEFAULT)))
      .toEqual({ sidebar: SIDEBAR_COLLAPSED, center: 500 - SIDEBAR_COLLAPSED, details: 0 })
  })
})

describe('resolveWideDock', () => {
  it('below the breakpoint the dock never renders', () => {
    expect(resolveWideDock(WIDE_BREAKPOINT - 1, SIDEBAR_DEFAULT, true))
      .toEqual({ wide: false, dock: 0 })
    expect(resolveWideDock(1024, SIDEBAR_DEFAULT, true)).toEqual({ wide: false, dock: 0 })
  })

  it('without a real session the dock never renders', () => {
    expect(resolveWideDock(3440, SIDEBAR_DEFAULT, false)).toEqual({ wide: false, dock: 0 })
  })

  it('disabled by the layout setting the dock never renders', () => {
    expect(resolveWideDock(3440, SIDEBAR_DEFAULT, true, false)).toEqual({ wide: false, dock: 0 })
  })

  it('ultrawide: dock clamps into the contract and the conversation keeps >= 2/3', () => {
    // 3440/3 - 280 = 866.7 -> clamp to 640; center 3440-280-640 = 2520 >= 2293.
    expect(resolveWideDock(3440, SIDEBAR_DEFAULT, true)).toEqual({ wide: true, dock: WIDE_DOCK_MAX })
  })

  it('the 2/3 rule guards the dock: a wide sidebar on a smaller screen disables it', () => {
    // 1920/3 - 420 = 220 -> floor 320; center 1920-420-320 = 1180 < 1280 -> off.
    expect(resolveWideDock(1920, 420, true)).toEqual({ wide: false, dock: 0 })
  })

  it('boundary: the dock renders exactly when the 2/3 rule holds', () => {
    // 1920/3 - 280 = 360; center 1920-280-360 = 1280 == 2/3 of 1920.
    expect(resolveWideDock(1920, SIDEBAR_DEFAULT, true)).toEqual({ wide: true, dock: 360 })
  })

  it('at the breakpoint the dock floors at its minimum', () => {
    // 1800/3 - 280 = 320 -> floor; center 1800-280-320 = 1200 == 2/3 of 1800.
    expect(resolveWideDock(WIDE_BREAKPOINT, SIDEBAR_DEFAULT, true))
      .toEqual({ wide: true, dock: WIDE_DOCK_MIN })
  })

  it('a collapsed rail sidebar leaves more room for the dock', () => {
    // 3440/3 - 56 = 1090.7 -> clamp to 640 (unchanged); center keeps 2/3.
    expect(resolveWideDock(3440, SIDEBAR_COLLAPSED, true)).toEqual({ wide: true, dock: WIDE_DOCK_MAX })
  })
})
