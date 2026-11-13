/* World Nuclear Weapons – open-source map. Static site, no build step. iOS-Safari-safe (ES2015, no ?. / ??).
   All figures are public estimates (FAS, SIPRI, Bulletin of the Atomic Scientists); sites are shown at installation level only. */
(function(){
'use strict';
function $(s,r){ return (r||document).querySelector(s); }
function $$(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
function safe(name,fn){ try{ return fn(); }catch(e){ console.error('['+name+'] failed',e); } }
function fmt(n){ return (n==null||isNaN(n))?'—':Number(n).toLocaleString('en-US'); }
var REDUCED=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
var isMobile=function(){ return window.innerWidth<=720; };
var D=window.NW_DATA, GEO=window.NW_GEO;
if(!D||!window.L){ var m=document.getElementById('map'); if(m) m.innerHTML='<div style="padding:120px 24px;color:#b6c0ce;font:14px system-ui;text-align:center">The map could not load. Please check your connection and reload.</div>'; return; }
var META=D.meta, SRC=META.sources;

/* ---------------- lookups ---------------- */
var TYPES={
 icbm:{n:'ICBM fields & missile bases',s:'ICBM field / missile base',c:'#fb923c',r:7},
 bomber:{n:'Bomber & strike air bases',s:'Bomber / strike air base',c:'#a78bfa',r:7},
 ssbn:{n:'Ballistic-missile submarine bases',s:'SSBN base',c:'#22d3ee',r:7},
 storage:{n:'Storage & weapons complexes',s:'Storage / weapons complex',c:'#fb7185',r:7},
 nato:{n:'US weapons in NATO countries',s:'NATO host base (US weapons)',c:'#fde047',r:7},
 test:{n:'Historic test sites',s:'Nuclear test site',c:'#94a3b8',r:6},
 use:{n:'Wartime use, 1945',s:'Wartime use (1945)',c:'#f1f5f9',r:6}
};
var TORDER=['icbm','bomber','ssbn','storage','nato','test','use'];
var STAT={active:'Active',construction:'Under construction',planned:'Planned',possible:'Possible / unconfirmed',historic:'Historic'};
var FLAG={US:'🇺🇸',RU:'🇷🇺',CN:'🇨🇳',FR:'🇫🇷',GB:'🇬🇧',IN:'🇮🇳',PK:'🇵🇰',IL:'🇮🇱',KP:'🇰🇵',BE:'🇧🇪',DE:'🇩🇪',IT:'🇮🇹',NL:'🇳🇱',TR:'🇹🇷',BY:'🇧🇾'};
var HOSTN={BE:'Belgium',DE:'Germany',IT:'Italy',NL:'Netherlands',TR:'Türkiye',GB:'United Kingdom',BY:'Belarus',KZ:'Kazakhstan',MH:'Marshall Islands',PF:'French Polynesia',DZ:'Algeria',AU:'Australia',KI:'Kiribati',JP:'Japan'};
var SHORT={US:'USA',RU:'Russia',CN:'China',FR:'France',GB:'UK',IN:'India',PK:'Pakistan',IL:'Israel',KP:'N. Korea'};
var LABEL={US:[39.5,-99],RU:[61.5,97],CN:[34.8,103.5],FR:[44.6,-7.5],GB:[57.6,-13.2],IN:[21.8,78.6],PK:[22.6,61.6],IL:[31.6,31.2],KP:[40.6,132.2]};
var CBY={}, SBY={}, HBY={};
D.countries.forEach(function(c){ CBY[c.id]=c; });
D.hosts.forEach(function(h){ HBY[h.id]=h; });
D.sites.forEach(function(s){ SBY[s.id]=s; });
function cname(id){ return (CBY[id]&&CBY[id].n)||HOSTN[id]||id; }
function srcLink(k,txt){ var s=SRC[k]; if(k==='wiki') return ''; if(!s) return ''; return '<a href="'+esc(s.u)+'" target="_blank" rel="noopener">'+esc(txt||s.n)+'</a>'; }
function srcShort(k){ return ({fasStatus:'FAS 2026',sipri26:'SIPRI 2026',fasUS26:'FAS Notebook 2026',fasRU26:'FAS Notebook 2026',fasFR25:'FAS Notebook 2025',fasCN25:'FAS Notebook 2025',fasUK24:'FAS Notebook 2024',fasPK25:'FAS Notebook 2025',fasIN24:'FAS Notebook 2024',fasKP24:'FAS Notebook 2024',fasIL21:'FAS Notebook 2021',wikiSRF:'Wikipedia',owid:'OWID/FAS'})[k]||''; }
var maxTot=Math.max.apply(null,D.countries.map(function(c){return c.tot;}));
function stockColor(n){ // log ramp 50 → 6000
 var t=Math.max(0,Math.min(1,(Math.log(n)-Math.log(50))/(Math.log(6000)-Math.log(50))));
 var st=[[76,29,36],[159,18,57],[225,29,72],[251,113,133],[254,205,211]], k=t*(st.length-1), i=Math.min(st.length-2,Math.floor(k)), f=k-i;
 return 'rgb('+[0,1,2].map(function(j){ return Math.round(st[i][j]+(st[i+1][j]-st[i][j])*f); }).join(',')+')';
}

/* ---------------- state ---------------- */
var ST={types:{},country:'',q:'',sel:null,ov:null,showCountries:true};
TORDER.forEach(function(t){ ST.types[t]=true; });

/* ---------------- map ---------------- */
var map=L.map('map',{zoomControl:false,worldCopyJump:true,minZoom:2,maxZoom:17,zoomSnap:0.5,attributionControl:true,preferCanvas:false});
if(isMobile()){ map.setMinZoom(1); map.setView([30,8],1,{animate:false}); }
else map.fitBounds([[-35,-135],[68,150]],{animate:false,paddingTopLeft:[10,70],paddingBottomRight:[10,10]});
L.control.zoom({position:'topleft'}).addTo(map);
var ESRI='https://server.arcgisonline.com/ArcGIS/rest/services/';
var esriAttr='Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, USGS, &copy; OpenStreetMap contributors';
var dark=L.layerGroup([
 L.tileLayer(ESRI+'Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',{maxZoom:17,maxNativeZoom:16,attribution:esriAttr}),
 L.tileLayer(ESRI+'Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',{maxZoom:17,maxNativeZoom:16})
]).addTo(map);
var sat=L.tileLayer(ESRI+'World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Imagery &copy; Esri, Maxar, Earthstar Geographics'});
L.control.layers({'Dark':dark,'Satellite':sat},null,{position:'topleft'}).addTo(map);
L.control.scale({imperial:true,metric:true,position:'bottomright'}).addTo(map);
map.createPane('countries').style.zIndex=350;
map.createPane('bubbles').style.zIndex=560;
map.createPane('sites').style.zIndex=620;
var siteRenderer=L.svg({pane:'sites',padding:0.3});

/* ---------------- country layer ---------------- */
var countryLayer=L.layerGroup().addTo(map), bubbleLayer=L.layerGroup().addTo(map), hostLblLayer=L.layerGroup(), polyBy={};
safe('countries',function(){
 if(!GEO) return;
 L.geoJSON(GEO,{pane:'countries',
  style:function(f){ var id=f.properties.id, c=CBY[id], h=HBY[id];
   if(c) return {color:stockColor(c.tot),weight:1.2,opacity:.85,fillColor:stockColor(c.tot),fillOpacity:.30};
   if(h&&h.russia) return {color:'#fdba74',weight:1.4,opacity:.9,dashArray:'4 4',fillColor:'#fdba74',fillOpacity:.08};
   return {color:'#fde047',weight:1.4,opacity:.9,dashArray:'4 4',fillColor:'#fde047',fillOpacity:.10}; },
  onEachFeature:function(f,l){ var id=f.properties.id; polyBy[id]=l;
   var c=CBY[id], h=HBY[id];
   l.bindTooltip(c?('<b>'+esc(c.n)+'</b><br>~'+fmt(c.tot)+' warheads <small>(total inventory, est. '+META.year+')</small>'):('<b>'+esc(h.n)+'</b><br>'+(h.russia?'Russian nuclear sharing (unconfirmed)':'Hosts US weapons (est.)')),{className:'wt',sticky:true,direction:'top',offset:[0,-8]});
   l.on('click',function(e){ L.DomEvent.stopPropagation(e); if(c) openCountry(id); else openHost(id); });
   l.on('mouseover',function(){ l.setStyle({fillOpacity:Math.min(.5,(l._baseFill==null?(c?.30:.10):l._baseFill)+.15)}); }); l.on('mouseout',function(){ l.setStyle({fillOpacity:l._baseFill==null?(c?.30:(h&&h.russia?.08:.10)):l._baseFill}); });
  }}).eachLayer(function(l){ countryLayer.addLayer(l); });
});
safe('bubbles',function(){
 D.countries.forEach(function(c){
  var d=Math.round(34+Math.sqrt(c.tot)*0.72), fs=c.tot>=1000?12.5:11.5;
  var ic=L.divIcon({className:'cbw',iconSize:[d,d],iconAnchor:[d/2,d/2],html:'<div class="cb" data-c="'+c.id+'" style="width:'+d+'px;height:'+d+'px;font-size:'+fs+'px"><div><span>'+fmt(c.tot)+'</span><small>'+esc(SHORT[c.id])+'</small></div></div>'});
  var m=L.marker(LABEL[c.id],{icon:ic,pane:'bubbles',keyboard:true,title:c.n+': about '+fmt(c.tot)+' warheads (est.)',riseOnHover:true});
  m.on('click',function(){ openCountry(c.id); });
  bubbleLayer.addLayer(m);
 });
 D.hosts.forEach(function(h){ if(!h.a3) return; var b=polyBy[h.id]; if(!b) return; var ll=h.id==='TR'?[39.2,33.5]:h.id==='IT'?[42.6,12.8]:h.id==='DE'?[51.0,10.2]:h.id==='BY'?[53.6,27.9]:b.getBounds().getCenter();
  var t=h.russia?'Russian sharing?':'US weapons (est.)';
  hostLblLayer.addLayer(L.marker(ll,{pane:'bubbles',interactive:false,icon:L.divIcon({className:'hostlblw',iconSize:[110,14],iconAnchor:[55,7],html:'<div class="hostlbl" style="text-align:center'+(h.russia?';color:#fdba74':'')+'">'+esc(t)+'</div>'})}));
 });
});
function zoomLayers(){ var z=map.getZoom(); var showB=ST.showCountries&&z<5.5, showH=ST.showCountries&&z>=4&&z<7;
 if(showB&&!map.hasLayer(bubbleLayer)) map.addLayer(bubbleLayer); if(!showB&&map.hasLayer(bubbleLayer)) map.removeLayer(bubbleLayer);
 if(showH&&!map.hasLayer(hostLblLayer)) map.addLayer(hostLblLayer); if(!showH&&map.hasLayer(hostLblLayer)) map.removeLayer(hostLblLayer);
 if(ST.showCountries&&!map.hasLayer(countryLayer)) map.addLayer(countryLayer); if(!ST.showCountries&&map.hasLayer(countryLayer)) map.removeLayer(countryLayer);
}
function countryFill(){ var z=map.getZoom(), k=z>=6?0.35:z>=4.5?0.6:1; countryLayer.eachLayer(function(l){ var id=l.feature&&l.feature.properties.id; if(!id) return; var base=CBY[id]?.30:(HBY[id]&&HBY[id].russia?.08:.10); l._baseFill=base*k; l.setStyle({fillOpacity:base*k}); }); }
map.on('zoomend',function(){ safe('zoomLayers',zoomLayers); safe('siteSize',restyleSites); safe('fill',countryFill); });

/* ---------------- sites ---------------- */
var siteLayer=L.layerGroup().addTo(map), mk={};
function siteStyle(s,hi){
 var T=TYPES[s.t], z=map.getZoom(), r=T.r+(z>=6?2:z>=4?1:0)+(hi?3:0), hollow=s.st==='historic', dashed=(s.st==='planned'||s.st==='construction'||s.st==='possible');
 return {renderer:siteRenderer,pane:'sites',radius:r,color:hi?'#ffffff':T.c,weight:hi?3:(dashed?1.8:2),opacity:1,dashArray:dashed?'3 3':null,fillColor:T.c,fillOpacity:hollow?0.12:dashed?0.28:0.85,bubblingMouseEvents:false};
}
safe('sites',function(){
 D.sites.forEach(function(s){ if(s.lat==null) return;
  var m=L.circleMarker([s.lat,s.lon],siteStyle(s,false));
  m.bindTooltip('<b>'+esc(s.n)+'</b><br><small>'+esc(TYPES[s.t].s)+' · '+esc(cname(s.host||s.c))+(s.st!=='active'&&s.st!=='historic'?' · '+esc(STAT[s.st]):'')+'</small>',{className:'wt',direction:'top',offset:[0,-6]});
  m.on('click',function(){ openSite(s.id); });
  mk[s.id]=m;
 });
});
function restyleSites(){ Object.keys(mk).forEach(function(id){ mk[id].setStyle(siteStyle(SBY[id],ST.sel==='s:'+id)); var r=siteStyle(SBY[id],ST.sel==='s:'+id).radius; mk[id].setRadius(r); }); }
function matches(s){
 if(!ST.types[s.t]) return false;
 if(ST.country&&s.c!==ST.country&&s.host!==ST.country) return false;
 if(ST.q){ var q=ST.q.toLowerCase(); var hay=(s.n+' '+cname(s.c)+' '+(s.host?cname(s.host):'')+' '+TYPES[s.t].s+' '+(s.what||'')).toLowerCase(); if(hay.indexOf(q)<0) return false; }
 return true;
}
function applyFilters(){
 var n=0, cs={};
 D.sites.forEach(function(s){ var m=mk[s.id]; if(!m) return; var ok=matches(s);
  if(ok){ n++; cs[s.c]=1; if(!siteLayer.hasLayer(m)) siteLayer.addLayer(m); } else if(siteLayer.hasLayer(m)) siteLayer.removeLayer(m); });
 $('#count').innerHTML='<b>'+n+'</b> of '+D.sites.length+' sites · <b>9</b> nuclear-armed states';
 $$('.legend .lgr[data-t]').forEach(function(el){ el.classList.toggle('off',!ST.types[el.getAttribute('data-t')]); });
 var ft=$('#ftype'), on=TORDER.filter(function(t){return ST.types[t];}); ft.value=on.length===TORDER.length?'':(on.length===1?on[0]:ft.value);
 return n;
}

/* ---------------- legend ---------------- */
safe('legend',function(){
 var Leg=L.Control.extend({options:{position:'bottomright'},onAdd:function(){
  var d=L.DomUtil.create('div','legend glass'+(isMobile()?' collapsed':''));
  var cnt={}; D.sites.forEach(function(s){ cnt[s.t]=(cnt[s.t]||0)+1; });
  d.innerHTML='<div class="lgh" role="button" tabindex="0">Legend<span class="car">▾</span></div><div class="lgb">'+
   '<div class="lgt" style="margin-top:0">Sites <span style="text-transform:none;letter-spacing:0;font-weight:400;color:var(--faint)">· tap to show / hide</span></div>'+
   TORDER.map(function(t){ var T=TYPES[t]; return '<div class="lgr" data-t="'+t+'"><i style="border-color:'+T.c+';background:'+(t==='test'||t==='use'?'transparent':T.c)+'"></i>'+esc(T.n)+'<em>'+(cnt[t]||0)+'</em></div>'; }).join('')+
   '<div class="lgs">Dashed ring = planned, under construction or unconfirmed · hollow = historic</div>'+
   '<div class="lgsep"></div><div class="lgt">Countries · total warheads (est. '+META.year+')</div>'+
   '<div class="grad" style="height:8px;border-radius:5px;margin:5px 0 3px"></div><div class="gradl"><span>~60</span><span>~600</span><span>~5,400</span></div>'+
   '<div class="sw"><i style="border:1.5px dashed #fde047;background:rgba(253,224,71,.12)"></i>Hosts US weapons (est.)</div>'+
   '<div class="sw"><i style="border:1.5px dashed #fdba74;background:rgba(253,186,116,.1)"></i>Russian nuclear sharing (unconfirmed)</div>'+
   '<label class="tg"><input type="checkbox" id="tgC" checked> Show country layer</label>'+
   '<button type="button" class="lgdone">Done</button></div>';
  L.DomEvent.disableClickPropagation(d); L.DomEvent.disableScrollPropagation(d);
  d.querySelector('.lgh').onclick=function(){ d.classList.toggle('collapsed'); };
  d.querySelector('.lgdone').onclick=function(){ d.classList.add('collapsed'); };
  $$('.lgr[data-t]',d).forEach(function(r){ r.onclick=function(){ var t=r.getAttribute('data-t'); ST.types[t]=!ST.types[t]; if(!TORDER.some(function(k){return ST.types[k];})) ST.types[t]=true; applyFilters(); }; });
  d.querySelector('#tgC').onchange=function(e){ ST.showCountries=e.target.checked; zoomLayers(); };
  return d; }});
 new Leg().addTo(map);
});

/* ---------------- header controls ---------------- */
safe('controls',function(){
 var ft=$('#ftype'), fc=$('#fcountry');
 ft.innerHTML='<option value="">All site types</option>'+TORDER.map(function(t){ return '<option value="'+t+'">'+esc(TYPES[t].n)+'</option>'; }).join('');
 var ids={}; D.sites.forEach(function(s){ ids[s.c]=1; });
 fc.innerHTML='<option value="">All countries</option>'+D.countries.map(function(c){ return '<option value="'+c.id+'">'+esc(c.n)+'</option>'; }).join('')+'<optgroup label="Host countries">'+['BE','DE','IT','NL','TR','BY'].map(function(h){ return '<option value="'+h+'">'+esc(HOSTN[h])+'</option>'; }).join('')+'</optgroup>';
 ft.onchange=function(){ var v=ft.value; TORDER.forEach(function(t){ ST.types[t]=!v||t===v; }); applyFilters(); };
 fc.onchange=function(){ ST.country=fc.value; var n=applyFilters(); if(ST.country){ var b=[]; D.sites.forEach(function(s){ if(mk[s.id]&&siteLayer.hasLayer(mk[s.id])&&(s.c===ST.country||s.host===ST.country)) b.push([s.lat,s.lon]); });
   var p=polyBy[ST.country]; var bb=p?p.getBounds():null;
   if(ST.country==='US'||ST.country==='FR'||ST.country==='GB'||!bb){ if(b.length) bb=L.latLngBounds(b); }
   if(bb) map.flyToBounds(bb,{padding:[40,40],maxZoom:6,duration:REDUCED?0:1.1,paddingTopLeft:[40,isMobile()?150:90]});
   if(CBY[ST.country]) openCountry(ST.country,true); else if(HBY[ST.country]) openHost(ST.country,true);
   if(!n) toast('No mapped sites match these filters.');
  } };
 var dl=$('#qlist'); dl.innerHTML=D.sites.map(function(s){ return '<option value="'+esc(s.n)+'">'; }).join('')+D.countries.map(function(c){ return '<option value="'+esc(c.n)+'">'; }).join('');
 var q=$('#q'), qt=null;
 q.addEventListener('input',function(){ clearTimeout(qt); qt=setTimeout(function(){ var v=q.value.trim(); var c=D.countries.filter(function(x){return x.n.toLowerCase()===v.toLowerCase();})[0]; var s=D.sites.filter(function(x){return x.n===v;})[0];
   if(s){ ST.q=''; applyFilters(); openSite(s.id); return; } if(c){ ST.q=''; applyFilters(); openCountry(c.id); return; }
   ST.q=v; applyFilters(); },160); });
 q.addEventListener('keydown',function(e){ if(e.key!=='Enter') return; e.preventDefault(); var v=q.value.trim().toLowerCase(); if(!v) return;
  var c=D.countries.filter(function(x){ return x.n.toLowerCase().indexOf(v)===0||SHORT[x.id].toLowerCase()===v; })[0];
  if(c){ ST.q=''; applyFilters(); openCountry(c.id); q.blur(); return; }
  var hit=D.sites.filter(matches)[0]; if(hit){ openSite(hit.id); q.blur(); } else toast('Nothing found for “'+q.value.trim()+'”.'); });
 $('#statsBtn').onclick=function(){ openOv(ST.ov==='stats'?null:'stats'); };
 $('#histBtn').onclick=function(){ openOv(ST.ov==='hist'?null:'hist'); };
});

/* ---------------- toast ---------------- */
var toastT=null;
function toast(msg,ms){ safe('toast',function(){ var t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(function(){ t.classList.remove('show'); },ms||3200); }); }

/* ---------------- panel ---------------- */
var $panel=$('#panel'), $pbody=$('#pbody');
function setHash(h){ try{ history.replaceState(null,'',location.pathname+location.search+(h?'#'+h:'')); }catch(e){} }
function showPanel(html,key){
 var prev=ST.sel; ST.sel=key;
 $pbody.innerHTML=html; $pbody.scrollTop=0; $pbody.classList.remove('swap'); void $pbody.offsetWidth; $pbody.classList.add('swap');
 $panel.classList.add('open'); if(isMobile()) $panel.classList.remove('full');
 if(ST.ov&&isMobile()) openOv(null);
 $$('.cb.sel').forEach(function(e){ e.classList.remove('sel'); });
 if(key&&key.indexOf('c:')===0){ var b=$('.cb[data-c="'+key.slice(2)+'"]'); if(b) b.classList.add('sel'); }
 restyleSites();
 if(key&&key.indexOf('s:')===0&&mk[key.slice(2)]) mk[key.slice(2)].bringToFront();
 $$('[data-site]',$pbody).forEach(function(b){ b.onclick=function(){ openSite(b.getAttribute('data-site'),false,true); }; });
 $$('[data-country]',$pbody).forEach(function(b){ b.onclick=function(){ var id=b.getAttribute('data-country'); if(CBY[id]) openCountry(id); else openHost(id); }; });
}
function closePanel(){ ST.sel=null; $panel.classList.remove('open','full'); $$('.cb.sel').forEach(function(e){ e.classList.remove('sel'); }); restyleSites(); setHash(''); }
$('#pclose').onclick=closePanel;
document.addEventListener('keydown',function(e){ if(e.key==='Escape'){ if(ST.ov) openOv(null); else if(ST.sel) closePanel(); } });
map.on('click',function(){ $('#aboutBox').classList.remove('show'); if(ST.sel&&!isMobile()) closePanel(); });

function panTo(ll,z){ var off=isMobile()?[0,window.innerHeight*0.24]:[-200,0];
 var tz=Math.max(map.getZoom(),z||map.getZoom()); var p=map.project(L.latLng(ll),tz).add(L.point(-off[0],off[1]));
 var c=map.unproject(p,tz); if(REDUCED) map.setView(c,tz,{animate:false}); else map.flyTo(c,tz,{duration:1.0}); }
function sitePlaceholder(s){ return '<div class="ph none"><div class="ph-empty"><span class="i">✸</span>No photo available</div></div>'; }
function satUrl(s){ var lat=s.lat, lon=s.lon, R=6378137, x=lon*Math.PI/180*R, y=Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))*R;
 var w=s.t==='test'?26000:(s.approx?14000:2600); var hw=w/2/Math.cos(lat*Math.PI/180), hh=hw*600/960;
 return ESRI+'World_Imagery/MapServer/export?bbox='+[x-hw,y-hh,x+hw,y+hh].map(function(v){return v.toFixed(1);}).join(',')+'&bboxSR=3857&imageSR=3857&size=960,600&format=jpg&f=image'; }
function satHtml(s,fallback){ var km=s.t==='test'?26:(s.approx?14:2.6);
 return '<div class="ph sat"><img src="'+esc(satUrl(s))+'" alt="Satellite view of the '+esc(s.n)+' area" decoding="async" referrerpolicy="no-referrer"><span class="satpin"></span><span class="satlbl">Satellite view'+(s.approx?' · approx. area':'')+'</span></div>'+
  '<div class="credit">Satellite view (~'+km+' km across) · Imagery © Esri, Maxar, Earthstar Geographics'+(fallback?' · the photo could not be loaded':' · no freely licensed photo used')+'</div>'; }
function wirePhoto(s){
 var img=$('img',$pbody); if(!img) return; var ph=img.parentNode;
 var ok=function(){ ph.classList.add('loaded'); };
 var fail=function(){ if(!ph.isConnected) return; if(ph.classList.contains('sat')){ ph.className='ph none'; ph.innerHTML='<div class="ph-empty"><span class="i">✸</span>Image unavailable</div>'; return; }
  var cr=ph.nextElementSibling, tmp=document.createElement('div'); tmp.innerHTML=satHtml(s,true); ph.replaceWith(tmp.firstElementChild); if(cr&&cr.classList.contains('credit')) cr.replaceWith(tmp.lastElementChild); wirePhoto(s); };
 img.addEventListener('load',ok); img.addEventListener('error',fail); if(img.complete){ if(img.naturalWidth) ok(); else fail(); }
}
function sourcesHtml(keys,extra){ var seen={}, li=[];
 (extra||[]).forEach(function(x){ li.push('<li><a href="'+esc(x.u)+'" target="_blank" rel="noopener">'+esc(x.n)+'</a></li>'); });
 keys.forEach(function(k){ if(seen[k]||!SRC[k]) return; seen[k]=1; li.push('<li>'+srcLink(k)+'</li>'); });
 return '<ul class="srcs">'+li.join('')+'</ul>'; }
var DISC='<div class="disc">Based on public estimates from FAS, SIPRI and the Bulletin of the Atomic Scientists; exact numbers and locations are classified. Every figure here is an estimate.</div>';

function openSite(id,noPan,fromCard){
 var s=SBY[id]; if(!s) return;
 var T=TYPES[s.t], img=s.image?('<div class="ph"><img class="photo" src="'+esc(s.image.url)+'" alt="'+esc(s.n)+'" decoding="async"></div><div class="credit">Photo: <a href="'+esc(s.image.page)+'" target="_blank" rel="noopener">'+esc(s.image.artist)+'</a> · '+esc(s.image.license)+' · via Wikimedia Commons</div>'):satHtml(s,false);
 var figs=(s.figs||[]).map(function(f){ var sc=f[2]?('<span class="sc">'+(f[2]==='wiki'?'<a href="'+esc(s.wurl)+'" target="_blank" rel="noopener">Wikipedia</a>':(SRC[f[2]]?'<a href="'+esc(SRC[f[2]].u)+'" target="_blank" rel="noopener">'+esc(srcShort(f[2]))+'</a>':''))+'</span>'):'';
  return '<tr><td>'+esc(f[0])+'</td><td>'+esc(f[1])+sc+'</td></tr>'; }).join('');
 var where=cname(s.c)+(s.host&&s.host!==s.c?' · located in '+cname(s.host):'');
 var keys=(s.src||[]).filter(function(k){return k!=='wiki';});
 var c=CBY[s.c];
 var html=img+'<div class="pc">'+
  '<span class="badge" style="color:'+T.c+';border-color:'+T.c+'66"><i></i>'+esc(T.s)+'</span>'+
  (s.st!=='active'?'<span class="tag">'+esc(STAT[s.st])+'</span>':'')+(s.also||[]).map(function(a){ return '<span class="tag">+ '+esc(TYPES[a].s)+'</span>'; }).join('')+
  '<h2>'+esc(s.n)+'</h2><div class="sub">'+(FLAG[s.c]?FLAG[s.c]+' ':'')+esc(where)+'</div>'+
  (s.approx?'<div class="approx">⚑ Location approximate – '+esc(s.approx)+'</div>':'')+
  '<h3>What open sources say</h3><div class="what">'+esc(s.what)+'</div>'+
  (figs?'<h3>Figures <span class="est" style="margin-left:0">estimates</span></h3><table class="kv">'+figs+'</table>':'<div class="note" style="margin-top:8px">No published figures for this site.</div>')+
  '<div class="acts">'+(c?'<button type="button" data-country="'+s.c+'">'+(FLAG[s.c]||'')+' '+esc(c.n)+' – arsenal</button>':'')+(s.host&&HBY[s.host]?'<button type="button" data-country="'+s.host+'">'+(FLAG[s.host]||'')+' '+esc(HBY[s.host].n)+'</button>':'')+'<button type="button" id="zoomTo">Zoom to site</button></div>'+
  '<h3>Sources</h3>'+sourcesHtml(keys,s.wurl?[{n:'Wikipedia – '+s.wtitle,u:s.wurl}]:[])+
  '<div class="links"><a href="https://www.google.com/maps/search/?api=1&query='+s.lat+','+s.lon+'" target="_blank" rel="noopener">Open in Google Maps</a></div>'+
  DISC+'</div>';
 showPanel(html,'s:'+id); wirePhoto(s); setHash('s/'+id);
 var zb=$('#zoomTo'); if(zb) zb.onclick=function(){ panTo([s.lat,s.lon],s.t==='test'?9:12); };
 if(!noPan) panTo([s.lat,s.lon],fromCard?7:Math.max(map.getZoom(),5));
}

var ICON={land:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3 7v9l-3 3-3-3V9z"/><path d="M9 14l-3 3M15 14l3 3"/></svg>',
 sea:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 15c2 0 2-1.5 4.5-1.5S9.5 15 12 15s2.5-1.5 4.5-1.5S19 15 21 15"/><path d="M5 12h12l2-3H9l-1-3H6v6"/><path d="M3 19c2 0 2-1.5 4.5-1.5S9.5 19 12 19s2.5-1.5 4.5-1.5S19 19 21 19"/></svg>',
 air:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2c1 0 1.5 1 1.5 2v5l7 4v2l-7-2v4l2 2v1.5L12 19.5 8.5 20.5V19l2-2v-4l-7 2v-2l7-4V4c0-1 .5-2 1.5-2z"/></svg>'};
function triadRow(k,label,txt){ var none=/^None/.test(txt); return '<div class="tr'+(none?' none':'')+'"><span class="ic">'+ICON[k]+'</span><div class="tx"><b>'+label+'</b>'+esc(txt)+'</div></div>'; }
function openCountry(id,noPan){
 var c=CBY[id]; if(!c) return;
 var sites=D.sites.filter(function(s){ return s.c===id; });
 var share=(c.tot/META.totals.tot*100);
 function cell(k,v,s,big){ return '<div class="fact'+(big?' big':'')+'"><div class="k">'+k+'</div><div class="v">'+(v==null?'<span style="color:var(--muted)">n/a</span>':(v===0?'0':'~'+fmt(v)))+'<span class="est">est.</span></div><div class="s">'+s+'</div></div>'; }
 var retTxt=c.ret==null?null:c.ret;
 var mixT=c.tot||1, dep=c.dep||0, sto=c.sto||0, ret=c.ret||0;
 var fas=c.fas;
 var fasRow='<table class="kv"><tr><td>Deployed strategic</td><td>'+fmt(fas.ds)+'</td></tr><tr><td>Deployed non-strategic</td><td>'+(fas.dn==null?'n.a.':fmt(fas.dn))+'</td></tr><tr><td>Reserve / non-deployed</td><td>'+fmt(fas.res)+'</td></tr><tr><td>Military stockpile</td><td>'+fmt(fas.mil)+'</td></tr><tr><td>Total inventory</td><td>'+fmt(fas.tot)+'</td></tr></table>';
 var html='<div class="pc" style="padding-top:22px">'+
  '<span class="badge" style="color:#fecdd3;border-color:var(--wx-line)"><i></i>Nuclear-armed state</span>'+(c.test?'<span class="tag">First test '+c.test+'</span>':'<span class="tag">No acknowledged test</span>')+
  '<h2>'+(FLAG[id]||'')+' '+esc(c.n)+'</h2><div class="sub">'+share.toFixed(share<1?1:0)+'% of the world’s estimated '+fmt(META.totals.tot)+' warheads ('+esc(META.asof)+')</div>'+
  '<div class="facts">'+cell('Total inventory',c.tot,'SIPRI 2026 · FAS 2026',true)+cell('Military stockpile',c.mil,'SIPRI 2026')+cell('Deployed',c.dep,'SIPRI 2026'+(c.note?' · see note':''))+cell('Stored (reserve)',c.sto,'SIPRI 2026')+cell('Retired, awaiting dismantlement',retTxt,c.ret==null?'not available':'SIPRI 2026')+'</div>'+
  '<div class="mix">'+(dep?'<i style="width:'+(dep/mixT*100)+'%;background:#fb7185"></i>':'')+(sto?'<i style="width:'+(sto/mixT*100)+'%;background:#9f1239"></i>':'')+(ret?'<i style="width:'+(ret/mixT*100)+'%;background:#475569"></i>':'')+'</div>'+
  '<div class="mixl"><span><b style="background:#fb7185"></b>Deployed</span><span><b style="background:#9f1239"></b>Stored</span><span><b style="background:#475569"></b>Retired</span></div>'+
  (c.note?'<div class="note" style="margin-top:8px">Note: '+esc(c.note)+'</div>':'')+
  '<h3>Delivery systems</h3><div class="triad">'+triadRow('land','Land',c.land)+triadRow('sea','Sea',c.sea)+triadRow('air','Air',c.air)+'</div>'+
  '<h3>History</h3><div class="what" style="margin-top:0">'+esc(c.hist)+'</div>'+
  '<h3>FAS breakdown, 2026 <span class="est" style="margin-left:0">estimates</span></h3>'+fasRow+
  (sites.length?'<h3>Mapped sites ('+sites.length+')</h3><div class="slist">'+sites.map(function(s){ var T=TYPES[s.t]; return '<button type="button" data-site="'+s.id+'"><i style="border-color:'+T.c+';background:'+(s.st==='historic'?'transparent':T.c)+'"></i>'+esc(s.n)+'<small>'+esc(T.s)+'</small></button>'; }).join('')+'</div>':'')+
  '<h3>Sources</h3>'+sourcesHtml(['sipri26','fasStatus',c.nb])+DISC+'</div>';
 showPanel(html,'c:'+id); setHash('c/'+id);
 if(!noPan){ var p=polyBy[id]; if(p&&map.getZoom()>4){} }
}
function openHost(id){
 var h=HBY[id]; if(!h) return;
 var bases=h.bases.map(function(b){ return SBY[b]; }).filter(Boolean);
 var html='<div class="pc" style="padding-top:22px">'+
  '<span class="badge" style="color:'+(h.russia?'#fdba74':'#fde047')+';border-color:'+(h.russia?'#fdba7466':'#fde04766')+'"><i></i>'+(h.russia?'Russian nuclear sharing (unconfirmed)':'Hosts US weapons (est.)')+'</span>'+
  '<h2>'+(FLAG[id]||'')+' '+esc(h.n)+'</h2><div class="sub">'+esc(h.txt)+'</div>'+
  (h.russia?'':'<div class="facts"><div class="fact big"><div class="k">US B61 bombs in Europe, all host bases</div><div class="v">~100<span class="est">est.</span></div><div class="s">FAS 2026 (100–120 per SIPRI 2026, if Lakenheath is included). Per-base numbers are not published, except Incirlik: 20–30 (FAS est.).</div></div></div>')+
  (bases.length?'<h3>Bases</h3><div class="slist">'+bases.map(function(s){ var T=TYPES[s.t]; return '<button type="button" data-site="'+s.id+'"><i style="border-color:'+T.c+';background:'+T.c+'"></i>'+esc(s.n)+'<small>'+esc(STAT[s.st])+'</small></button>'; }).join('')+'</div>':'')+
  '<h3>Sources</h3>'+sourcesHtml(h.russia?['fasRU26']:['fasUS26','sipri26','fasStatus'])+DISC+'</div>';
 showPanel(html,'h:'+id); setHash('c/'+id);
}

/* bottom sheet: tap the handle to expand/collapse, drag down to dismiss */
safe('sheet',function(){ var g=$('#pgrab'), y0=null, dy=0;
 g.addEventListener('pointerdown',function(e){ y0=e.clientY; dy=0; $panel.classList.add('dragging'); try{ g.setPointerCapture(e.pointerId); }catch(x){} });
 g.addEventListener('pointermove',function(e){ if(y0===null) return; dy=e.clientY-y0; $panel.style.transform='translateY('+Math.max(dy,-40)+'px)'; });
 var end=function(){ if(y0===null) return; $panel.classList.remove('dragging'); $panel.style.transform='';
  if(Math.abs(dy)<6) $panel.classList.toggle('full'); else if(dy>90){ if($panel.classList.contains('full')) $panel.classList.remove('full'); else closePanel(); } else if(dy<-40) $panel.classList.add('full'); y0=null; };
 g.addEventListener('pointerup',end); g.addEventListener('pointercancel',end);
});

/* ---------------- overview: stats + history chart ---------------- */
var $ov=$('#ov'), $ovb=$('#ovbody');
function openOv(tab){
 ST.ov=tab; $('#statsBtn').classList.toggle('on',tab==='stats'); $('#histBtn').classList.toggle('on',tab==='hist');
 if(!tab){ $ov.classList.remove('open'); if(/^#(stats|history)$/.test(location.hash)) setHash(''); return; }
 if(isMobile()&&ST.sel) closePanel();
 $$('.tabs button',$ov).forEach(function(b){ b.classList.toggle('on',b.getAttribute('data-tab')===tab); b.setAttribute('aria-selected',b.getAttribute('data-tab')===tab); });
 $ovb.innerHTML=tab==='stats'?statsHtml():histHtml(); $ovb.scrollTop=0;
 $ov.classList.add('open'); setHash(tab==='stats'?'stats':'history');
 if(tab==='hist') safe('chart',wireChart); else $$('[data-country]',$ovb).forEach(function(b){ b.onclick=function(){ openCountry(b.getAttribute('data-country')); if(isMobile()) openOv(null); }; });
}
$$('.tabs button',$ov).forEach(function(b){ b.onclick=function(){ openOv(b.getAttribute('data-tab')); }; });
$('#ovclose').onclick=function(){ openOv(null); };
function statsHtml(){
 var T=META.totals, P=META.peak, us=CBY.US.tot, ru=CBY.RU.tot;
 var cs=D.countries.slice().sort(function(a,b){ return b.tot-a.tot; });
 var cnt={}; D.sites.forEach(function(s){ cnt[s.t]=(cnt[s.t]||0)+1; });
 return '<div class="kpis">'+
  '<div class="kpi"><div class="k">Total inventory</div><div class="v">~'+fmt(T.tot)+'</div><div class="s">warheads, '+esc(META.asof)+' · SIPRI/FAS est.</div></div>'+
  '<div class="kpi"><div class="k">Military stockpiles</div><div class="v">~'+fmt(T.mil)+'</div><div class="s">available for use · est.</div></div>'+
  '<div class="kpi"><div class="k">Deployed</div><div class="v">~'+fmt(T.dep_sipri)+'</div><div class="s">SIPRI est. (FAS: ~'+fmt(T.dep_fas)+')</div></div>'+
  '<div class="kpi"><div class="k">Retired, awaiting dismantlement</div><div class="v">~'+fmt(T.ret)+'</div><div class="s">mostly US and Russia · est.</div></div>'+
  '</div>'+
  '<h3>Total inventory by country <span class="est" style="margin-left:0">est. '+META.year+'</span></h3><div class="bars">'+
  cs.map(function(c){ var w=c.tot/maxTot*100, t=c.tot||1; return '<button type="button" class="bar" data-country="'+c.id+'"><span class="nm">'+(FLAG[c.id]||'')+' '+esc(SHORT[c.id])+'</span><span class="bt" style="width:100%"><span style="display:flex;width:'+Math.max(w,0.8)+'%"><i style="width:'+((c.dep||0)/t*100)+'%;background:#fb7185"></i><i style="width:'+((c.sto||0)/t*100)+'%;background:#9f1239"></i><i style="width:'+((c.ret||0)/t*100)+'%;background:#475569"></i></span></span><span class="n">'+fmt(c.tot)+'</span></button>'; }).join('')+
  '</div><div class="mixl" style="margin-top:8px"><span><b style="background:#fb7185"></b>Deployed</span><span><b style="background:#9f1239"></b>Stored</span><span><b style="background:#475569"></b>Retired</span></div>'+
  '<div class="cnote">The United States and Russia hold about '+Math.round((us+ru)/T.tot*100)+'% of all warheads. The global inventory peaked at about '+fmt(P.n)+' in '+P.y+' and is now ~'+Math.round((1-T.tot/P.n)*100)+'% lower, but military stockpiles are growing again (China, India, North Korea, Pakistan and the UK are thought to be increasing theirs). About '+esc(T.alert)+' warheads are kept on high alert.</div>'+
  '<h3>Mapped sites by type</h3><div class="tcount">'+TORDER.map(function(t){ return '<div><i style="border-color:'+TYPES[t].c+';background:'+(t==='test'||t==='use'?'transparent':TYPES[t].c)+'"></i>'+esc(TYPES[t].n)+'<b>'+(cnt[t]||0)+'</b></div>'; }).join('')+'</div>'+
  '<div class="cnote">'+D.sites.length+' publicly identified sites, shown at installation level only. Sources: '+srcLink('sipri26','SIPRI Yearbook 2026')+', '+srcLink('fasStatus','FAS Status of World Nuclear Forces 2026')+' and the FAS Nuclear Notebooks.</div>'+DISC;
}
function histHtml(){
 return '<div class="ckey"><span><i style="background:#60a5fa"></i>United States</span><span><i style="background:#fb7185"></i>Russia / USSR</span><span><i style="background:#fbbf24"></i>All other states</span><span><i class="ln"></i>Global total incl. retired warheads</span></div>'+
  '<div class="chart" id="chart"></div>'+
  '<div class="cnote">Estimated nuclear warheads, 1945–2026. Coloured areas are military stockpiles; the white line is the global total inventory, which also counts retired warheads awaiting dismantlement. Data: Federation of American Scientists (Kristensen, Korda, Norris, Johns & Knight-Boyle), via '+srcLink('owid','Our World in Data')+'. All values are estimates.</div>'+DISC;
}
function wireChart(){
 var H=D.history, y0=H.years[0], n=H.world.length, W=720, Hh=330, m={l:46,r:16,t:16,b:28};
 var maxV=80000, iw=W-m.l-m.r, ih=Hh-m.t-m.b;
 function X(i){ return m.l+i/(n-1)*iw; } function Y(v){ return m.t+ih-v/maxV*ih; }
 function area(lo,hi){ var top=[],bot=[]; for(var i=0;i<n;i++){ top.push(X(i).toFixed(1)+','+Y(hi[i]).toFixed(1)); bot.push(X(i).toFixed(1)+','+Y(lo[i]).toFixed(1)); } return 'M'+top.join('L')+'L'+bot.reverse().join('L')+'Z'; }
 var z=H.world.map(function(){return 0;}), a1=H.US.slice(), a2=a1.map(function(v,i){return v+H.RU[i];}), a3=a2.map(function(v,i){return v+H.other[i];});
 var s='<svg viewBox="0 0 '+W+' '+Hh+'" role="img" aria-label="Chart of estimated global nuclear warheads 1945 to 2026"><g class="ax">';
 for(var v=0;v<=maxV;v+=20000){ s+='<line x1="'+m.l+'" x2="'+(W-m.r)+'" y1="'+Y(v)+'" y2="'+Y(v)+'"/><text x="'+(m.l-8)+'" y="'+(Y(v)+4)+'" text-anchor="end">'+(v?(v/1000)+'k':'0')+'</text>'; }
 for(var yr=1950;yr<=2020;yr+=10){ var i=yr-y0; s+='<text x="'+X(i)+'" y="'+(Hh-8)+'" text-anchor="middle">'+yr+'</text>'; }
 s+='</g><path d="'+area(z,a1)+'" fill="#60a5fa" fill-opacity=".75"/><path d="'+area(a1,a2)+'" fill="#fb7185" fill-opacity=".75"/><path d="'+area(a2,a3)+'" fill="#fbbf24" fill-opacity=".85"/>';
 s+='<path d="M'+H.world.map(function(v,i){ return X(i).toFixed(1)+','+Y(v).toFixed(1); }).join('L')+'" fill="none" stroke="#fff" stroke-width="2"/>';
 var pi=H.world.indexOf(Math.max.apply(null,H.world)), li=n-1;
 s+='<circle cx="'+X(pi)+'" cy="'+Y(H.world[pi])+'" r="4" fill="#fff"/><text x="'+(X(pi)+8)+'" y="'+(Y(H.world[pi])-6)+'" fill="#e8edf4" font-size="12" font-weight="600">Peak ~'+fmt(H.world[pi])+' ('+(y0+pi)+')</text>';
 s+='<circle cx="'+X(li)+'" cy="'+Y(H.world[li])+'" r="4" fill="#fff"/><text x="'+(X(li)-6)+'" y="'+(Y(H.world[li])-10)+'" fill="#e8edf4" font-size="12" font-weight="600" text-anchor="end">~'+fmt(H.world[li])+' ('+(y0+li)+')</text>';
 s+='<line id="cx" x1="0" x2="0" y1="'+m.t+'" y2="'+(m.t+ih)+'" stroke="rgba(255,255,255,.55)" stroke-dasharray="3 3" style="display:none"/><rect id="chit" x="'+m.l+'" y="'+m.t+'" width="'+iw+'" height="'+ih+'" fill="transparent"/></svg><div class="tipc" id="ctip"></div>';
 var el=$('#chart'); el.innerHTML=s;
 var svg=$('svg',el), cx=$('#cx',el), tip=$('#ctip',el);
 function show(evt){ var r=svg.getBoundingClientRect(), pt=(evt.touches?evt.touches[0]:evt), x=(pt.clientX-r.left)/r.width*W; var i=Math.max(0,Math.min(n-1,Math.round((x-m.l)/iw*(n-1))));
  cx.setAttribute('x1',X(i)); cx.setAttribute('x2',X(i)); cx.style.display='';
  tip.innerHTML='<b>'+(y0+i)+'</b><br><i style="background:#fff"></i>Global total: '+fmt(H.world[i])+'<br><i style="background:#60a5fa"></i>US: '+fmt(H.US[i])+'<br><i style="background:#fb7185"></i>Russia/USSR: '+fmt(H.RU[i])+'<br><i style="background:#fbbf24"></i>Others: '+fmt(H.other[i]);
  var px=X(i)/W*r.width; tip.style.left=Math.max(70,Math.min(r.width-70,px))+'px'; tip.classList.add('show'); }
 function hide(){ cx.style.display='none'; tip.classList.remove('show'); }
 var hit=$('#chit',el); hit.addEventListener('mousemove',show); hit.addEventListener('mouseleave',hide); hit.addEventListener('touchstart',show,{passive:true}); hit.addEventListener('touchmove',show,{passive:true}); hit.addEventListener('touchend',function(){ setTimeout(hide,1600); });
}

/* ---------------- about ---------------- */
safe('about',function(){
 var b=$('#aboutBox');
 b.innerHTML='<b>About this map</b><br><span style="color:#fecdd3">Based on public estimates from FAS, SIPRI and the Bulletin of the Atomic Scientists; exact numbers and locations are classified.</span><br><br>'+
  'Country figures are the January '+META.year+' estimates of the nine nuclear-armed states. Sites are only those publicly identified in open sources (FAS Nuclear Notebooks, official pages, Wikipedia) and are placed at the installation or town level, never at individual bunkers or silos. Where a source gives no number, the field is left blank. Photos are freely licensed images from Wikimedia Commons; otherwise an Esri satellite view of the area is shown.'+
  '<br><br><b>Sources</b><ul>'+Object.keys(SRC).map(function(k){ return '<li>'+srcLink(k)+'</li>'; }).join('')+'<li>Country outlines: Natural Earth (public domain)</li><li>Coordinates: Wikipedia / Wikidata</li></ul>'+
  '<span class="note">Not an official product. Data compiled '+esc(META.generated)+'.</span><br><br><b>More maps</b><br><a href="../">☢ World nuclear power plants</a> · <a href="../planes/">✈ Planes nearby (live)</a>';
 $('#aboutBtn').onclick=function(e){ e.stopPropagation(); b.classList.toggle('show'); };
});

/* ---------------- init ---------------- */
safe('filters',applyFilters);
safe('zoom',zoomLayers);
safe('hash',function(){ var h=location.hash.replace(/^#/,''), m;
 if((m=/^s\/(.+)$/.exec(h))&&SBY[m[1]]) openSite(m[1],false,true);
 else if((m=/^c\/(.+)$/.exec(h))){ if(CBY[m[1]]) openCountry(m[1]); else if(HBY[m[1]]) openHost(m[1]); }
 else if(h==='stats') openOv('stats'); else if(h==='history') openOv('hist');
});
setTimeout(function(){ document.body.classList.remove('intro'); },1200);
window.NWMAP={map:map,state:ST,openSite:openSite,openCountry:openCountry,openHost:openHost,openOv:openOv,closePanel:closePanel,data:D};
})();
