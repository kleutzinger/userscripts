// ==UserScript==
// @name        gg.deals Highlight Owned Games
// @namespace   https://github.com/kleutzinger/userscripts
// @match       https://gg.deals/**
// @downloadURL https://github.com/kleutzinger/userscripts/raw/main/userscripts/gg-deals-highlight-owned-games.user.js
// @updateURL   https://github.com/kleutzinger/userscripts/raw/main/userscripts/gg-deals-highlight-owned-games.user.js
// @grant       none
// @version     0.1
// @author      github.com/kleutzinger/
// @description Highlights games you already have in your collection on https://gg.deals
// @icon https://gg.deals/favicon.ico
// ==/UserScript==

for (const e of new Set([
  ...document.querySelectorAll(".game-info-wrapper"),
  ...document.querySelectorAll(".game-box-options"),
])) {
  const owned_span = e.querySelector("li.owned-game > span");
  const game_is_owned = window.getComputedStyle(owned_span).display !== "none";
  if (game_is_owned) {
    e.style.backgroundColor = "darkblue";
  }
}
