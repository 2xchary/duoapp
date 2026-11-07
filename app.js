'use strict';
/* Owlery: shared PWA for two. No build step.
   Data sits behind `store` so localStorage can later be swapped for Supabase (realtime). */

const CFG = window.CONFIG || {};
const KEY = 'owlery.v2';
const DAY0 = 7 * 60, DAY1 = 24 * 60, SPAN = DAY1 - DAY0; // the Hours page shows 7am to midnight
const DAY_TYPES = [
  { id: 'watch', e: '🎬', t: 'Watch party' }, { id: 'text', e: '💌', t: 'Texting day' },
  { id: 'quick', e: '📞', t: 'Quick call' }, { id: 'long', e: '🕯️', t: 'Long call' }, { id: 'dinner', e: '🍝', t: 'Dinner night' },
];
const MOODS = ['😊', '🥰', '😴', '🤪', '😤', '🥲', '🤒', '🔥'];
const QUICK_GIFS = ['happy', 'sleepy', 'stressed', 'in love', 'hungry', 'silly', 'proud', 'sad'];
const DECREES = { watch: 'Popcorn is mandatory.', text: 'Thumbs at the ready.', quick: 'Brevity. Like a good owl.', long: 'Clear the evening. Charge the phone.', dinner: 'Eat. Together. Separately.' };
// Verse of the day, rotating daily. King James Version (public domain). A few are chosen for being far apart.
const VERSES = [
  { r: 'Psalm 118:24', t: 'This is the day which the LORD hath made; we will rejoice and be glad in it.' },
  { r: 'Genesis 31:49', t: 'The LORD watch between me and thee, when we are absent one from another.' },
  { r: 'Lamentations 3:22-23', t: 'His compassions fail not. They are new every morning: great is thy faithfulness.' },
  { r: 'Philippians 1:3', t: 'I thank my God upon every remembrance of you.' },
  { r: 'Proverbs 3:5', t: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.' },
  { r: 'Psalm 121:8', t: 'The LORD shall preserve thy going out and thy coming in from this time forth, and even for evermore.' },
  { r: 'Philippians 4:6', t: 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.' },
  { r: 'Ecclesiastes 4:9', t: 'Two are better than one; because they have a good reward for their labour.' },
  { r: 'Isaiah 41:10', t: 'Fear thou not; for I am with thee: be not dismayed; for I am thy God.' },
  { r: '1 Corinthians 13:13', t: 'And now abideth faith, hope, charity, these three; but the greatest of these is charity.' },
  { r: 'Joshua 1:9', t: 'Be strong and of a good courage; be not afraid: for the LORD thy God is with thee whithersoever thou goest.' },
  { r: 'Psalm 4:8', t: 'I will both lay me down in peace, and sleep: for thou, LORD, only makest me dwell in safety.' },
  { r: '1 Thessalonians 5:11', t: 'Wherefore comfort yourselves together, and edify one another.' },
  { r: 'Colossians 3:23', t: 'And whatsoever ye do, do it heartily, as to the Lord, and not unto men.' },
  { r: 'Psalm 46:1', t: 'God is our refuge and strength, a very present help in trouble.' },
  { r: 'Romans 12:12', t: 'Rejoicing in hope; patient in tribulation; continuing instant in prayer.' },
  { r: 'Hebrews 10:24', t: 'And let us consider one another to provoke unto love and to good works.' },
  { r: 'Psalm 37:4', t: 'Delight thyself also in the LORD; and he shall give thee the desires of thine heart.' },
  { r: 'Matthew 6:34', t: 'Take therefore no thought for the morrow: for the morrow shall take thought for the things of itself.' },
  { r: 'Romans 8:28', t: 'And we know that all things work together for good to them that love God.' },
  { r: 'Psalm 23:1', t: 'The LORD is my shepherd; I shall not want.' },
];
const verseOf = d => VERSES[Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5) % VERSES.length];
const INKS = ['#2b1d12', '#7a1f2b', '#1f4b6e', '#3f5b3a'];
const TABS = [['today', '📜', 'Today'], ['sched', '🕰️', 'Hours'], ['plans', '🍝', 'Plans'], ['owl', '🦉', 'Owl'], ['notes', '✉️', 'Notes'], ['word', '📖', 'Word']];

const pad = n => String(n).padStart(2, '0');
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tmin = m => { const h = Math.floor(m / 60) % 24, mm = m % 60; return `${h % 12 || 12}${mm ? ':' + pad(mm) : ''}${h < 12 ? 'a' : 'p'}`; };
const hhmm = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const parseHM = v => { const [h, m] = (v || '0:0').split(':').map(Number); return h * 60 + m; };
const pct = m => ((m - DAY0) / SPAN) * 100;
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const pretty = (d, long) => d.toLocaleDateString(undefined, long ? { weekday: 'long', month: 'long', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' });
const rnd = (a, b) => a + Math.random() * (b - a);
const other = w => (w === 'a' ? 'b' : 'a');
const $ = sel => document.querySelector(sel);

/* ---------- store ---------- */
const blank = () => ({
  me: null, names: { a: 'Me', b: 'Partner' }, days: {}, events: [], pings: [], notes: [],
  meals: ['Tacos', 'Pasta', 'Sushi', 'Pizza', 'Breakfast for dinner'],
  plate: { a: { total: 0, done: 0 }, b: { total: 0, done: 0 } }, plateSrc: 'demo', visit: null, lastPingDay: '', seeded: false,
});
const store = {
  s: null,
  key: KEY,
  load() { try { this.s = { ...blank(), ...JSON.parse(localStorage.getItem(this.key) || '{}') }; } catch { this.s = blank(); } return this.s; },
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.s)); } catch { toast('Storage full. Try fewer photos!'); } if (SYNC.on && this.s.me) diff(); },
  day(k) { return (this.s.days[k] ||= { type: '', note: '', dinner: { chosen: '', votes: { a: '', b: '' } }, a: { bible: null }, b: { bible: null } }); },
};
const S = () => store.s;
const finalDish = day => { const v = day.dinner.votes; return v.a && v.a === v.b ? v.a : day.dinner.chosen; };

/* ---------- time maths ---------- */
// A block can repeat: 'none' (just that day), 'daily', or 'weekly' on chosen weekdays (0 = Sunday). `skip` holds days removed from a series.
function occursOn(e, k) {
  if (e.skip?.includes(k)) return false;
  const rep = e.rep || 'none';
  if (rep === 'none') return e.day === k;
  if (k < e.day || (e.until && k > e.until)) return false;
  if (rep === 'daily') return true;
  return (e.days?.length ? e.days : [keyDate(e.day).getDay()]).includes(keyDate(k).getDay());
}
const eventsOf = (k, who) => S().events.filter(e => (!who || e.who === who) && occursOn(e, k)).map(e => ({ ...e, day: k, _rep: (e.rep || 'none') !== 'none' }));
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const repText = e => (e.rep === 'daily' ? 'every day' : 'every ' + [...(e.days || [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(i => WD[i]).join(', '));
function freeSlots(k) { // gaps (>=30 min) where nobody has anything on
  const busy = eventsOf(k).map(e => [Math.max(e.s, DAY0), Math.min(e.e, DAY1)]).sort((x, y) => x[0] - y[0]);
  const out = []; let cur = DAY0;
  for (const [s, e] of busy) { if (s - cur >= 30) out.push([cur, s]); cur = Math.max(cur, e); }
  if (DAY1 - cur >= 30) out.push([cur, DAY1]);
  return out;
}
const rangeText = r => r.map(([a, b]) => `${tmin(a)}–${tmin(b)}`);
function layoutLane(list) {
  const s = [...list].sort((a, b) => a.s - b.s || a.e - b.e), out = []; let cl = [], end = -1;
  const flush = () => { const cols = []; cl.forEach(ev => { let i = cols.findIndex(e => e <= ev.s); if (i < 0) { i = cols.length; cols.push(0); } cols[i] = ev.e; ev._c = i; }); cl.forEach(ev => out.push({ ev, c: ev._c, n: cols.length })); cl = []; };
  s.forEach(ev => { if (cl.length && ev.s >= end) { flush(); end = -1; } cl.push(ev); end = Math.max(end, ev.e); });
  if (cl.length) flush();
  return out;
}
function streak(who) {
  let n = 0, d = new Date();
  if (!store.day(dkey(d))[who].bible?.done) d = addDays(d, -1);
  while (S().days[dkey(d)]?.[who].bible?.done) { n++; d = addDays(d, -1); }
  return n;
}
const latestPing = w => S().pings.find(p => p.by === w && dkey(new Date(p.t)) === dkey(new Date()));

/* ---------- ui helpers ---------- */
let planMode = 'day', weekStart = null, schedMode = 'day', hWeekStart = null;
let tab = 'today', viewDate = new Date(), owlMode = 'send', notesMode = 'write', wallIdx = 0, mailIdx = null;
let draft = { photo: '', mood: '', gif: '', text: '' };
let ndraft = { text: '' };
let strokes = [], curStroke = null, pen = INKS[0];
function toast(msg, bad) { if (bad) SFX.play('nope'); const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400); }
const sc = (inner, cls = '', rot = 0, tape = '', extra = '') => `<div class="sc ${extra}" style="--r:${rot}deg">${tape ? `<span class="tape ${tape}"></span>` : ''}<div class="scrap ${cls}">${inner}</div></div>`;

/* ---------- plate + mood visuals ---------- */
function plateSVG(total, done) {
  const cols = ['#6aa84f', '#e8923a', '#c0503a', '#d9b44a', '#8a5a9c'];
  let items = '';
  const n = Math.min(total, 14);
  for (let i = 0; i < n; i++) {
    const r = 5 + Math.sqrt(i) * 8.4, th = i * 2.4, x = 50 + r * Math.cos(th), y = 50 + r * Math.sin(th), isDone = i < Math.round(done * n / (total || 1));
    items += isDone ? `<circle cx="${x}" cy="${y}" r="1.7" fill="#b9a97f" opacity=".7"/>` : `<circle cx="${x}" cy="${y}" r="5.6" fill="${cols[i % cols.length]}"/><circle cx="${x - 1.8}" cy="${y - 1.8}" r="1.6" fill="#fff" opacity=".45"/>`;
  }
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="47" fill="#fffdf6" stroke="#cdbf9d" stroke-width="2"/><circle cx="50" cy="50" r="37" fill="none" stroke="#e4dcc6" stroke-width="2"/>${items}</svg>`;
}
function plateHTML(w) {
  const p = S().plate[w], left = Math.max(0, p.total - p.done);
  const label = !p.total ? 'Nothing. Suspicious.' : left === 0 ? 'Licked clean ✨' : left <= 2 ? 'Light snack' : left <= 5 ? 'Decent plate' : 'Feast of doom';
  const line = S().plateSrc === 'none' ? 'not linked' : !p.total ? 'nothing!' : left === 0 ? 'all done ✨' : `${left} left${S().plateSrc === 'demo' ? '*' : ''}`;
  return `<button class="plate-box" data-go="sched" aria-label="${esc(S().names[w])}'s plate: ${label}${S().plateSrc === 'demo' ? ' (demo numbers)' : ''}" title="${label}">${plateSVG(p.total, p.done)}<b>${line}</b></button>`;
}
const sentAt = t => { const d = new Date(t); return tmin(d.getHours() * 60 + d.getMinutes()); };
const agoText = t => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)}h ago`; };
function moodWhen(w) { // when the current mood was sent, and whether it has changed since this morning
  const mine = S().pings.filter(p => p.by === w && dkey(new Date(p.t)) === dkey(new Date())), p = mine[0];
  if (!p) return w === S().me ? 'Tap to set your mood' : 'No mood yet today';
  return `${mine.length > 1 ? 'Changed' : 'Sent'} ${sentAt(p.t)} · ${agoText(p.t)}`;
}
function moodPol(w, rot) { // yours opens a quick mood update; theirs opens the owl wall
  const p = latestPing(w), mine = w === S().me, act = mine ? 'data-act="moodset"' : 'data-go="owl"';
  if (!p) return `<button class="mood-pol none" style="--r:${rot}deg" ${act} aria-label="${mine ? 'Set your mood' : 'No mood yet'}"><div class="im">${mine ? '+' : '?'}</div></button>`;
  const img = p.gif || p.photo;
  return `<button class="mood-pol" style="--r:${rot}deg" ${act} aria-label="${mine ? 'Change your mood' : 'See their mood'}"><span class="tape tc"></span>${img ? `<img class="im" src="${esc(img)}" alt="" onerror="this.outerHTML='<div class=im>${p.mood || '🦉'}</div>'">` : `<div class="im">${p.mood || '🦉'}</div>`}${img && p.mood ? `<span class="em">${p.mood}</span>` : ''}${mine ? '<span class="edit-badge">✎</span>' : ''}<div class="cap">${esc((p.text || '').slice(0, 24)) || '&nbsp;'}</div></button>`;
}
let mf = { mood: '', gif: '', text: '' }, gifTarget = 'owl';
function moodFormHTML() {
  return sc(`<div class="pk-head"><span>How are you feeling?</span><button data-act="close" aria-label="Close">✕</button></div>
    <div class="mood-grid">${MOODS.map(m => `<button class="mood big" aria-pressed="${mf.mood === m}" data-act="mfmood" data-m="${m}">${m}</button>`).join('')}</div>
    <div class="gif-row"><button class="btn small" data-act="mfgif">🎞️ ${mf.gif ? 'Change GIF' : 'Add a GIF'}</button>${mf.gif ? `<div class="gif-thumb"><img src="${esc(mf.gif)}" alt=""><button data-act="mfgifclear" aria-label="Remove GIF">✕</button></div>` : ''}</div>
    <div class="fld"><textarea id="mtext" maxlength="60" placeholder="a word about it (optional)…">${esc(mf.text)}</textarea></div>
    <div class="row" style="justify-content:space-between"><span class="margin-note">${esc(S().names[other(S().me)])} sees this right away.</span><button class="btn alt" data-act="mfsave">Update</button></div>`, 'cream', 0, 'tc');
}

/* ---------- views ---------- */
function render() {
  if (SYNC.wanted && SYNC.state !== 'ready') return renderGate();
  if (!S().me) return renderWho();
  const unread = S().notes.filter(n => n.by !== S().me && !n.read).length;
  $('#tabs').innerHTML = TABS.map(([id, ic, l]) => `<button data-tab="${id}" ${tab === id ? 'aria-current="page"' : ''}><span class="ic">${ic}</span>${l}${id === 'notes' && unread ? `<i class="badge">${unread}</i>` : ''}</button>`).join('');
  const v = { today: viewToday, sched: viewSched, plans: viewPlans, owl: viewOwl, notes: viewNotes, word: viewWord }[tab]();
  const el = $('#view'); el.className = 'v-' + tab; el.innerHTML = v;
  afterRender();
}
function afterRender() { if (tab === 'notes' && notesMode === 'write') padInit(); tickNow(); placeRings(); }

function renderWho() {
  $('#tabs').innerHTML = '';
  $('#view').className = 'v-who';
  $('#view').innerHTML = `
    <span class="date-big">Who goes<br>there?</span>
    <p class="kicker">Pick your side of the parchment. You can swap later.</p>
    <label class="small">First phone's name</label><input class="field" id="nameA" value="${esc(S().names.a)}" placeholder="your name">
    <label class="small">Second phone's name</label><input class="field" id="nameB" value="${esc(S().names.b)}" placeholder="partner's name">
    <div class="row" style="justify-content:center;gap:1rem;margin-top:.8rem">
      <button class="btn" data-act="iam" data-w="a">I'm the first</button>
      <button class="btn alt" data-act="iam" data-w="b">I'm the second</button>
    </div>
    <p class="margin-note">Each phone picks a different side, or the owls get confused.</p>`;
}

function viewToday() {
  const me = S().me, her = other(me), k = dkey(new Date()), day = store.day(k), N = S().names;
  const type = DAY_TYPES.find(t => t.id === day.type), dish = finalDish(day), free = freeSlots(k);
  const bar = Array.from({ length: 34 }, (_, i) => { const a = DAY0 + i * 30; return `<i class="${free.some(([s, e]) => a >= s && a + 30 <= e) ? 'f' : ''}"></i>`; }).join('');
  const nowPos = pct(nowMin()), vs = verseOf(new Date());
  const ms = w => `<span class="mini-seal ${day[w].bible?.done ? 'on' : ''}" title="${esc(N[w])}'s Daily Word ${day[w].bible?.done ? 'done' : 'not yet'}"></span>`;
  const person = (w, rot, tape) => sc(`<div class="prow"><div class="pinfo"><div class="who-tag ${w === me ? 'me' : 'her'}">${ms(w)}${esc(N[w])}</div><div class="now-st" data-st="${w}">${statusOf(w)}</div><div class="mood-when" data-mw="${w}">${moodWhen(w)}</div></div>${moodPol(w, rot)}${plateHTML(w)}</div>`, 'cream', rot / 5, tape);
  return `<div class="spread"><section class="pg">
    <div class="masthead">
      ${sc(`<span class="date-big">${pretty(new Date(), true).replace(', ', ',<br>')}</span>`, 'lined', -1.5, 'tl')}
      <div class="mast-r"><button class="sfx-btn" data-act="sfx" aria-label="${SFX.on ? 'Mute sounds' : 'Turn sounds on'}">${SFX.on ? '🔊' : '🔇'}</button> <button class="who-switch" data-act="${SYNC.on ? 'whoami' : 'switchwho'}">I'm ${esc(N[me])}</button>${visitTicket()}</div>
    </div>
    <button class="verse-strip" data-go="word" aria-label="Open today's verse"><span>“${esc(vs.t)}”</span><em>${esc(vs.r)}</em></button>
    ${sc(`${type ? `<button data-go="plans"><span class="stamp">${type.t}</span></button>` : `<button data-go="plans"><span class="stamp empty">Undecreed</span></button><div class="margin-note">Tap to decide the day.</div>`}${type?.id === 'dinner' ? `<div class="free-line">On the menu: <b>${esc(dish || 'undecided (!!)')}</b></div>` : ''}`, 'kraft center', 1, 'tc')}
    ${sc(`<div class="free-head"><span class="kicker">Free together</span><span class="tb-key"><i class="g"></i>both free <i class="x"></i>busy</span></div><div class="free-line">${free.length ? rangeText(free).slice(0, 3).map(r => `<b>${r}</b>`).join(' · ') : 'None today. Tragic.'}</div><div class="timebar">${bar}<b class="now" style="left:${nowPos}%" title="now"></b></div><div class="tb-ticks"><span style="left:0">7a</span><span style="left:${pct(720)}%">12p</span><span style="left:${pct(1080)}%">6p</span><span style="left:100%">12a</span></div>`, 'cream', -.8)}
  </section><section class="pg">
    <div class="people">${person(me, -3, 'tl')}${person(her, 3, 'tr blue')}</div>
  </section></div>`;
}

function blockHTML(l, who) {
  const mine = who === S().me, { ev, c, n } = l, top = pct(Math.max(ev.s, DAY0)), h = pct(Math.min(ev.e, DAY1)) - top;
  return `<button class="blk ${ev.kind} ${mine ? 'me' : 'her'} ${ev.e - ev.s <= 60 ? 'short' : ''}" data-act="ev" data-id="${ev.id}" style="top:${top}%;height:${h}%;left:${(c / n) * 100}%;width:${100 / n}%"><b>${esc(ev.title)}${ev._rep ? ' ↻' : ''}</b><small>${tmin(ev.s)}–${tmin(ev.e)}</small></button>`;
}
function viewSched() {
  if (schedMode === 'week') return viewSchedWeek();
  const me = S().me, her = other(me), k = dkey(viewDate), N = S().names, isToday = k === dkey(new Date());
  const lines = Array.from({ length: 17 }, (_, i) => `<div class="hl" style="top:${pct((7 + i) * 60)}%"><span>${tmin((7 + i) * 60)}</span></div>`).join('');
  const bands = freeSlots(k).map(([a, b]) => `<div class="fband" style="top:${pct(a)}%;height:${pct(b) - pct(a)}%"></div>`).join('');
  const lane = who => layoutLane(eventsOf(k, who)).map(l => blockHTML(l, who)).join('');
  return `
    ${schedSeg()}
    <div class="daynav"><button data-act="day" data-n="-1" aria-label="Previous day">‹</button>
      <div class="mid"><span class="date-big">${pretty(viewDate)}</span>${isToday ? '<div class="margin-note">today</div>' : '<div><button class="who-switch" data-act="dtoday">back to today</button></div>'}</div>
      <button data-act="day" data-n="1" aria-label="Next day">›</button></div>
    <div class="lanes-head"><div></div><div class="me">${esc(N[me])}</div><div class="her">${esc(N[her])}</div></div>
    <div class="tl" id="tl"><div class="bg">${bands}${lines}${isToday ? '<div class="nowbar" id="nowbar"><i>🔥</i><span id="nowlbl"></span></div>' : ''}</div>
      <div class="lanes"><div class="lane me" data-act="lane">${lane(me)}</div><div class="lane her">${lane(her)}</div></div></div>
    <div class="foot"><span><i class="kd gold"></i>both free</span><button class="btn alt small" data-act="evnew">+ Busy time</button></div>`;
}
const schedSeg = () => `<div class="seg"><button data-act="schedmode" data-m="day" aria-pressed="${schedMode === 'day'}">Day</button><button data-act="schedmode" data-m="week" aria-pressed="${schedMode === 'week'}">Week</button></div>`;
function viewSchedWeek() { // one row per day: your blocks on top, theirs below, gold where you're both free
  const me = S().me, her = other(me), N = S().names, today = dkey(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(hWeekStart, i)), f = d => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const bars = (k, who) => eventsOf(k, who).map(ev => { const a = pct(Math.max(ev.s, DAY0)), b = pct(Math.min(ev.e, DAY1)); return `<i class="wb ${ev.kind} ${who === me ? 'me' : 'her'}" style="left:${a}%;width:${b - a}%" title="${esc(ev.title)} ${tmin(ev.s)}–${tmin(ev.e)}"></i>`; }).join('');
  const rows = days.map(d => {
    const k = dkey(d), type = DAY_TYPES.find(t => t.id === S().days[k]?.type);
    const free = freeSlots(k).map(([a, b]) => `<i class="wfree" style="left:${pct(a)}%;width:${pct(b) - pct(a)}%"></i>`).join('');
    return `<button class="wkh-row ${k === today ? 'today' : ''}" data-act="wkhopen" data-k="${k}"><span class="wkh-day"><b>${d.toLocaleDateString(undefined, { weekday: 'short' })}</b><span>${d.getDate()}</span>${type ? `<em>${type.e}</em>` : ''}</span>
      <span class="wkh-strip">${free}<span class="wl top">${bars(k, me)}</span><span class="wl bot">${bars(k, her)}</span>${k === today ? `<i class="wnow" style="left:${pct(nowMin())}%"></i>` : ''}</span></button>`;
  }).join('');
  return `${schedSeg()}
    <div class="daynav"><button data-act="wkh" data-n="-1" aria-label="Previous week">‹</button><div class="mid"><span class="date-big">${f(days[0])} – ${f(days[6])}</span></div><button data-act="wkh" data-n="1" aria-label="Next week">›</button></div>
    <div class="wkh-ticks"><span class="sp"></span><span class="tk"><i style="left:0">7a</i><i style="left:${pct(12 * 60)}%">12p</i><i style="left:${pct(18 * 60)}%">6p</i><i style="left:100%">12a</i></span></div>
    <div class="wk">${rows}</div>
    <div class="foot"><span><i class="kd me"></i>${esc(N[me])} (top) <i class="kd her"></i>${esc(N[her])} (bottom) <i class="kd gold"></i>both free</span></div>`;
}
function tickNow() {
  const bar = $('#nowbar'); if (!bar) return;
  const m = nowMin();
  bar.style.display = m < DAY0 || m > DAY1 ? 'none' : 'flex'; bar.style.top = pct(m) + '%';
  const l = $('#nowlbl'); if (l) l.textContent = tmin(m);
}
setInterval(tickNow, 30000);

const mondayOf = d => { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const keyDate = k => new Date(k + 'T12:00:00');
const planSeg = () => `<div class="seg"><button data-act="planmode" data-m="day" aria-pressed="${planMode === 'day'}">Day</button><button data-act="planmode" data-m="week" aria-pressed="${planMode === 'week'}">Week</button></div>`;
function viewWeek() {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), today = dkey(new Date());
  const rows = days.map(d => {
    const k = dkey(d), day = store.day(k), dish = finalDish(day);
    const hint = day.type === 'dinner' ? (dish || 'pick a dish!') : (day.note || '').slice(0, 16);
    return `<div class="wk-row ${k === today ? 'today' : ''}"><button class="wk-day" data-act="wkopen" data-k="${k}"><b>${d.toLocaleDateString(undefined, { weekday: 'short' })}</b><span>${d.getDate()}</span>${hint ? `<small>${esc(hint)}</small>` : ''}</button>
      <div class="wk-stk">${DAY_TYPES.map(t => `<button class="mini ${day.type === t.id ? 'on' : ''}" data-act="wkset" data-k="${k}" data-id="${t.id}" aria-label="${t.t}" aria-pressed="${day.type === t.id}">${t.e}</button>`).join('')}</div></div>`;
  }).join('');
  const a = days[0], z = days[6], f = d => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${planSeg()}
    <div class="daynav"><button data-act="wk" data-n="-1" aria-label="Previous week">‹</button><div class="mid"><span class="date-big">${f(a)} – ${f(z)}</span></div><button data-act="wk" data-n="1" aria-label="Next week">›</button></div>
    <div class="wk-legend">${DAY_TYPES.map(t => `<span>${t.e} ${t.t}</span>`).join('')}</div>
    <div class="wk">${rows}</div>`;
}
function viewPlans() {
  if (planMode === 'week') return viewWeek();
  const k = dkey(viewDate), day = store.day(k), me = S().me, her = other(me), N = S().names;
  const tilt = [-3, 2, -1, 3, -2], dish = finalDish(day), v = day.dinner.votes;
  const chips = S().meals.map((m, i) => `<button class="chip ${dish === m ? 'final' : ''}" style="--r:${[-2, 1.5, -1, 2, -1.5, 1][i % 6]}deg" data-act="vote" data-m="${esc(m)}">${esc(m)}<span class="votes">${v[me] === m ? `<i class="dot me">${esc(N[me][0])}</i>` : ''}${v[her] === m ? `<i class="dot her">${esc(N[her][0])}</i>` : ''}</span></button>`).join('');
  const verdict = dish ? `Tonight: <b>${esc(dish)}</b>` : (v[me] && v[her] && v[me] !== v[her]) ? 'Disagreement detected. Summon the Hat.' : 'Vote for dinner: tap what you want';
  return `${planSeg()}
    <div class="daynav"><button data-act="day" data-n="-1">‹</button><div class="mid"><span class="date-big">${pretty(viewDate)}</span></div><button data-act="day" data-n="1">›</button></div>
    <div class="stickers">${DAY_TYPES.map((t, i) => `<button class="sticker" style="--r:${tilt[i]}deg" aria-pressed="${day.type === t.id}" data-act="type" data-id="${t.id}"><span class="e">${t.e}</span>${t.t}</button>`).join('')}</div>
    ${day.type === 'dinner' ? `
      <div class="verdict big">${verdict}</div>
      <div class="chips big">${chips}</div>
      <div class="inline-add"><input id="newMeal" placeholder="add a dish…" maxlength="30"><button class="btn small" data-act="addmeal">Add</button></div>
      <button class="btn alt wide" data-act="hat">🎩 Let the Hat decide</button>`
    : sc(`<div class="margin-note">${day.type ? DECREES[day.type] : 'Pick a sticker. The owls are waiting.'}</div><textarea class="field" id="dnote" maxlength="200" placeholder="${day.type ? 'Details: which movie? what time?' : ''}" ${day.type ? '' : 'disabled'}>${esc(day.note)}</textarea>`, 'lined', -.5, 'tc', 'grow')}`;
}

function pingHTML(p) {
  const N = S().names, img = p.photo;
  return `<div class="polaroid" style="--r:${(p.id % 5) - 2}deg"><span class="tape tc"></span>
    ${img ? `<img class="ph" src="${img}" alt="">` : `<div class="ph">${p.mood || '🦉'}</div>`}
    ${p.gif ? `<img class="gif" src="${esc(p.gif)}" alt="" onerror="this.remove()">` : ''}
    <div class="cap">${p.mood && img ? p.mood + ' ' : ''}${esc(p.text)}</div>
    <div class="by">${esc(N[p.by])}, ${new Date(p.t).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</div></div>`;
}
function dueNow() {
  const k = dkey(new Date()), seed = [...k].reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
  return new Date().getHours() >= 10 + (Math.abs(seed) % 10);
}
function viewOwl() {
  const due = !latestPing(S().me) && dueNow(), pings = S().pings;
  wallIdx = Math.min(wallIdx, Math.max(0, pings.length - 1));
  return `
    <div class="mode-switch"><button data-act="owlmode" data-m="send" aria-pressed="${owlMode === 'send'}">Send</button><button data-act="owlmode" data-m="wall" aria-pressed="${owlMode === 'wall'}">The wall</button></div>
    <div class="spread ${owlMode === 'send' ? 'm-send' : 'm-wall'}"><section class="pg pg-send">
      ${due ? '<div class="arrival"><span class="owl">🦉</span>An owl landed! Snap your day.</div>' : ''}
      <label class="photo-drop" for="photo"><div class="in">${draft.photo ? `<img src="${draft.photo}" alt="">` : '📷 tap to snap your day'}</div></label>
      <input id="photo" type="file" accept="image/*" capture="environment" hidden>
      <div class="gif-row"><button class="btn small" data-act="gifopen">🎞️ ${draft.gif ? 'Change GIF' : 'Pick a GIF'}</button>
        ${draft.gif ? `<div class="gif-thumb"><img src="${esc(draft.gif)}" alt=""><button data-act="gifclear" aria-label="Remove GIF">✕</button></div>` : '<span class="margin-note">how does today feel?</span>'}</div>
      <div class="moods">${MOODS.map(m => `<button class="mood" aria-pressed="${draft.mood === m}" data-act="mood" data-m="${m}">${m}</button>`).join('')}</div>
      <div class="fld"><textarea id="ptext" placeholder="today was…" maxlength="140">${esc(draft.text)}</textarea></div>
      <div style="text-align:right"><button class="btn alt" data-act="sendping">Send the owl 🦉</button></div>
    </section><section class="pg pg-wall">
      <h2 class="sec-title">The wall</h2>
      ${pings.length ? pingHTML(pings[wallIdx]) : '<div class="empty" style="margin:auto">Nothing pinned yet.</div>'}
      ${pings.length ? `<div class="wallnav"><button data-act="wall" data-n="1" ${wallIdx >= pings.length - 1 ? 'disabled' : ''}>‹</button>${wallIdx + 1} / ${pings.length}<button data-act="wall" data-n="-1" ${wallIdx <= 0 ? 'disabled' : ''}>›</button></div>` : ''}
    </section></div>`;
}

function viewNotes() {
  const me = S().me, her = other(me), N = S().names;
  const inbox = S().notes.filter(n => n.by !== me).sort((a, b) => b.t - a.t);
  if (mailIdx === null) { const u = inbox.findIndex(n => !n.read); mailIdx = u < 0 ? 0 : u; }
  mailIdx = Math.min(mailIdx, Math.max(0, inbox.length - 1));
  const cur = inbox[mailIdx], unread = inbox.filter(n => !n.read).length;
  const letter = n => `${sc(`${n.text ? `<div class="letter-text">${esc(n.text)}</div>` : ''}${n.img ? `<img class="letter-img" src="${n.img}" alt="">` : ''}<div class="by">— ${esc(N[n.by])}, ${new Date(n.t).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</div>`, 'lined', -1.2, 'tc', 'grow letter-in')}`;
  const mail = !cur ? '<div class="empty" style="margin:auto">No notes yet.<br>Write the first one!</div>'
    : !cur.read ? `<div class="env-scene"><div class="margin-note">A note from ${esc(N[cur.by])}!</div>
        <div class="envelope" data-act="nopen"><div class="e-back"></div><div class="e-letter">💌</div><div class="e-front"></div><div class="e-flap"></div><div class="e-seal">🦉</div></div>
        <div class="margin-note">tap to break the seal</div></div>`
    : letter(cur);
  return `
    <div class="mode-switch"><button data-act="notemode" data-m="write" aria-pressed="${notesMode === 'write'}">Write</button><button data-act="notemode" data-m="mail" aria-pressed="${notesMode === 'mail'}">Mailbox${unread ? ` (${unread})` : ''}</button></div>
    <div class="spread ${notesMode === 'write' ? 'm-send' : 'm-wall'}"><section class="pg pg-send">
      <div class="note-to"><span class="margin-note">To: ${esc(N[her])}</span><span class="quick"><button data-act="gm" aria-label="Send good morning">🌅 morning</button><button data-act="gn" aria-label="Send goodnight">🌙 night</button></span>${'Notification' in window && Notification.permission === 'default' ? '<button class="who-switch" data-act="notifyon">🔔 turn on alerts</button>' : ''}</div>
      ${sc(`<textarea class="field" id="ntext" maxlength="160" placeholder="Write something nice (or rude)…">${esc(ndraft.text)}</textarea>`, 'lined', -.6, 'tl', '')}
      <div class="sc grow" style="--r:.5deg"><span class="tape tr blue"></span><div class="scrap cream padwrap"><canvas id="pad" aria-label="Drawing pad"></canvas></div></div>
      <div class="pen-row">${INKS.map(c => `<button class="ink ${c === pen ? 'on' : ''}" data-act="ncolor" data-c="${c}" style="background:${c}" aria-label="Ink ${c}"></button>`).join('')}<span class="grow"></span><button class="who-switch" data-act="nundo">↶ undo</button><button class="who-switch" data-act="nclear">clear</button></div>
      <div style="text-align:right"><button class="btn alt" data-act="nsend">Send by owl 🦉</button></div>
    </section><section class="pg pg-wall">
      <h2 class="sec-title">Mailbox</h2>
      ${mail}
      ${inbox.length > 1 ? `<div class="wallnav"><button data-act="mnav" data-n="1" ${mailIdx >= inbox.length - 1 ? 'disabled' : ''}>‹</button>${mailIdx + 1} / ${inbox.length}<button data-act="mnav" data-n="-1" ${mailIdx <= 0 ? 'disabled' : ''}>›</button></div>` : ''}
    </section></div>`;
}

function viewWord() {
  const k = dkey(new Date()), day = store.day(k), me = S().me, her = other(me), N = S().names;
  const mine = day[me].bible || { done: false, passage: '' };
  const week = w => Array.from({ length: 7 }, (_, i) => { const d = addDays(new Date(), i - 6), done = S().days[dkey(d)]?.[w].bible?.done; return `<i class="cd ${done ? 'on' : ''} ${i === 6 ? 'today' : ''}"></i>`; }).join('');
  const row = w => `<div class="streak-row"><div class="nm" style="color:var(--${w === me ? 'me' : 'her'})">${esc(N[w])}</div><div class="n">${streak(w)}</div><div class="candles">${week(w)}</div></div>`;
  return `
    <span class="date-big">Daily Word</span><div class="kicker">${pretty(new Date(), true)} · Bible-based, KJV</div>
    ${sc(`<div class="kicker">Verse of the day</div><div class="verse-text">“${esc(verseOf(new Date()).t)}”</div><div class="verse-ref">— ${esc(verseOf(new Date()).r)}</div>`, 'cream', -.8, 'tl')}
    ${sc(`<label class="small">Today's passage</label><input class="field" id="passage" value="${esc(mine.passage)}" placeholder="e.g. ${esc(verseOf(new Date()).r)}"><button class="chk" data-act="bible" style="margin-top:.6rem"><span class="box">${mine.done ? '✓' : ''}</span>I read it today</button>`, 'lined', -1, 'tc')}
    ${sc(`${row(me)}${row(her)}<div class="note-line center">${day[her].bible?.done ? `${esc(N[her])} read <i>${esc(day[her].bible.passage || 'something good')}</i> ✓` : `${esc(N[her])} hasn't yet. Send a gentle owl.`}</div>`, 'cream', .8, 'tr red')}`;
}

/* ---------- sheets (modal) ---------- */
let evForm = null, gp = { q: '', page: 0, res: [], state: 'idle' };
function openSheet(html) { const p = $('#picker'); p.innerHTML = `<div class="sheet">${html}</div>`; p.classList.add('open'); }
function closeSheet() { const p = $('#picker'); p.classList.remove('open'); p.innerHTML = ''; if (pendingRender) setTimeout(scheduleRender, 60); }

function eventFormHTML() {
  const f = evForm;
  return sc(`<div class="pk-head"><span>${f.id ? 'Edit' : 'New'} busy block</span><button data-act="close" aria-label="Close">✕</button></div>
    <label class="small">What is it?</label><input class="field" id="evt" maxlength="40" value="${esc(f.title)}" placeholder="Class, work, nap…">
    <div class="time-row"><label class="small">From<input type="time" id="evs" value="${hhmm(f.s)}" step="900"></label><label class="small">To<input type="time" id="eve" value="${hhmm(f.e)}" step="900"></label></div>
    <div class="kind-row"><button class="btn small ${f.kind === 'busy' ? 'alt' : 'ghost'}" data-act="evkind" data-k="busy">Busy</button><button class="btn small ${f.kind === 'maybe' ? 'alt' : 'ghost'}" data-act="evkind" data-k="maybe">Maybe</button></div>
    ${repeatRowHTML(f)}<label class="small">Details (they can read this)</label><textarea class="field box" id="evd" maxlength="160" placeholder="Where, who, how annoyed…">${esc(f.desc)}</textarea>
    <div class="row" style="justify-content:space-between">${f.id ? '<button class="who-switch" data-act="evdel">delete</button>' : '<span></span>'}<button class="btn alt" data-act="evsave">Save</button></div>`, 'cream', 0, 'tc');
}
function eventDetailHTML(ev) {
  const mine = ev.who === S().me;
  return sc(`<div class="pk-head"><span>${esc(ev.title)}</span><button data-act="close" aria-label="Close">✕</button></div>
    <div class="margin-note">${tmin(ev.s)} – ${tmin(ev.e)} · ${ev.kind === 'maybe' ? 'maybe' : 'busy'} · ${esc(S().names[ev.who])}${ev._rep ? ' · repeats ' + repText(ev) + (ev.until ? ' until ' + keyDate(ev.until).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '') : ''}</div>
    <div class="ev-desc">${ev.desc ? esc(ev.desc) : '<i>No details.</i>'}</div>
    ${mine ? `<div class="row" style="justify-content:space-between">${ev._rep ? `<span><button class="who-switch" data-act="evskip" data-id="${ev.id}" data-k="${ev.day}">skip this day</button> <button class="who-switch" data-act="evdel" data-id="${ev.id}">delete all</button></span>` : `<button class="who-switch" data-act="evdel" data-id="${ev.id}">delete</button>`}<button class="btn small" data-act="evedit" data-id="${ev.id}">Edit</button></div>` : ''}`, 'lined', 0, 'tc');
}

function gifPickerHTML() {
  return sc(`<div class="pk-head"><span>Pick a GIF</span><button data-act="close" aria-label="Close">✕</button></div>
    <div class="pk-search"><input id="gq" placeholder="search GIFs…" value="${esc(gp.q)}"><button class="btn small" data-act="gifsearch">Go</button></div>
    <div class="pk-quick">${QUICK_GIFS.map(q => `<button data-act="gifq" data-q="${q}">${q}</button>`).join('')}</div>
    <div class="pk-grid" id="gg"></div>
    <div class="pk-foot"><button data-act="gifprev" id="gprev">‹</button><span>page ${gp.page + 1}</span><button data-act="gifnext" id="gnext">›</button></div>
    <div class="pk-credit">Powered by GIPHY</div>`, 'cream', 0, 'tc');
}
function paintGifs() {
  const g = $('#gg'); if (!g) return;
  if (gp.state === 'nokey') g.innerHTML = '<div class="pk-msg">Sign in to search GIFs.</div>';
  else if (gp.state === 'nofn') g.innerHTML = '<div class="pk-msg">GIF search isn\'t switched on yet. It needs the GIF function deployed in Supabase.</div>';
  else if (gp.state === 'loading') g.innerHTML = '<div class="pk-msg">fetching owls…</div>';
  else if (gp.state === 'err') g.innerHTML = '<div class="pk-msg">The GIF owls got lost. Try again?</div>';
  else if (!gp.res.length) g.innerHTML = '<div class="pk-msg">Nothing found. Try another word.</div>';
  else g.innerHTML = gp.res.map((r, i) => `<button style="--r:${[-2, 1.5, -1, 2, -1.5, 1][i % 6]}deg" data-act="gifpick" data-u="${esc(r.url)}"><img src="${esc(r.thumb)}" alt="${esc(r.title)}"></button>`).join('');
  const pv = $('#gprev'), nx = $('#gnext'); if (pv) pv.disabled = gp.page === 0; if (nx) nx.disabled = gp.res.length < 6;
}
// URL name ("slug") of the GIF function in Supabase. Supabase picked this one itself when the function was created;
// renaming it in the dashboard only changes its label, not this address.
const GIF_FN = 'dynamic-endpoint';
async function gifLoad() {
  // The Giphy key is NOT in this app. Searches go to the "giphy" Supabase function, which holds the key and only answers signed-in members.
  if (!SYNC.on) { gp.state = 'nokey'; return paintGifs(); }
  gp.state = 'loading'; paintGifs();
  try {
    const { data, error } = await sb.functions.invoke(GIF_FN, { body: { q: gp.q, offset: gp.page * 6, limit: 6 } });
    if (error) { gp.state = error.context?.status === 404 ? 'nofn' : 'err'; return paintGifs(); }
    gp.res = Array.isArray(data?.results) ? data.results : [];
    gp.state = 'ok';
  } catch { gp.state = 'err'; }
  paintGifs();
}

/* ---------- drawing pad ---------- */
function padInit() {
  const c = $('#pad'); if (!c) return;
  const r = c.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  c.width = Math.max(10, (r.width - 2) * dpr); c.height = Math.max(10, (r.height - 2) * dpr); padRedraw();
}
function padRedraw(target) {
  const c = target || $('#pad'); if (!c) return; const x = c.getContext('2d');
  x.clearRect(0, 0, c.width, c.height); x.lineCap = 'round'; x.lineJoin = 'round';
  const w = Math.max(2, c.width / 120);
  for (const s of strokes) { x.strokeStyle = s.c; x.lineWidth = w; x.beginPath(); s.p.forEach(([px, py], i) => i ? x.lineTo(px * c.width, py * c.height) : x.moveTo(px * c.width, py * c.height)); if (s.p.length === 1) x.lineTo(s.p[0][0] * c.width + .1, s.p[0][1] * c.height); x.stroke(); }
}
const padPt = e => { const r = e.target.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
document.addEventListener('pointerdown', e => { if (e.target.id !== 'pad') return; e.preventDefault(); e.target.setPointerCapture(e.pointerId); curStroke = { c: pen, p: [padPt(e)] }; strokes.push(curStroke); padRedraw(); });
document.addEventListener('pointermove', e => { if (!curStroke || e.target.id !== 'pad') return; curStroke.p.push(padPt(e)); padRedraw(); SFX.scratch(); });
['pointerup', 'pointercancel'].forEach(t => document.addEventListener(t, () => { curStroke = null; }));
function padExport() {
  if (!strokes.length) return '';
  const o = document.createElement('canvas'), live = $('#pad'), ratio = live ? live.height / live.width : .75;
  o.width = 520; o.height = Math.round(520 * ratio); padRedraw(o); return o.toDataURL('image/png');
}

/* ---------- animations + notifications ---------- */
// flying owl: round body, fanned tail, ear tufts and feathered wings (reads as an owl, not a bat)
const owlSVG = `<svg viewBox="0 0 100 66" width="72" height="48"><g class="wing wl"><path d="M45 27 C34 8 14 4 1 16 C9 17 14 21 12 30 C17 26 22 27 24 33 C30 28 38 31 46 38Z"/></g><g class="wing wr"><path d="M55 27 C66 8 86 4 99 16 C91 17 86 21 88 30 C83 26 78 27 76 33 C70 28 62 31 54 38Z"/></g><path d="M43 52 L50 65 L57 52Z"/><ellipse cx="50" cy="38" rx="11.5" ry="17"/><circle cx="50" cy="20" r="10.5"/><path d="M40 12 L42 22 L48 12Z M60 12 L58 22 L52 12Z"/><circle cx="45.5" cy="20" r="3.4" fill="#fff3c4"/><circle cx="54.5" cy="20" r="3.4" fill="#fff3c4"/><circle cx="45.5" cy="20" r="1.5" fill="#1d1a2b"/><circle cx="54.5" cy="20" r="1.5" fill="#1d1a2b"/><path d="M48.5 25 L51.5 25 L50 29Z" fill="#c9983a"/></svg>`;
// perched, front-facing owl for the cover emblem (same owl as the app icon)
const owlPerch = `<svg viewBox="-90 -115 180 225" aria-hidden="true"><path d="M-70 -70 L-52 -105 L-25 -78 Q0 -90 25 -78 L52 -105 L70 -70 Q86 -10 60 50 Q30 100 0 100 Q-30 100 -60 50 Q-86 -10 -70 -70Z"/><circle cx="-30" cy="-25" r="26" fill="#5a1220"/><circle cx="30" cy="-25" r="26" fill="#5a1220"/><circle cx="-30" cy="-25" r="11" fill="#f6dc8a"/><circle cx="30" cy="-25" r="11" fill="#f6dc8a"/><circle cx="-30" cy="-25" r="5" fill="#2a0a10"/><circle cx="30" cy="-25" r="5" fill="#2a0a10"/><path d="M-9 5 L9 5 L0 28Z" fill="#8a5f1c"/><path d="M-34 40 Q0 62 34 40 M-30 62 Q0 82 30 62" stroke="#8a5f1c" stroke-width="6" fill="none" stroke-linecap="round"/></svg>`;
function sendAnim(emoji = '💌', snd = 'owl') {
  SFX.play(snd);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const el = document.createElement('div'); el.className = 'carry'; el.innerHTML = `<div class="flyer-in">${owlSVG}<span class="env">${emoji}</span></div>`;
  document.body.appendChild(el);
  el.animate([{ transform: 'translate(-30vw, 40vh) scale(.7) rotate(-10deg)', opacity: 0 }, { transform: 'translate(0, 0) scale(1.5) rotate(0)', opacity: 1, offset: .35 }, { transform: 'translate(10vw, -4vh) scale(1.6) rotate(4deg)', opacity: 1, offset: .55 }, { transform: 'translate(60vw, -60vh) scale(.5) rotate(18deg)', opacity: 0 }], { duration: 2400, easing: 'ease-in-out' }).onfinish = () => el.remove();
}
function notify(title, body) {
  try { if ('Notification' in window && Notification.permission === 'granted') navigator.serviceWorker?.ready.then(r => r.showNotification(title, { body, icon: 'icon.svg', badge: 'icon.svg', tag: 'owlery-note' })); } catch { /* ignore */ }
}
function banner(text, go) {
  const b = $('#banner'); b.innerHTML = `<span class="b-env">💌</span>${esc(text)}`; b.dataset.go = go || ''; b.classList.add('show');
  clearTimeout(banner.t); banner.t = setTimeout(() => b.classList.remove('show'), 5200);
}
function incoming(n) { S().notes.push(n); store.save(); arrive(n); } // demo-only helper
function arrive(n) { // a note from the other person just landed: chime, banner, system notification
  SFX.play('chime');
  const who = S().names[n.by];
  const gm = n.kind === 'gm', gn = n.kind === 'gn';
  notify(gm ? `☀️ Good morning from ${who}` : gn ? `🌙 Goodnight from ${who}` : `💌 Note from ${who}`, n.text || 'They drew you something!');
  banner(gm ? `Good morning from ${who}!` : gn ? `Goodnight from ${who}!` : `New note from ${who}!`, 'notes'); mailIdx = null; scheduleRender();
}
const doodle = (c, d) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 150'><path d='${d}' fill='none' stroke='${c}' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/></svg>`);

/* ---------- long distance: countdown, right-now status, one-tap good morning / goodnight ---------- */
function visitDays() { const v = S().visit; if (!v?.date) return null; const n = Math.round((keyDate(v.date) - keyDate(dkey(new Date()))) / 864e5); return n >= 0 ? n : null; }
function visitTicket() {
  const n = visitDays(), v = S().visit;
  const inner = n === null ? '<span class="tk-big">✈️</span><span class="tk-sm">set next visit</span>'
    : n === 0 ? '<span class="tk-big">TODAY!</span><span class="tk-sm">together at last</span>'
    : `<span class="tk-big">${n}</span><span class="tk-sm">day${n === 1 ? '' : 's'} till ${esc((v.label || 'we meet').slice(0, 14))}</span>`;
  return `<button class="ticket-btn" data-act="visitedit" aria-label="Next visit countdown">${sc(inner, 'ticket', 2.5)}</button>`;
}
function visitFormHTML() {
  const v = S().visit || {};
  return sc(`<div class="pk-head"><span>Next visit</span><button data-act="close" aria-label="Close">✕</button></div>
    <label class="small">When do you see each other?</label><input type="date" id="vdate" class="field" value="${esc(v.date || '')}" min="${dkey(new Date())}">
    <label class="small">What's it called? (optional)</label><input id="vlabel" class="field" maxlength="24" placeholder="e.g. Thanksgiving" value="${esc(v.label || '')}">
    <div class="row" style="justify-content:space-between"><button class="who-switch" data-act="visitclear">clear</button><button class="btn alt" data-act="visitsave">Save</button></div>`, 'cream', 0, 'tc');
}
function statusOf(w) { // what each of you is in the middle of, right now
  const now = nowMin(), list = eventsOf(dkey(new Date()), w).sort((a, b) => a.s - b.s), cur = list.find(e => e.s <= now && now < e.e);
  if (cur) return `${cur.title} · till ${tmin(cur.e)}`;
  if (now >= 23 * 60 || now < DAY0) return '💤 asleep?';
  const nxt = list.find(e => e.s > now);
  return nxt ? `free till ${tmin(nxt.s)}` : 'free now';
}
const GM = ['Good morning! "This is the day which the LORD hath made." (Ps 118:24)', 'Good morning. His mercies are new every morning. (Lam 3:23)', 'Good morning! Praying for you today. Eat something that is not cereal.', 'Good morning. Thankful for you, and thankful to God for you. (Phil 1:3)'];
const GN = ['Goodnight. "I will both lay me down in peace, and sleep." (Ps 4:8)', 'Goodnight. The LORD watch between me and thee. (Gen 31:49)', 'Goodnight! Praying for you tonight. Sleep well, little owl.', 'Off to bed. Miss you. God has you, and so do I.'];
const SUN = 'M122 75 A22 22 0 1 1 78 75 A22 22 0 1 1 122 75 M100 43 V23 M100 107 V127 M68 75 H48 M132 75 H152 M123 98 L137 112 M77 98 L63 112 M123 52 L137 38 M77 52 L63 38';
const MOON = 'M118 28 A48 48 0 1 0 156 108 A38 38 0 1 1 118 28 Z M50 40 V56 M42 48 H58 M165 30 V42 M159 36 H171';
function sendQuick(kind) {
  const gm = kind === 'gm', list = gm ? GM : GN, text = list[Math.floor(Math.random() * list.length)];
  S().notes.push({ id: newId(), by: S().me, t: Date.now(), text, img: doodle(gm ? '#b8892b' : '#1f4b6e', gm ? SUN : MOON), read: false, kind });
  store.save(); sendAnim(gm ? '☀️' : '🌙', gm ? 'morning' : 'night'); toast(gm ? 'Good morning, delivered ☀️' : 'Goodnight, delivered 🌙'); render();
}
setInterval(() => { document.querySelectorAll('[data-st]').forEach(el => { el.textContent = statusOf(el.dataset.st); }); document.querySelectorAll('[data-mw]').forEach(el => { el.textContent = moodWhen(el.dataset.mw); }); }, 60000);

function syncForm() { evForm.title = $('#evt').value; evForm.desc = $('#evd').value; evForm.s = parseHM($('#evs').value); evForm.e = parseHM($('#eve').value); if ($('#evu')) evForm.until = $('#evu').value; }
function repeatRowHTML(f) {
  const rep = f.rep || 'none', days = f.days || [], base = f.id ? f.day : dkey(viewDate);
  const endIn = n => dkey(addDays(keyDate(base), 7 * n - 1)); // "4 weeks" = the 4th week's last day
  const until = rep === 'none' ? '' : `<label class="small">Stops repeating</label><div class="kind-row">${[[0, 'Never'], [4, '4 weeks'], [8, '8 weeks'], [16, '16 weeks']].map(([n, l]) => `<button class="btn small ${(n === 0 ? !f.until : f.until === endIn(n)) ? 'alt' : 'ghost'}" data-act="evuntil" data-n="${n}">${l}</button>`).join('')}</div>
    <label class="small">or pick the last day <input type="date" class="field" id="evu" value="${esc(f.until || '')}" min="${esc(base)}"></label>`;
  return `<label class="small">Repeats</label><div class="kind-row">${[['none', 'Once'], ['daily', 'Every day'], ['weekly', 'Weekly']].map(([r, l]) => `<button class="btn small ${rep === r ? 'alt' : 'ghost'}" data-act="evrep" data-r="${r}">${l}</button>`).join('')}</div>`
    + (rep === 'weekly' ? `<div class="wd-row">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => `<button class="wd ${days.includes((i + 1) % 7) ? 'on' : ''}" data-act="evwd" data-i="${(i + 1) % 7}" aria-label="${WD[(i + 1) % 7]}">${l}</button>`).join('')}</div>` : '') + until;
}

/* ---------- events ---------- */
const flipTo = (to, dir, fn) => flip(dir || (tabIdx(to) - tabIdx(tab)) || 1, fn);
function flip(dir, fn) {
  const el = $('#view'); SFX.play('flip');
  if (!S().me || !el.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return fn();
  document.querySelectorAll('.leaf').forEach(n => n.remove());
  const r = el.getBoundingClientRect(), leaf = document.createElement('div');
  leaf.className = 'leaf';
  // ring-notebook flip: the page hinges on the rings along the top edge.
  // Forward: the old page lifts toward you and flips up over the rings. Back: the page drops down onto the rings again.
  Object.assign(leaf.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', transformOrigin: 'center top' });
  const build = () => { // the sheet that swings: a copy of the page on its front, ruled paper on its back
    const front = document.createElement('div'); front.className = 'face front';
    const c = el.cloneNode(true); c.querySelectorAll('[id]').forEach(n => n.removeAttribute('id')); front.appendChild(c);
    const back = document.createElement('div'); back.className = 'face back';
    leaf.append(front, back); document.body.appendChild(leaf);
  };
  const P = 'perspective(2600px) rotateX(';
  if (dir > 0) { build(); fn(); landed(); } else { fn(); build(); } // forward copies the OLD page first; back copies the NEW page after it renders
  const frames = dir > 0
    ? [{ transform: P + '0deg)', filter: 'brightness(1)' }, { transform: P + '75deg)', filter: 'brightness(.82)', offset: .45 }, { transform: P + '178deg)', filter: 'brightness(.96)' }]
    : [{ transform: P + '178deg)', filter: 'brightness(.96)' }, { transform: P + '75deg)', filter: 'brightness(.82)', offset: .55 }, { transform: P + '0deg)', filter: 'brightness(1)' }];
  leaf.animate(frames, { duration: 760, easing: 'cubic-bezier(.45,.05,.25,1)', fill: 'both' }).onfinish = () => leaf.remove();
}
function placeRings() { // metal rings along the top edge of the page, with punched holes (they stay put while pages flip)
  let g = $('#rings'); if (!g) { g = document.createElement('div'); g.id = 'rings'; g.setAttribute('aria-hidden', 'true'); document.body.appendChild(g); }
  const v = $('#view').getBoundingClientRect(); if (!v.width) return;
  let left = v.left + 14; const tabs = $('#tabs'); // on desktop the ribbon tabs hang over the left of the top edge, so the rings start after them
  if (innerWidth >= 900 && tabs?.lastElementChild) left = Math.max(left, tabs.lastElementChild.getBoundingClientRect().right + 26);
  Object.assign(g.style, { left: left + 'px', width: Math.max(0, v.right - 14 - left) + 'px', top: (v.top - 13) + 'px' });
  for (const [i, up] of [[1, 6], [2, 11]]) { // the pages you've already flipped stay visible as sheet edges behind the rings
    let s = $('#sheet' + i); if (!s) { s = document.createElement('i'); s.id = 'sheet' + i; s.className = 'sheet-behind'; s.setAttribute('aria-hidden', 'true'); document.body.appendChild(s); }
    Object.assign(s.style, { left: (v.left + i * 4) + 'px', top: (v.top - up) + 'px', width: Math.max(0, v.width - i * 8) + 'px', height: v.height + 'px' });
  }
}
function landed() { // a flipped page settles behind the rings: the stack bumps up a little
  [$('#sheet1'), $('#sheet2')].forEach((s, i) => s?.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${-5 - i * 2}px)` }, { transform: 'translateY(0)' }], { duration: 380, delay: 500 + i * 70, easing: 'ease-out' }));
}
const tabIdx = id => TABS.findIndex(t => t[0] === id);
const go = to => { if (to === tab) return; flip(tabIdx(to) - tabIdx(tab), () => { tab = to; if (tab !== 'sched' && tab !== 'plans') viewDate = new Date(); render(); }); };

document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]'); if (g) return go(g.dataset.go);
  const t = e.target.closest('[data-tab]'); if (t) return go(t.dataset.tab);
  if (e.target.closest('#banner')) { $('#banner').classList.remove('show'); notesMode = 'mail'; return go('notes'); }
  if (e.target.id === 'picker') return closeSheet();
  const a = e.target.closest('[data-act]'); if (!a) return;
  const d = a.dataset, me = S().me, k = dkey(viewDate);
  SFX.act(d.act);
  switch (d.act) {
    case 'sfx': SFX.toggle(); break;
    case 'login': doLogin(); return;
    case 'whoami': openSheet(whoamiHTML()); return;
    case 'signout': signOut(); return;
    case 'retry': boot(); return;
    case 'visitedit': openSheet(visitFormHTML()); return;
    case 'visitsave': { const date = $('#vdate').value; S().visit = date ? { date, label: $('#vlabel').value.trim() } : null; closeSheet(); toast(date ? 'Counting the days ✈️' : 'Cleared'); break; }
    case 'visitclear': S().visit = null; closeSheet(); break;
    case 'gm': case 'gn': sendQuick(d.act); return;
    case 'iam': { const na = $('#nameA').value.trim(), nb = $('#nameB').value.trim(); if (na) S().names.a = na; if (nb) S().names.b = nb; S().me = d.w; seedDemo(); break; }
    case 'switchwho': S().me = other(me); mailIdx = null; toast(`Now writing as ${S().names[S().me]}`); break;
    case 'day': return store.save(), flip(+d.n, () => { viewDate = addDays(viewDate, +d.n); render(); });
    case 'dtoday': viewDate = new Date(); break;
    case 'planmode': planMode = d.m; if (d.m === 'week') weekStart = mondayOf(viewDate); break;
    case 'wk': return store.save(), flip(+d.n, () => { weekStart = addDays(weekStart, 7 * +d.n); render(); });
    case 'wkopen': return flip(1, () => { viewDate = keyDate(d.k); planMode = 'day'; render(); });
    case 'wkset': { const day = store.day(d.k); day.type = day.type === d.id ? '' : d.id; break; }
    case 'lockin': toast('Lock In link coming soon'); return;
    case 'type': { const day = store.day(k); day.type = day.type === d.id ? '' : d.id; break; }
    case 'vote': { const v = store.day(k).dinner.votes; v[me] = v[me] === d.m ? '' : d.m; break; }
    case 'addmeal': { const m = $('#newMeal').value.trim(); if (m && !S().meals.includes(m)) S().meals.push(m); break; }
    case 'hat': {
      const day = store.day(k), v = day.dinner.votes, voted = [...new Set([v.a, v.b].filter(Boolean))], pool = voted.length ? voted : S().meals;
      if (!pool.length) return; v.a = v.b = ''; day.dinner.chosen = pool[Math.floor(Math.random() * pool.length)]; toast(`The Hat has spoken: ${day.dinner.chosen}`); break;
    }
    case 'owlmode': owlMode = d.m; break;
    case 'wall': wallIdx = Math.max(0, wallIdx + +d.n); break;
    case 'mood': draft.mood = draft.mood === d.m ? '' : d.m; draft.text = $('#ptext')?.value || draft.text; break;
    case 'moodset': mf = { mood: latestPing(me)?.mood || '', gif: '', text: '' }; gifTarget = 'owl'; openSheet(moodFormHTML()); return;
    case 'mfmood': mf.text = $('#mtext')?.value ?? mf.text; mf.mood = mf.mood === d.m ? '' : d.m; openSheet(moodFormHTML()); return;
    case 'mfgifclear': mf.text = $('#mtext')?.value ?? mf.text; mf.gif = ''; openSheet(moodFormHTML()); return;
    case 'mfgif': mf.text = $('#mtext')?.value ?? mf.text; gifTarget = 'mood'; gp = { q: '', page: 0, res: [], state: 'idle' }; openSheet(gifPickerHTML()); gifLoad(); return;
    case 'mfsave': {
      const text = ($('#mtext')?.value ?? mf.text).trim();
      if (!mf.mood && !mf.gif && !text) return toast('Pick a mood first!', true);
      S().pings.unshift({ id: newId(), by: me, t: Date.now(), mood: mf.mood, gif: mf.gif, text, photo: '' });
      closeSheet(); toast(`Mood updated. ${S().names[other(me)]} can see it now.`); break;
    }
    case 'gifopen': gifTarget = 'owl'; draft.text = $('#ptext')?.value || draft.text; gp = { q: '', page: 0, res: [], state: 'idle' }; openSheet(gifPickerHTML()); gifLoad(); return;
    case 'gifclear': draft.gif = ''; break;
    case 'gifq': gp.q = d.q; gp.page = 0; $('#gq').value = d.q; gifLoad(); return;
    case 'gifsearch': gp.q = $('#gq').value.trim(); gp.page = 0; gifLoad(); return;
    case 'gifnext': gp.page++; gifLoad(); return;
    case 'gifprev': gp.page = Math.max(0, gp.page - 1); gifLoad(); return;
    case 'gifpick': if (gifTarget === 'mood') { mf.gif = d.u; gifTarget = 'owl'; openSheet(moodFormHTML()); return; } draft.gif = d.u; closeSheet(); break;
    case 'sendping': {
      draft.text = $('#ptext').value.trim();
      if (!draft.photo && !draft.gif && !draft.text && !draft.mood) return toast('The owl needs something to carry!', true);
      S().pings.unshift({ id: newId(), by: me, t: Date.now(), ...draft }); S().lastPingDay = dkey(new Date());
      draft = { photo: '', mood: '', gif: '', text: '' }; wallIdx = 0; sendAnim(); toast('Off it flies!'); break;
    }
    case 'bible': {
      const day = store.day(dkey(new Date())), b = day[me].bible || { done: false, passage: '' };
      b.passage = $('#passage')?.value.trim() || b.passage; b.done = !b.done; day[me].bible = b; if (b.done) { SFX.play('sealed'); toast('Sealed ✝'); } break;
    }
    /* hours */
    case 'lane': {
      if (e.target.closest('.blk')) return;
      const r = a.getBoundingClientRect(), m = Math.round((DAY0 + ((e.clientY - r.top) / r.height) * SPAN) / 30) * 30;
      evForm = { id: '', title: '', s: Math.min(m, DAY1 - 60), e: Math.min(m + 60, DAY1), kind: 'busy', desc: '', rep: 'none', days: [], until: '' }; openSheet(eventFormHTML()); return;
    }
    case 'evnew': { const m = Math.max(DAY0, Math.min(Math.ceil(nowMin() / 30) * 30, DAY1 - 60)); evForm = { id: '', title: '', s: m, e: m + 60, kind: 'busy', desc: '', rep: 'none', days: [], until: '' }; openSheet(eventFormHTML()); return; }
    case 'ev': { const ev = S().events.find(x => x.id === d.id); if (ev) openSheet(eventDetailHTML({ ...ev, day: k, _rep: (ev.rep || 'none') !== 'none' })); return; }
    case 'evskip': { const ev = S().events.find(x => x.id === d.id); if (ev) (ev.skip ||= []).push(d.k); closeSheet(); break; }
    case 'schedmode': schedMode = d.m; if (d.m === 'week') hWeekStart = mondayOf(viewDate); break;
    case 'wkh': return store.save(), flip(+d.n, () => { hWeekStart = addDays(hWeekStart, 7 * +d.n); render(); });
    case 'wkhopen': return flip(1, () => { viewDate = keyDate(d.k); schedMode = 'day'; render(); });
    case 'evedit': { const ev = S().events.find(x => x.id === d.id); if (ev) { evForm = { ...ev }; openSheet(eventFormHTML()); } return; }
    case 'evkind': case 'evrep': case 'evwd': case 'evuntil': {
      syncForm();
      if (d.act === 'evuntil') { const base = evForm.id ? evForm.day : k; evForm.until = d.n === '0' ? '' : dkey(addDays(keyDate(base), 7 * +d.n - 1)); }
      if (d.act === 'evkind') evForm.kind = d.k;
      if (d.act === 'evrep') { evForm.rep = d.r; if (d.r === 'weekly' && !(evForm.days || []).length) evForm.days = [keyDate(k).getDay()]; }
      if (d.act === 'evwd') { const i = +d.i, ds = new Set(evForm.days || []); ds.has(i) ? ds.delete(i) : ds.add(i); evForm.days = [...ds]; }
      openSheet(eventFormHTML()); return;
    }
    case 'evsave': {
      const title = $('#evt').value.trim(), s = parseHM($('#evs').value), en = parseHM($('#eve').value);
      if (!title) return toast('Give it a name!', true);
      if (en <= s) return toast('It has to end after it starts.', true);
      { const u = $('#evu')?.value, startDay = evForm.id ? evForm.day : k; if (evForm.rep !== 'none' && u && u < startDay) return toast('The last day has to be after the first day.', true); }
      const ev = { id: evForm.id || `e${Date.now()}${Math.floor(rnd(0, 999))}`, who: me, day: k, s, e: en, title, desc: $('#evd').value.trim(), kind: evForm.kind, rep: evForm.rep || 'none', until: (evForm.rep && evForm.rep !== 'none') ? ($('#evu')?.value || evForm.until || '') : '', days: evForm.rep === 'weekly' ? (evForm.days?.length ? evForm.days : [keyDate(k).getDay()]) : [] };
      const i = S().events.findIndex(x => x.id === ev.id); if (i >= 0) S().events[i] = { ...S().events[i], ...ev, who: S().events[i].who, day: S().events[i].day }; else S().events.push(ev);
      closeSheet(); toast('Pinned to the hours'); break;
    }
    case 'evdel': { const id = d.id || evForm?.id; S().events = S().events.filter(x => x.id !== id); closeSheet(); break; }
    case 'close': closeSheet(); return;
    /* notes */
    case 'notemode': notesMode = d.m; if (d.m === 'write') ndraft.text = $('#ntext')?.value ?? ndraft.text; break;
    case 'ncolor': pen = d.c; ndraft.text = $('#ntext')?.value ?? ndraft.text; break;
    case 'nundo': strokes.pop(); padRedraw(); return;
    case 'nclear': strokes = []; padRedraw(); return;
    case 'notifyon': Notification.requestPermission().then(p => { toast(p === 'granted' ? 'Alerts on. The owls can find you.' : 'No alerts. The owls will knock politely.'); render(); }); return;
    case 'nsend': {
      const text = ($('#ntext')?.value || '').trim(), img = padExport();
      if (!text && !img) return toast('A blank note? Bold. Write or draw something.', true);
      S().notes.push({ id: newId(), by: me, t: Date.now(), text, img, read: false });
      ndraft.text = ''; strokes = []; sendAnim(); toast('Delivered by owl 🦉'); store.save(); render();
      if (CFG.DEMO && !SYNC.wanted) setTimeout(() => incoming({ id: Date.now(), by: other(me), t: Date.now(), read: false, text: 'Got it! Owl was suspiciously fast.', img: doodle(me === 'a' ? '#1f4b6e' : '#7a1f2b', 'M100 120 C20 70 40 20 100 55 C160 20 180 70 100 120Z') }), 7000);
      return;
    }
    case 'nopen': {
      if (a.classList.contains('open')) return; a.classList.add('open');
      setTimeout(() => { const inbox = S().notes.filter(n => n.by !== me).sort((x, y) => y.t - x.t); if (inbox[mailIdx]) inbox[mailIdx].read = true; store.save(); render(); }, 1500); return;
    }
    case 'mnav': mailIdx += +d.n; break;
  }
  store.save(); render();
});
document.addEventListener('change', e => {
  if (e.target.id === 'photo' && e.target.files[0]) {
    const img = new Image(), url = URL.createObjectURL(e.target.files[0]);
    img.onload = () => { const r = Math.min(1, 720 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = img.width * r; c.height = img.height * r; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); draft.photo = c.toDataURL('image/jpeg', .72); URL.revokeObjectURL(url); draft.text = $('#ptext')?.value || draft.text; render(); };
    img.src = url;
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'ptext') draft.text = e.target.value;
  if (e.target.id === 'ntext') ndraft.text = e.target.value;
  if (e.target.id === 'dnote') { store.day(dkey(viewDate)).note = e.target.value; store.save(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.target.id === 'lpass' || e.target.id === 'lemail')) doLogin(); if (e.key === 'Enter' && e.target.id === 'gq') { gp.q = e.target.value.trim(); gp.page = 0; gifLoad(); } if (e.key === 'Escape') closeSheet(); });
window.addEventListener('resize', () => { if (tab === 'notes' && notesMode === 'write') padInit(); placeRings(); });
if (window.ResizeObserver) new ResizeObserver(() => placeRings()).observe(document.querySelector('#view'));

/* demo data so the first run isn't empty; goes away once real sync exists */
function seedDemo() {
  if (S().seeded) return; S().seeded = true;
  const me = S().me, her = other(me), k = dkey(new Date());
  const ev = (who, s, e, title, desc, kind = 'busy') => S().events.push({ id: `d${who}${s}`, who, day: k, s: s * 60, e: e * 60, title, desc, kind });
  ev(her, 9, 10.5, 'Chem lab', 'Bringing goggles. Building 4, room 210. Phone off.'); ev(her, 13, 14, 'Work shift', 'Front desk. Slow day, so texting is allowed.'); ev(her, 15, 16, 'Gym?', 'Only if I feel brave.', 'maybe');
  ev(me, 9, 11, 'Class', 'Lecture, then notes. Not skipping.'); ev(me, 12, 13, 'Study group', 'Library, 2nd floor.');
  S().events.forEach(e => { if (e.title === 'Class') { e.rep = 'weekly'; e.days = [1, 3, 5]; } if (e.title === 'Chem lab') { e.rep = 'weekly'; e.days = [2, 4, 5]; } if (e.title === 'Study group') e.rep = 'daily'; });
  S().plate[me] = { total: 6, done: 2 }; S().plate[her] = { total: 4, done: 3 };
  S().notes.push({ id: Date.now(), by: her, t: Date.now() - 36e5, read: false, text: 'Eat something that is not cereal today 🦉', img: doodle(her === 'a' ? '#7a1f2b' : '#1f4b6e', 'M30 110 Q60 20 100 80 T170 40 M150 25 L172 40 L148 55') });
}

/* ---------- ambient background ---------- */
function ambient() {
  const sky = document.createElement('div'); sky.id = 'sky'; sky.setAttribute('aria-hidden', 'true');
  let h = '';
  for (let i = 0; i < 55; i++) h += `<i class="star" style="left:${rnd(0, 100)}%;top:${rnd(0, 100)}%;animation-delay:${rnd(0, 5)}s;animation-duration:${rnd(2.5, 6)}s;--s:${rnd(.6, 1.6)}"></i>`;
  for (let i = 0; i < 16; i++) h += `<i class="mote" style="left:${rnd(0, 100)}%;animation-delay:${-rnd(0, 20)}s;animation-duration:${rnd(14, 26)}s;--dx:${rnd(-40, 40)}px"></i>`;
  [[3, 18, 0], [8, 58, 1.4], [93, 26, .7], [89, 66, 2.1], [14, 82, 3], [86, 90, 1]].forEach(([x, y, d]) => h += `<div class="candle" style="left:${x}%;top:${y}%;animation-delay:${d}s"><b class="flame" style="animation-delay:${d / 2}s"></b><u></u></div>`);
  sky.innerHTML = h; document.body.prepend(sky);
  document.body.insertAdjacentHTML('beforeend', '<div id="glow" aria-hidden="true"></div>');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const fly = () => {
    const el = document.createElement('div'); el.className = 'flyer'; el.innerHTML = owlSVG;
    const ltr = Math.random() > .5; el.style.top = rnd(4, 40) + 'vh'; if (!ltr) el.style.transform = 'scaleX(-1)'; document.body.appendChild(el);
    el.animate([{ left: ltr ? '-90px' : '105vw', marginTop: '0px' }, { marginTop: '-30px', offset: .3 }, { marginTop: '18px', offset: .65 }, { left: ltr ? '105vw' : '-90px', marginTop: '-10px' }], { duration: rnd(9000, 14000), easing: 'linear' }).onfinish = () => el.remove();
    setTimeout(fly, rnd(16000, 38000));
  };
  setTimeout(fly, 2500);
}

/* ---------- live sync (Supabase) ----------
   The app keeps working on the in-memory state S(). Every save() is diffed against `shadow` (what the server already has);
   differences go into a persistent outbox that is flushed to Supabase, so changes made offline sync later.
   Realtime pushes the other person's changes back in. */
const SYNC = { wanted: !!(CFG.SUPABASE_URL && CFG.SUPABASE_KEY), on: false, state: 'boot', msg: '', uid: null, email: '', draft: '' };
let sb = null;
if (SYNC.wanted && window.supabase) { try { sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY); } catch { sb = null; } }
const TABLES = ['events', 'day_plans', 'meals', 'pings', 'notes', 'bible', 'plate', 'settings'];
const newId = () => Date.now() * 1000 + Math.floor(rnd(0, 999)); // ids made on the device so offline writes can sync later
const outbox = { q: [], key: 'owlery.outbox', load() { try { this.q = JSON.parse(localStorage.getItem(this.key) || '[]'); } catch { this.q = []; } }, save() { try { localStorage.setItem(this.key, JSON.stringify(this.q)); } catch { /* ignore */ } } };
let shadow = null, chan = null, flushing = false, pendingRender = false, authWatched = false;

// app shape <-> table rows
const evRow = e => ({ id: e.id, who: e.who, day: e.day, s: e.s, e: e.e, title: e.title, descr: e.desc || '', kind: e.kind, rep: e.rep || 'none', days: e.days || [], skip: e.skip || [], until: e.until || null });
const dayRow = (k, d) => ({ day: k, type: d.type || '', note: d.note || '', dinner_chosen: d.dinner?.chosen || '', votes: { a: d.dinner?.votes?.a || '', b: d.dinner?.votes?.b || '' } });
const dayKey = r => JSON.stringify([r.type, r.note, r.dinner_chosen, r.votes.a, r.votes.b]);
const EMPTY_DAY = dayKey(dayRow('', {}));
const pingRow = p => ({ id: p.id, by: p.by, t: new Date(p.t).toISOString(), body: p.text || '', mood: p.mood || '', gif: p.gif || '', photo: p.photo || '' });
const noteRow = n => ({ id: n.id, by: n.by, t: new Date(n.t).toISOString(), body: n.text || '', img: n.img || '', read: !!n.read, kind: n.kind || '' });
const fromEvent = r => ({ id: r.id, who: r.who, day: r.day, s: r.s, e: r.e, title: r.title, desc: r.descr || '', kind: r.kind, rep: r.rep || 'none', days: r.days || [], skip: r.skip || [], until: r.until || '' });
const fromPing = r => ({ id: Number(r.id), by: r.by, t: Date.parse(r.t), text: r.body, mood: r.mood, gif: r.gif, photo: r.photo });
const fromNote = r => ({ id: Number(r.id), by: r.by, t: Date.parse(r.t), text: r.body, img: r.img, read: r.read, kind: r.kind || '' });
function applyDay(r) { const d = store.day(r.day); d.type = r.type || ''; d.note = r.note || ''; d.dinner = { chosen: r.dinner_chosen || '', votes: { a: '', b: '', ...(r.votes || {}) } }; }
function applyBible(r) { store.day(r.day)[r.who].bible = { passage: r.passage || '', done: !!r.done }; }
function applyPlate(r) { if (r.day === dkey(new Date())) S().plate[r.who] = { total: r.total, done: r.done }; }

function snapshot() {
  const s = { events: new Map(), days: new Map(), bible: new Map(), meals: new Set(S().meals), pings: new Set(S().pings.map(p => p.id)), notes: new Map(), visit: JSON.stringify(S().visit || null) };
  S().events.forEach(e => s.events.set(e.id, JSON.stringify(evRow(e))));
  for (const [k, d] of Object.entries(S().days)) {
    const j = dayKey(dayRow(k, d)); if (j !== EMPTY_DAY) s.days.set(k, j);
    for (const w of ['a', 'b']) { const b = d[w]?.bible; if (b) s.bible.set(`${k}:${w}`, JSON.stringify([b.passage || '', !!b.done])); }
  }
  S().notes.forEach(n => s.notes.set(n.id, n.read ? 1 : 0));
  return s;
}
function diff() { // called from store.save(): turn what changed on this device into outbox operations
  if (!shadow) return;
  const cur = snapshot(), me = S().me, ops = [];
  S().events.forEach(e => { if (e.who === me && shadow.events.get(e.id) !== cur.events.get(e.id)) ops.push({ t: 'events', k: 'upsert', on: 'id', row: evRow(e) }); });
  shadow.events.forEach((j, id) => { if (!cur.events.has(id) && JSON.parse(j).who === me) ops.push({ t: 'events', k: 'delete', match: { id } }); });
  cur.days.forEach((j, k) => { if (shadow.days.get(k) !== j) ops.push({ t: 'day_plans', k: 'upsert', on: 'day', row: dayRow(k, S().days[k]) }); });
  shadow.days.forEach((j, k) => { if (!cur.days.has(k)) ops.push({ t: 'day_plans', k: 'upsert', on: 'day', row: dayRow(k, S().days[k] || {}) }); });
  cur.bible.forEach((j, key) => { const [k, w] = key.split(':'); if (w === me && shadow.bible.get(key) !== j) { const b = S().days[k][w].bible; ops.push({ t: 'bible', k: 'upsert', on: 'day,who', row: { day: k, who: w, passage: b.passage || '', done: !!b.done } }); } });
  cur.meals.forEach(m => { if (!shadow.meals.has(m)) ops.push({ t: 'meals', k: 'upsert', on: 'name', row: { name: m } }); });
  S().pings.forEach(p => { if (p.by === me && !shadow.pings.has(p.id)) ops.push({ t: 'pings', k: 'upsert', on: 'id', row: pingRow(p) }); });
  S().notes.forEach(n => {
    if (!shadow.notes.has(n.id)) { if (n.by === me) ops.push({ t: 'notes', k: 'upsert', on: 'id', row: noteRow(n) }); }
    else if (n.by !== me && n.read && !shadow.notes.get(n.id)) ops.push({ t: 'notes', k: 'update', patch: { read: true }, match: { id: n.id } });
  });
  if (cur.visit !== shadow.visit) ops.push({ t: 'settings', k: 'upsert', on: 'key', row: { key: 'visit', value: S().visit || null } });
  shadow = cur;
  if (ops.length) { outbox.q.push(...ops); outbox.save(); flush(); }
}
const runOp = op => { const t = sb.from(op.t); return op.k === 'upsert' ? t.upsert(op.row, { onConflict: op.on }) : op.k === 'update' ? t.update(op.patch).match(op.match) : t.delete().match(op.match); };
async function flush() {
  if (!SYNC.on || flushing) return; flushing = true;
  try {
    while (outbox.q.length) {
      const op = outbox.q[0]; let res;
      try { res = await runOp(op); } catch (e) { res = { error: { message: String(e) } }; }
      if (res.error) {
        if (!res.error.code) break; // no connection: keep everything and retry later
        outbox.q.shift(); outbox.save(); toast("One change couldn't be saved (not allowed)."); console.warn('owlery sync', op.t, res.error.message); continue;
      }
      outbox.q.shift(); outbox.save();
    }
  } finally { flushing = false; }
}
async function fetchAll() { // everything the two of you need; returns the meal names that live on the server
  const since = dkey(addDays(new Date(), -120)), today = dkey(new Date());
  const [ev, dp, bb, ml, pg, nt, pl, st] = await Promise.all([
    sb.from('events').select('*'), sb.from('day_plans').select('*').gte('day', since), sb.from('bible').select('*').gte('day', since),
    sb.from('meals').select('*'), sb.from('pings').select('*').order('t', { ascending: false }).limit(60),
    sb.from('notes').select('*').order('t', { ascending: false }).limit(100), sb.from('plate').select('*').eq('day', today), sb.from('settings').select('*'),
  ]);
  const bad = [ev, dp, bb, ml, pg, nt, pl, st].find(r => r.error); if (bad) throw bad.error;
  const s = S();
  s.events = ev.data.map(fromEvent); s.days = {}; dp.data.forEach(applyDay); bb.data.forEach(applyBible);
  s.pings = pg.data.map(fromPing); s.notes = nt.data.map(fromNote);
  s.plate = { a: { total: 0, done: 0 }, b: { total: 0, done: 0 } }; pl.data.forEach(applyPlate); s.plateSrc = pl.data.length ? 'lockin' : 'none';
  s.visit = st.data.find(r => r.key === 'visit')?.value || null;
  return ml.data.map(r => r.name);
}
function onRemote(t, p) { // the other person (or another of your devices) changed something
  const del = p.eventType === 'DELETE', r = del ? p.old : p.new, s = S(), me = s.me; if (!r) return;
  const put = (list, item) => { const i = list.findIndex(x => x.id === item.id); if (i >= 0) list[i] = item; else list.push(item); };
  if (t === 'events') { if (del) s.events = s.events.filter(e => e.id !== r.id); else put(s.events, fromEvent(r)); }
  else if (t === 'day_plans') { if (del) applyDay({ day: r.day }); else applyDay(r); }
  else if (t === 'bible') { if (!del) applyBible(r); }
  else if (t === 'meals') { if (del) s.meals = s.meals.filter(m => m !== r.name); else if (!s.meals.includes(r.name)) s.meals.push(r.name); }
  else if (t === 'pings') {
    if (del) s.pings = s.pings.filter(x => x.id !== Number(r.id));
    else { const it = fromPing(r), had = s.pings.some(x => x.id === it.id); put(s.pings, it); s.pings.sort((a, b) => b.t - a.t); if (!had && it.by !== me) { SFX.play('pop'); toast(`A new owl from ${s.names[it.by]} 🦉`); } }
  } else if (t === 'notes') {
    if (del) s.notes = s.notes.filter(x => x.id !== Number(r.id));
    else { const it = fromNote(r), had = s.notes.some(x => x.id === it.id); put(s.notes, it); if (!had && it.by !== me) { mailIdx = null; arrive(it); } }
  } else if (t === 'plate') { applyPlate(r); s.plateSrc = 'lockin'; }
  else if (t === 'settings' && r.key === 'visit') s.visit = del ? null : (r.value || null);
  shadow = snapshot(); try { localStorage.setItem(store.key, JSON.stringify(s)); } catch { /* ignore */ } scheduleRender();
}
function subscribe() {
  if (chan) sb.removeChannel(chan);
  chan = sb.channel('owlery'); TABLES.forEach(t => chan.on('postgres_changes', { event: '*', schema: 'public', table: t }, p => onRemote(t, p))); chan.subscribe();
}
function scheduleRender() { // don't yank the page away while someone is typing, drawing or has a sheet open
  const a = document.activeElement, busy = (a && /^(INPUT|TEXTAREA)$/.test(a.tagName)) || curStroke || $('#picker')?.classList.contains('open') || document.querySelector('.envelope.open');
  if (busy) { pendingRender = true; return; }
  pendingRender = false; render();
}
document.addEventListener('focusout', () => setTimeout(() => { if (pendingRender) scheduleRender(); }, 250));
async function refresh() { // coming back to the app or the network: push anything waiting, then pull fresh
  if (!SYNC.on) return; await flush(); if (outbox.q.length) return;
  try { const m = await fetchAll(); if (m.length) S().meals = m; shadow = snapshot(); shadow.meals = new Set(m); scheduleRender(); } catch { /* still offline */ }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
window.addEventListener('online', refresh);
setInterval(() => flush(), 20000);

async function startSynced(session) {
  SYNC.uid = session.user.id; SYNC.email = session.user.email || '';
  let mem = null; try { const r = await sb.from('couple_members').select('*'); if (!r.error) mem = r.data; } catch { /* offline */ }
  store.key = `owlery.cache.${SYNC.uid}`; store.load();
  if (mem) {
    const mine = mem.find(m => m.user_id === SYNC.uid);
    if (!mine) { SYNC.state = 'unlinked'; return render(); }
    S().me = mine.slot; S().names = { a: 'Me', b: 'Partner' }; mem.forEach(m => { S().names[m.slot] = m.name; });
  } else if (!S().me) { SYNC.state = 'error'; SYNC.msg = "Can't reach the Owlery right now."; return render(); }
  S().seeded = true; outbox.key = `owlery.outbox.${SYNC.uid}`; outbox.load();
  SYNC.on = true; SYNC.state = 'ready'; shadow = snapshot(); render();
  await flush();
  try { const m = await fetchAll(); if (m.length) S().meals = m; shadow = snapshot(); shadow.meals = new Set(m); } catch { toast('Offline: showing what was saved on this phone'); }
  subscribe(); store.save(); render();
}
async function doLogin() {
  const email = ($('#lemail')?.value || '').trim(), pass = $('#lpass')?.value || ''; SYNC.draft = email;
  if (!email || !pass) { SYNC.msg = 'Enter both, please.'; return renderGate(); }
  SYNC.msg = 'Opening the door…'; renderGate();
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) { SYNC.msg = /invalid|credentials/i.test(error.message) ? "That email or password isn't right." : "Can't reach the Owlery. Check your connection."; return renderGate(); }
    SYNC.msg = ''; await startSynced(data.session);
  } catch { SYNC.msg = "Can't reach the Owlery. Check your connection."; renderGate(); }
}
async function signOut() {
  closeSheet(); try { await sb.auth.signOut(); } catch { /* ignore */ }
  if (chan) { sb.removeChannel(chan); chan = null; }
  SYNC.on = false; shadow = null; store.key = KEY; store.s = blank(); SYNC.state = 'login'; SYNC.msg = ''; render();
}
const whoamiHTML = () => sc(`<div class="pk-head"><span>Signed in</span><button data-act="close" aria-label="Close">✕</button></div><div class="margin-note">${esc(SYNC.email)}</div><div class="row" style="justify-content:space-between"><button class="btn small ghost" data-act="close">Stay</button><button class="btn alt small" data-act="signout">Sign out</button></div>`, 'cream', 0, 'tc');
function renderGate() {
  $('#tabs').innerHTML = ''; const v = $('#view'); v.className = 'v-gate'; const st = SYNC.state; placeRings();
  if (st === 'login') v.innerHTML = `${sc('<span class="date-big">Enter the<br>Owlery</span><p class="kicker">Sign in with the email and password you made for this app. It stays on this phone.</p>', 'lined', -1.2, 'tl')}
    <label class="small">Email</label><input class="field" id="lemail" type="email" autocomplete="username" inputmode="email" autocapitalize="none" value="${esc(SYNC.draft)}">
    <label class="small">Password</label><input class="field" id="lpass" type="password" autocomplete="current-password">
    <div class="margin-note">${esc(SYNC.msg)}</div>
    <div style="text-align:right"><button class="btn alt" data-act="login">Open the door 🦉</button></div>`;
  else if (st === 'unlinked') v.innerHTML = `${sc('<span class="date-big">Almost!</span>', 'lined', -1.2, 'tl')}<p class="margin-note">You're signed in, but this account isn't linked to the two of you yet. Run the last step in <b>supabase/schema.sql</b> (the <i>couple_members</i> insert) with your two emails.</p><div class="row"><button class="btn small" data-act="retry">Try again</button><button class="who-switch" data-act="signout">sign out</button></div>`;
  else if (st === 'nolib') v.innerHTML = `${sc('<span class="date-big">Offline?</span>', 'lined', -1.2, 'tl')}<p class="margin-note">Couldn't load the sync library. Connect to the internet and reload.</p><button class="btn small" data-act="retry">Reload</button>`;
  else if (st === 'error') v.innerHTML = `${sc('<span class="date-big">Hmm.</span>', 'lined', -1.2, 'tl')}<p class="margin-note">${esc(SYNC.msg)}</p><button class="btn small" data-act="retry">Try again</button>`;
  else v.innerHTML = `<div class="env-scene"><div class="arrival"><span class="owl">🦉</span>Opening the Owlery…</div></div>`;
}
async function boot() {
  if (!SYNC.wanted) { render(); return; } // no Supabase settings: plain single-phone demo
  if (!sb) { SYNC.state = 'nolib'; return render(); }
  SYNC.state = 'boot'; render();
  let session = null; try { session = (await sb.auth.getSession()).data.session; } catch { /* offline */ }
  if (!authWatched) { authWatched = true; sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT' && SYNC.on) signOut(); }); }
  if (session) startSynced(session); else { SYNC.state = 'login'; render(); }
}

/* ---------- opening screen: a leather cover that opens like a book once the app is actually ready ---------- */
function splash() {
  if (/nosplash/.test(location.search) || document.hidden) return; // no point animating a page nobody is looking at
  placeRings(); const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, v = $('#view').getBoundingClientRect();
  const el = document.createElement('div'); el.id = 'splash'; el.setAttribute('role', 'status'); el.setAttribute('aria-label', 'Opening Owlery');
  el.style.cssText = `--x:${v.left}px;--y:${v.top}px;--w:${v.width}px;--h:${v.height}px`;
  let stars = ''; for (let i = 0; i < 44; i++) stars += `<i class="star" style="left:${rnd(0, 100)}%;top:${rnd(0, 100)}%;animation-delay:${rnd(0, 4)}s;--s:${rnd(.6, 1.5)}"></i>`;
  el.innerHTML = `${stars}<div class="sp-glow"></div>
    <div class="cover"><div class="face front"><div class="sp-emblem">${owlPerch}</div><div class="sp-title"><span>Owlery</span></div><div class="sp-sub">a little castle for two</div>
      <div class="sp-env">💌</div><div class="sp-seal"><b>🦉</b></div><div class="sp-wait">opening the doors<i>.</i><i>.</i><i>.</i></div></div><div class="face back"></div></div>
    <div class="sp-fly">${owlSVG}</div>`;
  document.body.appendChild(el); document.body.classList.add('splashing');
  if (!reduce) el.querySelector('.sp-fly').animate([
    { transform: 'translate(-15vw, 46vh) scale(1.2) rotate(-8deg)', opacity: 0 }, { opacity: 1, offset: .12 },
    { transform: 'translate(40vw, 20vh) scale(2.1) rotate(2deg)', offset: .5 }, { transform: 'translate(115vw, 6vh) scale(1.3) rotate(10deg)', opacity: 1 },
  ], { duration: 2100, delay: 250, easing: 'ease-in-out', fill: 'both' });
  const MIN = reduce ? 1100 : 2900, t0 = performance.now(); let opened = false; // reduced motion: show the finished cover briefly, no animation
  const ready = () => !SYNC.wanted || SYNC.state !== 'boot'; // wait for sign-in / first sync, not just a timer
  const gone = () => { el.remove(); document.body.classList.remove('splashing'); };
  const open = () => { if (opened) return; opened = true; clearInterval(iv); SFX.play('flip'); el.classList.add('open'); setTimeout(gone, reduce ? 50 : 2000); };
  document.addEventListener('visibilitychange', () => { if (document.hidden && !opened) { opened = true; clearInterval(iv); gone(); } }, { once: true }); // tabbed away: don't hold the app hostage
  const iv = setInterval(() => { const dt = performance.now() - t0; if (dt > MIN && ready()) open(); else if (dt > MIN) el.classList.add('waiting'); if (dt > 12000) open(); }, 120);
  el.addEventListener('click', () => { if (performance.now() - t0 > 900 && ready()) open(); });
  if (!reduce) { setTimeout(() => SFX.play('seal'), 1550); setTimeout(() => SFX.play('writing'), 1750); } // seal thump, then the quill writes the title
}

/* ---------- boot ---------- */
store.load();
ambient();
document.body.insertAdjacentHTML('beforeend', `<div id="picker" aria-live="polite"></div><div id="banner" role="status"></div><svg class="defs" aria-hidden="true"><filter id="rough"><feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="2" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3"/></filter></svg>`);
boot();
splash();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
