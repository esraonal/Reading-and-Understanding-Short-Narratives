'use strict';

// 3 predicates x 4 access conditions = 12 cells.
// Each participant reads THREE DIFFERENT narratives per cell (36 narratives total).
// Across 12 counterbalancing lists each narrative appears once in every cell.
const PREDICATES = ['looks', 'sounds', 'seems'];
const ACCESSES = ['both', 'visual_only', 'auditory_only', 'neither'];
const NUM_ITEMS = 36;
const NUM_CELLS = 12;
const NUM_LISTS = 12;
// Each consecutive group of 12 items has one instance of every base cell.
// Fixed across participants: NEVER randomize these mappings independently in browsers.
// The list rotation adds an offset modulo 12, so every item visits every cell.
const BASE_CELL_BY_ITEM = [
  2, 7, 11, 0, 5, 9, 4, 1, 10, 6, 3, 8,
  9, 3, 5, 11, 1, 6, 0, 8, 2, 10, 7, 4,
  4, 10, 0, 6, 8, 2, 11, 5, 7, 3, 1, 9
];
// One fixed, shuffled order of list labels for sequential DataPipe allocations.
// This balances *allocated lists* per block of 12; it does not re-shuffle each
// block or guarantee balanced numbers of completed participants after dropout.
const ALLOCATION_LIST_ORDER = [7, 2, 11, 4, 9, 0, 5, 1, 10, 6, 3, 8];
const CONFIG = window.EXPERIMENT_CONFIG;

// The CSV uses e.g. "visual_only" rather than "visual-only".
// The participant's LIST is fixed, but the CONDITION varies across narratives.

function parseCSV(csv) {
  const text = csv.replace(/^\uFEFF/, '');
  const records = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        if (row.some(x => x !== '')) records.push(row);
        row = []; field = '';
      } else field += c;
    }
  }
  if (inQuotes) throw new Error('Malformed CSV: missing closing quote.');
  if (row.length || field !== '') { row.push(field); records.push(row); }
  const [columns, ...data] = records;
  if (!columns?.length) throw new Error('CSV is empty.');
  return data.map((values, i) => {
    if (values.length !== columns.length)
      throw new Error(`CSV row ${i + 2} has ${values.length} fields; expected ${columns.length}.`);
    return Object.fromEntries(columns.map((name, j) => [name, values[j]]));
  });
}

async function loadCSV(file) {
  const response = await fetch(file, {cache: 'no-store'});
  if (!response.ok) throw new Error(`Unable to load ${file}: HTTP ${response.status}`);
  return parseCSV(await response.text());
}

function esc(input) {
  return String(input).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function words(text) { return text.trim().split(/\s+/u).filter(Boolean); }
function normalizeAccess(value) { return value.trim().toLowerCase().replace(/[\s-]+/g, '_'); }
function notEmpty(array) { return array.filter(x => String(x || '').trim()); }
function parseKey(value) { const k = Number(value); return Number.isInteger(k) ? k : NaN; }

function validateData(rows, questionRows) {
  if (rows.length !== NUM_ITEMS * NUM_CELLS) throw new Error(`Expected 432 stimuli, found ${rows.length}.`);
  const seen = new Set();
  const itemIds = new Set();
  const questionIds = new Set(questionRows.map(q => q.item_id));
  if (questionIds.size !== NUM_ITEMS || questionRows.length !== NUM_ITEMS)
    throw new Error('Expected exactly 36 question-option records with unique item_id values.');
  for (const row of rows) {
    const a = normalizeAccess(row.access);
    const key = `${row.item_id}|${row.predicate}|${a}`;
    if (seen.has(key)) throw new Error(`Duplicate stimulus: ${key}`);
    seen.add(key); itemIds.add(row.item_id);
    if (!PREDICATES.includes(row.predicate) || !ACCESSES.includes(a))
      throw new Error(`Unknown predicate/access: ${key}`);
    if (!questionIds.has(row.item_id)) throw new Error(`Missing question options for ${row.item_id}`);
    if (!words(row.critical).length || !words(row.event).length)
      throw new Error(`Missing event/critical text: ${key}`);
    const expectedVerb = {looks: 'looked', sounds: 'sounded', seems: 'seemed'}[row.predicate];
    if (!row.q_impression.includes(` ${expectedVerb} `))
      throw new Error(`Q2 does not match the predicate in ${key}`);
    if (!/^and\s+/iu.test(row.critical.trim()))
      throw new Error(`Critical text must begin with 'and': ${key}`);
    if (parseKey(row.access_key) < 1 || parseKey(row.access_key) > 4)
      throw new Error(`Invalid access answer key in ${key}`);
  }
  if (itemIds.size !== NUM_ITEMS) throw new Error(`Expected 36 distinct narratives, found ${itemIds.size}.`);
  for (const predicate of PREDICATES) {
    for (const access of ACCESSES) {
      const subset = rows.filter(r => r.predicate === predicate && normalizeAccess(r.access) === access);
      if (subset.length !== NUM_ITEMS || new Set(subset.map(r => r.item_id)).size !== NUM_ITEMS)
        throw new Error(`Incomplete condition: ${predicate} × ${access}`);
    }
  }
  return true;
}

function cellFromNumber(n) {
  if (!Number.isInteger(n) || n < 0 || n >= NUM_CELLS)
    throw new Error(`Cell must be an integer from 0 to 11, got: ${n}`);
  return {
    cell: n,
    predicate: PREDICATES[Math.floor(n / ACCESSES.length)],
    access: ACCESSES[n % ACCESSES.length]
  };
}

function listFromNumber(n) {
  if (!Number.isInteger(n) || n < 0 || n >= NUM_LISTS)
    throw new Error(`Counterbalancing list must be an integer from 0 to 11, got: ${n}`);
  return {list: n};
}

function assignedCell(itemNum, listNum) {
  if (!Number.isInteger(itemNum) || itemNum < 1 || itemNum > NUM_ITEMS)
    throw new Error(`Invalid item number: ${itemNum}`);
  if (!Number.isInteger(listNum) || listNum < 0 || listNum >= NUM_LISTS)
    throw new Error(`Invalid list number: ${listNum}`);
  return cellFromNumber((BASE_CELL_BY_ITEM[itemNum - 1] + listNum) % NUM_CELLS);
}

// Pick exactly one version per item, and three items in every predicate x access cell.
function selectList(rows, listNum) {
  const lookup = new Map(rows.map(r => [
    `${r.item_num}|${r.predicate}|${normalizeAccess(r.access)}`, r
  ]));
  const selected = [];
  const perCell = Array(NUM_CELLS).fill(0);
  const items = new Set();
  for (let itemNum = 1; itemNum <= NUM_ITEMS; itemNum++) {
    const cell = assignedCell(itemNum, listNum);
    const row = lookup.get(`${itemNum}|${cell.predicate}|${cell.access}`);
    if (!row) throw new Error(`Missing stimulus for item ${itemNum}, ${cell.predicate} x ${cell.access}`);
    if (items.has(row.item_id)) throw new Error(`Repeated narrative in list ${listNum}: ${row.item_id}`);
    items.add(row.item_id);
    selected.push(row);
    perCell[cell.cell]++;
  }
  if (selected.length !== NUM_ITEMS || perCell.some(n => n !== 3))
    throw new Error(`List ${listNum} is not balanced: ${perCell.join(',')}`);
  return selected;
}

async function getAssignment() {
  const url = new URL(window.location.href);
  if (CONFIG.mode === 'datapipe') {
    if (!/^[A-Za-z0-9]{12}$/.test(CONFIG.datapipeExperimentId))
      throw new Error('Set a valid 12-character datapipeExperimentId in config.js.');
    // DataPipe issues 0..11 sequentially. Translate through a fixed permutation
    // of the 12 LIST IDs, not through a fixed predicate/access condition.
    const allocationNumber = Number(await jsPsychExtensionPipe.getCondition(CONFIG.datapipeExperimentId));
    if (!Number.isInteger(allocationNumber) || allocationNumber < 0 || allocationNumber >= NUM_LISTS)
      throw new Error(`Invalid DataPipe assignment: ${allocationNumber}`);
    return {list: ALLOCATION_LIST_ORDER[allocationNumber], allocation_slot: allocationNumber};
  }
  if (CONFIG.mode !== 'pilot') throw new Error('mode must be "pilot" or "datapipe".');
  // Pilot override: /?list=0 ... /?list=11 (NOT a predicate/access override).
  const override = url.searchParams.get('list');
  return listFromNumber(override === null ? Math.floor(Math.random() * NUM_LISTS) : Number(override));
}

function baseData(row, position, assignment) {
  return {
    task: 'narrative',
    item_num: Number(row.item_num), item_id: row.item_id,
    item_position: position, list_num: assignment.list,
    condition_num: assignedCell(Number(row.item_num), assignment.list).cell,
    predicate: row.predicate, access: normalizeAccess(row.access),
    visual: Number(row.visual), auditory: Number(row.auditory),
    adj: row.adj, modifier: row.modifier, valence: row.valence,
    access_type: row.access_type, access_setup: row.access_setup,
    visual_via: row.visual_via, audio_via: row.audio_via
  };
}

// The source CSV's critical field starts "and ...". Present "and" as the
// LAST word of the visible narrative context; start self-paced reading with
// the first TARGET word after "and". Do not change the source CSV itself.
function splitAtAnd(row) {
  const match = row.critical.trim().match(/^and\s+(.+)$/isu);
  if (!match) throw new Error(`Critical continuation must begin with "and": ${row.item_id}`);
  return {
    eventAnd: `${row.event.trim()} and`,
    criticalAfterAnd: match[1].trim()
  };
}

function makeContextTrials(row, position, assignment) {
  const {eventAnd} = splitAtAnd(row);
  // A single, fixed-height reading window stays in place across all four
  // context screens. Each sentence is a new top-to-bottom paragraph; only the
  // latest paragraph is bold. Earlier paragraphs remain visible, unbolded.
  const segments = [
    ['setup', row.setup],
    ['activity', row.activity],
    ['access_text', row.access_text],
    ['event_and', eventAnd]
  ];
  return segments.map(([sentenceName], i) => {
    const visible = segments.slice(0, i + 1).map(([, sentence], n) =>
      `<p class="context-sentence${n === i ? ' context-current' : ''}">${esc(sentence.trim())}</p>`
    ).join('');
    const last = i === segments.length - 1;
    return {
      type: jsPsychHtmlKeyboardResponse,
      choices: [' '], wait_for_key_release: true,
      stimulus: `<div class="reading-panel story-panel"><div class="item-counter">Story ${position} of ${NUM_ITEMS}</div>` +
        `<div class="reading-text context-body">${visible}</div>` +
        `<div class="reading-instructions">${last ? 'Press <kbd>Space</kbd> to begin word-by-word reading' : 'Press <kbd>Space</kbd> to reveal the next sentence'}</div></div>`,
      // If a particularly long story exceeds the fixed reading window, scroll
      // only the text area to make the new sentence visible. Never move the panel.
      on_load: () => {
        const body = document.querySelector('.context-body');
        const current = body?.querySelector('.context-current');
        if (body && current) {
          const sentenceBottom = current.offsetTop + current.offsetHeight;
          const bodyBottom = body.offsetTop + body.clientHeight;
          if (sentenceBottom > bodyBottom) body.scrollTop += sentenceBottom - bodyBottom + 12;
        }
      },
      data: {
        ...baseData(row, position, assignment),
        phase: 'sentence', sentence: sentenceName,
        cumulative: true, visible_sentence_count: i + 1
      }
    };
  });
}

function maskedWord(word) {
  return '-'.repeat([...word].length);
}

function movingWindowHTML(textWords, currentIndex, position) {
  // A proportional font (Georgia) is now used for BOTH context and critical
  // sentence. Each word slot contains *both* its real word and its dash mask,
  // stacked in one CSS grid cell. The invisible layer still determines size;
  // therefore neither widths nor wrapping change between word reveals.
  // Only the current real word is visible (non-cumulative moving window).
  const spans = textWords.map((word, i) => {
    const active = i === currentIndex;
    return `<span class="mw-slot ${active ? 'mw-current' : 'mw-masked'}">` +
      `<span class="mw-real" aria-hidden="${!active}">${esc(word)}</span>` +
      `<span class="mw-mask" aria-hidden="true">${maskedWord(word)}</span></span>`;
  });
  // Compact center-aligned panel, just wide/tall enough for this continuation.
  return `<div class="reading-panel story-panel word-panel"><div class="item-counter">Story ${position} of ${NUM_ITEMS}</div>` +
    `<div class="reading-text word-body"><div class="moving-window" aria-label="Word-by-word critical continuation">${spans.join('')}</div></div>` +
    '<div class="reading-instructions">Press <kbd>Space</kbd> to read the next word</div></div>';
}

function makeWordTrials(row, position, assignment) {
  // Only the critical continuation AFTER "and" is presented one word at a time.
  // The setup, activity, access, event, and "and" were already shown in full.
  const continuation = words(splitAtAnd(row).criticalAfterAnd);
  // The target can have more than one word (e.g., 'Jack’s son'), so do not
  // assume the critical predicate always occurs at index 2.
  const predicateAt = continuation.findIndex(w => w.toLowerCase().replace(/[^\p{L}]/gu, '') === row.predicate);
  if (predicateAt < 0) throw new Error(`Cannot locate critical predicate for ${row.item_id}`);
  if (predicateAt === 0) throw new Error(`Critical continuation lacks a target before predicate: ${row.item_id}`);
  return continuation.map((word, index) => {
    let region = 'target';
    if (index === predicateAt) region = 'predicate';
    else if (index === predicateAt + 1) region = 'modifier';
    else if (index === predicateAt + 2) region = 'adjective';
    else if (index > predicateAt + 2) region = 'spillover';
    return {
      type: jsPsychHtmlKeyboardResponse,
      choices: [' '], wait_for_key_release: true,
      stimulus: movingWindowHTML(continuation, index, position),
      data: {
        ...baseData(row, position, assignment),
        phase: 'word', region,
        word, word_index: index + 1,
        critical_index: index + 1,
        n_words: continuation.length
      }
    };
  });
}

// Shuffle the order of answer choices independently for every question on each
// participant's run. Preserve the original (1-based) option index for scoring.
// Question order is deliberately NOT shuffled, nor is the ordered 1–5 scale.
function shuffleOptions(options) {
  const shuffled = options.map((text, index) => ({text, sourceIndex: index + 1}));
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function makeQuestionTrials(row, q, position, assignment) {
  const specs = [
    ['location', row.q_location, notEmpty([q.location_1,q.location_2,q.location_3])],
    ['impression', row.q_impression, notEmpty([q.impression_1,q.impression_2,q.impression_3,q.impression_4,q.impression_5])],
    ['access', row.q_access, notEmpty([q.access_1,q.access_2,q.access_3,q.access_4])],
    ['activity', row.q_activity, notEmpty([q.activity_1,q.activity_2,q.activity_3,q.activity_4])]
  ];
  // Display unnumbered options in independently randomized order. Save the
  // original index in a private mapping so the answer keys remain valid.
  const choiceOrders = new Map();
  const choiceQuestions = specs.map(([name, prompt, opts], index) => {
    if (new Set(opts).size !== opts.length)
      throw new Error(`Duplicate answer choice in ${row.item_id}, question ${name}`);
    const shuffled = shuffleOptions(opts);
    choiceOrders.set(name, shuffled);
    return {
      prompt: `<span class="question-number">${index + 1}.</span> ${esc(prompt)}`,
      name, options: shuffled.map(o => o.text), required: true
    };
  });
  const mcq = {
    type: jsPsychSurveyMultiChoice,
    preamble: `<div class="question-heading">Story ${position} of ${NUM_ITEMS} <span>Questions 1–4 of 5 · Answer every question to continue</span></div>`,
    questions: choiceQuestions,
    button_label: 'Continue to question 5',
    data: {...baseData(row, position, assignment), phase: 'questions', question_set: 'multiple_choice'},
    on_finish: function(data) {
      const r = data.response;
      specs.forEach(([name]) => {
        const displayed = choiceOrders.get(name);
        const selectedAt = displayed.findIndex(option => option.text === r[name]);
        // q_*_answer stays 1-based ORIGINAL CSV position, not screen position.
        data[`q_${name}_answer`] = selectedAt < 0 ? null : displayed[selectedAt].sourceIndex;
        data[`q_${name}_shown_at`] = selectedAt < 0 ? null : selectedAt + 1;
        data[`q_${name}_order`] = displayed.map(o => o.sourceIndex).join('-');
      });
      // Perceptual attribution is a research measure, not automatically scored.
      data.q_location_correct = data.q_location_answer === parseKey(q.location_key);
      data.q_access_correct = data.q_access_answer === parseKey(row.access_key);
      data.q_activity_correct = data.q_activity_answer === parseKey(q.activity_key);
      data.q_impression_correct = null;
    }
  };
  const likert = {
    type: jsPsychSurveyLikert,
    preamble: `<div class="question-heading">Story ${position} of ${NUM_ITEMS} <span>Question 5 of 5 · Response required</span></div>`,
    questions: [{
      prompt: `<span class="question-number">5.</span> ${esc(row.q_plausibility)}`, name: 'plausibility',
      labels: ['1 — Definitely not','2','3','4','5 — Definitely yes'],
      required: true
    }],
    scale_width: 620,
    button_label: 'Next story',
    data: {
      ...baseData(row, position, assignment), phase: 'questions', question_set: 'plausibility',
      plaus_type: q.plaus_type
    },
    on_finish: function(data) {
      // jsPsych survey-likert indices are zero-based; analysis scores are 1..5.
      const index = data.response?.plausibility;
      data.q_plausibility_rating = Number.isInteger(index) ? index + 1 : null;
    }
  };
  return [mcq, likert];
}

function makeTextTrial(html) {
  return {type: jsPsychHtmlKeyboardResponse, choices:[' '], wait_for_key_release:true,
    stimulus:`<div class="reading-panel"><div class="reading-text">${html}</div>` +
      '<div class="reading-instructions">Press <kbd>Space</kbd> to continue</div></div>',
    record_data: false};
}

async function launch() {
  try {
    const [rows, questions] = await Promise.all([
      loadCSV('data/stimuli.csv'), loadCSV('data/questions.csv')
    ]);
    validateData(rows, questions);
    const assignment = await getAssignment();
    const qMap = new Map(questions.map(q => [q.item_id, q]));
    const pid = crypto.randomUUID();
    const prolificPid = new URLSearchParams(window.location.search).get('PROLIFIC_PID') || '';
    const useDataPipe = CONFIG.mode === 'datapipe';
    const jsPsych = initJsPsych({
      on_finish: function() {
        if (!useDataPipe) {
          jsPsych.data.get().localSave('csv', `pilot_${pid}_list${assignment.list}.csv`);
          document.body.innerHTML = '<div id="boot-status">Pilot complete. Your CSV should download now.</div>';
        } else if (CONFIG.prolificCompletionUrl) {
          // The DataPipe extension also handles final submission. Do not add a second save trial.
          window.location.href = CONFIG.prolificCompletionUrl;
        }
      },
      extensions: useDataPipe ? [{
        type: jsPsychExtensionPipe,
        params: {
          experiment_id: CONFIG.datapipeExperimentId,
          filename: () => `${pid}.csv`,
          done_message: '<p>Thank you. Your responses have been saved. You may close this tab.</p>',
          on_save: result => {
            if (!result.ok) console.error('DataPipe reported that the upload was not completed.', result);
          }
        }
      }] : []
    });
    jsPsych.data.addProperties({
      participant_id: pid,
      prolific_pid: prolificPid,
      list_num: assignment.list,
      assignment_method: useDataPipe ? 'datapipe_permuted_fixed_list_order' : 'pilot',
      allocation_slot: assignment.allocation_slot ?? null,
      completed: false
    });
    const selected = selectList(rows, assignment.list);
    const ordered = jsPsych.randomization.shuffle(selected);
    const timeline = [];
    timeline.push(makeTextTrial('In this study, you will read 36 short stories. Each story appears only once. Read each sentence at your normal pace. ' +
      'Press <kbd>Space</kbd> to reveal each new sentence in the same reading window. The newest sentence is bold; the earlier sentences remain visible in regular type. ' +
      'After the word <em>and</em>, the context disappears and the final continuation appears one word at a time, in the same font. ' +
      'Only the current word is shown; dashes mark the other word positions without moving. All five questions require a response, and the last uses a 1–5 scale.'));
    for (const [i, row] of ordered.entries()) {
      const position = i + 1;
      timeline.push({type:jsPsychHtmlKeyboardResponse, stimulus:'<div style="font-size:46px">+</div>',
        choices:'NO_KEYS', trial_duration:CONFIG.fixationMs, record_data:false});
      timeline.push(...makeContextTrials(row, position, assignment));
      timeline.push(...makeWordTrials(row, position, assignment));
      if (CONFIG.includeQuestions) timeline.push(...makeQuestionTrials(row, qMap.get(row.item_id), position, assignment));
      if (CONFIG.breakAfterItems.includes(position) && position < NUM_ITEMS) {
        timeline.push(makeTextTrial(`You have completed ${position} of ${NUM_ITEMS} stories. ` +
          'You may take a short break before continuing.'));
      }
    }
    timeline.push({
      type:jsPsychHtmlKeyboardResponse,
      stimulus:'<div class="reading-panel"><div class="reading-text">You have finished the reading task. Thank you.</div>' +
        '<div class="reading-instructions">Press <kbd>Space</kbd> to submit your responses.</div></div>',
      choices:[' '], wait_for_key_release:true,
      data:{task:'completion', phase:'end', completed:true}
    });
    document.getElementById('boot-status')?.remove();
    jsPsych.run(timeline);
  } catch (error) {
    console.error(error);
    const status = document.getElementById('boot-status') || document.body;
    status.textContent = `The study could not be started: ${error.message}. Please contact the researcher.`;
  }
}

// Expose selected pure helpers for automated tests, without any side effects.
window.NARRATIVE_UTILS = {parseCSV, validateData, cellFromNumber, listFromNumber,
  assignedCell, selectList, normalizeAccess, words, splitAtAnd};
launch();
