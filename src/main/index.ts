import { app, BrowserWindow, globalShortcut, protocol, net } from "electron";
import { electronApp } from "@electron-toolkit/utils";
import { Window } from "./Window";
import { AppMenu } from "./Menu";
import { EventManager } from "./EventManager";
import { ExtensionManager } from "./ExtensionManager";
import * as path from "path";

let mainWindow: Window | null = null;
let eventManager: EventManager | null = null;
let menu: AppMenu | null = null;
let extensionManager: ExtensionManager | null = null;

// Register custom protocol scheme as privileged (must be before app ready)
protocol.registerSchemesAsPrivileged([
  {
    scheme: "ext-popup",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

const createWindow = (): Window => {
  // Clean up old handlers before re-registering
  if (eventManager) {
    eventManager.cleanup();
    eventManager = null;
  }

  const window = new Window();
  extensionManager = new ExtensionManager();
  menu = new AppMenu(window);
  eventManager = new EventManager(window, extensionManager);

  // Open links from sidebar in a new tab
  window.sidebar.setNavigateHandler((url) => {
    const tab = window.createTab(url);
    window.switchActiveTab(tab.id);
  });

  // Wire up installed IDs provider for CWS button
  const extMgr = extensionManager;
  window.setInstalledIdsProvider(() => extMgr.list().map((e) => e.id));

  // Wire up CWS install button handler
  window.setExtensionInstallHandler(async (extensionId) => {
    try {
      console.log(`Installing extension from CWS: ${extensionId}`);
      await extMgr.install(extensionId);
      // Notify topbar and sidebar
      window.topBar.view.webContents.send("extensions-updated", extMgr.list());
      window.sidebar.view.webContents.send("extensions-updated", extMgr.list());
      // Update button in the tab to show success
      window.activeTab
        ?.runJs(
          `
        (function() {
          var btn = document.getElementById('__blueberry-install-btn');
          if (btn) {
            while (btn.firstChild) btn.removeChild(btn.firstChild);
            var checkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            checkSvg.setAttribute('width', '16');
            checkSvg.setAttribute('height', '16');
            checkSvg.setAttribute('viewBox', '0 0 24 24');
            checkSvg.setAttribute('fill', 'none');
            checkSvg.setAttribute('stroke', 'currentColor');
            checkSvg.setAttribute('stroke-width', '2');
            checkSvg.style.marginRight = '6px';
            var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M20 6L9 17l-5-5');
            checkSvg.appendChild(path);
            btn.appendChild(checkSvg);
            btn.appendChild(document.createTextNode('Installed'));
            btn.style.background = '#10b981';
            btn.style.boxShadow = '0 4px 12px rgba(16,185,129,0.4)';
            btn.style.opacity = '1';
            btn.style.cursor = 'default';
          }
        })();
      `,
        )
        .catch(function () {});
    } catch (err) {
      console.error(`Failed to install extension ${extensionId}:`, err);
      // Update button to show error
      window.activeTab
        ?.runJs(
          `
        (function() {
          var btn = document.getElementById('__blueberry-install-btn');
          if (btn) {
            while (btn.firstChild) btn.removeChild(btn.firstChild);
            btn.appendChild(document.createTextNode('Failed'));
            btn.style.background = '#ef4444';
            btn.style.boxShadow = '0 4px 12px rgba(239,68,68,0.4)';
            btn.style.opacity = '1';
            btn.style.cursor = 'default';
            btn.disabled = false;
            setTimeout(function() {
              window.__blueberryInjected = false;
              btn.remove();
            }, 2000);
          }
        })();
      `,
        )
        .catch(function () {});
    }
  });

  return window;
};

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.electron");

  // Register custom protocol to serve extension popup files
  protocol.handle("ext-popup", (request) => {
    // URL format: ext-popup://extensionId/path/to/file
    if (!extensionManager) {
      return new Response("Extension manager not ready", { status: 503 });
    }
    const url = new URL(request.url);
    const extensionId = url.hostname;
    const filePath = decodeURIComponent(url.pathname);
    const ext = extensionManager.list().find((e) => e.id === extensionId);
    if (ext) {
      const fullPath = path.join(ext.path, filePath);
      return net.fetch(`file://${fullPath}`);
    }
    return new Response("Not found", { status: 404 });
  });

  mainWindow = createWindow();

  // Load previously installed extensions
  extensionManager?.loadAll();

  // Register devtools shortcut
  globalShortcut.register("CommandOrControl+Shift+I", () => {
    if (mainWindow?.activeTab) {
      mainWindow.activeTab.openDevTools();
    }
  });

  app.on("activate", () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (eventManager) {
    eventManager.cleanup();
    eventManager = null;
  }

  // Clean up references
  if (mainWindow) {
    mainWindow = null;
  }
  if (menu) {
    menu = null;
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});
