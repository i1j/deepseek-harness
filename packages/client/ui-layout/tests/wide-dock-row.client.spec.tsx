// @vitest-environment jsdom
/** WideDockRow behavior: the switch mirrors the persisted preference and
 * clicks drive setWideDock. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSnapshotStore, type SessionListState, type WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { WideDockRow, type WideDockRowProps } from '../src/client/settings/WideDockRow.tsx'

afterEach(cleanup)

const COPY: Record<string, string> = {
  'layout.wideDock.title': 'Ultrawide dock',
  'layout.wideDock.description': 'Automatically enable the right dock at ultrawide viewports (≥1800px)',
  'layout.wideDock.on': 'On',
  'layout.wideDock.off': 'Off',
}

/** Empty global standard-kit hooks (the row reads neither). */
function emptySessions() {
  const store = createSnapshotStore<SessionListState>(
    { ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined })
  return bindSnapshotSelector(store)
}
function emptyWorkspaces() {
  const store = createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  })
  return bindSnapshotSelector(store)
}

function mount(enabled: boolean) {
  const wideDock = createSnapshotStore(enabled)
  const setWideDock = vi.fn()
  const props = {
    useSessions: emptySessions(),
    useWorkspaces: emptyWorkspaces(),
    useWideDock: bindSnapshotSelector(wideDock),
    setWideDock,
    t: (key: string) => COPY[key] ?? key,
  } as unknown as WideDockRowProps
  render(<WideDockRow {...props} />)
  return { wideDock, setWideDock }
}

describe('WideDockRow', () => {
  it('renders the title, description, and the on/off state of the switch', () => {
    mount(true)
    expect(screen.getByText('Ultrawide dock')).toBeDefined()
    expect(screen.getByText(/Automatically enable/)).toBeDefined()
    const button = screen.getByRole('button', { name: 'On' })
    expect(button.getAttribute('aria-pressed')).toBe('true')
  })

  it('click flips the switch and reports the new value', () => {
    const { setWideDock } = mount(true)
    fireEvent.click(screen.getByRole('button', { name: 'On' }))
    expect(setWideDock).toHaveBeenCalledWith(false)
  })

  it('renders off state from the store', () => {
    mount(false)
    const button = screen.getByRole('button', { name: 'Off' })
    expect(button.getAttribute('aria-pressed')).toBe('false')
  })
})
