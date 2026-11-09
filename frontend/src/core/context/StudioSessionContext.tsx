"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  GoogleUserProfile,
  IS_AUTH_REQUIRED,
  LOCAL_DEV_USER,
} from "@/features/auth";
import {
  BootstrapResponse,
  DEFAULT_BOOTSTRAP_DATA,
  DEFAULT_ENHANCE_SYSTEM_PROMPT,
  DEFAULT_VARIATION_SYSTEM_PROMPT,
  ModifierCategory,
  fetchBootstrap,
} from "@/features/studio";
import {
  DEFAULT_HARNESS_CRITIC_PROMPT,
  DEFAULT_HARNESS_PLANNER_PROMPT,
  DEFAULT_HARNESS_REFINER_PROMPT,
} from "@/features/harness";
import { createConversation } from "@/features/history";
import {
  vaultClearApiKey,
  vaultGetAiPrompts,
  vaultGetImagesOutputDir,
  vaultGetModifierCategories,
  vaultGetSavedApiKey,
  vaultSaveApiKey,
  vaultSetAiPrompts,
  vaultSetImagesOutputDir,
  vaultSetModifierCategories,
} from "@/core/tauri/tauriBridge";

export interface RemixPresetRequest {
  idea: string;
  prompt?: string;
  imageUrl?: string;
  conversationId?: string;
  turn?: number;
  nonce: number;
}

interface StudioSessionContextValue {
  /** Hybrid Gemini API Key: Volatile RAM-only by default, or persisted in Local App Vault when `rememberKeyInVault` is true */
  apiKey: string;
  setApiKey: (key: string) => void;
  rememberKeyInVault: boolean;
  setRememberKeyInVault: (remember: boolean) => void;
  hasKeyInRam: boolean;
  imagesOutputDir: string;
  setImagesOutputDir: (dirPath: string) => Promise<string>;
  user: GoogleUserProfile | null;
  isAuthenticated: boolean;
  setUser: (user: GoogleUserProfile | null) => void;
  logout: () => void;
  bootstrapData: BootstrapResponse;
  backendOnline: boolean;
  setBackendOnline: (online: boolean) => void;
  pendingRemix: RemixPresetRequest | null;
  setPendingRemix: (remix: RemixPresetRequest | null) => void;
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  activeProjectTitle: string;
  setActiveProjectTitle: (title: string) => void;
  activeHarnessMissionId: string | null;
  setActiveHarnessMissionId: (id: string | null) => void;
  newProjectNonce: number;
  triggerNewProject: (customTitle?: string) => Promise<string | null>;
  updateModifierCategories: (categories: ModifierCategory[]) => Promise<void>;
  resetModifierCategories: () => Promise<void>;
  enhanceSystemPrompt: string;
  variationSystemPrompt: string;
  harnessPlannerPrompt: string;
  harnessCriticPrompt: string;
  harnessRefinerPrompt: string;
  saveAiSystemPrompts: (params: {
    enhanceSystemPrompt: string;
    variationSystemPrompt: string;
    harnessPlannerPrompt?: string;
    harnessCriticPrompt?: string;
    harnessRefinerPrompt?: string;
  }) => Promise<void>;
  resetAiSystemPrompts: () => Promise<void>;
  isSettingsModalOpen: boolean;
  setSettingsModalOpen: (open: boolean) => void;
  openSettingsModal: () => void;
}

const StudioSessionContext = createContext<
  StudioSessionContextValue | undefined
>(undefined);

export function StudioSessionProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string>("");
  const [rememberKeyInVault, setRememberKeyInVaultState] =
    useState<boolean>(true);
  const [imagesOutputDir, setImagesOutputDirState] = useState<string>(
    "~/Pictures/nanobanana"
  );
  const [user, setUserState] = useState<GoogleUserProfile | null>(
    IS_AUTH_REQUIRED ? null : LOCAL_DEV_USER
  );
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [bootstrapData, setBootstrapData] = useState<BootstrapResponse>(
    DEFAULT_BOOTSTRAP_DATA
  );
  const [backendOnline, setBackendOnline] = useState<boolean>(true);
  const [pendingRemix, setPendingRemix] = useState<RemixPresetRequest | null>(
    null
  );
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProjectTitle, setActiveProjectTitle] =
    useState<string>("New Project");
  const [activeHarnessMissionId, setActiveHarnessMissionIdState] = useState<
    string | null
  >(null);

  const setActiveHarnessMissionId = (id: string | null) => {
    setActiveHarnessMissionIdState(id);
    if (typeof window !== "undefined") {
      if (id) {
        window.localStorage.setItem("nanobanana_active_harness_mission_id", id);
      } else {
        window.localStorage.removeItem("nanobanana_active_harness_mission_id");
      }
    }
  };
  const [newProjectNonce, setNewProjectNonce] = useState<number>(0);
  const [enhanceSystemPrompt, setEnhanceSystemPrompt] = useState<string>(
    DEFAULT_ENHANCE_SYSTEM_PROMPT
  );
  const [variationSystemPrompt, setVariationSystemPrompt] = useState<string>(
    DEFAULT_VARIATION_SYSTEM_PROMPT
  );
  const [harnessPlannerPrompt, setHarnessPlannerPrompt] = useState<string>(
    DEFAULT_HARNESS_PLANNER_PROMPT
  );
  const [harnessCriticPrompt, setHarnessCriticPrompt] = useState<string>(
    DEFAULT_HARNESS_CRITIC_PROMPT
  );
  const [harnessRefinerPrompt, setHarnessRefinerPrompt] = useState<string>(
    DEFAULT_HARNESS_REFINER_PROMPT
  );
  const [isSettingsModalOpen, setSettingsModalOpen] = useState<boolean>(false);

  const openSettingsModal = () => setSettingsModalOpen(true);

  const triggerNewProject = async (
    customTitle?: string
  ): Promise<string | null> => {
    const resolvedTitle = customTitle?.trim() || "New Project";
    const currentUser = user || LOCAL_DEV_USER;
    setActiveProjectTitle(resolvedTitle);
    setPendingRemix(null);
    const created = await createConversation({
      user_id: currentUser.id,
      title: resolvedTitle,
    });
    const createdId = created?.id || null;
    setActiveProjectId(createdId);
    setNewProjectNonce((n) => n + 1);
    return createdId;
  };

  const setUser = (nextUser: GoogleUserProfile | null) => {
    setUserState(nextUser);
    setIsAuthenticated(Boolean(nextUser));
  };

  const setApiKey = (nextKey: string) => {
    setApiKeyState(nextKey);
    if (rememberKeyInVault) {
      if (nextKey.trim()) {
        void vaultSaveApiKey(nextKey);
      } else {
        void vaultClearApiKey();
      }
    }
  };

  const setRememberKeyInVault = (remember: boolean) => {
    setRememberKeyInVaultState(remember);
    if (remember && apiKey.trim()) {
      void vaultSaveApiKey(apiKey);
    } else if (!remember) {
      void vaultClearApiKey();
    }
  };

  const setImagesOutputDir = async (dirPath: string): Promise<string> => {
    setImagesOutputDirState(dirPath);
    const saved = await vaultSetImagesOutputDir(dirPath);
    setImagesOutputDirState(saved);
    return saved;
  };

  const updateModifierCategories = async (
    categories: ModifierCategory[]
  ): Promise<void> => {
    setBootstrapData((prev) => ({
      ...prev,
      modifier_categories: categories,
    }));
    await vaultSetModifierCategories(categories);
  };

  const resetModifierCategories = async (): Promise<void> => {
    const defaults = DEFAULT_BOOTSTRAP_DATA.modifier_categories;
    setBootstrapData((prev) => ({
      ...prev,
      modifier_categories: defaults,
    }));
    await vaultSetModifierCategories(defaults);
  };

  const saveAiSystemPrompts = async (params: {
    enhanceSystemPrompt: string;
    variationSystemPrompt: string;
    harnessPlannerPrompt?: string;
    harnessCriticPrompt?: string;
    harnessRefinerPrompt?: string;
  }): Promise<void> => {
    const cleanEnh =
      params.enhanceSystemPrompt.trim() || DEFAULT_ENHANCE_SYSTEM_PROMPT;
    const cleanVar =
      params.variationSystemPrompt.trim() || DEFAULT_VARIATION_SYSTEM_PROMPT;
    const cleanPlan =
      (params.harnessPlannerPrompt ?? harnessPlannerPrompt).trim() ||
      DEFAULT_HARNESS_PLANNER_PROMPT;
    const cleanCrit =
      (params.harnessCriticPrompt ?? harnessCriticPrompt).trim() ||
      DEFAULT_HARNESS_CRITIC_PROMPT;
    const cleanRef =
      (params.harnessRefinerPrompt ?? harnessRefinerPrompt).trim() ||
      DEFAULT_HARNESS_REFINER_PROMPT;

    setEnhanceSystemPrompt(cleanEnh);
    setVariationSystemPrompt(cleanVar);
    setHarnessPlannerPrompt(cleanPlan);
    setHarnessCriticPrompt(cleanCrit);
    setHarnessRefinerPrompt(cleanRef);

    await vaultSetAiPrompts({
      enhanceSystemPrompt:
        cleanEnh === DEFAULT_ENHANCE_SYSTEM_PROMPT ? "" : cleanEnh,
      variationSystemPrompt:
        cleanVar === DEFAULT_VARIATION_SYSTEM_PROMPT ? "" : cleanVar,
      harnessPlannerPrompt:
        cleanPlan === DEFAULT_HARNESS_PLANNER_PROMPT ? "" : cleanPlan,
      harnessCriticPrompt:
        cleanCrit === DEFAULT_HARNESS_CRITIC_PROMPT ? "" : cleanCrit,
      harnessRefinerPrompt:
        cleanRef === DEFAULT_HARNESS_REFINER_PROMPT ? "" : cleanRef,
    });
  };

  const resetAiSystemPrompts = async (): Promise<void> => {
    setEnhanceSystemPrompt(DEFAULT_ENHANCE_SYSTEM_PROMPT);
    setVariationSystemPrompt(DEFAULT_VARIATION_SYSTEM_PROMPT);
    setHarnessPlannerPrompt(DEFAULT_HARNESS_PLANNER_PROMPT);
    setHarnessCriticPrompt(DEFAULT_HARNESS_CRITIC_PROMPT);
    setHarnessRefinerPrompt(DEFAULT_HARNESS_REFINER_PROMPT);
    await vaultSetAiPrompts({
      enhanceSystemPrompt: "",
      variationSystemPrompt: "",
      harnessPlannerPrompt: "",
      harnessCriticPrompt: "",
      harnessRefinerPrompt: "",
    });
  };

  useEffect(() => {
    let mounted = true;
    if (typeof window !== "undefined") {
      const savedMissionId = window.localStorage.getItem(
        "nanobanana_active_harness_mission_id"
      );
      if (savedMissionId) {
        setActiveHarnessMissionIdState((prev) => prev || savedMissionId);
      }
    }
    Promise.all([
      fetchBootstrap(),
      vaultGetModifierCategories<ModifierCategory>(),
    ]).then(([res, savedCategories]) => {
      if (!mounted) return;
      const PT_TO_EN_CATEGORY_TITLES: Record<string, string> = {
        "Camera & Lente": "Camera & Lens",
        "Roupas & Figurino": "Clothing & Wardrobe",
        "Ângulo & Enquadramento": "Angle & Framing",
        "Iluminação (Light)": "Lighting & Mood",
        "Atmosfera & Cor": "Atmosphere & Color",
      };
      const PT_TO_EN_OPTION_LABELS: Record<string, string> = {
        "Techwear Utilitário Urbano": "Urban Utilitarian Techwear",
        "Alfaiataria Editorial Minimalista": "Minimalist Editorial Tailoring",
        "Kimono Contemporâneo": "Contemporary Street Kimono",
        "Streetwear Vintage Anos 90": "90s Vintage Streetwear",
        "Zenital / Bird's-Eye View": "Overhead Bird's-Eye View",
        "Dutch Angle Dinâmico": "Dynamic Dutch Angle",
      };
      const resolvedCategories =
        Array.isArray(savedCategories) && savedCategories.length > 0
          ? savedCategories.map((cat) => ({
              ...cat,
              title: PT_TO_EN_CATEGORY_TITLES[cat.title] || cat.title,
              options: Array.isArray(cat.options)
                ? cat.options.map((opt) => ({
                    ...opt,
                    label: PT_TO_EN_OPTION_LABELS[opt.label] || opt.label,
                  }))
                : [],
            }))
          : res.data.modifier_categories;
      setBootstrapData({
        ...res.data,
        modifier_categories: resolvedCategories,
      });
      setBackendOnline(res.online);
    });
    vaultGetSavedApiKey().then((savedKey) => {
      if (!mounted) return;
      if (savedKey && savedKey.trim()) {
        setApiKeyState(savedKey);
        setRememberKeyInVaultState(true);
      }
    });
    vaultGetImagesOutputDir().then((savedDir) => {
      if (!mounted) return;
      if (savedDir && savedDir.trim()) {
        setImagesOutputDirState(savedDir);
      }
    });
    vaultGetAiPrompts().then((savedPrompts) => {
      if (!mounted) return;
      setEnhanceSystemPrompt(
        savedPrompts.enhanceSystemPrompt?.trim() ||
          DEFAULT_ENHANCE_SYSTEM_PROMPT
      );
      setVariationSystemPrompt(
        savedPrompts.variationSystemPrompt?.trim() ||
          DEFAULT_VARIATION_SYSTEM_PROMPT
      );
      setHarnessPlannerPrompt(
        savedPrompts.harnessPlannerPrompt?.trim() ||
          DEFAULT_HARNESS_PLANNER_PROMPT
      );
      setHarnessCriticPrompt(
        savedPrompts.harnessCriticPrompt?.trim() ||
          DEFAULT_HARNESS_CRITIC_PROMPT
      );
      setHarnessRefinerPrompt(
        savedPrompts.harnessRefinerPrompt?.trim() ||
          DEFAULT_HARNESS_REFINER_PROMPT
      );
    });
    return () => {
      mounted = false;
    };
  }, []);

  const logout = () => {
    setUserState(IS_AUTH_REQUIRED ? null : LOCAL_DEV_USER);
    setIsAuthenticated(false);
    setApiKeyState("");
    setRememberKeyInVaultState(false);
    void vaultClearApiKey();
  };

  const hasKeyInRam = apiKey.trim().length > 0;

  return (
    <StudioSessionContext.Provider
      value={{
        apiKey,
        setApiKey,
        rememberKeyInVault,
        setRememberKeyInVault,
        hasKeyInRam,
        imagesOutputDir,
        setImagesOutputDir,
        user,
        isAuthenticated,
        setUser,
        logout,
        bootstrapData,
        backendOnline,
        setBackendOnline,
        pendingRemix,
        setPendingRemix,
        activeProjectId,
        setActiveProjectId,
        activeProjectTitle,
        setActiveProjectTitle,
        activeHarnessMissionId,
        setActiveHarnessMissionId,
        newProjectNonce,
        triggerNewProject,
        updateModifierCategories,
        resetModifierCategories,
        enhanceSystemPrompt,
        variationSystemPrompt,
        harnessPlannerPrompt,
        harnessCriticPrompt,
        harnessRefinerPrompt,
        saveAiSystemPrompts,
        resetAiSystemPrompts,
        isSettingsModalOpen,
        setSettingsModalOpen,
        openSettingsModal,
      }}
    >
      {children}
    </StudioSessionContext.Provider>
  );
}

export function useStudioSession(): StudioSessionContextValue {
  const ctx = useContext(StudioSessionContext);
  if (!ctx) {
    throw new Error(
      "useStudioSession must be used within a StudioSessionProvider"
    );
  }
  return ctx;
}
