'use strict';

// One REPEATABLE practice narrative. It is not part of the 36 experimental
// narratives or 12 counterbalancing lists. Each repeat is tagged with
// practice_attempt and excluded from the main study analysis.
// The display and all five required questions match the experimental procedure.
window.PRACTICE_STORIES = [
  {
    row: {
      is_practice: true,
      practice_num: 1,
      item_num: 'P1',
      item_id: 'practice_rocket',
      title: 'Rocket landing',
      predicate: 'looks',
      access: 'visual_only',
      visual: '1', auditory: '0',
      adj: 'relieved', modifier: 'really', valence: 'positive',
      access_type: 'electronic',
      access_setup: 'Video feed + muted audio',
      visual_via: 'Live video feed',
      audio_via: 'Control-room audio (muted)',
      setup: 'You are helping run a student rocket-launch competition at a science center.',
      activity: 'While you update flight logs in the operations office, Zara monitors her team’s rocket from the launch control room next door.',
      access_text: 'A live video feed on your monitor shows Zara, but the control-room audio is muted.',
      event: 'As the rocket drops quickly toward the ground, its parachute opens at the last moment and it lands safely,',
      critical: 'and Zara looks really relieved by the result.',
      q_location: 'At the end of the narrative, where did you picture yourself?',
      q_impression: 'Whose impression, if anyone’s, was it that Zara looked relieved?',
      q_access: 'While Zara monitored the rocket, what was available to you in the operations office?',
      q_activity: 'What were you doing while Zara monitored the rocket?',
      q_plausibility: 'Based on the narrative, Zara had a reason to feel relieved.',
      access_key: '1'
    },
    options: {
      item_id: 'practice_rocket',
      location_1: 'In the operations office',
      location_2: 'In the launch control room',
      location_3: 'I didn’t picture myself in a particular place',
      location_key: '1',
      impression_1: 'You, the person updating flight logs',
      impression_2: 'One of Zara’s teammates',
      impression_3: 'The narrator',
      impression_4: 'No one in particular',
      impression_5: '',
      access_1: 'What Zara was doing, but not what she was saying',
      access_2: 'What Zara was saying, but not what she was doing',
      access_3: 'Both what Zara was doing and what she was saying',
      access_4: 'Neither what Zara was doing nor what she was saying',
      activity_1: 'Updating flight logs',
      activity_2: 'Operating the rocket’s controls',
      activity_3: 'Judging the competition',
      activity_4: 'Not sure',
      activity_key: '1',
      plaus_type: 'matching'
    }
  }
];
