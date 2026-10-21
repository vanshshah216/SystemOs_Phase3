"use client";

// Web Audio API procedural synthesizer & soundtrack manager
class SoundEngine {
  private ctx: AudioContext | null = null;
  private ambientAudio: HTMLAudioElement | null = null;
  private chargeOsc: OscillatorNode | null = null;
  private chargeGain: GainNode | null = null;
  private isMuted: boolean = false;

  private initCtx() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.ambientAudio) {
      this.ambientAudio.muted = muted;
    }
  }

  public getMuted() {
    return this.isMuted;
  }

  // Play background soundtrack extracted from reference video
  public playAmbientTrack() {
    if (typeof window === "undefined") return;
    if (!this.ambientAudio) {
      this.ambientAudio = new Audio("/audio.mp3");
      this.ambientAudio.loop = true;
      this.ambientAudio.volume = 0.45;
    }
    this.ambientAudio.muted = this.isMuted;
    this.ambientAudio.play().catch(() => {
      // Autoplay policy: will start on first user interaction
    });
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.ambientAudio) {
      this.ambientAudio.muted = this.isMuted;
      if (!this.isMuted && this.ambientAudio.paused) {
        this.ambientAudio.play().catch(() => {});
      }
    }
    return this.isMuted;
  }

  // Chime / Sparkle when drawing completes or +100 XP awarded
  public playSparkle() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const freqs = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    freqs.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + idx * 0.08);

      gain.gain.setValueAtTime(0, this.ctx!.currentTime + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.08, this.ctx!.currentTime + idx * 0.08 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx!.currentTime + idx * 0.08 + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(this.ctx!.currentTime + idx * 0.08);
      osc.stop(this.ctx!.currentTime + idx * 0.08 + 0.65);
    });
  }

  // Deep underwater rumble / whoosh
  public playWhoosh() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(80, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 0.4);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 1.2);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(600, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 1.2);
  }

  // Tap & hold charging electric drone
  public startChargeDrone() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    this.stopChargeDrone();

    this.chargeOsc = this.ctx.createOscillator();
    this.chargeGain = this.ctx.createGain();

    this.chargeOsc.type = "triangle";
    this.chargeOsc.frequency.setValueAtTime(140, this.ctx.currentTime);
    this.chargeOsc.frequency.linearRampToValueAtTime(480, this.ctx.currentTime + 1.8);

    this.chargeGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    this.chargeGain.gain.linearRampToValueAtTime(0.1, this.ctx.currentTime + 0.3);

    this.chargeOsc.connect(this.chargeGain);
    this.chargeGain.connect(this.ctx.destination);

    this.chargeOsc.start();
  }

  public stopChargeDrone() {
    if (this.chargeOsc && this.chargeGain && this.ctx) {
      try {
        this.chargeGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.2);
        this.chargeOsc.stop(this.ctx.currentTime + 0.25);
      } catch {}
      this.chargeOsc = null;
      this.chargeGain = null;
    }
  }

  // Shatter effect for Scene 5
  public playShatter() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    // Noise buffer burst
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(1200, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.4);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    whiteNoise.start();
  }

  // Warp boom
  public playWarpBoom() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, this.ctx.currentTime + 0.8);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.85);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.85);
  }
}

export const sound = new SoundEngine();
