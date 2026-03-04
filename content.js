// HueLoot – content script
// Extracts colors from the page and renders a modal overlay.

(() => {
  // ── Idempotency guard ────────────────────────────────────────────────────
  if (document.getElementById("hueloot-overlay")) {
    document.getElementById("hueloot-overlay").remove();
    return;
  }

  // ── Color normalization helpers ──────────────────────────────────────────

  /**
   * Convert any CSS color string to a normalised hex string.
   * Returns null for transparent / unresolvable colors.
   */
  function toHex(color) {
    if (!color || color === "transparent" || color === "initial" ||
        color === "inherit" || color === "unset" || color === "none" ||
        color === "currentcolor") return null;

    // Use a hidden canvas pixel to let the browser parse the color
    const ctx = document.createElement("canvas").getContext("2d");
    ctx.fillStyle = "#000"; // reset
    ctx.fillStyle = color;
    const parsed = ctx.fillStyle;

    // If the browser didn't recognise it, canvas leaves it as "#000000"
    // – only treat black as valid when the input actually looks like black
    if (parsed === "#000000" && !isBlackColor(color)) return null;

    // parsed is already a hex string for solid colors; rgba() for alpha
    if (parsed.startsWith("#")) return parsed.toLowerCase();

    // rgba(r,g,b,a) – skip fully transparent
    const m = parsed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!m) return null;
    if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;

    return (
      "#" +
      [m[1], m[2], m[3]]
        .map((v) => parseInt(v).toString(16).padStart(2, "0"))
        .join("")
    ).toLowerCase();
  }

  function isBlackColor(str) {
    const s = str.trim().toLowerCase();
    return (
      s === "black" || s === "#000" || s === "#000000" ||
      s === "rgb(0,0,0)" || s === "rgb(0, 0, 0)"
    );
  }

  // ── Color extraction ─────────────────────────────────────────────────────

  const STYLE_PROPS = [
    "color",
    "backgroundColor",
    "borderTopColor",
    "borderRightColor",
    "borderBottomColor",
    "borderLeftColor",
    "outlineColor",
    "textDecorationColor",
    "columnRuleColor",
    "caretColor",
  ];

  function extractFromComputedStyles() {
    const colors = new Set();
    const elements = document.querySelectorAll("*");
    elements.forEach((el) => {
      const cs = window.getComputedStyle(el);
      STYLE_PROPS.forEach((prop) => {
        const hex = toHex(cs[prop]);
        if (hex) colors.add(hex);
      });
      // Also grab gradient/image backgrounds via raw value
      const bg = cs.backgroundImage;
      if (bg && bg !== "none") {
        const matches = bg.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/g);
        if (matches) matches.forEach((c) => { const h = toHex(c); if (h) colors.add(h); });
      }
    });
    return colors;
  }

  function extractFromStylesheets() {
    const colors = new Set();
    const colorRegex = /#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/g;

    Array.from(document.styleSheets).forEach((sheet) => {
      let rules;
      try { rules = sheet.cssRules; } catch { return; } // cross-origin
      if (!rules) return;
      Array.from(rules).forEach((rule) => {
        if (!rule.cssText) return;
        const matches = rule.cssText.match(colorRegex);
        if (matches) matches.forEach((c) => { const h = toHex(c); if (h) colors.add(h); });
      });
    });
    return colors;
  }

  function extractFromInlineStyles() {
    const colors = new Set();
    const colorRegex = /#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/g;
    document.querySelectorAll("[style]").forEach((el) => {
      const matches = el.getAttribute("style").match(colorRegex);
      if (matches) matches.forEach((c) => { const h = toHex(c); if (h) colors.add(h); });
    });
    return colors;
  }

  function gatherAllColors() {
    const all = new Set([
      ...extractFromComputedStyles(),
      ...extractFromStylesheets(),
      ...extractFromInlineStyles(),
    ]);

    // Sort by hue for a pleasant palette-like order
    return [...all].sort((a, b) => {
      const ha = hexToHsl(a), hb = hexToHsl(b);
      if (ha.h !== hb.h) return ha.h - hb.h;
      if (ha.s !== hb.s) return hb.s - ha.s;
      return hb.l - ha.l;
    });
  }

  function hexToHsl(hex) {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  // ── Relative luminance for contrast check ────────────────────────────────
  function luminance(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const lin = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  function labelColor(hex) {
    return luminance(hex) > 0.35 ? "#111111" : "#ffffff";
  }

  // ── Modal construction ───────────────────────────────────────────────────

  function buildModal(colors) {
    const overlay = document.createElement("div");
    overlay.id = "hueloot-overlay";

    const modal = document.createElement("div");
    modal.id = "hueloot-modal";

    // Header
    const header = document.createElement("div");
    header.id = "hueloot-header";

    const title = document.createElement("span");
    title.id = "hueloot-title";
    title.textContent = `HueLoot — ${colors.length} color${colors.length !== 1 ? "s" : ""} found`;

    const closeBtn = document.createElement("button");
    closeBtn.id = "hueloot-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", () => overlay.remove());

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Grid
    const grid = document.createElement("div");
    grid.id = "hueloot-grid";

    if (colors.length === 0) {
      const empty = document.createElement("p");
      empty.id = "hueloot-empty";
      empty.textContent = "No colors detected on this page.";
      grid.appendChild(empty);
    } else {
      colors.forEach((hex) => {
        const swatch = document.createElement("button");
        swatch.className = "hueloot-swatch";
        swatch.title = `Copy ${hex}`;
        swatch.style.backgroundColor = hex;

        const label = document.createElement("span");
        label.className = "hueloot-swatch-label";
        label.style.color = labelColor(hex);
        label.textContent = hex;

        swatch.appendChild(label);
        swatch.addEventListener("click", () => copyColor(hex, label));
        grid.appendChild(swatch);
      });
    }

    modal.appendChild(header);
    modal.appendChild(grid);
    overlay.appendChild(modal);

    // Close on backdrop click
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    // Close on Escape
    const onKey = (e) => { if (e.key === "Escape") { overlay.remove(); document.removeEventListener("keydown", onKey); } };
    document.addEventListener("keydown", onKey);

    return overlay;
  }

  // ── Copy to clipboard ────────────────────────────────────────────────────

  function copyColor(hex, labelEl) {
    const originalText = labelEl.textContent;
    navigator.clipboard.writeText(hex).then(() => {
      labelEl.textContent = "Copied!";
      labelEl.classList.add("hueloot-copied");
      setTimeout(() => {
        labelEl.textContent = originalText;
        labelEl.classList.remove("hueloot-copied");
      }, 1200);
    }).catch(() => {
      // Fallback for browsers that block clipboard in content scripts
      const ta = document.createElement("textarea");
      ta.value = hex;
      ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      labelEl.textContent = "Copied!";
      setTimeout(() => { labelEl.textContent = originalText; }, 1200);
    });
  }

  // ── Entry point ──────────────────────────────────────────────────────────

  const colors = gatherAllColors();
  const overlay = buildModal(colors);
  document.body.appendChild(overlay);
})();
