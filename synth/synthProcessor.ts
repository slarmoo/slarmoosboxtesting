// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { Config, performIntegral } from "./SynthConfig";
import { Song } from "./synthMessenger";
import { DeactivateMessage, IsRecordingMessage, Message, MessageFlag, OscilloscopeMessage } from "./synthMessages";
import { RingBuffer } from "ringbuf.js";
import { Synth } from "./synth";

export class SynthProcessor extends AudioWorkletProcessor {

    private browserAutomaticallyClearsAudioBuffer: boolean = true; // Assume true until proven otherwise. Older Chrome does not clear the buffer so it needs to be cleared manually.

    private synth: Synth;

    constructor() {
        super();
        this.port.onmessage = (event: MessageEvent) => this.receiveMessage(event);

        //give the synth the needed functions
        const deactivate = () => {
            const DeactivateMessage: DeactivateMessage = {
                flag: MessageFlag.deactivate
            }
            this.sendMessage(DeactivateMessage);
        }
        // const updatePlayhead = (bar: number, beat: number, part: number) => {
        //     const playheadMessage: SongPositionMessage = {
        //         flag: MessageFlag.songPosition,
        //         bar: bar,
        //         beat: beat,
        //         part: part,
        //     }
        //     this.sendMessage(playheadMessage);
        // }
        const endCountIn = () => {
            const metronomeMessage: IsRecordingMessage = {
                flag: MessageFlag.isRecording,
                isRecording: true,
                enableMetronome: true,
                countInMetronome: false
            }
            this.sendMessage(metronomeMessage);
        }

        this.synth = new Synth(deactivate, endCountIn);
    }

    private sendMessage(message: Message) {
        this.port.postMessage(message);
    }

    private receiveMessage(event: MessageEvent): void {
        const flag: MessageFlag = event.data.flag;

        switch (flag) {
            case MessageFlag.togglePlay:
                if (event.data.play) {
                    this.synth.play();
                } else {
                    this.synth.pause();
                }
                break;
            case MessageFlag.loadSong:
                this.synth.setSong(event.data.song);
                for (let channelIndex: number = 0; channelIndex < this.synth.song!.getChannelCount(); channelIndex++) {
                    for (let instrumentIndex: number = 0; instrumentIndex < this.synth.song!.channels[channelIndex].instruments.length; instrumentIndex++) {
                        const instrument = this.synth.song!.channels[channelIndex].instruments[instrumentIndex];
                        Synth.getInstrumentSynthFunction(instrument);
                    }
                }
                break;
            case MessageFlag.resetEffects:
                this.synth.resetEffects();
                break;
            case MessageFlag.computeMods:
                if (event.data.initFilters) this.synth.initModFilters(this.synth.song);
                this.synth.computeLatestModValues();
                break;
            // case MessageFlag.songPosition: {
            //     this.synth.bar = event.data.bar;
            //     this.synth.beat = event.data.beat;
            //     this.synth.part = event.data.part;
            //     break;
            // }
            case MessageFlag.sharedArrayBuffers: {
                console.log("LOADING SABS");
                this.synth.liveInputValues = event.data.liveInputValues;
                this.synth.liveInputPitchesOnOffRequests = new RingBuffer(event.data.liveInputPitchesOnOffRequests, Uint16Array);
                this.synth.songPosition = event.data.songPosition;
                break;
            }
            case MessageFlag.setPrevBar: {
                this.synth.prevBar = event.data.prevBar;
                break;
            }
            case MessageFlag.isRecording: {
                this.synth.isRecording = event.data.isRecording;
                this.synth.enableMetronome = event.data.enableMetronome;
                this.synth.countInMetronome = event.data.countInMetronome;
                break;
            }
            case MessageFlag.synthVolume: {
                this.synth.volume = event.data.volume;
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
                Synth.pluginValueNames = event.data.names;
                Synth.pluginInstrumentStateFunction = event.data.instrumentStateFunction;
                Synth.pluginFunction = event.data.synthFunction;
                Synth.pluginIndex = event.data.effectOrder;
                Synth.PluginDelayLineSize = event.data.delayLineSize;
                break;
            }
            case MessageFlag.updateSong: {
                if (!this.synth.song) this.synth.song = new Song();
                this.synth.song.parseUpdateCommand(event.data.data, event.data.songSetting, event.data.channelIndex, event.data.instrumentIndex, event.data.instrumentSetting, event.data.settingIndex);
                break;
            }
        }
    }

    process(_: Float32Array[][], outputs: Float32Array[][]) {
        const outputDataL: Float32Array = outputs[0][0];
        const outputDataR: Float32Array = outputs[0][1];

        // AudioWorkletProcessor is not officially supported by typescript so for now we have lots of strange workarounds
        // @ts-ignore
        this.synth.samplesPerSecond = sampleRate;

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

        try {
            this.synth.synthesize(outputDataL, outputDataR, outputDataL.length, this.synth.isPlayingSong);
        } catch (e) {
            console.log(e);
            // this.deactivateAudio();
        }

        const oscilloscopeMessage: OscilloscopeMessage = {
            flag: MessageFlag.oscilloscope,
            maintainLiveInput: !this.synth.isPlayingSong
        }
        this.sendMessage(oscilloscopeMessage);

        return true;
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