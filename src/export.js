import { makeImages } from "./images.js";
/** @typedef {import('./data.js').Entry} Entry */
/** @param {string} id @returns {HTMLElement} */
function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(id);
  return node;
}
const dialog = /** @type {HTMLDialogElement} */ (el("export-dialog"));
const monthInput = /** @type {HTMLInputElement} */ (el("export-month"));
/** @type {Entry[]} */ let all = [];
/** @type {Set<string>} */ let selected = new Set();
let month = "",
  imageMode = true;
/** @type {string[]} */ let imageUrls = [];
let generation = 0;
/** @param {Entry[]} entries @param {string} value */
export function openExport(entries, value) {
  all = [...entries];
  month = value;
  monthInput.value = value;
  selected = new Set(monthly().map((e) => e.id));
  imageMode = true;
  el("filter-panel").hidden = true;
  el("export-content").hidden = false;
  el("export-error").textContent = "";
  render();
  dialog.showModal();
}
function monthly() {
  return all
    .filter((e) => e.date.startsWith(month))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.createdAt - b.createdAt ||
        a.id.localeCompare(b.id),
    );
}
function chosen() {
  return monthly().filter((e) => selected.has(e.id));
}
/** @param {Entry[]} entries @param {string} month */
export function asText(entries, month) {
  const days = new Set(entries.map((e) => e.date)).size;
  const lines = [
    `瞎JB记 · ${month.slice(0, 4)}年${Number(month.slice(5))}月`,
    `记录 ${days} 天，共 ${entries.length} 条`,
  ];
  let date = "";
  for (const entry of entries) {
    if (entry.date !== date) {
      date = entry.date;
      lines.push("", `${Number(date.slice(5, 7))}月${Number(date.slice(8))}日`);
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
  const items = chosen();
  el("text-preview").textContent = asText(items, month);
  el("selection-count").textContent =
    `已选 ${items.length} 条记录，${new Set(items.map((e) => e.date)).size} 天`;
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
  for (const item of monthly()) {
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
  if (!monthly().length) list.textContent = "这个月还没有记录。";
}
el("export-close").onclick = () => dialog.close();
monthInput.onchange = () => {
  if (!/^\d{4}-\d{2}$/.test(monthInput.value)) return;
  month = monthInput.value;
  selected = new Set(monthly().map((e) => e.id));
  render();
  filters();
};
el("filter-open").onclick = () => {
  el("filter-panel").hidden = false;
  el("export-content").hidden = true;
  filters();
};
el("filter-done").onclick = () => {
  el("filter-panel").hidden = true;
  el("export-content").hidden = false;
  render();
};
el("select-all").onclick = () => {
  selected = new Set(monthly().map((e) => e.id));
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
    await navigator.clipboard.writeText(asText(chosen(), month));
    el("export-error").textContent = "已复制文字";
  } catch {
    el("export-error").textContent = "复制失败，请下载文字文件或重试。";
  }
};
el("download-text").onclick = () => {
  try {
    download(
      new Blob([asText(chosen(), month)], { type: "text/plain;charset=utf-8" }),
      `瞎JB记-${month}.txt`,
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
    el("image-preview").textContent = "选几条记录，再把这个月带走。";
    return;
  }
  el("image-preview").textContent = "正在排版…";
  try {
    const blobs = await makeImages(items, month);
    if (version !== generation) return;
    el("image-preview").replaceChildren();
    imageUrls = blobs.map((blob) => URL.createObjectURL(blob));
    imageUrls.forEach((url, i) => {
      const image = document.createElement("img");
      image.src = url;
      image.alt = `月度长图第 ${i + 1} 张`;
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
    a.download = `瞎JB记-${month}-${String(i + 1).padStart(2, "0")}.png`;
    a.textContent = `下载第 ${i + 1} 张`;
    links.append(a);
  });
  el("export-error").textContent =
    `共 ${imageUrls.length} 张，点击下方链接逐张保存；手机也可长按预览图片保存。`;
  links.scrollIntoView({ block: "nearest" });
};
dialog.addEventListener("close", clearImages);
