// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { Song } from "./synthMessenger"
import { DeactivateMessage, IsRecordingMessage, MaintainLiveInputMessage, Message, MessageFlag, OscilloscopeMessage, SongPositionMessage } from "./synthMessages";
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
        const updatePlayhead = (bar: number, beat: number, part: number) => {
            const playheadMessage: SongPositionMessage = {
                flag: MessageFlag.songPosition,
                bar: bar,
                beat: beat,
                part: part,
            }
            this.sendMessage(playheadMessage);
        }
        const endCountIn = () => {
            const metronomeMessage: IsRecordingMessage = {
                flag: MessageFlag.isRecording,
                isRecording: true,
                enableMetronome: true,
                countInMetronome: false
            }
            this.sendMessage(metronomeMessage);
        }

        this.synth = new Synth(deactivate, updatePlayhead, endCountIn);
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
                break;
            case MessageFlag.resetEffects:
                this.synth.resetEffects();
                break;
            case MessageFlag.computeMods:
                if (event.data.initFilters) this.synth.initModFilters(this.synth.song);
                this.synth.computeLatestModValues();
                break;
            case MessageFlag.songPosition: {
                this.synth.bar = event.data.bar;
                this.synth.beat = event.data.beat;
                this.synth.part = event.data.part;
                break;
            }
            case MessageFlag.sharedArrayBuffers: {
                console.log("LOADING SABS");
                this.synth.liveInputValues = event.data.liveInputValues;
                this.synth.liveInputPitchesOnOffRequests = new RingBuffer(event.data.liveInputPitchesOnOffRequests, Uint16Array);
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
            }
            case MessageFlag.updateSong: {
                if (!this.synth.song) this.synth.song = new Song();
                this.synth.song.parseUpdateCommand(event.data.data, event.data.songSetting, event.data.channelIndex, event.data.instrumentIndex, event.data.instrumentSetting)
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

        //liveInputEndTime is now handled on the main thread
        if (!this.synth.isPlayingSong) {
            const maintainLiveInputMessage: MaintainLiveInputMessage = {
                flag: MessageFlag.maintainLiveInput
            }
            this.sendMessage(maintainLiveInputMessage);
        }
        try {
            this.synth.synthesize(outputDataL, outputDataR, outputDataL.length, this.synth.isPlayingSong);
        } catch (e) {
            console.log(e);
            // this.deactivateAudio();
        }

        //TODO: have oscEnabled be threadside to avoid copying the arrays even when disabled?
        const oscilloscopeMessage: OscilloscopeMessage = {
            flag: MessageFlag.oscilloscope,
            left: outputDataL,
            right: outputDataR
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