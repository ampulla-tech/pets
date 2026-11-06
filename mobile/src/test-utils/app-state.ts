import { AppState } from "react-native";

/**
 * Catch the app's AppState listeners so a test can bring the app back to the
 * foreground. React Native's Jest setup already mocks `addEventListener`, so
 * spying returns that same mock: `restore` puts its inert answer back rather
 * than `mockRestore`, which would leave it answering undefined.
 */
export function captureAppState() {
  const listeners: ((state: string) => void)[] = [];
  const spy = jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_type, listener) => {
      listeners.push(listener as (state: string) => void);
      return { remove: () => undefined };
    });
  return {
    foreground: () => listeners.forEach((listener) => listener("active")),
    restore: () => spy.mockImplementation(() => ({ remove: () => undefined })),
  };
}
