// The userscript's Material 3 panel, ported as-is (minus the replay-request
// tool). Rendered in a WebView so the CSS/HTML stay identical to the original.

var SCHEME = {
    light: {
        primary: [0.44, 0.155, 0],
        'on-primary': [1, 0, 0],
        'primary-container': [0.92, 0.055, 0],
        'on-primary-container': [0.30, 0.095, 0],
        'secondary-container': [0.93, 0.03, 0],
        'on-secondary-container': [0.33, 0.04, 0],
        error: [0.50, 0.19, 27],
        'error-container': [0.92, 0.06, 27],
        'on-error-container': [0.35, 0.12, 27],
        'on-surface': [0.23, 0.012, 0],
        'on-surface-variant': [0.44, 0.02, 0],
        'surface-container-lowest': [1, 0, 0],
        'surface-container-low': [0.97, 0.008, 0],
        'surface-container': [0.955, 0.012, 0],
        'surface-container-high': [0.93, 0.015, 0],
        'surface-container-highest': [0.90, 0.018, 0],
        outline: [0.55, 0.02, 0],
        'outline-variant': [0.83, 0.02, 0],
    },
    dark: {
        primary: [0.80, 0.12, 0],
        'on-primary': [0.28, 0.08, 0],
        'primary-container': [0.36, 0.11, 0],
        'on-primary-container': [0.92, 0.05, 0],
        'secondary-container': [0.33, 0.03, 0],
        'on-secondary-container': [0.90, 0.03, 0],
        error: [0.78, 0.14, 27],
        'error-container': [0.37, 0.12, 27],
        'on-error-container': [0.92, 0.06, 27],
        'on-surface': [0.91, 0.012, 0],
        'on-surface-variant': [0.78, 0.02, 0],
        'surface-container-lowest': [0.12, 0.01, 0],
        'surface-container-low': [0.185, 0.013, 0],
        'surface-container': [0.215, 0.015, 0],
        'surface-container-high': [0.255, 0.017, 0],
        'surface-container-highest': [0.30, 0.019, 0],
        outline: [0.66, 0.02, 0],
        'outline-variant': [0.42, 0.02, 0],
    },
};

var TOKENS = `
  :root {
    --md-font: "Google Sans Flex", "Google Sans", Roboto, system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
    font-variation-settings: 'ROND' 100;
    font-optical-sizing: auto;

    --sp-1: 4px;
    --sp-2: 8px;
    --sp-3: 12px;
    --sp-4: 16px;
    --sp-8: 32px;

    --md-sys-shape-corner-extra-small: 4px;
    --md-sys-shape-corner-small: 8px;
    --md-sys-shape-corner-medium: 12px;
    --md-sys-shape-corner-large: 16px;
    --md-sys-shape-corner-extra-large: 28px;
    --md-sys-shape-corner-full: 999px;

    --md-sys-elevation-2: 0 1px 2px rgba(0,0,0,.3), 0 2px 6px 2px rgba(0,0,0,.15);
    --md-sys-elevation-3: 0 1px 3px rgba(0,0,0,.3), 0 4px 8px 3px rgba(0,0,0,.15);
    --md-sys-elevation-4: 0 2px 3px rgba(0,0,0,.3), 0 6px 10px 4px rgba(0,0,0,.15);

    --md-sys-motion-standard: cubic-bezier(.2, 0, 0, 1);
    --md-sys-motion-decelerate: cubic-bezier(.05, .7, .1, 1);
    --md-sys-motion-spring: cubic-bezier(.34, 1.4, .64, 1);
    --md-sys-motion-short: 150ms;
    --md-sys-motion-medium: 220ms;
    --md-sys-motion-long: 400ms;

    --md-sys-typescale-label-small: 500 12px/18px var(--md-font);
    --md-sys-typescale-label-medium: 500 13px/18px var(--md-font);
    --md-sys-typescale-label-large: 500 15px/22px var(--md-font);
    --md-sys-typescale-body-small: 400 13px/18px var(--md-font);
    --md-sys-typescale-body-medium: 400 15px/22px var(--md-font);
    --md-sys-typescale-title-medium: 500 18px/26px var(--md-font);
    --md-sys-typescale-title-large: 400 24px/30px var(--md-font);
  }
`;

var CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: transparent; }
  body { overflow: hidden; }
  ::selection {
    background: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
  }

  .host { padding: 12px; }

  .panel {
    width: 100%;
    padding: 6px 0 var(--sp-4);
    background: var(--md-sys-color-surface-container);
    color: var(--md-sys-color-on-surface);
    border-radius: var(--md-sys-shape-corner-extra-large);
    box-shadow: var(--md-sys-elevation-3);
    font: var(--md-sys-typescale-body-small);
    font-variation-settings: 'ROND' 100;
    animation: panel-in var(--md-sys-motion-long) var(--md-sys-motion-spring) both;
  }
  @keyframes panel-in {
    from { opacity: 0; transform: scale(.94) translateY(8px); }
  }
  .panel.min .body { display: none; }
  .panel.min { padding-bottom: 0; }
  .panel.min .actions { padding-bottom: var(--sp-4); }

  .bar {
    display: flex; align-items: center; gap: var(--sp-2);
    height: 64px; padding: 0 var(--sp-4);
    cursor: move; user-select: none;
    touch-action: none;
  }
  .brand {
    flex: 0 0 auto; width: 44px; height: 44px;
    display: grid; place-items: center;
    border-radius: var(--md-sys-shape-corner-full);
    background: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
    font: var(--md-sys-typescale-label-large); font-weight: 700;
  }
  .bar .title {
    flex: 1; min-width: 0;
    font: var(--md-sys-typescale-title-medium); letter-spacing: -.1px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .icon-btn {
    all: unset; flex: 0 0 auto;
    width: 44px; height: 44px; display: grid; place-items: center;
    border-radius: var(--md-sys-shape-corner-full);
    color: var(--md-sys-color-on-surface-variant);
    font: var(--md-sys-typescale-title-medium);
    cursor: pointer;
    transition: background-color var(--md-sys-motion-short) var(--md-sys-motion-standard);
  }
  .icon-btn:hover { background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent); }
  .icon-btn:active { background: color-mix(in srgb, var(--md-sys-color-on-surface) 12%, transparent); }
  .icon-btn:focus-visible { outline: 2px solid var(--md-sys-color-primary); outline-offset: 2px; }

  .btn {
    flex: 0 0 auto; min-height: 44px; padding: 0 var(--sp-4);
    display: inline-flex; align-items: center; justify-content: center; gap: var(--sp-2);
    border: 1px solid transparent; border-radius: var(--md-sys-shape-corner-full);
    background: transparent; color: var(--md-sys-color-primary);
    font: var(--md-sys-typescale-label-large);
    cursor: pointer;
    transition: background-color var(--md-sys-motion-short) var(--md-sys-motion-standard),
                transform var(--md-sys-motion-short) var(--md-sys-motion-spring);
  }
  .btn:hover { background: color-mix(in srgb, var(--md-sys-color-primary) 8%, transparent); }
  .btn:active { background: color-mix(in srgb, var(--md-sys-color-primary) 12%, transparent); transform: scale(.96); }
  .btn:focus-visible { outline: 2px solid var(--md-sys-color-primary); outline-offset: 2px; }
  .btn.tonal { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
  .btn.tonal:hover { background: color-mix(in srgb, var(--md-sys-color-on-secondary-container) 8%, var(--md-sys-color-secondary-container)); }

  .actions {
    display: flex; align-items: center; gap: var(--sp-2);
    padding: 0 var(--sp-4) var(--sp-2);
  }

  .menu-wrap { position: relative; flex: 0 0 auto; }
  .menu {
    position: absolute; top: calc(100% + var(--sp-2)); left: 0; z-index: 5;
    width: 248px; max-width: calc(100vw - var(--sp-8));
    padding: var(--sp-2);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-medium);
    background: var(--md-sys-color-surface-container-high);
    box-shadow: var(--md-sys-elevation-2);
    transform-origin: top left;
    animation: menu-in var(--md-sys-motion-medium) var(--md-sys-motion-spring);
  }
  @keyframes menu-in {
    from { opacity: 0; transform: scale(.9); }
  }
  .menu-item {
    all: unset; box-sizing: border-box;
    display: flex; align-items: center; gap: var(--sp-2);
    width: 100%; min-height: 44px; padding: 0 var(--sp-3);
    border-radius: var(--md-sys-shape-corner-small);
    color: var(--md-sys-color-on-surface);
    font: var(--md-sys-typescale-label-large);
    cursor: pointer;
  }
  .menu-item:hover { background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent); }
  .menu-item:focus-visible { outline: 2px solid var(--md-sys-color-primary); outline-offset: -2px; }
  .menu-sep { height: 1px; margin: var(--sp-1) var(--sp-2); background: var(--md-sys-color-outline-variant); }
  .switch {
    margin-left: auto; position: relative;
    width: 40px; height: 24px; flex: 0 0 auto;
    border: 2px solid var(--md-sys-color-outline);
    border-radius: var(--md-sys-shape-corner-full);
    background: transparent;
    transition: background-color var(--md-sys-motion-short) var(--md-sys-motion-standard),
                border-color var(--md-sys-motion-short) var(--md-sys-motion-standard);
  }
  .switch::after {
    content: ''; position: absolute; top: 50%; left: 3px;
    width: 14px; height: 14px; margin-top: -7px;
    border-radius: var(--md-sys-shape-corner-full);
    background: var(--md-sys-color-outline);
    transition: left var(--md-sys-motion-short) var(--md-sys-motion-spring),
                background-color var(--md-sys-motion-short) var(--md-sys-motion-standard);
  }
  .menu-item[aria-checked="true"] .switch {
    background: var(--md-sys-color-primary);
    border-color: var(--md-sys-color-primary);
  }
  .menu-item[aria-checked="true"] .switch::after { left: 19px; background: var(--md-sys-color-on-primary); }

  .menu-block { position: relative; padding: var(--sp-1) var(--sp-3) var(--sp-4); }
  .menu-label {
    display: block;
    font: var(--md-sys-typescale-label-small);
    color: var(--md-sys-color-on-surface-variant);
  }

  .wheel {
    --hue: 265;
    position: relative; width: 112px; height: 112px;
    margin: var(--sp-2) auto var(--sp-1);
    border-radius: var(--md-sys-shape-corner-full);
    background:
      radial-gradient(circle, var(--md-sys-color-surface-container-high) 0 23px, transparent 24px),
      conic-gradient(from 0deg,
        oklch(.70 .16 0), oklch(.70 .16 60), oklch(.70 .16 120),
        oklch(.70 .16 180), oklch(.70 .16 240), oklch(.70 .16 300), oklch(.70 .16 360));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--md-sys-color-on-surface) 12%, transparent);
    cursor: crosshair;
    touch-action: none;
  }
  .wheel:focus-visible { outline: 2px solid var(--md-sys-color-primary); outline-offset: 3px; }
  .wheel-thumb {
    position: absolute; left: 50%; top: 50%;
    width: 18px; height: 18px; margin: -9px;
    border-radius: var(--md-sys-shape-corner-full);
    background: oklch(.66 .16 calc(var(--hue) * 1deg));
    box-shadow: 0 0 0 2px var(--md-sys-color-surface-container-high),
                0 0 0 3px var(--md-sys-color-outline);
    transform: rotate(calc(var(--hue) * 1deg)) translateY(-41px);
    pointer-events: none;
  }

  .theme-btn {
    position: absolute; right: var(--sp-3); bottom: var(--sp-3);
    width: 34px; height: 34px; padding: 0;
    display: grid; place-items: center;
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-full);
    background: var(--md-sys-color-surface-container-highest);
    color: var(--md-sys-color-on-surface-variant);
    cursor: pointer;
    transition: background-color var(--md-sys-motion-short) var(--md-sys-motion-standard),
                transform var(--md-sys-motion-short) var(--md-sys-motion-spring);
  }
  .theme-btn:hover { background: var(--md-sys-color-surface-container-high); }
  .theme-btn:active { transform: scale(.92); }
  .theme-btn svg { width: 18px; height: 18px; fill: currentColor; }
  .theme-btn .i-sun { display: none; }
  html[data-theme="dark"] .theme-btn .i-sun { display: block; }
  html[data-theme="dark"] .theme-btn .i-moon { display: none; }

  .body {
    max-height: var(--body-max, 60vh);
    overflow: auto;
    padding: 0 var(--sp-4);
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: var(--md-sys-color-outline-variant) transparent;
  }

  .part { margin-top: var(--sp-4); }
  .part-head {
    display: flex; align-items: center; gap: var(--sp-2);
    padding: 0 0 var(--sp-2);
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
    font: var(--md-sys-typescale-label-large);
    color: var(--md-sys-color-on-surface-variant);
  }
  .part-head em {
    margin-left: auto; min-height: 28px; padding: 0 var(--sp-2);
    display: inline-flex; align-items: center;
    border-radius: var(--md-sys-shape-corner-small);
    background: var(--md-sys-color-surface-container-high);
    color: var(--md-sys-color-on-surface-variant);
    font: var(--md-sys-typescale-label-medium); font-style: normal;
  }

  .q {
    margin-top: var(--sp-1);
    padding: var(--sp-3);
    border-radius: var(--md-sys-shape-corner-medium);
    animation: q-in var(--md-sys-motion-medium) var(--md-sys-motion-decelerate) both;
    animation-delay: calc(var(--i, 0) * 18ms);
  }
  @keyframes q-in {
    from { opacity: 0; transform: translateY(6px); }
  }
  .q:nth-child(even) { background: var(--md-sys-color-surface-container-low); }
  .q-top { display: flex; align-items: center; gap: var(--sp-2); }
  .num {
    flex: 0 0 auto; min-width: 28px; height: 28px; padding: 0 var(--sp-2);
    display: grid; place-items: center;
    border-radius: var(--md-sys-shape-corner-small);
    background: var(--md-sys-color-surface-container-highest);
    color: var(--md-sys-color-on-surface-variant);
    font: var(--md-sys-typescale-label-medium); font-weight: 700;
  }
  .qtitle {
    flex: 1; min-width: 0;
    font: var(--md-sys-typescale-body-medium);
    color: var(--md-sys-color-on-surface);
    overflow-wrap: anywhere;
  }
  .q.compact { display: flex; align-items: center; gap: var(--sp-2); padding: var(--sp-2) var(--sp-3); }
  .q.compact .qtitle { display: none; }
  .ans {
    flex: 1; min-width: 0;
    font: var(--md-sys-typescale-label-large); font-weight: 700;
    letter-spacing: .5px;
    color: var(--md-sys-color-on-surface);
    overflow-wrap: anywhere;
  }
  .opts { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-2); }
  .opt {
    display: inline-flex; align-items: center; gap: var(--sp-1);
    max-width: 100%;
    padding: var(--sp-2);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-small);
    background: var(--md-sys-color-surface-container-lowest);
    color: var(--md-sys-color-on-surface-variant);
    font: var(--md-sys-typescale-label-medium);
    white-space: pre-line;
  }
  .opt.on {
    border-color: transparent;
    background: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
  }
  .opt.on i { font-style: normal; font-size: 12px; }
  .opt.off {
    border-color: transparent;
    background: var(--md-sys-color-error-container);
    color: var(--md-sys-color-on-error-container);
  }
  .opt.blank {
    justify-content: center; min-width: 34px;
    border-color: transparent;
    background: var(--md-sys-color-surface-container-high);
    color: var(--md-sys-color-on-surface);
    font-family: ui-monospace, Menlo, Consolas, monospace;
  }
  .note {
    margin-top: var(--sp-1);
    font: var(--md-sys-typescale-label-small);
    color: var(--md-sys-color-on-surface-variant);
    white-space: pre-line;
  }
  .empty {
    padding: var(--sp-4);
    text-align: center;
    color: var(--md-sys-color-on-surface-variant);
    font: var(--md-sys-typescale-body-medium);
  }
  .empty b { color: var(--md-sys-color-on-surface); font-weight: 600; }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { transition: none !important; animation: none !important; }
  }
`;

var PANEL = `
<div class="host">
  <div class="panel">
    <header class="bar">
      <span class="brand" aria-hidden="true">K12</span>
      <span class="title">K12Online Hack - bài kiểm tra</span>
      <button class="icon-btn" type="button" data-act="min" title="Thu nhỏ" aria-label="Thu nhỏ">&#8211;</button>
      <button class="icon-btn" type="button" data-act="close" title="Đóng" aria-label="Đóng">&#215;</button>
    </header>
    <div class="actions">
      <button class="btn tonal" type="button" data-act="scan" title="Scan lại trang này">&#8635; Scan lại</button>
      <div class="menu-wrap">
        <button class="icon-btn" type="button" data-act="menu" title="Tùy chọn" aria-label="Tùy chọn" aria-haspopup="true" aria-expanded="false">&#8943;</button>
        <div class="menu" hidden>
          <button class="menu-item" type="button" data-act="compact" role="menuitemcheckbox" aria-checked="false">Thu gọn <span class="switch" aria-hidden="true"></span></button>
          <div class="menu-sep"></div>
          <div class="menu-block">
            <span class="menu-label">Giao diện</span>
            <div class="wheel" role="slider" tabindex="0" aria-label="Giao diện" aria-valuemin="0" aria-valuemax="360" aria-valuenow="265">
              <span class="wheel-thumb"></span>
            </div>
            <button class="theme-btn" type="button" data-act="theme" title="Chuyển chế độ sáng/tối" aria-label="Chuyển chế độ sáng/tối">
              <svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-12.37l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0zM7.05 18.36l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0z"/></svg>
              <svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="body" role="region" aria-label="Exam answers"></div>
  </div>
</div>
`;

var SCRIPT = `
var SCHEME = __SCHEME__;
var PREFS = window.__PREFS__ || {};
var hue = typeof PREFS.hue === 'number' ? PREFS.hue : 265;
var theme = PREFS.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
// Small screens default to the compact answer key; the menu can flip it.
var compact = PREFS.compact === true;
var last = null;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function themeCss() {
  var out = '';
  for (var mode in SCHEME) {
    var decl = '';
    for (var role in SCHEME[mode]) {
      var v = SCHEME[mode][role];
      decl += '--md-sys-color-' + role + ': oklch(' + v[0] + ' ' + v[1] + ' ' + ((hue + v[2]) % 360) + ');';
    }
    out += 'html[data-theme="' + mode + '"]{color-scheme:' + mode + ';' + decl + '}';
  }
  return out;
}

function paint() {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('theme').textContent = themeCss();
  var wheel = document.querySelector('.wheel');
  wheel.style.setProperty('--hue', hue);
  wheel.setAttribute('aria-valuenow', String(hue));
}

function send() {
  try { prompt('k12|' + Array.prototype.slice.call(arguments).join('|')); } catch (e) {}
}

function questionHtml(q, i) {
  var num = q.index || '';
  var opts = '';

  if (compact) {
    var ans = '';

    if (q.kind === 'choice') {
      ans = q.options.filter(function (o) { return o.marked; })
        .map(function (o) { return o.label; }).join(', ');
    } else if (q.kind === 'truefalse') {
      ans = q.statements.map(function (s) {
        return s.truth === true ? 'Đ' : s.truth === false ? 'S' : '?';
      }).join(' ');
    } else if (q.kind === 'short') {
      ans = q.parts.map(function (p) { return p.value; }).join('');
    }

    return '<div class="q compact" style="--i:' + Math.min(i || 0, 12) + '">' +
      '<span class="num">' + esc(num) + '</span>' +
      '<span class="ans">' + (ans ? esc(ans) : '&mdash;') + '</span></div>';
  }

  if (q.kind === 'choice') {
    opts = q.options.map(function (o) {
      var label = q.lettered ? o.label + '. ' + o.text : o.text;
      return '<span class="opt' + (o.marked ? ' on' : '') + '">' + esc(label) +
        (o.marked ? '<i>&#10003;</i>' : '') + '</span>';
    }).join('');
  } else if (q.kind === 'truefalse') {
    opts = q.statements.map(function (s) {
      var cls = s.truth === true ? ' on' : s.truth === false ? ' off' : '';
      var val = s.truth === true ? 'Đ' : s.truth === false ? 'S' : '?';
      return '<span class="opt' + cls + '" title="' + esc(s.text) + '">' + esc(s.label) + '. <b>' + val + '</b></span>';
    }).join('');
  } else if (q.kind === 'short') {
    opts = q.parts.map(function (p) {
      return '<span class="opt blank" title="' + esc(p.key) + '">' +
        (p.value === '' ? '&empty;' : esc(p.value)) + '</span>';
    }).join('');
  }

  return '<div class="q" style="--i:' + Math.min(i || 0, 12) + '">' +
    '<div class="q-top"><span class="num">' + esc(num) + '</span>' +
    '<span class="qtitle" title="' + esc(q.title) + '">' + esc(q.title) + '</span></div>' +
    (opts ? '<div class="opts">' + opts + '</div>' : '') +
    (q.note ? '<div class="note">' + esc(q.note) + '</div>' : '') +
    '</div>';
}

function reportHtml(report) {
  var groups = report.groups.map(function (g) {
    return '<section class="part">' +
      '<div class="part-head">' + esc(g.name) + ' <em>' + g.questions.length + '</em></div>' +
      g.questions.map(function (q, i) { return questionHtml(q, i); }).join('') +
      '</section>';
  }).join('');

  return groups || '<div class="empty"><b>Không tìm thấy dữ liệu bài kiểm tra trên trang</b></div>';
}

function renderReport(report) {
  last = report;
  document.querySelector('.body').innerHTML = reportHtml(report);
  document.querySelector('.body').scrollTop = 0;
}

var lastH = 0;
function reportSize() {
  var h = Math.ceil(document.querySelector('.panel').offsetHeight) + 24; // offset* ignores the entry animation's scale
  var menu = document.querySelector('.menu');
  if (!menu.hidden) h = Math.max(h, Math.ceil(menu.getBoundingClientRect().bottom) + 12);
  if (h !== lastH) { lastH = h; send('size', h); }
}

function closeMenu() {
  var menu = document.querySelector('.menu');
  if (menu.hidden) return;
  menu.hidden = true;
  document.querySelector('[data-act="menu"]').setAttribute('aria-expanded', 'false');
  reportSize();
}

function boot() {
  paint();
  document.querySelector('[data-act="compact"]').setAttribute('aria-checked', String(compact));

  if (window.ResizeObserver) {
    new ResizeObserver(reportSize).observe(document.querySelector('.panel'));
  }

  renderReport(window.__INITIAL__ || { groups: [] });

  var root = document.body;

  root.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) {
      if (!e.target.closest('.menu-wrap')) closeMenu();
      return;
    }

    var act = btn.getAttribute('data-act');
    if (act === 'menu') {
      var menu = root.querySelector('.menu');
      menu.hidden = !menu.hidden;
      btn.setAttribute('aria-expanded', String(!menu.hidden));
      reportSize();
      // The entry animation scales the menu down; re-measure once it ends.
      if (!menu.hidden) setTimeout(reportSize, 260);
    } else if (act === 'compact') {
      compact = !compact;
      btn.setAttribute('aria-checked', String(compact));
      if (last) renderReport(last);
    } else if (act === 'scan') {
      closeMenu();
      if (last) renderReport(last);
    } else if (act === 'theme') {
      theme = theme === 'light' ? 'dark' : 'light';
      paint();
      send('theme', theme);
    } else if (act === 'min') {
      root.querySelector('.panel').classList.toggle('min');
    } else if (act === 'close') {
      closeMenu();
      send('close');
    }
  });

  var wheel = root.querySelector('.wheel');
  var spinning = false;

  function pick(e) {
    var rect = wheel.getBoundingClientRect();
    var x = e.clientX - (rect.left + rect.width / 2);
    var y = e.clientY - (rect.top + rect.height / 2);
    var next = Math.round((Math.atan2(y, x) * 180 / Math.PI + 90 + 360) % 360);
    if (next === hue) return;
    hue = next;
    paint();
  }

  wheel.addEventListener('pointerdown', function (e) {
    spinning = true;
    wheel.setPointerCapture(e.pointerId);
    pick(e);
    e.preventDefault();
  });
  wheel.addEventListener('pointermove', function (e) { if (spinning) pick(e); });
  wheel.addEventListener('pointerup', function () { spinning = false; send('hue', hue); });
  wheel.addEventListener('pointercancel', function () { spinning = false; send('hue', hue); });

  send('ready');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
`;

function pageHtml(opts) {
    opts = opts || {};
    var json = opts.report ? JSON.stringify(opts.report).replace(/</g, '\\u003c') : 'null';
    var prefs = {};
    if (opts.theme) prefs.theme = opts.theme;
    if (typeof opts.hue === 'number') prefs.hue = opts.hue;
    if (opts.compact) prefs.compact = true;

    return '<!doctype html><html><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">' +
        '<style>' + TOKENS + CSS + '</style>' +
        '<style id="theme"></style>' +
        '<style>:root{--body-max:' + (opts.bodyMax || 480) + 'px}</style>' +
        '</head><body>' + PANEL +
        '<script>window.__INITIAL__=' + json + ';window.__PREFS__=' + JSON.stringify(prefs) + ';' +
        SCRIPT.replace('__SCHEME__', JSON.stringify(SCHEME)) + '</script>' +
        '</body></html>';
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { pageHtml: pageHtml };
}
