export type AuthProvider = "google" | "facebook";

export interface GoogleUserProfile {
  id: string;
  name: string;
  email: string;
  picture: string;
  provider: AuthProvider;
  authenticatedAt: string;
}

export interface GoogleAuthRequestPayload {
  credential?: string;
  client_id?: string;
  dev_profile?: {
    name: string;
    email: string;
    picture?: string;
  };
}

export interface FacebookAuthRequestPayload {
  access_token?: string;
  user_id?: string;
  dev_profile?: {
    name: string;
    email: string;
    picture?: string;
  };
}

export interface SocialAuthBackendResponse {
  authenticated: boolean;
  provider: string;
  user: {
    id: string;
    name: string;
    email: string;
    picture?: string;
    provider?: string;
  };
  key_policy?: string;
}
