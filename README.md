# Water reminder

A web checklist for two rounds of the requested drinking schedule. Choose a start date and time, check off each drink, and optionally enable browser notifications. Progress is saved in this browser and can be synced across devices after Vercel storage is configured. The Obsidian button downloads a Markdown checklist reflecting the current checked items. The calendar button downloads 18 events with alarms that you can import for alerts after the web page is closed.

## Run

```sh
npm run dev
```

Open <http://localhost:4173> and create a schedule. Local checklists work without an account. The local Python server serves the static app; the sync API runs after deployment to Vercel. The files served to visitors are in `public/`; tests and project files remain outside that directory.

## Deploy on Vercel

This project is connected to [bvidakovic/drink-reminder](https://github.com/bvidakovic/drink-reminder). Choose **Add New Project** in Vercel, import the repository, and keep the root directory at the repository root. The included `vercel.json` selects the **Other** framework preset, skips a build, and serves `public/`. The static checklist works before sync storage is configured.

Every GitHub push and pull request runs the tests. Deployments are handled by Vercel after you connect the repository.

## Sync phone and computer

Vercel Blob is free within the Hobby plan's included limits. In the Vercel project, create a **private** Blob store and connect it to this project. Vercel provides `BLOB_READ_WRITE_TOKEN` to the deployment. Generate a long secret code locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`, then add it as the `SYNC_KEY` environment variable in Vercel Project Settings. Keep that code private and never commit it. Redeploy after adding the store and variable.

Open the deployed app on the first device, enter the code in **Keep your progress together**, and click **Connect device**. It uploads that device's existing checklist. On the second device, enter the same code to load it. The first connection to an existing synced checklist asks before replacing local progress. The app syncs after each change, when reopened, and periodically while visible. Changes made offline stay on the device and are sent when it reconnects. **Sync now** requests an immediate refresh. **Disconnect** keeps a local copy.

The shared code grants access to this one checklist. Anyone with it could read and change your progress, so share it only between your own devices. Sync uses private server-side Blob storage; the token is never sent to browsers. The current app does not send mobile push notifications while closed.

## Timing

Each round has four 375 mL glasses: one at the start, then at 15, 30, and 45 minutes. After the first hour comes a 30 minute break, then five 300 mL drinks, one hour apart. After the five-hour phase and a one-hour break, the second round begins. The full checklist contains 18 drinks and 6 L.

Browser notifications need permission and the page to remain open. Browser timers may delay an alert when the computer sleeps. Calendar alerts depend on your calendar app and its notification settings; they do not clear when you check off a drink here. Overdue drinks remain due in the checklist when you return; completion always requires checking the item yourself.
