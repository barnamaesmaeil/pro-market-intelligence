# Build the APK from an Android phone

This method uses a GitHub-hosted Linux runner. You do **not** install Android SDK, Gradle, Node.js, or Termux on your phone, and you do not need a paid Capawesome Cloud subscription. The runner uses its own preinstalled Android SDK. The workflow does not download SDK packages or automatically accept SDK licenses.

The project is a React + TypeScript + Vite web app with an Express backend and a Capacitor 7 Android wrapper. The checked-in Android project uses Android Gradle Plugin 8.7.2, Gradle 8.11.1, Android Platform 35, Build Tools 35.0.0, Node 22, pnpm 10.18.0, and Java 17. The workflow uses the GitHub Ubuntu 24.04 image, which currently lists those Android SDK components, Node 22, and Java 17.

## Project root and package manager

The delivered archive is named `pro-market-intelligence-app.zip`. Its entries are the project contents directly: the exact archive paths are `package.json`, `pnpm-lock.yaml`, `capacitor.config.ts`, `README.md`, `android/`, and `.github/workflows/android-apk.yml`. There is no enclosing `pro-market-intelligence-app/` directory inside the ZIP. If extracting it on the phone, create a folder named `pro-market-intelligence-app` first and extract the contents into that folder.

This is a **pnpm** project (`packageManager: pnpm@10.18.0`) and has `pnpm-lock.yaml`, not `package-lock.json`; therefore `npm ci` is not applicable, and generating a second npm lockfile is not recommended. The matching reproducible install is `pnpm install --frozen-lockfile`. The cloud workflow installs pnpm, runs that install from the folder that contains `package.json`, builds the web assets, runs `pnpm exec cap sync android` to use the locally installed Capacitor CLI, then runs `android/gradlew assembleDebug`.

## Before you start: the app needs a stable web address

The APK is a Capacitor WebView shell. It loads the web app from a stable public HTTPS origin; it does **not** bundle the Express backend and does not work offline. That origin must serve both the Pro Market Intelligence frontend and its `/api` backend. Do not use a temporary development Preview as the permanent address.

The build needs the origin as a GitHub repository **variable** named `PMI_APP_URL`. The Twelve Data key is different: keep `TWELVE_DATA_API_KEY` only in the hosting provider's server-side secret settings. Do not add it to GitHub Actions, this workflow, the APK, or the frontend. The workflow deliberately passes no provider API key and checks that the server-key identifier did not enter the packaged WebView assets.

If you do not yet have a stable HTTPS deployment, stop before running the workflow. The build is expected to fail its URL check until that is set up.

Before installing dependencies, the workflow also requests both `https://your-domain/` and `https://your-domain/api/health`. Both must respond successfully; this catches a mistaken or unreachable origin before spending time on the Android build.

## Create the private GitHub repository on your phone

1. Download `pro-market-intelligence-app.zip` to your phone using the direct download link included with this delivery.
2. Open [github.com/new](https://github.com/new) in your phone browser and sign in or create a free GitHub account.
3. Create a repository and select **Private**. This keeps the source ZIP from being visible to the public.
4. Open the new repository, choose **Add file → Upload files**, select the downloaded ZIP, and commit it to the default branch. Upload the ZIP as one file; do not extract it first. GitHub's browser upload limit is 25 MiB per file, and this project archive is small. The workflow extracts it to a temporary folder and checks that `package.json` is directly inside that folder. It also supports a repository where the project files are already at repository root.
5. Choose **Add file → Create new file**. For the filename, enter `.github/workflows/android-apk.yml`. If GitHub asks, create the `.github/workflows` folders as part of that path.
6. Open the complete standalone workflow file using the direct workflow download link included with this delivery. Copy all of its contents, paste them into GitHub's editor, and commit to the default branch. The workflow is manual, so it will not start before you configure the app URL.

## Add the app URL variable

In the repository, open **Settings → Secrets and variables → Actions → Variables → New repository variable**. Set:

- **Name:** `PMI_APP_URL`
- **Value:** your stable app origin, such as `https://your-domain.example`

Enter only `https://` plus the host. Do not add a page path, query, account credentials, or API key. This origin is a public address, so a repository variable is suitable; it is not a secret.

Do **not** create a GitHub secret for `TWELVE_DATA_API_KEY`. Configure that key only in the backend host's server-side secret settings. The browser APK must not contain it.

## Run the build and install the APK

1. In your repository, open the **Actions** tab.
2. Select **Build Pro Market Intelligence APK** in the workflow list.
3. Tap **Run workflow**, select the default branch, and tap the green **Run workflow** button.
4. Open the new run and wait for it to finish. Green means GitHub generated the APK artifact. Red means it did not; open the failed step's log and do not treat an APK as ready.
5. In the successful run, tap the artifact named **Pro-Market-Intelligence-debug-apk** to download it. GitHub downloads artifacts as a ZIP. Open that ZIP in the phone's Files app and extract `ProMarket-Intelligence-debug.apk`.
6. Tap the APK to install it. If Android asks, allow your browser or Files app to install apps from that source. This is a debug/sideload APK, not a Play Store release.

## Cost and license limits

GitHub Free currently includes 2,000 standard-runner minutes and 500 MB of artifact storage per month for private repositories. The workflow keeps the APK artifact for seven days. If no payment method is on the GitHub account, GitHub says workflow use is blocked after the included quota runs out; if a payment method is already configured, review GitHub's usage/budget page first. You do not need to buy Capawesome.

The workflow does not run `sdkmanager --licenses`, hide a license prompt, or auto-accept any SDK terms. If GitHub's runner reports that a required Android SDK license is not available, the workflow stops. Do not bypass that error. A successful hosted build has not been verified until you personally see a green Actions run and download the artifact.

## Direct build on the phone

A direct Android-phone build is technically possible with Termux plus the third-party Termux Studio project, but that route requires installing Termux and a multi-gigabyte toolchain on the phone. It is not this project's tested build path. Since your requirement is to avoid both Termux and phone-side SDK installation, use the GitHub Actions workflow instead.

## Troubleshooting

- **`PMI_APP_URL` is empty, invalid, or unreachable:** Add the repository variable using the stable public HTTPS origin. It must not contain a path or query, and both `/` and `/api/health` must respond successfully.
- **`Source ZIP not found`:** Upload the ZIP to the repository root and keep only the one project ZIP there.
- **Android SDK Platform 35 or Build Tools 35.0.0 missing:** The workflow stops instead of installing packages or accepting license terms. It has not produced an APK.
- **Build succeeds but the app cannot load data:** Check that `PMI_APP_URL` points to the live frontend and backend, and that `TWELVE_DATA_API_KEY` is configured as a server-side secret on the backend host.
- **No artifact appears:** The APK build or the security check failed. Open the workflow log; only a successful run with the artifact is evidence of an APK.

## Official references

- [GitHub Actions billing and free quotas](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [GitHub Ubuntu 24.04 runner software inventory](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md)
- [GitHub browser uploads](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)
- [GitHub repository variables](https://docs.github.com/actions/learn-github-actions/variables)
- [Manually running a GitHub Actions workflow](https://docs.github.com/actions/managing-workflow-runs/manually-running-a-workflow)
- [Capacitor Android documentation](https://capacitorjs.com/docs/android)
- [Termux official project](https://termux.dev/en/) and [Termux Studio community tool](https://github.com/poordevcode/termux-android-studio) (the direct-phone route is not verified for this application).
