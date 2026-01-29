// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { startLoadingSample, sampleLoadingState, SampleLoadingState, sampleLoadEvents, SampleLoadedEvent, SampleLoadingStatus, loadBuiltInSamples, Dictionary, DictionaryArray, toNameMap, FilterType, SustainType, EnvelopeType, InstrumentType, EffectType, Transition, Unison, Chord, Vibrato, Envelope, AutomationTarget, Config, effectsIncludeTransition, effectsIncludeChord, effectsIncludePitchShift, effectsIncludeDetune, effectsIncludeVibrato, effectsIncludeNoteFilter, effectsIncludeDistortion, effectsIncludeBitcrusher, effectsIncludePanning, effectsIncludeChorus, effectsIncludeEcho, effectsIncludeReverb, /*effectsIncludeNoteRange,*/ effectsIncludeRingModulation, effectsIncludeGranular, LFOEnvelopeTypes, RandomEnvelopeTypes, effectsIncludePlugin, effectsIncludeNoteRange } from "./SynthConfig";
import { Preset, EditorConfig } from "../editor/EditorConfig";
import { PluginConfig } from "../editor/PluginConfig";
import { FilterCoefficients, FrequencyResponse } from "./filtering";
import { MessageFlag, Message, PlayMessage, LoadSongMessage, ResetEffectsMessage, ComputeModsMessage, SetPrevBarMessage, SongPositionMessage, SendSharedArrayBuffers, SongSettings, InstrumentSettings, ChannelSettings, UpdateSongMessage, IsRecordingMessage, PluginMessage, SampleStartMessage, SampleFinishMessage } from "./synthMessages";
import { RingBuffer } from "ringbuf.js";
import { Synth } from "./synth";
import { events } from "../global/Events";


declare global {
    interface Window {
        AudioContext: any;
        webkitAudioContext: any;
    }
}

// For performance debugging:
//let samplesAccumulated: number = 0;
//let samplePerformance: number = 0;

export function clamp(min: number, max: number, val: number): number {
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

export function parseFloatWithDefault<T>(s: string, defaultValue: T): number | T {
    let result: number | T = parseFloat(s);
    if (Number.isNaN(result)) result = defaultValue;
    return result;
}

export function parseIntWithDefault<T>(s: string, defaultValue: T): number | T {
    let result: number | T = parseInt(s);
    if (Number.isNaN(result)) result = defaultValue;
    return result;
}

function encode32BitNumber(buffer: number[], x: number): void {
    // 0b11_
    buffer.push(base64IntToCharCode[(x >>> (6 * 5)) & 0x3]);
    //      111111_
    buffer.push(base64IntToCharCode[(x >>> (6 * 4)) & 0x3f]);
    //             111111_
    buffer.push(base64IntToCharCode[(x >>> (6 * 3)) & 0x3f]);
    //                    111111_
    buffer.push(base64IntToCharCode[(x >>> (6 * 2)) & 0x3f]);
    //                           111111_
    buffer.push(base64IntToCharCode[(x >>> (6 * 1)) & 0x3f]);
    //                                  111111
    buffer.push(base64IntToCharCode[(x >>> (6 * 0)) & 0x3f]);
}

// @TODO: This is error-prone, because the caller has to remember to increment
// charIndex by 6 afterwards.
function decode32BitNumber(compressed: string, charIndex: number): number {
    let x: number = 0;
    // 0b11_
    x |= base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << (6 * 5);
    //      111111_
    x |= base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << (6 * 4);
    //             111111_
    x |= base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << (6 * 3);
    //                    111111_
    x |= base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << (6 * 2);
    //                           111111_
    x |= base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << (6 * 1);
    //                                  111111
    x |= base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << (6 * 0);
    return x;
}

function encodeUnisonSettings(buffer: number[], v: number, s: number, o: number, e: number, i: number, p: boolean, b: boolean): void {
    // TODO: make these sign bits more efficient (bundle them together)
    buffer.push(base64IntToCharCode[v]);

    // TODO: make these use bitshifts instead for consistency
    buffer.push(base64IntToCharCode[Number((s > 0))]);
    let cleanS = Math.round(Math.abs(s) * 1000);
    let cleanSDivided = Math.floor(cleanS / 63);
    buffer.push(base64IntToCharCode[cleanS % 63], base64IntToCharCode[cleanSDivided % 63], base64IntToCharCode[Math.floor(cleanSDivided / 63)]);

    buffer.push(base64IntToCharCode[Number((o > 0))]);
    let cleanO = Math.round(Math.abs(o) * 1000);
    let cleanODivided = Math.floor(cleanO / 63);
    buffer.push(base64IntToCharCode[cleanO % 63], base64IntToCharCode[cleanODivided % 63], base64IntToCharCode[Math.floor(cleanODivided / 63)]);

    buffer.push(base64IntToCharCode[Number((e > 0))]);
    let cleanE = Math.round(Math.abs(e) * 1000);
    buffer.push(base64IntToCharCode[cleanE % 63], base64IntToCharCode[Math.floor(cleanE / 63)]);

    buffer.push(base64IntToCharCode[Number((i > 0))]);
    let cleanI = Math.round(Math.abs(i) * 1000);
    buffer.push(base64IntToCharCode[cleanI % 63], base64IntToCharCode[Math.floor(cleanI / 63)]);

    let booleansPacked = +b;
    booleansPacked <<= 1;
    booleansPacked += +p;
    buffer.push(base64IntToCharCode[booleansPacked]);
}

function convertLegacyKeyToKeyAndOctave(rawKeyIndex: number): [number, number] {
    let key: number = clamp(0, Config.keys.length, rawKeyIndex);
    let octave: number = 0;
    // This conversion code depends on C through B being
    // available as keys, of course.
    if (rawKeyIndex === 12) {
        // { name: "C+", isWhiteKey: false, basePitch: 24 }
        key = 0;
        octave = 1;
    } else if (rawKeyIndex === 13) {
        // { name: "G- (actually F#-)", isWhiteKey: false, basePitch: 6 }
        key = 6;
        octave = -1;
    } else if (rawKeyIndex === 14) {
        // { name: "C-", isWhiteKey: true, basePitch: 0 }
        key = 0;
        octave = -1;
    } else if (rawKeyIndex === 15) {
        // { name: "oh no (F-)", isWhiteKey: true, basePitch: 5 }
        key = 5;
        octave = -1;
    }
    return [key, octave];
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
    A = 65,
    B = 66,
    C = 67,
    D = 68,
    E = 69,
    F = 70,
    G = 71,
    H = 72,
    I = 73,
    J = 74,
    K = 75,
    L = 76,
    M = 77,
    N = 78,
    O = 79,
    P = 80,
    Q = 81,
    R = 82,
    S = 83,
    T = 84,
    U = 85,
    V = 86,
    W = 87,
    X = 88,
    Y = 89,
    Z = 90,
    UNDERSCORE = 95,
    a = 97,
    b = 98,
    c = 99,
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
    beatCount = CharCode.a, // added in BeepBox URL version 2
    bars = CharCode.b, // added in BeepBox URL version 2
    songEq = CharCode.c, // added in BeepBox URL version 2 for vibrato, switched to song eq in Slarmoo's Box 1.3
    fadeInOut = CharCode.d, // added in BeepBox URL version 3 for transition, switched to fadeInOut in 9
    loopEnd = CharCode.e, // added in BeepBox URL version 2
    eqFilter = CharCode.f, // added in BeepBox URL version 3
    barCount = CharCode.g, // added in BeepBox URL version 3
    unison = CharCode.h, // added in BeepBox URL version 2
    instrumentCount = CharCode.i, // added in BeepBox URL version 3
    patternCount = CharCode.j, // added in BeepBox URL version 3
    key = CharCode.k, // added in BeepBox URL version 2
    loopStart = CharCode.l, // added in BeepBox URL version 2
    sequences = CharCode.m, // added in BeepBox URL version 5, switched to sequences in Slarmoo's Box 1.5
    channelCount = CharCode.n, // added in BeepBox URL version 6
    channelOctave = CharCode.o, // added in BeepBox URL version 3
    patterns = CharCode.p, // added in BeepBox URL version 2
    effects = CharCode.q, // added in BeepBox URL version 7
    rhythm = CharCode.r, // added in BeepBox URL version 2
    scale = CharCode.s, // added in BeepBox URL version 2
    tempo = CharCode.t, // added in BeepBox URL version 2
    preset = CharCode.u, // added in BeepBox URL version 7
    volume = CharCode.v, // added in BeepBox URL version 2
    wave = CharCode.w, // added in BeepBox URL version 2
    supersaw = CharCode.x, // added in BeepBox URL version 9 ([UB] was used for chip wave but is now DEPRECATED)
    loopControls = CharCode.y, // added in BeepBox URL version 7, DEPRECATED, [UB] repurposed for chip wave loop controls
    drumsetEnvelopes = CharCode.z, // added in BeepBox URL version 7 for filter envelopes, still used for drumset envelopes
    algorithm = CharCode.A, // added in BeepBox URL version 6
    feedbackAmplitude = CharCode.B, // added in BeepBox URL version 6
    chord = CharCode.C, // added in BeepBox URL version 7, DEPRECATED
    detune = CharCode.D, // added in JummBox URL version 3(?) for detune, DEPRECATED
    envelopes = CharCode.E, // added in BeepBox URL version 6 for FM operator envelopes, repurposed in 9 for general envelopes.
    feedbackType = CharCode.F, // added in BeepBox URL version 6
    arpeggioSpeed = CharCode.G, // added in JummBox URL version 3 for arpeggioSpeed, DEPRECATED
    harmonics = CharCode.H, // added in BeepBox URL version 7
    stringSustain = CharCode.I, // added in BeepBox URL version 9
    //	                    = CharCode.J,
    //	                    = CharCode.K,
    pan = CharCode.L, // added between 8 and 9, DEPRECATED
    customChipWave = CharCode.M, // added in JummBox URL version 1(?) for customChipWave
    songTitle = CharCode.N, // added in JummBox URL version 1(?) for songTitle
    limiterSettings = CharCode.O, // added in JummBox URL version 3(?) for limiterSettings
    operatorAmplitudes = CharCode.P, // added in BeepBox URL version 6
    operatorFrequencies = CharCode.Q, // added in BeepBox URL version 6
    operatorWaves = CharCode.R, // added in JummBox URL version 4 for operatorWaves
    spectrum = CharCode.S, // added in BeepBox URL version 7
    startInstrument = CharCode.T, // added in BeepBox URL version 6
    channelNames = CharCode.U, // added in JummBox URL version 4(?) for channelNames
    feedbackEnvelope = CharCode.V, // added in BeepBox URL version 6, DEPRECATED
    pulseWidth = CharCode.W, // added in BeepBox URL version 7
    aliases = CharCode.X, // added in JummBox URL version 4 for aliases, DEPRECATED, [UB] repurposed for PWM decimal offset (DEPRECATED as well)
    //                      = CharCode.Y, 
    //	                    = CharCode.Z,
    //	                    = CharCode.NUM_0,
    //	                    = CharCode.NUM_1,
    //	                    = CharCode.NUM_2,
    //	                    = CharCode.NUM_3,
    //	                    = CharCode.NUM_4,
    //	                    = CharCode.NUM_5,
    //	                    = CharCode.NUM_6,
    //	                    = CharCode.NUM_7,
    //	                    = CharCode.NUM_8,
    //	                    = CharCode.NUM_9,
    //	                    = CharCode.DASH,
    //	                    = CharCode.UNDERSCORE,

}

const base64IntToCharCode: ReadonlyArray<number> = [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 45, 95];
const base64CharCodeToInt: ReadonlyArray<number> = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 62, 62, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 0, 0, 0, 0, 0, 0, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 0, 0, 0, 0, 63, 0, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 0, 0, 0, 0, 0]; // 62 could be represented by either "-" or "." for historical reasons. New songs should use "-".

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
            this._bits.push(value & 0x1);
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
            const value: number = (this._bits[i] << 5) | (this._bits[i + 1] << 4) | (this._bits[i + 2] << 3) | (this._bits[i + 3] << 2) | (this._bits[i + 4] << 1) | this._bits[i + 5];
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
    size: number;
}

export function makeNotePin(interval: number, time: number, size: number): NotePin {
    return { interval: interval, time: time, size: size };
}

export class Note {
    public pitches: number[];
    public pins: NotePin[];
    public start: number;
    public end: number;
    public continuesLastPattern: boolean;

    public constructor(pitch: number, start: number, end: number, size: number, fadeout: boolean = false) {
        this.pitches = [pitch];
        this.pins = [makeNotePin(0, 0, size), makeNotePin(0, end - start, fadeout ? 0 : size)];
        this.start = start;
        this.end = end;
        this.continuesLastPattern = false;
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
            let loudestSize: number = 0;
            for (let pinIndex: number = 0; pinIndex < this.pins.length; pinIndex++) {
                const pin: NotePin = this.pins[pinIndex];
                if (loudestSize < pin.size) {
                    loudestSize = pin.size;
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
            newNote.pins.push(makeNotePin(pin.interval, pin.time, pin.size));
        }
        newNote.continuesLastPattern = this.continuesLastPattern;
        return newNote;
    }

    public getEndPinIndex(part: number): number {
        let endPinIndex: number;
        for (endPinIndex = 1; endPinIndex < this.pins.length - 1; endPinIndex++) {
            if (this.pins[endPinIndex].time + this.start > part) break;
        }
        return endPinIndex;
    }
}

export class Pattern {
    public notes: Note[] = [];
    public readonly instruments: number[] = [0];

    public cloneNotes(): Note[] {
        const result: Note[] = [];
        for (const note of this.notes) {
            result.push(note.clone());
        }
        return result;
    }

    public reset(): void {
        this.notes.length = 0;
        this.instruments[0] = 0;
        this.instruments.length = 1;
    }

    public toJsonObject(song: Song, channel: Channel, isModChannel: boolean): any {
        const noteArray: Object[] = [];
        for (const note of this.notes) {
            // Only one ins per pattern is enforced in mod channels.
            let instrument: Instrument = channel.instruments[this.instruments[0]];
            let mod: number = Math.max(0, Config.modCount - note.pitches[0] - 1);
            let volumeCap: number = song.getVolumeCapForSetting(isModChannel, instrument.modulators[mod], instrument.modFilterTypes[mod]);
            const pointArray: Object[] = [];
            for (const pin of note.pins) {
                let useVol: number = isModChannel ? Math.round(pin.size) : Math.round(pin.size * 100 / volumeCap);
                pointArray.push({
                    "tick": (pin.time + note.start) * Config.rhythms[song.rhythm].stepsPerBeat / Config.partsPerBeat,
                    "pitchBend": pin.interval,
                    "volume": useVol,
                    "forMod": isModChannel,
                });
            }

            const noteObject: any = {
                "pitches": note.pitches,
                "points": pointArray,
            };
            if (note.start == 0) {
                noteObject["continuesLastPattern"] = note.continuesLastPattern;
            }
            noteArray.push(noteObject);
        }

        const patternObject: any = { "notes": noteArray };
        if (song.patternInstruments) {
            patternObject["instruments"] = this.instruments.map(i => i + 1);
        }
        return patternObject;
    }

    public copyObject(patternObject: Pattern) {
        this.instruments.length = patternObject.instruments.length;
        for (let i: number = 0; i < patternObject.instruments.length; i++) {
            this.instruments[i] = patternObject.instruments[i];
        }
        this.notes.length = patternObject.notes.length;
        for (let i: number = 0; i < patternObject.notes.length; i++) {
            const oldNote = patternObject.notes[i]
            if (!(this.notes[i] instanceof Note)) this.notes[i] = new Note(0, 0, 0, 0)
            this.notes[i].pitches = oldNote.pitches;
            this.notes[i].start = oldNote.start;
            this.notes[i].end = oldNote.end;
            this.notes[i].pins = oldNote.pins;
            this.notes[i].continuesLastPattern = oldNote.continuesLastPattern;
        }
    }

    public fromJsonObject(patternObject: any, song: Song, channel: Channel, importedPartsPerBeat: number, isNoiseChannel: boolean, isModChannel: boolean, jsonFormat: string = "auto"): void {
        const format: string = jsonFormat.toLowerCase();

        if (song.patternInstruments) {
            if (Array.isArray(patternObject["instruments"])) {
                const instruments: any[] = patternObject["instruments"];
                const instrumentCount: number = clamp(Config.instrumentCountMin, song.getMaxInstrumentsPerPatternForChannel(channel) + 1, instruments.length);
                for (let j: number = 0; j < instrumentCount; j++) {
                    this.instruments[j] = clamp(0, channel.instruments.length, (instruments[j] | 0) - 1);
                }
                this.instruments.length = instrumentCount;
            } else {
                this.instruments[0] = clamp(0, channel.instruments.length, (patternObject["instrument"] | 0) - 1);
                this.instruments.length = 1;
            }
        }

        if (patternObject["notes"] && patternObject["notes"].length > 0) {
            const maxNoteCount: number = Math.min(song.beatsPerBar * Config.partsPerBeat * (isModChannel ? Config.modCount : 1), patternObject["notes"].length >>> 0);

            // TODO: Consider supporting notes specified in any timing order, sorting them and truncating as necessary.
            //let tickClock: number = 0;
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

                //let noteClock: number = tickClock;
                let startInterval: number = 0;

                let instrument: Instrument = channel.instruments[this.instruments[0]];
                let mod: number = Math.max(0, Config.modCount - note.pitches[0] - 1);

                for (let k: number = 0; k < noteObject["points"].length; k++) {
                    const pointObject: any = noteObject["points"][k];
                    if (pointObject == undefined || pointObject["tick"] == undefined) continue;
                    const interval: number = (pointObject["pitchBend"] == undefined) ? 0 : (pointObject["pitchBend"] | 0);

                    const time: number = Math.round((+pointObject["tick"]) * Config.partsPerBeat / importedPartsPerBeat);

                    // Only one instrument per pattern allowed in mod channels.
                    let volumeCap: number = song.getVolumeCapForSetting(isModChannel, instrument.modulators[mod], instrument.modFilterTypes[mod]);

                    // The strange volume formula used for notes is not needed for mods. Some rounding errors were possible.
                    // A "forMod" signifier was added to new JSON export to detect when the higher precision export was used in a file.
                    let size: number;
                    if (pointObject["volume"] == undefined) {
                        size = volumeCap;
                    } else if (pointObject["forMod"] == undefined) {
                        size = Math.max(0, Math.min(volumeCap, Math.round((pointObject["volume"] | 0) * volumeCap / 100)));
                    }
                    else {
                        size = ((pointObject["forMod"] | 0) > 0) ? Math.round(pointObject["volume"] | 0) : Math.max(0, Math.min(volumeCap, Math.round((pointObject["volume"] | 0) * volumeCap / 100)));
                    }

                    if (time > song.beatsPerBar * Config.partsPerBeat) continue;
                    if (note.pins.length == 0) {
                        //if (time < noteClock) continue;
                        note.start = time;
                        startInterval = interval;
                    } else {
                        //if (time <= noteClock) continue;
                    }
                    //noteClock = time;

                    note.pins.push(makeNotePin(interval - startInterval, time - note.start, size));
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
                        if (pin.interval == note.pins[k - 1].interval &&
                            pin.interval == note.pins[k - 2].interval &&
                            pin.size == note.pins[k - 1].size &&
                            pin.size == note.pins[k - 2].size) {
                            note.pins.splice(k - 1, 1);
                            k--;
                        }
                    }
                }

                if (note.start == 0) {
                    note.continuesLastPattern = (noteObject["continuesLastPattern"] === true);
                } else {
                    note.continuesLastPattern = false;
                }

                if ((format != "ultrabox" && format != "slarmoosbox") && instrument.modulators[mod] == Config.modulators.dictionary["tempo"].index) {
                    for (const pin of note.pins) {
                        const oldMin: number = 30;
                        const newMin: number = 1;
                        const old: number = pin.size + oldMin;
                        pin.size = old - newMin; // convertRealFactor will add back newMin as necessary
                    }
                }

                this.notes.push(note);
            }
        }
    }
}

export class Operator {
    public frequency: number = 4;
    public amplitude: number = 0;
    public waveform: number = 0;
    public pulseWidth: number = 0.5;

    constructor(index: number) {
        this.reset(index);
    }

    public reset(index: number): void {
        this.frequency = 4; //defualt to 1x
        this.amplitude = (index <= 1) ? Config.operatorAmplitudeMax : 0;
        this.waveform = 0;
        this.pulseWidth = 5;
    }

    public copy(other: Operator): void {
        this.frequency = other.frequency;
        this.amplitude = other.amplitude;
        this.waveform = other.waveform;
        this.pulseWidth = other.pulseWidth;
    }
}

export class CustomAlgorithm {
    public name: string = "";
    public carrierCount: number = 0;
    public modulatedBy: number[][] = [[], [], [], [], [], []];
    public associatedCarrier: number[] = [];

    constructor() {
        this.fromPreset(1);
    }

    public set(carriers: number, modulation: number[][]) {
        this.reset();
        this.carrierCount = carriers;
        for (let i = 0; i < this.modulatedBy.length; i++) {
            this.modulatedBy[i] = modulation[i];
            if (i < carriers) {
                this.associatedCarrier[i] = i + 1;
            }
            this.name += (i + 1);
            for (let j = 0; j < modulation[i].length; j++) {
                this.name += modulation[i][j];
                if (modulation[i][j] > carriers - 1) {
                    this.associatedCarrier[modulation[i][j] - 1] = i + 1;
                }
                this.name += ",";
            }
            if (i < carriers) {
                this.name += "|";
            } else {
                this.name += ".";
            }
        }
    }

    public reset(): void {
        this.name = ""
        this.carrierCount = 1;
        this.modulatedBy = [[2, 3, 4, 5, 6], [], [], [], [], []];
        this.associatedCarrier = [1, 1, 1, 1, 1, 1];
    }

    public copy(other: CustomAlgorithm): void {
        this.name = other.name;
        this.carrierCount = other.carrierCount;
        this.modulatedBy = other.modulatedBy;
        this.associatedCarrier = other.associatedCarrier;
    }

    public fromPreset(other: number): void {
        this.reset();
        let preset = Config.algorithms6Op[other]
        this.name = preset.name;
        this.carrierCount = preset.carrierCount;
        for (var i = 0; i < preset.modulatedBy.length; i++) {
            this.modulatedBy[i] = Array.from(preset.modulatedBy[i]);
            this.associatedCarrier[i] = preset.associatedCarrier[i];
        }
    }
}

export class CustomFeedBack { //feels redunant
    public name: string = "";
    public indices: number[][] = [[], [], [], [], [], []];

    constructor() {
        this.fromPreset(1);
    }

    public set(inIndices: number[][]) {
        this.reset();
        for (let i = 0; i < this.indices.length; i++) {
            this.indices[i] = inIndices[i];
            for (let j = 0; j < inIndices[i].length; j++) {
                this.name += inIndices[i][j];
                this.name += ",";
            }
            this.name += ".";
        }
    }

    public reset(): void {
        this.reset;
        this.name = "";
        this.indices = [[1], [], [], [], [], []];
    }

    public copy(other: CustomFeedBack): void {
        this.name = other.name;
        this.indices = other.indices;
    }

    public fromPreset(other: number): void {
        this.reset();
        let preset = Config.feedbacks6Op[other]
        for (var i = 0; i < preset.indices.length; i++) {
            this.indices[i] = Array.from(preset.indices[i]);
            for (let j = 0; j < preset.indices[i].length; j++) {
                this.name += preset.indices[i][j];
                this.name += ",";
            }
            this.name += ".";
        }
    }
}

export class SpectrumWave {
    public spectrum: number[] = [];
    public hash: number = -1;

    constructor(isNoiseChannel: boolean) {
        this.reset(isNoiseChannel);
    }

    public reset(isNoiseChannel: boolean): void {
        for (let i: number = 0; i < Config.spectrumControlPoints; i++) {
            if (isNoiseChannel) {
                this.spectrum[i] = Math.round(Config.spectrumMax * (1 / Math.sqrt(1 + i / 3)));
            } else {
                const isHarmonic: boolean = i == 0 || i == 7 || i == 11 || i == 14 || i == 16 || i == 18 || i == 21 || i == 23 || i >= 25;
                this.spectrum[i] = isHarmonic ? Math.max(0, Math.round(Config.spectrumMax * (1 - i / 30))) : 0;
            }
        }
        this.markCustomWaveDirty();
    }

    public markCustomWaveDirty(): void {
        const hashMult: number = SynthMessenger.fittingPowerOfTwo(Config.spectrumMax + 2) - 1;
        let hash: number = 0;
        for (const point of this.spectrum) hash = ((hash * hashMult) + point) >>> 0;
        this.hash = hash;
    }
}

export class HarmonicsWave {
    public harmonics: number[] = [];
    public hash: number = -1;

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
        this.markCustomWaveDirty();
    }

    public markCustomWaveDirty(): void {
        const hashMult: number = SynthMessenger.fittingPowerOfTwo(Config.harmonicsMax + 2) - 1;
        let hash: number = 0;
        for (const point of this.harmonics) hash = ((hash * hashMult) + point) >>> 0;
        this.hash = hash;
    }
}

export class FilterControlPoint {
    public freq: number = 0;
    public gain: number = Config.filterGainCenter;
    public type: FilterType = FilterType.peak;

    public set(freqSetting: number, gainSetting: number): void {
        this.freq = freqSetting;
        this.gain = gainSetting;
    }

    public getHz(): number {
        return FilterControlPoint.getHzFromSettingValue(this.freq);
    }

    public static getHzFromSettingValue(value: number): number {
        return Config.filterFreqReferenceHz * Math.pow(2.0, (value - Config.filterFreqReferenceSetting) * Config.filterFreqStep);
    }
    public static getSettingValueFromHz(hz: number): number {
        return Math.log2(hz / Config.filterFreqReferenceHz) / Config.filterFreqStep + Config.filterFreqReferenceSetting;
    }
    public static getRoundedSettingValueFromHz(hz: number): number {
        return Math.max(0, Math.min(Config.filterFreqRange - 1, Math.round(FilterControlPoint.getSettingValueFromHz(hz))));
    }

    public getLinearGain(peakMult: number = 1.0): number {
        const power: number = (this.gain - Config.filterGainCenter) * Config.filterGainStep;
        const neutral: number = (this.type == FilterType.peak) ? 0.0 : -0.5;
        const interpolatedPower: number = neutral + (power - neutral) * peakMult;
        return Math.pow(2.0, interpolatedPower);
    }
    public static getRoundedSettingValueFromLinearGain(linearGain: number): number {
        return Math.max(0, Math.min(Config.filterGainRange - 1, Math.round(Math.log2(linearGain) / Config.filterGainStep + Config.filterGainCenter)));
    }

    public toCoefficients(filter: FilterCoefficients, sampleRate: number, freqMult: number = 1.0, peakMult: number = 1.0): void {
        const cornerRadiansPerSample: number = 2.0 * Math.PI * Math.max(Config.filterFreqMinHz, Math.min(Config.filterFreqMaxHz, freqMult * this.getHz())) / sampleRate;
        const linearGain: number = this.getLinearGain(peakMult);
        switch (this.type) {
            case FilterType.lowPass:
                filter.lowPass2ndOrderButterworth(cornerRadiansPerSample, linearGain);
                break;
            case FilterType.highPass:
                filter.highPass2ndOrderButterworth(cornerRadiansPerSample, linearGain);
                break;
            case FilterType.peak:
                filter.peak2ndOrder(cornerRadiansPerSample, linearGain, 1.0);
                break;
            default:
                throw new Error();
        }
    }

    public getVolumeCompensationMult(): number {
        const octave: number = (this.freq - Config.filterFreqReferenceSetting) * Config.filterFreqStep;
        const gainPow: number = (this.gain - Config.filterGainCenter) * Config.filterGainStep;
        switch (this.type) {
            case FilterType.lowPass:
                const freqRelativeTo8khz: number = Math.pow(2.0, octave) * Config.filterFreqReferenceHz / 8000.0;
                // Reverse the frequency warping from importing legacy simplified filters to imitate how the legacy filter cutoff setting affected volume.
                const warpedFreq: number = (Math.sqrt(1.0 + 4.0 * freqRelativeTo8khz) - 1.0) / 2.0;
                const warpedOctave: number = Math.log2(warpedFreq);
                return Math.pow(0.5, 0.2 * Math.max(0.0, gainPow + 1.0) + Math.min(0.0, Math.max(-3.0, 0.595 * warpedOctave + 0.35 * Math.min(0.0, gainPow + 1.0))));
            case FilterType.highPass:
                return Math.pow(0.5, 0.125 * Math.max(0.0, gainPow + 1.0) + Math.min(0.0, 0.3 * (-octave - Math.log2(Config.filterFreqReferenceHz / 125.0)) + 0.2 * Math.min(0.0, gainPow + 1.0)));
            case FilterType.peak:
                const distanceFromCenter: number = octave + Math.log2(Config.filterFreqReferenceHz / 2000.0);
                const freqLoudness: number = Math.pow(1.0 / (1.0 + Math.pow(distanceFromCenter / 3.0, 2.0)), 2.0);
                return Math.pow(0.5, 0.125 * Math.max(0.0, gainPow) + 0.1 * freqLoudness * Math.min(0.0, gainPow));
            default:
                throw new Error();
        }
    }
}

export class FilterSettings {
    public readonly controlPoints: FilterControlPoint[] = [];
    public controlPointCount: number = 0;

    constructor() {
        this.reset();
    }

    reset(): void {
        this.controlPointCount = 0;
    }

    addPoint(type: FilterType, freqSetting: number, gainSetting: number): void {
        let controlPoint: FilterControlPoint;
        if (this.controlPoints.length <= this.controlPointCount) {
            controlPoint = new FilterControlPoint();
            this.controlPoints[this.controlPointCount] = controlPoint;
        } else {
            controlPoint = this.controlPoints[this.controlPointCount];
        }
        this.controlPointCount++;
        controlPoint.type = type;
        controlPoint.set(freqSetting, gainSetting);
    }

    public toJsonObject(): Object {
        const filterArray: any[] = [];
        for (let i: number = 0; i < this.controlPointCount; i++) {
            const point: FilterControlPoint = this.controlPoints[i];
            filterArray.push({
                "type": Config.filterTypeNames[point.type],
                "cutoffHz": Math.round(point.getHz() * 100) / 100,
                "linearGain": Math.round(point.getLinearGain() * 10000) / 10000,
            });
        }
        return filterArray;
    }

    public fromJsonObject(filterObject: any): void {
        this.controlPoints.length = 0;
        if (filterObject) {
            for (const pointObject of filterObject) {
                const point: FilterControlPoint = new FilterControlPoint();
                point.type = Config.filterTypeNames.indexOf(pointObject["type"]);
                if (<any>point.type == -1) point.type = FilterType.peak;
                if (pointObject["cutoffHz"] != undefined) {
                    point.freq = FilterControlPoint.getRoundedSettingValueFromHz(pointObject["cutoffHz"]);
                } else {
                    point.freq = 0;
                }
                if (pointObject["linearGain"] != undefined) {
                    point.gain = FilterControlPoint.getRoundedSettingValueFromLinearGain(pointObject["linearGain"]);
                } else {
                    point.gain = Config.filterGainCenter;
                }
                this.controlPoints.push(point);
            }
        }
        this.controlPointCount = this.controlPoints.length;
    }

    // Returns true if all filter control points match in number and type (but not freq/gain)
    public static filtersCanMorph(filterA: FilterSettings, filterB: FilterSettings): boolean {
        if (filterA.controlPointCount != filterB.controlPointCount)
            return false;
        for (let i: number = 0; i < filterA.controlPointCount; i++) {
            if (filterA.controlPoints[i].type != filterB.controlPoints[i].type)
                return false;
        }
        return true;
    }

    // Interpolate two FilterSettings, where pos=0 is filterA and pos=1 is filterB
    public static lerpFilters(filterA: FilterSettings, filterB: FilterSettings, pos: number): FilterSettings {

        let lerpedFilter: FilterSettings = new FilterSettings();

        // One setting or another is null, return the other.
        if (filterA == null) {
            return filterA;
        }
        if (filterB == null) {
            return filterB;
        }

        pos = Math.max(0, Math.min(1, pos));

        // Filter control points match in number and type
        if (this.filtersCanMorph(filterA, filterB)) {
            for (let i: number = 0; i < filterA.controlPointCount; i++) {
                lerpedFilter.controlPoints[i] = new FilterControlPoint();
                lerpedFilter.controlPoints[i].type = filterA.controlPoints[i].type;
                lerpedFilter.controlPoints[i].freq = filterA.controlPoints[i].freq + (filterB.controlPoints[i].freq - filterA.controlPoints[i].freq) * pos;
                lerpedFilter.controlPoints[i].gain = filterA.controlPoints[i].gain + (filterB.controlPoints[i].gain - filterA.controlPoints[i].gain) * pos;
            }

            lerpedFilter.controlPointCount = filterA.controlPointCount;

            return lerpedFilter;
        }
        else {
            // Not allowing morph of unmatching filters for now. It's a hornet's nest of problems, and I had it implemented and mostly working and it didn't sound very interesting since the shape becomes "mushy" in between
            return (pos >= 1) ? filterB : filterA;
        }
    }

    public convertLegacySettings(legacyCutoffSetting: number, legacyResonanceSetting: number, legacyEnv: Envelope): void {
        this.reset();

        const legacyFilterCutoffMaxHz: number = 8000; // This was carefully calculated to correspond to no change in response when filtering at 48000 samples per second... when using the legacy simplified low-pass filter.
        const legacyFilterMax: number = 0.95;
        const legacyFilterMaxRadians: number = Math.asin(legacyFilterMax / 2.0) * 2.0;
        const legacyFilterMaxResonance: number = 0.95;
        const legacyFilterCutoffRange: number = 11;
        const legacyFilterResonanceRange: number = 8;

        const resonant: boolean = (legacyResonanceSetting > 1);
        const firstOrder: boolean = (legacyResonanceSetting == 0);
        const cutoffAtMax: boolean = (legacyCutoffSetting == legacyFilterCutoffRange - 1);
        const envDecays: boolean = (legacyEnv.type == EnvelopeType.flare || legacyEnv.type == EnvelopeType.twang || legacyEnv.type == EnvelopeType.decay || legacyEnv.type == EnvelopeType.noteSize);

        const standardSampleRate: number = 48000;
        const legacyHz: number = legacyFilterCutoffMaxHz * Math.pow(2.0, (legacyCutoffSetting - (legacyFilterCutoffRange - 1)) * 0.5);
        const legacyRadians: number = Math.min(legacyFilterMaxRadians, 2 * Math.PI * legacyHz / standardSampleRate);

        if (legacyEnv.type == EnvelopeType.none && !resonant && cutoffAtMax) {
            // The response is flat and there's no envelopes, so don't even bother adding any control points.
        } else if (firstOrder) {
            // In general, a 1st order lowpass can be approximated by a 2nd order lowpass
            // with a cutoff ~4 octaves higher (*16) and a gain of 1/16.
            // However, BeepBox's original lowpass filters behaved oddly as they
            // approach the nyquist frequency, so I've devised this curved conversion
            // to guess at a perceptually appropriate new cutoff frequency and gain.
            const extraOctaves: number = 3.5;
            const targetRadians: number = legacyRadians * Math.pow(2.0, extraOctaves);
            const curvedRadians: number = targetRadians / (1.0 + targetRadians / Math.PI);
            const curvedHz: number = standardSampleRate * curvedRadians / (2.0 * Math.PI)
            const freqSetting: number = FilterControlPoint.getRoundedSettingValueFromHz(curvedHz);
            const finalHz: number = FilterControlPoint.getHzFromSettingValue(freqSetting);
            const finalRadians: number = 2.0 * Math.PI * finalHz / standardSampleRate;

            const legacyFilter: FilterCoefficients = new FilterCoefficients();
            legacyFilter.lowPass1stOrderSimplified(legacyRadians);
            const response: FrequencyResponse = new FrequencyResponse();
            response.analyze(legacyFilter, finalRadians);
            const legacyFilterGainAtNewRadians: number = response.magnitude();

            let logGain: number = Math.log2(legacyFilterGainAtNewRadians);
            // Bias slightly toward 2^(-extraOctaves):
            logGain = -extraOctaves + (logGain + extraOctaves) * 0.82;
            // Decaying envelopes move the cutoff frequency back into an area where the best approximation of the first order slope requires a lower gain setting.
            if (envDecays) logGain = Math.min(logGain, -1.0);
            const convertedGain: number = Math.pow(2.0, logGain);
            const gainSetting: number = FilterControlPoint.getRoundedSettingValueFromLinearGain(convertedGain);

            this.addPoint(FilterType.lowPass, freqSetting, gainSetting);
        } else {
            const intendedGain: number = 0.5 / (1.0 - legacyFilterMaxResonance * Math.sqrt(Math.max(0.0, legacyResonanceSetting - 1.0) / (legacyFilterResonanceRange - 2.0)));
            const invertedGain: number = 0.5 / intendedGain;
            const maxRadians: number = 2.0 * Math.PI * legacyFilterCutoffMaxHz / standardSampleRate;
            const freqRatio: number = legacyRadians / maxRadians;
            const targetRadians: number = legacyRadians * (freqRatio * Math.pow(invertedGain, 0.9) + 1.0);
            const curvedRadians: number = legacyRadians + (targetRadians - legacyRadians) * invertedGain;
            let curvedHz: number;
            if (envDecays) {
                curvedHz = standardSampleRate * Math.min(curvedRadians, legacyRadians * Math.pow(2, 0.25)) / (2.0 * Math.PI);
            } else {
                curvedHz = standardSampleRate * curvedRadians / (2.0 * Math.PI);
            }
            const freqSetting: number = FilterControlPoint.getRoundedSettingValueFromHz(curvedHz);

            let legacyFilterGain: number;
            if (envDecays) {
                legacyFilterGain = intendedGain;
            } else {
                const legacyFilter: FilterCoefficients = new FilterCoefficients();
                legacyFilter.lowPass2ndOrderSimplified(legacyRadians, intendedGain);
                const response: FrequencyResponse = new FrequencyResponse();
                response.analyze(legacyFilter, curvedRadians);
                legacyFilterGain = response.magnitude();
            }
            if (!resonant) legacyFilterGain = Math.min(legacyFilterGain, Math.sqrt(0.5));
            const gainSetting: number = FilterControlPoint.getRoundedSettingValueFromLinearGain(legacyFilterGain);

            this.addPoint(FilterType.lowPass, freqSetting, gainSetting);
        }

        // Added for JummBox - making a 0 point filter does not truncate control points!
        this.controlPoints.length = this.controlPointCount;
    }

    // Similar to above, but purpose-fit for quick conversions in synth calls.
    public convertLegacySettingsForSynth(legacyCutoffSetting: number, legacyResonanceSetting: number, allowFirstOrder: boolean = false): void {
        this.reset();

        const legacyFilterCutoffMaxHz: number = 8000; // This was carefully calculated to correspond to no change in response when filtering at 48000 samples per second... when using the legacy simplified low-pass filter.
        const legacyFilterMax: number = 0.95;
        const legacyFilterMaxRadians: number = Math.asin(legacyFilterMax / 2.0) * 2.0;
        const legacyFilterMaxResonance: number = 0.95;
        const legacyFilterCutoffRange: number = 11;
        const legacyFilterResonanceRange: number = 8;

        const firstOrder: boolean = (legacyResonanceSetting == 0 && allowFirstOrder);
        const standardSampleRate: number = 48000;
        const legacyHz: number = legacyFilterCutoffMaxHz * Math.pow(2.0, (legacyCutoffSetting - (legacyFilterCutoffRange - 1)) * 0.5);
        const legacyRadians: number = Math.min(legacyFilterMaxRadians, 2 * Math.PI * legacyHz / standardSampleRate);

        if (firstOrder) {
            // In general, a 1st order lowpass can be approximated by a 2nd order lowpass
            // with a cutoff ~4 octaves higher (*16) and a gain of 1/16.
            // However, BeepBox's original lowpass filters behaved oddly as they
            // approach the nyquist frequency, so I've devised this curved conversion
            // to guess at a perceptually appropriate new cutoff frequency and gain.
            const extraOctaves: number = 3.5;
            const targetRadians: number = legacyRadians * Math.pow(2.0, extraOctaves);
            const curvedRadians: number = targetRadians / (1.0 + targetRadians / Math.PI);
            const curvedHz: number = standardSampleRate * curvedRadians / (2.0 * Math.PI)
            const freqSetting: number = FilterControlPoint.getRoundedSettingValueFromHz(curvedHz);
            const finalHz: number = FilterControlPoint.getHzFromSettingValue(freqSetting);
            const finalRadians: number = 2.0 * Math.PI * finalHz / standardSampleRate;

            const legacyFilter: FilterCoefficients = new FilterCoefficients();
            legacyFilter.lowPass1stOrderSimplified(legacyRadians);
            const response: FrequencyResponse = new FrequencyResponse();
            response.analyze(legacyFilter, finalRadians);
            const legacyFilterGainAtNewRadians: number = response.magnitude();

            let logGain: number = Math.log2(legacyFilterGainAtNewRadians);
            // Bias slightly toward 2^(-extraOctaves):
            logGain = -extraOctaves + (logGain + extraOctaves) * 0.82;
            const convertedGain: number = Math.pow(2.0, logGain);
            const gainSetting: number = FilterControlPoint.getRoundedSettingValueFromLinearGain(convertedGain);

            this.addPoint(FilterType.lowPass, freqSetting, gainSetting);
        } else {
            const intendedGain: number = 0.5 / (1.0 - legacyFilterMaxResonance * Math.sqrt(Math.max(0.0, legacyResonanceSetting - 1.0) / (legacyFilterResonanceRange - 2.0)));
            const invertedGain: number = 0.5 / intendedGain;
            const maxRadians: number = 2.0 * Math.PI * legacyFilterCutoffMaxHz / standardSampleRate;
            const freqRatio: number = legacyRadians / maxRadians;
            const targetRadians: number = legacyRadians * (freqRatio * Math.pow(invertedGain, 0.9) + 1.0);
            const curvedRadians: number = legacyRadians + (targetRadians - legacyRadians) * invertedGain;
            let curvedHz: number;

            curvedHz = standardSampleRate * curvedRadians / (2.0 * Math.PI);
            const freqSetting: number = FilterControlPoint.getSettingValueFromHz(curvedHz);

            let legacyFilterGain: number;

            const legacyFilter: FilterCoefficients = new FilterCoefficients();
            legacyFilter.lowPass2ndOrderSimplified(legacyRadians, intendedGain);
            const response: FrequencyResponse = new FrequencyResponse();
            response.analyze(legacyFilter, curvedRadians);
            legacyFilterGain = response.magnitude();
            const gainSetting: number = FilterControlPoint.getRoundedSettingValueFromLinearGain(legacyFilterGain);

            this.addPoint(FilterType.lowPass, freqSetting, gainSetting);
        }

    }
}

export class SequenceSettings {
    //sequence dimensions
    public height: number = 4;
    public length: number = 4;
    //the value for each index of the sequence. If an index is blank interpret as a 0
    public values: number[] = [1, 4, 1, 2]

    constructor() {
        this.reset();
    }

    reset() {
        this.height = 4;
        this.length = 4;
        this.values = [0, 3, 1, 2];
    }

    public toJsonObject(): Object {
        const sequenceObject: any = {
            "height": this.height,
            "length": this.length,
            "values": this.values
        };
        return sequenceObject;
    }

    public fromJsonObject(sequenceObject: any, format: string): void {
        this.reset();

        if (sequenceObject["height"] != undefined) {
            this.height = sequenceObject["height"]
        }

        if (sequenceObject["length"] != undefined) {
            this.length = sequenceObject["length"]
        }

        if (sequenceObject["values"] != undefined) {
            this.values = sequenceObject["values"]
        }
    }

    public copy(): SequenceSettings {
        const copy = new SequenceSettings();
        copy.height = this.height;
        copy.length = this.length;
        copy.values = this.values.slice();
        return copy;
    }

    public isSame(other: SequenceSettings): boolean {
        let sameCheck = true;
        if (this.height != other.height) sameCheck = false;
        else if (this.length != other.length) sameCheck = false;
        else {
            for (var i = 0; i < this.length; i++) {
                if (other.values[i] != this.values[i]) {
                    sameCheck = false; break;
                }
            }
        }
        return sameCheck;
    }
}

export class EnvelopeSettings {
    public target: number = 0;
    public index: number = 0;
    public envelope: number = 0;
    //slarmoo's box 1.0
    public pitchEnvelopeStart: number;
    public pitchEnvelopeEnd: number;
    public inverse: boolean;
    //midbox
    public perEnvelopeSpeed: number = Config.envelopePresets[this.envelope].speed;
    public perEnvelopeLowerBound: number = 0;
    public perEnvelopeUpperBound: number = 1;
    //modulation support
    public tempEnvelopeSpeed: number | null = null;
    public tempEnvelopeLowerBound: number | null = null;
    public tempEnvelopeUpperBound: number | null = null;
    //pseudo random
    public steps: number = 2;
    public seed: number = 2;
    //lfo and random types. Also denotes which sequence to look at
    public waveform: number = LFOEnvelopeTypes.sine;
    //moved discrete into here
    public discrete: boolean = false;

    constructor(public isNoiseEnvelope: boolean) {
        this.reset();
    }

    reset(): void {
        this.target = 0;
        this.index = 0;
        this.envelope = 0;
        this.pitchEnvelopeStart = 0;
        this.pitchEnvelopeEnd = this.isNoiseEnvelope ? Config.drumCount - 1 : Config.maxPitch;
        this.inverse = false;
        this.isNoiseEnvelope = false;
        this.perEnvelopeSpeed = Config.envelopePresets[this.envelope].speed;
        this.perEnvelopeLowerBound = 0;
        this.perEnvelopeUpperBound = 1;
        this.tempEnvelopeSpeed = null;
        this.tempEnvelopeLowerBound = null;
        this.tempEnvelopeUpperBound = null;
        this.steps = 2;
        this.seed = 2;
        this.waveform = LFOEnvelopeTypes.sine;
        this.discrete = false;
    }

    public toJsonObject(): Object {
        const envelopeObject: any = {
            "target": Config.instrumentAutomationTargets[this.target].name,
            "envelope": Config.envelopes[this.envelope].name,
            "inverse": this.inverse,
            "perEnvelopeSpeed": this.perEnvelopeSpeed,
            "perEnvelopeLowerBound": this.perEnvelopeLowerBound,
            "perEnvelopeUpperBound": this.perEnvelopeUpperBound,
            "discrete": this.discrete,
        };
        if (Config.instrumentAutomationTargets[this.target].maxCount > 1) {
            envelopeObject["index"] = this.index;
        }
        if (Config.envelopes[this.envelope].name == "pitch") {
            envelopeObject["pitchEnvelopeStart"] = this.pitchEnvelopeStart;
            envelopeObject["pitchEnvelopeEnd"] = this.pitchEnvelopeEnd;
        } else if (Config.envelopes[this.envelope].name == "random") {
            envelopeObject["steps"] = this.steps;
            envelopeObject["seed"] = this.seed;
            envelopeObject["waveform"] = this.waveform;
        } else if (Config.envelopes[this.envelope].name == "lfo") {
            envelopeObject["waveform"] = this.waveform;
            envelopeObject["steps"] = this.steps;
        }
        return envelopeObject;
    }

    public fromJsonObject(envelopeObject: any, format: string): void {
        this.reset();

        let target: AutomationTarget = Config.instrumentAutomationTargets.dictionary[envelopeObject["target"]];
        if (target == null) target = Config.instrumentAutomationTargets.dictionary["noteVolume"];
        this.target = target.index;

        let envelope: Envelope = Config.envelopePresets.dictionary["none"];
        let isTremolo2: Boolean = false;
        if (format == "slarmoosbox") {
            if (envelopeObject["envelope"] == "tremolo2") {
                envelope = Config.envelopes[EnvelopeType.lfo];
                isTremolo2 = true;
            } else if (envelopeObject["envelope"] == "tremolo") {
                envelope = Config.envelopes[EnvelopeType.lfo];
                isTremolo2 = false;
            } else {
                envelope = Config.envelopes.dictionary[envelopeObject["envelope"]];
            }
        } else {
            if (Config.envelopePresets.dictionary[envelopeObject["envelope"]].type == EnvelopeType.tremolo2) {
                envelope = Config.envelopes[EnvelopeType.lfo];
                isTremolo2 = true;
            } else if (Config.envelopes[Math.max(Config.envelopePresets.dictionary[envelopeObject["envelope"]].type - 1, 0)].index > EnvelopeType.lfo) {
                envelope = Config.envelopes[Config.envelopePresets.dictionary[envelopeObject["envelope"]].type - 1];
            } else {
                envelope = Config.envelopes[Config.envelopePresets.dictionary[envelopeObject["envelope"]].type];
            }
        }

        if (envelope == undefined) {
            if (Config.envelopePresets.dictionary[envelopeObject["envelope"]].type == EnvelopeType.tremolo2) {
                envelope = Config.envelopes[EnvelopeType.lfo];
                isTremolo2 = true;
            } else if (Config.envelopes[Math.max(Config.envelopePresets.dictionary[envelopeObject["envelope"]].type - 1, 0)].index > EnvelopeType.lfo) {
                envelope = Config.envelopes[Config.envelopePresets.dictionary[envelopeObject["envelope"]].type - 1];
            } else {
                envelope = Config.envelopes[Config.envelopePresets.dictionary[envelopeObject["envelope"]].type];
            }
        }
        if (envelope == null) envelope = Config.envelopePresets.dictionary["none"];
        this.envelope = envelope.index;

        if (envelopeObject["index"] != undefined) {
            this.index = clamp(0, Config.instrumentAutomationTargets[this.target].maxCount, envelopeObject["index"] | 0);
        } else {
            this.index = 0;
        }

        if (envelopeObject["pitchEnvelopeStart"] != undefined) {
            this.pitchEnvelopeStart = clamp(0, this.isNoiseEnvelope ? Config.drumCount : Config.maxPitch + 1, envelopeObject["pitchEnvelopeStart"]);
        } else {
            this.pitchEnvelopeStart = 0;
        }

        if (envelopeObject["pitchEnvelopeEnd"] != undefined) {
            this.pitchEnvelopeEnd = clamp(0, this.isNoiseEnvelope ? Config.drumCount : Config.maxPitch + 1, envelopeObject["pitchEnvelopeEnd"]);
        } else {
            this.pitchEnvelopeEnd = this.isNoiseEnvelope ? Config.drumCount : Config.maxPitch;
        }

        this.inverse = Boolean(envelopeObject["inverse"]);

        if (envelopeObject["perEnvelopeSpeed"] != undefined) {
            this.perEnvelopeSpeed = envelopeObject["perEnvelopeSpeed"];
        } else {
            this.perEnvelopeSpeed = Config.envelopePresets.dictionary[envelopeObject["envelope"]].speed;
        }

        if (envelopeObject["perEnvelopeLowerBound"] != undefined) {
            this.perEnvelopeLowerBound = clamp(Config.perEnvelopeBoundMin, Config.perEnvelopeBoundMax + 1, envelopeObject["perEnvelopeLowerBound"]);
        } else {
            this.perEnvelopeLowerBound = 0;
        }

        if (envelopeObject["perEnvelopeUpperBound"] != undefined) {
            this.perEnvelopeUpperBound = clamp(Config.perEnvelopeBoundMin, Config.perEnvelopeBoundMax + 1, envelopeObject["perEnvelopeUpperBound"]);
        } else {
            this.perEnvelopeUpperBound = 1;
        }

        //convert tremolo2 settings into lfo
        if (isTremolo2) {
            if (this.inverse) {
                this.perEnvelopeUpperBound = Math.floor((this.perEnvelopeUpperBound / 2) * 10) / 10;
                this.perEnvelopeLowerBound = Math.floor((this.perEnvelopeLowerBound / 2) * 10) / 10;
            } else {
                this.perEnvelopeUpperBound = Math.floor((0.5 + (this.perEnvelopeUpperBound - this.perEnvelopeLowerBound) / 2) * 10) / 10;
                this.perEnvelopeLowerBound = 0.5;
            }
        }

        if (envelopeObject["steps"] != undefined) {
            this.steps = clamp(1, Config.randomEnvelopeStepsMax + 1, envelopeObject["steps"]);
        } else {
            this.steps = 2;
        }

        if (envelopeObject["seed"] != undefined) {
            this.seed = clamp(1, Config.randomEnvelopeSeedMax + 1, envelopeObject["seed"]);
        } else {
            this.seed = 2;
        }

        if (envelopeObject["waveform"] != undefined) {
            this.waveform = envelopeObject["waveform"];
        } else {
            this.waveform = LFOEnvelopeTypes.sine;
        }

        if (envelopeObject["discrete"] != undefined) {
            this.discrete = envelopeObject["discrete"];
        } else {
            this.discrete = false;
        }
    }
}



// Settings that were available to old versions of BeepBox but are no longer available in the
// current version that need to be reinterpreted as a group to determine the best way to
// represent them in the current version.
interface LegacySettings {
    filterCutoff?: number;
    filterResonance?: number;
    filterEnvelope?: Envelope;
    pulseEnvelope?: Envelope;
    operatorEnvelopes?: Envelope[];
    feedbackEnvelope?: Envelope;
}

interface HeldMod {
    volume: number;
    channelIndex: number;
    instrumentIndex: number;
    setting: number;
    holdFor: number;
}

export class Instrument {
    public type: InstrumentType = InstrumentType.chip;
    public preset: number = 0;
    public chipWave: number = 2;
	public isUsingAdvancedLoopControls: boolean = false;
	public chipWaveLoopStart: number = 0;
	public chipWaveLoopEnd = Config.rawRawChipWaves[this.chipWave].samples.length - 1;
	public chipWaveLoopMode: number = 0; // 0: loop, 1: ping-pong, 2: once, 3: play loop once
	public chipWavePlayBackwards: boolean = false;
        public chipWaveStartOffset: number = 0;
    public chipNoise: number = 1;
    public eqFilter: FilterSettings = new FilterSettings();
    public eqFilterType: boolean = false;
    public eqFilterSimpleCut: number = Config.filterSimpleCutRange - 1;
    public eqFilterSimplePeak: number = 0;
    public noteFilter: FilterSettings = new FilterSettings();
    public noteFilterType: boolean = false;
    public noteFilterSimpleCut: number = Config.filterSimpleCutRange - 1;
    public noteFilterSimplePeak: number = 0;
    public eqSubFilters: (FilterSettings | null)[] = [];
    public noteSubFilters: (FilterSettings | null)[] = [];
    public tmpEqFilterStart: FilterSettings | null;
    public tmpEqFilterEnd: FilterSettings | null;
    public tmpNoteFilterStart: FilterSettings | null;
    public tmpNoteFilterEnd: FilterSettings | null;
    public envelopes: EnvelopeSettings[] = [];
    public fadeIn: number = 0;
    public fadeOut: number = Config.fadeOutNeutral;
    public envelopeCount: number = 0;
    public transition: number = Config.transitions.dictionary["normal"].index;
    public slideTicks: number = 3;
    public pitchShift: number = 0;
    public detune: number = 0;
    public vibrato: number = 0;
    public interval: number = 0;
    public vibratoDepth: number = 0;
    public vibratoSpeed: number = 10;
    public vibratoDelay: number = 0;
    public vibratoType: number = 0;
    public envelopeSpeed: number = 12;
    public unison: number = 0;
    public unisonVoices: number = 1;
    public unisonSpread: number = 0.0;
    public unisonOffset: number = 0.0;
    public unisonExpression: number = 1.4;
    public unisonSign: number = 1.0;
    public unisonAntiPhased: boolean = false;
    public unisonBuzzes: boolean = false;
    public effects: number = 0;
    public chord: number = 1;
    public strumParts: number = 3;
    public volume: number = 0;
    public pan: number = Config.panCenter;
    public panDelay: number = 0;
    public arpeggioSpeed: number = 12;
    public monoChordTone: number = 0;
    public fastTwoNoteArp: boolean = false;
    public legacyTieOver: boolean = false;
    public clicklessTransition: boolean = false;
    public aliases: boolean = false;
    public pulseWidth: number = Config.pulseWidthRange;
    public decimalOffset: number = 0;
    public supersawDynamism: number = Config.supersawDynamismMax;
    public supersawSpread: number = Math.ceil(Config.supersawSpreadMax / 2.0);
    public supersawShape: number = 0;
    public stringSustain: number = 10;
    public stringSustainType: SustainType = SustainType.acoustic;
    public distortion: number = 0;
    public bitcrusherFreq: number = 0;
    public bitcrusherQuantization: number = 0;
    public ringModulation: number = Config.ringModRange >> 1;
    public ringModulationHz: number = Config.ringModHzRange >> 1;
    public ringModWaveformIndex: number = 0;
    public ringModPulseWidth: number = Config.pwmOperatorWaves.length >> 1;
    public ringModHzOffset: number = 200;
    public granular: number = 4;
    public grainSize: number = (Config.grainSizeMax - Config.grainSizeMin) / Config.grainSizeStep;
    public grainFreq: number = Config.grainFreqMax;
    public grainRange: number = 40;
    public chorus: number = 0;
    public reverb: number = 0;
    public echoSustain: number = 0;
    public echoDelay: number = 0;
    public upperNoteLimit: number = Config.maxPitch;
    public lowerNoteLimit: number = 0;
    public pluginValues: number[] = new Array(64);
    public algorithm: number = 0;
    public feedbackType: number = 0;
    public algorithm6Op: number = 1;
    public feedbackType6Op: number = 1;//default to not custom
    public customAlgorithm: CustomAlgorithm = new CustomAlgorithm(); //{ name: "1←4(2←5 3←6", carrierCount: 3, associatedCarrier: [1, 2, 3, 1, 2, 3], modulatedBy: [[2, 3, 4], [5], [6], [], [], []] };
    public customFeedbackType: CustomFeedBack = new CustomFeedBack(); //{ name: "1↔4 2↔5 3↔6", indices: [[3], [5], [6], [1], [2], [3]] };
    public feedbackAmplitude: number = 0;
    public customChipWave: Float32Array = new Float32Array(64);
    public customChipWaveIntegral: Float32Array = new Float32Array(65); // One extra element for wrap-around in chipSynth.
    public readonly operators: Operator[] = [];
    public readonly spectrumWave: SpectrumWave;
    public readonly harmonicsWave: HarmonicsWave = new HarmonicsWave();
    public readonly drumsetEnvelopes: number[] = [];
    public readonly drumsetSpectrumWaves: SpectrumWave[] = [];
    public modChannels: number[] = [];
    public modInstruments: number[] = [];
    public modulators: number[] = [];
    public modFilterTypes: number[] = [];
    public modEnvelopeNumbers: number[] = [];
    public invalidModulators: boolean[] = [];

    //Literally just for pitch envelopes. 
    public isNoiseInstrument: boolean = false;
    constructor(isNoiseChannel: boolean, isModChannel: boolean) {

        // @jummbus - My screed on how modulator arrays for instruments work, for the benefit of myself in the future, or whoever else.
        //
        // modulators[mod] is the index in Config.modulators to use, with "none" being the first entry.
        //
        // modChannels[mod] gives the index of a channel set for this mod. Two special values:
        //   -2 "none"
        //   -1 "song"
        //   0+ actual channel index
        //
        // modInstruments[mod] gives the index of an instrument within the channel set for this mod. Again, two special values:
        //   [0 ~ channel.instruments.length-1]     channel's instrument index
        //   channel.instruments.length             "all"
        //   channel.instruments.length+1           "active"
        //
        // modFilterTypes[mod] gives some info about the filter type: 0 is morph, 1+ is index in the dot selection array (dot 1 x, dot 1 y, dot 2 x...)
        //   0  filter morph
        //   1+ filter dot target, starting from dot 1 x and then dot 1 y, then repeating x, y for all dots in order. Note: odd values are always "x" targets, even are "y".

        if (isModChannel) {
            for (let mod: number = 0; mod < Config.modCount; mod++) {
                this.modChannels.push(-2);
                this.modInstruments.push(0);
                this.modulators.push(Config.modulators.dictionary["none"].index);
            }
        }

        this.spectrumWave = new SpectrumWave(isNoiseChannel);
        for (let i: number = 0; i < Config.operatorCount + 2; i++) {//hopefully won't break everything
            this.operators[i] = new Operator(i);
        }
        for (let i: number = 0; i < Config.drumCount; i++) {
            this.drumsetEnvelopes[i] = Config.envelopePresets.dictionary["twang 2"].index;
            this.drumsetSpectrumWaves[i] = new SpectrumWave(true);
        }

        for (let i = 0; i < 64; i++) {
            this.customChipWave[i] = 24 - Math.floor(i * (48 / 64));
        }

        let sum: number = 0.0;
        for (let i: number = 0; i < this.customChipWave.length; i++) {
            sum += this.customChipWave[i];
        }
        const average: number = sum / this.customChipWave.length;

        // Perform the integral on the wave. The chipSynth will perform the derivative to get the original wave back but with antialiasing.
        let cumulative: number = 0;
        let wavePrev: number = 0;
        for (let i: number = 0; i < this.customChipWave.length; i++) {
            cumulative += wavePrev;
            wavePrev = this.customChipWave[i] - average;
            this.customChipWaveIntegral[i] = cumulative;
        }

        // 65th, last sample is for anti-aliasing
        this.customChipWaveIntegral[64] = 0.0;

        //properly sets the isNoiseInstrument value
        this.isNoiseInstrument = isNoiseChannel;

    }

    public setTypeAndReset(type: InstrumentType, isNoiseChannel: boolean, isModChannel: boolean): void {
        // Mod channels are forced to one type.
        if (isModChannel) type = InstrumentType.mod;
        this.type = type;
        this.preset = type;
        this.volume = 0;
        this.effects = (1 << EffectType.panning); // Panning enabled by default in JB.
        this.chorus = Config.chorusRange - 1;
        this.reverb = 0;
        this.echoSustain = Math.floor((Config.echoSustainRange - 1) * 0.5);
        this.echoDelay = Math.floor((Config.echoDelayRange - 1) * 0.5);
        this.pluginValues.fill(0);
        this.eqFilter.reset();
        this.eqFilterType = false;
        this.eqFilterSimpleCut = Config.filterSimpleCutRange - 1;
        this.eqFilterSimplePeak = 0;
        for (let i: number = 0; i < Config.filterMorphCount; i++) {
            this.eqSubFilters[i] = null;
            this.noteSubFilters[i] = null;
        }
        this.noteFilter.reset();
        this.noteFilterType = false;
        this.noteFilterSimpleCut = Config.filterSimpleCutRange - 1;
        this.noteFilterSimplePeak = 0;
        this.distortion = Math.floor((Config.distortionRange - 1) * 0.75);
        this.bitcrusherFreq = Math.floor((Config.bitcrusherFreqRange - 1) * 0.5)
        this.bitcrusherQuantization = Math.floor((Config.bitcrusherQuantizationRange - 1) * 0.5);
        this.ringModulation = Config.ringModRange >> 1;
        this.ringModulationHz = Config.ringModHzRange >> 1;
        this.ringModWaveformIndex = 0;
        this.ringModPulseWidth = Config.pwmOperatorWaves.length >> 1;
        this.ringModHzOffset = 200;
        this.granular = 4;
        this.grainSize = (Config.grainSizeMax - Config.grainSizeMin) / Config.grainSizeStep;
        this.grainFreq = Config.grainFreqMax;
        this.grainRange = 40;
        this.pan = Config.panCenter;
        this.panDelay = 0;
        this.pitchShift = Config.pitchShiftCenter;
        this.detune = Config.detuneCenter;
        this.vibrato = 0;
        this.unison = 0;
        this.unisonBuzzes = false;
        this.stringSustain = 10;
        this.stringSustainType = Config.enableAcousticSustain ? SustainType.acoustic : SustainType.bright;
        this.clicklessTransition = false;
        this.arpeggioSpeed = 12;
        this.monoChordTone = 1;
        this.strumParts = 3;
        this.envelopeSpeed = 12;
        this.legacyTieOver = false;
        this.aliases = false;
        this.fadeIn = 0;
        this.fadeOut = Config.fadeOutNeutral;
        this.transition = Config.transitions.dictionary["normal"].index;
        this.slideTicks = 3;
        this.envelopeCount = 0;
        this.isNoiseInstrument = isNoiseChannel;
        this.upperNoteLimit = Config.maxPitch;
        this.lowerNoteLimit = 0;
        switch (type) {
            case InstrumentType.chip:
                this.chipWave = 2;
                // TODO: enable the chord effect? //slarmoo - My decision is no, others can if they would like though
                this.chord = Config.chords.dictionary["arpeggio"].index;
                this.isUsingAdvancedLoopControls = false;
                this.chipWaveLoopStart = 0;
                this.chipWaveLoopEnd = Config.rawRawChipWaves[this.chipWave].samples.length - 1;
                this.chipWaveLoopMode = 0;
                this.chipWavePlayBackwards = false;
                this.chipWaveStartOffset = 0;
                break;
            case InstrumentType.customChipWave:
                this.chipWave = 2;
                this.chord = Config.chords.dictionary["arpeggio"].index;
                for (let i: number = 0; i < 64; i++) {
                    this.customChipWave[i] = 24 - (Math.floor(i * (48 / 64)));
                }

                let sum: number = 0.0;
                for (let i: number = 0; i < this.customChipWave.length; i++) {
                    sum += this.customChipWave[i];
                }
                const average: number = sum / this.customChipWave.length;

                // Perform the integral on the wave. The chipSynth will perform the derivative to get the original wave back but with antialiasing.
                let cumulative: number = 0;
                let wavePrev: number = 0;
                for (let i: number = 0; i < this.customChipWave.length; i++) {
                    cumulative += wavePrev;
                    wavePrev = this.customChipWave[i] - average;
                    this.customChipWaveIntegral[i] = cumulative;
                }

                this.customChipWaveIntegral[64] = 0.0;
                break;
            case InstrumentType.fm:
                this.chord = Config.chords.dictionary["custom interval"].index;
                this.algorithm = 0;
                this.feedbackType = 0;
                this.feedbackAmplitude = 0;
                for (let i: number = 0; i < this.operators.length; i++) {
                    this.operators[i].reset(i);
                }
                break;
            case InstrumentType.fm6op:
                this.transition = 1;
                this.vibrato = 0;
                this.effects = 1;
                this.chord = 3;
                this.algorithm = 0;
                this.feedbackType = 0;
                this.algorithm6Op = 1;
                this.feedbackType6Op = 1;
                this.customAlgorithm.fromPreset(1);
                this.feedbackAmplitude = 0;
                for (let i: number = 0; i < this.operators.length; i++) {
                    this.operators[i].reset(i);
                }
                break;
            case InstrumentType.noise:
                this.chipNoise = 1;
                this.chord = Config.chords.dictionary["arpeggio"].index;
                break;
            case InstrumentType.spectrum:
                this.chord = Config.chords.dictionary["simultaneous"].index;
                this.spectrumWave.reset(isNoiseChannel);
                break;
            case InstrumentType.drumset:
                this.chord = Config.chords.dictionary["simultaneous"].index;
                for (let i: number = 0; i < Config.drumCount; i++) {
                    this.drumsetEnvelopes[i] = Config.envelopePresets.dictionary["twang 2"].index;
                    if (this.drumsetSpectrumWaves[i] == undefined) {
                        this.drumsetSpectrumWaves[i] = new SpectrumWave(true);
                    }
                    this.drumsetSpectrumWaves[i].reset(isNoiseChannel);
                }
                break;
            case InstrumentType.harmonics:
                this.chord = Config.chords.dictionary["simultaneous"].index;
                this.harmonicsWave.reset();
                break;
            case InstrumentType.pwm:
                this.chord = Config.chords.dictionary["arpeggio"].index;
                this.pulseWidth = Config.pulseWidthRange;
                this.decimalOffset = 0;
                break;
            case InstrumentType.pickedString:
                this.chord = Config.chords.dictionary["strum"].index;
                this.harmonicsWave.reset();
                break;
            case InstrumentType.mod:
                this.transition = 0;
                this.vibrato = 0;
                this.interval = 0;
                this.effects = 0;
                this.chord = 0;
                this.modChannels = [];
                this.modInstruments = [];
                this.modulators = [];
                for (let mod: number = 0; mod < Config.modCount; mod++) {
                    this.modChannels.push(-2);
                    this.modInstruments.push(0);
                    this.modulators.push(Config.modulators.dictionary["none"].index);
                    this.invalidModulators[mod] = false;
                    this.modFilterTypes[mod] = 0;
                    this.modEnvelopeNumbers[mod] = 0;
                }
                break;
            case InstrumentType.supersaw:
                this.chord = Config.chords.dictionary["arpeggio"].index;
                this.supersawDynamism = Config.supersawDynamismMax;
                this.supersawSpread = Math.ceil(Config.supersawSpreadMax / 2.0);
                this.supersawShape = 0;
                this.pulseWidth = Config.pulseWidthRange - 1;
                this.decimalOffset = 0;
                break;
            default:
                throw new Error("Unrecognized instrument type: " + type);
        }
        // Chip/noise instruments had arpeggio and FM had custom interval but neither
        // explicitly saved the chorus setting beforeSeven so enable it here. The effects
        // will otherwise get overridden when reading SongTagCode.startInstrument.
        if (this.chord != Config.chords.dictionary["simultaneous"].index) {
            // Enable chord if it was used.
            this.effects = (this.effects | (1 << EffectType.chord));
        }
    }

    // (only) difference for JummBox: Returns whether or not the note filter was chosen for filter conversion.
    public convertLegacySettings(legacySettings: LegacySettings, forceSimpleFilter: boolean): void {
        let legacyCutoffSetting: number | undefined = legacySettings.filterCutoff;
        let legacyResonanceSetting: number | undefined = legacySettings.filterResonance;
        let legacyFilterEnv: Envelope | undefined = legacySettings.filterEnvelope;
        let legacyPulseEnv: Envelope | undefined = legacySettings.pulseEnvelope;
        let legacyOperatorEnvelopes: Envelope[] | undefined = legacySettings.operatorEnvelopes;
        let legacyFeedbackEnv: Envelope | undefined = legacySettings.feedbackEnvelope;

        // legacy defaults:
        if (legacyCutoffSetting == undefined) legacyCutoffSetting = (this.type == InstrumentType.chip) ? 6 : 10;
        if (legacyResonanceSetting == undefined) legacyResonanceSetting = 0;
        if (legacyFilterEnv == undefined) legacyFilterEnv = Config.envelopePresets.dictionary["none"];
        if (legacyPulseEnv == undefined) legacyPulseEnv = Config.envelopePresets.dictionary[(this.type == InstrumentType.pwm) ? "twang 2" : "none"];
        if (legacyOperatorEnvelopes == undefined) legacyOperatorEnvelopes = [Config.envelopePresets.dictionary[(this.type == InstrumentType.fm) ? "note size" : "none"], Config.envelopePresets.dictionary["none"], Config.envelopePresets.dictionary["none"], Config.envelopePresets.dictionary["none"]];
        if (legacyFeedbackEnv == undefined) legacyFeedbackEnv = Config.envelopePresets.dictionary["none"];

        // The "punch" envelope is special: it goes *above* the chosen cutoff. But if the cutoff was already at the max, it couldn't go any higher... except in the current version of BeepBox I raised the max cutoff so it *can* but then it sounds different, so to preserve the original sound let's just remove the punch envelope.
        const legacyFilterCutoffRange: number = 11;
        const cutoffAtMax: boolean = (legacyCutoffSetting == legacyFilterCutoffRange - 1);
        if (cutoffAtMax && legacyFilterEnv.type == EnvelopeType.punch) legacyFilterEnv = Config.envelopePresets.dictionary["none"];

        const carrierCount: number = Config.algorithms[this.algorithm].carrierCount;
        let noCarriersControlledByNoteSize: boolean = true;
        let allCarriersControlledByNoteSize: boolean = true;
        let noteSizeControlsSomethingElse: boolean = (legacyFilterEnv.type == EnvelopeType.noteSize) || (legacyPulseEnv.type == EnvelopeType.noteSize);
        if (this.type == InstrumentType.fm || this.type == InstrumentType.fm6op) {
            noteSizeControlsSomethingElse = noteSizeControlsSomethingElse || (legacyFeedbackEnv.type == EnvelopeType.noteSize);
            for (let i: number = 0; i < legacyOperatorEnvelopes.length; i++) {
                if (i < carrierCount) {
                    if (legacyOperatorEnvelopes[i].type != EnvelopeType.noteSize) {
                        allCarriersControlledByNoteSize = false;
                    } else {
                        noCarriersControlledByNoteSize = false;
                    }
                } else {
                    noteSizeControlsSomethingElse = noteSizeControlsSomethingElse || (legacyOperatorEnvelopes[i].type == EnvelopeType.noteSize);
                }
            }
        }

        this.envelopeCount = 0;

        if (this.type == InstrumentType.fm || this.type == InstrumentType.fm6op) {
            if (allCarriersControlledByNoteSize && noteSizeControlsSomethingElse) {
                this.addEnvelope(Config.instrumentAutomationTargets.dictionary["noteVolume"].index, 0, Config.envelopePresets.dictionary["note size"].index, false);
            } else if (noCarriersControlledByNoteSize && !noteSizeControlsSomethingElse) {
                this.addEnvelope(Config.instrumentAutomationTargets.dictionary["none"].index, 0, Config.envelopePresets.dictionary["note size"].index, false);
            }
        }

        if (legacyFilterEnv.type == EnvelopeType.none) {
            this.noteFilter.reset();
            this.noteFilterType = false;
            this.eqFilter.convertLegacySettings(legacyCutoffSetting, legacyResonanceSetting, legacyFilterEnv);
            this.effects &= ~(1 << EffectType.noteFilter);
            if (forceSimpleFilter || this.eqFilterType) {
                this.eqFilterType = true;
                this.eqFilterSimpleCut = legacyCutoffSetting;
                this.eqFilterSimplePeak = legacyResonanceSetting;
            }
        } else {
            this.eqFilter.reset();

            this.eqFilterType = false;
            this.noteFilterType = false;
            this.noteFilter.convertLegacySettings(legacyCutoffSetting, legacyResonanceSetting, legacyFilterEnv);
            this.effects |= 1 << EffectType.noteFilter;
            this.addEnvelope(Config.instrumentAutomationTargets.dictionary["noteFilterAllFreqs"].index, 0, legacyFilterEnv.index, false);
            if (forceSimpleFilter || this.noteFilterType) {
                this.noteFilterType = true;
                this.noteFilterSimpleCut = legacyCutoffSetting;
                this.noteFilterSimplePeak = legacyResonanceSetting;
            }
        }

        if (legacyPulseEnv.type != EnvelopeType.none) {
            this.addEnvelope(Config.instrumentAutomationTargets.dictionary["pulseWidth"].index, 0, legacyPulseEnv.index, false);
        }

        for (let i: number = 0; i < legacyOperatorEnvelopes.length; i++) {
            if (i < carrierCount && allCarriersControlledByNoteSize) continue;
            if (legacyOperatorEnvelopes[i].type != EnvelopeType.none) {
                this.addEnvelope(Config.instrumentAutomationTargets.dictionary["operatorAmplitude"].index, i, legacyOperatorEnvelopes[i].index, false);
            }
        }

        if (legacyFeedbackEnv.type != EnvelopeType.none) {
            this.addEnvelope(Config.instrumentAutomationTargets.dictionary["feedbackAmplitude"].index, 0, legacyFeedbackEnv.index, false);
        }
    }

    public toJsonObject(): Object {
        const instrumentObject: any = {
            "type": Config.instrumentTypeNames[this.type],
            "volume": this.volume,
            "eqFilter": this.eqFilter.toJsonObject(),
            "eqFilterType": this.eqFilterType,
            "eqSimpleCut": this.eqFilterSimpleCut,
            "eqSimplePeak": this.eqFilterSimplePeak,
            "envelopeSpeed": this.envelopeSpeed
        };

        if (this.preset != this.type) {
            instrumentObject["preset"] = this.preset;
        }

        for (let i: number = 0; i < Config.filterMorphCount; i++) {
            if (this.eqSubFilters[i] != null)
                instrumentObject["eqSubFilters" + i] = this.eqSubFilters[i]!.toJsonObject();
        }

        const effects: string[] = [];
        for (const effect of Config.effectOrder) {
            if (this.effects & (1 << effect)) {
                effects.push(Config.effectNames[effect]);
            }
        }
        instrumentObject["effects"] = effects;


        if (effectsIncludeTransition(this.effects)) {
            instrumentObject["transition"] = Config.transitions[this.transition].name;
            instrumentObject["clicklessTransition"] = this.clicklessTransition;
            if (Config.transitions[this.transition].slides == true) instrumentObject["slideTicks"] = this.slideTicks;
        }
        if (effectsIncludeChord(this.effects)) {
            instrumentObject["chord"] = this.getChord().name;
            instrumentObject["fastTwoNoteArp"] = this.fastTwoNoteArp;
            instrumentObject["arpeggioSpeed"] = this.arpeggioSpeed;
            instrumentObject["monoChordTone"] = this.monoChordTone;
            if (Config.chords[this.chord].strumParts > 0) instrumentObject["strumParts"] = this.strumParts;
        }
        if (effectsIncludePitchShift(this.effects)) {
            instrumentObject["pitchShiftSemitones"] = this.pitchShift;
        }
        if (effectsIncludeDetune(this.effects)) {
            instrumentObject["detuneCents"] = SynthMessenger.detuneToCents(this.detune);
        }
        if (effectsIncludeVibrato(this.effects)) {
            if (this.vibrato == -1) {
                this.vibrato = 5;
            }
            if (this.vibrato != 5) {
                instrumentObject["vibrato"] = Config.vibratos[this.vibrato].name;
            } else {
                instrumentObject["vibrato"] = "custom";
            }
            instrumentObject["vibratoDepth"] = this.vibratoDepth;
            instrumentObject["vibratoDelay"] = this.vibratoDelay;
            instrumentObject["vibratoSpeed"] = this.vibratoSpeed;
            instrumentObject["vibratoType"] = this.vibratoType;
        }
        if (effectsIncludeNoteFilter(this.effects)) {
            instrumentObject["noteFilterType"] = this.noteFilterType;
            instrumentObject["noteSimpleCut"] = this.noteFilterSimpleCut;
            instrumentObject["noteSimplePeak"] = this.noteFilterSimplePeak;
            instrumentObject["noteFilter"] = this.noteFilter.toJsonObject();

            for (let i: number = 0; i < Config.filterMorphCount; i++) {
                if (this.noteSubFilters[i] != null)
                    instrumentObject["noteSubFilters" + i] = this.noteSubFilters[i]!.toJsonObject();
            }
        }
        if (effectsIncludeGranular(this.effects)) {
            instrumentObject["granular"] = this.granular;
            instrumentObject["grainSize"] = this.grainSize;
            instrumentObject["grainFreq"] = this.grainFreq;
            instrumentObject["grainRange"] = this.grainRange;
        }
        if (effectsIncludeRingModulation(this.effects)) {
            instrumentObject["ringMod"] = Math.round(100 * this.ringModulation / (Config.ringModRange - 1));
            instrumentObject["ringModHz"] = Math.round(100 * this.ringModulationHz / (Config.ringModHzRange - 1));
            instrumentObject["ringModWaveformIndex"] = this.ringModWaveformIndex;
            instrumentObject["ringModPulseWidth"] = Math.round(100 * this.ringModPulseWidth / (Config.pulseWidthRange - 1));
            instrumentObject["ringModHzOffset"] = Math.round(100 * this.ringModHzOffset / (Config.rmHzOffsetMax));
        }
        if (effectsIncludeDistortion(this.effects)) {
            instrumentObject["distortion"] = Math.round(100 * this.distortion / (Config.distortionRange - 1));
            instrumentObject["aliases"] = this.aliases;
        }
        if (effectsIncludeBitcrusher(this.effects)) {
            instrumentObject["bitcrusherOctave"] = (Config.bitcrusherFreqRange - 1 - this.bitcrusherFreq) * Config.bitcrusherOctaveStep;
            instrumentObject["bitcrusherQuantization"] = Math.round(100 * this.bitcrusherQuantization / (Config.bitcrusherQuantizationRange - 1));
        }
        if (effectsIncludePanning(this.effects)) {
            instrumentObject["pan"] = Math.round(100 * (this.pan - Config.panCenter) / Config.panCenter);
            instrumentObject["panDelay"] = this.panDelay;
        }
        if (effectsIncludeChorus(this.effects)) {
            instrumentObject["chorus"] = Math.round(100 * this.chorus / (Config.chorusRange - 1));
        }
        if (effectsIncludeEcho(this.effects)) {
            instrumentObject["echoSustain"] = Math.round(100 * this.echoSustain / (Config.echoSustainRange - 1));
            instrumentObject["echoDelayBeats"] = Math.round(1000 * (this.echoDelay + 1) * Config.echoDelayStepTicks / (Config.ticksPerPart * Config.partsPerBeat)) / 1000;
        }
        if (effectsIncludeReverb(this.effects)) {
            instrumentObject["reverb"] = Math.round(100 * this.reverb / (Config.reverbRange - 1));
        }
        if (effectsIncludeNoteRange(this.effects)) {
            instrumentObject["upperNoteLimit"] = this.upperNoteLimit;
            instrumentObject["lowerNoteLimit"] = this.lowerNoteLimit;
        }

        if (effectsIncludePlugin(this.effects)) {
            instrumentObject["plugin"] = this.pluginValues.slice(0, PluginConfig.pluginUIElements.length - 1);
        }

        if (this.type != InstrumentType.drumset) {
            instrumentObject["fadeInSeconds"] = Math.round(10000 * SynthMessenger.fadeInSettingToSeconds(this.fadeIn)) / 10000;
            instrumentObject["fadeOutTicks"] = SynthMessenger.fadeOutSettingToTicks(this.fadeOut);
        }

        if (this.type == InstrumentType.harmonics || this.type == InstrumentType.pickedString) {
            instrumentObject["harmonics"] = [];
            for (let i: number = 0; i < Config.harmonicsControlPoints; i++) {
                instrumentObject["harmonics"][i] = Math.round(100 * this.harmonicsWave.harmonics[i] / Config.harmonicsMax);
            }
        }

        if (this.type != InstrumentType.mod) {
            instrumentObject["unison"] = this.unison == Config.unisons.length ? "custom" : Config.unisons[this.unison].name;
            // these don't need to be pushed if custom unisons aren't being used
            if (this.unison == Config.unisons.length) {
                instrumentObject["unisonVoices"] = this.unisonVoices;
                instrumentObject["unisonSpread"] = this.unisonSpread;
                instrumentObject["unisonOffset"] = this.unisonOffset;
                instrumentObject["unisonExpression"] = this.unisonExpression;
                instrumentObject["unisonSign"] = this.unisonSign;
                if (this.unisonVoices == 1) { 
                    instrumentObject["unisonBuzzes"] = this.unisonBuzzes;
                } else {
                    instrumentObject["unisonAntiPhased"] = this.unisonAntiPhased;
                }
            }
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
            instrumentObject["isUsingAdvancedLoopControls"] = this.isUsingAdvancedLoopControls;
            instrumentObject["chipWaveLoopStart"] = this.chipWaveLoopStart;
            instrumentObject["chipWaveLoopEnd"] = this.chipWaveLoopEnd;
            instrumentObject["chipWaveLoopMode"] = this.chipWaveLoopMode;
            instrumentObject["chipWavePlayBackwards"] = this.chipWavePlayBackwards;
            instrumentObject["chipWaveStartOffset"] = this.chipWaveStartOffset;
        } else if (this.type == InstrumentType.pwm) {
            instrumentObject["pulseWidth"] = this.pulseWidth;
            instrumentObject["decimalOffset"] = this.decimalOffset;
        } else if (this.type == InstrumentType.supersaw) {
            instrumentObject["pulseWidth"] = this.pulseWidth;
            instrumentObject["decimalOffset"] = this.decimalOffset;
            instrumentObject["dynamism"] = Math.round(100 * this.supersawDynamism / Config.supersawDynamismMax);
            instrumentObject["spread"] = Math.round(100 * this.supersawSpread / Config.supersawSpreadMax);
            instrumentObject["shape"] = Math.round(100 * this.supersawShape / Config.supersawShapeMax);
        } else if (this.type == InstrumentType.pickedString) {
            instrumentObject["stringSustain"] = Math.round(100 * this.stringSustain / (Config.stringSustainRange - 1));
            if (Config.enableAcousticSustain) {
                instrumentObject["stringSustainType"] = Config.sustainTypeNames[this.stringSustainType];
            }
        } else if (this.type == InstrumentType.fm) {
            const operatorArray: Object[] = [];
            for (let i = 0; i < Config.operatorCount; i++) {
                const operator = this.operators[i];
                operatorArray.push({
                    "frequency": Config.operatorFrequencies[operator.frequency].name,
                    "amplitude": operator.amplitude,
                    "waveform": Config.operatorWaves[operator.waveform].name,
                    "pulseWidth": operator.pulseWidth,
                });
            }
            instrumentObject["algorithm"] = Config.algorithms[this.algorithm].name;
            instrumentObject["feedbackType"] = Config.feedbacks[this.feedbackType].name;
            instrumentObject["feedbackAmplitude"] = this.feedbackAmplitude;
            instrumentObject["operators"] = operatorArray;
        } else if (this.type == InstrumentType.fm6op) {
            const operatorArray: Object[] = [];
            for (const operator of this.operators) {
                operatorArray.push({
                    "frequency": Config.operatorFrequencies[operator.frequency].name,
                    "amplitude": operator.amplitude,
                    "waveform": Config.operatorWaves[operator.waveform].name,
                    "pulseWidth": operator.pulseWidth,
                });
            }
            instrumentObject["algorithm"] = Config.algorithms6Op[this.algorithm6Op].name;
            instrumentObject["feedbackType"] = Config.feedbacks6Op[this.feedbackType6Op].name;
            instrumentObject["feedbackAmplitude"] = this.feedbackAmplitude;
            if (this.algorithm6Op == 0) {
                const customAlgorithm: any = {};
                customAlgorithm["mods"] = this.customAlgorithm.modulatedBy;
                customAlgorithm["carrierCount"] = this.customAlgorithm.carrierCount;
                instrumentObject["customAlgorithm"] = customAlgorithm;
            }
            if (this.feedbackType6Op == 0) {
                const customFeedback: any = {};
                customFeedback["mods"] = this.customFeedbackType.indices;
                instrumentObject["customFeedback"] = customFeedback;
            }

            instrumentObject["operators"] = operatorArray;
        } else if (this.type == InstrumentType.customChipWave) {
            instrumentObject["wave"] = Config.chipWaves[this.chipWave].name;
            instrumentObject["customChipWave"] = new Float64Array(64);
            instrumentObject["customChipWaveIntegral"] = new Float64Array(65);
            for (let i: number = 0; i < this.customChipWave.length; i++) {
                instrumentObject["customChipWave"][i] = this.customChipWave[i];
                // Meh, waste of space and can be inaccurate. It will be recalc'ed when instrument loads.
                //instrumentObject["customChipWaveIntegral"][i] = this.customChipWaveIntegral[i];
            }
        } else if (this.type == InstrumentType.mod) {
            instrumentObject["modChannels"] = [];
            instrumentObject["modInstruments"] = [];
            instrumentObject["modSettings"] = [];
            instrumentObject["modFilterTypes"] = [];
            instrumentObject["modEnvelopeNumbers"] = [];
            for (let mod: number = 0; mod < Config.modCount; mod++) {
                instrumentObject["modChannels"][mod] = this.modChannels[mod];
                instrumentObject["modInstruments"][mod] = this.modInstruments[mod];
                instrumentObject["modSettings"][mod] = this.modulators[mod];
                instrumentObject["modFilterTypes"][mod] = this.modFilterTypes[mod];
                instrumentObject["modEnvelopeNumbers"][mod] = this.modEnvelopeNumbers[mod];
            }
        } else if (this.type == InstrumentType.harmonics) { } else {
            throw new Error("Unrecognized instrument type");
        }

        const envelopes: any[] = [];
        for (let i = 0; i < this.envelopeCount; i++) {
            envelopes.push(this.envelopes[i].toJsonObject());
        }
        instrumentObject["envelopes"] = envelopes;

        return instrumentObject;
    }


    public fromJsonObject(instrumentObject: any, isNoiseChannel: boolean, isModChannel: boolean, useSlowerRhythm: boolean, useFastTwoNoteArp: boolean, legacyGlobalReverb: number = 0, jsonFormat: string = Config.jsonFormat): void {
        if (instrumentObject == undefined) instrumentObject = {};

        const format: string = jsonFormat.toLowerCase();

        let type: InstrumentType = Config.instrumentTypeNames.indexOf(instrumentObject["type"]);
        // SynthBox support
        if ((format == "synthbox") && (instrumentObject["type"] == "FM")) type = Config.instrumentTypeNames.indexOf("FM6op");
        if (<any>type == -1) type = isModChannel ? InstrumentType.mod : (isNoiseChannel ? InstrumentType.noise : InstrumentType.chip);
        this.setTypeAndReset(type, isNoiseChannel, isModChannel);

        this.effects &= ~(1 << EffectType.panning);

        if (instrumentObject["preset"] != undefined) {
            this.preset = instrumentObject["preset"] >>> 0;
        }

        if (instrumentObject["volume"] != undefined) {
            if (format == "jummbox" || format == "midbox" || format == "synthbox" || format == "goldbox" || format == "paandorasbox" || format == "ultrabox" || format == "slarmoosbox") {
                this.volume = clamp(-Config.volumeRange / 2, (Config.volumeRange / 2) + 1, instrumentObject["volume"] | 0);
            } else {
                this.volume = Math.round(-clamp(0, 8, Math.round(5 - (instrumentObject["volume"] | 0) / 20)) * 25.0 / 7.0);
            }
        } else {
            this.volume = 0;
        }

        //These can probably be condensed with ternary operators
        this.envelopeSpeed = instrumentObject["envelopeSpeed"] != undefined ? clamp(0, Config.modulators.dictionary["envelope speed"].maxRawVol + 1, instrumentObject["envelopeSpeed"] | 0) : 12;

        if (Array.isArray(instrumentObject["effects"])) {
            let effects: number = 0;
            for (let i: number = 0; i < instrumentObject["effects"].length; i++) {
                effects = effects | (1 << Config.effectNames.indexOf(instrumentObject["effects"][i]));
            }
            this.effects = (effects & ((1 << EffectType.length) - 1));
        } else {
            // The index of these names is reinterpreted as a bitfield, which relies on reverb and chorus being the first effects!
            const legacyEffectsNames: string[] = ["none", "reverb", "chorus", "chorus & reverb"];
            this.effects = legacyEffectsNames.indexOf(instrumentObject["effects"]);
            if (this.effects == -1) this.effects = (this.type == InstrumentType.noise) ? 0 : 1;
        }

        this.transition = Config.transitions.dictionary["normal"].index; // default value.
        const transitionProperty: any = instrumentObject["transition"] || instrumentObject["envelope"]; // the transition property used to be called envelope, so check that too.
        if (transitionProperty != undefined) {
            let transition: Transition | undefined = Config.transitions.dictionary[transitionProperty];
            if (instrumentObject["fadeInSeconds"] == undefined || instrumentObject["fadeOutTicks"] == undefined) {
                const legacySettings = (<any>{
                    "binary": { transition: "interrupt", fadeInSeconds: 0.0, fadeOutTicks: -1 },
                    "seamless": { transition: "interrupt", fadeInSeconds: 0.0, fadeOutTicks: -1 },
                    "sudden": { transition: "normal", fadeInSeconds: 0.0, fadeOutTicks: -3 },
                    "hard": { transition: "normal", fadeInSeconds: 0.0, fadeOutTicks: -3 },
                    "smooth": { transition: "normal", fadeInSeconds: 0.025, fadeOutTicks: -3 },
                    "soft": { transition: "normal", fadeInSeconds: 0.025, fadeOutTicks: -3 },
                    // Note that the old slide transition has the same name as a new slide transition that is different.
                    // Only apply legacy settings if the instrument JSON was created before, based on the presence
                    // of the fade in/out fields.
                    "slide": { transition: "slide in pattern", fadeInSeconds: 0.025, fadeOutTicks: -3 },
                    "cross fade": { transition: "normal", fadeInSeconds: 0.04, fadeOutTicks: 6 },
                    "hard fade": { transition: "normal", fadeInSeconds: 0.0, fadeOutTicks: 48 },
                    "medium fade": { transition: "normal", fadeInSeconds: 0.0125, fadeOutTicks: 72 },
                    "soft fade": { transition: "normal", fadeInSeconds: 0.06, fadeOutTicks: 96 },
                })[transitionProperty];
                if (legacySettings != undefined) {
                    transition = Config.transitions.dictionary[legacySettings.transition];
                    // These may be overridden below.
                    this.fadeIn = SynthMessenger.secondsToFadeInSetting(legacySettings.fadeInSeconds);
                    this.fadeOut = SynthMessenger.ticksToFadeOutSetting(legacySettings.fadeOutTicks);
                }
            }
            if (transition != undefined) this.transition = transition.index;

            if (this.transition != Config.transitions.dictionary["normal"].index) {
                // Enable transition if it was used.
                this.effects = (this.effects | (1 << EffectType.transition));
            }
        }

        if (instrumentObject["slideTicks"] != undefined) {
            this.slideTicks = instrumentObject["slideTicks"];
        }

        // Overrides legacy settings in transition above.
        if (instrumentObject["fadeInSeconds"] != undefined) {
            this.fadeIn = SynthMessenger.secondsToFadeInSetting(+instrumentObject["fadeInSeconds"]);
        }
        if (instrumentObject["fadeOutTicks"] != undefined) {
            this.fadeOut = SynthMessenger.ticksToFadeOutSetting(+instrumentObject["fadeOutTicks"]);
        }

        {
            // Note that the chord setting may be overridden by instrumentObject["chorus"] below.
            const chordProperty: any = instrumentObject["chord"];
            const legacyChordNames: Dictionary<string> = { "harmony": "simultaneous" };
            const chord: Chord | undefined = Config.chords.dictionary[legacyChordNames[chordProperty]] || Config.chords.dictionary[chordProperty];
            if (chord != undefined) {
                this.chord = chord.index;
            } else {
                // Different instruments have different default chord types based on historical behaviour.
                if (this.type == InstrumentType.noise) {
                    this.chord = Config.chords.dictionary["arpeggio"].index;
                } else if (this.type == InstrumentType.pickedString) {
                    this.chord = Config.chords.dictionary["strum"].index;
                } else if (this.type == InstrumentType.chip) {
                    this.chord = Config.chords.dictionary["arpeggio"].index;
                } else if (this.type == InstrumentType.fm || this.type == InstrumentType.fm6op) {
                    this.chord = Config.chords.dictionary["custom interval"].index;
                } else {
                    this.chord = Config.chords.dictionary["simultaneous"].index;
                }
            }
        }

        if (instrumentObject["strumParts"] != undefined) {
            this.strumParts = instrumentObject["strumParts"];
        }

        this.unison = Config.unisons.dictionary["none"].index; // default value.
        const unisonProperty: any = instrumentObject["unison"] || instrumentObject["interval"] || instrumentObject["chorus"]; // The unison property has gone by various names in the past.
        if (unisonProperty != undefined) {
            const legacyChorusNames: Dictionary<string> = { "union": "none", "fifths": "fifth", "octaves": "octave", "error": "voiced" };
            const unison: Unison | undefined = Config.unisons.dictionary[legacyChorusNames[unisonProperty]] || Config.unisons.dictionary[unisonProperty];
            if (unison != undefined) this.unison = unison.index;
            if (unisonProperty == "custom") this.unison = Config.unisons.length;
        }
        //clamp these???
        this.unisonVoices = (instrumentObject["unisonVoices"] == undefined) ? Config.unisons[this.unison].voices : instrumentObject["unisonVoices"];
        this.unisonSpread = (instrumentObject["unisonSpread"] == undefined) ? Config.unisons[this.unison].spread : instrumentObject["unisonSpread"];
        this.unisonOffset = (instrumentObject["unisonOffset"] == undefined) ? Config.unisons[this.unison].offset : instrumentObject["unisonOffset"];
        this.unisonExpression = (instrumentObject["unisonExpression"] == undefined) ? Config.unisons[this.unison].expression : instrumentObject["unisonExpression"];
        this.unisonSign = (instrumentObject["unisonSign"] == undefined) ? Config.unisons[this.unison].sign : instrumentObject["unisonSign"];
        this.unisonAntiPhased = (instrumentObject["unisonAntiPhased"] == true);
        this.unisonBuzzes = (instrumentObject["unisonBuzzes"] == undefined) ? false : instrumentObject["unisonBuzzes"];

        if (instrumentObject["chorus"] == "custom harmony") {
            // The original chorus setting had an option that now maps to two different settings. Override those if necessary.
            this.unison = Config.unisons.dictionary["hum"].index;
            this.chord = Config.chords.dictionary["custom interval"].index;
        }
        if (this.chord != Config.chords.dictionary["simultaneous"].index && !Array.isArray(instrumentObject["effects"])) {
            // Enable chord if it was used.
            this.effects = (this.effects | (1 << EffectType.chord));
        }

        if (instrumentObject["pitchShiftSemitones"] != undefined) {
            this.pitchShift = clamp(0, Config.pitchShiftRange, Math.round(+instrumentObject["pitchShiftSemitones"]));
        }
        // modbox pitch shift, known in that mod as "octave offset"
        if (instrumentObject["octoff"] != undefined) {
            let potentialPitchShift: string = instrumentObject["octoff"];
            this.effects = (this.effects | (1 << EffectType.pitchShift));

            if ((potentialPitchShift == "+1 (octave)") || (potentialPitchShift == "+2 (2 octaves)")) {
                this.pitchShift = 24;
            } else if ((potentialPitchShift == "+1/2 (fifth)") || (potentialPitchShift == "+1 1/2 (octave and fifth)")) {
                this.pitchShift = 18;
            } else if ((potentialPitchShift == "-1 (octave)") || (potentialPitchShift == "-2 (2 octaves")) { //this typo is in modbox
                this.pitchShift = 0;
            } else if ((potentialPitchShift == "-1/2 (fifth)") || (potentialPitchShift == "-1 1/2 (octave and fifth)")) {
                this.pitchShift = 6;
            } else {
                this.pitchShift = 12;
            }
        }
        if (instrumentObject["detuneCents"] != undefined) {
            this.detune = clamp(Config.detuneMin, Config.detuneMax + 1, Math.round(SynthMessenger.centsToDetune(+instrumentObject["detuneCents"])));
        }

        this.vibrato = Config.vibratos.dictionary["none"].index; // default value.
        const vibratoProperty: any = instrumentObject["vibrato"] || instrumentObject["effect"]; // The vibrato property was previously called "effect", not to be confused with the current "effects".
        if (vibratoProperty != undefined) {

            const legacyVibratoNames: Dictionary<string> = { "vibrato light": "light", "vibrato delayed": "delayed", "vibrato heavy": "heavy" };
            const vibrato: Vibrato | undefined = Config.vibratos.dictionary[legacyVibratoNames[unisonProperty]] || Config.vibratos.dictionary[vibratoProperty];
            if (vibrato != undefined)
                this.vibrato = vibrato.index;
            else if (vibratoProperty == "custom")
                this.vibrato = Config.vibratos.length; // custom

            if (this.vibrato == Config.vibratos.length) {
                this.vibratoDepth = instrumentObject["vibratoDepth"];
                this.vibratoSpeed = instrumentObject["vibratoSpeed"];
                this.vibratoDelay = instrumentObject["vibratoDelay"];
                this.vibratoType = instrumentObject["vibratoType"];
            }
            else { // Set defaults for the vibrato profile
                this.vibratoDepth = Config.vibratos[this.vibrato].amplitude;
                this.vibratoDelay = Config.vibratos[this.vibrato].delayTicks / 2;
                this.vibratoSpeed = 10; // default;
                this.vibratoType = Config.vibratos[this.vibrato].type;
            }

            // Old songs may have a vibrato effect without explicitly enabling it.
            if (vibrato != Config.vibratos.dictionary["none"]) {
                this.effects = (this.effects | (1 << EffectType.vibrato));
            }
        }

        if (instrumentObject["pan"] != undefined) {
            this.pan = clamp(0, Config.panMax + 1, Math.round(Config.panCenter + (instrumentObject["pan"] | 0) * Config.panCenter / 100));
        } else if (instrumentObject["ipan"] != undefined) {
            // support for modbox fixed
            this.pan = clamp(0, Config.panMax + 1, Config.panCenter + (instrumentObject["ipan"] * -50));
        } else {
            this.pan = Config.panCenter;
        }

        // Old songs may have a panning effect without explicitly enabling it.
        if (this.pan != Config.panCenter) {
            this.effects = (this.effects | (1 << EffectType.panning));
        }

        if (instrumentObject["panDelay"] != undefined) {
            this.panDelay = (instrumentObject["panDelay"] | 0);
        } else {
            this.panDelay = 0;
        }

        if (instrumentObject["detune"] != undefined) {
            this.detune = clamp(Config.detuneMin, Config.detuneMax + 1, (instrumentObject["detune"] | 0));
        }
        else if (instrumentObject["detuneCents"] == undefined) {
            this.detune = Config.detuneCenter;
        }

        if (instrumentObject["ringMod"] != undefined) {
            this.ringModulation = clamp(0, Config.ringModRange, Math.round((Config.ringModRange - 1) * (instrumentObject["ringMod"] | 0) / 100));
        }
        if (instrumentObject["ringModHz"] != undefined) {
            this.ringModulationHz = clamp(0, Config.ringModHzRange, Math.round((Config.ringModHzRange - 1) * (instrumentObject["ringModHz"] | 0) / 100));
        }
        if (instrumentObject["ringModWaveformIndex"] != undefined) {
            this.ringModWaveformIndex = clamp(0, Config.operatorWaves.length, instrumentObject["ringModWaveformIndex"]);
        }
        if (instrumentObject["ringModPulseWidth"] != undefined) {
            this.ringModPulseWidth = clamp(0, Config.pulseWidthRange, Math.round((Config.pulseWidthRange - 1) * (instrumentObject["ringModPulseWidth"] | 0) / 100));
        }
        if (instrumentObject["ringModHzOffset"] != undefined) {
            this.ringModHzOffset = clamp(0, Config.rmHzOffsetMax, Math.round((Config.rmHzOffsetMax - 1) * (instrumentObject["ringModHzOffset"] | 0) / 100));
        }

        if (instrumentObject["granular"] != undefined) {
            this.granular = instrumentObject["granular"];
        }
        if (instrumentObject["grainSize"] != undefined) {
            this.grainSize = instrumentObject["grainSize"];
        }
        if (instrumentObject["grainAmounts"] != undefined) {
            this.grainFreq = instrumentObject["grainAmounts"];
        } else if (instrumentObject["grainFreq"] != undefined) {
            this.grainFreq = instrumentObject["grainFreq"];
        }
        if (instrumentObject["grainRange"] != undefined) {
            this.grainRange = clamp(0, Config.grainRangeMax / Config.grainSizeStep + 1, instrumentObject["grainRange"]);
        }

        if (instrumentObject["distortion"] != undefined) {
            this.distortion = clamp(0, Config.distortionRange, Math.round((Config.distortionRange - 1) * (instrumentObject["distortion"] | 0) / 100));
        }

        if (instrumentObject["bitcrusherOctave"] != undefined) {
            this.bitcrusherFreq = Config.bitcrusherFreqRange - 1 - (+instrumentObject["bitcrusherOctave"]) / Config.bitcrusherOctaveStep;
        }
        if (instrumentObject["bitcrusherQuantization"] != undefined) {
            this.bitcrusherQuantization = clamp(0, Config.bitcrusherQuantizationRange, Math.round((Config.bitcrusherQuantizationRange - 1) * (instrumentObject["bitcrusherQuantization"] | 0) / 100));
        }

        if (instrumentObject["echoSustain"] != undefined) {
            this.echoSustain = clamp(0, Config.echoSustainRange, Math.round((Config.echoSustainRange - 1) * (instrumentObject["echoSustain"] | 0) / 100));
        }
        if (instrumentObject["echoDelayBeats"] != undefined) {
            this.echoDelay = clamp(0, Config.echoDelayRange, Math.round((+instrumentObject["echoDelayBeats"]) * (Config.ticksPerPart * Config.partsPerBeat) / Config.echoDelayStepTicks - 1.0));
        }

        if (!isNaN(instrumentObject["chorus"])) {
            this.chorus = clamp(0, Config.chorusRange, Math.round((Config.chorusRange - 1) * (instrumentObject["chorus"] | 0) / 100));
        }

        if (instrumentObject["reverb"] != undefined) {
            this.reverb = clamp(0, Config.reverbRange, Math.round((Config.reverbRange - 1) * (instrumentObject["reverb"] | 0) / 100));
        } else {
            this.reverb = legacyGlobalReverb;
        }

        if (instrumentObject["upperNoteLimit"] != undefined) {
            this.upperNoteLimit = instrumentObject["upperNoteLimit"]
        }
        if (instrumentObject["lowerNoteLimit"] != undefined) {
            this.lowerNoteLimit = instrumentObject["lowerNoteLimit"]
        }

        if (Array.isArray(instrumentObject["plugin"])) {
            this.pluginValues = instrumentObject["plugin"];
        }

        if (instrumentObject["pulseWidth"] != undefined) {
            this.pulseWidth = clamp(1, Config.pulseWidthRange + 1, Math.round(instrumentObject["pulseWidth"]));
        } else {
            this.pulseWidth = Config.pulseWidthRange;
        }

        if (instrumentObject["decimalOffset"] != undefined) {
            this.decimalOffset = clamp(0, 99 + 1, Math.round(instrumentObject["decimalOffset"]));
        } else {
            this.decimalOffset = 0;
        }

        if (instrumentObject["dynamism"] != undefined) {
            this.supersawDynamism = clamp(0, Config.supersawDynamismMax + 1, Math.round(Config.supersawDynamismMax * (instrumentObject["dynamism"] | 0) / 100));
        } else {
            this.supersawDynamism = Config.supersawDynamismMax;
        }
        if (instrumentObject["spread"] != undefined) {
            this.supersawSpread = clamp(0, Config.supersawSpreadMax + 1, Math.round(Config.supersawSpreadMax * (instrumentObject["spread"] | 0) / 100));
        } else {
            this.supersawSpread = Math.ceil(Config.supersawSpreadMax / 2.0);
        }
        if (instrumentObject["shape"] != undefined) {
            this.supersawShape = clamp(0, Config.supersawShapeMax + 1, Math.round(Config.supersawShapeMax * (instrumentObject["shape"] | 0) / 100));
        } else {
            this.supersawShape = 0;
        }

        if (instrumentObject["harmonics"] != undefined) {
            for (let i: number = 0; i < Config.harmonicsControlPoints; i++) {
                this.harmonicsWave.harmonics[i] = Math.max(0, Math.min(Config.harmonicsMax, Math.round(Config.harmonicsMax * (+instrumentObject["harmonics"][i]) / 100)));
            }
            this.harmonicsWave.markCustomWaveDirty();
        } else {
            this.harmonicsWave.reset();
        }

        if (instrumentObject["spectrum"] != undefined) {
            for (let i: number = 0; i < Config.spectrumControlPoints; i++) {
                this.spectrumWave.spectrum[i] = Math.max(0, Math.min(Config.spectrumMax, Math.round(Config.spectrumMax * (+instrumentObject["spectrum"][i]) / 100)));
                this.spectrumWave.markCustomWaveDirty();
            }
        } else {
            this.spectrumWave.reset(isNoiseChannel);
        }

        if (instrumentObject["stringSustain"] != undefined) {
            this.stringSustain = clamp(0, Config.stringSustainRange, Math.round((Config.stringSustainRange - 1) * (instrumentObject["stringSustain"] | 0) / 100));
        } else {
            this.stringSustain = 10;
        }
        this.stringSustainType = Config.enableAcousticSustain ? Config.sustainTypeNames.indexOf(instrumentObject["stringSustainType"]) : SustainType.bright;
        if (<any>this.stringSustainType == -1) this.stringSustainType = SustainType.bright;

        if (this.type == InstrumentType.noise) {
            this.chipNoise = Config.chipNoises.findIndex(wave => wave.name == instrumentObject["wave"]);
            if (instrumentObject["wave"] == "pink noise") this.chipNoise = Config.chipNoises.findIndex(wave => wave.name == "pink");
            if (instrumentObject["wave"] == "brownian noise") this.chipNoise = Config.chipNoises.findIndex(wave => wave.name == "brownian");
            if (this.chipNoise == -1) this.chipNoise = 1;
        }

        const legacyEnvelopeNames: Dictionary<string> = { "custom": "note size", "steady": "none", "pluck 1": "twang 1", "pluck 2": "twang 2", "pluck 3": "twang 3" };
        const getEnvelope = (name: any): Envelope | undefined => {
            if (legacyEnvelopeNames[name] != undefined) return Config.envelopePresets.dictionary[legacyEnvelopeNames[name]];
            else {
                return Config.envelopePresets.dictionary[name];
            }
        }

        if (this.type == InstrumentType.drumset) {
            if (instrumentObject["drums"] != undefined) {
                for (let j: number = 0; j < Config.drumCount; j++) {
                    const drum: any = instrumentObject["drums"][j];
                    if (drum == undefined) continue;

                    this.drumsetEnvelopes[j] = Config.envelopePresets.dictionary["twang 2"].index; // default value.
                    if (drum["filterEnvelope"] != undefined) {
                        const envelope: Envelope | undefined = getEnvelope(drum["filterEnvelope"]);
                        if (envelope != undefined) this.drumsetEnvelopes[j] = envelope.index;
                    }
                    if (drum["spectrum"] != undefined) {
                        for (let i: number = 0; i < Config.spectrumControlPoints; i++) {
                            this.drumsetSpectrumWaves[j].spectrum[i] = Math.max(0, Math.min(Config.spectrumMax, Math.round(Config.spectrumMax * (+drum["spectrum"][i]) / 100)));
                        }
                    }
                    this.drumsetSpectrumWaves[j].markCustomWaveDirty();
                }
            }
        }

        if (this.type == InstrumentType.chip) {
            const legacyWaveNames: Dictionary<number> = { "triangle": 1, "square": 2, "pulse wide": 3, "pulse narrow": 4, "sawtooth": 5, "double saw": 6, "double pulse": 7, "spiky": 8, "plateau": 0 };
            const modboxWaveNames: Dictionary<number> = { "10% pulse": 22, "sunsoft bass": 23, "loud pulse": 24, "sax": 25, "guitar": 26, "atari bass": 28, "atari pulse": 29, "1% pulse": 30, "curved sawtooth": 31, "viola": 32, "brass": 33, "acoustic bass": 34, "lyre": 35, "ramp pulse": 36, "piccolo": 37, "squaretooth": 38, "flatline": 39, "pnryshk a (u5)": 40, "pnryshk b (riff)": 41 };
            const sandboxWaveNames: Dictionary<number> = { "shrill lute": 42, "shrill bass": 44, "nes pulse": 45, "saw bass": 46, "euphonium": 47, "shrill pulse": 48, "r-sawtooth": 49, "recorder": 50, "narrow saw": 51, "deep square": 52, "ring pulse": 53, "double sine": 54, "contrabass": 55, "double bass": 56 };
            const zefboxWaveNames: Dictionary<number> = { "semi-square": 63, "deep square": 64, "squaretal": 40, "saw wide": 65, "saw narrow ": 66, "deep sawtooth": 67, "sawtal": 68, "pulse": 69, "triple pulse": 70, "high pulse": 71, "deep pulse": 72 };
            const miscWaveNames: Dictionary<number> = { "test1": 56, "pokey 4bit lfsr": 57, "pokey 5step bass": 58, "isolated spiky": 59, "unnamed 1": 60, "unnamed 2": 61, "guitar string": 75, "intense": 76, "buzz wave": 77, "pokey square": 57, "pokey bass": 58, "banana wave": 83, "test 1": 84, "test 2": 84, "real snare": 85, "earthbound o. guitar": 86 };
            const paandorasboxWaveNames: Dictionary<number> = { "kick": 87, "snare": 88, "piano1": 89, "WOW": 90, "overdrive": 91, "trumpet": 92, "saxophone": 93, "orchestrahit": 94, "detached violin": 95, "synth": 96, "sonic3snare": 97, "come on": 98, "choir": 99, "overdriveguitar": 100, "flute": 101, "legato violin": 102, "tremolo violin": 103, "amen break": 104, "pizzicato violin": 105, "tim allen grunt": 106, "tuba": 107, "loopingcymbal": 108, "standardkick": 109, "standardsnare": 110, "closedhihat": 111, "foothihat": 112, "openhihat": 113, "crashcymbal": 114, "pianoC4": 115, "liver pad": 116, "marimba": 117, "susdotwav": 118, "wackyboxtts": 119 };
            // const paandorasbetaWaveNames = {"contrabass": 55, "double bass": 56 };
            //this.chipWave = legacyWaveNames[instrumentObject["wave"]] != undefined ? legacyWaveNames[instrumentObject["wave"]] : Config.chipWaves.findIndex(wave => wave.name == instrumentObject["wave"]);
            this.chipWave = -1;
            const rawName: string = instrumentObject["wave"];
            for (const table of [
                legacyWaveNames,
                modboxWaveNames,
                sandboxWaveNames,
                zefboxWaveNames,
                miscWaveNames,
                paandorasboxWaveNames
            ]) {
                if (this.chipWave == -1 && table[rawName] != undefined && Config.chipWaves[table[rawName]] != undefined) {
                    this.chipWave = table[rawName];
                    break;
                }
            }
            if (this.chipWave == -1) {
                const potentialChipWaveIndex: number = Config.chipWaves.findIndex(wave => wave.name == rawName);
                if (potentialChipWaveIndex != -1) this.chipWave = potentialChipWaveIndex;
            }
            // this.chipWave = legacyWaveNames[instrumentObject["wave"]] != undefined ? legacyWaveNames[instrumentObject["wave"]] : modboxWaveNames[instrumentObject["wave"]] != undefined ? modboxWaveNames[instrumentObject["wave"]] : sandboxWaveNames[instrumentObject["wave"]] != undefined ? sandboxWaveNames[instrumentObject["wave"]] : zefboxWaveNames[instrumentObject["wave"]] != undefined ? zefboxWaveNames[instrumentObject["wave"]] : miscWaveNames[instrumentObject["wave"]] != undefined ? miscWaveNames[instrumentObject["wave"]] : paandorasboxWaveNames[instrumentObject["wave"]] != undefined ? paandorasboxWaveNames[instrumentObject["wave"]] : Config.chipWaves.findIndex(wave => wave.name == instrumentObject["wave"]); 
            if (this.chipWave == -1) this.chipWave = 1;
        }

        if (this.type == InstrumentType.fm || this.type == InstrumentType.fm6op) {
            if (this.type == InstrumentType.fm) {
                this.algorithm = Config.algorithms.findIndex(algorithm => algorithm.name == instrumentObject["algorithm"]);
                if (this.algorithm == -1) this.algorithm = 0;
                this.feedbackType = Config.feedbacks.findIndex(feedback => feedback.name == instrumentObject["feedbackType"]);
                if (this.feedbackType == -1) this.feedbackType = 0;
            } else {
                this.algorithm6Op = Config.algorithms6Op.findIndex(algorithm6Op => algorithm6Op.name == instrumentObject["algorithm"]);
                if (this.algorithm6Op == -1) this.algorithm6Op = 1;
                if (this.algorithm6Op == 0) {
                    this.customAlgorithm.set(instrumentObject["customAlgorithm"]["carrierCount"], instrumentObject["customAlgorithm"]["mods"]);
                } else {
                    this.customAlgorithm.fromPreset(this.algorithm6Op);
                }
                this.feedbackType6Op = Config.feedbacks6Op.findIndex(feedback6Op => feedback6Op.name == instrumentObject["feedbackType"]);
                // SynthBox feedback support
                if (this.feedbackType6Op == -1) {
                    // These are all of the SynthBox feedback presets that aren't present in Gold/UltraBox
                    let synthboxLegacyFeedbacks: DictionaryArray<any> = toNameMap([
                        { name: "2⟲ 3⟲", indices: [[], [2], [3], [], [], []] },
                        { name: "3⟲ 4⟲", indices: [[], [], [3], [4], [], []] },
                        { name: "4⟲ 5⟲", indices: [[], [], [], [4], [5], []] },
                        { name: "5⟲ 6⟲", indices: [[], [], [], [], [5], [6]] },
                        { name: "1⟲ 6⟲", indices: [[1], [], [], [], [], [6]] },
                        { name: "1⟲ 3⟲", indices: [[1], [], [3], [], [], []] },
                        { name: "1⟲ 4⟲", indices: [[1], [], [], [4], [], []] },
                        { name: "1⟲ 5⟲", indices: [[1], [], [], [], [5], []] },
                        { name: "4⟲ 6⟲", indices: [[], [], [], [4], [], [6]] },
                        { name: "2⟲ 6⟲", indices: [[], [2], [], [], [], [6]] },
                        { name: "3⟲ 6⟲", indices: [[], [], [3], [], [], [6]] },
                        { name: "4⟲ 5⟲ 6⟲", indices: [[], [], [], [4], [5], [6]] },
                        { name: "1⟲ 3⟲ 6⟲", indices: [[1], [], [3], [], [], [6]] },
                        { name: "2→5", indices: [[], [], [], [], [2], []] },
                        { name: "2→6", indices: [[], [], [], [], [], [2]] },
                        { name: "3→5", indices: [[], [], [], [], [3], []] },
                        { name: "3→6", indices: [[], [], [], [], [], [3]] },
                        { name: "4→6", indices: [[], [], [], [], [], [4]] },
                        { name: "5→6", indices: [[], [], [], [], [], [5]] },
                        { name: "1→3→4", indices: [[], [], [1], [], [3], []] },
                        { name: "2→5→6", indices: [[], [], [], [], [2], [5]] },
                        { name: "2→4→6", indices: [[], [], [], [2], [], [4]] },
                        { name: "4→5→6", indices: [[], [], [], [], [4], [5]] },
                        { name: "3→4→5→6", indices: [[], [], [], [3], [4], [5]] },
                        { name: "2→3→4→5→6", indices: [[], [1], [2], [3], [4], [5]] },
                        { name: "1→2→3→4→5→6", indices: [[], [1], [2], [3], [4], [5]] },
                    ]);

                    let synthboxFeedbackType = synthboxLegacyFeedbacks[synthboxLegacyFeedbacks.findIndex(feedback => feedback.name == instrumentObject["feedbackType"])]!.indices;

                    if (synthboxFeedbackType != undefined) {
                        this.feedbackType6Op = 0;
                        this.customFeedbackType.set(synthboxFeedbackType);
                    } else {
                        // if the feedback type STILL can't be resolved, default to the first non-custom option
                        this.feedbackType6Op = 1;
                    }
                }

                if ((this.feedbackType6Op == 0) && (instrumentObject["customFeedback"] != undefined)) {
                    this.customFeedbackType.set(instrumentObject["customFeedback"]["mods"]);
                } else {
                    this.customFeedbackType.fromPreset(this.feedbackType6Op);
                }
            }
            if (instrumentObject["feedbackAmplitude"] != undefined) {
                this.feedbackAmplitude = clamp(0, Config.operatorAmplitudeMax + 1, instrumentObject["feedbackAmplitude"] | 0);
            } else {
                this.feedbackAmplitude = 0;
            }

            for (let j: number = 0; j < Config.operatorCount + (this.type == InstrumentType.fm6op ? 2 : 0); j++) {
                const operator: Operator = this.operators[j];
                let operatorObject: any = undefined;
                if (instrumentObject["operators"] != undefined) operatorObject = instrumentObject["operators"][j];
                if (operatorObject == undefined) operatorObject = {};

                operator.frequency = Config.operatorFrequencies.findIndex(freq => freq.name == operatorObject["frequency"]);
                if (operator.frequency == -1) operator.frequency = 0;
                if (operatorObject["amplitude"] != undefined) {
                    operator.amplitude = clamp(0, Config.operatorAmplitudeMax + 1, operatorObject["amplitude"] | 0);
                } else {
                    operator.amplitude = 0;
                }
                if (operatorObject["waveform"] != undefined) {
                    // If the json is from GB, we override the last two waves to be sine to account for a bug
                    if (format == "goldbox" && j > 3) {
                        operator.waveform = 0;
                        continue;
                    }

                    operator.waveform = Config.operatorWaves.findIndex(wave => wave.name == operatorObject["waveform"]);
                    if (operator.waveform == -1) {
                        // GoldBox compatibility
                        if (operatorObject["waveform"] == "square") {
                            operator.waveform = Config.operatorWaves.dictionary["pulse width"].index;
                            operator.pulseWidth = 5;
                        } else if (operatorObject["waveform"] == "rounded") {
                            operator.waveform = Config.operatorWaves.dictionary["quasi-sine"].index;
                        } else {
                            operator.waveform = 0;
                        }

                    }
                } else {
                    operator.waveform = 0;
                }
                if (operatorObject["pulseWidth"] != undefined) {
                    operator.pulseWidth = operatorObject["pulseWidth"] | 0;
                } else {
                    operator.pulseWidth = 5;
                }
            }
        } else if (this.type == InstrumentType.customChipWave) {
            if (instrumentObject["customChipWave"]) {

                for (let i: number = 0; i < 64; i++) {
                    this.customChipWave[i] = instrumentObject["customChipWave"][i];
                }


                let sum: number = 0.0;
                for (let i: number = 0; i < this.customChipWave.length; i++) {
                    sum += this.customChipWave[i];
                }
                const average: number = sum / this.customChipWave.length;

                // Perform the integral on the wave. The chipSynth will perform the derivative to get the original wave back but with antialiasing.
                let cumulative: number = 0;
                let wavePrev: number = 0;
                for (let i: number = 0; i < this.customChipWave.length; i++) {
                    cumulative += wavePrev;
                    wavePrev = this.customChipWave[i] - average;
                    this.customChipWaveIntegral[i] = cumulative;
                }

                // 65th, last sample is for anti-aliasing
                this.customChipWaveIntegral[64] = 0.0;
            }
        } else if (this.type == InstrumentType.mod) {
            if (instrumentObject["modChannels"] != undefined) {
                for (let mod: number = 0; mod < Config.modCount; mod++) {
                    this.modChannels[mod] = instrumentObject["modChannels"][mod];
                    this.modInstruments[mod] = instrumentObject["modInstruments"][mod];
                    this.modulators[mod] = instrumentObject["modSettings"][mod];
                    // Due to an oversight, this isn't included in JSONs prior to JB 2.6.
                    if (instrumentObject["modFilterTypes"] != undefined)
                        this.modFilterTypes[mod] = instrumentObject["modFilterTypes"][mod];
                    if (instrumentObject["modEnvelopeNumbers"] != undefined)
                        this.modEnvelopeNumbers[mod] = instrumentObject["modEnvelopeNumbers"][mod];
                }
            }
        }

        if (this.type != InstrumentType.mod) {
            // Arpeggio speed
            if (this.chord == Config.chords.dictionary["arpeggio"].index && instrumentObject["arpeggioSpeed"] != undefined) {
                this.arpeggioSpeed = instrumentObject["arpeggioSpeed"];
            } else {
                this.arpeggioSpeed = (useSlowerRhythm) ? 9 : 12; // Decide whether to import arps as x3/4 speed
            }
            if (this.chord == Config.chords.dictionary["monophonic"].index && instrumentObject["monoChordTone"] != undefined) {
                this.monoChordTone = instrumentObject["monoChordTone"];
            }

            if (instrumentObject["fastTwoNoteArp"] != undefined) {
                this.fastTwoNoteArp = instrumentObject["fastTwoNoteArp"];
            } else {
                this.fastTwoNoteArp = useFastTwoNoteArp;
            }

            if (instrumentObject["clicklessTransition"] != undefined) {
                this.clicklessTransition = instrumentObject["clicklessTransition"];
            } else {
                this.clicklessTransition = false;
            }

            if (instrumentObject["aliases"] != undefined) {
                this.aliases = instrumentObject["aliases"];
            } else {
                // modbox had no anti-aliasing, so enable it for everything if that mode is selected
                if (format == "modbox") {
                    this.effects = (this.effects | (1 << EffectType.distortion));
                    this.aliases = true;
                    this.distortion = 0;
                } else {
                    this.aliases = false;
                }
            }

            if (instrumentObject["noteFilterType"] != undefined) {
                this.noteFilterType = instrumentObject["noteFilterType"];
            }
            if (instrumentObject["noteSimpleCut"] != undefined) {
                this.noteFilterSimpleCut = instrumentObject["noteSimpleCut"];
            }
            if (instrumentObject["noteSimplePeak"] != undefined) {
                this.noteFilterSimplePeak = instrumentObject["noteSimplePeak"];
            }
            if (instrumentObject["noteFilter"] != undefined) {
                this.noteFilter.fromJsonObject(instrumentObject["noteFilter"]);
            } else {
                this.noteFilter.reset();
            }
            for (let i: number = 0; i < Config.filterMorphCount; i++) {
                if (Array.isArray(instrumentObject["noteSubFilters" + i])) {
                    this.noteSubFilters[i] = new FilterSettings();
                    this.noteSubFilters[i]!.fromJsonObject(instrumentObject["noteSubFilters" + i]);
                }
            }
            if (instrumentObject["eqFilterType"] != undefined) {
                this.eqFilterType = instrumentObject["eqFilterType"];
            }
            if (instrumentObject["eqSimpleCut"] != undefined) {
                this.eqFilterSimpleCut = instrumentObject["eqSimpleCut"];
            }
            if (instrumentObject["eqSimplePeak"] != undefined) {
                this.eqFilterSimplePeak = instrumentObject["eqSimplePeak"];
            }
            if (Array.isArray(instrumentObject["eqFilter"])) {
                this.eqFilter.fromJsonObject(instrumentObject["eqFilter"]);
            } else {
                this.eqFilter.reset();

                const legacySettings: LegacySettings = {};

                // Try converting from legacy filter settings.
                const filterCutoffMaxHz: number = 8000;
                const filterCutoffRange: number = 11;
                const filterResonanceRange: number = 8;
                if (instrumentObject["filterCutoffHz"] != undefined) {
                    legacySettings.filterCutoff = clamp(0, filterCutoffRange, Math.round((filterCutoffRange - 1) + 2.0 * Math.log((instrumentObject["filterCutoffHz"] | 0) / filterCutoffMaxHz) / Math.LN2));
                } else {
                    legacySettings.filterCutoff = (this.type == InstrumentType.chip) ? 6 : 10;
                }
                if (instrumentObject["filterResonance"] != undefined) {
                    legacySettings.filterResonance = clamp(0, filterResonanceRange, Math.round((filterResonanceRange - 1) * (instrumentObject["filterResonance"] | 0) / 100));
                } else {
                    legacySettings.filterResonance = 0;
                }

                legacySettings.filterEnvelope = getEnvelope(instrumentObject["filterEnvelope"]);
                legacySettings.pulseEnvelope = getEnvelope(instrumentObject["pulseEnvelope"]);
                legacySettings.feedbackEnvelope = getEnvelope(instrumentObject["feedbackEnvelope"]);
                if (Array.isArray(instrumentObject["operators"])) {
                    legacySettings.operatorEnvelopes = [];
                    for (let j: number = 0; j < Config.operatorCount + (this.type == InstrumentType.fm6op ? 2 : 0); j++) {
                        let envelope: Envelope | undefined;
                        if (instrumentObject["operators"][j] != undefined) {
                            envelope = getEnvelope(instrumentObject["operators"][j]["envelope"]);
                        }
                        legacySettings.operatorEnvelopes[j] = (envelope != undefined) ? envelope : Config.envelopePresets.dictionary["none"];
                    }
                }

                // Try converting from even older legacy filter settings.
                if (instrumentObject["filter"] != undefined) {
                    const legacyToCutoff: number[] = [10, 6, 3, 0, 8, 5, 2];
                    const legacyToEnvelope: string[] = ["none", "none", "none", "none", "decay 1", "decay 2", "decay 3"];
                    const filterNames: string[] = ["none", "bright", "medium", "soft", "decay bright", "decay medium", "decay soft"];
                    const oldFilterNames: Dictionary<number> = { "sustain sharp": 1, "sustain medium": 2, "sustain soft": 3, "decay sharp": 4 };
                    let legacyFilter: number = oldFilterNames[instrumentObject["filter"]] != undefined ? oldFilterNames[instrumentObject["filter"]] : filterNames.indexOf(instrumentObject["filter"]);
                    if (legacyFilter == -1) legacyFilter = 0;
                    legacySettings.filterCutoff = legacyToCutoff[legacyFilter];
                    legacySettings.filterEnvelope = getEnvelope(legacyToEnvelope[legacyFilter]);
                    legacySettings.filterResonance = 0;
                }

                this.convertLegacySettings(legacySettings, true);
            }

            for (let i: number = 0; i < Config.filterMorphCount; i++) {
                if (Array.isArray(instrumentObject["eqSubFilters" + i])) {
                    this.eqSubFilters[i] = new FilterSettings();
                    this.eqSubFilters[i]!.fromJsonObject(instrumentObject["eqSubFilters" + i]);
                }
            }

            if (Array.isArray(instrumentObject["envelopes"])) {
                const envelopeArray: any[] = instrumentObject["envelopes"];
                for (let i = 0; i < envelopeArray.length; i++) {
                    if (this.envelopeCount >= Config.maxEnvelopeCount) break;
                    const tempEnvelope: EnvelopeSettings = new EnvelopeSettings(this.isNoiseInstrument);
                    tempEnvelope.fromJsonObject(envelopeArray[i], format);
                    //old pitch envelope detection
                    let pitchEnvelopeStart: number;
                    if (instrumentObject["pitchEnvelopeStart"] != undefined && instrumentObject["pitchEnvelopeStart"] != null) { //make sure is not null bc for some reason it can be
                        pitchEnvelopeStart = instrumentObject["pitchEnvelopeStart"];
                    } else if (instrumentObject["pitchEnvelopeStart" + i] != undefined && instrumentObject["pitchEnvelopeStart" + i] != undefined) {
                        pitchEnvelopeStart = instrumentObject["pitchEnvelopeStart" + i];
                    } else {
                        pitchEnvelopeStart = tempEnvelope.pitchEnvelopeStart;
                    }
                    let pitchEnvelopeEnd: number;
                    if (instrumentObject["pitchEnvelopeEnd"] != undefined && instrumentObject["pitchEnvelopeEnd"] != null) {
                        pitchEnvelopeEnd = instrumentObject["pitchEnvelopeEnd"];
                    } else if (instrumentObject["pitchEnvelopeEnd" + i] != undefined && instrumentObject["pitchEnvelopeEnd" + i] != null) {
                        pitchEnvelopeEnd = instrumentObject["pitchEnvelopeEnd" + i];
                    } else {
                        pitchEnvelopeEnd = tempEnvelope.pitchEnvelopeEnd;
                    }
                    let envelopeInverse: boolean;
                    if (instrumentObject["envelopeInverse" + i] != undefined && instrumentObject["envelopeInverse" + i] != null) {
                        envelopeInverse = instrumentObject["envelopeInverse" + i];
                    } else if (instrumentObject["pitchEnvelopeInverse"] != undefined && instrumentObject["pitchEnvelopeInverse"] != null && Config.envelopePresets[tempEnvelope.envelope].name == "pitch") { //assign only if a pitch envelope
                        envelopeInverse = instrumentObject["pitchEnvelopeInverse"];
                    } else {
                        envelopeInverse = tempEnvelope.inverse;
                    }
                    let discreteEnvelope: boolean;
                    if (instrumentObject["discreteEnvelope"] != undefined) {
                        discreteEnvelope = instrumentObject["discreteEnvelope"];
                    } else {
                        discreteEnvelope = tempEnvelope.discrete;
                    }
                    this.addEnvelope(tempEnvelope.target, tempEnvelope.index, tempEnvelope.envelope, true, pitchEnvelopeStart, pitchEnvelopeEnd, envelopeInverse, tempEnvelope.perEnvelopeSpeed, tempEnvelope.perEnvelopeLowerBound, tempEnvelope.perEnvelopeUpperBound, tempEnvelope.steps, tempEnvelope.seed, tempEnvelope.waveform, discreteEnvelope);
                }
            }
        }
        if (type === 0) {
            if (instrumentObject["isUsingAdvancedLoopControls"] != undefined) {
                this.isUsingAdvancedLoopControls = instrumentObject["isUsingAdvancedLoopControls"];
                this.chipWaveLoopStart = instrumentObject["chipWaveLoopStart"];
                this.chipWaveLoopEnd = instrumentObject["chipWaveLoopEnd"];
                this.chipWaveLoopMode = instrumentObject["chipWaveLoopMode"];
                this.chipWavePlayBackwards = instrumentObject["chipWavePlayBackwards"];
                this.chipWaveStartOffset = instrumentObject["chipWaveStartOffset"];
            } else {
                this.isUsingAdvancedLoopControls = false;
                this.chipWaveLoopStart = 0;
                this.chipWaveLoopEnd = Config.rawRawChipWaves[this.chipWave].samples.length - 1;
                this.chipWaveLoopMode = 0;
                this.chipWavePlayBackwards = false;
                this.chipWaveStartOffset = 0;
            }
        }
	}	
    

    public getLargestControlPointCount(forNoteFilter: boolean) {
        let largest: number;
        if (forNoteFilter) {
            largest = this.noteFilter.controlPointCount;
            for (let i: number = 0; i < Config.filterMorphCount; i++) {
                if (this.noteSubFilters[i] != null && this.noteSubFilters[i]!.controlPointCount > largest)
                    largest = this.noteSubFilters[i]!.controlPointCount;
            }
        }
        else {
            largest = this.eqFilter.controlPointCount;
            for (let i: number = 0; i < Config.filterMorphCount; i++) {
                if (this.eqSubFilters[i] != null && this.eqSubFilters[i]!.controlPointCount > largest)
                    largest = this.eqSubFilters[i]!.controlPointCount;
            }
        }
        return largest;
    }

    public static frequencyFromPitch(pitch: number): number {
        return 440.0 * Math.pow(2.0, (pitch - 69.0) / 12.0);
    }

    public addEnvelope(target: number, index: number, envelope: number, newEnvelopes: boolean, start: number = 0, end: number = -1, inverse: boolean = false, perEnvelopeSpeed: number = -1, perEnvelopeLowerBound: number = 0, perEnvelopeUpperBound: number = 1, steps: number = 2, seed: number = 2, waveform: number = LFOEnvelopeTypes.sine, discrete: boolean = false): void {
        end = end != -1 ? end : this.isNoiseInstrument ? Config.drumCount - 1 : Config.maxPitch; //find default if none is given
        perEnvelopeSpeed = perEnvelopeSpeed != -1 ? perEnvelopeSpeed : newEnvelopes ? 1 : Config.envelopePresets[envelope].speed; //find default if none is given
        let makeEmpty: boolean = false;
        if (!this.supportsEnvelopeTarget(target, index)) makeEmpty = true;
        if (this.envelopeCount >= Config.maxEnvelopeCount) throw new Error();
        while (this.envelopes.length <= this.envelopeCount) this.envelopes[this.envelopes.length] = new EnvelopeSettings(this.isNoiseInstrument);
        const envelopeSettings: EnvelopeSettings = this.envelopes[this.envelopeCount];
        envelopeSettings.target = makeEmpty ? Config.instrumentAutomationTargets.dictionary["none"].index : target;
        envelopeSettings.index = makeEmpty ? 0 : index;
        if (!newEnvelopes) {
            envelopeSettings.envelope = clamp(0, Config.envelopes.length, Config.envelopePresets[envelope].type);
        } else {
            envelopeSettings.envelope = envelope;
        }
        envelopeSettings.pitchEnvelopeStart = start;
        envelopeSettings.pitchEnvelopeEnd = end;
        envelopeSettings.inverse = inverse;
        envelopeSettings.perEnvelopeSpeed = perEnvelopeSpeed;
        envelopeSettings.perEnvelopeLowerBound = perEnvelopeLowerBound;
        envelopeSettings.perEnvelopeUpperBound = perEnvelopeUpperBound;
        envelopeSettings.steps = steps;
        envelopeSettings.seed = seed;
        envelopeSettings.waveform = waveform;
        envelopeSettings.discrete = discrete;
        this.envelopeCount++;
    }

    public supportsEnvelopeTarget(target: number, index: number): boolean {
        const automationTarget: AutomationTarget = Config.instrumentAutomationTargets[target];
        if (automationTarget.computeIndex == null && automationTarget.name != "none") {
            return false;
        }
        if (index >= automationTarget.maxCount) {
            return false;
        }
        if (automationTarget.compatibleInstruments != null && automationTarget.compatibleInstruments.indexOf(this.type) == -1) {
            return false;
        }
        if (automationTarget.effect != null && (this.effects & (1 << automationTarget.effect)) == 0) {
            return false;
        }
        if (automationTarget.name == "arpeggioSpeed") {
            return effectsIncludeChord(this.effects) && this.chord == Config.chords.dictionary["arpeggio"].index;
        }
        if (automationTarget.isFilter) {
            //if (automationTarget.perNote) {
            let useControlPointCount: number = this.noteFilter.controlPointCount;
            if (this.noteFilterType)
                useControlPointCount = 1;
            if (index >= useControlPointCount) return false;
            //} else {
            //	if (index >= this.eqFilter.controlPointCount)   return false;
            //}
        }
        if ((automationTarget.name == "operatorFrequency") || (automationTarget.name == "operatorAmplitude")) {
            if (index >= 4 + (this.type == InstrumentType.fm6op ? 2 : 0)) return false;
        }
        return true;
    }

    public clearInvalidEnvelopeTargets(): void {
        for (let envelopeIndex: number = 0; envelopeIndex < this.envelopeCount; envelopeIndex++) {
            const target: number = this.envelopes[envelopeIndex].target;
            const index: number = this.envelopes[envelopeIndex].index;
            if (!this.supportsEnvelopeTarget(target, index)) {
                this.envelopes[envelopeIndex].target = Config.instrumentAutomationTargets.dictionary["none"].index;
                this.envelopes[envelopeIndex].index = 0;
            }
        }
    }

    public getTransition(): Transition {
        return effectsIncludeTransition(this.effects) ? Config.transitions[this.transition] :
            (this.type == InstrumentType.mod ? Config.transitions.dictionary["interrupt"] : Config.transitions.dictionary["normal"]);
    }

    public getFadeInSeconds(): number {
        return (this.type == InstrumentType.drumset) ? 0.0 : SynthMessenger.fadeInSettingToSeconds(this.fadeIn);
    }

    public getFadeOutTicks(): number {
        return (this.type == InstrumentType.drumset) ? Config.drumsetFadeOutTicks : SynthMessenger.fadeOutSettingToTicks(this.fadeOut)
    }

    public getChord(): Chord {
        return effectsIncludeChord(this.effects) ? Config.chords[this.chord] : Config.chords.dictionary["simultaneous"];
    }

    public getDrumsetEnvelope(pitch: number): Envelope {
        if (this.type != InstrumentType.drumset) throw new Error("Can't getDrumsetEnvelope() for non-drumset.");
        return Config.envelopePresets[this.drumsetEnvelopes[pitch]];
    }
}

export class Channel {
    public octave: number = 0;
    public readonly instruments: Instrument[] = [];
    public readonly patterns: Pattern[] = [];
    public readonly bars: number[] = [];
    public muted: boolean = false;
    public name: string = "";
}

export class Song {
    private static readonly _format: string = Config.jsonFormat;
    private static readonly _oldestBeepboxVersion: number = 2;
    private static readonly _latestBeepboxVersion: number = 9;
    private static readonly _oldestJummBoxVersion: number = 1;
    private static readonly _latestJummBoxVersion: number = 6;
    private static readonly _oldestGoldBoxVersion: number = 1;
    private static readonly _latestGoldBoxVersion: number = 4;
    private static readonly _oldestUltraBoxVersion: number = 1;
    private static readonly _latestUltraBoxVersion: number = 5;
    private static readonly _oldestSlarmoosBoxVersion: number = 1;
    private static readonly _latestSlarmoosBoxVersion: number = 6;
    // One-character variant detection at the start of URL to distinguish variants such as JummBox, Or Goldbox. "j" and "g" respectively
    //also "u" is ultrabox lol
    private static readonly _variant = 0x73; //"s" ~ slarmoo's box

    public title: string;
    public scale: number;
    public scaleCustom: boolean[] = [];
    public key: number;
    public octave: number;
    public tempo: number;
    public reverb: number;
    public beatsPerBar: number;
    public barCount: number;
    public patternsPerChannel: number;
    public rhythm: number;
    public layeredInstruments: boolean;
    public patternInstruments: boolean;
    public loopStart: number;
    public loopLength: number;
    public pitchChannelCount: number;
    public noiseChannelCount: number;
    public modChannelCount: number;
    public readonly channels: Channel[] = [];
    public limitDecay: number = 4.0;
    public limitRise: number = 4000.0;
    public compressionThreshold: number = 1.0;
    public limitThreshold: number = 1.0;
    public compressionRatio: number = 1.0;
    public limitRatio: number = 1.0;
    public masterGain: number = 1.0;
    public inVolumeCap: number = 0.0;
    public outVolumeCap: number = 0.0;
    public eqFilter: FilterSettings = new FilterSettings();
    public eqFilterType: boolean = false;
    public eqFilterSimpleCut: number = Config.filterSimpleCutRange - 1;
    public eqFilterSimplePeak: number = 0;
    public eqSubFilters: (FilterSettings | null)[] = [];
    public tmpEqFilterStart: FilterSettings | null;
    public tmpEqFilterEnd: FilterSettings | null;
    public sequences: SequenceSettings[] = [new SequenceSettings()];
    public pluginurl: string | null = null;

    

    constructor(string?: string,
        private updateSynthSamplesStart?: (name: string, expression: number, isCustomSampled: boolean, isPercussion: boolean, rootKey: number, sampleRate: number, index: number) => void,
        private updateSynthSamplesFinish?: (samples: Float32Array, index: number) => void,
        private updateSynthPlugin?: (names: string[], instrumentStateFunction: string, synthFunction: string, effectOrder: number[] | number, delayLineSize: number) => void
) {
        if (string != undefined) {
            this.fromBase64String(string);
        } else {
            this.initToDefault(true);
        }
    }

    // Returns the ideal new note volume when dragging (max volume for a normal note, a "neutral" value for mod notes based on how they work)
    public getNewNoteVolume = (isMod: boolean, modChannel?: number, modInstrument?: number, modCount?: number): number => {
        if (!isMod || modChannel == undefined || modInstrument == undefined || modCount == undefined)
            return Config.noteSizeMax;
        else {
            // Sigh, the way pitches count up and the visual ordering in the UI are flipped.
            modCount = Config.modCount - modCount - 1;

            const instrument: Instrument = this.channels[modChannel].instruments[modInstrument];
            let vol: number | undefined = Config.modulators[instrument.modulators[modCount]].newNoteVol;

            let currentIndex: number = instrument.modulators[modCount];
            // For tempo, actually use user defined tempo
            let tempoIndex: number = Config.modulators.dictionary["tempo"].index;
            if (currentIndex == tempoIndex) vol = this.tempo - Config.modulators[tempoIndex].convertRealFactor;
            //for effects and envelopes, use the user defined value of the selected instrument (or the default value if all or active is selected)
            if (!Config.modulators[currentIndex].forSong && instrument.modInstruments[modCount] < this.channels[instrument.modChannels[modCount]].instruments.length) {
                let chorusIndex: number = Config.modulators.dictionary["chorus"].index;
                let reverbIndex: number = Config.modulators.dictionary["reverb"].index;
                let panningIndex: number = Config.modulators.dictionary["pan"].index;
                let panDelayIndex: number = Config.modulators.dictionary["pan delay"].index;
                let distortionIndex: number = Config.modulators.dictionary["distortion"].index;
                let detuneIndex: number = Config.modulators.dictionary["detune"].index;
                let vibratoDepthIndex: number = Config.modulators.dictionary["vibrato depth"].index;
                let vibratoSpeedIndex: number = Config.modulators.dictionary["vibrato speed"].index;
                let vibratoDelayIndex: number = Config.modulators.dictionary["vibrato delay"].index;
                let arpSpeedIndex: number = Config.modulators.dictionary["arp speed"].index;
                let bitCrushIndex: number = Config.modulators.dictionary["bit crush"].index;
                let freqCrushIndex: number = Config.modulators.dictionary["freq crush"].index;
                let echoIndex: number = Config.modulators.dictionary["echo"].index;
                let echoDelayIndex: number = Config.modulators.dictionary["echo delay"].index;
                let pitchShiftIndex: number = Config.modulators.dictionary["pitch shift"].index;
                let ringModIndex: number = Config.modulators.dictionary["ring modulation"].index;
                let ringModHertzIndex: number = Config.modulators.dictionary["ring mod hertz"].index;
                let granularIndex: number = Config.modulators.dictionary["granular"].index;
                let grainAmountIndex: number = Config.modulators.dictionary["grain freq"].index;
                let grainSizeIndex: number = Config.modulators.dictionary["grain size"].index;
                let grainRangeIndex: number = Config.modulators.dictionary["grain range"].index;
                let envSpeedIndex: number = Config.modulators.dictionary["envelope speed"].index;
                let perEnvSpeedIndex: number = Config.modulators.dictionary["individual envelope speed"].index;
                let perEnvLowerIndex: number = Config.modulators.dictionary["individual envelope lower bound"].index;
                let perEnvUpperIndex: number = Config.modulators.dictionary["individual envelope upper bound"].index;
                let instrumentIndex: number = instrument.modInstruments[modCount];

                switch (currentIndex) {
                    case chorusIndex:
                        vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].chorus - Config.modulators[chorusIndex].convertRealFactor;
                        break;
                    case reverbIndex:
                        vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].reverb - Config.modulators[reverbIndex].convertRealFactor;
                        break;
                    case panningIndex:
                        vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].pan - Config.modulators[panningIndex].convertRealFactor;
                        break;
                    case panDelayIndex:
                        vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].panDelay - Config.modulators[panDelayIndex].convertRealFactor;
                        break;
                    case distortionIndex:
                        vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].distortion - Config.modulators[distortionIndex].convertRealFactor;
                        break;
                    case detuneIndex:
                        vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].detune;
                        break;
                    case vibratoDepthIndex:
                        vol = Math.round(this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].vibratoDepth * 25 - Config.modulators[vibratoDepthIndex].convertRealFactor);
                        break;
                    case vibratoSpeedIndex:
                        vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].vibratoSpeed - Config.modulators[vibratoSpeedIndex].convertRealFactor;
                        break;
                    case vibratoDelayIndex:
                        vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].vibratoDelay - Config.modulators[vibratoDelayIndex].convertRealFactor;
                        break;
                    case arpSpeedIndex:
                        vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].arpeggioSpeed - Config.modulators[arpSpeedIndex].convertRealFactor;
                        break;
                    case bitCrushIndex:
                        vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].bitcrusherQuantization - Config.modulators[bitCrushIndex].convertRealFactor;
                        break;
                    case freqCrushIndex:
                        vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].bitcrusherFreq - Config.modulators[freqCrushIndex].convertRealFactor;
                        break;
                    case echoIndex:
                        vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].echoSustain - Config.modulators[echoIndex].convertRealFactor;
                        break;
                    case echoDelayIndex:
                        vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].echoDelay - Config.modulators[echoDelayIndex].convertRealFactor;
                        break;
                    case pitchShiftIndex:
                        vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].pitchShift;
                        break;
                    case ringModIndex:
                        vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].ringModulation - Config.modulators[ringModIndex].convertRealFactor;
                        break;
                    case ringModHertzIndex:
                        vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].ringModulationHz - Config.modulators[ringModHertzIndex].convertRealFactor;
                        break;
                    case granularIndex:
                        vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].granular - Config.modulators[granularIndex].convertRealFactor;
                        break;
                    case grainAmountIndex:
                        vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].grainFreq - Config.modulators[grainAmountIndex].convertRealFactor;
                        break;
                    case grainSizeIndex:
                        vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].grainSize - Config.modulators[grainSizeIndex].convertRealFactor;
                        break;
                    case grainRangeIndex:
                        vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].grainRange - Config.modulators[grainRangeIndex].convertRealFactor;
                        break;
                    case envSpeedIndex:
                        vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].envelopeSpeed - Config.modulators[envSpeedIndex].convertRealFactor;
                        break;
                    case perEnvSpeedIndex:
                        vol = Config.perEnvelopeSpeedToIndices[this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].envelopes[instrument.modEnvelopeNumbers[modCount]].perEnvelopeSpeed] - Config.modulators[perEnvSpeedIndex].convertRealFactor;
                        break;
                    case perEnvLowerIndex:
                        vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].envelopes[instrument.modEnvelopeNumbers[modCount]].perEnvelopeLowerBound * 10 - Config.modulators[perEnvLowerIndex].convertRealFactor;
                        break;
                    case perEnvUpperIndex:
                        vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].envelopes[instrument.modEnvelopeNumbers[modCount]].perEnvelopeUpperBound * 10 - Config.modulators[perEnvUpperIndex].convertRealFactor;
                        break;
                }
            }

            if (vol != undefined)
                return vol;
            else
                return Config.noteSizeMax;
        }
    }


    public getVolumeCap = (isMod: boolean, modChannel?: number, modInstrument?: number, modCount?: number): number => {
        if (!isMod || modChannel == undefined || modInstrument == undefined || modCount == undefined)
            return Config.noteSizeMax;
        else {
            // Sigh, the way pitches count up and the visual ordering in the UI are flipped.
            modCount = Config.modCount - modCount - 1;

            let instrument: Instrument = this.channels[modChannel].instruments[modInstrument];
            let modulator = Config.modulators[instrument.modulators[modCount]];
            let cap: number | undefined = modulator.maxRawVol;

            if (cap != undefined) {
                // For filters, cap is dependent on which filter setting is targeted
                if (modulator.name == "eq filter" || modulator.name == "note filter" || modulator.name == "song eq") {
                    // type 0: number of filter morphs
                    // type 1/odd: number of filter x positions
                    // type 2/even: number of filter y positions
                    cap = Config.filterMorphCount - 1;
                    if (instrument.modFilterTypes[modCount] > 0 && instrument.modFilterTypes[modCount] % 2) {
                        cap = Config.filterFreqRange;
                    } else if (instrument.modFilterTypes[modCount] > 0) {
                        cap = Config.filterGainRange;
                    }
                }
                return cap;
            }
            else
                return Config.noteSizeMax;
        }
    }

    public getVolumeCapForSetting = (isMod: boolean, modSetting: number, filterType?: number): number => {
        if (!isMod)
            return Config.noteSizeMax;
        else {
            let cap: number | undefined = Config.modulators[modSetting].maxRawVol;
            if (cap != undefined) {

                // For filters, cap is dependent on which filter setting is targeted
                if (filterType != undefined && (Config.modulators[modSetting].name == "eq filter" || Config.modulators[modSetting].name == "note filter" || Config.modulators[modSetting].name == "song eq")) {
                    // type 0: number of filter morphs
                    // type 1/odd: number of filter x positions
                    // type 2/even: number of filter y positions
                    cap = Config.filterMorphCount - 1;
                    if (filterType > 0 && filterType % 2) {
                        cap = Config.filterFreqRange;
                    } else if (filterType > 0) {
                        cap = Config.filterGainRange;
                    }
                }

                return cap;
            } else
                return Config.noteSizeMax;
        }
    }

    public getChannelCount(): number {
        return this.pitchChannelCount + this.noiseChannelCount + this.modChannelCount;
    }

    public getMaxInstrumentsPerChannel(): number {
        return Math.max(
            this.layeredInstruments ? Config.layeredInstrumentCountMax : Config.instrumentCountMin,
            this.patternInstruments ? Config.patternInstrumentCountMax : Config.instrumentCountMin);
    }

    public getMaxInstrumentsPerPattern(channelIndex: number): number {
        return this.getMaxInstrumentsPerPatternForChannel(this.channels[channelIndex]);
    }

    public getMaxInstrumentsPerPatternForChannel(channel: Channel): number {
        return this.layeredInstruments
            ? Math.min(Config.layeredInstrumentCountMax, channel.instruments.length)
            : 1;
    }

    public getChannelIsNoise(channelIndex: number): boolean {
        return (channelIndex >= this.pitchChannelCount && channelIndex < this.pitchChannelCount + this.noiseChannelCount);
    }

    public getChannelIsMod(channelIndex: number): boolean {
        return (channelIndex >= this.pitchChannelCount + this.noiseChannelCount);
    }

    public initToDefault(andResetChannels: boolean = true): void {
        this.scale = 0;
        this.scaleCustom = [true, false, true, true, false, false, false, true, true, false, true, true];
        //this.scaleCustom = [true, false, false, false, false, false, false, false, false, false, false, false];
        this.key = 0;
        this.octave = 0;
        this.loopStart = 0;
        this.loopLength = 4;
        this.tempo = 150; //Default tempo returned to 150 for consistency with BeepBox and JummBox
        this.reverb = 0;
        this.beatsPerBar = 8;
        this.barCount = 16;
        this.patternsPerChannel = 8;
        this.rhythm = 1;
        this.layeredInstruments = false;
        this.patternInstruments = false;
        this.eqFilter.reset();
        this.sequences = [new SequenceSettings()];
        //clear plugin data
        this.pluginurl = null;
        SynthMessenger.pluginValueNames = [];
        SynthMessenger.pluginInstrumentStateFunction = null;
        SynthMessenger.pluginFunction = null;
        SynthMessenger.pluginIndex = 0;
        SynthMessenger.PluginDelayLineSize = 0;
        PluginConfig.pluginUIElements = [];
        PluginConfig.pluginName = "";

        for (let i: number = 0; i < Config.filterMorphCount - 1; i++) {
            this.eqSubFilters[i] = null;
        }

        //This is the tab's display name
        this.title = "Untitled";
        document.title = this.title + " - " + EditorConfig.versionDisplayName;

        if (andResetChannels) {
            this.pitchChannelCount = 3;
            this.noiseChannelCount = 1;
            this.modChannelCount = 1;
            for (let channelIndex: number = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                const isNoiseChannel: boolean = channelIndex >= this.pitchChannelCount && channelIndex < this.pitchChannelCount + this.noiseChannelCount;
                const isModChannel: boolean = channelIndex >= this.pitchChannelCount + this.noiseChannelCount;
                if (this.channels.length <= channelIndex) {
                    this.channels[channelIndex] = new Channel();
                }
                const channel: Channel = this.channels[channelIndex];
                channel.octave = Math.max(3 - channelIndex, 0); // [3, 2, 1, 0]; Descending octaves with drums at zero in last channel.

                for (let pattern: number = 0; pattern < this.patternsPerChannel; pattern++) {
                    if (channel.patterns.length <= pattern) {
                        channel.patterns[pattern] = new Pattern();
                    } else {
                        channel.patterns[pattern].reset();
                    }
                }
                channel.patterns.length = this.patternsPerChannel;

                for (let instrument: number = 0; instrument < Config.instrumentCountMin; instrument++) {
                    if (channel.instruments.length <= instrument) {
                        channel.instruments[instrument] = new Instrument(isNoiseChannel, isModChannel);
                    }
                    channel.instruments[instrument].setTypeAndReset(isModChannel ? InstrumentType.mod : (isNoiseChannel ? InstrumentType.noise : InstrumentType.chip), isNoiseChannel, isModChannel);
                }
                channel.instruments.length = Config.instrumentCountMin;

                for (let bar: number = 0; bar < this.barCount; bar++) {
                    channel.bars[bar] = bar < 4 ? 1 : 0;
                }
                channel.bars.length = this.barCount;
            }
            this.channels.length = this.getChannelCount();
        }
    }

    //This determines the url
    public toBase64String(): string {
        let bits: BitFieldWriter;
        let buffer: number[] = [];

        buffer.push(Song._variant);
        buffer.push(base64IntToCharCode[Song._latestSlarmoosBoxVersion]);

        // Length of the song name string
        buffer.push(SongTagCode.songTitle);
        var encodedSongTitle: string = encodeURIComponent(this.title);
        buffer.push(base64IntToCharCode[encodedSongTitle.length >> 6], base64IntToCharCode[encodedSongTitle.length & 0x3f]);

        // Actual encoded string follows
        for (let i: number = 0; i < encodedSongTitle.length; i++) {
            buffer.push(encodedSongTitle.charCodeAt(i));
        }

        buffer.push(SongTagCode.channelCount, base64IntToCharCode[this.pitchChannelCount], base64IntToCharCode[this.noiseChannelCount], base64IntToCharCode[this.modChannelCount]);
        buffer.push(SongTagCode.scale, base64IntToCharCode[this.scale]);
        if (this.scale == Config.scales["dictionary"]["Custom"].index) {
            for (var i = 1; i < Config.pitchesPerOctave; i++) {
                buffer.push(base64IntToCharCode[this.scaleCustom[i] ? 1 : 0]) // ineffiecent? yes, all we're going to do for now? hell yes
            }
        }
        buffer.push(SongTagCode.key, base64IntToCharCode[this.key], base64IntToCharCode[this.octave - Config.octaveMin]);
        buffer.push(SongTagCode.loopStart, base64IntToCharCode[this.loopStart >> 6], base64IntToCharCode[this.loopStart & 0x3f]);
        buffer.push(SongTagCode.loopEnd, base64IntToCharCode[(this.loopLength - 1) >> 6], base64IntToCharCode[(this.loopLength - 1) & 0x3f]);
        buffer.push(SongTagCode.tempo, base64IntToCharCode[this.tempo >> 6], base64IntToCharCode[this.tempo & 0x3F]);
        buffer.push(SongTagCode.beatCount, base64IntToCharCode[this.beatsPerBar - 1]);
        buffer.push(SongTagCode.barCount, base64IntToCharCode[(this.barCount - 1) >> 6], base64IntToCharCode[(this.barCount - 1) & 0x3f]);
        buffer.push(SongTagCode.patternCount, base64IntToCharCode[(this.patternsPerChannel - 1) >> 6], base64IntToCharCode[(this.patternsPerChannel - 1) & 0x3f]);
        buffer.push(SongTagCode.rhythm, base64IntToCharCode[this.rhythm]);

        // Push limiter settings, but only if they aren't the default!
        buffer.push(SongTagCode.limiterSettings);
        if (this.compressionRatio != 1.0 || this.limitRatio != 1.0 || this.limitRise != 4000.0 || this.limitDecay != 4.0 || this.limitThreshold != 1.0 || this.compressionThreshold != 1.0 || this.masterGain != 1.0) {
            buffer.push(base64IntToCharCode[Math.round(this.compressionRatio < 1 ? this.compressionRatio * 10 : 10 + (this.compressionRatio - 1) * 60)]); // 0 ~ 1.15 uneven, mapped to 0 ~ 20
            buffer.push(base64IntToCharCode[Math.round(this.limitRatio < 1 ? this.limitRatio * 10 : 9 + this.limitRatio)]); // 0 ~ 10 uneven, mapped to 0 ~ 20
            buffer.push(base64IntToCharCode[this.limitDecay]); // directly 1 ~ 30
            buffer.push(base64IntToCharCode[Math.round((this.limitRise - 2000.0) / 250.0)]); // 2000 ~ 10000 by 250, mapped to 0 ~ 32
            buffer.push(base64IntToCharCode[Math.round(this.compressionThreshold * 20)]); // 0 ~ 1.1 by 0.05, mapped to 0 ~ 22
            buffer.push(base64IntToCharCode[Math.round(this.limitThreshold * 20)]); // 0 ~ 2 by 0.05, mapped to 0 ~ 40
            buffer.push(base64IntToCharCode[Math.round(this.masterGain * 50) >> 6], base64IntToCharCode[Math.round(this.masterGain * 50) & 0x3f]); // 0 ~ 5 by 0.02, mapped to 0 ~ 250
        }
        else {
            buffer.push(base64IntToCharCode[0x3f]); // Not using limiter
        }

        //songeq
        buffer.push(SongTagCode.songEq);
        if (this.eqFilter == null) {
            // Push null filter settings
            buffer.push(base64IntToCharCode[0]);
            console.log("Null EQ filter settings detected in toBase64String for song");
        } else {
            buffer.push(base64IntToCharCode[this.eqFilter.controlPointCount]);
            for (let j: number = 0; j < this.eqFilter.controlPointCount; j++) {
                const point: FilterControlPoint = this.eqFilter.controlPoints[j];
                buffer.push(base64IntToCharCode[point.type], base64IntToCharCode[Math.round(point.freq)], base64IntToCharCode[Math.round(point.gain)]);
            }
        }

        // Push subfilters as well. Skip Index 0, is a copy of the base filter.
        let usingSubFilterBitfield: number = 0;
        for (let j: number = 0; j < Config.filterMorphCount - 1; j++) {
            usingSubFilterBitfield |= (+(this.eqSubFilters[j + 1] != null) << j);
        }
        // Put subfilter usage into 2 chars (12 bits)
        buffer.push(base64IntToCharCode[usingSubFilterBitfield >> 6], base64IntToCharCode[usingSubFilterBitfield & 63]);
        // Put subfilter info in for all used subfilters
        for (let j: number = 0; j < Config.filterMorphCount - 1; j++) {
            if (usingSubFilterBitfield & (1 << j)) {
                buffer.push(base64IntToCharCode[this.eqSubFilters[j + 1]!.controlPointCount]);
                for (let k: number = 0; k < this.eqSubFilters[j + 1]!.controlPointCount; k++) {
                    const point: FilterControlPoint = this.eqSubFilters[j + 1]!.controlPoints[k];
                    buffer.push(base64IntToCharCode[point.type], base64IntToCharCode[Math.round(point.freq)], base64IntToCharCode[Math.round(point.gain)]);
                }
            }
        }

        buffer.push(SongTagCode.sequences, base64IntToCharCode[this.sequences.length]);
        for (let seq: number = 0; seq < this.sequences.length; seq++) {
            const sequence: SequenceSettings = this.sequences[seq];
            buffer.push(base64IntToCharCode[sequence.height], base64IntToCharCode[sequence.length])
            for (let j: number = 0; j < sequence.length; j++) {
                buffer.push(base64IntToCharCode[sequence.values[j]]);
            }
        }

        buffer.push(SongTagCode.channelNames);
        for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
            // Length of the channel name string
            var encodedChannelName: string = encodeURIComponent(this.channels[channel].name);
            buffer.push(base64IntToCharCode[encodedChannelName.length >> 6], base64IntToCharCode[encodedChannelName.length & 0x3f]);

            // Actual encoded string follows
            for (let i: number = 0; i < encodedChannelName.length; i++) {
                buffer.push(encodedChannelName.charCodeAt(i));
            }
        }

        buffer.push(SongTagCode.instrumentCount, base64IntToCharCode[(<any>this.layeredInstruments << 1) | <any>this.patternInstruments]);
        if (this.layeredInstruments || this.patternInstruments) {
            for (let channelIndex: number = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                buffer.push(base64IntToCharCode[this.channels[channelIndex].instruments.length - Config.instrumentCountMin]);
            }
        }

        buffer.push(SongTagCode.channelOctave);
        for (let channelIndex: number = 0; channelIndex < this.pitchChannelCount; channelIndex++) {
            buffer.push(base64IntToCharCode[this.channels[channelIndex].octave]);
        }

        //This is for specific instrument stuff to url
        for (let channelIndex: number = 0; channelIndex < this.getChannelCount(); channelIndex++) {
            for (let i: number = 0; i < this.channels[channelIndex].instruments.length; i++) {
                const instrument: Instrument = this.channels[channelIndex].instruments[i];
                buffer.push(SongTagCode.startInstrument, base64IntToCharCode[instrument.type]);
                buffer.push(SongTagCode.volume, base64IntToCharCode[(instrument.volume + Config.volumeRange / 2) >> 6], base64IntToCharCode[(instrument.volume + Config.volumeRange / 2) & 0x3f]);
                buffer.push(SongTagCode.preset, base64IntToCharCode[instrument.preset >> 6], base64IntToCharCode[instrument.preset & 63]);

                buffer.push(SongTagCode.eqFilter);
                buffer.push(base64IntToCharCode[+instrument.eqFilterType]);
                if (instrument.eqFilterType) {
                    buffer.push(base64IntToCharCode[instrument.eqFilterSimpleCut]);
                    buffer.push(base64IntToCharCode[instrument.eqFilterSimplePeak]);
                }
                else {
                    if (instrument.eqFilter == null) {
                        // Push null filter settings
                        buffer.push(base64IntToCharCode[0]);
                        console.log("Null EQ filter settings detected in toBase64String for channelIndex " + channelIndex + ", instrumentIndex " + i);
                    } else {
                        buffer.push(base64IntToCharCode[instrument.eqFilter.controlPointCount]);
                        for (let j: number = 0; j < instrument.eqFilter.controlPointCount; j++) {
                            const point: FilterControlPoint = instrument.eqFilter.controlPoints[j];
                            buffer.push(base64IntToCharCode[point.type], base64IntToCharCode[Math.round(point.freq)], base64IntToCharCode[Math.round(point.gain)]);
                        }
                    }

                    // Push subfilters as well. Skip Index 0, is a copy of the base filter.
                    let usingSubFilterBitfield: number = 0;
                    for (let j: number = 0; j < Config.filterMorphCount - 1; j++) {
                        usingSubFilterBitfield |= (+(instrument.eqSubFilters[j + 1] != null) << j);
                    }
                    // Put subfilter usage into 2 chars (12 bits)
                    buffer.push(base64IntToCharCode[usingSubFilterBitfield >> 6], base64IntToCharCode[usingSubFilterBitfield & 63]);
                    // Put subfilter info in for all used subfilters
                    for (let j: number = 0; j < Config.filterMorphCount - 1; j++) {
                        if (usingSubFilterBitfield & (1 << j)) {
                            buffer.push(base64IntToCharCode[instrument.eqSubFilters[j + 1]!.controlPointCount]);
                            for (let k: number = 0; k < instrument.eqSubFilters[j + 1]!.controlPointCount; k++) {
                                const point: FilterControlPoint = instrument.eqSubFilters[j + 1]!.controlPoints[k];
                                buffer.push(base64IntToCharCode[point.type], base64IntToCharCode[Math.round(point.freq)], base64IntToCharCode[Math.round(point.gain)]);
                            }
                        }
                    }
                }

                // The list of enabled effects is represented as a 14-bit bitfield using two six-bit characters.
                buffer.push(SongTagCode.effects, base64IntToCharCode[(instrument.effects >> 12) & 63], base64IntToCharCode[(instrument.effects >> 6) & 63], base64IntToCharCode[instrument.effects & 63]);
                if (effectsIncludeNoteFilter(instrument.effects)) {
                    buffer.push(base64IntToCharCode[+instrument.noteFilterType]);
                    if (instrument.noteFilterType) {
                        buffer.push(base64IntToCharCode[instrument.noteFilterSimpleCut]);
                        buffer.push(base64IntToCharCode[instrument.noteFilterSimplePeak]);
                    } else {
                        if (instrument.noteFilter == null) {
                            // Push null filter settings
                            buffer.push(base64IntToCharCode[0]);
                            console.log("Null note filter settings detected in toBase64String for channelIndex " + channelIndex + ", instrumentIndex " + i);
                        } else {
                            buffer.push(base64IntToCharCode[instrument.noteFilter.controlPointCount]);
                            for (let j: number = 0; j < instrument.noteFilter.controlPointCount; j++) {
                                const point: FilterControlPoint = instrument.noteFilter.controlPoints[j];
                                buffer.push(base64IntToCharCode[point.type], base64IntToCharCode[Math.round(point.freq)], base64IntToCharCode[Math.round(point.gain)]);
                            }
                        }

                        // Push subfilters as well. Skip Index 0, is a copy of the base filter.
                        let usingSubFilterBitfield: number = 0;
                        for (let j: number = 0; j < Config.filterMorphCount - 1; j++) {
                            usingSubFilterBitfield |= (+(instrument.noteSubFilters[j + 1] != null) << j);
                        }
                        // Put subfilter usage into 2 chars (12 bits)
                        buffer.push(base64IntToCharCode[usingSubFilterBitfield >> 6], base64IntToCharCode[usingSubFilterBitfield & 63]);
                        // Put subfilter info in for all used subfilters
                        for (let j: number = 0; j < Config.filterMorphCount - 1; j++) {
                            if (usingSubFilterBitfield & (1 << j)) {
                                buffer.push(base64IntToCharCode[instrument.noteSubFilters[j + 1]!.controlPointCount]);
                                for (let k: number = 0; k < instrument.noteSubFilters[j + 1]!.controlPointCount; k++) {
                                    const point: FilterControlPoint = instrument.noteSubFilters[j + 1]!.controlPoints[k];
                                    buffer.push(base64IntToCharCode[point.type], base64IntToCharCode[Math.round(point.freq)], base64IntToCharCode[Math.round(point.gain)]);
                                }
                            }
                        }
                    }
                }
                if (effectsIncludeTransition(instrument.effects)) {
                    buffer.push(base64IntToCharCode[instrument.transition]);
                    if (Config.transitions[instrument.transition].slides == true) buffer.push(base64IntToCharCode[instrument.slideTicks]);
                }
                if (effectsIncludeChord(instrument.effects)) {
                    buffer.push(base64IntToCharCode[instrument.chord]);
                    // Custom arpeggio speed... only if the instrument arpeggiates.
                    if (Config.chords[instrument.chord].arpeggiates == true) {
                        buffer.push(base64IntToCharCode[instrument.arpeggioSpeed]);
                        buffer.push(base64IntToCharCode[+instrument.fastTwoNoteArp]); // Two note arp setting piggybacks on this
                    }
                    if (Config.chords[instrument.chord].strumParts > 0) {
                        buffer.push(base64IntToCharCode[instrument.strumParts]);
                    }
                    if (instrument.chord == Config.chords.dictionary["monophonic"].index) {
                        buffer.push(base64IntToCharCode[instrument.monoChordTone]); //which note is selected
                    }
                }
                if (effectsIncludePitchShift(instrument.effects)) {
                    buffer.push(base64IntToCharCode[instrument.pitchShift]);
                }
                if (effectsIncludeDetune(instrument.effects)) {
                    buffer.push(base64IntToCharCode[(instrument.detune - Config.detuneMin) >> 6], base64IntToCharCode[(instrument.detune - Config.detuneMin) & 0x3F]);
                }
                if (effectsIncludeVibrato(instrument.effects)) {
                    buffer.push(base64IntToCharCode[instrument.vibrato]);
                    // Custom vibrato settings
                    if (instrument.vibrato == Config.vibratos.length) {
                        buffer.push(base64IntToCharCode[Math.round(instrument.vibratoDepth * 25)]);
                        buffer.push(base64IntToCharCode[instrument.vibratoSpeed]);
                        buffer.push(base64IntToCharCode[Math.round(instrument.vibratoDelay)]);
                        buffer.push(base64IntToCharCode[instrument.vibratoType]);
                    }
                }
                if (effectsIncludeDistortion(instrument.effects)) {
                    buffer.push(base64IntToCharCode[instrument.distortion]);
                    // Aliasing is tied into distortion for now
                    buffer.push(base64IntToCharCode[+instrument.aliases]);
                }
                if (effectsIncludeBitcrusher(instrument.effects)) {
                    buffer.push(base64IntToCharCode[instrument.bitcrusherFreq], base64IntToCharCode[instrument.bitcrusherQuantization]);
                }
                if (effectsIncludePanning(instrument.effects)) {
                    buffer.push(base64IntToCharCode[instrument.pan >> 6], base64IntToCharCode[instrument.pan & 0x3f]);
                    buffer.push(base64IntToCharCode[instrument.panDelay]);
                }
                if (effectsIncludeChorus(instrument.effects)) {
                    buffer.push(base64IntToCharCode[instrument.chorus]);
                }
                if (effectsIncludeEcho(instrument.effects)) {
                    buffer.push(base64IntToCharCode[instrument.echoSustain], base64IntToCharCode[instrument.echoDelay]);
                }
                if (effectsIncludeReverb(instrument.effects)) {
                    buffer.push(base64IntToCharCode[instrument.reverb]);
                }
                if (effectsIncludeNoteRange(instrument.effects)) {
                    buffer.push(base64IntToCharCode[instrument.upperNoteLimit >> 6], base64IntToCharCode[instrument.upperNoteLimit & 0x3f]);
                    buffer.push(base64IntToCharCode[instrument.lowerNoteLimit >> 6], base64IntToCharCode[instrument.lowerNoteLimit & 0x3f]);
                }
                if (effectsIncludeGranular(instrument.effects)) {
                    buffer.push(base64IntToCharCode[instrument.granular]);
                    buffer.push(base64IntToCharCode[instrument.grainSize]);
                    buffer.push(base64IntToCharCode[instrument.grainFreq]);
                    buffer.push(base64IntToCharCode[instrument.grainRange]);
                }
                if (effectsIncludeRingModulation(instrument.effects)) {
                    buffer.push(base64IntToCharCode[instrument.ringModulation]);
                    buffer.push(base64IntToCharCode[instrument.ringModulationHz]);
                    buffer.push(base64IntToCharCode[instrument.ringModWaveformIndex]);
                    buffer.push(base64IntToCharCode[(instrument.ringModPulseWidth)]);
                    buffer.push(base64IntToCharCode[(instrument.ringModHzOffset - Config.rmHzOffsetMin) >> 6], base64IntToCharCode[(instrument.ringModHzOffset - Config.rmHzOffsetMin) & 0x3F]);
                }
                if (effectsIncludePlugin(instrument.effects)) {
                    let pluginValueCount: number = PluginConfig.pluginUIElements.length
                    if (PluginConfig.pluginUIElements.length == 0) {
                        for (let i = 0; i < instrument.pluginValues.length; i++) {
                            if (instrument.pluginValues[pluginValueCount]) pluginValueCount = i;
                        }
                    }
                    buffer.push(base64IntToCharCode[pluginValueCount]);
                    for (let i: number = 0; i < pluginValueCount; i++) {
                        buffer.push(base64IntToCharCode[instrument.pluginValues[i]]);
                    }
                }

                if (instrument.type != InstrumentType.drumset) {
                    buffer.push(SongTagCode.fadeInOut, base64IntToCharCode[instrument.fadeIn], base64IntToCharCode[instrument.fadeOut]);
                    // Transition info follows transition song tag
                    buffer.push(base64IntToCharCode[+instrument.clicklessTransition]);
                }

                if (instrument.type == InstrumentType.harmonics || instrument.type == InstrumentType.pickedString) {
                    buffer.push(SongTagCode.harmonics);
                    const harmonicsBits: BitFieldWriter = new BitFieldWriter();
                    for (let i: number = 0; i < Config.harmonicsControlPoints; i++) {
                        harmonicsBits.write(Config.harmonicsControlPointBits, instrument.harmonicsWave.harmonics[i]);
                    }
                    harmonicsBits.encodeBase64(buffer);
                }

                if (instrument.type != InstrumentType.mod) {
                    buffer.push(SongTagCode.unison, base64IntToCharCode[instrument.unison]);
                    if (instrument.unison == Config.unisons.length) encodeUnisonSettings(buffer, instrument.unisonVoices, instrument.unisonSpread, instrument.unisonOffset, instrument.unisonExpression, instrument.unisonSign, instrument.unisonAntiPhased, instrument.unisonBuzzes);
                }

                if (instrument.type == InstrumentType.chip) {
                    if (instrument.chipWave > 186) {
                        buffer.push(SongTagCode.wave, base64IntToCharCode[instrument.chipWave - 186]);
                        buffer.push(base64IntToCharCode[3]);
                    } else if (instrument.chipWave > 124) {
                        buffer.push(SongTagCode.wave, base64IntToCharCode[instrument.chipWave - 124]);
                        buffer.push(base64IntToCharCode[2]);
                    } else if (instrument.chipWave > 62) {
                        buffer.push(SongTagCode.wave, base64IntToCharCode[instrument.chipWave - 62]);
                        buffer.push(base64IntToCharCode[1]);
                    } else {
                        buffer.push(SongTagCode.wave, base64IntToCharCode[instrument.chipWave]);
                        buffer.push(base64IntToCharCode[0]);
                    }
                    // Repurposed for chip wave loop controls.
                    buffer.push(SongTagCode.loopControls);
                    // The encoding here is as follows:
                    // 0b11111_1
                    //         ^-- isUsingAdvancedLoopControls
                    //   ^^^^^---- chipWaveLoopMode
                    // This essentially allocates 32 different loop modes,
                    // which should be plenty.
                    const encodedLoopMode: number = (
                        (clamp(0, 31 + 1, instrument.chipWaveLoopMode) << 1)
                        | (instrument.isUsingAdvancedLoopControls ? 1 : 0)
                    );
                    buffer.push(base64IntToCharCode[encodedLoopMode]);
                    // The same encoding above is used here, but with the release mode
                    // (which isn't implemented currently), and the backwards toggle.
                    const encodedReleaseMode: number = (
                        (clamp(0, 31 + 1, 0) << 1)
                        | (instrument.chipWavePlayBackwards ? 1 : 0)
                    );
                    buffer.push(base64IntToCharCode[encodedReleaseMode]);
                    encode32BitNumber(buffer, instrument.chipWaveLoopStart);
                    encode32BitNumber(buffer, instrument.chipWaveLoopEnd);
                    encode32BitNumber(buffer, instrument.chipWaveStartOffset);

                } else if (instrument.type == InstrumentType.fm || instrument.type == InstrumentType.fm6op) {
                    if (instrument.type == InstrumentType.fm) {
                        buffer.push(SongTagCode.algorithm, base64IntToCharCode[instrument.algorithm]);
                        buffer.push(SongTagCode.feedbackType, base64IntToCharCode[instrument.feedbackType]);
                    } else {
                        buffer.push(SongTagCode.algorithm, base64IntToCharCode[instrument.algorithm6Op]);
                        if (instrument.algorithm6Op == 0) {
                            buffer.push(SongTagCode.chord, base64IntToCharCode[instrument.customAlgorithm.carrierCount]);
                            buffer.push(SongTagCode.effects);
                            for (let o: number = 0; o < instrument.customAlgorithm.modulatedBy.length; o++) {
                                for (let j: number = 0; j < instrument.customAlgorithm.modulatedBy[o].length; j++) {
                                    buffer.push(base64IntToCharCode[instrument.customAlgorithm.modulatedBy[o][j]]);
                                }
                                buffer.push(SongTagCode.operatorWaves);
                            }
                            buffer.push(SongTagCode.effects);
                        }
                        buffer.push(SongTagCode.feedbackType, base64IntToCharCode[instrument.feedbackType6Op]);
                        if (instrument.feedbackType6Op == 0) {
                            buffer.push(SongTagCode.effects);
                            for (let o: number = 0; o < instrument.customFeedbackType.indices.length; o++) {
                                for (let j: number = 0; j < instrument.customFeedbackType.indices[o].length; j++) {
                                    buffer.push(base64IntToCharCode[instrument.customFeedbackType.indices[o][j]]);
                                }
                                buffer.push(SongTagCode.operatorWaves);
                            }
                            buffer.push(SongTagCode.effects);
                        }
                    }
                    buffer.push(SongTagCode.feedbackAmplitude, base64IntToCharCode[instrument.feedbackAmplitude]);

                    buffer.push(SongTagCode.operatorFrequencies);
                    for (let o: number = 0; o < (instrument.type == InstrumentType.fm6op ? 6 : Config.operatorCount); o++) {
                        buffer.push(base64IntToCharCode[instrument.operators[o].frequency]);
                    }
                    buffer.push(SongTagCode.operatorAmplitudes);
                    for (let o: number = 0; o < (instrument.type == InstrumentType.fm6op ? 6 : Config.operatorCount); o++) {
                        buffer.push(base64IntToCharCode[instrument.operators[o].amplitude]);
                    }
                    buffer.push(SongTagCode.operatorWaves);
                    for (let o: number = 0; o < (instrument.type == InstrumentType.fm6op ? 6 : Config.operatorCount); o++) {
                        buffer.push(base64IntToCharCode[instrument.operators[o].waveform]);
                        // Push pulse width if that type is used
                        if (instrument.operators[o].waveform == 2) {
                            buffer.push(base64IntToCharCode[instrument.operators[o].pulseWidth]);
                        }
                    }

                } else if (instrument.type == InstrumentType.customChipWave) {
                    if (instrument.chipWave > 186) {
                        buffer.push(119, base64IntToCharCode[instrument.chipWave - 186]);
                        buffer.push(base64IntToCharCode[3]);
                    }
                    else if (instrument.chipWave > 124) {
                        buffer.push(119, base64IntToCharCode[instrument.chipWave - 124]);
                        buffer.push(base64IntToCharCode[2]);
                    }
                    else if (instrument.chipWave > 62) {
                        buffer.push(119, base64IntToCharCode[instrument.chipWave - 62]);
                        buffer.push(base64IntToCharCode[1]);
                    }
                    else {
                        buffer.push(119, base64IntToCharCode[instrument.chipWave]);
                        buffer.push(base64IntToCharCode[0]);
                    }
                    buffer.push(SongTagCode.customChipWave);
                    // Push custom wave values
                    for (let j: number = 0; j < 64; j++) {
                        buffer.push(base64IntToCharCode[(instrument.customChipWave[j] + 24) as number]);
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
                    buffer.push(SongTagCode.drumsetEnvelopes);
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
                } else if (instrument.type == InstrumentType.pwm) {
                    buffer.push(SongTagCode.pulseWidth, base64IntToCharCode[instrument.pulseWidth]);
                    buffer.push(base64IntToCharCode[instrument.decimalOffset >> 6], base64IntToCharCode[instrument.decimalOffset & 0x3f]);
                } else if (instrument.type == InstrumentType.supersaw) {
                    buffer.push(SongTagCode.supersaw, base64IntToCharCode[instrument.supersawDynamism], base64IntToCharCode[instrument.supersawSpread], base64IntToCharCode[instrument.supersawShape]);
                    buffer.push(SongTagCode.pulseWidth, base64IntToCharCode[instrument.pulseWidth]);
                    buffer.push(base64IntToCharCode[instrument.decimalOffset >> 6], base64IntToCharCode[instrument.decimalOffset & 0x3f]);
                } else if (instrument.type == InstrumentType.pickedString) {
                    if (Config.stringSustainRange > 0x20 || SustainType.length > 2) {
                        throw new Error("Not enough bits to represent sustain value and type in same base64 character.");
                    }
                    buffer.push(SongTagCode.stringSustain, base64IntToCharCode[instrument.stringSustain | (instrument.stringSustainType << 5)]);
                } else if (instrument.type == InstrumentType.mod || instrument.type == InstrumentType.harmonics) {
                    // Handled down below. Could be moved, but meh.
                } else {
                    throw new Error("Unknown instrument type.");
                }

                buffer.push(SongTagCode.envelopes, base64IntToCharCode[instrument.envelopeCount]);
                // Added in JB v6: Options for envelopes come next.
                buffer.push(base64IntToCharCode[instrument.envelopeSpeed]);
                for (let envelopeIndex: number = 0; envelopeIndex < instrument.envelopeCount; envelopeIndex++) {
                    buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].target]);
                    if (Config.instrumentAutomationTargets[instrument.envelopes[envelopeIndex].target].maxCount > 1) {
                        buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].index]);
                    }
                    buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].envelope]);
                    //run pitch envelope handling
                    if (Config.envelopes[instrument.envelopes[envelopeIndex].envelope].type == EnvelopeType.pitch) {
                        if (!instrument.isNoiseInstrument) {
                            buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].pitchEnvelopeStart >> 6], base64IntToCharCode[instrument.envelopes[envelopeIndex].pitchEnvelopeStart & 0x3f]);
                            buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].pitchEnvelopeEnd >> 6], base64IntToCharCode[instrument.envelopes[envelopeIndex].pitchEnvelopeEnd & 0x3f]);
                        } else {
                            buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].pitchEnvelopeStart]);
                            buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].pitchEnvelopeEnd]);
                        }
                        //random
                    } else if (Config.envelopes[instrument.envelopes[envelopeIndex].envelope].type == EnvelopeType.pseudorandom) {
                        buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].steps]);
                        buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].seed]);
                        buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].waveform]);
                        //lfo
                    } else if (Config.envelopes[instrument.envelopes[envelopeIndex].envelope].type == EnvelopeType.lfo) {
                        buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].waveform]);
                        if (instrument.envelopes[envelopeIndex].waveform == LFOEnvelopeTypes.steppedSaw || instrument.envelopes[envelopeIndex].waveform == LFOEnvelopeTypes.steppedTri) {
                            buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].steps]);
                        }
                        //sequence
                    } else if (Config.envelopes[instrument.envelopes[envelopeIndex].envelope].type == EnvelopeType.sequence) {
                        buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].waveform]);
                    }
                    //inverse
                    let checkboxValues: number = +instrument.envelopes[envelopeIndex].discrete;
                    checkboxValues = checkboxValues << 1;
                    checkboxValues += +instrument.envelopes[envelopeIndex].inverse;
                    buffer.push(base64IntToCharCode[checkboxValues] ? base64IntToCharCode[checkboxValues] : base64IntToCharCode[0]);
                    //midbox envelope port
                    if (Config.envelopes[instrument.envelopes[envelopeIndex].envelope].name != "pitch" && Config.envelopes[instrument.envelopes[envelopeIndex].envelope].name != "note size" && Config.envelopes[instrument.envelopes[envelopeIndex].envelope].name != "punch" && Config.envelopes[instrument.envelopes[envelopeIndex].envelope].name != "none") {
                        buffer.push(base64IntToCharCode[Config.perEnvelopeSpeedToIndices[instrument.envelopes[envelopeIndex].perEnvelopeSpeed]]);
                    }
                    buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].perEnvelopeLowerBound * 10]);
                    buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].perEnvelopeUpperBound * 10]);
                }
            }
        }

        buffer.push(SongTagCode.bars);
        bits = new BitFieldWriter();
        let neededBits: number = 0;
        while ((1 << neededBits) < this.patternsPerChannel + 1) neededBits++;
        for (let channelIndex: number = 0; channelIndex < this.getChannelCount(); channelIndex++) for (let i: number = 0; i < this.barCount; i++) {
            bits.write(neededBits, this.channels[channelIndex].bars[i]);
        }
        bits.encodeBase64(buffer);

        buffer.push(SongTagCode.patterns);
        bits = new BitFieldWriter();
        const shapeBits: BitFieldWriter = new BitFieldWriter();
        const bitsPerNoteSize: number = Song.getNeededBits(Config.noteSizeMax);
        for (let channelIndex: number = 0; channelIndex < this.getChannelCount(); channelIndex++) {
            const channel: Channel = this.channels[channelIndex];
            const maxInstrumentsPerPattern: number = this.getMaxInstrumentsPerPattern(channelIndex);
            const isNoiseChannel: boolean = this.getChannelIsNoise(channelIndex);
            const isModChannel: boolean = this.getChannelIsMod(channelIndex);
            const neededInstrumentCountBits: number = Song.getNeededBits(maxInstrumentsPerPattern - Config.instrumentCountMin);
            const neededInstrumentIndexBits: number = Song.getNeededBits(channel.instruments.length - 1);

            // Some info about modulator settings immediately follows in mod channels.
            if (isModChannel) {
                const neededModInstrumentIndexBits: number = Song.getNeededBits(this.getMaxInstrumentsPerChannel() + 2);
                for (let instrumentIndex: number = 0; instrumentIndex < channel.instruments.length; instrumentIndex++) {

                    let instrument: Instrument = this.channels[channelIndex].instruments[instrumentIndex];

                    for (let mod: number = 0; mod < Config.modCount; mod++) {
                        const modChannel: number = instrument.modChannels[mod];
                        const modInstrument: number = instrument.modInstruments[mod];
                        const modSetting: number = instrument.modulators[mod];
                        const modFilter: number = instrument.modFilterTypes[mod];
                        const modEnvelope: number = instrument.modEnvelopeNumbers[mod];

                        // Still using legacy "mod status" format, but doing it manually as it's only used in the URL now.
                        // 0 - For pitch/noise
                        // 1 - (used to be For noise, not needed)
                        // 2 - For song
                        // 3 - None

                        let status: number = Config.modulators[modSetting].forSong ? 2 : 0;
                        if (modSetting == Config.modulators.dictionary["none"].index)
                            status = 3;

                        bits.write(2, status);

                        // Channel/Instrument is only used if the status isn't "song" or "none".
                        if (status == 0 || status == 1) {
                            bits.write(8, modChannel);
                            bits.write(neededModInstrumentIndexBits, modInstrument);
                        }

                        // Only used if setting isn't "none".
                        if (status != 3) {
                            bits.write(6, modSetting);
                        }

                        // Write mod filter info, only if this is a filter mod
                        if (Config.modulators[instrument.modulators[mod]].name == "eq filter" || Config.modulators[instrument.modulators[mod]].name == "note filter" || Config.modulators[instrument.modulators[mod]].name == "song eq") {
                            bits.write(6, modFilter);
                        }

                        //write envelope info only if needed
                        if (Config.modulators[instrument.modulators[mod]].name == "individual envelope speed" ||
                            Config.modulators[instrument.modulators[mod]].name == "reset envelope" ||
                            Config.modulators[instrument.modulators[mod]].name == "individual envelope lower bound" ||
                            Config.modulators[instrument.modulators[mod]].name == "individual envelope upper bound"
                        ) {
                            bits.write(6, modEnvelope);
                        }
                    }
                }
            }
            const octaveOffset: number = (isNoiseChannel || isModChannel) ? 0 : channel.octave * Config.pitchesPerOctave;
            let lastPitch: number = (isNoiseChannel ? 4 : octaveOffset);
            const recentPitches: number[] = isModChannel ? [0, 1, 2, 3, 4, 5] : (isNoiseChannel ? [4, 6, 7, 2, 3, 8, 0, 10] : [0, 7, 12, 19, 24, -5, -12]);
            const recentShapes: string[] = [];
            for (let i: number = 0; i < recentPitches.length; i++) {
                recentPitches[i] += octaveOffset;
            }
            for (const pattern of channel.patterns) {
                if (this.patternInstruments) {
                    const instrumentCount: number = validateRange(Config.instrumentCountMin, maxInstrumentsPerPattern, pattern.instruments.length);
                    bits.write(neededInstrumentCountBits, instrumentCount - Config.instrumentCountMin);
                    for (let i: number = 0; i < instrumentCount; i++) {
                        bits.write(neededInstrumentIndexBits, pattern.instruments[i]);
                    }
                }

                if (pattern.notes.length > 0) {
                    bits.write(1, 1);

                    let curPart: number = 0;
                    for (const note of pattern.notes) {

                        // For mod channels, a negative offset may be necessary.
                        if (note.start < curPart && isModChannel) {
                            bits.write(2, 0); // rest, then...
                            bits.write(1, 1); // negative offset
                            bits.writePartDuration(curPart - note.start);
                        }

                        if (note.start > curPart) {
                            bits.write(2, 0); // rest
                            if (isModChannel) bits.write(1, 0); // positive offset, only needed for mod channels
                            bits.writePartDuration(note.start - curPart);
                        }

                        shapeBits.clear();

                        // Old format was:
                        // 0: 1 pitch, 10: 2 pitches, 110: 3 pitches, 111: 4 pitches
                        // New format is:
                        //      0: 1 pitch
                        // 1[XXX]: 3 bits of binary signifying 2+ pitches
                        if (note.pitches.length == 1) {
                            shapeBits.write(1, 0);
                        } else {
                            shapeBits.write(1, 1);
                            shapeBits.write(3, note.pitches.length - 2);
                        }

                        shapeBits.writePinCount(note.pins.length - 1);

                        if (!isModChannel) {
                            shapeBits.write(bitsPerNoteSize, note.pins[0].size); // volume
                        }
                        else {
                            shapeBits.write(9, note.pins[0].size); // Modulator value. 9 bits for now = 512 max mod value?
                        }

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
                            if (!isModChannel) {
                                shapeBits.write(bitsPerNoteSize, pin.size);
                            } else {
                                shapeBits.write(9, pin.size);
                            }
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
                                bits.write(4, pitchIndex);
                                recentPitches.splice(pitchIndex, 1);
                            }
                            recentPitches.unshift(pitch);
                            if (recentPitches.length > 16) recentPitches.pop();

                            if (i == note.pitches.length - 1) {
                                lastPitch = note.pitches[0];
                            } else {
                                lastPitch = pitch;
                            }
                        }

                        if (note.start == 0) {
                            bits.write(1, note.continuesLastPattern ? 1 : 0);
                        }

                        curPart = note.end;
                    }

                    if (curPart < this.beatsPerBar * Config.partsPerBeat + (+isModChannel)) {
                        bits.write(2, 0); // rest
                        if (isModChannel) bits.write(1, 0); // positive offset
                        bits.writePartDuration(this.beatsPerBar * Config.partsPerBeat + (+isModChannel) - curPart);
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
        let customSamplesStr: string = "";
        if (EditorConfig.customSamples != undefined && EditorConfig.customSamples.length > 0) {
            customSamplesStr = "|" + EditorConfig.customSamples.join("|")

        }
        if (this.pluginurl != null) {
            customSamplesStr += "||" + this.pluginurl;
        }
        //samplemark
        if (buffer.length < maxApplyArgs) {
            // Note: Function.apply may break for long argument lists. 
            return String.fromCharCode.apply(null, buffer) + customSamplesStr;
            //samplemark
        } else {
            let result: string = "";
            for (let i: number = 0; i < buffer.length; i += maxApplyArgs) {
                result += String.fromCharCode.apply(null, buffer.slice(i, i + maxApplyArgs));
            }
            return result + customSamplesStr;
            //samplemark
        }
    }

    private static _envelopeFromLegacyIndex(legacyIndex: number): Envelope {
        // I swapped the order of "custom"/"steady", now "none"/"note size".
        if (legacyIndex == 0) legacyIndex = 1; else if (legacyIndex == 1) legacyIndex = 0;
        return Config.envelopePresets[clamp(0, Config.envelopePresets.length, legacyIndex)];
    }

    public fromBase64String(compressed: string, jsonFormat: string = "auto"): void {
        if (compressed == null || compressed == "") {
            Song._clearSamples();

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
            this.fromJsonObject(JSON.parse(charIndex == 0 ? compressed : compressed.substring(charIndex)), jsonFormat);
            return;
        }

        const variantTest: number = compressed.charCodeAt(charIndex);
        //I cleaned up these boolean setters with an initial value. Idk why this wasn't done earlier...
        let fromBeepBox: boolean = false;
        let fromJummBox: boolean = false;
        let fromGoldBox: boolean = false;
        let fromUltraBox: boolean = false;
        let fromSlarmoosBox: boolean = false;
        // let fromMidbox: boolean;
        // let fromDogebox2: boolean;
        // let fromAbyssBox: boolean;

        // Detect variant here. If version doesn't match known variant, assume it is a vanilla string which does not report variant.
        if (variantTest == 0x6A) { //"j"
            fromJummBox = true;
            charIndex++;
        } else if (variantTest == 0x67) { //"g"
            fromGoldBox = true;
            charIndex++;
        } else if (variantTest == 0x75) { //"u"
            fromUltraBox = true;
            charIndex++;
        } else if (variantTest == 0x64) { //"d" 
            fromJummBox = true;
            // to-do: add explicit dogebox2 support
            //fromDogeBox2 = true;
            charIndex++;
        } else if (variantTest == 0x61) { //"a" Abyssbox does urls the same as ultrabox //not quite anymore, but oh well
            fromUltraBox = true;
            charIndex++;
        } else if (variantTest == 0x73) { //"s"
            fromSlarmoosBox = true
            charIndex++;
        } else {
            fromBeepBox = true;
        }

        const version: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
        if (fromBeepBox && (version == -1 || version > Song._latestBeepboxVersion || version < Song._oldestBeepboxVersion)) return;
        if (fromJummBox && (version == -1 || version > Song._latestJummBoxVersion || version < Song._oldestJummBoxVersion)) return;
        if (fromGoldBox && (version == -1 || version > Song._latestGoldBoxVersion || version < Song._oldestGoldBoxVersion)) return;
        if (fromUltraBox && (version == -1 || version > Song._latestUltraBoxVersion || version < Song._oldestUltraBoxVersion)) return;
        if (fromSlarmoosBox && (version == -1 || version > Song._latestSlarmoosBoxVersion || version < Song._oldestSlarmoosBoxVersion)) return;
        const beforeTwo: boolean = version < 2;
        const beforeThree: boolean = version < 3;
        const beforeFour: boolean = version < 4;
        const beforeFive: boolean = version < 5;
        const beforeSix: boolean = version < 6;
        const beforeSeven: boolean = version < 7;
        const beforeEight: boolean = version < 8;
        const beforeNine: boolean = version < 9;
        this.initToDefault((fromBeepBox && beforeNine) || ((fromJummBox && beforeFive) || (beforeFour && fromGoldBox)));
        const forceSimpleFilter: boolean = (fromBeepBox && beforeNine || fromJummBox && beforeFive);

        let willLoadLegacySamplesForOldSongs: boolean = false;

        if (fromSlarmoosBox || fromUltraBox || fromGoldBox) {
            compressed = compressed.replaceAll("%7C", "|");
            var compressed_array = compressed.split("||");
            const pluginurl: string | null = compressed_array.length < 2 ? null : compressed_array[1];
            compressed_array = compressed_array[0].split("|");
            compressed = compressed_array.shift()!;
            if (EditorConfig.customSamples == null || EditorConfig.customSamples.join(", ") != compressed_array.join(", ")) {

                Song._restoreChipWaveListToDefault();

                let willLoadLegacySamples = false;
                let willLoadNintariboxSamples = false;
                let willLoadMarioPaintboxSamples = false;
                const customSampleUrls: string[] = [];
                const customSamplePresets: Preset[] = [];
                sampleLoadingState.statusTable = {};
                sampleLoadingState.urlTable = {};
                sampleLoadingState.totalSamples = 0;
                sampleLoadingState.samplesLoaded = 0;
                sampleLoadEvents.dispatchEvent(new SampleLoadedEvent(
                    sampleLoadingState.totalSamples,
                    sampleLoadingState.samplesLoaded
                ));
                for (const url of compressed_array) {
                    if (url.toLowerCase() === "legacysamples") {
                        if (!willLoadLegacySamples) {
                            willLoadLegacySamples = true;
                            customSampleUrls.push(url);
                            loadBuiltInSamples(0);
                        }
                    } else if (url.toLowerCase() === "nintariboxsamples") {
                        if (!willLoadNintariboxSamples) {
                            willLoadNintariboxSamples = true;
                            customSampleUrls.push(url);
                            loadBuiltInSamples(1);
                        }
                    } else if (url.toLowerCase() === "mariopaintboxsamples") {
                        if (!willLoadMarioPaintboxSamples) {
                            willLoadMarioPaintboxSamples = true;
                            customSampleUrls.push(url);
                            loadBuiltInSamples(2);
                        }
                    } else {
                        // UB version 2 URLs and below will be using the old syntax, so we do need to parse it in that case.
                        // UB version 3 URLs should only have the new syntax, though, unless the user has edited the URL manually.
                        const parseOldSyntax: boolean = beforeThree;
                        if (this.updateSynthSamplesStart && this.updateSynthSamplesFinish) {
                            const ok: boolean = Song._parseAndConfigureCustomSample(url, customSampleUrls, customSamplePresets, sampleLoadingState, parseOldSyntax, this.updateSynthSamplesStart, this.updateSynthSamplesFinish);
                            if (!ok) {
                                continue;
                            }
                        }
                    }
                }
                if (customSampleUrls.length > 0) {
                    EditorConfig.customSamples = customSampleUrls;
                }
                if (customSamplePresets.length > 0) {
                    const customSamplePresetsMap: DictionaryArray<Preset> = toNameMap(customSamplePresets);
                    EditorConfig.presetCategories[EditorConfig.presetCategories.length] = {
                        name: "Custom Sample Presets",
                        presets: customSamplePresetsMap,
                        index: EditorConfig.presetCategories.length,
                    };
                    // EditorConfig.presetCategories.splice(1, 0, {
                    // name: "Custom Sample Presets",
                    // presets: customSamplePresets,
                    // index: EditorConfig.presetCategories.length,
                    // });
                }


            }
            //samplemark

            //set the pluginurl
            if (this.pluginurl != pluginurl) {
                this.pluginurl = pluginurl;
                if (pluginurl && this.updateSynthPlugin) this.fetchPlugin(pluginurl, this.updateSynthPlugin);
            }
        }

        if (beforeThree && fromBeepBox) {
            // Originally, the only instrument transition was "instant" and the only drum wave was "retro".
            for (const channel of this.channels) {
                channel.instruments[0].transition = Config.transitions.dictionary["interrupt"].index;
                channel.instruments[0].effects |= 1 << EffectType.transition;
            }
            this.channels[3].instruments[0].chipNoise = 0;
        }

        let legacySettingsCache: LegacySettings[][] | null = null;
        if ((fromBeepBox && beforeNine) || ((fromJummBox && beforeFive) || (beforeFour && fromGoldBox))) {
            // Unfortunately, old versions of BeepBox had a variety of different ways of saving
            // filter-and-envelope-related parameters in the URL, and none of them directly
            // correspond to the new way of saving these parameters. We can approximate the old
            // settings by collecting all the old settings for an instrument and passing them to
            // convertLegacySettings(), so I use this data structure to collect the settings
            // for each instrument if necessary.
            legacySettingsCache = [];
            for (let i: number = legacySettingsCache.length; i < this.getChannelCount(); i++) {
                legacySettingsCache[i] = [];
                for (let j: number = 0; j < Config.instrumentCountMin; j++) legacySettingsCache[i][j] = {};
            }
        }

        let legacyGlobalReverb: number = 0; // beforeNine reverb was song-global, record that reverb here and adapt it to instruments as needed.

        let instrumentChannelIterator: number = 0;
        let instrumentIndexIterator: number = -1;
        let command: number;
        let useSlowerArpSpeed: boolean = false;
        let useFastTwoNoteArp: boolean = false;
        let lastCommand: string = "none";
        while (charIndex < compressed.length) switch (command = compressed.charCodeAt(charIndex++)) {
            case SongTagCode.songTitle: {
                // Length of song name string
                var songNameLength = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                this.title = decodeURIComponent(compressed.substring(charIndex, charIndex + songNameLength));
                document.title = this.title + " - " + EditorConfig.versionDisplayName;

                charIndex += songNameLength;
            } break;
            case SongTagCode.channelCount: {
                this.pitchChannelCount = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                this.noiseChannelCount = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                if (fromBeepBox || (fromJummBox && beforeTwo)) {
                    // No mod channel support before jummbox v2
                    this.modChannelCount = 0;
                } else {
                    this.modChannelCount = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                }
                this.pitchChannelCount = validateRange(Config.pitchChannelCountMin, Config.pitchChannelCountMax, this.pitchChannelCount);
                this.noiseChannelCount = validateRange(Config.noiseChannelCountMin, Config.noiseChannelCountMax, this.noiseChannelCount);
                this.modChannelCount = validateRange(Config.modChannelCountMin, Config.modChannelCountMax, this.modChannelCount);

                for (let channelIndex = this.channels.length; channelIndex < this.getChannelCount(); channelIndex++) {
                    this.channels[channelIndex] = new Channel();
                }
                this.channels.length = this.getChannelCount();
                if ((fromBeepBox && beforeNine) || ((fromJummBox && beforeFive) || (beforeFour && fromGoldBox))) {
                    for (let i: number = legacySettingsCache!.length; i < this.getChannelCount(); i++) {
                        legacySettingsCache![i] = [];
                        for (let j: number = 0; j < Config.instrumentCountMin; j++) legacySettingsCache![i][j] = {};
                    }
                }
            } break;
            case SongTagCode.scale: {
                this.scale = clamp(0, Config.scales.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                // All the scales were jumbled around by Jummbox. Just convert to free.
                if (this.scale == Config.scales["dictionary"]["Custom"].index) {
                    for (var i = 1; i < Config.pitchesPerOctave; i++) {
                        this.scaleCustom[i] = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] == 1; // ineffiecent? yes, all we're going to do for now? hell yes
                    }
                }
                if (fromBeepBox) this.scale = 0;
            } break;
            case SongTagCode.key: {
                if (beforeSeven && fromBeepBox) {
                    this.key = clamp(0, Config.keys.length, 11 - base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    this.octave = 0;
                } else if (fromBeepBox || fromJummBox) {
                    this.key = clamp(0, Config.keys.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    this.octave = 0;
                } else if (fromGoldBox || (beforeThree && fromUltraBox)) {
                    // GoldBox (so far) didn't introduce any new keys, but old
                    // songs made with early versions of UltraBox share the
                    // same URL format, and those can have more keys. This
                    // shouldn't really result in anything other than 0-11 for
                    // the key and 0 for the octave for GoldBox songs.
                    const rawKeyIndex: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    const [key, octave]: [number, number] = convertLegacyKeyToKeyAndOctave(rawKeyIndex);
                    this.key = key;
                    this.octave = octave;
                } else {
                    this.key = clamp(0, Config.keys.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    this.octave = clamp(Config.octaveMin, Config.octaveMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + Config.octaveMin);
                }
            } break;
            case SongTagCode.loopStart: {
                if (beforeFive && fromBeepBox) {
                    this.loopStart = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                } else {
                    this.loopStart = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                }
            } break;
            case SongTagCode.loopEnd: {
                if (beforeFive && fromBeepBox) {
                    this.loopLength = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                } else {
                    this.loopLength = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
                }
            } break;
            case SongTagCode.tempo: {
                if (beforeFour && fromBeepBox) {
                    this.tempo = [95, 120, 151, 190][base64CharCodeToInt[compressed.charCodeAt(charIndex++)]];
                } else if (beforeSeven && fromBeepBox) {
                    this.tempo = [88, 95, 103, 111, 120, 130, 140, 151, 163, 176, 190, 206, 222, 240, 259][base64CharCodeToInt[compressed.charCodeAt(charIndex++)]];
                } else {
                    this.tempo = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) | (base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
                this.tempo = clamp(Config.tempoMin, Config.tempoMax + 1, this.tempo);
            } break;
            case SongTagCode.sequences: { //deprecated song reverb tag repurposed for sequences
                if (beforeNine && fromBeepBox) {
                    legacyGlobalReverb = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] * 12;
                    legacyGlobalReverb = clamp(0, Config.reverbRange, legacyGlobalReverb);
                } else if ((fromJummBox && beforeFive) || (beforeFour && fromGoldBox)) {
                    legacyGlobalReverb = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    legacyGlobalReverb = clamp(0, Config.reverbRange, legacyGlobalReverb);
                } else if (fromSlarmoosBox) {
                    const sequenceCount: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    for (let seq: number = 0; seq < sequenceCount; seq++) {
                        this.sequences[seq] = new SequenceSettings()
                        this.sequences[seq].height = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        this.sequences[seq].length = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        for (let j: number = 0; j < this.sequences[seq].length; j++) {
                            this.sequences[seq].values[j] = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        }
                    }
                } else {
                    // Do nothing, BeepBox v9+ do not support song-wide reverb - JummBox still does via modulator.
                }
            } break;
            case SongTagCode.beatCount: {
                if (beforeThree && fromBeepBox) {
                    this.beatsPerBar = [6, 7, 8, 9, 10][base64CharCodeToInt[compressed.charCodeAt(charIndex++)]];
                } else {
                    this.beatsPerBar = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
                }
                this.beatsPerBar = Math.max(Config.beatsPerBarMin, Math.min(Config.beatsPerBarMax, this.beatsPerBar));
            } break;
            case SongTagCode.barCount: {
                const barCount: number = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
                this.barCount = validateRange(Config.barCountMin, Config.barCountMax, barCount);
                for (let channelIndex: number = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                    for (let bar = this.channels[channelIndex].bars.length; bar < this.barCount; bar++) {
                        this.channels[channelIndex].bars[bar] = (bar < 4) ? 1 : 0;
                    }
                    this.channels[channelIndex].bars.length = this.barCount;
                }
            } break;
            case SongTagCode.patternCount: {
                let patternsPerChannel: number;
                if (beforeEight && fromBeepBox) {
                    patternsPerChannel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
                } else {
                    patternsPerChannel = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
                }
                this.patternsPerChannel = validateRange(1, Config.barCountMax, patternsPerChannel);
                const channelCount: number = this.getChannelCount();
                for (let channelIndex: number = 0; channelIndex < channelCount; channelIndex++) {
                    const patterns: Pattern[] = this.channels[channelIndex].patterns;
                    for (let pattern = patterns.length; pattern < this.patternsPerChannel; pattern++) {
                        patterns[pattern] = new Pattern();
                    }
                    patterns.length = this.patternsPerChannel;
                }
            } break;
            case SongTagCode.instrumentCount: {
                if ((beforeNine && fromBeepBox) || ((fromJummBox && beforeFive) || (beforeFour && fromGoldBox))) {
                    const instrumentsPerChannel: number = validateRange(Config.instrumentCountMin, Config.patternInstrumentCountMax, base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + Config.instrumentCountMin);
                    this.layeredInstruments = false;
                    this.patternInstruments = (instrumentsPerChannel > 1);

                    for (let channelIndex: number = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                        const isNoiseChannel: boolean = channelIndex >= this.pitchChannelCount && channelIndex < this.pitchChannelCount + this.noiseChannelCount;
                        const isModChannel: boolean = channelIndex >= this.pitchChannelCount + this.noiseChannelCount;

                        for (let instrumentIndex: number = this.channels[channelIndex].instruments.length; instrumentIndex < instrumentsPerChannel; instrumentIndex++) {
                            this.channels[channelIndex].instruments[instrumentIndex] = new Instrument(isNoiseChannel, isModChannel);
                        }
                        this.channels[channelIndex].instruments.length = instrumentsPerChannel;
                        if (beforeSix && fromBeepBox) {
                            for (let instrumentIndex: number = 0; instrumentIndex < instrumentsPerChannel; instrumentIndex++) {
                                this.channels[channelIndex].instruments[instrumentIndex].setTypeAndReset(isNoiseChannel ? InstrumentType.noise : InstrumentType.chip, isNoiseChannel, isModChannel);
                            }
                        }

                        for (let j: number = legacySettingsCache![channelIndex].length; j < instrumentsPerChannel; j++) {
                            legacySettingsCache![channelIndex][j] = {};
                        }
                    }
                } else {
                    const instrumentsFlagBits: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    this.layeredInstruments = (instrumentsFlagBits & (1 << 1)) != 0;
                    this.patternInstruments = (instrumentsFlagBits & (1 << 0)) != 0;
                    for (let channelIndex: number = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                        let instrumentCount: number = 1;
                        if (this.layeredInstruments || this.patternInstruments) {
                            instrumentCount = validateRange(Config.instrumentCountMin, this.getMaxInstrumentsPerChannel(), base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + Config.instrumentCountMin);
                        }
                        const channel: Channel = this.channels[channelIndex];
                        const isNoiseChannel: boolean = this.getChannelIsNoise(channelIndex);
                        const isModChannel: boolean = this.getChannelIsMod(channelIndex);
                        for (let i: number = channel.instruments.length; i < instrumentCount; i++) {
                            channel.instruments[i] = new Instrument(isNoiseChannel, isModChannel);
                        }
                        channel.instruments.length = instrumentCount;
                    }
                }
            } break;
            case SongTagCode.rhythm: {
                if (!fromUltraBox && !fromSlarmoosBox) {
                    let newRhythm = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    this.rhythm = clamp(0, Config.rhythms.length, newRhythm);
                    if (fromJummBox && beforeThree || fromBeepBox) {
                        if (this.rhythm == Config.rhythms.dictionary["÷3 (triplets)"].index || this.rhythm == Config.rhythms.dictionary["÷6"].index) {
                            useSlowerArpSpeed = true;
                        }
                        if (this.rhythm >= Config.rhythms.dictionary["÷6"].index) {
                            // @TODO: This assumes that 6 and 8 are in that order, but
                            // if someone reorders Config.rhythms that may not be true,
                            // so this check probably should instead look for those
                            // specific rhythms.
                            useFastTwoNoteArp = true;
                        }
                    }
                } else if ((fromSlarmoosBox && beforeFour) || (fromUltraBox && beforeFive)) {
                    const rhythmMap = [1, 1, 0, 1, 2, 3, 4, 5];
                    this.rhythm = clamp(0, Config.rhythms.length, rhythmMap[base64CharCodeToInt[compressed.charCodeAt(charIndex++)]]);
                } else {
                    this.rhythm = clamp(0, Config.rhythms.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
            } break;
            case SongTagCode.channelOctave: {
                if (beforeThree && fromBeepBox) {
                    const channelIndex: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    this.channels[channelIndex].octave = clamp(0, Config.pitchOctaves, base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1);
                    if (channelIndex >= this.pitchChannelCount) this.channels[channelIndex].octave = 0;
                } else if ((beforeNine && fromBeepBox) || ((fromJummBox && beforeFive) || (beforeFour && fromGoldBox))) {
                    for (let channelIndex: number = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                        this.channels[channelIndex].octave = clamp(0, Config.pitchOctaves, base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1);
                        if (channelIndex >= this.pitchChannelCount) this.channels[channelIndex].octave = 0;
                    }
                } else {
                    for (let channelIndex: number = 0; channelIndex < this.pitchChannelCount; channelIndex++) {
                        this.channels[channelIndex].octave = clamp(0, Config.pitchOctaves, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                    for (let channelIndex: number = this.pitchChannelCount; channelIndex < this.getChannelCount(); channelIndex++) {
                        this.channels[channelIndex].octave = 0;
                    }
                }
            } break;
            case SongTagCode.startInstrument: {
                instrumentIndexIterator++;
                if (instrumentIndexIterator >= this.channels[instrumentChannelIterator].instruments.length) {
                    instrumentChannelIterator++;
                    instrumentIndexIterator = 0;
                }
                validateRange(0, this.channels.length - 1, instrumentChannelIterator);
                const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                // JB before v5 had custom chip and mod before pickedString and supersaw were added. Index +2.
                let instrumentType: number = validateRange(0, InstrumentType.length - 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                if ((fromJummBox && beforeFive) || (beforeFour && fromGoldBox)) {
                    if (instrumentType == InstrumentType.pickedString || instrumentType == InstrumentType.supersaw) {
                        instrumentType += 2;
                    }
                }
                // Similar story here, JB before v5 had custom chip and mod before supersaw was added. Index +1.
                else if ((fromJummBox && beforeSix) || (fromGoldBox && !beforeFour) || (fromUltraBox && beforeFive)) {
                    if (instrumentType == InstrumentType.supersaw || instrumentType == InstrumentType.customChipWave || instrumentType == InstrumentType.mod) {
                        instrumentType += 1;
                    }
                }
                instrument.setTypeAndReset(instrumentType, instrumentChannelIterator >= this.pitchChannelCount && instrumentChannelIterator < this.pitchChannelCount + this.noiseChannelCount, instrumentChannelIterator >= this.pitchChannelCount + this.noiseChannelCount);

                // Anti-aliasing was added in BeepBox 3.0 (v6->v7) and JummBox 1.3 (v1->v2 roughly but some leakage possible)
                if (((beforeSeven && fromBeepBox) || (beforeTwo && fromJummBox)) && (instrumentType == InstrumentType.chip || instrumentType == InstrumentType.customChipWave || instrumentType == InstrumentType.pwm)) {
                    instrument.aliases = true;
                    instrument.distortion = 0;
                    instrument.effects |= 1 << EffectType.distortion;
                }
                if (useSlowerArpSpeed) {
                    instrument.arpeggioSpeed = 9; // x3/4 speed. This used to be tied to rhythm, but now it is decoupled to each instrument's arp speed slider. This flag gets set when importing older songs to keep things consistent.
                }
                if (useFastTwoNoteArp) {
                    instrument.fastTwoNoteArp = true;
                }

                if (beforeSeven && fromBeepBox) {
                    // instrument.effects = 0;
                    // Chip/noise instruments had arpeggio and FM had custom interval but neither
                    // explicitly saved the chorus setting beforeSeven so enable it here.
                    if (instrument.chord != Config.chords.dictionary["simultaneous"].index) {
                        // Enable chord if it was used.
                        instrument.effects |= 1 << EffectType.chord;
                    }
                }
            } break;
            case SongTagCode.preset: {
                const presetValue: number = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) | (base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].preset = presetValue;
                // Picked string was inserted before custom chip in JB v5, so bump up preset index.
                if ((fromJummBox && beforeFive) || (beforeFour && fromGoldBox)) {
                    if (this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].preset == InstrumentType.pickedString) {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].preset = InstrumentType.customChipWave;
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].type = InstrumentType.customChipWave;
                    }
                }
                // Similar story, supersaw is also before custom chip (and mod, but mods can't have presets).
                else if ((fromJummBox && beforeSix) || (fromUltraBox && beforeFive)) {
                    if (this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].preset == InstrumentType.supersaw) {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].preset = InstrumentType.customChipWave;
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].type = InstrumentType.customChipWave;
                    }
                    // ultra code for 6-op fm maybe
                    if (this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].preset == InstrumentType.mod) {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].preset = InstrumentType.fm6op;
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].type = InstrumentType.fm6op;
                    }
                }
                // BeepBox directly tweaked "grand piano", but JB kept it the same. The most up to date version is now "grand piano 3"
                if (fromBeepBox && presetValue == EditorConfig.nameToPresetValue("grand piano 1")) {
                    this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].preset = EditorConfig.nameToPresetValue("grand piano 3")!;
                }
            } break;
            case SongTagCode.wave: {
                if (beforeThree && fromBeepBox) {
                    const legacyWaves: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 0];
                    const channelIndex: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    const instrument: Instrument = this.channels[channelIndex].instruments[0];
                    instrument.chipWave = clamp(0, Config.chipWaves.length, legacyWaves[base64CharCodeToInt[compressed.charCodeAt(charIndex++)]] | 0);

                    // Version 2 didn't save any settings for settings for filters, or envelopes,
                    // just waves, so initialize them here I guess.
                    instrument.convertLegacySettings(legacySettingsCache![channelIndex][0], forceSimpleFilter);

                } else if (beforeSix && fromBeepBox) {
                    const legacyWaves: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 0];
                    for (let channelIndex: number = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                        for (const instrument of this.channels[channelIndex].instruments) {
                            if (channelIndex >= this.pitchChannelCount) {
                                instrument.chipNoise = clamp(0, Config.chipNoises.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            } else {
                                instrument.chipWave = clamp(0, Config.chipWaves.length, legacyWaves[base64CharCodeToInt[compressed.charCodeAt(charIndex++)]] | 0);
                            }
                        }
                    }
                } else if (beforeSeven && fromBeepBox) {
                    const legacyWaves: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 0];
                    if (instrumentChannelIterator >= this.pitchChannelCount) {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipNoise = clamp(0, Config.chipNoises.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    } else {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipWave = clamp(0, Config.chipWaves.length, legacyWaves[base64CharCodeToInt[compressed.charCodeAt(charIndex++)]] | 0);
                    }
                } else {
                    if (this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].type == InstrumentType.noise) {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipNoise = clamp(0, Config.chipNoises.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    } else {
                        if (fromSlarmoosBox || fromUltraBox) {
                            const chipWaveReal = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                            const chipWaveCounter = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];

                            if (chipWaveCounter == 3) {
                                this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipWave = chipWaveReal + 186;
                            } else if (chipWaveCounter == 2) {
                                this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipWave = chipWaveReal + 124;
                            } else if (chipWaveCounter == 1) {
                                this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipWave = chipWaveReal + 62;
                            } else {
                                this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipWave = chipWaveReal;
                            }

                        } else {
                            this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipWave = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        }
                    }
                }
            } break;
            case SongTagCode.eqFilter: {
                if ((beforeNine && fromBeepBox) || (beforeFive && fromJummBox) || (beforeFour && fromGoldBox)) {
                    if (beforeSeven && fromBeepBox) {
                        const legacyToCutoff: number[] = [10, 6, 3, 0, 8, 5, 2];
                        //const pregoldToEnvelope: number[] = [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14, 16, 17, 18, 19, 20, 21, 23, 24, 25, 27, 28, 29, 32, 33, 34, 31, 11];
                        const legacyToEnvelope: string[] = ["none", "none", "none", "none", "decay 1", "decay 2", "decay 3"];

                        if (beforeThree && fromBeepBox) {
                            const channelIndex: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                            const instrument: Instrument = this.channels[channelIndex].instruments[0];
                            const legacySettings: LegacySettings = legacySettingsCache![channelIndex][0];
                            const legacyFilter: number = [1, 3, 4, 5][clamp(0, legacyToCutoff.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)])];
                            legacySettings.filterCutoff = legacyToCutoff[legacyFilter];
                            legacySettings.filterResonance = 0;
                            legacySettings.filterEnvelope = Config.envelopePresets.dictionary[legacyToEnvelope[legacyFilter]];
                            instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
                        } else if (beforeSix && fromBeepBox) {
                            for (let channelIndex: number = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                                for (let i: number = 0; i < this.channels[channelIndex].instruments.length; i++) {
                                    const instrument: Instrument = this.channels[channelIndex].instruments[i];
                                    const legacySettings: LegacySettings = legacySettingsCache![channelIndex][i];
                                    const legacyFilter: number = clamp(0, legacyToCutoff.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1);
                                    if (channelIndex < this.pitchChannelCount) {
                                        legacySettings.filterCutoff = legacyToCutoff[legacyFilter];
                                        legacySettings.filterResonance = 0;
                                        legacySettings.filterEnvelope = Config.envelopePresets.dictionary[legacyToEnvelope[legacyFilter]];
                                    } else {
                                        legacySettings.filterCutoff = 10;
                                        legacySettings.filterResonance = 0;
                                        legacySettings.filterEnvelope = Config.envelopePresets.dictionary["none"];
                                    }
                                    instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
                                }
                            }
                        } else {
                            const legacyFilter: number = clamp(0, legacyToCutoff.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                            const legacySettings: LegacySettings = legacySettingsCache![instrumentChannelIterator][instrumentIndexIterator];
                            legacySettings.filterCutoff = legacyToCutoff[legacyFilter];
                            legacySettings.filterResonance = 0;
                            legacySettings.filterEnvelope = Config.envelopePresets.dictionary[legacyToEnvelope[legacyFilter]];
                            instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
                        }
                    } else {
                        const filterCutoffRange: number = 11;
                        const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                        const legacySettings: LegacySettings = legacySettingsCache![instrumentChannelIterator][instrumentIndexIterator];
                        legacySettings.filterCutoff = clamp(0, filterCutoffRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
                    }
                } else {
                    const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                    let typeCheck: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];

                    if (fromBeepBox || typeCheck == 0) {
                        instrument.eqFilterType = false;
                        if (fromJummBox || fromGoldBox || fromUltraBox || fromSlarmoosBox)
                            typeCheck = base64CharCodeToInt[compressed.charCodeAt(charIndex++)]; // Skip to next to get control point count
                        const originalControlPointCount: number = typeCheck;
                        instrument.eqFilter.controlPointCount = clamp(0, Config.filterMaxPoints + 1, originalControlPointCount);
                        for (let i: number = instrument.eqFilter.controlPoints.length; i < instrument.eqFilter.controlPointCount; i++) {
                            instrument.eqFilter.controlPoints[i] = new FilterControlPoint();
                        }
                        for (let i: number = 0; i < instrument.eqFilter.controlPointCount; i++) {
                            const point: FilterControlPoint = instrument.eqFilter.controlPoints[i];
                            point.type = clamp(0, FilterType.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            point.freq = clamp(0, Config.filterFreqRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            point.gain = clamp(0, Config.filterGainRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        }
                        for (let i: number = instrument.eqFilter.controlPointCount; i < originalControlPointCount; i++) {
                            charIndex += 3;
                        }

                        // Get subfilters as well. Skip Index 0, is a copy of the base filter.
                        instrument.eqSubFilters[0] = instrument.eqFilter;
                        if ((fromJummBox && !beforeFive) || (fromGoldBox && !beforeFour) || fromUltraBox || fromSlarmoosBox) {
                            let usingSubFilterBitfield: number = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) | (base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            for (let j: number = 0; j < Config.filterMorphCount - 1; j++) {
                                if (usingSubFilterBitfield & (1 << j)) {
                                    // Number of control points
                                    const originalSubfilterControlPointCount: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                                    if (instrument.eqSubFilters[j + 1] == null)
                                        instrument.eqSubFilters[j + 1] = new FilterSettings();
                                    instrument.eqSubFilters[j + 1]!.controlPointCount = clamp(0, Config.filterMaxPoints + 1, originalSubfilterControlPointCount);
                                    for (let i: number = instrument.eqSubFilters[j + 1]!.controlPoints.length; i < instrument.eqSubFilters[j + 1]!.controlPointCount; i++) {
                                        instrument.eqSubFilters[j + 1]!.controlPoints[i] = new FilterControlPoint();
                                    }
                                    for (let i: number = 0; i < instrument.eqSubFilters[j + 1]!.controlPointCount; i++) {
                                        const point: FilterControlPoint = instrument.eqSubFilters[j + 1]!.controlPoints[i];
                                        point.type = clamp(0, FilterType.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                                        point.freq = clamp(0, Config.filterFreqRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                                        point.gain = clamp(0, Config.filterGainRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                                    }
                                    for (let i: number = instrument.eqSubFilters[j + 1]!.controlPointCount; i < originalSubfilterControlPointCount; i++) {
                                        charIndex += 3;
                                    }
                                }
                            }
                        }
                    }
                    else {
                        instrument.eqFilterType = true;
                        instrument.eqFilterSimpleCut = clamp(0, Config.filterSimpleCutRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        instrument.eqFilterSimplePeak = clamp(0, Config.filterSimplePeakRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
            } break;
            case SongTagCode.loopControls: {
                if (fromSlarmoosBox || fromUltraBox) {
                    if (beforeThree && fromUltraBox) {
                        // Still have to support the old and bad loop control data format written as a test, sigh.
                        const sampleLoopInfoEncodedLength = decode32BitNumber(compressed, charIndex);
                        charIndex += 6;
                        const sampleLoopInfoEncoded = compressed.slice(charIndex, charIndex + sampleLoopInfoEncodedLength);
                        charIndex += sampleLoopInfoEncodedLength;
                        interface SampleLoopInfo {
                            isUsingAdvancedLoopControls: boolean;
                            chipWaveLoopStart: number;
                            chipWaveLoopEnd: number;
                            chipWaveLoopMode: number;
                            chipWavePlayBackwards: boolean;
                            chipWaveStartOffset: number;
                        }
                        interface SampleLoopInfoEntry {
                            channel: number;
                            instrument: number;
                            info: SampleLoopInfo;
                        }
                        const sampleLoopInfo: SampleLoopInfoEntry[] = JSON.parse(atob(sampleLoopInfoEncoded));
                        for (const entry of sampleLoopInfo) {
                            const channelIndex: number = entry["channel"];
                            const instrumentIndex: number = entry["instrument"];
                            const info: SampleLoopInfo = entry["info"];
                            const instrument: Instrument = this.channels[channelIndex].instruments[instrumentIndex];
                            instrument.isUsingAdvancedLoopControls = info["isUsingAdvancedLoopControls"];
                            instrument.chipWaveLoopStart = info["chipWaveLoopStart"];
                            instrument.chipWaveLoopEnd = info["chipWaveLoopEnd"];
                            instrument.chipWaveLoopMode = info["chipWaveLoopMode"];
                            instrument.chipWavePlayBackwards = info["chipWavePlayBackwards"];
                            instrument.chipWaveStartOffset = info["chipWaveStartOffset"];
                            // @TODO: Whenever chipWaveReleaseMode is implemented, it should be set here to the default.
                        }
                    } else {
                        // Read the new loop control data format.
                        // See Song.toBase64String for details on the encodings used here.
                        const encodedLoopMode: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        const isUsingAdvancedLoopControls: boolean = Boolean(encodedLoopMode & 1);
                        const chipWaveLoopMode: number = encodedLoopMode >> 1;
                        const encodedReleaseMode: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        const chipWavePlayBackwards: boolean = Boolean(encodedReleaseMode & 1);
                        // const chipWaveReleaseMode: number = encodedReleaseMode >> 1;
                        const chipWaveLoopStart: number = decode32BitNumber(compressed, charIndex);
                        charIndex += 6;
                        const chipWaveLoopEnd: number = decode32BitNumber(compressed, charIndex);
                        charIndex += 6;
                        const chipWaveStartOffset: number = decode32BitNumber(compressed, charIndex);
                        charIndex += 6;
                        const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                        instrument.isUsingAdvancedLoopControls = isUsingAdvancedLoopControls;
                        instrument.chipWaveLoopStart = chipWaveLoopStart;
                        instrument.chipWaveLoopEnd = chipWaveLoopEnd;
                        instrument.chipWaveLoopMode = chipWaveLoopMode;
                        instrument.chipWavePlayBackwards = chipWavePlayBackwards;
                        instrument.chipWaveStartOffset = chipWaveStartOffset;
                        // instrument.chipWaveReleaseMode = chipWaveReleaseMode;
                    }
                } else if (fromGoldBox && !beforeFour && beforeSix) {
                    if (document.URL.substring(document.URL.length - 13).toLowerCase() != "legacysamples") {
                        if (!willLoadLegacySamplesForOldSongs) {
                            willLoadLegacySamplesForOldSongs = true;
                            Config.willReloadForCustomSamples = true;
                            EditorConfig.customSamples = ["legacySamples"];
                            loadBuiltInSamples(0);
                        }
                    }
                    this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipWave = clamp(0, Config.chipWaves.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 125);
                } else if ((beforeNine && fromBeepBox) || ((fromJummBox && beforeFive) || (beforeFour && fromGoldBox))) {
                    const filterResonanceRange: number = 8;
                    const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                    const legacySettings: LegacySettings = legacySettingsCache![instrumentChannelIterator][instrumentIndexIterator];
                    legacySettings.filterResonance = clamp(0, filterResonanceRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    instrument.convertLegacySettings(legacySettings, forceSimpleFilter);

                }
            } break;
            case SongTagCode.drumsetEnvelopes: {
                const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                const pregoldToEnvelope: number[] = [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14, 16, 17, 18, 19, 20, 21, 23, 24, 25, 27, 28, 29, 32, 33, 34, 31, 11];
                if ((beforeNine && fromBeepBox) || (beforeFive && fromJummBox) || (beforeFour && fromGoldBox)) {
                    if ((beforeTwo && fromGoldBox) || (!fromGoldBox && !fromUltraBox && !fromSlarmoosBox)) {

                    }
                    if (instrument.type == InstrumentType.drumset) {
                        for (let i: number = 0; i < Config.drumCount; i++) {
                            let aa: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                            if ((beforeTwo && fromGoldBox) || (!fromGoldBox && !fromUltraBox && !fromSlarmoosBox)) aa = pregoldToEnvelope[aa];
                            instrument.drumsetEnvelopes[i] = Song._envelopeFromLegacyIndex(aa).index;
                        }
                    } else {
                        // This used to be used for general filter envelopes.
                        // The presence of an envelope affects how convertLegacySettings
                        // decides the closest possible approximation, so update it.
                        const legacySettings: LegacySettings = legacySettingsCache![instrumentChannelIterator][instrumentIndexIterator];
                        let aa: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        if ((beforeTwo && fromGoldBox) || (!fromGoldBox && !fromUltraBox && !fromSlarmoosBox)) aa = pregoldToEnvelope[aa];
                        legacySettings.filterEnvelope = Song._envelopeFromLegacyIndex(aa);
                        instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
                    }
                } else {
                    // This tag is now only used for drumset filter envelopes.
                    for (let i: number = 0; i < Config.drumCount; i++) {
                        let aa: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        if ((beforeTwo && fromGoldBox) || (!fromGoldBox && !fromUltraBox && !fromSlarmoosBox)) aa = pregoldToEnvelope[aa];
                        if (!fromSlarmoosBox && aa >= 2) aa++; //2 for pitch
                        instrument.drumsetEnvelopes[i] = clamp(0, Config.envelopePresets.length, aa);
                    }
                }
            } break;
            case SongTagCode.pulseWidth: {
                const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                instrument.pulseWidth = clamp(0, Config.pulseWidthRange + (+(fromJummBox)) + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                if (fromBeepBox) {
                    // BeepBox formula
                    instrument.pulseWidth = Math.round(Math.pow(0.5, (7 - instrument.pulseWidth) * Config.pulseWidthStepPower) * Config.pulseWidthRange);

                }

                if ((beforeNine && fromBeepBox) || (beforeFive && fromJummBox) || (beforeFour && fromGoldBox)) {
                    const pregoldToEnvelope: number[] = [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14, 16, 17, 18, 19, 20, 21, 23, 24, 25, 27, 28, 29, 32, 33, 34, 31, 11];
                    const legacySettings: LegacySettings = legacySettingsCache![instrumentChannelIterator][instrumentIndexIterator];
                    let aa: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    if ((beforeTwo && fromGoldBox) || (!fromGoldBox && !fromUltraBox && !fromSlarmoosBox)) aa = pregoldToEnvelope[aa];
                    legacySettings.pulseEnvelope = Song._envelopeFromLegacyIndex(aa);
                    instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
                }

                if ((fromUltraBox && !beforeFour) || fromSlarmoosBox) {
                    instrument.decimalOffset = clamp(0, 99 + 1, (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }

            } break;
            case SongTagCode.stringSustain: {
                const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                const sustainValue: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                instrument.stringSustain = clamp(0, Config.stringSustainRange, sustainValue & 0x1F);
                instrument.stringSustainType = Config.enableAcousticSustain ? clamp(0, SustainType.length, sustainValue >> 5) : SustainType.bright;
            } break;
            case SongTagCode.fadeInOut: {
                if ((beforeNine && fromBeepBox) || ((fromJummBox && beforeFive) || (beforeFour && fromGoldBox))) {
                    // this tag was used for a combination of transition and fade in/out.
                    const legacySettings = [
                        { transition: "interrupt", fadeInSeconds: 0.0, fadeOutTicks: -1 },
                        { transition: "normal", fadeInSeconds: 0.0, fadeOutTicks: -3 },
                        { transition: "normal", fadeInSeconds: 0.025, fadeOutTicks: -3 },
                        { transition: "slide in pattern", fadeInSeconds: 0.025, fadeOutTicks: -3 },
                        { transition: "normal", fadeInSeconds: 0.04, fadeOutTicks: 6 },
                        { transition: "normal", fadeInSeconds: 0.0, fadeOutTicks: 48 },
                        { transition: "normal", fadeInSeconds: 0.0125, fadeOutTicks: 72 },
                        { transition: "normal", fadeInSeconds: 0.06, fadeOutTicks: 96 },
                        { transition: "slide in pattern", fadeInSeconds: 0.025, fadeOutTicks: -3 },
                    ];
                    if (beforeThree && fromBeepBox) {
                        const channelIndex: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        const settings = legacySettings[clamp(0, legacySettings.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)])];
                        const instrument: Instrument = this.channels[channelIndex].instruments[0];
                        instrument.fadeIn = SynthMessenger.secondsToFadeInSetting(settings.fadeInSeconds);
                        instrument.fadeOut = SynthMessenger.ticksToFadeOutSetting(settings.fadeOutTicks);
                        instrument.transition = Config.transitions.dictionary[settings.transition].index;
                        if (instrument.transition != Config.transitions.dictionary["normal"].index) {
                            // Enable transition if it was used.
                            instrument.effects |= 1 << EffectType.transition;
                        }
                    } else if (beforeSix && fromBeepBox) {
                        for (let channelIndex: number = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                            for (const instrument of this.channels[channelIndex].instruments) {
                                const settings = legacySettings[clamp(0, legacySettings.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)])];
                                instrument.fadeIn = SynthMessenger.secondsToFadeInSetting(settings.fadeInSeconds);
                                instrument.fadeOut = SynthMessenger.ticksToFadeOutSetting(settings.fadeOutTicks);
                                instrument.transition = Config.transitions.dictionary[settings.transition].index;
                                if (instrument.transition != Config.transitions.dictionary["normal"].index) {
                                    // Enable transition if it was used.
                                    instrument.effects |= 1 << EffectType.transition;
                                }
                            }
                        }
                    } else if ((beforeFour && !fromGoldBox && !fromUltraBox && !fromSlarmoosBox) || fromBeepBox) {
                        const settings = legacySettings[clamp(0, legacySettings.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)])];
                        const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                        instrument.fadeIn = SynthMessenger.secondsToFadeInSetting(settings.fadeInSeconds);
                        instrument.fadeOut = SynthMessenger.ticksToFadeOutSetting(settings.fadeOutTicks);
                        instrument.transition = Config.transitions.dictionary[settings.transition].index;
                        if (instrument.transition != Config.transitions.dictionary["normal"].index) {
                            // Enable transition if it was used.
                            instrument.effects |= 1 << EffectType.transition;
                        }
                    } else {
                        const settings = legacySettings[clamp(0, legacySettings.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)])];
                        const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                        instrument.fadeIn = SynthMessenger.secondsToFadeInSetting(settings.fadeInSeconds);
                        instrument.fadeOut = SynthMessenger.ticksToFadeOutSetting(settings.fadeOutTicks);
                        instrument.transition = Config.transitions.dictionary[settings.transition].index;

                        // Read tie-note 
                        if (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] > 0) {
                            // Set legacy tie over flag, which is only used to port notes in patterns using this instrument as tying.
                            instrument.legacyTieOver = true;

                        }
                        instrument.clicklessTransition = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] ? true : false;

                        if (instrument.transition != Config.transitions.dictionary["normal"].index || instrument.clicklessTransition) {
                            // Enable transition if it was used.
                            instrument.effects |= 1 << EffectType.transition;
                        }
                    }
                } else {
                    const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                    instrument.fadeIn = clamp(0, Config.fadeInRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    instrument.fadeOut = clamp(0, Config.fadeOutTicks.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    if (fromJummBox || fromGoldBox || fromUltraBox || fromSlarmoosBox)
                        instrument.clicklessTransition = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] ? true : false;
                }
            } break;
            case SongTagCode.songEq: { //deprecated vibrato tag repurposed for songEq
                if ((beforeNine && fromBeepBox) || ((fromJummBox && beforeFive) || (beforeFour && fromGoldBox))) {
                    if (beforeSeven && fromBeepBox) {
                        if (beforeThree && fromBeepBox) {
                            const legacyEffects: number[] = [0, 3, 2, 0];
                            const legacyEnvelopes: string[] = ["none", "none", "none", "tremolo2"];
                            const channelIndex: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                            const effect: number = clamp(0, legacyEffects.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            const instrument: Instrument = this.channels[channelIndex].instruments[0];
                            const legacySettings: LegacySettings = legacySettingsCache![channelIndex][0];
                            instrument.vibrato = legacyEffects[effect];
                            if (legacySettings.filterEnvelope == undefined || legacySettings.filterEnvelope.type == EnvelopeType.none) {
                                // Imitate the legacy tremolo with a filter envelope.
                                legacySettings.filterEnvelope = Config.envelopePresets.dictionary[legacyEnvelopes[effect]];
                                instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
                            }
                            if (instrument.vibrato != Config.vibratos.dictionary["none"].index) {
                                // Enable vibrato if it was used.
                                instrument.effects |= 1 << EffectType.vibrato;
                            }
                        } else if (beforeSix && fromBeepBox) {
                            const legacyEffects: number[] = [0, 1, 2, 3, 0, 0];
                            const legacyEnvelopes: string[] = ["none", "none", "none", "none", "tremolo5", "tremolo2"];
                            for (let channelIndex: number = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                                for (let i: number = 0; i < this.channels[channelIndex].instruments.length; i++) {
                                    const effect: number = clamp(0, legacyEffects.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                                    const instrument: Instrument = this.channels[channelIndex].instruments[i];
                                    const legacySettings: LegacySettings = legacySettingsCache![channelIndex][i];
                                    instrument.vibrato = legacyEffects[effect];
                                    if (legacySettings.filterEnvelope == undefined || legacySettings.filterEnvelope.type == EnvelopeType.none) {
                                        // Imitate the legacy tremolo with a filter envelope.
                                        legacySettings.filterEnvelope = Config.envelopePresets.dictionary[legacyEnvelopes[effect]];
                                        instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
                                    }
                                    if (instrument.vibrato != Config.vibratos.dictionary["none"].index) {
                                        // Enable vibrato if it was used.
                                        instrument.effects |= 1 << EffectType.vibrato;
                                    }
                                    if ((legacyGlobalReverb != 0 || ((fromJummBox && beforeFive) || (beforeFour && fromGoldBox))) && !this.getChannelIsNoise(channelIndex)) {
                                        // Enable reverb if it was used globaly before. (Global reverb was added before the effects option so I need to pick somewhere else to initialize instrument reverb, and I picked the vibrato command.)
                                        instrument.effects |= 1 << EffectType.reverb;
                                        instrument.reverb = legacyGlobalReverb;
                                    }
                                }
                            }
                        } else {
                            const legacyEffects: number[] = [0, 1, 2, 3, 0, 0];
                            const legacyEnvelopes: string[] = ["none", "none", "none", "none", "tremolo5", "tremolo2"];
                            const effect: number = clamp(0, legacyEffects.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                            const legacySettings: LegacySettings = legacySettingsCache![instrumentChannelIterator][instrumentIndexIterator];
                            instrument.vibrato = legacyEffects[effect];
                            if (legacySettings.filterEnvelope == undefined || legacySettings.filterEnvelope.type == EnvelopeType.none) {
                                // Imitate the legacy tremolo with a filter envelope.
                                legacySettings.filterEnvelope = Config.envelopePresets.dictionary[legacyEnvelopes[effect]];
                                instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
                            }
                            if (instrument.vibrato != Config.vibratos.dictionary["none"].index) {
                                // Enable vibrato if it was used.
                                instrument.effects |= 1 << EffectType.vibrato;
                            }
                            if (legacyGlobalReverb != 0 || ((fromJummBox && beforeFive) || (beforeFour && fromGoldBox))) {
                                // Enable reverb if it was used globaly before. (Global reverb was added before the effects option so I need to pick somewhere else to initialize instrument reverb, and I picked the vibrato command.)
                                instrument.effects |= 1 << EffectType.reverb;
                                instrument.reverb = legacyGlobalReverb;
                            }
                        }
                    } else {
                        const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                        const vibrato: number = clamp(0, Config.vibratos.length + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        instrument.vibrato = vibrato;
                        if (instrument.vibrato != Config.vibratos.dictionary["none"].index) {
                            // Enable vibrato if it was used.
                            instrument.effects |= 1 << EffectType.vibrato;
                        }
                        // Custom vibrato
                        if (vibrato == Config.vibratos.length) {
                            instrument.vibratoDepth = clamp(0, Config.modulators.dictionary["vibrato depth"].maxRawVol + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]) / 50;
                            instrument.vibratoSpeed = clamp(0, Config.modulators.dictionary["vibrato speed"].maxRawVol + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            instrument.vibratoDelay = clamp(0, Config.modulators.dictionary["vibrato delay"].maxRawVol + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]) / 2;
                            instrument.vibratoType = clamp(0, Config.vibratoTypes.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            instrument.effects |= 1 << EffectType.vibrato;
                        }
                        // Enforce standard vibrato settings
                        else {
                            instrument.vibratoDepth = Config.vibratos[instrument.vibrato].amplitude;
                            instrument.vibratoSpeed = 10; // Normal speed
                            instrument.vibratoDelay = Config.vibratos[instrument.vibrato].delayTicks / 2;
                            instrument.vibratoType = Config.vibratos[instrument.vibrato].type;
                        }
                    }
                } else {
                    // songeq
                    if (fromSlarmoosBox && !beforeFour) { //double check that it's from a valid version
                        const originalControlPointCount: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        this.eqFilter.controlPointCount = clamp(0, Config.filterMaxPoints + 1, originalControlPointCount);
                        for (let i: number = this.eqFilter.controlPoints.length; i < this.eqFilter.controlPointCount; i++) {
                            this.eqFilter.controlPoints[i] = new FilterControlPoint();
                        }
                        for (let i: number = 0; i < this.eqFilter.controlPointCount; i++) {
                            const point: FilterControlPoint = this.eqFilter.controlPoints[i];
                            point.type = clamp(0, FilterType.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            point.freq = clamp(0, Config.filterFreqRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            point.gain = clamp(0, Config.filterGainRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        }
                        for (let i: number = this.eqFilter.controlPointCount; i < originalControlPointCount; i++) {
                            charIndex += 3;
                        }

                        // Get subfilters as well. Skip Index 0, is a copy of the base filter.
                        this.eqSubFilters[0] = this.eqFilter;
                        let usingSubFilterBitfield: number = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) | (base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        for (let j: number = 0; j < Config.filterMorphCount - 1; j++) {
                            if (usingSubFilterBitfield & (1 << j)) {
                                // Number of control points
                                const originalSubfilterControlPointCount: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                                if (this.eqSubFilters[j + 1] == null)
                                    this.eqSubFilters[j + 1] = new FilterSettings();
                                this.eqSubFilters[j + 1]!.controlPointCount = clamp(0, Config.filterMaxPoints + 1, originalSubfilterControlPointCount);
                                for (let i: number = this.eqSubFilters[j + 1]!.controlPoints.length; i < this.eqSubFilters[j + 1]!.controlPointCount; i++) {
                                    this.eqSubFilters[j + 1]!.controlPoints[i] = new FilterControlPoint();
                                }
                                for (let i: number = 0; i < this.eqSubFilters[j + 1]!.controlPointCount; i++) {
                                    const point: FilterControlPoint = this.eqSubFilters[j + 1]!.controlPoints[i];
                                    point.type = clamp(0, FilterType.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                                    point.freq = clamp(0, Config.filterFreqRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                                    point.gain = clamp(0, Config.filterGainRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                                }
                                for (let i: number = this.eqSubFilters[j + 1]!.controlPointCount; i < originalSubfilterControlPointCount; i++) {
                                    charIndex += 3;
                                }
                            }
                        }
                    }
                }
            } break;
            case SongTagCode.arpeggioSpeed: {
                // Deprecated, but supported for legacy purposes
                if ((fromJummBox && beforeFive) || (beforeFour && fromGoldBox)) {
                    const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                    instrument.arpeggioSpeed = clamp(0, Config.modulators.dictionary["arp speed"].maxRawVol + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    instrument.fastTwoNoteArp = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] ? true : false; // Two note arp setting piggybacks on this
                }
                else {
                    // Do nothing, deprecated for now
                }
            } break;
            case SongTagCode.unison: {
                if (beforeThree && fromBeepBox) {
                    const channelIndex: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    const instrument = this.channels[channelIndex].instruments[0];
                    instrument.unison = clamp(0, Config.unisons.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    instrument.unisonVoices = Config.unisons[instrument.unison].voices;
                    instrument.unisonSpread = Config.unisons[instrument.unison].spread;
                    instrument.unisonOffset = Config.unisons[instrument.unison].offset;
                    instrument.unisonExpression = Config.unisons[instrument.unison].expression;
                    instrument.unisonSign = Config.unisons[instrument.unison].sign;
                } else if (beforeSix && fromBeepBox) {
                    for (let channelIndex: number = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                        for (const instrument of this.channels[channelIndex].instruments) {
                            const originalValue: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                            let unison: number = clamp(0, Config.unisons.length, originalValue);
                            if (originalValue == 8) {
                                // original "custom harmony" now maps to "hum" and "custom interval".
                                unison = 2;
                                instrument.chord = 3;
                            }
                            instrument.unison = unison;
                            instrument.unisonVoices = Config.unisons[instrument.unison].voices;
                            instrument.unisonSpread = Config.unisons[instrument.unison].spread;
                            instrument.unisonOffset = Config.unisons[instrument.unison].offset;
                            instrument.unisonExpression = Config.unisons[instrument.unison].expression;
                            instrument.unisonSign = Config.unisons[instrument.unison].sign;
                        }
                    }
                } else if (beforeSeven && fromBeepBox) {
                    const originalValue: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    let unison: number = clamp(0, Config.unisons.length, originalValue);
                    const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                    if (originalValue == 8) {
                        // original "custom harmony" now maps to "hum" and "custom interval".
                        unison = 2;
                        instrument.chord = 3;
                    }
                    instrument.unison = unison;
                    instrument.unisonVoices = Config.unisons[instrument.unison].voices;
                    instrument.unisonSpread = Config.unisons[instrument.unison].spread;
                    instrument.unisonOffset = Config.unisons[instrument.unison].offset;
                    instrument.unisonExpression = Config.unisons[instrument.unison].expression;
                    instrument.unisonSign = Config.unisons[instrument.unison].sign;
                } else {
                    const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                    instrument.unison = clamp(0, Config.unisons.length + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    const unisonLength = (beforeFive || !fromSlarmoosBox) ? 27 : Config.unisons.length; //27 was the old length before I added >2 voice presets
                    if (((fromUltraBox && !beforeFive) || fromSlarmoosBox) && (instrument.unison == unisonLength)) {
                        // if (instrument.unison == Config.unisons.length) {
                        instrument.unison = Config.unisons.length;
                        instrument.unisonVoices = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];

                        const unisonSpreadNegative = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        const unisonSpread: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + ((base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] * 63)) * 63);

                        const unisonOffsetNegative = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        const unisonOffset: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + ((base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] * 63)) * 63);

                        const unisonExpressionNegative = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        const unisonExpression: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] * 63);

                        const unisonSignNegative = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        const unisonSign: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] * 63);

                        if (fromSlarmoosBox && !beforeSix) {
                            let booleans: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                            instrument.unisonAntiPhased = (booleans & 1) == 1;
                            booleans >>= 1;
                            instrument.unisonBuzzes = (booleans & 1) == 1;
                        }


                        instrument.unisonSpread = unisonSpread / 1000;
                        if (unisonSpreadNegative == 0) instrument.unisonSpread *= -1;

                        instrument.unisonOffset = unisonOffset / 1000;
                        if (unisonOffsetNegative == 0) instrument.unisonOffset *= -1;

                        instrument.unisonExpression = unisonExpression / 1000;
                        if (unisonExpressionNegative == 0) instrument.unisonExpression *= -1;

                        instrument.unisonSign = unisonSign / 1000;
                        if (unisonSignNegative == 0) instrument.unisonSign *= -1;
                    } else {
                        instrument.unisonVoices = Config.unisons[instrument.unison].voices;
                        instrument.unisonSpread = Config.unisons[instrument.unison].spread;
                        instrument.unisonOffset = Config.unisons[instrument.unison].offset;
                        instrument.unisonExpression = Config.unisons[instrument.unison].expression;
                        instrument.unisonSign = Config.unisons[instrument.unison].sign;
                        instrument.unisonAntiPhased = false; //TODO: make antiPhased presets
                        instrument.unisonBuzzes = false;
                    }
                }

            } break;
            case SongTagCode.chord: {
                if ((beforeNine && fromBeepBox) || ((fromJummBox && beforeFive) || (beforeFour && fromGoldBox))) {
                    const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                    instrument.chord = clamp(0, Config.chords.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    if (instrument.chord != Config.chords.dictionary["simultaneous"].index) {
                        // Enable chord if it was used.
                        instrument.effects |= 1 << EffectType.chord;
                    }
                } else {
                    // Do nothing? This song tag code is deprecated for now.
                }
            } break;
            case SongTagCode.effects: {
                const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                if ((beforeNine && fromBeepBox) || ((fromJummBox && beforeFive) || (beforeFour && fromGoldBox))) {
                    instrument.effects = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] & ((1 << EffectType.length) - 1));
                    if (legacyGlobalReverb == 0 && !((fromJummBox && beforeFive) || (beforeFour && fromGoldBox))) {
                        // Disable reverb if legacy song reverb was zero.
                        instrument.effects &= ~(1 << EffectType.reverb);
                    } else if (effectsIncludeReverb(instrument.effects)) {
                        instrument.reverb = legacyGlobalReverb;
                    }
                    // @jummbus - Enabling pan effect on song import no matter what to make it a default.
                    //if (instrument.pan != Config.panCenter) {
                    instrument.effects |= 1 << EffectType.panning;
                    //}
                    if (instrument.vibrato != Config.vibratos.dictionary["none"].index) {
                        // Enable vibrato if it was used.
                        instrument.effects |= 1 << EffectType.vibrato;
                    }
                    if (instrument.detune != Config.detuneCenter) {
                        // Enable detune if it was used.
                        instrument.effects |= 1 << EffectType.detune;
                    }
                    if (instrument.aliases)
                        instrument.effects |= 1 << EffectType.distortion;
                    else
                        instrument.effects &= ~(1 << EffectType.distortion);

                    // convertLegacySettings may need to force-enable note filter, call
                    // it again here to make sure that this override takes precedence.
                    const legacySettings: LegacySettings = legacySettingsCache![instrumentChannelIterator][instrumentIndexIterator];
                    instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
                } else {
                    // BeepBox currently uses three base64 characters at 6 bits each for a bitfield representing all the enabled effects.
                    if (EffectType.length > 18) throw new Error("Edit the url to allow for more effect types");
                    if (fromSlarmoosBox && !beforeFive) {
                        instrument.effects = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 12) | (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) | (base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    } else {
                        instrument.effects = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) | (base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }

                    if (effectsIncludeNoteFilter(instrument.effects)) {
                        let typeCheck: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        if (fromBeepBox || typeCheck == 0) {
                            instrument.noteFilterType = false;
                            if (fromJummBox || fromGoldBox || fromUltraBox || fromSlarmoosBox)
                                typeCheck = base64CharCodeToInt[compressed.charCodeAt(charIndex++)]; // Skip to next index in jummbox to get actual count
                            instrument.noteFilter.controlPointCount = clamp(0, Config.filterMaxPoints + 1, typeCheck);
                            for (let i: number = instrument.noteFilter.controlPoints.length; i < instrument.noteFilter.controlPointCount; i++) {
                                instrument.noteFilter.controlPoints[i] = new FilterControlPoint();
                            }
                            for (let i: number = 0; i < instrument.noteFilter.controlPointCount; i++) {
                                const point: FilterControlPoint = instrument.noteFilter.controlPoints[i];
                                point.type = clamp(0, FilterType.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                                point.freq = clamp(0, Config.filterFreqRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                                point.gain = clamp(0, Config.filterGainRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            }
                            for (let i: number = instrument.noteFilter.controlPointCount; i < typeCheck; i++) {
                                charIndex += 3;
                            }

                            // Get subfilters as well. Skip Index 0, is a copy of the base filter.
                            instrument.noteSubFilters[0] = instrument.noteFilter;
                            if ((fromJummBox && !beforeFive) || (fromGoldBox) || (fromUltraBox) || (fromSlarmoosBox)) {
                                let usingSubFilterBitfield: number = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) | (base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                                for (let j: number = 0; j < Config.filterMorphCount - 1; j++) {
                                    if (usingSubFilterBitfield & (1 << j)) {
                                        // Number of control points
                                        const originalSubfilterControlPointCount: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                                        if (instrument.noteSubFilters[j + 1] == null)
                                            instrument.noteSubFilters[j + 1] = new FilterSettings();
                                        instrument.noteSubFilters[j + 1]!.controlPointCount = clamp(0, Config.filterMaxPoints + 1, originalSubfilterControlPointCount);
                                        for (let i: number = instrument.noteSubFilters[j + 1]!.controlPoints.length; i < instrument.noteSubFilters[j + 1]!.controlPointCount; i++) {
                                            instrument.noteSubFilters[j + 1]!.controlPoints[i] = new FilterControlPoint();
                                        }
                                        for (let i: number = 0; i < instrument.noteSubFilters[j + 1]!.controlPointCount; i++) {
                                            const point: FilterControlPoint = instrument.noteSubFilters[j + 1]!.controlPoints[i];
                                            point.type = clamp(0, FilterType.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                                            point.freq = clamp(0, Config.filterFreqRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                                            point.gain = clamp(0, Config.filterGainRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                                        }
                                        for (let i: number = instrument.noteSubFilters[j + 1]!.controlPointCount; i < originalSubfilterControlPointCount; i++) {
                                            charIndex += 3;
                                        }
                                    }
                                }
                            }
                        } else {
                            instrument.noteFilterType = true;
                            instrument.noteFilter.reset();
                            instrument.noteFilterSimpleCut = clamp(0, Config.filterSimpleCutRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            instrument.noteFilterSimplePeak = clamp(0, Config.filterSimplePeakRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);

                        }
                    }
                    if (effectsIncludeTransition(instrument.effects)) {
                        instrument.transition = clamp(0, Config.transitions.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        if (fromSlarmoosBox && !beforeSix) {
                            if (Config.transitions[instrument.transition].slides == true) instrument.slideTicks = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        }
                    }
                    if (effectsIncludeChord(instrument.effects)) {
                        instrument.chord = clamp(0, Config.chords.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        // Custom arpeggio speed... only in JB, and only if the instrument arpeggiates.
                        if (Config.chords[instrument.chord].arpeggiates == true && (fromJummBox || fromGoldBox || fromUltraBox || fromSlarmoosBox)) {
                            instrument.arpeggioSpeed = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                            instrument.fastTwoNoteArp = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)]) ? true : false;
                        }
                        if (Config.chords[instrument.chord].strumParts > 0 && (fromSlarmoosBox && !beforeSix)) {
                            instrument.strumParts = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        }
                        if (instrument.chord == Config.chords.dictionary["monophonic"].index && fromSlarmoosBox && !beforeFive) {
                            instrument.monoChordTone = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        }
                    }
                    if (effectsIncludePitchShift(instrument.effects)) {
                        instrument.pitchShift = clamp(0, Config.pitchShiftRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                    if (effectsIncludeDetune(instrument.effects)) {
                        if (fromBeepBox) {
                            // Convert from BeepBox's formula
                            instrument.detune = clamp(Config.detuneMin, Config.detuneMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            instrument.detune = Math.round((instrument.detune - 9) * (Math.abs(instrument.detune - 9) + 1) / 2 + Config.detuneCenter);
                        } else {
                            instrument.detune = clamp(Config.detuneMin, Config.detuneMax + 1, (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        }
                    }
                    if (effectsIncludeVibrato(instrument.effects)) {
                        instrument.vibrato = clamp(0, Config.vibratos.length + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);

                        // Custom vibrato
                        if (instrument.vibrato == Config.vibratos.length && (fromJummBox || fromGoldBox || fromUltraBox || fromSlarmoosBox)) {
                            instrument.vibratoDepth = clamp(0, Config.modulators.dictionary["vibrato depth"].maxRawVol + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]) / 25;
                            instrument.vibratoSpeed = clamp(0, Config.modulators.dictionary["vibrato speed"].maxRawVol + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            instrument.vibratoDelay = clamp(0, Config.modulators.dictionary["vibrato delay"].maxRawVol + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            instrument.vibratoType = clamp(0, Config.vibratoTypes.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        }
                        // Enforce standard vibrato settings
                        else {
                            instrument.vibratoDepth = Config.vibratos[instrument.vibrato].amplitude;
                            instrument.vibratoSpeed = 10; // Normal speed
                            instrument.vibratoDelay = Config.vibratos[instrument.vibrato].delayTicks / 2;
                            instrument.vibratoType = Config.vibratos[instrument.vibrato].type;
                        }
                    }
                    if (effectsIncludeDistortion(instrument.effects)) {
                        instrument.distortion = clamp(0, Config.distortionRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        if ((fromJummBox && !beforeFive) || fromGoldBox || fromUltraBox || fromSlarmoosBox)
                            instrument.aliases = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] ? true : false;
                    }
                    if (effectsIncludeBitcrusher(instrument.effects)) {
                        instrument.bitcrusherFreq = clamp(0, Config.bitcrusherFreqRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        instrument.bitcrusherQuantization = clamp(0, Config.bitcrusherQuantizationRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                    if (effectsIncludePanning(instrument.effects)) {
                        if (fromBeepBox) {
                            // Beepbox has a panMax of 8 (9 total positions), Jummbox has a panMax of 100 (101 total positions)
                            instrument.pan = clamp(0, Config.panMax + 1, Math.round(base64CharCodeToInt[compressed.charCodeAt(charIndex++)] * ((Config.panMax) / 8.0)));
                        }
                        else {
                            instrument.pan = clamp(0, Config.panMax + 1, (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        }

                        // Now, pan delay follows on new versions of jummbox.
                        if ((fromJummBox && !beforeTwo) || fromGoldBox || fromUltraBox || fromSlarmoosBox)
                            instrument.panDelay = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    }
                    if (effectsIncludeChorus(instrument.effects)) {
                        if (fromBeepBox) {
                            // BeepBox has 4 chorus values vs. JB's 8
                            instrument.chorus = clamp(0, (Config.chorusRange / 2) + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]) * 2;
                        }
                        else {
                            instrument.chorus = clamp(0, Config.chorusRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        }
                    }
                    if (effectsIncludeEcho(instrument.effects)) {
                        instrument.echoSustain = clamp(0, Config.echoSustainRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        instrument.echoDelay = clamp(0, Config.echoDelayRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                    if (effectsIncludeReverb(instrument.effects)) {
                        if (fromBeepBox) {
                            instrument.reverb = clamp(0, Config.reverbRange, Math.round(base64CharCodeToInt[compressed.charCodeAt(charIndex++)] * Config.reverbRange / 3.0));
                        } else {
                            instrument.reverb = clamp(0, Config.reverbRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        }
                    }
                    if (effectsIncludeNoteRange(instrument.effects)) {
                        instrument.upperNoteLimit = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        instrument.lowerNoteLimit = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    }
                    if (effectsIncludeGranular(instrument.effects)) {
                        instrument.granular = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        instrument.grainSize = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        instrument.grainFreq = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        instrument.grainRange = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    }
                    if (effectsIncludeRingModulation(instrument.effects)) {
                        instrument.ringModulation = clamp(0, Config.ringModRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        instrument.ringModulationHz = clamp(0, Config.ringModHzRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        instrument.ringModWaveformIndex = clamp(0, Config.operatorWaves.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        instrument.ringModPulseWidth = clamp(0, Config.pulseWidthRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        instrument.ringModHzOffset = clamp(Config.rmHzOffsetMin, Config.rmHzOffsetMax + 1, (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                    if (effectsIncludePlugin(instrument.effects)) {
                        const pluginValueCount = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        for (let i: number = 0; i < pluginValueCount; i++) {
                            instrument.pluginValues[i] = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        }
                    }
                }
                // Clamp the range.
                instrument.effects &= (1 << EffectType.length) - 1;
            } break;
            case SongTagCode.volume: {
                if (beforeThree && fromBeepBox) {
                    const channelIndex: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    const instrument: Instrument = this.channels[channelIndex].instruments[0];
                    instrument.volume = Math.round(clamp(-Config.volumeRange / 2, 1, -base64CharCodeToInt[compressed.charCodeAt(charIndex++)] * 5.0));
                } else if (beforeSix && fromBeepBox) {
                    for (let channelIndex: number = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                        for (const instrument of this.channels[channelIndex].instruments) {
                            instrument.volume = Math.round(clamp(-Config.volumeRange / 2, 1, -base64CharCodeToInt[compressed.charCodeAt(charIndex++)] * 5.0));
                        }
                    }
                } else if (beforeSeven && fromBeepBox) {
                    const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                    instrument.volume = Math.round(clamp(-Config.volumeRange / 2, 1, -base64CharCodeToInt[compressed.charCodeAt(charIndex++)] * 5.0));
                } else if (fromBeepBox) {
                    // Beepbox v9's volume range is 0-7 (0 is max, 7 is mute)
                    const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                    instrument.volume = Math.round(clamp(-Config.volumeRange / 2, 1, -base64CharCodeToInt[compressed.charCodeAt(charIndex++)] * 25.0 / 7.0));
                } else {
                    const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                    // Volume is stored in two bytes in jummbox just in case range ever exceeds one byte, e.g. through later waffling on the subject.
                    instrument.volume = Math.round(clamp(-Config.volumeRange / 2, Config.volumeRange / 2 + 1, ((base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) | (base64CharCodeToInt[compressed.charCodeAt(charIndex++)])) - Config.volumeRange / 2));
                }
            } break;
            case SongTagCode.pan: {
                if (beforeNine && fromBeepBox) {
                    // Beepbox has a panMax of 8 (9 total positions), Jummbox has a panMax of 100 (101 total positions)
                    const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                    instrument.pan = clamp(0, Config.panMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)] * ((Config.panMax) / 8.0));
                } else if ((fromJummBox && beforeFive) || (beforeFour && fromGoldBox)) {
                    const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                    instrument.pan = clamp(0, Config.panMax + 1, (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    // Pan delay follows on v3 + v4
                    if (fromJummBox && !beforeThree || fromGoldBox || fromUltraBox || fromSlarmoosBox) {
                        instrument.panDelay = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    }
                } else {
                    // Do nothing? This song tag code is deprecated for now.
                }
            } break;
            case SongTagCode.detune: {
                const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];

                if ((fromJummBox && beforeFive) || (beforeFour && fromGoldBox)) {
                    // Before jummbox v5, detune was -50 to 50. Now it is 0 to 400
                    instrument.detune = clamp(Config.detuneMin, Config.detuneMax + 1, ((base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)]) * 4);
                    instrument.effects |= 1 << EffectType.detune;
                } else {
                    // Now in v5, tag code is deprecated and handled thru detune effects.
                }
            } break;
            case SongTagCode.customChipWave: {
                let instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                // Pop custom wave values
                for (let j: number = 0; j < 64; j++) {
                    instrument.customChipWave[j]
                        = clamp(-24, 25, base64CharCodeToInt[compressed.charCodeAt(charIndex++)] - 24);
                }

                let sum: number = 0.0;
                for (let i: number = 0; i < instrument.customChipWave.length; i++) {
                    sum += instrument.customChipWave[i];
                }
                const average: number = sum / instrument.customChipWave.length;

                // Perform the integral on the wave. The chipSynth will perform the derivative to get the original wave back but with antialiasing.
                let cumulative: number = 0;
                let wavePrev: number = 0;
                for (let i: number = 0; i < instrument.customChipWave.length; i++) {
                    cumulative += wavePrev;
                    wavePrev = instrument.customChipWave[i] - average;
                    instrument.customChipWaveIntegral[i] = cumulative;
                }

                // 65th, last sample is for anti-aliasing
                instrument.customChipWaveIntegral[64] = 0.0;

            } break;
            case SongTagCode.limiterSettings: {
                let nextValue: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];

                // Check if limiter settings are used... if not, restore to default
                if (nextValue == 0x3f) {
                    this.restoreLimiterDefaults();
                }
                else {
                    // Limiter is used, grab values
                    this.compressionRatio = (nextValue < 10 ? nextValue / 10 : (1 + (nextValue - 10) / 60));
                    nextValue = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    this.limitRatio = (nextValue < 10 ? nextValue / 10 : (nextValue - 9));
                    this.limitDecay = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    this.limitRise = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] * 250.0) + 2000.0;
                    this.compressionThreshold = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] / 20.0;
                    this.limitThreshold = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] / 20.0;
                    this.masterGain = ((base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)]) / 50.0;
                }
            } break;
            case SongTagCode.channelNames: {
                for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
                    // Length of channel name string. Due to some crazy Unicode characters this needs to be 2 bytes...
                    var channelNameLength;
                    if (beforeFour && !fromGoldBox && !fromUltraBox && !fromSlarmoosBox)
                        channelNameLength = base64CharCodeToInt[compressed.charCodeAt(charIndex++)]
                    else
                        channelNameLength = ((base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    this.channels[channel].name = decodeURIComponent(compressed.substring(charIndex, charIndex + channelNameLength));

                    charIndex += channelNameLength;
                }
            } break;
            case SongTagCode.algorithm: {
                const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                if (instrument.type == InstrumentType.fm) {
                    instrument.algorithm = clamp(0, Config.algorithms.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
                else {
                    instrument.algorithm6Op = clamp(0, Config.algorithms6Op.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    instrument.customAlgorithm.fromPreset(instrument.algorithm6Op);
                    if (compressed.charCodeAt(charIndex) == SongTagCode.chord) {
                        let carrierCountTemp = clamp(1, Config.operatorCount + 2 + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex + 1)]);
                        charIndex++
                        let tempModArray: number[][] = [];
                        if (compressed.charCodeAt(charIndex + 1) == SongTagCode.effects) {
                            charIndex++
                            let j: number = 0;
                            charIndex++
                            while (compressed.charCodeAt(charIndex) != SongTagCode.effects) {
                                tempModArray[j] = [];
                                let o: number = 0;
                                while (compressed.charCodeAt(charIndex) != SongTagCode.operatorWaves) {
                                    tempModArray[j][o] = clamp(1, Config.operatorCount + 3, base64CharCodeToInt[compressed.charCodeAt(charIndex)]);
                                    o++
                                    charIndex++
                                }
                                j++;
                                charIndex++
                            }
                            instrument.customAlgorithm.set(carrierCountTemp, tempModArray);
                            charIndex++; //????
                        }
                    }
                }
                if ((beforeNine && fromBeepBox) || (beforeFive && fromJummBox) || (beforeFour && fromGoldBox)) {
                    // The algorithm determines the carrier count, which affects how legacy settings are imported.
                    const legacySettings: LegacySettings = legacySettingsCache![instrumentChannelIterator][instrumentIndexIterator];
                    instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
                }
            } break;
            case SongTagCode.supersaw: {
                if (fromGoldBox && !beforeFour && beforeSix) {
                    //is it more useful to save base64 characters or url length?
                    const chipWaveForCompat = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    if ((chipWaveForCompat + 62) > 85) {
                        if (document.URL.substring(document.URL.length - 13).toLowerCase() != "legacysamples") {
                            if (!willLoadLegacySamplesForOldSongs) {
                                willLoadLegacySamplesForOldSongs = true;
                                Config.willReloadForCustomSamples = true;
                                EditorConfig.customSamples = ["legacySamples"];
                                loadBuiltInSamples(0);
                            }
                        }
                    }

                    if ((chipWaveForCompat + 62) > 78) {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipWave = clamp(0, Config.chipWaves.length, chipWaveForCompat + 63);
                    } else if ((chipWaveForCompat + 62) > 67) {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipWave = clamp(0, Config.chipWaves.length, chipWaveForCompat + 61);
                    } else if ((chipWaveForCompat + 62) == 67) {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipWave = 40;
                    } else {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipWave = clamp(0, Config.chipWaves.length, chipWaveForCompat + 62);
                    }
                } else {
                    const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                    instrument.supersawDynamism = clamp(0, Config.supersawDynamismMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    instrument.supersawSpread = clamp(0, Config.supersawSpreadMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    instrument.supersawShape = clamp(0, Config.supersawShapeMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
            } break;
            case SongTagCode.feedbackType: {
                const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                if (instrument.type == InstrumentType.fm) {
                    instrument.feedbackType = clamp(0, Config.feedbacks.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
                else {
                    instrument.feedbackType6Op = clamp(0, Config.feedbacks6Op.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    instrument.customFeedbackType.fromPreset(instrument.feedbackType6Op);
                    let tempModArray: number[][] = [];
                    if (compressed.charCodeAt(charIndex) == SongTagCode.effects) {
                        let j: number = 0;
                        charIndex++
                        while (compressed.charCodeAt(charIndex) != SongTagCode.effects) {
                            tempModArray[j] = [];
                            let o: number = 0;
                            while (compressed.charCodeAt(charIndex) != SongTagCode.operatorWaves) {
                                tempModArray[j][o] = clamp(1, Config.operatorCount + 2, base64CharCodeToInt[compressed.charCodeAt(charIndex)]);
                                o++
                                charIndex++
                            }
                            j++;
                            charIndex++
                        }
                        instrument.customFeedbackType.set(tempModArray);
                        charIndex++; //???? weirdly needs to skip the end character or it'll use that next loop instead of like just moving to the next one itself
                    }
                }

            } break;
            case SongTagCode.feedbackAmplitude: {
                this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].feedbackAmplitude = clamp(0, Config.operatorAmplitudeMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
            } break;
            case SongTagCode.feedbackEnvelope: {
                if ((beforeNine && fromBeepBox) || (beforeFive && fromJummBox) || (beforeFour && fromGoldBox)) {
                    const pregoldToEnvelope: number[] = [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14, 16, 17, 18, 19, 20, 21, 23, 24, 25, 27, 28, 29, 32, 33, 34, 31, 11];
                    const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                    const legacySettings: LegacySettings = legacySettingsCache![instrumentChannelIterator][instrumentIndexIterator];

                    let aa: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    if ((beforeTwo && fromGoldBox) || (!fromGoldBox && !fromUltraBox && !fromSlarmoosBox)) aa = pregoldToEnvelope[aa];
                    legacySettings.feedbackEnvelope = Song._envelopeFromLegacyIndex(base64CharCodeToInt[aa]);
                    instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
                } else {
                    // Do nothing? This song tag code is deprecated for now.
                }
            } break;
            case SongTagCode.operatorFrequencies: {
                const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                if (beforeThree && fromGoldBox) {
                    const freqToGold3 = [4, 5, 6, 7, 8, 10, 12, 13, 14, 15, 16, 18, 20, 22, 24, 2, 1, 9, 17, 19, 21, 23, 0, 3];

                    for (let o = 0; o < (instrument.type == InstrumentType.fm6op ? 6 : Config.operatorCount); o++) {
                        instrument.operators[o].frequency = freqToGold3[clamp(0, freqToGold3.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)])];
                    }
                }
                else if (!fromGoldBox && !fromUltraBox && !fromSlarmoosBox) {
                    const freqToUltraBox = [4, 5, 6, 7, 8, 10, 12, 13, 14, 15, 16, 18, 20, 23, 27, 2, 1, 9, 17, 19, 21, 23, 0, 3];

                    for (let o = 0; o < (instrument.type == InstrumentType.fm6op ? 6 : Config.operatorCount); o++) {
                        instrument.operators[o].frequency = freqToUltraBox[clamp(0, freqToUltraBox.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)])];
                    }

                }
                else {
                    for (let o = 0; o < (instrument.type == InstrumentType.fm6op ? 6 : Config.operatorCount); o++) {
                        instrument.operators[o].frequency = clamp(0, Config.operatorFrequencies.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
            } break;
            case SongTagCode.operatorAmplitudes: {
                const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                for (let o: number = 0; o < (instrument.type == InstrumentType.fm6op ? 6 : Config.operatorCount); o++) {
                    instrument.operators[o].amplitude = clamp(0, Config.operatorAmplitudeMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
            } break;
            case SongTagCode.envelopes: {
                const pregoldToEnvelope: number[] = [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14, 16, 17, 18, 19, 20, 21, 23, 24, 25, 27, 28, 29, 32, 33, 34, 31, 11];
                const jummToUltraEnvelope: number[] = [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14, 16, 17, 18, 19, 20, 21, 23, 24, 25, 58, 59, 60];
                const slarURL3toURL4Envelope: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 8, 9, 10, 11, 12, 13, 14];
                const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                if ((beforeNine && fromBeepBox) || (beforeFive && fromJummBox) || (beforeFour && fromGoldBox)) {
                    const legacySettings: LegacySettings = legacySettingsCache![instrumentChannelIterator][instrumentIndexIterator];
                    legacySettings.operatorEnvelopes = [];
                    for (let o: number = 0; o < (instrument.type == InstrumentType.fm6op ? 6 : Config.operatorCount); o++) {
                        let aa: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        if ((beforeTwo && fromGoldBox) || (fromBeepBox)) aa = pregoldToEnvelope[aa];
                        if (fromJummBox) aa = jummToUltraEnvelope[aa];
                        legacySettings.operatorEnvelopes[o] = Song._envelopeFromLegacyIndex(aa);
                    }
                    instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
                } else {
                    const envelopeCount: number = clamp(0, Config.maxEnvelopeCount + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    // JB v6 adds some envelope options here in the sequence.
                    let envelopeDiscrete: boolean = false;
                    if ((fromJummBox && !beforeSix) || (fromUltraBox && !beforeFive) || (fromSlarmoosBox)) {
                        instrument.envelopeSpeed = clamp(0, Config.modulators.dictionary["envelope speed"].maxRawVol + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        if (!fromSlarmoosBox || beforeFive) {
                            envelopeDiscrete = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)]) ? true : false;
                        }
                    }
                    for (let i: number = 0; i < envelopeCount; i++) {
                        const target: number = clamp(0, Config.instrumentAutomationTargets.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        let index: number = 0;
                        const maxCount: number = Config.instrumentAutomationTargets[target].maxCount;
                        if (maxCount > 1) {
                            index = clamp(0, maxCount, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        }
                        let aa: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        if ((beforeTwo && fromGoldBox) || (fromBeepBox)) aa = pregoldToEnvelope[aa];
                        if (fromJummBox) aa = jummToUltraEnvelope[aa];
                        if (!fromSlarmoosBox && aa >= 2) aa++; //2 for pitch
                        let updatedEnvelopes: boolean = false;
                        let perEnvelopeSpeed: number = 1;
                        if (!fromSlarmoosBox || beforeThree) {
                            updatedEnvelopes = true;
                            perEnvelopeSpeed = Config.envelopePresets[aa].speed;
                            aa = Config.envelopePresets[aa].type; //update envelopes
                        } else if (beforeFour && aa >= 3) aa++; //3 for random
                        let isTremolo2: boolean = false;
                        if ((fromSlarmoosBox && !beforeThree && beforeFour) || updatedEnvelopes) { //remove tremolo2
                            if (aa == 9) isTremolo2 = true;
                            aa = slarURL3toURL4Envelope[aa];
                        }
                        const envelope: number = clamp(0, ((fromSlarmoosBox && !beforeThree || updatedEnvelopes) ? Config.envelopes.length : Config.envelopePresets.length), aa);
                        let pitchEnvelopeStart: number = 0;
                        let pitchEnvelopeEnd: number = Config.maxPitch;
                        let envelopeInverse: boolean = false;
                        perEnvelopeSpeed = (fromSlarmoosBox && !beforeThree) ? Config.envelopes[envelope].speed : perEnvelopeSpeed;
                        let perEnvelopeLowerBound: number = 0;
                        let perEnvelopeUpperBound: number = 1;
                        let steps: number = 2;
                        let seed: number = 2;
                        let waveform: number = LFOEnvelopeTypes.sine;
                        //pull out unique envelope setting values first, then general ones
                        if (fromSlarmoosBox && !beforeFive) {
                            if (Config.envelopes[envelope].type == EnvelopeType.sequence) {
                                waveform = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                            }
                        }
                        if (fromSlarmoosBox && !beforeFour) {
                            if (Config.envelopes[envelope].type == EnvelopeType.lfo) {
                                waveform = clamp(0, LFOEnvelopeTypes.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                                if (waveform == LFOEnvelopeTypes.steppedSaw || waveform == LFOEnvelopeTypes.steppedTri) {
                                    steps = clamp(1, Config.randomEnvelopeStepsMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                                }
                            } else if (Config.envelopes[envelope].type == EnvelopeType.pseudorandom) {
                                steps = clamp(1, Config.randomEnvelopeStepsMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                                seed = clamp(1, Config.randomEnvelopeSeedMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                                waveform = clamp(0, RandomEnvelopeTypes.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]); //we use waveform for the random type as well
                            }
                        }
                        if (fromSlarmoosBox && !beforeThree) {
                            if (Config.envelopes[envelope].type == EnvelopeType.pitch) {
                                if (!instrument.isNoiseInstrument) {
                                    let pitchEnvelopeCompact: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                                    pitchEnvelopeStart = clamp(0, Config.maxPitch + 1, pitchEnvelopeCompact * 64 + base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                                    pitchEnvelopeCompact = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                                    pitchEnvelopeEnd = clamp(0, Config.maxPitch + 1, pitchEnvelopeCompact * 64 + base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                                } else {
                                    pitchEnvelopeStart = clamp(0, Config.drumCount, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                                    pitchEnvelopeEnd = clamp(0, Config.drumCount, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                                }
                            }
                            let checkboxValues: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                            if (fromSlarmoosBox && !beforeFive) {
                                envelopeDiscrete = (checkboxValues >> 1) == 1 ? true : false;
                            }
                            envelopeInverse = (checkboxValues & 1) == 1 ? true : false;
                            if (Config.envelopes[envelope].name != "pitch" && Config.envelopes[envelope].name != "note size" && Config.envelopes[envelope].name != "punch" && Config.envelopes[envelope].name != "none") {
                                perEnvelopeSpeed = Config.perEnvelopeSpeedIndices[base64CharCodeToInt[compressed.charCodeAt(charIndex++)]];
                            }
                            perEnvelopeLowerBound = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] / 10;
                            perEnvelopeUpperBound = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] / 10;
                        }
                        if (!fromSlarmoosBox || beforeFour) { //update tremolo2
                            if (isTremolo2) {
                                waveform = LFOEnvelopeTypes.sine;
                                if (envelopeInverse) {
                                    perEnvelopeUpperBound = Math.floor((perEnvelopeUpperBound / 2) * 10) / 10;
                                    perEnvelopeLowerBound = Math.floor((perEnvelopeLowerBound / 2) * 10) / 10;
                                } else {
                                    perEnvelopeUpperBound = Math.floor((0.5 + (perEnvelopeUpperBound - perEnvelopeLowerBound) / 2) * 10) / 10;
                                    perEnvelopeLowerBound = 0.5;
                                }
                            }
                        }

                        instrument.addEnvelope(target, index, envelope, true, pitchEnvelopeStart, pitchEnvelopeEnd, envelopeInverse, perEnvelopeSpeed, perEnvelopeLowerBound, perEnvelopeUpperBound, steps, seed, waveform, envelopeDiscrete);
                        if (fromSlarmoosBox && beforeThree && !beforeTwo) {
                            let pitchEnvelopeCompact: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                            instrument.envelopes[i].pitchEnvelopeStart = pitchEnvelopeCompact * 64 + base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                            pitchEnvelopeCompact = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                            instrument.envelopes[i].pitchEnvelopeEnd = pitchEnvelopeCompact * 64 + base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                            instrument.envelopes[i].inverse = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] == 1 ? true : false;
                        }
                    }

                    let instrumentPitchEnvelopeStart: number = 0;
                    let instrumentPitchEnvelopeEnd: number = Config.maxPitch;
                    let instrumentEnvelopeInverse: boolean = false;
                    if (fromSlarmoosBox && beforeTwo) {
                        let pitchEnvelopeCompact: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        instrumentPitchEnvelopeStart = pitchEnvelopeCompact * 64 + base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        pitchEnvelopeCompact = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        instrumentPitchEnvelopeEnd = pitchEnvelopeCompact * 64 + base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        instrumentEnvelopeInverse = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] === 1 ? true : false;
                        for (let i: number = 0; i < envelopeCount; i++) {
                            instrument.envelopes[i].pitchEnvelopeStart = instrumentPitchEnvelopeStart;
                            instrument.envelopes[i].pitchEnvelopeEnd = instrumentPitchEnvelopeEnd;
                            instrument.envelopes[i].inverse = Config.envelopePresets[instrument.envelopes[i].envelope].name == "pitch" ? instrumentEnvelopeInverse : false;
                        }
                    }

                }
            } break;
            case SongTagCode.operatorWaves: {
                const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];

                if (beforeThree && fromGoldBox) {
                    for (let o: number = 0; o < Config.operatorCount; o++) {
                        const pre3To3g = [0, 1, 3, 2, 2, 2, 4, 5];
                        const old: number = clamp(0, pre3To3g.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        if (old == 3) {
                            instrument.operators[o].pulseWidth = 5;
                        } else if (old == 4) {
                            instrument.operators[o].pulseWidth = 4;
                        } else if (old == 5) {
                            instrument.operators[o].pulseWidth = 6;
                        }
                        instrument.operators[o].waveform = pre3To3g[old];
                    }
                } else {
                    for (let o: number = 0; o < (instrument.type == InstrumentType.fm6op ? 6 : Config.operatorCount); o++) {
                        if (fromJummBox) {
                            const jummToG = [0, 1, 3, 2, 4, 5];
                            instrument.operators[o].waveform = jummToG[clamp(0, Config.operatorWaves.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)])];
                        } else {
                            instrument.operators[o].waveform = clamp(0, Config.operatorWaves.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        }
                        // Pulse width follows, if it is a pulse width operator wave
                        if (instrument.operators[o].waveform == 2) {
                            instrument.operators[o].pulseWidth = clamp(0, Config.pwmOperatorWaves.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        }
                    }
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
                const byteCount: number = Math.ceil(Config.harmonicsControlPoints * Config.harmonicsControlPointBits / 6);
                const bits: BitFieldReader = new BitFieldReader(compressed, charIndex, charIndex + byteCount);
                for (let i: number = 0; i < Config.harmonicsControlPoints; i++) {
                    instrument.harmonicsWave.harmonics[i] = bits.read(Config.harmonicsControlPointBits);
                }
                instrument.harmonicsWave.markCustomWaveDirty();
                charIndex += byteCount;
            } break;
            case SongTagCode.aliases: {
                if ((fromJummBox && beforeFive) || (fromGoldBox && beforeFour)) {
                    const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                    instrument.aliases = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)]) ? true : false;
                    if (instrument.aliases) {
                        instrument.distortion = 0;
                        instrument.effects |= 1 << EffectType.distortion;
                    }
                } else {
                    if (fromUltraBox || fromSlarmoosBox) {
                        const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                        instrument.decimalOffset = clamp(0, 50 + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
            }
                break;
            case SongTagCode.bars: {
                lastCommand = "bars";
                let subStringLength: number;
                if (beforeThree && fromBeepBox) {
                    const channelIndex: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    const barCount: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    subStringLength = Math.ceil(barCount * 0.5);
                    const bits: BitFieldReader = new BitFieldReader(compressed, charIndex, charIndex + subStringLength);
                    for (let i: number = 0; i < barCount; i++) {
                        this.channels[channelIndex].bars[i] = bits.read(3) + 1;
                    }
                } else if (beforeFive && fromBeepBox) {
                    let neededBits: number = 0;
                    while ((1 << neededBits) < this.patternsPerChannel) neededBits++;
                    subStringLength = Math.ceil(this.getChannelCount() * this.barCount * neededBits / 6);
                    const bits: BitFieldReader = new BitFieldReader(compressed, charIndex, charIndex + subStringLength);
                    for (let channelIndex: number = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                        for (let i: number = 0; i < this.barCount; i++) {
                            this.channels[channelIndex].bars[i] = bits.read(neededBits) + 1;
                        }
                    }
                } else {
                    let neededBits: number = 0;
                    while ((1 << neededBits) < this.patternsPerChannel + 1) neededBits++;
                    subStringLength = Math.ceil(this.getChannelCount() * this.barCount * neededBits / 6);
                    const bits: BitFieldReader = new BitFieldReader(compressed, charIndex, charIndex + subStringLength);
                    for (let channelIndex: number = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                        for (let i: number = 0; i < this.barCount; i++) {
                            this.channels[channelIndex].bars[i] = bits.read(neededBits);
                        }
                    }
                }
                charIndex += subStringLength;
            } break;
            case SongTagCode.patterns: {
                lastCommand = "patterns";
                let bitStringLength: number = 0;
                let channelIndex: number;
                let largerChords: boolean = !((beforeFour && fromJummBox) || fromBeepBox);
                let recentPitchBitLength: number = (largerChords ? 4 : 3);
                let recentPitchLength: number = (largerChords ? 16 : 8);
                if (beforeThree && fromBeepBox) {
                    channelIndex = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];

                    // The old format used the next character to represent the number of patterns in the channel, which is usually eight, the default. 
                    charIndex++; //let patternCount: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];

                    bitStringLength = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    bitStringLength = bitStringLength << 6;
                    bitStringLength += base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                } else {
                    channelIndex = 0;
                    let bitStringLengthLength: number = validateRange(1, 4, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    while (bitStringLengthLength > 0) {
                        bitStringLength = bitStringLength << 6;
                        bitStringLength += base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        bitStringLengthLength--;
                    }
                }

                const bits: BitFieldReader = new BitFieldReader(compressed, charIndex, charIndex + bitStringLength);
                charIndex += bitStringLength;

                const bitsPerNoteSize: number = Song.getNeededBits(Config.noteSizeMax);
                let songReverbChannel: number = -1;
                let songReverbInstrument: number = -1;
                let songReverbIndex: number = -1;

                //TODO: Goldbox detecting (ultrabox used the goldbox tag for a bit, sadly making things more complicated)
                const shouldCorrectTempoMods: boolean = fromJummBox;
                const jummboxTempoMin: number = 30;

                while (true) {
                    const channel: Channel = this.channels[channelIndex];
                    const isNoiseChannel: boolean = this.getChannelIsNoise(channelIndex);
                    const isModChannel: boolean = this.getChannelIsMod(channelIndex);

                    const maxInstrumentsPerPattern: number = this.getMaxInstrumentsPerPattern(channelIndex);
                    const neededInstrumentCountBits: number = Song.getNeededBits(maxInstrumentsPerPattern - Config.instrumentCountMin);

                    const neededInstrumentIndexBits: number = Song.getNeededBits(channel.instruments.length - 1);

                    // Some info about modulator settings immediately follows in mod channels.
                    if (isModChannel) {
                        let jumfive: boolean = (beforeFive && fromJummBox) || (beforeFour && fromGoldBox)

                        // 2 more indices for 'all' and 'active'
                        const neededModInstrumentIndexBits: number = (jumfive) ? neededInstrumentIndexBits : Song.getNeededBits(this.getMaxInstrumentsPerChannel() + 2);

                        for (let instrumentIndex: number = 0; instrumentIndex < channel.instruments.length; instrumentIndex++) {

                            let instrument: Instrument = channel.instruments[instrumentIndex];

                            for (let mod: number = 0; mod < Config.modCount; mod++) {
                                // Still using legacy "mod status" format, but doing it manually as it's only used in the URL now.
                                // 0 - For pitch/noise
                                // 1 - (used to be For noise, not needed)
                                // 2 - For song
                                // 3 - None
                                let status: number = bits.read(2);

                                switch (status) {
                                    case 0: // Pitch
                                        instrument.modChannels[mod] = clamp(0, this.pitchChannelCount + this.noiseChannelCount + 1, bits.read(8));
                                        instrument.modInstruments[mod] = clamp(0, this.channels[instrument.modChannels[mod]].instruments.length + 2, bits.read(neededModInstrumentIndexBits));
                                        break;
                                    case 1: // Noise
                                        // Getting a status of 1 means this is legacy mod info. Need to add pitch channel count, as it used to just store noise channel index and not overall channel index
                                        instrument.modChannels[mod] = this.pitchChannelCount + clamp(0, this.noiseChannelCount + 1, bits.read(8));
                                        instrument.modInstruments[mod] = clamp(0, this.channels[instrument.modChannels[mod]].instruments.length + 2, bits.read(neededInstrumentIndexBits));
                                        break;
                                    case 2: // For song
                                        instrument.modChannels[mod] = -1;
                                        break;
                                    case 3: // None
                                        instrument.modChannels[mod] = -2;
                                        break;
                                }

                                // Mod setting is only used if the status isn't "none".
                                if (status != 3) {
                                    instrument.modulators[mod] = bits.read(6);
                                }

                                if (!jumfive && (Config.modulators[instrument.modulators[mod]].name == "eq filter" || Config.modulators[instrument.modulators[mod]].name == "note filter" || Config.modulators[instrument.modulators[mod]].name == "song eq")) {
                                    instrument.modFilterTypes[mod] = bits.read(6);
                                }

                                if (Config.modulators[instrument.modulators[mod]].name == "individual envelope speed" ||
                                    Config.modulators[instrument.modulators[mod]].name == "reset envelope" ||
                                    Config.modulators[instrument.modulators[mod]].name == "individual envelope lower bound" ||
                                    Config.modulators[instrument.modulators[mod]].name == "individual envelope upper bound"
                                ) {
                                    instrument.modEnvelopeNumbers[mod] = bits.read(6);
                                }

                                if (jumfive && instrument.modChannels[mod] >= 0) {
                                    let forNoteFilter: boolean = effectsIncludeNoteFilter(this.channels[instrument.modChannels[mod]].instruments[instrument.modInstruments[mod]].effects);

                                    // For legacy filter cut/peak, need to denote since scaling must be applied
                                    if (instrument.modulators[mod] == 7) {
                                        // Legacy filter cut index
                                        // Check if there is no filter dot on prospective filter. If so, add a low pass at max possible freq.

                                        if (forNoteFilter) {
                                            instrument.modulators[mod] = Config.modulators.dictionary["note filt cut"].index;
                                        }
                                        else {
                                            instrument.modulators[mod] = Config.modulators.dictionary["eq filt cut"].index;
                                        }

                                        instrument.modFilterTypes[mod] = 1; // Dot 1 X

                                    }
                                    else if (instrument.modulators[mod] == 8) {
                                        // Legacy filter peak index
                                        if (forNoteFilter) {
                                            instrument.modulators[mod] = Config.modulators.dictionary["note filt peak"].index;
                                        }
                                        else {
                                            instrument.modulators[mod] = Config.modulators.dictionary["eq filt peak"].index;
                                        }

                                        instrument.modFilterTypes[mod] = 2; // Dot 1 Y
                                    }
                                }
                                else if (jumfive) {
                                    // Check for song reverb mod, which must be handled differently now that it is a multiplier
                                    if (instrument.modulators[mod] == Config.modulators.dictionary["song reverb"].index) {
                                        songReverbChannel = channelIndex;
                                        songReverbInstrument = instrumentIndex;
                                        songReverbIndex = mod;
                                    }
                                }

                                // Based on setting, enable some effects for the modulated instrument. This isn't always set, say if the instrument's pan was right in the center.
                                // Only used on import of old songs, because sometimes an invalid effect can be set in a mod in the new version that is actually unused. In that case,
                                // keeping the mod invalid is better since it preserves the state.
                                if (jumfive && Config.modulators[instrument.modulators[mod]].associatedEffect != EffectType.length) {
                                    this.channels[instrument.modChannels[mod]].instruments[instrument.modInstruments[mod]].effects |= 1 << Config.modulators[instrument.modulators[mod]].associatedEffect;
                                }
                            }
                        }
                    }

                    // Scalar applied to detune mods since its granularity was upped. Could be repurposed later if any other granularity changes occur.
                    const detuneScaleNotes: number[][] = [];
                    for (let j: number = 0; j < channel.instruments.length; j++) {
                        detuneScaleNotes[j] = [];
                        for (let i: number = 0; i < Config.modCount; i++) {
                            detuneScaleNotes[j][Config.modCount - 1 - i] = 1 + 3 * +(((beforeFive && fromJummBox) || (beforeFour && fromGoldBox)) && isModChannel && (channel.instruments[j].modulators[i] == Config.modulators.dictionary["detune"].index));
                        }
                    }
                    const octaveOffset: number = (isNoiseChannel || isModChannel) ? 0 : channel.octave * 12;
                    let lastPitch: number = ((isNoiseChannel || isModChannel) ? 4 : octaveOffset);
                    const recentPitches: number[] = isModChannel ? [0, 1, 2, 3, 4, 5] : (isNoiseChannel ? [4, 6, 7, 2, 3, 8, 0, 10] : [0, 7, 12, 19, 24, -5, -12]);
                    const recentShapes: any[] = [];
                    for (let i: number = 0; i < recentPitches.length; i++) {
                        recentPitches[i] += octaveOffset;
                    }
                    for (let i: number = 0; i < this.patternsPerChannel; i++) {
                        const newPattern: Pattern = channel.patterns[i];

                        if ((beforeNine && fromBeepBox) || (beforeFive && fromJummBox) || (beforeFour && fromGoldBox)) {
                            newPattern.instruments[0] = validateRange(0, channel.instruments.length - 1, bits.read(neededInstrumentIndexBits));
                            newPattern.instruments.length = 1;
                        } else {
                            if (this.patternInstruments) {
                                const instrumentCount: number = validateRange(Config.instrumentCountMin, maxInstrumentsPerPattern, bits.read(neededInstrumentCountBits) + Config.instrumentCountMin);
                                for (let j: number = 0; j < instrumentCount; j++) {
                                    newPattern.instruments[j] = validateRange(0, channel.instruments.length - 1 + +(isModChannel) * 2, bits.read(neededInstrumentIndexBits));
                                }
                                newPattern.instruments.length = instrumentCount;
                            } else {
                                newPattern.instruments[0] = 0;
                                newPattern.instruments.length = Config.instrumentCountMin;
                            }
                        }

                        if (!(fromBeepBox && beforeThree) && bits.read(1) == 0) {
                            newPattern.notes.length = 0;
                            continue;
                        }

                        let curPart: number = 0;
                        const newNotes: Note[] = newPattern.notes;
                        let noteCount: number = 0;
                        // Due to arbitrary note positioning, mod channels don't end the count until curPart actually exceeds the max
                        while (curPart < this.beatsPerBar * Config.partsPerBeat + (+isModChannel)) {

                            const useOldShape: boolean = bits.read(1) == 1;
                            let newNote: boolean = false;
                            let shapeIndex: number = 0;
                            if (useOldShape) {
                                shapeIndex = validateRange(0, recentShapes.length - 1, bits.readLongTail(0, 0));
                            } else {
                                newNote = bits.read(1) == 1;
                            }

                            if (!useOldShape && !newNote) {
                                // For mod channels, check if you need to move backward too (notes can appear in any order and offset from each other).
                                if (isModChannel) {
                                    const isBackwards: boolean = bits.read(1) == 1;
                                    const restLength: number = bits.readPartDuration();
                                    if (isBackwards) {
                                        curPart -= restLength;
                                    }
                                    else {
                                        curPart += restLength;
                                    }
                                } else {
                                    const restLength: number = (beforeSeven && fromBeepBox)
                                        ? bits.readLegacyPartDuration() * Config.partsPerBeat / Config.rhythms[this.rhythm].stepsPerBeat
                                        : bits.readPartDuration();
                                    curPart += restLength;

                                }
                            } else {
                                let shape: any;
                                if (useOldShape) {
                                    shape = recentShapes[shapeIndex];
                                    recentShapes.splice(shapeIndex, 1);
                                } else {
                                    shape = {};

                                    if (!largerChords) {
                                        // Old format: X 1's followed by a 0 => X+1 pitches, up to 4
                                        shape.pitchCount = 1;
                                        while (shape.pitchCount < 4 && bits.read(1) == 1) shape.pitchCount++;
                                    }
                                    else {
                                        // New format is:
                                        //      0: 1 pitch
                                        // 1[XXX]: 3 bits of binary signifying 2+ pitches
                                        if (bits.read(1) == 1) {
                                            shape.pitchCount = bits.read(3) + 2;
                                        }
                                        else {
                                            shape.pitchCount = 1;
                                        }
                                    }

                                    shape.pinCount = bits.readPinCount();
                                    if (fromBeepBox) {
                                        shape.initialSize = bits.read(2) * 2;
                                    } else if (!isModChannel) {
                                        shape.initialSize = bits.read(bitsPerNoteSize);
                                    } else {
                                        shape.initialSize = bits.read(9);
                                    }

                                    shape.pins = [];
                                    shape.length = 0;
                                    shape.bendCount = 0;
                                    for (let j: number = 0; j < shape.pinCount; j++) {
                                        let pinObj: any = {};
                                        pinObj.pitchBend = bits.read(1) == 1;
                                        if (pinObj.pitchBend) shape.bendCount++;
                                        shape.length += (beforeSeven && fromBeepBox)
                                            ? bits.readLegacyPartDuration() * Config.partsPerBeat / Config.rhythms[this.rhythm].stepsPerBeat
                                            : bits.readPartDuration();
                                        pinObj.time = shape.length;
                                        if (fromBeepBox) {
                                            pinObj.size = bits.read(2) * 2;
                                        } else if (!isModChannel) {
                                            pinObj.size = bits.read(bitsPerNoteSize);
                                        }
                                        else {
                                            pinObj.size = bits.read(9);
                                        }
                                        shape.pins.push(pinObj);
                                    }
                                }
                                recentShapes.unshift(shape);
                                if (recentShapes.length > 10) recentShapes.pop(); // TODO: Use Deque?

                                let note: Note;
                                if (newNotes.length <= noteCount) {
                                    note = new Note(0, curPart, curPart + shape.length, shape.initialSize);
                                    newNotes[noteCount++] = note;
                                } else {
                                    note = newNotes[noteCount++];
                                    note.start = curPart;
                                    note.end = curPart + shape.length;
                                    note.pins[0].size = shape.initialSize;
                                }

                                let pitch: number;
                                let pitchCount: number = 0;
                                const pitchBends: number[] = []; // TODO: allocate this array only once! keep separate length and iterator index. Use Deque?
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
                                        const pitchIndex: number = validateRange(0, recentPitches.length - 1, bits.read(recentPitchBitLength));
                                        pitch = recentPitches[pitchIndex];
                                        recentPitches.splice(pitchIndex, 1);
                                    }

                                    recentPitches.unshift(pitch);
                                    if (recentPitches.length > recentPitchLength) recentPitches.pop();

                                    if (j < shape.pitchCount) {
                                        note.pitches[pitchCount++] = pitch;
                                    } else {
                                        pitchBends.push(pitch);
                                    }

                                    if (j == shape.pitchCount - 1) {
                                        lastPitch = note.pitches[0];
                                    } else {
                                        lastPitch = pitch;
                                    }
                                }
                                note.pitches.length = pitchCount;
                                pitchBends.unshift(note.pitches[0]); // TODO: Use Deque?
                                const noteIsForTempoMod: boolean = isModChannel && channel.instruments[newPattern.instruments[0]].modulators[Config.modCount - 1 - note.pitches[0]] === Config.modulators.dictionary["tempo"].index;
                                let tempoOffset: number = 0;
                                if (shouldCorrectTempoMods && noteIsForTempoMod) {
                                    tempoOffset = jummboxTempoMin - Config.tempoMin; // convertRealFactor will add back Config.tempoMin as necessary
                                }
                                if (isModChannel) {
                                    note.pins[0].size += tempoOffset;
                                    note.pins[0].size *= detuneScaleNotes[newPattern.instruments[0]][note.pitches[0]];
                                }
                                let pinCount: number = 1;
                                for (const pinObj of shape.pins) {
                                    if (pinObj.pitchBend) pitchBends.shift();

                                    const interval: number = pitchBends[0] - note.pitches[0];
                                    if (note.pins.length <= pinCount) {
                                        if (isModChannel) {
                                            note.pins[pinCount++] = makeNotePin(interval, pinObj.time, pinObj.size * detuneScaleNotes[newPattern.instruments[0]][note.pitches[0]] + tempoOffset);
                                        } else {
                                            note.pins[pinCount++] = makeNotePin(interval, pinObj.time, pinObj.size);
                                        }
                                    } else {
                                        const pin: NotePin = note.pins[pinCount++];
                                        pin.interval = interval;
                                        pin.time = pinObj.time;
                                        if (isModChannel) {
                                            pin.size = pinObj.size * detuneScaleNotes[newPattern.instruments[0]][note.pitches[0]] + tempoOffset;
                                        } else {
                                            pin.size = pinObj.size;
                                        }
                                    }
                                }
                                note.pins.length = pinCount;

                                if (note.start == 0) {
                                    if (!((beforeNine && fromBeepBox) || (beforeFive && fromJummBox) || (beforeFour && fromGoldBox))) {
                                        note.continuesLastPattern = (bits.read(1) == 1);
                                    } else {
                                        if ((beforeFour && !fromUltraBox && !fromSlarmoosBox) || fromBeepBox) {
                                            note.continuesLastPattern = false;
                                        } else {
                                            note.continuesLastPattern = channel.instruments[newPattern.instruments[0]].legacyTieOver;
                                        }
                                    }
                                }

                                curPart = validateRange(0, this.beatsPerBar * Config.partsPerBeat, note.end);
                            }
                        }
                        newNotes.length = noteCount;
                    }

                    if (beforeThree && fromBeepBox) {
                        break;
                    } else {
                        channelIndex++;
                        if (channelIndex >= this.getChannelCount()) break;
                    }
                } // while (true)

                // Correction for old JB songs that had song reverb mods. Change all instruments using reverb to max reverb
                if (((fromJummBox && beforeFive) || (beforeFour && fromGoldBox)) && songReverbIndex >= 0) {
                    for (let channelIndex: number = 0; channelIndex < this.channels.length; channelIndex++) {
                        for (let instrumentIndex: number = 0; instrumentIndex < this.channels[channelIndex].instruments.length; instrumentIndex++) {
                            const instrument: Instrument = this.channels[channelIndex].instruments[instrumentIndex];
                            if (effectsIncludeReverb(instrument.effects)) {
                                instrument.reverb = Config.reverbRange - 1;
                            }
                            // Set song reverb via mod to the old setting at song start.
                            if (songReverbChannel == channelIndex && songReverbInstrument == instrumentIndex) {
                                const patternIndex: number = this.channels[channelIndex].bars[0];
                                if (patternIndex > 0) {
                                    // Doesn't work if 1st pattern isn't using the right ins for song reverb...
                                    // Add note to start of pattern
                                    const pattern: Pattern = this.channels[channelIndex].patterns[patternIndex - 1];
                                    let lowestPart: number = 6;
                                    for (const note of pattern.notes) {
                                        if (note.pitches[0] == Config.modCount - 1 - songReverbIndex) {
                                            lowestPart = Math.min(lowestPart, note.start);
                                        }
                                    }

                                    if (lowestPart > 0) {
                                        pattern.notes.push(new Note(Config.modCount - 1 - songReverbIndex, 0, lowestPart, legacyGlobalReverb));
                                    }
                                }
                                else {
                                    // Add pattern
                                    if (this.channels[channelIndex].patterns.length < Config.barCountMax) {
                                        const pattern: Pattern = new Pattern();
                                        this.channels[channelIndex].patterns.push(pattern);
                                        this.channels[channelIndex].bars[0] = this.channels[channelIndex].patterns.length;
                                        if (this.channels[channelIndex].patterns.length > this.patternsPerChannel) {
                                            for (let chn: number = 0; chn < this.channels.length; chn++) {
                                                if (this.channels[chn].patterns.length <= this.patternsPerChannel) {
                                                    this.channels[chn].patterns.push(new Pattern());
                                                }
                                            }
                                            this.patternsPerChannel++;
                                        }
                                        pattern.instruments.length = 1;
                                        pattern.instruments[0] = songReverbInstrument;
                                        pattern.notes.length = 0;
                                        pattern.notes.push(new Note(Config.modCount - 1 - songReverbIndex, 0, 6, legacyGlobalReverb));
                                    }
                                }
                            }
                        }
                    }
                }
            } break;
            default: {
                throw new Error("Unrecognized song tag code " + String.fromCharCode(command) + " at index " + (charIndex - 1) + " " + lastCommand + " " + compressed.substring(/*charIndex - 2*/0, charIndex));
            } break;
        }

        if (Config.willReloadForCustomSamples) {
            window.location.hash = this.toBase64String();
            setTimeout(() => { location.reload(); }, 50);
        }
    }

    private fetchPlugin(
        pluginurl: string,
        updateProcessorPlugin: (names: string[], instrumentStateFunction: string, synthFunction: string, effectOrder: number[] | number, delayLineSize: number) => void
    ) {
        if (pluginurl != null) {
            fetch(pluginurl).then((response) => {
                if (!response.ok) {
                    // @TODO: Be specific with the error handling.
                    throw new Error("Couldn't load plugin");
                }
                return response;
            }).then((response) => {
                return response.json();
            }).then((plugin) => {
                //decode and store the data
                if (updateProcessorPlugin) {
                    PluginConfig.pluginUIElements = plugin.elements || [];
                    PluginConfig.pluginName = plugin.pluginName || "plugin";
                    updateProcessorPlugin(
                        plugin.variableNames || [],
                        plugin.instrumentStateFunction || "",
                        plugin.synthFunction || "",
                        plugin.effectOrderIndex || 0,
                        plugin.delayLineSize || 0
                    );   
                }
            }).catch(() => {
                window.alert("couldn't load plugin "+ pluginurl);
            })
        }
    }

    private static _isProperUrl(string: string): boolean {
        try {
            if (OFFLINE) {
                return Boolean(string);
            } else {
                return Boolean(new URL(string));
            }
        } catch (x) {
            return false;
        }
    }

    // @TODO: Share more of this code with AddSamplesPrompt.
    private static _parseAndConfigureCustomSample(
        url: string,
        customSampleUrls: string[],
        customSamplePresets: Preset[],
        sampleLoadingState: SampleLoadingState,
        parseOldSyntax: boolean,
        updateSynthSamplesStart: (
            name: string,
            expression: number,
            isCustomSampled: boolean,
            isPercussion: boolean,
            rootKey: number,
            sampleRate: number,
            index: number
        ) => void,
        updateSynthSamplesFinish: (samples: Float32Array, index: number) => void
    ): boolean {
        const defaultIndex: number = 0;
        const defaultIntegratedSamples: Float32Array = Config.chipWaves[defaultIndex].samples;
        const defaultSamples: Float32Array = Config.rawRawChipWaves[defaultIndex].samples;

        const customSampleUrlIndex: number = customSampleUrls.length;
        customSampleUrls.push(url);
        // This depends on `Config.chipWaves` being the same
        // length as `Config.rawRawChipWaves`.
        const chipWaveIndex: number = Config.chipWaves.length;

        let urlSliced: string = url;

        let customSampleRate: number = 44100;
        let isCustomPercussive: boolean = false;
        let customRootKey: number = 60;
        let presetIsUsingAdvancedLoopControls: boolean = false;
        let presetChipWaveLoopStart: number | null = null;
        let presetChipWaveLoopEnd: number | null = null;
        let presetChipWaveStartOffset: number | null = null;
        let presetChipWaveLoopMode: number | null = null;
        let presetChipWavePlayBackwards: boolean = false;

        let parsedSampleOptions: boolean = false;
        let optionsStartIndex: number = url.indexOf("!");
        let optionsEndIndex: number = -1;
        if (optionsStartIndex === 0) {
            optionsEndIndex = url.indexOf("!", optionsStartIndex + 1);
            if (optionsEndIndex !== -1) {
                const rawOptions: string[] = url.slice(optionsStartIndex + 1, optionsEndIndex).split(",");
                for (const rawOption of rawOptions) {
                    const optionCode: string = rawOption.charAt(0);
                    const optionData: string = rawOption.slice(1, rawOption.length);
                    if (optionCode === "s") {
                        customSampleRate = clamp(8000, 96000 + 1, parseFloatWithDefault(optionData, 44100));
                    } else if (optionCode === "r") {
                        customRootKey = parseFloatWithDefault(optionData, 60);
                    } else if (optionCode === "p") {
                        isCustomPercussive = true;
                    } else if (optionCode === "a") {
                        presetChipWaveLoopStart = parseIntWithDefault(optionData, null);
                        if (presetChipWaveLoopStart != null) {
                            presetIsUsingAdvancedLoopControls = true;
                        }
                    } else if (optionCode === "b") {
                        presetChipWaveLoopEnd = parseIntWithDefault(optionData, null);
                        if (presetChipWaveLoopEnd != null) {
                            presetIsUsingAdvancedLoopControls = true;
                        }
                    } else if (optionCode === "c") {
                        presetChipWaveStartOffset = parseIntWithDefault(optionData, null);
                        if (presetChipWaveStartOffset != null) {
                            presetIsUsingAdvancedLoopControls = true;
                        }
                    } else if (optionCode === "d") {
                        presetChipWaveLoopMode = parseIntWithDefault(optionData, null);
                        if (presetChipWaveLoopMode != null) {
                            // @TODO: Error-prone. This should be automatically
                            // derived from the list of available loop modes.
                            presetChipWaveLoopMode = clamp(0, 3 + 1, presetChipWaveLoopMode);
                            presetIsUsingAdvancedLoopControls = true;
                        }
                    } else if (optionCode === "e") {
                        presetChipWavePlayBackwards = true;
                        presetIsUsingAdvancedLoopControls = true;
                    }
                }
                urlSliced = url.slice(optionsEndIndex + 1, url.length);
                parsedSampleOptions = true;
            }
        }

        let parsedUrl: URL | string | null = null;
        if (Song._isProperUrl(urlSliced)) {
            if (OFFLINE) {
                parsedUrl = urlSliced;
            } else {
                parsedUrl = new URL(urlSliced);
            }
        } else {
            alert(url + " is not a valid url");
            return false;
        }

        if (parseOldSyntax) {
            if (!parsedSampleOptions && parsedUrl != null) {
                if (url.indexOf("@") != -1) {
                    //urlSliced = url.slice(url.indexOf("@"), url.indexOf("@"));
                    urlSliced = url.replaceAll("@", "")
                    if (OFFLINE) {
                        parsedUrl = urlSliced;
                    } else {
                        parsedUrl = new URL(urlSliced);
                    }
                    isCustomPercussive = true;
                }

                function sliceForSampleRate() {
                    urlSliced = url.slice(0, url.indexOf(","));
                    if (OFFLINE) {
                        parsedUrl = urlSliced;
                    } else {
                        parsedUrl = new URL(urlSliced);
                    }
                    customSampleRate = clamp(8000, 96000 + 1, parseFloatWithDefault(url.slice(url.indexOf(",") + 1), 44100));
                    //should this be parseFloat or parseInt?
                    //ig floats let you do decimals and such, but idk where that would be useful
                }

                function sliceForRootKey() {
                    urlSliced = url.slice(0, url.indexOf("!"));
                    if (OFFLINE) {
                        parsedUrl = urlSliced;
                    } else {
                        parsedUrl = new URL(urlSliced);
                    }
                    customRootKey = parseFloatWithDefault(url.slice(url.indexOf("!") + 1), 60);
                }


                if (url.indexOf(",") != -1 && url.indexOf("!") != -1) {
                    if (url.indexOf(",") < url.indexOf("!")) {
                        sliceForRootKey();
                        sliceForSampleRate();
                    }
                    else {
                        sliceForSampleRate();
                        sliceForRootKey();
                    }
                }
                else {
                    if (url.indexOf(",") != -1) {
                        sliceForSampleRate();
                    }
                    if (url.indexOf("!") != -1) {
                        sliceForRootKey();
                    }
                }
            }
        }

        if (parsedUrl != null) {
            // Store in the new format.
            let urlWithNamedOptions = urlSliced;
            const namedOptions: string[] = [];
            if (customSampleRate !== 44100) namedOptions.push("s" + customSampleRate);
            if (customRootKey !== 60) namedOptions.push("r" + customRootKey);
            if (isCustomPercussive) namedOptions.push("p");
            if (presetIsUsingAdvancedLoopControls) {
                if (presetChipWaveLoopStart != null) namedOptions.push("a" + presetChipWaveLoopStart);
                if (presetChipWaveLoopEnd != null) namedOptions.push("b" + presetChipWaveLoopEnd);
                if (presetChipWaveStartOffset != null) namedOptions.push("c" + presetChipWaveStartOffset);
                if (presetChipWaveLoopMode != null) namedOptions.push("d" + presetChipWaveLoopMode);
                if (presetChipWavePlayBackwards) namedOptions.push("e");
            }
            if (namedOptions.length > 0) {
                urlWithNamedOptions = "!" + namedOptions.join(",") + "!" + urlSliced;
            }
            customSampleUrls[customSampleUrlIndex] = urlWithNamedOptions;

            // @TODO: Could also remove known extensions, but it
            // would probably be much better to be able to specify
            // a custom name.
            // @TODO: If for whatever inexplicable reason someone
            // uses an url like `https://example.com`, this will
            // result in an empty name here.
            let name: string;
            if (OFFLINE) {
                //@ts-ignore
                name = decodeURIComponent(parsedUrl.replace(/^([^\/]*\/)+/, ""));
            } else {
                //@ts-ignore
                name = decodeURIComponent(parsedUrl.pathname.replace(/^([^\/]*\/)+/, ""));
            }
            // @TODO: What to do about samples with the same name?
            // The problem with using the url is that the name is
            // user-facing and long names break assumptions of the
            // UI.
            const expression: number = 1.0;
            Config.chipWaves[chipWaveIndex] = {
                name: name,
                expression: expression,
                isCustomSampled: true,
                isPercussion: isCustomPercussive,
                rootKey: customRootKey,
                sampleRate: customSampleRate,
                samples: defaultIntegratedSamples,
                index: chipWaveIndex,
            };
            Config.rawChipWaves[chipWaveIndex] = {
                name: name,
                expression: expression,
                isCustomSampled: true,
                isPercussion: isCustomPercussive,
                rootKey: customRootKey,
                sampleRate: customSampleRate,
                samples: defaultSamples,
                index: chipWaveIndex,
            };
            Config.rawRawChipWaves[chipWaveIndex] = {
                name: name,
                expression: expression,
                isCustomSampled: true,
                isPercussion: isCustomPercussive,
                rootKey: customRootKey,
                sampleRate: customSampleRate,
                samples: defaultSamples,
                index: chipWaveIndex,
            };
            updateSynthSamplesStart(name, expression, true, isCustomPercussive, customRootKey, customSampleRate, chipWaveIndex);
            const customSamplePresetSettings: Dictionary<any> = {
                "type": "chip",
                "eqFilter": [],
                "effects": [],
                "transition": "normal",
                "fadeInSeconds": 0,
                "fadeOutTicks": -1,
                "chord": "harmony",
                "wave": name,
                "unison": "none",
                "envelopes": [],
            };
            if (presetIsUsingAdvancedLoopControls) {
                customSamplePresetSettings["isUsingAdvancedLoopControls"] = true;
                customSamplePresetSettings["chipWaveLoopStart"] = presetChipWaveLoopStart != null ? presetChipWaveLoopStart : 0;
                customSamplePresetSettings["chipWaveLoopEnd"] = presetChipWaveLoopEnd != null ? presetChipWaveLoopEnd : 2;
                customSamplePresetSettings["chipWaveLoopMode"] = presetChipWaveLoopMode != null ? presetChipWaveLoopMode : 0;
                customSamplePresetSettings["chipWavePlayBackwards"] = presetChipWavePlayBackwards;
                customSamplePresetSettings["chipWaveStartOffset"] = presetChipWaveStartOffset != null ? presetChipWaveStartOffset : 0;
            }
            const customSamplePreset: Preset = {
                index: 0, // This should be overwritten by toNameMap, in our caller.
                name: name,
                midiProgram: 80,
                settings: customSamplePresetSettings,
            };
            customSamplePresets.push(customSamplePreset);
            if (!Config.willReloadForCustomSamples) {
                const rawLoopOptions: any = {
                    "isUsingAdvancedLoopControls": presetIsUsingAdvancedLoopControls,
                    "chipWaveLoopStart": presetChipWaveLoopStart,
                    "chipWaveLoopEnd": presetChipWaveLoopEnd,
                    "chipWaveLoopMode": presetChipWaveLoopMode,
                    "chipWavePlayBackwards": presetChipWavePlayBackwards,
                    "chipWaveStartOffset": presetChipWaveStartOffset,
                };
                startLoadingSample(urlSliced, chipWaveIndex, customSamplePresetSettings, rawLoopOptions, customSampleRate, updateSynthSamplesFinish);
            }
            sampleLoadingState.statusTable[chipWaveIndex] = SampleLoadingStatus.loading;
            sampleLoadingState.urlTable[chipWaveIndex] = urlSliced;
            sampleLoadingState.totalSamples++;
        }

        return true;
    }

    private static _restoreChipWaveListToDefault(): void {
        Config.chipWaves = toNameMap(Config.chipWaves.slice(0, Config.firstIndexForSamplesInChipWaveList));
        Config.rawChipWaves = toNameMap(Config.rawChipWaves.slice(0, Config.firstIndexForSamplesInChipWaveList));
        Config.rawRawChipWaves = toNameMap(Config.rawRawChipWaves.slice(0, Config.firstIndexForSamplesInChipWaveList));
    }

    private static _clearSamples(): void {
        EditorConfig.customSamples = null;

        Song._restoreChipWaveListToDefault();

        sampleLoadingState.statusTable = {};
        sampleLoadingState.urlTable = {};
        sampleLoadingState.totalSamples = 0;
        sampleLoadingState.samplesLoaded = 0;
        sampleLoadEvents.dispatchEvent(new SampleLoadedEvent(
            sampleLoadingState.totalSamples,
            sampleLoadingState.samplesLoaded
        ));
    }

    public parseUpdateCommand(data: any, songSetting: SongSettings, channelIndex?: number, instrumentIndex?: number, instrumentSetting?: InstrumentSettings | ChannelSettings, settingIndex?: number) {
        const numberData: number = data as number;
        switch (songSetting) {
            case SongSettings.title:
                this.title = data as string;
                break;
            case SongSettings.scale:
                this.scale = numberData;
                break;
            case SongSettings.scaleCustom:
                let scale: number = numberData;
                for (let i: number = Config.pitchesPerOctave - 1; i >= 0; i--) {
                    this.scaleCustom[i] = (scale & 1) == 1;
                    scale = scale << 1;
                }
                break;
            case SongSettings.key:
                this.key = numberData;
                break;
            case SongSettings.octave:
                this.octave = numberData;
                break;
            case SongSettings.tempo:
                this.tempo = numberData;
                break;
            case SongSettings.beatsPerBar:
                this.beatsPerBar = numberData;
                break;
            case SongSettings.barCount:
                this.barCount = numberData;
                break;
            case SongSettings.patternsPerChannel:
                this.patternsPerChannel = numberData;
                for (let i: number = 0; i < this.getChannelCount(); i++) {
                    const channelBars: number[] = this.channels[i].bars;
                    const channelPatterns: Pattern[] = this.channels[i].patterns;
                    for (let j: number = 0; j < channelBars.length; j++) {
                        if (channelBars[j] > numberData) channelBars[j] = 0;
                    }
                    for (let j: number = channelPatterns.length; j < numberData; j++) {
                        channelPatterns[j] = new Pattern();
                    }
                    channelPatterns.length = numberData;
                }
                break;
            case SongSettings.rhythm:
                this.rhythm = numberData;
                break;
            case SongSettings.instrumentFlags:
                const oldPatternInstruments = this.patternInstruments;
                this.layeredInstruments = (numberData & 1) == 1;
                this.patternInstruments = (numberData >> 1) == 1;

                for (let channelIndex: number = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                    const channel: Channel = this.channels[channelIndex];
                    if (channel.instruments.length > this.getMaxInstrumentsPerChannel()) {
                        channel.instruments.length = this.getMaxInstrumentsPerChannel();
                    }
                    for (let j: number = 0; j < this.patternsPerChannel; j++) {
                        const pattern: Pattern = channel.patterns[j];
                        if (!oldPatternInstruments && this.patternInstruments) {
                            // patternInstruments was enabled, set up pattern instruments as appropriate.
                            for (let i: number = 0; i < channel.instruments.length; i++) {
                                pattern.instruments[i] = i;
                            }
                            pattern.instruments.length = channel.instruments.length;
                        }
                        discardInvalidPatternInstruments(pattern.instruments, this, channelIndex);
                    }
                }
                break;
            case SongSettings.loopStart:
                this.loopStart = numberData;
                break;
            case SongSettings.loopLength:
                this.loopLength = numberData;
                break;
            case SongSettings.pitchChannelCount:
                this.pitchChannelCount = numberData;
                this.channels.length = this.getChannelCount();
                break;
            case SongSettings.noiseChannelCount:
                this.noiseChannelCount = numberData;
                this.channels.length = this.getChannelCount();
                break;
            case SongSettings.modChannelCount:
                this.modChannelCount = numberData;
                this.channels.length = this.getChannelCount();
                break;
            case SongSettings.limiterSettings:
                this.limitDecay = data.limitDecay;
                this.limitRise = data.limitRise;
                this.compressionThreshold = data.compressionThreshold;
                this.limitThreshold = data.limitThreshold;
                this.compressionRatio = data.compressionRatio;
                this.limitRatio = data.limitRatio;
                this.masterGain = data.masterGain;
                break;
            case SongSettings.inVolumeCap:
                this.inVolumeCap = numberData;
                break;
            case SongSettings.outVolumeCap:
                this.outVolumeCap = numberData;
                break;
            case SongSettings.eqFilter:
                this.eqFilter.fromJsonObject(data);
                this.tmpEqFilterStart = this.eqFilter;
                this.tmpEqFilterEnd = null;        
                break;
            case SongSettings.eqSubFilters:
                //channelIndex hijacked for subfilter index
                if (this.eqSubFilters[channelIndex!] == null) this.eqSubFilters[channelIndex!] = new FilterSettings();
                this.eqSubFilters[channelIndex!]!.fromJsonObject(data);
                this.tmpEqFilterStart = this.eqFilter;
                this.tmpEqFilterEnd = null;        
                break;
            case SongSettings.addSequence:
                this.sequences.push(new SequenceSettings());
                break;
            case SongSettings.sequenceLength: {
                //channelIndex hijacked for sequence index
                const oldValue = this.sequences[channelIndex!].length;
                this.sequences[channelIndex!].length = numberData;
                if (numberData < oldValue) {
                    this.sequences[channelIndex!].values.splice(numberData);
                } else {
                    this.sequences[channelIndex!].values.concat(Array(numberData - oldValue).fill(0));
                }
                break;
            } case SongSettings.sequenceHeight: {
                //channelIndex hijacked for sequence index
                const oldValue = this.sequences[channelIndex!].length;
                this.sequences[channelIndex!].height = numberData;
                if (numberData < oldValue) {
                    this.sequences[channelIndex!].values.forEach((v, i) => {
                        this.sequences[channelIndex!].values[i] = Math.min(numberData, v);
                    });
                } 
                break;
            } case SongSettings.sequenceValues:
                this.sequences[channelIndex!].values = data as number[];
                break;
            case SongSettings.pluginurl:
                //do plugin stuff?
                break;
            case SongSettings.channelOrder:
                const selectionMin: number = data.selectionMin;
                const selectionMax: number = data.selectionMax;
                const offset: number = data.offset;
                this.channels.splice(selectionMin + offset, 0, ...this.channels.splice(selectionMin, selectionMax - selectionMin + 1));
                break
            case SongSettings.updateChannel:
                const channel: Channel = this.channels[channelIndex!];
                switch (instrumentSetting) {
                    case ChannelSettings.fromJson:
                        this.channels[channelIndex!] = data as Channel;
                        break;
                    case ChannelSettings.allPatterns: {
                        const newPatterns = data as Pattern[];
                        for (let i: number = 0; i < newPatterns.length; i++) {
                            channel.patterns[i].copyObject(newPatterns[i]);
                        }
                        break;
                    } case ChannelSettings.pattern: {
                        //instrumentIndex hijacked for a pattern/bar 
                        channel.patterns[instrumentIndex!].copyObject(data as Pattern);
                        discardInvalidPatternInstruments(channel.patterns[instrumentIndex!].instruments, this, channelIndex!);
                        break;
                    } case ChannelSettings.bars:
                        const newBars = data as number[];
                        channel.bars.forEach((_, index) => {
                            channel.bars[index] = newBars[index];
                        });
                        break;
                case ChannelSettings.muted:
                        channel.muted = numberData == 1;
                        break;
                    case ChannelSettings.newInstrument:
                        const isNoise: boolean = this.getChannelIsNoise(channelIndex!);
                        const isMod: boolean = this.getChannelIsMod(channelIndex!);
                        const ins = new Instrument(isNoise, isMod)
                        ins.fromJsonObject(data as string, isNoise, isMod, false, false);
                        channel.instruments.push(ins);
                        break;
                    case ChannelSettings.instruments:
                        channel.instruments.length = data.length;
                        break;
                }
                break;
            case SongSettings.updateInstrument:
                const instrument: Instrument = this.channels[channelIndex!].instruments[instrumentIndex!];
                if (channelIndex === undefined || instrumentSetting === undefined)
                    return
                switch (instrumentSetting) {
                    case InstrumentSettings.fromJson:
                        const isNoise: boolean = this.getChannelIsNoise(channelIndex!);
                        const isMod: boolean = this.getChannelIsMod(channelIndex!);
                        instrument.fromJsonObject(data as string, isNoise, isMod, false, false);
                        break;
                    case InstrumentSettings.type:
                        instrument.type = numberData;
                        break;
                    case InstrumentSettings.preset:
                        instrument.preset = numberData;
                        break;
                    case InstrumentSettings.chipWave:
                        instrument.chipWave = numberData;
                        instrument.isUsingAdvancedLoopControls = false;
                        instrument.chipWaveLoopStart = 0;
                        instrument.chipWaveLoopEnd = Config.rawRawChipWaves[instrument.chipWave].samples.length - 1;
                        instrument.chipWaveLoopMode = 0;
                        instrument.chipWavePlayBackwards = false;
                        instrument.chipWaveStartOffset = 0;
                        break;
                    case InstrumentSettings.isUsingAdvancedLoopControls:
                        instrument.isUsingAdvancedLoopControls = numberData == 1;
                        instrument.chipWaveLoopStart = 0;
                        instrument.chipWaveLoopEnd = Config.rawRawChipWaves[instrument.chipWave].samples.length - 1;
                        instrument.chipWaveLoopMode = 0;
                        instrument.chipWavePlayBackwards = false;
                        instrument.chipWaveStartOffset = 0;
                        break;
                    case InstrumentSettings.chipWaveLoopStart:
                        instrument.isUsingAdvancedLoopControls = true;
                        instrument.chipWaveLoopStart = numberData;
                        break;
                    case InstrumentSettings.chipWaveLoopEnd:
                        instrument.isUsingAdvancedLoopControls = true;
                        instrument.chipWaveLoopEnd = numberData;
                        instrument.chipWaveLoopStart = Math.max(0, Math.min(numberData - 1, instrument.chipWaveLoopStart));
                        break;
                    case InstrumentSettings.chipWaveLoopMode:
                        instrument.isUsingAdvancedLoopControls = true;
                        instrument.chipWaveLoopMode = numberData;
                        break;
                    case InstrumentSettings.chipWavePlayBackwards:
                        instrument.isUsingAdvancedLoopControls = true;
                        instrument.chipWavePlayBackwards = numberData == 1;
                        break;
                    case InstrumentSettings.chipWaveStartOffset:
                        instrument.isUsingAdvancedLoopControls = true;
                        instrument.chipWaveStartOffset = numberData;
                        break;
                    case InstrumentSettings.chipNoise:
                        instrument.chipNoise = numberData;
                        break;
                    case InstrumentSettings.eqFilter:
                        instrument.eqFilter.fromJsonObject(data);
                        instrument.tmpEqFilterStart = instrument.eqFilter;
                        instrument.tmpEqFilterEnd = null;
                
                        break;
                    case InstrumentSettings.eqFilterType:
                        instrument.eqFilterType = numberData == 1;
                        if (instrument.eqFilterType == true) {
                            // To Simple - clear eq filter
                            instrument.eqFilter.reset();
                        } else {
                            // To Advanced - convert filter
                            instrument.eqFilter.convertLegacySettings(instrument.eqFilterSimpleCut, instrument.eqFilterSimplePeak, Config.envelopePresets.dictionary["none"]);
                        }
                        instrument.tmpEqFilterStart = instrument.eqFilter;
                        instrument.tmpEqFilterEnd = null;
                        instrument.clearInvalidEnvelopeTargets();
                        break;
                    case InstrumentSettings.eqFilterSimpleCut:
                        instrument.eqFilterSimpleCut = numberData;
                        break;
                    case InstrumentSettings.eqFilterSimplePeak:
                        instrument.eqFilterSimplePeak = numberData;
                        break;
                    case InstrumentSettings.noteFilter:
                        instrument.noteFilter.fromJsonObject(data);
                        instrument.tmpNoteFilterStart = instrument.noteFilter;
                        instrument.tmpNoteFilterEnd = null;
                        break;
                    case InstrumentSettings.noteFilterType:
                        instrument.noteFilterType = numberData == 1;
                        if (instrument.eqFilterType == true) {
                            // To Simple - clear eq filter
                            instrument.noteFilter.reset();
                        } else {
                            // To Advanced - convert filter
                            instrument.noteFilter.convertLegacySettings(instrument.noteFilterSimpleCut, instrument.noteFilterSimplePeak, Config.envelopePresets.dictionary["none"]);
                        }
                        instrument.tmpNoteFilterStart = instrument.eqFilter;
                        instrument.tmpNoteFilterEnd = null;
                        instrument.clearInvalidEnvelopeTargets();
                        break;
                    case InstrumentSettings.noteFilterSimpleCut:
                        instrument.noteFilterSimpleCut = numberData;
                        break;
                    case InstrumentSettings.noteFilterSimplePeak:
                        instrument.noteFilterSimplePeak = numberData;
                        break;
                    case InstrumentSettings.eqSubFilters:
                        if (instrument.eqSubFilters[settingIndex!] == null) instrument.eqSubFilters[settingIndex!] = new FilterSettings();
                        instrument.eqSubFilters[settingIndex!]!.fromJsonObject(data);
                        instrument.tmpEqFilterStart = instrument.eqFilter;
                        instrument.tmpEqFilterEnd = null;
                        break;
                    case InstrumentSettings.noteSubFilters:
                        if (instrument.noteSubFilters[settingIndex!] == null) instrument.noteSubFilters[settingIndex!] = new FilterSettings();
                        instrument.noteSubFilters[settingIndex!]!.fromJsonObject(data);
                        instrument.tmpNoteFilterStart = instrument.noteFilter;
                        instrument.tmpNoteFilterEnd = null;
                        break;
                    case InstrumentSettings.envelopes:
                        //hmm... I guess I could send over the whole envelope...
                        //I probably shouldn't though
                        if (!instrument.envelopes[settingIndex!]) instrument.envelopes[settingIndex!] = new EnvelopeSettings(instrument.isNoiseInstrument);
                        instrument.envelopes[settingIndex!].fromJsonObject(data, "slarmoosbox");
                        break;
                    case InstrumentSettings.fadeIn:
                        instrument.fadeIn = numberData;
                        break;
                    case InstrumentSettings.fadeOut:
                        instrument.fadeOut = numberData;
                        break;
                    case InstrumentSettings.envelopeCount:
                        while (instrument.envelopeCount < numberData) {
                            instrument.envelopes[instrument.envelopeCount] = new EnvelopeSettings(instrument.isNoiseInstrument);
                            instrument.envelopeCount++;
                        }
                        instrument.envelopeCount = numberData;
                        break;
                    case InstrumentSettings.transition:
                        instrument.transition = numberData;
                        break;
                    case InstrumentSettings.slideSpeed:
                        instrument.slideTicks = numberData;
                        break;    
                    case InstrumentSettings.pitchShift:
                        instrument.pitchShift = numberData;
                        break;
                    case InstrumentSettings.detune:
                        instrument.detune = numberData;
                        break;
                    case InstrumentSettings.interval:
                        instrument.interval = numberData;
                        break;
                    case InstrumentSettings.vibrato:
                        instrument.vibrato = numberData;
                        instrument.vibratoDelay = Config.vibratos[instrument.vibrato].delayTicks / 2;
                        instrument.vibratoSpeed = 10; // default
                        instrument.vibratoType = Config.vibratos[instrument.vibrato].type;            
                        break;
                    case InstrumentSettings.vibratoDepth:
                        instrument.vibrato = Config.vibratos.length; // Custom
                        instrument.vibratoDepth = numberData;
                        break;
                    case InstrumentSettings.vibratoSpeed:
                        instrument.vibrato = Config.vibratos.length; // Custom
                        instrument.vibratoSpeed = numberData;
                        break;
                    case InstrumentSettings.vibratoDelay:
                        instrument.vibrato = Config.vibratos.length; // Custom
                        instrument.vibratoDelay = numberData;
                        break;
                    case InstrumentSettings.vibratoType:
                        instrument.vibrato = Config.vibratos.length; // Custom
                        instrument.vibratoType = numberData;
                        break;
                    case InstrumentSettings.envelopeSpeed:
                        instrument.envelopeSpeed = numberData;
                        break;
                    case InstrumentSettings.unison:
                        instrument.unison = numberData;
                        instrument.unisonVoices = Config.unisons[instrument.unison].voices;
                        instrument.unisonSpread = Config.unisons[instrument.unison].spread;
                        instrument.unisonOffset = Config.unisons[instrument.unison].offset;
                        instrument.unisonExpression = Config.unisons[instrument.unison].expression;
                        instrument.unisonSign = Config.unisons[instrument.unison].sign;
                        
                        break;
                    case InstrumentSettings.unisonVoices:
                        instrument.unison = Config.unisons.length; // Custom
                        instrument.unisonVoices = numberData;
                        break;
                    case InstrumentSettings.unisonSpread:
                        instrument.unison = Config.unisons.length; // Custom
                        instrument.unisonSpread = numberData;
                        break;
                    case InstrumentSettings.unisonOffset:
                        instrument.unison = Config.unisons.length; // Custom
                        instrument.unisonOffset = numberData;
                        break;
                    case InstrumentSettings.unisonExpression:
                        instrument.unison = Config.unisons.length; // Custom
                        instrument.unisonExpression = numberData;
                        break;
                    case InstrumentSettings.unisonSign:
                        instrument.unison = Config.unisons.length; // Custom
                        instrument.unisonSign = numberData;
                        break;
                    case InstrumentSettings.unisonAntiPhased:
                        instrument.unison = Config.unisons.length; // Custom
                        instrument.unisonAntiPhased = numberData == 1;
                        break;
                    case InstrumentSettings.unisonBuzzes:
                        // instrument.unison = Config.unisons.length; // Custom
                        instrument.unisonBuzzes = numberData == 1;
                        break;
                    case InstrumentSettings.effects:
                        instrument.effects = numberData;
                        instrument.clearInvalidEnvelopeTargets();
                        break;
                    case InstrumentSettings.chord:
                        instrument.chord = numberData;
                        break;
                    case InstrumentSettings.strumSpeed:
                        instrument.strumParts = numberData;
                        break;    
                    case InstrumentSettings.volume:
                        instrument.volume = numberData;
                        break;
                    case InstrumentSettings.pan:
                        instrument.pan = numberData;
                        break;
                    case InstrumentSettings.panDelay:
                        instrument.panDelay = numberData;
                        break;
                    case InstrumentSettings.arpeggioSpeed:
                        instrument.arpeggioSpeed = numberData;
                        break;
                    case InstrumentSettings.monoChordTone:
                        instrument.monoChordTone = numberData;
                        break;
                    case InstrumentSettings.fastTwoNoteArp:
                        instrument.fastTwoNoteArp = numberData == 1;
                        break;
                    case InstrumentSettings.legacyTieOver:
                        instrument.legacyTieOver = numberData == 1;
                        break;
                    case InstrumentSettings.clicklessTransition:
                        instrument.clicklessTransition = numberData == 1;
                        break;
                    case InstrumentSettings.aliases:
                        instrument.aliases = numberData == 1;
                        break;
                    case InstrumentSettings.pulseWidth:
                        instrument.pulseWidth = numberData;
                        break;
                    case InstrumentSettings.decimalOffset:
                        instrument.decimalOffset = numberData;
                        break;
                    case InstrumentSettings.supersawDynamism:
                        instrument.supersawDynamism = numberData;
                        break;
                    case InstrumentSettings.supersawSpread:
                        instrument.supersawSpread = numberData;
                        break;
                    case InstrumentSettings.supersawShape:
                        instrument.supersawShape = numberData;
                        break;
                    case InstrumentSettings.stringSustain:
                        instrument.stringSustain = numberData;
                        break;
                    case InstrumentSettings.stringSustainType:
                        instrument.stringSustainType = numberData;
                        break;
                    case InstrumentSettings.distortion:
                        instrument.distortion = numberData;
                        break;
                    case InstrumentSettings.bitcrusherFreq:
                        instrument.bitcrusherFreq = numberData;
                        break;
                    case InstrumentSettings.bitcrusherQuantization:
                        instrument.bitcrusherQuantization = numberData;
                        break;
                    case InstrumentSettings.ringModulation:
                        instrument.ringModulation = numberData;
                        break;
                    case InstrumentSettings.ringModulationHz:
                        instrument.ringModulationHz = numberData;
                        break;
                    case InstrumentSettings.ringModWaveformIndex:
                        instrument.ringModWaveformIndex = numberData;
                        break;
                    case InstrumentSettings.ringModPulseWidth:
                        instrument.ringModPulseWidth = numberData;
                        break;
                    case InstrumentSettings.ringModHzOffset:
                        instrument.ringModHzOffset = numberData;
                        break;
                    case InstrumentSettings.granular:
                        instrument.granular = numberData;
                        break;
                    case InstrumentSettings.grainSize:
                        instrument.grainSize = numberData;
                        break;
                    case InstrumentSettings.grainFreq:
                        instrument.grainFreq = numberData;
                        break;
                    case InstrumentSettings.grainRange:
                        instrument.grainRange = numberData;
                        break;
                    case InstrumentSettings.chorus:
                        instrument.chorus = numberData;
                        break;
                    case InstrumentSettings.reverb:
                        instrument.reverb = numberData;
                        break;
                    case InstrumentSettings.echoSustain:
                        instrument.echoSustain = numberData;
                        break;
                    case InstrumentSettings.echoDelay:
                        instrument.echoDelay = numberData;
                        break;
                    case InstrumentSettings.pluginValues:
                        instrument.pluginValues[settingIndex!] = numberData;
                        break;
                    case InstrumentSettings.algorithm:
                        instrument.algorithm = numberData;
                        break;
                    case InstrumentSettings.feedbackType:
                        instrument.feedbackType = numberData;
                        break;
                    case InstrumentSettings.algorithm6Op:
                        instrument.algorithm6Op = numberData;
                        break;
                    case InstrumentSettings.feedbackType6Op:
                        instrument.feedbackType6Op = numberData;
                        break;
                    case InstrumentSettings.customAlgorithm:
                        instrument.customAlgorithm = new CustomAlgorithm();
                        instrument.customAlgorithm.set(data.carriers, data.modulation);
                        instrument.algorithm6Op = 0;
                        break;
                    case InstrumentSettings.customFeedbackType:
                        instrument.customFeedbackType = new CustomFeedBack();
                        instrument.customFeedbackType.set(data as number[][]);
                        instrument.feedbackType6Op = 0;
                        break;
                    case InstrumentSettings.feedbackAmplitude:
                        instrument.feedbackAmplitude = numberData;
                        break;
                    case InstrumentSettings.customChipWave:
                        instrument.customChipWave = data as Float32Array;
                        break;
                    case InstrumentSettings.customChipWaveIntegral:
                        instrument.customChipWaveIntegral = data as Float32Array;
                        break;
                    case InstrumentSettings.operators:
                        instrument.operators[settingIndex!] = new Operator(settingIndex!)
                        instrument.operators[settingIndex!].frequency = data.frequency;
                        instrument.operators[settingIndex!].amplitude = data.amplitude;
                        instrument.operators[settingIndex!].waveform = data.waveform;
                        instrument.operators[settingIndex!].pulseWidth = data.pulseWidth;
                        break;
                    // case InstrumentSettings.operatorFrequency:
                    //     if (!instrument.operators[settingIndex!]) instrument.operators[settingIndex!] = new Operator(settingIndex!);
                    //     instrument.operators[settingIndex!].frequency = numberData;
                    //     break;
                    // case InstrumentSettings.operatorAmplitude:
                    //     if (!instrument.operators[settingIndex!]) instrument.operators[settingIndex!] = new Operator(settingIndex!);
                    //     instrument.operators[settingIndex!].amplitude = numberData;
                    //     break;
                    // case InstrumentSettings.operatorWaveform:
                    //     if (!instrument.operators[settingIndex!]) instrument.operators[settingIndex!] = new Operator(settingIndex!);
                    //     instrument.operators[settingIndex!].waveform = numberData;
                    //     break;
                    // case InstrumentSettings.operatorPulseWidth:
                    //     if (!instrument.operators[settingIndex!]) instrument.operators[settingIndex!] = new Operator(settingIndex!);
                    //     instrument.operators[settingIndex!].pulseWidth = numberData;
                    //     break;
                    case InstrumentSettings.spectrumWave:
                        instrument.spectrumWave.spectrum = data as number[];
                        instrument.spectrumWave.markCustomWaveDirty();
                        break;
                    case InstrumentSettings.harmonicsWave:
                        instrument.harmonicsWave.harmonics = data as number[];
                        instrument.harmonicsWave.markCustomWaveDirty();
                        break;
                    case InstrumentSettings.drumsetEnvelopes:
                        instrument.drumsetEnvelopes[settingIndex!] = numberData;
                        break;
                    case InstrumentSettings.drumsetSpectrumWaves:
                        instrument.drumsetSpectrumWaves[settingIndex!].spectrum = data as number[];
                        instrument.drumsetSpectrumWaves[settingIndex!].markCustomWaveDirty();
                        break;
                    case InstrumentSettings.modChannels:
                        instrument.modChannels = data as number[];
                        break;
                    case InstrumentSettings.modInstruments:
                        instrument.modInstruments = data as number[];
                        break;
                    case InstrumentSettings.modulators:
                        instrument.modulators = data as number[];
                        break;
                    case InstrumentSettings.modFilterTypes:
                        instrument.modFilterTypes = data as number[];
                        break;
                    case InstrumentSettings.modEnvelopeNumbers:
                        instrument.modEnvelopeNumbers = data as number[];
                        break;
                    case InstrumentSettings.invalidModulators:
                        instrument.invalidModulators = data as boolean[];
                        break;
                }
        }
    }


    public toJsonObject(enableIntro: boolean = true, loopCount: number = 1, enableOutro: boolean = true): Object {
        const channelArray: Object[] = [];
        for (let channelIndex: number = 0; channelIndex < this.getChannelCount(); channelIndex++) {
            const channel: Channel = this.channels[channelIndex];
            const instrumentArray: Object[] = [];
            const isNoiseChannel: boolean = this.getChannelIsNoise(channelIndex);
            const isModChannel: boolean = this.getChannelIsMod(channelIndex);
            for (const instrument of channel.instruments) {
                instrumentArray.push(instrument.toJsonObject());
            }

            const patternArray: Object[] = [];
            for (const pattern of channel.patterns) {
                patternArray.push(pattern.toJsonObject(this, channel, isModChannel));
            }

            const sequenceArray: number[] = [];
            if (enableIntro) for (let i: number = 0; i < this.loopStart; i++) {
                sequenceArray.push(channel.bars[i]);
            }
            for (let l: number = 0; l < loopCount; l++) for (let i: number = this.loopStart; i < this.loopStart + this.loopLength; i++) {
                sequenceArray.push(channel.bars[i]);
            }
            if (enableOutro) for (let i: number = this.loopStart + this.loopLength; i < this.barCount; i++) {
                sequenceArray.push(channel.bars[i]);
            }

            const channelObject: any = {
                "type": isModChannel ? "mod" : (isNoiseChannel ? "drum" : "pitch"),
                "name": channel.name,
                "instruments": instrumentArray,
                "patterns": patternArray,
                "sequence": sequenceArray,
            };
            if (!isNoiseChannel) {
                // For compatibility with old versions the octave is offset by one.
                channelObject["octaveScrollBar"] = channel.octave - 1;
            }
            channelArray.push(channelObject);
        }

        const result: any = {
            "name": this.title,
            "format": Song._format,
            "version": Song._latestSlarmoosBoxVersion,
            "scale": Config.scales[this.scale].name,
            "customScale": this.scaleCustom,
            "key": Config.keys[this.key].name,
            "keyOctave": this.octave,
            "introBars": this.loopStart,
            "loopBars": this.loopLength,
            "beatsPerBar": this.beatsPerBar,
            "ticksPerBeat": Config.rhythms[this.rhythm].stepsPerBeat,
            "beatsPerMinute": this.tempo,
            "reverb": this.reverb,
            "masterGain": this.masterGain,
            "compressionThreshold": this.compressionThreshold,
            "limitThreshold": this.limitThreshold,
            "limitDecay": this.limitDecay,
            "limitRise": this.limitRise,
            "limitRatio": this.limitRatio,
            "compressionRatio": this.compressionRatio,
            //"outroBars": this.barCount - this.loopStart - this.loopLength; // derive this from bar arrays?
            //"patternCount": this.patternsPerChannel, // derive this from pattern arrays?
            "songEq": this.eqFilter.toJsonObject(),
            "layeredInstruments": this.layeredInstruments,
            "patternInstruments": this.patternInstruments,
            "channels": channelArray,
        };

        //song eq subfilters
        for (let i: number = 0; i < Config.filterMorphCount - 1; i++) {
            result["songEq" + i] = this.eqSubFilters[i];
        }

        if (EditorConfig.customSamples != null && EditorConfig.customSamples.length > 0) {
            result["customSamples"] = EditorConfig.customSamples;
        }

        if (this.pluginurl != null) {
            result["pluginurl"] = this.pluginurl;
        }

        return result;
    }

    public fromJsonObject(jsonObject: any, jsonFormat: string = "auto"): void {
        this.initToDefault(true);
        if (!jsonObject) return;

        //const version: number = jsonObject["version"] | 0;
        //if (version > Song._latestVersion) return; // Go ahead and try to parse something from the future I guess? JSON is pretty easy-going!

        // Code for auto-detect mode; if statements that are lower down have 'higher priority'
        if (jsonFormat == "auto") {
            if (jsonObject["format"] == "BeepBox") {
                // Assume that if there is a "riff" song setting then it must be modbox
                if (jsonObject["riff"] != undefined) {
                    jsonFormat = "modbox";
                }

                // Assume that if there are limiter song settings then it must be jummbox
                // Despite being added in JB 2.1, json export for the limiter settings wasn't added until 2.3
                if (jsonObject["masterGain"] != undefined) {
                    jsonFormat = "jummbox";
                }
            }
        }

        const format: string = (jsonFormat == "auto" ? jsonObject["format"] : jsonFormat).toLowerCase();

        if (jsonObject["name"] != undefined) {
            this.title = jsonObject["name"];
        }

        if (jsonObject["pluginurl"] != undefined) {
            this.pluginurl = jsonObject["pluginurl"];
            if (this.updateSynthPlugin) this.fetchPlugin(jsonObject["pluginurl"], this.updateSynthPlugin);
        }

        if (jsonObject["customSamples"] != undefined) {
            const customSamples: string[] = jsonObject["customSamples"];
            if (EditorConfig.customSamples == null || EditorConfig.customSamples.join(", ") != customSamples.join(", ")) {
                // Have to duplicate the work done in Song.fromBase64String
                // early here, because Instrument.fromJsonObject depends on the
                // chip wave list having the correct items already in memory.

                Config.willReloadForCustomSamples = true;

                Song._restoreChipWaveListToDefault();

                let willLoadLegacySamples: boolean = false;
                let willLoadNintariboxSamples: boolean = false;
                let willLoadMarioPaintboxSamples: boolean = false;
                const customSampleUrls: string[] = [];
                const customSamplePresets: Preset[] = [];
                for (const url of customSamples) {
                    if (url.toLowerCase() === "legacysamples") {
                        if (!willLoadLegacySamples) {
                            willLoadLegacySamples = true;
                            customSampleUrls.push(url);
                            loadBuiltInSamples(0);
                        }
                    } else if (url.toLowerCase() === "nintariboxsamples") {
                        if (!willLoadNintariboxSamples) {
                            willLoadNintariboxSamples = true;
                            customSampleUrls.push(url);
                            loadBuiltInSamples(1);
                        }
                    } else if (url.toLowerCase() === "mariopaintboxsamples") {
                        if (!willLoadMarioPaintboxSamples) {
                            willLoadMarioPaintboxSamples = true;
                            customSampleUrls.push(url);
                            loadBuiltInSamples(2);
                        }
                    } else if (this.updateSynthSamplesStart && this.updateSynthSamplesFinish) {
                        // When EditorConfig.customSamples is saved in the json
                        // export, it should be using the new syntax, unless
                        // the user has manually modified the URL, so we don't
                        // really need to parse the old syntax here.
                        const parseOldSyntax: boolean = false;
                        Song._parseAndConfigureCustomSample(url, customSampleUrls, customSamplePresets, sampleLoadingState, parseOldSyntax, this.updateSynthSamplesStart, this.updateSynthSamplesFinish);
                    }
                }
                if (customSampleUrls.length > 0) {
                    EditorConfig.customSamples = customSampleUrls;
                }
                if (customSamplePresets.length > 0) {
                    const customSamplePresetsMap: DictionaryArray<Preset> = toNameMap(customSamplePresets);
                    EditorConfig.presetCategories[EditorConfig.presetCategories.length] = {
                        name: "Custom Sample Presets",
                        presets: customSamplePresetsMap,
                        index: EditorConfig.presetCategories.length,
                    };
                }
            }
        } else {
            // No custom samples, so the only possibility at this point is that
            // we need to load the legacy samples. Let's check whether that's
            // necessary.
            let shouldLoadLegacySamples: boolean = false;
            if (jsonObject["channels"] != undefined) {
                for (let channelIndex: number = 0; channelIndex < jsonObject["channels"].length; channelIndex++) {
                    const channelObject: any = jsonObject["channels"][channelIndex];
                    if (channelObject["type"] !== "pitch") {
                        // Legacy samples can only exist in pitch channels.
                        continue;
                    }
                    if (Array.isArray(channelObject["instruments"])) {
                        const instrumentObjects: any[] = channelObject["instruments"];
                        for (let i: number = 0; i < instrumentObjects.length; i++) {
                            const instrumentObject: any = instrumentObjects[i];
                            if (instrumentObject["type"] !== "chip") {
                                // Legacy samples can only exist in chip wave
                                // instruments.
                                continue;
                            }
                            if (instrumentObject["wave"] == null) {
                                // This should exist if things got saved
                                // correctly, but if they didn't, skip this.
                                continue;
                            }
                            const waveName: string = instrumentObject["wave"];
                            // @TODO: Avoid this duplication.
                            const names: string[] = [
                                "paandorasbox kick",
                                "paandorasbox snare",
                                "paandorasbox piano1",
                                "paandorasbox WOW",
                                "paandorasbox overdrive",
                                "paandorasbox trumpet",
                                "paandorasbox saxophone",
                                "paandorasbox orchestrahit",
                                "paandorasbox detatched violin",
                                "paandorasbox synth",
                                "paandorasbox sonic3snare",
                                "paandorasbox come on",
                                "paandorasbox choir",
                                "paandorasbox overdriveguitar",
                                "paandorasbox flute",
                                "paandorasbox legato violin",
                                "paandorasbox tremolo violin",
                                "paandorasbox amen break",
                                "paandorasbox pizzicato violin",
                                "paandorasbox tim allen grunt",
                                "paandorasbox tuba",
                                "paandorasbox loopingcymbal",
                                "paandorasbox standardkick",
                                "paandorasbox standardsnare",
                                "paandorasbox closedhihat",
                                "paandorasbox foothihat",
                                "paandorasbox openhihat",
                                "paandorasbox crashcymbal",
                                "paandorasbox pianoC4",
                                "paandorasbox liver pad",
                                "paandorasbox marimba",
                                "paandorasbox susdotwav",
                                "paandorasbox wackyboxtts",
                                "paandorasbox peppersteak_1",
                                "paandorasbox peppersteak_2",
                                "paandorasbox vinyl_noise",
                                "paandorasbeta slap bass",
                                "paandorasbeta HD EB overdrive guitar",
                                "paandorasbeta sunsoft bass",
                                "paandorasbeta masculine choir",
                                "paandorasbeta feminine choir",
                                "paandorasbeta tololoche",
                                "paandorasbeta harp",
                                "paandorasbeta pan flute",
                                "paandorasbeta krumhorn",
                                "paandorasbeta timpani",
                                "paandorasbeta crowd hey",
                                "paandorasbeta wario land 4 brass",
                                "paandorasbeta wario land 4 rock organ",
                                "paandorasbeta wario land 4 DAOW",
                                "paandorasbeta wario land 4 hour chime",
                                "paandorasbeta wario land 4 tick",
                                "paandorasbeta kirby kick",
                                "paandorasbeta kirby snare",
                                "paandorasbeta kirby bongo",
                                "paandorasbeta kirby click",
                                "paandorasbeta sonor kick",
                                "paandorasbeta sonor snare",
                                "paandorasbeta sonor snare (left hand)",
                                "paandorasbeta sonor snare (right hand)",
                                "paandorasbeta sonor high tom",
                                "paandorasbeta sonor low tom",
                                "paandorasbeta sonor hihat (closed)",
                                "paandorasbeta sonor hihat (half opened)",
                                "paandorasbeta sonor hihat (open)",
                                "paandorasbeta sonor hihat (open tip)",
                                "paandorasbeta sonor hihat (pedal)",
                                "paandorasbeta sonor crash",
                                "paandorasbeta sonor crash (tip)",
                                "paandorasbeta sonor ride"
                            ];
                            // The difference for these is in the doubled a.
                            const oldNames: string[] = [
                                "pandoraasbox kick",
                                "pandoraasbox snare",
                                "pandoraasbox piano1",
                                "pandoraasbox WOW",
                                "pandoraasbox overdrive",
                                "pandoraasbox trumpet",
                                "pandoraasbox saxophone",
                                "pandoraasbox orchestrahit",
                                "pandoraasbox detatched violin",
                                "pandoraasbox synth",
                                "pandoraasbox sonic3snare",
                                "pandoraasbox come on",
                                "pandoraasbox choir",
                                "pandoraasbox overdriveguitar",
                                "pandoraasbox flute",
                                "pandoraasbox legato violin",
                                "pandoraasbox tremolo violin",
                                "pandoraasbox amen break",
                                "pandoraasbox pizzicato violin",
                                "pandoraasbox tim allen grunt",
                                "pandoraasbox tuba",
                                "pandoraasbox loopingcymbal",
                                "pandoraasbox standardkick",
                                "pandoraasbox standardsnare",
                                "pandoraasbox closedhihat",
                                "pandoraasbox foothihat",
                                "pandoraasbox openhihat",
                                "pandoraasbox crashcymbal",
                                "pandoraasbox pianoC4",
                                "pandoraasbox liver pad",
                                "pandoraasbox marimba",
                                "pandoraasbox susdotwav",
                                "pandoraasbox wackyboxtts",
                                "pandoraasbox peppersteak_1",
                                "pandoraasbox peppersteak_2",
                                "pandoraasbox vinyl_noise",
                                "pandoraasbeta slap bass",
                                "pandoraasbeta HD EB overdrive guitar",
                                "pandoraasbeta sunsoft bass",
                                "pandoraasbeta masculine choir",
                                "pandoraasbeta feminine choir",
                                "pandoraasbeta tololoche",
                                "pandoraasbeta harp",
                                "pandoraasbeta pan flute",
                                "pandoraasbeta krumhorn",
                                "pandoraasbeta timpani",
                                "pandoraasbeta crowd hey",
                                "pandoraasbeta wario land 4 brass",
                                "pandoraasbeta wario land 4 rock organ",
                                "pandoraasbeta wario land 4 DAOW",
                                "pandoraasbeta wario land 4 hour chime",
                                "pandoraasbeta wario land 4 tick",
                                "pandoraasbeta kirby kick",
                                "pandoraasbeta kirby snare",
                                "pandoraasbeta kirby bongo",
                                "pandoraasbeta kirby click",
                                "pandoraasbeta sonor kick",
                                "pandoraasbeta sonor snare",
                                "pandoraasbeta sonor snare (left hand)",
                                "pandoraasbeta sonor snare (right hand)",
                                "pandoraasbeta sonor high tom",
                                "pandoraasbeta sonor low tom",
                                "pandoraasbeta sonor hihat (closed)",
                                "pandoraasbeta sonor hihat (half opened)",
                                "pandoraasbeta sonor hihat (open)",
                                "pandoraasbeta sonor hihat (open tip)",
                                "pandoraasbeta sonor hihat (pedal)",
                                "pandoraasbeta sonor crash",
                                "pandoraasbeta sonor crash (tip)",
                                "pandoraasbeta sonor ride"
                            ];
                            // This mirrors paandorasboxWaveNames, which is unprefixed.
                            const veryOldNames: string[] = [
                                "kick",
                                "snare",
                                "piano1",
                                "WOW",
                                "overdrive",
                                "trumpet",
                                "saxophone",
                                "orchestrahit",
                                "detatched violin",
                                "synth",
                                "sonic3snare",
                                "come on",
                                "choir",
                                "overdriveguitar",
                                "flute",
                                "legato violin",
                                "tremolo violin",
                                "amen break",
                                "pizzicato violin",
                                "tim allen grunt",
                                "tuba",
                                "loopingcymbal",
                                "standardkick",
                                "standardsnare",
                                "closedhihat",
                                "foothihat",
                                "openhihat",
                                "crashcymbal",
                                "pianoC4",
                                "liver pad",
                                "marimba",
                                "susdotwav",
                                "wackyboxtts"
                            ];
                            if (names.includes(waveName)) {
                                shouldLoadLegacySamples = true;
                            } else if (oldNames.includes(waveName)) {
                                shouldLoadLegacySamples = true;
                                // If we see one of these old names, update it
                                // to the corresponding new name.
                                instrumentObject["wave"] = names[oldNames.findIndex(x => x === waveName)];
                            } else if (veryOldNames.includes(waveName)) {
                                if ((waveName === "trumpet" || waveName === "flute") && (format != "paandorasbox")) {
                                    // If we see chip waves named trumpet or flute, and if the format isn't PaandorasBox, we leave them as-is
                                } else {
                                    // There's no other chip waves with ambiguous names like that, so it should
                                    // be okay to assume we'll need to load the legacy samples now.
                                    shouldLoadLegacySamples = true;
                                    // If we see one of these old names, update it
                                    // to the corresponding new name.
                                    instrumentObject["wave"] = names[veryOldNames.findIndex(x => x === waveName)];
                                }
                            }
                        }
                    }
                }
            }
            if (shouldLoadLegacySamples) {
                Config.willReloadForCustomSamples = true;

                Song._restoreChipWaveListToDefault();

                loadBuiltInSamples(0);
                EditorConfig.customSamples = ["legacySamples"];
            } else {
                // We don't need to load the legacy samples, but we may have
                // leftover samples in memory. If we do, clear them.
                if (EditorConfig.customSamples != null && EditorConfig.customSamples.length > 0) {
                    // We need to reload anyway in this case, because (for now)
                    // the chip wave lists won't be correctly updated.
                    Config.willReloadForCustomSamples = true;
                    Song._clearSamples();
                }
            }
        }

        this.scale = 0; // default to free.
        if (jsonObject["scale"] != undefined) {
            const oldScaleNames: Dictionary<string> = {
                "romani :)": "double harmonic :)",
                "romani :(": "double harmonic :(",
                "dbl harmonic :)": "double harmonic :)",
                "dbl harmonic :(": "double harmonic :(",
                "enigma": "strange",
            };
            const scaleName: string = (oldScaleNames[jsonObject["scale"]] != undefined) ? oldScaleNames[jsonObject["scale"]] : jsonObject["scale"];
            const scale: number = Config.scales.findIndex(scale => scale.name == scaleName);
            if (scale != -1) this.scale = scale;
            if (this.scale == Config.scales["dictionary"]["Custom"].index) {
                if (jsonObject["customScale"] != undefined) {
                    for (var i of jsonObject["customScale"].keys()) {
                        this.scaleCustom[i] = jsonObject["customScale"][i];
                    }
                }
            }
        }

        if (jsonObject["key"] != undefined) {
            if (typeof (jsonObject["key"]) == "number") {
                this.key = ((jsonObject["key"] + 1200) >>> 0) % Config.keys.length;
            } else if (typeof (jsonObject["key"]) == "string") {
                const key: string = jsonObject["key"];
                // This conversion code depends on C through B being
                // available as keys, of course.
                if (key === "C+") {
                    this.key = 0;
                    this.octave = 1;
                } else if (key === "G- (actually F#-)") {
                    this.key = 6;
                    this.octave = -1;
                } else if (key === "C-") {
                    this.key = 0;
                    this.octave = -1;
                } else if (key === "oh no (F-)") {
                    this.key = 5;
                    this.octave = -1;
                } else {
                    const letter: string = key.charAt(0).toUpperCase();
                    const symbol: string = key.charAt(1).toLowerCase();
                    const letterMap: Readonly<Dictionary<number>> = { "C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11 };
                    const accidentalMap: Readonly<Dictionary<number>> = { "#": 1, "♯": 1, "b": -1, "♭": -1 };
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
        }

        if (jsonObject["beatsPerMinute"] != undefined) {
            this.tempo = clamp(Config.tempoMin, Config.tempoMax + 1, jsonObject["beatsPerMinute"] | 0);
        }

        if (jsonObject["keyOctave"] != undefined) {
            this.octave = clamp(Config.octaveMin, Config.octaveMax + 1, jsonObject["keyOctave"] | 0);
        }

        let legacyGlobalReverb: number = 0; // In older songs, reverb was song-global, record that here and pass it to Instrument.fromJsonObject() for context.
        if (jsonObject["reverb"] != undefined) {
            legacyGlobalReverb = clamp(0, 32, jsonObject["reverb"] | 0);
        }

        if (jsonObject["beatsPerBar"] != undefined) {
            this.beatsPerBar = Math.max(Config.beatsPerBarMin, Math.min(Config.beatsPerBarMax, jsonObject["beatsPerBar"] | 0));
        }

        let importedPartsPerBeat: number = 4;
        if (jsonObject["ticksPerBeat"] != undefined) {
            importedPartsPerBeat = (jsonObject["ticksPerBeat"] | 0) || 4;
            this.rhythm = Config.rhythms.findIndex(rhythm => rhythm.stepsPerBeat == importedPartsPerBeat);
            if (this.rhythm == -1) {
                this.rhythm = 1; //default rhythm
            }
        }

        // Read limiter settings. Ranges and defaults are based on slider settings

        if (jsonObject["masterGain"] != undefined) {
            this.masterGain = Math.max(0.0, Math.min(5.0, jsonObject["masterGain"] || 0));
        } else {
            this.masterGain = 1.0;
        }

        if (jsonObject["limitThreshold"] != undefined) {
            this.limitThreshold = Math.max(0.0, Math.min(2.0, jsonObject["limitThreshold"] || 0));
        } else {
            this.limitThreshold = 1.0;
        }

        if (jsonObject["compressionThreshold"] != undefined) {
            this.compressionThreshold = Math.max(0.0, Math.min(1.1, jsonObject["compressionThreshold"] || 0));
        } else {
            this.compressionThreshold = 1.0;
        }

        if (jsonObject["limitRise"] != undefined) {
            this.limitRise = Math.max(2000.0, Math.min(10000.0, jsonObject["limitRise"] || 0));
        } else {
            this.limitRise = 4000.0;
        }

        if (jsonObject["limitDecay"] != undefined) {
            this.limitDecay = Math.max(1.0, Math.min(30.0, jsonObject["limitDecay"] || 0));
        } else {
            this.limitDecay = 4.0;
        }

        if (jsonObject["limitRatio"] != undefined) {
            this.limitRatio = Math.max(0.0, Math.min(11.0, jsonObject["limitRatio"] || 0));
        } else {
            this.limitRatio = 1.0;
        }

        if (jsonObject["compressionRatio"] != undefined) {
            this.compressionRatio = Math.max(0.0, Math.min(1.168, jsonObject["compressionRatio"] || 0));
        } else {
            this.compressionRatio = 1.0;
        }

        if (jsonObject["songEq"] != undefined) {
            this.eqFilter.fromJsonObject(jsonObject["songEq"]);
        } else {
            this.eqFilter.reset();
        }

        for (let i: number = 0; i < Config.filterMorphCount - 1; i++) {
            if (jsonObject["songEq" + i]) {
                this.eqSubFilters[i] = jsonObject["songEq" + i];
            } else {
                this.eqSubFilters[i] = null;
            }
        }

        let maxInstruments: number = 1;
        let maxPatterns: number = 1;
        let maxBars: number = 1;
        if (jsonObject["channels"] != undefined) {
            for (const channelObject of jsonObject["channels"]) {
                if (channelObject["instruments"]) maxInstruments = Math.max(maxInstruments, channelObject["instruments"].length | 0);
                if (channelObject["patterns"]) maxPatterns = Math.max(maxPatterns, channelObject["patterns"].length | 0);
                if (channelObject["sequence"]) maxBars = Math.max(maxBars, channelObject["sequence"].length | 0);
            }
        }

        if (jsonObject["layeredInstruments"] != undefined) {
            this.layeredInstruments = !!jsonObject["layeredInstruments"];
        } else {
            this.layeredInstruments = false;
        }
        if (jsonObject["patternInstruments"] != undefined) {
            this.patternInstruments = !!jsonObject["patternInstruments"];
        } else {
            this.patternInstruments = (maxInstruments > 1);
        }
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
        const newModChannels: Channel[] = [];
        if (jsonObject["channels"] != undefined) {
            for (let channelIndex: number = 0; channelIndex < jsonObject["channels"].length; channelIndex++) {
                let channelObject: any = jsonObject["channels"][channelIndex];

                const channel: Channel = new Channel();

                let isNoiseChannel: boolean = false;
                let isModChannel: boolean = false;
                if (channelObject["type"] != undefined) {
                    isNoiseChannel = (channelObject["type"] == "drum");
                    isModChannel = (channelObject["type"] == "mod");
                } else {
                    // for older files, assume drums are channel 3.
                    isNoiseChannel = (channelIndex >= 3);
                }
                if (isNoiseChannel) {
                    newNoiseChannels.push(channel);
                } else if (isModChannel) {
                    newModChannels.push(channel);
                }
                else {
                    newPitchChannels.push(channel);
                }

                if (channelObject["octaveScrollBar"] != undefined) {
                    channel.octave = clamp(0, Config.pitchOctaves, (channelObject["octaveScrollBar"] | 0) + 1);
                    if (isNoiseChannel) channel.octave = 0;
                }

                if (channelObject["name"] != undefined) {
                    channel.name = channelObject["name"];
                }
                else {
                    channel.name = "";
                }

                if (Array.isArray(channelObject["instruments"])) {
                    const instrumentObjects: any[] = channelObject["instruments"];
                    for (let i: number = 0; i < instrumentObjects.length; i++) {
                        if (i >= this.getMaxInstrumentsPerChannel()) break;
                        const instrument: Instrument = new Instrument(isNoiseChannel, isModChannel);
                        channel.instruments[i] = instrument;
                        instrument.fromJsonObject(instrumentObjects[i], isNoiseChannel, isModChannel, false, false, legacyGlobalReverb, format);
                    }

                }

                for (let i: number = 0; i < this.patternsPerChannel; i++) {
                    const pattern: Pattern = new Pattern();
                    channel.patterns[i] = pattern;

                    let patternObject: any = undefined;
                    if (channelObject["patterns"]) patternObject = channelObject["patterns"][i];
                    if (patternObject == undefined) continue;

                    pattern.fromJsonObject(patternObject, this, channel, importedPartsPerBeat, isNoiseChannel, isModChannel, format);
                }
                channel.patterns.length = this.patternsPerChannel;

                for (let i: number = 0; i < this.barCount; i++) {
                    channel.bars[i] = (channelObject["sequence"] != undefined) ? Math.min(this.patternsPerChannel, channelObject["sequence"][i] >>> 0) : 0;
                }
                channel.bars.length = this.barCount;
            }
        }

        if (newPitchChannels.length > Config.pitchChannelCountMax) newPitchChannels.length = Config.pitchChannelCountMax;
        if (newNoiseChannels.length > Config.noiseChannelCountMax) newNoiseChannels.length = Config.noiseChannelCountMax;
        if (newModChannels.length > Config.modChannelCountMax) newModChannels.length = Config.modChannelCountMax;
        this.pitchChannelCount = newPitchChannels.length;
        this.noiseChannelCount = newNoiseChannels.length;
        this.modChannelCount = newModChannels.length;
        this.channels.length = 0;
        Array.prototype.push.apply(this.channels, newPitchChannels);
        Array.prototype.push.apply(this.channels, newNoiseChannels);
        Array.prototype.push.apply(this.channels, newModChannels);

        if (Config.willReloadForCustomSamples) {
            window.location.hash = this.toBase64String();
            // The prompt seems to get stuck if reloading is done too quickly.
            setTimeout(() => { location.reload(); }, 50);
        }
    }

    public getPattern(channelIndex: number, bar: number): Pattern | null {
        if (bar < 0 || bar >= this.barCount) return null;
        const patternIndex: number = this.channels[channelIndex].bars[bar];
        if (patternIndex == 0) return null;
        return this.channels[channelIndex].patterns[patternIndex - 1];
    }

    public getBeatsPerMinute(): number {
        return this.tempo;
    }

    public static getNeededBits(maxValue: number): number {
        return 32 - Math.clz32(Math.ceil(maxValue + 1) - 1);
    }

    public restoreLimiterDefaults(): void {
        this.compressionRatio = 1.0;
        this.limitRatio = 1.0;
        this.limitRise = 4000.0;
        this.limitDecay = 4.0;
        this.limitThreshold = 1.0;
        this.compressionThreshold = 1.0;
        this.masterGain = 1.0;
    }
}

export function discardInvalidPatternInstruments(instruments: number[], song: Song, channelIndex: number) {
    const uniqueInstruments: Set<number> = new Set(instruments);
    instruments.length = 0;
    instruments.push(...uniqueInstruments);
    for (let i: number = 0; i < instruments.length; i++) {
        if (instruments[i] >= song.channels[channelIndex].instruments.length) {
            instruments.splice(i, 1);
            i--;
        }
    }
    if (instruments.length > song.getMaxInstrumentsPerPattern(channelIndex)) {
        instruments.length = song.getMaxInstrumentsPerPattern(channelIndex);
    }
    if (instruments.length <= 0) {
        instruments[0] = 0;
    }
}

export class SynthMessenger {

    public samplesPerSecond: number = 44100;
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
    public liveInputValues: Uint32Array = new Uint32Array(new SharedArrayBuffer(6 * 4));
    private readonly liveInputPitchesSAB: SharedArrayBuffer = new SharedArrayBuffer(Config.maxPitch)
    private readonly liveInputPitchesOnOffRequests: RingBuffer = new RingBuffer(this.liveInputPitchesSAB, Uint16Array)
    public loopRepeatCount: number = -1;
    public oscRefreshEventTimer: number = 0;
    public oscEnabled: boolean = true;
    public enableMetronome: boolean = false;
    public countInMetronome: boolean = false;
    public renderingSong: boolean = false;
    public heldMods: HeldMod[] = []; 
    private playheadInternal: number = 0.0;
    private bar: number = 0;
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
    private liveInputEndTime: number = 0.0;

    public loopBarStart: number = -1;
    /** An *inclusive* bound. */
    public loopBarEnd: number = -1;

    public static pluginFunction: string | null = null;
    public static pluginIndex: number = 0;
    public static pluginValueNames: string[] = [];
    public static pluginInstrumentStateFunction: string | null = null;
    public static PluginDelayLineSize: number = 0;
    public static rerenderSongEditorAfterPluginLoad: Function | null = null;

    private audioContext: any | null = null;
    private workletNode: AudioWorkletNode | null = null;

    public get playing(): boolean {
        return this.isPlayingSong;
    }

    public get recording(): boolean {
        return this.isRecording;
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
            this.tickSampleCountdown = 0;
            this.isAtStartOfTick = true;
            const prevBar: SetPrevBarMessage = {
                flag: MessageFlag.setPrevBar,
                prevBar: null
            }
            this.sendMessage(prevBar);
            this.updateProcessorLocation();
        }
    }

    public getTicksIntoBar(): number {
        return (this.beat * Config.partsPerBeat + this.part) * Config.ticksPerPart + this.tick;
    }
    public getCurrentPart(): number {
        return (this.beat * Config.partsPerBeat + this.part);
    }

    constructor(song: Song | string | null = null) {
        if (song != null) this.setSong(song);
        this.activateAudio();
    }

    private messageQueue: Message[] = [];

    public sendMessage(message: Message) { //reworked from Jummbus's prototype
        if (this.workletNode == null) {
            this.messageQueue.push(message);
        } else {
            this.workletNode.port.postMessage(message);
            // Handle sending any queued messages
            while (this.messageQueue.length > 0) {
                let next: Message | undefined = this.messageQueue.shift();
                if (next) {
                    this.workletNode.port.postMessage(next);
                }
            }
        }
    }

    private receiveMessage(event: MessageEvent) { //reworked from Jummbus's prototype
        const flag: MessageFlag = event.data.flag;

        switch (flag) {
            case MessageFlag.deactivate: {
                this.audioContext.suspend();
                break;
            }

            case MessageFlag.togglePlay: {
                this.pause(false); //make sure we don't also tell the synth processor to pause again
                break;
            }

            case MessageFlag.songPosition: {
                this.updatePlayhead(event.data.bar, event.data.beat, event.data.part);
                break;
            }

            case MessageFlag.maintainLiveInput: {
                if (!this.isPlayingSong && performance.now() >= this.liveInputEndTime) this.deactivateAudio();
                break;
            }
                
            case MessageFlag.isRecording: {
                this.countInMetronome = event.data.countInMetronome;
                break;
            }
                
            case MessageFlag.oscilloscope: {
                if (this.oscEnabled) {
                    if (this.oscRefreshEventTimer <= 0) {
                        events.raise("oscilloscopeUpdate", event.data.left, event.data.right);
                        this.oscRefreshEventTimer = 4; //oscilloscope refresh rate
                    } else {
                        this.oscRefreshEventTimer--;
                    }
                }
                break;
            }
        }
    }

    public updateProcessorLocation() {
        const songPositionMessage: SongPositionMessage = {
            flag: MessageFlag.songPosition,
            bar: this.bar,
            beat: this.beat,
            part: this.part
        }
        this.sendMessage(songPositionMessage);
    }

    public setSong(song: Song | string): void {
        if (typeof (song) == "string") {
            const songMessage: LoadSongMessage = {
                flag: MessageFlag.loadSong,
                song: song
            }
            this.sendMessage(songMessage);
            this.song = new Song(song, this.updateProcessorSamplesStart.bind(this), this.updateProcessorSamplesFinish.bind(this), this.updateProcessorPlugin.bind(this));
        } else {
            const songMessage: LoadSongMessage = {
                flag: MessageFlag.loadSong,
                song: song.toBase64String()
            }
            this.sendMessage(songMessage);
            this.song = song;
        }
    }

    public updateSong(data: any, songSetting: SongSettings, channelIndex?: number, instrumentIndex?: number, instrumentSetting?: InstrumentSettings | ChannelSettings, settingIndex?: number) {
        if (songSetting == SongSettings.updateInstrument || songSetting == SongSettings.updateChannel) {
            if (channelIndex === undefined || instrumentIndex === undefined || instrumentSetting === undefined) {
                throw new Error("missing index or setting number");
            }
        }
        const updateMessage: UpdateSongMessage = {
            flag: MessageFlag.updateSong,
            songSetting: songSetting,
            channelIndex: channelIndex,
            instrumentIndex: instrumentIndex,
            instrumentSetting: instrumentSetting,
            settingIndex: settingIndex,
            data: data
        }
        this.sendMessage(updateMessage);
    }

    private readonly pushArray: Uint16Array = new Uint16Array(1);
    public addRemoveLiveInputTone(pitches: number | number[], isBass: boolean, turnOn: boolean) {
        if (typeof pitches === "number") {
            let val: number = pitches; val = val << 1;
            val += +turnOn; val = val << 1;
            val += +isBass;
            this.pushArray[0] = val;
            this.liveInputPitchesOnOffRequests.push(this.pushArray, 1);
        } else if (pitches instanceof Array && pitches.length > 0) {
            const pushArray: Uint16Array = new Uint16Array(pitches.length)
            for (let i: number = 0; i < pitches.length; i++) {
                let val: number = pitches[i]; val = val << 1;
                val += +turnOn; val = val << 1;
                val += +isBass;
                pushArray[i] = val
            }
            this.liveInputPitchesOnOffRequests.push(pushArray);
        }
    }

    private async activateAudio(): Promise<void> {
        if (this.audioContext == null || this.workletNode == null) {
            if (this.workletNode != null) this.deactivateAudio();
            // make sure that the workletNode has access to the shared array buffers and the song
            const sabMessage: SendSharedArrayBuffers = {
                flag: MessageFlag.sharedArrayBuffers,
                liveInputValues: this.liveInputValues,
                liveInputPitchesOnOffRequests: this.liveInputPitchesSAB
                //add more here if needed
            }
            this.sendMessage(sabMessage);

            const latencyHint: string = this.anticipatePoorPerformance ? (this.preferLowerLatency ? "balanced" : "playback") : (this.preferLowerLatency ? "interactive" : "balanced");
            this.audioContext = this.audioContext || new (window.AudioContext || window.webkitAudioContext)({ latencyHint: latencyHint });
            this.samplesPerSecond = this.audioContext.sampleRate;

            await this.audioContext.audioWorklet.addModule(ISPLAYER ? "../beepbox_synth_processor.js" : "beepbox_synth_processor.js");
            this.workletNode = new AudioWorkletNode(this.audioContext, 'synth-processor', {
                numberOfOutputs: 1,
                outputChannelCount: [2],
                channelInterpretation: "speakers",
                channelCountMode: "explicit",
                numberOfInputs: 0
            });

            this.workletNode.connect(this.audioContext.destination);
            this.workletNode.port.onmessage = (event: MessageEvent) => this.receiveMessage(event);
            this.updateWorkletSong();
        }
        this.audioContext.resume();
    }

    public updateWorkletSong(): void {
        if (this.song) {
            const songMessage: LoadSongMessage = {
                flag: MessageFlag.loadSong,
                song: this.song.toBase64String()
            }
            this.sendMessage(songMessage);
        }
    }

    private deactivateAudio(): void {
        if (this.audioContext != null && this.workletNode != null) {
            this.audioContext.suspend();
            // this.workletNode.disconnect(this.audioContext.destination);
            // this.workletNode = null;
            // if (this.audioContext.close) this.audioContext.close(); // firefox is missing this function?
            // this.audioContext = null;
        }
    }

    public maintainLiveInput(): void {
        this.activateAudio();
        this.liveInputEndTime = performance.now() + 10000.0;
    }

    public updateProcessorSamplesStart(name: string, expression: number, isCustomSampled: boolean, isPercussion: boolean, rootKey: number, sampleRate: number, index: number) {
        let samplesMessage: SampleStartMessage = {
            flag: MessageFlag.sampleStartMessage,
            name: name,
            expression: expression,
            isCustomSampled: isCustomSampled,
            isPercussion: isPercussion,
            rootKey: rootKey,
            sampleRate: sampleRate,
            index: index
        }
        this.sendMessage(samplesMessage);
    }

    public updateProcessorSamplesFinish(samples: Float32Array, index: number) {
        let samplesMessage: SampleFinishMessage = {
            flag: MessageFlag.sampleFinishMessage,
            samples: samples,
            index: index
        }
        this.sendMessage(samplesMessage);
    }

    public updateProcessorPlugin(names: string[], instrumentStateFunction: string, synthFunction: string, effectOrder: number[] | number, delayLineSize: number): void {
        let pluginMessage: PluginMessage = {
            flag: MessageFlag.pluginMessage,
            names: names,
            instrumentStateFunction: instrumentStateFunction,
            synthFunction: synthFunction,
            effectOrder: effectOrder,
            delayLineSize: delayLineSize
        }
        this.sendMessage(pluginMessage);
        if (SynthMessenger.rerenderSongEditorAfterPluginLoad) SynthMessenger.rerenderSongEditorAfterPluginLoad();
    }


    private exportProcessor: Synth | null = null;

    private updatePlayhead(bar: number, beat: number, part: number): void {
        this.bar = bar;
        this.beat = beat;
        this.part = part;
        this.playheadInternal = (((this.tick) / 2.0 + this.part) / Config.partsPerBeat + this.beat) / this.song!.beatsPerBar + this.bar;
    }

    public warmUpSynthesizer(song: Song) {
        this.initSynth();
        this.exportProcessor!.bar = this.bar;
        this.exportProcessor!.computeLatestModValues();
        this.exportProcessor!.initModFilters(this.song);
        this.exportProcessor!.warmUpSynthesizer(song);
    }

    private initSynth() {
        if (this.exportProcessor == null) {
            this.exportProcessor = new Synth(this.deactivateAudio, this.updatePlayhead, () => {this.countInMetronome = false});
            this.exportProcessor.song = this.song;
            this.exportProcessor.liveInputPitchesOnOffRequests = new RingBuffer(new SharedArrayBuffer(16), Uint16Array);
            this.exportProcessor.liveInputValues = new Uint32Array(1);
        }
        this.exportProcessor.samplesPerSecond = this.samplesPerSecond;
        this.exportProcessor.renderingSong = this.renderingSong;
        this.exportProcessor.loopRepeatCount = this.loopRepeatCount;
    }

    // Direct synthesize request, get from worker
    public synthesize(outputDataL: Float32Array, outputDataR: Float32Array, outputBufferLength: number, playSong: boolean = true): void {
        // TODO: Feed params to worker (do NOT feed arrays, just do some trickery where audio context is connected differently so you can set them in this function)
        this.initSynth();
        this.exportProcessor!.synthesize(outputDataL, outputDataR, outputBufferLength, playSong);
    }

    public play(): void {
        if (this.isPlayingSong) return;
        this.activateAudio();
        this.isPlayingSong = true;
        const playMessage: PlayMessage = {
            flag: MessageFlag.togglePlay,
            play: this.isPlayingSong,
        }
        this.sendMessage(playMessage);
    }

    public pause(communicate: boolean = true): void {
        if (!this.isPlayingSong) return;
        this.isPlayingSong = false;
        this.isRecording = false;
        this.preferLowerLatency = false;
        //TODO: heldmods sab?

        if (communicate) {
            const playMessage: PlayMessage = {
                flag: MessageFlag.togglePlay,
                play: this.isPlayingSong,
            }
            this.sendMessage(playMessage);
        }
        this.tick = 0;
        this.updatePlayhead(this.bar, 0, 0);
    }

    public startRecording(): void {
        this.preferLowerLatency = true;
        this.isRecording = true;
        const isRecordingMessage: IsRecordingMessage = {
            flag: MessageFlag.isRecording,
            isRecording: this.isRecording,
            enableMetronome: this.enableMetronome,
            countInMetronome: this.countInMetronome
        }
        this.sendMessage(isRecordingMessage);
        this.play();
    }

    public snapToStart(): void {
        this.bar = 0;
        const resetEffectsMessage: ResetEffectsMessage = {
            flag: MessageFlag.resetEffects
        }
        this.updateProcessorLocation();
        this.sendMessage(resetEffectsMessage);
        this.snapToBar();
    }

    public goToBar(bar: number): void {
        this.bar = bar;
        const resetEffectsMessage: ResetEffectsMessage = {
            flag: MessageFlag.resetEffects
        }
        this.updateProcessorLocation();
        this.sendMessage(resetEffectsMessage);
        this.playheadInternal = this.bar;
    }

    public snapToBar(): void {
        this.playheadInternal = this.bar;
        this.beat = 0;
        this.part = 0;
        this.tick = 0;
        this.tickSampleCountdown = 0;
        this.updateProcessorLocation();
    }

    public jumpIntoLoop(): void {
        if (!this.song) return;
        if (this.bar < this.song.loopStart || this.bar >= this.song.loopStart + this.song.loopLength) {
            const oldBar: number = this.bar;
            this.bar = this.song.loopStart;
            this.playheadInternal += this.bar - oldBar;

            if (this.playing) {
                this.computeLatestModValues();
            }
        }
    }

    public goToNextBar(): void {
        if (!this.song) return;
        const prevBar: SetPrevBarMessage = {
            flag: MessageFlag.setPrevBar,
            prevBar: this.bar
        }
        this.sendMessage(prevBar);
        const oldBar: number = this.bar;
        this.bar++;
        if (this.bar >= this.song.barCount) {
            this.bar = 0;
        }
        this.playheadInternal += this.bar - oldBar;
        this.updateProcessorLocation();

        if (this.playing) {
            this.computeLatestModValues();
        }
    }

    public goToPrevBar(): void {
        if (!this.song) return;
        const prevBar: SetPrevBarMessage = {
            flag: MessageFlag.setPrevBar,
            prevBar: null
        }
        this.sendMessage(prevBar);
        const oldBar: number = this.bar;
        this.bar--;
        if (this.bar < 0 || this.bar >= this.song.barCount) {
            this.bar = this.song.barCount - 1;
        }
        this.playheadInternal += this.bar - oldBar;

        this.updateProcessorLocation();
        if (this.playing) {
            this.computeLatestModValues();
        }
    }    

    // Returns the total samples in the song
    public getTotalSamples(enableIntro: boolean, enableOutro: boolean, loop: number): number {
        if (this.song == null)
            return -1;

        // Compute the window to be checked (start bar to end bar)
        let startBar: number = enableIntro ? 0 : this.song.loopStart;
        let endBar: number = enableOutro ? this.song.barCount : (this.song.loopStart + this.song.loopLength);
        let hasTempoMods: boolean = false;
        let hasNextBarMods: boolean = false;
        let prevTempo: number = this.song.tempo;

        // Determine if any tempo or next bar mods happen anywhere in the window
        for (let channel: number = this.song.getChannelCount() - 1; channel >= this.song.pitchChannelCount + this.song.noiseChannelCount; channel--) {
            for (let bar: number = startBar; bar < endBar; bar++) {
                let pattern: Pattern | null = this.song.getPattern(channel, bar);
                if (pattern != null) {
                    let instrument: Instrument = this.song.channels[channel].instruments[pattern.instruments[0]];
                    for (let mod: number = 0; mod < Config.modCount; mod++) {
                        if (instrument.modulators[mod] == Config.modulators.dictionary["tempo"].index) {
                            hasTempoMods = true;
                        }
                        if (instrument.modulators[mod] == Config.modulators.dictionary["next bar"].index) {
                            hasNextBarMods = true;
                        }
                    }
                }
            }
        }

        // If intro is not zero length, determine what the "entry" tempo is going into the start part, by looking at mods that came before...
        if (startBar > 0) {
            let latestTempoPin: number | null = null;
            let latestTempoValue: number = 0;

            for (let bar: number = startBar - 1; bar >= 0; bar--) {
                //TODO: Didn't we already find the channel where the tempo mod occurs? I feel like it would be smarter to store that and iterate only over those channels...
                for (let channel: number = this.song.getChannelCount() - 1; channel >= this.song.pitchChannelCount + this.song.noiseChannelCount; channel--) {
                    let pattern = this.song.getPattern(channel, bar);

                    if (pattern != null) {
                        let instrumentIdx: number = pattern.instruments[0];
                        let instrument: Instrument = this.song.channels[channel].instruments[instrumentIdx];

                        let partsInBar: number = this.findPartsInBar(bar);

                        for (const note of pattern.notes) {
                            if (instrument.modulators[Config.modCount - 1 - note.pitches[0]] == Config.modulators.dictionary["tempo"].index) {
                                if (note.start < partsInBar && (latestTempoPin == null || note.end > latestTempoPin)) {
                                    if (note.end <= partsInBar) {
                                        latestTempoPin = note.end;
                                        latestTempoValue = note.pins[note.pins.length - 1].size;
                                    } else {
                                        latestTempoPin = partsInBar;
                                        // Find the pin where bar change happens, and compute where pin volume would be at that time
                                        for (let pinIdx = 0; pinIdx < note.pins.length; pinIdx++) {
                                            if (note.pins[pinIdx].time + note.start > partsInBar) {
                                                const transitionLength: number = note.pins[pinIdx].time - note.pins[pinIdx - 1].time;
                                                const toNextBarLength: number = partsInBar - note.start - note.pins[pinIdx - 1].time;
                                                const deltaVolume: number = note.pins[pinIdx].size - note.pins[pinIdx - 1].size;

                                                latestTempoValue = Math.round(note.pins[pinIdx - 1].size + deltaVolume * toNextBarLength / transitionLength);
                                                pinIdx = note.pins.length;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Done once you process a pattern where tempo mods happened, since the search happens backward
                if (latestTempoPin != null) {
                    prevTempo = latestTempoValue + Config.modulators.dictionary["tempo"].convertRealFactor;
                    bar = -1;
                }
            }
        }

        if (hasTempoMods || hasNextBarMods) {
            // Run from start bar to end bar and observe looping, computing average tempo across each bar
            let bar: number = startBar;
            let ended: boolean = false;
            let totalSamples: number = 0;

            while (!ended) {
                // Compute the subsection of the pattern that will play
                let partsInBar: number = Config.partsPerBeat * this.song.beatsPerBar;
                let currentPart: number = 0;

                if (hasNextBarMods) {
                    partsInBar = this.findPartsInBar(bar);
                }

                // Compute average tempo in this tick window, or use last tempo if nothing happened
                if (hasTempoMods) {
                    let foundMod: boolean = false;
                    for (let channel: number = this.song.getChannelCount() - 1; channel >= this.song.pitchChannelCount + this.song.noiseChannelCount; channel--) {
                        if (foundMod == false) {
                            let pattern: Pattern | null = this.song.getPattern(channel, bar);
                            if (pattern != null) {
                                let instrument: Instrument = this.song.channels[channel].instruments[pattern.instruments[0]];
                                for (let mod: number = 0; mod < Config.modCount; mod++) {
                                    if (foundMod == false && instrument.modulators[mod] == Config.modulators.dictionary["tempo"].index
                                        && pattern.notes.find(n => n.pitches[0] == (Config.modCount - 1 - mod))) {
                                        // Only the first tempo mod instrument for this bar will be checked (well, the first with a note in this bar).
                                        foundMod = true;
                                        // Need to re-sort the notes by start time to make the next part much less painful.
                                        pattern.notes.sort(function (a, b) { return (a.start == b.start) ? a.pitches[0] - b.pitches[0] : a.start - b.start; });
                                        for (const note of pattern.notes) {
                                            if (note.pitches[0] == (Config.modCount - 1 - mod)) {
                                                // Compute samples up to this note
                                                totalSamples += (Math.min(partsInBar - currentPart, note.start - currentPart)) * Config.ticksPerPart * this.getSamplesPerTickSpecificBPM(prevTempo);

                                                if (note.start < partsInBar) {
                                                    for (let pinIdx: number = 1; pinIdx < note.pins.length; pinIdx++) {
                                                        // Compute samples up to this pin
                                                        if (note.pins[pinIdx - 1].time + note.start <= partsInBar) {
                                                            const tickLength: number = Config.ticksPerPart * Math.min(partsInBar - (note.start + note.pins[pinIdx - 1].time), note.pins[pinIdx].time - note.pins[pinIdx - 1].time);
                                                            const prevPinTempo: number = note.pins[pinIdx - 1].size + Config.modulators.dictionary["tempo"].convertRealFactor;
                                                            let currPinTempo: number = note.pins[pinIdx].size + Config.modulators.dictionary["tempo"].convertRealFactor;
                                                            if (note.pins[pinIdx].time + note.start > partsInBar) {
                                                                // Compute an intermediary tempo since bar changed over mid-pin. Maybe I'm deep in "what if" territory now!
                                                                currPinTempo = note.pins[pinIdx - 1].size + (note.pins[pinIdx].size - note.pins[pinIdx - 1].size) * (partsInBar - (note.start + note.pins[pinIdx - 1].time)) / (note.pins[pinIdx].time - note.pins[pinIdx - 1].time) + Config.modulators.dictionary["tempo"].convertRealFactor;
                                                            }
                                                            let bpmScalar: number = Config.partsPerBeat * Config.ticksPerPart / 60;

                                                            if (currPinTempo != prevPinTempo) {

                                                                // Definite integral of SamplesPerTick w/r/t beats to find total samples from start point to end point for a variable tempo
                                                                // The starting formula is
                                                                // SamplesPerTick = SamplesPerSec / ((PartsPerBeat * TicksPerPart) / SecPerMin) * BeatsPerMin )
                                                                //
                                                                // This is an expression of samples per tick "instantaneously", and it can be multiplied by a number of ticks to get a sample count.
                                                                // But this isn't the full story. BeatsPerMin, e.g. tempo, changes throughout the interval so it has to be expressed in terms of ticks, "t"
                                                                // ( Also from now on PartsPerBeat, TicksPerPart, and SecPerMin are combined into one scalar, called "BPMScalar" )
                                                                // Substituting BPM for a step variable that moves with respect to the current tick, we get
                                                                // SamplesPerTick = SamplesPerSec / (BPMScalar * ( (EndTempo - StartTempo / TickLength) * t + StartTempo ) )
                                                                //
                                                                // When this equation is integrated from 0 to TickLength with respect to t, we get the following expression:
                                                                //   Samples = - SamplesPerSec * TickLength * ( log( BPMScalar * EndTempo * TickLength ) - log( BPMScalar * StartTempo * TickLength ) ) / BPMScalar * ( StartTempo - EndTempo )

                                                                totalSamples += - this.samplesPerSecond * tickLength * (Math.log(bpmScalar * currPinTempo * tickLength) - Math.log(bpmScalar * prevPinTempo * tickLength)) / (bpmScalar * (prevPinTempo - currPinTempo));

                                                            } else {

                                                                // No tempo change between the two pins.
                                                                totalSamples += tickLength * this.getSamplesPerTickSpecificBPM(currPinTempo);

                                                            }
                                                            prevTempo = currPinTempo;
                                                        }
                                                        currentPart = Math.min(note.start + note.pins[pinIdx].time, partsInBar);
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

                // Compute samples for the rest of the bar
                totalSamples += (partsInBar - currentPart) * Config.ticksPerPart * this.getSamplesPerTickSpecificBPM(prevTempo);

                bar++;
                if (loop != 0 && bar == this.song.loopStart + this.song.loopLength) {
                    bar = this.song.loopStart;
                    if (loop > 0) loop--;
                }
                if (bar >= endBar) {
                    ended = true;
                }

            }

            return Math.ceil(totalSamples);
        } else {
            // No tempo or next bar mods... phew! Just calculate normally.
            return this.getSamplesPerBar() * this.getTotalBars(enableIntro, enableOutro, loop);
        }
    }

    public getSamplesPerBar(): number {
        if (this.song == null) throw new Error();
        return this.getSamplesPerTick() * Config.ticksPerPart * Config.partsPerBeat * this.song.beatsPerBar;
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

    public getTotalBars(enableIntro: boolean, enableOutro: boolean, useLoopCount: number = this.loopRepeatCount): number {
        if (this.song == null) throw new Error();
        let bars: number = this.song.loopLength * (useLoopCount + 1);
        if (enableIntro) bars += this.song.loopStart;
        if (enableOutro) bars += this.song.barCount - (this.song.loopStart + this.song.loopLength);
        return bars;
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

    public computeLatestModValues(modEffects: boolean = false): void {
        //tell procecssor to also compute mod values
        const computeModsMessage: ComputeModsMessage = {
            flag: MessageFlag.computeMods,
            initFilters: modEffects
        }
        this.sendMessage(computeModsMessage);

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

    /** Detects if a modulator is set, but not valid for the current effects/instrument type/filter type
    * Note, setting 'none' or the intermediary steps when clicking to add a mod, like an unset channel/unset instrument, counts as valid.
    // TODO: This kind of check is mirrored in SongEditor.ts' whenUpdated. Creates a lot of redundancy for adding new mods. Can be moved into new properties for mods, to avoid this later.
    */
    public determineInvalidModulators(instrument: Instrument): void {
        if (this.song == null)
            return;
        for (let mod: number = 0; mod < Config.modCount; mod++) {
            instrument.invalidModulators[mod] = true;
            // For song modulator, valid if any setting used
            if (instrument.modChannels[mod] == -1) {
                if (instrument.modulators[mod] != 0)
                    instrument.invalidModulators[mod] = false;
                continue;
            }
            const channel: Channel | null = this.song.channels[instrument.modChannels[mod]];
            if (channel == null) continue;
            let tgtInstrumentList: Instrument[] = [];
            if (instrument.modInstruments[mod] >= channel.instruments.length) { // All or active
                tgtInstrumentList = channel.instruments;
            } else {
                tgtInstrumentList = [channel.instruments[instrument.modInstruments[mod]]];
            }
            for (let i: number = 0; i < tgtInstrumentList.length; i++) {
                const tgtInstrument: Instrument | null = tgtInstrumentList[i];
                if (tgtInstrument == null) continue;
                const str: string = Config.modulators[instrument.modulators[mod]].name;
                // Check effects
                if (!((Config.modulators[instrument.modulators[mod]].associatedEffect != EffectType.length && !(tgtInstrument.effects & (1 << Config.modulators[instrument.modulators[mod]].associatedEffect)))
                    // Instrument type specific
                    || ((tgtInstrument.type != InstrumentType.fm && tgtInstrument.type != InstrumentType.fm6op) && (str == "fm slider 1" || str == "fm slider 2" || str == "fm slider 3" || str == "fm slider 4" || str == "fm feedback"))
                    || tgtInstrument.type != InstrumentType.fm6op && (str == "fm slider 5" || str == "fm slider 6")
                    || ((tgtInstrument.type != InstrumentType.pwm && tgtInstrument.type != InstrumentType.supersaw) && (str == "pulse width" || str == "decimal offset"))
                    || ((tgtInstrument.type != InstrumentType.supersaw) && (str == "dynamism" || str == "spread" || str == "saw shape"))
                    // Arp check
                    || (!tgtInstrument.getChord().arpeggiates && (str == "arp speed" || str == "reset arp"))
                    // EQ Filter check
                    || (tgtInstrument.eqFilterType && str == "eq filter")
                    || (!tgtInstrument.eqFilterType && (str == "eq filt cut" || str == "eq filt peak"))
                    || (str == "eq filter" && Math.floor((instrument.modFilterTypes[mod] + 1) / 2) > tgtInstrument.getLargestControlPointCount(false))
                    // Note Filter check
                    || (tgtInstrument.noteFilterType && str == "note filter")
                    || (!tgtInstrument.noteFilterType && (str == "note filt cut" || str == "note filt peak"))
                    || (str == "note filter" && Math.floor((instrument.modFilterTypes[mod] + 1) / 2) > tgtInstrument.getLargestControlPointCount(true)))) {

                    instrument.invalidModulators[mod] = false;
                    i = tgtInstrumentList.length;
                }
            }
        }
    }

    public setModValue(volumeStart: number, volumeEnd: number, channelIndex: number, instrumentIndex: number, setting: number): number {
        let val: number = volumeStart + Config.modulators[setting].convertRealFactor;
        let nextVal: number = volumeEnd + Config.modulators[setting].convertRealFactor;
        if (Config.modulators[setting].forSong) {
            if (this.modValues[setting] == -1 || this.modValues[setting] != val || this.nextModValues[setting] != nextVal) {
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
            if (this.modValues[setting] != -1 && this.nextModValues[setting] != -1) {
                return nextVal ? this.nextModValues[setting]! : this.modValues[setting]!;
            }
        } else if (channel != undefined && instrument != undefined) {
            if (this.modInsValues[channel][instrument][setting] != null && this.nextModInsValues[channel][instrument][setting] != null) {
                return nextVal ? this.nextModInsValues[channel][instrument][setting]! : this.modInsValues[channel][instrument][setting]!;
            }
        }
        return -1;
    }

    // Checks if any mod is active for the given channel/instrument OR if any mod is active for the song scope. Could split the logic if needed later.
    public isAnyModActive(channel: number, instrument: number): boolean {
        for (let setting: number = 0; setting < Config.modulators.length; setting++) {
            if ((this.modValues != undefined && this.modValues[setting] != null)
                || (this.modInsValues != undefined && this.modInsValues[channel] != undefined && this.modInsValues[channel][instrument] != undefined && this.modInsValues[channel][instrument][setting] != null)) {
                return true;
            }
        }
        return false;
    }

    public unsetMod(setting: number, channel?: number, instrument?: number) {
        if (this.isModActive(setting) || (channel != undefined && instrument != undefined && this.isModActive(setting, channel, instrument))) {
            this.modValues[setting] = -1;
            this.nextModValues[setting] = -1;
            for (let i: number = 0; i < this.heldMods.length; i++) {
                if (channel != undefined && instrument != undefined) {
                    if (this.heldMods[i].channelIndex == channel && this.heldMods[i].instrumentIndex == instrument && this.heldMods[i].setting == setting)
                        this.heldMods.splice(i, 1);
                } else {
                    if (this.heldMods[i].setting == setting)
                        this.heldMods.splice(i, 1);
                }
            }
            if (channel != undefined && instrument != undefined) {
                this.modInsValues[channel][instrument][setting] = null;
                this.nextModInsValues[channel][instrument][setting] = null;
            }
        }
    }

    public isFilterModActive(forNoteFilter: boolean, channelIdx: number, instrumentIdx: number, forSong?: boolean) {
        const instrument: Instrument = this.song!.channels[channelIdx].instruments[instrumentIdx];

        if (forNoteFilter) {
            if (instrument.noteFilterType)
                return false;
            if (instrument.tmpNoteFilterEnd != null)
                return true;
        } else {
            if (forSong) {
                if (this?.song?.tmpEqFilterEnd != null)
                    return true;
            } else {
                if (instrument.eqFilterType)
                    return false;
                if (instrument.tmpEqFilterEnd != null)
                    return true;
            }
        }

        return false
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

    // Force a modulator to be held at the given volumeStart for a brief duration.
    public forceHoldMods(volumeStart: number, channelIndex: number, instrumentIndex: number, setting: number): void {
        let found: boolean = false;
        for (let i: number = 0; i < this.heldMods.length; i++) {
            if (this.heldMods[i].channelIndex == channelIndex && this.heldMods[i].instrumentIndex == instrumentIndex && this.heldMods[i].setting == setting) {
                this.heldMods[i].volume = volumeStart;
                this.heldMods[i].holdFor = 24;
                found = true;
            }
        }
        // Default: hold for 24 ticks / 12 parts (half a beat).
        if (!found)
            this.heldMods.push({ volume: volumeStart, channelIndex: channelIndex, instrumentIndex: instrumentIndex, setting: setting, holdFor: 24 });
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

    public static fittingPowerOfTwo(x: number): number {
        return 1 << (32 - Math.clz32(Math.ceil(x) - 1));
    }

    public static adjacentNotesHaveMatchingPitches(firstNote: Note, secondNote: Note): boolean {
        if (firstNote.pitches.length != secondNote.pitches.length) return false;
        const firstNoteInterval: number = firstNote.pins[firstNote.pins.length - 1].interval;
        for (const pitch of firstNote.pitches) {
            if (secondNote.pitches.indexOf(pitch + firstNoteInterval) == -1) return false;
        }
        return true;
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
}

// When compiling synth.ts as a standalone module named "beepbox", expose these classes as members to JavaScript:
export { Dictionary, DictionaryArray, FilterType, EnvelopeType, InstrumentType, Transition, Chord, Envelope, Config };
