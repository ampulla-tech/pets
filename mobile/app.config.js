// The dynamic half of the app config. `app.json` is the static base and the one
// place the bundle identifier lives; this file adds what comes from the
// environment and must not be committed: the EAS project id, which Expo push
// tokens need. With no id the app still builds and simply skips push
// registration (src/lib/push.ts reads the same absence).

/** Build the final config from the static base plus the environment. */
function withEnvironment(config, env) {
  const projectId = env.EAS_PROJECT_ID || env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId) return config;
  return {
    ...config,
    extra: { ...config.extra, eas: { ...config.extra?.eas, projectId } },
  };
}

module.exports = ({ config }) => withEnvironment(config, process.env);
module.exports.withEnvironment = withEnvironment;
