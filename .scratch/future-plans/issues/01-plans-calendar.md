# 01 — 计划与日历

**What to build:** 今天与未来的计划可从日历新增、修改、改期和删除，过期保留，计划和记录分组及统计分开，刷新和离线重开可读回。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

**Resolution:** completed（2026-11-05）

- [x] 数据库升级保留现有记录；未来日期可选但不能新增未来记录
- [x] 新建及改期只允许今天未来；过期计划改字保留原日期
- [x] 同日多条、分组标记及独立数量可观察
- [x] 保存失败保留输入，刷新和离线重开后内容一致

## Comments

已实现并通过浏览器行为验收。完整验证与独立评审结果见 docs/implementation-review.md 的“未来计划功能”章节。
