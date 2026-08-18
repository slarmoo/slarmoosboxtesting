import { PluginElement } from "beepboxplugin";
import { Preset } from "./EditorConfig";

export class PluginConfig {
    public static pluginName: string = "";
    public static pluginUIElements: PluginElement[] = [];
    public static pluginAbout: string = "";
    public static pluginPresets: Preset[] = [];
}