# Agent Note: 超宽屏 Dock 与纯文字对话模式

Status: implemented

[English](2026-08-14-ultrawide-dock-text-only-chat.md) | 中文

## 问题

在超宽视口（≥1800px，例如促成本次工作的 3440×1440 显示器）上，经典三栏外壳——侧栏 | 对话 | 详情——浪费了大部分横向空间：转录列在两侧大片空白中仍保持固定 748px 度量，对话栏则同时混排正文、行内工具卡片与行内思考，长时间运行的 agent 回合读起来像一堵难以扫读的密墙。布局没有任何途径把这部分宽度花在真正重要的地方：保持可读度量的对话，以及一处不推挤正文即可检视思考与工具活动的位置。

## 决策

**由框架求解 dock 轨道以取代详情栏。** ui-layout 的 `resolveWideDock` 在 ≥1800px、有真实会话且开关开启时激活：dock 宽度被夹在 [320, 640]px（`viewport/3 − 侧栏`），仅当对话栏仍保有 ≥2/3 视口时才提交。`AppFrame` 渲染新的 `wide.dock` 列表插槽（由框架声明，`session` 作用域）以取代详情栏，并把求解结果以 owner prop 交给对话。

**dock 是 ui-conversation 的单个 occupant。** `WideDock` 借由 `slots.inject('wide.dock')` 进入框架的列表席位：上方详情面板（实时 Think，分页"写满推屏"自动滚动；点击时间线条目显示详情；✕ 返回实时），下方可折叠的按轮工具时间线（折叠态只显示最后一轮；展开态显示所有轮标题）。

**宽屏下对话运行纯文字模式。** `ChatView` 把 tool-call 节点过滤出渲染顺序（节点仍留在快照中供 dock 读取），`AssistantMarkdown` 通过 `hideReasoning` 跳过 reasoning 块，用户气泡通栏，转录列度量加宽为 `min(1360px, calc(100% - 64px))`。同一 PR 还把对话 markdown 微排版改为 token 驱动（行内代码取 shiki 关键字色、引用加品牌色竖条、h6 与表头降级），随主题自动换肤。

**开关是持久的。** `ui-layout.wideDock`（默认开启）经 Host settings scope 持久化，并在「通用」设置中增加一行开关（`WideDockRow`，顺序 30）。宽屏状态以可选 owner prop 沿插槽链下传，使用 `exactOptionalPropertyTypes` 安全的条件展开，经典布局的 owner 永远不会收到显式 `undefined`。

## 曾考虑的替代方案

**无条件纯文字对话。** 不采用：没有 dock 承载就隐藏工具行与思考，是在丢失信息而非重组信息。

**可拖拽调整大小的 dock。** 不采用：宽度是已求解的契约（[320, 640]px + 2/3 规则），且详情栏已有可拖拽侧面板。

**在流程中保留工具行并额外复制一份时间线。** 不采用：纯文字流程正是本方案要点——dock 时间线取代行内卡片，而不是复制它们。

## 后果

窄屏与 1800px 以下视口完全不变；dock 还要求非空白会话与 2/3 规则（过宽的侧栏会使其停用）。宽屏模式下详情栏卸载，Inspect 式打开按设计保持惰性——由 dock 面板持有选中状态。未参与的 occupant（ui-tool、ui-trajectory、ui-workflow-run）收到缺席的 `wideDock`，保持经典布局。超宽屏上工具行按设计离开转录流；进行中工作面的展示移入 dock 时间线。
