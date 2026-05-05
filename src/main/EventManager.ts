import { ipcMain, WebContents, BrowserWindow } from "electron";
import type { Window } from "./Window";
import type { ExtensionManager } from "./ExtensionManager";

export class EventManager {
  private mainWindow: Window;
  private extensionManager: ExtensionManager;

  constructor(mainWindow: Window, extensionManager: ExtensionManager) {
    this.mainWindow = mainWindow;
    this.extensionManager = extensionManager;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.handleTabEvents();
    this.handleSidebarEvents();
    this.handlePageContentEvents();
    this.handleDarkModeEvents();
    this.handleExtensionEvents();
    this.handleDebugEvents();
  }

  private handleTabEvents(): void {
    ipcMain.handle("create-tab", (_, url?: string) => {
      const newTab = this.mainWindow.createTab(url);
      return { id: newTab.id, title: newTab.title, url: newTab.url };
    });

    ipcMain.handle("close-tab", (_, id: string) => {
      this.mainWindow.closeTab(id);
    });

    ipcMain.handle("switch-tab", (_, id: string) => {
      this.mainWindow.switchActiveTab(id);
    });

    ipcMain.handle("get-tabs", () => {
      const activeTabId = this.mainWindow.activeTab?.id;
      return this.mainWindow.allTabs.map((tab) => ({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        isActive: activeTabId === tab.id,
      }));
    });

    ipcMain.handle("navigate-to", (_, url: string) => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.loadURL(url);
      }
    });

    ipcMain.handle("navigate-tab", async (_, tabId: string, url: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        await tab.loadURL(url);
        return true;
      }
      return false;
    });

    ipcMain.handle("go-back", () => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.goBack();
      }
    });

    ipcMain.handle("go-forward", () => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.goForward();
      }
    });

    ipcMain.handle("reload", () => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.reload();
      }
    });

    ipcMain.handle("tab-go-back", (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        tab.goBack();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-go-forward", (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        tab.goForward();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-reload", (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        tab.reload();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-screenshot", async (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        const image = await tab.screenshot();
        return image.toDataURL();
      }
      return null;
    });

    ipcMain.handle("tab-run-js", async (_, tabId: string, code: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        return await tab.runJs(code);
      }
      return null;
    });

    ipcMain.handle("get-active-tab-info", () => {
      const activeTab = this.mainWindow.activeTab;
      if (activeTab) {
        return {
          id: activeTab.id,
          url: activeTab.url,
          title: activeTab.title,
          canGoBack: activeTab.webContents.canGoBack(),
          canGoForward: activeTab.webContents.canGoForward(),
        };
      }
      return null;
    });
  }

  private handleSidebarEvents(): void {
    ipcMain.handle("toggle-sidebar", () => {
      this.mainWindow.sidebar.toggle();
      this.mainWindow.updateAllBounds();
      return true;
    });

    ipcMain.handle("sidebar:set-view", (_, view: string) => {
      this.mainWindow.sidebar.view.webContents.send("sidebar-set-view", view);
      return true;
    });

    ipcMain.handle("sidebar-chat-message", async (_, request) => {
      await this.mainWindow.sidebar.client.sendChatMessage(request);
    });

    ipcMain.handle("sidebar-clear-chat", () => {
      this.mainWindow.sidebar.client.clearMessages();
      return true;
    });

    ipcMain.handle("sidebar-get-messages", () => {
      return this.mainWindow.sidebar.client.getMessages();
    });
  }

  private handlePageContentEvents(): void {
    ipcMain.handle("get-page-content", async () => {
      if (this.mainWindow.activeTab) {
        try {
          return await this.mainWindow.activeTab.getTabHtml();
        } catch (error) {
          console.error("Error getting page content:", error);
          return null;
        }
      }
      return null;
    });

    ipcMain.handle("get-page-text", async () => {
      if (this.mainWindow.activeTab) {
        try {
          return await this.mainWindow.activeTab.getTabText();
        } catch (error) {
          console.error("Error getting page text:", error);
          return null;
        }
      }
      return null;
    });

    ipcMain.handle("get-current-url", () => {
      if (this.mainWindow.activeTab) {
        return this.mainWindow.activeTab.url;
      }
      return null;
    });
  }

  private handleDarkModeEvents(): void {
    ipcMain.on("dark-mode-changed", (event, isDarkMode) => {
      this.broadcastDarkMode(event.sender, isDarkMode);
    });
  }

  private handleDebugEvents(): void {
    ipcMain.on("ping", () => console.log("pong"));

    ipcMain.handle("open-devtools", () => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.openDevTools();
      }
    });
  }

  private handleExtensionEvents(): void {
    ipcMain.handle("extensions:install", async (_, extensionId: string) => {
      try {
        const info = await this.extensionManager.install(extensionId);
        this.notifyExtensionsUpdated();
        return { success: true, extension: info };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("extensions:list", () => {
      return this.extensionManager.list();
    });

    ipcMain.handle("extensions:remove", async (_, extensionId: string) => {
      const removed = await this.extensionManager.remove(extensionId);
      if (removed) {
        this.notifyExtensionsUpdated();
      }
      return removed;
    });

    ipcMain.handle("extensions:toggle", async (_, extensionId: string) => {
      const enabled = await this.extensionManager.toggle(extensionId);
      this.notifyExtensionsUpdated();
      return enabled;
    });

    // Use ipcMain.on + sendSync to avoid Electron extension system intercepting handle/invoke
    ipcMain.on("extensions:open-popup", (event, extensionId: string) => {
      console.log("[Extensions] Opening popup for:", extensionId);
      const ext = this.extensionManager
        .list()
        .find((e) => e.id === extensionId);
      if (ext && ext.popupUrl) {
        // Convert chrome-extension://id/path to ext-popup://id/path
        const popupRelPath = ext.popupUrl.replace(
          `chrome-extension://${extensionId}/`,
          "",
        );
        const popupUrl = `ext-popup://${extensionId}/${popupRelPath}`;
        const popupWin = new BrowserWindow({
          width: 400,
          height: 600,
          frame: true,
          resizable: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webSecurity: false,
          },
        });
        popupWin.loadURL(popupUrl);
        event.returnValue = true;
      } else {
        event.returnValue = false;
      }
    });
  }

  private notifyExtensionsUpdated(): void {
    const list = this.extensionManager.list();
    this.mainWindow.topBar.view.webContents.send("extensions-updated", list);
    this.mainWindow.sidebar.view.webContents.send("extensions-updated", list);
    // Re-inject CWS buttons on tabs showing Chrome Web Store
    this.mainWindow.allTabs.forEach((tab) => {
      tab.reinjectCWSButton();
    });
  }

  private broadcastDarkMode(sender: WebContents, isDarkMode: boolean): void {
    if (this.mainWindow.topBar.view.webContents !== sender) {
      this.mainWindow.topBar.view.webContents.send(
        "dark-mode-updated",
        isDarkMode,
      );
    }

    if (this.mainWindow.sidebar.view.webContents !== sender) {
      this.mainWindow.sidebar.view.webContents.send(
        "dark-mode-updated",
        isDarkMode,
      );
    }

    this.mainWindow.allTabs.forEach((tab) => {
      if (tab.webContents !== sender) {
        tab.webContents.send("dark-mode-updated", isDarkMode);
      }
    });
  }

  public cleanup(): void {
    ipcMain.removeAllListeners();
    const channels = [
      "create-tab",
      "close-tab",
      "switch-tab",
      "get-tabs",
      "navigate-to",
      "navigate-tab",
      "go-back",
      "go-forward",
      "reload",
      "tab-go-back",
      "tab-go-forward",
      "tab-reload",
      "tab-screenshot",
      "tab-run-js",
      "get-active-tab-info",
      "toggle-sidebar",
      "sidebar:set-view",
      "sidebar-chat-message",
      "sidebar-clear-chat",
      "sidebar-get-messages",
      "get-page-content",
      "get-page-text",
      "get-current-url",
      "extensions:install",
      "extensions:list",
      "extensions:remove",
      "extensions:toggle",
      "open-devtools",
    ];
    for (const ch of channels) {
      try {
        ipcMain.removeHandler(ch);
      } catch {}
    }
  }
}
