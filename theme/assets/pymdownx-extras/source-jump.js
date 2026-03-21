(function () {
  if (window.__PEICD_SOURCE_JUMP__) {
    if (typeof window.__PEICD_SOURCE_JUMP__.init === "function") {
      window.__PEICD_SOURCE_JUMP__.init();
    }
    return;
  }

  var LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
  var CONTENT_SELECTOR = ".md-content .md-content__inner, .md-content, main";
  var BLOCK_SELECTOR = "p, li, pre, blockquote, h1, h2, h3, h4, h5, h6, td, th, summary";
  var MENU_ID = "peicd-source-jump-menu";
  var STYLE_ID = "peicd-source-jump-style";
  var MAX_SELECTION_CHARS = 600;
  var MAX_CONTAINER_CHARS = 2000;
  var MAX_PREFIX_CHARS = 500;
  var bound = false;
  var activeContext = null;
  var endpointProbe = null;
  var endpointAvailable = false;
  var endpointChecked = false;

  function isLocalPreview() {
    return LOCAL_HOSTS.has(window.location.hostname);
  }

  function isMkDocsServePreview() {
    return typeof window.livereload === "function";
  }

  function getContentRoot() {
    return document.querySelector(".md-content .md-content__inner")
      || document.querySelector(".md-content")
      || document.querySelector("main")
      || document.body;
  }

  function getSiteBaseUrl() {
    if (window.__md_scope && typeof window.__md_scope.href === "string") {
      return window.__md_scope;
    }

    var configNode = document.getElementById("__config");
    if (configNode) {
      try {
        var config = JSON.parse(configNode.textContent || "{}");
        if (config && config.base) {
          return new URL(config.base, window.location.href);
        }
      } catch (_) {
      }
    }

    return new URL(".", window.location.href);
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "#" + MENU_ID + "{",
      "position:fixed;",
      "z-index:10001;",
      "display:none;",
      "min-width:220px;",
      "padding:8px;",
      "border-radius:14px;",
      "border:1px solid rgba(122,211,255,.28);",
      "background:rgba(17,22,30,.96);",
      "box-shadow:0 18px 38px rgba(0,0,0,.34);",
      "backdrop-filter:blur(12px);",
      "color:var(--md-default-fg-color,#eef7ff);",
      "}",
      "[data-md-color-scheme='default'] #" + MENU_ID + ",",
      "[data-md-color-scheme='light'] #" + MENU_ID + "{",
      "background:rgba(255,255,255,.98);",
      "border-color:rgba(0,0,0,.12);",
      "box-shadow:0 16px 32px rgba(0,0,0,.16);",
      "color:rgba(0,0,0,.84);",
      "}",
      "#" + MENU_ID + " .peicd-source-jump-btn{",
      "width:100%;",
      "display:block;",
      "padding:10px 12px;",
      "border:0;",
      "background:transparent;",
      "color:inherit;",
      "font:inherit;",
      "text-align:left;",
      "cursor:pointer;",
      "border-radius:10px;",
      "}",
      "#" + MENU_ID + " .peicd-source-jump-btn:hover{",
      "background:rgba(122,211,255,.12);",
      "}",
      "[data-md-color-scheme='default'] #" + MENU_ID + " .peicd-source-jump-btn:hover,",
      "[data-md-color-scheme='light'] #" + MENU_ID + " .peicd-source-jump-btn:hover{",
      "background:rgba(0,0,0,.06);",
      "}",
      "#" + MENU_ID + " .peicd-source-jump-btn[disabled]{",
      "opacity:.6;",
      "cursor:wait;",
      "}",
      "#" + MENU_ID + " .peicd-source-jump-status{",
      "padding:8px 12px 4px;",
      "font-size:12px;",
      "line-height:1.4;",
      "opacity:.82;",
      "word-break:break-word;",
      "display:none;",
      "}",
      "#" + MENU_ID + ".is-open{display:block;}",
    ].join("");
    document.head.appendChild(style);
  }

  function ensureMenu() {
    ensureStyle();

    var menu = document.getElementById(MENU_ID);
    if (menu) return menu;

    menu = document.createElement("div");
    menu.id = MENU_ID;
    menu.innerHTML = [
      '<button type="button" class="peicd-source-jump-btn" data-role="jump">開啟原文檔案</button>',
      '<button type="button" class="peicd-source-jump-btn" data-role="copy">複製</button>',
      '<div class="peicd-source-jump-status" data-role="status"></div>'
    ].join("");

    menu.querySelector('[data-role="jump"]').addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      openSourceLocation();
    });

    menu.querySelector('[data-role="copy"]').addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      copySelectionText();
    });

    document.body.appendChild(menu);
    return menu;
  }

  function getMenu() {
    return document.getElementById(MENU_ID);
  }

  function hideMenu() {
    var menu = getMenu();
    if (!menu) return;
    menu.classList.remove("is-open");
    menu.style.display = "none";
    activeContext = null;
    updateStatus("");
    setJumpBusy(false);
  }

  function showMenu(clientX, clientY, context) {
    var menu = ensureMenu();
    activeContext = context;
    updateStatus("");
    setJumpBusy(false);

    menu.style.display = "block";
    menu.classList.add("is-open");

    var margin = 8;
    var width = menu.offsetWidth || 220;
    var height = menu.offsetHeight || 90;
    var left = clientX;
    var top = clientY;

    if (left + width > window.innerWidth - margin) {
      left = window.innerWidth - width - margin;
    }
    if (top + height > window.innerHeight - margin) {
      top = window.innerHeight - height - margin;
    }
    if (left < margin) left = margin;
    if (top < margin) top = margin;

    menu.style.left = left + "px";
    menu.style.top = top + "px";

    var ttsPop = document.getElementById("tts-selection-pop");
    if (ttsPop) ttsPop.style.display = "none";
  }

  function updateStatus(message) {
    var menu = getMenu();
    if (!menu) return;
    var status = menu.querySelector('[data-role="status"]');
    if (!status) return;
    status.textContent = message || "";
    status.style.display = message ? "block" : "none";
  }

  function setJumpBusy(isBusy) {
    var menu = getMenu();
    if (!menu) return;
    var button = menu.querySelector('[data-role="jump"]');
    if (!button) return;
    button.disabled = !!isBusy;
    button.textContent = isBusy ? "開啟中..." : "開啟原文檔案";
  }

  function sanitizeText(text, maxLength) {
    var cleaned = String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (maxLength && cleaned.length > maxLength) {
      return cleaned.slice(0, maxLength);
    }
    return cleaned;
  }

  function getSelectionText() {
    var selection = window.getSelection ? window.getSelection() : null;
    if (!selection || selection.rangeCount === 0) return "";
    var text = sanitizeText(selection.toString(), MAX_SELECTION_CHARS);
    if (!text || text.length > MAX_SELECTION_CHARS) return "";
    return text;
  }

  function closestElement(node) {
    if (!node) return null;
    return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  }

  function getClosestBlock(node) {
    var root = getContentRoot();
    var element = closestElement(node);
    if (!element || !root.contains(element)) return null;
    return element.closest(BLOCK_SELECTOR) || root;
  }

  function isWithinContent(node) {
    var root = getContentRoot();
    var element = closestElement(node);
    return !!(root && element && root.contains(element));
  }

  function buildSelectionContext() {
    var selection = window.getSelection ? window.getSelection() : null;
    if (!selection || selection.rangeCount === 0) return null;

    var range = selection.getRangeAt(0);
    if (range.collapsed) return null;

    var text = getSelectionText();
    if (!text) return null;

    var block = getClosestBlock(range.startContainer || selection.anchorNode);
    if (!block) return null;

    var containerText = sanitizeText(block.innerText || block.textContent || "", MAX_CONTAINER_CHARS);
    var prefixText = "";

    try {
      var prefixRange = document.createRange();
      prefixRange.selectNodeContents(block);
      prefixRange.setEnd(range.startContainer, range.startOffset);
      prefixText = sanitizeText(prefixRange.toString(), MAX_PREFIX_CHARS);
    } catch (_) {
      prefixText = "";
    }

    return {
      page: window.location.pathname,
      selection: text,
      container: containerText,
      prefix: prefixText
    };
  }

  function makeLookupUrl(context) {
    var url = new URL("__peicd/source-jump", getSiteBaseUrl());
    url.searchParams.set("page", context.page);
    url.searchParams.set("selection", context.selection);
    if (context.container) url.searchParams.set("container", context.container);
    if (context.prefix) url.searchParams.set("prefix", context.prefix);
    return url.toString();
  }

  function makeProbeUrl() {
    return makeLookupUrl({
      page: window.location.pathname,
      selection: "__probe__",
      container: "",
      prefix: ""
    });
  }

  async function probeEndpoint() {
    if (endpointChecked) return endpointAvailable;
    if (endpointProbe) return endpointProbe;

    endpointProbe = fetch(makeProbeUrl(), {
      method: "GET",
      headers: { "Accept": "application/json" },
      cache: "no-store"
    }).then(function (response) {
      var contentType = String(response.headers.get("content-type") || "");
      endpointAvailable = contentType.indexOf("application/json") >= 0;
      endpointChecked = true;
      return endpointAvailable;
    }).catch(function () {
      endpointAvailable = false;
      endpointChecked = true;
      return false;
    }).finally(function () {
      endpointProbe = null;
    });

    return endpointProbe;
  }

  async function openSourceLocation() {
    if (!activeContext) return;

    setJumpBusy(true);
    updateStatus("");

    try {
      var url = new URL(makeLookupUrl(activeContext));
      url.searchParams.set("action", "open");
      var response = await fetch(url.toString(), {
        method: "GET",
        headers: { "Accept": "application/json" },
        cache: "no-store"
      });

      var payload = await response.json().catch(function () { return null; });
      if (!response.ok || !payload || !payload.ok || payload.opened !== true) {
        var message = payload && payload.message ? payload.message : "目前無法自動開啟對應檔案。";
        updateStatus(message);
        setJumpBusy(false);
        return;
      }

      hideMenu();
    } catch (error) {
      updateStatus("開檔失敗，請確認目前是用 mkdocs serve 預覽。");
      setJumpBusy(false);
      console.error("[source-jump] lookup failed:", error);
    }
  }

  async function copySelectionText() {
    var text = activeContext && activeContext.selection ? activeContext.selection : getSelectionText();
    if (!text) {
      hideMenu();
      return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        document.execCommand("copy");
      }
      hideMenu();
    } catch (_) {
      updateStatus("複製失敗，請改用 Ctrl+C。");
    }
  }

  async function handleContextMenu(event) {
    if (!isLocalPreview()) return;
    if (!isWithinContent(event.target)) return;

    var menu = getMenu();
    if (menu && menu.contains(event.target)) return;

    if (!(await probeEndpoint())) return;

    var context = buildSelectionContext();
    if (!context) return;

    event.preventDefault();
    event.stopPropagation();
    showMenu(event.clientX, event.clientY, context);
  }

  function bindGlobalEventsOnce() {
    if (bound) return;
    bound = true;

    document.addEventListener("contextmenu", handleContextMenu, true);

    document.addEventListener("mousedown", function (event) {
      var menu = getMenu();
      if (!menu) return;
      if (!menu.contains(event.target)) hideMenu();
    }, true);

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") hideMenu();
    });

    window.addEventListener("resize", hideMenu);
    window.addEventListener("scroll", hideMenu, true);
    document.addEventListener("navigation:complete", hideMenu);
  }

  function init() {
    if (!isLocalPreview() || !isMkDocsServePreview()) return;
    ensureMenu();
    bindGlobalEventsOnce();
  }

  window.__PEICD_SOURCE_JUMP__ = { init: init };

  if (window.document$ && typeof window.document$.subscribe === "function") {
    window.document$.subscribe(init);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
