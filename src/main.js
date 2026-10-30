import { CONFIG } from './config.js';
import { PRESETS } from './presets.js';
import { loadModelFile, prepareGeometry } from './geometry.js';
import { calculatePrice, fitsBuildVolume } from './pricing.js';
import { Viewer, renderThumbnails } from './viewer.js';

const $ = (sel) => document.querySelector(sel);
const money = new Intl.NumberFormat(CONFIG.locale, { style: 'currency', currency: CONFIG.currency });
const num = (v, digits = 0) => new Intl.NumberFormat(CONFIG.locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v);
const byId = (list, id) => list.find((x) => x.id === id) ?? list[0];

const MIN_PCT = 1;
const MAX_PCT = 10000;

const state = {
  model: null, // { name, source: 'preset' | 'upload', file?, stats }
  unitFactor: 1,
  scalePct: 100,
  materialId: CONFIG.defaults.materialId,
  colorIndex: 0,
  infillId: CONFIG.defaults.infillId,
  qualityId: CONFIG.defaults.qualityId,
  finishingId: CONFIG.defaults.finishingId,
  supports: true,
  quantity: 1,
  result: null,
};

const viewer = new Viewer($('#viewer'));
viewer.onGridChange = (step) => {
  $('#grid-label').textContent = `Raster: ${formatLength(step)}`;
};

document.querySelectorAll('[data-company-name]').forEach((el) => (el.textContent = CONFIG.company.name));

// ---------------------------------------------------------------- Modelle --

function setModel(model, geometry) {
  state.model = model;
  state.scalePct = 100;
  viewer.setScale(effectiveScale());
  viewer.setGeometry(geometry);
  document.querySelectorAll('.preset').forEach((el) => el.classList.toggle('active', el.dataset.id === model.presetId));
  $('#model-name').textContent = model.name;
  update();
}

function selectPreset(preset) {
  const { geometry, stats } = prepareGeometry(preset.create());
  state.unitFactor = 1;
  $('#unit').value = '1';
  setModel({ name: preset.name, source: 'preset', presetId: preset.id, stats }, geometry);
}

async function handleFile(file) {
  const error = $('#upload-error');
  error.hidden = true;
  if (!file) return;
  if (file.size > CONFIG.maxUploadMb * 1024 * 1024) {
    showError(`Die Datei ist größer als ${CONFIG.maxUploadMb} MB.`);
    return;
  }

  $('#stage-loading').hidden = false;
  // Kurz warten, damit der Ladehinweis gerendert wird, bevor das Parsen blockiert
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  try {
    const { geometry, stats } = await loadModelFile(file);
    if (stats.volumeMm3 < 1e-3) throw new Error('Das Modell hat kein messbares Volumen (nicht geschlossen?).');
    setModel({ name: file.name, source: 'upload', file, stats }, geometry);
  } catch (err) {
    console.error(err);
    showError(err.message || 'Die Datei konnte nicht gelesen werden.');
  } finally {
    $('#stage-loading').hidden = true;
  }

  function showError(msg) {
    error.textContent = msg;
    error.hidden = false;
  }
}

function renderPresets() {
  const container = $('#presets');
  const geometries = PRESETS.map((p) => prepareGeometry(p.create()).geometry);
  const thumbs = renderThumbnails(geometries);
  geometries.forEach((g) => g.dispose());

  PRESETS.forEach((preset, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset';
    btn.dataset.id = preset.id;
    btn.innerHTML = `<img alt="" src="${thumbs[i]}" /><strong>${preset.name}</strong><span>${preset.description}</span>`;
    btn.addEventListener('click', () => selectPreset(preset));
    container.append(btn);
  });
}

// ------------------------------------------------------------- Material --

function renderMaterials() {
  const container = $('#materials');
  container.innerHTML = '';
  for (const m of CONFIG.materials) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'material' + (m.id === state.materialId ? ' active' : '');
    btn.setAttribute('aria-pressed', m.id === state.materialId);
    btn.innerHTML = `
      <span class="material-top"><strong>${m.name}</strong><em>${m.tag}</em></span>
      <span class="material-desc">${m.description}</span>
      <span class="material-price">ab ${money.format(m.pricePerKg)}/kg</span>`;
    btn.addEventListener('click', () => {
      state.materialId = m.id;
      state.colorIndex = 0;
      renderMaterials();
      update();
    });
    container.append(btn);
  }
  renderSwatches();
}

function renderSwatches() {
  const material = currentMaterial();
  const container = $('#swatches');
  container.innerHTML = '';
  material.colors.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch' + (i === state.colorIndex ? ' active' : '');
    btn.style.setProperty('--swatch', c.hex);
    btn.title = c.name;
    btn.setAttribute('aria-label', c.name);
    btn.addEventListener('click', () => {
      state.colorIndex = i;
      renderSwatches();
      update();
    });
    container.append(btn);
  });
  $('#color-name').textContent = material.colors[state.colorIndex].name;
}

function renderSegmented(container, items, getId, setId) {
  container.innerHTML = '';
  for (const item of items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = item.id === getId() ? 'active' : '';
    btn.innerHTML = `<strong>${item.label}</strong><span>${item.detail}</span>`;
    btn.addEventListener('click', () => {
      setId(item.id);
      renderSegmented(container, items, getId, setId);
      update();
    });
    container.append(btn);
  }
}

// ---------------------------------------------------------------- Größe --

const currentMaterial = () => byId(CONFIG.materials, state.materialId);
const effectiveScale = () => state.unitFactor * (state.scalePct / 100);
const currentDims = () => state.model.stats.size.map((d) => d * effectiveScale());

const pctToRange = (pct) => (Math.log10(pct / MIN_PCT) / Math.log10(MAX_PCT / MIN_PCT)) * 1000;
const rangeToPct = (v) => MIN_PCT * Math.pow(MAX_PCT / MIN_PCT, v / 1000);

function setScalePct(pct) {
  if (!Number.isFinite(pct) || pct <= 0) return;
  state.scalePct = Math.min(MAX_PCT, Math.max(MIN_PCT, pct));
  viewer.setScale(effectiveScale());
  update();
}

function maxScalePct() {
  const limit = [...(currentMaterial().maxSize ?? CONFIG.buildVolume)].sort((a, b) => a - b);
  const base = state.model.stats.size.map((d) => d * state.unitFactor).sort((a, b) => a - b);
  const factor = Math.min(...base.map((d, i) => limit[i] / d));
  return Math.floor(factor * 1000) / 10; // auf 0,1 % abrunden
}

$('#scale-range').addEventListener('input', (e) => setScalePct(Math.round(rangeToPct(+e.target.value))));
$('#scale-number').addEventListener('change', (e) => setScalePct(+e.target.value));
document.querySelectorAll('[data-dim]').forEach((input) => {
  input.addEventListener('change', () => {
    const base = state.model.stats.size[+input.dataset.dim] * state.unitFactor;
    setScalePct((+input.value / base) * 100);
  });
});
$('#unit').addEventListener('change', (e) => {
  state.unitFactor = +e.target.value;
  viewer.setScale(effectiveScale());
  viewer.fitCamera();
  update();
});
$('#btn-reset-scale').addEventListener('click', () => setScalePct(100));
$('#btn-max-scale').addEventListener('click', () => setScalePct(maxScalePct()));

// ------------------------------------------------------------- Optionen --

renderSegmented($('#infill'), CONFIG.infill, () => state.infillId, (id) => (state.infillId = id));
renderSegmented($('#quality'), CONFIG.quality, () => state.qualityId, (id) => (state.qualityId = id));
renderSegmented($('#finishing'), CONFIG.finishing, () => state.finishingId, (id) => (state.finishingId = id));

$('#supports').addEventListener('change', (e) => {
  state.supports = e.target.checked;
  update();
});

function setQuantity(q) {
  state.quantity = Math.min(999, Math.max(1, Math.round(q) || 1));
  update();
}
$('#qty').addEventListener('change', (e) => setQuantity(+e.target.value));
$('#qty-minus').addEventListener('click', () => setQuantity(state.quantity - 1));
$('#qty-plus').addEventListener('click', () => setQuantity(state.quantity + 1));

// -------------------------------------------------------------- Ansicht --

$('#btn-fit').addEventListener('click', () => viewer.fitCamera());
for (const [id, fn] of [['#btn-wire', (on) => viewer.setWireframe(on)], ['#btn-box', (on) => viewer.setBoxVisible(on)]]) {
  $(id).addEventListener('click', (e) => {
    const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    e.currentTarget.setAttribute('aria-pressed', on);
    fn(on);
  });
}

// ------------------------------------------------------------- Upload --

$('#file-input').addEventListener('change', (e) => {
  handleFile(e.target.files[0]);
  e.target.value = '';
});

const stage = $('#stage');
for (const target of [$('#dropzone'), stage]) {
  target.addEventListener('dragover', (e) => {
    e.preventDefault();
    target.classList.add('dragging');
  });
  target.addEventListener('dragleave', (e) => {
    if (!target.contains(e.relatedTarget)) target.classList.remove('dragging');
  });
  target.addEventListener('drop', (e) => {
    e.preventDefault();
    target.classList.remove('dragging');
    handleFile(e.dataTransfer.files[0]);
  });
}

// --------------------------------------------------------------- Update --

function update() {
  if (!state.model) return;
  const material = currentMaterial();
  const color = material.colors[state.colorIndex];
  viewer.setAppearance(color.hex, material.roughness);

  const dims = currentDims();
  const fits = fitsBuildVolume(dims, material);

  // Größenfelder
  $('#scale-number').value = Math.round(state.scalePct * 10) / 10;
  $('#scale-range').value = pctToRange(state.scalePct);
  document.querySelectorAll('[data-dim]').forEach((input) => {
    if (document.activeElement !== input) input.value = Math.round(dims[+input.dataset.dim] * 10) / 10;
  });
  $('#qty').value = state.quantity;
  $('#model-dims').textContent = dims.map((d) => formatLength(d)).join(' × ');

  const limit = material.maxSize ?? CONFIG.buildVolume;
  const warning = $('#size-warning');
  warning.hidden = fits;
  warning.textContent = fits ? '' : `Das Modell ist größer als der Bauraum (${limit.join(' × ')} mm) für ${material.name}. Bitte verkleinern – oder anfragen, ob es geteilt gedruckt werden kann.`;
  $('#stage').classList.toggle('oversize', !fits);

  $('#infill').classList.toggle('disabled', !!material.solid);
  $('#infill-hint').hidden = !material.solid;

  const result = calculatePrice({
    stats: state.model.stats,
    scale: effectiveScale(),
    material,
    infill: byId(CONFIG.infill, state.infillId),
    quality: byId(CONFIG.quality, state.qualityId),
    finishing: byId(CONFIG.finishing, state.finishingId),
    quantity: state.quantity,
    supports: state.supports,
  });
  state.result = { ...result, fits, dims };

  $('#price-total').textContent = money.format(result.gross);
  $('#stage-price').textContent = money.format(result.gross);
  $('#price-net').textContent = `${money.format(result.net)} netto · ${state.quantity} Stück`;

  $('#facts').innerHTML = [
    ['Gewicht', formatWeight(result.weightG)],
    ['Druckzeit', formatHours(result.hours)],
    ['Volumen', `${num(result.volumeCm3, result.volumeCm3 < 100 ? 1 : 0)} cm³`],
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

  const rows = [
    ['Material', result.materialCost * state.quantity],
    ['Maschinenzeit', result.machineCost * state.quantity],
    ['Oberfläche', result.finishingCost * state.quantity],
    result.discount > 0 && [`Mengenrabatt ${Math.round(result.discount * 100)} %`, -result.discountAmount],
    ['Einrichtung', result.setupFee],
    result.minOrderApplied && ['Aufschlag Mindestauftrag', result.net - (result.itemsTotal - result.discountAmount + result.setupFee)],
    ['Netto', result.net, 'sum'],
    [`MwSt. ${Math.round(CONFIG.vat * 100)} %`, result.vatAmount],
    ['Gesamt', result.gross, 'sum'],
  ].filter(Boolean);
  $('#breakdown').innerHTML = rows
    .map(([k, v, cls]) => `<div class="${cls ?? ''}"><dt>${k}</dt><dd>${money.format(v)}</dd></div>`)
    .join('');

  $('#btn-order').disabled = !fits;
}

function formatLength(mm) {
  if (mm >= 1000) return `${num(mm / 1000, 2)} m`;
  if (mm >= 100) return `${num(mm / 10, 1)} cm`;
  return `${num(mm, mm < 10 ? 1 : 0)} mm`;
}

function formatWeight(g) {
  return g >= 1000 ? `${num(g / 1000, 2)} kg` : `${num(g)} g`;
}

function formatHours(h) {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${num(h, 1)} h`;
  return `${num(h / 24, 1)} Tage`;
}

// ------------------------------------------------------------ Anfrage --

function orderSummary() {
  const r = state.result;
  const m = currentMaterial();
  return [
    `Modell: ${state.model.name}${state.model.source === 'preset' ? ' (Sortiment)' : ''}`,
    `Abmessungen: ${r.dims.map((d) => num(d, 1)).join(' × ')} mm (Skalierung ${num(state.scalePct, 1)} %)`,
    `Material: ${m.name} – ${m.colors[state.colorIndex].name}`,
    `Füllgrad: ${m.solid ? 'massiv' : byId(CONFIG.infill, state.infillId).detail}`,
    `Qualität: ${byId(CONFIG.quality, state.qualityId).label} (${byId(CONFIG.quality, state.qualityId).detail})`,
    `Oberfläche: ${byId(CONFIG.finishing, state.finishingId).label}`,
    `Stützstrukturen: ${state.supports ? 'ja' : 'nein'}`,
    `Stückzahl: ${state.quantity}`,
    `Gewicht ca.: ${formatWeight(r.weightG)} · Druckzeit ca.: ${formatHours(r.hours)}`,
    `Preis: ${money.format(r.net)} netto / ${money.format(r.gross)} brutto`,
  ].join('\n');
}

const dialog = $('#order-dialog');
$('#btn-order').addEventListener('click', () => {
  $('#order-summary').textContent = orderSummary();
  $('#order-file-hint').textContent = state.model.source === 'upload'
    ? `Bitte hängen Sie die Datei „${state.model.name}“ an die E-Mail an.`
    : '';
  dialog.showModal();
});

$('#order-form').addEventListener('submit', (e) => {
  if (e.submitter?.value !== 'send') return;
  const data = new FormData(e.target);
  const body = [
    `Name: ${data.get('name')}`,
    `E-Mail: ${data.get('email')}`,
    '',
    orderSummary(),
    '',
    data.get('message') || '',
  ].join('\n');
  const subject = `Angebotsanfrage 3D-Druck: ${state.model.name}`;
  window.location.href = `mailto:${CONFIG.company.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

$('#btn-copy').addEventListener('click', async (e) => {
  try {
    await navigator.clipboard.writeText(orderSummary());
    e.target.textContent = 'Kopiert ✓';
    setTimeout(() => (e.target.textContent = 'Zusammenfassung kopieren'), 1500);
  } catch {
    e.target.textContent = 'Kopieren nicht möglich';
  }
});

// --------------------------------------------------------------- Start --

renderMaterials();
renderPresets();
selectPreset(PRESETS[0]);
