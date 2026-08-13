// @vitest-environment jsdom
/** WideDock behavior: turn grouping, compact/full timeline, selection-driven
 * details pane, live Think, and the paged auto-scroll. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { WideDock, type WideDockProps } from '../src/client/wide-dock/WideDock.tsx'
import { zh } from '../src/client/locales.ts'
import type { ChatNode, ToolChatData } from '../src/client/contract/chat-nodes.ts'

const t = makeTranslate(zh, commonZh)

/** One user + one settled tool call + one think, in chat order. */
function sampleChat(): { order: string[]; nodes: Map<string, ChatNode> } {
  const order = ['u1', 'a1', 't1']
  const nodes = new Map<string, ChatNode>([
    ['u1', { key: 'u1', kind: 'user', data: { content: '用 bash 查一下' } } as ChatNode],
    ['a1', {
      key: 'a1',
      kind: 'assistant-step',
      data: {
        status: 'settled',
        blocks: [{ kind: 'reasoning', text: '先看看环境' }],
      },
    } as ChatNode],
    ['t1', {
      key: 't1',
      kind: 'tool-call',
      data: {
        root: {
          kind: 'tool-result',
          callId: 'c1',
          time: 2000,
          call: { name: 'bash', argsRaw: '{"command":"ls"}' },
          callTime: 1000,
          content: [{ type: 'text', text: 'a.txt b.txt' }],
          isError: false,
        },
      } as unknown as ToolChatData['root'],
    } as ChatNode],
  ])
  return { order, nodes }
}

/** Minimal PropsRuntime<'wide.dock'> stand-in: the dock only reads useSession. */
function mount(chat: ReturnType<typeof sampleChat>): ReturnType<typeof render> {
  const props = {
    sessionId: 's-test' as string,
    useSession: (sel: (s: unknown) => unknown) => sel({ chat }),
    useSessions: (sel: (s: unknown) => unknown) => sel({}),
    useWorkspaces: (sel: (s: unknown) => unknown) => sel({}),
    t,
  } as unknown as WideDockProps
  return render(<WideDock {...props} />)
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => { cb(0) }, 16) as unknown as number)
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { clearTimeout(id) })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('WideDock', () => {
  it('groups turns and shows the compact last-turn timeline with a tool row', () => {
    mount(sampleChat())
    // Compact view: only the last turn's group renders.
    expect(screen.getByText('工具时间线')).toBeTruthy()
    expect(screen.getByText('用 bash 查一下')).toBeTruthy()
    expect(screen.getByText('bash')).toBeTruthy()
    expect(screen.getByText('1.0s')).toBeTruthy() // 2000-1000 = 1.0s
    // 'Think' labels both the live pane title and the think card tag.
    expect(screen.getAllByText('Think').length).toBeGreaterThan(0)
  })

  it('expanding the section shows every turn title; clicking a title toggles its timeline', () => {
    const chat = sampleChat()
    chat.order = [...chat.order, 'u2', 't2']
    chat.nodes.set('u2', { key: 'u2', kind: 'user', data: { content: '第二问' } } as ChatNode)
    chat.nodes.set('t2', {
      key: 't2',
      kind: 'tool-call',
      data: {
        root: {
          kind: 'tool-result',
          callId: 'c2',
          time: 3000,
          call: { name: 'read', argsRaw: '{"path":"a.txt"}' },
          callTime: 2500,
          content: [{ type: 'text', text: 'x' }],
          isError: false,
        },
      } as unknown as ToolChatData['root'],
    } as ChatNode)
    mount(chat)
    // Section toggle is the only header button with aria-expanded=false.
    fireEvent.click(screen.getByRole('button', { expanded: false }))
    expect(screen.getByText('第二问')).toBeTruthy()
    expect(screen.getByText('用 bash 查一下')).toBeTruthy()
  })

  it('clicking a timeline row shows its detail in the details pane; ✕ returns to live', () => {
    mount(sampleChat())
    fireEvent.click(screen.getByText('bash'))
    // The result text renders only in the details pane (as JSON-serialized
    // content); the row preview shows only the args.
    expect(screen.getByText(/a\.txt b\.txt/)).toBeTruthy()
    fireEvent.click(screen.getByText('✕'))
    expect(screen.queryByText(/a\.txt b\.txt/)).toBeNull()
    // Back to the live Think of the settled reasoning block.
    expect(screen.getAllByText('先看看环境').length).toBeGreaterThan(0)
  })

  it('shows the live Think while no selection and the empty hint without activity', () => {
    const chat = sampleChat()
    chat.nodes.set('a1', {
      key: 'a1',
      kind: 'assistant-step',
      data: { status: 'running', blocks: [{ kind: 'reasoning', text: '正在思考' }] },
    } as ChatNode)
    mount(chat)
    // Both the Think card preview and the live details pane carry the text.
    expect(screen.getAllByText('正在思考').length).toBeGreaterThan(0)

    mount({ order: ['u1'], nodes: new Map([['u1', { key: 'u1', kind: 'user', data: { content: 'hi' } } as ChatNode]]) })
    expect(screen.getByText('还没有工具调用')).toBeTruthy()
    expect(screen.getByText('点击下方时间线条目查看详情')).toBeTruthy()
  })

  it('clicking a Think card shows its reasoning text', () => {
    mount(sampleChat())
    // The live pane (first match) already shows the settled reasoning; click
    // the preview ROW (second match) to select it as a card.
    fireEvent.click(screen.getAllByText('先看看环境')[1]!)
    // The think text now appears in the details pane as well as the preview.
    expect(screen.getAllByText('先看看环境').length).toBe(2)
    // ✕ returns to the live pane.
    fireEvent.click(screen.getByText('✕'))
    expect(screen.getAllByText('先看看环境').length).toBeGreaterThan(0)
  })
})
