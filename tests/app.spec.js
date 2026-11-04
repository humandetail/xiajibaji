import { test, expect } from "@playwright/test";
async function add(page, text, date = "2026-10-24") {
  await page.getByRole("button", { name: "记一条", exact: true }).click();
  await page.getByLabel("记录日期").fill(date);
  await page.getByLabel("记录内容").fill(text);
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
}
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-04T10:00:00+08:00") });
  await page.goto("/");
});
test("记录自由文字、补记多条，刷新后从月历读回并正确统计", async ({ page }) => {
  await add(page, "跑步3公里\n最后一公里全靠意志力。");
  await add(page, "吃火锅，和朋友一起");
  await expect(page.getByLabel("本月记录天数")).toHaveText("1");
  await expect(page.getByLabel("本月记录条数")).toHaveText("2");
  await page.reload();
  await page.getByRole("button", { name: "上个月", exact: true }).click();
  await page.getByRole("button", { name: /2026-10-24，2 条/ }).click();
  await expect(page.getByLabel("当天记录")).toContainText(
    "最后一公里全靠意志力。",
  );
  await expect(page.getByLabel("当天记录")).toContainText("吃火锅，和朋友一起");
});
test("修改移动、删除撤销与保存失败都保留正确记录", async ({ page }) => {
  await add(page, "跑步");
  await add(page, "读书");
  await page
    .getByRole("button", { name: "修改记录：跑步", exact: true })
    .click();
  await page.getByLabel("记录日期").fill("2026-10-23");
  await page.getByLabel("记录内容").fill("跑步后散步");
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(page.getByLabel("本月记录天数")).toHaveText("2");
  await page
    .getByRole("button", { name: "删除记录：跑步后散步", exact: true })
    .click();
  await expect(page.getByLabel("本月记录条数")).toHaveText("1");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(page.getByLabel("本月记录条数")).toHaveText("2");
  await page.getByRole("button", { name: "记一条", exact: true }).click();
  await page.getByLabel("记录内容").fill("不能丢的文字");
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      if (args[1] === "readwrite")
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      return original.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("保存失败");
  await expect(page.getByLabel("记录内容")).toHaveValue("不能丢的文字");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "上个月", exact: true }).click();
  await expect(page.getByLabel("本月记录条数")).toHaveText("2");
});
test("月度文字筛选、复制与实际文件一致", async ({ page }) => {
  await add(page, "跑步\n三公里");
  await add(page, "不想分享的事情");
  await page.getByRole("button", { name: "导出本月", exact: true }).click();
  await page.getByRole("button", { name: "筛选记录", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "不想分享的事情", exact: true })
    .uncheck();
  await page.getByRole("button", { name: "完成筛选", exact: true }).click();
  await page.getByRole("tab", { name: "纯文字", exact: true }).click();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载文字", exact: true }).click();
  const downloaded = await dl;
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(await downloaded.path(), "utf8");
  expect(content).toContain("共 1 条");
  expect(content).toContain("跑步\n三公里");
  expect(content).not.toContain("不想分享");
  await page.evaluate(() => {
    navigator.clipboard.writeText = async (text) => {
      window.copied = text;
    };
  });
  await page.getByRole("button", { name: "复制文字", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "已复制文字" }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.copied)).toBe(content);
});
test("月度长图完整预览并把长文字拆成多张可下载图片", async ({ page }) => {
  await add(
    page,
    "开头标记\n" +
      Array.from(
        { length: 65 },
        (_, i) => `第${i + 1}行：跑步、散步，随便记一下今天发生的事。`,
      ).join("\n") +
      "\n末尾标记",
  );
  await page.getByRole("button", { name: "导出本月", exact: true }).click();
  await page.getByRole("tab", { name: "月度长图", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "月度长图第 1 张", exact: true }),
  ).toBeVisible();
  const images = page.getByRole("img", { name: /月度长图第/ });
  await expect.poll(() => images.count()).toBeGreaterThan(1);
  await page.getByRole("button", { name: "保存长图", exact: true }).click();
  const link = page.getByRole("link", { name: "下载第 1 张", exact: true });
  await expect(link).toBeVisible();
  const waiting = page.waitForEvent("download");
  await link.click();
  const file = await waiting;
  const { readFile } = await import("node:fs/promises");
  const buffer = await readFile(await file.path());
  expect(buffer.subarray(1, 4).toString()).toBe("PNG");
  expect(buffer.readUInt32BE(16)).toBe(1080);
  expect(buffer.readUInt32BE(20)).toBeLessThanOrEqual(2400);
});
test("全量备份可恢复，替换前留存副本，无效备份不改数据", async ({ page }) => {
  await add(page, "十月记录");
  await add(page, "十一月记录", "2026-11-03");
  await page.getByRole("button", { name: "设置与备份", exact: true }).click();
  const wait = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出全部备份", exact: true }).click();
  const backup = await wait;
  const backupPath = await backup.path();
  await page.getByRole("button", { name: "关闭设置", exact: true }).click();
  await add(page, "新加的不保留");
  await page.getByRole("button", { name: "设置与备份", exact: true }).click();
  await page.getByLabel("选择备份文件").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":999}'),
  });
  await expect(page.getByRole("alert")).toContainText("不受支持");
  await page.getByLabel("选择备份文件").setInputFiles(backupPath);
  await expect(page.getByText("将整体替换为 2 条记录")).toBeVisible();
  const before = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "下载当前备份并继续", exact: true })
    .click();
  const current = await before;
  const { readFile } = await import("node:fs/promises");
  expect(
    JSON.parse(await readFile(await current.path(), "utf8")).entries,
  ).toHaveLength(3);
  await page
    .getByRole("button", { name: "确认替换全部记录", exact: true })
    .click();
  await expect(page.getByText("已恢复 2 条记录")).toBeVisible();
  await page.getByRole("button", { name: "关闭设置", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "上个月", exact: true }).click();
  await expect(page.getByLabel("本月记录条数")).toHaveText("1");
  await page.getByRole("button", { name: /2026-10-24，1 条/ }).click();
  await expect(page.getByLabel("当天记录")).toContainText("十月记录");
  await expect(page.getByLabel("当天记录")).not.toContainText("新加的不保留");
});
test("完整加载后关闭页面，断网重开仍可记录并刷新读回", async ({
  page,
  context,
}) => {
  await add(page, "在线记录");
  await expect(
    page.getByRole("status").filter({ hasText: "已可离线使用" }),
  ).toBeVisible();
  await page.close();
  await context.setOffline(true);
  const offline = await context.newPage();
  await offline.goto("/");
  await offline.getByRole("button", { name: "上个月", exact: true }).click();
  await offline.getByRole("button", { name: /2026-10-24，1 条/ }).click();
  await expect(offline.getByLabel("当天记录")).toContainText("在线记录");
  await add(offline, "离线新增");
  await offline.reload();
  await offline.getByRole("button", { name: "上个月", exact: true }).click();
  await offline.getByRole("button", { name: /2026-10-24，2 条/ }).click();
  await expect(offline.getByLabel("当天记录")).toContainText("离线新增");
});
test("六行月份、未来日期、原文安全显示与摘要数量", async ({ page }) => {
  await add(page, "<img src=x onerror=alert(1)>\n原文", "2026-08-01");
  await add(page, "第二条", "2026-08-01");
  await add(page, "第三条", "2026-08-01");
  await expect(
    page.getByRole("button", { name: /2026-08-01，3 条/ }),
  ).toContainText("另 1 条");
  await expect(page.getByLabel("当天记录")).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  await expect(page.getByLabel("当天记录").locator("img")).toHaveCount(0);
  await page.getByRole("button", { name: "今天", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /2026-11-05，0 条/ }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "记一条", exact: true }).click();
  await page.getByLabel("记录日期").fill("2026-11-05");
  await page.getByLabel("记录内容").fill("未来记录");
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(
    page.getByRole("dialog").filter({ has: page.getByLabel("记录内容") }),
  ).toBeVisible();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByLabel("本月记录条数")).toHaveText("0");
});
test("恢复事务失败保持原记录，并可取消恢复", async ({ page }) => {
  await add(page, "保留原记录");
  await page.getByRole("button", { name: "设置与备份", exact: true }).click();
  await page.getByLabel("选择备份文件").setInputFiles({
    name: "restore.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        app: "xiajibaji",
        version: 1,
        entries: [
          {
            id: "restore-id",
            date: "2026-10-01",
            text: "不应出现",
            createdAt: 1,
          },
        ],
      }),
    ),
  });
  await page
    .getByRole("button", { name: "下载当前备份并继续", exact: true })
    .click();
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      const transaction = original.apply(this, args);
      if (args[1] === "readwrite") queueMicrotask(() => transaction.abort());
      return transaction;
    };
  });
  await page
    .getByRole("button", { name: "确认替换全部记录", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("恢复失败");
  await page.getByRole("button", { name: "关闭设置", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "上个月", exact: true }).click();
  await page.getByRole("button", { name: /2026-10-24，1 条/ }).click();
  await expect(page.getByLabel("当天记录")).toContainText("保留原记录");
});
test("导出失败保留筛选并可重试，排除记录不会出现在图片或文字", async ({
  page,
}) => {
  await add(page, "公开记录");
  await add(page, "私密记录");
  await page.getByRole("button", { name: "导出本月", exact: true }).click();
  await page.getByRole("button", { name: "筛选记录", exact: true }).click();
  await page.getByRole("checkbox", { name: "私密记录", exact: true }).uncheck();
  await page.getByRole("button", { name: "完成筛选", exact: true }).click();
  await page.evaluate(() => {
    const original = CanvasRenderingContext2D.prototype.fillText;
    window.painted = [];
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      window.painted.push(text);
      return original.call(this, text, ...args);
    };
    window.encode = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      callback(null);
    };
  });
  await page.getByRole("tab", { name: "纯文字", exact: true }).click();
  await page.getByRole("tab", { name: "月度长图", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "长图生成失败" }),
  ).toBeVisible();
  await expect(page.getByText("已选 1 条记录，1 天")).toBeVisible();
  expect(await page.evaluate(() => window.painted.join("\n"))).toContain(
    "公开记录",
  );
  expect(await page.evaluate(() => window.painted.join("\n"))).not.toContain(
    "私密记录",
  );
  await page.evaluate(() => {
    HTMLCanvasElement.prototype.toBlob = window.encode;
  });
  await page.getByRole("tab", { name: "纯文字", exact: true }).click();
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => {
      throw new Error("Denied");
    };
  });
  await page.getByRole("button", { name: "复制文字", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "复制失败" }),
  ).toBeVisible();
  await expect(page.getByLabel("文字预览")).not.toContainText("私密记录");
  await page.getByRole("tab", { name: "月度长图", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "月度长图第 1 张", exact: true }),
  ).toBeVisible();
});
test("写入成功后即使读取暂时失败，也不误报失败或重复记录", async ({ page }) => {
  await page.getByRole("button", { name: "记一条", exact: true }).click();
  await page.getByLabel("记录日期").fill("2026-10-24");
  await page.getByLabel("记录内容").fill("只保存一次");
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      if (!args[1] || args[1] === "readonly")
        throw new DOMException("Read unavailable", "UnknownError");
      return original.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(
    page.getByRole("dialog").filter({ has: page.getByLabel("记录内容") }),
  ).not.toBeVisible();
  await expect(page.getByLabel("本月记录条数")).toHaveText("1");
  await page
    .getByRole("button", { name: "删除记录：只保存一次", exact: true })
    .click();
  await expect(page.getByLabel("本月记录条数")).toHaveText("0");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(page.getByLabel("本月记录条数")).toHaveText("1");
  await page.reload();
  await page.getByRole("button", { name: "上个月", exact: true }).click();
  await expect(page.getByLabel("本月记录条数")).toHaveText("1");
});
test("跨时区恢复保留原所属日期，并能读取原日期的记录", async ({ browser }) => {
  const context = await browser.newContext({
    timezoneId: "America/Los_Angeles",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.clock.install({ time: new Date("2026-11-04T00:30:00+08:00") });
  await page.goto("http://127.0.0.1:4175/");
  await page.getByRole("button", { name: "设置与备份", exact: true }).click();
  await page.getByLabel("选择备份文件").setInputFiles({
    name: "timezone.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        app: "xiajibaji",
        version: 1,
        entries: [
          {
            id: "timezone-id",
            date: "2026-11-04",
            text: "在上海记下的这一天",
            createdAt: 1,
          },
        ],
      }),
    ),
  });
  await expect(page.getByText("将整体替换为 1 条记录")).toBeVisible();
  await page
    .getByRole("button", { name: "下载当前备份并继续", exact: true })
    .click();
  await page
    .getByRole("button", { name: "确认替换全部记录", exact: true })
    .click();
  await page.getByRole("button", { name: "关闭设置", exact: true }).click();
  await page.getByRole("button", { name: /2026-11-04，1 条/ }).click();
  await expect(page.getByLabel("当天记录")).toContainText("在上海记下的这一天");
  await expect(
    page.getByRole("button", { name: "记一条", exact: true }),
  ).toBeDisabled();
  await context.close();
});
