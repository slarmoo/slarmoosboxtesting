#!/bin/bash
set -e

# Compile synth/synth_processor.ts into build/synth/synth_processor.js and dependencies
npx tsc -p tsconfig_synth_processor.json

# Combine build/synth/synth_processor.js and dependencies into website/beepbox_synth_processor.js
npx rollup build/synth/synth_processor.js \
	--file ./website/beepbox_synth_processor.js \
	--format iife \
	--output.name beepbox \
	--context exports \
	--sourcemap \
	--plugin @rollup/plugin-node-resolve

# Minify website/beepbox_synth_processor.js into website/beepbox_synth_processor.min.js
npx terser \
	./website/beepbox_synth_processor.js \
	--source-map "content='./website/beepbox_synth_processor.js.map',url=beepbox_synth_processor.min.js.map" \
	-o ./website/beepbox_synth_processor.min.js \
	--compress \
	--define OFFLINE=false \
	--define TESTING=true \
	--mangle \
	--mangle-props regex="/^_.+/;"