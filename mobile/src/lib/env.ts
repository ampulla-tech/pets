/**
 * Where the app talks to, read once from the build's environment.
 *
 * `EXPO_PUBLIC_API_URL` is inlined at build time (the EAS profile sets the
 * production one); the default is the dev stack, which the iOS simulator
 * reaches on the host's localhost. The EAS project id is what Expo push tokens
 * need; without it push registration is skipped.
 */

import Constants from "expo-constants";

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:8300").replace(
  /\/+$/,
  "",
);

export function easProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return (
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    null
  );
}
