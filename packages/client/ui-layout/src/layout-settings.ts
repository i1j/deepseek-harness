/** Ultrawide-dock preference stored in the Host user-settings document. */

import z from '@deepseek-ai/schemastery'

/** Settings namespace owned by the layout plugin. */
export const LAYOUT_SETTINGS_NAMESPACE = 'ui-layout'

/** Field carrying the ultrawide dock switch. */
export const WIDE_DOCK_FIELD = 'wideDock'

/** Default: the ultrawide dock auto-enables at wide viewports. */
export const DEFAULT_WIDE_DOCK = true

/** Durable layout section shared by the Host schema and the browser scope. */
export interface LayoutSettings {
  /** Whether the ultrawide right dock column may render at wide viewports. */
  wideDock: boolean
}

/** Durable layout schema; also the wire envelope the browser scope validates against. */
export const LayoutSettingsSchema: z<LayoutSettings> = z.object({
  [WIDE_DOCK_FIELD]: z.boolean().default(DEFAULT_WIDE_DOCK),
})
