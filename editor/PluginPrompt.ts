import { SongDocument } from "./SongDocument";
import { ChangePluginurl } from "./changes";
import { Prompt } from "./Prompt";
import { HTML } from "imperative-html";

const { div, input, h2, p, a } = HTML;

export class PluginPrompt implements Prompt {

    private readonly urlInput = input({ style: "margin-left: 1em; margin-right: 1em; " });

    private readonly _cancelButton: HTMLButtonElement = HTML.button({ class: "cancelButton" });
    private readonly _okayButton: HTMLButtonElement = HTML.button({ class: "okayButton", style: "width:45%;" }, "Okay");

    container: HTMLDivElement = div({ class: "prompt noSelection", style: "width: 400px;" },
        h2("Import Custom Effect Plugin"),
        p("Plugins are custom effects that you can import into your song like samples! They are constructed by the community."),
        p("You can find a guide on how to create a custom plugin, along with some basic plugin examples at ", a({ href: "https://slarmoo.github.io/beepboxplugins/", target: "_blank" }, "https://slarmoo.github.io/beepboxplugins/")),
        this.urlInput,
        div({ style: "display: flex; flex-direction: row-reverse; justify-content: space-between;" },
            this._okayButton,
        ),
        this._cancelButton,
    );
    private readonly _doc: SongDocument;

    constructor(_doc: SongDocument) {
        this._doc = _doc;
        if (this._doc.song.pluginurl) this.urlInput.value = this._doc.song.pluginurl;
        this._okayButton.addEventListener("click", this._saveChanges);
        this._cancelButton.addEventListener("click", this._close.bind(this));
    }
    
    cleanUp(): void {
        this._okayButton.removeEventListener("click", this._saveChanges);
        this._cancelButton.removeEventListener("click", this._close);
    };

    private _close(): void {
        this._doc.prompt = null;
        this._doc.undo();
    }

    private _saveChanges = (): void => {
        this._doc.prompt = null;
        this._doc.record(new ChangePluginurl(this._doc, this.urlInput.value), true);
        this._doc.prompt = null;
    }
}