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
// @version     1.1
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

    /* small badge after the watch-page title so you know things are hidden */
    ytd-watch-metadata h1.ytd-watch-metadata::after {
      content: "time hidden";
      display: inline-block;
      margin-left: 10px;
      padding: 1px 8px;
      border-radius: 10px;
      background: rgba(128, 128, 128, 0.25);
      color: var(--yt-spec-text-secondary, #aaa);
      font-size: 11px;
      font-weight: 500;
      line-height: 18px;
      vertical-align: middle;
      white-space: nowrap;
    }
  `;

  const style = document.createElement("style");
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
})();
