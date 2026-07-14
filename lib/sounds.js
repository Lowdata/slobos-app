// Sound utility — generates sounds using Web Audio API (no external files needed)
// Provides: spinSound (looping tick), winSound, loseSound

export function createSoundManager() {
  let ctx = null;
  let muted = false;
  let spinOsc = null;
  let spinInterval = null;

  const getCtx = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  };

  const playTone = (freq, duration, type = 'square', volume = 0.15) => {
    if (muted) return;
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  };

  return {
    get isMuted() { return muted; },
    toggle() { muted = !muted; return muted; },

    // Tick sound for the ball passing a pocket
    tick() {
      if (muted) return;
      playTone(800 + Math.random() * 400, 0.04, 'square', 0.08);
    },

    // Start a repeating tick for the spin, getting slower
    startSpin() {
      if (muted) return;
      let interval = 40;
      const maxInterval = 300;
      const tickLoop = () => {
        this.tick();
        interval = Math.min(interval * 1.008, maxInterval);
        spinInterval = setTimeout(tickLoop, interval);
      };
      tickLoop();
    },

    stopSpin() {
      if (spinInterval) {
        clearTimeout(spinInterval);
        spinInterval = null;
      }
    },

    // Win fanfare
    win() {
      if (muted) return;
      const c = getCtx();
      const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
      notes.forEach((f, i) => {
        setTimeout(() => playTone(f, 0.3, 'square', 0.12), i * 100);
      });
    },

    // Lose / rekt
    lose() {
      if (muted) return;
      playTone(220, 0.4, 'sawtooth', 0.1);
      setTimeout(() => playTone(180, 0.5, 'sawtooth', 0.08), 150);
    },
  };
}
