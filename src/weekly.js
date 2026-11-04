import { today, savePlans } from "./data.js";
import { shiftDate, weekRange } from "./range.js";
/** @param {string} id */
function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(id);
  return node;
}
/** @param {()=>{plans:import('./data.js').Plan[],date:string}} getState @param {(plans:import('./data.js').Plan[])=>void} onCreated */
export function setupWeekCopy(getState, onCreated) {
  const dialog = /** @type {HTMLDialogElement} */ (el("copy-dialog"));
  /** @type {{plan:import('./data.js').Plan,date:string,input:HTMLInputElement}[]} */ let rows =
    [];
  let busy = false;
  function summary() {
    const valid = rows.filter((r) => r.date >= today() && r.input.checked);
    el("copy-summary").textContent =
      `将新增 ${valid.length} 项计划，跳过 ${rows.filter((r) => r.date < today()).length} 项过去日期。`;
    /** @type {HTMLButtonElement} */ (el("copy-confirm")).disabled =
      busy || !valid.length;
  }
  el("copy-week").onclick = () => {
    const state = getState(),
      week = weekRange(state.date);
    el("copy-source").textContent =
      `来源：${week.start} 至 ${week.end}，按星期对应新增到下一周。`;
    el("copy-error").textContent = "";
    rows = [];
    el("copy-list").replaceChildren();
    for (const plan of state.plans
      .filter((p) => p.date >= week.start && p.date <= week.end)
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.createdAt - b.createdAt ||
          a.id.localeCompare(b.id),
      )) {
      const date = shiftDate(plan.date, 7),
        input = document.createElement("input");
      input.type = "checkbox";
      input.disabled = date < today();
      input.checked = !input.disabled;
      input.setAttribute("aria-label", plan.text);
      input.onchange = summary;
      const label = document.createElement("label");
      label.className = "filter-item";
      const body = document.createElement("span"),
        heading = document.createElement("small"),
        text = document.createElement("span");
      heading.textContent = `${plan.date} → ${date}${input.disabled ? " · 已过去，跳过" : ""}`;
      text.textContent = plan.text;
      body.append(heading, text);
      label.append(input, body);
      el("copy-list").append(label);
      rows.push({ plan, date, input });
    }
    if (!rows.length)
      el("copy-list").textContent = "选中日期所在周还没有计划。";
    summary();
    dialog.showModal();
  };
  el("copy-cancel").onclick = () => {
    if (!busy) dialog.close();
  };
  dialog.addEventListener("cancel", (event) => {
    if (busy) event.preventDefault();
  });
  el("copy-confirm").onclick = async () => {
    if (busy) return;
    const chosen = rows.filter((r) => r.date >= today() && r.input.checked);
    if (!chosen.length) {
      summary();
      return;
    }
    busy = true;
    summary();
    const latest = getState().plans.reduce(
      (v, p) => Math.max(v, p.createdAt + 1),
      Date.now(),
    );
    const copies = chosen.map((r, i) => ({
      id: crypto.randomUUID(),
      date: r.date,
      text: r.plan.text,
      createdAt: latest + i,
      completed: false,
      recordId: null,
    }));
    try {
      await savePlans(copies);
      onCreated(copies);
      dialog.close();
    } catch {
      el("copy-error").textContent =
        "复制失败，选择已保留，没有新增计划，请重试。";
    } finally {
      busy = false;
      summary();
    }
  };
}
