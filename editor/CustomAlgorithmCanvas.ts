import { Change } from "./Change";
import { ColorConfig } from "./ColorConfig";
import { SongDocument } from "./SongDocument";

export class CustomAlgorithmCanvas {
    private mouseDown: boolean;
    //private continuousEdit: boolean;
    //private lastX: number;
    //private lastY: number;
    public newMods: number[][];
    public lookUpArray: number[][];
    public selected: number;
    public inverseModulation: number[][];
    public feedback: number[][];
    public inverseFeedback: number[][];
    public carriers: number;
    public drawArray: number[][];
    public mode: string;

    private _change: Change | null = null;

    constructor(public readonly canvas: HTMLCanvasElement, private readonly _doc: SongDocument, private readonly _getChange: (newArray: number[][], carry: number, mode: string) => Change) {
        //canvas.addEventListener("input", this._whenInput);
        //canvas.addEventListener("change", this._whenChange);
        canvas.addEventListener("mousemove", this._onMouseMove);
        canvas.addEventListener("mousedown", this._onMouseDown);
        canvas.addEventListener("mouseup", this._onMouseUp);
        canvas.addEventListener("mouseleave", this._onMouseUp);

        this.mouseDown = false;
        //this.continuousEdit = false;
        //this.lastX = 0;
        //this.lastY = 0;
        this.drawArray = [[], [], [], [], [], []];
        this.lookUpArray = [[], [], [], [], [], []];
        this.carriers = 1;
        this.selected = -1;
        this.newMods = [[], [], [], [], [], []];
        this.inverseModulation = [[], [], [], [], [], []];
        this.feedback = [[], [], [], [], [], []];
        this.inverseFeedback = [[], [], [], [], [], []];
        this.mode = "algorithm";

        this.redrawCanvas();

    }

    public reset(): void {
        this.redrawCanvas(false);
        this.selected = -1;
    }

    public fillDrawArray(noReset: boolean = false): void {
        if (noReset) {
            this.drawArray = [];
            this.drawArray = [[], [], [], [], [], []];
            this.inverseModulation = [[], [], [], [], [], []];
            this.lookUpArray = [[], [], [], [], [], []];
            for (let i: number = 0; i < this.newMods.length; i++) {
                for (let o: number = 0; o < this.newMods[i].length; o++) {
                    this.inverseModulation[this.newMods[i][o] - 1].push(i + 1);
                }
            }
            if (this.mode == "feedback") {
                this.inverseFeedback = [[], [], [], [], [], []];
                for (let i: number = 0; i < this.feedback.length; i++) {
                    for (let o: number = 0; o < this.feedback[i].length; o++) {
                        this.inverseFeedback[this.feedback[i][o] - 1].push(i + 1);
                    }
                }
            }
        } else {
            this.drawArray = [];
            this.drawArray = [[], [], [], [], [], []];
            this.carriers = 1;
            this.newMods = [[], [], [], [], [], []];
            this.inverseModulation = [[], [], [], [], [], []];
            this.lookUpArray = [[], [], [], [], [], []];

            var oldMods = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()].customAlgorithm;
            this.carriers = oldMods.carrierCount;
            for (let i: number = 0; i < oldMods.modulatedBy.length; i++) {
                for (let o: number = 0; o < oldMods.modulatedBy[i].length; o++) {
                    this.inverseModulation[oldMods.modulatedBy[i][o] - 1].push(i + 1);
                    this.newMods[i][o] = oldMods.modulatedBy[i][o];
                }
            }
            if (this.mode == "feedback") {
                this.feedback = [[], [], [], [], [], []];
                this.inverseFeedback = [[], [], [], [], [], []];

                var oldfeed = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()].customFeedbackType.indices;
                for (let i: number = 0; i < oldfeed.length; i++) {
                    for (let o: number = 0; o < oldfeed[i].length; o++) {
                        this.inverseFeedback[oldfeed[i][o] - 1].push(i + 1);
                        this.feedback[i][o] = oldfeed[i][o];
                    }
                }
            }
        }
        for (let i: number = 0; i < this.inverseModulation.length; i++) {
            if (i < this.carriers) {
                this.drawArray[this.drawArray.length - 1][i] = i + 1;
                this.lookUpArray[i] = [0, i];
            } else {
                if (this.inverseModulation[i][0] != undefined) {
                    let testPos = [this.drawArray.length - (this.lookUpArray[this.inverseModulation[i][this.inverseModulation[i].length - 1] - 1][0] + 2), this.lookUpArray[this.inverseModulation[i][this.inverseModulation[i].length - 1] - 1][1]];
                    if (this.drawArray[testPos[0]][testPos[1]] != undefined) {
                        while (this.drawArray[testPos[0]][testPos[1]] != undefined && testPos[1] < 6) {
                            testPos[1]++;
                            if (this.drawArray[testPos[0]][testPos[1]] == undefined) {
                                this.drawArray[testPos[0]][testPos[1]] = i + 1;
                                this.lookUpArray[i] = [this.drawArray.length - (testPos[0] + 1), testPos[1]];
                                break;
                            }
                        }
                    } else {
                        this.drawArray[testPos[0]][testPos[1]] = i + 1;
                        this.lookUpArray[i] = [this.drawArray.length - (testPos[0] + 1), testPos[1]];
                    }
                } else {
                    let testPos = [5, 0];
                    while (this.drawArray[testPos[0]][testPos[1]] != undefined && testPos[1] < 6) {
                        testPos[1]++;
                        if (this.drawArray[testPos[0]][testPos[1]] == undefined) {
                            this.drawArray[testPos[0]][testPos[1]] = i + 1;
                            this.lookUpArray[i] = [this.drawArray.length - (testPos[0] + 1), testPos[1]];
                            break;
                        }
                    }
                }
            }
        }
    }

    private drawLines(ctx: CanvasRenderingContext2D): void {
        if (this.mode == "feedback") {
            for (let off: number = 0; off < 6; off++) {
                ctx.strokeStyle = ColorConfig.getArbitaryChannelColor("pitch", off).primaryChannel;
                const set = off * 2 + 0.5;
                for (let i: number = 0; i < this.inverseFeedback[off].length; i++) {
                    let tar: number = this.inverseFeedback[off][i] - 1;
                    let srtpos: number[] = this.lookUpArray[off];
                    let tarpos: number[] = this.lookUpArray[tar];
                    ctx.beginPath();
                    ctx.moveTo(srtpos[1] * 24 + 12 + set, (6 - srtpos[0] - 1) * 24 + 12);
                    ctx.lineTo(srtpos[1] * 24 + 12 + set, (6 - srtpos[0] - 1) * 24 + 12 + set);
                    if (tarpos[1] != srtpos[1]) {
                        let side: number = 0;
                        if (tarpos[0] >= srtpos[0]) {
                            side = 24;
                        }
                        ctx.lineTo(srtpos[1] * 24 + side + set, (6 - srtpos[0] - 1) * 24 + 12 + set);
                        if ((tarpos[1] == (srtpos[1] - 1)) && (tarpos[0] <= (srtpos[0] - 1))) {
                        } else {
                            if (tarpos[0] >= srtpos[0]) {
                                ctx.lineTo((tarpos[1] + 1) * 24 + set, (6 - srtpos[0] - 1) * 24 + 12 + set);
                                ctx.lineTo((tarpos[1] + 1) * 24 + set, (6 - tarpos[0] - 1) * 24 + 12 + set);
                            } else {
                                ctx.lineTo(srtpos[1] * 24 + set, (6 - tarpos[0] - 1) * 24 + 12 + set);
                                ctx.lineTo((tarpos[1] + 1) * 24 + set, (6 - tarpos[0] - 1) * 24 + 12 + set);
                            }
                        }
                        ctx.lineTo((tarpos[1] + 1) * 24 + set, (6 - tarpos[0] - 1) * 24 + set - 12);
                        ctx.lineTo((tarpos[1]) * 24 + 12 + set, (6 - tarpos[0] - 1) * 24 + set - 12);
                        ctx.lineTo((tarpos[1]) * 24 + 12 + set, (6 - tarpos[0] - 1) * 24);
                    } else {
                        if (srtpos[0] - tarpos[0] == 1) {
                            ctx.lineTo((tarpos[1]) * 24 + 12 + set, (6 - tarpos[0] - 1) * 24);
                        } else {
                            if (tarpos[0] >= srtpos[0]) {
                                ctx.lineTo(srtpos[1] * 24 + 24 + set, (6 - srtpos[0] - 1) * 24 + 12 + set);
                                ctx.lineTo(srtpos[1] * 24 + 24 + set, (6 - tarpos[0] - 1) * 24 + set - 12);
                                ctx.lineTo(tarpos[1] * 24 + set + 12, (6 - tarpos[0] - 1) * 24 + set - 12);
                                ctx.lineTo(tarpos[1] * 24 + set + 12, (6 - tarpos[0] - 1) * 24);
                            } else {
                                ctx.lineTo(srtpos[1] * 24 + set, (6 - srtpos[0] - 1) * 24 + 12 + set);
                                ctx.lineTo(srtpos[1] * 24 + set, (6 - tarpos[0] - 1) * 24 + set - 12);
                                ctx.lineTo(tarpos[1] * 24 + 12 + set, (6 - tarpos[0] - 1) * 24 + set - 12);
                                ctx.lineTo(tarpos[1] * 24 + 12 + set, (6 - tarpos[0] - 1) * 24);
                            }
                        }
                    }
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
            return;
        };

        for (let off: number = 0; off < 6; off++) {
            ctx.strokeStyle = ColorConfig.getArbitaryChannelColor("pitch", off).primaryChannel;
            const set = off * 2 - 1 + 0.5;
            for (let i: number = 0; i < this.inverseModulation[off].length; i++) {
                let tar: number = this.inverseModulation[off][i] - 1;
                let srtpos: number[] = this.lookUpArray[off];
                let tarpos: number[] = this.lookUpArray[tar];
                ctx.beginPath();
                ctx.moveTo(srtpos[1] * 24 + 12 + set, (6 - srtpos[0] - 1) * 24 + 12);
                ctx.lineTo(srtpos[1] * 24 + 12 + set, (6 - srtpos[0] - 1) * 24 + 12 + set);
                if ((tarpos[1]) != srtpos[1]) {
                    ctx.lineTo(srtpos[1] * 24 + set, (6 - srtpos[0] - 1) * 24 + 12 + set);
                    if ((tarpos[1] == (srtpos[1] - 1)) && (tarpos[0] <= (srtpos[0] - 1))) {
                    } else {
                        ctx.lineTo(srtpos[1] * 24 + set, (6 - tarpos[0] - 1) * 24 + 12 + set);
                        ctx.lineTo((tarpos[1] + 1) * 24 + set, (6 - tarpos[0] - 1) * 24 + 12 + set);
                    }
                    ctx.lineTo((tarpos[1] + 1) * 24 + set, (6 - tarpos[0] - 1) * 24 + set - 12);
                    ctx.lineTo((tarpos[1]) * 24 + 12 + set, (6 - tarpos[0] - 1) * 24 + set - 12);
                    ctx.lineTo((tarpos[1]) * 24 + 12 + set, (6 - tarpos[0] - 1) * 24);
                } else {
                    if (Math.abs(tarpos[0] - srtpos[0]) == 1) {
                        ctx.lineTo((tarpos[1]) * 24 + 12 + set, (6 - tarpos[0] - 1) * 24);
                    } else {
                        ctx.lineTo(srtpos[1] * 24 + set, (6 - srtpos[0] - 1) * 24 + 12 + set);
                        ctx.lineTo(srtpos[1] * 24 + set, (6 - tarpos[0] - 1) * 24 + set - 12);
                        ctx.lineTo(srtpos[1] * 24 + 12 + set, (6 - tarpos[0] - 1) * 24 + set - 12);
                        ctx.lineTo(srtpos[1] * 24 + 12 + set, (6 - tarpos[0] - 1) * 24);
                    }
                }
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    }

    public redrawCanvas(noReset: boolean = false): void {
        this.fillDrawArray(noReset);
        var ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;

        // Black BG
        ctx.fillStyle = ColorConfig.getComputed("--editor-background");
        ctx.fillRect(0, 0, 144, 144);

        for (let x: number = 0; x < 6; x++) {
            for (let y: number = 0; y < 6; y++) {
                ctx.fillStyle = ColorConfig.getComputed("--track-editor-bg-pitch-dim");
                ctx.fillRect(x * 24 + 12, ((y) * 24), 12, 12);
                ctx.fillStyle = ColorConfig.getComputed("--editor-background");
                ctx.fillRect(x * 24 + 13, ((y) * 24) + 1, 10, 10);
                if (this.drawArray[y][x] != undefined) {
                    if (this.drawArray[y][x] <= this.carriers) {
                        ctx.fillStyle = ColorConfig.getComputed("--primary-text");
                        ctx.fillRect(x * 24 + 12, ((y) * 24), 12, 12);
                        ctx.fillStyle = ColorConfig.getComputed("--editor-background");
                        ctx.fillRect(x * 24 + 13, ((y) * 24) + 1, 10, 10);
                        ctx.fillStyle = ColorConfig.getComputedChannelColor(this._doc.song, this._doc.channel).primaryNote;
                        ctx.fillText(this.drawArray[y][x] + "", x * 24 + 14, y * 24 + 10);
                    }
                    else {
                        ctx.fillStyle = ColorConfig.getComputedChannelColor(this._doc.song, this._doc.channel).primaryNote;
                        ctx.fillRect(x * 24 + 12, (y * 24), 12, 12);
                        ctx.fillStyle = ColorConfig.getComputed("--editor-background");
                        ctx.fillRect(x * 24 + 13, ((y) * 24) + 1, 10, 10);
                        ctx.fillStyle = ColorConfig.getComputed("--primary-text");
                        ctx.fillText(this.drawArray[y][x] + "", x * 24 + 14, y * 24 + 10);
                    }
                }
            }
        }
        this.drawLines(ctx);
    }

    private _onMouseMove = (event: MouseEvent): void => {
        if (this.mouseDown) { //todo rework to handle draging and single clicks differently

            var x = (event.clientX || event.pageX) - this.canvas.getBoundingClientRect().left;
            var y = Math.floor((event.clientY || event.pageY) - this.canvas.getBoundingClientRect().top);

            var ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;

            ctx.fillStyle = ColorConfig.getComputedChannelColor(this._doc.song, this._doc.channel).primaryNote;

            var yindex = Math.ceil(y / 12);
            var xindex = Math.ceil(x / 12);
            yindex = (yindex / 2) - Math.floor(yindex / 2) >= 0.5 ? Math.floor(yindex / 2) : -1;
            xindex = (xindex / 2) + 0.5 - Math.floor(xindex / 2) <= 0.5 ? Math.floor(xindex / 2) - 1 : -1;
            yindex = yindex >= 0 && yindex <= 5 ? yindex : -1;
            xindex = xindex >= 0 && xindex <= 5 ? xindex : -1;
            ctx.fillRect(xindex * 24 + 12, yindex * 24, 2, 2);

            if (this.selected == -1) {
                if (this.drawArray?.[yindex]?.[xindex] != undefined) {
                    this.selected = this.drawArray[yindex][xindex];
                    ctx.fillRect(xindex * 24 + 12, yindex * 24, 12, 12);
                    ctx.fillStyle = ColorConfig.getComputed("--editor-background");
                    ctx.fillText(this.drawArray[yindex][xindex] + "", xindex * 24 + 14, yindex * 24 + 10);
                    this.mouseDown = false;
                }
            } else {
                if (this.drawArray?.[yindex]?.[xindex] != undefined) {
                    if (this.mode == "feedback") {
                        const newmod = this.drawArray[yindex][xindex];
                        let check = this.feedback[newmod - 1].indexOf(this.selected);
                        if (check != -1) {
                            this.feedback[newmod - 1].splice(check, 1);
                        } else {
                            this.feedback[newmod - 1].push(this.selected);
                        }
                    } else {
                        if (this.drawArray[yindex][xindex] == this.selected) {
                            if (this.selected == this.carriers) {
                                if (this.selected > 1) {
                                    this.carriers--;
                                }
                            } else if (this.selected - 1 == this.carriers) {
                                this.carriers++;
                            }
                        } else {
                            const newmod = this.drawArray[yindex][xindex];
                            if (this.selected > newmod) { //todo try to rebalence then do this in algorithm mode otherwise input as needed
                                let check = this.newMods[newmod - 1].indexOf(this.selected);
                                if (check != -1) {
                                    this.newMods[newmod - 1].splice(check, 1);
                                } else {
                                    this.newMods[newmod - 1].push(this.selected);
                                }
                            } else {
                                let check = this.newMods[this.selected - 1].indexOf(newmod);
                                if (check != -1) {
                                    this.newMods[this.selected - 1].splice(check, 1);
                                } else {
                                    this.newMods[this.selected - 1].push(newmod);
                                }
                            }
                        }
                    }
                    this.selected = -1;
                    this.redrawCanvas(true);
                    this.mouseDown = false;
                } else {
                    this.selected = -1;
                    this.redrawCanvas(true);
                    this.mouseDown = false;
                }
            }


        }

    };

    private _onMouseDown = (event: MouseEvent): void => {
        this.mouseDown = true;

        // Allow single-click edit
        this._onMouseMove(event);
    };
    private _onMouseUp = (): void => {
        this.mouseDown = false;
        //this.continuousEdit = false;
        this._whenChange();
    };

    private _whenChange = (): void => {
        this._change = this._getChange(this.mode == "algorithm" ? this.newMods : this.feedback, this.carriers, this.mode);

        this._doc.record(this._change!);

        this._change = null;
    };
}
