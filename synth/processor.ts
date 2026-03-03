// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { Message, MessageFlag, UIRenderMessage } from "./synthMessages";
import { RingBuffer } from "ringbuf.js";

export class SynthProcessor extends AudioWorkletProcessor {

    private browserAutomaticallyClearsAudioBuffer: boolean = true; // Assume true until proven otherwise. Older Chrome does not clear the buffer so it needs to be cleared manually.
    private samplesL: RingBuffer;
    private samplesR: RingBuffer;

    constructor() {
        super();
        this.port.onmessage = (event: MessageEvent) => this.receiveMessage(event);
    }

    private sendMessage(message: Message) {
        this.port.postMessage(message);
    }

    private receiveMessage(event: MessageEvent): void {
        this.samplesL = new RingBuffer(event.data.bufferL, Float32Array);
        this.samplesR = new RingBuffer(event.data.bufferR, Float32Array);
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

        // AudioWorkletProcessor is not officially supported by typescript so for now we have lots of strange workarounds
        if (this.samplesL && this.samplesR && this.samplesL.availableRead() >= 128 && this.samplesR.availableRead() >= 128) {
            this.samplesL.pop(outputDataL);
            this.samplesR.pop(outputDataR);
        } else {
            const length: number = outputDataL.length;
            for (let i: number = 0; i < length; i++) {
                outputDataL[i] = 0.0;
                outputDataR[i] = 0.0;
            }
        }

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