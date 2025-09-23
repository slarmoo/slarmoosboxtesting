var beepbox = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // synth/synth.ts
  var synth_exports = {};
  __export(synth_exports, {
    Channel: () => Channel,
    Config: () => Config,
    CustomAlgorithm: () => CustomAlgorithm,
    CustomFeedBack: () => CustomFeedBack,
    EnvelopeSettings: () => EnvelopeSettings,
    EnvelopeType: () => EnvelopeType,
    FilterControlPoint: () => FilterControlPoint,
    FilterSettings: () => FilterSettings,
    FilterType: () => FilterType,
    HarmonicsWave: () => HarmonicsWave,
    Instrument: () => Instrument,
    InstrumentType: () => InstrumentType,
    Note: () => Note,
    Operator: () => Operator,
    Pattern: () => Pattern,
    Song: () => Song,
    SpectrumWave: () => SpectrumWave,
    SynthMessenger: () => SynthMessenger,
    clamp: () => clamp,
    makeNotePin: () => makeNotePin,
    parseFloatWithDefault: () => parseFloatWithDefault,
    parseIntWithDefault: () => parseIntWithDefault
  });

  // synth/SynthConfig.ts
  var FilterType = /* @__PURE__ */ ((FilterType2) => {
    FilterType2[FilterType2["lowPass"] = 0] = "lowPass";
    FilterType2[FilterType2["highPass"] = 1] = "highPass";
    FilterType2[FilterType2["peak"] = 2] = "peak";
    FilterType2[FilterType2["length"] = 3] = "length";
    return FilterType2;
  })(FilterType || {});
  var EnvelopeType = /* @__PURE__ */ ((EnvelopeType2) => {
    EnvelopeType2[EnvelopeType2["none"] = 0] = "none";
    EnvelopeType2[EnvelopeType2["noteSize"] = 1] = "noteSize";
    EnvelopeType2[EnvelopeType2["pitch"] = 2] = "pitch";
    EnvelopeType2[EnvelopeType2["pseudorandom"] = 3] = "pseudorandom";
    EnvelopeType2[EnvelopeType2["punch"] = 4] = "punch";
    EnvelopeType2[EnvelopeType2["flare"] = 5] = "flare";
    EnvelopeType2[EnvelopeType2["twang"] = 6] = "twang";
    EnvelopeType2[EnvelopeType2["swell"] = 7] = "swell";
    EnvelopeType2[EnvelopeType2["lfo"] = 8] = "lfo";
    EnvelopeType2[EnvelopeType2["tremolo2"] = 9] = "tremolo2";
    EnvelopeType2[EnvelopeType2["decay"] = 10] = "decay";
    EnvelopeType2[EnvelopeType2["wibble"] = 11] = "wibble";
    EnvelopeType2[EnvelopeType2["linear"] = 12] = "linear";
    EnvelopeType2[EnvelopeType2["rise"] = 13] = "rise";
    EnvelopeType2[EnvelopeType2["blip"] = 14] = "blip";
    EnvelopeType2[EnvelopeType2["fall"] = 15] = "fall";
    return EnvelopeType2;
  })(EnvelopeType || {});
  var InstrumentType = /* @__PURE__ */ ((InstrumentType2) => {
    InstrumentType2[InstrumentType2["chip"] = 0] = "chip";
    InstrumentType2[InstrumentType2["fm"] = 1] = "fm";
    InstrumentType2[InstrumentType2["noise"] = 2] = "noise";
    InstrumentType2[InstrumentType2["spectrum"] = 3] = "spectrum";
    InstrumentType2[InstrumentType2["drumset"] = 4] = "drumset";
    InstrumentType2[InstrumentType2["harmonics"] = 5] = "harmonics";
    InstrumentType2[InstrumentType2["pwm"] = 6] = "pwm";
    InstrumentType2[InstrumentType2["pickedString"] = 7] = "pickedString";
    InstrumentType2[InstrumentType2["supersaw"] = 8] = "supersaw";
    InstrumentType2[InstrumentType2["customChipWave"] = 9] = "customChipWave";
    InstrumentType2[InstrumentType2["mod"] = 10] = "mod";
    InstrumentType2[InstrumentType2["fm6op"] = 11] = "fm6op";
    InstrumentType2[InstrumentType2["length"] = 12] = "length";
    return InstrumentType2;
  })(InstrumentType || {});
  var TypePresets = ["chip", "FM", "noise", "spectrum", "drumset", "harmonics", "pulse width", "picked string", "supersaw", "chip (custom)", "mod", "FM (6-op)"];
  var SampleLoadingState = class {
    static {
      __name(this, "SampleLoadingState");
    }
    constructor() {
      this.statusTable = {};
      this.urlTable = {};
      this.totalSamples = 0;
      this.samplesLoaded = 0;
    }
  };
  var sampleLoadingState = new SampleLoadingState();
  var SampleLoadedEvent = class extends Event {
    static {
      __name(this, "SampleLoadedEvent");
    }
    constructor(totalSamples, samplesLoaded) {
      super("sampleloaded");
      this.totalSamples = totalSamples;
      this.samplesLoaded = samplesLoaded;
    }
  };
  var SampleLoadEvents = class extends EventTarget {
    static {
      __name(this, "SampleLoadEvents");
    }
    constructor() {
      super();
    }
  };
  var sampleLoadEvents = new SampleLoadEvents();
  async function startLoadingSample(url, chipWaveIndex, presetSettings, rawLoopOptions, customSampleRate) {
    const sampleLoaderAudioContext = new AudioContext({ sampleRate: customSampleRate });
    let closedSampleLoaderAudioContext = false;
    const chipWave = Config.chipWaves[chipWaveIndex];
    const rawChipWave = Config.rawChipWaves[chipWaveIndex];
    const rawRawChipWave = Config.rawRawChipWaves[chipWaveIndex];
    if (OFFLINE) {
      if (url.slice(0, 5) === "file:") {
        const dirname = await getDirname();
        const joined = await pathJoin(dirname, url.slice(5));
        url = joined;
      }
    }
    fetch(url).then((response) => {
      if (!response.ok) {
        sampleLoadingState.statusTable[chipWaveIndex] = 2 /* error */;
        return Promise.reject(new Error("Couldn't load sample"));
      }
      return response.arrayBuffer();
    }).then((arrayBuffer) => {
      return sampleLoaderAudioContext.decodeAudioData(arrayBuffer);
    }).then((audioBuffer) => {
      const samples = centerWave(Array.from(audioBuffer.getChannelData(0)));
      const integratedSamples = performIntegral(samples);
      chipWave.samples = integratedSamples;
      rawChipWave.samples = samples;
      rawRawChipWave.samples = samples;
      if (rawLoopOptions["isUsingAdvancedLoopControls"]) {
        presetSettings["chipWaveLoopStart"] = rawLoopOptions["chipWaveLoopStart"] != null ? rawLoopOptions["chipWaveLoopStart"] : 0;
        presetSettings["chipWaveLoopEnd"] = rawLoopOptions["chipWaveLoopEnd"] != null ? rawLoopOptions["chipWaveLoopEnd"] : samples.length - 1;
        presetSettings["chipWaveLoopMode"] = rawLoopOptions["chipWaveLoopMode"] != null ? rawLoopOptions["chipWaveLoopMode"] : 0;
        presetSettings["chipWavePlayBackwards"] = rawLoopOptions["chipWavePlayBackwards"];
        presetSettings["chipWaveStartOffset"] = rawLoopOptions["chipWaveStartOffset"] != null ? rawLoopOptions["chipWaveStartOffset"] : 0;
      }
      sampleLoadingState.samplesLoaded++;
      sampleLoadingState.statusTable[chipWaveIndex] = 1 /* loaded */;
      sampleLoadEvents.dispatchEvent(new SampleLoadedEvent(
        sampleLoadingState.totalSamples,
        sampleLoadingState.samplesLoaded
      ));
      if (!closedSampleLoaderAudioContext) {
        closedSampleLoaderAudioContext = true;
        sampleLoaderAudioContext.close();
      }
    }).catch((error) => {
      sampleLoadingState.statusTable[chipWaveIndex] = 2 /* error */;
      alert("Failed to load " + url + ":\n" + error);
      if (!closedSampleLoaderAudioContext) {
        closedSampleLoaderAudioContext = true;
        sampleLoaderAudioContext.close();
      }
    });
  }
  __name(startLoadingSample, "startLoadingSample");
  function loadScript(url) {
    const result = new Promise((resolve, reject) => {
      if (!Config.willReloadForCustomSamples) {
        const script = document.createElement("script");
        script.src = url;
        document.head.appendChild(script);
        script.addEventListener("load", (event) => {
          resolve();
        });
      } else {
      }
    });
    return result;
  }
  __name(loadScript, "loadScript");
  function loadBuiltInSamples(set) {
    const defaultIndex = 0;
    const defaultIntegratedSamples = Config.chipWaves[defaultIndex].samples;
    const defaultSamples = Config.rawRawChipWaves[defaultIndex].samples;
    if (set == 0) {
      const chipWaves = [
        { name: "paandorasbox kick", expression: 4, isSampled: true, isPercussion: true, extraSampleDetune: 0 },
        { name: "paandorasbox snare", expression: 3, isSampled: true, isPercussion: true, extraSampleDetune: 0 },
        { name: "paandorasbox piano1", expression: 3, isSampled: true, isPercussion: false, extraSampleDetune: 2 },
        { name: "paandorasbox WOW", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: 0 },
        { name: "paandorasbox overdrive", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: -2 },
        { name: "paandorasbox trumpet", expression: 3, isSampled: true, isPercussion: false, extraSampleDetune: 1.2 },
        { name: "paandorasbox saxophone", expression: 2, isSampled: true, isPercussion: false, extraSampleDetune: -5 },
        { name: "paandorasbox orchestrahit", expression: 2, isSampled: true, isPercussion: false, extraSampleDetune: 4.2 },
        { name: "paandorasbox detatched violin", expression: 2, isSampled: true, isPercussion: false, extraSampleDetune: 4.2 },
        { name: "paandorasbox synth", expression: 2, isSampled: true, isPercussion: false, extraSampleDetune: -0.8 },
        { name: "paandorasbox sonic3snare", expression: 2, isSampled: true, isPercussion: true, extraSampleDetune: 0 },
        { name: "paandorasbox come on", expression: 2, isSampled: true, isPercussion: false, extraSampleDetune: 0 },
        { name: "paandorasbox choir", expression: 2, isSampled: true, isPercussion: false, extraSampleDetune: -3 },
        { name: "paandorasbox overdriveguitar", expression: 2, isSampled: true, isPercussion: false, extraSampleDetune: -6.2 },
        { name: "paandorasbox flute", expression: 2, isSampled: true, isPercussion: false, extraSampleDetune: -6 },
        { name: "paandorasbox legato violin", expression: 2, isSampled: true, isPercussion: false, extraSampleDetune: -28 },
        { name: "paandorasbox tremolo violin", expression: 2, isSampled: true, isPercussion: false, extraSampleDetune: -33 },
        { name: "paandorasbox amen break", expression: 1, isSampled: true, isPercussion: true, extraSampleDetune: -55 },
        { name: "paandorasbox pizzicato violin", expression: 2, isSampled: true, isPercussion: false, extraSampleDetune: -11 },
        { name: "paandorasbox tim allen grunt", expression: 2, isSampled: true, isPercussion: false, extraSampleDetune: -20 },
        { name: "paandorasbox tuba", expression: 2, isSampled: true, isPercussion: false, extraSampleDetune: 44 },
        { name: "paandorasbox loopingcymbal", expression: 2, isSampled: true, isPercussion: false, extraSampleDetune: -17 },
        { name: "paandorasbox standardkick", expression: 2, isSampled: true, isPercussion: true, extraSampleDetune: -7 },
        { name: "paandorasbox standardsnare", expression: 2, isSampled: true, isPercussion: true, extraSampleDetune: 0 },
        { name: "paandorasbox closedhihat", expression: 2, isSampled: true, isPercussion: true, extraSampleDetune: 5 },
        { name: "paandorasbox foothihat", expression: 2, isSampled: true, isPercussion: true, extraSampleDetune: 4 },
        { name: "paandorasbox openhihat", expression: 2, isSampled: true, isPercussion: true, extraSampleDetune: -31 },
        { name: "paandorasbox crashcymbal", expression: 2, isSampled: true, isPercussion: true, extraSampleDetune: -43 },
        { name: "paandorasbox pianoC4", expression: 2, isSampled: true, isPercussion: false, extraSampleDetune: -42.5 },
        { name: "paandorasbox liver pad", expression: 2, isSampled: true, isPercussion: false, extraSampleDetune: -22.5 },
        { name: "paandorasbox marimba", expression: 2, isSampled: true, isPercussion: false, extraSampleDetune: -15.5 },
        { name: "paandorasbox susdotwav", expression: 2, isSampled: true, isPercussion: false, extraSampleDetune: -24.5 },
        { name: "paandorasbox wackyboxtts", expression: 2, isSampled: true, isPercussion: false, extraSampleDetune: -17.5 },
        { name: "paandorasbox peppersteak_1", expression: 2, isSampled: true, isPercussion: false, extraSampleDetune: -42.2 },
        { name: "paandorasbox peppersteak_2", expression: 2, isSampled: true, isPercussion: false, extraSampleDetune: -47 },
        { name: "paandorasbox vinyl_noise", expression: 2, isSampled: true, isPercussion: true, extraSampleDetune: -50 },
        { name: "paandorasbeta slap bass", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: -56 },
        { name: "paandorasbeta HD EB overdrive guitar", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: -60 },
        { name: "paandorasbeta sunsoft bass", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: -18.5 },
        { name: "paandorasbeta masculine choir", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: -50 },
        { name: "paandorasbeta feminine choir", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: -60.5 },
        { name: "paandorasbeta tololoche", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: -29.5 },
        { name: "paandorasbeta harp", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: -54 },
        { name: "paandorasbeta pan flute", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: -58 },
        { name: "paandorasbeta krumhorn", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: -46 },
        { name: "paandorasbeta timpani", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: -50 },
        { name: "paandorasbeta crowd hey", expression: 1, isSampled: true, isPercussion: true, extraSampleDetune: -29 },
        { name: "paandorasbeta wario land 4 brass", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: -68 },
        { name: "paandorasbeta wario land 4 rock organ", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: -63 },
        { name: "paandorasbeta wario land 4 DAOW", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: -35 },
        { name: "paandorasbeta wario land 4 hour chime", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: -47.5 },
        { name: "paandorasbeta wario land 4 tick", expression: 1, isSampled: true, isPercussion: true, extraSampleDetune: -12.5 },
        { name: "paandorasbeta kirby kick", expression: 1, isSampled: true, isPercussion: true, extraSampleDetune: -46.5 },
        { name: "paandorasbeta kirby snare", expression: 1, isSampled: true, isPercussion: true, extraSampleDetune: -46.5 },
        { name: "paandorasbeta kirby bongo", expression: 1, isSampled: true, isPercussion: true, extraSampleDetune: -46.5 },
        { name: "paandorasbeta kirby click", expression: 1, isSampled: true, isPercussion: true, extraSampleDetune: -46.5 },
        { name: "paandorasbeta sonor kick", expression: 1, isSampled: true, isPercussion: true, extraSampleDetune: -28.5 },
        { name: "paandorasbeta sonor snare", expression: 1, isSampled: true, isPercussion: true, extraSampleDetune: -28.5 },
        { name: "paandorasbeta sonor snare (left hand)", expression: 1, isSampled: true, isPercussion: true, extraSampleDetune: -22.5 },
        { name: "paandorasbeta sonor snare (right hand)", expression: 1, isSampled: true, isPercussion: true, extraSampleDetune: -22.5 },
        { name: "paandorasbeta sonor high tom", expression: 1, isSampled: true, isPercussion: true, extraSampleDetune: -41.5 },
        { name: "paandorasbeta sonor low tom", expression: 1, isSampled: true, isPercussion: true, extraSampleDetune: -41.5 },
        { name: "paandorasbeta sonor hihat (closed)", expression: 1, isSampled: true, isPercussion: true, extraSampleDetune: -17 },
        { name: "paandorasbeta sonor hihat (half opened)", expression: 1, isSampled: true, isPercussion: true, extraSampleDetune: -21 },
        { name: "paandorasbeta sonor hihat (open)", expression: 1, isSampled: true, isPercussion: true, extraSampleDetune: -54.5 },
        { name: "paandorasbeta sonor hihat (open tip)", expression: 1, isSampled: true, isPercussion: true, extraSampleDetune: -43.5 },
        { name: "paandorasbeta sonor hihat (pedal)", expression: 1, isSampled: true, isPercussion: true, extraSampleDetune: -28 },
        { name: "paandorasbeta sonor crash", expression: 1, isSampled: true, isPercussion: true, extraSampleDetune: -51 },
        { name: "paandorasbeta sonor crash (tip)", expression: 1, isSampled: true, isPercussion: true, extraSampleDetune: -50.5 },
        { name: "paandorasbeta sonor ride", expression: 1, isSampled: true, isPercussion: true, extraSampleDetune: -46 }
      ];
      sampleLoadingState.totalSamples += chipWaves.length;
      const startIndex = Config.rawRawChipWaves.length;
      for (const chipWave of chipWaves) {
        const chipWaveIndex = Config.rawRawChipWaves.length;
        const rawChipWave = { index: chipWaveIndex, name: chipWave.name, expression: chipWave.expression, isSampled: chipWave.isSampled, isPercussion: chipWave.isPercussion, extraSampleDetune: chipWave.extraSampleDetune, samples: defaultSamples };
        const rawRawChipWave = { index: chipWaveIndex, name: chipWave.name, expression: chipWave.expression, isSampled: chipWave.isSampled, isPercussion: chipWave.isPercussion, extraSampleDetune: chipWave.extraSampleDetune, samples: defaultSamples };
        const integratedChipWave = { index: chipWaveIndex, name: chipWave.name, expression: chipWave.expression, isSampled: chipWave.isSampled, isPercussion: chipWave.isPercussion, extraSampleDetune: chipWave.extraSampleDetune, samples: defaultIntegratedSamples };
        Config.rawRawChipWaves[chipWaveIndex] = rawRawChipWave;
        Config.rawRawChipWaves.dictionary[chipWave.name] = rawRawChipWave;
        Config.rawChipWaves[chipWaveIndex] = rawChipWave;
        Config.rawChipWaves.dictionary[chipWave.name] = rawChipWave;
        Config.chipWaves[chipWaveIndex] = integratedChipWave;
        Config.chipWaves.dictionary[chipWave.name] = rawChipWave;
        sampleLoadingState.statusTable[chipWaveIndex] = 0 /* loading */;
        sampleLoadingState.urlTable[chipWaveIndex] = "legacySamples";
      }
      loadScript("samples.js").then(() => loadScript("samples2.js")).then(() => loadScript("samples3.js")).then(() => loadScript("drumsamples.js")).then(() => loadScript("wario_samples.js")).then(() => loadScript("kirby_samples.js")).then(() => {
        const chipWaveSamples = [
          centerWave(kicksample),
          centerWave(snaresample),
          centerWave(pianosample),
          centerWave(WOWsample),
          centerWave(overdrivesample),
          centerWave(trumpetsample),
          centerWave(saxophonesample),
          centerWave(orchhitsample),
          centerWave(detatchedviolinsample),
          centerWave(synthsample),
          centerWave(sonic3snaresample),
          centerWave(comeonsample),
          centerWave(choirsample),
          centerWave(overdrivensample),
          centerWave(flutesample),
          centerWave(legatoviolinsample),
          centerWave(tremoloviolinsample),
          centerWave(amenbreaksample),
          centerWave(pizzicatoviolinsample),
          centerWave(timallengruntsample),
          centerWave(tubasample),
          centerWave(loopingcymbalsample),
          centerWave(kickdrumsample),
          centerWave(snaredrumsample),
          centerWave(closedhihatsample),
          centerWave(foothihatsample),
          centerWave(openhihatsample),
          centerWave(crashsample),
          centerWave(pianoC4sample),
          centerWave(liverpadsample),
          centerWave(marimbasample),
          centerWave(susdotwavsample),
          centerWave(wackyboxttssample),
          centerWave(peppersteak1),
          centerWave(peppersteak2),
          centerWave(vinyl),
          centerWave(slapbass),
          centerWave(hdeboverdrive),
          centerWave(sunsoftbass),
          centerWave(masculinechoir),
          centerWave(femininechoir),
          centerWave(southtololoche),
          centerWave(harp),
          centerWave(panflute),
          centerWave(krumhorn),
          centerWave(timpani),
          centerWave(crowdhey),
          centerWave(warioland4brass),
          centerWave(warioland4organ),
          centerWave(warioland4daow),
          centerWave(warioland4hourchime),
          centerWave(warioland4tick),
          centerWave(kirbykick),
          centerWave(kirbysnare),
          centerWave(kirbybongo),
          centerWave(kirbyclick),
          centerWave(funkkick),
          centerWave(funksnare),
          centerWave(funksnareleft),
          centerWave(funksnareright),
          centerWave(funktomhigh),
          centerWave(funktomlow),
          centerWave(funkhihatclosed),
          centerWave(funkhihathalfopen),
          centerWave(funkhihatopen),
          centerWave(funkhihatopentip),
          centerWave(funkhihatfoot),
          centerWave(funkcrash),
          centerWave(funkcrashtip),
          centerWave(funkride)
        ];
        let chipWaveIndexOffset = 0;
        for (const chipWaveSample of chipWaveSamples) {
          const chipWaveIndex = startIndex + chipWaveIndexOffset;
          Config.rawChipWaves[chipWaveIndex].samples = chipWaveSample;
          Config.rawRawChipWaves[chipWaveIndex].samples = chipWaveSample;
          Config.chipWaves[chipWaveIndex].samples = performIntegral(chipWaveSample);
          sampleLoadingState.statusTable[chipWaveIndex] = 1 /* loaded */;
          sampleLoadingState.samplesLoaded++;
          sampleLoadEvents.dispatchEvent(new SampleLoadedEvent(
            sampleLoadingState.totalSamples,
            sampleLoadingState.samplesLoaded
          ));
          chipWaveIndexOffset++;
        }
      });
    } else if (set == 1) {
      const chipWaves = [
        { name: "chronoperc1final", expression: 4, isSampled: true, isPercussion: true, extraSampleDetune: 0 },
        { name: "synthkickfm", expression: 4, isSampled: true, isPercussion: true, extraSampleDetune: 0 },
        { name: "mcwoodclick1", expression: 4, isSampled: true, isPercussion: true, extraSampleDetune: 0 },
        { name: "acoustic snare", expression: 4, isSampled: true, isPercussion: true, extraSampleDetune: 0 }
      ];
      sampleLoadingState.totalSamples += chipWaves.length;
      const startIndex = Config.rawRawChipWaves.length;
      for (const chipWave of chipWaves) {
        const chipWaveIndex = Config.rawRawChipWaves.length;
        const rawChipWave = { index: chipWaveIndex, name: chipWave.name, expression: chipWave.expression, isSampled: chipWave.isSampled, isPercussion: chipWave.isPercussion, extraSampleDetune: chipWave.extraSampleDetune, samples: defaultSamples };
        const rawRawChipWave = { index: chipWaveIndex, name: chipWave.name, expression: chipWave.expression, isSampled: chipWave.isSampled, isPercussion: chipWave.isPercussion, extraSampleDetune: chipWave.extraSampleDetune, samples: defaultSamples };
        const integratedChipWave = { index: chipWaveIndex, name: chipWave.name, expression: chipWave.expression, isSampled: chipWave.isSampled, isPercussion: chipWave.isPercussion, extraSampleDetune: chipWave.extraSampleDetune, samples: defaultIntegratedSamples };
        Config.rawRawChipWaves[chipWaveIndex] = rawRawChipWave;
        Config.rawRawChipWaves.dictionary[chipWave.name] = rawRawChipWave;
        Config.rawChipWaves[chipWaveIndex] = rawChipWave;
        Config.rawChipWaves.dictionary[chipWave.name] = rawChipWave;
        Config.chipWaves[chipWaveIndex] = integratedChipWave;
        Config.chipWaves.dictionary[chipWave.name] = rawChipWave;
        sampleLoadingState.statusTable[chipWaveIndex] = 0 /* loading */;
        sampleLoadingState.urlTable[chipWaveIndex] = "nintariboxSamples";
      }
      loadScript("nintaribox_samples.js").then(() => {
        const chipWaveSamples = [
          centerWave(chronoperc1finalsample),
          centerWave(synthkickfmsample),
          centerWave(woodclicksample),
          centerWave(acousticsnaresample)
        ];
        let chipWaveIndexOffset = 0;
        for (const chipWaveSample of chipWaveSamples) {
          const chipWaveIndex = startIndex + chipWaveIndexOffset;
          Config.rawChipWaves[chipWaveIndex].samples = chipWaveSample;
          Config.rawRawChipWaves[chipWaveIndex].samples = chipWaveSample;
          Config.chipWaves[chipWaveIndex].samples = performIntegral(chipWaveSample);
          sampleLoadingState.statusTable[chipWaveIndex] = 1 /* loaded */;
          sampleLoadingState.samplesLoaded++;
          sampleLoadEvents.dispatchEvent(new SampleLoadedEvent(
            sampleLoadingState.totalSamples,
            sampleLoadingState.samplesLoaded
          ));
          chipWaveIndexOffset++;
        }
      });
    } else if (set == 2) {
      const chipWaves = [
        { name: "cat", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: -3 },
        { name: "gameboy", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: 7 },
        { name: "mario", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: 0 },
        { name: "drum", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: 4 },
        { name: "yoshi", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: -16 },
        { name: "star", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: -16 },
        { name: "fire flower", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: -1 },
        { name: "dog", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: -1 },
        { name: "oink", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: 3 },
        { name: "swan", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: 1 },
        { name: "face", expression: 1, isSampled: true, isPercussion: false, extraSampleDetune: -12 }
      ];
      sampleLoadingState.totalSamples += chipWaves.length;
      const startIndex = Config.rawRawChipWaves.length;
      for (const chipWave of chipWaves) {
        const chipWaveIndex = Config.rawRawChipWaves.length;
        const rawChipWave = { index: chipWaveIndex, name: chipWave.name, expression: chipWave.expression, isSampled: chipWave.isSampled, isPercussion: chipWave.isPercussion, extraSampleDetune: chipWave.extraSampleDetune, samples: defaultSamples };
        const rawRawChipWave = { index: chipWaveIndex, name: chipWave.name, expression: chipWave.expression, isSampled: chipWave.isSampled, isPercussion: chipWave.isPercussion, extraSampleDetune: chipWave.extraSampleDetune, samples: defaultSamples };
        const integratedChipWave = { index: chipWaveIndex, name: chipWave.name, expression: chipWave.expression, isSampled: chipWave.isSampled, isPercussion: chipWave.isPercussion, extraSampleDetune: chipWave.extraSampleDetune, samples: defaultIntegratedSamples };
        Config.rawRawChipWaves[chipWaveIndex] = rawRawChipWave;
        Config.rawRawChipWaves.dictionary[chipWave.name] = rawRawChipWave;
        Config.rawChipWaves[chipWaveIndex] = rawChipWave;
        Config.rawChipWaves.dictionary[chipWave.name] = rawChipWave;
        Config.chipWaves[chipWaveIndex] = integratedChipWave;
        Config.chipWaves.dictionary[chipWave.name] = rawChipWave;
        sampleLoadingState.statusTable[chipWaveIndex] = 0 /* loading */;
        sampleLoadingState.urlTable[chipWaveIndex] = "marioPaintboxSamples";
      }
      loadScript("mario_paintbox_samples.js").then(() => {
        const chipWaveSamples = [
          centerWave(catpaintboxsample),
          centerWave(gameboypaintboxsample),
          centerWave(mariopaintboxsample),
          centerWave(drumpaintboxsample),
          centerWave(yoshipaintboxsample),
          centerWave(starpaintboxsample),
          centerWave(fireflowerpaintboxsample),
          centerWave(dogpaintbox),
          centerWave(oinkpaintbox),
          centerWave(swanpaintboxsample),
          centerWave(facepaintboxsample)
        ];
        let chipWaveIndexOffset = 0;
        for (const chipWaveSample of chipWaveSamples) {
          const chipWaveIndex = startIndex + chipWaveIndexOffset;
          Config.rawChipWaves[chipWaveIndex].samples = chipWaveSample;
          Config.rawRawChipWaves[chipWaveIndex].samples = chipWaveSample;
          Config.chipWaves[chipWaveIndex].samples = performIntegral(chipWaveSample);
          sampleLoadingState.statusTable[chipWaveIndex] = 1 /* loaded */;
          sampleLoadingState.samplesLoaded++;
          sampleLoadEvents.dispatchEvent(new SampleLoadedEvent(
            sampleLoadingState.totalSamples,
            sampleLoadingState.samplesLoaded
          ));
          chipWaveIndexOffset++;
        }
      });
    } else {
      console.log("invalid set of built-in samples");
    }
  }
  __name(loadBuiltInSamples, "loadBuiltInSamples");
  var Config = class _Config {
    static {
      __name(this, "Config");
    }
    static {
      // Params for post-processing compressor
      this.thresholdVal = -10;
    }
    static {
      this.kneeVal = 40;
    }
    static {
      this.ratioVal = 12;
    }
    static {
      this.attackVal = 0;
    }
    static {
      this.releaseVal = 0.25;
    }
    static {
      this.willReloadForCustomSamples = false;
    }
    static {
      this.jsonFormat = "slarmoosbox";
    }
    static {
      // public static thurmboxImportUrl: string = "https://file.garden/ZMQ0Om5nmTe-x2hq/PandoraArchive%20Samples/";
      this.scales = toNameMap([
        //   C     Db      D     Eb      E      F     F#      G     Ab      A     Bb      B      C
        { name: "Free", realName: "chromatic", flags: [true, true, true, true, true, true, true, true, true, true, true, true] },
        // Free
        { name: "Major", realName: "ionian", flags: [true, false, true, false, true, true, false, true, false, true, false, true] },
        // Major
        { name: "Minor", realName: "aeolian", flags: [true, false, true, true, false, true, false, true, true, false, true, false] },
        // Minor
        { name: "Mixolydian", realName: "mixolydian", flags: [true, false, true, false, true, true, false, true, false, true, true, false] },
        // Mixolydian
        { name: "Lydian", realName: "lydian", flags: [true, false, true, false, true, false, true, true, false, true, false, true] },
        // Lydian
        { name: "Dorian", realName: "dorian", flags: [true, false, true, true, false, true, false, true, false, true, true, false] },
        // Dorian
        { name: "Phrygian", realName: "phrygian", flags: [true, true, false, true, false, true, false, true, true, false, true, false] },
        // Phrygian
        { name: "Locrian", realName: "locrian", flags: [true, true, false, true, false, true, true, false, true, false, true, false] },
        // Locrian
        { name: "Lydian Dominant", realName: "lydian dominant", flags: [true, false, true, false, true, false, true, true, false, true, true, false] },
        // Lydian Dominant
        { name: "Phrygian Dominant", realName: "phrygian dominant", flags: [true, true, false, false, true, true, false, true, true, false, true, false] },
        // Phrygian Dominant
        { name: "Harmonic Major", realName: "harmonic major", flags: [true, false, true, false, true, true, false, true, true, false, false, true] },
        // Harmonic Major
        { name: "Harmonic Minor", realName: "harmonic minor", flags: [true, false, true, true, false, true, false, true, true, false, false, true] },
        // Harmonic Minor
        { name: "Melodic Minor", realName: "melodic minor", flags: [true, false, true, true, false, true, false, true, false, true, false, true] },
        // Melodic Minor
        { name: "Blues Major", realName: "blues major", flags: [true, false, true, true, true, false, false, true, false, true, false, false] },
        // Blues Major
        { name: "Blues", realName: "blues", flags: [true, false, false, true, false, true, true, true, false, false, true, false] },
        // Blues
        { name: "Altered", realName: "altered", flags: [true, true, false, true, true, false, true, false, true, false, true, false] },
        // Altered
        { name: "Major Pentatonic", realName: "major pentatonic", flags: [true, false, true, false, true, false, false, true, false, true, false, false] },
        // Major Pentatonic
        { name: "Minor Pentatonic", realName: "minor pentatonic", flags: [true, false, false, true, false, true, false, true, false, false, true, false] },
        // Minor Pentatonic
        { name: "Whole Tone", realName: "whole tone", flags: [true, false, true, false, true, false, true, false, true, false, true, false] },
        // Whole Tone
        { name: "Octatonic", realName: "octatonic", flags: [true, false, true, true, false, true, true, false, true, true, false, true] },
        // Octatonic
        { name: "Hexatonic", realName: "hexatonic", flags: [true, false, false, true, true, false, false, true, true, false, false, true] },
        // Hexatonic
        // TODO: remove these with 2.3
        // modbox
        { name: "No Dabbing (MB)", realName: "no dabbing", flags: [true, true, false, true, true, true, true, true, true, false, true, false] },
        // todbox
        { name: "Jacked Toad (TB)", realName: "jacked toad", flags: [true, false, true, true, false, true, true, true, true, false, true, true] },
        { name: "Test Scale (TB)", realName: "**t", flags: [true, true, false, false, false, true, true, false, false, true, true, false] },
        { name: "Custom", realName: "custom", flags: [true, false, true, true, false, false, false, true, true, false, true, true] }
        // Custom? considering allowing this one to be be completely configurable
      ]);
    }
    static {
      this.keys = toNameMap([
        { name: "C", isWhiteKey: true, basePitch: 12 },
        // C0 has index 12 on the MIDI scale. C7 is 96, and C9 is 120. C10 is barely in the audible range.
        { name: "C\u266F", isWhiteKey: false, basePitch: 13 },
        { name: "D", isWhiteKey: true, basePitch: 14 },
        { name: "D\u266F", isWhiteKey: false, basePitch: 15 },
        { name: "E", isWhiteKey: true, basePitch: 16 },
        { name: "F", isWhiteKey: true, basePitch: 17 },
        { name: "F\u266F", isWhiteKey: false, basePitch: 18 },
        { name: "G", isWhiteKey: true, basePitch: 19 },
        { name: "G\u266F", isWhiteKey: false, basePitch: 20 },
        { name: "A", isWhiteKey: true, basePitch: 21 },
        { name: "A\u266F", isWhiteKey: false, basePitch: 22 },
        { name: "B", isWhiteKey: true, basePitch: 23 }
        // { name: "C+", isWhiteKey: false, basePitch: 24 },
        //taken from todbox, called "B#" for some reason lol
        // { name: "G- (actually F#-)", isWhiteKey: false, basePitch: 6 },
        // { name: "C-", isWhiteKey: true, basePitch: 0 },
        //brucebox
        //g- isn't actually g-???
        // { name: "oh no (F-)", isWhiteKey: true, basePitch: 5 },
        //shitbox
      ]);
    }
    static {
      this.blackKeyNameParents = [-1, 1, -1, 1, -1, 1, -1, -1, 1, -1, 1, -1];
    }
    static {
      this.tempoMin = 1;
    }
    static {
      this.tempoMax = 500;
    }
    static {
      this.octaveMin = -2;
    }
    static {
      this.octaveMax = 2;
    }
    static {
      this.echoDelayRange = 24;
    }
    static {
      this.echoDelayStepTicks = 4;
    }
    static {
      this.echoSustainRange = 8;
    }
    static {
      this.echoShelfHz = 4e3;
    }
    static {
      // The cutoff freq of the shelf filter that is used to decay echoes.
      this.echoShelfGain = Math.pow(2, -0.5);
    }
    static {
      this.reverbShelfHz = 8e3;
    }
    static {
      // The cutoff freq of the shelf filter that is used to decay reverb.
      this.reverbShelfGain = Math.pow(2, -1.5);
    }
    static {
      this.reverbRange = 32;
    }
    static {
      this.reverbDelayBufferSize = 16384;
    }
    static {
      // TODO: Compute a buffer size based on sample rate.
      this.reverbDelayBufferMask = _Config.reverbDelayBufferSize - 1;
    }
    static {
      // TODO: Compute a buffer size based on sample rate.
      this.beatsPerBarMin = 1;
    }
    static {
      this.beatsPerBarMax = 64;
    }
    static {
      this.barCountMin = 1;
    }
    static {
      this.barCountMax = 1024;
    }
    static {
      this.instrumentCountMin = 1;
    }
    static {
      this.layeredInstrumentCountMax = 10;
    }
    static {
      this.patternInstrumentCountMax = 10;
    }
    static {
      this.partsPerBeat = 24;
    }
    static {
      this.ticksPerPart = 2;
    }
    static {
      this.ticksPerArpeggio = 3;
    }
    static {
      this.arpeggioPatterns = [[0], [0, 1], [0, 1, 2, 1], [0, 1, 2, 3], [0, 1, 2, 3, 4], [0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5, 6, 7]];
    }
    static {
      this.rhythms = toNameMap([
        {
          name: "\xF73 (triplets)",
          stepsPerBeat: 3,
          /*ticksPerArpeggio: 4, arpeggioPatterns: [[0], [0, 0, 1, 1], [0, 1, 2, 1], [0, 1, 2, 3]]*/
          roundUpThresholds: [
            /*0*/
            5,
            /*8*/
            12,
            /*16*/
            18
            /*24*/
          ]
        },
        {
          name: "\xF74 (standard)",
          stepsPerBeat: 4,
          /*ticksPerArpeggio: 3, arpeggioPatterns: [[0], [0, 0, 1, 1], [0, 1, 2, 1], [0, 1, 2, 3]]*/
          roundUpThresholds: [
            /*0*/
            3,
            /*6*/
            9,
            /*12*/
            17,
            /*18*/
            21
            /*24*/
          ]
        },
        {
          name: "\xF76",
          stepsPerBeat: 6,
          /*ticksPerArpeggio: 4, arpeggioPatterns: [[0], [0, 1], [0, 1, 2, 1], [0, 1, 2, 3]]*/
          roundUpThresholds: null
        },
        {
          name: "\xF78",
          stepsPerBeat: 8,
          /*ticksPerArpeggio: 3, arpeggioPatterns: [[0], [0, 1], [0, 1, 2, 1], [0, 1, 2, 3]]*/
          roundUpThresholds: null
        },
        {
          name: "\xF712",
          stepsPerBeat: 12,
          /*ticksPerArpeggio: 3, arpeggioPatterns: [[0], [0, 1], [0, 1, 2, 1]]*/
          roundUpThresholds: null
        },
        {
          name: "freehand",
          stepsPerBeat: 24,
          /*ticksPerArpeggio: 3, arpeggioPatterns: [[0], [0, 1], [0, 1, 2, 1], [0, 1, 2, 3]]*/
          roundUpThresholds: null
        }
      ]);
    }
    static {
      this.instrumentTypeNames = ["chip", "FM", "noise", "spectrum", "drumset", "harmonics", "PWM", "Picked String", "supersaw", "custom chip", "mod", "FM6op"];
    }
    static {
      this.instrumentTypeHasSpecialInterval = [true, true, false, false, false, true, false, false, false, false, false];
    }
    static {
      this.chipBaseExpression = 0.03375;
    }
    static {
      // Doubled by unison feature, but affected by expression adjustments per unison setting and wave shape. Custom chip is multiplied by 0.05 in instrumentState.updateWaves
      this.fmBaseExpression = 0.03;
    }
    static {
      this.noiseBaseExpression = 0.19;
    }
    static {
      this.spectrumBaseExpression = 0.3;
    }
    static {
      // Spectrum can be in pitch or noise channels, the expression is doubled for noise.
      this.drumsetBaseExpression = 0.45;
    }
    static {
      // Drums tend to be loud but brief!
      this.harmonicsBaseExpression = 0.025;
    }
    static {
      this.pwmBaseExpression = 0.04725;
    }
    static {
      // It's actually closer to half of this, the synthesized pulse amplitude range is only .5 to -.5, but also note that the fundamental sine partial amplitude of a square wave is 4/π times the measured square wave amplitude.
      this.supersawBaseExpression = 0.061425;
    }
    static {
      // It's actually closer to half of this, the synthesized sawtooth amplitude range is only .5 to -.5.
      this.pickedStringBaseExpression = 0.025;
    }
    static {
      // Same as harmonics.
      this.distortionBaseVolume = 0.011;
    }
    static {
      // Distortion is not affected by pitchDamping, which otherwise approximately halves expression for notes around the middle of the range.
      this.bitcrusherBaseVolume = 0.01;
    }
    static {
      // Also not affected by pitchDamping, used when bit crushing is maxed out (aka "1-bit" output).
      this.granularOutputLoudnessCompensation = 0.5;
    }
    static {
      //compensate for multiple grains playing at once
      this.rawChipWaves = toNameMap([
        { name: "rounded", expression: 0.94, samples: centerWave([0, 0.2, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.95, 0.9, 0.85, 0.8, 0.7, 0.6, 0.5, 0.4, 0.2, 0, -0.2, -0.4, -0.5, -0.6, -0.7, -0.8, -0.85, -0.9, -0.95, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -0.95, -0.9, -0.85, -0.8, -0.7, -0.6, -0.5, -0.4, -0.2]) },
        { name: "triangle", expression: 1, samples: centerWave([1 / 15, 3 / 15, 5 / 15, 7 / 15, 9 / 15, 11 / 15, 13 / 15, 15 / 15, 15 / 15, 13 / 15, 11 / 15, 9 / 15, 7 / 15, 5 / 15, 3 / 15, 1 / 15, -1 / 15, -3 / 15, -5 / 15, -7 / 15, -9 / 15, -11 / 15, -13 / 15, -15 / 15, -15 / 15, -13 / 15, -11 / 15, -9 / 15, -7 / 15, -5 / 15, -3 / 15, -1 / 15]) },
        { name: "square", expression: 0.5, samples: centerWave([1, -1]) },
        { name: "1/4 pulse", expression: 0.5, samples: centerWave([1, -1, -1, -1]) },
        { name: "1/8 pulse", expression: 0.5, samples: centerWave([1, -1, -1, -1, -1, -1, -1, -1]) },
        { name: "sawtooth", expression: 0.65, samples: centerWave([1 / 31, 3 / 31, 5 / 31, 7 / 31, 9 / 31, 11 / 31, 13 / 31, 15 / 31, 17 / 31, 19 / 31, 21 / 31, 23 / 31, 25 / 31, 27 / 31, 29 / 31, 31 / 31, -31 / 31, -29 / 31, -27 / 31, -25 / 31, -23 / 31, -21 / 31, -19 / 31, -17 / 31, -15 / 31, -13 / 31, -11 / 31, -9 / 31, -7 / 31, -5 / 31, -3 / 31, -1 / 31]) },
        { name: "double saw", expression: 0.5, samples: centerWave([0, -0.2, -0.4, -0.6, -0.8, -1, 1, -0.8, -0.6, -0.4, -0.2, 1, 0.8, 0.6, 0.4, 0.2]) },
        { name: "double pulse", expression: 0.4, samples: centerWave([1, 1, 1, 1, 1, -1, -1, -1, 1, 1, 1, 1, -1, -1, -1, -1]) },
        { name: "spiky", expression: 0.4, samples: centerWave([1, -1, 1, -1, 1, 0]) },
        { name: "sine", expression: 0.88, samples: centerAndNormalizeWave([8, 9, 11, 12, 13, 14, 15, 15, 15, 15, 14, 14, 13, 11, 10, 9, 7, 6, 4, 3, 2, 1, 0, 0, 0, 0, 1, 1, 2, 4, 5, 6]) },
        { name: "flute", expression: 0.8, samples: centerAndNormalizeWave([3, 4, 6, 8, 10, 11, 13, 14, 15, 15, 14, 13, 11, 8, 5, 3]) },
        { name: "harp", expression: 0.8, samples: centerAndNormalizeWave([0, 3, 3, 3, 4, 5, 5, 6, 7, 8, 9, 11, 11, 13, 13, 15, 15, 14, 12, 11, 10, 9, 8, 7, 7, 5, 4, 3, 2, 1, 0, 0]) },
        { name: "sharp clarinet", expression: 0.38, samples: centerAndNormalizeWave([0, 0, 0, 1, 1, 8, 8, 9, 9, 9, 8, 8, 8, 8, 8, 9, 9, 7, 9, 9, 10, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) },
        { name: "soft clarinet", expression: 0.45, samples: centerAndNormalizeWave([0, 1, 5, 8, 9, 9, 9, 9, 9, 9, 9, 11, 11, 12, 13, 12, 10, 9, 7, 6, 4, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1]) },
        { name: "alto sax", expression: 0.3, samples: centerAndNormalizeWave([5, 5, 6, 4, 3, 6, 8, 7, 2, 1, 5, 6, 5, 4, 5, 7, 9, 11, 13, 14, 14, 14, 14, 13, 10, 8, 7, 7, 4, 3, 4, 2]) },
        { name: "bassoon", expression: 0.35, samples: centerAndNormalizeWave([9, 9, 7, 6, 5, 4, 4, 4, 4, 5, 7, 8, 9, 10, 11, 13, 13, 11, 10, 9, 7, 6, 4, 2, 1, 1, 1, 2, 2, 5, 11, 14]) },
        { name: "trumpet", expression: 0.22, samples: centerAndNormalizeWave([10, 11, 8, 6, 5, 5, 5, 6, 7, 7, 7, 7, 6, 6, 7, 7, 7, 7, 7, 6, 6, 6, 6, 6, 6, 6, 6, 7, 8, 9, 11, 14]) },
        { name: "electric guitar", expression: 0.2, samples: centerAndNormalizeWave([11, 12, 12, 10, 6, 6, 8, 0, 2, 4, 8, 10, 9, 10, 1, 7, 11, 3, 6, 6, 8, 13, 14, 2, 0, 12, 8, 4, 13, 11, 10, 13]) },
        { name: "organ", expression: 0.2, samples: centerAndNormalizeWave([11, 10, 12, 11, 14, 7, 5, 5, 12, 10, 10, 9, 12, 6, 4, 5, 13, 12, 12, 10, 12, 5, 2, 2, 8, 6, 6, 5, 8, 3, 2, 1]) },
        { name: "pan flute", expression: 0.35, samples: centerAndNormalizeWave([1, 4, 7, 6, 7, 9, 7, 7, 11, 12, 13, 15, 13, 11, 11, 12, 13, 10, 7, 5, 3, 6, 10, 7, 3, 3, 1, 0, 1, 0, 1, 0]) },
        { name: "glitch", expression: 0.5, samples: centerWave([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1]) },
        { name: "trapezoid", expression: 1, samples: centerWave([1 / 15, 6 / 15, 10 / 15, 14 / 15, 15 / 15, 15 / 15, 15 / 15, 15 / 15, 15 / 15, 15 / 15, 15 / 15, 15 / 15, 14 / 15, 10 / 15, 6 / 15, 1 / 15, -1 / 15, -6 / 15, -10 / 15, -14 / 15, -15 / 15, -15 / 15, -15 / 15, -15 / 15, -15 / 15, -15 / 15, -15 / 15, -15 / 15, -14 / 15, -10 / 15, -6 / 15, -1 / 15]) },
        // modbox
        { name: "modbox 10% pulse", expression: 0.5, samples: centerAndNormalizeWave([1, -1, -1, -1, -1, -1, -1, -1, -1, -1]) },
        { name: "modbox sunsoft bass", expression: 1, samples: centerAndNormalizeWave([0, 0.1875, 0.3125, 0.5625, 0.5, 0.75, 0.875, 1, 1, 0.6875, 0.5, 0.625, 0.625, 0.5, 0.375, 0.5625, 0.4375, 0.5625, 0.4375, 0.4375, 0.3125, 0.1875, 0.1875, 0.375, 0.5625, 0.5625, 0.5625, 0.5625, 0.5625, 0.4375, 0.25, 0]) },
        { name: "modbox loud pulse", expression: 0.5, samples: centerAndNormalizeWave([1, 0.7, 0.1, 0.1, 0, 0, 0, 0, 0, 0.1, 0.2, 0.15, 0.25, 0.125, 0.215, 0.345, 4]) },
        { name: "modbox sax", expression: 0.5, samples: centerAndNormalizeWave([1 / 15, 3 / 15, 5 / 15, 9, 0.06]) },
        { name: "modbox guitar", expression: 0.5, samples: centerAndNormalizeWave([-0.5, 3.5, 3, -0.5, -0.25, -1]) },
        { name: "modbox sine", expression: 0.5, samples: centerAndNormalizeWave([0, 0.05, 0.125, 0.2, 0.25, 0.3, 0.425, 0.475, 0.525, 0.625, 0.675, 0.725, 0.775, 0.8, 0.825, 0.875, 0.9, 0.925, 0.95, 0.975, 0.98, 0.99, 0.995, 1, 0.995, 0.99, 0.98, 0.975, 0.95, 0.925, 0.9, 0.875, 0.825, 0.8, 0.775, 0.725, 0.675, 0.625, 0.525, 0.475, 0.425, 0.3, 0.25, 0.2, 0.125, 0.05, 0, -0.05, -0.125, -0.2, -0.25, -0.3, -0.425, -0.475, -0.525, -0.625, -0.675, -0.725, -0.775, -0.8, -0.825, -0.875, -0.9, -0.925, -0.95, -0.975, -0.98, -0.99, -0.995, -1, -0.995, -0.99, -0.98, -0.975, -0.95, -0.925, -0.9, -0.875, -0.825, -0.8, -0.775, -0.725, -0.675, -0.625, -0.525, -0.475, -0.425, -0.3, -0.25, -0.2, -0.125, -0.05]) },
        { name: "modbox atari bass", expression: 0.5, samples: centerAndNormalizeWave([1, 1, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 0, 0]) },
        { name: "modbox atari pulse", expression: 0.5, samples: centerAndNormalizeWave([1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]) },
        { name: "modbox 1% pulse", expression: 0.5, samples: centerAndNormalizeWave([1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]) },
        { name: "modbox curved sawtooth", expression: 0.5, samples: centerAndNormalizeWave([1, 1 / 2, 1 / 3, 1 / 4]) },
        { name: "modbox viola", expression: 0.45, samples: centerAndNormalizeWave([-0.9, -1, -0.85, -0.775, -0.7, -0.6, -0.5, -0.4, -0.325, -0.225, -0.2, -0.125, -0.1, -0.11, -0.125, -0.15, -0.175, -0.18, -0.2, -0.21, -0.22, -0.21, -0.2, -0.175, -0.15, -0.1, -0.5, 0.75, 0.11, 0.175, 0.2, 0.25, 0.26, 0.275, 0.26, 0.25, 0.225, 0.2, 0.19, 0.18, 0.19, 0.2, 0.21, 0.22, 0.23, 0.24, 0.25, 0.26, 0.275, 0.28, 0.29, 0.3, 0.29, 0.28, 0.27, 0.26, 0.25, 0.225, 0.2, 0.175, 0.15, 0.1, 0.075, 0, -0.01, -0.025, 0.025, 0.075, 0.2, 0.3, 0.475, 0.6, 0.75, 0.85, 0.85, 1, 0.99, 0.95, 0.8, 0.675, 0.475, 0.275, 0.01, -0.15, -0.3, -0.475, -0.5, -0.6, -0.71, -0.81, -0.9, -1, -0.9]) },
        { name: "modbox brass", expression: 0.45, samples: centerAndNormalizeWave([-1, -0.95, -0.975, -0.9, -0.85, -0.8, -0.775, -0.65, -0.6, -0.5, -0.475, -0.35, -0.275, -0.2, -0.125, -0.05, 0, 0.075, 0.125, 0.15, 0.2, 0.21, 0.225, 0.25, 0.225, 0.21, 0.2, 0.19, 0.175, 0.125, 0.1, 0.075, 0.06, 0.05, 0.04, 0.025, 0.04, 0.05, 0.1, 0.15, 0.225, 0.325, 0.425, 0.575, 0.7, 0.85, 0.95, 1, 0.9, 0.675, 0.375, 0.2, 0.275, 0.4, 0.5, 0.55, 0.6, 0.625, 0.65, 0.65, 0.65, 0.65, 0.64, 0.6, 0.55, 0.5, 0.4, 0.325, 0.25, 0.15, 0.05, -0.05, -0.15, -0.275, -0.35, -0.45, -0.55, -0.65, -0.7, -0.78, -0.825, -0.9, -0.925, -0.95, -0.975]) },
        { name: "modbox acoustic bass", expression: 0.5, samples: centerAndNormalizeWave([1, 0, 0.1, -0.1, -0.2, -0.4, -0.3, -1]) },
        { name: "modbox lyre", expression: 0.45, samples: centerAndNormalizeWave([1, -1, 4, 2.15, 4.13, 5.15, 0, -0.05, 1]) },
        { name: "modbox ramp pulse", expression: 0.5, samples: centerAndNormalizeWave([6.1, -2.9, 1.4, -2.9]) },
        { name: "modbox piccolo", expression: 0.5, samples: centerAndNormalizeWave([1, 4, 2, 1, -0.1, -1, -0.12]) },
        { name: "modbox squaretooth", expression: 0.5, samples: centerAndNormalizeWave([0.2, 1, 2.6, 1, 0, -2.4]) },
        { name: "modbox flatline", expression: 1, samples: centerAndNormalizeWave([1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) },
        { name: "modbox pnryshk a (u5)", expression: 0.4, samples: centerAndNormalizeWave([1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0]) },
        { name: "modbox pnryshk b (riff)", expression: 0.5, samples: centerAndNormalizeWave([1, -0.9, 0.8, -0.7, 0.6, -0.5, 0.4, -0.3, 0.2, -0.1, 0, -0.1, 0.2, -0.3, 0.4, -0.5, 0.6, -0.7, 0.8, -0.9, 1]) },
        // sandbox
        { name: "sandbox shrill lute", expression: 0.94, samples: centerAndNormalizeWave([1, 1.5, 1.25, 1.2, 1.3, 1.5]) },
        { name: "sandbox bassoon", expression: 0.5, samples: centerAndNormalizeWave([1, -1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0]) },
        { name: "sandbox shrill bass", expression: 0.5, samples: centerAndNormalizeWave([0, 1, 0, 0, 1, 0, 1, 0, 0, 0]) },
        { name: "sandbox nes pulse", expression: 0.4, samples: centerAndNormalizeWave([2.1, -2.2, 1.2, 3]) },
        { name: "sandbox saw bass", expression: 0.25, samples: centerAndNormalizeWave([1, 1, 1, 1, 0, 2, 1, 2, 3, 1, -2, 1, 4, 1, 4, 2, 1, 6, -3, 4, 2, 1, 5, 1, 4, 1, 5, 6, 7, 1, 6, 1, 4, 1, 9]) },
        { name: "sandbox euphonium", expression: 0.3, samples: centerAndNormalizeWave([0, 1, 2, 1, 2, 1, 4, 2, 5, 0, -2, 1, 5, 1, 2, 1, 2, 4, 5, 1, 5, -2, 5, 10, 1]) },
        { name: "sandbox shrill pulse", expression: 0.3, samples: centerAndNormalizeWave([4 - 2, 0, 4, 1, 4, 6, 7, 3]) },
        { name: "sandbox r-sawtooth", expression: 0.2, samples: centerAndNormalizeWave([6.1, -2.9, 1.4, -2.9]) },
        { name: "sandbox recorder", expression: 0.2, samples: centerAndNormalizeWave([5, -5.1, 4, -4.1, 3, -3.1, 2, -2.1, 1, -1.1, 6]) },
        { name: "sandbox narrow saw", expression: 1.2, samples: centerAndNormalizeWave([0.1, 0.13 / -0.1, 0.13 / -0.3, 0.13 / -0.5, 0.13 / -0.7, 0.13 / -0.9, 0.13 / -0.11, 0.13 / -0.31, 0.13 / -0.51, 0.13 / -0.71, 0.13 / -0.91, 0.13 / -0.12, 0.13 / -0.32, 0.13 / -0.52, 0.13 / -0.72, 0.13 / -0.92, 0.13 / -0.13, 0.13 / 0.13, 0.13 / 0.92, 0.13 / 0.72, 0.13 / 0.52, 0.13 / 0.32, 0.13 / 0.12, 0.13 / 0.91, 0.13 / 0.71, 0.13 / 0.51, 0.13 / 0.31, 0.13 / 0.11, 0.13 / 0.9, 0.13 / 0.7, 0.13 / 0.5, 0.13 / 0.3, 0.13]) },
        { name: "sandbox deep square", expression: 1, samples: centerAndNormalizeWave([1, 2.25, 1, -1, -2.25, -1]) },
        { name: "sandbox ring pulse", expression: 1, samples: centerAndNormalizeWave([1, -1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, -1, -1, -1, -1]) },
        { name: "sandbox double sine", expression: 1, samples: centerAndNormalizeWave([1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.8, 1.7, 1.6, 1.5, 1.4, 1.3, 1.2, 1.1, 1, 0, -1, -1.1, -1.2, -1.3, -1.4, -1.5, -1.6, -1.7, -1.8, -1.9, -1.8, -1.7, -1.6, -1.5, -1.4, -1.3, -1.2, -1.1, -1]) },
        { name: "sandbox contrabass", expression: 0.5, samples: centerAndNormalizeWave([4.2, 6.9, 1.337, 6.66]) },
        { name: "sandbox double bass", expression: 0.4, samples: centerAndNormalizeWave([0, 0.1875, 0.3125, 0.5625, 0.5, 0.75, 0.875, 1, -1, -0.6875, -0.5, -0.625, -0.625, -0.5, -0.375, -0.5625, -0.4375, -0.5625, -0.4375, -0.4375, -0.3125, -0.1875, 0.1875, 0.375, 0.5625, -0.5625, 0.5625, 0.5625, 0.5625, 0.4375, 0.25, 0]) },
        // haileybox
        { name: "haileybox test1", expression: 0.5, samples: centerAndNormalizeWave([1, 0.5, -1]) },
        //brucebox
        { name: "brucebox pokey 4bit lfsr", expression: 0.5, samples: centerAndNormalizeWave([1, -1, -1, -1, 1, 1, 1, 1, -1, 1, -1, 1, 1, -1, -1]) },
        { name: "brucebox pokey 5step bass", expression: 0.5, samples: centerAndNormalizeWave([1, -1, 1, -1, 1]) },
        { name: "brucebox isolated spiky", expression: 0.5, samples: centerAndNormalizeWave([1, -1, 1, -1, 1, -1]) },
        // nerdbox
        { name: "nerdbox unnamed 1", expression: 0.5, samples: centerAndNormalizeWave([0.2, 0.8 / 0.2, 0.7, -0.4, -1, 0.5, -0.5 / 0.6]) },
        { name: "nerdbox unnamed 2", expression: 0.5, samples: centerAndNormalizeWave([2, 5 / 55, -9, 6.5 / 6.5, -55, 18.5 / -26]) },
        // zefbox
        { name: "zefbox semi-square", expression: 1, samples: centerAndNormalizeWave([1, 1.5, 2, 2.5, 2.5, 2.5, 2, 1.5, 1]) },
        { name: "zefbox deep square", expression: 1, samples: centerAndNormalizeWave([1, 2.25, 1, -1, -2.25, -1]) },
        { name: "zefbox squaretal", expression: 0.7, samples: centerAndNormalizeWave([1.5, 1, 1.5, -1.5, -1, -1.5]) },
        { name: "zefbox saw wide", expression: 0.65, samples: centerAndNormalizeWave([0, -0.4, -0.8, -1.2, -1.6, -2, 0, -0.4, -0.8, -1.2, -1.6]) },
        { name: "zefbox saw narrow", expression: 0.65, samples: centerAndNormalizeWave([1, 0.5, 1, 0.5, 1, 0.5, 1, 2, 1, 2, 1]) },
        { name: "zefbox deep sawtooth", expression: 0.5, samples: centerAndNormalizeWave([0, 2, 3, 4, 4.5, 5, 5.5, 6, 6.25, 6.5, 6.75, 7, 6.75, 6.5, 6.25, 6, 5.5, 5, 4.5, 4, 3, 2, 1]) },
        { name: "zefbox sawtal", expression: 0.3, samples: centerAndNormalizeWave([1.5, 1, 1.25, -0.5, 1.5, -0.5, 0, -1.5, 1.5, 0, 0.5, -1.5, 0.5, 1.25, -1, -1.5]) },
        { name: "zefbox deep sawtal", expression: 0.7, samples: centerAndNormalizeWave([0.75, 0.25, 0.5, -0.5, 0.5, -0.5, -0.25, -0.75]) },
        { name: "zefbox pulse", expression: 0.5, samples: centerAndNormalizeWave([1, -2, -2, -1.5, -1.5, -1.25, -1.25, -1, -1]) },
        { name: "zefbox triple pulse", expression: 0.4, samples: centerAndNormalizeWave([1, 1, 1, 1, 1, -1, -1, 1.5, 1, 1, 1, 1, -1, -1, -1, 1.5]) },
        { name: "zefbox high pulse", expression: 0.2, samples: centerAndNormalizeWave([1, -2, 2, -3, 3, -4, 5, -4, 3, -3, 2, -2, 1]) },
        { name: "zefbox deep pulse", expression: 0.2, samples: centerAndNormalizeWave([1, 2, 2, -2, -2, -3, -4, -4, -5, -5, -5, -5, 0, -1, -2]) },
        // wackybox
        { name: "wackybox guitar string", expression: 0.6, samples: centerAndNormalizeWave([0, 63, 63, 63, 63, 19, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 11, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 27, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 34, 63, 63, 63, 63]) },
        { name: "wackybox intense", expression: 0.6, samples: centerAndNormalizeWave([36, 25, 33, 35, 18, 51, 22, 40, 27, 37, 31, 33, 25, 29, 41, 23, 31, 31, 45, 20, 37, 23, 29, 26, 42, 29, 33, 26, 31, 27, 40, 25, 40, 26, 37, 24, 41, 32, 0, 32, 33, 29, 32, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31]) },
        { name: "wackybox buzz wave", expression: 0.6, samples: centerAndNormalizeWave([0, 1, 1, 2, 4, 4, 4, 4, 5, 5, 6, 6, 6, 7, 8, 8, 8, 9, 9, 9, 9, 9, 9, 8, 8, 8, 11, 15, 23, 62, 61, 60, 58, 56, 56, 54, 53, 52, 50, 49, 48, 47, 47, 45, 45, 45, 44, 44, 43, 43, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 43, 43, 53]) },
        // todbox
        { name: "todbox 1/3 pulse", expression: 0.5, samples: centerWave([1, -1, -1]) },
        { name: "todbox 1/5 pulse", expression: 0.5, samples: centerWave([1, -1, -1, -1, -1]) },
        { name: "todbox slap bass", expression: 0.5, samples: centerAndNormalizeWave([1, 0.5, 0, 0.5, 1.25, 0.5, -0.25, 0.1, -0.1, 0.1, 1.1, 2.1, 3, 3.5, 2.9, 3.3, 2.7, 2.9, 2.3, 2, 1.9, 1.8, 1, 0.7, 0.9, 0.8, 0.4, 0.1, 0, 0.2, 0.4, 0.6, 0.5, 0.8]) },
        { name: "todbox harsh wave", expression: 0.45, samples: centerAndNormalizeWave([1, -1, -1, -1, 0.5, 0.5, 0.5, 0.7, 0.39, 1.3, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]) },
        { name: "todbox accordian", expression: 0.5, samples: centerAndNormalizeWave([0, 1, 1, 2, 2, 1.5, 1.5, 0.8, 0, -2, -3.25, -4, -4.5, -5.5, -6, -5.75, -5.5, -5, -5, -5, -6, -6, -6, -5, -4, -3, -2, -1, 0.75, 1, 2, 3, 4, 5, 6, 6.5, 7.5, 8, 7.75, 6, 5.25, 5, 5, 5, 5, 5, 4.25, 3.75, 3.25, 2.75, 1.25, -0.75, -2, -0.75, 1.25, 1.25, 2, 2, 2, 2, 1.5, -1, -2, -1, 1.5, 2, 2.75, 2.75, 2.75, 3, 2.75, -1, -2, -2.5, -2, -1, -2.25, -2.75, -2, -3, -1.75, 1, 2, 3.5, 4, 5.25, 6, 8, 9.75, 10, 9.5, 9, 8.5, 7.5, 6.5, 5.25, 5, 4.5, 4, 4, 4, 3.25, 2.5, 2, 1, -0.5, -2, -3.5, -4, -4, -4, -3.75, -3, -2, -1]) },
        // todbox beta
        { name: "todbox beta banana wave", expression: 0.8, samples: centerAndNormalizeWave([0, 0.2, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.95, 0.9, 0.85, 0.8, 0.7, 0.6, 0.5, 0.4, 0.2, 0]) },
        { name: "todbox beta test wave", expression: 0.5, samples: centerAndNormalizeWave([56, 0, -52, 16, 3, 3, 2, -35, 20, 147, -53, 0, 0, 5, -6]) },
        { name: "todbox beta real snare", expression: 1, samples: centerAndNormalizeWave([0, -0.01208, -0.02997, -0.04382, -0.06042, -0.07529, -0.09116, -0.10654, -0.12189, -0.13751, -0.15289, -0.16849, -0.18387, -0.19974, -0.21484, -0.23071, -0.24557, -0.26144, -0.27731, -0.29141, -0.3035, -0.32416, -0.34406, -0.32947, -0.31158, -0.33725, -0.37579, -0.39746, -0.40201, -0.40906, -0.4418, -0.47229, -0.47379, -0.47733, -0.45239, -0.33954, -0.22894, -0.22443, -0.32138, -0.46371, -0.57178, -0.61081, -0.59998, -0.61459, -0.62189, -0.43979, -0.19217, -0.12643, -0.17252, -0.20956, -0.20981, -0.19217, -0.22845, -0.34332, -0.50629, -0.64307, -0.72922, -0.81384, -0.87857, -0.90149, -0.88687, -0.86169, -0.87781, -0.80478, -0.52493, -0.31308, -0.33249, -0.39395, -0.39017, -0.30301, -0.19949, -0.13071, -0.02493, 0.14307, 0.34961, 0.52542, 0.63223, 0.68613, 0.7471, 0.87305, 0.98184, 0.98889, 0.97052, 0.99066, 0.99747, 0.99344, 0.99469, 0.99393, 0.9957, 0.99393, 0.99521, 0.99469, 0.9942, 0.99521, 0.9942, 0.99521, 0.99469, 0.99469, 0.99521, 0.9942, 0.99545, 0.99445, 0.99469, 0.99493, 0.9942, 0.99521, 0.99393, 0.99493, 0.99469, 0.99445, 0.9957, 0.99445, 0.99521, 0.99469, 0.99469, 0.99521, 0.9942, 0.99545, 0.99445, 0.99445, 0.99493, 0.9942, 0.99545, 0.9942, 0.99493, 0.99493, 0.9942, 0.99545, 0.99445, 0.99521, 0.99469, 0.99445, 0.99545, 0.99368, 0.99393, 0.99445, 0.99268, 0.97983, 0.97229, 0.95944, 0.88486, 0.76773, 0.64481, 0.53098, 0.39847, 0.19318, -0.03827, -0.20325, -0.39319, -0.68765, -0.88461, -0.93448, -0.96069, -0.97681, -0.98715, -0.99042, -0.99142, -0.99091, -0.99142, -0.99219, -0.99091, -0.99219, -0.99066, -0.99142, -0.99142, -0.99118, -0.99191, -0.99066, -0.99191, -0.99142, -0.99142, -0.99191, -0.99091, -0.99219, -0.99118, -0.99142, -0.99167, -0.99091, -0.99219, -0.99091, -0.99167, -0.99142, -0.99091, -0.99191, -0.99091, -0.99191, -0.99142, -0.99118, -0.99191, -0.99066, -0.99191, -0.99118, -0.99142, -0.99191, -0.99066, -0.99191, -0.99091, -0.99167, -0.99191, -0.99118, -0.99219, -0.99091, -0.99191, -0.99142, -0.99142, -0.99243, -0.98865, -0.98764, -0.99219, -0.98083, -0.92517, -0.9277, -0.91486, -0.59042, -0.15189, 0.02945, 0.05667, 0.06195, 629e-5, -0.18008, -0.56497, -0.8801, -0.9277, -0.92871, -0.97705, -0.99167, -0.98663, -0.99118, -0.99042, -0.99219, -0.99142, -0.99118, -0.98941, -0.99219, -1, -0.9758, -0.95993, -0.99948, -0.98236, -0.84659, -0.7486, -0.70679, -0.59747, -0.48035, -0.41687, -0.36826, -0.29745, -0.18185, -0.06219, 0.02164, 0.07907, 0.13123, 0.18033, 0.1962, 0.15692, 0.14053, 0.20251, 0.2753, 0.30905, 0.29092, 0.27252, 0.30402, 0.32416, 0.32214, 0.35239, 0.3967, 0.43198, 0.4942, 0.58487, 0.64154, 0.65967, 0.6705, 0.67026, 0.66522, 0.6554, 0.66119, 0.70627, 0.75842, 0.78738, 0.7894, 0.78763, 0.80402, 0.85944, 0.94559, 0.9899, 0.9816, 0.98007, 0.99368, 0.99393, 0.98538, 0.9758, 0.97101, 0.93802, 0.81812, 0.64633, 0.46649, 0.28613, 0.14685, 0.08966, 0.12543, 0.20325, 0.24557, 0.18866, 0.02795, -0.20175, -0.44205, -0.58713, -0.57629, -0.41385, -0.14255, 0.18033, 0.47882, 0.68311, 0.72314, 0.62064, 0.48309, 0.43073, 0.53577, 0.72794, 0.9025, 0.97354, 0.97, 0.98083, 0.99191, 0.99319, 0.99493, 0.99393, 0.99521, 0.99393, 0.99545, 0.9942, 0.99493, 0.99493, 0.99445, 0.99545, 0.9942, 0.99545, 0.99243, 0.98917, 0.98386, 0.97781, 0.95844, 0.89066, 0.81561, 0.78134, 0.77277, 0.75995, 0.73022, 0.67126, 0.57178, 0.47, 0.38361, 0.29419, 0.20703, 0.14734, 0.15866, 0.25162, 0.35818, 0.45062, 0.5675, 0.69748, 0.81232, 0.89697, 0.95062, 0.97656, 0.98615, 0.99191, 0.99219, 0.99243, 0.99368, 0.99368, 0.97028, 0.95566, 0.94559, 0.82617, 0.59973, 0.38361, 0.23901, 0.15338, 0.12921, 0.11206, 0.04382, -0.12946, -0.43552, -0.72644, -0.89847, -0.95465, -0.95541, -0.97229, -0.99268, -0.99319, -0.9884, -0.99142, -0.99167, -0.99091, -0.9884, -0.98965, -0.99368, -0.97455, -0.9501, -0.94684, -0.96219, -0.98514, -0.99243, -0.98889, -0.98917, -0.99142, -0.99219, -0.99091, -0.99191, -0.99142, -0.99142, -0.99191, -0.99066, -0.99167, -0.99091, -0.99142, -0.99191, -0.99091, -0.99191, -0.99091, -0.99167, -0.99167, -0.99091, -0.99219, -0.99091, -0.99191, -0.99142, -0.99118, -0.99191, -0.99066, -0.99191, -0.99091, -0.99118, -0.99243, -0.98941, -0.98462, -0.96976, -0.9632, -0.96194, -0.87305, -0.66196, -0.44809, -0.29495, -0.18085, -0.11813, -0.11334, -0.18564, -0.34885, -0.58237, -0.8045, -0.93726, -0.97806, -0.97354, -0.97531, -0.9899, -0.99368, -0.98941, -0.99219, -0.99091, -0.99142, -0.99167, -0.99091, -0.99191, -0.99118, -0.99219, -0.98236, -0.97781, -0.97656, -0.95135, -0.87204, -0.71335, -0.52139, -0.34232, -0.17783, -906e-5, 0.14886, 0.3045, 0.48889, 0.67404, 0.8403, 0.94128, 0.97681, 0.98462, 0.98337, 0.99142, 0.99521, 0.99493, 0.9942, 0.99445, 0.99521, 0.99393, 0.99545, 0.99445, 0.99521, 0.99521, 0.99445, 0.9957, 0.99445, 0.99521, 0.99469, 0.99445, 0.99521, 0.9942, 0.99521, 0.99445, 0.99445, 0.99521, 0.99445, 0.99545, 0.99445, 0.99469, 0.99493, 0.99393, 0.99493, 0.99445, 0.99393, 0.98285, 0.97781, 0.97479, 0.92844, 0.82114, 0.66095, 0.52417, 0.46826, 0.46722, 0.47934, 0.47379, 0.47076, 0.48209, 0.42014, 0.25439, 0.10074, -302e-5, -0.08966, -0.16068, -0.21436, -0.2204, -0.15137, -476e-5, 0.18536, 0.37631, 0.52292, 0.62164, 0.70425, 0.74835, 0.72366, 0.63928, 0.52567, 0.40805, 0.35666, 0.42896, 0.60175, 0.802, 0.92743, 0.96548, 0.97632, 0.98337, 0.99066, 0.99521, 0.9942, 0.99368, 0.99292, 0.9884, 0.98083, 0.96774, 0.93323, 0.8544, 0.6947, 0.47202, 0.20425, -0.0889, -0.36423, -0.60025, -0.77481, -0.90173, -0.96017, -0.97028, -0.98108, -0.9884, -0.99219, -0.9899, -0.99219, -0.99142, -0.99142, -0.99219, -0.99091, -0.99243, -0.99066, -0.99142, -0.99142, -0.99118, -0.99191, -0.99066, -0.99167, -0.99142, -0.99142, -0.99219, -0.99091, -0.99191, -0.99118, -0.99142, -0.99191, -0.99091, -0.99191, -0.99091, -0.99167, -0.99191, -0.99118, -0.99219, -0.99091, -0.99167, -0.99142, -0.99142, -0.99219, -0.99091, -0.99191, -0.99142, -0.99118, -0.98917, -0.99042, -0.99445, -0.9733, -0.9559, -0.96219, -0.8967, -0.72241, -0.55112, -0.44809, -0.39319, -0.37833, -0.35641, -0.2627, -0.1423, -0.11282, -0.13525, -0.11536, -0.09671, -0.11511, -0.1806, -0.26874, -0.33374, -0.42215, -0.51358, -0.44785, -0.3045, -0.28613, -0.30527, -0.25037, -0.1539, -0.08286, -0.11157, -0.12592, -327e-5, 0.13803, 0.19141, 0.1282, 0.01788, -0.03952, -0.12592, -0.26773, -0.34634, -0.31384, -0.1806, -0.0108, 0.13574, 0.2612, 0.36975, 0.46573, 0.55087, 0.63626, 0.73022, 0.83072, 0.92014, 0.97177, 0.98587, 0.98413, 0.99167, 0.99445, 0.99292, 0.99219, 0.9874, 0.98007, 0.96472, 0.92239, 0.82166, 0.69067, 0.57959, 0.54962, 0.59695, 0.64255, 0.64633, 0.60629, 0.55942, 0.5491, 0.58966, 0.61887, 0.56952, 0.54181, 0.59518, 0.63248, 0.63876, 0.65463, 0.73398, 0.88312, 0.96927, 0.97101, 0.97958, 0.99344, 0.9942, 0.99268, 0.99493, 0.99469, 0.99445, 0.99521, 0.99445, 0.99545, 0.9942, 0.99493, 0.99493, 0.9942, 0.99545, 0.9942, 0.99493, 0.9942, 0.99393, 0.9942, 0.9884, 0.98309, 0.98309, 0.96069, 0.88461, 0.7937, 0.72064, 0.65765, 0.59998, 0.53247, 0.49268, 0.48615, 0.44205, 0.38034, 0.36447, 0.38715, 0.39294, 0.32645, 0.19595, 0.07782, -0.05893, -0.27832, -0.48309, -0.62619, -0.72995, -0.79999, -0.84583, -0.82166, -0.73575, -0.67227, -0.65491, -0.6496, -0.66397, -0.70175, -0.72894, -0.74658, -0.76724, -0.7952, -0.82846, -0.86523, -0.90527, -0.94382, -0.89948, -0.69849, -0.47479, -0.31662, -0.15414, -729e-5, 0.07077, 0.08237, 0.04431, -0.02292, -0.11761, -0.24307, -0.36926, -0.45087, -0.4617, -0.4025, -0.30679, -0.17529, 0, 0.14331, 0.24179, 0.36774, 0.49545, 0.56522, 0.57907, 0.56775, 0.53851, 0.51132, 0.48688, 0.41913, 0.26044, 955e-5, -0.26297, -0.46396, -0.62341, -0.82214, -0.94684, -0.96774, -0.97531, -0.98413, -0.99017, -0.9899, -0.99219, -0.99066, -0.99142, -0.99167, -0.99118, -0.99219, -0.9899, -0.99118, -0.99368, -0.99142, -0.97757, -0.97403, -0.98007, -0.9617, -0.86826, -0.67783, -0.52719, -0.48788, -0.4549, -0.43146, -0.47681, -0.54105, -0.57983, -0.60904, -0.62317, -0.59949, -0.55566, -0.52063, -0.52115, -0.55112, -0.56244, -0.58337, -0.6554, -0.73373, -0.77228, -0.74759, -0.6889, -0.64609, -0.61887, -0.5806, -0.50351, -0.40729, -0.33929, -0.3511, -0.42944, -0.47028, -0.42267, -0.32718, -0.20224, -0.0564, 0.04556, 0.10529, 0.1763, 0.26169, 0.33197, 0.32138, 0.23776, 0.20956, 0.23148, 0.20352, 0.23325, 0.39267, 0.52719, 0.58438, 0.62289, 0.66345, 0.70023, 0.66296, 0.5433, 0.42618, 0.33475, 0.24533, 0.14105, 0.03851, 0.01358, 0.09143, 0.22845, 0.34961, 0.41711, 0.4874, 0.58914, 0.69519, 0.78186, 0.84357, 0.89822, 0.95389, 0.98135, 0.98615, 0.99167, 0.99243, 0.99445, 0.9942, 0.99469, 0.99493, 0.99393, 0.99545, 0.99445, 0.99521, 0.99469, 0.99445, 0.99521, 0.9942, 0.99469, 0.98965, 0.98715, 0.98563, 0.96295, 0.91736, 0.86624, 0.82367, 0.77554, 0.68411, 0.53549, 0.38916, 0.2612, 0.11435, -0.04053, -0.18161, -0.23172, -0.19394, -0.15237, -0.1073, -0.02997, 0.08588, 0.2262, 0.34305, 0.44104, 0.5574, 0.65765, 0.71259, 0.69217, 0.65363, 0.69748, 0.79572, 0.89368, 0.95514, 0.97733, 0.98413, 0.98816, 0.99243, 0.99445, 0.99243, 0.97302, 0.96674, 0.97983, 0.90378, 0.71005, 0.51056, 0.40451, 0.40982, 0.41559, 0.32996, 0.24356, 0.18866, 0.11411, 0.05365, 0.01157, -0.03247, -0.09216, -0.16095, -0.23248, -0.31662, -0.39771, -0.48663, -0.59647, -0.71536, -0.82013, -0.85287, -0.82947, -0.84937, -0.92215, -0.97177, -0.98663, -0.98816, -0.98438, -0.99091, -0.99219, -0.99091, -0.99191, -0.99042, -0.99191, -0.99091, -0.99142, -0.99191, -0.99091, -0.99191, -0.99091, -0.99167, -0.99142]) },
        // based off an old mp3 in #modded-beepbox where someone tried to shorten the overdrive guitar into the size of other chip waves 
        // search "normie alert" in beepcord
        { name: "ultrabox shortened od guitar", expression: 0.5, samples: centerAndNormalizeWave([-0.82785, -0.67621, -0.40268, -0.43817, -0.45468, -0.22531, -0.18329, 0.2475, 0.71246, 0.52155, 0.56082, 0.48395, 0.3399, 0.46957, 0.27744, 0.42313, 0.47104, 0.18796, 0.1293, -0.13901, -0.07431, -0.16348, -0.74857, -0.73206, -0.35181, -0.26227, -0.41882, -0.27786, -0.19806, -0.19867, 0.18643, 0.24808, 0.08847, -0.06964, 0.06912, 0.20474, -0.05304, 0.29416, 0.31967, 0.14243, 0.27521, -0.23932, -0.14752, 0.1236, -0.26123, -0.26111, 0.06616, 0.2652, 0.0809, 0.1524, 0.16254, -0.12061, 0.04562, 131e-5, 0.0405, 0.08182, -0.21729, -0.17041, -0.16312, -0.08563, 0.0639, 0.05099, 0.05627, 0.02728, 726e-5, -0.13028, -0.05673, -0.14969, -0.17645, 0.35492, 0.16766, -897e-5, 0.24326, -461e-5, -0.04456, 0.01776, -0.0495, -0.01221, 0.02039, 0.07684, 0.13397, 0.3985, 0.35962, 0.13754, 0.4231, 0.27161, -0.17609, 0.03659, 0.10635, -0.21909, -0.22046, -0.20258, -0.40973, -0.4028, -0.40521, -0.66284]) }
      ]);
    }
    static {
      this.chipWaves = rawChipToIntegrated(_Config.rawChipWaves);
    }
    static {
      this.rawRawChipWaves = _Config.rawChipWaves;
    }
    static {
      this.firstIndexForSamplesInChipWaveList = _Config.chipWaves.length;
    }
    static {
      // Noise waves have too many samples to write by hand, they're generated on-demand by getDrumWave instead.
      this.chipNoises = toNameMap([
        { name: "retro", expression: 0.25, basePitch: 69, pitchFilterMult: 1024, isSoft: false, samples: null },
        { name: "white", expression: 1, basePitch: 69, pitchFilterMult: 8, isSoft: true, samples: null },
        // The "clang" and "buzz" noises are based on similar noises in the modded beepbox! :D
        { name: "clang", expression: 0.4, basePitch: 69, pitchFilterMult: 1024, isSoft: false, samples: null },
        { name: "buzz", expression: 0.3, basePitch: 69, pitchFilterMult: 1024, isSoft: false, samples: null },
        { name: "hollow", expression: 1.5, basePitch: 96, pitchFilterMult: 1, isSoft: true, samples: null },
        { name: "shine", expression: 1, basePitch: 69, pitchFilterMult: 1024, isSoft: false, samples: null },
        // Identical to buzz but louder. For now we're keeping it...
        { name: "deep", expression: 1.5, basePitch: 120, pitchFilterMult: 1024, isSoft: true, samples: null },
        { name: "cutter", expression: 5e-3, basePitch: 96, pitchFilterMult: 1024, isSoft: false, samples: null },
        { name: "metallic", expression: 1, basePitch: 96, pitchFilterMult: 1024, isSoft: false, samples: null },
        { name: "static", expression: 1, basePitch: 96, pitchFilterMult: 1024, isSoft: false, samples: null },
        // technically these are from the pandorasbox beta but whatever
        { name: "1-bit white", expression: 0.5, basePitch: 74.41, pitchFilterMult: 1024, isSoft: false, samples: null },
        { name: "1-bit metallic", expression: 0.5, basePitch: 86.41, pitchFilterMult: 1024, isSoft: false, samples: null },
        // ultrabox noises
        { name: "crackling", expression: 0.9, basePitch: 69, pitchFilterMult: 1024, isSoft: false, samples: null },
        { name: "pink", expression: 1, basePitch: 69, pitchFilterMult: 8, isSoft: true, samples: null },
        { name: "brownian", expression: 1, basePitch: 69, pitchFilterMult: 8, isSoft: true, samples: null }
      ]);
    }
    static {
      this.filterFreqStep = 1 / 4;
    }
    static {
      this.filterFreqRange = 34;
    }
    static {
      this.filterFreqReferenceSetting = 28;
    }
    static {
      this.filterFreqReferenceHz = 8e3;
    }
    static {
      this.filterFreqMaxHz = _Config.filterFreqReferenceHz * Math.pow(2, _Config.filterFreqStep * (_Config.filterFreqRange - 1 - _Config.filterFreqReferenceSetting));
    }
    static {
      // ~19khz
      this.filterFreqMinHz = 8;
    }
    static {
      this.filterGainRange = 15;
    }
    static {
      this.filterGainCenter = 7;
    }
    static {
      this.filterGainStep = 1 / 2;
    }
    static {
      this.filterMaxPoints = 12;
    }
    static {
      this.filterTypeNames = ["low-pass", "high-pass", "peak"];
    }
    static {
      // See FilterType enum above.
      this.filterMorphCount = 10;
    }
    static {
      // Number of filter shapes allowed for modulating between. Counts the 0/default position.
      this.filterSimpleCutRange = 11;
    }
    static {
      this.filterSimplePeakRange = 8;
    }
    static {
      this.fadeInRange = 10;
    }
    static {
      this.fadeOutTicks = [-24, -12, -6, -3, -1, 6, 12, 24, 48, 72, 96];
    }
    static {
      this.fadeOutNeutral = 4;
    }
    static {
      this.drumsetFadeOutTicks = 48;
    }
    static {
      this.transitions = toNameMap([
        { name: "normal", isSeamless: false, continues: false, slides: false, slideTicks: 3, includeAdjacentPatterns: false },
        { name: "interrupt", isSeamless: true, continues: false, slides: false, slideTicks: 3, includeAdjacentPatterns: true },
        { name: "continue", isSeamless: true, continues: true, slides: false, slideTicks: 3, includeAdjacentPatterns: true },
        { name: "slide", isSeamless: true, continues: false, slides: true, slideTicks: 3, includeAdjacentPatterns: true },
        { name: "slide in pattern", isSeamless: true, continues: false, slides: true, slideTicks: 3, includeAdjacentPatterns: false }
      ]);
    }
    static {
      this.vibratos = toNameMap([
        { name: "none", amplitude: 0, type: 0, delayTicks: 0 },
        { name: "light", amplitude: 0.15, type: 0, delayTicks: 0 },
        { name: "delayed", amplitude: 0.3, type: 0, delayTicks: 37 },
        // It will fade in over the previous two ticks.
        { name: "heavy", amplitude: 0.45, type: 0, delayTicks: 0 },
        { name: "shaky", amplitude: 0.1, type: 1, delayTicks: 0 }
        //    { name: "very shaky", amplitude: 1, type: 0, delayTicks: 0 },
        //{ name: "insane", amplitude: 10, type: 1, delayTicks: 0 },
        //todbox vibratos
        //	{ name: "super insane", amplitude: 30, type: 1, delayTicks: 1 },
        //wackybox
        //	 { name: "quiver", amplitude: 0.001, type: 0, delayTicks: 0 },
        //  { name: "wub-wub", amplitude: 10.0, type: 0, delayTicks: 0 },
        //     { name: "quiver delayed", amplitude: 0.001, type: 0, delayTicks: 18 },
        //  { name: "vibrate", amplitude: 0.08, type: 0, delayTicks: 0 },
        //    { name: "too much wub", amplitude: 30.0, type: 0, delayTicks: 18 },
        //too much wub breaks things just a little bit at it's original amplitude
        //sandbox
      ]);
    }
    static {
      this.vibratoTypes = toNameMap([
        { name: "normal", periodsSeconds: [0.14], period: 0.14 },
        { name: "shaky", periodsSeconds: [0.11, 1.618 * 0.11, 3 * 0.11], period: 266.97 }
        // LCM of all periods
      ]);
    }
    static {
      // This array is more or less a linear step by 0.1 but there's a bit of range added at the start to hit specific ratios, and the end starts to grow faster.
      //                                                             0       1      2    3     4      5    6    7      8     9   10   11 12   13   14   15   16   17   18   19   20   21 22   23   24   25   26   27   28   29   30   31 32   33   34   35   36   37   38    39  40   41 42    43   44   45   46 47   48 49 50
      this.arpSpeedScale = [0, 0.0625, 0.125, 0.2, 0.25, 1 / 3, 0.4, 0.5, 2 / 3, 0.75, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4, 4.15, 4.3, 4.5, 4.8, 5, 5.5, 6, 8];
    }
    static {
      //is also used for instrument-wide envelope speed
      this.unisons = toNameMap([
        { name: "none", voices: 1, spread: 0, offset: 0, expression: 1.4, sign: 1 },
        { name: "shimmer", voices: 2, spread: 0.018, offset: 0, expression: 0.8, sign: 1 },
        { name: "hum", voices: 2, spread: 0.045, offset: 0, expression: 1, sign: 1 },
        { name: "honky tonk", voices: 2, spread: 0.09, offset: 0, expression: 1, sign: 1 },
        { name: "dissonant", voices: 2, spread: 0.25, offset: 0, expression: 0.9, sign: 1 },
        { name: "fifth", voices: 2, spread: 3.5, offset: 3.5, expression: 0.9, sign: 1 },
        { name: "octave", voices: 2, spread: 6, offset: 6, expression: 0.8, sign: 1 },
        { name: "bowed", voices: 2, spread: 0.02, offset: 0, expression: 1, sign: -1 },
        { name: "piano", voices: 2, spread: 0.01, offset: 0, expression: 1, sign: 0.7 },
        { name: "warbled", voices: 2, spread: 0.25, offset: 0.05, expression: 0.9, sign: -0.8 },
        { name: "hecking gosh", voices: 2, spread: 6.25, offset: -6, expression: 0.8, sign: -0.7 },
        { name: "spinner", voices: 2, spread: 0.02, offset: 0, expression: 1, sign: 1 },
        { name: "detune", voices: 1, spread: 0, offset: 0.25, expression: 1, sign: 1 },
        { name: "rising", voices: 2, spread: 1, offset: 0.7, expression: 0.95, sign: 1 },
        { name: "vibrate", voices: 2, spread: 3.5, offset: 7, expression: 0.975, sign: 1 },
        { name: "fourths", voices: 2, spread: 4, offset: 4, expression: 0.95, sign: 1 },
        { name: "bass", voices: 1, spread: 0, offset: -7, expression: 1, sign: 1 },
        { name: "dirty", voices: 2, spread: 0, offset: 0.1, expression: 0.975, sign: 1 },
        { name: "stationary", voices: 2, spread: 3.5, offset: 0, expression: 0.9, sign: 1 },
        { name: "recurve", voices: 2, spread: 5e-3, offset: 0, expression: 1, sign: 1 },
        { name: "voiced", voices: 2, spread: 9.5, offset: 0, expression: 1, sign: 1 },
        { name: "fluctuate", voices: 2, spread: 12, offset: 0, expression: 1, sign: 1 },
        { name: "thin", voices: 1, spread: 0, offset: 50, expression: 1, sign: 1 },
        { name: "inject", voices: 2, spread: 6, offset: 0.4, expression: 1, sign: 1 },
        { name: "askewed", voices: 2, spread: 0, offset: 0.42, expression: 0.7, sign: 1 },
        { name: "resonance", voices: 2, spread: 25e-4, offset: 0.1, expression: 0.8, sign: -1.5 },
        { name: "FART", voices: 2, spread: 13, offset: -5, expression: 1, sign: -3 },
        { name: "augmented", voices: 4, spread: 6, offset: 6, expression: 0.5, sign: 1 },
        { name: "diminished", voices: 5, spread: 6, offset: 6, expression: 0.4, sign: 1 },
        { name: "chorus", voices: 9, spread: 0.22, offset: 0, expression: 0.15, sign: 1 },
        { name: "block", voices: 9, spread: 6, offset: 6, expression: 0.15, sign: 0.8 },
        { name: "extraterrestrial", voices: 6, spread: 15.2, offset: -6, expression: 0.35, sign: 0.7 },
        { name: "bow", voices: 9, spread: 6e-3, offset: 0, expression: 0.15, sign: 0.5 }
        //for modbox; voices = riffapp, spread = intervals, offset = offsets, expression = volume, and sign = signs
      ]);
    }
    static {
      this.effectNames = ["reverb", "chorus", "panning", "distortion", "bitcrusher", "note filter", "echo", "pitch shift", "detune", "vibrato", "transition type", "chord type", "", "ring mod", "granular", "plugin"];
    }
    static {
      this.effectOrder = [2 /* panning */, 10 /* transition */, 11 /* chord */, 7 /* pitchShift */, 8 /* detune */, 9 /* vibrato */, 5 /* noteFilter */, 14 /* granular */, 3 /* distortion */, 4 /* bitcrusher */, 1 /* chorus */, 6 /* echo */, 0 /* reverb */, 13 /* ringModulation */, 15 /* plugin */];
    }
    static {
      this.noteSizeMax = 6;
    }
    static {
      this.volumeRange = 50;
    }
    static {
      // Beepbox's old volume scale used factor -0.5 and was [0~7] had roughly value 6 = 0.125 power. This new value is chosen to have -21 be the same,
      // given that the new scale is [-25~25]. This is such that conversion between the scales is roughly equivalent by satisfying (0.5*6 = 0.1428*21)
      this.volumeLogScale = 0.1428;
    }
    static {
      this.panCenter = 50;
    }
    static {
      this.panMax = _Config.panCenter * 2;
    }
    static {
      this.panDelaySecondsMax = 1e-3;
    }
    static {
      this.ringModRange = 8;
    }
    static {
      this.ringModHzRange = 64;
    }
    static {
      this.ringModMinHz = 20;
    }
    static {
      this.ringModMaxHz = 4400;
    }
    static {
      this.rmHzOffsetCenter = 200;
    }
    static {
      this.rmHzOffsetMax = 400;
    }
    static {
      this.rmHzOffsetMin = 0;
    }
    static {
      this.granularRange = 10;
    }
    static {
      this.grainSizeMin = 40;
    }
    static {
      this.grainSizeMax = 2e3;
    }
    static {
      this.grainSizeStep = 40;
    }
    static {
      this.grainRangeMax = 1600;
    }
    static {
      this.grainAmountsMax = 10;
    }
    static {
      //2^grainAmountsMax is what is actually used
      this.granularEnvelopeType = 0 /* parabolic */;
    }
    static {
      //here you can change which envelope implementation is used for grains (RaisedCosineBell still needs work)
      this.chorusRange = 8;
    }
    static {
      this.chorusPeriodSeconds = 2;
    }
    static {
      this.chorusDelayRange = 34e-4;
    }
    static {
      this.chorusDelayOffsets = [[1.51, 2.1, 3.35], [1.47, 2.15, 3.25]];
    }
    static {
      this.chorusPhaseOffsets = [[0, 2.1, 4.2], [3.2, 5.3, 1]];
    }
    static {
      this.chorusMaxDelay = _Config.chorusDelayRange * (1 + _Config.chorusDelayOffsets[0].concat(_Config.chorusDelayOffsets[1]).reduce((x, y) => Math.max(x, y)));
    }
    static {
      this.chords = toNameMap([
        { name: "simultaneous", customInterval: false, arpeggiates: false, strumParts: 0, singleTone: false },
        { name: "strum", customInterval: false, arpeggiates: false, strumParts: 1, singleTone: false },
        { name: "arpeggio", customInterval: false, arpeggiates: true, strumParts: 0, singleTone: true },
        { name: "custom interval", customInterval: true, arpeggiates: false, strumParts: 0, singleTone: true },
        { name: "monophonic", customInterval: false, arpeggiates: false, strumParts: 0, singleTone: true }
      ]);
    }
    static {
      this.maxChordSize = 9;
    }
    static {
      this.operatorCount = 4;
    }
    static {
      this.maxPitchOrOperatorCount = Math.max(_Config.maxChordSize, _Config.operatorCount + 2);
    }
    static {
      this.algorithms = toNameMap([
        { name: "1\u2190(2\u20023\u20024)", carrierCount: 1, associatedCarrier: [1, 1, 1, 1], modulatedBy: [[2, 3, 4], [], [], []] },
        { name: "1\u2190(2\u20023\u21904)", carrierCount: 1, associatedCarrier: [1, 1, 1, 1], modulatedBy: [[2, 3], [], [4], []] },
        { name: "1\u21902\u2190(3\u20024)", carrierCount: 1, associatedCarrier: [1, 1, 1, 1], modulatedBy: [[2], [3, 4], [], []] },
        { name: "1\u2190(2\u20023)\u21904", carrierCount: 1, associatedCarrier: [1, 1, 1, 1], modulatedBy: [[2, 3], [4], [4], []] },
        { name: "1\u21902\u21903\u21904", carrierCount: 1, associatedCarrier: [1, 1, 1, 1], modulatedBy: [[2], [3], [4], []] },
        { name: "1\u21903\u20032\u21904", carrierCount: 2, associatedCarrier: [1, 2, 1, 2], modulatedBy: [[3], [4], [], []] },
        { name: "1\u20032\u2190(3\u20024)", carrierCount: 2, associatedCarrier: [1, 2, 2, 2], modulatedBy: [[], [3, 4], [], []] },
        { name: "1\u20032\u21903\u21904", carrierCount: 2, associatedCarrier: [1, 2, 2, 2], modulatedBy: [[], [3], [4], []] },
        { name: "(1\u20022)\u21903\u21904", carrierCount: 2, associatedCarrier: [1, 2, 2, 2], modulatedBy: [[3], [3], [4], []] },
        { name: "(1\u20022)\u2190(3\u20024)", carrierCount: 2, associatedCarrier: [1, 2, 2, 2], modulatedBy: [[3, 4], [3, 4], [], []] },
        { name: "1\u20032\u20033\u21904", carrierCount: 3, associatedCarrier: [1, 2, 3, 3], modulatedBy: [[], [], [4], []] },
        { name: "(1\u20022\u20023)\u21904", carrierCount: 3, associatedCarrier: [1, 2, 3, 3], modulatedBy: [[4], [4], [4], []] },
        { name: "1\u20032\u20033\u20034", carrierCount: 4, associatedCarrier: [1, 2, 3, 4], modulatedBy: [[], [], [], []] },
        { name: "1\u2190(2 3)\u20032\u21904", carrierCount: 2, associatedCarrier: [1, 2, 1, 2], modulatedBy: [[2, 3], [4], [], []] },
        { name: "1\u2190(2 (3 (4", carrierCount: 3, associatedCarrier: [1, 2, 3, 3], modulatedBy: [[2, 3, 4], [3, 4], [4], []] }
      ]);
    }
    static {
      this.algorithms6Op = toNameMap([
        //placeholder makes life easier for later
        { name: "Custom", carrierCount: 1, associatedCarrier: [1, 1, 1, 1, 1, 1], modulatedBy: [[2, 3, 4, 5, 6], [], [], [], [], []] },
        //yoinked from SynthBox
        //algortihm Section 1
        { name: "1\u21902\u21903\u21904\u21905\u21906", carrierCount: 1, associatedCarrier: [1, 1, 1, 1, 1, 1], modulatedBy: [[2], [3], [4], [5], [6], []] },
        { name: "1\u21903\u20032\u21904\u21905\u21906", carrierCount: 2, associatedCarrier: [1, 2, 2, 2, 2, 2], modulatedBy: [[3], [4], [], [5], [6], []] },
        { name: "1\u21903\u21904\u20032\u21905\u21906", carrierCount: 2, associatedCarrier: [1, 1, 1, 2, 2, 2], modulatedBy: [[3], [5], [4], [], [6], []] },
        { name: "1\u21904\u20032\u21905\u20033\u21906", carrierCount: 3, associatedCarrier: [1, 2, 3, 1, 2, 3], modulatedBy: [[4], [5], [6], [], [], []] },
        //Algorithm Section 2
        { name: "1\u21903\u20022\u2190(4\u20025\u21906)", carrierCount: 2, associatedCarrier: [1, 2, 2, 2, 2, 2], modulatedBy: [[3], [4, 5], [], [], [6], []] },
        { name: "1\u2190(3\u20024)\u20022\u21905\u21906", carrierCount: 2, associatedCarrier: [1, 2, 2, 2, 2, 2], modulatedBy: [[3, 4], [5], [], [], [6], []] },
        { name: "1\u21903\u20022\u2190(4\u20025\u20026)", carrierCount: 2, associatedCarrier: [1, 2, 2, 2, 2, 2], modulatedBy: [[3], [4, 5, 6], [], [], [], []] },
        { name: "1\u21903\u20022\u2190(4\u20025)\u21906", carrierCount: 2, associatedCarrier: [1, 2, 2, 2, 2, 2], modulatedBy: [[3], [4, 5], [], [6], [6], []] },
        { name: "1\u21903\u20022\u21904\u2190(5\u20026)", carrierCount: 2, associatedCarrier: [1, 2, 2, 2, 2, 2], modulatedBy: [[3], [4], [], [5, 6], [], []] },
        { name: "1\u2190(2\u20023\u20024\u20025\u20026)", carrierCount: 1, associatedCarrier: [1, 1, 1, 1, 1, 1], modulatedBy: [[2, 3, 4, 5, 6], [], [], [], [], []] },
        { name: "1\u2190(2\u20023\u21905\u20024\u21906)", carrierCount: 1, associatedCarrier: [1, 1, 1, 1, 1, 1], modulatedBy: [[2, 3, 4], [], [5], [6], [], []] },
        { name: "1\u2190(2\u20023\u20024\u21905\u21906)", carrierCount: 1, associatedCarrier: [1, 1, 1, 1, 1, 1], modulatedBy: [[2, 3, 4], [], [], [5], [6], []] },
        //Algorithm Section 3
        { name: "1\u21904\u21905\u2003(2\u20033)\u21906", carrierCount: 3, associatedCarrier: [1, 2, 3, 1, 2, 3], modulatedBy: [[4], [6], [6], [5], [], []] },
        { name: "1\u2190(3\u20034)\u21905 2\u21906", carrierCount: 2, associatedCarrier: [1, 2, 2, 2, 2, 2], modulatedBy: [[3, 4], [6], [5], [5], [], []] },
        { name: "(1\u20032)\u21904\u20033\u2190(5\u20036)", carrierCount: 3, associatedCarrier: [1, 2, 3, 1, 2, 3], modulatedBy: [[4], [4], [5, 6], [], [], []] },
        { name: "(1\u20032)\u21905\u2003(3\u20034)\u21906", carrierCount: 4, associatedCarrier: [1, 2, 3, 4, 4, 4], modulatedBy: [[5], [5], [6], [6], [], []] },
        { name: "(1\u20032\u20033)\u2190(4\u20035\u20036)", carrierCount: 3, associatedCarrier: [1, 2, 3, 1, 2, 3], modulatedBy: [[4, 5, 6], [4, 5, 6], [4, 5, 6], [], [], []] },
        { name: "1\u21905\u2003(2\u20033\u20034)\u21906", carrierCount: 4, associatedCarrier: [1, 2, 3, 4, 4, 4], modulatedBy: [[5], [6], [6], [6], [], []] },
        { name: "1\u20032\u21905\u2003(3\u20034)\u21906", carrierCount: 4, associatedCarrier: [1, 2, 3, 4, 4, 4], modulatedBy: [[], [5], [6], [6], [], []] },
        { name: "1\u20032\u2003(3\u20034\u20035)\u21906", carrierCount: 5, associatedCarrier: [1, 2, 3, 4, 5, 5], modulatedBy: [[], [], [6], [6], [6], []] },
        { name: "1\u20032\u20033\u2003(4\u20035)\u21906", carrierCount: 5, associatedCarrier: [1, 2, 3, 4, 5, 5], modulatedBy: [[], [], [], [6], [6], []] },
        //Algorithm Section 3
        { name: "1\u20032\u21904\u20033\u2190(5\u20036)", carrierCount: 3, associatedCarrier: [1, 2, 3, 3, 3, 3], modulatedBy: [[], [4], [5, 6], [], [], []] },
        { name: "1\u21904\u20032\u2190(5\u20036)\u20033", carrierCount: 3, associatedCarrier: [1, 2, 3, 3, 3, 3], modulatedBy: [[4], [5, 6], [], [], [], []] },
        { name: "1\u20032\u20033\u21905\u20034\u21906", carrierCount: 4, associatedCarrier: [1, 2, 3, 4, 4, 4], modulatedBy: [[], [], [5], [6], [], []] },
        { name: "1\u2003(2\u20033)\u21905\u21906\u20034", carrierCount: 4, associatedCarrier: [1, 2, 3, 4, 4, 4], modulatedBy: [[], [5], [5], [], [6], []] },
        { name: "1\u20032\u20033\u21905\u21906\u20034", carrierCount: 4, associatedCarrier: [1, 2, 3, 4, 4, 4], modulatedBy: [[], [], [5, 6], [], [], []] },
        { name: "(1\u20032\u20033\u20034\u20035)\u21906", carrierCount: 5, associatedCarrier: [1, 2, 3, 4, 5, 5], modulatedBy: [[6], [6], [6], [6], [6], []] },
        { name: "1\u20032\u20033\u20034\u20035\u21906", carrierCount: 5, associatedCarrier: [1, 2, 3, 4, 5, 5], modulatedBy: [[], [], [], [], [6], []] },
        { name: "1\u20032\u20033\u20034\u20035\u20036", carrierCount: 6, associatedCarrier: [1, 2, 3, 4, 5, 6], modulatedBy: [[], [], [], [], [], []] },
        //Section 4 where we take our own previous ones for 4op and it gets weird
        { name: "1\u2190(2 (3 (4 (5 (6", carrierCount: 5, associatedCarrier: [1, 2, 3, 4, 5, 5], modulatedBy: [[2, 3, 4, 5, 6], [3, 4, 5, 6], [4, 5, 6], [5, 6], [6], []] },
        { name: "1\u2190(2(3(4(5(6", carrierCount: 1, associatedCarrier: [1, 1, 1, 1, 1, 1], modulatedBy: [[2, 3, 4, 5, 6], [3, 4, 5, 6], [4, 5, 6], [5, 6], [6], []] },
        { name: "1\u21904(2\u21905(3\u21906", carrierCount: 3, associatedCarrier: [1, 2, 3, 1, 2, 3], modulatedBy: [[2, 3, 4], [3, 5], [6], [], [], []] },
        { name: "1\u21904(2\u21905 3\u21906", carrierCount: 3, associatedCarrier: [1, 2, 3, 1, 2, 3], modulatedBy: [[2, 3, 4], [5], [6], [], [], []] }
      ]);
    }
    static {
      this.operatorCarrierInterval = [0, 0.04, -0.073, 0.091, 0.061, 0.024];
    }
    static {
      this.operatorAmplitudeMax = 15;
    }
    static {
      this.operatorFrequencies = toNameMap([
        { name: "0.12\xD7", mult: 0.125, hzOffset: 0, amplitudeSign: 1 },
        { name: "0.25\xD7", mult: 0.25, hzOffset: 0, amplitudeSign: 1 },
        { name: "0.5\xD7", mult: 0.5, hzOffset: 0, amplitudeSign: 1 },
        { name: "0.75\xD7", mult: 0.75, hzOffset: 0, amplitudeSign: 1 },
        { name: "1\xD7", mult: 1, hzOffset: 0, amplitudeSign: 1 },
        { name: "~1\xD7", mult: 1, hzOffset: 1.5, amplitudeSign: -1 },
        { name: "2\xD7", mult: 2, hzOffset: 0, amplitudeSign: 1 },
        { name: "~2\xD7", mult: 2, hzOffset: -1.3, amplitudeSign: -1 },
        { name: "3\xD7", mult: 3, hzOffset: 0, amplitudeSign: 1 },
        { name: "3.5\xD7", mult: 3.5, hzOffset: -0.05, amplitudeSign: 1 },
        { name: "4\xD7", mult: 4, hzOffset: 0, amplitudeSign: 1 },
        { name: "~4\xD7", mult: 4, hzOffset: -2.4, amplitudeSign: -1 },
        { name: "5\xD7", mult: 5, hzOffset: 0, amplitudeSign: 1 },
        { name: "6\xD7", mult: 6, hzOffset: 0, amplitudeSign: 1 },
        { name: "7\xD7", mult: 7, hzOffset: 0, amplitudeSign: 1 },
        { name: "8\xD7", mult: 8, hzOffset: 0, amplitudeSign: 1 },
        { name: "9\xD7", mult: 9, hzOffset: 0, amplitudeSign: 1 },
        { name: "10\xD7", mult: 10, hzOffset: 0, amplitudeSign: 1 },
        { name: "11\xD7", mult: 11, hzOffset: 0, amplitudeSign: 1 },
        { name: "12\xD7", mult: 12, hzOffset: 0, amplitudeSign: 1 },
        { name: "13\xD7", mult: 13, hzOffset: 0, amplitudeSign: 1 },
        { name: "14\xD7", mult: 14, hzOffset: 0, amplitudeSign: 1 },
        { name: "15\xD7", mult: 15, hzOffset: 0, amplitudeSign: 1 },
        //ultrabox
        { name: "16\xD7", mult: 16, hzOffset: 0, amplitudeSign: 1 },
        { name: "17\xD7", mult: 17, hzOffset: 0, amplitudeSign: 1 },
        //ultrabox
        { name: "18\xD7", mult: 18, hzOffset: 0, amplitudeSign: 1 },
        { name: "19\xD7", mult: 19, hzOffset: 0, amplitudeSign: 1 },
        //ultrabox
        { name: "20\xD7", mult: 20, hzOffset: 0, amplitudeSign: 1 },
        { name: "~20\xD7", mult: 20, hzOffset: -5, amplitudeSign: -1 },
        // dogebox (maybe another mod also adds this? I got it from dogebox)
        { name: "25\xD7", mult: 25, hzOffset: 0, amplitudeSign: 1 },
        { name: "50\xD7", mult: 50, hzOffset: 0, amplitudeSign: 1 },
        { name: "75\xD7", mult: 75, hzOffset: 0, amplitudeSign: 1 },
        { name: "100\xD7", mult: 100, hzOffset: 0, amplitudeSign: 1 },
        //50 and 100 are from dogebox
        //128 and 256 from slarmoo's box
        { name: "128\xD7", mult: 128, hzOffset: 0, amplitudeSign: 1 },
        { name: "256\xD7", mult: 250, hzOffset: 0, amplitudeSign: 1 }
      ]);
    }
    static {
      //still used for drumsets
      this.envelopePresets = toNameMap([
        { name: "none", type: 0 /* none */, speed: 1 },
        { name: "note size", type: 1 /* noteSize */, speed: 1 },
        { name: "pitch", type: 2 /* pitch */, speed: 1 },
        // Slarmoo's box (fairly useless on drumsets)
        { name: "punch", type: 4 /* punch */, speed: 1 },
        { name: "flare -1", type: 5 /* flare */, speed: 128 },
        { name: "flare 1", type: 5 /* flare */, speed: 32 },
        { name: "flare 2", type: 5 /* flare */, speed: 8 },
        { name: "flare 3", type: 5 /* flare */, speed: 2 },
        { name: "twang -1", type: 6 /* twang */, speed: 128 },
        { name: "twang 1", type: 6 /* twang */, speed: 32 },
        { name: "twang 2", type: 6 /* twang */, speed: 8 },
        { name: "twang 3", type: 6 /* twang */, speed: 2 },
        { name: "swell -1", type: 7 /* swell */, speed: 128 },
        { name: "swell 1", type: 7 /* swell */, speed: 32 },
        { name: "swell 2", type: 7 /* swell */, speed: 8 },
        { name: "swell 3", type: 7 /* swell */, speed: 2 },
        { name: "tremolo0", type: 8 /* lfo */, speed: 8 },
        { name: "tremolo1", type: 8 /* lfo */, speed: 4 },
        { name: "tremolo2", type: 8 /* lfo */, speed: 2 },
        { name: "tremolo3", type: 8 /* lfo */, speed: 1 },
        { name: "tremolo4", type: 9 /* tremolo2 */, speed: 4 },
        { name: "tremolo5", type: 9 /* tremolo2 */, speed: 2 },
        { name: "tremolo6", type: 9 /* tremolo2 */, speed: 1 },
        { name: "decay -1", type: 10 /* decay */, speed: 40 },
        { name: "decay 1", type: 10 /* decay */, speed: 10 },
        { name: "decay 2", type: 10 /* decay */, speed: 7 },
        { name: "decay 3", type: 10 /* decay */, speed: 4 },
        { name: "wibble-1", type: 11 /* wibble */, speed: 128 },
        //Changed speed from 96 to 128. I forgot to include a 96 earlier, and now it's too late to add one, so we have this now. Hopefully no one notices
        { name: "wibble 1", type: 11 /* wibble */, speed: 24 },
        { name: "wibble 2", type: 11 /* wibble */, speed: 12 },
        { name: "wibble 3", type: 11 /* wibble */, speed: 4 },
        { name: "linear-2", type: 12 /* linear */, speed: 256 },
        { name: "linear-1", type: 12 /* linear */, speed: 128 },
        { name: "linear 1", type: 12 /* linear */, speed: 32 },
        { name: "linear 2", type: 12 /* linear */, speed: 8 },
        { name: "linear 3", type: 12 /* linear */, speed: 2 },
        { name: "rise -2", type: 13 /* rise */, speed: 256 },
        { name: "rise -1", type: 13 /* rise */, speed: 128 },
        { name: "rise 1", type: 13 /* rise */, speed: 32 },
        { name: "rise 2", type: 13 /* rise */, speed: 8 },
        { name: "rise 3", type: 13 /* rise */, speed: 2 },
        // modbox
        { name: "flute 1", type: 11 /* wibble */, speed: 16 },
        { name: "flute 2", type: 11 /* wibble */, speed: 8 },
        { name: "flute 3", type: 11 /* wibble */, speed: 4 },
        // sandbox
        { name: "tripolo1", type: 8 /* lfo */, speed: 9 },
        { name: "tripolo2", type: 8 /* lfo */, speed: 6 },
        { name: "tripolo3", type: 8 /* lfo */, speed: 3 },
        { name: "tripolo4", type: 9 /* tremolo2 */, speed: 9 },
        { name: "tripolo5", type: 9 /* tremolo2 */, speed: 6 },
        { name: "tripolo6", type: 9 /* tremolo2 */, speed: 3 },
        { name: "pentolo1", type: 8 /* lfo */, speed: 10 },
        { name: "pentolo2", type: 8 /* lfo */, speed: 5 },
        { name: "pentolo3", type: 8 /* lfo */, speed: 2.5 },
        { name: "pentolo4", type: 9 /* tremolo2 */, speed: 10 },
        { name: "pentolo5", type: 9 /* tremolo2 */, speed: 5 },
        { name: "pentolo6", type: 9 /* tremolo2 */, speed: 2.5 },
        // todbox
        { name: "flutter 1", type: 8 /* lfo */, speed: 14 },
        { name: "flutter 2", type: 9 /* tremolo2 */, speed: 11 },
        { name: "water-y flutter", type: 8 /* lfo */, speed: 9 },
        // new jummbox
        { name: "blip 1", type: 14 /* blip */, speed: 6 },
        { name: "blip 2", type: 14 /* blip */, speed: 16 },
        { name: "blip 3", type: 14 /* blip */, speed: 32 },
        // Slarmoo's Box
        { name: "fall 1", type: 15 /* fall */, speed: 8 },
        { name: "fall 2", type: 15 /* fall */, speed: 4 },
        { name: "fall 3", type: 15 /* fall */, speed: 2 }
      ]);
    }
    static {
      this.envelopes = toNameMap([
        { name: "none", type: 0 /* none */, speed: 1 },
        { name: "note size", type: 1 /* noteSize */, speed: 1 },
        { name: "pitch", type: 2 /* pitch */, speed: 1 },
        { name: "random", type: 3 /* pseudorandom */, speed: 4 },
        //Slarmoo's box 1.3
        { name: "punch", type: 4 /* punch */, speed: 1 },
        { name: "flare", type: 5 /* flare */, speed: 32 },
        { name: "twang", type: 6 /* twang */, speed: 32 },
        { name: "swell", type: 7 /* swell */, speed: 32 },
        { name: "lfo", type: 8 /* lfo */, speed: 1 },
        //replaced tremolo and tremolo2 Slarmoo's Box 1.3
        { name: "decay", type: 10 /* decay */, speed: 10 },
        { name: "wibble", type: 11 /* wibble */, speed: 24 },
        { name: "linear", type: 12 /* linear */, speed: 32 },
        { name: "rise", type: 13 /* rise */, speed: 32 },
        { name: "blip", type: 14 /* blip */, speed: 6 },
        { name: "fall", type: 15 /* fall */, speed: 6 }
      ]);
    }
    static {
      this.feedbacks = toNameMap([
        { name: "1\u27F2", indices: [[1], [], [], []] },
        { name: "2\u27F2", indices: [[], [2], [], []] },
        { name: "3\u27F2", indices: [[], [], [3], []] },
        { name: "4\u27F2", indices: [[], [], [], [4]] },
        { name: "1\u27F2\u20032\u27F2", indices: [[1], [2], [], []] },
        { name: "3\u27F2\u20034\u27F2", indices: [[], [], [3], [4]] },
        { name: "1\u27F2\u20032\u27F2\u20033\u27F2", indices: [[1], [2], [3], []] },
        { name: "2\u27F2\u20033\u27F2\u20034\u27F2", indices: [[], [2], [3], [4]] },
        { name: "1\u27F2 2\u27F2 3\u27F2 4\u27F2", indices: [[1], [2], [3], [4]] },
        { name: "1\u21922", indices: [[], [1], [], []] },
        { name: "1\u21923", indices: [[], [], [1], []] },
        { name: "1\u21924", indices: [[], [], [], [1]] },
        { name: "2\u21923", indices: [[], [], [2], []] },
        { name: "2\u21924", indices: [[], [], [], [2]] },
        { name: "3\u21924", indices: [[], [], [], [3]] },
        { name: "1\u21923\u20032\u21924", indices: [[], [], [1], [2]] },
        { name: "1\u21924\u20032\u21923", indices: [[], [], [2], [1]] },
        { name: "1\u21922\u21923\u21924", indices: [[], [1], [2], [3]] },
        { name: "1\u21942 3\u21944", indices: [[2], [1], [4], [3]] },
        { name: "1\u21944 2\u21943", indices: [[4], [3], [2], [1]] },
        { name: "2\u21921\u21924\u21923\u21922", indices: [[2], [3], [4], [1]] },
        { name: "1\u21922\u21923\u21924\u21921", indices: [[4], [1], [2], [3]] },
        { name: "(1 2 3)\u21924", indices: [[], [], [], [1, 2, 3]] },
        { name: "ALL", indices: [[1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 3, 4]] }
      ]);
    }
    static {
      this.feedbacks6Op = toNameMap([
        //placeholder makes life easier for later
        { name: "Custom", indices: [[2, 3, 4, 5, 6], [], [], [], [], []] },
        { name: "1\u27F2", indices: [[1], [], [], [], [], []] },
        { name: "2\u27F2", indices: [[], [2], [], [], [], []] },
        { name: "3\u27F2", indices: [[], [], [3], [], [], []] },
        { name: "4\u27F2", indices: [[], [], [], [4], [], []] },
        { name: "5\u27F2", indices: [[], [], [], [], [5], []] },
        { name: "6\u27F2", indices: [[], [], [], [], [], [6]] },
        { name: "1\u27F2\u20022\u27F2", indices: [[1], [2], [], [], [], []] },
        { name: "3\u27F2\u20024\u27F2", indices: [[], [], [3], [4], [], []] },
        { name: "1\u27F2\u20022\u27F2\u20023\u27F2", indices: [[1], [2], [3], [], [], []] },
        { name: "2\u27F2\u20023\u27F2\u20024\u27F2", indices: [[], [2], [3], [4], [], []] },
        { name: "1\u27F2 2\u27F2 3\u27F2 4\u27F2", indices: [[1], [2], [3], [4], [], []] },
        { name: "1\u27F2 2\u27F2 3\u27F2 4\u27F2 5\u27F2", indices: [[1], [2], [3], [4], [5], []] },
        { name: "1\u27F2 2\u27F2 3\u27F2 4\u27F2 5\u27F2 6\u27F2", indices: [[1], [2], [3], [4], [5], [6]] },
        { name: "1\u21922", indices: [[], [1], [], [], [], []] },
        { name: "1\u21923", indices: [[], [], [1], [], [], []] },
        { name: "1\u21924", indices: [[], [], [], [1], [], []] },
        { name: "1\u21925", indices: [[], [], [], [], [1], []] },
        { name: "1\u21926", indices: [[], [], [], [], [], [1]] },
        { name: "2\u21923", indices: [[], [], [2], [], [], []] },
        { name: "2\u21924", indices: [[], [], [], [2], [], []] },
        { name: "3\u21924", indices: [[], [], [], [3], [], []] },
        { name: "4\u21925", indices: [[], [], [], [], [4], []] },
        { name: "1\u21924\u20022\u21925 3\u21926", indices: [[], [], [], [1], [2], [3]] },
        { name: "1\u21925\u20022\u21926 3\u21924", indices: [[], [], [], [3], [1], [2]] },
        { name: "1\u21922\u21923\u21924\u21925\u21926", indices: [[], [1], [2], [3], [4], [5]] },
        { name: "2\u21921\u21926\u21925\u21924\u21923\u21922", indices: [[2], [3], [4], [5], [6], [1]] },
        { name: "1\u21922\u21923\u21924\u21925\u21926\u21921", indices: [[6], [1], [2], [3], [4], [5]] },
        { name: "1\u21942 3\u21944 5\u21946", indices: [[2], [1], [4], [3], [6], [5]] },
        { name: "1\u21944 2\u21945 3\u21946", indices: [[4], [5], [6], [1], [2], [3]] },
        { name: "(1,2,3,4,5)\u21926", indices: [[], [], [], [], [], [1, 2, 3, 4, 5]] },
        { name: "ALL", indices: [[1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6]] }
      ]);
    }
    static {
      this.chipNoiseLength = 1 << 15;
    }
    static {
      // 32768
      this.spectrumNoiseLength = 1 << 15;
    }
    static {
      // 32768
      this.spectrumBasePitch = 24;
    }
    static {
      this.spectrumControlPoints = 30;
    }
    static {
      this.spectrumControlPointsPerOctave = 7;
    }
    static {
      this.spectrumControlPointBits = 3;
    }
    static {
      this.spectrumMax = (1 << _Config.spectrumControlPointBits) - 1;
    }
    static {
      this.harmonicsControlPoints = 28;
    }
    static {
      this.harmonicsRendered = 64;
    }
    static {
      this.harmonicsRenderedForPickedString = 1 << 8;
    }
    static {
      // 256
      this.harmonicsControlPointBits = 3;
    }
    static {
      this.harmonicsMax = (1 << _Config.harmonicsControlPointBits) - 1;
    }
    static {
      this.harmonicsWavelength = 1 << 11;
    }
    static {
      // 2048
      this.pulseWidthRange = 50;
    }
    static {
      this.pulseWidthStepPower = 0.5;
    }
    static {
      this.supersawVoiceCount = 7;
    }
    static {
      this.supersawDynamismMax = 6;
    }
    static {
      this.supersawSpreadMax = 12;
    }
    static {
      this.supersawShapeMax = 6;
    }
    static {
      this.pitchChannelCountMin = 1;
    }
    static {
      this.pitchChannelCountMax = 60;
    }
    static {
      this.noiseChannelCountMin = 0;
    }
    static {
      this.noiseChannelCountMax = 60;
    }
    static {
      this.modChannelCountMin = 0;
    }
    static {
      this.modChannelCountMax = 60;
    }
    static {
      this.noiseInterval = 6;
    }
    static {
      this.pitchesPerOctave = 12;
    }
    static {
      // TODO: Use this for converting pitch to frequency.
      this.drumCount = 12;
    }
    static {
      this.pitchOctaves = 8;
    }
    static {
      this.modCount = 6;
    }
    static {
      this.maxPitch = _Config.pitchOctaves * _Config.pitchesPerOctave;
    }
    static {
      this.maximumTonesPerChannel = _Config.maxChordSize * 2;
    }
    static {
      this.justIntonationSemitones = [1 / 2, 8 / 15, 9 / 16, 3 / 5, 5 / 8, 2 / 3, 32 / 45, 3 / 4, 4 / 5, 5 / 6, 8 / 9, 15 / 16, 1, 16 / 15, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 45 / 32, 3 / 2, 8 / 5, 5 / 3, 16 / 9, 15 / 8, 2].map((x) => Math.log2(x) * _Config.pitchesPerOctave);
    }
    static {
      this.pitchShiftRange = _Config.justIntonationSemitones.length;
    }
    static {
      this.pitchShiftCenter = _Config.pitchShiftRange >> 1;
    }
    static {
      this.detuneCenter = 200;
    }
    static {
      this.detuneMax = 400;
    }
    static {
      this.detuneMin = 0;
    }
    static {
      this.songDetuneMin = 0;
    }
    static {
      this.songDetuneMax = 500;
    }
    static {
      this.unisonVoicesMin = 1;
    }
    static {
      this.unisonVoicesMax = 9;
    }
    static {
      this.unisonSpreadMin = -96;
    }
    static {
      this.unisonSpreadMax = 96;
    }
    static {
      this.unisonOffsetMin = -96;
    }
    static {
      this.unisonOffsetMax = 96;
    }
    static {
      this.unisonExpressionMin = -2;
    }
    static {
      this.unisonExpressionMax = 2;
    }
    static {
      this.unisonSignMin = -2;
    }
    static {
      this.unisonSignMax = 2;
    }
    static {
      this.sineWaveLength = 1 << 8;
    }
    static {
      // 256
      this.sineWaveMask = _Config.sineWaveLength - 1;
    }
    static {
      this.noiseWaveLength = 1 << 16;
    }
    static {
      // 65536
      this.noiseWaveMask = _Config.noiseWaveLength - 1;
    }
    static generateSineWave() {
      const wave = new Float32Array(_Config.sineWaveLength + 1);
      for (let i = 0; i < _Config.sineWaveLength + 1; i++) {
        wave[i] = Math.sin(i * Math.PI * 2 / _Config.sineWaveLength);
      }
      return wave;
    }
    static generateTriWave() {
      const wave = new Float32Array(_Config.sineWaveLength + 1);
      for (let i = 0; i < _Config.sineWaveLength + 1; i++) {
        wave[i] = Math.asin(Math.sin(i * Math.PI * 2 / _Config.sineWaveLength)) / (Math.PI / 2);
      }
      return wave;
    }
    static generateTrapezoidWave(drive = 2) {
      const wave = new Float32Array(_Config.sineWaveLength + 1);
      for (let i = 0; i < _Config.sineWaveLength + 1; i++) {
        wave[i] = Math.max(-1, Math.min(1, Math.asin(Math.sin(i * Math.PI * 2 / _Config.sineWaveLength)) * drive));
      }
      return wave;
    }
    static generateSquareWave(phaseWidth = 0) {
      const wave = new Float32Array(_Config.sineWaveLength + 1);
      const centerPoint = _Config.sineWaveLength / 4;
      for (let i = 0; i < _Config.sineWaveLength + 1; i++) {
        wave[i] = +(Math.abs(i - centerPoint) < phaseWidth * _Config.sineWaveLength / 2 || Math.abs(i - _Config.sineWaveLength - centerPoint) < phaseWidth * _Config.sineWaveLength / 2) * 2 - 1;
      }
      return wave;
    }
    static generateSawWave(inverse = false) {
      const wave = new Float32Array(_Config.sineWaveLength + 1);
      for (let i = 0; i < _Config.sineWaveLength + 1; i++) {
        wave[i] = (i + _Config.sineWaveLength / 4) * 2 / _Config.sineWaveLength % 2 - 1;
        wave[i] = inverse ? -wave[i] : wave[i];
      }
      return wave;
    }
    static generateWhiteNoiseFmWave() {
      const wave = new Float32Array(_Config.noiseWaveLength + 1);
      for (let i = 0; i < _Config.noiseWaveLength + 1; i++) {
        wave[i] = Math.random() * 2 - 1;
      }
      return wave;
    }
    // public static generateOneBitWhiteNoiseFmWave() {
    //     const wave = new Float32Array(Config.noiseWaveLength + 1);
    //     for (let i = 0; i < Config.noiseWaveLength + 1; i++) {
    //         wave[i] = Math.round(Math.random());
    //     }
    //     return wave;
    // }
    static generateMetallicNoiseFMWave() {
      const wave = new Float32Array(_Config.noiseWaveLength + 1);
      var drumBuffer = 1;
      for (var i = 0; i < _Config.noiseWaveLength + 1; i++) {
        wave[i] = Math.round(drumBuffer & 1);
        var newBuffer = drumBuffer >> 1;
        if ((drumBuffer + newBuffer & 1) == 1) {
          newBuffer -= 10 << 2;
        }
        drumBuffer = newBuffer;
      }
      return wave;
    }
    static generateQuasiSineWave() {
      const wave = new Float32Array(_Config.sineWaveLength + 1);
      for (let i = 0; i < _Config.sineWaveLength + 1; i++) {
        wave[i] = Math.round(Math.sin(i * Math.PI * 2 / _Config.sineWaveLength));
      }
      return wave;
    }
    static {
      this.sineWave = _Config.generateSineWave();
    }
    static {
      this.perEnvelopeSpeedIndices = [0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1, 0.2, 0.25, 0.3, 0.3333, 0.4, 0.5, 0.6, 0.6667, 0.7, 0.75, 0.8, 0.9, 1, 1.25, 1.3333, 1.5, 1.6667, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 24, 32, 40, 64, 128, 256];
    }
    static {
      this.perEnvelopeSpeedToIndices = {
        //used to convert speeds back into indices
        0: 0,
        0.01: 1,
        0.02: 2,
        0.03: 3,
        0.04: 4,
        0.05: 5,
        0.06: 6,
        0.07: 7,
        0.08: 8,
        0.09: 9,
        0.1: 10,
        0.2: 11,
        0.25: 12,
        0.3: 13,
        0.3333: 14,
        0.4: 15,
        0.5: 16,
        0.6: 17,
        0.6667: 18,
        0.7: 19,
        0.75: 20,
        0.8: 21,
        0.9: 22,
        1: 23,
        1.25: 24,
        1.3333: 25,
        1.5: 26,
        1.6667: 27,
        1.75: 28,
        2: 29,
        2.25: 30,
        2.5: 31,
        2.75: 32,
        3: 33,
        3.5: 34,
        4: 35,
        4.5: 36,
        5: 37,
        5.5: 38,
        6: 39,
        6.5: 40,
        7: 41,
        7.5: 42,
        8: 43,
        8.5: 44,
        9: 45,
        9.5: 46,
        10: 47,
        11: 48,
        12: 49,
        13: 50,
        14: 51,
        15: 52,
        16: 53,
        17: 54,
        18: 55,
        19: 56,
        20: 57,
        24: 58,
        32: 59,
        40: 60,
        64: 61,
        128: 62,
        256: 63
      };
    }
    static {
      this.perEnvelopeBoundMin = 0;
    }
    static {
      //probably should leave at 0. Negative envelopes are problematic right now
      this.perEnvelopeBoundMax = 2;
    }
    static {
      //max of 6.3 unless you update url
      this.randomEnvelopeSeedMax = 63;
    }
    static {
      //if you increase this you'll need to update the url to support it
      this.randomEnvelopeStepsMax = 32;
    }
    static {
      // Picked strings have an all-pass filter with a corner frequency based on the tone fundamental frequency, in order to add a slight inharmonicity. (Which is important for distortion.)
      this.pickedStringDispersionCenterFreq = 6e3;
    }
    static {
      // The tone fundamental freq is pulled toward this freq for computing the all-pass corner freq.
      this.pickedStringDispersionFreqScale = 0.3;
    }
    static {
      // The tone fundamental freq freq moves this much toward the center freq for computing the all-pass corner freq.
      this.pickedStringDispersionFreqMult = 4;
    }
    static {
      // The all-pass corner freq is based on this times the adjusted tone fundamental freq.
      this.pickedStringShelfHz = 4e3;
    }
    static {
      // The cutoff freq of the shelf filter that is used to decay the high frequency energy in the picked string.
      this.distortionRange = 8;
    }
    static {
      this.stringSustainRange = 15;
    }
    static {
      this.stringDecayRate = 0.12;
    }
    static {
      this.enableAcousticSustain = false;
    }
    static {
      this.sustainTypeNames = ["bright", "acoustic"];
    }
    static {
      // See SustainType enum above.
      this.bitcrusherFreqRange = 14;
    }
    static {
      this.bitcrusherOctaveStep = 0.5;
    }
    static {
      this.bitcrusherQuantizationRange = 8;
    }
    static {
      this.maxEnvelopeCount = 16;
    }
    static {
      this.defaultAutomationRange = 13;
    }
    static {
      this.instrumentAutomationTargets = toNameMap([
        {
          name: "none",
          computeIndex: null,
          displayName: "none",
          perNote: false,
          interleave: false,
          isFilter: false,
          /*range: 0,                              */
          maxCount: 1,
          effect: null,
          compatibleInstruments: null
        },
        {
          name: "noteVolume",
          computeIndex: 0 /* noteVolume */,
          displayName: "note volume",
          perNote: true,
          interleave: false,
          isFilter: false,
          /*range: Config.volumeRange,             */
          maxCount: 1,
          effect: null,
          compatibleInstruments: null
        },
        {
          name: "pulseWidth",
          computeIndex: 2 /* pulseWidth */,
          displayName: "pulse width",
          perNote: true,
          interleave: false,
          isFilter: false,
          /*range: Config.pulseWidthRange,         */
          maxCount: 1,
          effect: null,
          compatibleInstruments: [6 /* pwm */, 8 /* supersaw */]
        },
        {
          name: "stringSustain",
          computeIndex: 3 /* stringSustain */,
          displayName: "sustain",
          perNote: true,
          interleave: false,
          isFilter: false,
          /*range: Config.stringSustainRange,      */
          maxCount: 1,
          effect: null,
          compatibleInstruments: [7 /* pickedString */]
        },
        {
          name: "unison",
          computeIndex: 4 /* unison */,
          displayName: "unison",
          perNote: true,
          interleave: false,
          isFilter: false,
          /*range: Config.defaultAutomationRange,  */
          maxCount: 1,
          effect: null,
          compatibleInstruments: [0 /* chip */, 5 /* harmonics */, 7 /* pickedString */, 9 /* customChipWave */, 6 /* pwm */, 2 /* noise */, 3 /* spectrum */, 4 /* drumset */, 1 /* fm */, 11 /* fm6op */]
        },
        {
          name: "operatorFrequency",
          computeIndex: 5 /* operatorFrequency0 */,
          displayName: "fm# freq",
          perNote: true,
          interleave: true,
          isFilter: false,
          /*range: Config.defaultAutomationRange,  */
          maxCount: _Config.operatorCount + 2,
          effect: null,
          compatibleInstruments: [1 /* fm */, 11 /* fm6op */]
        },
        {
          name: "operatorAmplitude",
          computeIndex: 11 /* operatorAmplitude0 */,
          displayName: "fm# volume",
          perNote: true,
          interleave: false,
          isFilter: false,
          /*range: Config.operatorAmplitudeMax + 1,*/
          maxCount: _Config.operatorCount + 2,
          effect: null,
          compatibleInstruments: [1 /* fm */, 11 /* fm6op */]
        },
        {
          name: "feedbackAmplitude",
          computeIndex: 17 /* feedbackAmplitude */,
          displayName: "fm feedback",
          perNote: true,
          interleave: false,
          isFilter: false,
          /*range: Config.operatorAmplitudeMax + 1,*/
          maxCount: 1,
          effect: null,
          compatibleInstruments: [1 /* fm */, 11 /* fm6op */]
        },
        {
          name: "pitchShift",
          computeIndex: 18 /* pitchShift */,
          displayName: "pitch shift",
          perNote: true,
          interleave: false,
          isFilter: false,
          /*range: Config.pitchShiftRange,         */
          maxCount: 1,
          effect: 7 /* pitchShift */,
          compatibleInstruments: null
        },
        {
          name: "detune",
          computeIndex: 19 /* detune */,
          displayName: "detune",
          perNote: true,
          interleave: false,
          isFilter: false,
          /*range: Config.detuneMax + 1,           */
          maxCount: 1,
          effect: 8 /* detune */,
          compatibleInstruments: null
        },
        {
          name: "vibratoDepth",
          computeIndex: 20 /* vibratoDepth */,
          displayName: "vibrato depth",
          perNote: true,
          interleave: false,
          isFilter: false,
          /*range: Config.defaultAutomationRange,  */
          maxCount: 1,
          effect: 9 /* vibrato */,
          compatibleInstruments: null
        },
        //{ name: "vibratoSpeed", computeIndex: EnvelopeComputeIndex.vibratoSpeed, displayName: "vibrato speed", /*perNote:  true,*/ interleave: false, isFilter: false, /*range: Config.defaultAutomationRange,  */    maxCount: 1, effect: EffectType.vibrato, compatibleInstruments: null },
        {
          name: "noteFilterAllFreqs",
          computeIndex: 1 /* noteFilterAllFreqs */,
          displayName: "n. filter freqs",
          perNote: true,
          interleave: false,
          isFilter: true,
          /*range: null,                           */
          maxCount: 1,
          effect: 5 /* noteFilter */,
          compatibleInstruments: null
        },
        {
          name: "noteFilterFreq",
          computeIndex: 21 /* noteFilterFreq0 */,
          displayName: "n. filter # freq",
          perNote: true,
          interleave: false,
          isFilter: true,
          /*range: Config.filterFreqRange,     */
          maxCount: _Config.filterMaxPoints,
          effect: 5 /* noteFilter */,
          compatibleInstruments: null
        },
        {
          name: "decimalOffset",
          computeIndex: 37 /* decimalOffset */,
          displayName: "decimal offset",
          perNote: true,
          interleave: false,
          isFilter: false,
          /*range: Config.pulseWidthRange,         */
          maxCount: 1,
          effect: null,
          compatibleInstruments: [6 /* pwm */, 8 /* supersaw */]
        },
        {
          name: "supersawDynamism",
          computeIndex: 38 /* supersawDynamism */,
          displayName: "dynamism",
          perNote: true,
          interleave: false,
          isFilter: false,
          /*range: Config.supersawDynamismMax + 1, */
          maxCount: 1,
          effect: null,
          compatibleInstruments: [8 /* supersaw */]
        },
        {
          name: "supersawSpread",
          computeIndex: 39 /* supersawSpread */,
          displayName: "spread",
          perNote: true,
          interleave: false,
          isFilter: false,
          /*range: Config.supersawSpreadMax + 1,   */
          maxCount: 1,
          effect: null,
          compatibleInstruments: [8 /* supersaw */]
        },
        {
          name: "supersawShape",
          computeIndex: 40 /* supersawShape */,
          displayName: "saw\u2194pulse",
          perNote: true,
          interleave: false,
          isFilter: false,
          /*range: Config.supersawShapeMax + 1,    */
          maxCount: 1,
          effect: null,
          compatibleInstruments: [8 /* supersaw */]
        },
        {
          name: "panning",
          computeIndex: 41 /* panning */,
          displayName: "panning",
          perNote: false,
          interleave: false,
          isFilter: false,
          /*range: Config.chorusRange,    */
          maxCount: 1,
          effect: 2 /* panning */,
          compatibleInstruments: null
        },
        {
          name: "distortion",
          computeIndex: 42 /* distortion */,
          displayName: "distortion",
          perNote: false,
          interleave: false,
          isFilter: false,
          /*range: Config.defaultAutomationRange,  */
          maxCount: 1,
          effect: 3 /* distortion */,
          compatibleInstruments: null
        },
        {
          name: "bitcrusherQuantization",
          computeIndex: 43 /* bitcrusherQuantization */,
          displayName: "bitcrush",
          perNote: false,
          interleave: false,
          isFilter: false,
          /*range: Config.defaultAutomationRange,  */
          maxCount: 1,
          effect: 4 /* bitcrusher */,
          compatibleInstruments: null
        },
        {
          name: "bitcrusherFrequency",
          computeIndex: 44 /* bitcrusherFrequency */,
          displayName: "freq crush",
          perNote: false,
          interleave: false,
          isFilter: false,
          /*range: Config.defaultAutomationRange,  */
          maxCount: 1,
          effect: 4 /* bitcrusher */,
          compatibleInstruments: null
        },
        {
          name: "chorus",
          computeIndex: 45 /* chorus */,
          displayName: "chorus",
          perNote: false,
          interleave: false,
          isFilter: false,
          /*range: Config.chorusRange,    */
          maxCount: 1,
          effect: 1 /* chorus */,
          compatibleInstruments: null
        },
        {
          name: "echoSustain",
          computeIndex: 46 /* echoSustain */,
          displayName: "echo",
          perNote: false,
          interleave: false,
          isFilter: false,
          /*range: Config.chorusRange,    */
          maxCount: 1,
          effect: 6 /* echo */,
          compatibleInstruments: null
        },
        {
          name: "reverb",
          computeIndex: 47 /* reverb */,
          displayName: "reverb",
          perNote: false,
          interleave: false,
          isFilter: false,
          /*range: Config.chorusRange,    */
          maxCount: 1,
          effect: 0 /* reverb */,
          compatibleInstruments: null
        },
        {
          name: "arpeggioSpeed",
          computeIndex: 48 /* arpeggioSpeed */,
          displayName: "arpeggio speed",
          perNote: false,
          interleave: false,
          isFilter: false,
          /*range: Config.chorusRange,    */
          maxCount: 1,
          effect: 11 /* chord */,
          compatibleInstruments: null
        },
        { name: "ringModulation", computeIndex: 49 /* ringModulation */, displayName: "ring mod", perNote: false, interleave: false, isFilter: false, maxCount: 1, effect: 13 /* ringModulation */, compatibleInstruments: null },
        { name: "ringModulationHz", computeIndex: 50 /* ringModulationHz */, displayName: "ring mod hz", perNote: false, interleave: false, isFilter: false, maxCount: 1, effect: 13 /* ringModulation */, compatibleInstruments: null },
        { name: "granular", computeIndex: 51 /* granular */, displayName: "granular", perNote: false, interleave: false, isFilter: false, maxCount: 1, effect: 14 /* granular */, compatibleInstruments: null },
        { name: "grainFreq", computeIndex: 52 /* grainAmount */, displayName: "grain freq", perNote: false, interleave: false, isFilter: false, maxCount: 1, effect: 14 /* granular */, compatibleInstruments: null },
        { name: "grainSize", computeIndex: 53 /* grainSize */, displayName: "grain size", perNote: false, interleave: false, isFilter: false, maxCount: 1, effect: 14 /* granular */, compatibleInstruments: null },
        { name: "grainRange", computeIndex: 54 /* grainRange */, displayName: "grain range", perNote: false, interleave: false, isFilter: false, maxCount: 1, effect: 14 /* granular */, compatibleInstruments: null },
        { name: "echoDelay", computeIndex: 55 /* echoDelay */, displayName: "echo delay", perNote: false, interleave: false, isFilter: false, maxCount: 1, effect: 6 /* echo */, compatibleInstruments: null }
        // Controlling filter gain is less obvious and intuitive than controlling filter freq, so to avoid confusion I've disabled it for now...
        //{name: "noteFilterGain",         computeIndex:       EnvelopeComputeIndex.noteFilterGain0,        displayName: "n. filter # vol",  /*perNote:  true,*/ interleave: false, isFilter:  true, range: Config.filterGainRange,             maxCount: Config.filterMaxPoints, effect: EffectType.noteFilter, compatibleInstruments: null},
        /*
        {name: "eqFilterAllFreqs",       computeIndex: InstrumentAutomationIndex.eqFilterAllFreqs,       displayName: "eq filter freqs",  perNote: false, interleave: false, isFilter:  true, range: null,                               maxCount: 1,    effect: null,                    compatibleInstruments: null},
        {name: "eqFilterFreq",           computeIndex: InstrumentAutomationIndex.eqFilterFreq0,          displayName: "eq filter # freq", perNote: false, interleave:  true, isFilter:  true, range: Config.filterFreqRange,             maxCount: Config.filterMaxPoints, effect: null,  compatibleInstruments: null},
        {name: "eqFilterGain",           computeIndex: InstrumentAutomationIndex.eqFilterGain0,          displayName: "eq filter # vol",  perNote: false, interleave: false, isFilter:  true, range: Config.filterGainRange,             maxCount: Config.filterMaxPoints, effect: null,  compatibleInstruments: null},
        {name: "mixVolume",              computeIndex: InstrumentAutomationIndex.mixVolume,              displayName: "mix volume",       perNote: false, interleave: false, isFilter: false, range: Config.volumeRange,                 maxCount: 1,    effect: null,                    compatibleInstruments: null},
        {name: "envelope#",              computeIndex: null,                                             displayName: "envelope",         perNote: false, interleave: false, isFilter: false, range: Config.defaultAutomationRange,      maxCount: Config.maxEnvelopeCount, effect: null, compatibleInstruments: null}, // maxCount special case for envelopes to be allowed to target earlier ones.
        */
      ]);
    }
    static {
      this.operatorWaves = toNameMap([
        { name: "sine", samples: _Config.sineWave },
        { name: "triangle", samples: _Config.generateTriWave() },
        { name: "pulse width", samples: _Config.generateSquareWave(0.5) },
        { name: "sawtooth", samples: _Config.generateSawWave() },
        { name: "ramp", samples: _Config.generateSawWave(true) },
        { name: "trapezoid", samples: _Config.generateTrapezoidWave(2) },
        { name: "quasi-sine", samples: _Config.generateQuasiSineWave() },
        { name: "white noise", samples: _Config.generateWhiteNoiseFmWave() },
        // { name: "1-bit white noise", samples: Config.generateOneBitWhiteNoiseFmWave() },
        { name: "metallic noise", samples: _Config.generateMetallicNoiseFMWave() }
      ]);
    }
    static {
      this.pwmOperatorWaves = toNameMap([
        { name: "1%", samples: _Config.generateSquareWave(0.01) },
        { name: "5%", samples: _Config.generateSquareWave(0.05) },
        { name: "12.5%", samples: _Config.generateSquareWave(0.125) },
        { name: "25%", samples: _Config.generateSquareWave(0.25) },
        { name: "33%", samples: _Config.generateSquareWave(1 / 3) },
        { name: "50%", samples: _Config.generateSquareWave(0.5) },
        { name: "66%", samples: _Config.generateSquareWave(2 / 3) },
        { name: "75%", samples: _Config.generateSquareWave(0.75) },
        { name: "87.5%", samples: _Config.generateSquareWave(0.875) },
        { name: "95%", samples: _Config.generateSquareWave(0.95) },
        { name: "99%", samples: _Config.generateSquareWave(0.99) }
      ]);
    }
    static {
      // Height of the small editor column for inserting/deleting rows, in pixels.
      this.barEditorHeight = 10;
    }
    static {
      // Careful about changing index ordering for this. Index is stored in URL/JSON etc.
      this.modulators = toNameMap([
        {
          name: "none",
          pianoName: "None",
          maxRawVol: 6,
          newNoteVol: 6,
          forSong: true,
          convertRealFactor: 0,
          associatedEffect: 16 /* length */,
          maxIndex: 0,
          promptName: "No Mod Setting",
          promptDesc: ["No setting has been chosen yet, so this modulator will have no effect. Try choosing a setting with the dropdown, then click this '?' again for more info.", "[$LO - $HI]"]
        },
        {
          name: "song volume",
          pianoName: "Volume",
          maxRawVol: 100,
          newNoteVol: 100,
          forSong: true,
          convertRealFactor: 0,
          associatedEffect: 16 /* length */,
          maxIndex: 0,
          promptName: "Song Volume",
          promptDesc: ["This setting affects the overall volume of the song, just like the main volume slider.", "At $HI, the volume will be unchanged from default, and it will get gradually quieter down to $LO.", "[MULTIPLICATIVE] [$LO - $HI] [%]"]
        },
        {
          name: "tempo",
          pianoName: "Tempo",
          maxRawVol: _Config.tempoMax - _Config.tempoMin,
          newNoteVol: Math.ceil((_Config.tempoMax - _Config.tempoMin) / 2),
          forSong: true,
          convertRealFactor: _Config.tempoMin,
          associatedEffect: 16 /* length */,
          maxIndex: 0,
          promptName: "Song Tempo",
          promptDesc: ["This setting controls the speed your song plays at, just like the tempo slider.", "When you first make a note for this setting, it will default to your current tempo. Raising it speeds up the song, up to $HI BPM, and lowering it slows it down, to a minimum of $LO BPM.", "Note that you can make a 'swing' effect by rapidly changing between two tempo values.", "[OVERWRITING] [$LO - $HI] [BPM]"]
        },
        {
          name: "song reverb",
          pianoName: "Reverb",
          maxRawVol: _Config.reverbRange * 2,
          newNoteVol: _Config.reverbRange,
          forSong: true,
          convertRealFactor: -_Config.reverbRange,
          associatedEffect: 16 /* length */,
          maxIndex: 0,
          promptName: "Song Reverb",
          promptDesc: ["This setting affects the overall reverb of your song. It works by multiplying existing reverb for instruments, so those with no reverb set will be unaffected.", "At $MID, all instruments' reverb will be unchanged from default. This increases up to double the reverb value at $HI, or down to no reverb at $LO.", "[MULTIPLICATIVE] [$LO - $HI]"]
        },
        {
          name: "next bar",
          pianoName: "Next Bar",
          maxRawVol: 1,
          newNoteVol: 1,
          forSong: true,
          convertRealFactor: 0,
          associatedEffect: 16 /* length */,
          maxIndex: 0,
          promptName: "Go To Next Bar",
          promptDesc: ["This setting functions a little different from most. Wherever a note is placed, the song will jump immediately to the next bar when it is encountered.", "This jump happens at the very start of the note, so the length of a next-bar note is irrelevant. Also, the note can be value 0 or 1, but the value is also irrelevant - wherever you place a note, the song will jump.", "You can make mixed-meter songs or intro sections by cutting off unneeded beats with a next-bar modulator.", "[$LO - $HI]"]
        },
        {
          name: "note volume",
          pianoName: "Note Vol.",
          maxRawVol: _Config.volumeRange,
          newNoteVol: Math.ceil(_Config.volumeRange / 2),
          forSong: false,
          convertRealFactor: Math.ceil(-_Config.volumeRange / 2),
          associatedEffect: 16 /* length */,
          maxIndex: 0,
          promptName: "Note Volume",
          promptDesc: ["This setting affects the volume of your instrument as if its note size had been scaled.", "At $MID, an instrument's volume will be unchanged from default. This means you can still use the volume sliders to mix the base volume of instruments. The volume gradually increases up to $HI, or decreases down to mute at $LO.", "This setting was the default for volume modulation in JummBox for a long time. Due to some new effects like distortion and bitcrush, note volume doesn't always allow fine volume control. Also, this modulator affects the value of FM modulator waves instead of just carriers. This can distort the sound which may be useful, but also may be undesirable. In those cases, use the 'mix volume' modulator instead, which will always just scale the volume with no added effects.", "For display purposes, this mod will show up on the instrument volume slider, as long as there is not also an active 'mix volume' modulator anyhow. However, as mentioned, it works more like changing note volume.", "[MULTIPLICATIVE] [$LO - $HI]"]
        },
        {
          name: "pan",
          pianoName: "Pan",
          maxRawVol: _Config.panMax,
          newNoteVol: Math.ceil(_Config.panMax / 2),
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 2 /* panning */,
          maxIndex: 0,
          promptName: "Instrument Panning",
          promptDesc: ["This setting controls the panning of your instrument, just like the panning slider.", "At $LO, your instrument will sound like it is coming fully from the left-ear side. At $MID it will be right in the middle, and at $HI, it will sound like it's on the right.", "[OVERWRITING] [$LO - $HI] [L-R]"]
        },
        {
          name: "reverb",
          pianoName: "Reverb",
          maxRawVol: _Config.reverbRange,
          newNoteVol: 0,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 0 /* reverb */,
          maxIndex: 0,
          promptName: "Instrument Reverb",
          promptDesc: ["This setting controls the reverb of your insturment, just like the reverb slider.", "At $LO, your instrument will have no reverb. At $HI, it will be at maximum.", "[OVERWRITING] [$LO - $HI]"]
        },
        {
          name: "distortion",
          pianoName: "Distortion",
          maxRawVol: _Config.distortionRange - 1,
          newNoteVol: 0,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 3 /* distortion */,
          maxIndex: 0,
          promptName: "Instrument Distortion",
          promptDesc: ["This setting controls the amount of distortion for your instrument, just like the distortion slider.", "At $LO, your instrument will have no distortion. At $HI, it will be at maximum.", "[OVERWRITING] [$LO - $HI]"]
        },
        {
          name: "fm slider 1",
          pianoName: "FM 1",
          maxRawVol: 15,
          newNoteVol: 15,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 16 /* length */,
          maxIndex: 0,
          promptName: "FM Slider 1",
          promptDesc: ["This setting affects the strength of the first FM slider, just like the corresponding slider on your instrument.", "It works in a multiplicative way, so at $HI your slider will sound the same is its default value, and at $LO it will sound like it has been moved all the way to the left.", "For the full range of control with this mod, move your underlying slider all the way to the right.", "[MULTIPLICATIVE] [$LO - $HI] [%]"]
        },
        {
          name: "fm slider 2",
          pianoName: "FM 2",
          maxRawVol: 15,
          newNoteVol: 15,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 16 /* length */,
          maxIndex: 0,
          promptName: "FM Slider 2",
          promptDesc: ["This setting affects the strength of the second FM slider, just like the corresponding slider on your instrument.", "It works in a multiplicative way, so at $HI your slider will sound the same is its default value, and at $LO it will sound like it has been moved all the way to the left.", "For the full range of control with this mod, move your underlying slider all the way to the right.", "[MULTIPLICATIVE] [$LO - $HI] [%]"]
        },
        {
          name: "fm slider 3",
          pianoName: "FM 3",
          maxRawVol: 15,
          newNoteVol: 15,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 16 /* length */,
          maxIndex: 0,
          promptName: "FM Slider 3",
          promptDesc: ["This setting affects the strength of the third FM slider, just like the corresponding slider on your instrument.", "It works in a multiplicative way, so at $HI your slider will sound the same is its default value, and at $LO it will sound like it has been moved all the way to the left.", "For the full range of control with this mod, move your underlying slider all the way to the right.", "[MULTIPLICATIVE] [$LO - $HI] [%]"]
        },
        {
          name: "fm slider 4",
          pianoName: "FM 4",
          maxRawVol: 15,
          newNoteVol: 15,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 16 /* length */,
          maxIndex: 0,
          promptName: "FM Slider 4",
          promptDesc: ["This setting affects the strength of the fourth FM slider, just like the corresponding slider on your instrument.", "It works in a multiplicative way, so at $HI your slider will sound the same is its default value, and at $LO it will sound like it has been moved all the way to the left.", "For the full range of control with this mod, move your underlying slider all the way to the right.", "[MULTIPLICATIVE] [$LO - $HI] [%]"]
        },
        {
          name: "fm feedback",
          pianoName: "FM Feedbck",
          maxRawVol: 15,
          newNoteVol: 15,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 16 /* length */,
          maxIndex: 0,
          promptName: "FM Feedback",
          promptDesc: ["This setting affects the strength of the FM feedback slider, just like the corresponding slider on your instrument.", "It works in a multiplicative way, so at $HI your slider will sound the same is its default value, and at $LO it will sound like it has been moved all the way to the left.", "For the full range of control with this mod, move your underlying slider all the way to the right.", "[MULTIPLICATIVE] [$LO - $HI] [%]"]
        },
        {
          name: "pulse width",
          pianoName: "Pulse Width",
          maxRawVol: _Config.pulseWidthRange,
          newNoteVol: _Config.pulseWidthRange,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 16 /* length */,
          maxIndex: 0,
          promptName: "Pulse Width",
          promptDesc: ["This setting controls the width of this instrument's pulse wave, just like the pulse width slider.", "At $HI, your instrument will sound like a pure square wave (on 50% of the time). It will gradually sound narrower down to $LO, where it will be inaudible (as it is on 0% of the time).", "Changing pulse width randomly between a few values is a common strategy in chiptune music to lend some personality to a lead instrument.", "[OVERWRITING] [$LO - $HI] [%Duty]"]
        },
        {
          name: "detune",
          pianoName: "Detune",
          maxRawVol: _Config.detuneMax - _Config.detuneMin,
          newNoteVol: _Config.detuneCenter,
          forSong: false,
          convertRealFactor: -_Config.detuneCenter,
          associatedEffect: 8 /* detune */,
          maxIndex: 0,
          promptName: "Instrument Detune",
          promptDesc: ["This setting controls the detune for this instrument, just like the detune slider.", "At $MID, your instrument will have no detune applied. Each tick corresponds to one cent, or one-hundredth of a pitch. Thus, each change of 100 ticks corresponds to one half-step of detune, up to two half-steps up at $HI, or two half-steps down at $LO.", "[OVERWRITING] [$LO - $HI] [cents]"]
        },
        {
          name: "vibrato depth",
          pianoName: "Vibrato Depth",
          maxRawVol: 50,
          newNoteVol: 0,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 9 /* vibrato */,
          maxIndex: 0,
          promptName: "Vibrato Depth",
          promptDesc: ["This setting controls the amount that your pitch moves up and down by during vibrato, just like the vibrato depth slider.", "At $LO, your instrument will have no vibrato depth so its vibrato would be inaudible. This increases up to $HI, where an extreme pitch change will be noticeable.", "[OVERWRITING] [$LO - $HI] [pitch \xF725]"]
        },
        {
          name: "song detune",
          pianoName: "Detune",
          maxRawVol: _Config.songDetuneMax - _Config.songDetuneMin,
          newNoteVol: Math.ceil((_Config.songDetuneMax - _Config.songDetuneMin) / 2),
          forSong: true,
          convertRealFactor: -250,
          associatedEffect: 16 /* length */,
          maxIndex: 0,
          promptName: "Song Detune",
          promptDesc: ["This setting controls the overall detune of the entire song. There is no associated slider.", "At $MID, your song will have no extra detune applied and sound unchanged from default. Each tick corresponds to four cents, or four hundredths of a pitch. Thus, each change of 25 ticks corresponds to one half-step of detune, up to 10 half-steps up at $HI, or 10 half-steps down at $LO.", "[MULTIPLICATIVE] [$LO - $HI] [cents x4]"]
        },
        {
          name: "vibrato speed",
          pianoName: "Vibrato Speed",
          maxRawVol: 30,
          newNoteVol: 0,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 9 /* vibrato */,
          maxIndex: 0,
          promptName: "Vibrato Speed",
          promptDesc: ["This setting controls the speed your instrument will vibrato at, just like the slider.", "A setting of $LO means there will be no oscillation, and vibrato will be disabled. Higher settings will increase the speed, up to a dramatic trill at the max value, $HI.", "[OVERWRITING] [$LO - $HI]"]
        },
        {
          name: "vibrato delay",
          pianoName: "Vibrato Delay",
          maxRawVol: 50,
          newNoteVol: 0,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 9 /* vibrato */,
          maxIndex: 0,
          promptName: "Vibrato Delay",
          promptDesc: ["This setting controls the amount of time vibrato will be held off for before triggering for every new note, just like the slider.", "A setting of $LO means there will be no delay. A setting of 24 corresponds to one full beat of delay. As a sole exception to this scale, setting delay to $HI will completely disable vibrato (as if it had infinite delay).", "[OVERWRITING] [$LO - $HI] [beats \xF724]"]
        },
        {
          name: "arp speed",
          pianoName: "Arp Speed",
          maxRawVol: 50,
          newNoteVol: 12,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 11 /* chord */,
          maxIndex: 0,
          promptName: "Arpeggio Speed",
          promptDesc: [
            "This setting controls the speed at which your instrument's chords arpeggiate, just like the arpeggio speed slider.",
            "Each setting corresponds to a different speed, from the slowest to the fastest. The speeds are listed below.",
            "[0-4]: x0, x1/16, x\u215B, x\u2155, x\xBC,",
            "[5-9]: x\u2153, x\u2156, x\xBD, x\u2154, x\xBE,",
            "[10-14]: x\u2158, x0.9, x1, x1.1, x1.2,",
            "[15-19]: x1.3, x1.4, x1.5, x1.6, x1.7,",
            "[20-24]: x1.8, x1.9, x2, x2.1, x2.2,",
            "[25-29]: x2.3, x2.4, x2.5, x2.6, x2.7,",
            "[30-34]: x2.8, x2.9, x3, x3.1, x3.2,",
            "[35-39]: x3.3, x3.4, x3.5, x3.6, x3.7,",
            "[40-44]: x3.8, x3.9, x4, x4.15, x4.3,",
            "[45-50]: x4.5, x4.8, x5, x5.5, x6, x8",
            "[OVERWRITING] [$LO - $HI]"
          ]
        },
        {
          name: "pan delay",
          pianoName: "Pan Delay",
          maxRawVol: 20,
          newNoteVol: 10,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 2 /* panning */,
          maxIndex: 0,
          promptName: "Panning Delay",
          promptDesc: ["This setting controls the delay applied to panning for your instrument, just like the pan delay slider.", "With more delay, the panning effect will generally be more pronounced. $MID is the default value, whereas $LO will remove any delay at all. No delay can be desirable for chiptune songs.", "[OVERWRITING] [$LO - $HI]"]
        },
        {
          name: "reset arp",
          pianoName: "Reset Arp",
          maxRawVol: 1,
          newNoteVol: 1,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 11 /* chord */,
          maxIndex: 0,
          promptName: "Reset Arpeggio",
          promptDesc: ["This setting functions a little different from most. Wherever a note is placed, the arpeggio of this instrument will reset at the very start of that note. This is most noticeable with lower arpeggio speeds. The lengths and values of notes for this setting don't matter, just the note start times.", "This mod can be used to sync up your apreggios so that they always sound the same, even if you are using an odd-ratio arpeggio speed or modulating arpeggio speed.", "[$LO - $HI]"]
        },
        {
          name: "eq filter",
          pianoName: "EQFlt",
          maxRawVol: 10,
          newNoteVol: 0,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 16 /* length */,
          maxIndex: 0,
          promptName: "EQ Filter",
          promptDesc: ["This setting controls a few separate things for your instrument's EQ filter.", "When the option 'morph' is selected, your modulator values will indicate a sub-filter index of your EQ filter to 'morph' to over time. For example, a change from 0 to 1 means your main filter (default) will morph to sub-filter 1 over the specified duration. You can shape the main filter and sub-filters in the large filter editor ('+' button). If your two filters' number, type, and order of filter dots all match up, the morph will happen smoothly and you'll be able to hear them changing. If they do not match up, the filters will simply jump between each other.", "Note that filters will morph based on endpoints in the pattern editor. So, if you specify a morph from sub-filter 1 to 4 but do not specifically drag in new endpoints for 2 and 3, it will morph directly between 1 and 4 without going through the others.", "If you target Dot X or Dot Y, you can finely tune the coordinates of a single dot for your filter. The number of available dots to choose is dependent on your main filter's dot count.", "[OVERWRITING] [$LO - $HI]"]
        },
        {
          name: "note filter",
          pianoName: "N.Flt",
          maxRawVol: 10,
          newNoteVol: 0,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 5 /* noteFilter */,
          maxIndex: 0,
          promptName: "Note Filter",
          promptDesc: ["This setting controls a few separate things for your instrument's note filter.", "When the option 'morph' is selected, your modulator values will indicate a sub-filter index of your note filter to 'morph' to over time. For example, a change from 0 to 1 means your main filter (default) will morph to sub-filter 1 over the specified duration. You can shape the main filter and sub-filters in the large filter editor ('+' button). If your two filters' number, type, and order of filter dots all match up, the morph will happen smoothly and you'll be able to hear them changing. If they do not match up, the filters will simply jump between each other.", "Note that filters will morph based on endpoints in the pattern editor. So, if you specify a morph from sub-filter 1 to 4 but do not specifically drag in new endpoints for 2 and 3, it will morph directly between 1 and 4 without going through the others.", "If you target Dot X or Dot Y, you can finely tune the coordinates of a single dot for your filter. The number of available dots to choose is dependent on your main filter's dot count.", "[OVERWRITING] [$LO - $HI]"]
        },
        {
          name: "bit crush",
          pianoName: "Bitcrush",
          maxRawVol: _Config.bitcrusherQuantizationRange - 1,
          newNoteVol: Math.round(_Config.bitcrusherQuantizationRange / 2),
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 4 /* bitcrusher */,
          maxIndex: 0,
          promptName: "Instrument Bit Crush",
          promptDesc: ["This setting controls the bit crush of your instrument, just like the bit crush slider.", "At a value of $LO, no bit crush will be applied. This increases and the bit crush effect gets more noticeable up to the max value, $HI.", "[OVERWRITING] [$LO - $HI]"]
        },
        {
          name: "freq crush",
          pianoName: "Freq Crush",
          maxRawVol: _Config.bitcrusherFreqRange - 1,
          newNoteVol: Math.round(_Config.bitcrusherFreqRange / 2),
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 4 /* bitcrusher */,
          maxIndex: 0,
          promptName: "Instrument Frequency Crush",
          promptDesc: ["This setting controls the frequency crush of your instrument, just like the freq crush slider.", "At a value of $LO, no frequency crush will be applied. This increases and the frequency crush effect gets more noticeable up to the max value, $HI.", "[OVERWRITING] [$LO - $HI]"]
        },
        {
          name: "echo",
          pianoName: "Echo",
          maxRawVol: _Config.echoSustainRange - 1,
          newNoteVol: 0,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 6 /* echo */,
          maxIndex: 0,
          promptName: "Instrument Echo Sustain",
          promptDesc: ["This setting controls the echo sustain (echo loudness) of your instrument, just like the echo slider.", "At $LO, your instrument will have no echo sustain and echo will not be audible. Echo sustain increases and the echo effect gets more noticeable up to the max value, $HI.", "[OVERWRITING] [$LO - $HI]"]
        },
        {
          name: "echo delay",
          pianoName: "Echo Delay",
          maxRawVol: _Config.echoDelayRange,
          newNoteVol: 0,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 6 /* echo */,
          maxIndex: 0,
          promptName: "Instrument Echo Delay",
          promptDesc: ["This setting controls the echo delay of your instrument, just like the echo delay slider.", "At $LO, your instrument will have very little echo delay, and this increases up to 2 beats of delay at $HI.", "[OVERWRITING] [$LO - $HI] [~beats \xF712]"]
        },
        {
          name: "chorus",
          pianoName: "Chorus",
          maxRawVol: _Config.chorusRange - 1,
          newNoteVol: 0,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 1 /* chorus */,
          maxIndex: 0,
          promptName: "Instrument Chorus",
          promptDesc: ["This setting controls the chorus strength of your instrument, just like the chorus slider.", "At $LO, the chorus effect will be disabled. The strength of the chorus effect increases up to the max value, $HI.", "[OVERWRITING] [$LO - $HI]"]
        },
        {
          name: "eq filt cut",
          pianoName: "EQFlt Cut",
          maxRawVol: _Config.filterSimpleCutRange - 1,
          newNoteVol: _Config.filterSimpleCutRange - 1,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 16 /* length */,
          maxIndex: 0,
          promptName: "EQ Filter Cutoff Frequency",
          promptDesc: ["This setting controls the filter cut position of your instrument, just like the filter cut slider.", "This setting is roughly analagous to the horizontal position of a single low-pass dot on the advanced filter editor. At lower values, a wider range of frequencies is cut off.", "[OVERWRITING] [$LO - $HI]"]
        },
        {
          name: "eq filt peak",
          pianoName: "EQFlt Peak",
          maxRawVol: _Config.filterSimplePeakRange - 1,
          newNoteVol: 0,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 16 /* length */,
          maxIndex: 0,
          promptName: "EQ Filter Peak Gain",
          promptDesc: ["This setting controls the filter peak position of your instrument, just like the filter peak slider.", "This setting is roughly analagous to the vertical position of a single low-pass dot on the advanced filter editor. At lower values, the cutoff frequency will not be emphasized, and at higher values you will hear emphasis on the cutoff frequency.", "[OVERWRITING] [$LO - $HI]"]
        },
        {
          name: "note filt cut",
          pianoName: "N.Flt Cut",
          maxRawVol: _Config.filterSimpleCutRange - 1,
          newNoteVol: _Config.filterSimpleCutRange - 1,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 5 /* noteFilter */,
          maxIndex: 0,
          promptName: "Note Filter Cutoff Frequency",
          promptDesc: ["This setting controls the filter cut position of your instrument, just like the filter cut slider.", "This setting is roughly analagous to the horizontal position of a single low-pass dot on the advanced filter editor. At lower values, a wider range of frequencies is cut off.", "[OVERWRITING] [$LO - $HI]"]
        },
        {
          name: "note filt peak",
          pianoName: "N.Flt Peak",
          maxRawVol: _Config.filterSimplePeakRange - 1,
          newNoteVol: 0,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 5 /* noteFilter */,
          maxIndex: 0,
          promptName: "Note Filter Peak Gain",
          promptDesc: ["This setting controls the filter peak position of your instrument, just like the filter peak slider.", "This setting is roughly analagous to the vertical position of a single low-pass dot on the advanced filter editor. At lower values, the cutoff frequency will not be emphasized, and at higher values you will hear emphasis on the cutoff frequency.", "[OVERWRITING] [$LO - $HI]"]
        },
        {
          name: "pitch shift",
          pianoName: "Pitch Shift",
          maxRawVol: _Config.pitchShiftRange - 1,
          newNoteVol: _Config.pitchShiftCenter,
          forSong: false,
          convertRealFactor: -_Config.pitchShiftCenter,
          associatedEffect: 7 /* pitchShift */,
          maxIndex: 0,
          promptName: "Pitch Shift",
          promptDesc: ["This setting controls the pitch offset of your instrument, just like the pitch shift slider.", "At $MID your instrument will have no pitch shift. This increases as you decrease toward $LO pitches (half-steps) at the low end, or increases towards +$HI pitches at the high end.", "[OVERWRITING] [$LO - $HI] [pitch]"]
        },
        {
          name: "sustain",
          pianoName: "Sustain",
          maxRawVol: _Config.stringSustainRange - 1,
          newNoteVol: 0,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 16 /* length */,
          maxIndex: 0,
          promptName: "Picked String Sustain",
          promptDesc: ["This setting controls the sustain of your picked string instrument, just like the sustain slider.", "At $LO, your instrument will have minimum sustain and sound 'plucky'. This increases to a more held sound as your modulator approaches the maximum, $HI.", "[OVERWRITING] [$LO - $HI]"]
        },
        {
          name: "mix volume",
          pianoName: "Mix Vol.",
          maxRawVol: _Config.volumeRange,
          newNoteVol: Math.ceil(_Config.volumeRange / 2),
          forSong: false,
          convertRealFactor: Math.ceil(-_Config.volumeRange / 2),
          associatedEffect: 16 /* length */,
          maxIndex: 0,
          promptName: "Mix Volume",
          promptDesc: ["This setting affects the volume of your instrument as if its volume slider had been moved.", "At $MID, an instrument's volume will be unchanged from default. This means you can still use the volume sliders to mix the base volume of instruments, since this setting and the default value work multiplicatively. The volume gradually increases up to $HI, or decreases down to mute at $LO.", "Unlike the 'note volume' setting, mix volume is very straightforward and simply affects the resultant instrument volume after all effects are applied.", "[MULTIPLICATIVE] [$LO - $HI]"]
        },
        {
          name: "fm slider 5",
          pianoName: "FM 5",
          maxRawVol: 15,
          newNoteVol: 15,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 16 /* length */,
          maxIndex: 0,
          promptName: "FM Slider 5",
          promptDesc: ["This setting affects the strength of the fifth FM slider, just like the corresponding slider on your instrument.", "It works in a multiplicative way, so at $HI your slider will sound the same is its default value, and at $LO it will sound like it has been moved all the way to the left.", "For the full range of control with this mod, move your underlying slider all the way to the right.", "[MULTIPLICATIVE] [$LO - $HI] [%]"]
        },
        {
          name: "fm slider 6",
          pianoName: "FM 6",
          maxRawVol: 15,
          newNoteVol: 15,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 16 /* length */,
          maxIndex: 0,
          promptName: "FM Slider 6",
          promptDesc: ["This setting affects the strength of the sixth FM slider, just like the corresponding slider on your instrument.", "It works in a multiplicative way, so at $HI your slider will sound the same is its default value, and at $LO it will sound like it has been moved all the way to the left.", "For the full range of control with this mod, move your underlying slider all the way to the right.", "[MULTIPLICATIVE] [$LO - $HI] [%]"]
        },
        {
          name: "decimal offset",
          pianoName: "Decimal Offset",
          maxRawVol: 99,
          newNoteVol: 0,
          forSong: false,
          convertRealFactor: 0,
          invertSliderIndicator: true,
          associatedEffect: 16 /* length */,
          maxIndex: 0,
          promptName: "Decimal Offset",
          promptDesc: ["This setting controls the decimal offset that is subtracted from the pulse width; use this for creating values like 12.5 or 6.25.", "[$LO - $HI]"]
        },
        {
          name: "envelope speed",
          pianoName: "EnvelopeSpd",
          maxRawVol: 50,
          newNoteVol: 12,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 16 /* length */,
          maxIndex: 0,
          promptName: "Envelope Speed",
          promptDesc: [
            "This setting controls how fast all of the envelopes for the instrument play.",
            "At $LO, your instrument's envelopes will be frozen, and at values near there they will change very slowly. At 12, the envelopes will work as usual, performing at normal speed. This increases up to $HI, where the envelopes will change very quickly. The speeds are given below:",
            "[0-4]: x0, x1/16, x\u215B, x\u2155, x\xBC,",
            "[5-9]: x\u2153, x\u2156, x\xBD, x\u2154, x\xBE,",
            "[10-14]: x\u2158, x0.9, x1, x1.1, x1.2,",
            "[15-19]: x1.3, x1.4, x1.5, x1.6, x1.7,",
            "[20-24]: x1.8, x1.9, x2, x2.1, x2.2,",
            "[25-29]: x2.3, x2.4, x2.5, x2.6, x2.7,",
            "[30-34]: x2.8, x2.9, x3, x3.1, x3.2,",
            "[35-39]: x3.3, x3.4, x3.5, x3.6, x3.7,",
            "[40-44]: x3.8, x3.9, x4, x4.15, x4.3,",
            "[45-50]: x4.5, x4.8, x5, x5.5, x6, x8",
            "[OVERWRITING] [$LO - $HI]"
          ]
        },
        {
          name: "dynamism",
          pianoName: "Dynamism",
          maxRawVol: _Config.supersawDynamismMax,
          newNoteVol: 0,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 16 /* length */,
          maxIndex: 0,
          promptName: "Supersaw Dynamism",
          promptDesc: ["This setting controls the supersaw dynamism of your instrument, just like the dynamism slider.", "At $LO, your instrument will have only a single pulse contributing. Increasing this will raise the contribution of other waves which is similar to a chorus effect. The effect gets more noticeable up to the max value, $HI.", "[OVERWRITING] [$LO - $HI]"]
        },
        {
          name: "spread",
          pianoName: "Spread",
          maxRawVol: _Config.supersawSpreadMax,
          newNoteVol: 0,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 16 /* length */,
          maxIndex: 0,
          promptName: "Supersaw Spread",
          promptDesc: ["This setting controls the supersaw spread of your instrument, just like the spread slider.", "At $LO, all the pulses in your supersaw will be at the same frequency. Increasing this value raises the frequency spread of the contributing waves, up to a dissonant spread at the max value, $HI.", "[OVERWRITING] [$LO - $HI]"]
        },
        {
          name: "saw shape",
          pianoName: "Saw Shape",
          maxRawVol: _Config.supersawShapeMax,
          newNoteVol: 0,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 16 /* length */,
          maxIndex: 0,
          promptName: "Supersaw Shape",
          promptDesc: ["This setting controls the supersaw shape of your instrument, just like the Saw\u2194Pulse slider.", "As the slider's name implies, this effect will give you a sawtooth wave at $LO, and a full pulse width wave at $HI. Values in between will be a blend of the two.", "[OVERWRITING] [$LO - $HI] [%]"]
        },
        {
          name: "individual envelope speed",
          pianoName: "IndvEnvSpd",
          maxRawVol: 63,
          newNoteVol: 23,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 16 /* length */,
          maxIndex: this.maxEnvelopeCount - 1,
          promptName: "Individual Envelope Speed",
          promptDesc: [
            "This setting controls how fast the specified envelope of the instrument will play.",
            "At $LO, your the envelope will be frozen, and at values near there they will change very slowly. At 23, the envelope will work as usual, performing at normal speed. This increases up to $HI, where the envelope will change very quickly. The speeds are given below:",
            "[0-4]: x0, x0.01, x0.02, x0.03, x0.04,",
            "[5-9]: x0.05, x0.06, x0.07, x0.08, x0.09,",
            "[10-14]: x0.1, x0.2, x0.25, x0.3, x0.33,",
            "[15-19]: x0.4, x0.5, x0.6, x0.6667, x0.7,",
            "[20-24]: x0.75, x0.8, x0.9, x1, x1.25,",
            "[25-29]: x1.3333, x1.5, x1.6667, x1.75, x2,",
            "[30-34]: x2.25, x2.5, x2.75, x3, x3.5,",
            "[35-39]: x4, x4.5, x5, x5.5, x6,",
            "[40-44]: x6.5, x7, x7.5, x8, x8.5,",
            "[45-49]: x9, x9.5, x10, x11, x12",
            "[50-54]: x13, x14, x15, x16, x17",
            "[55-59]: x18, x19, x20, x24, x32",
            "[60-63]: x40, x64, x128, x256",
            "[OVERWRITING] [$LO - $HI]"
          ]
        },
        {
          name: "song eq",
          pianoName: "Song EQ",
          maxRawVol: 10,
          newNoteVol: 0,
          forSong: true,
          convertRealFactor: 0,
          associatedEffect: 16 /* length */,
          maxIndex: 0,
          promptName: "Song EQ Filter",
          promptDesc: ["This setting overwrites every instrument's eq filter. You can do this in a few separate ways, similar to the per instrument eq filter modulator.", "When the option 'morph' is selected, your modulator values will indicate a sub-filter index of your EQ filter to 'morph' to over time. For example, a change from 0 to 1 means your main filter (default) will morph to sub-filter 1 over the specified duration. You can shape the main filter and sub-filters in the large filter editor ('+' button). If your two filters' number, type, and order of filter dots all match up, the morph will happen smoothly and you'll be able to hear them changing. If they do not match up, the filters will simply jump between each other.", "Note that filters will morph based on endpoints in the pattern editor. So, if you specify a morph from sub-filter 1 to 4 but do not specifically drag in new endpoints for 2 and 3, it will morph directly between 1 and 4 without going through the others.", "If you target Dot X or Dot Y, you can finely tune the coordinates of a single dot for your filter. The number of available dots to choose is dependent on your main filter's dot count.", "[OVERWRITING] [$LO - $HI]"]
        },
        {
          name: "reset envelope",
          pianoName: "ResetEnv",
          maxRawVol: 1,
          newNoteVol: 1,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 16 /* length */,
          maxIndex: this.maxEnvelopeCount - 1,
          promptName: "Reset Envelope",
          promptDesc: ["This setting functions a lot like the reset arp modulator. Wherever a note is placed, the envelope of this instrument at the specified index will reset at the very start of that note. ", "[$LO - $HI]"]
        },
        {
          name: "ring modulation",
          pianoName: "Ring Mod",
          maxRawVol: _Config.ringModRange,
          newNoteVol: 0,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 13 /* ringModulation */,
          maxIndex: 0,
          promptName: "Ring Modulation",
          promptDesc: ["This setting controls the Ring Modulation effect in your instrument.", "[OVERWRITING] [$LO - $HI]"]
        },
        {
          name: "ring mod hertz",
          pianoName: "Ring Mod(Hz)",
          maxRawVol: _Config.ringModHzRange,
          newNoteVol: 0,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 13 /* ringModulation */,
          maxIndex: 0,
          promptName: "Ring Modulation (Hertz)",
          promptDesc: ["This setting controls the Hertz (Hz) used in the Ring Modulation effect in your instrument.", "[OVERWRITING] [$LO - $HI]"]
        },
        {
          name: "granular",
          pianoName: "Granular",
          maxRawVol: _Config.granularRange,
          newNoteVol: 0,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 14 /* granular */,
          maxIndex: 0,
          promptName: "Granular",
          promptDesc: ["This setting controls the granular effect in your instrument.", "[OVERWRITING] [$LO - $HI]"]
        },
        {
          name: "grain freq",
          pianoName: "Grain #",
          maxRawVol: _Config.grainAmountsMax,
          newNoteVol: 8,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 14 /* granular */,
          maxIndex: 0,
          promptName: "Grain Count",
          promptDesc: ["This setting controls the density of grains for the granular effect on your instrument.", "[OVERWRITING] [$LO - $HI]"]
        },
        {
          name: "grain size",
          pianoName: "Grain Size",
          maxRawVol: _Config.grainSizeMax / _Config.grainSizeStep,
          newNoteVol: _Config.grainSizeMin / _Config.grainSizeStep,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 14 /* granular */,
          maxIndex: 0,
          promptName: "Grain Size",
          promptDesc: ["This setting controls the grain size of the granular effect in your instrument.", "The number shown in the mod channel is multiplied by " + _Config.grainSizeStep + " to get the actual grain size.", "[OVERWRITING] [$LO - $HI]"]
        },
        {
          name: "grain range",
          pianoName: "Grain Range",
          maxRawVol: _Config.grainRangeMax / _Config.grainSizeStep,
          newNoteVol: 0,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 14 /* granular */,
          maxIndex: 0,
          promptName: "Grain Range",
          promptDesc: ["This setting controls the range of values for your grain size of the granular effect in your instrument, from no variation to a lot", "The number shown in the mod channel is multiplied by " + _Config.grainSizeStep + " to get the actual grain size.", "[OVERWRITING] [$LO - $HI]"]
        },
        {
          name: "individual envelope lower bound",
          pianoName: "IndvEnvLow",
          maxRawVol: _Config.perEnvelopeBoundMax * 10,
          newNoteVol: 0,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 16 /* length */,
          maxIndex: this.maxEnvelopeCount - 1,
          promptName: "Individual Envelope Lower Bound",
          promptDesc: ["This setting controls the envelope lower bound", "At $LO, your the envelope will output an upper envelope bound to 0, and at $HI your envelope will output an upper envelope bound to 2.", "This settings will not work if your lower envelope bound is higher than your upper envelope bound"]
        },
        {
          name: "individual envelope upper bound",
          pianoName: "IndvEnvUp",
          maxRawVol: _Config.perEnvelopeBoundMax * 10,
          newNoteVol: 10,
          forSong: false,
          convertRealFactor: 0,
          associatedEffect: 16 /* length */,
          maxIndex: this.maxEnvelopeCount - 1,
          promptName: "Individual Envelope Upper Bound",
          promptDesc: ["This setting controls the envelope upper bound", "At $LO, your the envelope will output a 0 to lower envelope bound, and at $HI your envelope will output a 2 to lower envelope bound.", "This settings will not work if your lower envelope bound is higher than your upper envelope bound"]
        }
      ]);
    }
  };
  function centerWave(wave) {
    let sum = 0;
    for (let i = 0; i < wave.length; i++) sum += wave[i];
    const average = sum / wave.length;
    for (let i = 0; i < wave.length; i++) wave[i] -= average;
    performIntegral(wave);
    wave.push(0);
    return new Float32Array(wave);
  }
  __name(centerWave, "centerWave");
  function centerAndNormalizeWave(wave) {
    let magn = 0;
    centerWave(wave);
    for (let i = 0; i < wave.length - 1; i++) {
      magn += Math.abs(wave[i]);
    }
    const magnAvg = magn / (wave.length - 1);
    for (let i = 0; i < wave.length - 1; i++) {
      wave[i] = wave[i] / magnAvg;
    }
    return new Float32Array(wave);
  }
  __name(centerAndNormalizeWave, "centerAndNormalizeWave");
  function performIntegral(wave) {
    let cumulative = 0;
    let newWave = new Float32Array(wave.length);
    for (let i = 0; i < wave.length; i++) {
      newWave[i] = cumulative;
      cumulative += wave[i];
    }
    return newWave;
  }
  __name(performIntegral, "performIntegral");
  function toNameMap(array) {
    const dictionary = {};
    for (let i = 0; i < array.length; i++) {
      const value = array[i];
      value.index = i;
      dictionary[value.name] = value;
    }
    const result = array;
    result.dictionary = dictionary;
    return result;
  }
  __name(toNameMap, "toNameMap");
  function effectsIncludeTransition(effects) {
    return (effects & 1 << 10 /* transition */) != 0;
  }
  __name(effectsIncludeTransition, "effectsIncludeTransition");
  function effectsIncludeChord(effects) {
    return (effects & 1 << 11 /* chord */) != 0;
  }
  __name(effectsIncludeChord, "effectsIncludeChord");
  function effectsIncludePitchShift(effects) {
    return (effects & 1 << 7 /* pitchShift */) != 0;
  }
  __name(effectsIncludePitchShift, "effectsIncludePitchShift");
  function effectsIncludeDetune(effects) {
    return (effects & 1 << 8 /* detune */) != 0;
  }
  __name(effectsIncludeDetune, "effectsIncludeDetune");
  function effectsIncludeVibrato(effects) {
    return (effects & 1 << 9 /* vibrato */) != 0;
  }
  __name(effectsIncludeVibrato, "effectsIncludeVibrato");
  function effectsIncludeNoteFilter(effects) {
    return (effects & 1 << 5 /* noteFilter */) != 0;
  }
  __name(effectsIncludeNoteFilter, "effectsIncludeNoteFilter");
  function effectsIncludeDistortion(effects) {
    return (effects & 1 << 3 /* distortion */) != 0;
  }
  __name(effectsIncludeDistortion, "effectsIncludeDistortion");
  function effectsIncludeBitcrusher(effects) {
    return (effects & 1 << 4 /* bitcrusher */) != 0;
  }
  __name(effectsIncludeBitcrusher, "effectsIncludeBitcrusher");
  function effectsIncludePanning(effects) {
    return (effects & 1 << 2 /* panning */) != 0;
  }
  __name(effectsIncludePanning, "effectsIncludePanning");
  function effectsIncludeChorus(effects) {
    return (effects & 1 << 1 /* chorus */) != 0;
  }
  __name(effectsIncludeChorus, "effectsIncludeChorus");
  function effectsIncludeEcho(effects) {
    return (effects & 1 << 6 /* echo */) != 0;
  }
  __name(effectsIncludeEcho, "effectsIncludeEcho");
  function effectsIncludeReverb(effects) {
    return (effects & 1 << 0 /* reverb */) != 0;
  }
  __name(effectsIncludeReverb, "effectsIncludeReverb");
  function effectsIncludeRingModulation(effects) {
    return (effects & 1 << 13 /* ringModulation */) != 0;
  }
  __name(effectsIncludeRingModulation, "effectsIncludeRingModulation");
  function effectsIncludeGranular(effects) {
    return (effects & 1 << 14 /* granular */) != 0;
  }
  __name(effectsIncludeGranular, "effectsIncludeGranular");
  function effectsIncludePlugin(effects) {
    return (effects & 1 << 15 /* plugin */) != 0;
  }
  __name(effectsIncludePlugin, "effectsIncludePlugin");
  function rawChipToIntegrated(raw) {
    const newArray = new Array(raw.length);
    const dictionary = {};
    for (let i = 0; i < newArray.length; i++) {
      newArray[i] = Object.assign([], raw[i]);
      const value = newArray[i];
      value.index = i;
      dictionary[value.name] = value;
    }
    for (let key in dictionary) {
      dictionary[key].samples = performIntegral(dictionary[key].samples);
    }
    const result = newArray;
    result.dictionary = dictionary;
    return result;
  }
  __name(rawChipToIntegrated, "rawChipToIntegrated");

  // editor/EditorConfig.ts
  var EditorConfig = class _EditorConfig {
    static {
      __name(this, "EditorConfig");
    }
    static {
      this.version = "1.5";
    }
    static {
      // Currently using patch versions in display (unlike JB)
      this.versionDisplayName = "Slarmoo's Box " + (true ? "Testing " : "") + this.version;
    }
    static {
      this.releaseNotesURL = "./patch_notes.html";
    }
    static {
      this.presetCategories = toNameMap([
        {
          // The order of this array needs to line up with the order of the InstrumentType declarations in SynthConfig.ts. (changes.ts' random instrument generation relies on this, for one.)
          name: "Custom Instruments",
          presets: toNameMap([
            { name: TypePresets[0 /* chip */], customType: 0 /* chip */ },
            { name: TypePresets[1 /* fm */], customType: 1 /* fm */ },
            { name: TypePresets[2 /* noise */], customType: 2 /* noise */ },
            { name: TypePresets[3 /* spectrum */], customType: 3 /* spectrum */ },
            { name: TypePresets[4 /* drumset */], customType: 4 /* drumset */ },
            { name: TypePresets[5 /* harmonics */], customType: 5 /* harmonics */ },
            { name: TypePresets[6 /* pwm */], customType: 6 /* pwm */ },
            { name: TypePresets[7 /* pickedString */], customType: 7 /* pickedString */ },
            { name: TypePresets[8 /* supersaw */], customType: 8 /* supersaw */ },
            { name: TypePresets[9 /* customChipWave */], customType: 9 /* customChipWave */ },
            { name: TypePresets[11 /* fm6op */], customType: 11 /* fm6op */ }
          ])
        },
        {
          name: "Retro Presets",
          presets: toNameMap([
            { name: "square wave", midiProgram: 80, settings: { "type": "chip", "eqFilter": [], "effects": ["aliasing"], "transition": "interrupt", "fadeInSeconds": 0, "fadeOutTicks": -1, "chord": "arpeggio", "wave": "square", "unison": "none", "envelopes": [] } },
            { name: "triangle wave", midiProgram: 71, settings: { "type": "chip", "eqFilter": [], "effects": ["aliasing"], "transition": "interrupt", "fadeInSeconds": 0, "fadeOutTicks": -1, "chord": "arpeggio", "wave": "triangle", "unison": "none", "envelopes": [] } },
            { name: "square lead", midiProgram: 80, generalMidi: true, settings: { "type": "chip", "eqFilter": [{ "type": "low-pass", "cutoffHz": 8e3, "linearGain": 0.3536 }], "effects": ["aliasing"], "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": -3, "chord": "simultaneous", "wave": "square", "unison": "hum", "envelopes": [] } },
            { name: "sawtooth lead 1", midiProgram: 81, generalMidi: true, settings: { "type": "chip", "eqFilter": [{ "type": "low-pass", "cutoffHz": 4e3, "linearGain": 0.5 }], "effects": ["aliasing"], "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": -3, "chord": "simultaneous", "wave": "sawtooth", "unison": "shimmer", "envelopes": [] } },
            { name: "sawtooth lead 2", midiProgram: 81, settings: { "type": "chip", "eqFilter": [{ "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 1 }], "effects": ["vibrato", "aliasing"], "vibrato": "light", "transition": "normal", "fadeInSeconds": 0.0125, "fadeOutTicks": 72, "chord": "simultaneous", "wave": "sawtooth", "unison": "hum", "envelopes": [] } },
            { name: "chip noise", midiProgram: 116, isNoise: true, settings: { "type": "noise", "transition": "hard", "effects": ["aliasing"], "chord": "arpeggio", "filterCutoffHz": 4e3, "filterResonance": 0, "filterEnvelope": "steady", "wave": "retro" } },
            { name: "supersaw lead", midiProgram: 81, settings: { "type": "supersaw", "eqFilter": [{ "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 2 }], "effects": ["reverb"], "reverb": 67, "fadeInSeconds": 0, "fadeOutTicks": -6, "pulseWidth": 50, "dynamism": 100, "spread": 58, "shape": 0, "envelopes": [] } },
            { name: "FM twang", midiProgram: 32, settings: { "type": "FM", "eqFilter": [], "effects": [], "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": -3, "chord": "simultaneous", "algorithm": "1\u2190(2\u20023\u20024)", "feedbackType": "1\u27F2", "feedbackAmplitude": 0, "operators": [{ "frequency": "1\xD7", "amplitude": 15 }, { "frequency": "1\xD7", "amplitude": 15 }, { "frequency": "1\xD7", "amplitude": 0 }, { "frequency": "1\xD7", "amplitude": 0 }], "envelopes": [{ "target": "operatorAmplitude", "envelope": "twang 2", "index": 1 }] } },
            { name: "FM bass", midiProgram: 36, settings: { "type": "FM", "eqFilter": [], "effects": [], "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": -3, "chord": "custom interval", "algorithm": "1\u2190(2\u20023\u21904)", "feedbackType": "1\u27F2", "feedbackAmplitude": 0, "operators": [{ "frequency": "2\xD7", "amplitude": 11 }, { "frequency": "1\xD7", "amplitude": 7 }, { "frequency": "1\xD7", "amplitude": 9 }, { "frequency": "20\xD7", "amplitude": 3 }], "envelopes": [{ "target": "operatorAmplitude", "envelope": "twang 2", "index": 1 }, { "target": "operatorAmplitude", "envelope": "twang 3", "index": 2 }, { "target": "operatorAmplitude", "envelope": "twang 2", "index": 3 }] } },
            { name: "FM flute", midiProgram: 73, settings: { "type": "FM", "eqFilter": [], "effects": [], "transition": "normal", "fadeInSeconds": 0.0263, "fadeOutTicks": -3, "chord": "simultaneous", "algorithm": "1\u2190(2\u20023\u20024)", "feedbackType": "1\u27F2", "feedbackAmplitude": 0, "operators": [{ "frequency": "1\xD7", "amplitude": 15 }, { "frequency": "1\xD7", "amplitude": 6 }, { "frequency": "1\xD7", "amplitude": 0 }, { "frequency": "1\xD7", "amplitude": 0 }], "envelopes": [{ "target": "operatorAmplitude", "envelope": "twang 2", "index": 1 }] } },
            { name: "FM organ", midiProgram: 16, settings: { "type": "FM", "eqFilter": [], "effects": ["vibrato"], "vibrato": "delayed", "transition": "normal", "fadeInSeconds": 0.0263, "fadeOutTicks": -3, "chord": "custom interval", "algorithm": "1\u21903\u20032\u21904", "feedbackType": "1\u27F2\u20032\u27F2", "feedbackAmplitude": 0, "operators": [{ "frequency": "1\xD7", "amplitude": 14 }, { "frequency": "2\xD7", "amplitude": 14 }, { "frequency": "1\xD7", "amplitude": 11 }, { "frequency": "2\xD7", "amplitude": 11 }], "envelopes": [] } },
            { name: "FM sine", midiProgram: 55, settings: { "type": "FM", "eqFilter": [], "eqFilterType": true, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "effects": [], "panDelay": 10, "fadeInSeconds": 0, "fadeOutTicks": -1, "algorithm": "1\u20032\u20033\u20034", "feedbackType": "1\u27F2", "feedbackAmplitude": 0, "operators": [{ "frequency": "1\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine" }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine" }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine" }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine" }], "envelopes": [] } },
            { name: "NES Pulse", midiProgram: 80, settings: { "type": "custom chip", "effects": ["aliasing"], "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": -3, "chord": "arpeggio", "eqFilter": [{ "type": "low-pass", "cutoffHz": 8e3, "linearGain": 0.5 }], "unison": "none", "vibrato": "none", "envelopes": [], "customChipWave": [-24, -24, -24, -24, -23, -23, -23, -23, -22, -22, -22, -22, -21, -21, -21, -21, -20, -20, -20, -20, -19, -19, -19, -19, -18, -18, -18, -18, -17, -17, -17, -17, 24, 24, 24, 24, 23, 23, 23, 23, 22, 22, 22, 22, 21, 21, 21, 21, 20, 20, 20, 20, 19, 19, 19, 19, 18, 18, 18, 18, 17, 17, 17, 17] } },
            { name: "Gameboy Pulse", midiProgram: 80, settings: { "type": "custom chip", "effects": ["aliasing"], "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": -3, "chord": "arpeggio", "eqFilter": [{ "type": "low-pass", "cutoffHz": 8e3, "linearGain": 0.5 }], "unison": "none", "envelopes": [], "customChipWave": [-24, -20, -17, -15, -13, -13, -11, -11, -11, -9, -9, -9, -9, -7, -7, -7, -7, -7, -5, -5, -5, -5, -5, -5, -3, -3, -3, -3, -3, -3, -3, -3, 24, 20, 17, 15, 13, 13, 11, 11, 11, 9, 9, 9, 9, 7, 7, 7, 7, 7, 5, 5, 5, 5, 5, 5, 3, 3, 3, 3, 3, 3, 3, 3] } },
            { name: "VRC6 Sawtooth", midiProgram: 81, settings: { "type": "custom chip", "effects": ["aliasing"], "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": -3, "chord": "arpeggio", "eqFilter": [{ "type": "low-pass", "cutoffHz": 8e3, "linearGain": 0.5 }], "unison": "none", "envelopes": [], "customChipWave": [-24, -20, -16, -13, -10, -8, -6, -5, -4, -4, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4, 8, 8, 8, 8, 8, 8, 8, 8, 12, 12, 12, 12, 12, 12, 12, 12, 16, 16, 16, 16, 16, 16, 16, 16, 20, 20, 20, 20, 20, 20, 20, 20, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24] } },
            { name: "Atari Square", midiProgram: 80, settings: { "type": "custom chip", "effects": ["aliasing"], "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": -3, "chord": "arpeggio", "eqFilter": [{ "type": "low-pass", "cutoffHz": 4e3, "linearGain": 0.5 }], "unison": "none", "envelopes": [], "customChipWave": [-24, -24, -24, -23, -23, -23, -22, -22, -22, -21, -21, -21, -20, -20, -20, -19, -19, -19, -18, -18, -18, -17, -17, -17, -16, -16, -16, -15, -15, -15, -14, -14, -14, -13, -13, -13, 24, 24, 24, 23, 23, 23, 22, 22, 22, 21, 21, 21, 20, 20, 20, 19, 19, 19, 18, 18, 18, 17, 17, 17, 16, 16, 15, 15] } },
            { name: "Atari Bass", midiProgram: 36, settings: { "type": "custom chip", "effects": ["aliasing"], "transition": "interrupt", "fadeInSeconds": 0, "fadeOutTicks": -3, "chord": "arpeggio", "eqFilter": [{ "type": "low-pass", "cutoffHz": 4e3, "linearGain": 0.5 }], "unison": "none", "envelopes": [], "customChipWave": [-24, -24, -24, -24, -24, -24, -24, -24, -24, 24, 24, 24, 24, 24, 24, -24, -24, -24, 24, 24, 24, -24, -24, -24, 24, 24, 24, -24, -24, -24, 24, 24, -24, -24, -24, -24, -24, -24, -24, -24, -24, 24, 24, 24, 24, 24, 24, -24, -24, 24, 24, 24, 24, 24, -24, -24, -24, -24, 24, 24, -24, -24, 24, 24] } },
            { name: "Sunsoft Bass", midiProgram: 36, settings: { "type": "custom chip", "effects": ["aliasing"], "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": -3, "chord": "arpeggio", "eqFilter": [{ "type": "low-pass", "cutoffHz": 4e3, "linearGain": 0.5 }], "unison": "none", "envelopes": [], "customChipWave": [24, 24, 15, 15, 9, 9, -4, -4, 0, 0, -13, -13, -19, -19, -24, -24, -24, -24, -10, -10, 0, 0, -7, -7, -7, -7, 0, 0, 6, 6, -4, -4, 3, 3, -4, -4, 3, 3, 3, 3, 9, 9, 15, 15, 15, 15, 6, 6, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, 3, 3, 12, 12, 24, 24] } }
          ])
        },
        {
          name: "Keyboard Presets",
          presets: toNameMap([
            { name: "grand piano 1", midiProgram: 0, generalMidi: true, settings: { "type": "Picked String", "eqFilter": [{ "type": "high-pass", "cutoffHz": 148.65, "linearGain": 0.7071 }, { "type": "peak", "cutoffHz": 2e3, "linearGain": 2.8284 }], "effects": ["note filter", "reverb"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 8e3, "linearGain": 0.125 }], "reverb": 67, "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": 48, "chord": "simultaneous", "harmonics": [100, 100, 86, 86, 86, 71, 71, 71, 0, 86, 71, 71, 71, 57, 57, 71, 57, 14, 57, 57, 57, 57, 57, 57, 57, 57, 29, 57], "unison": "piano", "stringSustain": 79, "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "note size" }] } },
            { name: "bright piano", midiProgram: 1, generalMidi: true, settings: { "type": "Picked String", "eqFilter": [{ "type": "low-pass", "cutoffHz": 1681.79, "linearGain": 0.7071 }, { "type": "high-pass", "cutoffHz": 148.65, "linearGain": 0.5 }, { "type": "peak", "cutoffHz": 3363.59, "linearGain": 1.4142 }], "effects": ["reverb"], "reverb": 33, "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": 24, "chord": "simultaneous", "harmonics": [100, 100, 86, 86, 71, 71, 0, 71, 71, 71, 71, 71, 71, 14, 57, 57, 57, 57, 57, 57, 29, 57, 57, 57, 57, 57, 57, 57], "unison": "piano", "stringSustain": 86, "envelopes": [] } },
            { name: "electric grand", midiProgram: 2, generalMidi: true, settings: { "type": "chip", "eqFilter": [], "effects": ["note filter"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 2378.41, "linearGain": 0.5 }], "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": 48, "chord": "simultaneous", "wave": "1/8 pulse", "unison": "shimmer", "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "twang 3" }] } },
            { name: "honky-tonk piano", midiProgram: 3, generalMidi: true, settings: { "type": "Picked String", "eqFilter": [{ "type": "low-pass", "cutoffHz": 5656.85, "linearGain": 0.3536 }], "effects": ["reverb"], "reverb": 33, "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": 48, "chord": "simultaneous", "harmonics": [100, 100, 86, 71, 86, 71, 43, 71, 43, 43, 57, 57, 57, 29, 57, 57, 57, 57, 57, 57, 43, 57, 57, 57, 43, 43, 43, 43], "unison": "honky tonk", "stringSustain": 71, "envelopes": [] } },
            { name: "electric piano 1", midiProgram: 4, generalMidi: true, settings: { "type": "harmonics", "eqFilter": [], "effects": ["note filter"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 3363.59, "linearGain": 0.5 }], "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": -3, "chord": "simultaneous", "harmonics": [86, 100, 100, 71, 71, 57, 57, 43, 43, 43, 29, 29, 29, 14, 14, 14, 0, 0, 0, 0, 0, 57, 0, 0, 0, 0, 0, 0], "unison": "none", "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "twang 2" }] } },
            { name: "electric piano 2", midiProgram: 5, generalMidi: true, settings: { "type": "FM", "eqFilter": [], "effects": ["note filter"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 13454.34, "linearGain": 0.25 }], "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": 48, "chord": "simultaneous", "algorithm": "1\u21903\u20032\u21904", "feedbackType": "1\u27F2\u20032\u27F2", "feedbackAmplitude": 0, "operators": [{ "frequency": "1\xD7", "amplitude": 12 }, { "frequency": "1\xD7", "amplitude": 6 }, { "frequency": "1\xD7", "amplitude": 9 }, { "frequency": "16\xD7", "amplitude": 6 }], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "twang 3" }, { "target": "operatorAmplitude", "envelope": "twang 3", "index": 3 }] } },
            { name: "harpsichord", midiProgram: 6, generalMidi: true, settings: { "type": "Picked String", "eqFilter": [{ "type": "high-pass", "cutoffHz": 250, "linearGain": 0.3536 }, { "type": "peak", "cutoffHz": 11313.71, "linearGain": 2.8284 }], "effects": ["reverb"], "reverb": 33, "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": 24, "chord": "simultaneous", "harmonics": [100, 100, 100, 86, 57, 86, 86, 86, 86, 57, 57, 71, 71, 86, 86, 71, 71, 86, 86, 71, 71, 71, 71, 71, 71, 71, 71, 71], "unison": "none", "stringSustain": 79, "envelopes": [] } },
            { name: "clavinet", midiProgram: 7, generalMidi: true, settings: { "type": "FM", "eqFilter": [], "effects": ["note filter"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 19027.31, "linearGain": 0.3536 }], "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": -3, "chord": "simultaneous", "algorithm": "1\u2190(2\u20023\u20024)", "feedbackType": "3\u27F2", "feedbackAmplitude": 6, "operators": [{ "frequency": "3\xD7", "amplitude": 15 }, { "frequency": "~1\xD7", "amplitude": 6 }, { "frequency": "8\xD7", "amplitude": 4 }, { "frequency": "1\xD7", "amplitude": 0 }], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "twang 2" }, { "target": "feedbackAmplitude", "envelope": "twang 2" }] } },
            { name: "dulcimer", midiProgram: 15, generalMidi: true, settings: { "type": "Picked String", "eqFilter": [{ "type": "low-pass", "cutoffHz": 8e3, "linearGain": 0.3536 }], "effects": ["reverb"], "reverb": 33, "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": 48, "chord": "strum", "harmonics": [100, 100, 100, 86, 100, 86, 57, 100, 100, 86, 100, 86, 100, 86, 100, 71, 57, 71, 71, 100, 86, 71, 86, 86, 100, 86, 86, 86], "unison": "piano", "stringSustain": 79, "envelopes": [] } },
            { name: "grand piano 2", midiProgram: 0, generalMidi: true, settings: { "type": "harmonics", "eqFilter": [{ "type": "high-pass", "cutoffHz": 148.65, "linearGain": 0.7071 }, { "type": "peak", "cutoffHz": 2e3, "linearGain": 2.8284 }], "effects": ["note filter", "reverb"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 8e3, "linearGain": 0.125 }], "reverb": 67, "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": 48, "chord": "simultaneous", "harmonics": [100, 86, 86, 86, 86, 71, 71, 57, 0, 57, 29, 43, 57, 57, 57, 43, 43, 0, 29, 43, 43, 43, 43, 43, 43, 29, 0, 29], "unison": "piano", "stringSustain": 79, "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "note size" }] } },
            { name: "grand piano 3", midiProgram: 0, generalMidi: true, settings: { "type": "Picked String", "eqFilter": [{ "type": "high-pass", "cutoffHz": 148.65, "linearGain": 0.7071 }, { "type": "peak", "cutoffHz": 1681.79, "linearGain": 4 }, { "type": "low-pass", "cutoffHz": 8e3, "linearGain": 0.1768 }, { "type": "peak", "cutoffHz": 3363.59, "linearGain": 4 }, { "type": "peak", "cutoffHz": 2378.41, "linearGain": 0.25 }], "effects": ["note filter", "reverb"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 4756.83, "linearGain": 0.3536 }, { "type": "high-pass", "cutoffHz": 125, "linearGain": 0.0884 }], "reverb": 67, "fadeInSeconds": 0, "fadeOutTicks": 48, "harmonics": [100, 100, 86, 86, 86, 71, 71, 71, 0, 71, 71, 71, 71, 57, 57, 71, 57, 14, 57, 57, 57, 57, 57, 57, 57, 57, 29, 57], "unison": "piano", "stringSustain": 86, "stringSustainType": "acoustic", "envelopes": [{ "target": "noteFilterFreq", "envelope": "note size", "index": 0 }, { "target": "noteFilterFreq", "envelope": "twang 1", "index": 1 }, { "target": "noteFilterFreq", "envelope": "twang 1", "index": 1 }] } }
          ])
        },
        {
          name: "Idiophone Presets",
          presets: toNameMap([
            { name: "celesta", midiProgram: 8, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "hard fade", "chord": "strum", "filterCutoffHz": 5657, "filterResonance": 14, "filterEnvelope": "twang 2", "vibrato": "none", "algorithm": "(1\u20022)\u2190(3\u20024)", "feedbackType": "1\u27F2\u20032\u27F2", "feedbackAmplitude": 0, "feedbackEnvelope": "steady", "operators": [{ "frequency": "~1\xD7", "amplitude": 11, "envelope": "custom" }, { "frequency": "8\xD7", "amplitude": 6, "envelope": "custom" }, { "frequency": "20\xD7", "amplitude": 3, "envelope": "twang 1" }, { "frequency": "3\xD7", "amplitude": 1, "envelope": "twang 2" }] } },
            { name: "glockenspiel", midiProgram: 9, generalMidi: true, settings: { "type": "FM", "volume": 0, "eqFilter": [], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "preset": 193, "effects": ["chord type", "note filter", "reverb"], "chord": "strum", "fastTwoNoteArp": true, "arpeggioSpeed": 12, "noteFilterType": true, "noteSimpleCut": 9, "noteSimplePeak": 1, "noteFilter": [{ "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 0.5 }], "reverb": 0, "fadeInSeconds": 0, "fadeOutTicks": 48, "algorithm": "(1\u20022\u20023)\u21904", "feedbackType": "1\u27F2\u20032\u27F2\u20033\u27F2", "feedbackAmplitude": 2, "operators": [{ "frequency": "1\xD7", "amplitude": 7, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "5\xD7", "amplitude": 11, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "8\xD7", "amplitude": 7, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "20\xD7", "amplitude": 2, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "twang", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 8, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }, { "target": "operatorAmplitude", "envelope": "twang", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 32, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "index": 3 }, { "target": "feedbackAmplitude", "envelope": "decay", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 10, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }], "isDrum": false } },
            { name: "music box 1", midiProgram: 10, generalMidi: true, settings: { "type": "Picked String", "eqFilter": [{ "type": "low-pass", "cutoffHz": 4756.83, "linearGain": 0.5 }], "effects": ["reverb"], "reverb": 33, "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": 48, "chord": "strum", "harmonics": [100, 0, 0, 100, 0, 0, 0, 0, 0, 0, 100, 0, 0, 0, 0, 0, 0, 0, 0, 86, 0, 0, 0, 0, 0, 0, 71, 0], "unison": "none", "stringSustain": 64, "envelopes": [] } },
            { name: "music box 2", midiProgram: 10, settings: { "type": "Picked String", "eqFilter": [{ "type": "low-pass", "cutoffHz": 2828.43, "linearGain": 0.7071 }], "effects": ["reverb"], "reverb": 33, "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": 48, "chord": "strum", "harmonics": [100, 57, 57, 0, 0, 0, 0, 0, 0, 57, 0, 0, 0, 0, 0, 0, 0, 0, 0, 43, 0, 0, 0, 0, 0, 0, 0, 0], "unison": "none", "stringSustain": 29, "envelopes": [] } },
            { name: "vibraphone", midiProgram: 11, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "hard fade", "chord": "harmony", "filterCutoffHz": 2828, "filterResonance": 14, "filterEnvelope": "twang 2", "vibrato": "none", "algorithm": "1\u20032\u20033\u20034", "feedbackType": "1\u21922\u21923\u21924", "feedbackAmplitude": 3, "feedbackEnvelope": "twang 1", "operators": [{ "frequency": "1\xD7", "amplitude": 9, "envelope": "custom" }, { "frequency": "~1\xD7", "amplitude": 9, "envelope": "custom" }, { "frequency": "9\xD7", "amplitude": 3, "envelope": "custom" }, { "frequency": "4\xD7", "amplitude": 9, "envelope": "custom" }] } },
            { name: "marimba", midiProgram: 12, generalMidi: true, settings: { "type": "FM", "volume": 0, "eqFilter": [], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "preset": 197, "effects": ["chord type", "note filter", "reverb"], "chord": "strum", "fastTwoNoteArp": true, "arpeggioSpeed": 12, "noteFilterType": true, "noteSimpleCut": 6, "noteSimplePeak": 2, "noteFilter": [{ "type": "low-pass", "cutoffHz": 2378.41, "linearGain": 0.7071 }], "reverb": 0, "fadeInSeconds": 0, "fadeOutTicks": 48, "algorithm": "1\u20032\u2190(3\u20024)", "feedbackType": "1\u27F2", "feedbackAmplitude": 0, "operators": [{ "frequency": "1\xD7", "amplitude": 10, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "4\xD7", "amplitude": 6, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "13\xD7", "amplitude": 6, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "decay", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 10, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }, { "target": "operatorAmplitude", "envelope": "twang", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 32, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "index": 2 }], "isDrum": false } },
            { name: "kalimba", midiProgram: 108, generalMidi: true, settings: { "type": "FM", "volume": 0, "eqFilter": [], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "preset": 198, "effects": ["chord type", "note filter", "reverb"], "chord": "strum", "fastTwoNoteArp": true, "arpeggioSpeed": 12, "noteFilterType": true, "noteSimpleCut": 7, "noteSimplePeak": 1, "noteFilter": [{ "type": "low-pass", "cutoffHz": 3363.59, "linearGain": 0.5 }], "reverb": 0, "fadeInSeconds": 0, "fadeOutTicks": 48, "algorithm": "1\u2190(2\u20023\u20024)", "feedbackType": "1\u27F2", "feedbackAmplitude": 0, "operators": [{ "frequency": "1\xD7", "amplitude": 11, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "5\xD7", "amplitude": 3, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "20\xD7", "amplitude": 3, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "decay", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 10, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }, { "target": "operatorAmplitude", "envelope": "twang", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 8, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "index": 1 }, { "target": "operatorAmplitude", "envelope": "twang", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 32, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "index": 2 }], "isDrum": false } },
            { name: "xylophone", midiProgram: 13, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "hard", "chord": "strum", "filterCutoffHz": 2e3, "filterResonance": 14, "filterEnvelope": "twang 1", "vibrato": "none", "algorithm": "(1\u20022\u20023)\u21904", "feedbackType": "1\u27F2\u20032\u27F2\u20033\u27F2", "feedbackAmplitude": 0, "feedbackEnvelope": "steady", "operators": [{ "frequency": "1\xD7", "amplitude": 9, "envelope": "custom" }, { "frequency": "6\xD7", "amplitude": 9, "envelope": "custom" }, { "frequency": "11\xD7", "amplitude": 9, "envelope": "custom" }, { "frequency": "20\xD7", "amplitude": 6, "envelope": "twang 1" }] } },
            { name: "tubular bell", midiProgram: 14, generalMidi: true, midiSubharmonicOctaves: 1, settings: { "type": "Picked String", "eqFilter": [{ "type": "low-pass", "cutoffHz": 4e3, "linearGain": 0.5 }, { "type": "high-pass", "cutoffHz": 105.11, "linearGain": 0.3536 }], "effects": ["reverb"], "reverb": 33, "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": 96, "chord": "strum", "harmonics": [43, 71, 0, 100, 0, 100, 0, 86, 0, 0, 86, 0, 14, 71, 14, 14, 57, 14, 14, 43, 14, 14, 43, 14, 14, 43, 14, 14], "unison": "shimmer", "stringSustain": 86, "envelopes": [] } },
            { name: "bell synth", midiProgram: 14, settings: { "type": "FM", "effects": "reverb", "transition": "hard fade", "chord": "strum", "filterCutoffHz": 2e3, "filterResonance": 29, "filterEnvelope": "twang 3", "vibrato": "none", "algorithm": "1\u2190(2\u20023\u20024)", "feedbackType": "1\u27F2", "feedbackAmplitude": 0, "feedbackEnvelope": "steady", "operators": [{ "frequency": "~2\xD7", "amplitude": 10, "envelope": "custom" }, { "frequency": "7\xD7", "amplitude": 6, "envelope": "twang 3" }, { "frequency": "20\xD7", "amplitude": 1, "envelope": "twang 1" }, { "frequency": "1\xD7", "amplitude": 0, "envelope": "steady" }] } },
            { name: "rain drop", midiProgram: 96, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "hard fade", "chord": "strum", "filterCutoffHz": 4e3, "filterResonance": 14, "filterEnvelope": "twang 1", "vibrato": "none", "algorithm": "(1\u20022)\u2190(3\u20024)", "feedbackType": "1\u27F2\u20032\u27F2", "feedbackAmplitude": 0, "feedbackEnvelope": "steady", "operators": [{ "frequency": "1\xD7", "amplitude": 12, "envelope": "custom" }, { "frequency": "6\xD7", "amplitude": 4, "envelope": "custom" }, { "frequency": "20\xD7", "amplitude": 3, "envelope": "twang 1" }, { "frequency": "1\xD7", "amplitude": 6, "envelope": "tremolo1" }] } },
            { name: "crystal", midiProgram: 98, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "hard fade", "chord": "harmony", "filterCutoffHz": 2828, "filterResonance": 14, "filterEnvelope": "twang 2", "vibrato": "delayed", "algorithm": "1\u20032\u20033\u20034", "feedbackType": "1\u27F2 2\u27F2 3\u27F2 4\u27F2", "feedbackAmplitude": 4, "feedbackEnvelope": "twang 1", "operators": [{ "frequency": "1\xD7", "amplitude": 10, "envelope": "custom" }, { "frequency": "3\xD7", "amplitude": 7, "envelope": "custom" }, { "frequency": "6\xD7", "amplitude": 4, "envelope": "custom" }, { "frequency": "13\xD7", "amplitude": 4, "envelope": "custom" }] } },
            { name: "tinkle bell", midiProgram: 112, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "hard", "chord": "strum", "filterCutoffHz": 2828, "filterResonance": 14, "filterEnvelope": "twang 2", "vibrato": "none", "algorithm": "1\u20032\u20033\u20034", "feedbackType": "1\u21922\u21923\u21924", "feedbackAmplitude": 5, "feedbackEnvelope": "twang 3", "operators": [{ "frequency": "~2\xD7", "amplitude": 7, "envelope": "custom" }, { "frequency": "5\xD7", "amplitude": 7, "envelope": "custom" }, { "frequency": "7\xD7", "amplitude": 7, "envelope": "custom" }, { "frequency": "16\xD7", "amplitude": 7, "envelope": "custom" }] } },
            { name: "agogo", midiProgram: 113, generalMidi: true, settings: { "type": "FM", "volume": 0, "eqFilter": [], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "preset": 205, "effects": ["chord type", "note filter", "reverb"], "chord": "strum", "fastTwoNoteArp": true, "arpeggioSpeed": 12, "noteFilterType": true, "noteSimpleCut": 8, "noteSimplePeak": 1, "noteFilter": [{ "type": "low-pass", "cutoffHz": 4756.83, "linearGain": 0.5 }], "reverb": 0, "fadeInSeconds": 0, "fadeOutTicks": 48, "algorithm": "1\u20032\u20033\u20034", "feedbackType": "1\u21924", "feedbackAmplitude": 15, "operators": [{ "frequency": "2\xD7", "amplitude": 9, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "5\xD7", "amplitude": 6, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "8\xD7", "amplitude": 9, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "13\xD7", "amplitude": 11, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "decay", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 10, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }, { "target": "feedbackAmplitude", "envelope": "decay", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 10, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }], "isDrum": false } }
          ])
        },
        {
          name: "Guitar Presets",
          presets: toNameMap([
            { name: "nylon guitar", midiProgram: 24, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "hard fade", "chord": "strum", "filterCutoffHz": 5657, "filterResonance": 14, "filterEnvelope": "twang 1", "vibrato": "none", "algorithm": "1\u21902\u21903\u21904", "feedbackType": "3\u27F2", "feedbackAmplitude": 6, "feedbackEnvelope": "twang 1", "operators": [{ "frequency": "1\xD7", "amplitude": 15, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 6, "envelope": "steady" }, { "frequency": "5\xD7", "amplitude": 2, "envelope": "steady" }, { "frequency": "7\xD7", "amplitude": 4, "envelope": "steady" }] } },
            { name: "steel guitar", midiProgram: 25, generalMidi: true, settings: { "type": "Picked String", "eqFilter": [], "effects": ["reverb"], "reverb": 33, "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": 48, "chord": "strum", "harmonics": [100, 100, 86, 71, 71, 71, 86, 86, 71, 57, 43, 43, 43, 57, 57, 57, 57, 57, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43], "unison": "none", "stringSustain": 71, "envelopes": [] } },
            { name: "jazz guitar", midiProgram: 26, generalMidi: true, settings: { "type": "harmonics", "effects": "reverb", "transition": "hard", "chord": "strum", "filterCutoffHz": 2e3, "filterResonance": 14, "filterEnvelope": "twang 2", "interval": "union", "vibrato": "none", "harmonics": [100, 100, 86, 71, 57, 71, 71, 43, 57, 71, 57, 43, 29, 29, 29, 29, 29, 29, 29, 29, 14, 14, 14, 14, 14, 14, 14, 0] } },
            { name: "clean guitar", midiProgram: 27, generalMidi: true, settings: { "type": "harmonics", "effects": "reverb", "transition": "hard", "chord": "strum", "filterCutoffHz": 2828, "filterResonance": 14, "filterEnvelope": "twang 2", "interval": "union", "vibrato": "none", "harmonics": [86, 100, 100, 100, 86, 57, 86, 100, 100, 100, 71, 57, 43, 71, 86, 71, 57, 57, 71, 71, 71, 71, 57, 57, 57, 57, 57, 43] } },
            { name: "muted guitar", midiProgram: 28, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "hard", "chord": "strum", "filterCutoffHz": 2e3, "filterResonance": 14, "filterEnvelope": "twang 1", "vibrato": "none", "algorithm": "1\u2190(2\u20023\u21904)", "feedbackType": "1\u27F2", "feedbackAmplitude": 7, "feedbackEnvelope": "twang 2", "operators": [{ "frequency": "1\xD7", "amplitude": 13, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 4, "envelope": "twang 3" }, { "frequency": "4\xD7", "amplitude": 4, "envelope": "twang 2" }, { "frequency": "16\xD7", "amplitude": 4, "envelope": "twang 1" }] } }
          ])
        },
        {
          name: "Picked Bass Presets",
          presets: toNameMap([
            { name: "acoustic bass", midiProgram: 32, generalMidi: true, settings: { "type": "harmonics", "effects": "reverb", "transition": "hard fade", "chord": "strum", "filterCutoffHz": 4e3, "filterResonance": 14, "filterEnvelope": "twang 1", "interval": "union", "vibrato": "none", "harmonics": [100, 86, 71, 71, 71, 71, 57, 57, 57, 57, 43, 43, 43, 43, 43, 29, 29, 29, 29, 29, 29, 14, 14, 14, 14, 14, 14, 14] } },
            { name: "fingered bass", midiProgram: 33, generalMidi: true, settings: { "type": "harmonics", "effects": "reverb", "transition": "hard fade", "chord": "strum", "filterCutoffHz": 2828, "filterResonance": 14, "filterEnvelope": "twang 1", "interval": "union", "vibrato": "none", "harmonics": [100, 86, 71, 57, 71, 43, 57, 29, 29, 29, 29, 29, 29, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 0] } },
            { name: "picked bass", midiProgram: 34, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "hard fade", "chord": "strum", "filterCutoffHz": 2828, "filterResonance": 0, "filterEnvelope": "twang 1", "vibrato": "none", "algorithm": "1\u2190(2\u20023\u21904)", "feedbackType": "3\u27F2", "feedbackAmplitude": 4, "feedbackEnvelope": "twang 1", "operators": [{ "frequency": "1\xD7", "amplitude": 15, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 5, "envelope": "steady" }, { "frequency": "11\xD7", "amplitude": 1, "envelope": "twang 3" }, { "frequency": "1\xD7", "amplitude": 9, "envelope": "steady" }] } },
            { name: "fretless bass", midiProgram: 35, generalMidi: true, settings: { "type": "harmonics", "effects": "reverb", "transition": "hard", "chord": "strum", "filterCutoffHz": 1e3, "filterResonance": 14, "filterEnvelope": "flare 2", "interval": "union", "vibrato": "none", "harmonics": [100, 100, 86, 71, 71, 57, 57, 71, 71, 71, 57, 57, 57, 57, 57, 57, 57, 43, 43, 43, 43, 43, 43, 43, 43, 29, 29, 14] } },
            { name: "slap bass 1", midiProgram: 36, generalMidi: true, settings: { "type": "harmonics", "effects": "reverb", "transition": "hard", "chord": "strum", "filterCutoffHz": 4e3, "filterResonance": 0, "filterEnvelope": "twang 1", "interval": "union", "vibrato": "none", "harmonics": [100, 100, 100, 100, 86, 71, 57, 29, 29, 43, 43, 57, 71, 57, 29, 29, 43, 57, 57, 57, 43, 43, 43, 57, 71, 71, 71, 71] } },
            { name: "slap bass 2", midiProgram: 37, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "hard", "chord": "strum", "filterCutoffHz": 5657, "filterResonance": 0, "filterEnvelope": "twang 1", "vibrato": "none", "algorithm": "1\u21902\u21903\u21904", "feedbackType": "3\u27F2", "feedbackAmplitude": 4, "feedbackEnvelope": "steady", "operators": [{ "frequency": "3\xD7", "amplitude": 13, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 7, "envelope": "steady" }, { "frequency": "13\xD7", "amplitude": 3, "envelope": "steady" }, { "frequency": "1\xD7", "amplitude": 11, "envelope": "steady" }] } },
            { name: "bass synth 1", midiProgram: 38, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "hard", "chord": "strum", "filterCutoffHz": 4e3, "filterResonance": 43, "filterEnvelope": "twang 2", "vibrato": "none", "algorithm": "1\u21903\u20032\u21904", "feedbackType": "3\u27F2\u20034\u27F2", "feedbackAmplitude": 9, "feedbackEnvelope": "twang 2", "operators": [{ "frequency": "1\xD7", "amplitude": 15, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 10, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 14, "envelope": "twang 1" }, { "frequency": "~1\xD7", "amplitude": 13, "envelope": "twang 2" }] } },
            { name: "bass synth 2", midiProgram: 39, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "hard fade", "chord": "strum", "filterCutoffHz": 1e3, "filterResonance": 57, "filterEnvelope": "punch", "vibrato": "none", "algorithm": "1\u2190(2\u20023\u20024)", "feedbackType": "1\u21922", "feedbackAmplitude": 4, "feedbackEnvelope": "twang 3", "operators": [{ "frequency": "1\xD7", "amplitude": 9, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 9, "envelope": "steady" }, { "frequency": "3\xD7", "amplitude": 0, "envelope": "steady" }, { "frequency": "1\xD7", "amplitude": 0, "envelope": "steady" }] } },
            { name: "bass & lead", midiProgram: 87, generalMidi: true, settings: { "type": "chip", "transition": "hard", "effects": "reverb", "chord": "harmony", "filterCutoffHz": 4e3, "filterResonance": 86, "filterEnvelope": "twang 2", "wave": "sawtooth", "interval": "shimmer", "vibrato": "none" } },
            { name: "dubstep yoi yoi", midiProgram: 87, settings: { "type": "chip", "eqFilter": [{ "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 0.7071 }], "effects": ["note filter", "bitcrusher"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 594.6, "linearGain": 11.3137 }], "bitcrusherOctave": 1.5, "bitcrusherQuantization": 0, "transition": "slide", "fadeInSeconds": 0.0263, "fadeOutTicks": -3, "chord": "arpeggio", "wave": "sawtooth", "unison": "none", "envelopes": [{ "target": "noteFilterFreq", "envelope": "flare 2", "index": 0 }] } }
          ])
        },
        {
          name: "Picked String Presets",
          presets: toNameMap([
            { name: "pizzicato strings", midiProgram: 45, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "medium fade", "chord": "harmony", "filterCutoffHz": 1e3, "filterResonance": 14, "filterEnvelope": "twang 1", "vibrato": "none", "algorithm": "(1\u20022\u20023)\u21904", "feedbackType": "1\u27F2 2\u27F2 3\u27F2 4\u27F2", "feedbackAmplitude": 7, "feedbackEnvelope": "twang 1", "operators": [{ "frequency": "1\xD7", "amplitude": 14, "envelope": "custom" }, { "frequency": "3\xD7", "amplitude": 11, "envelope": "custom" }, { "frequency": "6\xD7", "amplitude": 9, "envelope": "custom" }, { "frequency": "~1\xD7", "amplitude": 10, "envelope": "steady" }] } },
            { name: "harp", midiProgram: 46, generalMidi: true, settings: { "type": "FM", "transition": "hard fade", "effects": "reverb", "chord": "strum", "filterCutoffHz": 2828, "filterResonance": 0, "filterEnvelope": "twang 1", "vibrato": "none", "algorithm": "1\u21903\u20032\u21904", "feedbackType": "3\u27F2", "feedbackAmplitude": 6, "feedbackEnvelope": "twang 2", "operators": [{ "frequency": "1\xD7", "amplitude": 15, "envelope": "custom" }, { "frequency": "4\xD7", "amplitude": 6, "envelope": "custom" }, { "frequency": "~2\xD7", "amplitude": 3, "envelope": "steady" }, { "frequency": "1\xD7", "amplitude": 6, "envelope": "steady" }] } },
            { name: "sitar", midiProgram: 104, generalMidi: true, settings: { "type": "FM", "transition": "hard fade", "effects": "reverb", "chord": "strum", "filterCutoffHz": 8e3, "filterResonance": 57, "filterEnvelope": "twang 2", "vibrato": "none", "algorithm": "1\u2190(2\u20023\u20024)", "feedbackType": "1\u27F2", "feedbackAmplitude": 0, "feedbackEnvelope": "steady", "operators": [{ "frequency": "1\xD7", "amplitude": 15, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 14, "envelope": "twang 3" }, { "frequency": "9\xD7", "amplitude": 3, "envelope": "twang 3" }, { "frequency": "16\xD7", "amplitude": 9, "envelope": "swell 3" }] } },
            { name: "banjo", midiProgram: 105, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "hard fade", "chord": "strum", "filterCutoffHz": 2828, "filterResonance": 14, "filterEnvelope": "twang 2", "vibrato": "none", "algorithm": "1\u2190(2\u20023\u21904)", "feedbackType": "2\u27F2", "feedbackAmplitude": 4, "feedbackEnvelope": "steady", "operators": [{ "frequency": "4\xD7", "amplitude": 14, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 10, "envelope": "steady" }, { "frequency": "11\xD7", "amplitude": 3, "envelope": "twang 3" }, { "frequency": "1\xD7", "amplitude": 11, "envelope": "steady" }] } },
            { name: "ukulele", midiProgram: 105, settings: { "type": "FM", "effects": "reverb", "transition": "hard fade", "chord": "strum", "filterCutoffHz": 2e3, "filterResonance": 0, "filterEnvelope": "twang 1", "vibrato": "none", "algorithm": "1\u2190(2\u20023\u21904)", "feedbackType": "3\u27F2", "feedbackAmplitude": 5, "feedbackEnvelope": "twang 1", "operators": [{ "frequency": "2\xD7", "amplitude": 14, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 6, "envelope": "steady" }, { "frequency": "9\xD7", "amplitude": 4, "envelope": "twang 2" }, { "frequency": "1\xD7", "amplitude": 11, "envelope": "steady" }] } },
            { name: "shamisen", midiProgram: 106, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "hard fade", "chord": "harmony", "filterCutoffHz": 8e3, "filterResonance": 14, "filterEnvelope": "twang 1", "vibrato": "none", "algorithm": "1\u2190(2\u20023\u21904)", "feedbackType": "3\u27F2", "feedbackAmplitude": 9, "feedbackEnvelope": "twang 3", "operators": [{ "frequency": "1\xD7", "amplitude": 15, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 12, "envelope": "steady" }, { "frequency": "16\xD7", "amplitude": 4, "envelope": "twang 3" }, { "frequency": "1\xD7", "amplitude": 7, "envelope": "steady" }] } },
            { name: "koto", midiProgram: 107, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "hard fade", "chord": "harmony", "filterCutoffHz": 4e3, "filterResonance": 14, "filterEnvelope": "twang 2", "vibrato": "none", "algorithm": "1\u21903\u20032\u21904", "feedbackType": "1\u27F2\u20032\u27F2", "feedbackAmplitude": 5, "feedbackEnvelope": "twang 2", "operators": [{ "frequency": "~1\xD7", "amplitude": 12, "envelope": "custom" }, { "frequency": "6\xD7", "amplitude": 10, "envelope": "custom" }, { "frequency": "4\xD7", "amplitude": 8, "envelope": "twang 3" }, { "frequency": "~2\xD7", "amplitude": 8, "envelope": "twang 3" }] } }
          ])
        },
        {
          name: "Distortion Presets",
          presets: toNameMap([
            { name: "overdrive guitar", midiProgram: 29, generalMidi: true, settings: { "type": "Picked String", "eqFilter": [{ "type": "low-pass", "cutoffHz": 4756.83, "linearGain": 0.7071 }, { "type": "high-pass", "cutoffHz": 210.22, "linearGain": 1 }, { "type": "low-pass", "cutoffHz": 5656.85, "linearGain": 1 }, { "type": "peak", "cutoffHz": 840.9, "linearGain": 0.5 }], "effects": ["note filter", "distortion"], "noteFilter": [{ "type": "high-pass", "cutoffHz": 297.3, "linearGain": 2 }, { "type": "low-pass", "cutoffHz": 2378.41, "linearGain": 0.7071 }], "distortion": 71, "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": 12, "chord": "strum", "harmonics": [86, 100, 100, 86, 86, 86, 86, 71, 71, 71, 71, 71, 71, 71, 71, 71, 71, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57], "unison": "none", "stringSustain": 71, "envelopes": [{ "target": "noteFilterFreq", "envelope": "note size", "index": 1 }] } },
            { name: "distortion guitar", midiProgram: 30, generalMidi: true, settings: { "type": "Picked String", "eqFilter": [{ "type": "low-pass", "cutoffHz": 4756.83, "linearGain": 0.7071 }, { "type": "high-pass", "cutoffHz": 210.22, "linearGain": 1 }, { "type": "low-pass", "cutoffHz": 5656.85, "linearGain": 1 }, { "type": "peak", "cutoffHz": 594.6, "linearGain": 0.3536 }, { "type": "peak", "cutoffHz": 1e3, "linearGain": 0.25 }], "effects": ["note filter", "distortion", "reverb"], "noteFilter": [{ "type": "high-pass", "cutoffHz": 353.55, "linearGain": 2 }, { "type": "low-pass", "cutoffHz": 2e3, "linearGain": 1 }], "distortion": 86, "reverb": 67, "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": 12, "chord": "strum", "harmonics": [86, 100, 100, 86, 86, 86, 86, 71, 71, 71, 71, 71, 71, 71, 71, 71, 71, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57, 57], "unison": "none", "stringSustain": 71, "envelopes": [{ "target": "noteFilterFreq", "envelope": "note size", "index": 1 }] } },
            { name: "charango synth", midiProgram: 84, generalMidi: true, settings: { "type": "FM", "eqFilter": [{ "type": "low-pass", "cutoffHz": 11313.71, "linearGain": 1 }], "effects": [], "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": -3, "chord": "strum", "algorithm": "1\u2190(2\u20023\u21904)", "feedbackType": "1\u21922\u21923\u21924", "feedbackAmplitude": 8, "operators": [{ "frequency": "3\xD7", "amplitude": 13 }, { "frequency": "~1\xD7", "amplitude": 5 }, { "frequency": "4\xD7", "amplitude": 6 }, { "frequency": "3\xD7", "amplitude": 7 }], "envelopes": [{ "target": "feedbackAmplitude", "envelope": "twang 3" }] } },
            { name: "guitar harmonics", midiProgram: 31, generalMidi: true, settings: { "type": "FM", "eqFilter": [{ "type": "low-pass", "cutoffHz": 4e3, "linearGain": 2 }], "effects": ["reverb"], "reverb": 33, "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": -3, "chord": "strum", "algorithm": "1\u2190(2\u20023)\u21904", "feedbackType": "1\u27F2", "feedbackAmplitude": 2, "operators": [{ "frequency": "4\xD7", "amplitude": 12 }, { "frequency": "16\xD7", "amplitude": 5 }, { "frequency": "1\xD7", "amplitude": 2 }, { "frequency": "~1\xD7", "amplitude": 12 }], "envelopes": [{ "target": "operatorAmplitude", "envelope": "swell 1", "index": 1 }, { "target": "operatorAmplitude", "envelope": "punch", "index": 2 }, { "target": "operatorAmplitude", "envelope": "twang 1", "index": 3 }] } },
            { name: "PWM overdrive", midiProgram: 29, settings: { "type": "PWM", "eqFilter": [{ "type": "low-pass", "cutoffHz": 5656.85, "linearGain": 1.4142 }], "effects": [], "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": -3, "chord": "strum", "pulseWidth": 17.67767, "envelopes": [{ "target": "pulseWidth", "envelope": "punch" }] } },
            { name: "PWM distortion", midiProgram: 30, settings: { "type": "PWM", "eqFilter": [{ "type": "low-pass", "cutoffHz": 3363.59, "linearGain": 2 }], "effects": ["vibrato"], "vibrato": "delayed", "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": -3, "chord": "strum", "pulseWidth": 50, "envelopes": [{ "target": "pulseWidth", "envelope": "swell 1" }] } },
            { name: "FM overdrive", midiProgram: 29, settings: { "type": "FM", "eqFilter": [{ "type": "low-pass", "cutoffHz": 4756.83, "linearGain": 1 }], "effects": ["reverb"], "reverb": 33, "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": -3, "chord": "strum", "algorithm": "1\u2190(2\u20023\u21904)", "feedbackType": "1\u21922", "feedbackAmplitude": 2, "operators": [{ "frequency": "~1\xD7", "amplitude": 15 }, { "frequency": "1\xD7", "amplitude": 12 }, { "frequency": "~2\xD7", "amplitude": 6 }, { "frequency": "1\xD7", "amplitude": 12 }], "envelopes": [{ "target": "operatorAmplitude", "envelope": "twang 1", "index": 2 }, { "target": "operatorAmplitude", "envelope": "swell 3", "index": 3 }, { "target": "feedbackAmplitude", "envelope": "punch" }] } },
            { name: "FM distortion", midiProgram: 30, settings: { "type": "FM", "eqFilter": [{ "type": "low-pass", "cutoffHz": 4e3, "linearGain": 2 }], "effects": ["reverb"], "reverb": 33, "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": -3, "chord": "strum", "algorithm": "1\u2190(2\u20023\u21904)", "feedbackType": "1\u21922", "feedbackAmplitude": 4, "operators": [{ "frequency": "~1\xD7", "amplitude": 15 }, { "frequency": "1\xD7", "amplitude": 11 }, { "frequency": "1\xD7", "amplitude": 9 }, { "frequency": "~2\xD7", "amplitude": 4 }], "envelopes": [{ "target": "operatorAmplitude", "envelope": "swell 1", "index": 2 }, { "target": "operatorAmplitude", "envelope": "swell 3", "index": 3 }] } }
          ])
        },
        {
          name: "Bellows Presets",
          presets: toNameMap([
            { name: "drawbar organ 1", midiProgram: 16, generalMidi: true, midiSubharmonicOctaves: 1, settings: { "type": "harmonics", "effects": "reverb", "transition": "hard", "chord": "harmony", "filterCutoffHz": 2828, "filterResonance": 14, "filterEnvelope": "steady", "interval": "union", "vibrato": "none", "harmonics": [86, 86, 0, 86, 0, 0, 0, 86, 0, 0, 0, 0, 0, 0, 0, 86, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] } },
            { name: "drawbar organ 2", midiProgram: 16, midiSubharmonicOctaves: 1, settings: { "type": "harmonics", "effects": "reverb", "transition": "hard", "chord": "harmony", "filterCutoffHz": 2828, "filterResonance": 14, "filterEnvelope": "steady", "interval": "union", "vibrato": "none", "harmonics": [86, 29, 71, 86, 71, 14, 0, 100, 0, 0, 0, 86, 0, 0, 0, 71, 0, 0, 0, 57, 0, 0, 0, 29, 0, 0, 0, 0] } },
            { name: "percussive organ", midiProgram: 17, generalMidi: true, midiSubharmonicOctaves: 1, settings: { "type": "FM", "volume": 0, "eqFilter": [], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "preset": 515, "effects": ["vibrato", "note filter", "chorus", "reverb"], "vibrato": "delayed", "vibratoDepth": 0.3, "vibratoDelay": 18.5, "vibratoSpeed": 10, "vibratoType": 0, "noteFilterType": true, "noteSimpleCut": 8, "noteSimplePeak": 1, "noteFilter": [{ "type": "low-pass", "cutoffHz": 5656.85, "linearGain": 0.5 }], "chorus": 100, "reverb": 0, "fadeInSeconds": 0, "fadeOutTicks": -3, "algorithm": "(1\u20022\u20023)\u21904", "feedbackType": "1\u27F2\u20032\u27F2\u20033\u27F2", "feedbackAmplitude": 2, "operators": [{ "frequency": "1\xD7", "amplitude": 9, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "4\xD7", "amplitude": 9, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "6\xD7", "amplitude": 9, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "2\xD7", "amplitude": 5, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "punch", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 0, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }, { "target": "feedbackAmplitude", "envelope": "flare", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 32, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }], "isDrum": false } },
            { name: "rock organ", midiProgram: 18, generalMidi: true, midiSubharmonicOctaves: 1, settings: { "type": "FM", "effects": "chorus & reverb", "transition": "hard", "chord": "harmony", "filterCutoffHz": 4e3, "filterResonance": 14, "filterEnvelope": "punch", "vibrato": "delayed", "algorithm": "(1\u20022\u20023)\u21904", "feedbackType": "1\u27F2\u20032\u27F2\u20033\u27F2", "feedbackAmplitude": 2, "feedbackEnvelope": "flare 1", "operators": [{ "frequency": "1\xD7", "amplitude": 9, "envelope": "custom" }, { "frequency": "4\xD7", "amplitude": 9, "envelope": "custom" }, { "frequency": "6\xD7", "amplitude": 9, "envelope": "custom" }, { "frequency": "2\xD7", "amplitude": 5, "envelope": "steady" }] } },
            { name: "pipe organ", midiProgram: 19, generalMidi: true, midiSubharmonicOctaves: 1, settings: { "type": "FM", "transition": "cross fade", "effects": "reverb", "chord": "harmony", "filterCutoffHz": 5657, "filterResonance": 43, "filterEnvelope": "steady", "vibrato": "none", "algorithm": "1\u20032\u20033\u20034", "feedbackType": "1\u27F2 2\u27F2 3\u27F2 4\u27F2", "feedbackAmplitude": 5, "feedbackEnvelope": "steady", "operators": [{ "frequency": "1\xD7", "amplitude": 8, "envelope": "custom" }, { "frequency": "2\xD7", "amplitude": 9, "envelope": "custom" }, { "frequency": "4\xD7", "amplitude": 9, "envelope": "custom" }, { "frequency": "8\xD7", "amplitude": 8, "envelope": "custom" }] } },
            { name: "reed organ", midiProgram: 20, generalMidi: true, settings: { "type": "harmonics", "effects": "reverb", "transition": "soft", "chord": "harmony", "filterCutoffHz": 2e3, "filterResonance": 29, "filterEnvelope": "steady", "interval": "union", "vibrato": "none", "harmonics": [71, 86, 100, 86, 71, 100, 57, 71, 71, 71, 43, 43, 43, 71, 43, 71, 57, 57, 57, 57, 57, 57, 57, 29, 43, 29, 29, 14] } },
            { name: "accordion", midiProgram: 21, generalMidi: true, settings: { "type": "chip", "effects": "reverb", "transition": "cross fade", "chord": "harmony", "filterCutoffHz": 5657, "filterResonance": 0, "filterEnvelope": "swell 1", "wave": "double saw", "interval": "honky tonk", "vibrato": "none" } },
            { name: "bandoneon", midiProgram: 23, generalMidi: true, settings: { "type": "harmonics", "effects": "reverb", "transition": "soft", "chord": "harmony", "filterCutoffHz": 4e3, "filterResonance": 29, "filterEnvelope": "swell 1", "interval": "hum", "vibrato": "none", "harmonics": [86, 86, 86, 57, 71, 86, 57, 71, 71, 71, 57, 43, 57, 43, 71, 43, 71, 57, 57, 43, 43, 43, 57, 43, 43, 29, 29, 29] } },
            { name: "bagpipe", midiProgram: 109, generalMidi: true, settings: { "type": "harmonics", "effects": "reverb", "transition": "cross fade", "chord": "harmony", "filterCutoffHz": 5657, "filterResonance": 43, "filterEnvelope": "punch", "interval": "hum", "vibrato": "none", "harmonics": [71, 86, 86, 100, 100, 86, 57, 100, 86, 71, 71, 71, 57, 57, 57, 71, 57, 71, 57, 71, 43, 57, 57, 43, 43, 43, 43, 43] } }
          ])
        },
        {
          name: "String Presets",
          presets: toNameMap([
            { name: "violin 1", midiProgram: 40, generalMidi: true, settings: { "type": "FM", "eqFilter": [{ "type": "low-pass", "cutoffHz": 4e3, "linearGain": 1.4142 }, { "type": "high-pass", "cutoffHz": 105.11, "linearGain": 0.3536 }], "effects": ["vibrato", "reverb"], "vibrato": "delayed", "reverb": 67, "transition": "normal", "fadeInSeconds": 0.0413, "fadeOutTicks": 6, "chord": "simultaneous", "algorithm": "(1\u20022)\u2190(3\u20024)", "feedbackType": "1\u21922", "feedbackAmplitude": 5, "operators": [{ "frequency": "4\xD7", "amplitude": 9 }, { "frequency": "3\xD7", "amplitude": 9 }, { "frequency": "2\xD7", "amplitude": 7 }, { "frequency": "7\xD7", "amplitude": 5 }], "envelopes": [{ "target": "operatorAmplitude", "envelope": "swell 1", "index": 3 }, { "target": "feedbackAmplitude", "envelope": "twang 3" }] } },
            { name: "viola", midiProgram: 41, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "cross fade", "chord": "harmony", "filterCutoffHz": 2e3, "filterResonance": 29, "filterEnvelope": "steady", "vibrato": "delayed", "algorithm": "(1\u20022\u20023)\u21904", "feedbackType": "1\u27F2\u20032\u27F2\u20033\u27F2", "feedbackAmplitude": 8, "feedbackEnvelope": "swell 1", "operators": [{ "frequency": "2\xD7", "amplitude": 11, "envelope": "custom" }, { "frequency": "7\xD7", "amplitude": 7, "envelope": "custom" }, { "frequency": "13\xD7", "amplitude": 4, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 5, "envelope": "steady" }] } },
            { name: "cello", midiProgram: 42, generalMidi: true, settings: { "type": "FM", "eqFilter": [{ "type": "low-pass", "cutoffHz": 4e3, "linearGain": 0.1768 }, { "type": "high-pass", "cutoffHz": 297.3, "linearGain": 0.7071 }, { "type": "peak", "cutoffHz": 4756.83, "linearGain": 5.6569 }], "effects": ["note filter", "reverb"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 16e3, "linearGain": 0.0884 }], "reverb": 67, "transition": "normal", "fadeInSeconds": 0.0125, "fadeOutTicks": 12, "chord": "simultaneous", "algorithm": "(1\u20022)\u21903\u21904", "feedbackType": "1\u27F2\u20032\u27F2", "feedbackAmplitude": 3, "operators": [{ "frequency": "16\xD7", "amplitude": 5 }, { "frequency": "~1\xD7", "amplitude": 10 }, { "frequency": "1\xD7", "amplitude": 9 }, { "frequency": "6\xD7", "amplitude": 3 }], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "swell 1" }, { "target": "operatorAmplitude", "envelope": "swell 1", "index": 3 }] } },
            { name: "contrabass", midiProgram: 43, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "cross fade", "chord": "harmony", "filterCutoffHz": 2e3, "filterResonance": 29, "filterEnvelope": "steady", "vibrato": "delayed", "algorithm": "(1\u20022)\u21903\u21904", "feedbackType": "1\u27F2\u20032\u27F2", "feedbackAmplitude": 0, "feedbackEnvelope": "steady", "operators": [{ "frequency": "16\xD7", "amplitude": 5, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 10, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 10, "envelope": "steady" }, { "frequency": "6\xD7", "amplitude": 3, "envelope": "swell 1" }] } },
            { name: "fiddle", midiProgram: 110, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "soft", "chord": "harmony", "filterCutoffHz": 2828, "filterResonance": 29, "filterEnvelope": "steady", "vibrato": "delayed", "algorithm": "(1\u20022)\u2190(3\u20024)", "feedbackType": "3\u27F2\u20034\u27F2", "feedbackAmplitude": 5, "feedbackEnvelope": "twang 1", "operators": [{ "frequency": "2\xD7", "amplitude": 10, "envelope": "custom" }, { "frequency": "8\xD7", "amplitude": 8, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 8, "envelope": "steady" }, { "frequency": "16\xD7", "amplitude": 3, "envelope": "steady" }] } },
            { name: "tremolo strings", midiProgram: 44, generalMidi: true, settings: { "type": "FM", "volume": 0, "eqFilter": [], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "effects": ["note filter", "chorus", "reverb"], "noteFilterType": true, "noteSimpleCut": 6, "noteSimplePeak": 0, "noteFilter": [{ "type": "low-pass", "cutoffHz": 11313.71, "linearGain": 0.1768 }], "chorus": 100, "reverb": 0, "fadeInSeconds": 0.0125, "fadeOutTicks": 72, "algorithm": "1\u20032\u20033\u20034", "feedbackType": "1\u21922\u21923\u21924", "feedbackAmplitude": 12, "operators": [{ "frequency": "1\xD7", "amplitude": 8, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "~2\xD7", "amplitude": 8, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "4\xD7", "amplitude": 8, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "7\xD7", "amplitude": 8, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "tremolo", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 4, "perEnvelopeLowerBound": 0.5, "perEnvelopeUpperBound": 1 }], "isDrum": false } },
            { name: "strings", midiProgram: 48, generalMidi: true, settings: { "type": "FM", "effects": "chorus & reverb", "transition": "cross fade", "chord": "harmony", "filterCutoffHz": 2828, "filterResonance": 43, "filterEnvelope": "steady", "vibrato": "none", "algorithm": "(1\u20022)\u2190(3\u20024)", "feedbackType": "4\u27F2", "feedbackAmplitude": 5, "feedbackEnvelope": "twang 3", "operators": [{ "frequency": "4\xD7", "amplitude": 9, "envelope": "custom" }, { "frequency": "3\xD7", "amplitude": 9, "envelope": "custom" }, { "frequency": "2\xD7", "amplitude": 7, "envelope": "steady" }, { "frequency": "7\xD7", "amplitude": 3, "envelope": "swell 1" }] } },
            { name: "slow strings", midiProgram: 49, generalMidi: true, settings: { "type": "FM", "effects": "chorus & reverb", "transition": "soft fade", "chord": "harmony", "filterCutoffHz": 1414, "filterResonance": 0, "filterEnvelope": "swell 2", "vibrato": "none", "algorithm": "(1\u20022)\u2190(3\u20024)", "feedbackType": "4\u27F2", "feedbackAmplitude": 6, "feedbackEnvelope": "flare 3", "operators": [{ "frequency": "4\xD7", "amplitude": 10, "envelope": "custom" }, { "frequency": "3\xD7", "amplitude": 10, "envelope": "custom" }, { "frequency": "2\xD7", "amplitude": 7, "envelope": "steady" }, { "frequency": "7\xD7", "amplitude": 4, "envelope": "swell 1" }] } },
            { name: "strings synth 1", midiProgram: 50, generalMidi: true, settings: { "type": "chip", "transition": "soft fade", "effects": "chorus & reverb", "chord": "harmony", "filterCutoffHz": 1414, "filterResonance": 43, "filterEnvelope": "steady", "wave": "sawtooth", "interval": "hum", "vibrato": "delayed" } },
            { name: "strings synth 2", midiProgram: 51, generalMidi: true, settings: { "type": "FM", "effects": "chorus & reverb", "transition": "soft fade", "chord": "harmony", "filterCutoffHz": 2e3, "filterResonance": 43, "filterEnvelope": "steady", "vibrato": "none", "algorithm": "1\u20032\u20033\u20034", "feedbackType": "1\u27F2 2\u27F2 3\u27F2 4\u27F2", "feedbackAmplitude": 12, "feedbackEnvelope": "swell 1", "operators": [{ "frequency": "3\xD7", "amplitude": 6, "envelope": "custom" }, { "frequency": "2\xD7", "amplitude": 7, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 8, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 9, "envelope": "custom" }] } },
            { name: "orchestra hit 1", midiProgram: 55, generalMidi: true, midiSubharmonicOctaves: 1, settings: { "type": "FM", "effects": "chorus & reverb", "transition": "hard fade", "chord": "harmony", "filterCutoffHz": 8e3, "filterResonance": 14, "filterEnvelope": "custom", "vibrato": "none", "algorithm": "1\u20032\u20033\u20034", "feedbackType": "1\u27F2 2\u27F2 3\u27F2 4\u27F2", "feedbackAmplitude": 14, "feedbackEnvelope": "twang 3", "operators": [{ "frequency": "1\xD7", "amplitude": 15, "envelope": "twang 3" }, { "frequency": "2\xD7", "amplitude": 15, "envelope": "flare 3" }, { "frequency": "4\xD7", "amplitude": 15, "envelope": "flare 2" }, { "frequency": "8\xD7", "amplitude": 15, "envelope": "flare 1" }] } },
            { name: "violin 2", midiProgram: 40, generalMidi: true, settings: { "type": "FM", "eqFilter": [{ "type": "low-pass", "cutoffHz": 2828, "linearGain": 1.4142 }, { "type": "high-pass", "cutoffHz": 105.11, "linearGain": 0.3536 }], "effects": ["vibrato", "reverb"], "vibrato": "light", "reverb": 67, "transition": "normal", "fadeInSeconds": 0.0413, "fadeOutTicks": 6, "chord": "simultaneous", "algorithm": "(1\u20022)\u2190(3\u20024)", "feedbackType": "4\u27F2", "feedbackAmplitude": 5, "feedbackEnvelope": "twang 3", "operators": [{ "frequency": "4\xD7", "amplitude": 15, "envelope": "custom" }, { "frequency": "3\xD7", "amplitude": 13, "envelope": "custom" }, { "frequency": "2\xD7", "amplitude": 7, "envelope": "steady" }, { "frequency": "7\xD7", "amplitude": 8, "envelope": "swell 1" }] } },
            { name: "orchestra hit 2", midiProgram: 55, midiSubharmonicOctaves: 1, settings: { "type": "FM", "volume": 0, "eqFilter": [], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "preset": 588, "effects": ["vibrato", "note filter", "chorus", "reverb"], "vibrato": "delayed", "vibratoDepth": 0.3, "vibratoDelay": 18.5, "vibratoSpeed": 10, "vibratoType": 0, "noteFilterType": true, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [{ "type": "low-pass", "cutoffHz": 19027.31, "linearGain": 0.5 }], "chorus": 100, "reverb": 0, "fadeInSeconds": 0.0125, "fadeOutTicks": 72, "algorithm": "1\u20032\u20033\u20034", "feedbackType": "1\u27F2 2\u27F2 3\u27F2 4\u27F2", "feedbackAmplitude": 14, "operators": [{ "frequency": "1\xD7", "amplitude": 12, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "2\xD7", "amplitude": 14, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "3\xD7", "amplitude": 12, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "4\xD7", "amplitude": 14, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "decay", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 10, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }], "isDrum": false } },
            { name: "supersaw string", midiProgram: 41, settings: { "type": "supersaw", "eqFilter": [{ "type": "low-pass", "cutoffHz": 2828.43, "linearGain": 1.4142 }, { "type": "low-pass", "cutoffHz": 3363.59, "linearGain": 0.1768 }], "effects": ["note filter", "reverb"], "noteFilter": [{ "type": "high-pass", "cutoffHz": 500, "linearGain": 0.1768 }], "reverb": 33, "fadeInSeconds": 0.0263, "fadeOutTicks": 6, "pulseWidth": 35.35534, "dynamism": 83, "spread": 8, "shape": 50, "envelopes": [{ "target": "noteFilterFreq", "envelope": "twang 1", "index": 0 }] } },
            { name: "supersaw string 2", midiProgram: 41, settings: { "type": "supersaw", "eqFilter": [{ "type": "low-pass", "cutoffHz": 2378.41, "linearGain": 0.5 }, { "type": "high-pass", "cutoffHz": 594.6, "linearGain": 0.25 }, { "type": "peak", "cutoffHz": 2e3, "linearGain": 2.8284 }, { "type": "peak", "cutoffHz": 4756.83, "linearGain": 2 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 2378.41, "linearGain": 0.5 }, { "type": "high-pass", "cutoffHz": 594.6, "linearGain": 0.25 }, { "type": "peak", "cutoffHz": 2e3, "linearGain": 2.8284 }, { "type": "peak", "cutoffHz": 4756.83, "linearGain": 2 }], "effects": ["note filter", "chorus", "reverb"], "noteFilterType": false, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [{ "type": "low-pass", "cutoffHz": 8e3, "linearGain": 1 }], "noteSubFilters0": [{ "type": "low-pass", "cutoffHz": 8e3, "linearGain": 1 }], "chorus": 57, "reverb": 42, "fadeInSeconds": 0.0575, "fadeOutTicks": -6, "pulseWidth": 50, "dynamism": 67, "spread": 58, "shape": 0, "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "punch" }, { "target": "pulseWidth", "envelope": "flare 2" }] } }
          ])
        },
        {
          name: "Vocal Presets",
          presets: toNameMap([
            { name: "choir soprano", midiProgram: 94, generalMidi: true, settings: { "type": "harmonics", "eqFilter": [{ "type": "low-pass", "cutoffHz": 2828.43, "linearGain": 2 }, { "type": "peak", "cutoffHz": 1189.21, "linearGain": 5.6569 }, { "type": "high-pass", "cutoffHz": 707.11, "linearGain": 2.8284 }, { "type": "peak", "cutoffHz": 2e3, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 840.9, "linearGain": 0.25 }, { "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 11.3137 }], "effects": ["vibrato", "chorus", "reverb"], "vibrato": "shaky", "chorus": 100, "reverb": 33, "fadeInSeconds": 0.0413, "fadeOutTicks": 24, "harmonics": [100, 100, 86, 57, 29, 29, 57, 71, 57, 29, 14, 14, 14, 29, 43, 57, 43, 29, 14, 14, 14, 14, 14, 14, 0, 0, 0, 0], "unison": "none", "envelopes": [] } },
            { name: "choir tenor", midiProgram: 52, generalMidi: true, settings: { "type": "harmonics", "eqFilter": [{ "type": "peak", "cutoffHz": 1e3, "linearGain": 11.3137 }, { "type": "peak", "cutoffHz": 707.11, "linearGain": 5.6569 }, { "type": "peak", "cutoffHz": 840.9, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 1681.79, "linearGain": 0.0884 }, { "type": "high-pass", "cutoffHz": 297.3, "linearGain": 0.7071 }, { "type": "low-pass", "cutoffHz": 2828.43, "linearGain": 11.3137 }], "effects": ["vibrato", "chorus", "reverb"], "vibrato": "shaky", "chorus": 100, "reverb": 67, "transition": "normal", "fadeInSeconds": 0.0413, "fadeOutTicks": 48, "chord": "simultaneous", "harmonics": [86, 100, 100, 86, 71, 57, 43, 29, 29, 29, 29, 43, 43, 43, 29, 29, 29, 29, 29, 29, 29, 29, 29, 14, 14, 14, 14, 14], "unison": "none", "envelopes": [] } },
            { name: "choir bass", midiProgram: 52, settings: { "type": "harmonics", "eqFilter": [{ "type": "low-pass", "cutoffHz": 2378.41, "linearGain": 11.3137 }, { "type": "peak", "cutoffHz": 594.6, "linearGain": 5.6569 }, { "type": "peak", "cutoffHz": 1681.79, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 707.11, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 840.9, "linearGain": 11.3137 }], "effects": ["vibrato", "chorus", "reverb"], "vibrato": "shaky", "chorus": 100, "reverb": 67, "transition": "normal", "fadeInSeconds": 0.0413, "fadeOutTicks": 48, "chord": "simultaneous", "harmonics": [71, 86, 100, 100, 86, 86, 57, 43, 29, 29, 29, 29, 29, 29, 43, 43, 43, 43, 43, 29, 29, 29, 29, 14, 14, 14, 14, 14], "unison": "none", "envelopes": [] } },
            { name: "solo soprano", midiProgram: 85, settings: { "type": "harmonics", "eqFilter": [{ "type": "low-pass", "cutoffHz": 2828.43, "linearGain": 2 }, { "type": "peak", "cutoffHz": 1189.21, "linearGain": 5.6569 }, { "type": "high-pass", "cutoffHz": 707.11, "linearGain": 2.8284 }, { "type": "peak", "cutoffHz": 2e3, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 840.9, "linearGain": 0.25 }], "effects": ["vibrato", "reverb"], "vibrato": "shaky", "reverb": 33, "fadeInSeconds": 0.0413, "fadeOutTicks": 12, "harmonics": [86, 100, 86, 43, 14, 14, 57, 71, 57, 14, 14, 14, 14, 14, 43, 57, 43, 14, 14, 14, 14, 14, 14, 14, 0, 0, 0, 0], "unison": "none", "envelopes": [] } },
            { name: "solo tenor", midiProgram: 85, settings: { "type": "harmonics", "eqFilter": [{ "type": "peak", "cutoffHz": 1e3, "linearGain": 11.3137 }, { "type": "peak", "cutoffHz": 707.11, "linearGain": 5.6569 }, { "type": "peak", "cutoffHz": 840.9, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 1681.79, "linearGain": 0.0884 }, { "type": "high-pass", "cutoffHz": 297.3, "linearGain": 0.7071 }, { "type": "low-pass", "cutoffHz": 2828.43, "linearGain": 11.3137 }], "effects": ["vibrato", "reverb"], "vibrato": "shaky", "reverb": 33, "fadeInSeconds": 0.0413, "fadeOutTicks": 12, "harmonics": [86, 100, 100, 86, 71, 57, 43, 29, 29, 29, 29, 43, 43, 43, 29, 29, 29, 29, 29, 29, 29, 29, 29, 14, 14, 14, 14, 14], "unison": "none", "envelopes": [] } },
            { name: "solo bass", midiProgram: 85, settings: { "type": "harmonics", "eqFilter": [{ "type": "low-pass", "cutoffHz": 2378.41, "linearGain": 5.6569 }, { "type": "peak", "cutoffHz": 594.6, "linearGain": 8 }, { "type": "peak", "cutoffHz": 1681.79, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 707.11, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 840.9, "linearGain": 8 }, { "type": "high-pass", "cutoffHz": 210.22, "linearGain": 1.4142 }], "effects": ["vibrato", "reverb"], "vibrato": "shaky", "reverb": 33, "transition": "normal", "fadeInSeconds": 0.0263, "fadeOutTicks": 12, "chord": "simultaneous", "harmonics": [71, 86, 100, 100, 86, 86, 57, 43, 29, 29, 29, 29, 29, 29, 43, 43, 43, 43, 43, 29, 29, 29, 29, 14, 14, 14, 14, 14], "unison": "none", "envelopes": [] } },
            { name: "voice ooh", midiProgram: 53, generalMidi: true, settings: { "type": "harmonics", "effects": "reverb", "transition": "soft", "chord": "harmony", "filterCutoffHz": 1414, "filterResonance": 57, "filterEnvelope": "steady", "interval": "union", "vibrato": "shaky", "harmonics": [100, 57, 43, 43, 14, 14, 0, 0, 0, 14, 29, 29, 14, 0, 14, 29, 29, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] } },
            { name: "voice synth", midiProgram: 54, generalMidi: true, settings: { "type": "chip", "transition": "medium fade", "effects": "chorus & reverb", "chord": "harmony", "filterCutoffHz": 4e3, "filterResonance": 57, "filterEnvelope": "steady", "wave": "rounded", "interval": "union", "vibrato": "light" } },
            { name: "vox synth lead", midiProgram: 85, generalMidi: true, settings: { "type": "FM", "effects": "chorus & reverb", "transition": "cross fade", "chord": "harmony", "filterCutoffHz": 2828, "filterResonance": 14, "filterEnvelope": "steady", "vibrato": "light", "algorithm": "(1\u20022\u20023)\u21904", "feedbackType": "1\u21922\u21923\u21924", "feedbackAmplitude": 2, "feedbackEnvelope": "punch", "operators": [{ "frequency": "2\xD7", "amplitude": 10, "envelope": "custom" }, { "frequency": "9\xD7", "amplitude": 5, "envelope": "custom" }, { "frequency": "20\xD7", "amplitude": 1, "envelope": "custom" }, { "frequency": "~1\xD7", "amplitude": 4, "envelope": "steady" }] } },
            { name: "tiny robot", midiProgram: 85, settings: { "type": "FM", "eqFilter": [], "effects": ["vibrato", "reverb"], "vibrato": "delayed", "reverb": 33, "transition": "slide", "fadeInSeconds": 0.0263, "fadeOutTicks": -3, "chord": "simultaneous", "algorithm": "1\u2190(2\u20023\u20024)", "feedbackType": "1\u27F2", "feedbackAmplitude": 2, "operators": [{ "frequency": "2\xD7", "amplitude": 15 }, { "frequency": "1\xD7", "amplitude": 7 }, { "frequency": "~1\xD7", "amplitude": 7 }, { "frequency": "1\xD7", "amplitude": 0 }], "envelopes": [{ "target": "operatorAmplitude", "envelope": "punch", "index": 1 }, { "target": "feedbackAmplitude", "envelope": "twang 3" }] } },
            { name: "yowie", midiProgram: 85, settings: { "type": "FM", "volume": 0, "eqFilter": [], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "effects": ["note filter", "reverb"], "noteFilterType": true, "noteSimpleCut": 6, "noteSimplePeak": 6, "noteFilter": [{ "type": "low-pass", "cutoffHz": 2e3, "linearGain": 4 }], "reverb": 0, "fadeInSeconds": 0.0413, "fadeOutTicks": 6, "algorithm": "1\u21902\u2190(3\u20024)", "feedbackType": "1\u27F2", "feedbackAmplitude": 12, "operators": [{ "frequency": "2\xD7", "amplitude": 12, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "16\xD7", "amplitude": 5, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 5, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "tremolo", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 2, "perEnvelopeLowerBound": 0.5, "perEnvelopeUpperBound": 1 }, { "target": "feedbackAmplitude", "envelope": "tremolo", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 1, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }], "isDrum": false } },
            { name: "mouse", midiProgram: 85, settings: { "type": "FM", "eqFilter": [], "effects": ["vibrato", "reverb"], "vibrato": "light", "reverb": 33, "transition": "slide in pattern", "fadeInSeconds": 0.0263, "fadeOutTicks": -3, "chord": "simultaneous", "algorithm": "1\u20032\u20033\u20034", "feedbackType": "1\u27F2\u20032\u27F2", "feedbackAmplitude": 5, "operators": [{ "frequency": "2\xD7", "amplitude": 13 }, { "frequency": "5\xD7", "amplitude": 12 }, { "frequency": "1\xD7", "amplitude": 0 }, { "frequency": "1\xD7", "amplitude": 0 }], "envelopes": [{ "target": "noteVolume", "envelope": "note size" }, { "target": "feedbackAmplitude", "envelope": "flare 2" }] } },
            { name: "gumdrop", midiProgram: 85, settings: { "type": "FM", "effects": "reverb", "transition": "hard", "chord": "harmony", "filterCutoffHz": 8e3, "filterResonance": 0, "filterEnvelope": "steady", "vibrato": "none", "algorithm": "(1\u20022\u20023)\u21904", "feedbackType": "1\u27F2\u20032\u27F2\u20033\u27F2", "feedbackAmplitude": 0, "feedbackEnvelope": "steady", "operators": [{ "frequency": "2\xD7", "amplitude": 15, "envelope": "punch" }, { "frequency": "4\xD7", "amplitude": 15, "envelope": "punch" }, { "frequency": "7\xD7", "amplitude": 15, "envelope": "punch" }, { "frequency": "1\xD7", "amplitude": 10, "envelope": "twang 1" }] } },
            { name: "echo drop", midiProgram: 102, generalMidi: true, settings: { "type": "FM", "effects": "chorus & reverb", "transition": "hard", "chord": "harmony", "filterCutoffHz": 2828, "filterResonance": 14, "filterEnvelope": "punch", "vibrato": "none", "algorithm": "1\u2190(2\u20023\u21904)", "feedbackType": "1\u27F2", "feedbackAmplitude": 2, "feedbackEnvelope": "steady", "operators": [{ "frequency": "~2\xD7", "amplitude": 11, "envelope": "custom" }, { "frequency": "~1\xD7", "amplitude": 5, "envelope": "steady" }, { "frequency": "11\xD7", "amplitude": 2, "envelope": "steady" }, { "frequency": "16\xD7", "amplitude": 5, "envelope": "swell 3" }] } },
            { name: "dark choir", midiProgram: 85, settings: { "type": "spectrum", "effects": "reverb", "transition": "soft", "chord": "harmony", "filterCutoffHz": 4e3, "filterResonance": 29, "filterEnvelope": "swell 1", "spectrum": [43, 14, 14, 14, 14, 14, 14, 100, 14, 14, 14, 57, 14, 14, 100, 14, 43, 14, 43, 14, 14, 43, 14, 29, 14, 29, 14, 14, 29, 0] } }
          ])
        },
        {
          name: "Brass Presets",
          presets: toNameMap([
            { name: "trumpet", midiProgram: 56, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "soft", "chord": "harmony", "filterCutoffHz": 2828, "filterResonance": 43, "filterEnvelope": "steady", "vibrato": "none", "algorithm": "1\u2190(2\u20023\u20024)", "feedbackType": "1\u27F2", "feedbackAmplitude": 9, "feedbackEnvelope": "swell 1", "operators": [{ "frequency": "1\xD7", "amplitude": 14, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 8, "envelope": "steady" }, { "frequency": "1\xD7", "amplitude": 5, "envelope": "flare 2" }, { "frequency": "1\xD7", "amplitude": 0, "envelope": "steady" }] } },
            { name: "trombone", midiProgram: 57, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "soft", "chord": "harmony", "filterCutoffHz": 2e3, "filterResonance": 43, "filterEnvelope": "steady", "vibrato": "none", "algorithm": "1\u2190(2\u20023\u20024)", "feedbackType": "2\u27F2", "feedbackAmplitude": 7, "feedbackEnvelope": "swell 1", "operators": [{ "frequency": "1\xD7", "amplitude": 14, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 8, "envelope": "steady" }, { "frequency": "1\xD7", "amplitude": 0, "envelope": "steady" }, { "frequency": "1\xD7", "amplitude": 0, "envelope": "steady" }] } },
            { name: "tuba", midiProgram: 58, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "soft", "chord": "harmony", "filterCutoffHz": 2e3, "filterResonance": 43, "filterEnvelope": "steady", "vibrato": "none", "algorithm": "1\u2190(2\u20023\u20024)", "feedbackType": "2\u27F2", "feedbackAmplitude": 8, "feedbackEnvelope": "swell 1", "operators": [{ "frequency": "1\xD7", "amplitude": 14, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 6, "envelope": "steady" }, { "frequency": "1\xD7", "amplitude": 0, "envelope": "steady" }, { "frequency": "1\xD7", "amplitude": 0, "envelope": "steady" }] } },
            { name: "muted trumpet", midiProgram: 59, generalMidi: true, settings: { "type": "FM", "eqFilter": [{ "type": "low-pass", "cutoffHz": 8e3, "linearGain": 2.8284 }, { "type": "peak", "cutoffHz": 4e3, "linearGain": 2.8284 }], "effects": ["note filter", "reverb"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 3363.59, "linearGain": 1 }], "reverb": 33, "fadeInSeconds": 0.0263, "fadeOutTicks": -3, "algorithm": "1\u2190(2\u20023\u21904)", "feedbackType": "1\u27F2", "feedbackAmplitude": 5, "operators": [{ "frequency": "1\xD7", "amplitude": 13 }, { "frequency": "1\xD7", "amplitude": 5 }, { "frequency": "9\xD7", "amplitude": 5 }, { "frequency": "13\xD7", "amplitude": 7 }], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "swell 1" }, { "target": "operatorAmplitude", "envelope": "swell 1", "index": 3 }, { "target": "feedbackAmplitude", "envelope": "flare 2" }] } },
            { name: "french horn", midiProgram: 60, generalMidi: true, settings: { "type": "FM", "eqFilter": [{ "type": "low-pass", "cutoffHz": 4e3, "linearGain": 1 }, { "type": "peak", "cutoffHz": 2378.41, "linearGain": 2.8284 }], "effects": ["reverb"], "reverb": 33, "fadeInSeconds": 0.0263, "fadeOutTicks": -3, "algorithm": "1\u21903\u20032\u21904", "feedbackType": "1\u27F2\u20032\u27F2", "feedbackAmplitude": 3, "operators": [{ "frequency": "1\xD7", "amplitude": 15 }, { "frequency": "1\xD7", "amplitude": 12 }, { "frequency": "1\xD7", "amplitude": 10 }, { "frequency": "~1\xD7", "amplitude": 8 }], "envelopes": [{ "target": "operatorAmplitude", "envelope": "swell 1", "index": 2 }, { "target": "operatorAmplitude", "envelope": "flare 2", "index": 3 }, { "target": "feedbackAmplitude", "envelope": "swell 1" }] } },
            { name: "brass section", midiProgram: 61, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "soft", "chord": "harmony", "filterCutoffHz": 2828, "filterResonance": 14, "filterEnvelope": "punch", "vibrato": "none", "algorithm": "1\u21903\u20032\u21904", "feedbackType": "1\u27F2\u20032\u27F2", "feedbackAmplitude": 6, "feedbackEnvelope": "swell 1", "operators": [{ "frequency": "1\xD7", "amplitude": 14, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 12, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 10, "envelope": "swell 1" }, { "frequency": "~1\xD7", "amplitude": 10, "envelope": "swell 1" }] } },
            { name: "brass synth 1", midiProgram: 62, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "soft", "chord": "harmony", "filterCutoffHz": 4e3, "filterResonance": 29, "filterEnvelope": "steady", "vibrato": "none", "algorithm": "1\u21903\u20032\u21904", "feedbackType": "1\u27F2\u20032\u27F2", "feedbackAmplitude": 11, "feedbackEnvelope": "swell 1", "operators": [{ "frequency": "1\xD7", "amplitude": 14, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 14, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 12, "envelope": "flare 1" }, { "frequency": "~1\xD7", "amplitude": 8, "envelope": "flare 2" }] } },
            { name: "brass synth 2", midiProgram: 63, generalMidi: true, settings: { "type": "FM", "transition": "soft", "effects": "reverb", "chord": "harmony", "filterCutoffHz": 4e3, "filterResonance": 43, "filterEnvelope": "twang 3", "vibrato": "none", "algorithm": "1\u21903\u20032\u21904", "feedbackType": "1\u27F2\u20032\u27F2", "feedbackAmplitude": 9, "feedbackEnvelope": "swell 1", "operators": [{ "frequency": "1\xD7", "amplitude": 15, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 15, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 10, "envelope": "flare 1" }, { "frequency": "~1\xD7", "amplitude": 7, "envelope": "flare 1" }] } },
            { name: "pulse brass", midiProgram: 62, settings: { "type": "PWM", "effects": "reverb", "transition": "soft", "chord": "harmony", "filterCutoffHz": 4e3, "filterResonance": 29, "filterEnvelope": "swell 1", "pulseWidth": 50, "pulseEnvelope": "flare 3", "vibrato": "none" } }
          ])
        },
        {
          name: "Reed Presets",
          presets: toNameMap([
            { name: "soprano sax", midiProgram: 64, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "soft", "chord": "harmony", "filterCutoffHz": 2e3, "filterResonance": 29, "filterEnvelope": "steady", "vibrato": "none", "algorithm": "1\u21902\u21903\u21904", "feedbackType": "4\u27F2", "feedbackAmplitude": 5, "feedbackEnvelope": "swell 1", "operators": [{ "frequency": "1\xD7", "amplitude": 13, "envelope": "custom" }, { "frequency": "4\xD7", "amplitude": 4, "envelope": "swell 1" }, { "frequency": "1\xD7", "amplitude": 7, "envelope": "steady" }, { "frequency": "5\xD7", "amplitude": 4, "envelope": "punch" }] } },
            { name: "alto sax", midiProgram: 65, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "soft", "chord": "harmony", "filterCutoffHz": 2e3, "filterResonance": 43, "filterEnvelope": "steady", "vibrato": "none", "algorithm": "1\u2190(2\u20023\u21904)", "feedbackType": "1\u27F2", "feedbackAmplitude": 4, "feedbackEnvelope": "punch", "operators": [{ "frequency": "1\xD7", "amplitude": 13, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 6, "envelope": "steady" }, { "frequency": "4\xD7", "amplitude": 6, "envelope": "swell 1" }, { "frequency": "1\xD7", "amplitude": 12, "envelope": "steady" }] } },
            { name: "tenor sax", midiProgram: 66, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "soft", "chord": "harmony", "filterCutoffHz": 2828, "filterResonance": 29, "filterEnvelope": "steady", "vibrato": "none", "algorithm": "1\u21902\u21903\u21904", "feedbackType": "1\u27F2", "feedbackAmplitude": 6, "feedbackEnvelope": "swell 1", "operators": [{ "frequency": "2\xD7", "amplitude": 12, "envelope": "custom" }, { "frequency": "3\xD7", "amplitude": 7, "envelope": "steady" }, { "frequency": "1\xD7", "amplitude": 3, "envelope": "steady" }, { "frequency": "8\xD7", "amplitude": 3, "envelope": "steady" }] } },
            { name: "baritone sax", midiProgram: 67, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "soft", "chord": "harmony", "filterCutoffHz": 2828, "filterResonance": 0, "filterEnvelope": "steady", "vibrato": "none", "algorithm": "1\u2190(2\u20023\u21904)", "feedbackType": "1\u27F2", "feedbackAmplitude": 2, "feedbackEnvelope": "swell 2", "operators": [{ "frequency": "1\xD7", "amplitude": 12, "envelope": "custom" }, { "frequency": "8\xD7", "amplitude": 4, "envelope": "steady" }, { "frequency": "4\xD7", "amplitude": 5, "envelope": "steady" }, { "frequency": "1\xD7", "amplitude": 4, "envelope": "punch" }] } },
            { name: "sax synth", midiProgram: 64, settings: { "type": "FM", "effects": "reverb", "transition": "soft", "chord": "harmony", "filterCutoffHz": 8e3, "filterResonance": 0, "filterEnvelope": "steady", "vibrato": "light", "algorithm": "1\u2190(2\u20023\u20024)", "feedbackType": "1\u27F2\u20032\u27F2", "feedbackAmplitude": 4, "feedbackEnvelope": "steady", "operators": [{ "frequency": "4\xD7", "amplitude": 15, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 15, "envelope": "steady" }, { "frequency": "1\xD7", "amplitude": 0, "envelope": "steady" }, { "frequency": "1\xD7", "amplitude": 0, "envelope": "steady" }] } },
            { name: "shehnai", midiProgram: 111, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "soft", "chord": "harmony", "filterCutoffHz": 8e3, "filterResonance": 0, "filterEnvelope": "steady", "vibrato": "light", "algorithm": "1\u2190(2\u20023\u20024)", "feedbackType": "1\u27F2", "feedbackAmplitude": 3, "feedbackEnvelope": "steady", "operators": [{ "frequency": "4\xD7", "amplitude": 15, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 8, "envelope": "steady" }, { "frequency": "1\xD7", "amplitude": 0, "envelope": "steady" }, { "frequency": "1\xD7", "amplitude": 0, "envelope": "steady" }] } },
            { name: "oboe", midiProgram: 68, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "cross fade", "chord": "harmony", "filterCutoffHz": 4e3, "filterResonance": 14, "filterEnvelope": "swell 1", "vibrato": "none", "algorithm": "1\u20032\u2190(3\u20024)", "feedbackType": "2\u27F2", "feedbackAmplitude": 2, "feedbackEnvelope": "tremolo5", "operators": [{ "frequency": "1\xD7", "amplitude": 7, "envelope": "custom" }, { "frequency": "4\xD7", "amplitude": 12, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 6, "envelope": "steady" }, { "frequency": "6\xD7", "amplitude": 2, "envelope": "steady" }] } },
            { name: "english horn", midiProgram: 69, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "cross fade", "chord": "harmony", "filterCutoffHz": 2e3, "filterResonance": 14, "filterEnvelope": "steady", "vibrato": "none", "algorithm": "1\u20032\u2190(3\u20024)", "feedbackType": "2\u27F2", "feedbackAmplitude": 2, "feedbackEnvelope": "steady", "operators": [{ "frequency": "4\xD7", "amplitude": 12, "envelope": "custom" }, { "frequency": "2\xD7", "amplitude": 10, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 8, "envelope": "punch" }, { "frequency": "8\xD7", "amplitude": 4, "envelope": "steady" }] } },
            { name: "bassoon", midiProgram: 70, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "soft", "chord": "harmony", "filterCutoffHz": 707, "filterResonance": 57, "filterEnvelope": "steady", "vibrato": "none", "algorithm": "1\u2190(2\u20023\u21904)", "feedbackType": "1\u27F2", "feedbackAmplitude": 2, "feedbackEnvelope": "steady", "operators": [{ "frequency": "2\xD7", "amplitude": 11, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 6, "envelope": "steady" }, { "frequency": "6\xD7", "amplitude": 6, "envelope": "swell 1" }, { "frequency": "1\xD7", "amplitude": 0, "envelope": "steady" }] } },
            { name: "clarinet", midiProgram: 71, generalMidi: true, settings: { "type": "harmonics", "effects": "reverb", "transition": "soft", "chord": "harmony", "filterCutoffHz": 1414, "filterResonance": 14, "filterEnvelope": "steady", "interval": "union", "vibrato": "none", "harmonics": [100, 43, 86, 57, 86, 71, 86, 71, 71, 71, 71, 71, 71, 43, 71, 71, 57, 57, 57, 57, 57, 57, 43, 43, 43, 29, 14, 0] } },
            { name: "harmonica", midiProgram: 22, generalMidi: true, settings: { "type": "FM", "volume": 0, "eqFilter": [], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "preset": 778, "effects": ["note filter", "reverb"], "noteFilterType": true, "noteSimpleCut": 9, "noteSimplePeak": 2, "noteFilter": [{ "type": "low-pass", "cutoffHz": 7231.23, "linearGain": 1 }], "noteSubFilters1": [{ "type": "low-pass", "cutoffHz": 7231.23, "linearGain": 1 }], "reverb": 0, "fadeInSeconds": 0.0263, "fadeOutTicks": -3, "algorithm": "1\u2190(2\u20023\u21904)", "feedbackType": "1\u27F2", "feedbackAmplitude": 9, "operators": [{ "frequency": "2\xD7", "amplitude": 14, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "~2\xD7", "amplitude": 2, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "swell", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 32, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }, { "target": "operatorAmplitude", "envelope": "twang", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 2, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "index": 2 }, { "target": "feedbackAmplitude", "envelope": "tremolo2", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 2, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }], "isDrum": false } }
          ])
        },
        {
          name: "Flute Presets",
          presets: toNameMap([
            { name: "flute 1", midiProgram: 73, generalMidi: true, settings: { "type": "FM", "volume": 0, "eqFilter": [{ "type": "low-pass", "cutoffHz": 9656.85, "linearGain": 0.5 }], "eqFilterType": true, "eqSimpleCut": 9, "eqSimplePeak": 1, "envelopeSpeed": 12, "discreteEnvelope": false, "preset": 832, "eqSubFilters1": [], "effects": ["reverb"], "reverb": 0, "fadeInSeconds": 0.0263, "fadeOutTicks": -3, "algorithm": "1\u2190(2\u20023\u20024)", "feedbackType": "4\u27F2", "feedbackAmplitude": 7, "operators": [{ "frequency": "1\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "2\xD7", "amplitude": 4, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 3, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "~1\xD7", "amplitude": 1, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [{ "target": "operatorAmplitude", "envelope": "punch", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 0, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "index": 3 }, { "target": "feedbackAmplitude", "envelope": "decay", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 7, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }], "isDrum": false } },
            { name: "recorder", midiProgram: 74, generalMidi: true, settings: { "type": "harmonics", "effects": "reverb", "transition": "soft", "chord": "harmony", "filterCutoffHz": 4e3, "filterResonance": 29, "filterEnvelope": "swell 2", "interval": "union", "vibrato": "none", "harmonics": [100, 43, 57, 43, 57, 43, 43, 43, 43, 43, 43, 43, 43, 29, 29, 29, 29, 29, 29, 29, 14, 14, 14, 14, 14, 14, 14, 0] } },
            { name: "whistle", midiProgram: 78, generalMidi: true, settings: { "type": "harmonics", "effects": "chorus & reverb", "transition": "soft", "chord": "harmony", "filterCutoffHz": 2e3, "filterResonance": 43, "filterEnvelope": "steady", "interval": "union", "vibrato": "delayed", "harmonics": [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] } },
            { name: "ocarina", midiProgram: 79, generalMidi: true, settings: { "type": "harmonics", "effects": "reverb", "transition": "soft", "chord": "harmony", "filterCutoffHz": 2828, "filterResonance": 43, "filterEnvelope": "steady", "interval": "union", "vibrato": "none", "harmonics": [100, 14, 57, 14, 29, 14, 14, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] } },
            { name: "piccolo", midiProgram: 72, generalMidi: true, settings: { "type": "FM", "effects": "reverb", "transition": "soft", "chord": "harmony", "filterCutoffHz": 5657, "filterResonance": 43, "filterEnvelope": "steady", "vibrato": "none", "algorithm": "1\u21903\u20032\u21904", "feedbackType": "4\u27F2", "feedbackAmplitude": 15, "feedbackEnvelope": "twang 1", "operators": [{ "frequency": "1\xD7", "amplitude": 15, "envelope": "custom" }, { "frequency": "1\xD7", "amplitude": 10, "envelope": "custom" }, { "frequency": "~2\xD7", "amplitude": 3, "envelope": "punch" }, { "frequency": "~1\xD7", "amplitude": 5, "envelope": "punch" }] } },
            { name: "shakuhachi", midiProgram: 77, generalMidi: true, settings: { "type": "FM", "effects": "chorus & reverb", "transition": "soft", "chord": "harmony", "filterCutoffHz": 4e3, "filterResonance": 14, "filterEnvelope": "steady", "vibrato": "delayed", "algorithm": "1\u2190(2\u20023\u21904)", "feedbackType": "3\u21924", "feedbackAmplitude": 15, "feedbackEnvelope": "steady", "operators": [{ "frequency": "1\xD7", "amplitude": 15, "envelope": "custom" }, { "frequency": "2\xD7", "amplitude": 3, "envelope": "punch" }, { "frequency": "~1\xD7", "amplitude": 4, "envelope": "twang 1" }, { "frequency": "20\xD7", "amplitude": 15, "envelope": "steady" }] } },
            { name: "pan flute", midiProgram: 75, generalMidi: true, settings: { "type": "spectrum", "eqFilter": [{ "type": "low-pass", "cutoffHz": 9513.66, "linearGain": 5.6569 }], "effects": ["note filter", "reverb"], "noteFilter": [{ "type": "high-pass", "cutoffHz": 4756.83, "linearGain": 0.7071 }], "reverb": 33, "fadeInSeconds": 0.0125, "fadeOutTicks": -3, "spectrum": [100, 0, 0, 0, 0, 0, 0, 14, 0, 0, 0, 71, 0, 0, 14, 0, 57, 0, 29, 14, 29, 14, 14, 29, 14, 29, 14, 14, 29, 14], "envelopes": [{ "target": "noteFilterFreq", "envelope": "twang 1", "index": 0 }, { "target": "noteVolume", "envelope": "punch" }] } },
            { name: "blown bottle", midiProgram: 76, generalMidi: true, settings: { "type": "FM", "effects": "chorus & reverb", "transition": "cross fade", "chord": "harmony", "filterCutoffHz": 5657, "filterResonance": 57, "filterEnvelope": "steady", "vibrato": "none", "algorithm": "1\u20032\u20033\u20034", "feedbackType": "1\u27F2 2\u27F2 3\u27F2 4\u27F2", "feedbackAmplitude": 7, "feedbackEnvelope": "twang 1", "operators": [{ "frequency": "1\xD7", "amplitude": 15, "envelope": "custom" }, { "frequency": "3\xD7", "amplitude": 4, "envelope": "custom" }, { "frequency": "6\xD7", "amplitude": 2, "envelope": "custom" }, { "frequency": "11\xD7", "amplitude": 2, "envelope": "custom" }] } },
            { name: "calliope", midiProgram: 82, generalMidi: true, settings: { "type": "spectrum", "transition": "cross fade", "effects": "reverb", "chord": "harmony", "filterCutoffHz": 5657, "filterResonance": 14, "filterEnvelope": "steady", "spectrum": [100, 0, 0, 0, 0, 0, 0, 86, 0, 0, 0, 71, 0, 0, 57, 0, 43, 0, 29, 14, 14, 29, 14, 14, 14, 14, 14, 14, 14, 14] } },
            { name: "chiffer", midiProgram: 83, generalMidi: true, settings: { "type": "spectrum", "effects": "reverb", "transition": "hard", "chord": "harmony", "filterCutoffHz": 2e3, "filterResonance": 14, "filterEnvelope": "punch", "spectrum": [86, 0, 0, 0, 0, 0, 0, 71, 0, 0, 0, 71, 0, 0, 57, 0, 57, 0, 43, 14, 14, 43, 14, 29, 14, 29, 29, 29, 29, 14] } },
            { name: "breath noise", midiProgram: 121, generalMidi: true, settings: { "type": "spectrum", "eqFilter": [], "effects": ["chord type", "note filter", "reverb"], "chord": "strum", "noteFilter": [{ "type": "high-pass", "cutoffHz": 840.9, "linearGain": 0.3536 }, { "type": "low-pass", "cutoffHz": 16e3, "linearGain": 0.3536 }], "reverb": 33, "fadeInSeconds": 0.0413, "fadeOutTicks": 12, "spectrum": [71, 0, 0, 0, 0, 0, 0, 29, 0, 0, 0, 71, 0, 0, 29, 0, 100, 29, 14, 29, 100, 29, 100, 14, 14, 71, 0, 29, 0, 0], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "twang 1" }] } },
            { name: "flute 2", midiProgram: 73, generalMidi: true, settings: { "type": "harmonics", "effects": "reverb", "transition": "seamless", "chord": "harmony", "filterCutoffHz": 1414, "filterResonance": 14, "filterEnvelope": "steady", "interval": "union", "vibrato": "delayed", "harmonics": [100, 43, 86, 57, 86, 71, 86, 71, 71, 71, 71, 71, 71, 43, 71, 71, 57, 57, 57, 57, 57, 57, 43, 43, 43, 29, 14, 0] } }
          ])
        },
        {
          name: "Pad Presets",
          presets: toNameMap([
            { name: "new age pad", midiProgram: 88, generalMidi: true, settings: { "type": "FM", "eqFilter": [], "effects": ["chorus"], "chorus": 100, "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": 48, "chord": "simultaneous", "algorithm": "1\u2190(2\u20023\u21904)", "feedbackType": "1\u27F2\u20032\u27F2", "feedbackAmplitude": 3, "operators": [{ "frequency": "2\xD7", "amplitude": 14 }, { "frequency": "~1\xD7", "amplitude": 4 }, { "frequency": "6\xD7", "amplitude": 3 }, { "frequency": "13\xD7", "amplitude": 3 }], "envelopes": [{ "target": "operatorAmplitude", "envelope": "swell 2", "index": 1 }, { "target": "operatorAmplitude", "envelope": "twang 3", "index": 2 }, { "target": "feedbackAmplitude", "envelope": "swell 3" }] } },
            { name: "warm pad", midiProgram: 89, generalMidi: true, settings: { "type": "FM", "eqFilter": [], "effects": ["note filter", "chorus"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 3363.59, "linearGain": 1 }], "chorus": 100, "transition": "normal", "fadeInSeconds": 0.0575, "fadeOutTicks": 96, "chord": "simultaneous", "algorithm": "1\u2190(2\u20023\u20024)", "feedbackType": "1\u27F2", "feedbackAmplitude": 7, "operators": [{ "frequency": "1\xD7", "amplitude": 14 }, { "frequency": "1\xD7", "amplitude": 6 }, { "frequency": "1\xD7", "amplitude": 0 }, { "frequency": "1\xD7", "amplitude": 0 }], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "swell 3" }, { "target": "operatorAmplitude", "envelope": "swell 1", "index": 1 }] } },
            { name: "polysynth pad", midiProgram: 90, generalMidi: true, settings: { "type": "chip", "eqFilter": [], "effects": ["vibrato", "note filter", "chorus"], "vibrato": "delayed", "noteFilter": [{ "type": "low-pass", "cutoffHz": 2828.43, "linearGain": 1 }], "chorus": 100, "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": 48, "chord": "simultaneous", "wave": "sawtooth", "unison": "honky tonk", "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "twang 3" }] } },
            { name: "space voice pad", midiProgram: 91, generalMidi: true, settings: { "type": "FM", "eqFilter": [{ "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 5.6569 }, { "type": "peak", "cutoffHz": 2828.43, "linearGain": 5.6569 }, { "type": "peak", "cutoffHz": 1414.21, "linearGain": 0.1768 }], "effects": ["chorus"], "chorus": 100, "transition": "normal", "fadeInSeconds": 0.0125, "fadeOutTicks": 72, "chord": "simultaneous", "algorithm": "(1\u20022\u20023)\u21904", "feedbackType": "1\u27F2 2\u27F2 3\u27F2 4\u27F2", "feedbackAmplitude": 5, "operators": [{ "frequency": "1\xD7", "amplitude": 10 }, { "frequency": "2\xD7", "amplitude": 8 }, { "frequency": "3\xD7", "amplitude": 7 }, { "frequency": "11\xD7", "amplitude": 2 }], "envelopes": [{ "target": "operatorAmplitude", "envelope": "punch", "index": 3 }, { "target": "feedbackAmplitude", "envelope": "swell 2" }] } },
            { name: "bowed glass pad", midiProgram: 92, generalMidi: true, settings: { "type": "FM", "eqFilter": [], "effects": ["note filter"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 4756.83, "linearGain": 0.5 }], "transition": "normal", "fadeInSeconds": 0.0575, "fadeOutTicks": 96, "chord": "simultaneous", "algorithm": "1\u21903\u20032\u21904", "feedbackType": "1\u27F2\u20032\u27F2", "feedbackAmplitude": 0, "operators": [{ "frequency": "1\xD7", "amplitude": 10 }, { "frequency": "2\xD7", "amplitude": 12 }, { "frequency": "3\xD7", "amplitude": 7 }, { "frequency": "7\xD7", "amplitude": 4 }], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "twang 3" }, { "target": "operatorAmplitude", "envelope": "twang 3", "index": 2 }, { "target": "operatorAmplitude", "envelope": "flare 3", "index": 3 }] } },
            { name: "metallic pad", midiProgram: 93, generalMidi: true, settings: { "type": "FM", "eqFilter": [], "effects": ["note filter"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 0.5 }], "transition": "normal", "fadeInSeconds": 0.0125, "fadeOutTicks": 72, "chord": "simultaneous", "algorithm": "1\u21903\u20032\u21904", "feedbackType": "1\u27F2\u20032\u27F2", "feedbackAmplitude": 13, "operators": [{ "frequency": "1\xD7", "amplitude": 15 }, { "frequency": "~1\xD7", "amplitude": 9 }, { "frequency": "1\xD7", "amplitude": 7 }, { "frequency": "11\xD7", "amplitude": 7 }], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "twang 3" }, { "target": "operatorAmplitude", "envelope": "swell 2", "index": 2 }, { "target": "feedbackAmplitude", "envelope": "twang 3" }] } },
            { name: "sweep pad", midiProgram: 95, generalMidi: true, settings: { "type": "chip", "eqFilter": [], "effects": ["note filter", "chorus"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 4e3, "linearGain": 4 }], "chorus": 100, "transition": "normal", "fadeInSeconds": 0.0575, "fadeOutTicks": 96, "chord": "simultaneous", "wave": "sawtooth", "unison": "hum", "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "flare 3" }] } },
            { name: "atmosphere", midiProgram: 99, generalMidi: true, settings: { "type": "FM", "eqFilter": [{ "type": "low-pass", "cutoffHz": 4756.83, "linearGain": 1 }], "effects": ["chorus", "reverb"], "chorus": 100, "reverb": 33, "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": 48, "chord": "strum", "algorithm": "1\u2190(2\u20023\u20024)", "feedbackType": "3\u27F2\u20034\u27F2", "feedbackAmplitude": 3, "operators": [{ "frequency": "1\xD7", "amplitude": 14 }, { "frequency": "~1\xD7", "amplitude": 10 }, { "frequency": "3\xD7", "amplitude": 7 }, { "frequency": "1\xD7", "amplitude": 7 }], "envelopes": [{ "target": "operatorAmplitude", "envelope": "swell 3", "index": 1 }, { "target": "operatorAmplitude", "envelope": "twang 2", "index": 2 }, { "target": "operatorAmplitude", "envelope": "twang 3", "index": 3 }] } },
            { name: "brightness", midiProgram: 100, generalMidi: true, settings: { "type": "Picked String", "eqFilter": [{ "type": "low-pass", "cutoffHz": 4756.83, "linearGain": 2 }], "effects": ["chorus"], "chorus": 100, "transition": "normal", "fadeInSeconds": 0.0125, "fadeOutTicks": 72, "chord": "simultaneous", "harmonics": [100, 86, 86, 86, 43, 57, 43, 71, 43, 43, 43, 57, 43, 43, 57, 71, 57, 43, 29, 43, 57, 57, 43, 29, 29, 29, 29, 14], "unison": "octave", "stringSustain": 86, "envelopes": [] } },
            { name: "goblins", midiProgram: 101, generalMidi: true, settings: { "type": "FM", "eqFilter": [{ "type": "peak", "cutoffHz": 2828.43, "linearGain": 11.3137 }], "effects": ["note filter", "chorus"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 1681.79, "linearGain": 0.5 }], "chorus": 100, "transition": "normal", "fadeInSeconds": 0.0575, "fadeOutTicks": 96, "chord": "simultaneous", "algorithm": "1\u21902\u21903\u21904", "feedbackType": "1\u27F2", "feedbackAmplitude": 10, "operators": [{ "frequency": "1\xD7", "amplitude": 15 }, { "frequency": "4\xD7", "amplitude": 5 }, { "frequency": "1\xD7", "amplitude": 10 }, { "frequency": "1\xD7", "amplitude": 0 }], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "swell 2" }, { "target": "operatorAmplitude", "envelope": "swell 3", "index": 1 }, { "target": "operatorAmplitude", "envelope": "tremolo1", "index": 2 }, { "target": "feedbackAmplitude", "envelope": "flare 3" }] } },
            { name: "sci-fi", midiProgram: 103, generalMidi: true, settings: { "type": "FM", "eqFilter": [{ "type": "peak", "cutoffHz": 9513.66, "linearGain": 2.8284 }], "effects": ["note filter", "chorus"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 0.5 }], "chorus": 100, "transition": "normal", "fadeInSeconds": 0.0125, "fadeOutTicks": 48, "chord": "simultaneous", "algorithm": "(1\u20022)\u21903\u21904", "feedbackType": "1\u27F2 2\u27F2 3\u27F2 4\u27F2", "feedbackAmplitude": 8, "operators": [{ "frequency": "~1\xD7", "amplitude": 13 }, { "frequency": "2\xD7", "amplitude": 10 }, { "frequency": "5\xD7", "amplitude": 5 }, { "frequency": "11\xD7", "amplitude": 8 }], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "twang 3" }, { "target": "operatorAmplitude", "envelope": "twang 3", "index": 2 }, { "target": "operatorAmplitude", "envelope": "tremolo5", "index": 3 }, { "target": "feedbackAmplitude", "envelope": "twang 3" }] } },
            { name: "flutter pad", midiProgram: 90, settings: { "type": "FM", "eqFilter": [], "effects": ["vibrato", "note filter", "chorus"], "vibrato": "delayed", "noteFilter": [{ "type": "low-pass", "cutoffHz": 4e3, "linearGain": 4 }], "chorus": 100, "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": 48, "chord": "simultaneous", "algorithm": "(1\u20022)\u2190(3\u20024)", "feedbackType": "1\u27F2\u20032\u27F2\u20033\u27F2", "feedbackAmplitude": 9, "operators": [{ "frequency": "1\xD7", "amplitude": 13 }, { "frequency": "5\xD7", "amplitude": 7 }, { "frequency": "7\xD7", "amplitude": 5 }, { "frequency": "~1\xD7", "amplitude": 6 }], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "twang 3" }, { "target": "operatorAmplitude", "envelope": "tremolo1", "index": 2 }, { "target": "operatorAmplitude", "envelope": "punch", "index": 3 }] } },
            { name: "feedback pad", midiProgram: 89, settings: { "type": "FM", "eqFilter": [{ "type": "peak", "cutoffHz": 2378.41, "linearGain": 8 }], "effects": [], "transition": "normal", "fadeInSeconds": 0.0575, "fadeOutTicks": 96, "chord": "custom interval", "algorithm": "1\u20032\u20033\u20034", "feedbackType": "1\u27F2 2\u27F2 3\u27F2 4\u27F2", "feedbackAmplitude": 8, "operators": [{ "frequency": "1\xD7", "amplitude": 15 }, { "frequency": "1\xD7", "amplitude": 15 }, { "frequency": "1\xD7", "amplitude": 15 }, { "frequency": "~1\xD7", "amplitude": 15 }], "envelopes": [{ "target": "feedbackAmplitude", "envelope": "swell 2" }] } },
            { name: "supersaw pad", midiProgram: 93, settings: { "type": "supersaw", "eqFilter": [{ "type": "low-pass", "cutoffHz": 8e3, "linearGain": 0.1768 }], "effects": ["reverb"], "reverb": 100, "fadeInSeconds": 0.0263, "fadeOutTicks": 24, "pulseWidth": 50, "dynamism": 100, "spread": 58, "shape": 0, "envelopes": [] } }
          ])
        },
        {
          name: "Drum Presets",
          presets: toNameMap([
            { name: "standard drumset", midiProgram: 116, isNoise: true, settings: { "type": "drumset", "effects": "reverb", "drums": [{ "filterEnvelope": "twang 1", "spectrum": [57, 71, 71, 86, 86, 86, 71, 71, 71, 71, 57, 57, 57, 57, 43, 43, 43, 43, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29] }, { "filterEnvelope": "twang 1", "spectrum": [0, 0, 0, 100, 71, 71, 57, 86, 57, 57, 57, 71, 43, 43, 57, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43] }, { "filterEnvelope": "twang 1", "spectrum": [0, 0, 0, 0, 100, 57, 43, 43, 29, 57, 43, 29, 71, 43, 43, 43, 43, 57, 43, 43, 43, 43, 43, 43, 43, 43, 29, 43, 43, 43] }, { "filterEnvelope": "twang 1", "spectrum": [0, 0, 0, 0, 0, 71, 57, 43, 43, 43, 57, 57, 43, 29, 57, 43, 43, 43, 29, 43, 57, 43, 43, 43, 43, 43, 43, 29, 43, 43] }, { "filterEnvelope": "decay 2", "spectrum": [0, 14, 29, 43, 86, 71, 29, 43, 43, 43, 43, 29, 71, 29, 71, 29, 43, 43, 43, 43, 57, 43, 43, 57, 43, 43, 43, 57, 57, 57] }, { "filterEnvelope": "decay 1", "spectrum": [0, 0, 14, 14, 14, 14, 29, 29, 29, 43, 43, 43, 57, 57, 57, 71, 71, 71, 71, 71, 71, 71, 71, 57, 57, 57, 57, 43, 43, 43] }, { "filterEnvelope": "twang 3", "spectrum": [43, 43, 43, 71, 29, 29, 43, 43, 43, 29, 43, 43, 43, 29, 29, 43, 43, 29, 29, 29, 57, 14, 57, 43, 43, 57, 43, 43, 57, 57] }, { "filterEnvelope": "decay 3", "spectrum": [29, 43, 43, 43, 43, 29, 29, 43, 29, 29, 43, 29, 14, 29, 43, 29, 43, 29, 57, 29, 43, 57, 43, 71, 43, 71, 57, 57, 71, 71] }, { "filterEnvelope": "twang 3", "spectrum": [43, 29, 29, 43, 29, 29, 29, 57, 29, 29, 29, 57, 43, 43, 29, 29, 57, 43, 43, 43, 71, 43, 43, 71, 57, 71, 71, 71, 71, 71] }, { "filterEnvelope": "decay 3", "spectrum": [57, 57, 57, 43, 57, 57, 43, 43, 57, 43, 43, 43, 71, 57, 43, 57, 86, 71, 57, 86, 71, 57, 86, 100, 71, 86, 86, 86, 86, 86] }, { "filterEnvelope": "flare 1", "spectrum": [0, 0, 14, 14, 14, 14, 29, 29, 29, 43, 43, 43, 57, 57, 71, 71, 86, 86, 100, 100, 100, 100, 100, 100, 100, 100, 86, 57, 29, 0] }, { "filterEnvelope": "decay 2", "spectrum": [14, 14, 14, 14, 29, 14, 14, 29, 14, 43, 14, 43, 57, 86, 57, 57, 100, 57, 43, 43, 57, 100, 57, 43, 29, 14, 0, 0, 0, 0] }] } },
            { name: "steel pan", midiProgram: 114, generalMidi: true, settings: { "type": "FM", "eqFilter": [{ "type": "high-pass", "cutoffHz": 62.5, "linearGain": 0.1768 }], "effects": ["note filter", "chorus", "reverb"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 13454.34, "linearGain": 0.25 }], "chorus": 67, "reverb": 33, "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": 24, "chord": "simultaneous", "algorithm": "1\u2190(2\u20023\u21904)", "feedbackType": "1\u27F2", "feedbackAmplitude": 0, "operators": [{ "frequency": "~1\xD7", "amplitude": 14 }, { "frequency": "7\xD7", "amplitude": 3 }, { "frequency": "3\xD7", "amplitude": 5 }, { "frequency": "4\xD7", "amplitude": 4 }], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "decay 2" }, { "target": "operatorAmplitude", "envelope": "flare 1", "index": 1 }, { "target": "operatorAmplitude", "envelope": "flare 2", "index": 2 }, { "target": "operatorAmplitude", "envelope": "swell 2", "index": 3 }] } },
            { name: "steel pan synth", midiProgram: 114, settings: { "type": "FM", "eqFilter": [], "effects": ["note filter"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 13454.34, "linearGain": 0.25 }], "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": -3, "chord": "simultaneous", "algorithm": "1\u20032\u20033\u21904", "feedbackType": "1\u27F2", "feedbackAmplitude": 5, "operators": [{ "frequency": "~1\xD7", "amplitude": 12 }, { "frequency": "2\xD7", "amplitude": 15 }, { "frequency": "4\xD7", "amplitude": 14 }, { "frequency": "~1\xD7", "amplitude": 3 }], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "twang 1" }, { "target": "operatorAmplitude", "envelope": "note size", "index": 0 }, { "target": "operatorAmplitude", "envelope": "note size", "index": 1 }, { "target": "operatorAmplitude", "envelope": "flare 1", "index": 2 }, { "target": "operatorAmplitude", "envelope": "flare 2", "index": 3 }, { "target": "feedbackAmplitude", "envelope": "flare 1" }] } },
            { name: "timpani", midiProgram: 47, generalMidi: true, settings: { "type": "spectrum", "eqFilter": [{ "type": "peak", "cutoffHz": 6727.17, "linearGain": 5.6569 }], "effects": ["pitch shift", "note filter", "reverb"], "pitchShiftSemitones": 15, "noteFilter": [{ "type": "low-pass", "cutoffHz": 19027.31, "linearGain": 0.5 }], "reverb": 33, "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": 48, "chord": "simultaneous", "spectrum": [100, 0, 0, 0, 86, 0, 0, 71, 0, 14, 43, 14, 43, 43, 0, 29, 43, 29, 29, 29, 43, 29, 43, 29, 43, 43, 43, 43, 43, 43], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "twang 1" }, { "target": "pitchShift", "envelope": "twang 1" }] } },
            { name: "dark strike", midiProgram: 47, settings: { "type": "spectrum", "eqFilter": [], "effects": ["note filter", "reverb"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 4756.83, "linearGain": 0.7071 }], "reverb": 33, "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": 48, "chord": "simultaneous", "spectrum": [0, 0, 14, 14, 14, 29, 29, 43, 43, 86, 43, 43, 43, 29, 86, 29, 29, 29, 86, 29, 14, 14, 14, 14, 0, 0, 0, 0, 0, 0], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "twang 2" }] } },
            { name: "woodblock", midiProgram: 115, generalMidi: true, isNoise: true, midiSubharmonicOctaves: -2.5, settings: { "type": "spectrum", "effects": "reverb", "transition": "hard fade", "chord": "strum", "filterCutoffHz": 2828, "filterResonance": 14, "filterEnvelope": "twang 1", "spectrum": [0, 14, 29, 43, 43, 57, 86, 86, 71, 57, 57, 43, 43, 57, 86, 86, 43, 43, 71, 57, 57, 57, 57, 57, 86, 86, 71, 71, 71, 71] } },
            { name: "taiko drum", midiProgram: 116, generalMidi: true, isNoise: true, midiSubharmonicOctaves: -0.5, settings: { "type": "spectrum", "effects": "reverb", "transition": "hard fade", "chord": "strum", "filterCutoffHz": 2828, "filterResonance": 29, "filterEnvelope": "twang 1", "spectrum": [71, 100, 100, 43, 43, 71, 71, 43, 43, 43, 43, 43, 43, 57, 29, 57, 43, 57, 43, 43, 57, 43, 43, 43, 43, 43, 43, 43, 43, 43] } },
            { name: "melodic drum", midiProgram: 117, generalMidi: true, isNoise: true, midiSubharmonicOctaves: -1.5, settings: { "type": "spectrum", "effects": "reverb", "transition": "hard fade", "chord": "strum", "filterCutoffHz": 2828, "filterResonance": 43, "filterEnvelope": "twang 1", "spectrum": [100, 71, 71, 57, 57, 43, 43, 71, 43, 43, 43, 57, 43, 43, 57, 43, 43, 43, 43, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29] } },
            { name: "drum synth", midiProgram: 118, generalMidi: true, isNoise: true, midiSubharmonicOctaves: -2, settings: { "type": "spectrum", "effects": "reverb", "transition": "hard fade", "chord": "harmony", "filterCutoffHz": 4e3, "filterResonance": 43, "filterEnvelope": "decay 1", "spectrum": [100, 86, 71, 57, 43, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29] } },
            { name: "tom-tom", midiProgram: 116, isNoise: true, midiSubharmonicOctaves: -1, settings: { "type": "spectrum", "effects": "reverb", "transition": "hard fade", "chord": "strum", "filterCutoffHz": 2e3, "filterResonance": 14, "filterEnvelope": "twang 1", "spectrum": [100, 29, 14, 0, 0, 86, 14, 43, 29, 86, 29, 14, 29, 57, 43, 43, 43, 43, 57, 43, 43, 43, 29, 57, 43, 43, 43, 43, 43, 43] } },
            { name: "metal pipe", midiProgram: 117, isNoise: true, midiSubharmonicOctaves: -1.5, settings: { "type": "spectrum", "effects": "reverb", "transition": "hard fade", "chord": "strum", "filterCutoffHz": 8e3, "filterResonance": 14, "filterEnvelope": "twang 2", "spectrum": [29, 43, 86, 43, 43, 43, 43, 43, 100, 29, 14, 14, 100, 14, 14, 0, 0, 0, 0, 0, 14, 29, 29, 14, 0, 0, 14, 29, 0, 0] } },
            { name: "synth kick", midiProgram: 47, settings: { "type": "FM", "eqFilter": [], "effects": [], "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": -6, "chord": "simultaneous", "algorithm": "1\u2190(2\u20023\u20024)", "feedbackType": "1\u27F2", "feedbackAmplitude": 0, "operators": [{ "frequency": "8\xD7", "amplitude": 15 }, { "frequency": "1\xD7", "amplitude": 0 }, { "frequency": "1\xD7", "amplitude": 0 }, { "frequency": "1\xD7", "amplitude": 0 }], "envelopes": [{ "target": "operatorFrequency", "envelope": "twang 1", "index": 0 }, { "target": "noteVolume", "envelope": "twang 2" }] } }
          ])
        },
        {
          name: "Novelty Presets",
          presets: toNameMap([
            { name: "guitar fret noise", midiProgram: 120, generalMidi: true, settings: { "type": "spectrum", "eqFilter": [{ "type": "high-pass", "cutoffHz": 1e3, "linearGain": 0.1768 }], "effects": ["note filter"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 5.6569 }], "transition": "normal", "fadeInSeconds": 0.0125, "fadeOutTicks": -3, "chord": "simultaneous", "spectrum": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 14, 0, 0, 0, 29, 14, 0, 0, 43, 0, 43, 0, 71, 43, 0, 57, 0], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "flare 1" }, { "target": "noteVolume", "envelope": "twang 2" }] } },
            { name: "fifth saw lead", midiProgram: 86, generalMidi: true, midiSubharmonicOctaves: 1, settings: { "type": "chip", "eqFilter": [], "effects": ["note filter", "chorus"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 2828.43, "linearGain": 1.4142 }], "chorus": 67, "transition": "normal", "fadeInSeconds": 0, "fadeOutTicks": 48, "chord": "simultaneous", "wave": "sawtooth", "unison": "fifth", "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "twang 3" }] } },
            { name: "fifth swell", midiProgram: 86, midiSubharmonicOctaves: 1, settings: { "type": "chip", "eqFilter": [], "effects": ["note filter", "chorus"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 2e3, "linearGain": 2 }], "chorus": 100, "transition": "normal", "fadeInSeconds": 0.0125, "fadeOutTicks": 72, "chord": "simultaneous", "wave": "sawtooth", "unison": "fifth", "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "swell 3" }] } },
            { name: "soundtrack", midiProgram: 97, generalMidi: true, settings: { "type": "chip", "eqFilter": [], "effects": ["note filter", "chorus"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 2378.41, "linearGain": 0.5 }], "chorus": 67, "transition": "normal", "fadeInSeconds": 0.0413, "fadeOutTicks": 72, "chord": "simultaneous", "wave": "sawtooth", "unison": "fifth", "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "flare 3" }] } },
            { name: "reverse cymbal", midiProgram: 119, generalMidi: true, isNoise: true, midiSubharmonicOctaves: -3, settings: { "type": "spectrum", "effects": "none", "transition": "soft", "chord": "harmony", "filterCutoffHz": 4e3, "filterResonance": 14, "filterEnvelope": "swell 3", "spectrum": [29, 57, 57, 29, 57, 57, 29, 29, 43, 29, 29, 43, 29, 29, 57, 57, 14, 57, 14, 57, 71, 71, 57, 86, 57, 100, 86, 86, 86, 86] } },
            { name: "seashore", midiProgram: 122, generalMidi: true, isNoise: true, midiSubharmonicOctaves: -3, settings: { "type": "spectrum", "transition": "soft fade", "effects": "reverb", "chord": "harmony", "filterCutoffHz": 2828, "filterResonance": 0, "filterEnvelope": "swell 3", "spectrum": [14, 14, 29, 29, 43, 43, 43, 57, 57, 57, 57, 57, 57, 71, 71, 71, 71, 71, 71, 71, 71, 71, 71, 71, 71, 71, 71, 71, 71, 57] } },
            { name: "bird tweet", midiProgram: 123, generalMidi: true, settings: { "type": "harmonics", "eqFilter": [], "effects": ["chord type", "vibrato", "reverb"], "chord": "strum", "vibrato": "heavy", "reverb": 67, "fadeInSeconds": 0.0575, "fadeOutTicks": -6, "harmonics": [0, 0, 0, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "unison": "hum", "envelopes": [{ "target": "noteVolume", "envelope": "decay 1" }] } },
            { name: "telephone ring", midiProgram: 124, generalMidi: true, settings: { "type": "FM", "eqFilter": [], "effects": ["note filter"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 5656.85, "linearGain": 1 }], "transition": "normal", "fadeInSeconds": 0.0125, "fadeOutTicks": -3, "chord": "arpeggio", "algorithm": "1\u2190(2\u20023\u20024)", "feedbackType": "1\u27F2", "feedbackAmplitude": 0, "operators": [{ "frequency": "2\xD7", "amplitude": 12 }, { "frequency": "1\xD7", "amplitude": 4 }, { "frequency": "20\xD7", "amplitude": 1 }, { "frequency": "1\xD7", "amplitude": 0 }], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "tremolo4" }, { "target": "operatorAmplitude", "envelope": "tremolo1", "index": 1 }] } },
            { name: "helicopter", midiProgram: 125, generalMidi: true, isNoise: true, midiSubharmonicOctaves: -0.5, settings: { "type": "spectrum", "effects": "reverb", "transition": "seamless", "chord": "arpeggio", "filterCutoffHz": 1414, "filterResonance": 14, "filterEnvelope": "tremolo4", "spectrum": [14, 43, 43, 57, 57, 57, 71, 71, 71, 71, 86, 86, 86, 86, 86, 86, 86, 86, 86, 86, 86, 71, 71, 71, 71, 71, 71, 71, 57, 57] } },
            { name: "applause", midiProgram: 126, generalMidi: true, isNoise: true, midiSubharmonicOctaves: -3, settings: { "type": "spectrum", "effects": "reverb", "transition": "soft fade", "chord": "harmony", "filterCutoffHz": 2e3, "filterResonance": 14, "filterEnvelope": "swell 3", "spectrum": [14, 14, 29, 29, 29, 43, 43, 57, 71, 71, 86, 86, 86, 71, 71, 57, 57, 57, 71, 86, 86, 86, 86, 86, 71, 71, 57, 57, 57, 57] } },
            { name: "gunshot", midiProgram: 127, generalMidi: true, isNoise: true, midiSubharmonicOctaves: -2, settings: { "type": "spectrum", "effects": "reverb", "transition": "hard fade", "chord": "strum", "filterCutoffHz": 1414, "filterResonance": 29, "filterEnvelope": "twang 1", "spectrum": [14, 29, 43, 43, 57, 57, 57, 71, 71, 71, 86, 86, 86, 86, 86, 86, 86, 86, 86, 86, 86, 71, 71, 71, 71, 57, 57, 57, 57, 43] } },
            { name: "scoot", midiProgram: 92, settings: { "type": "chip", "eqFilter": [], "effects": ["note filter"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 707.11, "linearGain": 4 }], "transition": "normal", "fadeInSeconds": 0.0125, "fadeOutTicks": -3, "chord": "simultaneous", "wave": "double saw", "unison": "shimmer", "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "flare 1" }] } },
            { name: "buzz saw", midiProgram: 30, settings: { "type": "FM", "eqFilter": [{ "type": "low-pass", "cutoffHz": 9513.66, "linearGain": 0.5 }], "effects": [], "transition": "normal", "fadeInSeconds": 0.0263, "fadeOutTicks": -3, "chord": "custom interval", "algorithm": "1\u21902\u21903\u21904", "feedbackType": "1\u27F2", "feedbackAmplitude": 4, "operators": [{ "frequency": "5\xD7", "amplitude": 13 }, { "frequency": "1\xD7", "amplitude": 10 }, { "frequency": "~1\xD7", "amplitude": 6 }, { "frequency": "11\xD7", "amplitude": 12 }], "envelopes": [] } },
            { name: "mosquito", midiProgram: 93, settings: { "type": "PWM", "eqFilter": [{ "type": "low-pass", "cutoffHz": 2828.43, "linearGain": 2 }], "effects": ["vibrato"], "vibrato": "shaky", "transition": "normal", "fadeInSeconds": 0.0575, "fadeOutTicks": -6, "chord": "simultaneous", "pulseWidth": 4.41942, "envelopes": [{ "target": "pulseWidth", "envelope": "tremolo6" }] } },
            { name: "breathing", midiProgram: 126, isNoise: true, midiSubharmonicOctaves: -1, settings: { "type": "spectrum", "effects": "reverb", "transition": "hard fade", "chord": "harmony", "filterCutoffHz": 2e3, "filterResonance": 14, "filterEnvelope": "swell 2", "spectrum": [14, 14, 14, 29, 29, 29, 29, 29, 43, 29, 29, 43, 43, 43, 29, 29, 71, 43, 86, 86, 57, 100, 86, 86, 86, 86, 71, 86, 71, 57] } },
            { name: "klaxon synth", midiProgram: 125, isNoise: true, midiSubharmonicOctaves: -1, settings: { "type": "noise", "effects": "reverb", "transition": "slide", "chord": "harmony", "filterCutoffHz": 2e3, "filterResonance": 86, "filterEnvelope": "steady", "wave": "buzz" } },
            { name: "theremin", midiProgram: 40, settings: { "type": "harmonics", "eqFilter": [{ "type": "low-pass", "cutoffHz": 8e3, "linearGain": 0.7071 }], "effects": ["vibrato", "reverb"], "vibrato": "heavy", "reverb": 33, "transition": "slide in pattern", "fadeInSeconds": 0.0263, "fadeOutTicks": -6, "chord": "simultaneous", "harmonics": [100, 71, 57, 43, 29, 29, 14, 14, 14, 14, 14, 14, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "unison": "none", "envelopes": [] } },
            { name: "sonar ping", midiProgram: 121, settings: { "type": "spectrum", "eqFilter": [], "effects": ["note filter", "reverb"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 1681.79, "linearGain": 0.5 }], "reverb": 33, "transition": "normal", "fadeInSeconds": 0.0125, "fadeOutTicks": 72, "chord": "simultaneous", "spectrum": [100, 43, 29, 29, 14, 14, 14, 14, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "twang 2" }] } }
          ])
        },
        {
          name: "UltraBox Presets",
          presets: toNameMap([
            { name: "nes white", midiProgram: 116, generalMidi: true, isNoise: true, settings: { "type": "noise", "eqFilter": [], "eqFilterType": false, "eqSimpleCut": 8, "eqSimplePeak": 0, "eqSubFilters1": [], "effects": [], "fadeInSeconds": 0, "fadeOutTicks": 0, "wave": "1-bit white", "envelopes": [] } },
            { name: "nes ping", midiProgram: 116, generalMidi: true, isNoise: true, settings: { "type": "noise", "eqFilter": [], "eqFilterType": false, "eqSimpleCut": 8, "eqSimplePeak": 0, "eqSubFilters1": [], "effects": [], "fadeInSeconds": 0, "fadeOutTicks": 0, "wave": "1-bit metallic", "envelopes": [] } },
            //
            { name: "distorted pulse vocal", generalMidi: false, settings: { "type": "chip", "eqFilter": [{ "type": "low-pass", "cutoffHz": 19027.31, "linearGain": 0.0884 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 19027.31, "linearGain": 0.0884 }], "effects": ["transition type", "pitch shift", "vibrato", "note filter", "bitcrusher", "echo", "reverb"], "transition": "normal", "clicklessTransition": false, "pitchShiftSemitones": 0, "vibrato": "delayed", "vibratoDepth": 0.3, "vibratoDelay": 18.5, "vibratoSpeed": 10, "vibratoType": 0, "noteFilterType": false, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [{ "type": "high-pass", "cutoffHz": 840.9, "linearGain": 11.3137 }, { "type": "low-pass", "cutoffHz": 297.3, "linearGain": 8 }, { "type": "peak", "cutoffHz": 500, "linearGain": 11.3137 }, { "type": "high-pass", "cutoffHz": 62.5, "linearGain": 1.4142 }, { "type": "peak", "cutoffHz": 176.78, "linearGain": 11.3137 }, { "type": "high-pass", "cutoffHz": 250, "linearGain": 11.3137 }], "noteSubFilters0": [{ "type": "high-pass", "cutoffHz": 840.9, "linearGain": 11.3137 }, { "type": "low-pass", "cutoffHz": 297.3, "linearGain": 8 }, { "type": "peak", "cutoffHz": 500, "linearGain": 11.3137 }, { "type": "high-pass", "cutoffHz": 62.5, "linearGain": 1.4142 }, { "type": "peak", "cutoffHz": 176.78, "linearGain": 11.3137 }, { "type": "high-pass", "cutoffHz": 250, "linearGain": 11.3137 }], "bitcrusherOctave": 6.5, "bitcrusherQuantization": 71, "echoSustain": 14, "echoDelayBeats": 0.167, "reverb": 0, "fadeInSeconds": 0, "fadeOutTicks": -3, "wave": "1/8 pulse", "unison": "none", "envelopes": [] } },
            // from lognes
            { name: "dubstep bwah", generalMidi: false, settings: { "type": "FM", "eqFilter": [{ "type": "low-pass", "cutoffHz": 19027.31, "linearGain": 0.7071 }], "eqFilterType": true, "eqSimpleCut": 10, "eqSimplePeak": 0, "eqSubFilters1": [], "effects": ["panning", "transition type", "chord type"], "transition": "interrupt", "clicklessTransition": false, "chord": "custom interval", "fastTwoNoteArp": false, "arpeggioSpeed": 12, "pan": 0, "panDelay": 10, "fadeInSeconds": 0, "fadeOutTicks": -1, "algorithm": "1\u2190(2\u20023\u20024)", "feedbackType": "1\u27F2", "feedbackAmplitude": 10, "operators": [{ "frequency": "2\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "4\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 11, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 13, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [{ "target": "noteVolume", "envelope": "note size" }, { "target": "operatorAmplitude", "envelope": "swell 2", "index": 1 }, { "target": "operatorAmplitude", "envelope": "punch", "index": 2 }, { "target": "operatorAmplitude", "envelope": "note size", "index": 3 }] } },
            //
            { name: "FM cool bass", generalMidi: false, settings: { "type": "FM", "eqFilter": [{ "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 1 }, { "type": "high-pass", "cutoffHz": 88.39, "linearGain": 1 }, { "type": "peak", "cutoffHz": 1e3, "linearGain": 0.7071 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 1 }, { "type": "high-pass", "cutoffHz": 88.39, "linearGain": 1 }, { "type": "peak", "cutoffHz": 1e3, "linearGain": 0.7071 }], "effects": ["transition type", "note filter", "reverb"], "transition": "interrupt", "clicklessTransition": false, "noteFilterType": true, "noteSimpleCut": 9, "noteSimplePeak": 2, "noteFilter": [{ "type": "low-pass", "cutoffHz": 7231.23, "linearGain": 1 }], "noteSubFilters1": [{ "type": "low-pass", "cutoffHz": 7231.23, "linearGain": 1 }], "reverb": 0, "fadeInSeconds": 0, "fadeOutTicks": -1, "algorithm": "1\u2190(2\u20023\u21904)", "feedbackType": "1\u27F2", "feedbackAmplitude": 0, "operators": [{ "frequency": "2\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 8, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 7, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "13\xD7", "amplitude": 11, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "punch" }, { "target": "operatorAmplitude", "envelope": "twang 2", "index": 1 }, { "target": "operatorAmplitude", "envelope": "twang 3", "index": 2 }, { "target": "operatorAmplitude", "envelope": "twang 2", "index": 3 }] } },
            //
            { name: "FM funky bass", generalMidi: false, settings: { "type": "FM", "eqFilter": [{ "type": "low-pass", "cutoffHz": 9513.66, "linearGain": 0.1768 }], "eqFilterType": true, "eqSimpleCut": 5, "eqSimplePeak": 0, "eqSubFilters1": [], "effects": ["transition type", "reverb"], "transition": "normal", "clicklessTransition": false, "reverb": 0, "fadeInSeconds": 0, "fadeOutTicks": -3, "algorithm": "1\u2190(2\u20023\u20024)", "feedbackType": "1\u27F2", "feedbackAmplitude": 0, "operators": [{ "frequency": "1\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "~1\xD7", "amplitude": 8, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [{ "target": "noteVolume", "envelope": "punch" }, { "target": "noteVolume", "envelope": "note size" }] } },
            //
            { name: "talking bass", generalMidi: false, settings: { "type": "FM", "eqFilter": [], "effects": ["chord type"], "chord": "custom interval", "fadeInSeconds": 0, "fadeOutTicks": -3, "algorithm": "1\u2190(2\u20023)\u21904", "feedbackType": "1\u27F2", "feedbackAmplitude": 15, "operators": [{ "frequency": "1\xD7", "amplitude": 15 }, { "frequency": "2\xD7", "amplitude": 8 }, { "frequency": "2\xD7", "amplitude": 5 }, { "frequency": "1\xD7", "amplitude": 12 }], "envelopes": [{ "target": "operatorAmplitude", "envelope": "note size", "index": 2 }, { "target": "operatorAmplitude", "envelope": "note size", "index": 3 }, { "target": "feedbackAmplitude", "envelope": "note size" }] } },
            // from main
            { name: "synth marimba", generalMidi: false, settings: { "type": "Picked String", "eqFilter": [{ "type": "high-pass", "cutoffHz": 176.78, "linearGain": 1 }, { "type": "peak", "cutoffHz": 4e3, "linearGain": 0.5 }], "effects": ["note filter", "echo"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 1.4142 }], "echoSustain": 71, "echoDelayBeats": 0.5, "fadeInSeconds": 0, "fadeOutTicks": -1, "harmonics": [86, 100, 29, 29, 0, 0, 0, 100, 0, 0, 0, 86, 29, 0, 14, 100, 0, 0, 0, 0, 0, 14, 0, 0, 14, 0, 0, 86], "unison": "fifth", "stringSustain": 7, "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "punch" }] } },
            // from neputendo
            { name: "italian accordian", generalMidi: false, settings: { "type": "custom chip", "eqFilter": [{ "type": "low-pass", "cutoffHz": 6e3, "linearGain": 0.5 }], "eqFilterType": true, "eqSimpleCut": 8, "eqSimplePeak": 1, "eqSubFilters1": [], "effects": ["chorus", "reverb"], "chorus": 71, "reverb": 45, "fadeInSeconds": 0.0263, "fadeOutTicks": -3, "wave": "square", "unison": "honky tonk", "customChipWave": { "0": -24, "1": -24, "2": -24, "3": -24, "4": -24, "5": -24, "6": -24, "7": -24, "8": -24, "9": -24, "10": -24, "11": -24, "12": -24, "13": -24, "14": -24, "15": -24, "16": 24, "17": 24, "18": 24, "19": 24, "20": 24, "21": 24, "22": 24, "23": 24, "24": -24, "25": -24, "26": -24, "27": -24, "28": -24, "29": -24, "30": -24, "31": -24, "32": -24, "33": -24, "34": -24, "35": -24, "36": -24, "37": -24, "38": -24, "39": -24, "40": 24, "41": 24, "42": 24, "43": 24, "44": 24, "45": 24, "46": 24, "47": 24, "48": -24, "49": -24, "50": -24, "51": -24, "52": -24, "53": -24, "54": -24, "55": -24, "56": -24, "57": -24, "58": -24, "59": -24, "60": -24, "61": -24, "62": -24, "63": -24 }, "customChipWaveIntegral": { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0, "10": 0, "11": 0, "12": 0, "13": 0, "14": 0, "15": 0, "16": 0, "17": 0, "18": 0, "19": 0, "20": 0, "21": 0, "22": 0, "23": 0, "24": 0, "25": 0, "26": 0, "27": 0, "28": 0, "29": 0, "30": 0, "31": 0, "32": 0, "33": 0, "34": 0, "35": 0, "36": 0, "37": 0, "38": 0, "39": 0, "40": 0, "41": 0, "42": 0, "43": 0, "44": 0, "45": 0, "46": 0, "47": 0, "48": 0, "49": 0, "50": 0, "51": 0, "52": 0, "53": 0, "54": 0, "55": 0, "56": 0, "57": 0, "58": 0, "59": 0, "60": 0, "61": 0, "62": 0, "63": 0, "64": 0 }, "envelopes": [] } },
            // from neputendo
            { name: "chip supersaw", generalMidi: false, settings: { "type": "custom chip", "eqFilter": [{ "type": "low-pass", "cutoffHz": 19027.31, "linearGain": 0.7071 }], "eqFilterType": true, "eqSimpleCut": 10, "eqSimplePeak": 0, "eqSubFilters1": [], "effects": ["transition type", "vibrato", "chorus", "reverb"], "transition": "interrupt", "clicklessTransition": false, "vibrato": "delayed", "vibratoDepth": 0.3, "vibratoDelay": 18.5, "vibratoSpeed": 10, "vibratoType": 0, "chorus": 29, "reverb": 29, "fadeInSeconds": 0, "fadeOutTicks": -1, "wave": "square", "unison": "dissonant", "customChipWave": { "0": 22, "1": 22, "2": 16, "3": 6, "4": 0, "5": -3, "6": -8, "7": -10, "8": -13, "9": -16, "10": -19, "11": -19, "12": -20, "13": -22, "14": -22, "15": -24, "16": -24, "17": -24, "18": -24, "19": -24, "20": -24, "21": -24, "22": -24, "23": -24, "24": -24, "25": -24, "26": -24, "27": -24, "28": -24, "29": -24, "30": -24, "31": 24, "32": 24, "33": 16, "34": 9, "35": 6, "36": 4, "37": 2, "38": 0, "39": -1, "40": -3, "41": -4, "42": -4, "43": -6, "44": -6, "45": -6, "46": -6, "47": -5, "48": -5, "49": -4, "50": -2, "51": -2, "52": 1, "53": 4, "54": 6, "55": 8, "56": 10, "57": 12, "58": 14, "59": 16, "60": 18, "61": 19, "62": 22, "63": 24 }, "customChipWaveIntegral": { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0, "10": 0, "11": 0, "12": 0, "13": 0, "14": 0, "15": 0, "16": 0, "17": 0, "18": 0, "19": 0, "20": 0, "21": 0, "22": 0, "23": 0, "24": 0, "25": 0, "26": 0, "27": 0, "28": 0, "29": 0, "30": 0, "31": 0, "32": 0, "33": 0, "34": 0, "35": 0, "36": 0, "37": 0, "38": 0, "39": 0, "40": 0, "41": 0, "42": 0, "43": 0, "44": 0, "45": 0, "46": 0, "47": 0, "48": 0, "49": 0, "50": 0, "51": 0, "52": 0, "53": 0, "54": 0, "55": 0, "56": 0, "57": 0, "58": 0, "59": 0, "60": 0, "61": 0, "62": 0, "63": 0, "64": 0 }, "envelopes": [] } },
            // THANKS TO ANSWEARING MACHINE for the FM supersaw
            { name: "fm supersaw", generalMidi: false, settings: { "type": "FM6op", "eqFilter": [{ "type": "low-pass", "cutoffHz": 19027.31, "linearGain": 1.4142 }, { "type": "high-pass", "cutoffHz": 148.65, "linearGain": 0.7071 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 19027.31, "linearGain": 1.4142 }, { "type": "high-pass", "cutoffHz": 148.65, "linearGain": 0.7071 }], "effects": ["transition type", "pitch shift", "note filter", "chorus", "reverb"], "transition": "continue", "clicklessTransition": false, "pitchShiftSemitones": 0, "noteFilterType": false, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [], "noteSubFilters0": [], "noteSubFilters1": [{ "type": "low-pass", "cutoffHz": 4756.83, "linearGain": 1 }], "chorus": 71, "reverb": 0, "fadeInSeconds": 0, "fadeOutTicks": -1, "algorithm": "1\u20032\u20033\u20034\u20035\u20036", "feedbackType": "1\u27F2", "feedbackAmplitude": 0, "operators": [{ "frequency": "1\xD7", "amplitude": 13, "waveform": "sawtooth", "pulseWidth": 5 }, { "frequency": "~1\xD7", "amplitude": 15, "waveform": "sawtooth", "pulseWidth": 5 }, { "frequency": "2\xD7", "amplitude": 10, "waveform": "sawtooth", "pulseWidth": 5 }, { "frequency": "3\xD7", "amplitude": 7, "waveform": "sawtooth", "pulseWidth": 5 }, { "frequency": "4\xD7", "amplitude": 9, "waveform": "sawtooth", "pulseWidth": 5 }, { "frequency": "8\xD7", "amplitude": 6, "waveform": "sawtooth", "pulseWidth": 5 }], "envelopes": [] } },
            // based off of the todbox wind preset that was removed
            { name: "wind", generalMidi: false, settings: { "type": "FM", "eqFilter": [{ "type": "low-pass", "cutoffHz": 250.03, "linearGain": 11.3137 }], "eqFilterType": true, "eqSimpleCut": 0, "eqSimplePeak": 7, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters1": [], "effects": ["transition type", "reverb"], "transition": "continue", "clicklessTransition": false, "reverb": 0, "fadeInSeconds": 0, "fadeOutTicks": -1, "algorithm": "1\u2190(2\u20023\u20024)", "feedbackType": "1\u21923\u20032\u21924", "feedbackAmplitude": 15, "operators": [{ "frequency": "16\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "16\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "16\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "16\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [] } },
            // this meow is from nobo
            { name: "mrow", generalMidi: false, settings: { "type": "FM", "eqFilter": [], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "eqSubFilters0": [], "effects": ["chord type", "reverb"], "chord": "custom interval", "fastTwoNoteArp": false, "arpeggioSpeed": 12, "reverb": 35, "fadeInSeconds": 0.0263, "fadeOutTicks": -3, "algorithm": "1\u21903\u20032\u21904", "feedbackType": "1\u27F2 2\u27F2 3\u27F2 4\u27F2", "feedbackAmplitude": 5, "operators": [{ "frequency": "4\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "~2\xD7", "amplitude": 13, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "~2\xD7", "amplitude": 8, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "~2\xD7", "amplitude": 9, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [{ "target": "operatorAmplitude", "envelope": "flare 1", "index": 0 }, { "target": "operatorAmplitude", "envelope": "note size", "index": 1 }, { "target": "operatorAmplitude", "envelope": "note size", "index": 2 }, { "target": "operatorAmplitude", "envelope": "flare 3", "index": 3 }, { "target": "feedbackAmplitude", "envelope": "flare 1" }] } },
            // based off of the "obama why" beepcord inside joke so thanks to nobo ig
            { name: "vocal why", generalMidi: false, settings: { "type": "harmonics", "eqFilter": [], "effects": ["note filter", "reverb"], "noteFilter": [{ "type": "low-pass", "cutoffHz": 840.9, "linearGain": 11.3137 }], "reverb": 0, "fadeInSeconds": 0.0263, "fadeOutTicks": -3, "harmonics": [100, 86, 29, 29, 14, 14, 0, 14, 14, 43, 71, 100, 100, 86, 71, 71, 57, 57, 43, 43, 43, 43, 43, 0, 0, 0, 0, 0], "unison": "octave", "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "note size" }] } }
          ])
        },
        {
          name: "Slarmoo's Box Presets",
          presets: toNameMap([
            // custom presets from this mod	
            // all created by Slarmoo
            { name: "radio fm", generalMidi: false, settings: { "type": "FM", "eqFilter": [{ "type": "low-pass", "cutoffHz": 1189.21, "linearGain": 1.4142 }, { "type": "high-pass", "cutoffHz": 74.33, "linearGain": 0.3536 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 1189.21, "linearGain": 1.4142 }, { "type": "high-pass", "cutoffHz": 74.33, "linearGain": 0.3536 }], "effects": ["detune", "vibrato", "bitcrusher", "reverb"], "detuneCents": 0, "vibrato": "none", "vibratoDepth": 0, "vibratoDelay": 0, "vibratoSpeed": 10, "vibratoType": 0, "bitcrusherOctave": 6.5, "bitcrusherQuantization": 43, "reverb": 0, "fadeInSeconds": 0, "fadeOutTicks": 6, "algorithm": "1\u20032\u20033\u20034", "feedbackType": "1\u27F2\u20032\u27F2", "feedbackAmplitude": 4, "operators": [{ "frequency": "1\xD7", "amplitude": 13, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "0.12\xD7", "amplitude": 7, "waveform": "trapezoid", "pulseWidth": 5 }, { "frequency": "0.5\xD7", "amplitude": 10, "waveform": "triangle", "pulseWidth": 5 }, { "frequency": "~1\xD7", "amplitude": 5, "waveform": "triangle", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [], "isDrum": false } },
            { name: "anguished underworld", generalMidi: false, settings: { "type": "FM6op", "eqFilter": [{ "type": "low-pass", "cutoffHz": 13454.34, "linearGain": 0.0884 }, { "type": "high-pass", "cutoffHz": 148.65, "linearGain": 0.5 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 13454.34, "linearGain": 0.0884 }, { "type": "high-pass", "cutoffHz": 148.65, "linearGain": 0.5 }], "effects": ["note filter", "distortion", "bitcrusher", "reverb"], "noteFilterType": false, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [{ "type": "low-pass", "cutoffHz": 2828.43, "linearGain": 0.0884 }, { "type": "high-pass", "cutoffHz": 420.45, "linearGain": 0.25 }, { "type": "peak", "cutoffHz": 840.9, "linearGain": 2 }], "noteSubFilters0": [{ "type": "low-pass", "cutoffHz": 2828.43, "linearGain": 0.0884 }, { "type": "high-pass", "cutoffHz": 420.45, "linearGain": 0.25 }, { "type": "peak", "cutoffHz": 840.9, "linearGain": 2 }], "noteSubFilters1": [{ "type": "low-pass", "cutoffHz": 1681.79, "linearGain": 0.5 }], "distortion": 43, "aliases": false, "bitcrusherOctave": 4.5, "bitcrusherQuantization": 43, "reverb": 0, "fadeInSeconds": 0.075, "fadeOutTicks": 6, "algorithm": "1\u20032\u21904\u20033\u2190(5\u20036)", "feedbackType": "1\u21925\u20022\u21926 3\u21924", "feedbackAmplitude": 4, "operators": [{ "frequency": "0.25\xD7", "amplitude": 14, "waveform": "triangle", "pulseWidth": 5 }, { "frequency": "0.5\xD7", "amplitude": 13, "waveform": "sawtooth", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 12, "waveform": "trapezoid", "pulseWidth": 5 }, { "frequency": "8\xD7", "amplitude": 5, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "~2\xD7", "amplitude": 10, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "0.75\xD7", "amplitude": 3, "waveform": "ramp", "pulseWidth": 5 }], "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "punch" }, { "target": "operatorAmplitude", "envelope": "decay -1", "index": 5 }, { "target": "feedbackAmplitude", "envelope": "wibble 3" }], "isDrum": false } },
            { name: "faint sorrow", generalMidi: false, settings: { "type": "FM", "eqFilter": [{ "type": "low-pass", "cutoffHz": 4240.89, "linearGain": 2 }], "eqFilterType": true, "eqSimpleCut": 8, "eqSimplePeak": 4, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters1": [], "effects": ["detune", "vibrato", "echo", "reverb"], "detuneCents": 22, "vibrato": "light", "vibratoDepth": 0.15, "vibratoDelay": 0, "vibratoSpeed": 10, "vibratoType": 0, "echoSustain": 100, "echoDelayBeats": 0.667, "reverb": 87, "fadeInSeconds": 0.075, "fadeOutTicks": 48, "algorithm": "1\u20032\u20033\u20034", "feedbackType": "1\u27F2", "feedbackAmplitude": 3, "operators": [{ "frequency": "1\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "~1\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "~1\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [], "isDrum": false } },
            { name: "bright sorrow fm", generalMidi: false, settings: { "type": "FM", "eqFilter": [], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [], "effects": ["chord type", "note filter", "echo", "reverb"], "chord": "strum", "fastTwoNoteArp": false, "arpeggioSpeed": 12, "noteFilterType": false, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [{ "type": "low-pass", "cutoffHz": 2e3, "linearGain": 2.8284 }], "noteSubFilters0": [{ "type": "low-pass", "cutoffHz": 2e3, "linearGain": 2.8284 }], "noteSubFilters1": [{ "type": "low-pass", "cutoffHz": 1414.21, "linearGain": 1.4142 }], "echoSustain": 71, "echoDelayBeats": 1.333, "reverb": 61, "fadeInSeconds": 0, "fadeOutTicks": 48, "algorithm": "(1\u20022\u20023)\u21904", "feedbackType": "1\u27F2\u20032\u27F2\u20033\u27F2", "feedbackAmplitude": 2, "operators": [{ "frequency": "1\xD7", "amplitude": 13, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "5\xD7", "amplitude": 10, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "5\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "2\xD7", "amplitude": 7, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [], "isDrum": false } },
            { name: "wet sorrow fm", generalMidi: false, settings: { "type": "FM", "eqFilter": [{ "type": "low-pass", "cutoffHz": 19027.31, "linearGain": 0.7071 }], "eqFilterType": true, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters1": [], "effects": ["vibrato", "reverb"], "vibrato": "light", "vibratoDepth": 0.15, "vibratoDelay": 0, "vibratoSpeed": 10, "vibratoType": 0, "reverb": 23, "fadeInSeconds": 0.0263, "fadeOutTicks": -3, "algorithm": "1\u2190(2\u20023\u20024)", "feedbackType": "1\u27F2", "feedbackAmplitude": 4, "operators": [{ "frequency": "1\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 3, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 9, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 2, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [{ "target": "operatorAmplitude", "envelope": "decay 3", "index": 2 }], "isDrum": false } },
            { name: "scream fm", generalMidi: false, settings: { "type": "FM", "eqFilter": [{ "type": "low-pass", "cutoffHz": 8e3, "linearGain": 2 }, { "type": "high-pass", "cutoffHz": 250, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 1189.21, "linearGain": 0.3536 }, { "type": "peak", "cutoffHz": 707.11, "linearGain": 0.125 }, { "type": "peak", "cutoffHz": 353.55, "linearGain": 0.7071 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 8e3, "linearGain": 2 }, { "type": "high-pass", "cutoffHz": 250, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 1189.21, "linearGain": 0.3536 }, { "type": "peak", "cutoffHz": 707.11, "linearGain": 0.125 }, { "type": "peak", "cutoffHz": 353.55, "linearGain": 0.7071 }], "effects": ["detune", "note filter", "distortion", "reverb"], "detuneCents": 0, "noteFilterType": false, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [{ "type": "high-pass", "cutoffHz": 1681.79, "linearGain": 0.125 }, { "type": "low-pass", "cutoffHz": 19027.31, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 2e3, "linearGain": 11.3137 }], "noteSubFilters0": [{ "type": "high-pass", "cutoffHz": 1681.79, "linearGain": 0.125 }, { "type": "low-pass", "cutoffHz": 19027.31, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 2e3, "linearGain": 11.3137 }], "distortion": 0, "aliases": false, "reverb": 87, "fadeInSeconds": 0.135, "fadeOutTicks": -3, "algorithm": "(1\u20022\u20023)\u21904", "feedbackType": "1\u27F2 2\u27F2 3\u27F2 4\u27F2", "feedbackAmplitude": 11, "operators": [{ "frequency": "4\xD7", "amplitude": 13, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 10, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "2\xD7", "amplitude": 3, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "7\xD7", "amplitude": 5, "waveform": "triangle", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [{ "target": "detune", "envelope": "swell 1" }, { "target": "feedbackAmplitude", "envelope": "tremolo4" }], "isDrum": false } },
            { name: "anguished radio fm pad", generalMidi: false, settings: { "type": "FM", "eqFilter": [{ "type": "low-pass", "cutoffHz": 19027.31, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 9513.66, "linearGain": 4 }, { "type": "peak", "cutoffHz": 353.55, "linearGain": 0.0884 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 62.5, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 9513.66, "linearGain": 4 }, { "type": "peak", "cutoffHz": 353.55, "linearGain": 0.0884 }], "eqSubFilters4": [], "effects": ["detune", "note filter", "bitcrusher", "chorus", "echo", "reverb"], "detuneCents": -16, "noteFilterType": false, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [], "noteSubFilters0": [], "noteSubFilters1": [{ "type": "low-pass", "cutoffHz": 19027.31, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 420.45, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 11313.71, "linearGain": 11.3137 }], "noteSubFilters2": [{ "type": "low-pass", "cutoffHz": 105.11, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 420.45, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 11313.71, "linearGain": 11.3137 }], "noteSubFilters4": [{ "type": "low-pass", "cutoffHz": 19027.31, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 420.45, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 11313.71, "linearGain": 11.3137 }], "bitcrusherOctave": 5.5, "bitcrusherQuantization": 43, "chorus": 29, "echoSustain": 43, "echoDelayBeats": 1, "reverb": 58, "fadeInSeconds": 0, "fadeOutTicks": 48, "algorithm": "1\u21903\u20032\u21904", "feedbackType": "1\u21923", "feedbackAmplitude": 3, "operators": [{ "frequency": "1\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 9, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 9, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "~2\xD7", "amplitude": 7, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [], "isDrum": false } },
            { name: "juicy kick", generalMidi: false, settings: { "type": "FM", "eqFilter": [{ "type": "high-pass", "cutoffHz": 62.5, "linearGain": 11.3137 }, { "type": "low-pass", "cutoffHz": 5656.85, "linearGain": 0.3536 }, { "type": "peak", "cutoffHz": 840.9, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 1189.21, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 594.6, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 420.45, "linearGain": 0.0884 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "high-pass", "cutoffHz": 62.5, "linearGain": 11.3137 }, { "type": "low-pass", "cutoffHz": 5656.85, "linearGain": 0.3536 }, { "type": "peak", "cutoffHz": 840.9, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 1189.21, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 594.6, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 420.45, "linearGain": 0.0884 }], "effects": [], "fadeInSeconds": 0, "fadeOutTicks": -6, "algorithm": "1\u2190(2\u20023\u20024)", "feedbackType": "1\u27F2", "feedbackAmplitude": 0, "operators": [{ "frequency": "20\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [{ "target": "operatorFrequency", "envelope": "twang 1", "index": 0 }, { "target": "noteVolume", "envelope": "twang 2" }], "isDrum": false } },
            { name: "good vibes supersaw", generalMidi: false, settings: { "type": "supersaw", "eqFilter": [], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 6, "discreteEnvelope": false, "pitchEnvelopeStart": 37, "pitchEnvelopeEnd": 96, "pitchEnvelopeInverse": true, "eqSubFilters0": [], "effects": ["transition type", "detune", "chorus", "reverb"], "transition": "interrupt", "clicklessTransition": false, "detuneCents": 30, "chorus": 14, "reverb": 23, "fadeInSeconds": 0.0263, "fadeOutTicks": 12, "pulseWidth": 26, "decimalOffset": 0, "dynamism": 33, "spread": 33, "shape": 17, "envelopes": [{ "target": "supersawShape", "envelope": "pitch" }, { "target": "detune", "envelope": "tremolo2" }], "isDrum": false } },
            { name: "ethereal", generalMidi: false, isNoise: false, settings: { "type": "spectrum", "volume": 0, "eqFilter": [{ "type": "peak", "cutoffHz": 4e3, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 420.45, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 6727.17, "linearGain": 0.0884 }, { "type": "high-pass", "cutoffHz": 88.39, "linearGain": 1.4142 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 4, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "peak", "cutoffHz": 4e3, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 420.45, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 6727.17, "linearGain": 0.0884 }, { "type": "high-pass", "cutoffHz": 88.39, "linearGain": 1.4142 }], "eqSubFilters1": [], "effects": ["transition type", "chord type", "pitch shift", "detune", "vibrato", "note filter", "bitcrusher", "chorus", "reverb"], "transition": "continue", "clicklessTransition": false, "chord": "simultaneous", "fastTwoNoteArp": false, "arpeggioSpeed": 12, "pitchShiftSemitones": 12, "detuneCents": 36, "vibrato": "custom", "vibratoDepth": 0.12, "vibratoDelay": 36, "vibratoSpeed": 10, "vibratoType": 0, "noteFilterType": false, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [{ "type": "peak", "cutoffHz": 2828.43, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 2e3, "linearGain": 0.0884 }, { "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 0.0884 }, { "type": "high-pass", "cutoffHz": 420.45, "linearGain": 0.7071 }], "noteSubFilters0": [{ "type": "peak", "cutoffHz": 2828.43, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 2e3, "linearGain": 0.0884 }, { "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 0.0884 }, { "type": "high-pass", "cutoffHz": 420.45, "linearGain": 0.7071 }], "bitcrusherOctave": 4.5, "bitcrusherQuantization": 43, "chorus": 71, "reverb": 100, "fadeInSeconds": 0, "fadeOutTicks": -1, "spectrum": [43, 0, 0, 0, 0, 0, 0, 71, 0, 0, 0, 57, 0, 0, 57, 0, 43, 0, 43, 0, 0, 29, 0, 29, 0, 14, 14, 14, 0, 0], "unison": "none", "pitchEnvelopeStart0": 0, "pitchEnvelopeEnd0": 96, "envelopeInverse0": false, "pitchEnvelopeStart1": 0, "pitchEnvelopeEnd1": 96, "envelopeInverse1": false, "pitchEnvelopeStart2": 0, "pitchEnvelopeEnd2": 96, "envelopeInverse2": false, "envelopes": [{ "target": "noteVolume", "envelope": "note size" }, { "target": "detune", "envelope": "tremolo3" }, { "target": "bitcrusherQuantization", "envelope": "note size" }], "isDrum": false } },
            { name: "walrus wuh", generalMidi: false, settings: { "type": "supersaw", "eqFilter": [{ "type": "low-pass", "cutoffHz": 13454.34, "linearGain": 0.25 }, { "type": "high-pass", "cutoffHz": 353.55, "linearGain": 2 }, { "type": "peak", "cutoffHz": 4756.83, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 3363.59, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 74.33, "linearGain": 2.8284 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "pitchEnvelopeInverse": false, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 13454.34, "linearGain": 0.25 }, { "type": "high-pass", "cutoffHz": 353.55, "linearGain": 2 }, { "type": "peak", "cutoffHz": 4756.83, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 3363.59, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 74.33, "linearGain": 2.8284 }], "effects": ["note filter", "bitcrusher", "chorus", "reverb"], "noteFilterType": false, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [{ "type": "low-pass", "cutoffHz": 11313.71, "linearGain": 0.125 }], "noteSubFilters0": [{ "type": "low-pass", "cutoffHz": 11313.71, "linearGain": 0.125 }], "bitcrusherOctave": 4, "bitcrusherQuantization": 71, "chorus": 86, "reverb": 32, "fadeInSeconds": 0.0263, "fadeOutTicks": 48, "pulseWidth": 50, "decimalOffset": 0, "dynamism": 100, "spread": 50, "shape": 0, "envelopes": [{ "target": "noteVolume", "envelope": "punch" }, { "target": "bitcrusherQuantization", "envelope": "decay 3" }], "isDrum": false } },
            { name: "saturnic", generalMidi: false, settings: { "type": "FM", "volume": 0, "eqFilter": [{ "type": "low-pass", "cutoffHz": 4240.89, "linearGain": 2 }], "eqFilterType": true, "eqSimpleCut": 8, "eqSimplePeak": 4, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters1": [], "effects": ["vibrato", "chorus", "echo", "reverb"], "vibrato": "light", "vibratoDepth": 0.15, "vibratoDelay": 0, "vibratoSpeed": 10, "vibratoType": 0, "chorus": 100, "echoSustain": 71, "echoDelayBeats": 0.5, "reverb": 45, "fadeInSeconds": 0.0125, "fadeOutTicks": 72, "algorithm": "1\u2190(2\u20023\u20024)", "feedbackType": "1\u27F2", "feedbackAmplitude": 15, "operators": [{ "frequency": "1\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [], "isDrum": false } },
            { name: "glassy harmonics", generalMidi: false, settings: { "type": "harmonics", "volume": 0, "eqFilter": [{ "type": "low-pass", "cutoffHz": 1e3, "linearGain": 11.3137 }, { "type": "peak", "cutoffHz": 840.9, "linearGain": 0.5 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 1e3, "linearGain": 11.3137 }, { "type": "peak", "cutoffHz": 840.9, "linearGain": 0.5 }], "effects": ["detune", "note filter", "chorus", "reverb"], "detuneCents": 0, "noteFilterType": false, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [], "noteSubFilters0": [], "chorus": 14, "reverb": 29, "fadeInSeconds": 0, "fadeOutTicks": -3, "harmonics": [100, 0, 43, 29, 0, 100, 0, 0, 0, 0, 0, 0, 0, 0, 14, 29, 14, 0, 14, 0, 0, 0, 0, 100, 0, 0, 14, 0], "unison": "none", "envelopes": [], "isDrum": false } },
            { name: "plucked", generalMidi: false, settings: { "type": "Picked String", "volume": 0, "eqFilter": [{ "type": "low-pass", "cutoffHz": 4756.83, "linearGain": 0.0884 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 4756.83, "linearGain": 0.0884 }], "effects": ["transition type", "echo", "reverb"], "transition": "interrupt", "clicklessTransition": false, "echoSustain": 100, "echoDelayBeats": 1.333, "reverb": 26, "fadeInSeconds": 0, "fadeOutTicks": 24, "harmonics": [100, 86, 57, 0, 0, 57, 57, 57, 86, 57, 57, 43, 43, 43, 29, 29, 14, 14, 29, 14, 14, 14, 29, 100, 57, 43, 14, 14], "unison": "none", "stringSustain": 14, "envelopes": [], "isDrum": false } },
            //1.1.1 noise presets
            { name: "cowbell", generalMidi: false, isNoise: true, settings: { "type": "noise", "volume": 0, "eqFilter": [{ "type": "high-pass", "cutoffHz": 5656.85, "linearGain": 0.3536 }, { "type": "low-pass", "cutoffHz": 11313.71, "linearGain": 0.7071 }, { "type": "peak", "cutoffHz": 8e3, "linearGain": 2.8284 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "eqSubFilters0": [{ "type": "high-pass", "cutoffHz": 5656.85, "linearGain": 0.3536 }, { "type": "low-pass", "cutoffHz": 11313.71, "linearGain": 0.7071 }, { "type": "peak", "cutoffHz": 8e3, "linearGain": 2.8284 }], "eqSubFilters1": [], "effects": ["panning", "distortion", "chorus", "reverb", "ring mod"], "ringMod": 43, "ringModHz": 87, "ringModWaveformIndex": 1, "ringModPulseWidth": 0, "ringModHzOffset": 50, "distortion": 29, "aliases": false, "pan": 0, "panDelay": 10, "chorus": 29, "reverb": 42, "fadeInSeconds": 0, "fadeOutTicks": 96, "wave": "1-bit metallic", "unison": "stationary", "envelopes": [], "isDrum": true } },
            { name: "hi-hat", generalMidi: false, isNoise: true, settings: { "type": "noise", "volume": 0, "eqFilter": [{ "type": "low-pass", "cutoffHz": 16e3, "linearGain": 0.3536 }, { "type": "high-pass", "cutoffHz": 4756.83, "linearGain": 0.1768 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 16e3, "linearGain": 0.3536 }, { "type": "high-pass", "cutoffHz": 4756.83, "linearGain": 0.1768 }], "eqSubFilters1": [{ "type": "low-pass", "cutoffHz": 16e3, "linearGain": 0.3536 }, { "type": "high-pass", "cutoffHz": 4756.83, "linearGain": 0.1768 }], "eqSubFilters2": [{ "type": "low-pass", "cutoffHz": 8e3, "linearGain": 0.3536 }, { "type": "high-pass", "cutoffHz": 4756.83, "linearGain": 0.1768 }], "eqSubFilters3": [{ "type": "low-pass", "cutoffHz": 8e3, "linearGain": 0.1768 }, { "type": "high-pass", "cutoffHz": 4756.83, "linearGain": 0.1768 }], "effects": [], "fadeInSeconds": 0, "fadeOutTicks": -3, "wave": "white", "unison": "none", "envelopes": [], "isDrum": true } },
            //1.2 presets
            { name: "jungle bass", generalMidi: false, isNoise: false, settings: { "type": "FM", "volume": 0, "eqFilter": [{ "type": "low-pass", "cutoffHz": 2378.41, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 148.65, "linearGain": 0.0884 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 2378.41, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 148.65, "linearGain": 0.0884 }], "effects": ["vibrato", "note filter", "chorus", "reverb"], "vibrato": "none", "vibratoDepth": 0, "vibratoDelay": 0, "vibratoSpeed": 10, "vibratoType": 0, "noteFilterType": false, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [{ "type": "low-pass", "cutoffHz": 297.3, "linearGain": 1 }, { "type": "peak", "cutoffHz": 74.33, "linearGain": 0.0884 }], "noteSubFilters0": [{ "type": "low-pass", "cutoffHz": 297.3, "linearGain": 1 }, { "type": "peak", "cutoffHz": 74.33, "linearGain": 0.0884 }], "chorus": 14, "reverb": 3, "fadeInSeconds": 0, "fadeOutTicks": 48, "algorithm": "1\u21903\u20032\u21904", "feedbackType": "1\u21942 3\u21944", "feedbackAmplitude": 3, "operators": [{ "frequency": "1\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 13, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "2\xD7", "amplitude": 5, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "8\xD7", "amplitude": 11, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "pitchEnvelopeStart0": 0, "pitchEnvelopeEnd0": 96, "envelopeInverse0": false, "pitchEnvelopeStart1": 0, "pitchEnvelopeEnd1": 96, "envelopeInverse1": false, "pitchEnvelopeStart2": 12, "pitchEnvelopeEnd2": 28, "envelopeInverse2": false, "envelopes": [{ "target": "operatorFrequency", "envelope": "swell 3", "index": 0 }, { "target": "operatorAmplitude", "envelope": "swell 3", "index": 1 }, { "target": "noteFilterFreq", "envelope": "pitch", "index": 0 }], "isDrum": false } },
            { name: "beach tide", generalMidi: false, isNoise: false, settings: { "type": "harmonics", "volume": 0, "eqFilter": [{ "type": "high-pass", "cutoffHz": 594.6, "linearGain": 0.3536 }, { "type": "low-pass", "cutoffHz": 13454.34, "linearGain": 0.1768 }, { "type": "peak", "cutoffHz": 8e3, "linearGain": 0.0884 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "high-pass", "cutoffHz": 594.6, "linearGain": 0.3536 }, { "type": "low-pass", "cutoffHz": 13454.34, "linearGain": 0.1768 }, { "type": "peak", "cutoffHz": 8e3, "linearGain": 0.0884 }], "effects": ["transition type", "chord type", "note filter", "chorus", "reverb"], "transition": "continue", "clicklessTransition": false, "chord": "simultaneous", "fastTwoNoteArp": false, "arpeggioSpeed": 12, "noteFilterType": false, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [{ "type": "high-pass", "cutoffHz": 420.45, "linearGain": 1 }, { "type": "peak", "cutoffHz": 5656.85, "linearGain": 0.1768 }], "noteSubFilters0": [{ "type": "high-pass", "cutoffHz": 420.45, "linearGain": 1 }, { "type": "peak", "cutoffHz": 5656.85, "linearGain": 0.1768 }], "chorus": 14, "reverb": 32, "fadeInSeconds": 0.0938, "fadeOutTicks": 72, "harmonics": [86, 86, 71, 57, 57, 43, 43, 43, 29, 29, 14, 14, 14, 0, 0, 57, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "unison": "none", "pitchEnvelopeStart0": 0, "pitchEnvelopeEnd0": 96, "envelopeInverse0": false, "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "pitch" }], "isDrum": false } },
            { name: "starlight", generalMidi: false, isNoise: false, settings: { "type": "FM", "volume": 0, "eqFilter": [{ "type": "low-pass", "cutoffHz": 2378.41, "linearGain": 0.0884 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 2378.41, "linearGain": 0.0884 }], "effects": ["transition type", "vibrato", "bitcrusher", "echo", "reverb"], "transition": "continue", "clicklessTransition": false, "vibrato": "light", "vibratoDepth": 0.15, "vibratoDelay": 0, "vibratoSpeed": 10, "vibratoType": 0, "bitcrusherOctave": 5.5, "bitcrusherQuantization": 29, "echoSustain": 29, "echoDelayBeats": 1, "reverb": 13, "fadeInSeconds": 0, "fadeOutTicks": 24, "algorithm": "1\u2190(2\u20023\u20024)", "feedbackType": "1\u27F2", "feedbackAmplitude": 0, "operators": [{ "frequency": "1\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 6, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [], "isDrum": false } },
            { name: "distant monument", generalMidi: false, isNoise: false, settings: { "type": "chip", "volume": 0, "eqFilter": [{ "type": "low-pass", "cutoffHz": 3363.59, "linearGain": 1 }, { "type": "peak", "cutoffHz": 11313.71, "linearGain": 0.25 }, { "type": "peak", "cutoffHz": 500, "linearGain": 0.125 }, { "type": "peak", "cutoffHz": 210.22, "linearGain": 5.6569 }, { "type": "peak", "cutoffHz": 840.9, "linearGain": 5.6569 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 3363.59, "linearGain": 1 }, { "type": "peak", "cutoffHz": 11313.71, "linearGain": 0.25 }, { "type": "peak", "cutoffHz": 500, "linearGain": 0.125 }, { "type": "peak", "cutoffHz": 210.22, "linearGain": 5.6569 }, { "type": "peak", "cutoffHz": 840.9, "linearGain": 5.6569 }], "effects": ["transition type", "chord type", "detune", "bitcrusher", "chorus", "echo", "reverb"], "transition": "normal", "clicklessTransition": false, "chord": "strum", "fastTwoNoteArp": false, "arpeggioSpeed": 12, "detuneCents": 24, "bitcrusherOctave": 2.5, "bitcrusherQuantization": 14, "chorus": 86, "echoSustain": 71, "echoDelayBeats": 1, "reverb": 35, "fadeInSeconds": 0.0413, "fadeOutTicks": 12, "wave": "modbox pnryshk a (u5)", "unison": "detune", "isUsingAdvancedLoopControls": false, "chipWaveLoopStart": 0, "chipWaveLoopEnd": 11, "chipWaveLoopMode": 0, "chipWavePlayBackwards": false, "chipWaveStartOffset": 0, "pitchEnvelopeStart0": 0, "pitchEnvelopeEnd0": 96, "envelopeInverse0": false, "pitchEnvelopeStart1": 0, "pitchEnvelopeEnd1": 96, "envelopeInverse1": false, "envelopes": [{ "target": "noteVolume", "envelope": "punch" }, { "target": "noteVolume", "envelope": "twang 1" }], "isDrum": false } },
            { name: "mercurial", generalMidi: false, isNoise: false, settings: { "type": "FM6op", "volume": 0, "eqFilter": [{ "type": "low-pass", "cutoffHz": 11313.71, "linearGain": 0.5 }, { "type": "peak", "cutoffHz": 88.39, "linearGain": 2.8284 }, { "type": "peak", "cutoffHz": 1189.21, "linearGain": 0.1768 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 11313.71, "linearGain": 0.5 }, { "type": "peak", "cutoffHz": 88.39, "linearGain": 2.8284 }, { "type": "peak", "cutoffHz": 1189.21, "linearGain": 0.1768 }], "eqSubFilters1": [], "effects": ["distortion", "chorus"], "distortion": 43, "aliases": false, "chorus": 43, "fadeInSeconds": 0, "fadeOutTicks": -1, "algorithm": "Custom", "feedbackType": "1\u27F2", "feedbackAmplitude": 8, "customAlgorithm": { "mods": [[3], [5], [4], [], [6], []], "carrierCount": 2 }, "operators": [{ "frequency": "1\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "0.5\xD7", "amplitude": 10, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 5, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "~2\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 9, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 2, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [{ "target": "noteVolume", "envelope": "twang", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 32, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }, { "target": "operatorFrequency", "envelope": "linear", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 2, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "index": 3 }, { "target": "distortion", "envelope": "twang", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 20, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }], "isDrum": false } },
            { name: "air hiss", generalMidi: false, isNoise: true, settings: { "type": "spectrum", "volume": 0, "eqFilter": [{ "type": "low-pass", "cutoffHz": 13454.34, "linearGain": 0.25 }], "eqFilterType": true, "eqSimpleCut": 7, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters1": [], "effects": ["note filter", "distortion", "reverb"], "noteFilterType": false, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [{ "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 0.25 }, { "type": "high-pass", "cutoffHz": 2828.43, "linearGain": 0.3536 }], "noteSubFilters0": [{ "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 0.25 }, { "type": "high-pass", "cutoffHz": 2828.43, "linearGain": 0.3536 }], "distortion": 71, "aliases": false, "reverb": 6, "fadeInSeconds": 0, "fadeOutTicks": -24, "spectrum": [57, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 43, 57, 71, 86, 100, 100, 100, 100, 86, 71, 71, 43], "unison": "none", "envelopes": [], "isDrum": true } },
            //1.3 presets
            { name: "spectral phaser", generalMidi: false, settings: { "type": "spectrum", "volume": 0, "eqFilter": [{ "type": "low-pass", "cutoffHz": 8e3, "linearGain": 0.3536 }, { "type": "high-pass", "cutoffHz": 74.33, "linearGain": 0.25 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 10, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 8e3, "linearGain": 0.3536 }], "effects": ["note filter", "distortion", "bitcrusher", "chorus", "echo", "reverb"], "noteFilterType": false, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [{ "type": "peak", "cutoffHz": 9513.66, "linearGain": 5.6569 }, { "type": "peak", "cutoffHz": 5656.85, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 2828.43, "linearGain": 4 }, { "type": "peak", "cutoffHz": 1414.21, "linearGain": 0.125 }, { "type": "peak", "cutoffHz": 707.11, "linearGain": 4 }, { "type": "peak", "cutoffHz": 353.55, "linearGain": 0.1768 }, { "type": "peak", "cutoffHz": 148.65, "linearGain": 4 }, { "type": "peak", "cutoffHz": 88.39, "linearGain": 0.1768 }], "noteSubFilters0": [{ "type": "peak", "cutoffHz": 9513.66, "linearGain": 5.6569 }, { "type": "peak", "cutoffHz": 5656.85, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 2828.43, "linearGain": 4 }, { "type": "peak", "cutoffHz": 1414.21, "linearGain": 0.125 }, { "type": "peak", "cutoffHz": 707.11, "linearGain": 4 }, { "type": "peak", "cutoffHz": 353.55, "linearGain": 0.1768 }, { "type": "peak", "cutoffHz": 148.65, "linearGain": 4 }, { "type": "peak", "cutoffHz": 88.39, "linearGain": 0.1768 }], "distortion": 14, "aliases": false, "bitcrusherOctave": 6, "bitcrusherQuantization": 14, "chorus": 100, "echoSustain": 86, "echoDelayBeats": 1, "reverb": 32, "fadeInSeconds": 0, "fadeOutTicks": 48, "spectrum": [86, 0, 0, 0, 57, 0, 0, 71, 0, 0, 0, 86, 0, 0, 57, 0, 43, 0, 43, 0, 0, 43, 0, 29, 0, 29, 14, 14, 29, 14], "unison": "piano", "envelopes": [{ "target": "noteFilterFreq", "envelope": "tremolo", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 0.07, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "index": 0 }, { "target": "noteFilterFreq", "envelope": "tremolo", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 0.06, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "index": 1 }, { "target": "noteFilterFreq", "envelope": "tremolo", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 0.05, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "index": 2 }, { "target": "noteFilterFreq", "envelope": "tremolo", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 0.04, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "index": 3 }, { "target": "noteFilterFreq", "envelope": "tremolo", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 0.09, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "index": 4 }, { "target": "noteFilterFreq", "envelope": "tremolo", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 0.08, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "index": 5 }, { "target": "noteFilterFreq", "envelope": "tremolo", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 0.1, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "index": 6 }, { "target": "noteFilterFreq", "envelope": "tremolo", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 0.03, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "index": 7 }, { "target": "distortion", "envelope": "none", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 0, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 0.3 }], "isDrum": false } },
            { name: "shaker", generalMidi: false, isNoise: true, settings: { "type": "noise", "volume": 0, "eqFilter": [{ "type": "high-pass", "cutoffHz": 4e3, "linearGain": 5.6569 }, { "type": "peak", "cutoffHz": 4756.83, "linearGain": 0.0884 }, { "type": "low-pass", "cutoffHz": 11313.71, "linearGain": 8 }, { "type": "peak", "cutoffHz": 2378.41, "linearGain": 0.25 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 6, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "high-pass", "cutoffHz": 4e3, "linearGain": 5.6569 }, { "type": "peak", "cutoffHz": 4756.83, "linearGain": 0.0884 }, { "type": "low-pass", "cutoffHz": 11313.71, "linearGain": 8 }, { "type": "peak", "cutoffHz": 2378.41, "linearGain": 0.25 }], "effects": ["transition type", "detune", "distortion", "bitcrusher", "chorus", "echo", "reverb"], "transition": "interrupt", "clicklessTransition": false, "detuneCents": 30, "distortion": 43, "aliases": false, "bitcrusherOctave": 2.5, "bitcrusherQuantization": 43, "chorus": 43, "echoSustain": 29, "echoDelayBeats": 1, "reverb": 23, "fadeInSeconds": 0.0263, "fadeOutTicks": 96, "wave": "deep", "unison": "none", "envelopes": [{ "target": "detune", "envelope": "tremolo2", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 2, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }, { "target": "bitcrusherQuantization", "envelope": "note size", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 0, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }, { "target": "noteVolume", "envelope": "note size", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 0, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }, { "target": "noteVolume", "envelope": "flare", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 12, "inverse": false, "perEnvelopeSpeed": 64, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }], "isDrum": true } },
            { name: "distant sorrow", generalMidi: false, settings: { "type": "harmonics", "volume": 0, "eqFilter": [{ "type": "high-pass", "cutoffHz": 707.11, "linearGain": 4 }, { "type": "peak", "cutoffHz": 5656.85, "linearGain": 0.5 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "high-pass", "cutoffHz": 707.11, "linearGain": 4 }, { "type": "peak", "cutoffHz": 5656.85, "linearGain": 0.5 }], "effects": ["transition type", "detune", "vibrato", "note filter", "echo", "reverb"], "transition": "interrupt", "clicklessTransition": false, "detuneCents": 0, "vibrato": "custom", "vibratoDepth": 0.2, "vibratoDelay": 0, "vibratoSpeed": 10, "vibratoType": 0, "noteFilterType": false, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [{ "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 0.25 }], "noteSubFilters0": [{ "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 0.25 }], "echoSustain": 100, "echoDelayBeats": 1, "reverb": 74, "fadeInSeconds": 0, "fadeOutTicks": 24, "harmonics": [86, 71, 57, 43, 43, 29, 57, 0, 14, 0, 29, 29, 29, 29, 29, 43, 43, 43, 43, 43, 57, 57, 57, 0, 57, 57, 0, 0], "unison": "none", "envelopes": [{ "target": "noteVolume", "envelope": "fall", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 10, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }, { "target": "noteFilterAllFreqs", "envelope": "swell", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 2.5, "perEnvelopeLowerBound": 0.5, "perEnvelopeUpperBound": 2 }], "isDrum": false } },
            { name: "metallic kick", generalMidi: false, settings: { "type": "FM", "volume": 0, "eqFilter": [{ "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 0.5 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 28, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 0.5 }], "effects": [], "panDelay": 0, "fadeInSeconds": 0, "fadeOutTicks": -1, "algorithm": "1\u2190(2\u20023\u20024)", "feedbackType": "1\u21922\u21923\u21924", "feedbackAmplitude": 15, "operators": [{ "frequency": "8\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "256\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "128\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "256\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [{ "target": "operatorFrequency", "envelope": "twang", "inverse": false, "perEnvelopeSpeed": 16, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "index": 0 }, { "target": "noteVolume", "envelope": "twang", "inverse": false, "perEnvelopeSpeed": 3.5, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }, { "target": "feedbackAmplitude", "envelope": "twang", "inverse": false, "perEnvelopeSpeed": 256, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }, { "target": "operatorAmplitude", "envelope": "twang", "inverse": false, "perEnvelopeSpeed": 256, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "index": 1 }, { "target": "operatorAmplitude", "envelope": "twang", "inverse": false, "perEnvelopeSpeed": 256, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "index": 3 }, { "target": "operatorAmplitude", "envelope": "twang", "inverse": false, "perEnvelopeSpeed": 256, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "index": 2 }], "isDrum": false } },
            //1.4 presets
            { name: "chimes", generalMidi: false, settings: { "type": "Picked String", "volume": 0, "eqFilter": [{ "type": "high-pass", "cutoffHz": 594.6, "linearGain": 0.5 }, { "type": "peak", "cutoffHz": 5656.85, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 8e3, "linearGain": 2.8284 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "high-pass", "cutoffHz": 594.6, "linearGain": 0.5 }, { "type": "peak", "cutoffHz": 5656.85, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 8e3, "linearGain": 2.8284 }], "effects": ["chord type", "detune", "note filter", "bitcrusher", "chorus", "echo", "reverb"], "chord": "strum", "fastTwoNoteArp": false, "arpeggioSpeed": 12, "detuneCents": 24, "noteFilterType": false, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [{ "type": "low-pass", "cutoffHz": 2378.41, "linearGain": 0.5 }], "noteSubFilters0": [{ "type": "low-pass", "cutoffHz": 2378.41, "linearGain": 0.5 }], "noteSubFilters1": [{ "type": "low-pass", "cutoffHz": 2378.41, "linearGain": 1 }], "bitcrusherOctave": 4, "bitcrusherQuantization": 29, "panDelay": 0, "chorus": 29, "echoSustain": 86, "echoDelayBeats": 0.667, "reverb": 84, "fadeInSeconds": 0, "fadeOutTicks": 48, "harmonics": [0, 100, 71, 71, 29, 0, 57, 86, 0, 0, 0, 0, 71, 29, 0, 0, 57, 0, 0, 86, 0, 0, 0, 100, 0, 100, 0, 57], "unison": "none", "stringSustain": 36, "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "twang", "inverse": false, "perEnvelopeSpeed": 2, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }, { "target": "bitcrusherQuantization", "envelope": "swell", "inverse": false, "perEnvelopeSpeed": 4.5, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }, { "target": "bitcrusherQuantization", "envelope": "note size", "inverse": false, "perEnvelopeSpeed": 0, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }, { "target": "noteVolume", "envelope": "note size", "inverse": false, "perEnvelopeSpeed": 0, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }, { "target": "stringSustain", "envelope": "random", "inverse": false, "perEnvelopeSpeed": 16, "perEnvelopeLowerBound": 0.5, "perEnvelopeUpperBound": 1, "steps": 14, "seed": 2, "waveform": 0 }, { "target": "detune", "envelope": "pitch", "inverse": false, "perEnvelopeSpeed": 0, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96 }], "isDrum": false } },
            { name: "supersaw bass", generalMidi: false, settings: { "type": "supersaw", "volume": 0, "eqFilter": [], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "eqSubFilters0": [], "effects": ["panning", "vibrato", "note filter", "bitcrusher", "chorus"], "vibrato": "custom", "vibratoDepth": 0.16, "vibratoDelay": 0, "vibratoSpeed": 4, "vibratoType": 0, "noteFilterType": false, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [{ "type": "peak", "cutoffHz": 250, "linearGain": 11.3137 }, { "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 0.25 }, { "type": "peak", "cutoffHz": 1414.21, "linearGain": 2.8284 }], "noteSubFilters0": [{ "type": "peak", "cutoffHz": 250, "linearGain": 11.3137 }, { "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 0.25 }, { "type": "peak", "cutoffHz": 1414.21, "linearGain": 2.8284 }], "noteSubFilters1": [{ "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 1 }], "bitcrusherOctave": 5.5, "bitcrusherQuantization": 100, "pan": 0, "panDelay": 0, "chorus": 57, "fadeInSeconds": 0, "fadeOutTicks": 24, "pulseWidth": 33, "decimalOffset": 0, "dynamism": 83, "spread": 67, "shape": 83, "envelopes": [{ "target": "pulseWidth", "envelope": "flare", "inverse": false, "perEnvelopeSpeed": 7, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "discrete": false }, { "target": "noteFilterFreq", "envelope": "linear", "inverse": false, "perEnvelopeSpeed": 8, "perEnvelopeLowerBound": 0.3, "perEnvelopeUpperBound": 1, "discrete": false, "index": 0 }, { "target": "bitcrusherQuantization", "envelope": "twang", "inverse": false, "perEnvelopeSpeed": 14, "perEnvelopeLowerBound": 1, "perEnvelopeUpperBound": 1.2, "discrete": true }, { "target": "noteFilterFreq", "envelope": "random", "inverse": false, "perEnvelopeSpeed": 0.3333, "perEnvelopeLowerBound": 0.3, "perEnvelopeUpperBound": 1, "discrete": false, "index": 2, "seed": 2, "waveform": 3 }, { "target": "noteVolume", "envelope": "note size", "inverse": false, "perEnvelopeSpeed": 1, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "discrete": false }, { "target": "bitcrusherQuantization", "envelope": "note size", "inverse": false, "perEnvelopeSpeed": 1, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "discrete": false }, { "target": "supersawDynamism", "envelope": "note size", "inverse": false, "perEnvelopeSpeed": 1, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "discrete": false }], "isDrum": false } },
            { name: "ascension", generalMidi: false, isNoise: false, settings: { "type": "spectrum", "volume": 0, "eqFilter": [{ "type": "low-pass", "cutoffHz": 4756.83, "linearGain": 0.3536 }, { "type": "high-pass", "cutoffHz": 420.45, "linearGain": 0.25 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 4756.83, "linearGain": 0.3536 }, { "type": "high-pass", "cutoffHz": 420.45, "linearGain": 0.25 }], "eqSubFilters1": [], "effects": ["panning", "detune", "granular", "chorus", "reverb"], "detuneCents": 12, "granular": 7, "grainSize": 44, "grainAmounts": 9, "grainRange": 37, "pan": 0, "panDelay": 0, "chorus": 71, "reverb": 19, "fadeInSeconds": 0, "fadeOutTicks": 24, "spectrum": [43, 0, 0, 57, 0, 0, 14, 100, 29, 0, 0, 100, 29, 0, 100, 0, 57, 29, 86, 14, 14, 100, 14, 0, 14, 14, 0, 0, 43, 0], "unison": "custom", "unisonVoices": 2, "unisonSpread": 9.5, "unisonOffset": 9.5, "unisonExpression": 1, "unisonSign": 1, "envelopes": [{ "target": "noteVolume", "envelope": "swell", "inverse": false, "perEnvelopeSpeed": 0.7, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "discrete": false }, { "target": "panning", "envelope": "lfo", "inverse": false, "perEnvelopeSpeed": 0.3, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "discrete": false, "waveform": 2, "steps": 2 }], "isDrum": false } },
            { name: "liminal", generalMidi: false, isNoise: false, settings: { "type": "supersaw", "volume": 0, "eqFilter": [{ "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 1.4142 }, { "type": "high-pass", "cutoffHz": 840.9, "linearGain": 0.25 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 1.4142 }, { "type": "high-pass", "cutoffHz": 840.9, "linearGain": 0.25 }], "effects": ["detune", "vibrato", "note filter", "granular", "distortion", "bitcrusher", "chorus", "reverb"], "detuneCents": 8, "vibrato": "custom", "vibratoDepth": 0.48, "vibratoDelay": 0, "vibratoSpeed": 10, "vibratoType": 0, "noteFilterType": true, "noteSimpleCut": 6, "noteSimplePeak": 2, "noteFilter": [{ "type": "low-pass", "cutoffHz": 2196.8, "linearGain": 1 }], "noteSubFilters1": [{ "type": "low-pass", "cutoffHz": 2196.8, "linearGain": 1 }], "granular": 6, "grainSize": 49, "grainAmounts": 10, "grainRange": 40, "distortion": 57, "aliases": false, "bitcrusherOctave": 5, "bitcrusherQuantization": 0, "chorus": 29, "reverb": 48, "fadeInSeconds": 0, "fadeOutTicks": 72, "pulseWidth": 30, "decimalOffset": 0, "dynamism": 17, "spread": 83, "shape": 67, "envelopes": [{ "target": "noteVolume", "envelope": "twang", "inverse": false, "perEnvelopeSpeed": 17, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "discrete": false }, { "target": "pulseWidth", "envelope": "twang", "inverse": false, "perEnvelopeSpeed": 1.3333, "perEnvelopeLowerBound": 0.1, "perEnvelopeUpperBound": 1, "discrete": false }, { "target": "distortion", "envelope": "random", "inverse": false, "perEnvelopeSpeed": 1, "perEnvelopeLowerBound": 0.2, "perEnvelopeUpperBound": 1, "discrete": true, "steps": 8, "seed": 2, "waveform": 2 }, { "target": "panning", "envelope": "lfo", "inverse": false, "perEnvelopeSpeed": 0.3333, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "discrete": false, "waveform": 2, "steps": 2 }, { "target": "noteVolume", "envelope": "swell", "inverse": false, "perEnvelopeSpeed": 18, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "discrete": false }, { "target": "noteVolume", "envelope": "note size", "inverse": false, "perEnvelopeSpeed": 0, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "discrete": false }, { "target": "granular", "envelope": "note size", "inverse": false, "perEnvelopeSpeed": 0, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "discrete": false }], "isDrum": false } }
          ])
        },
        {
          name: "Slarmoo's Box Chip Presets",
          presets: toNameMap([
            //Made by Slarmoo
            { name: "Slarmoo's Pulse", midiProgram: 80, settings: { "type": "PWM", "volume": 0, "eqFilter": [], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [], "effects": ["transition type", "chord type", "detune"], "transition": "interrupt", "clicklessTransition": false, "chord": "arpeggio", "fastTwoNoteArp": true, "arpeggioSpeed": 8, "detuneCents": 24, "fadeInSeconds": 0, "fadeOutTicks": -1, "pulseWidth": 50, "decimalOffset": 0, "unison": "none", "pitchEnvelopeStart0": 0, "pitchEnvelopeEnd0": 96, "envelopeInverse0": false, "envelopes": [{ "target": "detune", "envelope": "pitch" }], "isDrum": false } },
            { name: "discovery square", midiProgram: 80, settings: { "type": "chip", "volume": 0, "eqFilter": [{ "type": "low-pass", "cutoffHz": 8e3, "linearGain": 0.3536 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 8e3, "linearGain": 0.3536 }], "effects": ["bitcrusher"], "bitcrusherOctave": 5.5, "bitcrusherQuantization": 57, "fadeInSeconds": 0, "fadeOutTicks": -3, "wave": "square", "unison": "octave", "isUsingAdvancedLoopControls": false, "chipWaveLoopStart": 0, "chipWaveLoopEnd": 2, "chipWaveLoopMode": 0, "chipWavePlayBackwards": false, "chipWaveStartOffset": 0, "envelopes": [], "isDrum": false } },
            //I got this from masked eternity, though I believe that someone else made it
            { name: "VRC6 Sawtooth alt", midiProgram: 81, settings: { "type": "custom chip", "volume": 0, "eqFilter": [{ "type": "high-pass", "cutoffHz": 62.5, "linearGain": 0.5 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "high-pass", "cutoffHz": 62.5, "linearGain": 0.5 }], "effects": ["transition type", "chord type", "pitch shift", "detune", "vibrato", "distortion"], "transition": "interrupt", "clicklessTransition": false, "chord": "arpeggio", "fastTwoNoteArp": true, "arpeggioSpeed": 12, "pitchShiftSemitones": 12, "detuneCents": 0, "vibrato": "none", "vibratoDepth": 0, "vibratoDelay": 0, "vibratoSpeed": 10, "vibratoType": 0, "distortion": 0, "aliases": false, "fadeInSeconds": 0, "fadeOutTicks": -1, "wave": "square", "unison": "none", "customChipWave": { "0": -1, "1": -1, "2": -1, "3": -1, "4": -1, "5": -1, "6": -1, "7": -1, "8": -1, "9": -5, "10": -5, "11": -5, "12": -4, "13": -4, "14": -4, "15": -3, "16": -3, "17": -3, "18": -7, "19": -7, "20": -6, "21": -6, "22": -5, "23": -5, "24": -4, "25": -4, "26": -4, "27": -7, "28": -7, "29": -6, "30": -6, "31": -5, "32": -5, "33": -4, "34": -4, "35": -4, "36": -8, "37": -8, "38": -7, "39": -7, "40": -6, "41": -6, "42": -5, "43": -5, "44": -4, "45": -4, "46": 21, "47": 20, "48": 18, "49": 17, "50": 16, "51": 14, "52": 13, "53": 12, "54": 11, "55": 7, "56": 6, "57": 6, "58": 5, "59": 5, "60": 5, "61": 4, "62": 4, "63": 4 }, "customChipWaveIntegral": { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0, "10": 0, "11": 0, "12": 0, "13": 0, "14": 0, "15": 0, "16": 0, "17": 0, "18": 0, "19": 0, "20": 0, "21": 0, "22": 0, "23": 0, "24": 0, "25": 0, "26": 0, "27": 0, "28": 0, "29": 0, "30": 0, "31": 0, "32": 0, "33": 0, "34": 0, "35": 0, "36": 0, "37": 0, "38": 0, "39": 0, "40": 0, "41": 0, "42": 0, "43": 0, "44": 0, "45": 0, "46": 0, "47": 0, "48": 0, "49": 0, "50": 0, "51": 0, "52": 0, "53": 0, "54": 0, "55": 0, "56": 0, "57": 0, "58": 0, "59": 0, "60": 0, "61": 0, "62": 0, "63": 0, "64": 0 }, "envelopes": [], "isDrum": false } },
            //Made by Slarmoo
            { name: "pulse arps", midiProgram: 80, settings: { "type": "PWM", "volume": 0, "eqFilter": [{ "type": "low-pass", "cutoffHz": 16e3, "linearGain": 0.125 }, { "type": "high-pass", "cutoffHz": 840.9, "linearGain": 2 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 7, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 16e3, "linearGain": 0.125 }, { "type": "high-pass", "cutoffHz": 840.9, "linearGain": 2 }], "effects": ["transition type", "chord type", "detune", "chorus", "echo"], "transition": "interrupt", "clicklessTransition": false, "chord": "arpeggio", "fastTwoNoteArp": true, "arpeggioSpeed": 8, "detuneCents": 64, "chorus": 43, "echoSustain": 71, "echoDelayBeats": 0.333, "fadeInSeconds": 0, "fadeOutTicks": -1, "pulseWidth": 50, "decimalOffset": 0, "unison": "none", "envelopes": [{ "target": "detune", "envelope": "pitch", "inverse": false, "perEnvelopeSpeed": 0, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96 }, { "target": "pulseWidth", "envelope": "pitch", "inverse": true, "perEnvelopeSpeed": 0, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "pitchEnvelopeStart": 24, "pitchEnvelopeEnd": 83 }, { "target": "panning", "envelope": "lfo", "inverse": false, "perEnvelopeSpeed": 1, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "waveform": 0, "steps": 2 }, { "target": "noteVolume", "envelope": "twang", "inverse": false, "perEnvelopeSpeed": 32, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }, { "target": "chorus", "envelope": "twang", "inverse": false, "perEnvelopeSpeed": 32, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }], "isDrum": false } }
          ])
        },
        {
          name: "Slarmoo's Box Instrumental Presets",
          presets: toNameMap([
            //Made by Slarmoo
            { name: "rusty flute", midiProgram: 73, settings: { "type": "FM", "eqFilter": [{ "type": "peak", "cutoffHz": 13454.34, "linearGain": 2.8284 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "peak", "cutoffHz": 13454.34, "linearGain": 2.8284 }], "effects": ["transition type", "detune", "distortion", "reverb"], "transition": "normal", "clicklessTransition": false, "detuneCents": -7, "distortion": 14, "aliases": false, "reverb": 100, "fadeInSeconds": 0, "fadeOutTicks": 96, "algorithm": "1\u21902\u21903\u21904", "feedbackType": "3\u21924", "feedbackAmplitude": 8, "operators": [{ "frequency": "1\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "2\xD7", "amplitude": 5, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "2\xD7", "amplitude": 4, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "20\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [], "isDrum": false } },
            { name: "bitcrushed piano", midiProgram: 4, settings: { "type": "chip", "volume": 0, "eqFilter": [{ "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 0.25 }, { "type": "peak", "cutoffHz": 840.9, "linearGain": 2.8284 }, { "type": "high-pass", "cutoffHz": 74.33, "linearGain": 0.5 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 0.25 }, { "type": "peak", "cutoffHz": 840.9, "linearGain": 2.8284 }, { "type": "high-pass", "cutoffHz": 74.33, "linearGain": 0.5 }], "effects": ["transition type", "detune", "distortion", "bitcrusher", "reverb"], "transition": "continue", "clicklessTransition": false, "detuneCents": 0, "distortion": 29, "aliases": true, "bitcrusherOctave": 4, "bitcrusherQuantization": 43, "panDelay": 0, "reverb": 0, "fadeInSeconds": 0, "fadeOutTicks": -3, "wave": "triangle", "unison": "none", "isUsingAdvancedLoopControls": true, "chipWaveLoopStart": 0, "chipWaveLoopEnd": 32, "chipWaveLoopMode": 0, "chipWavePlayBackwards": false, "chipWaveStartOffset": 0, "envelopes": [{ "target": "bitcrusherQuantization", "envelope": "note size", "inverse": false, "perEnvelopeSpeed": 0, "perEnvelopeLowerBound": 0.6, "perEnvelopeUpperBound": 1, "discrete": false }, { "target": "noteVolume", "envelope": "note size", "inverse": false, "perEnvelopeSpeed": 0, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "discrete": false }], "isDrum": false } },
            { name: "detuned piano", midiProgram: 3, settings: { "type": "Picked String", "volume": 0, "eqFilter": [{ "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 0.25 }, { "type": "peak", "cutoffHz": 840.9, "linearGain": 2.8284 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 0.25 }, { "type": "peak", "cutoffHz": 840.9, "linearGain": 2.8284 }], "effects": ["transition type", "detune", "vibrato", "note filter", "bitcrusher"], "transition": "continue", "clicklessTransition": false, "detuneCents": 44, "vibrato": "custom", "vibratoDepth": 0.04, "vibratoDelay": 13, "vibratoSpeed": 10, "vibratoType": 0, "noteFilterType": false, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [{ "type": "high-pass", "cutoffHz": 420.45, "linearGain": 1 }], "noteSubFilters0": [{ "type": "high-pass", "cutoffHz": 420.45, "linearGain": 1 }], "bitcrusherOctave": 4, "bitcrusherQuantization": 14, "fadeInSeconds": 0, "fadeOutTicks": -3, "harmonics": [86, 86, 71, 71, 57, 57, 43, 29, 14, 29, 29, 29, 29, 29, 29, 29, 29, 43, 43, 43, 43, 43, 29, 14, 14, 0, 0, 0], "unison": "custom", "unisonVoices": 2, "unisonSpread": 0.26, "unisonOffset": 0, "unisonExpression": 1, "unisonSign": 1, "stringSustain": 79, "envelopes": [{ "target": "detune", "envelope": "random", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 1, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "steps": 2, "seed": 49, "waveform": 1 }, { "target": "noteVolume", "envelope": "twang", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 1.6667, "perEnvelopeLowerBound": 0.4, "perEnvelopeUpperBound": 1, "steps": 2, "seed": 2, "waveform": 0 }, { "target": "unison", "envelope": "random", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 1, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "steps": 2, "seed": 20, "waveform": 1 }, { "target": "noteFilterAllFreqs", "envelope": "pitch", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": true, "perEnvelopeSpeed": 0, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "steps": 2, "seed": 2, "waveform": 0 }], "isDrum": false } },
            { name: "pan flute 2", midiProgram: 75, isNoise: false, settings: { "type": "spectrum", "volume": 0, "eqFilter": [{ "type": "peak", "cutoffHz": 2828.43, "linearGain": 2 }, { "type": "high-pass", "cutoffHz": 594.6, "linearGain": 0.3536 }, { "type": "low-pass", "cutoffHz": 8e3, "linearGain": 0.5 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "peak", "cutoffHz": 2828.43, "linearGain": 2 }, { "type": "high-pass", "cutoffHz": 594.6, "linearGain": 0.3536 }, { "type": "low-pass", "cutoffHz": 8e3, "linearGain": 0.5 }], "effects": ["transition type", "note filter", "bitcrusher", "reverb"], "transition": "continue", "clicklessTransition": false, "noteFilterType": false, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [{ "type": "low-pass", "cutoffHz": 9513.66, "linearGain": 0.5 }], "noteSubFilters0": [{ "type": "low-pass", "cutoffHz": 9513.66, "linearGain": 0.5 }], "noteSubFilters1": [{ "type": "low-pass", "cutoffHz": 9513.66, "linearGain": 0.5 }], "bitcrusherOctave": 6, "bitcrusherQuantization": 57, "reverb": 16, "fadeInSeconds": 0.0125, "fadeOutTicks": -6, "spectrum": [100, 29, 14, 14, 57, 0, 0, 71, 0, 86, 57, 43, 57, 71, 14, 29, 14, 14, 14, 100, 71, 14, 14, 14, 14, 86, 43, 14, 0, 0], "unison": "none", "pitchEnvelopeStart0": 0, "pitchEnvelopeEnd0": 96, "envelopeInverse0": false, "pitchEnvelopeStart1": 0, "pitchEnvelopeEnd1": 96, "envelopeInverse1": false, "pitchEnvelopeStart2": 0, "pitchEnvelopeEnd2": 96, "envelopeInverse2": false, "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "note size" }, { "target": "bitcrusherQuantization", "envelope": "note size" }, { "target": "noteVolume", "envelope": "note size" }], "isDrum": false } },
            { name: "trumpet 2", midiProgram: 56, settings: { "type": "FM", "volume": 0, "eqFilter": [{ "type": "low-pass", "cutoffHz": 3049.17, "linearGain": 1.4142 }], "eqFilterType": true, "eqSimpleCut": 7, "eqSimplePeak": 3, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters1": [], "effects": ["detune", "vibrato", "note filter", "distortion", "chorus", "reverb"], "detuneCents": -64, "vibrato": "custom", "vibratoDepth": 0.68, "vibratoDelay": 17, "vibratoSpeed": 12, "vibratoType": 0, "noteFilterType": false, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [{ "type": "low-pass", "cutoffHz": 13454.34, "linearGain": 0.5 }, { "type": "peak", "cutoffHz": 3363.59, "linearGain": 0.1768 }, { "type": "high-pass", "cutoffHz": 1e3, "linearGain": 0.1768 }], "noteSubFilters0": [{ "type": "low-pass", "cutoffHz": 13454.34, "linearGain": 0.5 }, { "type": "peak", "cutoffHz": 3363.59, "linearGain": 0.1768 }, { "type": "high-pass", "cutoffHz": 1e3, "linearGain": 0.1768 }], "distortion": 29, "aliases": false, "chorus": 14, "reverb": 0, "fadeInSeconds": 0.0263, "fadeOutTicks": -3, "algorithm": "1\u20032\u2190(3\u20024)", "feedbackType": "1\u27F2", "feedbackAmplitude": 9, "operators": [{ "frequency": "0.75\xD7", "amplitude": 14, "waveform": "pulse width", "pulseWidth": 2 }, { "frequency": "1\xD7", "amplitude": 14, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 8, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 5, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [{ "target": "operatorAmplitude", "envelope": "flare", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 8, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "index": 3 }, { "target": "feedbackAmplitude", "envelope": "swell", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 32, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }, { "target": "operatorFrequency", "envelope": "decay", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 128, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "index": 0 }, { "target": "noteFilterFreq", "envelope": "swell", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 2.5, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "index": 2 }, { "target": "noteVolume", "envelope": "note size", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 0, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }, { "target": "detune", "envelope": "note size", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": true, "perEnvelopeSpeed": 0, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }], "isDrum": false } },
            { name: "harp 2", midiProgram: 46, settings: { "type": "FM6op", "volume": 0, "eqFilter": [{ "type": "low-pass", "cutoffHz": 13454.34, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 1e3, "linearGain": 2.8284 }, { "type": "high-pass", "cutoffHz": 62.5, "linearGain": 0.25 }, { "type": "high-pass", "cutoffHz": 148.65, "linearGain": 0.5 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 13454.34, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 1e3, "linearGain": 2.8284 }, { "type": "high-pass", "cutoffHz": 62.5, "linearGain": 0.25 }, { "type": "high-pass", "cutoffHz": 148.65, "linearGain": 0.5 }], "eqSubFilters1": [], "effects": ["detune", "note filter", "echo", "reverb"], "detuneCents": -23, "noteFilterType": false, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [{ "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 105.11, "linearGain": 2.8284 }], "noteSubFilters0": [{ "type": "low-pass", "cutoffHz": 6727.17, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 105.11, "linearGain": 2.8284 }], "echoSustain": 29, "echoDelayBeats": 1.083, "reverb": 74, "fadeInSeconds": 0, "fadeOutTicks": -1, "algorithm": "1\u21904\u20032\u21905\u20033\u21906", "feedbackType": "1\u27F2", "feedbackAmplitude": 5, "operators": [{ "frequency": "1\xD7", "amplitude": 10, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 5, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 10, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "4\xD7", "amplitude": 6, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "6\xD7", "amplitude": 12, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 2, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [{ "target": "noteVolume", "envelope": "decay", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 4, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }, { "target": "operatorFrequency", "envelope": "tremolo", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 8, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "index": 1 }, { "target": "detune", "envelope": "decay", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 7, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }, { "target": "noteFilterFreq", "envelope": "tremolo2", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 1, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "index": 0 }, { "target": "operatorAmplitude", "envelope": "twang", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 8, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "index": 4 }, { "target": "operatorAmplitude", "envelope": "swell", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": true, "perEnvelopeSpeed": 8, "perEnvelopeLowerBound": 0.4, "perEnvelopeUpperBound": 1, "index": 0 }, { "target": "noteVolume", "envelope": "punch", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 0, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }], "isDrum": false } },
            { name: "electric guitar 1", midiProgram: 30, settings: { "type": "FM", "volume": 0, "eqFilter": [{ "type": "high-pass", "cutoffHz": 1189.21, "linearGain": 2 }, { "type": "low-pass", "cutoffHz": 4e3, "linearGain": 1.4142 }, { "type": "peak", "cutoffHz": 707.11, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 420.45, "linearGain": 0.0884 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "eqSubFilters0": [{ "type": "high-pass", "cutoffHz": 1189.21, "linearGain": 2 }, { "type": "low-pass", "cutoffHz": 4e3, "linearGain": 1.4142 }, { "type": "peak", "cutoffHz": 707.11, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 420.45, "linearGain": 0.0884 }], "effects": ["chord type", "vibrato", "note filter", "distortion", "reverb"], "chord": "monophonic", "fastTwoNoteArp": false, "arpeggioSpeed": 12, "monoChordTone": 0, "vibrato": "delayed", "vibratoDepth": 0.3, "vibratoDelay": 18.5, "vibratoSpeed": 10, "vibratoType": 0, "noteFilterType": false, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [{ "type": "low-pass", "cutoffHz": 1414.21, "linearGain": 4 }, { "type": "high-pass", "cutoffHz": 594.6, "linearGain": 1 }], "noteSubFilters0": [{ "type": "low-pass", "cutoffHz": 1414.21, "linearGain": 4 }, { "type": "high-pass", "cutoffHz": 594.6, "linearGain": 1 }], "distortion": 100, "aliases": false, "panDelay": 0, "reverb": 6, "fadeInSeconds": 0, "fadeOutTicks": 24, "algorithm": "1\u20032\u20033\u20034", "feedbackType": "1\u27F2", "feedbackAmplitude": 0, "operators": [{ "frequency": "1\xD7", "amplitude": 15, "waveform": "sawtooth", "pulseWidth": 5 }, { "frequency": "2\xD7", "amplitude": 0, "waveform": "sawtooth", "pulseWidth": 5 }, { "frequency": "4\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "0.25\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [{ "target": "noteVolume", "envelope": "punch", "inverse": false, "perEnvelopeSpeed": 0, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "discrete": false }, { "target": "vibratoDepth", "envelope": "rise", "inverse": false, "perEnvelopeSpeed": 9, "perEnvelopeLowerBound": 1, "perEnvelopeUpperBound": 2, "discrete": false }, { "target": "noteVolume", "envelope": "note size", "inverse": false, "perEnvelopeSpeed": 0, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "discrete": false }, { "target": "distortion", "envelope": "note size", "inverse": false, "perEnvelopeSpeed": 0, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "discrete": false }], "isDrum": false } },
            { name: "electric guitar 2", midiProgram: 30, settings: { "type": "PWM", "volume": 0, "eqFilter": [{ "type": "low-pass", "cutoffHz": 3363.59, "linearGain": 5.6569 }, { "type": "high-pass", "cutoffHz": 1681.79, "linearGain": 0.25 }, { "type": "peak", "cutoffHz": 5656.85, "linearGain": 2 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 3363.59, "linearGain": 5.6569 }, { "type": "high-pass", "cutoffHz": 1681.79, "linearGain": 0.25 }, { "type": "peak", "cutoffHz": 5656.85, "linearGain": 2 }], "effects": ["chord type", "vibrato", "note filter", "distortion", "bitcrusher", "chorus", "reverb"], "chord": "monophonic", "fastTwoNoteArp": false, "arpeggioSpeed": 12, "monoChordTone": 0, "vibrato": "custom", "vibratoDepth": 0.68, "vibratoDelay": 22, "vibratoSpeed": 10, "vibratoType": 0, "noteFilterType": false, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [{ "type": "low-pass", "cutoffHz": 1e3, "linearGain": 2.8284 }], "noteSubFilters0": [{ "type": "low-pass", "cutoffHz": 1e3, "linearGain": 2.8284 }], "distortion": 43, "aliases": false, "bitcrusherOctave": 6.5, "bitcrusherQuantization": 71, "panDelay": 0, "chorus": 14, "reverb": 13, "fadeInSeconds": 0, "fadeOutTicks": 24, "pulseWidth": 50, "decimalOffset": 0, "unison": "none", "envelopes": [{ "target": "noteFilterAllFreqs", "envelope": "rise", "inverse": false, "perEnvelopeSpeed": 0.3333, "perEnvelopeLowerBound": 0.8, "perEnvelopeUpperBound": 1, "discrete": false }, { "target": "pulseWidth", "envelope": "twang", "inverse": true, "perEnvelopeSpeed": 2.25, "perEnvelopeLowerBound": 0.5, "perEnvelopeUpperBound": 0.9, "discrete": false }, { "target": "noteVolume", "envelope": "note size", "inverse": false, "perEnvelopeSpeed": 0, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "discrete": false }, { "target": "bitcrusherQuantization", "envelope": "note size", "inverse": false, "perEnvelopeSpeed": 0, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "discrete": false }], "isDrum": false } },
            { name: "tremolo strings 2", midiProgram: 44, settings: { "type": "FM", "volume": 0, "eqFilter": [{ "type": "low-pass", "cutoffHz": 1681.79, "linearGain": 0.5 }, { "type": "high-pass", "cutoffHz": 297.3, "linearGain": 1 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 1681.79, "linearGain": 0.5 }, { "type": "high-pass", "cutoffHz": 297.3, "linearGain": 1 }], "effects": ["panning", "transition type", "vibrato", "granular", "chorus", "reverb"], "transition": "slide", "clicklessTransition": false, "vibrato": "custom", "vibratoDepth": 0.04, "vibratoDelay": 0, "vibratoSpeed": 3, "vibratoType": 1, "granular": 10, "grainSize": 49, "grainAmounts": 4, "grainRange": 40, "pan": 0, "panDelay": 0, "chorus": 43, "reverb": 68, "fadeInSeconds": 0.0413, "fadeOutTicks": 96, "algorithm": "(1\u20022)\u2190(3\u20024)", "feedbackType": "1\u21922", "feedbackAmplitude": 9, "operators": [{ "frequency": "2\xD7", "amplitude": 9, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "3\xD7", "amplitude": 9, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "2\xD7", "amplitude": 2, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "7\xD7", "amplitude": 6, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [{ "target": "operatorAmplitude", "envelope": "swell", "inverse": false, "perEnvelopeSpeed": 32, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "discrete": false, "index": 3 }, { "target": "feedbackAmplitude", "envelope": "twang", "inverse": false, "perEnvelopeSpeed": 2, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "discrete": false }, { "target": "noteVolume", "envelope": "lfo", "inverse": false, "perEnvelopeSpeed": 4, "perEnvelopeLowerBound": 0.5, "perEnvelopeUpperBound": 1, "discrete": false, "waveform": 0, "steps": 2 }, { "target": "noteVolume", "envelope": "note size", "inverse": false, "perEnvelopeSpeed": 1, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "discrete": false }, { "target": "granular", "envelope": "note size", "inverse": false, "perEnvelopeSpeed": 1, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "discrete": false }], "isDrum": false } }
          ])
        },
        {
          name: "Slarmoo's Box Novelty Presets",
          presets: toNameMap([
            //Made by Slarmoo
            { name: "bitcrushed artifacts", generalMidi: false, settings: { "type": "Picked String", "eqFilter": [{ "type": "low-pass", "cutoffHz": 9656.85, "linearGain": 0.5 }], "eqFilterType": true, "eqSimpleCut": 9, "eqSimplePeak": 1, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters1": [], "effects": ["distortion", "bitcrusher", "echo"], "distortion": 71, "aliases": false, "bitcrusherOctave": 2, "bitcrusherQuantization": 86, "echoSustain": 0, "echoDelayBeats": 1, "fadeInSeconds": 0, "fadeOutTicks": -6, "harmonics": [0, 0, 0, 0, 0, 0, 0, 57, 0, 0, 0, 0, 0, 0, 100, 43, 0, 0, 14, 86, 0, 14, 0, 0, 0, 0, 0, 86], "unison": "none", "stringSustain": 14, "envelopes": [], "isDrum": false } },
            { name: "whistle 2", midiProgram: 78, settings: { "type": "harmonics", "eqFilter": [{ "type": "low-pass", "cutoffHz": 2110.37, "linearGain": 1.4142 }], "eqFilterType": true, "eqSimpleCut": 6, "eqSimplePeak": 3, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters1": [], "effects": ["transition type", "pitch shift", "note filter", "distortion", "echo", "reverb"], "transition": "normal", "clicklessTransition": false, "pitchShiftSemitones": 11, "noteFilterType": false, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [{ "type": "low-pass", "cutoffHz": 1414.21, "linearGain": 2 }, { "type": "high-pass", "cutoffHz": 88.39, "linearGain": 2 }, { "type": "peak", "cutoffHz": 1681.79, "linearGain": 4 }], "noteSubFilters0": [{ "type": "low-pass", "cutoffHz": 1414.21, "linearGain": 2 }, { "type": "high-pass", "cutoffHz": 88.39, "linearGain": 2 }, { "type": "peak", "cutoffHz": 1681.79, "linearGain": 4 }], "distortion": 43, "aliases": false, "echoSustain": 57, "echoDelayBeats": 1.083, "reverb": 87, "fadeInSeconds": 0.0575, "fadeOutTicks": -1, "harmonics": [57, 0, 0, 0, 0, 0, 0, 0, 0, 86, 57, 0, 0, 0, 0, 0, 0, 0, 86, 0, 0, 0, 57, 29, 0, 29, 100, 0], "unison": "none", "envelopes": [{ "target": "pitchShift", "envelope": "decay 1" }], "isDrum": false } },
            { name: "frog wuh", generalMidi: false, settings: { "type": "spectrum", "eqFilter": [{ "type": "high-pass", "cutoffHz": 594.6, "linearGain": 0.5 }, { "type": "peak", "cutoffHz": 6727.17, "linearGain": 8 }, { "type": "low-pass", "cutoffHz": 13454.34, "linearGain": 0.125 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "high-pass", "cutoffHz": 594.6, "linearGain": 0.5 }, { "type": "peak", "cutoffHz": 6727.17, "linearGain": 8 }, { "type": "low-pass", "cutoffHz": 13454.34, "linearGain": 0.125 }], "eqSubFilters1": [], "effects": ["pitch shift", "note filter"], "pitchShiftSemitones": 0, "noteFilterType": false, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [{ "type": "low-pass", "cutoffHz": 1e3, "linearGain": 1 }], "noteSubFilters0": [{ "type": "low-pass", "cutoffHz": 1e3, "linearGain": 1 }], "fadeInSeconds": 0, "fadeOutTicks": -3, "spectrum": [100, 29, 14, 29, 0, 14, 0, 71, 0, 43, 14, 71, 0, 0, 71, 14, 100, 0, 71, 0, 43, 86, 43, 0, 43, 0, 0, 43, 29, 29], "envelopes": [{ "target": "pitchShift", "envelope": "twang 1" }, { "target": "noteFilterAllFreqs", "envelope": "twang 1" }], "isDrum": false } },
            { name: "stationary harmonics", generalMidi: false, settings: { "type": "harmonics", "eqFilter": [{ "type": "low-pass", "cutoffHz": 4756.83, "linearGain": 0.3536 }, { "type": "high-pass", "cutoffHz": 353.55, "linearGain": 1 }, { "type": "peak", "cutoffHz": 1189.21, "linearGain": 0.5 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 4756.83, "linearGain": 0.3536 }, { "type": "high-pass", "cutoffHz": 353.55, "linearGain": 1 }, { "type": "peak", "cutoffHz": 1189.21, "linearGain": 0.5 }], "effects": ["transition type", "chord type", "vibrato"], "transition": "continue", "clicklessTransition": false, "chord": "simultaneous", "fastTwoNoteArp": false, "arpeggioSpeed": 12, "vibrato": "shaky", "vibratoDepth": 0.1, "vibratoDelay": 0, "vibratoSpeed": 10, "vibratoType": 1, "fadeInSeconds": 0, "fadeOutTicks": 12, "harmonics": [100, 0, 57, 29, 14, 57, 29, 29, 14, 14, 29, 43, 14, 14, 14, 0, 14, 29, 29, 14, 0, 0, 14, 0, 0, 29, 14, 14], "unison": "stationary", "envelopes": [], "isDrum": false } },
            { name: "dead souls", generalMidi: false, settings: { "type": "spectrum", "volume": 0, "eqFilter": [{ "type": "low-pass", "cutoffHz": 8e3, "linearGain": 0.1768 }, { "type": "high-pass", "cutoffHz": 353.55, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 707.11, "linearGain": 1.4142 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": true, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 8e3, "linearGain": 0.1768 }, { "type": "high-pass", "cutoffHz": 353.55, "linearGain": 0.0884 }, { "type": "peak", "cutoffHz": 707.11, "linearGain": 1.4142 }], "effects": ["transition type", "chord type", "pitch shift", "detune", "distortion", "chorus", "reverb"], "transition": "interrupt", "clicklessTransition": false, "chord": "arpeggio", "fastTwoNoteArp": false, "arpeggioSpeed": 12, "pitchShiftSemitones": 24, "detuneCents": -200, "distortion": 100, "aliases": false, "chorus": 14, "reverb": 35, "fadeInSeconds": 0, "fadeOutTicks": -1, "spectrum": [100, 71, 43, 43, 29, 29, 29, 14, 14, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 57, 14, 14, 0, 0], "unison": "none", "envelopes": [{ "target": "pitchShift", "envelope": "random", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 24, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1.2, "steps": 16, "seed": 37, "waveform": 0 }, { "target": "noteVolume", "envelope": "note size", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 0, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "steps": 2, "seed": 2, "waveform": 0 }, { "target": "detune", "envelope": "note size", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": true, "perEnvelopeSpeed": 0, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "steps": 2, "seed": 2, "waveform": 0 }, { "target": "distortion", "envelope": "note size", "pitchEnvelopeStart": 0, "pitchEnvelopeEnd": 96, "inverse": false, "perEnvelopeSpeed": 0, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "steps": 2, "seed": 2, "waveform": 0 }], "isDrum": false } },
            { name: "flutter", generalMidi: false, settings: { "type": "FM", "volume": 0, "eqFilter": [{ "type": "high-pass", "cutoffHz": 707.11, "linearGain": 1 }, { "type": "peak", "cutoffHz": 6727.17, "linearGain": 2.8284 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "high-pass", "cutoffHz": 707.11, "linearGain": 1 }, { "type": "peak", "cutoffHz": 6727.17, "linearGain": 2.8284 }], "effects": ["transition type", "chorus", "reverb", "ring mod"], "transition": "interrupt", "clicklessTransition": false, "ringMod": 100, "ringModHz": 100, "ringModWaveformIndex": 0, "panDelay": 0, "chorus": 14, "reverb": 10, "fadeInSeconds": 0, "fadeOutTicks": 12, "algorithm": "1\u21903\u20032\u21904", "feedbackType": "1\u27F2", "feedbackAmplitude": 3, "operators": [{ "frequency": "1\xD7", "amplitude": 15, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 10, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }, { "frequency": "1\xD7", "amplitude": 0, "waveform": "sine", "pulseWidth": 5 }], "envelopes": [{ "target": "ringModulationHz", "envelope": "fall", "inverse": false, "perEnvelopeSpeed": 1.5, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1.9 }, { "target": "noteVolume", "envelope": "blip", "inverse": false, "perEnvelopeSpeed": 0.25, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1 }], "isDrum": false } },
            { name: "vinyl", generalMidi: false, isNoise: true, settings: { "type": "noise", "volume": 0, "eqFilter": [{ "type": "high-pass", "cutoffHz": 1414.21, "linearGain": 0.3536 }, { "type": "low-pass", "cutoffHz": 1189.21, "linearGain": 0.25 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "discreteEnvelope": false, "eqSubFilters0": [{ "type": "high-pass", "cutoffHz": 1414.21, "linearGain": 0.3536 }, { "type": "low-pass", "cutoffHz": 1189.21, "linearGain": 0.25 }], "effects": ["transition type", "note filter", "distortion", "bitcrusher", "chorus", "echo", "reverb"], "transition": "interrupt", "clicklessTransition": false, "noteFilterType": false, "noteSimpleCut": 10, "noteSimplePeak": 0, "noteFilter": [{ "type": "high-pass", "cutoffHz": 250, "linearGain": 0.5 }, { "type": "low-pass", "cutoffHz": 8e3, "linearGain": 1 }], "noteSubFilters0": [{ "type": "high-pass", "cutoffHz": 250, "linearGain": 0.5 }, { "type": "low-pass", "cutoffHz": 8e3, "linearGain": 1 }], "distortion": 14, "aliases": false, "bitcrusherOctave": 5.5, "bitcrusherQuantization": 14, "chorus": 29, "echoSustain": 14, "echoDelayBeats": 0.083, "reverb": 32, "fadeInSeconds": 0, "fadeOutTicks": 24, "wave": "crackling", "unison": "none", "envelopes": [], "isDrum": false } },
            { name: "crackle", generalMidi: false, isNoise: true, settings: { "type": "noise", "volume": 0, "eqFilter": [{ "type": "low-pass", "cutoffHz": 16e3, "linearGain": 0.3536 }, { "type": "high-pass", "cutoffHz": 4756.83, "linearGain": 0.1768 }], "eqFilterType": false, "eqSimpleCut": 10, "eqSimplePeak": 0, "envelopeSpeed": 12, "eqSubFilters0": [{ "type": "low-pass", "cutoffHz": 16e3, "linearGain": 0.3536 }, { "type": "high-pass", "cutoffHz": 4756.83, "linearGain": 0.1768 }], "eqSubFilters1": [{ "type": "low-pass", "cutoffHz": 16e3, "linearGain": 0.3536 }, { "type": "high-pass", "cutoffHz": 4756.83, "linearGain": 0.1768 }], "eqSubFilters2": [{ "type": "low-pass", "cutoffHz": 8e3, "linearGain": 0.3536 }, { "type": "high-pass", "cutoffHz": 4756.83, "linearGain": 0.1768 }], "eqSubFilters3": [{ "type": "low-pass", "cutoffHz": 8e3, "linearGain": 0.1768 }, { "type": "high-pass", "cutoffHz": 4756.83, "linearGain": 0.1768 }], "effects": ["panning", "granular", "reverb"], "granular": 10, "grainSize": 1, "grainAmounts": 0, "grainRange": 0, "pan": -100, "panDelay": 0, "reverb": 6, "fadeInSeconds": 0, "fadeOutTicks": -3, "wave": "white", "unison": "none", "envelopes": [{ "target": "grainFreq", "envelope": "none", "inverse": false, "perEnvelopeSpeed": 1, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 0.1, "discrete": false }, { "target": "panning", "envelope": "random", "inverse": false, "perEnvelopeSpeed": 32, "perEnvelopeLowerBound": 0, "perEnvelopeUpperBound": 1, "discrete": true, "steps": 32, "seed": 2, "waveform": 0 }], "isDrum": true } }
          ])
        }
      ]);
    }
    static valueToPreset(presetValue) {
      const categoryIndex = presetValue >> 6;
      const presetIndex = presetValue & 63;
      return _EditorConfig.presetCategories[categoryIndex]?.presets[presetIndex];
    }
    static midiProgramToPresetValue(program) {
      for (let categoryIndex = 0; categoryIndex < _EditorConfig.presetCategories.length; categoryIndex++) {
        const category = _EditorConfig.presetCategories[categoryIndex];
        for (let presetIndex = 0; presetIndex < category.presets.length; presetIndex++) {
          const preset = category.presets[presetIndex];
          if (preset.generalMidi && preset.midiProgram == program) return (categoryIndex << 6) + presetIndex;
        }
      }
      return null;
    }
    static nameToPresetValue(presetName) {
      for (let categoryIndex = 0; categoryIndex < _EditorConfig.presetCategories.length; categoryIndex++) {
        const category = _EditorConfig.presetCategories[categoryIndex];
        for (let presetIndex = 0; presetIndex < category.presets.length; presetIndex++) {
          const preset = category.presets[presetIndex];
          if (preset.name == presetName) return (categoryIndex << 6) + presetIndex;
        }
      }
      return null;
    }
    static instrumentToPreset(instrument) {
      return _EditorConfig.presetCategories[0].presets.dictionary?.[TypePresets?.[instrument]];
    }
  };

  // editor/PluginConfig.ts
  var PluginConfig = class {
    static {
      __name(this, "PluginConfig");
    }
    static {
      this.pluginName = "";
    }
    static {
      this.pluginUIElements = [];
    }
  };

  // synth/filtering.ts
  var FilterCoefficients = class {
    constructor() {
      this.a = [1];
      // output coefficients (negated, keep a[0]=1)
      this.b = [1];
      // input coefficients
      this.order = 0;
    }
    static {
      __name(this, "FilterCoefficients");
    }
    linearGain0thOrder(linearGain) {
      this.b[0] = linearGain;
      this.order = 0;
    }
    lowPass1stOrderButterworth(cornerRadiansPerSample) {
      const g = 1 / Math.tan(cornerRadiansPerSample * 0.5);
      const a0 = 1 + g;
      this.a[1] = (1 - g) / a0;
      this.b[1] = this.b[0] = 1 / a0;
      this.order = 1;
    }
    lowPass1stOrderSimplified(cornerRadiansPerSample) {
      const g = 2 * Math.sin(cornerRadiansPerSample * 0.5);
      this.a[1] = g - 1;
      this.b[0] = g;
      this.b[1] = 0;
      this.order = 1;
    }
    highPass1stOrderButterworth(cornerRadiansPerSample) {
      const g = 1 / Math.tan(cornerRadiansPerSample * 0.5);
      const a0 = 1 + g;
      this.a[1] = (1 - g) / a0;
      this.b[0] = g / a0;
      this.b[1] = -g / a0;
      this.order = 1;
    }
    /*
    public highPass1stOrderSimplified(cornerRadiansPerSample: number): void {
    	// The output of this filter is nearly identical to the 1st order
    	// Butterworth high-pass above, except it resonates when the cutoff
    	// appoaches the nyquist.
    	const g: number = 2.0 * Math.sin(cornerRadiansPerSample * 0.5);
    	this.a[1] = g - 1.0;
    	this.b[0] = 1.0;
    	this.b[1] = -1.0;
    	this.order = 1;
    }
    */
    highShelf1stOrder(cornerRadiansPerSample, shelfLinearGain) {
      const tan = Math.tan(cornerRadiansPerSample * 0.5);
      const sqrtGain = Math.sqrt(shelfLinearGain);
      const g = (tan * sqrtGain - 1) / (tan * sqrtGain + 1);
      const a0 = 1;
      this.a[1] = g / a0;
      this.b[0] = (1 + g + shelfLinearGain * (1 - g)) / (2 * a0);
      this.b[1] = (1 + g - shelfLinearGain * (1 - g)) / (2 * a0);
      this.order = 1;
    }
    allPass1stOrderInvertPhaseAbove(cornerRadiansPerSample) {
      const g = (Math.sin(cornerRadiansPerSample) - 1) / Math.cos(cornerRadiansPerSample);
      this.a[1] = g;
      this.b[0] = g;
      this.b[1] = 1;
      this.order = 1;
    }
    /*
    // I haven't found a practical use for this version of the all pass filter.
    // It seems to create a weird subharmonic when used in a delay feedback loop.
    public allPass1stOrderInvertPhaseBelow(cornerRadiansPerSample: number): void {
    	const g: number = (Math.sin(cornerRadiansPerSample) - 1.0) / Math.cos(cornerRadiansPerSample);
    	this.a[1] = g;
    	this.b[0] = -g;
    	this.b[1] = -1.0;
    	this.order = 1;
    }
    */
    allPass1stOrderFractionalDelay(delay) {
      const g = (1 - delay) / (1 + delay);
      this.a[1] = g;
      this.b[0] = g;
      this.b[1] = 1;
      this.order = 1;
    }
    lowPass2ndOrderButterworth(cornerRadiansPerSample, peakLinearGain) {
      const alpha = Math.sin(cornerRadiansPerSample) / (2 * peakLinearGain);
      const cos = Math.cos(cornerRadiansPerSample);
      const a0 = 1 + alpha;
      this.a[1] = -2 * cos / a0;
      this.a[2] = (1 - alpha) / a0;
      this.b[2] = this.b[0] = (1 - cos) / (2 * a0);
      this.b[1] = (1 - cos) / a0;
      this.order = 2;
    }
    lowPass2ndOrderSimplified(cornerRadiansPerSample, peakLinearGain) {
      const g = 2 * Math.sin(cornerRadiansPerSample / 2);
      const filterResonance = 1 - 1 / (2 * peakLinearGain);
      const feedback = filterResonance + filterResonance / (1 - g);
      this.a[1] = 2 * g + (g - 1) * g * feedback - 2;
      this.a[2] = (g - 1) * (g - g * feedback - 1);
      this.b[0] = g * g;
      this.b[1] = 0;
      this.b[2] = 0;
      this.order = 2;
    }
    highPass2ndOrderButterworth(cornerRadiansPerSample, peakLinearGain) {
      const alpha = Math.sin(cornerRadiansPerSample) / (2 * peakLinearGain);
      const cos = Math.cos(cornerRadiansPerSample);
      const a0 = 1 + alpha;
      this.a[1] = -2 * cos / a0;
      this.a[2] = (1 - alpha) / a0;
      this.b[2] = this.b[0] = (1 + cos) / (2 * a0);
      this.b[1] = -(1 + cos) / a0;
      this.order = 2;
    }
    /*
    public highPass2ndOrderSimplified(cornerRadiansPerSample: number, peakLinearGain: number): void {
    	const g: number = 2.0 * Math.sin(cornerRadiansPerSample * 0.5);
    	const filterResonance: number = 1.0 - 1.0 / (2.0 * peakLinearGain);
    	const feedback: number = filterResonance + filterResonance / (1.0 - g);
    	this.a[1] = 2.0*g + (g - 1.0) * g*feedback - 2.0;
    	this.a[2] = (g - 1.0) * (g - g*feedback - 1.0);
    	this.b[0] = 1.0;
    	this.b[1] = -2.0;
    	this.b[2] = 1.0;
    	this.order = 2;
    }
    */
    highShelf2ndOrder(cornerRadiansPerSample, shelfLinearGain, slope) {
      const A = Math.sqrt(shelfLinearGain);
      const c = Math.cos(cornerRadiansPerSample);
      const Aplus = A + 1;
      const Aminus = A - 1;
      const alpha = Math.sin(cornerRadiansPerSample) * 0.5 * Math.sqrt(Aplus / A * (1 / slope - 1) + 2);
      const sqrtA2Alpha = 2 * Math.sqrt(A) * alpha;
      const a0 = Aplus - Aminus * c + sqrtA2Alpha;
      this.a[1] = 2 * (Aminus - Aplus * c) / a0;
      this.a[2] = (Aplus - Aminus * c - sqrtA2Alpha) / a0;
      this.b[0] = A * (Aplus + Aminus * c + sqrtA2Alpha) / a0;
      this.b[1] = -2 * A * (Aminus + Aplus * c) / a0;
      this.b[2] = A * (Aplus + Aminus * c - sqrtA2Alpha) / a0;
      this.order = 2;
    }
    peak2ndOrder(cornerRadiansPerSample, peakLinearGain, bandWidthScale) {
      const sqrtGain = Math.sqrt(peakLinearGain);
      const bandWidth = bandWidthScale * cornerRadiansPerSample / (sqrtGain >= 1 ? sqrtGain : 1 / sqrtGain);
      const alpha = Math.tan(bandWidth * 0.5);
      const a0 = 1 + alpha / sqrtGain;
      this.b[0] = (1 + alpha * sqrtGain) / a0;
      this.b[1] = this.a[1] = -2 * Math.cos(cornerRadiansPerSample) / a0;
      this.b[2] = (1 - alpha * sqrtGain) / a0;
      this.a[2] = (1 - alpha / sqrtGain) / a0;
      this.order = 2;
    }
    /*
    // Create a higher order filter by combining two lower order filters.
    // However, making high order filters in this manner results in instability.
    // It is recommended to apply the 2nd order filters (biquads) in sequence instead.
    public combination(filter1: FilterCoefficients, filter2: FilterCoefficients): void {
    	this.order = filter1.order + filter2.order;
    	for (let i: number = 0; i <= this.order; i++) {
    		this.a[i] = 0.0;
    		this.b[i] = 0.0;
    	}
    	for (let i: number = 0; i <= filter1.order; i++) {
    		for (let j: number = 0; j <= filter2.order; j++) {
    			this.a[i + j] += filter1.a[i] * filter2.a[j];
    			this.b[i + j] += filter1.b[i] * filter2.b[j];
    		}
    	}
    }
    
    public scaledDifference(other: FilterCoefficients, scale: number): void {
    	if (other.order != this.order) throw new Error();
    	for (let i: number = 0; i <= this.order; i++) {
    		this.a[i] = (this.a[i] - other.a[i]) * scale;
    		this.b[i] = (this.b[i] - other.b[i]) * scale;
    	}
    }
    
    public copy(other: FilterCoefficients): void {
    	this.order = other.order;
    	for (let i: number = 0; i <= this.order; i++) {
    		this.a[i] = other.a[i];
    		this.b[i] = other.b[i];
    	}
    }
    */
  };
  var FrequencyResponse = class {
    constructor() {
      this.real = 0;
      this.imag = 0;
      this.denom = 1;
    }
    static {
      __name(this, "FrequencyResponse");
    }
    analyze(filter, radiansPerSample) {
      this.analyzeComplex(filter, Math.cos(radiansPerSample), Math.sin(radiansPerSample));
    }
    analyzeComplex(filter, real, imag) {
      const a = filter.a;
      const b = filter.b;
      const realZ1 = real;
      const imagZ1 = -imag;
      let realNum = b[0] + b[1] * realZ1;
      let imagNum = b[1] * imagZ1;
      let realDenom = 1 + a[1] * realZ1;
      let imagDenom = a[1] * imagZ1;
      let realZ = realZ1;
      let imagZ = imagZ1;
      for (let i = 2; i <= filter.order; i++) {
        const realTemp = realZ * realZ1 - imagZ * imagZ1;
        const imagTemp = realZ * imagZ1 + imagZ * realZ1;
        realZ = realTemp;
        imagZ = imagTemp;
        realNum += b[i] * realZ;
        imagNum += b[i] * imagZ;
        realDenom += a[i] * realZ;
        imagDenom += a[i] * imagZ;
      }
      this.denom = realDenom * realDenom + imagDenom * imagDenom;
      this.real = realNum * realDenom + imagNum * imagDenom;
      this.imag = imagNum * realDenom - realNum * imagDenom;
    }
    magnitude() {
      return Math.sqrt(this.real * this.real + this.imag * this.imag) / this.denom;
    }
    angle() {
      return Math.atan2(this.imag, this.real);
    }
  };

  // node_modules/ringbuf.js/dist/index.mjs
  var RingBuffer = class {
    static {
      __name(this, "RingBuffer");
    }
    /** Allocate the SharedArrayBuffer for a RingBuffer, based on the type and
     * capacity required
     * @param capacity The number of elements the ring buffer will be
     * able to hold.
     * @param type A typed array constructor, the type that this ring
     * buffer will hold.
     * @return A SharedArrayBuffer of the right size.
     */
    static getStorageForCapacity(capacity, type) {
      if (!type.BYTES_PER_ELEMENT) {
        throw TypeError("Pass in an ArrayBuffer subclass");
      }
      const bytes = 8 + (capacity + 1) * type.BYTES_PER_ELEMENT;
      return new SharedArrayBuffer(bytes);
    }
    /**
     * @param sab A SharedArrayBuffer obtained by calling
     * {@link RingBuffer.getStorageForCapacity}.
     * @param type A typed array constructor, the type that this ring
     * buffer will hold.
     */
    constructor(sab, type) {
      if (type.BYTES_PER_ELEMENT === void 0) {
        throw TypeError("Pass a concrete typed array class as second argument");
      }
      this._type = type;
      this._capacity = (sab.byteLength - 8) / type.BYTES_PER_ELEMENT;
      this.buf = sab;
      this.write_ptr = new Uint32Array(this.buf, 0, 1);
      this.read_ptr = new Uint32Array(this.buf, 4, 1);
      this.storage = new type(this.buf, 8, this._capacity);
    }
    /**
     * @return the type of the underlying ArrayBuffer for this RingBuffer. This
     * allows implementing crude type checking.
     */
    type() {
      return this._type.name;
    }
    /**
     * Push elements to the ring buffer.
     * @param elements A typed array of the same type as passed in the ctor, to be written to the queue.
     * @param length If passed, the maximum number of elements to push.
     * If not passed, all elements in the input array are pushed.
     * @param offset If passed, a starting index in elements from which
     * the elements are read. If not passed, elements are read from index 0.
     * @return the number of elements written to the queue.
     */
    push(elements, length, offset = 0) {
      const rd = Atomics.load(this.read_ptr, 0);
      const wr = Atomics.load(this.write_ptr, 0);
      if ((wr + 1) % this._storage_capacity() === rd) {
        return 0;
      }
      const len = length !== void 0 ? length : elements.length;
      const to_write = Math.min(this._available_write(rd, wr), len);
      const first_part = Math.min(this._storage_capacity() - wr, to_write);
      const second_part = to_write - first_part;
      this._copy(elements, offset, this.storage, wr, first_part);
      this._copy(elements, offset + first_part, this.storage, 0, second_part);
      Atomics.store(
        this.write_ptr,
        0,
        (wr + to_write) % this._storage_capacity()
      );
      return to_write;
    }
    /**
     * Write bytes to the ring buffer using callbacks. This create wrapper
     * objects and can GC, so it's best to no use this variant from a real-time
     * thread such as an AudioWorklerProcessor `process` method.
     * The callback is passed two typed arrays of the same type, to be filled.
     * This allows skipping copies if the API that produces the data writes is
     * passed arrays to write to, such as `AudioData.copyTo`.
     * @param amount The maximum number of elements to write to the ring
     * buffer. If amount is more than the number of slots available for writing,
     * then the number of slots available for writing will be made available: no
     * overwriting of elements can happen.
     * @param cb A callback with two parameters, that are two typed
     * array of the correct type, in which the data need to be copied. If the
     * callback doesn't return anything, it is assumed all the elements
     * have been written to. Otherwise, it is assumed that the returned number is
     * the number of elements that have been written to, and those elements have
     * been written started at the beginning of the requested buffer space.
     *
     * @return The number of elements written to the queue.
     */
    writeCallback(amount, cb) {
      const rd = Atomics.load(this.read_ptr, 0);
      const wr = Atomics.load(this.write_ptr, 0);
      if ((wr + 1) % this._storage_capacity() === rd) {
        return 0;
      }
      const to_write = Math.min(this._available_write(rd, wr), amount);
      const first_part = Math.min(this._storage_capacity() - wr, to_write);
      const second_part = to_write - first_part;
      const first_part_buf = new this._type(
        this.storage.buffer,
        8 + wr * this.storage.BYTES_PER_ELEMENT,
        first_part
      );
      const second_part_buf = new this._type(
        this.storage.buffer,
        8 + 0,
        second_part
      );
      const written = cb(first_part_buf, second_part_buf) || to_write;
      Atomics.store(this.write_ptr, 0, (wr + written) % this._storage_capacity());
      return written;
    }
    /**
     * Write bytes to the ring buffer using a callback.
     *
     * This allows skipping copies if the API that produces the data writes is
     * passed arrays to write to, such as `AudioData.copyTo`.
     *
     * @param amount The maximum number of elements to write to the ring
     * buffer. If amount is more than the number of slots available for writing,
     * then the number of slots available for writing will be made available: no
     * overwriting of elements can happen.
     * @param cb A callback with five parameters:
     *
     * (1) The internal storage of the ring buffer as a typed array
     * (2) An offset to start writing from
     * (3) A number of elements to write at this offset
     * (4) Another offset to start writing from
     * (5) A number of elements to write at this second offset
     *
     * If the callback doesn't return anything, it is assumed all the elements
     * have been written to. Otherwise, it is assumed that the returned number is
     * the number of elements that have been written to, and those elements have
     * been written started at the beginning of the requested buffer space.
     * @return The number of elements written to the queue.
     */
    writeCallbackWithOffset(amount, cb) {
      const rd = Atomics.load(this.read_ptr, 0);
      const wr = Atomics.load(this.write_ptr, 0);
      if ((wr + 1) % this._storage_capacity() === rd) {
        return 0;
      }
      const to_write = Math.min(this._available_write(rd, wr), amount);
      const first_part = Math.min(this._storage_capacity() - wr, to_write);
      const second_part = to_write - first_part;
      const written = cb(this.storage, wr, first_part, 0, second_part) || to_write;
      Atomics.store(this.write_ptr, 0, (wr + written) % this._storage_capacity());
      return written;
    }
    /**
     * Read up to `elements.length` elements from the ring buffer. `elements` is a typed
     * array of the same type as passed in the ctor.
     * Returns the number of elements read from the queue, they are placed at the
     * beginning of the array passed as parameter.
     * @param elements An array in which the elements read from the
     * queue will be written, starting at the beginning of the array.
     * @param length If passed, the maximum number of elements to pop. If
     * not passed, up to elements.length are popped.
     * @param offset If passed, an index in elements in which the data is
     * written to. `elements.length - offset` must be greater or equal to
     * `length`.
     * @return The number of elements read from the queue.
     */
    pop(elements, length, offset = 0) {
      const rd = Atomics.load(this.read_ptr, 0);
      const wr = Atomics.load(this.write_ptr, 0);
      if (wr === rd) {
        return 0;
      }
      const len = length !== void 0 ? length : elements.length;
      const to_read = Math.min(this._available_read(rd, wr), len);
      const first_part = Math.min(this._storage_capacity() - rd, to_read);
      const second_part = to_read - first_part;
      this._copy(this.storage, rd, elements, offset, first_part);
      this._copy(this.storage, 0, elements, offset + first_part, second_part);
      Atomics.store(this.read_ptr, 0, (rd + to_read) % this._storage_capacity());
      return to_read;
    }
    /**
     * @return True if the ring buffer is empty false otherwise. This can be late
     * on the reader side: it can return true even if something has just been
     * pushed.
     */
    empty() {
      const rd = Atomics.load(this.read_ptr, 0);
      const wr = Atomics.load(this.write_ptr, 0);
      return wr === rd;
    }
    /**
     * @return True if the ring buffer is full, false otherwise. This can be late
     * on the write side: it can return true when something has just been popped.
     */
    full() {
      const rd = Atomics.load(this.read_ptr, 0);
      const wr = Atomics.load(this.write_ptr, 0);
      return (wr + 1) % this._storage_capacity() === rd;
    }
    /**
     * @return The usable capacity for the ring buffer: the number of elements
     * that can be stored.
     */
    capacity() {
      return this._capacity - 1;
    }
    /**
     * @return The number of elements available for reading. This can be late, and
     * report less elements that is actually in the queue, when something has just
     * been enqueued.
     */
    availableRead() {
      const rd = Atomics.load(this.read_ptr, 0);
      const wr = Atomics.load(this.write_ptr, 0);
      return this._available_read(rd, wr);
    }
    /**
     * Compatibility alias for availableRead().
     *
     * @return The number of elements available for reading. This can be late, and
     * report less elements that is actually in the queue, when something has just
     * been enqueued.
     *
     * @deprecated
     */
    available_read() {
      return this.availableRead();
    }
    /**
     * @return The number of elements available for writing. This can be late, and
     * report less elements that is actually available for writing, when something
     * has just been dequeued.
     */
    availableWrite() {
      const rd = Atomics.load(this.read_ptr, 0);
      const wr = Atomics.load(this.write_ptr, 0);
      return this._available_write(rd, wr);
    }
    /**
     * Compatibility alias for availableWrite.
     *
     * @return The number of elements available for writing. This can be late, and
     * report less elements that is actually available for writing, when something
     * has just been dequeued.
     *
     * @deprecated
     */
    available_write() {
      return this.availableWrite();
    }
    // private methods //
    /**
     * @return Number of elements available for reading, given a read and write
     * pointer.
     * @private
     */
    _available_read(rd, wr) {
      return (wr + this._storage_capacity() - rd) % this._storage_capacity();
    }
    /**
     * @return Number of elements available from writing, given a read and write
     * pointer.
     * @private
     */
    _available_write(rd, wr) {
      return this.capacity() - this._available_read(rd, wr);
    }
    /**
     * @return The size of the storage for elements not accounting the space for
     * the index, counting the empty slot.
     * @private
     */
    _storage_capacity() {
      return this._capacity;
    }
    /**
     * Copy `size` elements from `input`, starting at offset `offset_input`, to
     * `output`, starting at offset `offset_output`.
     * @param input The array to copy from
     * @param offset_input The index at which to start the copy
     * @param output The array to copy to
     * @param offset_output The index at which to start copying the elements to
     * @param size The number of elements to copy
     * @private
     */
    _copy(input, offset_input, output, offset_output, size) {
      if (!size) {
        return;
      }
      if (offset_input === 0 && offset_output + input.length <= this._storage_capacity() && input.length === size) {
        output.set(input, offset_output);
        return;
      }
      let i = 0;
      const unrollFactor = 16;
      for (; i <= size - unrollFactor; i += unrollFactor) {
        output[offset_output + i] = input[offset_input + i];
        output[offset_output + i + 1] = input[offset_input + i + 1];
        output[offset_output + i + 2] = input[offset_input + i + 2];
        output[offset_output + i + 3] = input[offset_input + i + 3];
        output[offset_output + i + 4] = input[offset_input + i + 4];
        output[offset_output + i + 5] = input[offset_input + i + 5];
        output[offset_output + i + 6] = input[offset_input + i + 6];
        output[offset_output + i + 7] = input[offset_input + i + 7];
        output[offset_output + i + 8] = input[offset_input + i + 8];
        output[offset_output + i + 9] = input[offset_input + i + 9];
        output[offset_output + i + 10] = input[offset_input + i + 10];
        output[offset_output + i + 11] = input[offset_input + i + 11];
        output[offset_output + i + 12] = input[offset_input + i + 12];
        output[offset_output + i + 13] = input[offset_input + i + 13];
        output[offset_output + i + 14] = input[offset_input + i + 14];
        output[offset_output + i + 15] = input[offset_input + i + 15];
      }
      for (; i < size; i++) {
        output[offset_output + i] = input[offset_input + i];
      }
    }
  };

  // synth/synth.ts
  function clamp(min, max, val) {
    max = max - 1;
    if (val <= max) {
      if (val >= min) return val;
      else return min;
    } else {
      return max;
    }
  }
  __name(clamp, "clamp");
  function validateRange(min, max, val) {
    if (min <= val && val <= max) return val;
    throw new Error(`Value ${val} not in range [${min}, ${max}]`);
  }
  __name(validateRange, "validateRange");
  function parseFloatWithDefault(s, defaultValue) {
    let result = parseFloat(s);
    if (Number.isNaN(result)) result = defaultValue;
    return result;
  }
  __name(parseFloatWithDefault, "parseFloatWithDefault");
  function parseIntWithDefault(s, defaultValue) {
    let result = parseInt(s);
    if (Number.isNaN(result)) result = defaultValue;
    return result;
  }
  __name(parseIntWithDefault, "parseIntWithDefault");
  function encode32BitNumber(buffer, x) {
    buffer.push(base64IntToCharCode[x >>> 6 * 5 & 3]);
    buffer.push(base64IntToCharCode[x >>> 6 * 4 & 63]);
    buffer.push(base64IntToCharCode[x >>> 6 * 3 & 63]);
    buffer.push(base64IntToCharCode[x >>> 6 * 2 & 63]);
    buffer.push(base64IntToCharCode[x >>> 6 * 1 & 63]);
    buffer.push(base64IntToCharCode[x >>> 6 * 0 & 63]);
  }
  __name(encode32BitNumber, "encode32BitNumber");
  function decode32BitNumber(compressed, charIndex) {
    let x = 0;
    x |= base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6 * 5;
    x |= base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6 * 4;
    x |= base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6 * 3;
    x |= base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6 * 2;
    x |= base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6 * 1;
    x |= base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6 * 0;
    return x;
  }
  __name(decode32BitNumber, "decode32BitNumber");
  function encodeUnisonSettings(buffer, v, s, o, e, i) {
    buffer.push(base64IntToCharCode[v]);
    buffer.push(base64IntToCharCode[Number(s > 0)]);
    let cleanS = Math.round(Math.abs(s) * 1e3);
    let cleanSDivided = Math.floor(cleanS / 63);
    buffer.push(base64IntToCharCode[cleanS % 63], base64IntToCharCode[cleanSDivided % 63], base64IntToCharCode[Math.floor(cleanSDivided / 63)]);
    buffer.push(base64IntToCharCode[Number(o > 0)]);
    let cleanO = Math.round(Math.abs(o) * 1e3);
    let cleanODivided = Math.floor(cleanO / 63);
    buffer.push(base64IntToCharCode[cleanO % 63], base64IntToCharCode[cleanODivided % 63], base64IntToCharCode[Math.floor(cleanODivided / 63)]);
    buffer.push(base64IntToCharCode[Number(e > 0)]);
    let cleanE = Math.round(Math.abs(e) * 1e3);
    buffer.push(base64IntToCharCode[cleanE % 63], base64IntToCharCode[Math.floor(cleanE / 63)]);
    buffer.push(base64IntToCharCode[Number(i > 0)]);
    let cleanI = Math.round(Math.abs(i) * 1e3);
    buffer.push(base64IntToCharCode[cleanI % 63], base64IntToCharCode[Math.floor(cleanI / 63)]);
  }
  __name(encodeUnisonSettings, "encodeUnisonSettings");
  function convertLegacyKeyToKeyAndOctave(rawKeyIndex) {
    let key = clamp(0, Config.keys.length, rawKeyIndex);
    let octave = 0;
    if (rawKeyIndex === 12) {
      key = 0;
      octave = 1;
    } else if (rawKeyIndex === 13) {
      key = 6;
      octave = -1;
    } else if (rawKeyIndex === 14) {
      key = 0;
      octave = -1;
    } else if (rawKeyIndex === 15) {
      key = 5;
      octave = -1;
    }
    return [key, octave];
  }
  __name(convertLegacyKeyToKeyAndOctave, "convertLegacyKeyToKeyAndOctave");
  var base64IntToCharCode = [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 45, 95];
  var base64CharCodeToInt = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 62, 62, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 0, 0, 0, 0, 0, 0, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 0, 0, 0, 0, 63, 0, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 0, 0, 0, 0, 0];
  var BitFieldReader = class {
    constructor(source, startIndex, stopIndex) {
      this._bits = [];
      this._readIndex = 0;
      for (let i = startIndex; i < stopIndex; i++) {
        const value = base64CharCodeToInt[source.charCodeAt(i)];
        this._bits.push(value >> 5 & 1);
        this._bits.push(value >> 4 & 1);
        this._bits.push(value >> 3 & 1);
        this._bits.push(value >> 2 & 1);
        this._bits.push(value >> 1 & 1);
        this._bits.push(value & 1);
      }
    }
    static {
      __name(this, "BitFieldReader");
    }
    read(bitCount) {
      let result = 0;
      while (bitCount > 0) {
        result = result << 1;
        result += this._bits[this._readIndex++];
        bitCount--;
      }
      return result;
    }
    readLongTail(minValue, minBits) {
      let result = minValue;
      let numBits = minBits;
      while (this._bits[this._readIndex++]) {
        result += 1 << numBits;
        numBits++;
      }
      while (numBits > 0) {
        numBits--;
        if (this._bits[this._readIndex++]) {
          result += 1 << numBits;
        }
      }
      return result;
    }
    readPartDuration() {
      return this.readLongTail(1, 3);
    }
    readLegacyPartDuration() {
      return this.readLongTail(1, 2);
    }
    readPinCount() {
      return this.readLongTail(1, 0);
    }
    readPitchInterval() {
      if (this.read(1)) {
        return -this.readLongTail(1, 3);
      } else {
        return this.readLongTail(1, 3);
      }
    }
  };
  var BitFieldWriter = class {
    constructor() {
      this._index = 0;
      this._bits = [];
    }
    static {
      __name(this, "BitFieldWriter");
    }
    clear() {
      this._index = 0;
    }
    write(bitCount, value) {
      bitCount--;
      while (bitCount >= 0) {
        this._bits[this._index++] = value >>> bitCount & 1;
        bitCount--;
      }
    }
    writeLongTail(minValue, minBits, value) {
      if (value < minValue) throw new Error("value out of bounds");
      value -= minValue;
      let numBits = minBits;
      while (value >= 1 << numBits) {
        this._bits[this._index++] = 1;
        value -= 1 << numBits;
        numBits++;
      }
      this._bits[this._index++] = 0;
      while (numBits > 0) {
        numBits--;
        this._bits[this._index++] = value >>> numBits & 1;
      }
    }
    writePartDuration(value) {
      this.writeLongTail(1, 3, value);
    }
    writePinCount(value) {
      this.writeLongTail(1, 0, value);
    }
    writePitchInterval(value) {
      if (value < 0) {
        this.write(1, 1);
        this.writeLongTail(1, 3, -value);
      } else {
        this.write(1, 0);
        this.writeLongTail(1, 3, value);
      }
    }
    concat(other) {
      for (let i = 0; i < other._index; i++) {
        this._bits[this._index++] = other._bits[i];
      }
    }
    encodeBase64(buffer) {
      for (let i = 0; i < this._index; i += 6) {
        const value = this._bits[i] << 5 | this._bits[i + 1] << 4 | this._bits[i + 2] << 3 | this._bits[i + 3] << 2 | this._bits[i + 4] << 1 | this._bits[i + 5];
        buffer.push(base64IntToCharCode[value]);
      }
      return buffer;
    }
    lengthBase64() {
      return Math.ceil(this._index / 6);
    }
  };
  function makeNotePin(interval, time, size) {
    return { interval, time, size };
  }
  __name(makeNotePin, "makeNotePin");
  var Note = class _Note {
    static {
      __name(this, "Note");
    }
    constructor(pitch, start, end, size, fadeout = false) {
      this.pitches = [pitch];
      this.pins = [makeNotePin(0, 0, size), makeNotePin(0, end - start, fadeout ? 0 : size)];
      this.start = start;
      this.end = end;
      this.continuesLastPattern = false;
    }
    pickMainInterval() {
      let longestFlatIntervalDuration = 0;
      let mainInterval = 0;
      for (let pinIndex = 1; pinIndex < this.pins.length; pinIndex++) {
        const pinA = this.pins[pinIndex - 1];
        const pinB = this.pins[pinIndex];
        if (pinA.interval == pinB.interval) {
          const duration = pinB.time - pinA.time;
          if (longestFlatIntervalDuration < duration) {
            longestFlatIntervalDuration = duration;
            mainInterval = pinA.interval;
          }
        }
      }
      if (longestFlatIntervalDuration == 0) {
        let loudestSize = 0;
        for (let pinIndex = 0; pinIndex < this.pins.length; pinIndex++) {
          const pin = this.pins[pinIndex];
          if (loudestSize < pin.size) {
            loudestSize = pin.size;
            mainInterval = pin.interval;
          }
        }
      }
      return mainInterval;
    }
    clone() {
      const newNote = new _Note(-1, this.start, this.end, 3);
      newNote.pitches = this.pitches.concat();
      newNote.pins = [];
      for (const pin of this.pins) {
        newNote.pins.push(makeNotePin(pin.interval, pin.time, pin.size));
      }
      newNote.continuesLastPattern = this.continuesLastPattern;
      return newNote;
    }
    getEndPinIndex(part) {
      let endPinIndex;
      for (endPinIndex = 1; endPinIndex < this.pins.length - 1; endPinIndex++) {
        if (this.pins[endPinIndex].time + this.start > part) break;
      }
      return endPinIndex;
    }
  };
  var Pattern = class {
    constructor() {
      this.notes = [];
      this.instruments = [0];
    }
    static {
      __name(this, "Pattern");
    }
    cloneNotes() {
      const result = [];
      for (const note of this.notes) {
        result.push(note.clone());
      }
      return result;
    }
    reset() {
      this.notes.length = 0;
      this.instruments[0] = 0;
      this.instruments.length = 1;
    }
    toJsonObject(song, channel, isModChannel) {
      const noteArray = [];
      for (const note of this.notes) {
        let instrument = channel.instruments[this.instruments[0]];
        let mod = Math.max(0, Config.modCount - note.pitches[0] - 1);
        let volumeCap = song.getVolumeCapForSetting(isModChannel, instrument.modulators[mod], instrument.modFilterTypes[mod]);
        const pointArray = [];
        for (const pin of note.pins) {
          let useVol = isModChannel ? Math.round(pin.size) : Math.round(pin.size * 100 / volumeCap);
          pointArray.push({
            "tick": (pin.time + note.start) * Config.rhythms[song.rhythm].stepsPerBeat / Config.partsPerBeat,
            "pitchBend": pin.interval,
            "volume": useVol,
            "forMod": isModChannel
          });
        }
        const noteObject = {
          "pitches": note.pitches,
          "points": pointArray
        };
        if (note.start == 0) {
          noteObject["continuesLastPattern"] = note.continuesLastPattern;
        }
        noteArray.push(noteObject);
      }
      const patternObject = { "notes": noteArray };
      if (song.patternInstruments) {
        patternObject["instruments"] = this.instruments.map((i) => i + 1);
      }
      return patternObject;
    }
    fromJsonObject(patternObject, song, channel, importedPartsPerBeat, isNoiseChannel, isModChannel, jsonFormat = "auto") {
      const format = jsonFormat.toLowerCase();
      if (song.patternInstruments) {
        if (Array.isArray(patternObject["instruments"])) {
          const instruments = patternObject["instruments"];
          const instrumentCount = clamp(Config.instrumentCountMin, song.getMaxInstrumentsPerPatternForChannel(channel) + 1, instruments.length);
          for (let j = 0; j < instrumentCount; j++) {
            this.instruments[j] = clamp(0, channel.instruments.length, (instruments[j] | 0) - 1);
          }
          this.instruments.length = instrumentCount;
        } else {
          this.instruments[0] = clamp(0, channel.instruments.length, (patternObject["instrument"] | 0) - 1);
          this.instruments.length = 1;
        }
      }
      if (patternObject["notes"] && patternObject["notes"].length > 0) {
        const maxNoteCount = Math.min(song.beatsPerBar * Config.partsPerBeat * (isModChannel ? Config.modCount : 1), patternObject["notes"].length >>> 0);
        for (let j = 0; j < patternObject["notes"].length; j++) {
          if (j >= maxNoteCount) break;
          const noteObject = patternObject["notes"][j];
          if (!noteObject || !noteObject["pitches"] || !(noteObject["pitches"].length >= 1) || !noteObject["points"] || !(noteObject["points"].length >= 2)) {
            continue;
          }
          const note = new Note(0, 0, 0, 0);
          note.pitches = [];
          note.pins = [];
          for (let k = 0; k < noteObject["pitches"].length; k++) {
            const pitch = noteObject["pitches"][k] | 0;
            if (note.pitches.indexOf(pitch) != -1) continue;
            note.pitches.push(pitch);
            if (note.pitches.length >= Config.maxChordSize) break;
          }
          if (note.pitches.length < 1) continue;
          let startInterval = 0;
          let instrument = channel.instruments[this.instruments[0]];
          let mod = Math.max(0, Config.modCount - note.pitches[0] - 1);
          for (let k = 0; k < noteObject["points"].length; k++) {
            const pointObject = noteObject["points"][k];
            if (pointObject == void 0 || pointObject["tick"] == void 0) continue;
            const interval = pointObject["pitchBend"] == void 0 ? 0 : pointObject["pitchBend"] | 0;
            const time = Math.round(+pointObject["tick"] * Config.partsPerBeat / importedPartsPerBeat);
            let volumeCap = song.getVolumeCapForSetting(isModChannel, instrument.modulators[mod], instrument.modFilterTypes[mod]);
            let size;
            if (pointObject["volume"] == void 0) {
              size = volumeCap;
            } else if (pointObject["forMod"] == void 0) {
              size = Math.max(0, Math.min(volumeCap, Math.round((pointObject["volume"] | 0) * volumeCap / 100)));
            } else {
              size = (pointObject["forMod"] | 0) > 0 ? Math.round(pointObject["volume"] | 0) : Math.max(0, Math.min(volumeCap, Math.round((pointObject["volume"] | 0) * volumeCap / 100)));
            }
            if (time > song.beatsPerBar * Config.partsPerBeat) continue;
            if (note.pins.length == 0) {
              note.start = time;
              startInterval = interval;
            } else {
            }
            note.pins.push(makeNotePin(interval - startInterval, time - note.start, size));
          }
          if (note.pins.length < 2) continue;
          note.end = note.pins[note.pins.length - 1].time + note.start;
          const maxPitch = isNoiseChannel ? Config.drumCount - 1 : Config.maxPitch;
          let lowestPitch = maxPitch;
          let highestPitch = 0;
          for (let k = 0; k < note.pitches.length; k++) {
            note.pitches[k] += startInterval;
            if (note.pitches[k] < 0 || note.pitches[k] > maxPitch) {
              note.pitches.splice(k, 1);
              k--;
            }
            if (note.pitches[k] < lowestPitch) lowestPitch = note.pitches[k];
            if (note.pitches[k] > highestPitch) highestPitch = note.pitches[k];
          }
          if (note.pitches.length < 1) continue;
          for (let k = 0; k < note.pins.length; k++) {
            const pin = note.pins[k];
            if (pin.interval + lowestPitch < 0) pin.interval = -lowestPitch;
            if (pin.interval + highestPitch > maxPitch) pin.interval = maxPitch - highestPitch;
            if (k >= 2) {
              if (pin.interval == note.pins[k - 1].interval && pin.interval == note.pins[k - 2].interval && pin.size == note.pins[k - 1].size && pin.size == note.pins[k - 2].size) {
                note.pins.splice(k - 1, 1);
                k--;
              }
            }
          }
          if (note.start == 0) {
            note.continuesLastPattern = noteObject["continuesLastPattern"] === true;
          } else {
            note.continuesLastPattern = false;
          }
          if (format != "ultrabox" && format != "slarmoosbox" && instrument.modulators[mod] == Config.modulators.dictionary["tempo"].index) {
            for (const pin of note.pins) {
              const oldMin = 30;
              const newMin = 1;
              const old = pin.size + oldMin;
              pin.size = old - newMin;
            }
          }
          this.notes.push(note);
        }
      }
    }
  };
  var Operator = class {
    constructor(index) {
      this.frequency = 4;
      this.amplitude = 0;
      this.waveform = 0;
      this.pulseWidth = 0.5;
      this.reset(index);
    }
    static {
      __name(this, "Operator");
    }
    reset(index) {
      this.frequency = 4;
      this.amplitude = index <= 1 ? Config.operatorAmplitudeMax : 0;
      this.waveform = 0;
      this.pulseWidth = 5;
    }
    copy(other) {
      this.frequency = other.frequency;
      this.amplitude = other.amplitude;
      this.waveform = other.waveform;
      this.pulseWidth = other.pulseWidth;
    }
  };
  var CustomAlgorithm = class {
    constructor() {
      this.name = "";
      this.carrierCount = 0;
      this.modulatedBy = [[], [], [], [], [], []];
      this.associatedCarrier = [];
      this.fromPreset(1);
    }
    static {
      __name(this, "CustomAlgorithm");
    }
    set(carriers, modulation) {
      this.reset();
      this.carrierCount = carriers;
      for (let i = 0; i < this.modulatedBy.length; i++) {
        this.modulatedBy[i] = modulation[i];
        if (i < carriers) {
          this.associatedCarrier[i] = i + 1;
        }
        this.name += i + 1;
        for (let j = 0; j < modulation[i].length; j++) {
          this.name += modulation[i][j];
          if (modulation[i][j] > carriers - 1) {
            this.associatedCarrier[modulation[i][j] - 1] = i + 1;
          }
          this.name += ",";
        }
        if (i < carriers) {
          this.name += "|";
        } else {
          this.name += ".";
        }
      }
    }
    reset() {
      this.name = "";
      this.carrierCount = 1;
      this.modulatedBy = [[2, 3, 4, 5, 6], [], [], [], [], []];
      this.associatedCarrier = [1, 1, 1, 1, 1, 1];
    }
    copy(other) {
      this.name = other.name;
      this.carrierCount = other.carrierCount;
      this.modulatedBy = other.modulatedBy;
      this.associatedCarrier = other.associatedCarrier;
    }
    fromPreset(other) {
      this.reset();
      let preset = Config.algorithms6Op[other];
      this.name = preset.name;
      this.carrierCount = preset.carrierCount;
      for (var i = 0; i < preset.modulatedBy.length; i++) {
        this.modulatedBy[i] = Array.from(preset.modulatedBy[i]);
        this.associatedCarrier[i] = preset.associatedCarrier[i];
      }
    }
  };
  var CustomFeedBack = class {
    constructor() {
      //feels redunant
      this.name = "";
      this.indices = [[], [], [], [], [], []];
      this.fromPreset(1);
    }
    static {
      __name(this, "CustomFeedBack");
    }
    set(inIndices) {
      this.reset();
      for (let i = 0; i < this.indices.length; i++) {
        this.indices[i] = inIndices[i];
        for (let j = 0; j < inIndices[i].length; j++) {
          this.name += inIndices[i][j];
          this.name += ",";
        }
        this.name += ".";
      }
    }
    reset() {
      this.reset;
      this.name = "";
      this.indices = [[1], [], [], [], [], []];
    }
    copy(other) {
      this.name = other.name;
      this.indices = other.indices;
    }
    fromPreset(other) {
      this.reset();
      let preset = Config.feedbacks6Op[other];
      for (var i = 0; i < preset.indices.length; i++) {
        this.indices[i] = Array.from(preset.indices[i]);
        for (let j = 0; j < preset.indices[i].length; j++) {
          this.name += preset.indices[i][j];
          this.name += ",";
        }
        this.name += ".";
      }
    }
  };
  var SpectrumWave = class {
    constructor(isNoiseChannel) {
      this.spectrum = [];
      this.hash = -1;
      this.reset(isNoiseChannel);
    }
    static {
      __name(this, "SpectrumWave");
    }
    reset(isNoiseChannel) {
      for (let i = 0; i < Config.spectrumControlPoints; i++) {
        if (isNoiseChannel) {
          this.spectrum[i] = Math.round(Config.spectrumMax * (1 / Math.sqrt(1 + i / 3)));
        } else {
          const isHarmonic = i == 0 || i == 7 || i == 11 || i == 14 || i == 16 || i == 18 || i == 21 || i == 23 || i >= 25;
          this.spectrum[i] = isHarmonic ? Math.max(0, Math.round(Config.spectrumMax * (1 - i / 30))) : 0;
        }
      }
      this.markCustomWaveDirty();
    }
    markCustomWaveDirty() {
      const hashMult = SynthMessenger.fittingPowerOfTwo(Config.spectrumMax + 2) - 1;
      let hash = 0;
      for (const point of this.spectrum) hash = hash * hashMult + point >>> 0;
      this.hash = hash;
    }
  };
  var HarmonicsWave = class {
    constructor() {
      this.harmonics = [];
      this.hash = -1;
      this.reset();
    }
    static {
      __name(this, "HarmonicsWave");
    }
    reset() {
      for (let i = 0; i < Config.harmonicsControlPoints; i++) {
        this.harmonics[i] = 0;
      }
      this.harmonics[0] = Config.harmonicsMax;
      this.harmonics[3] = Config.harmonicsMax;
      this.harmonics[6] = Config.harmonicsMax;
      this.markCustomWaveDirty();
    }
    markCustomWaveDirty() {
      const hashMult = SynthMessenger.fittingPowerOfTwo(Config.harmonicsMax + 2) - 1;
      let hash = 0;
      for (const point of this.harmonics) hash = hash * hashMult + point >>> 0;
      this.hash = hash;
    }
  };
  var FilterControlPoint = class _FilterControlPoint {
    constructor() {
      this.freq = 0;
      this.gain = Config.filterGainCenter;
      this.type = 2 /* peak */;
    }
    static {
      __name(this, "FilterControlPoint");
    }
    set(freqSetting, gainSetting) {
      this.freq = freqSetting;
      this.gain = gainSetting;
    }
    getHz() {
      return _FilterControlPoint.getHzFromSettingValue(this.freq);
    }
    static getHzFromSettingValue(value) {
      return Config.filterFreqReferenceHz * Math.pow(2, (value - Config.filterFreqReferenceSetting) * Config.filterFreqStep);
    }
    static getSettingValueFromHz(hz) {
      return Math.log2(hz / Config.filterFreqReferenceHz) / Config.filterFreqStep + Config.filterFreqReferenceSetting;
    }
    static getRoundedSettingValueFromHz(hz) {
      return Math.max(0, Math.min(Config.filterFreqRange - 1, Math.round(_FilterControlPoint.getSettingValueFromHz(hz))));
    }
    getLinearGain(peakMult = 1) {
      const power = (this.gain - Config.filterGainCenter) * Config.filterGainStep;
      const neutral = this.type == 2 /* peak */ ? 0 : -0.5;
      const interpolatedPower = neutral + (power - neutral) * peakMult;
      return Math.pow(2, interpolatedPower);
    }
    static getRoundedSettingValueFromLinearGain(linearGain) {
      return Math.max(0, Math.min(Config.filterGainRange - 1, Math.round(Math.log2(linearGain) / Config.filterGainStep + Config.filterGainCenter)));
    }
    toCoefficients(filter, sampleRate, freqMult = 1, peakMult = 1) {
      const cornerRadiansPerSample = 2 * Math.PI * Math.max(Config.filterFreqMinHz, Math.min(Config.filterFreqMaxHz, freqMult * this.getHz())) / sampleRate;
      const linearGain = this.getLinearGain(peakMult);
      switch (this.type) {
        case 0 /* lowPass */:
          filter.lowPass2ndOrderButterworth(cornerRadiansPerSample, linearGain);
          break;
        case 1 /* highPass */:
          filter.highPass2ndOrderButterworth(cornerRadiansPerSample, linearGain);
          break;
        case 2 /* peak */:
          filter.peak2ndOrder(cornerRadiansPerSample, linearGain, 1);
          break;
        default:
          throw new Error();
      }
    }
    getVolumeCompensationMult() {
      const octave = (this.freq - Config.filterFreqReferenceSetting) * Config.filterFreqStep;
      const gainPow = (this.gain - Config.filterGainCenter) * Config.filterGainStep;
      switch (this.type) {
        case 0 /* lowPass */:
          const freqRelativeTo8khz = Math.pow(2, octave) * Config.filterFreqReferenceHz / 8e3;
          const warpedFreq = (Math.sqrt(1 + 4 * freqRelativeTo8khz) - 1) / 2;
          const warpedOctave = Math.log2(warpedFreq);
          return Math.pow(0.5, 0.2 * Math.max(0, gainPow + 1) + Math.min(0, Math.max(-3, 0.595 * warpedOctave + 0.35 * Math.min(0, gainPow + 1))));
        case 1 /* highPass */:
          return Math.pow(0.5, 0.125 * Math.max(0, gainPow + 1) + Math.min(0, 0.3 * (-octave - Math.log2(Config.filterFreqReferenceHz / 125)) + 0.2 * Math.min(0, gainPow + 1)));
        case 2 /* peak */:
          const distanceFromCenter = octave + Math.log2(Config.filterFreqReferenceHz / 2e3);
          const freqLoudness = Math.pow(1 / (1 + Math.pow(distanceFromCenter / 3, 2)), 2);
          return Math.pow(0.5, 0.125 * Math.max(0, gainPow) + 0.1 * freqLoudness * Math.min(0, gainPow));
        default:
          throw new Error();
      }
    }
  };
  var FilterSettings = class _FilterSettings {
    constructor() {
      this.controlPoints = [];
      this.controlPointCount = 0;
      this.reset();
    }
    static {
      __name(this, "FilterSettings");
    }
    reset() {
      this.controlPointCount = 0;
    }
    addPoint(type, freqSetting, gainSetting) {
      let controlPoint;
      if (this.controlPoints.length <= this.controlPointCount) {
        controlPoint = new FilterControlPoint();
        this.controlPoints[this.controlPointCount] = controlPoint;
      } else {
        controlPoint = this.controlPoints[this.controlPointCount];
      }
      this.controlPointCount++;
      controlPoint.type = type;
      controlPoint.set(freqSetting, gainSetting);
    }
    toJsonObject() {
      const filterArray = [];
      for (let i = 0; i < this.controlPointCount; i++) {
        const point = this.controlPoints[i];
        filterArray.push({
          "type": Config.filterTypeNames[point.type],
          "cutoffHz": Math.round(point.getHz() * 100) / 100,
          "linearGain": Math.round(point.getLinearGain() * 1e4) / 1e4
        });
      }
      return filterArray;
    }
    fromJsonObject(filterObject) {
      this.controlPoints.length = 0;
      if (filterObject) {
        for (const pointObject of filterObject) {
          const point = new FilterControlPoint();
          point.type = Config.filterTypeNames.indexOf(pointObject["type"]);
          if (point.type == -1) point.type = 2 /* peak */;
          if (pointObject["cutoffHz"] != void 0) {
            point.freq = FilterControlPoint.getRoundedSettingValueFromHz(pointObject["cutoffHz"]);
          } else {
            point.freq = 0;
          }
          if (pointObject["linearGain"] != void 0) {
            point.gain = FilterControlPoint.getRoundedSettingValueFromLinearGain(pointObject["linearGain"]);
          } else {
            point.gain = Config.filterGainCenter;
          }
          this.controlPoints.push(point);
        }
      }
      this.controlPointCount = this.controlPoints.length;
    }
    // Returns true if all filter control points match in number and type (but not freq/gain)
    static filtersCanMorph(filterA, filterB) {
      if (filterA.controlPointCount != filterB.controlPointCount)
        return false;
      for (let i = 0; i < filterA.controlPointCount; i++) {
        if (filterA.controlPoints[i].type != filterB.controlPoints[i].type)
          return false;
      }
      return true;
    }
    // Interpolate two FilterSettings, where pos=0 is filterA and pos=1 is filterB
    static lerpFilters(filterA, filterB, pos) {
      let lerpedFilter = new _FilterSettings();
      if (filterA == null) {
        return filterA;
      }
      if (filterB == null) {
        return filterB;
      }
      pos = Math.max(0, Math.min(1, pos));
      if (this.filtersCanMorph(filterA, filterB)) {
        for (let i = 0; i < filterA.controlPointCount; i++) {
          lerpedFilter.controlPoints[i] = new FilterControlPoint();
          lerpedFilter.controlPoints[i].type = filterA.controlPoints[i].type;
          lerpedFilter.controlPoints[i].freq = filterA.controlPoints[i].freq + (filterB.controlPoints[i].freq - filterA.controlPoints[i].freq) * pos;
          lerpedFilter.controlPoints[i].gain = filterA.controlPoints[i].gain + (filterB.controlPoints[i].gain - filterA.controlPoints[i].gain) * pos;
        }
        lerpedFilter.controlPointCount = filterA.controlPointCount;
        return lerpedFilter;
      } else {
        return pos >= 1 ? filterB : filterA;
      }
    }
    convertLegacySettings(legacyCutoffSetting, legacyResonanceSetting, legacyEnv) {
      this.reset();
      const legacyFilterCutoffMaxHz = 8e3;
      const legacyFilterMax = 0.95;
      const legacyFilterMaxRadians = Math.asin(legacyFilterMax / 2) * 2;
      const legacyFilterMaxResonance = 0.95;
      const legacyFilterCutoffRange = 11;
      const legacyFilterResonanceRange = 8;
      const resonant = legacyResonanceSetting > 1;
      const firstOrder = legacyResonanceSetting == 0;
      const cutoffAtMax = legacyCutoffSetting == legacyFilterCutoffRange - 1;
      const envDecays = legacyEnv.type == 5 /* flare */ || legacyEnv.type == 6 /* twang */ || legacyEnv.type == 10 /* decay */ || legacyEnv.type == 1 /* noteSize */;
      const standardSampleRate = 48e3;
      const legacyHz = legacyFilterCutoffMaxHz * Math.pow(2, (legacyCutoffSetting - (legacyFilterCutoffRange - 1)) * 0.5);
      const legacyRadians = Math.min(legacyFilterMaxRadians, 2 * Math.PI * legacyHz / standardSampleRate);
      if (legacyEnv.type == 0 /* none */ && !resonant && cutoffAtMax) {
      } else if (firstOrder) {
        const extraOctaves = 3.5;
        const targetRadians = legacyRadians * Math.pow(2, extraOctaves);
        const curvedRadians = targetRadians / (1 + targetRadians / Math.PI);
        const curvedHz = standardSampleRate * curvedRadians / (2 * Math.PI);
        const freqSetting = FilterControlPoint.getRoundedSettingValueFromHz(curvedHz);
        const finalHz = FilterControlPoint.getHzFromSettingValue(freqSetting);
        const finalRadians = 2 * Math.PI * finalHz / standardSampleRate;
        const legacyFilter = new FilterCoefficients();
        legacyFilter.lowPass1stOrderSimplified(legacyRadians);
        const response = new FrequencyResponse();
        response.analyze(legacyFilter, finalRadians);
        const legacyFilterGainAtNewRadians = response.magnitude();
        let logGain = Math.log2(legacyFilterGainAtNewRadians);
        logGain = -extraOctaves + (logGain + extraOctaves) * 0.82;
        if (envDecays) logGain = Math.min(logGain, -1);
        const convertedGain = Math.pow(2, logGain);
        const gainSetting = FilterControlPoint.getRoundedSettingValueFromLinearGain(convertedGain);
        this.addPoint(0 /* lowPass */, freqSetting, gainSetting);
      } else {
        const intendedGain = 0.5 / (1 - legacyFilterMaxResonance * Math.sqrt(Math.max(0, legacyResonanceSetting - 1) / (legacyFilterResonanceRange - 2)));
        const invertedGain = 0.5 / intendedGain;
        const maxRadians = 2 * Math.PI * legacyFilterCutoffMaxHz / standardSampleRate;
        const freqRatio = legacyRadians / maxRadians;
        const targetRadians = legacyRadians * (freqRatio * Math.pow(invertedGain, 0.9) + 1);
        const curvedRadians = legacyRadians + (targetRadians - legacyRadians) * invertedGain;
        let curvedHz;
        if (envDecays) {
          curvedHz = standardSampleRate * Math.min(curvedRadians, legacyRadians * Math.pow(2, 0.25)) / (2 * Math.PI);
        } else {
          curvedHz = standardSampleRate * curvedRadians / (2 * Math.PI);
        }
        const freqSetting = FilterControlPoint.getRoundedSettingValueFromHz(curvedHz);
        let legacyFilterGain;
        if (envDecays) {
          legacyFilterGain = intendedGain;
        } else {
          const legacyFilter = new FilterCoefficients();
          legacyFilter.lowPass2ndOrderSimplified(legacyRadians, intendedGain);
          const response = new FrequencyResponse();
          response.analyze(legacyFilter, curvedRadians);
          legacyFilterGain = response.magnitude();
        }
        if (!resonant) legacyFilterGain = Math.min(legacyFilterGain, Math.sqrt(0.5));
        const gainSetting = FilterControlPoint.getRoundedSettingValueFromLinearGain(legacyFilterGain);
        this.addPoint(0 /* lowPass */, freqSetting, gainSetting);
      }
      this.controlPoints.length = this.controlPointCount;
    }
    // Similar to above, but purpose-fit for quick conversions in synth calls.
    convertLegacySettingsForSynth(legacyCutoffSetting, legacyResonanceSetting, allowFirstOrder = false) {
      this.reset();
      const legacyFilterCutoffMaxHz = 8e3;
      const legacyFilterMax = 0.95;
      const legacyFilterMaxRadians = Math.asin(legacyFilterMax / 2) * 2;
      const legacyFilterMaxResonance = 0.95;
      const legacyFilterCutoffRange = 11;
      const legacyFilterResonanceRange = 8;
      const firstOrder = legacyResonanceSetting == 0 && allowFirstOrder;
      const standardSampleRate = 48e3;
      const legacyHz = legacyFilterCutoffMaxHz * Math.pow(2, (legacyCutoffSetting - (legacyFilterCutoffRange - 1)) * 0.5);
      const legacyRadians = Math.min(legacyFilterMaxRadians, 2 * Math.PI * legacyHz / standardSampleRate);
      if (firstOrder) {
        const extraOctaves = 3.5;
        const targetRadians = legacyRadians * Math.pow(2, extraOctaves);
        const curvedRadians = targetRadians / (1 + targetRadians / Math.PI);
        const curvedHz = standardSampleRate * curvedRadians / (2 * Math.PI);
        const freqSetting = FilterControlPoint.getRoundedSettingValueFromHz(curvedHz);
        const finalHz = FilterControlPoint.getHzFromSettingValue(freqSetting);
        const finalRadians = 2 * Math.PI * finalHz / standardSampleRate;
        const legacyFilter = new FilterCoefficients();
        legacyFilter.lowPass1stOrderSimplified(legacyRadians);
        const response = new FrequencyResponse();
        response.analyze(legacyFilter, finalRadians);
        const legacyFilterGainAtNewRadians = response.magnitude();
        let logGain = Math.log2(legacyFilterGainAtNewRadians);
        logGain = -extraOctaves + (logGain + extraOctaves) * 0.82;
        const convertedGain = Math.pow(2, logGain);
        const gainSetting = FilterControlPoint.getRoundedSettingValueFromLinearGain(convertedGain);
        this.addPoint(0 /* lowPass */, freqSetting, gainSetting);
      } else {
        const intendedGain = 0.5 / (1 - legacyFilterMaxResonance * Math.sqrt(Math.max(0, legacyResonanceSetting - 1) / (legacyFilterResonanceRange - 2)));
        const invertedGain = 0.5 / intendedGain;
        const maxRadians = 2 * Math.PI * legacyFilterCutoffMaxHz / standardSampleRate;
        const freqRatio = legacyRadians / maxRadians;
        const targetRadians = legacyRadians * (freqRatio * Math.pow(invertedGain, 0.9) + 1);
        const curvedRadians = legacyRadians + (targetRadians - legacyRadians) * invertedGain;
        let curvedHz;
        curvedHz = standardSampleRate * curvedRadians / (2 * Math.PI);
        const freqSetting = FilterControlPoint.getSettingValueFromHz(curvedHz);
        let legacyFilterGain;
        const legacyFilter = new FilterCoefficients();
        legacyFilter.lowPass2ndOrderSimplified(legacyRadians, intendedGain);
        const response = new FrequencyResponse();
        response.analyze(legacyFilter, curvedRadians);
        legacyFilterGain = response.magnitude();
        const gainSetting = FilterControlPoint.getRoundedSettingValueFromLinearGain(legacyFilterGain);
        this.addPoint(0 /* lowPass */, freqSetting, gainSetting);
      }
    }
  };
  var EnvelopeSettings = class {
    constructor(isNoiseEnvelope) {
      this.isNoiseEnvelope = isNoiseEnvelope;
      this.target = 0;
      this.index = 0;
      this.envelope = 0;
      //midbox
      this.perEnvelopeSpeed = Config.envelopePresets[this.envelope].speed;
      this.perEnvelopeLowerBound = 0;
      this.perEnvelopeUpperBound = 1;
      //modulation support
      this.tempEnvelopeSpeed = null;
      this.tempEnvelopeLowerBound = null;
      this.tempEnvelopeUpperBound = null;
      //pseudo random
      this.steps = 2;
      this.seed = 2;
      //lfo and random types
      this.waveform = 0 /* sine */;
      //moved discrete into here
      this.discrete = false;
      this.reset();
    }
    static {
      __name(this, "EnvelopeSettings");
    }
    reset() {
      this.target = 0;
      this.index = 0;
      this.envelope = 0;
      this.pitchEnvelopeStart = 0;
      this.pitchEnvelopeEnd = this.isNoiseEnvelope ? Config.drumCount - 1 : Config.maxPitch;
      this.inverse = false;
      this.isNoiseEnvelope = false;
      this.perEnvelopeSpeed = Config.envelopePresets[this.envelope].speed;
      this.perEnvelopeLowerBound = 0;
      this.perEnvelopeUpperBound = 1;
      this.tempEnvelopeSpeed = null;
      this.tempEnvelopeLowerBound = null;
      this.tempEnvelopeUpperBound = null;
      this.steps = 2;
      this.seed = 2;
      this.waveform = 0 /* sine */;
      this.discrete = false;
    }
    toJsonObject() {
      const envelopeObject = {
        "target": Config.instrumentAutomationTargets[this.target].name,
        "envelope": Config.envelopes[this.envelope].name,
        "inverse": this.inverse,
        "perEnvelopeSpeed": this.perEnvelopeSpeed,
        "perEnvelopeLowerBound": this.perEnvelopeLowerBound,
        "perEnvelopeUpperBound": this.perEnvelopeUpperBound,
        "discrete": this.discrete
      };
      if (Config.instrumentAutomationTargets[this.target].maxCount > 1) {
        envelopeObject["index"] = this.index;
      }
      if (Config.envelopes[this.envelope].name == "pitch") {
        envelopeObject["pitchEnvelopeStart"] = this.pitchEnvelopeStart;
        envelopeObject["pitchEnvelopeEnd"] = this.pitchEnvelopeEnd;
      } else if (Config.envelopes[this.envelope].name == "random") {
        envelopeObject["steps"] = this.steps;
        envelopeObject["seed"] = this.seed;
        envelopeObject["waveform"] = this.waveform;
      } else if (Config.envelopes[this.envelope].name == "lfo") {
        envelopeObject["waveform"] = this.waveform;
        envelopeObject["steps"] = this.steps;
      }
      return envelopeObject;
    }
    fromJsonObject(envelopeObject, format) {
      this.reset();
      let target = Config.instrumentAutomationTargets.dictionary[envelopeObject["target"]];
      if (target == null) target = Config.instrumentAutomationTargets.dictionary["noteVolume"];
      this.target = target.index;
      let envelope = Config.envelopePresets.dictionary["none"];
      let isTremolo2 = false;
      if (format == "slarmoosbox") {
        if (envelopeObject["envelope"] == "tremolo2") {
          envelope = Config.envelopes[8 /* lfo */];
          isTremolo2 = true;
        } else if (envelopeObject["envelope"] == "tremolo") {
          envelope = Config.envelopes[8 /* lfo */];
          isTremolo2 = false;
        } else {
          envelope = Config.envelopes.dictionary[envelopeObject["envelope"]];
        }
      } else {
        if (Config.envelopePresets.dictionary[envelopeObject["envelope"]].type == 9 /* tremolo2 */) {
          envelope = Config.envelopes[8 /* lfo */];
          isTremolo2 = true;
        } else if (Config.envelopes[Math.max(Config.envelopePresets.dictionary[envelopeObject["envelope"]].type - 1, 0)].index > 8 /* lfo */) {
          envelope = Config.envelopes[Config.envelopePresets.dictionary[envelopeObject["envelope"]].type - 1];
        } else {
          envelope = Config.envelopes[Config.envelopePresets.dictionary[envelopeObject["envelope"]].type];
        }
      }
      if (envelope == void 0) {
        if (Config.envelopePresets.dictionary[envelopeObject["envelope"]].type == 9 /* tremolo2 */) {
          envelope = Config.envelopes[8 /* lfo */];
          isTremolo2 = true;
        } else if (Config.envelopes[Math.max(Config.envelopePresets.dictionary[envelopeObject["envelope"]].type - 1, 0)].index > 8 /* lfo */) {
          envelope = Config.envelopes[Config.envelopePresets.dictionary[envelopeObject["envelope"]].type - 1];
        } else {
          envelope = Config.envelopes[Config.envelopePresets.dictionary[envelopeObject["envelope"]].type];
        }
      }
      if (envelope == null) envelope = Config.envelopePresets.dictionary["none"];
      this.envelope = envelope.index;
      if (envelopeObject["index"] != void 0) {
        this.index = clamp(0, Config.instrumentAutomationTargets[this.target].maxCount, envelopeObject["index"] | 0);
      } else {
        this.index = 0;
      }
      if (envelopeObject["pitchEnvelopeStart"] != void 0) {
        this.pitchEnvelopeStart = clamp(0, this.isNoiseEnvelope ? Config.drumCount : Config.maxPitch + 1, envelopeObject["pitchEnvelopeStart"]);
      } else {
        this.pitchEnvelopeStart = 0;
      }
      if (envelopeObject["pitchEnvelopeEnd"] != void 0) {
        this.pitchEnvelopeEnd = clamp(0, this.isNoiseEnvelope ? Config.drumCount : Config.maxPitch + 1, envelopeObject["pitchEnvelopeEnd"]);
      } else {
        this.pitchEnvelopeEnd = this.isNoiseEnvelope ? Config.drumCount : Config.maxPitch;
      }
      this.inverse = Boolean(envelopeObject["inverse"]);
      if (envelopeObject["perEnvelopeSpeed"] != void 0) {
        this.perEnvelopeSpeed = envelopeObject["perEnvelopeSpeed"];
      } else {
        this.perEnvelopeSpeed = Config.envelopePresets.dictionary[envelopeObject["envelope"]].speed;
      }
      if (envelopeObject["perEnvelopeLowerBound"] != void 0) {
        this.perEnvelopeLowerBound = clamp(Config.perEnvelopeBoundMin, Config.perEnvelopeBoundMax + 1, envelopeObject["perEnvelopeLowerBound"]);
      } else {
        this.perEnvelopeLowerBound = 0;
      }
      if (envelopeObject["perEnvelopeUpperBound"] != void 0) {
        this.perEnvelopeUpperBound = clamp(Config.perEnvelopeBoundMin, Config.perEnvelopeBoundMax + 1, envelopeObject["perEnvelopeUpperBound"]);
      } else {
        this.perEnvelopeUpperBound = 1;
      }
      if (isTremolo2) {
        if (this.inverse) {
          this.perEnvelopeUpperBound = Math.floor(this.perEnvelopeUpperBound / 2 * 10) / 10;
          this.perEnvelopeLowerBound = Math.floor(this.perEnvelopeLowerBound / 2 * 10) / 10;
        } else {
          this.perEnvelopeUpperBound = Math.floor((0.5 + (this.perEnvelopeUpperBound - this.perEnvelopeLowerBound) / 2) * 10) / 10;
          this.perEnvelopeLowerBound = 0.5;
        }
      }
      if (envelopeObject["steps"] != void 0) {
        this.steps = clamp(1, Config.randomEnvelopeStepsMax + 1, envelopeObject["steps"]);
      } else {
        this.steps = 2;
      }
      if (envelopeObject["seed"] != void 0) {
        this.seed = clamp(1, Config.randomEnvelopeSeedMax + 1, envelopeObject["seed"]);
      } else {
        this.seed = 2;
      }
      if (envelopeObject["waveform"] != void 0) {
        this.waveform = envelopeObject["waveform"];
      } else {
        this.waveform = 0 /* sine */;
      }
      if (envelopeObject["discrete"] != void 0) {
        this.discrete = envelopeObject["discrete"];
      } else {
        this.discrete = false;
      }
    }
  };
  var Instrument = class {
    constructor(isNoiseChannel, isModChannel) {
      this.type = 0 /* chip */;
      this.preset = 0;
      this.chipWave = 2;
      // advloop addition
      this.isUsingAdvancedLoopControls = false;
      this.chipWaveLoopStart = 0;
      this.chipWaveLoopEnd = Config.rawRawChipWaves[this.chipWave].samples.length - 1;
      this.chipWaveLoopMode = 0;
      // 0: loop, 1: ping-pong, 2: once, 3: play loop once
      this.chipWavePlayBackwards = false;
      this.chipWaveStartOffset = 0;
      // advloop addition
      this.chipNoise = 1;
      this.eqFilter = new FilterSettings();
      this.eqFilterType = false;
      this.eqFilterSimpleCut = Config.filterSimpleCutRange - 1;
      this.eqFilterSimplePeak = 0;
      this.noteFilter = new FilterSettings();
      this.noteFilterType = false;
      this.noteFilterSimpleCut = Config.filterSimpleCutRange - 1;
      this.noteFilterSimplePeak = 0;
      this.eqSubFilters = [];
      this.noteSubFilters = [];
      this.envelopes = [];
      this.fadeIn = 0;
      this.fadeOut = Config.fadeOutNeutral;
      this.envelopeCount = 0;
      this.transition = Config.transitions.dictionary["normal"].index;
      this.pitchShift = 0;
      this.detune = 0;
      this.vibrato = 0;
      this.interval = 0;
      this.vibratoDepth = 0;
      this.vibratoSpeed = 10;
      this.vibratoDelay = 0;
      this.vibratoType = 0;
      this.envelopeSpeed = 12;
      this.unison = 0;
      this.unisonVoices = 1;
      this.unisonSpread = 0;
      this.unisonOffset = 0;
      this.unisonExpression = 1.4;
      this.unisonSign = 1;
      this.effects = 0;
      this.chord = 1;
      this.volume = 0;
      this.pan = Config.panCenter;
      this.panDelay = 0;
      this.arpeggioSpeed = 12;
      this.monoChordTone = 0;
      this.fastTwoNoteArp = false;
      this.legacyTieOver = false;
      this.clicklessTransition = false;
      this.aliases = false;
      this.pulseWidth = Config.pulseWidthRange;
      this.decimalOffset = 0;
      this.supersawDynamism = Config.supersawDynamismMax;
      this.supersawSpread = Math.ceil(Config.supersawSpreadMax / 2);
      this.supersawShape = 0;
      this.stringSustain = 10;
      this.stringSustainType = 1 /* acoustic */;
      this.distortion = 0;
      this.bitcrusherFreq = 0;
      this.bitcrusherQuantization = 0;
      this.ringModulation = Config.ringModRange >> 1;
      this.ringModulationHz = Config.ringModHzRange >> 1;
      this.ringModWaveformIndex = 0;
      this.ringModPulseWidth = Config.pwmOperatorWaves.length >> 1;
      this.ringModHzOffset = 200;
      this.granular = 4;
      this.grainSize = (Config.grainSizeMax - Config.grainSizeMin) / Config.grainSizeStep;
      this.grainAmounts = Config.grainAmountsMax;
      this.grainRange = 40;
      this.chorus = 0;
      this.reverb = 0;
      this.echoSustain = 0;
      this.echoDelay = 0;
      this.pluginValues = new Array(64);
      this.algorithm = 0;
      this.feedbackType = 0;
      this.algorithm6Op = 1;
      this.feedbackType6Op = 1;
      //default to not custom
      this.customAlgorithm = new CustomAlgorithm();
      //{ name: "1←4(2←5 3←6", carrierCount: 3, associatedCarrier: [1, 2, 3, 1, 2, 3], modulatedBy: [[2, 3, 4], [5], [6], [], [], []] };
      this.customFeedbackType = new CustomFeedBack();
      //{ name: "1↔4 2↔5 3↔6", indices: [[3], [5], [6], [1], [2], [3]] };
      this.feedbackAmplitude = 0;
      this.customChipWave = new Float32Array(64);
      this.customChipWaveIntegral = new Float32Array(65);
      // One extra element for wrap-around in chipSynth.
      this.operators = [];
      this.harmonicsWave = new HarmonicsWave();
      this.drumsetEnvelopes = [];
      this.drumsetSpectrumWaves = [];
      this.modChannels = [];
      this.modInstruments = [];
      this.modulators = [];
      this.modFilterTypes = [];
      this.modEnvelopeNumbers = [];
      this.invalidModulators = [];
      //Literally just for pitch envelopes. 
      this.isNoiseInstrument = false;
      if (isModChannel) {
        for (let mod = 0; mod < Config.modCount; mod++) {
          this.modChannels.push(-2);
          this.modInstruments.push(0);
          this.modulators.push(Config.modulators.dictionary["none"].index);
        }
      }
      this.spectrumWave = new SpectrumWave(isNoiseChannel);
      for (let i = 0; i < Config.operatorCount + 2; i++) {
        this.operators[i] = new Operator(i);
      }
      for (let i = 0; i < Config.drumCount; i++) {
        this.drumsetEnvelopes[i] = Config.envelopePresets.dictionary["twang 2"].index;
        this.drumsetSpectrumWaves[i] = new SpectrumWave(true);
      }
      for (let i = 0; i < 64; i++) {
        this.customChipWave[i] = 24 - Math.floor(i * (48 / 64));
      }
      let sum = 0;
      for (let i = 0; i < this.customChipWave.length; i++) {
        sum += this.customChipWave[i];
      }
      const average = sum / this.customChipWave.length;
      let cumulative = 0;
      let wavePrev = 0;
      for (let i = 0; i < this.customChipWave.length; i++) {
        cumulative += wavePrev;
        wavePrev = this.customChipWave[i] - average;
        this.customChipWaveIntegral[i] = cumulative;
      }
      this.customChipWaveIntegral[64] = 0;
      this.isNoiseInstrument = isNoiseChannel;
    }
    static {
      __name(this, "Instrument");
    }
    setTypeAndReset(type, isNoiseChannel, isModChannel) {
      if (isModChannel) type = 10 /* mod */;
      this.type = type;
      this.preset = type;
      this.volume = 0;
      this.effects = 1 << 2 /* panning */;
      this.chorus = Config.chorusRange - 1;
      this.reverb = 0;
      this.echoSustain = Math.floor((Config.echoSustainRange - 1) * 0.5);
      this.echoDelay = Math.floor((Config.echoDelayRange - 1) * 0.5);
      this.pluginValues.fill(0);
      this.eqFilter.reset();
      this.eqFilterType = false;
      this.eqFilterSimpleCut = Config.filterSimpleCutRange - 1;
      this.eqFilterSimplePeak = 0;
      for (let i = 0; i < Config.filterMorphCount; i++) {
        this.eqSubFilters[i] = null;
        this.noteSubFilters[i] = null;
      }
      this.noteFilter.reset();
      this.noteFilterType = false;
      this.noteFilterSimpleCut = Config.filterSimpleCutRange - 1;
      this.noteFilterSimplePeak = 0;
      this.distortion = Math.floor((Config.distortionRange - 1) * 0.75);
      this.bitcrusherFreq = Math.floor((Config.bitcrusherFreqRange - 1) * 0.5);
      this.bitcrusherQuantization = Math.floor((Config.bitcrusherQuantizationRange - 1) * 0.5);
      this.ringModulation = Config.ringModRange >> 1;
      this.ringModulationHz = Config.ringModHzRange >> 1;
      this.ringModWaveformIndex = 0;
      this.ringModPulseWidth = Config.pwmOperatorWaves.length >> 1;
      this.ringModHzOffset = 200;
      this.granular = 4;
      this.grainSize = (Config.grainSizeMax - Config.grainSizeMin) / Config.grainSizeStep;
      this.grainAmounts = Config.grainAmountsMax;
      this.grainRange = 40;
      this.pan = Config.panCenter;
      this.panDelay = 0;
      this.pitchShift = Config.pitchShiftCenter;
      this.detune = Config.detuneCenter;
      this.vibrato = 0;
      this.unison = 0;
      this.stringSustain = 10;
      this.stringSustainType = Config.enableAcousticSustain ? 1 /* acoustic */ : 0 /* bright */;
      this.clicklessTransition = false;
      this.arpeggioSpeed = 12;
      this.monoChordTone = 1;
      this.envelopeSpeed = 12;
      this.legacyTieOver = false;
      this.aliases = false;
      this.fadeIn = 0;
      this.fadeOut = Config.fadeOutNeutral;
      this.transition = Config.transitions.dictionary["normal"].index;
      this.envelopeCount = 0;
      this.isNoiseInstrument = isNoiseChannel;
      switch (type) {
        case 0 /* chip */:
          this.chipWave = 2;
          this.chord = Config.chords.dictionary["arpeggio"].index;
          this.isUsingAdvancedLoopControls = false;
          this.chipWaveLoopStart = 0;
          this.chipWaveLoopEnd = Config.rawRawChipWaves[this.chipWave].samples.length - 1;
          this.chipWaveLoopMode = 0;
          this.chipWavePlayBackwards = false;
          this.chipWaveStartOffset = 0;
          break;
        case 9 /* customChipWave */:
          this.chipWave = 2;
          this.chord = Config.chords.dictionary["arpeggio"].index;
          for (let i = 0; i < 64; i++) {
            this.customChipWave[i] = 24 - Math.floor(i * (48 / 64));
          }
          let sum = 0;
          for (let i = 0; i < this.customChipWave.length; i++) {
            sum += this.customChipWave[i];
          }
          const average = sum / this.customChipWave.length;
          let cumulative = 0;
          let wavePrev = 0;
          for (let i = 0; i < this.customChipWave.length; i++) {
            cumulative += wavePrev;
            wavePrev = this.customChipWave[i] - average;
            this.customChipWaveIntegral[i] = cumulative;
          }
          this.customChipWaveIntegral[64] = 0;
          break;
        case 1 /* fm */:
          this.chord = Config.chords.dictionary["custom interval"].index;
          this.algorithm = 0;
          this.feedbackType = 0;
          this.feedbackAmplitude = 0;
          for (let i = 0; i < this.operators.length; i++) {
            this.operators[i].reset(i);
          }
          break;
        case 11 /* fm6op */:
          this.transition = 1;
          this.vibrato = 0;
          this.effects = 1;
          this.chord = 3;
          this.algorithm = 0;
          this.feedbackType = 0;
          this.algorithm6Op = 1;
          this.feedbackType6Op = 1;
          this.customAlgorithm.fromPreset(1);
          this.feedbackAmplitude = 0;
          for (let i = 0; i < this.operators.length; i++) {
            this.operators[i].reset(i);
          }
          break;
        case 2 /* noise */:
          this.chipNoise = 1;
          this.chord = Config.chords.dictionary["arpeggio"].index;
          break;
        case 3 /* spectrum */:
          this.chord = Config.chords.dictionary["simultaneous"].index;
          this.spectrumWave.reset(isNoiseChannel);
          break;
        case 4 /* drumset */:
          this.chord = Config.chords.dictionary["simultaneous"].index;
          for (let i = 0; i < Config.drumCount; i++) {
            this.drumsetEnvelopes[i] = Config.envelopePresets.dictionary["twang 2"].index;
            if (this.drumsetSpectrumWaves[i] == void 0) {
              this.drumsetSpectrumWaves[i] = new SpectrumWave(true);
            }
            this.drumsetSpectrumWaves[i].reset(isNoiseChannel);
          }
          break;
        case 5 /* harmonics */:
          this.chord = Config.chords.dictionary["simultaneous"].index;
          this.harmonicsWave.reset();
          break;
        case 6 /* pwm */:
          this.chord = Config.chords.dictionary["arpeggio"].index;
          this.pulseWidth = Config.pulseWidthRange;
          this.decimalOffset = 0;
          break;
        case 7 /* pickedString */:
          this.chord = Config.chords.dictionary["strum"].index;
          this.harmonicsWave.reset();
          break;
        case 10 /* mod */:
          this.transition = 0;
          this.vibrato = 0;
          this.interval = 0;
          this.effects = 0;
          this.chord = 0;
          this.modChannels = [];
          this.modInstruments = [];
          this.modulators = [];
          for (let mod = 0; mod < Config.modCount; mod++) {
            this.modChannels.push(-2);
            this.modInstruments.push(0);
            this.modulators.push(Config.modulators.dictionary["none"].index);
            this.invalidModulators[mod] = false;
            this.modFilterTypes[mod] = 0;
            this.modEnvelopeNumbers[mod] = 0;
          }
          break;
        case 8 /* supersaw */:
          this.chord = Config.chords.dictionary["arpeggio"].index;
          this.supersawDynamism = Config.supersawDynamismMax;
          this.supersawSpread = Math.ceil(Config.supersawSpreadMax / 2);
          this.supersawShape = 0;
          this.pulseWidth = Config.pulseWidthRange - 1;
          this.decimalOffset = 0;
          break;
        default:
          throw new Error("Unrecognized instrument type: " + type);
      }
      if (this.chord != Config.chords.dictionary["simultaneous"].index) {
        this.effects = this.effects | 1 << 11 /* chord */;
      }
    }
    // (only) difference for JummBox: Returns whether or not the note filter was chosen for filter conversion.
    convertLegacySettings(legacySettings, forceSimpleFilter) {
      let legacyCutoffSetting = legacySettings.filterCutoff;
      let legacyResonanceSetting = legacySettings.filterResonance;
      let legacyFilterEnv = legacySettings.filterEnvelope;
      let legacyPulseEnv = legacySettings.pulseEnvelope;
      let legacyOperatorEnvelopes = legacySettings.operatorEnvelopes;
      let legacyFeedbackEnv = legacySettings.feedbackEnvelope;
      if (legacyCutoffSetting == void 0) legacyCutoffSetting = this.type == 0 /* chip */ ? 6 : 10;
      if (legacyResonanceSetting == void 0) legacyResonanceSetting = 0;
      if (legacyFilterEnv == void 0) legacyFilterEnv = Config.envelopePresets.dictionary["none"];
      if (legacyPulseEnv == void 0) legacyPulseEnv = Config.envelopePresets.dictionary[this.type == 6 /* pwm */ ? "twang 2" : "none"];
      if (legacyOperatorEnvelopes == void 0) legacyOperatorEnvelopes = [Config.envelopePresets.dictionary[this.type == 1 /* fm */ ? "note size" : "none"], Config.envelopePresets.dictionary["none"], Config.envelopePresets.dictionary["none"], Config.envelopePresets.dictionary["none"]];
      if (legacyFeedbackEnv == void 0) legacyFeedbackEnv = Config.envelopePresets.dictionary["none"];
      const legacyFilterCutoffRange = 11;
      const cutoffAtMax = legacyCutoffSetting == legacyFilterCutoffRange - 1;
      if (cutoffAtMax && legacyFilterEnv.type == 4 /* punch */) legacyFilterEnv = Config.envelopePresets.dictionary["none"];
      const carrierCount = Config.algorithms[this.algorithm].carrierCount;
      let noCarriersControlledByNoteSize = true;
      let allCarriersControlledByNoteSize = true;
      let noteSizeControlsSomethingElse = legacyFilterEnv.type == 1 /* noteSize */ || legacyPulseEnv.type == 1 /* noteSize */;
      if (this.type == 1 /* fm */ || this.type == 11 /* fm6op */) {
        noteSizeControlsSomethingElse = noteSizeControlsSomethingElse || legacyFeedbackEnv.type == 1 /* noteSize */;
        for (let i = 0; i < legacyOperatorEnvelopes.length; i++) {
          if (i < carrierCount) {
            if (legacyOperatorEnvelopes[i].type != 1 /* noteSize */) {
              allCarriersControlledByNoteSize = false;
            } else {
              noCarriersControlledByNoteSize = false;
            }
          } else {
            noteSizeControlsSomethingElse = noteSizeControlsSomethingElse || legacyOperatorEnvelopes[i].type == 1 /* noteSize */;
          }
        }
      }
      this.envelopeCount = 0;
      if (this.type == 1 /* fm */ || this.type == 11 /* fm6op */) {
        if (allCarriersControlledByNoteSize && noteSizeControlsSomethingElse) {
          this.addEnvelope(Config.instrumentAutomationTargets.dictionary["noteVolume"].index, 0, Config.envelopePresets.dictionary["note size"].index, false);
        } else if (noCarriersControlledByNoteSize && !noteSizeControlsSomethingElse) {
          this.addEnvelope(Config.instrumentAutomationTargets.dictionary["none"].index, 0, Config.envelopePresets.dictionary["note size"].index, false);
        }
      }
      if (legacyFilterEnv.type == 0 /* none */) {
        this.noteFilter.reset();
        this.noteFilterType = false;
        this.eqFilter.convertLegacySettings(legacyCutoffSetting, legacyResonanceSetting, legacyFilterEnv);
        this.effects &= ~(1 << 5 /* noteFilter */);
        if (forceSimpleFilter || this.eqFilterType) {
          this.eqFilterType = true;
          this.eqFilterSimpleCut = legacyCutoffSetting;
          this.eqFilterSimplePeak = legacyResonanceSetting;
        }
      } else {
        this.eqFilter.reset();
        this.eqFilterType = false;
        this.noteFilterType = false;
        this.noteFilter.convertLegacySettings(legacyCutoffSetting, legacyResonanceSetting, legacyFilterEnv);
        this.effects |= 1 << 5 /* noteFilter */;
        this.addEnvelope(Config.instrumentAutomationTargets.dictionary["noteFilterAllFreqs"].index, 0, legacyFilterEnv.index, false);
        if (forceSimpleFilter || this.noteFilterType) {
          this.noteFilterType = true;
          this.noteFilterSimpleCut = legacyCutoffSetting;
          this.noteFilterSimplePeak = legacyResonanceSetting;
        }
      }
      if (legacyPulseEnv.type != 0 /* none */) {
        this.addEnvelope(Config.instrumentAutomationTargets.dictionary["pulseWidth"].index, 0, legacyPulseEnv.index, false);
      }
      for (let i = 0; i < legacyOperatorEnvelopes.length; i++) {
        if (i < carrierCount && allCarriersControlledByNoteSize) continue;
        if (legacyOperatorEnvelopes[i].type != 0 /* none */) {
          this.addEnvelope(Config.instrumentAutomationTargets.dictionary["operatorAmplitude"].index, i, legacyOperatorEnvelopes[i].index, false);
        }
      }
      if (legacyFeedbackEnv.type != 0 /* none */) {
        this.addEnvelope(Config.instrumentAutomationTargets.dictionary["feedbackAmplitude"].index, 0, legacyFeedbackEnv.index, false);
      }
    }
    toJsonObject() {
      const instrumentObject = {
        "type": Config.instrumentTypeNames[this.type],
        "volume": this.volume,
        "eqFilter": this.eqFilter.toJsonObject(),
        "eqFilterType": this.eqFilterType,
        "eqSimpleCut": this.eqFilterSimpleCut,
        "eqSimplePeak": this.eqFilterSimplePeak,
        "envelopeSpeed": this.envelopeSpeed
      };
      if (this.preset != this.type) {
        instrumentObject["preset"] = this.preset;
      }
      for (let i = 0; i < Config.filterMorphCount; i++) {
        if (this.eqSubFilters[i] != null)
          instrumentObject["eqSubFilters" + i] = this.eqSubFilters[i].toJsonObject();
      }
      const effects = [];
      for (const effect of Config.effectOrder) {
        if (this.effects & 1 << effect) {
          effects.push(Config.effectNames[effect]);
        }
      }
      instrumentObject["effects"] = effects;
      if (effectsIncludeTransition(this.effects)) {
        instrumentObject["transition"] = Config.transitions[this.transition].name;
        instrumentObject["clicklessTransition"] = this.clicklessTransition;
      }
      if (effectsIncludeChord(this.effects)) {
        instrumentObject["chord"] = this.getChord().name;
        instrumentObject["fastTwoNoteArp"] = this.fastTwoNoteArp;
        instrumentObject["arpeggioSpeed"] = this.arpeggioSpeed;
        instrumentObject["monoChordTone"] = this.monoChordTone;
      }
      if (effectsIncludePitchShift(this.effects)) {
        instrumentObject["pitchShiftSemitones"] = this.pitchShift;
      }
      if (effectsIncludeDetune(this.effects)) {
        instrumentObject["detuneCents"] = SynthMessenger.detuneToCents(this.detune);
      }
      if (effectsIncludeVibrato(this.effects)) {
        if (this.vibrato == -1) {
          this.vibrato = 5;
        }
        if (this.vibrato != 5) {
          instrumentObject["vibrato"] = Config.vibratos[this.vibrato].name;
        } else {
          instrumentObject["vibrato"] = "custom";
        }
        instrumentObject["vibratoDepth"] = this.vibratoDepth;
        instrumentObject["vibratoDelay"] = this.vibratoDelay;
        instrumentObject["vibratoSpeed"] = this.vibratoSpeed;
        instrumentObject["vibratoType"] = this.vibratoType;
      }
      if (effectsIncludeNoteFilter(this.effects)) {
        instrumentObject["noteFilterType"] = this.noteFilterType;
        instrumentObject["noteSimpleCut"] = this.noteFilterSimpleCut;
        instrumentObject["noteSimplePeak"] = this.noteFilterSimplePeak;
        instrumentObject["noteFilter"] = this.noteFilter.toJsonObject();
        for (let i = 0; i < Config.filterMorphCount; i++) {
          if (this.noteSubFilters[i] != null)
            instrumentObject["noteSubFilters" + i] = this.noteSubFilters[i].toJsonObject();
        }
      }
      if (effectsIncludeGranular(this.effects)) {
        instrumentObject["granular"] = this.granular;
        instrumentObject["grainSize"] = this.grainSize;
        instrumentObject["grainAmounts"] = this.grainAmounts;
        instrumentObject["grainRange"] = this.grainRange;
      }
      if (effectsIncludeRingModulation(this.effects)) {
        instrumentObject["ringMod"] = Math.round(100 * this.ringModulation / (Config.ringModRange - 1));
        instrumentObject["ringModHz"] = Math.round(100 * this.ringModulationHz / (Config.ringModHzRange - 1));
        instrumentObject["ringModWaveformIndex"] = this.ringModWaveformIndex;
        instrumentObject["ringModPulseWidth"] = Math.round(100 * this.ringModPulseWidth / (Config.pulseWidthRange - 1));
        instrumentObject["ringModHzOffset"] = Math.round(100 * this.ringModHzOffset / Config.rmHzOffsetMax);
      }
      if (effectsIncludeDistortion(this.effects)) {
        instrumentObject["distortion"] = Math.round(100 * this.distortion / (Config.distortionRange - 1));
        instrumentObject["aliases"] = this.aliases;
      }
      if (effectsIncludeBitcrusher(this.effects)) {
        instrumentObject["bitcrusherOctave"] = (Config.bitcrusherFreqRange - 1 - this.bitcrusherFreq) * Config.bitcrusherOctaveStep;
        instrumentObject["bitcrusherQuantization"] = Math.round(100 * this.bitcrusherQuantization / (Config.bitcrusherQuantizationRange - 1));
      }
      if (effectsIncludePanning(this.effects)) {
        instrumentObject["pan"] = Math.round(100 * (this.pan - Config.panCenter) / Config.panCenter);
        instrumentObject["panDelay"] = this.panDelay;
      }
      if (effectsIncludeChorus(this.effects)) {
        instrumentObject["chorus"] = Math.round(100 * this.chorus / (Config.chorusRange - 1));
      }
      if (effectsIncludeEcho(this.effects)) {
        instrumentObject["echoSustain"] = Math.round(100 * this.echoSustain / (Config.echoSustainRange - 1));
        instrumentObject["echoDelayBeats"] = Math.round(1e3 * (this.echoDelay + 1) * Config.echoDelayStepTicks / (Config.ticksPerPart * Config.partsPerBeat)) / 1e3;
      }
      if (effectsIncludeReverb(this.effects)) {
        instrumentObject["reverb"] = Math.round(100 * this.reverb / (Config.reverbRange - 1));
      }
      if (effectsIncludePlugin(this.effects)) {
        instrumentObject["plugin"] = this.pluginValues.slice(0, PluginConfig.pluginUIElements.length);
      }
      if (this.type != 4 /* drumset */) {
        instrumentObject["fadeInSeconds"] = Math.round(1e4 * SynthMessenger.fadeInSettingToSeconds(this.fadeIn)) / 1e4;
        instrumentObject["fadeOutTicks"] = SynthMessenger.fadeOutSettingToTicks(this.fadeOut);
      }
      if (this.type == 5 /* harmonics */ || this.type == 7 /* pickedString */) {
        instrumentObject["harmonics"] = [];
        for (let i = 0; i < Config.harmonicsControlPoints; i++) {
          instrumentObject["harmonics"][i] = Math.round(100 * this.harmonicsWave.harmonics[i] / Config.harmonicsMax);
        }
      }
      if (this.type == 2 /* noise */) {
        instrumentObject["wave"] = Config.chipNoises[this.chipNoise].name;
        instrumentObject["unison"] = this.unison == Config.unisons.length ? "custom" : Config.unisons[this.unison].name;
        if (this.unison == Config.unisons.length) {
          instrumentObject["unisonVoices"] = this.unisonVoices;
          instrumentObject["unisonSpread"] = this.unisonSpread;
          instrumentObject["unisonOffset"] = this.unisonOffset;
          instrumentObject["unisonExpression"] = this.unisonExpression;
          instrumentObject["unisonSign"] = this.unisonSign;
        }
      } else if (this.type == 3 /* spectrum */) {
        instrumentObject["spectrum"] = [];
        for (let i = 0; i < Config.spectrumControlPoints; i++) {
          instrumentObject["spectrum"][i] = Math.round(100 * this.spectrumWave.spectrum[i] / Config.spectrumMax);
        }
        instrumentObject["unison"] = this.unison == Config.unisons.length ? "custom" : Config.unisons[this.unison].name;
        if (this.unison == Config.unisons.length) {
          instrumentObject["unisonVoices"] = this.unisonVoices;
          instrumentObject["unisonSpread"] = this.unisonSpread;
          instrumentObject["unisonOffset"] = this.unisonOffset;
          instrumentObject["unisonExpression"] = this.unisonExpression;
          instrumentObject["unisonSign"] = this.unisonSign;
        }
      } else if (this.type == 4 /* drumset */) {
        instrumentObject["drums"] = [];
        instrumentObject["unison"] = this.unison == Config.unisons.length ? "custom" : Config.unisons[this.unison].name;
        if (this.unison == Config.unisons.length) {
          instrumentObject["unisonVoices"] = this.unisonVoices;
          instrumentObject["unisonSpread"] = this.unisonSpread;
          instrumentObject["unisonOffset"] = this.unisonOffset;
          instrumentObject["unisonExpression"] = this.unisonExpression;
          instrumentObject["unisonSign"] = this.unisonSign;
        }
        for (let j = 0; j < Config.drumCount; j++) {
          const spectrum = [];
          for (let i = 0; i < Config.spectrumControlPoints; i++) {
            spectrum[i] = Math.round(100 * this.drumsetSpectrumWaves[j].spectrum[i] / Config.spectrumMax);
          }
          instrumentObject["drums"][j] = {
            "filterEnvelope": this.getDrumsetEnvelope(j).name,
            "spectrum": spectrum
          };
        }
      } else if (this.type == 0 /* chip */) {
        instrumentObject["wave"] = Config.chipWaves[this.chipWave].name;
        instrumentObject["unison"] = this.unison == Config.unisons.length ? "custom" : Config.unisons[this.unison].name;
        if (this.unison == Config.unisons.length) {
          instrumentObject["unisonVoices"] = this.unisonVoices;
          instrumentObject["unisonSpread"] = this.unisonSpread;
          instrumentObject["unisonOffset"] = this.unisonOffset;
          instrumentObject["unisonExpression"] = this.unisonExpression;
          instrumentObject["unisonSign"] = this.unisonSign;
        }
        instrumentObject["isUsingAdvancedLoopControls"] = this.isUsingAdvancedLoopControls;
        instrumentObject["chipWaveLoopStart"] = this.chipWaveLoopStart;
        instrumentObject["chipWaveLoopEnd"] = this.chipWaveLoopEnd;
        instrumentObject["chipWaveLoopMode"] = this.chipWaveLoopMode;
        instrumentObject["chipWavePlayBackwards"] = this.chipWavePlayBackwards;
        instrumentObject["chipWaveStartOffset"] = this.chipWaveStartOffset;
      } else if (this.type == 6 /* pwm */) {
        instrumentObject["pulseWidth"] = this.pulseWidth;
        instrumentObject["decimalOffset"] = this.decimalOffset;
        instrumentObject["unison"] = this.unison == Config.unisons.length ? "custom" : Config.unisons[this.unison].name;
        if (this.unison == Config.unisons.length) {
          instrumentObject["unisonVoices"] = this.unisonVoices;
          instrumentObject["unisonSpread"] = this.unisonSpread;
          instrumentObject["unisonOffset"] = this.unisonOffset;
          instrumentObject["unisonExpression"] = this.unisonExpression;
          instrumentObject["unisonSign"] = this.unisonSign;
        }
      } else if (this.type == 8 /* supersaw */) {
        instrumentObject["pulseWidth"] = this.pulseWidth;
        instrumentObject["decimalOffset"] = this.decimalOffset;
        instrumentObject["dynamism"] = Math.round(100 * this.supersawDynamism / Config.supersawDynamismMax);
        instrumentObject["spread"] = Math.round(100 * this.supersawSpread / Config.supersawSpreadMax);
        instrumentObject["shape"] = Math.round(100 * this.supersawShape / Config.supersawShapeMax);
      } else if (this.type == 7 /* pickedString */) {
        instrumentObject["unison"] = this.unison == Config.unisons.length ? "custom" : Config.unisons[this.unison].name;
        if (this.unison == Config.unisons.length) {
          instrumentObject["unisonVoices"] = this.unisonVoices;
          instrumentObject["unisonSpread"] = this.unisonSpread;
          instrumentObject["unisonOffset"] = this.unisonOffset;
          instrumentObject["unisonExpression"] = this.unisonExpression;
          instrumentObject["unisonSign"] = this.unisonSign;
        }
        instrumentObject["stringSustain"] = Math.round(100 * this.stringSustain / (Config.stringSustainRange - 1));
        if (Config.enableAcousticSustain) {
          instrumentObject["stringSustainType"] = Config.sustainTypeNames[this.stringSustainType];
        }
      } else if (this.type == 5 /* harmonics */) {
        instrumentObject["unison"] = this.unison == Config.unisons.length ? "custom" : Config.unisons[this.unison].name;
        if (this.unison == Config.unisons.length) {
          instrumentObject["unisonVoices"] = this.unisonVoices;
          instrumentObject["unisonSpread"] = this.unisonSpread;
          instrumentObject["unisonOffset"] = this.unisonOffset;
          instrumentObject["unisonExpression"] = this.unisonExpression;
          instrumentObject["unisonSign"] = this.unisonSign;
        }
      } else if (this.type == 1 /* fm */) {
        const operatorArray = [];
        for (let i = 0; i < Config.operatorCount; i++) {
          const operator = this.operators[i];
          operatorArray.push({
            "frequency": Config.operatorFrequencies[operator.frequency].name,
            "amplitude": operator.amplitude,
            "waveform": Config.operatorWaves[operator.waveform].name,
            "pulseWidth": operator.pulseWidth
          });
        }
        instrumentObject["algorithm"] = Config.algorithms[this.algorithm].name;
        instrumentObject["feedbackType"] = Config.feedbacks[this.feedbackType].name;
        instrumentObject["feedbackAmplitude"] = this.feedbackAmplitude;
        instrumentObject["operators"] = operatorArray;
      } else if (this.type == 11 /* fm6op */) {
        const operatorArray = [];
        for (const operator of this.operators) {
          operatorArray.push({
            "frequency": Config.operatorFrequencies[operator.frequency].name,
            "amplitude": operator.amplitude,
            "waveform": Config.operatorWaves[operator.waveform].name,
            "pulseWidth": operator.pulseWidth
          });
        }
        instrumentObject["algorithm"] = Config.algorithms6Op[this.algorithm6Op].name;
        instrumentObject["feedbackType"] = Config.feedbacks6Op[this.feedbackType6Op].name;
        instrumentObject["feedbackAmplitude"] = this.feedbackAmplitude;
        if (this.algorithm6Op == 0) {
          const customAlgorithm = {};
          customAlgorithm["mods"] = this.customAlgorithm.modulatedBy;
          customAlgorithm["carrierCount"] = this.customAlgorithm.carrierCount;
          instrumentObject["customAlgorithm"] = customAlgorithm;
        }
        if (this.feedbackType6Op == 0) {
          const customFeedback = {};
          customFeedback["mods"] = this.customFeedbackType.indices;
          instrumentObject["customFeedback"] = customFeedback;
        }
        instrumentObject["operators"] = operatorArray;
      } else if (this.type == 9 /* customChipWave */) {
        instrumentObject["wave"] = Config.chipWaves[this.chipWave].name;
        instrumentObject["unison"] = this.unison == Config.unisons.length ? "custom" : Config.unisons[this.unison].name;
        if (this.unison == Config.unisons.length) {
          instrumentObject["unisonVoices"] = this.unisonVoices;
          instrumentObject["unisonSpread"] = this.unisonSpread;
          instrumentObject["unisonOffset"] = this.unisonOffset;
          instrumentObject["unisonExpression"] = this.unisonExpression;
          instrumentObject["unisonSign"] = this.unisonSign;
        }
        instrumentObject["customChipWave"] = new Float64Array(64);
        instrumentObject["customChipWaveIntegral"] = new Float64Array(65);
        for (let i = 0; i < this.customChipWave.length; i++) {
          instrumentObject["customChipWave"][i] = this.customChipWave[i];
        }
      } else if (this.type == 10 /* mod */) {
        instrumentObject["modChannels"] = [];
        instrumentObject["modInstruments"] = [];
        instrumentObject["modSettings"] = [];
        instrumentObject["modFilterTypes"] = [];
        instrumentObject["modEnvelopeNumbers"] = [];
        for (let mod = 0; mod < Config.modCount; mod++) {
          instrumentObject["modChannels"][mod] = this.modChannels[mod];
          instrumentObject["modInstruments"][mod] = this.modInstruments[mod];
          instrumentObject["modSettings"][mod] = this.modulators[mod];
          instrumentObject["modFilterTypes"][mod] = this.modFilterTypes[mod];
          instrumentObject["modEnvelopeNumbers"][mod] = this.modEnvelopeNumbers[mod];
        }
      } else {
        throw new Error("Unrecognized instrument type");
      }
      const envelopes = [];
      for (let i = 0; i < this.envelopeCount; i++) {
        envelopes.push(this.envelopes[i].toJsonObject());
      }
      instrumentObject["envelopes"] = envelopes;
      return instrumentObject;
    }
    fromJsonObject(instrumentObject, isNoiseChannel, isModChannel, useSlowerRhythm, useFastTwoNoteArp, legacyGlobalReverb = 0, jsonFormat = Config.jsonFormat) {
      if (instrumentObject == void 0) instrumentObject = {};
      const format = jsonFormat.toLowerCase();
      let type = Config.instrumentTypeNames.indexOf(instrumentObject["type"]);
      if (format == "synthbox" && instrumentObject["type"] == "FM") type = Config.instrumentTypeNames.indexOf("FM6op");
      if (type == -1) type = isModChannel ? 10 /* mod */ : isNoiseChannel ? 2 /* noise */ : 0 /* chip */;
      this.setTypeAndReset(type, isNoiseChannel, isModChannel);
      this.effects &= ~(1 << 2 /* panning */);
      if (instrumentObject["preset"] != void 0) {
        this.preset = instrumentObject["preset"] >>> 0;
      }
      if (instrumentObject["volume"] != void 0) {
        if (format == "jummbox" || format == "midbox" || format == "synthbox" || format == "goldbox" || format == "paandorasbox" || format == "ultrabox" || format == "slarmoosbox") {
          this.volume = clamp(-Config.volumeRange / 2, Config.volumeRange / 2 + 1, instrumentObject["volume"] | 0);
        } else {
          this.volume = Math.round(-clamp(0, 8, Math.round(5 - (instrumentObject["volume"] | 0) / 20)) * 25 / 7);
        }
      } else {
        this.volume = 0;
      }
      this.envelopeSpeed = instrumentObject["envelopeSpeed"] != void 0 ? clamp(0, Config.modulators.dictionary["envelope speed"].maxRawVol + 1, instrumentObject["envelopeSpeed"] | 0) : 12;
      if (Array.isArray(instrumentObject["effects"])) {
        let effects = 0;
        for (let i = 0; i < instrumentObject["effects"].length; i++) {
          effects = effects | 1 << Config.effectNames.indexOf(instrumentObject["effects"][i]);
        }
        this.effects = effects & (1 << 16 /* length */) - 1;
      } else {
        const legacyEffectsNames = ["none", "reverb", "chorus", "chorus & reverb"];
        this.effects = legacyEffectsNames.indexOf(instrumentObject["effects"]);
        if (this.effects == -1) this.effects = this.type == 2 /* noise */ ? 0 : 1;
      }
      this.transition = Config.transitions.dictionary["normal"].index;
      const transitionProperty = instrumentObject["transition"] || instrumentObject["envelope"];
      if (transitionProperty != void 0) {
        let transition = Config.transitions.dictionary[transitionProperty];
        if (instrumentObject["fadeInSeconds"] == void 0 || instrumentObject["fadeOutTicks"] == void 0) {
          const legacySettings = {
            "binary": { transition: "interrupt", fadeInSeconds: 0, fadeOutTicks: -1 },
            "seamless": { transition: "interrupt", fadeInSeconds: 0, fadeOutTicks: -1 },
            "sudden": { transition: "normal", fadeInSeconds: 0, fadeOutTicks: -3 },
            "hard": { transition: "normal", fadeInSeconds: 0, fadeOutTicks: -3 },
            "smooth": { transition: "normal", fadeInSeconds: 0.025, fadeOutTicks: -3 },
            "soft": { transition: "normal", fadeInSeconds: 0.025, fadeOutTicks: -3 },
            // Note that the old slide transition has the same name as a new slide transition that is different.
            // Only apply legacy settings if the instrument JSON was created before, based on the presence
            // of the fade in/out fields.
            "slide": { transition: "slide in pattern", fadeInSeconds: 0.025, fadeOutTicks: -3 },
            "cross fade": { transition: "normal", fadeInSeconds: 0.04, fadeOutTicks: 6 },
            "hard fade": { transition: "normal", fadeInSeconds: 0, fadeOutTicks: 48 },
            "medium fade": { transition: "normal", fadeInSeconds: 0.0125, fadeOutTicks: 72 },
            "soft fade": { transition: "normal", fadeInSeconds: 0.06, fadeOutTicks: 96 }
          }[transitionProperty];
          if (legacySettings != void 0) {
            transition = Config.transitions.dictionary[legacySettings.transition];
            this.fadeIn = SynthMessenger.secondsToFadeInSetting(legacySettings.fadeInSeconds);
            this.fadeOut = SynthMessenger.ticksToFadeOutSetting(legacySettings.fadeOutTicks);
          }
        }
        if (transition != void 0) this.transition = transition.index;
        if (this.transition != Config.transitions.dictionary["normal"].index) {
          this.effects = this.effects | 1 << 10 /* transition */;
        }
      }
      if (instrumentObject["fadeInSeconds"] != void 0) {
        this.fadeIn = SynthMessenger.secondsToFadeInSetting(+instrumentObject["fadeInSeconds"]);
      }
      if (instrumentObject["fadeOutTicks"] != void 0) {
        this.fadeOut = SynthMessenger.ticksToFadeOutSetting(+instrumentObject["fadeOutTicks"]);
      }
      {
        const chordProperty = instrumentObject["chord"];
        const legacyChordNames = { "harmony": "simultaneous" };
        const chord = Config.chords.dictionary[legacyChordNames[chordProperty]] || Config.chords.dictionary[chordProperty];
        if (chord != void 0) {
          this.chord = chord.index;
        } else {
          if (this.type == 2 /* noise */) {
            this.chord = Config.chords.dictionary["arpeggio"].index;
          } else if (this.type == 7 /* pickedString */) {
            this.chord = Config.chords.dictionary["strum"].index;
          } else if (this.type == 0 /* chip */) {
            this.chord = Config.chords.dictionary["arpeggio"].index;
          } else if (this.type == 1 /* fm */ || this.type == 11 /* fm6op */) {
            this.chord = Config.chords.dictionary["custom interval"].index;
          } else {
            this.chord = Config.chords.dictionary["simultaneous"].index;
          }
        }
      }
      this.unison = Config.unisons.dictionary["none"].index;
      const unisonProperty = instrumentObject["unison"] || instrumentObject["interval"] || instrumentObject["chorus"];
      if (unisonProperty != void 0) {
        const legacyChorusNames = { "union": "none", "fifths": "fifth", "octaves": "octave", "error": "voiced" };
        const unison = Config.unisons.dictionary[legacyChorusNames[unisonProperty]] || Config.unisons.dictionary[unisonProperty];
        if (unison != void 0) this.unison = unison.index;
        if (unisonProperty == "custom") this.unison = Config.unisons.length;
      }
      this.unisonVoices = instrumentObject["unisonVoices"] == void 0 ? Config.unisons[this.unison].voices : instrumentObject["unisonVoices"];
      this.unisonSpread = instrumentObject["unisonSpread"] == void 0 ? Config.unisons[this.unison].spread : instrumentObject["unisonSpread"];
      this.unisonOffset = instrumentObject["unisonOffset"] == void 0 ? Config.unisons[this.unison].offset : instrumentObject["unisonOffset"];
      this.unisonExpression = instrumentObject["unisonExpression"] == void 0 ? Config.unisons[this.unison].expression : instrumentObject["unisonExpression"];
      this.unisonSign = instrumentObject["unisonSign"] == void 0 ? Config.unisons[this.unison].sign : instrumentObject["unisonSign"];
      if (instrumentObject["chorus"] == "custom harmony") {
        this.unison = Config.unisons.dictionary["hum"].index;
        this.chord = Config.chords.dictionary["custom interval"].index;
      }
      if (this.chord != Config.chords.dictionary["simultaneous"].index && !Array.isArray(instrumentObject["effects"])) {
        this.effects = this.effects | 1 << 11 /* chord */;
      }
      if (instrumentObject["pitchShiftSemitones"] != void 0) {
        this.pitchShift = clamp(0, Config.pitchShiftRange, Math.round(+instrumentObject["pitchShiftSemitones"]));
      }
      if (instrumentObject["octoff"] != void 0) {
        let potentialPitchShift = instrumentObject["octoff"];
        this.effects = this.effects | 1 << 7 /* pitchShift */;
        if (potentialPitchShift == "+1 (octave)" || potentialPitchShift == "+2 (2 octaves)") {
          this.pitchShift = 24;
        } else if (potentialPitchShift == "+1/2 (fifth)" || potentialPitchShift == "+1 1/2 (octave and fifth)") {
          this.pitchShift = 18;
        } else if (potentialPitchShift == "-1 (octave)" || potentialPitchShift == "-2 (2 octaves") {
          this.pitchShift = 0;
        } else if (potentialPitchShift == "-1/2 (fifth)" || potentialPitchShift == "-1 1/2 (octave and fifth)") {
          this.pitchShift = 6;
        } else {
          this.pitchShift = 12;
        }
      }
      if (instrumentObject["detuneCents"] != void 0) {
        this.detune = clamp(Config.detuneMin, Config.detuneMax + 1, Math.round(SynthMessenger.centsToDetune(+instrumentObject["detuneCents"])));
      }
      this.vibrato = Config.vibratos.dictionary["none"].index;
      const vibratoProperty = instrumentObject["vibrato"] || instrumentObject["effect"];
      if (vibratoProperty != void 0) {
        const legacyVibratoNames = { "vibrato light": "light", "vibrato delayed": "delayed", "vibrato heavy": "heavy" };
        const vibrato = Config.vibratos.dictionary[legacyVibratoNames[unisonProperty]] || Config.vibratos.dictionary[vibratoProperty];
        if (vibrato != void 0)
          this.vibrato = vibrato.index;
        else if (vibratoProperty == "custom")
          this.vibrato = Config.vibratos.length;
        if (this.vibrato == Config.vibratos.length) {
          this.vibratoDepth = instrumentObject["vibratoDepth"];
          this.vibratoSpeed = instrumentObject["vibratoSpeed"];
          this.vibratoDelay = instrumentObject["vibratoDelay"];
          this.vibratoType = instrumentObject["vibratoType"];
        } else {
          this.vibratoDepth = Config.vibratos[this.vibrato].amplitude;
          this.vibratoDelay = Config.vibratos[this.vibrato].delayTicks / 2;
          this.vibratoSpeed = 10;
          this.vibratoType = Config.vibratos[this.vibrato].type;
        }
        if (vibrato != Config.vibratos.dictionary["none"]) {
          this.effects = this.effects | 1 << 9 /* vibrato */;
        }
      }
      if (instrumentObject["pan"] != void 0) {
        this.pan = clamp(0, Config.panMax + 1, Math.round(Config.panCenter + (instrumentObject["pan"] | 0) * Config.panCenter / 100));
      } else if (instrumentObject["ipan"] != void 0) {
        this.pan = clamp(0, Config.panMax + 1, Config.panCenter + instrumentObject["ipan"] * -50);
      } else {
        this.pan = Config.panCenter;
      }
      if (this.pan != Config.panCenter) {
        this.effects = this.effects | 1 << 2 /* panning */;
      }
      if (instrumentObject["panDelay"] != void 0) {
        this.panDelay = instrumentObject["panDelay"] | 0;
      } else {
        this.panDelay = 0;
      }
      if (instrumentObject["detune"] != void 0) {
        this.detune = clamp(Config.detuneMin, Config.detuneMax + 1, instrumentObject["detune"] | 0);
      } else if (instrumentObject["detuneCents"] == void 0) {
        this.detune = Config.detuneCenter;
      }
      if (instrumentObject["ringMod"] != void 0) {
        this.ringModulation = clamp(0, Config.ringModRange, Math.round((Config.ringModRange - 1) * (instrumentObject["ringMod"] | 0) / 100));
      }
      if (instrumentObject["ringModHz"] != void 0) {
        this.ringModulationHz = clamp(0, Config.ringModHzRange, Math.round((Config.ringModHzRange - 1) * (instrumentObject["ringModHz"] | 0) / 100));
      }
      if (instrumentObject["ringModWaveformIndex"] != void 0) {
        this.ringModWaveformIndex = clamp(0, Config.operatorWaves.length, instrumentObject["ringModWaveformIndex"]);
      }
      if (instrumentObject["ringModPulseWidth"] != void 0) {
        this.ringModPulseWidth = clamp(0, Config.pulseWidthRange, Math.round((Config.pulseWidthRange - 1) * (instrumentObject["ringModPulseWidth"] | 0) / 100));
      }
      if (instrumentObject["ringModHzOffset"] != void 0) {
        this.ringModHzOffset = clamp(0, Config.rmHzOffsetMax, Math.round((Config.rmHzOffsetMax - 1) * (instrumentObject["ringModHzOffset"] | 0) / 100));
      }
      if (instrumentObject["granular"] != void 0) {
        this.granular = instrumentObject["granular"];
      }
      if (instrumentObject["grainSize"] != void 0) {
        this.grainSize = instrumentObject["grainSize"];
      }
      if (instrumentObject["grainAmounts"] != void 0) {
        this.grainAmounts = instrumentObject["grainAmounts"];
      }
      if (instrumentObject["grainRange"] != void 0) {
        this.grainRange = clamp(0, Config.grainRangeMax / Config.grainSizeStep + 1, instrumentObject["grainRange"]);
      }
      if (instrumentObject["distortion"] != void 0) {
        this.distortion = clamp(0, Config.distortionRange, Math.round((Config.distortionRange - 1) * (instrumentObject["distortion"] | 0) / 100));
      }
      if (instrumentObject["bitcrusherOctave"] != void 0) {
        this.bitcrusherFreq = Config.bitcrusherFreqRange - 1 - +instrumentObject["bitcrusherOctave"] / Config.bitcrusherOctaveStep;
      }
      if (instrumentObject["bitcrusherQuantization"] != void 0) {
        this.bitcrusherQuantization = clamp(0, Config.bitcrusherQuantizationRange, Math.round((Config.bitcrusherQuantizationRange - 1) * (instrumentObject["bitcrusherQuantization"] | 0) / 100));
      }
      if (instrumentObject["echoSustain"] != void 0) {
        this.echoSustain = clamp(0, Config.echoSustainRange, Math.round((Config.echoSustainRange - 1) * (instrumentObject["echoSustain"] | 0) / 100));
      }
      if (instrumentObject["echoDelayBeats"] != void 0) {
        this.echoDelay = clamp(0, Config.echoDelayRange, Math.round(+instrumentObject["echoDelayBeats"] * (Config.ticksPerPart * Config.partsPerBeat) / Config.echoDelayStepTicks - 1));
      }
      if (!isNaN(instrumentObject["chorus"])) {
        this.chorus = clamp(0, Config.chorusRange, Math.round((Config.chorusRange - 1) * (instrumentObject["chorus"] | 0) / 100));
      }
      if (instrumentObject["reverb"] != void 0) {
        this.reverb = clamp(0, Config.reverbRange, Math.round((Config.reverbRange - 1) * (instrumentObject["reverb"] | 0) / 100));
      } else {
        this.reverb = legacyGlobalReverb;
      }
      if (Array.isArray(instrumentObject["plugin"])) {
        this.pluginValues = instrumentObject["plugin"];
      }
      if (instrumentObject["pulseWidth"] != void 0) {
        this.pulseWidth = clamp(1, Config.pulseWidthRange + 1, Math.round(instrumentObject["pulseWidth"]));
      } else {
        this.pulseWidth = Config.pulseWidthRange;
      }
      if (instrumentObject["decimalOffset"] != void 0) {
        this.decimalOffset = clamp(0, 99 + 1, Math.round(instrumentObject["decimalOffset"]));
      } else {
        this.decimalOffset = 0;
      }
      if (instrumentObject["dynamism"] != void 0) {
        this.supersawDynamism = clamp(0, Config.supersawDynamismMax + 1, Math.round(Config.supersawDynamismMax * (instrumentObject["dynamism"] | 0) / 100));
      } else {
        this.supersawDynamism = Config.supersawDynamismMax;
      }
      if (instrumentObject["spread"] != void 0) {
        this.supersawSpread = clamp(0, Config.supersawSpreadMax + 1, Math.round(Config.supersawSpreadMax * (instrumentObject["spread"] | 0) / 100));
      } else {
        this.supersawSpread = Math.ceil(Config.supersawSpreadMax / 2);
      }
      if (instrumentObject["shape"] != void 0) {
        this.supersawShape = clamp(0, Config.supersawShapeMax + 1, Math.round(Config.supersawShapeMax * (instrumentObject["shape"] | 0) / 100));
      } else {
        this.supersawShape = 0;
      }
      if (instrumentObject["harmonics"] != void 0) {
        for (let i = 0; i < Config.harmonicsControlPoints; i++) {
          this.harmonicsWave.harmonics[i] = Math.max(0, Math.min(Config.harmonicsMax, Math.round(Config.harmonicsMax * +instrumentObject["harmonics"][i] / 100)));
        }
        this.harmonicsWave.markCustomWaveDirty();
      } else {
        this.harmonicsWave.reset();
      }
      if (instrumentObject["spectrum"] != void 0) {
        for (let i = 0; i < Config.spectrumControlPoints; i++) {
          this.spectrumWave.spectrum[i] = Math.max(0, Math.min(Config.spectrumMax, Math.round(Config.spectrumMax * +instrumentObject["spectrum"][i] / 100)));
          this.spectrumWave.markCustomWaveDirty();
        }
      } else {
        this.spectrumWave.reset(isNoiseChannel);
      }
      if (instrumentObject["stringSustain"] != void 0) {
        this.stringSustain = clamp(0, Config.stringSustainRange, Math.round((Config.stringSustainRange - 1) * (instrumentObject["stringSustain"] | 0) / 100));
      } else {
        this.stringSustain = 10;
      }
      this.stringSustainType = Config.enableAcousticSustain ? Config.sustainTypeNames.indexOf(instrumentObject["stringSustainType"]) : 0 /* bright */;
      if (this.stringSustainType == -1) this.stringSustainType = 0 /* bright */;
      if (this.type == 2 /* noise */) {
        this.chipNoise = Config.chipNoises.findIndex((wave) => wave.name == instrumentObject["wave"]);
        if (instrumentObject["wave"] == "pink noise") this.chipNoise = Config.chipNoises.findIndex((wave) => wave.name == "pink");
        if (instrumentObject["wave"] == "brownian noise") this.chipNoise = Config.chipNoises.findIndex((wave) => wave.name == "brownian");
        if (this.chipNoise == -1) this.chipNoise = 1;
      }
      const legacyEnvelopeNames = { "custom": "note size", "steady": "none", "pluck 1": "twang 1", "pluck 2": "twang 2", "pluck 3": "twang 3" };
      const getEnvelope = /* @__PURE__ */ __name((name) => {
        if (legacyEnvelopeNames[name] != void 0) return Config.envelopePresets.dictionary[legacyEnvelopeNames[name]];
        else {
          return Config.envelopePresets.dictionary[name];
        }
      }, "getEnvelope");
      if (this.type == 4 /* drumset */) {
        if (instrumentObject["drums"] != void 0) {
          for (let j = 0; j < Config.drumCount; j++) {
            const drum = instrumentObject["drums"][j];
            if (drum == void 0) continue;
            this.drumsetEnvelopes[j] = Config.envelopePresets.dictionary["twang 2"].index;
            if (drum["filterEnvelope"] != void 0) {
              const envelope = getEnvelope(drum["filterEnvelope"]);
              if (envelope != void 0) this.drumsetEnvelopes[j] = envelope.index;
            }
            if (drum["spectrum"] != void 0) {
              for (let i = 0; i < Config.spectrumControlPoints; i++) {
                this.drumsetSpectrumWaves[j].spectrum[i] = Math.max(0, Math.min(Config.spectrumMax, Math.round(Config.spectrumMax * +drum["spectrum"][i] / 100)));
              }
            }
            this.drumsetSpectrumWaves[j].markCustomWaveDirty();
          }
        }
      }
      if (this.type == 0 /* chip */) {
        const legacyWaveNames = { "triangle": 1, "square": 2, "pulse wide": 3, "pulse narrow": 4, "sawtooth": 5, "double saw": 6, "double pulse": 7, "spiky": 8, "plateau": 0 };
        const modboxWaveNames = { "10% pulse": 22, "sunsoft bass": 23, "loud pulse": 24, "sax": 25, "guitar": 26, "atari bass": 28, "atari pulse": 29, "1% pulse": 30, "curved sawtooth": 31, "viola": 32, "brass": 33, "acoustic bass": 34, "lyre": 35, "ramp pulse": 36, "piccolo": 37, "squaretooth": 38, "flatline": 39, "pnryshk a (u5)": 40, "pnryshk b (riff)": 41 };
        const sandboxWaveNames = { "shrill lute": 42, "shrill bass": 44, "nes pulse": 45, "saw bass": 46, "euphonium": 47, "shrill pulse": 48, "r-sawtooth": 49, "recorder": 50, "narrow saw": 51, "deep square": 52, "ring pulse": 53, "double sine": 54, "contrabass": 55, "double bass": 56 };
        const zefboxWaveNames = { "semi-square": 63, "deep square": 64, "squaretal": 40, "saw wide": 65, "saw narrow ": 66, "deep sawtooth": 67, "sawtal": 68, "pulse": 69, "triple pulse": 70, "high pulse": 71, "deep pulse": 72 };
        const miscWaveNames = { "test1": 56, "pokey 4bit lfsr": 57, "pokey 5step bass": 58, "isolated spiky": 59, "unnamed 1": 60, "unnamed 2": 61, "guitar string": 75, "intense": 76, "buzz wave": 77, "pokey square": 57, "pokey bass": 58, "banana wave": 83, "test 1": 84, "test 2": 84, "real snare": 85, "earthbound o. guitar": 86 };
        const paandorasboxWaveNames = { "kick": 87, "snare": 88, "piano1": 89, "WOW": 90, "overdrive": 91, "trumpet": 92, "saxophone": 93, "orchestrahit": 94, "detached violin": 95, "synth": 96, "sonic3snare": 97, "come on": 98, "choir": 99, "overdriveguitar": 100, "flute": 101, "legato violin": 102, "tremolo violin": 103, "amen break": 104, "pizzicato violin": 105, "tim allen grunt": 106, "tuba": 107, "loopingcymbal": 108, "standardkick": 109, "standardsnare": 110, "closedhihat": 111, "foothihat": 112, "openhihat": 113, "crashcymbal": 114, "pianoC4": 115, "liver pad": 116, "marimba": 117, "susdotwav": 118, "wackyboxtts": 119 };
        this.chipWave = -1;
        const rawName = instrumentObject["wave"];
        for (const table of [
          legacyWaveNames,
          modboxWaveNames,
          sandboxWaveNames,
          zefboxWaveNames,
          miscWaveNames,
          paandorasboxWaveNames
        ]) {
          if (this.chipWave == -1 && table[rawName] != void 0 && Config.chipWaves[table[rawName]] != void 0) {
            this.chipWave = table[rawName];
            break;
          }
        }
        if (this.chipWave == -1) {
          const potentialChipWaveIndex = Config.chipWaves.findIndex((wave) => wave.name == rawName);
          if (potentialChipWaveIndex != -1) this.chipWave = potentialChipWaveIndex;
        }
        if (this.chipWave == -1) this.chipWave = 1;
      }
      if (this.type == 1 /* fm */ || this.type == 11 /* fm6op */) {
        if (this.type == 1 /* fm */) {
          this.algorithm = Config.algorithms.findIndex((algorithm) => algorithm.name == instrumentObject["algorithm"]);
          if (this.algorithm == -1) this.algorithm = 0;
          this.feedbackType = Config.feedbacks.findIndex((feedback) => feedback.name == instrumentObject["feedbackType"]);
          if (this.feedbackType == -1) this.feedbackType = 0;
        } else {
          this.algorithm6Op = Config.algorithms6Op.findIndex((algorithm6Op) => algorithm6Op.name == instrumentObject["algorithm"]);
          if (this.algorithm6Op == -1) this.algorithm6Op = 1;
          if (this.algorithm6Op == 0) {
            this.customAlgorithm.set(instrumentObject["customAlgorithm"]["carrierCount"], instrumentObject["customAlgorithm"]["mods"]);
          } else {
            this.customAlgorithm.fromPreset(this.algorithm6Op);
          }
          this.feedbackType6Op = Config.feedbacks6Op.findIndex((feedback6Op) => feedback6Op.name == instrumentObject["feedbackType"]);
          if (this.feedbackType6Op == -1) {
            let synthboxLegacyFeedbacks = toNameMap([
              { name: "2\u27F2 3\u27F2", indices: [[], [2], [3], [], [], []] },
              { name: "3\u27F2 4\u27F2", indices: [[], [], [3], [4], [], []] },
              { name: "4\u27F2 5\u27F2", indices: [[], [], [], [4], [5], []] },
              { name: "5\u27F2 6\u27F2", indices: [[], [], [], [], [5], [6]] },
              { name: "1\u27F2 6\u27F2", indices: [[1], [], [], [], [], [6]] },
              { name: "1\u27F2 3\u27F2", indices: [[1], [], [3], [], [], []] },
              { name: "1\u27F2 4\u27F2", indices: [[1], [], [], [4], [], []] },
              { name: "1\u27F2 5\u27F2", indices: [[1], [], [], [], [5], []] },
              { name: "4\u27F2 6\u27F2", indices: [[], [], [], [4], [], [6]] },
              { name: "2\u27F2 6\u27F2", indices: [[], [2], [], [], [], [6]] },
              { name: "3\u27F2 6\u27F2", indices: [[], [], [3], [], [], [6]] },
              { name: "4\u27F2 5\u27F2 6\u27F2", indices: [[], [], [], [4], [5], [6]] },
              { name: "1\u27F2 3\u27F2 6\u27F2", indices: [[1], [], [3], [], [], [6]] },
              { name: "2\u21925", indices: [[], [], [], [], [2], []] },
              { name: "2\u21926", indices: [[], [], [], [], [], [2]] },
              { name: "3\u21925", indices: [[], [], [], [], [3], []] },
              { name: "3\u21926", indices: [[], [], [], [], [], [3]] },
              { name: "4\u21926", indices: [[], [], [], [], [], [4]] },
              { name: "5\u21926", indices: [[], [], [], [], [], [5]] },
              { name: "1\u21923\u21924", indices: [[], [], [1], [], [3], []] },
              { name: "2\u21925\u21926", indices: [[], [], [], [], [2], [5]] },
              { name: "2\u21924\u21926", indices: [[], [], [], [2], [], [4]] },
              { name: "4\u21925\u21926", indices: [[], [], [], [], [4], [5]] },
              { name: "3\u21924\u21925\u21926", indices: [[], [], [], [3], [4], [5]] },
              { name: "2\u21923\u21924\u21925\u21926", indices: [[], [1], [2], [3], [4], [5]] },
              { name: "1\u21922\u21923\u21924\u21925\u21926", indices: [[], [1], [2], [3], [4], [5]] }
            ]);
            let synthboxFeedbackType = synthboxLegacyFeedbacks[synthboxLegacyFeedbacks.findIndex((feedback) => feedback.name == instrumentObject["feedbackType"])].indices;
            if (synthboxFeedbackType != void 0) {
              this.feedbackType6Op = 0;
              this.customFeedbackType.set(synthboxFeedbackType);
            } else {
              this.feedbackType6Op = 1;
            }
          }
          if (this.feedbackType6Op == 0 && instrumentObject["customFeedback"] != void 0) {
            this.customFeedbackType.set(instrumentObject["customFeedback"]["mods"]);
          } else {
            this.customFeedbackType.fromPreset(this.feedbackType6Op);
          }
        }
        if (instrumentObject["feedbackAmplitude"] != void 0) {
          this.feedbackAmplitude = clamp(0, Config.operatorAmplitudeMax + 1, instrumentObject["feedbackAmplitude"] | 0);
        } else {
          this.feedbackAmplitude = 0;
        }
        for (let j = 0; j < Config.operatorCount + (this.type == 11 /* fm6op */ ? 2 : 0); j++) {
          const operator = this.operators[j];
          let operatorObject = void 0;
          if (instrumentObject["operators"] != void 0) operatorObject = instrumentObject["operators"][j];
          if (operatorObject == void 0) operatorObject = {};
          operator.frequency = Config.operatorFrequencies.findIndex((freq) => freq.name == operatorObject["frequency"]);
          if (operator.frequency == -1) operator.frequency = 0;
          if (operatorObject["amplitude"] != void 0) {
            operator.amplitude = clamp(0, Config.operatorAmplitudeMax + 1, operatorObject["amplitude"] | 0);
          } else {
            operator.amplitude = 0;
          }
          if (operatorObject["waveform"] != void 0) {
            if (format == "goldbox" && j > 3) {
              operator.waveform = 0;
              continue;
            }
            operator.waveform = Config.operatorWaves.findIndex((wave) => wave.name == operatorObject["waveform"]);
            if (operator.waveform == -1) {
              if (operatorObject["waveform"] == "square") {
                operator.waveform = Config.operatorWaves.dictionary["pulse width"].index;
                operator.pulseWidth = 5;
              } else if (operatorObject["waveform"] == "rounded") {
                operator.waveform = Config.operatorWaves.dictionary["quasi-sine"].index;
              } else {
                operator.waveform = 0;
              }
            }
          } else {
            operator.waveform = 0;
          }
          if (operatorObject["pulseWidth"] != void 0) {
            operator.pulseWidth = operatorObject["pulseWidth"] | 0;
          } else {
            operator.pulseWidth = 5;
          }
        }
      } else if (this.type == 9 /* customChipWave */) {
        if (instrumentObject["customChipWave"]) {
          for (let i = 0; i < 64; i++) {
            this.customChipWave[i] = instrumentObject["customChipWave"][i];
          }
          let sum = 0;
          for (let i = 0; i < this.customChipWave.length; i++) {
            sum += this.customChipWave[i];
          }
          const average = sum / this.customChipWave.length;
          let cumulative = 0;
          let wavePrev = 0;
          for (let i = 0; i < this.customChipWave.length; i++) {
            cumulative += wavePrev;
            wavePrev = this.customChipWave[i] - average;
            this.customChipWaveIntegral[i] = cumulative;
          }
          this.customChipWaveIntegral[64] = 0;
        }
      } else if (this.type == 10 /* mod */) {
        if (instrumentObject["modChannels"] != void 0) {
          for (let mod = 0; mod < Config.modCount; mod++) {
            this.modChannels[mod] = instrumentObject["modChannels"][mod];
            this.modInstruments[mod] = instrumentObject["modInstruments"][mod];
            this.modulators[mod] = instrumentObject["modSettings"][mod];
            if (instrumentObject["modFilterTypes"] != void 0)
              this.modFilterTypes[mod] = instrumentObject["modFilterTypes"][mod];
            if (instrumentObject["modEnvelopeNumbers"] != void 0)
              this.modEnvelopeNumbers[mod] = instrumentObject["modEnvelopeNumbers"][mod];
          }
        }
      }
      if (this.type != 10 /* mod */) {
        if (this.chord == Config.chords.dictionary["arpeggio"].index && instrumentObject["arpeggioSpeed"] != void 0) {
          this.arpeggioSpeed = instrumentObject["arpeggioSpeed"];
        } else {
          this.arpeggioSpeed = useSlowerRhythm ? 9 : 12;
        }
        if (this.chord == Config.chords.dictionary["monophonic"].index && instrumentObject["monoChordTone"] != void 0) {
          this.monoChordTone = instrumentObject["monoChordTone"];
        }
        if (instrumentObject["fastTwoNoteArp"] != void 0) {
          this.fastTwoNoteArp = instrumentObject["fastTwoNoteArp"];
        } else {
          this.fastTwoNoteArp = useFastTwoNoteArp;
        }
        if (instrumentObject["clicklessTransition"] != void 0) {
          this.clicklessTransition = instrumentObject["clicklessTransition"];
        } else {
          this.clicklessTransition = false;
        }
        if (instrumentObject["aliases"] != void 0) {
          this.aliases = instrumentObject["aliases"];
        } else {
          if (format == "modbox") {
            this.effects = this.effects | 1 << 3 /* distortion */;
            this.aliases = true;
            this.distortion = 0;
          } else {
            this.aliases = false;
          }
        }
        if (instrumentObject["noteFilterType"] != void 0) {
          this.noteFilterType = instrumentObject["noteFilterType"];
        }
        if (instrumentObject["noteSimpleCut"] != void 0) {
          this.noteFilterSimpleCut = instrumentObject["noteSimpleCut"];
        }
        if (instrumentObject["noteSimplePeak"] != void 0) {
          this.noteFilterSimplePeak = instrumentObject["noteSimplePeak"];
        }
        if (instrumentObject["noteFilter"] != void 0) {
          this.noteFilter.fromJsonObject(instrumentObject["noteFilter"]);
        } else {
          this.noteFilter.reset();
        }
        for (let i = 0; i < Config.filterMorphCount; i++) {
          if (Array.isArray(instrumentObject["noteSubFilters" + i])) {
            this.noteSubFilters[i] = new FilterSettings();
            this.noteSubFilters[i].fromJsonObject(instrumentObject["noteSubFilters" + i]);
          }
        }
        if (instrumentObject["eqFilterType"] != void 0) {
          this.eqFilterType = instrumentObject["eqFilterType"];
        }
        if (instrumentObject["eqSimpleCut"] != void 0) {
          this.eqFilterSimpleCut = instrumentObject["eqSimpleCut"];
        }
        if (instrumentObject["eqSimplePeak"] != void 0) {
          this.eqFilterSimplePeak = instrumentObject["eqSimplePeak"];
        }
        if (Array.isArray(instrumentObject["eqFilter"])) {
          this.eqFilter.fromJsonObject(instrumentObject["eqFilter"]);
        } else {
          this.eqFilter.reset();
          const legacySettings = {};
          const filterCutoffMaxHz = 8e3;
          const filterCutoffRange = 11;
          const filterResonanceRange = 8;
          if (instrumentObject["filterCutoffHz"] != void 0) {
            legacySettings.filterCutoff = clamp(0, filterCutoffRange, Math.round(filterCutoffRange - 1 + 2 * Math.log((instrumentObject["filterCutoffHz"] | 0) / filterCutoffMaxHz) / Math.LN2));
          } else {
            legacySettings.filterCutoff = this.type == 0 /* chip */ ? 6 : 10;
          }
          if (instrumentObject["filterResonance"] != void 0) {
            legacySettings.filterResonance = clamp(0, filterResonanceRange, Math.round((filterResonanceRange - 1) * (instrumentObject["filterResonance"] | 0) / 100));
          } else {
            legacySettings.filterResonance = 0;
          }
          legacySettings.filterEnvelope = getEnvelope(instrumentObject["filterEnvelope"]);
          legacySettings.pulseEnvelope = getEnvelope(instrumentObject["pulseEnvelope"]);
          legacySettings.feedbackEnvelope = getEnvelope(instrumentObject["feedbackEnvelope"]);
          if (Array.isArray(instrumentObject["operators"])) {
            legacySettings.operatorEnvelopes = [];
            for (let j = 0; j < Config.operatorCount + (this.type == 11 /* fm6op */ ? 2 : 0); j++) {
              let envelope;
              if (instrumentObject["operators"][j] != void 0) {
                envelope = getEnvelope(instrumentObject["operators"][j]["envelope"]);
              }
              legacySettings.operatorEnvelopes[j] = envelope != void 0 ? envelope : Config.envelopePresets.dictionary["none"];
            }
          }
          if (instrumentObject["filter"] != void 0) {
            const legacyToCutoff = [10, 6, 3, 0, 8, 5, 2];
            const legacyToEnvelope = ["none", "none", "none", "none", "decay 1", "decay 2", "decay 3"];
            const filterNames = ["none", "bright", "medium", "soft", "decay bright", "decay medium", "decay soft"];
            const oldFilterNames = { "sustain sharp": 1, "sustain medium": 2, "sustain soft": 3, "decay sharp": 4 };
            let legacyFilter = oldFilterNames[instrumentObject["filter"]] != void 0 ? oldFilterNames[instrumentObject["filter"]] : filterNames.indexOf(instrumentObject["filter"]);
            if (legacyFilter == -1) legacyFilter = 0;
            legacySettings.filterCutoff = legacyToCutoff[legacyFilter];
            legacySettings.filterEnvelope = getEnvelope(legacyToEnvelope[legacyFilter]);
            legacySettings.filterResonance = 0;
          }
          this.convertLegacySettings(legacySettings, true);
        }
        for (let i = 0; i < Config.filterMorphCount; i++) {
          if (Array.isArray(instrumentObject["eqSubFilters" + i])) {
            this.eqSubFilters[i] = new FilterSettings();
            this.eqSubFilters[i].fromJsonObject(instrumentObject["eqSubFilters" + i]);
          }
        }
        if (Array.isArray(instrumentObject["envelopes"])) {
          const envelopeArray = instrumentObject["envelopes"];
          for (let i = 0; i < envelopeArray.length; i++) {
            if (this.envelopeCount >= Config.maxEnvelopeCount) break;
            const tempEnvelope = new EnvelopeSettings(this.isNoiseInstrument);
            tempEnvelope.fromJsonObject(envelopeArray[i], format);
            let pitchEnvelopeStart;
            if (instrumentObject["pitchEnvelopeStart"] != void 0 && instrumentObject["pitchEnvelopeStart"] != null) {
              pitchEnvelopeStart = instrumentObject["pitchEnvelopeStart"];
            } else if (instrumentObject["pitchEnvelopeStart" + i] != void 0 && instrumentObject["pitchEnvelopeStart" + i] != void 0) {
              pitchEnvelopeStart = instrumentObject["pitchEnvelopeStart" + i];
            } else {
              pitchEnvelopeStart = tempEnvelope.pitchEnvelopeStart;
            }
            let pitchEnvelopeEnd;
            if (instrumentObject["pitchEnvelopeEnd"] != void 0 && instrumentObject["pitchEnvelopeEnd"] != null) {
              pitchEnvelopeEnd = instrumentObject["pitchEnvelopeEnd"];
            } else if (instrumentObject["pitchEnvelopeEnd" + i] != void 0 && instrumentObject["pitchEnvelopeEnd" + i] != null) {
              pitchEnvelopeEnd = instrumentObject["pitchEnvelopeEnd" + i];
            } else {
              pitchEnvelopeEnd = tempEnvelope.pitchEnvelopeEnd;
            }
            let envelopeInverse;
            if (instrumentObject["envelopeInverse" + i] != void 0 && instrumentObject["envelopeInverse" + i] != null) {
              envelopeInverse = instrumentObject["envelopeInverse" + i];
            } else if (instrumentObject["pitchEnvelopeInverse"] != void 0 && instrumentObject["pitchEnvelopeInverse"] != null && Config.envelopePresets[tempEnvelope.envelope].name == "pitch") {
              envelopeInverse = instrumentObject["pitchEnvelopeInverse"];
            } else {
              envelopeInverse = tempEnvelope.inverse;
            }
            let discreteEnvelope;
            if (instrumentObject["discreteEnvelope"] != void 0) {
              discreteEnvelope = instrumentObject["discreteEnvelope"];
            } else {
              discreteEnvelope = tempEnvelope.discrete;
            }
            this.addEnvelope(tempEnvelope.target, tempEnvelope.index, tempEnvelope.envelope, true, pitchEnvelopeStart, pitchEnvelopeEnd, envelopeInverse, tempEnvelope.perEnvelopeSpeed, tempEnvelope.perEnvelopeLowerBound, tempEnvelope.perEnvelopeUpperBound, tempEnvelope.steps, tempEnvelope.seed, tempEnvelope.waveform, discreteEnvelope);
          }
        }
      }
      if (type === 0) {
        if (instrumentObject["isUsingAdvancedLoopControls"] != void 0) {
          this.isUsingAdvancedLoopControls = instrumentObject["isUsingAdvancedLoopControls"];
          this.chipWaveLoopStart = instrumentObject["chipWaveLoopStart"];
          this.chipWaveLoopEnd = instrumentObject["chipWaveLoopEnd"];
          this.chipWaveLoopMode = instrumentObject["chipWaveLoopMode"];
          this.chipWavePlayBackwards = instrumentObject["chipWavePlayBackwards"];
          this.chipWaveStartOffset = instrumentObject["chipWaveStartOffset"];
        } else {
          this.isUsingAdvancedLoopControls = false;
          this.chipWaveLoopStart = 0;
          this.chipWaveLoopEnd = Config.rawRawChipWaves[this.chipWave].samples.length - 1;
          this.chipWaveLoopMode = 0;
          this.chipWavePlayBackwards = false;
          this.chipWaveStartOffset = 0;
        }
      }
    }
    // advloop addition
    getLargestControlPointCount(forNoteFilter) {
      let largest;
      if (forNoteFilter) {
        largest = this.noteFilter.controlPointCount;
        for (let i = 0; i < Config.filterMorphCount; i++) {
          if (this.noteSubFilters[i] != null && this.noteSubFilters[i].controlPointCount > largest)
            largest = this.noteSubFilters[i].controlPointCount;
        }
      } else {
        largest = this.eqFilter.controlPointCount;
        for (let i = 0; i < Config.filterMorphCount; i++) {
          if (this.eqSubFilters[i] != null && this.eqSubFilters[i].controlPointCount > largest)
            largest = this.eqSubFilters[i].controlPointCount;
        }
      }
      return largest;
    }
    static frequencyFromPitch(pitch) {
      return 440 * Math.pow(2, (pitch - 69) / 12);
    }
    addEnvelope(target, index, envelope, newEnvelopes, start = 0, end = -1, inverse = false, perEnvelopeSpeed = -1, perEnvelopeLowerBound = 0, perEnvelopeUpperBound = 1, steps = 2, seed = 2, waveform = 0 /* sine */, discrete = false) {
      end = end != -1 ? end : this.isNoiseInstrument ? Config.drumCount - 1 : Config.maxPitch;
      perEnvelopeSpeed = perEnvelopeSpeed != -1 ? perEnvelopeSpeed : newEnvelopes ? 1 : Config.envelopePresets[envelope].speed;
      let makeEmpty = false;
      if (!this.supportsEnvelopeTarget(target, index)) makeEmpty = true;
      if (this.envelopeCount >= Config.maxEnvelopeCount) throw new Error();
      while (this.envelopes.length <= this.envelopeCount) this.envelopes[this.envelopes.length] = new EnvelopeSettings(this.isNoiseInstrument);
      const envelopeSettings = this.envelopes[this.envelopeCount];
      envelopeSettings.target = makeEmpty ? Config.instrumentAutomationTargets.dictionary["none"].index : target;
      envelopeSettings.index = makeEmpty ? 0 : index;
      if (!newEnvelopes) {
        envelopeSettings.envelope = clamp(0, Config.envelopes.length, Config.envelopePresets[envelope].type);
      } else {
        envelopeSettings.envelope = envelope;
      }
      envelopeSettings.pitchEnvelopeStart = start;
      envelopeSettings.pitchEnvelopeEnd = end;
      envelopeSettings.inverse = inverse;
      envelopeSettings.perEnvelopeSpeed = perEnvelopeSpeed;
      envelopeSettings.perEnvelopeLowerBound = perEnvelopeLowerBound;
      envelopeSettings.perEnvelopeUpperBound = perEnvelopeUpperBound;
      envelopeSettings.steps = steps;
      envelopeSettings.seed = seed;
      envelopeSettings.waveform = waveform;
      envelopeSettings.discrete = discrete;
      this.envelopeCount++;
    }
    supportsEnvelopeTarget(target, index) {
      const automationTarget = Config.instrumentAutomationTargets[target];
      if (automationTarget.computeIndex == null && automationTarget.name != "none") {
        return false;
      }
      if (index >= automationTarget.maxCount) {
        return false;
      }
      if (automationTarget.compatibleInstruments != null && automationTarget.compatibleInstruments.indexOf(this.type) == -1) {
        return false;
      }
      if (automationTarget.effect != null && (this.effects & 1 << automationTarget.effect) == 0) {
        return false;
      }
      if (automationTarget.name == "arpeggioSpeed") {
        return effectsIncludeChord(this.effects) && this.chord == Config.chords.dictionary["arpeggio"].index;
      }
      if (automationTarget.isFilter) {
        let useControlPointCount = this.noteFilter.controlPointCount;
        if (this.noteFilterType)
          useControlPointCount = 1;
        if (index >= useControlPointCount) return false;
      }
      if (automationTarget.name == "operatorFrequency" || automationTarget.name == "operatorAmplitude") {
        if (index >= 4 + (this.type == 11 /* fm6op */ ? 2 : 0)) return false;
      }
      return true;
    }
    clearInvalidEnvelopeTargets() {
      for (let envelopeIndex = 0; envelopeIndex < this.envelopeCount; envelopeIndex++) {
        const target = this.envelopes[envelopeIndex].target;
        const index = this.envelopes[envelopeIndex].index;
        if (!this.supportsEnvelopeTarget(target, index)) {
          this.envelopes[envelopeIndex].target = Config.instrumentAutomationTargets.dictionary["none"].index;
          this.envelopes[envelopeIndex].index = 0;
        }
      }
    }
    getTransition() {
      return effectsIncludeTransition(this.effects) ? Config.transitions[this.transition] : this.type == 10 /* mod */ ? Config.transitions.dictionary["interrupt"] : Config.transitions.dictionary["normal"];
    }
    getFadeInSeconds() {
      return this.type == 4 /* drumset */ ? 0 : SynthMessenger.fadeInSettingToSeconds(this.fadeIn);
    }
    getFadeOutTicks() {
      return this.type == 4 /* drumset */ ? Config.drumsetFadeOutTicks : SynthMessenger.fadeOutSettingToTicks(this.fadeOut);
    }
    getChord() {
      return effectsIncludeChord(this.effects) ? Config.chords[this.chord] : Config.chords.dictionary["simultaneous"];
    }
    getDrumsetEnvelope(pitch) {
      if (this.type != 4 /* drumset */) throw new Error("Can't getDrumsetEnvelope() for non-drumset.");
      return Config.envelopePresets[this.drumsetEnvelopes[pitch]];
    }
  };
  var Channel = class {
    constructor() {
      this.octave = 0;
      this.instruments = [];
      this.patterns = [];
      this.bars = [];
      this.muted = false;
      this.name = "";
    }
    static {
      __name(this, "Channel");
    }
  };
  var Song = class _Song {
    constructor(string) {
      this.scaleCustom = [];
      this.channels = [];
      this.limitDecay = 4;
      this.limitRise = 4e3;
      this.compressionThreshold = 1;
      this.limitThreshold = 1;
      this.compressionRatio = 1;
      this.limitRatio = 1;
      this.masterGain = 1;
      this.inVolumeCap = 0;
      this.outVolumeCap = 0;
      this.eqFilter = new FilterSettings();
      this.eqFilterType = false;
      this.eqFilterSimpleCut = Config.filterSimpleCutRange - 1;
      this.eqFilterSimplePeak = 0;
      this.eqSubFilters = [];
      this.pluginurl = null;
      // Returns the ideal new note volume when dragging (max volume for a normal note, a "neutral" value for mod notes based on how they work)
      this.getNewNoteVolume = /* @__PURE__ */ __name((isMod, modChannel, modInstrument, modCount) => {
        if (!isMod || modChannel == void 0 || modInstrument == void 0 || modCount == void 0)
          return Config.noteSizeMax;
        else {
          modCount = Config.modCount - modCount - 1;
          const instrument = this.channels[modChannel].instruments[modInstrument];
          let vol = Config.modulators[instrument.modulators[modCount]].newNoteVol;
          let currentIndex = instrument.modulators[modCount];
          let tempoIndex = Config.modulators.dictionary["tempo"].index;
          if (currentIndex == tempoIndex) vol = this.tempo - Config.modulators[tempoIndex].convertRealFactor;
          if (!Config.modulators[currentIndex].forSong && instrument.modInstruments[modCount] < this.channels[instrument.modChannels[modCount]].instruments.length) {
            let chorusIndex = Config.modulators.dictionary["chorus"].index;
            let reverbIndex = Config.modulators.dictionary["reverb"].index;
            let panningIndex = Config.modulators.dictionary["pan"].index;
            let panDelayIndex = Config.modulators.dictionary["pan delay"].index;
            let distortionIndex = Config.modulators.dictionary["distortion"].index;
            let detuneIndex = Config.modulators.dictionary["detune"].index;
            let vibratoDepthIndex = Config.modulators.dictionary["vibrato depth"].index;
            let vibratoSpeedIndex = Config.modulators.dictionary["vibrato speed"].index;
            let vibratoDelayIndex = Config.modulators.dictionary["vibrato delay"].index;
            let arpSpeedIndex = Config.modulators.dictionary["arp speed"].index;
            let bitCrushIndex = Config.modulators.dictionary["bit crush"].index;
            let freqCrushIndex = Config.modulators.dictionary["freq crush"].index;
            let echoIndex = Config.modulators.dictionary["echo"].index;
            let echoDelayIndex = Config.modulators.dictionary["echo delay"].index;
            let pitchShiftIndex = Config.modulators.dictionary["pitch shift"].index;
            let ringModIndex = Config.modulators.dictionary["ring modulation"].index;
            let ringModHertzIndex = Config.modulators.dictionary["ring mod hertz"].index;
            let granularIndex = Config.modulators.dictionary["granular"].index;
            let grainAmountIndex = Config.modulators.dictionary["grain freq"].index;
            let grainSizeIndex = Config.modulators.dictionary["grain size"].index;
            let grainRangeIndex = Config.modulators.dictionary["grain range"].index;
            let envSpeedIndex = Config.modulators.dictionary["envelope speed"].index;
            let perEnvSpeedIndex = Config.modulators.dictionary["individual envelope speed"].index;
            let perEnvLowerIndex = Config.modulators.dictionary["individual envelope lower bound"].index;
            let perEnvUpperIndex = Config.modulators.dictionary["individual envelope upper bound"].index;
            let instrumentIndex = instrument.modInstruments[modCount];
            switch (currentIndex) {
              case chorusIndex:
                vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].chorus - Config.modulators[chorusIndex].convertRealFactor;
                break;
              case reverbIndex:
                vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].reverb - Config.modulators[reverbIndex].convertRealFactor;
                break;
              case panningIndex:
                vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].pan - Config.modulators[panningIndex].convertRealFactor;
                break;
              case panDelayIndex:
                vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].panDelay - Config.modulators[panDelayIndex].convertRealFactor;
                break;
              case distortionIndex:
                vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].distortion - Config.modulators[distortionIndex].convertRealFactor;
                break;
              case detuneIndex:
                vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].detune;
                break;
              case vibratoDepthIndex:
                vol = Math.round(this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].vibratoDepth * 25 - Config.modulators[vibratoDepthIndex].convertRealFactor);
                break;
              case vibratoSpeedIndex:
                vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].vibratoSpeed - Config.modulators[vibratoSpeedIndex].convertRealFactor;
                break;
              case vibratoDelayIndex:
                vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].vibratoDelay - Config.modulators[vibratoDelayIndex].convertRealFactor;
                break;
              case arpSpeedIndex:
                vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].arpeggioSpeed - Config.modulators[arpSpeedIndex].convertRealFactor;
                break;
              case bitCrushIndex:
                vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].bitcrusherQuantization - Config.modulators[bitCrushIndex].convertRealFactor;
                break;
              case freqCrushIndex:
                vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].bitcrusherFreq - Config.modulators[freqCrushIndex].convertRealFactor;
                break;
              case echoIndex:
                vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].echoSustain - Config.modulators[echoIndex].convertRealFactor;
                break;
              case echoDelayIndex:
                vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].echoDelay - Config.modulators[echoDelayIndex].convertRealFactor;
                break;
              case pitchShiftIndex:
                vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].pitchShift;
                break;
              case ringModIndex:
                vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].ringModulation - Config.modulators[ringModIndex].convertRealFactor;
                break;
              case ringModHertzIndex:
                vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].ringModulationHz - Config.modulators[ringModHertzIndex].convertRealFactor;
                break;
              case granularIndex:
                vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].granular - Config.modulators[granularIndex].convertRealFactor;
                break;
              case grainAmountIndex:
                vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].grainAmounts - Config.modulators[grainAmountIndex].convertRealFactor;
                break;
              case grainSizeIndex:
                vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].grainSize - Config.modulators[grainSizeIndex].convertRealFactor;
                break;
              case grainRangeIndex:
                vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].grainRange - Config.modulators[grainRangeIndex].convertRealFactor;
                break;
              case envSpeedIndex:
                vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].envelopeSpeed - Config.modulators[envSpeedIndex].convertRealFactor;
                break;
              case perEnvSpeedIndex:
                vol = Config.perEnvelopeSpeedToIndices[this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].envelopes[instrument.modEnvelopeNumbers[modCount]].perEnvelopeSpeed] - Config.modulators[perEnvSpeedIndex].convertRealFactor;
                break;
              case perEnvLowerIndex:
                vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].envelopes[instrument.modEnvelopeNumbers[modCount]].perEnvelopeLowerBound * 10 - Config.modulators[perEnvLowerIndex].convertRealFactor;
                break;
              case perEnvUpperIndex:
                vol = this.channels[instrument.modChannels[modCount]].instruments[instrumentIndex].envelopes[instrument.modEnvelopeNumbers[modCount]].perEnvelopeUpperBound * 10 - Config.modulators[perEnvUpperIndex].convertRealFactor;
                break;
            }
          }
          if (vol != void 0)
            return vol;
          else
            return Config.noteSizeMax;
        }
      }, "getNewNoteVolume");
      this.getVolumeCap = /* @__PURE__ */ __name((isMod, modChannel, modInstrument, modCount) => {
        if (!isMod || modChannel == void 0 || modInstrument == void 0 || modCount == void 0)
          return Config.noteSizeMax;
        else {
          modCount = Config.modCount - modCount - 1;
          let instrument = this.channels[modChannel].instruments[modInstrument];
          let modulator = Config.modulators[instrument.modulators[modCount]];
          let cap = modulator.maxRawVol;
          if (cap != void 0) {
            if (modulator.name == "eq filter" || modulator.name == "note filter" || modulator.name == "song eq") {
              cap = Config.filterMorphCount - 1;
              if (instrument.modFilterTypes[modCount] > 0 && instrument.modFilterTypes[modCount] % 2) {
                cap = Config.filterFreqRange;
              } else if (instrument.modFilterTypes[modCount] > 0) {
                cap = Config.filterGainRange;
              }
            }
            return cap;
          } else
            return Config.noteSizeMax;
        }
      }, "getVolumeCap");
      this.getVolumeCapForSetting = /* @__PURE__ */ __name((isMod, modSetting, filterType) => {
        if (!isMod)
          return Config.noteSizeMax;
        else {
          let cap = Config.modulators[modSetting].maxRawVol;
          if (cap != void 0) {
            if (filterType != void 0 && (Config.modulators[modSetting].name == "eq filter" || Config.modulators[modSetting].name == "note filter" || Config.modulators[modSetting].name == "song eq")) {
              cap = Config.filterMorphCount - 1;
              if (filterType > 0 && filterType % 2) {
                cap = Config.filterFreqRange;
              } else if (filterType > 0) {
                cap = Config.filterGainRange;
              }
            }
            return cap;
          } else
            return Config.noteSizeMax;
        }
      }, "getVolumeCapForSetting");
      if (string != void 0) {
        this.fromBase64String(string);
      } else {
        this.initToDefault(true);
      }
    }
    static {
      __name(this, "Song");
    }
    static {
      this._format = Config.jsonFormat;
    }
    static {
      this._oldestBeepboxVersion = 2;
    }
    static {
      this._latestBeepboxVersion = 9;
    }
    static {
      this._oldestJummBoxVersion = 1;
    }
    static {
      this._latestJummBoxVersion = 6;
    }
    static {
      this._oldestGoldBoxVersion = 1;
    }
    static {
      this._latestGoldBoxVersion = 4;
    }
    static {
      this._oldestUltraBoxVersion = 1;
    }
    static {
      this._latestUltraBoxVersion = 5;
    }
    static {
      this._oldestSlarmoosBoxVersion = 1;
    }
    static {
      this._latestSlarmoosBoxVersion = 5;
    }
    static {
      // One-character variant detection at the start of URL to distinguish variants such as JummBox, Or Goldbox. "j" and "g" respectively
      //also "u" is ultrabox lol
      this._variant = 115;
    }
    getChannelCount() {
      return this.pitchChannelCount + this.noiseChannelCount + this.modChannelCount;
    }
    getMaxInstrumentsPerChannel() {
      return Math.max(
        this.layeredInstruments ? Config.layeredInstrumentCountMax : Config.instrumentCountMin,
        this.patternInstruments ? Config.patternInstrumentCountMax : Config.instrumentCountMin
      );
    }
    getMaxInstrumentsPerPattern(channelIndex) {
      return this.getMaxInstrumentsPerPatternForChannel(this.channels[channelIndex]);
    }
    getMaxInstrumentsPerPatternForChannel(channel) {
      return this.layeredInstruments ? Math.min(Config.layeredInstrumentCountMax, channel.instruments.length) : 1;
    }
    getChannelIsNoise(channelIndex) {
      return channelIndex >= this.pitchChannelCount && channelIndex < this.pitchChannelCount + this.noiseChannelCount;
    }
    getChannelIsMod(channelIndex) {
      return channelIndex >= this.pitchChannelCount + this.noiseChannelCount;
    }
    initToDefault(andResetChannels = true) {
      this.scale = 0;
      this.scaleCustom = [true, false, true, true, false, false, false, true, true, false, true, true];
      this.key = 0;
      this.octave = 0;
      this.loopStart = 0;
      this.loopLength = 4;
      this.tempo = 150;
      this.reverb = 0;
      this.beatsPerBar = 8;
      this.barCount = 16;
      this.patternsPerChannel = 8;
      this.rhythm = 1;
      this.layeredInstruments = false;
      this.patternInstruments = false;
      this.eqFilter.reset();
      this.pluginurl = null;
      SynthMessenger.pluginValueNames = [];
      SynthMessenger.pluginInstrumentStateFunction = null;
      SynthMessenger.pluginFunction = null;
      SynthMessenger.pluginIndex = 0;
      SynthMessenger.PluginDelayLineSize = 0;
      PluginConfig.pluginUIElements = [];
      PluginConfig.pluginName = "";
      for (let i = 0; i < Config.filterMorphCount - 1; i++) {
        this.eqSubFilters[i] = null;
      }
      this.title = "Untitled";
      document.title = this.title + " - " + EditorConfig.versionDisplayName;
      if (andResetChannels) {
        this.pitchChannelCount = 3;
        this.noiseChannelCount = 1;
        this.modChannelCount = 1;
        for (let channelIndex = 0; channelIndex < this.getChannelCount(); channelIndex++) {
          const isNoiseChannel = channelIndex >= this.pitchChannelCount && channelIndex < this.pitchChannelCount + this.noiseChannelCount;
          const isModChannel = channelIndex >= this.pitchChannelCount + this.noiseChannelCount;
          if (this.channels.length <= channelIndex) {
            this.channels[channelIndex] = new Channel();
          }
          const channel = this.channels[channelIndex];
          channel.octave = Math.max(3 - channelIndex, 0);
          for (let pattern = 0; pattern < this.patternsPerChannel; pattern++) {
            if (channel.patterns.length <= pattern) {
              channel.patterns[pattern] = new Pattern();
            } else {
              channel.patterns[pattern].reset();
            }
          }
          channel.patterns.length = this.patternsPerChannel;
          for (let instrument = 0; instrument < Config.instrumentCountMin; instrument++) {
            if (channel.instruments.length <= instrument) {
              channel.instruments[instrument] = new Instrument(isNoiseChannel, isModChannel);
            }
            channel.instruments[instrument].setTypeAndReset(isModChannel ? 10 /* mod */ : isNoiseChannel ? 2 /* noise */ : 0 /* chip */, isNoiseChannel, isModChannel);
          }
          channel.instruments.length = Config.instrumentCountMin;
          for (let bar = 0; bar < this.barCount; bar++) {
            channel.bars[bar] = bar < 4 ? 1 : 0;
          }
          channel.bars.length = this.barCount;
        }
        this.channels.length = this.getChannelCount();
      }
    }
    //This determines the url
    toBase64String() {
      let bits;
      let buffer = [];
      buffer.push(_Song._variant);
      buffer.push(base64IntToCharCode[_Song._latestSlarmoosBoxVersion]);
      buffer.push(78 /* songTitle */);
      var encodedSongTitle = encodeURIComponent(this.title);
      buffer.push(base64IntToCharCode[encodedSongTitle.length >> 6], base64IntToCharCode[encodedSongTitle.length & 63]);
      for (let i2 = 0; i2 < encodedSongTitle.length; i2++) {
        buffer.push(encodedSongTitle.charCodeAt(i2));
      }
      buffer.push(110 /* channelCount */, base64IntToCharCode[this.pitchChannelCount], base64IntToCharCode[this.noiseChannelCount], base64IntToCharCode[this.modChannelCount]);
      buffer.push(115 /* scale */, base64IntToCharCode[this.scale]);
      if (this.scale == Config.scales["dictionary"]["Custom"].index) {
        for (var i = 1; i < Config.pitchesPerOctave; i++) {
          buffer.push(base64IntToCharCode[this.scaleCustom[i] ? 1 : 0]);
        }
      }
      buffer.push(107 /* key */, base64IntToCharCode[this.key], base64IntToCharCode[this.octave - Config.octaveMin]);
      buffer.push(108 /* loopStart */, base64IntToCharCode[this.loopStart >> 6], base64IntToCharCode[this.loopStart & 63]);
      buffer.push(101 /* loopEnd */, base64IntToCharCode[this.loopLength - 1 >> 6], base64IntToCharCode[this.loopLength - 1 & 63]);
      buffer.push(116 /* tempo */, base64IntToCharCode[this.tempo >> 6], base64IntToCharCode[this.tempo & 63]);
      buffer.push(97 /* beatCount */, base64IntToCharCode[this.beatsPerBar - 1]);
      buffer.push(103 /* barCount */, base64IntToCharCode[this.barCount - 1 >> 6], base64IntToCharCode[this.barCount - 1 & 63]);
      buffer.push(106 /* patternCount */, base64IntToCharCode[this.patternsPerChannel - 1 >> 6], base64IntToCharCode[this.patternsPerChannel - 1 & 63]);
      buffer.push(114 /* rhythm */, base64IntToCharCode[this.rhythm]);
      buffer.push(79 /* limiterSettings */);
      if (this.compressionRatio != 1 || this.limitRatio != 1 || this.limitRise != 4e3 || this.limitDecay != 4 || this.limitThreshold != 1 || this.compressionThreshold != 1 || this.masterGain != 1) {
        buffer.push(base64IntToCharCode[Math.round(this.compressionRatio < 1 ? this.compressionRatio * 10 : 10 + (this.compressionRatio - 1) * 60)]);
        buffer.push(base64IntToCharCode[Math.round(this.limitRatio < 1 ? this.limitRatio * 10 : 9 + this.limitRatio)]);
        buffer.push(base64IntToCharCode[this.limitDecay]);
        buffer.push(base64IntToCharCode[Math.round((this.limitRise - 2e3) / 250)]);
        buffer.push(base64IntToCharCode[Math.round(this.compressionThreshold * 20)]);
        buffer.push(base64IntToCharCode[Math.round(this.limitThreshold * 20)]);
        buffer.push(base64IntToCharCode[Math.round(this.masterGain * 50) >> 6], base64IntToCharCode[Math.round(this.masterGain * 50) & 63]);
      } else {
        buffer.push(base64IntToCharCode[63]);
      }
      buffer.push(99 /* songEq */);
      if (this.eqFilter == null) {
        buffer.push(base64IntToCharCode[0]);
        console.log("Null EQ filter settings detected in toBase64String for song");
      } else {
        buffer.push(base64IntToCharCode[this.eqFilter.controlPointCount]);
        for (let j = 0; j < this.eqFilter.controlPointCount; j++) {
          const point = this.eqFilter.controlPoints[j];
          buffer.push(base64IntToCharCode[point.type], base64IntToCharCode[Math.round(point.freq)], base64IntToCharCode[Math.round(point.gain)]);
        }
      }
      let usingSubFilterBitfield = 0;
      for (let j = 0; j < Config.filterMorphCount - 1; j++) {
        usingSubFilterBitfield |= +(this.eqSubFilters[j + 1] != null) << j;
      }
      buffer.push(base64IntToCharCode[usingSubFilterBitfield >> 6], base64IntToCharCode[usingSubFilterBitfield & 63]);
      for (let j = 0; j < Config.filterMorphCount - 1; j++) {
        if (usingSubFilterBitfield & 1 << j) {
          buffer.push(base64IntToCharCode[this.eqSubFilters[j + 1].controlPointCount]);
          for (let k = 0; k < this.eqSubFilters[j + 1].controlPointCount; k++) {
            const point = this.eqSubFilters[j + 1].controlPoints[k];
            buffer.push(base64IntToCharCode[point.type], base64IntToCharCode[Math.round(point.freq)], base64IntToCharCode[Math.round(point.gain)]);
          }
        }
      }
      buffer.push(85 /* channelNames */);
      for (let channel = 0; channel < this.getChannelCount(); channel++) {
        var encodedChannelName = encodeURIComponent(this.channels[channel].name);
        buffer.push(base64IntToCharCode[encodedChannelName.length >> 6], base64IntToCharCode[encodedChannelName.length & 63]);
        for (let i2 = 0; i2 < encodedChannelName.length; i2++) {
          buffer.push(encodedChannelName.charCodeAt(i2));
        }
      }
      buffer.push(105 /* instrumentCount */, base64IntToCharCode[this.layeredInstruments << 1 | this.patternInstruments]);
      if (this.layeredInstruments || this.patternInstruments) {
        for (let channelIndex = 0; channelIndex < this.getChannelCount(); channelIndex++) {
          buffer.push(base64IntToCharCode[this.channels[channelIndex].instruments.length - Config.instrumentCountMin]);
        }
      }
      buffer.push(111 /* channelOctave */);
      for (let channelIndex = 0; channelIndex < this.pitchChannelCount; channelIndex++) {
        buffer.push(base64IntToCharCode[this.channels[channelIndex].octave]);
      }
      for (let channelIndex = 0; channelIndex < this.getChannelCount(); channelIndex++) {
        for (let i2 = 0; i2 < this.channels[channelIndex].instruments.length; i2++) {
          const instrument = this.channels[channelIndex].instruments[i2];
          buffer.push(84 /* startInstrument */, base64IntToCharCode[instrument.type]);
          buffer.push(118 /* volume */, base64IntToCharCode[instrument.volume + Config.volumeRange / 2 >> 6], base64IntToCharCode[instrument.volume + Config.volumeRange / 2 & 63]);
          buffer.push(117 /* preset */, base64IntToCharCode[instrument.preset >> 6], base64IntToCharCode[instrument.preset & 63]);
          buffer.push(102 /* eqFilter */);
          buffer.push(base64IntToCharCode[+instrument.eqFilterType]);
          if (instrument.eqFilterType) {
            buffer.push(base64IntToCharCode[instrument.eqFilterSimpleCut]);
            buffer.push(base64IntToCharCode[instrument.eqFilterSimplePeak]);
          } else {
            if (instrument.eqFilter == null) {
              buffer.push(base64IntToCharCode[0]);
              console.log("Null EQ filter settings detected in toBase64String for channelIndex " + channelIndex + ", instrumentIndex " + i2);
            } else {
              buffer.push(base64IntToCharCode[instrument.eqFilter.controlPointCount]);
              for (let j = 0; j < instrument.eqFilter.controlPointCount; j++) {
                const point = instrument.eqFilter.controlPoints[j];
                buffer.push(base64IntToCharCode[point.type], base64IntToCharCode[Math.round(point.freq)], base64IntToCharCode[Math.round(point.gain)]);
              }
            }
            let usingSubFilterBitfield2 = 0;
            for (let j = 0; j < Config.filterMorphCount - 1; j++) {
              usingSubFilterBitfield2 |= +(instrument.eqSubFilters[j + 1] != null) << j;
            }
            buffer.push(base64IntToCharCode[usingSubFilterBitfield2 >> 6], base64IntToCharCode[usingSubFilterBitfield2 & 63]);
            for (let j = 0; j < Config.filterMorphCount - 1; j++) {
              if (usingSubFilterBitfield2 & 1 << j) {
                buffer.push(base64IntToCharCode[instrument.eqSubFilters[j + 1].controlPointCount]);
                for (let k = 0; k < instrument.eqSubFilters[j + 1].controlPointCount; k++) {
                  const point = instrument.eqSubFilters[j + 1].controlPoints[k];
                  buffer.push(base64IntToCharCode[point.type], base64IntToCharCode[Math.round(point.freq)], base64IntToCharCode[Math.round(point.gain)]);
                }
              }
            }
          }
          buffer.push(113 /* effects */, base64IntToCharCode[instrument.effects >> 12 & 63], base64IntToCharCode[instrument.effects >> 6 & 63], base64IntToCharCode[instrument.effects & 63]);
          if (effectsIncludeNoteFilter(instrument.effects)) {
            buffer.push(base64IntToCharCode[+instrument.noteFilterType]);
            if (instrument.noteFilterType) {
              buffer.push(base64IntToCharCode[instrument.noteFilterSimpleCut]);
              buffer.push(base64IntToCharCode[instrument.noteFilterSimplePeak]);
            } else {
              if (instrument.noteFilter == null) {
                buffer.push(base64IntToCharCode[0]);
                console.log("Null note filter settings detected in toBase64String for channelIndex " + channelIndex + ", instrumentIndex " + i2);
              } else {
                buffer.push(base64IntToCharCode[instrument.noteFilter.controlPointCount]);
                for (let j = 0; j < instrument.noteFilter.controlPointCount; j++) {
                  const point = instrument.noteFilter.controlPoints[j];
                  buffer.push(base64IntToCharCode[point.type], base64IntToCharCode[Math.round(point.freq)], base64IntToCharCode[Math.round(point.gain)]);
                }
              }
              let usingSubFilterBitfield2 = 0;
              for (let j = 0; j < Config.filterMorphCount - 1; j++) {
                usingSubFilterBitfield2 |= +(instrument.noteSubFilters[j + 1] != null) << j;
              }
              buffer.push(base64IntToCharCode[usingSubFilterBitfield2 >> 6], base64IntToCharCode[usingSubFilterBitfield2 & 63]);
              for (let j = 0; j < Config.filterMorphCount - 1; j++) {
                if (usingSubFilterBitfield2 & 1 << j) {
                  buffer.push(base64IntToCharCode[instrument.noteSubFilters[j + 1].controlPointCount]);
                  for (let k = 0; k < instrument.noteSubFilters[j + 1].controlPointCount; k++) {
                    const point = instrument.noteSubFilters[j + 1].controlPoints[k];
                    buffer.push(base64IntToCharCode[point.type], base64IntToCharCode[Math.round(point.freq)], base64IntToCharCode[Math.round(point.gain)]);
                  }
                }
              }
            }
          }
          if (effectsIncludeTransition(instrument.effects)) {
            buffer.push(base64IntToCharCode[instrument.transition]);
          }
          if (effectsIncludeChord(instrument.effects)) {
            buffer.push(base64IntToCharCode[instrument.chord]);
            if (instrument.chord == Config.chords.dictionary["arpeggio"].index) {
              buffer.push(base64IntToCharCode[instrument.arpeggioSpeed]);
              buffer.push(base64IntToCharCode[+instrument.fastTwoNoteArp]);
            }
            if (instrument.chord == Config.chords.dictionary["monophonic"].index) {
              buffer.push(base64IntToCharCode[instrument.monoChordTone]);
            }
          }
          if (effectsIncludePitchShift(instrument.effects)) {
            buffer.push(base64IntToCharCode[instrument.pitchShift]);
          }
          if (effectsIncludeDetune(instrument.effects)) {
            buffer.push(base64IntToCharCode[instrument.detune - Config.detuneMin >> 6], base64IntToCharCode[instrument.detune - Config.detuneMin & 63]);
          }
          if (effectsIncludeVibrato(instrument.effects)) {
            buffer.push(base64IntToCharCode[instrument.vibrato]);
            if (instrument.vibrato == Config.vibratos.length) {
              buffer.push(base64IntToCharCode[Math.round(instrument.vibratoDepth * 25)]);
              buffer.push(base64IntToCharCode[instrument.vibratoSpeed]);
              buffer.push(base64IntToCharCode[Math.round(instrument.vibratoDelay)]);
              buffer.push(base64IntToCharCode[instrument.vibratoType]);
            }
          }
          if (effectsIncludeDistortion(instrument.effects)) {
            buffer.push(base64IntToCharCode[instrument.distortion]);
            buffer.push(base64IntToCharCode[+instrument.aliases]);
          }
          if (effectsIncludeBitcrusher(instrument.effects)) {
            buffer.push(base64IntToCharCode[instrument.bitcrusherFreq], base64IntToCharCode[instrument.bitcrusherQuantization]);
          }
          if (effectsIncludePanning(instrument.effects)) {
            buffer.push(base64IntToCharCode[instrument.pan >> 6], base64IntToCharCode[instrument.pan & 63]);
            buffer.push(base64IntToCharCode[instrument.panDelay]);
          }
          if (effectsIncludeChorus(instrument.effects)) {
            buffer.push(base64IntToCharCode[instrument.chorus]);
          }
          if (effectsIncludeEcho(instrument.effects)) {
            buffer.push(base64IntToCharCode[instrument.echoSustain], base64IntToCharCode[instrument.echoDelay]);
          }
          if (effectsIncludeReverb(instrument.effects)) {
            buffer.push(base64IntToCharCode[instrument.reverb]);
          }
          if (effectsIncludeGranular(instrument.effects)) {
            buffer.push(base64IntToCharCode[instrument.granular]);
            buffer.push(base64IntToCharCode[instrument.grainSize]);
            buffer.push(base64IntToCharCode[instrument.grainAmounts]);
            buffer.push(base64IntToCharCode[instrument.grainRange]);
          }
          if (effectsIncludeRingModulation(instrument.effects)) {
            buffer.push(base64IntToCharCode[instrument.ringModulation]);
            buffer.push(base64IntToCharCode[instrument.ringModulationHz]);
            buffer.push(base64IntToCharCode[instrument.ringModWaveformIndex]);
            buffer.push(base64IntToCharCode[instrument.ringModPulseWidth]);
            buffer.push(base64IntToCharCode[instrument.ringModHzOffset - Config.rmHzOffsetMin >> 6], base64IntToCharCode[instrument.ringModHzOffset - Config.rmHzOffsetMin & 63]);
          }
          if (effectsIncludePlugin(instrument.effects)) {
            let pluginValueCount = PluginConfig.pluginUIElements.length;
            if (PluginConfig.pluginUIElements.length == 0) {
              for (let i3 = 0; i3 < instrument.pluginValues.length; i3++) {
                if (instrument.pluginValues[pluginValueCount]) pluginValueCount = i3;
              }
            }
            buffer.push(base64IntToCharCode[pluginValueCount]);
            for (let i3 = 0; i3 < pluginValueCount; i3++) {
              buffer.push(base64IntToCharCode[instrument.pluginValues[i3]]);
            }
          }
          if (instrument.type != 4 /* drumset */) {
            buffer.push(100 /* fadeInOut */, base64IntToCharCode[instrument.fadeIn], base64IntToCharCode[instrument.fadeOut]);
            buffer.push(base64IntToCharCode[+instrument.clicklessTransition]);
          }
          if (instrument.type == 5 /* harmonics */ || instrument.type == 7 /* pickedString */) {
            buffer.push(72 /* harmonics */);
            const harmonicsBits = new BitFieldWriter();
            for (let i3 = 0; i3 < Config.harmonicsControlPoints; i3++) {
              harmonicsBits.write(Config.harmonicsControlPointBits, instrument.harmonicsWave.harmonics[i3]);
            }
            harmonicsBits.encodeBase64(buffer);
          }
          if (instrument.type == 0 /* chip */) {
            if (instrument.chipWave > 186) {
              buffer.push(119, base64IntToCharCode[instrument.chipWave - 186]);
              buffer.push(base64IntToCharCode[3]);
            } else if (instrument.chipWave > 124) {
              buffer.push(119, base64IntToCharCode[instrument.chipWave - 124]);
              buffer.push(base64IntToCharCode[2]);
            } else if (instrument.chipWave > 62) {
              buffer.push(119, base64IntToCharCode[instrument.chipWave - 62]);
              buffer.push(base64IntToCharCode[1]);
            } else {
              buffer.push(119, base64IntToCharCode[instrument.chipWave]);
              buffer.push(base64IntToCharCode[0]);
            }
            buffer.push(104, base64IntToCharCode[instrument.unison]);
            if (instrument.unison == Config.unisons.length) encodeUnisonSettings(buffer, instrument.unisonVoices, instrument.unisonSpread, instrument.unisonOffset, instrument.unisonExpression, instrument.unisonSign);
            buffer.push(121 /* loopControls */);
            const encodedLoopMode = clamp(0, 31 + 1, instrument.chipWaveLoopMode) << 1 | (instrument.isUsingAdvancedLoopControls ? 1 : 0);
            buffer.push(base64IntToCharCode[encodedLoopMode]);
            const encodedReleaseMode = clamp(0, 31 + 1, 0) << 1 | (instrument.chipWavePlayBackwards ? 1 : 0);
            buffer.push(base64IntToCharCode[encodedReleaseMode]);
            encode32BitNumber(buffer, instrument.chipWaveLoopStart);
            encode32BitNumber(buffer, instrument.chipWaveLoopEnd);
            encode32BitNumber(buffer, instrument.chipWaveStartOffset);
          } else if (instrument.type == 1 /* fm */ || instrument.type == 11 /* fm6op */) {
            if (instrument.type == 1 /* fm */) {
              buffer.push(65 /* algorithm */, base64IntToCharCode[instrument.algorithm]);
              buffer.push(70 /* feedbackType */, base64IntToCharCode[instrument.feedbackType]);
            } else {
              buffer.push(65 /* algorithm */, base64IntToCharCode[instrument.algorithm6Op]);
              if (instrument.algorithm6Op == 0) {
                buffer.push(67 /* chord */, base64IntToCharCode[instrument.customAlgorithm.carrierCount]);
                buffer.push(113 /* effects */);
                for (let o = 0; o < instrument.customAlgorithm.modulatedBy.length; o++) {
                  for (let j = 0; j < instrument.customAlgorithm.modulatedBy[o].length; j++) {
                    buffer.push(base64IntToCharCode[instrument.customAlgorithm.modulatedBy[o][j]]);
                  }
                  buffer.push(82 /* operatorWaves */);
                }
                buffer.push(113 /* effects */);
              }
              buffer.push(70 /* feedbackType */, base64IntToCharCode[instrument.feedbackType6Op]);
              if (instrument.feedbackType6Op == 0) {
                buffer.push(113 /* effects */);
                for (let o = 0; o < instrument.customFeedbackType.indices.length; o++) {
                  for (let j = 0; j < instrument.customFeedbackType.indices[o].length; j++) {
                    buffer.push(base64IntToCharCode[instrument.customFeedbackType.indices[o][j]]);
                  }
                  buffer.push(82 /* operatorWaves */);
                }
                buffer.push(113 /* effects */);
              }
            }
            buffer.push(66 /* feedbackAmplitude */, base64IntToCharCode[instrument.feedbackAmplitude]);
            buffer.push(81 /* operatorFrequencies */);
            for (let o = 0; o < (instrument.type == 11 /* fm6op */ ? 6 : Config.operatorCount); o++) {
              buffer.push(base64IntToCharCode[instrument.operators[o].frequency]);
            }
            buffer.push(80 /* operatorAmplitudes */);
            for (let o = 0; o < (instrument.type == 11 /* fm6op */ ? 6 : Config.operatorCount); o++) {
              buffer.push(base64IntToCharCode[instrument.operators[o].amplitude]);
            }
            buffer.push(82 /* operatorWaves */);
            for (let o = 0; o < (instrument.type == 11 /* fm6op */ ? 6 : Config.operatorCount); o++) {
              buffer.push(base64IntToCharCode[instrument.operators[o].waveform]);
              if (instrument.operators[o].waveform == 2) {
                buffer.push(base64IntToCharCode[instrument.operators[o].pulseWidth]);
              }
            }
            buffer.push(104 /* unison */, base64IntToCharCode[instrument.unison]);
            if (instrument.unison == Config.unisons.length) encodeUnisonSettings(buffer, instrument.unisonVoices, instrument.unisonSpread, instrument.unisonOffset, instrument.unisonExpression, instrument.unisonSign);
          } else if (instrument.type == 9 /* customChipWave */) {
            if (instrument.chipWave > 186) {
              buffer.push(119, base64IntToCharCode[instrument.chipWave - 186]);
              buffer.push(base64IntToCharCode[3]);
            } else if (instrument.chipWave > 124) {
              buffer.push(119, base64IntToCharCode[instrument.chipWave - 124]);
              buffer.push(base64IntToCharCode[2]);
            } else if (instrument.chipWave > 62) {
              buffer.push(119, base64IntToCharCode[instrument.chipWave - 62]);
              buffer.push(base64IntToCharCode[1]);
            } else {
              buffer.push(119, base64IntToCharCode[instrument.chipWave]);
              buffer.push(base64IntToCharCode[0]);
            }
            buffer.push(104, base64IntToCharCode[instrument.unison]);
            if (instrument.unison == Config.unisons.length) encodeUnisonSettings(buffer, instrument.unisonVoices, instrument.unisonSpread, instrument.unisonOffset, instrument.unisonExpression, instrument.unisonSign);
            buffer.push(77 /* customChipWave */);
            for (let j = 0; j < 64; j++) {
              buffer.push(base64IntToCharCode[instrument.customChipWave[j] + 24]);
            }
          } else if (instrument.type == 2 /* noise */) {
            buffer.push(119 /* wave */, base64IntToCharCode[instrument.chipNoise]);
            buffer.push(104 /* unison */, base64IntToCharCode[instrument.unison]);
            if (instrument.unison == Config.unisons.length) encodeUnisonSettings(buffer, instrument.unisonVoices, instrument.unisonSpread, instrument.unisonOffset, instrument.unisonExpression, instrument.unisonSign);
          } else if (instrument.type == 3 /* spectrum */) {
            buffer.push(83 /* spectrum */);
            const spectrumBits = new BitFieldWriter();
            for (let i3 = 0; i3 < Config.spectrumControlPoints; i3++) {
              spectrumBits.write(Config.spectrumControlPointBits, instrument.spectrumWave.spectrum[i3]);
            }
            spectrumBits.encodeBase64(buffer);
            buffer.push(104 /* unison */, base64IntToCharCode[instrument.unison]);
            if (instrument.unison == Config.unisons.length) encodeUnisonSettings(buffer, instrument.unisonVoices, instrument.unisonSpread, instrument.unisonOffset, instrument.unisonExpression, instrument.unisonSign);
          } else if (instrument.type == 4 /* drumset */) {
            buffer.push(122 /* drumsetEnvelopes */);
            for (let j = 0; j < Config.drumCount; j++) {
              buffer.push(base64IntToCharCode[instrument.drumsetEnvelopes[j]]);
            }
            buffer.push(83 /* spectrum */);
            const spectrumBits = new BitFieldWriter();
            for (let j = 0; j < Config.drumCount; j++) {
              for (let i3 = 0; i3 < Config.spectrumControlPoints; i3++) {
                spectrumBits.write(Config.spectrumControlPointBits, instrument.drumsetSpectrumWaves[j].spectrum[i3]);
              }
            }
            spectrumBits.encodeBase64(buffer);
            buffer.push(104 /* unison */, base64IntToCharCode[instrument.unison]);
            if (instrument.unison == Config.unisons.length) encodeUnisonSettings(buffer, instrument.unisonVoices, instrument.unisonSpread, instrument.unisonOffset, instrument.unisonExpression, instrument.unisonSign);
          } else if (instrument.type == 5 /* harmonics */) {
            buffer.push(104 /* unison */, base64IntToCharCode[instrument.unison]);
            if (instrument.unison == Config.unisons.length) encodeUnisonSettings(buffer, instrument.unisonVoices, instrument.unisonSpread, instrument.unisonOffset, instrument.unisonExpression, instrument.unisonSign);
          } else if (instrument.type == 6 /* pwm */) {
            buffer.push(87 /* pulseWidth */, base64IntToCharCode[instrument.pulseWidth]);
            buffer.push(base64IntToCharCode[instrument.decimalOffset >> 6], base64IntToCharCode[instrument.decimalOffset & 63]);
            buffer.push(104 /* unison */, base64IntToCharCode[instrument.unison]);
            if (instrument.unison == Config.unisons.length) encodeUnisonSettings(buffer, instrument.unisonVoices, instrument.unisonSpread, instrument.unisonOffset, instrument.unisonExpression, instrument.unisonSign);
          } else if (instrument.type == 8 /* supersaw */) {
            buffer.push(120 /* supersaw */, base64IntToCharCode[instrument.supersawDynamism], base64IntToCharCode[instrument.supersawSpread], base64IntToCharCode[instrument.supersawShape]);
            buffer.push(87 /* pulseWidth */, base64IntToCharCode[instrument.pulseWidth]);
            buffer.push(base64IntToCharCode[instrument.decimalOffset >> 6], base64IntToCharCode[instrument.decimalOffset & 63]);
          } else if (instrument.type == 7 /* pickedString */) {
            if (Config.stringSustainRange > 32 || 2 /* length */ > 2) {
              throw new Error("Not enough bits to represent sustain value and type in same base64 character.");
            }
            buffer.push(104 /* unison */, base64IntToCharCode[instrument.unison]);
            if (instrument.unison == Config.unisons.length) encodeUnisonSettings(buffer, instrument.unisonVoices, instrument.unisonSpread, instrument.unisonOffset, instrument.unisonExpression, instrument.unisonSign);
            buffer.push(73 /* stringSustain */, base64IntToCharCode[instrument.stringSustain | instrument.stringSustainType << 5]);
          } else if (instrument.type == 10 /* mod */) {
          } else {
            throw new Error("Unknown instrument type.");
          }
          buffer.push(69 /* envelopes */, base64IntToCharCode[instrument.envelopeCount]);
          buffer.push(base64IntToCharCode[instrument.envelopeSpeed]);
          for (let envelopeIndex = 0; envelopeIndex < instrument.envelopeCount; envelopeIndex++) {
            buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].target]);
            if (Config.instrumentAutomationTargets[instrument.envelopes[envelopeIndex].target].maxCount > 1) {
              buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].index]);
            }
            buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].envelope]);
            if (Config.envelopes[instrument.envelopes[envelopeIndex].envelope].name == "pitch") {
              if (!instrument.isNoiseInstrument) {
                buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].pitchEnvelopeStart >> 6], base64IntToCharCode[instrument.envelopes[envelopeIndex].pitchEnvelopeStart & 63]);
                buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].pitchEnvelopeEnd >> 6], base64IntToCharCode[instrument.envelopes[envelopeIndex].pitchEnvelopeEnd & 63]);
              } else {
                buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].pitchEnvelopeStart]);
                buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].pitchEnvelopeEnd]);
              }
            } else if (Config.envelopes[instrument.envelopes[envelopeIndex].envelope].name == "random") {
              buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].steps]);
              buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].seed]);
              buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].waveform]);
            } else if (Config.envelopes[instrument.envelopes[envelopeIndex].envelope].name == "lfo") {
              buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].waveform]);
              if (instrument.envelopes[envelopeIndex].waveform == 5 /* steppedSaw */ || instrument.envelopes[envelopeIndex].waveform == 6 /* steppedTri */) {
                buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].steps]);
              }
            }
            let checkboxValues = +instrument.envelopes[envelopeIndex].discrete;
            checkboxValues = checkboxValues << 1;
            checkboxValues += +instrument.envelopes[envelopeIndex].inverse;
            buffer.push(base64IntToCharCode[checkboxValues] ? base64IntToCharCode[checkboxValues] : base64IntToCharCode[0]);
            if (Config.envelopes[instrument.envelopes[envelopeIndex].envelope].name != "pitch" && Config.envelopes[instrument.envelopes[envelopeIndex].envelope].name != "note size" && Config.envelopes[instrument.envelopes[envelopeIndex].envelope].name != "punch" && Config.envelopes[instrument.envelopes[envelopeIndex].envelope].name != "none") {
              buffer.push(base64IntToCharCode[Config.perEnvelopeSpeedToIndices[instrument.envelopes[envelopeIndex].perEnvelopeSpeed]]);
            }
            buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].perEnvelopeLowerBound * 10]);
            buffer.push(base64IntToCharCode[instrument.envelopes[envelopeIndex].perEnvelopeUpperBound * 10]);
          }
        }
      }
      buffer.push(98 /* bars */);
      bits = new BitFieldWriter();
      let neededBits = 0;
      while (1 << neededBits < this.patternsPerChannel + 1) neededBits++;
      for (let channelIndex = 0; channelIndex < this.getChannelCount(); channelIndex++) for (let i2 = 0; i2 < this.barCount; i2++) {
        bits.write(neededBits, this.channels[channelIndex].bars[i2]);
      }
      bits.encodeBase64(buffer);
      buffer.push(112 /* patterns */);
      bits = new BitFieldWriter();
      const shapeBits = new BitFieldWriter();
      const bitsPerNoteSize = _Song.getNeededBits(Config.noteSizeMax);
      for (let channelIndex = 0; channelIndex < this.getChannelCount(); channelIndex++) {
        const channel = this.channels[channelIndex];
        const maxInstrumentsPerPattern = this.getMaxInstrumentsPerPattern(channelIndex);
        const isNoiseChannel = this.getChannelIsNoise(channelIndex);
        const isModChannel = this.getChannelIsMod(channelIndex);
        const neededInstrumentCountBits = _Song.getNeededBits(maxInstrumentsPerPattern - Config.instrumentCountMin);
        const neededInstrumentIndexBits = _Song.getNeededBits(channel.instruments.length - 1);
        if (isModChannel) {
          const neededModInstrumentIndexBits = _Song.getNeededBits(this.getMaxInstrumentsPerChannel() + 2);
          for (let instrumentIndex = 0; instrumentIndex < channel.instruments.length; instrumentIndex++) {
            let instrument = this.channels[channelIndex].instruments[instrumentIndex];
            for (let mod = 0; mod < Config.modCount; mod++) {
              const modChannel = instrument.modChannels[mod];
              const modInstrument = instrument.modInstruments[mod];
              const modSetting = instrument.modulators[mod];
              const modFilter = instrument.modFilterTypes[mod];
              const modEnvelope = instrument.modEnvelopeNumbers[mod];
              let status = Config.modulators[modSetting].forSong ? 2 : 0;
              if (modSetting == Config.modulators.dictionary["none"].index)
                status = 3;
              bits.write(2, status);
              if (status == 0 || status == 1) {
                bits.write(8, modChannel);
                bits.write(neededModInstrumentIndexBits, modInstrument);
              }
              if (status != 3) {
                bits.write(6, modSetting);
              }
              if (Config.modulators[instrument.modulators[mod]].name == "eq filter" || Config.modulators[instrument.modulators[mod]].name == "note filter" || Config.modulators[instrument.modulators[mod]].name == "song eq") {
                bits.write(6, modFilter);
              }
              if (Config.modulators[instrument.modulators[mod]].name == "individual envelope speed" || Config.modulators[instrument.modulators[mod]].name == "reset envelope" || Config.modulators[instrument.modulators[mod]].name == "individual envelope lower bound" || Config.modulators[instrument.modulators[mod]].name == "individual envelope upper bound") {
                bits.write(6, modEnvelope);
              }
            }
          }
        }
        const octaveOffset = isNoiseChannel || isModChannel ? 0 : channel.octave * Config.pitchesPerOctave;
        let lastPitch = isNoiseChannel ? 4 : octaveOffset;
        const recentPitches = isModChannel ? [0, 1, 2, 3, 4, 5] : isNoiseChannel ? [4, 6, 7, 2, 3, 8, 0, 10] : [0, 7, 12, 19, 24, -5, -12];
        const recentShapes = [];
        for (let i2 = 0; i2 < recentPitches.length; i2++) {
          recentPitches[i2] += octaveOffset;
        }
        for (const pattern of channel.patterns) {
          if (this.patternInstruments) {
            const instrumentCount = validateRange(Config.instrumentCountMin, maxInstrumentsPerPattern, pattern.instruments.length);
            bits.write(neededInstrumentCountBits, instrumentCount - Config.instrumentCountMin);
            for (let i2 = 0; i2 < instrumentCount; i2++) {
              bits.write(neededInstrumentIndexBits, pattern.instruments[i2]);
            }
          }
          if (pattern.notes.length > 0) {
            bits.write(1, 1);
            let curPart = 0;
            for (const note of pattern.notes) {
              if (note.start < curPart && isModChannel) {
                bits.write(2, 0);
                bits.write(1, 1);
                bits.writePartDuration(curPart - note.start);
              }
              if (note.start > curPart) {
                bits.write(2, 0);
                if (isModChannel) bits.write(1, 0);
                bits.writePartDuration(note.start - curPart);
              }
              shapeBits.clear();
              if (note.pitches.length == 1) {
                shapeBits.write(1, 0);
              } else {
                shapeBits.write(1, 1);
                shapeBits.write(3, note.pitches.length - 2);
              }
              shapeBits.writePinCount(note.pins.length - 1);
              if (!isModChannel) {
                shapeBits.write(bitsPerNoteSize, note.pins[0].size);
              } else {
                shapeBits.write(9, note.pins[0].size);
              }
              let shapePart = 0;
              let startPitch = note.pitches[0];
              let currentPitch = startPitch;
              const pitchBends = [];
              for (let i2 = 1; i2 < note.pins.length; i2++) {
                const pin = note.pins[i2];
                const nextPitch = startPitch + pin.interval;
                if (currentPitch != nextPitch) {
                  shapeBits.write(1, 1);
                  pitchBends.push(nextPitch);
                  currentPitch = nextPitch;
                } else {
                  shapeBits.write(1, 0);
                }
                shapeBits.writePartDuration(pin.time - shapePart);
                shapePart = pin.time;
                if (!isModChannel) {
                  shapeBits.write(bitsPerNoteSize, pin.size);
                } else {
                  shapeBits.write(9, pin.size);
                }
              }
              const shapeString = String.fromCharCode.apply(null, shapeBits.encodeBase64([]));
              const shapeIndex = recentShapes.indexOf(shapeString);
              if (shapeIndex == -1) {
                bits.write(2, 1);
                bits.concat(shapeBits);
              } else {
                bits.write(1, 1);
                bits.writeLongTail(0, 0, shapeIndex);
                recentShapes.splice(shapeIndex, 1);
              }
              recentShapes.unshift(shapeString);
              if (recentShapes.length > 10) recentShapes.pop();
              const allPitches = note.pitches.concat(pitchBends);
              for (let i2 = 0; i2 < allPitches.length; i2++) {
                const pitch = allPitches[i2];
                const pitchIndex = recentPitches.indexOf(pitch);
                if (pitchIndex == -1) {
                  let interval = 0;
                  let pitchIter = lastPitch;
                  if (pitchIter < pitch) {
                    while (pitchIter != pitch) {
                      pitchIter++;
                      if (recentPitches.indexOf(pitchIter) == -1) interval++;
                    }
                  } else {
                    while (pitchIter != pitch) {
                      pitchIter--;
                      if (recentPitches.indexOf(pitchIter) == -1) interval--;
                    }
                  }
                  bits.write(1, 0);
                  bits.writePitchInterval(interval);
                } else {
                  bits.write(1, 1);
                  bits.write(4, pitchIndex);
                  recentPitches.splice(pitchIndex, 1);
                }
                recentPitches.unshift(pitch);
                if (recentPitches.length > 16) recentPitches.pop();
                if (i2 == note.pitches.length - 1) {
                  lastPitch = note.pitches[0];
                } else {
                  lastPitch = pitch;
                }
              }
              if (note.start == 0) {
                bits.write(1, note.continuesLastPattern ? 1 : 0);
              }
              curPart = note.end;
            }
            if (curPart < this.beatsPerBar * Config.partsPerBeat + +isModChannel) {
              bits.write(2, 0);
              if (isModChannel) bits.write(1, 0);
              bits.writePartDuration(this.beatsPerBar * Config.partsPerBeat + +isModChannel - curPart);
            }
          } else {
            bits.write(1, 0);
          }
        }
      }
      let stringLength = bits.lengthBase64();
      let digits = [];
      while (stringLength > 0) {
        digits.unshift(base64IntToCharCode[stringLength & 63]);
        stringLength = stringLength >> 6;
      }
      buffer.push(base64IntToCharCode[digits.length]);
      Array.prototype.push.apply(buffer, digits);
      bits.encodeBase64(buffer);
      const maxApplyArgs = 64e3;
      let customSamplesStr = "";
      if (EditorConfig.customSamples != void 0 && EditorConfig.customSamples.length > 0) {
        customSamplesStr = "|" + EditorConfig.customSamples.join("|");
      }
      if (this.pluginurl != null) {
        customSamplesStr += "||" + this.pluginurl;
      }
      if (buffer.length < maxApplyArgs) {
        return String.fromCharCode.apply(null, buffer) + customSamplesStr;
      } else {
        let result = "";
        for (let i2 = 0; i2 < buffer.length; i2 += maxApplyArgs) {
          result += String.fromCharCode.apply(null, buffer.slice(i2, i2 + maxApplyArgs));
        }
        return result + customSamplesStr;
      }
    }
    static _envelopeFromLegacyIndex(legacyIndex) {
      if (legacyIndex == 0) legacyIndex = 1;
      else if (legacyIndex == 1) legacyIndex = 0;
      return Config.envelopePresets[clamp(0, Config.envelopePresets.length, legacyIndex)];
    }
    fromBase64String(compressed, jsonFormat = "auto") {
      if (compressed == null || compressed == "") {
        _Song._clearSamples();
        this.initToDefault(true);
        return;
      }
      let charIndex = 0;
      while (compressed.charCodeAt(charIndex) <= 32 /* SPACE */) charIndex++;
      if (compressed.charCodeAt(charIndex) == 35 /* HASH */) charIndex++;
      if (compressed.charCodeAt(charIndex) == 123 /* LEFT_CURLY_BRACE */) {
        this.fromJsonObject(JSON.parse(charIndex == 0 ? compressed : compressed.substring(charIndex)), jsonFormat);
        return;
      }
      const variantTest = compressed.charCodeAt(charIndex);
      let fromBeepBox = false;
      let fromJummBox = false;
      let fromGoldBox = false;
      let fromUltraBox = false;
      let fromSlarmoosBox = false;
      if (variantTest == 106) {
        fromJummBox = true;
        charIndex++;
      } else if (variantTest == 103) {
        fromGoldBox = true;
        charIndex++;
      } else if (variantTest == 117) {
        fromUltraBox = true;
        charIndex++;
      } else if (variantTest == 100) {
        fromJummBox = true;
        charIndex++;
      } else if (variantTest == 97) {
        fromUltraBox = true;
        charIndex++;
      } else if (variantTest == 115) {
        fromSlarmoosBox = true;
        charIndex++;
      } else {
        fromBeepBox = true;
      }
      const version = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
      if (fromBeepBox && (version == -1 || version > _Song._latestBeepboxVersion || version < _Song._oldestBeepboxVersion)) return;
      if (fromJummBox && (version == -1 || version > _Song._latestJummBoxVersion || version < _Song._oldestJummBoxVersion)) return;
      if (fromGoldBox && (version == -1 || version > _Song._latestGoldBoxVersion || version < _Song._oldestGoldBoxVersion)) return;
      if (fromUltraBox && (version == -1 || version > _Song._latestUltraBoxVersion || version < _Song._oldestUltraBoxVersion)) return;
      if (fromSlarmoosBox && (version == -1 || version > _Song._latestSlarmoosBoxVersion || version < _Song._oldestSlarmoosBoxVersion)) return;
      const beforeTwo = version < 2;
      const beforeThree = version < 3;
      const beforeFour = version < 4;
      const beforeFive = version < 5;
      const beforeSix = version < 6;
      const beforeSeven = version < 7;
      const beforeEight = version < 8;
      const beforeNine = version < 9;
      this.initToDefault(fromBeepBox && beforeNine || (fromJummBox && beforeFive || beforeFour && fromGoldBox));
      const forceSimpleFilter = fromBeepBox && beforeNine || fromJummBox && beforeFive;
      let willLoadLegacySamplesForOldSongs = false;
      if (fromSlarmoosBox || fromUltraBox || fromGoldBox) {
        compressed = compressed.replaceAll("%7C", "|");
        var compressed_array = compressed.split("||");
        const pluginurl = compressed_array.length < 2 ? null : compressed_array[1];
        compressed_array = compressed_array[0].split("|");
        compressed = compressed_array.shift();
        if (EditorConfig.customSamples == null || EditorConfig.customSamples.join(", ") != compressed_array.join(", ")) {
          _Song._restoreChipWaveListToDefault();
          let willLoadLegacySamples = false;
          let willLoadNintariboxSamples = false;
          let willLoadMarioPaintboxSamples = false;
          const customSampleUrls = [];
          const customSamplePresets = [];
          sampleLoadingState.statusTable = {};
          sampleLoadingState.urlTable = {};
          sampleLoadingState.totalSamples = 0;
          sampleLoadingState.samplesLoaded = 0;
          sampleLoadEvents.dispatchEvent(new SampleLoadedEvent(
            sampleLoadingState.totalSamples,
            sampleLoadingState.samplesLoaded
          ));
          for (const url of compressed_array) {
            if (url.toLowerCase() === "legacysamples") {
              if (!willLoadLegacySamples) {
                willLoadLegacySamples = true;
                customSampleUrls.push(url);
                loadBuiltInSamples(0);
              }
            } else if (url.toLowerCase() === "nintariboxsamples") {
              if (!willLoadNintariboxSamples) {
                willLoadNintariboxSamples = true;
                customSampleUrls.push(url);
                loadBuiltInSamples(1);
              }
            } else if (url.toLowerCase() === "mariopaintboxsamples") {
              if (!willLoadMarioPaintboxSamples) {
                willLoadMarioPaintboxSamples = true;
                customSampleUrls.push(url);
                loadBuiltInSamples(2);
              }
            } else {
              const parseOldSyntax = beforeThree;
              const ok = _Song._parseAndConfigureCustomSample(url, customSampleUrls, customSamplePresets, sampleLoadingState, parseOldSyntax);
              if (!ok) {
                continue;
              }
            }
          }
          if (customSampleUrls.length > 0) {
            EditorConfig.customSamples = customSampleUrls;
          }
          if (customSamplePresets.length > 0) {
            const customSamplePresetsMap = toNameMap(customSamplePresets);
            EditorConfig.presetCategories[EditorConfig.presetCategories.length] = {
              name: "Custom Sample Presets",
              presets: customSamplePresetsMap,
              index: EditorConfig.presetCategories.length
            };
          }
        }
        if (this.pluginurl != pluginurl) {
          this.pluginurl = pluginurl;
          if (pluginurl) this.fetchPlugin(pluginurl);
        }
      }
      if (beforeThree && fromBeepBox) {
        for (const channel of this.channels) {
          channel.instruments[0].transition = Config.transitions.dictionary["interrupt"].index;
          channel.instruments[0].effects |= 1 << 10 /* transition */;
        }
        this.channels[3].instruments[0].chipNoise = 0;
      }
      let legacySettingsCache = null;
      if (fromBeepBox && beforeNine || (fromJummBox && beforeFive || beforeFour && fromGoldBox)) {
        legacySettingsCache = [];
        for (let i2 = legacySettingsCache.length; i2 < this.getChannelCount(); i2++) {
          legacySettingsCache[i2] = [];
          for (let j = 0; j < Config.instrumentCountMin; j++) legacySettingsCache[i2][j] = {};
        }
      }
      let legacyGlobalReverb = 0;
      let instrumentChannelIterator = 0;
      let instrumentIndexIterator = -1;
      let command;
      let useSlowerArpSpeed = false;
      let useFastTwoNoteArp = false;
      while (charIndex < compressed.length) switch (command = compressed.charCodeAt(charIndex++)) {
        case 78 /* songTitle */:
          {
            var songNameLength = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
            this.title = decodeURIComponent(compressed.substring(charIndex, charIndex + songNameLength));
            document.title = this.title + " - " + EditorConfig.versionDisplayName;
            charIndex += songNameLength;
          }
          break;
        case 110 /* channelCount */:
          {
            this.pitchChannelCount = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
            this.noiseChannelCount = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
            if (fromBeepBox || fromJummBox && beforeTwo) {
              this.modChannelCount = 0;
            } else {
              this.modChannelCount = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
            }
            this.pitchChannelCount = validateRange(Config.pitchChannelCountMin, Config.pitchChannelCountMax, this.pitchChannelCount);
            this.noiseChannelCount = validateRange(Config.noiseChannelCountMin, Config.noiseChannelCountMax, this.noiseChannelCount);
            this.modChannelCount = validateRange(Config.modChannelCountMin, Config.modChannelCountMax, this.modChannelCount);
            for (let channelIndex = this.channels.length; channelIndex < this.getChannelCount(); channelIndex++) {
              this.channels[channelIndex] = new Channel();
            }
            this.channels.length = this.getChannelCount();
            if (fromBeepBox && beforeNine || (fromJummBox && beforeFive || beforeFour && fromGoldBox)) {
              for (let i2 = legacySettingsCache.length; i2 < this.getChannelCount(); i2++) {
                legacySettingsCache[i2] = [];
                for (let j = 0; j < Config.instrumentCountMin; j++) legacySettingsCache[i2][j] = {};
              }
            }
          }
          break;
        case 115 /* scale */:
          {
            this.scale = clamp(0, Config.scales.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
            if (this.scale == Config.scales["dictionary"]["Custom"].index) {
              for (var i = 1; i < Config.pitchesPerOctave; i++) {
                this.scaleCustom[i] = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] == 1;
              }
            }
            if (fromBeepBox) this.scale = 0;
          }
          break;
        case 107 /* key */:
          {
            if (beforeSeven && fromBeepBox) {
              this.key = clamp(0, Config.keys.length, 11 - base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              this.octave = 0;
            } else if (fromBeepBox || fromJummBox) {
              this.key = clamp(0, Config.keys.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              this.octave = 0;
            } else if (fromGoldBox || beforeThree && fromUltraBox) {
              const rawKeyIndex = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
              const [key, octave] = convertLegacyKeyToKeyAndOctave(rawKeyIndex);
              this.key = key;
              this.octave = octave;
            } else {
              this.key = clamp(0, Config.keys.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              this.octave = clamp(Config.octaveMin, Config.octaveMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + Config.octaveMin);
            }
          }
          break;
        case 108 /* loopStart */:
          {
            if (beforeFive && fromBeepBox) {
              this.loopStart = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
            } else {
              this.loopStart = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
            }
          }
          break;
        case 101 /* loopEnd */:
          {
            if (beforeFive && fromBeepBox) {
              this.loopLength = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
            } else {
              this.loopLength = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
            }
          }
          break;
        case 116 /* tempo */:
          {
            if (beforeFour && fromBeepBox) {
              this.tempo = [95, 120, 151, 190][base64CharCodeToInt[compressed.charCodeAt(charIndex++)]];
            } else if (beforeSeven && fromBeepBox) {
              this.tempo = [88, 95, 103, 111, 120, 130, 140, 151, 163, 176, 190, 206, 222, 240, 259][base64CharCodeToInt[compressed.charCodeAt(charIndex++)]];
            } else {
              this.tempo = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6 | base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
            }
            this.tempo = clamp(Config.tempoMin, Config.tempoMax + 1, this.tempo);
          }
          break;
        case 109 /* reverb */:
          {
            if (beforeNine && fromBeepBox) {
              legacyGlobalReverb = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] * 12;
              legacyGlobalReverb = clamp(0, Config.reverbRange, legacyGlobalReverb);
            } else if (fromJummBox && beforeFive || beforeFour && fromGoldBox) {
              legacyGlobalReverb = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
              legacyGlobalReverb = clamp(0, Config.reverbRange, legacyGlobalReverb);
            } else {
            }
          }
          break;
        case 97 /* beatCount */:
          {
            if (beforeThree && fromBeepBox) {
              this.beatsPerBar = [6, 7, 8, 9, 10][base64CharCodeToInt[compressed.charCodeAt(charIndex++)]];
            } else {
              this.beatsPerBar = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
            }
            this.beatsPerBar = Math.max(Config.beatsPerBarMin, Math.min(Config.beatsPerBarMax, this.beatsPerBar));
          }
          break;
        case 103 /* barCount */:
          {
            const barCount = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
            this.barCount = validateRange(Config.barCountMin, Config.barCountMax, barCount);
            for (let channelIndex = 0; channelIndex < this.getChannelCount(); channelIndex++) {
              for (let bar = this.channels[channelIndex].bars.length; bar < this.barCount; bar++) {
                this.channels[channelIndex].bars[bar] = bar < 4 ? 1 : 0;
              }
              this.channels[channelIndex].bars.length = this.barCount;
            }
          }
          break;
        case 106 /* patternCount */:
          {
            let patternsPerChannel;
            if (beforeEight && fromBeepBox) {
              patternsPerChannel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
            } else {
              patternsPerChannel = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
            }
            this.patternsPerChannel = validateRange(1, Config.barCountMax, patternsPerChannel);
            const channelCount = this.getChannelCount();
            for (let channelIndex = 0; channelIndex < channelCount; channelIndex++) {
              const patterns = this.channels[channelIndex].patterns;
              for (let pattern = patterns.length; pattern < this.patternsPerChannel; pattern++) {
                patterns[pattern] = new Pattern();
              }
              patterns.length = this.patternsPerChannel;
            }
          }
          break;
        case 105 /* instrumentCount */:
          {
            if (beforeNine && fromBeepBox || (fromJummBox && beforeFive || beforeFour && fromGoldBox)) {
              const instrumentsPerChannel = validateRange(Config.instrumentCountMin, Config.patternInstrumentCountMax, base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + Config.instrumentCountMin);
              this.layeredInstruments = false;
              this.patternInstruments = instrumentsPerChannel > 1;
              for (let channelIndex = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                const isNoiseChannel = channelIndex >= this.pitchChannelCount && channelIndex < this.pitchChannelCount + this.noiseChannelCount;
                const isModChannel = channelIndex >= this.pitchChannelCount + this.noiseChannelCount;
                for (let instrumentIndex = this.channels[channelIndex].instruments.length; instrumentIndex < instrumentsPerChannel; instrumentIndex++) {
                  this.channels[channelIndex].instruments[instrumentIndex] = new Instrument(isNoiseChannel, isModChannel);
                }
                this.channels[channelIndex].instruments.length = instrumentsPerChannel;
                if (beforeSix && fromBeepBox) {
                  for (let instrumentIndex = 0; instrumentIndex < instrumentsPerChannel; instrumentIndex++) {
                    this.channels[channelIndex].instruments[instrumentIndex].setTypeAndReset(isNoiseChannel ? 2 /* noise */ : 0 /* chip */, isNoiseChannel, isModChannel);
                  }
                }
                for (let j = legacySettingsCache[channelIndex].length; j < instrumentsPerChannel; j++) {
                  legacySettingsCache[channelIndex][j] = {};
                }
              }
            } else {
              const instrumentsFlagBits = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
              this.layeredInstruments = (instrumentsFlagBits & 1 << 1) != 0;
              this.patternInstruments = (instrumentsFlagBits & 1 << 0) != 0;
              for (let channelIndex = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                let instrumentCount = 1;
                if (this.layeredInstruments || this.patternInstruments) {
                  instrumentCount = validateRange(Config.instrumentCountMin, this.getMaxInstrumentsPerChannel(), base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + Config.instrumentCountMin);
                }
                const channel = this.channels[channelIndex];
                const isNoiseChannel = this.getChannelIsNoise(channelIndex);
                const isModChannel = this.getChannelIsMod(channelIndex);
                for (let i2 = channel.instruments.length; i2 < instrumentCount; i2++) {
                  channel.instruments[i2] = new Instrument(isNoiseChannel, isModChannel);
                }
                channel.instruments.length = instrumentCount;
              }
            }
          }
          break;
        case 114 /* rhythm */:
          {
            if (!fromUltraBox && !fromSlarmoosBox) {
              let newRhythm = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
              this.rhythm = clamp(0, Config.rhythms.length, newRhythm);
              if (fromJummBox && beforeThree || fromBeepBox) {
                if (this.rhythm == Config.rhythms.dictionary["\xF73 (triplets)"].index || this.rhythm == Config.rhythms.dictionary["\xF76"].index) {
                  useSlowerArpSpeed = true;
                }
                if (this.rhythm >= Config.rhythms.dictionary["\xF76"].index) {
                  useFastTwoNoteArp = true;
                }
              }
            } else if (fromSlarmoosBox && beforeFour || fromUltraBox && beforeFive) {
              const rhythmMap = [1, 1, 0, 1, 2, 3, 4, 5];
              this.rhythm = clamp(0, Config.rhythms.length, rhythmMap[base64CharCodeToInt[compressed.charCodeAt(charIndex++)]]);
            } else {
              this.rhythm = clamp(0, Config.rhythms.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
            }
          }
          break;
        case 111 /* channelOctave */:
          {
            if (beforeThree && fromBeepBox) {
              const channelIndex = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
              this.channels[channelIndex].octave = clamp(0, Config.pitchOctaves, base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1);
              if (channelIndex >= this.pitchChannelCount) this.channels[channelIndex].octave = 0;
            } else if (beforeNine && fromBeepBox || (fromJummBox && beforeFive || beforeFour && fromGoldBox)) {
              for (let channelIndex = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                this.channels[channelIndex].octave = clamp(0, Config.pitchOctaves, base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1);
                if (channelIndex >= this.pitchChannelCount) this.channels[channelIndex].octave = 0;
              }
            } else {
              for (let channelIndex = 0; channelIndex < this.pitchChannelCount; channelIndex++) {
                this.channels[channelIndex].octave = clamp(0, Config.pitchOctaves, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              }
              for (let channelIndex = this.pitchChannelCount; channelIndex < this.getChannelCount(); channelIndex++) {
                this.channels[channelIndex].octave = 0;
              }
            }
          }
          break;
        case 84 /* startInstrument */:
          {
            instrumentIndexIterator++;
            if (instrumentIndexIterator >= this.channels[instrumentChannelIterator].instruments.length) {
              instrumentChannelIterator++;
              instrumentIndexIterator = 0;
            }
            validateRange(0, this.channels.length - 1, instrumentChannelIterator);
            const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
            let instrumentType = validateRange(0, 12 /* length */ - 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
            if (fromJummBox && beforeFive || beforeFour && fromGoldBox) {
              if (instrumentType == 7 /* pickedString */ || instrumentType == 8 /* supersaw */) {
                instrumentType += 2;
              }
            } else if (fromJummBox && beforeSix || fromGoldBox && !beforeFour || fromUltraBox && beforeFive) {
              if (instrumentType == 8 /* supersaw */ || instrumentType == 9 /* customChipWave */ || instrumentType == 10 /* mod */) {
                instrumentType += 1;
              }
            }
            instrument.setTypeAndReset(instrumentType, instrumentChannelIterator >= this.pitchChannelCount && instrumentChannelIterator < this.pitchChannelCount + this.noiseChannelCount, instrumentChannelIterator >= this.pitchChannelCount + this.noiseChannelCount);
            if ((beforeSeven && fromBeepBox || beforeTwo && fromJummBox) && (instrumentType == 0 /* chip */ || instrumentType == 9 /* customChipWave */ || instrumentType == 6 /* pwm */)) {
              instrument.aliases = true;
              instrument.distortion = 0;
              instrument.effects |= 1 << 3 /* distortion */;
            }
            if (useSlowerArpSpeed) {
              instrument.arpeggioSpeed = 9;
            }
            if (useFastTwoNoteArp) {
              instrument.fastTwoNoteArp = true;
            }
            if (beforeSeven && fromBeepBox) {
              if (instrument.chord != Config.chords.dictionary["simultaneous"].index) {
                instrument.effects |= 1 << 11 /* chord */;
              }
            }
          }
          break;
        case 117 /* preset */:
          {
            const presetValue = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6 | base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
            this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].preset = presetValue;
            if (fromJummBox && beforeFive || beforeFour && fromGoldBox) {
              if (this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].preset == 7 /* pickedString */) {
                this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].preset = 9 /* customChipWave */;
                this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].type = 9 /* customChipWave */;
              }
            } else if (fromJummBox && beforeSix || fromUltraBox && beforeFive) {
              if (this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].preset == 8 /* supersaw */) {
                this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].preset = 9 /* customChipWave */;
                this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].type = 9 /* customChipWave */;
              }
              if (this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].preset == 10 /* mod */) {
                this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].preset = 11 /* fm6op */;
                this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].type = 11 /* fm6op */;
              }
            }
            if (fromBeepBox && presetValue == EditorConfig.nameToPresetValue("grand piano 1")) {
              this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].preset = EditorConfig.nameToPresetValue("grand piano 3");
            }
          }
          break;
        case 119 /* wave */:
          {
            if (beforeThree && fromBeepBox) {
              const legacyWaves = [1, 2, 3, 4, 5, 6, 7, 8, 0];
              const channelIndex = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
              const instrument = this.channels[channelIndex].instruments[0];
              instrument.chipWave = clamp(0, Config.chipWaves.length, legacyWaves[base64CharCodeToInt[compressed.charCodeAt(charIndex++)]] | 0);
              instrument.convertLegacySettings(legacySettingsCache[channelIndex][0], forceSimpleFilter);
            } else if (beforeSix && fromBeepBox) {
              const legacyWaves = [1, 2, 3, 4, 5, 6, 7, 8, 0];
              for (let channelIndex = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                for (const instrument of this.channels[channelIndex].instruments) {
                  if (channelIndex >= this.pitchChannelCount) {
                    instrument.chipNoise = clamp(0, Config.chipNoises.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                  } else {
                    instrument.chipWave = clamp(0, Config.chipWaves.length, legacyWaves[base64CharCodeToInt[compressed.charCodeAt(charIndex++)]] | 0);
                  }
                }
              }
            } else if (beforeSeven && fromBeepBox) {
              const legacyWaves = [1, 2, 3, 4, 5, 6, 7, 8, 0];
              if (instrumentChannelIterator >= this.pitchChannelCount) {
                this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipNoise = clamp(0, Config.chipNoises.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              } else {
                this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipWave = clamp(0, Config.chipWaves.length, legacyWaves[base64CharCodeToInt[compressed.charCodeAt(charIndex++)]] | 0);
              }
            } else {
              if (this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].type == 2 /* noise */) {
                this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipNoise = clamp(0, Config.chipNoises.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              } else {
                if (fromSlarmoosBox || fromUltraBox) {
                  const chipWaveReal = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                  const chipWaveCounter = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                  if (chipWaveCounter == 3) {
                    this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipWave = clamp(0, Config.chipWaves.length, chipWaveReal + 186);
                  } else if (chipWaveCounter == 2) {
                    this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipWave = clamp(0, Config.chipWaves.length, chipWaveReal + 124);
                  } else if (chipWaveCounter == 1) {
                    this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipWave = clamp(0, Config.chipWaves.length, chipWaveReal + 62);
                  } else {
                    this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipWave = clamp(0, Config.chipWaves.length, chipWaveReal);
                  }
                } else {
                  this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipWave = clamp(0, Config.chipWaves.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
              }
            }
          }
          break;
        case 102 /* eqFilter */:
          {
            if (beforeNine && fromBeepBox || beforeFive && fromJummBox || beforeFour && fromGoldBox) {
              if (beforeSeven && fromBeepBox) {
                const legacyToCutoff = [10, 6, 3, 0, 8, 5, 2];
                const legacyToEnvelope = ["none", "none", "none", "none", "decay 1", "decay 2", "decay 3"];
                if (beforeThree && fromBeepBox) {
                  const channelIndex = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                  const instrument = this.channels[channelIndex].instruments[0];
                  const legacySettings = legacySettingsCache[channelIndex][0];
                  const legacyFilter = [1, 3, 4, 5][clamp(0, legacyToCutoff.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)])];
                  legacySettings.filterCutoff = legacyToCutoff[legacyFilter];
                  legacySettings.filterResonance = 0;
                  legacySettings.filterEnvelope = Config.envelopePresets.dictionary[legacyToEnvelope[legacyFilter]];
                  instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
                } else if (beforeSix && fromBeepBox) {
                  for (let channelIndex = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                    for (let i2 = 0; i2 < this.channels[channelIndex].instruments.length; i2++) {
                      const instrument = this.channels[channelIndex].instruments[i2];
                      const legacySettings = legacySettingsCache[channelIndex][i2];
                      const legacyFilter = clamp(0, legacyToCutoff.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1);
                      if (channelIndex < this.pitchChannelCount) {
                        legacySettings.filterCutoff = legacyToCutoff[legacyFilter];
                        legacySettings.filterResonance = 0;
                        legacySettings.filterEnvelope = Config.envelopePresets.dictionary[legacyToEnvelope[legacyFilter]];
                      } else {
                        legacySettings.filterCutoff = 10;
                        legacySettings.filterResonance = 0;
                        legacySettings.filterEnvelope = Config.envelopePresets.dictionary["none"];
                      }
                      instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
                    }
                  }
                } else {
                  const legacyFilter = clamp(0, legacyToCutoff.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                  const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                  const legacySettings = legacySettingsCache[instrumentChannelIterator][instrumentIndexIterator];
                  legacySettings.filterCutoff = legacyToCutoff[legacyFilter];
                  legacySettings.filterResonance = 0;
                  legacySettings.filterEnvelope = Config.envelopePresets.dictionary[legacyToEnvelope[legacyFilter]];
                  instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
                }
              } else {
                const filterCutoffRange = 11;
                const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                const legacySettings = legacySettingsCache[instrumentChannelIterator][instrumentIndexIterator];
                legacySettings.filterCutoff = clamp(0, filterCutoffRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
              }
            } else {
              const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
              let typeCheck = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
              if (fromBeepBox || typeCheck == 0) {
                instrument.eqFilterType = false;
                if (fromJummBox || fromGoldBox || fromUltraBox || fromSlarmoosBox)
                  typeCheck = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                const originalControlPointCount = typeCheck;
                instrument.eqFilter.controlPointCount = clamp(0, Config.filterMaxPoints + 1, originalControlPointCount);
                for (let i2 = instrument.eqFilter.controlPoints.length; i2 < instrument.eqFilter.controlPointCount; i2++) {
                  instrument.eqFilter.controlPoints[i2] = new FilterControlPoint();
                }
                for (let i2 = 0; i2 < instrument.eqFilter.controlPointCount; i2++) {
                  const point = instrument.eqFilter.controlPoints[i2];
                  point.type = clamp(0, 3 /* length */, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                  point.freq = clamp(0, Config.filterFreqRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                  point.gain = clamp(0, Config.filterGainRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
                for (let i2 = instrument.eqFilter.controlPointCount; i2 < originalControlPointCount; i2++) {
                  charIndex += 3;
                }
                instrument.eqSubFilters[0] = instrument.eqFilter;
                if (fromJummBox && !beforeFive || fromGoldBox && !beforeFour || fromUltraBox || fromSlarmoosBox) {
                  let usingSubFilterBitfield = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6 | base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                  for (let j = 0; j < Config.filterMorphCount - 1; j++) {
                    if (usingSubFilterBitfield & 1 << j) {
                      const originalSubfilterControlPointCount = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                      if (instrument.eqSubFilters[j + 1] == null)
                        instrument.eqSubFilters[j + 1] = new FilterSettings();
                      instrument.eqSubFilters[j + 1].controlPointCount = clamp(0, Config.filterMaxPoints + 1, originalSubfilterControlPointCount);
                      for (let i2 = instrument.eqSubFilters[j + 1].controlPoints.length; i2 < instrument.eqSubFilters[j + 1].controlPointCount; i2++) {
                        instrument.eqSubFilters[j + 1].controlPoints[i2] = new FilterControlPoint();
                      }
                      for (let i2 = 0; i2 < instrument.eqSubFilters[j + 1].controlPointCount; i2++) {
                        const point = instrument.eqSubFilters[j + 1].controlPoints[i2];
                        point.type = clamp(0, 3 /* length */, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        point.freq = clamp(0, Config.filterFreqRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        point.gain = clamp(0, Config.filterGainRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                      }
                      for (let i2 = instrument.eqSubFilters[j + 1].controlPointCount; i2 < originalSubfilterControlPointCount; i2++) {
                        charIndex += 3;
                      }
                    }
                  }
                }
              } else {
                instrument.eqFilterType = true;
                instrument.eqFilterSimpleCut = clamp(0, Config.filterSimpleCutRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                instrument.eqFilterSimplePeak = clamp(0, Config.filterSimplePeakRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              }
            }
          }
          break;
        case 121 /* loopControls */:
          {
            if (fromSlarmoosBox || fromUltraBox) {
              if (beforeThree && fromUltraBox) {
                const sampleLoopInfoEncodedLength = decode32BitNumber(compressed, charIndex);
                charIndex += 6;
                const sampleLoopInfoEncoded = compressed.slice(charIndex, charIndex + sampleLoopInfoEncodedLength);
                charIndex += sampleLoopInfoEncodedLength;
                const sampleLoopInfo = JSON.parse(atob(sampleLoopInfoEncoded));
                for (const entry of sampleLoopInfo) {
                  const channelIndex = entry["channel"];
                  const instrumentIndex = entry["instrument"];
                  const info = entry["info"];
                  const instrument = this.channels[channelIndex].instruments[instrumentIndex];
                  instrument.isUsingAdvancedLoopControls = info["isUsingAdvancedLoopControls"];
                  instrument.chipWaveLoopStart = info["chipWaveLoopStart"];
                  instrument.chipWaveLoopEnd = info["chipWaveLoopEnd"];
                  instrument.chipWaveLoopMode = info["chipWaveLoopMode"];
                  instrument.chipWavePlayBackwards = info["chipWavePlayBackwards"];
                  instrument.chipWaveStartOffset = info["chipWaveStartOffset"];
                }
              } else {
                const encodedLoopMode = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                const isUsingAdvancedLoopControls = Boolean(encodedLoopMode & 1);
                const chipWaveLoopMode = encodedLoopMode >> 1;
                const encodedReleaseMode = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                const chipWavePlayBackwards = Boolean(encodedReleaseMode & 1);
                const chipWaveLoopStart = decode32BitNumber(compressed, charIndex);
                charIndex += 6;
                const chipWaveLoopEnd = decode32BitNumber(compressed, charIndex);
                charIndex += 6;
                const chipWaveStartOffset = decode32BitNumber(compressed, charIndex);
                charIndex += 6;
                const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                instrument.isUsingAdvancedLoopControls = isUsingAdvancedLoopControls;
                instrument.chipWaveLoopStart = chipWaveLoopStart;
                instrument.chipWaveLoopEnd = chipWaveLoopEnd;
                instrument.chipWaveLoopMode = chipWaveLoopMode;
                instrument.chipWavePlayBackwards = chipWavePlayBackwards;
                instrument.chipWaveStartOffset = chipWaveStartOffset;
              }
            } else if (fromGoldBox && !beforeFour && beforeSix) {
              if (document.URL.substring(document.URL.length - 13).toLowerCase() != "legacysamples") {
                if (!willLoadLegacySamplesForOldSongs) {
                  willLoadLegacySamplesForOldSongs = true;
                  Config.willReloadForCustomSamples = true;
                  EditorConfig.customSamples = ["legacySamples"];
                  loadBuiltInSamples(0);
                }
              }
              this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipWave = clamp(0, Config.chipWaves.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 125);
            } else if (beforeNine && fromBeepBox || (fromJummBox && beforeFive || beforeFour && fromGoldBox)) {
              const filterResonanceRange = 8;
              const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
              const legacySettings = legacySettingsCache[instrumentChannelIterator][instrumentIndexIterator];
              legacySettings.filterResonance = clamp(0, filterResonanceRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
            }
          }
          break;
        case 122 /* drumsetEnvelopes */:
          {
            const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
            const pregoldToEnvelope = [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14, 16, 17, 18, 19, 20, 21, 23, 24, 25, 27, 28, 29, 32, 33, 34, 31, 11];
            if (beforeNine && fromBeepBox || beforeFive && fromJummBox || beforeFour && fromGoldBox) {
              if (beforeTwo && fromGoldBox || !fromGoldBox && !fromUltraBox && !fromSlarmoosBox) {
              }
              if (instrument.type == 4 /* drumset */) {
                for (let i2 = 0; i2 < Config.drumCount; i2++) {
                  let aa = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                  if (beforeTwo && fromGoldBox || !fromGoldBox && !fromUltraBox && !fromSlarmoosBox) aa = pregoldToEnvelope[aa];
                  instrument.drumsetEnvelopes[i2] = _Song._envelopeFromLegacyIndex(aa).index;
                }
              } else {
                const legacySettings = legacySettingsCache[instrumentChannelIterator][instrumentIndexIterator];
                let aa = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                if (beforeTwo && fromGoldBox || !fromGoldBox && !fromUltraBox && !fromSlarmoosBox) aa = pregoldToEnvelope[aa];
                legacySettings.filterEnvelope = _Song._envelopeFromLegacyIndex(aa);
                instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
              }
            } else {
              for (let i2 = 0; i2 < Config.drumCount; i2++) {
                let aa = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                if (beforeTwo && fromGoldBox || !fromGoldBox && !fromUltraBox && !fromSlarmoosBox) aa = pregoldToEnvelope[aa];
                if (!fromSlarmoosBox && aa >= 2) aa++;
                instrument.drumsetEnvelopes[i2] = clamp(0, Config.envelopePresets.length, aa);
              }
            }
          }
          break;
        case 87 /* pulseWidth */:
          {
            const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
            instrument.pulseWidth = clamp(0, Config.pulseWidthRange + +fromJummBox + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
            if (fromBeepBox) {
              instrument.pulseWidth = Math.round(Math.pow(0.5, (7 - instrument.pulseWidth) * Config.pulseWidthStepPower) * Config.pulseWidthRange);
            }
            if (beforeNine && fromBeepBox || beforeFive && fromJummBox || beforeFour && fromGoldBox) {
              const pregoldToEnvelope = [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14, 16, 17, 18, 19, 20, 21, 23, 24, 25, 27, 28, 29, 32, 33, 34, 31, 11];
              const legacySettings = legacySettingsCache[instrumentChannelIterator][instrumentIndexIterator];
              let aa = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
              if (beforeTwo && fromGoldBox || !fromGoldBox && !fromUltraBox && !fromSlarmoosBox) aa = pregoldToEnvelope[aa];
              legacySettings.pulseEnvelope = _Song._envelopeFromLegacyIndex(aa);
              instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
            }
            if (fromUltraBox && !beforeFour || fromSlarmoosBox) {
              instrument.decimalOffset = clamp(0, 99 + 1, (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
            }
          }
          break;
        case 73 /* stringSustain */:
          {
            const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
            const sustainValue = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
            instrument.stringSustain = clamp(0, Config.stringSustainRange, sustainValue & 31);
            instrument.stringSustainType = Config.enableAcousticSustain ? clamp(0, 2 /* length */, sustainValue >> 5) : 0 /* bright */;
          }
          break;
        case 100 /* fadeInOut */:
          {
            if (beforeNine && fromBeepBox || (fromJummBox && beforeFive || beforeFour && fromGoldBox)) {
              const legacySettings = [
                { transition: "interrupt", fadeInSeconds: 0, fadeOutTicks: -1 },
                { transition: "normal", fadeInSeconds: 0, fadeOutTicks: -3 },
                { transition: "normal", fadeInSeconds: 0.025, fadeOutTicks: -3 },
                { transition: "slide in pattern", fadeInSeconds: 0.025, fadeOutTicks: -3 },
                { transition: "normal", fadeInSeconds: 0.04, fadeOutTicks: 6 },
                { transition: "normal", fadeInSeconds: 0, fadeOutTicks: 48 },
                { transition: "normal", fadeInSeconds: 0.0125, fadeOutTicks: 72 },
                { transition: "normal", fadeInSeconds: 0.06, fadeOutTicks: 96 },
                { transition: "slide in pattern", fadeInSeconds: 0.025, fadeOutTicks: -3 }
              ];
              if (beforeThree && fromBeepBox) {
                const channelIndex = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                const settings = legacySettings[clamp(0, legacySettings.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)])];
                const instrument = this.channels[channelIndex].instruments[0];
                instrument.fadeIn = SynthMessenger.secondsToFadeInSetting(settings.fadeInSeconds);
                instrument.fadeOut = SynthMessenger.ticksToFadeOutSetting(settings.fadeOutTicks);
                instrument.transition = Config.transitions.dictionary[settings.transition].index;
                if (instrument.transition != Config.transitions.dictionary["normal"].index) {
                  instrument.effects |= 1 << 10 /* transition */;
                }
              } else if (beforeSix && fromBeepBox) {
                for (let channelIndex = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                  for (const instrument of this.channels[channelIndex].instruments) {
                    const settings = legacySettings[clamp(0, legacySettings.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)])];
                    instrument.fadeIn = SynthMessenger.secondsToFadeInSetting(settings.fadeInSeconds);
                    instrument.fadeOut = SynthMessenger.ticksToFadeOutSetting(settings.fadeOutTicks);
                    instrument.transition = Config.transitions.dictionary[settings.transition].index;
                    if (instrument.transition != Config.transitions.dictionary["normal"].index) {
                      instrument.effects |= 1 << 10 /* transition */;
                    }
                  }
                }
              } else if (beforeFour && !fromGoldBox && !fromUltraBox && !fromSlarmoosBox || fromBeepBox) {
                const settings = legacySettings[clamp(0, legacySettings.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)])];
                const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                instrument.fadeIn = SynthMessenger.secondsToFadeInSetting(settings.fadeInSeconds);
                instrument.fadeOut = SynthMessenger.ticksToFadeOutSetting(settings.fadeOutTicks);
                instrument.transition = Config.transitions.dictionary[settings.transition].index;
                if (instrument.transition != Config.transitions.dictionary["normal"].index) {
                  instrument.effects |= 1 << 10 /* transition */;
                }
              } else {
                const settings = legacySettings[clamp(0, legacySettings.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)])];
                const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                instrument.fadeIn = SynthMessenger.secondsToFadeInSetting(settings.fadeInSeconds);
                instrument.fadeOut = SynthMessenger.ticksToFadeOutSetting(settings.fadeOutTicks);
                instrument.transition = Config.transitions.dictionary[settings.transition].index;
                if (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] > 0) {
                  instrument.legacyTieOver = true;
                }
                instrument.clicklessTransition = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] ? true : false;
                if (instrument.transition != Config.transitions.dictionary["normal"].index || instrument.clicklessTransition) {
                  instrument.effects |= 1 << 10 /* transition */;
                }
              }
            } else {
              const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
              instrument.fadeIn = clamp(0, Config.fadeInRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              instrument.fadeOut = clamp(0, Config.fadeOutTicks.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              if (fromJummBox || fromGoldBox || fromUltraBox || fromSlarmoosBox)
                instrument.clicklessTransition = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] ? true : false;
            }
          }
          break;
        case 99 /* songEq */:
          {
            if (beforeNine && fromBeepBox || (fromJummBox && beforeFive || beforeFour && fromGoldBox)) {
              if (beforeSeven && fromBeepBox) {
                if (beforeThree && fromBeepBox) {
                  const legacyEffects = [0, 3, 2, 0];
                  const legacyEnvelopes = ["none", "none", "none", "tremolo2"];
                  const channelIndex = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                  const effect = clamp(0, legacyEffects.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                  const instrument = this.channels[channelIndex].instruments[0];
                  const legacySettings = legacySettingsCache[channelIndex][0];
                  instrument.vibrato = legacyEffects[effect];
                  if (legacySettings.filterEnvelope == void 0 || legacySettings.filterEnvelope.type == 0 /* none */) {
                    legacySettings.filterEnvelope = Config.envelopePresets.dictionary[legacyEnvelopes[effect]];
                    instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
                  }
                  if (instrument.vibrato != Config.vibratos.dictionary["none"].index) {
                    instrument.effects |= 1 << 9 /* vibrato */;
                  }
                } else if (beforeSix && fromBeepBox) {
                  const legacyEffects = [0, 1, 2, 3, 0, 0];
                  const legacyEnvelopes = ["none", "none", "none", "none", "tremolo5", "tremolo2"];
                  for (let channelIndex = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                    for (let i2 = 0; i2 < this.channels[channelIndex].instruments.length; i2++) {
                      const effect = clamp(0, legacyEffects.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                      const instrument = this.channels[channelIndex].instruments[i2];
                      const legacySettings = legacySettingsCache[channelIndex][i2];
                      instrument.vibrato = legacyEffects[effect];
                      if (legacySettings.filterEnvelope == void 0 || legacySettings.filterEnvelope.type == 0 /* none */) {
                        legacySettings.filterEnvelope = Config.envelopePresets.dictionary[legacyEnvelopes[effect]];
                        instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
                      }
                      if (instrument.vibrato != Config.vibratos.dictionary["none"].index) {
                        instrument.effects |= 1 << 9 /* vibrato */;
                      }
                      if ((legacyGlobalReverb != 0 || (fromJummBox && beforeFive || beforeFour && fromGoldBox)) && !this.getChannelIsNoise(channelIndex)) {
                        instrument.effects |= 1 << 0 /* reverb */;
                        instrument.reverb = legacyGlobalReverb;
                      }
                    }
                  }
                } else {
                  const legacyEffects = [0, 1, 2, 3, 0, 0];
                  const legacyEnvelopes = ["none", "none", "none", "none", "tremolo5", "tremolo2"];
                  const effect = clamp(0, legacyEffects.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                  const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                  const legacySettings = legacySettingsCache[instrumentChannelIterator][instrumentIndexIterator];
                  instrument.vibrato = legacyEffects[effect];
                  if (legacySettings.filterEnvelope == void 0 || legacySettings.filterEnvelope.type == 0 /* none */) {
                    legacySettings.filterEnvelope = Config.envelopePresets.dictionary[legacyEnvelopes[effect]];
                    instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
                  }
                  if (instrument.vibrato != Config.vibratos.dictionary["none"].index) {
                    instrument.effects |= 1 << 9 /* vibrato */;
                  }
                  if (legacyGlobalReverb != 0 || (fromJummBox && beforeFive || beforeFour && fromGoldBox)) {
                    instrument.effects |= 1 << 0 /* reverb */;
                    instrument.reverb = legacyGlobalReverb;
                  }
                }
              } else {
                const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                const vibrato = clamp(0, Config.vibratos.length + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                instrument.vibrato = vibrato;
                if (instrument.vibrato != Config.vibratos.dictionary["none"].index) {
                  instrument.effects |= 1 << 9 /* vibrato */;
                }
                if (vibrato == Config.vibratos.length) {
                  instrument.vibratoDepth = clamp(0, Config.modulators.dictionary["vibrato depth"].maxRawVol + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]) / 50;
                  instrument.vibratoSpeed = clamp(0, Config.modulators.dictionary["vibrato speed"].maxRawVol + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                  instrument.vibratoDelay = clamp(0, Config.modulators.dictionary["vibrato delay"].maxRawVol + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]) / 2;
                  instrument.vibratoType = clamp(0, Config.vibratoTypes.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                  instrument.effects |= 1 << 9 /* vibrato */;
                } else {
                  instrument.vibratoDepth = Config.vibratos[instrument.vibrato].amplitude;
                  instrument.vibratoSpeed = 10;
                  instrument.vibratoDelay = Config.vibratos[instrument.vibrato].delayTicks / 2;
                  instrument.vibratoType = Config.vibratos[instrument.vibrato].type;
                }
              }
            } else {
              if (fromSlarmoosBox && !beforeFour) {
                const originalControlPointCount = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                this.eqFilter.controlPointCount = clamp(0, Config.filterMaxPoints + 1, originalControlPointCount);
                for (let i2 = this.eqFilter.controlPoints.length; i2 < this.eqFilter.controlPointCount; i2++) {
                  this.eqFilter.controlPoints[i2] = new FilterControlPoint();
                }
                for (let i2 = 0; i2 < this.eqFilter.controlPointCount; i2++) {
                  const point = this.eqFilter.controlPoints[i2];
                  point.type = clamp(0, 3 /* length */, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                  point.freq = clamp(0, Config.filterFreqRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                  point.gain = clamp(0, Config.filterGainRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
                for (let i2 = this.eqFilter.controlPointCount; i2 < originalControlPointCount; i2++) {
                  charIndex += 3;
                }
                this.eqSubFilters[0] = this.eqFilter;
                let usingSubFilterBitfield = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6 | base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                for (let j = 0; j < Config.filterMorphCount - 1; j++) {
                  if (usingSubFilterBitfield & 1 << j) {
                    const originalSubfilterControlPointCount = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    if (this.eqSubFilters[j + 1] == null)
                      this.eqSubFilters[j + 1] = new FilterSettings();
                    this.eqSubFilters[j + 1].controlPointCount = clamp(0, Config.filterMaxPoints + 1, originalSubfilterControlPointCount);
                    for (let i2 = this.eqSubFilters[j + 1].controlPoints.length; i2 < this.eqSubFilters[j + 1].controlPointCount; i2++) {
                      this.eqSubFilters[j + 1].controlPoints[i2] = new FilterControlPoint();
                    }
                    for (let i2 = 0; i2 < this.eqSubFilters[j + 1].controlPointCount; i2++) {
                      const point = this.eqSubFilters[j + 1].controlPoints[i2];
                      point.type = clamp(0, 3 /* length */, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                      point.freq = clamp(0, Config.filterFreqRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                      point.gain = clamp(0, Config.filterGainRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                    for (let i2 = this.eqSubFilters[j + 1].controlPointCount; i2 < originalSubfilterControlPointCount; i2++) {
                      charIndex += 3;
                    }
                  }
                }
              }
            }
          }
          break;
        case 71 /* arpeggioSpeed */:
          {
            if (fromJummBox && beforeFive || beforeFour && fromGoldBox) {
              const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
              instrument.arpeggioSpeed = clamp(0, Config.modulators.dictionary["arp speed"].maxRawVol + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              instrument.fastTwoNoteArp = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] ? true : false;
            } else {
            }
          }
          break;
        case 104 /* unison */:
          {
            if (beforeThree && fromBeepBox) {
              const channelIndex = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
              const instrument = this.channels[channelIndex].instruments[0];
              instrument.unison = clamp(0, Config.unisons.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              instrument.unisonVoices = Config.unisons[instrument.unison].voices;
              instrument.unisonSpread = Config.unisons[instrument.unison].spread;
              instrument.unisonOffset = Config.unisons[instrument.unison].offset;
              instrument.unisonExpression = Config.unisons[instrument.unison].expression;
              instrument.unisonSign = Config.unisons[instrument.unison].sign;
            } else if (beforeSix && fromBeepBox) {
              for (let channelIndex = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                for (const instrument of this.channels[channelIndex].instruments) {
                  const originalValue = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                  let unison = clamp(0, Config.unisons.length, originalValue);
                  if (originalValue == 8) {
                    unison = 2;
                    instrument.chord = 3;
                  }
                  instrument.unison = unison;
                  instrument.unisonVoices = Config.unisons[instrument.unison].voices;
                  instrument.unisonSpread = Config.unisons[instrument.unison].spread;
                  instrument.unisonOffset = Config.unisons[instrument.unison].offset;
                  instrument.unisonExpression = Config.unisons[instrument.unison].expression;
                  instrument.unisonSign = Config.unisons[instrument.unison].sign;
                }
              }
            } else if (beforeSeven && fromBeepBox) {
              const originalValue = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
              let unison = clamp(0, Config.unisons.length, originalValue);
              const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
              if (originalValue == 8) {
                unison = 2;
                instrument.chord = 3;
              }
              instrument.unison = unison;
              instrument.unisonVoices = Config.unisons[instrument.unison].voices;
              instrument.unisonSpread = Config.unisons[instrument.unison].spread;
              instrument.unisonOffset = Config.unisons[instrument.unison].offset;
              instrument.unisonExpression = Config.unisons[instrument.unison].expression;
              instrument.unisonSign = Config.unisons[instrument.unison].sign;
            } else {
              const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
              instrument.unison = clamp(0, Config.unisons.length + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              const unisonLength = beforeFive || !fromSlarmoosBox ? 27 : Config.unisons.length;
              if ((fromUltraBox && !beforeFive || fromSlarmoosBox) && instrument.unison == unisonLength) {
                instrument.unison = Config.unisons.length;
                instrument.unisonVoices = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                const unisonSpreadNegative = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                const unisonSpread = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + base64CharCodeToInt[compressed.charCodeAt(charIndex++)] * 63) * 63;
                const unisonOffsetNegative = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                const unisonOffset = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + base64CharCodeToInt[compressed.charCodeAt(charIndex++)] * 63) * 63;
                const unisonExpressionNegative = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                const unisonExpression = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + base64CharCodeToInt[compressed.charCodeAt(charIndex++)] * 63;
                const unisonSignNegative = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                const unisonSign = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + base64CharCodeToInt[compressed.charCodeAt(charIndex++)] * 63;
                instrument.unisonSpread = unisonSpread / 1e3;
                if (unisonSpreadNegative == 0) instrument.unisonSpread *= -1;
                instrument.unisonOffset = unisonOffset / 1e3;
                if (unisonOffsetNegative == 0) instrument.unisonOffset *= -1;
                instrument.unisonExpression = unisonExpression / 1e3;
                if (unisonExpressionNegative == 0) instrument.unisonExpression *= -1;
                instrument.unisonSign = unisonSign / 1e3;
                if (unisonSignNegative == 0) instrument.unisonSign *= -1;
              } else {
                instrument.unisonVoices = Config.unisons[instrument.unison].voices;
                instrument.unisonSpread = Config.unisons[instrument.unison].spread;
                instrument.unisonOffset = Config.unisons[instrument.unison].offset;
                instrument.unisonExpression = Config.unisons[instrument.unison].expression;
                instrument.unisonSign = Config.unisons[instrument.unison].sign;
              }
            }
          }
          break;
        case 67 /* chord */:
          {
            if (beforeNine && fromBeepBox || (fromJummBox && beforeFive || beforeFour && fromGoldBox)) {
              const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
              instrument.chord = clamp(0, Config.chords.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              if (instrument.chord != Config.chords.dictionary["simultaneous"].index) {
                instrument.effects |= 1 << 11 /* chord */;
              }
            } else {
            }
          }
          break;
        case 113 /* effects */:
          {
            const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
            if (beforeNine && fromBeepBox || (fromJummBox && beforeFive || beforeFour && fromGoldBox)) {
              instrument.effects = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] & (1 << 16 /* length */) - 1;
              if (legacyGlobalReverb == 0 && !(fromJummBox && beforeFive || beforeFour && fromGoldBox)) {
                instrument.effects &= ~(1 << 0 /* reverb */);
              } else if (effectsIncludeReverb(instrument.effects)) {
                instrument.reverb = legacyGlobalReverb;
              }
              instrument.effects |= 1 << 2 /* panning */;
              if (instrument.vibrato != Config.vibratos.dictionary["none"].index) {
                instrument.effects |= 1 << 9 /* vibrato */;
              }
              if (instrument.detune != Config.detuneCenter) {
                instrument.effects |= 1 << 8 /* detune */;
              }
              if (instrument.aliases)
                instrument.effects |= 1 << 3 /* distortion */;
              else
                instrument.effects &= ~(1 << 3 /* distortion */);
              const legacySettings = legacySettingsCache[instrumentChannelIterator][instrumentIndexIterator];
              instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
            } else {
              if (16 /* length */ > 16) throw new Error();
              if (fromSlarmoosBox && !beforeFive) {
                instrument.effects = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 12 | base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6 | base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
              } else {
                instrument.effects = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6 | base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
              }
              if (effectsIncludeNoteFilter(instrument.effects)) {
                let typeCheck = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                if (fromBeepBox || typeCheck == 0) {
                  instrument.noteFilterType = false;
                  if (fromJummBox || fromGoldBox || fromUltraBox || fromSlarmoosBox)
                    typeCheck = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                  instrument.noteFilter.controlPointCount = clamp(0, Config.filterMaxPoints + 1, typeCheck);
                  for (let i2 = instrument.noteFilter.controlPoints.length; i2 < instrument.noteFilter.controlPointCount; i2++) {
                    instrument.noteFilter.controlPoints[i2] = new FilterControlPoint();
                  }
                  for (let i2 = 0; i2 < instrument.noteFilter.controlPointCount; i2++) {
                    const point = instrument.noteFilter.controlPoints[i2];
                    point.type = clamp(0, 3 /* length */, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    point.freq = clamp(0, Config.filterFreqRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    point.gain = clamp(0, Config.filterGainRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                  }
                  for (let i2 = instrument.noteFilter.controlPointCount; i2 < typeCheck; i2++) {
                    charIndex += 3;
                  }
                  instrument.noteSubFilters[0] = instrument.noteFilter;
                  if (fromJummBox && !beforeFive || fromGoldBox || fromUltraBox || fromSlarmoosBox) {
                    let usingSubFilterBitfield = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6 | base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    for (let j = 0; j < Config.filterMorphCount - 1; j++) {
                      if (usingSubFilterBitfield & 1 << j) {
                        const originalSubfilterControlPointCount = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        if (instrument.noteSubFilters[j + 1] == null)
                          instrument.noteSubFilters[j + 1] = new FilterSettings();
                        instrument.noteSubFilters[j + 1].controlPointCount = clamp(0, Config.filterMaxPoints + 1, originalSubfilterControlPointCount);
                        for (let i2 = instrument.noteSubFilters[j + 1].controlPoints.length; i2 < instrument.noteSubFilters[j + 1].controlPointCount; i2++) {
                          instrument.noteSubFilters[j + 1].controlPoints[i2] = new FilterControlPoint();
                        }
                        for (let i2 = 0; i2 < instrument.noteSubFilters[j + 1].controlPointCount; i2++) {
                          const point = instrument.noteSubFilters[j + 1].controlPoints[i2];
                          point.type = clamp(0, 3 /* length */, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                          point.freq = clamp(0, Config.filterFreqRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                          point.gain = clamp(0, Config.filterGainRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        }
                        for (let i2 = instrument.noteSubFilters[j + 1].controlPointCount; i2 < originalSubfilterControlPointCount; i2++) {
                          charIndex += 3;
                        }
                      }
                    }
                  }
                } else {
                  instrument.noteFilterType = true;
                  instrument.noteFilter.reset();
                  instrument.noteFilterSimpleCut = clamp(0, Config.filterSimpleCutRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                  instrument.noteFilterSimplePeak = clamp(0, Config.filterSimplePeakRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
              }
              if (effectsIncludeTransition(instrument.effects)) {
                instrument.transition = clamp(0, Config.transitions.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              }
              if (effectsIncludeChord(instrument.effects)) {
                instrument.chord = clamp(0, Config.chords.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                if (instrument.chord == Config.chords.dictionary["arpeggio"].index && (fromJummBox || fromGoldBox || fromUltraBox || fromSlarmoosBox)) {
                  instrument.arpeggioSpeed = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                  instrument.fastTwoNoteArp = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] ? true : false;
                }
                if (instrument.chord == Config.chords.dictionary["monophonic"].index && fromSlarmoosBox && !beforeFive) {
                  instrument.monoChordTone = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                }
              }
              if (effectsIncludePitchShift(instrument.effects)) {
                instrument.pitchShift = clamp(0, Config.pitchShiftRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              }
              if (effectsIncludeDetune(instrument.effects)) {
                if (fromBeepBox) {
                  instrument.detune = clamp(Config.detuneMin, Config.detuneMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                  instrument.detune = Math.round((instrument.detune - 9) * (Math.abs(instrument.detune - 9) + 1) / 2 + Config.detuneCenter);
                } else {
                  instrument.detune = clamp(Config.detuneMin, Config.detuneMax + 1, (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
              }
              if (effectsIncludeVibrato(instrument.effects)) {
                instrument.vibrato = clamp(0, Config.vibratos.length + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                if (instrument.vibrato == Config.vibratos.length && (fromJummBox || fromGoldBox || fromUltraBox || fromSlarmoosBox)) {
                  instrument.vibratoDepth = clamp(0, Config.modulators.dictionary["vibrato depth"].maxRawVol + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]) / 25;
                  instrument.vibratoSpeed = clamp(0, Config.modulators.dictionary["vibrato speed"].maxRawVol + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                  instrument.vibratoDelay = clamp(0, Config.modulators.dictionary["vibrato delay"].maxRawVol + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                  instrument.vibratoType = clamp(0, Config.vibratoTypes.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                } else {
                  instrument.vibratoDepth = Config.vibratos[instrument.vibrato].amplitude;
                  instrument.vibratoSpeed = 10;
                  instrument.vibratoDelay = Config.vibratos[instrument.vibrato].delayTicks / 2;
                  instrument.vibratoType = Config.vibratos[instrument.vibrato].type;
                }
              }
              if (effectsIncludeDistortion(instrument.effects)) {
                instrument.distortion = clamp(0, Config.distortionRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                if (fromJummBox && !beforeFive || fromGoldBox || fromUltraBox || fromSlarmoosBox)
                  instrument.aliases = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] ? true : false;
              }
              if (effectsIncludeBitcrusher(instrument.effects)) {
                instrument.bitcrusherFreq = clamp(0, Config.bitcrusherFreqRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                instrument.bitcrusherQuantization = clamp(0, Config.bitcrusherQuantizationRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              }
              if (effectsIncludePanning(instrument.effects)) {
                if (fromBeepBox) {
                  instrument.pan = clamp(0, Config.panMax + 1, Math.round(base64CharCodeToInt[compressed.charCodeAt(charIndex++)] * (Config.panMax / 8)));
                } else {
                  instrument.pan = clamp(0, Config.panMax + 1, (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
                if (fromJummBox && !beforeTwo || fromGoldBox || fromUltraBox || fromSlarmoosBox)
                  instrument.panDelay = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
              }
              if (effectsIncludeChorus(instrument.effects)) {
                if (fromBeepBox) {
                  instrument.chorus = clamp(0, Config.chorusRange / 2 + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]) * 2;
                } else {
                  instrument.chorus = clamp(0, Config.chorusRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
              }
              if (effectsIncludeEcho(instrument.effects)) {
                instrument.echoSustain = clamp(0, Config.echoSustainRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                instrument.echoDelay = clamp(0, Config.echoDelayRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              }
              if (effectsIncludeReverb(instrument.effects)) {
                if (fromBeepBox) {
                  instrument.reverb = clamp(0, Config.reverbRange, Math.round(base64CharCodeToInt[compressed.charCodeAt(charIndex++)] * Config.reverbRange / 3));
                } else {
                  instrument.reverb = clamp(0, Config.reverbRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
              }
              if (effectsIncludeGranular(instrument.effects)) {
                instrument.granular = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                instrument.grainSize = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                instrument.grainAmounts = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                instrument.grainRange = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
              }
              if (effectsIncludeRingModulation(instrument.effects)) {
                instrument.ringModulation = clamp(0, Config.ringModRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                instrument.ringModulationHz = clamp(0, Config.ringModHzRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                instrument.ringModWaveformIndex = clamp(0, Config.operatorWaves.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                instrument.ringModPulseWidth = clamp(0, Config.pulseWidthRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                instrument.ringModHzOffset = clamp(Config.rmHzOffsetMin, Config.rmHzOffsetMax + 1, (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              }
              if (effectsIncludePlugin(instrument.effects)) {
                const pluginValueCount = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                for (let i2 = 0; i2 < pluginValueCount; i2++) {
                  instrument.pluginValues[i2] = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                }
              }
            }
            instrument.effects &= (1 << 16 /* length */) - 1;
          }
          break;
        case 118 /* volume */:
          {
            if (beforeThree && fromBeepBox) {
              const channelIndex = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
              const instrument = this.channels[channelIndex].instruments[0];
              instrument.volume = Math.round(clamp(-Config.volumeRange / 2, 1, -base64CharCodeToInt[compressed.charCodeAt(charIndex++)] * 5));
            } else if (beforeSix && fromBeepBox) {
              for (let channelIndex = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                for (const instrument of this.channels[channelIndex].instruments) {
                  instrument.volume = Math.round(clamp(-Config.volumeRange / 2, 1, -base64CharCodeToInt[compressed.charCodeAt(charIndex++)] * 5));
                }
              }
            } else if (beforeSeven && fromBeepBox) {
              const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
              instrument.volume = Math.round(clamp(-Config.volumeRange / 2, 1, -base64CharCodeToInt[compressed.charCodeAt(charIndex++)] * 5));
            } else if (fromBeepBox) {
              const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
              instrument.volume = Math.round(clamp(-Config.volumeRange / 2, 1, -base64CharCodeToInt[compressed.charCodeAt(charIndex++)] * 25 / 7));
            } else {
              const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
              instrument.volume = Math.round(clamp(-Config.volumeRange / 2, Config.volumeRange / 2 + 1, (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6 | base64CharCodeToInt[compressed.charCodeAt(charIndex++)]) - Config.volumeRange / 2));
            }
          }
          break;
        case 76 /* pan */:
          {
            if (beforeNine && fromBeepBox) {
              const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
              instrument.pan = clamp(0, Config.panMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)] * (Config.panMax / 8));
            } else if (fromJummBox && beforeFive || beforeFour && fromGoldBox) {
              const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
              instrument.pan = clamp(0, Config.panMax + 1, (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              if (fromJummBox && !beforeThree || fromGoldBox || fromUltraBox || fromSlarmoosBox) {
                instrument.panDelay = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
              }
            } else {
            }
          }
          break;
        case 68 /* detune */:
          {
            const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
            if (fromJummBox && beforeFive || beforeFour && fromGoldBox) {
              instrument.detune = clamp(Config.detuneMin, Config.detuneMax + 1, ((base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)]) * 4);
              instrument.effects |= 1 << 8 /* detune */;
            } else {
            }
          }
          break;
        case 77 /* customChipWave */:
          {
            let instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
            for (let j = 0; j < 64; j++) {
              instrument.customChipWave[j] = clamp(-24, 25, base64CharCodeToInt[compressed.charCodeAt(charIndex++)] - 24);
            }
            let sum = 0;
            for (let i2 = 0; i2 < instrument.customChipWave.length; i2++) {
              sum += instrument.customChipWave[i2];
            }
            const average = sum / instrument.customChipWave.length;
            let cumulative = 0;
            let wavePrev = 0;
            for (let i2 = 0; i2 < instrument.customChipWave.length; i2++) {
              cumulative += wavePrev;
              wavePrev = instrument.customChipWave[i2] - average;
              instrument.customChipWaveIntegral[i2] = cumulative;
            }
            instrument.customChipWaveIntegral[64] = 0;
          }
          break;
        case 79 /* limiterSettings */:
          {
            let nextValue = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
            if (nextValue == 63) {
              this.restoreLimiterDefaults();
            } else {
              this.compressionRatio = nextValue < 10 ? nextValue / 10 : 1 + (nextValue - 10) / 60;
              nextValue = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
              this.limitRatio = nextValue < 10 ? nextValue / 10 : nextValue - 9;
              this.limitDecay = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
              this.limitRise = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] * 250 + 2e3;
              this.compressionThreshold = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] / 20;
              this.limitThreshold = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] / 20;
              this.masterGain = ((base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)]) / 50;
            }
          }
          break;
        case 85 /* channelNames */:
          {
            for (let channel = 0; channel < this.getChannelCount(); channel++) {
              var channelNameLength;
              if (beforeFour && !fromGoldBox && !fromUltraBox && !fromSlarmoosBox)
                channelNameLength = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
              else
                channelNameLength = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
              this.channels[channel].name = decodeURIComponent(compressed.substring(charIndex, charIndex + channelNameLength));
              charIndex += channelNameLength;
            }
          }
          break;
        case 65 /* algorithm */:
          {
            const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
            if (instrument.type == 1 /* fm */) {
              instrument.algorithm = clamp(0, Config.algorithms.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
            } else {
              instrument.algorithm6Op = clamp(0, Config.algorithms6Op.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              instrument.customAlgorithm.fromPreset(instrument.algorithm6Op);
              if (compressed.charCodeAt(charIndex) == 67 /* chord */) {
                let carrierCountTemp = clamp(1, Config.operatorCount + 2 + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex + 1)]);
                charIndex++;
                let tempModArray = [];
                if (compressed.charCodeAt(charIndex + 1) == 113 /* effects */) {
                  charIndex++;
                  let j = 0;
                  charIndex++;
                  while (compressed.charCodeAt(charIndex) != 113 /* effects */) {
                    tempModArray[j] = [];
                    let o = 0;
                    while (compressed.charCodeAt(charIndex) != 82 /* operatorWaves */) {
                      tempModArray[j][o] = clamp(1, Config.operatorCount + 3, base64CharCodeToInt[compressed.charCodeAt(charIndex)]);
                      o++;
                      charIndex++;
                    }
                    j++;
                    charIndex++;
                  }
                  instrument.customAlgorithm.set(carrierCountTemp, tempModArray);
                  charIndex++;
                }
              }
            }
            if (beforeNine && fromBeepBox || beforeFive && fromJummBox || beforeFour && fromGoldBox) {
              const legacySettings = legacySettingsCache[instrumentChannelIterator][instrumentIndexIterator];
              instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
            }
          }
          break;
        case 120 /* supersaw */:
          {
            if (fromGoldBox && !beforeFour && beforeSix) {
              const chipWaveForCompat = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
              if (chipWaveForCompat + 62 > 85) {
                if (document.URL.substring(document.URL.length - 13).toLowerCase() != "legacysamples") {
                  if (!willLoadLegacySamplesForOldSongs) {
                    willLoadLegacySamplesForOldSongs = true;
                    Config.willReloadForCustomSamples = true;
                    EditorConfig.customSamples = ["legacySamples"];
                    loadBuiltInSamples(0);
                  }
                }
              }
              if (chipWaveForCompat + 62 > 78) {
                this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipWave = clamp(0, Config.chipWaves.length, chipWaveForCompat + 63);
              } else if (chipWaveForCompat + 62 > 67) {
                this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipWave = clamp(0, Config.chipWaves.length, chipWaveForCompat + 61);
              } else if (chipWaveForCompat + 62 == 67) {
                this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipWave = 40;
              } else {
                this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipWave = clamp(0, Config.chipWaves.length, chipWaveForCompat + 62);
              }
            } else {
              const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
              instrument.supersawDynamism = clamp(0, Config.supersawDynamismMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              instrument.supersawSpread = clamp(0, Config.supersawSpreadMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              instrument.supersawShape = clamp(0, Config.supersawShapeMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
            }
          }
          break;
        case 70 /* feedbackType */:
          {
            const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
            if (instrument.type == 1 /* fm */) {
              instrument.feedbackType = clamp(0, Config.feedbacks.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
            } else {
              instrument.feedbackType6Op = clamp(0, Config.feedbacks6Op.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              instrument.customFeedbackType.fromPreset(instrument.feedbackType6Op);
              let tempModArray = [];
              if (compressed.charCodeAt(charIndex) == 113 /* effects */) {
                let j = 0;
                charIndex++;
                while (compressed.charCodeAt(charIndex) != 113 /* effects */) {
                  tempModArray[j] = [];
                  let o = 0;
                  while (compressed.charCodeAt(charIndex) != 82 /* operatorWaves */) {
                    tempModArray[j][o] = clamp(1, Config.operatorCount + 2, base64CharCodeToInt[compressed.charCodeAt(charIndex)]);
                    o++;
                    charIndex++;
                  }
                  j++;
                  charIndex++;
                }
                instrument.customFeedbackType.set(tempModArray);
                charIndex++;
              }
            }
          }
          break;
        case 66 /* feedbackAmplitude */:
          {
            this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].feedbackAmplitude = clamp(0, Config.operatorAmplitudeMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
          }
          break;
        case 86 /* feedbackEnvelope */:
          {
            if (beforeNine && fromBeepBox || beforeFive && fromJummBox || beforeFour && fromGoldBox) {
              const pregoldToEnvelope = [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14, 16, 17, 18, 19, 20, 21, 23, 24, 25, 27, 28, 29, 32, 33, 34, 31, 11];
              const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
              const legacySettings = legacySettingsCache[instrumentChannelIterator][instrumentIndexIterator];
              let aa = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
              if (beforeTwo && fromGoldBox || !fromGoldBox && !fromUltraBox && !fromSlarmoosBox) aa = pregoldToEnvelope[aa];
              legacySettings.feedbackEnvelope = _Song._envelopeFromLegacyIndex(base64CharCodeToInt[aa]);
              instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
            } else {
            }
          }
          break;
        case 81 /* operatorFrequencies */:
          {
            const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
            if (beforeThree && fromGoldBox) {
              const freqToGold3 = [4, 5, 6, 7, 8, 10, 12, 13, 14, 15, 16, 18, 20, 22, 24, 2, 1, 9, 17, 19, 21, 23, 0, 3];
              for (let o = 0; o < (instrument.type == 11 /* fm6op */ ? 6 : Config.operatorCount); o++) {
                instrument.operators[o].frequency = freqToGold3[clamp(0, freqToGold3.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)])];
              }
            } else if (!fromGoldBox && !fromUltraBox && !fromSlarmoosBox) {
              const freqToUltraBox = [4, 5, 6, 7, 8, 10, 12, 13, 14, 15, 16, 18, 20, 23, 27, 2, 1, 9, 17, 19, 21, 23, 0, 3];
              for (let o = 0; o < (instrument.type == 11 /* fm6op */ ? 6 : Config.operatorCount); o++) {
                instrument.operators[o].frequency = freqToUltraBox[clamp(0, freqToUltraBox.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)])];
              }
            } else {
              for (let o = 0; o < (instrument.type == 11 /* fm6op */ ? 6 : Config.operatorCount); o++) {
                instrument.operators[o].frequency = clamp(0, Config.operatorFrequencies.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              }
            }
          }
          break;
        case 80 /* operatorAmplitudes */:
          {
            const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
            for (let o = 0; o < (instrument.type == 11 /* fm6op */ ? 6 : Config.operatorCount); o++) {
              instrument.operators[o].amplitude = clamp(0, Config.operatorAmplitudeMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
            }
          }
          break;
        case 69 /* envelopes */:
          {
            const pregoldToEnvelope = [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14, 16, 17, 18, 19, 20, 21, 23, 24, 25, 27, 28, 29, 32, 33, 34, 31, 11];
            const jummToUltraEnvelope = [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14, 16, 17, 18, 19, 20, 21, 23, 24, 25, 58, 59, 60];
            const slarURL3toURL4Envelope = [0, 1, 2, 3, 4, 5, 6, 7, 8, 8, 9, 10, 11, 12, 13, 14];
            const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
            if (beforeNine && fromBeepBox || beforeFive && fromJummBox || beforeFour && fromGoldBox) {
              const legacySettings = legacySettingsCache[instrumentChannelIterator][instrumentIndexIterator];
              legacySettings.operatorEnvelopes = [];
              for (let o = 0; o < (instrument.type == 11 /* fm6op */ ? 6 : Config.operatorCount); o++) {
                let aa = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                if (beforeTwo && fromGoldBox || fromBeepBox) aa = pregoldToEnvelope[aa];
                if (fromJummBox) aa = jummToUltraEnvelope[aa];
                legacySettings.operatorEnvelopes[o] = _Song._envelopeFromLegacyIndex(aa);
              }
              instrument.convertLegacySettings(legacySettings, forceSimpleFilter);
            } else {
              const envelopeCount = clamp(0, Config.maxEnvelopeCount + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              let envelopeDiscrete = false;
              if (fromJummBox && !beforeSix || fromUltraBox && !beforeFive || fromSlarmoosBox) {
                instrument.envelopeSpeed = clamp(0, Config.modulators.dictionary["envelope speed"].maxRawVol + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                if (!fromSlarmoosBox || beforeFive) {
                  envelopeDiscrete = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] ? true : false;
                }
              }
              for (let i2 = 0; i2 < envelopeCount; i2++) {
                const target = clamp(0, Config.instrumentAutomationTargets.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                let index = 0;
                const maxCount = Config.instrumentAutomationTargets[target].maxCount;
                if (maxCount > 1) {
                  index = clamp(0, maxCount, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
                let aa = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                if (beforeTwo && fromGoldBox || fromBeepBox) aa = pregoldToEnvelope[aa];
                if (fromJummBox) aa = jummToUltraEnvelope[aa];
                if (!fromSlarmoosBox && aa >= 2) aa++;
                let updatedEnvelopes = false;
                let perEnvelopeSpeed = 1;
                if (!fromSlarmoosBox || beforeThree) {
                  updatedEnvelopes = true;
                  perEnvelopeSpeed = Config.envelopePresets[aa].speed;
                  aa = Config.envelopePresets[aa].type;
                } else if (beforeFour && aa >= 3) aa++;
                let isTremolo2 = false;
                if (fromSlarmoosBox && !beforeThree && beforeFour || updatedEnvelopes) {
                  if (aa == 9) isTremolo2 = true;
                  aa = slarURL3toURL4Envelope[aa];
                }
                const envelope = clamp(0, fromSlarmoosBox && !beforeThree || updatedEnvelopes ? Config.envelopes.length : Config.envelopePresets.length, aa);
                let pitchEnvelopeStart = 0;
                let pitchEnvelopeEnd = Config.maxPitch;
                let envelopeInverse = false;
                perEnvelopeSpeed = fromSlarmoosBox && !beforeThree ? Config.envelopes[envelope].speed : perEnvelopeSpeed;
                let perEnvelopeLowerBound = 0;
                let perEnvelopeUpperBound = 1;
                let steps = 2;
                let seed = 2;
                let waveform = 0 /* sine */;
                if (fromSlarmoosBox && !beforeFour) {
                  if (Config.envelopes[envelope].name == "lfo") {
                    waveform = clamp(0, 7 /* length */, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    if (waveform == 5 /* steppedSaw */ || waveform == 6 /* steppedTri */) {
                      steps = clamp(1, Config.randomEnvelopeStepsMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                  } else if (Config.envelopes[envelope].name == "random") {
                    steps = clamp(1, Config.randomEnvelopeStepsMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    seed = clamp(1, Config.randomEnvelopeSeedMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    waveform = clamp(0, 4 /* length */, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                  }
                }
                if (fromSlarmoosBox && !beforeThree) {
                  if (Config.envelopes[envelope].name == "pitch") {
                    if (!instrument.isNoiseInstrument) {
                      let pitchEnvelopeCompact = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                      pitchEnvelopeStart = clamp(0, Config.maxPitch + 1, pitchEnvelopeCompact * 64 + base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                      pitchEnvelopeCompact = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                      pitchEnvelopeEnd = clamp(0, Config.maxPitch + 1, pitchEnvelopeCompact * 64 + base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    } else {
                      pitchEnvelopeStart = clamp(0, Config.drumCount, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                      pitchEnvelopeEnd = clamp(0, Config.drumCount, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                  }
                  let checkboxValues = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                  if (fromSlarmoosBox && !beforeFive) {
                    envelopeDiscrete = checkboxValues >> 1 == 1 ? true : false;
                  }
                  envelopeInverse = (checkboxValues & 1) == 1 ? true : false;
                  if (Config.envelopes[envelope].name != "pitch" && Config.envelopes[envelope].name != "note size" && Config.envelopes[envelope].name != "punch" && Config.envelopes[envelope].name != "none") {
                    perEnvelopeSpeed = Config.perEnvelopeSpeedIndices[base64CharCodeToInt[compressed.charCodeAt(charIndex++)]];
                  }
                  perEnvelopeLowerBound = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] / 10;
                  perEnvelopeUpperBound = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] / 10;
                }
                if (!fromSlarmoosBox || beforeFour) {
                  if (isTremolo2) {
                    waveform = 0 /* sine */;
                    if (envelopeInverse) {
                      perEnvelopeUpperBound = Math.floor(perEnvelopeUpperBound / 2 * 10) / 10;
                      perEnvelopeLowerBound = Math.floor(perEnvelopeLowerBound / 2 * 10) / 10;
                    } else {
                      perEnvelopeUpperBound = Math.floor((0.5 + (perEnvelopeUpperBound - perEnvelopeLowerBound) / 2) * 10) / 10;
                      perEnvelopeLowerBound = 0.5;
                    }
                  }
                }
                instrument.addEnvelope(target, index, envelope, true, pitchEnvelopeStart, pitchEnvelopeEnd, envelopeInverse, perEnvelopeSpeed, perEnvelopeLowerBound, perEnvelopeUpperBound, steps, seed, waveform, envelopeDiscrete);
                if (fromSlarmoosBox && beforeThree && !beforeTwo) {
                  let pitchEnvelopeCompact = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                  instrument.envelopes[i2].pitchEnvelopeStart = pitchEnvelopeCompact * 64 + base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                  pitchEnvelopeCompact = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                  instrument.envelopes[i2].pitchEnvelopeEnd = pitchEnvelopeCompact * 64 + base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                  instrument.envelopes[i2].inverse = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] == 1 ? true : false;
                }
              }
              let instrumentPitchEnvelopeStart = 0;
              let instrumentPitchEnvelopeEnd = Config.maxPitch;
              let instrumentEnvelopeInverse = false;
              if (fromSlarmoosBox && beforeTwo) {
                let pitchEnvelopeCompact = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                instrumentPitchEnvelopeStart = pitchEnvelopeCompact * 64 + base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                pitchEnvelopeCompact = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                instrumentPitchEnvelopeEnd = pitchEnvelopeCompact * 64 + base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                instrumentEnvelopeInverse = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] === 1 ? true : false;
                for (let i2 = 0; i2 < envelopeCount; i2++) {
                  instrument.envelopes[i2].pitchEnvelopeStart = instrumentPitchEnvelopeStart;
                  instrument.envelopes[i2].pitchEnvelopeEnd = instrumentPitchEnvelopeEnd;
                  instrument.envelopes[i2].inverse = Config.envelopePresets[instrument.envelopes[i2].envelope].name == "pitch" ? instrumentEnvelopeInverse : false;
                }
              }
            }
          }
          break;
        case 82 /* operatorWaves */:
          {
            const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
            if (beforeThree && fromGoldBox) {
              for (let o = 0; o < Config.operatorCount; o++) {
                const pre3To3g = [0, 1, 3, 2, 2, 2, 4, 5];
                const old = clamp(0, pre3To3g.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                if (old == 3) {
                  instrument.operators[o].pulseWidth = 5;
                } else if (old == 4) {
                  instrument.operators[o].pulseWidth = 4;
                } else if (old == 5) {
                  instrument.operators[o].pulseWidth = 6;
                }
                instrument.operators[o].waveform = pre3To3g[old];
              }
            } else {
              for (let o = 0; o < (instrument.type == 11 /* fm6op */ ? 6 : Config.operatorCount); o++) {
                if (fromJummBox) {
                  const jummToG = [0, 1, 3, 2, 4, 5];
                  instrument.operators[o].waveform = jummToG[clamp(0, Config.operatorWaves.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)])];
                } else {
                  instrument.operators[o].waveform = clamp(0, Config.operatorWaves.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
                if (instrument.operators[o].waveform == 2) {
                  instrument.operators[o].pulseWidth = clamp(0, Config.pwmOperatorWaves.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
              }
            }
          }
          break;
        case 83 /* spectrum */:
          {
            const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
            if (instrument.type == 3 /* spectrum */) {
              const byteCount = Math.ceil(Config.spectrumControlPoints * Config.spectrumControlPointBits / 6);
              const bits = new BitFieldReader(compressed, charIndex, charIndex + byteCount);
              for (let i2 = 0; i2 < Config.spectrumControlPoints; i2++) {
                instrument.spectrumWave.spectrum[i2] = bits.read(Config.spectrumControlPointBits);
              }
              instrument.spectrumWave.markCustomWaveDirty();
              charIndex += byteCount;
            } else if (instrument.type == 4 /* drumset */) {
              const byteCount = Math.ceil(Config.drumCount * Config.spectrumControlPoints * Config.spectrumControlPointBits / 6);
              const bits = new BitFieldReader(compressed, charIndex, charIndex + byteCount);
              for (let j = 0; j < Config.drumCount; j++) {
                for (let i2 = 0; i2 < Config.spectrumControlPoints; i2++) {
                  instrument.drumsetSpectrumWaves[j].spectrum[i2] = bits.read(Config.spectrumControlPointBits);
                }
                instrument.drumsetSpectrumWaves[j].markCustomWaveDirty();
              }
              charIndex += byteCount;
            } else {
              throw new Error("Unhandled instrument type for spectrum song tag code.");
            }
          }
          break;
        case 72 /* harmonics */:
          {
            const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
            const byteCount = Math.ceil(Config.harmonicsControlPoints * Config.harmonicsControlPointBits / 6);
            const bits = new BitFieldReader(compressed, charIndex, charIndex + byteCount);
            for (let i2 = 0; i2 < Config.harmonicsControlPoints; i2++) {
              instrument.harmonicsWave.harmonics[i2] = bits.read(Config.harmonicsControlPointBits);
            }
            instrument.harmonicsWave.markCustomWaveDirty();
            charIndex += byteCount;
          }
          break;
        case 88 /* aliases */:
          {
            if (fromJummBox && beforeFive || fromGoldBox && beforeFour) {
              const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
              instrument.aliases = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] ? true : false;
              if (instrument.aliases) {
                instrument.distortion = 0;
                instrument.effects |= 1 << 3 /* distortion */;
              }
            } else {
              if (fromUltraBox || fromSlarmoosBox) {
                const instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                instrument.decimalOffset = clamp(0, 50 + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              }
            }
          }
          break;
        case 98 /* bars */:
          {
            let subStringLength;
            if (beforeThree && fromBeepBox) {
              const channelIndex = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
              const barCount = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
              subStringLength = Math.ceil(barCount * 0.5);
              const bits = new BitFieldReader(compressed, charIndex, charIndex + subStringLength);
              for (let i2 = 0; i2 < barCount; i2++) {
                this.channels[channelIndex].bars[i2] = bits.read(3) + 1;
              }
            } else if (beforeFive && fromBeepBox) {
              let neededBits = 0;
              while (1 << neededBits < this.patternsPerChannel) neededBits++;
              subStringLength = Math.ceil(this.getChannelCount() * this.barCount * neededBits / 6);
              const bits = new BitFieldReader(compressed, charIndex, charIndex + subStringLength);
              for (let channelIndex = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                for (let i2 = 0; i2 < this.barCount; i2++) {
                  this.channels[channelIndex].bars[i2] = bits.read(neededBits) + 1;
                }
              }
            } else {
              let neededBits = 0;
              while (1 << neededBits < this.patternsPerChannel + 1) neededBits++;
              subStringLength = Math.ceil(this.getChannelCount() * this.barCount * neededBits / 6);
              const bits = new BitFieldReader(compressed, charIndex, charIndex + subStringLength);
              for (let channelIndex = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                for (let i2 = 0; i2 < this.barCount; i2++) {
                  this.channels[channelIndex].bars[i2] = bits.read(neededBits);
                }
              }
            }
            charIndex += subStringLength;
          }
          break;
        case 112 /* patterns */:
          {
            let bitStringLength = 0;
            let channelIndex;
            let largerChords = !(beforeFour && fromJummBox || fromBeepBox);
            let recentPitchBitLength = largerChords ? 4 : 3;
            let recentPitchLength = largerChords ? 16 : 8;
            if (beforeThree && fromBeepBox) {
              channelIndex = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
              charIndex++;
              bitStringLength = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
              bitStringLength = bitStringLength << 6;
              bitStringLength += base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
            } else {
              channelIndex = 0;
              let bitStringLengthLength = validateRange(1, 4, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
              while (bitStringLengthLength > 0) {
                bitStringLength = bitStringLength << 6;
                bitStringLength += base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                bitStringLengthLength--;
              }
            }
            const bits = new BitFieldReader(compressed, charIndex, charIndex + bitStringLength);
            charIndex += bitStringLength;
            const bitsPerNoteSize = _Song.getNeededBits(Config.noteSizeMax);
            let songReverbChannel = -1;
            let songReverbInstrument = -1;
            let songReverbIndex = -1;
            const shouldCorrectTempoMods = fromJummBox;
            const jummboxTempoMin = 30;
            while (true) {
              const channel = this.channels[channelIndex];
              const isNoiseChannel = this.getChannelIsNoise(channelIndex);
              const isModChannel = this.getChannelIsMod(channelIndex);
              const maxInstrumentsPerPattern = this.getMaxInstrumentsPerPattern(channelIndex);
              const neededInstrumentCountBits = _Song.getNeededBits(maxInstrumentsPerPattern - Config.instrumentCountMin);
              const neededInstrumentIndexBits = _Song.getNeededBits(channel.instruments.length - 1);
              if (isModChannel) {
                let jumfive = beforeFive && fromJummBox || beforeFour && fromGoldBox;
                const neededModInstrumentIndexBits = jumfive ? neededInstrumentIndexBits : _Song.getNeededBits(this.getMaxInstrumentsPerChannel() + 2);
                for (let instrumentIndex = 0; instrumentIndex < channel.instruments.length; instrumentIndex++) {
                  let instrument = channel.instruments[instrumentIndex];
                  for (let mod = 0; mod < Config.modCount; mod++) {
                    let status = bits.read(2);
                    switch (status) {
                      case 0:
                        instrument.modChannels[mod] = clamp(0, this.pitchChannelCount + this.noiseChannelCount + 1, bits.read(8));
                        instrument.modInstruments[mod] = clamp(0, this.channels[instrument.modChannels[mod]].instruments.length + 2, bits.read(neededModInstrumentIndexBits));
                        break;
                      case 1:
                        instrument.modChannels[mod] = this.pitchChannelCount + clamp(0, this.noiseChannelCount + 1, bits.read(8));
                        instrument.modInstruments[mod] = clamp(0, this.channels[instrument.modChannels[mod]].instruments.length + 2, bits.read(neededInstrumentIndexBits));
                        break;
                      case 2:
                        instrument.modChannels[mod] = -1;
                        break;
                      case 3:
                        instrument.modChannels[mod] = -2;
                        break;
                    }
                    if (status != 3) {
                      instrument.modulators[mod] = bits.read(6);
                    }
                    if (!jumfive && (Config.modulators[instrument.modulators[mod]].name == "eq filter" || Config.modulators[instrument.modulators[mod]].name == "note filter" || Config.modulators[instrument.modulators[mod]].name == "song eq")) {
                      instrument.modFilterTypes[mod] = bits.read(6);
                    }
                    if (Config.modulators[instrument.modulators[mod]].name == "individual envelope speed" || Config.modulators[instrument.modulators[mod]].name == "reset envelope" || Config.modulators[instrument.modulators[mod]].name == "individual envelope lower bound" || Config.modulators[instrument.modulators[mod]].name == "individual envelope upper bound") {
                      instrument.modEnvelopeNumbers[mod] = bits.read(6);
                    }
                    if (jumfive && instrument.modChannels[mod] >= 0) {
                      let forNoteFilter = effectsIncludeNoteFilter(this.channels[instrument.modChannels[mod]].instruments[instrument.modInstruments[mod]].effects);
                      if (instrument.modulators[mod] == 7) {
                        if (forNoteFilter) {
                          instrument.modulators[mod] = Config.modulators.dictionary["note filt cut"].index;
                        } else {
                          instrument.modulators[mod] = Config.modulators.dictionary["eq filt cut"].index;
                        }
                        instrument.modFilterTypes[mod] = 1;
                      } else if (instrument.modulators[mod] == 8) {
                        if (forNoteFilter) {
                          instrument.modulators[mod] = Config.modulators.dictionary["note filt peak"].index;
                        } else {
                          instrument.modulators[mod] = Config.modulators.dictionary["eq filt peak"].index;
                        }
                        instrument.modFilterTypes[mod] = 2;
                      }
                    } else if (jumfive) {
                      if (instrument.modulators[mod] == Config.modulators.dictionary["song reverb"].index) {
                        songReverbChannel = channelIndex;
                        songReverbInstrument = instrumentIndex;
                        songReverbIndex = mod;
                      }
                    }
                    if (jumfive && Config.modulators[instrument.modulators[mod]].associatedEffect != 16 /* length */) {
                      this.channels[instrument.modChannels[mod]].instruments[instrument.modInstruments[mod]].effects |= 1 << Config.modulators[instrument.modulators[mod]].associatedEffect;
                    }
                  }
                }
              }
              const detuneScaleNotes = [];
              for (let j = 0; j < channel.instruments.length; j++) {
                detuneScaleNotes[j] = [];
                for (let i2 = 0; i2 < Config.modCount; i2++) {
                  detuneScaleNotes[j][Config.modCount - 1 - i2] = 1 + 3 * +((beforeFive && fromJummBox || beforeFour && fromGoldBox) && isModChannel && channel.instruments[j].modulators[i2] == Config.modulators.dictionary["detune"].index);
                }
              }
              const octaveOffset = isNoiseChannel || isModChannel ? 0 : channel.octave * 12;
              let lastPitch = isNoiseChannel || isModChannel ? 4 : octaveOffset;
              const recentPitches = isModChannel ? [0, 1, 2, 3, 4, 5] : isNoiseChannel ? [4, 6, 7, 2, 3, 8, 0, 10] : [0, 7, 12, 19, 24, -5, -12];
              const recentShapes = [];
              for (let i2 = 0; i2 < recentPitches.length; i2++) {
                recentPitches[i2] += octaveOffset;
              }
              for (let i2 = 0; i2 < this.patternsPerChannel; i2++) {
                const newPattern = channel.patterns[i2];
                if (beforeNine && fromBeepBox || beforeFive && fromJummBox || beforeFour && fromGoldBox) {
                  newPattern.instruments[0] = validateRange(0, channel.instruments.length - 1, bits.read(neededInstrumentIndexBits));
                  newPattern.instruments.length = 1;
                } else {
                  if (this.patternInstruments) {
                    const instrumentCount = validateRange(Config.instrumentCountMin, maxInstrumentsPerPattern, bits.read(neededInstrumentCountBits) + Config.instrumentCountMin);
                    for (let j = 0; j < instrumentCount; j++) {
                      newPattern.instruments[j] = validateRange(0, channel.instruments.length - 1 + +isModChannel * 2, bits.read(neededInstrumentIndexBits));
                    }
                    newPattern.instruments.length = instrumentCount;
                  } else {
                    newPattern.instruments[0] = 0;
                    newPattern.instruments.length = Config.instrumentCountMin;
                  }
                }
                if (!(fromBeepBox && beforeThree) && bits.read(1) == 0) {
                  newPattern.notes.length = 0;
                  continue;
                }
                let curPart = 0;
                const newNotes = newPattern.notes;
                let noteCount = 0;
                while (curPart < this.beatsPerBar * Config.partsPerBeat + +isModChannel) {
                  const useOldShape = bits.read(1) == 1;
                  let newNote = false;
                  let shapeIndex = 0;
                  if (useOldShape) {
                    shapeIndex = validateRange(0, recentShapes.length - 1, bits.readLongTail(0, 0));
                  } else {
                    newNote = bits.read(1) == 1;
                  }
                  if (!useOldShape && !newNote) {
                    if (isModChannel) {
                      const isBackwards = bits.read(1) == 1;
                      const restLength = bits.readPartDuration();
                      if (isBackwards) {
                        curPart -= restLength;
                      } else {
                        curPart += restLength;
                      }
                    } else {
                      const restLength = beforeSeven && fromBeepBox ? bits.readLegacyPartDuration() * Config.partsPerBeat / Config.rhythms[this.rhythm].stepsPerBeat : bits.readPartDuration();
                      curPart += restLength;
                    }
                  } else {
                    let shape;
                    if (useOldShape) {
                      shape = recentShapes[shapeIndex];
                      recentShapes.splice(shapeIndex, 1);
                    } else {
                      shape = {};
                      if (!largerChords) {
                        shape.pitchCount = 1;
                        while (shape.pitchCount < 4 && bits.read(1) == 1) shape.pitchCount++;
                      } else {
                        if (bits.read(1) == 1) {
                          shape.pitchCount = bits.read(3) + 2;
                        } else {
                          shape.pitchCount = 1;
                        }
                      }
                      shape.pinCount = bits.readPinCount();
                      if (fromBeepBox) {
                        shape.initialSize = bits.read(2) * 2;
                      } else if (!isModChannel) {
                        shape.initialSize = bits.read(bitsPerNoteSize);
                      } else {
                        shape.initialSize = bits.read(9);
                      }
                      shape.pins = [];
                      shape.length = 0;
                      shape.bendCount = 0;
                      for (let j = 0; j < shape.pinCount; j++) {
                        let pinObj = {};
                        pinObj.pitchBend = bits.read(1) == 1;
                        if (pinObj.pitchBend) shape.bendCount++;
                        shape.length += beforeSeven && fromBeepBox ? bits.readLegacyPartDuration() * Config.partsPerBeat / Config.rhythms[this.rhythm].stepsPerBeat : bits.readPartDuration();
                        pinObj.time = shape.length;
                        if (fromBeepBox) {
                          pinObj.size = bits.read(2) * 2;
                        } else if (!isModChannel) {
                          pinObj.size = bits.read(bitsPerNoteSize);
                        } else {
                          pinObj.size = bits.read(9);
                        }
                        shape.pins.push(pinObj);
                      }
                    }
                    recentShapes.unshift(shape);
                    if (recentShapes.length > 10) recentShapes.pop();
                    let note;
                    if (newNotes.length <= noteCount) {
                      note = new Note(0, curPart, curPart + shape.length, shape.initialSize);
                      newNotes[noteCount++] = note;
                    } else {
                      note = newNotes[noteCount++];
                      note.start = curPart;
                      note.end = curPart + shape.length;
                      note.pins[0].size = shape.initialSize;
                    }
                    let pitch;
                    let pitchCount = 0;
                    const pitchBends = [];
                    for (let j = 0; j < shape.pitchCount + shape.bendCount; j++) {
                      const useOldPitch = bits.read(1) == 1;
                      if (!useOldPitch) {
                        const interval = bits.readPitchInterval();
                        pitch = lastPitch;
                        let intervalIter = interval;
                        while (intervalIter > 0) {
                          pitch++;
                          while (recentPitches.indexOf(pitch) != -1) pitch++;
                          intervalIter--;
                        }
                        while (intervalIter < 0) {
                          pitch--;
                          while (recentPitches.indexOf(pitch) != -1) pitch--;
                          intervalIter++;
                        }
                      } else {
                        const pitchIndex = validateRange(0, recentPitches.length - 1, bits.read(recentPitchBitLength));
                        pitch = recentPitches[pitchIndex];
                        recentPitches.splice(pitchIndex, 1);
                      }
                      recentPitches.unshift(pitch);
                      if (recentPitches.length > recentPitchLength) recentPitches.pop();
                      if (j < shape.pitchCount) {
                        note.pitches[pitchCount++] = pitch;
                      } else {
                        pitchBends.push(pitch);
                      }
                      if (j == shape.pitchCount - 1) {
                        lastPitch = note.pitches[0];
                      } else {
                        lastPitch = pitch;
                      }
                    }
                    note.pitches.length = pitchCount;
                    pitchBends.unshift(note.pitches[0]);
                    const noteIsForTempoMod = isModChannel && channel.instruments[newPattern.instruments[0]].modulators[Config.modCount - 1 - note.pitches[0]] === Config.modulators.dictionary["tempo"].index;
                    let tempoOffset = 0;
                    if (shouldCorrectTempoMods && noteIsForTempoMod) {
                      tempoOffset = jummboxTempoMin - Config.tempoMin;
                    }
                    if (isModChannel) {
                      note.pins[0].size += tempoOffset;
                      note.pins[0].size *= detuneScaleNotes[newPattern.instruments[0]][note.pitches[0]];
                    }
                    let pinCount = 1;
                    for (const pinObj of shape.pins) {
                      if (pinObj.pitchBend) pitchBends.shift();
                      const interval = pitchBends[0] - note.pitches[0];
                      if (note.pins.length <= pinCount) {
                        if (isModChannel) {
                          note.pins[pinCount++] = makeNotePin(interval, pinObj.time, pinObj.size * detuneScaleNotes[newPattern.instruments[0]][note.pitches[0]] + tempoOffset);
                        } else {
                          note.pins[pinCount++] = makeNotePin(interval, pinObj.time, pinObj.size);
                        }
                      } else {
                        const pin = note.pins[pinCount++];
                        pin.interval = interval;
                        pin.time = pinObj.time;
                        if (isModChannel) {
                          pin.size = pinObj.size * detuneScaleNotes[newPattern.instruments[0]][note.pitches[0]] + tempoOffset;
                        } else {
                          pin.size = pinObj.size;
                        }
                      }
                    }
                    note.pins.length = pinCount;
                    if (note.start == 0) {
                      if (!(beforeNine && fromBeepBox || beforeFive && fromJummBox || beforeFour && fromGoldBox)) {
                        note.continuesLastPattern = bits.read(1) == 1;
                      } else {
                        if (beforeFour && !fromUltraBox && !fromSlarmoosBox || fromBeepBox) {
                          note.continuesLastPattern = false;
                        } else {
                          note.continuesLastPattern = channel.instruments[newPattern.instruments[0]].legacyTieOver;
                        }
                      }
                    }
                    curPart = validateRange(0, this.beatsPerBar * Config.partsPerBeat, note.end);
                  }
                }
                newNotes.length = noteCount;
              }
              if (beforeThree && fromBeepBox) {
                break;
              } else {
                channelIndex++;
                if (channelIndex >= this.getChannelCount()) break;
              }
            }
            if ((fromJummBox && beforeFive || beforeFour && fromGoldBox) && songReverbIndex >= 0) {
              for (let channelIndex2 = 0; channelIndex2 < this.channels.length; channelIndex2++) {
                for (let instrumentIndex = 0; instrumentIndex < this.channels[channelIndex2].instruments.length; instrumentIndex++) {
                  const instrument = this.channels[channelIndex2].instruments[instrumentIndex];
                  if (effectsIncludeReverb(instrument.effects)) {
                    instrument.reverb = Config.reverbRange - 1;
                  }
                  if (songReverbChannel == channelIndex2 && songReverbInstrument == instrumentIndex) {
                    const patternIndex = this.channels[channelIndex2].bars[0];
                    if (patternIndex > 0) {
                      const pattern = this.channels[channelIndex2].patterns[patternIndex - 1];
                      let lowestPart = 6;
                      for (const note of pattern.notes) {
                        if (note.pitches[0] == Config.modCount - 1 - songReverbIndex) {
                          lowestPart = Math.min(lowestPart, note.start);
                        }
                      }
                      if (lowestPart > 0) {
                        pattern.notes.push(new Note(Config.modCount - 1 - songReverbIndex, 0, lowestPart, legacyGlobalReverb));
                      }
                    } else {
                      if (this.channels[channelIndex2].patterns.length < Config.barCountMax) {
                        const pattern = new Pattern();
                        this.channels[channelIndex2].patterns.push(pattern);
                        this.channels[channelIndex2].bars[0] = this.channels[channelIndex2].patterns.length;
                        if (this.channels[channelIndex2].patterns.length > this.patternsPerChannel) {
                          for (let chn = 0; chn < this.channels.length; chn++) {
                            if (this.channels[chn].patterns.length <= this.patternsPerChannel) {
                              this.channels[chn].patterns.push(new Pattern());
                            }
                          }
                          this.patternsPerChannel++;
                        }
                        pattern.instruments.length = 1;
                        pattern.instruments[0] = songReverbInstrument;
                        pattern.notes.length = 0;
                        pattern.notes.push(new Note(Config.modCount - 1 - songReverbIndex, 0, 6, legacyGlobalReverb));
                      }
                    }
                  }
                }
              }
            }
          }
          break;
        default:
          {
            throw new Error("Unrecognized song tag code " + String.fromCharCode(command) + " at index " + (charIndex - 1) + " " + compressed.substring(
              /*charIndex - 2*/
              0,
              charIndex
            ));
          }
          break;
      }
      if (Config.willReloadForCustomSamples) {
        window.location.hash = this.toBase64String();
        setTimeout(() => {
          location.reload();
        }, 50);
      }
    }
    fetchPlugin(pluginurl) {
      if (pluginurl != null) {
        fetch(pluginurl).then((response) => {
          if (!response.ok) {
            throw new Error("Couldn't load plugin");
          }
          return response;
        }).then((response) => {
          return response.json();
        }).then((plugin) => {
          SynthMessenger.pluginValueNames = plugin.variableNames || [];
          SynthMessenger.pluginInstrumentStateFunction = plugin.instrumentStateFunction || "";
          SynthMessenger.pluginFunction = plugin.synthFunction || "";
          SynthMessenger.pluginIndex = plugin.effectOrderIndex || 0;
          SynthMessenger.PluginDelayLineSize = plugin.delayLineSize || 0;
          PluginConfig.pluginUIElements = plugin.elements || [];
          PluginConfig.pluginName = plugin.pluginName || "plugin";
        }).then(() => {
          if (SynthMessenger.rerenderSongEditorAfterPluginLoad) SynthMessenger.rerenderSongEditorAfterPluginLoad();
        }).catch(() => {
          window.alert("couldn't load plugin " + pluginurl);
        });
      }
    }
    static _isProperUrl(string) {
      try {
        if (OFFLINE) {
          return Boolean(string);
        } else {
          return Boolean(new URL(string));
        }
      } catch (x) {
        return false;
      }
    }
    // @TODO: Share more of this code with AddSamplesPrompt.
    static _parseAndConfigureCustomSample(url, customSampleUrls, customSamplePresets, sampleLoadingState2, parseOldSyntax) {
      const defaultIndex = 0;
      const defaultIntegratedSamples = Config.chipWaves[defaultIndex].samples;
      const defaultSamples = Config.rawRawChipWaves[defaultIndex].samples;
      const customSampleUrlIndex = customSampleUrls.length;
      customSampleUrls.push(url);
      const chipWaveIndex = Config.chipWaves.length;
      let urlSliced = url;
      let customSampleRate = 44100;
      let isCustomPercussive = false;
      let customRootKey = 60;
      let presetIsUsingAdvancedLoopControls = false;
      let presetChipWaveLoopStart = null;
      let presetChipWaveLoopEnd = null;
      let presetChipWaveStartOffset = null;
      let presetChipWaveLoopMode = null;
      let presetChipWavePlayBackwards = false;
      let parsedSampleOptions = false;
      let optionsStartIndex = url.indexOf("!");
      let optionsEndIndex = -1;
      if (optionsStartIndex === 0) {
        optionsEndIndex = url.indexOf("!", optionsStartIndex + 1);
        if (optionsEndIndex !== -1) {
          const rawOptions = url.slice(optionsStartIndex + 1, optionsEndIndex).split(",");
          for (const rawOption of rawOptions) {
            const optionCode = rawOption.charAt(0);
            const optionData = rawOption.slice(1, rawOption.length);
            if (optionCode === "s") {
              customSampleRate = clamp(8e3, 96e3 + 1, parseFloatWithDefault(optionData, 44100));
            } else if (optionCode === "r") {
              customRootKey = parseFloatWithDefault(optionData, 60);
            } else if (optionCode === "p") {
              isCustomPercussive = true;
            } else if (optionCode === "a") {
              presetChipWaveLoopStart = parseIntWithDefault(optionData, null);
              if (presetChipWaveLoopStart != null) {
                presetIsUsingAdvancedLoopControls = true;
              }
            } else if (optionCode === "b") {
              presetChipWaveLoopEnd = parseIntWithDefault(optionData, null);
              if (presetChipWaveLoopEnd != null) {
                presetIsUsingAdvancedLoopControls = true;
              }
            } else if (optionCode === "c") {
              presetChipWaveStartOffset = parseIntWithDefault(optionData, null);
              if (presetChipWaveStartOffset != null) {
                presetIsUsingAdvancedLoopControls = true;
              }
            } else if (optionCode === "d") {
              presetChipWaveLoopMode = parseIntWithDefault(optionData, null);
              if (presetChipWaveLoopMode != null) {
                presetChipWaveLoopMode = clamp(0, 3 + 1, presetChipWaveLoopMode);
                presetIsUsingAdvancedLoopControls = true;
              }
            } else if (optionCode === "e") {
              presetChipWavePlayBackwards = true;
              presetIsUsingAdvancedLoopControls = true;
            }
          }
          urlSliced = url.slice(optionsEndIndex + 1, url.length);
          parsedSampleOptions = true;
        }
      }
      let parsedUrl = null;
      if (_Song._isProperUrl(urlSliced)) {
        if (OFFLINE) {
          parsedUrl = urlSliced;
        } else {
          parsedUrl = new URL(urlSliced);
        }
      } else {
        return false;
      }
      if (parseOldSyntax) {
        if (!parsedSampleOptions && parsedUrl != null) {
          let sliceForSampleRate = function() {
            urlSliced = url.slice(0, url.indexOf(","));
            if (OFFLINE) {
              parsedUrl = urlSliced;
            } else {
              parsedUrl = new URL(urlSliced);
            }
            customSampleRate = clamp(8e3, 96e3 + 1, parseFloatWithDefault(url.slice(url.indexOf(",") + 1), 44100));
          }, sliceForRootKey = function() {
            urlSliced = url.slice(0, url.indexOf("!"));
            if (OFFLINE) {
              parsedUrl = urlSliced;
            } else {
              parsedUrl = new URL(urlSliced);
            }
            customRootKey = parseFloatWithDefault(url.slice(url.indexOf("!") + 1), 60);
          };
          __name(sliceForSampleRate, "sliceForSampleRate");
          __name(sliceForRootKey, "sliceForRootKey");
          if (url.indexOf("@") != -1) {
            urlSliced = url.replaceAll("@", "");
            if (OFFLINE) {
              parsedUrl = urlSliced;
            } else {
              parsedUrl = new URL(urlSliced);
            }
            isCustomPercussive = true;
          }
          if (url.indexOf(",") != -1 && url.indexOf("!") != -1) {
            if (url.indexOf(",") < url.indexOf("!")) {
              sliceForRootKey();
              sliceForSampleRate();
            } else {
              sliceForSampleRate();
              sliceForRootKey();
            }
          } else {
            if (url.indexOf(",") != -1) {
              sliceForSampleRate();
            }
            if (url.indexOf("!") != -1) {
              sliceForRootKey();
            }
          }
        }
      }
      if (parsedUrl != null) {
        let urlWithNamedOptions = urlSliced;
        const namedOptions = [];
        if (customSampleRate !== 44100) namedOptions.push("s" + customSampleRate);
        if (customRootKey !== 60) namedOptions.push("r" + customRootKey);
        if (isCustomPercussive) namedOptions.push("p");
        if (presetIsUsingAdvancedLoopControls) {
          if (presetChipWaveLoopStart != null) namedOptions.push("a" + presetChipWaveLoopStart);
          if (presetChipWaveLoopEnd != null) namedOptions.push("b" + presetChipWaveLoopEnd);
          if (presetChipWaveStartOffset != null) namedOptions.push("c" + presetChipWaveStartOffset);
          if (presetChipWaveLoopMode != null) namedOptions.push("d" + presetChipWaveLoopMode);
          if (presetChipWavePlayBackwards) namedOptions.push("e");
        }
        if (namedOptions.length > 0) {
          urlWithNamedOptions = "!" + namedOptions.join(",") + "!" + urlSliced;
        }
        customSampleUrls[customSampleUrlIndex] = urlWithNamedOptions;
        let name;
        if (OFFLINE) {
          name = decodeURIComponent(parsedUrl.replace(/^([^\/]*\/)+/, ""));
        } else {
          name = decodeURIComponent(parsedUrl.pathname.replace(/^([^\/]*\/)+/, ""));
        }
        const expression = 1;
        Config.chipWaves[chipWaveIndex] = {
          name,
          expression,
          isCustomSampled: true,
          isPercussion: isCustomPercussive,
          rootKey: customRootKey,
          sampleRate: customSampleRate,
          samples: defaultIntegratedSamples,
          index: chipWaveIndex
        };
        Config.rawChipWaves[chipWaveIndex] = {
          name,
          expression,
          isCustomSampled: true,
          isPercussion: isCustomPercussive,
          rootKey: customRootKey,
          sampleRate: customSampleRate,
          samples: defaultSamples,
          index: chipWaveIndex
        };
        Config.rawRawChipWaves[chipWaveIndex] = {
          name,
          expression,
          isCustomSampled: true,
          isPercussion: isCustomPercussive,
          rootKey: customRootKey,
          sampleRate: customSampleRate,
          samples: defaultSamples,
          index: chipWaveIndex
        };
        const customSamplePresetSettings = {
          "type": "chip",
          "eqFilter": [],
          "effects": [],
          "transition": "normal",
          "fadeInSeconds": 0,
          "fadeOutTicks": -3,
          "chord": "harmony",
          "wave": name,
          "unison": "none",
          "envelopes": []
        };
        if (presetIsUsingAdvancedLoopControls) {
          customSamplePresetSettings["isUsingAdvancedLoopControls"] = true;
          customSamplePresetSettings["chipWaveLoopStart"] = presetChipWaveLoopStart != null ? presetChipWaveLoopStart : 0;
          customSamplePresetSettings["chipWaveLoopEnd"] = presetChipWaveLoopEnd != null ? presetChipWaveLoopEnd : 2;
          customSamplePresetSettings["chipWaveLoopMode"] = presetChipWaveLoopMode != null ? presetChipWaveLoopMode : 0;
          customSamplePresetSettings["chipWavePlayBackwards"] = presetChipWavePlayBackwards;
          customSamplePresetSettings["chipWaveStartOffset"] = presetChipWaveStartOffset != null ? presetChipWaveStartOffset : 0;
        }
        const customSamplePreset = {
          index: 0,
          // This should be overwritten by toNameMap, in our caller.
          name,
          midiProgram: 80,
          settings: customSamplePresetSettings
        };
        customSamplePresets.push(customSamplePreset);
        if (!Config.willReloadForCustomSamples) {
          const rawLoopOptions = {
            "isUsingAdvancedLoopControls": presetIsUsingAdvancedLoopControls,
            "chipWaveLoopStart": presetChipWaveLoopStart,
            "chipWaveLoopEnd": presetChipWaveLoopEnd,
            "chipWaveLoopMode": presetChipWaveLoopMode,
            "chipWavePlayBackwards": presetChipWavePlayBackwards,
            "chipWaveStartOffset": presetChipWaveStartOffset
          };
          startLoadingSample(urlSliced, chipWaveIndex, customSamplePresetSettings, rawLoopOptions, customSampleRate);
        }
        sampleLoadingState2.statusTable[chipWaveIndex] = 0 /* loading */;
        sampleLoadingState2.urlTable[chipWaveIndex] = urlSliced;
        sampleLoadingState2.totalSamples++;
      }
      return true;
    }
    static _restoreChipWaveListToDefault() {
      Config.chipWaves = toNameMap(Config.chipWaves.slice(0, Config.firstIndexForSamplesInChipWaveList));
      Config.rawChipWaves = toNameMap(Config.rawChipWaves.slice(0, Config.firstIndexForSamplesInChipWaveList));
      Config.rawRawChipWaves = toNameMap(Config.rawRawChipWaves.slice(0, Config.firstIndexForSamplesInChipWaveList));
    }
    static _clearSamples() {
      EditorConfig.customSamples = null;
      _Song._restoreChipWaveListToDefault();
      sampleLoadingState.statusTable = {};
      sampleLoadingState.urlTable = {};
      sampleLoadingState.totalSamples = 0;
      sampleLoadingState.samplesLoaded = 0;
      sampleLoadEvents.dispatchEvent(new SampleLoadedEvent(
        sampleLoadingState.totalSamples,
        sampleLoadingState.samplesLoaded
      ));
    }
    toJsonObject(enableIntro = true, loopCount = 1, enableOutro = true) {
      const channelArray = [];
      for (let channelIndex = 0; channelIndex < this.getChannelCount(); channelIndex++) {
        const channel = this.channels[channelIndex];
        const instrumentArray = [];
        const isNoiseChannel = this.getChannelIsNoise(channelIndex);
        const isModChannel = this.getChannelIsMod(channelIndex);
        for (const instrument of channel.instruments) {
          instrumentArray.push(instrument.toJsonObject());
        }
        const patternArray = [];
        for (const pattern of channel.patterns) {
          patternArray.push(pattern.toJsonObject(this, channel, isModChannel));
        }
        const sequenceArray = [];
        if (enableIntro) for (let i = 0; i < this.loopStart; i++) {
          sequenceArray.push(channel.bars[i]);
        }
        for (let l = 0; l < loopCount; l++) for (let i = this.loopStart; i < this.loopStart + this.loopLength; i++) {
          sequenceArray.push(channel.bars[i]);
        }
        if (enableOutro) for (let i = this.loopStart + this.loopLength; i < this.barCount; i++) {
          sequenceArray.push(channel.bars[i]);
        }
        const channelObject = {
          "type": isModChannel ? "mod" : isNoiseChannel ? "drum" : "pitch",
          "name": channel.name,
          "instruments": instrumentArray,
          "patterns": patternArray,
          "sequence": sequenceArray
        };
        if (!isNoiseChannel) {
          channelObject["octaveScrollBar"] = channel.octave - 1;
        }
        channelArray.push(channelObject);
      }
      const result = {
        "name": this.title,
        "format": _Song._format,
        "version": _Song._latestSlarmoosBoxVersion,
        "scale": Config.scales[this.scale].name,
        "customScale": this.scaleCustom,
        "key": Config.keys[this.key].name,
        "keyOctave": this.octave,
        "introBars": this.loopStart,
        "loopBars": this.loopLength,
        "beatsPerBar": this.beatsPerBar,
        "ticksPerBeat": Config.rhythms[this.rhythm].stepsPerBeat,
        "beatsPerMinute": this.tempo,
        "reverb": this.reverb,
        "masterGain": this.masterGain,
        "compressionThreshold": this.compressionThreshold,
        "limitThreshold": this.limitThreshold,
        "limitDecay": this.limitDecay,
        "limitRise": this.limitRise,
        "limitRatio": this.limitRatio,
        "compressionRatio": this.compressionRatio,
        //"outroBars": this.barCount - this.loopStart - this.loopLength; // derive this from bar arrays?
        //"patternCount": this.patternsPerChannel, // derive this from pattern arrays?
        "songEq": this.eqFilter.toJsonObject(),
        "layeredInstruments": this.layeredInstruments,
        "patternInstruments": this.patternInstruments,
        "channels": channelArray
      };
      for (let i = 0; i < Config.filterMorphCount - 1; i++) {
        result["songEq" + i] = this.eqSubFilters[i];
      }
      if (EditorConfig.customSamples != null && EditorConfig.customSamples.length > 0) {
        result["customSamples"] = EditorConfig.customSamples;
      }
      if (this.pluginurl != null) {
        result["pluginurl"] = this.pluginurl;
      }
      return result;
    }
    fromJsonObject(jsonObject, jsonFormat = "auto") {
      this.initToDefault(true);
      if (!jsonObject) return;
      if (jsonFormat == "auto") {
        if (jsonObject["format"] == "BeepBox") {
          if (jsonObject["riff"] != void 0) {
            jsonFormat = "modbox";
          }
          if (jsonObject["masterGain"] != void 0) {
            jsonFormat = "jummbox";
          }
        }
      }
      const format = (jsonFormat == "auto" ? jsonObject["format"] : jsonFormat).toLowerCase();
      if (jsonObject["name"] != void 0) {
        this.title = jsonObject["name"];
      }
      if (jsonObject["pluginurl"] != void 0) {
        this.pluginurl = jsonObject["pluginurl"];
        this.fetchPlugin(jsonObject["pluginurl"]);
      }
      if (jsonObject["customSamples"] != void 0) {
        const customSamples = jsonObject["customSamples"];
        if (EditorConfig.customSamples == null || EditorConfig.customSamples.join(", ") != customSamples.join(", ")) {
          Config.willReloadForCustomSamples = true;
          _Song._restoreChipWaveListToDefault();
          let willLoadLegacySamples = false;
          let willLoadNintariboxSamples = false;
          let willLoadMarioPaintboxSamples = false;
          const customSampleUrls = [];
          const customSamplePresets = [];
          for (const url of customSamples) {
            if (url.toLowerCase() === "legacysamples") {
              if (!willLoadLegacySamples) {
                willLoadLegacySamples = true;
                customSampleUrls.push(url);
                loadBuiltInSamples(0);
              }
            } else if (url.toLowerCase() === "nintariboxsamples") {
              if (!willLoadNintariboxSamples) {
                willLoadNintariboxSamples = true;
                customSampleUrls.push(url);
                loadBuiltInSamples(1);
              }
            } else if (url.toLowerCase() === "mariopaintboxsamples") {
              if (!willLoadMarioPaintboxSamples) {
                willLoadMarioPaintboxSamples = true;
                customSampleUrls.push(url);
                loadBuiltInSamples(2);
              }
            } else {
              const parseOldSyntax = false;
              _Song._parseAndConfigureCustomSample(url, customSampleUrls, customSamplePresets, sampleLoadingState, parseOldSyntax);
            }
          }
          if (customSampleUrls.length > 0) {
            EditorConfig.customSamples = customSampleUrls;
          }
          if (customSamplePresets.length > 0) {
            const customSamplePresetsMap = toNameMap(customSamplePresets);
            EditorConfig.presetCategories[EditorConfig.presetCategories.length] = {
              name: "Custom Sample Presets",
              presets: customSamplePresetsMap,
              index: EditorConfig.presetCategories.length
            };
          }
        }
      } else {
        let shouldLoadLegacySamples = false;
        if (jsonObject["channels"] != void 0) {
          for (let channelIndex = 0; channelIndex < jsonObject["channels"].length; channelIndex++) {
            const channelObject = jsonObject["channels"][channelIndex];
            if (channelObject["type"] !== "pitch") {
              continue;
            }
            if (Array.isArray(channelObject["instruments"])) {
              const instrumentObjects = channelObject["instruments"];
              for (let i2 = 0; i2 < instrumentObjects.length; i2++) {
                const instrumentObject = instrumentObjects[i2];
                if (instrumentObject["type"] !== "chip") {
                  continue;
                }
                if (instrumentObject["wave"] == null) {
                  continue;
                }
                const waveName = instrumentObject["wave"];
                const names = [
                  "paandorasbox kick",
                  "paandorasbox snare",
                  "paandorasbox piano1",
                  "paandorasbox WOW",
                  "paandorasbox overdrive",
                  "paandorasbox trumpet",
                  "paandorasbox saxophone",
                  "paandorasbox orchestrahit",
                  "paandorasbox detatched violin",
                  "paandorasbox synth",
                  "paandorasbox sonic3snare",
                  "paandorasbox come on",
                  "paandorasbox choir",
                  "paandorasbox overdriveguitar",
                  "paandorasbox flute",
                  "paandorasbox legato violin",
                  "paandorasbox tremolo violin",
                  "paandorasbox amen break",
                  "paandorasbox pizzicato violin",
                  "paandorasbox tim allen grunt",
                  "paandorasbox tuba",
                  "paandorasbox loopingcymbal",
                  "paandorasbox standardkick",
                  "paandorasbox standardsnare",
                  "paandorasbox closedhihat",
                  "paandorasbox foothihat",
                  "paandorasbox openhihat",
                  "paandorasbox crashcymbal",
                  "paandorasbox pianoC4",
                  "paandorasbox liver pad",
                  "paandorasbox marimba",
                  "paandorasbox susdotwav",
                  "paandorasbox wackyboxtts",
                  "paandorasbox peppersteak_1",
                  "paandorasbox peppersteak_2",
                  "paandorasbox vinyl_noise",
                  "paandorasbeta slap bass",
                  "paandorasbeta HD EB overdrive guitar",
                  "paandorasbeta sunsoft bass",
                  "paandorasbeta masculine choir",
                  "paandorasbeta feminine choir",
                  "paandorasbeta tololoche",
                  "paandorasbeta harp",
                  "paandorasbeta pan flute",
                  "paandorasbeta krumhorn",
                  "paandorasbeta timpani",
                  "paandorasbeta crowd hey",
                  "paandorasbeta wario land 4 brass",
                  "paandorasbeta wario land 4 rock organ",
                  "paandorasbeta wario land 4 DAOW",
                  "paandorasbeta wario land 4 hour chime",
                  "paandorasbeta wario land 4 tick",
                  "paandorasbeta kirby kick",
                  "paandorasbeta kirby snare",
                  "paandorasbeta kirby bongo",
                  "paandorasbeta kirby click",
                  "paandorasbeta sonor kick",
                  "paandorasbeta sonor snare",
                  "paandorasbeta sonor snare (left hand)",
                  "paandorasbeta sonor snare (right hand)",
                  "paandorasbeta sonor high tom",
                  "paandorasbeta sonor low tom",
                  "paandorasbeta sonor hihat (closed)",
                  "paandorasbeta sonor hihat (half opened)",
                  "paandorasbeta sonor hihat (open)",
                  "paandorasbeta sonor hihat (open tip)",
                  "paandorasbeta sonor hihat (pedal)",
                  "paandorasbeta sonor crash",
                  "paandorasbeta sonor crash (tip)",
                  "paandorasbeta sonor ride"
                ];
                const oldNames = [
                  "pandoraasbox kick",
                  "pandoraasbox snare",
                  "pandoraasbox piano1",
                  "pandoraasbox WOW",
                  "pandoraasbox overdrive",
                  "pandoraasbox trumpet",
                  "pandoraasbox saxophone",
                  "pandoraasbox orchestrahit",
                  "pandoraasbox detatched violin",
                  "pandoraasbox synth",
                  "pandoraasbox sonic3snare",
                  "pandoraasbox come on",
                  "pandoraasbox choir",
                  "pandoraasbox overdriveguitar",
                  "pandoraasbox flute",
                  "pandoraasbox legato violin",
                  "pandoraasbox tremolo violin",
                  "pandoraasbox amen break",
                  "pandoraasbox pizzicato violin",
                  "pandoraasbox tim allen grunt",
                  "pandoraasbox tuba",
                  "pandoraasbox loopingcymbal",
                  "pandoraasbox standardkick",
                  "pandoraasbox standardsnare",
                  "pandoraasbox closedhihat",
                  "pandoraasbox foothihat",
                  "pandoraasbox openhihat",
                  "pandoraasbox crashcymbal",
                  "pandoraasbox pianoC4",
                  "pandoraasbox liver pad",
                  "pandoraasbox marimba",
                  "pandoraasbox susdotwav",
                  "pandoraasbox wackyboxtts",
                  "pandoraasbox peppersteak_1",
                  "pandoraasbox peppersteak_2",
                  "pandoraasbox vinyl_noise",
                  "pandoraasbeta slap bass",
                  "pandoraasbeta HD EB overdrive guitar",
                  "pandoraasbeta sunsoft bass",
                  "pandoraasbeta masculine choir",
                  "pandoraasbeta feminine choir",
                  "pandoraasbeta tololoche",
                  "pandoraasbeta harp",
                  "pandoraasbeta pan flute",
                  "pandoraasbeta krumhorn",
                  "pandoraasbeta timpani",
                  "pandoraasbeta crowd hey",
                  "pandoraasbeta wario land 4 brass",
                  "pandoraasbeta wario land 4 rock organ",
                  "pandoraasbeta wario land 4 DAOW",
                  "pandoraasbeta wario land 4 hour chime",
                  "pandoraasbeta wario land 4 tick",
                  "pandoraasbeta kirby kick",
                  "pandoraasbeta kirby snare",
                  "pandoraasbeta kirby bongo",
                  "pandoraasbeta kirby click",
                  "pandoraasbeta sonor kick",
                  "pandoraasbeta sonor snare",
                  "pandoraasbeta sonor snare (left hand)",
                  "pandoraasbeta sonor snare (right hand)",
                  "pandoraasbeta sonor high tom",
                  "pandoraasbeta sonor low tom",
                  "pandoraasbeta sonor hihat (closed)",
                  "pandoraasbeta sonor hihat (half opened)",
                  "pandoraasbeta sonor hihat (open)",
                  "pandoraasbeta sonor hihat (open tip)",
                  "pandoraasbeta sonor hihat (pedal)",
                  "pandoraasbeta sonor crash",
                  "pandoraasbeta sonor crash (tip)",
                  "pandoraasbeta sonor ride"
                ];
                const veryOldNames = [
                  "kick",
                  "snare",
                  "piano1",
                  "WOW",
                  "overdrive",
                  "trumpet",
                  "saxophone",
                  "orchestrahit",
                  "detatched violin",
                  "synth",
                  "sonic3snare",
                  "come on",
                  "choir",
                  "overdriveguitar",
                  "flute",
                  "legato violin",
                  "tremolo violin",
                  "amen break",
                  "pizzicato violin",
                  "tim allen grunt",
                  "tuba",
                  "loopingcymbal",
                  "standardkick",
                  "standardsnare",
                  "closedhihat",
                  "foothihat",
                  "openhihat",
                  "crashcymbal",
                  "pianoC4",
                  "liver pad",
                  "marimba",
                  "susdotwav",
                  "wackyboxtts"
                ];
                if (names.includes(waveName)) {
                  shouldLoadLegacySamples = true;
                } else if (oldNames.includes(waveName)) {
                  shouldLoadLegacySamples = true;
                  instrumentObject["wave"] = names[oldNames.findIndex((x) => x === waveName)];
                } else if (veryOldNames.includes(waveName)) {
                  if ((waveName === "trumpet" || waveName === "flute") && format != "paandorasbox") {
                  } else {
                    shouldLoadLegacySamples = true;
                    instrumentObject["wave"] = names[veryOldNames.findIndex((x) => x === waveName)];
                  }
                }
              }
            }
          }
        }
        if (shouldLoadLegacySamples) {
          Config.willReloadForCustomSamples = true;
          _Song._restoreChipWaveListToDefault();
          loadBuiltInSamples(0);
          EditorConfig.customSamples = ["legacySamples"];
        } else {
          if (EditorConfig.customSamples != null && EditorConfig.customSamples.length > 0) {
            Config.willReloadForCustomSamples = true;
            _Song._clearSamples();
          }
        }
      }
      this.scale = 0;
      if (jsonObject["scale"] != void 0) {
        const oldScaleNames = {
          "romani :)": "double harmonic :)",
          "romani :(": "double harmonic :(",
          "dbl harmonic :)": "double harmonic :)",
          "dbl harmonic :(": "double harmonic :(",
          "enigma": "strange"
        };
        const scaleName = oldScaleNames[jsonObject["scale"]] != void 0 ? oldScaleNames[jsonObject["scale"]] : jsonObject["scale"];
        const scale = Config.scales.findIndex((scale2) => scale2.name == scaleName);
        if (scale != -1) this.scale = scale;
        if (this.scale == Config.scales["dictionary"]["Custom"].index) {
          if (jsonObject["customScale"] != void 0) {
            for (var i of jsonObject["customScale"].keys()) {
              this.scaleCustom[i] = jsonObject["customScale"][i];
            }
          }
        }
      }
      if (jsonObject["key"] != void 0) {
        if (typeof jsonObject["key"] == "number") {
          this.key = (jsonObject["key"] + 1200 >>> 0) % Config.keys.length;
        } else if (typeof jsonObject["key"] == "string") {
          const key = jsonObject["key"];
          if (key === "C+") {
            this.key = 0;
            this.octave = 1;
          } else if (key === "G- (actually F#-)") {
            this.key = 6;
            this.octave = -1;
          } else if (key === "C-") {
            this.key = 0;
            this.octave = -1;
          } else if (key === "oh no (F-)") {
            this.key = 5;
            this.octave = -1;
          } else {
            const letter = key.charAt(0).toUpperCase();
            const symbol = key.charAt(1).toLowerCase();
            const letterMap = { "C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11 };
            const accidentalMap = { "#": 1, "\u266F": 1, "b": -1, "\u266D": -1 };
            let index = letterMap[letter];
            const offset = accidentalMap[symbol];
            if (index != void 0) {
              if (offset != void 0) index += offset;
              if (index < 0) index += 12;
              index = index % 12;
              this.key = index;
            }
          }
        }
      }
      if (jsonObject["beatsPerMinute"] != void 0) {
        this.tempo = clamp(Config.tempoMin, Config.tempoMax + 1, jsonObject["beatsPerMinute"] | 0);
      }
      if (jsonObject["keyOctave"] != void 0) {
        this.octave = clamp(Config.octaveMin, Config.octaveMax + 1, jsonObject["keyOctave"] | 0);
      }
      let legacyGlobalReverb = 0;
      if (jsonObject["reverb"] != void 0) {
        legacyGlobalReverb = clamp(0, 32, jsonObject["reverb"] | 0);
      }
      if (jsonObject["beatsPerBar"] != void 0) {
        this.beatsPerBar = Math.max(Config.beatsPerBarMin, Math.min(Config.beatsPerBarMax, jsonObject["beatsPerBar"] | 0));
      }
      let importedPartsPerBeat = 4;
      if (jsonObject["ticksPerBeat"] != void 0) {
        importedPartsPerBeat = jsonObject["ticksPerBeat"] | 0 || 4;
        this.rhythm = Config.rhythms.findIndex((rhythm) => rhythm.stepsPerBeat == importedPartsPerBeat);
        if (this.rhythm == -1) {
          this.rhythm = 1;
        }
      }
      if (jsonObject["masterGain"] != void 0) {
        this.masterGain = Math.max(0, Math.min(5, jsonObject["masterGain"] || 0));
      } else {
        this.masterGain = 1;
      }
      if (jsonObject["limitThreshold"] != void 0) {
        this.limitThreshold = Math.max(0, Math.min(2, jsonObject["limitThreshold"] || 0));
      } else {
        this.limitThreshold = 1;
      }
      if (jsonObject["compressionThreshold"] != void 0) {
        this.compressionThreshold = Math.max(0, Math.min(1.1, jsonObject["compressionThreshold"] || 0));
      } else {
        this.compressionThreshold = 1;
      }
      if (jsonObject["limitRise"] != void 0) {
        this.limitRise = Math.max(2e3, Math.min(1e4, jsonObject["limitRise"] || 0));
      } else {
        this.limitRise = 4e3;
      }
      if (jsonObject["limitDecay"] != void 0) {
        this.limitDecay = Math.max(1, Math.min(30, jsonObject["limitDecay"] || 0));
      } else {
        this.limitDecay = 4;
      }
      if (jsonObject["limitRatio"] != void 0) {
        this.limitRatio = Math.max(0, Math.min(11, jsonObject["limitRatio"] || 0));
      } else {
        this.limitRatio = 1;
      }
      if (jsonObject["compressionRatio"] != void 0) {
        this.compressionRatio = Math.max(0, Math.min(1.168, jsonObject["compressionRatio"] || 0));
      } else {
        this.compressionRatio = 1;
      }
      if (jsonObject["songEq"] != void 0) {
        this.eqFilter.fromJsonObject(jsonObject["songEq"]);
      } else {
        this.eqFilter.reset();
      }
      for (let i2 = 0; i2 < Config.filterMorphCount - 1; i2++) {
        if (jsonObject["songEq" + i2]) {
          this.eqSubFilters[i2] = jsonObject["songEq" + i2];
        } else {
          this.eqSubFilters[i2] = null;
        }
      }
      let maxInstruments = 1;
      let maxPatterns = 1;
      let maxBars = 1;
      if (jsonObject["channels"] != void 0) {
        for (const channelObject of jsonObject["channels"]) {
          if (channelObject["instruments"]) maxInstruments = Math.max(maxInstruments, channelObject["instruments"].length | 0);
          if (channelObject["patterns"]) maxPatterns = Math.max(maxPatterns, channelObject["patterns"].length | 0);
          if (channelObject["sequence"]) maxBars = Math.max(maxBars, channelObject["sequence"].length | 0);
        }
      }
      if (jsonObject["layeredInstruments"] != void 0) {
        this.layeredInstruments = !!jsonObject["layeredInstruments"];
      } else {
        this.layeredInstruments = false;
      }
      if (jsonObject["patternInstruments"] != void 0) {
        this.patternInstruments = !!jsonObject["patternInstruments"];
      } else {
        this.patternInstruments = maxInstruments > 1;
      }
      this.patternsPerChannel = Math.min(maxPatterns, Config.barCountMax);
      this.barCount = Math.min(maxBars, Config.barCountMax);
      if (jsonObject["introBars"] != void 0) {
        this.loopStart = clamp(0, this.barCount, jsonObject["introBars"] | 0);
      }
      if (jsonObject["loopBars"] != void 0) {
        this.loopLength = clamp(1, this.barCount - this.loopStart + 1, jsonObject["loopBars"] | 0);
      }
      const newPitchChannels = [];
      const newNoiseChannels = [];
      const newModChannels = [];
      if (jsonObject["channels"] != void 0) {
        for (let channelIndex = 0; channelIndex < jsonObject["channels"].length; channelIndex++) {
          let channelObject = jsonObject["channels"][channelIndex];
          const channel = new Channel();
          let isNoiseChannel = false;
          let isModChannel = false;
          if (channelObject["type"] != void 0) {
            isNoiseChannel = channelObject["type"] == "drum";
            isModChannel = channelObject["type"] == "mod";
          } else {
            isNoiseChannel = channelIndex >= 3;
          }
          if (isNoiseChannel) {
            newNoiseChannels.push(channel);
          } else if (isModChannel) {
            newModChannels.push(channel);
          } else {
            newPitchChannels.push(channel);
          }
          if (channelObject["octaveScrollBar"] != void 0) {
            channel.octave = clamp(0, Config.pitchOctaves, (channelObject["octaveScrollBar"] | 0) + 1);
            if (isNoiseChannel) channel.octave = 0;
          }
          if (channelObject["name"] != void 0) {
            channel.name = channelObject["name"];
          } else {
            channel.name = "";
          }
          if (Array.isArray(channelObject["instruments"])) {
            const instrumentObjects = channelObject["instruments"];
            for (let i2 = 0; i2 < instrumentObjects.length; i2++) {
              if (i2 >= this.getMaxInstrumentsPerChannel()) break;
              const instrument = new Instrument(isNoiseChannel, isModChannel);
              channel.instruments[i2] = instrument;
              instrument.fromJsonObject(instrumentObjects[i2], isNoiseChannel, isModChannel, false, false, legacyGlobalReverb, format);
            }
          }
          for (let i2 = 0; i2 < this.patternsPerChannel; i2++) {
            const pattern = new Pattern();
            channel.patterns[i2] = pattern;
            let patternObject = void 0;
            if (channelObject["patterns"]) patternObject = channelObject["patterns"][i2];
            if (patternObject == void 0) continue;
            pattern.fromJsonObject(patternObject, this, channel, importedPartsPerBeat, isNoiseChannel, isModChannel, format);
          }
          channel.patterns.length = this.patternsPerChannel;
          for (let i2 = 0; i2 < this.barCount; i2++) {
            channel.bars[i2] = channelObject["sequence"] != void 0 ? Math.min(this.patternsPerChannel, channelObject["sequence"][i2] >>> 0) : 0;
          }
          channel.bars.length = this.barCount;
        }
      }
      if (newPitchChannels.length > Config.pitchChannelCountMax) newPitchChannels.length = Config.pitchChannelCountMax;
      if (newNoiseChannels.length > Config.noiseChannelCountMax) newNoiseChannels.length = Config.noiseChannelCountMax;
      if (newModChannels.length > Config.modChannelCountMax) newModChannels.length = Config.modChannelCountMax;
      this.pitchChannelCount = newPitchChannels.length;
      this.noiseChannelCount = newNoiseChannels.length;
      this.modChannelCount = newModChannels.length;
      this.channels.length = 0;
      Array.prototype.push.apply(this.channels, newPitchChannels);
      Array.prototype.push.apply(this.channels, newNoiseChannels);
      Array.prototype.push.apply(this.channels, newModChannels);
      if (Config.willReloadForCustomSamples) {
        window.location.hash = this.toBase64String();
        setTimeout(() => {
          location.reload();
        }, 50);
      }
    }
    getPattern(channelIndex, bar) {
      if (bar < 0 || bar >= this.barCount) return null;
      const patternIndex = this.channels[channelIndex].bars[bar];
      if (patternIndex == 0) return null;
      return this.channels[channelIndex].patterns[patternIndex - 1];
    }
    getBeatsPerMinute() {
      return this.tempo;
    }
    static getNeededBits(maxValue) {
      return 32 - Math.clz32(Math.ceil(maxValue + 1) - 1);
    }
    restoreLimiterDefaults() {
      this.compressionRatio = 1;
      this.limitRatio = 1;
      this.limitRise = 4e3;
      this.limitDecay = 4;
      this.limitThreshold = 1;
      this.compressionThreshold = 1;
      this.masterGain = 1;
    }
  };
  var SynthMessenger = class {
    constructor(song = null) {
      this.preferLowerLatency = false;
      // enable when recording performances from keyboard or MIDI. Takes effect next time you activate audio.
      this.anticipatePoorPerformance = false;
      // enable on mobile devices to reduce audio stutter glitches. Takes effect next time you activate audio.
      // public liveInputDuration: number = 0;
      // public liveBassInputDuration: number = 0;
      // public liveInputStarted: boolean = false;
      // public liveBassInputStarted: boolean = false;
      //TODO: Make an enum in synthConfig for this
      /**
       * liveInputDuration [0]: number
       * 
       * liveBassInputDuration [1]: number
       * 
       * liveInputStarted [2]: 0 | 1
       * 
       * liveBassInputStarted [3]: 0 | 1
       * 
       * liveInputChannel [4]: integer
       * 
       * liveBassInputChannel [5]: integer
       */
      this.liveInputValues = new Uint32Array(new SharedArrayBuffer(6 * 4));
      // public liveInputPitches: number[];
      // public liveBassInputPitches: number[];
      this.liveInputPitchesSAB = new SharedArrayBuffer(Config.maxPitch);
      this.liveInputPitchesOnOffRequests = new RingBuffer(this.liveInputPitchesSAB, Uint16Array);
      this.volume = 1;
      this.oscRefreshEventTimer = 0;
      this.oscEnabled = true;
      this.enableMetronome = false;
      this.countInMetronome = false;
      this.renderingSong = false;
      this.playheadInternal = 0;
      this.bar = 0;
      // private prevBar: number | null = null;
      // private nextBar: number | null = null;
      this.beat = 0;
      this.part = 0;
      this.tick = 0;
      this.isAtStartOfTick = true;
      this.isAtEndOfTick = true;
      this.tickSampleCountdown = 0;
      this.isPlayingSong = false;
      this.isRecording = false;
      this.audioContext = null;
      this.workletNode = null;
      this.samplesPerSecond = 44100;
      this.song = null;
      this.modValues = [];
      this.modInsValues = [];
      this.nextModValues = [];
      this.nextModInsValues = [];
      this.heldMods = [];
      this.loopRepeatCount = -1;
      this.loopBarStart = -1;
      this.loopBarEnd = -1;
      this.liveInputEndTime = 0;
      this.messageQueue = [];
      this.pushArray = new Uint16Array(1);
      if (song != null) this.setSong(song);
      this.activateAudio();
      this.update();
    }
    static {
      __name(this, "SynthMessenger");
    }
    static {
      this.pluginFunction = null;
    }
    static {
      this.pluginIndex = 0;
    }
    static {
      this.pluginValueNames = [];
    }
    static {
      this.pluginInstrumentStateFunction = null;
    }
    static {
      this.PluginDelayLineSize = 0;
    }
    static {
      this.rerenderSongEditorAfterPluginLoad = null;
    }
    get playing() {
      return this.isPlayingSong;
    }
    get recording() {
      return this.isRecording;
    }
    get playhead() {
      return this.playheadInternal;
    }
    set playhead(value) {
      if (this.song != null) {
        this.playheadInternal = Math.max(0, Math.min(this.song.barCount, value));
        let remainder = this.playheadInternal;
        this.bar = Math.floor(remainder);
        remainder = this.song.beatsPerBar * (remainder - this.bar);
        this.beat = Math.floor(remainder);
        remainder = Config.partsPerBeat * (remainder - this.beat);
        this.part = Math.floor(remainder);
        remainder = Config.ticksPerPart * (remainder - this.part);
        this.tick = Math.floor(remainder);
        this.tickSampleCountdown = 0;
        this.isAtStartOfTick = true;
        const prevBar = {
          flag: 8 /* setPrevBar */,
          prevBar: null
        };
        this.sendMessage(prevBar);
      }
    }
    getTicksIntoBar() {
      return (this.beat * Config.partsPerBeat + this.part) * Config.ticksPerPart + this.tick;
    }
    getCurrentPart() {
      return this.beat * Config.partsPerBeat + this.part;
    }
    //TODO: Update only when needed. Probably requires a rewrite of the change system...
    update() {
      requestAnimationFrame(() => this.update());
      this.updateWorkletSong();
    }
    sendMessage(message) {
      if (this.workletNode == null) {
        this.messageQueue.push(message);
      } else {
        while (this.messageQueue.length > 0) {
          let next = this.messageQueue.shift();
          if (next) {
            this.workletNode.port.postMessage(next);
          }
        }
        this.workletNode.port.postMessage(message);
      }
    }
    receiveMessage(event) {
      const flag = event.data.flag;
      switch (flag) {
        case 2 /* deactivate */: {
          this.audioContext.suspend();
          break;
        }
        case 1 /* togglePlay */: {
          this.pause(false);
          break;
        }
        case 3 /* songPosition */: {
          this.bar = event.data.bar;
          this.beat = event.data.beat;
          this.part = event.data.part;
          this.playheadInternal = ((this.tick / 2 + this.part) / Config.partsPerBeat + this.beat) / this.song.beatsPerBar + this.bar;
          break;
        }
        case 4 /* maintainLiveInput */: {
          if (!this.isPlayingSong && performance.now() >= this.liveInputEndTime) this.deactivateAudio();
          break;
        }
      }
    }
    updateProcessorLocation() {
      const songPositionMessage = {
        flag: 3 /* songPosition */,
        bar: this.bar,
        beat: this.beat,
        part: this.part
      };
      this.sendMessage(songPositionMessage);
    }
    setSong(song) {
      if (typeof song == "string") {
        const songMessage = {
          flag: 0 /* loadSong */,
          song
        };
        this.sendMessage(songMessage);
        this.song = new Song(song);
      } else if (song instanceof Song) {
        const songMessage = {
          flag: 0 /* loadSong */,
          song: song.toBase64String()
        };
        this.sendMessage(songMessage);
        this.song = song;
      }
    }
    addRemoveLiveInputTone(pitches, isBass, turnOn) {
      if (typeof pitches === "number") {
        let val = pitches;
        val = val << 1;
        val += +turnOn;
        val = val << 1;
        val += +isBass;
        this.pushArray[0] = val;
        this.liveInputPitchesOnOffRequests.push(this.pushArray, 1);
      } else if (pitches instanceof Array && pitches.length > 0) {
        const pushArray = new Uint16Array(pitches.length);
        for (let i = 0; i < pitches.length; i++) {
          let val = pitches[i];
          val = val << 1;
          val += +turnOn;
          val = val << 1;
          val += +isBass;
          pushArray[i] = val;
        }
        this.liveInputPitchesOnOffRequests.push(pushArray);
      }
    }
    //TODO: Channel muting
    async activateAudio() {
      if (this.audioContext == null || this.workletNode == null) {
        if (this.workletNode != null) this.deactivateAudio();
        const sabMessage = {
          flag: 7 /* sharedArrayBuffers */,
          // livePitches: this.liveInputPitches,
          // bassLivePitches: this.liveBassInputPitches,
          liveInputValues: this.liveInputValues,
          liveInputPitchesOnOffRequests: this.liveInputPitchesSAB
          //add more here if needed
        };
        this.sendMessage(sabMessage);
        this.updateWorkletSong();
        const latencyHint = this.anticipatePoorPerformance ? this.preferLowerLatency ? "balanced" : "playback" : this.preferLowerLatency ? "interactive" : "balanced";
        this.audioContext = this.audioContext || new (window.AudioContext || window.webkitAudioContext)({ latencyHint });
        this.samplesPerSecond = this.audioContext.sampleRate;
        await this.audioContext.audioWorklet.addModule("beepbox_synth_processor.js");
        this.workletNode = new AudioWorkletNode(this.audioContext, "synth-processor", {
          numberOfOutputs: 1,
          outputChannelCount: [2],
          channelInterpretation: "speakers",
          channelCountMode: "explicit",
          numberOfInputs: 0
        });
        this.workletNode.connect(this.audioContext.destination);
        this.workletNode.port.onmessage = (event) => this.receiveMessage(event);
      }
      this.audioContext.resume();
    }
    updateWorkletSong() {
      if (this.song) {
        const songMessage = {
          flag: 0 /* loadSong */,
          song: this.song.toBase64String()
        };
        this.sendMessage(songMessage);
      }
    }
    deactivateAudio() {
      if (this.audioContext != null && this.workletNode != null) {
        this.audioContext.suspend();
      }
    }
    maintainLiveInput() {
      this.activateAudio();
      this.liveInputEndTime = performance.now() + 1e4;
    }
    // Direct synthesize request, get from worker
    synthesize(outputDataL, outputDataR, outputBufferLength, playSong = true) {
    }
    play() {
      if (this.isPlayingSong) return;
      this.activateAudio();
      this.isPlayingSong = true;
      const playMessage = {
        flag: 1 /* togglePlay */,
        play: this.isPlayingSong
      };
      this.sendMessage(playMessage);
    }
    pause(communicate = true) {
      if (!this.isPlayingSong) return;
      this.isPlayingSong = false;
      this.isRecording = false;
      this.preferLowerLatency = false;
      if (communicate) {
        const playMessage = {
          flag: 1 /* togglePlay */,
          play: this.isPlayingSong
        };
        this.sendMessage(playMessage);
      }
    }
    startRecording() {
      this.preferLowerLatency = true;
      this.isRecording = true;
      this.play();
    }
    snapToStart() {
      this.bar = 0;
      const resetEffectsMessage = {
        flag: 5 /* resetEffects */
      };
      this.sendMessage(resetEffectsMessage);
      this.snapToBar();
    }
    goToBar(bar) {
      this.bar = bar;
      const resetEffectsMessage = {
        flag: 5 /* resetEffects */
      };
      this.updateProcessorLocation();
      this.sendMessage(resetEffectsMessage);
      this.playheadInternal = this.bar;
    }
    snapToBar() {
      this.playheadInternal = this.bar;
      this.beat = 0;
      this.part = 0;
      this.tick = 0;
      this.tickSampleCountdown = 0;
      this.updateProcessorLocation();
    }
    jumpIntoLoop() {
      if (!this.song) return;
      if (this.bar < this.song.loopStart || this.bar >= this.song.loopStart + this.song.loopLength) {
        const oldBar = this.bar;
        this.bar = this.song.loopStart;
        this.playheadInternal += this.bar - oldBar;
        if (this.playing) {
          this.computeLatestModValues();
        }
      }
    }
    goToNextBar() {
      if (!this.song) return;
      const prevBar = {
        flag: 8 /* setPrevBar */,
        prevBar: this.bar
      };
      this.sendMessage(prevBar);
      const oldBar = this.bar;
      this.bar++;
      if (this.bar >= this.song.barCount) {
        this.bar = 0;
      }
      this.playheadInternal += this.bar - oldBar;
      this.updateProcessorLocation();
      if (this.playing) {
        this.computeLatestModValues();
      }
    }
    goToPrevBar() {
      if (!this.song) return;
      const prevBar = {
        flag: 8 /* setPrevBar */,
        prevBar: null
      };
      this.sendMessage(prevBar);
      const oldBar = this.bar;
      this.bar--;
      if (this.bar < 0 || this.bar >= this.song.barCount) {
        this.bar = this.song.barCount - 1;
      }
      this.playheadInternal += this.bar - oldBar;
      this.updateProcessorLocation();
      if (this.playing) {
        this.computeLatestModValues();
      }
    }
    // Returns the total samples in the song
    getTotalSamples(enableIntro, enableOutro, loop) {
      if (this.song == null)
        return -1;
      let startBar = enableIntro ? 0 : this.song.loopStart;
      let endBar = enableOutro ? this.song.barCount : this.song.loopStart + this.song.loopLength;
      let hasTempoMods = false;
      let hasNextBarMods = false;
      let prevTempo = this.song.tempo;
      for (let channel = this.song.getChannelCount() - 1; channel >= this.song.pitchChannelCount + this.song.noiseChannelCount; channel--) {
        for (let bar = startBar; bar < endBar; bar++) {
          let pattern = this.song.getPattern(channel, bar);
          if (pattern != null) {
            let instrument = this.song.channels[channel].instruments[pattern.instruments[0]];
            for (let mod = 0; mod < Config.modCount; mod++) {
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
      if (startBar > 0) {
        let latestTempoPin = null;
        let latestTempoValue = 0;
        for (let bar = startBar - 1; bar >= 0; bar--) {
          for (let channel = this.song.getChannelCount() - 1; channel >= this.song.pitchChannelCount + this.song.noiseChannelCount; channel--) {
            let pattern = this.song.getPattern(channel, bar);
            if (pattern != null) {
              let instrumentIdx = pattern.instruments[0];
              let instrument = this.song.channels[channel].instruments[instrumentIdx];
              let partsInBar = this.findPartsInBar(bar);
              for (const note of pattern.notes) {
                if (instrument.modulators[Config.modCount - 1 - note.pitches[0]] == Config.modulators.dictionary["tempo"].index) {
                  if (note.start < partsInBar && (latestTempoPin == null || note.end > latestTempoPin)) {
                    if (note.end <= partsInBar) {
                      latestTempoPin = note.end;
                      latestTempoValue = note.pins[note.pins.length - 1].size;
                    } else {
                      latestTempoPin = partsInBar;
                      for (let pinIdx = 0; pinIdx < note.pins.length; pinIdx++) {
                        if (note.pins[pinIdx].time + note.start > partsInBar) {
                          const transitionLength = note.pins[pinIdx].time - note.pins[pinIdx - 1].time;
                          const toNextBarLength = partsInBar - note.start - note.pins[pinIdx - 1].time;
                          const deltaVolume = note.pins[pinIdx].size - note.pins[pinIdx - 1].size;
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
          if (latestTempoPin != null) {
            prevTempo = latestTempoValue + Config.modulators.dictionary["tempo"].convertRealFactor;
            bar = -1;
          }
        }
      }
      if (hasTempoMods || hasNextBarMods) {
        let bar = startBar;
        let ended = false;
        let totalSamples = 0;
        while (!ended) {
          let partsInBar = Config.partsPerBeat * this.song.beatsPerBar;
          let currentPart = 0;
          if (hasNextBarMods) {
            partsInBar = this.findPartsInBar(bar);
          }
          if (hasTempoMods) {
            let foundMod = false;
            for (let channel = this.song.getChannelCount() - 1; channel >= this.song.pitchChannelCount + this.song.noiseChannelCount; channel--) {
              if (foundMod == false) {
                let pattern = this.song.getPattern(channel, bar);
                if (pattern != null) {
                  let instrument = this.song.channels[channel].instruments[pattern.instruments[0]];
                  for (let mod = 0; mod < Config.modCount; mod++) {
                    if (foundMod == false && instrument.modulators[mod] == Config.modulators.dictionary["tempo"].index && pattern.notes.find((n) => n.pitches[0] == Config.modCount - 1 - mod)) {
                      foundMod = true;
                      pattern.notes.sort(function(a, b) {
                        return a.start == b.start ? a.pitches[0] - b.pitches[0] : a.start - b.start;
                      });
                      for (const note of pattern.notes) {
                        if (note.pitches[0] == Config.modCount - 1 - mod) {
                          totalSamples += Math.min(partsInBar - currentPart, note.start - currentPart) * Config.ticksPerPart * this.getSamplesPerTickSpecificBPM(prevTempo);
                          if (note.start < partsInBar) {
                            for (let pinIdx = 1; pinIdx < note.pins.length; pinIdx++) {
                              if (note.pins[pinIdx - 1].time + note.start <= partsInBar) {
                                const tickLength = Config.ticksPerPart * Math.min(partsInBar - (note.start + note.pins[pinIdx - 1].time), note.pins[pinIdx].time - note.pins[pinIdx - 1].time);
                                const prevPinTempo = note.pins[pinIdx - 1].size + Config.modulators.dictionary["tempo"].convertRealFactor;
                                let currPinTempo = note.pins[pinIdx].size + Config.modulators.dictionary["tempo"].convertRealFactor;
                                if (note.pins[pinIdx].time + note.start > partsInBar) {
                                  currPinTempo = note.pins[pinIdx - 1].size + (note.pins[pinIdx].size - note.pins[pinIdx - 1].size) * (partsInBar - (note.start + note.pins[pinIdx - 1].time)) / (note.pins[pinIdx].time - note.pins[pinIdx - 1].time) + Config.modulators.dictionary["tempo"].convertRealFactor;
                                }
                                let bpmScalar = Config.partsPerBeat * Config.ticksPerPart / 60;
                                if (currPinTempo != prevPinTempo) {
                                  totalSamples += -this.samplesPerSecond * tickLength * (Math.log(bpmScalar * currPinTempo * tickLength) - Math.log(bpmScalar * prevPinTempo * tickLength)) / (bpmScalar * (prevPinTempo - currPinTempo));
                                } else {
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
        return this.getSamplesPerBar() * this.getTotalBars(enableIntro, enableOutro, loop);
      }
    }
    getSamplesPerBar() {
      if (this.song == null) throw new Error();
      return this.getSamplesPerTick() * Config.ticksPerPart * Config.partsPerBeat * this.song.beatsPerBar;
    }
    findPartsInBar(bar) {
      if (this.song == null) return 0;
      let partsInBar = Config.partsPerBeat * this.song.beatsPerBar;
      for (let channel = this.song.pitchChannelCount + this.song.noiseChannelCount; channel < this.song.getChannelCount(); channel++) {
        let pattern = this.song.getPattern(channel, bar);
        if (pattern != null) {
          let instrument = this.song.channels[channel].instruments[pattern.instruments[0]];
          for (let mod = 0; mod < Config.modCount; mod++) {
            if (instrument.modulators[mod] == Config.modulators.dictionary["next bar"].index) {
              for (const note of pattern.notes) {
                if (note.pitches[0] == Config.modCount - 1 - mod) {
                  if (partsInBar > note.start)
                    partsInBar = note.start;
                }
              }
            }
          }
        }
      }
      return partsInBar;
    }
    getTotalBars(enableIntro, enableOutro, useLoopCount = this.loopRepeatCount) {
      if (this.song == null) throw new Error();
      let bars = this.song.loopLength * (useLoopCount + 1);
      if (enableIntro) bars += this.song.loopStart;
      if (enableOutro) bars += this.song.barCount - (this.song.loopStart + this.song.loopLength);
      return bars;
    }
    getSamplesPerTick() {
      if (this.song == null) return 0;
      let beatsPerMinute = this.song.getBeatsPerMinute();
      if (this.isModActive(Config.modulators.dictionary["tempo"].index)) {
        beatsPerMinute = this.getModValue(Config.modulators.dictionary["tempo"].index);
      }
      return this.getSamplesPerTickSpecificBPM(beatsPerMinute);
    }
    getSamplesPerTickSpecificBPM(beatsPerMinute) {
      const beatsPerSecond = beatsPerMinute / 60;
      const partsPerSecond = Config.partsPerBeat * beatsPerSecond;
      const tickPerSecond = Config.ticksPerPart * partsPerSecond;
      return this.samplesPerSecond / tickPerSecond;
    }
    computeLatestModValues(modEffects = false) {
      const computeModsMessage = {
        flag: 6 /* computeMods */,
        initFilters: modEffects
      };
      this.sendMessage(computeModsMessage);
      if (this.song != null && this.song.modChannelCount > 0) {
        let latestModTimes = [];
        let latestModInsTimes = [];
        this.modValues = [];
        this.nextModValues = [];
        this.modInsValues = [];
        this.nextModInsValues = [];
        this.heldMods = [];
        for (let channel = 0; channel < this.song.pitchChannelCount + this.song.noiseChannelCount; channel++) {
          latestModInsTimes[channel] = [];
          this.modInsValues[channel] = [];
          this.nextModInsValues[channel] = [];
          for (let instrument = 0; instrument < this.song.channels[channel].instruments.length; instrument++) {
            this.modInsValues[channel][instrument] = [];
            this.nextModInsValues[channel][instrument] = [];
            latestModInsTimes[channel][instrument] = [];
          }
        }
        let currentPart = this.beat * Config.partsPerBeat + this.part;
        for (let channelIndex = this.song.pitchChannelCount + this.song.noiseChannelCount; channelIndex < this.song.getChannelCount(); channelIndex++) {
          if (!this.song.channels[channelIndex].muted) {
            let pattern;
            for (let currentBar = this.bar; currentBar >= 0; currentBar--) {
              pattern = this.song.getPattern(channelIndex, currentBar);
              if (pattern != null) {
                let instrumentIdx = pattern.instruments[0];
                let instrument = this.song.channels[channelIndex].instruments[instrumentIdx];
                let latestPinParts = [];
                let latestPinValues = [];
                let partsInBar = currentBar == this.bar ? currentPart : this.findPartsInBar(currentBar);
                for (const note of pattern.notes) {
                  if (note.start <= partsInBar && (latestPinParts[Config.modCount - 1 - note.pitches[0]] == null || note.end > latestPinParts[Config.modCount - 1 - note.pitches[0]])) {
                    if (note.start == partsInBar) {
                      latestPinParts[Config.modCount - 1 - note.pitches[0]] = note.start;
                      latestPinValues[Config.modCount - 1 - note.pitches[0]] = note.pins[0].size;
                    }
                    if (note.end <= partsInBar) {
                      latestPinParts[Config.modCount - 1 - note.pitches[0]] = note.end;
                      latestPinValues[Config.modCount - 1 - note.pitches[0]] = note.pins[note.pins.length - 1].size;
                    } else {
                      latestPinParts[Config.modCount - 1 - note.pitches[0]] = partsInBar;
                      for (let pinIdx = 0; pinIdx < note.pins.length; pinIdx++) {
                        if (note.pins[pinIdx].time + note.start > partsInBar) {
                          const transitionLength = note.pins[pinIdx].time - note.pins[pinIdx - 1].time;
                          const toNextBarLength = partsInBar - note.start - note.pins[pinIdx - 1].time;
                          const deltaVolume = note.pins[pinIdx].size - note.pins[pinIdx - 1].size;
                          latestPinValues[Config.modCount - 1 - note.pitches[0]] = Math.round(note.pins[pinIdx - 1].size + deltaVolume * toNextBarLength / transitionLength);
                          pinIdx = note.pins.length;
                        }
                      }
                    }
                  }
                }
                for (let mod = 0; mod < Config.modCount; mod++) {
                  if (latestPinParts[mod] != null) {
                    if (Config.modulators[instrument.modulators[mod]].forSong) {
                      const songFilterParam = instrument.modulators[mod] == Config.modulators.dictionary["song eq"].index;
                      if (latestModTimes[instrument.modulators[mod]] == null || currentBar * Config.partsPerBeat * this.song.beatsPerBar + latestPinParts[mod] > latestModTimes[instrument.modulators[mod]]) {
                        if (songFilterParam) {
                          let tgtSong = this.song;
                          if (instrument.modFilterTypes[mod] == 0) {
                            tgtSong.tmpEqFilterStart = tgtSong.eqSubFilters[latestPinValues[mod]];
                          } else {
                            for (let i = 0; i < Config.filterMorphCount; i++) {
                              if (tgtSong.tmpEqFilterStart != null && tgtSong.tmpEqFilterStart == tgtSong.eqSubFilters[i]) {
                                tgtSong.tmpEqFilterStart = new FilterSettings();
                                tgtSong.tmpEqFilterStart.fromJsonObject(tgtSong.eqSubFilters[i].toJsonObject());
                                i = Config.filterMorphCount;
                              }
                            }
                            if (tgtSong.tmpEqFilterStart != null && Math.floor((instrument.modFilterTypes[mod] - 1) / 2) < tgtSong.tmpEqFilterStart.controlPointCount) {
                              if (instrument.modFilterTypes[mod] % 2)
                                tgtSong.tmpEqFilterStart.controlPoints[Math.floor((instrument.modFilterTypes[mod] - 1) / 2)].freq = latestPinValues[mod];
                              else
                                tgtSong.tmpEqFilterStart.controlPoints[Math.floor((instrument.modFilterTypes[mod] - 1) / 2)].gain = latestPinValues[mod];
                            }
                          }
                          tgtSong.tmpEqFilterEnd = tgtSong.tmpEqFilterStart;
                        }
                        this.setModValue(latestPinValues[mod], latestPinValues[mod], instrument.modChannels[mod], instrument.modInstruments[mod], instrument.modulators[mod]);
                        latestModTimes[instrument.modulators[mod]] = currentBar * Config.partsPerBeat * this.song.beatsPerBar + latestPinParts[mod];
                      }
                    } else {
                      let usedInstruments = [];
                      if (instrument.modInstruments[mod] == this.song.channels[instrument.modChannels[mod]].instruments.length) {
                        for (let i = 0; i < this.song.channels[instrument.modChannels[mod]].instruments.length; i++) {
                          usedInstruments.push(i);
                        }
                      } else if (instrument.modInstruments[mod] > this.song.channels[instrument.modChannels[mod]].instruments.length) {
                        const tgtPattern = this.song.getPattern(instrument.modChannels[mod], currentBar);
                        if (tgtPattern != null)
                          usedInstruments = tgtPattern.instruments;
                      } else {
                        usedInstruments.push(instrument.modInstruments[mod]);
                      }
                      for (let instrumentIndex = 0; instrumentIndex < usedInstruments.length; instrumentIndex++) {
                        const eqFilterParam = instrument.modulators[mod] == Config.modulators.dictionary["eq filter"].index;
                        const noteFilterParam = instrument.modulators[mod] == Config.modulators.dictionary["note filter"].index;
                        let modulatorAdjust = instrument.modulators[mod];
                        if (eqFilterParam) {
                          modulatorAdjust = Config.modulators.length + (instrument.modFilterTypes[mod] | 0);
                        } else if (noteFilterParam) {
                          modulatorAdjust = Config.modulators.length + 1 + 2 * Config.filterMaxPoints + (instrument.modFilterTypes[mod] | 0);
                        }
                        if (latestModInsTimes[instrument.modChannels[mod]][usedInstruments[instrumentIndex]][modulatorAdjust] == null || currentBar * Config.partsPerBeat * this.song.beatsPerBar + latestPinParts[mod] > latestModInsTimes[instrument.modChannels[mod]][usedInstruments[instrumentIndex]][modulatorAdjust]) {
                          if (eqFilterParam) {
                            let tgtInstrument = this.song.channels[instrument.modChannels[mod]].instruments[usedInstruments[instrumentIndex]];
                            if (instrument.modFilterTypes[mod] == 0) {
                              tgtInstrument.tmpEqFilterStart = tgtInstrument.eqSubFilters[latestPinValues[mod]];
                            } else {
                              for (let i = 0; i < Config.filterMorphCount; i++) {
                                if (tgtInstrument.tmpEqFilterStart != null && tgtInstrument.tmpEqFilterStart == tgtInstrument.eqSubFilters[i]) {
                                  tgtInstrument.tmpEqFilterStart = new FilterSettings();
                                  tgtInstrument.tmpEqFilterStart.fromJsonObject(tgtInstrument.eqSubFilters[i].toJsonObject());
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
                            let tgtInstrument = this.song.channels[instrument.modChannels[mod]].instruments[usedInstruments[instrumentIndex]];
                            if (instrument.modFilterTypes[mod] == 0) {
                              tgtInstrument.tmpNoteFilterStart = tgtInstrument.noteSubFilters[latestPinValues[mod]];
                            } else {
                              for (let i = 0; i < Config.filterMorphCount; i++) {
                                if (tgtInstrument.tmpNoteFilterStart != null && tgtInstrument.tmpNoteFilterStart == tgtInstrument.noteSubFilters[i]) {
                                  tgtInstrument.tmpNoteFilterStart = new FilterSettings();
                                  tgtInstrument.tmpNoteFilterStart.fromJsonObject(tgtInstrument.noteSubFilters[i].toJsonObject());
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
    determineInvalidModulators(instrument) {
      if (this.song == null)
        return;
      for (let mod = 0; mod < Config.modCount; mod++) {
        instrument.invalidModulators[mod] = true;
        if (instrument.modChannels[mod] == -1) {
          if (instrument.modulators[mod] != 0)
            instrument.invalidModulators[mod] = false;
          continue;
        }
        const channel = this.song.channels[instrument.modChannels[mod]];
        if (channel == null) continue;
        let tgtInstrumentList = [];
        if (instrument.modInstruments[mod] >= channel.instruments.length) {
          tgtInstrumentList = channel.instruments;
        } else {
          tgtInstrumentList = [channel.instruments[instrument.modInstruments[mod]]];
        }
        for (let i = 0; i < tgtInstrumentList.length; i++) {
          const tgtInstrument = tgtInstrumentList[i];
          if (tgtInstrument == null) continue;
          const str = Config.modulators[instrument.modulators[mod]].name;
          if (!(Config.modulators[instrument.modulators[mod]].associatedEffect != 16 /* length */ && !(tgtInstrument.effects & 1 << Config.modulators[instrument.modulators[mod]].associatedEffect) || tgtInstrument.type != 1 /* fm */ && tgtInstrument.type != 11 /* fm6op */ && (str == "fm slider 1" || str == "fm slider 2" || str == "fm slider 3" || str == "fm slider 4" || str == "fm feedback") || tgtInstrument.type != 11 /* fm6op */ && (str == "fm slider 5" || str == "fm slider 6") || tgtInstrument.type != 6 /* pwm */ && tgtInstrument.type != 8 /* supersaw */ && (str == "pulse width" || str == "decimal offset") || tgtInstrument.type != 8 /* supersaw */ && (str == "dynamism" || str == "spread" || str == "saw shape") || !tgtInstrument.getChord().arpeggiates && (str == "arp speed" || str == "reset arp") || tgtInstrument.eqFilterType && str == "eq filter" || !tgtInstrument.eqFilterType && (str == "eq filt cut" || str == "eq filt peak") || str == "eq filter" && Math.floor((instrument.modFilterTypes[mod] + 1) / 2) > tgtInstrument.getLargestControlPointCount(false) || tgtInstrument.noteFilterType && str == "note filter" || !tgtInstrument.noteFilterType && (str == "note filt cut" || str == "note filt peak") || str == "note filter" && Math.floor((instrument.modFilterTypes[mod] + 1) / 2) > tgtInstrument.getLargestControlPointCount(true))) {
            instrument.invalidModulators[mod] = false;
            i = tgtInstrumentList.length;
          }
        }
      }
    }
    setModValue(volumeStart, volumeEnd, channelIndex, instrumentIndex, setting) {
      let val = volumeStart + Config.modulators[setting].convertRealFactor;
      let nextVal = volumeEnd + Config.modulators[setting].convertRealFactor;
      if (Config.modulators[setting].forSong) {
        if (this.modValues[setting] == -1 || this.modValues[setting] != val || this.nextModValues[setting] != nextVal) {
          this.modValues[setting] = val;
          this.nextModValues[setting] = nextVal;
        }
      } else {
        if (this.modInsValues[channelIndex][instrumentIndex][setting] == null || this.modInsValues[channelIndex][instrumentIndex][setting] != val || this.nextModInsValues[channelIndex][instrumentIndex][setting] != nextVal) {
          this.modInsValues[channelIndex][instrumentIndex][setting] = val;
          this.nextModInsValues[channelIndex][instrumentIndex][setting] = nextVal;
        }
      }
      return val;
    }
    getModValue(setting, channel, instrument, nextVal) {
      const forSong = Config.modulators[setting].forSong;
      if (forSong) {
        if (this.modValues[setting] != -1 && this.nextModValues[setting] != -1) {
          return nextVal ? this.nextModValues[setting] : this.modValues[setting];
        }
      } else if (channel != void 0 && instrument != void 0) {
        if (this.modInsValues[channel][instrument][setting] != null && this.nextModInsValues[channel][instrument][setting] != null) {
          return nextVal ? this.nextModInsValues[channel][instrument][setting] : this.modInsValues[channel][instrument][setting];
        }
      }
      return -1;
    }
    // Checks if any mod is active for the given channel/instrument OR if any mod is active for the song scope. Could split the logic if needed later.
    isAnyModActive(channel, instrument) {
      for (let setting = 0; setting < Config.modulators.length; setting++) {
        if (this.modValues != void 0 && this.modValues[setting] != null || this.modInsValues != void 0 && this.modInsValues[channel] != void 0 && this.modInsValues[channel][instrument] != void 0 && this.modInsValues[channel][instrument][setting] != null) {
          return true;
        }
      }
      return false;
    }
    unsetMod(setting, channel, instrument) {
      if (this.isModActive(setting) || channel != void 0 && instrument != void 0 && this.isModActive(setting, channel, instrument)) {
        this.modValues[setting] = -1;
        this.nextModValues[setting] = -1;
        for (let i = 0; i < this.heldMods.length; i++) {
          if (channel != void 0 && instrument != void 0) {
            if (this.heldMods[i].channelIndex == channel && this.heldMods[i].instrumentIndex == instrument && this.heldMods[i].setting == setting)
              this.heldMods.splice(i, 1);
          } else {
            if (this.heldMods[i].setting == setting)
              this.heldMods.splice(i, 1);
          }
        }
        if (channel != void 0 && instrument != void 0) {
          this.modInsValues[channel][instrument][setting] = null;
          this.nextModInsValues[channel][instrument][setting] = null;
        }
      }
    }
    isFilterModActive(forNoteFilter, channelIdx, instrumentIdx, forSong) {
      const instrument = this.song.channels[channelIdx].instruments[instrumentIdx];
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
      return false;
    }
    isModActive(setting, channel, instrument) {
      const forSong = Config.modulators[setting].forSong;
      if (forSong) {
        return this.modValues != void 0 && this.modValues[setting] != null;
      } else if (channel != void 0 && instrument != void 0 && this.modInsValues != void 0 && this.modInsValues[channel] != null && this.modInsValues[channel][instrument] != null) {
        return this.modInsValues[channel][instrument][setting] != null;
      }
      return false;
    }
    // Force a modulator to be held at the given volumeStart for a brief duration.
    forceHoldMods(volumeStart, channelIndex, instrumentIndex, setting) {
      let found = false;
      for (let i = 0; i < this.heldMods.length; i++) {
        if (this.heldMods[i].channelIndex == channelIndex && this.heldMods[i].instrumentIndex == instrumentIndex && this.heldMods[i].setting == setting) {
          this.heldMods[i].volume = volumeStart;
          this.heldMods[i].holdFor = 24;
          found = true;
        }
      }
      if (!found)
        this.heldMods.push({ volume: volumeStart, channelIndex, instrumentIndex, setting, holdFor: 24 });
    }
    static fadeInSettingToSeconds(setting) {
      return 0.0125 * (0.95 * setting + 0.05 * setting * setting);
    }
    static secondsToFadeInSetting(seconds) {
      return clamp(0, Config.fadeInRange, Math.round((-0.95 + Math.sqrt(0.9025 + 0.2 * seconds / 0.0125)) / 0.1));
    }
    static fadeOutSettingToTicks(setting) {
      return Config.fadeOutTicks[setting];
    }
    static ticksToFadeOutSetting(ticks) {
      let lower = Config.fadeOutTicks[0];
      if (ticks <= lower) return 0;
      for (let i = 1; i < Config.fadeOutTicks.length; i++) {
        let upper = Config.fadeOutTicks[i];
        if (ticks <= upper) return ticks < (lower + upper) / 2 ? i - 1 : i;
        lower = upper;
      }
      return Config.fadeOutTicks.length - 1;
    }
    static detuneToCents(detune) {
      return detune - Config.detuneCenter;
    }
    static centsToDetune(cents) {
      return cents + Config.detuneCenter;
    }
    static fittingPowerOfTwo(x) {
      return 1 << 32 - Math.clz32(Math.ceil(x) - 1);
    }
    static adjacentNotesHaveMatchingPitches(firstNote, secondNote) {
      if (firstNote.pitches.length != secondNote.pitches.length) return false;
      const firstNoteInterval = firstNote.pins[firstNote.pins.length - 1].interval;
      for (const pitch of firstNote.pitches) {
        if (secondNote.pitches.indexOf(pitch + firstNoteInterval) == -1) return false;
      }
      return true;
    }
    static instrumentVolumeToVolumeMult(instrumentVolume) {
      return instrumentVolume == -Config.volumeRange / 2 ? 0 : Math.pow(2, Config.volumeLogScale * instrumentVolume);
    }
    static volumeMultToInstrumentVolume(volumeMult) {
      return volumeMult <= 0 ? -Config.volumeRange / 2 : Math.min(Config.volumeRange, Math.log(volumeMult) / Math.LN2 / Config.volumeLogScale);
    }
    static noteSizeToVolumeMult(size) {
      return Math.pow(Math.max(0, size) / Config.noteSizeMax, 1.5);
    }
    static volumeMultToNoteSize(volumeMult) {
      return Math.pow(Math.max(0, volumeMult), 1 / 1.5) * Config.noteSizeMax;
    }
  };
  return __toCommonJS(synth_exports);
})();
/*!
Copyright (c) 2012-2022 John Nesky and contributing authors

Permission is hereby granted, free of charge, to any person obtaining a copy of 
this software and associated documentation files (the "Software"), to deal in 
the Software without restriction, including without limitation the rights to 
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies 
of the Software, and to permit persons to whom the Software is furnished to do 
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all 
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, 
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE 
SOFTWARE.
*/
//# sourceMappingURL=beepbox_synth.js.map
