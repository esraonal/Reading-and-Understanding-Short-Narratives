# Narratives: 12-list counterbalanced jsPsych experiment (compact critical window, shuffled answers)

This study uses **36 narratives** and **12 predicate × access combinations** (looks / sounds / seems × both / visual-only / auditory-only / neither). Every participant sees **each narrative once**. The 36 trials are distributed so each participant encounters **exactly three narratives in each of the 12 combinations**. There are **no fillers**. The study starts with **one required practice story, which participants may repeat once if they choose** before starting the 36 experimental items.

**The counterbalancing list is assigned between participants; predicate and access vary within a participant across narratives.** Thus the experimental factors are within-participant, while each narrative is presented in only one of its 12 forms per participant. This should be modeled accordingly in analysis, with participant and item variability considered.

## 1. Counterbalancing logic

There are **12 fixed lists numbered 0–11**. Each list contains exactly 36 items and exactly 3 observations in each condition. Item-to-condition assignments change between lists: each narrative appears **once per condition across the full set of 12 lists**. This is a rotated Latin-square-style list design, not 12! independent arbitrary permutations.

`design/counterbalance_lists.csv` lists the complete assignments. `experiment.js` generates each list using a fixed, item-balanced base permutation plus a list-dependent rotation. The code **shuffles the order of the 36 narratives independently for every participant**, but not their within-list condition assignments. Do not re-randomize the 12 condition assignments independently for each participant: that would undermine balanced per-item exposure.

For example, with one *valid completed* participant per list (12 participants total), **every item will have been observed once in each of its 12 conditions**. With 10 valid completed participants per list (120 total), every item-condition combination has 10 observations. These are allocation examples, not sample-size or power recommendations.

**Important:** Randomly assigning 12 list labels client-side does *not* guarantee balance over recruited participants. Production assignment requires a shared, server-backed list allocator. The included DataPipe option uses a *fixed shuffled ordering* of the 12 list labels with its sequential condition counter, ensuring balanced **allocations** after each group of 12 (subject to service behavior), but the shuffle order repeats rather than being regenerated for each block. Dropouts still cause imbalanced **completed** counts; monitor valid completes and recruit additional participants in underfilled lists if needed. Truly fresh randomized blocks with completion quotas require a dedicated server-side allocator.

## 2. Local pilot

From the extracted project directory, run:

```bash
python3 -m http.server 8000
```

Open **http://localhost:8000/?list=0** in a browser. Change `list=0` through `list=11` to inspect other lists. `?list=` replaces the old `?condition=` pilot parameter, because every list contains *all 12* experimental conditions. The default `mode: 'pilot'` selects a random list for manual testing if you omit the parameter. The experiment downloads a local participant CSV at the end of a pilot. An internet connection is required for the pinned jsPsych JavaScript libraries.

Run the design tests:

```bash
node tools/test_design.mjs
```

The tests verify all 12 lists: 36 unique experimental narratives per list (plus one repeatable practice story), 3 items per condition, complete 12-cell coverage for every item across lists, matching impression questions, and unchanged presentation behavior.

## 3. Participant experience

1. A brief instruction screen followed by **one practice story** (rocket landing). It uses the same four cumulative context sentences, word-by-word continuation after **and**, four required multiple-choice questions with shuffled options, and a required 1–5 plausibility question. After completing the five questions, participants choose **Repeat practice** or **Start experiment**. If they repeat it, the story and questions appear exactly one more time, then the main experiment begins automatically after a short instruction screen. The repeat is optional, but the first practice round is mandatory. Practice is **not** part of the 36 items or the 12-list counterbalancing.
2. A fixation cross before each main narrative.
3. Four context sentences appear **cumulatively from top to bottom in one fixed window**. The newest sentence is **bold**, and earlier sentences remain visible in regular type. The last context display ends with **and**.
4. After another Space press, the context disappears, and the critical continuation **after “and”** starts word-by-word self-paced reading in the **same Arial font (22 px)**, in a compact, centered display with no box border, trial number, or on-screen prompt. Every hidden word shows exactly **three dashes (`---`)**, with 22 px gaps between reserved word slots. No words or dashes shift as a word is revealed. Word-level RTs are recorded after “and,” including target, predicate, modifier, adjective, and spillover.
5. Four numbered, **required** multiple-choice questions appear: location, impression source, perceptual access, and reader activity. The impression question always uses the item's assigned predicate (*looked/sounded/seemed*). Questions and options use smaller regular-weight type. Answer choices are **not numbered** and are **independently shuffled for each participant and question**; stored answer keys still point to the original source-option indices.
6. The fifth, **required** question is the emotional plausibility rating on a **1–5** scale. The ordered rating points are intentionally **not shuffled**. The source's 18 matching and 18 opposite-adjective questions are preserved.
7. Breaks appear after items 12 and 24; all 36 narratives are presented, in randomized order.

## 4. In-person school lab: Sona and Google Drive

This package is configured for **DataPipe mode** using the experiment ID in `config.js`, with GitHub Pages intended for hosting and an institution-approved Google Drive destination intended for saving responses. It has not been live-tested against the account. Sona handles lab appointments/credit, not data collection. Keep the response files separate from Sona identities and verify your university's research-data approval before running participants. To test with a local downloadable CSV instead, temporarily set `mode: 'pilot'` in `config.js`.

Practice rows are tagged `task=practice`, `is_practice=true`, and `practice_attempt=1` or `2`, with ID `practice_rocket`. Repeated practice is kept separate from the 36 experimental narratives. All experimental trials are tagged `task=narrative`. Exclude `task=practice` from the primary analyses. The included `tools/check_counts.py` excludes practice. Set `practiceItems: 0` in `config.js` to disable practice entirely (default: `1`).

Before collecting study data, use a shared 12-list assignment ledger or approved server-side allocator across the lab computers; test automatic or operator-managed saving to your institution-approved secure location; and define when, if permitted, data will be deposited in OSF. Do not rely on independent random assignment in each browser to balance lists. Save no names, Sona identifiers, or other directly identifying data in the behavioral CSV unless covered by your approved protocol.

## 5. Alternative online deployment: allocate lists and save data

The current `config.js` mode is **datapipe**. Do not begin recruitment until the GitHub Pages link and Google Drive data saves have been tested end-to-end.

1. Confirm your DataPipe experiment uses an approved Google Drive folder, with **12 allocation conditions** (these correspond to counterbalancing lists, not fixed predicate × access assignments).
2. Verify `config.js` has `mode: 'datapipe'` and the correct 12-character `datapipeExperimentId`, and host the project over HTTPS.
3. Production maps the sequential 0–11 allocation slots through a fixed shuffled order `[7,2,11,4,9,0,5,1,10,6,3,8]` to the 12 lists. **This is allocation balance with a fixed permuted order, not independently reshuffled blocks.** Replacing dropouts and achieving equal *completed* numbers requires tracking list-specific completion counts.
4. Test real submissions and data access in your host environment before recruiting. Do not collect actual participants using pilot local downloads.

## 6. Data and checking coverage

Each jsPsych output CSV has one row per event, including labeled practice events and experimental events. Key fields are `participant_id`, `prolific_pid`, `list_num`, `item_num`, `item_id`, `item_position`, `condition_num`, `predicate`, `access`, `visual`, `auditory`, `phase`, `region`, `word`, and `rt`. `list_num` is fixed across the participant; **`condition_num`, `predicate`, and `access` vary across their 36 narratives**. The impression-source question uses the correct predicate for each narrative. The plausibility score is recorded as `q_plausibility_rating` (1–5). Multiple-choice `q_*_answer` columns retain the **original 1-based option index** for scoring even after shuffling; `q_*_shown_at` records the displayed position, and `q_*_order` records the randomized display order. The final event has `phase=end` and `completed=true`.

Collect downloaded participant CSVs in a `results/` directory and run:

```bash
python3 tools/check_counts.py results
```

It exports `list_counts.csv` (started/complete/valid by list), `condition_counts.csv` (valid observed item trials by condition), and `item_cell_counts.csv` (the 432 item × condition combinations). Completed counts can differ from assigned counts if participants drop out.

## 7. Editing stimuli

The two source CSV files live at `data/stimuli.csv` and `data/questions.csv`. The stimuli CSV has all 432 possible item versions; the participant gets just 36. `critical` must begin with `and `, and the program shows this conjunction at the end of the context, not as a self-paced word. If you edit source CSVs, keep all 12 variants of every item and match question 2 to *looked/sounded/seemed* for each assigned predicate. The experiment checks that the stimulus tables have all required entries.

The supplied text is preserved, including source phrases previously flagged for potential revision (e.g., #4's “to be not interested” and #29's “insulated window”). Those editorial issues are separate from counterbalancing.

## Display-width audit for the critical continuation

The 36 scenarios × 3 predicate versions plus the practice trial give **109 distinct critical continuations** (access variants repeat the same wording). I checked **every word** using browser-rendered Arial at 22 px and tested the word positions as the active word changes. The critical continuations range from **7 to 10 words**. The widest individual word slot is about **131 px** (e.g., *overwhelmed*), and the widest full continuation is approximately **681 px** including the consistent 22 px gaps. A centered, **720 px-wide** region therefore fits every critical continuation on a single line on standard desktop displays, while retaining the identical starting x-coordinate. Narrow screens may wrap, but positions remain fixed as the revealed word changes.

Two files document the audit: `design/critical_word_spacing_audit.csv` (one line per critical continuation) and `design/critical_word_slot_audit.csv` (one line per word). The three dashes are placeholders, **not** an estimate of actual word length.

## 8. References

Pinned CDN packages in `index.html`: jsPsych 8.3.0, html-keyboard-response 2.2.0, survey-multi-choice 2.2.1, survey-likert 2.2.0, pipe extension 0.2.0.

- https://www.jspsych.org/v8/plugins/html-keyboard-response/
- https://www.jspsych.org/v8/plugins/survey-multi-choice/
- https://www.jspsych.org/v8/plugins/survey-likert/
- https://www.jspsych.org/v8/extensions/pipe/
- https://pipe.jspsych.org/docs/experiments/conditions

## Minimal visual layout (Arial edition)

The study uses a white background and black Arial text, without shadows or decorative cards. Narrative context and critical continuation both use **Arial 22 px**; only the latest context sentence is bold. The critical continuation uses an invisible, centered 720 px-wide reading area with all first words aligned to the same left position, and exactly three stationary dashes for every hidden word. Questions use regular Arial 20 px and options use regular Arial 18 px, without numbering on the options. Buttons use white text on a near-black background. These are visual changes only and do not affect word-level timing, the 12 lists, required answers, or DataPipe/Google Drive configuration.

## Tutorial scenarios

The single tutorial narrative is defined in `practice.js`, not in the experimental CSVs. It illustrates visual-only × looks. Participants must complete it once and may repeat it exactly one more time before beginning the main experiment. The optional repeat includes all five required questions and does not offer a further repeat. The multiple-choice options are shuffled when the experiment is built. Practice data are marked with `practice_attempt` and excluded from analyses of the 36 experimental items. DataPipe assigns the counterbalancing list once per participant, not once per practice attempt.


### One required practice with an optional repeat

The project loads the jsPsych `html-button-response` plugin (version 2.1.0) for the two practice-choice buttons. GitHub Pages must be able to load the plugin CDN, as with the other jsPsych plugins. After selecting **Start experiment**, practice cannot be replayed; participants who choose **Repeat practice** automatically move on after the second completion.

## Distraction-free self-paced reading screen

The timed continuation now contains **only the currently visible word and the stationary dashed word positions**. The story counter, instruction footer ("Press Space..."), panel outline, and extra padding are removed **only on the self-paced reading screen**. Practice and opening instructions still explain Space before timing begins. The narrative context remains in its fixed, cumulative box, and all word RTs, list counterbalancing, questions, mandatory rocket practice with an optional repeat, and DataPipe settings are unchanged.


## Latest presentation refinements

- All critical continuations start at the **same left-aligned text edge** of a centered 720 px reading region, including short and long items. The reading area remains unbordered and visually minimal. Each hidden word appears as `---`. The 22 px spacing between slots is fixed, and every slot reserves the full width of its actual word to prevent shifting.
- Question screens are **top-anchored** with ample top padding and page scrolling when necessary; the first question should not be cut off on shorter monitors.
- More vertical space separates question prompts, choices, and individual questions. Fonts remain Arial and regular weight.
- Only the tutorial-choice logic and button spacing changed in this update; word timing, list assignment, and DataPipe settings are unchanged.

## Final question-page refinements

- Question-page headings and prompts now begin farther below the top of the viewport (128–170 px on desktop; 88 px on narrow screens). Pages remain scrollable.
- Q5 uses the entire question width; the first Likert option aligns with the left edge of the question, the fifth aligns to the right. Rating values remain required and scored 1–5.
- The participant-facing practice decision button now reads **Repeat practice** (not **Repeat practice once**). The experiment still allows no more than one optional repeat after the mandatory attempt.
