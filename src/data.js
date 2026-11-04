/** @typedef {{id:string,date:string,text:string,createdAt:number}} Entry */
/** @returns {string} */
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** @param {string} value */
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(0);
  date.setFullYear(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}
/** @type {Promise<IDBDatabase>|undefined} */
let database;
function open() {
  return (database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("xiajibaji", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("entries", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      database = undefined;
      reject(request.error);
    };
  }));
}
/** @returns {Promise<Entry[]>} */
export async function load() {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("entries");
    const request = tx.objectStore("entries").getAll();
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}
/** @param {(store:IDBObjectStore)=>void} action */
async function write(action) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("entries", "readwrite");
    tx.oncomplete = () => resolve(undefined);
    tx.onabort = () => reject(tx.error ?? new Error("写入已中止"));
    tx.onerror = () => reject(tx.error);
    try {
      action(tx.objectStore("entries"));
    } catch (error) {
      tx.abort();
      reject(error);
    }
  });
}
/** @param {Entry} entry */
export function save(entry) {
  return write((store) => {
    store.put(entry);
  });
}
/** @param {string} id */
export function remove(id) {
  return write((store) => {
    store.delete(id);
  });
}
/** @param {Entry[]} entries */
export function replace(entries) {
  return write((store) => {
    store.clear();
    entries.forEach((entry) => store.add(entry));
  });
}
/** @param {unknown} value @returns {Entry[]} */
export function readBackup(value) {
  if (
    !value ||
    typeof value !== "object" ||
    !("version" in value) ||
    value.version !== 1 ||
    !("app" in value) ||
    value.app !== "xiajibaji" ||
    !("entries" in value) ||
    !Array.isArray(value.entries)
  )
    throw new Error("备份格式或版本不受支持");
  const seen = new Set();
  return value.entries.map((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.id !== "string" ||
      !item.id ||
      seen.has(item.id) ||
      typeof item.date !== "string" ||
      !validDate(item.date) ||
      typeof item.text !== "string" ||
      !item.text.trim() ||
      !Number.isSafeInteger(item.createdAt) ||
      item.createdAt < 0
    )
      throw new Error("备份包含无效或重复记录");
    seen.add(item.id);
    return {
      id: item.id,
      date: item.date,
      text: item.text,
      createdAt: item.createdAt,
    };
  });
}
