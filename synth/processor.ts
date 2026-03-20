// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { GrowSABSMessage, Message, MessageFlag, UIRenderMessage } from "./synthMessages";
import { RingBuffer } from "ringbuf.js";

export class SynthProcessor extends AudioWorkletProcessor {

    private isPlaying: boolean = false;
    private outputFailures: number = 0;
    private maxFailures: number = 1024;
    private browserAutomaticallyClearsAudioBuffer: boolean = true; // Assume true until proven otherwise. Older Chrome does not clear the buffer so it needs to be cleared manually.
    private sabL: SharedArrayBuffer;
    private sabR: SharedArrayBuffer;
    private samplesL: RingBuffer;
    private samplesR: RingBuffer;

    constructor() {
        super();
        this.port.onmessage = (event: MessageEvent) => this.receiveMessage(event);
    }

    private sendMessage(message: Message) {
        this.port.postMessage(message);
    }

    private bufferClear: Float32Array = new Float32Array(512);
    private receiveMessage(event: MessageEvent): void {
        switch (event.data.flag) {
            case MessageFlag.sabsProcessor: {
                this.sabL = event.data.bufferL;
                this.sabR = event.data.bufferR;
                this.samplesL = new RingBuffer(this.sabL, Float32Array);
                this.samplesR = new RingBuffer(this.sabR, Float32Array);
                break;
            } case MessageFlag.togglePlay: {
                if (!event.data.play) {
                    //clear samples
                    while (!this.samplesL.empty()) this.samplesL.pop(this.bufferClear);
                    while (!this.samplesR.empty()) this.samplesR.pop(this.bufferClear);
                    this.isPlaying = false;
                } else {
                    this.isPlaying = true;
                }
                break;
            } case MessageFlag.growsabs: {
                this.samplesL = new RingBuffer(this.sabL, Float32Array);
                this.samplesR = new RingBuffer(this.sabR, Float32Array);
                break;
            }
        }
        
    }

    process(_: Float32Array[][], outputs: Float32Array[][]) {
        const outputDataL: Float32Array = outputs[0][0];
        const outputDataR: Float32Array = outputs[0][1];

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

        const length: number = outputDataL.length;
        if (this.samplesL && this.samplesR && this.samplesL.availableRead() >= length && this.samplesR.availableRead() >= length) {
            this.samplesL.pop(outputDataL);
            this.samplesR.pop(outputDataR);
        } else {
            for (let i: number = 0; i < length; i++) {
                outputDataL[i] = 0.0;
                outputDataR[i] = 0.0;
            }
            if (this.samplesL && this.samplesR && this.isPlaying && this.maxFailures > 0) {
                //failed an output block; count how many times this occurs and if we need to double our latency
                this.outputFailures++;
                if (this.outputFailures > this.maxFailures || this.outputFailures > 256) {
                    this.outputFailures = -64; //account for some lag from resizing
                    this.maxFailures = (this.maxFailures / 2) | 0;
                    const growSABSMessage: GrowSABSMessage = {
                        flag: MessageFlag.growsabs
                    }
                    this.sendMessage(growSABSMessage);
                }
            }
        }

        //TODO: Don't send message; use a per frame function on the main thread
        const uiRenderMessage: UIRenderMessage = {
            flag: MessageFlag.uiRender,
        }
        this.sendMessage(uiRenderMessage);

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