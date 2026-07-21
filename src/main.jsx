import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import emailjs from '@emailjs/browser';
import html2canvas from 'html2canvas';
import {
  Activity,
  BarChart3,
  Brain,
  Check,
  ChevronRight,
  Clock3,
  Download,
  Headphones,
  Lock,
  LogIn,
  Mail,
  Music2,
  Pause,
  Play,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Target,
  TimerReset,
  UserPlus,
  WandSparkles,
} from 'lucide-react';
import './styles.css';

const STORAGE_KEY = 'neurobeat-sessions';
const USER_KEY = 'neurobeat-user';
const USERS_KEY = 'neurobeat-users';
const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY || '';
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || '';
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '';
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '';

const navItems = [
  ['home', 'Home'],
  ['features', 'Features'],
  ['how', 'How It Works'],
  ['about', 'About Us'],
  ['focus', 'Focus Test'],
  ['contact', 'Contact'],
];

const audioProfiles = [
  { id: 'brown-noise', name: 'Brown Noise', label: 'Deep steady noise', tempo: '0 BPM', color: '#83684c' },
  { id: 'lofi', name: 'Lo-fi Pulse', label: 'Warm beat, soft texture', tempo: '72 BPM', color: '#2d8c7f' },
  { id: 'alpha', name: 'Alpha Waves', label: 'Clean 10 Hz shimmer', tempo: '10 Hz', color: '#c49f3f' },
  { id: 'itunes', name: 'iTunes Music', label: 'Apple/iTunes song preview', tempo: '30 sec', color: '#a5533f' },
  { id: 'silence', name: 'Silence', label: 'Control condition', tempo: '0 BPM', color: '#56616d' },
];

const taskTypes = [
  { id: 'math', name: 'Mental Math', icon: Target, prompt: 'Fast accuracy under pressure' },
  { id: 'memory', name: 'Memory Recall', icon: Brain, prompt: 'Recall the previous keyword' },
  { id: 'reading', name: 'Reading Focus', icon: Activity, prompt: 'Comprehension and attention' },
];

const roleOptions = ['Student', 'Teacher', 'Employee', 'Creator', 'Other'];
const genreOptions = ['Pop', 'Hip-Hop', 'Rock', 'Classical', 'Jazz', 'Electronic', 'Ambient', 'Lo-fi'];

const roleQuestions = {
  Student: [
    ['activity', 'What are you working on?', ['Problem solving', 'Reading or notes', 'Memorizing']],
    ['energy', 'What energy level helps you study?', ['Calm and steady', 'Medium rhythm', 'High energy']],
  ],
  Teacher: [
    ['activity', 'What kind of work are you doing?', ['Grading', 'Lesson planning', 'Admin work']],
    ['energy', 'What pace feels best?', ['Quiet focus', 'Steady pace', 'Motivating']],
  ],
  Employee: [
    ['activity', 'What work mode are you in?', ['Deep work', 'Email/admin', 'Creative work']],
    ['energy', 'What helps you stay productive?', ['Calm zone', 'Steady rhythm', 'Momentum']],
  ],
  Creator: [
    ['activity', 'What are you creating?', ['Writing', 'Designing', 'Editing']],
    ['energy', 'What kind of flow do you want?', ['Soft flow', 'Groove', 'Drive']],
  ],
  Other: [
    ['activity', 'What are you trying to do?', ['Focus', 'Relax', 'Get energy']],
    ['energy', 'What intensity works for you?', ['Low', 'Medium', 'High']],
  ],
};

const sharedQuestions = [
  ['lyrics', 'Do lyrics distract you?', ['No lyrics', 'Soft vocals are fine', 'Lyrics are okay']],
  ['sound', 'Which sound texture feels best?', ['Warm beats', 'Clean piano', 'Cinematic focus']],
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
    { q: 'K7Q2', a: null, intro: true },
    { q: 'M4P9', a: 'K7Q2' },
    { q: 'A8T3', a: 'M4P9' },
    { q: 'R2N6', a: 'A8T3' },
    { q: 'L5X1', a: 'R2N6' },
    { q: 'C9V4', a: 'L5X1' },
  ],
  reading: [
    { q: 'A focused learner notices when attention drifts and returns to the task.', a: 'attention' },
    { q: 'Short tests can reveal which sound environment supports better recall.', a: 'sound' },
    { q: 'Mood before and after working helps separate comfort from performance.', a: 'mood' },
    { q: 'A useful recommendation should improve as more sessions are recorded.', a: 'recommendation' },
    { q: 'The best focus profile can change between reading, practice, and memorizing.', a: 'profile' },
  ],
};

function loadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function defaultAnswers(role) {
  return Object.fromEntries([...roleQuestions[role], ...sharedQuestions].map(([id, , options]) => [id, options[0]]));
}

function parseArtistPreference(value) {
  const raw = value.trim().replace(/\s+/g, ' ');
  if (!raw) return { artist: '', styleHints: [] };
  const lower = raw.toLowerCase();
  const styleHints = ['lofi', 'ambient', 'calm', 'piano', 'instrumental', 'electronic', 'upbeat', 'chill', 'cinematic', 'focus', 'study']
    .filter((hint) => lower.includes(hint));
  const markerMatch = raw.match(/\b(?:by|from|artist|singer|composer|like|similar to)\s+([a-z0-9 .'-]+?)(?:\s+(?:for|with|but|and|that|which|while|because)\b|[,.;]|$)/i);
  const promptWords = /\b(?:recommend|songs?|music|track|tracks|playlist|please|give|me|for|focus|study|work|while|with|like|similar|to|by|from|artist|based|on|calm|upbeat|lofi|ambient|instrumental|piano|electronic|cinematic|chill)\b/gi;
  const artist = (markerMatch?.[1] || raw).replace(promptWords, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 4).join(' ');
  return { artist: artist || raw.split(/\s+/).slice(0, 4).join(' '), styleHints };
}

function buildSearchTerm(role, answers, artistPreference, genres) {
  const { artist, styleHints } = parseArtistPreference(artistPreference);
  const quizTerms = Object.values(answers).join(' ');
  return [artist, ...styleHints.slice(0, 2), ...genres, quizTerms, role, 'focus music'].filter(Boolean).join(' ');
}

function fallbackMusicOptions(role, answers, artistPreference, genres) {
  const base = buildSearchTerm(role, answers, artistPreference, genres);
  return [
    { title: 'Personal Focus Match', searchTerm: `${base} instrumental`, reason: 'Matches your role, work mode, and optional artist or genre preferences.' },
    { title: 'Low Distraction Flow', searchTerm: `${base} calm ambient`, reason: 'Prioritizes steady attention with fewer distracting changes.' },
    { title: 'Momentum Track', searchTerm: `${base} upbeat focus`, reason: 'Adds energy while staying aligned with your selected preferences.' },
  ];
}

function getTimeAdjustedPercent(taskType, correct, total, elapsed) {
  if (!total) return 0;
  const rawPercent = (correct / total) * 100;
  const targetSeconds = { math: 6, memory: 5, reading: 8 }[taskType];
  return Math.max(0, Math.round(rawPercent - Math.max(0, elapsed / total - targetSeconds) * 3.5));
}

function formatSeconds(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins ? `${mins}m ${secs}s` : `${secs}s`;
}

async function callGroq(messages, fallback) {
  if (!GROQ_KEY) return fallback;
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, temperature: 0.65 }),
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content || fallback;
  } catch {
    return fallback;
  }
}

async function sendEmailJS(templateParams) {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) return { skipped: true };
  return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY);
}

function App() {
  const [page, setPage] = useState('home');
  const [authMode, setAuthMode] = useState('login');
  const [user, setUser] = useState(() => loadJSON(USER_KEY, null));
  const [sessions, setSessions] = useState(() => loadJSON(STORAGE_KEY, []));
  const [authMessage, setAuthMessage] = useState('');
  const [loginPrompt, setLoginPrompt] = useState(false);
  const [role, setRole] = useState('Student');
  const [quizAnswers, setQuizAnswers] = useState(() => defaultAnswers('Student'));
  const [artistPreference, setArtistPreference] = useState('');
  const [artistSuggestions, setArtistSuggestions] = useState([]);
  const [artistStatus, setArtistStatus] = useState('idle');
  const [genres, setGenres] = useState([]);
  const [songs, setSongs] = useState([]);
  const [songStatus, setSongStatus] = useState('idle');
  const [songQuery, setSongQuery] = useState('');
  const [selectedSong, setSelectedSong] = useState(null);
  const [profileId, setProfileId] = useState('lofi');
  const [taskType, setTaskType] = useState('math');
  const [preMood, setPreMood] = useState(6);
  const [postMood, setPostMood] = useState(6);
  const [phase, setPhase] = useState('setup');
  const [trialIndex, setTrialIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [startedAt, setStartedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [audioOn, setAudioOn] = useState(false);
  const [latestSession, setLatestSession] = useState(null);
  const [aiInsight, setAiInsight] = useState('');
  const [aiStatus, setAiStatus] = useState('idle');
  const [feedback, setFeedback] = useState('');
  const [feedbackInsight, setFeedbackInsight] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('idle');
  const songAudioRef = useRef(null);
  const synthAudioRef = useRef(null);
  const cardRef = useRef(null);

  const selectedProfile = audioProfiles.find((profile) => profile.id === profileId);
  const trials = baseTrials[taskType];
  const correctAnswers = answers.filter((answer) => answer.correct).length;
  const currentScore = getTimeAdjustedPercent(taskType, correctAnswers, answers.length, elapsed);
  const suggestedQuery = useMemo(() => buildSearchTerm(role, quizAnswers, artistPreference, genres), [role, quizAnswers, artistPreference, genres]);
  const musicOptions = useMemo(() => fallbackMusicOptions(role, quizAnswers, artistPreference, genres), [role, quizAnswers, artistPreference, genres]);
  const isGameActive = phase === 'testing';

  useEffect(() => localStorage.setItem(USER_KEY, JSON.stringify(user)), [user]);
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)), [sessions]);

  useEffect(() => {
    if (!startedAt || phase !== 'testing') return undefined;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 300);
    return () => window.clearInterval(timer);
  }, [phase, startedAt]);

  useEffect(() => {
    const { artist } = parseArtistPreference(artistPreference);
    if (artist.length < 2 || isGameActive) {
      setArtistSuggestions([]);
      setArtistStatus('idle');
      return undefined;
    }
    setArtistStatus('loading');
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`https://itunes.apple.com/search?${new URLSearchParams({ term: artist, media: 'music', entity: 'musicArtist', limit: '6' })}`);
        const data = await response.json();
        setArtistSuggestions(data.results || []);
        setArtistStatus(data.results?.length ? 'ready' : 'empty');
      } catch {
        setArtistSuggestions([]);
        setArtistStatus('error');
      }
    }, 320);
    return () => window.clearTimeout(timeout);
  }, [artistPreference, isGameActive]);

  useEffect(() => {
    if (profileId === 'itunes') {
      stopSynthAudio();
      if (audioOn && selectedSong?.previewUrl) songAudioRef.current?.play().catch(() => setAudioOn(false));
      else songAudioRef.current?.pause();
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
    const osc = context.createOscillator();
    const oscTwo = context.createOscillator();
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    osc.type = profileId === 'brown-noise' ? 'sawtooth' : 'sine';
    osc.frequency.value = profileId === 'alpha' ? 220 : 110;
    oscTwo.frequency.value = profileId === 'lofi' ? 165 : 118;
    lfo.frequency.value = profileId === 'alpha' ? 10 : 1.2;
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(gain);
    oscTwo.connect(gain);
    osc.start();
    oscTwo.start();
    lfo.start();
    synthAudioRef.current = { context, nodes: [osc, oscTwo, lfo] };
    return () => stopSynthAudio();
  }, [audioOn, profileId, selectedSong]);

  function stopSynthAudio() {
    synthAudioRef.current?.nodes?.forEach((node) => {
      try { node.stop(); } catch { /* already stopped */ }
    });
    synthAudioRef.current?.context?.close();
    synthAudioRef.current = null;
  }

  function navigate(nextPage) {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goAuth(mode) {
    setAuthMode(mode);
    navigate(mode);
  }

  async function handleAuth(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').toLowerCase();
    const name = String(form.get('name') || email.split('@')[0]);
    const users = loadJSON(USERS_KEY, []);
    if (authMode === 'signup') {
      const nextUsers = users.some((item) => item.email === email) ? users : [...users, { email, name }];
      localStorage.setItem(USERS_KEY, JSON.stringify(nextUsers));
      await sendEmailJS({ type: 'registration', user_name: name, user_email: email, message: 'New NeuroBeat registration' });
      setUser({ email, name });
      setAuthMessage('Registration complete. You are signed in.');
      navigate('focus');
      return;
    }
    const found = users.find((item) => item.email === email);
    if (!found) {
      setAuthMessage('No account found for that email. Please sign up first.');
      return;
    }
    await sendEmailJS({ type: 'login', user_name: found.name, user_email: email, message: 'NeuroBeat login' });
    setUser(found);
    setAuthMessage('Logged in successfully.');
    navigate('focus');
  }

  async function searchSongs(query = suggestedQuery) {
    setSongStatus('loading');
    setSongQuery(query);
    try {
      const response = await fetch(`https://itunes.apple.com/search?${new URLSearchParams({ term: query, media: 'music', entity: 'song', limit: '12' })}`);
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

  function startTest() {
    setAnswers([]);
    setTrialIndex(0);
    setCurrentAnswer('');
    setElapsed(0);
    setStartedAt(Date.now());
    setPhase('testing');
    setAudioOn(profileId !== 'silence');
    setAiInsight('');
    setFeedback('');
    setFeedbackInsight('');
  }

  function submitAnswer(event) {
    event.preventDefault();
    const trial = trials[trialIndex];
    if (taskType === 'memory' && trial.intro) {
      setTrialIndex(1);
      return;
    }
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
    const rawAccuracy = answers.length ? Math.round((correct / answers.length) * 100) : 0;
    const session = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      sessionLength: elapsed,
      taskType,
      taskName: taskTypes.find((task) => task.id === taskType).name,
      profileId,
      soundUsed: selectedSong ? `${selectedSong.trackName} by ${selectedSong.artistName}` : selectedProfile.name,
      role,
      quizAnswers,
      artistPreference,
      genres,
      preMood,
      postMood,
      rawAccuracy,
      accuracy: getTimeAdjustedPercent(taskType, correct, answers.length, elapsed),
      averageSeconds: Math.max(1, elapsed / Math.max(1, answers.length)),
    };
    setLatestSession(session);
    setSessions([session, ...sessions]);
    setPhase('results');
  }

  async function generateInsight() {
    if (!user) {
      setLoginPrompt(true);
      return;
    }
    if (!latestSession) return;
    setAiStatus('loading');
    const fallback = `Your ${latestSession.taskName} score was ${latestSession.accuracy}%. ${latestSession.soundUsed} seems worth testing again, especially when your post-session mood is ${latestSession.postMood}/10.`;
    const insight = await callGroq([
      { role: 'system', content: 'You are NeuroBeat. Write one concise, encouraging, evidence-based focus insight.' },
      { role: 'user', content: JSON.stringify(latestSession) },
    ], fallback);
    setAiInsight(insight);
    setAiStatus('ready');
  }

  async function submitFeedback() {
    if (!latestSession || !feedback.trim()) return;
    setFeedbackStatus('loading');
    const fallback = `Based on your feedback, try a calmer instrumental or ambient option next and compare it against ${latestSession.soundUsed}.`;
    const analysis = await callGroq([
      { role: 'system', content: 'Analyze user feedback after a focus session and recommend music for next time in two short sentences.' },
      { role: 'user', content: JSON.stringify({ feedback, latestSession, sessions: sessions.slice(0, 5) }) },
    ], fallback);
    setFeedbackInsight(analysis);
    setFeedbackStatus('ready');
  }

  async function downloadCard() {
    if (!cardRef.current) return;
    const canvas = await html2canvas(cardRef.current, { backgroundColor: '#fffaf0', scale: 2 });
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'neurobeat-ai-insight.png';
    link.click();
  }

  function shareCard(platform) {
    const text = `My NeuroBeat result: ${latestSession?.taskName} | ${latestSession?.accuracy}% | ${latestSession?.soundUsed}. ${aiInsight || ''}`;
    const url = encodeURIComponent(window.location.href);
    const encoded = encodeURIComponent(text);
    if (platform === 'native' && navigator.share) {
      navigator.share({ title: 'NeuroBeat AI Insight', text, url: window.location.href });
      return;
    }
    const links = {
      twitter: `https://twitter.com/intent/tweet?text=${encoded}&url=${url}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      whatsapp: `https://wa.me/?text=${encoded}%20${url}`,
    };
    window.open(links[platform], '_blank', 'noopener,noreferrer');
  }

  const pageContent = {
    home: <HomePage navigate={navigate} />,
    features: <InfoPage title="Features" items={['Role-aware audio personalization', 'iTunes artist autocomplete and preview playback', 'Timed focus tests with speed-adjusted scoring', 'Logged-in AI Insight result cards', 'Feedback-based Groq music recommendations']} />,
    how: <InfoPage title="How It Works" items={['Choose your role, genres, and optional artist preference.', 'Run a short focus task while the selected audio plays.', 'Rate your mood after the test.', 'Generate an AI Insight card and submit feedback for better recommendations.']} />,
    about: <AboutPage />,
    contact: <ContactPage />,
    focus: (
      <FocusPage
        role={role}
        setRole={setRole}
        quizAnswers={quizAnswers}
        setQuizAnswers={setQuizAnswers}
        artistPreference={artistPreference}
        setArtistPreference={setArtistPreference}
        artistSuggestions={artistSuggestions}
        artistStatus={artistStatus}
        setArtistSuggestions={setArtistSuggestions}
        genres={genres}
        setGenres={setGenres}
        musicOptions={musicOptions}
        suggestedQuery={suggestedQuery}
        searchSongs={searchSongs}
        songQuery={songQuery}
        setSongQuery={setSongQuery}
        songs={songs}
        songStatus={songStatus}
        selectedSong={selectedSong}
        setSelectedSong={setSelectedSong}
        audioOn={audioOn}
        setAudioOn={setAudioOn}
        profileId={profileId}
        setProfileId={setProfileId}
        selectedProfile={selectedProfile}
        taskType={taskType}
        setTaskType={setTaskType}
        preMood={preMood}
        setPreMood={setPreMood}
        postMood={postMood}
        setPostMood={setPostMood}
        phase={phase}
        trials={trials}
        trialIndex={trialIndex}
        elapsed={elapsed}
        currentAnswer={currentAnswer}
        setCurrentAnswer={setCurrentAnswer}
        submitAnswer={submitAnswer}
        startTest={startTest}
        saveSession={saveSession}
        latestSession={latestSession}
        currentScore={currentScore}
        isGameActive={isGameActive}
        generateInsight={generateInsight}
        aiInsight={aiInsight}
        aiStatus={aiStatus}
        user={user}
        cardRef={cardRef}
        shareCard={shareCard}
        downloadCard={downloadCard}
        feedback={feedback}
        setFeedback={setFeedback}
        feedbackInsight={feedbackInsight}
        feedbackStatus={feedbackStatus}
        submitFeedback={submitFeedback}
      />
    ),
    results: <ResultsPage sessions={sessions} navigate={navigate} />,
    feedback: <FeedbackPage navigate={navigate} />,
    login: <AuthView mode="login" setMode={goAuth} onSubmit={handleAuth} message={authMessage} />,
    signup: <AuthView mode="signup" setMode={goAuth} onSubmit={handleAuth} message={authMessage} />,
  };

  return (
    <main className="site-shell">
      <Nav page={page} navigate={navigate} goAuth={goAuth} user={user} setUser={setUser} />
      {pageContent[page] || pageContent.home}
      <Footer navigate={navigate} />
      <audio ref={songAudioRef} src={selectedSong?.previewUrl || ''} loop onEnded={() => setAudioOn(false)} />
      {loginPrompt ? <LoginModal close={() => setLoginPrompt(false)} goAuth={goAuth} /> : null}
    </main>
  );
}

function Nav({ page, navigate, goAuth, user, setUser }) {
  return (
    <nav className="top-nav">
      <button className="brand" onClick={() => navigate('home')}><span className="brand-mark"><Brain size={22} /></span><span>NeuroBeat</span></button>
      <div className="nav-links">
        {navItems.map(([id, label]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => navigate(id)}>{label}</button>)}
      </div>
      <div className="auth-actions">
        {user ? <button className="user-pill" onClick={() => setUser(null)}>{user.name} · Logout</button> : (
          <>
            <button onClick={() => goAuth('login')}><LogIn size={16} /> Login</button>
            <button onClick={() => goAuth('signup')}><UserPlus size={16} /> Sign Up</button>
          </>
        )}
      </div>
    </nav>
  );
}

function HomePage({ navigate }) {
  return (
    <section className="landing">
      <div className="hero-copy">
        <span className="eyebrow"><Sparkles size={16} /> Personalized sound science</span>
        <h1>NeuroBeat</h1>
        <p>NeuroBeat tests how music, mood, and task performance interact, then turns your results into personalized focus recommendations.</p>
        <button className="primary-action" onClick={() => navigate('focus')}><Play size={18} /> Focus Test</button>
      </div>
      <div className="landing-panel">
        <h2>What you get</h2>
        <p>Role-aware questions, iTunes previews, timed testing, AI insight cards, feedback analysis, and evidence-backed music choices.</p>
      </div>
      <div className="landing-band">
        <Metric label="Features" value="AI + iTunes" />
        <Metric label="Working" value="Test → Mood → Insight" />
        <Metric label="Owner" value="Samarth" />
      </div>
      <div className="testimonial">“NeuroBeat made focus feel measurable instead of random.”</div>
    </section>
  );
}

function InfoPage({ title, items }) {
  return (
    <section className="content-page">
      <h1>{title}</h1>
      <div className="info-grid">{items.map((item) => <article key={item}><Check size={22} /><p>{item}</p></article>)}</div>
    </section>
  );
}

function AboutPage() {
  return <InfoPage title="About Us" items={['NeuroBeat is built to make focus recommendations personal, measurable, and practical.', 'The product combines timed tasks, mood ratings, music previews, and AI summaries.', 'Owner: Samarth. Built in India for learners, teachers, employees, and creators.']} />;
}

function ContactPage() {
  return (
    <section className="content-page">
      <h1>Contact</h1>
      <div className="contact-card"><Mail size={24} /><p>Email: neurobeat@example.com</p><p>Location: India</p></div>
    </section>
  );
}

function AuthView({ mode, setMode, onSubmit, message }) {
  return (
    <section className="auth-view">
      <div>
        <span className="eyebrow"><Lock size={16} /> NeuroBeat account</span>
        <h1>{mode === 'login' ? 'Login' : 'Sign Up'}</h1>
        <p>EmailJS sends the registration/login event when configured. Your session stays active in this browser.</p>
      </div>
      <form className="auth-card" onSubmit={onSubmit}>
        {mode === 'signup' ? <input name="name" placeholder="Name" required /> : null}
        <input name="email" type="email" placeholder="Email" required />
        <button className="primary-action" type="submit">{mode === 'login' ? 'Login' : 'Sign Up'} <ChevronRight size={18} /></button>
        <button className="text-action" type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Login'}
        </button>
        {message ? <p className="form-message">{message}</p> : null}
      </form>
    </section>
  );
}

function FocusPage(props) {
  return (
    <>
      <section className="hero focus-hero">
        <div className="hero-copy">
          <span className="eyebrow"><Headphones size={16} /> Focus Test</span>
          <h1>Test your sound</h1>
          <p>Choose music, complete a timed task, rate your mood, and generate a shareable AI Insight after the session.</p>
        </div>
        <FocusSignal profile={props.selectedProfile} audioOn={props.audioOn} song={props.selectedSong} />
      </section>
      <section className="control-band">
        <Panel title="Task" icon={Target}><TaskSelector {...props} /></Panel>
        <Panel title="Mood" icon={Activity}><MoodSlider label="Before" value={props.preMood} onChange={props.setPreMood} />{props.phase !== 'setup' ? <MoodSlider label="After" value={props.postMood} onChange={props.setPostMood} /> : null}</Panel>
        <Panel title="Result Access" icon={WandSparkles}><p className="muted">AI Insight is available after a completed session and requires login.</p></Panel>
      </section>
      <section className="experiment-grid">
        <MusicPanel {...props} />
        <TaskPanel {...props} />
      </section>
      {props.phase === 'results' ? <InsightAndFeedback {...props} /> : null}
    </>
  );
}

function TaskSelector({ taskType, setTaskType, isGameActive }) {
  return <div className="segmented">{taskTypes.map((task) => {
    const Icon = task.icon;
    return <button key={task.id} className={taskType === task.id ? 'active' : ''} onClick={() => setTaskType(task.id)} disabled={isGameActive}><Icon size={17} /><span>{task.name}</span></button>;
  })}</div>;
}

function MusicPanel(props) {
  const visibleQuestions = [...roleQuestions[props.role], ...sharedQuestions];
  function toggleGenre(genre) {
    props.setGenres(props.genres.includes(genre) ? props.genres.filter((item) => item !== genre) : [...props.genres, genre]);
  }
  function toggleSong(song) {
    if (props.isGameActive) return;
    const same = props.selectedSong?.trackId === song.trackId;
    props.setSelectedSong(song);
    props.setProfileId('itunes');
    props.setAudioOn(same ? !props.audioOn : true);
  }
  return (
    <div className="sound-panel">
      <div className="section-heading"><Headphones size={22} /><div><h2>Audio Personalization</h2><p>Role, artist, and genres are optional helpers for better recommendations.</p></div></div>
      {props.isGameActive ? <div className="music-lock">⚠️ You cannot change or pause the song while the game is running.</div> : null}
      <div className="quiz-stack">
        <div className="quiz-question"><strong>Select your role</strong><div className="role-row">{roleOptions.map((role) => <button key={role} className={props.role === role ? 'selected' : ''} onClick={() => { props.setRole(role); props.setQuizAnswers(defaultAnswers(role)); }} disabled={props.isGameActive}>{role}</button>)}</div></div>
        {visibleQuestions.map(([id, question, options]) => <div className="quiz-question" key={id}><strong>{question}</strong><div className="choice-row">{options.map((option) => <button key={option} className={props.quizAnswers[id] === option ? 'selected' : ''} onClick={() => props.setQuizAnswers({ ...props.quizAnswers, [id]: option })} disabled={props.isGameActive}>{option}</button>)}</div></div>)}
        <label className="artist-field"><strong>Preferred artist <span>optional</span></strong><div className="artist-autocomplete"><input value={props.artistPreference} onChange={(event) => props.setArtistPreference(event.target.value)} placeholder="Example: FrankJavCee or songs like Hans Zimmer for calm focus" disabled={props.isGameActive} />{props.artistStatus === 'loading' ? <div className="artist-menu"><span>Searching artists...</span></div> : null}{props.artistSuggestions.length ? <div className="artist-menu">{props.artistSuggestions.map((artist) => <button key={artist.artistId} onClick={() => { props.setArtistPreference(artist.artistName); props.setArtistSuggestions([]); }}>{artist.artistName}</button>)}</div> : null}</div></label>
        <div className="genre-field"><strong>Preferred genres <span>optional</span></strong><div className="genre-row">{genreOptions.map((genre) => <button key={genre} className={props.genres.includes(genre) ? 'selected' : ''} onClick={() => toggleGenre(genre)} disabled={props.isGameActive}>{genre}</button>)}</div></div>
      </div>
      <div className="ai-options"><div className="ai-options-header"><strong>Music options</strong><small>Auto personalized</small></div><div className="option-stack">{props.musicOptions.map((option) => <button key={`${option.title}-${option.searchTerm}`} className="music-option" onClick={() => props.searchSongs(option.searchTerm)} disabled={props.isGameActive}><span>{option.title}</span><small>{option.reason}</small><em>{option.searchTerm}</em></button>)}</div></div>
      <div className="itunes-search"><div className="search-line"><Search size={18} /><input value={props.songQuery} onChange={(event) => props.setSongQuery(event.target.value)} placeholder={props.suggestedQuery} disabled={props.isGameActive} /><button onClick={() => props.searchSongs(props.songQuery || props.suggestedQuery)} disabled={props.isGameActive}>Find</button></div><button className="secondary-action" onClick={() => props.searchSongs(props.suggestedQuery)} disabled={props.isGameActive}><Music2 size={18} /> Get iTunes options</button><small>{props.songStatus === 'loading' ? 'Searching iTunes...' : `Suggested search: ${props.suggestedQuery}`}</small></div>
      <div className="profile-grid compact">{audioProfiles.map((profile) => <button key={profile.id} className={`profile-card ${props.profileId === profile.id ? 'selected' : ''}`} onClick={() => props.setProfileId(profile.id)} disabled={props.isGameActive} style={{ '--profile-color': profile.color }}><div className="profile-topline"><span>{profile.name}</span>{props.profileId === profile.id ? <Check size={18} /> : null}</div><p>{profile.label}</p></button>)}</div>
      <div className="song-grid">{props.songs.map((song) => <article key={song.trackId} className={`song-card ${props.selectedSong?.trackId === song.trackId ? 'selected' : ''}`}><img src={song.artworkUrl100} alt="" /><button className="song-select" onClick={() => { props.setSelectedSong(song); props.setProfileId('itunes'); }} disabled={props.isGameActive}><span>{song.trackName}</span><small>{song.artistName}</small></button><button className="song-play" onClick={() => toggleSong(song)} disabled={props.isGameActive}>{props.selectedSong?.trackId === song.trackId && props.audioOn ? <Pause size={16} /> : <Play size={16} />}</button></article>)}{props.songStatus === 'empty' ? <p className="muted">No preview tracks found. Try another artist, genre, or search term.</p> : null}</div>
    </div>
  );
}

function TaskPanel(props) {
  return (
    <div className="task-panel">
      <div className="section-heading"><Clock3 size={22} /><div><h2>Timed Focus Task</h2><p>{props.phase === 'testing' ? 'Answer quickly and accurately.' : 'Configure your audio and begin when ready.'}</p></div></div>
      {props.phase === 'setup' ? <EmptyTask {...props} /> : null}
      {props.phase === 'testing' ? <form className="test-card" onSubmit={props.submitAnswer}><div className="test-meta"><span><TimerReset size={16} /> {props.elapsed}s</span><span>{props.trialIndex + 1}/{props.trials.length}</span></div>{props.taskType === 'memory' ? <div className="memory-prompt"><span>{props.trials[props.trialIndex].intro ? 'First keyword' : 'New keyword'}</span><strong>{props.trials[props.trialIndex].q}</strong><p>{props.trials[props.trialIndex].intro ? 'Remember this keyword. On the next screen, type this previous keyword.' : 'Type the previous keyword, not the one shown above.'}</p></div> : <h3>{props.trials[props.trialIndex].q}</h3>}{props.taskType === 'memory' && props.trials[props.trialIndex].intro ? null : <input autoFocus value={props.currentAnswer} onChange={(event) => props.setCurrentAnswer(event.target.value)} placeholder={props.taskType === 'reading' ? 'Key word' : props.taskType === 'memory' ? 'Previous keyword' : 'Answer'} />}<button className="primary-action" type="submit">{props.taskType === 'memory' && props.trials[props.trialIndex].intro ? 'Start recall' : 'Submit'} <ChevronRight size={18} /></button></form> : null}
      {props.phase === 'post' ? <div className="test-card"><div className="score-orb">{props.currentScore}%</div><h3>Post-session mood</h3><p>This score includes accuracy and a time penalty. Record your current mood before saving.</p><MoodSlider label="After" value={props.postMood} onChange={props.setPostMood} /><button className="primary-action" onClick={props.saveSession}>Save result <BarChart3 size={18} /></button></div> : null}
      {props.phase === 'results' && props.latestSession ? <div className="test-card results-card"><div className="score-row"><Metric label="Score" value={`${props.latestSession.accuracy}%`} /><Metric label="Session" value={formatSeconds(props.latestSession.sessionLength)} /><Metric label="Mood" value={`${props.latestSession.postMood}/10`} /></div><h3>Session complete</h3><p>Generate a logged-in AI Insight card or share feedback below.</p><button className="secondary-action" onClick={props.startTest}><RefreshCw size={18} /> Run another test</button></div> : null}
    </div>
  );
}

function EmptyTask({ selectedProfile, selectedSong, taskType, startTest }) {
  const guide = {
    math: 'Solve short arithmetic and type only the final number.',
    memory: 'First remember a 4-character keyword. Then type the previous keyword on each next screen.',
    reading: 'Read the sentence and type the key word.',
  }[taskType];
  return <div className="test-card empty-task"><div className="score-orb small"><Headphones size={28} /></div><h3>{selectedProfile.id === 'itunes' && selectedSong ? selectedSong.trackName : selectedProfile.name} ready</h3><div className="how-to-play"><strong>How the test works</strong><span>1. Choose your sound and task.</span><span>2. {guide}</span><span>3. Work quickly, because score decreases when average answer time is too slow.</span><span>4. Record mood after the session for the AI summary.</span></div><button className="primary-action" onClick={startTest}><Play size={18} /> Begin trial</button></div>;
}

function InsightAndFeedback(props) {
  const session = props.latestSession;
  return (
    <section className="results-layout">
      <div className="insight-wrap">
        <div className="section-heading"><WandSparkles size={22} /><div><h2>AI Insight Card</h2><p>Logged-in users can generate and share a personalized summary.</p></div></div>
        <button className="primary-action" onClick={props.generateInsight}><WandSparkles size={18} /> {props.aiStatus === 'loading' ? 'Generating...' : 'Generate AI Insight'}</button>
        <article className="share-card" ref={props.cardRef}>
          <span className="eyebrow">NeuroBeat AI Insight</span>
          <h3>{session.taskName}</h3>
          <div className="share-grid"><Metric label="Length" value={formatSeconds(session.sessionLength)} /><Metric label="Sound" value={session.soundUsed} /><Metric label="Score" value={`${session.accuracy}%`} /><Metric label="Mood" value={`${session.postMood}/10`} /></div>
          <p>{props.aiInsight || 'Generate your AI Insight to fill this card with a personalized recommendation.'}</p>
        </article>
        <div className="share-actions"><button onClick={() => props.shareCard('native')}><Share2 size={16} /> Share</button><button onClick={() => props.shareCard('twitter')}><Share2 size={16} /> Twitter</button><button onClick={() => props.shareCard('linkedin')}><Share2 size={16} /> LinkedIn</button><button onClick={() => props.shareCard('whatsapp')}><Share2 size={16} /> WhatsApp</button><button onClick={props.downloadCard}><Download size={16} /> Download Image</button></div>
      </div>
      <div className="feedback-panel">
        <div className="section-heading"><Mail size={22} /><div><h2>Feedback</h2><p>Write about your experience. Groq will recommend music from your feedback and results.</p></div></div>
        <textarea value={props.feedback} onChange={(event) => props.setFeedback(event.target.value)} placeholder="How did the music feel? Were you focused, distracted, calm, energized, or tired?" />
        <button className="primary-action" onClick={props.submitFeedback}>{props.feedbackStatus === 'loading' ? 'Analyzing...' : 'Submit Feedback'}</button>
        {props.feedbackInsight ? <p className="feedback-result">{props.feedbackInsight}</p> : null}
      </div>
    </section>
  );
}

function ResultsPage({ sessions, navigate }) {
  return <section className="content-page"><h1>Results</h1>{sessions.length ? <div className="session-list">{sessions.map((session) => <article key={session.id} className="session-row"><span>{session.taskName}</span><span>{session.soundUsed}</span><strong>{session.accuracy}%</strong><small>{formatSeconds(session.sessionLength)}</small></article>)}</div> : <button className="primary-action" onClick={() => navigate('focus')}>Run your first Focus Test</button>}</section>;
}

function FeedbackPage({ navigate }) {
  return <InfoPage title="Feedback" items={['Feedback appears after completing a focus session.', 'Your written experience is analyzed with session data.', 'Groq returns music recommendations for your next round.']} navigate={navigate} />;
}

function LoginModal({ close, goAuth }) {
  return <div className="modal-backdrop"><div className="modal-card"><h2>Login required</h2><p>AI Insight cards are available only to logged-in users.</p><div className="hero-actions"><button className="primary-action" onClick={() => { close(); goAuth('login'); }}>Log In</button><button className="secondary-action" onClick={() => { close(); goAuth('signup'); }}>Sign Up</button></div><button className="text-action" onClick={close}>Close</button></div></div>;
}

function Footer({ navigate }) {
  return (
    <footer className="footer">
      <div><h3>Quick Links</h3>{[['home', 'Home'], ['about', 'About'], ['focus', 'Focus Test'], ['results', 'Results'], ['feedback', 'Feedback']].map(([id, label]) => <button key={id} onClick={() => navigate(id)}>{label}</button>)}</div>
      <div><h3>Contact</h3><p>neurobeat@example.com</p><p>India</p></div>
      <div><h3>Social Links</h3><a href="https://github.com/samarthuniadmissions-bot/Neurobeats" target="_blank" rel="noreferrer"><Share2 size={16} /> GitHub</a><a href="https://www.linkedin.com" target="_blank" rel="noreferrer"><Share2 size={16} /> LinkedIn</a><a href="https://twitter.com" target="_blank" rel="noreferrer"><Share2 size={16} /> Twitter</a><a href="https://www.instagram.com" target="_blank" rel="noreferrer"><Share2 size={16} /> Instagram</a></div>
      <p className="copyright">© 2026 NeuroBeat. All Rights Reserved.</p>
    </footer>
  );
}

function Panel({ title, icon: Icon, children }) {
  return <article className="panel"><h2><Icon size={18} /> {title}</h2>{children}</article>;
}

function MoodSlider({ label, value, onChange }) {
  return <label className="mood-slider"><span>{label} mood <strong>{value}/10</strong></span><input type="range" min="1" max="10" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function FocusSignal({ profile, audioOn, song }) {
  const frequencyLabel = profile.id === 'itunes' ? 'Dynamic preview spectrum' : profile.id === 'alpha' ? '10 Hz alpha rhythm' : profile.id === 'lofi' ? '72 BPM low-mid pulse' : profile.id === 'brown-noise' ? 'Low-frequency noise curve' : 'Silent baseline';
  return <div className={`focus-signal signal-${profile.id}`} style={{ '--profile-color': profile.color }}><div className="signal-header"><span>{profile.id === 'itunes' && song ? song.trackName : profile.name}</span><strong>{audioOn ? 'Live' : 'Ready'}</strong></div><div className={`frequency-stage ${audioOn ? 'playing' : ''}`}><div className="frequency-grid" /><div className="frequency-line">{Array.from({ length: 72 }).map((_, index) => <span key={index} style={{ '--i': index }} />)}</div><div className="spectrum-bars">{Array.from({ length: 34 }).map((_, index) => <span key={index} style={{ '--i': index }} />)}</div><span className="frequency-label">{frequencyLabel}</span></div><div className="signal-footer"><span>{profile.id === 'itunes' && song ? song.artistName : profile.label}</span><span>{profile.tempo}</span></div></div>;
}

function Metric({ label, value }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

createRoot(document.getElementById('root')).render(<App />);
