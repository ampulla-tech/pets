// Metro for a pnpm workspace with a hoisted node_modules: Expo's default config
// already watches the workspace root and resolves packages from it, so
// `@pets/core` (TypeScript source, through its `exports`) is bundled as is.
// NativeWind compiles the `className` utilities from ./src/global.css.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// One React for the whole bundle. The install nests a second copy under
// @tanstack/react-query (its peer resolved apart from the app's), and two
// Reacts in one tree break every hook. Resolve `react` as the app does.
const appDir = path.join(__dirname, "package.json");
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const target =
    moduleName === "react" || moduleName.startsWith("react/")
      ? { ...context, originModulePath: appDir }
      : context;
  return resolveRequest
    ? resolveRequest(target, moduleName, platform)
    : context.resolveRequest(target, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./src/global.css" });
