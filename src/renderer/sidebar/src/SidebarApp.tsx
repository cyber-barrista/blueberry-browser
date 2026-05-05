import React, { useEffect, useState } from "react";
import { ChatProvider } from "./contexts/ChatContext";
import { Chat } from "./components/Chat";
import { Extensions } from "./components/Extensions";
import { useDarkMode } from "@common/hooks/useDarkMode";

type SidebarView = "chat" | "extensions";

const SidebarContent: React.FC = () => {
  const { isDarkMode } = useDarkMode();
  const [view, setView] = useState<SidebarView>("chat");

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  useEffect(() => {
    (window as any).sidebarAPI.onSetView((v: string) => {
      setView(v as SidebarView);
    });
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background border-l border-border">
      {view === "chat" ? <Chat /> : <Extensions />}
    </div>
  );
};

export const SidebarApp: React.FC = () => {
  return (
    <ChatProvider>
      <SidebarContent />
    </ChatProvider>
  );
};
