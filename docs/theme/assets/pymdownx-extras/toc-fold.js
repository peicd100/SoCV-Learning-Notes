(function () {
  "use strict";

  const CLASS = {
    sidebar: "peicd-toc-sidebar",
    head: "peicd-toc-head",
    headRow: "peicd-toc-head__row",
    headRowTitleless: "peicd-toc-head__row--titleless",
    title: "peicd-toc-title",
    toolbar: "peicd-toc-toolbar",
    toolbarGroup: "peicd-toc-toolbar__group",
    control: "peicd-toc-control",
    modeActive: "peicd-toc-control--active",
    toggle: "peicd-toc-toggle",
    nested: "peicd-toc-item--nested",
    collapsed: "peicd-toc-item--collapsed",
    currentLink: "peicd-toc-link--current",
    currentItem: "peicd-toc-item--current",
    currentPath: "peicd-toc-item--current-path",
    proxyLink: "peicd-toc-link--proxy-current",
    syncing: "peicd-toc-syncing",
    close: "peicd-toc-close",
    mobileToggle: "peicd-mobile-toc-toggle",
    mobileScrim: "peicd-toc-scrim",
    mobileVisible: "peicd-mobile-toc-visible",
    mobileOpen: "peicd-mobile-toc-open"
  };

  const MOBILE_MQ = "(max-width: 59.999em)";
  const AUTO_SCROLL_GUARD_MS = 360;
  const ACTIVATION_OFFSET = 28;
  const FOLLOW_TARGET_RATIO = 0.42;
  const FOLLOW_PADDING_RATIO = 0.18;
  const MOBILE_PANEL_ID = "peicd-mobile-toc-panel";
  const MOBILE_TOGGLE_ID = "peicd-mobile-toc-toggle";

  let state = null;

  function now() {
    return Date.now();
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function listen(target, eventName, handler, options) {
    target.addEventListener(eventName, handler, options);
    state.cleanups.push(() => target.removeEventListener(eventName, handler, options));
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function isMobile() {
    return window.matchMedia(MOBILE_MQ).matches;
  }

  function getHeaderOffset() {
    const header = document.querySelector(".md-header");
    if (header) return Math.round(header.getBoundingClientRect().height);

    const raw = getComputedStyle(document.documentElement).getPropertyValue("--md-header-height").trim();
    const value = parseFloat(raw);
    return Number.isFinite(value) ? value : 56;
  }

  function scheduleSync(force) {
    if (!state) return;
    state.forceSync = state.forceSync || Boolean(force);
    if (state.syncRaf) return;

    state.syncRaf = requestAnimationFrame(() => {
      if (!state) return;
      state.syncRaf = 0;
      const shouldForce = state.forceSync;
      state.forceSync = false;
      sync(shouldForce);
    });
  }

  function setMode(nextMode) {
    if (!state) return;
    state.mode = nextMode;
    state.sidebar.dataset.peicdTocMode = nextMode;

    state.buttons.auto?.setAttribute("aria-pressed", String(nextMode === "auto"));
    state.buttons.auto?.classList.toggle(CLASS.modeActive, nextMode === "auto");
    state.buttons.manual?.setAttribute("aria-pressed", String(nextMode === "manual"));
    state.buttons.manual?.classList.toggle(CLASS.modeActive, nextMode === "manual");
  }

  function setExpanded(item, expanded) {
    item.classList.toggle(CLASS.collapsed, !expanded);

    const toggle = item.querySelector(":scope > ." + CLASS.toggle);
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.setAttribute("title", expanded ? "收合子章節" : "展開子章節");
    }
  }

  function clearCurrentClasses() {
    if (!state?.toc) return;

    state.toc.querySelectorAll(
      "." + CLASS.currentLink + ", ." + CLASS.proxyLink
    ).forEach((element) => {
      element.classList.remove(CLASS.currentLink, CLASS.proxyLink);
    });

    state.toc.querySelectorAll(
      "." + CLASS.currentItem + ", ." + CLASS.currentPath
    ).forEach((element) => {
      element.classList.remove(CLASS.currentItem, CLASS.currentPath);
    });
  }

  function isVisible(element) {
    if (!element || !element.isConnected) return false;
    if (element.getClientRects().length === 0) return false;

    const style = getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none";
  }

  function getVisibleLink(link) {
    if (!link) return null;
    if (isVisible(link)) return link;

    let item = link.closest("li.md-nav__item");
    while (item && state?.toc?.contains(item)) {
      const candidate = item.querySelector(":scope > a.md-nav__link");
      if (candidate && isVisible(candidate)) return candidate;
      item = item.parentElement?.closest("li.md-nav__item") ?? null;
    }

    return null;
  }

  function applyCurrent(entry) {
    clearCurrentClasses();
    if (!entry) return;

    entry.link.classList.add(CLASS.currentLink);

    let item = entry.link.closest("li.md-nav__item");
    if (item) item.classList.add(CLASS.currentItem);

    while (item && state.toc.contains(item)) {
      item.classList.add(CLASS.currentPath);
      item = item.parentElement?.closest("li.md-nav__item") ?? null;
    }

    const visible = getVisibleLink(entry.link);
    if (visible && visible !== entry.link) visible.classList.add(CLASS.proxyLink);
  }

  function expandPath(entry) {
    let item = entry?.link?.closest("li.md-nav__item") ?? null;
    while (item && state.toc.contains(item)) {
      if (item.querySelector(":scope > nav.md-nav")) setExpanded(item, true);
      item = item.parentElement?.closest("li.md-nav__item") ?? null;
    }
  }

  function collapseToCurrent(entry) {
    state.nestedItems.forEach((item) => setExpanded(item, false));
    if (entry) expandPath(entry);
  }

  function getEntryHash(entry) {
    if (!entry?.link) return "";
    return new URL(entry.link.href, window.location.href).hash || "";
  }

  function syncHash(entry) {
    const nextHash = getEntryHash(entry);
    if (!nextHash) return;
    if (window.location.hash === nextHash) return;

    history.replaceState(history.state, "", nextHash);
  }

  function findCurrentEntry() {
    if (!state?.entries?.length) return null;

    const activationLine = getHeaderOffset() + ACTIVATION_OFFSET;
    let current = state.entries[0];

    for (const entry of state.entries) {
      if (entry.target.getBoundingClientRect().top <= activationLine) current = entry;
      else break;
    }

    return current;
  }

  function followCurrent(entry) {
    if (!state?.scrollWrap || !entry) return;
    if (state.sidebarManualLocked) return;

    const target = getVisibleLink(entry.link);
    if (!target) return;

    const wrap = state.scrollWrap;
    const wrapRect = wrap.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const headHeight = state.head?.getBoundingClientRect().height ?? 0;
    const topPadding = Math.max(headHeight + 14, 20);
    const bottomPadding = 20;
    const freeHeight = Math.max(80, wrap.clientHeight - topPadding - bottomPadding);
    const midpoint = targetRect.top + targetRect.height / 2;
    const comfortTop = wrapRect.top + topPadding + freeHeight * FOLLOW_PADDING_RATIO;
    const comfortBottom = wrapRect.top + topPadding + freeHeight * (1 - FOLLOW_PADDING_RATIO);

    if (midpoint >= comfortTop && midpoint <= comfortBottom) return;

    const desiredMidpoint = wrapRect.top + topPadding + freeHeight * FOLLOW_TARGET_RATIO;
    const delta = midpoint - desiredMidpoint;
    const maxScroll = Math.max(0, wrap.scrollHeight - wrap.clientHeight);
    const nextTop = clamp(wrap.scrollTop + delta, 0, maxScroll);

    if (Math.abs(nextTop - wrap.scrollTop) < 4) return;

    state.autoScrollUntil = now() + AUTO_SCROLL_GUARD_MS;
    wrap.scrollTo({
      top: nextTop,
      behavior: prefersReducedMotion() ? "auto" : "smooth"
    });
  }

  function holdManual() {
    if (!state) return;
    state.sidebarManualLocked = true;
  }

  function releaseManualHold() {
    if (!state) return;
    state.sidebarManualLocked = false;
  }

  function sync(force) {
    if (!state?.toc) return;

    const entry = findCurrentEntry();
    const key = entry?.link?.getAttribute("href") ?? "";
    const changed = key !== state.activeKey;

    applyCurrent(entry);

    if (state.mode === "auto" && (changed || force)) {
      state.sidebar.classList.add(CLASS.syncing);
      collapseToCurrent(entry);
      applyCurrent(entry);
      requestAnimationFrame(() => state?.sidebar?.classList.remove(CLASS.syncing));
    }

    state.activeKey = key;
    if (entry && (changed || force)) syncHash(entry);
    if (state.mode === "auto") followCurrent(entry);
  }

  function createToolbarGroup(label) {
    const group = document.createElement("div");
    group.className = CLASS.toolbarGroup;
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", label);
    return group;
  }

  function createButton(label, options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = CLASS.control + (options.mode ? " " + options.mode : "");
    button.textContent = label;
    if (options.pressed !== undefined) button.setAttribute("aria-pressed", String(options.pressed));
    if (options.title) button.setAttribute("title", options.title);
    button.addEventListener("click", options.onClick);
    return button;
  }

  function buildToolbar() {
    const toolbar = document.createElement("div");
    toolbar.className = CLASS.toolbar;

    const actions = createToolbarGroup("目錄操作");
    const modes = createToolbarGroup("目錄模式");

    const expandButton = createButton("展開", {
      onClick() {
        setMode("manual");
        holdManual();
        state.nestedItems.forEach((item) => setExpanded(item, true));
        scheduleSync(false);
      },
      title: "展開所有章節"
    });

    const collapseButton = createButton("收合", {
      onClick() {
        setMode("manual");
        holdManual();
        state.nestedItems.forEach((item) => setExpanded(item, false));
        scheduleSync(false);
      },
      title: "收合所有章節"
    });

    const autoButton = createButton("自動", {
      mode: "peicd-toc-control--mode",
      pressed: true,
      onClick() {
        if (state.mode === "auto") return;
        setMode("auto");
        releaseManualHold();
        scheduleSync(true);
      },
      title: "只展開目前閱讀路徑"
    });

    const manualButton = createButton("手動", {
      mode: "peicd-toc-control--mode",
      pressed: false,
      onClick() {
        if (state.mode === "manual") return;
        setMode("manual");
        holdManual();
        scheduleSync(false);
      },
      title: "保留你手動展開的狀態"
    });

    actions.append(expandButton, collapseButton);
    modes.append(autoButton, manualButton);
    toolbar.append(actions, modes);

    state.buttons = {
      auto: autoButton,
      manual: manualButton
    };

    return toolbar;
  }

  function buildHead() {
    const nav = state.toc.closest(".md-nav--secondary") || state.toc;
    let title = nav.querySelector(".md-nav__title");

    if (!title) {
      title = document.createElement("div");
      nav.insertBefore(title, nav.firstChild);
    }

    title.classList.add(CLASS.title);
    title.removeAttribute("for");
    title.textContent = "";
    title.hidden = true;
    title.setAttribute("aria-hidden", "true");

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = CLASS.close;
    closeButton.setAttribute("aria-label", "關閉目錄");
    closeButton.innerHTML = '<span aria-hidden="true">×</span>';
    closeButton.addEventListener("click", () => setMobileOpen(false));

    const head = document.createElement("div");
    head.className = CLASS.head;

    const row = document.createElement("div");
    row.className = CLASS.headRow + " " + CLASS.headRowTitleless;
    row.append(title, closeButton);

    head.append(row, buildToolbar());
    nav.insertBefore(head, nav.firstChild);

    state.head = head;
    state.closeButton = closeButton;
  }

  function decorateNestedItems() {
    state.nestedItems = [];

    Array.from(state.toc.querySelectorAll("li.md-nav__item")).forEach((item, index) => {
      const childNav = item.querySelector(":scope > nav.md-nav");
      const link = item.querySelector(":scope > a.md-nav__link");
      if (!childNav || !link) return;

      item.classList.add(CLASS.nested);
      childNav.id = childNav.id || "peicd-toc-branch-" + (index + 1);

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = CLASS.toggle;
      toggle.setAttribute("aria-controls", childNav.id);
      toggle.setAttribute("aria-label", "切換「" + link.textContent.trim() + "」子章節");
      toggle.innerHTML = '<span class="peicd-toc-toggle__icon" aria-hidden="true"></span>';
      toggle.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setMode("manual");
        setExpanded(item, item.classList.contains(CLASS.collapsed));
        holdManual();
        scheduleSync(false);
      });

      link.insertAdjacentElement("afterend", toggle);
      state.nestedItems.push(item);
      setExpanded(item, false);
    });
  }

  function buildEntries() {
    state.entries = Array.from(
      state.toc.querySelectorAll(".md-nav__list a.md-nav__link[href*='#']")
    ).map((link) => {
      const href = link.getAttribute("href");
      if (!href || !href.includes("#")) return null;

      let id = href.split("#").pop();
      try {
        id = decodeURIComponent(id);
      } catch (_) {
        return null;
      }

      const target = document.getElementById(id);
      return target ? { link, target } : null;
    }).filter(Boolean);
  }

  function createObserver() {
    if (state.observer) state.observer.disconnect();
    if (!state.entries.length || !("IntersectionObserver" in window)) return;

    state.observer = new IntersectionObserver(() => scheduleSync(), {
      root: null,
      rootMargin: "-" + (getHeaderOffset() + 12) + "px 0px -62% 0px",
      threshold: [0, 1]
    });

    state.entries.forEach((entry) => state.observer.observe(entry.target));
  }

  function setMobileOpen(open) {
    if (!state?.sidebar) return;

    state.sidebar.classList.toggle(CLASS.mobileVisible, open);
    document.documentElement.classList.toggle(CLASS.mobileOpen, open);

    if (state.mobileButton) {
      state.mobileButton.setAttribute("aria-expanded", String(open));
      state.mobileButton.setAttribute("title", open ? "關閉目錄" : "打開目錄");
      state.mobileButton.setAttribute("aria-label", open ? "關閉目錄" : "打開目錄");
    }

    if (state.mobileScrim) state.mobileScrim.hidden = !open;
  }

  function updateMobileUI() {
    if (!state?.mobileButton || !state.sidebar) return;

    const visible = Boolean(state.entries.length) && isMobile();
    state.mobileButton.hidden = !visible;
    state.mobileScrim.hidden = !(visible && state.sidebar.classList.contains(CLASS.mobileVisible));
    state.mobileButton.setAttribute("aria-controls", MOBILE_PANEL_ID);

    if (!visible) setMobileOpen(false);
  }

  function buildMobileChrome() {
    const searchToggle = document.querySelector("label[for='__search'].md-header__button.md-icon");
    const headerOptions = document.querySelector(".md-header__options");
    const headerInner = document.querySelector(".md-header__inner");

    const mobileButton = document.createElement("button");
    mobileButton.type = "button";
    mobileButton.id = MOBILE_TOGGLE_ID;
    mobileButton.className = "md-header__button md-icon " + CLASS.mobileToggle;
    mobileButton.setAttribute("aria-label", "打開目錄");
    mobileButton.setAttribute("title", "打開目錄");
    mobileButton.innerHTML = [
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">',
      '  <path d="M7 5h14v2H7V5M3 4.5A1.5 1.5 0 0 1 4.5 6A1.5 1.5 0 0 1 3 7.5A1.5 1.5 0 0 1 1.5 6A1.5 1.5 0 0 1 3 4.5M7 11h14v2H7v-2M3 10.5A1.5 1.5 0 0 1 4.5 12A1.5 1.5 0 0 1 3 13.5A1.5 1.5 0 0 1 1.5 12A1.5 1.5 0 0 1 3 10.5M7 17h14v2H7v-2M3 16.5A1.5 1.5 0 0 1 4.5 18A1.5 1.5 0 0 1 3 19.5A1.5 1.5 0 0 1 1.5 18A1.5 1.5 0 0 1 3 16.5Z"></path>',
      "</svg>"
    ].join("");
    mobileButton.hidden = true;
    mobileButton.addEventListener("click", () => setMobileOpen(!state.sidebar.classList.contains(CLASS.mobileVisible)));

    const mobileScrim = document.createElement("button");
    mobileScrim.type = "button";
    mobileScrim.className = CLASS.mobileScrim;
    mobileScrim.hidden = true;
    mobileScrim.setAttribute("aria-label", "關閉目錄");
    mobileScrim.addEventListener("click", () => setMobileOpen(false));

    document.body.append(mobileScrim);
    if (searchToggle) searchToggle.insertAdjacentElement("afterend", mobileButton);
    else if (headerOptions) headerOptions.append(mobileButton);
    else if (headerInner) headerInner.append(mobileButton);
    else document.body.append(mobileButton);

    state.mobileButton = mobileButton;
    state.mobileScrim = mobileScrim;
    state.sidebar.id = MOBILE_PANEL_ID;
  }

  function bindSidebarEvents() {
    const wrap = state.scrollWrap;
    if (!wrap) return;

    const markManualKeys = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "]);

    listen(wrap, "wheel", holdManual, { passive: true });
    listen(wrap, "touchstart", holdManual, { passive: true });
    listen(wrap, "touchmove", holdManual, { passive: true });
    listen(wrap, "pointerdown", holdManual, { passive: true });
    listen(wrap, "keydown", (event) => {
      if (markManualKeys.has(event.key)) holdManual();
    });
    listen(wrap, "scroll", () => {
      if (now() > state.autoScrollUntil) holdManual();
    }, { passive: true });
  }

  function bindGlobalEvents() {
    const onResize = () => {
      clearTimeout(state.resizeTimer);
      state.resizeTimer = window.setTimeout(() => {
        createObserver();
        updateMobileUI();
        scheduleSync(true);
      }, 120);
    };
    const onHashChange = () => {
      releaseManualHold();
      scheduleSync(true);
    };
    const onWindowScroll = () => {
      releaseManualHold();
      scheduleSync();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape" && state?.sidebar?.classList.contains(CLASS.mobileVisible)) setMobileOpen(false);
    };

    listen(window, "resize", onResize, { passive: true });
    listen(window, "scroll", onWindowScroll, { passive: true });
    listen(window, "hashchange", onHashChange);
    listen(document, "keydown", onKeyDown);
    state.cleanups.push(() => clearTimeout(state.resizeTimer));

    const mql = window.matchMedia(MOBILE_MQ);
    const onMediaChange = () => updateMobileUI();
    if (typeof mql.addEventListener === "function") mql.addEventListener("change", onMediaChange);
    else if (typeof mql.addListener === "function") mql.addListener(onMediaChange);

    state.cleanups.push(() => {
      if (typeof mql.removeEventListener === "function") mql.removeEventListener("change", onMediaChange);
      else if (typeof mql.removeListener === "function") mql.removeListener(onMediaChange);
    });
  }

  function resetSidebar(sidebar) {
    sidebar.classList.remove(CLASS.sidebar, CLASS.mobileVisible, CLASS.syncing);
    sidebar.querySelectorAll("." + CLASS.toggle).forEach((element) => element.remove());
    sidebar.querySelectorAll("." + CLASS.head).forEach((head) => {
      const nav = sidebar.querySelector(".md-nav--secondary");
      const title = head.querySelector(".md-nav__title");
      if (nav && title && title.parentElement !== nav) nav.insertBefore(title, nav.firstChild);
      head.remove();
    });

    sidebar.querySelectorAll("li.md-nav__item").forEach((item) => {
      item.classList.remove(CLASS.nested, CLASS.collapsed, CLASS.currentItem, CLASS.currentPath);
    });

    sidebar.querySelectorAll("a.md-nav__link").forEach((link) => {
      link.classList.remove(CLASS.currentLink, CLASS.proxyLink);
    });
  }

  function teardown() {
    if (!state) return;

    if (state.observer) state.observer.disconnect();
    state.cleanups.forEach((cleanup) => {
      try {
        cleanup();
      } catch (_) {
        /* noop */
      }
    });
    clearTimeout(state.resizeTimer);
    if (state.mobileButton) state.mobileButton.remove();
    if (state.mobileScrim) state.mobileScrim.remove();
    document.documentElement.classList.remove(CLASS.mobileOpen);
    state = null;
  }

  function init() {
    teardown();

    const sidebar = document.querySelector(".md-sidebar--secondary");
    const toc = sidebar?.querySelector("[data-md-component='toc']");
    if (!sidebar || !toc) return;

    resetSidebar(sidebar);

    state = {
      sidebar,
      toc,
      scrollWrap: sidebar.querySelector(".md-sidebar__scrollwrap"),
      head: null,
      closeButton: null,
      mobileButton: null,
      mobileScrim: null,
      entries: [],
      nestedItems: [],
      buttons: {},
      observer: null,
      mode: "auto",
      activeKey: "",
      sidebarManualLocked: false,
      autoScrollUntil: 0,
      resizeTimer: 0,
      syncRaf: 0,
      forceSync: false,
      cleanups: []
    };

    sidebar.classList.add(CLASS.sidebar);
    buildHead();
    decorateNestedItems();
    buildEntries();
    buildMobileChrome();
    createObserver();
    bindSidebarEvents();
    bindGlobalEvents();
    setMode("auto");
    updateMobileUI();
    scheduleSync(true);
  }

  if (window.document$?.subscribe) {
    window.document$.subscribe(init);
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
