// Copyright (C) 2020 John Nesky, distributed under the MIT license.

import {Dictionary, DictionaryArray, EnvelopeType, InstrumentType, Transition, Chord, Envelope, Config, getDrumWave, drawNoiseSpectrum} from "./SynthConfig";
import {scaleElementsByFactor, inverseRealFourierTransform} from "./FFT";


declare global {
	interface Window {
		AudioContext: any;
		webkitAudioContext: any;
	}
}

//namespace beepbox {
	// For performance debugging:
	//let samplesAccumulated: number = 0;
	//let samplePerformance: number = 0;
	
	const enum MessageFlag {
		//
		Command = 'c',
		//
		SongPosition = 'p',
		//
		LoadSong = 's',
		//
	}

	const enum CommandString {
		//
		DeactivateAudio = "d",
		//
		Pause = "p",
		//
		Play = "s",
		//
	}

	const enum CharCode {
		SPACE = 32,
		HASH = 35,
		PERCENT = 37,
		AMPERSAND = 38,
		PLUS = 43,
		DASH = 45,
		DOT = 46,
		NUM_0 = 48,
		NUM_1 = 49,
		NUM_2 = 50,
		NUM_3 = 51,
		NUM_4 = 52,
		NUM_5 = 53,
		NUM_6 = 54,
		NUM_7 = 55,
		NUM_8 = 56,
		NUM_9 = 57,
		EQUALS = 61,
		A =  65,
		B =  66,
		C =  67,
		D =  68,
		E =  69,
		F =  70,
		G =  71,
		H =  72,
		I =  73,
		J =  74,
		K =  75,
		L =  76,
		M =  77,
		N =  78,
		O =  79,
		P =  80,
		Q =  81,
		R =  82,
		S =  83,
		T =  84,
		U =  85,
		V =  86,
		W =  87,
		X =  88,
		Y =  89,
		Z =  90,
		UNDERSCORE = 95,
		a =  97,
		b =  98,
		c =  99,
		d = 100,
		e = 101,
		f = 102,
		g = 103,
		h = 104,
		i = 105,
		j = 106,
		k = 107,
		l = 108,
		m = 109,
		n = 110,
		o = 111,
		p = 112,
		q = 113,
		r = 114,
		s = 115,
		t = 116,
		u = 117,
		v = 118,
		w = 119,
		x = 120,
		y = 121,
		z = 122,
		LEFT_CURLY_BRACE = 123,
		RIGHT_CURLY_BRACE = 125,
	}
	
	const enum SongTagCode {
		beatCount = CharCode.a,
		bars = CharCode.b,
		vibrato = CharCode.c,
		transition = CharCode.d,
		loopEnd = CharCode.e,
		filterCutoff = CharCode.f,
		barCount = CharCode.g,
		interval = CharCode.h,
		instrumentCount = CharCode.i,
		patternCount = CharCode.j,
		key = CharCode.k,
		loopStart = CharCode.l,
		reverb = CharCode.m,
		channelCount = CharCode.n,
		channelOctave = CharCode.o,
		patterns = CharCode.p,
		effects = CharCode.q,
		rhythm = CharCode.r,
		scale = CharCode.s,
		tempo = CharCode.t,
		preset = CharCode.u,
		volume = CharCode.v,
		wave = CharCode.w,
		
		filterResonance = CharCode.y,
		filterEnvelope = CharCode.z,
		algorithm = CharCode.A,
		feedbackAmplitude = CharCode.B,
		chord = CharCode.C,
		
		operatorEnvelopes = CharCode.E,
		feedbackType = CharCode.F,
		
		harmonics = CharCode.H,
		pan = CharCode.L,
		
		operatorAmplitudes = CharCode.P,
		operatorFrequencies = CharCode.Q,
		
		spectrum = CharCode.S,
		startInstrument = CharCode.T,
		
		feedbackEnvelope = CharCode.V,
		pulseWidth = CharCode.W,
	}
	
	const base64IntToCharCode: ReadonlyArray<number> = [48,49,50,51,52,53,54,55,56,57,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,45,95];
	const base64CharCodeToInt: ReadonlyArray<number> = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,62,62,0,0,1,2,3,4,5,6,7,8,9,0,0,0,0,0,0,0,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,0,0,0,0,63,0,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,0,0,0,0,0]; // 62 could be represented by either "-" or "." for historical reasons. New songs should use "-".
	
	class BitFieldReader {
		private _bits: number[] = [];
		private _readIndex: number = 0;
		
		constructor(source: string, startIndex: number, stopIndex: number) {
			for (let i: number = startIndex; i < stopIndex; i++) {
				const value: number = base64CharCodeToInt[source.charCodeAt(i)];
				this._bits.push((value >> 5) & 0x1);
				this._bits.push((value >> 4) & 0x1);
				this._bits.push((value >> 3) & 0x1);
				this._bits.push((value >> 2) & 0x1);
				this._bits.push((value >> 1) & 0x1);
				this._bits.push( value       & 0x1);
			}
		}
		
		public read(bitCount: number): number {
			let result: number = 0;
			while (bitCount > 0) {
				result = result << 1;
				result += this._bits[this._readIndex++];
				bitCount--;
			}
			return result;
		}
		
		public readLongTail(minValue: number, minBits: number): number {
			let result: number = minValue;
			let numBits: number = minBits;
			while (this._bits[this._readIndex++]) {
				result += 1 << numBits;
				numBits++;
			}
			while (numBits > 0) {
				numBits--;
				if (this._bits[this._readIndex++]) {
					result += 1 << numBits;
				}
			}
			return result;
		}
		
		public readPartDuration(): number {
			return this.readLongTail(1, 3);
		}
		
		public readLegacyPartDuration(): number {
			return this.readLongTail(1, 2);
		}
		
		public readPinCount(): number {
			return this.readLongTail(1, 0);
		}
		
		public readPitchInterval(): number {
			if (this.read(1)) {
				return -this.readLongTail(1, 3);
			} else {
				return this.readLongTail(1, 3);
			}
		}
	}
	
	class BitFieldWriter {
		private _index: number = 0;
		private _bits: number[] = [];
		
		public clear() {
			this._index = 0;
		}
		
		public write(bitCount: number, value: number): void {
			bitCount--;
			while (bitCount >= 0) {
				this._bits[this._index++] = (value >>> bitCount) & 1;
				bitCount--;
			}
		}
		
		public writeLongTail(minValue: number, minBits: number, value: number): void {
			if (value < minValue) throw new Error("value out of bounds");
			value -= minValue;
			let numBits: number = minBits;
			while (value >= (1 << numBits)) {
				this._bits[this._index++] = 1;
				value -= 1 << numBits;
				numBits++;
			}
			this._bits[this._index++] = 0;
			while (numBits > 0) {
				numBits--;
				this._bits[this._index++] = (value >>> numBits) & 1;
			}
		}
		
		public writePartDuration(value: number): void {
			this.writeLongTail(1, 3, value);
		}
		
		public writePinCount(value: number): void {
			this.writeLongTail(1, 0, value);
		}
		
		public writePitchInterval(value: number): void {
			if (value < 0) {
				this.write(1, 1); // sign
				this.writeLongTail(1, 3, -value);
			} else {
				this.write(1, 0); // sign
				this.writeLongTail(1, 3, value);
			}
		}
		
		public concat(other: BitFieldWriter): void {
			for (let i: number = 0; i < other._index; i++) {
				this._bits[this._index++] = other._bits[i];
			}
		}
		
		public encodeBase64(buffer: number[]): number[] {
			for (let i: number = 0; i < this._index; i += 6) {
				const value: number = (this._bits[i] << 5) | (this._bits[i+1] << 4) | (this._bits[i+2] << 3) | (this._bits[i+3] << 2) | (this._bits[i+4] << 1) | this._bits[i+5];
				buffer.push(base64IntToCharCode[value]);
			}
			return buffer;
		}
		
		public lengthBase64(): number {
			return Math.ceil(this._index / 6);
		}
	}
	
	export interface NotePin {
		interval: number;
		time: number;
		volume: number;
	}
	
	export function makeNotePin(interval: number, time: number, volume: number): NotePin {
		return {interval: interval, time: time, volume: volume};
	}
	
	function clamp(min: number, max: number, val: number): number {
		max = max - 1;
		if (val <= max) {
			if (val >= min) return val;
			else return min;
		} else {
			return max;
		}
	}
	
	function validateRange(min: number, max: number, val: number): number {
		if (min <= val && val <= max) return val;
		throw new Error(`Value ${val} not in range [${min}, ${max}]`);
	}
	
	export class Note {
		public pitches: number[];
		public pins: NotePin[];
		public start: number;
		public end: number;
		
		public constructor(pitch: number, start: number, end: number, volume: number, fadeout: boolean = false) {
			this.pitches = [pitch];
			this.pins = [makeNotePin(0, 0, volume), makeNotePin(0, end - start, fadeout ? 0 : volume)];
			this.start = start;
			this.end = end;
		}
		
		public pickMainInterval(): number {
			let longestFlatIntervalDuration: number = 0;
			let mainInterval: number = 0;
			for (let pinIndex: number = 1; pinIndex < this.pins.length; pinIndex++) {
				const pinA: NotePin = this.pins[pinIndex - 1];
				const pinB: NotePin = this.pins[pinIndex];
				if (pinA.interval == pinB.interval) {
					const duration: number = pinB.time - pinA.time;
					if (longestFlatIntervalDuration < duration) {
						longestFlatIntervalDuration = duration;
						mainInterval = pinA.interval;
					}
				}
			}
			if (longestFlatIntervalDuration == 0) {
				let loudestVolume: number = 0;
				for (let pinIndex: number = 0; pinIndex < this.pins.length; pinIndex++) {
					const pin: NotePin = this.pins[pinIndex];
					if (loudestVolume < pin.volume) {
						loudestVolume = pin.volume;
						mainInterval = pin.interval;
					}
				}
			}
			return mainInterval;
		}
		
		public clone(): Note {
			const newNote: Note = new Note(-1, this.start, this.end, 3);
			newNote.pitches = this.pitches.concat();
			newNote.pins = [];
			for (const pin of this.pins) {
				newNote.pins.push(makeNotePin(pin.interval, pin.time, pin.volume));
			}
			return newNote;
		}
	}
	
	export class Pattern {
		public notes: Note[] = [];
		public instrument: number = 0;
		
		public cloneNotes(): Note[] {
			const result: Note[] = [];
			for (const note of this.notes) {
				result.push(note.clone());
			}
			return result;
		}
		
		public reset(): void {
			this.notes.length = 0;
			this.instrument = 0;
		}
	}
	
	export class Operator {
		public frequency: number = 0;
		public amplitude: number = 0;
		public envelope: number = 0;
		
		constructor(index: number) {
			this.reset(index);
		}
		
		public reset(index: number): void {
			this.frequency = 0;
			this.amplitude = (index <= 1) ? Config.operatorAmplitudeMax : 0;
			this.envelope = (index == 0) ? 0 : 1;
		}
	}
	
	export class SpectrumWave {
		public spectrum: number[] = [];
		private _wave: Float32Array | null = null;
		private _waveIsReady: boolean = false;
		
		constructor(isNoiseChannel: boolean) {
			this.reset(isNoiseChannel);
		}
		
		public reset(isNoiseChannel: boolean): void {
			for (let i: number = 0; i < Config.spectrumControlPoints; i++) {
				if (isNoiseChannel) {
					this.spectrum[i] = Math.round(Config.spectrumMax * (1 / Math.sqrt(1 + i / 3)));
				} else {
					const isHarmonic: boolean = i==0 || i==7 || i==11 || i==14 || i==16 || i==18 || i==21 || i==23 || i>=25;
					this.spectrum[i] = isHarmonic ? Math.max(0, Math.round(Config.spectrumMax * (1 - i / 30))) : 0;
				}
			}
			this._waveIsReady = false;
		}
		
		public markCustomWaveDirty(): void {
			this._waveIsReady = false;
		}
		
		public getCustomWave(lowestOctave: number): Float32Array {
			if (!this._waveIsReady || this._wave == null) {
				let waveLength: number = Config.chipNoiseLength;
				
				if (this._wave == null || this._wave.length != waveLength + 1) {
					this._wave = new Float32Array(waveLength + 1);
				}
				const wave: Float32Array = this._wave;
				
				for (let i: number = 0; i < waveLength; i++) {
					wave[i] = 0;
				}
				
				const highestOctave: number = 14;
				const falloffRatio: number = 0.25;
				// Nudge the 2/7 and 4/7 control points so that they form harmonic intervals.
				const pitchTweak: number[] = [0, 1/7, Math.log(5/4)/Math.LN2, 3/7, Math.log(3/2)/Math.LN2, 5/7, 6/7];
				function controlPointToOctave(point: number): number {
					return lowestOctave + Math.floor(point / Config.spectrumControlPointsPerOctave) + pitchTweak[(point + Config.spectrumControlPointsPerOctave) % Config.spectrumControlPointsPerOctave];
				}
				
				let combinedAmplitude: number = 1;
				for (let i: number = 0; i < Config.spectrumControlPoints + 1; i++) {
					const value1: number = (i <= 0) ? 0 : this.spectrum[i - 1];
					const value2: number = (i >= Config.spectrumControlPoints) ? this.spectrum[Config.spectrumControlPoints - 1] : this.spectrum[i];
					const octave1: number = controlPointToOctave(i - 1);
					let octave2: number = controlPointToOctave(i);
					if (i >= Config.spectrumControlPoints) octave2 = highestOctave + (octave2 - highestOctave) * falloffRatio;
					if (value1 == 0 && value2 == 0) continue;
					
					combinedAmplitude += 0.02 * drawNoiseSpectrum(wave, octave1, octave2, value1 / Config.spectrumMax, value2 / Config.spectrumMax, -0.5);
				}
				if (this.spectrum[Config.spectrumControlPoints - 1] > 0) {
					combinedAmplitude += 0.02 * drawNoiseSpectrum(wave, highestOctave + (controlPointToOctave(Config.spectrumControlPoints) - highestOctave) * falloffRatio, highestOctave, this.spectrum[Config.spectrumControlPoints - 1] / Config.spectrumMax, 0, -0.5);
				}
				
				inverseRealFourierTransform(wave, waveLength);
				scaleElementsByFactor(wave, 5.0 / (Math.sqrt(waveLength) * Math.pow(combinedAmplitude, 0.75)));
				
				// Duplicate the first sample at the end for easier wrap-around interpolation.
				wave[waveLength] = wave[0];
				
				this._waveIsReady = true;
			}
			return this._wave;
		}
	}
	
	export class HarmonicsWave {
		public harmonics: number[] = [];
		private _wave: Float32Array | null = null;
		private _waveIsReady: boolean = false;
		
		constructor() {
			this.reset();
		}
		
		public reset(): void {
			for (let i: number = 0; i < Config.harmonicsControlPoints; i++) {
				this.harmonics[i] = 0;
			}
			this.harmonics[0] = Config.harmonicsMax;
			this.harmonics[3] = Config.harmonicsMax;
			this.harmonics[6] = Config.harmonicsMax;
			this._waveIsReady = false;
		}
		
		public markCustomWaveDirty(): void {
			this._waveIsReady = false;
		}
		
		public getCustomWave(): Float32Array {
			if (!this._waveIsReady || this._wave == null) {
				let waveLength: number = Config.harmonicsWavelength;
				const retroWave: Float32Array = getDrumWave(0);
				
				if (this._wave == null || this._wave.length != waveLength + 1) {
					this._wave = new Float32Array(waveLength + 1);
				}
				const wave: Float32Array = this._wave;
				
				for (let i: number = 0; i < waveLength; i++) {
					wave[i] = 0;
				}
				
				const overallSlope: number = -0.25;
				let combinedControlPointAmplitude: number = 1;
				
				for (let harmonicIndex: number = 0; harmonicIndex < Config.harmonicsRendered; harmonicIndex++) {
					const harmonicFreq: number = harmonicIndex + 1;
					let controlValue: number = harmonicIndex < Config.harmonicsControlPoints ? this.harmonics[harmonicIndex] : this.harmonics[Config.harmonicsControlPoints - 1];
					if (harmonicIndex >= Config.harmonicsControlPoints) {
						controlValue *= 1 - (harmonicIndex - Config.harmonicsControlPoints) / (Config.harmonicsRendered - Config.harmonicsControlPoints);
					}
					const normalizedValue: number = controlValue / Config.harmonicsMax;
					let amplitude: number = Math.pow(2, controlValue - Config.harmonicsMax + 1) * Math.sqrt(normalizedValue);
					if (harmonicIndex < Config.harmonicsControlPoints) {
						combinedControlPointAmplitude += amplitude;
					}
					amplitude *= Math.pow(harmonicFreq, overallSlope);
					
					// Multiple all the sine wave amplitudes by 1 or -1 based on the LFSR
					// retro wave (effectively random) to avoid egregiously tall spikes.
					amplitude *= retroWave[harmonicIndex + 589];
					
					wave[waveLength - harmonicFreq] = amplitude;
				}
				
				inverseRealFourierTransform(wave, waveLength);
				
				// Limit the maximum wave amplitude.
				const mult: number = 1 / Math.pow(combinedControlPointAmplitude, 0.7);
				
				// Perform the integral on the wave. The chipSynth will perform the derivative to get the original wave back but with antialiasing.
				let cumulative: number = 0;
				let wavePrev: number = 0;
				for (let i: number = 0; i < wave.length; i++) {
					cumulative += wavePrev;
					wavePrev = wave[i] * mult;
					wave[i] = cumulative;
				}
				// The first sample should be zero, and we'll duplicate it at the end for easier interpolation.
				wave[waveLength] = wave[0];
				
				this._waveIsReady = true;
			}
			return this._wave;
		}
	}
	
	export class Instrument {
		public type: InstrumentType = InstrumentType.chip;
		public preset: number = 0;
		public chipWave: number = 2;
		public chipNoise: number = 1;
		public filterCutoff: number = 6;
		public filterResonance: number = 0;
		public filterEnvelope: number = 1;
		public transition: number = 1;
		public vibrato: number = 0;
		public interval: number = 0;
		public effects: number = 0;
		public chord: number = 1;
		public volume: number = 0;
		public pan: number = Config.panCenter;
		public pulseWidth: number = Config.pulseWidthRange - 1;
		public pulseEnvelope: number = 1;
		public algorithm: number = 0;
		public feedbackType: number = 0;
		public feedbackAmplitude: number = 0;
		public feedbackEnvelope: number = 1;
		public readonly operators: Operator[] = [];
		public readonly spectrumWave: SpectrumWave;
		public readonly harmonicsWave: HarmonicsWave = new HarmonicsWave();
		public readonly drumsetEnvelopes: number[] = [];
		public readonly drumsetSpectrumWaves: SpectrumWave[] = [];
		
		constructor(isNoiseChannel: boolean) {
			this.spectrumWave = new SpectrumWave(isNoiseChannel);
			for (let i: number = 0; i < Config.operatorCount; i++) {
				this.operators[i] = new Operator(i);
			}
			for (let i: number = 0; i < Config.drumCount; i++) {
				this.drumsetEnvelopes[i] = Config.envelopes.dictionary["twang 2"].index;
				this.drumsetSpectrumWaves[i] = new SpectrumWave(true);
			}
		}
		
		public setTypeAndReset(type: InstrumentType, isNoiseChannel: boolean): void {
			this.type = type;
			this.preset = type;
			this.volume = 0;
			this.pan = Config.panCenter;
			switch (type) {
				case InstrumentType.chip:
					this.chipWave = 2;
					this.filterCutoff = 6;
					this.filterResonance = 0;
					this.filterEnvelope = Config.envelopes.dictionary["steady"].index;
					this.transition = 1;
					this.vibrato = 0;
					this.interval = 0;
					this.effects = 1;
					this.chord = 2;
					break;
				case InstrumentType.fm:
					this.transition = 1;
					this.vibrato = 0;
					this.effects = 1;
					this.chord = 3;
					this.filterCutoff = 10;
					this.filterResonance = 0;
					this.filterEnvelope = 1;
					this.algorithm = 0;
					this.feedbackType = 0;
					this.feedbackAmplitude = 0;
					this.feedbackEnvelope = Config.envelopes.dictionary["steady"].index;
					for (let i: number = 0; i < this.operators.length; i++) {
						this.operators[i].reset(i);
					}
					break;
				case InstrumentType.noise:
					this.chipNoise = 1;
					this.transition = 1;
					this.effects = 0;
					this.chord = 2;
					this.filterCutoff = 10;
					this.filterResonance = 0;
					this.filterEnvelope = Config.envelopes.dictionary["steady"].index;
					break;
				case InstrumentType.spectrum:
					this.transition = 1;
					this.effects = 1;
					this.chord = 0;
					this.filterCutoff = 10;
					this.filterResonance = 0;
					this.filterEnvelope = Config.envelopes.dictionary["steady"].index;
					this.spectrumWave.reset(isNoiseChannel);
					break;
				case InstrumentType.drumset:
					this.effects = 0;
					for (let i: number = 0; i < Config.drumCount; i++) {
						this.drumsetEnvelopes[i] = Config.envelopes.dictionary["twang 2"].index;
						this.drumsetSpectrumWaves[i].reset(isNoiseChannel);
					}
					break;
				case InstrumentType.harmonics:
					this.filterCutoff = 10;
					this.filterResonance = 0;
					this.filterEnvelope = Config.envelopes.dictionary["steady"].index;
					this.transition = 1;
					this.vibrato = 0;
					this.interval = 0;
					this.effects = 1;
					this.chord = 0;
					this.harmonicsWave.reset();
					break;
				case InstrumentType.pwm:
					this.filterCutoff = 10;
					this.filterResonance = 0;
					this.filterEnvelope = Config.envelopes.dictionary["steady"].index;
					this.transition = 1;
					this.vibrato = 0;
					this.interval = 0;
					this.effects = 1;
					this.chord = 2;
					this.pulseWidth = Config.pulseWidthRange - 1;
					this.pulseEnvelope = Config.envelopes.dictionary["twang 2"].index;
					break;
				default:
					throw new Error("Unrecognized instrument type: " + type);
			}
		}
		
		public toJsonObject(): Object {
			const instrumentObject: any = {
				"type": Config.instrumentTypeNames[this.type],
				"volume": (5 - this.volume) * 20,
				"pan": (this.pan - Config.panCenter) * 100 / Config.panCenter,
				"effects": Config.effectsNames[this.effects],
			};
			
			if (this.preset != this.type) {
				instrumentObject["preset"] = this.preset;
			}
			
			if (this.type != InstrumentType.drumset) {
				instrumentObject["transition"] = Config.transitions[this.transition].name;
				instrumentObject["chord"] = this.getChord().name;
				instrumentObject["filterCutoffHz"] = Math.round(Config.filterCutoffMaxHz * Math.pow(2.0, this.getFilterCutoffOctaves()));
				instrumentObject["filterResonance"] = Math.round(100 * this.filterResonance / (Config.filterResonanceRange - 1));
				instrumentObject["filterEnvelope"] = this.getFilterEnvelope().name;
			}
			
			if (this.type == InstrumentType.noise) {
				instrumentObject["wave"] = Config.chipNoises[this.chipNoise].name;
			} else if (this.type == InstrumentType.spectrum) {
				instrumentObject["spectrum"] = [];
				for (let i: number = 0; i < Config.spectrumControlPoints; i++) {
					instrumentObject["spectrum"][i] = Math.round(100 * this.spectrumWave.spectrum[i] / Config.spectrumMax);
				}
			} else if (this.type == InstrumentType.drumset) {
				instrumentObject["drums"] = [];
				for (let j: number = 0; j < Config.drumCount; j++) {
					const spectrum: number[] = [];
					for (let i: number = 0; i < Config.spectrumControlPoints; i++) {
						spectrum[i] = Math.round(100 * this.drumsetSpectrumWaves[j].spectrum[i] / Config.spectrumMax);
					}
					instrumentObject["drums"][j] = {
						"filterEnvelope": this.getDrumsetEnvelope(j).name,
						"spectrum": spectrum,
					};
				}
			} else if (this.type == InstrumentType.chip) {
				instrumentObject["wave"] = Config.chipWaves[this.chipWave].name;
				instrumentObject["interval"] = Config.intervals[this.interval].name;
				instrumentObject["vibrato"] = Config.vibratos[this.vibrato].name;
			} else if (this.type == InstrumentType.pwm) {
				instrumentObject["pulseWidth"] = Math.round(Math.pow(0.5, (Config.pulseWidthRange - this.pulseWidth - 1) * 0.5) * 50 * 32) / 32;
				instrumentObject["pulseEnvelope"] = Config.envelopes[this.pulseEnvelope].name;
				instrumentObject["vibrato"] = Config.vibratos[this.vibrato].name;
			} else if (this.type == InstrumentType.harmonics) {
				instrumentObject["interval"] = Config.intervals[this.interval].name;
				instrumentObject["vibrato"] = Config.vibratos[this.vibrato].name;
				instrumentObject["harmonics"] = [];
				for (let i: number = 0; i < Config.harmonicsControlPoints; i++) {
					instrumentObject["harmonics"][i] = Math.round(100 * this.harmonicsWave.harmonics[i] / Config.harmonicsMax);
				}
			} else if (this.type == InstrumentType.fm) {
				const operatorArray: Object[] = [];
				for (const operator of this.operators) {
					operatorArray.push({
						"frequency": Config.operatorFrequencies[operator.frequency].name,
						"amplitude": operator.amplitude,
						"envelope": Config.envelopes[operator.envelope].name,
					});
				}
				instrumentObject["vibrato"] = Config.vibratos[this.vibrato].name;
				instrumentObject["algorithm"] = Config.algorithms[this.algorithm].name;
				instrumentObject["feedbackType"] = Config.feedbacks[this.feedbackType].name;
				instrumentObject["feedbackAmplitude"] = this.feedbackAmplitude;
				instrumentObject["feedbackEnvelope"] = Config.envelopes[this.feedbackEnvelope].name;
				instrumentObject["operators"] = operatorArray;
			} else {
				throw new Error("Unrecognized instrument type");
			}
			return instrumentObject;
		}
		
		public fromJsonObject(instrumentObject: any, isNoiseChannel: boolean): void {
			if (instrumentObject == undefined) instrumentObject = {};
			
			let type: InstrumentType = Config.instrumentTypeNames.indexOf(instrumentObject["type"]);
			if (type == -1) type = isNoiseChannel ? InstrumentType.noise : InstrumentType.chip;
			this.setTypeAndReset(type, isNoiseChannel);
			
			if (instrumentObject["preset"] != undefined) {
				this.preset = instrumentObject["preset"] >>> 0;
			}
			
			if (instrumentObject["volume"] != undefined) {
				this.volume = clamp(0, Config.volumeRange, Math.round(5 - (instrumentObject["volume"] | 0) / 20));
			} else {
				this.volume = 0;
			}
			
			if (instrumentObject["pan"] != undefined) {
				this.pan = clamp(0, Config.panMax + 1, Math.round(Config.panCenter + (instrumentObject["pan"] | 0) * Config.panCenter / 100));
			} else {
				this.pan = Config.panCenter;
			}
			
			const oldTransitionNames: Dictionary<number> = {"binary": 0, "sudden": 1, "smooth": 2};
			const transitionObject = instrumentObject["transition"] || instrumentObject["envelope"]; // the transition property used to be called envelope, so try that too.
			this.transition = oldTransitionNames[transitionObject] != undefined ? oldTransitionNames[transitionObject] : Config.transitions.findIndex(transition=>transition.name==transitionObject);
			if (this.transition == -1) this.transition = 1;
			
			this.effects = Config.effectsNames.indexOf(instrumentObject["effects"]);
			if (this.effects == -1) this.effects = (this.type == InstrumentType.noise) ? 0 : 1;
			
			if (instrumentObject["filterCutoffHz"] != undefined) {
				this.filterCutoff = clamp(0, Config.filterCutoffRange, Math.round((Config.filterCutoffRange - 1) + 2.0 * Math.log((instrumentObject["filterCutoffHz"] | 0) / Config.filterCutoffMaxHz) / Math.LN2));
			} else {
				this.filterCutoff = (this.type == InstrumentType.chip) ? 6 : 10;
			}
			if (instrumentObject["filterResonance"] != undefined) {
				this.filterResonance = clamp(0, Config.filterResonanceRange, Math.round((Config.filterResonanceRange - 1) * (instrumentObject["filterResonance"] | 0) / 100));
			} else {
				this.filterResonance = 0;
			}
			this.filterEnvelope = Config.envelopes.findIndex(envelope=>envelope.name == instrumentObject["filterEnvelope"]);
			if (this.filterEnvelope == -1) this.filterEnvelope = Config.envelopes.dictionary["steady"].index;
			
			if (instrumentObject["filter"] != undefined) {
				const legacyToCutoff: number[] = [10, 6, 3, 0, 8, 5, 2];
				const legacyToEnvelope: number[] = [1, 1, 1, 1, 18, 19, 20];
				const filterNames: string[] = ["none", "bright", "medium", "soft", "decay bright", "decay medium", "decay soft"];
				const oldFilterNames: Dictionary<number> = {"sustain sharp": 1, "sustain medium": 2, "sustain soft": 3, "decay sharp": 4};
				let legacyFilter: number = oldFilterNames[instrumentObject["filter"]] != undefined ? oldFilterNames[instrumentObject["filter"]] : filterNames.indexOf(instrumentObject["filter"]);
				if (legacyFilter == -1) legacyFilter = 0;
				this.filterCutoff = legacyToCutoff[legacyFilter];
				this.filterEnvelope = legacyToEnvelope[legacyFilter];
				this.filterResonance = 0;
			}
			
			const legacyEffectNames: ReadonlyArray<string> = ["none", "vibrato light", "vibrato delayed", "vibrato heavy"];
			if (this.type == InstrumentType.noise) {
				this.chipNoise = Config.chipNoises.findIndex(wave=>wave.name==instrumentObject["wave"]);
				if (this.chipNoise == -1) this.chipNoise = 1;

				this.chord = Config.chords.findIndex(chord=>chord.name==instrumentObject["chord"]);
				if (this.chord == -1) this.chord = 2;

			} else if (this.type == InstrumentType.spectrum) {
				if (instrumentObject["spectrum"] != undefined) {
					for (let i: number = 0; i < Config.spectrumControlPoints; i++) {
						this.spectrumWave.spectrum[i] = Math.max(0, Math.min(Config.spectrumMax, Math.round(Config.spectrumMax * (+instrumentObject["spectrum"][i]) / 100)));
					}
				}
				
				this.chord = Config.chords.findIndex(chord=>chord.name==instrumentObject["chord"]);
				if (this.chord == -1) this.chord = 0;
				
			} else if (this.type == InstrumentType.drumset) {
				if (instrumentObject["drums"] != undefined) {
					for (let j: number = 0; j < Config.drumCount; j++) {
						const drum: any = instrumentObject["drums"][j];
						if (drum == undefined) continue;
						
						if (drum["filterEnvelope"] != undefined) {
							this.drumsetEnvelopes[j] = Config.envelopes.findIndex(envelope=>envelope.name == drum["filterEnvelope"]);
							if (this.drumsetEnvelopes[j] == -1) this.drumsetEnvelopes[j] = Config.envelopes.dictionary["twang 2"].index;
						}
						if (drum["spectrum"] != undefined) {
							for (let i: number = 0; i < Config.spectrumControlPoints; i++) {
								this.drumsetSpectrumWaves[j].spectrum[i] = Math.max(0, Math.min(Config.spectrumMax, Math.round(Config.spectrumMax * (+drum["spectrum"][i]) / 100)));
							}
						}
					}
				}
			} else if (this.type == InstrumentType.harmonics) {
				if (instrumentObject["harmonics"] != undefined) {
					for (let i: number = 0; i < Config.harmonicsControlPoints; i++) {
						this.harmonicsWave.harmonics[i] = Math.max(0, Math.min(Config.harmonicsMax, Math.round(Config.harmonicsMax * (+instrumentObject["harmonics"][i]) / 100)));
					}
				}
				
				if (instrumentObject["interval"] != undefined) {
					this.interval = Config.intervals.findIndex(interval=>interval.name==instrumentObject["interval"]);
					if (this.interval == -1) this.interval = 0;
				}
				
				if (instrumentObject["vibrato"] != undefined) {
					this.vibrato = Config.vibratos.findIndex(vibrato=>vibrato.name==instrumentObject["vibrato"]);
					if (this.vibrato == -1) this.vibrato = 0;
				}
				
				this.chord = Config.chords.findIndex(chord=>chord.name==instrumentObject["chord"]);
				if (this.chord == -1) this.chord = 0;
			} else if (this.type == InstrumentType.pwm) {
				if (instrumentObject["pulseWidth"] != undefined) {
					this.pulseWidth = clamp(0, Config.pulseWidthRange, Math.round((Math.log((+instrumentObject["pulseWidth"]) / 50) / Math.LN2) / 0.5 - 1 + 8));
				} else {
					this.pulseWidth = Config.pulseWidthRange - 1;
				}
				
				if (instrumentObject["pulseEnvelope"] != undefined) {
					this.pulseEnvelope = Config.envelopes.findIndex(envelope=>envelope.name == instrumentObject["pulseEnvelope"]);
					if (this.pulseEnvelope == -1) this.pulseEnvelope = Config.envelopes.dictionary["steady"].index;
				}
				
				if (instrumentObject["vibrato"] != undefined) {
					this.vibrato = Config.vibratos.findIndex(vibrato=>vibrato.name==instrumentObject["vibrato"]);
					if (this.vibrato == -1) this.vibrato = 0;
				}
				
				this.chord = Config.chords.findIndex(chord=>chord.name==instrumentObject["chord"]);
				if (this.chord == -1) this.chord = 0;
			} else if (this.type == InstrumentType.chip) {
				const legacyWaveNames: Dictionary<number> = {"triangle": 1, "square": 2, "pulse wide": 3, "pulse narrow": 4, "sawtooth": 5, "double saw": 6, "double pulse": 7, "spiky": 8, "plateau": 0};
				this.chipWave = legacyWaveNames[instrumentObject["wave"]] != undefined ? legacyWaveNames[instrumentObject["wave"]] : Config.chipWaves.findIndex(wave=>wave.name==instrumentObject["wave"]);
				if (this.chipWave == -1) this.chipWave = 1;

				if (instrumentObject["interval"] != undefined) {
					this.interval = Config.intervals.findIndex(interval=>interval.name==instrumentObject["interval"]);
					if (this.interval == -1) this.interval = 0;
				} else if (instrumentObject["chorus"] != undefined) {
					const legacyChorusNames: Dictionary<number> = {"fifths": 5, "octaves": 6};
					this.interval = legacyChorusNames[instrumentObject["chorus"]] != undefined ? legacyChorusNames[instrumentObject["chorus"]] : Config.intervals.findIndex(interval=>interval.name==instrumentObject["chorus"]);
					if (this.interval == -1) this.interval = 0;
				}
				
				if (instrumentObject["vibrato"] != undefined) {
					this.vibrato = Config.vibratos.findIndex(vibrato=>vibrato.name==instrumentObject["vibrato"]);
					if (this.vibrato == -1) this.vibrato = 0;
				} else if (instrumentObject["effect"] != undefined) {
					this.vibrato = legacyEffectNames.indexOf(instrumentObject["effect"]);
					if (this.vibrato == -1) this.vibrato = 0;
				}
				
				this.chord = Config.chords.findIndex(chord=>chord.name==instrumentObject["chord"]);
				if (this.chord == -1) this.chord = 2;

				// The original chorus setting had an option that now maps to two different settings. Override those if necessary.
				if (instrumentObject["chorus"] == "custom harmony") {
					this.interval = 2;
					this.chord = 3;
				}
			} else if (this.type == InstrumentType.fm) {
				if (instrumentObject["vibrato"] != undefined) {
					this.vibrato = Config.vibratos.findIndex(vibrato=>vibrato.name==instrumentObject["vibrato"]);
					if (this.vibrato == -1) this.vibrato = 0;
				} else if (instrumentObject["effect"] != undefined) {
					this.vibrato = legacyEffectNames.indexOf(instrumentObject["effect"]);
					if (this.vibrato == -1) this.vibrato = 0;
				}
				
				this.chord = Config.chords.findIndex(chord=>chord.name==instrumentObject["chord"]);
				if (this.chord == -1) this.chord = 3;

				this.algorithm = Config.algorithms.findIndex(algorithm=>algorithm.name==instrumentObject["algorithm"]);
				if (this.algorithm == -1) this.algorithm = 0;
				this.feedbackType = Config.feedbacks.findIndex(feedback=>feedback.name==instrumentObject["feedbackType"]);
				if (this.feedbackType == -1) this.feedbackType = 0;
				if (instrumentObject["feedbackAmplitude"] != undefined) {
					this.feedbackAmplitude = clamp(0, Config.operatorAmplitudeMax + 1, instrumentObject["feedbackAmplitude"] | 0);
				} else {
					this.feedbackAmplitude = 0;
				}
				
				const legacyEnvelopeNames: Dictionary<number> = {"pluck 1": 6, "pluck 2": 7, "pluck 3": 8};
				this.feedbackEnvelope = legacyEnvelopeNames[instrumentObject["feedbackEnvelope"]] != undefined ? legacyEnvelopeNames[instrumentObject["feedbackEnvelope"]] : Config.envelopes.findIndex(envelope=>envelope.name==instrumentObject["feedbackEnvelope"]);
				if (this.feedbackEnvelope == -1) this.feedbackEnvelope = 0;
				
				for (let j: number = 0; j < Config.operatorCount; j++) {
					const operator: Operator = this.operators[j];
					let operatorObject: any = undefined;
					if (instrumentObject["operators"]) operatorObject = instrumentObject["operators"][j];
					if (operatorObject == undefined) operatorObject = {};
					
					operator.frequency = Config.operatorFrequencies.findIndex(freq=>freq.name==operatorObject["frequency"]);
					if (operator.frequency == -1) operator.frequency = 0;
					if (operatorObject["amplitude"] != undefined) {
						operator.amplitude = clamp(0, Config.operatorAmplitudeMax + 1, operatorObject["amplitude"] | 0);
					} else {
						operator.amplitude = 0;
					}
					operator.envelope = legacyEnvelopeNames[operatorObject["envelope"]] != undefined ? legacyEnvelopeNames[operatorObject["envelope"]] : Config.envelopes.findIndex(envelope=>envelope.name==operatorObject["envelope"]);
					if (operator.envelope == -1) operator.envelope = 0;
				}
			} else {
				throw new Error("Unrecognized instrument type.");
			}
		}
		
		public static frequencyFromPitch(pitch: number): number {
			return 440.0 * Math.pow(2.0, (pitch - 69.0) / 12.0);
		}
		
		public static drumsetIndexReferenceDelta(index: number): number {
			return Instrument.frequencyFromPitch(Config.spectrumBasePitch + index * 6) / 44100;
		}
		
		private static _drumsetIndexToSpectrumOctave(index: number) {
			return 15 + Math.log(Instrument.drumsetIndexReferenceDelta(index)) / Math.LN2;
		}
		
		public warmUp(): void {
			if (this.type == InstrumentType.noise) {
				getDrumWave(this.chipNoise, inverseRealFourierTransform, scaleElementsByFactor);
			} else if (this.type == InstrumentType.harmonics) {
				this.harmonicsWave.getCustomWave();
			} else if (this.type == InstrumentType.spectrum) {
				this.spectrumWave.getCustomWave(8);
			} else if (this.type == InstrumentType.drumset) {
				for (let i: number = 0; i < Config.drumCount; i++) {
					this.drumsetSpectrumWaves[i].getCustomWave(Instrument._drumsetIndexToSpectrumOctave(i));
				}
			}
		}
		
		public getDrumWave(): Float32Array {
			if (this.type == InstrumentType.noise) {
				return getDrumWave(this.chipNoise, inverseRealFourierTransform, scaleElementsByFactor);
			} else if (this.type == InstrumentType.spectrum) {
				return this.spectrumWave.getCustomWave(8);
			} else {
				throw new Error("Unhandled instrument type in getDrumWave");
			}
		}
		
		public getDrumsetWave(pitch: number): Float32Array {
			if (this.type == InstrumentType.drumset) {
				return this.drumsetSpectrumWaves[pitch].getCustomWave(Instrument._drumsetIndexToSpectrumOctave(pitch));
			} else {
				throw new Error("Unhandled instrument type in getDrumWave");
			}
		}
		
		public getTransition(): Transition {
			return this.type == InstrumentType.drumset ? Config.transitions.dictionary["hard fade"] : Config.transitions[this.transition];
		}
		public getChord(): Chord {
			return this.type == InstrumentType.drumset ? Config.chords.dictionary["harmony"] : Config.chords[this.chord];
		}
		public getFilterCutoffOctaves(): number {
			return this.type == InstrumentType.drumset ? 0 : (this.filterCutoff - (Config.filterCutoffRange - 1)) * 0.5;
		}
		public getFilterIsFirstOrder(): boolean {
			return this.type == InstrumentType.drumset ? false : this.filterResonance == 0;
		}
		public getFilterResonance(): number {
			return this.type == InstrumentType.drumset ? 1 : this.filterResonance;
		}
		public getFilterEnvelope(): Envelope {
			if (this.type == InstrumentType.drumset) throw new Error("Can't getFilterEnvelope() for drumset.");
			return Config.envelopes[this.filterEnvelope];
		}
		public getDrumsetEnvelope(pitch: number): Envelope {
			if (this.type != InstrumentType.drumset) throw new Error("Can't getDrumsetEnvelope() for non-drumset.");
			return Config.envelopes[this.drumsetEnvelopes[pitch]];
		}
	}
	
	export class Channel {
		public octave: number = 0;
		public readonly instruments: Instrument[] = [];
		public readonly patterns: Pattern[] = [];
		public readonly bars: number[] = [];
		public muted: boolean = false;
	}
	
	export class Song {
		private static readonly _format: string = "BeepBox";
		private static readonly _oldestVersion: number = 2;
		private static readonly _latestVersion: number = 8;
		
		public scale: number;
		public key: number;
		public tempo: number;
		public reverb: number;
		public beatsPerBar: number;
		public barCount: number;
		public patternsPerChannel: number;
		public rhythm: number;
		public instrumentsPerChannel: number;
		public loopStart: number;
		public loopLength: number;
		public pitchChannelCount: number;
		public noiseChannelCount: number;
		public readonly channels: Channel[] = [];
		
		constructor(string?: string) {
			if (string != undefined) {
				this.fromBase64String(string);
			} else {
				this.initToDefault(true);
			}
		}
		
		public getChannelCount(): number {
			return this.pitchChannelCount + this.noiseChannelCount;
		}
		
		public getChannelIsNoise(channel: number): boolean {
			return (channel >= this.pitchChannelCount);
		}
		
		public initToDefault(andResetChannels: boolean = true): void {
			this.scale = 0;
			this.key = 0;
			this.loopStart = 0;
			this.loopLength = 4;
			this.tempo = 150;
			this.reverb = 0;
			this.beatsPerBar = 8;
			this.barCount = 16;
			this.patternsPerChannel = 8;
			this.rhythm = 1;
			this.instrumentsPerChannel = 1;
			
			if (andResetChannels) {
				this.pitchChannelCount = 3;
				this.noiseChannelCount = 1;
				for (let channelIndex = 0; channelIndex < this.getChannelCount(); channelIndex++) {
					if (this.channels.length <= channelIndex) {
						this.channels[channelIndex] = new Channel();
					}
					const channel: Channel = this.channels[channelIndex];
					channel.octave = 3 - channelIndex; // [3, 2, 1, 0]; Descending octaves with drums at zero in last channel.
				
					for (let pattern = 0; pattern < this.patternsPerChannel; pattern++) {
						if (channel.patterns.length <= pattern) {
							channel.patterns[pattern] = new Pattern();
						} else {
							channel.patterns[pattern].reset();
						}
					}
					channel.patterns.length = this.patternsPerChannel;
				
					const isNoiseChannel: boolean = channelIndex >= this.pitchChannelCount;
					for (let instrument = 0; instrument < this.instrumentsPerChannel; instrument++) {
						if (channel.instruments.length <= instrument) {
							channel.instruments[instrument] = new Instrument(isNoiseChannel);
						}
						channel.instruments[instrument].setTypeAndReset(isNoiseChannel ? InstrumentType.noise : InstrumentType.chip, isNoiseChannel);
					}
					channel.instruments.length = this.instrumentsPerChannel;
				
					for (let bar = 0; bar < this.barCount; bar++) {
						channel.bars[bar] = bar < 4 ? 1 : 0;
					}
					channel.bars.length = this.barCount;
				}
				this.channels.length = this.getChannelCount();
			}
		}
		
		public toBase64String(): string {
			let bits: BitFieldWriter;
			let buffer: number[] = [];
			
			buffer.push(base64IntToCharCode[Song._latestVersion]);
			buffer.push(SongTagCode.channelCount, base64IntToCharCode[this.pitchChannelCount], base64IntToCharCode[this.noiseChannelCount]);
			buffer.push(SongTagCode.scale, base64IntToCharCode[this.scale]);
			buffer.push(SongTagCode.key, base64IntToCharCode[this.key]);
			buffer.push(SongTagCode.loopStart, base64IntToCharCode[this.loopStart >> 6], base64IntToCharCode[this.loopStart & 0x3f]);
			buffer.push(SongTagCode.loopEnd, base64IntToCharCode[(this.loopLength - 1) >> 6], base64IntToCharCode[(this.loopLength - 1) & 0x3f]);
			buffer.push(SongTagCode.tempo, base64IntToCharCode[this.tempo >> 6], base64IntToCharCode[this.tempo & 63]);
			buffer.push(SongTagCode.reverb, base64IntToCharCode[this.reverb]);
			buffer.push(SongTagCode.beatCount, base64IntToCharCode[this.beatsPerBar - 1]);
			buffer.push(SongTagCode.barCount, base64IntToCharCode[(this.barCount - 1) >> 6], base64IntToCharCode[(this.barCount - 1) & 0x3f]);
			buffer.push(SongTagCode.patternCount, base64IntToCharCode[(this.patternsPerChannel - 1) >> 6], base64IntToCharCode[(this.patternsPerChannel - 1) & 0x3f]);
			buffer.push(SongTagCode.instrumentCount, base64IntToCharCode[this.instrumentsPerChannel - 1]);
			buffer.push(SongTagCode.rhythm, base64IntToCharCode[this.rhythm]);
			
			buffer.push(SongTagCode.channelOctave);
			for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
				buffer.push(base64IntToCharCode[this.channels[channel].octave]);
			}
			
			for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
				for (let i: number = 0; i < this.instrumentsPerChannel; i++) {
					const instrument: Instrument = this.channels[channel].instruments[i];
					buffer.push(SongTagCode.startInstrument, base64IntToCharCode[instrument.type]);
					buffer.push(SongTagCode.volume, base64IntToCharCode[instrument.volume]);
					buffer.push(SongTagCode.pan, base64IntToCharCode[instrument.pan]);
					buffer.push(SongTagCode.preset, base64IntToCharCode[instrument.preset >> 6], base64IntToCharCode[instrument.preset & 63]);
					buffer.push(SongTagCode.effects, base64IntToCharCode[instrument.effects]);
					
					if (instrument.type != InstrumentType.drumset) {
						buffer.push(SongTagCode.transition, base64IntToCharCode[instrument.transition]);
						buffer.push(SongTagCode.filterCutoff, base64IntToCharCode[instrument.filterCutoff]);
						buffer.push(SongTagCode.filterResonance, base64IntToCharCode[instrument.filterResonance]);
						buffer.push(SongTagCode.filterEnvelope, base64IntToCharCode[instrument.filterEnvelope]);
						buffer.push(SongTagCode.chord, base64IntToCharCode[instrument.chord]);
					}
					
					if (instrument.type == InstrumentType.chip) {
						buffer.push(SongTagCode.wave, base64IntToCharCode[instrument.chipWave]);
						buffer.push(SongTagCode.vibrato, base64IntToCharCode[instrument.vibrato]);
						buffer.push(SongTagCode.interval, base64IntToCharCode[instrument.interval]);
					} else if (instrument.type == InstrumentType.fm) {
						buffer.push(SongTagCode.vibrato, base64IntToCharCode[instrument.vibrato]);
						buffer.push(SongTagCode.algorithm, base64IntToCharCode[instrument.algorithm]);
						buffer.push(SongTagCode.feedbackType, base64IntToCharCode[instrument.feedbackType]);
						buffer.push(SongTagCode.feedbackAmplitude, base64IntToCharCode[instrument.feedbackAmplitude]);
						buffer.push(SongTagCode.feedbackEnvelope, base64IntToCharCode[instrument.feedbackEnvelope]);
						
						buffer.push(SongTagCode.operatorFrequencies);
						for (let o: number = 0; o < Config.operatorCount; o++) {
							buffer.push(base64IntToCharCode[instrument.operators[o].frequency]);
						}
						buffer.push(SongTagCode.operatorAmplitudes);
						for (let o: number = 0; o < Config.operatorCount; o++) {
							buffer.push(base64IntToCharCode[instrument.operators[o].amplitude]);
						}
						buffer.push(SongTagCode.operatorEnvelopes);
						for (let o: number = 0; o < Config.operatorCount; o++) {
							buffer.push(base64IntToCharCode[instrument.operators[o].envelope]);
						}
					} else if (instrument.type == InstrumentType.noise) {
						buffer.push(SongTagCode.wave, base64IntToCharCode[instrument.chipNoise]);
					} else if (instrument.type == InstrumentType.spectrum) {
						buffer.push(SongTagCode.spectrum);
						const spectrumBits: BitFieldWriter = new BitFieldWriter();
						for (let i: number = 0; i < Config.spectrumControlPoints; i++) {
							spectrumBits.write(Config.spectrumControlPointBits, instrument.spectrumWave.spectrum[i]);
						}
						spectrumBits.encodeBase64(buffer);
					} else if (instrument.type == InstrumentType.drumset) {
						buffer.push(SongTagCode.filterEnvelope);
						for (let j: number = 0; j < Config.drumCount; j++) {
							buffer.push(base64IntToCharCode[instrument.drumsetEnvelopes[j]]);
						}
						
						buffer.push(SongTagCode.spectrum);
						const spectrumBits: BitFieldWriter = new BitFieldWriter();
						for (let j: number = 0; j < Config.drumCount; j++) {
							for (let i: number = 0; i < Config.spectrumControlPoints; i++) {
								spectrumBits.write(Config.spectrumControlPointBits, instrument.drumsetSpectrumWaves[j].spectrum[i]);
							}
						}
						spectrumBits.encodeBase64(buffer);
					} else if (instrument.type == InstrumentType.harmonics) {
						buffer.push(SongTagCode.vibrato, base64IntToCharCode[instrument.vibrato]);
						buffer.push(SongTagCode.interval, base64IntToCharCode[instrument.interval]);
						
						buffer.push(SongTagCode.harmonics);
						const harmonicsBits: BitFieldWriter = new BitFieldWriter();
						for (let i: number = 0; i < Config.harmonicsControlPoints; i++) {
							harmonicsBits.write(Config.harmonicsControlPointBits, instrument.harmonicsWave.harmonics[i]);
						}
						harmonicsBits.encodeBase64(buffer);
					} else if (instrument.type == InstrumentType.pwm) {
						buffer.push(SongTagCode.vibrato, base64IntToCharCode[instrument.vibrato]);
						buffer.push(SongTagCode.pulseWidth, base64IntToCharCode[instrument.pulseWidth], base64IntToCharCode[instrument.pulseEnvelope]);
					} else {
						throw new Error("Unknown instrument type.");
					}
				}
			}
			
			buffer.push(SongTagCode.bars);
			bits = new BitFieldWriter();
			let neededBits: number = 0;
			while ((1 << neededBits) < this.patternsPerChannel + 1) neededBits++;
			for (let channel: number = 0; channel < this.getChannelCount(); channel++) for (let i: number = 0; i < this.barCount; i++) {
				bits.write(neededBits, this.channels[channel].bars[i]);
			}
			bits.encodeBase64(buffer);
			
			buffer.push(SongTagCode.patterns);
			bits = new BitFieldWriter();
			const shapeBits: BitFieldWriter = new BitFieldWriter();
			let neededInstrumentBits: number = 0;
			while ((1 << neededInstrumentBits) < this.instrumentsPerChannel) neededInstrumentBits++;
			for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
				const isNoiseChannel: boolean = this.getChannelIsNoise(channel);
				const octaveOffset: number = isNoiseChannel ? 0 : this.channels[channel].octave * 12;
				let lastPitch: number = (isNoiseChannel ? 4 : 12) + octaveOffset;
				const recentPitches: number[] = isNoiseChannel ? [4,6,7,2,3,8,0,10] : [12, 19, 24, 31, 36, 7, 0];
				const recentShapes: string[] = [];
				for (let i: number = 0; i < recentPitches.length; i++) {
					recentPitches[i] += octaveOffset;
				}
				for (const pattern of this.channels[channel].patterns) {
					bits.write(neededInstrumentBits, pattern.instrument);
					
					if (pattern.notes.length > 0) {
						bits.write(1, 1);
						
						let curPart: number = 0;
						for (const note of pattern.notes) {
							if (note.start > curPart) {
								bits.write(2, 0); // rest
								bits.writePartDuration(note.start - curPart);
							}
							
							shapeBits.clear();
							
							// 0: 1 pitch, 10: 2 pitches, 110: 3 pitches, 111: 4 pitches
							for (let i: number = 1; i < note.pitches.length; i++) shapeBits.write(1,1);
							if (note.pitches.length < Config.maxChordSize) shapeBits.write(1,0);
							
							shapeBits.writePinCount(note.pins.length - 1);
							
							shapeBits.write(2, note.pins[0].volume); // volume
							
							let shapePart: number = 0;
							let startPitch: number = note.pitches[0];
							let currentPitch: number = startPitch;
							const pitchBends: number[] = [];
							for (let i: number = 1; i < note.pins.length; i++) {
								const pin: NotePin = note.pins[i];
								const nextPitch: number = startPitch + pin.interval;
								if (currentPitch != nextPitch) {
									shapeBits.write(1, 1);
									pitchBends.push(nextPitch);
									currentPitch = nextPitch;
								} else {
									shapeBits.write(1, 0);
								}
								shapeBits.writePartDuration(pin.time - shapePart);
								shapePart = pin.time;
								shapeBits.write(2, pin.volume);
							}
							
							const shapeString: string = String.fromCharCode.apply(null, shapeBits.encodeBase64([]));
							const shapeIndex: number = recentShapes.indexOf(shapeString);
							if (shapeIndex == -1) {
								bits.write(2, 1); // new shape
								bits.concat(shapeBits);
							} else {
								bits.write(1, 1); // old shape
								bits.writeLongTail(0, 0, shapeIndex);
								recentShapes.splice(shapeIndex, 1);
							}
							recentShapes.unshift(shapeString);
							if (recentShapes.length > 10) recentShapes.pop();
							
							const allPitches: number[] = note.pitches.concat(pitchBends);
							for (let i: number = 0; i < allPitches.length; i++) {
								const pitch: number = allPitches[i];
								const pitchIndex: number = recentPitches.indexOf(pitch);
								if (pitchIndex == -1) {
									let interval: number = 0;
									let pitchIter: number = lastPitch;
									if (pitchIter < pitch) {
										while (pitchIter != pitch) {
											pitchIter++;
											if (recentPitches.indexOf(pitchIter) == -1) interval++;
										}
									} else {
										while (pitchIter != pitch) {
											pitchIter--;
											if (recentPitches.indexOf(pitchIter) == -1) interval--;
										}
									}
									bits.write(1, 0);
									bits.writePitchInterval(interval);
								} else {
									bits.write(1, 1);
									bits.write(3, pitchIndex);
									recentPitches.splice(pitchIndex, 1);
								}
								recentPitches.unshift(pitch);
								if (recentPitches.length > 8) recentPitches.pop();
								
								if (i == note.pitches.length - 1) {
									lastPitch = note.pitches[0];
								} else {
									lastPitch = pitch;
								}
							}
							curPart = note.end;
						}
						
						if (curPart < this.beatsPerBar * Config.partsPerBeat) {
							bits.write(2, 0); // rest
							bits.writePartDuration(this.beatsPerBar * Config.partsPerBeat - curPart);
						}
					} else {
						bits.write(1, 0);
					}
				}
			}
			let stringLength: number = bits.lengthBase64();
			let digits: number[] = [];
			while (stringLength > 0) {
				digits.unshift(base64IntToCharCode[stringLength & 0x3f]);
				stringLength = stringLength >> 6;
			}
			buffer.push(base64IntToCharCode[digits.length]);
			Array.prototype.push.apply(buffer, digits); // append digits to buffer.
			bits.encodeBase64(buffer);
			
			const maxApplyArgs: number = 64000;
			if (buffer.length < maxApplyArgs) {
				// Note: Function.apply may break for long argument lists. 
				return String.fromCharCode.apply(null, buffer);
			} else {
				let result: string = "";
				for (let i: number = 0; i < buffer.length; i += maxApplyArgs) {
					result += String.fromCharCode.apply(null, buffer.slice(i, i + maxApplyArgs));
				}
				return result;
			}
		}
		
		public fromBase64String(compressed: string): void {
			if (compressed == null || compressed == "") {
				this.initToDefault(true);
				return;
			}
			let charIndex: number = 0;
			// skip whitespace.
			while (compressed.charCodeAt(charIndex) <= CharCode.SPACE) charIndex++;
			// skip hash mark.
			if (compressed.charCodeAt(charIndex) == CharCode.HASH) charIndex++;
			// if it starts with curly brace, treat it as JSON.
			if (compressed.charCodeAt(charIndex) == CharCode.LEFT_CURLY_BRACE) {
				this.fromJsonObject(JSON.parse(charIndex == 0 ? compressed : compressed.substring(charIndex)));
				return;
			}
			
			const version: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
			if (version == -1 || version > Song._latestVersion || version < Song._oldestVersion) return;
			const beforeThree: boolean = version < 3;
			const beforeFour:  boolean = version < 4;
			const beforeFive:  boolean = version < 5;
			const beforeSix:   boolean = version < 6;
			const beforeSeven: boolean = version < 7;
			const beforeEight: boolean = version < 8;
			this.initToDefault(beforeSix);
			
			if (beforeThree) {
				// Originally, the only instrument transition was "seamless" and the only drum wave was "retro".
				for (const channel of this.channels) channel.instruments[0].transition = 0;
				this.channels[3].instruments[0].chipNoise = 0;
			}
			
			let instrumentChannelIterator: number = 0;
			let instrumentIndexIterator: number = -1;
			let command: SongTagCode;
			while (charIndex < compressed.length) switch(command = compressed.charCodeAt(charIndex++)) {
				case SongTagCode.channelCount: {
					this.pitchChannelCount = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
					this.noiseChannelCount  = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
					this.pitchChannelCount = validateRange(Config.pitchChannelCountMin, Config.pitchChannelCountMax, this.pitchChannelCount);
					this.noiseChannelCount = validateRange(Config.noiseChannelCountMin, Config.noiseChannelCountMax, this.noiseChannelCount);
					for (let channelIndex = this.channels.length; channelIndex < this.getChannelCount(); channelIndex++) {
						this.channels[channelIndex] = new Channel();
					}
					this.channels.length = this.getChannelCount();
				} break;
				case SongTagCode.scale: {
					this.scale = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
					if (beforeThree && this.scale == 10) this.scale = 11;
				} break;
				case SongTagCode.key: {
					if (beforeSeven) {
						this.key = clamp(0, Config.keys.length, 11 - base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					} else {
						this.key = clamp(0, Config.keys.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					}
				} break;
				case SongTagCode.loopStart: {
					if (beforeFive) {
						this.loopStart = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
					} else {
						this.loopStart = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
					}
				} break;
				case SongTagCode.loopEnd: {
					if (beforeFive) {
						this.loopLength = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
					} else {
						this.loopLength = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
					}
				} break;
				case SongTagCode.tempo: {
					if (beforeFour) {
						this.tempo = [95, 120, 151, 190][base64CharCodeToInt[compressed.charCodeAt(charIndex++)]];
					} else if (beforeSeven) {
						this.tempo = [88, 95, 103, 111, 120, 130, 140, 151, 163, 176, 190, 206, 222, 240, 259][base64CharCodeToInt[compressed.charCodeAt(charIndex++)]];
					} else {
						this.tempo = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) | (base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					}
					this.tempo = clamp(Config.tempoMin, Config.tempoMax + 1, this.tempo);
				} break;
				case SongTagCode.reverb: {
					this.reverb = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
					this.reverb = clamp(0, Config.reverbRange, this.reverb);
				} break;
				case SongTagCode.beatCount: {
					if (beforeThree) {
						this.beatsPerBar = [6, 7, 8, 9, 10][base64CharCodeToInt[compressed.charCodeAt(charIndex++)]];
					} else {
						this.beatsPerBar = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
					}
					this.beatsPerBar = Math.max(Config.beatsPerBarMin, Math.min(Config.beatsPerBarMax, this.beatsPerBar));
				} break;
				case SongTagCode.barCount: {
					const barCount: number = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
					this.barCount = validateRange(Config.barCountMin, Config.barCountMax, barCount);
					for (let channel = 0; channel < this.getChannelCount(); channel++) {
						for (let bar = this.channels[channel].bars.length; bar < this.barCount; bar++) {
							this.channels[channel].bars[bar] = 1;
						}
						this.channels[channel].bars.length = this.barCount;
					}
				} break;
				case SongTagCode.patternCount: {
					let patternsPerChannel: number;
					if (beforeEight) {
						patternsPerChannel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
					} else {
						patternsPerChannel = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
					}
					this.patternsPerChannel = validateRange(1, Config.barCountMax, patternsPerChannel);
					for (let channel = 0; channel < this.getChannelCount(); channel++) {
						for (let pattern = this.channels[channel].patterns.length; pattern < this.patternsPerChannel; pattern++) {
							this.channels[channel].patterns[pattern] = new Pattern();
						}
						this.channels[channel].patterns.length = this.patternsPerChannel;
					}
				} break;
				case SongTagCode.instrumentCount: {
					const instrumentsPerChannel: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
					this.instrumentsPerChannel = validateRange(Config.instrumentsPerChannelMin, Config.instrumentsPerChannelMax, instrumentsPerChannel);
					for (let channel = 0; channel < this.getChannelCount(); channel++) {
						const isNoiseChannel: boolean = channel >= this.pitchChannelCount;
						for (let instrumentIndex = this.channels[channel].instruments.length; instrumentIndex < this.instrumentsPerChannel; instrumentIndex++) {
							this.channels[channel].instruments[instrumentIndex] = new Instrument(isNoiseChannel);
						}
						this.channels[channel].instruments.length = this.instrumentsPerChannel;
						if (beforeSix) {
							for (let instrumentIndex = 0; instrumentIndex < this.instrumentsPerChannel; instrumentIndex++) {
								this.channels[channel].instruments[instrumentIndex].setTypeAndReset(isNoiseChannel ? InstrumentType.noise : InstrumentType.chip, isNoiseChannel);
							}
						}
					}
				} break;
				case SongTagCode.rhythm: {
					this.rhythm = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
				} break;
				case SongTagCode.channelOctave: {
					if (beforeThree) {
						const channel: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						this.channels[channel].octave = clamp(0, Config.scrollableOctaves + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					} else {
						for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
							this.channels[channel].octave = clamp(0, Config.scrollableOctaves + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
						}
					}
				} break;
				case SongTagCode.startInstrument: {
					instrumentIndexIterator++;
					if (instrumentIndexIterator >= this.instrumentsPerChannel) {
						instrumentChannelIterator++;
						instrumentIndexIterator = 0;
					}
					validateRange(0, this.channels.length - 1, instrumentChannelIterator);
					const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
					const instrumentType: number = validateRange(0, InstrumentType.length - 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					instrument.setTypeAndReset(instrumentType, instrumentChannelIterator >= this.pitchChannelCount);
				} break;
				case SongTagCode.preset: {
					const presetValue: number = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) | (base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].preset = presetValue;
				} break;
				case SongTagCode.wave: {
					if (beforeThree) {
						const legacyWaves: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 0];
						const channel: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						this.channels[channel].instruments[0].chipWave = clamp(0, Config.chipWaves.length, legacyWaves[base64CharCodeToInt[compressed.charCodeAt(charIndex++)]] | 0);
					} else if (beforeSix) {
						const legacyWaves: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 0];
						for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
							for (let i: number = 0; i < this.instrumentsPerChannel; i++) {
								if (channel >= this.pitchChannelCount) {
									this.channels[channel].instruments[i].chipNoise = clamp(0, Config.chipNoises.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
								} else {
									this.channels[channel].instruments[i].chipWave = clamp(0, Config.chipWaves.length, legacyWaves[base64CharCodeToInt[compressed.charCodeAt(charIndex++)]] | 0);
								}
							}
						}
					} else if (beforeSeven) {
						const legacyWaves: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 0];
						if (instrumentChannelIterator >= this.pitchChannelCount) {
							this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipNoise = clamp(0, Config.chipNoises.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
						} else {
							this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipWave = clamp(0, Config.chipWaves.length, legacyWaves[base64CharCodeToInt[compressed.charCodeAt(charIndex++)]] | 0);
						}
					} else {
						if (instrumentChannelIterator >= this.pitchChannelCount) {
							this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipNoise = clamp(0, Config.chipNoises.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
						} else {
							this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipWave = clamp(0, Config.chipWaves.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
						}
					}
				} break;
				case SongTagCode.filterCutoff: {
					if (beforeSeven) {
						const legacyToCutoff: number[] = [10, 6, 3, 0, 8, 5, 2];
						const legacyToEnvelope: number[] = [1, 1, 1, 1, 18, 19, 20];
						const filterNames: string[] = ["none", "bright", "medium", "soft", "decay bright", "decay medium", "decay soft"];
					
						if (beforeThree) {
							const channel: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
							const instrument: Instrument = this.channels[channel].instruments[0];
							const legacyFilter: number = [1, 3, 4, 5][clamp(0, filterNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)])];
							instrument.filterCutoff = legacyToCutoff[legacyFilter];
							instrument.filterEnvelope = legacyToEnvelope[legacyFilter];
							instrument.filterResonance = 0;
						} else if (beforeSix) {
							for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
								for (let i: number = 0; i < this.instrumentsPerChannel; i++) {
									const instrument: Instrument = this.channels[channel].instruments[i];
									const legacyFilter: number = clamp(0, filterNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1);
									if (channel < this.pitchChannelCount) {
										instrument.filterCutoff = legacyToCutoff[legacyFilter];
										instrument.filterEnvelope = legacyToEnvelope[legacyFilter];
										instrument.filterResonance = 0;
									} else {
										instrument.filterCutoff = 10;
										instrument.filterEnvelope = 1;
										instrument.filterResonance = 0;
									}
								}
							}
						} else {
							const legacyFilter: number = clamp(0, filterNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
							const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
							instrument.filterCutoff = legacyToCutoff[legacyFilter];
							instrument.filterEnvelope = legacyToEnvelope[legacyFilter];
							instrument.filterResonance = 0;
						}
					} else {
						const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
						instrument.filterCutoff = clamp(0, Config.filterCutoffRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					}
				} break;
				case SongTagCode.filterResonance: {
					this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].filterResonance = clamp(0, Config.filterResonanceRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
				} break;
				case SongTagCode.filterEnvelope: {
					const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
					if (instrument.type == InstrumentType.drumset) {
						for (let i: number = 0; i < Config.drumCount; i++) {
							instrument.drumsetEnvelopes[i] = clamp(0, Config.envelopes.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
						}
					} else {
						instrument.filterEnvelope = clamp(0, Config.envelopes.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					}
				} break;
				case SongTagCode.pulseWidth: {
					const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
					instrument.pulseWidth = clamp(0, Config.pulseWidthRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					instrument.pulseEnvelope = clamp(0, Config.envelopes.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
				} break;
				case SongTagCode.transition: {
					if (beforeThree) {
						const channel: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						this.channels[channel].instruments[0].transition = clamp(0, Config.transitions.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					} else if (beforeSix) {
						for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
							for (let i: number = 0; i < this.instrumentsPerChannel; i++) {
								this.channels[channel].instruments[i].transition = clamp(0, Config.transitions.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
							}
						}
					} else {
						this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].transition = clamp(0, Config.transitions.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					}
				} break;
				case SongTagCode.vibrato: {
					if (beforeThree) {
						const legacyEffects: number[] = [0, 3, 2, 0];
						const legacyEnvelopes: number[] = [1, 1, 1, 13];
						const channel: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						const effect: number = clamp(0, legacyEffects.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
						const instrument: Instrument = this.channels[channel].instruments[0];
						instrument.vibrato = legacyEffects[effect];
						instrument.filterEnvelope = (instrument.filterEnvelope == 1)
							? legacyEnvelopes[effect]
							: instrument.filterEnvelope;
					} else if (beforeSix) {
						const legacyEffects: number[] = [0, 1, 2, 3, 0, 0];
						const legacyEnvelopes: number[] = [1, 1, 1, 1, 16, 13];
						for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
							for (let i: number = 0; i < this.instrumentsPerChannel; i++) {
								const effect: number = clamp(0, legacyEffects.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
								const instrument: Instrument = this.channels[channel].instruments[i];
								instrument.vibrato = legacyEffects[effect];
								instrument.filterEnvelope = (instrument.filterEnvelope == 1)
									? legacyEnvelopes[effect]
									: instrument.filterEnvelope;
							}
						}
					} else if (beforeSeven) {
						const legacyEffects: number[] = [0, 1, 2, 3, 0, 0];
						const legacyEnvelopes: number[] = [1, 1, 1, 1, 16, 13];
						const effect: number = clamp(0, legacyEffects.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
						const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
						instrument.vibrato = legacyEffects[effect];
						instrument.filterEnvelope = (instrument.filterEnvelope == 1)
							? legacyEnvelopes[effect]
							: instrument.filterEnvelope;
					} else {
						const vibrato: number = clamp(0, Config.vibratos.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
						this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].vibrato = vibrato;
					}
				} break;
				case SongTagCode.interval: {
					if (beforeThree) {
						const channel: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						this.channels[channel].instruments[0].interval = clamp(0, Config.intervals.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					} else if (beforeSix) {
						for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
							for (let i: number = 0; i < this.instrumentsPerChannel; i++) {
								const originalValue: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
								let interval: number = clamp(0, Config.intervals.length, originalValue);
								if (originalValue == 8) {
									// original "custom harmony" now maps to "hum" and "custom interval".
									interval = 2;
									this.channels[channel].instruments[i].chord = 3;
								}
								this.channels[channel].instruments[i].interval = interval;
							}
						}
					} else if (beforeSeven) {
						const originalValue: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						let interval: number = clamp(0, Config.intervals.length, originalValue);
						if (originalValue == 8) {
							// original "custom harmony" now maps to "hum" and "custom interval".
							interval = 2;
							this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chord = 3;
						}
						this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].interval = interval;
					} else {
						this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].interval = clamp(0, Config.intervals.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					}
				} break;
				case SongTagCode.chord: {
					this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chord = clamp(0, Config.chords.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
				} break;
				case SongTagCode.effects: {
					this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].effects = clamp(0, Config.effectsNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
				} break;
				case SongTagCode.volume: {
					if (beforeThree) {
						const channel: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						const instrument: Instrument = this.channels[channel].instruments[0];
						instrument.volume = clamp(0, Config.volumeRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
						// legacy mute value:
						if (instrument.volume == 5) instrument.volume = Config.volumeRange - 1;
					} else if (beforeSix) {
						for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
							for (let i: number = 0; i < this.instrumentsPerChannel; i++) {
								const instrument: Instrument = this.channels[channel].instruments[i];
								instrument.volume = clamp(0, Config.volumeRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
								// legacy mute value:
								if (instrument.volume == 5) instrument.volume = Config.volumeRange - 1;
							}
						}
					} else if (beforeSeven) {
						const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
						instrument.volume = clamp(0, Config.volumeRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
						// legacy mute value:
						if (instrument.volume == 5) instrument.volume = Config.volumeRange - 1;
					} else {
						const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
						instrument.volume = clamp(0, Config.volumeRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					}
				} break;
				case SongTagCode.pan: {
					const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
					instrument.pan = clamp(0, Config.panMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
				} break;
				case SongTagCode.algorithm: {
					this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].algorithm = clamp(0, Config.algorithms.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
				} break;
				case SongTagCode.feedbackType: {
					this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].feedbackType = clamp(0, Config.feedbacks.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
				} break;
				case SongTagCode.feedbackAmplitude: {
					this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].feedbackAmplitude = clamp(0, Config.operatorAmplitudeMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
				} break;
				case SongTagCode.feedbackEnvelope: {
					this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].feedbackEnvelope = clamp(0, Config.envelopes.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
				} break;
				case SongTagCode.operatorFrequencies: {
					for (let o: number = 0; o < Config.operatorCount; o++) {
						this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].operators[o].frequency = clamp(0, Config.operatorFrequencies.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					}
				} break;
				case SongTagCode.operatorAmplitudes: {
					for (let o: number = 0; o < Config.operatorCount; o++) {
						this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].operators[o].amplitude = clamp(0, Config.operatorAmplitudeMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					}
				} break;
				case SongTagCode.operatorEnvelopes: {
					for (let o: number = 0; o < Config.operatorCount; o++) {
						this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].operators[o].envelope = clamp(0, Config.envelopes.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					}
				} break;
				case SongTagCode.spectrum: {
					const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
					if (instrument.type == InstrumentType.spectrum) {
						const byteCount: number = Math.ceil(Config.spectrumControlPoints * Config.spectrumControlPointBits / 6)
						const bits: BitFieldReader = new BitFieldReader(compressed, charIndex, charIndex + byteCount);
						for (let i: number = 0; i < Config.spectrumControlPoints; i++) {
							instrument.spectrumWave.spectrum[i] = bits.read(Config.spectrumControlPointBits);
						}
						instrument.spectrumWave.markCustomWaveDirty();
						charIndex += byteCount;
					} else if (instrument.type == InstrumentType.drumset) {
						const byteCount: number = Math.ceil(Config.drumCount * Config.spectrumControlPoints * Config.spectrumControlPointBits / 6)
						const bits: BitFieldReader = new BitFieldReader(compressed, charIndex, charIndex + byteCount);
						for (let j: number = 0; j < Config.drumCount; j++) {
							for (let i: number = 0; i < Config.spectrumControlPoints; i++) {
								instrument.drumsetSpectrumWaves[j].spectrum[i] = bits.read(Config.spectrumControlPointBits);
							}
							instrument.drumsetSpectrumWaves[j].markCustomWaveDirty();
						}
						charIndex += byteCount;
					} else {
						throw new Error("Unhandled instrument type for spectrum song tag code.");
					}
				} break;
				case SongTagCode.harmonics: {
					const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
					const byteCount: number = Math.ceil(Config.harmonicsControlPoints * Config.harmonicsControlPointBits / 6)
					const bits: BitFieldReader = new BitFieldReader(compressed, charIndex, charIndex + byteCount);
					for (let i: number = 0; i < Config.harmonicsControlPoints; i++) {
						instrument.harmonicsWave.harmonics[i] = bits.read(Config.harmonicsControlPointBits);
					}
					instrument.harmonicsWave.markCustomWaveDirty();
					charIndex += byteCount;
				} break;
				case SongTagCode.bars: {
					let subStringLength: number;
					if (beforeThree) {
						const channel: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						const barCount: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						subStringLength = Math.ceil(barCount * 0.5);
						const bits: BitFieldReader = new BitFieldReader(compressed, charIndex, charIndex + subStringLength);
						for (let i: number = 0; i < barCount; i++) {
							this.channels[channel].bars[i] = bits.read(3) + 1;
						}
					} else if (beforeFive) {
						let neededBits: number = 0;
						while ((1 << neededBits) < this.patternsPerChannel) neededBits++;
						subStringLength = Math.ceil(this.getChannelCount() * this.barCount * neededBits / 6);
						const bits: BitFieldReader = new BitFieldReader(compressed, charIndex, charIndex + subStringLength);
						for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
							for (let i: number = 0; i < this.barCount; i++) {
								this.channels[channel].bars[i] = bits.read(neededBits) + 1;
							}
						}
					} else {
						let neededBits: number = 0;
						while ((1 << neededBits) < this.patternsPerChannel + 1) neededBits++;
						subStringLength = Math.ceil(this.getChannelCount() * this.barCount * neededBits / 6);
						const bits: BitFieldReader = new BitFieldReader(compressed, charIndex, charIndex + subStringLength);
						for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
							for (let i: number = 0; i < this.barCount; i++) {
								this.channels[channel].bars[i] = bits.read(neededBits);
							}
						}
					}
					charIndex += subStringLength;
				} break;
				case SongTagCode.patterns: {
					let bitStringLength: number = 0;
					let channel: number;
					if (beforeThree) {
						channel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						
						// The old format used the next character to represent the number of patterns in the channel, which is usually eight, the default. 
						charIndex++; //let patternCount: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						
						bitStringLength = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						bitStringLength = bitStringLength << 6;
						bitStringLength += base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
					} else {
						channel = 0;
						let bitStringLengthLength: number = validateRange(1, 4, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
						while (bitStringLengthLength > 0) {
							bitStringLength = bitStringLength << 6;
							bitStringLength += base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
							bitStringLengthLength--;
						}
					}
					
					const bits: BitFieldReader = new BitFieldReader(compressed, charIndex, charIndex + bitStringLength);
					charIndex += bitStringLength;
					
					let neededInstrumentBits: number = 0;
					while ((1 << neededInstrumentBits) < this.instrumentsPerChannel) neededInstrumentBits++;
					while (true) {
						const isNoiseChannel: boolean = this.getChannelIsNoise(channel);
						
						const octaveOffset: number = isNoiseChannel ? 0 : this.channels[channel].octave * 12;
						let note: Note | null = null;
						let pin: NotePin | null = null;
						let lastPitch: number = (isNoiseChannel ? 4 : 12) + octaveOffset;
						const recentPitches: number[] = isNoiseChannel ? [4,6,7,2,3,8,0,10] : [12, 19, 24, 31, 36, 7, 0];
						const recentShapes: any[] = [];
						for (let i: number = 0; i < recentPitches.length; i++) {
							recentPitches[i] += octaveOffset;
						}
						for (let i: number = 0; i < this.patternsPerChannel; i++) {
							const newPattern: Pattern = this.channels[channel].patterns[i];
							newPattern.reset();
							newPattern.instrument = bits.read(neededInstrumentBits);
							
							if (!beforeThree && bits.read(1) == 0) continue;
							
							let curPart: number = 0;
							const newNotes: Note[] = newPattern.notes;
							while (curPart < this.beatsPerBar * Config.partsPerBeat) {
								
								const useOldShape: boolean = bits.read(1) == 1;
								let newNote: boolean = false;
								let shapeIndex: number = 0;
								if (useOldShape) {
									shapeIndex = validateRange(0, recentShapes.length - 1, bits.readLongTail(0, 0));
								} else {
									newNote = bits.read(1) == 1;
								}
								
								if (!useOldShape && !newNote) {
									const restLength: number = beforeSeven
										? bits.readLegacyPartDuration() * Config.partsPerBeat / Config.rhythms[this.rhythm].stepsPerBeat
										: bits.readPartDuration();
									curPart += restLength;
								} else {
									let shape: any;
									let pinObj: any;
									let pitch: number;
									if (useOldShape) {
										shape = recentShapes[shapeIndex];
										recentShapes.splice(shapeIndex, 1);
									} else {
										shape = {};
										
										shape.pitchCount = 1;
										while (shape.pitchCount < Config.maxChordSize && bits.read(1) == 1) shape.pitchCount++;
										
										shape.pinCount = bits.readPinCount();
										shape.initialVolume = bits.read(2);
										
										shape.pins = [];
										shape.length = 0;
										shape.bendCount = 0;
										for (let j: number = 0; j < shape.pinCount; j++) {
											pinObj = {};
											pinObj.pitchBend = bits.read(1) == 1;
											if (pinObj.pitchBend) shape.bendCount++;
											shape.length += beforeSeven
												? bits.readLegacyPartDuration() * Config.partsPerBeat / Config.rhythms[this.rhythm].stepsPerBeat
												: bits.readPartDuration();
											pinObj.time = shape.length;
											pinObj.volume = bits.read(2);
											shape.pins.push(pinObj);
										}
									}
									recentShapes.unshift(shape);
									if (recentShapes.length > 10) recentShapes.pop();
									
									note = new Note(0,curPart,curPart + shape.length, shape.initialVolume);
									note.pitches = [];
									note.pins.length = 1;
									const pitchBends: number[] = [];
									for (let j: number = 0; j < shape.pitchCount + shape.bendCount; j++) {
										const useOldPitch: boolean = bits.read(1) == 1;
										if (!useOldPitch) {
											const interval: number = bits.readPitchInterval();
											pitch = lastPitch;
											let intervalIter: number = interval;
											while (intervalIter > 0) {
												pitch++;
												while (recentPitches.indexOf(pitch) != -1) pitch++;
												intervalIter--;
											}
											while (intervalIter < 0) {
												pitch--;
												while (recentPitches.indexOf(pitch) != -1) pitch--;
												intervalIter++;
											}
										} else {
											const pitchIndex: number = validateRange(0, recentPitches.length - 1, bits.read(3));
											pitch = recentPitches[pitchIndex];
											recentPitches.splice(pitchIndex, 1);
										}
										
										recentPitches.unshift(pitch);
										if (recentPitches.length > 8) recentPitches.pop();
										
										if (j < shape.pitchCount) {
											note.pitches.push(pitch);
										} else {
											pitchBends.push(pitch);
										}
										
										if (j == shape.pitchCount - 1) {
											lastPitch = note.pitches[0];
										} else {
											lastPitch = pitch;
										}
									}
									
									pitchBends.unshift(note.pitches[0]);
									
									for (const pinObj of shape.pins) {
										if (pinObj.pitchBend) pitchBends.shift();
										pin = makeNotePin(pitchBends[0] - note.pitches[0], pinObj.time, pinObj.volume);
										note.pins.push(pin);
									}
									curPart = validateRange(0, this.beatsPerBar * Config.partsPerBeat, note.end);
									newNotes.push(note);
								}
							}
						}
						
						if (beforeThree) {
							break;
						} else {
							channel++;
							if (channel >= this.getChannelCount()) break;
						}
					} // while (true)
				} break;
				default: {
					throw new Error("Unrecognized song tag code " + String.fromCharCode(command) + " at index " + (charIndex - 1));
				} break;
			}
		}
		
		public toJsonObject(enableIntro: boolean = true, loopCount: number = 1, enableOutro: boolean = true): Object {
			const channelArray: Object[] = [];
			for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
				const instrumentArray: Object[] = [];
				const isNoiseChannel: boolean = this.getChannelIsNoise(channel);
				for (let i: number = 0; i < this.instrumentsPerChannel; i++) {
					instrumentArray.push(this.channels[channel].instruments[i].toJsonObject());
				}
				
				const patternArray: Object[] = [];
				for (const pattern of this.channels[channel].patterns) {
					const noteArray: Object[] = [];
					for (const note of pattern.notes) {
						const pointArray: Object[] = [];
						for (const pin of note.pins) {
							pointArray.push({
								"tick": (pin.time + note.start) * Config.rhythms[this.rhythm].stepsPerBeat / Config.partsPerBeat,
								"pitchBend": pin.interval,
								"volume": Math.round(pin.volume * 100 / 3),
							});
						}
						
						noteArray.push({
							"pitches": note.pitches,
							"points": pointArray,
						});
					}
					
					patternArray.push({
						"instrument": pattern.instrument + 1,
						"notes": noteArray, 
					});
				}
				
				const sequenceArray: number[] = [];
				if (enableIntro) for (let i: number = 0; i < this.loopStart; i++) {
					sequenceArray.push(this.channels[channel].bars[i]);
				}
				for (let l: number = 0; l < loopCount; l++) for (let i: number = this.loopStart; i < this.loopStart + this.loopLength; i++) {
					sequenceArray.push(this.channels[channel].bars[i]);
				}
				if (enableOutro) for (let i: number = this.loopStart + this.loopLength; i < this.barCount; i++) {
					sequenceArray.push(this.channels[channel].bars[i]);
				}
				
				channelArray.push({
					"type": isNoiseChannel ? "drum" : "pitch",
					"octaveScrollBar": this.channels[channel].octave,
					"instruments": instrumentArray,
					"patterns": patternArray,
					"sequence": sequenceArray,
				});
			}
			
			return {
				"format": Song._format,
				"version": Song._latestVersion,
				"scale": Config.scales[this.scale].name,
				"key": Config.keys[this.key].name,
				"introBars": this.loopStart,
				"loopBars": this.loopLength,
				"beatsPerBar": this.beatsPerBar,
				"ticksPerBeat": Config.rhythms[this.rhythm].stepsPerBeat,
				"beatsPerMinute": this.tempo,
				"reverb": this.reverb,
				//"outroBars": this.barCount - this.loopStart - this.loopLength; // derive this from bar arrays?
				//"patternCount": this.patternsPerChannel, // derive this from pattern arrays?
				//"instrumentsPerChannel": this.instrumentsPerChannel, //derive this from instrument arrays?
				"channels": channelArray,
			};
		}
		
		public fromJsonObject(jsonObject: any): void {
			this.initToDefault(true);
			if (!jsonObject) return;
			
			//const version: number = jsonObject["version"] | 0;
			//if (version > Song._latestVersion) return; // Go ahead and try to parse something from the future I guess? JSON is pretty easy-going!
			
			this.scale = 11; // default to expert.
			if (jsonObject["scale"] != undefined) {
				const oldScaleNames: Dictionary<string> = {
					"romani :)": "dbl harmonic :)",
					"romani :(": "dbl harmonic :(",
					"enigma": "strange",
				};
				const scaleName: string = (oldScaleNames[jsonObject["scale"]] != undefined) ? oldScaleNames[jsonObject["scale"]] : jsonObject["scale"];
				const scale: number = Config.scales.findIndex(scale => scale.name == scaleName);
				if (scale != -1) this.scale = scale;
			}
			
			if (jsonObject["key"] != undefined) {
				if (typeof(jsonObject["key"]) == "number") {
					this.key = ((jsonObject["key"] + 1200) >>> 0) % Config.keys.length;
				} else if (typeof(jsonObject["key"]) == "string") {
					const key: string = jsonObject["key"];
					const letter: string = key.charAt(0).toUpperCase();
					const symbol: string = key.charAt(1).toLowerCase();
					const letterMap: Readonly<Dictionary<number>> = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11};
					const accidentalMap: Readonly<Dictionary<number>> = {"#": 1, "♯": 1, "b": -1, "♭": -1};
					let index: number | undefined = letterMap[letter];
					const offset: number | undefined = accidentalMap[symbol];
					if (index != undefined) {
						if (offset != undefined) index += offset;
						if (index < 0) index += 12;
						index = index % 12;
						this.key = index;
					}
				}
			}
			
			if (jsonObject["beatsPerMinute"] != undefined) {
				this.tempo = clamp(Config.tempoMin, Config.tempoMax + 1, jsonObject["beatsPerMinute"] | 0);
			}
			
			if (jsonObject["reverb"] != undefined) {
				this.reverb = clamp(0, Config.reverbRange, jsonObject["reverb"] | 0);
			}
			
			if (jsonObject["beatsPerBar"] != undefined) {
				this.beatsPerBar = Math.max(Config.beatsPerBarMin, Math.min(Config.beatsPerBarMax, jsonObject["beatsPerBar"] | 0));
			}
			
			let importedPartsPerBeat: number = 4;
			if (jsonObject["ticksPerBeat"] != undefined) {
				importedPartsPerBeat = (jsonObject["ticksPerBeat"] | 0) || 4;
				this.rhythm = Config.rhythms.findIndex(rhythm=>rhythm.stepsPerBeat==importedPartsPerBeat);
				if (this.rhythm == -1) {
					this.rhythm = 1;
				}
			}
			
			let maxInstruments: number = 1;
			let maxPatterns: number = 1;
			let maxBars: number = 1;
			if (jsonObject["channels"]) {
				for (const channelObject of jsonObject["channels"]) {
					if (channelObject["instruments"]) maxInstruments = Math.max(maxInstruments, channelObject["instruments"].length | 0);
					if (channelObject["patterns"]) maxPatterns = Math.max(maxPatterns, channelObject["patterns"].length | 0);
					if (channelObject["sequence"]) maxBars = Math.max(maxBars, channelObject["sequence"].length | 0);
				}
			}
			
			this.instrumentsPerChannel = Math.min(maxInstruments, Config.instrumentsPerChannelMax);
			this.patternsPerChannel = Math.min(maxPatterns, Config.barCountMax);
			this.barCount = Math.min(maxBars, Config.barCountMax);
			
			if (jsonObject["introBars"] != undefined) {
				this.loopStart = clamp(0, this.barCount, jsonObject["introBars"] | 0);
			}
			if (jsonObject["loopBars"] != undefined) {
				this.loopLength = clamp(1, this.barCount - this.loopStart + 1, jsonObject["loopBars"] | 0);
			}
			
			const newPitchChannels: Channel[] = [];
			const newNoiseChannels: Channel[] = [];
			if (jsonObject["channels"]) {
				for (let channelIndex: number = 0; channelIndex < jsonObject["channels"].length; channelIndex++) {
					let channelObject: any = jsonObject["channels"][channelIndex];
					
					const channel: Channel = new Channel();
					
					let isNoiseChannel: boolean = false;
					if (channelObject["type"] != undefined) {
						isNoiseChannel = (channelObject["type"] == "drum");
					} else {
						// for older files, assume drums are channel 3.
						isNoiseChannel = (channelIndex >= 3);
					}
					if (isNoiseChannel) {
						newNoiseChannels.push(channel);
					} else {
						newPitchChannels.push(channel);
					}
					
					if (channelObject["octaveScrollBar"] != undefined) {
						channel.octave = clamp(0, Config.scrollableOctaves + 1, channelObject["octaveScrollBar"] | 0);
					}
					
					for (let i: number = channel.instruments.length; i < this.instrumentsPerChannel; i++) {
						channel.instruments[i] = new Instrument(isNoiseChannel);
					}
					channel.instruments.length = this.instrumentsPerChannel;
					
					for (let i: number = channel.patterns.length; i < this.patternsPerChannel; i++) {
						channel.patterns[i] = new Pattern();
					}
					channel.patterns.length = this.patternsPerChannel;
					
					for (let i: number = 0; i < this.barCount; i++) {
						channel.bars[i] = 1;
					}
					channel.bars.length = this.barCount;
					
					for (let i: number = 0; i < this.instrumentsPerChannel; i++) {
						const instrument: Instrument = channel.instruments[i];
						instrument.fromJsonObject(channelObject["instruments"][i], isNoiseChannel);
					}
					
					for (let i: number = 0; i < this.patternsPerChannel; i++) {
						const pattern: Pattern = channel.patterns[i];
					
						let patternObject: any = undefined;
						if (channelObject["patterns"]) patternObject = channelObject["patterns"][i];
						if (patternObject == undefined) continue;
					
						pattern.instrument = clamp(0, this.instrumentsPerChannel, (patternObject["instrument"] | 0) - 1);
					
						if (patternObject["notes"] && patternObject["notes"].length > 0) {
							const maxNoteCount: number = Math.min(this.beatsPerBar * Config.partsPerBeat, patternObject["notes"].length >>> 0);
						
							///@TODO: Consider supporting notes specified in any timing order, sorting them and truncating as necessary. 
							let tickClock: number = 0;
							for (let j: number = 0; j < patternObject["notes"].length; j++) {
								if (j >= maxNoteCount) break;
							
								const noteObject = patternObject["notes"][j];
								if (!noteObject || !noteObject["pitches"] || !(noteObject["pitches"].length >= 1) || !noteObject["points"] || !(noteObject["points"].length >= 2)) {
									continue;
								}
							
								const note: Note = new Note(0, 0, 0, 0);
								note.pitches = [];
								note.pins = [];
							
								for (let k: number = 0; k < noteObject["pitches"].length; k++) {
									const pitch: number = noteObject["pitches"][k] | 0;
									if (note.pitches.indexOf(pitch) != -1) continue;
									note.pitches.push(pitch);
									if (note.pitches.length >= Config.maxChordSize) break;
								}
								if (note.pitches.length < 1) continue;
							
								let noteClock: number = tickClock;
								let startInterval: number = 0;
								for (let k: number = 0; k < noteObject["points"].length; k++) {
									const pointObject: any = noteObject["points"][k];
									if (pointObject == undefined || pointObject["tick"] == undefined) continue;
									const interval: number = (pointObject["pitchBend"] == undefined) ? 0 : (pointObject["pitchBend"] | 0);
									
									const time: number = Math.round((+pointObject["tick"]) * Config.partsPerBeat / importedPartsPerBeat);
									
									const volume: number = (pointObject["volume"] == undefined) ? 3 : Math.max(0, Math.min(3, Math.round((pointObject["volume"] | 0) * 3 / 100)));
								
									if (time > this.beatsPerBar * Config.partsPerBeat) continue;
									if (note.pins.length == 0) {
										if (time < noteClock) continue;
										note.start = time;
										startInterval = interval;
									} else {
										if (time <= noteClock) continue;
									}
									noteClock = time;
								
									note.pins.push(makeNotePin(interval - startInterval, time - note.start, volume));
								}
								if (note.pins.length < 2) continue;
							
								note.end = note.pins[note.pins.length - 1].time + note.start;
							
								const maxPitch: number = isNoiseChannel ? Config.drumCount - 1 : Config.maxPitch;
								let lowestPitch: number = maxPitch;
								let highestPitch: number = 0;
								for (let k: number = 0; k < note.pitches.length; k++) {
									note.pitches[k] += startInterval;
									if (note.pitches[k] < 0 || note.pitches[k] > maxPitch) {
										note.pitches.splice(k, 1);
										k--;
									}
									if (note.pitches[k] < lowestPitch) lowestPitch = note.pitches[k];
									if (note.pitches[k] > highestPitch) highestPitch = note.pitches[k];
								}
								if (note.pitches.length < 1) continue;
							
								for (let k: number = 0; k < note.pins.length; k++) {
									const pin: NotePin = note.pins[k];
									if (pin.interval + lowestPitch < 0) pin.interval = -lowestPitch;
									if (pin.interval + highestPitch > maxPitch) pin.interval = maxPitch - highestPitch;
									if (k >= 2) {
										if (pin.interval == note.pins[k-1].interval && 
											pin.interval == note.pins[k-2].interval && 
											pin.volume == note.pins[k-1].volume && 
											pin.volume == note.pins[k-2].volume)
										{
											note.pins.splice(k-1, 1);
											k--;
										}    
									}
								}
							
								pattern.notes.push(note);
								tickClock = note.end;
							}
						}
					}
				
					for (let i: number = 0; i < this.barCount; i++) {
						channel.bars[i] = channelObject["sequence"] ? Math.min(this.patternsPerChannel, channelObject["sequence"][i] >>> 0) : 0;
					}
				}
			}
			
			if (newPitchChannels.length > Config.pitchChannelCountMax) newPitchChannels.length = Config.pitchChannelCountMax;
			if (newNoiseChannels.length > Config.noiseChannelCountMax) newNoiseChannels.length = Config.noiseChannelCountMax;
			this.pitchChannelCount = newPitchChannels.length;
			this.noiseChannelCount = newNoiseChannels.length;
			this.channels.length = 0;
			Array.prototype.push.apply(this.channels, newPitchChannels);
			Array.prototype.push.apply(this.channels, newNoiseChannels);
		}
		
		public getPattern(channel: number, bar: number): Pattern | null {
			if (bar < 0 || bar >= this.barCount) return null;
			const patternIndex: number = this.channels[channel].bars[bar];
			if (patternIndex == 0) return null;
			return this.channels[channel].patterns[patternIndex - 1];
		}
		
		public getPatternInstrument(channel: number, bar: number): number {
			const pattern: Pattern | null = this.getPattern(channel, bar);
			return pattern == null ? 0 : pattern.instrument;
		}
		
		public getBeatsPerMinute(): number {
			return this.tempo;
		}
	}
	
	export class SynthMessenger {
		
		public samplesPerSecond: number = 44100;
		
		public song: Song | null = null;
		public synthWorklet: AudioWorkletNode | null = null;
		
		public liveInputDuration: number = 0;
		public liveInputStarted: boolean = false;
		public liveInputPitches: number[] = [];
		public liveInputChannel: number = 0;
		public loopRepeatCount: number = -1;
		public volume: number = 1.0;
		
		private playheadInternal: number = 0.0;
		private bar: number = 0;
		private beat: number = 0;
		private part: number = 0;
		private tick: number = 0;
		private isPlayingSong: boolean = false;
		
		private msgQueue: string[] = [];

		//private highpassInput: number = 0.0;
		//private highpassOutput: number = 0.0;
		
		private audioCtx: any | null = null;
		
		public get playing(): boolean {
			return this.isPlayingSong;
		}
		
		public get playhead(): number {
			return this.playheadInternal;
		}
		
		public set playhead(value: number) {
			if (this.song != null) {
				this.playheadInternal = Math.max(0, Math.min(this.song.barCount, value));
				let remainder: number = this.playheadInternal;
				this.bar = Math.floor(remainder);
				remainder = this.song.beatsPerBar * (remainder - this.bar);
				this.beat = Math.floor(remainder);
				remainder = Config.partsPerBeat * (remainder - this.beat);
				this.part = Math.floor(remainder);
				remainder = Config.ticksPerPart * (remainder - this.part);
				this.tick = Math.floor(remainder);
				const samplesPerTick: number = this.getSamplesPerTick();
				remainder = samplesPerTick * (remainder - this.tick);
			}
		}

		public sendMessage(type: MessageFlag, data: any | any[]): void {
			// The first messages sent upon load may need to wait for synthWorklet to exist.
			// The synthWorklet requires a user gesture before activateAudio will be able to set up the worklet.
			// Any messages attempted to be sent before then will be stored and sent in order when possible.

			if (this.synthWorklet == null) {
				this.msgQueue.push(type + data);
			}
			else {
				// Handle sending any queued messages
				while ( this.msgQueue.length > 0 ) {
					let next: string | undefined = this.msgQueue.shift();
					if ( next ) {
						this.synthWorklet.port.postMessage(next);
					}
				}

				this.synthWorklet.port.postMessage(type + data);
				//console.log("Tx: " + type + data);

			}
		}

		// Handle requests for state change operations from synthWorker (song finished playing, song position updated/etc.)

		public receiveMessage(event: MessageEvent) {
			//console.log("Rx: " + event.data);
			const type: MessageFlag = event.data[0];

			switch ( type ) {
				case MessageFlag.Command: {
					
					const data: string = (event.data as string).slice(1);

					switch ( data ) {
						case CommandString.Pause:
							// Pause, but since this is part of a received message from worker that paused, don't tell it to pause as well.
							this.pause(false);
						break;
						case CommandString.DeactivateAudio:
							this.audioCtx.suspend();
						break;
					}
				break;
				}

				case MessageFlag.SongPosition: {
					const data: string[] = (event.data as string).slice(1).split(",");

					this.bar = +data[0];
					this.beat = +data[1];
					this.part = +data[2];

					this.playheadInternal = (((this.tick) / 2.0 + this.part) / Config.partsPerBeat + this.beat) / this.song!.beatsPerBar + this.bar;
		
				break;
				}
			}
		}

		// Direct synthesize request, get from worker
		public synthesize(outputDataL: Float32Array, outputDataR: Float32Array, outputBufferLength: number, playSong: boolean = true): void {
			// TODO: Feed params to worker (do NOT feed arrays, just do some trickery where audio context is connected differently so you can set them in this function)
		}

		// Can be requested from other parts of the project, so feeds this directly into worker.
		public resetEffects(): void {
			// TODO: request to worker
		}
		
		public getSamplesPerBar(): number {
			if (this.song == null) throw new Error();
			return this.getSamplesPerTick() * Config.ticksPerPart * Config.partsPerBeat * this.song.beatsPerBar;
		}
		
		public getTotalBars(enableIntro: boolean, enableOutro: boolean): number {
			if (this.song == null) throw new Error();
			let bars: number = this.song.loopLength * (this.loopRepeatCount + 1);
			if (enableIntro) bars += this.song.loopStart;
			if (enableOutro) bars += this.song.barCount - (this.song.loopStart + this.song.loopLength);
			return bars;
		}
		
		constructor(song: Song | string | null = null) {

			this.audioCtx = this.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
			this.samplesPerSecond = this.audioCtx.sampleRate;
			this.audioCtx.audioWorklet.addModule('beepbox_synth.min.js').then(() => {
	
				// Initialize a worklet with one output containing two channels
				this.synthWorklet = new AudioWorkletNode(this.audioCtx, 'synthWorker', {numberOfOutputs: 1, outputChannelCount: [2]});
	
				this.synthWorklet.port.onmessage = (event: MessageEvent) => {this.receiveMessage(event);};
	
				this.synthWorklet.connect(this.audioCtx.destination);
			});

			if (song != null) this.setSong(song);
		}
		
		public setSong(song: Song | string): void {
			if (typeof(song) == "string") {
				this.song = new Song(song);
				
				this.sendMessage(MessageFlag.LoadSong, song);
			} else if (song instanceof Song) {
				this.song = song;

				this.sendMessage(MessageFlag.LoadSong, song.toBase64String());
			}

		}
		
		public maintainLiveInput(): void {
			this.audioCtx.resume();
			// TODO: Send a message to worker to do this
			// this.liveInputEndTime = Date.now() + 10000.0;
		}
		
		public play(): void {
			if (this.isPlayingSong) return;
			this.isPlayingSong = true;
			this.audioCtx.resume();
			this.sendMessage(MessageFlag.Command, CommandString.Play);
		}
		
		public pause(sendMessage: boolean = true): void {
			if (!this.isPlayingSong) return;
			this.isPlayingSong = false;

			if ( sendMessage ) {
				this.sendMessage(MessageFlag.Command, CommandString.Pause);
			}
		}
		
		public snapToStart(): void {
			this.bar = 0;
			this.snapToBar();
		}
		
		public goToBar(bar: number): void {
			this.bar = bar;
			this.playheadInternal = this.bar;
		}
		
		public snapToBar(): void {
			this.playheadInternal = this.bar;
			this.beat = 0;
			this.part = 0;
			this.tick = 0;
			// TODO: Send a message to worker to do this
			//this.tickSampleCountdown = 0;
		}
		
		public jumpIntoLoop(): void {
			if (!this.song) return;
			if (this.bar < this.song.loopStart || this.bar >= this.song.loopStart + this.song.loopLength) {
				const oldBar: number = this.bar;
				this.bar = this.song.loopStart;
				this.playheadInternal += this.bar - oldBar;
			}
		}
		
		public nextBar(): void {
			if (!this.song) return;
			const oldBar: number = this.bar;
			this.bar++;
			if (this.bar >= this.song.barCount) {
				this.bar = 0;
			}
			this.playheadInternal += this.bar - oldBar;
		}
		
		public prevBar(): void {
			if (!this.song) return;
			const oldBar: number = this.bar;
			this.bar--;
			if (this.bar < 0 || this.bar >= this.song.barCount) {
				this.bar = this.song.barCount - 1;
			}
			this.playheadInternal += this.bar - oldBar;
		}

		public static instrumentVolumeToVolumeMult(instrumentVolume: number): number {
			return (instrumentVolume == Config.volumeRange - 1) ? 0.0 : Math.pow(2, Config.volumeLogScale * instrumentVolume);
		}
		public static volumeMultToInstrumentVolume(volumeMult: number): number {
			return (volumeMult <= 0.0) ? Config.volumeRange - 1 : Math.min(Config.volumeRange - 2, (Math.log(volumeMult) / Math.LN2) / Config.volumeLogScale);
		}
		public static expressionToVolumeMult(expression: number): number {
			return Math.pow(Math.max(0.0, expression) / 3.0, 1.5);
		}
		public static volumeMultToExpression(volumeMult: number): number {
			return Math.pow(Math.max(0.0, volumeMult), 1/1.5) * 3.0;
		}
		
		private getSamplesPerTick(): number {
			if (this.song == null) return 0;
			const beatsPerMinute: number = this.song.getBeatsPerMinute();
			const beatsPerSecond: number = beatsPerMinute / 60.0;
			const partsPerSecond: number = Config.partsPerBeat * beatsPerSecond;
			const tickPerSecond: number = Config.ticksPerPart * partsPerSecond;
			return this.samplesPerSecond / tickPerSecond;
		}
	}
	
	// When compiling synth.ts as a standalone module named "beepbox", expose these classes as members to JavaScript:
	export {Dictionary, DictionaryArray, EnvelopeType, InstrumentType, Transition, Chord, Envelope, Config, MessageFlag, CommandString};
//}
