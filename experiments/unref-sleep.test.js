import { test, expect } from 'bun:test';
function sleep(ms){return new Promise(r=>{const t=setTimeout(r,ms); if(t.unref) t.unref();});}
test('unref sleep resolves', async () => { const s=Date.now(); await sleep(2000); expect(Date.now()-s).toBeGreaterThan(1500); });
