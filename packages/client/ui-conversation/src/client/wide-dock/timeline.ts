/**
 * Pure timeline derivation for the ultrawide dock panes: walks the chat
 * snapshot's stable Node order and groups activity into user turns (Think
 * cards + tool calls). Kept free of React and DOM so the grouping, duration,
 * and preview rules are unit-testable and the component stays a thin renderer.
 */
import type { ReactNode } from 'react'
import type { ChatConversationViewNode } from '@deepseek-ai/dsh-client-runtime/client'
import type { AssistantChatData, ChatNode, ToolChatData } from '../contract/chat-nodes.ts'

/** Minimal node-store face these helpers read; the runtime's ChatNodeStore
 * (and its live keyed readers) satisfies it structurally. */
interface NodeStore {
  get(key: string): ChatConversationViewNode | undefined
}

/** One timeline row: a tool call in the chat snapshot, as the dock renders it. */
export interface TimelineRow {
  name: string
  icon: ReactNode
  status: 'running' | 'ok' | 'error'
  /** Unix epoch ms of the call, or null when unknown. */
  start: number | null
  /** Unix epoch ms of settlement, or null while running. */
  end: number | null
  argsRaw: string
  resultText: string | null
}

/** One timeline item: a Think card or a tool row. */
export type TimelineItem =
  | { key: string; kind: 'think'; text: string }
  | { key: string; kind: 'tool'; row: TimelineRow }

/** One user turn group: label + its activity items in chat order. */
export interface TimelineGroup {
  key: string
  label: string
  items: TimelineItem[]
}

/** Live reasoning probe result: the current (running, else latest) Think text. */
export interface CurrentThinking {
  text: string | null
  running: boolean
}

/** Human duration between two epoch-ms timestamps ("" when unknown). */
export function fmtDurationMs(start: number | null, end: number | null): string {
  if (typeof start !== 'number' || typeof end !== 'number') return ''
  const ms = Math.max(0, Math.round(end - start))
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`
}

/** First non-empty line of a reasoning text (Think card preview). */
export function thinkPreview(text: string): string {
  const line = String(text ?? '').split('\n').map(l => l.trim()).find(l => l !== '')
  return line === undefined ? '…' : line.slice(0, 72)
}

/** First line of a user message, for the turn group label. */
export function timelineUserLabel(node: ChatNode): string {
  const content = (node as { data?: { content?: unknown } }).data?.content
  if (typeof content === 'string' && content.trim() !== '') return content.split('\n')[0].trim().slice(0, 48)
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part !== null && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string'
        && (part as { text: string }).text.trim() !== '') {
        return (part as { text: string }).text.split('\n')[0].trim().slice(0, 48)
      }
    }
  }
  return ''
}

/**
 * Classify a tool name into a variant family (icon key). Per-MCP-server
 * prefixes get their own glyphs; built-in tools map to their families.
 * @param name - tool call name.
 * @returns the variant family key.
 */
export function timelineVariantOf(name: string): string {
  const n = String(name ?? '')
  if (n.startsWith('mcp__gitee__')) return 'mcp-gitee'
  if (n.startsWith('mcp__graphify')) return 'mcp-graphify'
  if (n.startsWith('mcp__openviking')) return 'mcp-openviking'
  if (n.startsWith('mcp__mentor')) return 'mcp-mentor'
  switch (name) {
    case 'bash': case 'pwsh': return 'bash'
    case 'read': case 'web_fetch': case 'cordis_package_inspect': case 'cordis_runtime_inspect': return 'read'
    case 'web_search': case 'grep': case 'glob': return 'search'
    case 'write': case 'edit': return 'write'
    case 'run_code': return 'code'
    default: return 'others'
  }
}

/** One timeline row from a tool-call chat node (root Tool lifecycle). */
export function timelineRowOf(node: ChatNode, iconFor: (name: string) => ReactNode): TimelineRow | null {
  const root = (node as ChatNode & { data?: ToolChatData }).data?.root
  if (root === undefined) return null
  const settled = root.kind === 'tool-result'
  const name = settled ? root.call?.name ?? 'tool' : root.name ?? 'tool'
  const status: TimelineRow['status'] = !settled ? 'running' : root.isError === true ? 'error' : 'ok'
  const start = settled ? root.callTime : root.time
  const end = settled ? root.time : null
  const argsRaw = settled ? root.call?.argsRaw ?? '' : root.argsRaw ?? ''
  const resultText = settled ? root.content : null
  return { name, icon: iconFor(name), status, start, end, argsRaw, resultText }
}

/** Resolve the current (running, else latest) assistant reasoning block. */
export function currentThinking(
  nodes: NodeStore | undefined,
  order: readonly string[] | undefined,
): CurrentThinking {
  if (nodes === undefined) return { text: null, running: false }
  const seq = order ?? []
  for (let i = seq.length - 1; i >= 0; i--) {
    const node = nodes.get(seq[i]) as ChatNode | undefined
    if (node === undefined) continue
    if (node.kind === 'assistant-step') {
      const data = node.data as AssistantChatData
      const blocks = data?.finalNode?.blocks ?? data?.blocks ?? []
      for (let b = blocks.length - 1; b >= 0; b--) {
        const block = blocks[b]
        if (block?.kind === 'reasoning' && typeof block.text === 'string' && block.text.trim() !== '') {
          return { text: block.text, running: data?.status === 'running' }
        }
      }
      if (data?.status === 'running') return { text: null, running: true }
    }
  }
  return { text: null, running: false }
}

/**
 * Group chat nodes into turns (user-kind node starts a group); within a turn,
 * items are Think cards (assistant reasoning) and tool calls in chat order.
 * Activity before the first user message is skipped; empty groups drop out.
 * @param nodes - chat node map.
 * @param order - chat node order.
 * @param iconFor - tool-name → icon resolver.
 * @returns the timeline groups.
 */
export function deriveTimelineGroups(
  nodes: NodeStore | undefined,
  order: readonly string[] | undefined,
  iconFor: (name: string) => ReactNode,
): TimelineGroup[] {
  if (nodes === undefined) return []
  const seq = order ?? []
  const groups: TimelineGroup[] = []
  let current: TimelineGroup | null = null
  for (const key of seq) {
    const node = nodes.get(key) as ChatNode | undefined
    if (node === undefined) continue
    if (node.kind === 'user' || node.kind === 'steering') {
      current = { key, label: timelineUserLabel(node), items: [] }
      groups.push(current)
      continue
    }
    if (current === null) continue
    if (node.kind === 'assistant-step') {
      const data = node.data as AssistantChatData
      const blocks = data?.finalNode?.blocks ?? data?.blocks ?? []
      for (const block of blocks) {
        if (block?.kind === 'reasoning' && typeof block.text === 'string' && block.text.trim() !== '') {
          current.items.push({ key: `${key}:think`, kind: 'think', text: block.text })
        }
      }
      continue
    }
    if (node.kind === 'tool-call') {
      const row = timelineRowOf(node, iconFor)
      if (row !== null) current.items.push({ key, kind: 'tool', row })
    }
  }
  return groups.filter(g => g.items.length > 0)
}

/** Detail payload for a timeline item (tool or think). */
export function detailOf(item: TimelineItem): string {
  if (item.kind === 'think') return item.text
  const row = item.row
  const parts = [String(row.argsRaw ?? '')]
  if (row.resultText !== null && row.resultText !== undefined) {
    parts.push('\n\n' + (typeof row.resultText === 'string' ? row.resultText : JSON.stringify(row.resultText)))
  }
  return parts.join('')
}
