// ==UserScript==
// @name        gg.deals Steam Store Buttons
// @namespace   https://github.com/kleutzinger/userscripts
// @match       https://gg.deals/**
// @downloadURL https://github.com/kleutzinger/userscripts/raw/main/userscripts/gg-deals-steam-buttons.user.js
// @updateURL   https://github.com/kleutzinger/userscripts/raw/main/userscripts/gg-deals-steam-buttons.user.js
// @grant       none
// @version     1.2
// @author      github.com/kleutzinger/
// @description Adds a small "Steam" button directly on each game's thumbnail in gg.deals listings (bundle pages, search results, wishlists, etc.) that jumps straight to the Steam store page, without needing to open the gg.deals game page first.
// @icon https://gg.deals/favicon.ico
// ==/UserScript==

(function () {
  "use strict";

  const CACHE_KEY = "gg-deals-steam-buttons:cache:v2";
  const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  const MAX_CONCURRENT_FETCHES = 3;
  const STEAM_APP_RE = /store\.steampowered\.com\/(?:app|agecheck\/app)\/(\d+)/;

  const cache = loadCache();
  const seen = new WeakSet();
  const queue = [];
  let activeFetches = 0;

  function loadCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
      // storage full or unavailable; skip persisting
    }
  }

  function getCached(slug) {
    const entry = cache[slug];
    if (!entry || Date.now() - entry.t > CACHE_TTL_MS) return undefined;
    return entry.url; // null means "checked, no Steam link found"
  }

  function setCached(slug, url) {
    cache[slug] = { url, t: Date.now() };
    saveCache();
  }

  function slugFromHref(href) {
    const m = href.match(/\/game\/([^/]+)\/?/);
    return m ? m[1] : null;
  }

  async function fetchSteamUrl(gameHref) {
    const res = await fetch(gameHref, { credentials: "same-origin" });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(STEAM_APP_RE);
    return m ? `https://store.steampowered.com/app/${m[1]}/` : null;
  }

  function addButton(anchorEl, steamUrl) {
    if (anchorEl.querySelector(".gg-steam-btn")) return;
    if (getComputedStyle(anchorEl).position === "static") {
      anchorEl.style.position = "relative";
    }
    const btn = document.createElement("span");
    btn.className = "gg-steam-btn";
    btn.title = "Open on Steam";
    btn.textContent = "Steam";
    btn.dataset.steamUrl = steamUrl;
    Object.assign(btn.style, {
      position: "absolute",
      right: "2px",
      bottom: "2px",
      zIndex: "2147483647",
      background: "rgba(23,26,33,.85)",
      color: "#66c0f4",
      font: "700 10px/1.6 Arial, sans-serif",
      padding: "1px 5px",
      borderRadius: "3px",
      border: "1px solid #66c0f4",
      cursor: "pointer",
    });
    anchorEl.appendChild(btn);
  }

  // gg.deals overlays each whole card with a transparent full-card <a
  // class="full-link"> that isn't an ancestor of our button, so it wins the
  // browser's native click hit-test regardless of our button's own z-index.
  // Intercept by geometry in the capture phase instead of relying on
  // DOM/stacking order.
  document.addEventListener(
    "click",
    (e) => {
      const stack = document.elementsFromPoint(e.clientX, e.clientY);
      const btn = stack.find((el) => el.classList?.contains("gg-steam-btn"));
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      window.open(btn.dataset.steamUrl, "_blank", "noopener");
    },
    true
  );

  function pump() {
    while (activeFetches < MAX_CONCURRENT_FETCHES && queue.length) {
      const job = queue.shift();
      activeFetches++;
      fetchSteamUrl(job.href)
        .then((url) => {
          setCached(job.slug, url);
          if (url) addButton(job.anchorEl, url);
        })
        .catch(() => {
          // network error; leave uncached so it's retried on a later visit
        })
        .finally(() => {
          activeFetches--;
          pump();
        });
    }
  }

  function processAnchor(anchorEl) {
    const href = anchorEl.getAttribute("href");
    const slug = href && slugFromHref(href);
    if (!slug) return;

    const cached = getCached(slug);
    if (cached !== undefined) {
      if (cached) addButton(anchorEl, cached);
      return;
    }
    queue.push({ anchorEl, slug, href });
    pump();
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          io.unobserve(entry.target);
          processAnchor(entry.target);
        }
      }
    },
    { rootMargin: "200px" }
  );

  function scan() {
    document.querySelectorAll('a.main-image[href*="/game/"]').forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);
      io.observe(el);
    });
  }

  scan();
  new MutationObserver(scan).observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
