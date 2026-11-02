"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { InteractiveStudio } from "@/features/studio";
import { useStudioSession } from "@/core/context/StudioSessionContext";

export default function CreateStudioPage() {
  const router = useRouter();
  const {
    bootstrapData,
    backendOnline,
    apiKey,
    setApiKey,
    user,
    logout,
    pendingRemix,
  } = useStudioSession();

  return (
    <InteractiveStudio
      bootstrapData={bootstrapData}
      backendOnline={backendOnline}
      apiKey={apiKey}
      setApiKey={setApiKey}
      googleUser={user}
      onRequestGoogleLogin={() => router.push("/login")}
      onGoogleLogout={logout}
      externalPresetRequest={pendingRemix}
    />
  );
}
