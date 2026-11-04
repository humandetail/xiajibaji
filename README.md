# 瞎JB记

移动端本地日历随手记：自由文字、按天多条、月度图文导出、备份恢复与离线使用。

## 开发

需要 Node.js 22+。安装开发依赖后运行：

```sh
npm install
npm run dev
```

打开 http://localhost:4175。应用是静态文件，无运行时依赖，可部署到 HTTPS 静态站点；本地开发也支持离线缓存。手机通过局域网 HTTP 访问不具备完整 PWA 能力，实际安装与离线验收应使用 HTTPS。

```sh
npm run typecheck
npm test
```

浏览器测试默认使用本机 Chrome，可通过 CHROME_PATH 指定浏览器可执行文件；未指定时使用 Playwright Chromium（首次执行 `npx playwright install chromium`）。

## 数据

记录保存在当前站点和浏览器的 IndexedDB 中，无账号和云同步。更换域名或浏览器不会自动迁移；请在“设置与备份”中导出备份。恢复采用整体替换，替换前先下载现有内容的备份并确认。

“导出记录”支持本年、本月、本周、今日和最多一年的自定义范围，用于分享所选记录；结构化备份包含所有月份，供数据恢复，两者用途不同。

已有设计稿位于 design 目录；正式规格及验收范围位于本地任务跟踪目录 .scratch。
