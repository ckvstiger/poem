/* ==========================================================================
   《陌上桑》漢風五聲古箏合成器 + 音效庫 + 繁中語音朗讀引擎 (Web Audio + Speech API)
   完全無需外部音檔即可在任何教室離線播放！
   ========================================================================== */

class YuefuAudioEngine {
  constructor() {
    this.ctx = null;
    this.bgmRunning = false;
    this.bgmTimer = null;
    this.bgmStep = 0;
    this.bgmGain = null;
    this.speechRate = 0.95;
    this.muted = false;

    // 漢風五聲音階 (D大調宮商角徵羽: D4, E4, F#4, A4, B4, D5, E5, F#5, A5)
    this.pentatonic = [293.66, 329.63, 369.99, 440.00, 493.88, 587.33, 659.25, 739.99, 880.00];
    // 悠揚的採桑田園旋律序列 (index into pentatonic, -1 = rest)
    this.melody = [
      3, 5, 6, 5, 3, 2, 1, 2,
      3, 5, 6, 7, 6, 5, 3, -1,
      5, 6, 7, 8, 7, 6, 5, 3,
      2, 3, 5, 3, 2, 1, 0, -1
    ];
    this.bass = [0, -1, 3, -1, 1, -1, 3, -1];
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.24;
      this.bgmGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  // 模擬古箏撥弦 (Plucked Guzheng tone with warm harmonic decay)
  pluckString(freq, duration = 1.4, volume = 0.25, startOffset = 0) {
    if (this.muted) return;
    this.ensureContext();
    const now = this.ctx.currentTime + startOffset;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(freq, now);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(freq * 2, now);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2600, now);
    filter.frequency.exponentialRampToValueAtTime(520, now + duration);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration + 0.05);
    osc2.stop(now + duration + 0.05);
  }

  // 古箏刮奏 (Glissando arpeggio for transitions)
  playGlissando() {
    if (this.muted) return;
    this.ensureContext();
    this.pentatonic.forEach((freq, idx) => {
      this.pluckString(freq, 1.1, 0.16, idx * 0.045);
    });
  }

  // 啟動/停止背景漢風古箏樂
  toggleBgm(forceState = null) {
    const next = forceState !== null ? forceState : !this.bgmRunning;
    if (next) {
      if (this.bgmRunning) return true;
      this.ensureContext();
      this.bgmRunning = true;
      this.bgmTimer = setInterval(() => {
        if (!this.bgmRunning || this.muted) return;
        const noteIdx = this.melody[this.bgmStep % this.melody.length];
        if (noteIdx >= 0) {
          this.pluckString(this.pentatonic[noteIdx], 1.5, 0.22);
        }
        const bassIdx = this.bass[this.bgmStep % this.bass.length];
        if (bassIdx >= 0) {
          this.pluckString(this.pentatonic[bassIdx] / 2, 1.8, 0.15);
        }
        this.bgmStep++;
      }, 540);
      return true;
    } else {
      this.bgmRunning = false;
      if (this.bgmTimer) {
        clearInterval(this.bgmTimer);
        this.bgmTimer = null;
      }
      return false;
    }
  }

  // 音效 1：驚堂木 / 大鼓震場（配「使君一何愚！」超爽）
  playGong() {
    if (this.muted) return;
    this.ensureContext();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.65);

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(286, now);
    osc2.frequency.exponentialRampToValueAtTime(192, now + 0.9);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 1.35);
    osc2.stop(now + 1.35);
  }

  // 音效 2：五馬奔騰馬蹄聲
  playHooves() {
    if (this.muted) return;
    this.ensureContext();
    const pattern = [0, 0.12, 0.24, 0.45, 0.57, 0.69, 0.90, 1.02, 1.14];
    pattern.forEach((offset, i) => {
      const now = this.ctx.currentTime + offset;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(i % 3 === 0 ? 220 : 170, now);
      osc.frequency.exponentialRampToValueAtTime(75, now + 0.06);
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    });
  }

  // 音效 3：幽默吐槽 / 答錯音效 (Comic Boing)
  playComicBoing() {
    if (this.muted) return;
    this.ensureContext();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.linearRampToValueAtTime(160, now + 0.12);
    osc.frequency.linearRampToValueAtTime(320, now + 0.25);
    osc.frequency.linearRampToValueAtTime(140, now + 0.45);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  // 音效 4：答對 / 抽籤成功叮咚
  playSuccessChime() {
    if (this.muted) return;
    this.ensureContext();
    const notes = [587.33, 739.99, 880.00, 1174.66];
    notes.forEach((f, i) => {
      this.pluckString(f, 0.7, 0.24, i * 0.09);
    });
  }

  // 音效 5：課堂計時結束清脆響鈴
  playBell() {
    if (this.muted) return;
    this.ensureContext();
    [880, 1318.5, 1760].forEach((f, idx) => {
      const now = this.ctx.currentTime + idx * 0.14;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, now);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 1.15);
    });
  }

  // 繁體中文語音朗讀 (Web Speech API)
  speak(text, { rate = null, pitch = 1.0, onEnd = null } = {}) {
    if (!("speechSynthesis" in window)) {
      if (onEnd) setTimeout(onEnd, 2200);
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "zh-TW";
    utter.rate = rate ?? this.speechRate;
    utter.pitch = pitch;

    const voices = window.speechSynthesis.getVoices();
    const twVoice =
      voices.find(v => v.lang === "zh-TW" && /Mei-Jia|HsiaoChen|Yating|Google/i.test(v.name)) ||
      voices.find(v => v.lang.includes("zh-TW")) ||
      voices.find(v => v.lang.includes("zh"));
    if (twVoice) utter.voice = twVoice;

    if (onEnd) {
      utter.onend = onEnd;
      utter.onerror = onEnd;
    }
    window.speechSynthesis.speak(utter);
  }

  stopSpeak() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }
}

window.yuefuAudio = new YuefuAudioEngine();
