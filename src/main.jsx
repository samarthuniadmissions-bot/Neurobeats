import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Lock,
  LogIn,
  Music2,
  Pause,
  Play,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  TimerReset,
  UserPlus,
  Volume2,
  WandSparkles,
  Zap,
} from 'lucide-react';
import './styles.css';

const STORAGE_KEY = 'neurobeat-sessions';
const USER_KEY = 'neurobeat-user';
const GROQ_KEY = 'neurobeat-groq-key';

const audioProfiles = [
  { id: 'brown-noise', name: 'Brown Noise', label: 'Deep steady noise', tempo: '0 BPM', color: '#83684c', bestFor: 'Reading and long note review' },
  { id: 'lofi', name: 'Lo-fi Pulse', label: 'Warm beat, soft texture', tempo: '72 BPM', color: '#2d8c7f', bestFor: 'Practice sets and writing' },
  { id: 'alpha', name: 'Alpha Waves', label: 'Clean 10 Hz shimmer', tempo: '10 Hz', color: '#c49f3f', bestFor: 'Memorization and calm recall' },
  { id: 'itunes', name: 'iTunes Music', label: 'Apple/iTunes song preview', tempo: '30 sec', color: '#a5533f', bestFor: 'Personal song testing' },
  { id: 'silence', name: 'Silence', label: 'Control condition', tempo: '0 BPM', color: '#56616d', bestFor: 'Baseline measurement' },
];

const taskTypes = [
  { id: 'math', name: 'Mental Math', icon: Target, prompt: 'Fast accuracy under pressure' },
  { id: 'memory', name: 'Memory Recall', icon: Brain, prompt: 'Hold and compare symbol patterns' },
  { id: 'reading', name: 'Reading Focus', icon: Activity, prompt: 'Sustained attention and comprehension' },
];

const quizQuestions = [
  {
    id: 'task',
    question: 'What are you studying right now?',
    options: [
      { value: 'math', label: 'Problem solving', term: 'lofi focus beats' },
      { value: 'reading', label: 'Reading or notes', term: 'instrumental piano focus' },
      { value: 'memory', label: 'Memorizing', term: 'ambient study music' },
    ],
  },
  {
    id: 'energy',
    question: 'What energy level helps you stay locked in?',
    options: [
      { value: 'calm', label: 'Calm and steady', term: 'calm study' },
      { value: 'medium', label: 'Medium rhythm', term: 'lofi hip hop' },
      { value: 'high', label: 'High energy', term: 'electronic focus' },
    ],
  },
  {
    id: 'lyrics',
    question: 'Do lyrics distract you?',
    options: [
      { value: 'none', label: 'No lyrics', term: 'instrumental' },
      { value: 'light', label: 'Soft vocals are fine', term: 'chill vocals' },
      { value: 'any', label: 'Lyrics are okay', term: 'study playlist' },
    ],
  },
  {
    id: 'sound',
    question: 'Which sound texture feels best?',
    options: [
      { value: 'warm', label: 'Warm beats', term: 'warm lofi' },
      { value: 'clean', label: 'Clean piano', term: 'minimal piano' },
      { value: 'cinematic', label: 'Cinematic focus', term: 'cinematic ambient' },
    ],
  },
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

function loadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function scoreSession(session) {
  const speedBonus = Math.max(0, 1 - session.averageSeconds / 18) * 20;
  const moodLift = (session.postMood - session.preMood) * 3;
  return Math.round(session.accuracy * 0.75 + speedBonus + moodLift);
}

function selectedTerms(answers) {
  return quizQuestions
    .map((question) => question.options.find((option) => option.value === answers[question.id])?.term)
    .filter(Boolean);
}

function buildSearchTerm(answers) {
  const terms = selectedTerms(answers);
  return terms.length ? terms.join(' ') : 'lofi focus instrumental';
}

function fallbackMusicOptions(quizAnswers) {
  const task = quizAnswers.task;
  const energy = quizAnswers.energy;
  const lyrics = quizAnswers.lyrics;
  const sound = quizAnswers.sound;
  const instrumental = lyrics === 'none' ? 'instrumental ' : '';

  if (task === 'memory') {
    return [
      { title: 'Ambient Recall', searchTerm: `${instrumental}ambient study music`, reason: 'Low-change textures help memory work without stealing attention.' },
      { title: 'Minimal Piano', searchTerm: `${instrumental}minimal piano focus`, reason: 'Simple melodies create structure while keeping recall clean.' },
      { title: 'Alpha Calm', searchTerm: 'alpha waves concentration', reason: 'A steady calm profile is useful for memorizing and review.' },
    ];
  }

  if (task === 'reading') {
    return [
      { title: 'Clean Reading Flow', searchTerm: `${instrumental}piano reading focus`, reason: 'Gentle pacing supports comprehension and longer attention.' },
      { title: 'Cinematic Desk', searchTerm: `${instrumental}cinematic ambient study`, reason: 'Wide sound works well when reading feels mentally flat.' },
      { title: 'Brown Noise Baseline', searchTerm: 'brown noise focus', reason: 'A steady control-like option can reduce background distractions.' },
    ];
  }

  return [
    { title: energy === 'high' ? 'Fast Problem Sprint' : 'Lo-fi Problem Set', searchTerm: `${instrumental}${energy === 'high' ? 'electronic focus' : 'lofi focus beats'}`, reason: 'Rhythm can support momentum during repeated problem solving.' },
    { title: 'Warm Beat Focus', searchTerm: `${instrumental}${sound === 'warm' ? 'warm lofi' : 'study beats'}`, reason: 'A warm repeating groove gives pace without needing lyrical attention.' },
    { title: 'Control Track', searchTerm: 'instrumental concentration music', reason: 'A neutral option helps compare whether music is actually helping.' },
  ];
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
  return {
    title: `${winner.profile.name} is leading`,
    detail: `${winner.profile.name} has the strongest measured score for ${taskTypes.find((task) => task.id === taskType).name.toLowerCase()} so far.`,
    profile: winner.profile,
    confidence: Math.min(94, Math.round(34 + winner.count * 16 + winner.avg / 3)),
  };
}

function fallbackGroqInsight({ sessions, taskType, quizAnswers, song }) {
  const recommendation = getRecommendation(sessions, taskType);
  const quiz = selectedTerms(quizAnswers).join(', ') || 'no quiz answers yet';
  const songLine = song ? `${song.trackName} by ${song.artistName}` : 'no iTunes track selected';
  return `Groq-ready insight: test ${recommendation.profile.name} against ${songLine}. Your quiz points toward ${quiz}. Run at least two sessions per sound condition, then trust the profile with the best mix of accuracy, speed, and mood lift.`;
}

function App() {
  const [sessions, setSessions] = useState(() => loadJSON(STORAGE_KEY, []));
  const [user, setUser] = useState(() => loadJSON(USER_KEY, null));
  const [view, setView] = useState('lab');
  const [authMode, setAuthMode] = useState('login');
  const [taskType, setTaskType] = useState('math');
  const [profileId, setProfileId] = useState('lofi');
  const [quizAnswers, setQuizAnswers] = useState({ task: 'math', energy: 'medium', lyrics: 'none', sound: 'warm' });
  const [songs, setSongs] = useState([]);
  const [songStatus, setSongStatus] = useState('idle');
  const [songQuery, setSongQuery] = useState('');
  const [musicOptions, setMusicOptions] = useState(() => fallbackMusicOptions({ task: 'math', energy: 'medium', lyrics: 'none', sound: 'warm' }));
  const [selectedSong, setSelectedSong] = useState(null);
  const [preMood, setPreMood] = useState(6);
  const [postMood, setPostMood] = useState(6);
  const [phase, setPhase] = useState('setup');
  const [trialIndex, setTrialIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [startedAt, setStartedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [audioOn, setAudioOn] = useState(false);
  const [groqKey, setGroqKey] = useState(() => sessionStorage.getItem(GROQ_KEY) || '');
  const [groqInsight, setGroqInsight] = useState('');
  const [groqStatus, setGroqStatus] = useState('idle');
  const synthAudioRef = useRef(null);
  const songAudioRef = useRef(null);

  const selectedProfile = audioProfiles.find((profile) => profile.id === profileId);
  const selectedTask = taskTypes.find((task) => task.id === taskType);
  const trials = baseTrials[taskType];
  const recommendation = getRecommendation(sessions, taskType);
  const latest = sessions[0];
  const accuracy = answers.length ? Math.round((answers.filter((answer) => answer.correct).length / answers.length) * 100) : 0;
  const suggestedQuery = useMemo(() => buildSearchTerm(quizAnswers), [quizAnswers]);
  const fallbackOptions = useMemo(() => fallbackMusicOptions(quizAnswers), [quizAnswers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    sessionStorage.setItem(GROQ_KEY, groqKey);
  }, [groqKey]);

  useEffect(() => {
    setMusicOptions(fallbackOptions);
  }, [fallbackOptions]);

  useEffect(() => {
    if (!startedAt || phase !== 'testing') return undefined;
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 300);
    return () => window.clearInterval(timer);
  }, [phase, startedAt]);

  useEffect(() => {
    if (profileId === 'itunes') {
      stopSynthAudio();
      if (audioOn && selectedSong?.previewUrl) {
        songAudioRef.current?.play().catch(() => setAudioOn(false));
      } else {
        songAudioRef.current?.pause();
      }
      return undefined;
    }

    songAudioRef.current?.pause();
    if (!audioOn) {
      stopSynthAudio();
      return undefined;
    }

    const context = new AudioContext();
    const gain = context.createGain();
    gain.gain.value = 0.035;
    gain.connect(context.destination);

    if (profileId === 'silence') {
      synthAudioRef.current = { context };
      return () => stopSynthAudio();
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
    synthAudioRef.current = { context, nodes: [oscillator, oscillatorTwo, lfo] };

    return () => stopSynthAudio();
  }, [audioOn, profileId, selectedSong]);

  function stopSynthAudio() {
    if (!synthAudioRef.current) return;
    synthAudioRef.current.nodes?.forEach((node) => {
      try {
        node.stop();
      } catch {
        // Audio nodes can already be stopped during quick profile switches.
      }
    });
    synthAudioRef.current.context?.close();
    synthAudioRef.current = null;
  }

  async function searchSongs(query = suggestedQuery) {
    setSongStatus('loading');
    setSongQuery(query);
    try {
      const response = await fetch(`https://itunes.apple.com/search?${new URLSearchParams({
        term: query,
        media: 'music',
        entity: 'song',
        limit: '12',
      })}`);
      const data = await response.json();
      const results = (data.results || []).filter((song) => song.previewUrl);
      setSongs(results);
      setSelectedSong(results[0] || null);
      setProfileId('itunes');
      setSongStatus(results.length ? 'ready' : 'empty');
    } catch {
      setSongStatus('error');
    }
  }

  async function askGroq() {
    const localInsight = fallbackGroqInsight({ sessions, taskType, quizAnswers, song: selectedSong });
    if (!groqKey.trim()) {
      setGroqInsight(localInsight);
      setGroqStatus('local');
      return;
    }

    setGroqStatus('loading');
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: 'You are NeuroBeat, a concise focus coach. Recommend music conditions from study performance, mood, and quiz answers.',
            },
            {
              role: 'user',
              content: `Give a short music and study recommendation from this data: task=${taskType}, quiz=${JSON.stringify(quizAnswers)}, selectedSong=${selectedSong ? `${selectedSong.trackName} by ${selectedSong.artistName}` : 'none'}, recentSessions=${JSON.stringify(sessions.slice(0, 6))}.`,
            },
          ],
        }),
      });
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      setGroqInsight(text || localInsight);
      setGroqStatus('ready');
    } catch {
      setGroqInsight(localInsight);
      setGroqStatus('error');
    }
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
      profileName: selectedProfile.name,
      song: selectedSong ? { trackName: selectedSong.trackName, artistName: selectedSong.artistName } : null,
      quizAnswers,
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

  function handleAuth(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextUser = {
      name: form.get('name') || form.get('email')?.split('@')[0] || 'Student',
      email: form.get('email'),
    };
    setUser(nextUser);
    setView('lab');
  }

  return (
    <main className="app-shell">
      <nav className="top-nav">
        <button className="brand" onClick={() => setView('lab')}>
          <span className="brand-mark"><Brain size={22} /></span>
          <span>NeuroBeat</span>
        </button>
        <div className="nav-links">
          <button className={view === 'lab' ? 'active' : ''} onClick={() => setView('lab')}>Lab</button>
          <button className={view === 'music' ? 'active' : ''} onClick={() => setView('music')}>iTunes Music</button>
          <button className={view === 'groq' ? 'active' : ''} onClick={() => setView('groq')}>Groq AI</button>
        </div>
        <div className="auth-actions">
          {user ? (
            <button className="user-pill" onClick={() => setUser(null)}>{user.name}</button>
          ) : (
            <>
              <button onClick={() => { setAuthMode('login'); setView('auth'); }}><LogIn size={16} /> Login</button>
              <button onClick={() => { setAuthMode('register'); setView('auth'); }}><UserPlus size={16} /> Register</button>
            </>
          )}
        </div>
      </nav>

      {view === 'auth' ? (
        <AuthView mode={authMode} onMode={setAuthMode} onSubmit={handleAuth} />
      ) : (
        <>
          <section className="hero">
            <div className="hero-copy">
              <span className="eyebrow"><Sparkles size={16} /> Personalized focus lab</span>
              <h1>NeuroBeat</h1>
              <p>
                Test iTunes song previews, generated focus tones, mood, and study performance.
                Groq AI can turn your results into a personalized study recommendation.
              </p>
              <div className="hero-actions">
                <button className="primary-action" onClick={startTest}><Play size={18} /> Start focus test</button>
                <button className="icon-action" onClick={() => setAudioOn((value) => !value)} title="Preview audio">
                  {audioOn ? <Pause size={20} /> : <Headphones size={20} />}
                </button>
              </div>
            </div>
            <FocusSignal profile={selectedProfile} audioOn={audioOn} song={selectedSong} />
          </section>

          <section className="control-band">
            <Panel title="Task" icon={SlidersHorizontal}>
              <div className="segmented">
                {taskTypes.map((task) => {
                  const Icon = task.icon;
                  return (
                    <button key={task.id} className={taskType === task.id ? 'active' : ''} onClick={() => setTaskType(task.id)}>
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
              {phase === 'post' || phase === 'results' ? <MoodSlider label="After" value={postMood} onChange={setPostMood} /> : null}
            </Panel>

            <Panel title="Recommendation" icon={LineChart}>
              <div className="recommendation">
                <strong>{recommendation.title}</strong>
                <span>{recommendation.detail}</span>
                <div className="confidence"><div style={{ width: `${recommendation.confidence}%` }} /></div>
                <small>{recommendation.confidence}% confidence</small>
              </div>
            </Panel>
          </section>

          <section className="experiment-grid">
            <MusicPanel
              view={view}
              quizAnswers={quizAnswers}
              setQuizAnswers={setQuizAnswers}
              suggestedQuery={suggestedQuery}
              searchSongs={searchSongs}
              songQuery={songQuery}
              setSongQuery={setSongQuery}
              musicOptions={musicOptions}
              groqStatus={groqStatus}
              songs={songs}
              songStatus={songStatus}
              selectedSong={selectedSong}
              setSelectedSong={setSelectedSong}
              profileId={profileId}
              setProfileId={setProfileId}
            />

            <TaskPanel
              phase={phase}
              startTest={startTest}
              selectedProfile={selectedProfile}
              selectedSong={selectedSong}
              elapsed={elapsed}
              trialIndex={trialIndex}
              trials={trials}
              taskType={taskType}
              currentAnswer={currentAnswer}
              setCurrentAnswer={setCurrentAnswer}
              submitAnswer={submitAnswer}
              accuracy={accuracy}
              postMood={postMood}
              setPostMood={setPostMood}
              saveSession={saveSession}
              latest={latest}
              resetExperiment={resetExperiment}
            />
          </section>

          <section className="assistant-history-grid">
            <GroqPanel
              view={view}
              groqKey={groqKey}
              setGroqKey={setGroqKey}
              groqInsight={groqInsight}
              groqStatus={groqStatus}
              askGroq={askGroq}
            />
            <History sessions={sessions} />
          </section>

          <audio ref={songAudioRef} src={selectedSong?.previewUrl || ''} loop onEnded={() => setAudioOn(false)} />
        </>
      )}
    </main>
  );
}

function AuthView({ mode, onMode, onSubmit }) {
  return (
    <section className="auth-view">
      <div>
        <span className="eyebrow"><Lock size={16} /> Student account</span>
        <h1>{mode === 'login' ? 'Welcome Back' : 'Join NeuroBeat'}</h1>
        <p>Save your focus tests, mood ratings, iTunes choices, and personalized recommendations on this device.</p>
      </div>
      <form className="auth-card" onSubmit={onSubmit}>
        {mode === 'register' ? <input name="name" placeholder="Name" required /> : null}
        <input name="email" type="email" placeholder="Email" required />
        <input name="password" type="password" placeholder="Password" required />
        <button className="primary-action" type="submit">{mode === 'login' ? 'Login' : 'Register'} <ChevronRight size={18} /></button>
        <button className="text-action" type="button" onClick={() => onMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Login'}
        </button>
      </form>
    </section>
  );
}

function MusicPanel(props) {
  const {
    quizAnswers,
    setQuizAnswers,
    suggestedQuery,
    searchSongs,
    songQuery,
    setSongQuery,
    musicOptions,
    groqStatus,
    songs,
    songStatus,
    selectedSong,
    setSelectedSong,
    profileId,
    setProfileId,
  } = props;

  return (
    <div className="sound-panel">
      <div className="section-heading">
        <Headphones size={22} />
        <div>
          <h2>Audio Personalization</h2>
          <p>Answer the quiz, let Groq analyze it, then choose iTunes previews.</p>
        </div>
      </div>

      <div className="quiz-stack">
        {quizQuestions.map((question) => (
          <div className="quiz-question" key={question.id}>
            <strong>{question.question}</strong>
            <div className="choice-row">
              {question.options.map((option) => (
                <button
                  key={option.value}
                  className={quizAnswers[question.id] === option.value ? 'selected' : ''}
                  onClick={() => setQuizAnswers({ ...quizAnswers, [question.id]: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="ai-options">
        <div className="ai-options-header">
          <strong>Groq music options</strong>
          <small>{groqStatus === 'loading' ? 'Updating...' : 'Auto analyzed'}</small>
        </div>
        <div className="option-stack">
          {musicOptions.map((option) => (
            <button key={`${option.title}-${option.searchTerm}`} className="music-option" onClick={() => searchSongs(option.searchTerm)}>
              <span>{option.title}</span>
              <small>{option.reason}</small>
              <em>{option.searchTerm}</em>
            </button>
          ))}
        </div>
      </div>

      <div className="itunes-search">
        <div className="search-line">
          <Search size={18} />
          <input value={songQuery} onChange={(event) => setSongQuery(event.target.value)} placeholder={suggestedQuery} />
          <button onClick={() => searchSongs(songQuery || suggestedQuery)}>Find</button>
        </div>
        <button className="secondary-action" onClick={() => searchSongs(suggestedQuery)}>
          <Music2 size={18} /> Get iTunes options
        </button>
        <small>{songStatus === 'loading' ? 'Searching iTunes...' : `Suggested search: ${suggestedQuery}`}</small>
      </div>

      <div className="profile-grid compact">
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
          </button>
        ))}
      </div>

      <div className="song-grid">
        {songs.map((song) => (
          <button
            key={song.trackId}
            className={`song-card ${selectedSong?.trackId === song.trackId ? 'selected' : ''}`}
            onClick={() => { setSelectedSong(song); setProfileId('itunes'); }}
          >
            <img src={song.artworkUrl100} alt="" />
            <span>{song.trackName}</span>
            <small>{song.artistName}</small>
          </button>
        ))}
        {songStatus === 'empty' ? <p className="muted">No preview tracks found. Try a different mood or search term.</p> : null}
      </div>
    </div>
  );
}

function TaskPanel(props) {
  const {
    phase,
    startTest,
    selectedProfile,
    selectedSong,
    elapsed,
    trialIndex,
    trials,
    taskType,
    currentAnswer,
    setCurrentAnswer,
    submitAnswer,
    accuracy,
    postMood,
    setPostMood,
    saveSession,
    latest,
    resetExperiment,
  } = props;

  return (
    <div className="task-panel">
      <div className="section-heading">
        <Clock3 size={22} />
        <div>
          <h2>Timed Study Task</h2>
          <p>{phase === 'testing' ? 'Answer each prompt as accurately as you can.' : 'Configure your test and start when ready.'}</p>
        </div>
      </div>

      {phase === 'setup' ? <EmptyTask startTest={startTest} selectedProfile={selectedProfile} selectedSong={selectedSong} /> : null}

      {phase === 'testing' ? (
        <form className="test-card" onSubmit={submitAnswer}>
          <div className="test-meta">
            <span><TimerReset size={16} /> {elapsed}s</span>
            <span>{trialIndex + 1}/{trials.length}</span>
          </div>
          <h3>{trials[trialIndex].q}</h3>
          <input autoFocus value={currentAnswer} onChange={(event) => setCurrentAnswer(event.target.value)} placeholder={taskType === 'reading' ? 'Key word' : 'Answer'} />
          <button className="primary-action" type="submit">Submit <ChevronRight size={18} /></button>
        </form>
      ) : null}

      {phase === 'post' ? (
        <div className="test-card">
          <div className="score-orb">{accuracy}%</div>
          <h3>Post-study mood check</h3>
          <p>Rate how you feel after this sound condition, then save the trial.</p>
          <MoodSlider label="After" value={postMood} onChange={setPostMood} />
          <button className="primary-action" onClick={saveSession}>Save evidence <BarChart3 size={18} /></button>
        </div>
      ) : null}

      {phase === 'results' && latest ? (
        <div className="test-card results-card">
          <div className="score-row">
            <Metric label="Accuracy" value={`${latest.accuracy}%`} />
            <Metric label="Avg speed" value={`${latest.averageSeconds.toFixed(1)}s`} />
            <Metric label="Mood shift" value={`${latest.postMood - latest.preMood > 0 ? '+' : ''}${latest.postMood - latest.preMood}`} />
          </div>
          <h3>{latest.song ? latest.song.trackName : latest.profileName} evidence saved</h3>
          <p>Your recommendation model has one more signal for future study sessions.</p>
          <button className="secondary-action" onClick={resetExperiment}><RefreshCw size={18} /> Run another condition</button>
        </div>
      ) : null}
    </div>
  );
}

function GroqPanel({ groqKey, setGroqKey, groqInsight, groqStatus, askGroq }) {
  return (
    <section className="grok-panel">
      <div className="section-heading">
        <WandSparkles size={22} />
        <div>
          <h2>Groq AI Coach</h2>
          <p>Use Groq to analyze answers and generate music options.</p>
        </div>
      </div>
      <div className="grok-form">
        <input type="password" value={groqKey} onChange={(event) => setGroqKey(event.target.value)} placeholder="Optional Groq API key" />
        <button className="primary-action" onClick={askGroq}>
          <WandSparkles size={18} /> {groqStatus === 'loading' ? 'Thinking...' : 'Ask Groq'}
        </button>
      </div>
      <p className="grok-output">{groqInsight || 'Without a key, NeuroBeat still gives a local AI-style recommendation from your quiz and session data.'}</p>
    </section>
  );
}

function History({ sessions }) {
  return (
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
            <span>{session.song ? session.song.trackName : session.profileName}</span>
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
      <input type="range" min="1" max="10" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function FocusSignal({ profile, audioOn, song }) {
  return (
    <div className="focus-signal" style={{ '--profile-color': profile.color }}>
      <div className="signal-header">
        <span>{profile.id === 'itunes' && song ? song.trackName : profile.name}</span>
        <strong>{audioOn ? 'Live' : 'Ready'}</strong>
      </div>
      <div className={`wave-field ${audioOn ? 'playing' : ''}`}>
        {Array.from({ length: 42 }).map((_, index) => <span key={index} style={{ '--i': index }} />)}
      </div>
      <div className="signal-footer">
        <span>{profile.id === 'itunes' && song ? song.artistName : profile.label}</span>
        <span>{profile.tempo}</span>
      </div>
    </div>
  );
}

function EmptyTask({ startTest, selectedProfile, selectedSong }) {
  return (
    <div className="test-card empty-task">
      <div className="score-orb small"><Headphones size={28} /></div>
      <h3>{selectedProfile.id === 'itunes' && selectedSong ? selectedSong.trackName : selectedProfile.name} condition ready</h3>
      <p>The timer, answers, pre/post mood, quiz answers, and audio choice will be saved as one experiment.</p>
      <button className="primary-action" onClick={startTest}><Play size={18} /> Begin trial</button>
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
