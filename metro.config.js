// metro.config.js
const { getDefaultConfig } = require("@expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const defaultConfig = getDefaultConfig(__dirname, {
  // this flag turns on CSS support so that nativewind can inject your global.css
  isCSSEnabled: true,
});

// apply your resolver overrides
defaultConfig.resolver = {
  ...defaultConfig.resolver,
  // from your Supabase workaround
  unstable_conditionNames: ["browser"],
  unstable_enablePackageExports: false,
};

// wrap with NativeWind (and point at your Tailwind entry file)
module.exports = withNativeWind(defaultConfig, {
  input: "./global.css",
});
