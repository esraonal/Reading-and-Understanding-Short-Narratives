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
const PRACTICE_STORIES = window.PRACTICE_STORIES || [];
const NUM_PRACTICE = CONFIG.practiceItems === undefined ? 1 : Number(CONFIG.practiceItems);


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
  // Practice results have an explicit task label and are NEVER counted as
  // experimental item-condition observations or in the 12-list design.
  const practice = Boolean(row.is_practice);
  return {
    task: practice ? 'practice' : 'narrative',
    is_practice: practice,
    item_num: practice ? null : Number(row.item_num),
    item_id: row.item_id,
    item_position: practice ? null : position,
    practice_position: practice ? position : null,
    list_num: assignment.list,
    condition_num: practice ? null : assignedCell(Number(row.item_num), assignment.list).cell,
    predicate: row.predicate, access: normalizeAccess(row.access),
    visual: Number(row.visual), auditory: Number(row.auditory),
    adj: row.adj, modifier: row.modifier, valence: row.valence,
    access_type: row.access_type, access_setup: row.access_setup,
    visual_via: row.visual_via, audio_via: row.audio_via
  };
}

function itemLabel(row, position) {
  return row.is_practice ? 'Practice narrative' : `Narrative ${position} of ${NUM_ITEMS}`;
}

function validatePractice(stories, experimentalRows) {
  if (!Number.isInteger(NUM_PRACTICE) || NUM_PRACTICE < 0 || NUM_PRACTICE > 1)
    throw new Error('config.js practiceItems must be 0 or 1.');
  if (stories.length < NUM_PRACTICE)
    throw new Error(`Expected ${NUM_PRACTICE} practice stories, found ${stories.length}.`);
  const mainIds = new Set(experimentalRows.map(row => row.item_id));
  const ids = new Set();
  for (const {row, options} of stories.slice(0, NUM_PRACTICE)) {
    if (!row.is_practice || ids.has(row.item_id) || mainIds.has(row.item_id))
      throw new Error(`Practice narrative IDs must be unique and separate: ${row.item_id}`);
    ids.add(row.item_id);
    if (options.item_id !== row.item_id || !PREDICATES.includes(row.predicate) ||
        !ACCESSES.includes(normalizeAccess(row.access)))
      throw new Error(`Invalid practice story: ${row.item_id}`);
    splitAtAnd(row);
    const verb = {looks:'looked', sounds:'sounded', seems:'seemed'}[row.predicate];
    if (!row.q_impression.includes(` ${verb} `))
      throw new Error(`Practice perspective question must match ${row.predicate}`);
    if (!Number.isInteger(parseKey(row.access_key)) || parseKey(row.access_key) < 1 ||
        parseKey(row.access_key) > 4)
      throw new Error(`Invalid practice access key: ${row.item_id}`);
  }
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


function makeContextTrials(row, position, assignment, showInstructions = false) {
  const { eventAnd } = splitAtAnd(row);

  // A single, fixed-height reading window stays in place across all four
  // context screens. Each sentence is a new top-to-bottom paragraph; only the
  // latest paragraph is bold. Earlier paragraphs remain visible, unbolded.
  const segments = [
    ['setup', row.setup],
    ['activity', row.activity],
    ['access_text', row.access_text],
    ['event_and', eventAnd]
  ];

  // Reserve enough space for all four sentences on every context screen.
  // The guide is invisible; it keeps each narrative's box at one stable height.
  const fullContext = segments.map(([, sentence], n) =>
    `<p class="context-sentence${n === segments.length - 1 ? ' context-current' : ''}">${esc(sentence.trim())}</p>`
  ).join('');

  return segments.map(([sentenceName], i) => {
    const visible = segments.slice(0, i + 1).map(([, sentence], n) =>
      `<p class="context-sentence${n === i ? ' context-current' : ''}">${esc(sentence.trim())}</p>`
    ).join('');

    const last = i === segments.length - 1;

    // Display Space-key reminders only when requested (e.g., during practice).
    const instruction = showInstructions
      ? `<div class="reading-instructions">${
          last
            ? 'Press <kbd>Space</kbd> to begin word-by-word reading'
            : 'Press <kbd>Space</kbd> to reveal the next sentence'
        }</div>`
      : '';

    return {
      type: jsPsychHtmlKeyboardResponse,
      choices: [' '],
      wait_for_key_release: true,

      stimulus:
        `<div class="reading-panel story-panel">` +
        `<div class="item-counter">${esc(itemLabel(row, position))}</div>` +
        `<div class="reading-text context-body">` +
        `<div class="context-size-guide" aria-hidden="true">${fullContext}</div>` +
        `<div class="context-visible">${visible}</div></div>` +
        instruction +
        `</div>`,

      // If a particularly long story exceeds the fixed reading window,
      // scroll only the text area to make the new sentence visible.
      // Never move the panel.
      on_load: () => {
        const body = document.querySelector('.context-body');
        const current = body?.querySelector('.context-current');

        if (body && current) {
          const overflow = current.getBoundingClientRect().bottom -
            body.getBoundingClientRect().bottom;
          if (overflow > 0) body.scrollTop += overflow + 12;
        }
      },

      data: {
        ...baseData(row, position, assignment),
        phase: 'sentence',
        sentence: sentenceName,
        cumulative: true,
        visible_sentence_count: i + 1
      }
    };
  });
}

function maskedWord() {
  // A constant placeholder for every hidden word, regardless of word length.
  return '---';
}

function movingWindowHTML(textWords, currentIndex, position, row) {
  // A proportional font (Arial) is used for BOTH context and critical
  // sentence. Every hidden word uses exactly three dashes. Each slot
  // contains BOTH its real word and the three-dash mask, stacked in one
  // CSS grid cell. Long words reserve their full width even while hidden,
  // so neither positions nor line wrapping change between word reveals.
  // Only the current real word is visible (non-cumulative moving window).
  const spans = textWords.map((word, i) => {
    const active = i === currentIndex;
    return `<span class="mw-slot ${active ? 'mw-current' : 'mw-masked'}">` +
      `<span class="mw-real" aria-hidden="${!active}">${esc(word)}</span>` +
      `<span class="mw-mask" aria-hidden="true">${maskedWord()}</span></span>`;
  });
  // During self-paced reading, show only the word and stationary dashes.
  // Instructions are provided beforehand, not repeated in this timed region.
  return `<div class="reading-panel word-panel"><div class="reading-text word-body">` +
    `<div class="moving-window" aria-label="Word-by-word reading">${spans.join('')}</div></div></div>`;
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
      stimulus: movingWindowHTML(continuation, index, position, row),
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

function makeQuestionTrials(row, q, position, assignment, jsPsych) {
  // One continuous question screen: show one question at a time and advance
  // immediately after an answer is selected. No extra Continue buttons.
  const specs = [
    ['location', row.q_location, notEmpty([q.location_1, q.location_2, q.location_3])],
    ['impression', row.q_impression, notEmpty([q.impression_1, q.impression_2, q.impression_3, q.impression_4, q.impression_5])],
    ['access', row.q_access, notEmpty([q.access_1, q.access_2, q.access_3, q.access_4])],
    ['activity', row.q_activity, notEmpty([q.activity_1, q.activity_2, q.activity_3, q.activity_4])]
  ];

  // Retain the original CSV positions for correct answer-key scoring.
  const orders = new Map();
  const steps = specs.map(([name, prompt, options], index) => {
    if (new Set(options).size !== options.length)
      throw new Error(`Duplicate answer choice in ${row.item_id}, question ${name}`);
    const shuffled = shuffleOptions(options);
    orders.set(name, shuffled);
    const optionsHTML = shuffled.map((option, n) =>
      `<label class="question-option"><input type="radio" name="answer-${name}" ` +
      `value="${option.sourceIndex}"><span>${esc(option.text)}</span></label>`
    ).join('');
    return `<section class="question-step${index === 0 ? ' is-active' : ''}" ` +
      `data-step="${index}" ${index === 0 ? '' : 'hidden'}>` +
      `<fieldset class="question-fieldset"><legend class="question-prompt">` +
      `<span class="question-number">${index + 1}.</span> ${esc(prompt)}</legend>` +
      `<div class="question-options">${optionsHTML}</div></fieldset></section>`;
  });

  const scale = [1, 2, 3, 4, 5].map(value => {
    const endpoint = value === 1
      ? '<span class="likert-endpoint">Strongly disagree</span>'
      : value === 5
        ? '<span class="likert-endpoint">Strongly agree</span>'
        : '';
    return `<li><input type="radio" id="question-rating-${value}" ` +
      `name="answer-plausibility" value="${value}">` +
      `<label for="question-rating-${value}">` +
      `<span class="likert-number">${value}</span>${endpoint}</label></li>`;
  }).join('');

  steps.push(
    `<section class="question-step" data-step="4" hidden>` +
    `<fieldset class="question-fieldset"><legend class="question-prompt">` +
    `<span class="question-number">5.</span> ${esc(row.q_plausibility)}</legend>` +
    `<ul class="jspsych-survey-likert-opts">${scale}</ul></fieldset></section>`
  );

  return [{
    type: jsPsychHtmlKeyboardResponse,
    choices: 'NO_KEYS',
    stimulus: `<div id="question-sequence" class="question-sequence">` +
      `<div class="question-heading">${esc(itemLabel(row, position))} ` +
      `<span id="question-progress">Question 1 of 5 · Select an answer to continue</span></div>` +
      `<div class="question-stage">${steps.join('')}</div></div>`,
    data: {
      ...baseData(row, position, assignment),
      phase: 'questions', question_set: 'all_five_sequential',
      plaus_type: q.plaus_type
    },
    on_load: () => {
      const container = document.getElementById('question-sequence');
      const progress = document.getElementById('question-progress');
      let current = 0;
      let startedAt = performance.now();
      let finished = false;
      const answers = {};
      const questionRTs = {};

      function handleAnswer(event) {
        const input = event.target;
        if (!input.matches('input[type="radio"]') || finished) return;
        const step = input.closest('.question-step');
        if (!step || Number(step.dataset.step) !== current) return;
        const name = current < 4 ? specs[current][0] : 'plausibility';
        answers[name] = Number(input.value);
        questionRTs[name] = Math.round(performance.now() - startedAt);

        if (current === 4) {
          finished = true;
          container.removeEventListener('change', handleAnswer);
          const recorded = {
            // Responses are now stored together in one question record.
            response: {},
            q_plausibility_rating: answers.plausibility,
            q_plausibility_index: answers.plausibility - 1,
            q_plausibility_rt: questionRTs.plausibility,
            q_impression_correct: null
          };
          for (const [key] of specs) {
            const displayed = orders.get(key);
            const sourceIndex = answers[key];
            const displayedIndex = displayed.findIndex(x => x.sourceIndex === sourceIndex);
            recorded[`q_${key}_answer`] = sourceIndex;
            recorded[`q_${key}_shown_at`] = displayedIndex + 1;
            recorded[`q_${key}_order`] = displayed.map(x => x.sourceIndex).join('-');
            recorded[`q_${key}_rt`] = questionRTs[key];
            recorded.response[key] = displayed[displayedIndex].text;
          }
          recorded.response.plausibility = answers.plausibility - 1;
          recorded.q_location_correct = answers.location === parseKey(q.location_key);
          recorded.q_access_correct = answers.access === parseKey(row.access_key);
          recorded.q_activity_correct = answers.activity === parseKey(q.activity_key);
          // Let the final selection be visible before leaving the page.
          requestAnimationFrame(() => jsPsych.finishTrial(recorded));
          return;
        }

        step.hidden = true;
        step.classList.remove('is-active');
        current += 1;
        const next = container.querySelector(`.question-step[data-step="${current}"]`);
        next.hidden = false;
        next.classList.add('is-active');
        progress.textContent = `Question ${current + 1} of 5 · Select an answer to continue`;
        startedAt = performance.now();
      }
      container.addEventListener('change', handleAnswer);
    }
  }];
}

function makeIntroTrial() {
  // Present the instructions one paragraph at a time in the same panel.
  // Space moves to the next paragraph; the Start practice button appears last.
  const paragraphs = [
    'In this experiment, you will read 36 short narratives.',
    'Before beginning the main task, you will complete one required practice narrative. ' +
      'Afterward, you can choose to repeat the practice or begin the experiment.',
    'Each narrative consists of four sentences. Press <kbd>Space</kbd> to reveal each new sentence. ' +
      'The most recent sentence will appear in bold, while the previous sentences remain visible.',
    '<strong>Partway through the fourth sentence, the reading format will change to ' +
      'word-by-word reading.</strong> The previous sentences will disappear, and three dashes ' +
      '(---) will represent each hidden word. Press <kbd>Space</kbd> to reveal each word in sequence.',
    'After each narrative, you will answer five questions, one at a time. ' +
      'Select an answer to move automatically to the next question.',
    'Please read each narrative naturally and at a comfortable pace. ' +
      'Pay attention to what you read, as you will answer questions afterward.'
  ];
  let keyHandler = null;
  return {
    type: jsPsychHtmlButtonResponse,
    // Keep prior instruction paragraphs visible; the newest one is bold,
    // exactly as in the cumulative narrative-reading display.
    stimulus: `<div class="reading-panel story-panel intro-panel">` +
      `<div class="reading-text context-body" id="intro-body">` +
      `<p class="context-sentence context-current">${paragraphs[0]}</p></div>` +
      `<div class="reading-instructions" id="intro-progress">` +
      `Press <kbd>Space</kbd> to reveal the next paragraph (1 of ${paragraphs.length})</div></div>`,
    choices: ['Start practice'],
    record_data: false,
    on_load: () => {
      const body = document.getElementById('intro-body');
      const progress = document.getElementById('intro-progress');
      const buttonGroup = document.getElementById('jspsych-html-button-response-btngroup');
      let index = 0;
      if (buttonGroup) buttonGroup.style.setProperty('display', 'none', 'important');
      keyHandler = event => {
        if (event.code !== 'Space' || event.repeat || index >= paragraphs.length - 1) return;
        event.preventDefault();
        index += 1;
        body.querySelector('.context-current')?.classList.remove('context-current');
        body.insertAdjacentHTML('beforeend',
          `<p class="context-sentence context-current">${paragraphs[index]}</p>`);
        // Keep newly revealed text visible if the cumulative instructions overflow.
        const current = body.querySelector('.context-current');
        const overflow = current.getBoundingClientRect().bottom -
          body.getBoundingClientRect().bottom;
        if (overflow > 0) body.scrollTop += overflow + 12;
        if (index === paragraphs.length - 1) {
          progress.textContent = 'You have finished the instructions. Select Start practice to continue.';
          if (buttonGroup) buttonGroup.style.removeProperty('display');
          document.removeEventListener('keydown', keyHandler);
          keyHandler = null;
        } else {
          progress.innerHTML = `Press <kbd>Space</kbd> to reveal the next paragraph (${index + 1} of ${paragraphs.length})`;
        }
      };
      document.addEventListener('keydown', keyHandler);
    },
    on_finish: () => {
      if (keyHandler) document.removeEventListener('keydown', keyHandler);
    }
  };
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
    validatePractice(PRACTICE_STORIES, rows);
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
    timeline.push(makeIntroTrial());
    if (NUM_PRACTICE > 0) {
      const practice = PRACTICE_STORIES[0];
      let practiceAttempt = 0;
      // Keep the practice trial and its five required questions identical on
      // every repetition. Tag EACH record with the corresponding attempt so
      // repeats can be recognized and excluded from experimental analyses.
      function annotatePracticeAttempt(trial) {
        const originalOnStart = trial.on_start;
        return {
          ...trial,
          on_start: function(currentTrial) {
            if (originalOnStart) originalOnStart(currentTrial);
            currentTrial.data = {...(currentTrial.data || {}), practice_attempt: practiceAttempt};
          }
        };
      }
      // Everyone completes one practice round. Only after finishing its five
      // required questions can they choose to repeat the same story ONCE.
      // The repeat uses exactly the same response procedure and is never
      // counted among the 36 experimental narratives.
      function buildPracticeRound() {
        return [
          {
            type: jsPsychHtmlKeyboardResponse,
            stimulus: '<div style="font-size:46px">+</div>',
            choices: 'NO_KEYS', trial_duration: CONFIG.fixationMs,
            record_data: false,
            on_start: () => { practiceAttempt += 1; }
          },
          ...makeContextTrials(practice.row, 1, assignment, true).map(annotatePracticeAttempt),
          ...makeWordTrials(practice.row, 1, assignment).map(annotatePracticeAttempt),
          ...makeQuestionTrials(practice.row, practice.options, 1, assignment, jsPsych).map(annotatePracticeAttempt)
        ];
      }
      let repeatPractice = false;
      timeline.push(...buildPracticeRound());
      timeline.push({
        type: jsPsychHtmlButtonResponse,
        stimulus: '<div class="practice-choice"><p>Practice complete.</p>' +
          '<p>You can repeat the practice narrative or start the experiment.</p></div>',
        choices: ['Repeat practice', 'Start experiment'],
        data: {task:'practice', is_practice:true, phase:'practice_decision', item_id:practice.row.item_id},
        on_start: function(currentTrial) {
          currentTrial.data = {...(currentTrial.data || {}), practice_attempt: practiceAttempt};
        },
        on_finish: function(data) {
          repeatPractice = data.response === 0;
        }
      });
      timeline.push({
        timeline: buildPracticeRound(),
        conditional_function: () => repeatPractice
      });
      timeline.push(makeTextTrial(
        'The main experiment will now begin. You will read 36 new narratives in the same format. ' +        
        'Please read each narrative naturally and at a comfortable pace. ' +
        'Pay attention to what you read, as you will answer questions afterward.'
      ));
    }
    for (const [i, row] of ordered.entries()) {
      const position = i + 1;
      timeline.push({type:jsPsychHtmlKeyboardResponse, stimulus:'<div style="font-size:46px">+</div>',
        choices:'NO_KEYS', trial_duration:CONFIG.fixationMs, record_data:false});
      timeline.push(...makeContextTrials(row, position, assignment, false));
      timeline.push(...makeWordTrials(row, position, assignment));
      if (CONFIG.includeQuestions) timeline.push(...makeQuestionTrials(row, qMap.get(row.item_id), position, assignment, jsPsych));
      if (CONFIG.breakAfterItems.includes(position) && position < NUM_ITEMS) {
        timeline.push(makeTextTrial(`You have completed ${position} of ${NUM_ITEMS} narratives. ` +
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
