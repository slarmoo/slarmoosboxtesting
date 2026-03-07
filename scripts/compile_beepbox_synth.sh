#!/bin/bash
set -e

# Compile synth/synth.ts into build/synth/synth.js and dependencies
npx tsc -p tsconfig_synth_only.json

# Combine build/synth/synth.js and dependencies into website/beepbox_synth.js
npx rollup build/synth/synth.js \
	--file ./website/beepbox_synth.js \
	--format iife \
	--output.name beepbox \
	--context exports \
	--sourcemap \
	--plugin @rollup/plugin-node-resolve \
	--plugin @rollup/plugin-commonjs

# Minify website/beepbox_synth.js into website/beepbox_synth.min.js
npx terser \
	./website/beepbox_synth.js \
	--source-map "content='./website/beepbox_synth.js.map',url=beepbox_synth.min.js.map" \
	-o ./website/beepbox_synth.min.js \
	--compress \
	--define OFFLINE=false \
	--define TESTING=true \
	--mangle \
	--mangle-props regex="/^_.+/;"

#build worklet
npx esbuild --format=esm --keep-names --platform=neutral --main-fields=main --bundle ./synth/processor.ts --outfile=website/beepbox_processor.js --sourcemap
npx esbuild --format=esm --keep-names --platform=neutral --main-fields=main --bundle ./synth/synthThread.ts --outfile=website/beepbox_synth_processor.js --sourcemap --define:TESTING=true --define:document="{}" --define:alert=console.log
