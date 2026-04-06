// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { Config } from "../../synth/SynthConfig";
import { SpectrumWave } from "../../synth/song";
import { SongDocument } from "../SongDocument";
import { HTML, SVG } from "imperative-html/dist/esm/elements-strict";
import { ColorConfig } from "../ColorConfig";
import { Prompt } from "./Prompt";
import { SongEditor } from "../SongEditor";
import { ChangeGroup } from "../Change";
import { SpectrumEditor } from "../SpectrumEditor";

const { h2, div, button } = HTML;
const { svg, path } = SVG;

export class SpectrumEditorPrompt implements Prompt {

    public spectrumEditor: SpectrumEditor;

    private readonly spectrumEditors: SpectrumEditor[] = [];

    private _drumsetSpectrumIndex: number = 0;

    public readonly _playButton: HTMLButtonElement = button({ style: "width: 55%;", type: "button" });

    public readonly _drumsetButtons: HTMLButtonElement[] = [];
    public readonly _drumsetButtonContainer: HTMLDivElement = div({ class: "instrument-bar", style: "justify-content: center;" });

    private readonly _cancelButton: HTMLButtonElement = button({ class: "cancelButton" });
    private readonly _okayButton: HTMLButtonElement = button({ class: "okayButton", style: "width:45%;" }, "Okay");

    private readonly copyButton: HTMLButtonElement = button({ style: "width:86px; margin-right: 5px;", class: "copyButton" }, [
        "Copy",
        // Copy icon:
        svg({ style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "2em", height: "2em", viewBox: "-5 -21 26 26" }, [
            path({ d: "M 0 -15 L 1 -15 L 1 0 L 13 0 L 13 1 L 0 1 L 0 -15 z M 2 -1 L 2 -17 L 10 -17 L 14 -13 L 14 -1 z M 3 -2 L 13 -2 L 13 -12 L 9 -12 L 9 -16 L 3 -16 z", fill: "currentColor" }),
        ]),
    ]);
    private readonly pasteButton: HTMLButtonElement = button({ style: "width:86px;", class: "pasteButton" }, [
        "Paste",
        // Paste icon:
        svg({ style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "2em", height: "2em", viewBox: "0 0 26 26" }, [
            path({ d: "M 8 18 L 6 18 L 6 5 L 17 5 L 17 7 M 9 8 L 16 8 L 20 12 L 20 22 L 9 22 z", stroke: "currentColor", fill: "none" }),
            path({ d: "M 9 3 L 14 3 L 14 6 L 9 6 L 9 3 z M 16 8 L 20 12 L 16 12 L 16 8 z", fill: "currentColor", }),
        ]),
    ]);
    private readonly copyPasteContainer: HTMLDivElement = div({ style: "width: 185px;" }, this.copyButton, this.pasteButton);
    public readonly container: HTMLDivElement;

    constructor(private _doc: SongDocument, private _songEditor: SongEditor, private _isDrumset: boolean) {
        this.spectrumEditor = new SpectrumEditor(this._doc, null, true);

        this.container = div({ class: "prompt noSelection", style: "width: 500px;" },
            h2("Edit Spectrum Instrument"),
            div({ style: "display: flex; width: 55%; align-self: center; flex-direction: row; align-items: center; justify-content: center;" },
                this._playButton,
            ),
            this._drumsetButtonContainer,
            div({ style: "display: flex; flex-direction: row; align-items: center; justify-content: center; height: 80%" },
                this.spectrumEditor.container,
            ),
            div({ style: "display: flex; flex-direction: row-reverse; justify-content: space-between;" },
                this._okayButton,
                this.copyPasteContainer,
            ),
            this._cancelButton,
        );

        this._okayButton.addEventListener("click", this._saveChanges);
        this._cancelButton.addEventListener("click", this._close);
        this.container.addEventListener("keydown", this.whenKeyPressed);
        this.copyButton.addEventListener("click", this._copySettings);
        this.pasteButton.addEventListener("click", this._pasteSettings);
        this._playButton.addEventListener("click", this._togglePlay);
        this.container.addEventListener("mousemove", () => {
            this.spectrumEditor.render(); this.spectrumEditors[this._drumsetSpectrumIndex].setSpectrumWave(this.spectrumEditor.getSpectrumWave().spectrum);
        });
        this.container.addEventListener("mousedown", this.spectrumEditor.render.bind(this.spectrumEditor));
        this.spectrumEditor.container.addEventListener("mousemove", () => {
            this.spectrumEditor.render(); this.spectrumEditors[this._drumsetSpectrumIndex].setSpectrumWave(this.spectrumEditor.getSpectrumWave().spectrum);
        });
        this.spectrumEditor.container.addEventListener("mousedown", this.spectrumEditor.render.bind(this.spectrumEditor));
        this.updatePlayButton();
        // this.spectrumEditor.reassignDoc(_doc);

        if (this._isDrumset) {
            for (let i: number = Config.drumCount - 1; i >= 0; i--) {
                this.spectrumEditors[i] = new SpectrumEditor(this._doc, Config.drumCount - 1 - i, true);
                this.spectrumEditors[i].setSpectrumWave(this._songEditor._drumsetSpectrumEditors[Config.drumCount - 1 - i].getSpectrumWave().spectrum);
            }
            let colors = ColorConfig.getChannelColor(this._doc.song, this._doc.channel);
            for (let i: number = 0; i < Config.drumCount; i++) {
                let newSpectrumButton: HTMLButtonElement = button({ class: "no-underline", style: "max-width: 2em;" }, "" + (i + 1));
                this._drumsetButtons.push(newSpectrumButton);
                this._drumsetButtonContainer.appendChild(newSpectrumButton);
                newSpectrumButton.addEventListener("click", () => { this._setDrumSpectrum(i); });
            }
            this._drumsetButtons[Config.drumCount - 1].classList.add("last-button");
            this._drumsetButtons[0].classList.add("selected-instrument");

            this._drumsetButtonContainer.style.setProperty("--text-color-lit", colors.primaryNote);
            this._drumsetButtonContainer.style.setProperty("--text-color-dim", colors.secondaryNote);
            this._drumsetButtonContainer.style.setProperty("--background-color-lit", colors.primaryChannel);
            this._drumsetButtonContainer.style.setProperty("--background-color-dim", colors.secondaryChannel);
            this._drumsetButtonContainer.style.display = "";
            this.spectrumEditor.container.style.display = "";
            this.spectrumEditor.setSpectrumWave(this.spectrumEditors[this._drumsetSpectrumIndex].getSpectrumWave().spectrum);

        } else {
            this._drumsetButtonContainer.style.display = "none";
            this.spectrumEditors[0] = this.spectrumEditor;
        }

        setTimeout(() => this._playButton.focus());
        this.spectrumEditor.render();
    }

    private _setDrumSpectrum = (index: number): void => {
        this._drumsetButtons[this._drumsetSpectrumIndex].classList.remove("selected-instrument");
        this.spectrumEditors[this._drumsetSpectrumIndex].setSpectrumWave(this.spectrumEditor.getSpectrumWave().spectrum);

        this._drumsetSpectrumIndex = index;
        this._drumsetButtons[index].classList.add("selected-instrument");
        this.spectrumEditor.setSpectrumWave(this.spectrumEditors[this._drumsetSpectrumIndex].getSpectrumWave().spectrum);
        this.spectrumEditor.render();
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
        const spectrumCopy: SpectrumWave = this.spectrumEditor.getSpectrumWave();
        window.localStorage.setItem("spectrumCopy", JSON.stringify(spectrumCopy.spectrum));
    }

    private _pasteSettings = (): void => {
        const storedSpectrumWave: any = JSON.parse(String(window.localStorage.getItem("spectrumCopy")));
        this.spectrumEditor.setSpectrumWave(storedSpectrumWave);
    }

    public whenKeyPressed = (event: KeyboardEvent): void => {
        if ((<Element>event.target).tagName != "BUTTON" && event.keyCode == 13) { // Enter key
            this._saveChanges();
        } else if (event.keyCode == 32) {
            this._togglePlay();
            event.preventDefault();
        } else if (event.keyCode == 90) { // z
            this.spectrumEditor.undo();
            event.stopPropagation();
        } else if (event.keyCode == 89) { // y
            this.spectrumEditor.redo();
            event.stopPropagation();
        } else if (event.keyCode == 219) { // [
            this._doc.synth.goToPrevBar();
        } else if (event.keyCode == 221) { // ]
            this._doc.synth.goToNextBar();
        } else if (event.keyCode >= 49 && event.keyCode <= 57) { // 1-9
            if (event.shiftKey && this._isDrumset) {
                this._setDrumSpectrum(event.keyCode - 49);
            }
        } else if (event.keyCode == 48) { // 0
            if (event.shiftKey && this._isDrumset) {
                this._setDrumSpectrum(9);
            }
        } else if (event.keyCode == 189 || event.keyCode == 173) { //-
            if (event.shiftKey && this._isDrumset) {
                this._setDrumSpectrum(10);
            }
        } else if (event.keyCode == 187 || event.keyCode == 61 || event.keyCode == 171) { //+
            if (event.shiftKey && this._isDrumset) {
                this._setDrumSpectrum(11);
            }
        }
    }

    private _saveChanges = (): void => {
        // Save again just in case
        const group: ChangeGroup = new ChangeGroup();
        for (let i = 0; i < this.spectrumEditors.length; i++) {
            group.append(this.spectrumEditors[i].saveSettings());
        }
        this._doc.record(group, true);
        this._doc.prompt = null;
    }
}