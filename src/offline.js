/** @typedef {Event & {prompt:()=>Promise<void>,userChoice:Promise<{outcome:string}>}} InstallEvent */
export async function setupOffline() {
  const state = document.getElementById("offline-state");
  /** @type {InstallEvent|null} */ let pending = null;
  const button = document.getElementById("install-app");
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    pending = /** @type {InstallEvent} */ (event);
    if (button) button.hidden = false;
  });
  if (button)
    button.onclick = async () => {
      const request = pending;
      if (!request) return;
      pending = null;
      button.hidden = true;
      try {
        await request.prompt();
        await request.userChoice;
      } catch {
        const help = document.getElementById("install-help");
        if (help)
          help.textContent = "请使用浏览器菜单中的“添加到主屏幕”或“安装应用”。";
      }
    };
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js");
      const installing = registration.installing;
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => {
          if (!installing) return;
          const check = () => {
            if (installing.state === "redundant")
              reject(new Error("离线资源准备失败"));
          };
          installing.addEventListener("statechange", check);
          check();
        }),
      ]);
      if (state) state.textContent = "内容在本机 · 已可离线使用";
    } catch {
      if (state)
        state.textContent = "内容在本机 · 离线准备失败，请联网刷新重试";
    }
  }
}
