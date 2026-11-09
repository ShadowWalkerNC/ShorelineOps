import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
execFileSync(process.execPath,['scripts/build-shoreline.mjs',path.resolve(root,'../../server/vendor/ross-paperwork')],{cwd:root,stdio:'inherit'});
