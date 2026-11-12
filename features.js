/* Optional features for the US nuclear plants map. Each feature is isolated: a failure in one never affects the map or the others.
   Plain ES2017 (checked with esbuild --target=safari12). Requires window.APP from index.html. */
(function(){
'use strict';
var APP=window.APP; if(!APP){ return; }
var NOW_YEAR=new Date().getFullYear();
function $(sel,root){ return (root||document).querySelector(sel); }
function el(tag,cls,html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
function safe(name,fn){ try{ return fn(); }catch(err){ console.error('[feature '+name+'] failed',err); } }
function esc(s){ return APP.esc(s); }
function yr(s){ var m=/(\d{4})/.exec(s||''); return m?+m[1]:null; }
function num(v){ var n=parseFloat(String(v==null?'':v).replace(/,/g,'')); return isNaN(n)?0:n; }
function fmt(n){ return Math.round(n).toLocaleString('en-US'); }
function big(n){ if(n>=1e6) return (n/1e6).toFixed(n>=1e7?0:1)+' million'; if(n>=1e3) return fmt(Math.round(n/1e3)*1e3); return fmt(n); }
function isMobile(){ return window.innerWidth<=720; }
var ICON={
 tools:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>',
 time:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
 loc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/></svg>',
 heat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3c2 4 6 5.5 6 10a6 6 0 0 1-12 0c0-3 2-4.5 2.5-7 1.5 1.5 2.5 2 3.5 2-.5-2-.5-3.5 0-5z"/></svg>',
 stats:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 20V11M12 20V5M19 20v-6"/></svg>',
 tour:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20l6-16 4 9 3-4 5 11z"/></svg>',
 play:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
 pause:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>',
 close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
 rings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/></svg>',
 compare:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="7" height="14" rx="1.5"/><rect x="14" y="5" width="7" height="14" rx="1.5"/></svg>',
 grid:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
 globe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/></svg>',
 share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>'
};

/* ---------- shared data helpers ---------- */
function isUS(p){ return !p.country_code||p.country_code==='US'; }
function placeOf(p){ return isUS(p)?(p.state+', USA'):p.country; }
function unitSusp(u,Y){ var su=yr(u.suspended_since); return !!su&&su<=Y&&u.status==='Suspended operation'; }
function unitOn(u,Y){ var c=yr(u.commercial_operation)||yr(u.grid_connection); if(!c||c>Y) return false; if(unitSusp(u,Y)) return false; var cl=yr(u.closed); return !cl||cl>Y; }
function openedYear(p){ var ys=p.units.map(function(u){return yr(u.commercial_operation)||yr(u.grid_connection);}).filter(Boolean); return ys.length?Math.min.apply(null,ys):null; }
function opCap(p){ return p.status==='Operating'?num(p.operating_capacity_mw):0; }
function totalCap(p){ return p.units.reduce(function(a,u){return a+num(u.capacity_mw);},0); }
function capOf(p){ return opCap(p)||totalCap(p); }
function vendors(p){ var v=[]; p.units.forEach(function(u){ if(u.vendor&&v.indexOf(u.vendor)<0) v.push(u.vendor); }); return v.join(', '); }
function licenseInfo(p){
 if(!isUS(p)) return {kind:'na',text:''};
 var units=p.units.filter(function(u){return u.status==='Operational'&&u.license_expires_year;});
 if(p.status!=='Operating'&&p.status!=='Restart in progress'){
  if(/Shut/.test(p.status)) return {kind:'shut',text:'Shut down: no active operating license'};
  if(/Planned/.test(p.status)) return {kind:'planned',text:'Not yet licensed to operate'};
  return {kind:'none',text:'Never licensed to operate'};
 }
 if(!units.length) return {kind:'unknown',text:'License expiry not in our data'};
 var ys=units.map(function(u){return u.license_expires_year;}); var first=Math.min.apply(null,ys), last=Math.max.apply(null,ys);
 return {kind:'ok',first:first,last:last,left:first-NOW_YEAR,units:units};
}
function estimates(p){
 var mw=opCap(p); if(!mw) return null;
 var mwh=mw*8760*0.90; return isUS(p)?{mwh:mwh,homes:mwh*1000/10500,co2t:mwh*0.4,us:true}:{mwh:mwh,us:false};
}

/* ---------- UI scaffolding: toast, sheet, tools ---------- */
var toastEl, toastT;
function toast(msg,ms){ safe('toast',function(){
 if(!toastEl){ toastEl=el('div','ftoast'); toastEl.setAttribute('role','status'); document.body.appendChild(toastEl); }
 toastEl.textContent=msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(function(){toastEl.classList.remove('show');},ms||2600);
}); }
APP.toast=toast;

var sheet, sheetBody, sheetTitle;
function openSheet(title,html,cls){
 if(!sheet){
  sheet=el('div','fsheet glass'); sheet.setAttribute('role','dialog'); sheet.setAttribute('aria-modal','false');
  sheet.innerHTML='<div class="fsh"><div class="fst"></div><button class="fsx" type="button" aria-label="Close">'+ICON.close+'</button></div><div class="fsb"></div>';
  document.getElementById('main').appendChild(sheet);
  sheetTitle=$('.fst',sheet); sheetBody=$('.fsb',sheet);
  $('.fsx',sheet).addEventListener('click',closeSheet);
  L.DomEvent.disableClickPropagation(sheet); L.DomEvent.disableScrollPropagation(sheet);
 }
 sheet.className='fsheet glass '+(cls||'');
 sheetTitle.textContent=title; sheetBody.innerHTML=html; sheetBody.scrollTop=0;
 void sheet.offsetWidth; sheet.classList.add('open');
 return sheetBody;
}
function closeSheet(){ if(sheet) sheet.classList.remove('open'); }
APP.closeSheet=closeSheet;
document.addEventListener('keydown',function(e){ if(e.key==='Escape') closeSheet(); });

var tools, menu;
var items={};
function buildTools(){
 tools=el('div','ftools');
 tools.innerHTML='<div class="fmenu glass" role="menu"></div><button class="ffab glass" type="button" aria-label="Tools" aria-expanded="false">'+ICON.tools+'<span>Tools</span></button>';
 document.getElementById('main').appendChild(tools);
 menu=$('.fmenu',tools);
 var fab=$('.ffab',tools);
 fab.addEventListener('click',function(e){ e.stopPropagation(); var o=!tools.classList.contains('open'); tools.classList.toggle('open',o); fab.setAttribute('aria-expanded',String(o)); });
 document.addEventListener('click',function(e){ if(!tools.contains(e.target)){ tools.classList.remove('open'); fab.setAttribute('aria-expanded','false'); } });
 L.DomEvent.disableClickPropagation(tools); L.DomEvent.disableScrollPropagation(tools);
}
function addTool(id,icon,label,fn){
 var b=el('button','fitem','<i>'+icon+'</i><span>'+label+'</span><em></em>'); b.type='button'; b.setAttribute('role','menuitem'); b.dataset.id=id;
 b.addEventListener('click',function(){ tools.classList.remove('open'); safe(id,fn); });
 menu.appendChild(b); items[id]=b; return b;
}
function setToolState(id,on,txt){ var b=items[id]; if(!b) return; b.classList.toggle('on',!!on); $('em',b).textContent=txt||(on?'On':''); }

/* ---------- 1. Timeline ---------- */
var TL={open:false,year:NOW_YEAR,timer:null,bar:null};
var MIN_YEAR=1954;
function tlApply(){
 var Y=TL.year;
 APP.extraFilter=TL.open?function(p){ var o=openedYear(p); return !!o&&o<=Y; }:null;
 APP.isGone=TL.open?function(p){ var o=openedYear(p); return !!o&&o<=Y&&!p.units.some(function(u){return unitOn(u,Y);}); }:null;
 APP.statusAt=TL.open?function(p){ if(p.units.some(function(u){return unitOn(u,Y);})) return 'Operating'; if(p.units.some(function(u){return unitSusp(u,Y);})) return 'Suspended operation'; var o=openedYear(p); if(o&&o<=Y) return 'Shut down / decommissioned'; return null; }:null;
 APP.countOverride=TL.open?function(vis){
  var online=0,reactors=0; vis.forEach(function(m){ var on=m.plant.units.filter(function(u){return unitOn(u,Y);}).length; if(on){online++;reactors+=on;} });
  return '<b>'+online+'</b> plants online in <b>'+Y+'</b> · <b>'+reactors+'</b> reactors';
 }:null;
 APP.refreshIcons(); APP.applyFilters();
 if(TL.bar){ $('.tly',TL.bar).textContent=Y; $('input',TL.bar).value=Y; var pct=(Y-MIN_YEAR)/(NOW_YEAR-MIN_YEAR)*100; $('input',TL.bar).style.setProperty('--p',pct+'%'); }
}
function tlStop(){ clearInterval(TL.timer); TL.timer=null; if(TL.bar){ $('.tlp',TL.bar).innerHTML=ICON.play; $('.tlp',TL.bar).setAttribute('aria-label','Play'); } }
function tlPlay(){
 if(TL.timer){ tlStop(); return; }
 if(TL.year>=NOW_YEAR) TL.year=MIN_YEAR;
 $('.tlp',TL.bar).innerHTML=ICON.pause; $('.tlp',TL.bar).setAttribute('aria-label','Pause');
 tlApply();
 TL.timer=setInterval(function(){ if(TL.year>=NOW_YEAR){ tlStop(); return; } TL.year++; safe('timeline',tlApply); }, APP.REDUCED?700:420);
}
function tlOpen(on){
 TL.open=on; setToolState('timeline',on);
 if(on&&!TL.bar){
  TL.bar=el('div','ftl glass');
  TL.bar.innerHTML='<button class="tlp" type="button" aria-label="Play">'+ICON.play+'</button><div class="tlm"><div class="tlh"><span class="tlk">Timeline</span><span class="tly">'+NOW_YEAR+'</span></div><input type="range" min="'+MIN_YEAR+'" max="'+NOW_YEAR+'" step="1" value="'+NOW_YEAR+'" aria-label="Year"><div class="tll"><span>'+MIN_YEAR+'</span><span>'+NOW_YEAR+'</span></div></div><button class="tlx" type="button" aria-label="Close timeline">'+ICON.close+'</button>';
  document.getElementById('main').appendChild(TL.bar);
  L.DomEvent.disableClickPropagation(TL.bar); L.DomEvent.disableScrollPropagation(TL.bar);
  $('.tlp',TL.bar).addEventListener('click',function(){ safe('timeline',tlPlay); });
  $('.tlx',TL.bar).addEventListener('click',function(){ safe('timeline',function(){ tlOpen(false); }); });
  $('input',TL.bar).addEventListener('input',function(e){ tlStop(); TL.year=+e.target.value; safe('timeline',tlApply); });
 }
 if(TL.bar){ void TL.bar.offsetWidth; TL.bar.classList.toggle('open',on); }
 document.body.classList.toggle('tl-open',on);
 if(!on){ tlStop(); TL.year=NOW_YEAR; }
 tlApply();
}
APP.timeline={open:tlOpen,set:function(y){ TL.year=y; tlApply(); },play:function(){ tlPlay(); },stop:tlStop};

/* ---------- 2. Nearest plants ---------- */
var meLayer=null;
function hav(a,b,c,d){ var R=6371,t=Math.PI/180,dl=(c-a)*t,dn=(d-b)*t; var x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a*t)*Math.cos(c*t)*Math.sin(dn/2)*Math.sin(dn/2); return 2*R*Math.asin(Math.sqrt(x)); }
function showNearest(lat,lon){
 var list=APP.plants.map(function(p){ return {p:p,km:hav(lat,lon,p.lat,p.lon)}; }).sort(function(a,b){return a.km-b.km;}).slice(0,5);
 if(meLayer) APP.map.removeLayer(meLayer);
 meLayer=L.layerGroup([L.circleMarker([lat,lon],{radius:7,color:'#fff',weight:2,fillColor:'#22d3ee',fillOpacity:1,className:'fme'}).bindTooltip('You are here',{direction:'top'})]).addTo(APP.map);
 var html='<p class="fnote">Closest plants to your location (straight-line distance). Your location stays on this device.</p><ol class="fnear">'+list.map(function(o){
  var s=APP.STATUS[o.p.status];
  return '<li><button type="button" data-id="'+esc(o.p.id)+'"><span class="dot" style="background:'+s.hex+';color:'+s.hex+'"></span><span class="fn1"><b>'+esc(o.p.name)+'</b><small>'+esc(placeOf(o.p))+' · '+esc(o.p.status)+'</small></span><span class="fn2">'+(o.km/1.609344).toFixed(o.km<160?1:0)+' mi<small>'+o.km.toFixed(o.km<100?1:0)+' km</small></span></button></li>';
 }).join('')+'</ol>';
 var b=openSheet('Nearest plants',html,'near');
 Array.prototype.forEach.call(b.querySelectorAll('button[data-id]'),function(btn){ btn.addEventListener('click',function(){ closeSheet(); window.selectPlant(btn.dataset.id); }); });
 var bounds=L.latLngBounds([[lat,lon]].concat(list.slice(0,3).map(function(o){return [o.p.lat,o.p.lon];})));
 APP.map.flyToBounds(bounds.pad(0.25),{maxZoom:9,duration:APP.REDUCED?0:1.4,animate:!APP.REDUCED,paddingBottomRight:isMobile()?[0,260]:[420,0]});
}
function locate(){
 if(!navigator.geolocation){ toast('Location is not available in this browser.'); return; }
 if(window.isSecureContext===false){ toast('Location needs a secure (https) page.'); return; }
 toast('Finding your location…',8000);
 navigator.geolocation.getCurrentPosition(function(pos){ safe('nearest',function(){ toastEl&&toastEl.classList.remove('show'); showNearest(pos.coords.latitude,pos.coords.longitude); }); },
  function(err){ var m=err&&err.code===1?'Location permission was denied. You can allow it in your browser settings (iPhone: Settings › Privacy › Location Services › Safari).':err&&err.code===3?'Finding your location timed out. Please try again.':'Your location could not be determined.'; toast(m,5200); },
  {enableHighAccuracy:false,timeout:12000,maximumAge:300000});
}
APP.showNearest=showNearest;

/* ---------- 6. Heat map ---------- */
var HEAT={on:false,layer:null};
function heatPoints(vis){
 var pts=[], max=0;
 vis.forEach(function(m){ var c=opCap(m.plant); if(APP.isGone&&APP.isGone(m.plant)) c=0; if(TL.open&&c===0){ c=m.plant.units.filter(function(u){return unitOn(u,TL.year);}).reduce(function(a,u){return a+num(u.capacity_mw);},0); } if(c>0){ pts.push([m.plant.lat,m.plant.lon,c]); if(c>max) max=c; } });
 return pts.map(function(p){ return [p[0],p[1],0.25+0.75*p[2]/(max||1)]; });
}
function heatRefresh(vis){
 if(!HEAT.on) return;
 if(!L.heatLayer){ toast('Heat map library failed to load.'); heatToggle(false); return; }
 var pts=heatPoints(vis||APP.markers.filter(function(m){return APP.map.hasLayer(m)||APP.cluster.hasLayer(m);}));
 if(!HEAT.layer){ HEAT.layer=L.heatLayer(pts,{radius:26,blur:24,maxZoom:7,max:1,minOpacity:0.25,gradient:{0.2:'#0e7490',0.45:'#22d3ee',0.7:'#a7f3d0',0.9:'#fde68a',1:'#ffffff'}}).addTo(APP.map); }
 else HEAT.layer.setLatLngs(pts);
}
function heatToggle(on){
 HEAT.on=on; setToolState('heat',on);
 document.body.classList.toggle('heat-on',on);
 if(on){ APP.map.removeLayer(APP.cluster); APP.applyFilters(); heatRefresh(); if(!HEAT.lg){ HEAT.lg=el('div','fheatlg glass','<span>Operating capacity</span><i></i><small>low</small><small>high</small>'); document.getElementById('main').appendChild(HEAT.lg); } HEAT.lg.classList.add('show'); }
 else { if(HEAT.layer){ APP.map.removeLayer(HEAT.layer); HEAT.layer=null; } if(!APP.map.hasLayer(APP.cluster)) APP.map.addLayer(APP.cluster); if(HEAT.lg) HEAT.lg.classList.remove('show'); }
}
APP.heat={toggle:heatToggle};

/* ---------- 5. Stats dashboard ---------- */
function bars(rows,opt){
 opt=opt||{}; var max=Math.max.apply(null,rows.map(function(r){return r[1];}).concat([1]));
 var h=22, W=100;
 return '<div class="fchart">'+rows.map(function(r,i){ var w=Math.max(1.5,r[1]/max*W);
  return '<div class="fbar"><span class="fbl">'+esc(r[0])+'</span><span class="fbt"><i style="width:'+w.toFixed(1)+'%;'+(r[2]?'background:'+r[2]+';':'')+'animation-delay:'+(i*0.04)+'s"></i></span><span class="fbv">'+esc(opt.fmt?opt.fmt(r[1]):fmt(r[1]))+'</span></div>'; }).join('')+'</div>';
}
function donut(rows){
 var tot=rows.reduce(function(a,r){return a+r[1];},0)||1, acc=0, R=42, C=2*Math.PI*R;
 var segs=rows.map(function(r){ var len=r[1]/tot*C; var s='<circle r="'+R+'" cx="60" cy="60" fill="none" stroke="'+r[2]+'" stroke-width="14" stroke-dasharray="'+len.toFixed(2)+' '+(C-len).toFixed(2)+'" stroke-dashoffset="'+(-acc).toFixed(2)+'"/>'; acc+=len; return s; }).join('');
 return '<div class="fdonut"><svg viewBox="0 0 120 120" width="120" height="120"><g transform="rotate(-90 60 60)">'+segs+'</g><text x="60" y="58" text-anchor="middle" class="fdn">'+tot+'</text><text x="60" y="74" text-anchor="middle" class="fdl">plants</text></svg><ul>'+rows.map(function(r){return '<li><span class="dot" style="background:'+r[2]+';color:'+r[2]+'"></span>'+esc(r[0])+'<b>'+r[1]+'</b></li>';}).join('')+'</ul></div>';
}
function openStats(){
 var P=APP.plants, byState={}, byCountry={}, byType={}, byDec={}, bySt={}, countries={};
 var TC={PWR:'#22d3ee',BWR:'#a78bfa',PHWR:'#fbbf24',LWGR:'#f87171',GCR:'#fb923c',FBR:'#34d399',HTGR:'#f472b6'};
 P.forEach(function(p){
  var c=opCap(p), cn=p.country||'United States';
  countries[cn]=1;
  if(c){ byCountry[cn]=(byCountry[cn]||0)+c; if(isUS(p)) byState[p.state]=(byState[p.state]||0)+c; }
  p.units.forEach(function(u){ if(u.status==='Operational'){ var t=u.type||'Other'; byType[t]=(byType[t]||0)+1; } });
  var o=openedYear(p)||p.first_commercial_year; if(o){ var d=Math.floor(o/10)*10; byDec[d]=(byDec[d]||0)+1; }
  bySt[p.status]=(bySt[p.status]||0)+1;
 });
 var ctry=Object.keys(byCountry).map(function(k){return [k,byCountry[k],k==='United States'?'#60a5fa':'#34d399'];}).sort(function(a,b){return b[1]-a[1];}).slice(0,12);
 var states=Object.keys(byState).map(function(k){return [k,byState[k]];}).sort(function(a,b){return b[1]-a[1];}).slice(0,10);
 var types=Object.keys(byType).map(function(k){return [k,byType[k],TC[k]||'#94a3b8'];}).sort(function(a,b){return b[1]-a[1];});
 var decs=Object.keys(byDec).sort().map(function(k){return [k+'s',byDec[k],'#34d399'];});
 var sts=Object.keys(APP.STATUS).filter(function(k){return bySt[k];}).map(function(k){return [k,bySt[k],APP.STATUS[k].hex];});
 var byBA={}; P.forEach(function(p){ var g=gridOf(p), c=opCap(p); if(g&&c){ var k=g.rto||g.ba_name; byBA[k]=(byBA[k]||0)+c; } });
 var gridBars=Object.keys(byBA).map(function(k){return [k,byBA[k],RTO[k]?RTO[k].c:'#94a3b8'];}).sort(function(a,b){return b[1]-a[1];}).slice(0,10);
 var opUnits=function(p){ return p.units.filter(function(u){return u.status==='Operational';}).length; };
 var totalOp=P.reduce(function(a,p){return a+opCap(p);},0), reactors=P.reduce(function(a,p){return a+opUnits(p);},0);
 var nC=Object.keys(countries).length, world=nC>1;
 var html='<div class="fkpis"><div><b>'+fmt(totalOp/1000)+' GW</b><small>operating capacity</small></div><div><b>'+reactors+'</b><small>operating reactors</small></div><div><b>'+(world?Object.keys(byCountry).length:Object.keys(byState).length)+'</b><small>'+(world?'countries operating':'states with plants')+'</small></div></div>'+
  (world?'<h4>Operating capacity by country · top 12</h4>'+bars(ctry,{fmt:function(v){return (v/1000).toFixed(1)+' GW';}}):'')+
  '<div class="fgrid2"><div><h4>Operating reactors by type</h4>'+bars(types)+'</div><div><h4>Plant status</h4>'+donut(sts)+'</div></div>'+
  '<h4>US capacity by state · top 10</h4>'+bars(states,{fmt:function(v){return fmt(v)+' MW';}})+
  (gridBars.length?'<h4>US nuclear capacity by grid operator</h4>'+bars(gridBars,{fmt:function(v){return fmt(v)+' MW';}}):'')+
  '<h4>Plants by decade of first power</h4>'+bars(decs)+
  '<p class="fnote">Based on the map dataset ('+P.length+' plant sites in '+nC+' countries). Capacity is net MW of reactors operating today; idle reactors (e.g. most of Japan’s, “Suspended operation”) are not counted. Non-US data: IAEA PRIS.</p>';
 openSheet(world?'World statistics':'Fleet statistics',html,'stats');
}

/* ---------- Countries: filter + zoom ---------- */
var CTRY={name:null,chip:null};
function countryRows(){
 var m={};
 APP.plants.forEach(function(p){ var c=p.country||'United States'; var r=m[c]||(m[c]={name:c,sites:0,op:0,mw:0}); r.sites++; r.op+=p.units.filter(function(u){return u.status==='Operational';}).length; r.mw+=opCap(p); });
 return Object.keys(m).map(function(k){return m[k];}).sort(function(a,b){ return b.op-a.op||b.sites-a.sites||(a.name<b.name?-1:1); });
}
function countryChip(){
 var qv=document.querySelector('.qview'); if(!qv) return;
 if(!CTRY.chip){ CTRY.chip=el('button','qchip'); CTRY.chip.type='button'; qv.appendChild(CTRY.chip); CTRY.chip.addEventListener('click',function(){ countryClear(); }); }
 CTRY.chip.innerHTML=CTRY.name?esc(CTRY.name)+' <span aria-hidden="true">×</span>':'';
 CTRY.chip.setAttribute('aria-label',CTRY.name?'Clear country filter ('+CTRY.name+')':'');
 CTRY.chip.style.display=CTRY.name?'':'none';
}
function countryFit(name){
 if(name==='United States'&&APP.USA_B){ APP.map.flyToBounds(APP.USA_B,{duration:APP.REDUCED?0:1.2,animate:!APP.REDUCED,paddingTopLeft:[0,isMobile()?150:60]}); return; }
 var pts=APP.plants.filter(function(p){return (p.country||'United States')===name;}).map(function(p){return [p.lat,p.lon];});
 if(!pts.length) return;
 var b=L.latLngBounds(pts);
 APP.map.flyToBounds(b,{maxZoom:7,duration:APP.REDUCED?0:1.2,animate:!APP.REDUCED,paddingTopLeft:[30,isMobile()?160:80],paddingBottomRight:[30,isMobile()?40:30]});
}
function countrySet(name,fit){
 CTRY.name=name||null;
 APP.filters=APP.filters||{};
 APP.filters.country=CTRY.name?function(p){ return (p.country||'United States')===CTRY.name; }:null;
 APP.applyFilters(); setToolState('country',!!CTRY.name,CTRY.name||''); countryChip();
 if(CTRY.name&&fit!==false) countryFit(CTRY.name);
}
function countryClear(quiet){ if(!CTRY.name) return; countrySet(null,false); if(!quiet&&APP.goWorld) APP.goWorld(!APP.REDUCED); }
function openCountries(){
 var rows=countryRows();
 var html='<label class="fcsearch"><input type="search" placeholder="Filter '+rows.length+' countries…" aria-label="Filter countries" autocomplete="off"></label>'+
  (CTRY.name?'<button type="button" class="fcall">Show all countries</button>':'')+
  '<ul class="fclist">'+rows.map(function(r){ return '<li><button type="button" data-c="'+esc(r.name)+'" class="'+(CTRY.name===r.name?'on':'')+'"><b>'+esc(r.name)+'</b><small>'+r.sites+' site'+(r.sites>1?'s':'')+' · '+r.op+' operating reactor'+(r.op===1?'':'s')+(r.mw?' · '+(r.mw/1000).toFixed(1)+' GW':'')+'</small></button></li>'; }).join('')+'</ul>'+
  '<p class="fnote">Tap a country to show only its plants and zoom to them. Sorted by operating reactors. Source: IAEA PRIS (non-US), NRC/EIA (US).</p>';
 var body=openSheet('Countries',html,'countries');
 var inp=$('input',body);
 inp.addEventListener('input',function(){ var q=inp.value.trim().toLowerCase(); Array.prototype.forEach.call(body.querySelectorAll('.fclist li'),function(li){ li.style.display=!q||li.textContent.toLowerCase().indexOf(q)>=0?'':'none'; }); });
 body.addEventListener('click',function(e){
  var b=e.target.closest?e.target.closest('button'):null; if(!b) return;
  if(b.classList.contains('fcall')){ closeSheet(); countryClear(); return; }
  var c=b.getAttribute('data-c'); if(!c) return;
  closeSheet(); APP.closePanel(); safe('country',function(){ countrySet(c); });
 });
}
APP.country={set:countrySet,clear:countryClear,open:openCountries};

/* ---------- 8. Tour ---------- */
var TOUR={on:false,paused:false,i:0,list:[],t:null,card:null};
function tourList(){ return APP.plants.filter(function(p){return p.status==='Operating';}).sort(function(a,b){ return a.lon-b.lon; }); }
function tourCard(){
 if(TOUR.card) return TOUR.card;
 TOUR.card=el('div','ftour glass','<div class="ftc"></div><div class="fta"><button type="button" class="ftp"></button><button type="button" class="ftd">Details</button><button type="button" class="ftn">Next</button><button type="button" class="ftx" aria-label="Stop tour">'+ICON.close+'</button></div><div class="ftbar"><i></i></div>');
 document.getElementById('main').appendChild(TOUR.card);
 L.DomEvent.disableClickPropagation(TOUR.card); L.DomEvent.disableScrollPropagation(TOUR.card);
 $('.ftp',TOUR.card).addEventListener('click',function(){ TOUR.paused?tourResume():tourPause(); });
 $('.ftn',TOUR.card).addEventListener('click',function(){ TOUR.paused=false; tourStep(1); });
 $('.ftd',TOUR.card).addEventListener('click',function(){ var p=TOUR.list[TOUR.i]; tourStop(); if(p) window.selectPlant(p.id); });
 $('.ftx',TOUR.card).addEventListener('click',tourStop);
 return TOUR.card;
}
function tourShow(p,idx){
 var c=tourCard(), e=estimates(p);
 var facts=[p.num_units+' reactor'+(p.num_units>1?'s':''), fmt(opCap(p))+' MW'];
 if(p.first_commercial_year) facts.push('since '+p.first_commercial_year);
 $('.ftc',c).innerHTML='<small>Tour · '+(idx+1)+' of '+TOUR.list.length+'</small><b>'+esc(p.name)+'</b><span>'+esc(placeOf(p))+' · '+esc(facts.join(' · '))+'</span>'+(e&&e.us?'<em>≈ '+big(e.homes)+' homes powered (est.)</em>':e?'<em>≈ '+(e.mwh/1e6).toFixed(1)+' TWh/yr at 90% capacity factor (est.)</em>':'');
 $('.ftp',c).textContent=TOUR.paused?'Resume':'Pause';
 var bar=$('.ftbar i',c); bar.style.animation='none'; void bar.offsetWidth; bar.style.animation=TOUR.paused?'none':''; bar.style.animationDuration=TOUR.dwell+'ms';
 c.classList.toggle('paused',TOUR.paused);
 c.classList.add('open');
}
function tourStep(d){
 clearTimeout(TOUR.t);
 TOUR.i=(TOUR.i+d+TOUR.list.length)%TOUR.list.length;
 var p=TOUR.list[TOUR.i];
 TOUR.flying=true;
 if(APP.REDUCED){ APP.map.setView([p.lat,p.lon],8,{animate:false}); }
 else APP.map.flyTo([p.lat,p.lon],8,{duration:2.4,easeLinearity:0.2});
 setTimeout(function(){ TOUR.flying=false; },APP.REDUCED?50:2600);
 tourShow(p,TOUR.i);
 if(!TOUR.paused) TOUR.t=setTimeout(function(){ if(TOUR.on&&!TOUR.paused) tourStep(1); },TOUR.dwell+(APP.REDUCED?0:2400));
}
function tourPause(){ if(!TOUR.on||TOUR.paused) return; TOUR.paused=true; clearTimeout(TOUR.t); APP.map.stop(); tourShow(TOUR.list[TOUR.i],TOUR.i); }
function tourResume(){ if(!TOUR.on) return; TOUR.paused=false; tourStep(1); }
function tourStart(){
 if(TOUR.on){ tourStop(); return; }
 APP.closePanel(); closeSheet(); if(TL.open) tlOpen(false);
 TOUR.list=tourList(); if(!TOUR.list.length) return;
 TOUR.on=true; TOUR.paused=false; TOUR.dwell=APP.REDUCED?7000:4200; setToolState('tour',true,'Playing');
 // start from the plant nearest the current view centre
 var c=APP.map.getCenter(), best=0, bd=1e9; TOUR.list.forEach(function(p,i){ var d=hav(c.lat,c.lng,p.lat,p.lon); if(d<bd){bd=d;best=i;} });
 TOUR.i=best-1; tourStep(1);
}
function tourStop(){ TOUR.on=false; clearTimeout(TOUR.t); if(TOUR.card) TOUR.card.classList.remove('open'); setToolState('tour',false); }
function tourInteract(e){ if(TOUR.on&&!TOUR.paused&&!(TOUR.card&&TOUR.card.contains(e.target))) tourPause(); }
APP.tour={start:tourStart,stop:tourStop,pause:tourPause};

/* ---------- 3, 4, 7, 9, 10: panel additions ---------- */
var RINGS={layer:null,pid:null};
function ringsOff(){ if(RINGS.layer){ APP.map.removeLayer(RINGS.layer); RINGS.layer=null; } RINGS.pid=null; var b=$('#pbody .fa-rings'); if(b) b.classList.remove('on'); var n=$('#pbody .fringnote'); if(n) n.classList.remove('show'); }
function ringsOn(p){
 ringsOff();
 var mi=1609.344;
 var c50=L.circle([p.lat,p.lon],{radius:50*mi,color:'#a78bfa',weight:1.2,opacity:0.8,fillColor:'#a78bfa',fillOpacity:0.05,dashArray:'2 6',interactive:false});
 var c10=L.circle([p.lat,p.lon],{radius:10*mi,color:'#22d3ee',weight:1.6,opacity:0.95,fillColor:'#22d3ee',fillOpacity:0.08,interactive:false});
 var lab=function(latlng,txt,cls){ return L.marker(latlng,{interactive:false,keyboard:false,icon:L.divIcon({className:'fringlbl '+cls,html:'<span>'+txt+'</span>',iconSize:null})}); };
 var dLat=function(miles){ return miles*mi/111320; };
 RINGS.layer=L.layerGroup([c50,c10,lab([p.lat+dLat(50),p.lon],isUS(p)?'50-mile ingestion pathway EPZ':'50 miles (80 km)','r50'),lab([p.lat+dLat(10),p.lon],isUS(p)?'10-mile plume exposure EPZ':'10 miles (16 km)','r10')]).addTo(APP.map);
 RINGS.pid=p.id;
 var b=$('#pbody .fa-rings'); if(b) b.classList.add('on'); var n=$('#pbody .fringnote'); if(n) n.classList.add('show');
 var bounds=c50.getBounds();
 APP.map.flyToBounds(bounds,{duration:APP.REDUCED?0:1.2,animate:!APP.REDUCED,paddingTopLeft:[20,isMobile()?140:80],paddingBottomRight:isMobile()?[20,APP.panel.offsetHeight+10]:[APP.panel.offsetWidth+40,20]});
}
function shareUrl(p){ return location.href.split('#')[0]+'#'+p.id; }
function copyText(t){
 if(navigator.clipboard&&window.isSecureContext){ return navigator.clipboard.writeText(t); }
 return new Promise(function(res,rej){ try{ var ta=el('textarea'); ta.value=t; ta.setAttribute('readonly',''); ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0,t.length); var ok=document.execCommand('copy'); document.body.removeChild(ta); ok?res():rej(new Error('copy failed')); }catch(e){ rej(e); } });
}
function share(p){
 var url=shareUrl(p), data={title:p.name+' – World Nuclear Power Plants',text:p.name+' ('+placeOf(p)+') on the world nuclear power plants map',url:url};
 if(navigator.share){ navigator.share(data).catch(function(err){ if(err&&err.name==='AbortError') return; copyText(url).then(function(){toast('Link copied');},function(){toast(url,6000);}); }); return; }
 copyText(url).then(function(){ toast('Link copied: #'+p.id); },function(){ toast(url,6000); });
}
function compareRows(a){
 var li=licenseInfo(a), o=openedYear(a)||a.first_commercial_year;
 return {
  'Status':esc(a.status),
  'In service since':o?(o+' <small>('+(NOW_YEAR-o)+' yrs)</small>'):'—',
  'Capacity':capOf(a)?fmt(capOf(a))+' MW'+(opCap(a)?'':' <small>(total units)</small>'):'—',
  'Reactor units':String(a.num_units),
  'Technology':esc(a.reactor_types.join(' + '))||'—',
  'Vendor':esc(vendors(a))||'—',
  'License expires':li.kind==='na'?'<small>US (NRC) plants only</small>':li.kind==='ok'?(li.first===li.last?li.first:li.first+'–'+li.last):'<small>'+esc(li.text)+'</small>',
  'Feeds (grid)':gridOf(a)?esc(gridOf(a).ba_name)+' <small>('+esc(gridOf(a).interconnection)+')</small>':'<small>'+(isUS(a)?'Not in EIA-860':'US plants only')+'</small>',
  'Location':esc(placeOf(a))
 };
}
function openCompare(p,otherId){
 var opts=APP.plants.filter(function(x){return x.id!==p.id;}).sort(function(a,b){return a.name.localeCompare(b.name);});
 var html='<label class="fpick"><span>Compare <b>'+esc(p.name)+'</b> with</span><select><option value="">Choose a plant…</option>'+opts.map(function(x){return '<option value="'+esc(x.id)+'"'+(x.id===otherId?' selected':'')+'>'+esc(x.name)+' ('+esc(isUS(x)?(x.state_abbr||x.state)+', US':x.country)+')</option>';}).join('')+'</select></label><div class="fcmp"></div>';
 var b=openSheet('Compare plants',html,'cmp');
 var sel=$('select',b), box=$('.fcmp',b);
 function draw(){
  var q=APP.plants.filter(function(x){return x.id===sel.value;})[0];
  if(!q){ box.innerHTML='<p class="fnote">Pick a second plant to see them side by side.</p>'; return; }
  var A=compareRows(p), B=compareRows(q), ca=capOf(p), cb=capOf(q);
  box.innerHTML='<table><thead><tr><th></th><th><span class="dot" style="background:'+APP.STATUS[p.status].hex+';color:'+APP.STATUS[p.status].hex+'"></span>'+esc(p.name)+'</th><th><span class="dot" style="background:'+APP.STATUS[q.status].hex+';color:'+APP.STATUS[q.status].hex+'"></span>'+esc(q.name)+'</th></tr></thead><tbody>'+
   Object.keys(A).map(function(k){ var w=''; if(k==='Capacity'&&ca!==cb) w=ca>cb?' class="w1"':' class="w2"'; return '<tr'+w+'><td>'+k+'</td><td>'+A[k]+'</td><td>'+B[k]+'</td></tr>'; }).join('')+
   '</tbody></table><div class="fcmpbar"><span style="width:'+(ca/(Math.max(ca,cb)||1)*100).toFixed(1)+'%"></span><span style="width:'+(cb/(Math.max(ca,cb)||1)*100).toFixed(1)+'%"></span></div><div class="fcmpa"><button type="button" data-go="'+esc(q.id)+'">Open '+esc(q.name)+' ›</button></div>';
  $('[data-go]',box).addEventListener('click',function(){ closeSheet(); window.selectPlant(q.id); });
 }
 sel.addEventListener('change',draw); draw();
}
APP.openCompare=openCompare;
function panelExtras(p){
 var pc=$('#pbody .pc'); if(!pc) return;
 // action chips under the title
 safe('actions',function(){
  var sub=$('.sub',pc); if(!sub) return;
  var acts=el('div','facts-acts');
  acts.innerHTML='<button type="button" class="fa fa-rings">'+ICON.rings+'<span>'+(isUS(p)?'EPZ rings':'10/50 mi rings')+'</span></button><button type="button" class="fa fa-cmp">'+ICON.compare+'<span>Compare</span></button><button type="button" class="fa fa-share">'+ICON.share+'<span>Share</span></button>';
  sub.parentNode.insertBefore(acts,sub.nextSibling);
  var note=el('div','fringnote',!isUS(p)?'<span class="k10"></span>10 mi (16 km) · <span class="k50"></span>50 mi (80 km) distance rings, for scale only. They use the US NRC planning-zone distances; emergency planning zones in '+esc(p.country)+' are set by its own regulator and may differ.':'<span class="k10"></span>10-mile <b>plume exposure pathway EPZ</b> · <span class="k50"></span>50-mile <b>ingestion pathway EPZ</b>. These are NRC emergency <i>planning</i> zones used for preparedness, not danger zones. <a href="https://www.nrc.gov/about-nrc/emerg-preparedness/about-emerg-preparedness/planning-zones.html" target="_blank" rel="noopener">NRC ↗</a>');
  acts.parentNode.insertBefore(note,acts.nextSibling);
  $('.fa-rings',acts).addEventListener('click',function(){ safe('rings',function(){ RINGS.pid===p.id?ringsOff():ringsOn(p); }); });
  $('.fa-cmp',acts).addEventListener('click',function(){ safe('compare',function(){ openCompare(p); }); });
  $('.fa-share',acts).addEventListener('click',function(){ safe('share',function(){ share(p); }); });
  if(RINGS.pid===p.id){ $('.fa-rings',acts).classList.add('on'); note.classList.add('show'); }
 });
 var facts=$('.facts',pc); var anchor=facts||$('.sub',pc);
 // grid operator (EIA-860)
 safe('feeds',function(){ var a=$('.fringnote',pc)||$('.facts-acts',pc)||$('.sub',pc); if(a) gridFeedsBox(p,a); });
 // license countdown
 safe('license',function(){
  var li=licenseInfo(p); if(li.kind==='na') return; var box=el('div','flic');
  if(li.kind==='ok'){
   var left=li.left, cls=left<=3?'u3':left<=10?'u2':'u1', pct=Math.max(3,Math.min(100,left/40*100));
   var lbl=left>0?left+' year'+(left===1?'':'s')+' left':left===0?'Expires this year':'Listed expiry has passed';
   box.innerHTML='<div class="flh"><span>Operating license</span><b class="'+cls+'">'+lbl+'</b></div><div class="flbar '+cls+'"><i style="width:'+(left>0?pct:100)+'%"></i></div><div class="fls">Earliest unit license expires '+li.first+(li.last!==li.first?' · last unit '+li.last:'')+(left<=0?' · renewal may already be granted or pending':'')+'. Source: NRC Information Digest 2024–2025 (data as of Sep 2024).</div>';
  } else {
   box.innerHTML='<div class="flh"><span>Operating license</span><b class="un">'+esc(li.text)+'</b></div>';
  }
  anchor.parentNode.insertBefore(box,anchor.nextSibling); anchor=box;
 });
 // fun facts / estimates
 safe('funfacts',function(){
  var e=estimates(p); if(!e) return;
  var box=el('div','ffun');
  if(!e.us){
   box.innerHTML='<div class="ffh"><span>Estimated yearly generation</span><details><summary aria-label="Assumptions">ⓘ Assumptions</summary><p>An estimate, not a reported figure: net capacity (IAEA PRIS) × 8,760 h × 90% capacity factor. Real output varies by country and year. Homes-powered and CO₂ figures are shown for US plants only, because they rely on US household use and US grid emissions (EIA).</p></details></div>'+
    '<div class="ffg"><div><b>≈ '+(e.mwh/1e6).toFixed(1)+' TWh</b><small>generation / yr</small></div><div><b>'+fmt(opCap(p))+' MW</b><small>operating net capacity</small></div></div>';
   box.title='Estimate: '+fmt(opCap(p))+' MW × 8,760 h × 0.90';
   anchor.parentNode.insertBefore(box,anchor.nextSibling); return;
  }
  box.innerHTML='<div class="ffh"><span>Estimated yearly impact</span><details><summary aria-label="Assumptions">ⓘ Assumptions</summary><p>Estimates, not reported figures. Annual generation = net capacity × 8,760 h × 90% capacity factor (US nuclear fleet average, EIA). Homes = generation ÷ 10,500 kWh, the average annual US household use (EIA). CO₂ avoided = generation × 0.4 kg/kWh, roughly the average US grid emission rate (EIA: ~0.37 kg/kWh in 2023); replacing only fossil generation would avoid more, so this is conservative. Sources in “About & sources”.</p></details></div>'+
   '<div class="ffg"><div><b>≈ '+big(e.homes)+'</b><small>homes powered</small></div><div><b>≈ '+big(e.co2t)+' t</b><small>CO₂ avoided / yr</small></div><div><b>≈ '+(e.mwh/1e6).toFixed(1)+' TWh</b><small>generation / yr</small></div></div>';
  box.title='Estimate: '+fmt(opCap(p))+' MW × 8,760 h × 0.90; 10,500 kWh/home/yr; 0.4 kg CO₂/kWh';
  anchor.parentNode.insertBefore(box,anchor.nextSibling);
 });
}


/* ---------- Grid: who each plant feeds + ISO/RTO regions ---------- */
var GRID_INFO='A <b>grid operator</b> (balancing authority) keeps electricity supply and demand in balance, minute by minute, over its part of the grid and tells power plants how much to generate. <b>ISOs/RTOs</b> such as PJM, MISO or ERCOT do this for many utilities at once and run wholesale power markets; elsewhere (much of the Southeast and West) a utility such as TVA or Duke runs its own area. The lower 48 are split into three <b>interconnections</b> (Eastern, Western, Texas) with only small links between them. Source: EIA-860 plant data.';
var RTO={
 'PJM':{name:'PJM Interconnection',c:'#60a5fa'},
 'MISO':{name:'Midcontinent ISO (MISO)',c:'#c084fc'},
 'SPP':{name:'Southwest Power Pool (SPP)',c:'#fb923c'},
 'ERCOT':{name:'ERCOT (Texas)',c:'#f472b6'},
 'CAISO':{name:'California ISO (CAISO)',c:'#facc15'},
 'NYISO':{name:'New York ISO (NYISO)',c:'#2dd4bf'},
 'ISO-NE':{name:'ISO New England',c:'#a3e635'}
};
function gridOf(p){ return p&&p.grid&&p.grid.ba_name?p.grid:null; }
function feedVerb(p){ return /Shut/.test(p.status)?'Fed':/Planned|Never/.test(p.status)?'Will feed':'Feeds'; }
function feedsText(g){ return g.ba_name+' ('+g.interconnection+' Interconnection)'; }
function regionStats(code){
 var list=APP.plants.filter(function(p){ var g=gridOf(p); return g&&(code==='none'?!g.rto:g.rto===code); });
 var op=list.filter(function(p){return p.status==='Operating';});
 return {list:list,op:op,mw:op.reduce(function(a,p){return a+opCap(p);},0)};
}
function gridFeedsBox(p,anchor){
 var g=gridOf(p);
 if(!g) return anchor; // not found in EIA-860: show nothing
 var box=el('div','ffeeds');
 var meta=(g.rto?'RTO/ISO: '+esc(g.rto)+' · ':(g.region?esc(g.region)+' · ':''))+'EIA-860 '+g.eia_860_year+', plant ID '+g.eia_plant_id.join(' / ');
 box.innerHTML='<div class="ffr"><span class="ffk">'+feedVerb(p)+'</span><span class="ffv">'+(g.rto&&RTO[g.rto]?'<span class="dot" style="background:'+RTO[g.rto].c+';color:'+RTO[g.rto].c+'"></span>':'')+'<b>'+esc(g.ba_name)+'</b> <small>('+esc(g.interconnection)+' Interconnection)</small></span>'+
  '<details class="ffi"><summary aria-label="What is a grid operator?" title="What is a grid operator?">ⓘ</summary><p>'+GRID_INFO+'</p></details></div><div class="ffm">'+meta+'</div>';
 box.title='Grid operator (balancing authority) that dispatches this plant, per EIA-860';
 anchor.parentNode.insertBefore(box,anchor.nextSibling);
 return box;
}
var GRID={on:false,layer:null,labels:null,data:null,loading:false,lg:null,filter:null};
function gridLoad(cb){
 if(GRID.data) return cb(GRID.data);
 if(GRID.loading) return; GRID.loading=true;
 var x=new XMLHttpRequest(); x.open('GET','data/grid-regions.geojson?v=20261112g'); x.timeout=20000;
 x.onload=function(){ GRID.loading=false; if(x.status>=200&&x.status<300){ try{ GRID.data=JSON.parse(x.responseText); }catch(e){ GRID.data=null; } } if(GRID.data) cb(GRID.data); else { toast('Grid regions failed to load.'); gridToggle(false); } };
 x.onerror=x.ontimeout=function(){ GRID.loading=false; toast('Grid regions failed to load. Check your connection.'); gridToggle(false); };
 x.send();
}
function regionPopup(code){
 var s=regionStats(code), r=RTO[code];
 var names=s.op.map(function(p){return p.name;}).sort();
 var other=s.list.length-s.op.length;
 return '<div class="fgpop"><div class="fgpt"><span class="dot" style="background:'+r.c+';color:'+r.c+'"></span><b>'+esc(r.name)+'</b></div>'+
  '<div class="fgpn"><b>'+s.op.length+'</b> operating nuclear plant'+(s.op.length===1?'':'s')+' feed it · <b>'+fmt(s.mw)+' MW</b></div>'+
  (names.length?'<div class="fgpl">'+names.map(esc).join(' · ')+'</div>':'')+
  (other?'<div class="fgpo">+ '+other+' shut down / planned plant'+(other===1?'':'s')+' listed here in EIA-860</div>':'')+
  '<button type="button" class="fgpf" data-code="'+esc(code)+'">'+(GRID.filter===code?'Show all plants':'Show only these plants')+'</button></div>';
}
function gridFilter(code){
 GRID.filter=code||null;
 APP.filters=APP.filters||{};
 APP.filters.grid=GRID.filter?function(p){ var g=gridOf(p); return !!g&&(GRID.filter==='none'?!g.rto:g.rto===GRID.filter); }:null;
 APP.applyFilters(); gridLegend();
 if(GRID.filter){ var nm=GRID.filter==='none'?'No RTO / utility-run':RTO[GRID.filter].name; toast('Showing plants feeding '+nm); }
}
function gridLegend(){
 if(!GRID.lg){
  GRID.lg=el('div','fgridlg glass'); document.getElementById('main').appendChild(GRID.lg);
  L.DomEvent.disableClickPropagation(GRID.lg); L.DomEvent.disableScrollPropagation(GRID.lg);
  GRID.lg.addEventListener('click',function(e){ var b=e.target.closest?e.target.closest('[data-f]'):null; if(b){ e.preventDefault(); var c=b.getAttribute('data-f'); safe('grid-filter',function(){ gridFilter(GRID.filter===c||c==='all'?null:c); }); } if(e.target.closest&&e.target.closest('.fglx')) gridToggle(false); });
 }
 var rows=Object.keys(RTO).map(function(k){ var s=regionStats(k); return '<button type="button" data-f="'+k+'" class="'+(GRID.filter===k?'on':'')+'"><span class="sw" style="background:'+RTO[k].c+'"></span>'+esc(k)+'<em>'+s.op.length+'</em></button>'; }).join('');
 var none=regionStats('none');
 GRID.lg.innerHTML='<div class="fglh"><span>Grid regions (ISO/RTO)</span><button type="button" class="fglx" aria-label="Hide grid regions">'+ICON.close+'</button></div><div class="fglg">'+rows+
  '<button type="button" data-f="none" class="'+(GRID.filter==='none'?'on':'')+'"><span class="sw none"></span>No RTO<em>'+none.op.length+'</em></button></div>'+
  '<div class="fgln">Numbers = operating plants feeding each. Unshaded areas: no RTO, utility-run. Tap a region or chip to filter.'+(GRID.filter?' <a href="#" data-f="all">Show all</a>':'')+'</div>';
}
function gridToggle(on){
 GRID.on=on; setToolState('grid',on);
 document.body.classList.toggle('grid-on',on);
 // the grid regions are US-only: bring the US into view if the map is showing elsewhere
 if(on&&APP.USA_B){ var vb=APP.map.getBounds(); if(APP.map.getZoom()<3||!vb.intersects(APP.USA_B)) APP.map.flyToBounds(APP.USA_B,{duration:APP.REDUCED?0:1.1,animate:!APP.REDUCED,paddingTopLeft:[0,isMobile()?150:60]}); }
 if(!on){
  if(GRID.layer){ APP.map.removeLayer(GRID.layer); APP.map.removeLayer(GRID.labels); }
  if(GRID.filter) gridFilter(null);
  if(GRID.lg) GRID.lg.classList.remove('show');
  return;
 }
 gridLoad(function(data){ safe('grid-layer',function(){
  if(!GRID.on) return;
  if(!GRID.layer){
   if(!APP.map.getPane('gridPane')){ var pn=APP.map.createPane('gridPane'); pn.style.zIndex=350; }
   GRID.layer=L.geoJSON(data,{pane:'gridPane',smoothFactor:1.5,
    style:function(f){ var r=RTO[f.properties.code]||{c:'#94a3b8'}; return {color:r.c,weight:1.2,opacity:.75,fillColor:r.c,fillOpacity:.13}; },
    onEachFeature:function(f,ly){
     var code=f.properties.code;
     ly.on('click',function(e){ safe('grid-popup',function(){
      L.popup({className:'fgpopup',maxWidth:280,autoPanPadding:[20,90]}).setLatLng(e.latlng).setContent(regionPopup(code)).openOn(APP.map);
      var b=document.querySelector('.fgpf[data-code="'+code+'"]'); if(b) b.addEventListener('click',function(){ APP.map.closePopup(); gridFilter(GRID.filter===code?null:code); });
     }); });
     ly.on('mouseover',function(){ ly.setStyle({fillOpacity:.24,weight:2}); });
     ly.on('mouseout',function(){ GRID.layer.resetStyle(ly); });
    }});
   GRID.labels=L.layerGroup(data.features.map(function(f){
    var r=RTO[f.properties.code]||{c:'#fff'};
    return L.marker([f.properties.ly,f.properties.lx],{pane:'gridPane',interactive:false,keyboard:false,icon:L.divIcon({className:'fgridlbl',html:'<span style="color:'+r.c+';border-color:'+r.c+'55">'+esc(f.properties.code)+'</span>',iconSize:[0,0]})});
   }));
  }
  GRID.layer.addTo(APP.map); GRID.labels.addTo(APP.map);
  gridLegend(); GRID.lg.classList.add('show');
 }); });
}
APP.grid={toggle:gridToggle,filter:gridFilter,stats:regionStats};

/* ---------- about: assumptions & sources ---------- */
function aboutExtras(){
 var ab=document.getElementById('aboutBox'); if(!ab||ab.querySelector('.fabout')) return;
 var d=el('div','fabout','<b>Estimates &amp; zones</b><ul style="padding-left:18px;margin:4px 0"><li>Homes powered / CO₂ avoided are estimates: capacity × 8,760 h × 90% capacity factor; 10,500 kWh per home per year; 0.4 kg CO₂ per kWh. They are shown for US plants only; plants elsewhere show just the generation estimate (same 90% assumption).</li><li>License countdowns are US-only (NRC data). Outside the US, the 10/50-mile rings are drawn at the US distances for scale only.</li><li><a href="https://www.eia.gov/tools/faqs/faq.php?id=97&amp;t=3" target="_blank" rel="noopener">EIA – average US household electricity use</a></li><li><a href="https://www.eia.gov/electricity/monthly/epm_table_grapher.php?t=epmt_6_07_b" target="_blank" rel="noopener">EIA – capacity factors by fuel (nuclear ≈ 90%+)</a></li><li><a href="https://www.eia.gov/tools/faqs/faq.php?id=74&amp;t=11" target="_blank" rel="noopener">EIA – CO₂ emitted per kWh of US electricity</a></li><li><a href="https://www.nrc.gov/about-nrc/emerg-preparedness/about-emerg-preparedness/planning-zones.html" target="_blank" rel="noopener">NRC – emergency planning zones (10-mile and 50-mile)</a></li></ul><b>World data</b><ul style="padding-left:18px;margin:4px 0"><li>Non-US reactors (name, type, model, supplier, net MW, dates, status) from <a href="https://pris.iaea.org/" target="_blank" rel="noopener">IAEA PRIS</a>, grouped into sites. “Suspended operation” is PRIS’s status for reactors that are idle but not closed (most are in Japan).</li><li>Site coordinates cross-checked between <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> (ODbL), Wikipedia and <a href="https://github.com/cristianst85/GeoNuclearData" target="_blank" rel="noopener">GeoNuclearData</a> (ODbL).</li><li>Descriptions and photos: English Wikipedia lead text and its freely licensed Wikimedia Commons lead image; otherwise an Esri satellite view.</li></ul><b>Grid operators</b><ul style="padding-left:18px;margin:4px 0"><li>“Feeds” = the plant’s balancing authority from the <a href="https://www.eia.gov/electricity/data/eia860/" target="_blank" rel="noopener">EIA-860 Plant file</a> (2025 data; 2013–2021 files for plants retired since). Plants that closed before EIA began reporting balancing authorities (2013) show no grid.</li><li>ISO/RTO regions: <a href="https://www.pasda.psu.edu/uci/DataSummary.aspx?dataset=9103" target="_blank" rel="noopener">HIFLD Independent System Operators</a> (Oak Ridge National Laboratory, 2020 boundaries), simplified. Boundaries are approximate service areas.</li></ul>');
 var note=ab.querySelector('.note'); ab.insertBefore(d,note||null);
}

/* ---------- init ---------- */
function init(){
 safe('tools',buildTools);
 safe('tools-items',function(){
  addTool('country',ICON.globe,'Countries',openCountries);
  addTool('timeline',ICON.time,'Timeline',function(){ tlOpen(!TL.open); });
  addTool('near',ICON.loc,'Nearest to me',locate);
  addTool('heat',ICON.heat,'Heat map',function(){ heatToggle(!HEAT.on); });
  addTool('stats',ICON.stats,'Statistics',openStats);
  addTool('grid',ICON.grid,'Grid regions',function(){ gridToggle(!GRID.on); });
  addTool('tour',ICON.tour,'Tour',tourStart);
 });
 APP.hooks.render.push(function(p){ panelExtras(p); if(RINGS.pid&&RINGS.pid!==p.id) ringsOff(); });
 APP.hooks.close.push(function(){ ringsOff(); });
 APP.hooks.after.push(function(vis){ if(HEAT.on) safe('heat',function(){ heatRefresh(vis); }); });
 APP.hooks.select.push(function(){ closeSheet(); });
 safe('about',aboutExtras);
 safe('tour-listeners',function(){
  var c=APP.map.getContainer();
  ['pointerdown','wheel','touchstart'].forEach(function(t){ c.addEventListener(t,tourInteract,{passive:true}); });
  document.addEventListener('keydown',function(e){ if(TOUR.on&&!TOUR.paused&&e.key!=='Tab') tourPause(); });
  var hdr=document.querySelector('header'); if(hdr) hdr.addEventListener('pointerdown',function(){ if(TOUR.on) tourPause(); });
 });
}
if(APP.ready) safe('init',init); else APP.hooks.ready.push(function(){ safe('init',init); });
})();
