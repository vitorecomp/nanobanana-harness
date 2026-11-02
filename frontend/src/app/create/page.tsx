"use client";

import React from "react";
import { InteractiveStudio } from "@/features/studio";
import { useStudioSession } from "@/core/context/StudioSessionContext";

export default function CreateStudioPage() {
  const {
    bootstrapData,
    backendOnline,
    apiKey,
    setApiKey,
    rememberKeyInVault,
    setRememberKeyInVault,
    user,
    pendingRemix,
  } = useStudioSession();

  return (
    <InteractiveStudio
      bootstrapData={bootstrapData}
      backendOnline={backendOnline}
      apiKey={apiKey}
      setApiKey={setApiKey}
      rememberKeyInVault={rememberKeyInVault}
      setRememberKeyInVault={setRememberKeyInVault}
      googleUser={user}
      externalPresetRequest={pendingRemix}
    />
  );
}
