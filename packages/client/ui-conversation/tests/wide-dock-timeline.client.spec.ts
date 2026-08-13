/** Pure timeline derivation account for the wide dock panes. */
import { describe, expect, it } from 'vitest'
import {
  currentThinking, deriveTimelineGroups, detailOf, fmtDurationMs, thinkPreview,
  timelineUserLabel, timelineVariantOf,
} from '@deepseek-ai/dsh-client-ui-conversation/src/client/wide-dock/timeline.ts'
import type { ChatNode, ToolChatData } from '@deepseek-ai/dsh-client-ui-conversation/src/client/contract/chat-nodes.ts'

const iconFor = (name: string): string => name

/** Settled tool-call node builder. */
function settledTool(key: string, name: string, argsRaw: string, callTime: number, time: number, error = false): ChatNode {
  return {
    key,
    kind: 'tool-call',
    data: {
      root: {
        kind: 'tool-result',
        callId: key,
        time,
        call: { name, argsRaw },
        callTime,
        content: [{ type: 'text', text: 'ok' }],
        isError: error,
      },
    } as ToolChatData['root'],
  } as ChatNode
}

function runningTool(key: string, name: string, time: number): ChatNode {
  return {
    key,
    kind: 'tool-call',
    data: { root: { callId: key, name, argsRaw: '{}', time } },
  } as ChatNode
}

function user(key: string, content: string): ChatNode {
  return { key, kind: 'user', data: { content } } as ChatNode
}

function think(key: string, text: string, running = false): ChatNode {
  return {
    key,
    kind: 'assistant-step',
    data: { status: running ? 'running' : 'settled', blocks: [{ kind: 'reasoning', text }] },
  } as ChatNode
}

describe('fmtDurationMs', () => {
  it('formats ms/s/min and hides unknown bounds', () => {
    expect(fmtDurationMs(null, null)).toBe('')
    expect(fmtDurationMs(0, 500)).toBe('500ms')
    expect(fmtDurationMs(0, 1500)).toBe('1.5s')
    expect(fmtDurationMs(0, 61000)).toBe('1m1s')
  })
})

describe('thinkPreview', () => {
  it('takes the first non-empty line and truncates at 72 chars', () => {
    expect(thinkPreview('\n  first line \nsecond')).toBe('first line')
    expect(thinkPreview('x'.repeat(100))).toHaveLength(72)
    expect(thinkPreview('   ')).toBe('…')
  })
})

describe('timelineUserLabel', () => {
  it('takes the first line of string or block content', () => {
    expect(timelineUserLabel(user('u', '第一行\n第二行'))).toBe('第一行')
    expect(timelineUserLabel({ key: 'u', kind: 'user', data: { content: [{ type: 'text', text: 'a\nb' }] } } as ChatNode)).toBe('a')
    expect(timelineUserLabel({ key: 'u', kind: 'user', data: { content: [] } } as ChatNode)).toBe('')
  })
})

describe('timelineVariantOf', () => {
  it('classifies built-ins, MCP prefixes, and the fallback', () => {
    expect(timelineVariantOf('bash')).toBe('bash')
    expect(timelineVariantOf('web_search')).toBe('search')
    expect(timelineVariantOf('read')).toBe('read')
    expect(timelineVariantOf('write')).toBe('write')
    expect(timelineVariantOf('run_code')).toBe('code')
    expect(timelineVariantOf('mcp__gitee__create_issue')).toBe('mcp-gitee')
    expect(timelineVariantOf('mcp__graphify__x')).toBe('mcp-graphify')
    expect(timelineVariantOf('mcp__openviking__x')).toBe('mcp-openviking')
    expect(timelineVariantOf('mcp__mentor__x')).toBe('mcp-mentor')
    expect(timelineVariantOf('anything_else')).toBe('others')
  })
})

describe('deriveTimelineGroups', () => {
  it('groups turns and skips activity before the first user message', () => {
    const nodes = new Map<string, ChatNode>([
      ['a0', think('a0', 'pre-activity')],
      ['u1', user('u1', '问一')],
      ['t1', settledTool('t1', 'bash', '{}', 0, 10)],
      ['u2', user('u2', '问二')],
    ])
    const groups = deriveTimelineGroups(nodes, ['a0', 'u1', 't1', 'u2'], iconFor)
    // Activity before the first user message is skipped; the item-less second
    // turn drops out of the timeline entirely.
    expect(groups.map(g => g.label)).toEqual(['问一'])
    expect(groups[0]!.items).toHaveLength(1)
  })

  it('includes think cards and running/error tool rows in chat order', () => {
    const nodes = new Map<string, ChatNode>([
      ['u1', user('u1', '问')],
      ['a1', think('a1', '思考')],
      ['t1', settledTool('t1', 'bash', '{}', 0, 5, true)],
      ['t2', runningTool('t2', 'read', 6)],
    ])
    const groups = deriveTimelineGroups(nodes, ['u1', 'a1', 't1', 't2'], iconFor)
    const items = groups[0]!.items
    expect(items[0]).toEqual({ key: 'a1:think', kind: 'think', text: '思考' })
    expect(items[1]).toMatchObject({ key: 't1', kind: 'tool' })
    expect((items[1] as { row: { status: string } }).row.status).toBe('error')
    expect((items[2] as { row: { status: string } }).row.status).toBe('running')
  })

  it('handles undefined store and empty order', () => {
    expect(deriveTimelineGroups(undefined, undefined, iconFor)).toEqual([])
    expect(deriveTimelineGroups(new Map(), [], iconFor)).toEqual([])
  })
})

describe('currentThinking', () => {
  it('resolves the latest non-empty reasoning and its running flag', () => {
    const nodes = new Map<string, ChatNode>([
      ['a1', think('a1', '旧思考')],
      ['a2', think('a2', '新思考', true)],
    ])
    expect(currentThinking(nodes, ['a1', 'a2'])).toEqual({ text: '新思考', running: true })
    expect(currentThinking(nodes, ['a1'])).toEqual({ text: '旧思考', running: false })
    expect(currentThinking(undefined, undefined)).toEqual({ text: null, running: false })
  })

  it('reports running-only turns and ignores blank reasoning', () => {
    const nodes = new Map<string, ChatNode>([
      ['a1', { key: 'a1', kind: 'assistant-step', data: { status: 'running', blocks: [{ kind: 'reasoning', text: '  ' }] } } as ChatNode],
    ])
    expect(currentThinking(nodes, ['a1'])).toEqual({ text: null, running: true })
  })
})

describe('detailOf', () => {
  it('renders think text and tool args + result', () => {
    expect(detailOf({ key: 't', kind: 'think', text: '思考' })).toBe('思考')
    const groups = deriveTimelineGroups(
      new Map([['u1', user('u1', '问')], ['t1', settledTool('t1', 'bash', '{"a":1}', 0, 5)]]),
      ['u1', 't1'],
      iconFor,
    )
    const detail = detailOf(groups[0]!.items[0] as { key: string; kind: 'tool'; row: { argsRaw: string; resultText: string | null } })
    expect(detail).toContain('{"a":1}')
    expect(detail).toContain('ok')
  })
})
