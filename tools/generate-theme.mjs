import { writeFileSync } from "node:fs";

const sampleRate = 44100;
const duration = 24;
const channels = 2;
const totalSamples = sampleRate * duration;
const left = new Float32Array(totalSamples);
const right = new Float32Array(totalSamples);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const smooth = (edge0, edge1, value) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

function panGains(pan) {
  const angle = (clamp(pan, -1, 1) + 1) * Math.PI * 0.25;
  return [Math.cos(angle), Math.sin(angle)];
}

function addVoice(start, length, frequency, amplitude, options = {}) {
  const startSample = Math.max(0, Math.floor(start * sampleRate));
  const endSample = Math.min(totalSamples, Math.ceil((start + length) * sampleRate));
  const attack = options.attack ?? 0.8;
  const release = options.release ?? 1.4;
  const pan = options.pan ?? 0;
  const detune = options.detune ?? 0;
  const waveform = options.waveform ?? "sine";
  const [gainLeft, gainRight] = panGains(pan);

  for (let index = startSample; index < endSample; index += 1) {
    const time = (index - startSample) / sampleRate;
    const remaining = (endSample - index) / sampleRate;
    const envelope = smooth(0, attack, time) * smooth(0, release, remaining);
    const phase = Math.PI * 2 * (frequency + detune) * time;
    let wave;
    if (waveform === "triangle") wave = (2 / Math.PI) * Math.asin(Math.sin(phase));
    else if (waveform === "soft") wave = Math.sin(phase) * 0.72 + Math.sin(phase * 2) * 0.2 + Math.sin(phase * 3) * 0.08;
    else wave = Math.sin(phase);
    const sample = wave * envelope * amplitude;
    left[index] += sample * gainLeft;
    right[index] += sample * gainRight;
  }
}

function addDrone(start, length, frequency, amplitude) {
  const startSample = Math.floor(start * sampleRate);
  const endSample = Math.min(totalSamples, Math.ceil((start + length) * sampleRate));
  for (let index = startSample; index < endSample; index += 1) {
    const time = index / sampleRate;
    const tremolo = 0.72 + Math.sin(time * 0.65) * 0.13 + Math.sin(time * 1.31) * 0.08;
    const wave = Math.sin(Math.PI * 2 * frequency * time) * 0.72
      + Math.sin(Math.PI * 2 * frequency * 1.005 * time) * 0.24
      + Math.sin(Math.PI * 2 * frequency * 0.5 * time) * 0.2;
    const sample = wave * amplitude * tremolo;
    left[index] += sample * 0.72;
    right[index] += sample * 0.68;
  }
}

function addKick(start, amplitude = 0.32) {
  const length = 0.55;
  const startSample = Math.floor(start * sampleRate);
  const endSample = Math.min(totalSamples, Math.ceil((start + length) * sampleRate));
  for (let index = startSample; index < endSample; index += 1) {
    const time = (index - startSample) / sampleRate;
    const decay = Math.exp(-time * 8.5);
    const frequency = 34 + 88 * Math.exp(-time * 17);
    const sample = Math.sin(Math.PI * 2 * frequency * time) * decay * amplitude;
    left[index] += sample;
    right[index] += sample;
  }
}

function addNoiseSwell(start, length, amplitude) {
  const startSample = Math.floor(start * sampleRate);
  const endSample = Math.min(totalSamples, Math.ceil((start + length) * sampleRate));
  let low = 0;
  for (let index = startSample; index < endSample; index += 1) {
    const time = (index - startSample) / sampleRate;
    const envelope = smooth(0, 1.4, time) * smooth(0, 2.1, length - time);
    const noise = Math.random() * 2 - 1;
    low += (noise - low) * 0.022;
    const sample = low * envelope * amplitude;
    left[index] += sample * 0.65;
    right[index] += sample * 0.74;
  }
}

const progression = [
  { root: 73.42, notes: [146.83, 174.61, 220, 293.66] },
  { root: 58.27, notes: [116.54, 146.83, 174.61, 233.08] },
  { root: 87.31, notes: [110, 130.81, 174.61, 220] },
  { root: 65.41, notes: [130.81, 164.81, 196, 261.63] },
];
const segmentLength = duration / progression.length;

progression.forEach((chord, chordIndex) => {
  const start = chordIndex * segmentLength;
  addVoice(start, segmentLength + 1.2, chord.root, 0.135, { attack: 1.2, release: 2, pan: chordIndex % 2 ? 0.25 : -0.25, waveform: "triangle" });
  chord.notes.forEach((frequency, noteIndex) => {
    addVoice(start + 0.08 * noteIndex, segmentLength + 1.4, frequency, 0.06, {
      attack: 0.9 + noteIndex * 0.16,
      release: 2.1,
      pan: noteIndex % 2 ? 0.42 : -0.42,
      detune: noteIndex % 2 ? 0.7 : -0.7,
      waveform: "soft",
    });
    addVoice(start + 0.16 * noteIndex, segmentLength + 0.8, frequency * 2, 0.018, {
      attack: 2.2,
      release: 2.4,
      pan: noteIndex % 3 - 1,
    });
  });
  addNoiseSwell(start, 2.4, 0.035);
});

addDrone(0, duration, 36.71, 0.085);
for (let beat = 0; beat < duration; beat += 1.5) addKick(beat, beat % 6 < 0.1 ? 0.38 : 0.22);

const melody = [293.66, 349.23, 440, 523.25, 440, 349.23, 293.66, 261.63];
for (let index = 0; index < 30; index += 1) {
  const note = melody[index % melody.length] * (index % 11 === 0 ? 0.5 : 1);
  addVoice(2.2 + index * 0.68, 2.6, note, 0.025 + (index % 4) * 0.004, {
    attack: 0.015,
    release: 1.8,
    pan: Math.sin(index * 1.7) * 0.7,
    waveform: "sine",
  });
}

for (let index = 0; index < totalSamples; index += 1) {
  const time = index / sampleRate;
  const shimmer = Math.sin(time * 0.31) * 0.5 + 0.5;
  left[index] += Math.sin(Math.PI * 2 * 587.33 * time) * 0.006 * shimmer;
  right[index] += Math.sin(Math.PI * 2 * 880 * time) * 0.005 * (1 - shimmer);
}

const delayLeft = Math.floor(0.42 * sampleRate);
const delayRight = Math.floor(0.61 * sampleRate);
for (let index = 0; index < totalSamples; index += 1) {
  if (index >= delayLeft) left[index] += right[index - delayLeft] * 0.18;
  if (index >= delayRight) right[index] += left[index - delayRight] * 0.15;
}

let peak = 0;
for (let index = 0; index < totalSamples; index += 1) peak = Math.max(peak, Math.abs(left[index]), Math.abs(right[index]));
const normalise = 0.88 / (peak || 1);
const dataSize = totalSamples * channels * 2;
const buffer = Buffer.alloc(44 + dataSize);
buffer.write("RIFF", 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write("WAVE", 8);
buffer.write("fmt ", 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(channels, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * channels * 2, 28);
buffer.writeUInt16LE(channels * 2, 32);
buffer.writeUInt16LE(16, 34);
buffer.write("data", 36);
buffer.writeUInt32LE(dataSize, 40);

let offset = 44;
for (let index = 0; index < totalSamples; index += 1) {
  const l = clamp(left[index] * normalise, -1, 1);
  const r = clamp(right[index] * normalise, -1, 1);
  buffer.writeInt16LE(Math.round(l * 32767), offset);
  buffer.writeInt16LE(Math.round(r * 32767), offset + 2);
  offset += 4;
}

writeFileSync(new URL("../jason-theme.wav", import.meta.url), buffer);
console.log(`Generated jason-theme.wav (${duration}s, ${(dataSize / 1024 / 1024).toFixed(2)} MB)`);
