import { NativeImage, WebContentsView } from "electron";
import { CWS_INJECT_SCRIPT } from "./cwsInject";

export type ExtensionInstallHandler = (extensionId: string) => void;
export type InstalledIdsProvider = () => string[];

export class Tab {
  private webContentsView: WebContentsView;
  private _id: string;
  private _title: string;
  private _url: string;
  private _isVisible: boolean = false;
  private onExtensionInstall: ExtensionInstallHandler | null = null;
  private getInstalledIds: InstalledIdsProvider | null = null;

  constructor(id: string, url: string = "https://www.google.com") {
    this._id = id;
    this._url = url;
    this._title = "New Tab";

    // Create the WebContentsView for web content only
    this.webContentsView = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
      },
    });

    // Set up event listeners
    this.setupEventListeners();

    // Load the initial URL
    this.loadURL(url);
  }

  setExtensionInstallHandler(handler: ExtensionInstallHandler): void {
    this.onExtensionInstall = handler;
  }

  setInstalledIdsProvider(provider: InstalledIdsProvider): void {
    this.getInstalledIds = provider;
  }

  private setupEventListeners(): void {
    // Update title when page title changes
    this.webContentsView.webContents.on("page-title-updated", (_, title) => {
      this._title = title;
    });

    // Update URL when navigation occurs
    this.webContentsView.webContents.on("did-navigate", (_, url) => {
      this._url = url;
      console.log("[Tab] did-navigate:", url);
    });

    this.webContentsView.webContents.on("did-navigate-in-page", (_, url) => {
      this._url = url;
      console.log("[Tab] did-navigate-in-page:", url);
      this.injectCWSButtonIfNeeded(url);
    });

    // Inject after page fully loads
    this.webContentsView.webContents.on("did-finish-load", () => {
      const url = this.webContentsView.webContents.getURL();
      console.log("[Tab] did-finish-load:", url);
      this.injectCWSButtonIfNeeded(url);
    });

    // Also try on dom-ready
    this.webContentsView.webContents.on("dom-ready", () => {
      const url = this.webContentsView.webContents.getURL();
      console.log("[Tab] dom-ready:", url);
      this.injectCWSButtonIfNeeded(url);
    });

    // Intercept blueberry-install:// protocol
    this.webContentsView.webContents.on("will-navigate", (event, url) => {
      console.log("[Tab] will-navigate:", url);
      if (url.startsWith("blueberry-install://")) {
        event.preventDefault();
        const extensionId = url
          .replace("blueberry-install://", "")
          .replace("/", "");
        if (extensionId && this.onExtensionInstall) {
          this.onExtensionInstall(extensionId);
        }
      }
    });
  }

  private injectCWSButtonIfNeeded(url: string): void {
    if (url.includes("chromewebstore.google.com")) {
      console.log("[CWS] Injecting install button for:", url);
      const ids = this.getInstalledIds ? this.getInstalledIds() : [];
      const setIds = `window.__blueberryInstalledIds = ${JSON.stringify(ids)}; window.__blueberryInjected = false;`;
      this.webContentsView.webContents
        .executeJavaScript(setIds + CWS_INJECT_SCRIPT)
        .then(() => console.log("[CWS] Injection successful"))
        .catch((err) => console.error("[CWS] Injection failed:", err));
    }
  }

  reinjectCWSButton(): void {
    this.injectCWSButtonIfNeeded(this._url);
  }

  openDevTools(): void {
    this.webContentsView.webContents.openDevTools({ mode: "detach" });
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get title(): string {
    return this._title;
  }

  get url(): string {
    return this._url;
  }

  get isVisible(): boolean {
    return this._isVisible;
  }

  get webContents() {
    return this.webContentsView.webContents;
  }

  get view(): WebContentsView {
    return this.webContentsView;
  }

  // Public methods
  show(): void {
    this._isVisible = true;
    this.webContentsView.setVisible(true);
  }

  hide(): void {
    this._isVisible = false;
    this.webContentsView.setVisible(false);
  }

  async screenshot(): Promise<NativeImage> {
    return await this.webContentsView.webContents.capturePage();
  }

  async runJs(code: string): Promise<any> {
    return await this.webContentsView.webContents.executeJavaScript(code);
  }

  async getTabHtml(): Promise<string> {
    return await this.runJs("return document.documentElement.outerHTML");
  }

  async getTabText(): Promise<string> {
    return await this.runJs("return document.documentElement.innerText");
  }

  loadURL(url: string): Promise<void> {
    this._url = url;
    return this.webContentsView.webContents.loadURL(url);
  }

  goBack(): void {
    if (this.webContentsView.webContents.navigationHistory.canGoBack()) {
      this.webContentsView.webContents.navigationHistory.goBack();
    }
  }

  goForward(): void {
    if (this.webContentsView.webContents.navigationHistory.canGoForward()) {
      this.webContentsView.webContents.navigationHistory.goForward();
    }
  }

  reload(): void {
    this.webContentsView.webContents.reload();
  }

  stop(): void {
    this.webContentsView.webContents.stop();
  }

  destroy(): void {
    this.webContentsView.webContents.close();
  }
}
