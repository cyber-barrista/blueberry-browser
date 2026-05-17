import React, { useState, useEffect } from "react";
import { Power, X, ExternalLink, Puzzle } from "lucide-react";

interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  icons?: Record<string, string>;
  iconDataUrl?: string;
}

export const Extensions: React.FC = () => {
  const [extensions, setExtensions] = useState<ExtensionInfo[]>([]);

  useEffect(() => {
    (window as any).sidebarAPI.listExtensions().then(setExtensions);
    (window as any).sidebarAPI.onExtensionsUpdated((exts: ExtensionInfo[]) => {
      setExtensions(exts);
    });
  }, []);

  const handleToggle = async (id: string) => {
    try {
      await (window as any).sidebarAPI.toggleExtension(id);
    } catch (err) {
      console.error("Failed to toggle extension:", err);
      // Refresh the list to ensure UI is in sync
      const updated = await (window as any).sidebarAPI.listExtensions();
      setExtensions(updated);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await (window as any).sidebarAPI.removeExtension(id);
    } catch (err) {
      console.error("Failed to remove extension:", err);
      // Refresh the list to ensure UI is in sync
      const updated = await (window as any).sidebarAPI.listExtensions();
      setExtensions(updated);
    }
  };

  const handleOpenPopup = async (id: string) => {
    await (window as any).sidebarAPI.openExtensionPopup(id);
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Puzzle className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Extensions</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {extensions.length} installed
        </span>
      </div>

      {/* Hint */}
      <div className="px-4 py-2 border-b border-border bg-muted/30">
        <p className="text-[11px] text-muted-foreground">
          Browse{" "}
          <a
            href="https://chromewebstore.google.com"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-blue-500 hover:underline"
          >
            chromewebstore.google.com
          </a>{" "}
          and click "Add to Blueberry" to install extensions.
        </p>
      </div>

      {/* Extension list */}
      <div className="flex-1 overflow-y-auto">
        {extensions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <Puzzle className="size-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              No extensions installed
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Visit the Chrome Web Store to find extensions
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {extensions.map((ext) => (
              <div
                key={ext.id}
                className="px-4 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors"
              >
                <div className="size-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                  {ext.iconDataUrl ? (
                    <img src={ext.iconDataUrl} className="size-6" alt="" />
                  ) : (
                    <Puzzle className="size-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <a
                    href={`https://chromewebstore.google.com/detail/${ext.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium truncate block hover:underline text-blue-500"
                  >
                    {ext.name}
                  </a>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    v{ext.version}
                  </div>
                  {ext.description && (
                    <div className="text-[11px] text-muted-foreground/70 mt-1 line-clamp-2">
                      {ext.description}
                    </div>
                  )}
                  {/* Actions */}
                  <div className="flex items-center gap-1 mt-2">
                    <button
                      onClick={() => handleOpenPopup(ext.id)}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-muted hover:bg-muted/80 text-foreground transition-colors"
                      title="Open popup"
                    >
                      <ExternalLink className="size-3" />
                      Open
                    </button>
                    <button
                      onClick={() => handleToggle(ext.id)}
                      className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-colors ${
                        ext.enabled
                          ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                      title={ext.enabled ? "Disable" : "Enable"}
                    >
                      <Power className="size-3" />
                      {ext.enabled ? "On" : "Off"}
                    </button>
                    <button
                      onClick={() => handleRemove(ext.id)}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-muted hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Uninstall"
                    >
                      <X className="size-3" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
