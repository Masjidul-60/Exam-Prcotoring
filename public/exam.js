const $ = (id) => document.getElementById(id);
let S = null, answers = {}, active = false, timers = [], lastEvt = {};
const stream = { v: null };

$('btnStart').onclick = async () => {
  $('err').textContent = '';
  if (!$('name').value.trim() || !$('roll').value.trim()) return ($('err').textContent = 'Name ar Roll din');
  if (!$('agree').checked) return ($('err').textContent = 'Niyom mene nite hobe');
  try {
    stream.v = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
  } catch { return ($('err').textContent = 'Camera permission dite hobe.'); }
  const r = await fetch('/api/start', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: $('name').value, roll: $('roll').value }) });
  if (!r.ok) return ($('err').textContent = 'Server error');
  S = await r.json();
  try { await document.documentElement.requestFullscreen(); } catch {}
  $('cam').srcObject = stream.v;
  $('title').textContent = S.title;
  renderQs();
  $('start').classList.add('hidden'); $('exam').classList.remove('hidden');
  active = true; startMonitors();
};

function renderQs() {
  $('qs').innerHTML = '';
  S.questions.forEach((q, i) => {
    const c = document.createElement('div'); c.className = 'card';
    const h = document.createElement('b'); h.textContent = `${i + 1}. ${q.q}`; c.appendChild(h);
    q.options.forEach((o, j) => {
      const l = document.createElement('label'); l.className = 'opt';
      const inp = document.createElement('input'); inp.type = 'radio'; inp.name = 'q' + i;
      inp.onchange = () => (answers[i] = j);
      l.append(inp, ' ' + o); c.appendChild(l);
    });
    $('qs').appendChild(c);
  });
}

async function violation(type, detail = '') {
  if (!active) return;
  const now = Date.now();
  if (lastEvt[type] && now - lastEvt[type] < 4000) return; // debounce
  lastEvt[type] = now;
  const r = await fetch('/api/event', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: S.id, type, detail }) }).then((x) => x.json()).catch(() => null);
  if (!r) return;
  $('viol').textContent = `Violations: ${r.violations}/${S.maxViolations}`;
  warn(`Warning: ${type.replace(/_/g, ' ')}`);
  if (r.terminate) finish('violation_limit');
}
function warn(m) { const w = $('warn'); w.textContent = m; w.style.display = 'block'; setTimeout(() => (w.style.display = 'none'), 3000); }

function startMonitors() {
  document.addEventListener('visibilitychange', () => document.hidden && violation('tab_switch'));
  window.addEventListener('blur', () => violation('window_blur'));
  document.addEventListener('fullscreenchange', () => { if (active && !document.fullscreenElement) { violation('fullscreen_exit'); document.documentElement.requestFullscreen().catch(() => {}); } });
  ['contextmenu', 'copy', 'paste', 'cut'].forEach((e) => document.addEventListener(e, (ev) => { ev.preventDefault(); violation(e); }));
  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (e.key === 'F12' || e.key === 'PrintScreen' || (e.ctrlKey && ['u', 's', 'p'].includes(k)) || (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(k))) {
      e.preventDefault(); violation('blocked_key', e.key);
    }
  });
  window.onbeforeunload = () => (active ? 'Exam cholche!' : undefined);

  // timer
  timers.push(setInterval(() => {
    const left = Math.max(0, S.endsAt - Date.now());
    $('timer').textContent = `${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
    if (left <= 0) finish('time_up');
  }, 500));

  // face detection (Chrome/Edge: enable via chrome://flags "Experimental Web Platform features" if unsupported)
  const fd = 'FaceDetector' in window ? new FaceDetector({ fastMode: true, maxDetectedFaces: 3 }) : null;
  if (!fd) console.warn('FaceDetector API not supported; only snapshots will be taken.');
  timers.push(setInterval(async () => {
    if (!fd) return;
    try {
      const faces = await fd.detect($('cam'));
      if (faces.length === 0) violation('no_face');
      else if (faces.length > 1) violation('multiple_faces', faces.length + ' faces');
    } catch {}
  }, 3000));

  // periodic snapshots
  const snap = () => {
    const v = $('cam'), c = $('cv'); c.width = 320; c.height = 240;
    c.getContext('2d').drawImage(v, 0, 0, 320, 240);
    fetch('/api/snapshot', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: S.id, image: c.toDataURL('image/jpeg', 0.6) }) }).catch(() => {});
  };
  setTimeout(snap, 2000); timers.push(setInterval(snap, 20000));
}

async function finish(reason) {
  if (!active) return; active = false;
  timers.forEach(clearInterval);
  const r = await fetch('/api/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: S.id, answers, reason }) }).then((x) => x.json());
  stream.v.getTracks().forEach((t) => t.stop());
  if (document.fullscreenElement) document.exitFullscreen();
  window.onbeforeunload = null;
  $('exam').classList.add('hidden'); $('done').classList.remove('hidden');
  $('result').textContent = `Score: ${r.score}/${r.total}` + (reason !== 'manual' ? ` (auto-submitted: ${reason})` : '');
}
$('btnSubmit').onclick = () => confirm('Submit korben?') && finish('manual');
