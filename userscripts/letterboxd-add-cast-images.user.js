// ==UserScript==
// @name         Letterboxd Add Cast Images
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Add cast images to Letterboxd movie pages from TMDB.
// @downloadURL https://github.com/kleutzinger/userscripts/raw/main/userscripts/letterboxd-add-cast-images.user.js
// @updateURL   https://github.com/kleutzinger/userscripts/raw/main/userscripts/letterboxd-add-cast-images.user.js
// @author       github.com/kleutzinger
// @match        https://letterboxd.com/film/*
// @grant        GM_xmlhttpRequest
// @connect      movies.kevbot.xyz
// @connect      image.tmdb.org
// ==/UserScript==

(function () {
  "use strict";

  // Fetch TMDB ID from the Letterboxd page
  function getTMDBLink() {
    const link = document.querySelector('a[href*="themoviedb.org/movie/"]');
    return link ? link.href.match(/movie\/(\d+)/)?.[1] : null;
  }

  // Fetch data from a given URL
  function fetchData(url, callback) {
    GM_xmlhttpRequest({
      method: "GET",
      url: url,
      onload: function (response) {
        callback(JSON.parse(response.responseText));
      },
    });
  }

  // Add images next to cast members on the Letterboxd page
  function addImageEl(castMap) {
    const castElements = document.querySelectorAll(".cast-list .text-slug");
    castElements.forEach((el) => {
      const name = el.textContent.trim();
      // text align center
      el.style.textAlign = "center";
      // check not null

      const img = document.createElement("img");
      img.alt = name;
      img.style.width = "92.5px";
      img.style.height = "139px";
      img.style.marginLeft = "10px";
      if (castMap[name]) {
        img.src = castMap[name];
      } else {
        const empty1x1png =
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQI12NgYAAAAAMAASDVlMcAAAAASUVORK5CYII=";
        img.src = "data:image/png;base64," + empty1x1png;
      }
      el.appendChild(img);
    });
  }

  // Main function
  function enhanceCastImages() {
    const tmdbId = getTMDBLink();
    if (!tmdbId) return;

    // Fetch cast info from TMDB
    fetchData(`https://movies.kevbot.xyz/movie/${tmdbId}`, (tmdbData) => {
      const tmdbCastMap = {};
      tmdbData.cast.forEach((person) => {
        if (person.profile_path !== null) {
          const imgLink = `https://image.tmdb.org/t/p/w185${person.profile_path}`;
          tmdbCastMap[person.name] = imgLink;
        }
      });

      addImageEl(tmdbCastMap);
    });
  }

  // Run the script
  enhanceCastImages();
})();
