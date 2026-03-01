export class PluginConfig {
    public static pluginName: string = "";
    public static pluginUIElements: PluginElement[] = [];
    public static pluginAbout: string = "";
}

interface PluginElementRoot {
    type: PluginElementType,
    name: string,
    initialValue: number,
    info: string,
}
export type PluginElement = PluginSlider | PluginCheckbox | PluginDropdown | PluginElementRoot;

export interface PluginSlider extends PluginElementRoot {
    type: PluginElementType.slider,
    max: number, //max 64
    hasEnvelope: boolean,
    //mod interaction?
}

export interface PluginCheckbox extends PluginElementRoot {
    type: PluginElementType.checkbox
}

export interface PluginDropdown extends PluginElementRoot {
    type: PluginElementType.dropdown,
    options: string[] //max 64
}

export const enum PluginElementType {
    slider,
    checkbox,
    dropdown
}