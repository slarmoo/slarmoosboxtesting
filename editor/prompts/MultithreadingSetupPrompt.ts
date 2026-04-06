import { Prompt } from "./Prompt";
import { SongDocument } from "../SongDocument";
import { HTML } from "imperative-html";

const { div, h2, p, input, label, button } = HTML;

export class MultithreadingSetupPrompt implements Prompt {
    private readonly _onlyResizeInSongPlayerCheckbox: HTMLInputElement = input({ type: "checkbox", style: "width: 1em; padding: 0.5em;", id: "onlyResizeInSongPlayerCheckbox" });
    private readonly _maxBlockSize: HTMLInputElement = input({ type: "range", min: 0, max: 5, step: 1, style: "width: 113px; margin-left: 0px;" });
    // private readonly _minBlockSize: HTMLInputElement = input({ type: "range", min: 0, max: 5, step: 1, style: "width: 113px; margin-left: 0px;" });
    private readonly _okayButton: HTMLButtonElement = button({ class: "okayButton", style: "width:45%;" }, "Okay");
    private readonly _cancelButton: HTMLButtonElement = button({ class: "cancelButton" });

    public readonly container: HTMLDivElement = div({ class: "prompt noSelection", style: "width: 400px; text-align: right; max-height: 90%;" },
        h2({ style: "align-self: center;" }, "Multithreading Setup"),
        div({ style: "display: grid; overflow-y: auto; overflow-x: hidden; flex-shrink: 1;" },
            p("Slarmoo's Box separates the synth onto its own thread, which both fixes a lot of issues while creating some new ones. Here you can customize some of the more advanced options."),
            p("The \"buffer\" is a big part of what helps reduce lag in Slarmoo's Box. Samples can be created when there is time, and then taken from odemand instead of being synthesized on demand in a short timeframe. However, the downside of this is that longer buffers mean a longer delay between user interaction and actual audible result (becoming less like real-time synthesis). Thus, it is recommended that you use a shorter buffer for making songs and a longer one for listening to them."),
            p("Buffers will already resize if enough lag is detected, but you can choose when the buffer resizes and what the maximum value for it is. It may take a bit of experimentation to figure out the settings that work best for you, your songs, and your browser."),
            label({ style: "display: flex; flex-direction: row; align-items: center; height: 2em; justify-content: center;" },
                "Resize buffer only in Song Player:",
                this._onlyResizeInSongPlayerCheckbox,
            ),
            // label({ style: "display: flex; flex-direction: row; align-items: center; height: 2em; justify-content: center;" },
            //     "Min buffer size:",
            //     this._minBlockSize
            // ),
            label({ style: "display: flex; flex-direction: row; align-items: center; height: 2em; justify-content: center;" },
                "Max buffer size:",
                this._maxBlockSize
            )
        ),
        div({ style: "display: flex; flex-direction: row-reverse; justify-content: space-between;" },
            this._okayButton,
        ),
        //TODO: Max buffer size
        this._cancelButton,
    );

    constructor(private _doc: SongDocument) {
        this._onlyResizeInSongPlayerCheckbox.checked = this._doc.prefs.onlyResizeInSongPlayer;
        // this._minBlockSize.value = (Math.log2(this._doc.prefs.minBlockSize) - 9) + "";
        this._maxBlockSize.value = (Math.log2(this._doc.prefs.maxBlockSize) - 9) + "";
        this._okayButton.addEventListener("click", this._confirm);
        this._cancelButton.addEventListener("click", this._close);
        this.container.addEventListener("keydown", this._whenKeyPressed);
    }

    private _confirm = (): void => {
        this._doc.prefs.onlyResizeInSongPlayer = this._onlyResizeInSongPlayerCheckbox.checked;
        // this._doc.prefs.minBlockSize = Math.pow(2, parseInt(this._minBlockSize.value) + 9);
        this._doc.prefs.maxBlockSize = Math.pow(2, parseInt(this._maxBlockSize.value) + 9);
        this._doc.synth.isResizable = !this._doc.prefs.onlyResizeInSongPlayer || ISPLAYER;
        // this._doc.synth.defaultBufferLength = this._doc.prefs.minBlockSize * 8 * 4 + 12;
        this._doc.synth.maxBufferLength = this._doc.prefs.maxBlockSize * 8 * 4 + 12;
        this._doc.prefs.save();
        this._close();
    }

    private _close = (): void => {
        this._doc.undo();
    }

    public cleanUp = (): void => {
        this._okayButton.removeEventListener("click", this._confirm);
        this._cancelButton.removeEventListener("click", this._close);
        this.container.removeEventListener("keydown", this._whenKeyPressed);
    };    

    private _whenKeyPressed = (event: KeyboardEvent): void => {
        if ((<Element>event.target).tagName != "BUTTON" && event.keyCode == 13) { // Enter key
            this._confirm();
        }
    }
}