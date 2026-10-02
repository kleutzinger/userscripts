// ==UserScript==
// @name        OnHockey.TV NHL Auto-Expand + Sharks Highlight
// @namespace   https://github.com/kleutzinger/userscripts
// @match       https://onhockey.tv/*
// @match       http://onhockey.tv/*
// @downloadURL https://github.com/kleutzinger/userscripts/raw/main/userscripts/onhockey-nhl-auto-expand.user.js
// @updateURL   https://github.com/kleutzinger/userscripts/raw/main/userscripts/onhockey-nhl-auto-expand.user.js
// @grant       none
// @version     1.0
// @author      github.com/kleutzinger/
// @description Auto-expands every game under the NHL section on onhockey.tv, bolds/highlights San Jose Sharks games, and auto-opens the first English-language stream for a Sharks game once its links load.
// ==/UserScript==

(function () {
  "use strict";

  const SHARKS_RE = /san jose/i;
  const ENGLISH_GROUP_PRIORITY = ["english", "home feed", "away feed"];
  const LABEL_RE = /^([a-z ]+):$/i;

  // Games we've already auto-opened a stream for, keyed by team matchup text.
  // Lives for the page session so a table re-render doesn't reopen the stream.
  const openedGames = new Set();

  function getLeagueName(tbody) {
    const b = tbody.querySelector(":scope > tr:first-child b");
    return b ? b.textContent.trim() : "";
  }

  function isExpanded(linksDiv) {
    return (
      !linksDiv.classList.contains("sf-hidden") &&
      linksDiv.style.display !== "none"
    );
  }

  function expandRow(tr, linksDiv) {
    if (isExpanded(linksDiv)) return;
    const clickTarget = linksDiv.closest("td") || tr;
    clickTarget.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
    );
  }

  function highlightSharksRow(tr) {
    if (tr.dataset.sharksHighlighted) return;
    tr.dataset.sharksHighlighted = "1";
    tr.style.backgroundColor = "#006d75"; // Sharks teal
    tr.style.outline = "2px solid #000";
    tr.querySelectorAll("td, text").forEach((el) => {
      el.style.color = "#fff";
      el.style.fontWeight = "bold";
    });
  }

  // Groups the <a> stream links inside an expanded .gamelinks div by the
  // language/feed label (e.g. "english", "home feed") that precedes them.
  function groupLinksByLabel(linksDiv) {
    const groups = {};
    let current = null;
    linksDiv.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const m = node.textContent.trim().match(LABEL_RE);
        if (m) current = m[1].toLowerCase();
      } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "A") {
        if (current) (groups[current] = groups[current] || []).push(node);
      }
    });
    return groups;
  }

  function pickFirstEnglishLink(linksDiv) {
    const groups = groupLinksByLabel(linksDiv);
    for (const label of ENGLISH_GROUP_PRIORITY) {
      if (groups[label] && groups[label].length) return groups[label][0];
    }
    return null;
  }

  function openSharksStream(linksDiv, gameKey) {
    if (openedGames.has(gameKey)) return;
    const link = pickFirstEnglishLink(linksDiv);
    if (!link) return;
    openedGames.add(gameKey);
    link.click();
  }

  function watchAndOpenSharksStream(linksDiv, gameKey) {
    if (linksDiv.querySelector("a")) {
      openSharksStream(linksDiv, gameKey);
      return;
    }
    const observer = new MutationObserver(() => {
      if (linksDiv.querySelector("a")) {
        observer.disconnect();
        openSharksStream(linksDiv, gameKey);
      }
    });
    observer.observe(linksDiv, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 8000);
  }

  function processRow(tr) {
    const linksDiv = tr.querySelector(".gamelinks");
    if (!linksDiv) return;

    const isSharks = SHARKS_RE.test(tr.textContent);
    if (isSharks) highlightSharksRow(tr);

    expandRow(tr, linksDiv);

    if (isSharks && !openedGames.has(tr.textContent.slice(0, 80))) {
      const gameKey = tr.textContent.slice(0, 80);
      watchAndOpenSharksStream(linksDiv, gameKey);
    }
  }

  function processNHL() {
    document.querySelectorAll("#gametable tbody").forEach((tbody) => {
      if (getLeagueName(tbody) !== "NHL") return;
      tbody.querySelectorAll("tr.game").forEach(processRow);
    });
  }

  function init() {
    processNHL();
    const table = document.querySelector("#gametable");
    if (!table) {
      setTimeout(init, 1000);
      return;
    }
    let pending = null;
    new MutationObserver(() => {
      clearTimeout(pending);
      pending = setTimeout(processNHL, 200);
    }).observe(table, { childList: true, subtree: true });
  }

  init();
})();
