import { session } from "electron";
import * as path from "path";
import * as fs from "fs";
import {
  downloadAndUnpackExtension,
  getExtensionsDir,
  readManifest,
} from "./crx";

export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  path: string;
  icons?: Record<string, string>;
  popupUrl?: string;
  iconDataUrl?: string;
}

const METADATA_FILE = "extensions.json";

export class ExtensionManager {
  private extensions: Map<string, ExtensionInfo> = new Map();
  private metadataPath: string;

  constructor() {
    this.metadataPath = path.join(getExtensionsDir(), METADATA_FILE);
    this.loadMetadata();
  }

  /**
   * Load all previously installed extensions on startup
   */
  async loadAll(): Promise<void> {
    const extensionIds = Array.from(this.extensions.keys());
    for (const id of extensionIds) {
      const info = this.extensions.get(id)!;
      if (info.enabled) {
        try {
          await session.defaultSession.extensions.loadExtension(info.path, {
            allowFileAccess: true,
          });
          console.log(`Loaded extension: ${info.name} (${id})`);
        } catch (err) {
          console.error(`Failed to load extension ${id}:`, err);
        }
      }
    }
  }

  /**
   * Install an extension by its Chrome Web Store ID
   */
  async install(extensionId: string): Promise<ExtensionInfo> {
    // Validate ID format
    if (!/^[a-z]{32}$/.test(extensionId)) {
      throw new Error(
        `Invalid extension ID: "${extensionId}". Must be 32 lowercase letters.`,
      );
    }

    // Download and unpack
    const extensionDir = await downloadAndUnpackExtension(extensionId);

    // Read manifest
    const manifest = readManifest(extensionDir);
    if (!manifest) {
      throw new Error("Extension has no manifest.json");
    }

    // Load into Electron session
    const loaded = await session.defaultSession.extensions.loadExtension(extensionDir, {
      allowFileAccess: true,
    });

    // Use the actual loaded extension ID as the canonical ID
    const actualExtensionId = loaded.id;

    // Determine popup URL
    const popupPath =
      manifest.action?.default_popup ||
      manifest.browser_action?.default_popup ||
      null;
    const popupUrl = popupPath
      ? `chrome-extension://${actualExtensionId}/${popupPath}`
      : undefined;

    // Build extension info
    const info: ExtensionInfo = {
      id: actualExtensionId,
      name:
        this.resolveI18n(manifest.name, extensionDir) ||
        loaded.name ||
        "Unknown",
      version: manifest.version || "0.0.0",
      description: this.resolveI18n(manifest.description, extensionDir) || "",
      enabled: true,
      path: extensionDir,
      icons: manifest.icons,
      popupUrl,
    };

     // Save metadata using the actual extension ID
    this.extensions.set(actualExtensionId, info);
    this.saveMetadata();

    return info;
  }

  /**
   * Remove an installed extension
   */
  async remove(extensionId: string): Promise<boolean> {
    const info = this.extensions.get(extensionId);
    if (!info) return false;

    // Unload from session
    try {
      await session.defaultSession.extensions.removeExtension(extensionId);
    } catch (err) {
      console.error(`[Extensions] Failed to unload extension ${extensionId} during removal:`, err);
    }

    // Delete files
    if (fs.existsSync(info.path)) {
      fs.rmSync(info.path, { recursive: true });
    }

    // Remove from metadata
    this.extensions.delete(extensionId);
    this.saveMetadata();

    return true;
  }

  /**
   * List all installed extensions
   */
  list(): ExtensionInfo[] {
    return Array.from(this.extensions.values()).map((ext) => ({
      ...ext,
      iconDataUrl: this.getIconDataUrl(ext),
    }));
  }

  /**
   * Toggle extension enabled state
   */
  async toggle(extensionId: string): Promise<boolean> {
    const info = this.extensions.get(extensionId);
    if (!info) return false;

    if (info.enabled) {
      // Disable
      try {
        await session.defaultSession.extensions.removeExtension(extensionId);
      } catch (err) {
        console.error(`[Extensions] Failed to unload extension ${extensionId}:`, err);
      }
      info.enabled = false;
    } else {
      // Enable
      try {
        await session.defaultSession.extensions.loadExtension(info.path, {
          allowFileAccess: true,
        });
        info.enabled = true;
      } catch (err) {
        console.error(`[Extensions] Failed to load extension ${extensionId}:`, err);
        info.enabled = false;
      }
    }

    this.saveMetadata();
    return info.enabled;
  }

  private loadMetadata(): void {
    try {
      if (fs.existsSync(this.metadataPath)) {
        const data = JSON.parse(fs.readFileSync(this.metadataPath, "utf-8"));
        for (const ext of data) {
          this.extensions.set(ext.id, ext);
        }
      }
    } catch (err) {
      console.error("Failed to load extension metadata:", err);
    }
  }

  private saveMetadata(): void {
    try {
      const data = Array.from(this.extensions.values());
      fs.writeFileSync(this.metadataPath, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("Failed to save extension metadata:", err);
    }
  }

  private resolveI18n(
    value: string | undefined,
    extensionDir: string,
  ): string | undefined {
    if (!value) return value;
    const match = value.match(/^__MSG_(\w+)__$/);
    if (!match) return value;
    const key = match[1];
    try {
      const messagesPath = path.join(
        extensionDir,
        "_locales",
        "en",
        "messages.json",
      );
      const messages = JSON.parse(fs.readFileSync(messagesPath, "utf-8"));
      return messages[key]?.message || value;
    } catch {
      return value;
    }
  }

  private getIconDataUrl(ext: ExtensionInfo): string | undefined {
    if (!ext.icons) return undefined;
    // Prefer 48px, then 128px, then any
    const iconPath =
      ext.icons["48"] ||
      ext.icons["128"] ||
      ext.icons["16"] ||
      Object.values(ext.icons)[0];
    if (!iconPath) return undefined;
    try {
      const fullPath = path.join(ext.path, iconPath);
      const data = fs.readFileSync(fullPath);
      const ext2 = iconPath.endsWith(".svg") ? "svg+xml" : "png";
      return `data:image/${ext2};base64,${data.toString("base64")}`;
    } catch {
      return undefined;
    }
  }
}
