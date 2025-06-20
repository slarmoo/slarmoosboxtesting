// import { Config } from "../synth/SynthConfig";
import { HTML } from "imperative-html/dist/esm/elements-strict";
import { Prompt } from "./Prompt";
import { ChangeAdvancedInstrumentSettings } from "./changes";
import { AdvancedInstrumentSettings, Instrument } from "../synth/synth";
import { SongDocument } from "./SongDocument";
import { Config, InstrumentType } from "../synth/SynthConfig";

const { h2, div, span, br, button, input } = HTML;

export class AdvancedInstrumentSettingsPrompt implements Prompt {

    private readonly _cancelButton: HTMLButtonElement = button({ class: "cancelButton" });
    private readonly _okayButton: HTMLButtonElement = button({ class: "okayButton", style: "width:45%;" }, "Okay");

    private readonly _perToneEffectsBox: HTMLInputElement = input({ type: "checkbox", style: "width: 1em; padding: 0.5em;", id: "perToneEffectsCheckbox" });
    private readonly _seededRandomizationBox: HTMLInputElement = input({ type: "checkbox", style: "width: 1em; padding: 0.5em;", id: "seededRandomizationCheckbox" });
    private readonly _affectedBySongDetuneBox: HTMLInputElement = input({ type: "checkbox", style: "width: 1em; padding: 0.5em;", id: "affectedBySongDetuneCheckbox" });
    private readonly _affectedBySongEqBox: HTMLInputElement = input({ type: "checkbox", style: "width: 1em; padding: 0.5em;", id: "affectedBySongEqCheckbox" });

    private readonly _seedSlider: HTMLInputElement = input({ type: "range", min: 1, max: Config.randomEnvelopeSeedMax, step: 1, style: "width: 113px; margin-left: 0px;" });

    private readonly _perToneEffectsDiv: HTMLDivElement = div(
        { style: "display: flex; flex-direction: row; align-items: center; justify-content: center;" },
        span("Per Pitch Effects: "), this._perToneEffectsBox);
    private readonly _seededRandomizationDiv: HTMLDivElement = div(
        { style: "display: flex; flex-direction: row; align-items: center; justify-content: center;" },
        span("Seeded Randomization", br(), "(for instrument calculations): "), this._seededRandomizationBox);
    private readonly _affectedBySongDetuneDiv: HTMLDivElement = div(
        { style: "display: flex; flex-direction: row; align-items: center; justify-content: center;" },
        span("Affected by Song Detune: "), this._affectedBySongDetuneBox);
    private readonly _affectedBySongEqDiv: HTMLDivElement = div(
        { style: "display: flex; flex-direction: row; align-items: center; justify-content: center;" },
        span("Affected by Song EQ: "), this._affectedBySongEqBox);

    public readonly container: HTMLDivElement = div({ class: "prompt noSelection", style: "width: 300px;" },
        h2("Edit Advanced Instrument Settings"),
        div({ style: "display: flex; flex-direction: column; align-items: center; justify-content: center;" },
            this._perToneEffectsDiv,
            this._seededRandomizationDiv,
            this._seedSlider,
            this._affectedBySongDetuneDiv,
            this._affectedBySongEqDiv,
        ),
        div({ style: "display: flex; flex-direction: row-reverse; justify-content: space-between;" },
            this._okayButton,
        ),
        this._cancelButton,
    );

    constructor(private _doc: SongDocument) {
        const instrument: Instrument = this._doc.song.channels[_doc.channel].instruments[_doc.getCurrentInstrument()];
        const instAdvSettings = instrument.advancedSettings;
        this._perToneEffectsBox.checked = instAdvSettings.perToneEffects;
        this._seededRandomizationBox.checked = instAdvSettings.seededRandomization;
        this._seedSlider.value = instAdvSettings.randomSeed + "";
        this._affectedBySongDetuneBox.checked = instAdvSettings.affectedBySongDetune;
        this._affectedBySongEqBox.checked = instAdvSettings.affectedBySongEq;

        //hide unapplicable settings
        if (instrument.type == InstrumentType.noise || instrument.type == InstrumentType.spectrum
        || instrument.type == InstrumentType.drumset || instrument.type == InstrumentType.supersaw) {
            this._seededRandomizationDiv.style.display = "";
            this._seedSlider.style.display = this._seededRandomizationBox.checked ? "" : "none";
        } else {
            this._seededRandomizationDiv.style.display = "none";
            this._seedSlider.style.display = "none";
        }

        this._okayButton.addEventListener("click", this._saveChanges);
        this._cancelButton.addEventListener("click", this._close);
        this.container.addEventListener("keydown", this.whenKeyPressed);
        this._seededRandomizationBox.addEventListener("input", () => this._seedSlider.style.display = this._seededRandomizationBox.checked ? "" : "none");

    }

    private _close = (): void => {
        this._doc.prompt = null;
        this._doc.undo();
    }

    public cleanUp = (): void => {
        this._okayButton.removeEventListener("click", this._saveChanges);
        this._cancelButton.removeEventListener("click", this._close);
        this.container.removeEventListener("keydown", this.whenKeyPressed);
    }

    public whenKeyPressed = (event: KeyboardEvent): void => {
        if ((<Element>event.target).tagName != "BUTTON" && event.keyCode == 13) { // Enter key
            this._saveChanges();
        }
    }

    private _saveChanges = (): void => {
        this._doc.prompt = null;

        const newAdvancedSettings = new AdvancedInstrumentSettings();
        
        newAdvancedSettings.perToneEffects = this._perToneEffectsBox.checked;
        newAdvancedSettings.seededRandomization = this._seededRandomizationBox.checked;
        newAdvancedSettings.randomSeed = parseInt(this._seedSlider.value);
        newAdvancedSettings.affectedBySongDetune = this._affectedBySongDetuneBox.checked;
        newAdvancedSettings.affectedBySongEq = this._affectedBySongEqBox.checked;

        this._doc.record(new ChangeAdvancedInstrumentSettings(this._doc, newAdvancedSettings), true);
        this._doc.prompt = null;
    }
}