# Build an Android Debug APK Locally (No Capawesome Subscription)

> **Phone-only option:** If you have an Android phone but no computer, use [PHONE_ANDROID_BUILD.md](PHONE_ANDROID_BUILD.md) and the GitHub Actions workflow. You do not install the SDK or Termux on your phone.

This project includes its Capacitor Android wrapper and Gradle wrapper. The command below builds the Android **debug APK on your own computer**; it does not call Capawesome Cloud and does not require a paid Capawesome subscription.

> **Build status:** The APK build has not yet succeeded or been installed on a device. The Android SDK is not installed in the current build environment because its SDK license prompt was declined. These instructions describe the project's configured local build path; they are not a claim that the APK has already been verified.

## What the APK contains and requires

This is a Capacitor WebView shell configured to load the application from a **stable public HTTPS origin** at build time. The origin must serve both the Pro Market Intelligence frontend and its `/api` backend. The APK does not bundle the Node.js backend, and it is not an offline-only app. The hosted backend must keep `TWELVE_DATA_API_KEY` as a server-side secret; never put that key in the APK, frontend, source ZIP, or a chat message.

You may host the app on a server/provider of your choice. **Capawesome Cloud is not part of the local build path.** A temporary development Preview is not a durable production origin.

## Prerequisites

- Linux, macOS, or Windows through WSL2/Git Bash with a POSIX-compatible shell; the repository's `android:apk` script uses POSIX shell commands.
- Node.js 22.x and pnpm 10.18.0 (the version is pinned in `package.json`).
- JDK 17 or newer. The project uses Android Gradle Plugin 8.7.2 and Gradle Wrapper 8.11.1; a separate global Gradle installation is not needed.
- Android SDK Platform **35** and Android SDK Build-Tools **35.0.0**. Platform-Tools are useful for installing the result with `adb`.
- A stable HTTPS application origin for `PMI_APP_URL`.

## Install/locate Android SDK components

Install Android command-line tools or Android Studio from the official [Android developer tools](https://developer.android.com/studio#command-line-tools-only). Set `ANDROID_HOME` to the SDK directory actually installed on your machine. Common locations are `$HOME/Android/Sdk` on Linux and `$HOME/Library/Android/sdk` on macOS.

Example for a Linux SDK installed at `$HOME/Android/Sdk`:

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

sdkmanager --sdk_root="$ANDROID_HOME" "platforms;android-35" "build-tools;35.0.0" "platform-tools"
```

Android's SDK manager may display Google Android SDK license terms while installing components. Review any terms yourself in the SDK manager if you decide to proceed. This project does not automatically accept, skip, or bypass licenses. On this project's prior build attempt, the license prompt was declined, so no successful Gradle/APK build was produced.

## Build

From the extracted project root, set the SDK and the durable HTTPS origin. The origin must be just the scheme and host—no route, query, or credentials.

```bash
export ANDROID_HOME="$HOME/Android/Sdk"  # replace with your actual SDK directory
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PMI_APP_URL="https://your-stable-app-origin.example"

pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm android:apk
```

The `android:apk` script builds the web assets, synchronizes the Capacitor Android project, invokes the checked-in Gradle wrapper with `assembleDebug`, then copies the output to:

```text
dist/apk/ProMarket-Intelligence-debug.apk
```

This is a debug/sideload APK, not a Play Store release. A production release requires a separately managed signing keystore and has not been configured or verified here.

## Install on a connected Android device

With Android Platform-Tools installed and USB debugging enabled on a test device:

```bash
adb install -r dist/apk/ProMarket-Intelligence-debug.apk
```

Alternatively, transfer the APK to the device and permit installation from that file source in Android settings. Android may display its normal warning for sideloaded apps.

## Common build errors

- **`SDK location not found`:** Set `ANDROID_HOME`/`ANDROID_SDK_ROOT` to the SDK directory. The build script writes `android/local.properties` for the local machine; that machine-specific file is not included in source control.
- **Missing platform/build-tools revision:** Install `platforms;android-35` and `build-tools;35.0.0` using Android SDK Manager.
- **Gradle/Java compatibility error:** Use JDK 17 or newer; verify with `java -version`.
- **SDK license prompt:** This is an SDK-manager prerequisite, not a Capawesome subscription. The build is not verified until the machine has the necessary authorized SDK components; do not automate license acceptance.
- **Live API/data unavailable in the APK:** Confirm `PMI_APP_URL` points to the HTTPS origin that serves this project's UI and backend, and that the backend has its own server-side `TWELVE_DATA_API_KEY` configuration. Do not place provider keys in the APK.
