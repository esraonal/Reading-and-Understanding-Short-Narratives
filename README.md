# Narratives: 12-list counterbalanced jsPsych experiment (compact critical window, shuffled answers)

This study uses **36 narratives** and **12 predicate × access combinations** (looks / sounds / seems × both / visual-only / auditory-only / neither). Every participant sees **each narrative once**. The 36 trials are distributed so each participant encounters **exactly three narratives in each of the 12 combinations**. There are **no fillers**.

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

The tests verify all 12 lists: 36 unique narratives per list, 3 items per condition, complete 12-cell coverage for every item across lists, matching impression questions, and unchanged presentation behavior.

## 3. Participant experience

1. A brief instruction screen and a fixation cross before each narrative.
2. Four context sentences appear **cumulatively from top to bottom in one fixed window**. The newest sentence is **bold**, and earlier sentences remain visible in regular type. The last context display ends with **and**.
3. After another Space press, the context disappears, and the critical continuation **after “and”** starts word-by-word self-paced reading in the **same Georgia font**, within a smaller, centered box sized to the continuation instead of the large context box. The other word positions are shown as spaced, stationary dashes; no words shift as a word is revealed. Word-level RTs are recorded after “and,” including target, predicate, modifier, adjective, and spillover.
4. Four numbered, **required** multiple-choice questions appear: location, impression source, perceptual access, and reader activity. The impression question always uses the item's assigned predicate (*looked/sounded/seemed*). Questions and options use smaller regular-weight type. Answer choices are **not numbered** and are **independently shuffled for each participant and question**; stored answer keys still point to the original source-option indices.
5. The fifth, **required** question is the emotional plausibility rating on a **1–5** scale. The ordered rating points are intentionally **not shuffled**. The source's 18 matching and 18 opposite-adjective questions are preserved.
6. Breaks appear after items 12 and 24; all 36 narratives are presented, in randomized order.

## 4. In-person school lab: Sona and OSF

This project is still configured for **local pilot mode**. Sona is a participant recruitment/credit system, not automatically an experiment host or list allocator. OSF is a research repository, not automatically connected as a live jsPsych response receiver. The current files do **not** directly upload results to OSF and do **not** use Sona to assign lists. During local pilots, each participant's data downloads on the lab computer at the end. Treat those CSVs as confidential research data according to your lab's approved storage protocol.

Before collecting study data, use a shared 12-list assignment ledger or approved server-side allocator across the lab computers; test automatic or operator-managed saving to your institution-approved secure location; and define when, if permitted, data will be deposited in OSF. Do not rely on independent random assignment in each browser to balance lists. Save no names, Sona identifiers, or other directly identifying data in the behavioral CSV unless covered by your approved protocol.

## 5. Alternative online deployment: allocate lists and save data

The default `config.js` mode is **pilot**, not a recruitment-ready deployment.

1. Set up a DataPipe experiment and a secure storage destination. In its dashboard enable allocation of **12 conditions** (here these are **counterbalancing list allocation slots**, not the experiment's 12 predicate × access conditions) and online data saving. Confirm the actual service behavior before recruitment.
2. In `config.js`, set `mode: 'datapipe'` and a real 12-character `datapipeExperimentId`. Host the project over HTTPS.
3. Production maps the sequential 0–11 allocation slots through a fixed shuffled order `[7,2,11,4,9,0,5,1,10,6,3,8]` to the 12 lists. **This is allocation balance with a fixed permuted order, not independently reshuffled blocks.** Replacing dropouts and achieving equal *completed* numbers requires tracking list-specific completion counts.
4. Test real submissions and data access in your host environment before recruiting. Do not collect actual participants using pilot local downloads.

## 6. Data and checking coverage

Each jsPsych output CSV has one row per event. Key fields are `participant_id`, `prolific_pid`, `list_num`, `item_num`, `item_id`, `item_position`, `condition_num`, `predicate`, `access`, `visual`, `auditory`, `phase`, `region`, `word`, and `rt`. `list_num` is fixed across the participant; **`condition_num`, `predicate`, and `access` vary across their 36 narratives**. The impression-source question uses the correct predicate for each narrative. The plausibility score is recorded as `q_plausibility_rating` (1–5). Multiple-choice `q_*_answer` columns retain the **original 1-based option index** for scoring even after shuffling; `q_*_shown_at` records the displayed position, and `q_*_order` records the randomized display order. The final event has `phase=end` and `completed=true`.

Collect downloaded participant CSVs in a `results/` directory and run:

```bash
python3 tools/check_counts.py results
```

It exports `list_counts.csv` (started/complete/valid by list), `condition_counts.csv` (valid observed item trials by condition), and `item_cell_counts.csv` (the 432 item × condition combinations). Completed counts can differ from assigned counts if participants drop out.

## 7. Editing stimuli

The two source CSV files live at `data/stimuli.csv` and `data/questions.csv`. The stimuli CSV has all 432 possible item versions; the participant gets just 36. `critical` must begin with `and `, and the program shows this conjunction at the end of the context, not as a self-paced word. If you edit source CSVs, keep all 12 variants of every item and match question 2 to *looked/sounded/seemed* for each assigned predicate. The experiment checks that the stimulus tables have all required entries.

The supplied text is preserved, including source phrases previously flagged for potential revision (e.g., #4's “to be not interested” and #29's “insulated window”). Those editorial issues are separate from counterbalancing.

## 8. References

Pinned CDN packages in `index.html`: jsPsych 8.3.0, html-keyboard-response 2.2.0, survey-multi-choice 2.2.1, survey-likert 2.2.0, pipe extension 0.2.0.

- https://www.jspsych.org/v8/plugins/html-keyboard-response/
- https://www.jspsych.org/v8/plugins/survey-multi-choice/
- https://www.jspsych.org/v8/plugins/survey-likert/
- https://www.jspsych.org/v8/extensions/pipe/
- https://pipe.jspsych.org/docs/experiments/conditions
