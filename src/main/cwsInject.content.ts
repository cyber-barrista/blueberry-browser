/**
 * Content script injected into Chrome Web Store pages.
 * Adds an "Add to Blueberry" button on extension detail pages.
 * Uses DOM APIs instead of innerHTML to comply with Trusted Types CSP.
 *
 * This file is compiled to a JS string at build time via esbuild.
 * Before injection, the caller sets:
 *   window.__blueberryInstalledIds: string[]
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

(function () {
  const w = window as any;
  if (w.__blueberryInjected) return;
  w.__blueberryInjected = true;

  const installedIds: string[] = w.__blueberryInstalledIds || [];
  const BUTTON_ID = "__blueberry-install-btn";

  function getExtensionId(): string | null {
    const match = window.location.pathname.match(
      /\/detail\/[^/]+\/([a-z]{32})/,
    );
    return match ? match[1] : null;
  }

  function createSvgIcon(installing: boolean): SVGSVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.style.marginRight = "6px";

    if (installing) {
      svg.style.animation = "__bb_spin 1s linear infinite";
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      path.setAttribute("d", "M21 12a9 9 0 1 1-6.219-8.56");
      svg.appendChild(path);
    } else {
      const circle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      circle.setAttribute("cx", "12");
      circle.setAttribute("cy", "12");
      circle.setAttribute("r", "10");
      svg.appendChild(circle);
      const path1 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      path1.setAttribute("d", "M12 8v8");
      svg.appendChild(path1);
      const path2 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      path2.setAttribute("d", "M8 12h8");
      svg.appendChild(path2);
    }

    return svg;
  }

  function createCheckIcon(): SVGSVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.style.marginRight = "6px";
    const polyline = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polyline",
    );
    polyline.setAttribute("points", "20 6 9 17 4 12");
    svg.appendChild(polyline);
    return svg;
  }

  function createButton(extensionId: string): void {
    const existing = document.getElementById(BUTTON_ID);
    if (existing) existing.remove();

    const isInstalled = installedIds.indexOf(extensionId) !== -1;

    const btn = document.createElement("button");
    btn.id = BUTTON_ID;

    if (isInstalled) {
      btn.appendChild(createCheckIcon());
      btn.appendChild(document.createTextNode("Installed"));
      btn.style.cssText =
        "position:fixed;top:16px;right:16px;z-index:999999;display:flex;align-items:center;padding:10px 18px;background:#22c55e;color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,sans-serif;cursor:default;box-shadow:0 4px 12px rgba(34,197,94,0.4);";
      (btn as HTMLButtonElement).disabled = true;
    } else {
      btn.appendChild(createSvgIcon(false));
      btn.appendChild(document.createTextNode("Add to Blueberry"));
      btn.style.cssText =
        "position:fixed;top:16px;right:16px;z-index:999999;display:flex;align-items:center;padding:10px 18px;background:#6366f1;color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,sans-serif;cursor:pointer;box-shadow:0 4px 12px rgba(99,102,241,0.4);transition:all 0.2s ease;";

      btn.onmouseenter = function () {
        btn.style.background = "#4f46e5";
        btn.style.transform = "scale(1.02)";
      };
      btn.onmouseleave = function () {
        btn.style.background = "#6366f1";
        btn.style.transform = "scale(1)";
      };

      btn.onclick = function () {
        (btn as HTMLButtonElement).disabled = true;
        while (btn.firstChild) btn.removeChild(btn.firstChild);
        btn.appendChild(createSvgIcon(true));
        btn.appendChild(document.createTextNode("Installing..."));
        btn.style.opacity = "0.8";
        btn.style.cursor = "wait";

        const style = document.createElement("style");
        style.textContent =
          "@keyframes __bb_spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}";
        document.head.appendChild(style);

        window.location.href = "blueberry-install://" + extensionId;
      };
    }

    document.body.appendChild(btn);
  }

  function tryInject(): void {
    const id = getExtensionId();
    if (id) {
      createButton(id);
    } else {
      const existing = document.getElementById(BUTTON_ID);
      if (existing) existing.remove();
    }
  }

  tryInject();

  // Chrome Web Store is a SPA - observe URL changes
  let lastUrl = window.location.href;
  const observer = new MutationObserver(function () {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      setTimeout(tryInject, 500);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
