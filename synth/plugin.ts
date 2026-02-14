import { PluginElement } from "../editor/PluginConfig";

/**
 * The structure of a plugin
 */
export abstract class EffectPlugin {
    /**
     * The name of your plugin! Must be identical to the key that you expose your plugin through over globalThis
     */
    public abstract readonly pluginName: string;
    /**
     * A short snippet about your plugin
     */
    public abstract readonly about: string;
    /**
     * Slarmoo's Box can support up to 64 plugin elements. 
     * The ordering of your elements corresponds to the index of instrument.pluginValues where the value of said element will be accessible
     * 
     * It is recommended that you make your first element have some sort of on/off functionality (ie, wet/dry mix)
     */
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

    /**
     * Empty delay lines, reset lfos, etc
     */
    public abstract reset: () => void;
    /**
     * If your plugin uses delay lines and you would like your sound to sustain, change this value to your delay line length
     */
    public delayLineLength: number = 0;
    /**
     * If delay lines are unused, leave as an empty function
     */
    public abstract initializeDelayLines: (samplesPerTick: number) => void;

    /**
     * Here you can grab the instrument values at instrument.pluginValues[index], where index corresponds to the order of your ui elements. 
     */
    public abstract instrumentStateFunction: (instrument: any) => void;
    /** The per sample calculations.
    * Your inputs are the variable names above and a sample (or sampleL and sampleR if after panning)
    * Your outputs are sample (or sampleL and sampleR if after panning)
    * Is in string form 
    * */
    public abstract synthFunction: ((sample: number, runLength: number) => number) | ((sampleL: number, sampleR: number, runLength: number) => [number, number]);

    /**
     * For testing
     */
    public ping() {
        console.log("pong!");
    }

    constructor() { }
}