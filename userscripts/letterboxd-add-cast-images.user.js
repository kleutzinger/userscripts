// ==UserScript==
// @name         Letterboxd Add Cast Images
// @namespace    http://tampermonkey.net/
// @version      1.1
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

  function getAge(start, until = new Date()) {
    var birthDate = new Date(start);
    var age = until.getFullYear() - birthDate.getFullYear();
    var m = until.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && until.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

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
      if (castMap[name]?.imgLink) {
        img.src = castMap[name].imgLink;
      } else {
        const empty1x1png =
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQI12NgYAAAAAMAASDVlMcAAAAASUVORK5CYII=";
        img.src = "data:image/png;base64," + empty1x1png;
      }
      const { release_age } = castMap[name] || {};
      const age_span = document.createElement("span");
      age_span.textContent += release_age ? ` (${release_age})` : "";
      el.appendChild(age_span);
      el.appendChild(img);
    });
  }

  // Main function
  function enhanceCastImages() {
    const tmdbId = getTMDBLink();
    if (!tmdbId) return;

    // Fetch cast info from TMDB
    fetchData(`https://movies.kevbot.xyz/movie/${tmdbId}`, (tmdbData) => {
      const movie_release_date = new Date(tmdbData.movie.release_date);
      const tmdbCastMap = {};
      tmdbData.cast.forEach((person) => {
        const personInfo = { name: person.name };
        if (person.profile_path !== null) {
          const imgLink = `https://image.tmdb.org/t/p/w185${person.profile_path}`;
          personInfo.imgLink = imgLink;
        }
        if (person.birthday !== null && movie_release_date !== null) {
          personInfo.release_age = getAge(person.birthday, movie_release_date);
        }
        tmdbCastMap[person.name] = personInfo;
        console.log(personInfo);
      });

      addImageEl(tmdbCastMap);
    });
  }

  // Run the script
  enhanceCastImages();
})();
