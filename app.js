/* ============================================================
   Rosbooking — интерактив: палитра, карусели, избранное, табы
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- Цветовые утилиты ---------------- */
  const clamp = (v) => Math.min(255, Math.max(0, Math.round(v)));

  function hexToRgb(hex) {
    let h = String(hex || '').trim().replace(/^#/, '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  const rgbToHex = ({ r, g, b }) =>
    '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('');

  function luminance({ r, g, b }) {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }

  function contrast(c1, c2) {
    const a = luminance(c1), b = luminance(c2);
    const hi = Math.max(a, b), lo = Math.min(a, b);
    return (hi + 0.05) / (lo + 0.05);
  }

  function darken(rgb, amount) {
    return {
      r: rgb.r * (1 - amount),
      g: rgb.g * (1 - amount),
      b: rgb.b * (1 - amount),
    };
  }

  /* ---------------- Палитра ---------------- */
  const PRESETS = [
    { name: 'Красный', hex: '#C32023' },
    { name: 'Синий', hex: '#1A5AA8' },
    { name: 'Графит', hex: '#111418' },
    { name: 'Изумруд', hex: '#0F7B5A' },
    { name: 'Океан', hex: '#0E7490' },
    { name: 'Слива', hex: '#6D3BBF' },
    { name: 'Янтарь', hex: '#B86E00' },
    { name: 'Роза', hex: '#C2337A' },
  ];
  const DEFAULT_ACCENT = PRESETS[0].hex;
  const STORAGE_KEY = 'rosbooking.accent';

  const root = document.documentElement;
  const presetsBox = document.getElementById('palettePresets');
  const customColor = document.getElementById('customColor');
  const customHex = document.getElementById('customHex');
  const panel = document.getElementById('palettePanel');
  const fab = document.getElementById('paletteFab');

  let current = DEFAULT_ACCENT;

  function applyAccent(hex, opts) {
    const rgb = hexToRgb(hex);
    if (!rgb) return false;
    const options = opts || {};
    current = rgbToHex(rgb);

    const strong = darken(rgb, 0.12);
    const white = { r: 255, g: 255, b: 255 };
    const dark = { r: 17, g: 20, b: 24 };
    const onAccent = contrast(rgb, white) >= contrast(rgb, dark) ? '#ffffff' : '#111418';
    const soft = `rgba(${clamp(rgb.r)}, ${clamp(rgb.g)}, ${clamp(rgb.b)}, 0.09)`;

    // Цвет акцентного текста на белом фоне: затемняем слишком светлые оттенки
    let ink = rgb;
    let step = 0;
    while (contrast(ink, white) < 4.2 && step < 9) {
      ink = darken(rgb, 0.08 * (step + 1));
      step += 1;
    }

    root.style.setProperty('--accent', current);
    root.style.setProperty('--accent-strong', rgbToHex(strong));
    root.style.setProperty('--accent-soft', soft);
    root.style.setProperty('--on-accent', onAccent);
    root.style.setProperty('--accent-ink', rgbToHex(ink));

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', current);

    customColor.value = current;
    customHex.value = current.toUpperCase();

    [...presetsBox.children].forEach((btn) => {
      const isActive = btn.dataset.hex.toLowerCase() === current.toLowerCase();
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });

    if (!options.silent) {
      try { localStorage.setItem(STORAGE_KEY, current); } catch (e) { /* ignore */ }
      const url = new URL(window.location.href);
      if (current.toLowerCase() === DEFAULT_ACCENT.toLowerCase()) {
        url.searchParams.delete('accent');
      } else {
        url.searchParams.set('accent', current.replace('#', ''));
      }
      window.history.replaceState(null, '', url);
    }
    return true;
  }

  function buildPresets() {
    PRESETS.forEach((preset) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.dataset.hex = preset.hex;
      btn.setAttribute('aria-pressed', 'false');
      btn.innerHTML =
        '<span class="swatch__dot" style="background:' + preset.hex + '">' +
          '<svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>' +
        '</span>' +
        '<span>' + preset.name + '</span>';
      btn.addEventListener('click', () => applyAccent(preset.hex));
      presetsBox.appendChild(btn);
    });
  }

  function initPalette() {
    if (!presetsBox) return;
    buildPresets();

    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);

    let initial = DEFAULT_ACCENT;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('accent');
    if (fromUrl && hexToRgb(fromUrl)) {
      initial = '#' + fromUrl.replace(/^#/, '');
    } else {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && hexToRgb(saved)) initial = saved;
      } catch (e) { /* ignore */ }
    }
    applyAccent(initial, { silent: true });

    customColor.addEventListener('input', (e) => applyAccent(e.target.value));
    customHex.addEventListener('change', (e) => {
      if (!applyAccent(e.target.value)) {
        customHex.value = current.toUpperCase();
      }
    });
    customHex.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
    });

    document.getElementById('paletteReset').addEventListener('click', () => applyAccent(DEFAULT_ACCENT));

    const open = () => {
      panel.hidden = false;
      fab.setAttribute('aria-expanded', 'true');
    };
    const close = () => {
      panel.hidden = true;
      fab.setAttribute('aria-expanded', 'false');
    };
    fab.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.hidden ? open() : close();
    });
    document.getElementById('paletteClose').addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !panel.hidden) { close(); fab.focus(); }
    });
    document.addEventListener('click', (e) => {
      if (panel.hidden) return;
      if (!panel.contains(e.target) && !fab.contains(e.target)) close();
    });
  }

  /* ---------------- Карусели ---------------- */
  function initCarousels() {
    document.querySelectorAll('[data-carousel]').forEach((rootEl) => {
      const track = rootEl.querySelector('[data-track]');
      const prev = rootEl.querySelector('[data-prev]');
      const next = rootEl.querySelector('[data-next]');
      if (!track || !prev || !next) return;

      const step = () => Math.max(240, Math.round(track.clientWidth * 0.86));

      const update = () => {
        const max = track.scrollWidth - track.clientWidth - 1;
        prev.disabled = track.scrollLeft <= 1;
        next.disabled = track.scrollLeft >= max;
      };

      prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
      next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
      track.addEventListener('scroll', () => window.requestAnimationFrame(update), { passive: true });
      window.addEventListener('resize', update);
      update();
    });
  }

  /* ---------------- Избранное ---------------- */
  function initHearts() {
    document.querySelectorAll('.heart').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const pressed = btn.getAttribute('aria-pressed') === 'true';
        btn.setAttribute('aria-pressed', String(!pressed));
      });
    });
  }

  /* ---------------- Категории ---------------- */
  function initChips() {
    document.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.chip').forEach((c) => {
          c.classList.remove('is-active');
          c.setAttribute('aria-selected', 'false');
        });
        chip.classList.add('is-active');
        chip.setAttribute('aria-selected', 'true');
      });
    });
  }

  /* ---------------- Табы идей ---------------- */
  function initTabs() {
    const tabs = [...document.querySelectorAll('.tab')];
    const panels = [...document.querySelectorAll('.ideas__grid')];
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => {
          t.classList.remove('is-active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('is-active');
        tab.setAttribute('aria-selected', 'true');
        panels.forEach((panelEl) => {
          const on = panelEl.dataset.panel === tab.dataset.tab;
          panelEl.hidden = !on;
          panelEl.classList.toggle('is-active', on);
        });
      });
    });
  }

  /* ---------------- Старт ---------------- */
  function boot() {
    initPalette();
    initCarousels();
    initHearts();
    initChips();
    initTabs();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
