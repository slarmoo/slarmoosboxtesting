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
    livePitches: Int8Array,
    bassLivePitches: Int8Array,
    liveInputValues: Uint32Array
}

export interface SetPrevBarMessage extends Message {
    flag: MessageFlag.setPrevBar,
    prevBar: number | null
}