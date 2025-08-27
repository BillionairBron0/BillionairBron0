import axios from 'axios';

const symbols = ['SIMBTC','SIMETH'];
let t = Date.now();
const state = Object.fromEntries(symbols.map(s => [s, { price: 100 + Math.random()*10 }]));

async function loop() {
  for (const s of symbols) {
    const st = state[s];
    // random walk
    const drift = (Math.random()-0.5)*2;
    st.price = Math.max(1, st.price + drift);
    const high = st.price + Math.random();
    const low = st.price - Math.random();
    const bar = {
      symbol: s,
      time: new Date(t).toISOString(),
      open: st.price - drift,
      high,
      low,
      close: st.price,
      volume: 100 + Math.random()*50
    };
    try {
      await axios.post('http://localhost:4000/ingest/bar', bar);
    } catch (e) { /* ignore */ }
  }
  t += 60_000;
  setTimeout(loop, 500);
}
loop();