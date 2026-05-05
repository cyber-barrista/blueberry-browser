import { ElectronAPI } from "@electron-toolkit/preload";

interface TabInfo {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
}

interface TopBarAPI {
  // Tab management
  createTab: (
    url?: string,
  ) => Promise<{ id: string; title: string; url: string } | null>;
  closeTab: (tabId: string) => Promise<boolean>;
  switchTab: (tabId: string) => Promise<boolean>;
  getTabs: () => Promise<TabInfo[]>;

  // Tab navigation
  navigateTab: (tabId: string, url: string) => Promise<void>;
  goBack: (tabId: string) => Promise<void>;
  goForward: (tabId: string) => Promise<void>;
  reload: (tabId: string) => Promise<void>;

  // Tab actions
  tabScreenshot: (tabId: string) => Promise<string | null>;
  tabRunJs: (tabId: string, code: string) => Promise<any>;

  // Sidebar
  toggleSidebar: () => Promise<void>;
  setSidebarView: (view: string) => Promise<boolean>;

  // Extensions
  listExtensions: () => Promise<any[]>;
  openExtensionPopup: (extensionId: string) => Promise<boolean>;
  onExtensionsUpdated: (callback: (extensions: any[]) => void) => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    topBarAPI: TopBarAPI;
  }
}

interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  path: string;
  icons?: Record<string, string>;
}

interface ExtensionInstallResult {
  success: boolean;
  extension?: ExtensionInfo;
  error?: string;
}

interface TopBarAPI {
  // Tab management
  createTab: (
    url?: string,
  ) => Promise<{ id: string; title: string; url: string } | null>;
  closeTab: (tabId: string) => Promise<boolean>;
  switchTab: (tabId: string) => Promise<boolean>;
  getTabs: () => Promise<TabInfo[]>;

  // Tab navigation
  navigateTab: (tabId: string, url: string) => Promise<void>;
  goBack: (tabId: string) => Promise<void>;
  goForward: (tabId: string) => Promise<void>;
  reload: (tabId: string) => Promise<void>;

  // Tab actions
  tabScreenshot: (tabId: string) => Promise<string | null>;
  tabRunJs: (tabId: string, code: string) => Promise<any>;

  // Sidebar
  toggleSidebar: () => Promise<void>;

  // Topbar expansion
  setExpanded: (expanded: boolean) => Promise<boolean>;

  // Extensions
  installExtension: (extensionId: string) => Promise<ExtensionInstallResult>;
  listExtensions: () => Promise<ExtensionInfo[]>;
  removeExtension: (extensionId: string) => Promise<boolean>;
  toggleExtension: (extensionId: string) => Promise<boolean>;
  onExtensionsUpdated: (
    callback: (extensions: ExtensionInfo[]) => void,
  ) => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    topBarAPI: TopBarAPI;
  }
}
