# GitHub Pages deployment and data collection

This folder contains the latest **36-narrative, 12-list** jsPsych experiment with compact critical-word display, fixed dashes, and randomized unnumbered answer choices.

## A. Publish using GitHub Pages

1. Sign in to GitHub and create a repository (e.g., `narrative-reading-study`). Check with your supervisor whether a public repository for stimuli is acceptable: on GitHub Pages, the deployed site and stimulus files are publicly accessible, even if the URL is not advertised.
2. In your new repository, choose **Add file → Upload files**. Upload **the contents of this folder**, keeping `index.html`, `config.js`, `practice.js`, `experiment.js`, `style.css` and `data/` at the repository root. Do not upload the ZIP as a single file or place everything under an extra enclosing directory.
3. Commit the upload to the `main` branch.
4. Go to **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a branch**, select **main** and **/(root)**, then save.
5. Once Pages publishes, the experiment URL will normally be `https://YOUR_USERNAME.github.io/REPOSITORY_NAME/`.
6. Test locally, or with `?list=0` through `?list=11` **only while in pilot mode**. URL list overrides are not the production list allocator.

Source: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## B. Data saving: OSF limitations as of November 2026

DataPipe's OSF destination **stops accepting new writes November 16, 2026**. In addition, existing OSF Projects become read-only on **February 19, 2027**. Therefore, do not build a new collection pipeline that depends on sending participant files to OSF. OSF is still useful for preregistration and for linking to appropriate deidentified research outputs.

Official sources:
- https://pipe.jspsych.org/getting-started
- https://help.osf.io/article/727-osf-projects-transition
- https://help.osf.io/article/744-osf-projects-api-impact

## C. Supported collection path: DataPipe to institution-approved storage

1. Visit https://pipe.jspsych.org/getting-started and sign up.
2. Connect Google Drive (if approved for this study), your institution's Dataverse instance, or Zenodo. Obtain institutional research-data/privacy approval before collecting participants' data. Avoid publicly depositing raw participant response files.
3. Create a DataPipe experiment associated with that provider. Enable data collection and enable **12 conditions** in DataPipe. Here each DataPipe condition is one **counterbalancing-list slot** (not one predicate/access treatment). The code maps slots to shuffled list labels.
4. Copy the **12-character experiment ID** from the dashboard. In `config.js`, set `mode: 'datapipe'` and set `datapipeExperimentId` to the real ID.
5. Commit and push the modified `config.js` to GitHub. The experiment ID is an identifier, *not* a secret storage API key. NEVER insert your OSF/Google/Dataverse API access tokens into browser JavaScript.
6. Run at least one test participant and verify that the received dataset has `participant_id`, `list_num`, `item_num`, `predicate`, `access`, `phase`, `word`, `rt`, all responses and a final `completed=true` record.
7. Check the DataPipe dashboard and the destination folder for successful saves, and test a deliberately incomplete session to confirm partial-data handling. Distinguish completed participants from started/allocated participants in balancing decisions.

Current jsPsych integration is already present in `experiment.js` and `index.html`; there is no need to add a separate save button.

Sources:
- https://pipe.jspsych.org/docs/experiments/sending-data
- https://pipe.jspsych.org/docs/experiments/conditions
- https://www.jspsych.org/v8/extensions/pipe/

## D. In-person Sona workflow

- Sona schedules lab appointments/awards credit; it does not host the study or automatically choose lists in this project.
- On each school computer use the **same** GitHub Pages experiment URL **without `?list=`** after production mode has been configured. DataPipe will assign a slot centrally, making simultaneous starts safe from slot collisions.
- Keep participant names and Sona IDs separate from the reading-time CSVs; use anonymous session IDs. Obtain any required IRB/institutional approval.
- Your design has **36 distinct narratives per participant**, and **three trials per each of the 12 predicate × access cells**. Across a balanced cohort of 12 lists, each narrative is presented in each condition once. Monitor **valid completions per list**; sequential slots balance assignments, not dropouts.
- Use `node tools/test_design.mjs` and `python3 tools/check_counts.py results` to verify design and data coverage.

**Deployment checklist:** [ ] Pages URL opens [ ] 12-condition DataPipe destination created [ ] config production settings updated [ ] school-network connectivity checked [ ] one complete save verified [ ] incomplete-session save handling checked [ ] completion balancing plan approved.

## E. Practice tutorial

This build has one repeatable tutorial narrative (`practice.js`) before the 36 experimental trials. The tutorial includes four cumulative context screens, word-by-word continuation, and five required comprehension questions. After each practice attempt, participants choose **Try practice again** (repeat the same narrative and questions) or **Start experiment**. Only selecting **Start experiment** moves the participant to the 36 main narratives. All practice attempts are tagged `task=practice` and `practice_attempt=N`; `tools/check_counts.py` excludes them. Use `practiceItems: 0` in `config.js` to disable practice (default: `1`).
