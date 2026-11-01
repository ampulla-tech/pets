// Reanimated pulls in react-native-worklets, whose `.native` implementation
// expects a real native module and throws at import time under Jest. Worklets
// ships a plain implementation alongside it, so drop the `.native` extensions
// for that package's own relative imports and let the React Native resolver
// handle everything else exactly as jest-expo's preset does. Bare requests are
// left alone: "react-native" has to keep resolving to the same copy the rest of
// the suite uses, or the renderer ends up with two of them and nothing renders.
const reactNativeResolver = require("@react-native/jest-preset/jest/resolver");

module.exports = (request, options) => {
  const ownRelativeImport =
    request.startsWith(".") &&
    options.basedir.includes("react-native-worklets");

  if (!ownRelativeImport) return reactNativeResolver(request, options);

  return reactNativeResolver(request, {
    ...options,
    extensions: options.extensions?.filter((ext) => !ext.includes("native")),
  });
};
