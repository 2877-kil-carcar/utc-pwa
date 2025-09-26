// ==============================
// 集結くん (PWA) - v0.4
// ① 集結時刻: 分/秒プルダウン
// ② 行軍数: 1〜10プルダウン
// ③ 行軍数デフォルト=2
// ④ 行軍1は着弾間隔なし
// ⑤ ボタン文言「行追加」→「行軍数変更」
// ==============================

// ====== （任意）簡易パスコードロック（そのまま） ======
const PASSCODE = "kil";
const LOCK_KEY = "utc-pwa-unlocked";
function setupLock() {
  const lock = document.getElementById("lock");
  if (!lock) return;
  if (!PASSCODE) return;
  if (localStorage.getItem(LOCK_KEY) === "1") return;
  lock.classList.remove("hidden");
  const btn = document.getElementById("unlockBtn");
  const input = document.getElementById("passcode");
  const msg = document.getElementById("lockMsg");
  if (btn && input) {
    btn.addEventListener("click", () => {
      if (input.value === PASSCODE) {
        localStorage.setItem(LOCK_KEY, "1");
        lock.classList.add("hidden");
      } else {
        if (msg) msg.textContent = "パスコードが違います";
      }
    });
  }
}
setupLock();

// ====== ユーティリティ ======
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const pad2 = (n) => String(n).padStart(2, "0");
const normalize3600 = (sec) => ((sec % 3600) + 3600) % 3600;

function formatMinSec(totalSec) {
  const s = normalize3600(Math.floor(totalSec));
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${pad2(min)}:${pad2(sec)}`;
}

function nowUtcMinSecVals(){
  const d = new Date();
  return { m: d.getUTCMinutes(), s: d.getUTCSeconds() };
}

// ====== 「1行軍集結時刻」プルダウン生成 ======
function fillZeroTo59(selectEl, selectedVal){
  selectEl.innerHTML = "";
  for (let i=0;i<=59;i++){
    const opt = document.createElement("option");
    opt.value = i.toString();
    opt.textContent = pad2(i);
    if (i === selectedVal) opt.selected = true;
    selectEl.appendChild(opt);
  }
}

// ====== 行軍テーブル ======
const tbody = $("#tbody");

function gapOptionsHTML(defaultVal=0){
  let html = "";
  for (let i=0;i<=30;i++){
    html += `<option value="${i}" ${i===defaultVal?'selected':''}>${i}</option>`;
  }
  return html;
}
function assembleOptionsHTML(defaultVal=300){
  return `
    <option value="60" ${defaultVal===60?'selected':''}>1分</option>
    <option value="300" ${defaultVal===300?'selected':''}>5分</option>
  `;
}

function buildRows(n){
  if (!tbody) return;
  tbody.innerHTML = "";
  const count = Math.max(1, Math.min(10, n||1)); // 1..10
  for (let i=1;i<=count;i++){
    const tr = document.createElement("tr");
    const gapCell = (i===1)
      ? `<td>-</td>` // ④ 行軍1は間隔なし
      : `<td><select class="gap" title="前の着弾からの間隔(秒)">${gapOptionsHTML(0)}</select></td>`;
    tr.innerHTML = `
      <td>${i}</td>
      <td><input type="text" class="name" value="行軍${i}"></td>
      ${gapCell}
      <td><input type="number" class="travel" min="0" step="1" value="0" title="目的地までの移動時間（秒）"></td>
      <td><select class="assemble" title="集結時間">${assembleOptionsHTML(300)}</select></td>
    `;
    tbody.appendChild(tr);
  }
}

// ====== 初期化 ======
(function init() {
  // 集結時刻 MM:SS プルダウン
  const startMin = $("#startMin");
  const startSec = $("#startSec");
  const now = nowUtcMinSecVals();
  fillZeroTo59(startMin, now.m);
  fillZeroTo59(startSec, now.s);

  // 行軍数（1..10）
  const marchCountEl = $("#marchCount");
  const initial = parseInt(marchCountEl.value, 10) || 2; // ③ デフォルト2
  buildRows(initial);
})();

// ====== イベント ======
$("#applyCountBtn")?.addEventListener("click", () => {
  const n = Math.max(1, Math.min(10, parseInt($("#marchCount").value, 10) || 1));
  buildRows(n);
});

$("#nowUtcBtn")?.addEventListener("click", () => {
  const now = nowUtcMinSecVals();
  $("#startMin").value = now.m.toString();
  $("#startSec").value = now.s.toString();
});

$("#calcBtn")?.addEventListener("click", () => {
  const result = $("#result");
  if (!result) return;
  result.innerHTML = "";

  // MM:SS を総秒に
  const base = (() => {
    const m = parseInt($("#startMin").value, 10);
    const s = parseInt($("#startSec").value, 10);
    if (Number.isNaN(m) || Number.isNaN(s)) return null;
    if (m<0||m>59||s<0||s>59) return null;
    return m*60 + s;
  })();
  if (base == null){
    result.appendChild(li("1行軍集結時刻が不正です"));
    return;
  }

  const names   = $$("#tbody .name").map(x => (x.value || "").trim() || "行軍");
  const travels = $$("#tbody .travel").map(x => Math.max(0, parseInt(x.value, 10) || 0));
  const gaps    = $$("#tbody tr").map((row, idx) => {
    if (idx===0) return 0; // ④ 行軍1は間隔なし
    const sel = row.querySelector(".gap");
    return Math.max(0, parseInt(sel?.value || "0", 10) || 0);
  });
  const assembles = $$("#tbody .assemble").map(x => Math.max(0, parseInt(x.value, 10) || 0));

  // ループ開始前に追加
  const desiredArrives = [];  // 目標着のログ

  // 行軍1（集＝base, 着＝集+集結+移動）
  let depart = normalize3600(base);
  let arrive = normalize3600(depart + assembles[0] + travels[0]);
  result.appendChild(li(`${names[0]}: 集 ${formatMinSec(depart)} → 着 ${formatMinSec(arrive)}`));

  // 行軍1の「目標着」は“通常着”そのもの
  desiredArrives[0] = arrive;
  
  // 行軍2以降
  for (let i=1;i<names.length;i++){
    const desiredArrive = normalize3600(arrive + gaps[i]); // 前着 + 間隔(0..30)
    desiredArrives[i] = desiredArrive;
    depart = normalize3600(desiredArrive - assembles[i] - travels[i]);
    arrive = normalize3600(depart + assembles[i] + travels[i]);
    result.appendChild(li(`${names[i]}: 集 ${formatMinSec(depart)} → 着 ${formatMinSec(arrive)}`));
  }

// === リカバリ表示（集結5分の行すべてを「1分」で再計算した集） ===
{
  const RECOVER = 60;   // 1分
  const FIVE    = 300;  // 5分
  let printedHeader = false;

  for (let i = 0; i < names.length; i++) { // 行軍1も対象なら i = 0 に
    if (assembles[i] === FIVE) {
      const desiredArrive = desiredArrives[i];
      if (desiredArrive == null) continue; // 念のためのガード

      const recoverAssemble = normalize3600(desiredArrive - RECOVER - travels[i]);
      if (!printedHeader) {
        result.appendChild(li(`リカバリ1分集結`));
        printedHeader = true;
      }
      result.appendChild(li(`${names[i]} 集 ${formatMinSec(recoverAssemble)}`));
    }
  }
}});

$("#copyBtn")?.addEventListener("click", async () => {
  const resultItems = $$("#result li");
  const copyMsg = $("#copyMsg");
  if (!resultItems.length) {
    if (copyMsg) copyMsg.textContent = "コピー対象がありません";
    return;
  }
  const lines = resultItems.map(el => el.textContent).join("\n");
  try {
    await navigator.clipboard.writeText(lines);
    if (copyMsg) {
      copyMsg.textContent = "コピーしました";
      setTimeout(() => (copyMsg.textContent = ""), 1500);
    }
  } catch {
    if (copyMsg) copyMsg.textContent = "クリップボードに書き込めませんでした";
  }
});

function li(text){ const el=document.createElement("li"); el.textContent=text; return el; }

// ====== PWA(Service Worker)登録（そのまま） ======
if ("serviceWorker" in navigator) {
  const isLocalhost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const isHttps = location.protocol === "https:";
  if (isLocalhost || isHttps) {
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
  }
}
