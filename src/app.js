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
    button.setAttribute("aria-label", `${date}，${items.length} 条`);
    button.setAttribute("aria-pressed", String(date === selected));
    button.disabled = date > data.today() && !items.length;
    const num = document.createElement("span");
    num.className = "num";
    num.textContent = String(d).padStart(2, "0");
    button.append(num);
    for (const item of items.slice(0, 2)) {
      const preview = document.createElement("span");
      preview.className = "snippet";
      preview.textContent = item.text.split("\n")[0];
      button.append(preview);
    }
    if (items.length > 2) {
      const more = document.createElement("span");
      more.className = "more";
      more.textContent = `另 ${items.length - 2} 条`;
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
  const old = entries.find((e) => e.id === editing);
  if (
    !data.validDate(dateInput.value) ||
    (dateInput.value > data.today() && dateInput.value !== old?.date) ||
    !textInput.value.trim()
  ) {
    el("#save-error").textContent = "请选择今天或过去的日期，并写下记录内容。";
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
        entries.reduce(
          (latest, e) => Math.max(latest, e.createdAt + 1),
          Date.now(),
        ),
    };
    await data.save(entry);
    entries = [...entries.filter((item) => item.id !== entry.id), entry];
    selected = entry.date;
    month = selected.slice(0, 7);
    render();
    editor.close();
    toast("已保存记录");
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
    entries = await data.load();
    render();
  } catch {
    render();
    toast("无法读取本地记录，请检查浏览器存储后刷新");
  }
}
await start();

el("#export-open").onclick = () => openExport(entries);

setupSettings((restoredEntries) => {
  entries = restoredEntries;
  deleted = null;
  clearTimeout(toastTimer);
  el("#toast").hidden = true;
  render();
});

void setupOffline();
