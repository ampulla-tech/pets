// Native modules the screens reach for, replaced by in-memory or inert stand-ins
// so the screens can be exercised without a native build. Each test file sets
// the answers it needs on these mocks.

require("react-native-gesture-handler/jestSetup");

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    __store: store,
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItemAsync: jest.fn(async (key: string) => (store.has(key) ? store.get(key)! : null)),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

jest.mock("expo-notifications", () => ({
  __esModule: true,
  DEFAULT_ACTION_IDENTIFIER: "expo.modules.notifications.actions.DEFAULT",
  AndroidImportance: { HIGH: 4 },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ status: "undetermined", granted: false })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted", granted: true })),
  getExpoPushTokenAsync: jest.fn(async () => ({ type: "expo", data: "ExponentPushToken[test]" })),
  useLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn(),
}));

jest.mock("expo-image-picker", () => ({
  __esModule: true,
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));

jest.mock("expo-document-picker", () => ({
  __esModule: true,
  getDocumentAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));

jest.mock("expo-web-browser", () => ({
  __esModule: true,
  openBrowserAsync: jest.fn(async () => ({ type: "opened" })),
}));

jest.mock("expo-sharing", () => ({
  __esModule: true,
  shareAsync: jest.fn(async () => undefined),
  isAvailableAsync: jest.fn(async () => true),
}));

jest.mock("expo-clipboard", () => ({
  __esModule: true,
  setStringAsync: jest.fn(async () => true),
}));

jest.mock("expo-file-system", () => {
  class Directory {
    exists = true;
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts.map((p) => (typeof p === "string" ? p : (p as { uri: string }).uri)).join("/");
    }
    create() {}
  }
  class File {
    exists = false;
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts.map((p) => (typeof p === "string" ? p : (p as { uri: string }).uri)).join("/");
    }
    delete() {}
    static downloadFileAsync = jest.fn(async (_url: string, destination: File) => destination);
  }
  return { __esModule: true, File, Directory, Paths: { cache: new Directory("file:///cache") } };
});

jest.mock("expo-splash-screen", () => ({
  __esModule: true,
  preventAutoHideAsync: jest.fn(async () => true),
  hideAsync: jest.fn(async () => true),
}));

// A CI runner is slower than a laptop: screens that load over the fake API get
// more than the default second to settle.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("@testing-library/react-native").configure({ asyncUtilTimeout: 10000 });
