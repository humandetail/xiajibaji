import { setupWeekCopy } from "./weekly.js";
import { setupOffline } from "./offline.js";
import { setupSettings } from "./settings.js";
import { openExport } from "./export.js";
import * as data from "./data.js";
/** @param {string} selector @returns {HTMLElement} */
function el(selector) {
  const node = document.querySelector(selector);
  if (!(node instanceof HTMLElement))
    throw new Error(`缺少界面元素 ${selector}`);
  return node;
}
const editor = /** @type {HTMLDialogElement} */ (el("#editor"));
const form = /** @type {HTMLFormElement} */ (el("#entry-form"));
const dateInput = /** @type {HTMLInputElement} */ (
  form.elements.namedItem("date")
);
const textInput = /** @type {HTMLTextAreaElement} */ (
  form.elements.namedItem("text")
);
/** @type {data.Entry[]} */ let entries = [];
/** @type {data.Plan[]} */ let plans = [];
let planMode = false;
let completing = "";
/** @type {data.Plan|null} */ let reopening = null;
let selected = data.today(),
  month = selected.slice(0, 7),
  editing = "",
  busy = false;
/** @type {data.Entry|null} */ let deleted = null;
/** @type {ReturnType<typeof setTimeout>|undefined} */ let toastTimer;
/** @param {string} text @param {boolean} [undo] */
function toast(text, undo = false) {
  clearTimeout(toastTimer);
  el("#toast span").textContent = text;
  el("#undo").hidden = !undo;
  el("#toast").hidden = false;
  toastTimer = setTimeout(
    () => {
      el("#toast").hidden = true;
      deleted = null;
    },
    undo ? 8000 : 4000,
  );
}
/** @param {string} date */
function dayName(date) {
  return new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(
    new Date(date + "T12:00:00"),
  );
}
/** @param {data.Entry} a @param {data.Entry} b */
function order(a, b) {
  return a.createdAt - b.createdAt || a.id.localeCompare(b.id);
}
function render() {
  const [y, m] = month.split("-").map(Number);
  el("#year").textContent = `${y} 年`;
  el("#month-title").textContent =
    [
      "一",
      "二",
      "三",
      "四",
      "五",
      "六",
      "七",
      "八",
      "九",
      "十",
      "十一",
      "十二",
    ][m - 1] + "月";
  const monthly = entries.filter((e) => e.date.startsWith(month));
  el('[aria-label="本月记录天数"]').textContent = String(
    new Set(monthly.map((e) => e.date)).size,
  );
  el('[aria-label="本月记录条数"]').textContent = String(monthly.length);
  const monthlyPlans = plans.filter((p) => p.date.startsWith(month));
  el('[aria-label="本月计划数量"]').textContent = String(monthlyPlans.length);
  el("#pending-count").textContent =
    `${monthlyPlans.filter((p) => !p.completed).length} 项未完成`;
  const grid = el("#calendar");
  grid.replaceChildren();
  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7,
    count = new Date(y, m, 0).getDate();
  for (let i = 0; i < Math.ceil((offset + count) / 7) * 7; i++) {
    const d = i - offset + 1;
    if (d < 1 || d > count) {
      const empty = document.createElement("div");
      empty.className = "day empty";
      grid.append(empty);
      continue;
    }
    const date = `${month}-${String(d).padStart(2, "0")}`,
      items = monthly.filter((e) => e.date === date).sort(order),
      button = document.createElement("button");
    button.type = "button";
    button.className = `day${items.length ? " has" : ""}${date === selected ? " selected" : ""}`;
    const dayPlans = monthlyPlans.filter((p) => p.date === date).sort(order);
    button.classList.toggle("planned", dayPlans.length > 0);
    button.setAttribute(
      "aria-label",
      `${date}，${items.length} 条，${dayPlans.length} 项计划`,
    );
    button.setAttribute("aria-pressed", String(date === selected));
    button.disabled = false;
    const num = document.createElement("span");
    num.className = "num";
    num.textContent = String(d).padStart(2, "0");
    button.append(num);
    const previews = [
      ...items.map((item) => ({ text: item.text, plan: false })),
      ...dayPlans.map((item) => ({
        text: (item.completed ? "✓ " : "◇ ") + item.text,
        plan: true,
      })),
    ];
    for (const item of previews.slice(0, 2)) {
      const preview = document.createElement("span");
      preview.className = "snippet" + (item.plan ? " plan-snippet" : "");
      preview.textContent = item.text.split("\n")[0];
      button.append(preview);
    }
    if (previews.length > 2) {
      const more = document.createElement("span");
      more.className = "more";
      more.textContent = `另 ${previews.length - 2} ${dayPlans.length ? "项" : "条"}`;
      button.append(more);
    }
    button.onclick = () => {
      selected = date;
      render();
    };
    grid.append(button);
  }
  /** @type {HTMLButtonElement} */ (el("#add")).disabled =
    selected > data.today();
  /** @type {HTMLButtonElement} */ (el("#add-plan")).disabled =
    selected < data.today();
  renderPlans();
  const dayEntries = entries.filter((e) => e.date === selected).sort(order);
  el("#day-title").textContent =
    `${Number(selected.slice(5, 7))} 月 ${Number(selected.slice(8))} 日`;
  const weekday = document.createElement("small");
  weekday.textContent = dayName(selected);
  el("#day-title").append(weekday);
  el("#day-count").textContent = `${dayEntries.length} 条`;
  const list = el("#entries");
  list.replaceChildren();
  if (!dayEntries.length) {
    const p = document.createElement("p");
    p.className = "empty-state";
    p.textContent = "这一天还没记什么。\n想起什么，就记一条。";
    list.append(p);
  }
  for (const entry of dayEntries) {
    const article = document.createElement("article");
    article.className = "entry";
    const p = document.createElement("p");
    p.textContent = entry.text;
    article.append(p);
    const actions = document.createElement("div");
    actions.className = "entry-actions";
    for (const [label, action] of /** @type {[string,()=>void][]} */ ([
      ["修改", () => openEditor(entry)],
      ["删除", () => deleteEntry(entry)],
    ])) {
      const button = document.createElement("button");
      button.textContent = label;
      button.setAttribute(
        "aria-label",
        `${label}记录：${entry.text.slice(0, 20)}`,
      );
      button.onclick = action;
      actions.append(button);
    }
    article.append(actions);
    list.append(article);
  }
}
/** @param {data.Entry} [entry] */
function openEditor(entry) {
  planMode = false;
  completing = "";
  dateInput.setAttribute("aria-label", "记录日期");
  textInput.setAttribute("aria-label", "记录内容");
  el("#date-caption").textContent = "记录日期";
  el("#editor-prompt").textContent = "今天，又发生了什么？";
  dateInput.min = "";
  el(".save").setAttribute("aria-label", "保存记录");
  editing = entry?.id ?? "";
  dateInput.value = entry?.date ?? selected;
  dateInput.max =
    entry && entry.date > data.today() ? entry.date : data.today();
  textInput.value = entry?.text ?? "";
  el("#editor-title").textContent = entry ? "修改记录" : "记一条";
  el("#save-error").textContent = "";
  el("#letter-count").textContent = `${textInput.value.length} 字`;
  editor.showModal();
  textInput.focus();
}
form.onsubmit = async (/** @type {SubmitEvent} */ event) => {
  event.preventDefault();
  if (busy) return;
  el("#save-error").textContent = "";
  const old = (planMode ? plans : entries).find((e) => e.id === editing);
  if (
    !data.validDate(dateInput.value) ||
    (planMode
      ? dateInput.value < data.today() && dateInput.value !== old?.date
      : dateInput.value > data.today() && dateInput.value !== old?.date) ||
    !textInput.value.trim()
  ) {
    el("#save-error").textContent = planMode
      ? "计划请选择今天或未来的日期，并填写内容。"
      : "请选择今天或过去的日期，并写下记录内容。";
    return;
  }
  busy = true;
  dateInput.disabled = true;
  textInput.readOnly = true;
  const saveButton = /** @type {HTMLButtonElement} */ (
    form.querySelector(".save")
  );
  saveButton.disabled = true;
  try {
    const entry = {
      id: old?.id ?? crypto.randomUUID(),
      date: dateInput.value,
      text: textInput.value,
      createdAt:
        old?.createdAt ??
        [...entries, ...plans].reduce(
          (latest, e) => Math.max(latest, e.createdAt + 1),
          Date.now(),
        ),
    };
    if (planMode) {
      const previous = plans.find((p) => p.id === editing);
      const plan = {
        ...entry,
        completed: previous?.completed ?? false,
        recordId: previous?.recordId ?? null,
      };
      await data.savePlan(plan);
      plans = [...plans.filter((p) => p.id !== plan.id), plan];
    } else if (completing) {
      const result = await data.completePlan(completing, entry);
      plans = plans.map((p) => (p.id === result.after.id ? result.after : p));
      entries = [...entries, entry];
    } else {
      await data.save(entry);
      entries = [...entries.filter((item) => item.id !== entry.id), entry];
    }
    if (!completing) {
      selected = entry.date;
      month = selected.slice(0, 7);
    }
    render();
    editor.close();
    toast(
      completing
        ? "计划已完成，已生成记录"
        : planMode
          ? "已保存计划"
          : "已保存记录",
    );
  } catch {
    el("#save-error").textContent =
      "保存失败，文字还在。请检查浏览器存储后重试。";
  } finally {
    busy = false;
    saveButton.disabled = false;
    dateInput.disabled = false;
    textInput.readOnly = false;
  }
};
textInput.oninput = () => {
  el("#letter-count").textContent = `${textInput.value.length} 字`;
};
editor.addEventListener("cancel", (e) => {
  if (busy) e.preventDefault();
});
el("[data-close]").onclick = () => {
  if (!busy) editor.close();
};
el("#add").onclick = () => openEditor();
/** @param {data.Entry} entry */
async function deleteEntry(entry) {
  try {
    await data.remove(entry.id);
    entries = entries.filter((item) => item.id !== entry.id);
    deleted = entry;
    render();
    toast("已删除记录", true);
  } catch {
    toast("删除失败，记录已保留");
  }
}
el("#undo").onclick = async () => {
  if (!deleted) return;
  const entry = deleted;
  try {
    await data.save(entry);
    entries = [...entries.filter((item) => item.id !== entry.id), entry];
    deleted = null;
    render();
    toast("已撤销删除");
  } catch {
    toast("撤销失败，请重试", true);
  }
};
/** @param {number} amount */ function moveMonth(amount) {
  const [y, m] = month.split("-").map(Number),
    d = new Date(y, m - 1 + amount, 1);
  month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  selected = month === data.today().slice(0, 7) ? data.today() : month + "-01";
  render();
}
el("#previous").onclick = () => moveMonth(-1);
el("#next").onclick = () => moveMonth(1);
el("#today").onclick = () => {
  selected = data.today();
  month = selected.slice(0, 7);
  render();
};
async function start() {
  try {
    const snapshot = await data.loadAll();
    entries = snapshot.entries;
    plans = snapshot.plans;
    render();
  } catch (error) {
    render();
    toast(
      error instanceof Error && error.message.startsWith("请关闭其他旧版")
        ? error.message
        : "无法读取本地内容，请检查浏览器存储后刷新",
    );
  }
}
await start();

el("#export-open").onclick = () => openExport(entries, plans);

setupSettings((snapshot) => {
  entries = snapshot.entries;
  plans = snapshot.plans;
  deleted = null;
  clearTimeout(toastTimer);
  el("#toast").hidden = true;
  render();
});

void setupOffline();

/** @param {data.Plan} [plan] */
function openPlanEditor(plan) {
  planMode = true;
  completing = "";
  dateInput.setAttribute("aria-label", "计划日期");
  textInput.setAttribute("aria-label", "计划内容");
  el("#date-caption").textContent = "计划日期";
  el("#editor-prompt").textContent = "准备做点什么？";
  editing = plan?.id ?? "";
  dateInput.value = plan?.date ?? selected;
  dateInput.max = "";
  dateInput.min = plan && plan.date < data.today() ? plan.date : data.today();
  textInput.value = plan?.text ?? "";
  el("#editor-title").textContent = plan ? "修改计划" : "新增计划";
  el(".save").setAttribute("aria-label", "保存计划");
  el("#save-error").textContent = "";
  el("#letter-count").textContent = `${textInput.value.length} 字`;
  editor.showModal();
  textInput.focus();
}
el("#add-plan").onclick = () => openPlanEditor();
function renderPlans() {
  const list = el("#plans");
  list.replaceChildren();
  const items = plans.filter((p) => p.date === selected).sort(order);
  if (!items.length) {
    const p = document.createElement("p");
    p.className = "empty-state";
    p.textContent = "这一天还没有计划。";
    list.append(p);
  }
  for (const plan of items) {
    const article = document.createElement("article");
    article.className = "entry plan-entry";
    const content = document.createElement("div");
    content.className = "plan-content";
    const state = document.createElement("span");
    state.className = "plan-state";
    state.textContent = plan.completed
      ? "已完成"
      : plan.date < data.today()
        ? "未完成·已过期"
        : "未完成";
    const p = document.createElement("p");
    p.textContent = plan.text;
    content.append(state, p);
    article.append(content);
    const actions = document.createElement("div");
    actions.className = "entry-actions";
    for (const [label, action] of /** @type {[string,()=>void][]} */ ([
      [
        plan.completed ? "撤销完成" : "完成",
        () => (plan.completed ? openReopen(plan) : openComplete(plan)),
      ],
      ["修改", () => openPlanEditor(plan)],
      ["删除", () => deletePlan(plan)],
    ])) {
      const button = document.createElement("button");
      button.textContent = label;
      button.setAttribute(
        "aria-label",
        `${label === "撤销完成" ? label : label + "计划"}：${plan.text.split("\n")[0].slice(0, 20)}`,
      );
      button.onclick = action;
      actions.append(button);
    }
    article.append(actions);
    list.append(article);
  }
}
/** @param {data.Plan} plan */
async function deletePlan(plan) {
  try {
    await data.removePlan(plan.id);
    plans = plans.filter((p) => p.id !== plan.id);
    render();
    toast("已删除计划，已有记录保留");
  } catch {
    toast("删除计划失败，请重试");
  }
}

/** @param {data.Plan} plan */
function openComplete(plan) {
  openEditor();
  completing = plan.id;
  el("#editor-prompt").textContent = "实际做了什么？";
  dateInput.value = data.today();
  dateInput.max = data.today();
  textInput.value = plan.text;
  el("#editor-title").textContent = "完成计划";
  el(".save").setAttribute("aria-label", "确认完成计划");
  el("#letter-count").textContent = `${plan.text.length} 字`;
}
/** @param {data.Plan} plan */
function openReopen(plan) {
  reopening = plan;
  const record = entries.find((e) => e.id === plan.recordId);
  el("#reopen-record").textContent = record
    ? `${record.date}\n${record.text}`
    : "关联记录已删除，只恢复计划为未完成。";
  el("#reopen-error").textContent = "";
  /** @type {HTMLDialogElement} */ (el("#reopen-dialog")).showModal();
}
el("#reopen-cancel").onclick = () => {
  if (!busy) /** @type {HTMLDialogElement} */ (el("#reopen-dialog")).close();
};
el("#reopen-dialog").addEventListener("cancel", (event) => {
  if (busy) event.preventDefault();
});
el("#reopen-confirm").onclick = async () => {
  if (!reopening || busy) return;
  busy = true;
  const button = /** @type {HTMLButtonElement} */ (el("#reopen-confirm"));
  button.disabled = true;
  try {
    const result = await data.reopenPlan(reopening.id);
    plans = plans.map((p) => (p.id === result.after.id ? result.after : p));
    entries = entries.filter((e) => e.id !== result.before.recordId);
    deleted = null;
    render();
    /** @type {HTMLDialogElement} */ (el("#reopen-dialog")).close();
    toast("已撤销完成");
  } catch {
    el("#reopen-error").textContent =
      "撤销失败，原记录和计划状态保持不变，请重试。";
  } finally {
    busy = false;
    button.disabled = false;
  }
};

setupWeekCopy(
  () => ({ plans, date: selected }),
  (copies) => {
    plans = [...plans, ...copies];
    render();
    toast(`已新增 ${copies.length} 项独立计划`);
  },
);
