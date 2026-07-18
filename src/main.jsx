import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  BarChart3,
  Brain,
  Check,
  ChevronRight,
  Clock3,
  Headphones,
  LineChart,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Target,
  TimerReset,
  Volume2,
  Zap,
} from 'lucide-react';
import './styles.css';

const STORAGE_KEY = 'neurobeat-sessions';

const audioProfiles = [
  {
    id: 'brown-noise',
    name: 'Brown Noise',
    label: 'Deep steady noise',
    tempo: '0 BPM',
    color: '#83684c',
    waves: ['low', 'noise'],
    bestFor: 'Reading and long note review',
  },
  {
    id: 'lofi',
    name: 'Lo-fi Pulse',
    label: 'Warm beat, soft texture',
    tempo: '72 BPM',
    color: '#2d8c7f',
    waves: ['beat', 'warm'],
    bestFor: 'Practice sets and writing',
  },
  {
    id: 'alpha',
    name: 'Alpha Waves',
    label: 'Clean 10 Hz shimmer',
    tempo: '10 Hz',
    color: '#c49f3f',
    waves: ['tone', 'shimmer'],
    bestFor: 'Memorization and calm recall',
  },
  {
    id: 'silence',
    name: 'Silence',
    label: 'Control condition',
    tempo: '0 BPM',
    color: '#56616d',
    waves: ['control'],
    bestFor: 'Baseline measurement',
  },
];

const taskTypes = [
  { id: 'math', name: 'Mental Math', icon: Target, prompt: 'Fast accuracy under pressure' },
  { id: 'memory', name: 'Memory Recall', icon: Brain, prompt: 'Hold and compare symbol patterns' },
  { id: 'reading', name: 'Reading Focus', icon: Activity, prompt: 'Sustained attention and comprehension' },
];

const baseTrials = {
  math: [
    { q: '17 + 26', a: '43' },
    { q: '64 - 19', a: '45' },
    { q: '8 x 7', a: '56' },
    { q: '99 - 38', a: '61' },
    { q: '12 x 6', a: '72' },
    { q: '144 / 12', a: '12' },
  ],
  memory: [
    { q: 'K7Q2', a: 'K7Q2' },
    { q: 'M4P9', a: 'M4P9' },
    { q: 'A8T3', a: 'A8T3' },
    { q: 'R2N6', a: 'R2N6' },
    { q: 'L5X1', a: 'L5X1' },
    { q: 'C9V4', a: 'C9V4' },
  ],
  reading: [
    { q: 'A focused learner notices when attention drifts and returns to the task.', a: 'attention' },
    { q: 'Short tests can reveal which sound environment supports better recall.', a: 'sound' },
    { q: 'Mood before and after studying helps separate comfort from performance.', a: 'mood' },
    { q: 'A useful recommendation should improve as more sessions are recorded.', a: 'recommendation' },
    { q: 'The best study profile can change between reading, practice, and memorizing.', a: 'profile' },
  ],
};

function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function scoreSession(session) {
  const speedBonus = Math.max(0, 1 - session.averageSeconds / 18) * 20;
  const moodLift = (session.postMood - session.preMood) * 3;
  return Math.round(session.accuracy * 0.75 + speedBonus + moodLift);
}

function getRecommendation(sessions, taskType) {
  const relevant = sessions.filter((session) => session.taskType === taskType);
  if (relevant.length < 2) {
    return {
      title: 'Run two focus tests',
      detail: 'NeuroBeat needs a little evidence before choosing a winning sound profile.',
      profile: audioProfiles[1],
      confidence: 18,
    };
  }

  const ranked = audioProfiles
    .map((profile) => {
      const matches = relevant.filter((session) => session.profileId === profile.id);
      const avg = matches.length
        ? matches.reduce((sum, session) => sum + scoreSession(session), 0) / matches.length
        : 0;
      return { profile, avg, count: matches.length };
    })
    .sort((a, b) => b.avg - a.avg);

  const winner = ranked[0];
  const confidence = Math.min(94, Math.round(34 + winner.count * 16 + winner.avg / 3));

  return {
    title: `${winner.profile.name} is leading`,
    detail: `${winner.profile.name} has the strongest measured score for ${taskTypes.find((task) => task.id === taskType).name.toLowerCase()} so far.`,
    profile: winner.profile,
    confidence,
  };
}

function App() {
  const [sessions, setSessions] = useState(loadSessions);
  const [taskType, setTaskType] = useState('math');
  const [profileId, setProfileId] = useState('lofi');
  const [preMood, setPreMood] = useState(6);
  const [postMood, setPostMood] = useState(6);
  const [phase, setPhase] = useState('setup');
  const [trialIndex, setTrialIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [startedAt, setStartedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [audioOn, setAudioOn] = useState(false);
  const audioRef = useRef(null);

  const selectedProfile = audioProfiles.find((profile) => profile.id === profileId);
  const selectedTask = taskTypes.find((task) => task.id === taskType);
  const trials = baseTrials[taskType];
  const recommendation = getRecommendation(sessions, taskType);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (!startedAt || phase !== 'testing') return undefined;

    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 300);

    return () => window.clearInterval(timer);
  }, [phase, startedAt]);

  useEffect(() => {
    if (!audioOn) {
      stopAudio();
      return undefined;
    }

    const context = new AudioContext();
    const gain = context.createGain();
    gain.gain.value = 0.035;
    gain.connect(context.destination);

    if (profileId === 'silence') {
      audioRef.current = { context };
      return () => stopAudio();
    }

    const oscillator = context.createOscillator();
    const oscillatorTwo = context.createOscillator();
    oscillator.type = profileId === 'brown-noise' ? 'sawtooth' : 'sine';
    oscillator.frequency.value = profileId === 'alpha' ? 220 : 110;
    oscillatorTwo.frequency.value = profileId === 'lofi' ? 165 : 118;

    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    lfo.frequency.value = profileId === 'alpha' ? 10 : 1.2;
    lfoGain.gain.value = profileId === 'alpha' ? 0.025 : 0.015;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    oscillator.connect(gain);
    oscillatorTwo.connect(gain);
    oscillator.start();
    oscillatorTwo.start();
    lfo.start();
    audioRef.current = { context, nodes: [oscillator, oscillatorTwo, lfo] };

    return () => stopAudio();
  }, [audioOn, profileId]);

  function stopAudio() {
    if (!audioRef.current) return;
    audioRef.current.nodes?.forEach((node) => {
      try {
        node.stop();
      } catch {
        // Audio nodes can already be stopped during quick profile switches.
      }
    });
    audioRef.current.context?.close();
    audioRef.current = null;
  }

  function startTest() {
    setAnswers([]);
    setTrialIndex(0);
    setCurrentAnswer('');
    setElapsed(0);
    setStartedAt(Date.now());
    setPhase('testing');
    setAudioOn(profileId !== 'silence');
  }

  function submitAnswer(event) {
    event.preventDefault();
    const trial = trials[trialIndex];
    const response = currentAnswer.trim();
    const correct = response.toLowerCase() === trial.a.toLowerCase();
    const nextAnswers = [...answers, { response, correct }];
    setAnswers(nextAnswers);
    setCurrentAnswer('');

    if (trialIndex + 1 >= trials.length) {
      setAudioOn(false);
      setPhase('post');
      return;
    }

    setTrialIndex(trialIndex + 1);
  }

  function saveSession() {
    const correct = answers.filter((answer) => answer.correct).length;
    const session = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      taskType,
      profileId,
      preMood,
      postMood,
      correct,
      total: answers.length,
      accuracy: Math.round((correct / answers.length) * 100),
      averageSeconds: Math.max(1, elapsed / answers.length),
    };

    setSessions([session, ...sessions]);
    setPhase('results');
  }

  function resetExperiment() {
    setPhase('setup');
    setTrialIndex(0);
    setCurrentAnswer('');
    setStartedAt(null);
    setElapsed(0);
  }

  const latest = sessions[0];
  const accuracy = answers.length ? Math.round((answers.filter((answer) => answer.correct).length / answers.length) * 100) : 0;

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles size={16} /> Experimental focus lab</span>
          <h1>NeuroBeat</h1>
          <p>
            Test how sound environments change your study speed, accuracy, attention, and mood.
            The recommendation engine learns from your own sessions.
          </p>
          <div className="hero-actions">
            <button className="primary-action" onClick={startTest}>
              <Play size={18} /> Start focus test
            </button>
            <button className="icon-action" onClick={() => setAudioOn((value) => !value)} title="Preview audio condition">
              {audioOn ? <Volume2 size={20} /> : <Headphones size={20} />}
            </button>
          </div>
        </div>
        <FocusSignal profile={selectedProfile} audioOn={audioOn} />
      </section>

      <section className="control-band">
        <Panel title="Task" icon={SlidersHorizontal}>
          <div className="segmented">
            {taskTypes.map((task) => {
              const Icon = task.icon;
              return (
                <button
                  key={task.id}
                  className={taskType === task.id ? 'active' : ''}
                  onClick={() => setTaskType(task.id)}
                >
                  <Icon size={17} />
                  <span>{task.name}</span>
                </button>
              );
            })}
          </div>
          <p className="muted">{selectedTask.prompt}</p>
        </Panel>

        <Panel title="Mood Check" icon={Activity}>
          <MoodSlider label="Before" value={preMood} onChange={setPreMood} />
          {phase === 'post' || phase === 'results' ? (
            <MoodSlider label="After" value={postMood} onChange={setPostMood} />
          ) : null}
        </Panel>

        <Panel title="Recommendation" icon={LineChart}>
          <div className="recommendation">
            <strong>{recommendation.title}</strong>
            <span>{recommendation.detail}</span>
            <div className="confidence">
              <div style={{ width: `${recommendation.confidence}%` }} />
            </div>
            <small>{recommendation.confidence}% confidence</small>
          </div>
        </Panel>
      </section>

      <section className="experiment-grid">
        <div className="sound-panel">
          <div className="section-heading">
            <Headphones size={22} />
            <div>
              <h2>Audio Conditions</h2>
              <p>Pick one condition, then run a timed study task.</p>
            </div>
          </div>
          <div className="profile-grid">
            {audioProfiles.map((profile) => (
              <button
                key={profile.id}
                className={`profile-card ${profileId === profile.id ? 'selected' : ''}`}
                onClick={() => setProfileId(profile.id)}
                style={{ '--profile-color': profile.color }}
              >
                <div className="profile-topline">
                  <span>{profile.name}</span>
                  {profileId === profile.id ? <Check size={18} /> : null}
                </div>
                <p>{profile.label}</p>
                <small>{profile.tempo} | {profile.bestFor}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="task-panel">
          <div className="section-heading">
            <Clock3 size={22} />
            <div>
              <h2>Timed Study Task</h2>
              <p>{phase === 'testing' ? 'Answer each prompt as accurately as you can.' : 'Configure your test and start when ready.'}</p>
            </div>
          </div>

          {phase === 'setup' ? (
            <EmptyTask startTest={startTest} selectedProfile={selectedProfile} />
          ) : null}

          {phase === 'testing' ? (
            <form className="test-card" onSubmit={submitAnswer}>
              <div className="test-meta">
                <span><TimerReset size={16} /> {elapsed}s</span>
                <span>{trialIndex + 1}/{trials.length}</span>
              </div>
              <h3>{trials[trialIndex].q}</h3>
              <input
                autoFocus
                value={currentAnswer}
                onChange={(event) => setCurrentAnswer(event.target.value)}
                placeholder={taskType === 'reading' ? 'Key word' : 'Answer'}
              />
              <button className="primary-action" type="submit">
                Submit <ChevronRight size={18} />
              </button>
            </form>
          ) : null}

          {phase === 'post' ? (
            <div className="test-card">
              <div className="score-orb">{accuracy}%</div>
              <h3>Post-study mood check</h3>
              <p>Rate how you feel after this sound condition, then save the trial.</p>
              <MoodSlider label="After" value={postMood} onChange={setPostMood} />
              <button className="primary-action" onClick={saveSession}>
                Save evidence <BarChart3 size={18} />
              </button>
            </div>
          ) : null}

          {phase === 'results' && latest ? (
            <div className="test-card results-card">
              <div className="score-row">
                <Metric label="Accuracy" value={`${latest.accuracy}%`} />
                <Metric label="Avg speed" value={`${latest.averageSeconds.toFixed(1)}s`} />
                <Metric label="Mood shift" value={`${latest.postMood - latest.preMood > 0 ? '+' : ''}${latest.postMood - latest.preMood}`} />
              </div>
              <h3>{audioProfiles.find((profile) => profile.id === latest.profileId).name} evidence saved</h3>
              <p>Your recommendation model has one more signal for future study sessions.</p>
              <button className="secondary-action" onClick={resetExperiment}>
                <RefreshCw size={18} /> Run another condition
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="history-band">
        <div className="section-heading">
          <BarChart3 size={22} />
          <div>
            <h2>Evidence Log</h2>
            <p>Each session compares performance, speed, mood, and sound profile.</p>
          </div>
        </div>
        <div className="session-list">
          {sessions.length ? sessions.slice(0, 6).map((session) => (
            <article key={session.id} className="session-row">
              <span>{audioProfiles.find((profile) => profile.id === session.profileId).name}</span>
              <span>{taskTypes.find((task) => task.id === session.taskType).name}</span>
              <strong>{scoreSession(session)}</strong>
              <small>{session.accuracy}% accuracy</small>
            </article>
          )) : (
            <div className="empty-history">
              <Zap size={24} />
              <span>No sessions yet. Run two or more conditions to unlock real personalization.</span>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Panel({ title, icon: Icon, children }) {
  return (
    <article className="panel">
      <h2><Icon size={18} /> {title}</h2>
      {children}
    </article>
  );
}

function MoodSlider({ label, value, onChange }) {
  return (
    <label className="mood-slider">
      <span>{label} mood <strong>{value}/10</strong></span>
      <input
        type="range"
        min="1"
        max="10"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function FocusSignal({ profile, audioOn }) {
  return (
    <div className="focus-signal" style={{ '--profile-color': profile.color }}>
      <div className="signal-header">
        <span>{profile.name}</span>
        <strong>{audioOn ? 'Live' : 'Ready'}</strong>
      </div>
      <div className={`wave-field ${audioOn ? 'playing' : ''}`}>
        {Array.from({ length: 42 }).map((_, index) => (
          <span key={index} style={{ '--i': index }} />
        ))}
      </div>
      <div className="signal-footer">
        <span>{profile.label}</span>
        <span>{profile.tempo}</span>
      </div>
    </div>
  );
}

function EmptyTask({ startTest, selectedProfile }) {
  return (
    <div className="test-card empty-task">
      <div className="score-orb small"><Headphones size={28} /></div>
      <h3>{selectedProfile.name} condition ready</h3>
      <p>The timer, answers, pre/post mood, and audio profile will be saved as one experiment.</p>
      <button className="primary-action" onClick={startTest}>
        <Play size={18} /> Begin trial
      </button>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
