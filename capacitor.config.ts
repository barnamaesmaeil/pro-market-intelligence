import type { CapacitorConfig } from "@capacitor/cli";

const appUrl = process.env.PMI_APP_URL;
const appOrigin = appUrl ? new URL(appUrl) : null;
if (
  appUrl &&
  (appOrigin!.pathname !== "/" ||
    appOrigin!.search ||
    appOrigin!.hash ||
    appOrigin!.username ||
    appOrigin!.password)
) {
  throw new Error(
    "PMI_APP_URL must be an HTTPS origin without path, query, or credentials."
  );
}
if (appOrigin && appOrigin.protocol !== "https:") {
  throw new Error("PMI_APP_URL must be a public HTTPS origin.");
}

const config: CapacitorConfig = {
  appId: "com.promarket.intelligence",
  appName: "Pro Market Intelligence",
  webDir: "dist/public",
  // Must point to a durable HTTPS deployment at native build time. No provider key ships in the APK.
  ...(appOrigin
    ? {
        server: {
          url: appOrigin.origin,
          cleartext: false,
          allowNavigation: [appOrigin.host],
        },
      }
    : {}),
};

export default config;
