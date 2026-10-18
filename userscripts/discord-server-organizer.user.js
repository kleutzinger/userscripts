// ==UserScript==
// @name        Discord Server Organizer
// @namespace   https://github.com/kleutzinger/userscripts
// @match       https://discord.com/channels/*
// @downloadURL https://github.com/kleutzinger/userscripts/raw/main/userscripts/discord-server-organizer.user.js
// @updateURL   https://github.com/kleutzinger/userscripts/raw/main/userscripts/discord-server-organizer.user.js
// @grant       none
// @version     2.6
// @author      github.com/kleutzinger/
// @description Tools for managing your Discord server list. "Organize Servers" opens an in-page icon-grid editor (real server icons, folders you can open, full undo/redo) to drag/regroup/reorder servers and folders and export the edited layout. More to come (bulk muting, applying the edited layout back to Discord).
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

  // The hidden accessible label carries live status alongside the name
  // (seen: "Name, Voice call active"; Discord also prefixes "N mentions, ").
  // Only strip these exact patterns — real server names can contain commas.
  const LABEL_PREFIX_RE = /^\d+\s+mentions?,\s*/i;
  const LABEL_SUFFIX_RE = /,\s*voice call active$/i;

  function getName(el) {
    const span = el.querySelector('span[class*="hiddenVisually"]');
    if (!span) return null;
    return span.textContent.trim().replace(LABEL_PREFIX_RE, "").replace(LABEL_SUFFIX_RE, "");
  }

  // Best guess, not empirically re-verified this session: Discord renders
  // guild/folder icons as <img> elements, so grab the first one in the
  // treeitem. If Discord's markup changes this to a background-image or
  // canvas, this will just silently fall back to the letter-avatar in the
  // editor UI — re-run the DOM-inspection methodology from the export
  // feature if icons stop showing up.
  function getIconUrl(el) {
    const img = el.querySelector("img");
    return img && img.src ? img.src : null;
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
          members.push({ id: getId(items[j]), name: getName(items[j]), icon: getIconUrl(items[j]) });
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
        result.push({ type: "guild", id: getId(el), name: getName(el), icon: getIconUrl(el) });
        i++;
      }
    }
    return result;
  }

  async function expandAllFolders() {
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
  }

  async function buildExport() {
    await expandAllFolders();
    const items = getGuildListItems();
    return { exportedAt: new Date().toISOString(), items: groupItems(items) };
  }

  function downloadJSON(data, filenamePrefix) {
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filenamePrefix}-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return a.download;
  }

  // ---- editor overlay ---------------------------------------------------
  //
  // An icon-grid editor (think phone home screen) for regrouping and
  // reordering servers and folders, rendered inside a Shadow DOM (so its
  // styles can't clash with Discord's). It seeds its state from a live DOM
  // scrape (same buildExport()/groupItems() used internally) and lets you
  // export the edited layout as JSON. It does not write anything back to
  // Discord yet.
  //
  // Interaction model:
  //  - Drag a tile over the left/right edge of another tile to reorder.
  //  - Drag a server tile onto the middle of another server tile to bundle
  //    both into a new folder (auto-opened so you can name it).
  //  - Drag a server tile onto the middle of a folder tile to add it there.
  //  - Click a folder tile to open it and see/reorder/remove its contents.

  const FOLDER_GLYPH_SVG =
    '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true">' +
    '<path d="M3 5a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5z"/></svg>';

  const EDITOR_CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .backdrop {
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(0, 0, 0, 0.6);
      display: flex; align-items: center; justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px; line-height: 1.5; color: #e6e8ec;
    }
    .panel {
      width: min(760px, 92vw);
      height: min(80vh, 760px);
      background: #14161a;
      border: 1px solid #323844;
      border-radius: 6px;
      display: flex; flex-direction: column;
      overflow: hidden;
    }
    header { flex-shrink: 0; border-bottom: 1px solid #323844; padding: 14px 20px; }
    .header-row { display: flex; align-items: center; gap: 10px; }
    h1 { font-size: 15px; font-weight: 600; margin: 0; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .hint { margin: 8px 0 0; color: #8b92a1; font-size: 12.5px; }
    main { flex: 1; overflow-y: auto; overflow-x: hidden; }
    #board { padding: 16px 20px; }
    #status { flex-shrink: 0; padding: 0 20px 12px; font-size: 12.5px; color: #8b92a1; min-height: 1.3em; }
    #status.error { color: #c45b4f; }
    button, .btn {
      font: inherit; font-size: 12.5px; font-weight: 600; color: #e6e8ec;
      background: transparent; border: 1px solid #323844; border-radius: 3px;
      padding: 6px 11px; cursor: pointer; white-space: nowrap;
    }
    button:hover, .btn:hover { background: #242832; }
    button:focus-visible, .btn:focus-visible, input:focus-visible { outline: 2px solid #c98a3e; outline-offset: 1px; }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    button:disabled:hover { background: transparent; }
    .btn-accent { border-color: #c98a3e; color: #c98a3e; }
    .btn-accent:hover { background: rgba(201, 138, 62, 0.18); }
    input[type="file"] { display: none; }
    #empty { border: 1px dashed #323844; border-radius: 3px; padding: 40px 20px; text-align: center; color: #8b92a1; }

    #folder-toolbar { display: none; align-items: center; gap: 10px; padding: 10px 20px; border-bottom: 1px solid #323844; }
    #folder-toolbar .folder-name {
      flex: 1; min-width: 0; background: transparent; border: 1px solid #323844; border-radius: 3px;
      color: #e6e8ec; font: inherit; font-weight: 600; padding: 5px 8px;
    }
    #folder-toolbar .folder-name::placeholder { color: #8b92a1; font-weight: 400; font-style: italic; }
    input[type="color"] {
      width: 22px; height: 22px; padding: 0; border: 1px solid #323844; border-radius: 50%;
      background: none; cursor: pointer; flex-shrink: 0;
    }
    input[type="color"]::-webkit-color-swatch-wrapper { padding: 1px; }
    input[type="color"]::-webkit-color-swatch { border: none; border-radius: 50%; }

    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 18px 12px; min-height: 60px; }

    .tile {
      position: relative;
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      padding: 4px; border-radius: 8px; cursor: grab;
    }
    .tile:active { cursor: grabbing; }
    .tile.dragging { opacity: 0.35; }
    .tile.drop-before::before, .tile.drop-after::after {
      content: ""; position: absolute; top: 2px; bottom: 2px; width: 3px; background: #c98a3e; border-radius: 2px;
    }
    .tile.drop-before::before { left: -7px; }
    .tile.drop-after::after { right: -7px; }
    .tile.drop-into { background: rgba(201, 138, 62, 0.18); outline: 2px solid #c98a3e; }

    .avatar { flex-shrink: 0; display: block; }
    .avatar-lg { width: 56px; height: 56px; border-radius: 14px; object-fit: cover; background: #2b303b; }
    .avatar-sm { width: 100%; height: 100%; border-radius: 4px; object-fit: cover; }
    .avatar-fallback { display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; }
    .avatar-fallback.avatar-lg { font-size: 20px; }
    .avatar-fallback.avatar-sm { font-size: 9px; }

    .folder-preview {
      width: 56px; height: 56px; border-radius: 14px; background: #2a3a63;
      display: flex; align-items: center; justify-content: center; color: #7c9bff; overflow: hidden;
    }
    .folder-preview-grid {
      width: 44px; height: 44px; display: grid;
      grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 2px;
    }

    .folder-tooltip {
      position: absolute; top: calc(100% + 6px); left: 50%; transform: translateX(-50%);
      min-width: 160px; max-width: 220px; max-height: 220px; overflow-y: auto;
      background: #1c1f26; border: 1px solid #323844; border-radius: 6px;
      padding: 6px; display: none; flex-direction: column; gap: 4px;
      pointer-events: none; z-index: 20;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      text-align: left;
    }
    /* display (not opacity) so hidden tooltips don't widen the scroll area */
    .tile:hover .folder-tooltip, .tile:focus-within .folder-tooltip { display: flex; }
    .folder-tooltip-row { display: flex; align-items: center; gap: 6px; }
    .avatar-xs { width: 18px; height: 18px; border-radius: 4px; object-fit: cover; }
    .avatar-fallback.avatar-xs { font-size: 8px; }
    .folder-tooltip-name {
      font-size: 11.5px; color: #e6e8ec; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .folder-tooltip-name.unnamed { color: #8b92a1; font-style: italic; }

    .tile-label {
      font-size: 11.5px; text-align: center; max-width: 78px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #e6e8ec;
    }
    .tile-label.unnamed { color: #8b92a1; font-style: italic; }
    .folder-tile .tile-label { display: flex; }
    .tile-label-text { overflow: hidden; text-overflow: ellipsis; }
    .tile-label-count { flex-shrink: 0; margin-left: 0.25em; font-style: normal; }

    .remove-badge {
      position: absolute; top: -4px; right: 10px; width: 18px; height: 18px; border-radius: 50%;
      background: #c45b4f; color: #fff; border: none; font-size: 10px; line-height: 1; padding: 0;
      display: flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0;
    }
    .tile:hover .remove-badge, .tile:focus-within .remove-badge { opacity: 1; }
    @media (prefers-reduced-motion: no-preference) { .remove-badge { transition: opacity 0.1s; } }
  `;

  function cloneItemsForEditing(items) {
    return items.map((item) =>
      item.type === "folder"
        ? {
            type: "folder",
            id: item.id ?? null,
            name: item.name || "",
            color: item.color || null,
            guilds: (item.guilds || []).map((g) => ({ id: g.id, name: g.name, icon: g.icon || null })),
          }
        : { type: "guild", id: item.id, name: item.name, icon: item.icon || null }
    );
  }

  function serializeItemsForExport(items) {
    return items.map((item) =>
      item.type === "folder"
        ? {
            type: "folder",
            id: item.id,
            name: item.name || null,
            color: item.color || null,
            guilds: item.guilds.map((g) => ({ id: g.id, name: g.name, icon: g.icon || null })),
          }
        : { type: "guild", id: item.id, name: item.name, icon: item.icon || null }
    );
  }

  function colorForId(id) {
    let hash = 0;
    const str = String(id || "");
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    return `hsl(${hash % 360}, 45%, 38%)`;
  }

  function openEditor(initialItems) {
    let state = { items: cloneItemsForEditing(initialItems) };
    let viewFolder = null; // the folder object currently "opened", or null for the top-level grid
    let dragPayload = null; // { kind:'guild', guildRef, origin } | { kind:'folder', folderRef }

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: "open" });

    root.innerHTML = `
      <style>${EDITOR_CSS}</style>
      <div class="backdrop">
        <div class="panel">
          <header>
            <div class="header-row">
              <h1>Discord Server Organizer</h1>
              <label class="btn" id="import-label" for="file-input">Import JSON</label>
              <input id="file-input" type="file" accept="application/json" />
              <button id="new-folder-btn">+ New folder</button>
              <button id="undo-btn" title="Undo (Ctrl/Cmd+Z)" disabled>↶ Undo</button>
              <button id="redo-btn" title="Redo (Ctrl/Cmd+Shift+Z)" disabled>↷ Redo</button>
              <button id="export-btn" class="btn-accent">Export JSON</button>
              <button id="close-btn">Close</button>
            </div>
            <p class="hint" id="hint"></p>
          </header>
          <div id="folder-toolbar"></div>
          <main>
            <div id="empty" style="display:none"></div>
            <div id="board"></div>
          </main>
          <div id="status"></div>
        </div>
      </div>
    `;

    const boardEl = root.getElementById("board");
    const emptyEl = root.getElementById("empty");
    const statusEl = root.getElementById("status");
    const hintEl = root.getElementById("hint");
    const fileInput = root.getElementById("file-input");
    const importLabel = root.getElementById("import-label");
    const exportBtn = root.getElementById("export-btn");
    const newFolderBtn = root.getElementById("new-folder-btn");
    const undoBtn = root.getElementById("undo-btn");
    const redoBtn = root.getElementById("redo-btn");
    const closeBtn = root.getElementById("close-btn");
    const folderToolbarEl = root.getElementById("folder-toolbar");
    const backdrop = root.querySelector(".backdrop");

    function setStatus(msg, isError) {
      statusEl.textContent = msg || "";
      statusEl.classList.toggle("error", !!isError);
    }

    function close() {
      document.removeEventListener("keydown", onKeydown);
      host.remove();
    }

    function onKeydown(e) {
      if (e.key === "Escape") { close(); return; }
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
      else if (key === "z") { e.preventDefault(); undo(); }
      else if (key === "y") { e.preventDefault(); redo(); }
    }
    document.addEventListener("keydown", onKeydown);
    closeBtn.addEventListener("click", close);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close();
    });
    undoBtn.addEventListener("click", undo);
    redoBtn.addEventListener("click", redo);

    // ---- undo/redo ----
    //
    // Every mutation (drag/drop reorder/regroup, new/delete folder, rename,
    // color, import) is wrapped so a snapshot of `state.items` from just
    // before it lands on the undo stack. Undo/redo always drop back to the
    // top-level grid, since a restored snapshot's folder objects are fresh
    // clones and won't match whatever `viewFolder` was pointing at.

    let undoStack = [];
    let redoStack = [];
    let pendingSnapshot = null; // in-progress text-field edit, committed as one undo step on blur/change

    function updateUndoRedoButtons() {
      undoBtn.disabled = undoStack.length === 0;
      redoBtn.disabled = redoStack.length === 0;
    }

    function pushUndo(beforeSnapshot) {
      undoStack.push(beforeSnapshot);
      redoStack = [];
    }

    function withUndo(mutateFn) {
      const before = cloneItemsForEditing(state.items);
      const result = mutateFn();
      if (result === false) return;
      pushUndo(before);
      render();
    }

    function beginFieldEdit() {
      if (pendingSnapshot === null) pendingSnapshot = cloneItemsForEditing(state.items);
    }

    function commitFieldEdit() {
      if (pendingSnapshot === null) return;
      pushUndo(pendingSnapshot);
      pendingSnapshot = null;
      updateUndoRedoButtons();
    }

    function undo() {
      if (!undoStack.length) return;
      const prev = undoStack.pop();
      redoStack.push(cloneItemsForEditing(state.items));
      state = { items: cloneItemsForEditing(prev) };
      viewFolder = null;
      render();
    }

    function redo() {
      if (!redoStack.length) return;
      const next = redoStack.pop();
      undoStack.push(cloneItemsForEditing(state.items));
      state = { items: cloneItemsForEditing(next) };
      viewFolder = null;
      render();
    }

    // ---- data helpers ----

    function removeGuild(payload) {
      if (payload.origin.type === "top") {
        const idx = state.items.indexOf(payload.guildRef);
        if (idx !== -1) state.items.splice(idx, 1);
      } else {
        const guilds = payload.origin.folderRef.guilds;
        const idx = guilds.indexOf(payload.guildRef);
        if (idx !== -1) guilds.splice(idx, 1);
      }
    }

    function insertTopLevelBefore(item, beforeRef) {
      const idx = beforeRef ? state.items.indexOf(beforeRef) : -1;
      state.items.splice(idx === -1 ? state.items.length : idx, 0, item);
    }

    function insertIntoFolderBefore(folder, guildObj, beforeGuildRef) {
      const idx = beforeGuildRef ? folder.guilds.indexOf(beforeGuildRef) : -1;
      folder.guilds.splice(idx === -1 ? folder.guilds.length : idx, 0, guildObj);
    }

    function reorderTopLevel(payload, target, pos) {
      if (payload.kind === "guild") {
        if (payload.guildRef === target) return false;
        const g = payload.guildRef;
        removeGuild(payload);
        const beforeRef = pos === "before" ? target : state.items[state.items.indexOf(target) + 1] || null;
        insertTopLevelBefore({ type: "guild", id: g.id, name: g.name, icon: g.icon }, beforeRef);
      } else {
        const folder = payload.folderRef;
        if (folder === target) return false;
        const idx = state.items.indexOf(folder);
        if (idx !== -1) state.items.splice(idx, 1);
        const beforeRef = pos === "before" ? target : state.items[state.items.indexOf(target) + 1] || null;
        insertTopLevelBefore(folder, beforeRef);
      }
    }

    function mergeIntoNewFolder(target, draggedGuildRef) {
      if (target === draggedGuildRef) return false;
      const idx = state.items.indexOf(target);
      if (idx === -1) return false;
      removeGuild(dragPayload);
      const folder = {
        type: "folder",
        id: null,
        name: "",
        color: null,
        guilds: [
          { id: target.id, name: target.name, icon: target.icon },
          { id: draggedGuildRef.id, name: draggedGuildRef.name, icon: draggedGuildRef.icon },
        ],
      };
      const newIdx = state.items.indexOf(target);
      state.items.splice(newIdx === -1 ? idx : newIdx, 1, folder);
      viewFolder = folder;
    }

    function addGuildToFolder(folder, payload) {
      const g = payload.guildRef;
      removeGuild(payload);
      folder.guilds.push({ id: g.id, name: g.name, icon: g.icon });
    }

    // Folder A dropped onto folder B: B keeps its name/color and gains A's
    // servers (appended in order); A goes away.
    function mergeFolders(target, source) {
      if (target === source) return false;
      const idx = state.items.indexOf(source);
      if (idx === -1) return false;
      target.guilds.push(...source.guilds.map((g) => ({ id: g.id, name: g.name, icon: g.icon })));
      state.items.splice(idx, 1);
    }

    function reorderInFolder(folder, payload, target, pos) {
      if (payload.guildRef === target) return false;
      const g = payload.guildRef;
      removeGuild(payload);
      const beforeRef = pos === "before" ? target : folder.guilds[folder.guilds.indexOf(target) + 1] || null;
      insertIntoFolderBefore(folder, { id: g.id, name: g.name, icon: g.icon }, beforeRef);
    }

    function removeFromFolder(folder, guildObj) {
      const idx = folder.guilds.indexOf(guildObj);
      if (idx === -1) return false;
      folder.guilds.splice(idx, 1);
      state.items.push({ type: "guild", id: guildObj.id, name: guildObj.name, icon: guildObj.icon });
    }

    function deleteFolderAction(folder) {
      if (folder.guilds.length) {
        const list = folder.guilds.map((g) => "  • " + (g.name || "(unnamed)")).join("\n");
        const msg =
          `Unfold "${folder.name || "Unnamed folder"}"? These ${folder.guilds.length} server(s) ` +
          `will become ungrouped in its place:\n\n${list}`;
        if (!confirm(msg)) return false;
      }
      const idx = state.items.indexOf(folder);
      if (idx === -1) return false;
      const loose = folder.guilds.map((g) => ({ type: "guild", id: g.id, name: g.name, icon: g.icon }));
      state.items.splice(idx, 1, ...loose);
      if (viewFolder === folder) viewFolder = null;
    }

    function newFolder() {
      state.items.push({ type: "folder", id: null, name: "", color: null, guilds: [] });
    }

    // ---- shared tile building ----

    function makeAvatarFallback(guild, sizeClass) {
      const div = document.createElement("div");
      div.className = "avatar avatar-fallback " + sizeClass;
      div.textContent = (guild.name || "?").trim().charAt(0).toUpperCase() || "?";
      div.style.background = colorForId(guild.id);
      return div;
    }

    function makeAvatarEl(guild, sizeClass) {
      if (!guild.icon) return makeAvatarFallback(guild, sizeClass);
      const img = document.createElement("img");
      img.className = "avatar " + sizeClass;
      img.src = guild.icon;
      img.alt = "";
      img.loading = "lazy";
      img.addEventListener("error", () => img.replaceWith(makeAvatarFallback(guild, sizeClass)));
      return img;
    }

    // Attaches left/middle/right drop-zone detection to a tile. `handlers`:
    //   accepts(payload) -> bool        whether this tile accepts the drag at all
    //   hasInto(payload) -> bool        whether the middle zone means "drop into" (vs just reorder)
    //   into() / before() / after()     actions for each zone
    function attachDropZones(el, handlers) {
      function clearZone() {
        el.classList.remove("drop-before", "drop-after", "drop-into");
        delete el.dataset.dropZone;
      }
      el.addEventListener("dragover", (e) => {
        if (!dragPayload || !handlers.accepts(dragPayload)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        const rect = el.getBoundingClientRect();
        const relX = (e.clientX - rect.left) / rect.width;
        const canInto = handlers.hasInto && handlers.hasInto(dragPayload);
        const zone = canInto && relX >= 0.25 && relX <= 0.75 ? "into" : relX < 0.5 ? "before" : "after";
        clearZone();
        el.classList.add("drop-" + zone);
        el.dataset.dropZone = zone;
      });
      el.addEventListener("dragleave", clearZone);
      el.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const zone = el.dataset.dropZone;
        clearZone();
        if (!dragPayload || !handlers.accepts(dragPayload)) return;
        if (zone === "into" && handlers.into) handlers.into();
        else if (zone === "after") handlers.after();
        else handlers.before();
      });
    }

    function makeGuildTile(guild, origin) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.draggable = true;
      tile.appendChild(makeAvatarEl(guild, "avatar-lg"));

      const label = document.createElement("div");
      label.className = "tile-label" + (guild.name ? "" : " unnamed");
      label.textContent = guild.name || "(unnamed)";
      tile.appendChild(label);

      tile.addEventListener("dragstart", (e) => {
        dragPayload = { kind: "guild", guildRef: guild, origin };
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", guild.id);
        requestAnimationFrame(() => tile.classList.add("dragging"));
      });
      tile.addEventListener("dragend", () => {
        tile.classList.remove("dragging");
        dragPayload = null;
      });

      return tile;
    }

    function makeFolderTile(folder) {
      const tile = document.createElement("div");
      tile.className = "tile folder-tile";
      tile.draggable = true;

      // Always blue, regardless of the folder's own `color` field (set via
      // the color picker in the folder view) — that field is kept for a
      // future "apply to Discord" step, not for this at-a-glance type marker.
      const preview = document.createElement("div");
      preview.className = "folder-preview";
      if (folder.guilds.length === 0) {
        preview.innerHTML = FOLDER_GLYPH_SVG;
      } else {
        const grid = document.createElement("div");
        grid.className = "folder-preview-grid";
        folder.guilds.slice(0, 4).forEach((g) => grid.appendChild(makeAvatarEl(g, "avatar-sm")));
        preview.appendChild(grid);
      }
      tile.appendChild(preview);

      const label = document.createElement("div");
      label.className = "tile-label" + (folder.name ? "" : " unnamed");
      // Name and count in separate spans so a long name ellipsizes but the
      // count stays visible.
      const labelText = document.createElement("span");
      labelText.className = "tile-label-text";
      labelText.textContent = folder.name || "Unnamed folder";
      label.appendChild(labelText);
      if (folder.guilds.length) {
        const count = document.createElement("span");
        count.className = "tile-label-count";
        count.textContent = `(${folder.guilds.length})`;
        label.appendChild(count);
      }
      tile.appendChild(label);

      // Keep the hover list inside the scroll area horizontally (it's wider
      // than the tile, so it would get clipped in the edge columns).
      tile.addEventListener("mouseenter", () => {
        const tip = tile.querySelector(".folder-tooltip");
        if (!tip) return;
        tip.style.transform = "translateX(-50%)";
        const main = tile.closest("main");
        const left = main.getBoundingClientRect().left;
        const right = left + main.clientWidth; // excludes the scrollbar
        const r = tip.getBoundingClientRect();
        const shift = Math.min(0, right - 4 - r.right) || Math.max(0, left + 4 - r.left);
        if (shift) tip.style.transform = `translateX(calc(-50% + ${shift}px))`;
      });

      if (folder.guilds.length > 0) {
        const tooltip = document.createElement("div");
        tooltip.className = "folder-tooltip";
        folder.guilds.forEach((g) => {
          const row = document.createElement("div");
          row.className = "folder-tooltip-row";
          row.appendChild(makeAvatarEl(g, "avatar-xs"));
          const name = document.createElement("span");
          name.className = "folder-tooltip-name" + (g.name ? "" : " unnamed");
          name.textContent = g.name || "(unnamed)";
          row.appendChild(name);
          tooltip.appendChild(row);
        });
        tile.appendChild(tooltip);
      }

      const unfoldBadge = document.createElement("button");
      unfoldBadge.className = "remove-badge";
      unfoldBadge.textContent = "✕";
      unfoldBadge.title = "Unfold (ungroup this folder's servers)";
      unfoldBadge.setAttribute("aria-label", "Unfold folder");
      unfoldBadge.draggable = false;
      unfoldBadge.addEventListener("click", (e) => {
        e.stopPropagation(); // don't also open the folder
        withUndo(() => deleteFolderAction(folder));
      });
      tile.appendChild(unfoldBadge);

      tile.addEventListener("click", () => {
        viewFolder = folder;
        render();
      });
      tile.addEventListener("dragstart", (e) => {
        dragPayload = { kind: "folder", folderRef: folder };
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", folder.name || "folder");
      });
      tile.addEventListener("dragend", () => { dragPayload = null; });

      return tile;
    }

    // ---- rendering ----

    function renderMain() {
      folderToolbarEl.style.display = "none";
      importLabel.style.display = "";
      newFolderBtn.style.display = "";
      hintEl.textContent =
        "Drag an icon to reorder. Drop it on the middle of another icon to bundle them into a folder, or onto a folder to add it (drop a folder on a folder to merge them). Click a folder to open it, or its × to unfold it.";

      boardEl.innerHTML = "";

      if (state.items.length === 0) {
        emptyEl.style.display = "";
        emptyEl.textContent = "Empty layout — add a folder or import a different file.";
        return;
      }
      emptyEl.style.display = "none";

      const grid = document.createElement("div");
      grid.className = "grid";

      state.items.forEach((item) => {
        const tile = item.type === "folder" ? makeFolderTile(item) : makeGuildTile(item, { type: "top" });
        attachDropZones(tile, {
          accepts: () => true,
          hasInto: (p) =>
            p.kind === "guild" || (item.type === "folder" && p.folderRef !== item),
          into: () => {
            withUndo(() => {
              if (dragPayload.kind === "folder") return mergeFolders(item, dragPayload.folderRef);
              if (item.type === "folder") return addGuildToFolder(item, dragPayload);
              return mergeIntoNewFolder(item, dragPayload.guildRef);
            });
          },
          before: () => withUndo(() => reorderTopLevel(dragPayload, item, "before")),
          after: () => withUndo(() => reorderTopLevel(dragPayload, item, "after")),
        });
        grid.appendChild(tile);
      });

      grid.addEventListener("dragover", (e) => {
        if (!dragPayload) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      });
      grid.addEventListener("drop", (e) => {
        e.preventDefault();
        if (!dragPayload) return;
        withUndo(() => {
          if (dragPayload.kind === "guild") {
            const g = dragPayload.guildRef;
            removeGuild(dragPayload);
            insertTopLevelBefore({ type: "guild", id: g.id, name: g.name, icon: g.icon }, null);
          } else {
            const folder = dragPayload.folderRef;
            const idx = state.items.indexOf(folder);
            if (idx !== -1) state.items.splice(idx, 1);
            insertTopLevelBefore(folder, null);
          }
        });
      });

      boardEl.appendChild(grid);
    }

    function renderFolderView(folder) {
      importLabel.style.display = "none";
      newFolderBtn.style.display = "none";
      hintEl.textContent = "Drag to reorder within this folder, or use the × to move a server back out.";

      folderToolbarEl.style.display = "flex";
      folderToolbarEl.innerHTML = "";

      const backBtn = document.createElement("button");
      backBtn.textContent = "← All servers";
      backBtn.addEventListener("click", () => { viewFolder = null; render(); });

      const colorInput = document.createElement("input");
      colorInput.type = "color";
      colorInput.value = folder.color || "#5865f2";
      colorInput.title = "Folder color";
      colorInput.addEventListener("input", () => {
        beginFieldEdit();
        folder.color = colorInput.value;
      });
      colorInput.addEventListener("change", commitFieldEdit);

      const nameInput = document.createElement("input");
      nameInput.className = "folder-name";
      nameInput.value = folder.name || "";
      nameInput.placeholder = "Unnamed folder";
      nameInput.addEventListener("input", () => {
        beginFieldEdit();
        folder.name = nameInput.value;
      });
      nameInput.addEventListener("change", commitFieldEdit);
      nameInput.addEventListener("blur", commitFieldEdit);

      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete folder";
      delBtn.addEventListener("click", () => withUndo(() => deleteFolderAction(folder)));

      folderToolbarEl.append(backBtn, colorInput, nameInput, delBtn);
      if (!folder.name) nameInput.focus();

      boardEl.innerHTML = "";

      if (folder.guilds.length === 0) {
        emptyEl.style.display = "";
        emptyEl.textContent = "This folder is empty — close it and drop a server onto it from the grid.";
        return;
      }
      emptyEl.style.display = "none";

      const grid = document.createElement("div");
      grid.className = "grid";

      folder.guilds.forEach((g) => {
        const tile = makeGuildTile(g, { type: "folder", folderRef: folder });

        const removeBadge = document.createElement("button");
        removeBadge.className = "remove-badge";
        removeBadge.textContent = "✕";
        removeBadge.title = "Move out of this folder";
        removeBadge.setAttribute("aria-label", "Remove from folder");
        removeBadge.addEventListener("click", (e) => {
          e.stopPropagation();
          withUndo(() => removeFromFolder(folder, g));
        });
        tile.appendChild(removeBadge);

        attachDropZones(tile, {
          accepts: (p) => p.kind === "guild",
          before: () => withUndo(() => reorderInFolder(folder, dragPayload, g, "before")),
          after: () => withUndo(() => reorderInFolder(folder, dragPayload, g, "after")),
        });
        grid.appendChild(tile);
      });

      boardEl.appendChild(grid);
    }

    function render() {
      updateUndoRedoButtons();
      if (viewFolder) renderFolderView(viewFolder);
      else renderMain();
    }

    // ---- import / export ----

    function loadFromJSON(data) {
      if (!data || !Array.isArray(data.items)) {
        throw new Error("not a recognized Discord Server Organizer export (missing items array)");
      }
      for (const item of data.items) {
        if (item.type !== "guild" && item.type !== "folder") {
          throw new Error('unrecognized item type "' + item.type + '"');
        }
      }
      state = { items: cloneItemsForEditing(data.items) };
      viewFolder = null;
    }

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const before = cloneItemsForEditing(state.items);
        loadFromJSON(JSON.parse(text));
        pushUndo(before);
        setStatus(`Loaded ${state.items.length} top-level item(s) from "${file.name}".`);
        render();
      } catch (e) {
        setStatus("Couldn't load that file: " + e.message, true);
      } finally {
        fileInput.value = "";
      }
    });

    newFolderBtn.addEventListener("click", () => withUndo(newFolder));

    exportBtn.addEventListener("click", () => {
      const out = { exportedAt: new Date().toISOString(), items: serializeItemsForExport(state.items) };
      const filename = downloadJSON(out, "discord-folders-edited");
      setStatus(`Exported "${filename}".`);
    });

    render();
  }

  async function onOrganizeClick(btn) {
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Loading...";
    try {
      const data = await buildExport();
      openEditor(data.items);
    } catch (e) {
      console.error("[discord-server-organizer]", e);
      alert(`Discord Server Organizer failed to load: ${e.message}\nSee console for details.`);
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  // ---- button --------------------------------------------------------------

  function createButton() {
    const btn = document.createElement("button");
    btn.textContent = "Organize Servers";
    btn.title = "Open the server/folder regrouping editor";
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
    btn.addEventListener("click", () => onOrganizeClick(btn));
    document.body.appendChild(btn);
  }

  function init() {
    if (document.body) createButton();
    else document.addEventListener("DOMContentLoaded", createButton);
  }

  init();
})();
