# 普通数值解释中的比较基准

preview.25 修正两处通用缺口：完整读数记录可以与普通问题分开输入；来源说明、核心回执、图表的既有补零对照和伴随客户端同时区分均值与合计。协议1.4和checkpoint格式保持，完整来源仍锚定，不丢弃额外句子。

`sourceStatistics.observed.sum` 是非缺失观测的小计，`complete.sum` 是全部位置的合计；有缺失、无有效观测或计算超限时，后者为null且`sumKnown=false`。实测0不代表设备正常，也不推测缺失原因、时间间隔或业务影响。均值的分母仍按范围分别提供。

`semantic_ui_check` 的 `dataFacts.series` 增加 `sum`；`zeroFillIllustration` 增加假设 `sum`、`differenceFromObservedSum`、`directionRelativeToObservedSum`、`completeDataSumKnown`。有限已观测小计与补零合计相同；均值可能降低、升高或相同。这些方向只相对已观测数据，未知真实完整读数的偏差方向没有因此得到证明。即使两种口径均值/合计都相同，缺失mask仍保留。无有效观测时原始核心保持unknown，宿主只对另列的全零假设副本请求核心计算，不能把它写回原始来源。

普通伴随入口显式支持 `--answer --hypothesis zero-fill`，可再加 `--model-candidate`。这在模型完成后由宿主独立调用现有来源比较和核心计算，不把宿主结果、评审答案或完整预期提前放入模型prompt。模型自己的工具调用、原文与宿主最终stdout分别保存；没有调用工具的正文不会因此获得认证。没有按问题关键词暗中启用补零。旧归档缺少sum字段时客户端保留unknown，不从均值倒推或重算。

开发阶段32项6文件、18项Python离线合同通过；最终归档、正常隔离安装、Native/PTC、Linux与公开下载需要独立后补回执，开发检查不冒充它们。原T2原文、原六题0 pass / 6 fail / 18 requests、A2勘误及此前各独立2/2观察不改写。新I/J为Agent合成数据、有技能和通用工作流指引的独立观察，不能当成原六题重验或现实数据真实性。
