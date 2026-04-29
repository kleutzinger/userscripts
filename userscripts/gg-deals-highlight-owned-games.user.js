// ==UserScript==
// @name        gg.deals Highlight Owned Games
// @namespace   https://github.com/kleutzinger/userscripts
// @match       https://gg.deals/**
// @downloadURL https://github.com/kleutzinger/userscripts/raw/main/userscripts/gg-deals-highlight-owned-games.user.js
// @updateURL   https://github.com/kleutzinger/userscripts/raw/main/userscripts/gg-deals-highlight-owned-games.user.js
// @grant       none
// @version     0.8
// @author      github.com/kleutzinger/
// @description In lists of games on https://gg.deals, this highlights games you already have in your collection. To use, make an account on gg.deals and import your collection here https://gg.deals/collection/
// @icon https://gg.deals/favicon.ico
// ==/UserScript==

(function () {
  function apply() {
    const WISHLIST_COLOR = "#036180";
    const OWNED_COLOR = "#008141";
    const GOOD_GAME_COLOR =  "#00B240";
    for (
      const wrapper of new Set([
        ...document.querySelectorAll(".game-info-wrapper"),
        ...document.querySelectorAll(".game-box-options"),
      ])
    ) {
      // color owned and wishlisted games
      const selector_colors = [
        { selector: ".owned-game .deactivate", color: OWNED_COLOR },
        { selector: ".wishlisted-game .deactivate", color: WISHLIST_COLOR },
        // Also check for container-level classes
        { selector: ".owned", color: OWNED_COLOR },
        { selector: ".wishlisted", color: WISHLIST_COLOR },
      ];
      selector_colors.forEach(({ selector, color }) => {
        // Check if wrapper itself has the class (for container-level classes)
        if (wrapper.classList.contains(selector.replace(".", ""))) {
          wrapper.style.backgroundColor = color;
          return;
        }

        // Check for child elements with the selector
        const span = wrapper.querySelector(selector);
        if (span) {
          const is_displayed = window.getComputedStyle(span).display !== "none";
          if (is_displayed) {
            wrapper.style.backgroundColor = color;
            // DEBUG
            // console.log(`applying ${color} to`);
            // console.log(e);
          }
        }
      });

      // color positive reviews
      const rating_label = wrapper.querySelector("span.reviews-label");
      const rating = rating_label?.innerText.split("(")[0];
      if (!!rating) {
        if (rating.includes("Positive")) {
          rating_label.style.backgroundColor = GOOD_GAME_COLOR;
        }
      }
    }
  }
  // rerun on click. to handle changing pages
  document.body.addEventListener("click", apply, true);
  apply();
})();
