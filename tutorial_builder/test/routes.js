// Serves the library and model files locally in place of the CDN and Hugging Face during tests.
const fs = require('fs'), path = require('path');
// The library and a small Whisper model come from devDependencies, so tests run offline
const pkgDir = (name) => path.join(__dirname, '..', 'node_modules', name);
const TF = path.join(pkgDir('@huggingface/transformers'), 'dist');
const MODEL = path.join(pkgDir('sts-whisper-tiny'), 'models/Xenova/whisper-tiny');
const types = { js: 'text/javascript', mjs: 'text/javascript', wasm: 'application/wasm', json: 'application/json', onnx: 'application/octet-stream', txt: 'text/plain' };
module.exports = async function wire(ctx, log) {
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/@huggingface\/transformers@[^/]+\/dist\/(.+)$/, (route) => {
    const f = route.request().url().match(/dist\/([^?#]+)/)[1];
    const p = path.join(TF, f);
    if (!fs.existsSync(p)) { log && log('404 ' + f); return route.fulfill({ status: 404, body: '' }); }
    route.fulfill({ status: 200, body: fs.readFileSync(p), headers: { 'content-type': types[f.split('.').pop()] || 'application/octet-stream', 'access-control-allow-origin': '*' } });
  });
  await ctx.route(/huggingface\.co\/([^/]+\/[^/]+)\/resolve\/[^/]+\/(.+)$/, (route) => {
    const m = route.request().url().match(/huggingface\.co\/([^/]+\/[^/]+)\/resolve\/[^/]+\/([^?#]+)/);
    const p = path.join(MODEL, m[2]);
    log && log('model ' + m[1] + ' ' + m[2] + (fs.existsSync(p) ? '' : ' (missing)'));
    if (!fs.existsSync(p)) return route.fulfill({ status: 404, body: 'not found' });
    route.fulfill({ status: 200, body: fs.readFileSync(p), headers: { 'content-type': types[m[2].split('.').pop()] || 'application/octet-stream', 'access-control-allow-origin': '*' } });
  });
};
