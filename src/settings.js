import * as data from "./data.js";
import { download } from "./export.js";
/** @param {string} id @returns {HTMLElement} */
function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(id);
  return node;
}
/** @param {(snapshot:data.Snapshot)=>void} onRestore */
export function setupSettings(onRestore) {
  const dialog = /** @type {HTMLDialogElement} */ (el("settings-dialog")),
    fileInput = /** @type {HTMLInputElement} */ (el("backup-file"));
  /** @type {(data.Snapshot & {legacy:boolean})|null} */ let pending = null;
  let busy = false,
    selection = 0;
  /** @param {data.Snapshot} snapshot @param {string} [prefix] */
  function backup(snapshot, prefix = "瞎JB记-备份") {
    download(
      new Blob(
        [
          JSON.stringify(
            {
              app: "xiajibaji",
              version: 2,
              exportedAt: new Date().toISOString(),
              entries: snapshot.entries,
              plans: snapshot.plans,
            },
            null,
            2,
          ),
        ],
        { type: "application/json;charset=utf-8" },
      ),
      `${prefix}-${data.today()}.json`,
    );
  }
  el("settings-open").onclick = () => {
    pending = null;
    selection++;
    fileInput.value = "";
    el("restore-stage").hidden = true;
    el("backup-error").textContent = "";
    el("backup-status").textContent = "";
    el("restored-plans").textContent = "";
    dialog.showModal();
  };
  el("settings-close").onclick = () => {
    if (!busy) dialog.close();
  };
  dialog.addEventListener("cancel", (event) => {
    if (busy) event.preventDefault();
  });
  el("backup-all").onclick = async () => {
    if (busy) return;
    busy = true;
    try {
      backup(await data.loadAll());
      el("backup-status").textContent =
        "已发起全部记录的备份下载，请保留文件。";
      el("backup-error").textContent = "";
    } catch {
      el("backup-error").textContent = "备份失败，请检查存储与下载权限后重试。";
    } finally {
      busy = false;
    }
  };
  fileInput.onchange = async () => {
    const version = ++selection;
    pending = null;
    el("restore-stage").hidden = true;
    el("backup-error").textContent = "";
    el("backup-status").textContent = "";
    el("restored-plans").textContent = "";
    try {
      const file = fileInput.files?.[0];
      if (!file) return;
      const items = data.readBackup(JSON.parse(await file.text()));
      if (version !== selection) return;
      pending = items;
      el("restore-summary").textContent =
        `将整体替换为 ${items.entries.length} 条记录，${items.plans.length} 项计划`;
      el("restore-legacy").textContent = items.legacy
        ? "旧版备份不含计划，恢复会清空当前全部计划。"
        : "记录与计划将一起整体替换。";
      el("restore-stage").hidden = false;
      el("backup-before-restore").hidden = false;
      el("confirm-restore").hidden = true;
    } catch (error) {
      if (version === selection)
        el("backup-error").textContent =
          error instanceof Error ? error.message : "无法读取备份";
    }
  };
  el("backup-before-restore").onclick = async () => {
    if (!pending || busy) return;
    busy = true;
    try {
      backup(await data.loadAll(), "瞎JB记-恢复前备份");
      el("backup-before-restore").hidden = true;
      el("confirm-restore").hidden = false;
      el("backup-status").textContent =
        "请确认已保留刚下载的备份，再替换全部记录。";
    } catch {
      el("backup-error").textContent =
        "当前备份未能生成，恢复已停止，现有记录不变。";
    } finally {
      busy = false;
    }
  };
  el("confirm-restore").onclick = async () => {
    if (!pending || busy) return;
    busy = true;
    fileInput.disabled = true;
    const items = pending;
    try {
      await data.replace(items);
      pending = null;
      el("restore-stage").hidden = true;
      el("backup-error").textContent = "";
      onRestore(items);
      el("backup-status").textContent = `已恢复 ${items.entries.length} 条记录`;
      el("restored-plans").textContent = `已恢复 ${items.plans.length} 项计划`;
    } catch {
      el("backup-error").textContent = "恢复失败，现有记录未被替换，请重试。";
    } finally {
      busy = false;
      fileInput.disabled = false;
    }
  };
}
