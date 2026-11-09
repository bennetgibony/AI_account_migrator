# AI Chat Exporter

Export **all** your Claude or ChatGPT chats into one place, in a single click:

- **📄 Text file**: one `.txt` with every chat, each starting with a separator line and the chat's name
- **📑 Google Doc**: one tab per chat in your own Google Drive, plus an index tab

**Use it here:** https://bennetgibony.github.io/AI_account_migrator/ *(once GitHub Pages is turned on)*

## How it works

1. On the page, choose `.txt` or Google Doc, then drag the **Export my chats** button to your bookmarks bar.
2. Open claude.ai or chatgpt.com while logged in and click the bookmark.
3. The bookmark reads your chats through the site's own interface, using your existing login, in your own browser tab:
   - **.txt mode:** builds the file and saves it to your Downloads.
   - **Google Doc mode:** hands the chats to the exporter page, which writes them into a new doc in *your* Google Drive.

## Is it safe? What happens to my data?

- **No server.** This is a single static page with no backend, analytics, cookies or tracking.
- **Your chats never leave your browser** except to go to your own Google Drive, and only if you pick the Google Doc option.
- **Google Doc mode** asks only for the `drive.file` permission. That lets the page create new files. It **can't read, see or change any of your other files**.
- **The code you run is the code you see.** `index.html` is built from [`src/`](src/) by [`build.py`](build.py). A [GitHub Action](.github/workflows/verify.yml) checks on every commit that the published page matches the source exactly.
- **Read it yourself.** The bookmark's entire code is in [`src/bookmarklet.js`](src/bookmarklet.js), under 200 lines of plain JavaScript. It only talks to:
  - the chat site you're on (`claude.ai` or `chatgpt.com`), to read your chats
  - this page, to hand the chats over in Google Doc mode only

> ⚠️ General advice for any bookmarklet: only install ones from a source you trust and can read. A bookmarklet runs with your login on the site where you click it.

## Limitations

- Claude and ChatGPT don't offer an official API for this. The bookmark uses the same internal interface their websites use, so it can break when they change things.
- Only each chat's current version is exported. If you edited a message, only the latest branch is included. Attachments are listed by name only.
- Google Docs allow up to 100 tabs and about 1M characters per doc. Large archives are split into several docs ("Part 1", "Part 2", …). Google also limits writing speed to about 30 chats per minute.
- Supported sites: claude.ai, chatgpt.com. To add another, add an adapter in `src/bookmarklet.js`.

## Self-hosting

Fork the repo and enable GitHub Pages (Settings → Pages → Deploy from branch → `main` / root). Or upload `index.html` to any static host. After changing anything in `src/`, run `python3 build.py`.

### Enabling Google Doc mode (one-time, ~10 min)

1. Go to [console.cloud.google.com](https://console.cloud.google.com), create a project, then **APIs & Services → Library → Google Docs API → Enable**.
2. **OAuth consent screen**: choose External, fill in the app name and support email, and add the scope `.../auth/drive.file`. Then set the publishing status to **In production**. Because `drive.file` is a non-sensitive scope, no Google review is needed.
3. **Credentials → Create credentials → OAuth client ID → Web application.** Under **Authorized JavaScript origins**, add your site's origin (for example `https://you.github.io`) and `http://localhost:8000` for testing.
4. Paste the client ID into `GOOGLE_CLIENT_ID` in `src/index.src.html`, then run `python3 build.py`.

Until a client ID is set, the Google Doc option shows as "Coming soon".

## Test locally

```bash
python3 build.py
python3 -m http.server 8000   # then open http://localhost:8000
```
