// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { Config } from "../../synth/SynthConfig";
import { FilterSettings, Instrument, SpectrumWave } from "../../synth/song";
import { SongDocument } from "../SongDocument";
import { HTML, SVG } from "imperative-html/dist/esm/elements-strict";
import { ColorConfig } from "../ColorConfig";
import { Prompt } from "./Prompt";
import { SongEditor } from "../SongEditor";
import { DrumsetView } from "../DrumsetRow";
import { ChangeGroup } from "../Change";
import { SpectrumEditor } from "../SpectrumEditor";
import { FilterEditor, FilterEditorTypes } from "../FilterEditor";

const { h2, div, button } = HTML;
const { svg, path } = SVG;

abstract class DrumsetCommand<T> {
    protected _oldValue: T;
    constructor(protected _drumsetPrompt: SpectrumEditorPrompt, protected _command: T) {

    }
    abstract do(): void
    abstract undo(): void
}

class SwitchDrumsetIndexCommand extends DrumsetCommand<number> {
    constructor(drumsetPrompt: SpectrumEditorPrompt, index: number) {
        super(drumsetPrompt, index);
        this._oldValue = this._drumsetPrompt.drumsetIndex;
    }

    public do(): void {
        this._drumsetPrompt.setDrumSpectrum(this._command);
    }

    public undo(): void {
        this._drumsetPrompt.setDrumSpectrum(this._oldValue);
    }
}

class SpectrumUpdateCommand extends DrumsetCommand<null> {
    constructor(drumsetPrompt: SpectrumEditorPrompt) {
        super(drumsetPrompt, null);
    }

    public do(): void {
        this._drumsetPrompt.spectrumEditor.redo();
    }

    public undo(): void {
        this._drumsetPrompt.spectrumEditor.undo();
    }
}

class FilterUpdateCommand extends DrumsetCommand<null> {
    constructor(drumsetPrompt: SpectrumEditorPrompt) {
        super(drumsetPrompt, null);
    }

    public do(): void {
        this._drumsetPrompt.filterEditors[this._drumsetPrompt.drumsetIndex].redo();
    }

    public undo(): void {
        this._drumsetPrompt.filterEditors[this._drumsetPrompt.drumsetIndex].undo();
    }
}

class DrumsetViewUpdateCommand extends DrumsetCommand<DrumsetView> {
    constructor(drumsetPrompt: SpectrumEditorPrompt, view: DrumsetView) {
        super(drumsetPrompt, view);
        this._oldValue = this._drumsetPrompt.drumsetView;
    }

    public do(): void {
        this._drumsetPrompt.switchDrumsetView(this._command, false);
    }

    public undo(): void {
        this._drumsetPrompt.switchDrumsetView(this._oldValue, false);
    }
}

type DrumsetCommandUnion = SwitchDrumsetIndexCommand | SpectrumUpdateCommand | FilterUpdateCommand | DrumsetViewUpdateCommand;

export class SpectrumEditorPrompt implements Prompt {

    public spectrumEditor: SpectrumEditor;
    private readonly spectrumEditors: SpectrumEditor[] = [];

    //for drumsets
    private readonly _filterEditorContainer: HTMLElement = div();
    public readonly filterEditors: FilterEditor[] = [];
    // private envelopeEditor: EnvelopeEditor;


    private _drumsetIndex: number = 0;

    public get drumsetIndex(): number {
        return this._drumsetIndex;
    }

    public set drumsetIndex(index: number) {
        this._drumsetIndex = index;
        this._filterEditorContainer.innerHTML = "";
        this._filterEditorContainer.appendChild(this.filterEditors[this.drumsetIndex].container);
    }

    private _commands: DrumsetCommandUnion[] = [];
    private _commandIndex: number = 0;

    private readonly _playButton: HTMLButtonElement = button({ style: "width: 55%;", type: "button" });

    private readonly _drumsetButtons: HTMLButtonElement[] = [];
    private readonly _drumsetButtonContainer: HTMLDivElement = div({ class: "instrument-bar", style: "justify-content: center;" });

    private readonly _drumsetSpectrumButton: HTMLButtonElement = button({ style: "width: 50%;", class: "no-underline", onclick: () => this.switchDrumsetView(DrumsetView.spectrum) }, "spectrum");
    private readonly _drumsetFilterButton: HTMLButtonElement = button({ style: "width: 50%;", class: "no-underline", onclick: () => this.switchDrumsetView(DrumsetView.filter) }, "filter");
    private readonly _drumsetEnvelopeButton: HTMLButtonElement = button({ style: "width: 50%;", class: "last-button no-underline", onclick: () => this.switchDrumsetView(DrumsetView.envelope) }, "envelope");
    private readonly _drumsetSwitchContainer: HTMLDivElement = div({ style: "width: 50%; align-self: center;", class: "instrument-bar" }, this._drumsetSpectrumButton, this._drumsetFilterButton, this._drumsetEnvelopeButton);

    private readonly _cancelButton: HTMLButtonElement = button({ class: "cancelButton" });
    private readonly _okayButton: HTMLButtonElement = button({ class: "okayButton", style: "width:45%;" }, "Okay");

    private readonly _copyButton: HTMLButtonElement = button({ style: "width:86px; margin-right: 5px;", class: "copyButton" }, [
        "Copy",
        // Copy icon:
        svg({ style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "2em", height: "2em", viewBox: "-5 -21 26 26" }, [
            path({ d: "M 0 -15 L 1 -15 L 1 0 L 13 0 L 13 1 L 0 1 L 0 -15 z M 2 -1 L 2 -17 L 10 -17 L 14 -13 L 14 -1 z M 3 -2 L 13 -2 L 13 -12 L 9 -12 L 9 -16 L 3 -16 z", fill: "currentColor" }),
        ]),
    ]);
    private readonly _pasteButton: HTMLButtonElement = button({ style: "width:86px;", class: "pasteButton" }, [
        "Paste",
        // Paste icon:
        svg({ style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "2em", height: "2em", viewBox: "0 0 26 26" }, [
            path({ d: "M 8 18 L 6 18 L 6 5 L 17 5 L 17 7 M 9 8 L 16 8 L 20 12 L 20 22 L 9 22 z", stroke: "currentColor", fill: "none" }),
            path({ d: "M 9 3 L 14 3 L 14 6 L 9 6 L 9 3 z M 16 8 L 20 12 L 16 12 L 16 8 z", fill: "currentColor", }),
        ]),
    ]);
    private readonly _copyPasteContainer: HTMLDivElement = div({ style: "width: 185px;" }, this._copyButton, this._pasteButton);
    public readonly container: HTMLDivElement;

    constructor(private _doc: SongDocument, private _songEditor: SongEditor, private _isDrumset: boolean, initialView: DrumsetView) {
        this.spectrumEditor = new SpectrumEditor(this._doc, null, true, () => this._pushCommand(new SpectrumUpdateCommand(this)));

        this.container = div({ class: "prompt noSelection", style: "width: 500px;" },
            h2(`Edit ${this._isDrumset ? "Drumset" : "Spectrum"} Instrument`),
            div({ style: "display: flex; width: 55%; align-self: center; flex-direction: row; align-items: center; justify-content: center;" },
                this._playButton,
            ),
            this._drumsetButtonContainer,
            this._drumsetSwitchContainer,
            div({ style: "display: flex; flex-direction: row; align-items: center; justify-content: center; height: 80%" },
                this.spectrumEditor.container,
                this._filterEditorContainer,
            ),
            div({ style: "display: flex; flex-direction: row; align-items: center; justify-content: center; width: 80%" },
            ),
            div({ style: "display: flex; flex-direction: row-reverse; justify-content: space-between;" },
                this._okayButton,
                this._copyPasteContainer,
            ),
            this._cancelButton,
        );

        this._okayButton.addEventListener("click", this._saveChanges);
        this._cancelButton.addEventListener("click", this._close);
        this.container.addEventListener("keydown", this.whenKeyPressed);
        this._copyButton.addEventListener("click", this._copySettings);
        this._pasteButton.addEventListener("click", this._pasteSettings);
        this._playButton.addEventListener("click", this._togglePlay);
        this.container.addEventListener("mousemove", () => {
            this.spectrumEditor.render(); this.spectrumEditors[this._drumsetIndex].setSpectrumWave(this.spectrumEditor.getSpectrumWave().spectrum);
        });
        this.container.addEventListener("mousedown", this.spectrumEditor.render.bind(this.spectrumEditor));
        this.spectrumEditor.container.addEventListener("mousemove", () => {
            this.spectrumEditor.render(); this.spectrumEditors[this._drumsetIndex].setSpectrumWave(this.spectrumEditor.getSpectrumWave().spectrum);
        });
        this.spectrumEditor.container.addEventListener("mousedown", this.spectrumEditor.render.bind(this.spectrumEditor));

        this._filterEditorContainer.addEventListener("mouseup", (event) => this._pushCommand(new FilterUpdateCommand(this)));
        this._filterEditorContainer.addEventListener("touchend", (event) => this._pushCommand(new FilterUpdateCommand(this)));
        this._filterEditorContainer.addEventListener("touchcancel", (event) => this._pushCommand(new FilterUpdateCommand(this)));
        // this._filterEditorContainer.addEventListener("mouseout", (event) => this._pushCommand(new FilterUpdateCommand(this)));

        this.updatePlayButton();

        if (this._isDrumset) {
            for (let i: number = Config.drumCount - 1; i >= 0; i--) {
                this.spectrumEditors[i] = new SpectrumEditor(this._doc, Config.drumCount - 1 - i, true);
                this.spectrumEditors[i].setSpectrumWave(this._songEditor.drumsetSpectrumEditors[Config.drumCount - 1 - i].getSpectrumWave().spectrum);
                this.filterEditors[i] = new FilterEditor(this._doc, FilterEditorTypes.Drumset, true, Config.drumCount - 1 - i);
            }
            let colors = ColorConfig.getChannelColor(this._doc.song, this._doc.channel);
            for (let i: number = 0; i < Config.drumCount; i++) {
                let newSpectrumButton: HTMLButtonElement = button({ class: "no-underline", style: "max-width: 2em;" }, "" + (i + 1));
                this._drumsetButtons.push(newSpectrumButton);
                this._drumsetButtonContainer.appendChild(newSpectrumButton);
                newSpectrumButton.addEventListener("click", () => {
                    this._pushCommand(new SwitchDrumsetIndexCommand(this, i));
                    this.setDrumSpectrum(i);
                });
            }
            this._drumsetButtons[Config.drumCount - 1].classList.add("last-button");
            this._drumsetButtons[0].classList.add("selected-instrument");
            
            this._drumsetButtonContainer.style.setProperty("--text-color-lit", colors.primaryNote);
            this._drumsetButtonContainer.style.setProperty("--text-color-dim", colors.secondaryNote);
            this._drumsetButtonContainer.style.setProperty("--background-color-lit", colors.primaryChannel);
            this._drumsetButtonContainer.style.setProperty("--background-color-dim", colors.secondaryChannel);
            this._drumsetButtonContainer.style.display = "";
            this._drumsetSwitchContainer.style.display = "";
            this.spectrumEditor.container.style.display = "";
            this.spectrumEditor.resetToInitial();
            this.spectrumEditor.setSpectrumWave(this.spectrumEditors[this._drumsetIndex].getSpectrumWave().spectrum, false);
            this.spectrumEditor.storeChange();
            this._commands = [];
            this._commandIndex = 0;
            this.drumsetIndex = 0;
            const instrument: Instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
            this.filterEditors[this._drumsetIndex].swapToSettings(instrument.drumsetFilters[Config.drumCount - 1 - this._drumsetIndex], false);
            this.switchDrumsetView(initialView, false);

        } else {
            this._drumsetButtonContainer.style.display = "none";
            this.spectrumEditors[0] = this.spectrumEditor;
            this._drumsetSwitchContainer.style.display = "none";
        }

        setTimeout(() => this._playButton.focus());
        this.spectrumEditor.render();
    }

    public setDrumSpectrum = (index: number): void => {
        this._drumsetButtons[this._drumsetIndex].classList.remove("selected-instrument");
        this.spectrumEditors[this._drumsetIndex].setSpectrumWave(this.spectrumEditor.getSpectrumWave().spectrum);

        const instrument: Instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
        this.filterEditors[this._drumsetIndex].swapToSettings(instrument.drumsetFilters[Config.drumCount - 1 - this._drumsetIndex], false);

        this.drumsetIndex = index;
        this._drumsetButtons[index].classList.add("selected-instrument");
        this.spectrumEditor.setSpectrumWave(this.spectrumEditors[this._drumsetIndex].getSpectrumWave().spectrum);
        this.spectrumEditor.render();
        this.filterEditors[this._drumsetIndex].render();
    }

    public get drumsetView(): DrumsetView {
        if (this._drumsetSpectrumButton.classList.contains("deactivated") &&
            this._drumsetFilterButton.classList.contains("deactivated")) return DrumsetView.envelope;
        if (this._drumsetFilterButton.classList.contains("deactivated")) return DrumsetView.spectrum;
        return DrumsetView.filter;
    }

    public switchDrumsetView(view: DrumsetView, saveHistory: boolean = true): void {
        if(saveHistory) this._pushCommand(new DrumsetViewUpdateCommand(this, view));
        this._drumsetSpectrumButton.classList.add("deactivated");
        this._drumsetFilterButton.classList.add("deactivated");
        this._drumsetEnvelopeButton.classList.add("deactivated");
        this._songEditor.switchDrumsetView(view);
        if (view == DrumsetView.spectrum) {
            this._drumsetSpectrumButton.classList.remove("deactivated");
            this.spectrumEditor.container.style.display = "";
            this._filterEditorContainer.style.display = "none";
        } else if (view == DrumsetView.filter) {
            this._drumsetFilterButton.classList.remove("deactivated");
            this.spectrumEditor.container.style.display = "none";
            this._filterEditorContainer.style.display = "";
        } else if (view == DrumsetView.envelope) {
            this._drumsetEnvelopeButton.classList.remove("deactivated");
            this.spectrumEditor.container.style.display = "none";
            this._filterEditorContainer.style.display = "none";
        }
    }

    private _pushCommand(command: DrumsetCommandUnion): void {
        if (this._commandIndex != this._commands.length) {
            this._commands.length = this._commandIndex;
        }
        this._commands.push(command);
        this._commandIndex++;
    }

    private _togglePlay = (): void => {
        this._songEditor.togglePlay();
        this.updatePlayButton();
    }

    public updatePlayButton(): void {
        if (this._doc.synth.playing) {
            this._playButton.classList.remove("playButton");
            this._playButton.classList.add("pauseButton");
            this._playButton.title = "Pause (Space)";
            this._playButton.innerText = "Pause";
        } else {
            this._playButton.classList.remove("pauseButton");
            this._playButton.classList.add("playButton");
            this._playButton.title = "Play (Space)";
            this._playButton.innerText = "Play";
        }
    }

    private _close = (): void => {
        this._doc.prompt = null;
        this._doc.undo();
    }

    public cleanUp = (): void => {
        this._okayButton.removeEventListener("click", this._saveChanges);
        this._cancelButton.removeEventListener("click", this._close);
        this.container.removeEventListener("keydown", this.whenKeyPressed);
        this.spectrumEditor.container.removeEventListener("mousemove", () => this.spectrumEditor.render());
        this._playButton.removeEventListener("click", this._togglePlay);
    }

    private _copySettings = (): void => {
        if (this.drumsetView == DrumsetView.spectrum) {
            const spectrumCopy: SpectrumWave = this.spectrumEditor.getSpectrumWave();
            window.localStorage.setItem("spectrumCopy", JSON.stringify(spectrumCopy.spectrum));
        } else if (this.drumsetView == DrumsetView.filter) {
            const filterCopy: FilterSettings = this.filterEditors[this.drumsetIndex].filterSettings;
            window.localStorage.setItem("filterCopy", JSON.stringify(filterCopy.toJsonObject()));
        }
    }

    private _pasteSettings = (): void => {
        if (this.drumsetView == DrumsetView.spectrum) {
            const storedSpectrumWave: any = JSON.parse(String(window.localStorage.getItem("spectrumCopy")));
            this.spectrumEditor.setSpectrumWave(storedSpectrumWave);
            this.spectrumEditor.storeChange();
            this._pushCommand(new SpectrumUpdateCommand(this));
        } else if (this.drumsetView == DrumsetView.filter) {
            const filterCopy: FilterSettings = new FilterSettings();
            filterCopy.fromJsonObject(JSON.parse(String(window.localStorage.getItem("filterCopy"))));
            if (filterCopy != null) {
                this.filterEditors[this.drumsetIndex].swapToSettings(filterCopy, true);
            }
            this._pushCommand(new FilterUpdateCommand(this));
        }
    }

    public whenKeyPressed = (event: KeyboardEvent): void => {
        if ((<Element>event.target).tagName != "BUTTON" && event.keyCode == 13) { // Enter key
            this._saveChanges();
        } else if (event.keyCode == 32) {
            this._togglePlay();
            event.preventDefault();
        } else if (event.keyCode == 90) { // z
            if (event.shiftKey) {
                if (this._commandIndex < this._commands.length) {
                    this._commands[this._commandIndex].do();
                    this._commandIndex++;
                }
            } else {
                if (this._commandIndex > 0) {
                    this._commandIndex--;
                    this._commands[this._commandIndex].undo();
                }
            }
            event.stopPropagation();
        } else if (event.keyCode == 89) { // y
            if (this._commandIndex < this._commands.length) {
                this._commands[this._commandIndex].do();
                this._commandIndex++;
            }
            event.stopPropagation();
        } else if (event.keyCode == 219) { // [
            this._doc.synth.goToPrevBar();
        } else if (event.keyCode == 221) { // ]
            this._doc.synth.goToNextBar();
        } else if (event.keyCode >= 49 && event.keyCode <= 57) { // 1-9
            if (event.shiftKey && this._isDrumset) {
                this.setDrumSpectrum(event.keyCode - 49);
            }
        } else if (event.keyCode == 48) { // 0
            if (event.shiftKey && this._isDrumset) {
                this.setDrumSpectrum(9);
            }
        } else if (event.keyCode == 189 || event.keyCode == 173) { //-
            if (event.shiftKey && this._isDrumset) {
                this.setDrumSpectrum(10);
            }
        } else if (event.keyCode == 187 || event.keyCode == 61 || event.keyCode == 171) { //+
            if (event.shiftKey && this._isDrumset) {
                this.setDrumSpectrum(11);
            }
        }
    }

    private _saveChanges = (): void => {
        // Save again just in case
        const group: ChangeGroup = new ChangeGroup();
        for (let i = 0; i < this.spectrumEditors.length; i++) {
            group.append(this.spectrumEditors[i].saveSettings());
            // group.append(this.filterEditors[i].saveSettings())
        }
        this._doc.record(group, true);
        this._doc.prompt = null;
    }
}