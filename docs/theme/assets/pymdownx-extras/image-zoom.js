(function () {
  "use strict";

  const SELECTOR = [
    "article.md-content__inner.md-typeset img:not(.twemoji)",
    ".md-content__inner.md-typeset img:not(.twemoji)"
  ].join(", ");

  const STATE = {
    dialog: null,
    stage: null,
    image: null,
    zoomValue: null,
    sourceLink: null,
    activeImage: null,
    scale: 1,
    minScale: 0.35,
    maxScale: 4,
    fitScale: 1,
    translateX: 0,
    translateY: 0,
    dragPointerId: null,
    dragStartX: 0,
    dragStartY: 0,
    dragOriginX: 0,
    dragOriginY: 0
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getNaturalSize(img) {
    return {
      width: img.naturalWidth || img.width || 1,
      height: img.naturalHeight || img.height || 1
    };
  }

  function getSourceUrl(img) {
    const explicit = img.currentSrc || img.getAttribute("src") || "";
    if (!explicit) return "";
    return new URL(explicit, window.location.href).href;
  }

  function ensureViewer() {
    if (STATE.dialog) return;

    const dialog = document.createElement("dialog");
    dialog.className = "peicd-image-viewer";
    dialog.setAttribute("aria-label", "圖片放大檢視");
    dialog.innerHTML = [
      '<div class="peicd-image-viewer__shell">',
      '  <button class="peicd-image-viewer__close" type="button" aria-label="關閉圖片檢視">×</button>',
      '  <div class="peicd-image-viewer__stage" aria-live="polite">',
      '    <img class="peicd-image-viewer__img" alt="" draggable="false">',
      "  </div>",
      '  <div class="peicd-image-viewer__toolbar" role="toolbar" aria-label="圖片縮放控制">',
      '    <button class="peicd-image-viewer__tool" type="button" data-action="zoom-out" aria-label="縮小">−</button>',
      '    <button class="peicd-image-viewer__tool peicd-image-viewer__zoom-value" type="button" data-action="reset" aria-label="重設縮放">100%</button>',
      '    <button class="peicd-image-viewer__tool" type="button" data-action="zoom-in" aria-label="放大">+</button>',
      '    <a class="peicd-image-viewer__tool peicd-image-viewer__source" href="#" target="_blank" rel="noreferrer noopener" aria-label="在新分頁開啟原圖">↗</a>',
      "  </div>",
      "</div>"
    ].join("");

    document.body.appendChild(dialog);

    STATE.dialog = dialog;
    STATE.stage = dialog.querySelector(".peicd-image-viewer__stage");
    STATE.image = dialog.querySelector(".peicd-image-viewer__img");
    STATE.zoomValue = dialog.querySelector(".peicd-image-viewer__zoom-value");
    STATE.sourceLink = dialog.querySelector(".peicd-image-viewer__source");

    dialog.querySelector(".peicd-image-viewer__close").addEventListener("click", closeViewer);

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog || event.target === STATE.stage) closeViewer();
    });

    dialog.addEventListener("close", resetViewerState);

    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeViewer();
    });

    dialog.querySelectorAll("[data-action]").forEach((control) => {
      control.addEventListener("click", () => {
        const action = control.dataset.action;
        if (action === "zoom-in") zoomAt(1.2);
        else if (action === "zoom-out") zoomAt(1 / 1.2);
        else if (action === "reset") resetZoom(true);
      });
    });

    STATE.stage.addEventListener("wheel", (event) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.14 : 1 / 1.14;
      zoomAt(factor, event.clientX, event.clientY);
    }, { passive: false });

    STATE.image.addEventListener("dblclick", () => {
      if (STATE.scale > STATE.fitScale * 1.2) resetZoom(true);
      else zoomAt(1.9);
    });

    STATE.image.addEventListener("pointerdown", startDrag);
    STATE.image.addEventListener("pointermove", onDrag);
    STATE.image.addEventListener("pointerup", endDrag);
    STATE.image.addEventListener("pointercancel", endDrag);
  }

  function updateTransform() {
    if (!STATE.image) return;
    STATE.image.style.transform = "translate3d(" + STATE.translateX + "px, " + STATE.translateY + "px, 0) scale(" + STATE.scale + ")";
    STATE.image.classList.toggle("is-draggable", STATE.scale > STATE.fitScale * 1.02);
    if (STATE.zoomValue) STATE.zoomValue.textContent = Math.round(STATE.scale * 100) + "%";
  }

  function constrainPan() {
    if (!STATE.stage || !STATE.image) return;

    const stageRect = STATE.stage.getBoundingClientRect();
    const natural = getNaturalSize(STATE.image);
    const renderedWidth = natural.width * STATE.scale;
    const renderedHeight = natural.height * STATE.scale;
    const overflowX = Math.max(0, (renderedWidth - stageRect.width) / 2);
    const overflowY = Math.max(0, (renderedHeight - stageRect.height) / 2);

    STATE.translateX = clamp(STATE.translateX, -overflowX, overflowX);
    STATE.translateY = clamp(STATE.translateY, -overflowY, overflowY);
  }

  function computeFitScale() {
    if (!STATE.stage || !STATE.image) return 1;
    const stageRect = STATE.stage.getBoundingClientRect();
    const natural = getNaturalSize(STATE.image);
    const fitX = (stageRect.width * 0.92) / natural.width;
    const fitY = (stageRect.height * 0.88) / natural.height;
    return clamp(Math.min(fitX, fitY, 1.6), STATE.minScale, 1.6);
  }

  function resetZoom(forceFit) {
    if (!STATE.image) return;
    if (forceFit) STATE.fitScale = computeFitScale();
    STATE.scale = STATE.fitScale;
    STATE.translateX = 0;
    STATE.translateY = 0;
    updateTransform();
  }

  function zoomAt(factor, clientX, clientY) {
    if (!STATE.image || !STATE.stage) return;

    const previousScale = STATE.scale;
    const nextScale = clamp(previousScale * factor, STATE.minScale, STATE.maxScale);
    if (Math.abs(nextScale - previousScale) < 0.001) return;

    const stageRect = STATE.stage.getBoundingClientRect();
    const pointerX = clientX ?? stageRect.left + stageRect.width / 2;
    const pointerY = clientY ?? stageRect.top + stageRect.height / 2;
    const offsetX = pointerX - (stageRect.left + stageRect.width / 2) - STATE.translateX;
    const offsetY = pointerY - (stageRect.top + stageRect.height / 2) - STATE.translateY;
    const ratio = nextScale / previousScale;

    STATE.scale = nextScale;
    STATE.translateX -= offsetX * (ratio - 1);
    STATE.translateY -= offsetY * (ratio - 1);
    constrainPan();
    updateTransform();
  }

  function startDrag(event) {
    if (STATE.scale <= STATE.fitScale * 1.02) return;
    STATE.dragPointerId = event.pointerId;
    STATE.dragStartX = event.clientX;
    STATE.dragStartY = event.clientY;
    STATE.dragOriginX = STATE.translateX;
    STATE.dragOriginY = STATE.translateY;
    STATE.image.setPointerCapture(event.pointerId);
    STATE.image.classList.add("is-dragging");
    event.preventDefault();
  }

  function onDrag(event) {
    if (STATE.dragPointerId !== event.pointerId) return;
    STATE.translateX = STATE.dragOriginX + (event.clientX - STATE.dragStartX);
    STATE.translateY = STATE.dragOriginY + (event.clientY - STATE.dragStartY);
    constrainPan();
    updateTransform();
  }

  function endDrag(event) {
    if (STATE.dragPointerId !== event.pointerId) return;
    try {
      STATE.image.releasePointerCapture(event.pointerId);
    } catch (_) {
      /* noop */
    }
    STATE.dragPointerId = null;
    STATE.image.classList.remove("is-dragging");
  }

  function openViewerForImage(img) {
    const src = getSourceUrl(img);
    if (!src) return;

    ensureViewer();
    STATE.activeImage = img;
    STATE.image.src = src;
    STATE.image.alt = img.getAttribute("alt") || "";
    STATE.sourceLink.href = src;
    STATE.dialog.showModal();
    document.documentElement.classList.add("peicd-image-viewer-open");

    requestAnimationFrame(() => {
      STATE.fitScale = computeFitScale();
      resetZoom(false);
    });
  }

  function closeViewer() {
    if (!STATE.dialog?.open) return;
    STATE.dialog.close();
  }

  function resetViewerState() {
    document.documentElement.classList.remove("peicd-image-viewer-open");
    STATE.activeImage = null;
    STATE.dragPointerId = null;
    STATE.translateX = 0;
    STATE.translateY = 0;
    STATE.scale = 1;
    STATE.fitScale = 1;
    STATE.image?.classList.remove("is-dragging", "is-draggable");
    if (STATE.image) {
      STATE.image.removeAttribute("src");
      STATE.image.style.transform = "";
    }
  }

  function bindImage(img) {
    if (img.dataset.peicdZoomBound === "true") return;
    img.dataset.peicdZoomBound = "true";
    img.classList.add("peicd-zoomable-image");

    img.addEventListener("click", (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openViewerForImage(img);
    });
  }

  function initImageZoom() {
    document.querySelectorAll(SELECTOR).forEach(bindImage);
  }

  window.addEventListener("resize", () => {
    if (!STATE.dialog?.open) return;
    STATE.fitScale = computeFitScale();
    constrainPan();
    updateTransform();
  }, { passive: true });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initImageZoom, { once: true });
  } else {
    initImageZoom();
  }

  if (window.document$?.subscribe) {
    window.document$.subscribe(initImageZoom);
  }
})();
