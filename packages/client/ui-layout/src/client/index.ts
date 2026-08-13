/**
 * Layout plugin, browser half: one register() call contributes AppFrame into
 * the runtime's built-in 'root' slot and, in the same breath, declares the
 * five child slots (declaration = exclusive render authority), seats the
 * layout store (panel geometry + the ultrawide-dock switch), and wires the
 * panel-action service face. ctx.layout is the cross-plugin panel-action
 * contract; navigation state lives with the runtime sessions service. A
 * second effect seats the theme presenter, which projects ctx.theme
 * snapshots onto document.body. A third mirrors the durable ultrawide-dock
 * preference into the root store and registers its settings row.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type { PanelActions } from './service.ts'
import { AppFrame } from './AppFrame.tsx'
import { createLayoutStore } from './stores.ts'
import { LayoutController } from './service.ts'
import { ThemePresenter } from './theme-presenter.ts'
import { WideDockRow, type WideDockRowInjected } from './settings/WideDockRow.tsx'
import { en, NS, zh, type LayoutKey } from './locales.ts'
import {
  DEFAULT_WIDE_DOCK, LAYOUT_SETTINGS_NAMESPACE, WIDE_DOCK_FIELD,
  type LayoutSettings,
} from '../layout-settings.ts'

// Contract exports only (export-convergence rule: cross-package consumers
// keep a symbol exported; test-only/package-internal symbols live off /src).
// ILayout: the ctx.layout face consumers and test fakes type against.
// OwnerShare contracts below are the render-side halves registrants compose
// against; the frame components and the store factory are package-internal.
export { LayoutController } from './service.ts'
export type { ILayout } from './service.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** The outward face only; the concrete service stays inside this plugin. */
    layout: import('./service.ts').ILayout
  }
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The layout settings row's copy. */
    'settings.layout': LayoutKey
  }
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    // The 'root' entry itself is the runtime's built-in slot (declared
    // there); these five are the frame's children, declared by the same
    // register() call that contributes AppFrame. Session owners never pass
    // sessionId: the framework injects it as a standard prop.
    /**
     * The whole left column. OCCUPIED by ui-sidebar's SidebarRoot, which
     * declares the workspace and settings seats inside it — registering here
     * replaces the navigation column outright rather than adding to it, and
     * the seats it declares disappear with it. To add something to the
     * sidebar, register into one of those inner seats instead.
     *
     * The occupant receives the frame's live column state (collapsed, width)
     * and is expected to render the compact control rail while collapsed.
     */
    'sidebar': { kind: 'single'; scope: 'root'; owner: SidebarOwnerProps }
    /**
     * The whole center column, across both the no-session hero and a live
     * conversation. OCCUPIED by ui-conversation's ConversationRoot, which
     * declares the session body, composer, and input seats inside it —
     * registering here replaces the entire conversation surface (and removes
     * every seat it declares) rather than adding to it.
     *
     * Current-session-optional: the occupant owns both states without
     * changing its React identity, so it keeps its own state across a session
     * switch. It receives the frame's resolved wide-dock state as an owner
     * prop; session facts arrive through the framework hooks of the
     * `session-maybe` scope.
     */
    'conversation': { kind: 'single'; scope: 'session-maybe'; owner: ConvOwnerProps }
    /**
     * The right details column, shown when the layout opens it. OCCUPIED by
     * ui-conversation's DetailsPanel, which declares the tool-details seat
     * inside it — registering here replaces the column and takes that seat
     * with it. Absent an occupant the column renders nothing. While the wide
     * dock is active the frame renders the dock column instead and this one
     * unmounts (its occupant's panes live in the dock).
     *
     * No owner props: the framework injects the session id and hooks for the
     * `session` scope, and `ctx.layout` owns whether the column is open.
     */
    'details': { kind: 'single'; scope: 'session'; owner: DetailsOwnerProps }
    /**
     * The ultrawide right dock column, rendered instead of the details
     * column at wide viewports (>= WIDE_BREAKPOINT) while the layout
     * setting is on. A list seat: entries stack in order. OCCUPIED by
     * ui-conversation's dock panes (Think details + tool timeline), which
     * share one selection state inside a single occupant.
     *
     * No owner props: the framework injects the session id and hooks for the
     * `session` scope.
     */
    'wide.dock': { kind: 'list'; scope: 'session' }
    /**
     * Frame-wide floating layer, above every column and outside their scroll
     * containers. Deliberately generic and unowned by any feature: a badge, a
     * toast stack or a status pill all belong here, and entries order among
     * themselves. The layer itself is click-through — entries opt back into
     * pointer events — so an occupant never blocks the app underneath.
     *
     * This is the additive seat for a frame-wide surface of your own: a fresh
     * `id` is added beside the shipped entries instead of replacing them.
     */
    'shell.overlay': { kind: 'list'; scope: 'root' }
  }
}

// OwnerShare contracts — the render-side share the slot owner supplies at
// renderSlot. Registrants IMPORT these and compose their full component props
// through the four-share intersection (PropsRuntime & PropsRenderSlots &
// PropsStore & I). Conversation business state and actions arrive through
// framework-standard hooks and each registrant's inject face, not owner props.

/** Sidebar owner share: live column state from the frame's concession solve. */
export interface SidebarOwnerProps {
  /** True when the sidebar is closed (the column renders the compact control rail). */
  collapsed: boolean
  /** Rendered column width in px (SIDEBAR_COLLAPSED when collapsed). */
  width: number
}

/** Conversation owner share: the frame's resolved wide-dock state. */
export interface ConvOwnerProps {
  /** True while the ultrawide dock column renders (text-only chat applies). */
  wideDock: boolean
}

/** Details owner share: empty — sessionId arrives as a framework-standard prop. */
export interface DetailsOwnerProps {}

/** Required services (cordis fiber inject — the loader passes all module exports as an object plugin). */
export const inject = ['slots', 'theme', 'settingsScope', 'locale']

/**
 * Client plugin body: provide ctx.layout, then one register() call — AppFrame
 * into 'root' with the five child-slot declarations, the layout store seat,
 * and the inject hook that hands the store's bound actions to the service.
 * The settings effect mirrors the durable ultrawide-dock switch into the root
 * store and registers the preference row; the theme effect seats the
 * presenter.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const layout = new LayoutController()
  ctx.effect(() => {
    const disposeService = ctx.reflect.provide('layout', layout)
    const disposeRegistration = ctx.slots.register({
      name: 'root',
      children: {
        'sidebar': { kind: 'single', scope: 'root' },
        'conversation': { kind: 'single', scope: 'session-maybe' },
        'details': { kind: 'single', scope: 'session' },
        'wide.dock': { kind: 'list', scope: 'session' },
        'shell.overlay': { kind: 'list', scope: 'root' },
      },
      // Exclusive store: the factory itself — the framework instantiates per
      // entry and delivers useStore/actions to AppFrame as standard props.
      store: createLayoutStore,
      // The hook's only side effect connects the root store to ctx.layout;
      // conversation business actions belong to their registrants.
      inject: (actions: PanelActions) => {
        layout.attachPanels(actions)
        return {}
      },
    }, AppFrame)
    return () => {
      disposeRegistration()
      // provide()'s disposer settles asynchronously; teardown is synchronous fire-and-forget.
      void disposeService()
    }
  }, 'ui-layout: service + root registration')

  // Durable wide-dock preference: one shared snapshot source for the root
  // store mirror and the settings row, adopted from the settings scope (the
  // theme plugin's adopt pattern; a disposed scope never publishes again).
  ctx.effect(() => {
    const host = ctx.settingsScope.bind<LayoutSettings>({ namespace: LAYOUT_SETTINGS_NAMESPACE })
    const wideDock = createSnapshotStore(DEFAULT_WIDE_DOCK)
    const adopt = (): void => {
      const section = host.getSnapshot().value
      if (section === undefined || wideDock.getSnapshot() === section.wideDock) return
      wideDock.set(section.wideDock)
    }
    const off = host.subscribe(adopt)
    adopt()
    // Mirror into the root store; runs after the registration effect above,
    // so the bound actions are wired (the controller no-ops otherwise).
    const mirror = (): void => { layout.setWideDockEnabled(wideDock.getSnapshot()) }
    const offMirror = wideDock.subscribe(mirror)
    mirror()
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-layout: settings row dictionaries')
    const disposeRow = ctx.slots.inject('settings.general.item', () => ctx.slots.register({
      name: 'settings.general.item',
      id: 'wide-dock',
      order: 30,
      locale: NS,
      inject: (): WideDockRowInjected => ({
        hooks: { wideDock },
        setWideDock: (enabled: boolean) => {
          if (wideDock.getSnapshot() === enabled) return
          wideDock.set(enabled)
          void host.set(WIDE_DOCK_FIELD, enabled)
        },
      }),
    }, WideDockRow))
    return () => {
      off()
      offMirror()
      disposeRow()
    }
  }, 'ui-layout: wide-dock settings')

  // Theme presentation: pure DOM writes from resolved snapshots — initial
  // state through the getter once, then event-driven only; no React path.
  ctx.effect(() => {
    const presenter = new ThemePresenter()
    presenter.apply(ctx.theme.getTheme())
    const off = ctx.on('theme/change', (snapshot) => { presenter.apply(snapshot) })
    return () => {
      off()
      presenter.dispose()
    }
  }, 'ui-layout: theme presenter')
}
