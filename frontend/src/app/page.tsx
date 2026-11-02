"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  HeroSection,
  InteractiveWalkthrough,
  PrivacyAndFaqSection,
} from "@/features/landing";
import { useStudioSession } from "@/core/context/StudioSessionContext";

export default function HomePage() {
  const router = useRouter();
  const { bootstrapData, hasKeyInRam, setPendingRemix } = useStudioSession();

  const handleExploreGallery = () => {
    router.push("/gallery");
  };

  const handleOpenStudio = (presetIdea?: string) => {
    if (presetIdea) {
      setPendingRemix({
        idea: presetIdea,
        nonce: Date.now(),
      });
    }
    router.push("/create");
  };

  const handleLoadWalkthroughStepIntoStudio = (stepData: {
    turn: number;
    idea: string;
    prompt: string;
    imageUrl: string;
  }) => {
    setPendingRemix({
      idea: stepData.idea,
      prompt: stepData.prompt,
      imageUrl: stepData.imageUrl,
      turn: stepData.turn,
      nonce: Date.now(),
    });
    router.push("/create");
  };

  return (
    <>
      <HeroSection
        onExploreGallery={handleExploreGallery}
        onOpenStudio={handleOpenStudio}
      />

      <InteractiveWalkthrough
        steps={bootstrapData.interactive_workflow_steps}
        onLoadStepIntoStudio={handleLoadWalkthroughStepIntoStudio}
        onExploreGallery={handleExploreGallery}
      />

      <PrivacyAndFaqSection hasKeyInRam={hasKeyInRam} />
    </>
  );
}
