/** @typedef {import('./data.js').Entry} Entry */
const WIDTH = 1080,
  MAX_HEIGHT = 2400;
/** @param {Entry[]} entries @param {string} month @returns {Promise<Blob[]>} */
export async function makeImages(entries, month) {
  await document.fonts.ready;
  /** @type {HTMLCanvasElement[]} */ const pages = [];
  let canvas = document.createElement("canvas");
  let ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
  let y = 0;
  const [year, m] = month.split("-").map(Number);
  function header() {
    canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = MAX_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("此浏览器无法生成图片");
    ctx = context;
    ctx.fillStyle = "#fcfbf5";
    ctx.fillRect(0, 0, WIDTH, MAX_HEIGHT);
    ctx.fillStyle = "#292b26";
    ctx.font = "bold 47px sans-serif";
    ctx.fillText("瞎JB记", 72, 100);
    ctx.fillStyle = "#d4ec59";
    ctx.beginPath();
    ctx.arc(248, 86, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#64685e";
    ctx.font = "30px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${year} / ${String(m).padStart(2, "0")}`, 1008, 100);
    ctx.textAlign = "left";
    ctx.fillStyle = "#292b26";
    ctx.font = 'bold 78px "Songti SC",STSong,serif';
    ctx.fillText(
      `${["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"][m - 1]}月，就这样记下来了。`,
      72,
      224,
      940,
    );
    ctx.font = "40px sans-serif";
    ctx.fillText(
      `记录 ${new Set(entries.map((e) => e.date)).size} 天，共 ${entries.length} 条`,
      72,
      310,
    );
    const dates = new Set(entries.map((e) => e.date));
    const offset = (new Date(year, m - 1, 1).getDay() + 6) % 7,
      count = new Date(year, m, 0).getDate(),
      cell = 936 / 7;
    ctx.font = "30px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#64685e";
    [..."一二三四五六日"].forEach((s, i) =>
      ctx.fillText(s, 72 + cell * (i + 0.5), 390),
    );
    for (let d = 1; d <= count; d++) {
      const i = d + offset - 1,
        x = 72 + cell * ((i % 7) + 0.5),
        cy = 447 + Math.floor(i / 7) * 66;
      const date = `${month}-${String(d).padStart(2, "0")}`;
      if (dates.has(date)) {
        ctx.fillStyle = "#e4edb8";
        ctx.beginPath();
        ctx.arc(x, cy - 10, 25, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#292b26";
      ctx.fillText(String(d).padStart(2, "0"), x, cy);
    }
    ctx.textAlign = "left";
    y = 447 + Math.floor((count + offset - 1) / 7) * 66 + 60;
    ctx.strokeStyle = "#dfe2d5";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(72, y);
    ctx.lineTo(1008, y);
    ctx.stroke();
    y += 72;
  }
  function finish() {
    const trimmed = document.createElement("canvas");
    trimmed.width = WIDTH;
    trimmed.height = Math.min(MAX_HEIGHT, y + 100);
    const context = trimmed.getContext("2d");
    if (!context) throw new Error("图片生成失败");
    context.drawImage(canvas, 0, 0);
    pages.push(trimmed);
  }
  /** @param {string} date @param {boolean} [continued] */
  function dateHeading(date, continued = false) {
    ctx.font = "bold 37px sans-serif";
    ctx.fillStyle = "#292b26";
    ctx.fillText(
      `${Number(date.slice(5, 7))}月${Number(date.slice(8))}日${continued ? "（续）" : ""}`,
      72,
      y,
    );
    y += 64;
  }
  header();
  let currentDate = "";
  for (const entry of entries) {
    if (entry.date !== currentDate) {
      if (y + 150 > MAX_HEIGHT - 80) {
        finish();
        header();
      }
      dateHeading(entry.date);
      currentDate = entry.date;
    }
    ctx.font = "42px sans-serif";
    const lines = [];
    for (const paragraph of entry.text.split("\n")) {
      let line = "";
      for (const char of paragraph) {
        if (line && ctx.measureText(line + char).width > 862) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
      lines.push(line);
    }
    let first = true;
    for (const line of lines) {
      if (y + 62 > MAX_HEIGHT - 80) {
        finish();
        header();
        dateHeading(entry.date, true);
      }
      ctx.font = "42px sans-serif";
      ctx.fillStyle = "#292b26";
      if (first) {
        ctx.beginPath();
        ctx.arc(84, y - 13, 6, 0, Math.PI * 2);
        ctx.fill();
        first = false;
      }
      ctx.fillText(line, 116, y);
      y += 62;
    }
    y += 26;
  }
  finish();
  return Promise.all(
    pages.map((page, i) => {
      const context = page.getContext("2d");
      if (!context) throw new Error("图片生成失败");
      context.fillStyle = "#64685e";
      context.font = "28px sans-serif";
      context.textAlign = "right";
      context.fillText(`${i + 1} / ${pages.length}`, 1008, page.height - 32);
      return new Promise((resolve, reject) =>
        page.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("图片生成失败"))),
          "image/png",
        ),
      );
    }),
  );
}
