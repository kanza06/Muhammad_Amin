'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Camera, Check, ChevronLeft, ChevronRight, Download, Heart, Image as ImageIcon, LogIn, LogOut, Maximize, Monitor, Palette, Printer, RefreshCw, Settings, Sparkles, Star, Trash2, Upload, User, Wifi, X, Zap } from 'lucide-react';

type Screen='login'|'dashboard'|'capture'|'edit'|'output'|'frames';
type Orientation='portrait'|'landscape';
type Shot={src:string; dataUrl:string};

type UsbState='IDLE'|'CONNECTED'|'OPENING'|'OPENED'|'CLOSED'|'ERROR'|'NO_DEVICE';
type CameraSettings={width:number;height:number;rotate:number;mjpeg:boolean;aspect:boolean;mirror:boolean;front:boolean;state:string;usbAvailable:boolean};
type UsbDeviceInfo={name:string;vid:string;pid:string;ifaces:number;classes:string;permission:boolean};
const DEFAULT_CAMERA_SETTINGS:CameraSettings={width:1920,height:1080,rotate:0,mjpeg:true,aspect:true,mirror:false,front:true,state:'IDLE',usbAvailable:false};
const CAMERA_RESOLUTIONS:[number,number][]=[[640,480],[1280,720],[1920,1080],[2560,1440],[3840,2160]];

// Jembatan native Android (window.KahfiNative) — didefinisikan oleh WebView shell KAHFI.
type KahfiNativeBridge={
  isAvailable?:()=>boolean;
  hasUsbCamera?:()=>boolean;
  getUsbCameraState?:()=>string;
  getUsbDeviceInfo?:()=>string;
  rescanUsb?:()=>string;
  scanUsbDevices?:()=>string;
  requestUsbPermissionAt?:(index:number)=>void;
  startUsbCamera?:()=>void;
  stopUsbCamera?:()=>void;
  captureUsbPhoto?:()=>void;
  setUsbResolution?:(width:number,height:number)=>void;
  setPreviewBounds?:(x:number,y:number,width:number,height:number)=>void;
  hidePreview?:()=>void;
  hasPreviewBounds?:()=>boolean;
  getCameraSettings?:()=>string;
  applyCameraSettings?:(width:number,height:number,rotate:number,mjpeg:boolean,aspect:boolean,mirror:boolean)=>void;
  setFrontCameraEnabled?:(enabled:boolean)=>void;
  openCameraSettings?:()=>void;
  saveImage?:(dataUrl:string,fileName?:string)=>void;
  setSiteUrl?:(url:string)=>void;
};
function getNativeBridge():KahfiNativeBridge|undefined{
  if(typeof window==='undefined')return undefined;
  return (window as unknown as {KahfiNative?:KahfiNativeBridge}).KahfiNative;
}
function isNativeShell():boolean{
  if(typeof window==='undefined')return false;
  if(Boolean((window as unknown as {__KAHFI_NATIVE_BRIDGE__?:boolean}).__KAHFI_NATIVE_BRIDGE__))return true;
  // __KAHFI_NATIVE_BRIDGE__ diset oleh onPageFinished (setelah halaman selesai dimuat),
  // jadi saat modul pertama dievaluasi flag itu bisa belum ada. Cek objek bridge-nya juga
  // supaya shell native tidak terlewat pada pemuatan pertama.
  const bridge=getNativeBridge();
  if(bridge?.isAvailable)return Boolean(bridge.isAvailable());
  return Boolean(bridge&&(bridge.startUsbCamera||bridge.getCameraSettings));
}
function parseCameraSettings(raw?:string|null):CameraSettings{
  if(!raw)return {...DEFAULT_CAMERA_SETTINGS};
  try{return {...DEFAULT_CAMERA_SETTINGS,...(JSON.parse(raw) as Partial<CameraSettings>)};}catch{return {...DEFAULT_CAMERA_SETTINGS};}
}
type Slot={x:number;y:number;width:number;height:number}; // normalized 0..1
type Frame={id:string;name:string;emoji:string;accent:string;type:'cute'|'party'|'love'|'fun'; orientation:'both'|'portrait'|'landscape'; image?:string; slots?:Slot[]};

const FRAMES:Frame[]=[
 {id:'sweet-pink',name:'Sweet Pink',emoji:'🎀',accent:'#ff7db5',type:'cute',orientation:'both'},
 {id:'cute-pink-real',name:'Cute Pink • 6 Slot',emoji:'🎀',accent:'#eaa4ca',type:'cute',orientation:'portrait',image:'/frames/cute-pink-portrait.png',slots:[{x:.18790,y:.15389,width:.30000,height:.20938},{x:.52903,y:.16362,width:.29677,height:.20023},{x:.18790,y:.39645,width:.30000,height:.20881},{x:.52903,y:.39645,width:.29677,height:.20881},{x:.18790,y:.63558,width:.30000,height:.19966},{x:.52903,y:.63558,width:.29677,height:.19966}]},
 {id:'cute-landscape-real',name:'Cute Landscape • 6 Slot',emoji:'🌈',accent:'#78aee8',type:'cute',orientation:'landscape',image:'/frames/cute-landscape.png',slots:[{x:.11621,y:.27368,width:.22705,height:.23816},{x:.38623,y:.27368,width:.22852,height:.23816},{x:.65625,y:.27368,width:.22705,height:.23955},{x:.11621,y:.57660,width:.22705,height:.24025},{x:.38623,y:.57660,width:.22852,height:.24025},{x:.65625,y:.57660,width:.22705,height:.24791}]},
 {id:'teddy',name:'Teddy Love',emoji:'🧸',accent:'#c7895b',type:'cute',orientation:'portrait'},
 {id:'bunny',name:'Bunny Dream',emoji:'🐰',accent:'#c88cff',type:'cute',orientation:'portrait'},
 {id:'flower',name:'Flower Garden',emoji:'🌸',accent:'#ff83a7',type:'cute',orientation:'both'},
 {id:'rainbow',name:'Rainbow Day',emoji:'🌈',accent:'#7ab7ff',type:'fun',orientation:'both'},
 {id:'bestie',name:'Best Friends',emoji:'💖',accent:'#5e8fff',type:'love',orientation:'landscape'},
 {id:'party',name:'Happy Party',emoji:'🎉',accent:'#ffb347',type:'party',orientation:'landscape'},
 {id:'strawberry',name:'Strawberry',emoji:'🍓',accent:'#ff626e',type:'cute',orientation:'portrait'},
 {id:'star',name:'Good Vibes',emoji:'⭐',accent:'#ffb72e',type:'fun',orientation:'landscape'},
 {id:'butterfly',name:'Butterfly',emoji:'🦋',accent:'#67b9ff',type:'cute',orientation:'portrait'},
 {id:'cloud',name:'Cloud Kawaii',emoji:'☁️',accent:'#7bc7ff',type:'cute',orientation:'both'},
 {id:'cherry',name:'Cherry Smile',emoji:'🍒',accent:'#ef6689',type:'love',orientation:'portrait'}
];

const stickers=['✨','💖','🌸','🎀','🧸','⭐','🦋','🍓','☁️','🌈','📸','💕'];

const FRAME_DB='kahfi-photobooth';
const FRAME_STORE='custom-frames';
function openFrameDB():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const req=indexedDB.open(FRAME_DB,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(FRAME_STORE))db.createObjectStore(FRAME_STORE,{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function getSavedFrames():Promise<Frame[]>{try{const db=await openFrameDB();return await new Promise((resolve,reject)=>{const tx=db.transaction(FRAME_STORE,'readonly');const req=tx.objectStore(FRAME_STORE).getAll();req.onsuccess=()=>resolve(req.result as Frame[]);req.onerror=()=>reject(req.error);});}catch{return []}}
async function saveSavedFrame(frame:Frame){const db=await openFrameDB();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(FRAME_STORE,'readwrite');tx.objectStore(FRAME_STORE).put(frame);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
async function removeSavedFrame(id:string){const db=await openFrameDB();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(FRAME_STORE,'readwrite');tx.objectStore(FRAME_STORE).delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}

async function loadImage(src:string):Promise<HTMLImageElement>{return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});}

async function detectFrameSlots(src:string):Promise<{slots:Slot[];orientation:Orientation}>{
 const im=await loadImage(src); const max=700; const scale=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight));
 const w=Math.max(1,Math.round(im.naturalWidth*scale)), h=Math.max(1,Math.round(im.naturalHeight*scale));
 const c=document.createElement('canvas'); c.width=w; c.height=h; const ctx=c.getContext('2d',{willReadFrequently:true})!; ctx.drawImage(im,0,0,w,h);
 const d=ctx.getImageData(0,0,w,h).data; const n=w*h; const mask=new Uint8Array(n);
 for(let i=0,p=0;i<n;i++,p+=4){const a=d[p+3], lum=.299*d[p]+.587*d[p+1]+.114*d[p+2]; mask[i]=(a<35||lum<28)?1:0;}
 // Flood fill connected components; discard the component touching the outer image boundary (transparent background).
 const seen=new Uint8Array(n), comps:Array<{x0:number;y0:number;x1:number;y1:number;area:number}> = [];
 const qx=new Int32Array(n), qy=new Int32Array(n);
 for(let y=0;y<h;y++) for(let x=0;x<w;x++){const idx=y*w+x;if(!mask[idx]||seen[idx])continue; let head=0,tail=0,area=0,x0=x,x1=x,y0=y,y1=y,touches=false; qx[tail]=x;qy[tail++]=y;seen[idx]=1;
   while(head<tail){const cx=qx[head],cy=qy[head++]; area++; if(cx===0||cy===0||cx===w-1||cy===h-1)touches=true; if(cx<x0)x0=cx;if(cx>x1)x1=cx;if(cy<y0)y0=cy;if(cy>y1)y1=cy;
     const ns=[[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]]; for(const [nx,ny] of ns){if(nx<0||ny<0||nx>=w||ny>=h)continue;const ni=ny*w+nx;if(mask[ni]&&!seen[ni]){seen[ni]=1;qx[tail]=nx;qy[tail++]=ny;}}
   }
   const cw=x1-x0+1,ch=y1-y0+1; const ratio=cw/ch; const areaRatio=area/(w*h);
   if(!touches && area>Math.max(250, n*.008) && cw>35 && ch>35 && ratio>.55 && ratio<2.8 && areaRatio<.35) comps.push({x0,y0,x1,y1,area});
 }
 // If the six holes are dark but anti-aliased, components may split. Merge nearby boxes, then keep the six largest plausible holes.
 comps.sort((a,b)=>b.area-a.area); const chosen=comps.slice(0,12);
 // Prefer six boxes whose centers are spatially spread; in normal photobooth frames these are the six large holes.
 chosen.sort((a,b)=>a.y0-b.y0 || a.x0-b.x0);
 const six=chosen.slice(0,6).sort((a,b)=>a.y0-b.y0 || a.x0-b.x0);
 const outW=im.naturalWidth,outH=im.naturalHeight;
 const slots=six.map(b=>({x:b.x0/w,y:b.y0/h,width:(b.x1-b.x0+1)/w,height:(b.y1-b.y0+1)/h}));
 const orientation:Orientation=outW>=outH?'landscape':'portrait';
 return {slots,orientation};
}

const DEFAULT_SLOTS=(W:number,H:number):Slot[]=>{const margin=W*.145,gap=W*.035,cellW=(W-margin*2-gap)/2,cellH=(H*.72-gap*2)/3;const top=H*.155;return Array.from({length:6},(_,i)=>({x:margin+(i%2)*(cellW+gap),y:top+Math.floor(i/2)*(cellH+gap),width:cellW,height:cellH}));};

export default function Home(){
 const [screen,setScreen]=useState<Screen>('login');
 const [user,setUser]=useState(''); const [password,setPassword]=useState('');
 const [orientation,setOrientation]=useState<Orientation>('portrait');
 const [timer,setTimer]=useState(3); const [shots,setShots]=useState<Shot[]>([]);
 const [frame,setFrame]=useState<Frame>(FRAMES[0]); const [sticker,setSticker]=useState('✨'); const [selectedShot,setSelectedShot]=useState(0);
 const [notice,setNotice]=useState('');
 const [isKiosk,setIsKiosk]=useState(false);
 const [customFrames,setCustomFrames]=useState<Frame[]>([]);
 const [calibration,setCalibration]=useState<Frame|null>(null);
 const [settingsOpen,setSettingsOpen]=useState(false);
 const allFrames=useMemo(()=>[...FRAMES,...customFrames],[customFrames]);

 useEffect(()=>{ const saved=localStorage.getItem('kahfi-user'); if(saved) setUser(saved); getSavedFrames().then(setCustomFrames); },[]);
 const login=()=>{ if(!user.trim()||!password){setNotice('Masukkan username dan password terlebih dahulu.');return;} localStorage.setItem('kahfi-user',user.trim());setScreen('dashboard');setNotice(''); };
 const logout=()=>{localStorage.removeItem('kahfi-user');setPassword('');setScreen('login');setNotice('');};
 const start=()=>{setShots([]);setScreen('capture');};
 const nextToEdit=()=>{if(shots.length<6){setNotice('Ambil 6 foto terlebih dahulu.');return;}setScreen('edit');setNotice('');};
 const enterKiosk=async()=>{try{if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();setIsKiosk(true)}catch{setNotice('Fullscreen tidak diizinkan browser. Anda tetap bisa menggunakan aplikasi.')}};
 const addCustomFrame=(name:string)=>{const f:Frame={id:'custom-'+Date.now(),name,emoji:'💗',accent:'#7c8cff',type:'cute',orientation:'both'};setCustomFrames(v=>[...v,f]);setFrame(f);saveSavedFrame(f).catch(()=>{});};
 const addUploadedFrame=async(data:string,name:string)=>{
   try{
     const detected=await detectFrameSlots(data);
     const im=await loadImage(data);
     const fallback=DEFAULT_SLOTS(im.naturalWidth,im.naturalHeight).map(s=>({x:s.x/im.naturalWidth,y:s.y/im.naturalHeight,width:s.width/im.naturalWidth,height:s.height/im.naturalHeight}));
     const f:Frame={id:'upload-'+Date.now(),name,emoji:'💖',accent:'#7c8cff',type:'cute',orientation:detected.orientation,image:data,slots:detected.slots.length===6?detected.slots:fallback};
     setOrientation(detected.orientation);
     setCalibration(f);
     setNotice(detected.slots.length===6?'✨ Saya menemukan 6 area sebagai titik awal. Silakan cek/geser sebelum menyimpan.':'✨ Frame siap dikalibrasi. Tentukan 6 lubang lalu tekan Simpan Frame.');
   }catch{setNotice('Frame tidak bisa dibaca. Gunakan PNG/JPG yang valid.');}
 };
 const finishCalibration=async(f:Frame)=>{
   if(!f.slots || f.slots.length!==6){setNotice('Frame harus memiliki tepat 6 slot.');return;}
   const clean={...f,slots:f.slots.map(s=>({x:Math.max(0,Math.min(1,s.x)),y:Math.max(0,Math.min(1,s.y)),width:Math.max(.01,Math.min(1-s.x,s.width)),height:Math.max(.01,Math.min(1-s.y,s.height))}))};
   await saveSavedFrame(clean).catch(()=>{});
   setCustomFrames(v=>{const i=v.findIndex(x=>x.id===clean.id); return i<0?[...v,clean]:v.map((x,n)=>n===i?clean:x)}); setFrame(clean); if(clean.orientation!=='both') setOrientation(clean.orientation); setCalibration(null); setNotice('✓ Frame tersimpan di device ini. 6 slot sudah terkunci.');
 };
 const deleteCustomFrame=async(id:string)=>{await removeSavedFrame(id).catch(()=>{});setCustomFrames(v=>v.filter(f=>f.id!==id));if(frame.id===id){const fallback=FRAMES.find(f=>f.orientation==='both'||f.orientation===orientation)||FRAMES[0];setFrame(fallback);}setNotice('✓ Frame dihapus.');};
 if(screen==='login') return <Login user={user} setUser={setUser} password={password} setPassword={setPassword} onLogin={login} notice={notice}/>;
 // Layout FIT tanpa scroll mengikuti rasio 16:10.
 // Halaman galeri frame (termasuk Tambah Frame) sengaja BOLEH scroll karena daftarnya panjang.
 // Halaman foto (dashboard/capture/edit/output) dipaksa muat dalam satu layar.
 const scrollable=screen==='frames';
 return <main className={scrollable?'h-screen overflow-y-auto p-2 sm:p-3 soft-grid':'h-screen overflow-hidden p-2 sm:p-3 soft-grid'}>
   <div className={scrollable?'flex h-full min-h-0 flex-col':'flex h-full min-h-0 flex-col'}>
   <TopBar user={user} onHome={()=>setScreen('dashboard')} onFullscreen={enterKiosk} kiosk={isKiosk} onLogout={logout} onSettings={()=>setSettingsOpen(true)}/>
   {/* 16:10 stage: konten diskalakan agar selalu muat, bukan sekedar di-crop. */}
   <div className="mx-auto flex w-full min-h-0 flex-1 flex-col max-w-[1600px]">
    {screen==='dashboard'&&<Fit16x10><Dashboard user={user} onStart={start} onFrames={()=>setScreen('frames')} onKiosk={enterKiosk}/></Fit16x10>}
    {screen==='capture'&&<Fit16x10><Capture orientation={orientation} setOrientation={setOrientation} timer={timer} setTimer={setTimer} shots={shots} setShots={setShots} onNext={nextToEdit} onBack={()=>setScreen('dashboard')} notice={notice} setNotice={setNotice}/></Fit16x10>}
    {screen==='edit'&&<Fit16x10><Editor shots={shots} orientation={orientation} frame={frame} setFrame={setFrame} frames={allFrames} sticker={sticker} setSticker={setSticker} selectedShot={selectedShot} setSelectedShot={setSelectedShot} onBack={()=>setScreen('capture')} onNext={()=>setScreen('output')} addCustomFrame={addCustomFrame}/></Fit16x10>}
    {screen==='output'&&<Fit16x10><Output shots={shots} orientation={orientation} frame={frame} sticker={sticker} onBack={()=>setScreen('edit')} onHome={()=>setScreen('dashboard')}/></Fit16x10>}
    {screen==='frames'&&<FrameGallery frames={allFrames} orientation={orientation} setOrientation={setOrientation} selected={frame} setSelected={setFrame} onBack={()=>setScreen('dashboard')} onAdd={addCustomFrame} onUpload={addUploadedFrame} onDelete={deleteCustomFrame} onCalibrate={(f)=>setCalibration(f)} onUse={()=>setScreen('capture')}/>}
   </div>
   </div>
   {calibration&&<FrameCalibration frame={calibration} onCancel={()=>setCalibration(null)} onSave={finishCalibration}/>}
   {settingsOpen&&<SettingsPanel orientation={orientation} setOrientation={setOrientation} timer={timer} setTimer={setTimer} onClose={()=>setSettingsOpen(false)} setNotice={setNotice}/>}
   {typeof window!=='undefined'&&<CameraProfileSync/>}
   {notice&&<div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-[#24345f] px-5 py-3 text-sm font-bold text-white shadow-soft">{notice}</div>}
 </main>
}

function TopBar({user,onHome,onFullscreen,kiosk,onLogout,onSettings}:{user:string;onHome:()=>void;onFullscreen:()=>void;kiosk:boolean;onLogout:()=>void;onSettings:()=>void}){return <header className="glass mx-auto mb-4 flex max-w-[1500px] items-center justify-between rounded-3xl border border-white px-4 py-3 shadow-soft sm:px-6"><button onClick={onHome} className="flex items-center gap-3 text-left"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#4e8cff] to-[#7b6cff] text-white shadow-lg"><Camera size={23}/></span><span><b className="block text-lg tracking-tight">KAHFI <span className="text-[#ff6fae]">PHOTOBOOTH</span></b><small className="text-[10px] font-bold uppercase tracking-[.25em] text-[#8993b5]">Foto kecil, cerita besar ♡</small></span></button><div className="flex items-center gap-2"><div className="hidden rounded-2xl bg-white px-4 py-2 text-right shadow-sm sm:block"><span className="block text-[10px] font-bold uppercase text-[#a0a8c2]">Operator</span><b className="text-sm">{user}</b></div><button onClick={onFullscreen} className="rounded-2xl border border-[#e6eaf7] bg-white p-3 hover:bg-[#f6f8ff]" title={kiosk?'Fullscreen aktif':'Kiosk fullscreen'}><Maximize size={18}/></button><button type="button" onClick={onSettings} className="rounded-2xl border border-[#e6eaf7] bg-white p-3 hover:bg-[#fff0f7]" title="Pengaturan kamera dan photobooth"><Settings size={18}/></button><button onClick={onLogout} className="rounded-2xl border border-[#e6eaf7] bg-white p-3 text-[#e56b9d] hover:bg-[#fff3f8]" title="Logout"><LogOut size={18}/></button></div></header>}

function SettingsPanel({orientation,setOrientation,timer,setTimer,onClose,setNotice}:{orientation:Orientation;setOrientation:(v:Orientation)=>void;timer:number;setTimer:(v:number)=>void;onClose:()=>void;setNotice:(v:string)=>void}){
 const [devices,setDevices]=useState<MediaDeviceInfo[]>([]); const [selected,setSelected]=useState(''); const [status,setStatus]=useState('Belum memindai kamera.'); const [busy,setBusy]=useState(false);
 const [usbNative,setUsbNative]=useState(false); const [usbStatus,setUsbStatus]=useState('');
 const [cam,setCam]=useState<CameraSettings>({...DEFAULT_CAMERA_SETTINGS});
 // Diagnostik USB: daftar perangkat yang dilihat UsbManager TANPA filter UVC AUSBC.
 // Ini cara memastikan webcam benar-benar terdeteksi OS, terlepas dari filter library.
 const [usbDevices,setUsbDevices]=useState<UsbDeviceInfo[]>([]);
 // Sumber kamera global (dipakai halaman Capture). Dulu tombolnya ada di Capture;
 // sekarang dipindah ke sini sesuai permintaan.
 const [camSource,setCamSource]=useState<'browser'|'usb'>(()=>{if(typeof window==='undefined')return 'browser';try{return (localStorage.getItem('kahfi-camera-source') as 'browser'|'usb')||'browser'}catch{return 'browser'}});
 const hasNative=isNativeShell();
 const chooseSource=(next:'browser'|'usb')=>{
   setCamSource(next);
   try{localStorage.setItem('kahfi-camera-source',next);}catch{}
   window.dispatchEvent(new CustomEvent('kahfi-camera-source-changed',{detail:next}));
   const bridge=getNativeBridge();
   if(next==='usb'){bridge?.startUsbCamera?.();setUsbStatus('Mode: Webcam USB — menyalakan…');}
   else{bridge?.stopUsbCamera?.();setUsbStatus('Mode: Kamera Depan (browser).');}
 };
 const scanUsb=()=>{
   const bridge=getNativeBridge();
   if(!bridge?.scanUsbDevices){setUsbStatus('Jembatan native tidak tersedia.');return;}
   try{const raw=bridge.scanUsbDevices();const list=raw?JSON.parse(raw) as UsbDeviceInfo[]:[];setUsbDevices(list);setUsbNative(list.length>0);setUsbStatus(list.length?`${list.length} perangkat USB terdeteksi.`:'Tidak ada perangkat USB terdeteksi oleh sistem.');}
   catch(e){setUsbStatus('Gagal membaca daftar USB: '+(e instanceof Error?e.message:'unknown'));}
 };
 useEffect(()=>{
   const onStatus=(e:Event)=>{const d=(e as CustomEvent<{kind:string;message:string}>).detail;if(d)setUsbStatus(`${d.kind}: ${d.message}`)};
   window.addEventListener('kahfi-usb-status',onStatus);
   const bridge=getNativeBridge();
   if(bridge?.hasUsbCamera) setUsbNative(Boolean(bridge.hasUsbCamera()));
   if(bridge?.getCameraSettings) setCam(parseCameraSettings(bridge.getCameraSettings()));
   return()=>window.removeEventListener('kahfi-usb-status',onStatus);
 },[]);
 const startNativeUsb=()=>{const bridge=getNativeBridge();if(bridge?.startUsbCamera){bridge.startUsbCamera();setUsbStatus('Memulai kamera USB native…');}else{setUsbStatus('Jembatan native tidak tersedia. Jalankan di aplikasi Android KAHFI.');}};
 const stopNativeUsb=()=>{const bridge=getNativeBridge();if(bridge?.stopUsbCamera){bridge.stopUsbCamera();setUsbStatus('Kamera USB native dihentikan.');}};
 const applyCam=(patch:Partial<CameraSettings>)=>{
   const next={...cam,...patch}; setCam(next);
   try{localStorage.setItem('kahfi-camera-settings',JSON.stringify(next));}catch{}
   const bridge=getNativeBridge();
   if(bridge?.applyCameraSettings) bridge.applyCameraSettings(next.width,next.height,next.rotate,next.mjpeg,next.aspect,next.mirror);
   if(bridge?.setFrontCameraEnabled) bridge.setFrontCameraEnabled(next.front);
   window.dispatchEvent(new CustomEvent('kahfi-camera-settings-changed',{detail:next}));
 };
 const setResolution=(w:number,h:number)=>{applyCam({width:w,height:h});setUsbStatus(`Resolusi kamera USB: ${w} x ${h}`);};
 const scan=useCallback(async()=>{setBusy(true);setStatus('Meminta izin kamera dan memindai perangkat…');let temp:MediaStream|null=null;try{
   if(!navigator.mediaDevices?.getUserMedia||!navigator.mediaDevices?.enumerateDevices)throw new Error('API kamera tidak tersedia. Gunakan HTTPS atau localhost.');
   temp=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
   const list=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
   setDevices(list);const saved=localStorage.getItem('kahfi-camera-device')||'';const preferred=list.find(d=>d.deviceId===saved)||list.find(d=>/usb|external|nemesis|morphe/i.test(d.label))||list[0];
   const chosen=preferred?.deviceId||'';setSelected(chosen);if(chosen)localStorage.setItem('kahfi-camera-device',chosen);
      setStatus(list.length?`${list.length} kamera terdeteksi. ${preferred?.label||'Kamera tersedia'}`:'Tidak ada kamera yang dipublikasikan oleh Android/browser.');
    }catch(e){setStatus(e instanceof Error?e.message:'Gagal memindai kamera. Periksa izin Camera, kabel OTG, dan daya USB.');}finally{temp?.getTracks().forEach(t=>t.stop());setBusy(false)}},[]);
   // Pindai ulang USB native: perangkat USB tidak muncul di enumerateDevices browser, jadi
   // ketersediaan webcam USB harus ditanyakan langsung ke jembatan native.
   const rescanNativeUsb=()=>{const bridge=getNativeBridge();const raw=bridge?.rescanUsb?.();if(raw){const parsed=parseCameraSettings(raw);setCam({...DEFAULT_CAMERA_SETTINGS,...parsed});setUsbNative(Boolean(parsed.usbAvailable));setUsbStatus(parsed.usbAvailable?'Webcam USB terdeteksi oleh mesin native.':'Tidak ada webcam USB di daftar perangkat native.');}else setUsbStatus('Jembatan native tidak tersedia. Jalankan di aplikasi Android KAHFI.');};
 useEffect(()=>{void scan()},[scan]);
 const choose=(id:string)=>{setSelected(id);if(id)localStorage.setItem('kahfi-camera-device',id);else localStorage.removeItem('kahfi-camera-device');setStatus('Pilihan tersimpan. Buka Mulai Foto untuk menerapkan kamera.');};
 return <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#17213b]/70 p-3 backdrop-blur-md sm:p-6"><div className="mx-auto max-w-2xl rounded-[30px] border border-white bg-white p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.22em] text-[#ff6fae]">KAHFI SETTINGS</p><h2 className="mt-1 text-2xl font-black text-[#24345f]">Pengaturan Photobooth ⚙️</h2><p className="mt-1 text-sm text-[#8490ae]">Pilih kamera, timer, dan orientasi cetak.</p></div><button onClick={onClose} className="rounded-xl bg-[#f3f5fb] p-3 text-[#657295]" aria-label="Tutup pengaturan"><X/></button></div>
 <div className="mt-5 rounded-2xl bg-[#f5f8ff] p-4"><div className="flex items-center justify-between gap-3"><b className="text-[#52628a]">📷 Kamera USB / kamera tablet</b><button type="button" disabled={busy} onClick={()=>{void scan();if(hasNative)rescanNativeUsb();}} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-[#526fca] shadow-sm disabled:opacity-50"><RefreshCw size={14}/>{busy?'Memindai…':'Pindai ulang'}</button></div><p className="mt-2 text-sm font-semibold text-[#6d7a9a]">{status}</p><label className="mt-3 block text-xs font-black text-[#7b87a4]">Pilih perangkat kamera</label><select value={selected} onChange={e=>choose(e.target.value)} className="mt-2 w-full rounded-xl border border-[#e2e8f6] bg-white p-3 text-sm font-bold text-[#52628a]"><option value="">Otomatis / kamera default</option>{devices.map((d,i)=><option key={d.deviceId} value={d.deviceId}>{d.label||`Kamera ${i+1}`}</option>)}</select><p className="mt-3 rounded-xl bg-[#fff8e8] p-3 text-xs leading-relaxed text-[#8b7444]">Jika NEMESIS A40 MORPHE tidak muncul di daftar ini, Chrome/WebView Android kemungkinan tidak mengekspos webcam USB sebagai kamera browser. Pengaturan website saja tidak dapat menambahkan dukungan UVC yang tidak tersedia di sistem.</p>{hasNative&&<div className="mt-3 rounded-xl border border-[#dce7ff] bg-[#f2f7ff] p-3"><b className="text-sm text-[#52628a]">🎥 Kamera USB native (UVC)</b><p className="mt-1 text-xs leading-relaxed text-[#7b87a4]">Aktifkan kamera USB langsung lewat mesin native (bukan browser). Pratinjau mengambang di kanan bawah; tekan ✕ Tutup pada pratinjau untuk berhenti.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={startNativeUsb} className="rounded-xl bg-gradient-to-r from-[#4e8cff] to-[#756dff] px-4 py-2 text-xs font-black text-white">Aktifkan kamera USB</button><button type="button" onClick={stopNativeUsb} className="rounded-xl bg-[#eef1f8] px-4 py-2 text-xs font-black text-[#657295]">Matikan</button><span className={`rounded-xl px-3 py-2 text-xs font-black ${usbNative?'bg-[#e6f9f0] text-[#39a77b]':'bg-[#fdeef2] text-[#c76a92]'}`}>{usbNative?'Webcam USB terdeteksi':'Belum ada webcam USB'}</span></div>{usbStatus&&<p className="mt-2 text-xs font-bold text-[#6d7a9a]">{usbStatus}</p>}</div>}</div>
 <div className="mt-4 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-[#edf0f7] p-4"><b className="text-[#52628a]">⏱ Timer foto</b><div className="mt-3 grid grid-cols-3 gap-2">{[1,3,5].map(t=><button key={t} onClick={()=>setTimer(t)} className={`rounded-xl py-3 text-sm font-black ${timer===t?'bg-[#5f8dff] text-white':'bg-[#f3f5fb] text-[#75819e]'}`}>{t}s</button>)}</div></div><div className="rounded-2xl border border-[#edf0f7] p-4"><b className="text-[#52628a]">📐 Orientasi A6</b><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>setOrientation('portrait')} className={`rounded-xl py-3 text-xs font-black ${orientation==='portrait'?'bg-[#ff70ad] text-white':'bg-[#f3f5fb] text-[#75819e]'}`}>Portrait</button><button onClick={()=>setOrientation('landscape')} className={`rounded-xl py-3 text-xs font-black ${orientation==='landscape'?'bg-[#ff70ad] text-white':'bg-[#f3f5fb] text-[#75819e]'}`}>Landscape</button></div></div></div>
 {hasNative&&<div className="mt-4 rounded-2xl border border-[#e7f0e4] bg-[#f4fbf2] p-4"><div className="flex items-center justify-between gap-3"><b className="text-[#3f6b45]">⚙ Pengaturan Kamera (Native)</b><button type="button" onClick={()=>getNativeBridge()?.openCameraSettings?.()} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-[#4d7a52] shadow-sm">Buka dialog native</button></div>
 <p className="mt-2 text-xs font-semibold text-[#6d8a70]">Atur langsung dari web: resolusi, rotasi, format, mirror, dan on/off kamera depan tablet.</p>
 <div className="mt-3"><label className="block text-xs font-black text-[#5d7a60]">Resolusi webcam USB</label><div className="mt-2 flex flex-wrap gap-2">{CAMERA_RESOLUTIONS.map(([w,h])=><button key={`${w}x${h}`} type="button" onClick={()=>setResolution(w,h)} className={`rounded-xl px-3 py-2 text-xs font-black ${cam.width===w&&cam.height===h?'bg-[#4e8cff] text-white':'bg-white text-[#5c6b91] shadow-sm'}`}>{w}×{h}</button>)}</div></div>
 <div className="mt-3 grid gap-3 sm:grid-cols-2"><div><label className="block text-xs font-black text-[#5d7a60]">Rotasi</label><div className="mt-2 grid grid-cols-4 gap-2">{[0,90,180,270].map(r=><button key={r} type="button" onClick={()=>applyCam({rotate:r})} className={`rounded-xl py-2 text-xs font-black ${cam.rotate===r?'bg-[#756dff] text-white':'bg-white text-[#5c6b91] shadow-sm'}`}>{r}°</button>)}</div></div><div><label className="block text-xs font-black text-[#5d7a60]">Format</label><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={()=>applyCam({mjpeg:true})} className={`rounded-xl py-2 text-xs font-black ${cam.mjpeg?'bg-[#756dff] text-white':'bg-white text-[#5c6b91] shadow-sm'}`}>MJPEG</button><button type="button" onClick={()=>applyCam({mjpeg:false})} className={`rounded-xl py-2 text-xs font-black ${!cam.mjpeg?'bg-[#756dff] text-white':'bg-white text-[#5c6b91] shadow-sm'}`}>YUYV</button></div></div></div>
 <div className="mt-3 grid gap-2 sm:grid-cols-3"><button type="button" onClick={()=>applyCam({front:!cam.front})} className={`rounded-xl px-3 py-2 text-xs font-black ${cam.front?'bg-[#e6f9f0] text-[#39a77b]':'bg-[#fdeef2] text-[#c76a92]'}`}>{cam.front?'📷 Kamera depan: ON':'📷 Kamera depan: OFF'}</button><button type="button" onClick={()=>applyCam({aspect:!cam.aspect})} className={`rounded-xl px-3 py-2 text-xs font-black ${cam.aspect?'bg-[#eaf2ff] text-[#4e6fb8]':'bg-[#f3f5fb] text-[#75819e]'}`}>Aspek rasio: {cam.aspect?'ON':'OFF'}</button><button type="button" onClick={()=>applyCam({mirror:!cam.mirror})} className={`rounded-xl px-3 py-2 text-xs font-black ${cam.mirror?'bg-[#eaf2ff] text-[#4e6fb8]':'bg-[#f3f5fb] text-[#75819e]'}`}>Mirror: {cam.mirror?'ON':'OFF'}</button></div>
 <p className="mt-2 rounded-xl bg-white p-2 text-xs font-bold text-[#6d8a70]">Status kamera native: <b>{cam.state}</b>{cam.front?'': ' • kamera depan dimatikan'} • {usbNative?'webcam USB terdeteksi':'belum ada webcam USB'}</p>
 <p className="mt-2 rounded-xl bg-[#eef7ff] p-3 text-xs leading-relaxed text-[#4a6789]">Kamera depan dan webcam USB tidak boleh dibuka bersamaan — pada Xiaomi Pad 6 ini membuat kamera gagal/menghitam. Pilih salah satu: aktifkan kamera depan di sini, atau gunakan webcam USB lewat tombol di atas.</p></div>}
 {hasNative&&<div className="mt-4 rounded-2xl border border-[#e3e6ff] bg-[#f6f4ff] p-4"><b className="text-[#4a4a8a]">🎥 Sumber Kamera</b>
 <p className="mt-1 text-xs font-semibold text-[#7b7aa8]">Pilih kamera yang dipakai di halaman Capture Moments. Kamera depan dan webcam USB tidak boleh aktif bersamaan.</p>
 <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={()=>chooseSource('browser')} className={`rounded-xl py-3 text-xs font-black ${camSource==='browser'?'bg-[#5f8dff] text-white shadow':'bg-white text-[#5c6b91] shadow-sm'}`}>📷 Kamera Depan</button><button type="button" onClick={()=>chooseSource('usb')} className={`rounded-xl py-3 text-xs font-black ${camSource==='usb'?'bg-[#5f8dff] text-white shadow':'bg-white text-[#5c6b91] shadow-sm'}`}>🎥 Webcam USB</button></div>
 <p className="mt-2 rounded-xl bg-white p-3 text-xs font-bold text-[#6d7a9a]">Mode aktif: <b>{camSource==='usb'?'Webcam USB (UVC native)':'Kamera Depan (browser)'}</b> • status UVC: <b>{cam.state}</b></p></div>}

 {hasNative&&<div className="mt-4 rounded-2xl border border-[#ffe6c7] bg-[#fffaf2] p-4"><div className="flex items-center justify-between gap-3"><b className="text-[#8a6a3a]">🔌 Diagnostik USB (tanpa filter)</b><button type="button" onClick={scanUsb} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-[#a07840] shadow-sm"><RefreshCw size={14}/>Pindai USB</button></div>
 <p className="mt-2 text-xs leading-relaxed text-[#8b7444]">Daftar ini dibaca langsung dari UsbManager — <b>tanpa</b> filter kelas UVC bawaan library. Kalau webcam muncul di sini tapi tidak bisa dibuka, berarti descriptor UVC-nya tidak standar. Ketuk perangkat untuk meminta izin USB.</p>
 {usbDevices.length>0?<div className="mt-3 space-y-2">{usbDevices.map((d,i)=><button key={`${d.vid}-${d.pid}-${i}`} type="button" onClick={()=>getNativeBridge()?.requestUsbPermissionAt?.(i)} className="w-full rounded-xl bg-white p-3 text-left shadow-sm"><b className="block text-xs text-[#6d5a3a]">{d.name}</b><span className="text-[11px] font-semibold text-[#9a8a6a]">VID {d.vid} • PID {d.pid} • {d.ifaces} interface • class {d.classes} • {d.permission?'izin ✓':'izin belum'}</span></button>)}</div>:<p className="mt-3 rounded-xl bg-white p-3 text-xs font-bold text-[#a89a80]">Belum dipindai. Colok webcam lewat OTG lalu tekan “Pindai USB”.</p>}</div>}

 <div className="mt-5 flex flex-wrap justify-end gap-2"><button onClick={()=>{setNotice('Pengaturan tersimpan. Jika kamera USB tidak muncul, periksa dukungan UVC Android dan OTG.');onClose()}} className="rounded-xl bg-gradient-to-r from-[#4e8cff] to-[#756dff] px-6 py-3 font-black text-white">Simpan & tutup</button></div></div></div>
}

/**
 * Membuat konten SELALU muat dalam satu layar (tanpa scroll) pada rasio 16:10.
 *
 * Cara kerja: konten diukur pada lebar referensi, lalu diskalakan (transform: scale)
 * agar tinggi & lebarnya pas dengan area yang tersedia. Pendekatan ini dipakai karena
 * halaman sudah dirancang untuk lebar besar; kalau hanya di-crop, tombol bisa terpotong.
 *
 * Pada layar kecil (HP) jatuh ke mode normal agar tetap bisa dibaca.
 */
function Fit16x10({children}:{children:React.ReactNode}){
 const outerRef=useRef<HTMLDivElement>(null);
 const innerRef=useRef<HTMLDivElement>(null);
 const [scale,setScale]=useState(1);
 const [height,setHeight]=useState<number|undefined>(undefined);
 useEffect(()=>{
  const recompute=()=>{
   const outer=outerRef.current, inner=innerRef.current;
   if(!outer||!inner)return;
   const availW=outer.clientWidth, availH=outer.clientHeight;
   if(availW<480||availH<320){setScale(1);setHeight(undefined);return;} // HP: biarkan normal
   // Ukur konten pada lebar aslinya (transform dimatikan dulu agar tidak menular).
   const prev=inner.style.transform;
   inner.style.transform='none';
   const contentW=inner.scrollWidth||availW;
   const contentH=inner.scrollHeight||availH;
   inner.style.transform=prev;
   if(contentW<=0||contentH<=0)return;
   const s=Math.min(1, availW/contentW, availH/contentH);
   setScale(s);
   setHeight(contentH*s);
  };
  recompute();
  const t=setTimeout(recompute,150);
  window.addEventListener('resize',recompute);
  window.addEventListener('orientationchange',recompute);
  const ro=typeof ResizeObserver!=='undefined'?new ResizeObserver(recompute):null;
  if(ro&&outerRef.current)ro.observe(outerRef.current);
  return()=>{clearTimeout(t);window.removeEventListener('resize',recompute);window.removeEventListener('orientationchange',recompute);ro?.disconnect();};
 },[]);
 return <div ref={outerRef} className="min-h-0 w-full flex-1 overflow-hidden" style={height?{height}:undefined}>
  <div ref={innerRef} style={{transform:`scale(${scale})`,transformOrigin:'top left',width:scale<1?`${100/scale}%`:'100%'}}>{children}</div>
 </div>;
}

/** Menyimpan profil pengaturan kamera terakhir yang diterapkan agar Capture bisa memakainya ulang. */
function CameraProfileSync(){
 useEffect(()=>{
  const bridge=getNativeBridge();
  if(bridge?.getCameraSettings){
   const parsed=parseCameraSettings(bridge.getCameraSettings());
   try{localStorage.setItem('kahfi-camera-settings',JSON.stringify(parsed));}catch{}
  }
 },[]);
 return null;
}

function Login({user,setUser,password,setPassword,onLogin,notice}:{user:string;setUser:(v:string)=>void;password:string;setPassword:(v:string)=>void;onLogin:()=>void;notice:string}){return <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#edf7ff] via-white to-[#fff0f7] p-4"><div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#a8dcff]/40 blur-3xl"/><div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-[#ffacd1]/35 blur-3xl"/><div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1180px] items-center justify-center"><div className="grid w-full overflow-hidden rounded-[40px] border border-white bg-white/80 shadow-[0_30px_100px_rgba(73,85,145,.16)] backdrop-blur-xl lg:grid-cols-2"><div className="relative flex min-h-[610px] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#dff5ff] via-[#f7f1ff] to-[#ffe9f3] p-8 sm:p-12"><div><div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-xs font-black text-[#52638e]"><Sparkles size={15}/> CUTE PHOTO EXPERIENCE</div><h1 className="mt-8 max-w-lg text-5xl font-black leading-[.98] tracking-tight text-[#24345f] sm:text-6xl">Capture<br/><span className="text-[#ff6fae]">Sweet</span> Moments 💕</h1><p className="mt-5 max-w-md text-lg font-semibold leading-relaxed text-[#6f7c9f]">Abadikan momen seru bersama orang tersayang dengan KAHFI PHOTOBOOTH.</p></div><div className="relative mx-auto w-full max-w-[480px]"><div className="absolute left-2 top-6 text-4xl sparkle">✨</div><div className="absolute right-3 top-1 text-3xl sparkle">💖</div><div className="mx-auto grid w-[280px] place-items-center rounded-[38px] border-8 border-white/80 bg-gradient-to-br from-[#77bfff] to-[#ff8fbd] p-7 shadow-2xl sm:w-[340px]"><div className="grid h-40 w-40 place-items-center rounded-[35px] bg-white/90 text-[78px] shadow-xl">📸</div><div className="mt-5 rounded-full bg-white/90 px-5 py-2 text-xs font-black text-[#55638b]">SMILE! SAY CHEESE ✨</div></div></div><div className="flex gap-2 text-xs font-bold text-[#7582a5]"><span>📷 USB Camera</span><span>•</span><span>🟦 Bluetooth Trigger</span><span>•</span><span>📱 Xiaomi Pad 6</span></div></div><div className="flex flex-col justify-center p-8 sm:p-12 lg:p-16"><div className="mx-auto w-full max-w-[440px]"><div className="mb-8"><p className="mb-2 text-sm font-black uppercase tracking-[.25em] text-[#ff6fae]">Welcome back ♡</p><h2 className="text-4xl font-black text-[#24345f]">Login Yuk! 👋</h2><p className="mt-2 text-[#8490ae]">Masuk untuk mulai pengalaman photobooth.</p></div><label className="mb-2 block text-sm font-black text-[#53638b]">Username</label><div className="mb-5 flex items-center gap-3 rounded-2xl border-2 border-[#edf0f8] bg-[#fbfcff] px-4 py-4 focus-within:border-[#7ca9ff]"><User size={20} className="text-[#8190b5]"/><input value={user} onChange={e=>setUser(e.target.value)} onKeyDown={e=>e.key==='Enter'&&onLogin()} placeholder="Masukkan username" className="w-full bg-transparent outline-none"/></div><label className="mb-2 block text-sm font-black text-[#53638b]">Password</label><div className="mb-6 flex items-center gap-3 rounded-2xl border-2 border-[#edf0f8] bg-[#fbfcff] px-4 py-4 focus-within:border-[#7ca9ff]"><span className="text-lg">🔐</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&onLogin()} placeholder="Masukkan password" className="w-full bg-transparent outline-none"/></div><button onClick={onLogin} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#4e8cff] to-[#756bff] py-4 font-black text-white shadow-lg shadow-[#678cff]/25 transition hover:-translate-y-0.5"> <LogIn size={20}/> Masuk ke Photobooth</button>{notice&&<p className="mt-4 rounded-xl bg-[#fff0f4] p-3 text-center text-sm font-bold text-[#e45d8c]">{notice}</p>}<div className="mt-7 flex items-center justify-center gap-3 text-xs font-bold text-[#9aa4bd]"><span>🔒 Local session</span><span>•</span><span>⚡ PWA Ready</span></div></div></div></div></div></div>}

function Dashboard({user,onStart,onFrames,onKiosk}:{user:string;onStart:()=>void;onFrames:()=>void;onKiosk:()=>void}){return <section className="overflow-hidden rounded-[38px] border border-white bg-white/75 shadow-soft"><div className="relative overflow-hidden bg-gradient-to-br from-[#eaf8ff] via-[#f8f1ff] to-[#fff0f6] px-6 py-10 sm:px-12 sm:py-12"><div className="absolute -right-10 -top-24 h-72 w-72 rounded-full bg-[#9fd9ff]/30 blur-2xl"/><div className="absolute bottom-[-100px] left-1/3 h-72 w-72 rounded-full bg-[#ffb4d5]/25 blur-2xl"/><div className="relative grid items-center gap-10 lg:grid-cols-[1.15fr_.85fr]"><div><div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-xs font-black text-[#62719a] shadow-sm"><span className="h-2 w-2 rounded-full bg-[#5ee19a]"/> READY TO CREATE MEMORIES</div><h1 className="mt-6 text-5xl font-black leading-tight text-[#24345f] sm:text-6xl">Hi, {user}! <span className="inline-block">👋</span></h1><p className="mt-3 text-xl font-bold text-[#7c88a8]">Selamat datang, selamat berfoto ria <span className="text-[#ff6fae]">♥</span></p><div className="mt-9 flex flex-col gap-4 sm:flex-row"><button onClick={onStart} className="group flex min-h-[78px] items-center justify-between gap-7 rounded-3xl bg-gradient-to-r from-[#4e8cff] to-[#6d75ff] px-6 text-left text-white shadow-xl shadow-[#5f85ff]/25 transition hover:-translate-y-1"><span className="flex items-center gap-4"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20"><Camera/></span><span><b className="block text-lg">Mulai Foto</b><small className="font-semibold text-white/75">Ambil foto sekarang</small></span></span><ChevronRight className="transition group-hover:translate-x-1"/></button><button onClick={onFrames} className="group flex min-h-[78px] items-center justify-between gap-7 rounded-3xl bg-gradient-to-r from-[#ff6fae] to-[#ff82c7] px-6 text-left text-white shadow-xl shadow-[#ff76b6]/20 transition hover:-translate-y-1"><span className="flex items-center gap-4"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20"><Palette/></span><span><b className="block text-lg">Lihat Frame</b><small className="font-semibold text-white/75">Pilih frame favorit</small></span></span><ChevronRight className="transition group-hover:translate-x-1"/></button></div></div><div className="relative mx-auto w-full max-w-[430px]"><div className="absolute -left-2 top-0 rotate-[-12deg] rounded-2xl bg-white p-3 shadow-xl"><div className="h-36 w-28 rounded-xl bg-gradient-to-br from-[#ffd2e5] to-[#bde5ff] p-2"><div className="grid h-full place-items-center rounded-lg border-2 border-dashed border-white text-4xl">📸</div></div></div><div className="absolute -right-2 top-7 rotate-[12deg] rounded-2xl bg-white p-3 shadow-xl"><div className="h-36 w-28 rounded-xl bg-gradient-to-br from-[#d8ffd8] to-[#fff2bd] p-2"><div className="grid h-full place-items-center rounded-lg border-2 border-dashed border-white text-4xl">🧸</div></div></div><div className="mx-auto w-[250px] rotate-[-2deg] rounded-[28px] bg-white p-4 shadow-2xl"><div className="rounded-[20px] bg-gradient-to-br from-[#ffe5f0] via-[#f2e8ff] to-[#dff7ff] p-4"><div className="grid grid-cols-2 gap-2">{['💖','🌸','🧸','✨','🎀','📸'].map((x,i)=><div key={i} className="grid aspect-square place-items-center rounded-xl bg-white/75 text-2xl">{x}</div>)}</div><div className="mt-3 rounded-full bg-white/80 py-2 text-center text-xs font-black text-[#58688f]">SWEET MOMENTS ♡</div></div></div><div className="absolute bottom-[-14px] left-1/2 -translate-x-1/2 rounded-full bg-white px-5 py-2 text-xs font-black text-[#7b88a9] shadow-lg">✨ Make memories forever</div></div></div></div><div className="grid border-t border-white bg-white/65 sm:grid-cols-3"><Info icon="⏱️" title="Timer" value="1s / 3s / 5s"/><Info icon="📷" title="Camera" value="USB External / Fallback"/><Info icon="🟦" title="Trigger" value="Bluetooth Remote"/></div><div className="flex items-center justify-center gap-3 border-t border-[#edf0f8] py-5 text-xs font-bold text-[#8d98b7]"><button onClick={onKiosk} className="rounded-full bg-[#f5f7ff] px-4 py-2 hover:bg-[#edf1ff]">⛶ Aktifkan Kiosk Fullscreen</button><span>•</span><span>Next.js 14 + Tailwind + Canvas</span></div></section>}
function Info({icon,title,value}:{icon:string;title:string;value:string}){return <div className="flex items-center gap-3 border-b border-[#edf0f8] px-6 py-4 last:border-0 sm:border-b-0 sm:border-r sm:last:border-0"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f3f6ff] text-xl">{icon}</span><div><small className="block text-[10px] font-black uppercase tracking-widest text-[#9aa4be]">{title}</small><b className="text-sm text-[#52638b]">{value}</b></div></div>}

function Capture({orientation,setOrientation,timer,setTimer,shots,setShots,onNext,onBack,notice,setNotice}:{orientation:Orientation;setOrientation:(v:Orientation)=>void;timer:number;setTimer:(v:number)=>void;shots:Shot[];setShots:Dispatch<SetStateAction<Shot[]>>;onNext:()=>void;onBack:()=>void;notice:string;setNotice:(v:string)=>void}){
 const videoRef=useRef<HTMLVideoElement>(null); const streamRef=useRef<MediaStream|null>(null); const [devices,setDevices]=useState<MediaDeviceInfo[]>([]); const [deviceId,setDeviceId]=useState(''); const [count,setCount]=useState<number|null>(null); const [busy,setBusy]=useState(false); const [cameraReady,setCameraReady]=useState(false); const [remoteMode,setRemoteMode]=useState<'off'|'volume-up'|'volume-down'|'both'>(()=>{if(typeof window==='undefined')return 'both';try{return (localStorage.getItem('kahfi-remote-mode') as 'off'|'volume-up'|'volume-down'|'both')||'both'}catch{return 'both'}}); const [remoteStatus,setRemoteStatus]=useState('Menunggu remote…');
 // ===== Sumber kamera: 'browser' (kamera depan/tablet) atau 'usb' (webcam USB native UVC) =====
 const [source,setSource]=useState<'browser'|'usb'>(()=>{if(typeof window==='undefined')return 'browser';try{return (localStorage.getItem('kahfi-camera-source') as 'browser'|'usb')||'browser'}catch{return 'browser'}});
 const [usbState,setUsbState]=useState<UsbState>('IDLE'); const [usbNotice,setUsbNotice]=useState('');
 const [cam,setCam]=useState<CameraSettings>(()=>{if(typeof window==='undefined')return {...DEFAULT_CAMERA_SETTINGS};try{return {...DEFAULT_CAMERA_SETTINGS,...JSON.parse(localStorage.getItem('kahfi-camera-settings')||'{}')};}catch{return {...DEFAULT_CAMERA_SETTINGS};}});
 // Elemen area preview 4:3 — posisinya dikirim ke native agar TextureView UVC
 // menempel PERSIS di sini, bukan muncul sebagai kaca melayang/halaman sendiri.
 const previewRef=useRef<HTMLDivElement>(null);
 const nativeShell=isNativeShell();
 const usbActive=source==='usb';
 const canShoot=usbActive?(usbState==='OPENED'):cameraReady;
 const pendingUsb=useRef<Shot[]>([]);
 const usbCapRef=useRef(false);
 useEffect(()=>{try{localStorage.setItem('kahfi-remote-mode',remoteMode)}catch{}},[remoteMode]);
 useEffect(()=>{try{localStorage.setItem('kahfi-camera-source',source)}catch{}},[source]);

 // ---- Sinkron status & pengaturan kamera native ----
 useEffect(()=>{
  if(!nativeShell)return;
  const bridge=getNativeBridge();
  const onStatus=(e:Event)=>{const d=(e as CustomEvent<{kind:string;message:string}>).detail;if(!d)return;setUsbNotice(`${d.kind}: ${d.message}`);
    const k=(d.kind||'').toLowerCase(); if(k==='state'){const s=(d.message||'').toUpperCase(); if(['IDLE','CONNECTED','OPENING','OPENED','CLOSED','ERROR','NO_DEVICE'].includes(s))setUsbState(s as UsbState);} };
  window.addEventListener('kahfi-usb-status',onStatus);
  if(bridge?.getCameraSettings) setCam(parseCameraSettings(bridge.getCameraSettings()));
  const raw=bridge?.getUsbCameraState?.(); if(raw) setUsbState(raw as UsbState);
  const onSettings=(e:Event)=>{const d=(e as CustomEvent<CameraSettings>).detail;if(d)setCam({...DEFAULT_CAMERA_SETTINGS,...d});};
  window.addEventListener('kahfi-camera-settings-changed',onSettings);
  return()=>{window.removeEventListener('kahfi-usb-status',onStatus);window.removeEventListener('kahfi-camera-settings-changed',onSettings);};
 },[nativeShell]);

 // ---- Kirim posisi area preview 4:3 ke native (setPreviewBounds) ----
 // Preview UVC native digambar sebagai TextureView DI ATAS WebView, jadi posisinya
 // harus mengikuti elemen preview 4:3 di halaman ini. Diukur ulang setiap kali layout
 // berubah (resize, orientasi, scroll) supaya tidak meleset.
 useEffect(()=>{
  if(!nativeShell)return;
  const bridge=getNativeBridge();
  if(!bridge?.setPreviewBounds)return;
  let raf=0;
  const send=()=>{
   const el=previewRef.current; if(!el)return;
   const r=el.getBoundingClientRect();
   if(r.width<8||r.height<8)return;
   // PENTING: posisi area preview HARUS diukur saat elemen benar-benar terlihat.
   // getBoundingClientRect() relatif terhadap viewport, jadi bila elemen masih di bawah
   // lipatan hasilnya tidak masuk akal (mis. top = -431) dan panel native akan meleset.
   // Karena itu kita scroll elemen ke tampilan lebih dulu (lihat pengukuran di bawah),
   // lalu hanya kirim koordinat yang memang valid di dalam viewport.
   const x = Math.round(r.left);
   const y = Math.round(r.top);
   if(x<0||y<0)return; // belum terlihat penuh; tunggu layout/skroll stabil
   bridge.setPreviewBounds?.(x, y, Math.round(r.width), Math.round(r.height));
  };
  const measure=()=>{
   const el=previewRef.current; if(!el)return;
   // Pastikan area preview benar-benar terlihat sebelum diukur — kalau elemen masih di
   // bawah lipatan, getBoundingClientRect() memberi nilai negatif dan panel native
   // akan muncul di posisi salah (ini penyebab "malah buka halaman sendiri").
   const r=el.getBoundingClientRect();
   if(r.top<0||r.bottom>window.innerHeight){ el.scrollIntoView({block:'center',inline:'center'}); }
   requestAnimationFrame(send);
  };
  const schedule=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(measure);};
  schedule();
  // Beberapa pass: layout sering belum final saat screen baru dipasang.
  const t1=setTimeout(measure,150); const t2=setTimeout(measure,500); const t3=setTimeout(send,900);
  window.addEventListener('resize',schedule);
  window.addEventListener('orientationchange',schedule);
  window.addEventListener('scroll',schedule,true);
  const ro=typeof ResizeObserver!=='undefined'?new ResizeObserver(schedule):null;
  if(ro&&previewRef.current)ro.observe(previewRef.current);
  return()=>{
   cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
   window.removeEventListener('resize',schedule);
   window.removeEventListener('orientationchange',schedule);
   window.removeEventListener('scroll',schedule,true);
   ro?.disconnect();
  };
 },[nativeShell]);

 // Sembunyikan panel preview saat meninggalkan Capture (dan matikan kamera USB).
 useEffect(()=>{
  if(!nativeShell)return;
  return () => { getNativeBridge()?.hidePreview?.(); };
 },[nativeShell]);

 // ---- Terima foto dari webcam USB native ----
 useEffect(()=>{const onPhoto=(e:Event)=>{const url=(e as CustomEvent<{dataUrl?:string}>).detail?.dataUrl;if(!url||!usbCapRef.current)return;usbCapRef.current=false;const shot={src:url,dataUrl:url};pendingUsb.current=[];setShots(prev=>[...prev,shot]);setCount(null);setBusy(false);setUsbNotice('Foto USB masuk ke slot.');};window.addEventListener('kahfi-usb-photo',onPhoto);return()=>window.removeEventListener('kahfi-usb-photo',onPhoto);},[setShots]);

 const startUsbNative=useCallback(()=>{const bridge=getNativeBridge();if(!bridge?.startUsbCamera){setUsbNotice('Jembatan native tidak tersedia. Jalankan di aplikasi Android KAHFI.');return;}streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;setCameraReady(false);if(videoRef.current)videoRef.current.srcObject=null;
  // Kirim posisi area preview 4:3 SEBELUM menyalakan kamera, supaya TextureView
  // native langsung menempel di area ini (bukan muncul sebagai halaman sendiri).
  const el=previewRef.current;
  if(el&&bridge.setPreviewBounds){
   const r=el.getBoundingClientRect();
   if(r.top<0||r.bottom>window.innerHeight)el.scrollIntoView({block:'center',inline:'center'});
   requestAnimationFrame(()=>{
    const rr=el.getBoundingClientRect();
    if(rr.width>8&&rr.height>8&&rr.top>=0)bridge.setPreviewBounds?.(Math.round(rr.left),Math.round(rr.top),Math.round(rr.width),Math.round(rr.height));
   });
  }
  setUsbState('OPENING');setUsbNotice('Menyalakan kamera USB native…');bridge.startUsbCamera();},[]);

 /** Pindai ulang perangkat USB lewat jembatan native (tanpa cabut-colok). */
 const rescanUsb=useCallback(()=>{const bridge=getNativeBridge();const raw=bridge?.rescanUsb?.();if(raw){const parsed=parseCameraSettings(raw);setCam({...DEFAULT_CAMERA_SETTINGS,...parsed});}setUsbNotice('Memindai ulang perangkat USB…');},[]);
 const startCamera=useCallback(async(id?:string)=>{try{setCameraReady(false);streamRef.current?.getTracks().forEach(t=>t.stop());if(!navigator.mediaDevices?.getUserMedia)throw new Error('Browser tidak menyediakan akses kamera.');let chosen=id||localStorage.getItem('kahfi-camera-device')||'';let stream:MediaStream;try{stream=await navigator.mediaDevices.getUserMedia({video:chosen?{deviceId:{exact:chosen},width:{ideal:1920},height:{ideal:1080}}:{facingMode:'user',width:{ideal:1920},height:{ideal:1080}},audio:false});}catch(firstError){if(chosen){localStorage.removeItem('kahfi-camera-device');chosen='';stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:720}},audio:false});}else throw firstError;}streamRef.current=stream;if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play();}setCameraReady(true);setNotice('');const list=await navigator.mediaDevices.enumerateDevices();const cameras=list.filter(d=>d.kind==='videoinput');setDevices(cameras);const activeTrack=stream.getVideoTracks()[0];const actualId=activeTrack?.getSettings().deviceId||chosen;const active=cameras.find(d=>d.deviceId===actualId);if(active){setDeviceId(active.deviceId);localStorage.setItem('kahfi-camera-device',active.deviceId);}else setDeviceId('');}catch(e){setCameraReady(false);const msg=e instanceof Error?e.message:'';setNotice(msg.includes('NotAllowed')?'Izin kamera ditolak. Izinkan Camera di pengaturan browser/aplikasi.':msg.includes('NotFound')?'Kamera tidak ditemukan oleh Android/browser. Coba OTG aktif dan aplikasi kamera USB.':'Kamera belum bisa diakses. Pastikan HTTPS, izin Camera, kabel OTG, dan daya USB memadai.');}},[setNotice]);
 useEffect(()=>{const refresh=()=>{navigator.mediaDevices?.enumerateDevices().then(list=>setDevices(list.filter(d=>d.kind==='videoinput'))).catch(()=>{});};navigator.mediaDevices?.addEventListener?.('devicechange',refresh);return()=>{navigator.mediaDevices?.removeEventListener?.('devicechange',refresh);}},[]);
 useEffect(()=>()=>{streamRef.current?.getTracks().forEach(t=>t.stop())},[]);
 // Muat kamera depan saat web sudah punya izin (setelah pengguna tak lagi memblokirnya).
 useEffect(()=>{const onPerm=()=>{if(source==='browser'){void startCamera();}};navigator.mediaDevices?.addEventListener?.('devicechange',onPerm);return()=>navigator.mediaDevices?.removeEventListener?.('devicechange',onPerm);},[startCamera,source]);
 const capture=useCallback(async()=>{if(busy||shots.length>=6)return;if(usbActive){if(usbState!=='OPENED'){setNotice('webcam USB belum siap (status '+usbState+'). Tunggu sampai OPENED atau tekan “Sambungkan ulang”.');return;}setBusy(true);for(let n=timer;n>0;n--){setCount(n);await new Promise(r=>setTimeout(r,1000));}setCount(0);await new Promise(r=>setTimeout(r,250));usbCapRef.current=true;setUsbNotice('Mengambil foto dari webcam USB…');getNativeBridge()?.captureUsbPhoto?.();return;}if(!videoRef.current)return;setBusy(true);for(let n=timer;n>0;n--){setCount(n);await new Promise(r=>setTimeout(r,1000));}setCount(0);await new Promise(r=>setTimeout(r,250));const v=videoRef.current;const canvas=document.createElement('canvas');canvas.width=1240;canvas.height=930;const ctx=canvas.getContext('2d');if(!ctx){setBusy(false);return;}const vw=v.videoWidth||1280,vh=v.videoHeight||720,srcRatio=vw/vh,dstRatio=canvas.width/canvas.height;let sx=0,sy=0,sw=vw,sh=vh;if(srcRatio>dstRatio){sw=Math.round(vh*dstRatio);sx=Math.round((vw-sw)/2)}else if(srcRatio<dstRatio){sh=Math.round(vw/dstRatio);sy=Math.round((vh-sh)/2)}ctx.save();ctx.translate(canvas.width,0);ctx.scale(-1,1);ctx.drawImage(v,sx,sy,sw,sh,0,0,canvas.width,canvas.height);ctx.restore();const data=canvas.toDataURL('image/jpeg',.92);setShots(prev=>[...prev,{src:data,dataUrl:data}]);setCount(null);setBusy(false);},[busy,shots.length,timer,setShots,usbActive,usbState,setNotice]);

 // Sumber kamera diubah dari halaman Pengaturan (bukan lagi dari sini).
 // Reaksi: nyalakan UVC + preview, atau tutup UVC dan pakai kamera depan.
 useEffect(()=>{
  const onSource=(e:Event)=>{const next=(e as CustomEvent<'browser'|'usb'>).detail;if(next!=='usb'&&next!=='browser')return;setSource(next);if(next==='usb'){startUsbNative();}else{getNativeBridge()?.stopUsbCamera?.();setUsbState('CLOSED');}};
  window.addEventListener('kahfi-camera-source-changed',onSource);
  return()=>window.removeEventListener('kahfi-camera-source-changed',onSource);
 },[startUsbNative]);

 // Nyalakan kamera depan hanya saat mode browser dipilih.
 useEffect(()=>{if(source==='browser')void startCamera();},[source,startCamera]);
 useEffect(()=>{const handler=(e:KeyboardEvent)=>{if(e.repeat)return;const key=(e.key||'').toLowerCase();const code=(e.code||'').toLowerCase();const isUp=['volumeup','audiovolumeup','audio volume up'].includes(key)||['volumeup','audiovolumeup'].includes(code)||e.keyCode===24||e.keyCode===175;const isDown=['volumedown','audiovolumedown','audio volume down'].includes(key)||['volumedown','audiovolumedown'].includes(code)||e.keyCode===25||e.keyCode===174;const volumeAllowed=(isUp&&['volume-up','both'].includes(remoteMode))||(isDown&&['volume-down','both'].includes(remoteMode));if(volumeAllowed){e.preventDefault();e.stopPropagation();setRemoteStatus(isUp?'Remote Volume UP terdeteksi ✓':'Remote Volume DOWN terdeteksi ✓');void capture();return;}if((e.code==='Space'||e.code==='Enter')&&!e.repeat){e.preventDefault();setRemoteStatus('Keyboard trigger terdeteksi ✓');void capture();}};const nativeHandler=(event:Event)=>{const key=((event as CustomEvent<{key?:string}>).detail?.key||'').toUpperCase();const isUp=key==='VOLUME_UP';const isDown=key==='VOLUME_DOWN';const allowed=(isUp&&['volume-up','both'].includes(remoteMode))||(isDown&&['volume-down','both'].includes(remoteMode));if(allowed){setRemoteStatus(isUp?'Native Remote Volume UP terdeteksi ✓':'Native Remote Volume DOWN terdeteksi ✓');void capture();}};window.addEventListener('kahfi-native-shutter',nativeHandler as EventListener);window.addEventListener('keydown',handler,true);return()=>{window.removeEventListener('kahfi-native-shutter',nativeHandler as EventListener);window.removeEventListener('keydown',handler,true)}},[capture,remoteMode]);
 return <section className="rounded-[34px] border border-white bg-[#182038] p-3 shadow-2xl sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-4 text-white"><button onClick={onBack} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold"><ChevronLeft size={17}/> Kembali</button><div className="text-center"><b className="block tracking-wide">📸 CAPTURE MOMENTS</b><small className="text-xs font-bold text-white/50">{shots.length}/6 foto tersimpan</small></div><div className="flex gap-2"><span className={`rounded-xl px-3 py-2 text-xs font-bold ${canShoot?'bg-[#5fe49a]/15 text-[#7ff0b0]':'bg-[#ff70ad]/15 text-[#ffa6cc]'}`}>{usbActive?(canShoot?'🟢 USB Camera Ready':`🔴 USB ${usbState}`):(cameraReady?'🟢 Kamera Depan Ready':'🔴 Camera Off')}</span></div></div><div className="grid gap-4 lg:grid-cols-[1fr_300px]"><div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black"><div className="absolute left-4 top-4 z-10 flex gap-2"><span className="rounded-full bg-black/45 px-3 py-2 text-xs font-black text-white backdrop-blur">{orientation==='portrait'?'PORTRAIT':'LANDSCAPE'} • 4:3 PREVIEW</span><span className="rounded-full bg-black/45 px-3 py-2 text-xs font-black text-white backdrop-blur">{usbActive?'USB Native (UVC)':(deviceId?'USB / External':'Kamera Depan')}</span></div><div ref={previewRef} className="relative mx-auto aspect-[4/3] max-h-[70vh] w-full max-w-[1000px] overflow-hidden"><video ref={videoRef} className={`capture-video h-full w-full bg-[#080b14] ${usbActive?'invisible':''}`} playsInline muted/>{usbActive&&usbState!=='OPENED'&&<div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><span className="mx-auto block max-w-[300px] rounded-2xl bg-black/80 px-4 py-3 text-xs font-black text-white">{usbState==='OPENING'?'⏳ Menyalakan webcam USB…':usbState==='CONNECTED'?'✅ Webcam USB siap. Tekan “Sambungkan” untuk menampilkan.':`⚠️ Webcam USB: ${usbState}`}</span></div>}<div className="pointer-events-none absolute inset-7 rounded-3xl border-2 border-white/55"/><div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center"><button onClick={capture} disabled={busy||shots.length>=6||!canShoot} className="grid h-24 w-24 place-items-center rounded-full border-[7px] border-white/90 bg-gradient-to-br from-[#ff70ad] to-[#7a6cff] text-white shadow-2xl transition active:scale-95 disabled:opacity-50"><Camera size={34}/></button><p className="mt-2 rounded-full bg-black/40 px-3 py-1 text-[11px] font-bold text-white">{usbActive?'Sumber: Webcam USB':'Sumber: Kamera Depan'} • Bluetooth / SPACE / TAP</p></div>{count!==null&&<div className="absolute inset-0 grid place-items-center bg-black/15"><div className="grid h-36 w-36 place-items-center rounded-full border-8 border-white/70 bg-[#25335b]/75 text-7xl font-black text-white shadow-2xl">{count===0?'📸':count}</div></div>}</div></div><aside className="flex flex-col rounded-[28px] bg-[#202a48] p-4 text-white"><div className="mb-3 flex items-center justify-between"><b>Hasil Jepretan</b><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black">{shots.length}/6</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">{Array.from({length:6}).map((_,i)=><div key={i} className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-[#11172a]">{shots[i]?<img src={shots[i].src} className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center text-center"><span><span className="block text-2xl opacity-30">📷</span><small className="text-[10px] font-black text-white/35">FOTO {i+1}</small></span></div>}{shots[i]&&<span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-[#5fe49a] text-[#153c2b]"><Check size={14}/></span>}</div>)}</div><div className="mt-4 space-y-3"><div><label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-white/45">Timer</label><div className="grid grid-cols-3 gap-2">{[1,3,5].map(t=><button key={t} onClick={()=>setTimer(t)} className={`rounded-xl py-2 text-sm font-black ${timer===t?'bg-[#5f8dff]':'bg-white/10 hover:bg-white/15'}`}>{t}s</button>)}</div></div><div className="rounded-2xl border border-white/10 bg-white/5 p-3"><div className="mb-2 flex items-center justify-between"><label className="text-[10px] font-black uppercase tracking-widest text-white/60">Remote Shutter</label><span className="rounded-full bg-[#5fe49a]/15 px-2 py-1 text-[9px] font-black text-[#7ff0b0]">{remoteMode==='off'?'NONAKTIF':'AKTIF'}</span></div><p className="mb-2 text-xs font-bold text-white/75">Pilih tombol remote Bluetooth</p><div className="grid grid-cols-2 gap-2"><button type="button" onClick={()=>{setRemoteMode(remoteMode==='volume-up'?'off':'volume-up');setRemoteStatus('Mode Volume UP dipilih — tekan tombol remote untuk tes.')}} className={`rounded-xl px-2 py-2 text-xs font-black ${remoteMode==='volume-up'?'bg-[#5f8dff]':'bg-white/10'}`}>🔊 Volume UP</button><button type="button" onClick={()=>{setRemoteMode(remoteMode==='volume-down'?'off':'volume-down');setRemoteStatus('Mode Volume DOWN dipilih — tekan tombol remote untuk tes.')}} className={`rounded-xl px-2 py-2 text-xs font-black ${remoteMode==='volume-down'?'bg-[#5f8dff]':'bg-white/10'}`}>🔉 Volume DOWN</button></div><button type="button" onClick={()=>{setRemoteMode(remoteMode==='both'?'off':'both');setRemoteStatus(remoteMode==='both'?'Remote dinonaktifkan.':'Mode kedua tombol dipilih — tekan remote untuk tes.')}} className={`mt-2 w-full rounded-xl px-2 py-2 text-xs font-black ${remoteMode==='both'?'bg-[#ff70ad]':'bg-white/10'}`}>{remoteMode==='both'?'✓ UP + DOWN aktif':'Aktifkan UP + DOWN'}</button><p aria-live="polite" className="mt-2 rounded-lg bg-black/15 p-2 text-[10px] font-bold text-white/65">{remoteStatus}</p><p className="mt-2 text-[10px] leading-relaxed text-white/45">Jika tombol volume hanya mengubah suara dan status tidak berubah, Android/Chrome menahan tombol tersebut. Lihat petunjuk di README.</p></div><div><label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-white/45">Layout</label><div className="grid grid-cols-2 gap-2"><button onClick={()=>setOrientation('portrait')} className={`rounded-xl py-2 text-xs font-black ${orientation==='portrait'?'bg-[#ff70ad]':'bg-white/10'}`}>Portrait</button><button onClick={()=>setOrientation('landscape')} className={`rounded-xl py-2 text-xs font-black ${orientation==='landscape'?'bg-[#ff70ad]':'bg-white/10'}`}>Landscape</button></div></div><div className="space-y-2"><select value={deviceId} onChange={e=>{const id=e.target.value;if(id)localStorage.setItem('kahfi-camera-device',id);else localStorage.removeItem('kahfi-camera-device');setDeviceId(id);void startCamera(id)}} className="w-full rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white outline-none"><option value="">Otomatis / kamera default</option>{devices.map((d,i)=><option key={d.deviceId} value={d.deviceId}>{d.label||`Kamera ${i+1}`}</option>)}</select><button type="button" onClick={()=>void startCamera()} className="w-full rounded-xl bg-white/10 px-3 py-2 text-xs font-black hover:bg-white/15"><RefreshCw size={13} className="mr-1 inline"/> Pindai / sambungkan ulang kamera</button>{!devices.some(d=>/usb|external|nemesis|morphe/i.test(d.label))&&<p className="text-[10px] leading-relaxed text-white/50">Kamera USB belum terdaftar sebagai perangkat browser. Jika dipakai di Android, cek dukungan UVC sistem dan OTG.</p>}</div>
{usbActive&&<p className="rounded-2xl border border-[#4e8cff]/40 bg-[#4e8cff]/10 p-3 text-[10px] font-bold text-white/70">🎥 Mode Webcam USB aktif • ubah di ⚙ Pengaturan</p>}</div><button onClick={onNext} disabled={shots.length<6} className="mt-auto flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#5f8dff] to-[#7770ff] py-4 font-black disabled:cursor-not-allowed disabled:opacity-35">NEXT KE EDIT <ChevronRight size={18}/></button></aside></div></section>}

function Editor({shots,orientation,frame,setFrame,frames,sticker,setSticker,selectedShot,setSelectedShot,onBack,onNext,addCustomFrame}:{shots:Shot[];orientation:Orientation;frame:Frame;setFrame:(f:Frame)=>void;frames:Frame[];sticker:string;setSticker:(s:string)=>void;selectedShot:number;setSelectedShot:(n:number)=>void;onBack:()=>void;onNext:()=>void;addCustomFrame:(n:string)=>void}){const [tab,setTab]=useState<'frame'|'sticker'>('frame');return <section className="rounded-[34px] border border-white bg-white/85 p-4 shadow-soft sm:p-6"><div className="mb-5 flex items-center justify-between"><button onClick={onBack} className="flex items-center gap-2 rounded-2xl bg-[#f4f6ff] px-4 py-3 text-sm font-black text-[#5c6b91]"><ChevronLeft size={18}/> Kembali</button><div className="text-center"><h2 className="font-black text-[#24345f]">✨ Edit & Pilih Frame</h2><p className="text-xs font-bold text-[#9aa4bb]">6 foto • A6 {orientation}</p></div><span className="w-20"/></div><div className="grid gap-6 xl:grid-cols-[minmax(420px,1fr)_500px]"><PreviewFrame shots={shots} orientation={orientation} frame={frame} sticker={sticker}/><div><div className="mb-4 grid grid-cols-2 rounded-2xl bg-[#f3f5fb] p-1"><button onClick={()=>setTab('frame')} className={`rounded-xl py-3 text-sm font-black ${tab==='frame'?'bg-white text-[#4e8cff] shadow-sm':'text-[#8490ad]'}`}>🎀 Pilih Frame</button><button onClick={()=>setTab('sticker')} className={`rounded-xl py-3 text-sm font-black ${tab==='sticker'?'bg-white text-[#ff6fae] shadow-sm':'text-[#8490ad]'}`}>✨ Sticker</button></div>{tab==='frame'?<><div className="mb-4 flex gap-2"><span className="rounded-full bg-[#eef4ff] px-3 py-1.5 text-xs font-black text-[#5c80d7]">{orientation==='portrait'?'Portrait A6':'Landscape A6'}</span><span className="rounded-full bg-[#fff0f7] px-3 py-1.5 text-xs font-black text-[#d75e91]">Cute Collection</span></div><div className="grid max-h-[460px] grid-cols-3 gap-3 overflow-y-auto pr-1 sm:grid-cols-4">{frames.filter(f=>f.orientation==='both'||f.orientation===orientation).map(f=><button key={f.id} onClick={()=>setFrame(f)} className={`group rounded-2xl border-2 bg-white p-2 text-left transition hover:-translate-y-1 ${frame.id===f.id?'border-[#6c82ff] shadow-lg':'border-[#edf0f7]'}`}><div className="relative aspect-[4/5] overflow-hidden rounded-xl" style={{background:`linear-gradient(135deg,${f.accent}25,#fff)`}}><div className="absolute inset-1 rounded-lg border-2" style={{borderColor:f.accent}}/><span className="absolute left-2 top-2 text-xl">{f.emoji}</span><div className="grid h-full grid-cols-2 gap-1 p-4 pt-8">{[1,2,3,4,5,6].map(n=><div key={n} className="rounded-md bg-white/80"/>)}</div><span className="absolute bottom-1 right-1 text-xs">{f.type==='love'?'💗':f.type==='party'?'🎉':'✨'}</span></div><span className="mt-1 block truncate text-[10px] font-black text-[#637096]">{f.name}</span></button>)}</div><button onClick={()=>{const n=prompt('Nama frame baru?');if(n)addCustomFrame(n)}} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#cfd7ee] py-3 text-sm font-black text-[#7180a4] hover:bg-[#f8f9ff]"><Upload size={17}/> Tambah Frame</button></>:<div><div className="grid grid-cols-4 gap-3">{stickers.map(s=><button key={s} onClick={()=>setSticker(s)} className={`grid aspect-square place-items-center rounded-2xl border-2 bg-white text-3xl ${sticker===s?'border-[#ff78b5] shadow-md':'border-[#edf0f7]'}`}>{s}</button>)}</div><p className="mt-4 rounded-2xl bg-[#fff6fa] p-4 text-xs font-bold text-[#9a7890]">Pilih sticker untuk menghias hasil akhir. Sticker akan ikut tersimpan saat gambar diekspor.</p></div>}<div className="mt-5 border-t border-[#edf0f7] pt-4"><p className="mb-2 text-xs font-black text-[#8b96b3]">Pilih foto untuk preview</p><div className="flex gap-2 overflow-x-auto no-scrollbar">{shots.map((s,i)=><button key={i} onClick={()=>setSelectedShot(i)} className={`relative h-16 w-20 shrink-0 overflow-hidden rounded-xl border-2 ${selectedShot===i?'border-[#6d7fff]':'border-transparent'}`}><img src={s.src} className="h-full w-full object-cover"/><span className="absolute bottom-0 left-0 rounded-tr bg-black/50 px-1.5 text-[9px] font-black text-white">{i+1}</span></button>)}</div></div><button onClick={onNext} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#4e8cff] to-[#776eff] py-4 font-black text-white shadow-lg">NEXT → CETAK / SIMPAN <ChevronRight size={18}/></button></div></div></section>}

function FramePhotoLayers({shots,frame,orientation}:{shots:Shot[];frame:Frame;orientation:Orientation}){
 const W=orientation==='portrait'?1240:1748,H=orientation==='portrait'?1748:1240;
 const slots=frame.slots&&frame.slots.length===6?frame.slots:DEFAULT_SLOTS(W,H).map(s=>({x:s.x/W,y:s.y/H,width:s.width/W,height:s.height/H}));
 return <>{slots.slice(0,6).map((slot,i)=><div key={i} className="absolute overflow-hidden bg-[#e9edf7]" style={{left:`${slot.x*100}%`,top:`${slot.y*100}%`,width:`${slot.width*100}%`,height:`${slot.height*100}%`}}>{shots[i]?<img src={shots[i].src} className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center text-[10px] font-black text-[#9aa5bd]">PHOTO {i+1}</div>}</div>)}</>
}
function PreviewFrame({shots,orientation,frame,sticker}:{shots:Shot[];orientation:Orientation;frame:Frame;sticker:string}){return <div className="flex items-center justify-center rounded-[30px] bg-gradient-to-br from-[#edf5ff] to-[#fff1f7] p-5 sm:p-8"><div className={`relative w-full max-w-[680px] overflow-hidden rounded-[26px] bg-white shadow-2xl ${orientation==='portrait'?'aspect-[1240/1748]':'aspect-[1748/1240]'}`}><FramePhotoLayers shots={shots} frame={frame} orientation={orientation}/>{frame.image?<img src={frame.image} alt="Frame" className="pointer-events-none absolute inset-0 h-full w-full object-fill"/>:<><div className="pointer-events-none absolute inset-2 rounded-[22px] border-[5px]" style={{borderColor:frame.accent}}/><div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm font-black" style={{color:frame.accent}}>♡ {frame.name.toUpperCase()} ♡</div></>}<span className="pointer-events-none absolute left-4 top-3 text-2xl">{sticker}</span><span className="pointer-events-none absolute bottom-3 right-4 text-2xl">{sticker}</span></div></div>}

function Output({shots,orientation,frame,sticker,onBack,onHome}:{shots:Shot[];orientation:Orientation;frame:Frame;sticker:string;onBack:()=>void;onHome:()=>void}){const canvasRef=useRef<HTMLCanvasElement>(null);const [done,setDone]=useState(false);const [ready,setReady]=useState(false);const W=orientation==='portrait'?1240:1748;const H=orientation==='portrait'?1748:1240;
 const render=useCallback(async()=>{setReady(false);const c=canvasRef.current;if(!c)return;c.width=W;c.height=H;const ctx=c.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,W,H);ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);const slots=frame.slots&&frame.slots.length===6?frame.slots:DEFAULT_SLOTS(W,H).map(s=>({x:s.x/W,y:s.y/H,width:s.width/W,height:s.height/H}));
 const images=await Promise.all(shots.slice(0,6).map(s=>new Promise<HTMLImageElement>((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=s.src})));
 images.forEach((img,i)=>{const slot=slots[i];const x=slot.x*W,y=slot.y*H,cw=slot.width*W,ch=slot.height*H;const scale=Math.max(cw/img.width,ch/img.height),sw=img.width*scale,sh=img.height*scale;ctx.save();ctx.beginPath();ctx.roundRect(x,y,cw,ch,Math.min(28,Math.min(cw,ch)*.08));ctx.clip();ctx.drawImage(img,x+(cw-sw)/2,y+(ch-sh)/2,sw,sh);ctx.restore();});
 if(frame.image){const overlay=await loadImage(frame.image);ctx.drawImage(overlay,0,0,W,H);} else {ctx.strokeStyle=frame.accent;ctx.lineWidth=18;ctx.strokeRect(40,40,W-80,H-80);ctx.font='bold 38px Arial';ctx.fillStyle=frame.accent;ctx.textAlign='center';ctx.fillText(`${sticker}  ${frame.name.toUpperCase()}  ${sticker}`,W/2,H-72);ctx.textAlign='start';}setReady(true);},[H,W,frame,shots,sticker]);useEffect(()=>{render().catch(()=>setReady(false))},[render]);
 const save=()=>{if(!ready)return;const a=document.createElement('a');a.href=canvasRef.current?.toDataURL('image/jpeg',.95)||'';a.download=`KAHFI-PHOTOBOOTH-A6-${Date.now()}.jpg`;a.click();setDone(true)};const print=()=>{if(!ready)return;const data=canvasRef.current?.toDataURL('image/png');if(!data)return;const w=window.open('','_blank','width=900,height=900');if(w){w.document.write(`<html><head><title>KAHFI PHOTOBOOTH A6</title><style>@page{size:A6 ${orientation==='portrait'?'portrait':'landscape'};margin:0}html,body{margin:0;padding:0}img{width:100%;height:100%;object-fit:contain}</style></head><body><img src="${data}" onload="window.print();window.close()"></body></html>`);w.document.close()}};
 return <section className="rounded-[34px] border border-white bg-white/85 p-4 shadow-soft sm:p-6"><div className="mb-5 flex items-center justify-between"><button onClick={onBack} className="flex items-center gap-2 rounded-2xl bg-[#f4f6ff] px-4 py-3 text-sm font-black text-[#5c6b91]"><ChevronLeft size={18}/> Edit Lagi</button><div className="text-center"><h2 className="font-black text-[#24345f]">🎉 Siap Cetak!</h2><p className="text-xs font-bold text-[#9aa4bb]">A6 • 300 DPI • {orientation}</p></div><span className="w-20"/></div><div className="grid items-center gap-8 lg:grid-cols-[1fr_420px]"><div className="mx-auto w-full max-w-[620px] rounded-[30px] bg-[#f5f7ff] p-5"><canvas ref={canvasRef} className="w-full rounded-2xl bg-white shadow-xl"/></div><div><div className="rounded-3xl bg-gradient-to-br from-[#eff7ff] to-[#fff0f7] p-6"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-sm">💖</span><div><b className="block text-lg text-[#52628a]">{ready?'Hasil sudah siap':'Menyiapkan hasil...'}</b><span className="text-xs font-bold text-[#919cb7]">6 foto → 6 lubang frame tetap</span></div></div><div className="mt-5 space-y-3"><button onClick={print} disabled={!ready} className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#4e8cff] to-[#746dff] py-4 font-black text-white shadow-lg disabled:opacity-40"><Printer size={20}/> CETAK A6</button><button onClick={save} disabled={!ready} className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#42cf96] to-[#4bb8e9] py-4 font-black text-white shadow-lg disabled:opacity-40"><Download size={20}/> SIMPAN JPG</button></div>{done&&<p className="mt-4 rounded-xl bg-white p-3 text-center text-xs font-black text-[#39a77b]">✓ Gambar berhasil disiapkan untuk disimpan.</p>}</div><button onClick={onHome} className="mt-4 w-full rounded-2xl border-2 border-[#e8ebf5] py-4 font-black text-[#657295]">Selesai • Kembali Dashboard</button><p className="mt-4 text-center text-xs font-bold leading-relaxed text-[#9ba5be]">Ukuran output: {W} × {H}px<br/>Foto selalu masuk ke slot 1–6 sesuai urutan jepretan.</p></div></div></section>}

function FrameCalibration({frame,onCancel,onSave}:{frame:Frame;onCancel:()=>void;onSave:(f:Frame)=>void}){
 const [slots,setSlots]=useState<Slot[]>(frame.slots&&frame.slots.length===6?frame.slots:DEFAULT_SLOTS(frame.orientation==='portrait'?1240:1748,frame.orientation==='portrait'?1748:1240).map(s=>({x:s.x/(frame.orientation==='portrait'?1240:1748),y:s.y/(frame.orientation==='portrait'?1748:1240),width:s.width/(frame.orientation==='portrait'?1240:1748),height:s.height/(frame.orientation==='portrait'?1748:1240)})));
 const [selected,setSelected]=useState(0);
 const W=frame.orientation==='portrait'?1240:1748,H=frame.orientation==='portrait'?1748:1240;
 const setSlot=(index:number,key:keyof Slot,value:number)=>setSlots(v=>v.map((s,i)=>i===index?{...s,[key]:Math.max(0,Math.min(1,value))}:s));
 const normalize=(v:Slot):Slot=>{const width=Math.min(v.width,1-v.x);const height=Math.min(v.height,1-v.y);return {...v,width:Math.max(.01,width),height:Math.max(.01,height)}};
 const reset=()=>setSlots(DEFAULT_SLOTS(W,H).map(s=>({x:s.x/W,y:s.y/H,width:s.width/W,height:s.height/H})));
 return <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#17213b]/75 p-3 backdrop-blur-md sm:p-6">
  <div className="mx-auto max-w-[1250px] rounded-[34px] border border-white bg-white p-4 shadow-2xl sm:p-6">
   <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.22em] text-[#ff6fae]">FRAME CALIBRATION</p><h2 className="mt-1 text-2xl font-black text-[#24345f]">Atur 6 lubang dengan presisi 🎀</h2><p className="mt-1 text-xs font-bold text-[#8994b0]">Tidak perlu deteksi otomatis. Posisi yang Anda simpan menjadi patokan tetap untuk semua 6 foto.</p></div><button onClick={onCancel} className="rounded-2xl bg-[#f4f6fb] p-3 text-[#657295]"><X/></button></div>
   <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(380px,1fr)_430px]">
    <div className="rounded-[28px] bg-gradient-to-br from-[#eef7ff] to-[#fff0f7] p-4 sm:p-6"><div className={`relative mx-auto w-full max-w-[640px] overflow-hidden rounded-[22px] bg-white shadow-xl ${frame.orientation==='portrait'?'aspect-[1240/1748]':'aspect-[1748/1240]'}`}>
      {frame.image&&<img src={frame.image} className="absolute inset-0 h-full w-full object-fill"/>}
      {slots.map((slot,i)=><button key={i} type="button" onClick={()=>setSelected(i)} className={`absolute rounded-xl border-4 ${selected===i?'border-[#ff4fa0] bg-[#ff4fa0]/10 shadow-[0_0_0_3px_rgba(255,79,160,.2)]':'border-[#4e8cff]/80 bg-[#4e8cff]/5'}`} style={{left:`${slot.x*100}%`,top:`${slot.y*100}%`,width:`${slot.width*100}%`,height:`${slot.height*100}%`}}><span className="absolute -left-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-white text-xs font-black text-[#4e8cff] shadow">{i+1}</span><span className="absolute bottom-1 right-2 rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-black text-[#687695]">SLOT {i+1}</span></button>)}
     </div><div className="mt-4 flex flex-wrap justify-center gap-2"><span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-[#657295] shadow-sm">{W} × {H}px</span><span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-[#657295] shadow-sm">A6 • 300 DPI</span><span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-[#657295] shadow-sm">{frame.orientation}</span></div></div>
    <div className="rounded-[28px] bg-[#f7f9ff] p-5">
      <div className="grid grid-cols-3 gap-2">{slots.map((_,i)=><button key={i} onClick={()=>setSelected(i)} className={`rounded-xl py-2 text-xs font-black ${selected===i?'bg-gradient-to-r from-[#4e8cff] to-[#756dff] text-white':'bg-white text-[#75819e]'}`}>Slot {i+1}</button>)}</div>
      <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><b className="text-[#53638a]">Posisi & ukuran Slot {selected+1}</b><span className="rounded-full bg-[#fff0f7] px-2 py-1 text-[10px] font-black text-[#d95e91]">{Math.round(slots[selected].x*100)}%, {Math.round(slots[selected].y*100)}%</span></div>
       {(['x','y','width','height'] as const).map(key=><label key={key} className="mb-3 block"><div className="mb-1 flex justify-between text-[10px] font-black uppercase tracking-widest text-[#8994af]"><span>{key==='x'?'Posisi X':key==='y'?'Posisi Y':key==='width'?'Lebar':'Tinggi'}</span><span>{Math.round(slots[selected][key]*100)}%</span></div><input type="range" min="0" max="100" step="0.1" value={slots[selected][key]*100} onChange={e=>setSlot(selected,key,Number(e.target.value)/100)} className="w-full accent-[#6c7fff]"/></label>)}
       <div className="grid grid-cols-2 gap-2"><button onClick={()=>setSlots(v=>v.map((s,i)=>i===selected?normalize(s):s))} className="rounded-xl bg-[#eef3ff] py-2 text-xs font-black text-[#5d73c4]">✓ Rapikan Slot</button><button onClick={reset} className="rounded-xl bg-[#fff0f6] py-2 text-xs font-black text-[#d56291]">↻ Grid Awal</button></div>
      </div>
      <div className="mt-4 rounded-2xl bg-[#fffdf1] p-4 text-xs font-bold leading-relaxed text-[#8c805d]"><b>💡 Cara paling aman:</b> pilih Slot 1–6 lalu atur X, Y, Lebar, dan Tinggi sampai kotak biru tepat menutup lubang foto. Setelah disimpan, aplikasi <u>tidak akan menebak ulang</u> posisi tersebut.</div>
      <div className="mt-5 grid grid-cols-2 gap-3"><button onClick={onCancel} className="rounded-2xl border-2 border-[#e7ebf5] py-4 font-black text-[#697695]">Batal</button><button onClick={()=>onSave({...frame,slots:slots.map(normalize)})} className="rounded-2xl bg-gradient-to-r from-[#4e8cff] to-[#756dff] py-4 font-black text-white shadow-lg">💾 Simpan Frame</button></div>
    </div>
   </div>
  </div>
 </div>
}

function FrameGallery({frames,orientation,setOrientation,selected,setSelected,onBack,onAdd,onUpload,onDelete,onCalibrate,onUse}:{frames:Frame[];orientation:Orientation;setOrientation:(v:Orientation)=>void;selected:Frame;setSelected:(f:Frame)=>void;onBack:()=>void;onAdd:(n:string)=>void;onUpload:(data:string,name:string)=>void;onDelete:(id:string)=>void;onCalibrate:(f:Frame)=>void;onUse:()=>void}){
 const visible=frames.filter(f=>f.orientation==='both'||f.orientation===orientation);
 return <section className="rounded-[34px] border border-white bg-white/85 p-4 shadow-soft sm:p-6">
  <div className="flex flex-wrap items-center justify-between gap-4">
   <button onClick={onBack} className="flex items-center gap-2 rounded-2xl bg-[#f4f6ff] px-4 py-3 text-sm font-black text-[#5c6b91]"><ChevronLeft size={18}/> Dashboard</button>
   <div className="text-center"><h2 className="text-xl font-black text-[#24345f]">💖 Pilih Frame Favorit</h2><p className="text-xs font-bold text-[#9aa4bb]">Cute • 6 slot foto • A6</p></div>
   <label className="flex cursor-pointer items-center gap-2 rounded-2xl bg-[#ffedf6] px-4 py-3 text-sm font-black text-[#d85e90]"><Upload size={17}/> Tambah Frame<input type="file" accept="image/png,image/webp,image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>onUpload(String(r.result),f.name.replace(/\.[^/.]+$/,''));r.readAsDataURL(f)}}/></label>
  </div>
  <div className="mt-6 flex justify-center"><div className="rounded-2xl bg-[#f2f5fc] p-1">
   <button onClick={()=>setOrientation('portrait')} className={`rounded-xl px-6 py-2 text-sm font-black ${orientation==='portrait'?'bg-white text-[#4e8cff] shadow-sm':'text-[#8792ad]'}`}>Portrait A6</button>
   <button onClick={()=>setOrientation('landscape')} className={`rounded-xl px-6 py-2 text-sm font-black ${orientation==='landscape'?'bg-white text-[#ff6fae] shadow-sm':'text-[#8792ad]'}`}>Landscape A6</button>
  </div></div>
  <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
   {visible.map(f=><div key={f.id} className={`group rounded-[24px] border-2 bg-white p-3 text-left transition hover:-translate-y-1 hover:shadow-xl ${selected.id===f.id?'border-[#6d7fff] shadow-lg':'border-[#edf0f7]'}`}>
    <button onClick={()=>setSelected(f)} className="block w-full text-left">
      <div className={`relative overflow-hidden rounded-[18px] bg-gradient-to-br from-white to-[#f5f7ff] ${orientation==='portrait'?'aspect-[3/4]':'aspect-[4/3]'}`}>
       {f.image ? <img src={f.image} alt={f.name} className="h-full w-full object-fill"/> : <><div className="absolute inset-2 rounded-[14px] border-4" style={{borderColor:f.accent}}/><div className="grid h-full grid-cols-2 gap-2 p-5">{[1,2,3,4,5,6].map(n=><div key={n} className="rounded-lg bg-white shadow-sm"/>)}</div></>}
       <span className="absolute left-3 top-3 text-2xl">{f.emoji}</span>
      </div>
    </button>
    <div className="mt-2 flex items-center justify-between gap-2"><button onClick={()=>setSelected(f)} className="min-w-0 truncate text-xs font-black text-[#627096]">{f.name}</button><div className="flex shrink-0 items-center gap-1">{selected.id===f.id&&<Check size={15} className="text-[#5d7eff]"/>}{(f.id.startsWith('custom-')||f.id.startsWith('upload-'))&&<><button type="button" onClick={()=>onCalibrate(f)} className="grid h-7 w-7 place-items-center rounded-lg bg-[#eef3ff] text-[#5d73c4] hover:bg-[#e0e8ff]" title="Atur 6 slot">⚙</button><button type="button" onClick={()=>{if(confirm(`Hapus frame "${f.name}"?`))onDelete(f.id)}} className="grid h-7 w-7 place-items-center rounded-lg bg-[#fff1f6] text-[#e26a9b] hover:bg-[#ffdce9]" title="Hapus frame"><Trash2 size={14}/></button></>}</div></div>
   </div>)}
  </div>
  <div className="mt-8 flex flex-col items-center justify-between gap-3 rounded-3xl bg-gradient-to-r from-[#eef6ff] to-[#fff0f7] p-5 sm:flex-row">
   <div><b className="block text-[#53638a]">Frame terpilih: {selected.name} {selected.emoji}</b><span className="text-xs font-bold text-[#929db8]">{selected.slots?.length===6?'✓ 6 lubang sudah dipetakan.':'Slot otomatis digunakan saat frame diproses.'}</span></div>
   <button onClick={onUse} className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#4e8cff] to-[#776dff] px-7 py-4 font-black text-white shadow-lg">Gunakan Frame <ChevronRight size={18}/></button>
  </div>
  <p className="mt-4 text-center text-[11px] font-bold text-[#9aa4bd]">Frame upload tersimpan di perangkat/browser ini. Gunakan ⚙ untuk kalibrasi ulang dan 🗑️ untuk menghapus frame custom.</p>
 </section>
}
