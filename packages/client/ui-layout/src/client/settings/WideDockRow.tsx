/** General Settings row for the ultrawide-dock preference. */
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './WideDockRow.module.css'

/** Registration-side preference face. */
export interface WideDockRowInjected {
  hooks: {
    /** Persisted ultrawide-dock switch bound as useWideDock. */
    wideDock: SnapshotStore<boolean>
  }
  /** Change the ultrawide-dock switch. */
  setWideDock: (enabled: boolean) => void
}

/** Full Settings-row props. */
export type WideDockRowProps =
  PropsRuntime<'settings.general.item'>
  & PropsLocale<'settings.layout'>
  & InjectFace<WideDockRowInjected>

/**
 * Render the ultrawide-dock preference row.
 * @param props - composed Settings slot props.
 * @returns the preference row.
 */
export function WideDockRow({ useWideDock, setWideDock, t }: WideDockRowProps) {
  const enabled = useWideDock(value => value)
  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('layout.wideDock.title')}</div>
        <div className={css.desc}>{t('layout.wideDock.description')}</div>
      </div>
      <button
        type="button"
        className={css.switch}
        data-on={enabled || undefined}
        aria-pressed={enabled}
        onClick={() => { setWideDock(!enabled) }}
      >
        {t(enabled ? 'layout.wideDock.on' : 'layout.wideDock.off')}
      </button>
    </div>
  )
}
