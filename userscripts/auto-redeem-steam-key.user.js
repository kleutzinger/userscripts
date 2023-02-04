
// ==UserScript==
// @name        Auto redeem steam key
// @namespace   https://github.com/kleutzinger/userscripts
// @match       https://store.steampowered.com/account/registerkey
// @downloadURL https://github.com/kleutzinger/userscripts/raw/main/userscripts/auto-redeem-steam-key.user.js
// @updateURL   https://github.com/kleutzinger/userscripts/raw/main/userscripts/auto-redeem-steam-key.user.js
// @grant       none
// @version     0.2
// @author      github.com/kleutzinger/
// @description autoclick through the interface when redeeming a steam key
// @icon        https://store.steampowered.com/favicon.ico
// ==/UserScript==

(function () {
  // Agree to terms of service
  let checkbox = document.querySelector("#accept_ssa");
  checkbox.checked = true;
  // click Continue buton
  let submit_button = document.querySelector("#register_btn");
  submit_button.click();
})();
