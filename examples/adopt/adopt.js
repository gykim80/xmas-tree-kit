// Sample tree adoption shop. Every tree on the page is an <xmas-tree> tag; this file only wires up the shop.
import { ORNAMENT_SHAPES } from '../../src/decor/shapes.js';

const TREES = [
  { name: 'The Holly', preset: 'classic', seed: 1225, ft: '5–6 ft', price: 89, note: 'Red and gold baubles, gold garland, warm lights.' },
  { name: 'The Fjord', preset: 'nordic', seed: 314, ft: '6–7 ft', price: 119, note: 'Slim and snowy, silver and blue, cool white lights.' },
  { name: 'The Hearth', preset: 'cozy', seed: 77, ft: '7–8 ft', price: 149, note: 'Full and wide with a red skirt and a pile of presents.' },
  { name: 'The Sugarplum', preset: 'candy', seed: 1414, ft: '8–9 ft', price: 199, note: 'Pink and white, hearts and stars, candy garland.' },
];
const COLORS = ['#c8232c', '#f2c14e', '#f4f4f4', '#2f8f5b', '#3fa4ff', '#ff8fc7'];

const $ = (s) => document.querySelector(s);
const meta = (t) => `${t.ft} · $${t.price}`;

// The tag lights its tree for a night sky. On this cream and red page a warm daylight reads better
function warmUp(el, { zoom = 1, lift = 0 } = {}) {
  const v = el.viewer;
  for (const o of v.scene.children) {
    if (o.isHemisphereLight) {
      o.color.set('#fff2e2');
      o.groundColor.set('#7a3b2c');
      o.intensity = 1.1;
    } else if (o.isDirectionalLight) {
      o.color.set('#fff0d8');
      o.intensity = 2.2;
    }
  }
  v.renderer.toneMappingExposure = 1.05;
  if (v.controls) {
    v.controls.enableZoom = false; // keep the wheel for scrolling the page
    const H = v.tree.size;
    v.controls.target.y = H * (0.45 + lift);
    v.camera.position.sub(v.controls.target).multiplyScalar(zoom).add(v.controls.target);
    v.controls.update();
  }
}
const ready = (el, fn) => (el.viewer ? fn() : el.addEventListener('load', fn, { once: true }));

// Cards
const cards = $('#cards');
cards.innerHTML = TREES.map(
  (t, i) => `<li class="card">
    <button class="heart" type="button" aria-pressed="false" aria-label="Save ${t.name}">♥</button>
    <xmas-tree preset="${t.preset}" size="1.8" quality="medium" background="transparent" ground="false"
      camera-controls auto-rotate shadows="false" aria-label="3D preview of ${t.name}"></xmas-tree>
    <h3>${t.name}</h3>
    <p class="card-note">${t.note}</p>
    <p class="card-meta"><span>${t.ft}</span><strong>$${t.price}</strong></p>
    <button class="pill small" type="button" data-pick="${i}">Adopt</button>
  </li>`
).join('');

// Hero: Previous / Next swap the tree in the hero
const hero = $('#hero-tree');
let current = 0;
function show(i) {
  current = (i + TREES.length) % TREES.length;
  const t = TREES[current];
  hero.setAttribute('preset', t.preset);
  $('#hero-name').textContent = t.name;
  $('#hero-meta').textContent = meta(t);
}
document.querySelectorAll('.arrow').forEach((b) => b.addEventListener('click', () => show(current + Number(b.dataset.step))));

// Adopt dialog and bag
const dialog = $('#adopt-dialog');
let bag = 0;
function openAdopt(i) {
  const t = TREES[i];
  $('#adopt-name').textContent = t.name;
  $('#adopt-meta').textContent = `${meta(t)} · ${t.note}`;
  $('#adopt-pet').value = '';
  dialog.returnValue = '';
  dialog.showModal();
}
$('#hero-adopt').addEventListener('click', () => openAdopt(current));
cards.addEventListener('click', (e) => {
  const pick = e.target.closest('[data-pick]');
  if (pick) {
    show(Number(pick.dataset.pick));
    openAdopt(current);
  }
  const heart = e.target.closest('.heart');
  if (heart) heart.setAttribute('aria-pressed', String(heart.getAttribute('aria-pressed') !== 'true'));
});
dialog.addEventListener('close', () => {
  if (dialog.returnValue !== 'ok') return;
  bag++;
  const count = $('#bag-count');
  count.hidden = false;
  count.textContent = bag;
  $('#bag').setAttribute('aria-label', `Adoption bag, ${bag} tree${bag > 1 ? 's' : ''}`);
  const pet = $('#adopt-pet').value.trim();
  toast(`${TREES[current].name}${pet ? ` (“${pet}”)` : ''} is in your bag. Delivery ${$('#adopt-week').value}.`);
});

// Decorate section: shape chips and color swatches set what the next click hangs
const deco = $('#deco-tree');
$('#shapes').innerHTML = ORNAMENT_SHAPES.map((s, i) => `<button type="button" class="chip" aria-pressed="${i === 0}" data-shape="${s}">${s}</button>`).join('');
$('#colors').innerHTML = COLORS.map((c, i) => `<button type="button" class="swatch" aria-pressed="${i === 0}" data-color="${c}" style="--c:${c}" aria-label="Color ${c}"></button>`).join('');
function choose(group, attr, key) {
  $(group).addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    $(group).querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    deco.setAttribute(attr, b.dataset[key]);
  });
}
choose('#shapes', 'ornament-shape', 'shape');
choose('#colors', 'ornament-color', 'color');
const hung = () => ($('#hung-count').textContent = deco.tree.ornaments.count);
deco.addEventListener('ornamentadd', hung);
deco.addEventListener('ornamentremove', hung);

// Newsletter
$('#news-form').addEventListener('submit', (e) => {
  e.preventDefault();
  e.target.reset();
  toast('Thanks. We will write when adoption opens.');
});

let toastTimer = 0;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 3800);
}

// Register <xmas-tree> last so the load listeners above are already in place
await import('../../src/element-define.js');
ready(hero, () => warmUp(hero, { zoom: 0.66, lift: 0.04 }));
ready(deco, () => {
  warmUp(deco, { zoom: 0.8 });
  // a few ornaments to start with
  [[0.3, 0.4, '#c8232c'], [0.5, 2.2, '#f2c14e'], [0.7, 4.1, '#f4f4f4']].forEach(([h, a, color]) => deco.tree.addOrnament({ shape: 'ball', color, h, a }));
  hung();
});
document.querySelectorAll('.card xmas-tree').forEach((el) => ready(el, () => warmUp(el, { zoom: 0.78 })));
