import {build} from 'esbuild';
import fs from 'node:fs/promises';
await build({entryPoints:['node_modules/spessasynth_lib/dist/index.js'],bundle:true,format:'esm',minify:true,outfile:'js/vendor/spessasynth.js'});
await fs.copyFile('node_modules/spessasynth_lib/dist/spessasynth_processor.min.js','js/vendor/spessasynth_processor.min.js');
await fs.copyFile('node_modules/spessasynth_lib/LICENSE','js/vendor/spessasynth-LICENSE.txt');
await fs.copyFile('node_modules/spessasynth_core/LICENSE','js/vendor/spessasynth-core-LICENSE.txt');
