// Copyright (C) 2021 Jummbus, distributed under the MIT license.

import {Song, Note, Pattern, NotePin, Instrument, MessageFlag, CommandString} from "./synthMessenger";
import {Dictionary, EnvelopeType, InstrumentType, Transition, Chord, Envelope, Config, getArpeggioPitchIndex} from "./SynthConfig";
import {Deque} from "./Deque";

class Tone {
	public instrument: Instrument;
	public readonly pitches: number[] = [0, 0, 0, 0];
	public pitchCount: number = 0;
	public chordSize: number = 0;
	public drumsetPitch: number = 0;
	public note: Note | null = null;
	public prevNote: Note | null = null;
	public nextNote: Note | null = null;
	public prevNotePitchIndex: number = 0;
	public nextNotePitchIndex: number = 0;
	public active: boolean = false;
	public noteStart: number = 0;
	public noteEnd: number = 0;
	public noteLengthTicks: number = 0;
	public ticksSinceReleased: number = 0;
	public liveInputSamplesHeld: number = 0;
	public lastInterval: number = 0;
	public lastVolume: number = 0;
	public stereoVolume1: number = 0.0;
	public stereoVolume2: number = 0.0;
	public stereoOffset: number = 0.0;
	public stereoDelay: number = 0.0;
	public sample: number = 0.0;
	public readonly phases: number[] = [];
	public readonly phaseDeltas: number[] = [];
	public readonly volumeStarts: number[] = [];
	public readonly volumeDeltas: number[] = [];
	public volumeStart: number = 0.0;
	public volumeDelta: number = 0.0;
	public phaseDeltaScale: number = 0.0;
	public pulseWidth: number = 0.0;
	public pulseWidthDelta: number = 0.0;
	public filter: number = 0.0;
	public filterScale: number = 0.0;
	public filterSample0: number = 0.0;
	public filterSample1: number = 0.0;
	public vibratoScale: number = 0.0;
	public intervalMult: number = 0.0;
	public intervalVolumeMult: number = 1.0;
	public feedbackOutputs: number[] = [];
	public feedbackMult: number = 0.0;
	public feedbackDelta: number = 0.0;
	
	constructor() {
		this.reset();
	}
	
	public reset(): void {
		for (let i: number = 0; i < Config.operatorCount; i++) {
			this.phases[i] = 0.0;
			this.feedbackOutputs[i] = 0.0;
		}
		this.sample = 0.0;
		this.filterSample0 = 0.0;
		this.filterSample1 = 0.0;
		this.liveInputSamplesHeld = 0.0;
	}
}

// *** Declarations of AudioWorkletProcessor related functions. Should be caught by types-web but it is not working currently.
interface AudioWorkletProcessor {
	readonly port: MessagePort;
	process(
	  inputs: Float32Array[][],
	  outputs: Float32Array[][],
	  parameters: Record<string, Float32Array>
	): boolean;
  }
  
  declare var AudioWorkletProcessor: {
	prototype: AudioWorkletProcessor;
	new (options?: AudioWorkletNodeOptions): AudioWorkletProcessor;
  };
  
  declare function registerProcessor(
	name: string,
	processorCtor: (new (
	  options?: AudioWorkletNodeOptions
	) => AudioWorkletProcessor) & {
	  parameterDescriptors?: AudioParamDescriptor[];
	}
  ): undefined;
  
interface AudioParamDescriptor {
	name: string;
	defaultValue?: number;
	minValue?: number;
	maxValue?: number;
	automationRate?: "a-rate" | "k-rate";
}
// ***

class SynthWorker extends AudioWorkletProcessor {
	constructor() {
		super();
		this.port.onmessage = (event: MessageEvent) => {this.receiveMessage(event);};
	}

	public samplesPerSecond: number = 44100;
		
	public song: Song | null = null;
	public liveInputDuration: number = 0;
	public liveInputStarted: boolean = false;
	public liveInputPitches: number[] = [];
	public liveInputChannel: number = 0;
	public loopRepeatCount: number = -1;
	public volume: number = 1.0;
	
	private bar: number = 0;
	private beat: number = 0;
	private part: number = 0;
	private tick: number = 0;
	private tickSampleCountdown: number = 0;
	private isPlayingSong: boolean = false;
	private liveInputEndTime: number = 0.0;
	
	private readonly tonePool: Deque<Tone> = new Deque<Tone>();
	private readonly activeTones: Array<Deque<Tone>> = [];
	private readonly releasedTones: Array<Deque<Tone>> = [];
	private readonly liveInputTones: Deque<Tone> = new Deque<Tone>();
	
	//private highpassInput: number = 0.0;
	//private highpassOutput: number = 0.0;
	private limit: number = 0.0;
	
	private stereoBufferIndex: number = 0;
	private samplesForNone: Float32Array | null = null;
	private samplesForReverb: Float32Array | null = null;
	private samplesForChorus: Float32Array | null = null;
	private samplesForChorusReverb: Float32Array | null = null;
	
	private chorusDelayLine: Float32Array = new Float32Array(2048);
	private chorusDelayPos: number = 0;
	private chorusPhase: number = 0;
	
	private reverbDelayLine: Float32Array = new Float32Array(16384);
	private reverbDelayPos: number = 0;
	private reverbFeedback0: number = 0.0;
	private reverbFeedback1: number = 0.0;
	private reverbFeedback2: number = 0.0;
	private reverbFeedback3: number = 0.0;

	public wasPlayingAudio: boolean = false;

	// Handle requests for state change from synthMessenger (song data updated, play/pause, etc.)
	public receiveMessage(event: MessageEvent): void {
		//console.log("Rx: " + event.data);
		const type: MessageFlag = event.data[0];
		const data: string = (event.data as string).slice(1);

		switch ( type ) {
			case MessageFlag.Command:
				switch ( data ) {
					case CommandString.Play:
						this.play();
					break;
					case CommandString.Pause:
						this.pause();
					break;
				}
			break;
			case MessageFlag.LoadSong:
				this.setSong(data);
			break;
		}
	}

	public sendMessage(type: MessageFlag, data: any[]) {
		this.port.postMessage(type + data.join());
	}

	public process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
		//console.log("proc " + this.wasPlayingAudio);
		const outputBuffer = outputs[0];
		const outputDataL: Float32Array = outputBuffer[0];
		const outputDataR: Float32Array = outputBuffer[1];
		
		const isPlayingLiveTones = Date.now() < this.liveInputEndTime;
		if (!isPlayingLiveTones && !this.isPlayingSong) {
			for (let i: number = 0; i < outputBuffer.length; i++) {
				outputDataL[i] = 0.0;
				outputDataR[i] = 0.0;
			}
			// There is a race condition when the messenger asks to play: The audioContext can resume before the "play" message arrives.
			// Therefore the assumption is that the first calls of process before a successful process are from such a condition.
			// In this case, just return without deactivating audio.
			if ( this.wasPlayingAudio ) {
				this.deactivateAudio();
				return true; // false - seems to garbage collect unintentionally?
			} else {
				return true;
			}
		} else {
			this.synthesize(outputDataL, outputDataR, outputBuffer.length, this.isPlayingSong);
			this.wasPlayingAudio = true;
		}

		return true;
	}

	public setSong(song: Song | string): void {
		if (typeof(song) == "string") {
			this.song = new Song(song);
		} else if (song instanceof Song) {
			this.song = song;
		}
	}

	private deactivateAudio(): void {
		// Deactivation actually happens in messenger, so send a request
		this.sendMessage(MessageFlag.Command, [CommandString.DeactivateAudio]);
		this.wasPlayingAudio = false;
	}

	public play(): void {
		if (this.isPlayingSong) return;
		this.isPlayingSong = true;
		SynthWorker.warmUpSynthesizer(this.song);
	}
	
	public pause(): void {
		if (!this.isPlayingSong) return;
		this.isPlayingSong = false;
	}

	private static warmUpSynthesizer(song: Song | null): void {
		// Don't bother to generate the drum waves unless the song actually
		// uses them, since they may require a lot of computation.
		if (song != null) {
			for (let j: number = 0; j < song.getChannelCount(); j++) {
				for (let i: number = 0; i < song.instrumentsPerChannel; i++) {
					SynthWorker.getInstrumentSynthFunction(song.channels[j].instruments[i]);
					song.channels[j].instruments[i].warmUp();
				}
			}
		}
	}
	
	public resetEffects(): void {
		this.reverbDelayPos = 0;
		this.reverbFeedback0 = 0.0;
		this.reverbFeedback1 = 0.0;
		this.reverbFeedback2 = 0.0;
		this.reverbFeedback3 = 0.0;
		//this.highpassInput = 0.0;
		//this.highpassOutput = 0.0;
		this.freeAllTones();
		for (let i: number = 0; i < this.reverbDelayLine.length; i++) this.reverbDelayLine[i] = 0.0;
		for (let i: number = 0; i < this.chorusDelayLine.length; i++) this.chorusDelayLine[i] = 0.0;
		if (this.samplesForNone != null) for (let i: number = 0; i < this.samplesForNone.length; i++) this.samplesForNone[i] = 0.0;
		if (this.samplesForReverb != null) for (let i: number = 0; i < this.samplesForReverb.length; i++) this.samplesForReverb[i] = 0.0;
		if (this.samplesForChorus != null) for (let i: number = 0; i < this.samplesForChorus.length; i++) this.samplesForChorus[i] = 0.0;
		if (this.samplesForChorusReverb != null) for (let i: number = 0; i < this.samplesForChorusReverb.length; i++) this.samplesForChorusReverb[i] = 0.0;
	}
	
	public synthesize(outputDataL: Float32Array, outputDataR: Float32Array, outputBufferLength: number, playSong: boolean = true): void {
		if (this.song == null) {
			for (let i: number = 0; i < outputBufferLength; i++) {
				outputDataL[i] = 0.0;
				outputDataR[i] = 0.0;
			}
			this.deactivateAudio();
			return;
		}
		
		const channelCount: number = this.song.getChannelCount();
		for (let i: number = this.activeTones.length; i < channelCount; i++) {
			this.activeTones[i] = new Deque<Tone>();
			this.releasedTones[i] = new Deque<Tone>();
		}
		this.activeTones.length = channelCount;
		this.releasedTones.length = channelCount;
		
		const samplesPerTick: number = this.getSamplesPerTick();
		let bufferIndex: number = 0;
		let ended: boolean = false;
		
		// Check the bounds of the playhead:
		while (this.tickSampleCountdown <= 0) this.tickSampleCountdown += samplesPerTick;
		if (this.tickSampleCountdown > samplesPerTick) this.tickSampleCountdown = samplesPerTick;
		if (playSong) {
			if (this.beat >= this.song.beatsPerBar) {
				this.bar++;
				this.beat = 0;
				this.part = 0;
				this.tick = 0;
				this.tickSampleCountdown = samplesPerTick;
			
				if (this.loopRepeatCount != 0 && this.bar == this.song.loopStart + this.song.loopLength) {
					this.bar = this.song.loopStart;
					if (this.loopRepeatCount > 0) this.loopRepeatCount--;
				}
			}
			if (this.bar >= this.song.barCount) {
				this.bar = 0;
				if (this.loopRepeatCount != -1) {
					ended = true;
					this.pause();
				}
			}
		}
		
		//const synthStartTime: number = performance.now();
		
		const stereoBufferLength: number = outputBufferLength * 4;
		if (this.samplesForNone == null || this.samplesForNone.length != stereoBufferLength ||
			this.samplesForReverb == null || this.samplesForReverb.length != stereoBufferLength ||
			this.samplesForChorus == null || this.samplesForChorus.length != stereoBufferLength ||
			this.samplesForChorusReverb == null || this.samplesForChorusReverb.length != stereoBufferLength)
		{
			this.samplesForNone = new Float32Array(stereoBufferLength);
			this.samplesForReverb = new Float32Array(stereoBufferLength);
			this.samplesForChorus = new Float32Array(stereoBufferLength);
			this.samplesForChorusReverb = new Float32Array(stereoBufferLength);
			this.stereoBufferIndex = 0;
		}
		let stereoBufferIndex: number = this.stereoBufferIndex;
		const samplesForNone: Float32Array = this.samplesForNone;
		const samplesForReverb: Float32Array = this.samplesForReverb;
		const samplesForChorus: Float32Array = this.samplesForChorus;
		const samplesForChorusReverb: Float32Array = this.samplesForChorusReverb;
		
		// Post processing parameters:
		const volume: number = +this.volume;
		const chorusDelayLine: Float32Array = this.chorusDelayLine;
		const reverbDelayLine: Float32Array = this.reverbDelayLine;
		const chorusDuration: number = 2.0;
		const chorusAngle: number = Math.PI * 2.0 / (chorusDuration * this.samplesPerSecond);
		const chorusRange: number = 150 * this.samplesPerSecond / 44100;
		const chorusOffset0: number = 0x800 - 1.51 * chorusRange;
		const chorusOffset1: number = 0x800 - 2.10 * chorusRange;
		const chorusOffset2: number = 0x800 - 3.35 * chorusRange;
		const chorusOffset3: number = 0x800 - 1.47 * chorusRange;
		const chorusOffset4: number = 0x800 - 2.15 * chorusRange;
		const chorusOffset5: number = 0x800 - 3.25 * chorusRange;
		let chorusPhase: number = this.chorusPhase % (Math.PI * 2.0);
		let chorusDelayPos: number = this.chorusDelayPos & 0x7FF;
		let reverbDelayPos: number = this.reverbDelayPos & 0x3FFF;
		let reverbFeedback0: number = +this.reverbFeedback0;
		let reverbFeedback1: number = +this.reverbFeedback1;
		let reverbFeedback2: number = +this.reverbFeedback2;
		let reverbFeedback3: number = +this.reverbFeedback3;
		const reverb: number = Math.pow(this.song.reverb / Config.reverbRange, 0.667) * 0.425;
		//const highpassFilter: number = Math.pow(0.5, 400 / this.samplesPerSecond);
		const limitDecay: number = 1.0 - Math.pow(0.5, 4.0 / this.samplesPerSecond);
		const limitRise: number = 1.0 - Math.pow(0.5, 4000.0 / this.samplesPerSecond);
		//let highpassInput: number = +this.highpassInput;
		//let highpassOutput: number = +this.highpassOutput;
		let limit: number = +this.limit;
		
		while (bufferIndex < outputBufferLength && !ended) {
			
			const samplesLeftInBuffer: number = outputBufferLength - bufferIndex;
			const runLength: number = Math.min(Math.ceil(this.tickSampleCountdown), samplesLeftInBuffer);
			for (let channel: number = 0; channel < this.song.getChannelCount(); channel++) {

				if (channel == this.liveInputChannel) {
					this.determineLiveInputTones(this.song);

					for (let i: number = 0; i < this.liveInputTones.count(); i++) {
						const tone: Tone = this.liveInputTones.get(i);
						this.playTone(this.song, stereoBufferIndex, stereoBufferLength, channel, samplesPerTick, runLength, tone, false, false);
					}
				}

				this.determineCurrentActiveTones(this.song, channel, playSong);
				for (let i: number = 0; i < this.activeTones[channel].count(); i++) {
					const tone: Tone = this.activeTones[channel].get(i);
					this.playTone(this.song, stereoBufferIndex, stereoBufferLength, channel, samplesPerTick, runLength, tone, false, false);
				}
				for (let i: number = 0; i < this.releasedTones[channel].count(); i++) {
					const tone: Tone = this.releasedTones[channel].get(i);
					if (tone.ticksSinceReleased >= tone.instrument.getTransition().releaseTicks) {
						this.freeReleasedTone(channel, i);
						i--;
						continue;
					}

					const shouldFadeOutFast: boolean = (i + this.activeTones[channel].count() >= Config.maximumTonesPerChannel);

					this.playTone(this.song, stereoBufferIndex, stereoBufferLength, channel, samplesPerTick, runLength, tone, true, shouldFadeOutFast);
				}
			}
			
			// Post processing:
			let chorusTap0Index: number = chorusDelayPos + chorusOffset0 - chorusRange * Math.sin(chorusPhase + 0);
			let chorusTap1Index: number = chorusDelayPos + chorusOffset1 - chorusRange * Math.sin(chorusPhase + 2.1);
			let chorusTap2Index: number = chorusDelayPos + chorusOffset2 - chorusRange * Math.sin(chorusPhase + 4.2);
			let chorusTap3Index: number = chorusDelayPos + 0x400 + chorusOffset3 - chorusRange * Math.sin(chorusPhase + 3.2);
			let chorusTap4Index: number = chorusDelayPos + 0x400 + chorusOffset4 - chorusRange * Math.sin(chorusPhase + 5.3);
			let chorusTap5Index: number = chorusDelayPos + 0x400 + chorusOffset5 - chorusRange * Math.sin(chorusPhase + 1.0);
			chorusPhase += chorusAngle * runLength;
			const chorusTap0End: number = chorusDelayPos + runLength + chorusOffset0 - chorusRange * Math.sin(chorusPhase + 0);
			const chorusTap1End: number = chorusDelayPos + runLength + chorusOffset1 - chorusRange * Math.sin(chorusPhase + 2.1);
			const chorusTap2End: number = chorusDelayPos + runLength + chorusOffset2 - chorusRange * Math.sin(chorusPhase + 4.2);
			const chorusTap3End: number = chorusDelayPos + runLength + 0x400 + chorusOffset3 - chorusRange * Math.sin(chorusPhase + 3.2);
			const chorusTap4End: number = chorusDelayPos + runLength + 0x400 + chorusOffset4 - chorusRange * Math.sin(chorusPhase + 5.3);
			const chorusTap5End: number = chorusDelayPos + runLength + 0x400 + chorusOffset5 - chorusRange * Math.sin(chorusPhase + 1.0);
			const chorusTap0Delta: number = (chorusTap0End - chorusTap0Index) / runLength;
			const chorusTap1Delta: number = (chorusTap1End - chorusTap1Index) / runLength;
			const chorusTap2Delta: number = (chorusTap2End - chorusTap2Index) / runLength;
			const chorusTap3Delta: number = (chorusTap3End - chorusTap3Index) / runLength;
			const chorusTap4Delta: number = (chorusTap4End - chorusTap4Index) / runLength;
			const chorusTap5Delta: number = (chorusTap5End - chorusTap5Index) / runLength;
			const runEnd: number = bufferIndex + runLength;
			for (let i: number = bufferIndex; i < runEnd; i++) {
				const bufferIndexL: number = stereoBufferIndex;
				const bufferIndexR: number = stereoBufferIndex + 1;
				const sampleForNoneL: number = samplesForNone[bufferIndexL]; samplesForNone[bufferIndexL] = 0.0;
				const sampleForNoneR: number = samplesForNone[bufferIndexR]; samplesForNone[bufferIndexR] = 0.0;
				const sampleForReverbL: number = samplesForReverb[bufferIndexL]; samplesForReverb[bufferIndexL] = 0.0;
				const sampleForReverbR: number = samplesForReverb[bufferIndexR]; samplesForReverb[bufferIndexR] = 0.0;
				const sampleForChorusL: number = samplesForChorus[bufferIndexL]; samplesForChorus[bufferIndexL] = 0.0;
				const sampleForChorusR: number = samplesForChorus[bufferIndexR]; samplesForChorus[bufferIndexR] = 0.0;
				const sampleForChorusReverbL: number = samplesForChorusReverb[bufferIndexL]; samplesForChorusReverb[bufferIndexL] = 0.0;
				const sampleForChorusReverbR: number = samplesForChorusReverb[bufferIndexR]; samplesForChorusReverb[bufferIndexR] = 0.0;
				stereoBufferIndex += 2;
				
				const combinedChorusL: number = sampleForChorusL + sampleForChorusReverbL;
				const combinedChorusR: number = sampleForChorusR + sampleForChorusReverbR;
				
				const chorusTap0Ratio: number = chorusTap0Index % 1;
				const chorusTap1Ratio: number = chorusTap1Index % 1;
				const chorusTap2Ratio: number = chorusTap2Index % 1;
				const chorusTap3Ratio: number = chorusTap3Index % 1;
				const chorusTap4Ratio: number = chorusTap4Index % 1;
				const chorusTap5Ratio: number = chorusTap5Index % 1;
				const chorusTap0A: number = chorusDelayLine[(chorusTap0Index) & 0x7FF];
				const chorusTap0B: number = chorusDelayLine[(chorusTap0Index + 1) & 0x7FF];
				const chorusTap1A: number = chorusDelayLine[(chorusTap1Index) & 0x7FF];
				const chorusTap1B: number = chorusDelayLine[(chorusTap1Index + 1) & 0x7FF];
				const chorusTap2A: number = chorusDelayLine[(chorusTap2Index) & 0x7FF];
				const chorusTap2B: number = chorusDelayLine[(chorusTap2Index + 1) & 0x7FF];
				const chorusTap3A: number = chorusDelayLine[(chorusTap3Index) & 0x7FF];
				const chorusTap3B: number = chorusDelayLine[(chorusTap3Index + 1) & 0x7FF];
				const chorusTap4A: number = chorusDelayLine[(chorusTap4Index) & 0x7FF];
				const chorusTap4B: number = chorusDelayLine[(chorusTap4Index + 1) & 0x7FF];
				const chorusTap5A: number = chorusDelayLine[(chorusTap5Index) & 0x7FF];
				const chorusTap5B: number = chorusDelayLine[(chorusTap5Index + 1) & 0x7FF];
				const chorusTap0: number = chorusTap0A + (chorusTap0B - chorusTap0A) * chorusTap0Ratio;
				const chorusTap1: number = chorusTap1A + (chorusTap1B - chorusTap1A) * chorusTap1Ratio;
				const chorusTap2: number = chorusTap2A + (chorusTap2B - chorusTap2A) * chorusTap2Ratio;
				const chorusTap3: number = chorusTap3A + (chorusTap3B - chorusTap3A) * chorusTap3Ratio;
				const chorusTap4: number = chorusTap4A + (chorusTap4B - chorusTap4A) * chorusTap4Ratio;
				const chorusTap5: number = chorusTap5A + (chorusTap5B - chorusTap5A) * chorusTap5Ratio;
				const chorusSampleL = 0.5 * (combinedChorusL - chorusTap0 + chorusTap1 - chorusTap2);
				const chorusSampleR = 0.5 * (combinedChorusR - chorusTap3 + chorusTap4 - chorusTap5);
				chorusDelayLine[chorusDelayPos] = combinedChorusL;
				chorusDelayLine[(chorusDelayPos + 0x400) & 0x7FF] = combinedChorusR;
				chorusDelayPos = (chorusDelayPos + 1) & 0x7FF;
				chorusTap0Index += chorusTap0Delta;
				chorusTap1Index += chorusTap1Delta;
				chorusTap2Index += chorusTap2Delta;
				chorusTap3Index += chorusTap3Delta;
				chorusTap4Index += chorusTap4Delta;
				chorusTap5Index += chorusTap5Delta;
				
				// Reverb, implemented using a feedback delay network with a Hadamard matrix and lowpass filters.
				// good ratios:    0.555235 + 0.618033 + 0.818 +   1.0 = 2.991268
				// Delay lengths:  3041     + 3385     + 4481  +  5477 = 16384 = 2^14
				// Buffer offsets: 3041    -> 6426   -> 10907 -> 16384
				const reverbDelayPos1: number = (reverbDelayPos +  3041) & 0x3FFF;
				const reverbDelayPos2: number = (reverbDelayPos +  6426) & 0x3FFF;
				const reverbDelayPos3: number = (reverbDelayPos + 10907) & 0x3FFF;
				const reverbSample0: number = (reverbDelayLine[reverbDelayPos]);
				const reverbSample1: number = reverbDelayLine[reverbDelayPos1];
				const reverbSample2: number = reverbDelayLine[reverbDelayPos2];
				const reverbSample3: number = reverbDelayLine[reverbDelayPos3];
				const reverbTemp0: number = -(reverbSample0 + sampleForChorusReverbL + sampleForReverbL) + reverbSample1;
				const reverbTemp1: number = -(reverbSample0 + sampleForChorusReverbR + sampleForReverbR) - reverbSample1;
				const reverbTemp2: number = -reverbSample2 + reverbSample3;
				const reverbTemp3: number = -reverbSample2 - reverbSample3;
				reverbFeedback0 += ((reverbTemp0 + reverbTemp2) * reverb - reverbFeedback0) * 0.5;
				reverbFeedback1 += ((reverbTemp1 + reverbTemp3) * reverb - reverbFeedback1) * 0.5;
				reverbFeedback2 += ((reverbTemp0 - reverbTemp2) * reverb - reverbFeedback2) * 0.5;
				reverbFeedback3 += ((reverbTemp1 - reverbTemp3) * reverb - reverbFeedback3) * 0.5;
				reverbDelayLine[reverbDelayPos1] = reverbFeedback0;
				reverbDelayLine[reverbDelayPos2] = reverbFeedback1;
				reverbDelayLine[reverbDelayPos3] = reverbFeedback2;
				reverbDelayLine[reverbDelayPos ] = reverbFeedback3;
				reverbDelayPos = (reverbDelayPos + 1) & 0x3FFF;
				
				const sampleL = sampleForNoneL + chorusSampleL + sampleForReverbL + reverbSample1 + reverbSample2 + reverbSample3;
				const sampleR = sampleForNoneR + chorusSampleR + sampleForReverbR + reverbSample0 + reverbSample2 - reverbSample3;
				
				/*
				highpassOutput = highpassOutput * highpassFilter + sample - highpassInput;
				highpassInput = sample;
				// use highpassOutput instead of sample below?
				*/
				
				// A compressor/limiter.
				const absL: number = sampleL < 0.0 ? -sampleL : sampleL;
				const absR: number = sampleR < 0.0 ? -sampleR : sampleR;
				const abs: number = absL > absR ? absL : absR;
				limit += (abs - limit) * (limit < abs ? limitRise : limitDecay);
				const limitedVolume = volume / (limit >= 1 ? limit * 1.05 : limit * 0.8 + 0.25);
				outputDataL[i] = sampleL * limitedVolume;
				outputDataR[i] = sampleR * limitedVolume;
			}
			
			bufferIndex += runLength;
			
			this.tickSampleCountdown -= runLength;
			if (this.tickSampleCountdown <= 0) {
				
				// Track how long tones have been released, and free them if there are too many.
				for (let channel: number = 0; channel < this.song.getChannelCount(); channel++) {
					for (let i: number = 0; i < this.releasedTones[channel].count(); i++) {
						const tone: Tone = this.releasedTones[channel].get(i);
						tone.ticksSinceReleased++;

						const shouldFadeOutFast: boolean = (i + this.activeTones[channel].count() >= Config.maximumTonesPerChannel);
						if (shouldFadeOutFast) {
							this.freeReleasedTone(channel, i);
							i--;
						}
					}
				}
				
				this.tick++;
				this.tickSampleCountdown += samplesPerTick;
				if (this.tick == Config.ticksPerPart) {
					this.tick = 0;
					this.part++;
					this.liveInputDuration--;
			
					this.sendMessage(MessageFlag.SongPosition, [this.bar, this.beat, this.part]);
					
					// Check if any active tones should be released.
					for (let channel: number = 0; channel < this.song.getChannelCount(); channel++) {
						for (let i: number = 0; i < this.activeTones[channel].count(); i++) {
							const tone: Tone = this.activeTones[channel].get(i);
							const transition: Transition = tone.instrument.getTransition();
							if (!transition.isSeamless && tone.note != null && tone.note.end == this.part + this.beat * Config.partsPerBeat) {
								if (transition.releases) {
									this.releaseTone(channel, tone);
								} else {
									this.freeTone(tone);
								}
								this.activeTones[channel].remove(i);
								i--;
							}
						}
					}
					
					if (this.part == Config.partsPerBeat) {
						this.part = 0;
						
						if (playSong) {
							this.beat++;
							if (this.beat == this.song.beatsPerBar) {
								// bar changed, reset for next bar:
								this.beat = 0;
								this.bar++;
								if (this.loopRepeatCount != 0 && this.bar == this.song.loopStart + this.song.loopLength) {
									this.bar = this.song.loopStart;
									if (this.loopRepeatCount > 0) this.loopRepeatCount--;
								}
								if (this.bar >= this.song.barCount) {
									this.bar = 0;
									if (this.loopRepeatCount != -1) {
										ended = true;
										this.resetEffects();
										this.pause();
									}
								}
							}
						}
					}
				}
			}
		}
		
		// Optimization: Avoid persistent reverb values in the float denormal range.
		const epsilon: number = (1.0e-24);
		if (-epsilon < reverbFeedback0 && reverbFeedback0 < epsilon) reverbFeedback0 = 0.0;
		if (-epsilon < reverbFeedback1 && reverbFeedback1 < epsilon) reverbFeedback1 = 0.0;
		if (-epsilon < reverbFeedback2 && reverbFeedback2 < epsilon) reverbFeedback2 = 0.0;
		if (-epsilon < reverbFeedback3 && reverbFeedback3 < epsilon) reverbFeedback3 = 0.0;
		//if (-epsilon < highpassInput && highpassInput < epsilon) highpassInput = 0.0;
		//if (-epsilon < highpassOutput && highpassOutput < epsilon) highpassOutput = 0.0;
		if (-epsilon < limit && limit < epsilon) limit = 0.0;
		
		this.stereoBufferIndex = (this.stereoBufferIndex + outputBufferLength * 2) % stereoBufferLength;
		this.chorusPhase = chorusPhase;
		this.chorusDelayPos = chorusDelayPos;
		this.reverbDelayPos = reverbDelayPos;
		this.reverbFeedback0 = reverbFeedback0;
		this.reverbFeedback1 = reverbFeedback1;
		this.reverbFeedback2 = reverbFeedback2;
		this.reverbFeedback3 = reverbFeedback3;
		//this.highpassInput = highpassInput;
		//this.highpassOutput = highpassOutput;
		this.limit = limit;
		
		/*
		const synthDuration: number = performance.now() - synthStartTime;
		// Performance measurements:
		samplesAccumulated += outputBufferLength;
		samplePerformance += synthDuration;
		
		if (samplesAccumulated >= 44100 * 4) {
			const secondsGenerated = samplesAccumulated / 44100;
			const secondsRequired = samplePerformance / 1000;
			const ratio = secondsRequired / secondsGenerated;
			console.log(ratio);
			samplePerformance = 0;
			samplesAccumulated = 0;
		}
		*/
	}
	
	private freeTone(tone: Tone): void {
		this.tonePool.pushBack(tone);
	}
	
	private newTone(): Tone {
		if (this.tonePool.count() > 0) {
			const tone: Tone = this.tonePool.popBack();
			tone.reset();
			tone.active = false;
			return tone;
		}
		return new Tone();
	}
	
	private releaseTone(channel: number, tone: Tone): void {
		this.releasedTones[channel].pushFront(tone);
	}
	
	private freeReleasedTone(channel: number, toneIndex: number): void {
		this.freeTone(this.releasedTones[channel].get(toneIndex));
		this.releasedTones[channel].remove(toneIndex);
	}
	
	public freeAllTones(): void {
		while (this.liveInputTones.count() > 0) {
			this.freeTone(this.liveInputTones.popBack());
		}
		for (let i: number = 0; i < this.activeTones.length; i++) {
			while (this.activeTones[i].count() > 0) {
				this.freeTone(this.activeTones[i].popBack());
			}
		}
		for (let i: number = 0; i < this.releasedTones.length; i++) {
			while (this.releasedTones[i].count() > 0) {
				this.freeTone(this.releasedTones[i].popBack());
			}
		}
	}
	
	private determineLiveInputTones(song: Song): void {
		const toneList: Deque<Tone> = this.liveInputTones;
		const pitches: number[] = this.liveInputPitches;
		let toneCount: number = 0;
		if (this.liveInputDuration > 0) {
			const instrument: Instrument = song.channels[this.liveInputChannel].instruments[song.getPatternInstrument(this.liveInputChannel, this.bar)];
			
			if (instrument.getChord().arpeggiates) {
				let tone: Tone;
				if (toneList.count() == 0) {
					tone = this.newTone();
					toneList.pushBack(tone);
				} else if (!instrument.getTransition().isSeamless && this.liveInputStarted) {
					this.releaseTone(this.liveInputChannel, toneList.popFront());
					tone = this.newTone();
					toneList.pushBack(tone);
				} else {
					tone = toneList.get(0);
				}
				toneCount = 1;
			
				for (let i: number = 0; i < pitches.length; i++) {
					tone.pitches[i] = pitches[i];
				}
				tone.pitchCount = pitches.length;
				tone.chordSize = 1;
				tone.instrument = instrument;
				tone.note = tone.prevNote = tone.nextNote = null;
			} else {
				//const transition: Transition = instrument.getTransition();
				for (let i: number = 0; i < pitches.length; i++) {
					//const strumOffsetParts: number = i * instrument.getChord().strumParts;

					let tone: Tone;
					if (toneList.count() <= i) {
						tone = this.newTone();
						toneList.pushBack(tone);
					} else if (!instrument.getTransition().isSeamless && this.liveInputStarted) {
						this.releaseTone(this.liveInputChannel, toneList.get(i));
						tone = this.newTone();
						toneList.set(i, tone);
					} else {
						tone = toneList.get(i);
					}
					toneCount++;

					tone.pitches[0] = pitches[i];
					tone.pitchCount = 1;
					tone.chordSize = pitches.length;
					tone.instrument = instrument;
					tone.note = tone.prevNote = tone.nextNote = null;
				}
			}
		}
		
		while (toneList.count() > toneCount) {
			this.releaseTone(this.liveInputChannel, toneList.popBack());
		}
		
		this.liveInputStarted = false;
	}
	
	private determineCurrentActiveTones(song: Song, channel: number, playSong: boolean): void {
		const instrument: Instrument = song.channels[channel].instruments[song.getPatternInstrument(channel, this.bar)];
		const pattern: Pattern | null = song.getPattern(channel, this.bar);
		const time: number = this.part + this.beat * Config.partsPerBeat;
		let note: Note | null = null;
		let prevNote: Note | null = null;
		let nextNote: Note | null = null;
		
		if (playSong && pattern != null && !song.channels[channel].muted) {
			for (let i: number = 0; i < pattern.notes.length; i++) {
				if (pattern.notes[i].end <= time) {
					prevNote = pattern.notes[i];
				} else if (pattern.notes[i].start <= time && pattern.notes[i].end > time) {
					note = pattern.notes[i];
				} else if (pattern.notes[i].start > time) {
					nextNote = pattern.notes[i];
					break;
				}
			}
		}
		
		const toneList: Deque<Tone> = this.activeTones[channel];
		if (note != null) {
			if (prevNote != null && prevNote.end != note.start) prevNote = null;
			if (nextNote != null && nextNote.start != note.end) nextNote = null;
			this.syncTones(channel, toneList, instrument, note.pitches, note, prevNote, nextNote, time);
		} else {
			while (toneList.count() > 0) {
				// Automatically free or release seamless tones if there's no new note to take over.
				if (toneList.peakBack().instrument.getTransition().releases) {
					this.releaseTone(channel, toneList.popBack());
				} else {
					this.freeTone(toneList.popBack());
				}
			}
		}
	}
	
	private syncTones(channel: number, toneList: Deque<Tone>, instrument: Instrument, pitches: number[], note: Note, prevNote: Note | null, nextNote: Note | null, currentPart: number): void {
		let toneCount: number = 0;
		if (instrument.getChord().arpeggiates) {
			let tone: Tone;
			if (toneList.count() == 0) {
				tone = this.newTone();
				toneList.pushBack(tone);
			} else {
				tone = toneList.get(0);
			}
			toneCount = 1;

			for (let i: number = 0; i < pitches.length; i++) {
				tone.pitches[i] = pitches[i];
			}
			tone.pitchCount = pitches.length;
			tone.chordSize = 1;
			tone.instrument = instrument;
			tone.note = note;
			tone.noteStart = note.start;
			tone.noteEnd = note.end;
			tone.prevNote = prevNote;
			tone.nextNote = nextNote;
			tone.prevNotePitchIndex = 0;
			tone.nextNotePitchIndex = 0;
		} else {
			const transition: Transition = instrument.getTransition();
			for (let i: number = 0; i < pitches.length; i++) {

				const strumOffsetParts: number = i * instrument.getChord().strumParts;
				let prevNoteForThisTone: Note | null = (prevNote && prevNote.pitches.length > i) ? prevNote : null;
				let noteForThisTone: Note = note;
				let nextNoteForThisTone: Note | null = (nextNote && nextNote.pitches.length > i) ? nextNote : null;
				let noteStart: number = noteForThisTone.start + strumOffsetParts;

				if (noteStart > currentPart) {
					if (toneList.count() > i && transition.isSeamless && prevNoteForThisTone != null) {
						nextNoteForThisTone = noteForThisTone;
						noteForThisTone = prevNoteForThisTone;
						prevNoteForThisTone = null;
						noteStart = noteForThisTone.start + strumOffsetParts;
					} else {
						break;
					}
				}

				let noteEnd: number = noteForThisTone.end;
				if (transition.isSeamless && nextNoteForThisTone != null) {
					noteEnd = Math.min(Config.partsPerBeat * this.song!.beatsPerBar, noteEnd + strumOffsetParts);
				}

				let tone: Tone;
				if (toneList.count() <= i) {
					tone = this.newTone();
					toneList.pushBack(tone);
				} else {
					tone = toneList.get(i);
				}
				toneCount++;

				tone.pitches[0] = noteForThisTone.pitches[i];
				tone.pitchCount = 1;
				tone.chordSize = noteForThisTone.pitches.length;
				tone.instrument = instrument;
				tone.note = noteForThisTone;
				tone.noteStart = noteStart;
				tone.noteEnd = noteEnd;
				tone.prevNote = prevNoteForThisTone;
				tone.nextNote = nextNoteForThisTone;
				tone.prevNotePitchIndex = i;
				tone.nextNotePitchIndex = i;
			}
		}
		while (toneList.count() > toneCount) {
			// Automatically free or release seamless tones if there's no new note to take over.
			if (toneList.peakBack().instrument.getTransition().releases) {
				this.releaseTone(channel, toneList.popBack());
			} else {
				this.freeTone(toneList.popBack());
			}
		}
	}
	
	private playTone(song: Song, stereoBufferIndex: number, stereoBufferLength: number, channel: number, samplesPerTick: number, runLength: number, tone: Tone, released: boolean, shouldFadeOutFast: boolean): void {
		SynthWorker.computeTone(this, song, channel, samplesPerTick, runLength, tone, released, shouldFadeOutFast);
		let synthBuffer: Float32Array;
		switch (tone.instrument.effects) {
			case 0: synthBuffer = this.samplesForNone!; break;
			case 1: synthBuffer = this.samplesForReverb!; break;
			case 2: synthBuffer = this.samplesForChorus!; break;
			case 3: synthBuffer = this.samplesForChorusReverb!; break;
			default: throw new Error();
		}
		const synthesizer: Function = SynthWorker.getInstrumentSynthFunction(tone.instrument);
		synthesizer(this, synthBuffer, stereoBufferIndex, stereoBufferLength, runLength * 2, tone, tone.instrument);
	}
	
	private static computeEnvelope(envelope: Envelope, time: number, beats: number, customVolume: number): number {
		switch(envelope.type) {
			case EnvelopeType.custom: return customVolume;
			case EnvelopeType.steady: return 1.0;
			case EnvelopeType.twang:
				return 1.0 / (1.0 + time * envelope.speed);
			case EnvelopeType.swell:
				return 1.0 - 1.0 / (1.0 + time * envelope.speed);
			case EnvelopeType.tremolo: 
				return 0.5 - Math.cos(beats * 2.0 * Math.PI * envelope.speed) * 0.5;
			case EnvelopeType.tremolo2: 
				return 0.75 - Math.cos(beats * 2.0 * Math.PI * envelope.speed) * 0.25;
			case EnvelopeType.punch: 
				return Math.max(1.0, 2.0 - time * 10.0);
			case EnvelopeType.flare:
				const speed: number = envelope.speed;
				const attack: number = 0.25 / Math.sqrt(speed);
				return time < attack ? time / attack : 1.0 / (1.0 + (time - attack) * speed);
			case EnvelopeType.decay:
				return Math.pow(2, -envelope.speed * time);
			default: throw new Error("Unrecognized operator envelope type.");
		}
	}
	
	private static computeChordVolume(chordSize: number): number {
		return 1.0 / ((chordSize - 1) * 0.25 + 1.0);
	}
	
	private static computeTone(synth: SynthWorker, song: Song, channel: number, samplesPerTick: number, runLength: number, tone: Tone, released: boolean, shouldFadeOutFast: boolean): void {
		const instrument: Instrument = tone.instrument;
		const transition: Transition = instrument.getTransition();
		const chord: Chord = instrument.getChord();
		const chordVolume: number = chord.arpeggiates ? 1 : SynthWorker.computeChordVolume(tone.chordSize);
		const isNoiseChannel: boolean = song.getChannelIsNoise(channel);
		const intervalScale: number = isNoiseChannel ? Config.noiseInterval : 1;
		const secondsPerPart: number = Config.ticksPerPart * samplesPerTick / synth.samplesPerSecond;
		const beatsPerPart: number = 1.0 / Config.partsPerBeat;
		const toneWasActive: boolean = tone.active;
		const tickSampleCountdown: number = synth.tickSampleCountdown;
		const startRatio: number = 1.0 - (tickSampleCountdown            ) / samplesPerTick;
		const endRatio:   number = 1.0 - (tickSampleCountdown - runLength) / samplesPerTick;
		const ticksIntoBar: number = (synth.beat * Config.partsPerBeat + synth.part) * Config.ticksPerPart + synth.tick;
		const partTimeTickStart: number = (ticksIntoBar    ) / Config.ticksPerPart;
		const partTimeTickEnd:   number = (ticksIntoBar + 1) / Config.ticksPerPart;
		const partTimeStart: number = partTimeTickStart + (partTimeTickEnd - partTimeTickStart) * startRatio;
		const partTimeEnd: number   = partTimeTickStart + (partTimeTickEnd - partTimeTickStart) * endRatio;
		
		tone.phaseDeltaScale = 0.0;
		tone.filter = 1.0;
		tone.filterScale = 1.0;
		tone.vibratoScale = 0.0;
		tone.intervalMult = 1.0;
		tone.intervalVolumeMult = 1.0;
		tone.active = false;
		
		const pan: number = (instrument.pan - Config.panCenter) / Config.panCenter;
		const maxDelay: number = 0.00065 * synth.samplesPerSecond;
		const delay: number = Math.round(-pan * maxDelay) * 2;
		const volumeL: number = Math.cos((1 + pan) * Math.PI * 0.25) * 1.414;
		const volumeR: number = Math.cos((1 - pan) * Math.PI * 0.25) * 1.414;
		const delayL: number = Math.max(0.0, -delay);
		const delayR: number = Math.max(0.0, delay);
		if (delay >= 0) {
			tone.stereoVolume1 = volumeL;
			tone.stereoVolume2 = volumeR;
			tone.stereoOffset = 0;
			tone.stereoDelay = delayR + 1;
		} else {
			tone.stereoVolume1 = volumeR;
			tone.stereoVolume2 = volumeL;
			tone.stereoOffset = 1;
			tone.stereoDelay = delayL - 1;
		}
		
		let resetPhases: boolean = true;
		let partsSinceStart: number = 0.0;
		let intervalStart: number = 0.0;
		let intervalEnd: number = 0.0;
		let transitionVolumeStart: number = 1.0;
		let transitionVolumeEnd: number = 1.0;
		let chordVolumeStart: number = chordVolume;
		let chordVolumeEnd:   number = chordVolume;
		let customVolumeStart: number = 0.0;
		let customVolumeEnd: number = 0.0;
		let decayTimeStart: number = 0.0;
		let decayTimeEnd:   number = 0.0;
		
		let volumeReferencePitch: number;
		let basePitch: number;
		let baseVolume: number;
		let pitchDamping: number;
		if (instrument.type == InstrumentType.spectrum) {
			if (isNoiseChannel) {
				basePitch = Config.spectrumBasePitch;
				baseVolume = 0.6; // Note: spectrum is louder for drum channels than pitch channels!
			} else {
				basePitch = Config.keys[song.key].basePitch;
				baseVolume = 0.3;
			}
			volumeReferencePitch = Config.spectrumBasePitch;
			pitchDamping = 28;
		} else if (instrument.type == InstrumentType.drumset) {
			basePitch = Config.spectrumBasePitch;
			baseVolume = 0.45;
			volumeReferencePitch = basePitch;
			pitchDamping = 48;
		} else if (instrument.type == InstrumentType.noise) {
			basePitch = Config.chipNoises[instrument.chipNoise].basePitch;
			baseVolume = 0.19;
			volumeReferencePitch = basePitch;
			pitchDamping = Config.chipNoises[instrument.chipNoise].isSoft ? 24.0 : 60.0;
		} else if (instrument.type == InstrumentType.fm) {
			basePitch = Config.keys[song.key].basePitch;
			baseVolume = 0.03;
			volumeReferencePitch = 16;
			pitchDamping = 48;
		} else if (instrument.type == InstrumentType.chip) {
			basePitch = Config.keys[song.key].basePitch;
			baseVolume = 0.03375; // looks low compared to drums, but it's doubled for chorus and drums tend to be loud anyway.
			volumeReferencePitch = 16;
			pitchDamping = 48;
		} else if (instrument.type == InstrumentType.harmonics) {
			basePitch = Config.keys[song.key].basePitch;
			baseVolume = 0.025;
			volumeReferencePitch = 16;
			pitchDamping = 48;
		} else if (instrument.type == InstrumentType.pwm) {
			basePitch = Config.keys[song.key].basePitch;
			baseVolume = 0.04725;
			volumeReferencePitch = 16;
			pitchDamping = 48;
		} else {
			throw new Error("Unknown instrument type in computeTone.");
		}
		
		for (let i: number = 0; i < Config.operatorCount; i++) {
			tone.phaseDeltas[i] = 0.0;
			tone.volumeStarts[i] = 0.0;
			tone.volumeDeltas[i] = 0.0;
		}

		if (released) {
			const ticksSoFar: number = tone.noteLengthTicks + tone.ticksSinceReleased;
			const startTicksSinceReleased: number = tone.ticksSinceReleased + startRatio;
			const endTicksSinceReleased:   number = tone.ticksSinceReleased + endRatio;
			const startTick: number = tone.noteLengthTicks + startTicksSinceReleased;
			const endTick:   number = tone.noteLengthTicks + endTicksSinceReleased;
			const toneTransition: Transition = tone.instrument.getTransition();
			resetPhases = false;
			partsSinceStart = Math.floor(ticksSoFar / Config.ticksPerPart);
			intervalStart = intervalEnd = tone.lastInterval;
			customVolumeStart = customVolumeEnd = SynthWorker.expressionToVolumeMult(tone.lastVolume);
			transitionVolumeStart = SynthWorker.expressionToVolumeMult((1.0 - startTicksSinceReleased / toneTransition.releaseTicks) * 3.0);
			transitionVolumeEnd   = SynthWorker.expressionToVolumeMult((1.0 - endTicksSinceReleased / toneTransition.releaseTicks) * 3.0);
			decayTimeStart = startTick / Config.ticksPerPart;
			decayTimeEnd   = endTick / Config.ticksPerPart;

			if (shouldFadeOutFast) {
				transitionVolumeStart *= 1.0 - startRatio;
				transitionVolumeEnd *= 1.0 - endRatio;
			}
		} else if (tone.note == null) {
			transitionVolumeStart = transitionVolumeEnd = 1;
			customVolumeStart = customVolumeEnd = 1;
			tone.lastInterval = 0;
			tone.lastVolume = 3;
			tone.ticksSinceReleased = 0;
			resetPhases = false;
			
			const heldTicksStart: number = tone.liveInputSamplesHeld / samplesPerTick;
			tone.liveInputSamplesHeld += runLength;
			const heldTicksEnd: number = tone.liveInputSamplesHeld / samplesPerTick;
			tone.noteLengthTicks = heldTicksEnd;
			const heldPartsStart: number = heldTicksStart / Config.ticksPerPart;
			const heldPartsEnd: number = heldTicksEnd / Config.ticksPerPart;
			partsSinceStart = Math.floor(heldPartsStart);
			decayTimeStart = heldPartsStart;
			decayTimeEnd   = heldPartsEnd;
		} else {
			const note: Note = tone.note;
			const prevNote: Note | null = tone.prevNote;
			const nextNote: Note | null = tone.nextNote;

			const time: number = synth.part + synth.beat * Config.partsPerBeat;
			const partsPerBar: number = Config.partsPerBeat * song.beatsPerBar;
			const noteStart: number = tone.noteStart;
			const noteEnd: number = tone.noteEnd;
			
			partsSinceStart = time - noteStart;
			
			let endPinIndex: number;
			for (endPinIndex = 1; endPinIndex < note.pins.length - 1; endPinIndex++) {
				if (note.pins[endPinIndex].time + note.start > time) break;
			}
			const startPin: NotePin = note.pins[endPinIndex-1];
			const endPin: NotePin = note.pins[endPinIndex];
			const noteStartTick: number = noteStart * Config.ticksPerPart;
			const noteEndTick:   number = noteEnd   * Config.ticksPerPart;
			const noteLengthTicks: number = noteEndTick - noteStartTick;
			const pinStart: number  = (note.start + startPin.time) * Config.ticksPerPart;
			const pinEnd:   number  = (note.start +   endPin.time) * Config.ticksPerPart;
			
			tone.lastInterval = note.pins[note.pins.length - 1].interval;
			tone.lastVolume = note.pins[note.pins.length - 1].volume;
			tone.ticksSinceReleased = 0;
			tone.noteLengthTicks = noteLengthTicks;
			
			const tickTimeStart: number = time * Config.ticksPerPart + synth.tick;
			const tickTimeEnd:   number = time * Config.ticksPerPart + synth.tick + 1;
			const noteTicksPassedTickStart: number = tickTimeStart - noteStartTick;
			const noteTicksPassedTickEnd: number = tickTimeEnd - noteStartTick;
			const pinRatioStart: number = Math.min(1.0, (tickTimeStart - pinStart) / (pinEnd - pinStart));
			const pinRatioEnd:   number = Math.min(1.0, (tickTimeEnd   - pinStart) / (pinEnd - pinStart));
			let customVolumeTickStart: number = startPin.volume + (endPin.volume - startPin.volume) * pinRatioStart;
			let customVolumeTickEnd:   number = startPin.volume + (endPin.volume - startPin.volume) * pinRatioEnd;
			let transitionVolumeTickStart: number = 1.0;
			let transitionVolumeTickEnd:   number = 1.0;
			let chordVolumeTickStart: number = chordVolume;
			let chordVolumeTickEnd:   number = chordVolume;
			let intervalTickStart: number = startPin.interval + (endPin.interval - startPin.interval) * pinRatioStart;
			let intervalTickEnd:   number = startPin.interval + (endPin.interval - startPin.interval) * pinRatioEnd;
			let decayTimeTickStart: number = partTimeTickStart - noteStart;
			let decayTimeTickEnd:   number = partTimeTickEnd - noteStart;
			
			resetPhases = (tickTimeStart + startRatio - noteStartTick == 0.0) || !toneWasActive;
			
			// if seamless, don't reset phases at start. (it's probably not necessary to constantly reset phases if there are no notes? Just do it once when note starts? But make sure that reset phases doesn't also reset stuff that this function did to set up the tone. Remember when the first run length was lost!
			// if slide, average the interval, decayTime, and custom volume at the endpoints and interpolate between over slide duration.
			// note that currently seamless and slide make different assumptions about whether a note at the end of a bar will connect with the next bar!
			const maximumSlideTicks: number = noteLengthTicks * 0.5;
			if (transition.isSeamless && !transition.slides && note.start == 0) {
				// Special case for seamless, no-slide transition: assume the previous bar ends with another seamless note, don't reset tone history.
				resetPhases = !toneWasActive;
			} else if (transition.isSeamless && prevNote != null) {
				resetPhases = !toneWasActive;
				if (transition.slides) {
					const slideTicks: number = Math.min(maximumSlideTicks, transition.slideTicks);
					const slideRatioStartTick: number = Math.max(0.0, 1.0 - noteTicksPassedTickStart / slideTicks);
					const slideRatioEndTick:   number = Math.max(0.0, 1.0 - noteTicksPassedTickEnd / slideTicks);
					const intervalDiff: number = ((prevNote.pitches[tone.prevNotePitchIndex] + prevNote.pins[prevNote.pins.length-1].interval) - tone.pitches[0]) * 0.5;
					const volumeDiff: number = (prevNote.pins[prevNote.pins.length-1].volume - note.pins[0].volume) * 0.5;
					const decayTimeDiff: number = (prevNote.end - prevNote.start) * 0.5;
					intervalTickStart += slideRatioStartTick * intervalDiff;
					intervalTickEnd += slideRatioEndTick * intervalDiff;
					customVolumeTickStart += slideRatioStartTick * volumeDiff;
					customVolumeTickEnd += slideRatioEndTick * volumeDiff;
					decayTimeTickStart += slideRatioStartTick * decayTimeDiff;
					decayTimeTickEnd += slideRatioEndTick * decayTimeDiff;
					
					if (!chord.arpeggiates) {
						const chordSizeDiff: number = (prevNote.pitches.length - tone.chordSize) * 0.5;
						chordVolumeTickStart = SynthWorker.computeChordVolume(tone.chordSize + slideRatioStartTick * chordSizeDiff);
						chordVolumeTickEnd = SynthWorker.computeChordVolume(tone.chordSize + slideRatioEndTick * chordSizeDiff);
					}
				}
			}
			if (transition.isSeamless && !transition.slides && note.end == partsPerBar) {
				// Special case for seamless, no-slide transition: assume the next bar starts with another seamless note, don't fade out.
			} else if (transition.isSeamless && nextNote != null) {
				if (transition.slides) {
					const slideTicks: number = Math.min(maximumSlideTicks, transition.slideTicks);
					const slideRatioStartTick: number = Math.max(0.0, 1.0 - (noteLengthTicks - noteTicksPassedTickStart) / slideTicks);
					const slideRatioEndTick:   number = Math.max(0.0, 1.0 - (noteLengthTicks - noteTicksPassedTickEnd) / slideTicks);
					const intervalDiff: number = (nextNote.pitches[tone.nextNotePitchIndex] - (tone.pitches[0] + note.pins[note.pins.length-1].interval)) * 0.5;
					const volumeDiff: number = (nextNote.pins[0].volume - note.pins[note.pins.length-1].volume) * 0.5;
					const decayTimeDiff: number = -(noteEnd - noteStart) * 0.5;
					intervalTickStart += slideRatioStartTick * intervalDiff;
					intervalTickEnd += slideRatioEndTick * intervalDiff;
					customVolumeTickStart += slideRatioStartTick * volumeDiff;
					customVolumeTickEnd += slideRatioEndTick * volumeDiff;
					decayTimeTickStart += slideRatioStartTick * decayTimeDiff;
					decayTimeTickEnd += slideRatioEndTick * decayTimeDiff;
					
					if (!chord.arpeggiates) {
						const chordSizeDiff: number = (nextNote.pitches.length - tone.chordSize) * 0.5;
						chordVolumeTickStart = SynthWorker.computeChordVolume(tone.chordSize + slideRatioStartTick * chordSizeDiff);
						chordVolumeTickEnd = SynthWorker.computeChordVolume(tone.chordSize + slideRatioEndTick * chordSizeDiff);
					}
				}
			} else if (!transition.releases) {
				const releaseTicks: number = transition.releaseTicks;
				if (releaseTicks > 0.0) {
					transitionVolumeTickStart *= Math.min(1.0, (noteLengthTicks - noteTicksPassedTickStart) / releaseTicks);
					transitionVolumeTickEnd   *= Math.min(1.0, (noteLengthTicks - noteTicksPassedTickEnd) / releaseTicks);
				}
			}
			
			intervalStart = intervalTickStart + (intervalTickEnd - intervalTickStart) * startRatio;
			intervalEnd   = intervalTickStart + (intervalTickEnd - intervalTickStart) * endRatio;
			customVolumeStart = SynthWorker.expressionToVolumeMult(customVolumeTickStart + (customVolumeTickEnd - customVolumeTickStart) * startRatio);
			customVolumeEnd   = SynthWorker.expressionToVolumeMult(customVolumeTickStart + (customVolumeTickEnd - customVolumeTickStart) * endRatio);
			transitionVolumeStart = transitionVolumeTickStart + (transitionVolumeTickEnd - transitionVolumeTickStart) * startRatio;
			transitionVolumeEnd   = transitionVolumeTickStart + (transitionVolumeTickEnd - transitionVolumeTickStart) * endRatio;
			chordVolumeStart = chordVolumeTickStart + (chordVolumeTickEnd - chordVolumeTickStart) * startRatio;
			chordVolumeEnd = chordVolumeTickStart + (chordVolumeTickEnd - chordVolumeTickStart) * endRatio;
			decayTimeStart = decayTimeTickStart + (decayTimeTickEnd - decayTimeTickStart) * startRatio;
			decayTimeEnd   = decayTimeTickStart + (decayTimeTickEnd - decayTimeTickStart) * endRatio;
		}
		
		const sampleTime: number = 1.0 / synth.samplesPerSecond;
		tone.active = true;
		
		if (instrument.type == InstrumentType.chip || instrument.type == InstrumentType.fm || instrument.type == InstrumentType.harmonics || instrument.type == InstrumentType.pwm) {
			const lfoEffectStart: number = SynthWorker.getLFOAmplitude(instrument, secondsPerPart * partTimeStart);
			const lfoEffectEnd:   number = SynthWorker.getLFOAmplitude(instrument, secondsPerPart * partTimeEnd);
			const vibratoScale: number = (partsSinceStart < Config.vibratos[instrument.vibrato].delayParts) ? 0.0 : Config.vibratos[instrument.vibrato].amplitude;
			const vibratoStart: number = vibratoScale * lfoEffectStart;
			const vibratoEnd:   number = vibratoScale * lfoEffectEnd;
			intervalStart += vibratoStart;
			intervalEnd   += vibratoEnd;
		}
		
		if (!transition.isSeamless || (!(!transition.slides && tone.note != null && tone.note.start == 0) && !(tone.prevNote != null))) {
			const attackSeconds: number = transition.attackSeconds;
			if (attackSeconds > 0.0) {
				transitionVolumeStart *= Math.min(1.0, secondsPerPart * decayTimeStart / attackSeconds);
				transitionVolumeEnd   *= Math.min(1.0, secondsPerPart * decayTimeEnd / attackSeconds);
			}
		}
		
		const instrumentVolumeMult: number = SynthWorker.instrumentVolumeToVolumeMult(instrument.volume);
		
		if (instrument.type == InstrumentType.drumset) {
			// It's possible that the note will change while the user is editing it,
			// but the tone's pitches don't get updated because the tone has already
			// ended and is fading out. To avoid an array index out of bounds error, clamp the pitch.
			tone.drumsetPitch = tone.pitches[0];
			if (tone.note != null) tone.drumsetPitch += tone.note.pickMainInterval();
			tone.drumsetPitch = Math.max(0, Math.min(Config.drumCount - 1, tone.drumsetPitch));
		}
		
		const cutoffOctaves: number = instrument.getFilterCutoffOctaves();
		const filterEnvelope: Envelope = (instrument.type == InstrumentType.drumset) ? instrument.getDrumsetEnvelope(tone.drumsetPitch) : instrument.getFilterEnvelope();
		const filterCutoffHz: number = Config.filterCutoffMaxHz * Math.pow(2.0, cutoffOctaves);
		const filterBase: number = 2.0 * Math.sin(Math.PI * filterCutoffHz / synth.samplesPerSecond);
		const filterMin: number = 2.0 * Math.sin(Math.PI * Config.filterCutoffMinHz / synth.samplesPerSecond);
		tone.filter = filterBase * SynthWorker.computeEnvelope(filterEnvelope, secondsPerPart * decayTimeStart, beatsPerPart * partTimeStart, customVolumeStart);
		let endFilter: number = filterBase * SynthWorker.computeEnvelope(filterEnvelope, secondsPerPart * decayTimeEnd, beatsPerPart * partTimeEnd, customVolumeEnd);
		tone.filter = Math.min(Config.filterMax, Math.max(filterMin, tone.filter));
		endFilter = Math.min(Config.filterMax, Math.max(filterMin, endFilter));
		tone.filterScale = Math.pow(endFilter / tone.filter, 1.0 / runLength);
		let filterVolume: number = Math.pow(0.5, cutoffOctaves * 0.35);
		if (instrument.filterResonance > 0) {
			filterVolume = Math.pow(filterVolume, 1.7) * Math.pow(0.5, 0.125 * (instrument.filterResonance - 1));
		}
		if (filterEnvelope.type == EnvelopeType.decay) {
			filterVolume *= (1.25 + .025 * filterEnvelope.speed);
		} else if (filterEnvelope.type == EnvelopeType.twang) {
			filterVolume *= (1 + .02 * filterEnvelope.speed);
		}
		
		if (resetPhases) {
			tone.reset();
		}
		
		if (instrument.type == InstrumentType.fm) {
			// phase modulation!
			
			let sineVolumeBoost: number = 1.0;
			let totalCarrierVolume: number = 0.0;

			let arpeggioInterval: number = 0;
			if (tone.pitchCount > 1 && !chord.harmonizes) {
				const arpeggio: number = Math.floor((synth.tick + synth.part * Config.ticksPerPart) / Config.rhythms[song.rhythm].ticksPerArpeggio);
				arpeggioInterval = tone.pitches[getArpeggioPitchIndex(tone.pitchCount, song.rhythm, arpeggio)] - tone.pitches[0];
			}
			
			const carrierCount: number = Config.algorithms[instrument.algorithm].carrierCount;
			for (let i: number = 0; i < Config.operatorCount; i++) {
				const associatedCarrierIndex: number = Config.algorithms[instrument.algorithm].associatedCarrier[i] - 1;
				const pitch: number = tone.pitches[!chord.harmonizes ? 0 : ((i < tone.pitchCount) ? i : ((associatedCarrierIndex < tone.pitchCount) ? associatedCarrierIndex : 0))];
				const freqMult = Config.operatorFrequencies[instrument.operators[i].frequency].mult;
				const interval = Config.operatorCarrierInterval[associatedCarrierIndex] + arpeggioInterval;
				const startPitch: number = basePitch + (pitch + intervalStart) * intervalScale + interval;
				const startFreq: number = freqMult * (Instrument.frequencyFromPitch(startPitch)) + Config.operatorFrequencies[instrument.operators[i].frequency].hzOffset;
				
				tone.phaseDeltas[i] = startFreq * sampleTime * Config.sineWaveLength;
				
				const amplitudeCurve: number = SynthWorker.operatorAmplitudeCurve(instrument.operators[i].amplitude);
				const amplitudeMult: number = amplitudeCurve * Config.operatorFrequencies[instrument.operators[i].frequency].amplitudeSign;
				let volumeStart: number = amplitudeMult;
				let volumeEnd: number = amplitudeMult;
				if (i < carrierCount) {
					// carrier
					const endPitch: number = basePitch + (pitch + intervalEnd) * intervalScale + interval;
					const pitchVolumeStart: number = Math.pow(2.0, -(startPitch - volumeReferencePitch) / pitchDamping);
					const pitchVolumeEnd: number   = Math.pow(2.0,   -(endPitch - volumeReferencePitch) / pitchDamping);
					volumeStart *= pitchVolumeStart;
					volumeEnd *= pitchVolumeEnd;
					
					totalCarrierVolume += amplitudeCurve;
				} else {
					// modulator
					volumeStart *= Config.sineWaveLength * 1.5;
					volumeEnd *= Config.sineWaveLength * 1.5;
					
					sineVolumeBoost *= 1.0 - Math.min(1.0, instrument.operators[i].amplitude / 15);
				}
				const operatorEnvelope: Envelope = Config.envelopes[instrument.operators[i].envelope];
				
				volumeStart *= SynthWorker.computeEnvelope(operatorEnvelope, secondsPerPart * decayTimeStart, beatsPerPart * partTimeStart, customVolumeStart);
				volumeEnd *= SynthWorker.computeEnvelope(operatorEnvelope, secondsPerPart * decayTimeEnd, beatsPerPart * partTimeEnd, customVolumeEnd);
				
				tone.volumeStarts[i] = volumeStart;
				tone.volumeDeltas[i] = (volumeEnd - volumeStart) / runLength;
			}
			
			const feedbackAmplitude: number = Config.sineWaveLength * 0.3 * instrument.feedbackAmplitude / 15.0;
			const feedbackEnvelope: Envelope = Config.envelopes[instrument.feedbackEnvelope];
			let feedbackStart: number = feedbackAmplitude * SynthWorker.computeEnvelope(feedbackEnvelope, secondsPerPart * decayTimeStart, beatsPerPart * partTimeStart, customVolumeStart);
			let feedbackEnd: number = feedbackAmplitude * SynthWorker.computeEnvelope(feedbackEnvelope, secondsPerPart * decayTimeEnd, beatsPerPart * partTimeEnd, customVolumeEnd);
			tone.feedbackMult = feedbackStart;
			tone.feedbackDelta = (feedbackEnd - tone.feedbackMult) / runLength;
			
			const volumeMult: number = baseVolume * instrumentVolumeMult;
			tone.volumeStart = filterVolume * volumeMult * transitionVolumeStart * chordVolumeStart;
			const volumeEnd: number = filterVolume * volumeMult * transitionVolumeEnd * chordVolumeEnd;
			tone.volumeDelta = (volumeEnd - tone.volumeStart) / runLength;
			
			sineVolumeBoost *= (Math.pow(2.0, (2.0 - 1.4 * instrument.feedbackAmplitude / 15.0)) - 1.0) / 3.0;
			sineVolumeBoost *= 1.0 - Math.min(1.0, Math.max(0.0, totalCarrierVolume - 1) / 2.0);
			tone.volumeStart *= 1.0 + sineVolumeBoost * 3.0;
			tone.volumeDelta *= 1.0 + sineVolumeBoost * 3.0;
		} else {
			let pitch: number = tone.pitches[0];

			if (tone.pitchCount > 1) {
				const arpeggio: number = Math.floor((synth.tick + synth.part * Config.ticksPerPart) / Config.rhythms[song.rhythm].ticksPerArpeggio);
				if (chord.harmonizes) {
					const intervalOffset: number = tone.pitches[1 + getArpeggioPitchIndex(tone.pitchCount - 1, song.rhythm, arpeggio)] - tone.pitches[0];
					tone.intervalMult = Math.pow(2.0, intervalOffset / 12.0);
					tone.intervalVolumeMult = Math.pow(2.0, -intervalOffset / pitchDamping);
				} else {
					pitch = tone.pitches[getArpeggioPitchIndex(tone.pitchCount, song.rhythm, arpeggio)];
				}
			}
			
			const startPitch: number = basePitch + (pitch + intervalStart) * intervalScale;
			const endPitch: number = basePitch + (pitch + intervalEnd) * intervalScale;
			const startFreq: number = Instrument.frequencyFromPitch(startPitch);
			const pitchVolumeStart: number = Math.pow(2.0, -(startPitch - volumeReferencePitch) / pitchDamping);
			const pitchVolumeEnd: number   = Math.pow(2.0,   -(endPitch - volumeReferencePitch) / pitchDamping);
			let settingsVolumeMult: number = baseVolume * filterVolume;
			if (instrument.type == InstrumentType.noise) {
				settingsVolumeMult *= Config.chipNoises[instrument.chipNoise].volume;
			}
			if (instrument.type == InstrumentType.chip) {
				settingsVolumeMult *= Config.chipWaves[instrument.chipWave].volume;
			}
			if (instrument.type == InstrumentType.chip || instrument.type == InstrumentType.harmonics) {
				settingsVolumeMult *= Config.intervals[instrument.interval].volume;
			}
			if (instrument.type == InstrumentType.pwm) {
				const pulseEnvelope: Envelope = Config.envelopes[instrument.pulseEnvelope];
				const basePulseWidth: number = Math.pow(0.5, (Config.pulseWidthRange - instrument.pulseWidth - 1) * 0.5) * 0.5;
				const pulseWidthStart: number = basePulseWidth * SynthWorker.computeEnvelope(pulseEnvelope, secondsPerPart * decayTimeStart, beatsPerPart * partTimeStart, customVolumeStart);
				const pulseWidthEnd: number = basePulseWidth * SynthWorker.computeEnvelope(pulseEnvelope, secondsPerPart * decayTimeEnd, beatsPerPart * partTimeEnd, customVolumeEnd);
				
				tone.pulseWidth = pulseWidthStart;
				tone.pulseWidthDelta = (pulseWidthEnd - pulseWidthStart) / runLength;
			}
			
			tone.phaseDeltas[0] = startFreq * sampleTime;
			
			tone.volumeStart = transitionVolumeStart * chordVolumeStart * pitchVolumeStart * settingsVolumeMult * instrumentVolumeMult;
			let volumeEnd: number = transitionVolumeEnd * chordVolumeEnd * pitchVolumeEnd * settingsVolumeMult * instrumentVolumeMult;
			
			if (filterEnvelope.type != EnvelopeType.custom && (instrument.type != InstrumentType.pwm || Config.envelopes[instrument.pulseEnvelope].type != EnvelopeType.custom)) {
				tone.volumeStart *= customVolumeStart;
				volumeEnd *= customVolumeEnd;
			}
			
			tone.volumeDelta = (volumeEnd - tone.volumeStart) / runLength;
		}
		
		tone.phaseDeltaScale = Math.pow(2.0, ((intervalEnd - intervalStart) * intervalScale / 12.0) / runLength);
	}
	
	public static getLFOAmplitude(instrument: Instrument, secondsIntoBar: number): number {
		let effect: number = 0.0;
		for (const vibratoPeriodSeconds of Config.vibratos[instrument.vibrato].periodsSeconds) {
			effect += Math.sin(Math.PI * 2.0 * secondsIntoBar / vibratoPeriodSeconds);
		}
		return effect;
	}
	
	private static readonly fmSynthFunctionCache: Dictionary<Function> = {};
	
	private static getInstrumentSynthFunction(instrument: Instrument): Function {
		if (instrument.type == InstrumentType.fm) {
			const fingerprint: string = instrument.algorithm + "_" + instrument.feedbackType;
			if (SynthWorker.fmSynthFunctionCache[fingerprint] == undefined) {
				const synthSource: string[] = [];
				
				for (const line of SynthWorker.fmSourceTemplate) {
					if (line.indexOf("// CARRIER OUTPUTS") != -1) {
						const outputs: string[] = [];
						for (let j: number = 0; j < Config.algorithms[instrument.algorithm].carrierCount; j++) {
							outputs.push("operator" + j + "Scaled");
						}
						synthSource.push(line.replace("/*operator#Scaled*/", outputs.join(" + ")));
					} else if (line.indexOf("// INSERT OPERATOR COMPUTATION HERE") != -1) {
						for (let j: number = Config.operatorCount - 1; j >= 0; j--) {
							for (const operatorLine of SynthWorker.operatorSourceTemplate) {
								if (operatorLine.indexOf("/* + operator@Scaled*/") != -1) {
									let modulators = "";
									for (const modulatorNumber of Config.algorithms[instrument.algorithm].modulatedBy[j]) {
										modulators += " + operator" + (modulatorNumber - 1) + "Scaled";
									}
								
									const feedbackIndices: ReadonlyArray<number> = Config.feedbacks[instrument.feedbackType].indices[j];
									if (feedbackIndices.length > 0) {
										modulators += " + feedbackMult * (";
										const feedbacks: string[] = [];
										for (const modulatorNumber of feedbackIndices) {
											feedbacks.push("operator" + (modulatorNumber - 1) + "Output");
										}
										modulators += feedbacks.join(" + ") + ")";
									}
									synthSource.push(operatorLine.replace(/\#/g, j + "").replace("/* + operator@Scaled*/", modulators));
								} else {
									synthSource.push(operatorLine.replace(/\#/g, j + ""));
								}
							}
						}
					} else if (line.indexOf("#") != -1) {
						for (let j = 0; j < Config.operatorCount; j++) {
							synthSource.push(line.replace(/\#/g, j + ""));
						}
					} else {
						synthSource.push(line);
					}
				}
				
				//console.log(synthSource.join("\n"));
				
				SynthWorker.fmSynthFunctionCache[fingerprint] = new Function("synth", "data", "stereoBufferIndex", "stereoBufferLength", "runLength", "tone", "instrument", synthSource.join("\n"));
			}
			return SynthWorker.fmSynthFunctionCache[fingerprint];
		} else if (instrument.type == InstrumentType.chip) {
			return SynthWorker.chipSynth;
		} else if (instrument.type == InstrumentType.harmonics) {
			return SynthWorker.harmonicsSynth;
		} else if (instrument.type == InstrumentType.pwm) {
			return SynthWorker.pulseWidthSynth;
		} else if (instrument.type == InstrumentType.noise) {
			return SynthWorker.noiseSynth;
		} else if (instrument.type == InstrumentType.spectrum) {
			return SynthWorker.spectrumSynth;
		} else if (instrument.type == InstrumentType.drumset) {
			return SynthWorker.drumsetSynth;
		} else {
			throw new Error("Unrecognized instrument type: " + instrument.type);
		}
	}
	
	private static chipSynth(synth: SynthWorker, data: Float32Array, stereoBufferIndex: number, stereoBufferLength: number, runLength: number, tone: Tone, instrument: Instrument): void {
		const wave: Float64Array = Config.chipWaves[instrument.chipWave].samples;
		const waveLength: number = +wave.length - 1; // The first sample is duplicated at the end, don't double-count it.
		
		const intervalA: number = +Math.pow(2.0, (Config.intervals[instrument.interval].offset + Config.intervals[instrument.interval].spread) / 12.0);
		const intervalB: number =  Math.pow(2.0, (Config.intervals[instrument.interval].offset - Config.intervals[instrument.interval].spread) / 12.0) * tone.intervalMult;
		const intervalSign: number = tone.intervalVolumeMult * Config.intervals[instrument.interval].sign;
		if (instrument.interval == 0 && !instrument.getChord().customInterval) tone.phases[1] = tone.phases[0];
		const deltaRatio: number = intervalB / intervalA;
		let phaseDeltaA: number = tone.phaseDeltas[0] * intervalA * waveLength;
		let phaseDeltaB: number = phaseDeltaA * deltaRatio;
		const phaseDeltaScale: number = +tone.phaseDeltaScale;
		let volume: number = +tone.volumeStart;
		const volumeDelta: number = +tone.volumeDelta;
		let phaseA: number = (tone.phases[0] % 1) * waveLength;
		let phaseB: number = (tone.phases[1] % 1) * waveLength;
		
		let filter1: number = +tone.filter;
		let filter2: number = instrument.getFilterIsFirstOrder() ? 1.0 : filter1;
		const filterScale1: number = +tone.filterScale;
		const filterScale2: number = instrument.getFilterIsFirstOrder() ? 1.0 : filterScale1;
		const filterResonance = Config.filterMaxResonance * Math.pow(Math.max(0, instrument.getFilterResonance() - 1) / (Config.filterResonanceRange - 2), 0.5);
		let filterSample0: number = +tone.filterSample0;
		let filterSample1: number = +tone.filterSample1;
		
		const phaseAInt: number = phaseA|0;
		const phaseBInt: number = phaseB|0;
		const indexA: number = phaseAInt % waveLength;
		const indexB: number = phaseBInt % waveLength;
		const phaseRatioA: number = phaseA - phaseAInt;
		const phaseRatioB: number = phaseB - phaseBInt;
		let prevWaveIntegralA: number = wave[indexA];
		let prevWaveIntegralB: number = wave[indexB];
		prevWaveIntegralA += (wave[indexA+1] - prevWaveIntegralA) * phaseRatioA;
		prevWaveIntegralB += (wave[indexB+1] - prevWaveIntegralB) * phaseRatioB;
		
		const stopIndex: number = stereoBufferIndex + runLength;
		stereoBufferIndex += tone.stereoOffset;
		const stereoVolume1: number = tone.stereoVolume1;
		const stereoVolume2: number = tone.stereoVolume2;
		const stereoDelay: number = tone.stereoDelay;
		while (stereoBufferIndex < stopIndex) {
			
			phaseA += phaseDeltaA;
			phaseB += phaseDeltaB;
			
			const phaseAInt: number = phaseA|0;
			const phaseBInt: number = phaseB|0;
			const indexA: number = phaseAInt % waveLength;
			const indexB: number = phaseBInt % waveLength;
			let nextWaveIntegralA: number = wave[indexA];
			let nextWaveIntegralB: number = wave[indexB];
			const phaseRatioA: number = phaseA - phaseAInt;
			const phaseRatioB: number = phaseB - phaseBInt;
			nextWaveIntegralA += (wave[indexA+1] - nextWaveIntegralA) * phaseRatioA;
			nextWaveIntegralB += (wave[indexB+1] - nextWaveIntegralB) * phaseRatioB;
			let waveA: number = (nextWaveIntegralA - prevWaveIntegralA) / phaseDeltaA;
			let waveB: number = (nextWaveIntegralB - prevWaveIntegralB) / phaseDeltaB;
			prevWaveIntegralA = nextWaveIntegralA;
			prevWaveIntegralB = nextWaveIntegralB;
			
			const combinedWave: number = (waveA + waveB * intervalSign);
			
			const feedback: number = filterResonance + filterResonance / (1.0 - filter1);
			filterSample0 += filter1 * (combinedWave - filterSample0 + feedback * (filterSample0 - filterSample1));
			filterSample1 += filter2 * (filterSample0 - filterSample1);
			
			filter1 *= filterScale1;
			filter2 *= filterScale2;
			phaseDeltaA *= phaseDeltaScale;
			phaseDeltaB *= phaseDeltaScale;
			
			const output: number = filterSample1 * volume;
			volume += volumeDelta;
			
			data[stereoBufferIndex] += output * stereoVolume1;
			data[(stereoBufferIndex + stereoDelay) % stereoBufferLength] += output * stereoVolume2;
			stereoBufferIndex += 2;
		}
		
		tone.phases[0] = phaseA / waveLength;
		tone.phases[1] = phaseB / waveLength;
		
		const epsilon: number = (1.0e-24);
		if (-epsilon < filterSample0 && filterSample0 < epsilon) filterSample0 = 0.0;
		if (-epsilon < filterSample1 && filterSample1 < epsilon) filterSample1 = 0.0;
		tone.filterSample0 = filterSample0;
		tone.filterSample1 = filterSample1;
	}
	
	private static harmonicsSynth(synth: SynthWorker, data: Float32Array, stereoBufferIndex: number, stereoBufferLength: number, runLength: number, tone: Tone, instrument: Instrument): void {
		const wave: Float32Array = instrument.harmonicsWave.getCustomWave();
		const waveLength: number = +wave.length - 1; // The first sample is duplicated at the end, don't double-count it.
		
		const intervalA: number = +Math.pow(2.0, (Config.intervals[instrument.interval].offset + Config.intervals[instrument.interval].spread) / 12.0);
		const intervalB: number =  Math.pow(2.0, (Config.intervals[instrument.interval].offset - Config.intervals[instrument.interval].spread) / 12.0) * tone.intervalMult;
		const intervalSign: number = tone.intervalVolumeMult * Config.intervals[instrument.interval].sign;
		if (instrument.interval == 0 && !instrument.getChord().customInterval) tone.phases[1] = tone.phases[0];
		const deltaRatio: number = intervalB / intervalA;
		let phaseDeltaA: number = tone.phaseDeltas[0] * intervalA * waveLength;
		let phaseDeltaB: number = phaseDeltaA * deltaRatio;
		const phaseDeltaScale: number = +tone.phaseDeltaScale;
		let volume: number = +tone.volumeStart;
		const volumeDelta: number = +tone.volumeDelta;
		let phaseA: number = (tone.phases[0] % 1) * waveLength;
		let phaseB: number = (tone.phases[1] % 1) * waveLength;

		let filter1: number = +tone.filter;
		let filter2: number = instrument.getFilterIsFirstOrder() ? 1.0 : filter1;
		const filterScale1: number = +tone.filterScale;
		const filterScale2: number = instrument.getFilterIsFirstOrder() ? 1.0 : filterScale1;
		const filterResonance = Config.filterMaxResonance * Math.pow(Math.max(0, instrument.getFilterResonance() - 1) / (Config.filterResonanceRange - 2), 0.5);
		let filterSample0: number = +tone.filterSample0;
		let filterSample1: number = +tone.filterSample1;

		const phaseAInt: number = phaseA|0;
		const phaseBInt: number = phaseB|0;
		const indexA: number = phaseAInt % waveLength;
		const indexB: number = phaseBInt % waveLength;
		const phaseRatioA: number = phaseA - phaseAInt;
		const phaseRatioB: number = phaseB - phaseBInt;
		let prevWaveIntegralA: number = wave[indexA];
		let prevWaveIntegralB: number = wave[indexB];
		prevWaveIntegralA += (wave[indexA+1] - prevWaveIntegralA) * phaseRatioA;
		prevWaveIntegralB += (wave[indexB+1] - prevWaveIntegralB) * phaseRatioB;
		
		const stopIndex: number = stereoBufferIndex + runLength;
		stereoBufferIndex += tone.stereoOffset;
		const stereoVolume1: number = tone.stereoVolume1;
		const stereoVolume2: number = tone.stereoVolume2;
		const stereoDelay: number = tone.stereoDelay;
		while (stereoBufferIndex < stopIndex) {

			phaseA += phaseDeltaA;
			phaseB += phaseDeltaB;

			const phaseAInt: number = phaseA|0;
			const phaseBInt: number = phaseB|0;
			const indexA: number = phaseAInt % waveLength;
			const indexB: number = phaseBInt % waveLength;
			let nextWaveIntegralA: number = wave[indexA];
			let nextWaveIntegralB: number = wave[indexB];
			const phaseRatioA: number = phaseA - phaseAInt;
			const phaseRatioB: number = phaseB - phaseBInt;
			nextWaveIntegralA += (wave[indexA+1] - nextWaveIntegralA) * phaseRatioA;
			nextWaveIntegralB += (wave[indexB+1] - nextWaveIntegralB) * phaseRatioB;
			let waveA: number = (nextWaveIntegralA - prevWaveIntegralA) / phaseDeltaA;
			let waveB: number = (nextWaveIntegralB - prevWaveIntegralB) / phaseDeltaB;
			
			prevWaveIntegralA = nextWaveIntegralA;
			prevWaveIntegralB = nextWaveIntegralB;

			const combinedWave: number = (waveA + waveB * intervalSign);
			
			const feedback: number = filterResonance + filterResonance / (1.0 - filter1);
			filterSample0 += filter1 * (combinedWave - filterSample0 + feedback * (filterSample0 - filterSample1));
			filterSample1 += filter2 * (filterSample0 - filterSample1);
			
			filter1 *= filterScale1;
			filter2 *= filterScale2;
			phaseDeltaA *= phaseDeltaScale;
			phaseDeltaB *= phaseDeltaScale;
			
			const output: number = filterSample1 * volume;
			volume += volumeDelta;
			
			data[stereoBufferIndex] += output * stereoVolume1;
			data[(stereoBufferIndex + stereoDelay) % stereoBufferLength] += output * stereoVolume2;
			stereoBufferIndex += 2;
		}
		
		tone.phases[0] = phaseA / waveLength;
		tone.phases[1] = phaseB / waveLength;
		
		const epsilon: number = (1.0e-24);
		if (-epsilon < filterSample0 && filterSample0 < epsilon) filterSample0 = 0.0;
		if (-epsilon < filterSample1 && filterSample1 < epsilon) filterSample1 = 0.0;
		tone.filterSample0 = filterSample0;
		tone.filterSample1 = filterSample1;
	}
	
	private static pulseWidthSynth(synth: SynthWorker, data: Float32Array, stereoBufferIndex: number, stereoBufferLength: number, runLength: number, tone: Tone, instrument: Instrument): void {
		let phaseDelta: number = tone.phaseDeltas[0];
		const phaseDeltaScale: number = +tone.phaseDeltaScale;
		let volume: number = +tone.volumeStart;
		const volumeDelta: number = +tone.volumeDelta;
		let phase: number = (tone.phases[0] % 1);
		
		let pulseWidth: number = tone.pulseWidth;
		const pulseWidthDelta: number = tone.pulseWidthDelta;
		
		let filter1: number = +tone.filter;
		let filter2: number = instrument.getFilterIsFirstOrder() ? 1.0 : filter1;
		const filterScale1: number = +tone.filterScale;
		const filterScale2: number = instrument.getFilterIsFirstOrder() ? 1.0 : filterScale1;
		const filterResonance = Config.filterMaxResonance * Math.pow(Math.max(0, instrument.getFilterResonance() - 1) / (Config.filterResonanceRange - 2), 0.5);
		let filterSample0: number = +tone.filterSample0;
		let filterSample1: number = +tone.filterSample1;
		
		const stopIndex: number = stereoBufferIndex + runLength;
		stereoBufferIndex += tone.stereoOffset;
		const stereoVolume1: number = tone.stereoVolume1;
		const stereoVolume2: number = tone.stereoVolume2;
		const stereoDelay: number = tone.stereoDelay;
		while (stereoBufferIndex < stopIndex) {
			
			const sawPhaseA: number = phase % 1;
			const sawPhaseB: number = (phase + pulseWidth) % 1;
			
			let pulseWave: number = sawPhaseB - sawPhaseA;
			
			// This a PolyBLEP, which smooths out discontinuities at any frequency to reduce aliasing. 
			if (sawPhaseA < phaseDelta) {
				var t = sawPhaseA / phaseDelta;
				pulseWave += (t+t-t*t-1) * 0.5;
			} else if (sawPhaseA > 1.0 - phaseDelta) {
				var t = (sawPhaseA - 1.0) / phaseDelta;
				pulseWave += (t+t+t*t+1) * 0.5;
			}
			if (sawPhaseB < phaseDelta) {
				var t = sawPhaseB / phaseDelta;
				pulseWave -= (t+t-t*t-1) * 0.5;
			} else if (sawPhaseB > 1.0 - phaseDelta) {
				var t = (sawPhaseB - 1.0) / phaseDelta;
				pulseWave -= (t+t+t*t+1) * 0.5;
			}
			
			const feedback: number = filterResonance + filterResonance / (1.0 - filter1);
			filterSample0 += filter1 * (pulseWave - filterSample0 + feedback * (filterSample0 - filterSample1));
			filterSample1 += filter2 * (filterSample0 - filterSample1);
			
			filter1 *= filterScale1;
			filter2 *= filterScale2;
			
			phase += phaseDelta;
			phaseDelta *= phaseDeltaScale;
			pulseWidth += pulseWidthDelta;
			
			const output: number = filterSample1 * volume;
			volume += volumeDelta;
			
			data[stereoBufferIndex] += output * stereoVolume1;
			data[(stereoBufferIndex + stereoDelay) % stereoBufferLength] += output * stereoVolume2;
			stereoBufferIndex += 2;
		}
		
		tone.phases[0] = phase;
		
		const epsilon: number = (1.0e-24);
		if (-epsilon < filterSample0 && filterSample0 < epsilon) filterSample0 = 0.0;
		if (-epsilon < filterSample1 && filterSample1 < epsilon) filterSample1 = 0.0;
		tone.filterSample0 = filterSample0;
		tone.filterSample1 = filterSample1;
	}
	
	private static fmSourceTemplate: string[] = (`
		const sineWave = beepbox.Config.sineWave;
		
		let phaseDeltaScale = +tone.phaseDeltaScale;
		// I'm adding 1000 to the phase to ensure that it's never negative even when modulated by other waves because negative numbers don't work with the modulus operator very well.
		let operator#Phase       = +((tone.phases[#] % 1) + 1000) * beepbox.Config.sineWaveLength;
		let operator#PhaseDelta  = +tone.phaseDeltas[#];
		let operator#OutputMult  = +tone.volumeStarts[#];
		const operator#OutputDelta = +tone.volumeDeltas[#];
		let operator#Output      = +tone.feedbackOutputs[#];
		let feedbackMult         = +tone.feedbackMult;
		const feedbackDelta        = +tone.feedbackDelta;
		let volume = +tone.volumeStart;
		const volumeDelta = +tone.volumeDelta;
		
		let filter1 = +tone.filter;
		let filter2 = instrument.getFilterIsFirstOrder() ? 1.0 : filter1;
		const filterScale1 = +tone.filterScale;
		const filterScale2 = instrument.getFilterIsFirstOrder() ? 1.0 : filterScale1;
		const filterResonance = beepbox.Config.filterMaxResonance * Math.pow(Math.max(0, instrument.getFilterResonance() - 1) / (beepbox.Config.filterResonanceRange - 2), 0.5);
		let filterSample0 = +tone.filterSample0;
		let filterSample1 = +tone.filterSample1;
		
		const stopIndex = stereoBufferIndex + runLength;
		stereoBufferIndex += tone.stereoOffset;
		const stereoVolume1 = tone.stereoVolume1;
		const stereoVolume2 = tone.stereoVolume2;
		const stereoDelay = tone.stereoDelay;
		while (stereoBufferIndex < stopIndex) {
			// INSERT OPERATOR COMPUTATION HERE
			const fmOutput = (/*operator#Scaled*/); // CARRIER OUTPUTS
			
			const feedback = filterResonance + filterResonance / (1.0 - filter1);
			filterSample0 += filter1 * (fmOutput - filterSample0 + feedback * (filterSample0 - filterSample1));
			filterSample1 += filter2 * (filterSample0 - filterSample1);
			
			feedbackMult += feedbackDelta;
			operator#OutputMult += operator#OutputDelta;
			operator#Phase += operator#PhaseDelta;
			operator#PhaseDelta *= phaseDeltaScale;
			filter1 *= filterScale1;
			filter2 *= filterScale2;
			
			const output = filterSample1 * volume;
			volume += volumeDelta;
			
			data[stereoBufferIndex] += output * stereoVolume1;
			data[(stereoBufferIndex + stereoDelay) % stereoBufferLength] += output * stereoVolume2;
			stereoBufferIndex += 2;
		}
		
		tone.phases[#] = operator#Phase / ` + Config.sineWaveLength + `;
		tone.feedbackOutputs[#] = operator#Output;
		
		const epsilon = (1.0e-24);
		if (-epsilon < filterSample0 && filterSample0 < epsilon) filterSample0 = 0.0;
		if (-epsilon < filterSample1 && filterSample1 < epsilon) filterSample1 = 0.0;
		tone.filterSample0 = filterSample0;
		tone.filterSample1 = filterSample1;
	`).split("\n");
	
	private static operatorSourceTemplate: string[] = (`
			const operator#PhaseMix = operator#Phase/* + operator@Scaled*/;
			const operator#PhaseInt = operator#PhaseMix|0;
			const operator#Index    = operator#PhaseInt & ` + Config.sineWaveMask + `;
			const operator#Sample   = sineWave[operator#Index];
			operator#Output       = operator#Sample + (sineWave[operator#Index + 1] - operator#Sample) * (operator#PhaseMix - operator#PhaseInt);
			const operator#Scaled   = operator#OutputMult * operator#Output;
	`).split("\n");
	
	private static noiseSynth(synth: SynthWorker, data: Float32Array, stereoBufferIndex: number, stereoBufferLength: number, runLength: number, tone: Tone, instrument: Instrument): void {
		let wave: Float32Array = instrument.getDrumWave();
		let phaseDelta: number = +tone.phaseDeltas[0];
		const phaseDeltaScale: number = +tone.phaseDeltaScale;
		let volume: number = +tone.volumeStart;
		const volumeDelta: number = +tone.volumeDelta;
		let phase: number = (tone.phases[0] % 1) * Config.chipNoiseLength;
		if (tone.phases[0] == 0) {
			// Zero phase means the tone was reset, just give noise a random start phase instead.
			phase = Math.random() * Config.chipNoiseLength;
		}
		let sample: number = +tone.sample;
		
		let filter1: number = +tone.filter;
		let filter2: number = instrument.getFilterIsFirstOrder() ? 1.0 : filter1;
		const filterScale1: number = +tone.filterScale;
		const filterScale2: number = instrument.getFilterIsFirstOrder() ? 1.0 : filterScale1;
		const filterResonance = Config.filterMaxResonance * Math.pow(Math.max(0, instrument.getFilterResonance() - 1) / (Config.filterResonanceRange - 2), 0.5);
		let filterSample0: number = +tone.filterSample0;
		let filterSample1: number = +tone.filterSample1;
		
		const pitchRelativefilter: number = Math.min(1.0, tone.phaseDeltas[0] * Config.chipNoises[instrument.chipNoise].pitchFilterMult);
		
		const stopIndex: number = stereoBufferIndex + runLength;
		stereoBufferIndex += tone.stereoOffset;
		const stereoVolume1: number = tone.stereoVolume1;
		const stereoVolume2: number = tone.stereoVolume2;
		const stereoDelay: number = tone.stereoDelay;
		while (stereoBufferIndex < stopIndex) {
			const waveSample: number = wave[phase & 0x7fff];
			
			sample += (waveSample - sample) * pitchRelativefilter;
		
			const feedback: number = filterResonance + filterResonance / (1.0 - filter1);
			filterSample0 += filter1 * (sample - filterSample0 + feedback * (filterSample0 - filterSample1));
			filterSample1 += filter2 * (filterSample0 - filterSample1);
		
			phase += phaseDelta;
			filter1 *= filterScale1;
			filter2 *= filterScale2;
			phaseDelta *= phaseDeltaScale;
			
			const output: number = filterSample1 * volume;
			volume += volumeDelta;
			
			data[stereoBufferIndex] += output * stereoVolume1;
			data[(stereoBufferIndex + stereoDelay) % stereoBufferLength] += output * stereoVolume2;
			stereoBufferIndex += 2;
		}
		
		tone.phases[0] = phase / Config.chipNoiseLength;
		tone.sample = sample;
		
		const epsilon: number = (1.0e-24);
		if (-epsilon < filterSample0 && filterSample0 < epsilon) filterSample0 = 0.0;
		if (-epsilon < filterSample1 && filterSample1 < epsilon) filterSample1 = 0.0;
		tone.filterSample0 = filterSample0;
		tone.filterSample1 = filterSample1;
	}
	
	private static spectrumSynth(synth: SynthWorker, data: Float32Array, stereoBufferIndex: number, stereoBufferLength: number, runLength: number, tone: Tone, instrument: Instrument): void {
		let wave: Float32Array = instrument.getDrumWave();
		let phaseDelta: number = tone.phaseDeltas[0] * (1 << 7);
		const phaseDeltaScale: number = +tone.phaseDeltaScale;
		let volume: number = +tone.volumeStart;
		const volumeDelta: number = +tone.volumeDelta;
		let sample: number = +tone.sample;
		let filter1: number = +tone.filter;
		let filter2: number = instrument.getFilterIsFirstOrder() ? 1.0 : filter1;
		const filterScale1: number = +tone.filterScale;
		const filterScale2: number = instrument.getFilterIsFirstOrder() ? 1.0 : filterScale1;
		const filterResonance = Config.filterMaxResonance * Math.pow(Math.max(0, instrument.getFilterResonance() - 1) / (Config.filterResonanceRange - 2), 0.5);
		let filterSample0: number = +tone.filterSample0;
		let filterSample1: number = +tone.filterSample1;
		
		let phase: number = (tone.phases[0] % 1) * Config.chipNoiseLength;
		// Zero phase means the tone was reset, just give noise a random start phase instead.
		if (tone.phases[0] == 0) phase = SynthWorker.findRandomZeroCrossing(wave) + phaseDelta;
		
		const pitchRelativefilter: number = Math.min(1.0, phaseDelta);
		
		const stopIndex: number = stereoBufferIndex + runLength;
		stereoBufferIndex += tone.stereoOffset;
		const stereoVolume1: number = tone.stereoVolume1;
		const stereoVolume2: number = tone.stereoVolume2;
		const stereoDelay: number = tone.stereoDelay;
		while (stereoBufferIndex < stopIndex) {
			const phaseInt: number = phase|0;
			const index: number = phaseInt & 0x7fff;
			let waveSample: number = wave[index];
			const phaseRatio: number = phase - phaseInt;
			waveSample += (wave[index + 1] - waveSample) * phaseRatio;
			
			sample += (waveSample - sample) * pitchRelativefilter;
			
			const feedback: number = filterResonance + filterResonance / (1.0 - filter1);
			filterSample0 += filter1 * (sample - filterSample0 + feedback * (filterSample0 - filterSample1));
			filterSample1 += filter2 * (filterSample0 - filterSample1);
		
			phase += phaseDelta;
			filter1 *= filterScale1;
			filter2 *= filterScale2;
			phaseDelta *= phaseDeltaScale;
			
			const output: number = filterSample1 * volume;
			volume += volumeDelta;
			
			data[stereoBufferIndex] += output * stereoVolume1;
			data[(stereoBufferIndex + stereoDelay) % stereoBufferLength] += output * stereoVolume2;
			stereoBufferIndex += 2;
		}
		
		tone.phases[0] = phase / Config.chipNoiseLength;
		tone.sample = sample;
		
		const epsilon: number = (1.0e-24);
		if (-epsilon < filterSample0 && filterSample0 < epsilon) filterSample0 = 0.0;
		if (-epsilon < filterSample1 && filterSample1 < epsilon) filterSample1 = 0.0;
		tone.filterSample0 = filterSample0;
		tone.filterSample1 = filterSample1;
	}
	
	private static drumsetSynth(synth: SynthWorker, data: Float32Array, stereoBufferIndex: number, stereoBufferLength: number, runLength: number, tone: Tone, instrument: Instrument): void {
		let wave: Float32Array = instrument.getDrumsetWave(tone.drumsetPitch);
		let phaseDelta: number = tone.phaseDeltas[0] / Instrument.drumsetIndexReferenceDelta(tone.drumsetPitch);;
		const phaseDeltaScale: number = +tone.phaseDeltaScale;
		let volume: number = +tone.volumeStart;
		const volumeDelta: number = +tone.volumeDelta;
		let sample: number = +tone.sample;
		let filter1: number = +tone.filter;
		let filter2: number = instrument.getFilterIsFirstOrder() ? 1.0 : filter1;
		const filterScale1: number = +tone.filterScale;
		const filterScale2: number = instrument.getFilterIsFirstOrder() ? 1.0 : filterScale1;
		const filterResonance = Config.filterMaxResonance * Math.pow(Math.max(0, instrument.getFilterResonance() - 1) / (Config.filterResonanceRange - 2), 0.5);
		let filterSample0: number = +tone.filterSample0;
		let filterSample1: number = +tone.filterSample1;
		
		let phase: number = (tone.phases[0] % 1) * Config.chipNoiseLength;
		// Zero phase means the tone was reset, just give noise a random start phase instead.
		if (tone.phases[0] == 0) phase = SynthWorker.findRandomZeroCrossing(wave) + phaseDelta;
		
		const stopIndex: number = stereoBufferIndex + runLength;
		stereoBufferIndex += tone.stereoOffset;
		const stereoVolume1: number = tone.stereoVolume1;
		const stereoVolume2: number = tone.stereoVolume2;
		const stereoDelay: number = tone.stereoDelay;
		while (stereoBufferIndex < stopIndex) {
			const phaseInt: number = phase|0;
			const index: number = phaseInt & 0x7fff;
			sample = wave[index];
			const phaseRatio: number = phase - phaseInt;
			sample += (wave[index + 1] - sample) * phaseRatio;
			
			const feedback: number = filterResonance + filterResonance / (1.0 - filter1);
			filterSample0 += filter1 * (sample - filterSample0 + feedback * (filterSample0 - filterSample1));
			filterSample1 += filter2 * (filterSample0 - filterSample1);
		
			phase += phaseDelta;
			filter1 *= filterScale1;
			filter2 *= filterScale2;
			phaseDelta *= phaseDeltaScale;
			
			const output: number = filterSample1 * volume;
			volume += volumeDelta;
			
			data[stereoBufferIndex] += output * stereoVolume1;
			data[(stereoBufferIndex + stereoDelay) % stereoBufferLength] += output * stereoVolume2;
			stereoBufferIndex += 2;
		}
		
		tone.phases[0] = phase / Config.chipNoiseLength;
		tone.sample = sample;
		
		const epsilon: number = (1.0e-24);
		if (-epsilon < filterSample0 && filterSample0 < epsilon) filterSample0 = 0.0;
		if (-epsilon < filterSample1 && filterSample1 < epsilon) filterSample1 = 0.0;
		tone.filterSample0 = filterSample0;
		tone.filterSample1 = filterSample1;
	}
	
	private static findRandomZeroCrossing(wave: Float32Array): number {
		let phase: number = Math.random() * Config.chipNoiseLength;
		
		// Spectrum and drumset waves sounds best when they start at a zero crossing,
		// otherwise they pop. Try to find a zero crossing.
		let indexPrev: number = phase & 0x7fff;
		let wavePrev: number = wave[indexPrev];
		const stride: number = 16;
		for (let attemptsRemaining: number = 128; attemptsRemaining > 0; attemptsRemaining--) {
			const indexNext: number = (indexPrev + stride) & 0x7fff;
			const waveNext: number = wave[indexNext];
			if (wavePrev * waveNext <= 0.0) {
				// Found a zero crossing! Now let's narrow it down to two adjacent sample indices.
				for (let i: number = 0; i < 16; i++) {
					const innerIndexNext: number = (indexPrev + 1) & 0x7fff;
					const innerWaveNext: number = wave[innerIndexNext];
					if (wavePrev * innerWaveNext <= 0.0) {
						// Found the zero crossing again! Now let's find the exact intersection.
						const slope: number = innerWaveNext - wavePrev;
						phase = indexPrev;
						if (Math.abs(slope) > 0.00000001) {
							phase += -wavePrev / slope;
						}
						phase = Math.max(0, phase) % Config.chipNoiseLength;
						break;
					} else {
						indexPrev = innerIndexNext;
						wavePrev = innerWaveNext;
					}
				}
				break;
			} else {
				indexPrev = indexNext;
				wavePrev = waveNext;
			}
		}
		
		return phase;
	}

			
	private static operatorAmplitudeCurve(amplitude: number): number {
		return (Math.pow(16.0, amplitude / 15.0) - 1.0) / 15.0;
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

registerProcessor('synthWorker', SynthWorker);

