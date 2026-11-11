import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "co.the1970.operations",
  appName: "The 1970 Operations",
  webDir: "public",

  server: {
    url: "https://operations.the1970.co/mobile",
    cleartext: false,
  },

  ios: {
    contentInset: "always",
  },

  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
