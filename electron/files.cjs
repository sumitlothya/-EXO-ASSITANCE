const { ipcMain, shell, app } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// The bot can only touch files inside these roots. Add 'D:\\' if you want another drive.
const ALLOWED_ROOTS = [os.homedir()];

const SKIP = new Set(['node_modules', 'appdata', '.git']);

function folders() {
  const f = {};
  for (const k of ['desktop', 'documents', 'downloads', 'pictures', 'music', 'videos']) {
    try { f[k] = app.getPath(k); } catch {}
  }
  return f;
}

function isAllowed(p) {
  const full = path.resolve(p).toLowerCase();
  return ALLOWED_ROOTS.some((r) => {
    const root = path.resolve(r).toLowerCase();
    return full === root || full.startsWith(root + path.sep);
  });
}

// Find a file/folder by name in Desktop, Documents, Downloads, etc. (depth 3)
function findByName(name, roots) {
  const wanted = name.toLowerCase();
  let best = null;
  const queue = (roots || Object.values(folders())).map((p) => [p, 0]);
  let visited = 0;

  while (queue.length && visited < 20000) {
    const [dir, depth] = queue.shift();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }

    for (const e of entries) {
      visited++;
      if (e.name.startsWith('.') || SKIP.has(e.name.toLowerCase())) continue;
      const full = path.join(dir, e.name);
      const lower = e.name.toLowerCase();
      const base = path.parse(lower).name;

      if (lower === wanted || base === wanted) return full; // exact match wins
      if (!best && lower.includes(wanted)) best = full;     // partial match fallback
      if (e.isDirectory() && depth < 3) queue.push([full, depth + 1]);
    }
  }
  return best;
}

// Turn what the user said into a real path
function resolveTarget(input, inFolder) {
  const text = String(input).trim().replace(/^["']|["']$/g, '').replace(/[.!?]+$/, '');
  const known = folders()[text.toLowerCase()];
  if (known) return known;
  if (path.isAbsolute(text)) return fs.existsSync(text) ? text : null;
  if (inFolder) {
    const base = folders()[String(inFolder).toLowerCase()];
    return base ? findByName(text, [base]) : null;
  }
  return findByName(text);
}

ipcMain.handle('file-open', async (_e, input, inFolder) => {
  const target = resolveTarget(input, inFolder);
  if (!target) return `I couldn't find "${input}".`;
  if (!isAllowed(target)) return "I'm not allowed to open files there.";
  const err = await shell.openPath(target);
  return err ? `Couldn't open it: ${err}` : `Opened ${path.basename(target)}.`;
});

ipcMain.handle('file-move', async (_e, srcInput, destInput) => {
  const src = resolveTarget(srcInput);
  if (!src) return `I couldn't find "${srcInput}".`;

  const dest = resolveTarget(destInput);
  if (!dest || !fs.existsSync(dest) || !fs.statSync(dest).isDirectory())
    return `I couldn't find the folder "${destInput}".`;

  if (!isAllowed(src) || !isAllowed(dest)) return "I'm not allowed to move files there.";

  const newPath = path.join(dest, path.basename(src));
  if (fs.existsSync(newPath)) return `A file named ${path.basename(src)} already exists there.`;

  try {
    try {
      fs.renameSync(src, newPath);
    } catch (err) {
      if (err.code !== 'EXDEV') throw err; // different drive: copy then delete
      fs.cpSync(src, newPath, { recursive: true });
      fs.rmSync(src, { recursive: true });
    }
    return `Moved ${path.basename(src)} to ${path.basename(dest)}.`;
  } catch (err) {
    return `Couldn't move it: ${err.message}`;
  }
});

// Open a website in the default browser (https only)
ipcMain.handle('open-url', async (_e, url) => {
  if (!/^https:\/\//i.test(String(url))) return 'Only https links are allowed.';
  await shell.openExternal(url);
  return 'Opened.';
});

// ---------- Apps (only the ones listed here can be opened) ----------
// kind 'cmd'  : launched with Windows "start"
// kind 'uri'  : opened through its protocol link
const APPS = {
  chrome: { kind: 'cmd', run: 'chrome' },
  'google chrome': { kind: 'cmd', run: 'chrome' },
  notepad: { kind: 'cmd', run: 'notepad' },
  calculator: { kind: 'cmd', run: 'calc' },
  calc: { kind: 'cmd', run: 'calc' },
  'file explorer': { kind: 'cmd', run: 'explorer' },
  explorer: { kind: 'cmd', run: 'explorer' },
  vscode: { kind: 'cmd', run: 'code' },
  'vs code': { kind: 'cmd', run: 'code' },
  'visual studio code': { kind: 'cmd', run: 'code' },
  discord: { kind: 'uri', run: 'discord://' },
  spotify: { kind: 'uri', run: 'spotify:' },
  settings: { kind: 'uri', run: 'ms-settings:' },
};

// Returns a reply string, or null if the name is not an app (so files can be tried)
ipcMain.handle('app-open', async (_e, input) => {
  const name = String(input).trim().toLowerCase().replace(/[.!?]+$/, '').replace(/\s+app$/, '');
  const entry = APPS[name];
  if (!entry) return null;

  try {
    if (entry.kind === 'uri') {
      await shell.openExternal(entry.run);
    } else {
      spawn('cmd', ['/c', 'start', '""', entry.run], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      }).unref();
    }
    return `Opening ${name}!`;
  } catch (err) {
    return `Couldn't open ${name}: ${err.message}`;
  }
});

// ---------- Browse folders like File Explorer ----------
// Newest files first; skips hidden files and unfinished downloads
function newestEntries(dir, filesOnly) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const lower = e.name.toLowerCase();
    if (e.name.startsWith('.') || lower === 'desktop.ini') continue;
    if (lower.endsWith('.crdownload') || lower.endsWith('.part') || lower.endsWith('.tmp')) continue;
    if (filesOnly && !e.isFile()) continue;
    try {
      out.push({ name: e.name, full: path.join(dir, e.name), time: fs.statSync(path.join(dir, e.name)).mtimeMs });
    } catch {}
  }
  return out.sort((a, b) => b.time - a.time);
}

ipcMain.handle('file-list', async (_e, folderName) => {
  const dir = folders()[String(folderName).toLowerCase()];
  if (!dir) return `I don't know the folder "${folderName}".`;
  try {
    const items = newestEntries(dir, false).slice(0, 10);
    if (!items.length) return `Your ${folderName} folder is empty.`;
    return `Newest in ${folderName}: ${items.map((i) => i.name).join(', ')}. Say "open" and a name to open one.`;
  } catch (err) {
    return `Couldn't read ${folderName}: ${err.message}`;
  }
});

ipcMain.handle('file-latest', async (_e, folderName) => {
  const dir = folders()[String(folderName).toLowerCase()];
  if (!dir) return `I don't know the folder "${folderName}".`;
  try {
    const latest = newestEntries(dir, true)[0];
    if (!latest) return `There are no files in ${folderName}.`;
    if (!isAllowed(latest.full)) return "I'm not allowed to open files there.";
    const err = await shell.openPath(latest.full);
    return err ? `Couldn't open it: ${err}` : `Opened ${latest.name}.`;
  } catch (err) {
    return `Couldn't read ${folderName}: ${err.message}`;
  }
});
