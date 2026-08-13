/**
 * Appearance preference row registered into the General section item slot
 * (figma 501:30012 'Frame 2117131228'): title + four preference cubes.
 * Registered by this package — the theme feature owns its own settings
 * surface. Selection follows the persisted preference, never the resolved
 * active theme.
 */
import clsx from 'clsx'
import type { ComponentType } from 'react'
import {
  IconDarkOutline16, IconFollowsystemOutline16, IconLightOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { ThemePreference } from '../theme-settings.ts'
import type { ThemeKey } from './locales.ts'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { createAppearanceRowStore } from './settings-store.ts'
import css from './AppearanceRow.module.css'

/** Injected business face: the preference write (t rides the standard locale seat). */
export interface AppearanceRowInjected {
  /** Switch the theme preference. */
  setTheme: (id: ThemePreference) => void
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type AppearanceRowComponentProps =
  PropsRuntime<'settings.general.item'> & PropsStore<ReturnType<typeof createAppearanceRowStore>>
  & PropsLocale<'settings.theme'> & AppearanceRowInjected

/** One preference cube's glyph signature (icon components and the swatch both satisfy it). */
interface CubeGlyphProps {
  size?: number
  className?: string
}

/** Deep Sea cube glyph: a dark-sea swatch with a bioluminescent cyan mote. */
function DeepSeaSwatch({ size = 20, className }: CubeGlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="rgb(10,14,22)" stroke="rgb(63,200,232)" strokeOpacity="0.5" />
      <circle cx="12" cy="12" r="3.5" fill="rgb(63,200,232)" opacity="0.9" />
      <circle cx="12" cy="12" r="6.5" fill="rgb(63,200,232)" opacity="0.18" />
    </svg>
  )
}

/** Cube order and icons (figma 501:30015-30017: Light, Dark, System; Deep Sea ships beside them). */
const CUBES: readonly { id: ThemePreference; labelKey: ThemeKey; Glyph: ComponentType<CubeGlyphProps> }[] = [
  { id: 'light', labelKey: 'appearance.light', Glyph: IconLightOutline16 },
  { id: 'dark', labelKey: 'appearance.dark', Glyph: IconDarkOutline16 },
  { id: 'system', labelKey: 'appearance.system', Glyph: IconFollowsystemOutline16 },
  { id: 'deep-sea', labelKey: 'appearance.deepSea', Glyph: DeepSeaSwatch },
]

/**
 * Render the Appearance row.
 * @param props - composed slot props.
 * @returns the row element tree.
 */
export function AppearanceRow({ t, setTheme, useStore }: AppearanceRowComponentProps) {
  const preference = useStore(s => s.preference)
  return (
    <div className={css.group}>
      <div className={css.title}>{t('appearance.title')}</div>
      <div className={css.cubeRow}>
        {CUBES.map(({ id, labelKey, Glyph }) => (
          <button
            key={id}
            type="button"
            className={clsx(css.themeCube, preference === id && css.selected)}
            aria-pressed={preference === id}
            onClick={() => { setTheme(id) }}
          >
            <Glyph />
            {t(labelKey)}
          </button>
        ))}
      </div>
    </div>
  )
}
