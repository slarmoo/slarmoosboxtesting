import { Config } from "../synth/SynthConfig";
import { Prompt } from "./Prompt";
import { HTML, SVG } from "imperative-html/dist/esm/elements-strict";
import { SongDocument } from "./SongDocument"
import { ChangeGroup } from "./Change";
import { SequenceSettings } from "../synth/synth";
import { ChangeAddNewSequence, ChangeSequenceHeight, ChangeSequenceLength, ChangeSequenceValues, ChangeSetEnvelopeWaveform } from "./changes";
import { ColorConfig } from "./ColorConfig";
import { SongEditor } from "./SongEditor";

class SequenceEditor {
    public sequence: SequenceSettings;

    private _undoHistoryState: number = 0;
    private _changeQueue: SequenceSettings[] = [];

    private _mouseX: number = 0;
    private _mouseY: number = 0;
    private _mouseDown: boolean = false;

    private canvasHeight: number = 104;
    private canvasWidth: number = 256;

    public canvas: HTMLCanvasElement = HTML.canvas({ width: this.canvasWidth, height: this.canvasHeight, style: "border:2px solid " + ColorConfig.uiWidgetBackground, id: "customWaveDrawCanvas" });
    private renderedColor: string = "";

    

    constructor(private _doc: SongDocument, private sequenceIndex: number) {
        if (!this.sequenceIndex) this.sequenceIndex = 0;
        if (this.sequenceIndex >= this._doc.song.sequences.length) {
            this.sequence = new SequenceSettings();
            this._doc.song.sequences[this.sequenceIndex] = this.sequence.copy();
        } else {
            this.sequence = this._doc.song.sequences[this.sequenceIndex].copy();
        }

        

        this.canvas.addEventListener("mousemove", this._onMouseMove);
        this.canvas.addEventListener("mousedown", this._onMouseDown);
        this.canvas.addEventListener("mouseup", this._whenCursorReleased);
        // this.canvas.addEventListener("mouseleave", this._whenCursorReleased);

        this.canvas.addEventListener("touchstart", this._whenTouchPressed);
        this.canvas.addEventListener("touchmove", this._whenTouchMoved);
        this.canvas.addEventListener("touchend", this._whenCursorReleased);
        this.canvas.addEventListener("touchcancel", this._whenCursorReleased);

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

        //divisorlines
        ctx.fillStyle = ColorConfig.getComputed("--ui-widget-background");
        for (let i: number = 0; i < this.sequence.length; i++) {
            ctx.fillRect(i * this.canvasWidth / this.sequence.length, 0, 1, this.canvasHeight);
        }

        //waveform
        ctx.fillStyle = renderColor;
        for (let i: number = 0; i < this.sequence.length; i++) {
            const h: number = this.sequence.values[i] / this.sequence.height * this.canvasHeight;
            ctx.fillRect(i * this.canvasWidth / this.sequence.length, this.canvasHeight-h, this.canvasWidth / this.sequence.length, h);
        }
    }

    private _onCursorMove = (): void => {
        if (this._mouseDown) {

            if (this._mouseY < 2) this._mouseY = 2;
            if (this._mouseY > this.canvasHeight - 2) this._mouseY = this.canvasHeight;

            this.sequence.values[Math.floor(this._mouseX * this.sequence.length / this.canvasWidth)] = Math.round(this.sequence.height - this._mouseY * this.sequence.height / this.canvasHeight);

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
    private readonly _sequenceEditor: SequenceEditor = new SequenceEditor(this._doc, this.sequenceIndex);

    private readonly _sequenceHeight: HTMLInputElement = HTML.input({ value: this._sequenceEditor.sequence.height, style: "width: 4em; font-size: 80%; ", id: "sequenceHeightInput", type: "number", step: "1", min: "0", max: Config.envelopeSequenceHeightMax });
    private readonly _sequenceLength: HTMLInputElement = HTML.input({ value: this._sequenceEditor.sequence.length, style: "width: 4em; font-size: 80%; ", id: "sequenceLengthInput", type: "number", step: "1", min: "0", max: Config.envelopeSequenceLengthMax });

    private readonly _cancelButton: HTMLButtonElement = HTML.button({ class: "cancelButton" });
    private readonly _okayButton: HTMLButtonElement = HTML.button({ class: "okayButton", style: "width:45%;" }, "Okay");

    private readonly copyButton: HTMLButtonElement = HTML.button({ style: "width:86px; margin-right: 5px;", class: "copyButton" }, [
        "Copy",
        // Copy icon:
        SVG.svg({ style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "2em", height: "2em", viewBox: "-5 -21 26 26" }, [
            SVG.path({ d: "M 0 -15 L 1 -15 L 1 0 L 13 0 L 13 1 L 0 1 L 0 -15 z M 2 -1 L 2 -17 L 10 -17 L 14 -13 L 14 -1 z M 3 -2 L 13 -2 L 13 -12 L 9 -12 L 9 -16 L 3 -16 z", fill: "currentColor" }),
        ]),
    ]);
    private readonly pasteButton: HTMLButtonElement = HTML.button({ style: "width:86px;", class: "pasteButton" }, [
        "Paste",
        // Paste icon:
        SVG.svg({ style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "2em", height: "2em", viewBox: "0 0 26 26" }, [
            SVG.path({ d: "M 8 18 L 6 18 L 6 5 L 17 5 L 17 7 M 9 8 L 16 8 L 20 12 L 20 22 L 9 22 z", stroke: "currentColor", fill: "none" }),
            SVG.path({ d: "M 9 3 L 14 3 L 14 6 L 9 6 L 9 3 z M 16 8 L 20 12 L 16 12 L 16 8 z", fill: "currentColor", }),
        ]),
    ]);
    private readonly copyPasteContainer: HTMLDivElement = HTML.div({ style: "width: 185px;" }, this.copyButton, this.pasteButton);
    public readonly container: HTMLDivElement = HTML.div({ class: "prompt noSelection", style: "width: 500px;" },
        HTML.h2("Edit Sequence Instrument"),
        HTML.div({ style: "display: flex; flex-direction: row; align-items: center; justify-content: center; height: 200px" },
            this._sequenceEditor.canvas
        ),
        HTML.div({ style: "display: flex; flex-direction: column; justify-content: space-between;" },
            HTML.div({ style: "display: flex; flex-direction: row; justify-content: center;" },
                HTML.span("Height: "), this._sequenceHeight),
            HTML.div({ style: "display: flex; flex-direction: row; justify-content: center;" },
            HTML.span("Length: "), this._sequenceLength)
        ),
        HTML.div({ style: "display: flex; flex-direction: row-reverse; justify-content: space-between;" },
            this._okayButton,
            this.copyPasteContainer,
        ),
        this._cancelButton,
    );

    constructor(private _doc: SongDocument, private _editor: SongEditor, private sequenceIndex: number, private forEnvelope: number) {
        if (!this.sequenceIndex) this.sequenceIndex = 0;
        this._okayButton.addEventListener("click", this._saveChanges);
        this._cancelButton.addEventListener("click", this._close);
        this.container.addEventListener("keydown", this.whenKeyPressed);
        this.copyButton.addEventListener("click", this._copySettings);
        this.pasteButton.addEventListener("click", this._pasteSettings);
        this._sequenceHeight.addEventListener("change", this._updateHeight);
        this._sequenceLength.addEventListener("change", this._updateLength);
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

    private _close = (): void => {
        this._doc.prompt = null;
        this._doc.undo();

        const instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
        if (!this.forEnvelope == undefined) instrument.envelopes[this.forEnvelope].waveform = 0;
    }

    public cleanUp = (): void => {
        this._okayButton.removeEventListener("click", this._saveChanges);
        this._cancelButton.removeEventListener("click", this._close);
        this.container.removeEventListener("keydown", this.whenKeyPressed);
    }

    private _copySettings = (): void => {
        window.localStorage.setItem("sequenceCopy", JSON.stringify(this._sequenceEditor.sequence.toJsonObject()));
    }

    private _pasteSettings = (): void => {
        const storedSequenceWave: any = JSON.parse(String(window.localStorage.getItem("sequenceCopy")));
        this._sequenceEditor.sequence.fromJsonObject(storedSequenceWave, Config.jsonFormat);
        this._sequenceEditor.redrawCanvas();
    }

    public whenKeyPressed = (event: KeyboardEvent): void => {
        if ((<Element>event.target).tagName != "BUTTON" && event.keyCode == 13) { // Enter key
            this._saveChanges();
        }
        else if (event.keyCode == 90) { // z
            this._sequenceEditor.undo();
            event.stopPropagation();
        }
        else if (event.keyCode == 89) { // this._mouseY
            this._sequenceEditor.redo();
            event.stopPropagation();
        }
    }

    private _saveChanges = (): void => {
        // Save again just in case
        const group: ChangeGroup = new ChangeGroup();
        group.append(new ChangeAddNewSequence(this._doc, this.sequenceIndex));
        group.append(new ChangeSequenceHeight(this._doc, this.sequenceIndex, this._sequenceEditor.sequence.height));
        group.append(new ChangeSequenceLength(this._doc, this.sequenceIndex, this._sequenceEditor.sequence.length));
        group.append(new ChangeSequenceValues(this._doc, this.sequenceIndex, this._sequenceEditor.sequence.values));
        // const instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
        // instrument.envelopes[this.forEnvelope].waveform = -1;
        if (this.forEnvelope !== undefined) group.append(new ChangeSetEnvelopeWaveform(this._doc, this.sequenceIndex, this.forEnvelope));
        this._doc.record(group, true);
        this._editor.envelopeEditor.rerenderExtraSettings();
        this._doc.prompt = null;
    }
}