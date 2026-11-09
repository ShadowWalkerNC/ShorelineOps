import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
const base = process.env.LOCALAPPDATA || path.join(os.homedir(), ...(process.platform === 'win32' ? ['AppData','Local'] : ['.local','share']));
export const runtimeDirectory = process.env.SYLVIA_RUNTIME_DIR || path.join(base, 'SylviaRossMenuProcessor', 'runtime-1.64.1');
const runtimeRequire = createRequire(path.join(runtimeDirectory, 'package.json'));
export const chromium: typeof import('playwright').chromium = runtimeRequire('playwright').chromium;