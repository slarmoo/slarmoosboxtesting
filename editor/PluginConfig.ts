export class PluginConfig {
    public static pluginName: string = "";
    public static pluginUIElements: PluginElement[] = [];
    public static pluginAbout: string = "";
}

interface PluginElementRoot {
    type: string,
    name: string
}
export type PluginElement = PluginSlider | PluginCheckbox | PluginDropdown | PluginElementRoot;

export interface PluginSlider extends PluginElementRoot {
    type: "slider",
    max: number, //max 64
    //mod interaction?
}

export interface PluginCheckbox extends PluginElementRoot {
    type: "checkbox"
}

export interface PluginDropdown extends PluginElementRoot {
    type: "dropdown",
    options: string[] //max 64
}