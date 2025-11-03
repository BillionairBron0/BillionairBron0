// Minimal prototype Signal Engine implementing core prompt contract.
// Refactored to use indicator registry for leading indicators.
import { getIndicator } from './indicators/registry.js';

const DEFAULT_CONFIG = {
  signalExpiryCandles: 3,
  alternateSignal: true,
  leadingIndicator: 'Range Filter',
  confirmationsEnabled: ['EMA200','MACD','RSI','Supertrend'],
  minConfluence: 1.0,
  supertrend: { period: 10, multiplier: 3 }
};

export class SignalEngine {
  constructor(cfg) {
    this.config = { ...DEFAULT_CONFIG, ...cfg };
    this.state = {
      lastConfirmedSide: null,
      pending: null,
      barIndex: 0,
      history: []
    };
  this._emaCache = new Map(); // key: period -> { value, lastIndex }
  }

  updateConfig(patch) { this.config = { ...this.config, ...patch }; }
  getConfig() { return this.config; }

  ingestBar(bar) {
    this.state.barIndex++;
    this.state.history.push(bar);
    if (this.state.history.length > 5000) this.state.history.shift();

    const events = [];
    const leading = this.evalLeading();
    const confirmations = this.evalConfirmations();

    const { pending } = this.state;
    if (pending) {
      pending.barsElapsed++;
      const side = pending.side;
      const passed = this.collectPassed(confirmations, side);
      passed.forEach(p => pending.confirmationsPassed.add(p));
      const allSelected = this.config.confirmationsEnabled;
      const confluenceScore = pending.confirmationsPassed.size / (allSelected.length || 1);
      if (pending.confirmationsPassed.size === allSelected.length && confluenceScore >= this.config.minConfluence) {
        const evt = this.buildActionable(side, bar, leading, pending, confluenceScore);
        events.push(evt);
        this.state.lastConfirmedSide = side;
        this.state.pending = null;
      } else if (pending.barsElapsed > this.config.signalExpiryCandles) {
        events.push({ type: 'expiredSetup', side, reason: 'CONFIRMATIONS_TIMEOUT', leadingStartTime: pending.startedTime, barsWaited: pending.barsElapsed });
        this.state.pending = null;
      } else if (passed.size) {
        events.push(this.buildWatch(side, bar, pending));
      }
    }

    const altRuleBlocksLong = this.config.alternateSignal && this.state.lastConfirmedSide === 'LONG';
    const altRuleBlocksShort = this.config.alternateSignal && this.state.lastConfirmedSide === 'SHORT';
    if (!this.state.pending) {
      if (leading.longTrigger && !altRuleBlocksLong) {
        this.openPending('LONG', bar, leading.longRationale);
        events.push(this.buildWatch('LONG', bar, this.state.pending));
      } else if (leading.shortTrigger && !altRuleBlocksShort) {
        this.openPending('SHORT', bar, leading.shortRationale);
        events.push(this.buildWatch('SHORT', bar, this.state.pending));
      }
    } else {
      if (this.state.pending.side === 'LONG' && leading.shortTrigger && !altRuleBlocksShort) {
        events.push({ type: 'cancelledSetup', side: 'LONG', reason: 'OPPOSITE_TRIGGER' });
        this.openPending('SHORT', bar, leading.shortRationale);
        events.push(this.buildWatch('SHORT', bar, this.state.pending));
      } else if (this.state.pending.side === 'SHORT' && leading.longTrigger && !altRuleBlocksLong) {
        events.push({ type: 'cancelledSetup', side: 'SHORT', reason: 'OPPOSITE_TRIGGER' });
        this.openPending('LONG', bar, leading.longRationale);
        events.push(this.buildWatch('LONG', bar, this.state.pending));
      }
    }
    return events;
  }

  evalLeading() {
    const ind = getIndicator(this.config.leadingIndicator);
    if (!ind) return { longTrigger:false, shortTrigger:false };
    return ind.compute(this.state, this.config);
  }

  openPending(side, bar, rationale) {
    this.state.pending = {
      side,
      confirmationsPassed: new Set(),
      startedTime: bar.time,
      leadingRationale: rationale,
      barsElapsed: 0
    };
  }

  buildWatch(side, bar, pending) {
    const all = this.config.confirmationsEnabled;
    const passed = Array.from(pending.confirmationsPassed);
    const missing = all.filter(x => !pending.confirmationsPassed.has(x));
    return {
      type: 'watchOpportunity',
      side,
      status: 'PENDING',
      time: bar.time,
      price: bar.close,
      barsSinceLeading: pending.barsElapsed,
      confirmationsPassed: passed,
      confirmationsMissing: missing,
      expiresInBars: this.config.signalExpiryCandles - pending.barsElapsed
    };
  }

  buildActionable(side, bar, leading, pending, confluenceScore) {
    return {
      type: 'actionableSignal',
      side,
      status: 'ACTIONABLE',
      time: bar.time,
      price: bar.close,
      leadingIndicator: {
        name: this.config.leadingIndicator,
        rationale: pending.leadingRationale || (side === 'LONG' ? leading.longRationale : leading.shortRationale)
      },
      confirmations: {
        passed: Array.from(pending.confirmationsPassed),
        failed: []
      },
      confluenceScore,
      risk: this.calcBasicRisk(bar),
      reasonSummary: `Leading=${this.config.leadingIndicator}; Confirmations=${Array.from(pending.confirmationsPassed).join(',')}`
    };
  }

  calcBasicRisk(bar) {
    const hist = this.state.history;
    if (hist.length < 15) return { note: 'insufficient_data' };
    const recent = hist.slice(-15);
    const atr = this.simpleATR(14);
    const swingLow = Math.min(...recent.map(b=>b.low));
    const swingHigh = Math.max(...recent.map(b=>b.high));
    return {
      atr,
      suggestedStops: { conservative: swingLow, adaptiveATRx1_5: bar.close - atr * 1.5 },
      suggestedTakeProfits: [ { method: 'R-multiple', R: 1, level: bar.close + atr * 1 }, { method: 'StructureHigh', level: swingHigh } ]
    };
  }

  simpleATR(n) {
    const h = this.state.history;
    if (h.length < n+1) return null;
    let sum = 0;
    for (let i=h.length-n; i<h.length; i++) {
      const prev = h[i-1];
      const cur = h[i];
      const tr = Math.max(cur.high - cur.low, Math.abs(cur.high - prev.close), Math.abs(cur.low - prev.close));
      sum += tr;
    }
    return sum / n;
  }

  collectPassed(confirmations, side) {
    const set = new Set();
    for (const key of this.config.confirmationsEnabled) {
      const k = confirmations[side.toLowerCase()][key];
      if (k === true) set.add(key);
    }
    return set;
  }

  leadSupertrend() {
    const st = this.calcSupertrend();
    if (!st) return { longTrigger:false, shortTrigger:false };
    const last = st[st.length-1];
    return {
      longTrigger: last.trend === 'LONG' && last.flipped,
      shortTrigger: last.trend === 'SHORT' && last.flipped,
      longRationale: last.trend === 'LONG' ? `Supertrend flip up @ ${last.close}`: 'no flip',
      shortRationale: last.trend === 'SHORT' ? `Supertrend flip down @ ${last.close}`: 'no flip'
    };
  }

  leadRangeFilter() {
    // Simplified: price close above rolling SMA(20) + k*stdev => long trigger; below => short trigger
    const hist = this.state.history;
    if (hist.length < 25) return { longTrigger: false, shortTrigger: false };
    const closes = hist.slice(-20).map(b=>b.close);
    const mean = closes.reduce((a,b)=>a+b,0)/closes.length;
    const variance = closes.reduce((a,b)=>a+Math.pow(b-mean,2),0)/closes.length;
    const stdev = Math.sqrt(variance);
    const k=1.5;
    const last = hist[hist.length-1].close;
    return {
      longTrigger: last > mean + k*stdev,
      shortTrigger: last < mean - k*stdev,
      longRationale: `close ${last.toFixed(2)} > upperBand ${(mean + k*stdev).toFixed(2)}`,
      shortRationale: `close ${last.toFixed(2)} < lowerBand ${(mean - k*stdev).toFixed(2)}`
    };
  }

  leadMACD() {
    const macd = this.calcMACD();
    if (!macd) return { longTrigger:false, shortTrigger:false };
    const { line, signal } = macd;
    return {
      longTrigger: line > signal && line > 0,
      shortTrigger: line < signal && line < 0,
      longRationale: `MACD line ${line.toFixed(4)} > signal ${signal.toFixed(4)} > 0`,
      shortRationale: `MACD line ${line.toFixed(4)} < signal ${signal.toFixed(4)} < 0`
    };
  }

  evalConfirmations() {
    return {
      long: this.evalSideConfirmations('LONG'),
      short: this.evalSideConfirmations('SHORT')
    };
  }

  evalSideConfirmations(side) {
    const out = {};
    for (const key of this.config.confirmationsEnabled) {
      switch (key) {
        case 'EMA200': out[key] = this.confirmEMA(200, side); break;
        case 'MACD': out[key] = this.confirmMACD(side); break;
        case 'RSI': out[key] = this.confirmRSI(side); break;
        case 'Supertrend': out[key] = this.confirmSupertrend(side); break;
        default: out[key] = false; break;
      }
    }
    return out;
  }

  confirmSupertrend(side) {
    const st = this.calcSupertrend();
    if (!st) return false;
    const last = st[st.length-1];
    return side === 'LONG' ? last.trend === 'LONG' : last.trend === 'SHORT';
  }

  confirmEMA(len, side) {
    const ema = this.calcEMA(len);
    if (ema == null) return false;
    const close = this.state.history[this.state.history.length-1].close;
    return side === 'LONG' ? close > ema : close < ema;
  }

  confirmMACD(side) {
    const macd = this.calcMACD();
    if (!macd) return false;
    return side === 'LONG' ? macd.line > macd.signal : macd.line < macd.signal;
  }

  confirmRSI(side) {
    const rsi = this.calcRSI(14);
    if (rsi == null) return false;
    return side === 'LONG' ? rsi > 50 : rsi < 50;
  }

  calcEMA(period) {
    const hist = this.state.history;
    if (hist.length < period) return null;
    const k = 2/(period+1);
    let ema = hist[hist.length-period].close;
    for (let i=hist.length-period+1; i<hist.length; i++) {
      ema = hist[i].close * k + ema * (1-k);
    }
    return ema;
  }

  calcMACD() {
    const fast=12, slow=26, signal=9;
    const hist = this.state.history;
    if (hist.length < slow + signal) return null;
    // Build series of closes for efficiency
    const closes = hist.map(b=>b.close);
    const emaSeries = (period) => {
      const k = 2/(period+1);
      let arr = [];
      let ema = closes[0];
      for (let i=0;i<closes.length;i++) {
        ema = i===0 ? closes[i] : closes[i]*k + ema*(1-k);
        arr.push(ema);
      }
      return arr;
    };
    const emaFast = emaSeries(fast);
    const emaSlow = emaSeries(slow);
    const macdLineSeries = emaFast.map((v,i)=> v - emaSlow[i]);
    // signal line
    const kSig = 2/(signal+1);
    let sigArr=[]; let sig = macdLineSeries[slow];
    for (let i=0;i<macdLineSeries.length;i++) {
      sig = i===0 ? macdLineSeries[i] : macdLineSeries[i]*kSig + sig*(1-kSig);
      sigArr.push(sig);
    }
    const line = macdLineSeries[macdLineSeries.length-1];
    const signalLine = sigArr[sigArr.length-1];
    return { line, signal: signalLine };
  }

  calcSupertrend() {
    const { period, multiplier } = this.config.supertrend;
    const h = this.state.history;
    if (h.length < period+2) return null;
    const atr = (idx) => {
      if (idx < period) return null;
      let sum=0; for (let i=idx-period+1;i<=idx;i++) {
        const cur = h[i]; const prev = h[i-1];
        const tr = Math.max(cur.high-cur.low, Math.abs(cur.high-prev.close), Math.abs(cur.low-prev.close));
        sum += tr;
      }
      return sum/period;
    };
    const out=[]; let trend='LONG'; let upper=0; let lower=0; let prevClose=null;
    for (let i=0;i<h.length;i++) {
      const bar = h[i];
      const a = atr(i); if (a==null) { out.push({}); continue; }
      const basicUpper = (bar.high+bar.low)/2 + multiplier * a;
      const basicLower = (bar.high+bar.low)/2 - multiplier * a;
      if (i===0 || !upper) { upper=basicUpper; lower=basicLower; }
      else {
        upper = (basicUpper < upper || prevClose > upper) ? basicUpper : upper;
        lower = (basicLower > lower || prevClose < lower) ? basicLower : lower;
      }
      let flipped=false;
      if (trend === 'LONG' && bar.close < lower) { trend='SHORT'; flipped=true; }
      else if (trend === 'SHORT' && bar.close > upper) { trend='LONG'; flipped=true; }
      out.push({ trend, flipped, upper, lower, close: bar.close });
      prevClose = bar.close;
    }
    return out;
  }

  calcRSI(period) {
    const hist = this.state.history;
    if (hist.length < period+1) return null;
    let gains=0, losses=0;
    for (let i=hist.length-period; i<hist.length; i++) {
      const diff = hist[i].close - hist[i-1].close;
      if (diff>0) gains += diff; else losses -= diff;
    }
    const rs = gains / (losses || 1e-9);
    return 100 - 100/(1+rs);
  }
  _ema(series, period) {
    // incremental EMA cache to avoid recomputing whole history each bar
    if (series.length === 0) return NaN;
    const key = period;
    let entry = this._emaCache.get(key);
    if (!entry || entry.lastIndex !== series.length - 2) { // rebuild fully
      let value;
      for (let i = 0; i < series.length; i++) {
        const price = series[i];
        if (i === 0) value = price; else value = price * (2/(period+1)) + value * (1 - 2/(period+1));
      }
      entry = { value, lastIndex: series.length - 1 };
      this._emaCache.set(key, entry);
      return entry.value;
    }
    // normal incremental update should have lastIndex === series.length -2
    const price = series[series.length - 1];
    const k = 2/(period+1);
    entry.value = price * k + entry.value * (1 - k);
    entry.lastIndex = series.length - 1;
    return entry.value;
  }
}
