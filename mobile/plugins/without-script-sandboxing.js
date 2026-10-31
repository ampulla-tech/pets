const { withXcodeProject } = require("expo/config-plugins");

// React Native's "Bundle React Native code and images" phase writes ip.txt (the
// Metro host) into the built .app. Xcode's user-script sandboxing confines a Run
// Script phase to its declared outputs, so that write fails with "Operation not
// permitted" and every on-device Debug build dies. CocoaPods already disables
// the sandbox for the Pods project; do the same for the app target.
module.exports = function withoutScriptSandboxing(config) {
  return withXcodeProject(config, (cfg) => {
    const configurations = cfg.modResults.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const settings = configurations[key]?.buildSettings;
      if (settings && "ENABLE_USER_SCRIPT_SANDBOXING" in settings) {
        settings.ENABLE_USER_SCRIPT_SANDBOXING = "NO";
      }
    }
    return cfg;
  });
};
