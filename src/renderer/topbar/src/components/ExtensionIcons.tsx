import React, { useState } from "react";
import { Puzzle, MessageCircle } from "lucide-react";
import { ToolBarButton } from "./ToolBarButton";

export const ExtensionIcons: React.FC = () => {
  const [extensionsActive, setExtensionsActive] = useState(false);

  const handleToggleExtensionsView = () => {
    const next = !extensionsActive;
    setExtensionsActive(next);
    window.topBarAPI.setSidebarView(next ? "extensions" : "chat");
  };

  return (
    <ToolBarButton
      Icon={extensionsActive ? MessageCircle : Puzzle}
      onClick={handleToggleExtensionsView}
      toggled={extensionsActive}
    />
  );
};
