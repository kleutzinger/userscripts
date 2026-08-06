// ==UserScript==
// @name        gg.deals Highlight Owned Games
// @namespace   https://github.com/kleutzinger/userscripts
// @match       https://gg.deals/**
// @downloadURL https://github.com/kleutzinger/userscripts/raw/main/userscripts/gg-deals-highlight-owned-games.user.js
// @updateURL   https://github.com/kleutzinger/userscripts/raw/main/userscripts/gg-deals-highlight-owned-games.user.js
// @grant       none
// @version     1.0
// @author      github.com/kleutzinger/
// @description In lists of games on https://gg.deals, this highlights games you already have in your collection. To use, make an account on gg.deals and import your collection here https://gg.deals/collection/
// @icon https://gg.deals/favicon.ico
// ==/UserScript==

(function () {
  // WCAG relative luminance / contrast helpers, used to pick readable text color
  function relativeLuminance(hex) {
    const c = hex.replace("#", "");
    const [r, g, b] = [0, 2, 4].map(
      (i) => parseInt(c.substring(i, i + 2), 16) / 255
    );
    const linearize = (v) =>
      v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    return (
      0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
    );
  }
  function contrastRatio(l1, l2) {
    const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
    return (lighter + 0.05) / (darker + 0.05);
  }
  function readableTextColor(bgHex) {
    const bgLuminance = relativeLuminance(bgHex);
    const whiteContrast = contrastRatio(bgLuminance, 1);
    const blackContrast = contrastRatio(bgLuminance, 0);
    return whiteContrast >= blackContrast ? "#ffffff" : "#000000";
  }
  function applyHighlight(el, bgColor) {
    el.style.backgroundColor = bgColor;
    el.style.color = readableTextColor(bgColor);
    el.style.borderRadius = "4px";
  }

  function apply() {
    const WISHLIST_COLOR = "#036180";
    const OWNED_COLOR = "#008141";
    const RATING_COLORS = [
      { match: "Overwhelmingly Positive", color: "#00E676" },
      { match: "Very Positive", color: "#00B240" },
      { match: "Mostly Positive", color: "#116B36" },
    ];
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
          applyHighlight(wrapper, color);
          return;
        }

        // Check for child elements with the selector
        const span = wrapper.querySelector(selector);
        if (span) {
          const is_displayed = window.getComputedStyle(span).display !== "none";
          if (is_displayed) {
            applyHighlight(wrapper, color);
            // DEBUG
            // console.log(`applying ${color} to`);
            // console.log(e);
          }
        }
      });

      // color positive reviews & bump rating text size
      const rating_label = wrapper.querySelector("span.reviews-label");
      const rating = rating_label?.innerText.split("(")[0];
      if (!!rating_label) {
        rating_label.style.fontSize = "1.15em";
        const rating_color = RATING_COLORS.find(({ match }) =>
          rating.includes(match)
        );
        if (rating_color) {
          applyHighlight(rating_label, rating_color.color);
        }
      }
    }
  }
  // rerun on click. to handle changing pages
  document.body.addEventListener("click", apply, true);
  apply();
})();
