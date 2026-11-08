// 実機の確認で使う共通の部品。値を測る・端末の中に記録する・QR で自分の iPhone へ持ち出す。
// 店頭の端末には開発用の道具が無いので、記録は localStorage に貯め、最後に QR で持ち出す。

const KEY = "duo-lab-v1";

// ---- 測る ----

let probes;
function probe(css) {
  const el = document.createElement("div");
  el.style.cssText = `position:absolute;top:0;left:0;visibility:hidden;pointer-events:none;${css}`;
  document.body.append(el);
  return el;
}
function ensureProbes() {
  probes ??= {
    vw: probe("width:100vw;height:1px"),
    svw: probe("width:100svw;height:1px"),
    lvw: probe("width:100lvw;height:1px"),
    dvw: probe("width:100dvw;height:1px"),
    vh: probe("height:100vh;width:1px"),
    svh: probe("height:100svh;width:1px"),
    lvh: probe("height:100lvh;width:1px"),
    dvh: probe("height:100dvh;width:1px"),
    safe: probe("padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)"),
  };
  return probes;
}
const round = (n) => Math.round(n * 100) / 100;

export function measure() {
  const p = ensureProbes();
  const width = (el) => round(el.getBoundingClientRect().width);
  const height = (el) => round(el.getBoundingClientRect().height);
  const safe = getComputedStyle(p.safe);
  const vv = window.visualViewport;
  const root = document.documentElement;
  return {
    inner: [innerWidth, innerHeight],
    client: [root.clientWidth, root.clientHeight],
    vv: vv ? [round(vv.width), round(vv.height), round(vv.offsetLeft), round(vv.offsetTop), round(vv.scale)] : null,
    scroll: [Math.round(scrollX), Math.round(scrollY)],
    scrollSize: [root.scrollWidth, root.scrollHeight],
    screen: [screen.width, screen.height],
    dpr: devicePixelRatio,
    orient: screen.orientation ? screen.orientation.type : String(window.orientation),
    w: [width(p.vw), width(p.svw), width(p.lvw), width(p.dvw)],
    h: [height(p.vh), height(p.svh), height(p.lvh), height(p.dvh)],
    safe: [safe.paddingTop, safe.paddingRight, safe.paddingBottom, safe.paddingLeft].map(parseFloat),
  };
}

// 右の列の幅の見積もり。iOS の screen.width は向きによらず縦向きの幅なので、横向きでは高さと比べる。
export function gutterGuess(m = measure()) {
  const portrait = matchMedia("(orientation: portrait)").matches;
  const screenWidth = portrait ? m.screen[0] : m.screen[1];
  return screenWidth - m.client[0];
}

export function describe(m) {
  return [
    `画面 screen        ${m.screen.join(" × ")}   dpr ${m.dpr}   ${m.orient}`,
    `ページ inner       ${m.inner.join(" × ")}   client ${m.client.join(" × ")}`,
    `画面 − ページの幅   ${gutterGuess(m)}`,
    `visualViewport     ${m.vv ? `${m.vv[0]} × ${m.vv[1]}  位置 ${m.vv[2]}, ${m.vv[3]}  倍率 ${m.vv[4]}` : "なし"}`,
    `幅  vw/svw/lvw/dvw  ${m.w.join(" / ")}`,
    `高さ vh/svh/lvh/dvh  ${m.h.join(" / ")}`,
    `safe-area 上右下左  ${m.safe.join(" / ")}`,
    `スクロール位置      ${m.scroll.join(", ")}   文書の大きさ ${m.scrollSize.join(" × ")}`,
  ].join("\n");
}

// ---- 記録する ----

export function entries() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}
function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    alert("この端末には記録できませんでした。画面を写真に撮ってください。");
  }
}
const now = () => new Date().toTimeString().slice(0, 8);
const page = () => location.pathname.split("/").pop() + location.search;

/** 記録を1件足し、記録の件数を返す。 */
export function record(kind, label, data) {
  const list = entries();
  list.push({ kind, label, page: page(), at: now(), data });
  write(list);
  return list.length;
}

/** 確認の項目ごとの判定（同じ／違う／メモ）。同じ項目は上書きする。 */
export function observe(id, value, memo) {
  const list = entries().filter((e) => !(e.kind === "obs" && e.label === id));
  list.push({ kind: "obs", label: id, page: page(), at: now(), data: { value, memo } });
  write(list);
}
export function observation(id) {
  return entries().find((e) => e.kind === "obs" && e.label === id)?.data;
}

/** 判定の欄：シミュレーターでの結果を見せ、「同じ／違う」とメモを記録する。 */
export function observationBlock(container, id, expected) {
  const saved = observation(id);
  container.classList.add("card");
  container.innerHTML = `
    <p class="sim">シミュレーター／資料での結果：${expected}</p>
    <div class="row">
      <button type="button" data-value="same">同じ</button>
      <button type="button" data-value="diff">違う</button>
    </div>
    <input type="text" placeholder="メモ（違った所など）">
    <p class="muted" data-state></p>`;
  const memo = container.querySelector("input");
  const state = container.querySelector("[data-state]");
  const show = (data) => {
    for (const button of container.querySelectorAll("[data-value]")) button.classList.toggle("on", data?.value === button.dataset.value);
    state.textContent = data ? `記録済み（${data.value === "same" ? "同じ" : "違う"}）` : "まだ記録していません";
  };
  memo.value = saved?.memo ?? "";
  show(saved);
  for (const button of container.querySelectorAll("[data-value]")) {
    button.addEventListener("click", () => {
      observe(id, button.dataset.value, memo.value);
      show(observation(id));
    });
  }
  memo.addEventListener("change", () => {
    const current = observation(id);
    if (current) observe(id, current.value, memo.value);
  });
}

export function clearAll() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

// ---- 開閉・回転のイベント ----

/** resize・回転・表示の切り替え・スクロールの止まりを、その時の大きさと一緒に onEntry へ渡す。 */
export function watchEvents(onEntry) {
  const t0 = performance.now();
  const push = (type) => {
    const m = measure();
    onEntry({ t: Math.round(performance.now() - t0), type, inner: m.inner, vv: m.vv, screen: m.screen, scroll: m.scroll, orient: m.orient, h: m.h });
  };
  for (const type of ["resize", "orientationchange", "pageshow", "pagehide"]) addEventListener(type, () => push(type));
  document.addEventListener("visibilitychange", () => push(`visibility:${document.visibilityState}`));
  window.visualViewport?.addEventListener("resize", () => push("vv-resize"));
  let timer;
  addEventListener("scroll", () => {
    clearTimeout(timer);
    timer = setTimeout(() => push("scroll-end"), 300);
  });
  push("start");
}

// ---- QR で持ち出す ----

// QR に載せる文字は ASCII に揃える（日本語は \uXXXX に直す）。
const toAscii = (s) => s.replace(/[\u0080-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
const base64url = (s) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const CHUNK = 800;

/** 記録の全部を、受け取りのページ（r.html）の URL の列にする。1つの URL が1枚の QR になる。 */
export function exportUrls() {
  const payload = toAscii(JSON.stringify({ v: 1, ua: navigator.userAgent, saved: new Date().toISOString(), entries: entries() }));
  const data = base64url(payload);
  const id = Math.random().toString(36).slice(2, 8);
  const total = Math.max(1, Math.ceil(data.length / CHUNK));
  const base = new URL("r.html", location.href).href;
  return Array.from({ length: total }, (_, i) => `${base}#${id}.${i + 1}.${total}.${data.slice(i * CHUNK, (i + 1) * CHUNK)}`);
}

export function qrSvg(text) {
  if (!window.qrcode) return null;
  const qr = window.qrcode(0, "L");
  qr.addData(text);
  qr.make();
  return qr.createSvgTag(4, 2);
}

/** container に QR を1枚ずつ出す。前へ・次へで送る。 */
export function showExport(container) {
  const urls = exportUrls();
  let index = 0;
  const render = () => {
    const svg = qrSvg(urls[index]);
    container.innerHTML = `
      <p>自分の iPhone のカメラで読んでください。読むたびに受け取りのページが開きます（${index + 1} / ${urls.length} 枚）。</p>
      <div class="qr">${svg ?? "<p>QR の部品を読み込めませんでした（通信を確かめてください）。下の文字を写真に撮ってください。</p>"}</div>
      <div class="row">
        <button type="button" data-step="-1" ${index === 0 ? "disabled" : ""}>前へ</button>
        <button type="button" data-step="1" ${index === urls.length - 1 ? "disabled" : ""}>次へ</button>
      </div>
      ${svg ? "" : `<pre class="raw">${urls.join("\n")}</pre>`}`;
    for (const button of container.querySelectorAll("[data-step]")) {
      button.addEventListener("click", () => {
        index += Number(button.dataset.step);
        render();
      });
    }
  };
  render();
}
