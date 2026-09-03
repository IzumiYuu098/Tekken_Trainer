// audio.js
// All sounds are synthesized at runtime with the Web Audio API — short
// oscillator blips. No external audio files, no copyrighted game sounds.

import { storage } from './storage.js';

const TONE_PRESETS = {
  input: { freq: 260, duration: 0.035, type: 'square', gain: 0.12 },
  correct: { freq: 660, duration: 0.06, type: 'sine', gain: 0.18 },
  wrong: { freq: 140, duration: 0.18, type: 'sawtooth', gain: 0.18 },
  success: { freqs: [523.25, 659.25, 783.99], duration: 0.09, type: 'triangle', gain: 0.18 },
  failure: { freqs: [220, 174.6], duration: 0.16, type: 'sawtooth', gain: 0.18 }
};

export class AudioFeedback {
  constructor() {
    const settings = storage.getSoundSettings() || {};
    this.muted = !!settings.muted;
    this.volume = typeof settings.volume === 'number' ? settings.volume : 0.6;
    this._ctx = null;
  }

  _ensureContext() {
    if (!this._ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this._ctx = new Ctx();
    }
    if (this._ctx.state === 'suspended') {
      this._ctx.resume().catch(() => {});
    }
    return this._ctx;
  }

  setMuted(muted) {
    this.muted = !!muted;
    storage.setSoundSettings({ muted: this.muted, volume: this.volume });
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    storage.setSoundSettings({ muted: this.muted, volume: this.volume });
  }

  _playTone(freq, duration, type, gainValue) {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const startAt = ctx.currentTime;
    const peak = Math.max(gainValue * this.volume, 0.0001);
    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(peak, startAt + 0.008);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    osc.connect(gainNode).connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.02);
  }

  play(name) {
    if (this.muted) return;
    const preset = TONE_PRESETS[name];
    if (!preset) return;
    if (preset.freqs) {
      preset.freqs.forEach((f, i) => {
        setTimeout(() => this._playTone(f, preset.duration, preset.type, preset.gain), i * 65);
      });
    } else {
      this._playTone(preset.freq, preset.duration, preset.type, preset.gain);
    }
  }
}
