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
  fetchBootstrap,
} from "@/features/studio";
import {
  vaultClearApiKey,
  vaultGetImagesOutputDir,
  vaultGetSavedApiKey,
  vaultSaveApiKey,
  vaultSetImagesOutputDir,
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

  useEffect(() => {
    let mounted = true;
    fetchBootstrap().then((res) => {
      if (!mounted) return;
      setBootstrapData(res.data);
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
