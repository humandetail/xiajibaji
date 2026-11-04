import { today } from "./data.js";
import {
  presetRange,
  dateRange,
  rangeError,
  rangeTitle,
  maximumEnd,
} from "./range.js";
import { makeImages } from "./images.js";
/** @typedef {import('./data.js').Entry} Entry */
/** @param {string} id @returns {HTMLElement} */
function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(id);
  return node;
}
const dialog = /** @type {HTMLDialogElement} */ (el("export-dialog"));
const startInput = /** @type {HTMLInputElement} */ (el("range-start"));
const endInput = /** @type {HTMLInputElement} */ (el("range-end"));
/** @type {Entry[]} */ let all = [];
/** @type {Entry[]} */ let records = [];
/** @type {import("./data.js").Plan[]} */ let plans = [];
let kind = "record";
/** @type {Set<string>} */ let selected = new Set();
let range = presetRange("month");
let imageMode = true;
let rangeValid = true;
/** @type {string[]} */ let imageUrls = [];
let generation = 0;
/** @param {Entry[]} entries @param {import("./data.js").Plan[]} [planItems] */
export function openExport(entries, planItems = []) {
  records = [...entries];
  plans = [...planItems];
  all = records;
  kind = "record";
  document
    .querySelectorAll("[data-export-type]")
    .forEach((node) =>
      node.setAttribute(
        "aria-pressed",
        String(node.getAttribute("data-export-type") === kind),
      ),
    );
  range = presetRange("month");
  rangeValid = true;
  startInput.value = range.start;
  endInput.value = range.end;
  el("custom-range").hidden = true;
  el("range-error").textContent = "";
  document
    .querySelectorAll("[data-range]")
    .forEach((node) =>
      node.setAttribute(
        "aria-pressed",
        String(node.getAttribute("data-range") === "month"),
      ),
    );
  selected = new Set(inRange().map((e) => e.id));
  imageMode = true;
  el("filter-panel").hidden = true;
  el("export-content").hidden = false;
  el("export-error").textContent = "";
  /** @type {HTMLButtonElement} */ (el("filter-open")).disabled = false;
  render();
  dialog.showModal();
}
function inRange() {
  return all
    .filter((e) => e.date >= range.start && e.date <= range.end)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.createdAt - b.createdAt ||
        a.id.localeCompare(b.id),
    );
}
function chosen() {
  return inRange().filter((e) => selected.has(e.id));
}
function exportItems() {
  return chosen().map((item) => {
    if (kind !== "plan") return item;
    const plan = /** @type {import('./data.js').Plan} */ (item);
    return {
      ...item,
      text: `[${plan.completed ? "已完成" : plan.date < today() ? "未完成·已过期" : "未完成"}] ${plan.text}`,
    };
  });
}
/** @param {Entry[]} entries @param {import("./range.js").ExportRange} range @param {string} [type] */
export function asText(entries, range, type = "record") {
  const days = new Set(entries.map((e) => e.date)).size;
  const lines = [
    `瞎JB记 · ${type === "plan" ? "计划 · " : ""}${rangeTitle(range)}`,
    `${type === "plan" ? "安排" : "记录"} ${days} 天，共 ${entries.length} ${type === "plan" ? "项计划" : "条"}`,
  ];
  let date = "";
  for (const entry of entries) {
    if (entry.date !== date) {
      date = entry.date;
      lines.push("", date);
    }
    lines.push(`• ${entry.text}`);
  }
  return lines.join("\n") + "\n";
}
/** @param {Blob} blob @param {string} filename */
export function download(blob, filename) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function render() {
  if (!rangeValid) return;
  el("range-description").textContent = rangeTitle(range);
  const items = exportItems();
  el("text-preview").textContent = asText(items, range, kind);
  el("selection-count").textContent =
    `已选 ${items.length} ${kind === "plan" ? "项计划" : "条记录"}，${new Set(items.map((e) => e.date)).size} 天`;
  el("image-preview").hidden = !imageMode;
  el("text-preview").hidden = imageMode;
  el("copy-text").hidden = imageMode;
  el("download-text").hidden = imageMode;
  el("make-images").hidden = !imageMode;
  el("image-tab").setAttribute("aria-selected", String(imageMode));
  el("text-tab").setAttribute("aria-selected", String(!imageMode));
  for (const id of ["copy-text", "download-text", "make-images"])
    /** @type {HTMLButtonElement} */ (el(id)).disabled = !items.length;
  el("image-downloads").replaceChildren();
  if (imageMode) void renderImages(items);
  else clearImages();
}
function filters() {
  const list = el("filter-list");
  list.replaceChildren();
  for (const item of inRange()) {
    const label = document.createElement("label");
    label.className = "filter-item";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = selected.has(item.id);
    input.setAttribute("aria-label", item.text);
    input.onchange = () => {
      if (input.checked) selected.add(item.id);
      else selected.delete(item.id);
      render();
    };
    const content = document.createElement("span"),
      date = document.createElement("small");
    date.textContent = item.date;
    const text = document.createElement("span");
    text.textContent = item.text;
    content.append(date, text);
    label.append(input, content);
    list.append(label);
  }
  if (!inRange().length) list.textContent = "这个范围还没有记录。";
}
el("export-close").onclick = () => dialog.close();
function applyRange() {
  const error = rangeError(startInput.value, endInput.value);
  rangeValid = !error;
  el("range-error").textContent = error;
  el("export-content").hidden = !rangeValid || !el("filter-panel").hidden;
  /** @type {HTMLButtonElement} */ (el("filter-open")).disabled = !rangeValid;
  clearImages();
  el("image-downloads").replaceChildren();
  el("export-error").textContent = "";
  if (!rangeValid) return;
  range = dateRange(startInput.value, endInput.value, range.label);
  selected = new Set(inRange().map((e) => e.id));
  render();
  filters();
}
startInput.onchange = () => {
  endInput.min = startInput.value;
  if (startInput.value) endInput.max = maximumEnd(startInput.value);
  applyRange();
};
endInput.onchange = applyRange;
document.querySelectorAll("[data-range]").forEach((node) =>
  node.addEventListener("click", () => {
    const kind = node.getAttribute("data-range");
    document
      .querySelectorAll("[data-range]")
      .forEach((button) =>
        button.setAttribute("aria-pressed", String(button === node)),
      );
    el("custom-range").hidden = kind !== "custom";
    if (kind === "custom") {
      range = { ...range, label: "自定义范围" };
      startInput.value = range.start;
      endInput.value = range.end;
    } else {
      range = presetRange(kind ?? "month");
      startInput.value = range.start;
      endInput.value = range.end;
    }
    endInput.min = startInput.value;
    endInput.max = maximumEnd(startInput.value);
    applyRange();
  }),
);
el("filter-open").onclick = () => {
  el("filter-panel").hidden = false;
  el("export-content").hidden = true;
  filters();
};
el("filter-done").onclick = () => {
  el("filter-panel").hidden = true;
  el("export-content").hidden = !rangeValid;
  render();
};
el("select-all").onclick = () => {
  selected = new Set(inRange().map((e) => e.id));
  render();
  filters();
};
el("select-none").onclick = () => {
  selected.clear();
  render();
  filters();
};
el("text-tab").onclick = () => {
  imageMode = false;
  render();
};
el("image-tab").onclick = () => {
  imageMode = true;
  render();
};
el("copy-text").onclick = async () => {
  try {
    await navigator.clipboard.writeText(asText(exportItems(), range, kind));
    el("export-error").textContent = "已复制文字";
  } catch {
    el("export-error").textContent = "复制失败，请下载文字文件或重试。";
  }
};
el("download-text").onclick = () => {
  try {
    download(
      new Blob([asText(exportItems(), range, kind)], {
        type: "text/plain;charset=utf-8",
      }),
      `瞎JB记-${kind === "plan" ? "计划-" : ""}${range.start}_${range.end}.txt`,
    );
    el("export-error").textContent = "已发起文字下载";
  } catch {
    el("export-error").textContent = "文字下载失败，请重试。";
  }
};

function clearImages() {
  generation++;
  imageUrls.forEach((url) => URL.revokeObjectURL(url));
  imageUrls = [];
  el("image-preview").replaceChildren();
}
/** @param {Entry[]} items */
async function renderImages(items) {
  clearImages();
  const version = generation;
  const button = /** @type {HTMLButtonElement} */ (el("make-images"));
  button.disabled = true;
  if (!items.length) {
    el("image-preview").textContent = "选几条记录，再把这些日子带走。";
    return;
  }
  el("image-preview").textContent = "正在排版…";
  try {
    const blobs = await makeImages(items, range, kind);
    if (version !== generation) return;
    el("image-preview").replaceChildren();
    imageUrls = blobs.map((blob) => URL.createObjectURL(blob));
    imageUrls.forEach((url, i) => {
      const image = document.createElement("img");
      image.src = url;
      image.alt = `${kind === "plan" ? "计划" : "回顾"}长图第 ${i + 1} 张`;
      el("image-preview").append(image);
    });
    button.disabled = false;
  } catch {
    if (version === generation) {
      el("image-preview").replaceChildren();
      el("export-error").textContent =
        "长图生成失败，筛选已保留。请切换格式后重试。";
    }
  }
}
el("make-images").onclick = () => {
  const links = el("image-downloads");
  links.replaceChildren();
  imageUrls.forEach((url, i) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `瞎JB记-${kind === "plan" ? "计划-" : ""}${range.start}_${range.end}-${String(i + 1).padStart(2, "0")}.png`;
    a.textContent = `下载第 ${i + 1} 张`;
    links.append(a);
  });
  el("export-error").textContent =
    `共 ${imageUrls.length} 张，点击下方链接逐张保存；手机也可长按预览图片保存。`;
  links.scrollIntoView({ block: "nearest" });
};
dialog.addEventListener("close", clearImages);

document.querySelectorAll("[data-export-type]").forEach((node) =>
  node.addEventListener("click", () => {
    kind = node.getAttribute("data-export-type") ?? "record";
    all = kind === "plan" ? plans : records;
    document
      .querySelectorAll("[data-export-type]")
      .forEach((button) =>
        button.setAttribute("aria-pressed", String(button === node)),
      );
    selected = new Set(inRange().map((e) => e.id));
    el("export-error").textContent = "";
    render();
    filters();
  }),
);
