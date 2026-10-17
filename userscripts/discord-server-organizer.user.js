// ==UserScript==
// @name        Discord Server Organizer
// @namespace   https://github.com/kleutzinger/userscripts
// @match       https://discord.com/channels/*
// @downloadURL https://github.com/kleutzinger/userscripts/raw/main/userscripts/discord-server-organizer.user.js
// @updateURL   https://github.com/kleutzinger/userscripts/raw/main/userscripts/discord-server-organizer.user.js
// @grant       none
// @version     1.0
// @author      github.com/kleutzinger/
// @description Tools for managing your Discord server list. Currently: a button that exports your current server/folder layout (names, order, grouping) as a JSON file, auto-expanding any collapsed folders to read their contents. More to come (bulk muting, reordering/regrouping).
// ==/UserScript==

(function () {
  "use strict";

  const LIST_ITEM_RE = /^guildsnav___(\d+)$/;

  function getGuildListItems() {
    return Array.from(
      document.querySelectorAll('[role="treeitem"][data-list-item-id^="guildsnav___"]')
    ).filter((el) => LIST_ITEM_RE.test(el.getAttribute("data-list-item-id")));
  }

  function getId(el) {
    return el.getAttribute("data-list-item-id").match(LIST_ITEM_RE)[1];
  }

  function getName(el) {
    const span = el.querySelector('span[class*="hiddenVisually"]');
    return span ? span.textContent.trim() : null;
  }

  function isFolder(el) {
    return el.hasAttribute("aria-expanded");
  }

  function isCollapsed(el) {
    return el.getAttribute("aria-expanded") === "false";
  }

  // Discord's auto-generated accessible label for an unnamed folder is a
  // comma list of its member server names (truncated with "..."); a named
  // folder's label is just "<name>, folder". We can tell them apart because
  // a named folder's leftover text (after stripping ", folder") won't match
  // any of its member guild names.
  function parseFolderName(label, memberNames) {
    if (!label) return null;
    const cleaned = label.replace(/,?\s*folder\s*$/i, "").trim();
    if (!cleaned) return null;
    const parts = cleaned
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && s !== "...");
    if (parts.length === 1 && !memberNames.includes(parts[0])) {
      return parts[0];
    }
    return null;
  }

  function waitFor(cond, timeout = 3000, interval = 50) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const id = setInterval(() => {
        if (cond()) {
          clearInterval(id);
          resolve();
        } else if (Date.now() - start > timeout) {
          clearInterval(id);
          reject(new Error("timed out waiting for folder toggle"));
        }
      }, interval);
    });
  }

  function click(el) {
    el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
    );
  }

  async function toggleFolder(id, expectedState) {
    const find = () => getGuildListItems().find((el) => getId(el) === id);
    let el = find();
    if (!el) throw new Error(`folder ${id} disappeared from the list`);
    click(el);
    try {
      await waitFor(() => find() && find().getAttribute("aria-expanded") === expectedState, 1000);
      return;
    } catch (e) {
      // fall through to fallback
    }
    el = find();
    if (el && el.firstElementChild) {
      click(el.firstElementChild);
      await waitFor(
        () => find() && find().getAttribute("aria-expanded") === expectedState,
        2000
      );
    } else {
      throw new Error(`could not toggle folder ${id}`);
    }
  }

  // Groups the flat, ordered treeitem list into top-level guilds and folders
  // (with their member guilds), using aria-level transitions to find each
  // folder's extent. Must be called after all folders are expanded.
  function groupItems(items) {
    const result = [];
    let i = 0;
    while (i < items.length) {
      const el = items[i];
      if (isFolder(el)) {
        const label = getName(el);
        const members = [];
        let j = i + 1;
        while (j < items.length && items[j].getAttribute("aria-level") === "2") {
          members.push({ id: getId(items[j]), name: getName(items[j]) });
          j++;
        }
        result.push({
          type: "folder",
          id: getId(el),
          name: parseFolderName(label, members.map((m) => m.name)),
          guilds: members,
        });
        i = j;
      } else {
        result.push({ type: "guild", id: getId(el), name: getName(el) });
        i++;
      }
    }
    return result;
  }

  async function buildExport() {
    const collapsedIds = getGuildListItems()
      .filter((el) => isFolder(el) && isCollapsed(el))
      .map(getId);

    for (const id of collapsedIds) {
      try {
        await toggleFolder(id, "true");
      } catch (e) {
        console.warn("[discord-server-organizer] failed to expand folder", id, e);
      }
    }

    const items = getGuildListItems();
    return { exportedAt: new Date().toISOString(), items: groupItems(items) };
  }

  function downloadJSON(data) {
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `discord-folders-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function onExportClick(btn) {
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Exporting...";
    try {
      const data = await buildExport();
      downloadJSON(data);
    } catch (e) {
      console.error("[discord-server-organizer]", e);
      alert(`Discord Folder Export failed: ${e.message}\nSee console for details.`);
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  function createButton() {
    const btn = document.createElement("button");
    btn.textContent = "Export Folders";
    btn.title = "Export your Discord server/folder layout as JSON";
    btn.style.position = "fixed";
    btn.style.left = "8px";
    btn.style.bottom = "8px";
    btn.style.zIndex = "9999";
    btn.style.font = "11px sans-serif";
    btn.style.padding = "4px 8px";
    btn.style.border = "1px solid #000";
    btn.style.borderRadius = "4px";
    btn.style.background = "#5865f2";
    btn.style.color = "#fff";
    btn.style.cursor = "pointer";
    btn.addEventListener("click", () => onExportClick(btn));
    document.body.appendChild(btn);
  }

  function init() {
    if (document.body) createButton();
    else document.addEventListener("DOMContentLoaded", createButton);
  }

  init();
})();
