# Water reminder

A local web checklist for two rounds of the requested drinking schedule. Choose a start date and time, check off each drink, and optionally enable browser notifications. Progress is saved in this browser. The Obsidian button downloads a Markdown checklist reflecting the current checked items. The calendar button downloads 18 events with alarms that you can import for alerts after the web page is closed.

## Run

```sh
npm run dev
```

Open <http://localhost:4173> and create a schedule. No dependencies or account are required. The files served to visitors are in `public/`; tests and project files remain outside that directory.

## Deploy on Vercel

This project is connected to [bvidakovic/drink-reminder](https://github.com/bvidakovic/drink-reminder). After the first commit is pushed, choose **Add New Project** in Vercel, import that repository, and keep the root directory at the repository root. The included `vercel.json` selects the **Other** framework preset, skips a build, and serves `public/`. No environment variables are needed.

Every GitHub push and pull request runs the schedule tests. Deployments are handled by Vercel after you connect the repository. Progress is stored in each visitor's browser, so it does not sync between devices or browsers.

## Timing

Each round has four 375 mL glasses: one at the start, then at 15, 30, and 45 minutes. After the first hour comes a 30 minute break, then five 300 mL drinks, one hour apart. After the five-hour phase and a one-hour break, the second round begins. The full checklist contains 18 drinks and 6 L.

Browser notifications need permission and the page to remain open. Browser timers may delay an alert when the computer sleeps. Calendar alerts depend on your calendar app and its notification settings; they do not clear when you check off a drink here. Overdue drinks remain due in the checklist when you return; completion always requires checking the item yourself.
