import React, { useEffect, useState, useMemo, useRef } from 'react';
import { SafeAreaView, Text, FlatList, View, StyleSheet, TouchableOpacity, Modal, Pressable, Linking, TextInput, Button } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

export default function App() {
  const [events, setEvents] = useState([]);
  const [filterSide, setFilterSide] = useState('ALL');
  const [selected, setSelected] = useState(null);
  const [plan, setPlan] = useState('FREE');
  const [subscribeUrl, setSubscribeUrl] = useState(null);
  const [pageOffset, setPageOffset] = useState(0);
  const [apiToken, setApiToken] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const wsRef = useRef(null);

  function connect() {
    if (wsRef.current) wsRef.current.close();
    const url = apiToken ? `ws://localhost:4000/stream?token=${encodeURIComponent(apiToken)}` : 'ws://localhost:4000/stream';
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data);
        setEvents(prev => {
          const next = [...parsed, ...prev].slice(0, 500);
          AsyncStorage.setItem('events', JSON.stringify(next)).catch(()=>{});
          return next;
        });
        const planEvt = parsed.find?.(e => e.plan);
        if (planEvt?.plan) { setPlan(planEvt.plan); AsyncStorage.setItem('plan', planEvt.plan).catch(()=>{}); }
      } catch (e) { /* noop */ }
    };
    ws.onopen = () => {};
    ws.onclose = () => {};
  }

  useEffect(() => { (async () => {
    const savedToken = await AsyncStorage.getItem('apiToken');
    if (savedToken) setApiToken(savedToken);
    const savedPlan = await AsyncStorage.getItem('plan');
    if (savedPlan) setPlan(savedPlan);
    fetch('http://localhost:4000/subscribe').then(r=>r.json()).then(j=>setSubscribeUrl(j.url)).catch(()=>{});
    await hydrate();
    registerPush();
    connect();
  })(); }, []);

  useEffect(() => { if (wsRef.current) { const t = setTimeout(connect, 250); return () => clearTimeout(t); } }, [apiToken]);

  async function hydrate() {
    try {
      const raw = await AsyncStorage.getItem('events');
      if (raw) setEvents(JSON.parse(raw));
    } catch(e){ /* ignore */ }
  }

  async function registerPush() {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;
      const tokenData = await Notifications.getExpoPushTokenAsync();
      fetch('http://localhost:4000/push/token', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ token: tokenData.data }) });
    } catch (e) { /* ignore */ }
  }

  function loadMore() {
    const next = pageOffset + 50;
    fetch(`http://localhost:4000/signals/page?limit=50&offset=${next}`, { headers: { 'x-api-token': '' } })
      .then(r=>r.json()).then(j=> {
        if (j.signals?.length) {
          setEvents(prev => [...prev, ...j.signals.map(row => JSON.parse(row.payload))]);
          setPageOffset(next);
        }
      }).catch(()=>{});
  }

  const filtered = useMemo(() => events.filter(e => filterSide==='ALL' || e.side===filterSide), [events, filterSide]);

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => setSelected(item)}>
      <Text style={styles.type}>{item.type} {item.side ? '· '+item.side: ''} {item.symbol? '· '+item.symbol: ''}</Text>
      <Text style={styles.line}>{item.status || ''} @ {item.price || ''}</Text>
      {item.reasonSummary && <Text style={styles.reason}>{item.reasonSummary}</Text>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Signal Stream ({plan})</Text>
      <View style={styles.filters}>
        {['ALL','LONG','SHORT'].map(s => (
          <Pressable key={s} onPress={()=>setFilterSide(s)} style={[styles.fBtn, filterSide===s && styles.fBtnActive]}>
            <Text style={styles.fBtnTxt}>{s}</Text>
          </Pressable>
        ))}
        <Pressable onPress={()=>setShowSettings(true)} style={[styles.fBtn, { backgroundColor:'#8250df'}]}>
          <Text style={styles.fBtnTxt}>Settings</Text>
        </Pressable>
      </View>
      <FlatList data={filtered} keyExtractor={(_,i)=>String(i)} renderItem={renderItem}
        onEndReached={loadMore} onEndReachedThreshold={0.7} />
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={()=>setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selected?.type} {selected?.side}</Text>
            <Text style={styles.modalLine}>Price: {selected?.price}</Text>
            <Text style={styles.modalLine}>Symbol: {selected?.symbol}</Text>
            <Text style={styles.modalLine}>Time: {selected?.time}</Text>
            {plan==='PRO' && selected?.risk && (
              <Text style={styles.modalLine}>ATR: {selected.risk.atr?.toFixed?.(2)}</Text>
            )}
            {plan==='FREE' && selected?.risk && <Text style={styles.upgradeHint}>Upgrade to see risk metrics</Text>}
            {plan==='FREE' && subscribeUrl && (
              <Pressable style={styles.upgradeBtn} onPress={()=>Linking.openURL(subscribeUrl)}>
                <Text style={styles.upgradeTxt}>Upgrade Pro</Text>
              </Pressable>
            )}
            <Pressable style={styles.closeBtn} onPress={()=>setSelected(null)}><Text style={styles.closeTxt}>Close</Text></Pressable>
          </View>
        </View>
      </Modal>
      <Modal visible={showSettings} animationType="slide" onRequestClose={()=>setShowSettings(false)}>
        <View style={styles.settingsContainer}>
          <Text style={styles.modalTitle}>Settings</Text>
          <Text style={styles.modalLine}>API Token</Text>
            <TextInput value={apiToken} onChangeText={setApiToken} placeholder="Enter token" placeholderTextColor="#666" style={styles.tokenInput} />
            <Button title="Save" onPress={async()=>{ await AsyncStorage.setItem('apiToken', apiToken); connect(); }} />
            <View style={{height:12}} />
            <Button title="Close" onPress={()=>setShowSettings(false)} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#0e1116', padding:12 },
  header: { fontSize:20, fontWeight:'600', color:'#fff', marginBottom:8 },
  card: { padding:10, borderRadius:6, backgroundColor:'#1c2128', marginBottom:8 },
  type: { color:'#58a6ff', fontWeight:'600' },
  line: { color:'#c9d1d9' },
  reason: { marginTop:4, color:'#8b949e', fontSize:12 },
  filters: { flexDirection:'row', marginBottom:8 },
  fBtn: { paddingVertical:4, paddingHorizontal:10, borderRadius:4, backgroundColor:'#30363d', marginRight:6 },
  fBtnActive: { backgroundColor:'#58a6ff' },
  fBtnTxt: { color:'#fff', fontSize:12 },
  modalBackdrop: { flex:1, backgroundColor:'rgba(0,0,0,0.6)', justifyContent:'center', padding:16 },
  modalCard: { backgroundColor:'#161b22', padding:16, borderRadius:8 },
  modalTitle: { fontSize:18, fontWeight:'600', color:'#fff', marginBottom:8 },
  modalLine: { color:'#c9d1d9', marginBottom:4 },
  closeBtn: { marginTop:12, backgroundColor:'#238636', paddingVertical:8, borderRadius:4, alignItems:'center' },
  closeTxt: { color:'#fff', fontWeight:'600' },
  upgradeHint: { marginTop:8, color:'#f0883e', fontSize:12 },
  upgradeBtn: { marginTop:12, backgroundColor:'#8250df', paddingVertical:8, borderRadius:4, alignItems:'center' },
  upgradeTxt: { color:'#fff', fontWeight:'600' }
  ,settingsContainer: { flex:1, backgroundColor:'#0e1116', padding:16 }
  ,tokenInput: { borderWidth:1, borderColor:'#30363d', padding:8, borderRadius:4, color:'#fff', marginBottom:12 }
});
