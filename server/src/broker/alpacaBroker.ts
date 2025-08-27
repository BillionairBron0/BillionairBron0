import axios, { AxiosInstance } from 'axios';

interface OrderReq { symbol:string; qty:number; side:string; type?:string; time_in_force?:string; client_order_id?:string }

export class AlpacaBroker {
  key?:string; secret?:string; paper:boolean; base:string; http:AxiosInstance;
  constructor(cfg:any){
    this.key = cfg.key; this.secret = cfg.secret; this.paper = cfg.paper !== false;
    this.base = this.paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
    if(!this.key || !this.secret) console.warn('AlpacaBroker missing credentials');
    this.http = axios.create({ baseURL:this.base, headers:{ 'APCA-API-KEY-ID': this.key||'', 'APCA-API-SECRET-KEY': this.secret||'' } });
  }
  async account(){ try { const { data } = await this.http.get('/v2/account'); return data; } catch(e:any){ return { error:e.message }; } }
  async placeOrder({ symbol, qty, side, type='market', time_in_force='gtc', client_order_id }:OrderReq){
    try { const { data } = await this.http.post('/v2/orders', { symbol, qty, side: side.toLowerCase(), type, time_in_force, client_order_id }); return data; } catch(e:any){ return { error:e.message }; }
  }
}