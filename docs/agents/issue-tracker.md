# Issue tracker: Local Markdown

规格与任务以本地 Markdown 保存在 .scratch/。

- 每项功能使用独立目录 .scratch/<feature-slug>/。
- 功能规格为该目录中的 spec.md。
- 实现任务分别写入 issues/<NN>-<slug>.md，从 01 编号，每项一个文件。
- 文件顶部以 Status: 记录状态，状态名称遵循 triage-labels.md。
- 评论追加在文件底部的 Comments 区域。
- “发布到 Issue 跟踪器”表示创建或更新上述文件，不创建远端 Issue。
- “读取任务”表示读取用户指定的任务路径或对应编号文件。
- 实现并验证完成后，勾选任务验收项并添加 `Resolution: completed`；`Status` 保留分诊标签，不新增第六类标签。选择待实现任务时排除已完成项，父规格保持不变。
