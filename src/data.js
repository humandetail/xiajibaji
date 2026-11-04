/** @typedef {{id:string,date:string,text:string,createdAt:number}} Entry */
/** @typedef {{id:string,date:string,text:string,createdAt:number,completed:boolean,recordId:string|null}} Plan */
/** @typedef {{entries:Entry[],plans:Plan[]}} Snapshot */
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
    const request = indexedDB.open("xiajibaji", 2);
    let blocked = false;
    request.onupgradeneeded = () => {
      for (const name of ["entries", "plans"])
        if (!request.result.objectStoreNames.contains(name))
          request.result.createObjectStore(name, { keyPath: "id" });
    };
    request.onblocked = () => {
      blocked = true;
      database = undefined;
      reject(new Error("请关闭其他旧版页面后刷新，以完成本地数据升级"));
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) {
        db.close();
        return;
      }
      db.onversionchange = () => {
        db.close();
        database = undefined;
      };
      resolve(db);
    };
    request.onerror = () => {
      database = undefined;
      reject(request.error);
    };
  }));
}
/** @param {(store:IDBObjectStore)=>void} action @param {string} [storeName] */
async function write(action, storeName = "entries") {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.oncomplete = () => resolve(undefined);
    tx.onabort = () => reject(tx.error ?? new Error("写入已中止"));
    tx.onerror = () => reject(tx.error);
    try {
      action(tx.objectStore(storeName));
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
/** @param {Snapshot} snapshot */
export async function replace(snapshot) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["entries", "plans"], "readwrite");
    tx.oncomplete = () => resolve(undefined);
    tx.onabort = () => reject(tx.error ?? new Error("恢复已中止"));
    tx.onerror = () => reject(tx.error);
    try {
      const records = tx.objectStore("entries"),
        plans = tx.objectStore("plans");
      records.clear();
      plans.clear();
      snapshot.entries.forEach((e) => records.add(e));
      snapshot.plans.forEach((p) => plans.add(p));
    } catch (error) {
      tx.abort();
      reject(error);
    }
  });
}
/** @param {unknown} value @returns {Snapshot & {legacy:boolean}} */
export function readBackup(value) {
  if (
    !value ||
    typeof value !== "object" ||
    !("version" in value) ||
    (value.version !== 1 && value.version !== 2) ||
    !("app" in value) ||
    value.app !== "xiajibaji" ||
    !("entries" in value) ||
    !Array.isArray(value.entries)
  )
    throw new Error("备份格式或版本不受支持");
  const seen = new Set();
  const entries = value.entries.map((item) => {
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
  /** @type {Plan[]} */ let plans = [];
  if (value.version === 2) {
    if (!("plans" in value) || !Array.isArray(value.plans))
      throw new Error("备份缺少计划数据");
    const ids = new Set(),
      links = new Set();
    plans = value.plans.map((item) => {
      if (
        !item ||
        typeof item !== "object" ||
        typeof item.id !== "string" ||
        !item.id ||
        ids.has(item.id) ||
        typeof item.date !== "string" ||
        !validDate(item.date) ||
        typeof item.text !== "string" ||
        !item.text.trim() ||
        !Number.isSafeInteger(item.createdAt) ||
        item.createdAt < 0 ||
        typeof item.completed !== "boolean" ||
        (item.completed
          ? typeof item.recordId !== "string" ||
            !item.recordId ||
            links.has(item.recordId)
          : item.recordId !== null)
      )
        throw new Error("备份包含无效或重复计划");
      ids.add(item.id);
      if (item.completed) links.add(item.recordId);
      return {
        id: item.id,
        date: item.date,
        text: item.text,
        createdAt: item.createdAt,
        completed: item.completed,
        recordId: item.recordId,
      };
    });
  }
  return { entries, plans, legacy: value.version === 1 };
}
/** @returns {Promise<Snapshot>} */
export async function loadAll() {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["entries", "plans"]);
    const entries = tx.objectStore("entries").getAll(),
      plans = tx.objectStore("plans").getAll();
    tx.oncomplete = () =>
      resolve({ entries: entries.result, plans: plans.result });
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}
/** @param {Plan} plan */
export function savePlan(plan) {
  return write((store) => {
    store.put(plan);
  }, "plans");
}
/** @param {string} id */
export function removePlan(id) {
  return write((store) => {
    store.delete(id);
  }, "plans");
}

/** @param {string} id @param {(plan:Plan,records:IDBObjectStore)=>Plan} update @returns {Promise<{before:Plan,after:Plan}>} */
async function changePlan(id, update) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["entries", "plans"], "readwrite");
    const store = tx.objectStore("plans");
    /** @type {{before:Plan,after:Plan}|undefined} */ let result;
    tx.oncomplete = () =>
      result ? resolve(result) : reject(new Error("计划不存在"));
    tx.onabort = () =>
      reject(tx.error ?? new Error("计划状态已变化，请刷新后重试"));
    tx.onerror = () => reject(tx.error);
    const request = store.get(id);
    request.onsuccess = () => {
      try {
        if (!request.result) throw new Error("计划不存在");
        const before = /** @type {Plan} */ (request.result),
          after = update(before, tx.objectStore("entries"));
        store.put(after);
        result = { before, after };
      } catch {
        tx.abort();
      }
    };
  });
}
/** @param {string} id @param {Entry} entry */
export function completePlan(id, entry) {
  return changePlan(id, (plan, records) => {
    if (plan.completed) throw new Error("已完成");
    records.add(entry);
    return { ...plan, completed: true, recordId: entry.id };
  });
}
/** @param {string} id */
export function reopenPlan(id) {
  return changePlan(id, (plan, records) => {
    if (!plan.completed) throw new Error("未完成");
    if (plan.recordId) records.delete(plan.recordId);
    return { ...plan, completed: false, recordId: null };
  });
}
/** @param {Plan[]} plans */
export function savePlans(plans) {
  return write((store) => {
    plans.forEach((plan) => store.add(plan));
  }, "plans");
}
