# SoundFont engine

SpessaSynth is by spessasus and contributors, licensed under Apache-2.0.

- spessasynth_lib 4.3.14: https://github.com/spessasus/spessasynth_lib
- spessasynth_core 4.3.22: https://github.com/spessasus/spessasynth_core

`spessasynth.js` bundles the pinned library and core with esbuild 0.25.11. `spessasynth_processor.min.js` is copied from the matching library package without modification. Their Apache-2.0 licenses are included here. Source and source attribution remain available at the upstream repositories; npm package versions and integrity hashes are pinned by package-lock.json.

Regenerate both browser files together using `npm ci` and `npm run vendor:soundfonts`. The site is buildless because the generated files are committed.

Font files are user-provided content, hosted separately on R2 or selected locally, and are not part of these software packages or licenses.
