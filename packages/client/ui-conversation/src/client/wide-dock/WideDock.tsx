/**
 * Ultrawide dock panes for the dsh-client-ui-layout "wide.dock" slot
 * (viewports >= WIDE_BREAKPOINT), rendered as ONE occupant so the two panes
 * share selection state:
 *   - details pane (top, capped to 2/3): shows the clicked timeline card's
 *     detail; defaults to the live Think while a turn is generating
 *     (paged "write-down, push-up" auto-scroll: the pane stays still while
 *     the next page streams in, then pushes up by nearly a full pane,
 *     keeping the last ~3 lines of the previous page at the top).
 *   - timeline pane (bottom): triangle collapses to a compact view showing
 *     ONLY the last turn's timeline (other turns hidden, titles too);
 *     expanding shows every turn title with its timeline collapsed by
 *     default — click a title to expand that turn's timeline.
 * Summary-first: rows are small (icon + name + preview), click for detail.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  IconApiOutline14, IconBranchOutline16, IconBrowseOutline16, IconCodeOutline16,
  IconDataOutline16, IconEditOutline16, IconFolderOpenOutline16, IconQuestionOutline14,
  IconSearchOutline16, IconSparkle16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  currentThinking, deriveTimelineGroups, detailOf, fmtDurationMs, thinkPreview,
  timelineVariantOf, type TimelineGroup, type TimelineItem,
} from './timeline.ts'
import css from './WideDock.module.css'

/** Full props: the session kit (sessionId, useSession) + the locale seat. */
export type WideDockProps = PropsRuntime<'wide.dock'> & PropsLocale<'conversation'>

/** Tool-name → glyph map (the tool plugin's VARIANT_ICONS family, extended
 * with per-MCP-server glyphs). Static so row memo keys stay stable. */
const VARIANT_ICONS: Record<string, ReturnType<typeof IconSearchOutline16>> = {
  search: <IconSearchOutline16 size={14} />,
  read: <IconBrowseOutline16 size={14} />,
  bash: <IconApiOutline14 size={14} />,
  write: <IconEditOutline16 size={14} />,
  edit: <IconEditOutline16 size={14} />,
  code: <IconCodeOutline16 size={14} />,
  'mcp-gitee': <IconBranchOutline16 size={14} />,
  'mcp-graphify': <IconDataOutline16 size={14} />,
  'mcp-openviking': <IconFolderOpenOutline16 size={14} />,
  'mcp-mentor': <IconQuestionOutline14 size={14} />,
  others: <IconSparkle16 size={14} />,
}

/** Think-card glyph: a STATIC glowing lightbulb — bulb shape ported from
 * Lucide's "lightbulb" icon (ISC license, lucide.dev), plus three fixed
 * shine rays and a faint fixed halo. No animation. */
function ThinkGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="12" cy="8.5" r="7" fill="currentColor" opacity="0.12" />
      <path d="M12 0.6V3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4.7 5.4l1.7 1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M19.3 5.4l-1.7 1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 18h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 22h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/** Resolve the icon for one tool row. */
function iconFor(name: string): ReturnType<typeof IconSearchOutline16> {
  return VARIANT_ICONS[timelineVariantOf(name)] ?? VARIANT_ICONS.others
}

/** How much accumulated below-the-fold text triggers one page push (px). */
const PAGE_LEAD_LINES = 56
/** Minimum page size for the push-up scroll (px). */
const PAGE_MIN = 120

/**
 * Render the dock panes.
 * @param props - session kit + locale seat.
 * @returns the dock pane tree.
 */
export function WideDock({ useSession, t }: WideDockProps) {
  const chat = useSession(s => s.chat)
  const groups = useMemo(() => deriveTimelineGroups(chat.nodes, chat.order, iconFor), [chat])
  const lastKey = groups.length === 0 ? null : groups[groups.length - 1].key
  // Timeline selection (details pane content) is dock-local.
  const [selection, setSelection] = useState<TimelineItem | null>(null)
  /* compact (default): only the last turn's timeline; full: all turn titles. */
  const [sectionCollapsed, setSectionCollapsed] = useState(true)
  /* explicitly-opened turn keys; the current (last) turn opens by default. */
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set(lastKey === null ? [] : [lastKey]))
  const signature = groups.map(g => g.key).join('|')
  useEffect(() => {
    if (lastKey === null) return
    setOpenKeys((prev) => {
      const valid = new Set(groups.map(g => g.key))
      let next = prev
      for (const k of prev) {
        if (!valid.has(k)) {
          if (next === prev) next = new Set(prev)
          next.delete(k)
        }
      }
      if (!next.has(lastKey)) {
        if (next === prev) next = new Set(prev)
        next.add(lastKey)
      }
      return next
    })
    // Signature (turn membership) drives the pruning; group identities are
    // stable within one signature.
  }, [groups, lastKey, signature])

  const live = useMemo(
    () => selection === null ? currentThinking(chat.nodes, chat.order) : { text: null, running: false },
    [chat, selection],
  )

  // Paged "write-down, push-up" auto-scroll for the live Think pane: the pane
  // stays still while the next page streams in; when a full page has
  // accumulated below the fold, push the text up by that page, keeping the
  // last ~3 lines of the previous page at the top. No per-chunk scrolling.
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const followingRef = useRef(true)
  const autoRef = useRef(0)
  const onDetailScroll = useCallback(() => {
    const el = bodyRef.current
    if (el === null) return
    followingRef.current = Math.abs(el.scrollTop - autoRef.current) < 64
  }, [])
  useEffect(() => {
    const el = bodyRef.current
    if (el === null) return
    if (selection !== null) return
    if (!live.running) {
      el.scrollTop = el.scrollHeight
      autoRef.current = el.scrollTop
      followingRef.current = true
      return
    }
    const page = Math.max(PAGE_MIN, el.clientHeight - PAGE_LEAD_LINES)
    const pending = el.scrollHeight - el.clientHeight - el.scrollTop
    if (followingRef.current && pending >= page) {
      el.scrollTop = Math.min(el.scrollHeight - el.clientHeight, el.scrollTop + page)
      autoRef.current = el.scrollTop
    }
  }, [live.running, live.text, selection])

  const detailTitle = selection === null
    ? (live.text !== null || live.running ? 'Think' : t('dock.details'))
    : selection.kind === 'think' ? 'Think' : selection.row.name
  const detailBody = selection === null ? null : detailOf(selection)
  const clearSelection = useCallback(() => setSelection(null), [])
  const selectItem = useCallback((item: TimelineItem) => {
    setSelection(prev => prev !== null && prev.key === item.key ? null : item)
  }, [])
  const toggleGroup = useCallback((key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])
  const toggleSection = useCallback(() => setSectionCollapsed(v => !v), [])

  const renderItems = (group: TimelineGroup) => group.items.map((item) => {
    if (item.kind === 'think') {
      const selected = selection !== null && selection.key === item.key
      return (
        <button
          key={item.key}
          type="button"
          className={css.item}
          data-selected={selected || undefined}
          onClick={() => { selectItem(item) }}
        >
          <span className={css.itemIcon}><ThinkGlyph /></span>
          <span className={css.thinkTag}>Think</span>
          <span className={css.itemPreview}>{thinkPreview(item.text)}</span>
        </button>
      )
    }
    const row = item.row
    const selected = selection !== null && selection.key === item.key
    const duration = fmtDurationMs(row.start, row.end)
    return (
      <button
        key={item.key}
        type="button"
        className={css.item}
        data-selected={selected || undefined}
        onClick={() => { selectItem(item) }}
      >
        <span className={css.itemIcon}>{row.icon}</span>
        {row.status === 'error' && <span className={css.itemError}>✕</span>}
        <code className={css.itemName}>{row.name}</code>
        <span className={css.itemPreview}>{String(row.argsRaw ?? '').slice(0, 72)}</span>
        {duration !== '' && <span className={css.itemDuration}>{duration}</span>}
      </button>
    )
  })

  const renderGroup = (group: TimelineGroup, open: boolean) => (
    <div key={group.key} className={css.group}>
      <button
        type="button"
        className={css.groupHeader}
        onClick={() => { toggleGroup(group.key) }}
      >
        <span className={css.groupDisclosure}>{open ? '▾' : '▸'}</span>
        <span className={css.groupLabel}>{group.label}</span>
        <span className={css.groupCount}>{t('dock.items', { count: group.items.length })}</span>
      </button>
      {open && renderItems(group)}
    </div>
  )

  const lastGroup = groups.length === 0 ? null : groups[groups.length - 1]
  return (
    <div className={css.root} data-wide-dock-panes>
      <section className={css.detailsPane} data-wide-pane="details">
        <header className={css.paneHeader}>
          {live.running && selection === null && <span className={css.liveDot} aria-hidden />}
          <span className={css.paneTitle}>{detailTitle}</span>
          {selection !== null && (
            <button type="button" className={css.backButton} title={t('dock.backToLive')} onClick={clearSelection}>✕</button>
          )}
        </header>
        {detailBody !== null
          ? (
            <div ref={bodyRef} onScroll={onDetailScroll} className={css.detailsBody}>
              {detailBody}
            </div>
          )
          : live.text === null
            ? <p className={css.detailsEmpty}>{live.running ? t('dock.thinking') : t('dock.clickHint')}</p>
            : (
              <div ref={bodyRef} onScroll={onDetailScroll} className={css.detailsBody}>
                {live.text}
              </div>
            )}
      </section>
      <section className={css.timelinePane} data-wide-pane="timeline">
        <header className={css.timelineHeader}>
          <button
            type="button"
            className={css.toggleButton}
            aria-expanded={!sectionCollapsed}
            onClick={toggleSection}
          >
            {sectionCollapsed ? '▸' : '▾'}
          </button>
          <span className={css.timelineTitle}>{t('dock.timeline')}</span>
          <span className={css.timelineMeta}>{t('dock.turns', { count: groups.length })}</span>
        </header>
        <div className={css.timelineScroll}>
          {groups.length === 0
            ? <p className={css.empty}>{t('dock.emptyTimeline')}</p>
            : sectionCollapsed && lastGroup !== null
              ? renderGroup(lastGroup, openKeys.has(lastGroup.key))
              : groups.map(group => renderGroup(group, openKeys.has(group.key)))}
        </div>
      </section>
    </div>
  )
}
