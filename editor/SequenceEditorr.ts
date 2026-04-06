import { Config } from "../synth/SynthConfig";
import { Prompt } from "./Prompt";
import { HTML, SVG } from "imperative-html/dist/esm/elements-strict";
import { SongDocument } from "./SongDocument"
import { ChangeGroup } from "./Change";
import { SequenceSettings } from "../synth/synthMessenger";
import { ChangeAddNewSequence, ChangeSequenceBooleans, ChangeSequenceHeight, ChangeSequenceLength, ChangeSequenceValues, ChangeSetEnvelopeWaveform, ChangeUpdateSequence } from "./changes";
import { ColorConfig } from "./ColorConfig";
import { SongEditor } from "./SongEditor";

const { div, input, button, span, h2, canvas, p } = HTML;

export class SequenceEditor {
    public sequence: SequenceSettings;
    public originalSequence: SequenceSettings;

    private _undoHistoryState: number = 0;
    private _changeQueue: SequenceSettings[] = [];

    private _mouseX: number = 0;
    private _mouseY: number = 0;
    private _mouseDown: boolean = false;

    private canvasHeight: number = 156;
    private canvasWidth: number = 384;

    public canvas: HTMLCanvasElement;
    private renderedColor: string = "";



    constructor(private _doc: SongDocument, private sequenceIndex: number, interactable: boolean, scale: number = 3) {
        this.canvasHeight = 52 * scale;
        this.canvasWidth = 128 * scale;
        this.canvas = canvas({ width: this.canvasWidth, height: this.canvasHeight, style: "border:2px solid " + ColorConfig.uiWidgetBackground, id: "customSequenceDrawCanvas" });
        if (!this.sequenceIndex) this.sequenceIndex = 0;
        if (this.sequenceIndex >= this._doc.song.sequences.length) {
            this.sequence = new SequenceSettings();
            new ChangeAddNewSequence(this._doc, sequenceIndex);
        } else {
            this.sequence = this._doc.song.sequences[this.sequenceIndex].copy();
        }
        this.originalSequence = this.sequence.copy();

        if (interactable) {
            this.canvas.addEventListener("mousemove", this._onMouseMove);
            this.canvas.addEventListener("mousedown", this._onMouseDown);
            this.canvas.addEventListener("mouseup", this._whenCursorReleased);
            // this.canvas.addEventListener("mouseleave", this._whenCursorReleased);

            this.canvas.addEventListener("touchstart", this._whenTouchPressed);
            this.canvas.addEventListener("touchmove", this._whenTouchMoved);
            this.canvas.addEventListener("touchend", this._whenCursorReleased);
            this.canvas.addEventListener("touchcancel", this._whenCursorReleased);
        }

        this.redrawCanvas();
    }

    public storeChange = (): void => {
        // Check if change is unique compared to the current history state
        var sameCheck = true;
        if (this._changeQueue.length > 0) {
            sameCheck = this.sequence.isSame(this._changeQueue[this._undoHistoryState]);
        }

        if (sameCheck == false || this._changeQueue.length == 0) {
            // Create new branch in history, removing all after this in time
            this._changeQueue.splice(0, this._undoHistoryState);

            this._undoHistoryState = 0;

            this._changeQueue.unshift(this.sequence.copy());

            // 32 undo max
            if (this._changeQueue.length > 32) {
                this._changeQueue.pop();
            }
        }
    }

    public undo = (): void => {
        // Go backward, if there is a change to go back to
        if (this._undoHistoryState < this._changeQueue.length - 1) {
            this._undoHistoryState++;
            this.sequence = this._changeQueue[this._undoHistoryState];
        }
    }

    public redo = (): void => {
        // Go forward, if there is a change to go to
        if (this._undoHistoryState > 0) {
            this._undoHistoryState--;
            this.sequence = this._changeQueue[this._undoHistoryState];
        }
    }

    public redrawCanvas(): void {
        const sequenceData: SequenceSettings = this._changeQueue[this._undoHistoryState];
        const renderColor: string = ColorConfig.getComputedChannelColor(this._doc.song, this._doc.channel).primaryNote;

        // Check if the data has changed from the last render.
        let needsRedraw: boolean = false;
        if (renderColor != this.renderedColor) {
            needsRedraw = true;
        } else {
            needsRedraw = this.sequence.isSame(sequenceData)
        }
        if (!needsRedraw) {
            return;
        }

        this.storeChange();

        var ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;

        // Black BG
        ctx.fillStyle = ColorConfig.getComputed("--editor-background");
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        //waveform
        ctx.fillStyle = renderColor;
        if (this.sequence.interpolated) {
            for (let i: number = 0; i < this.sequence.length; i++) {
                const h: number = this.sequence.values[i] / this.sequence.height * this.canvasHeight;
                const h2: number = i + 1 == this.sequence.length ? !this.sequence.looped ? h : this.sequence.values[0] / this.sequence.height * this.canvasHeight : this.sequence.values[i + 1] / this.sequence.height * this.canvasHeight;
                //draw trapezoid instead
                ctx.beginPath();
                ctx.moveTo(i * this.canvasWidth / this.sequence.length, this.canvasHeight);
                ctx.lineTo(i * this.canvasWidth / this.sequence.length, this.canvasHeight - h);
                ctx.lineTo((i + 1) * this.canvasWidth / this.sequence.length, this.canvasHeight - h2);
                ctx.lineTo((i + 1) * this.canvasWidth / this.sequence.length, this.canvasHeight);
                ctx.closePath();
                ctx.fill();
            }
        } else {
            for (let i: number = 0; i < this.sequence.length; i++) {
                const h: number = this.sequence.values[i] / this.sequence.height * this.canvasHeight;
                ctx.fillRect(i * this.canvasWidth / this.sequence.length, this.canvasHeight - h, this.canvasWidth / this.sequence.length, h);
            }
        }

        //horizontal divisor lines
        ctx.fillStyle = ColorConfig.getComputed("--editor-background");
        for (let i: number = 0; i < this.sequence.height; i++) {
            const h: number = i / this.sequence.height * this.canvasHeight;
            ctx.fillRect(0, h, this.canvasWidth, 1);
        }

        //vertical divisor lines
        ctx.fillStyle = ColorConfig.getComputed("--ui-widget-background");
        for (let i: number = 0; i < this.sequence.length; i++) {
            ctx.fillRect(i * this.canvasWidth / this.sequence.length, 0, 1, this.canvasHeight);
        }
    }

    private _onCursorMove = (): void => {
        if (this._mouseDown) {

            if (this._mouseY < 2) this._mouseY = 2;
            if (this._mouseY > this.canvasHeight - 2) this._mouseY = this.canvasHeight;

            this.sequence.values[Math.floor(this._mouseX * this.sequence.length / this.canvasWidth)] = Math.round(this.sequence.height - this._mouseY * this.sequence.height / this.canvasHeight);
            new ChangeSequenceValues(this._doc, this.sequenceIndex, this.sequence.values);

            this.redrawCanvas();
        }
    }

    private _onMouseDown = (event: MouseEvent): void => {
        this._mouseDown = true;
        this._mouseX = (event.clientX || event.pageX) - this.canvas.getBoundingClientRect().left;
        this._mouseY = Math.floor((event.clientY || event.pageY) - this.canvas.getBoundingClientRect().top);

        // Allow single-click edit
        this._onCursorMove();
    }

    private _whenTouchPressed = (event: TouchEvent): void => {
        event.preventDefault();
        this._mouseDown = true;
        this._mouseX = event.touches[0].clientX - this.canvas.getBoundingClientRect().left;
        this._mouseY = Math.floor(event.touches[0].clientY - this.canvas.getBoundingClientRect().top);

        // Allow single-click edit
        this._onCursorMove();
    }

    private _onMouseMove = (event: MouseEvent): void => {
        this._mouseX = (event.clientX || event.pageX) - this.canvas.getBoundingClientRect().left;
        this._mouseY = Math.floor((event.clientY || event.pageY) - this.canvas.getBoundingClientRect().top);
        this._onCursorMove();
    }

    private _whenTouchMoved = (event: TouchEvent): void => {
        if (!this._mouseDown) return;
        event.preventDefault();
        this._mouseX = event.touches[0].clientX - this.canvas.getBoundingClientRect().left;
        this._mouseY = Math.floor(event.touches[0].clientY - this.canvas.getBoundingClientRect().top);
        this._onCursorMove();
    }

    private _whenCursorReleased = (): void => {
        this._mouseDown = false;
    }
}

export class SequenceEditorPrompt implements Prompt {
    private readonly _sequenceEditor: SequenceEditor = new SequenceEditor(this._doc, this.sequenceIndex, true);

    private readonly _sequenceHeight: HTMLInputElement = input({ value: this._sequenceEditor.sequence.height, style: "width: 4em; font-size: 80%; ", id: "sequenceHeightInput", type: "number", step: "1", min: "0", max: Config.envelopeSequenceHeightMax });
    private readonly _sequenceLength: HTMLInputElement = input({ value: this._sequenceEditor.sequence.length, style: "width: 4em; font-size: 80%; ", id: "sequenceLengthInput", type: "number", step: "1", min: "0", max: Config.envelopeSequenceLengthMax });
    private readonly _sequenceInterpolates: HTMLInputElement = input({ type: "checkbox", style: "width: 1em; padding: 0.5em; margin-left: 1.5em;", id: "sequenceInterpolatesCheckbox" });
    private readonly _sequenceLoops: HTMLInputElement = input({ type: "checkbox", style: "width: 1em; padding: 0.5em; margin-left: 1.5em;", id: "sequenceLoopsCheckbox" });

    private readonly _cancelButton: HTMLButtonElement = button({ class: "cancelButton" });
    private readonly _okayButton: HTMLButtonElement = button({ class: "okayButton", style: "width:45%;" }, "Okay");
    public readonly _playButton: HTMLButtonElement = button({ style: "width: 55%;", type: "button" });

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
    public readonly container: HTMLDivElement = div({ class: "prompt noSelection", style: "width: 500px;" },
        h2("Edit Sequence Instrument"),
        div({ style: "display: flex; width: 55%; align-self: center; flex-direction: row; align-items: center; justify-content: center;" },
            this._playButton,
        ),
        div({ style: "display: flex; flex-direction: row; align-items: center; justify-content: center; height: 200px" },
            this._sequenceEditor.canvas
        ),
        div({ style: "display: flex; flex-direction: row; justify-content: center;" },
            div({ style: "display: flex; flex-direction: column; justify-content: space-between;" },
                div({ style: "display: flex; flex-direction: row; justify-content: right;" }, span("Height: "), this._sequenceHeight),
                div({ style: "display: flex; flex-direction: row; justify-content: right;" }, span("Length: "), this._sequenceLength)
            ),
            div({ style: "display: flex; flex-direction: column; justify-content: space-between;" },
                div({ style: "display: flex; flex-direction: row; justify-content: right;" }, span("Interpolates: "), this._sequenceInterpolates),
                div({ style: "display: flex; flex-direction: row; justify-content: right;" }, span("Loops: "), this._sequenceLoops)
            ),
        ),
        p({ style: "display: flex; flex-direction: row; align-items: center; justify-content: center;" }, "Note that editing this sequence will update it in every place it is used"),
        div({ style: "display: flex; flex-direction: row-reverse; justify-content: space-between;" },
            this._okayButton,
            this.copyPasteContainer,
        ),
        this._cancelButton,
    );

    private readonly _oldWaveform: number;

    constructor(private _doc: SongDocument, private _editor: SongEditor, private sequenceIndex: number, private forEnvelope: number) {
        if (!this.sequenceIndex) this.sequenceIndex = 0;
        const instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
        this._oldWaveform = instrument.envelopes[this.forEnvelope].waveform;
        new ChangeSetEnvelopeWaveform(this._doc, this.sequenceIndex, this.forEnvelope);
        this._sequenceInterpolates.checked = this._sequenceEditor.sequence.interpolated;
        this._sequenceLoops.checked = this._sequenceEditor.sequence.looped;
        this._okayButton.addEventListener("click", this._saveChanges);
        this._cancelButton.addEventListener("click", this._close);
        this.container.addEventListener("keydown", this.whenKeyPressed);
        this.copyButton.addEventListener("click", this._copySettings);
        this.pasteButton.addEventListener("click", this._pasteSettings);
        this._playButton.addEventListener("click", this._togglePlay);
        this._sequenceHeight.addEventListener("change", this._updateHeight);
        this._sequenceLength.addEventListener("change", this._updateLength);
        this._sequenceInterpolates.addEventListener("change", this._updateBooleans);
        this._sequenceLoops.addEventListener("change", this._updateBooleans);
        this.updatePlayButton();
        setTimeout(() => this._playButton.focus());
    }

    private _updateHeight = (): void => {
        new ChangeSequenceHeight(this._doc, this.sequenceIndex, parseInt(this._sequenceHeight.value));
        this._sequenceEditor.sequence.height = parseInt(this._sequenceHeight.value);
        this._sequenceEditor.redrawCanvas();
    }

    private _updateLength = (): void => {
        new ChangeSequenceLength(this._doc, this.sequenceIndex, parseInt(this._sequenceLength.value));
        this._sequenceEditor.sequence.length = parseInt(this._sequenceLength.value);
        this._sequenceEditor.redrawCanvas();
    }

    private _updateBooleans = (): void => {
        new ChangeSequenceBooleans(this._doc, this.sequenceIndex, this._sequenceInterpolates.checked, this._sequenceLoops.checked);
        this._sequenceEditor.sequence.interpolated = this._sequenceInterpolates.checked;
        this._sequenceEditor.sequence.looped = this._sequenceLoops.checked;
        this._sequenceEditor.redrawCanvas();
    }

    private _togglePlay = (): void => {
        this._editor.togglePlay();
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
        new ChangeSetEnvelopeWaveform(this._doc, this._oldWaveform, this.forEnvelope);
        this._sequenceEditor.sequence = this._sequenceEditor.originalSequence;
        new ChangeUpdateSequence(this._doc, this.sequenceIndex, this._sequenceEditor.sequence);
    }

    public cleanUp = (): void => {
        this._okayButton.removeEventListener("click", this._saveChanges);
        this._cancelButton.removeEventListener("click", this._close);
        this.container.removeEventListener("keydown", this.whenKeyPressed);
        this._playButton.removeEventListener("click", this._togglePlay);
        this._sequenceInterpolates.removeEventListener("change", this._updateBooleans);
        this._sequenceLoops.removeEventListener("change", this._updateBooleans);
    }

    private _copySettings = (): void => {
        window.localStorage.setItem("sequenceCopy", JSON.stringify(this._sequenceEditor.sequence.toJsonObject()));
    }

    private _pasteSettings = (): void => {
        const storedSequenceWave: any = JSON.parse(String(window.localStorage.getItem("sequenceCopy")));
        this._sequenceEditor.sequence.fromJsonObject(storedSequenceWave, Config.jsonFormat);
        this._sequenceHeight.value = this._sequenceEditor.sequence.height + "";
        this._sequenceLength.value = this._sequenceEditor.sequence.length + "";
        new ChangeUpdateSequence(this._doc, this.sequenceIndex, this._sequenceEditor.sequence);
        this._sequenceEditor.redrawCanvas();
    }

    public whenKeyPressed = (event: KeyboardEvent): void => {
        if ((<Element>event.target).tagName != "BUTTON" && event.keyCode == 13) { // Enter key
            this._saveChanges();
        } else if (event.keyCode == 32) {
            this._togglePlay();
            event.preventDefault();
        } else if (event.keyCode == 90) { // z
            this._sequenceEditor.undo();
            event.stopPropagation();
        } else if (event.keyCode == 89) { // y
            this._sequenceEditor.redo();
            event.stopPropagation();
        } else if (event.keyCode == 219) { // [
            this._doc.synth.goToPrevBar();
        } else if (event.keyCode == 221) { // ]
            this._doc.synth.goToNextBar();
        }
    }

    private _saveChanges = (): void => {
        // Save again just in case
        const group: ChangeGroup = new ChangeGroup();
        group.append(new ChangeAddNewSequence(this._doc, this.sequenceIndex));
        group.append(new ChangeSequenceHeight(this._doc, this.sequenceIndex, this._sequenceEditor.sequence.height));
        group.append(new ChangeSequenceLength(this._doc, this.sequenceIndex, this._sequenceEditor.sequence.length));
        group.append(new ChangeSequenceValues(this._doc, this.sequenceIndex, this._sequenceEditor.sequence.values, true));
        group.append(new ChangeSequenceBooleans(this._doc, this.sequenceIndex, this._sequenceInterpolates.checked, this._sequenceLoops.checked));
        // const instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
        // instrument.envelopes[this.forEnvelope].waveform = -1;
        if (this.forEnvelope !== undefined) group.append(new ChangeSetEnvelopeWaveform(this._doc, this.sequenceIndex, this.forEnvelope));
        this._doc.record(group, true);
        this._editor.envelopeEditor.rerenderExtraSettings();
        this._doc.prompt = null;
    }
}