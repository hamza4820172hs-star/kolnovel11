# NovelReader — EPUB + Arabic translation build

This update keeps the existing five-tab application structure and adds the first functional EPUB/reader/translation implementation.

## Included in this build
- Import EPUB from Android document picker and copy it into app storage.
- Parse `META-INF/container.xml`, OPF metadata, manifest and spine. Extract title, author, description, cover image and readable chapter text.
- Store chapters and book metadata in SQLite.
- Reader displays Arabic translations only by default; optional English source display is available in reader/settings.
- Translate chapter paragraphs sequentially: MyMemory first, Google Translate fallback. Successful paragraphs are saved immediately; retry skips completed paragraphs.
- Reading progress and reading/translation history are stored locally.
- Library search, sort, favorites, long-press actions and delete.
- Activity history and counters; reader font size, line spacing and paper/dark/light theme settings.

## Important limitations
- Translation uses public web endpoints and requires internet. These endpoints may rate-limit, change, or reject requests; this is not an official paid translation API and no reliability guarantee is possible.
- EPUB parsing supports standard reflowable EPUBs with OPF/spine XHTML. Fixed-layout, image-only, DRM-protected, malformed or unusual EPUBs may not parse correctly.
- This is an incremental implementation, not the complete feature list: EPUB export, full backup/restore, background translation after force-close, advanced TOC search/multi-select, chapter range batches and complete storage management still need implementation.
- No APK has been built or tested on a physical Android device in this environment. GitHub Actions builds a release APK; inspect its logs and test with several EPUBs.

## Build
GitHub Actions workflow: `.github/workflows/android.yml`. It installs dependencies, runs Expo prebuild, builds `assembleRelease`, and uploads `app-release.apk`.


## App icon
The NovelReader gold open-book translation icon is configured in `app.json` and stored at `assets/icon.png`.


## v0.3 reader and translation updates
- Added whole-book sequential bulk translation from the novel details page. Existing successful paragraphs are skipped; failed paragraphs are recorded and later chapters continue.
- Added per-chapter translation states in the chapter list and in the reader's full chapter index: untranslated, partially translated, failed, and complete.
- Added a reading-position progress bar and percentage based on vertical scroll position.
- Reader controls can be hidden/shown by a short tap in the central 28% of the screen; scrolling gestures are ignored.
- Scroll position is periodically persisted and restored when reopening a chapter.

Build note: the GitHub workflow runs `npm install` and builds a standalone Release APK. This source update has not been built or device-tested in this environment.

## v0.4 reader fixes
- Added a compact search control to the chapter index (search by chapter title or number).
- Added safe-area insets to the reader so its content stays below the Android status bar and above the bottom system area.
- Reset the scroll view when navigating to a different chapter, while restoring the saved offset when reopening the same chapter.


## v0.6 reading-position restoration fix

Reading offsets are stored independently for each `(book_id, chapter_id)`.
The reader now waits until both the ScrollView viewport and chapter content have
laid out before restoring the saved offset. Scroll events emitted during that
restore are ignored so an initial `y=0` event cannot overwrite the saved value.
Positions are persisted at scroll end, momentum end, app background, and reader blur.

Manual acceptance test:
1. Read chapter 1 to roughly 50%, then open chapter 2 and read to roughly 25%.
2. Leave the reader and reopen chapter 1: it should return near 50%.
3. Open chapter 2 from the TOC: it should return near 25%.
4. Use Next from chapter 1: chapter 2 should restore near 25%, not start at 0%.
5. Open a never-read chapter: it should start at 0%.


## v0.7 Next/Previous position fix

Fixed a lifecycle cleanup bug: the reader effect cleanup ran on every chapterId
change and saved the reset transient offset (0) into the chapter being left,
overwriting its actual saved position. Cleanup now only unregisters listeners.
The outgoing chapter is saved explicitly before Next/Previous and TOC navigation.


## v0.8 — selected-chapter bulk translation

The former whole-novel action is replaced by a chapter picker. Select individual
chapters, all chapters, untranslated/partially translated chapters, or a chapter
number range. Only selected chapters are processed; completed paragraphs are
skipped and failed paragraphs are recorded.

Background execution: this build does not claim guaranteed translation while
the app is backgrounded or the screen is locked. A native Android foreground
service with an ongoing notification still needs to be integrated and tested.


## v0.9 — selected-chapter foreground translation service

- Retains chapter selection, chapter ranges, select-all, and untranslated-only selection.
- Starts translation using `react-native-background-actions` as an Android foreground service.
- Ongoing notification shows novel name, paragraph progress, successful and failed counts.
- Processes only selected chapters, skips completed paragraphs, and saves each success immediately.
- Android 13+ notification permission is requested before starting.
- Only one background translation task can run at a time.

Android limits: Force Stop, reboot, network loss, aggressive OEM battery controls, and Android foreground-service time limits can stop long tasks. Android 15 limits dataSync foreground-service runtime; split very large jobs into smaller batches. Build a standalone APK; this module does not run in Expo Go. The GitHub Actions build and a real-device test are still required before treating the background service as verified.


## v0.9.1 — foreground-service crash correction

Changes after reviewing the user's crash recording and the Android service setup:
- Added `android.permission.WAKE_LOCK`, required by the background-actions Android service.
- Passed `foregroundServiceType: ['dataSync']` explicitly, matching the service declaration and Android 14+ requirements.
- Corrected chapter paragraph splitting in the headless worker to split actual newline-delimited paragraphs, not the literal characters `\\n`.
- Added a determinate progress bar to the persistent notification.
- App version bumped to 0.9.1.

The crash is consistent with a failure during native foreground-service startup. These changes address missing Android service setup requirements documented by the library. This archive has been statically checked but has not been built or tested on a physical device in this environment.


## v0.9.2 Android 14/15/16 notification crash fix
The phone bug report identified the crash in `RNBackgroundActionsTask.buildNotification`: Android rejects the library's mutable PendingIntent because its launcher/deep-link Intent is implicit. The Expo config plugin now patches the installed library source during prebuild by calling `notificationIntent.setPackage(context.getPackageName())`, making the Intent explicit before PendingIntent creation. This avoids the unsafe implicit-intent exception without opting into `FLAG_ALLOW_UNSAFE_IMPLICIT_INTENT`.

This is a source-level fix based on the supplied Samsung Android 16 bug report. The APK still needs to be built and tested on the device.
