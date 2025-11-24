import { Change } from "./Change";
import { ColorConfig } from "./ColorConfig";
import { Instrument } from "./main";
import { SongDocument } from "./SongDocument";

export class CustomChipCanvas {
    private mouseDown: boolean;
    private continuousEdit: boolean;
    private lastX: number;
    private lastY: number;
    public newArray: Float32Array;
    public renderedArray: Float32Array;
    public renderedColor: string;

    private _change: Change | null = null;

    constructor(public readonly canvas: HTMLCanvasElement, private readonly _doc: SongDocument, private readonly _getChange: (newArray: Float32Array) => Change) {
        canvas.addEventListener("mousemove", this._onMouseMove);
        canvas.addEventListener("mousedown", this._onMouseDown);
        canvas.addEventListener("mouseup", this._onMouseUp);
        canvas.addEventListener("mouseleave", this._onMouseUp);

        this.mouseDown = false;
        this.continuousEdit = false;
        this.lastX = 0;
        this.lastY = 0;

        this.newArray = new Float32Array(64);
        this.renderedArray = new Float32Array(64);
        this.renderedColor = "";

        // Init waveform
        this.redrawCanvas();

    }

    public redrawCanvas(): void {
        const chipData: Float32Array = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()].customChipWave;
        const renderColor: string = ColorConfig.getComputedChannelColor(this._doc.song, this._doc.channel).primaryNote;

        // Check if the data has changed from the last render.
        let needsRedraw: boolean = false;
        if (renderColor != this.renderedColor) {
            needsRedraw = true;
        } else for (let i: number = 0; i < 64; i++) {
            if (chipData[i] != this.renderedArray[i]) {
                needsRedraw = true;
                i = 64;
            }
        }
        if (!needsRedraw) {
            return;
        }

        this.renderedArray.set(chipData);

        var ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;

        // Black BG
        ctx.fillStyle = ColorConfig.getComputed("--editor-background");
        ctx.fillRect(0, 0, 128, 52);

        // Mid-bar
        ctx.fillStyle = ColorConfig.getComputed("--ui-widget-background");
        ctx.fillRect(0, 25, 128, 2);

        // 25-75 bars
        ctx.fillStyle = ColorConfig.getComputed("--track-editor-bg-pitch-dim");
        ctx.fillRect(0, 13, 128, 1);
        ctx.fillRect(0, 39, 128, 1);

        // Waveform
        ctx.fillStyle = renderColor;

        for (let x: number = 0; x < 64; x++) {
            var y: number = chipData[x] + 26;
            ctx.fillRect(x * 2, y - 2, 2, 4);

            this.newArray[x] = y - 26;
        }
    }

    private _onMouseMove = (event: MouseEvent): void => {
        if (this.mouseDown) {

            var x = (event.clientX || event.pageX) - this.canvas.getBoundingClientRect().left;
            var y = Math.floor((event.clientY || event.pageY) - this.canvas.getBoundingClientRect().top);

            if (y < 2) y = 2;
            if (y > 50) y = 50;

            var ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;

            if (this.continuousEdit == true && Math.abs(this.lastX - x) < 40) {

                var lowerBound = (x < this.lastX) ? x : this.lastX;
                var upperBound = (x < this.lastX) ? this.lastX : x;

                for (let i = lowerBound; i <= upperBound; i += 2) {

                    var progress = (Math.abs(x - this.lastX) > 2.0) ? ((x > this.lastX) ?
                        1.0 - ((i - lowerBound) / (upperBound - lowerBound))
                        : ((i - lowerBound) / (upperBound - lowerBound))) : 0.0;
                    var j = Math.round(y + (this.lastY - y) * progress);

                    ctx.fillStyle = ColorConfig.getComputed("--editor-background");
                    ctx.fillRect(Math.floor(i / 2) * 2, 0, 2, 53);
                    ctx.fillStyle = ColorConfig.getComputed("--ui-widget-background");
                    ctx.fillRect(Math.floor(i / 2) * 2, 25, 2, 2);
                    ctx.fillStyle = ColorConfig.getComputed("--track-editor-bg-pitch-dim");
                    ctx.fillRect(Math.floor(i / 2) * 2, 13, 2, 1);
                    ctx.fillRect(Math.floor(i / 2) * 2, 39, 2, 1);
                    ctx.fillStyle = ColorConfig.getComputedChannelColor(this._doc.song, this._doc.channel).primaryNote;
                    ctx.fillRect(Math.floor(i / 2) * 2, j - 2, 2, 4);

                    // Actually update current instrument's custom waveform
                    this.newArray[Math.floor(i / 2)] = (j - 26);
                }

            }
            else {

                ctx.fillStyle = ColorConfig.getComputed("--editor-background");
                ctx.fillRect(Math.floor(x / 2) * 2, 0, 2, 52);
                ctx.fillStyle = ColorConfig.getComputed("--ui-widget-background");
                ctx.fillRect(Math.floor(x / 2) * 2, 25, 2, 2);
                ctx.fillStyle = ColorConfig.getComputed("--track-editor-bg-pitch-dim");
                ctx.fillRect(Math.floor(x / 2) * 2, 13, 2, 1);
                ctx.fillRect(Math.floor(x / 2) * 2, 39, 2, 1);
                ctx.fillStyle = ColorConfig.getComputedChannelColor(this._doc.song, this._doc.channel).primaryNote;
                ctx.fillRect(Math.floor(x / 2) * 2, y - 2, 2, 4);

                // Actually update current instrument's custom waveform
                this.newArray[Math.floor(x / 2)] = (y - 26);

            }

            this.continuousEdit = true;
            this.lastX = x;
            this.lastY = y;

            // Preview - update integral used for sound synthesis based on new array, not actual stored array. When mouse is released, real update will happen.
            let instrument: Instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];

            let sum: number = 0.0;
            for (let i: number = 0; i < this.newArray.length; i++) {
                sum += this.newArray[i];
            }
            const average: number = sum / this.newArray.length;

            // Perform the integral on the wave. The chipSynth will perform the derivative to get the original wave back but with antialiasing.
            let cumulative: number = 0;
            let wavePrev: number = 0;
            for (let i: number = 0; i < this.newArray.length; i++) {
                cumulative += wavePrev;
                wavePrev = this.newArray[i] - average;
                instrument.customChipWaveIntegral[i] = cumulative;
            }

            instrument.customChipWaveIntegral[64] = 0.0;
        }

    };

    private _onMouseDown = (event: MouseEvent): void => {
        this.mouseDown = true;

        // Allow single-click edit
        this._onMouseMove(event);
    };
    private _onMouseUp = (): void => {
        this.mouseDown = false;
        this.continuousEdit = false;

        this._whenChange();
    };

    private _whenChange = (): void => {
        this._change = this._getChange(this.newArray);

        this._doc.record(this._change!);

        this._change = null;
    };
}
