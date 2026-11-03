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
  ModifierCategory,
  fetchBootstrap,
} from "@/features/studio";
import {
  vaultClearApiKey,
  vaultGetImagesOutputDir,
  vaultGetModifierCategories,
  vaultGetSavedApiKey,
  vaultSaveApiKey,
  vaultSetImagesOutputDir,
  vaultSetModifierCategories,
} from "@/core/tauri/tauriBridge";

export interface RemixPresetRequest {
  idea: string;
  prompt?: string;
  imageUrl?: string;
  styleId?: string;
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
  newProjectNonce: number;
  triggerNewProject: () => void;
  updateModifierCategories: (categories: ModifierCategory[]) => Promise<void>;
  resetModifierCategories: () => Promise<void>;
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
  const [newProjectNonce, setNewProjectNonce] = useState<number>(0);
  const [isSettingsModalOpen, setSettingsModalOpen] = useState<boolean>(false);

  const openSettingsModal = () => setSettingsModalOpen(true);

  const triggerNewProject = () => {
    setActiveProjectId(null);
    setActiveProjectTitle("New Project");
    setPendingRemix(null);
    setNewProjectNonce((n) => n + 1);
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

  useEffect(() => {
    let mounted = true;
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
        newProjectNonce,
        triggerNewProject,
        updateModifierCategories,
        resetModifierCategories,
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
