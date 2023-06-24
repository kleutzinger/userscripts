// ==UserScript==
// @name        Github Issues: Auto Assign Self
// @namespace   https://github.com/kleutzinger/userscripts
// @match       https://github.com/*/*/issues/new
// @downloadURL https://github.com/kleutzinger/userscripts/raw/main/userscripts/github-issues-auto-assign-self.user.js
// @updateURL   https://github.com/kleutzinger/userscripts/raw/main/userscripts/github-issues-auto-assign-self.user.js
// @grant       none
// @version     0.1
// @author      github.com/kleutzinger/
// @description Auto assign self when creating new issues on Github where possible.
// @icon https://github.com/favicon.ico
// ==/UserScript==

(function () {
  let findElementAttempts = 0;
  const assignSelfSelector = ".js-issue-assign-self";
  var existCondition = setInterval(function () {
    if (document.querySelectorAll(assignSelfSelector).length) {
      findElementAttempts += 1;
      clearInterval(existCondition);
      document.querySelector(assignSelfSelector).click();
      if (findElementAttempts >= 10) {
        clearInterval(existCondition);
      }
    }
  }, 200);
})();
