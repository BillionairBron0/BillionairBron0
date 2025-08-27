import { AlpacaBroker } from './alpacaBroker';

interface BrokerCreds { key?:string; secret?:string; paper?:boolean; [k:string]:any }
const creds: Record<string, BrokerCreds> = {
  alpaca: {
    key: process.env.ALPACA_KEY_ID,
    secret: process.env.ALPACA_SECRET_KEY,
    paper: process.env.ALPACA_PAPER !== '0'
  }
};

const instances: Record<string, any> = {};

export function getBroker(name:string){
  if(name==='alpaca'){
    if(!instances.alpaca) instances.alpaca = new AlpacaBroker(creds.alpaca);
    return instances.alpaca;
  }
  throw new Error('Unknown broker '+name);
}

export function updateBrokerCreds(name:string, data:BrokerCreds){
  if(!creds[name]) creds[name] = {};
  Object.assign(creds[name], data);
  if(instances[name]) delete instances[name];
  return creds[name];
}

export function listBrokers(){
  return Object.keys(creds).map(k => ({ name:k, configured: !!creds[k].key }));
}