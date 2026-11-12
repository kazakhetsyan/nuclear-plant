/* Planes Nearby – live ADS-B map. Static site, no build step. iOS-Safari-safe (ES2015, no ?. / ??). */
(function(){
'use strict';
function $(s,r){ return (r||document).querySelector(s); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
function safe(name,fn){ try{ return fn(); }catch(e){ console.error('['+name+'] failed',e); } }
var REDUCED=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
var TOUCH=('ontouchstart' in window)||navigator.maxTouchPoints>0;
var isMobile=function(){ return window.innerWidth<=720; };
var QS=(function(){ var o={}; location.search.replace(/^\?/,'').split('&').forEach(function(kv){ if(!kv) return; var i=kv.indexOf('='); o[decodeURIComponent(i<0?kv:kv.slice(0,i))]=i<0?'':decodeURIComponent(kv.slice(i+1)); }); return o; })();

/* ---------------- config: live feeds (all keyless) ---------------- */
// Browsers can only read cross-site JSON that carries CORS headers. Tested 2026-11-12:
// api.adsb.lol, opendata.adsb.fi and api.airplanes.live send none (adsb.fi / airplanes.live also 403 datacenter IPs),
// OpenSky only allows opensky-network.org. So the primary path is adsb.lol through the free proxy.cors.dev
// (adds CORS, 600 req/min/IP); AvioADSB sends CORS itself but allows 1 req/10 s and 100/day per network.
// A direct adsb.lol call can be tried with ?direct=1 (in case it ever enables CORS). Own proxy: ?feed=https://host/path/{lat}/{lon}/{r}
var PROXY='https://proxy.cors.dev/';
var FEEDS=[
 {id:'adsblol', name:'adsb.lol', site:'https://adsb.lol', lic:'ODbL 1.0', every:8000, probe:true, optional:true,
  url:function(a,o,r){ return 'https://api.adsb.lol/v2/point/'+a+'/'+o+'/'+r; },
  cs:function(c){ return 'https://api.adsb.lol/v2/callsign/'+c; }},
 {id:'adsblol-proxy', name:'adsb.lol', via:'cors.dev', site:'https://adsb.lol', lic:'ODbL 1.0', every:8000,
  url:function(a,o,r){ return PROXY+'https://api.adsb.lol/v2/point/'+a+'/'+o+'/'+r; },
  cs:function(c){ return PROXY+'https://api.adsb.lol/v2/callsign/'+c; }},
 {id:'avio', name:'AvioADSB', site:'https://avioadsb.org', lic:'', every:10000, min:10000,
  url:function(a,o,r){ return 'https://avioadsb.org/v1/point/'+a+'/'+o+'/'+r; },
  cs:function(c){ return 'https://avioadsb.org/v1/callsign/'+c; }}
];
// the direct adsb.lol call is only tried with ?direct=1 (today it is always blocked by CORS and would just log an error)
if(QS.direct!=='1') FEEDS.shift();
(function(){ var f=QS.feed||window.PLANES_FEED; if(f&&/^https:\/\//.test(f)){ FEEDS.unshift({id:'custom',name:'custom feed',site:f.split('/').slice(0,3).join('/'),every:6000,url:function(a,o,r){ return f.replace('{lat}',a).replace('{lon}',o).replace('{r}',r); }}); } })();
var HOME={lat:40.7128,lon:-74.0060,name:'New York City'};
var POLL_MS=(+QS.every>=3000)?+QS.every:null;

/* ---------------- state ---------------- */
var S={center:{lat:HOME.lat,lon:HOME.lon},radius:50,user:null,tapSearch:false,planes:{},sel:null,follow:false,feed:0,fails:0,lastOk:0,lastData:null,query:'',info:{},photo:{},route:{},hidden:document.hidden};
try{ var rr=+(localStorage.getItem('planes.radius')||0); if(rr===25||rr===50||rr===100) S.radius=rr; }catch(e){}
if(+QS.r===25||+QS.r===50||+QS.r===100) S.radius=+QS.r;
if(QS.lat&&QS.lon&&!isNaN(+QS.lat)&&!isNaN(+QS.lon)) S.center={lat:+QS.lat,lon:+QS.lon};

/* ---------------- helpers ---------------- */
var NM=1852;
function hav(a1,o1,a2,o2){ var R=3440.065,t=Math.PI/180,dA=(a2-a1)*t,dO=(o2-o1)*t,x=Math.sin(dA/2)*Math.sin(dA/2)+Math.cos(a1*t)*Math.cos(a2*t)*Math.sin(dO/2)*Math.sin(dO/2); return 2*R*Math.asin(Math.min(1,Math.sqrt(x))); }
function fmt(n,d){ if(n==null||isNaN(n)) return '—'; return Number(n).toLocaleString('en-US',{maximumFractionDigits:d||0,minimumFractionDigits:d||0}); }
function compass(d){ return ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(((d%360)+360)%360/22.5)%16]; }
function ago(s){ s=Math.max(0,Math.round(s)); return s<60?s+' s':Math.round(s/60)+' min'; }
var STOPS=[[0,[251,146,60]],[2000,[251,191,36]],[6000,[163,230,53]],[12000,[52,211,153]],[20000,[34,211,238]],[30000,[96,165,250]],[40000,[167,139,250]]];
function altRGB(alt){
 if(alt==='ground') return [139,149,165];
 if(alt==null||isNaN(alt)) return [148,163,184];
 if(alt<=STOPS[0][0]) return STOPS[0][1];
 for(var i=1;i<STOPS.length;i++){ if(alt<=STOPS[i][0]){ var a=STOPS[i-1],b=STOPS[i],k=(alt-a[0])/(b[0]-a[0]); return [0,1,2].map(function(j){return Math.round(a[1][j]+(b[1][j]-a[1][j])*k);}); } }
 return STOPS[STOPS.length-1][1];
}
function rgb(c,a){ return a==null?'rgb('+c.join(',')+')':'rgba('+c.join(',')+','+a+')'; }
function altKey(alt){ return alt==='ground'?'g':(alt==null||isNaN(alt))?'u':String(Math.min(45000,Math.round(alt/500)*500)); }
var CAT={A1:'Light (< 15,500 lb)',A2:'Small (15,500–75,000 lb)',A3:'Large (75,000–300,000 lb)',A4:'High-vortex large (e.g. B757)',A5:'Heavy (> 300,000 lb)',A6:'High performance',A7:'Rotorcraft',B1:'Glider / sailplane',B2:'Lighter-than-air',B3:'Parachutist / skydiver',B4:'Ultralight / hang-glider',B6:'Unmanned aerial vehicle',B7:'Space vehicle',C1:'Surface emergency vehicle',C2:'Surface service vehicle',C3:'Ground obstruction'};
var SRC={adsb_icao:'ADS-B',adsb_icao_nt:'ADS-B (non-transponder)',adsr_icao:'ADS-R',tisb_icao:'TIS-B',tisb_trackfile:'TIS-B',tisb_other:'TIS-B',adsc:'ADS-C (satellite)',mlat:'MLAT (multilateration)',mode_s:'Mode S (no position source)',other:'Other',unknown:'Unknown'};
var EMERG={'7500':'Hijack (7500)','7600':'Radio failure (7600)','7700':'General emergency (7700)'};
var EM_TXT={general:'General emergency',lifeguard:'Lifeguard / medical',minfuel:'Minimum fuel',nordo:'No radio',unlawful:'Unlawful interference',downed:'Downed aircraft',reserved:'Emergency'};
function typeInfo(t){ var T=window.AC_TYPES||{}; return (t&&T[t])||null; }
function prettyDesc(s){ if(!s) return ''; return s.replace(/\b([A-Z][A-Z'\-]{2,})\b/g,function(w){ return /^(II|III|IV|XL|XLS|XLR|ATR|CRJ|ERJ|DHC|BAE|MBB|PZL|SAAB|IAI|TBM|NG|ER|LR|MAX|SP|RJ|EC|AS|AW|MD|DC|UH|AH|CH|MH|KC)$/.test(w)?w:w.charAt(0)+w.slice(1).toLowerCase(); }).replace(/\bAirbus A-(\d)/,'Airbus A$1'); }
function modelName(p){
 var d=p.d, ti=typeInfo(d.t);
 if(ti&&ti[0]) return ti[0];
 if(d.desc) return prettyDesc(d.desc);
 var inf=S.info[p.hex]; if(inf&&inf.type) return ((inf.manufacturer&&inf.type.indexOf(inf.manufacturer)<0)?inf.manufacturer+' ':'')+inf.type;
 return d.t||'';
}
function shapeOf(d){
 var ti=typeInfo(d.t), c=ti?ti[1]:'', w=ti?ti[2]:'', cat=d.category||'';
 if(/^C[1-3]/.test(cat)) return {s:'veh',k:.7};
 if(c.charAt(0)==='H'||c.charAt(0)==='G'||cat==='A7') return {s:'heli',k:1};
 if(cat==='B1'||cat==='B4') return {s:'glider',k:.85};
 if(cat==='B2') return {s:'balloon',k:.8};
 var eng=c.charAt(2), sc=w==='J'?1.35:w==='H'?1.22:w==='M'?1:w==='L'?.82:(cat==='A5'?1.22:cat==='A1'?.82:cat==='A3'||cat==='A4'?1:.92);
 if(eng==='P'||eng==='T'||(!c&&cat==='A1')) return {s:'prop',k:Math.min(sc,1)};
 return {s:'jet',k:sc};
}
function isEmerg(d){ return !!(EMERG[d.squawk]||(d.emergency&&d.emergency!=='none')); }
function isMil(d){ return !!(d.dbFlags&1); }
function onGround(d){ return d.alt_baro==='ground'; }
function cs(d){ return (d.flight||'').trim(); }
function label(p){ var d=p.d; return cs(d)||d.r||p.hex.toUpperCase(); }

/* ---------------- network ---------------- */
function xhr(url,timeout,cb,opt){
 opt=opt||{};
 var x=new XMLHttpRequest(), done=false;
 try{ x.open(opt.method||'GET',url,true); }catch(e){ cb({status:0,msg:String(e)}); return; }
 x.timeout=timeout||12000;
 if(opt.json) x.setRequestHeader('Content-Type','application/json');
 x.onload=function(){ if(done) return; done=true;
  if(x.status>=200&&x.status<300){ var j=null; try{ j=JSON.parse(x.responseText); }catch(e){ cb({status:x.status,msg:'bad JSON'}); return; } cb(null,j); }
  else cb({status:x.status,retry:+(x.getResponseHeader('Retry-After')||0),msg:(x.responseText||'').slice(0,120)}); };
 x.onerror=function(){ if(done) return; done=true; cb({status:0,msg:'network / CORS'}); };
 x.ontimeout=function(){ if(done) return; done=true; cb({status:0,msg:'timeout'}); };
 try{ x.send(opt.body||null); }catch(e){ if(!done){ done=true; cb({status:0,msg:String(e)}); } }
}

/* ---------------- toast ---------------- */
var toastT=null;
function toast(msg,ms,err){ safe('toast',function(){ var t=$('#toast'); t.textContent=msg; t.classList.toggle('err',!!err); t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(function(){ t.classList.remove('show'); },ms||3800); }); }

/* ---------------- map ---------------- */
var map=L.map('map',{zoomControl:false,minZoom:3,maxZoom:15,zoomSnap:0.5,wheelPxPerZoomLevel:90,worldCopyJump:false,preferCanvas:true}).setView([S.center.lat,S.center.lon],9);
var ESRI='https://server.arcgisonline.com/ArcGIS/rest/services/';
var esriAttr='Tiles &copy; Esri';
var dark=L.layerGroup([
 L.tileLayer(ESRI+'Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',{maxZoom:15,maxNativeZoom:16,attribution:esriAttr}),
 L.tileLayer(ESRI+'Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',{maxZoom:15,maxNativeZoom:16})
]).addTo(map);
L.control.zoom({position:'topleft'}).addTo(map);
L.control.scale({imperial:true,metric:true,position:'bottomright'}).addTo(map);
map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
var feedAttr='';
function setFeedAttr(f){ safe('attr',function(){ if(feedAttr) map.attributionControl.removeAttribution(feedAttr); feedAttr='Aircraft: <a href="'+f.site+'" target="_blank" rel="noopener">'+esc(f.name)+'</a>'+(f.lic?' ('+f.lic+')':''); map.attributionControl.addAttribution(feedAttr); }); }
var ring=L.circle([S.center.lat,S.center.lon],{radius:S.radius*NM,color:'#22d3ee',weight:1.2,opacity:.55,dashArray:'3 7',fill:true,fillColor:'#22d3ee',fillOpacity:.025,interactive:false}).addTo(map);
var ctrMk=L.marker([S.center.lat,S.center.lon],{interactive:false,keyboard:false,icon:L.divIcon({className:'',html:'<div class="ctr" style="position:relative"></div>',iconSize:[14,14]})}).addTo(map);
var meMk=null;
function fitArea(anim){ var b=ring.getBounds(); if(anim&&!REDUCED) map.flyToBounds(b,{duration:1.1,paddingTopLeft:[10,isMobile()?140:80],paddingBottomRight:[10,10]}); else map.fitBounds(b,{paddingTopLeft:[10,isMobile()?140:80],paddingBottomRight:[10,10],animate:false}); }
fitArea(false);

/* ---------------- sprites (pre-rendered, rotated at draw time) ---------------- */
var DPR=Math.min(window.devicePixelRatio||1,3), BASE=24, SPR={};
var SHAPES={
 jet:[16,1,17.7,3.2,18,11,30.5,17.6,30.5,19.8,18,16.8,17.6,24.2,22.3,27.6,22.3,29.4,16,27.9,9.7,29.4,9.7,27.6,14.4,24.2,14,16.8,1.5,19.8,1.5,17.6,14,11,14.3,3.2],
 prop:[16,2,17.6,4,17.6,10,30.5,10.6,30.5,13.8,17.6,14.2,17,24,21.8,25,21.8,27.8,16,27.2,10.2,27.8,10.2,25,15,24,14.4,14.2,1.5,13.8,1.5,10.6,14.4,10,14.4,4],
 glider:[16,3,17,5,17,11,31.5,12,31.5,13.6,17,14,16.6,25,20,26,20,27.6,16,27.2,12,27.6,12,26,15.4,25,15,14,0.5,13.6,0.5,12,15,11,15,5]
};
function poly(c,pts){ c.beginPath(); c.moveTo(pts[0],pts[1]); for(var i=2;i<pts.length;i+=2) c.lineTo(pts[i],pts[i+1]); c.closePath(); }
function drawShape(c,s,fill,stroke,lw){
 c.fillStyle=fill; c.strokeStyle=stroke; c.lineWidth=lw; c.lineJoin='round';
 if(SHAPES[s]){ poly(c,SHAPES[s]); c.fill(); c.stroke(); return; }
 if(s==='heli'){
  c.beginPath(); c.arc(16,13,11.5,0,Math.PI*2); c.lineWidth=lw*.9; c.strokeStyle=stroke; c.stroke(); c.globalAlpha=.35; c.strokeStyle=fill; c.lineWidth=1.4; c.stroke(); c.globalAlpha=1;
  c.beginPath(); c.moveTo(15,18); c.lineTo(15.2,28); c.lineTo(19,29); c.lineTo(19,30.5); c.lineTo(13,30.5); c.lineTo(13,29); c.lineTo(16.8,28); c.lineTo(17,18); c.closePath(); c.fillStyle=fill; c.strokeStyle=stroke; c.lineWidth=lw; c.fill(); c.stroke();
  c.beginPath(); if(c.ellipse) c.ellipse(16,13,4.6,7,0,0,Math.PI*2); else c.arc(16,13,5.5,0,Math.PI*2); c.fill(); c.stroke(); return;
 }
 if(s==='balloon'){ c.beginPath(); c.arc(16,13,9,0,Math.PI*2); c.fill(); c.stroke(); c.fillRect(13.5,24,5,4); return; }
 c.beginPath(); c.rect(10,8,12,16); c.fill(); c.stroke(); // vehicle
}
function sprite(shape,key,col,variant){
 var id=shape+'|'+key+'|'+variant; if(SPR[id]) return SPR[id];
 var px=Math.ceil(44*DPR), cv=document.createElement('canvas'); cv.width=cv.height=px;
 var c=cv.getContext('2d'); c.scale(px/44,px/44); c.translate(6,6);
 var stroke=variant==='sel'?'#ffffff':variant==='mil'?'#fde68a':'rgba(5,8,12,.85)', lw=variant==='sel'?2.2:variant==='mil'?2:1.3;
 if(variant==='sel'){ c.shadowColor='rgba(34,211,238,.95)'; c.shadowBlur=10; }
 else { c.shadowColor=rgb(col,.55); c.shadowBlur=6; }
 drawShape(c,shape,rgb(col),stroke,lw);
 SPR[id]=cv; return cv;
}

/* ---------------- plane model + dead reckoning ---------------- */
var BLEND=1400, MAXDR=45;
function headingOf(d,p){ if(d.track!=null) return d.track; if(d.true_heading!=null) return d.true_heading; if(d.mag_heading!=null) return d.mag_heading; return p&&p.hdg!=null?p.hdg:null; }
function project(lat,lon,trk,distNm){ var t=Math.PI/180, dl=distNm*Math.cos(trk*t)/60, dn=distNm*Math.sin(trk*t)/(60*Math.max(.2,Math.cos(lat*t))); return [lat+dl,lon+dn]; }
function rawPos(p,now){
 var dt=Math.min(MAXDR,Math.max(0,(now-p.t0)/1000));
 if(p.hdg==null||!p.gs||p.lost) return [p.lat0,p.lon0];
 return project(p.lat0,p.lon0,p.hdg,p.gs*dt/3600);
}
function posAt(p,now){
 var r=rawPos(p,now);
 if(p.offT){ var k=(now-p.offT)/BLEND; if(k<1){ var e=1-k; e=e*e*(3-2*e); r=[r[0]+p.offLat*e,r[1]+p.offLon*e]; } else p.offT=0; }
 return r;
}
function ingest(json,feed){
 var now=Date.now(), list=(json&&(json.ac||json.aircraft))||[], seen={}, n=0;
 for(var i=0;i<list.length;i++){ var d=list[i];
  if(!d||!d.hex||typeof d.lat!=='number'||typeof d.lon!=='number') continue;
  var hex=String(d.hex).toLowerCase().replace(/^~/,''); seen[hex]=1; n++;
  var p=S.planes[hex], tpos=now-((d.seen_pos!=null?d.seen_pos:d.seen)||0)*1000;
  if(!p){ p=S.planes[hex]={hex:hex,trail:[],first:now}; }
  else if(p.t0){ var cur=posAt(p,now); p.pending=cur; }
  var alt=d.alt_baro!=null?d.alt_baro:d.alt_geom;
  p.d=d; p.alt=alt; p.gs=d.gs||0; p.hdg=headingOf(d,p); p.lat0=d.lat; p.lon0=d.lon; p.t0=tpos; p.seen=now; p.lost=false;
  if(onGround(d)&&p.gs<1) p.gs=0;
  if(p.pending){ var np=rawPos(p,now), dLat=p.pending[0]-np[0], dLon=p.pending[1]-np[1];
   if(Math.abs(dLat)<0.25&&Math.abs(dLon)<0.25){ p.offLat=dLat; p.offLon=dLon; p.offT=now; } else p.offT=0; p.pending=null; }
  var last=p.trail[p.trail.length-1];
  if(!last||last[0]!==d.lat||last[1]!==d.lon){ p.trail.push([d.lat,d.lon,alt,tpos]); if(p.trail.length>720) p.trail.splice(0,p.trail.length-720); }
  p.dist=hav(S.center.lat,S.center.lon,d.lat,d.lon);
  p.shape=shapeOf(d); p.em=isEmerg(d); p.mil=isMil(d);
  if(d.desc&&!S.info[hex]) S.info[hex]={type:prettyDesc(d.desc),fromFeed:true};
 }
 var reset=S.areaReset; S.areaReset=false;
 Object.keys(S.planes).forEach(function(h){ var p=S.planes[h]; if(seen[h]) return;
  if((reset||now-p.seen>60000)&&h!==S.sel) delete S.planes[h]; else if(now-p.seen>20000) p.lost=true; });
 S.lastData={n:n,feed:feed,t:now};
 return n;
}

/* ---------------- canvas layer ---------------- */
var cv=document.createElement('canvas'); cv.id='plc'; map.getContainer().appendChild(cv);
var ctx=cv.getContext('2d'), W=0,H=0, raf=null, lastDraw=0, dirty=true, drawn=[];
function resize(){ var s=map.getSize(); W=s.x; H=s.y; cv.width=Math.round(W*DPR); cv.height=Math.round(H*DPR); cv.style.width=W+'px'; cv.style.height=H+'px'; dirty=true; }
resize(); map.on('resize',resize);
map.on('zoomanim',function(){ cv.classList.add('zooming'); });
map.on('zoomend',function(){ cv.classList.remove('zooming'); dirty=true; });
map.on('move zoom',function(){ dirty=true; frame(); });
function matchQ(p){ var q=S.query; if(!q) return true; var d=p.d, ti=typeInfo(d.t); return (cs(d)+' '+(d.r||'')+' '+p.hex+' '+(d.t||'')+' '+(ti?ti[0]:'')+' '+(d.ownOp||'')).toUpperCase().indexOf(q)>=0; }
function interval(){ var z=map.getZoom(); return z>=12?33:z>=10?50:z>=8?90:160; }
function frame(){
 if(raf||S.hidden) return;
 raf=requestAnimationFrame(function(ts){ raf=null; var now=Date.now();
  if(dirty||now-lastDraw>=interval()){ dirty=false; lastDraw=now; safe('draw',function(){ draw(now); }); }
  if(!S.hidden) frame();
 });
}
function drawTrail(p,now){
 var t=p.trail; if(!t.length) return;
 var pts=t.map(function(q){ return map.latLngToContainerPoint([q[0],q[1]]); });
 var head=posAt(p,now), hp=map.latLngToContainerPoint(head);
 ctx.lineCap='round'; ctx.lineJoin='round';
 ctx.lineWidth=5; ctx.strokeStyle='rgba(5,8,12,.55)'; ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y); for(var i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y); ctx.lineTo(hp.x,hp.y); ctx.stroke();
 ctx.lineWidth=2.6;
 for(var j=1;j<=pts.length;j++){ var a=pts[j-1], b=j<pts.length?pts[j]:hp, al=(j<pts.length?t[j]:t[j-1])[2];
  ctx.strokeStyle=rgb(altRGB(al)); ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); }
 ctx.fillStyle='rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(pts[0].x,pts[0].y,2.6,0,Math.PI*2); ctx.fill();
}
function draw(now){
 ctx.setTransform(DPR,0,0,DPR,0,0); ctx.clearRect(0,0,W,H);
 drawn=[]; var z=map.getZoom(), showLbl=z>=10, pulse=(Math.sin(now/180)+1)/2, inView=0, list=[];
 var sp=S.sel&&S.planes[S.sel]; if(sp) drawTrail(sp,now);
 var keys=Object.keys(S.planes);
 for(var i=0;i<keys.length;i++){ var p=S.planes[keys[i]]; if(!p.d) continue;
  var ll=posAt(p,now); p.cur=ll; var pt=map.latLngToContainerPoint(ll);
  if(pt.x<-40||pt.y<-40||pt.x>W+40||pt.y>H+40) continue;
  if(pt.x>=0&&pt.y>=0&&pt.x<=W&&pt.y<=H) inView++;
  list.push([p,pt]);
 }
 // low planes first, so high/selected/emergency are on top
 list.sort(function(a,b){ var A=a[0],B=b[0]; return (A.hex===S.sel)-(B.hex===S.sel)||(A.em-B.em)||((+A.alt||0)-(+B.alt||0)); });
 ctx.font='600 10.5px Inter,system-ui,-apple-system,sans-serif'; ctx.textBaseline='middle';
 for(var j=0;j<list.length;j++){ var P=list[j][0], q=list[j][1], sel=P.hex===S.sel, d=P.d;
  var col=altRGB(P.alt), sh=P.shape||{s:'jet',k:1}, size=BASE*sh.k*(sel?1.25:1)*(z<7?.85:1);
  var spr=sprite(sh.s,altKey(P.alt),col,sel?'sel':P.mil?'mil':'n');
  var a=S.query&&!matchQ(P)?.18:(P.lost?.45:onGround(d)?.8:1);
  if(P.em){ ctx.globalAlpha=1; ctx.strokeStyle='rgba(239,68,68,'+(0.5+0.5*pulse)+')'; ctx.lineWidth=2.2; ctx.beginPath(); ctx.arc(q.x,q.y,size*.62+4+pulse*4,0,Math.PI*2); ctx.stroke(); }
  ctx.globalAlpha=a; ctx.save(); ctx.translate(q.x,q.y); if(P.hdg!=null) ctx.rotate(P.hdg*Math.PI/180);
  var s2=size*44/32; ctx.drawImage(spr,-s2/2,-s2/2,s2,s2); ctx.restore();
  if((showLbl||sel||P.em)&&a>.3){ var tx=label(P)+(P.em?'  '+(d.squawk||'SOS'):''); ctx.globalAlpha=sel?1:.85;
   ctx.lineWidth=3; ctx.strokeStyle='rgba(5,8,12,.85)'; ctx.strokeText(tx,q.x+size*.5+4,q.y+size*.35);
   ctx.fillStyle=P.em?'#fca5a5':sel?'#ffffff':'#cbd5e1'; ctx.fillText(tx,q.x+size*.5+4,q.y+size*.35); }
  ctx.globalAlpha=1; drawn.push({p:P,x:q.x,y:q.y,r:Math.max(12,size*.6)});
 }
 S.inView=inView;
 if(sp&&S.follow&&sp.cur&&!S.userMoving){ var c=map.latLngToContainerPoint(sp.cur), cx=W/2+(isMobile()?0:-(Math.min(400,W-24)+12)/2), cy=isMobile()?H*.19:H/2;
  if(Math.abs(c.x-cx)>2||Math.abs(c.y-cy)>2) map.panBy([(c.x-cx)*.18,(c.y-cy)*.18],{animate:false,noMoveStart:true}); }
}
function hit(pt,rad){ var best=null,bd=1e9; for(var i=drawn.length-1;i>=0;i--){ var o=drawn[i], dx=o.x-pt.x, dy=o.y-pt.y, dd=dx*dx+dy*dy, r=Math.max(o.r,rad); if(dd<r*r&&dd<bd){ bd=dd; best=o.p; } } return best; }

/* ---------------- polling ---------------- */
var pollT=null, inflight=false, primaryRetryAt=0;
function curFeed(){ return FEEDS[S.feed]; }
function nextFeed(){ var start=S.feed; do{ S.feed=(S.feed+1)%FEEDS.length; }while(FEEDS[S.feed].dead&&S.feed!==start); }
function schedule(ms){ clearTimeout(pollT); if(S.hidden) return; pollT=setTimeout(poll,ms); }
function setStatus(cls,html){ safe('status',function(){ $('#count').innerHTML='<span class="live '+cls+'"></span><span class="ct">'+html+'</span>'; }); }
function statusLine(){
 var n=Object.keys(S.planes).filter(function(h){ return !S.planes[h].lost; }).length, f=curFeed(), age=S.lastOk?Math.round((Date.now()-S.lastOk)/1000):null;
 var cls=age==null?'':age<25?'ok':age<60?'warn':'err';
 setStatus(cls,'<b>'+n+'</b> planes · <b>'+(S.inView==null?n:S.inView)+'</b> in view · Data: <a href="'+f.site+'" target="_blank" rel="noopener">'+esc(f.name)+'</a>'+(age!=null&&age>=25?' · '+ago(age)+' old':''));
}
function poll(){
 if(S.hidden||inflight) return;
 // after falling back, try the preferred feed again every 5 minutes
 if(S.feed>0&&Date.now()>primaryRetryAt){ for(var i=0;i<S.feed;i++){ if(!FEEDS[i].dead){ S.feed=i; break; } } primaryRetryAt=Date.now()+300000; }
 // following a plane: keep the search area around it so it never drops out of the feed
 var fp=S.follow&&S.sel&&S.planes[S.sel]; if(fp&&fp.cur&&hav(S.center.lat,S.center.lon,fp.cur[0],fp.cur[1])>S.radius*0.5){ S.center={lat:fp.cur[0],lon:fp.cur[1]}; ring.setLatLng(fp.cur); ctrMk.setLatLng(fp.cur); }
 var f=curFeed(), lat=S.center.lat.toFixed(3), lon=S.center.lon.toFixed(3), t0=Date.now();
 inflight=true; $('.lctl .rf')&&$('.lctl .rf').classList.add('busy');
 xhr(f.url(lat,lon,S.radius),f.probe?7000:12000,function(err,j){
  inflight=false; var b=$('.lctl .rf'); if(b) b.classList.remove('busy');
  if(err){
   console.warn('feed '+f.id+' failed',err);
   if(f.probe){ f.dead=true; nextFeed(); schedule(50); return; }   // direct adsb.lol has no CORS today: fail silently once
   S.fails++;
   var wait=err.status===429?Math.min(120000,Math.max(8000,(err.retry||20)*1000)):Math.min(60000,3000*Math.pow(2,Math.min(S.fails-1,4)));
   if(S.fails>=2&&FEEDS.length>1){ var from=f.name+(f.via?' (via '+f.via+')':''); nextFeed(); var to=curFeed(); primaryRetryAt=Date.now()+300000; wait=Math.max(1000,to.min||1000);
    toast('Live data from '+from+' is not responding'+(err.status?' ('+err.status+')':'')+' – switching to '+to.name+(to.via?' via '+to.via:'')+'.',5000,true); S.fails=0; }
   else if(S.fails===1) toast('Live data hiccup – retrying in '+Math.round(wait/1000)+' s…',3500,true);
   setStatus('err','Live data unavailable – retrying in '+Math.round(wait/1000)+' s');
   schedule(wait); return;
  }
  S.fails=0; S.lastOk=Date.now();
  if(f.probe){ f.probe=false; }
  setFeedAttr(f);
  safe('ingest',function(){ ingest(j,f); });
  dirty=true; frame(); statusLine();
  safe('list',renderList);
  safe('card-live',function(){ if(S.sel) liveFacts(); });
  if(S.pendingSel){ var ps=S.pendingSel; if(S.planes[ps]){ S.pendingSel=null; select(ps,true); } }
  var every=POLL_MS||f.every; schedule(Math.max(f.min||1000,every-(Date.now()-t0)));
 });
}
function setCenter(lat,lon,why){
 S.center={lat:lat,lon:lon}; ring.setLatLng([lat,lon]); ctrMk.setLatLng([lat,lon]);
 Object.keys(S.planes).forEach(function(h){ var p=S.planes[h]; if(p.d) p.dist=hav(lat,lon,p.d.lat,p.d.lon); });
 S.areaReset=true; $('#here').hidden=true; clearTimeout(pollT); if(!inflight) poll(); else schedule(800);
}
document.addEventListener('visibilitychange',function(){
 S.hidden=document.hidden;
 if(S.hidden){ clearTimeout(pollT); if(raf){ cancelAnimationFrame(raf); raf=null; } }
 else { dirty=true; frame(); if(Date.now()-S.lastOk>4000) poll(); else schedule(4000); }
});
setInterval(function(){ if(!S.hidden){ safe('status',statusLine); } },5000);

/* ---------------- legend ---------------- */
safe('legend',function(){
 var lg=L.control({position:'topright'});
 lg.onAdd=function(){
  var d=L.DomUtil.create('div','legend glass'+(isMobile()?' collapsed':''));
  var grad='linear-gradient(90deg,'+STOPS.map(function(s,i){ return rgb(s[1])+' '+Math.round(i/(STOPS.length-1)*100)+'%'; }).join(',')+')';
  d.innerHTML='<div class="lgh" role="button" tabindex="0" aria-expanded="'+!isMobile()+'">Altitude · feet <span class="car">▾</span></div><div class="lgb"><div class="grad" style="background:'+grad+'"></div><div class="gradl"><span>0</span><span>2k</span><span>6k</span><span>12k</span><span>20k</span><span>30k</span><span>40k+</span></div>'+
   '<div class="lgr"><canvas data-k="g"></canvas>On the ground</div><div class="lgr"><canvas data-k="em"></canvas>Emergency squawk 7500/7600/7700</div><div class="lgr"><canvas data-k="mil"></canvas>Military (gold outline)</div><div class="lgr"><canvas data-k="heli"></canvas>Helicopter</div><div class="lgr"><canvas data-k="prop"></canvas>Propeller / light aircraft</div>'+
   '<div class="note" style="margin-top:8px;color:var(--faint);font-size:10.5px">Positions are animated between updates from speed and heading.</div><button class="lgdone" type="button">Done</button></div>';
  L.DomEvent.disableClickPropagation(d); L.DomEvent.disableScrollPropagation(d);
  var tog=function(){ d.classList.toggle('collapsed'); $('.lgh',d).setAttribute('aria-expanded',!d.classList.contains('collapsed')); };
  $('.lgh',d).addEventListener('click',tog); $('.lgh',d).addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); tog(); } });
  $('.lgdone',d).addEventListener('click',function(){ d.classList.add('collapsed'); });
  setTimeout(function(){ Array.prototype.forEach.call(d.querySelectorAll('canvas'),function(c){ var k=c.getAttribute('data-k'); c.width=c.height=40*DPR; var x=c.getContext('2d'); x.scale(DPR,DPR);
   var s=k==='g'?sprite('jet','g',altRGB('ground'),'n'):k==='mil'?sprite('jet','20000',altRGB(20000),'mil'):k==='heli'?sprite('heli','1500',altRGB(1500),'n'):k==='prop'?sprite('prop','6000',altRGB(6000),'n'):sprite('jet','30000',altRGB(30000),'n');
   if(k==='em'){ x.strokeStyle='#ef4444'; x.lineWidth=2.4; x.beginPath(); x.arc(20,20,16,0,Math.PI*2); x.stroke(); }
   x.drawImage(s,2,2,36,36); }); },0);
  return d; };
 lg.addTo(map);
});

/* ---------------- locate / refresh / follow controls ---------------- */
var IC={loc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/></svg>',
 rf:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
 area:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/><circle cx="12" cy="12" r="1.5"/></svg>'};
safe('ctl',function(){
 var c=L.control({position:'topleft'});
 c.onAdd=function(){ var d=L.DomUtil.create('div','lctl');
  d.innerHTML='<button type="button" class="lc" aria-label="Center on my location" title="My location">'+IC.loc+'</button><button type="button" class="ar" aria-label="Zoom to the search area" title="Search area">'+IC.area+'</button><button type="button" class="rf" aria-label="Refresh now" title="Refresh now">'+IC.rf+'</button>';
  L.DomEvent.disableClickPropagation(d);
  $('.lc',d).addEventListener('click',function(){ locate(true); });
  $('.ar',d).addEventListener('click',function(){ fitArea(true); });
  $('.rf',d).addEventListener('click',function(){ clearTimeout(pollT); poll(); });
  return d; };
 c.addTo(map);
});

/* ---------------- geolocation ---------------- */
function useHome(msg){ S.tapSearch=true; if(msg) toast(msg,6500); }
function locate(manual){
 if(!navigator.geolocation){ useHome('Location is not available in this browser – showing '+HOME.name+'. Tap the map to search another area.'); return; }
 var b=$('.lctl .lc'); if(b) b.classList.add('busy');
 navigator.geolocation.getCurrentPosition(function(pos){
  if(b){ b.classList.remove('busy'); b.classList.add('on'); }
  try{ localStorage.setItem('planes.geo','yes'); }catch(e){}
  var la=pos.coords.latitude, lo=pos.coords.longitude; S.user={lat:la,lon:lo}; S.tapSearch=false;
  if(!meMk) meMk=L.marker([la,lo],{interactive:false,keyboard:false,zIndexOffset:-100,icon:L.divIcon({className:'',html:'<div class="me"></div>',iconSize:[16,16]})}).addTo(map); else meMk.setLatLng([la,lo]);
  setCenter(la,lo,'geo'); fitArea(true);
 },function(err){
  if(b) b.classList.remove('busy');
  try{ if(err&&err.code===1) localStorage.setItem('planes.geo','no'); }catch(e){}
  var why=err&&err.code===1?'Location permission was denied':'Your location could not be found';
  useHome(why+(manual?'. Allow it in Settings › Privacy › Location Services › Safari Websites, or tap':' – showing '+HOME.name+'. Tap')+' the map to search any area.');
 },{enableHighAccuracy:false,timeout:12000,maximumAge:120000});
}
function geoPrompt(){
 var pref=null; try{ pref=localStorage.getItem('planes.geo'); }catch(e){}
 if(QS.lat&&QS.lon){ S.tapSearch=true; return; }
 if(pref==='yes'){ locate(false); return; }
 if(pref==='no'){ useHome('Showing '+HOME.name+'. Tap the map to search another area, or use ◎ to try your location.'); return; }
 var g=$('#geo'); g.hidden=false;
 $('#geoYes').onclick=function(){ g.hidden=true; locate(true); };
 $('#geoNo').onclick=function(){ g.hidden=true; try{ localStorage.setItem('planes.geo','no'); }catch(e){} useHome('Showing '+HOME.name+'. Tap the map to search another area.'); };
}

/* ---------------- map interaction ---------------- */
map.on('click',function(e){ safe('click',function(){
 var p=hit(e.containerPoint,TOUCH?24:14);
 if(p){ select(p.hex,false); return; }
 if(S.tapSearch&&!S.sel){ setCenter(e.latlng.lat,e.latlng.lng,'tap'); map.panTo(e.latlng,{animate:!REDUCED}); toast('Searching '+S.radius+' nm around this point…',2200); return; }
 if(S.sel) closePanel();
 $('#aboutBox').classList.remove('show'); $('#list').classList.remove('open'); $('#listBtn').classList.remove('on');
}); });
map.on('mousemove',function(e){ if(TOUCH) return; safe('hover',function(){
 var p=hit(e.containerPoint,12), tip=$('#tip'), mc=map.getContainer();
 if(p){ var d=p.d, mn=modelName(p); tip.innerHTML='<b>'+esc(label(p))+'</b>'+(d.t?' · '+esc(d.t):'')+'<br><small>'+(onGround(d)?'On ground':fmt(p.alt)+' ft')+' · '+fmt(p.gs)+' kt'+(mn?' · '+esc(mn):'')+'</small>';
  var r=mc.getBoundingClientRect(); tip.style.left=(e.containerPoint.x+r.left)+'px'; tip.style.top=(e.containerPoint.y+r.top-14)+'px'; tip.classList.add('show'); mc.classList.add('hov'); }
 else { tip.classList.remove('show'); mc.classList.remove('hov'); }
}); });
map.on('mouseout',function(){ $('#tip').classList.remove('show'); });
map.on('dragstart',function(){ S.userMoving=true; if(S.follow){ S.follow=false; var fb=$('#pbody .fol'); if(fb){ fb.classList.remove('on'); fb.textContent='Follow'; } } });
map.on('dragend',function(){ S.userMoving=false; });
map.on('moveend',function(){ safe('here',function(){
 var c=map.getCenter(), dn=hav(c.lat,c.lng,S.center.lat,S.center.lon);
 var cp=map.latLngToContainerPoint([S.center.lat,S.center.lon]), sz=map.getSize(), off=cp.x<0||cp.y<(isMobile()?140:70)||cp.x>sz.x||cp.y>sz.y;
 $('#here').hidden=!((off||dn>S.radius*0.75)&&!S.follow);
 statusLine();
}); });
$('#here').addEventListener('click',function(){ var c=map.getCenter(); setCenter(c.lat,c.lng,'here'); toast('Searching '+S.radius+' nm around the map center…',2200); });
$('#radius').value=String(S.radius);
$('#radius').addEventListener('change',function(e){ S.radius=+e.target.value; try{ localStorage.setItem('planes.radius',S.radius); }catch(err){} ring.setRadius(S.radius*NM); S.areaReset=true; fitArea(true); clearTimeout(pollT); poll(); });

/* ---------------- search ---------------- */
var qT=null;
$('#q').addEventListener('input',function(e){ clearTimeout(qT); qT=setTimeout(function(){ S.query=e.target.value.trim().toUpperCase(); dirty=true; safe('list',renderList); if(S.query&&!$('#list').classList.contains('open')&&isMobile()===false) openList(true); },150); });
$('#q').addEventListener('keydown',function(e){ if(e.key!=='Enter') return; e.preventDefault(); safe('search',searchGo); });
function matches(){ return Object.keys(S.planes).map(function(h){return S.planes[h];}).filter(function(p){ return p.d&&matchQ(p); }); }
function searchGo(){
 var q=S.query=$('#q').value.trim().toUpperCase(); if(!q) return;
 var m=matches(); m.sort(function(a,b){ return (cs(b.d)===q)-(cs(a.d)===q)||a.dist-b.dist; });
 if(m.length){ $('#q').blur(); select(m[0].hex,true); return; }
 // not nearby: ask the feed for that callsign anywhere and move the search area there
 var f=curFeed(); if(!f.cs||!/^[A-Z0-9]{2,8}$/.test(q)){ toast('No plane matching “'+q+'” in this area.',3500); return; }
 toast('Looking for '+q+' worldwide…',2500);
 xhr(f.cs(q),10000,function(err,j){
  var ac=!err&&j&&(j.ac||j.aircraft)||[]; ac=ac.filter(function(a){ return typeof a.lat==='number'; });
  if(!ac.length){ toast('No live flight '+q+' found right now.',3500); return; }
  var a=ac[0]; $('#q').blur(); S.pendingSel=String(a.hex).toLowerCase(); setCenter(a.lat,a.lon,'search'); map.setView([a.lat,a.lon],9,{animate:!REDUCED});
  toast('Found '+q+' – showing planes around it.',3000);
 });
}

/* ---------------- list ---------------- */
function openList(on){ var l=$('#list'); l.classList.toggle('open',on); $('#listBtn').classList.toggle('on',on); if(on){ if(isMobile()&&S.sel) closePanel(); renderList(); } }
$('#listBtn').addEventListener('click',function(){ openList(!$('#list').classList.contains('open')); });
$('#lclose').addEventListener('click',function(){ openList(false); });
L.DomEvent.disableClickPropagation($('#list')); L.DomEvent.disableScrollPropagation($('#list'));
function renderList(){
 var l=$('#list'); if(!l.classList.contains('open')) return;
 var arr=matches().filter(function(p){ return !p.lost; }).sort(function(a,b){ return (b.em-a.em)||(a.dist-b.dist); });
 $('#lcount').textContent=arr.length+(S.query?' matching “'+S.query+'”':' within '+S.radius+' nm')+' · nearest first';
 if(!arr.length){ $('#lbody').innerHTML='<div class="lempty">'+(S.query?'No plane matches “'+esc(S.query)+'” here. Press Enter to look it up worldwide.':'No planes reported in this area right now.')+'</div>'; return; }
 $('#lbody').innerHTML=arr.slice(0,300).map(function(p){ var d=p.d, mn=modelName(p);
  return '<button type="button" class="lr'+(p.hex===S.sel?' sel':'')+(p.em?' em':'')+'" data-h="'+p.hex+'"><i style="background:'+rgb(altRGB(p.alt))+';box-shadow:0 0 8px '+rgb(altRGB(p.alt),.7)+'"></i><span class="a"><b>'+esc(label(p))+(p.mil?' <small style="display:inline;color:var(--mil)">MIL</small>':'')+'</b><small>'+esc([d.t,mn&&mn!==d.t?mn:'',d.ownOp].filter(Boolean).join(' · ')||'Unknown type')+'</small></span><span class="z">'+(onGround(d)?'Ground':fmt(p.alt)+' ft')+'<small>'+fmt(p.dist,0)+' nm</small></span></button>'; }).join('');
}
$('#lbody').addEventListener('click',function(e){ var b=e.target.closest?e.target.closest('.lr'):null; if(!b) return; var h=b.getAttribute('data-h'); if(isMobile()) openList(false); select(h,true); });

/* ---------------- details card ---------------- */
var $panel=$('#panel'), $pbody=$('#pbody');
function closePanel(){ S.sel=null; S.follow=false; $panel.classList.remove('open','full'); dirty=true; safe('list',renderList); try{ if(location.hash) history.replaceState(null,'',location.pathname+location.search); }catch(e){} }
$('#pclose').addEventListener('click',closePanel);
L.DomEvent.disableClickPropagation($panel); L.DomEvent.disableScrollPropagation($panel);
document.addEventListener('keydown',function(e){ if(e.key==='Escape'){ if(S.sel) closePanel(); openList(false); } });
function placeholderGlyph(){ var c=document.createElement('canvas'); c.width=c.height=64*DPR; var x=c.getContext('2d'); x.scale(DPR,DPR); x.translate(32,32); x.rotate(-Math.PI/4); x.drawImage(sprite('jet','30000',[103,232,249],'n'),-28,-28,56,56); return c; }
function select(hex,fly){
 var p=S.planes[hex]; if(!p||!p.d) return;
 var same=S.sel===hex; S.sel=hex; dirty=true; frame();
 if(!same){ S.follow=false; render(p); }
 $panel.classList.add('open');
 try{ history.replaceState(null,'','#'+hex); }catch(e){}
 if(fly&&p.cur){ var pt=p.cur; if(isMobile()) map.flyTo(pt,Math.max(map.getZoom(),9),{duration:REDUCED?0:.9}); else map.panTo(pt,{animate:!REDUCED}); }
 safe('list',renderList);
}
function fact(k,id){ return '<div class="fact"><div class="k">'+k+'</div><div class="v" id="'+id+'">—</div></div>'; }
function render(p){
 var d=p.d, hex=p.hex, c=cs(d), mn=modelName(p), ti=typeInfo(d.t);
 var badges=(p.em?'<span class="badge em"><i></i>'+esc(EMERG[d.squawk]||EM_TXT[d.emergency]||'Emergency')+'</span>':'')+
  (onGround(d)?'<span class="badge" style="color:#cbd5e1;border-color:rgba(203,213,225,.35)"><i></i>On the ground</span>':'<span class="badge" style="color:'+rgb(altRGB(p.alt))+';border-color:'+rgb(altRGB(p.alt),.4)+'"><i></i>Airborne</span>')+
  (p.mil?'<span class="badge mil"><i></i>Military</span>':'')+(d.t?'<span class="tag">'+esc(d.t)+'</span>':'')+(d.category&&CAT[d.category]?'<span class="tag">'+esc(CAT[d.category])+'</span>':'');
 var title=c||d.r||hex.toUpperCase();
 $pbody.classList.remove('swap'); void $pbody.offsetWidth;
 $pbody.innerHTML='<div class="ph" id="ph"></div><div class="credit" id="pcred"></div><div class="pc">'+
  '<div>'+badges+'</div>'+
  '<h2>'+esc(title)+(d.r&&d.r!==title?'<small>'+esc(d.r)+'</small>':'')+'</h2>'+
  '<div class="sub" id="psub">'+(mn?'<span class="tn">'+esc(mn)+'</span>':'Unknown aircraft type')+(d.ownOp?' · '+esc(d.ownOp):'')+'</div>'+
  '<div id="proute"><div class="route unk">'+(c?'Looking up route…':'No callsign broadcast, so no route lookup.')+'</div></div>'+
  '<div class="acts"><button type="button" class="fol'+(S.follow?' on':'')+'">'+(S.follow?'Following':'Follow')+'</button><button type="button" class="zt">Zoom to</button><button type="button" class="tr">Trail</button></div>'+
  '<div class="facts">'+fact('Altitude','fAlt')+fact('Ground speed','fGs')+fact('Vertical rate','fVr')+fact('Heading','fHd')+fact('Squawk','fSq')+fact(S.user?'Distance from you':'Distance from center','fDi')+'</div>'+
  '<h3>Aircraft</h3><table class="kv" id="pkv"></table>'+
  '<h3>Flight trail</h3><div class="note" id="ptrail"></div>'+
  '<div class="links">'+(c?'<a href="https://www.flightradar24.com/'+encodeURIComponent(c)+'" target="_blank" rel="noopener">Flightradar24 ↗</a>':d.r?'<a href="https://www.flightradar24.com/data/aircraft/'+encodeURIComponent(d.r.toLowerCase())+'" target="_blank" rel="noopener">Flightradar24 ↗</a>':'')+
  '<a href="https://globe.adsbexchange.com/?icao='+hex+'" target="_blank" rel="noopener">ADS-B Exchange ↗</a><a href="https://adsb.lol/?icao='+hex+'" target="_blank" rel="noopener">adsb.lol ↗</a>'+
  (d.r?'<a href="https://www.planespotters.net/search?q='+encodeURIComponent(d.r)+'" target="_blank" rel="noopener">Planespotters ↗</a>':'')+'</div></div>';
 void $pbody.offsetWidth; $pbody.classList.add('swap'); $pbody.scrollTop=0;
 var fb=$('.fol',$pbody);
 fb.addEventListener('click',function(){ S.follow=!S.follow; fb.classList.toggle('on',S.follow); fb.textContent=S.follow?'Following':'Follow'; if(S.follow){ $('#here').hidden=true; if(map.getZoom()<9) map.setZoom(9); } dirty=true; });
 $('.zt',$pbody).addEventListener('click',function(){ if(p.cur) map.flyTo(p.cur,Math.max(map.getZoom(),11),{duration:REDUCED?0:1}); });
 $('.tr',$pbody).addEventListener('click',function(){ var t=p.trail.map(function(q){return [q[0],q[1]];}); if(p.cur) t.push(p.cur); if(t.length>1) map.flyToBounds(L.latLngBounds(t),{padding:[60,60],maxZoom:12,duration:REDUCED?0:1}); else toast('The trail starts building as new positions arrive.',3000); });
 liveFacts(); kvTable(p);
 safe('photo',function(){ loadPhoto(p); });
 safe('route',function(){ loadRoute(p); });
 safe('info',function(){ loadInfo(p); });
}
function kvTable(p){
 var d=p.d, inf=S.info[p.hex]||{}, ti=typeInfo(d.t), cls=ti&&ti[1]?ti[1]:'';
 var clsTxt=cls?({L:'Landplane',S:'Seaplane',A:'Amphibian',H:'Helicopter',G:'Gyrocopter',T:'Tiltrotor'}[cls.charAt(0)]||'')+(cls.charAt(1)&&cls.charAt(1)!=='-'?', '+cls.charAt(1)+' '+({J:'jet',T:'turboprop',P:'piston',E:'electric'}[cls.charAt(2)]||'')+' engine'+(cls.charAt(1)==='1'?'':'s'):''):'';
 var own=d.ownOp||inf.owner||'';
 var rows=[['Callsign',cs(d)],['Registration',d.r],['ICAO hex',p.hex.toUpperCase()],['Aircraft type',(d.t?d.t+' – ':'')+(modelName(p)||'')],['Class',clsTxt],['Owner / operator',own+(inf.ownerCountry&&own?' ('+inf.ownerCountry+')':'')],['Year built',d.year],['Category',CAT[d.category]],['Position source',SRC[d.type]||d.type],['Military',p.mil?'Yes (from the feed’s database flag)':'']];
 $('#pkv').innerHTML=rows.filter(function(r){ return r[1]; }).map(function(r){ return '<tr><td>'+esc(r[0])+'</td><td>'+esc(r[1])+'</td></tr>'; }).join('');
}
function liveFacts(){
 var p=S.planes[S.sel]; if(!p||!document.getElementById('fAlt')) return; var d=p.d, set=function(id,h){ var e=document.getElementById(id); if(e&&e.innerHTML!==h) e.innerHTML=h; };
 set('fAlt',onGround(d)?'Ground':p.alt==null?'—':fmt(p.alt)+'<small>ft · '+fmt(p.alt*0.3048)+' m</small>');
 set('fGs',d.gs==null?'—':fmt(d.gs)+'<small>kt · '+fmt(d.gs*1.852)+' km/h</small>');
 var vr=d.baro_rate!=null?d.baro_rate:d.geom_rate; set('fVr',vr==null?'—':(Math.abs(vr)<64?'Level':(vr>0?'↑ ':'↓ ')+fmt(Math.abs(vr))+'<small>ft/min</small>'));
 set('fHd',p.hdg==null?'—':fmt(p.hdg)+'°<small>'+compass(p.hdg)+'</small>');
 set('fSq',d.squawk?(EMERG[d.squawk]?'<span style="color:#fca5a5">'+esc(d.squawk)+'</span>':esc(d.squawk)):'—');
 var ref=S.user||S.center, pos=p.cur||[d.lat,d.lon], dn=hav(ref.lat,ref.lon,pos[0],pos[1]); set('fDi',fmt(dn,1)+'<small>nm · '+fmt(dn*1.852,1)+' km</small>');
 var age=(Date.now()-p.seen)/1000, tr=p.trail, mins=tr.length?(Date.now()-tr[0][3])/60000:0;
 set('ptrail',(p.lost?'<span class="lost">Signal lost '+ago(age)+' ago – the plane may have landed or left receiver coverage.</span> ':'')+tr.length+' reported position'+(tr.length===1?'':'s')+' since this page opened'+(mins>=1?' ('+Math.round(mins)+' min)':'')+'. Colored by altitude.');
}
setInterval(function(){ if(S.sel&&!S.hidden) safe('live',liveFacts); },1000);

// photo: planespotters.net public API (credit + link back required). Direct first, then via the CORS proxy.
function loadPhoto(p){
 var hex=p.hex, ph=$('#ph');
 var show=function(r){ if(S.sel!==hex) return; var ph=$('#ph'), cr=$('#pcred'); if(!ph) return;
  if(!r){ ph.className='ph none'; ph.innerHTML='<div class="ph-empty"></div>'; $('.ph-empty',ph).appendChild(placeholderGlyph()); var t=document.createElement('div'); t.textContent='No photo of this aircraft on planespotters.net'; $('.ph-empty',ph).appendChild(t); cr.innerHTML=''; return; }
  var img=new Image(); img.alt='Photo of '+(p.d.r||hex.toUpperCase()); img.referrerPolicy='no-referrer-when-downgrade';
  img.onload=function(){ ph.classList.add('loaded'); }; img.onerror=function(){ show(null); };
  img.src=r.src; ph.innerHTML=''; ph.appendChild(img);
  cr.innerHTML='Photo © <a href="'+esc(r.link)+'" target="_blank" rel="noopener">'+esc(r.by||'photographer')+'</a> · via <a href="https://www.planespotters.net" target="_blank" rel="noopener">Planespotters.net</a>';
 };
 if(S.photo[hex]!==undefined){ show(S.photo[hex]); return; }
 var parse=function(j){ var ph=j&&j.photos&&j.photos[0]; if(!ph) return null; var t=ph.thumbnail_large||ph.thumbnail; return t&&t.src?{src:t.src,link:ph.link||'https://www.planespotters.net',by:ph.photographer}:null; };
 var url='https://api.planespotters.net/pub/photos/hex/'+hex;
 var byReg=function(cb){ if(!p.d.r) return cb(null); xhr('https://api.planespotters.net/pub/photos/reg/'+encodeURIComponent(p.d.r),8000,function(e,j){ cb(e?undefined:parse(j)); }); };
 xhr(url,8000,function(err,j){
  if(!err){ var r=parse(j); if(r){ S.photo[hex]=r; show(r); return; } byReg(function(r2){ S.photo[hex]=r2||null; show(r2||null); }); return; }
  xhr(PROXY+url,9000,function(e2,j2){ var r=e2?null:parse(j2); if(!e2) S.photo[hex]=r; show(r); });
 });
}
// route: adsbdb (CORS, keyless) by callsign; hexdb.io as fallback. These are the callsign's usual route, not live flight plans.
function apTxt(a){ return a?{code:a.iata_code||a.icao_code||'',name:a.municipality||a.name||'',full:(a.name||'')+(a.country_name?', '+a.country_name:'')}:null; }
function showRoute(hex,r){
 if(S.sel!==hex) return; var el=$('#proute'); if(!el) return;
 if(!r||!r.from){ el.innerHTML='<div class="route unk">Route not known for this callsign.</div>'; return; }
 el.innerHTML='<div class="route"><div class="ap" title="'+esc(r.from.full)+'"><b>'+esc(r.from.code)+'</b><span>'+esc(r.from.name)+'</span></div><div class="arr">→</div><div class="ap to" title="'+esc(r.to.full)+'"><b>'+esc(r.to.code)+'</b><span>'+esc(r.to.name)+'</span></div></div><div class="rnote">'+(r.airline?esc(r.airline)+' · ':'')+'Usual route for this callsign from '+esc(r.src)+'; today’s flight may differ.</div>';
 if(r.airline){ var sb=$('#psub'); if(sb&&sb.innerHTML.indexOf(esc(r.airline))<0) sb.innerHTML+=' · '+esc(r.airline); }
}
function loadRoute(p){
 var c=cs(p.d), hex=p.hex; if(!c) return;
 if(S.route[c]!==undefined){ showRoute(hex,S.route[c]); return; }
 xhr('https://api.adsbdb.com/v0/callsign/'+encodeURIComponent(c),9000,function(err,j){
  var fr=!err&&j&&j.response&&j.response.flightroute;
  if(fr&&fr.origin&&fr.destination){ var r={from:apTxt(fr.origin),to:apTxt(fr.destination),airline:fr.airline&&fr.airline.name,src:'adsbdb.com'}; S.route[c]=r; showRoute(hex,r); return; }
  xhr('https://hexdb.io/api/v1/route/icao/'+encodeURIComponent(c),8000,function(e2,j2){
   var rt=!e2&&j2&&j2.route; if(rt&&/^[A-Z0-9]{3,4}(-[A-Z0-9]{3,4})+$/.test(rt)){ var a=rt.split('-'); var r={from:{code:a[0],name:'',full:a[0]},to:{code:a[a.length-1],name:a.length>2?'via '+a.slice(1,-1).join(', '):'',full:a[a.length-1]},src:'hexdb.io'}; S.route[c]=r; showRoute(hex,r); }
   else { S.route[c]=null; showRoute(hex,null); }
  });
 });
}
// owner / better type name: adsbdb aircraft record
function loadInfo(p){
 var hex=p.hex; if(S.info[hex]&&!S.info[hex].fromFeed&&S.info[hex].done) return;
 xhr('https://api.adsbdb.com/v0/aircraft/'+hex,9000,function(err,j){
  var a=!err&&j&&j.response&&j.response.aircraft; var inf=S.info[hex]||{}; inf.done=true;
  if(a){ inf.owner=a.registered_owner; inf.ownerCountry=a.registered_owner_country_name; if(!inf.type){ inf.type=a.type; inf.manufacturer=a.manufacturer; } }
  S.info[hex]=inf;
  if(S.sel===hex){ kvTable(p); var sb=$('#psub'); if(sb&&!p.d.ownOp&&inf.owner&&sb.innerHTML.indexOf(esc(inf.owner))<0) sb.innerHTML+=' · '+esc(inf.owner); }
 });
}

/* mobile bottom sheet: tap the handle to expand/collapse, drag down to dismiss (same as the nuclear map) */
safe('sheet',function(){ var g=$('#pgrab'), y0=null, dy=0;
 g.addEventListener('pointerdown',function(e){ y0=e.clientY; dy=0; $panel.classList.add('dragging'); try{ g.setPointerCapture(e.pointerId); }catch(x){} });
 g.addEventListener('pointermove',function(e){ if(y0===null) return; dy=e.clientY-y0; $panel.style.transform='translateY('+Math.max(dy,-40)+'px)'; });
 var end=function(){ if(y0===null) return; $panel.classList.remove('dragging'); $panel.style.transform='';
  if(Math.abs(dy)<6) $panel.classList.toggle('full'); else if(dy>90){ if($panel.classList.contains('full')) $panel.classList.remove('full'); else closePanel(); } else if(dy<-40) $panel.classList.add('full'); y0=null; };
 g.addEventListener('pointerup',end); g.addEventListener('pointercancel',end);
});

/* ---------------- about ---------------- */
safe('about',function(){
 $('#aboutBox').innerHTML='<b>About this map</b><br>Live positions of aircraft within '+'the selected radius, from volunteer ADS-B receivers. The map asks for new data every 8–10 seconds while the page is visible (it pauses in the background) and animates each plane between updates from its reported ground speed and track. Planes that turn off their transponder, fly below receiver coverage, or are filtered by the feed (some government or blocked aircraft) are not shown.'+
  '<br><br><b>Sources</b><ul>'+
  '<li>Live aircraft: <a href="https://adsb.lol" target="_blank" rel="noopener">adsb.lol</a> (ODbL 1.0), read through the free <a href="https://cors.dev" target="_blank" rel="noopener">cors.dev</a> proxy because adsb.lol sends no browser CORS headers; fallback <a href="https://avioadsb.org" target="_blank" rel="noopener">AvioADSB</a>.</li>'+
  '<li>Routes: <a href="https://www.adsbdb.com" target="_blank" rel="noopener">adsbdb.com</a>, fallback <a href="https://hexdb.io" target="_blank" rel="noopener">hexdb.io</a> – the usual route for a callsign, not a live flight plan.</li>'+
  '<li>Owner and type details: adsbdb.com and the feed’s aircraft database.</li>'+
  '<li>Photos: <a href="https://www.planespotters.net" target="_blank" rel="noopener">Planespotters.net</a> photo API, credited to each photographer with a link to the photo.</li>'+
  '<li>Model names: Wikipedia “List of aircraft type designators” (CC BY-SA) and the Mictronics aircraft database via <a href="https://github.com/wiedehopf/tar1090-db" target="_blank" rel="noopener">tar1090-db</a>.</li>'+
  '<li>Basemap: Esri. Map library: Leaflet.</li></ul>'+
  '<b>Colors</b>: altitude from orange (low) through green and cyan to violet (40,000 ft+); grey = on the ground; red ring = emergency squawk (7500 hijack, 7600 radio failure, 7700 emergency); gold outline = military (feed database flag).'+
  '<br><br><a href="../">☢ World nuclear power plants map</a><br><span class="note">Not for navigation or safety-of-flight use. Data may be delayed or incomplete.</span>';
 $('#aboutBtn').addEventListener('click',function(e){ e.stopPropagation(); $('#aboutBox').classList.toggle('show'); });
 L.DomEvent.disableClickPropagation($('#about')); L.DomEvent.disableScrollPropagation($('#aboutBox'));
});

/* ---------------- start ---------------- */
var hashSel=(location.hash||'').replace('#','').toLowerCase(); if(/^[0-9a-f]{6}$/.test(hashSel)) S.pendingSel=hashSel;
setFeedAttr(curFeed());
safe('geo',geoPrompt);
poll(); frame();
setTimeout(function(){ document.body.classList.remove('intro'); },1200);
window.PLANES={state:S,map:map,select:select,poll:poll,feeds:FEEDS,setCenter:setCenter,closePanel:closePanel,openList:openList};
})();
