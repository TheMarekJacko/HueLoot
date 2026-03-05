// HueLoot – content script
// Extracts colors from the page and renders a modal overlay.

(async () => {
  // ── Idempotency guard ────────────────────────────────────────────────────
  if (document.getElementById("hueloot-shadow-host")) {
    document.getElementById("hueloot-shadow-host").remove();
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

  // ── Random title messages ─────────────────────────────────────────────────

  const MESSAGES = [
    // Confused energy
    "{n} colors. Is this normal?",
    "Wait, {n} colors? How did we get here?",
    "{n} colors found. I'm still not sure how this works.",
    "Uhh, {n} colors? That seems like a lot actually.",
    "Hold on, {n} different colors? On THIS page?",
    "So we're just collecting colors now? Found {n}.",
    "{n} colors. This is either genius or chaos.",
    "{n} colors unearthed. My brain hurts a little.",
    "{n} colors??? On THIS website???",
    "I found {n} colors. Don't ask me how.",
    "{n} colors. Why am I surprised by this?",
    "{n} colors. What even is a webpage anymore.",
    // Sarcastic
    "Oh wow, {n} whole colors. Groundbreaking.",
    "Designer used {n} colors. Bold choice.",
    "{n} colors found. Seriously?",
    "Someone spent hours picking these {n} colors.",
    "{n} colors. Hope you know what you're doing.",
    "{n} colors on one page? Sir, this is a website.",
    "Whoever designed this used {n} colors. Just saying.",
    "{n} colors. The client asked for \"just a few tweaks\".",
    "{n} colors detected. Designer needs a nap.",
    "{n} colors. Cool cool cool. Totally intentional.",
    "Ah yes, {n} colors. Very subtle design choices.",
    "{n} colors. Someone had fun with the color picker.",
    "{n} colors found. The designer has left the building.",
    // Short & punchy
    "{n} colors. Boom.",
    "That's {n} colors, baby.",
    "{n} colors. Go wild.",
    "Yoink. {n} colors.",
    "{n} colors. No cap.",
    "{n} colors. Let's go.",
    "{n} colors secured. \uD83D\uDD12",
    "Boom. {n} colors. Done.",
    "{n} colors. You're up.",
    "Fresh. {n} colors. Yours.",
    "{n} colors. Take 'em.",
    "Got 'em. All {n}.",
    "{n} colors. Easy money.",
    // Encouragement
    "{n} colors ready for you, champ.",
    "Go on, take all {n}. You deserve it.",
    "{n} colors. You absolute legend.",
    "Fresh batch of {n} colors. Just for you.",
    "{n} colors. Now go build something beautiful.",
    "{n} colors. You've got this.",
    "Look at you, extracting {n} colors like a pro.",
    "{n} colors on a plate. You're welcome, superstar.",
    "{n} colors found. Your future self thanks you.",
    "{n} colors. Go make something they'll remember.",
    "{n} colors. The world is yours.",
    "Honestly? {n} colors. Not bad at all.",
  ];

  function randomTitle(n) {
    const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    return "HueLoot — " + msg.replace("{n}", n);
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
      // Skip elements that aren't visible
      if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return;
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

  function gatherAllColors() {
    // Sort by hue for a pleasant palette-like order
    return [...extractFromComputedStyles()].sort((a, b) => {
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

  // ── Swatch factory ──────────────────────────────────────────────────────

  function createSwatch(hex) {
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
    return swatch;
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
    title.textContent = randomTitle(colors.length);

    const infoBtn = document.createElement("button");
    infoBtn.id = "hueloot-info-btn";
    infoBtn.setAttribute("aria-label", "How colors are extracted");
    infoBtn.textContent = "ⓘ";

    const closeBtn = document.createElement("button");
    closeBtn.id = "hueloot-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", () => overlay.remove());

    const controls = document.createElement("div");
    controls.id = "hueloot-controls";
    controls.appendChild(infoBtn);
    controls.appendChild(closeBtn);

    header.appendChild(title);
    header.appendChild(controls);

    // Info panel
    const infoPanel = document.createElement("div");
    infoPanel.id = "hueloot-info-panel";

    // Left: How it works
    const howSection = document.createElement("div");
    howSection.id = "hueloot-how-section";

    const howHeading = document.createElement("p");
    howHeading.id = "hueloot-how-heading";
    howHeading.textContent = "How it works";

    const howBody = document.createElement("div");
    howBody.id = "hueloot-how-body";

    const p1 = document.createElement("p");
    p1.innerHTML = 'Colors come from <strong>computed styles of visible elements</strong> — what the browser has actually resolved and rendered. For each element that isn’t <code>display:none</code>, <code>visibility:hidden</code>, or <code>opacity:0</code>, it reads:';

    const ul = document.createElement("ul");
    [
      '<code>color</code> (text) &amp; <code>backgroundColor</code>',
      'Border colors (top / right / bottom / left)',
      '<code>outlineColor</code>, <code>textDecorationColor</code>, <code>caretColor</code>, <code>columnRuleColor</code>',
      'Colors inside <code>backgroundImage</code> gradients',
    ].forEach((html) => { const li = document.createElement("li"); li.innerHTML = html; ul.appendChild(li); });

    const p2 = document.createElement("p");
    p2.innerHTML = 'You may still see “invisible” colors — the filter skips the three above, but not zero-sized, off-screen, or <code>overflow:hidden</code>-clipped elements. These are technically visible to the browser even if you can’t see them.';

    howBody.appendChild(p1);
    howBody.appendChild(ul);
    howBody.appendChild(p2);

    howSection.appendChild(howHeading);
    howSection.appendChild(howBody);

    // Right: Creator card
    const creatorSection = document.createElement("div");
    creatorSection.id = "hueloot-creator";

    const avatar = document.createElement("img");
    avatar.id = "hueloot-avatar";
    avatar.src = chrome.runtime.getURL("avatar.png");
    avatar.alt = "Marek Jacko";
    avatar.onerror = () => { avatar.style.display = "none"; };

    const createdByLabel = document.createElement("span");
    createdByLabel.id = "hueloot-created-by";
    createdByLabel.textContent = "Created by";

    const creatorName = document.createElement("span");
    creatorName.id = "hueloot-creator-name";
    creatorName.textContent = "Marek Jacko";

    const creatorRole = document.createElement("span");
    creatorRole.id = "hueloot-creator-role";
    creatorRole.textContent = "Agentic Systems Engineer";

    const linkBlockPersonal = document.createElement("div");
    linkBlockPersonal.className = "hueloot-link-block";
    const linkPersonal = document.createElement("a");
    linkPersonal.className = "hueloot-creator-link";
    linkPersonal.href = "https://jackoai.com";
    linkPersonal.target = "_blank";
    linkPersonal.rel = "noopener noreferrer";
    linkPersonal.textContent = "jackoai.com";
    const descPersonal = document.createElement("span");
    descPersonal.className = "hueloot-link-desc";
    descPersonal.textContent = "Personal practice & agentic engineering";
    linkBlockPersonal.appendChild(linkPersonal);
    linkBlockPersonal.appendChild(descPersonal);

    const linkBlockShadow = document.createElement("div");
    linkBlockShadow.className = "hueloot-link-block";
    const linkShadow = document.createElement("a");
    linkShadow.className = "hueloot-creator-link";
    linkShadow.id = "hueloot-link-shadow";
    linkShadow.href = "https://myshadowwriter.com";
    linkShadow.target = "_blank";
    linkShadow.rel = "noopener noreferrer";
    linkShadow.textContent = "myshadowwriter.com ✨";
    const descShadow = document.createElement("span");
    descShadow.className = "hueloot-link-desc";
    descShadow.textContent = "Love reading fiction? You\'ll love this app.";
    linkBlockShadow.appendChild(linkShadow);
    linkBlockShadow.appendChild(descShadow);

    creatorSection.appendChild(avatar);
    creatorSection.appendChild(createdByLabel);
    creatorSection.appendChild(creatorName);
    creatorSection.appendChild(creatorRole);
    creatorSection.appendChild(linkBlockPersonal);
    creatorSection.appendChild(linkBlockShadow);

    infoPanel.appendChild(howSection);
    infoPanel.appendChild(creatorSection);

    infoBtn.addEventListener("click", () => {
      const open = infoPanel.classList.toggle("hueloot-info-open");
      infoBtn.classList.toggle("hueloot-info-active", open);
    });

    // Grid
    const grid = document.createElement("div");
    grid.id = "hueloot-grid";

    if (colors.length === 0) {
      const empty = document.createElement("p");
      empty.id = "hueloot-empty";
      empty.textContent = "No colors detected on this page.";
      grid.appendChild(empty);
    } else {
      colors.forEach((hex) => grid.appendChild(createSwatch(hex)));

      // ── EyeDropper picker card ──────────────────────────────────────────
      if (window.EyeDropper) {
        const pickerCard = document.createElement("button");
        pickerCard.className = "hueloot-swatch hueloot-picker-card";
        pickerCard.title = "Pick a color from the page";

        const icon = document.createElement("span");
        icon.className = "hueloot-picker-icon";
        icon.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8-3 3"/></svg>`;

        const pickerLabel = document.createElement("span");
        pickerLabel.className = "hueloot-picker-label";
        pickerLabel.textContent = "Pick color";

        pickerCard.appendChild(icon);
        pickerCard.appendChild(pickerLabel);

        pickerCard.addEventListener("click", async () => {
          overlay.style.display = "none";
          try {
            const { sRGBHex } = await new EyeDropper().open();
            const hex = sRGBHex.toLowerCase();
            overlay.style.display = "";
            const newSwatch = createSwatch(hex);
            grid.insertBefore(newSwatch, pickerCard);
            copyColor(hex, newSwatch.querySelector(".hueloot-swatch-label"));
          } catch {
            // User cancelled — just restore the modal
            overlay.style.display = "";
          }
        });

        grid.appendChild(pickerCard);
      }
    }

    modal.appendChild(header);
    modal.appendChild(infoPanel);
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

  if (!document.body) return;

  const colors = gatherAllColors();
  const overlay = buildModal(colors);

  // Build shadow host but don’t add to DOM yet
  const shadowHost = document.createElement("div");
  shadowHost.id = "hueloot-shadow-host";
  shadowHost.style.cssText = "all:initial;position:fixed;top:0;left:0;z-index:2147483647;";

  const shadow = shadowHost.attachShadow({ mode: "open" });

  // Fetch CSS and inject as <style> so it’s ready before the host is visible
  const cssText = await fetch(chrome.runtime.getURL("modal.css")).then(r => r.text());
  const style = document.createElement("style");
  style.textContent = cssText;
  shadow.appendChild(style);
  shadow.appendChild(overlay);

  // Mount fully-styled modal in one paint — no flash
  document.body.appendChild(shadowHost);
  overlay.remove = () => shadowHost.remove();
})();
