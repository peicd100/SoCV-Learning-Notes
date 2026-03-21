(function () {
  "use strict";

  const SELECTOR = ".peicd-mermaid-host";

  const STATE = {
    dialog: null,
    stage: null,
    zoomValue: null,
    activeHost: null,
    media: null,
    placeholder: null,
    savedInlineStyles: null,
    baseWidth: 1,
    baseHeight: 1,
    scale: 1,
    minScale: 0.35,
    maxScale: 5,
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

  function parseLength(value) {
    if (!value) return 0;
    const numeric = Number.parseFloat(String(value));
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function getSvgSize(svg) {
    const viewBox = svg.viewBox?.baseVal;
    if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
      return { width: viewBox.width, height: viewBox.height };
    }

    const widthAttr = parseLength(svg.getAttribute("width"));
    const heightAttr = parseLength(svg.getAttribute("height"));
    if (widthAttr > 0 && heightAttr > 0) {
      return { width: widthAttr, height: heightAttr };
    }

    const rect = svg.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return { width: rect.width, height: rect.height };
    }

    return { width: 960, height: 720 };
  }

  function ensureViewer() {
    if (STATE.dialog) return;

    const dialog = document.createElement("dialog");
    dialog.className = "peicd-image-viewer peicd-mermaid-viewer";
    dialog.setAttribute("aria-label", "Mermaid 圖表放大檢視");
    dialog.innerHTML = [
      '<div class="peicd-image-viewer__shell">',
      '  <button class="peicd-image-viewer__close" type="button" aria-label="關閉 Mermaid 圖表檢視">×</button>',
      '  <div class="peicd-image-viewer__stage" aria-live="polite"></div>',
      '  <div class="peicd-image-viewer__toolbar" role="toolbar" aria-label="Mermaid 圖表縮放控制">',
      '    <button class="peicd-image-viewer__tool" type="button" data-action="zoom-out" aria-label="縮小">−</button>',
      '    <button class="peicd-image-viewer__tool peicd-image-viewer__zoom-value" type="button" data-action="reset" aria-label="重設縮放">100%</button>',
      '    <button class="peicd-image-viewer__tool" type="button" data-action="zoom-in" aria-label="放大">+</button>',
      "  </div>",
      "</div>"
    ].join("");

    document.body.appendChild(dialog);

    STATE.dialog = dialog;
    STATE.stage = dialog.querySelector(".peicd-image-viewer__stage");
    STATE.zoomValue = dialog.querySelector(".peicd-image-viewer__zoom-value");

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
      if (!STATE.media) return;
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.14 : 1 / 1.14;
      zoomAt(factor, event.clientX, event.clientY);
    }, { passive: false });
  }

  function bindMediaEvents() {
    if (!STATE.media) return;
    STATE.media.addEventListener("dblclick", onMediaDoubleClick);
    STATE.media.addEventListener("pointerdown", startDrag);
    STATE.media.addEventListener("pointermove", onDrag);
    STATE.media.addEventListener("pointerup", endDrag);
    STATE.media.addEventListener("pointercancel", endDrag);
  }

  function unbindMediaEvents() {
    if (!STATE.media) return;
    STATE.media.removeEventListener("dblclick", onMediaDoubleClick);
    STATE.media.removeEventListener("pointerdown", startDrag);
    STATE.media.removeEventListener("pointermove", onDrag);
    STATE.media.removeEventListener("pointerup", endDrag);
    STATE.media.removeEventListener("pointercancel", endDrag);
  }

  function updateTransform() {
    if (!STATE.media) return;
    STATE.media.style.transform = "translate3d(" + STATE.translateX + "px, " + STATE.translateY + "px, 0) scale(" + STATE.scale + ")";
    STATE.media.classList.toggle("is-draggable", STATE.scale > STATE.fitScale * 1.02);
    if (STATE.zoomValue) STATE.zoomValue.textContent = Math.round(STATE.scale * 100) + "%";
  }

  function constrainPan() {
    if (!STATE.stage || !STATE.media) return;

    const stageRect = STATE.stage.getBoundingClientRect();
    const renderedWidth = STATE.baseWidth * STATE.scale;
    const renderedHeight = STATE.baseHeight * STATE.scale;
    const overflowX = Math.max(0, (renderedWidth - stageRect.width) / 2);
    const overflowY = Math.max(0, (renderedHeight - stageRect.height) / 2);

    STATE.translateX = clamp(STATE.translateX, -overflowX, overflowX);
    STATE.translateY = clamp(STATE.translateY, -overflowY, overflowY);
  }

  function computeFitScale() {
    if (!STATE.stage || !STATE.media) return 1;
    const stageRect = STATE.stage.getBoundingClientRect();
    const fitX = (stageRect.width * 0.92) / STATE.baseWidth;
    const fitY = (stageRect.height * 0.88) / STATE.baseHeight;
    return clamp(Math.min(fitX, fitY, 1.6), STATE.minScale, 1.6);
  }

  function resetZoom(forceFit) {
    if (!STATE.media) return;
    if (forceFit) STATE.fitScale = computeFitScale();
    STATE.scale = STATE.fitScale;
    STATE.translateX = 0;
    STATE.translateY = 0;
    updateTransform();
  }

  function zoomAt(factor, clientX, clientY) {
    if (!STATE.media || !STATE.stage) return;

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

  function onMediaDoubleClick() {
    if (STATE.scale > STATE.fitScale * 1.2) resetZoom(true);
    else zoomAt(1.9);
  }

  function startDrag(event) {
    if (!STATE.media || STATE.scale <= STATE.fitScale * 1.02) return;
    STATE.dragPointerId = event.pointerId;
    STATE.dragStartX = event.clientX;
    STATE.dragStartY = event.clientY;
    STATE.dragOriginX = STATE.translateX;
    STATE.dragOriginY = STATE.translateY;
    STATE.media.setPointerCapture(event.pointerId);
    STATE.media.classList.add("is-dragging");
    event.preventDefault();
  }

  function onDrag(event) {
    if (!STATE.media || STATE.dragPointerId !== event.pointerId) return;
    STATE.translateX = STATE.dragOriginX + (event.clientX - STATE.dragStartX);
    STATE.translateY = STATE.dragOriginY + (event.clientY - STATE.dragStartY);
    constrainPan();
    updateTransform();
  }

  function endDrag(event) {
    if (!STATE.media || STATE.dragPointerId !== event.pointerId) return;
    try {
      STATE.media.releasePointerCapture(event.pointerId);
    } catch (_) {
      /* noop */
    }
    STATE.dragPointerId = null;
    STATE.media.classList.remove("is-dragging");
  }

  function openViewerForHost(host) {
    const sourceSvg = host.querySelector("svg");
    if (!sourceSvg) return;

    if (STATE.dialog?.open) {
      closeViewer();
    }

    ensureViewer();

    STATE.activeHost = host;
    STATE.placeholder = document.createComment("peicd-mermaid-placeholder");
    sourceSvg.parentNode.insertBefore(STATE.placeholder, sourceSvg);

    STATE.media = sourceSvg;
    STATE.savedInlineStyles = {
      width: sourceSvg.style.width,
      height: sourceSvg.style.height,
      maxWidth: sourceSvg.style.maxWidth,
      maxHeight: sourceSvg.style.maxHeight,
      transform: sourceSvg.style.transform,
      transformOrigin: sourceSvg.style.transformOrigin,
      touchAction: sourceSvg.style.touchAction,
      userSelect: sourceSvg.style.userSelect,
      willChange: sourceSvg.style.willChange
    };

    const size = getSvgSize(sourceSvg);
    STATE.baseWidth = Math.max(size.width, 1);
    STATE.baseHeight = Math.max(size.height, 1);

    sourceSvg.classList.add("peicd-image-viewer__img", "peicd-mermaid-viewer__svg");
    sourceSvg.style.width = STATE.baseWidth + "px";
    sourceSvg.style.height = STATE.baseHeight + "px";
    sourceSvg.style.maxWidth = "none";
    sourceSvg.style.maxHeight = "none";
    sourceSvg.style.transformOrigin = "center center";
    sourceSvg.style.touchAction = "none";
    sourceSvg.style.userSelect = "none";
    sourceSvg.style.willChange = "transform";
    if (!sourceSvg.getAttribute("preserveAspectRatio")) {
      sourceSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    }

    STATE.stage.appendChild(sourceSvg);
    bindMediaEvents();

    STATE.dialog.showModal();
    document.documentElement.classList.add("peicd-image-viewer-open", "peicd-mermaid-viewer-open");

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
    document.documentElement.classList.remove("peicd-image-viewer-open", "peicd-mermaid-viewer-open");

    if (STATE.media) {
      unbindMediaEvents();
      STATE.media.classList.remove("peicd-image-viewer__img", "peicd-mermaid-viewer__svg", "is-dragging", "is-draggable");
      STATE.media.style.width = STATE.savedInlineStyles?.width || "";
      STATE.media.style.height = STATE.savedInlineStyles?.height || "";
      STATE.media.style.maxWidth = STATE.savedInlineStyles?.maxWidth || "";
      STATE.media.style.maxHeight = STATE.savedInlineStyles?.maxHeight || "";
      STATE.media.style.transform = STATE.savedInlineStyles?.transform || "";
      STATE.media.style.transformOrigin = STATE.savedInlineStyles?.transformOrigin || "";
      STATE.media.style.touchAction = STATE.savedInlineStyles?.touchAction || "";
      STATE.media.style.userSelect = STATE.savedInlineStyles?.userSelect || "";
      STATE.media.style.willChange = STATE.savedInlineStyles?.willChange || "";

      if (STATE.placeholder?.parentNode) {
        STATE.placeholder.replaceWith(STATE.media);
      }
    }

    STATE.activeHost = null;
    STATE.media = null;
    STATE.placeholder = null;
    STATE.savedInlineStyles = null;
    STATE.dragPointerId = null;
    STATE.translateX = 0;
    STATE.translateY = 0;
    STATE.scale = 1;
    STATE.fitScale = 1;
    STATE.baseWidth = 1;
    STATE.baseHeight = 1;
  }

  function bindHost(host) {
    if (host.dataset.peicdMermaidZoomBound === "true") return;
    host.dataset.peicdMermaidZoomBound = "true";

    host.addEventListener("click", (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openViewerForHost(host);
    });

    host.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openViewerForHost(host);
    });
  }

  function initMermaidZoom() {
    document.querySelectorAll(SELECTOR).forEach(bindHost);
  }

  window.addEventListener("resize", () => {
    if (!STATE.dialog?.open) return;
    STATE.fitScale = computeFitScale();
    constrainPan();
    updateTransform();
  }, { passive: true });

  window.addEventListener("peicd:mermaid-updated", initMermaidZoom);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMermaidZoom, { once: true });
  } else {
    initMermaidZoom();
  }

  if (window.document$?.subscribe) {
    window.document$.subscribe(initMermaidZoom);
  }
})();
