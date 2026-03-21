(function () {
  "use strict";

  const BAR_CLASS = "peicd-folder-pathbar";
  const OPEN_CLASS = "is-open";
  let outsideBound = false;

  function isDrawerOpen() {
    const drawer = document.getElementById("__drawer");
    return Boolean(drawer && drawer.checked);
  }

  function getArticleRoot() {
    return document.querySelector("article.md-content__inner.md-typeset")
      || document.querySelector("article.md-content__inner")
      || document.querySelector(".md-content__inner.md-typeset");
  }

  function getTitleElement(root) {
    if (!root) return null;
    return root.querySelector(":scope > h1") || root.querySelector("h1");
  }

  function getActiveSectionLink() {
    return document.querySelector(".md-tabs__item--active > .md-tabs__link")
      || document.querySelector(".md-sidebar--primary li.md-nav__item--section.md-nav__item--active > label.md-nav__link")
      || document.querySelector(".md-sidebar--primary li.md-nav__item--section.md-nav__item--active > a.md-nav__link");
  }

  function getSectionOptions() {
    return Array.from(document.querySelectorAll(".md-tabs__item > .md-tabs__link"))
      .map((link) => ({
        label: normalizeLabel(link.textContent),
        href: link.href,
        current: link.closest(".md-tabs__item")?.classList.contains("md-tabs__item--active") || false
      }))
      .filter((item) => item.label && item.href);
  }

  function getCurrentSectionContainer() {
    return document.querySelector(".md-sidebar--primary li.md-nav__item--section.md-nav__item--active > nav.md-nav[data-md-level=\"1\"]");
  }

  function getPageOptions() {
    const sectionNav = getCurrentSectionContainer();
    if (!sectionNav) return [];

    return Array.from(sectionNav.querySelectorAll(":scope > ul.md-nav__list > li.md-nav__item > a.md-nav__link"))
      .map((link) => ({
        label: normalizeLabel(link.textContent),
        href: link.href,
        current: link.classList.contains("md-nav__link--active")
      }))
      .filter((item) => item.label && item.href);
  }

  function getActivePageLink() {
    return document.querySelector(".md-sidebar--primary nav.md-nav[data-md-level=\"1\"] a.md-nav__link.md-nav__link--active")
      || document.querySelector(".md-sidebar--primary nav.md-nav[data-md-level=\"1\"] li.md-nav__item--active > a.md-nav__link");
  }

  function normalizeLabel(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function closeMenus(except) {
    document.querySelectorAll("." + BAR_CLASS + "__item." + OPEN_CLASS).forEach((item) => {
      if (item === except) return;
      item.classList.remove(OPEN_CLASS);
      const button = item.querySelector("." + BAR_CLASS + "__toggle");
      if (button) button.setAttribute("aria-expanded", "false");
    });
  }

  function bindGlobalClose() {
    if (outsideBound) return;
    outsideBound = true;

    document.addEventListener("mousedown", (event) => {
      const target = event.target;
      if (!(target instanceof Element) || target.closest("." + BAR_CLASS)) return;
      closeMenus(null);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      closeMenus(null);
    });

    document.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.id !== "__drawer") return;
      const bar = document.querySelector("." + BAR_CLASS);
      if (!bar) return;
      bar.classList.toggle(BAR_CLASS + "--hidden", target.checked);
      if (target.checked) closeMenus(null);
    });
  }

  function createMenuItem(option) {
    const link = document.createElement("a");
    link.className = BAR_CLASS + "__option";
    link.href = option.href;
    link.textContent = option.label;
    if (option.current) {
      link.classList.add(BAR_CLASS + "__option--current");
      link.setAttribute("aria-current", "page");
    }
    return link;
  }

  function createMobileSelect(option, options, ariaLabel) {
    const wrapper = document.createElement("div");
    wrapper.className = BAR_CLASS + "__mobile-group";

    const select = document.createElement("select");
    select.className = BAR_CLASS + "__mobile-select";
    select.setAttribute("aria-label", ariaLabel);

    options.forEach((entry) => {
      const optionElement = document.createElement("option");
      optionElement.value = entry.href;
      optionElement.textContent = entry.label;
      optionElement.selected = Boolean(entry.current);
      select.appendChild(optionElement);
    });

    select.value = option.href;
    select.addEventListener("change", () => {
      if (!select.value) return;
      window.location.href = select.value;
    });

    wrapper.appendChild(select);
    return wrapper;
  }

  function createSegment(option, options, ariaLabel) {
    const item = document.createElement("div");
    item.className = BAR_CLASS + "__item";
    if (option.current) item.classList.add(BAR_CLASS + "__item--current");

    const button = document.createElement("button");
    button.type = "button";
    button.className = BAR_CLASS + "__toggle";
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "false");
    button.innerHTML = [
      '<span class="' + BAR_CLASS + '__label"></span>',
      '<span class="' + BAR_CLASS + '__caret" aria-hidden="true">▾</span>'
    ].join("");
    button.querySelector("." + BAR_CLASS + "__label").textContent = option.label;

    const menu = document.createElement("div");
    menu.className = BAR_CLASS + "__menu";
    menu.setAttribute("role", "menu");
    options.forEach((entry) => menu.appendChild(createMenuItem(entry)));

    button.addEventListener("click", () => {
      const nextOpen = !item.classList.contains(OPEN_CLASS);
      closeMenus(item);
      item.classList.toggle(OPEN_CLASS, nextOpen);
      button.setAttribute("aria-expanded", String(nextOpen));
    });

    item.appendChild(button);
    item.appendChild(menu);
    item.appendChild(createMobileSelect(option, options, ariaLabel));
    return item;
  }

  function initFolderPathBar() {
    bindGlobalClose();

    document.querySelectorAll("." + BAR_CLASS).forEach((element) => element.remove());

    const article = getArticleRoot();
    const title = getTitleElement(article);
    if (!article || !title) return;

    const sectionLink = getActiveSectionLink();
    const pageLink = getActivePageLink();
    const sectionOptions = getSectionOptions();
    const pageOptions = getPageOptions();

    if (!sectionLink || !pageLink || sectionOptions.length === 0 || pageOptions.length === 0) return;

    const bar = document.createElement("nav");
    bar.className = BAR_CLASS;
    bar.setAttribute("aria-label", "目前資料夾路徑");
    bar.classList.toggle(BAR_CLASS + "--hidden", isDrawerOpen());

    const prefix = document.createElement("span");
    prefix.className = BAR_CLASS + "__prefix";
    prefix.textContent = "./";
    bar.appendChild(prefix);

    bar.appendChild(createSegment({
      label: normalizeLabel(sectionLink.textContent),
      href: sectionLink.href,
      current: true
    }, sectionOptions, "切換章節路徑"));

    const slash = document.createElement("span");
    slash.className = BAR_CLASS + "__separator";
    slash.textContent = "/";
    bar.appendChild(slash);

    bar.appendChild(createSegment({
      label: normalizeLabel(pageLink.textContent),
      href: pageLink.href,
      current: true
    }, pageOptions, "切換頁面路徑"));

    title.parentNode.insertBefore(bar, title);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFolderPathBar, { once: true });
  } else {
    initFolderPathBar();
  }

  if (window.document$?.subscribe) {
    window.document$.subscribe(initFolderPathBar);
  }
})();
