# Owlery

A small shared PWA for two people far apart: an hour-by-hour calendar of when you're busy or free (with repeating blocks and a week view), day plans and dinner voting, owl-post photos with GIFs and moods, typed and drawn notes, and a daily Bible check with a verse of the day (KJV).

No build step, no dependencies: plain HTML, CSS and JavaScript.

## Run it on your computer

1. Copy `config.example.js` to `config.js` and fill in your keys (`config.js` is gitignored and never leaves your computer).
2. `npx http-server . -p 5173`, then open http://localhost:5173

## Put it online (GitHub Pages)

Your real keys are **not** in this repo. GitHub writes `config.js` at deploy time from encrypted Secrets, and the workflow publishes only the app files (not this README, the SQL, the scripts or the tests).

1. Push this repo to GitHub.
2. **Settings → Secrets and variables → Actions → New repository secret**, add two:
   - `SUPABASE_URL`: your project URL
   - `SUPABASE_KEY`: the **publishable** key (`sb_publishable_...`). Never the secret / service_role key.
3. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
4. Push to `main` (or run the workflow from the Actions tab). The site appears at `https://<username>.github.io/<repo>/`.
5. On each phone open that link and **Add to Home Screen**.

Be aware: the browser needs the Supabase URL and publishable key to talk to the database, so they are visible to anyone who opens the site and looks at the page's code. That is by design; your data is protected by sign-in and row-level security, not by hiding that key. In Supabase turn **off** "Allow new users to sign up" so only your two accounts can ever log in.

## GIF search (the Giphy key stays private)

The Giphy key is **not** in the app, the repo, or GitHub Secrets. GIF search goes through a small Supabase Edge Function (`supabase/functions/giphy/index.ts`) that holds the key and only answers the two signed-in members.

1. Get a free key at developers.giphy.com (create an app, choose **API**).
2. Supabase dashboard → **Edge Functions → Deploy a new function → Via Editor**. Paste the contents of `supabase/functions/giphy/index.ts` and deploy. Supabase gives the function its own URL name (for example `dynamic-endpoint`); renaming it in Settings only changes the label. The app calls the name in `GIF_FN` near the top of the GIF code in `app.js`, so keep that in sync with the function's URL name. (The function checks the signed-in user itself, so **Verify JWT** can be on or off. If searches fail with "Invalid JWT", turn it off.)
3. Same section → **Secrets** → add `GIPHY_KEY` with your key. (Optional: `ALLOWED_ORIGINS`, comma-separated, if your site address changes.)
4. Open the app, sign in, and try the GIF picker.

## Before you commit

Run `sh scripts/check-secrets.sh` after `git add`. It blocks real keys, your `config.js`, the project URL, secret/service_role keys, database passwords, private keys, email addresses and personal file paths. To run it on every commit automatically: `cp scripts/check-secrets.sh .git/hooks/pre-commit`. On GitHub also turn on **Settings → Code security → Secret scanning and Push protection**.

## Database

`supabase/schema.sql` creates the tables and the row-level-security rules (only the two members can read or write). Run it in the Supabase SQL Editor, then follow the last step in the file to link your two accounts.
