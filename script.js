/* Общий JS: карта на главной + страницы достопримечательностей */

// Заглушка, если фото нет (работает без интернета)
function placeholder(label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#0B1426"/><stop offset="1" stop-color="#14223D"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50%" y="48%" fill="#E8B94A" font-family="Calibri,Arial" font-size="48" text-anchor="middle">${label}</text>
    <text x="50%" y="58%" fill="#ffffff" fill-opacity=".6" font-family="Calibri,Arial" font-size="30" text-anchor="middle">фото скоро появится</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function makeImg(src, alt, cls) {
  const img = document.createElement("img");
  img.src = src; img.alt = alt; img.loading = "lazy";
  if (cls) img.className = cls;
  img.onerror = () => { img.onerror = null; img.src = placeholder(alt); };
  return img;
}

/* ---------- Главная: карта ---------- */
function initMap() {
  const map = L.map("map").setView([50.424, 41.016], 14);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  const icon = L.divIcon({
    className: "", html: '<div class="gold-marker"></div>',
    iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28]
  });

  PLACES.forEach(p => {
    const box = document.createElement("div");
    box.className = "popup";
    const h = document.createElement("h3"); h.textContent = p.title;
    const d = document.createElement("p"); d.textContent = p.short;
    const a = document.createElement("a");
    a.href = p.id + ".html"; a.className = "btn"; a.textContent = "Подробнее";
    box.append(h, d, a);
    L.marker([p.lat, p.lng], { icon, title: p.title }).addTo(map).bindPopup(box);
  });
}

/* ---------- Страница достопримечательности ---------- */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function renderQuiz(place, root) {
  let answered = 0, right = 0;
  const total = place.quiz.length;
  const score = document.createElement("p");
  score.className = "score";

  place.quiz.forEach((item, qi) => {
    const card = document.createElement("div"); card.className = "q-card";
    const q = document.createElement("h3"); q.textContent = `${qi + 1}. ${item.q}`;
    const list = document.createElement("div"); list.className = "options";
    const exp = document.createElement("p"); exp.className = "explain hidden";

    const opts = item.options.map((text, i) => ({ text, ok: i === item.correct }));
    shuffle(opts).forEach(o => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "option"; b.textContent = o.text;
      b.onclick = () => {
        list.querySelectorAll("button").forEach(x => x.disabled = true);
        const btns = [...list.children];
        btns.forEach((x, i) => { if (opts[i].ok) x.classList.add("correct"); });
        if (!o.ok) b.classList.add("wrong"); else right++;
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
  score.classList.add("hidden");
  root.appendChild(score);
}

function initPlace(id) {
  const p = PLACES.find(x => x.id === id);
  if (!p) return;
  document.title = p.title + " — Калач";
  document.getElementById("title").textContent = p.title;

  const photos = document.getElementById("photos");
  p.photos.forEach((src, i) => photos.appendChild(makeImg(src, p.title, i === 0 ? "photo-main" : "photo-more")));

  const text = document.getElementById("text");
  p.text.forEach(t => { const el = document.createElement("p"); el.textContent = t; text.appendChild(el); });

  renderQuiz(p, document.getElementById("quiz"));
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("map")) initMap();
  const id = document.body.dataset.place;
  if (id) initPlace(id);
});
