// =============================================================================
// S-AES Lab — frontend logic
// Mengambil hasil dari /api/process lalu merender seluruh langkah perhitungan
// (Key Expansion, Initial AddRoundKey, Round 1, Round 2) sebagai kartu-kartu
// transformasi dengan visualisasi state matrix (nibble grid) dan detail GF(2^4).
// =============================================================================

const NIBBLE_KEYS = ["s00", "s01", "s10", "s11"]; // urutan render: baris atas lalu bawah

function bin(v, width) {
  return v.toString(2).padStart(width, "0");
}
function hex(v, width) {
  return v.toString(16).toUpperCase().padStart(width, "0");
}

function diffKeys(before, after) {
  return NIBBLE_KEYS.filter((k) => before[k] !== after[k]);
}

// ---------------------------------------------------------------------------
// Render sebuah nibble-grid (2x2) dari objek state {s00,s01,s10,s11}
// ---------------------------------------------------------------------------
function renderNibbleGrid(state, opts) {
  opts = opts || {};
  const changed = opts.changed || [];
  const isKey = !!opts.isKey;
  let html = '<div class="nibble-grid">';
  NIBBLE_KEYS.forEach((k) => {
    const v = state[k];
    const cls = ["nibble-cell"];
    if (changed.includes(k)) cls.push("changed");
    if (isKey) cls.push("key-cell");
    html += `<div class="${cls.join(" ")}">
                <span class="hex">${hex(v, 1)}</span>
                <span class="bin">${bin(v, 4)}</span>
             </div>`;
  });
  html += "</div>";
  return html;
}

function stateCol(label, state, opts) {
  return `<div class="state-col">
            <span class="state-col-label">${label}</span>
            ${renderNibbleGrid(state, opts)}
          </div>`;
}

// ---------------------------------------------------------------------------
// Transform block wrapper
// ---------------------------------------------------------------------------
function transformBlock(title, desc, innerHtml, icon) {
  return `<div class="transform-block">
            <div class="transform-title"><i class="bi ${icon || "bi-arrow-right-circle"}"></i> ${title}</div>
            ${desc ? `<div class="transform-desc">${desc}</div>` : ""}
            ${innerHtml}
          </div>`;
}

function simpleFlow(beforeState, afterState, changed) {
  return `<div class="state-flow">
            ${stateCol("Sebelum", beforeState)}
            <span class="state-flow-arrow">&rarr;</span>
            ${stateCol("Sesudah", afterState, { changed })}
          </div>`;
}

// ---------------------------------------------------------------------------
// GF multiplication trace table
// ---------------------------------------------------------------------------
function gfTraceTable(trace) {
  let rows = "";
  trace.forEach((s) => {
    rows += `<tr>
      <td>${s.iter}</td>
      <td>${bin(s.a, 4)}</td>
      <td>${s.b_bit}</td>
      <td>${bin(s.result_before, 4)}</td>
      <td>${bin(s.result_after, 4)}</td>
      <td>${bin(s.a_shifted, 4)}${s.carry_out ? " (carry)" : ""}</td>
      <td>${s.reduced ? "&oplus; 10011" : "&mdash;"}</td>
      <td>${bin(s.a_next, 4)}</td>
    </tr>`;
  });
  return `<div class="table-responsive">
    <table class="table table-sm gf-trace-table mb-2">
      <thead><tr>
        <th>i</th><th>a</th><th>bit b</th><th>hasil sblm</th><th>hasil sdh</th>
        <th>a&lt;&lt;1</th><th>reduksi</th><th>a berikut</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

let gfToggleCounter = 0;
function gfMultRow(coefLabel, coef, val, product, trace) {
  gfToggleCounter += 1;
  const id = `gf-trace-${gfToggleCounter}`;
  const trivial = coef === 1;
  return `<div class="gf-formula-row">
      GFMul(${coef}, ${hex(val, 1)}) <span class="op-eq">=</span> ${hex(product, 1)}
      ${trivial
        ? '<span class="text-muted" style="font-size:.75rem;"> &nbsp;(perkalian dgn 1 = identitas)</span>'
        : `<div class="mt-2"><span class="gf-toggle" onclick="toggleGf('${id}')">lihat langkah GF &darr;</span>
             <div id="${id}" class="gf-detail d-none">${gfTraceTable(trace)}</div>
           </div>`
      }
    </div>`;
}

function toggleGf(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle("d-none");
}
window.toggleGf = toggleGf;

// ---------------------------------------------------------------------------
// MixColumns / InvMixColumns detail block
// ---------------------------------------------------------------------------
function mixColumnsBlock(title, before, after, detail, icon) {
  const changed = diffKeys(before, after);
  const m = detail.matrix;
  const colBlock = (label, colDetail, topKey, botKey) => `
    <div class="mb-2">
      <div class="fw-semibold mb-1" style="font-family:var(--font-mono); font-size:.82rem; color:var(--muted);">
        Kolom ${label} &mdash; ${topKey}&prime; &amp; ${botKey}&prime;
      </div>
      ${gfMultRow(`${m[0][0]}`, colDetail.top_terms[0].coef, colDetail.top_terms[0].val, colDetail.top_terms[0].product, colDetail.top_terms[0].trace)}
      ${gfMultRow(`${m[0][1]}`, colDetail.top_terms[1].coef, colDetail.top_terms[1].val, colDetail.top_terms[1].product, colDetail.top_terms[1].trace)}
      <div class="gf-formula-row">${topKey}&prime; = ${hex(colDetail.top_terms[0].product,1)} &oplus; ${hex(colDetail.top_terms[1].product,1)} <span class="op-eq">=</span> ${hex(colDetail.top_result,1)}</div>
      ${gfMultRow(`${m[1][0]}`, colDetail.bot_terms[0].coef, colDetail.bot_terms[0].val, colDetail.bot_terms[0].product, colDetail.bot_terms[0].trace)}
      ${gfMultRow(`${m[1][1]}`, colDetail.bot_terms[1].coef, colDetail.bot_terms[1].val, colDetail.bot_terms[1].product, colDetail.bot_terms[1].trace)}
      <div class="gf-formula-row">${botKey}&prime; = ${hex(colDetail.bot_terms[0].product,1)} &oplus; ${hex(colDetail.bot_terms[1].product,1)} <span class="op-eq">=</span> ${hex(colDetail.bot_result,1)}</div>
    </div>`;

  const inner = `
    ${simpleFlow(before, after, changed)}
    <div class="gf-detail" style="margin-top:1rem;">
      <div class="mb-2" style="font-size:.82rem; color:var(--muted); font-family:var(--font-mono);">
        Matriks: [ ${m[0][0]} ${m[0][1]} ; ${m[1][0]} ${m[1][1]} ] &nbsp;(perkalian &amp; penjumlahan di GF(2<sup>4</sup>))
      </div>
      ${colBlock("0", detail.col0, "s00", "s10")}
      ${colBlock("1", detail.col1, "s01", "s11")}
    </div>`;

  return transformBlock(title, "Mengalikan setiap kolom state dengan matriks MixColumns di GF(2⁴).", inner, icon);
}

// ---------------------------------------------------------------------------
// AddRoundKey block
// ---------------------------------------------------------------------------
function addRoundKeyBlock(title, before, keyState, after, keyLabel) {
  const changed = diffKeys(before, after);
  const inner = `<div class="state-flow">
      ${stateCol("State", before)}
      <span class="xor-symbol">&oplus;</span>
      ${stateCol(keyLabel, keyState, { isKey: true })}
      <span class="state-flow-arrow">=</span>
      ${stateCol("Hasil", after, { changed })}
    </div>`;
  return transformBlock(title, `XOR setiap nibble state dengan subkunci ${keyLabel} secara kolom.`, inner, "bi-key-fill");
}

// ---------------------------------------------------------------------------
// Simple Sub / Shift blocks
// ---------------------------------------------------------------------------
function subNibblesBlock(title, before, after, desc) {
  const changed = diffKeys(before, after);
  return transformBlock(title, desc, simpleFlow(before, after, changed), "bi-shuffle");
}
function shiftRowsBlock(title, before, after, desc) {
  const changed = diffKeys(before, after);
  return transformBlock(title, desc, simpleFlow(before, after, changed), "bi-arrow-left-right");
}

// ---------------------------------------------------------------------------
// Key Expansion block
// ---------------------------------------------------------------------------
function keyExpansionHtml(kexp, keys) {
  const row = (varName, exprHtml, val, width) => `
    <div class="kexp-row">
      <span class="kexp-var">${varName}</span>
      <span class="kexp-expr">${exprHtml}</span>
      <span class="ms-auto kexp-val">${bin(val, width)} <span class="text-accent">(0x${hex(val, width / 4)})</span></span>
    </div>`;

  let html = `<div class="transform-desc">Kunci 16-bit dibagi menjadi dua word 8-bit (w0, w1), lalu diperluas menjadi w2..w5 untuk membentuk subkunci K0, K1, K2.</div>`;

  html += `<div class="transform-block">`;
  html += row("w0", "8 bit pertama dari kunci", kexp.w0, 8);
  html += row("w1", "8 bit kedua dari kunci", kexp.w1, 8);
  html += `</div>`;

  html += `<div class="transform-block">
      <div class="transform-title"><i class="bi bi-arrow-repeat"></i> Menghitung w2</div>
      ${row("RotWord(w1)", "tukar posisi 2 nibble w1", kexp.rot_w1, 8)}
      ${row("SubWord(&middot;)", "substitusi tiap nibble via S-Box", kexp.sub_rot_w1, 8)}
      ${row("w2", `w0 &oplus; SubWord(RotWord(w1)) &oplus; RCON1(${bin(kexp.rcon1,8)})`, kexp.w2, 8)}
    </div>`;

  html += `<div class="transform-block">
      ${row("w3", "w2 &oplus; w1", kexp.w3, 8)}
    </div>`;

  html += `<div class="transform-block">
      <div class="transform-title"><i class="bi bi-arrow-repeat"></i> Menghitung w4</div>
      ${row("RotWord(w3)", "tukar posisi 2 nibble w3", kexp.rot_w3, 8)}
      ${row("SubWord(&middot;)", "substitusi tiap nibble via S-Box", kexp.sub_rot_w3, 8)}
      ${row("w4", `w2 &oplus; SubWord(RotWord(w3)) &oplus; RCON2(${bin(kexp.rcon2,8)})`, kexp.w4, 8)}
    </div>`;

  html += `<div class="transform-block">
      ${row("w5", "w4 &oplus; w3", kexp.w5, 8)}
    </div>`;

  html += `<div class="transform-block">
      <div class="transform-title"><i class="bi bi-key-fill"></i> Subkunci Round</div>
      <div class="d-flex flex-wrap gap-4 mt-2">
        <div class="state-col"><span class="state-col-label">K0 = w0 || w1</span>${renderNibbleGrid(stateFromInt(keys.K0.val), { isKey: true })}
          <span class="summary-hex">${keys.K0.bin} (0x${keys.K0.hex})</span></div>
        <div class="state-col"><span class="state-col-label">K1 = w2 || w3</span>${renderNibbleGrid(stateFromInt(keys.K1.val), { isKey: true })}
          <span class="summary-hex">${keys.K1.bin} (0x${keys.K1.hex})</span></div>
        <div class="state-col"><span class="state-col-label">K2 = w4 || w5</span>${renderNibbleGrid(stateFromInt(keys.K2.val), { isKey: true })}
          <span class="summary-hex">${keys.K2.bin} (0x${keys.K2.hex})</span></div>
      </div>
    </div>`;

  return html;
}

function stateFromInt(val) {
  const n0 = (val >> 12) & 0xF;
  const n1 = (val >> 8) & 0xF;
  const n2 = (val >> 4) & 0xF;
  const n3 = val & 0xF;
  return { s00: n0, s10: n1, s01: n2, s11: n3 };
}

// ---------------------------------------------------------------------------
// Accordion item wrapper
// ---------------------------------------------------------------------------
let accItemCounter = 0;
function accordionItem(badge, title, bodyHtml, openByDefault) {
  accItemCounter += 1;
  const id = `acc-item-${accItemCounter}`;
  return `<div class="accordion-item" id="wrap-${id}">
    <h2 class="accordion-header">
      <button class="accordion-button ${openByDefault ? "" : "collapsed"}" type="button"
              data-bs-toggle="collapse" data-bs-target="#${id}">
        <span class="accordion-badge">${badge}</span> ${title}
      </button>
    </h2>
    <div id="${id}" class="accordion-collapse collapse ${openByDefault ? "show" : ""}">
      <div class="accordion-body">${bodyHtml}</div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Build full result rendering
// ---------------------------------------------------------------------------
function keyLabelFor(keys, val) {
  if (val === keys.K0.val) return "K0";
  if (val === keys.K1.val) return "K1";
  return "K2";
}

function buildResult(data) {
  gfToggleCounter = 0;
  accItemCounter = 0;
  const mode = data.mode;
  const isEncrypt = mode === "encrypt";

  // ---- summary ----
  document.getElementById("summaryInputLabel").textContent = isEncrypt ? "PLAINTEXT" : "CIPHERTEXT";
  document.getElementById("summaryOutputLabel").textContent = isEncrypt ? "CIPHERTEXT" : "PLAINTEXT";
  document.getElementById("sumInputBin").textContent = data.input.bin;
  document.getElementById("sumInputHex").textContent = "0x" + data.input.hex;
  document.getElementById("sumKeyBin").textContent = data.key.bin;
  document.getElementById("sumKeyHex").textContent = "0x" + data.key.hex;
  document.getElementById("sumOutputBin").textContent = data.output.bin;
  document.getElementById("sumOutputHex").textContent = "0x" + data.output.hex;

  const acc = document.getElementById("stepsAccordion");
  let html = "";

  // ---- Key Expansion ----
  html += accordionItem("00", "Key Expansion (Pembangkitan Subkunci)", keyExpansionHtml(data.keys.kexp_trace, data.keys), true);

  // ---- Initial AddRoundKey ----
  const initStep = data.steps.initial;
  const initKeyLabel = keyLabelFor(data.keys, initStep.key_val);
  html += accordionItem(
    "01",
    `Initial AddRoundKey (${initKeyLabel})`,
    addRoundKeyBlock("Initial AddRoundKey", initStep.before, initStep.key, initStep.after, initKeyLabel),
    true
  );

  // ---- Round 1 & Round 2 ----
  const r1 = data.steps.round1;
  const r2 = data.steps.round2;

  const order1 = isEncrypt ? ["sub", "shift", "mix", "ark"] : ["shift", "sub", "ark", "mix"];
  const order2 = isEncrypt ? ["sub", "shift", "ark"] : ["shift", "sub", "ark"];

  function renderRound(roundData, order, roundNo, isFinal) {
    let inner = "";
    order.forEach((op) => {
      if (op === "sub") {
        const title = isEncrypt ? "SubNibbles" : "InvSubNibbles";
        const desc = isEncrypt
          ? "Substitusi setiap nibble state menggunakan tabel S-Box."
          : "Substitusi setiap nibble state menggunakan tabel Inverse S-Box.";
        inner += subNibblesBlock(title, roundData.sub_before, roundData.sub_after, desc);
      } else if (op === "shift") {
        const title = isEncrypt ? "ShiftRows" : "InvShiftRows";
        inner += shiftRowsBlock(title, roundData.shift_before, roundData.shift_after, "Menggeser (menukar) nibble pada baris kedua state matrix. Operasi ini bersifat self-invers.");
      } else if (op === "mix") {
        const title = isEncrypt ? "MixColumns" : "InvMixColumns";
        inner += mixColumnsBlock(title, roundData.mix_before, roundData.mix_after, roundData.mix_detail, "bi-grid-3x3-gap-fill");
      } else if (op === "ark") {
        const label = keyLabelFor(data.keys, roundData.ark_key_val);
        inner += addRoundKeyBlock(`AddRoundKey (${label})`, roundData.ark_before, roundData.ark_key, roundData.ark_after, label);
      }
    });
    const roundTitle = isFinal ? `Round ${roundNo} (Final${isEncrypt ? ", tanpa MixColumns" : ""})` : `Round ${roundNo}`;
    return accordionItem(String(roundNo).padStart(2, "0") + "R", roundTitle, inner, false);
  }

  html += renderRound(r1, order1, 1, false);
  html += renderRound(r2, order2, 2, true);

  // ---- Final output ----
  const finalDesc = isEncrypt
    ? "Ciphertext akhir diperoleh dari state setelah Round 2 (final round)."
    : "Plaintext akhir diperoleh dari state setelah Inverse Round 2.";
  const finalInner = `<div class="state-flow">
      ${stateCol(isEncrypt ? "Ciphertext" : "Plaintext", stateFromInt(parseInt(data.output.bin, 2)))}
    </div>
    <div class="mt-3 summary-bin">Biner: ${data.output.bin} &nbsp;|&nbsp; <span class="summary-hex">Hex: 0x${data.output.hex}</span></div>`;
  html += accordionItem("FIN", `Hasil Akhir (${isEncrypt ? "Ciphertext" : "Plaintext"})`, transformBlock("Output", finalDesc, finalInner, "bi-flag-fill"), false);

  acc.innerHTML = html;

  // ---- stepper nav ----
  const nav = document.getElementById("stepperNav");
  const pills = [
    ["Key Expansion", 1],
    ["Initial ARK", 2],
    ["Round 1", 3],
    ["Round 2", 4],
    ["Hasil Akhir", 5],
  ];
  nav.innerHTML = pills
    .map((p, i) => `<span class="step-pill" data-target="${i}">${p[0]}</span>`)
    .join("");
  nav.querySelectorAll(".step-pill").forEach((pill, i) => {
    pill.addEventListener("click", () => {
      const items = acc.querySelectorAll(".accordion-collapse");
      if (items[i]) {
        const bsCollapse = bootstrap.Collapse.getOrCreateInstance(items[i]);
        bsCollapse.show();
        items[i].scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  document.getElementById("resultEmpty").classList.add("d-none");
  document.getElementById("resultContent").classList.remove("d-none");
}

// ---------------------------------------------------------------------------
// Form handling
// ---------------------------------------------------------------------------
const form = document.getElementById("saesForm");
const inputBits = document.getElementById("inputBits");
const keyBits = document.getElementById("keyBits");
const inputLabel = document.getElementById("inputLabel");
const apiError = document.getElementById("apiError");

function updateLabels() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  inputLabel.textContent = mode === "encrypt" ? "Plaintext (16-bit biner)" : "Ciphertext (16-bit biner)";
  inputBits.placeholder = mode === "encrypt" ? "1101011100101000" : "0010010011101100";
}
document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener("change", updateLabels));

function sanitizeBinInput(el) {
  el.value = el.value.replace(/[^01]/g, "").slice(0, 16);
}
[inputBits, keyBits].forEach((el) => {
  el.addEventListener("input", () => sanitizeBinInput(el));
});

function validateField(el, errEl) {
  const v = el.value;
  if (v.length !== 16) {
    el.classList.add("is-invalid");
    errEl.textContent = `Harus tepat 16 digit biner (saat ini ${v.length} digit).`;
    return false;
  }
  el.classList.remove("is-invalid");
  return true;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  apiError.classList.add("d-none");

  const okInput = validateField(inputBits, document.getElementById("inputError"));
  const okKey = validateField(keyBits, document.getElementById("keyError"));
  if (!okInput || !okKey) return;

  const mode = document.querySelector('input[name="mode"]:checked').value;
  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Memproses...';

  try {
    const res = await fetch("/api/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, input: inputBits.value, key: keyBits.value }),
    });
    const data = await res.json();
    if (!res.ok) {
      apiError.textContent = data.error || "Terjadi kesalahan.";
      apiError.classList.remove("d-none");
      return;
    }
    buildResult(data);
    document.getElementById("result-section").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    apiError.textContent = "Gagal terhubung ke server: " + err.message;
    apiError.classList.remove("d-none");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="bi bi-play-fill"></i> SUBMIT';
  }
});

document.getElementById("resetBtn").addEventListener("click", () => {
  form.reset();
  inputBits.classList.remove("is-invalid");
  keyBits.classList.remove("is-invalid");
  apiError.classList.add("d-none");
  updateLabels();
});

document.getElementById("sampleBtn").addEventListener("click", () => {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  if (mode === "encrypt") {
    inputBits.value = "1101011100101000";
  } else {
    inputBits.value = "0010010011101100";
  }
  keyBits.value = "0100101011110101";
  inputBits.classList.remove("is-invalid");
  keyBits.classList.remove("is-invalid");
});

updateLabels();
