/* Общий JS: карта на главной + страницы достопримечательностей */

/* ---------- Фото: ищем photos/ID-1.jpg, ID-2.jpg ... автоматически ---------- */
const EXTS = ["jpg", "jpeg", "png", "webp", "JPG", "JPEG", "PNG"];

function tryLoad(src) {
  return new Promise(res => {
    const i = new Image();
    i.onload = () => res(src);
    i.onerror = () => res(null);
    i.src = src;
  });
}
async function findPhoto(id, n) {
  const found = await Promise.all(EXTS.map(e => tryLoad(`photos/${id}-${n}.${e}`)));
  return found.find(Boolean) || null;
}
async function findAllPhotos(id) {
  const list = [];
  for (let n = 1; n <= 12; n++) {
    const s = await findPhoto(id, n);
    if (!s) break;
    list.push(s);
  }
  return list;
}

// Заглушка, если фото нет
function placeholder(label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#0B1426"/><stop offset="1" stop-color="#14223D"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50%" y="48%" fill="#E8B94A" font-family="Calibri,Arial" font-size="56" text-anchor="middle">${label}</text>
    <text x="50%" y="58%" fill="#ffffff" fill-opacity=".6" font-family="Calibri,Arial" font-size="34" text-anchor="middle">фото скоро появится</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
function makeImg(src, alt, cls) {
  const img = document.createElement("img");
  img.src = src; img.alt = alt;
  if (cls) img.className = cls;
  return img;
}

/* ---------- Главная: карта ---------- */
function makePinIcon(p) {
  const el = document.createElement("div");
  el.className = "pin side-" + (p.labelSide || "right");
  const dot = document.createElement("span"); dot.className = "pin-dot";
  const label = document.createElement("span"); label.className = "pin-label";
  label.textContent = p.title;
  el.append(dot, label);
  findPhoto(p.id, 1).then(src => {
    if (src) { dot.style.backgroundImage = `url("${src}")`; dot.classList.add("has-photo"); }
  });
  return L.divIcon({ className: "", html: el, iconSize: [46, 46], iconAnchor: [23, 23], popupAnchor: [0, -26] });
}

function initMap() {
  const map = L.map("map", { zoomControl: true }).setView([50.424, 41.016], 16);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  PLACES.forEach(p => {
    const box = document.createElement("div"); box.className = "popup";
    const h = document.createElement("h3"); h.textContent = p.title;
    const d = document.createElement("p"); d.textContent = p.short;
    const a = document.createElement("a");
    a.href = p.id + ".html"; a.className = "btn"; a.textContent = "Подробнее";
    box.append(h, d, a);
    L.marker([p.lat, p.lng], { icon: makePinIcon(p), title: p.title }).addTo(map).bindPopup(box);
  });

  // Приближаем карту так, чтобы все места были видны максимально крупно
  map.fitBounds(L.latLngBounds(PLACES.map(p => [p.lat, p.lng])), {
    paddingTopLeft: [100, 60], paddingBottomRight: [100, 60], maxZoom: 17
  });
}

/* ---------- Вопросы из questions.txt ---------- */
async function loadQuestions() {
  const res = {};
  const r = await fetch("questions.txt?v=" + Date.now());
  if (!r.ok) throw new Error("questions.txt not found");
  const lines = (await r.text()).replace(/\r/g, "").split("\n");
  let cur = null, q = null;
  const flush = () => { if (cur && q && q.q && q.options.length > 1) res[cur].push(q); q = null; };
  lines.forEach(raw => {
    const line = raw.trim();
    if (line.startsWith("==")) { flush(); cur = line.slice(2).trim().toLowerCase(); res[cur] = res[cur] || []; return; }
    if (!line) { flush(); return; }
    if (line.startsWith("#") || !cur) return;
    if (!q) q = { q: "", options: [], correct: -1, explanation: "" };
    const opt = line.match(/^([+-])\s*(.+)$/);
    const exp = line.match(/^пояснение\s*:\s*(.*)$/i);
    if (opt) { q.options.push(opt[2]); if (opt[1] === "+") q.correct = q.options.length - 1; }
    else if (exp) q.explanation = exp[1];
    else if (!q.q) q.q = line;
  });
  flush();
  return res;
}

/* ---------- Страница достопримечательности ---------- */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function renderQuiz(items, root) {
  let answered = 0, right = 0;
  const total = items.length;
  const score = document.createElement("p");
  score.className = "score hidden";

  items.forEach((item, qi) => {
    const card = document.createElement("div"); card.className = "q-card";
    const q = document.createElement("h3"); q.textContent = `${qi + 1}. ${item.q}`;
    const list = document.createElement("div"); list.className = "options";
    const exp = document.createElement("p"); exp.className = "explain hidden";

    const opts = item.options.map((text, i) => ({ text, ok: i === item.correct }));
    shuffle(opts).forEach(o => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "option"; b.textContent = o.text;
      b.onclick = () => {
        const btns = [...list.children];
        btns.forEach((x, i) => { x.disabled = true; if (opts[i].ok) x.classList.add("correct"); });
        if (o.ok) right++; else b.classList.add("wrong");
        exp.textContent = (o.ok ? "✓ Верно! " : "✗ Неверно. ") + item.explanation;
        exp.classList.remove("hidden");
        if (++answered === total) {
          score.textContent = `Твой результат: ${right} из ${total}`;
          score.classList.remove("hidden");
        }
      };
      list.appendChild(b);
    });
    card.append(q, list, exp);
    root.appendChild(card);
  });
  root.appendChild(score);
}

async function renderPhotos(p) {
  const box = document.getElementById("photos");
  const list = await findAllPhotos(p.id);
  if (!list.length) { box.appendChild(makeImg(placeholder(p.title), p.title, "photo-main")); return; }
  list.forEach((src, i) => box.appendChild(makeImg(src, p.title, i === 0 ? "photo-main" : "photo-more")));
}

async function initPlace(id) {
  const p = PLACES.find(x => x.id === id);
  if (!p) return;
  document.title = p.title + " — Калач";
  document.getElementById("title").textContent = p.title;
  const text = document.getElementById("text");
  p.text.forEach(t => { const el = document.createElement("p"); el.textContent = t; text.appendChild(el); });

  renderPhotos(p);

  const quizBox = document.getElementById("quiz");
  try {
    const items = (await loadQuestions())[id] || [];
    if (items.length) renderQuiz(items, quizBox);
    else quizBox.closest(".quiz-box").classList.add("hidden");
  } catch (e) {
    quizBox.textContent = "Не удалось загрузить вопросы (файл questions.txt).";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("map")) initMap();
  const id = document.body.dataset.place;
  if (id) initPlace(id);
});
