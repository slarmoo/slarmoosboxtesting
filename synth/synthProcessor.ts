// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { Dictionary, FilterType, SustainType, EnvelopeType, InstrumentType, EnvelopeComputeIndex, Transition, Unison, Chord, Envelope, AutomationTarget, Config, getDrumWave, drawNoiseSpectrum, getArpeggioPitchIndex, performIntegralOld, getPulseWidthRatio, effectsIncludePitchShift, effectsIncludeDetune, effectsIncludeVibrato, effectsIncludeNoteFilter, effectsIncludeDistortion, effectsIncludeBitcrusher, effectsIncludePanning, effectsIncludeChorus, effectsIncludeEcho, effectsIncludeReverb, /*effectsIncludeNoteRange,*/ effectsIncludeRingModulation, effectsIncludeGranular, OperatorWave, LFOEnvelopeTypes, RandomEnvelopeTypes, GranularEnvelopeType, calculateRingModHertz, effectsIncludePlugin, effectsIncludeChord, effectsIncludeNoteRange, effectsIncludeTransition } from "./SynthConfig";
import { NotePin, Note, Pattern, SpectrumWave, HarmonicsWave, EnvelopeSettings, FilterSettings, FilterControlPoint, Instrument, Channel, Song, SequenceSettings } from "./synthMessenger"
import { scaleElementsByFactor, inverseRealFourierTransform } from "./FFT";
import { Deque } from "./Deque";
// import { events } from "../global/Events";
import { FilterCoefficients, FrequencyResponse, DynamicBiquadFilter, warpInfinityToNyquist } from "./filtering";
import { xxHash32 } from "js-xxhash";
import { DeactivateMessage, LiveInputValues, MaintainLiveInputMessage, Message, MessageFlag, SongPositionMessage } from "./synthMessages";
import { RingBuffer } from "ringbuf.js";
import { BeepboxSet } from "./Set";

const epsilon: number = (1.0e-24); // For detecting and avoiding float denormals, which have poor performance.

export function clamp(min: number, max: number, val: number): number {
    max = max - 1;
    if (val <= max) {
        if (val >= min) return val;
        else return min;
    } else {
        return max;
    }
}

class SpectrumWaveState {
    public wave: Float32Array | null = null;
    private _hash: number = -1;

    public getCustomWave(settings: SpectrumWave, lowestOctave: number): Float32Array {
        if (this._hash == settings.hash) return this.wave!;
        this._hash = settings.hash;

        const waveLength: number = Config.spectrumNoiseLength;
        if (this.wave == null || this.wave.length != waveLength + 1) {
            this.wave = new Float32Array(waveLength + 1);
        }
        const wave: Float32Array = this.wave;

        for (let i: number = 0; i < waveLength; i++) {
            wave[i] = 0;
        }

        const highestOctave: number = 14;
        const falloffRatio: number = 0.25;
        // Nudge the 2/7 and 4/7 control points so that they form harmonic intervals.
        const pitchTweak: number[] = [0, 1 / 7, Math.log2(5 / 4), 3 / 7, Math.log2(3 / 2), 5 / 7, 6 / 7];
        function controlPointToOctave(point: number): number {
            return lowestOctave + Math.floor(point / Config.spectrumControlPointsPerOctave) + pitchTweak[(point + Config.spectrumControlPointsPerOctave) % Config.spectrumControlPointsPerOctave];
        }

        let combinedAmplitude: number = 1;
        for (let i: number = 0; i < Config.spectrumControlPoints + 1; i++) {
            const value1: number = (i <= 0) ? 0 : settings.spectrum[i - 1];
            const value2: number = (i >= Config.spectrumControlPoints) ? settings.spectrum[Config.spectrumControlPoints - 1] : settings.spectrum[i];
            const octave1: number = controlPointToOctave(i - 1);
            let octave2: number = controlPointToOctave(i);
            if (i >= Config.spectrumControlPoints) octave2 = highestOctave + (octave2 - highestOctave) * falloffRatio;
            if (value1 == 0 && value2 == 0) continue;

            combinedAmplitude += 0.02 * drawNoiseSpectrum(wave, waveLength, octave1, octave2, value1 / Config.spectrumMax, value2 / Config.spectrumMax, -0.5);
        }
        if (settings.spectrum[Config.spectrumControlPoints - 1] > 0) {
            combinedAmplitude += 0.02 * drawNoiseSpectrum(wave, waveLength, highestOctave + (controlPointToOctave(Config.spectrumControlPoints) - highestOctave) * falloffRatio, highestOctave, settings.spectrum[Config.spectrumControlPoints - 1] / Config.spectrumMax, 0, -0.5);
        }

        inverseRealFourierTransform(wave, waveLength);
        scaleElementsByFactor(wave, 5.0 / (Math.sqrt(waveLength) * Math.pow(combinedAmplitude, 0.75)));

        // Duplicate the first sample at the end for easier wrap-around interpolation.
        wave[waveLength] = wave[0];

        return wave;
    }
}

class HarmonicsWaveState {
    public wave: Float32Array | null = null;
    private _hash: number = -1;
    private _generatedForType: InstrumentType;

    public getCustomWave(settings: HarmonicsWave, instrumentType: InstrumentType): Float32Array {
        if (this._hash == settings.hash && this._generatedForType == instrumentType) return this.wave!;
        this._hash = settings.hash;
        this._generatedForType = instrumentType;

        const harmonicsRendered: number = (instrumentType == InstrumentType.pickedString) ? Config.harmonicsRenderedForPickedString : Config.harmonicsRendered;

        const waveLength: number = Config.harmonicsWavelength;
        const retroWave: Float32Array = getDrumWave(0, null, null);

        if (this.wave == null || this.wave.length != waveLength + 1) {
            this.wave = new Float32Array(waveLength + 1);
        }
        const wave: Float32Array = this.wave;

        for (let i: number = 0; i < waveLength; i++) {
            wave[i] = 0;
        }

        const overallSlope: number = -0.25;
        let combinedControlPointAmplitude: number = 1;

        for (let harmonicIndex: number = 0; harmonicIndex < harmonicsRendered; harmonicIndex++) {
            const harmonicFreq: number = harmonicIndex + 1;
            let controlValue: number = harmonicIndex < Config.harmonicsControlPoints ? settings.harmonics[harmonicIndex] : settings.harmonics[Config.harmonicsControlPoints - 1];
            if (harmonicIndex >= Config.harmonicsControlPoints) {
                controlValue *= 1 - (harmonicIndex - Config.harmonicsControlPoints) / (harmonicsRendered - Config.harmonicsControlPoints);
            }
            const normalizedValue: number = controlValue / Config.harmonicsMax;
            let amplitude: number = Math.pow(2, controlValue - Config.harmonicsMax + 1) * Math.sqrt(normalizedValue);
            if (harmonicIndex < Config.harmonicsControlPoints) {
                combinedControlPointAmplitude += amplitude;
            }
            amplitude *= Math.pow(harmonicFreq, overallSlope);

            // Multiply all the sine wave amplitudes by 1 or -1 based on the LFSR
            // retro wave (effectively random) to avoid egregiously tall spikes.
            amplitude *= retroWave[harmonicIndex + 589];

            wave[waveLength - harmonicFreq] = amplitude;
        }

        inverseRealFourierTransform(wave, waveLength);

        // Limit the maximum wave amplitude.
        const mult: number = 1 / Math.pow(combinedControlPointAmplitude, 0.7);
        for (let i: number = 0; i < wave.length; i++) wave[i] *= mult;

        performIntegralOld(wave);

        // The first sample should be zero, and we'll duplicate it at the end for easier interpolation.
        wave[waveLength] = wave[0];

        return wave;
    }
}

class Grain {
    public delayLinePosition: number; // Relative to latest sample

    public ageInSamples: number;
    public maxAgeInSamples: number;
    public delay: number;

    //parabolic envelope implementation
    public parabolicEnvelopeAmplitude: number;
    public parabolicEnvelopeSlope: number;
    public parabolicEnvelopeCurve: number;

    //raised cosine bell envelope implementation
    public rcbEnvelopeAmplitude: number;
    public rcbEnvelopeAttackIndex: number;
    public rcbEnvelopeReleaseIndex: number;
    public rcbEnvelopeSustain: number;

    constructor() {
        this.delayLinePosition = 0;

        this.ageInSamples = 0;
        this.maxAgeInSamples = 0;
        this.delay = 0;

        this.parabolicEnvelopeAmplitude = 0;
        this.parabolicEnvelopeSlope = 0;
        this.parabolicEnvelopeCurve = 0;

        this.rcbEnvelopeAmplitude = 0;
        this.rcbEnvelopeAttackIndex = 0;
        this.rcbEnvelopeReleaseIndex = 0;
        this.rcbEnvelopeSustain = 0;
    }

    public initializeParabolicEnvelope(durationInSamples: number, amplitude: number): void {
        this.parabolicEnvelopeAmplitude = 0;
        if (durationInSamples == 0) durationInSamples++; //prevent division by 0
        const invDuration: number = 1.0 / durationInSamples;
        const invDurationSquared: number = invDuration * invDuration;
        this.parabolicEnvelopeSlope = 4.0 * amplitude * (invDuration - invDurationSquared);
        this.parabolicEnvelopeCurve = -8.0 * amplitude * invDurationSquared;
    }

    public updateParabolicEnvelope(): void {
        this.parabolicEnvelopeAmplitude += this.parabolicEnvelopeSlope;
        this.parabolicEnvelopeSlope += this.parabolicEnvelopeCurve;
    }

    //rcb is unfinished and unused rn
    public initializeRCBEnvelope(durationInSamples: number, amplitude: number): void {
        // attack:
        this.rcbEnvelopeAttackIndex = Math.floor(durationInSamples / 6);
        // sustain:
        this.rcbEnvelopeSustain = amplitude;
        // release:
        this.rcbEnvelopeReleaseIndex = Math.floor(durationInSamples * 5 / 6);
    }

    public updateRCBEnvelope(): void {
        if (this.ageInSamples < this.rcbEnvelopeAttackIndex) { //attack
            this.rcbEnvelopeAmplitude = (1.0 + Math.cos(Math.PI + (Math.PI * (this.ageInSamples / this.rcbEnvelopeAttackIndex) * (this.rcbEnvelopeSustain / 2.0))));
        } else if (this.ageInSamples > this.rcbEnvelopeReleaseIndex) { //release
            this.rcbEnvelopeAmplitude = (1.0 + Math.cos(Math.PI * ((this.ageInSamples - this.rcbEnvelopeReleaseIndex) / this.rcbEnvelopeAttackIndex)) * (this.rcbEnvelopeSustain / 2.0));
        } //sustain covered by the end of attack
    }

    public addDelay(delay: number): void {
        this.delay = delay;
    }
}
interface HeldMod {
    volume: number;
    channelIndex: number;
    instrumentIndex: number;
    setting: number;
    holdFor: number;
}

class PickedString {
    public delayLine: Float32Array | null = null;
    public delayIndex: number;
    public allPassSample: number;
    public allPassPrevInput: number;
    public sustainFilterSample: number;
    public sustainFilterPrevOutput2: number;
    public sustainFilterPrevInput1: number;
    public sustainFilterPrevInput2: number;
    public fractionalDelaySample: number;
    public prevDelayLength: number;
    public delayLengthDelta: number;
    public delayResetOffset: number;

    public allPassG: number = 0.0;
    public allPassGDelta: number = 0.0;
    public sustainFilterA1: number = 0.0;
    public sustainFilterA1Delta: number = 0.0;
    public sustainFilterA2: number = 0.0;
    public sustainFilterA2Delta: number = 0.0;
    public sustainFilterB0: number = 0.0;
    public sustainFilterB0Delta: number = 0.0;
    public sustainFilterB1: number = 0.0;
    public sustainFilterB1Delta: number = 0.0;
    public sustainFilterB2: number = 0.0;
    public sustainFilterB2Delta: number = 0.0;

    constructor() {
        this.reset();
    }

    public reset(): void {
        this.delayIndex = -1;
        this.allPassSample = 0.0;
        this.allPassPrevInput = 0.0;
        this.sustainFilterSample = 0.0;
        this.sustainFilterPrevOutput2 = 0.0;
        this.sustainFilterPrevInput1 = 0.0;
        this.sustainFilterPrevInput2 = 0.0;
        this.fractionalDelaySample = 0.0;
        this.prevDelayLength = -1.0;
        this.delayResetOffset = 0;
    }

    public update(synth: SynthProcessor, instrumentState: InstrumentState, tone: Tone, stringIndex: number, roundedSamplesPerTick: number, stringDecayStart: number, stringDecayEnd: number, sustainType: SustainType): void {
        const allPassCenter: number = 2.0 * Math.PI * Config.pickedStringDispersionCenterFreq / synth.samplesPerSecond;

        const prevDelayLength: number = this.prevDelayLength;

        const phaseDeltaStart: number = tone.phaseDeltas[stringIndex];
        const phaseDeltaScale: number = tone.phaseDeltaScales[stringIndex];
        const phaseDeltaEnd: number = phaseDeltaStart * Math.pow(phaseDeltaScale, roundedSamplesPerTick);

        const radiansPerSampleStart: number = Math.PI * 2.0 * phaseDeltaStart;
        const radiansPerSampleEnd: number = Math.PI * 2.0 * phaseDeltaEnd;

        const centerHarmonicStart: number = radiansPerSampleStart * 2.0;
        const centerHarmonicEnd: number = radiansPerSampleEnd * 2.0;

        const allPassRadiansStart: number = Math.min(Math.PI, radiansPerSampleStart * Config.pickedStringDispersionFreqMult * Math.pow(allPassCenter / radiansPerSampleStart, Config.pickedStringDispersionFreqScale));
        const allPassRadiansEnd: number = Math.min(Math.PI, radiansPerSampleEnd * Config.pickedStringDispersionFreqMult * Math.pow(allPassCenter / radiansPerSampleEnd, Config.pickedStringDispersionFreqScale));
        const shelfRadians: number = 2.0 * Math.PI * Config.pickedStringShelfHz / synth.samplesPerSecond;
        const decayCurveStart: number = (Math.pow(100.0, stringDecayStart) - 1.0) / 99.0;
        const decayCurveEnd: number = (Math.pow(100.0, stringDecayEnd) - 1.0) / 99.0;
        const register: number = sustainType == SustainType.acoustic ? 0.25 : 0.0;
        const registerShelfCenter: number = 15.6;
        const registerLowpassCenter: number = 3.0 * synth.samplesPerSecond / 48000;
        //const decayRateStart: number = Math.pow(0.5, decayCurveStart * shelfRadians / radiansPerSampleStart);
        //const decayRateEnd: number   = Math.pow(0.5, decayCurveEnd   * shelfRadians / radiansPerSampleEnd);
        const decayRateStart: number = Math.pow(0.5, decayCurveStart * Math.pow(shelfRadians / (radiansPerSampleStart * registerShelfCenter), (1.0 + 2.0 * register)) * registerShelfCenter);
        const decayRateEnd: number = Math.pow(0.5, decayCurveEnd * Math.pow(shelfRadians / (radiansPerSampleEnd * registerShelfCenter), (1.0 + 2.0 * register)) * registerShelfCenter);

        const expressionDecayStart: number = Math.pow(decayRateStart, 0.002);
        const expressionDecayEnd: number = Math.pow(decayRateEnd, 0.002);

        SynthProcessor.tempFilterStartCoefficients.allPass1stOrderInvertPhaseAbove(allPassRadiansStart);
        synth.tempFrequencyResponse.analyze(SynthProcessor.tempFilterStartCoefficients, centerHarmonicStart);
        const allPassGStart: number = SynthProcessor.tempFilterStartCoefficients.b[0]; /* same as a[1] */
        const allPassPhaseDelayStart: number = -synth.tempFrequencyResponse.angle() / centerHarmonicStart;

        SynthProcessor.tempFilterEndCoefficients.allPass1stOrderInvertPhaseAbove(allPassRadiansEnd);
        synth.tempFrequencyResponse.analyze(SynthProcessor.tempFilterEndCoefficients, centerHarmonicEnd);
        const allPassGEnd: number = SynthProcessor.tempFilterEndCoefficients.b[0]; /* same as a[1] */
        const allPassPhaseDelayEnd: number = -synth.tempFrequencyResponse.angle() / centerHarmonicEnd;

        // 1st order shelf filters and 2nd order lowpass filters have differently shaped frequency
        // responses, as well as adjustable shapes. I originally picked a 1st order shelf filter,
        // but I kinda prefer 2nd order lowpass filters now and I designed a couple settings:
        const enum PickedStringBrightnessType {
            bright, // 1st order shelf
            normal, // 2nd order lowpass, rounded corner
            resonant, // 3rd order lowpass, harder corner
        }
        const brightnessType: PickedStringBrightnessType = <any>sustainType == SustainType.bright ? PickedStringBrightnessType.bright : PickedStringBrightnessType.normal;
        if (brightnessType == PickedStringBrightnessType.bright) {
            const shelfGainStart: number = Math.pow(decayRateStart, Config.stringDecayRate);
            const shelfGainEnd: number = Math.pow(decayRateEnd, Config.stringDecayRate);
            SynthProcessor.tempFilterStartCoefficients.highShelf2ndOrder(shelfRadians, shelfGainStart, 0.5);
            SynthProcessor.tempFilterEndCoefficients.highShelf2ndOrder(shelfRadians, shelfGainEnd, 0.5);
        } else {
            const cornerHardness: number = Math.pow(brightnessType == PickedStringBrightnessType.normal ? 0.0 : 1.0, 0.25);
            const lowpass1stOrderCutoffRadiansStart: number = Math.pow(registerLowpassCenter * registerLowpassCenter * radiansPerSampleStart * 3.3 * 48000 / synth.samplesPerSecond, 0.5 + register) / registerLowpassCenter / Math.pow(decayCurveStart, .5);
            const lowpass1stOrderCutoffRadiansEnd: number = Math.pow(registerLowpassCenter * registerLowpassCenter * radiansPerSampleEnd * 3.3 * 48000 / synth.samplesPerSecond, 0.5 + register) / registerLowpassCenter / Math.pow(decayCurveEnd, .5);
            const lowpass2ndOrderCutoffRadiansStart: number = lowpass1stOrderCutoffRadiansStart * Math.pow(2.0, 0.5 - 1.75 * (1.0 - Math.pow(1.0 - cornerHardness, 0.85)));
            const lowpass2ndOrderCutoffRadiansEnd: number = lowpass1stOrderCutoffRadiansEnd * Math.pow(2.0, 0.5 - 1.75 * (1.0 - Math.pow(1.0 - cornerHardness, 0.85)));
            const lowpass2ndOrderGainStart: number = Math.pow(2.0, -Math.pow(2.0, -Math.pow(cornerHardness, 0.9)));
            const lowpass2ndOrderGainEnd: number = Math.pow(2.0, -Math.pow(2.0, -Math.pow(cornerHardness, 0.9)));
            SynthProcessor.tempFilterStartCoefficients.lowPass2ndOrderButterworth(warpInfinityToNyquist(lowpass2ndOrderCutoffRadiansStart), lowpass2ndOrderGainStart);
            SynthProcessor.tempFilterEndCoefficients.lowPass2ndOrderButterworth(warpInfinityToNyquist(lowpass2ndOrderCutoffRadiansEnd), lowpass2ndOrderGainEnd);
        }

        synth.tempFrequencyResponse.analyze(SynthProcessor.tempFilterStartCoefficients, centerHarmonicStart);
        const sustainFilterA1Start: number = SynthProcessor.tempFilterStartCoefficients.a[1];
        const sustainFilterA2Start: number = SynthProcessor.tempFilterStartCoefficients.a[2];
        const sustainFilterB0Start: number = SynthProcessor.tempFilterStartCoefficients.b[0] * expressionDecayStart;
        const sustainFilterB1Start: number = SynthProcessor.tempFilterStartCoefficients.b[1] * expressionDecayStart;
        const sustainFilterB2Start: number = SynthProcessor.tempFilterStartCoefficients.b[2] * expressionDecayStart;
        const sustainFilterPhaseDelayStart: number = -synth.tempFrequencyResponse.angle() / centerHarmonicStart;

        synth.tempFrequencyResponse.analyze(SynthProcessor.tempFilterEndCoefficients, centerHarmonicEnd);
        const sustainFilterA1End: number = SynthProcessor.tempFilterEndCoefficients.a[1];
        const sustainFilterA2End: number = SynthProcessor.tempFilterEndCoefficients.a[2];
        const sustainFilterB0End: number = SynthProcessor.tempFilterEndCoefficients.b[0] * expressionDecayEnd;
        const sustainFilterB1End: number = SynthProcessor.tempFilterEndCoefficients.b[1] * expressionDecayEnd;
        const sustainFilterB2End: number = SynthProcessor.tempFilterEndCoefficients.b[2] * expressionDecayEnd;
        const sustainFilterPhaseDelayEnd: number = -synth.tempFrequencyResponse.angle() / centerHarmonicEnd;

        const periodLengthStart: number = 1.0 / phaseDeltaStart;
        const periodLengthEnd: number = 1.0 / phaseDeltaEnd;
        const minBufferLength: number = Math.ceil(Math.max(periodLengthStart, periodLengthEnd) * 2);
        const delayLength: number = periodLengthStart - allPassPhaseDelayStart - sustainFilterPhaseDelayStart;
        const delayLengthEnd: number = periodLengthEnd - allPassPhaseDelayEnd - sustainFilterPhaseDelayEnd;

        this.prevDelayLength = delayLength;
        this.delayLengthDelta = (delayLengthEnd - delayLength) / roundedSamplesPerTick;
        this.allPassG = allPassGStart;
        this.sustainFilterA1 = sustainFilterA1Start;
        this.sustainFilterA2 = sustainFilterA2Start;
        this.sustainFilterB0 = sustainFilterB0Start;
        this.sustainFilterB1 = sustainFilterB1Start;
        this.sustainFilterB2 = sustainFilterB2Start;
        this.allPassGDelta = (allPassGEnd - allPassGStart) / roundedSamplesPerTick;
        this.sustainFilterA1Delta = (sustainFilterA1End - sustainFilterA1Start) / roundedSamplesPerTick;
        this.sustainFilterA2Delta = (sustainFilterA2End - sustainFilterA2Start) / roundedSamplesPerTick;
        this.sustainFilterB0Delta = (sustainFilterB0End - sustainFilterB0Start) / roundedSamplesPerTick;
        this.sustainFilterB1Delta = (sustainFilterB1End - sustainFilterB1Start) / roundedSamplesPerTick;
        this.sustainFilterB2Delta = (sustainFilterB2End - sustainFilterB2Start) / roundedSamplesPerTick;

        const pitchChanged: boolean = Math.abs(Math.log2(delayLength / prevDelayLength)) > 0.01;

        const reinitializeImpulse: boolean = (this.delayIndex == -1 || pitchChanged);
        if (this.delayLine == null || this.delayLine.length <= minBufferLength) {
            // The delay line buffer will get reused for other tones so might as well
            // start off with a buffer size that is big enough for most notes.
            const likelyMaximumLength: number = Math.ceil(2 * synth.samplesPerSecond / Instrument.frequencyFromPitch(12));
            const newDelayLine: Float32Array = new Float32Array(SynthProcessor.fittingPowerOfTwo(Math.max(likelyMaximumLength, minBufferLength)));
            if (!reinitializeImpulse && this.delayLine != null) {
                // If the tone has already started but the buffer needs to be reallocated,
                // transfer the old data to the new buffer.
                const oldDelayBufferMask: number = (this.delayLine.length - 1) >> 0;
                const startCopyingFromIndex: number = this.delayIndex + this.delayResetOffset;
                this.delayIndex = this.delayLine.length - this.delayResetOffset;
                for (let i: number = 0; i < this.delayLine.length; i++) {
                    newDelayLine[i] = this.delayLine[(startCopyingFromIndex + i) & oldDelayBufferMask];
                }
            }
            this.delayLine = newDelayLine;
        }
        const delayLine: Float32Array = this.delayLine;
        const delayBufferMask: number = (delayLine.length - 1) >> 0;

        if (reinitializeImpulse) {
            // -1 delay index means the tone was reset.
            // Also, if the pitch changed suddenly (e.g. from seamless or arpeggio) then reset the wave.

            this.delayIndex = 0;
            this.allPassSample = 0.0;
            this.allPassPrevInput = 0.0;
            this.sustainFilterSample = 0.0;
            this.sustainFilterPrevOutput2 = 0.0;
            this.sustainFilterPrevInput1 = 0.0;
            this.sustainFilterPrevInput2 = 0.0;
            this.fractionalDelaySample = 0.0;

            // Clear away a region of the delay buffer for the new impulse.
            const startImpulseFrom: number = -delayLength;
            const startZerosFrom: number = Math.floor(startImpulseFrom - periodLengthStart / 2);
            const stopZerosAt: number = Math.ceil(startZerosFrom + periodLengthStart * 2);
            this.delayResetOffset = stopZerosAt; // And continue clearing the area in front of the delay line.
            for (let i: number = startZerosFrom; i <= stopZerosAt; i++) {
                delayLine[i & delayBufferMask] = 0.0;
            }

            const impulseWave: Float32Array = instrumentState.wave!;
            const impulseWaveLength: number = impulseWave.length - 1; // The first sample is duplicated at the end, don't double-count it.
            const impulsePhaseDelta: number = impulseWaveLength / periodLengthStart;

            const fadeDuration: number = Math.min(periodLengthStart * 0.2, synth.samplesPerSecond * 0.003);
            const startImpulseFromSample: number = Math.ceil(startImpulseFrom);
            const stopImpulseAt: number = startImpulseFrom + periodLengthStart + fadeDuration;
            const stopImpulseAtSample: number = stopImpulseAt;
            let impulsePhase: number = (startImpulseFromSample - startImpulseFrom) * impulsePhaseDelta;
            let prevWaveIntegral: number = 0.0;
            for (let i: number = startImpulseFromSample; i <= stopImpulseAtSample; i++) {
                const impulsePhaseInt: number = impulsePhase | 0;
                const index: number = impulsePhaseInt % impulseWaveLength;
                let nextWaveIntegral: number = impulseWave[index];
                const phaseRatio: number = impulsePhase - impulsePhaseInt;
                nextWaveIntegral += (impulseWave[index + 1] - nextWaveIntegral) * phaseRatio;
                const sample: number = (nextWaveIntegral - prevWaveIntegral) / impulsePhaseDelta;
                const fadeIn: number = Math.min(1.0, (i - startImpulseFrom) / fadeDuration);
                const fadeOut: number = Math.min(1.0, (stopImpulseAt - i) / fadeDuration);
                const combinedFade: number = fadeIn * fadeOut;
                const curvedFade: number = combinedFade * combinedFade * (3.0 - 2.0 * combinedFade); // A cubic sigmoid from 0 to 1.
                delayLine[i & delayBufferMask] += sample * curvedFade;
                prevWaveIntegral = nextWaveIntegral;
                impulsePhase += impulsePhaseDelta;
            }
        }
    }
}

class EnvelopeComputer {
    // "Unscaled" values do not increase with Envelope Speed's timescale factor. Thus they are "real" seconds since the start of the note.
    // Fade envelopes notably use unscaled values instead of being tied to Envelope Speed.
    public noteSecondsStart: number[] = [];
    public noteSecondsStartUnscaled: number = 0.0;
    public noteSecondsEnd: number[] = [];
    public noteSecondsEndUnscaled: number = 0.0;
    public noteTicksStart: number = 0.0;
    public noteTicksEnd: number = 0.0;
    public noteSizeStart: number = Config.noteSizeMax;
    public noteSizeEnd: number = Config.noteSizeMax;
    public prevNoteSize: number = Config.noteSizeMax;
    public nextNoteSize: number = Config.noteSizeMax;
    private _noteSizeFinal: number = Config.noteSizeMax;
    public prevNoteSecondsStart: number[] = [];
    public prevNoteSecondsStartUnscaled: number = 0.0;
    public prevNoteSecondsEnd: number[] = [];
    public prevNoteSecondsEndUnscaled: number = 0.0;
    public prevNoteTicksStart: number = 0.0;
    public prevNoteTicksEnd: number = 0.0;
    private _prevNoteSizeFinal: number = Config.noteSizeMax;
    public tickTimeEnd: number[] = [];

    public drumsetFilterEnvelopeStart: number = 0.0;
    public drumsetFilterEnvelopeEnd: number = 0.0;

    public prevSlideStart: boolean = false;
    public prevSlideEnd: boolean = false;
    public nextSlideStart: boolean = false;
    public nextSlideEnd: boolean = false;
    public prevSlideRatioStart: number = 0.0;
    public prevSlideRatioEnd: number = 0.0;
    public nextSlideRatioStart: number = 0.0;
    public nextSlideRatioEnd: number = 0.0;

    public startPinTickAbsolute: number | null = null;
    private startPinTickDefaultPitch: number | null = null;
    private startPinTickPitch: number | null = null;

    public readonly envelopeStarts: number[] = [];
    public readonly envelopeEnds: number[] = [];
    private readonly _modifiedEnvelopeIndices: number[] = [];
    private _modifiedEnvelopeCount: number = 0;
    public lowpassCutoffDecayVolumeCompensation: number = 1.0;

    constructor(/*private _perNote: boolean*/) {
        //const length: number = this._perNote ? EnvelopeComputeIndex.length : InstrumentAutomationIndex.length;
        const length: number = EnvelopeComputeIndex.length;
        for (let i: number = 0; i < length; i++) {
            this.envelopeStarts[i] = 1.0;
            this.envelopeEnds[i] = 1.0;
        }

        this.reset();
    }

    public reset(): void {
        for (let envelopeIndex: number = 0; envelopeIndex < Config.maxEnvelopeCount + 1; envelopeIndex++) {
            this.noteSecondsEnd[envelopeIndex] = 0.0;
            this.prevNoteSecondsEnd[envelopeIndex] = 0.0;
        }
        this.noteSecondsEndUnscaled = 0.0;
        this.noteTicksEnd = 0.0;
        this._noteSizeFinal = Config.noteSizeMax;
        this.prevNoteSecondsEndUnscaled = 0.0;
        this.prevNoteTicksEnd = 0.0;
        this._prevNoteSizeFinal = Config.noteSizeMax;
        this._modifiedEnvelopeCount = 0;
        this.drumsetFilterEnvelopeStart = 0.0;
        this.drumsetFilterEnvelopeEnd = 0.0;
        this.startPinTickAbsolute = null;
        this.startPinTickDefaultPitch = null;
        this.startPinTickPitch = null
    }

    public computeEnvelopes(instrument: Instrument, currentPart: number, tickTimeStart: number[], tickTimeStartReal: number, secondsPerTick: number, tone: Tone | null, timeScale: number[], instrumentState: InstrumentState, synth: SynthProcessor, channelIndex: number, instrumentIndex: number, perNote: boolean): void {
        const secondsPerTickUnscaled: number = secondsPerTick;
        const transition: Transition = instrument.getTransition();
        if (tone != null && tone.atNoteStart && !transition.continues && !tone.forceContinueAtStart) {
            this.prevNoteSecondsEndUnscaled = this.noteSecondsEndUnscaled;
            this.prevNoteTicksEnd = this.noteTicksEnd;
            this._prevNoteSizeFinal = this._noteSizeFinal;
            this.noteSecondsEndUnscaled = 0.0;
            this.noteTicksEnd = 0.0;
            for (let envelopeIndex: number = 0; envelopeIndex < Config.maxEnvelopeCount + 1; envelopeIndex++) {
                this.prevNoteSecondsEnd[envelopeIndex] = this.noteSecondsEnd[envelopeIndex];
                this.noteSecondsEnd[envelopeIndex] = 0.0;
            }
        }
        if (tone != null) {
            if (tone.note != null) {
                this._noteSizeFinal = tone.note.pins[tone.note.pins.length - 1].size;
            } else {
                this._noteSizeFinal = Config.noteSizeMax;
            }
        }
        const tickTimeEnd: number[] = [];
        const tickTimeEndReal: number = tickTimeStartReal + 1.0;
        const noteSecondsStart: number[] = [];
        const noteSecondsStartUnscaled: number = this.noteSecondsEndUnscaled;
        const noteSecondsEnd: number[] = [];
        const noteSecondsEndUnscaled: number = noteSecondsStartUnscaled + secondsPerTickUnscaled;
        const noteTicksStart: number = this.noteTicksEnd;
        const noteTicksEnd: number = noteTicksStart + 1.0;
        const prevNoteSecondsStart: number[] = [];
        const prevNoteSecondsEnd: number[] = [];
        const prevNoteSecondsStartUnscaled: number = this.prevNoteSecondsEndUnscaled;
        const prevNoteSecondsEndUnscaled: number = prevNoteSecondsStartUnscaled + secondsPerTickUnscaled;
        const prevNoteTicksStart: number = this.prevNoteTicksEnd;
        const prevNoteTicksEnd: number = prevNoteTicksStart + 1.0;

        const beatsPerTick: number = 1.0 / (Config.ticksPerPart * Config.partsPerBeat);
        const beatTimeStart: number[] = [];
        const beatTimeEnd: number[] = [];

        let noteSizeStart: number = this._noteSizeFinal;
        let noteSizeEnd: number = this._noteSizeFinal;
        let prevNoteSize: number = this._prevNoteSizeFinal;
        let nextNoteSize: number = 0;
        let prevSlideStart: boolean = false;
        let prevSlideEnd: boolean = false;
        let nextSlideStart: boolean = false;
        let nextSlideEnd: boolean = false;
        let prevSlideRatioStart: number = 0.0;
        let prevSlideRatioEnd: number = 0.0;
        let nextSlideRatioStart: number = 0.0;
        let nextSlideRatioEnd: number = 0.0;
        if (tone == null) {
            this.startPinTickAbsolute = null;
            this.startPinTickDefaultPitch = null;
        }
        if (tone != null && tone.note != null && !tone.passedEndOfNote) {
            const endPinIndex: number = tone.note.getEndPinIndex(currentPart);
            const startPin: NotePin = tone.note.pins[endPinIndex - 1];
            const endPin: NotePin = tone.note.pins[endPinIndex];
            const startPinTick = (tone.note.start + startPin.time) * Config.ticksPerPart;
            if (this.startPinTickAbsolute == null || (!(transition.continues || transition.slides)) && tone.passedEndOfNote) this.startPinTickAbsolute = startPinTick + synth.computeTicksSinceStart(true); //for random per note
            if (this.startPinTickDefaultPitch == null ||/* (!(transition.continues || transition.slides)) &&*/ tone.passedEndOfNote) this.startPinTickDefaultPitch = this.getPitchValue(instrument, tone, instrumentState, false);
            if (!tone.passedEndOfNote) this.startPinTickPitch = this.getPitchValue(instrument, tone, instrumentState, true);
            const endPinTick: number = (tone.note.start + endPin.time) * Config.ticksPerPart;
            const ratioStart: number = (tickTimeStartReal - startPinTick) / (endPinTick - startPinTick);
            const ratioEnd: number = (tickTimeEndReal - startPinTick) / (endPinTick - startPinTick);
            noteSizeStart = startPin.size + (endPin.size - startPin.size) * ratioStart;
            noteSizeEnd = startPin.size + (endPin.size - startPin.size) * ratioEnd;

            if (transition.slides) {
                const noteStartTick: number = tone.noteStartPart * Config.ticksPerPart;
                const noteEndTick: number = tone.noteEndPart * Config.ticksPerPart;
                const noteLengthTicks: number = noteEndTick - noteStartTick;
                const maximumSlideTicks: number = noteLengthTicks * 0.5;
                let slideTicks: number = instrument.slideTicks;
                if (synth.isModActive(Config.modulators.dictionary["slide speed"].index, channelIndex, instrumentIndex)) { //modulation
                    slideTicks = Config.maxSlideTicks + 1 - synth.getModValue(Config.modulators.dictionary["slide speed"].index, channelIndex, instrumentIndex, false);
                }
                slideTicks = Math.min(maximumSlideTicks, slideTicks *= instrumentState.slideEnvelopeStart);
                if (tone.prevNote != null && !tone.forceContinueAtStart) {
                    if (tickTimeStartReal - noteStartTick < slideTicks) {
                        prevSlideStart = true;
                        prevSlideRatioStart = 0.5 * (1.0 - (tickTimeStartReal - noteStartTick) / slideTicks);
                    }
                    if (tickTimeEndReal - noteStartTick < slideTicks) {
                        prevSlideEnd = true;
                        prevSlideRatioEnd = 0.5 * (1.0 - (tickTimeEndReal - noteStartTick) / slideTicks);
                    }
                }
                if (tone.nextNote != null && !tone.forceContinueAtEnd) {
                    nextNoteSize = tone.nextNote.pins[0].size
                    if (noteEndTick - tickTimeStartReal < slideTicks) {
                        nextSlideStart = true;
                        nextSlideRatioStart = 0.5 * (1.0 - (noteEndTick - tickTimeStartReal) / slideTicks);
                    }
                    if (noteEndTick - tickTimeEndReal < slideTicks) {
                        nextSlideEnd = true;
                        nextSlideRatioEnd = 0.5 * (1.0 - (noteEndTick - tickTimeEndReal) / slideTicks);
                    }
                }
            }
        }

        let lowpassCutoffDecayVolumeCompensation: number = 1.0;
        let usedNoteSize = false;
        for (let envelopeIndex: number = 0; envelopeIndex <= instrument.envelopeCount; envelopeIndex++) {
            let automationTarget: AutomationTarget;
            let targetIndex: number;
            let envelope: Envelope;

            let inverse: boolean = false;
            let isDiscrete: boolean = false;
            let perEnvelopeSpeed: number = 1;
            let globalEnvelopeSpeed: number = 1;
            let envelopeSpeed: number = perEnvelopeSpeed * globalEnvelopeSpeed;
            let perEnvelopeLowerBound: number = 0;
            let perEnvelopeUpperBound: number = 1;
            let timeSinceStart: number = 0;
            let steps: number = 2;
            let seed: number = 2;
            let waveform: number = LFOEnvelopeTypes.sine;
            let startPinTickAbsolute: number = this.startPinTickAbsolute || 0.0;
            let defaultPitch: number = this.startPinTickDefaultPitch || 0.0;
            let sequence: SequenceSettings | null = null;
            if (envelopeIndex == instrument.envelopeCount) {
                if (usedNoteSize /*|| !this._perNote*/) break;
                // Special case: if no other envelopes used note size, default to applying it to note volume.
                automationTarget = Config.instrumentAutomationTargets.dictionary["noteVolume"];
                targetIndex = 0;
                envelope = Config.envelopes.dictionary["note size"];
            } else {
                let envelopeSettings: EnvelopeSettings = instrument.envelopes[envelopeIndex];
                automationTarget = Config.instrumentAutomationTargets[envelopeSettings.target];
                targetIndex = envelopeSettings.index;
                envelope = Config.envelopes[envelopeSettings.envelope];
                inverse = instrument.envelopes[envelopeIndex].inverse;
                isDiscrete = instrument.envelopes[envelopeIndex].discrete;
                perEnvelopeSpeed = instrument.envelopes[envelopeIndex].perEnvelopeSpeed;
                globalEnvelopeSpeed = Math.pow(instrument.envelopeSpeed, 2) / 144;
                envelopeSpeed = perEnvelopeSpeed * globalEnvelopeSpeed;

                perEnvelopeLowerBound = instrument.envelopes[envelopeIndex].perEnvelopeLowerBound;
                perEnvelopeUpperBound = instrument.envelopes[envelopeIndex].perEnvelopeUpperBound;
                if (synth.isModActive(Config.modulators.dictionary["individual envelope lower bound"].index, channelIndex, instrumentIndex) && instrument.envelopes[envelopeIndex].tempEnvelopeLowerBound != null) { //modulation
                    perEnvelopeLowerBound = instrument.envelopes[envelopeIndex].tempEnvelopeLowerBound!;
                }
                if (synth.isModActive(Config.modulators.dictionary["individual envelope upper bound"].index, channelIndex, instrumentIndex) && instrument.envelopes[envelopeIndex].tempEnvelopeUpperBound != null) { //modulation
                    perEnvelopeUpperBound = instrument.envelopes[envelopeIndex].tempEnvelopeUpperBound!;
                }
                if (!(perEnvelopeLowerBound <= perEnvelopeUpperBound)) { //reset bounds if incorrect
                    perEnvelopeLowerBound = 0;
                    perEnvelopeUpperBound = 1;
                }

                timeSinceStart = synth.computeTicksSinceStart();
                steps = instrument.envelopes[envelopeIndex].steps;
                seed = instrument.envelopes[envelopeIndex].seed;
                if (instrument.envelopes[envelopeIndex].waveform >= (envelope.name == "lfo" ? LFOEnvelopeTypes.length : RandomEnvelopeTypes.length)) {
                    instrument.envelopes[envelopeIndex].waveform = 0; //make sure that waveform is a proper index
                }
                waveform = instrument.envelopes[envelopeIndex].waveform;

                if (envelope.type == EnvelopeType.sequence) {
                    sequence = synth.song?.sequences[waveform] || null
                }

                if (!timeScale[envelopeIndex]) timeScale[envelopeIndex] = 0;

                const secondsPerTickScaled: number = secondsPerTick * timeScale[envelopeIndex];
                if (!tickTimeStart[envelopeIndex]) tickTimeStart[envelopeIndex] = 0; //prevents tremolos from causing a NaN width error
                tickTimeEnd[envelopeIndex] = tickTimeStart[envelopeIndex] ? tickTimeStart[envelopeIndex] + timeScale[envelopeIndex] : timeScale[envelopeIndex];
                noteSecondsStart[envelopeIndex] = this.noteSecondsEnd[envelopeIndex] ? this.noteSecondsEnd[envelopeIndex] : 0;
                prevNoteSecondsStart[envelopeIndex] = this.prevNoteSecondsEnd[envelopeIndex] ? this.prevNoteSecondsEnd[envelopeIndex] : 0;
                noteSecondsEnd[envelopeIndex] = noteSecondsStart[envelopeIndex] ? noteSecondsStart[envelopeIndex] + secondsPerTickScaled : secondsPerTickScaled;
                prevNoteSecondsEnd[envelopeIndex] = prevNoteSecondsStart[envelopeIndex] ? prevNoteSecondsStart[envelopeIndex] + secondsPerTickScaled : secondsPerTickScaled;
                beatTimeStart[envelopeIndex] = tickTimeStart[envelopeIndex] ? beatsPerTick * tickTimeStart[envelopeIndex] : beatsPerTick;
                beatTimeEnd[envelopeIndex] = tickTimeEnd[envelopeIndex] ? beatsPerTick * tickTimeEnd[envelopeIndex] : beatsPerTick;

                if (envelope.type == EnvelopeType.noteSize) usedNoteSize = true;
            }
            //only calculate pitch if needed
            const pitch: number = (envelope.type == EnvelopeType.pitch) ? this.computePitchEnvelope(instrument, envelopeIndex, (this.startPinTickPitch || this.getPitchValue(instrument, tone, instrumentState, true))) : 0;

            //calculate envelope values if target isn't null or part of the other envelope computer's job
            if (automationTarget.computeIndex != null && automationTarget.perNote == perNote) {
                const computeIndex: number = automationTarget.computeIndex + targetIndex;
                let envelopeStart: number = EnvelopeComputer.computeEnvelope(envelope, envelopeSpeed, globalEnvelopeSpeed, noteSecondsStartUnscaled, noteSecondsStart[envelopeIndex], beatTimeStart[envelopeIndex], timeSinceStart, noteSizeStart, pitch, inverse, perEnvelopeLowerBound, perEnvelopeUpperBound, false, steps, seed, waveform, defaultPitch, startPinTickAbsolute, sequence);
                if (prevSlideStart) {
                    const other: number = EnvelopeComputer.computeEnvelope(envelope, envelopeSpeed, globalEnvelopeSpeed, prevNoteSecondsStartUnscaled, prevNoteSecondsStart[envelopeIndex], beatTimeStart[envelopeIndex], timeSinceStart, prevNoteSize, pitch, inverse, perEnvelopeLowerBound, perEnvelopeUpperBound, false, steps, seed, waveform, defaultPitch, startPinTickAbsolute, sequence);
                    envelopeStart += (other - envelopeStart) * prevSlideRatioStart;
                }
                if (nextSlideStart) {
                    const other: number = EnvelopeComputer.computeEnvelope(envelope, envelopeSpeed, globalEnvelopeSpeed, 0.0, 0.0, beatTimeStart[envelopeIndex], timeSinceStart, nextNoteSize, pitch, inverse, perEnvelopeLowerBound, perEnvelopeUpperBound, false, steps, seed, waveform, defaultPitch, startPinTickAbsolute, sequence);
                    envelopeStart += (other - envelopeStart) * nextSlideRatioStart;
                }
                let envelopeEnd: number = envelopeStart;
                if (isDiscrete == false) {
                    envelopeEnd = EnvelopeComputer.computeEnvelope(envelope, envelopeSpeed, globalEnvelopeSpeed, noteSecondsEndUnscaled, noteSecondsEnd[envelopeIndex], beatTimeEnd[envelopeIndex], timeSinceStart, noteSizeEnd, pitch, inverse, perEnvelopeLowerBound, perEnvelopeUpperBound, false, steps, seed, waveform, defaultPitch, startPinTickAbsolute, sequence);
                    if (prevSlideEnd) {
                        const other: number = EnvelopeComputer.computeEnvelope(envelope, envelopeSpeed, globalEnvelopeSpeed, prevNoteSecondsEndUnscaled, prevNoteSecondsEnd[envelopeIndex], beatTimeEnd[envelopeIndex], timeSinceStart, prevNoteSize, pitch, inverse, perEnvelopeLowerBound, perEnvelopeUpperBound, false, steps, seed, waveform, defaultPitch, startPinTickAbsolute, sequence);
                        envelopeEnd += (other - envelopeEnd) * prevSlideRatioEnd;
                    }
                    if (nextSlideEnd) {
                        const other: number = EnvelopeComputer.computeEnvelope(envelope, envelopeSpeed, globalEnvelopeSpeed, 0.0, 0.0, beatTimeEnd[envelopeIndex], timeSinceStart, nextNoteSize, pitch, inverse, perEnvelopeLowerBound, perEnvelopeUpperBound, false, steps, seed, waveform, defaultPitch, startPinTickAbsolute, sequence);
                        envelopeEnd += (other - envelopeEnd) * nextSlideRatioEnd;
                    }
                }

                this.envelopeStarts[computeIndex] *= envelopeStart;
                this.envelopeEnds[computeIndex] *= envelopeEnd;
                this._modifiedEnvelopeIndices[this._modifiedEnvelopeCount++] = computeIndex;

                if (automationTarget.isFilter) {
                    const filterSettings: FilterSettings = /*this._perNote ?*/ (instrument.tmpNoteFilterStart != null) ? instrument.tmpNoteFilterStart : instrument.noteFilter /*: instrument.eqFilter*/;
                    if (filterSettings.controlPointCount > targetIndex && filterSettings.controlPoints[targetIndex].type == FilterType.lowPass) {
                        lowpassCutoffDecayVolumeCompensation = Math.max(lowpassCutoffDecayVolumeCompensation, EnvelopeComputer.getLowpassCutoffDecayVolumeCompensation(envelope, perEnvelopeSpeed));
                    }
                }
            }
        }

        this.noteSecondsStartUnscaled = noteSecondsStartUnscaled;
        this.noteSecondsEndUnscaled = noteSecondsEndUnscaled;
        this.noteTicksStart = noteTicksStart;
        this.noteTicksEnd = noteTicksEnd;
        this.prevNoteSecondsStartUnscaled = prevNoteSecondsStartUnscaled;
        this.prevNoteSecondsEndUnscaled = prevNoteSecondsEndUnscaled;
        this.prevNoteTicksStart = prevNoteTicksStart;
        this.prevNoteTicksEnd = prevNoteTicksEnd;
        for (let envelopeIndex: number = 0; envelopeIndex < Config.maxEnvelopeCount + 1; envelopeIndex++) {
            this.noteSecondsStart[envelopeIndex] = noteSecondsStart[envelopeIndex];
            this.noteSecondsEnd[envelopeIndex] = noteSecondsEnd[envelopeIndex];
            this.prevNoteSecondsStart[envelopeIndex] = prevNoteSecondsStart[envelopeIndex];
            this.prevNoteSecondsEnd[envelopeIndex] = prevNoteSecondsEnd[envelopeIndex];
        }
        this.prevNoteSize = prevNoteSize;
        this.nextNoteSize = nextNoteSize;
        this.noteSizeStart = noteSizeStart;
        this.noteSizeEnd = noteSizeEnd;
        this.prevSlideStart = prevSlideStart;
        this.prevSlideEnd = prevSlideEnd;
        this.nextSlideStart = nextSlideStart;
        this.nextSlideEnd = nextSlideEnd;
        this.prevSlideRatioStart = prevSlideRatioStart;
        this.prevSlideRatioEnd = prevSlideRatioEnd;
        this.nextSlideRatioStart = nextSlideRatioStart;
        this.nextSlideRatioEnd = nextSlideRatioEnd;
        this.lowpassCutoffDecayVolumeCompensation = lowpassCutoffDecayVolumeCompensation;
    }

    public clearEnvelopes(): void {
        for (let envelopeIndex: number = 0; envelopeIndex < this._modifiedEnvelopeCount; envelopeIndex++) {
            const computeIndex: number = this._modifiedEnvelopeIndices[envelopeIndex];
            this.envelopeStarts[computeIndex] = 1.0;
            this.envelopeEnds[computeIndex] = 1.0;
        }
        this._modifiedEnvelopeCount = 0;
    }

    public static computeEnvelope(envelope: Envelope, perEnvelopeSpeed: number, globalEnvelopeSpeed: number, unspedTime: number, time: number, beats: number, timeSinceStart: number, noteSize: number, pitch: number, inverse: boolean, perEnvelopeLowerBound: number, perEnvelopeUpperBound: number, isDrumset: boolean = false, steps: number, seed: number, waveform: number, defaultPitch: number, notePinStart: number, sequence: SequenceSettings | null): number {
        const envelopeSpeed = isDrumset ? envelope.speed : 1;
        const boundAdjust = (perEnvelopeUpperBound - perEnvelopeLowerBound);
        switch (envelope.type) {
            case EnvelopeType.none: return perEnvelopeUpperBound;
            case EnvelopeType.noteSize:
                if (!inverse) {
                    return SynthProcessor.noteSizeToVolumeMult(noteSize) * (boundAdjust) + perEnvelopeLowerBound;
                } else {
                    return perEnvelopeUpperBound - SynthProcessor.noteSizeToVolumeMult(noteSize) * (boundAdjust);
                }
            case EnvelopeType.pitch:
                //inversion and bounds are handled in the pitch calculation that we did prior
                return pitch;
            case EnvelopeType.pseudorandom:
                //randomization is essentially just a complex hashing function which appears random to us, but is repeatable every time
                //we can use either the time passed from the beginning of our song or the pitch of the note for what we hash
                const hashMax: number = 0xffffffff;
                const step: number = steps;
                let unitarraybuffer: Uint8Array = new Uint8Array(1)
                switch (waveform) {
                    case RandomEnvelopeTypes.time:
                        if (step <= 1) return 1;
                        unitarraybuffer[0] = (perEnvelopeSpeed == 0 ? 0 : Math.floor((timeSinceStart * perEnvelopeSpeed) / (256)));
                        const timeHash: number = xxHash32(unitarraybuffer, seed);
                        if (inverse) {
                            return perEnvelopeUpperBound - boundAdjust * (step / (step - 1)) * Math.floor(timeHash * step / (hashMax + 1)) / step;
                        } else {
                            return boundAdjust * (step / (step - 1)) * Math.floor(timeHash * (step) / (hashMax + 1)) / step + perEnvelopeLowerBound;
                        }
                    case RandomEnvelopeTypes.pitch:
                        unitarraybuffer[0] = defaultPitch;
                        const pitchHash: number = xxHash32(unitarraybuffer, seed);
                        if (inverse) {
                            return perEnvelopeUpperBound - boundAdjust * pitchHash / (hashMax + 1);
                        } else {
                            return boundAdjust * pitchHash / (hashMax + 1) + perEnvelopeLowerBound;
                        }
                    case RandomEnvelopeTypes.note:
                        if (step <= 1) return 1;
                        unitarraybuffer[0] = notePinStart
                        const noteHash: number = xxHash32(unitarraybuffer, seed);
                        if (inverse) {
                            return perEnvelopeUpperBound - boundAdjust * (step / (step - 1)) * Math.floor(noteHash * step / (hashMax + 1)) / step;
                        } else {
                            return boundAdjust * (step / (step - 1)) * Math.floor(noteHash * (step) / (hashMax + 1)) / step + perEnvelopeLowerBound;
                        }
                    case RandomEnvelopeTypes.timeSmooth:
                        unitarraybuffer[0] = (perEnvelopeSpeed == 0 ? 0 : Math.floor((timeSinceStart * perEnvelopeSpeed) / (256)));
                        const timeHashA: number = xxHash32(unitarraybuffer, seed);
                        unitarraybuffer[0] = (perEnvelopeSpeed == 0 ? 0 : Math.floor((timeSinceStart * perEnvelopeSpeed + 256) / (256)));
                        const timeHashB: number = xxHash32(unitarraybuffer, seed);
                        const weightedAverage: number = timeHashA * (1 - ((timeSinceStart * perEnvelopeSpeed) / (256)) % 1) + timeHashB * (((timeSinceStart * perEnvelopeSpeed) / (256)) % 1);
                        if (inverse) {
                            return perEnvelopeUpperBound - boundAdjust * weightedAverage / (hashMax + 1);
                        } else {
                            return boundAdjust * weightedAverage / (hashMax + 1) + perEnvelopeLowerBound;
                        }
                    default: throw new Error("Unrecognized operator envelope waveform type: " + waveform);
                }
            case EnvelopeType.twang:
                if (inverse) {
                    return perEnvelopeUpperBound - boundAdjust * (1.0 / (1.0 + time * envelopeSpeed));
                } else {
                    return boundAdjust / (1.0 + time * envelopeSpeed) + perEnvelopeLowerBound;
                }
            case EnvelopeType.swell:
                if (inverse) {
                    return boundAdjust / (1.0 + time * envelopeSpeed) + perEnvelopeLowerBound; //swell is twang's inverse... I wonder if it would be worth it to just merge the two :/
                } else {
                    return perEnvelopeUpperBound - boundAdjust / (1.0 + time * envelopeSpeed);
                }
            case EnvelopeType.lfo:
                switch (waveform) {
                    case LFOEnvelopeTypes.sine:
                        if (inverse) {
                            return (perEnvelopeUpperBound / 2) + boundAdjust * Math.cos(beats * 2.0 * Math.PI * envelopeSpeed) * 0.5 + (perEnvelopeLowerBound / 2);
                        } else {
                            return (perEnvelopeUpperBound / 2) - boundAdjust * Math.cos(beats * 2.0 * Math.PI * envelopeSpeed) * 0.5 + (perEnvelopeLowerBound / 2);
                        }
                    case LFOEnvelopeTypes.square:
                        if (inverse) {
                            return (Math.cos(beats * 2.0 * Math.PI * envelopeSpeed + 3 * Math.PI / 2) < 0) ? perEnvelopeUpperBound : perEnvelopeLowerBound;
                        } else {
                            return (Math.cos(beats * 2.0 * Math.PI * envelopeSpeed + 3 * Math.PI / 2) < 0) ? perEnvelopeLowerBound : perEnvelopeUpperBound;
                        }
                    case LFOEnvelopeTypes.triangle:
                        if (inverse) {
                            return (perEnvelopeUpperBound / 2) - (boundAdjust / Math.PI) * Math.asin(Math.sin((Math.PI / 2) + beats * Math.PI * 2.0 * envelopeSpeed)) + (perEnvelopeLowerBound / 2);
                        } else {
                            return (perEnvelopeUpperBound / 2) + (boundAdjust / Math.PI) * Math.asin(Math.sin((Math.PI / 2) + beats * Math.PI * 2.0 * envelopeSpeed)) + (perEnvelopeLowerBound / 2);
                        }
                    case LFOEnvelopeTypes.sawtooth:
                        if (inverse) {
                            return perEnvelopeUpperBound - (beats * envelopeSpeed) % 1 * boundAdjust;
                        } else {
                            return (beats * envelopeSpeed) % 1 * boundAdjust + perEnvelopeLowerBound;
                        }
                    case LFOEnvelopeTypes.trapezoid:
                        let trap: number = 0;
                        if (inverse) {
                            trap = (perEnvelopeUpperBound / 2) - (boundAdjust * 2 / Math.PI) * Math.asin(Math.sin((Math.PI / 2) + beats * Math.PI * 2.0 * envelopeSpeed)) + (perEnvelopeLowerBound / 2);
                        } else {
                            trap = (perEnvelopeUpperBound / 2) + (boundAdjust * 2 / Math.PI) * Math.asin(Math.sin((Math.PI / 2) + beats * Math.PI * 2.0 * envelopeSpeed)) + (perEnvelopeLowerBound / 2);
                        }
                        return Math.max(perEnvelopeLowerBound, Math.min(perEnvelopeUpperBound, trap));
                    case LFOEnvelopeTypes.steppedSaw:
                        if (steps <= 1) return 1;
                        let saw: number = (beats * envelopeSpeed) % 1;
                        if (inverse) {
                            return perEnvelopeUpperBound - Math.floor(saw * steps) * boundAdjust / (steps - 1);
                        } else {
                            return Math.floor(saw * steps) * boundAdjust / (steps - 1) + perEnvelopeLowerBound;
                        }

                    case LFOEnvelopeTypes.steppedTri:
                        if (steps <= 1) return 1;
                        let tri: number = 0.5 + (inverse ? -1 : 1) * (1 / Math.PI) * Math.asin(Math.sin((Math.PI / 2) + beats * Math.PI * 2.0 * envelopeSpeed));
                        return Math.round(tri * (steps - 1)) * boundAdjust / (steps - 1) + perEnvelopeLowerBound;
                    default: throw new Error("Unrecognized operator envelope waveform type: " + waveform);
                }
            case EnvelopeType.tremolo2: //kept only for drumsets right now
                if (inverse) {
                    return (perEnvelopeUpperBound / 4) + boundAdjust * Math.cos(beats * 2.0 * Math.PI * envelopeSpeed) * 0.25 + (perEnvelopeLowerBound / 4); //inverse works strangely with tremolo2. If I ever update this I'll need to turn all current versions into tremolo with bounds
                } else {
                    return 0.5 + (perEnvelopeUpperBound / 4) - boundAdjust * Math.cos(beats * 2.0 * Math.PI * envelopeSpeed) * 0.25 - (perEnvelopeLowerBound / 4);
                }
            case EnvelopeType.punch:
                if (inverse) {
                    return Math.max(0, perEnvelopeUpperBound + 1.0 - Math.max(1.0 - perEnvelopeLowerBound, 1.0 - perEnvelopeUpperBound - unspedTime * globalEnvelopeSpeed * 10.0)); //punch special case: 2- instead of 1-
                } else {
                    return Math.max(1.0 + perEnvelopeLowerBound, 1.0 + perEnvelopeUpperBound - unspedTime * globalEnvelopeSpeed * 10.0); //punch only uses global envelope speed
                }
            case EnvelopeType.flare:
                const attack: number = 0.25 / Math.sqrt(envelopeSpeed * perEnvelopeSpeed); //flare and blip need to be handled a little differently with envelope speeds. I have to use the old system
                if (inverse) {
                    return perEnvelopeUpperBound - boundAdjust * (unspedTime < attack ? unspedTime / attack : 1.0 / (1.0 + (unspedTime - attack) * envelopeSpeed * perEnvelopeSpeed));
                } else {
                    return boundAdjust * (unspedTime < attack ? unspedTime / attack : 1.0 / (1.0 + (unspedTime - attack) * envelopeSpeed * perEnvelopeSpeed)) + perEnvelopeLowerBound;
                }
            case EnvelopeType.decay:
                if (inverse) {
                    return perEnvelopeUpperBound - boundAdjust * Math.pow(2, -envelopeSpeed * time);
                } else {
                    return boundAdjust * Math.pow(2, -envelopeSpeed * time) + perEnvelopeLowerBound;
                }
            case EnvelopeType.blip:
                if (inverse) {
                    return perEnvelopeUpperBound - boundAdjust * +(unspedTime < (0.25 / Math.sqrt(envelopeSpeed * perEnvelopeSpeed)));
                } else {
                    return boundAdjust * +(unspedTime < (0.25 / Math.sqrt(envelopeSpeed * perEnvelopeSpeed))) + perEnvelopeLowerBound;
                }
            case EnvelopeType.wibble:
                let temp = 0.5 - Math.cos(beats * envelopeSpeed) * 0.5;
                temp = 1.0 / (1.0 + time * (envelopeSpeed - (temp / (1.5 / envelopeSpeed))));
                temp = temp > 0.0 ? temp : 0.0;
                if (inverse) {
                    return perEnvelopeUpperBound - boundAdjust * temp;
                } else {
                    return boundAdjust * temp + perEnvelopeLowerBound;
                }
            case EnvelopeType.linear: {
                let lin = (1.0 - (time / (16 / envelopeSpeed)));
                lin = lin > 0.0 ? lin : 0.0;
                if (inverse) { //another case where linear's inverse is rise. Do I merge them?
                    return perEnvelopeUpperBound - boundAdjust * lin;
                } else {
                    return boundAdjust * lin + perEnvelopeLowerBound;
                }
            }
            case EnvelopeType.rise: {
                let lin = (time / (16 / envelopeSpeed));
                lin = lin < 1.0 ? lin : 1.0;
                if (inverse) {
                    return perEnvelopeUpperBound - boundAdjust * lin;
                } else {
                    return boundAdjust * lin + perEnvelopeLowerBound;
                }
            }
            case EnvelopeType.fall: {
                if (inverse) {
                    return Math.min(Math.max(perEnvelopeLowerBound, perEnvelopeUpperBound - boundAdjust * Math.sqrt(Math.max(1.0 - envelopeSpeed * time / 2, 0))), perEnvelopeUpperBound);
                } else {
                    return Math.max(perEnvelopeLowerBound, boundAdjust * Math.sqrt(Math.max(1.0 - envelopeSpeed * time / 2, 0)) + perEnvelopeLowerBound);
                }
            }
            case EnvelopeType.sequence: {
                if (sequence == null) return 0;
                const value: number = sequence.values[Math.floor(envelopeSpeed * beats) % sequence.length] / sequence.height;
                if (inverse) {
                    return perEnvelopeUpperBound - boundAdjust * value;
                } else {
                    return boundAdjust * value + perEnvelopeLowerBound;
                }
            }
            default: throw new Error("Unrecognized operator envelope type.");
        }

    }

    public getPitchValue(instrument: Instrument, tone: Tone | null, instrumentState: InstrumentState, calculateBends: boolean = true): number {
        if (tone && tone.pitchCount >= 1) {
            const chord = instrument.getChord();
            const arpeggiates = chord.arpeggiates;
            const monophonic = chord.name == "monophonic"
            const arpeggio: number = Math.floor(instrumentState.arpTime / Config.ticksPerArpeggio); //calculate arpeggiation
            const tonePitch = tone.pitches[arpeggiates ? getArpeggioPitchIndex(tone.pitchCount, instrument.fastTwoNoteArp, arpeggio) : monophonic ? instrument.monoChordTone : 0]
            if (calculateBends) {
                return tone.lastInterval != tonePitch ? tonePitch + tone.lastInterval : tonePitch; //account for pitch bends
            } else {
                return tonePitch;
            }
        }
        return 0;
    }

    public computePitchEnvelope(instrument: Instrument, index: number, pitch: number = 0): number {
        let startNote: number = 0;
        let endNote: number = Config.maxPitch;
        let inverse: boolean = false;
        let envelopeLowerBound: number = 0;
        let envelopeUpperBound: number = 1;

        if (instrument.isNoiseInstrument) {
            endNote = Config.drumCount - 1;
        }


        if (index < instrument.envelopeCount && index !== -2) {
            startNote = instrument.envelopes[index].pitchEnvelopeStart;
            endNote = instrument.envelopes[index].pitchEnvelopeEnd;
            inverse = instrument.envelopes[index].inverse;
            envelopeLowerBound = instrument.envelopes[index].perEnvelopeLowerBound;
            envelopeUpperBound = instrument.envelopes[index].perEnvelopeUpperBound;
        }

        if (startNote > endNote) { //Reset if values are improper
            startNote = 0;
            endNote = instrument.isNoiseInstrument ? Config.drumCount - 1 : Config.maxPitch;
        }
        const range = endNote - startNote + 1; //TODO: fix range
        if (!inverse) {
            if (pitch <= startNote) {
                return envelopeLowerBound;
            } else if (pitch >= endNote) {
                return envelopeUpperBound;
            } else {
                return (pitch - startNote) * (envelopeUpperBound - envelopeLowerBound) / range + envelopeLowerBound;
            }
        } else {
            if (pitch <= startNote) {
                return envelopeUpperBound;
            } else if (pitch >= endNote) {
                return envelopeLowerBound;
            } else {
                return envelopeUpperBound - (pitch - startNote) * (envelopeUpperBound - envelopeLowerBound) / range;
            }
        }
    }

    public static getLowpassCutoffDecayVolumeCompensation(envelope: Envelope, perEnvelopeSpeed: number = 1): number {
        // This is a little hokey in the details, but I designed it a while ago and keep it 
        // around for compatibility. This decides how much to increase the volume (or
        // expression) to compensate for a decaying lowpass cutoff to maintain perceived
        // volume overall.
        if (envelope.type == EnvelopeType.decay) return 1.25 + 0.025 * /*envelope.speed */ perEnvelopeSpeed;
        if (envelope.type == EnvelopeType.twang) return 1.0 + 0.02 * /*envelope.speed */ perEnvelopeSpeed;
        return 1.0;
    }

    public computeDrumsetEnvelopes(instrument: Instrument, drumsetFilterEnvelope: Envelope, beatsPerPart: number, partTimeStart: number, partTimeEnd: number) {

        const pitch = 1

        function computeDrumsetEnvelope(unspedTime: number, time: number, beats: number, noteSize: number): number {
            return EnvelopeComputer.computeEnvelope(drumsetFilterEnvelope, 1, 1, unspedTime, time, beats, 0, noteSize, pitch, false, 0, 1, true, 2, 2, LFOEnvelopeTypes.sine, pitch, 0, null);
        }

        // Drumset filters use the same envelope timing as the rest of the envelopes, but do not include support for slide transitions.
        let drumsetFilterEnvelopeStart: number = computeDrumsetEnvelope(this.noteSecondsStartUnscaled, this.noteSecondsStartUnscaled, beatsPerPart * partTimeStart, this.noteSizeStart); //doesn't have/need pitchStart, pitchEnd, pitchInvert, steps, seed, timeSinceBeginning, etc

        // Apply slide interpolation to drumset envelope.
        if (this.prevSlideStart) {
            const other: number = computeDrumsetEnvelope(this.prevNoteSecondsStartUnscaled, this.prevNoteSecondsStartUnscaled, beatsPerPart * partTimeStart, this.prevNoteSize);
            drumsetFilterEnvelopeStart += (other - drumsetFilterEnvelopeStart) * this.prevSlideRatioStart;
        }
        if (this.nextSlideStart) {
            const other: number = computeDrumsetEnvelope(0.0, 0.0, beatsPerPart * partTimeStart, this.nextNoteSize);
            drumsetFilterEnvelopeStart += (other - drumsetFilterEnvelopeStart) * this.nextSlideRatioStart;
        }

        let drumsetFilterEnvelopeEnd: number = drumsetFilterEnvelopeStart;


        //hmm, I guess making discrete per envelope leaves out drumsets....
        drumsetFilterEnvelopeEnd = computeDrumsetEnvelope(this.noteSecondsEndUnscaled, this.noteSecondsEndUnscaled, beatsPerPart * partTimeEnd, this.noteSizeEnd);

        if (this.prevSlideEnd) {
            const other: number = computeDrumsetEnvelope(this.prevNoteSecondsEndUnscaled, this.prevNoteSecondsEndUnscaled, beatsPerPart * partTimeEnd, this.prevNoteSize);
            drumsetFilterEnvelopeEnd += (other - drumsetFilterEnvelopeEnd) * this.prevSlideRatioEnd;
        }
        if (this.nextSlideEnd) {
            const other: number = computeDrumsetEnvelope(0.0, 0.0, beatsPerPart * partTimeEnd, this.nextNoteSize);
            drumsetFilterEnvelopeEnd += (other - drumsetFilterEnvelopeEnd) * this.nextSlideRatioEnd;
        }

        this.drumsetFilterEnvelopeStart = drumsetFilterEnvelopeStart;
        this.drumsetFilterEnvelopeEnd = drumsetFilterEnvelopeEnd;

    }

}

class Tone {
    public instrumentIndex: number;
    public pitches: number[] = Array(Config.maxChordSize + 2).fill(0);
    public pitchCount: number = 0;
    public chordSize: number = 0;
    public drumsetPitch: number | null = null;
    public note: Note | null = null;
    public prevNote: Note | null = null;
    public nextNote: Note | null = null;
    public prevNotePitchIndex: number = 0;
    public nextNotePitchIndex: number = 0;
    public freshlyAllocated: boolean = true;
    public atNoteStart: boolean = false;
    public isOnLastTick: boolean = false; // Whether the tone is finished fading out and ready to be freed.
    public passedEndOfNote: boolean = false;
    public forceContinueAtStart: boolean = false;
    public forceContinueAtEnd: boolean = false;
    public noteStartPart: number = 0;
    public noteEndPart: number = 0;
    public ticksSinceReleased: number = 0;
    public liveInputSamplesHeld: number = 0;
    public lastInterval: number = 0;
    public stringSustainStart: number = 0;
    public stringSustainEnd: number = 0;
    public readonly noiseSamples: number[] = [];
    public readonly phases: number[] = [];
    public readonly operatorWaves: OperatorWave[] = [];
    public readonly phaseDeltas: number[] = [];
    public directions: number[] = [];
    public chipWaveCompletions: number[] = [];
    public chipWavePrevWaves: number[] = [];
    public chipWaveCompletionsLastWave: number[] = [];
    public readonly phaseDeltaScales: number[] = [];
    public expression: number = 0.0;
    public expressionDelta: number = 0.0;
    public readonly operatorExpressions: number[] = [];
    public readonly operatorExpressionDeltas: number[] = [];
    public readonly prevPitchExpressions: Array<number | null> = Array(Config.maxPitchOrOperatorCount).fill(null);
    public prevVibrato: number | null = null;
    public prevStringDecay: number | null = null;
    public pulseWidth: number = 0.0;
    public pulseWidthDelta: number = 0.0;
    public decimalOffset: number = 0.0;
    public supersawDynamism: number = 0.0;
    public supersawDynamismDelta: number = 0.0;
    public supersawUnisonDetunes: number[] = []; // These can change over time, but slowly enough that I'm not including corresponding delta values within a tick run.
    public supersawShape: number = 0.0;
    public supersawShapeDelta: number = 0.0;
    public supersawDelayLength: number = 0.0;
    public supersawDelayLengthDelta: number = 0.0;
    public supersawDelayLine: Float32Array | null = null;
    public supersawDelayIndex: number = -1;
    public supersawPrevPhaseDelta: number | null = null;
    public unisonHasUpdated: boolean = false;
    public readonly pickedStrings: PickedString[] = [];

    public readonly noteFilters: DynamicBiquadFilter[] = [];
    public noteFilterCount: number = 0;
    public initialNoteFilterInput1: number = 0.0;
    public initialNoteFilterInput2: number = 0.0;

    public specialIntervalExpressionMult: number = 1.0;
    public readonly feedbackOutputs: number[] = [];
    public feedbackMult: number = 0.0;
    public feedbackDelta: number = 0.0;
    public stereoVolumeLStart: number = 0.0;
    public stereoVolumeRStart: number = 0.0;
    public stereoVolumeLDelta: number = 0.0;
    public stereoVolumeRDelta: number = 0.0;
    public stereoDelayStart: number = 0.0;
    public stereoDelayEnd: number = 0.0;
    public stereoDelayDelta: number = 0.0;
    public customVolumeStart: number = 0.0;
    public customVolumeEnd: number = 0.0;
    public filterResonanceStart: number = 0.0;
    public filterResonanceDelta: number = 0.0;
    public isFirstOrder: boolean = false;

    public readonly envelopeComputer: EnvelopeComputer = new EnvelopeComputer(/*true*/);

    constructor() {
        this.reset();
    }

    public reset(): void {
        // this.noiseSample = 0.0;
        for (let i: number = 0; i < Config.unisonVoicesMax; i++) {
            this.noiseSamples[i] = 0.0;
        }
        for (let i: number = 0; i < Config.maxPitchOrOperatorCount * Config.unisonVoicesMax; i++) {
            this.phases[i] = 0.0;
            this.directions[i] = 1;
            this.chipWaveCompletions[i] = 0;
            this.chipWavePrevWaves[i] = 0;
            this.chipWaveCompletionsLastWave[i] = 0;
            this.operatorWaves[i] = Config.operatorWaves[0];
            this.feedbackOutputs[i] = 0.0;
            this.prevPitchExpressions[i] = null;
        }
        for (let i: number = 0; i < this.noteFilterCount; i++) {
            this.noteFilters[i].resetOutput();
        }
        this.noteFilterCount = 0;
        this.initialNoteFilterInput1 = 0.0;
        this.initialNoteFilterInput2 = 0.0;
        this.liveInputSamplesHeld = 0;
        this.supersawDelayIndex = -1;
        this.unisonHasUpdated = false;
        for (const pickedString of this.pickedStrings) {
            pickedString.reset();
        }
        this.envelopeComputer.reset();
        this.prevVibrato = null;
        this.prevStringDecay = null;
        this.supersawPrevPhaseDelta = null;
        this.drumsetPitch = null;
    }
}

class InstrumentState {
    public awake: boolean = false; // Whether the instrument's effects-processing loop should continue.
    public computed: boolean = false; // Whether the effects-processing parameters are up-to-date for the current synth run.
    public tonesAddedInThisTick: boolean = false; // Whether any instrument tones are currently active.
    public flushingDelayLines: boolean = false; // If no tones were active recently, enter a mode where the delay lines are filled with zeros to reset them for later use.
    public deactivateAfterThisTick: boolean = false; // Whether the instrument is ready to be deactivated because the delay lines, if any, are fully zeroed.
    public attentuationProgress: number = 0.0; // How long since an active tone introduced an input signal to the delay lines, normalized from 0 to 1 based on how long to wait until the delay lines signal will have audibly dissapated.
    public flushedSamples: number = 0; // How many delay line samples have been flushed to zero.
    public readonly activeTones: Deque<Tone> = new Deque<Tone>();
    public readonly activeModTones: Deque<Tone> = new Deque<Tone>();
    public readonly releasedTones: Deque<Tone> = new Deque<Tone>(); // Tones that are in the process of fading out after the corresponding notes ended.
    public readonly liveInputTones: Deque<Tone> = new Deque<Tone>(); // Tones that are initiated by a source external to the loaded song data.

    public type: InstrumentType = InstrumentType.chip;
    public synthesizer: Function | null = null;
    public wave: Float32Array | null = null;
    public isUsingAdvancedLoopControls = false;
    public chipWaveLoopStart = 0;
    public chipWaveLoopEnd = 0;
    public chipWaveLoopMode = 0;
    public chipWavePlayBackwards = false;
    public chipWaveStartOffset = 0;
    public noisePitchFilterMult: number = 1.0;
    public unison: Unison | null = null;
    public unisonVoices: number = 1;
    public unisonSpread: number = 0.0;
    public unisonOffset: number = 0.0;
    public unisonExpression: number = 1.4;
    public unisonSign: number = 1.0;
    public unisonAntiPhased: boolean = false;
    public unisonBuzzes: boolean = false;
    public unisonInitialized: boolean = true;
    public chord: Chord | null = null;
    public effects: number = 0;

    public volumeScale: number = 0;
    public aliases: boolean = false;
    public arpTime: number = 0;
    public arpEnvelopeStart: number = 1;
    public strumEnvelopeStart: number = 1;
    public slideEnvelopeStart: number = 1;
    public vibratoTime: number = 0;
    public nextVibratoTime: number = 0;
    public vibratoEnvelopeStart: number = 1;
    public envelopeTime: number[] = [];

    public eqFilterVolume: number = 1.0;
    public eqFilterVolumeDelta: number = 0.0;
    public mixVolume: number = 1.0;
    public mixVolumeDelta: number = 0.0;
    public delayInputMult: number = 0.0;
    public delayInputMultDelta: number = 0.0;

    public granularMix: number = 1.0;
    public granularMixDelta: number = 0.0;
    public granularDelayLine: Float32Array | null = null;
    public granularDelayLineIndex: number = 0;
    public granularMaximumDelayTimeInSeconds: number = 1;
    public granularGrains: Grain[];
    public granularGrainsLength: number;
    public granularMaximumGrains: number;
    public usesRandomGrainLocation: boolean = true; //eventually I might use the granular code for sample pitch shifting, but we'll see
    public granularDelayLineDirty: boolean = false;
    public computeGrains: boolean = true;

    public ringModMix: number = 0;
    public ringModMixDelta: number = 0;
    public ringModPhase: number = 0;
    public ringModPhaseDelta: number = 0;
    public ringModPhaseDeltaScale: number = 1.0;
    public ringModWaveformIndex: number = 0.0;
    public ringModPulseWidth: number = 0.0;
    public ringModHzOffset: number = 0.0;
    public ringModMixFade: number = 1.0;
    public ringModMixFadeDelta: number = 0;

    public distortion: number = 0.0;
    public distortionDelta: number = 0.0;
    public distortionDrive: number = 0.0;
    public distortionDriveDelta: number = 0.0;
    public distortionFractionalInput1: number = 0.0;
    public distortionFractionalInput2: number = 0.0;
    public distortionFractionalInput3: number = 0.0;
    public distortionPrevInput: number = 0.0;
    public distortionNextOutput: number = 0.0;

    public bitcrusherPrevInput: number = 0.0;
    public bitcrusherCurrentOutput: number = 0.0;
    public bitcrusherPhase: number = 1.0;
    public bitcrusherPhaseDelta: number = 0.0;
    public bitcrusherPhaseDeltaScale: number = 1.0;
    public bitcrusherScale: number = 1.0;
    public bitcrusherScaleScale: number = 1.0;
    public bitcrusherFoldLevel: number = 1.0;
    public bitcrusherFoldLevelScale: number = 1.0;

    public readonly eqFilters: DynamicBiquadFilter[] = [];
    public eqFilterCount: number = 0;
    public initialEqFilterInput1: number = 0.0;
    public initialEqFilterInput2: number = 0.0;

    public panningDelayLine: Float32Array | null = null;
    public panningDelayPos: number = 0;
    public panningVolumeL: number = 0.0;
    public panningVolumeR: number = 0.0;
    public panningVolumeDeltaL: number = 0.0;
    public panningVolumeDeltaR: number = 0.0;
    public panningOffsetL: number = 0.0;
    public panningOffsetR: number = 0.0;
    public panningOffsetDeltaL: number = 0.0;
    public panningOffsetDeltaR: number = 0.0;

    public chorusDelayLineL: Float32Array | null = null;
    public chorusDelayLineR: Float32Array | null = null;
    public chorusDelayLineDirty: boolean = false;
    public chorusDelayPos: number = 0;
    public chorusPhase: number = 0;
    public chorusVoiceMult: number = 0;
    public chorusVoiceMultDelta: number = 0;
    public chorusCombinedMult: number = 0;
    public chorusCombinedMultDelta: number = 0;

    public echoDelayLineL: Float32Array | null = null;
    public echoDelayLineR: Float32Array | null = null;
    public echoDelayLineDirty: boolean = false;
    public echoDelayPos: number = 0;
    public echoDelayOffsetStart: number = 0;
    public echoDelayOffsetEnd: number | null = null;
    public echoDelayOffsetRatio: number = 0.0;
    public echoDelayOffsetRatioDelta: number = 0.0;
    public echoMult: number = 0.0;
    public echoMultDelta: number = 0.0;
    public echoShelfA1: number = 0.0;
    public echoShelfB0: number = 0.0;
    public echoShelfB1: number = 0.0;
    public echoShelfSampleL: number = 0.0;
    public echoShelfSampleR: number = 0.0;
    public echoShelfPrevInputL: number = 0.0;
    public echoShelfPrevInputR: number = 0.0;

    public reverbDelayLine: Float32Array | null = null;
    public reverbDelayLineDirty: boolean = false;
    public reverbDelayPos: number = 0;
    public reverbMult: number = 0.0;
    public reverbMultDelta: number = 0.0;
    public reverbShelfA1: number = 0.0;
    public reverbShelfB0: number = 0.0;
    public reverbShelfB1: number = 0.0;
    public reverbShelfSample0: number = 0.0;
    public reverbShelfSample1: number = 0.0;
    public reverbShelfSample2: number = 0.0;
    public reverbShelfSample3: number = 0.0;
    public reverbShelfPrevInput0: number = 0.0;
    public reverbShelfPrevInput1: number = 0.0;
    public reverbShelfPrevInput2: number = 0.0;
    public reverbShelfPrevInput3: number = 0.0;

    public pluginValues: number[] = [];
    public pluginDelayLine: Float32Array | null = null;
    public pluginDelayLineSize: number = SynthProcessor.PluginDelayLineSize;
    public pluginDelayLineDirty: boolean = false

    public readonly spectrumWave: SpectrumWaveState = new SpectrumWaveState();
    public readonly harmonicsWave: HarmonicsWaveState = new HarmonicsWaveState();
    public readonly drumsetSpectrumWaves: SpectrumWaveState[] = [];

    constructor() {
        for (let i: number = 0; i < Config.drumCount; i++) {
            this.drumsetSpectrumWaves[i] = new SpectrumWaveState();
        }
        // Allocate all grains to be used ahead of time.
        // granularGrainsLength is what indicates how many grains actually "exist".
        this.granularGrains = [];
        this.granularMaximumGrains = 256;
        for (let i: number = 0; i < this.granularMaximumGrains; i++) {
            this.granularGrains.push(new Grain());
        }
        this.granularGrainsLength = 0;
    }

    public readonly envelopeComputer: EnvelopeComputer = new EnvelopeComputer();

    public allocateNecessaryBuffers(synth: SynthProcessor, instrument: Instrument, samplesPerTick: number): void {
        if (effectsIncludePanning(instrument.effects)) {
            if (this.panningDelayLine == null || this.panningDelayLine.length < synth.panningDelayBufferSize) {
                this.panningDelayLine = new Float32Array(synth.panningDelayBufferSize);
            }
        }
        if (effectsIncludeChorus(instrument.effects)) {
            if (this.chorusDelayLineL == null || this.chorusDelayLineL.length < synth.chorusDelayBufferSize) {
                this.chorusDelayLineL = new Float32Array(synth.chorusDelayBufferSize);
            }
            if (this.chorusDelayLineR == null || this.chorusDelayLineR.length < synth.chorusDelayBufferSize) {
                this.chorusDelayLineR = new Float32Array(synth.chorusDelayBufferSize);
            }
        }
        if (effectsIncludeEcho(instrument.effects)) {
            this.allocateEchoBuffers(samplesPerTick, instrument.echoDelay);
        }
        if (effectsIncludeReverb(instrument.effects)) {
            // TODO: Make reverb delay line sample rate agnostic. Maybe just double buffer size for 96KHz? Adjust attenuation and shelf cutoff appropriately?
            if (this.reverbDelayLine == null) {
                this.reverbDelayLine = new Float32Array(Config.reverbDelayBufferSize);
            }
        }
        if (effectsIncludeGranular(instrument.effects)) {
            const granularDelayLineSizeInMilliseconds: number = 2500;
            const granularDelayLineSizeInSeconds: number = granularDelayLineSizeInMilliseconds / 1000; // Maximum possible delay time
            this.granularMaximumDelayTimeInSeconds = granularDelayLineSizeInSeconds;
            const granularDelayLineSizeInSamples: number = SynthProcessor.fittingPowerOfTwo(Math.floor(granularDelayLineSizeInSeconds * synth.samplesPerSecond));
            if (this.granularDelayLine == null || this.granularDelayLine.length != granularDelayLineSizeInSamples) {
                this.granularDelayLine = new Float32Array(granularDelayLineSizeInSamples);
                this.granularDelayLineIndex = 0;
            }
            const oldGrainsLength: number = this.granularGrains.length;
            if (this.granularMaximumGrains > oldGrainsLength) { //increase grain amount if it changes
                for (let i: number = oldGrainsLength; i < this.granularMaximumGrains + 1; i++) {
                    this.granularGrains.push(new Grain());
                }
            }
            if (this.granularMaximumGrains < this.granularGrainsLength) {
                this.granularGrainsLength = Math.round(this.granularMaximumGrains);
            }
        }
        if (effectsIncludePlugin(instrument.effects)) {
            //figure out plugin delay line
            if (this.pluginDelayLine == null || this.pluginDelayLine.length < this.pluginDelayLineSize) {
                this.pluginDelayLine = new Float32Array(this.pluginDelayLineSize);
            }
        }
    }

    public allocateEchoBuffers(samplesPerTick: number, echoDelay: number) {
        // account for tempo and delay automation changing delay length during a tick?
        const safeEchoDelaySteps: number = Math.max(Config.echoDelayRange >> 1, (echoDelay + 1)); // The delay may be very short now, but if it increases later make sure we have enough sample history.
        const baseEchoDelayBufferSize: number = SynthProcessor.fittingPowerOfTwo(safeEchoDelaySteps * Config.echoDelayStepTicks * samplesPerTick);
        const safeEchoDelayBufferSize: number = baseEchoDelayBufferSize * 2; // If the tempo or delay changes and we suddenly need a longer delay, make sure that we have enough sample history to accomodate the longer delay.

        if (this.echoDelayLineL == null || this.echoDelayLineR == null) {
            this.echoDelayLineL = new Float32Array(safeEchoDelayBufferSize);
            this.echoDelayLineR = new Float32Array(safeEchoDelayBufferSize);
        } else if (this.echoDelayLineL.length < safeEchoDelayBufferSize || this.echoDelayLineR.length < safeEchoDelayBufferSize) {
            // The echo delay length may change while the song is playing if tempo changes,
            // so buffers may need to be reallocated, but we don't want to lose any echoes
            // so we need to copy the contents of the old buffer to the new one.
            const newDelayLineL: Float32Array = new Float32Array(safeEchoDelayBufferSize);
            const newDelayLineR: Float32Array = new Float32Array(safeEchoDelayBufferSize);
            const oldMask: number = this.echoDelayLineL.length - 1;

            for (let i = 0; i < this.echoDelayLineL.length; i++) {
                newDelayLineL[i] = this.echoDelayLineL[(this.echoDelayPos + i) & oldMask];
                newDelayLineR[i] = this.echoDelayLineL[(this.echoDelayPos + i) & oldMask];
            }

            this.echoDelayPos = this.echoDelayLineL.length;
            this.echoDelayLineL = newDelayLineL;
            this.echoDelayLineR = newDelayLineR;
        }
    }

    public deactivate(): void {
        this.bitcrusherPrevInput = 0.0;
        this.bitcrusherCurrentOutput = 0.0;
        this.bitcrusherPhase = 1.0;
        for (let i: number = 0; i < this.eqFilterCount; i++) {
            this.eqFilters[i].resetOutput();
        }
        this.eqFilterCount = 0;
        this.initialEqFilterInput1 = 0.0;
        this.initialEqFilterInput2 = 0.0;
        this.distortionFractionalInput1 = 0.0;
        this.distortionFractionalInput2 = 0.0;
        this.distortionFractionalInput3 = 0.0;
        this.distortionPrevInput = 0.0;
        this.distortionNextOutput = 0.0;
        this.panningDelayPos = 0;
        if (this.panningDelayLine != null) for (let i: number = 0; i < this.panningDelayLine.length; i++) this.panningDelayLine[i] = 0.0;
        this.echoDelayOffsetEnd = null;
        this.echoShelfSampleL = 0.0;
        this.echoShelfSampleR = 0.0;
        this.echoShelfPrevInputL = 0.0;
        this.echoShelfPrevInputR = 0.0;
        this.reverbShelfSample0 = 0.0;
        this.reverbShelfSample1 = 0.0;
        this.reverbShelfSample2 = 0.0;
        this.reverbShelfSample3 = 0.0;
        this.reverbShelfPrevInput0 = 0.0;
        this.reverbShelfPrevInput1 = 0.0;
        this.reverbShelfPrevInput2 = 0.0;
        this.reverbShelfPrevInput3 = 0.0;

        this.volumeScale = 1.0;
        this.aliases = false;

        this.awake = false;
        this.flushingDelayLines = false;
        this.deactivateAfterThisTick = false;
        this.attentuationProgress = 0.0;
        this.flushedSamples = 0;
    }

    public resetAllEffects(): void {
        this.deactivate();
        // LFOs are reset here rather than in deactivate() for periodic oscillation that stays "on the beat". Resetting in deactivate() will cause it to reset with each note.
        this.vibratoTime = 0;
        this.nextVibratoTime = 0;
        this.vibratoEnvelopeStart = 1;
        this.arpTime = 0;
        this.arpEnvelopeStart = 1;
        this.strumEnvelopeStart = 1;
        this.slideEnvelopeStart = 1;
        for (let envelopeIndex: number = 0; envelopeIndex < Config.maxEnvelopeCount + 1; envelopeIndex++) this.envelopeTime[envelopeIndex] = 0;
        this.envelopeComputer.reset();

        if (this.chorusDelayLineDirty) {
            for (let i: number = 0; i < this.chorusDelayLineL!.length; i++) this.chorusDelayLineL![i] = 0.0;
            for (let i: number = 0; i < this.chorusDelayLineR!.length; i++) this.chorusDelayLineR![i] = 0.0;
        }
        if (this.echoDelayLineDirty) {
            for (let i: number = 0; i < this.echoDelayLineL!.length; i++) this.echoDelayLineL![i] = 0.0;
            for (let i: number = 0; i < this.echoDelayLineR!.length; i++) this.echoDelayLineR![i] = 0.0;
        }
        if (this.reverbDelayLineDirty) {
            for (let i: number = 0; i < this.reverbDelayLine!.length; i++) this.reverbDelayLine![i] = 0.0;
        }
        if (this.granularDelayLineDirty) {
            for (let i: number = 0; i < this.granularDelayLine!.length; i++) this.granularDelayLine![i] = 0.0;
        }
        if (this.pluginDelayLineDirty) {
            for (let i: number = 0; i < this.pluginDelayLine!.length; i++) this.pluginDelayLine![i] = 0.0;
        }

        this.chorusPhase = 0.0;
        this.ringModPhase = 0.0;
        this.ringModMixFade = 1.0;
    }

    public compute(synth: SynthProcessor, instrument: Instrument, samplesPerTick: number, roundedSamplesPerTick: number, tone: Tone | null, channelIndex: number, instrumentIndex: number): void {
        this.computed = true;

        this.type = instrument.type;
        this.synthesizer = SynthProcessor.getInstrumentSynthFunction(instrument);
        this.unison = Config.unisons[instrument.unison];
        this.unisonVoices = instrument.unisonVoices;
        this.unisonBuzzes = instrument.unisonBuzzes;
        this.chord = instrument.getChord();
        this.noisePitchFilterMult = Config.chipNoises[instrument.chipNoise].pitchFilterMult;
        this.effects = instrument.effects;

        this.aliases = instrument.aliases;
        this.volumeScale = 1.0;

        const samplesPerSecond: number = synth.samplesPerSecond;
        this.updateWaves(instrument, samplesPerSecond);

        const ticksIntoBar: number = synth.getTicksIntoBar();
        const tickTimeStart: number = ticksIntoBar;
        const secondsPerTick: number = samplesPerTick / synth.samplesPerSecond;
        const currentPart: number = synth.getCurrentPart();

        /* slarmoo -- 

            There are two(ish) envelopeComputers:
            One in the instrumentState, and one in each tone.
            The instrumentState one handles all sound-based effects, 
            whereas the tone envelopeComputers handle all of the instrument settings and behavior-effects

        */

        //handle instrumentState envelopeComputer
        const envelopeSpeeds: number[] = [];
        for (let i: number = 0; i < Config.maxEnvelopeCount; i++) {
            envelopeSpeeds[i] = 0;
        }
        let useEnvelopeSpeed: number = Config.arpSpeedScale[instrument.envelopeSpeed];
        if (synth.isModActive(Config.modulators.dictionary["envelope speed"].index, channelIndex, instrumentIndex)) {
            useEnvelopeSpeed = Math.max(0, Math.min(Config.arpSpeedScale.length - 1, synth.getModValue(Config.modulators.dictionary["envelope speed"].index, channelIndex, instrumentIndex, false)));
            if (Number.isInteger(useEnvelopeSpeed)) {
                useEnvelopeSpeed = Config.arpSpeedScale[useEnvelopeSpeed];
            } else {
                // Linear interpolate envelope values
                useEnvelopeSpeed = ((1 - (useEnvelopeSpeed % 1)) * Config.arpSpeedScale[Math.floor(useEnvelopeSpeed)] + (useEnvelopeSpeed % 1) * Config.arpSpeedScale[Math.ceil(useEnvelopeSpeed)]);
            }
        }
        for (let envelopeIndex: number = 0; envelopeIndex < instrument.envelopeCount; envelopeIndex++) {
            let perEnvelopeSpeed: number = instrument.envelopes[envelopeIndex].perEnvelopeSpeed;
            if (synth.isModActive(Config.modulators.dictionary["individual envelope speed"].index, channelIndex, instrumentIndex) && instrument.envelopes[envelopeIndex].tempEnvelopeSpeed != null) {
                perEnvelopeSpeed = instrument.envelopes[envelopeIndex].tempEnvelopeSpeed!;
            }
            envelopeSpeeds[envelopeIndex] = useEnvelopeSpeed * perEnvelopeSpeed;
        }
        this.envelopeComputer.computeEnvelopes(instrument, currentPart, this.envelopeTime, tickTimeStart, secondsPerTick, tone, envelopeSpeeds, this, synth, channelIndex, instrumentIndex, false);
        const envelopeStarts: number[] = this.envelopeComputer.envelopeStarts;
        const envelopeEnds: number[] = this.envelopeComputer.envelopeEnds;

        const usesGranular: boolean = effectsIncludeGranular(this.effects);
        const usesRingModulation: boolean = effectsIncludeRingModulation(this.effects);
        const usesDistortion: boolean = effectsIncludeDistortion(this.effects);
        const usesBitcrusher: boolean = effectsIncludeBitcrusher(this.effects);
        const usesPanning: boolean = effectsIncludePanning(this.effects);
        const usesChorus: boolean = effectsIncludeChorus(this.effects);
        const usesEcho: boolean = effectsIncludeEcho(this.effects);
        const usesReverb: boolean = effectsIncludeReverb(this.effects);
        const usesPlugin: boolean = effectsIncludePlugin(this.effects);
        const usesVibrato: boolean = effectsIncludeVibrato(this.effects);
        const usesArp: boolean = effectsIncludeChord(this.effects) && instrument.getChord().arpeggiates;
        const usesStrum: boolean = effectsIncludeChord(this.effects) && instrument.getChord().strumParts > 0;
        const usesSlide: boolean = effectsIncludeTransition(this.effects) && instrument.getTransition().slides;

        let granularChance: number = 0;
        if (usesGranular) { //has to happen before buffer allocation
            granularChance = (instrument.grainFreq + 1);
            this.granularMaximumGrains = instrument.grainFreq;
            if (synth.isModActive(Config.modulators.dictionary["grain freq"].index, channelIndex, instrumentIndex)) {
                this.granularMaximumGrains = synth.getModValue(Config.modulators.dictionary["grain freq"].index, channelIndex, instrumentIndex, false);
                granularChance = (synth.getModValue(Config.modulators.dictionary["grain freq"].index, channelIndex, instrumentIndex, false) + 1);
            }
            this.granularMaximumGrains = Math.floor(Math.pow(2, this.granularMaximumGrains * envelopeStarts[EnvelopeComputeIndex.grainAmount]));
            granularChance = granularChance * envelopeStarts[EnvelopeComputeIndex.grainAmount];
        }

        this.allocateNecessaryBuffers(synth, instrument, samplesPerTick);


        if (usesGranular) {
            this.granularMix = instrument.granular / Config.granularRange;
            this.computeGrains = true;
            let granularMixEnd = this.granularMix;
            if (synth.isModActive(Config.modulators.dictionary["granular"].index, channelIndex, instrumentIndex)) {
                this.granularMix = synth.getModValue(Config.modulators.dictionary["granular"].index, channelIndex, instrumentIndex, false) / Config.granularRange;
                granularMixEnd = synth.getModValue(Config.modulators.dictionary["granular"].index, channelIndex, instrumentIndex, true) / Config.granularRange;
            }
            this.granularMix *= envelopeStarts[EnvelopeComputeIndex.granular];
            granularMixEnd *= envelopeEnds[EnvelopeComputeIndex.granular];
            this.granularMixDelta = (granularMixEnd - this.granularMix) / roundedSamplesPerTick;
            for (let iterations: number = 0; iterations < Math.ceil(Math.random() * Math.random() * 10); iterations++) { //dirty weighting toward lower numbers
                //create a grain
                if (this.granularGrainsLength < this.granularMaximumGrains && Math.random() <= granularChance) { //only create a grain if there's room and based on grainFreq
                    let granularMinGrainSizeInMilliseconds: number = instrument.grainSize;
                    if (synth.isModActive(Config.modulators.dictionary["grain size"].index, channelIndex, instrumentIndex)) {
                        granularMinGrainSizeInMilliseconds = synth.getModValue(Config.modulators.dictionary["grain size"].index, channelIndex, instrumentIndex, false);
                    }
                    granularMinGrainSizeInMilliseconds *= envelopeStarts[EnvelopeComputeIndex.grainSize];
                    let grainRange = instrument.grainRange;
                    if (synth.isModActive(Config.modulators.dictionary["grain range"].index, channelIndex, instrumentIndex)) {
                        grainRange = synth.getModValue(Config.modulators.dictionary["grain range"].index, channelIndex, instrumentIndex, false);
                    }
                    grainRange *= envelopeStarts[EnvelopeComputeIndex.grainRange];
                    const granularMaxGrainSizeInMilliseconds: number = granularMinGrainSizeInMilliseconds + grainRange;
                    const granularGrainSizeInMilliseconds: number = granularMinGrainSizeInMilliseconds + (granularMaxGrainSizeInMilliseconds - granularMinGrainSizeInMilliseconds) * Math.random();
                    const granularGrainSizeInSeconds: number = granularGrainSizeInMilliseconds / 1000.0;
                    const granularGrainSizeInSamples: number = Math.floor(granularGrainSizeInSeconds * samplesPerSecond);
                    const granularDelayLineLength: number = this.granularDelayLine!.length;
                    const grainIndex: number = this.granularGrainsLength;

                    this.granularGrainsLength++;
                    const grain: Grain = this.granularGrains[grainIndex];
                    grain.ageInSamples = 0;
                    grain.maxAgeInSamples = granularGrainSizeInSamples;
                    // const minDelayTimeInMilliseconds: number = 2;
                    // const minDelayTimeInSeconds: number = minDelayTimeInMilliseconds / 1000.0;
                    const minDelayTimeInSeconds: number = 0.02;
                    // const maxDelayTimeInSeconds: number = this.granularMaximumDelayTimeInSeconds;
                    const maxDelayTimeInSeconds: number = 2.4;
                    grain.delayLinePosition = this.usesRandomGrainLocation ? (minDelayTimeInSeconds + (maxDelayTimeInSeconds - minDelayTimeInSeconds) * Math.random() * Math.random() * samplesPerSecond) % (granularDelayLineLength - 1) : minDelayTimeInSeconds; //dirty weighting toward lower numbers ; The clamp was clumping everything at the end, so I decided to use a modulo instead
                    if (Config.granularEnvelopeType == GranularEnvelopeType.parabolic) {
                        grain.initializeParabolicEnvelope(grain.maxAgeInSamples, 1.0);
                    } else if (Config.granularEnvelopeType == GranularEnvelopeType.raisedCosineBell) {
                        grain.initializeRCBEnvelope(grain.maxAgeInSamples, 1.0);
                    }
                    // if (this.usesRandomGrainLocation) {
                    grain.addDelay(Math.random() * samplesPerTick * 4); //offset when grains begin playing ; This is different from the above delay, which delays how far back in time the grain looks for samples
                    // }
                }
            }
        }

        if (usesVibrato) {
            this.vibratoEnvelopeStart = envelopeStarts[EnvelopeComputeIndex.vibratoSpeed];
        }

        if (usesArp) {
            this.arpEnvelopeStart = envelopeStarts[EnvelopeComputeIndex.arpeggioSpeed];
        }

        if (usesStrum) {
            this.strumEnvelopeStart = envelopeStarts[EnvelopeComputeIndex.strumSpeed];
        }

        if (usesSlide) {
            this.slideEnvelopeStart = envelopeStarts[EnvelopeComputeIndex.slideSpeed];
        }

        if (usesDistortion) {
            let useDistortionStart: number = instrument.distortion;
            let useDistortionEnd: number = instrument.distortion;

            // Check for distortion mods
            if (synth.isModActive(Config.modulators.dictionary["distortion"].index, channelIndex, instrumentIndex)) {
                useDistortionStart = synth.getModValue(Config.modulators.dictionary["distortion"].index, channelIndex, instrumentIndex, false);
                useDistortionEnd = synth.getModValue(Config.modulators.dictionary["distortion"].index, channelIndex, instrumentIndex, true);
            }

            const distortionSliderStart = Math.min(1.0, envelopeStarts[EnvelopeComputeIndex.distortion] * useDistortionStart / (Config.distortionRange - 1));
            const distortionSliderEnd = Math.min(1.0, envelopeEnds[EnvelopeComputeIndex.distortion] * useDistortionEnd / (Config.distortionRange - 1));
            const distortionStart: number = Math.pow(1.0 - 0.895 * (Math.pow(20.0, distortionSliderStart) - 1.0) / 19.0, 2.0);
            const distortionEnd: number = Math.pow(1.0 - 0.895 * (Math.pow(20.0, distortionSliderEnd) - 1.0) / 19.0, 2.0);
            const distortionDriveStart: number = (1.0 + 2.0 * distortionSliderStart) / Config.distortionBaseVolume;
            const distortionDriveEnd: number = (1.0 + 2.0 * distortionSliderEnd) / Config.distortionBaseVolume;
            this.distortion = distortionStart;
            this.distortionDelta = (distortionEnd - distortionStart) / roundedSamplesPerTick;
            this.distortionDrive = distortionDriveStart;
            this.distortionDriveDelta = (distortionDriveEnd - distortionDriveStart) / roundedSamplesPerTick;
        }

        if (usesBitcrusher) {
            let freqSettingStart: number = instrument.bitcrusherFreq * Math.sqrt(envelopeStarts[EnvelopeComputeIndex.bitcrusherFrequency]);
            let freqSettingEnd: number = instrument.bitcrusherFreq * Math.sqrt(envelopeEnds[EnvelopeComputeIndex.bitcrusherFrequency]);

            // Check for freq crush mods
            if (synth.isModActive(Config.modulators.dictionary["freq crush"].index, channelIndex, instrumentIndex)) {
                freqSettingStart = synth.getModValue(Config.modulators.dictionary["freq crush"].index, channelIndex, instrumentIndex, false) * Math.sqrt(envelopeStarts[EnvelopeComputeIndex.bitcrusherFrequency]);
                freqSettingEnd = synth.getModValue(Config.modulators.dictionary["freq crush"].index, channelIndex, instrumentIndex, true) * Math.sqrt(envelopeEnds[EnvelopeComputeIndex.bitcrusherFrequency]);
            }

            let quantizationSettingStart: number = instrument.bitcrusherQuantization * Math.sqrt(envelopeStarts[EnvelopeComputeIndex.bitcrusherQuantization]);
            let quantizationSettingEnd: number = instrument.bitcrusherQuantization * Math.sqrt(envelopeEnds[EnvelopeComputeIndex.bitcrusherQuantization]);

            // Check for bitcrush mods
            if (synth.isModActive(Config.modulators.dictionary["bit crush"].index, channelIndex, instrumentIndex)) {
                quantizationSettingStart = synth.getModValue(Config.modulators.dictionary["bit crush"].index, channelIndex, instrumentIndex, false) * Math.sqrt(envelopeStarts[EnvelopeComputeIndex.bitcrusherQuantization]);
                quantizationSettingEnd = synth.getModValue(Config.modulators.dictionary["bit crush"].index, channelIndex, instrumentIndex, true) * Math.sqrt(envelopeEnds[EnvelopeComputeIndex.bitcrusherQuantization]);
            }

            const basePitch: number = Config.keys[synth.song!.key].basePitch + (Config.pitchesPerOctave * synth.song!.octave); // TODO: What if there's a key change mid-song?
            const freqStart: number = Instrument.frequencyFromPitch(basePitch + 60) * Math.pow(2.0, (Config.bitcrusherFreqRange - 1 - freqSettingStart) * Config.bitcrusherOctaveStep);
            const freqEnd: number = Instrument.frequencyFromPitch(basePitch + 60) * Math.pow(2.0, (Config.bitcrusherFreqRange - 1 - freqSettingEnd) * Config.bitcrusherOctaveStep);
            const phaseDeltaStart: number = Math.min(1.0, freqStart / samplesPerSecond);
            const phaseDeltaEnd: number = Math.min(1.0, freqEnd / samplesPerSecond);
            this.bitcrusherPhaseDelta = phaseDeltaStart;
            this.bitcrusherPhaseDeltaScale = Math.pow(phaseDeltaEnd / phaseDeltaStart, 1.0 / roundedSamplesPerTick);

            const scaleStart: number = 2.0 * Config.bitcrusherBaseVolume * Math.pow(2.0, 1.0 - Math.pow(2.0, (Config.bitcrusherQuantizationRange - 1 - quantizationSettingStart) * 0.5));
            const scaleEnd: number = 2.0 * Config.bitcrusherBaseVolume * Math.pow(2.0, 1.0 - Math.pow(2.0, (Config.bitcrusherQuantizationRange - 1 - quantizationSettingEnd) * 0.5));
            this.bitcrusherScale = scaleStart;
            this.bitcrusherScaleScale = Math.pow(scaleEnd / scaleStart, 1.0 / roundedSamplesPerTick);

            const foldLevelStart: number = 2.0 * Config.bitcrusherBaseVolume * Math.pow(1.5, Config.bitcrusherQuantizationRange - 1 - quantizationSettingStart);
            const foldLevelEnd: number = 2.0 * Config.bitcrusherBaseVolume * Math.pow(1.5, Config.bitcrusherQuantizationRange - 1 - quantizationSettingEnd);
            this.bitcrusherFoldLevel = foldLevelStart;
            this.bitcrusherFoldLevelScale = Math.pow(foldLevelEnd / foldLevelStart, 1.0 / roundedSamplesPerTick);
        }

        let eqFilterVolume: number = 1.0; //this.envelopeComputer.lowpassCutoffDecayVolumeCompensation;
        if (instrument.eqFilterType) {
            // Simple EQ filter (old style). For analysis, using random filters from normal style since they are N/A in this context.
            const eqFilterSettingsStart: FilterSettings = instrument.eqFilter;
            if (instrument.eqSubFilters[1] == null)
                instrument.eqSubFilters[1] = new FilterSettings();
            const eqFilterSettingsEnd: FilterSettings = instrument.eqSubFilters[1];

            // Change location based on slider values
            let startSimpleFreq: number = instrument.eqFilterSimpleCut;
            let startSimpleGain: number = instrument.eqFilterSimplePeak;
            let endSimpleFreq: number = instrument.eqFilterSimpleCut;
            let endSimpleGain: number = instrument.eqFilterSimplePeak;

            let filterChanges: boolean = false;

            if (synth.isModActive(Config.modulators.dictionary["eq filt cut"].index, channelIndex, instrumentIndex)) {
                startSimpleFreq = synth.getModValue(Config.modulators.dictionary["eq filt cut"].index, channelIndex, instrumentIndex, false);
                endSimpleFreq = synth.getModValue(Config.modulators.dictionary["eq filt cut"].index, channelIndex, instrumentIndex, true);
                filterChanges = true;
            }
            if (synth.isModActive(Config.modulators.dictionary["eq filt peak"].index, channelIndex, instrumentIndex)) {
                startSimpleGain = synth.getModValue(Config.modulators.dictionary["eq filt peak"].index, channelIndex, instrumentIndex, false);
                endSimpleGain = synth.getModValue(Config.modulators.dictionary["eq filt peak"].index, channelIndex, instrumentIndex, true);
                filterChanges = true;
            }

            let startPoint: FilterControlPoint;

            if (filterChanges) {
                eqFilterSettingsStart.convertLegacySettingsForSynth(startSimpleFreq, startSimpleGain);
                eqFilterSettingsEnd.convertLegacySettingsForSynth(endSimpleFreq, endSimpleGain);

                startPoint = eqFilterSettingsStart.controlPoints[0];
                let endPoint: FilterControlPoint = eqFilterSettingsEnd.controlPoints[0];

                startPoint.toCoefficients(SynthProcessor.tempFilterStartCoefficients, samplesPerSecond, 1.0, 1.0);
                endPoint.toCoefficients(SynthProcessor.tempFilterEndCoefficients, samplesPerSecond, 1.0, 1.0);

                if (this.eqFilters.length < 1) this.eqFilters[0] = new DynamicBiquadFilter();
                this.eqFilters[0].loadCoefficientsWithGradient(SynthProcessor.tempFilterStartCoefficients, SynthProcessor.tempFilterEndCoefficients, 1.0 / roundedSamplesPerTick, startPoint.type == FilterType.lowPass);

            } else {
                eqFilterSettingsStart.convertLegacySettingsForSynth(startSimpleFreq, startSimpleGain, true);

                startPoint = eqFilterSettingsStart.controlPoints[0];

                startPoint.toCoefficients(SynthProcessor.tempFilterStartCoefficients, samplesPerSecond, 1.0, 1.0);

                if (this.eqFilters.length < 1) this.eqFilters[0] = new DynamicBiquadFilter();
                this.eqFilters[0].loadCoefficientsWithGradient(SynthProcessor.tempFilterStartCoefficients, SynthProcessor.tempFilterStartCoefficients, 1.0 / roundedSamplesPerTick, startPoint.type == FilterType.lowPass);

            }

            eqFilterVolume *= startPoint.getVolumeCompensationMult();

            this.eqFilterCount = 1;
            eqFilterVolume = Math.min(3.0, eqFilterVolume);
        }
        else {
            const eqFilterSettings: FilterSettings = (instrument.tmpEqFilterStart != null) ? instrument.tmpEqFilterStart : instrument.eqFilter;
            //const eqAllFreqsEnvelopeStart: number = envelopeStarts[InstrumentAutomationIndex.eqFilterAllFreqs];
            //const eqAllFreqsEnvelopeEnd:   number = envelopeEnds[  InstrumentAutomationIndex.eqFilterAllFreqs];
            for (let i: number = 0; i < eqFilterSettings.controlPointCount; i++) {
                //const eqFreqEnvelopeStart: number = envelopeStarts[InstrumentAutomationIndex.eqFilterFreq0 + i];
                //const eqFreqEnvelopeEnd:   number = envelopeEnds[  InstrumentAutomationIndex.eqFilterFreq0 + i];
                //const eqPeakEnvelopeStart: number = envelopeStarts[InstrumentAutomationIndex.eqFilterGain0 + i];
                //const eqPeakEnvelopeEnd:   number = envelopeEnds[  InstrumentAutomationIndex.eqFilterGain0 + i];
                let startPoint: FilterControlPoint = eqFilterSettings.controlPoints[i];
                let endPoint: FilterControlPoint = (instrument.tmpEqFilterEnd != null && instrument.tmpEqFilterEnd.controlPoints[i] != null) ? instrument.tmpEqFilterEnd.controlPoints[i] : eqFilterSettings.controlPoints[i];

                // If switching dot type, do it all at once and do not try to interpolate since no valid interpolation exists.
                if (startPoint.type != endPoint.type) {
                    startPoint = endPoint;
                }

                startPoint.toCoefficients(SynthProcessor.tempFilterStartCoefficients, samplesPerSecond, /*eqAllFreqsEnvelopeStart * eqFreqEnvelopeStart*/ 1.0, /*eqPeakEnvelopeStart*/ 1.0);
                endPoint.toCoefficients(SynthProcessor.tempFilterEndCoefficients, samplesPerSecond, /*eqAllFreqsEnvelopeEnd   * eqFreqEnvelopeEnd*/   1.0, /*eqPeakEnvelopeEnd*/   1.0);
                if (this.eqFilters.length <= i) this.eqFilters[i] = new DynamicBiquadFilter();
                this.eqFilters[i].loadCoefficientsWithGradient(SynthProcessor.tempFilterStartCoefficients, SynthProcessor.tempFilterEndCoefficients, 1.0 / roundedSamplesPerTick, startPoint.type == FilterType.lowPass);
                eqFilterVolume *= startPoint.getVolumeCompensationMult();

            }
            this.eqFilterCount = eqFilterSettings.controlPointCount;
            eqFilterVolume = Math.min(3.0, eqFilterVolume);
        }

        const mainInstrumentVolume: number = SynthProcessor.instrumentVolumeToVolumeMult(instrument.volume);
        this.mixVolume = mainInstrumentVolume /** envelopeStarts[InstrumentAutomationIndex.mixVolume]*/;
        let mixVolumeEnd: number = mainInstrumentVolume /** envelopeEnds[  InstrumentAutomationIndex.mixVolume]*/;

        // Check for mod-related volume delta
        if (synth.isModActive(Config.modulators.dictionary["mix volume"].index, channelIndex, instrumentIndex)) {
            // Linear falloff below 0, normal volume formula above 0. Seems to work best for scaling since the normal volume mult formula has a big gap from -25 to -24.
            const startVal: number = synth.getModValue(Config.modulators.dictionary["mix volume"].index, channelIndex, instrumentIndex, false);
            const endVal: number = synth.getModValue(Config.modulators.dictionary["mix volume"].index, channelIndex, instrumentIndex, true)
            this.mixVolume *= ((startVal <= 0) ? ((startVal + Config.volumeRange / 2) / (Config.volumeRange / 2)) : SynthProcessor.instrumentVolumeToVolumeMult(startVal));
            mixVolumeEnd *= ((endVal <= 0) ? ((endVal + Config.volumeRange / 2) / (Config.volumeRange / 2)) : SynthProcessor.instrumentVolumeToVolumeMult(endVal));
        }

        // Check for SONG mod-related volume delta
        if (synth.isModActive(Config.modulators.dictionary["song volume"].index)) {
            this.mixVolume *= (synth.getModValue(Config.modulators.dictionary["song volume"].index, undefined, undefined, false)) / 100.0;
            mixVolumeEnd *= (synth.getModValue(Config.modulators.dictionary["song volume"].index, undefined, undefined, true)) / 100.0;
        }

        this.mixVolumeDelta = (mixVolumeEnd - this.mixVolume) / roundedSamplesPerTick;

        let eqFilterVolumeStart: number = eqFilterVolume;
        let eqFilterVolumeEnd: number = eqFilterVolume;
        let delayInputMultStart: number = 1.0;
        let delayInputMultEnd: number = 1.0;

        if (usesPanning) {
            const panEnvelopeStart: number = envelopeStarts[EnvelopeComputeIndex.panning] * 2.0 - 1.0;
            const panEnvelopeEnd: number = envelopeEnds[EnvelopeComputeIndex.panning] * 2.0 - 1.0;

            let usePanStart: number = instrument.pan;
            let usePanEnd: number = instrument.pan;
            // Check for pan mods
            if (synth.isModActive(Config.modulators.dictionary["pan"].index, channelIndex, instrumentIndex)) {
                usePanStart = synth.getModValue(Config.modulators.dictionary["pan"].index, channelIndex, instrumentIndex, false);
                usePanEnd = synth.getModValue(Config.modulators.dictionary["pan"].index, channelIndex, instrumentIndex, true);
            }

            let panStart: number = Math.max(-1.0, Math.min(1.0, (usePanStart - Config.panCenter) / Config.panCenter * panEnvelopeStart));
            let panEnd: number = Math.max(-1.0, Math.min(1.0, (usePanEnd - Config.panCenter) / Config.panCenter * panEnvelopeEnd));

            const volumeStartL: number = Math.cos((1 + panStart) * Math.PI * 0.25) * 1.414;
            const volumeStartR: number = Math.cos((1 - panStart) * Math.PI * 0.25) * 1.414;
            const volumeEndL: number = Math.cos((1 + panEnd) * Math.PI * 0.25) * 1.414;
            const volumeEndR: number = Math.cos((1 - panEnd) * Math.PI * 0.25) * 1.414;
            const maxDelaySamples: number = samplesPerSecond * Config.panDelaySecondsMax;

            let usePanDelayStart: number = instrument.panDelay;
            let usePanDelayEnd: number = instrument.panDelay;
            // Check for pan delay mods
            if (synth.isModActive(Config.modulators.dictionary["pan delay"].index, channelIndex, instrumentIndex)) {
                usePanDelayStart = synth.getModValue(Config.modulators.dictionary["pan delay"].index, channelIndex, instrumentIndex, false);
                usePanDelayEnd = synth.getModValue(Config.modulators.dictionary["pan delay"].index, channelIndex, instrumentIndex, true);
            }

            const delayStart: number = panStart * usePanDelayStart * maxDelaySamples / 10;
            const delayEnd: number = panEnd * usePanDelayEnd * maxDelaySamples / 10;
            const delayStartL: number = Math.max(0.0, delayStart);
            const delayStartR: number = Math.max(0.0, -delayStart);
            const delayEndL: number = Math.max(0.0, delayEnd);
            const delayEndR: number = Math.max(0.0, -delayEnd);

            this.panningVolumeL = volumeStartL;
            this.panningVolumeR = volumeStartR;
            this.panningVolumeDeltaL = (volumeEndL - volumeStartL) / roundedSamplesPerTick;
            this.panningVolumeDeltaR = (volumeEndR - volumeStartR) / roundedSamplesPerTick;
            this.panningOffsetL = this.panningDelayPos - delayStartL + synth.panningDelayBufferSize;
            this.panningOffsetR = this.panningDelayPos - delayStartR + synth.panningDelayBufferSize;
            this.panningOffsetDeltaL = (delayEndL - delayStartL) / roundedSamplesPerTick;
            this.panningOffsetDeltaR = (delayEndR - delayStartR) / roundedSamplesPerTick;
        }

        if (usesChorus) {
            const chorusEnvelopeStart: number = envelopeStarts[EnvelopeComputeIndex.chorus];
            const chorusEnvelopeEnd: number = envelopeEnds[EnvelopeComputeIndex.chorus];
            let useChorusStart: number = instrument.chorus;
            let useChorusEnd: number = instrument.chorus;
            // Check for chorus mods
            if (synth.isModActive(Config.modulators.dictionary["chorus"].index, channelIndex, instrumentIndex)) {
                useChorusStart = synth.getModValue(Config.modulators.dictionary["chorus"].index, channelIndex, instrumentIndex, false);
                useChorusEnd = synth.getModValue(Config.modulators.dictionary["chorus"].index, channelIndex, instrumentIndex, true);
            }

            let chorusStart: number = Math.min(1.0, chorusEnvelopeStart * useChorusStart / (Config.chorusRange - 1));
            let chorusEnd: number = Math.min(1.0, chorusEnvelopeEnd * useChorusEnd / (Config.chorusRange - 1));
            chorusStart = chorusStart * 0.6 + (Math.pow(chorusStart, 6.0)) * 0.4;
            chorusEnd = chorusEnd * 0.6 + (Math.pow(chorusEnd, 6.0)) * 0.4;
            const chorusCombinedMultStart = 1.0 / Math.sqrt(3.0 * chorusStart * chorusStart + 1.0);
            const chorusCombinedMultEnd = 1.0 / Math.sqrt(3.0 * chorusEnd * chorusEnd + 1.0);
            this.chorusVoiceMult = chorusStart;
            this.chorusVoiceMultDelta = (chorusEnd - chorusStart) / roundedSamplesPerTick;
            this.chorusCombinedMult = chorusCombinedMultStart;
            this.chorusCombinedMultDelta = (chorusCombinedMultEnd - chorusCombinedMultStart) / roundedSamplesPerTick;
        }

        if (usesRingModulation) {
            let useRingModStart: number = instrument.ringModulation;
            let useRingModEnd: number = instrument.ringModulation;

            let useRingModEnvelopeStart: number = envelopeStarts[EnvelopeComputeIndex.ringModulation];
            let useRingModEnvelopeEnd: number = envelopeEnds[EnvelopeComputeIndex.ringModulation];

            let useRingModHzStart: number = Math.min(1.0, instrument.ringModulationHz / (Config.ringModHzRange - 1));
            let useRingModHzEnd: number = Math.min(1.0, instrument.ringModulationHz / (Config.ringModHzRange - 1));
            let useRingModHzEnvelopeStart: number = envelopeStarts[EnvelopeComputeIndex.ringModulationHz];
            let useRingModHzEnvelopeEnd: number = envelopeEnds[EnvelopeComputeIndex.ringModulationHz];


            if (synth.isModActive(Config.modulators.dictionary["ring modulation"].index, channelIndex, instrumentIndex)) {
                useRingModStart = (synth.getModValue(Config.modulators.dictionary["ring modulation"].index, channelIndex, instrumentIndex, false));
                useRingModEnd = (synth.getModValue(Config.modulators.dictionary["ring modulation"].index, channelIndex, instrumentIndex, true));
            }
            if (synth.isModActive(Config.modulators.dictionary["ring mod hertz"].index, channelIndex, instrumentIndex)) {
                useRingModHzStart = Math.min(1.0, Math.max(0.0, (synth.getModValue(Config.modulators.dictionary["ring mod hertz"].index, channelIndex, instrumentIndex, false)) / (Config.ringModHzRange - 1)));
                useRingModHzEnd = Math.min(1.0, Math.max(0.0, (synth.getModValue(Config.modulators.dictionary["ring mod hertz"].index, channelIndex, instrumentIndex, false)) / (Config.ringModHzRange - 1)));
            }
            useRingModHzStart *= useRingModHzEnvelopeStart;
            useRingModHzEnd *= useRingModHzEnvelopeEnd;
            let ringModStart: number = Math.min(1.0, (useRingModStart * useRingModEnvelopeStart) / (Config.ringModRange - 1));
            let ringModEnd: number = Math.min(1.0, (useRingModEnd * useRingModEnvelopeEnd) / (Config.ringModRange - 1));

            this.ringModMix = ringModStart;
            this.ringModMixDelta = (ringModEnd - ringModStart) / roundedSamplesPerTick;

            this.ringModHzOffset = instrument.ringModHzOffset;

            let ringModPhaseDeltaStart = (Math.max(0, calculateRingModHertz(useRingModHzStart))) / synth.samplesPerSecond;
            let ringModPhaseDeltaEnd = (Math.max(0, calculateRingModHertz(useRingModHzEnd))) / synth.samplesPerSecond;
            
            if (useRingModHzStart < 1 / (Config.ringModHzRange - 1) || useRingModHzEnd < 1 / (Config.ringModHzRange - 1)) {
                ringModPhaseDeltaStart *= useRingModHzStart * (Config.ringModHzRange - 1);
                ringModPhaseDeltaEnd *= useRingModHzEnd * (Config.ringModHzRange - 1);
            }

            this.ringModMixFadeDelta = 0;
            if (this.ringModMixFade < 0) this.ringModMixFade = 0;
            if (ringModPhaseDeltaStart <= 0 && ringModPhaseDeltaEnd <= 0 && this.ringModMixFade != 0) {
                this.ringModMixFadeDelta = this.ringModMixFade / -40;
            } else if (ringModPhaseDeltaStart > 0 && ringModPhaseDeltaEnd > 0) {
                this.ringModMixFade = 1.0;
            }

            this.ringModPhaseDelta = ringModPhaseDeltaStart;
            this.ringModPhaseDeltaScale = ringModPhaseDeltaStart == 0 ? 1 : Math.pow(ringModPhaseDeltaEnd / ringModPhaseDeltaStart, 1.0 / roundedSamplesPerTick);

            this.ringModWaveformIndex = instrument.ringModWaveformIndex;
            this.ringModPulseWidth = instrument.ringModPulseWidth;

        }

        let maxEchoMult = 0.0;
        let averageEchoDelaySeconds: number = 0.0;
        if (usesEcho) {

            const echoSustainEnvelopeStart: number = envelopeStarts[EnvelopeComputeIndex.echoSustain];
            const echoSustainEnvelopeEnd: number = envelopeEnds[EnvelopeComputeIndex.echoSustain];
            let useEchoSustainStart: number = instrument.echoSustain;
            let useEchoSustainEnd: number = instrument.echoSustain;
            // Check for echo mods
            if (synth.isModActive(Config.modulators.dictionary["echo"].index, channelIndex, instrumentIndex)) {
                useEchoSustainStart = Math.max(0.0, synth.getModValue(Config.modulators.dictionary["echo"].index, channelIndex, instrumentIndex, false));
                useEchoSustainEnd = Math.max(0.0, synth.getModValue(Config.modulators.dictionary["echo"].index, channelIndex, instrumentIndex, true));
            }
            const echoMultStart: number = Math.min(1.0, Math.pow(echoSustainEnvelopeStart * useEchoSustainStart / Config.echoSustainRange, 1.1)) * 0.9;
            const echoMultEnd: number = Math.min(1.0, Math.pow(echoSustainEnvelopeEnd * useEchoSustainEnd / Config.echoSustainRange, 1.1)) * 0.9;
            this.echoMult = echoMultStart;
            this.echoMultDelta = Math.max(0.0, (echoMultEnd - echoMultStart) / roundedSamplesPerTick);
            maxEchoMult = Math.max(echoMultStart, echoMultEnd);

            // TODO: After computing a tick's settings once for multiple run lengths (which is
            // good for audio worklet threads), compute the echo delay envelopes at tick (or
            // part) boundaries to interpolate between two delay taps.

            // slarmoo - I decided instead to enable and have the artifacts be part of the sound. 
            // Worst case scenario I add a toggle for if upstream it gets done differently
            const echoDelayEnvelopeStart: number = envelopeStarts[EnvelopeComputeIndex.echoDelay];
            const echoDelayEnvelopeEnd: number = envelopeEnds[EnvelopeComputeIndex.echoDelay];
            let useEchoDelayStart: number = instrument.echoDelay * echoDelayEnvelopeStart;
            let useEchoDelayEnd: number = instrument.echoDelay * echoDelayEnvelopeEnd;
            
            // Check for echo delay mods
            if (synth.isModActive(Config.modulators.dictionary["echo delay"].index, channelIndex, instrumentIndex)) {
                useEchoDelayStart = synth.getModValue(Config.modulators.dictionary["echo delay"].index, channelIndex, instrumentIndex, false) * echoDelayEnvelopeStart;
                useEchoDelayEnd = synth.getModValue(Config.modulators.dictionary["echo delay"].index, channelIndex, instrumentIndex, true) * echoDelayEnvelopeEnd;
            }
            const tmpEchoDelayOffsetStart: number = Math.round((useEchoDelayStart + 1) * Config.echoDelayStepTicks * samplesPerTick);
            const tmpEchoDelayOffsetEnd: number = Math.round((useEchoDelayEnd + 1) * Config.echoDelayStepTicks * samplesPerTick);
            if (this.echoDelayOffsetEnd != null) {
                this.echoDelayOffsetStart = this.echoDelayOffsetEnd;
            } else {
                this.echoDelayOffsetStart = tmpEchoDelayOffsetStart;
            }

            this.echoDelayOffsetEnd = tmpEchoDelayOffsetEnd;
            averageEchoDelaySeconds = (this.echoDelayOffsetStart + this.echoDelayOffsetEnd) * 0.5 / samplesPerSecond;

            this.echoDelayOffsetRatio = 0.0;
            this.echoDelayOffsetRatioDelta = 1.0 / roundedSamplesPerTick;

            const shelfRadians: number = 2.0 * Math.PI * Config.echoShelfHz / synth.samplesPerSecond;
            SynthProcessor.tempFilterStartCoefficients.highShelf1stOrder(shelfRadians, Config.echoShelfGain);
            this.echoShelfA1 = SynthProcessor.tempFilterStartCoefficients.a[1];
            this.echoShelfB0 = SynthProcessor.tempFilterStartCoefficients.b[0];
            this.echoShelfB1 = SynthProcessor.tempFilterStartCoefficients.b[1];
        }

        let maxReverbMult = 0.0;
        if (usesReverb) {
            const reverbEnvelopeStart: number = envelopeStarts[EnvelopeComputeIndex.reverb];
            const reverbEnvelopeEnd: number = envelopeEnds[EnvelopeComputeIndex.reverb];

            let useReverbStart: number = instrument.reverb;
            let useReverbEnd: number = instrument.reverb;

            // Check for mod reverb, instrument level
            if (synth.isModActive(Config.modulators.dictionary["reverb"].index, channelIndex, instrumentIndex)) {
                useReverbStart = synth.getModValue(Config.modulators.dictionary["reverb"].index, channelIndex, instrumentIndex, false);
                useReverbEnd = synth.getModValue(Config.modulators.dictionary["reverb"].index, channelIndex, instrumentIndex, true);
            }
            // Check for mod reverb, song scalar
            if (synth.isModActive(Config.modulators.dictionary["song reverb"].index, channelIndex, instrumentIndex)) {
                useReverbStart *= (synth.getModValue(Config.modulators.dictionary["song reverb"].index, undefined, undefined, false) - Config.modulators.dictionary["song reverb"].convertRealFactor) / Config.reverbRange;
                useReverbEnd *= (synth.getModValue(Config.modulators.dictionary["song reverb"].index, undefined, undefined, true) - Config.modulators.dictionary["song reverb"].convertRealFactor) / Config.reverbRange;
            }

            const reverbStart: number = Math.min(1.0, Math.pow(reverbEnvelopeStart * useReverbStart / Config.reverbRange, 0.667)) * 0.425;
            const reverbEnd: number = Math.min(1.0, Math.pow(reverbEnvelopeEnd * useReverbEnd / Config.reverbRange, 0.667)) * 0.425;

            this.reverbMult = reverbStart;
            this.reverbMultDelta = (reverbEnd - reverbStart) / roundedSamplesPerTick;
            maxReverbMult = Math.max(reverbStart, reverbEnd);

            const shelfRadians: number = 2.0 * Math.PI * Config.reverbShelfHz / synth.samplesPerSecond;
            SynthProcessor.tempFilterStartCoefficients.highShelf1stOrder(shelfRadians, Config.reverbShelfGain);
            this.reverbShelfA1 = SynthProcessor.tempFilterStartCoefficients.a[1];
            this.reverbShelfB0 = SynthProcessor.tempFilterStartCoefficients.b[0];
            this.reverbShelfB1 = SynthProcessor.tempFilterStartCoefficients.b[1];
        }
        if (usesPlugin && SynthProcessor.pluginInstrumentStateFunction) {
            //default delay line size. Can be updated in plugin function
            this.pluginDelayLineSize = SynthProcessor.PluginDelayLineSize;
            //fill plugin array
            new Function("instrument", SynthProcessor.pluginInstrumentStateFunction).bind(this).call(this, instrument);
        }

        if (this.tonesAddedInThisTick) {
            this.attentuationProgress = 0.0;
            this.flushedSamples = 0;
            this.flushingDelayLines = false;
        } else if (!this.flushingDelayLines) {
            // If this instrument isn't playing tones anymore, the volume can fade out by the
            // end of the first tick. It's possible for filters and the panning delay line to
            // continue past the end of the tone but they should have mostly dissipated by the
            // end of the tick anyway.
            if (this.attentuationProgress == 0.0) {
                eqFilterVolumeEnd = 0.0;
            } else {
                eqFilterVolumeStart = 0.0;
                eqFilterVolumeEnd = 0.0;
            }

            const attenuationThreshold: number = 1.0 / 256.0; // when the delay line signal has attenuated this much, it should be inaudible and should be flushed to zero.
            const halfLifeMult: number = -Math.log2(attenuationThreshold);
            let delayDuration: number = 0.0;

            if (usesChorus) {
                delayDuration += Config.chorusMaxDelay;
            }

            if (usesEcho) {
                const attenuationPerSecond: number = Math.pow(maxEchoMult, 1.0 / averageEchoDelaySeconds);
                const halfLife: number = -1.0 / Math.log2(attenuationPerSecond);
                const echoDuration: number = halfLife * halfLifeMult;
                delayDuration += echoDuration;
            }

            if (usesReverb) {
                const averageMult: number = maxReverbMult * 2.0;
                const averageReverbDelaySeconds: number = (Config.reverbDelayBufferSize / 4.0) / samplesPerSecond;
                const attenuationPerSecond: number = Math.pow(averageMult, 1.0 / averageReverbDelaySeconds);
                const halfLife: number = -1.0 / Math.log2(attenuationPerSecond);
                const reverbDuration: number = halfLife * halfLifeMult;
                delayDuration += reverbDuration;
            }

            if (usesGranular) {
                this.computeGrains = false;
            }

            if (usesPlugin) {
                delayDuration += SynthProcessor.PluginDelayLineSize;
            }

            const secondsInTick: number = samplesPerTick / samplesPerSecond;
            const progressInTick: number = secondsInTick / delayDuration;
            const progressAtEndOfTick: number = this.attentuationProgress + progressInTick;
            if (progressAtEndOfTick >= 1.0) {
                delayInputMultEnd = 0.0;
            }

            this.attentuationProgress = progressAtEndOfTick;
            if (this.attentuationProgress >= 1.0) {
                this.flushingDelayLines = true;
            }
        } else {
            // Flushing delay lines to zero since the signal has mostly dissipated.
            eqFilterVolumeStart = 0.0;
            eqFilterVolumeEnd = 0.0;
            delayInputMultStart = 0.0;
            delayInputMultEnd = 0.0;

            let totalDelaySamples: number = 0;
            if (usesChorus) totalDelaySamples += synth.chorusDelayBufferSize;
            if (usesEcho) totalDelaySamples += this.echoDelayLineL!.length;
            if (usesReverb) totalDelaySamples += Config.reverbDelayBufferSize;
            if (usesGranular) totalDelaySamples += this.granularMaximumDelayTimeInSeconds;
            if (usesPlugin) totalDelaySamples += SynthProcessor.PluginDelayLineSize;

            this.flushedSamples += roundedSamplesPerTick;
            if (this.flushedSamples >= totalDelaySamples) {
                this.deactivateAfterThisTick = true;
            }
        }

        this.eqFilterVolume = eqFilterVolumeStart;
        this.eqFilterVolumeDelta = (eqFilterVolumeEnd - eqFilterVolumeStart) / roundedSamplesPerTick;
        this.delayInputMult = delayInputMultStart;
        this.delayInputMultDelta = (delayInputMultEnd - delayInputMultStart) / roundedSamplesPerTick;

        this.envelopeComputer.clearEnvelopes();
    }

    public updateWaves(instrument: Instrument, samplesPerSecond: number): void {
        this.volumeScale = 1.0;
        if (instrument.type != InstrumentType.mod) {
            this.unisonVoices = instrument.unisonVoices;
            this.unisonSpread = instrument.unisonSpread;
            this.unisonOffset = instrument.unisonOffset;
            this.unisonExpression = instrument.unisonExpression;
            this.unisonSign = instrument.unisonSign;
            if (this.unisonAntiPhased != instrument.unisonAntiPhased) {
                this.unisonAntiPhased = instrument.unisonAntiPhased;
                this.unisonInitialized = false; //reset the phases for mid-note updates
            }
            this.unisonBuzzes = instrument.unisonBuzzes;
        }
        if (instrument.type == InstrumentType.chip) {
            this.wave = (this.aliases) ? Config.rawChipWaves[instrument.chipWave].samples : Config.chipWaves[instrument.chipWave].samples;
            this.isUsingAdvancedLoopControls = instrument.isUsingAdvancedLoopControls;
            this.chipWaveLoopStart = instrument.chipWaveLoopStart;
            this.chipWaveLoopEnd = instrument.chipWaveLoopEnd;
            this.chipWaveLoopMode = instrument.chipWaveLoopMode;
            this.chipWavePlayBackwards = instrument.chipWavePlayBackwards;
            this.chipWaveStartOffset = instrument.chipWaveStartOffset;
        } else if (instrument.type == InstrumentType.customChipWave) {
            this.wave = (this.aliases) ? instrument.customChipWave! : instrument.customChipWaveIntegral!;
            this.volumeScale = 0.05;
        } else if (instrument.type == InstrumentType.noise) {
            this.wave = getDrumWave(instrument.chipNoise, inverseRealFourierTransform, scaleElementsByFactor);
        } else if (instrument.type == InstrumentType.harmonics) {
            this.wave = this.harmonicsWave.getCustomWave(instrument.harmonicsWave, instrument.type);
        } else if (instrument.type == InstrumentType.pickedString) {
            this.wave = this.harmonicsWave.getCustomWave(instrument.harmonicsWave, instrument.type);
        } else if (instrument.type == InstrumentType.spectrum) {
            this.wave = this.spectrumWave.getCustomWave(instrument.spectrumWave, 8);
        } else if (instrument.type == InstrumentType.drumset) {
            for (let i: number = 0; i < Config.drumCount; i++) {
                this.drumsetSpectrumWaves[i].getCustomWave(instrument.drumsetSpectrumWaves[i], InstrumentState._drumsetIndexToSpectrumOctave(i));
            }
            this.wave = null;
        } else {
            this.wave = null;
        }
    }

    public getDrumsetWave(pitch: number): Float32Array {
        if (this.type == InstrumentType.drumset) {
            return this.drumsetSpectrumWaves[pitch].wave!;
        } else {
            throw new Error("Unhandled instrument type in getDrumsetWave");
        }
    }

    public static drumsetIndexReferenceDelta(index: number): number {
        return Instrument.frequencyFromPitch(Config.spectrumBasePitch + index * 6) / 44100;
    }

    private static _drumsetIndexToSpectrumOctave(index: number): number {
        return 15 + Math.log2(InstrumentState.drumsetIndexReferenceDelta(index));
    }
}

class ChannelState {
    public readonly instruments: InstrumentState[] = [];
    public muted: boolean = false;
    public singleSeamlessInstrument: number | null = null; // Seamless tones from a pattern with a single instrument can be transferred to a different single seamless instrument in the next pattern.
}

export class SynthProcessor extends AudioWorkletProcessor {

    private syncSongState(): void {
        const channelCount: number = this.song!.getChannelCount();
        for (let i: number = this.channels.length; i < channelCount; i++) {
            this.channels[i] = new ChannelState();
        }
        this.channels.length = channelCount;
        for (let i: number = 0; i < channelCount; i++) {
            const channel: Channel = this.song!.channels[i];
            const channelState: ChannelState = this.channels[i];
            for (let j: number = channelState.instruments.length; j < channel.instruments.length; j++) {
                channelState.instruments[j] = new InstrumentState();
            }
            channelState.instruments.length = channel.instruments.length;

            if (channelState.muted != channel.muted) {
                channelState.muted = channel.muted;
                if (channelState.muted) {
                    for (const instrumentState of channelState.instruments) {
                        instrumentState.resetAllEffects();
                    }
                }
            }
        }
    }

    public initModFilters(song: Song | null): void {
        if (song != null) {
            song.tmpEqFilterStart = song.eqFilter;
            song.tmpEqFilterEnd = null;
            for (let channelIndex: number = 0; channelIndex < song.getChannelCount(); channelIndex++) {
                for (let instrumentIndex: number = 0; instrumentIndex < song.channels[channelIndex].instruments.length; instrumentIndex++) {
                    const instrument: Instrument = song.channels[channelIndex].instruments[instrumentIndex];
                    instrument.tmpEqFilterStart = instrument.eqFilter;
                    instrument.tmpEqFilterEnd = null;
                    instrument.tmpNoteFilterStart = instrument.noteFilter;
                    instrument.tmpNoteFilterEnd = null;
                }
            }
        }
    }
    public warmUpSynthesizer(song: Song | null): void {
        // Don't bother to generate the drum waves unless the song actually
        // uses them, since they may require a lot of computation.
        if (song != null) {
            this.syncSongState();
            const samplesPerTick: number = this.getSamplesPerTick();
            for (let channelIndex: number = 0; channelIndex < song.getChannelCount(); channelIndex++) {
                for (let instrumentIndex: number = 0; instrumentIndex < song.channels[channelIndex].instruments.length; instrumentIndex++) {
                    const instrument: Instrument = song.channels[channelIndex].instruments[instrumentIndex];
                    const instrumentState: InstrumentState = this.channels[channelIndex].instruments[instrumentIndex];
                    SynthProcessor.getInstrumentSynthFunction(instrument);
                    instrumentState.vibratoTime = 0;
                    instrumentState.nextVibratoTime = 0;
                    for (let envelopeIndex: number = 0; envelopeIndex < Config.maxEnvelopeCount + 1; envelopeIndex++) instrumentState.envelopeTime[envelopeIndex] = 0;
                    instrumentState.arpTime = 0;
                    instrumentState.updateWaves(instrument, this.samplesPerSecond);
                    instrumentState.allocateNecessaryBuffers(this, instrument, samplesPerTick);
                }

            }
        }
        // JummBox needs to run synth functions for at least one sample (for JIT purposes)
        // before starting audio callbacks to avoid skipping the initial output.
        var dummyArray = new Float32Array(1);
        this.isPlayingSong = true;
        this.synthesize(dummyArray, dummyArray, 1, true);
        this.isPlayingSong = false;
    }


    public computeLatestModValues(): void {
        if (this.song != null && this.song.modChannelCount > 0) {

            // Clear all mod values, and set up temp variables for the time a mod would be set at.
            let latestModTimes: (number | null)[] = [];
            let latestModInsTimes: (number | null)[][][] = [];
            this.modValues = [];
            this.nextModValues = [];
            this.modInsValues = [];
            this.nextModInsValues = [];
            this.heldMods = [];
            for (let channel: number = 0; channel < this.song.pitchChannelCount + this.song.noiseChannelCount; channel++) {
                latestModInsTimes[channel] = [];
                this.modInsValues[channel] = [];
                this.nextModInsValues[channel] = [];

                for (let instrument: number = 0; instrument < this.song.channels[channel].instruments.length; instrument++) {
                    this.modInsValues[channel][instrument] = [];
                    this.nextModInsValues[channel][instrument] = [];
                    latestModInsTimes[channel][instrument] = [];
                }
            }

            // Find out where we're at in the fraction of the current bar.
            let currentPart: number = this.beat * Config.partsPerBeat + this.part;

            // For mod channels, calculate last set value for each mod
            for (let channelIndex: number = this.song.pitchChannelCount + this.song.noiseChannelCount; channelIndex < this.song.getChannelCount(); channelIndex++) {
                if (!(this.song.channels[channelIndex].muted)) {

                    let pattern: Pattern | null;

                    for (let currentBar: number = this.bar; currentBar >= 0; currentBar--) {
                        pattern = this.song.getPattern(channelIndex, currentBar);

                        if (pattern != null) {
                            let instrumentIdx: number = pattern.instruments[0];
                            let instrument: Instrument = this.song.channels[channelIndex].instruments[instrumentIdx];
                            let latestPinParts: number[] = [];
                            let latestPinValues: number[] = [];

                            let partsInBar: number = (currentBar == this.bar)
                                ? currentPart
                                : this.findPartsInBar(currentBar);

                            for (const note of pattern.notes) {
                                if (note.start <= partsInBar && (latestPinParts[Config.modCount - 1 - note.pitches[0]] == null || note.end > latestPinParts[Config.modCount - 1 - note.pitches[0]])) {
                                    if (note.start == partsInBar) { // This can happen with next bar mods, and the value of the aligned note's start pin will be used.
                                        latestPinParts[Config.modCount - 1 - note.pitches[0]] = note.start;
                                        latestPinValues[Config.modCount - 1 - note.pitches[0]] = note.pins[0].size;
                                    }
                                    if (note.end <= partsInBar) {
                                        latestPinParts[Config.modCount - 1 - note.pitches[0]] = note.end;
                                        latestPinValues[Config.modCount - 1 - note.pitches[0]] = note.pins[note.pins.length - 1].size;
                                    }
                                    else {
                                        latestPinParts[Config.modCount - 1 - note.pitches[0]] = partsInBar;
                                        // Find the pin where bar change happens, and compute where pin volume would be at that time
                                        for (let pinIdx = 0; pinIdx < note.pins.length; pinIdx++) {
                                            if (note.pins[pinIdx].time + note.start > partsInBar) {
                                                const transitionLength: number = note.pins[pinIdx].time - note.pins[pinIdx - 1].time;
                                                const toNextBarLength: number = partsInBar - note.start - note.pins[pinIdx - 1].time;
                                                const deltaVolume: number = note.pins[pinIdx].size - note.pins[pinIdx - 1].size;

                                                latestPinValues[Config.modCount - 1 - note.pitches[0]] = Math.round(note.pins[pinIdx - 1].size + deltaVolume * toNextBarLength / transitionLength);
                                                pinIdx = note.pins.length;
                                            }
                                        }
                                    }
                                }
                            }

                            // Set modulator value, if it wasn't set in another pattern already scanned
                            for (let mod: number = 0; mod < Config.modCount; mod++) {
                                if (latestPinParts[mod] != null) {
                                    if (Config.modulators[instrument.modulators[mod]].forSong) {
                                        const songFilterParam: boolean = instrument.modulators[mod] == Config.modulators.dictionary["song eq"].index;
                                        if (latestModTimes[instrument.modulators[mod]] == null || currentBar * Config.partsPerBeat * this.song.beatsPerBar + latestPinParts[mod] > (latestModTimes[instrument.modulators[mod]] as number)) {
                                            if (songFilterParam) {
                                                let tgtSong: Song = this.song
                                                if (instrument.modFilterTypes[mod] == 0) {
                                                    tgtSong.tmpEqFilterStart = tgtSong.eqSubFilters[latestPinValues[mod]];
                                                } else {
                                                    for (let i: number = 0; i < Config.filterMorphCount; i++) {
                                                        if (tgtSong.tmpEqFilterStart != null && tgtSong.tmpEqFilterStart == tgtSong.eqSubFilters[i]) {
                                                            tgtSong.tmpEqFilterStart = new FilterSettings();
                                                            tgtSong.tmpEqFilterStart.fromJsonObject(tgtSong.eqSubFilters[i]!.toJsonObject());
                                                            i = Config.filterMorphCount;
                                                        }
                                                    }
                                                    if (tgtSong.tmpEqFilterStart != null && Math.floor((instrument.modFilterTypes[mod] - 1) / 2) < tgtSong.tmpEqFilterStart.controlPointCount) {
                                                        if (instrument.modFilterTypes[mod] % 2)
                                                            tgtSong.tmpEqFilterStart.controlPoints[Math.floor((instrument.modFilterTypes[mod] - 1) / 2)].freq = latestPinValues[mod];
                                                        else
                                                            tgtSong.tmpEqFilterStart.controlPoints[Math.floor((instrument.modFilterTypes[mod] - 1) / 2)].gain = latestPinValues[mod];
                                                    }
                                                }
                                                tgtSong.tmpEqFilterEnd = tgtSong.tmpEqFilterStart;
                                            }
                                            this.setModValue(latestPinValues[mod], latestPinValues[mod], instrument.modChannels[mod], instrument.modInstruments[mod], instrument.modulators[mod]);
                                            latestModTimes[instrument.modulators[mod]] = currentBar * Config.partsPerBeat * this.song.beatsPerBar + latestPinParts[mod];
                                        }
                                    } else {
                                        // Generate list of used instruments
                                        let usedInstruments: number[] = [];
                                        // All
                                        if (instrument.modInstruments[mod] == this.song.channels[instrument.modChannels[mod]].instruments.length) {
                                            for (let i: number = 0; i < this.song.channels[instrument.modChannels[mod]].instruments.length; i++) {
                                                usedInstruments.push(i);
                                            }
                                        } // Active
                                        else if (instrument.modInstruments[mod] > this.song.channels[instrument.modChannels[mod]].instruments.length) {
                                            const tgtPattern: Pattern | null = this.song.getPattern(instrument.modChannels[mod], currentBar);
                                            if (tgtPattern != null)
                                                usedInstruments = tgtPattern.instruments;
                                        } else {
                                            usedInstruments.push(instrument.modInstruments[mod]);
                                        }
                                        for (let instrumentIndex: number = 0; instrumentIndex < usedInstruments.length; instrumentIndex++) {
                                            // Iterate through all used instruments by this modulator
                                            // Special indices for mod filter targets, since they control multiple things.
                                            const eqFilterParam: boolean = instrument.modulators[mod] == Config.modulators.dictionary["eq filter"].index;
                                            const noteFilterParam: boolean = instrument.modulators[mod] == Config.modulators.dictionary["note filter"].index;
                                            let modulatorAdjust: number = instrument.modulators[mod];
                                            if (eqFilterParam) {
                                                modulatorAdjust = Config.modulators.length + (instrument.modFilterTypes[mod] | 0);
                                            } else if (noteFilterParam) {
                                                // Skip all possible indices for eq filter
                                                modulatorAdjust = Config.modulators.length + 1 + (2 * Config.filterMaxPoints) + (instrument.modFilterTypes[mod] | 0);
                                            }

                                            if (latestModInsTimes[instrument.modChannels[mod]][usedInstruments[instrumentIndex]][modulatorAdjust] == null
                                                || currentBar * Config.partsPerBeat * this.song.beatsPerBar + latestPinParts[mod] > latestModInsTimes[instrument.modChannels[mod]][usedInstruments[instrumentIndex]][modulatorAdjust]!) {

                                                if (eqFilterParam) {
                                                    let tgtInstrument: Instrument = this.song.channels[instrument.modChannels[mod]].instruments[usedInstruments[instrumentIndex]];
                                                    if (instrument.modFilterTypes[mod] == 0) {
                                                        tgtInstrument.tmpEqFilterStart = tgtInstrument.eqSubFilters[latestPinValues[mod]];
                                                    } else {
                                                        for (let i: number = 0; i < Config.filterMorphCount; i++) {
                                                            if (tgtInstrument.tmpEqFilterStart != null && tgtInstrument.tmpEqFilterStart == tgtInstrument.eqSubFilters[i]) {
                                                                tgtInstrument.tmpEqFilterStart = new FilterSettings();
                                                                tgtInstrument.tmpEqFilterStart.fromJsonObject(tgtInstrument.eqSubFilters[i]!.toJsonObject());
                                                                i = Config.filterMorphCount;
                                                            }
                                                        }
                                                        if (tgtInstrument.tmpEqFilterStart != null && Math.floor((instrument.modFilterTypes[mod] - 1) / 2) < tgtInstrument.tmpEqFilterStart.controlPointCount) {
                                                            if (instrument.modFilterTypes[mod] % 2)
                                                                tgtInstrument.tmpEqFilterStart.controlPoints[Math.floor((instrument.modFilterTypes[mod] - 1) / 2)].freq = latestPinValues[mod];
                                                            else
                                                                tgtInstrument.tmpEqFilterStart.controlPoints[Math.floor((instrument.modFilterTypes[mod] - 1) / 2)].gain = latestPinValues[mod];
                                                        }
                                                    }
                                                    tgtInstrument.tmpEqFilterEnd = tgtInstrument.tmpEqFilterStart;
                                                } else if (noteFilterParam) {
                                                    let tgtInstrument: Instrument = this.song.channels[instrument.modChannels[mod]].instruments[usedInstruments[instrumentIndex]];
                                                    if (instrument.modFilterTypes[mod] == 0) {
                                                        tgtInstrument.tmpNoteFilterStart = tgtInstrument.noteSubFilters[latestPinValues[mod]];
                                                    } else {
                                                        for (let i: number = 0; i < Config.filterMorphCount; i++) {
                                                            if (tgtInstrument.tmpNoteFilterStart != null && tgtInstrument.tmpNoteFilterStart == tgtInstrument.noteSubFilters[i]) {
                                                                tgtInstrument.tmpNoteFilterStart = new FilterSettings();
                                                                tgtInstrument.tmpNoteFilterStart.fromJsonObject(tgtInstrument.noteSubFilters[i]!.toJsonObject());
                                                                i = Config.filterMorphCount;
                                                            }
                                                        }
                                                        if (tgtInstrument.tmpNoteFilterStart != null && Math.floor((instrument.modFilterTypes[mod] - 1) / 2) < tgtInstrument.tmpNoteFilterStart.controlPointCount) {
                                                            if (instrument.modFilterTypes[mod] % 2)
                                                                tgtInstrument.tmpNoteFilterStart.controlPoints[Math.floor((instrument.modFilterTypes[mod] - 1) / 2)].freq = latestPinValues[mod];
                                                            else
                                                                tgtInstrument.tmpNoteFilterStart.controlPoints[Math.floor((instrument.modFilterTypes[mod] - 1) / 2)].gain = latestPinValues[mod];
                                                        }
                                                    }
                                                    tgtInstrument.tmpNoteFilterEnd = tgtInstrument.tmpNoteFilterStart;
                                                }
                                                else this.setModValue(latestPinValues[mod], latestPinValues[mod], instrument.modChannels[mod], usedInstruments[instrumentIndex], modulatorAdjust);

                                                latestModInsTimes[instrument.modChannels[mod]][usedInstruments[instrumentIndex]][modulatorAdjust] = currentBar * Config.partsPerBeat * this.song.beatsPerBar + latestPinParts[mod];
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private static operatorAmplitudeCurve(amplitude: number): number {
        return (Math.pow(16.0, amplitude / 15.0) - 1.0) / 15.0;
    }

    public samplesPerSecond: number = 44100;
    public panningDelayBufferSize: number;
    public panningDelayBufferMask: number;
    public chorusDelayBufferSize: number;
    public chorusDelayBufferMask: number;
    // TODO: reverb

    public song: Song | null = null;
    public preferLowerLatency: boolean = false; // enable when recording performances from keyboard or MIDI. Takes effect next time you activate audio.
    public anticipatePoorPerformance: boolean = false; // enable on mobile devices to reduce audio stutter glitches. Takes effect next time you activate audio.
    /**
     * liveInputDuration [0]: number
     * 
     * liveBassInputDuration [1]: number
     * 
     * liveInputStarted [2]: 0 | 1
     * 
     * liveBassInputStarted [3]: 0 | 1
     * 
     * liveInputChannel [4]: integer
     * 
     * liveBassInputChannel [5]: integer
     */
    public liveInputValues: Uint32Array;
    private readonly liveInputPitches: BeepboxSet = new BeepboxSet();
    private readonly liveBassInputPitches: BeepboxSet = new BeepboxSet();
    private liveInputPitchesOnOffRequests: RingBuffer;

    public loopRepeatCount: number = -1;
    public volume: number = 1.0;
    public oscRefreshEventTimer: number = 0;
    public oscEnabled: boolean = true;
    public enableMetronome: boolean = false;
    public countInMetronome: boolean = false;
    public renderingSong: boolean = false;
    public heldMods: HeldMod[] = [];
    private wantToSkip: boolean = false;
    private bar: number = 0;
    private prevBar: number | null = null;
    private nextBar: number | null = null;
    private beat: number = 0;
    private part: number = 0;
    private tick: number = 0;
    public isAtStartOfTick: boolean = true;
    public isAtEndOfTick: boolean = true;
    public tickSampleCountdown: number = 0;
    private modValues: (number | null)[] = [];
    public modInsValues: (number | null)[][][] = [];
    private nextModValues: (number | null)[] = [];
    public nextModInsValues: (number | null)[][][] = [];
    private isPlayingSong: boolean = false;
    private isRecording: boolean = false;
    private browserAutomaticallyClearsAudioBuffer: boolean = true; // Assume true until proven otherwise. Older Chrome does not clear the buffer so it needs to be cleared manually.

    public static readonly tempFilterStartCoefficients: FilterCoefficients = new FilterCoefficients();
    public static readonly tempFilterEndCoefficients: FilterCoefficients = new FilterCoefficients();
    private tempDrumSetControlPoint: FilterControlPoint = new FilterControlPoint();
    public tempFrequencyResponse: FrequencyResponse = new FrequencyResponse();
    public loopBarStart: number = -1;
    /** An *inclusive* bound. */
    public loopBarEnd: number = -1;

    private static readonly fmSynthFunctionCache: Dictionary<Function> = {};
    private static readonly fm6SynthFunctionCache: Dictionary<Function> = {};
    private static readonly effectsFunctionCache: Function[] = Array(1 << 7).fill(undefined); // keep in sync with the number of post-process effects.
    private static readonly pickedStringFunctionCache: Function[] = Array(3).fill(undefined); // keep in sync with the number of unison voices.
    private static readonly spectrumFunctionCache: Function[] = [];
    private static readonly noiseFunctionCache: Function[] = [];
    private static readonly drumFunctionCache: Function[] = [];
    private static readonly chipFunctionCache: Function[] = [];
    private static readonly pulseFunctionCache: Function[] = [];
    private static readonly supersawFunctionCache: Function[] = [];
    private static readonly harmonicsFunctionCache: Function[] = [];
    private static readonly loopableChipFunctionCache: Function[] = Array(Config.unisonVoicesMax + 1).fill(undefined); //For loopable chips, we have a matrix where the rows represent voices and the columns represent loop types

    public static pluginFunction: string | null = null;
    public static pluginIndex: number = 0;
    public static pluginValueNames: string[] = [];
    public static pluginInstrumentStateFunction: string | null = null;
    public static PluginDelayLineSize: number = 0;
    public static rerenderSongEditorAfterPluginLoad: Function | null = null;

    public readonly channels: ChannelState[] = [];
    /**
    * We reuse already allocated tones to save performance from garbage collection 
    */
    private readonly tonePool: Deque<Tone> = new Deque<Tone>();
    private readonly tempMatchedPitchTones: Array<Tone | null> = Array(Config.maxChordSize).fill(null);

    private startedMetronome: boolean = false;
    private metronomeSamplesRemaining: number = -1;
    private metronomeAmplitude: number = 0.0;
    private metronomePrevAmplitude: number = 0.0;
    private metronomeFilter: number = 0.0;
    private limit: number = 0.0;

    public songEqFilterVolume: number = 1.0;
    public songEqFilterVolumeDelta: number = 0.0;
    public readonly songEqFiltersL: DynamicBiquadFilter[] = [];
    public readonly songEqFiltersR: DynamicBiquadFilter[] = [];
    public songEqFilterCount: number = 0;
    public initialSongEqFilterInput1L: number = 0.0;
    public initialSongEqFilterInput2L: number = 0.0;
    public initialSongEqFilterInput1R: number = 0.0;
    public initialSongEqFilterInput2R: number = 0.0;

    private tempMonoInstrumentSampleBuffer: Float32Array | null = null;
    private outputDataLUnfiltered: Float32Array | null = null;
    private outputDataRUnfiltered: Float32Array | null = null;

    public getTicksIntoBar(): number {
        return (this.beat * Config.partsPerBeat + this.part) * Config.ticksPerPart + this.tick;
    }
    public getCurrentPart(): number {
        return (this.beat * Config.partsPerBeat + this.part);
    }

    private findPartsInBar(bar: number): number {
        if (this.song == null) return 0;
        let partsInBar: number = Config.partsPerBeat * this.song.beatsPerBar;
        for (let channel: number = this.song.pitchChannelCount + this.song.noiseChannelCount; channel < this.song.getChannelCount(); channel++) {
            let pattern: Pattern | null = this.song.getPattern(channel, bar);
            if (pattern != null) {
                let instrument: Instrument = this.song.channels[channel].instruments[pattern.instruments[0]];
                for (let mod: number = 0; mod < Config.modCount; mod++) {
                    if (instrument.modulators[mod] == Config.modulators.dictionary["next bar"].index) {
                        for (const note of pattern.notes) {
                            if (note.pitches[0] == (Config.modCount - 1 - mod)) {
                                // Find the earliest next bar note.
                                if (partsInBar > note.start)
                                    partsInBar = note.start;
                            }
                        }
                    }
                }
            }
        }
        return partsInBar;
    }

    constructor() {
        super();
        this.port.onmessage = (event: MessageEvent) => this.receiveMessage(event);
        this.computeDelayBufferSizes();
    }

    private sendMessage(message: Message) {
        this.port.postMessage(message);
    }

    private receiveMessage(event: MessageEvent): void {
        const flag: MessageFlag = event.data.flag;

        switch (flag) {
            case MessageFlag.togglePlay:
                if (event.data.play) {
                    this.play();
                } else {
                    this.pause();
                }
                break;
            case MessageFlag.loadSong:
                this.setSong(event.data.song);
                break;
            case MessageFlag.resetEffects:
                this.resetEffects();
                break;
            case MessageFlag.computeMods:
                if (event.data.initFilters) this.initModFilters(this.song);
                this.computeLatestModValues();
                break;
            case MessageFlag.songPosition: {
                this.bar = event.data.bar;
                this.beat = event.data.beat;
                this.part = event.data.part;
                break;
            }
            case MessageFlag.sharedArrayBuffers: {
                console.log("LOADING SABS");
                this.liveInputValues = event.data.liveInputValues;
                this.liveInputPitchesOnOffRequests = new RingBuffer(event.data.liveInputPitchesOnOffRequests, Uint16Array);
                break;
            }
            case MessageFlag.setPrevBar: {
                this.prevBar = event.data.prevBar;
                break;
            }
            case MessageFlag.updateSong: {
                if (!this.song) this.song = new Song();
                this.song.parseUpdateCommand(event.data.data, event.data.songSetting, event.data.channelIndex, event.data.instrumentIndex, event.data.instrumentSetting)
            }

        }
    }

    public setSong(song: string): void {
        if (this.song) {
            this.song.fromBase64String(song);
        } else {
            this.song = new Song(song);
        }
        this.prevBar = null;
    }

    private computeDelayBufferSizes(): void {
        this.panningDelayBufferSize = SynthProcessor.fittingPowerOfTwo(this.samplesPerSecond * Config.panDelaySecondsMax);
        this.panningDelayBufferMask = this.panningDelayBufferSize - 1;
        this.chorusDelayBufferSize = SynthProcessor.fittingPowerOfTwo(this.samplesPerSecond * Config.chorusMaxDelay);
        this.chorusDelayBufferMask = this.chorusDelayBufferSize - 1;
    }

    private deactivateAudio(): void {
        const DeactivateMessage: DeactivateMessage = {
            flag: MessageFlag.deactivate
        }
        this.sendMessage(DeactivateMessage);
    }


    public play(): void {
        if (this.isPlayingSong) return;
        this.initModFilters(this.song);
        this.computeLatestModValues();
        this.warmUpSynthesizer(this.song);
        this.isPlayingSong = true;
    }

    public pause(): void {
        if (!this.isPlayingSong) return;
        this.isPlayingSong = false;
        //TODO: remove recording?
        this.isRecording = false;
        this.modValues = [];
        this.nextModValues = [];
        this.heldMods = [];
        this.liveInputPitches.clear();
        this.liveBassInputPitches.clear();
        if (this.song != null) {
            this.song.inVolumeCap = 0.0;
            this.song.outVolumeCap = 0.0;
            this.song.tmpEqFilterStart = null;
            this.song.tmpEqFilterEnd = null;
            for (let channelIndex: number = 0; channelIndex < this.song.pitchChannelCount + this.song.noiseChannelCount; channelIndex++) {
                this.modInsValues[channelIndex] = [];
                this.nextModInsValues[channelIndex] = [];
            }
        }
    }

    public resetEffects(): void {
        this.limit = 0.0;
        this.freeAllTones();
        if (this.song != null) {
            for (const channelState of this.channels) {
                for (const instrumentState of channelState.instruments) {
                    instrumentState.resetAllEffects();
                }
            }
        }
    }

    public setModValue(volumeStart: number, volumeEnd: number, channelIndex: number, instrumentIndex: number, setting: number): number {
        let val: number = volumeStart + Config.modulators[setting].convertRealFactor;
        let nextVal: number = volumeEnd + Config.modulators[setting].convertRealFactor;
        if (Config.modulators[setting].forSong) {
            if (this.modValues[setting] == null || this.modValues[setting] != val || this.nextModValues[setting] != nextVal) {
                this.modValues[setting] = val;
                this.nextModValues[setting] = nextVal;
            }
        } else {
            if (this.modInsValues[channelIndex][instrumentIndex][setting] == null
                || this.modInsValues[channelIndex][instrumentIndex][setting] != val
                || this.nextModInsValues[channelIndex][instrumentIndex][setting] != nextVal) {
                this.modInsValues[channelIndex][instrumentIndex][setting] = val;
                this.nextModInsValues[channelIndex][instrumentIndex][setting] = nextVal;
            }
        }

        return val;
    }

    public getModValue(setting: number, channel?: number | null, instrument?: number | null, nextVal?: boolean): number {
        const forSong: boolean = Config.modulators[setting].forSong;
        if (forSong) {
            if (this.modValues[setting] != null && this.nextModValues[setting] != null) {
                return nextVal ? this.nextModValues[setting]! : this.modValues[setting]!;
            }
        } else if (channel != undefined && instrument != undefined) {
            if (this.modInsValues[channel][instrument][setting] != null && this.nextModInsValues[channel][instrument][setting] != null) {
                return nextVal ? this.nextModInsValues[channel][instrument][setting]! : this.modInsValues[channel][instrument][setting]!;
            }
        }
        return -1;
    }

    public isModActive(setting: number, channel?: number, instrument?: number): boolean {
        const forSong: boolean = Config.modulators[setting].forSong;
        if (forSong) {
            return (this.modValues != undefined && this.modValues[setting] != null);
        } else if (channel != undefined && instrument != undefined && this.modInsValues != undefined && this.modInsValues[channel] != null && this.modInsValues[channel][instrument] != null) {
            return (this.modInsValues[channel][instrument][setting] != null);
        }
        return false;
    }

    private getNextBar(): number {
        let nextBar: number = this.bar + 1;
        if (this.isRecording) {
            if (nextBar >= this.song!.barCount) {
                nextBar = this.song!.barCount - 1;
            }
        } else if (this.bar == this.loopBarEnd && !this.renderingSong) {
            nextBar = this.loopBarStart;
        }
        else if (this.loopRepeatCount != 0 && nextBar == Math.max(this.loopBarEnd + 1, this.song!.loopStart + this.song!.loopLength)) {
            nextBar = this.song!.loopStart;
        }
        return nextBar;
    }

    public skipBar(): void {
        if (!this.song) return;
        const samplesPerTick: number = this.getSamplesPerTick();
        this.prevBar = this.bar; // Bugfix by LeoV
        if (this.loopBarEnd != this.bar)
            this.bar++;
        else {
            this.bar = this.loopBarStart;
        }
        this.beat = 0;
        this.part = 0;
        this.tick = 0;
        this.tickSampleCountdown = samplesPerTick;
        this.isAtStartOfTick = true;

        if (this.loopRepeatCount != 0 && this.bar == Math.max(this.song.loopStart + this.song.loopLength, this.loopBarEnd + 1)) {
            this.bar = this.song.loopStart;
            if (this.loopBarStart != -1)
                this.bar = this.loopBarStart;
            if (this.loopRepeatCount > 0) this.loopRepeatCount--;
        }

    }

    process(_: Float32Array[][], outputs: Float32Array[][]) {
        const outputDataL: Float32Array = outputs[0][0];
        const outputDataR: Float32Array = outputs[0][1];

        // AudioWorkletProcessor is not officially supported by typescript so for now we have lots of strange workarounds
        // @ts-ignore
        this.samplesPerSecond = sampleRate;

        if (this.browserAutomaticallyClearsAudioBuffer && (outputDataL[0] != 0.0 || outputDataR[0] != 0.0 || outputDataL[outputDataL.length - 1] != 0.0 || outputDataR[outputDataL.length - 1] != 0.0)) {
            // If the buffer is ever initially nonzero, then this must be an older browser that doesn't automatically clear the audio buffer.
            this.browserAutomaticallyClearsAudioBuffer = false;
        }
        if (!this.browserAutomaticallyClearsAudioBuffer) {
            // If this browser does not clear the buffer automatically, do so manually before continuing.
            const length: number = outputDataL.length;
            for (let i: number = 0; i < length; i++) {
                outputDataL[i] = 0.0;
                outputDataR[i] = 0.0;
            }
        }

        //liveInputEndTime is now handled on the main thread
        if (!this.isPlayingSong) {
            const maintainLiveInputMessage: MaintainLiveInputMessage = {
                flag: MessageFlag.maintainLiveInput
            }
            this.sendMessage(maintainLiveInputMessage);
        }
        try {
            this.synthesize(outputDataL, outputDataR, outputDataL.length, this.isPlayingSong);
        } catch (e) {
            console.log(e);
            // this.deactivateAudio();
        }

        //TODO: figure out how to properly handle this
        // if (this.oscEnabled) {
        //     if (this.oscRefreshEventTimer <= 0) {
        //         events.raise("oscilloscopeUpdate", outputDataL, outputDataR);
        //         this.oscRefreshEventTimer = 2;
        //     } else {
        //         this.oscRefreshEventTimer--;
        //     }
        // }

        return true;
    }

    private computeSongState(samplesPerTick: number): void {
        if (this.song == null) return;

        const roundedSamplesPerTick: number = Math.ceil(samplesPerTick);
        const samplesPerSecond: number = this.samplesPerSecond;

        let eqFilterVolume: number = 1.0; //this.envelopeComputer.lowpassCutoffDecayVolumeCompensation;
        const eqFilterSettings: FilterSettings = (this.song.tmpEqFilterStart != null) ? this.song.tmpEqFilterStart : this.song.eqFilter;
        for (let i: number = 0; i < eqFilterSettings.controlPointCount; i++) {
            let startPoint: FilterControlPoint = eqFilterSettings.controlPoints[i];
            let endPoint: FilterControlPoint = (this.song.tmpEqFilterEnd != null && this.song.tmpEqFilterEnd.controlPoints[i] != null) ? this.song.tmpEqFilterEnd.controlPoints[i] : eqFilterSettings.controlPoints[i];

            // If switching dot type, do it all at once and do not try to interpolate since no valid interpolation exists.
            if (startPoint.type != endPoint.type) {
                startPoint = endPoint;
            }

            startPoint.toCoefficients(SynthProcessor.tempFilterStartCoefficients, samplesPerSecond, /*eqAllFreqsEnvelopeStart * eqFreqEnvelopeStart*/ 1.0, /*eqPeakEnvelopeStart*/ 1.0);
            endPoint.toCoefficients(SynthProcessor.tempFilterEndCoefficients, samplesPerSecond, /*eqAllFreqsEnvelopeEnd   * eqFreqEnvelopeEnd*/   1.0, /*eqPeakEnvelopeEnd*/   1.0);
            if (this.songEqFiltersL.length <= i) this.songEqFiltersL[i] = new DynamicBiquadFilter();
            this.songEqFiltersL[i].loadCoefficientsWithGradient(SynthProcessor.tempFilterStartCoefficients, SynthProcessor.tempFilterEndCoefficients, 1.0 / roundedSamplesPerTick, startPoint.type == FilterType.lowPass);
            if (this.songEqFiltersR.length <= i) this.songEqFiltersR[i] = new DynamicBiquadFilter();
            this.songEqFiltersR[i].loadCoefficientsWithGradient(SynthProcessor.tempFilterStartCoefficients, SynthProcessor.tempFilterEndCoefficients, 1.0 / roundedSamplesPerTick, startPoint.type == FilterType.lowPass);
            eqFilterVolume *= startPoint.getVolumeCompensationMult();

        }
        this.songEqFilterCount = eqFilterSettings.controlPointCount;
        eqFilterVolume = Math.min(3.0, eqFilterVolume);

        let eqFilterVolumeStart: number = eqFilterVolume;
        let eqFilterVolumeEnd: number = eqFilterVolume;

        this.songEqFilterVolume = eqFilterVolumeStart;
        this.songEqFilterVolumeDelta = (eqFilterVolumeEnd - eqFilterVolumeStart) / roundedSamplesPerTick;
    }

    public synthesize(outputDataL: Float32Array, outputDataR: Float32Array, outputBufferLength: number, playSong: boolean = true): void {
        if (this.song == null ||
            this.liveInputValues == undefined ||
            this.liveInputPitchesOnOffRequests == undefined
        ) {
            outputDataL.fill(0.0);
            outputDataR.fill(0.0);
            this.deactivateAudio();
            return;
        }

        //clear the unfiltered (not affected by song eq) output
        if (this.outputDataLUnfiltered == null || this.outputDataLUnfiltered.length < outputBufferLength) {
            this.outputDataLUnfiltered = new Float32Array(outputBufferLength);
            this.outputDataRUnfiltered = new Float32Array(outputBufferLength);
        } else {
            this.outputDataLUnfiltered.fill(0.0);
            this.outputDataRUnfiltered!.fill(0.0);
        }
        
        const song: Song = this.song;
        this.song.inVolumeCap = 0.0 // Reset volume cap for this run
        this.song.outVolumeCap = 0.0;

        let samplesPerTick: number = this.getSamplesPerTick();
        let ended: boolean = false;

        // Check the bounds of the playhead:
        if (this.tickSampleCountdown <= 0 || this.tickSampleCountdown > samplesPerTick) {
            this.tickSampleCountdown = samplesPerTick;
            this.isAtStartOfTick = true;
        }
        if (playSong) {
            if (this.beat >= song.beatsPerBar) {
                this.beat = 0;
                this.part = 0;
                this.tick = 0;
                this.tickSampleCountdown = samplesPerTick;
                this.isAtStartOfTick = true;

                this.prevBar = this.bar;
                this.bar = this.getNextBar();
                if (this.bar <= this.prevBar && this.loopRepeatCount > 0) this.loopRepeatCount--;

            }
            if (this.bar >= song.barCount) {
                this.bar = 0;
                if (this.loopRepeatCount != -1) {
                    ended = true;
                    this.pause();
                }
            }
        }

        this.syncSongState();

        if (this.tempMonoInstrumentSampleBuffer == null || this.tempMonoInstrumentSampleBuffer.length < outputBufferLength) {
            this.tempMonoInstrumentSampleBuffer = new Float32Array(outputBufferLength);
        }

        // Post processing parameters:
        const volume: number = +this.volume;
        const limitDecay: number = 1.0 - Math.pow(0.5, this.song.limitDecay / this.samplesPerSecond);
        const limitRise: number = 1.0 - Math.pow(0.5, this.song.limitRise / this.samplesPerSecond);
        let limit: number = +this.limit;
        let skippedBars: number[] = [];
        let firstSkippedBufferIndex = -1;

        let bufferIndex: number = 0;
        while (bufferIndex < outputBufferLength && !ended) {

            this.nextBar = this.getNextBar();
            if (this.nextBar >= song.barCount) this.nextBar = null;

            const samplesLeftInBuffer: number = outputBufferLength - bufferIndex;
            const samplesLeftInTick: number = Math.ceil(this.tickSampleCountdown);
            const runLength: number = Math.min(samplesLeftInTick, samplesLeftInBuffer);
            const runEnd: number = bufferIndex + runLength;

            // Handle mod synth
            if (this.isPlayingSong || this.renderingSong) {

                // First modulation pass. Determines active tones.
                // Runs everything but Dot X/Y mods, to let them always come after morph.
                for (let channelIndex: number = song.pitchChannelCount + song.noiseChannelCount; channelIndex < song.getChannelCount(); channelIndex++) {
                    const channel: Channel = song.channels[channelIndex];
                    const channelState: ChannelState = this.channels[channelIndex];

                    this.determineCurrentActiveTones(song, channelIndex, samplesPerTick, playSong);
                    for (let instrumentIndex: number = 0; instrumentIndex < channel.instruments.length; instrumentIndex++) {
                        const instrumentState: InstrumentState = channelState.instruments[instrumentIndex];
                        for (let i: number = 0; i < instrumentState.activeModTones.count(); i++) {
                            const tone: Tone = instrumentState.activeModTones.get(i);
                            const channel: Channel = song.channels[channelIndex];
                            const instrument: Instrument = channel.instruments[tone.instrumentIndex];
                            let mod: number = Config.modCount - 1 - tone.pitches[0];

                            if ((instrument.modulators[mod] == Config.modulators.dictionary["note filter"].index
                                || instrument.modulators[mod] == Config.modulators.dictionary["eq filter"].index
                                || instrument.modulators[mod] == Config.modulators.dictionary["song eq"].index)
                                && instrument.modFilterTypes[mod] != null && instrument.modFilterTypes[mod] > 0) {
                                continue;
                            }
                            this.playModTone(song, channelIndex, samplesPerTick, bufferIndex, runLength, tone, false, false);
                        }
                    }
                }

                // Second modulation pass.
                // Only for Dot X/Y mods.
                for (let channelIndex: number = song.pitchChannelCount + song.noiseChannelCount; channelIndex < song.getChannelCount(); channelIndex++) {
                    const channel: Channel = song.channels[channelIndex];
                    const channelState: ChannelState = this.channels[channelIndex];

                    for (let instrumentIndex: number = 0; instrumentIndex < channel.instruments.length; instrumentIndex++) {
                        const instrumentState: InstrumentState = channelState.instruments[instrumentIndex];
                        for (let i: number = 0; i < instrumentState.activeModTones.count(); i++) {
                            const tone: Tone = instrumentState.activeModTones.get(i);
                            const channel: Channel = song.channels[channelIndex];
                            const instrument: Instrument = channel.instruments[tone.instrumentIndex];
                            let mod: number = Config.modCount - 1 - tone.pitches[0];

                            if ((instrument.modulators[mod] == Config.modulators.dictionary["note filter"].index
                                || instrument.modulators[mod] == Config.modulators.dictionary["eq filter"].index
                                || instrument.modulators[mod] == Config.modulators.dictionary["song eq"].index)
                                && instrument.modFilterTypes[mod] != null && instrument.modFilterTypes[mod] > 0) {

                                this.playModTone(song, channelIndex, samplesPerTick, bufferIndex, runLength, tone, false, false);
                            }

                        }
                    }
                }
            }

            // Handle next bar mods if they were set
            if (this.wantToSkip) {
                // Unable to continue, as we have skipped back to a previously visited bar without generating new samples, which means we are infinitely skipping.
                // In this case processing will return before the designated number of samples are processed. In other words, silence will be generated.
                let barVisited: boolean = skippedBars.includes(this.bar);
                if (barVisited && bufferIndex == firstSkippedBufferIndex) {
                    this.resetEffects();
                    this.pause();
                    return;
                }
                if (firstSkippedBufferIndex == -1) {
                    firstSkippedBufferIndex = bufferIndex;
                }
                if (!barVisited)
                    skippedBars.push(this.bar);
                this.wantToSkip = false;
                this.skipBar();
                continue;
            }

            this.computeSongState(samplesPerTick);

            if (!this.isPlayingSong && (this.liveInputPitches.size > 0 || this.liveBassInputPitches.size > 0)) { //set up modulation for live input tones
                this.computeLatestModValues();
            }

            this.dequeueLivePitches();
            for (let channelIndex: number = 0; channelIndex < song.pitchChannelCount + song.noiseChannelCount; channelIndex++) {
                const channel: Channel = song.channels[channelIndex];
                const channelState: ChannelState = this.channels[channelIndex];

                if (this.isAtStartOfTick) {
                    this.determineCurrentActiveTones(song, channelIndex, samplesPerTick, playSong && !this.countInMetronome);
                    this.determineLiveInputTones(song, channelIndex, samplesPerTick);
                }
                for (let instrumentIndex: number = 0; instrumentIndex < channel.instruments.length; instrumentIndex++) {
                    const instrument: Instrument = channel.instruments[instrumentIndex];
                    const instrumentState: InstrumentState = channelState.instruments[instrumentIndex];

                    if (this.isAtStartOfTick) {
                        let tonesPlayedInThisInstrument: number = instrumentState.activeTones.count() + instrumentState.liveInputTones.count();

                        for (let i: number = 0; i < instrumentState.releasedTones.count(); i++) {
                            const tone: Tone = instrumentState.releasedTones.get(i);
                            if (tone.ticksSinceReleased >= Math.abs(instrument.getFadeOutTicks())) {
                                this.freeReleasedTone(instrumentState, i);
                                i--;
                                continue;
                            }
                            const shouldFadeOutFast: boolean = (tonesPlayedInThisInstrument >= Config.maximumTonesPerChannel);
                            this.computeTone(song, channelIndex, samplesPerTick, tone, true, shouldFadeOutFast);
                            tonesPlayedInThisInstrument++;
                        }

                        if (instrumentState.awake) {
                            if (!instrumentState.computed) {
                                instrumentState.compute(this, instrument, samplesPerTick, Math.ceil(samplesPerTick), null, channelIndex, instrumentIndex);
                            }

                            instrumentState.computed = false;
                            instrumentState.envelopeComputer.clearEnvelopes();
                        }
                    }

                    for (let i: number = 0; i < instrumentState.activeTones.count(); i++) {
                        const tone: Tone = instrumentState.activeTones.get(i);
                        this.playTone(channelIndex, bufferIndex, runLength, tone);
                    }

                    for (let i: number = 0; i < instrumentState.liveInputTones.count(); i++) {
                        const tone: Tone = instrumentState.liveInputTones.get(i);
                        this.playTone(channelIndex, bufferIndex, runLength, tone);
                    }

                    for (let i: number = 0; i < instrumentState.releasedTones.count(); i++) {
                        const tone: Tone = instrumentState.releasedTones.get(i);
                        this.playTone(channelIndex, bufferIndex, runLength, tone);
                    }

                    if (instrumentState.awake) {
                        SynthProcessor.effectsSynth(this, outputDataL, outputDataR, bufferIndex, runLength, instrumentState);
                    }

                    // Update LFO time for instruments (used to be deterministic based on bar position but now vibrato/arp speed messes that up!)

                    const tickSampleCountdown: number = this.tickSampleCountdown;
                    const startRatio: number = 1.0 - (tickSampleCountdown) / samplesPerTick;
                    const endRatio: number = 1.0 - (tickSampleCountdown - runLength) / samplesPerTick;
                    const ticksIntoBar: number = (this.beat * Config.partsPerBeat + this.part) * Config.ticksPerPart + this.tick;
                    const partTimeTickStart: number = (ticksIntoBar) / Config.ticksPerPart;
                    const partTimeTickEnd: number = (ticksIntoBar + 1) / Config.ticksPerPart;
                    const partTimeStart: number = partTimeTickStart + (partTimeTickEnd - partTimeTickStart) * startRatio;
                    const partTimeEnd: number = partTimeTickStart + (partTimeTickEnd - partTimeTickStart) * endRatio;
                    let useVibratoSpeed: number = instrument.vibratoSpeed;

                    instrumentState.vibratoTime = instrumentState.nextVibratoTime;

                    //envelopeable vibrato speed?

                    if (this.isModActive(Config.modulators.dictionary["vibrato speed"].index, channelIndex, instrumentIndex)) {
                        useVibratoSpeed = this.getModValue(Config.modulators.dictionary["vibrato speed"].index, channelIndex, instrumentIndex);
                    }
                    useVibratoSpeed *= instrumentState.vibratoEnvelopeStart;

                    if (useVibratoSpeed == 0) {
                        instrumentState.vibratoTime = 0;
                        instrumentState.nextVibratoTime = 0;
                    }
                    else {
                        instrumentState.nextVibratoTime += useVibratoSpeed * 0.1 * (partTimeEnd - partTimeStart);
                    }
                }
            }

            if (this.enableMetronome || this.countInMetronome) {
                if (this.part == 0) {
                    if (!this.startedMetronome) {
                        const midBeat: boolean = (song.beatsPerBar > 4 && (song.beatsPerBar % 2 == 0) && this.beat == song.beatsPerBar / 2);
                        const periods: number = (this.beat == 0) ? 8 : midBeat ? 6 : 4;
                        const hz: number = (this.beat == 0) ? 1600 : midBeat ? 1200 : 800;
                        const amplitude: number = (this.beat == 0) ? 0.06 : midBeat ? 0.05 : 0.04;
                        const samplesPerPeriod: number = this.samplesPerSecond / hz;
                        const radiansPerSample: number = Math.PI * 2.0 / samplesPerPeriod;
                        this.metronomeSamplesRemaining = Math.floor(samplesPerPeriod * periods);
                        this.metronomeFilter = 2.0 * Math.cos(radiansPerSample);
                        this.metronomeAmplitude = amplitude * Math.sin(radiansPerSample);
                        this.metronomePrevAmplitude = 0.0;

                        this.startedMetronome = true;
                    }
                    if (this.metronomeSamplesRemaining > 0) {
                        const stopIndex: number = Math.min(runEnd, bufferIndex + this.metronomeSamplesRemaining);
                        this.metronomeSamplesRemaining -= stopIndex - bufferIndex;
                        for (let i: number = bufferIndex; i < stopIndex; i++) {
                            this.outputDataLUnfiltered![i] += this.metronomeAmplitude;
                            this.outputDataRUnfiltered![i] += this.metronomeAmplitude;
                            const tempAmplitude: number = this.metronomeFilter * this.metronomeAmplitude - this.metronomePrevAmplitude;
                            this.metronomePrevAmplitude = this.metronomeAmplitude;
                            this.metronomeAmplitude = tempAmplitude;
                        }
                    }
                } else {
                    this.startedMetronome = false;
                }
            }

            // Post processing:
            for (let i: number = bufferIndex; i < runEnd; i++) {
                //Song EQ
                {
                    let filtersL = this.songEqFiltersL;
                    let filtersR = this.songEqFiltersR;
                    const filterCount = this.songEqFilterCount | 0;
                    let initialFilterInput1L = +this.initialSongEqFilterInput1L;
                    let initialFilterInput2L = +this.initialSongEqFilterInput2L;
                    let initialFilterInput1R = +this.initialSongEqFilterInput1R;
                    let initialFilterInput2R = +this.initialSongEqFilterInput2R;
                    const applyFilters = SynthProcessor.applyFilters;
                    let eqFilterVolume = +this.songEqFilterVolume;
                    const eqFilterVolumeDelta = +this.songEqFilterVolumeDelta;
                    const inputSampleL = outputDataL[i];
                    let sampleL = inputSampleL;
                    sampleL = applyFilters(sampleL, initialFilterInput1L, initialFilterInput2L, filterCount, filtersL);
                    initialFilterInput2L = initialFilterInput1L;
                    initialFilterInput1L = inputSampleL;
                    sampleL *= eqFilterVolume;
                    outputDataL[i] = sampleL;
                    const inputSampleR = outputDataR[i];
                    let sampleR = inputSampleR;
                    sampleR = applyFilters(sampleR, initialFilterInput1R, initialFilterInput2R, filterCount, filtersR);
                    initialFilterInput2R = initialFilterInput1R;
                    initialFilterInput1R = inputSampleR;
                    sampleR *= eqFilterVolume;
                    outputDataR[i] = sampleR;
                    eqFilterVolume += eqFilterVolumeDelta;
                    this.sanitizeFilters(filtersL);
                    // The filter input here is downstream from another filter so we
                    // better make sure it's safe too.
                    if (!(initialFilterInput1L < 100) || !(initialFilterInput2L < 100)) {
                        initialFilterInput1L = 0.0;
                        initialFilterInput2L = 0.0;
                    }
                    if (Math.abs(initialFilterInput1L) < epsilon) initialFilterInput1L = 0.0;
                    if (Math.abs(initialFilterInput2L) < epsilon) initialFilterInput2L = 0.0;
                    this.initialSongEqFilterInput1L = initialFilterInput1L;
                    this.initialSongEqFilterInput2L = initialFilterInput2L;
                    this.sanitizeFilters(filtersR);
                    if (!(initialFilterInput1R < 100) || !(initialFilterInput2R < 100)) {
                        initialFilterInput1R = 0.0;
                        initialFilterInput2R = 0.0;
                    }
                    if (Math.abs(initialFilterInput1R) < epsilon) initialFilterInput1R = 0.0;
                    if (Math.abs(initialFilterInput2R) < epsilon) initialFilterInput2R = 0.0;
                    this.initialSongEqFilterInput1R = initialFilterInput1R;
                    this.initialSongEqFilterInput2R = initialFilterInput2R;
                }

                // A compressor/limiter.
                const sampleL = (outputDataL[i] + this.outputDataLUnfiltered![i]) * song.masterGain * song.masterGain;
                const sampleR = (outputDataR[i] + this.outputDataRUnfiltered![i]) * song.masterGain * song.masterGain;
                const absL: number = sampleL < 0.0 ? -sampleL : sampleL;
                const absR: number = sampleR < 0.0 ? -sampleR : sampleR;
                const abs: number = absL > absR ? absL : absR;
                this.song.inVolumeCap = (this.song.inVolumeCap > abs ? this.song.inVolumeCap : abs); // Analytics, spit out raw input volume
                // Determines which formula to use. 0 when volume is between [0, compressionThreshold], 1 when between (compressionThreshold, limitThreshold], 2 above
                const limitRange: number = (+(abs > song.compressionThreshold)) + (+(abs > song.limitThreshold));
                // Determine the target amplification based on the range of the curve
                const limitTarget: number =
                    (+(limitRange == 0)) * (((abs + 1 - song.compressionThreshold) * 0.8 + 0.25) * song.compressionRatio + 1.05 * (1 - song.compressionRatio))
                    + (+(limitRange == 1)) * (1.05)
                    + (+(limitRange == 2)) * (1.05 * ((abs + 1 - song.limitThreshold) * song.limitRatio + (1 - song.limitThreshold)));
                // Move the limit towards the target
                limit += ((limitTarget - limit) * (limit < limitTarget ? limitRise : limitDecay));
                const limitedVolume = volume / (limit >= 1 ? limit * 1.05 : limit * 0.8 + 0.25);
                outputDataL[i] = sampleL * limitedVolume;
                outputDataR[i] = sampleR * limitedVolume;

                this.song.outVolumeCap = (this.song.outVolumeCap > abs * limitedVolume ? this.song.outVolumeCap : abs * limitedVolume); // Analytics, spit out limited output volume
            }

            bufferIndex += runLength;

            this.isAtStartOfTick = false;
            this.tickSampleCountdown -= runLength;
            if (this.tickSampleCountdown <= 0) {
                this.isAtStartOfTick = true;

                // Track how long tones have been released, and free them if there are too many.
                // Also reset awake InstrumentStates that didn't have any Tones during this tick.
                for (const channelState of this.channels) {
                    for (const instrumentState of channelState.instruments) {
                        for (let i: number = 0; i < instrumentState.releasedTones.count(); i++) {
                            const tone: Tone = instrumentState.releasedTones.get(i);
                            if (tone.isOnLastTick) {
                                this.freeReleasedTone(instrumentState, i);
                                i--;
                            } else {
                                tone.ticksSinceReleased++;
                            }
                        }
                        if (instrumentState.deactivateAfterThisTick) {
                            instrumentState.deactivate();
                        }
                        instrumentState.tonesAddedInThisTick = false;
                    }
                }
                for (let channel: number = 0; channel < this.song.pitchChannelCount + this.song.noiseChannelCount; channel++) {
                    for (let instrumentIdx: number = 0; instrumentIdx < this.song.channels[channel].instruments.length; instrumentIdx++) {
                        let instrument: Instrument = this.song.channels[channel].instruments[instrumentIdx];
                        let instrumentState: InstrumentState = this.channels[channel].instruments[instrumentIdx];

                        const envelopeSpeeds: number[] = [];
                        for (let i: number = 0; i < Config.maxEnvelopeCount; i++) {
                            envelopeSpeeds[i] = 0;
                        }
                        for (let envelopeIndex: number = 0; envelopeIndex < instrument.envelopeCount; envelopeIndex++) {
                            let useEnvelopeSpeed: number = instrument.envelopeSpeed;
                            let perEnvelopeSpeed: number = instrument.envelopes[envelopeIndex].perEnvelopeSpeed;
                            if (this.isModActive(Config.modulators.dictionary["individual envelope speed"].index, channel, instrumentIdx) && instrument.envelopes[envelopeIndex].tempEnvelopeSpeed != null) {
                                perEnvelopeSpeed = instrument.envelopes[envelopeIndex].tempEnvelopeSpeed!;
                            }
                            if (this.isModActive(Config.modulators.dictionary["envelope speed"].index, channel, instrumentIdx)) {
                                useEnvelopeSpeed = Math.max(0, Math.min(Config.arpSpeedScale.length - 1, this.getModValue(Config.modulators.dictionary["envelope speed"].index, channel, instrumentIdx, false)));
                                if (Number.isInteger(useEnvelopeSpeed)) {
                                    instrumentState.envelopeTime[envelopeIndex] += Config.arpSpeedScale[useEnvelopeSpeed] * perEnvelopeSpeed;
                                } else {
                                    // Linear interpolate envelope values
                                    instrumentState.envelopeTime[envelopeIndex] += ((1 - (useEnvelopeSpeed % 1)) * Config.arpSpeedScale[Math.floor(useEnvelopeSpeed)] + (useEnvelopeSpeed % 1) * Config.arpSpeedScale[Math.ceil(useEnvelopeSpeed)]) * perEnvelopeSpeed;
                                }
                            }
                            else {
                                instrumentState.envelopeTime[envelopeIndex] += Config.arpSpeedScale[useEnvelopeSpeed] * perEnvelopeSpeed;
                            }
                        }

                        // Update arpeggio time, which is used to calculate arpeggio position

                        const arpEnvelopeStart: number = instrumentState.arpEnvelopeStart; //only discrete for now
                        let useArpeggioSpeed: number = instrument.arpeggioSpeed;
                        if (this.isModActive(Config.modulators.dictionary["arp speed"].index, channel, instrumentIdx)) {
                            useArpeggioSpeed = clamp(0, Config.arpSpeedScale.length, arpEnvelopeStart * this.getModValue(Config.modulators.dictionary["arp speed"].index, channel, instrumentIdx, false));
                            if (Number.isInteger(useArpeggioSpeed)) {
                                instrumentState.arpTime += Config.arpSpeedScale[useArpeggioSpeed];
                            } else {
                                // Linear interpolate arpeggio values
                                instrumentState.arpTime += (1 - (useArpeggioSpeed % 1)) * Config.arpSpeedScale[Math.floor(useArpeggioSpeed)] + (useArpeggioSpeed % 1) * Config.arpSpeedScale[Math.ceil(useArpeggioSpeed)];
                            }
                        }
                        else {
                            useArpeggioSpeed = clamp(0, Config.arpSpeedScale.length, arpEnvelopeStart * useArpeggioSpeed);
                            if (Number.isInteger(useArpeggioSpeed)) {
                                instrumentState.arpTime += Config.arpSpeedScale[useArpeggioSpeed];
                            } else {
                                // Linear interpolate arpeggio values
                                instrumentState.arpTime += (1 - (useArpeggioSpeed % 1)) * Config.arpSpeedScale[Math.floor(useArpeggioSpeed)] + (useArpeggioSpeed % 1) * Config.arpSpeedScale[Math.ceil(useArpeggioSpeed)];
                            }
                        }

                    }
                }

                // Update next-used filters after each run
                for (let channel: number = 0; channel < this.song.pitchChannelCount + this.song.noiseChannelCount; channel++) {
                    for (let instrumentIdx: number = 0; instrumentIdx < this.song.channels[channel].instruments.length; instrumentIdx++) {
                        let instrument: Instrument = this.song.channels[channel].instruments[instrumentIdx];
                        if (instrument.tmpEqFilterEnd != null) {
                            instrument.tmpEqFilterStart = instrument.tmpEqFilterEnd;
                        } else {
                            instrument.tmpEqFilterStart = instrument.eqFilter;
                        }
                        if (instrument.tmpNoteFilterEnd != null) {
                            instrument.tmpNoteFilterStart = instrument.tmpNoteFilterEnd;
                        } else {
                            instrument.tmpNoteFilterStart = instrument.noteFilter;
                        }
                    }
                }
                if (song.tmpEqFilterEnd != null) {
                    song.tmpEqFilterStart = song.tmpEqFilterEnd;
                } else {
                    song.tmpEqFilterStart = song.eqFilter;
                }

                this.tick++;
                this.tickSampleCountdown += samplesPerTick;
                if (this.tick == Config.ticksPerPart) {
                    this.tick = 0;
                    this.part++;
                    this.liveInputValues[LiveInputValues.liveInputDuration]--;
                    this.liveInputValues[LiveInputValues.liveBassInputDuration]--;
                    // Decrement held modulator counters after each run
                    for (let i: number = 0; i < this.heldMods.length; i++) {
                        this.heldMods[i].holdFor--;
                        if (this.heldMods[i].holdFor <= 0) {
                            this.heldMods.splice(i, 1);
                        }
                    }

                    if (this.part == Config.partsPerBeat) {
                        this.part = 0;

                        if (playSong) {
                            this.beat++;
                            if (this.beat == song.beatsPerBar) {
                                // bar changed, reset for next bar:
                                this.beat = 0;

                                if (this.countInMetronome) {
                                    this.countInMetronome = false;
                                } else {
                                    this.prevBar = this.bar;
                                    this.bar = this.getNextBar();
                                    if (this.bar <= this.prevBar && this.loopRepeatCount > 0) this.loopRepeatCount--;

                                    if (this.bar >= song.barCount) {
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

            // Update mod values so that next values copy to current values
            for (let setting: number = 0; setting < Config.modulators.length; setting++) {
                if (this.nextModValues != null && this.nextModValues[setting] != null)
                    this.modValues[setting] = this.nextModValues[setting];
            }

            // Set samples per tick if song tempo mods changed it
            if (this.isModActive(Config.modulators.dictionary["tempo"].index)) {
                samplesPerTick = this.getSamplesPerTick();
                this.tickSampleCountdown = Math.min(this.tickSampleCountdown, samplesPerTick);
            }

            // Bound LFO times to be within their period (to keep values from getting large)
            // I figured this modulo math probably doesn't have to happen every LFO tick.
            for (let channelIndex: number = 0; channelIndex < this.song.pitchChannelCount + this.song.noiseChannelCount; channelIndex++) {
                for (let instrumentIndex = 0; instrumentIndex < this.channels[channelIndex].instruments.length; instrumentIndex++) {
                    const instrumentState: InstrumentState = this.channels[channelIndex].instruments[instrumentIndex];
                    const instrument: Instrument = this.song.channels[channelIndex].instruments[instrumentIndex];
                    instrumentState.nextVibratoTime = (instrumentState.nextVibratoTime % (Config.vibratoTypes[instrument.vibratoType].period / (Config.ticksPerPart * samplesPerTick / this.samplesPerSecond)));
                    instrumentState.arpTime = (instrumentState.arpTime % (2520 * Config.ticksPerArpeggio)); // 2520 = LCM of 4, 5, 6, 7, 8, 9 (arp sizes)
                    for (let envelopeIndex: number = 0; envelopeIndex < instrument.envelopeCount; envelopeIndex++) {
                        instrumentState.envelopeTime[envelopeIndex] = (instrumentState.envelopeTime[envelopeIndex] % (Config.partsPerBeat * Config.ticksPerPart * this.song.beatsPerBar));
                    }
                }
            }

            const maxInstrumentsPerChannel = this.song.getMaxInstrumentsPerChannel();
            for (let setting: number = 0; setting < Config.modulators.length; setting++) {
                for (let channel: number = 0; channel < this.song.pitchChannelCount + this.song.noiseChannelCount; channel++) {
                    for (let instrument: number = 0; instrument < maxInstrumentsPerChannel; instrument++) {
                        if (this.nextModInsValues != null && this.nextModInsValues[channel] != null && this.nextModInsValues[channel][instrument] != null && this.nextModInsValues[channel][instrument][setting] != null) {
                            this.modInsValues[channel][instrument][setting] = this.nextModInsValues[channel][instrument][setting];
                        }
                    }
                }
            }
        }

        // Optimization: Avoid persistent reverb values in the float denormal range.
        if (!Number.isFinite(limit) || Math.abs(limit) < epsilon) limit = 0.0;
        this.limit = limit;

        if (playSong && !this.countInMetronome) {
            const playheadMessage: SongPositionMessage = {
                flag: MessageFlag.songPosition,
                bar: this.bar,
                beat: this.beat,
                part: this.part,
            }
            this.sendMessage(playheadMessage);
        }
    }

    private freeTone(tone: Tone): void {
        this.tonePool.pushBack(tone);
    }

    private newTone(): Tone {
        if (this.tonePool.count() > 0) {
            const tone: Tone = this.tonePool.popBack();
            tone.freshlyAllocated = true;
            return tone;
        }
        return new Tone();
    }

    private releaseTone(instrumentState: InstrumentState, tone: Tone): void {
        instrumentState.releasedTones.pushFront(tone);
        tone.atNoteStart = false;
        tone.passedEndOfNote = true;
    }

    private freeReleasedTone(instrumentState: InstrumentState, toneIndex: number): void {
        this.freeTone(instrumentState.releasedTones.get(toneIndex));
        instrumentState.releasedTones.remove(toneIndex);
    }

    public freeAllTones(): void {
        for (const channelState of this.channels) {
            for (const instrumentState of channelState.instruments) {
                while (instrumentState.activeTones.count() > 0) this.freeTone(instrumentState.activeTones.popBack());
                while (instrumentState.activeModTones.count() > 0) this.freeTone(instrumentState.activeModTones.popBack());
                while (instrumentState.releasedTones.count() > 0) this.freeTone(instrumentState.releasedTones.popBack());
                while (instrumentState.liveInputTones.count() > 0) this.freeTone(instrumentState.liveInputTones.popBack());
            }
        }
    }

    private dequeueLivePitches() {
        const queuedTones: number = this.liveInputPitchesOnOffRequests.availableRead();
        if (queuedTones > 0) {
            const vals: Uint16Array = new Uint16Array(queuedTones)
            this.liveInputPitchesOnOffRequests.pop(vals, queuedTones)
            for (let i: number = 0; i < queuedTones; i++) {
                let val: number = vals[i];
                const isBass: boolean = Boolean(val & 1); val = val >> 1;
                const turnOn: boolean = Boolean(val & 1); val = val >> 1;
                const pitch: number = val;
                if (!isBass) {
                    if (turnOn) {
                        this.liveInputPitches.add(pitch);
                    } else {
                        this.liveInputPitches.delete(pitch);
                    }
                } else {
                    if (turnOn) {
                        this.liveBassInputPitches.add(pitch);
                    } else {
                        this.liveBassInputPitches.delete(pitch);
                    }
                }
            }
        }
    }

    private determineLiveInputTones(song: Song, channelIndex: number, samplesPerTick: number): void {
        const channel: Channel = song.channels[channelIndex];
        const channelState: ChannelState = this.channels[channelIndex];
        const pitches: BeepboxSet = this.liveInputPitches;
        const bassPitches: BeepboxSet = this.liveBassInputPitches;

        for (let instrumentIndex: number = 0; instrumentIndex < channel.instruments.length; instrumentIndex++) {
            const instrumentState: InstrumentState = channelState.instruments[instrumentIndex];
            const toneList: Deque<Tone> = instrumentState.liveInputTones;
            let toneCount: number = 0;

            const instrument: Instrument = channel.instruments[instrumentIndex];
            let filteredPitches: BeepboxSet = pitches;
            if (effectsIncludeNoteRange(instrument.effects)) filteredPitches = pitches.filter(pitch => pitch >= instrument.lowerNoteLimit && pitch <= instrument.upperNoteLimit);
            let filteredBassPitches: BeepboxSet = bassPitches;
            if (effectsIncludeNoteRange(instrument.effects)) filteredBassPitches = bassPitches.filter(pitch => pitch >= instrument.lowerNoteLimit && pitch <= instrument.upperNoteLimit);

            const pattern: Pattern | null = song.getPattern(channelIndex, this.bar);
            if (this.liveInputValues[LiveInputValues.liveInputDuration] > 0 && (channelIndex == this.liveInputValues[LiveInputValues.liveInputChannel]) && pitches.size > 0 && pattern?.instruments.indexOf(instrumentIndex) != -1) {
                const instrument: Instrument = channel.instruments[instrumentIndex];

                if (instrument.getChord().singleTone) {
                    let tone: Tone;
                    if (toneList.count() <= toneCount) {
                        tone = this.newTone();
                        toneList.pushBack(tone);
                    } else if (!instrument.getTransition().isSeamless && this.liveInputValues[LiveInputValues.liveBassInputStarted]) {
                        this.releaseTone(instrumentState, toneList.get(toneCount));
                        tone = this.newTone();
                        toneList.set(toneCount, tone);
                    } else {
                        tone = toneList.get(toneCount);
                    }
                    toneCount++;

                    tone.pitches = filteredPitches.getArray();

                    tone.pitchCount = filteredPitches.size;
                    tone.chordSize = 1;
                    tone.instrumentIndex = instrumentIndex;
                    tone.note = tone.prevNote = tone.nextNote = null;
                    tone.atNoteStart = Boolean(this.liveInputValues[LiveInputValues.liveInputStarted]);
                    tone.forceContinueAtStart = false;
                    tone.forceContinueAtEnd = false;
                    this.computeTone(song, channelIndex, samplesPerTick, tone, false, false);
                } else {
                    //const transition: Transition = instrument.getTransition();

                    this.moveTonesIntoOrderedTempMatchedList(toneList, filteredPitches);

                    for (let i: number = 0; i < filteredPitches.size; i++) {
                        //const strumOffsetParts: number = i * instrument.getChord().strumParts;

                        let tone: Tone;
                        if (this.tempMatchedPitchTones[toneCount] != null) {
                            tone = this.tempMatchedPitchTones[toneCount]!;
                            this.tempMatchedPitchTones[toneCount] = null;
                            if (tone.pitchCount != 1 || !filteredPitches.has(tone.pitches[0])) {
                                this.releaseTone(instrumentState, tone);
                                tone = this.newTone();
                            }
                            toneList.pushBack(tone);
                        } else {
                            tone = this.newTone();
                            toneList.pushBack(tone);
                        }
                        toneCount++;

                        const pitch: number | undefined = filteredPitches.grab();
                        if (pitch !== undefined) tone.pitches[0] = pitch;
                        tone.pitchCount = 1;
                        tone.chordSize = filteredPitches.size;
                        tone.instrumentIndex = instrumentIndex;
                        tone.note = tone.prevNote = tone.nextNote = null;
                        tone.atNoteStart = Boolean(this.liveInputValues[LiveInputValues.liveInputStarted]);
                        tone.forceContinueAtStart = false;
                        tone.forceContinueAtEnd = false;
                        this.computeTone(song, channelIndex, samplesPerTick, tone, false, false);
                    }
                }
            }

            if (this.liveInputValues[LiveInputValues.liveBassInputDuration] > 0 && (channelIndex == this.liveInputValues[LiveInputValues.liveBassInputChannel]) && bassPitches.size > 0 && pattern?.instruments.indexOf(instrumentIndex) != -1) {
                const instrument: Instrument = channel.instruments[instrumentIndex];

                if (instrument.getChord().singleTone) {
                    let tone: Tone;
                    if (toneList.count() <= toneCount) {
                        tone = this.newTone();
                        toneList.pushBack(tone);
                    } else if (!instrument.getTransition().isSeamless && this.liveInputValues[LiveInputValues.liveBassInputStarted]) {
                        this.releaseTone(instrumentState, toneList.get(toneCount));
                        tone = this.newTone();
                        toneList.set(toneCount, tone);
                    } else {
                        tone = toneList.get(toneCount);
                    }
                    toneCount++;

                    tone.pitches = filteredBassPitches.getArray();
                    tone.pitchCount = filteredBassPitches.size;
                    tone.chordSize = 1;
                    tone.instrumentIndex = instrumentIndex;
                    tone.note = tone.prevNote = tone.nextNote = null;
                    tone.atNoteStart = Boolean(this.liveInputValues[LiveInputValues.liveBassInputStarted]);
                    tone.forceContinueAtStart = false;
                    tone.forceContinueAtEnd = false;
                    this.computeTone(song, channelIndex, samplesPerTick, tone, false, false);
                } else {
                    //const transition: Transition = instrument.getTransition();

                    this.moveTonesIntoOrderedTempMatchedList(toneList, filteredBassPitches);

                    for (let i: number = 0; i < filteredBassPitches.size; i++) {
                        //const strumOffsetParts: number = i * instrument.getChord().strumParts;

                        let tone: Tone;
                        if (this.tempMatchedPitchTones[toneCount] != null) {
                            tone = this.tempMatchedPitchTones[toneCount]!;
                            this.tempMatchedPitchTones[toneCount] = null;
                            if (tone.pitchCount != 1 || !filteredBassPitches.has(tone.pitches[0])) {
                                this.releaseTone(instrumentState, tone);
                                tone = this.newTone();
                            }
                            toneList.pushBack(tone);
                        } else {
                            tone = this.newTone();
                            toneList.pushBack(tone);
                        }
                        toneCount++;

                        const pitch: number | undefined = filteredBassPitches.grab();
                        if (pitch) tone.pitches[0] = pitch;
                        tone.pitchCount = 1;
                        tone.chordSize = filteredBassPitches.size;
                        tone.instrumentIndex = instrumentIndex;
                        tone.note = tone.prevNote = tone.nextNote = null;
                        tone.atNoteStart = Boolean(this.liveInputValues[LiveInputValues.liveBassInputStarted]);
                        tone.forceContinueAtStart = false;
                        tone.forceContinueAtEnd = false;
                        this.computeTone(song, channelIndex, samplesPerTick, tone, false, false);
                    }
                }
            }

            while (toneList.count() > toneCount) {
                this.releaseTone(instrumentState, toneList.popBack());
            }

            this.clearTempMatchedPitchTones(toneCount, instrumentState);
        }

        this.liveInputValues[LiveInputValues.liveInputStarted] = 0;
        this.liveInputValues[LiveInputValues.liveBassInputStarted] = 0;

        if (this.liveInputValues[LiveInputValues.liveInputDuration] <= 0) {
            this.liveInputPitches.clear();
        }

        if (this.liveInputValues[LiveInputValues.liveBassInputDuration] <= 0) {
            this.liveBassInputPitches.clear();
        }
    }

    // Returns the chord type of the instrument in the adjacent pattern if it is compatible for a
    // seamless transition across patterns, otherwise returns null.
    private adjacentPatternHasCompatibleInstrumentTransition(song: Song, channel: Channel, pattern: Pattern, otherPattern: Pattern, instrumentIndex: number, transition: Transition, chord: Chord, note: Note, otherNote: Note, forceContinue: boolean): Chord | null {
        if (song.patternInstruments && otherPattern.instruments.indexOf(instrumentIndex) == -1) {
            // The adjacent pattern does not contain the same instrument as the current pattern.

            if (pattern.instruments.length > 1 || otherPattern.instruments.length > 1) {
                // The current or adjacent pattern contains more than one instrument, don't bother
                // trying to connect them.
                return null;
            }
            // Otherwise, the two patterns each contain one instrument, but not the same instrument.
            // Try to connect them.
            const otherInstrument: Instrument = channel.instruments[otherPattern.instruments[0]];

            if (forceContinue) {
                // Even non-seamless instruments can be connected across patterns if forced.
                return otherInstrument.getChord();
            }

            // Otherwise, check that both instruments are seamless across patterns.
            const otherTransition: Transition = otherInstrument.getTransition();
            if (transition.includeAdjacentPatterns && otherTransition.includeAdjacentPatterns && otherTransition.slides == transition.slides) {
                return otherInstrument.getChord();
            } else {
                return null;
            }
        } else {
            // If both patterns contain the same instrument, check that it is seamless across patterns.
            return (forceContinue || transition.includeAdjacentPatterns) ? chord : null;
        }
    }

    public static adjacentNotesHaveMatchingPitches(firstNote: Note, secondNote: Note): boolean {
        if (firstNote.pitches.length != secondNote.pitches.length) return false;
        const firstNoteInterval: number = firstNote.pins[firstNote.pins.length - 1].interval;
        for (const pitch of firstNote.pitches) {
            if (secondNote.pitches.indexOf(pitch + firstNoteInterval) == -1) return false;
        }
        return true;
    }
    /**
     * The tones are about to seamlessly transition to a new note. The pitches
     * from the old note may or may not match any of the pitches in the new
     * note, and not necessarily in order, but if any do match, they'll sound
     * better if those tones continue to have the same pitch. Attempt to find
     * the right spot for each old tone in the new chord if possible.
     * @param toneList The deque of old tones
     * @param notePitches The ordered array of new pitches
     */
    private moveTonesIntoOrderedTempMatchedList(toneList: Deque<Tone>, notePitches: BeepboxSet | number[]): void {
        if (!(notePitches instanceof BeepboxSet)) {
            for (let i: number = 0; i < toneList.count(); i++) {
                const tone: Tone = toneList.get(i);
                const pitch: number = tone.pitches[0] + tone.lastInterval;
                for (let j: number = 0; j < notePitches.length; j++) {
                    if (notePitches[j] == pitch) {
                        this.tempMatchedPitchTones[j] = tone;
                        toneList.remove(i);
                        i--;
                        break;
                    }
                }
            }
        }

        // Any tones that didn't get matched should just fill in the gaps.
        let tonesPushed: number = 0;
        while (toneList.count() > 0) {
            const tone: Tone = toneList.popFront();
            for (let j: number = tonesPushed; j < this.tempMatchedPitchTones.length; j++) {
                if (this.tempMatchedPitchTones[j] == null) {
                    this.tempMatchedPitchTones[j] = tone;
                    tonesPushed++;
                    break;
                } else {
                    tonesPushed++;
                }
            }
        }
    }

    private determineCurrentActiveTones(song: Song, channelIndex: number, samplesPerTick: number, playSong: boolean): void {
        const channel: Channel = song.channels[channelIndex];
        const channelState: ChannelState = this.channels[channelIndex];
        const pattern: Pattern | null = song.getPattern(channelIndex, this.bar);
        const currentPart: number = this.getCurrentPart();
        const currentTick: number = this.tick + Config.ticksPerPart * currentPart;

        if (playSong && song.getChannelIsMod(channelIndex)) {

            // For mod channels, notes aren't strictly arranged chronologically. Also, each pitch value could play or not play at a given time. So... a bit more computation involved!
            // The same transition logic should apply though, even though it isn't really used by mod channels.
            let notes: (Note | null)[] = [];
            let prevNotes: (Note | null)[] = [];
            let nextNotes: (Note | null)[] = [];
            let fillCount: number = Config.modCount;
            while (fillCount--) {
                notes.push(null);
                prevNotes.push(null);
                nextNotes.push(null);
            }

            if (pattern != null && !channel.muted) {
                for (let i: number = 0; i < pattern.notes.length; i++) {
                    if (pattern.notes[i].end <= currentPart) {
                        // Actually need to check which note starts closer to the start of this note.
                        if (prevNotes[pattern.notes[i].pitches[0]] == null || pattern.notes[i].end > (prevNotes[pattern.notes[i].pitches[0]] as Note).start) {
                            prevNotes[pattern.notes[i].pitches[0]] = pattern.notes[i];
                        }
                    }
                    else if (pattern.notes[i].start <= currentPart && pattern.notes[i].end > currentPart) {
                        notes[pattern.notes[i].pitches[0]] = pattern.notes[i];
                    }
                    else if (pattern.notes[i].start > currentPart) {
                        // Actually need to check which note starts closer to the end of this note.
                        if (nextNotes[pattern.notes[i].pitches[0]] == null || pattern.notes[i].start < (nextNotes[pattern.notes[i].pitches[0]] as Note).start) {
                            nextNotes[pattern.notes[i].pitches[0]] = pattern.notes[i];
                        }
                    }
                }
            }

            let modToneCount: number = 0;
            const newInstrumentIndex: number = (song.patternInstruments && (pattern != null)) ? pattern!.instruments[0] : 0;
            const instrumentState: InstrumentState = channelState.instruments[newInstrumentIndex];
            const toneList: Deque<Tone> = instrumentState.activeModTones;
            for (let mod: number = 0; mod < Config.modCount; mod++) {
                if (notes[mod] != null) {
                    if (prevNotes[mod] != null && (prevNotes[mod] as Note).end != (notes[mod] as Note).start) prevNotes[mod] = null;
                    if (nextNotes[mod] != null && (nextNotes[mod] as Note).start != (notes[mod] as Note).end) nextNotes[mod] = null;

                }

                if (channelState.singleSeamlessInstrument != null && channelState.singleSeamlessInstrument != newInstrumentIndex && channelState.singleSeamlessInstrument < channelState.instruments.length) {
                    const sourceInstrumentState: InstrumentState = channelState.instruments[channelState.singleSeamlessInstrument];
                    const destInstrumentState: InstrumentState = channelState.instruments[newInstrumentIndex];
                    while (sourceInstrumentState.activeModTones.count() > 0) {
                        destInstrumentState.activeModTones.pushFront(sourceInstrumentState.activeModTones.popBack());
                    }
                }
                channelState.singleSeamlessInstrument = newInstrumentIndex;

                if (notes[mod] != null) {
                    let prevNoteForThisInstrument: Note | null = prevNotes[mod];
                    let nextNoteForThisInstrument: Note | null = nextNotes[mod];

                    let forceContinueAtStart: boolean = false;
                    let forceContinueAtEnd: boolean = false;
                    const atNoteStart: boolean = (Config.ticksPerPart * notes[mod]!.start == currentTick) && this.isAtStartOfTick;
                    let tone: Tone;
                    if (toneList.count() <= modToneCount) {
                        tone = this.newTone();
                        toneList.pushBack(tone);
                    } else if (atNoteStart && (prevNoteForThisInstrument == null)) {
                        const oldTone: Tone = toneList.get(modToneCount);
                        if (oldTone.isOnLastTick) {
                            this.freeTone(oldTone);
                        } else {
                            this.releaseTone(instrumentState, oldTone);
                        }
                        tone = this.newTone();
                        toneList.set(modToneCount, tone);
                    } else {
                        tone = toneList.get(modToneCount);
                    }
                    modToneCount++;

                    for (let i: number = 0; i < notes[mod]!.pitches.length; i++) {
                        tone.pitches[i] = notes[mod]!.pitches[i];
                    }
                    tone.pitchCount = notes[mod]!.pitches.length;
                    tone.chordSize = 1;
                    tone.instrumentIndex = newInstrumentIndex;
                    tone.note = notes[mod];
                    tone.noteStartPart = notes[mod]!.start;
                    tone.noteEndPart = notes[mod]!.end;
                    tone.prevNote = prevNoteForThisInstrument;
                    tone.nextNote = nextNoteForThisInstrument;
                    tone.prevNotePitchIndex = 0;
                    tone.nextNotePitchIndex = 0;
                    tone.atNoteStart = atNoteStart;
                    tone.passedEndOfNote = false;
                    tone.forceContinueAtStart = forceContinueAtStart;
                    tone.forceContinueAtEnd = forceContinueAtEnd;
                }
            }
            // Automatically free or release seamless tones if there's no new note to take over.
            while (toneList.count() > modToneCount) {
                const tone: Tone = toneList.popBack();
                const channel: Channel = song.channels[channelIndex];
                if (tone.instrumentIndex < channel.instruments.length && !tone.isOnLastTick) {
                    const instrumentState: InstrumentState = this.channels[channelIndex].instruments[tone.instrumentIndex];
                    this.releaseTone(instrumentState, tone);
                } else {
                    this.freeTone(tone);
                }
            }

        } else if (!song.getChannelIsMod(channelIndex)) {

            let note: Note | null = null;
            let prevNote: Note | null = null;
            let nextNote: Note | null = null;

            if (playSong && pattern != null && !channel.muted && (!this.isRecording || this.liveInputValues[LiveInputValues.liveInputChannel] != channelIndex)) {
                for (let i: number = 0; i < pattern.notes.length; i++) {
                    if (pattern.notes[i].end <= currentPart) {
                        prevNote = pattern.notes[i];
                    } else if (pattern.notes[i].start <= currentPart && pattern.notes[i].end > currentPart) {
                        note = pattern.notes[i];
                    } else if (pattern.notes[i].start > currentPart) {
                        nextNote = pattern.notes[i];
                        break;
                    }
                }

                if (note != null) {
                    if (prevNote != null && prevNote.end != note.start) prevNote = null;
                    if (nextNote != null && nextNote.start != note.end) nextNote = null;
                }
            }

            // Seamless tones from a pattern with a single instrument can be transferred to a different single seamless instrument in the next pattern.
            if (pattern != null && (!song.layeredInstruments || channel.instruments.length == 1 || (song.patternInstruments && pattern.instruments.length == 1))) {
                const newInstrumentIndex: number = song.patternInstruments ? pattern.instruments[0] : 0;
                if (channelState.singleSeamlessInstrument != null && channelState.singleSeamlessInstrument != newInstrumentIndex && channelState.singleSeamlessInstrument < channelState.instruments.length) {
                    const sourceInstrumentState: InstrumentState = channelState.instruments[channelState.singleSeamlessInstrument];
                    const destInstrumentState: InstrumentState = channelState.instruments[newInstrumentIndex];
                    while (sourceInstrumentState.activeTones.count() > 0) {
                        destInstrumentState.activeTones.pushFront(sourceInstrumentState.activeTones.popBack());
                    }
                }
                channelState.singleSeamlessInstrument = newInstrumentIndex;
            } else {
                channelState.singleSeamlessInstrument = null;
            }

            for (let instrumentIndex: number = 0; instrumentIndex < channel.instruments.length; instrumentIndex++) {
                const instrumentState: InstrumentState = channelState.instruments[instrumentIndex];
                const toneList: Deque<Tone> = instrumentState.activeTones;
                let toneCount: number = 0;
                if ((note != null) && (!song.patternInstruments || (pattern!.instruments.indexOf(instrumentIndex) != -1))) {
                    const instrument: Instrument = channel.instruments[instrumentIndex];
                    let prevNoteForThisInstrument: Note | null = prevNote;
                    let nextNoteForThisInstrument: Note | null = nextNote;

                    const partsPerBar: Number = Config.partsPerBeat * song.beatsPerBar;
                    const transition: Transition = instrument.getTransition();
                    const chord: Chord = instrument.getChord();
                    const useStrumSpeed: boolean = chord.strumParts > 0;
                    let forceContinueAtStart: boolean = false;
                    let forceContinueAtEnd: boolean = false;
                    let tonesInPrevNote: number = 0;
                    let tonesInNextNote: number = 0;
                    if (note.start == 0) {
                        // If the beginning of the note coincides with the beginning of the pattern,
                        let prevPattern: Pattern | null = (this.prevBar == null) ? null : song.getPattern(channelIndex, this.prevBar);
                        if (prevPattern != null) {
                            const lastNote: Note | null = (prevPattern.notes.length <= 0) ? null : prevPattern.notes[prevPattern.notes.length - 1];
                            if (lastNote != null && lastNote.end == partsPerBar) {
                                const patternForcesContinueAtStart: boolean = note.continuesLastPattern && SynthProcessor.adjacentNotesHaveMatchingPitches(lastNote, note);
                                const chordOfCompatibleInstrument: Chord | null = this.adjacentPatternHasCompatibleInstrumentTransition(song, channel, pattern!, prevPattern, instrumentIndex, transition, chord, note, lastNote, patternForcesContinueAtStart);
                                if (chordOfCompatibleInstrument != null) {
                                    prevNoteForThisInstrument = lastNote;
                                    let prevPitchesForThisInstrument: number[] = prevNoteForThisInstrument.pitches;
                                    // @TODO: This may or may not be needed, I'm not entirely sure yet...
                                    // if (effectsIncludeNoteRange(instrument.effects)) prevPitchesForThisInstrument = prevPitchesForThisInstrument.filter(pitch => pitch >= instrument.lowerNoteLimit && pitch <= instrument.upperNoteLimit);
                                    tonesInPrevNote = chordOfCompatibleInstrument.singleTone ? 1 : prevPitchesForThisInstrument.length;
                                    forceContinueAtStart = patternForcesContinueAtStart;
                                }
                            }
                        }
                    } else if (prevNoteForThisInstrument != null) {
                        let prevPitchesForThisInstrument: number[] = prevNoteForThisInstrument.pitches;
                        // @TODO: This may or may not be needed, I'm not entirely sure yet...
                        // if (effectsIncludeNoteRange(instrument.effects)) prevPitchesForThisInstrument = prevPitchesForThisInstrument.filter(pitch => pitch >= instrument.lowerNoteLimit && pitch <= instrument.upperNoteLimit);
                        tonesInPrevNote = chord.singleTone ? 1 : prevPitchesForThisInstrument.length
                    }
                    if (note.end == partsPerBar) {
                        // If the end of the note coincides with the end of the pattern, look for an
                        // adjacent note at the beginning of the next pattern.
                        let nextPattern: Pattern | null = (this.nextBar == null) ? null : song.getPattern(channelIndex, this.nextBar);
                        if (nextPattern != null) {
                            const firstNote: Note | null = (nextPattern.notes.length <= 0) ? null : nextPattern.notes[0];
                            if (firstNote != null && firstNote.start == 0) {
                                const nextPatternForcesContinueAtStart: boolean = firstNote.continuesLastPattern && SynthProcessor.adjacentNotesHaveMatchingPitches(note, firstNote);
                                const chordOfCompatibleInstrument: Chord | null = this.adjacentPatternHasCompatibleInstrumentTransition(song, channel, pattern!, nextPattern, instrumentIndex, transition, chord, note, firstNote, nextPatternForcesContinueAtStart);
                                if (chordOfCompatibleInstrument != null) {
                                    nextNoteForThisInstrument = firstNote;
                                    let nextPitchesForThisInstrument: number[] = nextNoteForThisInstrument.pitches;
                                    // @TODO: This may or may not be needed, I'm not entirely sure yet...
                                    // if (effectsIncludeNoteRange(instrument.effects)) nextPitchesForThisInstrument = nextPitchesForThisInstrument.filter(pitch => pitch >= instrument.lowerNoteLimit && pitch <= instrument.upperNoteLimit);
                                    tonesInNextNote = chordOfCompatibleInstrument.singleTone ? 1 : nextPitchesForThisInstrument.length;
                                    forceContinueAtEnd = nextPatternForcesContinueAtStart;
                                }
                            }
                        }
                    } else if (nextNoteForThisInstrument != null) {
                        let nextPitchesForThisInstrument: number[] = nextNoteForThisInstrument.pitches;
                        // @TODO: This may or may not be needed, I'm not entirely sure yet...
                        // if (effectsIncludeNoteRange(instrument.effects)) nextPitchesForThisInstrument = nextPitchesForThisInstrument.filter(pitch => pitch >= instrument.lowerNoteLimit && pitch <= instrument.upperNoteLimit);
                        tonesInNextNote = chord.singleTone ? 1 : nextPitchesForThisInstrument.length;
                    }

                    let filteredPitches: number[] = note.pitches;
                    if (effectsIncludeNoteRange(instrument.effects)) filteredPitches = note.pitches.filter(pitch => pitch >= instrument.lowerNoteLimit && pitch <= instrument.upperNoteLimit);
                    if (chord.singleTone && filteredPitches.length > 0) {
                        const atNoteStart: boolean = (Config.ticksPerPart * note.start == currentTick);
                        let tone: Tone;
                        if (toneList.count() <= toneCount) {
                            tone = this.newTone();
                            toneList.pushBack(tone);
                        } else if (atNoteStart && ((!(transition.isSeamless || instrument.clicklessTransition) && !forceContinueAtStart) || prevNoteForThisInstrument == null)) {
                            const oldTone: Tone = toneList.get(toneCount);
                            if (oldTone.isOnLastTick) {
                                this.freeTone(oldTone);
                            } else {
                                this.releaseTone(instrumentState, oldTone);
                            }
                            tone = this.newTone();
                            toneList.set(toneCount, tone);
                        } else {
                            tone = toneList.get(toneCount);
                        }
                        toneCount++;

                        for (let i: number = 0; i < filteredPitches.length; i++) {
                            tone.pitches[i] = filteredPitches[i];
                        }
                        tone.pitchCount = filteredPitches.length;
                        tone.chordSize = 1;
                        tone.instrumentIndex = instrumentIndex;
                        tone.note = note;
                        tone.noteStartPart = note.start;
                        tone.noteEndPart = note.end;
                        tone.prevNote = prevNoteForThisInstrument;
                        tone.nextNote = nextNoteForThisInstrument;
                        tone.prevNotePitchIndex = 0;
                        tone.nextNotePitchIndex = 0;
                        tone.atNoteStart = atNoteStart;
                        tone.passedEndOfNote = false;
                        tone.forceContinueAtStart = forceContinueAtStart;
                        tone.forceContinueAtEnd = forceContinueAtEnd;
                        this.computeTone(song, channelIndex, samplesPerTick, tone, false, false);
                    } else {
                        const transition: Transition = instrument.getTransition();

                        if (((transition.isSeamless && !transition.slides && chord.strumParts == 0) || forceContinueAtStart) && (Config.ticksPerPart * note.start == currentTick) && prevNoteForThisInstrument != null) {
                            this.moveTonesIntoOrderedTempMatchedList(toneList, filteredPitches);
                        }

                        let strumOffsetParts: number = 0;
                        for (let i: number = 0; i < filteredPitches.length; i++) {

                            let prevNoteForThisTone: Note | null = (tonesInPrevNote > i) ? prevNoteForThisInstrument : null;
                            let noteForThisTone: Note = note;
                            let pitchesForThisTone: number[] = filteredPitches;
                            let nextNoteForThisTone: Note | null = (tonesInNextNote > i) ? nextNoteForThisInstrument : null;
                            let noteStartPart: number = noteForThisTone.start + strumOffsetParts;
                            let passedEndOfNote: boolean = false;

                            // Strumming may mean that a note's actual start time may be after the
                            // note's displayed start time. If the note start hasn't been reached yet,
                            // carry over the previous tone if available and seamless, otherwise skip
                            // the new tone until it is ready to start.
                            if (noteStartPart > currentPart) {
                                if (toneList.count() > i && (transition.isSeamless || forceContinueAtStart) && prevNoteForThisTone != null) {
                                    // Continue the previous note's chord until the current one takes over.
                                    nextNoteForThisTone = noteForThisTone;
                                    noteForThisTone = prevNoteForThisTone;
                                    pitchesForThisTone = noteForThisTone.pitches;
                                    if (effectsIncludeNoteRange(instrument.effects)) pitchesForThisTone = pitchesForThisTone.filter(pitch => pitch >= instrument.lowerNoteLimit && pitch <= instrument.upperNoteLimit);
                                    prevNoteForThisTone = null;
                                    noteStartPart = noteForThisTone.start + strumOffsetParts;
                                    passedEndOfNote = true;
                                } else {
                                    // This and the rest of the tones in the chord shouldn't start yet.
                                    break;
                                }
                            }

                            let noteEndPart: number = noteForThisTone.end;
                            if ((transition.isSeamless || forceContinueAtStart) && nextNoteForThisTone != null) {
                                noteEndPart = Math.min(Config.partsPerBeat * this.song!.beatsPerBar, noteEndPart + strumOffsetParts);
                            }
                            if ((!transition.continues && !forceContinueAtStart) || prevNoteForThisTone == null) {
                                if (useStrumSpeed) {
                                    let strumParts = instrument.strumParts;
                                    if (this.isModActive(Config.modulators.dictionary["strum speed"].index, channelIndex, instrumentIndex)) {
                                        strumParts = this.getModValue(Config.modulators.dictionary["strum speed"].index, channelIndex, instrumentIndex, false);
                                        // strumPartsEnd = this.getModValue(Config.modulators.dictionary["strum speed"].index, channelIndex, instrumentIndex, true);
                                    }
                                    //strum envelope disabled externally for now, since we would need to store more state to figure out when
                                    strumParts *= instrumentState.strumEnvelopeStart;
                                    strumOffsetParts += strumParts;
                                }
                            }

                            const atNoteStart: boolean = (Config.ticksPerPart * noteStartPart == currentTick);
                            let tone: Tone;
                            if (this.tempMatchedPitchTones[toneCount] != null) {
                                tone = this.tempMatchedPitchTones[toneCount]!;
                                this.tempMatchedPitchTones[toneCount] = null;
                                toneList.pushBack(tone);
                            } else if (toneList.count() <= toneCount) {
                                tone = this.newTone();
                                toneList.pushBack(tone);
                            } else if (atNoteStart && ((!transition.isSeamless && !forceContinueAtStart) || prevNoteForThisTone == null)) {
                                const oldTone: Tone = toneList.get(toneCount);
                                if (oldTone.isOnLastTick) {
                                    this.freeTone(oldTone);
                                } else {
                                    this.releaseTone(instrumentState, oldTone);
                                }
                                tone = this.newTone();
                                toneList.set(toneCount, tone);
                            } else {
                                tone = toneList.get(toneCount);
                            }
                            toneCount++;

                            tone.pitches[0] = pitchesForThisTone[i];
                            tone.pitchCount = 1;
                            tone.chordSize = pitchesForThisTone.length;
                            tone.instrumentIndex = instrumentIndex;
                            tone.note = noteForThisTone;
                            tone.noteStartPart = noteStartPart;
                            tone.noteEndPart = noteEndPart;
                            tone.prevNote = prevNoteForThisTone;
                            tone.nextNote = nextNoteForThisTone;
                            tone.prevNotePitchIndex = i;
                            tone.nextNotePitchIndex = i;
                            tone.atNoteStart = atNoteStart;
                            tone.passedEndOfNote = passedEndOfNote;
                            tone.forceContinueAtStart = forceContinueAtStart && prevNoteForThisTone != null;
                            tone.forceContinueAtEnd = forceContinueAtEnd && nextNoteForThisTone != null;
                            this.computeTone(song, channelIndex, samplesPerTick, tone, false, false);
                        }
                    }
                    if (transition.continues && (toneList.count() <= 0) || (note.pitches.length <= 0)) instrumentState.envelopeComputer.reset(); //stop computing effects envelopes
                }
                // Automatically free or release seamless tones if there's no new note to take over.
                while (toneList.count() > toneCount) {
                    const tone: Tone = toneList.popBack();
                    const channel: Channel = song.channels[channelIndex];
                    if (tone.instrumentIndex < channel.instruments.length && !tone.isOnLastTick) {
                        const instrumentState: InstrumentState = channelState.instruments[tone.instrumentIndex];
                        this.releaseTone(instrumentState, tone);
                    } else {
                        this.freeTone(tone);
                    }
                }

                this.clearTempMatchedPitchTones(toneCount, instrumentState);
            }
        }
    }

    private clearTempMatchedPitchTones(toneCount: number, instrumentState: InstrumentState): void {
        for (let i: number = toneCount; i < this.tempMatchedPitchTones.length; i++) {
            const oldTone: Tone | null = this.tempMatchedPitchTones[i];
            if (oldTone != null) {
                if (oldTone.isOnLastTick) {
                    this.freeTone(oldTone);
                } else {
                    this.releaseTone(instrumentState, oldTone);
                }
                this.tempMatchedPitchTones[i] = null;
            }
        }
    }


    private playTone(channelIndex: number, bufferIndex: number, runLength: number, tone: Tone): void {
        const channelState: ChannelState = this.channels[channelIndex];
        const instrumentState: InstrumentState = channelState.instruments[tone.instrumentIndex];

        if (instrumentState.synthesizer != null) instrumentState.synthesizer!(this, bufferIndex, runLength, tone, instrumentState);
        tone.envelopeComputer.clearEnvelopes();
        instrumentState.envelopeComputer.clearEnvelopes();
    }

    // Computes mod note position at the start and end of the window and "plays" the mod tone, setting appropriate mod data.
    private playModTone(song: Song, channelIndex: number, samplesPerTick: number, bufferIndex: number, roundedSamplesPerTick: number, tone: Tone, released: boolean, shouldFadeOutFast: boolean): void {
        const channel: Channel = song.channels[channelIndex];
        const instrument: Instrument = channel.instruments[tone.instrumentIndex];

        if (tone.note != null) {
            const ticksIntoBar: number = this.getTicksIntoBar();
            const partTimeTickStart: number = (ticksIntoBar) / Config.ticksPerPart;
            const partTimeTickEnd: number = (ticksIntoBar + 1) / Config.ticksPerPart;
            const tickSampleCountdown: number = this.tickSampleCountdown;
            const startRatio: number = 1.0 - (tickSampleCountdown) / samplesPerTick;
            const endRatio: number = 1.0 - (tickSampleCountdown - roundedSamplesPerTick) / samplesPerTick;
            const partTimeStart: number = partTimeTickStart + (partTimeTickEnd - partTimeTickStart) * startRatio;
            const partTimeEnd: number = partTimeTickStart + (partTimeTickEnd - partTimeTickStart) * endRatio;
            const tickTimeStart: number = Config.ticksPerPart * partTimeStart;
            const tickTimeEnd: number = Config.ticksPerPart * partTimeEnd;
            const endPinIndex: number = tone.note.getEndPinIndex(this.getCurrentPart());
            const startPin: NotePin = tone.note.pins[endPinIndex - 1];
            const endPin: NotePin = tone.note.pins[endPinIndex];
            const startPinTick: number = (tone.note.start + startPin.time) * Config.ticksPerPart;
            const endPinTick: number = (tone.note.start + endPin.time) * Config.ticksPerPart;
            const ratioStart: number = (tickTimeStart - startPinTick) / (endPinTick - startPinTick);
            const ratioEnd: number = (tickTimeEnd - startPinTick) / (endPinTick - startPinTick);
            tone.expression = startPin.size + (endPin.size - startPin.size) * ratioStart;
            tone.expressionDelta = (startPin.size + (endPin.size - startPin.size) * ratioEnd) - tone.expression;

            SynthProcessor.modSynth(this, bufferIndex, roundedSamplesPerTick, tone, instrument);
        }
    }

    private static computeChordExpression(chordSize: number): number {
        return 1.0 / ((chordSize - 1) * 0.25 + 1.0);
    }

    private computeTone(song: Song, channelIndex: number, samplesPerTick: number, tone: Tone, released: boolean, shouldFadeOutFast: boolean): void {
        const roundedSamplesPerTick: number = Math.ceil(samplesPerTick);
        const channel: Channel = song.channels[channelIndex];
        const channelState: ChannelState = this.channels[channelIndex];
        const instrument: Instrument = channel.instruments[tone.instrumentIndex];
        const instrumentState: InstrumentState = channelState.instruments[tone.instrumentIndex];
        instrumentState.awake = true;
        instrumentState.tonesAddedInThisTick = true;
        if (!instrumentState.computed) {
            instrumentState.compute(this, instrument, samplesPerTick, roundedSamplesPerTick, tone, channelIndex, tone.instrumentIndex);
        }
        const transition: Transition = instrument.getTransition();
        const chord: Chord = instrument.getChord();
        const chordExpression: number = chord.singleTone ? 1.0 : SynthProcessor.computeChordExpression(tone.chordSize);
        const isNoiseChannel: boolean = song.getChannelIsNoise(channelIndex);
        const intervalScale: number = isNoiseChannel ? Config.noiseInterval : 1;
        const secondsPerPart: number = Config.ticksPerPart * samplesPerTick / this.samplesPerSecond;
        const sampleTime: number = 1.0 / this.samplesPerSecond;
        const beatsPerPart: number = 1.0 / Config.partsPerBeat;
        const ticksIntoBar: number = this.getTicksIntoBar();
        const partTimeStart: number = (ticksIntoBar) / Config.ticksPerPart;
        const partTimeEnd: number = (ticksIntoBar + 1.0) / Config.ticksPerPart;
        const currentPart: number = this.getCurrentPart();

        let specialIntervalMult: number = 1.0;
        tone.specialIntervalExpressionMult = 1.0;

        //if (synth.isModActive(ModSetting.mstPan, channelIndex, tone.instrumentIndex)) {
        //    startPan = synth.getModValue(ModSetting.mstPan, false, channel, instrumentIdx, false);
        //    endPan = synth.getModValue(ModSetting.mstPan, false, channel, instrumentIdx, true);
        //}

        let toneIsOnLastTick: boolean = shouldFadeOutFast;
        let intervalStart: number = 0.0;
        let intervalEnd: number = 0.0;
        let fadeExpressionStart: number = 1.0;
        let fadeExpressionEnd: number = 1.0;
        let chordExpressionStart: number = chordExpression;
        let chordExpressionEnd: number = chordExpression;

        let expressionReferencePitch: number = 16; // A low "E" as a MIDI pitch.
        let basePitch: number = Config.keys[song.key].basePitch + (Config.pitchesPerOctave * song.octave);
        let baseExpression: number = 1.0;
        let pitchDamping: number = 48;
        if (instrument.type == InstrumentType.spectrum) {
            baseExpression = Config.spectrumBaseExpression;
            if (isNoiseChannel) {
                basePitch = Config.spectrumBasePitch;
                baseExpression *= 2.0; // Note: spectrum is louder for drum channels than pitch channels!
            }
            expressionReferencePitch = Config.spectrumBasePitch;
            pitchDamping = 28;
        } else if (instrument.type == InstrumentType.drumset) {
            basePitch = Config.spectrumBasePitch;
            baseExpression = Config.drumsetBaseExpression;
            expressionReferencePitch = basePitch;
        } else if (instrument.type == InstrumentType.noise) {
            // dogebox2 code, makes basic noise affected by keys in pitch channels
            basePitch = isNoiseChannel ? Config.chipNoises[instrument.chipNoise].basePitch : basePitch + Config.chipNoises[instrument.chipNoise].basePitch - 12;
            // maybe also lower expression in pitch channels?
            baseExpression = Config.noiseBaseExpression;
            expressionReferencePitch = basePitch;
            pitchDamping = Config.chipNoises[instrument.chipNoise].isSoft ? 24.0 : 60.0;
        } else if (instrument.type == InstrumentType.fm || instrument.type == InstrumentType.fm6op) {
            baseExpression = Config.fmBaseExpression;
        } else if (instrument.type == InstrumentType.chip) {
            baseExpression = Config.chipBaseExpression;
            if (Config.chipWaves[instrument.chipWave].isCustomSampled) {
                if (Config.chipWaves[instrument.chipWave].isPercussion) {
                    basePitch = -84.37 + Math.log2(Config.chipWaves[instrument.chipWave].samples.length / Config.chipWaves[instrument.chipWave].sampleRate!) * -12 - (-60 + Config.chipWaves[instrument.chipWave].rootKey!);
                } else {
                    basePitch += -96.37 + Math.log2(Config.chipWaves[instrument.chipWave].samples.length / Config.chipWaves[instrument.chipWave].sampleRate!) * -12 - (-60 + Config.chipWaves[instrument.chipWave].rootKey!);
                }
            } else {
                if (Config.chipWaves[instrument.chipWave].isSampled && !Config.chipWaves[instrument.chipWave].isPercussion) {
                    basePitch = basePitch - 63 + Config.chipWaves[instrument.chipWave].extraSampleDetune!
                } else if (Config.chipWaves[instrument.chipWave].isSampled && Config.chipWaves[instrument.chipWave].isPercussion) {
                    basePitch = -51 + Config.chipWaves[instrument.chipWave].extraSampleDetune!;
                }
            }
        } else if (instrument.type == InstrumentType.customChipWave) {
            baseExpression = Config.chipBaseExpression;
        } else if (instrument.type == InstrumentType.harmonics) {
            baseExpression = Config.harmonicsBaseExpression;
        } else if (instrument.type == InstrumentType.pwm) {
            baseExpression = Config.pwmBaseExpression;
        } else if (instrument.type == InstrumentType.supersaw) {
            baseExpression = Config.supersawBaseExpression;
        } else if (instrument.type == InstrumentType.pickedString) {
            baseExpression = Config.pickedStringBaseExpression;
        } else if (instrument.type == InstrumentType.mod) {
            baseExpression = 1.0;
            expressionReferencePitch = 0;
            pitchDamping = 1.0;
            basePitch = 0;
        } else {
            throw new Error("Unknown instrument type in computeTone.");
        }

        if ((tone.atNoteStart && !transition.isSeamless && !tone.forceContinueAtStart) || tone.freshlyAllocated) {
            tone.reset();
            instrumentState.envelopeComputer.reset();
            if (instrument.type == InstrumentType.chip && instrument.isUsingAdvancedLoopControls) {
                const chipWaveLength = Config.rawRawChipWaves[instrument.chipWave].samples.length - 1;
                const firstOffset = instrument.chipWaveStartOffset / chipWaveLength;
                // const lastOffset = (chipWaveLength - 0.01) / chipWaveLength;
                // @TODO: This is silly and I should actually figure out how to
                // properly keep lastOffset as 1.0 and not get it wrapped back
                // to 0 once it's in `Synth.loopableChipSynth`.
                const lastOffset = 0.999999999999999;
                for (let i = 0; i < Config.maxPitchOrOperatorCount * Config.unisonVoicesMax; i++) {
                    tone.phases[i] = instrument.chipWavePlayBackwards ? Math.max(0, Math.min(lastOffset, firstOffset)) : Math.max(0, firstOffset);
                    tone.directions[i] = instrument.chipWavePlayBackwards ? -1 : 1;
                    tone.chipWaveCompletions[i] = 0;
                    tone.chipWavePrevWaves[i] = 0;
                    tone.chipWaveCompletionsLastWave[i] = 0;
                }
            }
        }
        tone.freshlyAllocated = false;

        for (let i: number = 0; i < Config.maxPitchOrOperatorCount; i++) {
            tone.phaseDeltas[i] = 0.0;
            tone.phaseDeltaScales[i] = 0.0;
            tone.operatorExpressions[i] = 0.0;
            tone.operatorExpressionDeltas[i] = 0.0;
        }
        tone.expression = 0.0;
        tone.expressionDelta = 0.0;
        for (let i: number = 0; i < (instrument.type == InstrumentType.fm6op ? 6 : Config.operatorCount); i++) {
            tone.operatorWaves[i] = SynthProcessor.getOperatorWave(instrument.operators[i].waveform, instrument.operators[i].pulseWidth);
        }

        if (released) {
            const startTicksSinceReleased: number = tone.ticksSinceReleased;
            const endTicksSinceReleased: number = tone.ticksSinceReleased + 1.0;
            intervalStart = intervalEnd = tone.lastInterval;
            const fadeOutTicks: number = Math.abs(instrument.getFadeOutTicks());
            fadeExpressionStart = SynthProcessor.noteSizeToVolumeMult((1.0 - startTicksSinceReleased / fadeOutTicks) * Config.noteSizeMax);
            fadeExpressionEnd = SynthProcessor.noteSizeToVolumeMult((1.0 - endTicksSinceReleased / fadeOutTicks) * Config.noteSizeMax);

            if (shouldFadeOutFast) {
                fadeExpressionEnd = 0.0;
            }

            if (tone.ticksSinceReleased + 1 >= fadeOutTicks) toneIsOnLastTick = true;
        } else if (tone.note == null) {
            fadeExpressionStart = fadeExpressionEnd = 1.0;
            tone.lastInterval = 0;
            tone.ticksSinceReleased = 0;
            tone.liveInputSamplesHeld += roundedSamplesPerTick;
        } else {
            const note: Note = tone.note;
            const nextNote: Note | null = tone.nextNote;

            const noteStartPart: number = tone.noteStartPart;
            const noteEndPart: number = tone.noteEndPart;


            const endPinIndex: number = note.getEndPinIndex(currentPart);
            const startPin: NotePin = note.pins[endPinIndex - 1];
            const endPin: NotePin = note.pins[endPinIndex];
            const noteStartTick: number = noteStartPart * Config.ticksPerPart;
            const noteEndTick: number = noteEndPart * Config.ticksPerPart;
            const pinStart: number = (note.start + startPin.time) * Config.ticksPerPart;
            const pinEnd: number = (note.start + endPin.time) * Config.ticksPerPart;

            tone.ticksSinceReleased = 0;

            const tickTimeStart: number = currentPart * Config.ticksPerPart + this.tick;
            const tickTimeEnd: number = tickTimeStart + 1.0;
            const noteTicksPassedTickStart: number = tickTimeStart - noteStartTick;
            const noteTicksPassedTickEnd: number = tickTimeEnd - noteStartTick;
            const pinRatioStart: number = Math.min(1.0, (tickTimeStart - pinStart) / (pinEnd - pinStart));
            const pinRatioEnd: number = Math.min(1.0, (tickTimeEnd - pinStart) / (pinEnd - pinStart));
            fadeExpressionStart = 1.0;
            fadeExpressionEnd = 1.0;
            intervalStart = startPin.interval + (endPin.interval - startPin.interval) * pinRatioStart;
            intervalEnd = startPin.interval + (endPin.interval - startPin.interval) * pinRatioEnd;
            tone.lastInterval = intervalEnd;

            if ((!transition.isSeamless && !tone.forceContinueAtEnd) || nextNote == null) {
                const fadeOutTicks: number = -instrument.getFadeOutTicks();
                if (fadeOutTicks > 0.0) {
                    // If the tone should fade out before the end of the note, do so here.
                    const noteLengthTicks: number = noteEndTick - noteStartTick;
                    fadeExpressionStart *= Math.min(1.0, (noteLengthTicks - noteTicksPassedTickStart) / fadeOutTicks);
                    fadeExpressionEnd *= Math.min(1.0, (noteLengthTicks - noteTicksPassedTickEnd) / fadeOutTicks);
                    if (tickTimeEnd >= noteStartTick + noteLengthTicks) toneIsOnLastTick = true;
                }
            }

        }

        tone.isOnLastTick = toneIsOnLastTick;

        let tmpNoteFilter: FilterSettings = instrument.noteFilter;
        let startPoint: FilterControlPoint;
        let endPoint: FilterControlPoint;

        if (instrument.noteFilterType) {
            // Simple EQ filter (old style). For analysis, using random filters from normal style since they are N/A in this context.
            const noteFilterSettingsStart: FilterSettings = instrument.noteFilter;
            if (instrument.noteSubFilters[1] == null)
                instrument.noteSubFilters[1] = new FilterSettings();
            const noteFilterSettingsEnd: FilterSettings = instrument.noteSubFilters[1];

            // Change location based on slider values
            let startSimpleFreq: number = instrument.noteFilterSimpleCut;
            let startSimpleGain: number = instrument.noteFilterSimplePeak;
            let endSimpleFreq: number = instrument.noteFilterSimpleCut;
            let endSimpleGain: number = instrument.noteFilterSimplePeak;
            let filterChanges: boolean = false;

            if (this.isModActive(Config.modulators.dictionary["note filt cut"].index, channelIndex, tone.instrumentIndex)) {
                startSimpleFreq = this.getModValue(Config.modulators.dictionary["note filt cut"].index, channelIndex, tone.instrumentIndex, false);
                endSimpleFreq = this.getModValue(Config.modulators.dictionary["note filt cut"].index, channelIndex, tone.instrumentIndex, true);
                filterChanges = true;
            }
            if (this.isModActive(Config.modulators.dictionary["note filt peak"].index, channelIndex, tone.instrumentIndex)) {
                startSimpleGain = this.getModValue(Config.modulators.dictionary["note filt peak"].index, channelIndex, tone.instrumentIndex, false);
                endSimpleGain = this.getModValue(Config.modulators.dictionary["note filt peak"].index, channelIndex, tone.instrumentIndex, true);
                filterChanges = true;
            }

            noteFilterSettingsStart.convertLegacySettingsForSynth(startSimpleFreq, startSimpleGain, !filterChanges);
            noteFilterSettingsEnd.convertLegacySettingsForSynth(endSimpleFreq, endSimpleGain, !filterChanges);

            startPoint = noteFilterSettingsStart.controlPoints[0];
            endPoint = noteFilterSettingsEnd.controlPoints[0];

            // Temporarily override so that envelope computer uses appropriate computed note filter
            instrument.noteFilter = noteFilterSettingsStart;
            instrument.tmpNoteFilterStart = noteFilterSettingsStart;
        }

        // Compute envelopes *after* resetting the tone, otherwise the envelope computer gets reset too!
        const envelopeComputer: EnvelopeComputer = tone.envelopeComputer;
        const envelopeSpeeds: number[] = [];
        for (let i: number = 0; i < Config.maxEnvelopeCount; i++) {
            envelopeSpeeds[i] = 0;
        }
        for (let envelopeIndex: number = 0; envelopeIndex < instrument.envelopeCount; envelopeIndex++) {
            let perEnvelopeSpeed: number = instrument.envelopes[envelopeIndex].perEnvelopeSpeed;
            if (this.isModActive(Config.modulators.dictionary["individual envelope speed"].index, channelIndex, tone.instrumentIndex) && instrument.envelopes[envelopeIndex].tempEnvelopeSpeed != null) {
                perEnvelopeSpeed = instrument.envelopes[envelopeIndex].tempEnvelopeSpeed!;
            }
            let useEnvelopeSpeed: number = Config.arpSpeedScale[instrument.envelopeSpeed] * perEnvelopeSpeed;
            if (this.isModActive(Config.modulators.dictionary["envelope speed"].index, channelIndex, tone.instrumentIndex)) {
                useEnvelopeSpeed = Math.max(0, Math.min(Config.arpSpeedScale.length - 1, this.getModValue(Config.modulators.dictionary["envelope speed"].index, channelIndex, tone.instrumentIndex, false)));
                if (Number.isInteger(useEnvelopeSpeed)) {
                    useEnvelopeSpeed = Config.arpSpeedScale[useEnvelopeSpeed] * perEnvelopeSpeed;
                } else {
                    // Linear interpolate envelope values
                    useEnvelopeSpeed = (1 - (useEnvelopeSpeed % 1)) * Config.arpSpeedScale[Math.floor(useEnvelopeSpeed)] + (useEnvelopeSpeed % 1) * Config.arpSpeedScale[Math.ceil(useEnvelopeSpeed)] * perEnvelopeSpeed;
                }
            }
            envelopeSpeeds[envelopeIndex] = useEnvelopeSpeed;
        }
        //the perTone envelopeComputer
        envelopeComputer.computeEnvelopes(instrument, currentPart, instrumentState.envelopeTime, Config.ticksPerPart * partTimeStart, samplesPerTick / this.samplesPerSecond, tone, envelopeSpeeds, instrumentState, this, channelIndex, tone.instrumentIndex, true);
        const envelopeStarts: number[] = tone.envelopeComputer.envelopeStarts;
        const envelopeEnds: number[] = tone.envelopeComputer.envelopeEnds;
        instrument.noteFilter = tmpNoteFilter;
        if (transition.continues && (tone.prevNote == null || tone.note == null)) {
            instrumentState.envelopeComputer.reset();
        }

        if (tone.note != null && transition.slides) {
            // Slide interval and chordExpression at the start and/or end of the note if necessary.
            const prevNote: Note | null = tone.prevNote;
            const nextNote: Note | null = tone.nextNote;
            if (prevNote != null) {
                const intervalDiff: number = prevNote.pitches[tone.prevNotePitchIndex] + prevNote.pins[prevNote.pins.length - 1].interval - tone.pitches[0];
                if (envelopeComputer.prevSlideStart) intervalStart += intervalDiff * envelopeComputer.prevSlideRatioStart;
                if (envelopeComputer.prevSlideEnd) intervalEnd += intervalDiff * envelopeComputer.prevSlideRatioEnd;
                if (!chord.singleTone) {
                    const chordSizeDiff: number = prevNote.pitches.length - tone.chordSize;
                    if (envelopeComputer.prevSlideStart) chordExpressionStart = SynthProcessor.computeChordExpression(tone.chordSize + chordSizeDiff * envelopeComputer.prevSlideRatioStart);
                    if (envelopeComputer.prevSlideEnd) chordExpressionEnd = SynthProcessor.computeChordExpression(tone.chordSize + chordSizeDiff * envelopeComputer.prevSlideRatioEnd);
                }
            }
            if (nextNote != null) {
                const intervalDiff: number = nextNote.pitches[tone.nextNotePitchIndex] - (tone.pitches[0] + tone.note.pins[tone.note.pins.length - 1].interval);
                if (envelopeComputer.nextSlideStart) intervalStart += intervalDiff * envelopeComputer.nextSlideRatioStart;
                if (envelopeComputer.nextSlideEnd) intervalEnd += intervalDiff * envelopeComputer.nextSlideRatioEnd;
                if (!chord.singleTone) {
                    const chordSizeDiff: number = nextNote.pitches.length - tone.chordSize;
                    if (envelopeComputer.nextSlideStart) chordExpressionStart = SynthProcessor.computeChordExpression(tone.chordSize + chordSizeDiff * envelopeComputer.nextSlideRatioStart);
                    if (envelopeComputer.nextSlideEnd) chordExpressionEnd = SynthProcessor.computeChordExpression(tone.chordSize + chordSizeDiff * envelopeComputer.nextSlideRatioEnd);
                }
            }
        }

        if (effectsIncludePitchShift(instrument.effects)) {
            let pitchShift: number = Config.justIntonationSemitones[instrument.pitchShift] / intervalScale;
            let pitchShiftScalarStart: number = 1.0;
            let pitchShiftScalarEnd: number = 1.0;
            if (this.isModActive(Config.modulators.dictionary["pitch shift"].index, channelIndex, tone.instrumentIndex)) {
                pitchShift = Config.justIntonationSemitones[Config.justIntonationSemitones.length - 1];
                pitchShiftScalarStart = (this.getModValue(Config.modulators.dictionary["pitch shift"].index, channelIndex, tone.instrumentIndex, false)) / (Config.pitchShiftCenter);
                pitchShiftScalarEnd = (this.getModValue(Config.modulators.dictionary["pitch shift"].index, channelIndex, tone.instrumentIndex, true)) / (Config.pitchShiftCenter);
            }
            const envelopeStart: number = envelopeStarts[EnvelopeComputeIndex.pitchShift];
            const envelopeEnd: number = envelopeEnds[EnvelopeComputeIndex.pitchShift];
            intervalStart += pitchShift * envelopeStart * pitchShiftScalarStart;
            intervalEnd += pitchShift * envelopeEnd * pitchShiftScalarEnd;
        }
        if (effectsIncludeDetune(instrument.effects) || this.isModActive(Config.modulators.dictionary["song detune"].index, channelIndex, tone.instrumentIndex)) {
            const envelopeStart: number = envelopeStarts[EnvelopeComputeIndex.detune];
            const envelopeEnd: number = envelopeEnds[EnvelopeComputeIndex.detune];
            let modDetuneStart: number = instrument.detune;
            let modDetuneEnd: number = instrument.detune;
            if (this.isModActive(Config.modulators.dictionary["detune"].index, channelIndex, tone.instrumentIndex)) {
                modDetuneStart = this.getModValue(Config.modulators.dictionary["detune"].index, channelIndex, tone.instrumentIndex, false) + Config.detuneCenter;
                modDetuneEnd = this.getModValue(Config.modulators.dictionary["detune"].index, channelIndex, tone.instrumentIndex, true) + Config.detuneCenter;
            }
            if (this.isModActive(Config.modulators.dictionary["song detune"].index, channelIndex, tone.instrumentIndex)) {
                modDetuneStart += 4 * this.getModValue(Config.modulators.dictionary["song detune"].index, channelIndex, tone.instrumentIndex, false);
                modDetuneEnd += 4 * this.getModValue(Config.modulators.dictionary["song detune"].index, channelIndex, tone.instrumentIndex, true);
            }
            intervalStart += SynthProcessor.detuneToCents(modDetuneStart) * envelopeStart * Config.pitchesPerOctave / (12.0 * 100.0);
            intervalEnd += SynthProcessor.detuneToCents(modDetuneEnd) * envelopeEnd * Config.pitchesPerOctave / (12.0 * 100.0);
            // //envelopes should not affect song detune
            // if (this.isModActive(Config.modulators.dictionary["song detune"].index, channelIndex, tone.instrumentIndex)) {
            //     modDetuneStart = 4 * this.getModValue(Config.modulators.dictionary["song detune"].index, channelIndex, tone.instrumentIndex, false);
            //     modDetuneEnd = 4 * this.getModValue(Config.modulators.dictionary["song detune"].index, channelIndex, tone.instrumentIndex, true);
            //     intervalStart += modDetuneStart * Config.pitchesPerOctave / (12.0 * 100.0);
            //     intervalEnd += modDetuneEnd * Config.pitchesPerOctave / (12.0 * 100.0);
            // }
        }

        if (effectsIncludeVibrato(instrument.effects)) {
            let delayTicks: number;
            let vibratoAmplitudeStart: number;
            let vibratoAmplitudeEnd: number;
            // Custom vibrato
            if (instrument.vibrato == Config.vibratos.length) {
                delayTicks = instrument.vibratoDelay * 2; // Delay was changed from parts to ticks in BB v9
                // Special case: if vibrato delay is max, NEVER vibrato.
                if (instrument.vibratoDelay == Config.modulators.dictionary["vibrato delay"].maxRawVol)
                    delayTicks = Number.POSITIVE_INFINITY;
                vibratoAmplitudeStart = instrument.vibratoDepth;
                vibratoAmplitudeEnd = vibratoAmplitudeStart;
            } else {
                delayTicks = Config.vibratos[instrument.vibrato].delayTicks;
                vibratoAmplitudeStart = Config.vibratos[instrument.vibrato].amplitude;
                vibratoAmplitudeEnd = vibratoAmplitudeStart;
            }

            if (this.isModActive(Config.modulators.dictionary["vibrato delay"].index, channelIndex, tone.instrumentIndex)) {
                delayTicks = this.getModValue(Config.modulators.dictionary["vibrato delay"].index, channelIndex, tone.instrumentIndex, false) * 2; // Delay was changed from parts to ticks in BB v9
                if (delayTicks == Config.modulators.dictionary["vibrato delay"].maxRawVol * 2)
                    delayTicks = Number.POSITIVE_INFINITY;

            }

            if (this.isModActive(Config.modulators.dictionary["vibrato depth"].index, channelIndex, tone.instrumentIndex)) {
                vibratoAmplitudeStart = this.getModValue(Config.modulators.dictionary["vibrato depth"].index, channelIndex, tone.instrumentIndex, false) / 25;
                vibratoAmplitudeEnd = this.getModValue(Config.modulators.dictionary["vibrato depth"].index, channelIndex, tone.instrumentIndex, true) / 25;
            }


            // To maintain pitch continuity, (mostly for picked string which retriggers impulse
            // otherwise) remember the vibrato at the end of this run and reuse it at the start
            // of the next run if available.
            let vibratoStart: number;
            if (tone.prevVibrato != null) {
                vibratoStart = tone.prevVibrato;
            } else {
                let vibratoLfoStart: number = SynthProcessor.getLFOAmplitude(instrument, secondsPerPart * instrumentState.vibratoTime);
                const vibratoDepthEnvelopeStart: number = envelopeStarts[EnvelopeComputeIndex.vibratoDepth];
                vibratoStart = vibratoAmplitudeStart * vibratoLfoStart * vibratoDepthEnvelopeStart;
                if (delayTicks > 0.0) {
                    const ticksUntilVibratoStart: number = delayTicks - envelopeComputer.noteTicksStart;
                    vibratoStart *= Math.max(0.0, Math.min(1.0, 1.0 - ticksUntilVibratoStart / 2.0));
                }
            }

            let vibratoLfoEnd: number = SynthProcessor.getLFOAmplitude(instrument, secondsPerPart * instrumentState.nextVibratoTime);
            const vibratoDepthEnvelopeEnd: number = envelopeEnds[EnvelopeComputeIndex.vibratoDepth];
            if (instrument.type != InstrumentType.mod) {
                let vibratoEnd: number = vibratoAmplitudeEnd * vibratoLfoEnd * vibratoDepthEnvelopeEnd;
                if (delayTicks > 0.0) {
                    const ticksUntilVibratoEnd: number = delayTicks - envelopeComputer.noteTicksEnd;
                    vibratoEnd *= Math.max(0.0, Math.min(1.0, 1.0 - ticksUntilVibratoEnd / 2.0));
                }

                tone.prevVibrato = vibratoEnd;

                intervalStart += vibratoStart;
                intervalEnd += vibratoEnd;
            }
        }

        if ((!transition.isSeamless && !tone.forceContinueAtStart) || tone.prevNote == null) {
            // Fade in the beginning of the note.
            const fadeInSeconds: number = instrument.getFadeInSeconds();
            if (fadeInSeconds > 0.0) {
                fadeExpressionStart *= Math.min(1.0, envelopeComputer.noteSecondsStartUnscaled / fadeInSeconds);
                fadeExpressionEnd *= Math.min(1.0, envelopeComputer.noteSecondsEndUnscaled / fadeInSeconds);
            }
        }


        if (instrument.type == InstrumentType.drumset && tone.drumsetPitch == null) {
            // It's possible that the note will change while the user is editing it,
            // but the tone's pitches don't get updated because the tone has already
            // ended and is fading out. To avoid an array index out of bounds error, clamp the pitch.
            tone.drumsetPitch = tone.pitches[0];
            if (tone.note != null) tone.drumsetPitch += tone.note.pickMainInterval();
            tone.drumsetPitch = Math.max(0, Math.min(Config.drumCount - 1, tone.drumsetPitch));
        }

        let noteFilterExpression: number = envelopeComputer.lowpassCutoffDecayVolumeCompensation;
        if (!effectsIncludeNoteFilter(instrument.effects)) {
            tone.noteFilterCount = 0;
        } else {

            const noteAllFreqsEnvelopeStart: number = envelopeStarts[EnvelopeComputeIndex.noteFilterAllFreqs];
            const noteAllFreqsEnvelopeEnd: number = envelopeEnds[EnvelopeComputeIndex.noteFilterAllFreqs];

            // Simple note filter
            if (instrument.noteFilterType) {
                const noteFreqEnvelopeStart: number = envelopeStarts[EnvelopeComputeIndex.noteFilterFreq0];
                const noteFreqEnvelopeEnd: number = envelopeEnds[EnvelopeComputeIndex.noteFilterFreq0];
                const notePeakEnvelopeStart: number = envelopeStarts[EnvelopeComputeIndex.noteFilterGain0];
                const notePeakEnvelopeEnd: number = envelopeEnds[EnvelopeComputeIndex.noteFilterGain0];

                startPoint!.toCoefficients(SynthProcessor.tempFilterStartCoefficients, this.samplesPerSecond, noteAllFreqsEnvelopeStart * noteFreqEnvelopeStart, notePeakEnvelopeStart);
                endPoint!.toCoefficients(SynthProcessor.tempFilterEndCoefficients, this.samplesPerSecond, noteAllFreqsEnvelopeEnd * noteFreqEnvelopeEnd, notePeakEnvelopeEnd);

                if (tone.noteFilters.length < 1) tone.noteFilters[0] = new DynamicBiquadFilter();
                tone.noteFilters[0].loadCoefficientsWithGradient(SynthProcessor.tempFilterStartCoefficients, SynthProcessor.tempFilterEndCoefficients, 1.0 / roundedSamplesPerTick, startPoint!.type == FilterType.lowPass);
                noteFilterExpression *= startPoint!.getVolumeCompensationMult();

                tone.noteFilterCount = 1;
            } else {
                const noteFilterSettings: FilterSettings = (instrument.tmpNoteFilterStart != null) ? instrument.tmpNoteFilterStart : instrument.noteFilter;

                for (let i: number = 0; i < noteFilterSettings.controlPointCount; i++) {
                    const noteFreqEnvelopeStart: number = envelopeStarts[EnvelopeComputeIndex.noteFilterFreq0 + i];
                    const noteFreqEnvelopeEnd: number = envelopeEnds[EnvelopeComputeIndex.noteFilterFreq0 + i];
                    const notePeakEnvelopeStart: number = envelopeStarts[EnvelopeComputeIndex.noteFilterGain0 + i];
                    const notePeakEnvelopeEnd: number = envelopeEnds[EnvelopeComputeIndex.noteFilterGain0 + i];
                    let startPoint: FilterControlPoint = noteFilterSettings.controlPoints[i];
                    const endPoint: FilterControlPoint = (instrument.tmpNoteFilterEnd != null && instrument.tmpNoteFilterEnd.controlPoints[i] != null) ? instrument.tmpNoteFilterEnd.controlPoints[i] : noteFilterSettings.controlPoints[i];

                    // If switching dot type, do it all at once and do not try to interpolate since no valid interpolation exists.
                    if (startPoint.type != endPoint.type) {
                        startPoint = endPoint;
                    }

                    startPoint.toCoefficients(SynthProcessor.tempFilterStartCoefficients, this.samplesPerSecond, noteAllFreqsEnvelopeStart * noteFreqEnvelopeStart, notePeakEnvelopeStart);
                    endPoint.toCoefficients(SynthProcessor.tempFilterEndCoefficients, this.samplesPerSecond, noteAllFreqsEnvelopeEnd * noteFreqEnvelopeEnd, notePeakEnvelopeEnd);
                    if (tone.noteFilters.length <= i) tone.noteFilters[i] = new DynamicBiquadFilter();
                    tone.noteFilters[i].loadCoefficientsWithGradient(SynthProcessor.tempFilterStartCoefficients, SynthProcessor.tempFilterEndCoefficients, 1.0 / roundedSamplesPerTick, startPoint.type == FilterType.lowPass);
                    noteFilterExpression *= startPoint.getVolumeCompensationMult();
                }
                tone.noteFilterCount = noteFilterSettings.controlPointCount;
            }
        }

        if (instrument.type == InstrumentType.drumset) {
            const drumsetEnvelopeComputer: EnvelopeComputer = tone.envelopeComputer;

            const drumsetFilterEnvelope: Envelope = instrument.getDrumsetEnvelope(tone.drumsetPitch!);

            // If the drumset lowpass cutoff decays, compensate by increasing expression.
            noteFilterExpression *= EnvelopeComputer.getLowpassCutoffDecayVolumeCompensation(drumsetFilterEnvelope);

            drumsetEnvelopeComputer.computeDrumsetEnvelopes(instrument, drumsetFilterEnvelope, beatsPerPart, partTimeStart, partTimeEnd);

            const drumsetFilterEnvelopeStart = drumsetEnvelopeComputer.drumsetFilterEnvelopeStart;
            const drumsetFilterEnvelopeEnd = drumsetEnvelopeComputer.drumsetFilterEnvelopeEnd;

            const point: FilterControlPoint = this.tempDrumSetControlPoint;
            point.type = FilterType.lowPass;
            point.gain = FilterControlPoint.getRoundedSettingValueFromLinearGain(0.50);
            point.freq = FilterControlPoint.getRoundedSettingValueFromHz(8000.0);
            // Drumset envelopes are warped to better imitate the legacy simplified 2nd order lowpass at ~48000Hz that I used to use.
            point.toCoefficients(SynthProcessor.tempFilterStartCoefficients, this.samplesPerSecond, drumsetFilterEnvelopeStart * (1.0 + drumsetFilterEnvelopeStart), 1.0);
            point.toCoefficients(SynthProcessor.tempFilterEndCoefficients, this.samplesPerSecond, drumsetFilterEnvelopeEnd * (1.0 + drumsetFilterEnvelopeEnd), 1.0);
            if (tone.noteFilters.length == tone.noteFilterCount) tone.noteFilters[tone.noteFilterCount] = new DynamicBiquadFilter();
            tone.noteFilters[tone.noteFilterCount].loadCoefficientsWithGradient(SynthProcessor.tempFilterStartCoefficients, SynthProcessor.tempFilterEndCoefficients, 1.0 / roundedSamplesPerTick, true);
            tone.noteFilterCount++;
        }

        noteFilterExpression = Math.min(3.0, noteFilterExpression);

        if (instrument.type == InstrumentType.fm || instrument.type == InstrumentType.fm6op) {
            // phase modulation!

            let sineExpressionBoost: number = 1.0;
            let totalCarrierExpression: number = 0.0;

            let arpeggioInterval: number = 0;
            const arpeggiates: boolean = chord.arpeggiates;
            const isMono: boolean = chord.name == "monophonic";
            if (tone.pitchCount > 1 && arpeggiates) {
                const arpeggio: number = Math.floor(instrumentState.arpTime / Config.ticksPerArpeggio);
                arpeggioInterval = tone.pitches[getArpeggioPitchIndex(tone.pitchCount, instrument.fastTwoNoteArp, arpeggio)] - tone.pitches[0];
            }


            const carrierCount: number = (instrument.type == InstrumentType.fm6op ? instrument.customAlgorithm.carrierCount : Config.algorithms[instrument.algorithm].carrierCount);
            for (let i: number = 0; i < (instrument.type == InstrumentType.fm6op ? 6 : Config.operatorCount); i++) {

                const associatedCarrierIndex: number = (instrument.type == InstrumentType.fm6op ? instrument.customAlgorithm.associatedCarrier[i] - 1 : Config.algorithms[instrument.algorithm].associatedCarrier[i] - 1);
                const pitch: number = tone.pitches[arpeggiates ? 0 : isMono ? instrument.monoChordTone : ((i < tone.pitchCount) ? i : ((associatedCarrierIndex < tone.pitchCount) ? associatedCarrierIndex : 0))];
                const freqMult = Config.operatorFrequencies[instrument.operators[i].frequency].mult;
                const interval = Config.operatorCarrierInterval[associatedCarrierIndex] + arpeggioInterval; //make conditional
                const pitchStart: number = basePitch + (pitch + intervalStart) * intervalScale + interval;
                const pitchEnd: number = basePitch + (pitch + intervalEnd) * intervalScale + interval;
                const baseFreqStart: number = Instrument.frequencyFromPitch(pitchStart);
                const baseFreqEnd: number = Instrument.frequencyFromPitch(pitchEnd);
                const hzOffset: number = Config.operatorFrequencies[instrument.operators[i].frequency].hzOffset;
                const targetFreqStart: number = freqMult * baseFreqStart + hzOffset;
                const targetFreqEnd: number = freqMult * baseFreqEnd + hzOffset;


                const freqEnvelopeStart: number = envelopeStarts[EnvelopeComputeIndex.operatorFrequency0 + i];
                const freqEnvelopeEnd: number = envelopeEnds[EnvelopeComputeIndex.operatorFrequency0 + i];
                let freqStart: number;
                let freqEnd: number;
                if (freqEnvelopeStart != 1.0 || freqEnvelopeEnd != 1.0) {
                    freqStart = Math.pow(2.0, Math.log2(targetFreqStart / baseFreqStart) * freqEnvelopeStart) * baseFreqStart;
                    freqEnd = Math.pow(2.0, Math.log2(targetFreqEnd / baseFreqEnd) * freqEnvelopeEnd) * baseFreqEnd;
                } else {
                    freqStart = targetFreqStart;
                    freqEnd = targetFreqEnd;
                }

                const unisonVoices: number = instrument.unisonVoices;
                const unisonSpread: number = instrument.unisonSpread;
                const unisonOffset: number = instrument.unisonOffset;
                const unisonExpression: number = instrument.unisonExpression * unisonVoices;
                const unisonEnvelopeStart = envelopeStarts[EnvelopeComputeIndex.unison];
                const unisonEnvelopeEnd = envelopeEnds[EnvelopeComputeIndex.unison];

                const basePhaseDeltaScale: number = Math.pow(freqEnd / freqStart, 1.0 / roundedSamplesPerTick);
                
                const unisonStartA: number = Math.pow(2.0, (unisonOffset + unisonSpread) * unisonEnvelopeStart / 12.0);
                const unisonEndA: number = Math.pow(2.0, (unisonOffset + unisonSpread) * unisonEnvelopeEnd / 12.0);
                tone.phaseDeltas[i * unisonVoices + 0] = freqStart * sampleTime * unisonStartA;
                tone.phaseDeltaScales[i * unisonVoices + 0] = basePhaseDeltaScale * Math.pow(unisonEndA / unisonStartA, 1.0 / roundedSamplesPerTick);

                const divisor = (unisonVoices == 1) ? 1 : (unisonVoices - 1);
                for (let voice: number = 1; voice < unisonVoices; voice++) {
                    const unisonStart: number = Math.pow(2.0, (unisonOffset + unisonSpread - (2 * voice * unisonSpread / divisor)) * unisonEnvelopeStart / 12.0) * (specialIntervalMult);
                    const unisonEnd: number = Math.pow(2.0, (unisonOffset + unisonSpread - (2 * voice * unisonSpread / divisor)) * unisonEnvelopeEnd / 12.0) * (specialIntervalMult);
                    tone.phaseDeltas[i * unisonVoices + voice] = freqStart * sampleTime * unisonStart;
                    tone.phaseDeltaScales[i * unisonVoices + voice] = basePhaseDeltaScale * Math.pow(unisonEnd / unisonStart, 1.0 / roundedSamplesPerTick);
                }
                if ((!instrumentState.unisonInitialized || !tone.unisonHasUpdated) && instrument.unisonAntiPhased) {
                    const wave = tone.operatorWaves[i].samples;
                    //not a perfect representation of the fm wave, but it approximates it well enough 
                    //in most scenarios for this to work
                    function wavePoint(phase: number): number {
                        const flooredPhase: number = phase | 0;
                        const remainder: number = phase - flooredPhase;
                        const flooredPhase2: number = flooredPhase + 1 >= wave.length ? flooredPhase + 1 - wave.length : flooredPhase + 1;
                        return wave[flooredPhase] * (1 - remainder) + wave[flooredPhase2] * remainder;
                    }
                    // Goal: generate phases such that the combined initial amplitude
                    // cancel out to minimize pop. Algorithm: generate sorted phases, iterate over
                    // the whole wave until we find a combined zero crossing, then offset the
                    // phases so they start there.

                    // Generate random phases in ascending order by adding positive randomly
                    // sized gaps between adjacent phases. For a proper distribution of random
                    // events, the gaps sizes should be an "exponential distribution", which is
                    // just: -Math.log(Math.random()). At the end, normalize the phases to a 0-1
                    // range by dividing by the final value of the accumulator.
                    const voiceCount: number = Config.unisonVoicesMax;
                    const unisonSign: number = instrument.unisonSign;

                    let accumulator: number = 0.0;
                    for (let j: number = 0; j < voiceCount; j++) {
                        tone.phases[i * unisonVoices + j] = accumulator;
                        accumulator += -Math.log(Math.random());
                    }

                    let amplitudeOld: number = wavePoint(tone.phases[i * unisonVoices]);
                    for (let j: number = 1; j < voiceCount; j++) {
                        amplitudeOld += wavePoint(tone.phases[i * unisonVoices + j]) * unisonSign;
                    }
                    let phaseOld: number = 0.0;
                    let zeroCrossingPhase: number = 0.0;

                    //iterate over the wave at 256 different points (or until a good crossing is found). 
                    const steps = 256;
                    for (let j = 1; j <= steps; j++) {
                        let phaseNew = j / steps * wave.length;
                        let amplitudeNew: number = wavePoint(phaseNew + tone.phases[i * unisonVoices]);
                        for (let k: number = 1; k < voiceCount; k++) {
                            amplitudeNew += wavePoint(phaseNew + tone.phases[i * unisonVoices + k]) * unisonSign;
                        }
                        if ((amplitudeOld | 0) * (amplitudeNew | 0) <= 0) {
                            //here we basically do a binary search for the zero crossing with a depth of 10
                            for (let _ = 0; _ < 10; _++) {
                                const phaseCenter = (phaseOld + phaseNew) / 2;
                                let amplitudeNewer: number = wavePoint(phaseCenter + tone.phases[i * unisonVoices]);
                                for (let k: number = 1; k < voiceCount; k++) {
                                    amplitudeNewer += wavePoint(phaseCenter + tone.phases[i * unisonVoices + k]) * unisonSign;
                                }

                                if (amplitudeOld * amplitudeNewer <= 0) {
                                    phaseNew = phaseCenter;
                                    amplitudeNew = amplitudeNewer;
                                } else {
                                    phaseOld = phaseCenter;
                                    amplitudeOld = amplitudeNewer;
                                }
                            }
                            zeroCrossingPhase = (phaseOld + phaseNew) / 2;
                            break;
                        }
                        phaseOld = phaseNew;
                        amplitudeOld = amplitudeNew;
                    }

                    for (let j: number = 0; j < voiceCount; j++) {
                        tone.phases[i * unisonVoices + j] += zeroCrossingPhase;
                    }

                    // Randomize the (initially sorted) order of the phases (aside from the
                    // first one) so that they don't correlate to the detunes that are also
                    // based on index.
                    for (let j: number = 1; j < voiceCount - 1; j++) {
                        const swappedIndex: number = j + Math.floor(Math.random() * (voiceCount - j));
                        const temp: number = tone.phases[i];
                        tone.phases[i * unisonVoices + j] = tone.phases[i * unisonVoices + swappedIndex];
                        tone.phases[i * unisonVoices + swappedIndex] = temp;
                    }
                    instrumentState.unisonInitialized = true;
                    tone.unisonHasUpdated = true;
                } else if (!instrumentState.unisonInitialized && !instrument.unisonAntiPhased) {
                    for (let j: number = 0; j < Config.unisonVoicesMax; j++) {
                        tone.phases[i * unisonVoices + j] = 0;
                    }
                    instrumentState.unisonInitialized = true;
                }

                let amplitudeStart: number = instrument.operators[i].amplitude;
                let amplitudeEnd: number = instrument.operators[i].amplitude;
                if (i < 4) {
                    if (this.isModActive(Config.modulators.dictionary["fm slider 1"].index + i, channelIndex, tone.instrumentIndex)) {
                        amplitudeStart *= this.getModValue(Config.modulators.dictionary["fm slider 1"].index + i, channelIndex, tone.instrumentIndex, false) / 15.0;
                        amplitudeEnd *= this.getModValue(Config.modulators.dictionary["fm slider 1"].index + i, channelIndex, tone.instrumentIndex, true) / 15.0;
                    }
                } else {
                    if (this.isModActive(Config.modulators.dictionary["fm slider 5"].index + i - 4, channelIndex, tone.instrumentIndex)) {
                        amplitudeStart *= this.getModValue(Config.modulators.dictionary["fm slider 5"].index + i - 4, channelIndex, tone.instrumentIndex, false) / 15.0;
                        amplitudeEnd *= this.getModValue(Config.modulators.dictionary["fm slider 5"].index + i - 4, channelIndex, tone.instrumentIndex, true) / 15.0;
                    }
                }

                const amplitudeCurveStart: number = SynthProcessor.operatorAmplitudeCurve(amplitudeStart);
                const amplitudeCurveEnd: number = SynthProcessor.operatorAmplitudeCurve(amplitudeEnd);
                const amplitudeMultStart: number = amplitudeCurveStart * Config.operatorFrequencies[instrument.operators[i].frequency].amplitudeSign;
                const amplitudeMultEnd: number = amplitudeCurveEnd * Config.operatorFrequencies[instrument.operators[i].frequency].amplitudeSign;

                let expressionStart: number = amplitudeMultStart * unisonExpression;
                let expressionEnd: number = amplitudeMultEnd * unisonExpression;


                if (i < carrierCount) {
                    // carrier
                    let pitchExpressionStart: number;
                    if (tone.prevPitchExpressions[i] != null) {
                        pitchExpressionStart = tone.prevPitchExpressions[i]!;
                    } else {
                        pitchExpressionStart = Math.pow(2.0, -(pitchStart - expressionReferencePitch) / pitchDamping);
                    }
                    const pitchExpressionEnd: number = Math.pow(2.0, -(pitchEnd - expressionReferencePitch) / pitchDamping);
                    tone.prevPitchExpressions[i] = pitchExpressionEnd;
                    expressionStart *= pitchExpressionStart;
                    expressionEnd *= pitchExpressionEnd;

                    totalCarrierExpression += amplitudeCurveEnd;
                } else {
                    // modulator
                    expressionStart *= Config.sineWaveLength * 1.5;
                    expressionEnd *= Config.sineWaveLength * 1.5;

                    sineExpressionBoost *= 1.0 - Math.min(1.0, instrument.operators[i].amplitude / 15);
                }

                expressionStart *= envelopeStarts[EnvelopeComputeIndex.operatorAmplitude0 + i];
                expressionEnd *= envelopeEnds[EnvelopeComputeIndex.operatorAmplitude0 + i];

                // Check for mod-related volume delta
                // @jummbus - This amplification is also applied to modulator FM operators which distorts the sound.
                // The fix is to apply this only to carriers, but as this is a legacy bug and it can cause some interesting sounds, it's left in.
                // You can use the mix volume modulator instead to avoid this effect.

                if (this.isModActive(Config.modulators.dictionary["note volume"].index, channelIndex, tone.instrumentIndex)) {
                    // Linear falloff below 0, normal volume formula above 0. Seems to work best for scaling since the normal volume mult formula has a big gap from -25 to -24.
                    const startVal: number = this.getModValue(Config.modulators.dictionary["note volume"].index, channelIndex, tone.instrumentIndex, false);
                    const endVal: number = this.getModValue(Config.modulators.dictionary["note volume"].index, channelIndex, tone.instrumentIndex, true);
                    expressionStart *= ((startVal <= 0) ? ((startVal + Config.volumeRange / 2) / (Config.volumeRange / 2)) : SynthProcessor.instrumentVolumeToVolumeMult(startVal));
                    expressionEnd *= ((endVal <= 0) ? ((endVal + Config.volumeRange / 2) / (Config.volumeRange / 2)) : SynthProcessor.instrumentVolumeToVolumeMult(endVal));
                }

                tone.operatorExpressions[i] = expressionStart;
                tone.operatorExpressionDeltas[i] = (expressionEnd - expressionStart) / roundedSamplesPerTick;

            }

            sineExpressionBoost *= (Math.pow(2.0, (2.0 - 1.4 * instrument.feedbackAmplitude / 15.0)) - 1.0) / 3.0;
            sineExpressionBoost *= 1.0 - Math.min(1.0, Math.max(0.0, totalCarrierExpression - 1) / 2.0);
            sineExpressionBoost = 1.0 + sineExpressionBoost * 3.0;
            let expressionStart: number = baseExpression * sineExpressionBoost * noteFilterExpression * fadeExpressionStart * chordExpressionStart * envelopeStarts[EnvelopeComputeIndex.noteVolume];
            let expressionEnd: number = baseExpression * sineExpressionBoost * noteFilterExpression * fadeExpressionEnd * chordExpressionEnd * envelopeEnds[EnvelopeComputeIndex.noteVolume];
            if (isMono && tone.pitchCount <= instrument.monoChordTone) { //silence if tone doesn't exist
                expressionStart = 0;
                expressionEnd = 0;
            }
            tone.expression = expressionStart;
            tone.expressionDelta = (expressionEnd - expressionStart) / roundedSamplesPerTick;



            let useFeedbackAmplitudeStart: number = instrument.feedbackAmplitude;
            let useFeedbackAmplitudeEnd: number = instrument.feedbackAmplitude;
            if (this.isModActive(Config.modulators.dictionary["fm feedback"].index, channelIndex, tone.instrumentIndex)) {
                useFeedbackAmplitudeStart *= this.getModValue(Config.modulators.dictionary["fm feedback"].index, channelIndex, tone.instrumentIndex, false) / 15.0;
                useFeedbackAmplitudeEnd *= this.getModValue(Config.modulators.dictionary["fm feedback"].index, channelIndex, tone.instrumentIndex, true) / 15.0;
            }

            let feedbackAmplitudeStart: number = Config.sineWaveLength * 0.3 * useFeedbackAmplitudeStart / 15.0;
            const feedbackAmplitudeEnd: number = Config.sineWaveLength * 0.3 * useFeedbackAmplitudeEnd / 15.0;

            let feedbackStart: number = feedbackAmplitudeStart * envelopeStarts[EnvelopeComputeIndex.feedbackAmplitude];
            let feedbackEnd: number = feedbackAmplitudeEnd * envelopeEnds[EnvelopeComputeIndex.feedbackAmplitude];
            tone.feedbackMult = feedbackStart;
            tone.feedbackDelta = (feedbackEnd - feedbackStart) / roundedSamplesPerTick;


        } else {
            const freqEndRatio: number = Math.pow(2.0, (intervalEnd - intervalStart) * intervalScale / 12.0);
            const basePhaseDeltaScale: number = Math.pow(freqEndRatio, 1.0 / roundedSamplesPerTick);
            const isMono: boolean = chord.name == "monophonic";


            let pitch: number = tone.pitches[0];
            if (tone.pitchCount > 1 && (chord.arpeggiates || chord.customInterval || isMono)) {
                const arpeggio: number = Math.floor(instrumentState.arpTime / Config.ticksPerArpeggio);
                if (chord.customInterval) {
                    const intervalOffset: number = tone.pitches[1 + getArpeggioPitchIndex(tone.pitchCount - 1, instrument.fastTwoNoteArp, arpeggio)] - tone.pitches[0];
                    specialIntervalMult = Math.pow(2.0, intervalOffset / 12.0);
                    tone.specialIntervalExpressionMult = Math.pow(2.0, -intervalOffset / pitchDamping);
                } else if (chord.arpeggiates) {
                    pitch = tone.pitches[getArpeggioPitchIndex(tone.pitchCount, instrument.fastTwoNoteArp, arpeggio)];
                } else {
                    pitch = tone.pitches[instrument.monoChordTone];
                }
            }

            const startPitch: number = basePitch + (pitch + intervalStart) * intervalScale;
            const endPitch: number = basePitch + (pitch + intervalEnd) * intervalScale;
            let pitchExpressionStart: number;
            // TODO: use the second element of prevPitchExpressions for the unison voice, compute a separate expression delta for it.
            // slarmoo - ummm. Idk if this is necessary anymore?
            if (tone.prevPitchExpressions[0] != null) {
                pitchExpressionStart = tone.prevPitchExpressions[0]!;
            } else {
                pitchExpressionStart = Math.pow(2.0, -(startPitch - expressionReferencePitch) / pitchDamping);
            }
            const pitchExpressionEnd: number = Math.pow(2.0, -(endPitch - expressionReferencePitch) / pitchDamping);
            tone.prevPitchExpressions[0] = pitchExpressionEnd;
            let settingsExpressionMult: number = baseExpression * noteFilterExpression;

            if (instrument.type == InstrumentType.noise) {
                settingsExpressionMult *= Config.chipNoises[instrument.chipNoise].expression;
            }
            if (instrument.type == InstrumentType.chip) {
                settingsExpressionMult *= Config.chipWaves[instrument.chipWave].expression;
            }
            if (instrument.type == InstrumentType.pwm) {
                const basePulseWidth: number = getPulseWidthRatio(instrument.pulseWidth);

                // Check for PWM mods to this instrument
                let pulseWidthModStart: number = basePulseWidth;
                let pulseWidthModEnd: number = basePulseWidth;
                if (this.isModActive(Config.modulators.dictionary["pulse width"].index, channelIndex, tone.instrumentIndex)) {
                    pulseWidthModStart = (this.getModValue(Config.modulators.dictionary["pulse width"].index, channelIndex, tone.instrumentIndex, false)) / (Config.pulseWidthRange * 2);
                    pulseWidthModEnd = (this.getModValue(Config.modulators.dictionary["pulse width"].index, channelIndex, tone.instrumentIndex, true)) / (Config.pulseWidthRange * 2);
                }

                const pulseWidthStart: number = pulseWidthModStart * envelopeStarts[EnvelopeComputeIndex.pulseWidth];
                const pulseWidthEnd: number = pulseWidthModEnd * envelopeEnds[EnvelopeComputeIndex.pulseWidth];
                tone.pulseWidth = pulseWidthStart;
                tone.pulseWidthDelta = (pulseWidthEnd - pulseWidthStart) / roundedSamplesPerTick;

                //decimal offset mods
                let decimalOffsetModStart: number = instrument.decimalOffset;
                if (this.isModActive(Config.modulators.dictionary["decimal offset"].index, channelIndex, tone.instrumentIndex)) {
                    decimalOffsetModStart = this.getModValue(Config.modulators.dictionary["decimal offset"].index, channelIndex, tone.instrumentIndex, false);
                }

                const decimalOffsetStart: number = decimalOffsetModStart * envelopeStarts[EnvelopeComputeIndex.decimalOffset];
                tone.decimalOffset = decimalOffsetStart;

                tone.pulseWidth -= (tone.decimalOffset) / 10000;
            }
            if (instrument.type == InstrumentType.pickedString) {
                // Check for sustain mods
                let useSustainStart: number = instrument.stringSustain;
                let useSustainEnd: number = instrument.stringSustain;
                if (this.isModActive(Config.modulators.dictionary["sustain"].index, channelIndex, tone.instrumentIndex)) {
                    useSustainStart = this.getModValue(Config.modulators.dictionary["sustain"].index, channelIndex, tone.instrumentIndex, false);
                    useSustainEnd = this.getModValue(Config.modulators.dictionary["sustain"].index, channelIndex, tone.instrumentIndex, true);
                }

                tone.stringSustainStart = useSustainStart;
                tone.stringSustainEnd = useSustainEnd;

                // Increase expression to compensate for string decay.
                settingsExpressionMult *= Math.pow(2.0, 0.7 * (1.0 - useSustainStart / (Config.stringSustainRange - 1)));

            }

            const startFreq: number = Instrument.frequencyFromPitch(startPitch);
            if (instrument.type == InstrumentType.chip || instrument.type == InstrumentType.customChipWave || instrument.type == InstrumentType.harmonics || instrument.type == InstrumentType.pickedString || instrument.type == InstrumentType.spectrum || instrument.type == InstrumentType.pwm || instrument.type == InstrumentType.noise || instrument.type == InstrumentType.drumset) {
                const unisonVoices: number = instrument.unisonVoices;
                const unisonSpread: number = instrument.unisonSpread;
                const unisonOffset: number = instrument.unisonOffset;
                const unisonExpression: number = instrument.unisonExpression;
                const voiceCountExpression: number = (instrument.type == InstrumentType.pickedString) ? 1 : unisonVoices / 2.0;
                settingsExpressionMult *= unisonExpression * voiceCountExpression;
                const unisonEnvelopeStart = envelopeStarts[EnvelopeComputeIndex.unison];
                const unisonEnvelopeEnd = envelopeEnds[EnvelopeComputeIndex.unison];
                const unisonStartA: number = Math.pow(2.0, (unisonOffset + unisonSpread) * unisonEnvelopeStart / 12.0);
                const unisonEndA: number = Math.pow(2.0, (unisonOffset + unisonSpread) * unisonEnvelopeEnd / 12.0);
                tone.phaseDeltas[0] = startFreq * sampleTime * unisonStartA;
                tone.phaseDeltaScales[0] = basePhaseDeltaScale * Math.pow(unisonEndA / unisonStartA, 1.0 / roundedSamplesPerTick);
                const divisor = (unisonVoices == 1) ? 1 : (unisonVoices - 1);
                for (let i: number = 1; i <= unisonVoices; i++) {
                    const unisonStart: number = Math.pow(2.0, (unisonOffset + unisonSpread - (2 * i * unisonSpread / divisor)) * unisonEnvelopeStart / 12.0) * (specialIntervalMult);
                    const unisonEnd: number = Math.pow(2.0, (unisonOffset + unisonSpread - (2 * i * unisonSpread / divisor)) * unisonEnvelopeEnd / 12.0) * (specialIntervalMult);
                    tone.phaseDeltas[i] = startFreq * sampleTime * unisonStart;
                    tone.phaseDeltaScales[i] = basePhaseDeltaScale * Math.pow(unisonEnd / unisonStart, 1.0 / roundedSamplesPerTick);
                }
                for (let i: number = unisonVoices + 1; i < Config.unisonVoicesMax; i++) {
                    if (i == 2) {
                        const unisonBStart: number = Math.pow(2.0, (unisonOffset - unisonSpread) * unisonEnvelopeStart / 12.0) * specialIntervalMult;
                        const unisonBEnd: number = Math.pow(2.0, (unisonOffset - unisonSpread) * unisonEnvelopeEnd / 12.0) * specialIntervalMult;
                        tone.phaseDeltas[i] = startFreq * sampleTime * unisonBStart;
                        tone.phaseDeltaScales[i] = basePhaseDeltaScale * Math.pow(unisonBEnd / unisonBStart, 1.0 / roundedSamplesPerTick);
                    } else {
                        tone.phaseDeltas[i] = tone.phaseDeltas[0];
                        tone.phaseDeltaScales[i] = tone.phaseDeltaScales[0];
                    }
                }

                if ((!instrumentState.unisonInitialized || !tone.unisonHasUpdated) && instrument.unisonAntiPhased && (instrument.type == InstrumentType.pwm || instrumentState.wave) && instrument.type != InstrumentType.pickedString) {
                    function wavePoint(phase: number): number {
                        if (instrument.type == InstrumentType.pwm) {
                            //because there's no wave array to index into, we do a very quick calculation
                            //of what that value would be, using a reduced version of the pulse width 
                            //synth code
                            const sawPhaseA = phase - (phase | 0);
                            const sawPhaseB = (phase + tone.pulseWidth) - ((phase + tone.pulseWidth) | 0);
                            return sawPhaseB - sawPhaseA;
                        } 
                        const flooredPhase: number = (phase | 0) % instrumentState.wave!.length;
                        const remainder: number = phase - flooredPhase;
                        const flooredPhase2: number = flooredPhase + 1 >= instrumentState.wave!.length ? flooredPhase + 1 - instrumentState.wave!.length : flooredPhase + 1;
                        return instrumentState.wave![flooredPhase] * (1 - remainder) + instrumentState.wave![flooredPhase2] * remainder;
                    }
                    // Goal: generate phases such that the combined initial amplitude
                    // cancel out to minimize pop. Algorithm: generate sorted phases, iterate over
                    // the whole wave until we find a combined zero crossing, then offset the
                    // phases so they start there.

                    // Generate random phases in ascending order by adding positive randomly
                    // sized gaps between adjacent phases. For a proper distribution of random
                    // events, the gaps sizes should be an "exponential distribution", which is
                    // just: -Math.log(Math.random()). At the end, normalize the phases to a 0-1
                    // range by dividing by the final value of the accumulator.
                    const voiceCount: number = Config.unisonVoicesMax;
                    const unisonSign: number = instrument.unisonSign;

                    //honestly between this and the randomizing, we don't really need to search for the zero crossing. 
                    //But better quality is always nice. 
                    let accumulator: number = 0.0;
                    for (let i: number = 0; i < voiceCount; i++) {
                        tone.phases[i] = accumulator;
                        accumulator += -Math.log(Math.random());
                    }

                    let amplitudeOld: number = wavePoint(tone.phases[0]);
                    for (let i: number = 1; i < voiceCount; i++) {
                        amplitudeOld += wavePoint(tone.phases[i]) * unisonSign;
                    }
                    let phaseOld: number = 0.0;
                    let zeroCrossingPhase: number = 0.0;

                    //iterate over the wave at 256 different points (or until a good crossing is found). 
                    const steps = 256;
                    for (let i = 1; i <= steps; i++) {
                        let phaseNew = i / steps * (instrument.type == InstrumentType.pwm ? 1 : instrumentState.wave!.length);
                        let amplitudeNew: number = wavePoint(tone.phases[0] + phaseNew);
                        for (let j: number = 1; j < voiceCount; j++) {
                            amplitudeNew += wavePoint(tone.phases[j] + phaseNew) * unisonSign;
                        }
                        if (amplitudeOld * amplitudeNew <= 0) {
                            // const m = (amplitudeNew - amplitudeOld) / (phaseNew - phaseOld);
                            // if (m == 0) zeroCrossingPhase = (phaseOld + phaseNew) / 2;
                            // else zeroCrossingPhase = (-1 * amplitudeOld / m + phaseOld);

                            //here we basically do a binary search for the zero crossing with a depth of 10
                            for (let _ = 0; _ < 10; _++) {
                                const phaseCenter = (phaseOld + phaseNew) / 2;
                                let amplitudeNewer: number = wavePoint(phaseCenter + tone.phases[0]);
                                for (let k: number = 1; k < voiceCount; k++) {
                                    amplitudeNewer += wavePoint(phaseCenter + tone.phases[k]) * unisonSign;
                                }

                                if (amplitudeOld * amplitudeNewer <= 0) {
                                    phaseNew = phaseCenter;
                                    amplitudeNew = amplitudeNewer;
                                } else {
                                    phaseOld = phaseCenter;
                                    amplitudeOld = amplitudeNewer;
                                }
                            }
                            zeroCrossingPhase = (phaseOld + phaseNew) / 2;
                            break;
                        }
                        phaseOld = phaseNew;
                        amplitudeOld = amplitudeNew;
                    }

                    for (let i: number = 0; i < voiceCount; i++) {
                        tone.phases[i] += zeroCrossingPhase;
                    }

                    // Randomize the (initially sorted) order of the phases (aside from the
                    // first one) so that they don't correlate to the detunes that are also
                    // based on index.
                    for (let i: number = 1; i < voiceCount - 1; i++) {
                        const swappedIndex: number = i + Math.floor(Math.random() * (voiceCount - i));
                        const temp: number = tone.phases[i];
                        tone.phases[i] = tone.phases[swappedIndex];
                        tone.phases[swappedIndex] = temp;
                    }
                    instrumentState.unisonInitialized = true;
                    tone.unisonHasUpdated = true;
                } else if (!instrumentState.unisonInitialized && !instrument.unisonAntiPhased) {
                    for (let i: number = 0; i < Config.unisonVoicesMax; i++) {
                        tone.phases[i] = 0;
                    }
                    instrumentState.unisonInitialized = true;
                }
            } else if (instrument.type == InstrumentType.supersaw) {
                const unisonVoices: number = instrument.unisonVoices;
                const unisonSpread: number = instrument.unisonSpread;
                const unisonOffset: number = instrument.unisonOffset;
                const unisonEnvelopeStart = envelopeStarts[EnvelopeComputeIndex.unison];
                const unisonEnvelopeEnd = envelopeEnds[EnvelopeComputeIndex.unison];

                const unisonStartA: number = Math.pow(2.0, (unisonOffset + unisonSpread) * unisonEnvelopeStart / 12.0);
                const unisonEndA: number = Math.pow(2.0, (unisonOffset + unisonSpread) * unisonEnvelopeEnd / 12.0);
                tone.phaseDeltas[0] = startFreq * sampleTime * unisonStartA;
                tone.phaseDeltaScales[0] = basePhaseDeltaScale * Math.pow(unisonEndA / unisonStartA, 1.0 / roundedSamplesPerTick);

                const divisor = (unisonVoices == 1) ? 1 : (unisonVoices - 1);
                for (let voice: number = 1; voice < unisonVoices; voice++) {
                    const unisonStart: number = Math.pow(2.0, (unisonOffset + unisonSpread - (2 * voice * unisonSpread / divisor)) * unisonEnvelopeStart / 12.0) * (specialIntervalMult);
                    const unisonEnd: number = Math.pow(2.0, (unisonOffset + unisonSpread - (2 * voice * unisonSpread / divisor)) * unisonEnvelopeEnd / 12.0) * (specialIntervalMult);
                    tone.phaseDeltas[voice] = startFreq * sampleTime * unisonStart;
                    tone.phaseDeltaScales[voice] = basePhaseDeltaScale * Math.pow(unisonEnd / unisonStart, 1.0 / roundedSamplesPerTick);
                }
            } else {
                tone.phaseDeltas[0] = startFreq * sampleTime;
                tone.phaseDeltaScales[0] = basePhaseDeltaScale;
            }

            // TODO: make expressionStart and expressionEnd variables earlier and modify those
            // instead of these supersawExpression variables.
            let supersawExpressionStart: number = instrument.unisonExpression * instrument.unisonVoices / 1.4;
            let supersawExpressionEnd: number = instrument.unisonExpression * instrument.unisonVoices / 1.4;

            if (instrument.type == InstrumentType.supersaw) {
                const minFirstVoiceAmplitude: number = 1.0 / Math.sqrt(Config.supersawVoiceCount);

                // Dynamism mods
                let useDynamismStart: number = instrument.supersawDynamism / Config.supersawDynamismMax;
                let useDynamismEnd: number = instrument.supersawDynamism / Config.supersawDynamismMax;
                if (this.isModActive(Config.modulators.dictionary["dynamism"].index, channelIndex, tone.instrumentIndex)) {
                    useDynamismStart = (this.getModValue(Config.modulators.dictionary["dynamism"].index, channelIndex, tone.instrumentIndex, false)) / Config.supersawDynamismMax;
                    useDynamismEnd = (this.getModValue(Config.modulators.dictionary["dynamism"].index, channelIndex, tone.instrumentIndex, true)) / Config.supersawDynamismMax;
                }

                const curvedDynamismStart: number = 1.0 - Math.pow(Math.max(0.0, 1.0 - useDynamismStart * envelopeStarts[EnvelopeComputeIndex.supersawDynamism]), 0.2);
                const curvedDynamismEnd: number = 1.0 - Math.pow(Math.max(0.0, 1.0 - useDynamismEnd * envelopeEnds[EnvelopeComputeIndex.supersawDynamism]), 0.2);
                const firstVoiceAmplitudeStart: number = Math.pow(2.0, Math.log2(minFirstVoiceAmplitude) * curvedDynamismStart);
                const firstVoiceAmplitudeEnd: number = Math.pow(2.0, Math.log2(minFirstVoiceAmplitude) * curvedDynamismEnd);

                const dynamismStart: number = Math.sqrt((1.0 / Math.pow(firstVoiceAmplitudeStart, 2.0) - 1.0) / (Config.supersawVoiceCount - 1.0));
                const dynamismEnd: number = Math.sqrt((1.0 / Math.pow(firstVoiceAmplitudeEnd, 2.0) - 1.0) / (Config.supersawVoiceCount - 1.0));
                tone.supersawDynamism = dynamismStart;
                tone.supersawDynamismDelta = (dynamismEnd - dynamismStart) / roundedSamplesPerTick;

                const initializeSupersaw: boolean = (tone.supersawDelayIndex == -1);
                if (initializeSupersaw || !instrumentState.unisonInitialized) {
                    // Goal: generate sawtooth phases such that the combined initial amplitude
                    // cancel out to minimize pop. Algorithm: generate sorted phases, iterate over
                    // their sawtooth drop points to find a combined zero crossing, then offset the
                    // phases so they start there.

                    // Generate random phases in ascending order by adding positive randomly
                    // sized gaps between adjacent phases. For a proper distribution of random
                    // events, the gaps sizes should be an "exponential distribution", which is
                    // just: -Math.log(Math.random()). At the end, normalize the phases to a 0-1
                    // range by dividing by the final value of the accumulator.
                    const voiceCount: number = instrument.unisonAntiPhased ? Config.supersawVoiceCount * Config.unisonVoicesMax : Config.supersawVoiceCount;

                    let accumulator: number = 0.0;
                    for (let i: number = 0; i < voiceCount; i++) {
                        tone.phases[i] = accumulator;
                        accumulator += -Math.log(Math.random());
                    }

                    const amplitudeSum: number = 1.0 + (voiceCount - 1.0) * dynamismStart;
                    const slope: number = amplitudeSum;

                    // Find the initial amplitude of the sum of sawtooths with the normalized
                    // set of phases.
                    let sample: number = 0.0;
                    for (let i: number = 0; i < voiceCount; i++) {
                        const amplitude: number = (i == 0) ? 1.0 : dynamismStart;
                        const normalizedPhase: number = tone.phases[i] / accumulator;
                        tone.phases[i] = normalizedPhase;
                        sample += (normalizedPhase - 0.5) * amplitude;
                    }

                    // Find the phase of the zero crossing of the sum of the sawtooths. You can
                    // use a constant slope and the distance between sawtooth drops to determine if
                    // the zero crossing occurs between them. Note that a small phase means that
                    // the corresponding drop for that wave is far away, and a big phase means the
                    // drop is nearby, so to iterate forward through the drops we iterate backward
                    // through the phases.
                    let zeroCrossingPhase: number = 1.0;
                    let prevDrop: number = 0.0;
                    for (let i: number = voiceCount - 1; i >= 0; i--) {
                        const nextDrop: number = 1.0 - tone.phases[i];
                        const phaseDelta: number = nextDrop - prevDrop;
                        if (sample < 0.0) {
                            const distanceToZeroCrossing: number = -sample / slope;
                            if (distanceToZeroCrossing < phaseDelta) {
                                zeroCrossingPhase = prevDrop + distanceToZeroCrossing;
                                break;
                            }
                        }
                        const amplitude: number = (i == 0) ? 1.0 : dynamismStart;
                        sample += phaseDelta * slope - amplitude;
                        prevDrop = nextDrop;
                    }
                    for (let i: number = 0; i < voiceCount; i++) {
                        tone.phases[i] += zeroCrossingPhase;
                    }

                    // Randomize the (initially sorted) order of the phases (aside from the
                    // first one) so that they don't correlate to the detunes that are also
                    // based on index.
                    for (let i: number = 1; i < voiceCount - 1; i++) {
                        const swappedIndex: number = i + Math.floor(Math.random() * (voiceCount - i));
                        const temp: number = tone.phases[i];
                        tone.phases[i] = tone.phases[swappedIndex];
                        tone.phases[swappedIndex] = temp;
                    }

                    if (!instrument.unisonAntiPhased) {
                        //extend phase map to have duplicate phases representing each unison voice
                        for (let i: number = 1; i < instrument.unisonVoices; i++) {
                            for (let j: number = 0; j < Config.supersawVoiceCount; j++) {
                                tone.phases[i * Config.supersawVoiceCount + j] = tone.phases[j];
                            }
                        }
                    }
                    instrumentState.unisonInitialized = true;
                }

                const baseSpreadSlider: number = instrument.supersawSpread / Config.supersawSpreadMax;
                // Spread mods
                let useSpreadStart: number = baseSpreadSlider;
                let useSpreadEnd: number = baseSpreadSlider;
                if (this.isModActive(Config.modulators.dictionary["spread"].index, channelIndex, tone.instrumentIndex)) {
                    useSpreadStart = (this.getModValue(Config.modulators.dictionary["spread"].index, channelIndex, tone.instrumentIndex, false)) / Config.supersawSpreadMax;
                    useSpreadEnd = (this.getModValue(Config.modulators.dictionary["spread"].index, channelIndex, tone.instrumentIndex, true)) / Config.supersawSpreadMax;
                }

				const spreadSliderStart: number = Math.max(0, useSpreadStart) * envelopeStarts[EnvelopeComputeIndex.supersawSpread];
				const spreadSliderEnd:   number = Math.max(0, useSpreadEnd) * envelopeEnds[EnvelopeComputeIndex.supersawSpread];
				// Just use the average detune for the current tick in the below loop.
				const averageSpreadSlider: number = (spreadSliderStart + spreadSliderEnd) * 0.5;
				const curvedSpread: number = Math.pow(1.0 - Math.sqrt(Math.max(0.0, 1.0 - averageSpreadSlider)), 1.75);
				for (let i = 0; i < Config.supersawVoiceCount; i++) {
					// Spread out the detunes around the center;
					const offset: number = (i == 0) ? 0.0 : Math.pow((((i + 1) >> 1) - 0.5 + 0.025 * ((i & 2) - 1)) / (Config.supersawVoiceCount >> 1), 1.1) * ((i & 1) * 2 - 1);
					tone.supersawUnisonDetunes[i] = Math.pow(2.0, curvedSpread * offset / 12.0);
				}

                const baseShape: number = instrument.supersawShape / Config.supersawShapeMax;
                // Saw shape mods
                let useShapeStart: number = baseShape * envelopeStarts[EnvelopeComputeIndex.supersawShape];
                let useShapeEnd: number = baseShape * envelopeEnds[EnvelopeComputeIndex.supersawShape];
                if (this.isModActive(Config.modulators.dictionary["saw shape"].index, channelIndex, tone.instrumentIndex)) {
                    useShapeStart = (this.getModValue(Config.modulators.dictionary["saw shape"].index, channelIndex, tone.instrumentIndex, false)) / Config.supersawShapeMax;
                    useShapeEnd = (this.getModValue(Config.modulators.dictionary["saw shape"].index, channelIndex, tone.instrumentIndex, true)) / Config.supersawShapeMax;
                }

                const shapeStart: number = useShapeStart * envelopeStarts[EnvelopeComputeIndex.supersawShape];
                const shapeEnd: number = useShapeEnd * envelopeEnds[EnvelopeComputeIndex.supersawShape];
                tone.supersawShape = shapeStart;
                tone.supersawShapeDelta = (shapeEnd - shapeStart) / roundedSamplesPerTick;

                //decimal offset mods
                let decimalOffsetModStart: number = instrument.decimalOffset;
                if (this.isModActive(Config.modulators.dictionary["decimal offset"].index, channelIndex, tone.instrumentIndex)) {
                    decimalOffsetModStart = this.getModValue(Config.modulators.dictionary["decimal offset"].index, channelIndex, tone.instrumentIndex, false);
                }

                const decimalOffsetStart: number = decimalOffsetModStart * envelopeStarts[EnvelopeComputeIndex.decimalOffset];
                // ...is including tone.decimalOffset still necessary?
                tone.decimalOffset = decimalOffsetStart;

                const basePulseWidth: number = getPulseWidthRatio(instrument.pulseWidth);

                // Check for PWM mods to this instrument
                let pulseWidthModStart: number = basePulseWidth;
                let pulseWidthModEnd: number = basePulseWidth;
                if (this.isModActive(Config.modulators.dictionary["pulse width"].index, channelIndex, tone.instrumentIndex)) {
                    pulseWidthModStart = (this.getModValue(Config.modulators.dictionary["pulse width"].index, channelIndex, tone.instrumentIndex, false)) / (Config.pulseWidthRange * 2);
                    pulseWidthModEnd = (this.getModValue(Config.modulators.dictionary["pulse width"].index, channelIndex, tone.instrumentIndex, true)) / (Config.pulseWidthRange * 2);
                }

                let pulseWidthStart: number = pulseWidthModStart * envelopeStarts[EnvelopeComputeIndex.pulseWidth];
                let pulseWidthEnd: number = pulseWidthModEnd * envelopeEnds[EnvelopeComputeIndex.pulseWidth];
                pulseWidthStart -= decimalOffsetStart / 10000;
                pulseWidthEnd -= decimalOffsetStart / 10000;
                const phaseDeltaStart: number = (tone.supersawPrevPhaseDelta != null) ? tone.supersawPrevPhaseDelta : startFreq * sampleTime;
                const phaseDeltaEnd: number = startFreq * sampleTime * freqEndRatio;
                tone.supersawPrevPhaseDelta = phaseDeltaEnd;
                const delayLengthStart = pulseWidthStart / phaseDeltaStart;
                const delayLengthEnd = pulseWidthEnd / phaseDeltaEnd;
                tone.supersawDelayLength = delayLengthStart;
                tone.supersawDelayLengthDelta = (delayLengthEnd - delayLengthStart) / roundedSamplesPerTick;
                const minBufferLength: number = Math.ceil(Math.max(delayLengthStart, delayLengthEnd)) + 2;

                if (tone.supersawDelayLine == null || tone.supersawDelayLine.length <= minBufferLength) {
                    // The delay line buffer will get reused for other tones so might as well
                    // start off with a buffer size that is big enough for most notes.
                    const likelyMaximumLength: number = Math.ceil(0.5 * this.samplesPerSecond / Instrument.frequencyFromPitch(24));
                    const newDelayLine: Float32Array = new Float32Array(SynthProcessor.fittingPowerOfTwo(Math.max(likelyMaximumLength, minBufferLength)));
                    if (!initializeSupersaw && tone.supersawDelayLine != null) {
                        // If the tone has already started but the buffer needs to be reallocated,
                        // transfer the old data to the new buffer.
                        const oldDelayBufferMask: number = (tone.supersawDelayLine.length - 1) >> 0;
                        const startCopyingFromIndex: number = tone.supersawDelayIndex;
                        for (let i: number = 0; i < tone.supersawDelayLine.length; i++) {
                            newDelayLine[i] = tone.supersawDelayLine[(startCopyingFromIndex + i) & oldDelayBufferMask];
                        }
                    }
                    tone.supersawDelayLine = newDelayLine;
                    tone.supersawDelayIndex = tone.supersawDelayLine.length;
                } else if (initializeSupersaw) {
                    tone.supersawDelayLine.fill(0.0);
                    tone.supersawDelayIndex = tone.supersawDelayLine.length;
                }

                const pulseExpressionRatio: number = Config.pwmBaseExpression / Config.supersawBaseExpression;
                supersawExpressionStart *= (1.0 + (pulseExpressionRatio - 1.0) * shapeStart) / Math.sqrt(1.0 + (Config.supersawVoiceCount - 1.0) * dynamismStart * dynamismStart);
                supersawExpressionEnd *= (1.0 + (pulseExpressionRatio - 1.0) * shapeEnd) / Math.sqrt(1.0 + (Config.supersawVoiceCount - 1.0) * dynamismEnd * dynamismEnd);
            }

            let expressionStart: number = settingsExpressionMult * fadeExpressionStart * chordExpressionStart * pitchExpressionStart * envelopeStarts[EnvelopeComputeIndex.noteVolume] * supersawExpressionStart;
            let expressionEnd: number = settingsExpressionMult * fadeExpressionEnd * chordExpressionEnd * pitchExpressionEnd * envelopeEnds[EnvelopeComputeIndex.noteVolume] * supersawExpressionEnd;

            // Check for mod-related volume delta
            if (this.isModActive(Config.modulators.dictionary["note volume"].index, channelIndex, tone.instrumentIndex)) {
                // Linear falloff below 0, normal volume formula above 0. Seems to work best for scaling since the normal volume mult formula has a big gap from -25 to -24.
                const startVal: number = this.getModValue(Config.modulators.dictionary["note volume"].index, channelIndex, tone.instrumentIndex, false);
                const endVal: number = this.getModValue(Config.modulators.dictionary["note volume"].index, channelIndex, tone.instrumentIndex, true)
                expressionStart *= ((startVal <= 0) ? ((startVal + Config.volumeRange / 2) / (Config.volumeRange / 2)) : SynthProcessor.instrumentVolumeToVolumeMult(startVal));
                expressionEnd *= ((endVal <= 0) ? ((endVal + Config.volumeRange / 2) / (Config.volumeRange / 2)) : SynthProcessor.instrumentVolumeToVolumeMult(endVal));
            }
            if (isMono && tone.pitchCount <= instrument.monoChordTone) { //silence if tone doesn't exist
                expressionStart = 0;
                expressionEnd = 0;
                instrumentState.awake = false;
            }

            tone.expression = expressionStart;
            tone.expressionDelta = (expressionEnd - expressionStart) / roundedSamplesPerTick;


            if (instrument.type == InstrumentType.pickedString) {
                let stringDecayStart: number;
                if (tone.prevStringDecay != null) {
                    stringDecayStart = tone.prevStringDecay;
                } else {
                    const sustainEnvelopeStart: number = tone.envelopeComputer.envelopeStarts[EnvelopeComputeIndex.stringSustain];
                    stringDecayStart = 1.0 - Math.min(1.0, sustainEnvelopeStart * tone.stringSustainStart / (Config.stringSustainRange - 1));
                }
                const sustainEnvelopeEnd: number = tone.envelopeComputer.envelopeEnds[EnvelopeComputeIndex.stringSustain];
                let stringDecayEnd: number = 1.0 - Math.min(1.0, sustainEnvelopeEnd * tone.stringSustainEnd / (Config.stringSustainRange - 1));
                tone.prevStringDecay = stringDecayEnd;

                const unisonVoices: number = instrument.unisonVoices;
                for (let i: number = tone.pickedStrings.length; i < unisonVoices; i++) {
                    tone.pickedStrings[i] = new PickedString();
                }

                if (tone.atNoteStart && !transition.continues && !tone.forceContinueAtStart) {
                    for (const pickedString of tone.pickedStrings) {
                        // Force the picked string to retrigger the attack impulse at the start of the note.
                        pickedString.delayIndex = -1;
                    }
                }

                for (let i: number = 0; i < unisonVoices; i++) {
                    tone.pickedStrings[i].update(this, instrumentState, tone, i, roundedSamplesPerTick, stringDecayStart, stringDecayEnd, instrument.stringSustainType);
                }
            }
        }
    }

    public static getLFOAmplitude(instrument: Instrument, secondsIntoBar: number): number {
        let effect: number = 0.0;
        for (const vibratoPeriodSeconds of Config.vibratoTypes[instrument.vibratoType].periodsSeconds) {
            effect += Math.sin(Math.PI * 2.0 * secondsIntoBar / vibratoPeriodSeconds);
        }
        return effect;
    }

    public static getInstrumentSynthFunction(instrument: Instrument): Function {
        if (instrument.type == InstrumentType.fm) {
            const voiceCount: number = instrument.unisonVoices;
            const fingerprint: string = instrument.algorithm + "_" + instrument.feedbackType + "_" + voiceCount;
            if (SynthProcessor.fmSynthFunctionCache[fingerprint] == undefined) {
                const synthSource: string[] = [];

                for (const line of SynthProcessor.fmSourceTemplate) {
                    if (line.indexOf("// CARRIER OUTPUTS") != -1) {
                        const outputs: string[] = [];
                        for (let j: number = 0; j < Config.algorithms[instrument.algorithm].carrierCount; j++) {
                            for (let voice = 0; voice < voiceCount; voice++) {
                                outputs.push("operator" + j + "Scaled" + voice);
                            }
                        }
                        synthSource.push(line.replace("/*operator#Scaled*/", outputs.join(" + ")));
                    } else if (line.indexOf("// INSERT OPERATOR COMPUTATION HERE") != -1) {
                        for (let j: number = Config.operatorCount - 1; j >= 0; j--) {
                            for (let voice = 0; voice < voiceCount; voice++) {
                                for (const operatorLine of SynthProcessor.operatorSourceTemplate) {
                                    if (operatorLine.indexOf("/* + operator@Scaled*/") != -1) {
                                        let modulators = "";
                                        for (const modulatorNumber of Config.algorithms[instrument.algorithm].modulatedBy[j]) {
                                            modulators += " + operator" + (modulatorNumber - 1) + "Scaled" + voice; //use the corresponding fm modulator unison value
                                        }

                                        const feedbackIndices: ReadonlyArray<number> = Config.feedbacks[instrument.feedbackType].indices[j];
                                        if (feedbackIndices.length > 0) {
                                            modulators += " + feedbackMult * (";
                                            const feedbacks: string[] = [];
                                            for (const modulatorNumber of feedbackIndices) {
                                                feedbacks.push("operator" + (modulatorNumber - 1) + "Output" + voice); //use the corresponding unison output value for feedback
                                            }
                                            modulators += feedbacks.join(" + ") + ")";
                                        }
                                        synthSource.push(operatorLine.replace(/\#/g, j + "").replace(/\~/g, voice + "").replace("/* + operator@Scaled*/", modulators));
                                    } else {
                                        synthSource.push(operatorLine.replace(/\#/g, j + "").replace(/\~/g, voice + ""));
                                    }
                                }
                            }
                        }
                    } else if (line.indexOf("#") != -1 || line.indexOf("~") != -1) {
                        for (let j = 0; j < Config.operatorCount; j++) {
                            const vc: number = line.indexOf("~") != -1 ? voiceCount : 1;
                            for (let voice = 0; voice < vc; voice++) {
                                synthSource.push(line.replace(/\#/g, j + "").replace(/\~/g, voice + ""));
                            }
                        }
                    } else {
                        synthSource.push(line);
                    }
                }

                const wrappedFmSynth: string = "return (synth, bufferIndex, roundedSamplesPerTick, tone, instrument) => {" + synthSource.join("\n") + "}";

                // console.log(wrappedFmSynth)

                SynthProcessor.fmSynthFunctionCache[fingerprint] = new Function("Config", "Synth", wrappedFmSynth)(Config, SynthProcessor);

            }
            return SynthProcessor.fmSynthFunctionCache[fingerprint];
        } else if (instrument.type == InstrumentType.chip) {
            if (instrument.isUsingAdvancedLoopControls) {
                return SynthProcessor.loopableChipSynth;
            }
            return SynthProcessor.chipSynth;
        } else if (instrument.type == InstrumentType.customChipWave) {
            return SynthProcessor.chipSynth;
        } else if (instrument.type == InstrumentType.harmonics) {
            return SynthProcessor.harmonicsSynth;
        } else if (instrument.type == InstrumentType.pwm) {
            return SynthProcessor.pulseWidthSynth;
        } else if (instrument.type == InstrumentType.supersaw) {
            return SynthProcessor.supersawSynth;
        } else if (instrument.type == InstrumentType.pickedString) {
            return SynthProcessor.pickedStringSynth;
        } else if (instrument.type == InstrumentType.noise) {
            return SynthProcessor.noiseSynth;
        } else if (instrument.type == InstrumentType.spectrum) {
            return SynthProcessor.spectrumSynth;
        } else if (instrument.type == InstrumentType.drumset) {
            return SynthProcessor.drumsetSynth;
        } else if (instrument.type == InstrumentType.mod) {
            return SynthProcessor.modSynth;
        } else if (instrument.type == InstrumentType.fm6op) {
            const voiceCount: number = instrument.unisonVoices;
            const fingerprint: string = instrument.customAlgorithm.name + "_" + instrument.customFeedbackType.name + "_" + voiceCount;
            if (SynthProcessor.fm6SynthFunctionCache[fingerprint] == undefined) {
                const synthSource: string[] = [];

                for (const line of SynthProcessor.fmSourceTemplate) {
                    if (line.indexOf("// CARRIER OUTPUTS") != -1) {
                        const outputs: string[] = [];
                        for (let j: number = 0; j < instrument.customAlgorithm.carrierCount; j++) {
                            for (let voice = 0; voice < voiceCount; voice++) {
                                outputs.push("operator" + j + "Scaled" + voice);
                            }
                        }
                        synthSource.push(line.replace("/*operator#Scaled*/", outputs.join(" + ")));
                    } else if (line.indexOf("// INSERT OPERATOR COMPUTATION HERE") != -1) {
                        for (let j: number = Config.operatorCount + 2 - 1; j >= 0; j--) {
                            for (let voice = 0; voice < voiceCount; voice++) {
                                for (const operatorLine of SynthProcessor.operatorSourceTemplate) {
                                    if (operatorLine.indexOf("/* + operator@Scaled*/") != -1) {
                                        let modulators = "";
                                        for (const modulatorNumber of instrument.customAlgorithm.modulatedBy[j]) {
                                            modulators += " + operator" + (modulatorNumber - 1) + "Scaled" + voice; //use the corresponding fm modulator unison value
                                        }

                                        const feedbackIndices: ReadonlyArray<number> = instrument.customFeedbackType.indices[j];
                                        if (feedbackIndices.length > 0) {
                                            modulators += " + feedbackMult * (";
                                            const feedbacks: string[] = [];
                                            for (const modulatorNumber of feedbackIndices) {
                                                feedbacks.push("operator" + (modulatorNumber - 1) + "Output" + voice); //use the corresponding unison output value for feedback
                                            }
                                            modulators += feedbacks.join(" + ") + ")";
                                        }
                                        synthSource.push(operatorLine.replace(/\#/g, j + "").replace(/\~/g, voice + "").replace("/* + operator@Scaled*/", modulators));
                                    } else {
                                        synthSource.push(operatorLine.replace(/\#/g, j + "").replace(/\~/g, voice + ""));
                                    }
                                }
                            }
                        }
                    } else if (line.indexOf("#") != -1) {
                        for (let j = 0; j < Config.operatorCount + 2; j++) {
                            const vc: number = line.indexOf("~") != -1 ? voiceCount : 1;
                            for (let voice = 0; voice < vc; voice++) {
                                synthSource.push(line.replace(/\#/g, j + "").replace(/\~/g, voice + ""));
                            }
                        }
                    } else {
                        synthSource.push(line);
                    }
                }

                const wrappedFm6Synth: string = "return (synth, bufferIndex, roundedSamplesPerTick, tone, instrument) => {" + synthSource.join("\n") + "}";
                
                // console.log(wrappedFm6Synth);
                
                SynthProcessor.fm6SynthFunctionCache[fingerprint] = new Function("Config", "Synth", wrappedFm6Synth)(Config, SynthProcessor);
            }
            return SynthProcessor.fm6SynthFunctionCache[fingerprint];
        } else {
            throw new Error("Unrecognized instrument type: " + instrument.type);
        }
    }
    static wrap(x: number, b: number): number {
        if (x < 0) {
            x += b;
        }
        if (x >= b) {
            x -= b;
        }
        return x;
    }
    static loopableChipSynth(synth: SynthProcessor, bufferIndex: number, roundedSamplesPerTick: number, tone: Tone, instrumentState: InstrumentState): void {
        // @TODO:
        // - Longer declicking? This is more difficult than I thought.
        //   When determining this automatically is difficult (or the input
        //   samples are expected to vary too much), this is left up to the
        //   user.
        const voiceCount: number = Math.max(2, instrumentState.unisonVoices);
        let chipFunction: Function = SynthProcessor.loopableChipFunctionCache[instrumentState.unisonVoices];
        if (chipFunction == undefined) {
            let chipSource: string = "return (synth, bufferIndex, roundedSamplesPerTick, tone, instrumentState) => {";


            chipSource += `
            const aliases = (effectsIncludeDistortion(instrumentState.effects) && instrumentState.aliases);
            // const aliases = false;
            const data = synth.tempMonoInstrumentSampleBuffer;
            const wave = instrumentState.wave;
            const volumeScale = instrumentState.volumeScale;
            const waveLength = (aliases && instrumentState.type == 8) ? wave.length : wave.length - 1;

            let chipWaveLoopEnd = Math.max(0, Math.min(waveLength, instrumentState.chipWaveLoopEnd));
            let chipWaveLoopStart = Math.max(0, Math.min(chipWaveLoopEnd - 1, instrumentState.chipWaveLoopStart));
            `
            // @TODO: This is where to set things up for the release loop mode.
            // const ticksSinceReleased = tone.ticksSinceReleased;
            // if (ticksSinceReleased > 0) {
            //     chipWaveLoopStart = 0;
            //     chipWaveLoopEnd = waveLength - 1;
            // }
            chipSource += `
            let chipWaveLoopLength = chipWaveLoopEnd - chipWaveLoopStart;
            if (chipWaveLoopLength < 2) {
                chipWaveLoopStart = 0;
                chipWaveLoopEnd = waveLength;
                chipWaveLoopLength = waveLength;
            }
            const chipWaveLoopMode = instrumentState.chipWaveLoopMode;
            const chipWavePlayBackwards = instrumentState.chipWavePlayBackwards;
            const unisonSign = tone.specialIntervalExpressionMult * instrumentState.unisonSign;
            if((instrumentState.unisonSpread == 0 || instrumentState.unisonBuzzes) && !instrumentState.chord.customInterval) {
            `
            for (let i: number = 1; i < voiceCount; i++) {
                chipSource += `
                if (instrumentState.unisonVoices <= #)
                    tone.phases[#] = tone.phases[#-1];
                `.replaceAll("#", i + "");
            }
            chipSource += `
            }`
            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `
                let phaseDelta# = tone.phaseDeltas[#] * waveLength;
                let direction# = tone.directions[#];
                let chipWaveCompletion# = tone.chipWaveCompletions[#];

                `.replaceAll("#", i + "");
            }

            chipSource += `
            if (chipWaveLoopMode === 3 || chipWaveLoopMode === 2 || chipWaveLoopMode === 0) {
                // If playing once or looping, we force the correct direction,
                // since it shouldn't really change. This is mostly so that if
                // the mode is changed midway through playback, it won't get
                // stuck on the wrong direction.
                if (!chipWavePlayBackwards) {`
            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `
                        direction# = 1;
                        `.replaceAll("#", i + "");
            }
            chipSource += `} else {`
            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `
                        direction# = -1;
                        `.replaceAll("#", i + "");
            }
            chipSource += `
                }
            }
            if (chipWaveLoopMode === 0 || chipWaveLoopMode === 1) {`
            // If looping or ping-ponging, we clear the completion status,
            // as it's not relevant anymore. This is mostly so that if the
            // mode is changed midway through playback, it won't get stuck
            // on zero volume.
            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `
                    chipWaveCompletion# = 0;
                    `.replaceAll("#", i + "");
            }
            chipSource += `    
            }
            
            const chipWaveCompletionFadeLength = 1000;
            let expression = +tone.expression;
            const expressionDelta = +tone.expressionDelta;
            `
            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `
                let lastWave# = tone.chipWaveCompletionsLastWave[#];
                const phaseDeltaScale# = +tone.phaseDeltaScales[#];
                let phase# = (tone.phases[#] - (tone.phases[#] | 0)) * waveLength;
                let prevWaveIntegral# = 0;

                `.replaceAll("#", i + "");
            }
            chipSource += `
            if (!aliases) {
            `
            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `
                    const phase#Int = Math.floor(phase#);
                    const index# = Synth.wrap(phase#Int, waveLength);
                    const phaseRatio# = phase# - phase#Int;
                    prevWaveIntegral# = +wave[index#];
                    prevWaveIntegral# += (wave[Synth.wrap(index# + 1, waveLength)] - prevWaveIntegral#) * phaseRatio#;
                    `.replaceAll("#", i + "");
            }
            chipSource += `
            }
            const filters = tone.noteFilters;
            const filterCount = tone.noteFilterCount | 0;
            let initialFilterInput1 = +tone.initialNoteFilterInput1;
            let initialFilterInput2 = +tone.initialNoteFilterInput2;
            const applyFilters = Synth.applyFilters;
            const stopIndex = bufferIndex + roundedSamplesPerTick;
            `
            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `
                let prevWave# = tone.chipWavePrevWaves[#];

                `.replaceAll("#", i + "");
            }
            chipSource += `
            for (let sampleIndex = bufferIndex; sampleIndex < stopIndex; sampleIndex++) {
                let wrapped = 0;
            `
            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `
                    if (chipWaveCompletion# > 0 && chipWaveCompletion# < chipWaveCompletionFadeLength) {
                        chipWaveCompletion#++;
                    }
                    phase# += phaseDelta# * direction#;

                    `.replaceAll("#", i + "");
            }
            chipSource += `
                if (chipWaveLoopMode === 2) {
                `
            // once
            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `
                        if (direction# === 1) {
                            if (phase# > waveLength) {
                                if (chipWaveCompletion# <= 0) {
                                    lastWave# = prevWave#;
                                    chipWaveCompletion#++;
                                }
                                wrapped = #;
                            }
                        } else if (direction# === -1) {
                            if (phase# < 0) {
                                if (chipWaveCompletion# <= 0) {
                                    lastWave# = prevWave#;
                                    chipWaveCompletion#++;
                                }
                                wrapped = 1;
                            }
                        }

                        `.replaceAll("#", i + "");
            }
            chipSource += `
                } else if (chipWaveLoopMode === 3) {
                `
            // loop once
            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `
                        if (direction# === 1) {
                            if (phase# > chipWaveLoopEnd) {
                                if (chipWaveCompletion# <= 0) {
                                    lastWave# = prevWave#;
                                    chipWaveCompletion#++;
                                }
                                wrapped = 1;
                            }
                        } else if (direction# === -1) {
                            if (phase# < chipWaveLoopStart) {
                                if (chipWaveCompletion# <= 0) {
                                    lastWave# = prevWave#;
                                    chipWaveCompletion#++;
                                }
                                wrapped = 1;
                            }
                        }

                        `.replaceAll("#", i + "");
            }
            chipSource += `
                } else if (chipWaveLoopMode === 0) {
                `
            // loop
            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `
                        if (direction# === 1) {
                            if (phase# > chipWaveLoopEnd) {
                                phase# = chipWaveLoopStart + Synth.wrap(phase# - chipWaveLoopEnd, chipWaveLoopLength);
                                // phase# = chipWaveLoopStart;
                                wrapped = 1;
                            }
                        } else if (direction# === -1) {
                            if (phase# < chipWaveLoopStart) {
                                phase# = chipWaveLoopEnd - Synth.wrap(chipWaveLoopStart - phase#, chipWaveLoopLength);
                                // phase# = chipWaveLoopEnd;
                                wrapped = 1;
                            }
                        }

                        `.replaceAll("#", i + "");
            }
            chipSource += `    
                } else if (chipWaveLoopMode === 1) {
                `
            // ping-pong
            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `
                        if (direction# === 1) {
                            if (phase# > chipWaveLoopEnd) {
                                phase# = chipWaveLoopEnd - Synth.wrap(phase# - chipWaveLoopEnd, chipWaveLoopLength);
                                // phase# = chipWaveLoopEnd;
                                direction# = -1;
                                wrapped = 1;
                            }
                        } else if (direction# === -1) {
                            if (phase# < chipWaveLoopStart) {
                                phase# = chipWaveLoopStart + Synth.wrap(chipWaveLoopStart - phase#, chipWaveLoopLength);
                                // phase# = chipWaveLoopStart;
                                direction# = 1;
                                wrapped = 1;
                            }
                        }

                        `.replaceAll("#", i + "");
            }
            chipSource += `    
                }
                `
            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `
                    let wave# = 0;
                    `.replaceAll("#", i + "");
            }
            chipSource += `    
                let inputSample = 0;
                if (aliases) {
                    inputSample = 0;
                `
            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `
                        wave# = wave[Synth.wrap(Math.floor(phase#), waveLength)];
                        prevWave# = wave#;
                        const completionFade# = chipWaveCompletion# > 0 ? ((chipWaveCompletionFadeLength - Math.min(chipWaveCompletion#, chipWaveCompletionFadeLength)) / chipWaveCompletionFadeLength) : 1;
                        
                        if (chipWaveCompletion# > 0) {
                            inputSample += lastWave# * completionFade#;
                        } else {
                            inputSample += wave#;
                        }
                        `.replaceAll("#", i + "");
            }
            chipSource += `   
                } else {
                `
            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `
                        const phase#Int = Math.floor(phase#);
                        const index# = Synth.wrap(phase#Int, waveLength);
                        let nextWaveIntegral# = wave[index#];
                        const phaseRatio# = phase# - phase#Int;
                        nextWaveIntegral# += (wave[Synth.wrap(index# + 1, waveLength)] - nextWaveIntegral#) * phaseRatio#;
                        `.replaceAll("#", i + "");
            }

            chipSource += `
                    if (!(chipWaveLoopMode === 0 && chipWaveLoopStart === 0 && chipWaveLoopEnd === waveLength) && wrapped !== 0) {
                    `
            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `
                            let pwi# = 0;
                            const phase#_ = Math.max(0, phase# - phaseDelta# * direction#);
                            const phase#Int = Math.floor(phase#_);
                            const index# = Synth.wrap(phase#Int, waveLength);
                            pwi# = wave[index#];
                            pwi# += (wave[Synth.wrap(index# + 1, waveLength)] - pwi#) * (phase#_ - phase#Int) * direction#;
                            prevWaveIntegral# = pwi#;
                            `.replaceAll("#", i + "");
            }
            chipSource += `    
                    }
                    if (chipWaveLoopMode === 1 && wrapped !== 0) {
                    `
            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `
                            wave# = prevWave#;
                            `.replaceAll("#", i + "");
            }
            chipSource += `
                    } else {
                    `
            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `
                            wave# = (nextWaveIntegral# - prevWaveIntegral#) / (phaseDelta# * direction#);
                            `.replaceAll("#", i + "");
            }
            chipSource += `
                    }
                    `
            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `
                        prevWave# = wave#;
                        prevWaveIntegral# = nextWaveIntegral#;
                        const completionFade# = chipWaveCompletion# > 0 ? ((chipWaveCompletionFadeLength - Math.min(chipWaveCompletion#, chipWaveCompletionFadeLength)) / chipWaveCompletionFadeLength) : 1;
                        if (chipWaveCompletion# > 0) {
                            inputSample += lastWave# * completionFade#;
                        } else {
                            inputSample += wave#;
                        }
                        `.replaceAll("#", i + "");
            }
            chipSource += `
                }
                const sample = applyFilters(inputSample * volumeScale, initialFilterInput1, initialFilterInput2, filterCount, filters);
                initialFilterInput2 = initialFilterInput1;
                initialFilterInput1 = inputSample * volumeScale;
                const output = sample * expression;
                expression += expressionDelta;
                data[sampleIndex] += output;
                `
            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `
                    phaseDelta# *= phaseDeltaScale#;
                    `.replaceAll("#", i + "");
            }
            chipSource += `
            }
            `
            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `
                tone.phases[#] = phase# / waveLength;
                tone.phaseDeltas[#] = phaseDelta# / waveLength;
                tone.directions[#] = direction#;
                tone.chipWaveCompletions[#] = chipWaveCompletion#;
                tone.chipWavePrevWaves[#] = prevWave#;
                tone.chipWaveCompletionsLastWave[#] = lastWave#;
                
                `.replaceAll("#", i + "");
            }
            chipSource += `
            tone.expression = expression;
            synth.sanitizeFilters(filters);
            tone.initialNoteFilterInput1 = initialFilterInput1;
            tone.initialNoteFilterInput2 = initialFilterInput2;
        }`
            chipFunction = new Function("Config", "Synth", "effectsIncludeDistortion", chipSource)(Config, SynthProcessor, effectsIncludeDistortion);
            SynthProcessor.loopableChipFunctionCache[instrumentState.unisonVoices] = chipFunction;
        }
        chipFunction(synth, bufferIndex, roundedSamplesPerTick, tone, instrumentState);
    }

    private static chipSynth(synth: SynthProcessor, bufferIndex: number, roundedSamplesPerTick: number, tone: Tone, instrumentState: InstrumentState): void {
        const voiceCount: number = Math.max(2, instrumentState.unisonVoices);
        let chipFunction: Function = SynthProcessor.chipFunctionCache[instrumentState.unisonVoices];
        if (chipFunction == undefined) {
            let chipSource: string = "return (synth, bufferIndex, roundedSamplesPerTick, tone, instrumentState) => {";


            chipSource += `
        const aliases = (effectsIncludeDistortion(instrumentState.effects) && instrumentState.aliases);
        const data = synth.tempMonoInstrumentSampleBuffer;
        const wave = instrumentState.wave;
        const volumeScale = instrumentState.volumeScale;

        const waveLength = (aliases && instrumentState.type == 8) ? wave.length : wave.length - 1;

        const unisonSign = tone.specialIntervalExpressionMult * instrumentState.unisonSign;
        let expression = +tone.expression;
        const expressionDelta = +tone.expressionDelta;
        `
            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `let phaseDelta# = tone.phaseDeltas[#] * waveLength;
            let phaseDeltaScale# = +tone.phaseDeltaScales[#];

            if (instrumentState.unisonVoices <= # && (instrumentState.unisonSpread == 0 || instrumentState.unisonBuzzes) && !instrumentState.chord.customInterval) tone.phases[#] = tone.phases[# - 1];
            `.replaceAll("#", i + "");
            }

            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `let phase# = (tone.phases[#] - (tone.phases[#] | 0)) * waveLength;
            let prevWaveIntegral# = 0.0;
            `.replaceAll("#", i + "");
            }

            chipSource += `const filters = tone.noteFilters;
        const filterCount = tone.noteFilterCount | 0;
        let initialFilterInput1 = +tone.initialNoteFilterInput1;
        let initialFilterInput2 = +tone.initialNoteFilterInput2;
        const applyFilters = Synth.applyFilters;

        if (!aliases) {
        `
            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `const phase#Int = phase# | 0;
                const index# = phase#Int % waveLength;
                prevWaveIntegral# = +wave[index#]
                const phase#Ratio = phase# - phase#Int;
                prevWaveIntegral# += (wave[index# + 1] - prevWaveIntegral#) * phase#Ratio;
                `.replaceAll("#", i + "");
            }
            chipSource += `
        } 

        const stopIndex = bufferIndex + roundedSamplesPerTick;
        for (let sampleIndex = bufferIndex; sampleIndex < stopIndex; sampleIndex++) {
        let inputSample = 0;
            if (aliases) {
                `;
            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `phase# += phaseDelta#;

                    const inputSample# = wave[(0 | phase#) % waveLength];
                    `.replaceAll("#", i + "");
            }
            const sampleListAliased: string[] = [];
            for (let voice: number = 0; voice < voiceCount; voice++) {
                sampleListAliased.push("inputSample" + voice + (voice != 0 ? " * unisonSign" : ""));
            }

            chipSource += "inputSample = " + sampleListAliased.join(" + ") + ";";
            chipSource += `} else {
                    `;
            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `phase# += phaseDelta#;

                     
                        const phase#Int = phase# | 0;
                        const index# = phase#Int % waveLength;
                        let nextWaveIntegral# = wave[index#]
                        const phase#Ratio = phase# - phase#Int;
                        nextWaveIntegral# += (wave[index# + 1] - nextWaveIntegral#) * phase#Ratio;
                        const wave# = (nextWaveIntegral# - prevWaveIntegral#) / phaseDelta#;
                        prevWaveIntegral# = nextWaveIntegral#;
                        let inputSample# = wave#;
                        `.replaceAll("#", i + "");
            }
            const sampleListUnaliased: string[] = [];
            for (let voice: number = 0; voice < voiceCount; voice++) {
                sampleListUnaliased.push("inputSample" + voice + (voice != 0 ? " * unisonSign" : ""));
            }

            chipSource += "inputSample = " + sampleListUnaliased.join(" + ") + ";";
            chipSource += `}
        `;


            chipSource += `const sample = applyFilters(inputSample * volumeScale, initialFilterInput1, initialFilterInput2, filterCount, filters);
            initialFilterInput2 = initialFilterInput1;
            initialFilterInput1 = inputSample * volumeScale;`;

            for (let i = 0; i < voiceCount; i++) {
                chipSource += `
                phaseDelta# *= phaseDeltaScale#;
                `.replaceAll("#", i + "");
            }

            chipSource += `const output = sample * expression;
            expression += expressionDelta;
            data[sampleIndex] += output;
        }
            `

            for (let i: number = 0; i < voiceCount; i++) {
                chipSource += `tone.phases[#] = phase# / waveLength;
            tone.phaseDeltas[#] = phaseDelta# / waveLength;
            `.replaceAll("#", i + "");
            }

            chipSource += "tone.expression = expression;";

            chipSource += `
        synth.sanitizeFilters(filters);
        tone.initialNoteFilterInput1 = initialFilterInput1;
        tone.initialNoteFilterInput2 = initialFilterInput2;
    }`;
            chipFunction = new Function("Config", "Synth", "effectsIncludeDistortion", chipSource)(Config, SynthProcessor, effectsIncludeDistortion);
            SynthProcessor.chipFunctionCache[instrumentState.unisonVoices] = chipFunction;
        }
        chipFunction(synth, bufferIndex, roundedSamplesPerTick, tone, instrumentState);
    }

    private static harmonicsSynth(synth: SynthProcessor, bufferIndex: number, roundedSamplesPerTick: number, tone: Tone, instrumentState: InstrumentState): void {
        const voiceCount: number = Math.max(2, instrumentState.unisonVoices);
        let harmonicsFunction: Function = SynthProcessor.harmonicsFunctionCache[instrumentState.unisonVoices];
        if (harmonicsFunction == undefined) {
            let harmonicsSource: string = "return (synth, bufferIndex, roundedSamplesPerTick, tone, instrumentState) => {";


            harmonicsSource += `
        const data = synth.tempMonoInstrumentSampleBuffer;
        const wave = instrumentState.wave;
        const waveLength = wave.length - 1; // The first sample is duplicated at the end, don't double-count it.

        const unisonSign = tone.specialIntervalExpressionMult * instrumentState.unisonSign;
        let expression = +tone.expression;
        const expressionDelta = +tone.expressionDelta;
         `
            for (let i: number = 0; i < voiceCount; i++) {
                harmonicsSource += `let phaseDelta# = tone.phaseDeltas[#] * waveLength;
            let phaseDeltaScale# = +tone.phaseDeltaScales[#];

            if (instrumentState.unisonVoices <= # && (instrumentState.unisonSpread == 0 || instrumentState.unisonBuzzes) && !instrumentState.chord.customInterval) tone.phases[#] = tone.phases[# - 1];
            `.replaceAll("#", i + "");
            }

            for (let i: number = 0; i < voiceCount; i++) {
                harmonicsSource += `let phase# = (tone.phases[#] - (tone.phases[#] | 0)) * waveLength;
            `.replaceAll("#", i + "");
            }

            harmonicsSource += `const filters = tone.noteFilters;
        const filterCount = tone.noteFilterCount | 0;
        let initialFilterInput1 = +tone.initialNoteFilterInput1;
        let initialFilterInput2 = +tone.initialNoteFilterInput2;
        const applyFilters = Synth.applyFilters;
        `

            for (let i: number = 0; i < voiceCount; i++) {
                harmonicsSource += `const phase#Int = phase# | 0;
            const index# = phase#Int % waveLength;
            prevWaveIntegral# = +wave[index#]
            const phase#Ratio = phase# - phase#Int;
            prevWaveIntegral# += (wave[index# + 1] - prevWaveIntegral#) * phase#Ratio;
            `.replaceAll("#", i + "");
            }

            harmonicsSource += `const stopIndex = bufferIndex + roundedSamplesPerTick;
        for (let sampleIndex = bufferIndex; sampleIndex < stopIndex; sampleIndex++) {
        `
            for (let i: number = 0; i < voiceCount; i++) {
                harmonicsSource += `
                        phase# += phaseDelta#;
                        const phase#Int = phase# | 0;
                        const index# = phase#Int % waveLength;
                        let nextWaveIntegral# = wave[index#]
                        const phase#Ratio = phase# - phase#Int;
                        nextWaveIntegral# += (wave[index# + 1] - nextWaveIntegral#) * phase#Ratio;
                        const wave# = (nextWaveIntegral# - prevWaveIntegral#) / phaseDelta#;
                        prevWaveIntegral# = nextWaveIntegral#;
                        let inputSample# = wave#;
                        `.replaceAll("#", i + "");
            }
            const sampleList: string[] = [];
            for (let voice: number = 0; voice < voiceCount; voice++) {
                sampleList.push("inputSample" + voice + (voice != 0 ? " * unisonSign" : ""));
            }

            harmonicsSource += "inputSample = " + sampleList.join(" + ") + ";";


            harmonicsSource += `const sample = applyFilters(inputSample, initialFilterInput1, initialFilterInput2, filterCount, filters);
            initialFilterInput2 = initialFilterInput1;
            initialFilterInput1 = inputSample;`;

            for (let i = 0; i < voiceCount; i++) {
                harmonicsSource += `
                phaseDelta# *= phaseDeltaScale#;
                `.replaceAll("#", i + "");
            }

            harmonicsSource += `const output = sample * expression;
            expression += expressionDelta;
            data[sampleIndex] += output;
        }
            `

            for (let i: number = 0; i < voiceCount; i++) {
                harmonicsSource += `tone.phases[#] = phase# / waveLength;
            tone.phaseDeltas[#] = phaseDelta# / waveLength;
            `.replaceAll("#", i + "");
            }

            harmonicsSource += "tone.expression = expression;";

            harmonicsSource += `
        synth.sanitizeFilters(filters);
        tone.initialNoteFilterInput1 = initialFilterInput1;
        tone.initialNoteFilterInput2 = initialFilterInput2;
    }`;
            harmonicsFunction = new Function("Config", "Synth", harmonicsSource)(Config, SynthProcessor);
            SynthProcessor.harmonicsFunctionCache[instrumentState.unisonVoices] = harmonicsFunction;
        }
        harmonicsFunction(synth, bufferIndex, roundedSamplesPerTick, tone, instrumentState);
    }

    private static pickedStringSynth(synth: SynthProcessor, bufferIndex: number, roundedSamplesPerTick: number, tone: Tone, instrumentState: InstrumentState): void {
        // This algorithm is similar to the Karpluss-Strong algorithm in principle, but with an
        // all-pass filter for dispersion and with more control over the impulse harmonics.
        // The source code is processed as a string before being compiled, in order to
        // handle the unison feature. If unison is disabled or set to none, then only one
        // string voice is required, otherwise two string voices are required. We only want
        // to compute the minimum possible number of string voices, so omit the code for
        // processing extra ones if possible. Any line containing a "#" is duplicated for
        // each required voice, replacing the "#" with the voice index.

        const voiceCount: number = instrumentState.unisonVoices;
        let pickedStringFunction: Function = SynthProcessor.pickedStringFunctionCache[voiceCount];
        if (pickedStringFunction == undefined) {
            let pickedStringSource: string = "return (synth, bufferIndex, runLength, tone, instrumentState) => {";


            pickedStringSource += `
				const data = synth.tempMonoInstrumentSampleBuffer;
				
				let pickedString# = tone.pickedStrings[#];
				let allPassSample# = +pickedString#.allPassSample;
				let allPassPrevInput# = +pickedString#.allPassPrevInput;
				let sustainFilterSample# = +pickedString#.sustainFilterSample;
				let sustainFilterPrevOutput2# = +pickedString#.sustainFilterPrevOutput2;
				let sustainFilterPrevInput1# = +pickedString#.sustainFilterPrevInput1;
				let sustainFilterPrevInput2# = +pickedString#.sustainFilterPrevInput2;
				let fractionalDelaySample# = +pickedString#.fractionalDelaySample;
				const delayLine# = pickedString#.delayLine;
				const delayBufferMask# = (delayLine#.length - 1) >> 0;
				let delayIndex# = pickedString#.delayIndex|0;
				delayIndex# = (delayIndex# & delayBufferMask#) + delayLine#.length;
				let delayLength# = +pickedString#.prevDelayLength;
				const delayLengthDelta# = +pickedString#.delayLengthDelta;
				let allPassG# = +pickedString#.allPassG;
				let sustainFilterA1# = +pickedString#.sustainFilterA1;
				let sustainFilterA2# = +pickedString#.sustainFilterA2;
				let sustainFilterB0# = +pickedString#.sustainFilterB0;
				let sustainFilterB1# = +pickedString#.sustainFilterB1;
				let sustainFilterB2# = +pickedString#.sustainFilterB2;
				const allPassGDelta# = +pickedString#.allPassGDelta;
				const sustainFilterA1Delta# = +pickedString#.sustainFilterA1Delta;
				const sustainFilterA2Delta# = +pickedString#.sustainFilterA2Delta;
				const sustainFilterB0Delta# = +pickedString#.sustainFilterB0Delta;
				const sustainFilterB1Delta# = +pickedString#.sustainFilterB1Delta;
				const sustainFilterB2Delta# = +pickedString#.sustainFilterB2Delta;
				
				let expression = +tone.expression;
				const expressionDelta = +tone.expressionDelta;
				
				const unisonSign = tone.specialIntervalExpressionMult * instrumentState.unisonSign;
                if (instrumentState.unisonVoices == 1 && (instrumentState.unisonSpread == 0 || instrumentState.unisonBuzzes) && !instrumentState.chord.customInterval) tone.phases[1] = tone.phases[0];
				const delayResetOffset# = pickedString#.delayResetOffset|0;
				
				const filters = tone.noteFilters;
				const filterCount = tone.noteFilterCount|0;
				let initialFilterInput1 = +tone.initialNoteFilterInput1;
				let initialFilterInput2 = +tone.initialNoteFilterInput2;
				const applyFilters = Synth.applyFilters;
				
				const stopIndex = bufferIndex + runLength;
				for (let sampleIndex = bufferIndex; sampleIndex < stopIndex; sampleIndex++) {
					const targetSampleTime# = delayIndex# - delayLength#;
					const lowerIndex# = (targetSampleTime# + 0.125) | 0; // Offset to improve stability of all-pass filter.
					const upperIndex# = lowerIndex# + 1;
					const fractionalDelay# = upperIndex# - targetSampleTime#;
					const fractionalDelayG# = (1.0 - fractionalDelay#) / (1.0 + fractionalDelay#); // Inlined version of FilterCoefficients.prototype.allPass1stOrderFractionalDelay
					const prevInput# = delayLine#[lowerIndex# & delayBufferMask#];
					const input# = delayLine#[upperIndex# & delayBufferMask#];
					fractionalDelaySample# = fractionalDelayG# * input# + prevInput# - fractionalDelayG# * fractionalDelaySample#;
					
					allPassSample# = fractionalDelaySample# * allPassG# + allPassPrevInput# - allPassG# * allPassSample#;
					allPassPrevInput# = fractionalDelaySample#;
					
					const sustainFilterPrevOutput1# = sustainFilterSample#;
					sustainFilterSample# = sustainFilterB0# * allPassSample# + sustainFilterB1# * sustainFilterPrevInput1# + sustainFilterB2# * sustainFilterPrevInput2# - sustainFilterA1# * sustainFilterSample# - sustainFilterA2# * sustainFilterPrevOutput2#;
					sustainFilterPrevOutput2# = sustainFilterPrevOutput1#;
					sustainFilterPrevInput2# = sustainFilterPrevInput1#;
					sustainFilterPrevInput1# = allPassSample#;
					
					delayLine#[delayIndex# & delayBufferMask#] += sustainFilterSample#;
					delayLine#[(delayIndex# + delayResetOffset#) & delayBufferMask#] = 0.0;
					delayIndex#++;
					
					const inputSample = (`

            const sampleList: string[] = [];
            for (let voice: number = 0; voice < voiceCount; voice++) {
                sampleList.push("fractionalDelaySample" + voice + (voice != 0 ? " * unisonSign" : ""));
            }

            pickedStringSource += sampleList.join(" + ");

            pickedStringSource += `) * expression;
					const sample = applyFilters(inputSample, initialFilterInput1, initialFilterInput2, filterCount, filters);
					initialFilterInput2 = initialFilterInput1;
					initialFilterInput1 = inputSample;
					data[sampleIndex] += sample;
					
					expression += expressionDelta;
					delayLength# += delayLengthDelta#;
					allPassG# += allPassGDelta#;
					sustainFilterA1# += sustainFilterA1Delta#;
					sustainFilterA2# += sustainFilterA2Delta#;
					sustainFilterB0# += sustainFilterB0Delta#;
					sustainFilterB1# += sustainFilterB1Delta#;
					sustainFilterB2# += sustainFilterB2Delta#;
				}
				
				// Avoid persistent denormal or NaN values in the delay buffers and filter history.
				const epsilon = (1.0e-24);
				if (!Number.isFinite(allPassSample#) || Math.abs(allPassSample#) < epsilon) allPassSample# = 0.0;
				if (!Number.isFinite(allPassPrevInput#) || Math.abs(allPassPrevInput#) < epsilon) allPassPrevInput# = 0.0;
				if (!Number.isFinite(sustainFilterSample#) || Math.abs(sustainFilterSample#) < epsilon) sustainFilterSample# = 0.0;
				if (!Number.isFinite(sustainFilterPrevOutput2#) || Math.abs(sustainFilterPrevOutput2#) < epsilon) sustainFilterPrevOutput2# = 0.0;
				if (!Number.isFinite(sustainFilterPrevInput1#) || Math.abs(sustainFilterPrevInput1#) < epsilon) sustainFilterPrevInput1# = 0.0;
				if (!Number.isFinite(sustainFilterPrevInput2#) || Math.abs(sustainFilterPrevInput2#) < epsilon) sustainFilterPrevInput2# = 0.0;
				if (!Number.isFinite(fractionalDelaySample#) || Math.abs(fractionalDelaySample#) < epsilon) fractionalDelaySample# = 0.0;
				pickedString#.allPassSample = allPassSample#;
				pickedString#.allPassPrevInput = allPassPrevInput#;
				pickedString#.sustainFilterSample = sustainFilterSample#;
				pickedString#.sustainFilterPrevOutput2 = sustainFilterPrevOutput2#;
				pickedString#.sustainFilterPrevInput1 = sustainFilterPrevInput1#;
				pickedString#.sustainFilterPrevInput2 = sustainFilterPrevInput2#;
				pickedString#.fractionalDelaySample = fractionalDelaySample#;
				pickedString#.delayIndex = delayIndex#;
				pickedString#.prevDelayLength = delayLength#;
				pickedString#.allPassG = allPassG#;
				pickedString#.sustainFilterA1 = sustainFilterA1#;
				pickedString#.sustainFilterA2 = sustainFilterA2#;
				pickedString#.sustainFilterB0 = sustainFilterB0#;
				pickedString#.sustainFilterB1 = sustainFilterB1#;
				pickedString#.sustainFilterB2 = sustainFilterB2#;
				
				tone.expression = expression;
				
				synth.sanitizeFilters(filters);
				tone.initialNoteFilterInput1 = initialFilterInput1;
				tone.initialNoteFilterInput2 = initialFilterInput2;
			}`

            // Duplicate lines containing "#" for each voice and replace the "#" with the voice index.
            pickedStringSource = pickedStringSource.replace(/^.*\#.*$/mg, line => {
                const lines: string[] = [];
                for (let voice: number = 0; voice < voiceCount; voice++) {
                    lines.push(line.replace(/\#/g, String(voice)));
                }
                return lines.join("\n");
            });
            pickedStringFunction = new Function("Config", "Synth", pickedStringSource)(Config, SynthProcessor);
            SynthProcessor.pickedStringFunctionCache[voiceCount] = pickedStringFunction;
        }

        pickedStringFunction(synth, bufferIndex, roundedSamplesPerTick, tone, instrumentState);
    }

    private static effectsSynth(synth: SynthProcessor, outputDataL: Float32Array, outputDataR: Float32Array, bufferIndex: number, runLength: number, instrumentState: InstrumentState): void {
        // TODO: If automation is involved, don't assume sliders will stay at zero.
        // @jummbus - ^ Correct, removed the non-zero checks as modulation can change them.

        const usesDistortion: boolean = effectsIncludeDistortion(instrumentState.effects);
        const usesBitcrusher: boolean = effectsIncludeBitcrusher(instrumentState.effects);
        const usesEqFilter: boolean = instrumentState.eqFilterCount > 0;
        const usesPanning: boolean = effectsIncludePanning(instrumentState.effects);
        const usesChorus: boolean = effectsIncludeChorus(instrumentState.effects);
        const usesEcho: boolean = effectsIncludeEcho(instrumentState.effects);
        const usesReverb: boolean = effectsIncludeReverb(instrumentState.effects);
        const usesGranular: boolean = effectsIncludeGranular(instrumentState.effects);
        const usesRingModulation: boolean = effectsIncludeRingModulation(instrumentState.effects);
        const usesPlugin: boolean = effectsIncludePlugin(instrumentState.effects);
        let signature: number = 0; if (usesDistortion) signature = signature | 1;
        signature = signature << 1; if (usesBitcrusher) signature = signature | 1;
        signature = signature << 1; if (usesEqFilter) signature = signature | 1;
        signature = signature << 1; if (usesPanning) signature = signature | 1;
        signature = signature << 1; if (usesChorus) signature = signature | 1;
        signature = signature << 1; if (usesEcho) signature = signature | 1;
        signature = signature << 1; if (usesReverb) signature = signature | 1;
        signature = signature << 1; if (usesGranular) signature = signature | 1;
        signature = signature << 1; if (usesRingModulation) signature = signature | 1;
        signature = signature << 1; if (usesPlugin) signature = signature | 1;

        let effectsFunction: Function = SynthProcessor.effectsFunctionCache[signature];
        if (effectsFunction == undefined) {
            let effectsSource: string = "return (synth, outputDataL, outputDataR, bufferIndex, runLength, instrumentState) => {";

            const usesDelays: boolean = usesChorus || usesReverb || usesEcho || usesGranular || usesPlugin;

            effectsSource += `
				const tempMonoInstrumentSampleBuffer = synth.tempMonoInstrumentSampleBuffer;
				
				let mixVolume = +instrumentState.mixVolume;
				const mixVolumeDelta = +instrumentState.mixVolumeDelta;
                `

            if (usesDelays) {
                effectsSource += `
				
				let delayInputMult = +instrumentState.delayInputMult;
				const delayInputMultDelta = +instrumentState.delayInputMultDelta;`
            }

            if (usesGranular) {
                effectsSource += `
                let granularWet = instrumentState.granularMix;
                const granularMixDelta = instrumentState.granularMixDelta;
                let granularDry = 1.0 - granularWet; 
                const granularDelayLine = instrumentState.granularDelayLine;
                const granularGrains = instrumentState.granularGrains;
                let granularGrainCount = instrumentState.granularGrainsLength;
                const granularDelayLineLength = granularDelayLine.length;
                const granularDelayLineMask = granularDelayLineLength - 1;
                let granularDelayLineIndex = instrumentState.granularDelayLineIndex;
                const usesRandomGrainLocation = instrumentState.usesRandomGrainLocation;
                const computeGrains = instrumentState.computeGrains;
                instrumentState.granularDelayLineDirty = true;
                `
            }

            if (usesDistortion) {
                // Distortion can sometimes create noticeable aliasing.
                // It seems the established industry best practice for distortion antialiasing
                // is to upsample the inputs ("zero stuffing" followed by a brick wall lowpass
                // at the original nyquist frequency), perform the distortion, then downsample
                // (the lowpass again followed by dropping in-between samples). This is
                // "mathematically correct" in that it preserves only the intended frequencies,
                // but it has several unfortunate tradeoffs depending on the choice of filter,
                // introducing latency and/or time smearing, since no true brick wall filter
                // exists. For the time being, I've opted to instead generate in-between input
                // samples using fractional delay all-pass filters, and after distorting them,
                // I "downsample" these with a simple weighted sum.

                effectsSource += `
				
				const distortionBaseVolume = +Config.distortionBaseVolume;
				let distortion = instrumentState.distortion;
				const distortionDelta = instrumentState.distortionDelta;
				let distortionDrive = instrumentState.distortionDrive;
				const distortionDriveDelta = instrumentState.distortionDriveDelta;
				const distortionFractionalResolution = 4.0;
				const distortionOversampleCompensation = distortionBaseVolume / distortionFractionalResolution;
				const distortionFractionalDelay1 = 1.0 / distortionFractionalResolution;
				const distortionFractionalDelay2 = 2.0 / distortionFractionalResolution;
				const distortionFractionalDelay3 = 3.0 / distortionFractionalResolution;
				const distortionFractionalDelayG1 = (1.0 - distortionFractionalDelay1) / (1.0 + distortionFractionalDelay1); // Inlined version of FilterCoefficients.prototype.allPass1stOrderFractionalDelay
				const distortionFractionalDelayG2 = (1.0 - distortionFractionalDelay2) / (1.0 + distortionFractionalDelay2); // Inlined version of FilterCoefficients.prototype.allPass1stOrderFractionalDelay
				const distortionFractionalDelayG3 = (1.0 - distortionFractionalDelay3) / (1.0 + distortionFractionalDelay3); // Inlined version of FilterCoefficients.prototype.allPass1stOrderFractionalDelay
				const distortionNextOutputWeight1 = Math.cos(Math.PI * distortionFractionalDelay1) * 0.5 + 0.5;
				const distortionNextOutputWeight2 = Math.cos(Math.PI * distortionFractionalDelay2) * 0.5 + 0.5;
				const distortionNextOutputWeight3 = Math.cos(Math.PI * distortionFractionalDelay3) * 0.5 + 0.5;
				const distortionPrevOutputWeight1 = 1.0 - distortionNextOutputWeight1;
				const distortionPrevOutputWeight2 = 1.0 - distortionNextOutputWeight2;
				const distortionPrevOutputWeight3 = 1.0 - distortionNextOutputWeight3;
				
				let distortionFractionalInput1 = +instrumentState.distortionFractionalInput1;
				let distortionFractionalInput2 = +instrumentState.distortionFractionalInput2;
				let distortionFractionalInput3 = +instrumentState.distortionFractionalInput3;
				let distortionPrevInput = +instrumentState.distortionPrevInput;
				let distortionNextOutput = +instrumentState.distortionNextOutput;`
            }

            if (usesBitcrusher) {
                effectsSource += `
				
				let bitcrusherPrevInput = +instrumentState.bitcrusherPrevInput;
				let bitcrusherCurrentOutput = +instrumentState.bitcrusherCurrentOutput;
				let bitcrusherPhase = +instrumentState.bitcrusherPhase;
				let bitcrusherPhaseDelta = +instrumentState.bitcrusherPhaseDelta;
				const bitcrusherPhaseDeltaScale = +instrumentState.bitcrusherPhaseDeltaScale;
				let bitcrusherScale = +instrumentState.bitcrusherScale;
				const bitcrusherScaleScale = +instrumentState.bitcrusherScaleScale;
				let bitcrusherFoldLevel = +instrumentState.bitcrusherFoldLevel;
				const bitcrusherFoldLevelScale = +instrumentState.bitcrusherFoldLevelScale;`
            }

            if (usesRingModulation) {
                effectsSource += `
				
                let ringModMix = +instrumentState.ringModMix;
                let ringModMixDelta = +instrumentState.ringModMixDelta;
                let ringModPhase = +instrumentState.ringModPhase;
                let ringModPhaseDelta = +instrumentState.ringModPhaseDelta;
                let ringModPhaseDeltaScale = +instrumentState.ringModPhaseDeltaScale;
                let ringModWaveformIndex = +instrumentState.ringModWaveformIndex;
                let ringModMixFade = +instrumentState.ringModMixFade;
                let ringModMixFadeDelta = +instrumentState.ringModMixFadeDelta;
                
                let ringModPulseWidth = +instrumentState.ringModPulseWidth;

                let waveform = Config.operatorWaves[ringModWaveformIndex].samples; 
                if (ringModWaveformIndex == Config.operatorWaves.dictionary['pulse width'].index) {
                    waveform = Synth.getOperatorWave(ringModWaveformIndex, ringModPulseWidth).samples;
                }
                const waveformLength = waveform.length - 1;
                `
            }

            if (usesEqFilter) {
                effectsSource += `
				
				let filters = instrumentState.eqFilters;
				const filterCount = instrumentState.eqFilterCount|0;
				let initialFilterInput1 = +instrumentState.initialEqFilterInput1;
				let initialFilterInput2 = +instrumentState.initialEqFilterInput2;
				const applyFilters = Synth.applyFilters;`
            }

            // The eq filter volume is also used to fade out the instrument state, so always include it.
            effectsSource += `
				
				let eqFilterVolume = +instrumentState.eqFilterVolume;
				const eqFilterVolumeDelta = +instrumentState.eqFilterVolumeDelta;`

            if (usesPanning) {
                effectsSource += `
				
				const panningMask = synth.panningDelayBufferMask >>> 0;
				const panningDelayLine = instrumentState.panningDelayLine;
				let panningDelayPos = instrumentState.panningDelayPos & panningMask;
				let   panningVolumeL      = +instrumentState.panningVolumeL;
				let   panningVolumeR      = +instrumentState.panningVolumeR;
				const panningVolumeDeltaL = +instrumentState.panningVolumeDeltaL;
				const panningVolumeDeltaR = +instrumentState.panningVolumeDeltaR;
				let   panningOffsetL      = +instrumentState.panningOffsetL;
				let   panningOffsetR      = +instrumentState.panningOffsetR;
				const panningOffsetDeltaL = 1.0 - instrumentState.panningOffsetDeltaL;
				const panningOffsetDeltaR = 1.0 - instrumentState.panningOffsetDeltaR;`
            }

            if (usesChorus) {
                effectsSource += `
				
				const chorusMask = synth.chorusDelayBufferMask >>> 0;
				const chorusDelayLineL = instrumentState.chorusDelayLineL;
				const chorusDelayLineR = instrumentState.chorusDelayLineR;
				instrumentState.chorusDelayLineDirty = true;
				let chorusDelayPos = instrumentState.chorusDelayPos & chorusMask;
				
				let chorusVoiceMult = +instrumentState.chorusVoiceMult;
				const chorusVoiceMultDelta = +instrumentState.chorusVoiceMultDelta;
				let chorusCombinedMult = +instrumentState.chorusCombinedMult;
				const chorusCombinedMultDelta = +instrumentState.chorusCombinedMultDelta;
				
				const chorusDuration = +Config.chorusPeriodSeconds;
				const chorusAngle = Math.PI * 2.0 / (chorusDuration * synth.samplesPerSecond);
				const chorusRange = synth.samplesPerSecond * Config.chorusDelayRange;
				const chorusOffset0 = synth.chorusDelayBufferSize - Config.chorusDelayOffsets[0][0] * chorusRange;
				const chorusOffset1 = synth.chorusDelayBufferSize - Config.chorusDelayOffsets[0][1] * chorusRange;
				const chorusOffset2 = synth.chorusDelayBufferSize - Config.chorusDelayOffsets[0][2] * chorusRange;
				const chorusOffset3 = synth.chorusDelayBufferSize - Config.chorusDelayOffsets[1][0] * chorusRange;
				const chorusOffset4 = synth.chorusDelayBufferSize - Config.chorusDelayOffsets[1][1] * chorusRange;
				const chorusOffset5 = synth.chorusDelayBufferSize - Config.chorusDelayOffsets[1][2] * chorusRange;
				let chorusPhase = instrumentState.chorusPhase % (Math.PI * 2.0);
				let chorusTap0Index = chorusDelayPos + chorusOffset0 - chorusRange * Math.sin(chorusPhase + Config.chorusPhaseOffsets[0][0]);
				let chorusTap1Index = chorusDelayPos + chorusOffset1 - chorusRange * Math.sin(chorusPhase + Config.chorusPhaseOffsets[0][1]);
				let chorusTap2Index = chorusDelayPos + chorusOffset2 - chorusRange * Math.sin(chorusPhase + Config.chorusPhaseOffsets[0][2]);
				let chorusTap3Index = chorusDelayPos + chorusOffset3 - chorusRange * Math.sin(chorusPhase + Config.chorusPhaseOffsets[1][0]);
				let chorusTap4Index = chorusDelayPos + chorusOffset4 - chorusRange * Math.sin(chorusPhase + Config.chorusPhaseOffsets[1][1]);
				let chorusTap5Index = chorusDelayPos + chorusOffset5 - chorusRange * Math.sin(chorusPhase + Config.chorusPhaseOffsets[1][2]);
				chorusPhase += chorusAngle * runLength;
				const chorusTap0End = chorusDelayPos + chorusOffset0 - chorusRange * Math.sin(chorusPhase + Config.chorusPhaseOffsets[0][0]) + runLength;
				const chorusTap1End = chorusDelayPos + chorusOffset1 - chorusRange * Math.sin(chorusPhase + Config.chorusPhaseOffsets[0][1]) + runLength;
				const chorusTap2End = chorusDelayPos + chorusOffset2 - chorusRange * Math.sin(chorusPhase + Config.chorusPhaseOffsets[0][2]) + runLength;
				const chorusTap3End = chorusDelayPos + chorusOffset3 - chorusRange * Math.sin(chorusPhase + Config.chorusPhaseOffsets[1][0]) + runLength;
				const chorusTap4End = chorusDelayPos + chorusOffset4 - chorusRange * Math.sin(chorusPhase + Config.chorusPhaseOffsets[1][1]) + runLength;
				const chorusTap5End = chorusDelayPos + chorusOffset5 - chorusRange * Math.sin(chorusPhase + Config.chorusPhaseOffsets[1][2]) + runLength;
				const chorusTap0Delta = (chorusTap0End - chorusTap0Index) / runLength;
				const chorusTap1Delta = (chorusTap1End - chorusTap1Index) / runLength;
				const chorusTap2Delta = (chorusTap2End - chorusTap2Index) / runLength;
				const chorusTap3Delta = (chorusTap3End - chorusTap3Index) / runLength;
				const chorusTap4Delta = (chorusTap4End - chorusTap4Index) / runLength;
				const chorusTap5Delta = (chorusTap5End - chorusTap5Index) / runLength;`
            }

            if (usesEcho) {
                effectsSource += `
				let echoMult = +instrumentState.echoMult;
				const echoMultDelta = +instrumentState.echoMultDelta;
				
				const echoDelayLineL = instrumentState.echoDelayLineL;
				const echoDelayLineR = instrumentState.echoDelayLineR;
				const echoMask = (echoDelayLineL.length - 1) >>> 0;
				instrumentState.echoDelayLineDirty = true;
				
				let echoDelayPos = instrumentState.echoDelayPos & echoMask;
				const echoDelayOffsetStart = (echoDelayLineL.length - instrumentState.echoDelayOffsetStart) & echoMask;
				const echoDelayOffsetEnd   = (echoDelayLineL.length - instrumentState.echoDelayOffsetEnd) & echoMask;
				let echoDelayOffsetRatio = +instrumentState.echoDelayOffsetRatio;
				const echoDelayOffsetRatioDelta = +instrumentState.echoDelayOffsetRatioDelta;
				
				const echoShelfA1 = +instrumentState.echoShelfA1;
				const echoShelfB0 = +instrumentState.echoShelfB0;
				const echoShelfB1 = +instrumentState.echoShelfB1;
				let echoShelfSampleL = +instrumentState.echoShelfSampleL;
				let echoShelfSampleR = +instrumentState.echoShelfSampleR;
				let echoShelfPrevInputL = +instrumentState.echoShelfPrevInputL;
				let echoShelfPrevInputR = +instrumentState.echoShelfPrevInputR;`
            }

            if (usesReverb) { //TODO: reverb wet/dry?
                effectsSource += `
				
				const reverbMask = Config.reverbDelayBufferMask >>> 0; //TODO: Dynamic reverb buffer size.
				const reverbDelayLine = instrumentState.reverbDelayLine;
				instrumentState.reverbDelayLineDirty = true;
				let reverbDelayPos = instrumentState.reverbDelayPos & reverbMask;
				
				let reverb = +instrumentState.reverbMult;
				const reverbDelta = +instrumentState.reverbMultDelta;
				
				const reverbShelfA1 = +instrumentState.reverbShelfA1;
				const reverbShelfB0 = +instrumentState.reverbShelfB0;
				const reverbShelfB1 = +instrumentState.reverbShelfB1;
				let reverbShelfSample0 = +instrumentState.reverbShelfSample0;
				let reverbShelfSample1 = +instrumentState.reverbShelfSample1;
				let reverbShelfSample2 = +instrumentState.reverbShelfSample2;
				let reverbShelfSample3 = +instrumentState.reverbShelfSample3;
				let reverbShelfPrevInput0 = +instrumentState.reverbShelfPrevInput0;
				let reverbShelfPrevInput1 = +instrumentState.reverbShelfPrevInput1;
				let reverbShelfPrevInput2 = +instrumentState.reverbShelfPrevInput2;
				let reverbShelfPrevInput3 = +instrumentState.reverbShelfPrevInput3;`
            }

            if (usesPlugin) {
                for (let i: number = 0; i < instrumentState.pluginValues.length; i++) {
                    effectsSource += "let " + SynthProcessor.pluginValueNames[i] + " = instrumentState.pluginValues[" + i + "]; \n";
                }
                effectsSource += `
                const pluginDelayLine = instrumentState.pluginDelayLine;
                instrumentState.pluginDelayLineDirty = instrumentState.pluginDelayLineSize ? true : false;
                `
            }

            effectsSource += `
				
				const stopIndex = bufferIndex + runLength;
            for (let sampleIndex = bufferIndex; sampleIndex < stopIndex; sampleIndex++) {
                let sample = tempMonoInstrumentSampleBuffer[sampleIndex];
                tempMonoInstrumentSampleBuffer[sampleIndex] = 0.0;
                `
            
            const effectOrder: string[] = [];
            
            if (usesGranular) {
                let granularSource = "";
                granularSource += `
                let granularOutput = 0;
                for (let grainIndex = 0; grainIndex < granularGrainCount; grainIndex++) {
                    const grain = granularGrains[grainIndex];
                    if(computeGrains) {
                        if(grain.delay > 0) {
                            grain.delay--;
                        } else {
                            const grainDelayLinePosition = grain.delayLinePosition;
                            const grainDelayLinePositionInt = grainDelayLinePosition | 0;
                            // const grainDelayLinePositionT = grainDelayLinePosition - grainDelayLinePositionInt;
                            let grainAgeInSamples = grain.ageInSamples;
                            const grainMaxAgeInSamples = grain.maxAgeInSamples;
                            // const grainSample0 = granularDelayLine[((granularDelayLineIndex + (granularDelayLineLength - grainDelayLinePositionInt))    ) & granularDelayLineMask];
                            // const grainSample1 = granularDelayLine[((granularDelayLineIndex + (granularDelayLineLength - grainDelayLinePositionInt)) + 1) & granularDelayLineMask];
                            // let grainSample = grainSample0 + (grainSample1 - grainSample0) * grainDelayLinePositionT; // Linear interpolation (@TODO: sounds quite bad?)
                            let grainSample = granularDelayLine[((granularDelayLineIndex + (granularDelayLineLength - grainDelayLinePositionInt))) & granularDelayLineMask]; // No interpolation
                            `
                if (Config.granularEnvelopeType == GranularEnvelopeType.parabolic) {
                    granularSource += `
                                const grainEnvelope = grain.parabolicEnvelopeAmplitude;
                                `
                } else if (Config.granularEnvelopeType == GranularEnvelopeType.raisedCosineBell) {
                    granularSource += `
                                const grainEnvelope = grain.rcbEnvelopeAmplitude;
                                `
                }
                granularSource += `
                            grainSample *= grainEnvelope;
                            granularOutput += grainSample;
                            if (grainAgeInSamples > grainMaxAgeInSamples) {
                                if (granularGrainCount > 0) {
                                    // Faster equivalent of .pop, ignoring the order in the array.
                                    const lastGrainIndex = granularGrainCount - 1;
                                    const lastGrain = granularGrains[lastGrainIndex];
                                    granularGrains[grainIndex] = lastGrain;
                                    granularGrains[lastGrainIndex] = grain;
                                    granularGrainCount--;
                                    grainIndex--;
                                    // ^ Dangerous, since this could end up causing an infinite loop,
                                    // but should be okay in this case.
                                }
                            } else {
                                grainAgeInSamples++;
                            `
                if (Config.granularEnvelopeType == GranularEnvelopeType.parabolic) {
                    // grain.updateParabolicEnvelope();
                    // Inlined:
                    granularSource += `
                                    grain.parabolicEnvelopeAmplitude += grain.parabolicEnvelopeSlope;
                                    grain.parabolicEnvelopeSlope += grain.parabolicEnvelopeCurve;
                                    `
                } else if (Config.granularEnvelopeType == GranularEnvelopeType.raisedCosineBell) {
                    granularSource += `
                                    grain.updateRCBEnvelope();
                                    `
                }
                granularSource += `
                                grain.ageInSamples = grainAgeInSamples;
                                // if(!usesRandomGrainLocation) {
                                //     grain.delayLine -= grainPitchShift;
                                // }
                            }
                        }
                    }
                }
                granularWet += granularMixDelta;
                granularDry -= granularMixDelta;
                granularOutput *= Config.granularOutputLoudnessCompensation;
                granularDelayLine[granularDelayLineIndex] = sample;
                granularDelayLineIndex = (granularDelayLineIndex + 1) & granularDelayLineMask;
                sample = sample * granularDry + granularOutput * granularWet;
                `
                effectOrder.push(granularSource);
            } else {
                effectOrder.push("");
            }


            if (usesDistortion) {
                effectOrder.push(`
					
					const distortionReverse = 1.0 - distortion;
					const distortionNextInput = sample * distortionDrive;
					sample = distortionNextOutput;
					distortionNextOutput = distortionNextInput / (distortionReverse * Math.abs(distortionNextInput) + distortion);
					distortionFractionalInput1 = distortionFractionalDelayG1 * distortionNextInput + distortionPrevInput - distortionFractionalDelayG1 * distortionFractionalInput1;
					distortionFractionalInput2 = distortionFractionalDelayG2 * distortionNextInput + distortionPrevInput - distortionFractionalDelayG2 * distortionFractionalInput2;
					distortionFractionalInput3 = distortionFractionalDelayG3 * distortionNextInput + distortionPrevInput - distortionFractionalDelayG3 * distortionFractionalInput3;
					const distortionOutput1 = distortionFractionalInput1 / (distortionReverse * Math.abs(distortionFractionalInput1) + distortion);
					const distortionOutput2 = distortionFractionalInput2 / (distortionReverse * Math.abs(distortionFractionalInput2) + distortion);
					const distortionOutput3 = distortionFractionalInput3 / (distortionReverse * Math.abs(distortionFractionalInput3) + distortion);
					distortionNextOutput += distortionOutput1 * distortionNextOutputWeight1 + distortionOutput2 * distortionNextOutputWeight2 + distortionOutput3 * distortionNextOutputWeight3;
					sample += distortionOutput1 * distortionPrevOutputWeight1 + distortionOutput2 * distortionPrevOutputWeight2 + distortionOutput3 * distortionPrevOutputWeight3;
					sample *= distortionOversampleCompensation;
					distortionPrevInput = distortionNextInput;
					distortion += distortionDelta;
					distortionDrive += distortionDriveDelta;`);
            } else {
                effectOrder.push("");
            }


            if (usesBitcrusher) {
                effectOrder.push(`
					
					bitcrusherPhase += bitcrusherPhaseDelta;
					if (bitcrusherPhase < 1.0) {
						bitcrusherPrevInput = sample;
						sample = bitcrusherCurrentOutput;
					} else {
						bitcrusherPhase -= (bitcrusherPhase | 0);
						const ratio = bitcrusherPhase / bitcrusherPhaseDelta;
						
						const lerpedInput = sample + (bitcrusherPrevInput - sample) * ratio;
						bitcrusherPrevInput = sample;
						
						const bitcrusherWrapLevel = bitcrusherFoldLevel * 4.0;
						const wrappedSample = (((lerpedInput + bitcrusherFoldLevel) % bitcrusherWrapLevel) + bitcrusherWrapLevel) % bitcrusherWrapLevel;
						const foldedSample = bitcrusherFoldLevel - Math.abs(bitcrusherFoldLevel * 2.0 - wrappedSample);
						const scaledSample = foldedSample / bitcrusherScale;
						const oldValue = bitcrusherCurrentOutput;
						const newValue = (((scaledSample > 0 ? scaledSample + 1 : scaledSample)|0)-.5) * bitcrusherScale;
						
						sample = oldValue + (newValue - oldValue) * ratio;
						bitcrusherCurrentOutput = newValue;
					}
					bitcrusherPhaseDelta *= bitcrusherPhaseDeltaScale;
					bitcrusherScale *= bitcrusherScaleScale;
					bitcrusherFoldLevel *= bitcrusherFoldLevelScale;`);
            } else {
                effectOrder.push("");
            }


            if (usesRingModulation) {
                effectOrder.push(` 
                
                const ringModOutput = sample * waveform[(ringModPhase*waveformLength)|0];
                const ringModMixF = Math.max(0, ringModMix * ringModMixFade);
                sample = sample * (1 - ringModMixF) + ringModOutput * ringModMixF;

                ringModMix += ringModMixDelta;
                ringModPhase += ringModPhaseDelta;
                ringModPhase -= ringModPhase | 0;
                ringModPhaseDelta *= ringModPhaseDeltaScale;
                ringModMixFade += ringModMixFadeDelta;
                `);
            } else {
                effectOrder.push("");
            }


            let eqFilterSource: string = "";
            if (usesEqFilter) {
                eqFilterSource += `
					
					const inputSample = sample;
					sample = applyFilters(inputSample, initialFilterInput1, initialFilterInput2, filterCount, filters);
					initialFilterInput2 = initialFilterInput1;
					initialFilterInput1 = inputSample;`
            }

            // The eq filter volume is also used to fade out the instrument state, so always include it.
            eqFilterSource += `
					
					sample *= eqFilterVolume;
					eqFilterVolume += eqFilterVolumeDelta;`
            effectOrder.push(eqFilterSource);

            if (usesPanning) {
                effectOrder.push(`
					
					panningDelayLine[panningDelayPos] = sample;
					const panningRatioL  = panningOffsetL - (panningOffsetL | 0);
					const panningRatioR  = panningOffsetR - (panningOffsetR | 0);
					const panningTapLA   = panningDelayLine[(panningOffsetL) & panningMask];
					const panningTapLB   = panningDelayLine[(panningOffsetL + 1) & panningMask];
					const panningTapRA   = panningDelayLine[(panningOffsetR) & panningMask];
					const panningTapRB   = panningDelayLine[(panningOffsetR + 1) & panningMask];
					const panningTapL    = panningTapLA + (panningTapLB - panningTapLA) * panningRatioL;
					const panningTapR    = panningTapRA + (panningTapRB - panningTapRA) * panningRatioR;
					let sampleL = panningTapL * panningVolumeL;
					let sampleR = panningTapR * panningVolumeR;
					panningDelayPos = (panningDelayPos + 1) & panningMask;
					panningVolumeL += panningVolumeDeltaL;
					panningVolumeR += panningVolumeDeltaR;
					panningOffsetL += panningOffsetDeltaL;
					panningOffsetR += panningOffsetDeltaR;`);
            } else {
                effectOrder.push(`
					
					let sampleL = sample;
					let sampleR = sample;`);
            }

            if (usesChorus) {
                effectOrder.push(`
					
					const chorusTap0Ratio = chorusTap0Index - (chorusTap0Index | 0);
					const chorusTap1Ratio = chorusTap1Index - (chorusTap1Index | 0);
					const chorusTap2Ratio = chorusTap2Index - (chorusTap2Index | 0);
					const chorusTap3Ratio = chorusTap3Index - (chorusTap3Index | 0);
					const chorusTap4Ratio = chorusTap4Index - (chorusTap4Index | 0);
					const chorusTap5Ratio = chorusTap5Index - (chorusTap5Index | 0);
					const chorusTap0A = chorusDelayLineL[(chorusTap0Index) & chorusMask];
					const chorusTap0B = chorusDelayLineL[(chorusTap0Index + 1) & chorusMask];
					const chorusTap1A = chorusDelayLineL[(chorusTap1Index) & chorusMask];
					const chorusTap1B = chorusDelayLineL[(chorusTap1Index + 1) & chorusMask];
					const chorusTap2A = chorusDelayLineL[(chorusTap2Index) & chorusMask];
					const chorusTap2B = chorusDelayLineL[(chorusTap2Index + 1) & chorusMask];
					const chorusTap3A = chorusDelayLineR[(chorusTap3Index) & chorusMask];
					const chorusTap3B = chorusDelayLineR[(chorusTap3Index + 1) & chorusMask];
					const chorusTap4A = chorusDelayLineR[(chorusTap4Index) & chorusMask];
					const chorusTap4B = chorusDelayLineR[(chorusTap4Index + 1) & chorusMask];
					const chorusTap5A = chorusDelayLineR[(chorusTap5Index) & chorusMask];
					const chorusTap5B = chorusDelayLineR[(chorusTap5Index + 1) & chorusMask];
					const chorusTap0 = chorusTap0A + (chorusTap0B - chorusTap0A) * chorusTap0Ratio;
					const chorusTap1 = chorusTap1A + (chorusTap1B - chorusTap1A) * chorusTap1Ratio;
					const chorusTap2 = chorusTap2A + (chorusTap2B - chorusTap2A) * chorusTap2Ratio;
					const chorusTap3 = chorusTap3A + (chorusTap3B - chorusTap3A) * chorusTap3Ratio;
					const chorusTap4 = chorusTap4A + (chorusTap4B - chorusTap4A) * chorusTap4Ratio;
					const chorusTap5 = chorusTap5A + (chorusTap5B - chorusTap5A) * chorusTap5Ratio;
					chorusDelayLineL[chorusDelayPos] = sampleL * delayInputMult;
					chorusDelayLineR[chorusDelayPos] = sampleR * delayInputMult;
					sampleL = chorusCombinedMult * (sampleL + chorusVoiceMult * (chorusTap1 - chorusTap0 - chorusTap2));
					sampleR = chorusCombinedMult * (sampleR + chorusVoiceMult * (chorusTap4 - chorusTap3 - chorusTap5));
					chorusDelayPos = (chorusDelayPos + 1) & chorusMask;
					chorusTap0Index += chorusTap0Delta;
					chorusTap1Index += chorusTap1Delta;
					chorusTap2Index += chorusTap2Delta;
					chorusTap3Index += chorusTap3Delta;
					chorusTap4Index += chorusTap4Delta;
					chorusTap5Index += chorusTap5Delta;
					chorusVoiceMult += chorusVoiceMultDelta;
					chorusCombinedMult += chorusCombinedMultDelta;`);
            } else {
                effectOrder.push("");
            }


            if (usesEcho) {
                effectOrder.push(`
					
					const echoTapStartIndex = (echoDelayPos + echoDelayOffsetStart) & echoMask;
					const echoTapEndIndex   = (echoDelayPos + echoDelayOffsetEnd  ) & echoMask;
					const echoTapStartL = echoDelayLineL[echoTapStartIndex];
					const echoTapEndL   = echoDelayLineL[echoTapEndIndex];
					const echoTapStartR = echoDelayLineR[echoTapStartIndex];
					const echoTapEndR   = echoDelayLineR[echoTapEndIndex];
					const echoTapL = (echoTapStartL + (echoTapEndL - echoTapStartL) * echoDelayOffsetRatio) * echoMult;
					const echoTapR = (echoTapStartR + (echoTapEndR - echoTapStartR) * echoDelayOffsetRatio) * echoMult;
					
					echoShelfSampleL = echoShelfB0 * echoTapL + echoShelfB1 * echoShelfPrevInputL - echoShelfA1 * echoShelfSampleL;
					echoShelfSampleR = echoShelfB0 * echoTapR + echoShelfB1 * echoShelfPrevInputR - echoShelfA1 * echoShelfSampleR;
					echoShelfPrevInputL = echoTapL;
					echoShelfPrevInputR = echoTapR;
					sampleL += echoShelfSampleL;
					sampleR += echoShelfSampleR;
					
					echoDelayLineL[echoDelayPos] = sampleL * delayInputMult;
					echoDelayLineR[echoDelayPos] = sampleR * delayInputMult;
					echoDelayPos = (echoDelayPos + 1) & echoMask;
					echoDelayOffsetRatio += echoDelayOffsetRatioDelta;
					echoMult += echoMultDelta;
                    `);
            } else {
                effectOrder.push("");
            }


            if (usesReverb) {
                effectOrder.push(`
					
					// Reverb, implemented using a feedback delay network with a Hadamard matrix and lowpass filters.
					// good ratios:    0.555235 + 0.618033 + 0.818 +   1.0 = 2.991268
					// Delay lengths:  3041     + 3385     + 4481  +  5477 = 16384 = 2^14
					// Buffer offsets: 3041    -> 6426   -> 10907 -> 16384
					const reverbDelayPos1 = (reverbDelayPos +  3041) & reverbMask;
					const reverbDelayPos2 = (reverbDelayPos +  6426) & reverbMask;
					const reverbDelayPos3 = (reverbDelayPos + 10907) & reverbMask;
					const reverbSample0 = (reverbDelayLine[reverbDelayPos]);
					const reverbSample1 = reverbDelayLine[reverbDelayPos1];
					const reverbSample2 = reverbDelayLine[reverbDelayPos2];
					const reverbSample3 = reverbDelayLine[reverbDelayPos3];
					const reverbTemp0 = -(reverbSample0 + sampleL) + reverbSample1;
					const reverbTemp1 = -(reverbSample0 + sampleR) - reverbSample1;
					const reverbTemp2 = -reverbSample2 + reverbSample3;
					const reverbTemp3 = -reverbSample2 - reverbSample3;
					const reverbShelfInput0 = (reverbTemp0 + reverbTemp2) * reverb;
					const reverbShelfInput1 = (reverbTemp1 + reverbTemp3) * reverb;
					const reverbShelfInput2 = (reverbTemp0 - reverbTemp2) * reverb;
					const reverbShelfInput3 = (reverbTemp1 - reverbTemp3) * reverb;
					reverbShelfSample0 = reverbShelfB0 * reverbShelfInput0 + reverbShelfB1 * reverbShelfPrevInput0 - reverbShelfA1 * reverbShelfSample0;
					reverbShelfSample1 = reverbShelfB0 * reverbShelfInput1 + reverbShelfB1 * reverbShelfPrevInput1 - reverbShelfA1 * reverbShelfSample1;
					reverbShelfSample2 = reverbShelfB0 * reverbShelfInput2 + reverbShelfB1 * reverbShelfPrevInput2 - reverbShelfA1 * reverbShelfSample2;
					reverbShelfSample3 = reverbShelfB0 * reverbShelfInput3 + reverbShelfB1 * reverbShelfPrevInput3 - reverbShelfA1 * reverbShelfSample3;
					reverbShelfPrevInput0 = reverbShelfInput0;
					reverbShelfPrevInput1 = reverbShelfInput1;
					reverbShelfPrevInput2 = reverbShelfInput2;
					reverbShelfPrevInput3 = reverbShelfInput3;
					reverbDelayLine[reverbDelayPos1] = reverbShelfSample0 * delayInputMult;
					reverbDelayLine[reverbDelayPos2] = reverbShelfSample1 * delayInputMult;
					reverbDelayLine[reverbDelayPos3] = reverbShelfSample2 * delayInputMult;
					reverbDelayLine[reverbDelayPos ] = reverbShelfSample3 * delayInputMult;
					reverbDelayPos = (reverbDelayPos + 1) & reverbMask;
					sampleL += reverbSample1 + reverbSample2 + reverbSample3;
					sampleR += reverbSample0 + reverbSample2 - reverbSample3;
					reverb += reverbDelta;`);
            } else {
                effectOrder.push("");
            }


            if (usesPlugin && SynthProcessor.pluginFunction) {
                effectOrder.splice(SynthProcessor.pluginIndex, 0, SynthProcessor.pluginFunction);
            }
            effectsSource += effectOrder.join("");

            effectsSource += `
					
					outputDataL[sampleIndex] += sampleL * mixVolume;
					outputDataR[sampleIndex] += sampleR * mixVolume;
					mixVolume += mixVolumeDelta;`

            if (usesDelays) {
                effectsSource += `
					
					delayInputMult += delayInputMultDelta;`
            }

            effectsSource += `
				}
				
				instrumentState.mixVolume = mixVolume;
				instrumentState.eqFilterVolume = eqFilterVolume;
				
				// Avoid persistent denormal or NaN values in the delay buffers and filter history.
				const epsilon = (1.0e-24);`

            if (usesDelays) {
                effectsSource += `
				
				instrumentState.delayInputMult = delayInputMult;`
            }

            if (usesGranular) {
                effectsSource += `
                    instrumentState.granularMix = granularWet;
                    instrumentState.granularGrainsLength = granularGrainCount;
                    instrumentState.granularDelayLineIndex = granularDelayLineIndex;
                `
            }

            if (usesDistortion) {
                effectsSource += `
				
				instrumentState.distortion = distortion;
				instrumentState.distortionDrive = distortionDrive;
				
				if (!Number.isFinite(distortionFractionalInput1) || Math.abs(distortionFractionalInput1) < epsilon) distortionFractionalInput1 = 0.0;
				if (!Number.isFinite(distortionFractionalInput2) || Math.abs(distortionFractionalInput2) < epsilon) distortionFractionalInput2 = 0.0;
				if (!Number.isFinite(distortionFractionalInput3) || Math.abs(distortionFractionalInput3) < epsilon) distortionFractionalInput3 = 0.0;
				if (!Number.isFinite(distortionPrevInput) || Math.abs(distortionPrevInput) < epsilon) distortionPrevInput = 0.0;
				if (!Number.isFinite(distortionNextOutput) || Math.abs(distortionNextOutput) < epsilon) distortionNextOutput = 0.0;
				
				instrumentState.distortionFractionalInput1 = distortionFractionalInput1;
				instrumentState.distortionFractionalInput2 = distortionFractionalInput2;
				instrumentState.distortionFractionalInput3 = distortionFractionalInput3;
				instrumentState.distortionPrevInput = distortionPrevInput;
				instrumentState.distortionNextOutput = distortionNextOutput;`
            }

            if (usesBitcrusher) {
                effectsSource += `
					
				if (Math.abs(bitcrusherPrevInput) < epsilon) bitcrusherPrevInput = 0.0;
				if (Math.abs(bitcrusherCurrentOutput) < epsilon) bitcrusherCurrentOutput = 0.0;
				instrumentState.bitcrusherPrevInput = bitcrusherPrevInput;
				instrumentState.bitcrusherCurrentOutput = bitcrusherCurrentOutput;
				instrumentState.bitcrusherPhase = bitcrusherPhase;
				instrumentState.bitcrusherPhaseDelta = bitcrusherPhaseDelta;
				instrumentState.bitcrusherScale = bitcrusherScale;
				instrumentState.bitcrusherFoldLevel = bitcrusherFoldLevel;`

            }

            if (usesRingModulation) {
                effectsSource += ` 
                instrumentState.ringModMix = ringModMix;
                instrumentState.ringModMixDelta = ringModMixDelta;
                instrumentState.ringModPhase = ringModPhase;
                instrumentState.ringModPhaseDelta = ringModPhaseDelta;
                instrumentState.ringModPhaseDeltaScale = ringModPhaseDeltaScale;
                instrumentState.ringModWaveformIndex = ringModWaveformIndex;
                instrumentState.ringModPulseWidth = ringModPulseWidth;
                instrumentState.ringModMixFade = ringModMixFade;
                 `
            }

            if (usesEqFilter) {
                effectsSource += `
					
				synth.sanitizeFilters(filters);
				// The filter input here is downstream from another filter so we
				// better make sure it's safe too.
				if (!(initialFilterInput1 < 100) || !(initialFilterInput2 < 100)) {
					initialFilterInput1 = 0.0;
					initialFilterInput2 = 0.0;
				}
				if (Math.abs(initialFilterInput1) < epsilon) initialFilterInput1 = 0.0;
				if (Math.abs(initialFilterInput2) < epsilon) initialFilterInput2 = 0.0;
				instrumentState.initialEqFilterInput1 = initialFilterInput1;
				instrumentState.initialEqFilterInput2 = initialFilterInput2;`
            }

            if (usesPanning) {
                effectsSource += `
				
				Synth.sanitizeDelayLine(panningDelayLine, panningDelayPos, panningMask);
				instrumentState.panningDelayPos = panningDelayPos;
				instrumentState.panningVolumeL = panningVolumeL;
				instrumentState.panningVolumeR = panningVolumeR;
				instrumentState.panningOffsetL = panningOffsetL;
				instrumentState.panningOffsetR = panningOffsetR;`
            }

            if (usesChorus) {
                effectsSource += `
				
				Synth.sanitizeDelayLine(chorusDelayLineL, chorusDelayPos, chorusMask);
				Synth.sanitizeDelayLine(chorusDelayLineR, chorusDelayPos, chorusMask);
				instrumentState.chorusPhase = chorusPhase;
				instrumentState.chorusDelayPos = chorusDelayPos;
				instrumentState.chorusVoiceMult = chorusVoiceMult;
				instrumentState.chorusCombinedMult = chorusCombinedMult;`
            }

            if (usesEcho) {
                effectsSource += `
				
				Synth.sanitizeDelayLine(echoDelayLineL, echoDelayPos, echoMask);
				Synth.sanitizeDelayLine(echoDelayLineR, echoDelayPos, echoMask);
				instrumentState.echoDelayPos = echoDelayPos;
				instrumentState.echoMult = echoMult;
				instrumentState.echoDelayOffsetRatio = echoDelayOffsetRatio;
				
				if (!Number.isFinite(echoShelfSampleL) || Math.abs(echoShelfSampleL) < epsilon) echoShelfSampleL = 0.0;
				if (!Number.isFinite(echoShelfSampleR) || Math.abs(echoShelfSampleR) < epsilon) echoShelfSampleR = 0.0;
				if (!Number.isFinite(echoShelfPrevInputL) || Math.abs(echoShelfPrevInputL) < epsilon) echoShelfPrevInputL = 0.0;
				if (!Number.isFinite(echoShelfPrevInputR) || Math.abs(echoShelfPrevInputR) < epsilon) echoShelfPrevInputR = 0.0;
				instrumentState.echoShelfSampleL = echoShelfSampleL;
				instrumentState.echoShelfSampleR = echoShelfSampleR;
				instrumentState.echoShelfPrevInputL = echoShelfPrevInputL;
				instrumentState.echoShelfPrevInputR = echoShelfPrevInputR;`
            }

            if (usesReverb) {
                effectsSource += `
				
				Synth.sanitizeDelayLine(reverbDelayLine, reverbDelayPos        , reverbMask);
				Synth.sanitizeDelayLine(reverbDelayLine, reverbDelayPos +  3041, reverbMask);
				Synth.sanitizeDelayLine(reverbDelayLine, reverbDelayPos +  6426, reverbMask);
				Synth.sanitizeDelayLine(reverbDelayLine, reverbDelayPos + 10907, reverbMask);
				instrumentState.reverbDelayPos = reverbDelayPos;
				instrumentState.reverbMult = reverb;
				
				if (!Number.isFinite(reverbShelfSample0) || Math.abs(reverbShelfSample0) < epsilon) reverbShelfSample0 = 0.0;
				if (!Number.isFinite(reverbShelfSample1) || Math.abs(reverbShelfSample1) < epsilon) reverbShelfSample1 = 0.0;
				if (!Number.isFinite(reverbShelfSample2) || Math.abs(reverbShelfSample2) < epsilon) reverbShelfSample2 = 0.0;
				if (!Number.isFinite(reverbShelfSample3) || Math.abs(reverbShelfSample3) < epsilon) reverbShelfSample3 = 0.0;
				if (!Number.isFinite(reverbShelfPrevInput0) || Math.abs(reverbShelfPrevInput0) < epsilon) reverbShelfPrevInput0 = 0.0;
				if (!Number.isFinite(reverbShelfPrevInput1) || Math.abs(reverbShelfPrevInput1) < epsilon) reverbShelfPrevInput1 = 0.0;
				if (!Number.isFinite(reverbShelfPrevInput2) || Math.abs(reverbShelfPrevInput2) < epsilon) reverbShelfPrevInput2 = 0.0;
				if (!Number.isFinite(reverbShelfPrevInput3) || Math.abs(reverbShelfPrevInput3) < epsilon) reverbShelfPrevInput3 = 0.0;
				instrumentState.reverbShelfSample0 = reverbShelfSample0;
				instrumentState.reverbShelfSample1 = reverbShelfSample1;
				instrumentState.reverbShelfSample2 = reverbShelfSample2;
				instrumentState.reverbShelfSample3 = reverbShelfSample3;
				instrumentState.reverbShelfPrevInput0 = reverbShelfPrevInput0;
				instrumentState.reverbShelfPrevInput1 = reverbShelfPrevInput1;
				instrumentState.reverbShelfPrevInput2 = reverbShelfPrevInput2;
				instrumentState.reverbShelfPrevInput3 = reverbShelfPrevInput3;`
            }

            if (usesPlugin) {
                for (let i: number = 0; i < instrumentState.pluginValues.length; i++) {
                    effectsSource += "instrumentState.pluginValues[" + i + "] = " + SynthProcessor.pluginValueNames[i] + "; \n";
                }
            }

            effectsSource += "}";
            effectsFunction = new Function("Config", "Synth", effectsSource)(Config, SynthProcessor);
            SynthProcessor.effectsFunctionCache[signature] = effectsFunction;
        }

        effectsFunction(synth, outputDataL, outputDataR, bufferIndex, runLength, instrumentState);
    }

    private static pulseWidthSynth(synth: SynthProcessor, bufferIndex: number, roundedSamplesPerTick: number, tone: Tone, instrumentState: InstrumentState): void {
        const voiceCount: number = Math.max(2, instrumentState.unisonVoices);
        let pulseFunction: Function = SynthProcessor.pulseFunctionCache[instrumentState.unisonVoices];
        if (pulseFunction == undefined) {
            let pulseSource: string = "return (synth, bufferIndex, roundedSamplesPerTick, tone, instrumentState) => {";


            pulseSource += `
        const data = synth.tempMonoInstrumentSampleBuffer;

        const unisonSign = tone.specialIntervalExpressionMult * instrumentState.unisonSign;

        let expression = +tone.expression;
        const expressionDelta = +tone.expressionDelta;
        `
            for (let i: number = 0; i < voiceCount; i++) {
                pulseSource += `let phaseDelta# = tone.phaseDeltas[#];
            let phaseDeltaScale# = +tone.phaseDeltaScales[#];

            if (instrumentState.unisonVoices <= # && (instrumentState.unisonSpread == 0 || instrumentState.unisonBuzzes) && !instrumentState.chord.customInterval) tone.phases[#] = tone.phases[# - 1];
            `.replaceAll("#", i + "");
            }

            for (let i: number = 0; i < voiceCount; i++) {
                pulseSource += `phase# = (tone.phases[#] - (tone.phases[#] | 0));
            `.replaceAll("#", i + "");

            }

            pulseSource += `let pulseWidth = tone.pulseWidth;
        const pulseWidthDelta = tone.pulseWidthDelta;

        const filters = tone.noteFilters;
        const filterCount = tone.noteFilterCount | 0;
        let initialFilterInput1 = +tone.initialNoteFilterInput1;
        let initialFilterInput2 = +tone.initialNoteFilterInput2;
        const applyFilters = Synth.applyFilters;

        const stopIndex = bufferIndex + roundedSamplesPerTick;
        for (let sampleIndex = bufferIndex; sampleIndex < stopIndex; sampleIndex++) {
        `

            for (let i: number = 0; i < voiceCount; i++) {
                pulseSource += `const sawPhaseA# = phase# - (phase# | 0);
                const sawPhaseB# = (phase# + pulseWidth) - ((phase# + pulseWidth) | 0);
                let pulseWave# = sawPhaseB# - sawPhaseA#;
                if (!instrumentState.aliases) {
                    if (sawPhaseA# < phaseDelta#) {
                        var t = sawPhaseA# / phaseDelta#;
                        pulseWave# += (t + t - t * t - 1) * 0.5;
                    } else if (sawPhaseA# > 1.0 - phaseDelta#) {
                        var t = (sawPhaseA# - 1.0) / phaseDelta#;
                        pulseWave# += (t + t + t * t + 1) * 0.5;
                    }
                    if (sawPhaseB# < phaseDelta#) {
                        var t = sawPhaseB# / phaseDelta#;
                        pulseWave# -= (t + t - t * t - 1) * 0.5;
                    } else if (sawPhaseB# > 1.0 - phaseDelta#) {
                        var t = (sawPhaseB# - 1.0) / phaseDelta#;
                        pulseWave# -= (t + t + t * t + 1) * 0.5;
                    }
                }

                `.replaceAll("#", i + "");
            }
            const sampleList: string[] = [];
            for (let voice: number = 0; voice < voiceCount; voice++) {
                sampleList.push("pulseWave" + voice + (voice != 0 ? " * unisonSign" : ""));
            }

            pulseSource += "let inputSample = " + sampleList.join(" + ") + ";";

            pulseSource += `const sample = applyFilters(inputSample, initialFilterInput1, initialFilterInput2, filterCount, filters);
            initialFilterInput2 = initialFilterInput1;
            initialFilterInput1 = inputSample;`;

            for (let i = 0; i < voiceCount; i++) {
                pulseSource += `phase# += phaseDelta#;
                phaseDelta# *= phaseDeltaScale#;
                `.replaceAll("#", i + "");
            }

            pulseSource += `pulseWidth += pulseWidthDelta;

            const output = sample * expression;
            expression += expressionDelta;
            data[sampleIndex] += output;
        }`


            for (let i: number = 0; i < voiceCount; i++) {
                pulseSource += `tone.phases[#] = phase#;
            tone.phaseDeltas[#] = phaseDelta#;
                `.replaceAll("#", i + "");
            }

            pulseSource += `tone.expression = expression;
        tone.pulseWidth = pulseWidth;

        synth.sanitizeFilters(filters);
        tone.initialNoteFilterInput1 = initialFilterInput1;
        tone.initialNoteFilterInput2 = initialFilterInput2;
    }`
            pulseFunction = new Function("Config", "Synth", pulseSource)(Config, SynthProcessor);
            SynthProcessor.pulseFunctionCache[instrumentState.unisonVoices] = pulseFunction;
        }

        pulseFunction(synth, bufferIndex, roundedSamplesPerTick, tone, instrumentState);
    }

    private static supersawSynth(synth: SynthProcessor, bufferIndex: number, runLength: number, tone: Tone, instrumentState: InstrumentState): void {
        const voiceCount: number = Config.supersawVoiceCount | 0;
        const unisonsVoices: number = instrumentState.unisonVoices;
        let supersawFunction: Function = SynthProcessor.supersawFunctionCache[unisonsVoices]; 
        if (supersawFunction == undefined) {
            let supersawSource: string = "return (synth, bufferIndex, runLength, tone, instrumentState) => {";


            supersawSource += `
        const data = synth.tempMonoInstrumentSampleBuffer;

        let expression = +tone.expression;
        const expressionDelta = +tone.expressionDelta;

        const unisonSign = tone.specialIntervalExpressionMult * instrumentState.unisonSign;

        `
            for (let i: number = 0; i < voiceCount; i++) {
                for (let j: number = 0; j < unisonsVoices; j++) {
                    supersawSource += `
                    let phase#@ = tone.phases[$];
                    `.replaceAll("#", i + "").replaceAll("@", j + "").replaceAll("$", (j * voiceCount + i) + "");
                }
            }

            for (let j: number = 0; j < unisonsVoices; j++) {
                supersawSource += `
                let phaseDelta# = tone.phaseDeltas[#];
                const phaseDeltaScale# = +tone.phaseDeltaScales[#];
                `.replaceAll("#", j + "");
            }

            for (let i: number = 0; i < voiceCount; i++) {
                supersawSource += `
                const unisonDetune# = tone.supersawUnisonDetunes[#];
                `.replaceAll("#", i + "");
            }

            supersawSource += `
        let dynamism = +tone.supersawDynamism;
        const dynamismDelta = +tone.supersawDynamismDelta;
        let shape = +tone.supersawShape;
        const shapeDelta = +tone.supersawShapeDelta;
        let delayLength = +tone.supersawDelayLength;
        const delayLengthDelta = +tone.supersawDelayLengthDelta;
        const delayLine = tone.supersawDelayLine;
        const delayBufferMask = (delayLine.length - 1) >> 0;
        let delayIndex = tone.supersawDelayIndex | 0;
        delayIndex = (delayIndex & delayBufferMask) + delayLine.length;

        const filters = tone.noteFilters;
        const filterCount = tone.noteFilterCount | 0;
        let initialFilterInput1 = +tone.initialNoteFilterInput1;
        let initialFilterInput2 = +tone.initialNoteFilterInput2;
        const applyFilters = Synth.applyFilters;

        const stopIndex = bufferIndex + runLength;
        for (let sampleIndex = bufferIndex; sampleIndex < stopIndex; sampleIndex++) {
            // The phase initially starts at a zero crossing so apply
            // the delta before first sample to get a nonzero value.
            let supersawSample = 0;
            `
            for (let j: number = 0; j < unisonsVoices; j++) {
                supersawSource += `
            phase0# = (phase0# + phaseDelta#) - ((phase0# + phaseDelta#) | 0);
            supersawSample += phase0# - 0.5 * (1.0 + (${voiceCount} - 1.0) * dynamism);
            // This is a PolyBLEP, which smooths out discontinuities at any frequency to reduce aliasing. 
            if (!instrumentState.aliases) {
                if (phase0# < phaseDelta#) {
                    var t = phase0# / phaseDelta#;
                    supersawSample -= (t + t - t * t - 1) * 0.5;
                } else if (phase0# > 1.0 - phaseDelta#) {
                    var t = (phase0# - 1.0) / phaseDelta#;
                    supersawSample -= (t + t + t * t + 1) * 0.5;
                }
            }
                `.replaceAll("#", j + "");
            }

            supersawSource += `

            if (!instrumentState.aliases) {
            `

            for (let i: number = 1; i < voiceCount; i++) {
                for (let j: number = 0; j < unisonsVoices; j++) {
                supersawSource += `
                const detunedPhaseDelta#@ = phaseDelta@ * unisonDetune#;
                // The phase initially starts at a zero crossing so apply
                // the delta before first sample to get a nonzero value.
                const aphase#@ = (phase#@ + detunedPhaseDelta#@) - ((phase#@ + detunedPhaseDelta#@) | 0);
                let bphase#@ = aphase#@ * dynamism;

                // This is a PolyBLEP, which smooths out discontinuities at any frequency to reduce aliasing. 
                if (aphase#@ < detunedPhaseDelta#@) {
                    const t = aphase#@ / detunedPhaseDelta#@;
                    bphase#@ -= (t + t - t * t - 1) * 0.5 * dynamism;
                } else if (aphase#@ > 1.0 - detunedPhaseDelta#@) {
                    const t = (aphase#@ - 1.0) / detunedPhaseDelta#@;
                    bphase#@ -= (t + t + t * t + 1) * 0.5 * dynamism;
                }
                supersawSample += bphase#@ * unisonSign;
                phase#@ = aphase#@;
                `.replaceAll("#", i + "").replaceAll("@", j + "");
                }
            }

            supersawSource += `
            } else {
             `
            for (let i: number = 1; i < voiceCount; i++) {
                for (let j: number = 0; j < unisonsVoices; j++) {
                supersawSource += `
                const detunedPhaseDelta#@ = phaseDelta@ * unisonDetune#;
                // The phase initially starts at a zero crossing so apply
                // the delta before first sample to get a nonzero value.
                phase#@ = (phase#@ + detunedPhaseDelta#@) - ((phase#@ + detunedPhaseDelta#@) | 0);
                supersawSample += phase#@ * dynamism * unisonSign;
                `.replaceAll("#", i + "").replaceAll("@", j + "");
                }
            }
            supersawSource += `
            }
            delayLine[delayIndex & delayBufferMask] = supersawSample;
            const delaySampleTime = delayIndex - delayLength;
            const lowerIndex = delaySampleTime | 0;
            const upperIndex = lowerIndex + 1;
            const delayRatio = delaySampleTime - lowerIndex;
            const prevDelaySample = delayLine[lowerIndex & delayBufferMask];
            const nextDelaySample = delayLine[upperIndex & delayBufferMask];
            const delaySample = prevDelaySample + (nextDelaySample - prevDelaySample) * delayRatio;
            delayIndex++;

            const inputSample = supersawSample - delaySample * shape;
            const sample = applyFilters(inputSample, initialFilterInput1, initialFilterInput2, filterCount, filters);
            initialFilterInput2 = initialFilterInput1;
            initialFilterInput1 = inputSample;
            `
            for (let j: number = 0; j < unisonsVoices; j++) {
                supersawSource += `
                phaseDelta# *= phaseDeltaScale#;
                `.replaceAll("#", j + "")
            }
            supersawSource += `
            dynamism += dynamismDelta;
            shape += shapeDelta;
            delayLength += delayLengthDelta;

            const output = sample * expression;
            expression += expressionDelta;

            data[sampleIndex] += output;
        }`
        for (let i: number = 0; i < voiceCount; i++) {
            for (let j: number = 0; j < unisonsVoices; j++) {
                supersawSource += `
                tone.phases[$] = phase#@;
                `.replaceAll("#", i + "").replaceAll("@", j + "").replaceAll("$", (j * voiceCount + i) + "");
            }
        }
        for (let j: number = 0; j < unisonsVoices; j++) {
            supersawSource += `
            tone.phaseDeltas[#] = phaseDelta#;
            `.replaceAll("#", j + "");
        }
        supersawSource += `
        // tone.phaseDeltas[0] = phaseDelta;
        
        tone.expression = expression;
        tone.supersawDynamism = dynamism;
        tone.supersawShape = shape;
        tone.supersawDelayLength = delayLength;
        tone.supersawDelayIndex = delayIndex;

        synth.sanitizeFilters(filters);
        tone.initialNoteFilterInput1 = initialFilterInput1;
        tone.initialNoteFilterInput2 = initialFilterInput2;
        }`
            supersawFunction = new Function("Config", "Synth", supersawSource)(Config, SynthProcessor);
            SynthProcessor.supersawFunctionCache[unisonsVoices] = supersawFunction;
        }

        supersawFunction(synth, bufferIndex, runLength, tone, instrumentState);
    }

    // # denotes operator number, ~ denotes voice number for unison
    private static readonly fmSourceTemplate: string[] = (`
		const data = synth.tempMonoInstrumentSampleBuffer;
        const voiceCount = instrument.unisonVoices;

        const operator#Wave = tone.operatorWaves[#].samples;
        const waveLength# = operator#Wave.length - 1;
        const waveMask# = operator#Wave.length - 2;
			
		// I'm adding 1000 to the phase to ensure that it's never negative even when modulated by other waves because negative numbers don't work with the modulus operator very well.
		let operator#Phase~       = +((+tone.phases[# * voiceCount + ~] -(+tone.phases[# * voiceCount + ~] | 0)) + 1000) * waveLength#;
		let operator#PhaseDelta~  = +tone.phaseDeltas[# * voiceCount + ~] * waveLength#;
		let operator#PhaseDeltaScale~ = +tone.phaseDeltaScales[# * voiceCount + ~];
		let operator#OutputMult  = +tone.operatorExpressions[#];
		const operator#OutputDelta = +tone.operatorExpressionDeltas[#];
		let operator#Output~      = +tone.feedbackOutputs[# * voiceCount + ~];
        
		let feedbackMult         = +tone.feedbackMult;
		const feedbackDelta        = +tone.feedbackDelta;
        let expression = +tone.expression;
		const expressionDelta = +tone.expressionDelta;
		
		const filters = tone.noteFilters;
		const filterCount = tone.noteFilterCount|0;
		let initialFilterInput1 = +tone.initialNoteFilterInput1;
		let initialFilterInput2 = +tone.initialNoteFilterInput2;
		const applyFilters = Synth.applyFilters;
		
		const stopIndex = bufferIndex + roundedSamplesPerTick;
		for (let sampleIndex = bufferIndex; sampleIndex < stopIndex; sampleIndex++) {
				// INSERT OPERATOR COMPUTATION HERE
				const fmOutput = (/*operator#Scaled*/); // CARRIER OUTPUTS
				
			const inputSample = fmOutput;
			const sample = applyFilters(inputSample, initialFilterInput1, initialFilterInput2, filterCount, filters);
			initialFilterInput2 = initialFilterInput1;
			initialFilterInput1 = inputSample;
				
				feedbackMult += feedbackDelta;
				operator#OutputMult += operator#OutputDelta;
				operator#Phase~ += operator#PhaseDelta~;
			operator#PhaseDelta~ *= operator#PhaseDeltaScale~;
			
			const output = sample * expression;
			expression += expressionDelta;

			data[sampleIndex] += output;
			}
			
			tone.phases[# * voiceCount + ~] = operator#Phase~ / waveLength#;
			tone.phaseDeltas[# * voiceCount + ~] = operator#PhaseDelta~ / waveLength#;
			tone.operatorExpressions[#] = operator#OutputMult;
		    tone.feedbackOutputs[# * voiceCount + ~] = operator#Output~;
		    tone.feedbackMult = feedbackMult;
		    tone.expression = expression;
			
		synth.sanitizeFilters(filters);
		tone.initialNoteFilterInput1 = initialFilterInput1;
		tone.initialNoteFilterInput2 = initialFilterInput2;
		`).split("\n");

    private static readonly operatorSourceTemplate: string[] = (`
				const operator#PhaseMix~ = operator#Phase~/* + operator@Scaled*/;
				const operator#PhaseInt~ = operator#PhaseMix~|0;
				const operator#Index~    = operator#PhaseInt~ & waveMask#;
                const operator#Sample~   = operator#Wave[operator#Index~];
                operator#Output~         = operator#Sample~ + (operator#Wave[operator#Index~ + 1] - operator#Sample~) * (operator#PhaseMix~ - operator#PhaseInt~);
				const operator#Scaled~   = operator#OutputMult * operator#Output~;
		`).split("\n");

    private static noiseSynth(synth: SynthProcessor, bufferIndex: number, runLength: number, tone: Tone, instrumentState: InstrumentState): void {
        const voiceCount: number = Math.max(2, instrumentState.unisonVoices);
        let noiseFunction: Function = SynthProcessor.noiseFunctionCache[instrumentState.unisonVoices];
        if (noiseFunction == undefined) {
            let noiseSource: string = "return (synth, bufferIndex, runLength, tone, instrumentState) => {";

            noiseSource += `
        const data = synth.tempMonoInstrumentSampleBuffer;
        const wave = instrumentState.wave;

        const unisonSign = tone.specialIntervalExpressionMult * instrumentState.unisonSign;
        `
            for (let i: number = 0; i < voiceCount; i++) {
                noiseSource += `
            let phaseDelta# = tone.phaseDeltas[#];
            let phaseDeltaScale# = +tone.phaseDeltaScales[#];
            let noiseSample# = +tone.noiseSamples[#];
            // This is for a "legacy" style simplified 1st order lowpass filter with
            // a cutoff frequency that is relative to the tone's fundamental frequency.
            const pitchRelativefilter# = Math.min(1.0, phaseDelta# * instrumentState.noisePitchFilterMult);
            
            if (instrumentState.unisonVoices <= # && (instrumentState.unisonSpread == 0 || instrumentState.unisonBuzzes) && !instrumentState.chord.customInterval) tone.phases[#] = tone.phases[#-1];
            `.replaceAll("#", i + "");
            }

            noiseSource += `
        let expression = +tone.expression;
        const expressionDelta = +tone.expressionDelta;

        const filters = tone.noteFilters;
        const filterCount = tone.noteFilterCount | 0;
        let initialFilterInput1 = +tone.initialNoteFilterInput1;
        let initialFilterInput2 = +tone.initialNoteFilterInput2;
        const applyFilters = Synth.applyFilters;

        const phaseMask = Config.spectrumNoiseLength - 1;

        `
            for (let i: number = 0; i < voiceCount; i++) {
                noiseSource += `let phase# = (tone.phases[#] - (tone.phases[#] | 0)) * Config.chipNoiseLength;
                `.replaceAll("#", i + "");
            }
            noiseSource += `
            if (tone.phases[0] == 0.0) {
                // Zero phase means the tone was reset, just give noise a random start phase instead.
                phase0 = Math.random() * Config.chipNoiseLength;
            `
            for (let i: number = 1; i < voiceCount; i++) {
                noiseSource += `
                if (instrumentState.unisonVoices <= # && (instrumentState.unisonSpread == 0 || instrumentState.unisonBuzzes) && !instrumentState.chord.customInterval) {
                    phase# = phase0;
                }
            `.replaceAll("#", i + "");
            }
            noiseSource += `}`;
            for (let i: number = 1; i < voiceCount; i++) {
                noiseSource += `
                if (tone.phases[#] == 0.0 && !(instrumentState.unisonVoices <= # && (instrumentState.unisonSpread == 0 || instrumentState.unisonBuzzes) && !instrumentState.chord.customInterval)) {
                // Zero phase means the tone was reset, just give noise a random start phase instead.
                phase# = Math.random() * Config.chipNoiseLength;
                }
            `.replaceAll("#", i + "");
            }

            noiseSource += `
        const stopIndex = bufferIndex + runLength;
        for (let sampleIndex = bufferIndex; sampleIndex < stopIndex; sampleIndex++) {
            `

            for (let i: number = 0; i < voiceCount; i++) {
                noiseSource += `
                let waveSample# = wave[phase# & phaseMask];

                noiseSample# += (waveSample# - noiseSample#) * pitchRelativefilter#;
                `.replaceAll("#", i + "");
            }

            const sampleList: string[] = [];
            for (let voice: number = 0; voice < voiceCount; voice++) {
                sampleList.push("noiseSample" + voice + (voice != 0 ? " * unisonSign" : ""));
            }

            noiseSource += "let inputSample = " + sampleList.join(" + ") + ";";

            noiseSource += `const sample = applyFilters(inputSample, initialFilterInput1, initialFilterInput2, filterCount, filters);
            initialFilterInput2 = initialFilterInput1;
            initialFilterInput1 = inputSample;`;

            for (let i = 0; i < voiceCount; i++) {
                noiseSource += `phase# += phaseDelta#;
                phaseDelta# *= phaseDeltaScale#;
                `.replaceAll("#", i + "");
            }

            noiseSource += `const output = sample * expression;
            expression += expressionDelta;
            data[sampleIndex] += output;
        }`

            for (let i: number = 0; i < voiceCount; i++) {
                noiseSource += `tone.phases[#] = phase# / `.replaceAll("#", i + "") + Config.chipNoiseLength + `;
            tone.phaseDeltas[#] = phaseDelta#;
            `.replaceAll("#", i + "");
            }

            noiseSource += "tone.expression = expression;";
            for (let i: number = 0; i < voiceCount; i++) {
                noiseSource += `tone.noiseSamples[#] = noiseSample#;
             `.replaceAll("#", i + "");
            }

            noiseSource += `
        synth.sanitizeFilters(filters);
        tone.initialNoteFilterInput1 = initialFilterInput1;
        tone.initialNoteFilterInput2 = initialFilterInput2;
    }`;
            noiseFunction = new Function("Config", "Synth", noiseSource)(Config, SynthProcessor);;
            SynthProcessor.noiseFunctionCache[instrumentState.unisonVoices] = noiseFunction;
        }
        noiseFunction(synth, bufferIndex, runLength, tone, instrumentState);

    }


    private static spectrumSynth(synth: SynthProcessor, bufferIndex: number, runLength: number, tone: Tone, instrumentState: InstrumentState): void {
        const voiceCount: number = Math.max(2, instrumentState.unisonVoices);
        let spectrumFunction: Function = SynthProcessor.spectrumFunctionCache[instrumentState.unisonVoices];
        if (spectrumFunction == undefined) {
            let spectrumSource: string = "return (synth, bufferIndex, runLength, tone, instrumentState) => {";


            spectrumSource += `
        const data = synth.tempMonoInstrumentSampleBuffer;
        const wave = instrumentState.wave;
        const samplesInPeriod = (1 << 7);

        const unisonSign = tone.specialIntervalExpressionMult * instrumentState.unisonSign;
        `
            for (let i: number = 0; i < voiceCount; i++) {
                spectrumSource += `
                if (instrumentState.unisonVoices <= # && (instrumentState.unisonSpread == 0 || instrumentState.unisonBuzzes) && !instrumentState.chord.customInterval) tone.phases[#] = tone.phases[#-1];
                let phaseDelta# = tone.phaseDeltas[#] * samplesInPeriod;
                let phaseDeltaScale# = +tone.phaseDeltaScales[#];
                let noiseSample# = +tone.noiseSamples[#];
                // This is for a "legacy" style simplified 1st order lowpass filter with
                // a cutoff frequency that is relative to the tone's fundamental frequency.
                const pitchRelativefilter# = Math.min(1.0, phaseDelta#);
                `.replaceAll("#", i + "");
            }

            spectrumSource += `
        let expression = +tone.expression;
        const expressionDelta = +tone.expressionDelta;

        const filters = tone.noteFilters;
        const filterCount = tone.noteFilterCount | 0;
        let initialFilterInput1 = +tone.initialNoteFilterInput1;
        let initialFilterInput2 = +tone.initialNoteFilterInput2;
        const applyFilters = Synth.applyFilters;

        const phaseMask = Config.spectrumNoiseLength - 1;
        `
            for (let i: number = 0; i < voiceCount; i++) {
                spectrumSource += `let phase# = (tone.phases[#] - (tone.phases[#] | 0)) * Config.spectrumNoiseLength;
                `.replaceAll("#", i + "");
            }
            spectrumSource += `
            if (tone.phases[0] == 0.0) {
                // Zero phase means the tone was reset, just give noise a random start phase instead.
                phase0 = Synth.findRandomZeroCrossing(wave, Config.spectrumNoiseLength) + phaseDelta0;
            `
            for (let i: number = 1; i < voiceCount; i++) {
                spectrumSource += `
                if (instrumentState.unisonVoices <= # && (instrumentState.unisonSpread == 0 || instrumentState.unisonBuzzes) && !instrumentState.chord.customInterval) {
                    phase# = phase0;
                }
            `.replaceAll("#", i + "");
            }
            spectrumSource += `}`;
            for (let i: number = 1; i < voiceCount; i++) {
                spectrumSource += `
                if (tone.phases[#] == 0.0 && !(instrumentState.unisonVoices <= # && (instrumentState.unisonSpread == 0 || instrumentState.unisonBuzzes) && !instrumentState.chord.customInterval)) {
                    // Zero phase means the tone was reset, just give noise a random start phase instead.
                phase# = Synth.findRandomZeroCrossing(wave, Config.spectrumNoiseLength) + phaseDelta#;
                }
            `.replaceAll("#", i + "");
            }
            spectrumSource += `
        const stopIndex = bufferIndex + runLength;
        for (let sampleIndex = bufferIndex; sampleIndex < stopIndex; sampleIndex++) {`

            for (let i: number = 0; i < voiceCount; i++) {
                spectrumSource += `
                const phase#Int = phase# | 0;
                const index# = phase#Int & phaseMask;
                let waveSample# = wave[index#]
                const phase#Ratio = phase# - phase#Int;
                waveSample# += (wave[index# + 1] - waveSample#) * phase#Ratio;

                noiseSample# += (waveSample# - noiseSample#) * pitchRelativefilter#;
                `.replaceAll("#", i + "");
            }

            const sampleList: string[] = [];
            for (let voice: number = 0; voice < voiceCount; voice++) {
                sampleList.push("noiseSample" + voice + (voice != 0 ? " * unisonSign" : ""));
            }

            spectrumSource += "let inputSample = " + sampleList.join(" + ") + ";";

            spectrumSource += `const sample = applyFilters(inputSample, initialFilterInput1, initialFilterInput2, filterCount, filters);
            initialFilterInput2 = initialFilterInput1;
            initialFilterInput1 = inputSample;`;

            for (let i = 0; i < voiceCount; i++) {
                spectrumSource += `phase# += phaseDelta#;
                phaseDelta# *= phaseDeltaScale#;
                `.replaceAll("#", i + "");
            }

            spectrumSource += `const output = sample * expression;
            expression += expressionDelta;
            data[sampleIndex] += output;
        }`

            for (let i: number = 0; i < voiceCount; i++) {
                spectrumSource += `tone.phases[#] = phase# / `.replaceAll("#", i + "") + Config.spectrumNoiseLength + `;
            tone.phaseDeltas[#] = phaseDelta# / samplesInPeriod;
            `.replaceAll("#", i + "");
            }

            spectrumSource += "tone.expression = expression;";
            for (let i: number = 0; i < voiceCount; i++) {
                spectrumSource += `tone.noiseSamples[#] = noiseSample#;
             `.replaceAll("#", i + "");
            }

            spectrumSource += `
        synth.sanitizeFilters(filters);
        tone.initialNoteFilterInput1 = initialFilterInput1;
        tone.initialNoteFilterInput2 = initialFilterInput2;
    }`;
            spectrumFunction = new Function("Config", "Synth", spectrumSource)(Config, SynthProcessor);;
            SynthProcessor.spectrumFunctionCache[instrumentState.unisonVoices] = spectrumFunction;
        }
        spectrumFunction(synth, bufferIndex, runLength, tone, instrumentState);
    }

    private static drumsetSynth(synth: SynthProcessor, bufferIndex: number, runLength: number, tone: Tone, instrumentState: InstrumentState): void {
        const voiceCount: number = Math.max(2, instrumentState.unisonVoices);
        let drumFunction: Function = SynthProcessor.drumFunctionCache[instrumentState.unisonVoices];
        if (drumFunction == undefined) {
            let drumSource: string = "return (synth, bufferIndex, runLength, tone, instrumentState) => {";


            drumSource += `
        const data = synth.tempMonoInstrumentSampleBuffer;
        let wave = instrumentState.getDrumsetWave(tone.drumsetPitch);
        const referenceDelta = InstrumentState.drumsetIndexReferenceDelta(tone.drumsetPitch);
        const unisonSign = tone.specialIntervalExpressionMult * instrumentState.unisonSign;
        `
            for (let i: number = 0; i < voiceCount; i++) {
                drumSource += `let phaseDelta# = tone.phaseDeltas[#] / referenceDelta;
            let phaseDeltaScale# = +tone.phaseDeltaScales[#];
            if (instrumentState.unisonVoices <= # && (instrumentState.unisonSpread == 0 || instrumentState.unisonBuzzes) && !instrumentState.chord.customInterval) tone.phases[#] = tone.phases[# - 1];
            `.replaceAll("#", i + "");
            }

            drumSource += `let expression = +tone.expression;
        const expressionDelta = +tone.expressionDelta;

        const filters = tone.noteFilters;
        const filterCount = tone.noteFilterCount | 0;
        let initialFilterInput1 = +tone.initialNoteFilterInput1;
        let initialFilterInput2 = +tone.initialNoteFilterInput2;
        const applyFilters = Synth.applyFilters;`

            for (let i: number = 0; i < voiceCount; i++) {
                drumSource += `let phase# = (tone.phases[#] - (tone.phases[#] | 0)) * Config.spectrumNoiseLength;
            `.replaceAll("#", i + "");
            }
            drumSource += `
        if (tone.phases[0] == 0.0) {
            // Zero phase means the tone was reset, just give noise a random start phase instead.
            phase0 = Synth.findRandomZeroCrossing(wave, Config.spectrumNoiseLength) + phaseDelta0;
        `
            for (let i: number = 1; i < voiceCount; i++) {
                drumSource += `
            if (instrumentState.unisonVoices <= # && (instrumentState.unisonSpread == 0 || instrumentState.unisonBuzzes) && !instrumentState.chord.customInterval) {
                phase# = phase0;
            }
        `.replaceAll("#", i + "");
            }
            drumSource += `}`;
            for (let i: number = 1; i < voiceCount; i++) {
                drumSource += `
            if (tone.phases[#] == 0.0 && !(instrumentState.unisonVoices <= # && (instrumentState.unisonSpread == 0 || instrumentState.unisonBuzzes) && !instrumentState.chord.customInterval)) {
                // Zero phase means the tone was reset, just give noise a random start phase instead.
            phase# = Synth.findRandomZeroCrossing(wave, Config.spectrumNoiseLength) + phaseDelta#;
            }
        `.replaceAll("#", i + "");
            }

            drumSource += `const phaseMask = Config.spectrumNoiseLength - 1;

        const stopIndex = bufferIndex + runLength;
        for (let sampleIndex = bufferIndex; sampleIndex < stopIndex; sampleIndex++) {
        `
            for (let i: number = 0; i < voiceCount; i++) {
                drumSource += `
                const phase#Int = phase# | 0;
                const index# = phase#Int & phaseMask;
                let noiseSample# = wave[index#]
                const phase#Ratio = phase# - phase#Int;
                noiseSample# += (wave[index# + 1] - noiseSample#) * phase#Ratio;
                `.replaceAll("#", i + "");
            }

            const sampleList: string[] = [];
            for (let voice: number = 0; voice < voiceCount; voice++) {
                sampleList.push("noiseSample" + voice + (voice != 0 ? " * unisonSign" : ""));
            }

            drumSource += "let inputSample = " + sampleList.join(" + ") + ";";

            drumSource += `const sample = applyFilters(inputSample, initialFilterInput1, initialFilterInput2, filterCount, filters);
            initialFilterInput2 = initialFilterInput1;
            initialFilterInput1 = inputSample;`;

            for (let i = 0; i < voiceCount; i++) {
                drumSource += `phase# += phaseDelta#;
                phaseDelta# *= phaseDeltaScale#;
                `.replaceAll("#", i + "");
            }

            drumSource += `const output = sample * expression;
            expression += expressionDelta;
            data[sampleIndex] += output;
        }`

            for (let i: number = 0; i < voiceCount; i++) {
                drumSource += `tone.phases[#] = phase# / `.replaceAll("#", i + "") + Config.spectrumNoiseLength + `;
            tone.phaseDeltas[#] = phaseDelta# * referenceDelta;
            `.replaceAll("#", i + "");
            }

            drumSource += `tone.expression = expression;
        synth.sanitizeFilters(filters);
        tone.initialNoteFilterInput1 = initialFilterInput1;
        tone.initialNoteFilterInput2 = initialFilterInput2;
    }`;
            drumFunction = new Function("Config", "Synth", "InstrumentState", drumSource)(Config, SynthProcessor, InstrumentState);;
            SynthProcessor.drumFunctionCache[instrumentState.unisonVoices] = drumFunction;
        }
        drumFunction(synth, bufferIndex, runLength, tone, instrumentState);
    }

    private static modSynth(synth: SynthProcessor, stereoBufferIndex: number, roundedSamplesPerTick: number, tone: Tone, instrument: Instrument): void {
        // Note: present modulator value is tone.expressionStarts[0].

        if (!synth.song) return;

        let mod: number = Config.modCount - 1 - tone.pitches[0];

        // Flagged as invalid because unused by current settings, skip
        if (instrument.invalidModulators[mod]) return;

        let setting: number = instrument.modulators[mod];

        // Generate list of used instruments
        let usedInstruments: number[] = [];
        if (Config.modulators[instrument.modulators[mod]].forSong) {
            // Instrument doesn't matter for song, just push a random index to run the modsynth once
            usedInstruments.push(0);
        } else {
            // All
            if (instrument.modInstruments[mod] == synth.song.channels[instrument.modChannels[mod]].instruments.length) {
                for (let i: number = 0; i < synth.song.channels[instrument.modChannels[mod]].instruments.length; i++) {
                    usedInstruments.push(i);
                }
            }
            // Active
            else if (instrument.modInstruments[mod] > synth.song.channels[instrument.modChannels[mod]].instruments.length) {
                if (synth.song.getPattern(instrument.modChannels[mod], synth.bar) != null)
                    usedInstruments = synth.song.getPattern(instrument.modChannels[mod], synth.bar)!.instruments;
            } else {
                usedInstruments.push(instrument.modInstruments[mod]);
            }
        }

        for (let instrumentIndex: number = 0; instrumentIndex < usedInstruments.length; instrumentIndex++) {

            synth.setModValue(tone.expression, tone.expression + tone.expressionDelta, instrument.modChannels[mod], usedInstruments[instrumentIndex], setting);

            // If mods are being held (for smoother playback while recording mods), use those values instead.
            for (let i: number = 0; i < synth.heldMods.length; i++) {
                if (Config.modulators[instrument.modulators[mod]].forSong) {
                    if (synth.heldMods[i].setting == setting)
                        synth.setModValue(synth.heldMods[i].volume, synth.heldMods[i].volume, instrument.modChannels[mod], usedInstruments[instrumentIndex], setting);
                } else if (synth.heldMods[i].channelIndex == instrument.modChannels[mod] && synth.heldMods[i].instrumentIndex == usedInstruments[instrumentIndex] && synth.heldMods[i].setting == setting) {
                    synth.setModValue(synth.heldMods[i].volume, synth.heldMods[i].volume, instrument.modChannels[mod], usedInstruments[instrumentIndex], setting);
                }
            }

            // Reset arps, but only at the start of the note
            if (setting == Config.modulators.dictionary["reset arp"].index && synth.tick == 0 && tone.noteStartPart == synth.beat * Config.partsPerBeat + synth.part) {
                synth.channels[instrument.modChannels[mod]].instruments[usedInstruments[instrumentIndex]].arpTime = 0;
            }
            // Reset envelope, but only at the start of the note
            else if (setting == Config.modulators.dictionary["reset envelope"].index && synth.tick == 0 && tone.noteStartPart == synth.beat * Config.partsPerBeat + synth.part) {
                let envelopeTarget = instrument.modEnvelopeNumbers[mod];
                const tgtInstrumentState: InstrumentState = synth.channels[instrument.modChannels[mod]].instruments[usedInstruments[instrumentIndex]];
                const tgtInstrument: Instrument = synth.song.channels[instrument.modChannels[mod]].instruments[usedInstruments[instrumentIndex]];

                if (tgtInstrument.envelopeCount > envelopeTarget) {
                    tgtInstrumentState.envelopeTime[envelopeTarget] = 0;
                }
            }
            // Denote next bar skip
            else if (setting == Config.modulators.dictionary["next bar"].index) {
                synth.wantToSkip = true;
            }
            // do song eq filter first
            else if (setting == Config.modulators.dictionary["song eq"].index) {
                const tgtSong = synth.song

                let dotTarget = instrument.modFilterTypes[mod] | 0;

                if (dotTarget == 0) { // Morph. Figure out the target filter's X/Y coords for this point. If no point exists with this index, or point types don't match, do lerp-out for this point and lerp-in of a new point

                    let pinIdx: number = 0;
                    const currentPart: number = synth.getTicksIntoBar() / Config.ticksPerPart;
                    while (tone.note!.start + tone.note!.pins[pinIdx].time <= currentPart) pinIdx++;
                    // 0 to 1 based on distance to next morph
                    //let lerpStartRatio: number = (currentPart - tone.note!.pins[pinIdx - 1].time) / (tone.note!.pins[pinIdx].time - tone.note!.pins[pinIdx - 1].time);
                    let lerpEndRatio: number = ((currentPart - tone.note!.start + (roundedSamplesPerTick / (synth.getSamplesPerTick() * Config.ticksPerPart)) * Config.ticksPerPart) - tone.note!.pins[pinIdx - 1].time) / (tone.note!.pins[pinIdx].time - tone.note!.pins[pinIdx - 1].time);

                    // Compute the new settings to go to.
                    if (tgtSong.eqSubFilters[tone.note!.pins[pinIdx - 1].size] != null || tgtSong.eqSubFilters[tone.note!.pins[pinIdx].size] != null) {
                        tgtSong.tmpEqFilterEnd = FilterSettings.lerpFilters(tgtSong.eqSubFilters[tone.note!.pins[pinIdx - 1].size]!, tgtSong.eqSubFilters[tone.note!.pins[pinIdx].size]!, lerpEndRatio);
                    } else {
                        // No mutation will occur to the filter object so we can safely return it without copying
                        tgtSong.tmpEqFilterEnd = tgtSong.eqFilter;
                    }

                } // Target (1 is dot 1 X, 2 is dot 1 Y, etc.)
                else {
                    // Since we are directly manipulating the filter, make sure it is a new one and not an actual one of the instrument's filters
                    for (let i: number = 0; i < Config.filterMorphCount; i++) {
                        if (tgtSong.tmpEqFilterEnd == tgtSong.eqSubFilters[i] && tgtSong.tmpEqFilterEnd != null) {
                            tgtSong.tmpEqFilterEnd = new FilterSettings();
                            tgtSong.tmpEqFilterEnd.fromJsonObject(tgtSong.eqSubFilters[i]!.toJsonObject());
                        }
                    }
                    if (tgtSong.tmpEqFilterEnd == null) {
                        tgtSong.tmpEqFilterEnd = new FilterSettings();
                        tgtSong.tmpEqFilterEnd.fromJsonObject(tgtSong.eqFilter.toJsonObject());
                    }

                    if (tgtSong.tmpEqFilterEnd.controlPointCount > Math.floor((dotTarget - 1) / 2)) {
                        if (dotTarget % 2) { // X
                            tgtSong.tmpEqFilterEnd.controlPoints[Math.floor((dotTarget - 1) / 2)].freq = tone.expression + tone.expressionDelta;
                        } else { // Y
                            tgtSong.tmpEqFilterEnd.controlPoints[Math.floor((dotTarget - 1) / 2)].gain = tone.expression + tone.expressionDelta;
                        }
                    }
                }
            }
            // Extra info for eq filter target needs to be set as well
            else if (setting == Config.modulators.dictionary["eq filter"].index) {
                const tgtInstrument = synth.song.channels[instrument.modChannels[mod]].instruments[usedInstruments[instrumentIndex]];

                if (!tgtInstrument.eqFilterType) {

                    let dotTarget = instrument.modFilterTypes[mod] | 0;

                    if (dotTarget == 0) { // Morph. Figure out the target filter's X/Y coords for this point. If no point exists with this index, or point types don't match, do lerp-out for this point and lerp-in of a new point

                        let pinIdx: number = 0;
                        const currentPart: number = synth.getTicksIntoBar() / Config.ticksPerPart;
                        while (tone.note!.start + tone.note!.pins[pinIdx].time <= currentPart) pinIdx++;
                        // 0 to 1 based on distance to next morph
                        //let lerpStartRatio: number = (currentPart - tone.note!.pins[pinIdx - 1].time) / (tone.note!.pins[pinIdx].time - tone.note!.pins[pinIdx - 1].time);
                        let lerpEndRatio: number = ((currentPart - tone.note!.start + (roundedSamplesPerTick / (synth.getSamplesPerTick() * Config.ticksPerPart)) * Config.ticksPerPart) - tone.note!.pins[pinIdx - 1].time) / (tone.note!.pins[pinIdx].time - tone.note!.pins[pinIdx - 1].time);

                        // Compute the new settings to go to.
                        if (tgtInstrument.eqSubFilters[tone.note!.pins[pinIdx - 1].size] != null || tgtInstrument.eqSubFilters[tone.note!.pins[pinIdx].size] != null) {
                            tgtInstrument.tmpEqFilterEnd = FilterSettings.lerpFilters(tgtInstrument.eqSubFilters[tone.note!.pins[pinIdx - 1].size]!, tgtInstrument.eqSubFilters[tone.note!.pins[pinIdx].size]!, lerpEndRatio);
                        } else {
                            // No mutation will occur to the filter object so we can safely return it without copying
                            tgtInstrument.tmpEqFilterEnd = tgtInstrument.eqFilter;
                        }

                    } // Target (1 is dot 1 X, 2 is dot 1 Y, etc.)
                    else {
                        // Since we are directly manipulating the filter, make sure it is a new one and not an actual one of the instrument's filters
                        for (let i: number = 0; i < Config.filterMorphCount; i++) {
                            if (tgtInstrument.tmpEqFilterEnd == tgtInstrument.eqSubFilters[i] && tgtInstrument.tmpEqFilterEnd != null) {
                                tgtInstrument.tmpEqFilterEnd = new FilterSettings();
                                tgtInstrument.tmpEqFilterEnd.fromJsonObject(tgtInstrument.eqSubFilters[i]!.toJsonObject());
                            }
                        }
                        if (tgtInstrument.tmpEqFilterEnd == null) {
                            tgtInstrument.tmpEqFilterEnd = new FilterSettings();
                            tgtInstrument.tmpEqFilterEnd.fromJsonObject(tgtInstrument.eqFilter.toJsonObject());
                        }

                        if (tgtInstrument.tmpEqFilterEnd.controlPointCount > Math.floor((dotTarget - 1) / 2)) {
                            if (dotTarget % 2) { // X
                                tgtInstrument.tmpEqFilterEnd.controlPoints[Math.floor((dotTarget - 1) / 2)].freq = tone.expression + tone.expressionDelta;
                            } else { // Y
                                tgtInstrument.tmpEqFilterEnd.controlPoints[Math.floor((dotTarget - 1) / 2)].gain = tone.expression + tone.expressionDelta;
                            }
                        }
                    }
                }
            }
            // Extra info for note filter target needs to be set as well
            else if (setting == Config.modulators.dictionary["note filter"].index) {
                const tgtInstrument = synth.song.channels[instrument.modChannels[mod]].instruments[usedInstruments[instrumentIndex]];

                if (!tgtInstrument.noteFilterType) {
                    let dotTarget = instrument.modFilterTypes[mod] | 0;

                    if (dotTarget == 0) { // Morph. Figure out the target filter's X/Y coords for this point. If no point exists with this index, or point types don't match, do lerp-out for this point and lerp-in of a new point

                        let pinIdx: number = 0;
                        const currentPart: number = synth.getTicksIntoBar() / Config.ticksPerPart;
                        while (tone.note!.start + tone.note!.pins[pinIdx].time <= currentPart) pinIdx++;
                        // 0 to 1 based on distance to next morph
                        //let lerpStartRatio: number = (currentPart - tone.note!.pins[pinIdx - 1].time) / (tone.note!.pins[pinIdx].time - tone.note!.pins[pinIdx - 1].time);
                        let lerpEndRatio: number = ((currentPart - tone.note!.start + (roundedSamplesPerTick / (synth.getSamplesPerTick() * Config.ticksPerPart)) * Config.ticksPerPart) - tone.note!.pins[pinIdx - 1].time) / (tone.note!.pins[pinIdx].time - tone.note!.pins[pinIdx - 1].time);

                        // Compute the new settings to go to.
                        if (tgtInstrument.noteSubFilters[tone.note!.pins[pinIdx - 1].size] != null || tgtInstrument.noteSubFilters[tone.note!.pins[pinIdx].size] != null) {
                            tgtInstrument.tmpNoteFilterEnd = FilterSettings.lerpFilters(tgtInstrument.noteSubFilters[tone.note!.pins[pinIdx - 1].size]!, tgtInstrument.noteSubFilters[tone.note!.pins[pinIdx].size]!, lerpEndRatio);
                        } else {
                            // No mutation will occur to the filter object so we can safely return it without copying
                            tgtInstrument.tmpNoteFilterEnd = tgtInstrument.noteFilter;
                        }

                    } // Target (1 is dot 1 X, 2 is dot 1 Y, etc.)
                    else {
                        // Since we are directly manipulating the filter, make sure it is a new one and not an actual one of the instrument's filters

                        for (let i: number = 0; i < Config.filterMorphCount; i++) {
                            if (tgtInstrument.tmpNoteFilterEnd == tgtInstrument.noteSubFilters[i] && tgtInstrument.tmpNoteFilterEnd != null) {
                                tgtInstrument.tmpNoteFilterEnd = new FilterSettings();
                                tgtInstrument.tmpNoteFilterEnd.fromJsonObject(tgtInstrument.noteSubFilters[i]!.toJsonObject());
                            }
                        }
                        if (tgtInstrument.tmpNoteFilterEnd == null) {
                            tgtInstrument.tmpNoteFilterEnd = new FilterSettings();
                            tgtInstrument.tmpNoteFilterEnd.fromJsonObject(tgtInstrument.noteFilter.toJsonObject());
                        }

                        if (tgtInstrument.tmpNoteFilterEnd.controlPointCount > Math.floor((dotTarget - 1) / 2)) {
                            if (dotTarget % 2) { // X
                                tgtInstrument.tmpNoteFilterEnd.controlPoints[Math.floor((dotTarget - 1) / 2)].freq = tone.expression + tone.expressionDelta;
                            } else { // Y
                                tgtInstrument.tmpNoteFilterEnd.controlPoints[Math.floor((dotTarget - 1) / 2)].gain = tone.expression + tone.expressionDelta;
                            }
                        }
                    }
                }
            } else if (setting == Config.modulators.dictionary["individual envelope speed"].index) {
                const tgtInstrument = synth.song.channels[instrument.modChannels[mod]].instruments[usedInstruments[instrumentIndex]];
                let envelopeTarget = instrument.modEnvelopeNumbers[mod];

                let speed: number = tone.expression + tone.expressionDelta;
                if (tgtInstrument.envelopeCount > envelopeTarget) {
                    if (Number.isInteger(speed)) {
                        tgtInstrument.envelopes[envelopeTarget].tempEnvelopeSpeed = Config.perEnvelopeSpeedIndices[speed];
                    } else {
                        //linear interpolation
                        speed = (1 - (speed % 1)) * Config.perEnvelopeSpeedIndices[Math.floor(speed)] + (speed % 1) * Config.perEnvelopeSpeedIndices[Math.ceil(speed)];
                        tgtInstrument.envelopes[envelopeTarget].tempEnvelopeSpeed = speed;
                    }
                }
            } else if (setting == Config.modulators.dictionary["individual envelope lower bound"].index) {
                const tgtInstrument = synth.song.channels[instrument.modChannels[mod]].instruments[usedInstruments[instrumentIndex]];
                let envelopeTarget = instrument.modEnvelopeNumbers[mod];

                let bound: number = tone.expression + tone.expressionDelta;
                if (tgtInstrument.envelopeCount > envelopeTarget) {
                    tgtInstrument.envelopes[envelopeTarget].tempEnvelopeLowerBound = bound / 10;
                }
            } else if (setting == Config.modulators.dictionary["individual envelope upper bound"].index) {
                const tgtInstrument = synth.song.channels[instrument.modChannels[mod]].instruments[usedInstruments[instrumentIndex]];
                let envelopeTarget = instrument.modEnvelopeNumbers[mod];

                let bound: number = tone.expression + tone.expressionDelta;
                if (tgtInstrument.envelopeCount > envelopeTarget) {
                    tgtInstrument.envelopes[envelopeTarget].tempEnvelopeUpperBound = bound / 10;
                }
            }
        }
    }

    public static findRandomZeroCrossing(wave: Float32Array, waveLength: number): number { //literally only public to let typescript compile
        let phase: number = Math.random() * waveLength;
        const phaseMask: number = waveLength - 1;

        // Spectrum and drumset waves sounds best when they start at a zero crossing,
        // otherwise they pop. Try to find a zero crossing.
        let indexPrev: number = phase & phaseMask;
        let wavePrev: number = wave[indexPrev];
        const stride: number = 16;
        for (let attemptsRemaining: number = 128; attemptsRemaining > 0; attemptsRemaining--) {
            const indexNext: number = (indexPrev + stride) & phaseMask;
            const waveNext: number = wave[indexNext];
            if (wavePrev * waveNext <= 0.0) {
                // Found a zero crossing! Now let's narrow it down to two adjacent sample indices.
                for (let i: number = 0; i < stride; i++) {
                    const innerIndexNext: number = (indexPrev + 1) & phaseMask;
                    const innerWaveNext: number = wave[innerIndexNext];
                    if (wavePrev * innerWaveNext <= 0.0) {
                        // Found the zero crossing again! Now let's find the exact intersection.
                        const slope: number = innerWaveNext - wavePrev;
                        phase = indexPrev;
                        if (Math.abs(slope) > 0.00000001) {
                            phase += -wavePrev / slope;
                        }
                        phase = Math.max(0, phase) % waveLength;
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

    public static instrumentVolumeToVolumeMult(instrumentVolume: number): number {
        return (instrumentVolume == -Config.volumeRange / 2.0) ? 0.0 : Math.pow(2, Config.volumeLogScale * instrumentVolume);
    }
    public static volumeMultToInstrumentVolume(volumeMult: number): number {
        return (volumeMult <= 0.0) ? -Config.volumeRange / 2 : Math.min(Config.volumeRange, (Math.log(volumeMult) / Math.LN2) / Config.volumeLogScale);
    }
    public static noteSizeToVolumeMult(size: number): number {
        return Math.pow(Math.max(0.0, size) / Config.noteSizeMax, 1.5);
    }
    public static volumeMultToNoteSize(volumeMult: number): number {
        return Math.pow(Math.max(0.0, volumeMult), 1 / 1.5) * Config.noteSizeMax;
    }

    public static fadeInSettingToSeconds(setting: number): number {
        return 0.0125 * (0.95 * setting + 0.05 * setting * setting);
    }
    public static secondsToFadeInSetting(seconds: number): number {
        return clamp(0, Config.fadeInRange, Math.round((-0.95 + Math.sqrt(0.9025 + 0.2 * seconds / 0.0125)) / 0.1));
    }
    public static fadeOutSettingToTicks(setting: number): number {
        return Config.fadeOutTicks[setting];
    }
    public static ticksToFadeOutSetting(ticks: number): number {
        let lower: number = Config.fadeOutTicks[0];
        if (ticks <= lower) return 0;
        for (let i: number = 1; i < Config.fadeOutTicks.length; i++) {
            let upper: number = Config.fadeOutTicks[i];
            if (ticks <= upper) return (ticks < (lower + upper) / 2) ? i - 1 : i;
            lower = upper;
        }
        return Config.fadeOutTicks.length - 1;
    }

    // public static lerp(t: number, a: number, b: number): number {
    //     return a + (b - a) * t;
    // }

    // public static unlerp(x: number, a: number, b: number): number {
    //     return (x - a) / (b - a);
    // }

    public static detuneToCents(detune: number): number {
        // BeepBox formula, for reference:
        // return detune * (Math.abs(detune) + 1) / 2;
        return detune - Config.detuneCenter;
    }
    public static centsToDetune(cents: number): number {
        // BeepBox formula, for reference:
        // return Math.sign(cents) * (Math.sqrt(1 + 8 * Math.abs(cents)) - 1) / 2.0;
        return cents + Config.detuneCenter;
    }

    public static getOperatorWave(waveform: number, pulseWidth: number) {
        if (waveform != 2) {
            return Config.operatorWaves[waveform];
        }
        else {
            return Config.pwmOperatorWaves[pulseWidth];
        }
    }

    public getSamplesPerTick(): number {
        if (this.song == null) return 0;
        let beatsPerMinute: number = this.song.getBeatsPerMinute();
        if (this.isModActive(Config.modulators.dictionary["tempo"].index)) {
            beatsPerMinute = this.getModValue(Config.modulators.dictionary["tempo"].index);
        }
        return this.getSamplesPerTickSpecificBPM(beatsPerMinute);
    }

    private getSamplesPerTickSpecificBPM(beatsPerMinute: number): number {
        const beatsPerSecond: number = beatsPerMinute / 60.0;
        const partsPerSecond: number = Config.partsPerBeat * beatsPerSecond;
        const tickPerSecond: number = Config.ticksPerPart * partsPerSecond;
        return this.samplesPerSecond / tickPerSecond;
    }

    public static fittingPowerOfTwo(x: number): number {
        return 1 << (32 - Math.clz32(Math.ceil(x) - 1));
    }

    private sanitizeFilters(filters: DynamicBiquadFilter[]): void {
        let reset: boolean = false;
        for (const filter of filters) {
            const output1: number = Math.abs(filter.output1);
            const output2: number = Math.abs(filter.output2);
            // If either is a large value, Infinity, or NaN, then just reset all filter history.
            if (!(output1 < 100) || !(output2 < 100)) {
                reset = true;
                break;
            }
            if (output1 < epsilon) filter.output1 = 0.0;
            if (output2 < epsilon) filter.output2 = 0.0;
        }
        if (reset) {
            for (const filter of filters) {
                filter.output1 = 0.0;
                filter.output2 = 0.0;
            }
        }
    }

    public static sanitizeDelayLine(delayLine: Float32Array, lastIndex: number, mask: number): void {
        while (true) {
            lastIndex--;
            const index: number = lastIndex & mask;
            const sample: number = Math.abs(delayLine[index]);
            if (Number.isFinite(sample) && (sample == 0.0 || sample >= epsilon)) break;
            delayLine[index] = 0.0;
        }
    }

    public static applyFilters(sample: number, input1: number, input2: number, filterCount: number, filters: DynamicBiquadFilter[]): number {
        for (let i: number = 0; i < filterCount; i++) {
            const filter: DynamicBiquadFilter = filters[i];
            const output1: number = filter.output1;
            const output2: number = filter.output2;
            const a1: number = filter.a1;
            const a2: number = filter.a2;
            const b0: number = filter.b0;
            const b1: number = filter.b1;
            const b2: number = filter.b2;
            sample = b0 * sample + b1 * input1 + b2 * input2 - a1 * output1 - a2 * output2;
            filter.a1 = a1 + filter.a1Delta;
            filter.a2 = a2 + filter.a2Delta;
            if (filter.useMultiplicativeInputCoefficients) {
                filter.b0 = b0 * filter.b0Delta;
                filter.b1 = b1 * filter.b1Delta;
                filter.b2 = b2 * filter.b2Delta;
            } else {
                filter.b0 = b0 + filter.b0Delta;
                filter.b1 = b1 + filter.b1Delta;
                filter.b2 = b2 + filter.b2Delta;
            }
            filter.output2 = output1;
            filter.output1 = sample;
            // Updating the input values is waste if the next filter doesn't exist...
            input2 = output2;
            input1 = output1;
        }
        return sample;
    }

    public computeTicksSinceStart(ofBar: boolean = false) {
        const beatsPerBar = this.song?.beatsPerBar ? this.song?.beatsPerBar : 8;
        if (ofBar) {
            return Config.ticksPerPart * Config.partsPerBeat * beatsPerBar * this.bar;
        } else {
            return this.tick + Config.ticksPerPart * (this.part + Config.partsPerBeat * (this.beat + beatsPerBar * this.bar));
        }
    }
}
registerProcessor('synth-processor', SynthProcessor);


// https://github.com/microsoft/TypeScript/issues/28308#issuecomment-650802278
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
    new(options?: AudioWorkletNodeOptions): AudioWorkletProcessor;
};

declare function registerProcessor(
    name: string,
    processorCtor: (new (
        options?: AudioWorkletNodeOptions
    ) => AudioWorkletProcessor) & {
        parameterDescriptors?: AudioParamDescriptor[];
    }
): void;

interface AudioParamDescriptor {
    name: string;
    defaultValue?: number;
    minValue?: number;
    maxValue?: number;
    automationRate?: "a-rate" | "k-rate";
}