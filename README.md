# DEA-C01 Study

A quiet, static study app for the AWS Certified Data Engineer Associate exam.
No build step, no server, no accounts. Everything runs in the browser.

* **Quiz**: Quick 10, 15 fixed sets of ten, one per exam domain, or "practice my mistakes".
* **Tracks every answer** in your browser (localStorage) so the Mistakes page always shows what to study.
* **Concepts**: plain-language notes with use cases and key facts for ~50 services and ideas, colour-coded by exam domain.
* Domain colours: blue = D1 Ingestion & Transformation, green = D2 Data Store Management, ochre = D3 Operations & Support, mauve = D4 Security & Governance.

## Files

```
index.html
css/style.css
js/app.js
data/concepts.js     my own notes (safe to publish)
data/questions.js    questions parsed from your practice-exam PDF (third-party content, see below)
private/questions-import.json   same questions, for the "import" route (never committed: see .gitignore)
```

## A note on the questions

The questions and explanations come from a commercial practice-exam PDF you own.
Publishing them on a **public** GitHub Pages site would distribute that material.
Pick one of these:

* **Option A, private repo**: keep `data/questions.js` in the repo. GitHub Pages from a private repo needs a paid GitHub plan (Pro, Team, or Enterprise). Anyone with the URL can still open a published Pages site, so treat it as semi-private.
* **Option B, public repo (free)**: delete `data/questions.js` before you commit. The site then publishes only the app and the concept notes. On each device, open **Data -> Import questions file** and choose `private/questions-import.json`. The questions then live only in that browser.

## Deploy to GitHub Pages (about 5 minutes)

1. **Create the repo.** On github.com click **New repository**. Name it e.g. `dea-study`. Choose Public (Option B) or Private (Option A). Do not add a README.
2. **Upload the files.** On the new repo page choose **uploading an existing file**. Drag in the *contents* of this folder: `index.html`, `css/`, `js/`, `data/`, `.nojekyll`, `.gitignore`, `README.md`.
   *Option B: first delete `data/questions.js` and leave out the `private/` folder.* Click **Commit changes**.
   (Command line instead: `git init`, `git add .`, `git commit -m "study app"`, `git branch -M main`, `git remote add origin https://github.com/YOUR-USER/dea-study.git`, `git push -u origin main`.)
3. **Turn on Pages.** Repo **Settings -> Pages**. Under **Build and deployment** set **Source: Deploy from a branch**, **Branch: main**, folder **/ (root)**, then **Save**.
4. **Wait 1-2 minutes**, refresh the Pages screen, and open the URL it shows:
   `https://YOUR-USER.github.io/dea-study/`
5. **On your phone**, open that URL. Use the browser menu **Add to Home Screen** to get an app icon.
6. **Option B only**: on the site go to **Data -> Import questions file** and pick `questions-import.json` (put it in iCloud Drive, Google Drive, or email it to yourself to reach the phone).

### Updating later
Edit or upload the changed file in the repo and commit. Pages redeploys on its own. Your progress is stored per browser and survives updates.

### Things to know
* Progress is stored in the browser you use (laptop and phone are separate). Use **Data -> Export progress / Import progress** to move it.
* Clearing site data erases progress. Export a copy now and then.
* To try it locally, just double-click `index.html`.

## Adding or changing questions
Question files are JSON: `{"questions":[...],"sets":[[ids]...]}` where each question is
`{"id":"q001","test":1,"d":1-4,"q":"text","m":false,"o":[{"t":"option","c":1,"w":"why wrong"}],"e":["explanation"],"p":"c|w|s","tags":["glue"]}`
(`c:1` marks a correct option; `p` is how you did in the earlier exam: c = correct, w = wrong, s = skipped.)
