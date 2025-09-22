// ==============================
// UTC 集結時間ツール (PWA) - app.js
// 入力/表示は「分:秒 (MM:SS)」。
// ラリー間隔＝「着弾間隔」。時刻は 0..3599 秒（1時間分）で循環（ラップ）させる版。
// ==============================

// ====== （任意）簡易パスコードロック ======
const PASSCODE = "kil"; // 例: "20250917"
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

// 0..3599 に正規化（前周/次周も折り返す）
function normalize3600(sec) {
  return ((sec % 3600) + 3600) % 3600;
}

// "MM:SS" → 総秒数（0..3599想定だが 0..3599 以外でも受けておき正規化で処理）
function parseMinSec(str) {
  const m = (str || "").trim().match(/^(\d{1,2}):(\d{2})$/); // 入力は 00..59:00..59 を推奨
  if (!m) return null;
  const min = parseInt(m[1], 10);
  const sec = parseInt(m[2], 10);
  if (Number.isNaN(min) || Number.isNaN(sec)) return null;
  if (min < 0 || min > 59) return null;
  if (sec < 0 || sec > 59) return null;
  return min * 60 + sec;
}

// 総秒数 → "MM:SS UTC"（常に 00..59:00..59 にラップ）
function formatMinSec(totalSec) {
  const s = normalize3600(Math.floor(totalSec));
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${pad2(min)}:${pad2(sec)}`;
}

// 現在のUTC「分:秒」
function nowUtcMinSec() {
  const d = new Date();
  return `${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}

// ====== 行軍テーブル ======
const tbody = $("#tbody");

function buildRows(n) {
  if (!tbody) return;
  tbody.innerHTML = "";
  const count = Math.max(1, Math.min(100, n || 1));
  for (let i = 1; i <= count; i++) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i}</td>
      <td><input type="text" class="name" value="行軍${i}"></td>
      <td><input type="number" class="gap"    min="0" step="1" value="${i === 1 ? 0 : 60}" title="着弾間隔（前の着弾から次の着弾までの秒）"></td>
      <td><input type="number" class="travel" min="0" step="1" value="${i === 1 ? 0 : 0}"  title="目的地までの移動時間（秒）"></td>
    `;
    tbody.appendChild(tr);
  }
}

// 初期行生成
(function initRows() {
  const marchCountEl = $("#marchCount");
  const initial = marchCountEl ? parseInt(marchCountEl.value, 10) || 3 : 3;
  buildRows(initial);
})();

// ====== イベント配線 ======
const applyCountBtn = $("#applyCountBtn");
if (applyCountBtn) {
  applyCountBtn.addEventListener("click", () => {
    const marchCountEl = $("#marchCount");
    const n = Math.max(1, Math.min(100, parseInt(marchCountEl.value, 10) || 1));
    buildRows(n);
  });
}

const fillPresetBtn = $("#fillPresetBtn");
if (fillPresetBtn) {
  fillPresetBtn.addEventListener("click", () => {
    const presetEl = $("#preset");
    const secs = parseInt(presetEl.value, 10) || 0;
    // プリセットは「着弾間隔」に適用（2行目以降）
    const gaps = $$("#tbody .gap");
    gaps.forEach((el, idx) => { if (idx > 0) el.value = secs; });
  });
}

const nowUtcBtn = $("#nowUtcBtn");
if (nowUtcBtn) {
  nowUtcBtn.addEventListener("click", () => {
    const startEl = $("#startUtc");
    if (startEl) startEl.value = nowUtcMinSec();
  });
}

const calcBtn = $("#calcBtn");
if (calcBtn) {
  calcBtn.addEventListener("click", () => {
    const result = $("#result");
    if (!result) return;

    const startEl = $("#startUtc");
    const base = parseMinSec(startEl ? startEl.value : "");
    result.innerHTML = "";

    if (base == null) {
      result.innerHTML = `<li>開始時刻が不正です（例: 12:30）</li>`;
      return;
    }

    const names   = $$("#tbody .name").map(x => (x.value || "").trim() || "行軍");
    const gaps    = $$("#tbody .gap").map(x => Math.max(0, parseInt(x.value, 10) || 0));      // 着弾間隔
    const travels = $$("#tbody .travel").map(x => Math.max(0, parseInt(x.value, 10) || 0));   // 移動秒

    // 行軍1：出発=開始、着弾=出発+移動（すべてmod 3600）
    let depart = normalize3600(base);
    let arrive = normalize3600(depart + travels[0]);
    const first = document.createElement("li");
    first.textContent = `${names[0]}: 発 ${formatMinSec(depart)} → 着 ${formatMinSec(arrive)}`;
    result.appendChild(first);

    // 行軍2以降：着弾間隔ベース、常にmod 3600で循環
    for (let i = 1; i < names.length; i++) {
      const desiredArrive = normalize3600(arrive + gaps[i]);     // 前着弾 + 間隔
      depart = normalize3600(desiredArrive - travels[i]);        // その着弾に間に合う出発（負もラップ）
      arrive = normalize3600(depart + travels[i]);               // 実際の着弾（= desiredArrive と同じになる）
      const li = document.createElement("li");
      li.textContent = `${names[i]}: 発 ${formatMinSec(depart)} → 着 ${formatMinSec(arrive)}`;
      result.appendChild(li);
    }
  });
}

const copyBtn = $("#copyBtn");
if (copyBtn) {
  copyBtn.addEventListener("click", async () => {
    const resultItems = $$("#result li");
    const copyMsg = $("#copyMsg");
    if (!resultItems.length) {
      if (copyMsg) copyMsg.textContent = "コピー対象がありません";
      return;
    }
    const lines = resultItems.map(li => li.textContent).join("\n");
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
}

// ====== PWA: Service Worker 登録 ======
if ("serviceWorker" in navigator) {
  const isLocalhost =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";
  const isHttps = location.protocol === "https:";
  if (isLocalhost || isHttps) {
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
  }
}
