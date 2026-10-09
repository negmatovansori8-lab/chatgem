"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { VoiceEngine, type VoiceEngineDeps } from "@/features/voice/voice-engine";
import { useVoiceSettings } from "@/features/voice/voice-settings";

export function useVoiceConversation(deps: VoiceEngineDeps) {
  const [engine] = useState(() => new VoiceEngine());
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const settings = useVoiceSettings();

  useEffect(() => {
    engine.setDeps(deps);
  });

  useEffect(() => {
    engine.applySettings(settings);
  }, [engine, settings]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") engine.onHidden();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      engine.end();
    };
  }, [engine]);

  return { engine, snapshot, settings };
}
