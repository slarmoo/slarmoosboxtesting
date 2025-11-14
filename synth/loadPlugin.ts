import { PluginElement } from "../editor/PluginConfig";

const MAX_DELAY_LINE_LENGTH: number = 8000;

/**
 * Takes a compiled webassembly plugin and constructs it into a usable plugin module
 * @param wasmBytes The compiled and imported webassembly code
 * @returns A constructed plugin module
 */
export async function loadPlugin(wasmBytes: ArrayBuffer): Promise<PluginModule | undefined> {
    let HEAPU8: Uint8Array;
    let HEAPU32: Uint32Array;
    // let HEAPU16: Uint16Array;
    // let HEAPI8: Int8Array;
    // let HEAPI16: Int16Array;
    // let HEAPI32: Int32Array;
    // let HEAPF32: Float32Array;
    let HEAPF64: Float64Array;

    // Reads a C string from the module's memory.
    // A C string contains ANSI or UTF8-encoded character data,
    // terminated by a NUL character (char code 0).
    const readCStr = (ptr: number): string => {
        var buf = [];
        for (; HEAPU8[ptr] !== 0; ++ptr) {

            if (ptr >= HEAPU8.length || HEAPU8[ptr] == undefined) break;
            buf.push(HEAPU8[ptr]);
            
        }
        return String.fromCharCode(...buf);
    };

    const wasmImports = {
        bpbxplug: {
            log(str: number) {
                console.log(readCStr(str));
            }
        }
    };

    const obj = await WebAssembly.instantiate(wasmBytes, wasmImports);
    const wasmInstance: WebAssembly.Instance = obj.instance;
    const memory: WebAssembly.Memory = wasmInstance.exports.memory as WebAssembly.Memory;
    // console.log(memory)
    const funcTable: WebAssembly.Table = wasmInstance.exports.__indirect_function_table as WebAssembly.Table;
    const malloc: Function = wasmInstance.exports.malloc as Function;
    // const free: Function = wasmInstance.exports.free as Function;
    // C ensures each integer type is memory-aligned
    // that is, 32-bit integers, which occupy 4 bytes, will only be placed in
    // addresses that are a multiple of 4. 16-bit integers, which occupy
    // 2 bytes, will only be placed in addresses that are a multple of 2,
    // e.t.c.
    // thus, to read a 32-bit integer from the HEAPI32 array, you read
    // from the index x/4, where x is the memory address.
    // right-shifting is faster and is the same as dividing by a power of 2.
    //   x >> 1 == x / 2
    //   x >> 2 == x / 4
    //   x >> 3 == x / 8
    // (or i guess you could just use a DataView)
    HEAPU8 = new Uint8Array(memory.buffer);
    HEAPU32 = new Uint32Array(memory.buffer);
    // HEAPU16 = new Uint16Array(memory.buffer);
    // HEAPI8 = new Int8Array(memory.buffer);
    // HEAPI16 = new Int16Array(memory.buffer);
    // HEAPI32 = new Int32Array(memory.buffer);
    // HEAPF32 = new Float32Array(memory.buffer);
    HEAPF64 = new Float64Array(memory.buffer);;
    {
        const initFunc = wasmInstance.exports._initialize as Function;
        if (initFunc !== undefined)
            initFunc();
    };
    const moduleStruct = (wasmInstance.exports.bpbxplug_entry as Function)();
    const moduleApiVersionStr = HEAPU32[moduleStruct >> 2];
    const apiVersion: string = readCStr(moduleApiVersionStr);
    const moduleNameStr = HEAPU32[(moduleStruct + 4) >> 2];
    const pluginName: string = readCStr(moduleNameStr);
    const uiElementCount: number = HEAPU8[moduleStruct + 8];
    const uiElementsPtr = HEAPU32[(moduleStruct + 12) >> 2];

    const elementSize = 12;

    const uielements: PluginElement[] = [];
    // console.log(uiElementCount)
    for (let i = 0; i < uiElementCount; ++i) {
        const elementPtr = uiElementsPtr + i * elementSize;
        const elementType = HEAPU8[elementPtr];
        const namePtr = HEAPU32[(elementPtr + 4) >> 2];
        const name = readCStr(namePtr);
        // console.log(elementType)
        if (elementType === 0) { // slider
            const maxVal = HEAPU8[elementPtr + 8];
            // console.log(maxVal)
            uielements.push({ type: "slider", name: name, max: maxVal });
        } else if (elementType === 1) { // checkbox
            uielements.push({ type: "checkbox", name: name });
        } else if (elementType === 2) { // dropdown
            const optionsPtr = HEAPU32[(elementPtr + 8) >> 2];
            const options: string[] = [];
            if (optionsPtr) {
                let index = 0;
                for (let i: number = 0; i < 64; i++) { //never accept more than 64 options
                    const optionPointer = HEAPU32[(optionsPtr + index * 4) >> 2];
                    if (!optionPointer) break;
                    options.push(readCStr(optionPointer));
                    index++;
                }
            }
            uielements.push({ type: "dropdown", name: name, options: options });
        } else {
            throw TypeError("Unrecognized Plugin UI Element Type");
        }
    }

    const paramCount: number = HEAPU8[moduleStruct + 16];

    const init: Function = funcTable.get(HEAPU32[(moduleStruct + 20) >> 2]);
    const destroy: Function = funcTable.get(HEAPU32[(moduleStruct + 24) >> 2]);
    const tick: Function = funcTable.get(HEAPU32[(moduleStruct + 28) >> 2]);
    const render: Function = funcTable.get(HEAPU32[(moduleStruct + 32) >> 2]);
    console.log(apiVersion);
    if (apiVersion !== "0.0.1") {
        console.error("unsupported version " + apiVersion);
    }
    const sizeOfPluginStruct = 64;
    const pluginPointer = malloc(sizeOfPluginStruct);
    if (pluginPointer === 0) {
        console.error("could not allocate plugin instance");
        destroy(pluginPointer);
        return;
    }
    // zero-initialize pluginInst
    for (let i = 0; i < sizeOfPluginStruct; ++i) {
        HEAPU8[pluginPointer + i] = 0;
    }
    
    // pluginInst->paramCount = paramCount;
    HEAPU32[(pluginPointer + 8) >> 2] = paramCount;
    // malloc(paramCount * sizeof(double))
    const paramData = malloc(paramCount * 8);
    if (paramData === 0) {
        console.error("could not allocate plugin instance");

        // moduleStruct->destroy(pluginInst);
        destroy(pluginPointer);
        return;
    }
    // set all params to 0
    for (let i = 0; i < paramCount; ++i) {
        HEAPF64[(paramData >> 3) + i] = 0;
    }
    // pluginInst->params = paramData
    HEAPU32[(pluginPointer + 12) >> 2] = paramData;
    // pluginInst->samples_per_second = 48khz
    HEAPF64[(pluginPointer + 24) >> 3] = 48000;
    init(pluginPointer);

    const tickContextPointer = malloc(12);
    const renderContextPointer = malloc(12);
    const ch0Pointer = malloc(8 * (2 << 31));
    const ch1Pointer = malloc(8 * (2 << 31));

    const delayLinePointer = malloc(8 * MAX_DELAY_LINE_LENGTH);

    return {
        apiVersion: apiVersion,
        name: pluginName,
        uielements: uielements,
        init: () => {
            destroy(pluginPointer);
            init(pluginPointer);
        },
        destroy: () => destroy(pluginPointer),
        tick: (tickContext: TickContext) => {
            HEAPU32[tickContextPointer >> 2] = tickContext.samplesPerTick;
            tick(pluginPointer, tickContextPointer);
        },
        render: (renderContext: RenderContext) => {
            HEAPU32[renderContextPointer >> 2] = renderContext.runLength;
            const monoOrStereo = renderContext.samples.length;
            HEAPU32[(renderContextPointer + 4) >> 2] = monoOrStereo;
            HEAPU32[(renderContextPointer + 8) >> 2] = ch0Pointer;
            HEAPU32[(renderContextPointer + 12) >> 2] = ch1Pointer;
            for (let i = renderContext.startIndex; i < renderContext.runLength + renderContext.startIndex; i++) {
                HEAPF64[(ch0Pointer >> 3) + i] = renderContext.samples[0][i];
            }
            if (monoOrStereo == channelCount.stereo) {
                for (let i = renderContext.startIndex; i < renderContext.runLength + renderContext.startIndex; i++) {
                    HEAPF64[(ch1Pointer >> 3) + i] = renderContext.samples[1]![i];
                }
            }
            // const testsamples = renderContext.samples[0].slice();

            //here
            render(pluginPointer, renderContextPointer);
            for (let i = renderContext.startIndex; i < renderContext.runLength + renderContext.startIndex; i++) {
                renderContext.samples[0][i] = HEAPF64[(ch0Pointer >> 3) + i];
            }
            if (monoOrStereo == channelCount.stereo) {
                for (let i = renderContext.startIndex; i < renderContext.runLength + renderContext.startIndex; i++) {
                    renderContext.samples[1]![i] = HEAPF64[(ch1Pointer >> 3) + i];
                }
            }
        },
        setParam: (index: number, data: number) => {
            HEAPF64[(paramData >> 3) + index] = data
        },
        getParam: (index: number) => HEAPF64[(paramData >> 3) + index],
        setDelayLineVal: (sample: number, index: number) => {
            const delayLineLength: number = HEAPU32[(pluginPointer + 16) >> 2];
            if (index > delayLineLength) {
                throw RangeError(index + "is greater than delayLineLength " + delayLineLength);
            }
            HEAPF64[(delayLinePointer >> 3) + index] = sample;
        },
        getDelayLineLength: () => HEAPU32[(pluginPointer + 16) >> 2]
    };
}

export interface PluginModule {
    apiVersion: string,
    name: string,
    uielements: PluginElement[],
    init: Function,
    destroy: Function,
    tick: Function,
    render: Function,
    setParam: Function,
    getParam: Function,
    setDelayLineVal: Function,
    getDelayLineLength: Function,
    //tailLength?
}

// export interface PluginInstance {
//     /** points to internal data used by the host. The plugin user will not touch this */
//     readonly host_data: null

//     /** can be used by the code to store intermediate values. Do not Touch! */
//     userdata: null

//     /** parameter data managed and provided to by the host //should be changed
//     * this contains the amount of parameters
//     */
//     readonly param_count: number
//     /** parameter data managed and provided to by the host //should be changed
//     * this contains the parameter data
//     */
//     readonly params: number[]

//     /**  delay line managed and provided to by the host.
//     * delay_line may be NULL
//     */
//     readonly delay_line_size: number
//     readonly delay_line: Float32Array | null

//     /** the sample rate of the audio stream.
//     * is always 48khz anyway, but is nice to know.
//     */
//     readonly samples_per_second: number

//     /** tail length of the effect in ticks. by default, this is equal to the
//     * duration of the delay buffer. it is not const, so the plugin can modify
//     */
//     tail_length: number
// }

export interface TickContext {
    samplesPerTick: number
}

type channels = [Float32Array, Float32Array] | [Float32Array]

export interface RenderContext {
    /**
    * the length of each audio buffer
    */ 
    runLength: number

    /**
    * The starting index for the audio buffer 
    */
    startIndex: number

    /** input/output buffer (processing is done in-place)
    * if this effect is specified to run before panning, samples[0] will
    * contain the mono audio buffer, and samples[1] will be NULL.
    * if this effect is ran after panning, samples[0] will conatin the left
    * audio buffer and samples[1] will contain the right audio buffer.
    */
    samples: channels;
}



export enum channelCount {
    blank,
    mono,
    stereo
}