/** `settings.layout` namespace dictionaries (the layout plugin's settings row). */

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.layout'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'layout.wideDock.title': '超宽屏 Dock',
  'layout.wideDock.description': '在超宽屏（≥1800px）自动启用右侧 dock（Think 详情 + 工具时间线）',
  'layout.wideDock.on': '开启',
  'layout.wideDock.off': '关闭',
} as const

/** English dictionary; keys mirror the Chinese set. */
export const en: Record<keyof typeof zh, string> = {
  'layout.wideDock.title': 'Ultrawide dock',
  'layout.wideDock.description': 'Automatically enable the right dock (Think details + tool timeline) at ultrawide viewports (≥1800px)',
  'layout.wideDock.on': 'On',
  'layout.wideDock.off': 'Off',
}

/** Translation keys of the layout settings row. */
export type LayoutKey = keyof typeof zh
