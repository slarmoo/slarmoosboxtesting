// The structures for message sending

export enum MessageFlag {
    loadSong,
    togglePlay,
    deactivate,
    songPosition,
    maintainLiveInput,
    resetEffects,
    computeMods,
    sharedArrayBuffers,
    setPrevBar,
    isRecording,
    oscilloscope,
    synthVolume,
    updateSong,
}

export enum LiveInputValues {
    liveInputDuration,
    liveBassInputDuration,
    liveInputStarted,
    liveBassInputStarted,
    liveInputChannel,
    liveBassInputChannel,
}

export interface Message {
    flag: MessageFlag
}

export interface PlayMessage extends Message {
    flag: MessageFlag.togglePlay,
    play: boolean,
}

export interface LoadSongMessage extends Message {
    flag: MessageFlag.loadSong,
    song: string
}

export interface DeactivateMessage extends Message {
    flag: MessageFlag.deactivate
}

export interface SongPositionMessage extends Message {
    flag: MessageFlag.songPosition,
    bar: number,
    beat: number,
    part: number
}

export interface MaintainLiveInputMessage extends Message {
    flag: MessageFlag.maintainLiveInput,
}

export interface ResetEffectsMessage extends Message {
    flag: MessageFlag.resetEffects
}

export interface ComputeModsMessage extends Message {
    flag: MessageFlag.computeMods,
    initFilters: boolean
}

export interface SendSharedArrayBuffers extends Message {
    flag: MessageFlag.sharedArrayBuffers,
    liveInputValues: Uint32Array,
    liveInputPitchesOnOffRequests: SharedArrayBuffer
}

export interface SetPrevBarMessage extends Message {
    flag: MessageFlag.setPrevBar,
    prevBar: number | null
}

export interface IsRecordingMessage extends Message {
    flag: MessageFlag.isRecording,
    isRecording: boolean,
    enableMetronome: boolean,
    countInMetronome: boolean
}

export interface OscilloscopeMessage extends Message {
    flag: MessageFlag.oscilloscope,
    left: Float32Array,
    right: Float32Array
}

export interface SynthVolumeMessage extends Message {
    flag: MessageFlag.synthVolume,
    volume: number
}

export interface UpdateSongMessage extends Message {
    flag: MessageFlag.updateSong,
    songSetting: SongSettings,
    channelIndex?: number,
    instrumentIndex?: number,
    instrumentSetting?: InstrumentSettings | ChannelSettings,
    settingIndex?: number, 
    data: number | string | null

}

export enum SongSettings {
    title,
    scale,
    scaleCustom,
    key,
    octave,
    tempo,
    beatsPerBar,
    barCount,
    patternsPerChannel,
    rhythm,
    instrumentFlags,
    loopStart,
    loopLength,
    pitchChannelCount,
    noiseChannelCount,
    modChannelCount,
    limiterSettings,
    inVolumeCap,
    outVolumeCap,
    eqFilter,
    eqSubFilters,
    addSequence,
    sequenceLength,
    sequenceHeight,
    sequenceValues,
    pluginurl, 
    channelOrder,
    updateChannel,
    updateInstrument,
}

export enum ChannelSettings {
    fromJson,
    pattern,
    allPatterns,
    bars,
    muted,
    newInstrument,
    instruments,
}

export enum InstrumentSettings {
    fromJson, //for things like choosing a different preset or importing a json
    type,
    preset,
    chipWave,
    isUsingAdvancedLoopControls,
    chipWaveLoopStart,
    chipWaveLoopEnd,
    chipWaveLoopMode,
    chipWavePlayBackwards,
    chipWaveStartOffset,
    chipNoise,
    eqFilter,
    eqFilterType,
    eqFilterSimpleCut,
    eqFilterSimplePeak,
    noteFilter,
    noteFilterType,
    noteFilterSimpleCut,
    noteFilterSimplePeak,
    eqSubFilters,
    noteSubFilters,
    envelopes,
    fadeIn,
    fadeOut,
    envelopeCount,
    transition,
    slideSpeed,
    pitchShift,
    detune,
    vibrato,
    interval,
    vibratoDepth,
    vibratoSpeed,
    vibratoDelay,
    vibratoType,
    envelopeSpeed,
    unison,
    unisonVoices,
    unisonSpread,
    unisonOffset,
    unisonExpression,
    unisonSign,
    unisonAntiPhased,
    unisonBuzzes,
    effects,
    chord,
    strumSpeed,
    volume,
    pan,
    panDelay,
    arpeggioSpeed,
    monoChordTone,
    fastTwoNoteArp,
    legacyTieOver,
    clicklessTransition,
    aliases,
    pulseWidth,
    decimalOffset,
    supersawDynamism,
    supersawSpread,
    supersawShape,
    stringSustain,
    stringSustainType,
    distortion,
    bitcrusherFreq,
    bitcrusherQuantization,
    ringModulation,
    ringModulationHz,
    ringModWaveformIndex,
    ringModPulseWidth,
    ringModHzOffset,
    granular,
    grainSize,
    grainFreq,
    grainRange,
    chorus,
    reverb,
    echoSustain,
    echoDelay,
    upperNoteLimit,
    lowerNoteLimit,
    pluginValues,
    algorithm,
    feedbackType,
    algorithm6Op,
    feedbackType6Op,
    customAlgorithm,
    customFeedbackType, 
    feedbackAmplitude,
    customChipWave,
    customChipWaveIntegral,
    operators,
    // operatorFrequency,
    // operatorAmplitude, 
    // operatorWaveform,
    // operatorPulseWidth,
    spectrumWave,
    harmonicsWave,
    drumsetEnvelopes,
    drumsetSpectrumWaves,
    modChannels,
    modInstruments,
    modulators,
    modFilterTypes,
    modEnvelopeNumbers,
    invalidModulators,
}