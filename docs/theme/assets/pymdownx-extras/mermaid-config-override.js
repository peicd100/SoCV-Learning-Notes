(function () {
  "use strict";

  const schemes = ["default", "slate", "dracula"];

  function ensureSchemeConfig(name) {
    const root = window.mermaidConfig || (window.mermaidConfig = {});
    const current = root[name] || (root[name] = {});
    const flowchart = current.flowchart || (current.flowchart = {});

    root.htmlLabels = true;
    current.htmlLabels = true;
    flowchart.htmlLabels = true;
    if (current.useMaxWidth === undefined) current.useMaxWidth = false;
    if (flowchart.useMaxWidth === undefined) flowchart.useMaxWidth = false;
  }

  schemes.forEach(ensureSchemeConfig);
})();
