// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { Config } from "../synth/SynthConfig";
import { SpectrumWave, Instrument } from "../synth/song";
import { SongDocument } from "./SongDocument";
import { HTML, SVG } from "imperative-html/dist/esm/elements-strict";
import { ColorConfig } from "./ColorConfig";
import { ChangeSpectrum } from "./changes";
import { prettyNumber } from "./EditorConfig";

const { div } = HTML;
const { svg, path, rect } = SVG;

export class SpectrumEditor {
    private readonly _editorWidth: number = 120;
    private readonly _editorHeight: number = 26;
    private readonly _fill: SVGPathElement = path({ fill: ColorConfig.uiWidgetBackground, "pointer-events": "none" });
    private readonly _octaves: SVGSVGElement = svg({ "pointer-events": "none" });
    private readonly _fifths: SVGSVGElement = svg({ "pointer-events": "none" });
    private readonly _curve: SVGPathElement = path({ fill: "none", stroke: "currentColor", "stroke-width": 2, "pointer-events": "none" });
    private readonly _arrow: SVGPathElement = path({ fill: "currentColor", "pointer-events": "none" });
    private readonly _svg: SVGSVGElement = svg({ style: `background-color: ${ColorConfig.editorBackground}; touch-action: none; cursor: crosshair;`, width: "100%", height: "100%", viewBox: "0 0 " + this._editorWidth + " " + this._editorHeight, preserveAspectRatio: "none" },
        this._fill,
        this._octaves,
        this._fifths,
        this._curve,
        this._arrow,
    );

    public readonly container: HTMLElement = div({ class: "spectrum", style: "height: 100%;" }, this._svg);

    private _mouseX: number = 0;
    private _mouseY: number = 0;
    private _freqPrev: number = 0;
    private _ampPrev: number = 0;
    private _mouseDown: boolean = false;
    private _change: ChangeSpectrum | null = null;
    private _renderedPath: String = "";
    private _renderedFifths: boolean = true;
    private instrument: Instrument;
    // private _initial: SpectrumWave = new SpectrumWave(this._spectrumIndex != null);

    private _undoHistoryState: number = 0;
    private _changeQueue: number[][] = [];

    private _doc: SongDocument;

    constructor(_doc: SongDocument, private _spectrumIndex: number | null, private _isPrompt: boolean = false) {
        this._doc = _doc;
        this.instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
        // this._initial.spectrum = this._spectrumIndex == null ? this.instrument.spectrumWave.spectrum.slice() : this.instrument.drumsetSpectrumWaves[this._spectrumIndex].spectrum.slice();
        for (let i: number = 0; i < Config.spectrumControlPoints; i += Config.spectrumControlPointsPerOctave) {
            this._octaves.appendChild(rect({ fill: ColorConfig.tonic, x: (i + 1) * this._editorWidth / (Config.spectrumControlPoints + 2) - 1, y: 0, width: 2, height: this._editorHeight }));
        }
        for (let i: number = 4; i <= Config.spectrumControlPoints; i += Config.spectrumControlPointsPerOctave) {
            this._fifths.appendChild(rect({ fill: ColorConfig.fifthNote, x: (i + 1) * this._editorWidth / (Config.spectrumControlPoints + 2) - 1, y: 0, width: 2, height: this._editorHeight }));
        }

        this.storeChange();

        this.container.addEventListener("mousedown", this._whenMousePressed);
        document.addEventListener("mousemove", this._whenMouseMoved);
        document.addEventListener("mouseup", this._whenCursorReleased);

        this.container.addEventListener("touchstart", this._whenTouchPressed);
        this.container.addEventListener("touchmove", this._whenTouchMoved);
        this.container.addEventListener("touchend", this._whenCursorReleased);
        this.container.addEventListener("touchcancel", this._whenCursorReleased);
    }

    public storeChange = (): void => {
        // Check if change is unique compared to the current history state
        var sameCheck = true;
        if (this._changeQueue.length > 0) {
            for (var i = 0; i < Config.spectrumControlPoints; i++) {
                if (this._changeQueue[this._undoHistoryState][i] != this.instrument.spectrumWave.spectrum[i]) {
                    sameCheck = false; i = Config.spectrumControlPoints;
                }
            }
        }

        if (sameCheck == false || this._changeQueue.length == 0) {

            // Create new branch in history, removing all after this in time
            this._changeQueue.splice(0, this._undoHistoryState);

            this._undoHistoryState = 0;

            this._changeQueue.unshift(this.instrument.spectrumWave.spectrum.slice());

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
            const spectrum: number[] = this._changeQueue[this._undoHistoryState].slice();
            this.setSpectrumWave(spectrum);
        }

    }

    public redo = (): void => {
        // Go forward, if there is a change to go to
        if (this._undoHistoryState > 0) {
            this._undoHistoryState--;
            const spectrum: number[] = this._changeQueue[this._undoHistoryState].slice();
            this.setSpectrumWave(spectrum);
        }

    }

    private _xToFreq(x: number): number {
        return (Config.spectrumControlPoints + 2) * x / this._editorWidth - 1;
    }

    private _yToAmp(y: number): number {
        return Config.spectrumMax * (1 - (y - 1) / (this._editorHeight - 2));
    }

    private _whenMousePressed = (event: MouseEvent): void => {
        event.preventDefault();
        this._mouseDown = true;
        const boundingRect: ClientRect = this._svg.getBoundingClientRect();
        this._mouseX = ((event.clientX || event.pageX) - boundingRect.left) * this._editorWidth / (boundingRect.right - boundingRect.left);
        this._mouseY = ((event.clientY || event.pageY) - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
        if (isNaN(this._mouseX)) this._mouseX = 0;
        if (isNaN(this._mouseY)) this._mouseY = 0;

        this._freqPrev = this._xToFreq(this._mouseX);
        this._ampPrev = this._yToAmp(this._mouseY);
        this._whenCursorMoved();
    }

    private _whenTouchPressed = (event: TouchEvent): void => {
        event.preventDefault();
        this._mouseDown = true;
        const boundingRect: ClientRect = this._svg.getBoundingClientRect();
        this._mouseX = (event.touches[0].clientX - boundingRect.left) * this._editorWidth / (boundingRect.right - boundingRect.left);
        this._mouseY = (event.touches[0].clientY - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
        if (isNaN(this._mouseX)) this._mouseX = 0;
        if (isNaN(this._mouseY)) this._mouseY = 0;

        this._freqPrev = this._xToFreq(this._mouseX);
        this._ampPrev = this._yToAmp(this._mouseY);
        this._whenCursorMoved();
    }

    private _whenMouseMoved = (event: MouseEvent): void => {
        if (this.container.offsetParent == null) return;
        const boundingRect: ClientRect = this._svg.getBoundingClientRect();
        this._mouseX = ((event.clientX || event.pageX) - boundingRect.left) * this._editorWidth / (boundingRect.right - boundingRect.left);
        this._mouseY = ((event.clientY || event.pageY) - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
        if (isNaN(this._mouseX)) this._mouseX = 0;
        if (isNaN(this._mouseY)) this._mouseY = 0;
        this._whenCursorMoved();
    }

    private _whenTouchMoved = (event: TouchEvent): void => {
        if (this.container.offsetParent == null) return;
        if (!this._mouseDown) return;
        event.preventDefault();
        const boundingRect: ClientRect = this._svg.getBoundingClientRect();
        this._mouseX = (event.touches[0].clientX - boundingRect.left) * this._editorWidth / (boundingRect.right - boundingRect.left);
        this._mouseY = (event.touches[0].clientY - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
        if (isNaN(this._mouseX)) this._mouseX = 0;
        if (isNaN(this._mouseY)) this._mouseY = 0;
        this._whenCursorMoved();
        this.render();
    }

    private _whenCursorMoved(): void {
        if (this._mouseDown) {
            const freq: number = this._xToFreq(this._mouseX);
            const amp: number = this._yToAmp(this._mouseY);

            const instrument: Instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
            const spectrumWave: SpectrumWave = (this._spectrumIndex == null) ? instrument.spectrumWave : instrument.drumsetSpectrumWaves[this._spectrumIndex];

            if (freq != this._freqPrev) {
                const slope: number = (amp - this._ampPrev) / (freq - this._freqPrev);
                const offset: number = this._ampPrev - this._freqPrev * slope;
                const lowerFreq: number = Math.ceil(Math.min(this._freqPrev, freq));
                const upperFreq: number = Math.floor(Math.max(this._freqPrev, freq));
                for (let i: number = lowerFreq; i <= upperFreq; i++) {
                    if (i < 0 || i >= Config.spectrumControlPoints) continue;
                    spectrumWave.spectrum[i] = Math.max(0, Math.min(Config.spectrumMax, Math.round(i * slope + offset)));
                }
            }

            spectrumWave.spectrum[Math.max(0, Math.min(Config.spectrumControlPoints - 1, Math.round(freq)))] = Math.max(0, Math.min(Config.spectrumMax, Math.round(amp)));

            this._freqPrev = freq;
            this._ampPrev = amp;

            this._change = new ChangeSpectrum(this._doc, instrument, spectrumWave, this._spectrumIndex);
            this._doc.setProspectiveChange(this._change);
        }
    }

    private _whenCursorReleased = (event: Event): void => {
        if (this._mouseDown) {
            if (!this._isPrompt) {
                this._doc.record(this._change!);
            }
            this.storeChange();
            this._change = null;
        }
        this._mouseDown = false;
    }

    public getSpectrumWave(): SpectrumWave {
        const instrument: Instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
        if (this._spectrumIndex == null) {
            return instrument.spectrumWave;
        } else {
            return instrument.drumsetSpectrumWaves[this._spectrumIndex];
        }
    }

    public setSpectrumWave(spectrum: number[], saveHistory: boolean = false) {
        const instrument: Instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
        if (this._spectrumIndex == null) {
            for (let i = 0; i < Config.spectrumControlPoints; i++) {
                instrument.spectrumWave.spectrum[i] = spectrum[i];
            }
            const spectrumChange: ChangeSpectrum = new ChangeSpectrum(this._doc, instrument, instrument.spectrumWave, this._spectrumIndex);
            if (saveHistory) {
                this._doc.record(spectrumChange);
            }
        } else {
            for (let i = 0; i < Config.spectrumControlPoints; i++) {
                instrument.drumsetSpectrumWaves[this._spectrumIndex].spectrum[i] = spectrum[i];
            }
            const spectrumChange: ChangeSpectrum = new ChangeSpectrum(this._doc, instrument, instrument.drumsetSpectrumWaves[this._spectrumIndex], this._spectrumIndex);
            if (saveHistory) {
                this._doc.record(spectrumChange);
            }
        }
        this.render();
    }

    public saveSettings(): ChangeSpectrum {
        const instrument: Instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
        if (this._spectrumIndex == null || this._spectrumIndex == undefined) {
            return new ChangeSpectrum(this._doc, instrument, instrument.spectrumWave, this._spectrumIndex);
        } else {
            return new ChangeSpectrum(this._doc, instrument, instrument.drumsetSpectrumWaves[this._spectrumIndex], this._spectrumIndex);
        }
    }

    public resetToInitial() {
        this._changeQueue = [];
        this._undoHistoryState = 0;
    }

    public render(): void {
        const instrument: Instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
        const spectrumWave: SpectrumWave = (this._spectrumIndex == null) ? instrument.spectrumWave : instrument.drumsetSpectrumWaves[this._spectrumIndex];
        const controlPointToHeight = (point: number): number => {
            return (1 - (point / Config.spectrumMax)) * (this._editorHeight - 1) + 1;
        }

        let lastValue: number = 0;
        let path: string = "M 0 " + prettyNumber(this._editorHeight) + " ";
        for (let i: number = 0; i < Config.spectrumControlPoints; i++) {
            let nextValue: number = spectrumWave.spectrum[i];
            if (lastValue != 0 || nextValue != 0) {
                path += "L ";
            } else {
                path += "M ";
            }
            path += prettyNumber((i + 1) * this._editorWidth / (Config.spectrumControlPoints + 2)) + " " + prettyNumber(controlPointToHeight(nextValue)) + " ";
            lastValue = nextValue;
        }

        const lastHeight: number = controlPointToHeight(lastValue);
        if (lastValue > 0) {
            path += "L " + (this._editorWidth - 1) + " " + prettyNumber(lastHeight) + " ";
        }

        if (this._renderedPath != path) {
            this._renderedPath = path;
            this._curve.setAttribute("d", path);
            this._fill.setAttribute("d", path + "L " + this._editorWidth + " " + prettyNumber(lastHeight) + " L " + this._editorWidth + " " + prettyNumber(this._editorHeight) + " L 0 " + prettyNumber(this._editorHeight) + " z ");

            this._arrow.setAttribute("d", "M " + this._editorWidth + " " + prettyNumber(lastHeight) + " L " + (this._editorWidth - 4) + " " + prettyNumber(lastHeight - 4) + " L " + (this._editorWidth - 4) + " " + prettyNumber(lastHeight + 4) + " z");
            this._arrow.style.display = (lastValue > 0) ? "" : "none";
        }
        if (this._renderedFifths != this._doc.prefs.showFifth) {
            this._renderedFifths = this._doc.prefs.showFifth;
            this._fifths.style.display = this._doc.prefs.showFifth ? "" : "none";
        }
    }

    // public reassignDoc(_doc: SongDocument) {
    //     this._doc = _doc;
    // }
}