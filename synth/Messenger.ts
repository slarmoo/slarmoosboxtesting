// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { MessageFlag, Message, PlayMessage, LoadSongMessage, ResetEffectsMessage, ComputeModsMessage, SetPrevBarMessage, SendSharedArrayBuffers, SongSettings, InstrumentSettings, ChannelSettings, UpdateSongMessage, IsRecordingMessage, PluginMessage, SampleStartMessage, SampleFinishMessage, LoopRepeatCountMessage, LoopBarMessage, defaultBlockSize } from "./synthMessages";
import { RingBuffer } from "ringbuf.js";
import { Synth } from "./synth";
import { events, EventType } from "../global/Events";
import { Note, Song, Pattern, Instrument, FilterSettings, Channel, SynthTemplate } from "./song";
import { Config, EffectType, InstrumentType, Dictionary, DictionaryArray, FilterType, EnvelopeType, Transition, Chord, Envelope } from "./SynthConfig";
import { BeepBoxEffectPlugin } from "beepboxplugin";
import { PluginConfig } from "../editor/PluginConfig";

export function discardInvalidPatternInstruments(instruments: number[], song: Song, channelIndex: number) {
    const uniqueInstruments: Set<number> = new Set(instruments);
    instruments.length = 0;
    instruments.push(...uniqueInstruments);
    for (let i: number = 0; i < instruments.length; i++) {
        if (instruments[i] >= song.channels[channelIndex].instruments.length) {
            instruments.splice(i, 1);
            i--;
        }
    }
    if (instruments.length > song.getMaxInstrumentsPerPattern(channelIndex)) {
        instruments.length = song.getMaxInstrumentsPerPattern(channelIndex);
    }
    if (instruments.length <= 0) {
        instruments[0] = 0;
    }
}

export class SynthMessenger extends SynthTemplate {

    public liveInputValues: Uint32Array = new Uint32Array(new SharedArrayBuffer(6 * 4));
    private readonly liveInputPitchesSAB: SharedArrayBuffer = new SharedArrayBuffer(Config.maxPitch);
    private readonly liveInputPitchesOnOffRequests: RingBuffer = new RingBuffer(this.liveInputPitchesSAB, Uint16Array);

    private readonly defaultBufferLength: number = defaultBlockSize * 8 * 4 + 12;
    public maxBufferLength: number = defaultBlockSize * (2 ** 5) * 8 * 4 + 12;
    public isResizable: boolean = true;
    private readonly bufferL: SharedArrayBuffer = new SharedArrayBuffer(this.defaultBufferLength, { maxByteLength: this.maxBufferLength });
    private readonly bufferR: SharedArrayBuffer = new SharedArrayBuffer(this.defaultBufferLength, { maxByteLength: this.maxBufferLength });
    private readableBuffer: RingBuffer = new RingBuffer(this.bufferL, Float32Array);
    private readableBufferLength: number = 0;

    private loopRepeats: number = -1;
    public oscRefreshEventTimer: number = 0;
    private currentTempo: number = 150;
    private playheadInternal: number = 0.0;

    public songPosition: Uint16Array = new Uint16Array(new SharedArrayBuffer(3 * 2));
    public readonly outVolumeCap: Float32Array = new Float32Array(new SharedArrayBuffer(1 * 4));
    // public isAtStartOfTick: boolean = true;
    // public isAtEndOfTick: boolean = true;
    private liveInputEndTime: number = 0.0;

    private _loopBarStart: number = -1;

    /** An *inclusive* bound. */
    private _loopBarEnd: number = -1;

    private audioContext: AudioContext | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private synthNode: Worker | null = null;
    private splitterNode: ChannelSplitterNode | null = null;
    private analyserNodeLeft: AnalyserNode | null = null;
    private analyserNodeRight: AnalyserNode | null = null;

    private readonly leftData: Float32Array<ArrayBuffer> = new Float32Array(1024);
    private readonly rightData: Float32Array<ArrayBuffer> = new Float32Array(1024);

    public get playing(): boolean {
        return this.isPlayingSong;
    }

    public get recording(): boolean {
        return this.isRecording;
    }

    public get playhead(): number {
        let offset: number = 0;
        if (this.song && !this.countInMetronome) {
            this.playheadInternal = this.songPosition[0] + (this.songPosition[1] + (this.songPosition[2] + this.tick / Config.ticksPerPart) / Config.partsPerBeat) / this.song!.beatsPerBar
            offset = this.bufferL.byteLength / (4 * this.getSamplesPerTickSpecificBPM(this.currentTempo) * Config.ticksPerPart * Config.partsPerBeat * this.song!.beatsPerBar); //account for delay due to buffer length
            if (this.readableBufferLength != this.readableBuffer.availableRead()) {
                let ratio: number = (this.readableBufferLength / this.bufferL.byteLength * 4) || 1;
                if (ratio > 1) ratio = 1;
                if (this.readableBufferLength < 0) this.readableBufferLength = 0;
                this.readableBufferLength += (this.readableBuffer.availableRead() - this.readableBufferLength) / (this.bufferL.byteLength / defaultBlockSize * ratio);
            }
            offset *= this.readableBufferLength / this.bufferL.byteLength * 4;
            if (!this.isPlayingSong || offset < 0.1) offset = 0;
        }
        if (this.playheadInternal - offset < 0) return 0;
        return this.playheadInternal - offset;
    }

    public set playhead(value: number) {
        if (this.song != null) {
            this.playheadInternal = Math.max(0, Math.min(this.song.barCount, value));
            let remainder: number = this.playheadInternal;
            this.songPosition[0] = Math.floor(remainder);
            remainder = this.song.beatsPerBar * (remainder - this.songPosition[0]);
            this.songPosition[1] = Math.floor(remainder);
            remainder = Config.partsPerBeat * (remainder - this.songPosition[1]);
            this.songPosition[2] = Math.floor(remainder);
            remainder = Config.ticksPerPart * (remainder - this.songPosition[2]);
            this.tick = Math.floor(remainder);
            this.isAtStartOfTick = true;
            const prevBar: SetPrevBarMessage = {
                flag: MessageFlag.setPrevBar,
                prevBar: null
            }
            this.sendMessage(prevBar);
        }
    }

    public set loopRepeatCount(value: number) {
        this.loopRepeats = value;
        const loopRepeatCountMessage: LoopRepeatCountMessage = {
            flag: MessageFlag.loopRepeatCount,
            count: value
        };
        this.sendMessage(loopRepeatCountMessage);
    }

    public get loopRepeatCount(): number {
        return this.loopRepeats;
    }

    public get loopBarStart(): number {
        return this._loopBarStart;
    }
    public set loopBarStart(value: number) {
        this._loopBarStart = value;
        const loopBarMessage: LoopBarMessage = {
            flag: MessageFlag.loopBar,
            loopBarStart: this._loopBarStart,
            loopBarEnd: this._loopBarEnd
        }
        this.sendMessage(loopBarMessage);
    }

    public get loopBarEnd(): number {
        return this._loopBarEnd;
    }
    public set loopBarEnd(value: number) {
        this._loopBarEnd = value;
        const loopBarMessage: LoopBarMessage = {
            flag: MessageFlag.loopBar,
            loopBarStart: this._loopBarStart,
            loopBarEnd: this._loopBarEnd
        }
        this.sendMessage(loopBarMessage);
    }

    public getTicksIntoBar(): number {
        return (this.songPosition[1] * Config.partsPerBeat + this.songPosition[2]) * Config.ticksPerPart + this.tick;
    }
    public getCurrentPart(): number {
        return (this.songPosition[1] * Config.partsPerBeat + this.songPosition[2]);
    }

    constructor(song: Song | string | null = null) {
        super();
        if (song != null) {
            this.setSong(song);
            this.currentTempo = this.song!.tempo;
        }
        this.activateAudio();
        events.listen(EventType.sampleLoading, this.updateProcessorSamplesStart.bind(this));
        events.listen(EventType.sampleLoaded, this.updateProcessorSamplesFinish.bind(this));
        events.listen(EventType.pluginLoaded, this.updateProcessorPlugin.bind(this));
    }

    private messageQueue: Message[] = [];

    public sendMessage(message: Message) { //reworked from Jummbus's prototype
        if (this.synthNode == null) {
            this.messageQueue.push(message);
        } else {
            this.synthNode.postMessage(message);
            // Handle sending any queued messages
            while (this.messageQueue.length > 0) {
                let next: Message | undefined = this.messageQueue.shift();
                if (next) {
                    this.synthNode.postMessage(next);
                }
            }
        }
    }

    private receiveMessage(event: MessageEvent) { //reworked from Jummbus's prototype
        const flag: MessageFlag = event.data.flag;

        switch (flag) {
            case MessageFlag.deactivate: {
                this.audioContext!.suspend();
                break;
            }

            case MessageFlag.togglePlay: {
                this.pause(false); //make sure we don't also tell the synth processor to pause again
                break;
            }

            case MessageFlag.isRecording: {
                this.countInMetronome = event.data.countInMetronome;
                break;
            }

            case MessageFlag.uiRender: {
                if (!this.isPlayingSong && performance.now() >= this.liveInputEndTime) this.deactivateAudio();
                if (this.oscEnabled) {
                    if (this.oscRefreshEventTimer <= 0) {
                        this.analyserNodeLeft!.getFloatTimeDomainData(this.leftData);
                        this.analyserNodeRight!.getFloatTimeDomainData(this.rightData);
                        events.raise(EventType.oscilloscope, this.leftData, this.rightData);
                        this.oscRefreshEventTimer = 18; //oscilloscope refresh rate
                    } else {
                        this.oscRefreshEventTimer--;
                    }
                }
                if (this.playing && !ISPLAYER) this.computeMods();
                break;
            }

            case MessageFlag.growsabs: {
                //need more latency
                const newLength: number = (this.bufferL.byteLength - 12) * 2 + 12;
                if (this.isResizable && this.bufferL.growable && this.bufferL.maxByteLength >= newLength && this.maxBufferLength >= newLength) {
                    this.bufferL.grow(newLength);
                    this.bufferR.grow(newLength);
                    this.sendMessage(event.data); //let the synth know that growth was successful
                    this.workletNode?.port.postMessage(event.data); //let the worklet know that growth was successful
                    this.readableBuffer = new RingBuffer(this.bufferL, Float32Array);
                    this.readableBufferLength = this.readableBuffer.availableRead();
                }
                break;
            }
        }
    }

    public setSong(song: Song | string): void {
        if (typeof (song) == "string") {
            const songMessage: LoadSongMessage = {
                flag: MessageFlag.loadSong,
                song: song
            }
            this.sendMessage(songMessage);
            this.song = new Song(song);
        } else {
            const songMessage: LoadSongMessage = {
                flag: MessageFlag.loadSong,
                song: song.toBase64String()
            }
            this.sendMessage(songMessage);
            this.song = song;
        }
    }

    public updateSong(data: any, songSetting: SongSettings, channelIndex?: number, instrumentIndex?: number, instrumentSetting?: InstrumentSettings | ChannelSettings, settingIndex?: number) {
        if (songSetting == SongSettings.updateInstrument || songSetting == SongSettings.updateChannel) {
            if (channelIndex === undefined || instrumentIndex === undefined || instrumentSetting === undefined) {
                throw new Error("missing index or setting number");
            }
        }
        const updateMessage: UpdateSongMessage = {
            flag: MessageFlag.updateSong,
            songSetting: songSetting,
            channelIndex: channelIndex,
            instrumentIndex: instrumentIndex,
            instrumentSetting: instrumentSetting,
            settingIndex: settingIndex,
            data: data
        }
        this.sendMessage(updateMessage);
    }

    private readonly liveInputPushArray: Uint16Array = new Uint16Array(Config.maxPitch);
    public addRemoveLiveInputTone(pitches: number | number[], isBass: boolean, turnOn: boolean) {
        if (typeof pitches === "number") {
            let val: number = pitches; val = val << 1;
            val += +turnOn; val = val << 1;
            val += +isBass;
            this.liveInputPushArray[0] = val;
            this.liveInputPitchesOnOffRequests.push(this.liveInputPushArray, 1);
        } else if (pitches instanceof Array && pitches.length > 0) {
            // const pushArray: Uint16Array = new Uint16Array(pitches.length)
            for (let i: number = 0; i < pitches.length; i++) {
                let val: number = pitches[i]; val = val << 1;
                val += +turnOn; val = val << 1;
                val += +isBass;
                this.liveInputPushArray[i] = val
            }
            this.liveInputPitchesOnOffRequests.push(this.liveInputPushArray, pitches.length);
        }
    }

    private async activateAudio(): Promise<void> {
        if (this.audioContext == null || this.workletNode == null || this.synthNode == null) {
            if (this.workletNode != null || this.synthNode != null) this.deactivateAudio();
            if (this.audioContext && this.audioContext.state == "suspended") this.audioContext.resume();

            const latencyHint: string = this.anticipatePoorPerformance ? (this.preferLowerLatency ? "balanced" : "playback") : (this.preferLowerLatency ? "interactive" : "balanced");
            if (!this.audioContext) this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: latencyHint });
            this.samplesPerSecond = this.audioContext!.sampleRate;

            await this.audioContext!.audioWorklet.addModule(ISPLAYER ? "../beepbox_processor.js" : "beepbox_processor.js");
            this.workletNode = new AudioWorkletNode(this.audioContext!, 'synth-processor', {
                numberOfOutputs: 1,
                outputChannelCount: [2],
                channelInterpretation: "speakers",
                channelCountMode: "explicit",
                numberOfInputs: 0
            });
            // make sure that the workletNode has access to the shared array buffers and the song
            const sabMessage: SendSharedArrayBuffers = {
                flag: MessageFlag.sharedArrayBuffers,
                bufferL: this.bufferL,
                bufferR: this.bufferR,
                liveInputValues: this.liveInputValues,
                liveInputPitchesOnOffRequests: this.liveInputPitchesSAB,
                songPosition: this.songPosition,
                outVolumeCap: this.outVolumeCap,
                sampleRate: this.audioContext!.sampleRate
                //add more here if needed
            }
            this.workletNode.port.postMessage({
                flag: MessageFlag.sabsProcessor,
                bufferL: this.bufferL,
                bufferR: this.bufferR
            });
            if (!this.synthNode) {
                this.synthNode = new Worker(ISPLAYER ? "../beepbox_synth_processor.js" : "beepbox_synth_processor.js");
                this.sendMessage(sabMessage);
            }
            if (!this.splitterNode) this.splitterNode = new ChannelSplitterNode(this.audioContext!, { numberOfOutputs: 2 });
            if (!this.analyserNodeLeft) this.analyserNodeLeft = new AnalyserNode(this.audioContext!, {
                channelCount: 2,
                channelInterpretation: "speakers",
                channelCountMode: "explicit",
                fftSize: 1024
            });
            if (!this.analyserNodeRight) this.analyserNodeRight = new AnalyserNode(this.audioContext!, {
                channelCount: 2,
                channelInterpretation: "speakers",
                channelCountMode: "explicit",
                fftSize: 1024
            });


            this.workletNode.connect(this.audioContext!.destination);
            this.workletNode.connect(this.splitterNode);
            this.splitterNode.connect(this.analyserNodeLeft, 0);
            this.splitterNode.connect(this.analyserNodeRight, 1);
            this.synthNode.onmessage = (event: MessageEvent) => this.receiveMessage(event);
            this.workletNode.port.onmessage = (event: MessageEvent) => this.receiveMessage(event);
            this.updateWorkletSong();
        }
        this.audioContext!.resume();
    }

    public updateWorkletSong(song?: string): void {
        if (this.song) {
            const songMessage: LoadSongMessage = {
                flag: MessageFlag.loadSong,
                song: song || this.song!.toBase64String()
            }
            this.sendMessage(songMessage);
            for (let channelIndex: number = 0; channelIndex < this.song.getChannelCount(); channelIndex++) {
                this.updateSong(+this.song.channels[channelIndex].muted, SongSettings.updateChannel, channelIndex, 0, ChannelSettings.muted);
            }
        }
    }

    private deactivateAudio(): void {
        if (this.audioContext != null && this.workletNode != null) {
            this.audioContext.suspend();
        }
    }

    public maintainLiveInput(): void {
        this.activateAudio();
        this.liveInputEndTime = performance.now() + 10000.0;
    }

    public updateProcessorSamplesStart(samplesMessage: SampleStartMessage) {
        this.sendMessage(samplesMessage);
    }

    public updateProcessorSamplesFinish(samples: Float32Array, index: number) {
        let samplesMessage: SampleFinishMessage = {
            flag: MessageFlag.sampleFinishMessage,
            samples: samples,
            index: index
        }
        this.sendMessage(samplesMessage);
    }

    public async updateProcessorPlugin(pluginMessage: PluginMessage): Promise<void> {
        const pluginModule = await import(pluginMessage.url);
        const pluginClass = pluginModule.default;
        const plugin: BeepBoxEffectPlugin = new pluginClass();
        Synth.PluginClass = pluginClass;
        PluginConfig.pluginUIElements = plugin.elements || [];
        PluginConfig.pluginName = plugin.pluginName || "plugin";
        PluginConfig.pluginAbout = plugin.about;
        this.sendMessage(pluginMessage);
    }

    private exportProcessor: Synth | null = null;

    private updatePlayhead(bar: number, beat: number, part: number): void {
        this.songPosition[0] = bar;
        this.songPosition[1] = beat;
        this.songPosition[2] = part;
        this.playheadInternal = (((this.tick) / 2.0 + this.songPosition[2]) / Config.partsPerBeat + this.songPosition[1]) / this.song!.beatsPerBar + this.songPosition[0];
    }

    public warmUpSynthesizer(song: Song) {
        this.initSynth();
        this.exportProcessor!.songPosition[0] = this.songPosition[0];
        this.exportProcessor!.computeLatestModValues();
        this.exportProcessor!.initModFilters(this.song);
        this.exportProcessor!.warmUpSynthesizer(song);
    }

    private initSynth() {
        if (this.exportProcessor == null) {
            this.exportProcessor = new Synth(this.deactivateAudio, () => { this.countInMetronome = false });
            this.exportProcessor.song = this.song;
            this.exportProcessor.liveInputPitchesOnOffRequests = new RingBuffer(new SharedArrayBuffer(16), Uint16Array);
        }
        this.exportProcessor.samplesPerSecond = this.samplesPerSecond;
        this.exportProcessor.renderingSong = this.renderingSong;
        this.exportProcessor.loopRepeatCount = this.loopRepeatCount;
        (globalThis as any).sampleRate = this.samplesPerSecond;
    }

    public synthesize(outputDataL: Float32Array, outputDataR: Float32Array, outputBufferLength: number, playSong: boolean = true): void {
        this.initSynth();
        this.exportProcessor!.isPlayingSong = true;
        this.exportProcessor!.synthesize(outputDataL, outputDataR, outputBufferLength, playSong);
        this.exportProcessor!.isPlayingSong = false;
    }

    public play = () => {
        if (this.isPlayingSong) return;
        this.activateAudio();
        this.isPlayingSong = true;
        const playMessage: PlayMessage = {
            flag: MessageFlag.togglePlay,
            play: this.isPlayingSong,
        }
        this.initModFilters(this.song);
        this.sendMessage(playMessage);
        this.workletNode?.port.postMessage(playMessage);
    }

    public pause(communicate: boolean = true): void {
        if (!this.isPlayingSong) return;
        this.isPlayingSong = false;
        this.isRecording = false;
        this.preferLowerLatency = false;
        //TODO: heldmods sab?

        const playMessage: PlayMessage = {
            flag: MessageFlag.togglePlay,
            play: this.isPlayingSong,
        }
        if (communicate) this.sendMessage(playMessage);
        this.workletNode?.port.postMessage(playMessage);

        this.tick = 0;
        if (!ISPLAYER) this.updatePlayhead(this.songPosition[0], 0, 0);
    }

    public startRecording(): void {
        this.preferLowerLatency = true;
        this.isRecording = true;
        const isRecordingMessage: IsRecordingMessage = {
            flag: MessageFlag.isRecording,
            isRecording: this.isRecording,
            enableMetronome: this.enableMetronome,
            countInMetronome: this.countInMetronome
        }
        this.sendMessage(isRecordingMessage);
        this.play();
    }

    public snapToStart(): void {
        this.songPosition[0] = 0;
        const resetEffectsMessage: ResetEffectsMessage = {
            flag: MessageFlag.resetEffects
        }
        this.sendMessage(resetEffectsMessage);
        this.snapToBar();
    }

    public goToBar(bar: number): void {
        this.songPosition[0] = bar;
        const resetEffectsMessage: ResetEffectsMessage = {
            flag: MessageFlag.resetEffects
        }
        this.sendMessage(resetEffectsMessage);
        this.playheadInternal = this.songPosition[0];
    }

    public snapToBar(): void {
        this.playheadInternal = this.songPosition[0];
        this.songPosition[1] = 0;
        this.songPosition[2] = 0;
        this.tick = 0;
    }

    public jumpIntoLoop(): void {
        if (!this.song) return;
        if (this.songPosition[0] < this.song.loopStart || this.songPosition[0] >= this.song.loopStart + this.song.loopLength) {
            const oldBar: number = this.songPosition[0];
            this.songPosition[0] = this.song.loopStart;
            this.playheadInternal += this.songPosition[0] - oldBar;

            if (this.playing) {
                this.computeLatestModValues();
            }
        }
    }

    public goToNextBar(): void {
        if (!this.song) return;
        const prevBar: SetPrevBarMessage = {
            flag: MessageFlag.setPrevBar,
            prevBar: this.songPosition[0]
        }
        this.sendMessage(prevBar);
        const oldBar: number = this.songPosition[0];
        this.songPosition[0]++;
        if (this.songPosition[0] >= this.song.barCount) {
            this.songPosition[0] = 0;
        }
        this.playheadInternal += this.songPosition[0] - oldBar;

        if (this.playing) {
            this.computeLatestModValues();
        }
    }

    public goToPrevBar(): void {
        if (!this.song) return;
        const prevBar: SetPrevBarMessage = {
            flag: MessageFlag.setPrevBar,
            prevBar: null
        }
        this.sendMessage(prevBar);
        const oldBar: number = this.songPosition[0];
        this.songPosition[0]--;
        if (this.songPosition[0] < 0 || this.songPosition[0] >= this.song.barCount) {
            this.songPosition[0] = this.song.barCount - 1;
        }
        this.playheadInternal += this.songPosition[0] - oldBar;

        if (this.playing) {
            this.computeLatestModValues();
        }
    }

    // Returns the total samples in the song
    public getTotalSamples(enableIntro: boolean, enableOutro: boolean, loop: number): number {
        if (this.song == null)
            return -1;

        // Compute the window to be checked (start bar to end bar)
        let startBar: number = enableIntro ? 0 : this.song.loopStart;
        let endBar: number = enableOutro ? this.song.barCount : (this.song.loopStart + this.song.loopLength);
        let hasTempoMods: boolean = false;
        let hasNextBarMods: boolean = false;
        let prevTempo: number = this.song.tempo;

        // Determine if any tempo or next bar mods happen anywhere in the window
        for (let channel: number = this.song.getChannelCount() - 1; channel >= this.song.pitchChannelCount + this.song.noiseChannelCount; channel--) {
            for (let bar: number = startBar; bar < endBar; bar++) {
                let pattern: Pattern | null = this.song.getPattern(channel, bar);
                if (pattern != null) {
                    let instrument: Instrument = this.song.channels[channel].instruments[pattern.instruments[0]];
                    for (let mod: number = 0; mod < Config.modCount; mod++) {
                        if (instrument.modulators[mod] == Config.modulators.dictionary["tempo"].index) {
                            hasTempoMods = true;
                        }
                        if (instrument.modulators[mod] == Config.modulators.dictionary["next bar"].index) {
                            hasNextBarMods = true;
                        }
                    }
                }
            }
        }

        // If intro is not zero length, determine what the "entry" tempo is going into the start part, by looking at mods that came before...
        if (startBar > 0) {
            let latestTempoPin: number | null = null;
            let latestTempoValue: number = 0;

            for (let bar: number = startBar - 1; bar >= 0; bar--) {
                //TODO: Didn't we already find the channel where the tempo mod occurs? I feel like it would be smarter to store that and iterate only over those channels...
                for (let channel: number = this.song.getChannelCount() - 1; channel >= this.song.pitchChannelCount + this.song.noiseChannelCount; channel--) {
                    let pattern = this.song.getPattern(channel, bar);

                    if (pattern != null) {
                        let instrumentIdx: number = pattern.instruments[0];
                        let instrument: Instrument = this.song.channels[channel].instruments[instrumentIdx];

                        let partsInBar: number = this.findPartsInBar(bar);

                        for (const note of pattern.notes) {
                            if (instrument.modulators[Config.modCount - 1 - note.pitches[0]] == Config.modulators.dictionary["tempo"].index) {
                                if (note.start < partsInBar && (latestTempoPin == null || note.end > latestTempoPin)) {
                                    if (note.end <= partsInBar) {
                                        latestTempoPin = note.end;
                                        latestTempoValue = note.pins[note.pins.length - 1].size;
                                    } else {
                                        latestTempoPin = partsInBar;
                                        // Find the pin where bar change happens, and compute where pin volume would be at that time
                                        for (let pinIdx = 0; pinIdx < note.pins.length; pinIdx++) {
                                            if (note.pins[pinIdx].time + note.start > partsInBar) {
                                                const transitionLength: number = note.pins[pinIdx].time - note.pins[pinIdx - 1].time;
                                                const toNextBarLength: number = partsInBar - note.start - note.pins[pinIdx - 1].time;
                                                const deltaVolume: number = note.pins[pinIdx].size - note.pins[pinIdx - 1].size;

                                                latestTempoValue = Math.round(note.pins[pinIdx - 1].size + deltaVolume * toNextBarLength / transitionLength);
                                                pinIdx = note.pins.length;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Done once you process a pattern where tempo mods happened, since the search happens backward
                if (latestTempoPin != null) {
                    prevTempo = latestTempoValue + Config.modulators.dictionary["tempo"].convertRealFactor;
                    bar = -1;
                }
            }
        }

        if (hasTempoMods || hasNextBarMods) {
            // Run from start bar to end bar and observe looping, computing average tempo across each bar
            let bar: number = startBar;
            let ended: boolean = false;
            let totalSamples: number = 0;

            while (!ended) {
                // Compute the subsection of the pattern that will play
                let partsInBar: number = Config.partsPerBeat * this.song.beatsPerBar;
                let currentPart: number = 0;

                if (hasNextBarMods) {
                    partsInBar = this.findPartsInBar(bar);
                }

                // Compute average tempo in this tick window, or use last tempo if nothing happened
                if (hasTempoMods) {
                    let foundMod: boolean = false;
                    for (let channel: number = this.song.getChannelCount() - 1; channel >= this.song.pitchChannelCount + this.song.noiseChannelCount; channel--) {
                        if (foundMod == false) {
                            let pattern: Pattern | null = this.song.getPattern(channel, bar);
                            if (pattern != null) {
                                let instrument: Instrument = this.song.channels[channel].instruments[pattern.instruments[0]];
                                for (let mod: number = 0; mod < Config.modCount; mod++) {
                                    if (foundMod == false && instrument.modulators[mod] == Config.modulators.dictionary["tempo"].index
                                        && pattern.notes.find(n => n.pitches[0] == (Config.modCount - 1 - mod))) {
                                        // Only the first tempo mod instrument for this bar will be checked (well, the first with a note in this bar).
                                        foundMod = true;
                                        // Need to re-sort the notes by start time to make the next part much less painful.
                                        pattern.notes.sort(function (a, b) { return (a.start == b.start) ? a.pitches[0] - b.pitches[0] : a.start - b.start; });
                                        for (const note of pattern.notes) {
                                            if (note.pitches[0] == (Config.modCount - 1 - mod)) {
                                                // Compute samples up to this note
                                                totalSamples += (Math.min(partsInBar - currentPart, note.start - currentPart)) * Config.ticksPerPart * this.getSamplesPerTickSpecificBPM(prevTempo);

                                                if (note.start < partsInBar) {
                                                    for (let pinIdx: number = 1; pinIdx < note.pins.length; pinIdx++) {
                                                        // Compute samples up to this pin
                                                        if (note.pins[pinIdx - 1].time + note.start <= partsInBar) {
                                                            const tickLength: number = Config.ticksPerPart * Math.min(partsInBar - (note.start + note.pins[pinIdx - 1].time), note.pins[pinIdx].time - note.pins[pinIdx - 1].time);
                                                            const prevPinTempo: number = note.pins[pinIdx - 1].size + Config.modulators.dictionary["tempo"].convertRealFactor;
                                                            let currPinTempo: number = note.pins[pinIdx].size + Config.modulators.dictionary["tempo"].convertRealFactor;
                                                            if (note.pins[pinIdx].time + note.start > partsInBar) {
                                                                // Compute an intermediary tempo since bar changed over mid-pin. Maybe I'm deep in "what if" territory now!
                                                                currPinTempo = note.pins[pinIdx - 1].size + (note.pins[pinIdx].size - note.pins[pinIdx - 1].size) * (partsInBar - (note.start + note.pins[pinIdx - 1].time)) / (note.pins[pinIdx].time - note.pins[pinIdx - 1].time) + Config.modulators.dictionary["tempo"].convertRealFactor;
                                                            }
                                                            let bpmScalar: number = Config.partsPerBeat * Config.ticksPerPart / 60;

                                                            if (currPinTempo != prevPinTempo) {

                                                                // Definite integral of SamplesPerTick w/r/t beats to find total samples from start point to end point for a variable tempo
                                                                // The starting formula is
                                                                // SamplesPerTick = SamplesPerSec / ((PartsPerBeat * TicksPerPart) / SecPerMin) * BeatsPerMin )
                                                                //
                                                                // This is an expression of samples per tick "instantaneously", and it can be multiplied by a number of ticks to get a sample count.
                                                                // But this isn't the full story. BeatsPerMin, e.g. tempo, changes throughout the interval so it has to be expressed in terms of ticks, "t"
                                                                // ( Also from now on PartsPerBeat, TicksPerPart, and SecPerMin are combined into one scalar, called "BPMScalar" )
                                                                // Substituting BPM for a step variable that moves with respect to the current tick, we get
                                                                // SamplesPerTick = SamplesPerSec / (BPMScalar * ( (EndTempo - StartTempo / TickLength) * t + StartTempo ) )
                                                                //
                                                                // When this equation is integrated from 0 to TickLength with respect to t, we get the following expression:
                                                                //   Samples = - SamplesPerSec * TickLength * ( log( BPMScalar * EndTempo * TickLength ) - log( BPMScalar * StartTempo * TickLength ) ) / BPMScalar * ( StartTempo - EndTempo )

                                                                totalSamples += - this.samplesPerSecond * tickLength * (Math.log(bpmScalar * currPinTempo * tickLength) - Math.log(bpmScalar * prevPinTempo * tickLength)) / (bpmScalar * (prevPinTempo - currPinTempo));

                                                            } else {

                                                                // No tempo change between the two pins.
                                                                totalSamples += tickLength * this.getSamplesPerTickSpecificBPM(currPinTempo);

                                                            }
                                                            prevTempo = currPinTempo;
                                                        }
                                                        currentPart = Math.min(note.start + note.pins[pinIdx].time, partsInBar);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Compute samples for the rest of the bar
                totalSamples += (partsInBar - currentPart) * Config.ticksPerPart * this.getSamplesPerTickSpecificBPM(prevTempo);

                bar++;
                if (loop != 0 && bar == this.song.loopStart + this.song.loopLength) {
                    bar = this.song.loopStart;
                    if (loop > 0) loop--;
                }
                if (bar >= endBar) {
                    ended = true;
                }

            }

            return Math.ceil(totalSamples);
        } else {
            // No tempo or next bar mods... phew! Just calculate normally.
            return this.getSamplesPerBar() * this.getTotalBars(enableIntro, enableOutro, loop);
        }
    }

    public getSamplesPerBar(): number {
        if (this.song == null) throw new Error();
        return this.getSamplesPerTick() * Config.ticksPerPart * Config.partsPerBeat * this.song.beatsPerBar;
    }

    public getTotalBars(enableIntro: boolean, enableOutro: boolean, useLoopCount: number = this.loopRepeatCount): number {
        if (this.song == null) throw new Error();
        let bars: number = this.song.loopLength * (useLoopCount + 1);
        if (enableIntro) bars += this.song.loopStart;
        if (enableOutro) bars += this.song.barCount - (this.song.loopStart + this.song.loopLength);
        return bars;
    }

    public computeLatestModValues(modEffects: boolean = false): void {
        //tell procecssor to also compute mod values
        const computeModsMessage: ComputeModsMessage = {
            flag: MessageFlag.computeMods,
            initFilters: modEffects
        }
        this.sendMessage(computeModsMessage);
        this.computeMods();
    }

    private computeMods(): void {
        if (this.song != null) this.currentTempo = this.song.tempo;
        if (this.song != null && this.song.modChannelCount > 0) {

            // Clear all mod values, and set up temp variables for the time a mod would be set at.
            let latestModTimes: (number | null)[] = [];
            let latestModInsTimes: (number | null)[][][] = [];
            this.modValues = [];
            this.nextModValues = [];
            this.modInsValues = [];
            this.nextModInsValues = [];
            this.heldMods = [];

            for (let channel: number = 0; channel < this.song.pitchChannelCount + this.song.noiseChannelCount; channel++) {
                latestModInsTimes[channel] = [];
                this.modInsValues[channel] = [];
                this.nextModInsValues[channel] = [];

                for (let instrument: number = 0; instrument < this.song.channels[channel].instruments.length; instrument++) {
                    this.modInsValues[channel][instrument] = [];
                    this.nextModInsValues[channel][instrument] = [];
                    latestModInsTimes[channel][instrument] = [];
                }
            }

            // Find out where we're at in the fraction of the current bar.
            let currentPart: number = this.songPosition[1] * Config.partsPerBeat + this.songPosition[2];

            // For mod channels, calculate last set value for each mod
            for (let channelIndex: number = this.song.pitchChannelCount + this.song.noiseChannelCount; channelIndex < this.song.getChannelCount(); channelIndex++) {
                if (!(this.song.channels[channelIndex].muted)) {

                    let pattern: Pattern | null;

                    for (let currentBar: number = this.songPosition[0]; currentBar >= 0; currentBar--) {
                        pattern = this.song.getPattern(channelIndex, currentBar);

                        if (pattern != null) {
                            let instrumentIdx: number = pattern.instruments[0];
                            let instrument: Instrument = this.song.channels[channelIndex].instruments[instrumentIdx];
                            let latestPinParts: number[] = [];
                            let latestPinValues: number[] = [];

                            let partsInBar: number = (currentBar == this.songPosition[0])
                                ? currentPart
                                : this.findPartsInBar(currentBar);

                            for (const note of pattern.notes) {
                                if (note.start <= partsInBar && (latestPinParts[Config.modCount - 1 - note.pitches[0]] == null || note.end > latestPinParts[Config.modCount - 1 - note.pitches[0]])) {
                                    if (note.start == partsInBar) { // This can happen with next bar mods, and the value of the aligned note's start pin will be used.
                                        latestPinParts[Config.modCount - 1 - note.pitches[0]] = note.start;
                                        latestPinValues[Config.modCount - 1 - note.pitches[0]] = note.pins[0].size;
                                    }
                                    if (note.end <= partsInBar) {
                                        latestPinParts[Config.modCount - 1 - note.pitches[0]] = note.end;
                                        latestPinValues[Config.modCount - 1 - note.pitches[0]] = note.pins[note.pins.length - 1].size;
                                    } else {
                                        latestPinParts[Config.modCount - 1 - note.pitches[0]] = partsInBar;
                                        // Find the pin where bar change happens, and compute where pin volume would be at that time
                                        for (let pinIdx = 0; pinIdx < note.pins.length; pinIdx++) {
                                            if (note.pins[pinIdx].time + note.start > partsInBar) {
                                                const transitionLength: number = note.pins[pinIdx].time - note.pins[pinIdx - 1].time;
                                                const toNextBarLength: number = partsInBar - note.start - note.pins[pinIdx - 1].time;
                                                const deltaVolume: number = note.pins[pinIdx].size - note.pins[pinIdx - 1].size;

                                                latestPinValues[Config.modCount - 1 - note.pitches[0]] = note.pins[pinIdx - 1].size + deltaVolume * toNextBarLength / transitionLength;
                                                pinIdx = note.pins.length;
                                            }
                                        }
                                    }
                                }
                            }

                            // Set modulator value, if it wasn't set in another pattern already scanned
                            for (let mod: number = 0; mod < Config.modCount; mod++) {
                                if (latestPinParts[mod] != null) {
                                    if (Config.modulators[instrument.modulators[mod]].forSong) {
                                        const songFilterParam: boolean = instrument.modulators[mod] == Config.modulators.dictionary["song eq"].index;
                                        if (latestModTimes[instrument.modulators[mod]] == null || currentBar * Config.partsPerBeat * this.song.beatsPerBar + latestPinParts[mod] > (latestModTimes[instrument.modulators[mod]] as number)) {
                                            if (songFilterParam) {
                                                let tgtSong: Song = this.song
                                                if (instrument.modFilterTypes[mod] == 0) {
                                                    tgtSong.tmpEqFilterStart = tgtSong.eqSubFilters[latestPinValues[mod]];
                                                } else {
                                                    for (let i: number = 0; i < Config.filterMorphCount; i++) {
                                                        if (tgtSong.tmpEqFilterStart != null && tgtSong.tmpEqFilterStart == tgtSong.eqSubFilters[i]) {
                                                            tgtSong.tmpEqFilterStart = new FilterSettings();
                                                            tgtSong.tmpEqFilterStart.fromJsonObject(tgtSong.eqSubFilters[i]!.toJsonObject());
                                                            i = Config.filterMorphCount;
                                                        }
                                                    }
                                                    if (tgtSong.tmpEqFilterStart != null && Math.floor((instrument.modFilterTypes[mod] - 1) / 2) < tgtSong.tmpEqFilterStart.controlPointCount) {
                                                        if (instrument.modFilterTypes[mod] & 1)
                                                            tgtSong.tmpEqFilterStart.controlPoints[Math.floor((instrument.modFilterTypes[mod] - 1) / 2)].freq = latestPinValues[mod];
                                                        else
                                                            tgtSong.tmpEqFilterStart.controlPoints[Math.floor((instrument.modFilterTypes[mod] - 1) / 2)].gain = latestPinValues[mod];
                                                    }
                                                }
                                                tgtSong.tmpEqFilterEnd = tgtSong.tmpEqFilterStart;
                                            }
                                            this.setModValue(latestPinValues[mod], latestPinValues[mod], instrument.modChannels[mod], instrument.modInstruments[mod], instrument.modulators[mod]);
                                            latestModTimes[instrument.modulators[mod]] = currentBar * Config.partsPerBeat * this.song.beatsPerBar + latestPinParts[mod];
                                            if (instrument.modulators[mod] == Config.modulators.dictionary["tempo"].index) this.currentTempo = latestPinValues[mod];
                                        }
                                    } else {
                                        // Generate list of used instruments
                                        let usedInstruments: number[] = [];
                                        // All
                                        if (instrument.modInstruments[mod] == this.song.channels[instrument.modChannels[mod]].instruments.length) {
                                            for (let i: number = 0; i < this.song.channels[instrument.modChannels[mod]].instruments.length; i++) {
                                                usedInstruments.push(i);
                                            }
                                        } // Active
                                        else if (instrument.modInstruments[mod] > this.song.channels[instrument.modChannels[mod]].instruments.length) {
                                            const tgtPattern: Pattern | null = this.song.getPattern(instrument.modChannels[mod], currentBar);
                                            if (tgtPattern != null)
                                                usedInstruments = tgtPattern.instruments;
                                        } else {
                                            usedInstruments.push(instrument.modInstruments[mod]);
                                        }
                                        for (let instrumentIndex: number = 0; instrumentIndex < usedInstruments.length; instrumentIndex++) {
                                            // Iterate through all used instruments by this modulator
                                            // Special indices for mod filter targets, since they control multiple things.
                                            const eqFilterParam: boolean = instrument.modulators[mod] == Config.modulators.dictionary["eq filter"].index;
                                            const noteFilterParam: boolean = instrument.modulators[mod] == Config.modulators.dictionary["note filter"].index;
                                            let modulatorAdjust: number = instrument.modulators[mod];
                                            if (eqFilterParam) {
                                                modulatorAdjust = Config.modulators.length + (instrument.modFilterTypes[mod] | 0);
                                            } else if (noteFilterParam) {
                                                // Skip all possible indices for eq filter
                                                modulatorAdjust = Config.modulators.length + 1 + (2 * Config.filterMaxPoints) + (instrument.modFilterTypes[mod] | 0);
                                            }

                                            if (latestModInsTimes[instrument.modChannels[mod]][usedInstruments[instrumentIndex]][modulatorAdjust] == null
                                                || currentBar * Config.partsPerBeat * this.song.beatsPerBar + latestPinParts[mod] > latestModInsTimes[instrument.modChannels[mod]][usedInstruments[instrumentIndex]][modulatorAdjust]!) {

                                                if (eqFilterParam) {
                                                    let tgtInstrument: Instrument = this.song.channels[instrument.modChannels[mod]].instruments[usedInstruments[instrumentIndex]];
                                                    if (instrument.modFilterTypes[mod] == 0) {
                                                        tgtInstrument.tmpEqFilterStart = tgtInstrument.eqSubFilters[latestPinValues[mod]];
                                                    } else {
                                                        for (let i: number = 0; i < Config.filterMorphCount; i++) {
                                                            if (tgtInstrument.tmpEqFilterStart != null && tgtInstrument.tmpEqFilterStart == tgtInstrument.eqSubFilters[i]) {
                                                                tgtInstrument.tmpEqFilterStart = new FilterSettings();
                                                                tgtInstrument.tmpEqFilterStart.fromJsonObject(tgtInstrument.eqSubFilters[i]!.toJsonObject());
                                                                i = Config.filterMorphCount;
                                                            }
                                                        }
                                                        if (tgtInstrument.tmpEqFilterStart != null && Math.floor((instrument.modFilterTypes[mod] - 1) / 2) < tgtInstrument.tmpEqFilterStart.controlPointCount) {
                                                            if (instrument.modFilterTypes[mod] % 2)
                                                                tgtInstrument.tmpEqFilterStart.controlPoints[Math.floor((instrument.modFilterTypes[mod] - 1) / 2)].freq = latestPinValues[mod];
                                                            else
                                                                tgtInstrument.tmpEqFilterStart.controlPoints[Math.floor((instrument.modFilterTypes[mod] - 1) / 2)].gain = latestPinValues[mod];
                                                        }
                                                    }
                                                    tgtInstrument.tmpEqFilterEnd = tgtInstrument.tmpEqFilterStart;
                                                } else if (noteFilterParam) {
                                                    let tgtInstrument: Instrument = this.song.channels[instrument.modChannels[mod]].instruments[usedInstruments[instrumentIndex]];
                                                    if (instrument.modFilterTypes[mod] == 0) {
                                                        tgtInstrument.tmpNoteFilterStart = tgtInstrument.noteSubFilters[latestPinValues[mod]];
                                                    } else {
                                                        for (let i: number = 0; i < Config.filterMorphCount; i++) {
                                                            if (tgtInstrument.tmpNoteFilterStart != null && tgtInstrument.tmpNoteFilterStart == tgtInstrument.noteSubFilters[i]) {
                                                                tgtInstrument.tmpNoteFilterStart = new FilterSettings();
                                                                tgtInstrument.tmpNoteFilterStart.fromJsonObject(tgtInstrument.noteSubFilters[i]!.toJsonObject());
                                                                i = Config.filterMorphCount;
                                                            }
                                                        }
                                                        if (tgtInstrument.tmpNoteFilterStart != null && Math.floor((instrument.modFilterTypes[mod] - 1) / 2) < tgtInstrument.tmpNoteFilterStart.controlPointCount) {
                                                            if (instrument.modFilterTypes[mod] % 2)
                                                                tgtInstrument.tmpNoteFilterStart.controlPoints[Math.floor((instrument.modFilterTypes[mod] - 1) / 2)].freq = latestPinValues[mod];
                                                            else
                                                                tgtInstrument.tmpNoteFilterStart.controlPoints[Math.floor((instrument.modFilterTypes[mod] - 1) / 2)].gain = latestPinValues[mod];
                                                        }
                                                    }
                                                    tgtInstrument.tmpNoteFilterEnd = tgtInstrument.tmpNoteFilterStart;
                                                } else this.setModValue(latestPinValues[mod], latestPinValues[mod], instrument.modChannels[mod], usedInstruments[instrumentIndex], modulatorAdjust);

                                                latestModInsTimes[instrument.modChannels[mod]][usedInstruments[instrumentIndex]][modulatorAdjust] = currentBar * Config.partsPerBeat * this.song.beatsPerBar + latestPinParts[mod];
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    /** Detects if a modulator is set, but not valid for the current effects/instrument type/filter type
    * Note, setting 'none' or the intermediary steps when clicking to add a mod, like an unset channel/unset instrument, counts as valid.
    // TODO: This kind of check is mirrored in SongEditor.ts' whenUpdated. Creates a lot of redundancy for adding new mods. Can be moved into new properties for mods, to avoid this later.
    */
    public determineInvalidModulators(instrument: Instrument): void {
        if (this.song == null)
            return;
        for (let mod: number = 0; mod < Config.modCount; mod++) {
            instrument.invalidModulators[mod] = true;
            // For song modulator, valid if any setting used
            if (instrument.modChannels[mod] == -1) {
                if (instrument.modulators[mod] != 0)
                    instrument.invalidModulators[mod] = false;
                continue;
            }
            const channel: Channel | null = this.song.channels[instrument.modChannels[mod]];
            if (channel == null) continue;
            let tgtInstrumentList: Instrument[] = [];
            if (instrument.modInstruments[mod] >= channel.instruments.length) { // All or active
                tgtInstrumentList = channel.instruments;
            } else {
                tgtInstrumentList = [channel.instruments[instrument.modInstruments[mod]]];
            }
            for (let i: number = 0; i < tgtInstrumentList.length; i++) {
                const tgtInstrument: Instrument | null = tgtInstrumentList[i];
                if (tgtInstrument == null) continue;
                const str: string = Config.modulators[instrument.modulators[mod]].name;
                // Check effects
                if (!((Config.modulators[instrument.modulators[mod]].associatedEffect != EffectType.length && !(tgtInstrument.effects & (1 << Config.modulators[instrument.modulators[mod]].associatedEffect)))
                    // Instrument type specific
                    || ((tgtInstrument.type != InstrumentType.fm && tgtInstrument.type != InstrumentType.fm6op) && (str == "fm slider 1" || str == "fm slider 2" || str == "fm slider 3" || str == "fm slider 4" || str == "fm feedback"))
                    || tgtInstrument.type != InstrumentType.fm6op && (str == "fm slider 5" || str == "fm slider 6")
                    || ((tgtInstrument.type != InstrumentType.pwm && tgtInstrument.type != InstrumentType.supersaw) && (str == "pulse width" || str == "decimal offset"))
                    || ((tgtInstrument.type != InstrumentType.supersaw) && (str == "dynamism" || str == "spread" || str == "saw shape"))
                    // Arp check
                    || (!tgtInstrument.getChord().arpeggiates && (str == "arp speed" || str == "reset arp"))
                    // EQ Filter check
                    || (tgtInstrument.eqFilterType && str == "eq filter")
                    || (!tgtInstrument.eqFilterType && (str == "eq filt cut" || str == "eq filt peak"))
                    || (str == "eq filter" && Math.floor((instrument.modFilterTypes[mod] + 1) / 2) > tgtInstrument.getLargestControlPointCount(false))
                    // Note Filter check
                    || (tgtInstrument.noteFilterType && str == "note filter")
                    || (!tgtInstrument.noteFilterType && (str == "note filt cut" || str == "note filt peak"))
                    || (str == "note filter" && Math.floor((instrument.modFilterTypes[mod] + 1) / 2) > tgtInstrument.getLargestControlPointCount(true)))) {

                    instrument.invalidModulators[mod] = false;
                    i = tgtInstrumentList.length;
                }
            }
        }
    }

    public unsetMod(setting: number, channel?: number, instrument?: number) {
        if (this.isModActive(setting) || (channel != undefined && instrument != undefined && this.isModActive(setting, channel, instrument))) {
            this.modValues[setting] = -1;
            this.nextModValues[setting] = -1;
            for (let i: number = 0; i < this.heldMods.length; i++) {
                if (channel != undefined && instrument != undefined) {
                    if (this.heldMods[i].channelIndex == channel && this.heldMods[i].instrumentIndex == instrument && this.heldMods[i].setting == setting)
                        this.heldMods.splice(i, 1);
                } else {
                    if (this.heldMods[i].setting == setting)
                        this.heldMods.splice(i, 1);
                }
            }
            if (channel != undefined && instrument != undefined) {
                this.modInsValues[channel][instrument][setting] = null;
                this.nextModInsValues[channel][instrument][setting] = null;
            }
        }
    }

    // Checks if any mod is active for the given channel/instrument OR if any mod is active for the song scope. Could split the logic if needed later.
    public isAnyModActive(channel: number, instrument: number): boolean {
        for (let setting: number = 0; setting < Config.modulators.length; setting++) {
            if ((this.modValues != undefined && this.modValues[setting] != null)
                || (this.modInsValues != undefined && this.modInsValues[channel] != undefined && this.modInsValues[channel][instrument] != undefined && this.modInsValues[channel][instrument][setting] != null)) {
                return true;
            }
        }
        return false;
    }

    public isFilterModActive(forNoteFilter: boolean, channelIdx: number, instrumentIdx: number, forSong?: boolean) {
        const instrument: Instrument = this.song!.channels[channelIdx].instruments[instrumentIdx];

        if (forNoteFilter) {
            if (instrument.noteFilterType)
                return false;
            if (instrument.tmpNoteFilterEnd != null)
                return true;
        } else {
            if (forSong) {
                if (this?.song?.tmpEqFilterEnd != null)
                    return true;
            } else {
                if (instrument.eqFilterType)
                    return false;
                if (instrument.tmpEqFilterEnd != null)
                    return true;
            }
        }

        return false
    }

    // Force a modulator to be held at the given volumeStart for a brief duration.
    public forceHoldMods(volumeStart: number, channelIndex: number, instrumentIndex: number, setting: number): void {
        let found: boolean = false;
        for (let i: number = 0; i < this.heldMods.length; i++) {
            if (this.heldMods[i].channelIndex == channelIndex && this.heldMods[i].instrumentIndex == instrumentIndex && this.heldMods[i].setting == setting) {
                this.heldMods[i].volume = volumeStart;
                this.heldMods[i].holdFor = 24;
                found = true;
            }
        }
        // Default: hold for 24 ticks / 12 parts (half a beat).
        if (!found)
            this.heldMods.push({ volume: volumeStart, channelIndex: channelIndex, instrumentIndex: instrumentIndex, setting: setting, holdFor: 24 });
    }

    public static adjacentNotesHaveMatchingPitches(firstNote: Note, secondNote: Note): boolean {
        if (firstNote.pitches.length != secondNote.pitches.length) return false;
        const firstNoteInterval: number = firstNote.pins[firstNote.pins.length - 1].interval;
        for (const pitch of firstNote.pitches) {
            if (secondNote.pitches.indexOf(pitch + firstNoteInterval) == -1) return false;
        }
        return true;
    }
}

// When compiling synth.ts as a standalone module named "beepbox", expose these classes as members to JavaScript:
export { Dictionary, DictionaryArray, FilterType, EnvelopeType, InstrumentType, Transition, Chord, Envelope, Config };
