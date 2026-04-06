// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { HarmonicsWave } from "../../synth/song";
import { SongDocument } from "../SongDocument";
import { HTML, SVG } from "imperative-html/dist/esm/elements-strict";
import { Prompt } from "./Prompt";
import { SongEditor } from "../SongEditor";
import { HarmonicsEditor } from "../HarmonicsEditor";

const { h2, div, button } = HTML;

export class HarmonicsEditorPrompt implements Prompt {

    public readonly harmonicsEditor: HarmonicsEditor;

    public readonly _playButton: HTMLButtonElement = button({ style: "width: 55%;", type: "button" });

    private readonly _cancelButton: HTMLButtonElement = button({ class: "cancelButton" });
    private readonly _okayButton: HTMLButtonElement = button({ class: "okayButton", style: "width:45%;" }, "Okay");

    private readonly copyButton: HTMLButtonElement = button({ style: "width:86px; margin-right: 5px;", class: "copyButton" }, [
        "Copy",
        // Copy icon:
        SVG.svg({ style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "2em", height: "2em", viewBox: "-5 -21 26 26" }, [
            SVG.path({ d: "M 0 -15 L 1 -15 L 1 0 L 13 0 L 13 1 L 0 1 L 0 -15 z M 2 -1 L 2 -17 L 10 -17 L 14 -13 L 14 -1 z M 3 -2 L 13 -2 L 13 -12 L 9 -12 L 9 -16 L 3 -16 z", fill: "currentColor" }),
        ]),
    ]);
    private readonly pasteButton: HTMLButtonElement = button({ style: "width:86px;", class: "pasteButton" }, [
        "Paste",
        // Paste icon:
        SVG.svg({ style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "2em", height: "2em", viewBox: "0 0 26 26" }, [
            SVG.path({ d: "M 8 18 L 6 18 L 6 5 L 17 5 L 17 7 M 9 8 L 16 8 L 20 12 L 20 22 L 9 22 z", stroke: "currentColor", fill: "none" }),
            SVG.path({ d: "M 9 3 L 14 3 L 14 6 L 9 6 L 9 3 z M 16 8 L 20 12 L 16 12 L 16 8 z", fill: "currentColor", }),
        ]),
    ]);
    private readonly copyPasteContainer: HTMLDivElement = div({ style: "width: 185px;" }, this.copyButton, this.pasteButton);
    public readonly container: HTMLDivElement;

    constructor(private _doc: SongDocument, private _songEditor: SongEditor) {
        this.harmonicsEditor = new HarmonicsEditor(this._doc, true);

        this.container = div({ class: "prompt noSelection", style: "width: 500px;" },
            h2("Edit Harmonics Instrument"),
            div({ style: "display: flex; width: 55%; align-self: center; flex-direction: row; align-items: center; justify-content: center;" },
                this._playButton,
            ),
            div({ style: "display: flex; flex-direction: row; align-items: center; justify-content: center;" },
                this.harmonicsEditor.container,
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
        this.harmonicsEditor.container.addEventListener("mousemove", () => this.harmonicsEditor.render());
        this.harmonicsEditor.container.addEventListener("mousedown", () => this.harmonicsEditor.render());
        this.container.addEventListener("mousemove", () => this.harmonicsEditor.render());

        this.updatePlayButton();

        setTimeout(() => this._playButton.focus());

        this.harmonicsEditor.render();
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
        this.harmonicsEditor.container.removeEventListener("mousemove", () => this.harmonicsEditor.render());
        this._playButton.removeEventListener("click", this._togglePlay);
    }

    private _copySettings = (): void => {
        const harmonicsCopy: HarmonicsWave = this.harmonicsEditor.getHarmonicsWave();
        window.localStorage.setItem("harmonicsCopy", JSON.stringify(harmonicsCopy.harmonics));
    }

    private _pasteSettings = (): void => {
        const storedHarmonicsWave: any = JSON.parse(String(window.localStorage.getItem("harmonicsCopy")));
        this.harmonicsEditor.setHarmonicsWave(storedHarmonicsWave);
        this.harmonicsEditor.storeChange();
    }

    public whenKeyPressed = (event: KeyboardEvent): void => {
        if ((<Element>event.target).tagName != "BUTTON" && event.keyCode == 13) { // Enter key
            this._saveChanges();
        }
        else if (event.keyCode == 32) {
            this._togglePlay();
            event.preventDefault();
        }
        else if (event.keyCode == 90) { // z
            this.harmonicsEditor.undo();
            event.stopPropagation();
        }
        else if (event.keyCode == 89) { // y
            this.harmonicsEditor.redo();
            event.stopPropagation();
        }
        else if (event.keyCode == 219) { // [
            this._doc.synth.goToPrevBar();
        }
        else if (event.keyCode == 221) { // ]
            this._doc.synth.goToNextBar();
        }
    }

    private _saveChanges = (): void => {
        this._doc.prompt = null;
        this._doc.record(this.harmonicsEditor.saveSettings(), true);
        this._doc.prompt = null;
    }
}