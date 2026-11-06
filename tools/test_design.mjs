/* Tests all 12 list assignments, stimulus timing boundary, presentation and questions.
   Run from project folder: node tools/test_design.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
const js = fs.readFileSync(new URL('experiment.js',root), 'utf8');
const csvFiles = Object.fromEntries(['data/stimuli.csv','data/questions.csv'].map(
  p => [p, fs.readFileSync(new URL(p,root),'utf8')]));

async function buildList(list) {
  let launched = false;
  let timeline;
  const fakeJsPsych = {
    randomization: {shuffle: arr => [...arr].reverse()},
    data: {addProperties(){},get(){return {localSave(){}};}},
    run: result => { launched = true; timeline = result; }
  };
  const win = {
    EXPERIMENT_CONFIG:{mode:'pilot',fixationMs:100,breakAfterItems:[12,24],includeQuestions:true},
    location:{href:`http://localhost:8000/?list=${list}`,search:`?list=${list}`}
  };
  const sandbox = {
    window:win,console,URL,URLSearchParams,
    crypto:{randomUUID:()=> 'test-pid'},
    fetch:async path=>({ok:true,text:async()=>csvFiles[path]}),
    document:{getElementById:()=>({remove(){},textContent:''}),body:{textContent:''}},
    initJsPsych:()=>fakeJsPsych,
    jsPsychHtmlKeyboardResponse:function(){},jsPsychSurveyMultiChoice:function(){},
    jsPsychSurveyLikert:function(){},jsPsychExtensionPipe:{}
  };
  vm.runInNewContext(js,sandbox,{filename:'experiment.js'});
  for(let i=0;i<50 && !launched;i++) await new Promise(r=>setTimeout(r,10));
  if(!launched) throw new Error(`Timeline did not start for list ${list}`);
  return {timeline,util:win.NARRATIVE_UTILS};
}

const allByItem = new Map();
let numTests=0;
for(let list=0;list<12;list++) {
  const {timeline,util}=await buildList(list);
  const pTrials=timeline.filter(t=>t.data?.phase==='word' && t.data?.region==='predicate');
  const questionLookup=new Map(util.parseCSV(csvFiles['data/questions.csv']).map(q=>[q.item_id,q]));
  const mcqs=timeline.filter(t=>t.data?.question_set==='multiple_choice');
  const likerts=timeline.filter(t=>t.data?.question_set==='plausibility');
  const sentences=timeline.filter(t=>t.data?.phase==='sentence');
  assert.equal(pTrials.length,36);
  assert.equal(mcqs.length,36);
  assert.equal(likerts.length,36);
  assert.equal(sentences.length,144);
  assert.equal(new Set(pTrials.map(t=>t.data.item_id)).size,36);
  assert.equal(new Set(pTrials.map(t=>t.data.item_position)).size,36);
  assert.ok(pTrials.every(t=>t.data.list_num===list));
  // Each predicate x access combination appears three times per participant.
  const counts=new Map();
  for (const t of pTrials) {
    const d=t.data;
    const cell=`${d.predicate}|${d.access}`;
    counts.set(cell, (counts.get(cell)||0)+1);
    assert.equal(d.word,d.predicate);
    assert.equal(util.assignedCell(d.item_num,list).cell,d.condition_num);
    if(!allByItem.has(d.item_id)) allByItem.set(d.item_id,new Set());
    assert.ok(!allByItem.get(d.item_id).has(cell),
      `Repeated cell for ${d.item_id} on list ${list}`);
    allByItem.get(d.item_id).add(cell);
  }
  assert.equal(counts.size,12);
  assert.ok([...counts.values()].every(count=>count===3));
  // Per-item impression question must agree with item-specific predicate.
  for(const block of mcqs) {
    assert.equal(block.questions.length,4);
    assert.ok(block.questions.every(q=>q.required));
    assert.ok(block.questions.map((q,i)=>q.prompt.includes(`${i+1}.`)).every(Boolean));
    // Questions are numbered, but multiple-choice options are NOT.
    assert.ok(block.questions.every(q=>q.options.every(opt=>!/^\d+\.\s/u.test(opt))));
    const source=questionLookup.get(block.data.item_id);
    const fields={
      location:['location_1','location_2','location_3'],
      impression:['impression_1','impression_2','impression_3','impression_4','impression_5'],
      access:['access_1','access_2','access_3','access_4'],
      activity:['activity_1','activity_2','activity_3','activity_4']
    };
    for (const question of block.questions) {
      const original=fields[question.name].map(key=>source[key]).filter(Boolean);
      assert.deepEqual([...question.options].sort(),[...original].sort());
    }
    // Simulate choosing source-option #1 from every newly randomized display.
    // Its recorded original source index must stay 1, not its display position.
    const data={response:Object.fromEntries(block.questions.map(question=>
      [question.name, source[`${question.name}_1`]]))};
    block.on_finish(data);
    for (const name of Object.keys(fields)) {
      assert.equal(data[`q_${name}_answer`],1);
      const shown=block.questions.find(q=>q.name===name).options;
      assert.equal(data[`q_${name}_shown_at`],shown.indexOf(source[`${name}_1`])+1);
      assert.deepEqual(data[`q_${name}_order`].split('-').map(Number).sort((a,b)=>a-b),
        Array.from({length:shown.length},(_,i)=>i+1));
    }
    const verb={looks:'looked',sounds:'sounded',seems:'seemed'}[block.data.predicate];
    assert.ok(block.questions[1].prompt.includes(` ${verb} `), block.data.item_id);
  }
  assert.ok(likerts.every(t=>t.questions[0].required && t.questions[0].labels.length===5));
  assert.ok(likerts.every(t=>t.questions[0].labels[0].startsWith('1') && t.questions[0].labels[4].startsWith('5')));
  assert.ok(likerts.every(t=>t.questions[0].prompt.includes('5.')));
  assert.ok(likerts.every(t=>t.scale_width>=550 && t.scale_width<=700));
  const itemOneContext=sentences.filter(t=>t.data.item_num===1);
  assert.deepEqual(Array.from(itemOneContext,t=>t.data.sentence),
    ['setup','activity','access_text','event_and']);
  assert.deepEqual(Array.from(itemOneContext,t=>t.data.visible_sentence_count),[1,2,3,4]);
  assert.equal((itemOneContext[3].stimulus.match(/context-current/g)||[]).length,1);
  assert.equal((itemOneContext[3].stimulus.match(/class="context-sentence/g)||[]).length,4);
  assert.ok(itemOneContext[3].stimulus.includes('and</p>'));
  const firstItemWords=timeline.filter(t=>t.data?.phase==='word' && t.data.item_num===1);
  assert.equal(firstItemWords[0].data.word,'David');
  assert.ok(firstItemWords.every(t=>t.data.word.toLowerCase()!=='and'));
  assert.equal(firstItemWords[0].data.word_index,1);
  const slotsOf=h=>Array.from(h.matchAll(/class="mw-slot mw-(?:current|masked)"[^>]*><span class="mw-real" aria-hidden="(?:true|false)">([^<]+)<\/span><span class="mw-mask" aria-hidden="true">([^<]+)<\/span><\/span>/g), m=>[m[1],m[2]]);
  const firstSlots=slotsOf(firstItemWords[0].stimulus);
  assert.equal(firstSlots.length,firstItemWords.length);
  for(const t of firstItemWords) {
    assert.equal((t.stimulus.match(/class="mw-slot mw-current"/g)||[]).length,1);
    assert.deepEqual(slotsOf(t.stimulus),firstSlots);
  }
  const eightWords=timeline.filter(t=>t.data?.phase==='word' && t.data.item_num===8);
  assert.deepEqual(Array.from(eightWords.slice(0,2),t=>t.data.word),['Jack’s','son']);
  assert.deepEqual(Array.from(eightWords.slice(0,2),t=>t.data.region),['target','target']);
  console.log(`PASS list ${list}: 36 unique items, 12 cells x 3 each, 5 mandatory questions per item`);
  numTests++;
}
assert.equal(allByItem.size,36);
for(const [id,cells] of allByItem) assert.equal(cells.size,12,`incomplete rotations for ${id}`);
console.log(`PASS ${numTests} counterbalanced lists; each narrative appears once in every cell across lists; original reading presentation preserved.`);
