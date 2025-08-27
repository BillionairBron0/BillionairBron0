import { AlpacaBroker } from './alpacaBroker.js';

// Simple in-memory credential store; replace with encrypted DB vault in production.
const creds = {
  alpaca: {
    key: process.env.ALPACA_KEY_ID,
    secret: process.env.ALPACA_SECRET_KEY,
    paper: process.env.ALPACA_PAPER !== '0'
  }
};

let instances = {};

export function getBroker(name) {
  if (name === 'alpaca') {
    if (!instances.alpaca) instances.alpaca = new AlpacaBroker(creds.alpaca);
    return instances.alpaca;
  }
  throw new Error('Unknown broker ' + name);
}

export function updateBrokerCreds(name, data) {
  if (!creds[name]) creds[name] = {};
  Object.assign(creds[name], data);
  if (instances[name]) delete instances[name]; // force re-init
  return creds[name];
}

export function listBrokers() {
  return Object.keys(creds).map(k => ({ name: k, configured: !!creds[k].key }));
}