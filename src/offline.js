/** @typedef {Event & {prompt:()=>Promise<void>,userChoice:Promise<{outcome:string}>}} InstallEvent */
export async function setupOffline() {
  const state = document.getElementById("offline-state");
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("./sw.js");
      await navigator.serviceWorker.ready;
      if (state) state.textContent = "内容在本机 · 已可离线使用";
    } catch {
      if (state)
        state.textContent = "内容在本机 · 离线准备失败，请联网刷新重试";
    }
  }
  /** @type {InstallEvent|null} */ let pending = null;
  const button = document.getElementById("install-app");
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    pending = /** @type {InstallEvent} */ (event);
    if (button) button.hidden = false;
  });
  if (button)
    button.onclick = async () => {
      if (!pending) return;
      try {
        await pending.prompt();
        const choice = await pending.userChoice;
        if (choice.outcome === "accepted") button.hidden = true;
        pending = null;
      } catch {
        const help = document.getElementById("install-help");
        if (help)
          help.textContent = "请使用浏览器菜单中的“添加到主屏幕”或“安装应用”。";
      }
    };
}
