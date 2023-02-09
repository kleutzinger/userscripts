// ==UserScript==
// @name        New York Times crossword helper
// @description Adds the length of words into the clue section
// @namespace   https://github.com/kleutzinger/userscripts
// @match       https://www.nytimes.com/crosswords/game/mini
// @match       https://www.nytimes.com/crosswords/game/mini/*
// @match       https://www.nytimes.com/crosswords/game/daily
// @match       https://www.nytimes.com/crosswords/game/daily/*
// @downloadURL https://github.com/kleutzinger/userscripts/raw/main/userscripts/nyt-crossword-helper.user.js
// @updateURL   https://github.com/kleutzinger/userscripts/raw/main/userscripts/nyt-crossword-helper.user.js
// @grant       none
// @version     1.0
// @author      github.com/kleutzinger/
// ==/UserScript==

(() => {
  function is_black(cel) {
    return cel.firstChild.classList.contains("xwd__cell--block");
  }

  function get_num(cel) {
    let el = cel.querySelector("text[text-anchor=start]");
    if (el) {
      return parseInt(el.textContent);
    }
    return -1;
  }

  function get_grid() {
    let lasty = -1;
    let gridy = -1;
    let gridx = -1;
    let grid = [];
    for (const cel of [...document.querySelectorAll("g.xwd__cell")].slice()) {
      let cury = cel.firstChild.getAttribute("y");
      if (lasty != cury) {
        grid.push([]);
        gridx = 0;
        gridy += 1;
      } else {
        gridx += 1;
      }
      lasty = cury;
      let cellobj = {
        x: gridx,
        y: gridy,
        is_black: is_black(cel),
        num: get_num(cel),
      };
      grid[gridy].push(cellobj);
    }
    console.table(grid);
    return grid;
  }

  function get_ans_len(grid) {
    let ans_len = {};

    function marchx(row, startidx) {
      // march to the right until black cell reached or offgrid
      // return the distance
      let dist = 0;
      for (let i = startidx; i < row.length; i++) {
        // exit cond
        dist += 1;
        if (row[i].is_black) {
          dist -= 1;
          break;
        }
      }
      return dist;
    }

    for (const [yval, row] of grid.entries()) {
      for (let i = 0; i < row.length; i++) {
        // check for num
        let curnum = row[i].num;
        if (curnum != -1) {
          ans_len[curnum + "a"] = marchx(row, i);
          let column = grid.map(function (value) {
            return value[i];
          });

          ans_len[curnum + "d"] = marchx(column, yval);
        }
      }
    }

    return ans_len;
  }

  function add_len_to_clue(clue, is_down, ans_len) {
    let num = parseInt(clue.firstChild.textContent);
    let len = ans_len[num + (is_down ? "d" : "a")];
    let span = clue.querySelector("span.kevspan");
    if (!span) {
      span = clue.appendChild(document.createElement("span"));
      span.className = "kevspan";
    }
    span.textContent = `(${len})`;
  }

  function execute() {
    // run everything and insert lengths of answers into the clue section
    let grid = get_grid();
    let ans_len = get_ans_len(grid);

    let [across_clues, down_clues] = document.querySelectorAll(
      "ol.xwd__clue-list--list"
    );

    for (const clue of [...across_clues.querySelectorAll("li")]) {
      add_len_to_clue(clue, false, ans_len);
    }

    for (const clue of [...down_clues.querySelectorAll("li")]) {
      add_len_to_clue(clue, true, ans_len);
    }
  }
  setTimeout(execute, 3000);
})();
