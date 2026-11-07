'use strict';
/* Owlery sound design: every sound is synthesized with Web Audio (no audio files).
   Palette: paper, wax, wood, brass music-box, owl. Each voice is voice(E, t) so it renders live or offline (for tests). */
const SFX = (() => {
  const LS = 'owlery.sfx';
  let ctx = null, E = null, on = true;
  try { on = localStorage.getItem(LS) !== '0'; } catch { /* default on */ }

  const noiseBuf = c => { const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };
  const impulse = c => { const n = Math.floor(c.sampleRate * 1.3), b = c.createBuffer(2, n, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); } return b; };
  function build(c) { // master -> gentle compressor -> out, plus a small "wooden room" reverb send
    const out = c.createGain(); out.gain.value = .5; // overall volume: raise/lower this one number
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; out.connect(comp); comp.connect(c.destination);
    const conv = c.createConvolver(); conv.buffer = impulse(c); const wet = c.createGain(); wet.gain.value = .35; wet.connect(conv); conv.connect(out);
    return { c, out, wet, noise: noiseBuf(c) };
  }
  const sendTo = (E, node, send) => { if (send) { const s = E.c.createGain(); s.gain.value = send; node.connect(s); s.connect(E.wet); } };

  function tone(E, t, { f = 440, f2 = null, dur = .2, type = 'sine', vol = .3, a = .006, send = .15 } = {}) {
    const o = E.c.createOscillator(), g = E.c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(E.out); sendTo(E, g, send); o.start(t); o.stop(t + dur + .05);
  }
  function burst(E, t, { dur = .1, type = 'bandpass', f = 1000, f2 = null, q = 1, vol = .3, peak = .3, send = .1 } = {}) {
    const s = E.c.createBufferSource(), flt = E.c.createBiquadFilter(), g = E.c.createGain();
    s.buffer = E.noise; flt.type = type; flt.Q.value = q; flt.frequency.setValueAtTime(f, t); if (f2) flt.frequency.exponentialRampToValueAtTime(f2, t + dur);
    vol *= type === 'bandpass' ? 2.6 : 1.7; // narrow filters thin the noise out, so make up the level
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.max(.004, dur * peak)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(flt); flt.connect(g); g.connect(E.out); sendTo(E, g, send); s.start(t, Math.random() * 1.4); s.stop(t + dur + .05);
  }
  const r = (a, b) => a + Math.random() * (b - a);

  const hoot = (E, t, len, f) => { // soft two-partial owl "hoo" with a breath of air
    tone(E, t, { f, f2: f * .86, dur: len, vol: .3, a: .05, send: .35 });
    tone(E, t, { f: f * 2, f2: f * 1.72, dur: len, vol: .05, a: .05, send: .2 });
    burst(E, t, { dur: len, f: f * 1.6, q: 2.5, vol: .04, peak: .5 });
  };
  const sparkle = (E, t, notes, step, vol = .12) => notes.forEach((f, i) => tone(E, t + i * step, { f, dur: .45, type: 'triangle', vol, send: .6 }));

  const voices = {
    flip(E, t) { // paper page turn: airy sweep, a dry tick at the start and a soft landing
      burst(E, t, { dur: .5, f: 2300, f2: 500, q: .8, vol: .34, peak: .35, send: .15 });
      burst(E, t + .01, { dur: .06, type: 'highpass', f: 5200, vol: .18 });
      burst(E, t + .44, { dur: .07, type: 'lowpass', f: 320, vol: .25 });
      tone(E, t + .45, { f: 110, f2: 62, dur: .1, vol: .22, send: 0 });
    },
    tap(E, t) { // wooden peg tick
      tone(E, t, { f: 640, f2: 420, dur: .07, type: 'triangle', vol: .3, send: .05 });
      burst(E, t, { dur: .02, type: 'highpass', f: 3200, vol: .08 });
    },
    pop(E, t) { // sticker lifting off
      tone(E, t, { f: 520, f2: 900, dur: .09, vol: .3 });
      tone(E, t + .07, { f: 1320, dur: .12, vol: .1, send: .3 });
    },
    stamp(E, t) { // rubber stamp slammed on paper
      tone(E, t, { f: 150, f2: 45, dur: .22, vol: .5, send: .12 });
      burst(E, t, { dur: .1, type: 'lowpass', f: 520, vol: .4 });
      burst(E, t + .012, { dur: .05, type: 'highpass', f: 2600, vol: .14 });
    },
    seal(E, t) { // wax squish
      tone(E, t, { f: 200, f2: 70, dur: .16, vol: .45, send: 0 });
      burst(E, t, { dur: .07, type: 'lowpass', f: 360, vol: .3 });
      for (let i = 0; i < 4; i++) burst(E, t + .03 + i * .026 + r(0, .015), { dur: .015, type: 'highpass', f: 3500, vol: .09 });
    },
    sealed(E, t) { // daily word complete: wax thump then a warm bell
      voices.seal(E, t);
      tone(E, t + .12, { f: 659, dur: 1.3, vol: .18, send: .5 }); tone(E, t + .12, { f: 988, dur: 1, vol: .08, send: .5 }); tone(E, t + .2, { f: 1318, dur: .9, vol: .05, send: .5 });
    },
    hat(E, t) { // sorting-hat style magic: whoosh into a rising sparkle
      burst(E, t, { dur: .5, f: 400, f2: 3200, q: 1.2, vol: .22, peak: .6, send: .3 });
      sparkle(E, t + .1, [784, 988, 1175, 1319, 1568, 1976], .07);
    },
    owl(E, t) { // wing flaps, then two hoots as it takes off with the envelope
      for (let i = 0; i < 7; i++) burst(E, t + i * .075, { dur: .07, f: 480 + i * 55, q: 1.3, vol: .22 * (1 - i * .08), peak: .4, send: .08 });
      hoot(E, t + .3, .34, 430); hoot(E, t + .72, .3, 380);
    },
    chime(E, t) { // music-box arrival
      [659, 784, 988, 1319].forEach((f, i) => { tone(E, t + i * .11, { f, dur: .95, type: 'triangle', vol: .17, send: .55 }); tone(E, t + i * .11, { f: f * 2, dur: .25, vol: .04, send: .4 }); });
    },
    envelope(E, t) { // seal cracks, paper crinkles and slides, tiny shimmer
      voices.seal(E, t);
      for (let i = 0; i < 14; i++) burst(E, t + .15 + i * .028 + r(0, .01), { dur: .02, type: 'highpass', f: r(2500, 5500), vol: .12 });
      burst(E, t + .55, { dur: .4, f: 800, f2: 2400, q: .7, vol: .18, peak: .5 });
      tone(E, t + .9, { f: 1047, dur: .7, vol: .1, send: .5 }); tone(E, t + .98, { f: 1568, dur: .6, vol: .06, send: .5 });
    },
    morning(E, t) { // wing flaps, then a bright rising sparkle
      for (let i = 0; i < 4; i++) burst(E, t + i * .075, { dur: .07, f: 520 + i * 60, q: 1.3, vol: .2 * (1 - i * .1), peak: .4, send: .08 });
      sparkle(E, t + .3, [523, 659, 784, 1047, 1319], .1, .15);
    },
    night(E, t) { // wing flaps, then a slow descending lullaby
      for (let i = 0; i < 4; i++) burst(E, t + i * .09, { dur: .08, f: 420 + i * 40, q: 1.3, vol: .17 * (1 - i * .1), peak: .4, send: .08 });
      [784, 659, 523, 392].forEach((f, i) => tone(E, t + .32 + i * .2, { f, dur: 1, type: 'sine', vol: .16, a: .03, send: .6 }));
    },
    writing(E, t) { // a quill writing "Owlery": dip, then scratchy strokes letter by letter (~1.1s, matches the title ink-in)
      burst(E, t, { dur: .09, type: 'lowpass', f: 700, vol: .2 });
      const letters = 6, span = 1.05;
      for (let i = 0; i < letters; i++) {
        const t0 = t + .1 + (i * span) / letters, swirl = i === 0 || i === 5; // the big O and the tail of the y
        if (swirl) burst(E, t0, { dur: .16, f: 1700, f2: 3400, q: 2, vol: .2, peak: .4, send: .06 });
        for (let s = 0; s < 3; s++) burst(E, t0 + (swirl ? .1 : 0) + s * .048 + r(0, .012), { dur: r(.035, .06), f: r(2200, 3900), q: 2.6, vol: r(.14, .22), peak: .35, send: .05 });
      }
      burst(E, t + 1.2, { dur: .16, f: 2100, f2: 3800, q: 2, vol: .18, peak: .3 });  // the final flick
      tone(E, t + 1.38, { f: 1250, f2: 900, dur: .06, type: 'triangle', vol: .12, send: .1 }); // the dot of ink
    },
    crinkle(E, t) { for (let i = 0; i < 10; i++) burst(E, t + i * .03 + r(0, .012), { dur: .022, type: 'highpass', f: r(2200, 5200), vol: .12 }); },
    scribble(E, t) { for (let i = 0; i < 5; i++) burst(E, t + i * .05, { dur: .045, f: r(2200, 3700), q: 3, vol: .12 }); },
    pin(E, t) { voices.scribble(E, t); tone(E, t + .27, { f: 880, f2: 1100, dur: .1, vol: .16 }); },
    scratch(E, t) { burst(E, t, { dur: .045, f: r(1800, 3000), q: 1.5, vol: .12 }); },
    nope(E, t) { // polite refusal
      tone(E, t, { f: 240, f2: 200, dur: .14, type: 'triangle', vol: .22 }); tone(E, t + .13, { f: 180, f2: 140, dur: .2, type: 'triangle', vol: .22 });
    },
  };

  // which sound each UI action makes (page-turn sounds are played by flip() itself)
  const ACT = { planmode: 'tap', owlmode: 'tap', notemode: 'tap', type: 'stamp', wkset: 'stamp', vote: 'pop', mood: 'pop', addmeal: 'pop', hat: 'hat', gifopen: 'tap', gifpick: 'pop', gifq: 'tap', gifsearch: 'tap',
    gifnext: 'flip', gifprev: 'flip', gifclear: 'tap', lane: 'tap', evnew: 'tap', ev: 'tap', evedit: 'tap', evkind: 'tap', evsave: 'pin', evdel: 'nope', close: 'tap', ncolor: 'tap', nundo: 'tap',
    nclear: 'crinkle', nopen: 'envelope', notifyon: 'chime', switchwho: 'tap', dtoday: 'tap', lockin: 'tap', wall: 'flip', mnav: 'flip', iam: 'tap', wkopen: 'tap', visitedit: 'tap', visitsave: 'pin', visitclear: 'tap', evrep: 'tap', evwd: 'tap', evuntil: 'tap', moodset: 'tap', mfmood: 'pop', mfgif: 'tap', mfgifclear: 'tap', mfsave: 'pop', evskip: 'nope', schedmode: 'tap', wkhopen: 'tap' };

  function ensure() {
    if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); E = build(ctx); }
    if (ctx.state === 'suspended') ctx.resume();
    return E;
  }
  let lastScratch = 0;
  return {
    get on() { return on; },
    names: Object.keys(voices),
    play(name) { if (!on || !voices[name]) return; const e = ensure(); if (e) voices[name](e, ctx.currentTime + .01); },
    act(a) { const n = ACT[a]; if (n) this.play(n); },
    scratch() { const now = performance.now(); if (now - lastScratch > 55) { lastScratch = now; this.play('scratch'); } },
    toggle() { on = !on; try { localStorage.setItem(LS, on ? '1' : '0'); } catch { /* ignore */ } if (on) this.play('tap'); return on; },
    async render(name, secs = 2.5) { // offline render for checking levels: returns peak + rms
      const oc = new OfflineAudioContext(1, 44100 * secs, 44100), e = build(oc); voices[name](e, .02);
      const d = (await oc.startRendering()).getChannelData(0); let peak = 0, sum = 0, last = 0;
      for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; if (a > .002) last = i; }
      return { name, peak: +peak.toFixed(3), rms: +Math.sqrt(sum / d.length).toFixed(4), tail: +(last / 44100).toFixed(2) };
    },
  };
})();
