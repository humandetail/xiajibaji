import { today, validDate } from "./data.js";
/** @typedef {{start:string,end:string,label:string}} ExportRange */
/** @param {Date} date */
function dateText(date) {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
/** @param {string} start */
export function maximumEnd(start) {
  const date = new Date(start + "T12:00:00");
  date.setFullYear(date.getFullYear() + 1);
  date.setDate(date.getDate() - 1);
  return dateText(date);
}
/** @param {string} start @param {string} end */
export function rangeError(start, end) {
  if (!validDate(start) || !validDate(end))
    return "请选择有效的开始和结束日期。";
  if (end < start) return "结束日期不能早于开始日期。";
  if (end > maximumEnd(start)) return "自定义范围最多一年（包含首尾日期）。";
  return "";
}
/** @param {string} start @param {string} end @param {string} [label] @returns {ExportRange} */
export function dateRange(start, end, label = "自定义范围") {
  return { start, end, label };
}
/** @param {string} kind @returns {ExportRange} */
export function presetRange(kind) {
  const now = today(),
    date = new Date(now + "T12:00:00"),
    year = now.slice(0, 4),
    month = now.slice(0, 7);
  switch (kind) {
    case "year":
      return dateRange(year + "-01-01", year + "-12-31", "本年");
    case "week": {
      date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
      const start = dateText(date);
      date.setDate(date.getDate() + 6);
      return dateRange(start, dateText(date), "本周");
    }
    case "day":
      return dateRange(now, now, "今日");
    default: {
      date.setMonth(date.getMonth() + 1, 0);
      return dateRange(month + "-01", dateText(date), "本月");
    }
  }
}
/** @param {ExportRange} range */
export function rangeTitle(range) {
  return `${range.label} · ${range.start} 至 ${range.end}`;
}
