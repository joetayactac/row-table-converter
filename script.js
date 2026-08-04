(function () {
  "use strict";

  /* ---------------- State ---------------- */

  let columns = [
    { header: "Header Name 1", column: "Appsheet Column Name 1", sample: "Text 1" },
    { header: "Header Name 2", column: "Appsheet Column Name 2", sample: "Text 2" },
    { header: "Header Name 3", column: "Appsheet Column Name 3", sample: "Text 3" }
  ];
  let nextId = columns.length;
  columns = columns.map((c, i) => ({ id: i, ...c }));

  const settings = {
    headerCase: "upper",
    headerStyle: "bold",
    rowFn: "original",
    borderOn: true,
    tableWidth: "100%",
    textAlign: "left"
  };

  // Only emit an align attribute when it differs from the browser default,
  // keeping the formula clean when the user leaves alignment untouched.
  function alignAttr() {
    return settings.textAlign && settings.textAlign !== "left" ? ` align='${settings.textAlign}'` : "";
  }

  /* ---------------- DOM refs ---------------- */

  const columnsList = document.getElementById("columns-list");
  const addColumnBtn = document.getElementById("add-column");
  const previewWrap = document.getElementById("preview-wrap");
  const formulaCode = document.getElementById("formula-code");
  const copyBtn = document.getElementById("copy-btn");
  const borderToggle = document.getElementById("border-toggle");
  const borderToggleLabel = document.getElementById("border-toggle-label");
  const tableWidthInput = document.getElementById("table-width");

  /* ---------------- Helpers ---------------- */

  function cleanColumnRef(raw) {
    // Strip whitespace and any brackets the user may have typed, we re-add them.
    return String(raw || "").trim().replace(/^\[+/, "").replace(/\]+$/, "").trim();
  }

  function escapeForAppSheetString(text) {
    // AppSheet string literals use doubled double-quotes to escape a quote.
    return String(text || "").replace(/"/g, '""');
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function applyCase(text, mode) {
    const t = String(text || "");
    switch (mode) {
      case "upper":
        return t.toUpperCase();
      case "lower":
        return t.toLowerCase();
      case "formal":
        return t.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
      default:
        return t;
    }
  }

  function wrapHeaderStyle(text, style) {
    return style === "bold" ? `<b>${text}</b>` : text;
  }

  function rowFnLabel(fn) {
    return { original: "", upper: "UPPER", lower: "LOWER", proper: "PROPER" }[fn] || "";
  }

  /* ---------------- Column row rendering ---------------- */

  function renderColumns() {
    columnsList.innerHTML = "";

    columns.forEach((col, index) => {
      const row = document.createElement("div");
      row.className = "column-row";
      row.dataset.id = col.id;

      const badge = String(index + 1).padStart(2, "0");

      row.innerHTML = `
        <span class="col-index mono">${badge}</span>
        <input type="text" class="text-input header-input" placeholder="e.g. Vehicle No" value="${escapeHtml(col.header)}">
        <input type="text" class="mono-input column-input" placeholder="e.g. VEHICLE NO" value="${escapeHtml(col.column)}">
        <input type="text" class="text-input sample-input" placeholder="Preview text" value="${escapeHtml(col.sample)}">
        <div class="col-actions">
          <button type="button" class="icon-btn move-up" title="Move up" aria-label="Move column up">▲</button>
          <button type="button" class="icon-btn move-down" title="Move down" aria-label="Move column down">▼</button>
          <button type="button" class="icon-btn remove" title="Remove column" aria-label="Remove column">✕</button>
        </div>
      `;

      row.querySelector(".header-input").addEventListener("input", (e) => {
        col.header = e.target.value;
        renderOutputs();
      });
      row.querySelector(".column-input").addEventListener("input", (e) => {
        col.column = e.target.value;
        renderOutputs();
      });
      row.querySelector(".sample-input").addEventListener("input", (e) => {
        col.sample = e.target.value;
        renderPreview();
      });
      row.querySelector(".move-up").addEventListener("click", () => moveColumn(col.id, -1));
      row.querySelector(".move-down").addEventListener("click", () => moveColumn(col.id, 1));
      row.querySelector(".remove").addEventListener("click", () => removeColumn(col.id));

      columnsList.appendChild(row);
    });

    // Disable move buttons at the ends, disable remove when only one column left.
    const rows = columnsList.querySelectorAll(".column-row");
    rows.forEach((row, i) => {
      row.querySelector(".move-up").disabled = i === 0;
      row.querySelector(".move-down").disabled = i === rows.length - 1;
      row.querySelector(".remove").disabled = columns.length <= 1;
    });
  }

  function addColumn() {
    columns.push({
      id: nextId++,
      header: `Column ${columns.length + 1}`,
      column: `COLUMN ${columns.length + 1}`,
      sample: "Sample text"
    });
    renderColumns();
    renderOutputs();
    // Focus the newly added row's header input for quick editing.
    const rows = columnsList.querySelectorAll(".column-row");
    const last = rows[rows.length - 1];
    if (last) last.querySelector(".header-input").focus();
  }

  function removeColumn(id) {
    if (columns.length <= 1) return;
    columns = columns.filter((c) => c.id !== id);
    renderColumns();
    renderOutputs();
  }

  function moveColumn(id, direction) {
    const index = columns.findIndex((c) => c.id === id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= columns.length) return;
    const [item] = columns.splice(index, 1);
    columns.splice(target, 0, item);
    renderColumns();
    renderOutputs();
  }

  /* ---------------- Live preview ---------------- */

  function renderPreview() {
    if (columns.length === 0) {
      previewWrap.innerHTML = `<p class="empty-state">Add a column to see the preview.</p>`;
      return;
    }

    const borderAttr = settings.borderOn ? " border='1'" : "";
    const widthAttr = settings.tableWidth ? ` style="width:${escapeHtml(settings.tableWidth)}"` : "";

    const cellAlignStyle = settings.textAlign ? ` style="text-align:${settings.textAlign}"` : "";

    let html = `<table${borderAttr}${widthAttr}><thead><tr>`;
    columns.forEach((col) => {
      const headerText = applyCase(col.header, settings.headerCase) || "\u00A0";
      const inner = wrapHeaderStyle(escapeHtml(headerText), settings.headerStyle);
      html += `<th${cellAlignStyle}>${inner}</th>`;
    });
    html += `</tr></thead><tbody><tr>`;
    columns.forEach((col) => {
      let val = col.sample || "";
      if (settings.rowFn === "upper") val = val.toUpperCase();
      else if (settings.rowFn === "lower") val = val.toLowerCase();
      else if (settings.rowFn === "proper") val = applyCase(val, "formal");
      html += `<td${cellAlignStyle}>${escapeHtml(val) || "&nbsp;"}</td>`;
    });
    html += `</tr></tbody></table>`;

    previewWrap.innerHTML = html;
  }

  /* ---------------- Formula generation (with syntax highlighting) ---------------- */

  function tok(cls, text) {
    return `<span class="${cls}">${escapeHtml(text)}</span>`;
  }

  function buildFormulaLines() {
    const lines = [];
    const borderPart = settings.borderOn ? " border='1'" : "";
    const widthPart = settings.tableWidth ? ` width='${settings.tableWidth}'` : "";
    const openTag = `<table${borderPart}${widthPart}>`;

    lines.push({ html: tok("tok-str", `"${openTag}"`) });
    lines.push({ html: tok("tok-str", `"<tr>"`) });

    columns.forEach((col) => {
      const headerText = applyCase(col.header, settings.headerCase);
      const escaped = escapeForAppSheetString(headerText);
      const inner = wrapHeaderStyle(escaped, settings.headerStyle);
      const cellStr = `<th${alignAttr()}>${inner}</th>`;
      lines.push({ html: tok("tok-str", `"${cellStr}"`) });
    });

    lines.push({ html: tok("tok-str", `"</tr>"`) });
    lines.push({ html: tok("tok-str", `"<tr>"`) });

    columns.forEach((col) => {
      const ref = cleanColumnRef(col.column) || "COLUMN";
      const colRef = `[${ref}]`;
      const fn = rowFnLabel(settings.rowFn);
      const punc = tok("tok-punc", ",");
      const openTd = tok("tok-str", `"<td${alignAttr()}>"`);
      const closeTd = tok("tok-str", `"</td>"`);
      const refTok = tok("tok-col", colRef);
      const expr = fn ? `${tok("tok-fn", fn)}${tok("tok-punc", "(")}${refTok}${tok("tok-punc", ")")}` : refTok;
      lines.push({ html: `${openTd}${punc}${expr}${punc}${closeTd}` });
    });

    lines.push({ html: tok("tok-str", `"</tr>"`) });
    lines.push({ html: tok("tok-str", `"</table>"`), last: true });

    return lines;
  }

  function renderFormula() {
    const lines = buildFormulaLines();
    const body = lines
      .map((line) => {
        const comma = line.last ? "" : tok("tok-punc", ",");
        return `${line.html}${comma}`;
      })
      .join("\n");

    formulaCode.innerHTML =
      `${tok("tok-fn", "CONCATENATE")}${tok("tok-punc", "(")}\n${body}\n${tok("tok-punc", ")")}`;
  }

  function plainFormulaText() {
    const lines = buildFormulaLines();
    // Re-derive plain text without HTML markup for clipboard copy.
    const plainLines = [];
    const borderPart = settings.borderOn ? " border='1'" : "";
    const widthPart = settings.tableWidth ? ` width='${settings.tableWidth}'` : "";
    plainLines.push(`"<table${borderPart}${widthPart}>",`);
    plainLines.push(`"<tr>",`);

    columns.forEach((col) => {
      const headerText = applyCase(col.header, settings.headerCase);
      const escaped = escapeForAppSheetString(headerText);
      const inner = wrapHeaderStyle(escaped, settings.headerStyle);
      plainLines.push(`"<th${alignAttr()}>${inner}</th>",`);
    });

    plainLines.push(`"</tr>",`);
    plainLines.push(`"<tr>",`);

    columns.forEach((col) => {
      const ref = cleanColumnRef(col.column) || "COLUMN";
      const colRef = `[${ref}]`;
      const fn = rowFnLabel(settings.rowFn);
      const expr = fn ? `${fn}(${colRef})` : colRef;
      plainLines.push(`"<td${alignAttr()}>",${expr},"</td>",`);
    });

    plainLines.push(`"</tr>",`);
    plainLines.push(`"</table>"`);

    return `CONCATENATE(\n${plainLines.join("\n")}\n)`;
  }

  /* ---------------- Copy button ---------------- */

  async function copyFormula() {
    const text = plainFormulaText();
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      // Fallback for browsers without async clipboard support.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e) { /* no-op */ }
      document.body.removeChild(ta);
    }
    const original = copyBtn.innerHTML;
    copyBtn.classList.add("copied");
    copyBtn.innerHTML = `<span class="copy-icon">✓</span> Copied!`;
    setTimeout(() => {
      copyBtn.classList.remove("copied");
      copyBtn.innerHTML = original;
    }, 1600);
  }

  /* ---------------- Wire up global settings ---------------- */

  function renderOutputs() {
    renderPreview();
    renderFormula();
  }

  document.querySelectorAll('input[name="headerCase"]').forEach((el) => {
    el.addEventListener("change", (e) => {
      settings.headerCase = e.target.value;
      renderOutputs();
    });
  });

  document.querySelectorAll('input[name="headerStyle"]').forEach((el) => {
    el.addEventListener("change", (e) => {
      settings.headerStyle = e.target.value;
      renderOutputs();
    });
  });

  document.querySelectorAll('input[name="rowFn"]').forEach((el) => {
    el.addEventListener("change", (e) => {
      settings.rowFn = e.target.value;
      renderOutputs();
    });
  });

  document.querySelectorAll('input[name="textAlign"]').forEach((el) => {
    el.addEventListener("change", (e) => {
      settings.textAlign = e.target.value;
      renderOutputs();
    });
  });

  borderToggle.addEventListener("click", () => {
    settings.borderOn = !settings.borderOn;
    borderToggle.classList.toggle("is-on", settings.borderOn);
    borderToggle.setAttribute("aria-checked", String(settings.borderOn));
    borderToggleLabel.textContent = settings.borderOn ? "ON" : "OFF";
    renderOutputs();
  });

  tableWidthInput.addEventListener("input", (e) => {
    settings.tableWidth = e.target.value.trim();
    renderOutputs();
  });

  addColumnBtn.addEventListener("click", addColumn);
  copyBtn.addEventListener("click", copyFormula);

  /* ---------------- Init ---------------- */

  // Sync the default settings above with the pre-checked radios in HTML,
  // so state and UI agree from the very first render.
  document.querySelector(`input[name="headerCase"][value="${settings.headerCase}"]`).checked = true;
  document.querySelector(`input[name="headerStyle"][value="${settings.headerStyle}"]`).checked = true;
  document.querySelector(`input[name="rowFn"][value="${settings.rowFn}"]`).checked = true;
  document.querySelector(`input[name="textAlign"][value="${settings.textAlign}"]`).checked = true;

  renderColumns();
  renderOutputs();
})();
