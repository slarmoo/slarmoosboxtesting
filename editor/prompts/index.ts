/*
This file takes everything in the prompts folder and exports it as a module, which is then imported as "Prompts" in SongEditor.ts
*/

import { AddSamplesPrompt } from "./AddSamplesPrompt";
import { BeatsPerBarPrompt } from "./BeatsPerBarPrompt";
import { ChannelSettingsPrompt } from "./ChannelSettingsPrompt";
import { CustomChipPrompt } from "./CustomChipPrompt";
import { CustomFilterPrompt } from "./CustomFilterPrompt";
import { CustomScalePrompt } from "./CustomScalePrompt";
import { CustomThemePrompt } from "./CustomThemePrompt";
import { EuclideanRhythmPrompt } from "./EuclidgenRhythmPrompt";
import { ExportPrompt } from "./ExportPrompt";
import { HarmonicsEditorPrompt } from "./HarmonicsEditorPrompt"; 
import { ImportPrompt } from "./ImportPrompt";
import { InstrumentExportPrompt } from "./InstrumentExportPrompt";
import { InstrumentImportPrompt } from "./InstrumentImportPrompt";
import { LayoutPrompt } from "./LayoutPrompt";
import { LimiterPrompt } from "./LimiterPrompt";
import { MoveNotesSidewaysPrompt } from "./MoveNotesSidewaysPrompt";
import { MultithreadingSetupPrompt } from "./MultithreadingSetupPrompt";
import { PluginPrompt } from "./PluginPrompt";
import { RecordingSetupPrompt } from "./RecordingSetupPrompt";
import { SampleLoadingStatusPrompt } from "./SampleLoadingStatusPrompt";
import { SequenceEditorPrompt } from "./SequenceEditorPrompt";
import { ShortenerConfigPrompt } from "./ShortenerConfigPrompt";
import { SongDurationPrompt } from "./SongDurationPrompt";
import { SongRecoveryPrompt } from "./SongRecoveryPrompt";
import { SpectrumEditorPrompt } from "./SpectrumEditorPrompt";
import { SustainPrompt } from "./SustainPrompt";
import { ThemePrompt } from "./ThemePrompt";
import { TipPrompt } from "./TipPrompt";
import { VisualLoopControlsPrompt } from "./VisualLoopControlsPrompt";

export {
    AddSamplesPrompt, BeatsPerBarPrompt, ChannelSettingsPrompt, CustomChipPrompt, CustomFilterPrompt, CustomScalePrompt,
    CustomThemePrompt, EuclideanRhythmPrompt, ExportPrompt, HarmonicsEditorPrompt, ImportPrompt, InstrumentExportPrompt,
    InstrumentImportPrompt, LayoutPrompt, LimiterPrompt, MoveNotesSidewaysPrompt, MultithreadingSetupPrompt, PluginPrompt,
    RecordingSetupPrompt, SampleLoadingStatusPrompt, SequenceEditorPrompt, ShortenerConfigPrompt, SongDurationPrompt,
    SongRecoveryPrompt, SpectrumEditorPrompt, SustainPrompt, ThemePrompt, TipPrompt, VisualLoopControlsPrompt
}
