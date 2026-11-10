/* Общий JS: карта, страницы мест, большой тест со званиями */

/* ---------- Вспомогательное ---------- */
function h(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function tryLoad(src) {
  return new Promise(res => {
    const i = new Image();
    i.onload = () => res(src);
    i.onerror = () => res(null);
    i.src = src;
  });
}

/* ---------- Фото: ищем photos/ID-1.jpg, ID-2.jpg ... автоматически ---------- */
const EXTS = ["jpg", "jpeg", "png", "webp", "JPG", "JPEG", "PNG"];
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
async function findRankImage(id) {
  const found = await Promise.all(["png", "jpg", "jpeg", "webp", "svg"].map(e => tryLoad(`ranks/${id}.${e}`)));
  return found.find(Boolean) || null;
}
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
  const img = h("img", cls);
  img.src = src; img.alt = alt;
  return img;
}

/* ---------- Главная: карта ---------- */
function makePinIcon(p) {
  const el = h("div", "pin side-" + (p.labelSide || "right"));
  const dot = h("span", "pin-dot");
  const label = h("span", "pin-label", p.title);
  el.append(dot, label);
  return L.divIcon({ className: "", html: el, iconSize: [46, 46], iconAnchor: [23, 23], popupAnchor: [0, -26] });
}

function initMap() {
  const map = L.map("map").setView([50.424, 41.016], 15);
  map.attributionControl.setPrefix(false); // убирает флаг и надпись «Leaflet»; ссылка на OpenStreetMap остаётся (обязательна)
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  PLACES.forEach(p => {
    const box = h("div", "popup");
    const a = h("a", "btn", "Подробнее");
    a.href = p.id + ".html";
    box.append(h("h3", "", p.title), h("p", "", p.short), a);
    L.marker([p.lat, p.lng], { icon: makePinIcon(p), title: p.title }).addTo(map).bindPopup(box);
  });

  // Режим подбора координат: открыть сайт с ?coords и нажать на карту
  if (new URLSearchParams(location.search).has("coords")) {
    map.on("click", e => {
      const lat = e.latlng.lat.toFixed(6), lng = e.latlng.lng.toFixed(6);
      L.popup().setLatLng(e.latlng)
        .setContent(`<div class="popup"><h3>Координаты</h3><p>lat: ${lat}<br>lng: ${lng}</p></div>`)
        .openOn(map);
    });
  }

  map.fitBounds(L.latLngBounds(PLACES.map(p => [p.lat, p.lng])), {
    paddingTopLeft: [60, 70], paddingBottomRight: [60, 120], maxZoom: 17
  });
}

/* ---------- Вопросы из questions.txt ---------- */
async function loadQuestions() {
  const res = {};
  const r = await fetch("questions.txt?v=" + Date.now());
  if (!r.ok) throw new Error("questions.txt not found");
  const lines = (await r.text()).replace(/\r/g, "").split("\n");
  let cur = null, q = null;
  const flush = () => { if (cur && q && q.q && q.options.length > 1 && q.correct >= 0) res[cur].push(q); q = null; };
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

/* ---------- Страница места: мини-викторина с мгновенной проверкой ---------- */
function renderQuiz(items, root) {
  let answered = 0, right = 0;
  const total = items.length;
  const score = h("p", "score hidden");

  items.forEach((item, qi) => {
    const card = h("div", "q-card");
    const list = h("div", "options");
    const exp = h("p", "explain hidden");
    const opts = shuffle(item.options.map((text, i) => ({ text, ok: i === item.correct })));
    opts.forEach(o => {
      const b = h("button", "option", o.text);
      b.type = "button";
      b.onclick = () => {
        [...list.children].forEach((x, i) => { x.disabled = true; if (opts[i].ok) x.classList.add("correct"); });
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
    card.append(h("h3", "", `${qi + 1}. ${item.q}`), list, exp);
    root.appendChild(card);
  });
  root.appendChild(score);
}

async function renderPhotos(p) {
  const box = document.getElementById("photos");
  const list = await findAllPhotos(p.id);
  const slots = Math.max(list.length, p.photoSlots || 1);
  for (let i = 0; i < slots; i++) {
    const cls = i === 0 ? "photo-main" : "photo-more";
    box.appendChild(makeImg(list[i] || placeholder(p.title), p.title, cls));
  }
}

async function initPlace(id) {
  const p = PLACES.find(x => x.id === id);
  if (!p) return;
  document.title = p.title + " — Калач";
  document.getElementById("title").textContent = p.title;
  const text = document.getElementById("text");
  p.text.forEach(t => text.appendChild(h("p", "", t)));
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

/* ---------- Большой тест: ответы проверяются только в конце ---------- */
function renderTest(items, root, onFinish) {
  const picks = new Array(items.length).fill(null);
  const cards = items.map((item, qi) => {
    const opts = shuffle(item.options.map((text, i) => ({ text, ok: i === item.correct })));
    const card = h("div", "q-card");
    if (item.tag) card.appendChild(h("div", "q-tag", item.tag));
    const list = h("div", "options");
    opts.forEach((o, oi) => {
      const b = h("button", "option", o.text);
      b.type = "button";
      b.onclick = () => {
        picks[qi] = oi;
        [...list.children].forEach((x, i) => x.classList.toggle("selected", i === oi));
        update();
      };
      list.appendChild(b);
    });
    card.append(h("h3", "", `${qi + 1}. ${item.q}`), list);
    root.appendChild(card);
    return { item, opts };
  });

  const progress = h("p", "progress");
  const finish = h("button", "btn finish", "Завершить тест");
  finish.type = "button";
  root.append(progress, finish);

  function update() {
    const n = picks.filter(x => x !== null).length;
    progress.textContent = `Отвечено: ${n} из ${items.length}`;
    finish.disabled = n < items.length;
  }
  update();

  finish.onclick = () => {
    const details = cards.map((c, i) => {
      const chosen = c.opts[picks[i]];
      return { item: c.item, chosen: chosen.text, ok: chosen.ok, correct: c.opts.find(o => o.ok).text };
    });
    onFinish(details.filter(d => d.ok).length, details);
  };
}

function showResult(right, details) {
  const total = details.length, share = right / total;
  const rank = [...RANKS].sort((a, b) => b.min - a.min).find(r => share >= r.min) || RANKS[0];
  document.getElementById("testBox").classList.add("hidden");
  const box = document.getElementById("result");
  box.innerHTML = "";
  box.classList.remove("hidden");

  // Карточка звания
  const card = h("div", "rank-card");
  const img = h("img", "rank-img"); img.alt = rank.title;
  findRankImage(rank.id).then(s => { if (s) img.src = s; else img.remove(); });
  card.append(
    img,
    h("div", "rank-label", "Твоё звание"),
    h("h2", "rank-title", rank.title),
    h("p", "rank-score", `Результат: ${right} из ${total} (${Math.round(share * 100)}%)`),
    h("p", "rank-text", rank.text)
  );
  box.appendChild(card);

  // Лесенка званий
  const ladder = h("div", "ladder");
  RANKS.forEach(r => {
    const t = h("div", "tile" + (r.id === rank.id ? " on" : ""));
    const im = h("img"); im.alt = r.title;
    findRankImage(r.id).then(s => { if (s) im.src = s; else im.remove(); });
    t.append(im, h("div", "tile-title", r.title), h("div", "tile-min", r.min ? `от ${Math.round(r.min * 100)}%` : "старт"));
    ladder.appendChild(t);
  });
  box.appendChild(ladder);

  // Разбор ответов
  box.appendChild(h("h2", "review-title", "Разбор ответов"));
  details.forEach((d, i) => {
    const it = h("div", "review " + (d.ok ? "ok" : "bad"));
    if (d.item.tag) it.appendChild(h("div", "q-tag", d.item.tag));
    it.appendChild(h("h3", "", `${i + 1}. ${d.item.q}`));
    it.appendChild(h("p", "", (d.ok ? "✓ Твой ответ: " : "✗ Твой ответ: ") + d.chosen));
    if (!d.ok) it.appendChild(h("p", "right-answer", "Правильный ответ: " + d.correct));
    if (d.item.explanation) it.appendChild(h("p", "explain", d.item.explanation));
    box.appendChild(it);
  });

  const again = h("a", "btn", "Пройти ещё раз"); again.href = "test.html";
  const back = h("a", "btn btn-ghost", "К карте"); back.href = "index.html";
  const actions = h("div", "actions");
  actions.append(again, back);
  box.appendChild(actions);
  window.scrollTo(0, 0);
}

async function initTest() {
  const root = document.getElementById("quiz");
  try {
    const all = await loadQuestions();
    const items = [];
    PLACES.forEach(p => (all[p.id] || []).forEach(q => items.push({ ...q, tag: p.title })));
    if (!items.length) { root.textContent = "Вопросов пока нет."; return; }
    renderTest(shuffle(items), root, showResult);
  } catch (e) {
    root.textContent = "Не удалось загрузить вопросы (файл questions.txt).";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if ("test" in document.body.dataset) initTest();
  if (document.getElementById("map")) initMap();
  const id = document.body.dataset.place;
  if (id) initPlace(id);
});
