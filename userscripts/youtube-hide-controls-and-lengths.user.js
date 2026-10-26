// ==UserScript==
// @name        YouTube Hide Controls and Video Lengths
// @namespace   https://github.com/kleutzinger/userscripts
// @match       https://www.youtube.com/*
// @match       https://m.youtube.com/*
// @match       https://music.youtube.com/*
// @downloadURL https://github.com/kleutzinger/userscripts/raw/main/userscripts/youtube-hide-controls-and-lengths.user.js
// @updateURL   https://github.com/kleutzinger/userscripts/raw/main/userscripts/youtube-hide-controls-and-lengths.user.js
// @run-at      document-start
// @grant       none
// @version     1.0
// @author      github.com/kleutzinger/
// @description Hides the YouTube player controls and all video lengths (thumbnail badges, time display). Toggle it on/off from your userscript manager.
// @icon https://www.youtube.com/favicon.ico
// ==/UserScript==

(function () {
  const css = `
    /* player controls (top title bar + bottom control bar) */
    .ytp-chrome-top,
    .ytp-chrome-bottom { display: none !important; }

    /* video lengths: player time display */
    .ytp-time-display,
    .ytp-time-duration,
    .ytp-time-current { display: none !important; }

    /* video lengths: thumbnail duration badges (old and new layouts) */
    ytd-thumbnail-overlay-time-status-renderer,
    yt-thumbnail-overlay-badge-view-model,
    yt-thumbnail-bottom-overlay-view-model,
    badge-shape.badge-shape-wiz--thumbnail-badge,
    .badge-shape-wiz--thumbnail-default,
    .ytd-thumbnail-overlay-time-status-renderer,
    .ytp-videowall-still-info-duration,
    .ytp-ce-video-duration,
    .ytp-suggestion-set .ytp-videowall-still-info-duration,
    span.style-scope.ytd-thumbnail-overlay-time-status-renderer,
    .thumbnail-overlay-badge-shape,
    ytm-thumbnail-overlay-time-status-renderer,
    .video-thumbnail-overlay-badge-shape { display: none !important; }
  `;

  const style = document.createElement("style");
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
})();
