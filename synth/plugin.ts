import { PluginElement } from "../editor/PluginConfig";

export abstract class EffectPlugin {
    public abstract readonly pluginName: string;
    public abstract readonly about: string;
    public abstract readonly elements: PluginElement[] //max 64
    /** When the effect runs in the effect order. If a number is given, it inserts at that index, and moves all other effects down one.
     * If a list of numbers is given, if its length == 10, it reorganizes the effect order based on the list given. 
     * 
        Current order: 

        0. granular
        1. Distortion
        2. Bitcrusher
        3. Ring Modulation
        4. EQ filter
        5. Panning //after panning you must read from and write to sampleL and sampleR instead of sample
        6. Chorus
        7. Echo
        8. Reverb
        9. Plugin
    */
    public abstract effectOrderIndex: number | number[];

    public abstract reset: () => void;
    /**
     * If delay lines are unused, leave as an empty function
     */
    public abstract initializeDelayLines: (samplesPerTick: number) => void;

    public abstract instrumentStateFunction: (instrument: any) => void;
    /** The per sample calculations.
    * Your inputs are the variable names above and a sample (or sampleL and sampleR if after panning)
    * Your outputs are sample (or sampleL and sampleR if after panning)
    * Is in string form 
    * */
    public abstract synthFunction: (sample: number, runLength: number) => number | ((sampleL: number, sampleR: number, runLength: number) => [number, number]);

    public ping() {
        console.log("pong!");
    }

    constructor() { }
    }