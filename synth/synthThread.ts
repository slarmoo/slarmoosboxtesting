// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { Config, performIntegral } from "./SynthConfig";
import { Song } from "./synthMessenger";
import { DeactivateMessage, defaultBlockSize, IsRecordingMessage, MessageFlag } from "./synthMessages";
import { RingBuffer } from "ringbuf.js";
import { Synth } from "./synth";
import { BeepBoxEffectPlugin } from "beepboxplugin";

let synth: Synth;
let sabL: SharedArrayBuffer;
let sabR: SharedArrayBuffer;
let samplesL: RingBuffer;
let samplesR: RingBuffer;

let blockSize: number = defaultBlockSize;
let bufferL: Float32Array = new Float32Array(blockSize).fill(0.0);
let bufferR: Float32Array = new Float32Array(blockSize).fill(0.0);

let drain: boolean = false;

self.onmessage = (event: MessageEvent) => receiveMessage(event);

//give the synth the needed functions
const endCountIn = () => {
    const metronomeMessage: IsRecordingMessage = {
        flag: MessageFlag.isRecording,
        isRecording: true,
        enableMetronome: true,
        countInMetronome: false
    }
    postMessage(metronomeMessage);
}

synth = new Synth(deactivate, endCountIn);

function deactivate() {
    const DeactivateMessage: DeactivateMessage = {
        flag: MessageFlag.deactivate
    }
    postMessage(DeactivateMessage);
}

async function receiveMessage(event: MessageEvent): Promise<void> {
    const flag: MessageFlag = event.data.flag;

    switch (flag) {
        case MessageFlag.togglePlay:
            if (event.data.play) {
                synth.play();
            } else {
                synth.pause();
                drain = true;
            }
            break;
        case MessageFlag.loadSong:
            synth.setSong(event.data.song);
            for (let channelIndex: number = 0; channelIndex < synth.song!.getChannelCount(); channelIndex++) {
                for (let instrumentIndex: number = 0; instrumentIndex < synth.song!.channels[channelIndex].instruments.length; instrumentIndex++) {
                    const instrument = synth.song!.channels[channelIndex].instruments[instrumentIndex];
                    Synth.getInstrumentSynthFunction(instrument);
                }
            }
            break;
        case MessageFlag.resetEffects:
            synth.resetEffects();
            break;
        case MessageFlag.computeMods:
            if (event.data.initFilters) synth.initModFilters(synth.song);
            synth.computeLatestModValues();
            break;
        case MessageFlag.sharedArrayBuffers: {
            console.log("LOADING SABS");
            if (!event.data.liveInputValues ||
                !event.data.liveInputPitchesOnOffRequests ||
                !event.data.songPosition ||
                !event.data.outVolumeCap ||
                !event.data.bufferL ||
                !event.data.bufferR
            ) deactivate();
            else {
                synth.liveInputValues = event.data.liveInputValues;
                synth.liveInputPitchesOnOffRequests = new RingBuffer(event.data.liveInputPitchesOnOffRequests, Uint16Array);
                synth.songPosition = event.data.songPosition;
                synth.outVolumeCap = event.data.outVolumeCap;
                synth.resetEffects();
                sabL = event.data.bufferL;
                sabR = event.data.bufferR;
                samplesL = new RingBuffer(sabL, Float32Array);
                samplesR = new RingBuffer(sabR, Float32Array);
                synth.samplesPerSecond = event.data.sampleRate;
            }
            break;
        }
        case MessageFlag.setPrevBar: {
            synth.prevBar = event.data.prevBar;
            break;
        }
        case MessageFlag.isRecording: {
            synth.isRecording = event.data.isRecording;
            synth.enableMetronome = event.data.enableMetronome;
            synth.countInMetronome = event.data.countInMetronome;
            break;
        }
        case MessageFlag.synthVolume: {
            synth.volume = event.data.volume;
            break;
        }
        case MessageFlag.sampleStartMessage: {
            const name: string = event.data.string
            const expression: number = event.data.expression;
            const isCustomSampled: boolean = event.data.isCustomSampled;
            const isPercussion: boolean = event.data.isPercussion;
            const rootKey: number = event.data.rootKey;
            const sampleRate: number = event.data.sampleRate;
            const chipWaveIndex: number = event.data.index;

            const defaultIndex: number = 0;
            const defaultIntegratedSamples: Float32Array = Config.chipWaves[defaultIndex].samples;
            const defaultSamples: Float32Array = Config.rawRawChipWaves[defaultIndex].samples;
            Config.chipWaves[chipWaveIndex] = {
                name: name,
                expression: expression,
                isCustomSampled: isCustomSampled,
                isPercussion: isPercussion,
                rootKey: rootKey,
                sampleRate: sampleRate,
                samples: defaultIntegratedSamples,
                index: chipWaveIndex,
            };
            Config.rawChipWaves[chipWaveIndex] = {
                name: name,
                expression: expression,
                isCustomSampled: isCustomSampled,
                isPercussion: isPercussion,
                rootKey: rootKey,
                sampleRate: sampleRate,
                samples: defaultSamples,
                index: chipWaveIndex,
            };
            Config.rawRawChipWaves[chipWaveIndex] = {
                name: name,
                expression: expression,
                isCustomSampled: isCustomSampled,
                isPercussion: isPercussion,
                rootKey: rootKey,
                sampleRate: sampleRate,
                samples: defaultSamples,
                index: chipWaveIndex,
            };
            break;
        }
        case MessageFlag.sampleFinishMessage: {
            const integratedSamples = performIntegral(event.data.samples);
            const index: number = event.data.index;
            Config.chipWaves[index].samples = integratedSamples;
            Config.rawChipWaves[index].samples = event.data.samples;
            Config.rawRawChipWaves[index].samples = event.data.samples;
            break;
        }
        case MessageFlag.pluginMessage: {
            const pluginModule = await import(event.data.url);
            Synth.PluginClass = pluginModule.default;
            const plugin: BeepBoxEffectPlugin = new Synth.PluginClass();

            for (let channelIndex: number = 0; channelIndex < synth.song!.pitchChannelCount + synth.song!.noiseChannelCount; channelIndex++) {
                for (let instrumentIndex: number = 0; instrumentIndex < synth.song!.channels[channelIndex].instruments.length; instrumentIndex++) {
                    synth.channels[channelIndex].instruments[instrumentIndex].plugin = null;
                    if (event.data.initializeValues) {
                        synth.song!.channels[channelIndex].instruments[instrumentIndex].pluginValues.fill(0);
                        for (let i: number = 0; i < plugin.elements.length; i++) {
                            synth.song!.channels[channelIndex].instruments[instrumentIndex].pluginValues[i] = plugin.elements[i].initialValue;
                        }
                    }
                }
            }
            //remove all previously cached effect functions, since they'll have used old effect orders
            //@ts-ignore
            Synth.effectsFunctionCache.fill(undefined);

            break;
        }
        case MessageFlag.loopRepeatCount: {
            synth.loopRepeatCount = event.data.count;
            break;
        }
        case MessageFlag.loopBar: {
            synth.loopBarStart = event.data.loopBarStart;
            synth.loopBarEnd = event.data.loopBarEnd;
            break;
        }
        case MessageFlag.updateSong: {
            if (!synth.song) synth.song = new Song();
            synth.song.parseUpdateCommand(event.data.data, event.data.songSetting, event.data.channelIndex, event.data.instrumentIndex, event.data.instrumentSetting, event.data.settingIndex);
            break;
        }
        case MessageFlag.growsabs: {
            grow(blockSize * 2);
            break;
        }
    }
}

function grow(length: number) {
    blockSize = length;
    bufferL = new Float32Array(blockSize).fill(0.0);
    bufferR = new Float32Array(blockSize).fill(0.0);
    samplesL = new RingBuffer(sabL, Float32Array);
    samplesR = new RingBuffer(sabR, Float32Array);
    drain = true;
    console.log("updating block size to " + blockSize);
}

const synthesize = () => {
    if (drain) {
        while (!samplesL.empty()) samplesL.pop(bufferL);
        while (!samplesR.empty()) samplesR.pop(bufferR);
        drain = false;
    } else {
        if (samplesL && samplesR && samplesL.availableWrite() >= blockSize && samplesR.availableWrite() >= blockSize) {
            try {
                synth.synthesize(bufferL, bufferR, blockSize, synth.isPlayingSong);
                samplesL.push(bufferL);
                samplesR.push(bufferR);
                bufferL.fill(0.0);
                bufferR.fill(0.0);
            } catch (e) {
                console.log(e);
            }
        }
        if (samplesL && samplesR && samplesL.availableWrite() >= blockSize && samplesR.availableWrite() >= blockSize) { //go again if possible
            try {
                synth.synthesize(bufferL, bufferR, blockSize, synth.isPlayingSong);
                samplesL.push(bufferL);
                samplesR.push(bufferR);
                bufferL.fill(0.0);
                bufferR.fill(0.0);
            } catch (e) {
                console.log(e);
            }
        }
    }
    setTimeout(synthesize, 0);
}

setTimeout(synthesize, 0);