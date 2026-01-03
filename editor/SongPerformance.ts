// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { Config } from "../synth/SynthConfig";
import { Note, Pattern } from "../synth/synthMessenger";
import { SongDocument } from "./SongDocument";
import { ChangeGroup } from "./Change";
import { ChangeChannelBar, ChangePinTime, ChangeEnsurePatternExists, ChangeNoteAdded, ChangeInsertBars, ChangeDeleteBars, ChangeNoteLength } from "./changes";
import { Piano } from "./Piano";
import { LiveInputValues, MessageFlag, ResetEffectsMessage } from "../synth/synthMessages";

export class SongPerformance {
    private _channelIsDrum: boolean = false;
    private _channelOctave: number = -1;
    private _songKey: number = -1;
    private _pitchesAreTemporary: boolean = false;
    private _bassPitchesAreTemporary: boolean = false;
    public liveInputPitches: number[] = [];
    public liveInputBassPitches: number[] = [];
    private readonly _recentlyAddedPitches: number[] = []; // Pitches that are rapidly added then removed within a minimum rhythm duration wouldn't get recorded until I explicitly track recently added notes and check if any are no longer held.
    private readonly _recentlyAddedBassPitches: number[] = []; // Pitches that are rapidly added then removed within a minimum rhythm duration wouldn't get recorded until I explicitly track recently added notes and check if any are no longer held.

    private _songLengthWhenRecordingStarted: number = -1;
    private _playheadPart: number = -1;
    private _bassPlayheadPart: number = -1;
    private _playheadPattern: Pattern | null = null;
    private _bassPlayheadPattern: Pattern | null = null;
    private _pitchesChanged: boolean = false;
    private _bassPitchesChanged: boolean = false;
    private _lastNote: Note | null = null;
    private _lastBassNote: Note | null = null;
    private _recordingChange: ChangeGroup | null = null;

    constructor(private _doc: SongDocument) {
        this._doc.notifier.watch(this._documentChanged);
        this._documentChanged();
        window.requestAnimationFrame(this._onAnimationFrame);
    }

    public play(): void {
        this._doc.synth.play();
        this._doc.synth.enableMetronome = false;
        this._doc.synth.countInMetronome = false
        this._doc.synth.maintainLiveInput();
    }

    public pause(): void {
        this.clearAllPitches();
        this.clearAllBassPitches();
        if (this._recordingChange != null) {
            if (this._doc.song.barCount > this._songLengthWhenRecordingStarted && !this._lastBarHasPatterns()) {
                // If an extra empty bar was added in case it was needed for recording, but it didn't end up getting used, delete it now.
                new ChangeDeleteBars(this._doc, this._doc.song.barCount - 1, 1);
                new ChangeChannelBar(this._doc, this._doc.channel, this._doc.song.barCount - 1);
            }
            if (!this._recordingChange.isNoop()) {
                this._doc.record(this._recordingChange);
                this._recordingChange = null;
            }
            this._lastNote = null;
        }
        this._doc.synth.pause();
        const resetEffects: ResetEffectsMessage = {
            flag: MessageFlag.resetEffects
        }
        this._doc.synth.sendMessage(resetEffects);
        this._doc.synth.enableMetronome = false;
        this._doc.synth.countInMetronome = false
        if (this._doc.prefs.autoFollow) {
            this._doc.synth.goToBar(this._doc.bar);
        }
        this._doc.synth.snapToBar();
    }

    public record(): void {
        this._doc.synth.snapToBar();
        const playheadBar: number = Math.floor(this._doc.synth.playhead);
        if (playheadBar != this._doc.bar) {
            new ChangeChannelBar(this._doc, this._doc.channel, playheadBar);
        }
        if (this._pitchesAreTemporary) {
            this.clearAllPitches();
            this._pitchesAreTemporary = false;
        }
        if (this._bassPitchesAreTemporary) {
            this.clearAllBassPitches();
            this._bassPitchesAreTemporary = false;
        }
        this._doc.synth.enableMetronome = this._doc.prefs.metronomeWhileRecording;
        this._doc.synth.countInMetronome = this._doc.prefs.metronomeCountIn;
        this._doc.synth.startRecording();
        this._doc.synth.maintainLiveInput();
        this._songLengthWhenRecordingStarted = this._doc.song.barCount;
        this._playheadPart = this._getCurrentPlayheadPart();
        this._bassPlayheadPart = this._getCurrentPlayheadPart();
        this._playheadPattern = null;
        this._bassPlayheadPattern = null;
        this._pitchesChanged = false;
        this._bassPitchesChanged = false;
        this._lastNote = null;
        this._lastBassNote = null;
        this._recentlyAddedPitches.length = 0;
        this._recentlyAddedBassPitches.length = 0;
        this._recordingChange = new ChangeGroup();
        this._doc.setProspectiveChange(this._recordingChange);
    }

    public abortRecording(): void {
        this._recordingChange = null;
        this.pause();
    }

    public pitchesAreTemporary(): boolean {
        return this._pitchesAreTemporary;
    }

    public bassPitchesAreTemporary(): boolean {
        return this._bassPitchesAreTemporary;
    }

    private _getBassOffsetChannel(): number {
        if (this._doc.channel >= this._doc.song.pitchChannelCount)
            return this._doc.channel;
        return Math.max(0, Math.min(this._doc.song.pitchChannelCount - 1, this._doc.channel + this._doc.prefs.bassOffset));
    }

    private _getMinDivision(): number {
        if (this._doc.prefs.snapRecordedNotesToRhythm) {
            return Config.partsPerBeat / Config.rhythms[this._doc.song.rhythm].stepsPerBeat;
        } else {
            return 1;
        }
    }

    private _getCurrentPlayheadPart(): number {
        const currentPart: number = this._doc.synth.playhead * this._doc.song.beatsPerBar * Config.partsPerBeat;
        if (this._doc.prefs.snapRecordedNotesToRhythm) {
            const minDivision: number = this._getMinDivision();
            return Math.round(currentPart / minDivision) * minDivision;
        }
        return Math.round(currentPart);
    }

    private _lastBarHasPatterns(): boolean {
        for (let channelIndex: number = 0; channelIndex < this._doc.song.getChannelCount(); channelIndex++) {
            if (this._doc.song.channels[channelIndex].bars[this._doc.song.barCount - 1] != 0) return true;
        }
        return false;
    }

    private _onAnimationFrame = (): void => {
        window.requestAnimationFrame(this._onAnimationFrame);
        if (this._doc.synth.recording) {
            let dirty: boolean = this._updateRecordedNotes();
            dirty = this._updateRecordedBassNotes() ? true : dirty;
            if (dirty) {
                // The full interface is usually only rerendered in response to user input events, not animation events, but in this case go ahead and rerender everything.
                this._doc.notifier.notifyWatchers();
            }
        }
    }

    // Returns true if the full interface needs to be rerendered.
    private _updateRecordedNotes(): boolean {
        if (this._recordingChange == null) return false;
        if (!this._doc.lastChangeWas(this._recordingChange)) {
            this.abortRecording();
            return false;
        }
        if (this._doc.synth.countInMetronome) {
            // If the synth is still counting in before recording, discard any recently added pitches.
            this._recentlyAddedPitches.length = 0;
            this._pitchesChanged = false;
            return false;
        }

        const partsPerBar: number = this._doc.song.beatsPerBar * Config.partsPerBeat;
        const oldPart: number = this._playheadPart % partsPerBar;
        const oldBar: number = Math.floor(this._playheadPart / partsPerBar);
        const oldPlayheadPart: number = this._playheadPart;
        this._playheadPart = this._getCurrentPlayheadPart();
        const newPart: number = this._playheadPart % partsPerBar;
        const newBar: number = Math.floor(this._playheadPart / partsPerBar);
        if (oldPart == newPart && oldBar == newBar) return false;
        if (this._playheadPart < oldPlayheadPart) {
            this._lastNote = null;
            this._playheadPattern = null;
            return false;
        }

        let dirty = false;
        for (let bar: number = oldBar; bar <= newBar; bar++) {
            if (bar != oldBar) {
                this._playheadPattern = null;
            }
            const startPart: number = (bar == oldBar) ? oldPart : 0;
            const endPart: number = (bar == newBar) ? newPart : partsPerBar;
            if (startPart == endPart) break;
            if (this._lastNote != null && !this._pitchesChanged && startPart > 0 && this.liveInputPitches.length > 0) {
                this._recordingChange.append(new ChangePinTime(this._doc, this._lastNote, 1, endPart, this._lastNote.continuesLastPattern));
                // Instead of updating the entire interface when extending the last note, just update the current pattern as a special case to avoid doing too much work every frame since performance is important while recording.
                this._doc.currentPatternIsDirty = true;
            } else {
                if (this._lastNote != null) {
                    // End the last note.
                    this._lastNote = null;
                }
                // All current pitches will usually fill the time span from startPart to endPart, but
                // if any recent pitches were released before being recorded, they'll get recorded here
                // as short as possible and then any remaining time will be dedicated to pitches that
                // haven't been released yet.
                let noteStartPart: number = startPart;
                let noteEndPart: number = endPart;
                while (noteStartPart < endPart) {
                    let addedAlreadyReleasedPitch: boolean = false;
                    if (this._recentlyAddedPitches.length > 0 || this.liveInputPitches.length > 0) {
                        if (this._playheadPattern == null) {
                            this._doc.selection.erasePatternInBar(this._recordingChange, this._doc.synth.liveInputValues[LiveInputValues.liveInputChannel], bar);
                            this._recordingChange.append(new ChangeEnsurePatternExists(this._doc, this._doc.synth.liveInputValues[LiveInputValues.liveInputChannel], bar));
                            this._playheadPattern = this._doc.song.getPattern(this._doc.synth.liveInputValues[LiveInputValues.liveInputChannel], bar);
                        }

                        if (this._playheadPattern == null) throw new Error();
                        this._lastNote = new Note(-1, noteStartPart, noteEndPart, Config.noteSizeMax, this._doc.song.getChannelIsNoise(this._doc.synth.liveInputValues[LiveInputValues.liveInputChannel]));
                        this._lastNote.continuesLastPattern = (noteStartPart == 0 && !this._pitchesChanged);
                        this._lastNote.pitches.length = 0;
                        while (this._recentlyAddedPitches.length > 0) {
                            if (this._lastNote.pitches.length >= Config.maxChordSize) break;
                            const recentPitch: number = this._recentlyAddedPitches.shift()!;
                            if (this.liveInputPitches.indexOf(recentPitch) == -1) {
                                this._lastNote.pitches.push(recentPitch);
                                addedAlreadyReleasedPitch = true;
                            }
                        }
                        for (let i: number = 0; i < this.liveInputPitches.length; i++) {
                            if (this._lastNote.pitches.length >= Config.maxChordSize) break;
                            this._lastNote.pitches.push(this.liveInputPitches[i]);
                        }
                        this._recordingChange.append(new ChangeNoteAdded(this._doc, this._playheadPattern, this._lastNote, this._playheadPattern.notes.length));
                        if (addedAlreadyReleasedPitch) {
                            // If this note contains pitches that were already released, shorten it and start a new note.
                            noteEndPart = noteStartPart + this._getMinDivision();
                            new ChangeNoteLength(this._doc, this._lastNote, this._lastNote.start, noteEndPart);
                            this._lastNote = null;
                        }
                        dirty = true;
                    }
                    this._pitchesChanged = addedAlreadyReleasedPitch;
                    noteStartPart = noteEndPart;
                    noteEndPart = endPart;
                }
            }

            if (bar == this._doc.song.barCount - 1) {
                if (this._lastBarHasPatterns()) {
                    new ChangeInsertBars(this._doc, this._doc.song.barCount, 1);
                    this._doc.bar--; // To counteract it increasing in ChangeInsertBars.
                    dirty = true;
                }
            }
        }
        return dirty;
    }

    // Returns true if the full interface needs to be rerendered.
    private _updateRecordedBassNotes(): boolean {
        if (this._recordingChange == null) return false;
        if (!this._doc.lastChangeWas(this._recordingChange)) {
            this.abortRecording();
            return false;
        }
        if (this._doc.synth.countInMetronome) {
            // If the synth is still counting in before recording, discard any recently added pitches.
            this._recentlyAddedBassPitches.length = 0;
            this._bassPitchesChanged = false;
            return false;
        }

        const partsPerBar: number = this._doc.song.beatsPerBar * Config.partsPerBeat;
        const oldPart: number = this._bassPlayheadPart % partsPerBar;
        const oldBar: number = Math.floor(this._bassPlayheadPart / partsPerBar);
        const oldPlayheadPart: number = this._bassPlayheadPart;
        this._bassPlayheadPart = this._getCurrentPlayheadPart();
        const newPart: number = this._bassPlayheadPart % partsPerBar;
        const newBar: number = Math.floor(this._bassPlayheadPart / partsPerBar);
        if (oldPart == newPart && oldBar == newBar) return false;
        if (this._bassPlayheadPart < oldPlayheadPart) {
            this._lastBassNote = null;
            this._bassPlayheadPattern = null;
            return false;
        }

        let dirty = false;
        for (let bar: number = oldBar; bar <= newBar; bar++) {
            if (bar != oldBar) {
                this._bassPlayheadPattern = null;
            }
            const startPart: number = (bar == oldBar) ? oldPart : 0;
            const endPart: number = (bar == newBar) ? newPart : partsPerBar;
            if (startPart == endPart) break;
            if (this._lastBassNote != null && !this._bassPitchesChanged && startPart > 0 && this.liveInputBassPitches.length > 0) {
                this._recordingChange.append(new ChangePinTime(this._doc, this._lastBassNote, 1, endPart, this._lastBassNote.continuesLastPattern));
                // Instead of updating the entire interface when extending the last note, just update the current pattern as a special case to avoid doing too much work every frame since performance is important while recording.
                this._doc.currentPatternIsDirty = true;
            } else {
                if (this._lastBassNote != null) {
                    // End the last note.
                    this._lastBassNote = null;
                }
                // All current pitches will usually fill the time span from startPart to endPart, but
                // if any recent pitches were released before being recorded, they'll get recorded here
                // as short as possible and then any remaining time will be dedicated to pitches that
                // haven't been released yet.
                let noteStartPart: number = startPart;
                let noteEndPart: number = endPart;
                while (noteStartPart < endPart) {
                    let addedAlreadyReleasedPitch: boolean = false;
                    if (this._recentlyAddedBassPitches.length > 0 || this.liveInputBassPitches.length > 0) {
                        if (this._bassPlayheadPattern == null) {
                            this._doc.selection.erasePatternInBar(this._recordingChange, this._doc.synth.liveInputValues[LiveInputValues.liveBassInputChannel], bar);
                            this._recordingChange.append(new ChangeEnsurePatternExists(this._doc, this._doc.synth.liveInputValues[LiveInputValues.liveBassInputChannel], bar));
                            this._bassPlayheadPattern = this._doc.song.getPattern(this._doc.synth.liveInputValues[LiveInputValues.liveBassInputChannel], bar);
                        }

                        if (this._bassPlayheadPattern == null) throw new Error();
                        this._lastBassNote = new Note(-1, noteStartPart, noteEndPart, Config.noteSizeMax, this._doc.song.getChannelIsNoise(this._doc.synth.liveInputValues[LiveInputValues.liveBassInputChannel]));
                        this._lastBassNote.continuesLastPattern = (noteStartPart == 0 && !this._bassPitchesChanged);
                        this._lastBassNote.pitches.length = 0;
                        while (this._recentlyAddedBassPitches.length > 0) {
                            if (this._lastBassNote.pitches.length >= Config.maxChordSize) break;
                            const recentPitch: number = this._recentlyAddedBassPitches.shift()!;
                            if (this.liveInputBassPitches.indexOf(recentPitch) == -1) {
                                this._lastBassNote.pitches.push(recentPitch);
                                addedAlreadyReleasedPitch = true;
                            }
                        }
                        for (let i: number = 0; i < this.liveInputBassPitches.length; i++) {
                            if (this._lastBassNote.pitches.length >= Config.maxChordSize) break;
                            this._lastBassNote.pitches.push(this.liveInputBassPitches[i]);
                        }
                        this._recordingChange.append(new ChangeNoteAdded(this._doc, this._bassPlayheadPattern, this._lastBassNote, this._bassPlayheadPattern.notes.length));
                        if (addedAlreadyReleasedPitch) {
                            // If this note contains pitches that were already released, shorten it and start a new note.
                            noteEndPart = noteStartPart + this._getMinDivision();
                            new ChangeNoteLength(this._doc, this._lastBassNote, this._lastBassNote.start, noteEndPart);
                            this._lastBassNote = null;
                        }
                        dirty = true;
                    }
                    this._bassPitchesChanged = addedAlreadyReleasedPitch;
                    noteStartPart = noteEndPart;
                    noteEndPart = endPart;
                }
            }

            if (bar == this._doc.song.barCount - 1) {
                if (this._lastBarHasPatterns()) {
                    new ChangeInsertBars(this._doc, this._doc.song.barCount, 1);
                    this._doc.bar--; // To counteract it increasing in ChangeInsertBars.
                    dirty = true;
                }
            }
        }
        return dirty;
    }

    public setTemporaryPitches(pitches: number[], duration: number): void {
        this._updateRecordedNotes();
        this.liveInputPitches = pitches.slice();
        this._doc.synth.addRemoveLiveInputTone(this.liveInputPitches, false, true);
        this._doc.synth.liveInputValues[LiveInputValues.liveInputDuration] = duration;
        this._doc.synth.liveInputValues[LiveInputValues.liveInputStarted] = 1;
        this._pitchesAreTemporary = true;
        this._pitchesChanged = true;
    }

    public setTemporaryBassPitches(pitches: number[], duration: number): void {
        this._updateRecordedBassNotes();
        this.liveInputBassPitches = pitches.slice();
        this.liveInputBassPitches.length = Math.min(pitches.length, Config.maxChordSize);
        this._doc.synth.addRemoveLiveInputTone(this.liveInputBassPitches, true, true);
        this._doc.synth.liveInputValues[LiveInputValues.liveBassInputDuration] = duration;
        this._doc.synth.liveInputValues[LiveInputValues.liveBassInputStarted] = 1;
        this._bassPitchesAreTemporary = true;
        this._bassPitchesChanged = true;
    }

    public addPerformedPitch(pitch: number): void {
        this._doc.synth.maintainLiveInput();

        if (pitch > Piano.getBassCutoffPitch(this._doc) || this._getBassOffsetChannel() == this._doc.channel) {
            this._updateRecordedNotes();
            if (this._pitchesAreTemporary) {
                this.clearAllPitches();
                this._pitchesAreTemporary = false;
            }
            if (this._doc.prefs.ignorePerformedNotesNotInScale && !Config.scales[this._doc.song.scale].flags[pitch % Config.pitchesPerOctave]) {
                return;
            }
            if (this.liveInputPitches.indexOf(pitch) == -1) {
                this.liveInputPitches.push(pitch);
                this._doc.synth.addRemoveLiveInputTone(pitch, false, true);
                this._pitchesChanged = true;
                while (this.liveInputPitches.length > Config.maxChordSize) {
                    const removedPitch: number | undefined = this.liveInputPitches.shift();
                    if (removedPitch) this._doc.synth.addRemoveLiveInputTone(removedPitch, false, false);
                }
                this._doc.synth.liveInputValues[LiveInputValues.liveInputDuration] = Number.MAX_SAFE_INTEGER;

                if (this._recordingChange != null) {
                    const recentIndex: number = this._recentlyAddedPitches.indexOf(pitch);
                    if (recentIndex != -1) {
                        // If the latest pitch is already in _recentlyAddedPitches, remove it before adding it back at the end.
                        this._recentlyAddedPitches.splice(recentIndex, 1);
                    }
                    this._recentlyAddedPitches.push(pitch);
                    while (this._recentlyAddedPitches.length > Config.maxChordSize * 4) {
                        this._recentlyAddedPitches.shift();
                    }
                }
            }
        } else {
            this._updateRecordedBassNotes();
            if (this._bassPitchesAreTemporary) {
                this.clearAllBassPitches();
                this._bassPitchesAreTemporary = false;
            }
            if (this._doc.prefs.ignorePerformedNotesNotInScale && !Config.scales[this._doc.song.scale].flags[pitch % Config.pitchesPerOctave]) {
                return;
            }
            if (this.liveInputBassPitches.indexOf(pitch) == -1) {
                this.liveInputBassPitches.push(pitch);
                this._doc.synth.addRemoveLiveInputTone(pitch, false, true);
                this._pitchesChanged = true;
                while (this.liveInputBassPitches.length > Config.maxChordSize) {
                    const removedPitch: number | undefined = this.liveInputBassPitches.shift();
                    if (removedPitch) this._doc.synth.addRemoveLiveInputTone(removedPitch, false, false);
                }
                this._doc.synth.liveInputValues[LiveInputValues.liveBassInputDuration] = Number.MAX_SAFE_INTEGER;

                if (this._recordingChange != null) {
                    const recentIndex: number = this._recentlyAddedPitches.indexOf(pitch);
                    if (recentIndex != -1) {
                        // If the latest pitch is already in _recentlyAddedPitches, remove it before adding it back at the end.
                        this._recentlyAddedBassPitches.splice(recentIndex, 1);
                    }
                    this._recentlyAddedBassPitches.push(pitch);
                    while (this._recentlyAddedBassPitches.length > Config.maxChordSize * 4) {
                        this._recentlyAddedBassPitches.shift();
                    }
                }
            }
        }
    }

    public removePerformedPitch(pitch: number): void {
        if (pitch > Piano.getBassCutoffPitch(this._doc) || this._getBassOffsetChannel() == this._doc.channel) {
            this._updateRecordedNotes();
            for (let i: number = 0; i < this.liveInputPitches.length; i++) {
                if (this.liveInputPitches[i] == pitch) {
                    this.liveInputPitches.splice(i, 1);
                    this._pitchesChanged = true;
                    i--;
                    this._doc.synth.addRemoveLiveInputTone(pitch, false, false);
                }
            }
        } else {
            this._updateRecordedBassNotes();
            for (let i: number = 0; i < this.liveInputBassPitches.length; i++) {
                if (this.liveInputBassPitches[i] == pitch) {
                    this.liveInputBassPitches.splice(i, 1);
                    this._pitchesChanged = true;
                    i--;
                    this._doc.synth.addRemoveLiveInputTone(pitch, true, false);
                }
            }
        }
    }

    public clearAllPitches(): void {
        this._updateRecordedNotes();
        this._doc.synth.addRemoveLiveInputTone(this.liveInputPitches, false, false);
        this.liveInputPitches.length = 0;
        this._pitchesChanged = true;
    }

    public clearAllBassPitches(): void {
        this._updateRecordedBassNotes();
        this._doc.synth.addRemoveLiveInputTone(this.liveInputBassPitches, true, false);
        this.liveInputBassPitches.length = 0;
        this._bassPitchesChanged = true;
    }

    private _documentChanged = (): void => {
        const isDrum: boolean = this._doc.song.getChannelIsNoise(this._doc.channel);
        const octave: number = this._doc.song.channels[this._doc.channel].octave;
        if (this._doc.synth.liveInputValues[LiveInputValues.liveInputChannel] != this._doc.channel || this._doc.synth.liveInputValues[LiveInputValues.liveBassInputChannel] != this._getBassOffsetChannel() || this._channelIsDrum != isDrum || this._channelOctave != octave || this._songKey != this._doc.song.key) {
            this._doc.synth.liveInputValues[LiveInputValues.liveInputChannel] = this._doc.channel;
            this._doc.synth.liveInputValues[LiveInputValues.liveBassInputChannel] = this._getBassOffsetChannel();
            this._channelIsDrum = isDrum;
            this._channelOctave = octave;
            this._songKey = this._doc.song.key;
            this.clearAllPitches();
            this.clearAllBassPitches();
        }
    }
}