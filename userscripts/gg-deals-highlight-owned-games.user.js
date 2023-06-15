// ==UserScript==
// @name        gg.deals Highlight Owned Games
// @namespace   https://github.com/kleutzinger/userscripts
// @match       https://gg.deals/**
// @downloadURL https://github.com/kleutzinger/userscripts/raw/main/userscripts/gg-deals-highlight-owned-games.user.js
// @updateURL   https://github.com/kleutzinger/userscripts/raw/main/userscripts/gg-deals-highlight-owned-games.user.js
// @grant       none
// @version     0.2
// @author      github.com/kleutzinger/
// @description In lists of games on https://gg.deals, this highlights games you already have in your collection. To use, make an account on gg.deals and import your collection here https://gg.deals/collection/
// @icon https://gg.deals/favicon.ico
// ==/UserScript==

(function () {
  function apply() {
    for (const e of new Set([
      ...document.querySelectorAll(".game-info-wrapper"),
      ...document.querySelectorAll(".game-box-options"),
    ])) {
      // color owned games blue
      const owned_span = e.querySelector("li.owned-game > span");
      const game_is_owned =
        window.getComputedStyle(owned_span).display !== "none";
      if (game_is_owned) {
        e.style.backgroundColor = "darkblue";
      }
      // color positive reviews green
      const rating_label = e.querySelector("span.reviews-label");
      const rating = rating_label?.innerText.split("(")[0];
      if (!!rating) {
        if (rating.includes("Positive"))
          rating_label.style.backgroundColor = "darkgreen";
      }
    }
  }
  // rerun on click. to handle changing pages
  document.body.addEventListener("click", apply, true);
  apply();
})();
