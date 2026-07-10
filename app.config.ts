import type { ExpoConfig } from "@expo/config-types";

const defaultEasProjectId = "20ad1981-848b-41af-823c-449fae9de95a";

const easProjectId =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim()
  || process.env.EAS_PROJECT_ID?.trim()
  || defaultEasProjectId;

const config: ExpoConfig = {
  name: "Choice",
  slug: "choice-app",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  scheme: "choice",
  icon: "./src/assets/pink.jpeg",
  splash: {
    image: "./src/assets/splash-choice.png",
    resizeMode: "contain",
    backgroundColor: "#0f0b0d",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.choice.dating",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: "com.choice.dating",
    adaptiveIcon: {
      foregroundImage: "./src/assets/pink.jpeg",
      backgroundColor: "#0f0b0d",
    },
  },
  plugins: [
    "expo-dev-client",
    "expo-notifications",
    "@react-native-community/datetimepicker",
    "expo-video",
  ],
  extra: {
    eas: easProjectId
      ? {
          projectId: easProjectId,
        }
      : undefined,
  },
};

export default config;
