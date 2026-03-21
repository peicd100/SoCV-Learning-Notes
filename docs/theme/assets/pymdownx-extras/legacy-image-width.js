(function () {
  "use strict";

  function applyLegacyImageWidth() {
    document.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src") || "";
      const match = src.match(/=(\d+)%x$/);
      if (!match) return;

      img.style.width = match[1] + "%";
      img.style.height = "auto";
      img.setAttribute("src", src.replace(/=(\d+)%x$/, ""));
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyLegacyImageWidth, { once: true });
  } else {
    applyLegacyImageWidth();
  }

  if (window.document$?.subscribe) {
    window.document$.subscribe(applyLegacyImageWidth);
  }
})();
