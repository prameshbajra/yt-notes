# Youtube Video Notes: Browser Extension

Video Notes is a browser extension (Chromium + Firefox) that lets you capture lightweight, timestamped annotations while watching YouTube. The extension injects a compact notes surface directly above the video title, renders every note as an interactive marker on a timeline, and ships with a popup UI for browsing and searching through everything you've saved.

## Features
- Inline notes workspace on every `youtube.com/watch` page with an `+ Add note` button and keyboard shortcut (`Alt + N`) that pauses playback while you type.
- Rich tooltip editor with autosorting, delete/cancel actions, and automatic resume of playback after the dialog closes.
- Timeline track rendered under the header: each note is a dot you can hover to preview or click to jump/edit; positions stay in sync with the underlying video duration.
- Automatic light/dark theming that mirrors YouTube (prefers explicit theme attributes, then falls back to `matchMedia` and luminance sampling).
- Persistent storage via `chrome.storage.local` in the `videoNotes:*` namespaces plus lightweight metadata (title, counts) for quick lookup.
- Popup dashboard (HTML/CSS/JS only) that lists every video with notes, supports instant search across titles and note bodies, and opens a new tab at the saved timestamp.

## Project Structure
```text
.
├── manifest.json          # Declares action popup, background worker, and YouTube content script
├── background.js          # Service worker entry (currently unused placeholder)
├── scripts/
│   └── content.js         # Main experience injected into YouTube watch pages
└── popup/
    ├── popup.html         # Popup shell
    ├── popup.css          # Light/dark adaptive styles
    └── popup.js           # Storage queries, search, rendering, and tab-opening logic
```

## How It Works

### Content script (`scripts/content.js`)
- Waits for `#player`/`#primary-inner` to be present, then injects a `Video Notes` container containing the header, timeline track, empty state, tooltip editor, and hover preview bubble (`createContainer`).
- Tracks video, note, and UI state in dedicated objects; observers (`MutationObserver`, `yt-navigate-finish`, `yt-page-data-updated`) ensure the UI survives YouTube's SPA navigation and dynamically rebinds to the active `<video>`.
- Notes are saved via `persistNotesForVideo`, which writes to `videoNotes:notes` and keeps a sibling metadata entry (`videoNotes:metadata`) containing the resolved title and note count for popup summaries.
- Rendering: `renderNotesTrack` converts stored notes into positioned buttons (percentage-based on duration). Hover/focus highlights show previews, click jumps the video to the timestamp and opens the editor in “edit” mode.
- UX niceties: video pauses when you create/edit, plays again after save/cancel; tooltips auto-position relative to anchors with collision adjustments; pointer-down handler closes dialogs when you click away.
- Accessibility & input: note dots have descriptive `aria-label`s, and `Alt + N` works globally unless focus is already in an input field.
- Theming: `detectThemeMode` inspects `ytd-app` attributes/classes, inline `color-scheme`, computed background luminance, and finally `prefers-color-scheme`, then `applyThemeToUi` updates every injected element. Mutation observers and `matchMedia` keep things refreshed on theme changes.

### Popup (`popup/`)
- Fetches both storage buckets (`videoNotes:notes`, `videoNotes:metadata`), normalizes entries, and sorts notes by timestamp while keeping derived fields (display text, formatted timestamps, `updatedAt`).
- Renders a card per video with expandable note lists; when search is active the UI stays expanded and highlights the filtered results with `“x of y notes”` labels.
- Storage listeners (`chrome.storage.onChanged`) refresh the list whenever notes update in the content script, keeping popup data live.
- Clicking a note uses `chrome.tabs.create` to open a new `https://www.youtube.com/watch?v=...&t=...` tab and closes the popup.

### Storage Model
```json
{
  "videoNotes:notes": {
    "<videoId>": [
      {
        "id": "note-id",
        "timestamp": 123.45,
        "text": "Key insight",
        "createdAt": 1698888888888,
        "updatedAt": 1698889999999
      }
    ]
  },
  "videoNotes:metadata": {
    "<videoId>": {
      "title": "Published video title",
      "noteCount": 3,
      "updatedAt": 1698889999999
    }
  }
}
```
The project uses `chrome.storage.local`, so the data stays on-device but is instantly accessible to both the content script and the popup.

### Background service worker (`background.js`)
The file currently exists as a placeholder to satisfy MV3’s background entry requirement; add future automation (context menu actions, sync, alarms) here.

## Setup & Development
1. **Install dependencies:** none beyond a modern browser (Chromium or Firefox) and Node (only needed for the optional dev tooling below).
2. **Load as an unpacked extension:**
   - **Chromium (Chrome/Edge/Brave):** open `chrome://extensions`, toggle **Developer mode**, click **Load unpacked**, and select this repository folder.
   - **Firefox:** open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**, and pick `manifest.json` inside the `extension` directory. The manifest declares `browser_specific_settings.gecko.id` (`video-notes@prameshbajra`); change it if you want a different ID before submitting to AMO.
3. **Faster feedback loop (optional):**
   ```bash
   npx web-ext run --source-dir . --target chromium
   npx web-ext run --source-dir . --target firefox-desktop
   ```
4. **Manifest linting before distribution:**
   ```bash
   npx web-ext lint --source-dir .
   ```
5. **Formatting (when needed):**
   ```bash
   npx prettier@latest --write scripts/**/*.js background.js
   ```

## Usage
- Open any standard YouTube watch page. The `Video Notes` module appears above the video title.
- Click `+ Add note` (or press `Alt + N`) to pause playback and open the tooltip editor. Give the note a short description and hit **Save**. Use **Delete** to remove a note or **Cancel** to close without saving.
- The timeline displays a dot for each saved note:
  - Hover or focus to preview the text.
  - Click to jump the video to the saved timestamp and edit the note in place.
- Notes persist per video ID, so refreshing or returning later keeps the timeline intact.
- Open the browser action popup to browse everything you've captured. Search matches both video titles and note text; select a result to open the video in a new tab at the recorded second.

## Contributing
- Follow the existing small, imperative commit format (optionally prefixed with `Feature:`/`Fix:`) and squash WIP commits before opening PRs.
- Each PR should describe the user-facing outcome, highlight any manifest/permission changes, and include a short manual test plan similar to the checklist above (plus screenshots for UI tweaks).
- Reuse helper utilities (`createButton`, `applyStyles`, storage helpers) instead of inlining DOM/CSS, and keep DOM IDs / storage keys in uppercase snake case for consistency.
- Before submitting changes, run `npx web-ext lint --source-dir .` and, if formatting drift is suspected, `npx prettier@latest --write scripts/**/*.js background.js`.
