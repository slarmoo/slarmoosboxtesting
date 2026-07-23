import { HTML, SVG } from "imperative-html";
import { Config, RandomEnvelopeTypes, LFOEnvelopeTypes, DropdownID, EnvelopeType } from "../synth/SynthConfig";
import { SequenceEditor } from "./SequenceEditor";
import { prettyNumber } from "./EditorConfig";
import { SpectrumEditor } from "./SpectrumEditor";
import { FilterEditor, FilterEditorTypes } from "./FilterEditor";
import { ChangeAddNewSequence, ChangeDrumsetDiscreteEnvelope, ChangeDrumsetEnvelope, ChangeDrumsetEnvelopeInverse, ChangeDrumsetEnvelopeLowerBound, ChangeDrumsetEnvelopePitchEnd, ChangeDrumsetEnvelopePitchStart, ChangeDrumsetEnvelopeSpeed, ChangeDrumsetEnvelopeUpperBound, ChangeDrumsetRandomEnvelopeSeed, ChangeDrumsetRandomEnvelopeSteps, ChangeRemoveSequence, ChangeSetDrumsetEnvelopeWaveform, ChangeToggleDrumsetEnvelopeTarget, ChangeUpdateSequence, PasteDrumsetEnvelope } from "./changes";
import { ColorConfig } from "./ColorConfig";
import { Slider } from "./HTMLWrapper";
import { SongDocument } from "./SongDocument";
import { EnvelopeSettings, Instrument, SequenceSettings } from "../synth/song";
import { Change } from "./Change";

const { select, div, input, span, option, button } = HTML;

function buildOptions(menu: HTMLSelectElement, items: ReadonlyArray<string | number>): HTMLSelectElement {
    for (let index: number = 0; index < items.length; index++) {
        menu.appendChild(option({ value: index }, items[index]));
    }
    return menu;
}

export const enum DrumsetView {
    spectrum,
    filter,
    envelope
}

const filterTargetNames: string[] = ["filter freqs"];
for (let i: number = 0; i < Config.filterMaxPoints; i++) {
    filterTargetNames.push("filter " + (i + 1) + " freq");
}
filterTargetNames.push("filter freqs +");
for (let i: number = 0; i < Config.filterMaxPoints; i++) {
    filterTargetNames.push("filter " + (i + 1) + " freq");
}

export class DrumsetRow {
    private _view: DrumsetView = DrumsetView.spectrum;

    readonly drumsetSpectrumEditor: SpectrumEditor;
    readonly drumsetFilterEditor: FilterEditor;
    
    private readonly _drumsetEnvelopeSelect: HTMLSelectElement;
    private readonly _drumsetEnvelopeTarget: HTMLSelectElement;
    private readonly _drumsetEnvelopeTargetWrapper: HTMLDivElement;
    private readonly textOnIcon: string = ColorConfig.getComputed("--text-enabled-icon");
    private readonly textOffIcon: string = ColorConfig.getComputed("--text-disabled-icon");

    private readonly _pitchStartBox: HTMLInputElement;
    private readonly _pitchStartSlider: HTMLInputElement;
    private readonly _pitchEndBox: HTMLInputElement;
    private readonly _pitchEndSlider: HTMLInputElement;
    private readonly _startNoteDisplay: HTMLSpanElement;
    private readonly _endNoteDisplay: HTMLSpanElement;

    private readonly _randomStepsBox: HTMLInputElement;
    private readonly _randomStepsSlider: HTMLInputElement;
    private readonly _randomStepsWrapper: HTMLDivElement;
    private readonly _randomSeedBox: HTMLInputElement;
    private readonly _randomSeedSlider: HTMLInputElement;
    private readonly _randomTypeSelect: HTMLSelectElement;
    
    private readonly _waveformSelect: HTMLSelectElement;
    private readonly _LFOStepsBox: HTMLInputElement;
    private readonly _LFOStepsSlider: HTMLInputElement;
    private readonly _LFOStepsWrapper: HTMLDivElement;

    private readonly _sequenceSelect: HTMLSelectElement;
    private readonly _editSequenceButton: HTMLButtonElement;
    private readonly _sequenceView: SequenceEditor | null;

    private readonly _perEnvelopeSpeedSlider: Slider;
    private readonly _perEnvelopeSpeedDisplay: HTMLSpanElement;

    private readonly _invertBox: HTMLInputElement;
    private readonly _discreteBox: HTMLInputElement;
    private readonly _lowerBoundBox: HTMLInputElement;
    private readonly _upperBoundBox: HTMLInputElement;
    private readonly _lowerBoundSlider: Slider;
    private readonly _upperBoundSlider: Slider;

    private readonly _extraPitchSettingsGroup: HTMLDivElement;
    private readonly _extraRandomSettingsGroup: HTMLDivElement;
    private readonly _extraLFOSettingsGroup: HTMLDivElement;
    private readonly _extraSequenceSettingsGroup: HTMLDivElement;
    private readonly _perEnvelopeSpeedGroup: HTMLDivElement;
    public readonly extraSettingsDropdownGroup: HTMLDivElement;

    public openExtraSettingsDropdown: boolean = false;
    public readonly extraSettingsDropdown: HTMLButtonElement;

    public readonly container: HTMLDivElement;
    
    private _lastChange: Change | null = null;

    constructor(private _doc: SongDocument, private _drumIndex: number, private _extraSettingsDropdown: Function, private _openPrompt: Function) {
        this.drumsetSpectrumEditor = new SpectrumEditor(this._doc, _drumIndex);

        this.drumsetFilterEditor = new FilterEditor(this._doc, FilterEditorTypes.Drumset, false, _drumIndex);

        this._drumsetEnvelopeSelect = buildOptions(select({ style: "width: 100%;", title: "Filter Envelope" }), Config.envelopes.map(envelope => envelope.name));
        this._drumsetEnvelopeTarget = buildOptions(select({ style: "width: 100%;", title: "Filter Target" }), filterTargetNames);

        //pitch settings
        this._pitchStartSlider = input({ value: 0, style: "width: 113px; margin-left: 0px;", type: "range", min: "0", max: Config.drumCount - 1, step: "1" });
        this._pitchStartBox = input({ value: 0, style: "width: 4em; font-size: 80%; ", id: "startNoteBox", type: "number", step: "1", min: "0", max: Config.drumCount - 1 });

        this._pitchEndSlider = input({ value: Config.drumCount - 1, style: "width: 113px; margin-left: 0px;", type: "range", min: "0", max: Config.drumCount - 1, step: "1" });
        this._pitchEndBox = input({ value: Config.drumCount - 1, style: "width: 4em; font-size: 80%; ", id: "endNoteBox", type: "number", step: "1", min: "0", max: Config.drumCount - 1 });

        this._startNoteDisplay = span({ class: "tip", style: `width:68px; flex:1; height:1em; font-size: smaller;`, onclick: () => this._openPrompt("pitchRange") }, "Start " + ": ");
        this._endNoteDisplay = span({ class: "tip", style: `width:68px; flex:1; height:1em; font-size: smaller;`, onclick: () => this._openPrompt("pitchRange") }, "End " + ": ");

        const pitchStartBoxWrapper = div({ style: "flex: 1; display: flex; flex-direction: column; align-items: center;" }, this._startNoteDisplay, this._pitchStartBox);
        const pitchEndBoxWrapper = div({ style: "flex: 1; display: flex; flex-direction: column; align-items: center;" }, this._endNoteDisplay, this._pitchEndBox);

        const pitchStartNoteWrapper = div({ style: "margin-top: 3px; flex:1; display:flex; flex-direction: row; align-items:center; justify-content:right;" }, pitchStartBoxWrapper, this._pitchStartSlider);
        const pitchEndNoteWrapper = div({ style: "margin-top: 3px; flex:1; display:flex; flex-direction: row; align-items:center; justify-content:right;" }, pitchEndBoxWrapper, this._pitchEndSlider);

        this._extraPitchSettingsGroup = div({ class: "editor-controls", style: "flex-direction:column; align-items:center;" }, pitchStartNoteWrapper, pitchEndNoteWrapper);
        this._extraPitchSettingsGroup.style.display = "none";

        //random settings
        this._randomStepsBox = input({ type: "number", min: 1, max: Config.randomEnvelopeStepsMax, step: 1, style: "width: 4em; font-size: 80%; " });
        this._randomStepsSlider = input({ type: "range", min: 1, max: Config.randomEnvelopeStepsMax, step: 1, style: "width: 113px; margin-left: 0px;" });

        this._randomSeedBox = input({ type: "number", min: 1, max: Config.randomEnvelopeSeedMax, step: 1, style: "width: 4em; font-size: 80%; " });
        this._randomSeedSlider = input({ type: "range", min: 1, max: Config.randomEnvelopeSeedMax, step: 1, style: "width: 113px; margin-left: 0px;" });

        const randomStepsBoxWrapper: HTMLDivElement = div({ style: "flex: 1; display: flex; flex-direction: column; align-items: center;" }, span({ class: "tip", style: `width:68px; flex:1; height:1em; font-size: smaller;`, onclick: () => this._openPrompt("randomSteps") }, "Steps: "), this._randomStepsBox);
        const randomSeedBoxWrapper: HTMLDivElement = div({ style: "flex: 1; display: flex; flex-direction: column; align-items: center;" }, span({ class: "tip", style: `width:68px; flex:1; height:1em; font-size: smaller;`, onclick: () => this._openPrompt("randomSeed") }, "Seed: "), this._randomSeedBox);

        this._randomStepsWrapper = div({ style: "margin-top: 3px; flex:1; display:flex; flex-direction: row; align-items:center; justify-content:right;" }, randomStepsBoxWrapper, this._randomStepsSlider);
        const randomSeedWrapper: HTMLDivElement = div({ style: "margin-top: 3px; flex:1; display:flex; flex-direction: row; align-items:center; justify-content:right;" }, randomSeedBoxWrapper, this._randomSeedSlider);

        this._randomTypeSelect = select({ style: "width: 115px;" });
        const randomNames: string[] = ["time", "pitch", "note", "time smooth"];
        for (let waveform: number = 0; waveform < RandomEnvelopeTypes.length; waveform++) {
            this._randomTypeSelect.appendChild(option({ value: waveform }, randomNames[waveform]));
        }
        const randomTypeSelectWrapper: HTMLDivElement = div({ class: "editor-controls selectContainer", style: "margin-top: 3px; flex:1; display:flex; flex-direction: row; align-items:center; justify-content:right;" }, span({ style: "font-size: smaller; margin-right: 35px;", class: "tip", onclick: () => this._openPrompt("randomEnvelopeType") }, "Type: "), this._randomTypeSelect);

        this._extraRandomSettingsGroup = div({ class: "editor-controls", style: "flex-direction:column; align-items:center;" }, randomTypeSelectWrapper, this._randomStepsWrapper, randomSeedWrapper);
        this._extraRandomSettingsGroup.style.display = "none";

        //lfo settings
        this._waveformSelect = select({ style: "width: 115px;" });
        this._LFOStepsBox = input({ type: "number", min: 1, max: Config.randomEnvelopeStepsMax, step: 1, style: "width: 4em; font-size: 80%; " });
        this._LFOStepsSlider = input({ type: "range", min: 1, max: Config.randomEnvelopeStepsMax, step: 1, style: "width: 113px; margin-left: 0px;" });

        const LFOStepsBoxWrapper: HTMLDivElement = div({ style: "flex: 1; display: flex; flex-direction: column; align-items: center;" }, span({ class: "tip", style: `width:68px; flex:1; height:1em; font-size: smaller;`, onclick: () => this._openPrompt("randomSteps") }, "Steps: "), this._LFOStepsBox);

        this._LFOStepsWrapper = div({ style: "margin-top: 3px; flex:1; display:flex; flex-direction: row; align-items:center; justify-content:right;" }, LFOStepsBoxWrapper, this._LFOStepsSlider);
        const wavenames: string[] = ["sine", "square", "triangle", "sawtooth", "trapezoid", "stepped saw", "stepped tri"];
        for (let waveform: number = 0; waveform < LFOEnvelopeTypes.length; waveform++) {
            this._waveformSelect.appendChild(option({ value: waveform }, wavenames[waveform]));
        }

        const waveformWrapper: HTMLDivElement = div({ class: "editor-controls selectContainer", style: "margin-top: 3px; flex:1; display:flex; flex-direction: row; align-items:center; justify-content:right;" }, span({ style: "font-size: smaller; margin-right: 10px;", class: "tip", onclick: () => this._openPrompt("lfoEnvelopeWaveform") }, "Waveform: "), this._waveformSelect);
        this._extraLFOSettingsGroup = div({ class: "editor-controls", style: "margin-top: 3px; flex:1; display:flex; flex-direction: column; align-items:center; justify-content:right;" }, waveformWrapper, this._LFOStepsWrapper);
        this._extraLFOSettingsGroup.style.display = "none";

        //sequence settings
        this._sequenceSelect = select({ style: "width: 80px; font-size: smaller;" });
        for (let sequence: number = 0; sequence < this._doc.song.sequences.length; sequence++) {
            this._sequenceSelect.appendChild(option({ value: sequence }, "sequence " + (sequence + 1)));
        }
        if (this._doc.song.sequences.length < Config.maxEnvelopeSequenceCount) {
            this._sequenceSelect.appendChild(option({ value: this._doc.song.sequences.length }, "new sequence"));
        }
        this._sequenceSelect.appendChild(option({ value: -1 }, "remove sequence"));
        this._editSequenceButton = button({ style: "margin-top: 3px; margin-left: 3px; height: 26px; font-size: smaller;", class: "button", title: "Edit Sequence", onclick: () => this._openPrompt("sequenceSettings", { "sequenceIndex": this._sequenceSelect.value, "envelopeIndex": _drumIndex, "isDrum": true }) }, "Edit");
        const SequenceWrapper: HTMLDivElement = div({ class: "editor-controls selectContainer", style: "margin-top: 3px; flex:1; display:flex; flex-direction: row; align-items:center; justify-content:right;" }, span({ style: "font-size: smaller; margin-right: 10px;", class: "tip", onclick: () => this._openPrompt("sequenceEnvelope") }, "Sequence: "), this._sequenceSelect);
        const SequenceRow: HTMLDivElement = div({ class: "editor-controls", style: "margin-top: 3px; flex:1; display:flex; flex-direction: row; align-items:center; justify-content:right;" }, SequenceWrapper, this._editSequenceButton);
        this._sequenceView = new SequenceEditor(this._doc, 0, false, 1);
        this._extraSequenceSettingsGroup = div({ class: "editor-controls", id: "extraSequenceSettingsGroup", style: "margin-top: 3px; flex:1; display:flex; flex-direction: column; align-items:center; justify-content:center;" }, div({ style: "display: flex; flex-direction: row; align-items: center; justify-content: center; height: 60px" }, this._sequenceView.canvas), SequenceRow);
        this._extraSequenceSettingsGroup.style.display = "none";

        //speed settings
        this._perEnvelopeSpeedSlider = new Slider(input({ oninput: () => this.updateSpeedDisplay(), style: "margin: 0; width: 113px", type: "range", min: 0, max: Config.perEnvelopeSpeedIndices.length - 1, step: "1" }), this._doc, (oldSpeed: number, newSpeed: number) => new ChangeDrumsetEnvelopeSpeed(this._doc, DrumsetRow.convertIndexSpeed(oldSpeed, "speed"), DrumsetRow.convertIndexSpeed(newSpeed, "speed"), _drumIndex), false);
        this._perEnvelopeSpeedDisplay = span({ class: "tip", style: `width:58px; flex:1; height:1em; font-size: smaller; margin-left: 10px;`, onclick: () => this._openPrompt("perEnvelopeSpeed") }, "Spd: x" + prettyNumber(DrumsetRow.convertIndexSpeed(this._perEnvelopeSpeedSlider.getValueBeforeProspectiveChange(), "speed")));
        const perEnvelopeSpeedWrapper: HTMLDivElement = div({ style: "margin-top: 3px; flex:1; display:flex; flex-direction: row; align-items:center; justify-content:right;" }, this._perEnvelopeSpeedDisplay, this._perEnvelopeSpeedSlider.container);
        this._perEnvelopeSpeedGroup = div({ class: "editor-controls", style: "flex-direction:column; align-items:center;" }, perEnvelopeSpeedWrapper);

        //general settings (bounds and invert)
        this._lowerBoundBox = input({ type: "number", min: Config.perEnvelopeBoundMin, max: Config.perEnvelopeBoundMax, step: 0.1, style: "width: 4em; font-size: 80%; " });
        this._lowerBoundSlider = new Slider(input({ type: "range", min: Config.perEnvelopeBoundMin, max: Config.perEnvelopeBoundMax, step: 0.1, style: "width: 113px; margin-left: 0px;" }), this._doc, (oldBound: number, newBound: number) => new ChangeDrumsetEnvelopeLowerBound(this._doc, oldBound, newBound, _drumIndex), false);

        this._upperBoundBox = input({ type: "number", min: Config.perEnvelopeBoundMin, max: Config.perEnvelopeBoundMax, step: 0.1, style: "width: 4em; font-size: 80%; " });
        this._upperBoundSlider = new Slider(input({ type: "range", min: Config.perEnvelopeBoundMin, max: Config.perEnvelopeBoundMax, step: 0.1, style: "width: 113px; margin-left: 0px;" }), this._doc, (oldBound: number, newBound: number) => new ChangeDrumsetEnvelopeUpperBound(this._doc, oldBound, newBound, _drumIndex), false);

        const lowerBoundBoxWrapper: HTMLDivElement = div({ style: "flex: 1; display: flex; flex-direction: column; align-items: center;" }, span({ class: "tip", style: `width:68px; flex:1; height:1em; font-size: smaller;`, onclick: () => this._openPrompt("envelopeRange") }, "Lwr bnd: "), this._lowerBoundBox);
        const upperBoundBoxWrapper: HTMLDivElement = div({ style: "flex: 1; display: flex; flex-direction: column; align-items: center;" }, span({ class: "tip", style: `width:68px; flex:1; height:1em; font-size: smaller;`, onclick: () => this._openPrompt("envelopeRange") }, "Upr bnd: "), this._upperBoundBox);

        const lowerBoundWrapper: HTMLDivElement = div({ style: "margin-top: 3px; flex:1; display:flex; flex-direction: row; align-items:center; justify-content:right;" }, lowerBoundBoxWrapper, this._lowerBoundSlider.container);
        const upperBoundWrapper: HTMLDivElement = div({ style: "margin-top: 3px; flex:1; display:flex; flex-direction: row; align-items:center; justify-content:right;" }, upperBoundBoxWrapper, this._upperBoundSlider.container);

        this._invertBox = input({ "checked": false, type: "checkbox", style: "width: 1em; padding: 0.5em;", id: "invertBox" });
        this._discreteBox = input({ "checked": false, type: "checkbox", style: "width: 1em; padding: 0.5em;" });
        const checkboxWrapper: HTMLDivElement = div({ style: "margin: 0.1em; align-items:center; justify-content:right;" }, span({ class: "tip", onclick: () => this._openPrompt("envelopeInvert") }, "‣ Invert: "), this._invertBox, span({ class: "tip", style: "margin-left:4px;", onclick: () => this._openPrompt("discreteEnvelope") }, "‣ Discrete:"), this._discreteBox);


        //copy paste buttons
        const envelopeCopyButton: HTMLButtonElement = button({ style: "margin-left:0px; max-width:86px; width: 86px; height: 26px; padding-left: 22px", class: "copyButton", title: "Copy Envelope" }, [
            "Copy Env",
            // Copy icon:
            SVG.svg({ style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "26px", height: "26px", viewBox: "-5 -21 26 26" }, [
                SVG.path({ d: "M 0 -15 L 1 -15 L 1 0 L 13 0 L 13 1 L 0 1 L 0 -15 z M 2 -1 L 2 -17 L 10 -17 L 14 -13 L 14 -1 z M 3 -2 L 13 -2 L 13 -12 L 9 -12 L 9 -16 L 3 -16 z", fill: "currentColor" }),
            ]),
        ]);
        const envelopePasteButton: HTMLButtonElement = button({ style: "margin-left:2px; max-width:89px; width: 89px; height: 26px; padding-left: 22px", class: "pasteButton", title: "Paste Envelope" }, [
            "Paste Env",
            // Paste icon:
            SVG.svg({ style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "26px", height: "26px", viewBox: "0 0 26 26" }, [
                SVG.path({ d: "M 8 18 L 6 18 L 6 5 L 17 5 L 17 7 M 9 8 L 16 8 L 20 12 L 20 22 L 9 22 z", stroke: "currentColor", fill: "none" }),
                SVG.path({ d: "M 9 3 L 14 3 L 14 6 L 9 6 L 9 3 z M 16 8 L 20 12 L 16 12 L 16 8 z", fill: "currentColor", }),
            ]),
        ]);

        const copyPasteContainer: HTMLDivElement = div({ class: "editor-controls", style: "margin: 0.5em; display: flex; flex-direction:row; align-items:center;" }, envelopeCopyButton, envelopePasteButton);

        //general structure
        this.extraSettingsDropdown = button({ style: "margin-left:0em; margin-right: 0.3em; height:1.5em; align-self: center; width: 10px; padding: 0px; font-size: 8px;", onclick: () => { this._extraSettingsDropdown(DropdownID.DrumsetEnvelopeSettings, _drumIndex); } }, "▼");
        this.extraSettingsDropdown.style.display = "inline";

        this.extraSettingsDropdownGroup = div({ class: "editor-controls", style: "flex-direction:column; align-items:center;" }, this._extraRandomSettingsGroup, this._extraLFOSettingsGroup, this._extraSequenceSettingsGroup, this._extraPitchSettingsGroup, this._perEnvelopeSpeedGroup, lowerBoundWrapper, upperBoundWrapper, checkboxWrapper, copyPasteContainer);
        this.extraSettingsDropdownGroup.style.display = "none";

        //event listeners
        this._drumsetEnvelopeSelect.addEventListener("change", () => {
            this._doc.record(new ChangeDrumsetEnvelope(this._doc, this._drumIndex, this._drumsetEnvelopeSelect.selectedIndex));
        });

        this._drumsetEnvelopeTarget.addEventListener("change", () => {
            const targetChange = new ChangeToggleDrumsetEnvelopeTarget(this._doc, this._drumIndex, this._drumsetEnvelopeTarget.selectedIndex);
            this._doc.record(targetChange);
            const bitmap: number = targetChange.bitmap;
            for (let i: number = 1; i < this._drumsetEnvelopeTarget.children.length; i++) {
                const targetOption: HTMLOptionElement = <HTMLOptionElement>this._drumsetEnvelopeTarget.children[i];
                const label: string = bitmap ? ((bitmap & (1 << i - 1) ? this.textOnIcon : this.textOffIcon) + " " + filterTargetNames[i]) : filterTargetNames[i];
                if (targetOption.textContent != label) targetOption.textContent = label;
            }
        });

        envelopeCopyButton.addEventListener("click", () => {
            const instrument: Instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
            const envelope: EnvelopeSettings = instrument.drumsetEnvelopes[this._drumIndex];
            window.localStorage.setItem("envelopeCopy", JSON.stringify(envelope.toJsonObject(Config.envelopes[envelope.envelope].type == EnvelopeType.sequence ? this._doc.song.sequences[envelope.waveform] : undefined)));
        })

        envelopePasteButton.addEventListener("click", () => {
            const envelopeCopy: any = window.localStorage.getItem("envelopeCopy");
            const envelopeObject: any = JSON.parse(String(envelopeCopy));
            this._doc.record(new PasteDrumsetEnvelope(this._doc, envelopeObject, _drumIndex));
            const instrument: Instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
            const envelope: EnvelopeSettings = instrument.drumsetEnvelopes[_drumIndex];
            if (Config.envelopes[envelope.envelope].type == EnvelopeType.sequence) { //also paste the sequence
                const potentialSequence: SequenceSettings = new SequenceSettings();
                potentialSequence.fromJsonObject(envelopeObject["sequenceSettings"], Config.jsonFormat);
                //does the sequence already exist?
                let found: number = -1;
                for (let seq: number = 0; seq < this._doc.song.sequences.length; seq++) {
                    const sequence: SequenceSettings = this._doc.song.sequences[seq];
                    if (sequence.isSame(potentialSequence)) {
                        found = seq;
                        break;
                    }
                }
                if (found > -1) {
                    new ChangeSetDrumsetEnvelopeWaveform(this._doc, found, _drumIndex);
                } else {
                    //do we have room to add a sequence? If not, we can't paste it
                    if (this._doc.song.sequences.length < Config.maxEnvelopeSequenceCount) {
                        new ChangeAddNewSequence(this._doc, this._doc.song.sequences.length);
                        new ChangeUpdateSequence(this._doc, this._doc.song.sequences.length - 1, potentialSequence);
                        new ChangeSetDrumsetEnvelopeWaveform(this._doc, this._doc.song.sequences.length - 1, _drumIndex);
                    }
                }
            }
        })

        this._pitchStartBox.addEventListener("input", () => this._lastChange = new ChangeDrumsetEnvelopePitchStart(this._doc, parseInt(this._pitchStartBox.value), _drumIndex));
        this._pitchEndBox.addEventListener("input", () => this._lastChange = new ChangeDrumsetEnvelopePitchEnd(this._doc, parseInt(this._pitchEndBox.value), _drumIndex));
        this._pitchStartSlider.addEventListener("input", () => this._lastChange = new ChangeDrumsetEnvelopePitchStart(this._doc, parseInt(this._pitchStartSlider.value), _drumIndex));
        this._pitchEndSlider.addEventListener("input", () => this._lastChange = new ChangeDrumsetEnvelopePitchEnd(this._doc, parseInt(this._pitchEndSlider.value), _drumIndex));
        this._lowerBoundBox.addEventListener("input", () => {
            const envelope: EnvelopeSettings = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()].drumsetEnvelopes[_drumIndex];
            this._lastChange = new ChangeDrumsetEnvelopeLowerBound(this._doc, envelope.perEnvelopeLowerBound, parseInt(this._lowerBoundBox.value), _drumIndex);
        });
        this._upperBoundBox.addEventListener("input", () => {
            const envelope: EnvelopeSettings = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()].drumsetEnvelopes[_drumIndex];
            this._lastChange = new ChangeDrumsetEnvelopeUpperBound(this._doc, envelope.perEnvelopeLowerBound, parseInt(this._upperBoundBox.value), _drumIndex);
        });
        this._randomStepsBox.addEventListener("input", () => this._lastChange = new ChangeDrumsetRandomEnvelopeSteps(this._doc, parseInt(this._randomStepsBox.value), _drumIndex));
        this._randomSeedBox.addEventListener("input", () => this._lastChange = new ChangeDrumsetRandomEnvelopeSeed(this._doc, parseInt(this._randomSeedBox.value), _drumIndex));
        this._randomStepsSlider.addEventListener("input", () => this._lastChange = new ChangeDrumsetRandomEnvelopeSteps(this._doc, parseInt(this._randomStepsSlider.value), _drumIndex));
        this._randomSeedSlider.addEventListener("input", () => this._lastChange = new ChangeDrumsetRandomEnvelopeSeed(this._doc, parseInt(this._randomSeedSlider.value), _drumIndex));
        this._LFOStepsBox.addEventListener("input", () => this._lastChange = new ChangeDrumsetRandomEnvelopeSteps(this._doc, parseInt(this._LFOStepsBox.value), _drumIndex));
        this._LFOStepsSlider.addEventListener("input", () => this._lastChange = new ChangeDrumsetRandomEnvelopeSteps(this._doc, parseInt(this._LFOStepsSlider.value), _drumIndex));

        this._pitchStartBox.addEventListener("change", this._updateChange);
        this._pitchEndBox.addEventListener("change", this._updateChange);
        this._pitchStartSlider.addEventListener("change", this._updateChange);
        this._pitchEndSlider.addEventListener("change", this._updateChange);
        this._lowerBoundBox.addEventListener("change", this._updateChange);
        this._upperBoundBox.addEventListener("change", this._updateChange);
        this._randomStepsBox.addEventListener("change", this._updateChange);
        this._randomSeedBox.addEventListener("change", this._updateChange);
        this._randomStepsSlider.addEventListener("change", this._updateChange);
        this._randomSeedSlider.addEventListener("change", this._updateChange);
        this._LFOStepsBox.addEventListener("change", this._updateChange);
        this._LFOStepsSlider.addEventListener("change", this._updateChange);

        this._waveformSelect.addEventListener("change", () => this._doc.record(new ChangeSetDrumsetEnvelopeWaveform(this._doc, this._waveformSelect.value, _drumIndex)));
        this._randomTypeSelect.addEventListener("change", () => this._doc.record(new ChangeSetDrumsetEnvelopeWaveform(this._doc, this._randomTypeSelect.value, _drumIndex)));
        this._sequenceSelect.addEventListener("change", () => {
            if (this._sequenceSelect.value == this._doc.song.sequences.length + "") {
                this._openPrompt("sequenceSettings", { "sequenceIndex": this._doc.song.sequences.length, "envelopeIndex": _drumIndex, "isDrum": true });
            } else if (this._sequenceSelect.value == "-1") { 
                new ChangeRemoveSequence(this._doc, this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()].drumsetEnvelopes[_drumIndex].waveform);
                this._doc.record(new ChangeSetDrumsetEnvelopeWaveform(this._doc, Math.min(this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()].drumsetEnvelopes[_drumIndex].waveform, this._doc.song.sequences.length - 1), _drumIndex));
            } else {
                this._doc.record(new ChangeSetDrumsetEnvelopeWaveform(this._doc, this._sequenceSelect.value, _drumIndex));
            }
            this._doc.record(new ChangeSetDrumsetEnvelopeWaveform(this._doc, this._waveformSelect.value, _drumIndex))
        });
        this._invertBox.addEventListener("change", () => this._doc.record(new ChangeDrumsetEnvelopeInverse(this._doc, this._invertBox.checked, _drumIndex)));
        this._discreteBox.addEventListener("change", () => this._doc.record(new ChangeDrumsetDiscreteEnvelope(this._doc, this._discreteBox.checked, _drumIndex)));

        this._drumsetEnvelopeTargetWrapper = div({ class: "selectContainer", style: "width: 115.26px;" }, this._drumsetEnvelopeTarget);


        this.container = div(
            div({ class: "selectRow" },
                this.extraSettingsDropdown,
                div({ class: "selectContainer", style: "width: 5em; margin-right: .3em;" }, this._drumsetEnvelopeSelect),
                this.drumsetSpectrumEditor.container,
                this.drumsetFilterEditor.container,
                this._drumsetEnvelopeTargetWrapper,
            ),
            this.extraSettingsDropdownGroup,
        );

        this.render();
    }

    private _updateChange = (event: Event): void => {
        if (this._lastChange != null) {
            this._doc.record(this._lastChange);
            this._lastChange = null;
        }
    }

    private setSelectedValue(menu: HTMLSelectElement, value: number): void {
        const stringValue = value.toString();
        if (menu.value != stringValue)  menu.value = stringValue;
    }

    private _updateTargetOptionVisibility(menu: HTMLSelectElement): void {
        if (!menu) return;
        for (let optionIndex: number = 0; optionIndex < menu.childElementCount; optionIndex++) {
            const option: HTMLOptionElement = <HTMLOptionElement>menu.children[optionIndex];
            const target: number = parseInt(option.value);
            const filterPointCount: number = this.drumsetFilterEditor.filterSettings.controlPointCount;
            option.hidden = !(target == 0 || target - 1 < filterPointCount);
        }
    }

    public switchToView(view: DrumsetView) {
        this._view = view;
        this.drumsetSpectrumEditor.container.style.display = "none";
        this.drumsetFilterEditor.container.style.display = "none";
        this._drumsetEnvelopeTargetWrapper.style.display = "none";
        this.extraSettingsDropdown.style.display = "none";
        this.extraSettingsDropdownGroup.style.display = "none";
        if (view == DrumsetView.spectrum) {
            this.drumsetSpectrumEditor.container.style.display = "";
        } else if (view == DrumsetView.filter) {
            this.drumsetFilterEditor.container.style.display = "";

            const instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
            this.drumsetFilterEditor.swapToSettings(instrument.drumsetFilters[this._drumIndex]);
        } else if (view == DrumsetView.envelope) {
            this._drumsetEnvelopeTargetWrapper.style.display = "";
            this.render();
        }
    }

    private _pitchToNote(value: number, isNoise: boolean): string {
        let text = "";
        if (isNoise) {
            value = value * 6 + 12;
        }
        const offset: number = Config.keys[this._doc.song.key].basePitch % Config.pitchesPerOctave;
        const keyValue = (value + offset) % Config.pitchesPerOctave;
        if (Config.keys[keyValue].isWhiteKey) {
            text = Config.keys[keyValue].name;
        } else {
            const shiftDir: number = Config.blackKeyNameParents[value % Config.pitchesPerOctave];
            text = Config.keys[(keyValue + Config.pitchesPerOctave + shiftDir) % Config.pitchesPerOctave].name;
            if (shiftDir == 1) {
                text += "♭";
            } else if (shiftDir == -1) {
                text += "♯";
            }
        }
        return "[" + text + Math.floor((value + Config.pitchesPerOctave) / 12 + this._doc.song.octave - 1) + "]";
    }

    public static convertIndexSpeed(value: number, convertTo: string): number {
        switch (convertTo) {
            case "index":
                return Config.perEnvelopeSpeedToIndices[value] ?? 23;
            case "speed":
                return Config.perEnvelopeSpeedIndices[value] ?? 1;
        }
        return 0;
    }

    private updateSpeedDisplay() {
        this._perEnvelopeSpeedDisplay.textContent = "Spd: x" + prettyNumber(this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()].drumsetEnvelopes[this._drumIndex].perEnvelopeSpeed);
    }

    public render() {
        const instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
        if (!instrument.isNoiseInstrument) {
            return;
        }
        this.setSelectedValue(this._drumsetEnvelopeSelect, instrument.drumsetEnvelopes[this._drumIndex].envelope);
        this.drumsetSpectrumEditor.render();
        this.drumsetFilterEditor.render();
        const drumsetEnvelope: EnvelopeSettings = instrument.drumsetEnvelopes[this._drumIndex];
        const bitmap: number = drumsetEnvelope.target;
        let highest: number = Math.log2(bitmap);
        if (!Number.isFinite(highest)) highest = 0;
        this.setSelectedValue(this._drumsetEnvelopeTarget, bitmap ? (highest == Math.round(highest) ? highest + 2 + Config.filterMaxPoints : Config.filterMaxPoints + 1) : 0);
        for (let i: number = 1; i < this._drumsetEnvelopeTarget.children.length; i++) {
            const targetOption: HTMLOptionElement = <HTMLOptionElement>this._drumsetEnvelopeTarget.children[i];
            const label: string = bitmap ? ((bitmap & (1 << i - 1) ? this.textOnIcon : this.textOffIcon) + " " + filterTargetNames[i]) : filterTargetNames[i];
            if (targetOption.textContent != label) targetOption.textContent = label;
        }
        this._updateTargetOptionVisibility(this._drumsetEnvelopeTarget);
        this._sequenceView?.redrawCanvas();
        if (this.openExtraSettingsDropdown && this._view == DrumsetView.envelope) {
            this.extraSettingsDropdownGroup.style.display = "flex";
            this.extraSettingsDropdown.style.display = "inline";
            this._extraSequenceSettingsGroup.style.display = "none";
            this._perEnvelopeSpeedGroup.style.display = "none";
            this._extraRandomSettingsGroup.style.display = "none";
            this._extraLFOSettingsGroup.style.display = "none";
            this._extraPitchSettingsGroup.style.display = "none";
            this.updateSpeedDisplay();

            if (Config.envelopes[drumsetEnvelope.envelope].type == EnvelopeType.pitch) {
                //update values
                this._pitchStartBox.value = drumsetEnvelope.pitchEnvelopeStart.toString();
                this._pitchEndBox.value = drumsetEnvelope.pitchEnvelopeEnd.toString();
                if (parseInt(this._pitchStartBox.value) > Config.drumCount - 1) {
                    this._pitchStartBox.value = (Config.drumCount - 1).toString(); //reset if somehow greater than it should be
                }
                if (parseInt(this._pitchEndBox.value) > Config.drumCount - 1) {
                    this._pitchEndBox.value = (Config.drumCount - 1).toString();
                }
                //update note displays
                this._startNoteDisplay.textContent = "Start " + this._pitchToNote(parseInt(this._pitchStartBox.value), instrument.isNoiseInstrument) + ": ";
                this._endNoteDisplay.textContent = "End " + this._pitchToNote(parseInt(this._pitchEndBox.value), instrument.isNoiseInstrument) + ": ";
                //show pitch, hide others
                this._extraPitchSettingsGroup.style.display = "flex";

            } else if (Config.envelopes[drumsetEnvelope.envelope].type == EnvelopeType.pseudorandom) {
                
                //update values
                const isRandomTime: boolean = drumsetEnvelope.waveform == RandomEnvelopeTypes.time || drumsetEnvelope.waveform == RandomEnvelopeTypes.timeSmooth;
                this._randomStepsBox.value = drumsetEnvelope.steps.toString();
                this._randomSeedBox.value = drumsetEnvelope.seed.toString();
                this._randomStepsSlider.value = drumsetEnvelope.steps.toString();
                this._randomSeedSlider.value = drumsetEnvelope.seed.toString();
                this._perEnvelopeSpeedSlider.updateValue(DrumsetRow.convertIndexSpeed(drumsetEnvelope.perEnvelopeSpeed, "index"));
                if (drumsetEnvelope.waveform > RandomEnvelopeTypes.length) drumsetEnvelope.waveform = 0;
                this._randomStepsWrapper.style.display = drumsetEnvelope.waveform == RandomEnvelopeTypes.time || drumsetEnvelope.waveform == RandomEnvelopeTypes.note ? "flex" : "none";
                this._randomTypeSelect.selectedIndex = drumsetEnvelope.waveform;
                
                //show perEnvelopeSpeed if needed
                this._perEnvelopeSpeedGroup.style.display = isRandomTime ? "" : "none";
                this._extraRandomSettingsGroup.style.display = "";

            } else if (Config.envelopes[drumsetEnvelope.envelope].type == EnvelopeType.lfo) {

                //update values
                this._waveformSelect.value = drumsetEnvelope.waveform.toString();
                this._perEnvelopeSpeedSlider.updateValue(DrumsetRow.convertIndexSpeed(drumsetEnvelope.perEnvelopeSpeed, "index"));

                //show / hide steps based on waveform
                if (drumsetEnvelope.waveform == LFOEnvelopeTypes.steppedSaw || drumsetEnvelope.waveform == LFOEnvelopeTypes.steppedTri) {
                    this._LFOStepsWrapper.style.display = "flex";
                    this._LFOStepsBox.value = drumsetEnvelope.steps.toString();
                    this._LFOStepsSlider.value = drumsetEnvelope.steps.toString();
                } else {
                    this._LFOStepsWrapper.style.display = "none";
                }

                //show lfo settings and speed
                this._extraLFOSettingsGroup.style.display = "";
                this._perEnvelopeSpeedGroup.style.display = "flex"
            } else if (Config.envelopes[drumsetEnvelope.envelope].type == EnvelopeType.sequence) {
                //make sure the sequence select has the right amount of options
                this._sequenceSelect.innerHTML = ""
                for (let sequence: number = 0; sequence < this._doc.song.sequences.length; sequence++) {
                    this._sequenceSelect.appendChild(HTML.option({ value: sequence }, "sequence " + (sequence + 1)));
                }
                if (this._doc.song.sequences.length < Config.maxEnvelopeSequenceCount) {
                    this._sequenceSelect.appendChild(HTML.option({ value: this._doc.song.sequences.length }, "new sequence"));
                }
                this._sequenceSelect.appendChild(HTML.option({ value: -1 }, "remove sequence"));

                //update values
                this._sequenceSelect.value = drumsetEnvelope.waveform.toString();
                this._perEnvelopeSpeedSlider.updateValue(DrumsetRow.convertIndexSpeed(drumsetEnvelope.perEnvelopeSpeed, "index"));

                //show sequence settings and speed
                this._perEnvelopeSpeedGroup.style.display = "flex"
                this._extraSequenceSettingsGroup.style.display = "";

                //rerender sequence view
                if (this._sequenceView) {
                    this._sequenceView.sequence = this._doc.song.sequences[drumsetEnvelope.waveform];
                    this._sequenceView.redrawCanvas();
                }
            } else {
                this._extraRandomSettingsGroup.style.display = "none";
                if (Config.envelopes[drumsetEnvelope.envelope].type == EnvelopeType.punch || Config.envelopes[drumsetEnvelope.envelope].type == EnvelopeType.none || Config.envelopes[drumsetEnvelope.envelope].type == EnvelopeType.noteSize) {
                    this._perEnvelopeSpeedGroup.style.display = "none"
                } else {
                    //perEnvelopeSpeed
                    this._perEnvelopeSpeedGroup.style.display = "flex"
                    this._perEnvelopeSpeedSlider.updateValue(DrumsetRow.convertIndexSpeed(drumsetEnvelope.perEnvelopeSpeed, "index"));
                }
            }
            this._invertBox.checked = drumsetEnvelope.inverse;
            this._discreteBox.checked = drumsetEnvelope.discrete;

            this._lowerBoundBox.value = drumsetEnvelope.perEnvelopeLowerBound.toString();
            this._upperBoundBox.value = drumsetEnvelope.perEnvelopeUpperBound.toString();
            this._lowerBoundSlider.updateValue(drumsetEnvelope.perEnvelopeLowerBound);
            this._upperBoundSlider.updateValue(drumsetEnvelope.perEnvelopeUpperBound);
        } else {
            this.extraSettingsDropdownGroup.style.display = "none";
            this._extraPitchSettingsGroup.style.display = "none";
            this.extraSettingsDropdown.style.display = this._view == DrumsetView.envelope ? "inline" : "none";
            this._perEnvelopeSpeedGroup.style.display = "none";
            this._extraLFOSettingsGroup.style.display = "none";
            this._extraSequenceSettingsGroup.style.display = "none";
            this._extraRandomSettingsGroup.style.display = "none";
        }
    }
}