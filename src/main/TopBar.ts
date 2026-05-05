import { is } from "@electron-toolkit/utils";
import { BaseWindow, WebContentsView } from "electron";
import { join } from "path";

const TOPBAR_HEIGHT = 88;
const TOPBAR_EXPANDED_HEIGHT = 450;

export class TopBar {
  private webContentsView: WebContentsView;
  private baseWindow: BaseWindow;
  private expanded: boolean = false;

  constructor(baseWindow: BaseWindow) {
    this.baseWindow = baseWindow;
    this.webContentsView = this.createWebContentsView();
    baseWindow.contentView.addChildView(this.webContentsView);
    this.setupBounds();
  }

  private createWebContentsView(): WebContentsView {
    const webContentsView = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, "../preload/topbar.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false, // Need to disable sandbox for preload to work
        partition: "persist:ui", // Separate from extension session
      },
    });

    // Load the TopBar React app
    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
      // In development, load through Vite dev server
      const topbarUrl = new URL(
        "/topbar/",
        process.env["ELECTRON_RENDERER_URL"],
      );
      webContentsView.webContents.loadURL(topbarUrl.toString());
    } else {
      webContentsView.webContents.loadFile(
        join(__dirname, "../renderer/topbar.html"),
      );
    }

    return webContentsView;
  }

  private setupBounds(): void {
    const bounds = this.baseWindow.getBounds();
    this.webContentsView.setBounds({
      x: 0,
      y: 0,
      width: bounds.width,
      height: this.expanded ? TOPBAR_EXPANDED_HEIGHT : TOPBAR_HEIGHT,
    });
  }

  setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    this.setupBounds();
    if (expanded) {
      // Bring topbar to front by re-adding it
      this.baseWindow.contentView.removeChildView(this.webContentsView);
      this.baseWindow.contentView.addChildView(this.webContentsView);
    }
  }

  get height(): number {
    return this.expanded ? TOPBAR_EXPANDED_HEIGHT : TOPBAR_HEIGHT;
  }

  updateBounds(): void {
    this.setupBounds();
  }

  get view(): WebContentsView {
    return this.webContentsView;
  }
}
