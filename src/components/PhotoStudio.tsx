import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Aperture, ArrowLeftRight, Check, ChevronDown, Crop, FlipHorizontal, FlipVertical, RotateCcw, RotateCw, Undo2, Redo2, X } from 'lucide-react';
import './PhotoStudio.css';

export type PhotoAjustes = {
  exposure: number; brightness: number; contrast: number; highlights: number; shadows: number; whites: number; blacks: number;
  temperature: number; tint: number; saturation: number; vibrance: number; sharpness: number;
  clarity: number; texture: number; dehaze: number; noiseReduction: number; vignette: number; grain: number;
};
export type CropRatio = 'free' | '1:1' | '4:5' | '16:9' | '9:16';
export type CropState = { ratio: CropRatio; zoom: number; x: number; y: number; rotation: number; flipX: boolean; flipY: boolean };
export type PhotoEditResult = { src: string; originalSrc: string; adjustments: PhotoAjustes; crop: CropState; format: 'image/png'|'image/jpeg'|'image/webp'; width: number; height: number };
export type PhotoStudioProps = { source: string; fileName: string; initialTab?: 'adjust'|'crop'; initialAdjustments?: PhotoAjustes; initialCrop?: CropState; onApply: (result: PhotoEditResult) => void; onClose: () => void };
type Tab = 'adjust'|'crop';
type Snapshot = { adjustments: PhotoAjustes; crop: CropState };
type Preset = { name: string; values: Partial<PhotoAjustes> };
const BASE: PhotoAjustes = { exposure:0, brightness:0, contrast:0, highlights:0, shadows:0, whites:0, blacks:0, temperature:0, tint:0, saturation:0, vibrance:0, sharpness:0, clarity:0, texture:0, dehaze:0, noiseReduction:0, vignette:0, grain:0 };
const CROP: CropState = { ratio:'free', zoom:1, x:0, y:0, rotation:0, flipX:false, flipY:false };
const PRESETS: Preset[] = [
 {name:'Cinema quente',values:{temperature:18,tint:4,contrast:14,highlights:-16,shadows:9,saturation:8,vignette:18}},
 {name:'Cinema frio',values:{temperature:-20,tint:3,contrast:18,highlights:-20,shadows:12,saturation:-8,vignette:22}},
 {name:'Azul-petróleo e laranja',values:{temperature:8,tint:-7,contrast:22,shadows:-12,saturation:14,vibrance:16}},
 {name:'Filme analógico',values:{contrast:-10,highlights:-16,shadows:14,saturation:-12,grain:22,vignette:12,temperature:7}},
 {name:'Inspirado em Portra',values:{temperature:9,tint:4,contrast:-7,highlights:-22,shadows:13,saturation:-7,vibrance:14,grain:9}},
 {name:'Preto e branco',values:{saturation:-100,contrast:17,highlights:-8,shadows:8,clarity:9}},
 {name:'Vintage',values:{temperature:18,contrast:-12,saturation:-24,shadows:13,grain:20,vignette:17}},
 {name:'Editorial',values:{contrast:12,highlights:-12,shadows:5,saturation:-8,clarity:8}},
 {name:'Retrato',values:{brightness:4,highlights:-12,shadows:12,vibrance:9,sharpness:4}},
 {name:'Paisagem',values:{contrast:13,highlights:-15,shadows:12,vibrance:19,dehaze:12,texture:10}},
 {name:'Astrofotografia',values:{exposure:14,shadows:24,temperature:-8,dehaze:22,noiseReduction:24,vibrance:10}},
 {name:'Pastel',values:{contrast:-17,saturation:-15,highlights:-10,shadows:18,temperature:8}},
 {name:'Contraste dramático',values:{contrast:34,highlights:-23,shadows:-18,clarity:22,dehaze:13,vignette:14}},
 {name:'Minimalista',values:{contrast:-5,saturation:-12,brightness:3,highlights:-6}},
 {name:'Produto comercial',values:{brightness:7,contrast:12,highlights:-12,shadows:8,saturation:4,sharpness:12}}
];
const GROUPS: {title:string; controls:{key:keyof PhotoAjustes;label:string;min:number;max:number;unit?:string}[]}[] = [
 {title:'Luz',controls:[{key:'exposure',label:'Exposição',min:-100,max:100},{key:'brightness',label:'Brilho',min:-100,max:100},{key:'contrast',label:'Contraste',min:-100,max:100},{key:'highlights',label:'Realces',min:-100,max:100},{key:'shadows',label:'Sombras',min:-100,max:100},{key:'whites',label:'Brancos',min:-100,max:100},{key:'blacks',label:'Pretos',min:-100,max:100}]},
 {title:'Cor',controls:[{key:'temperature',label:'Temperatura',min:-100,max:100},{key:'tint',label:'Matiz',min:-100,max:100},{key:'saturation',label:'Saturação',min:-100,max:100},{key:'vibrance',label:'Vibração',min:-100,max:100}]},
 {title:'Detalhes e efeitos',controls:[{key:'sharpness',label:'Nitidez',min:0,max:100},{key:'clarity',label:'Claridade',min:-100,max:100},{key:'texture',label:'Textura',min:-100,max:100},{key:'dehaze',label:'Desembaçar',min:-100,max:100},{key:'noiseReduction',label:'Redução de ruído',min:0,max:100},{key:'vignette',label:'Vinheta',min:0,max:100},{key:'grain',label:'Granulação',min:0,max:100}]}
];
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));

function paint(canvas:HTMLCanvasElement,image:HTMLImageElement,adjustments:PhotoAjustes,crop:CropState,maxSize=0){
 const sw=image.naturalWidth,sh=image.naturalHeight,radians=crop.rotation*Math.PI/180;
 const width=Math.abs(sw*Math.cos(radians))+Math.abs(sh*Math.sin(radians)),height=Math.abs(sw*Math.sin(radians))+Math.abs(sh*Math.cos(radians));
 const scale=maxSize?Math.min(1,maxSize/Math.max(width,height)):1; canvas.width=Math.max(1,Math.ceil(width*scale));canvas.height=Math.max(1,Math.ceil(height*scale));
 const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('O Canvas 2D não está disponível neste navegador.');
 ctx.save();ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(crop.rotation*Math.PI/180);ctx.scale(crop.flipX?-1:1,crop.flipY?-1:1);ctx.drawImage(image,-sw*scale/2,-sh*scale/2,sw*scale,sh*scale);ctx.restore();
 let frame=ctx.getImageData(0,0,canvas.width,canvas.height),p=frame.data;
 const exp=Math.pow(2,adjustments.exposure/50), contrast=1+adjustments.contrast/100, sat=1+adjustments.saturation/100, temp=adjustments.temperature/100, tint=adjustments.tint/100;
 const cx=canvas.width/2,cy=canvas.height/2,maxD=Math.hypot(cx,cy)||1;
 for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const i=(y*canvas.width+x)*4;let r=p[i],g=p[i+1],b=p[i+2];
   const lum=.2126*r+.7152*g+.0722*b, norm=lum/255;
   let factor=exp*(1+adjustments.brightness/150); factor*=1+adjustments.shadows/100*(1-norm)*(1-norm)-adjustments.highlights/100*norm*norm;
   const whiteLift=adjustments.whites/100*36*norm*norm,blackLift=adjustments.blacks/100*36*(1-norm)*(1-norm);
   r=(r-127.5)*contrast+127.5+whiteLift+blackLift;g=(g-127.5)*contrast+127.5+whiteLift+blackLift;b=(b-127.5)*contrast+127.5+whiteLift+blackLift;
   r*=factor+temp*.18+ tint*.05;g*=factor-tint*.10;b*=factor-temp*.18+tint*.05;
   const l=.2126*r+.7152*g+.0722*b, vib=1+adjustments.vibrance/100*(1-clamp((Math.max(r,g,b)-Math.min(r,g,b))/255,0,1));
   r=l+(r-l)*sat*vib;g=l+(g-l)*sat*vib;b=l+(b-l)*sat*vib;
   const clarity=(adjustments.clarity+adjustments.texture+adjustments.dehaze*.7)/200;
   r+=(r-l)*clarity;g+=(g-l)*clarity;b+=(b-l)*clarity;
   const dist=Math.hypot(x-cx,y-cy)/maxD;const vig=1-adjustments.vignette/100*Math.max(0,dist-.2)*.85;
   const grain=(Math.random()-.5)*adjustments.grain*.55;
   p[i]=clamp(r*vig+grain,0,255);p[i+1]=clamp(g*vig+grain,0,255);p[i+2]=clamp(b*vig+grain,0,255);
 }
 // A subtle unsharp mask uses a neighboring-pixel average; positive sharpness adds local edge contrast.
 if(adjustments.sharpness>0||adjustments.noiseReduction>0){const src=new Uint8ClampedArray(p);const strength=adjustments.sharpness/100*.8,denoise=adjustments.noiseReduction/100*.18;
   for(let y=1;y<canvas.height-1;y++)for(let x=1;x<canvas.width-1;x++){const i=(y*canvas.width+x)*4;for(let c=0;c<3;c++){const avg=(src[i-4+c]+src[i+4+c]+src[i-canvas.width*4+c]+src[i+canvas.width*4+c])/4;p[i+c]=clamp(src[i+c]+(src[i+c]-avg)*strength+(avg-src[i+c])*denoise,0,255);}}
 }
 ctx.putImageData(frame,0,0);
 // Crop through clipping and cover-fit, with user-controlled repositioning.
 const ratio=crop.ratio==='free'?width/height:({'1:1':1,'4:5':4/5,'16:9':16/9,'9:16':9/16} as const)[crop.ratio];
 let cw=canvas.width,ch=canvas.height;if(cw/ch>ratio)cw=ch*ratio;else ch=cw/ratio;
 const out=document.createElement('canvas');out.width=Math.max(1,Math.round(cw));out.height=Math.max(1,Math.round(ch));const o=out.getContext('2d');if(!o)throw new Error('Não foi possível preparar o recorte.');
 const zoom=Math.max(1,crop.zoom),drawW=canvas.width*zoom,drawH=canvas.height*zoom;
 o.drawImage(canvas,(cw-drawW)/2+crop.x*canvas.width,(ch-drawH)/2+crop.y*canvas.height,drawW,drawH);
 return out;
}

export function PhotoStudio({source,fileName,initialTab='adjust',initialAdjustments,initialCrop,onApply,onClose}:PhotoStudioProps){
 const initialSettings=initialAdjustments??BASE,initialFraming=initialCrop??CROP;
 const [tab,setTab]=useState<Tab>(initialTab),[adjustments,setAjustes]=useState(initialSettings),[crop,setCrop]=useState(initialFraming),[before,setBefore]=useState(false),[format,setFormat]=useState<PhotoEditResult['format']>('image/jpeg'),[quality,setQuality]=useState(92),[outputSize,setOutputSize]=useState<'original'|'1080'|'2048'>('1080'),[error,setError]=useState(''),[loaded,setLoaded]=useState(false),[dragging,setDragging]=useState(false),[customName,setCustomName]=useState(''),[customPredefinições,setCustomPredefinições]=useState<Preset[]>([]);
 const [history,setHistory]=useState<Snapshot[]>([{adjustments:initialSettings,crop:initialFraming}]),[historyIndex,setHistoryIndex]=useState(0);
 const imageRef=useRef<HTMLImageElement>(null),canvasRef=useRef<HTMLCanvasElement>(null),previewRef=useRef<HTMLDivElement>(null),cropRef=useRef<CropState>(initialFraming),dragOrigin=useRef<{x:number;y:number;cx:number;cy:number;moved:boolean}|null>(null);
 const snapshot=useMemo(()=>({adjustments,crop}),[adjustments,crop]);
 useEffect(()=>{try{const saved=localStorage.getItem('photo-studio-presets');if(saved)setCustomPredefinições(JSON.parse(saved) as Preset[]);}catch{ /* storage may be disabled */}},[]);
 const redraw=useCallback(()=>{if(!loaded||!imageRef.current||!canvasRef.current)return;try{const rendered=paint(canvasRef.current,imageRef.current,before?BASE:adjustments,crop,1280);if(rendered!==canvasRef.current){const target=canvasRef.current;target.width=rendered.width;target.height=rendered.height;target.getContext('2d')?.drawImage(rendered,0,0);}}catch(e){setError(e instanceof Error?e.message:'Não foi possível processar esta imagem.');}},[loaded,before,adjustments,crop]);
 useEffect(()=>{redraw();},[redraw]);
 const pushHistory=(next:Snapshot)=>{setHistory(h=>[...h.slice(0,historyIndex+1),next].slice(-60));setHistoryIndex(i=>Math.min(i+1,59));};
 const updateAdjustment=(key:keyof PhotoAjustes,value:number)=>{const next={...adjustments,[key]:value};setAjustes(next);pushHistory({adjustments:next,crop});};
 const updateCrop=(next:CropState)=>{cropRef.current=next;setCrop(next);pushHistory({adjustments,crop:next});};
 const travel=(index:number)=>{const item=history[index];if(item){setHistoryIndex(index);setAjustes(item.adjustments);cropRef.current=item.crop;setCrop(item.crop);}};
 const applyPreset=(preset:Preset)=>{const next={...BASE,...preset.values};setAjustes(next);pushHistory({adjustments:next,crop});};
 const savePreset=()=>{const name=customName.trim();if(!name)return;const next=[...customPredefinições,{name,values:{...adjustments}}];setCustomPredefinições(next);setCustomName('');try{localStorage.setItem('photo-studio-presets',JSON.stringify(next));}catch{setError('Predefinição aplicada, mas não foi possível salvá-la neste navegador.');}};
 const exportImage=()=>{if(!imageRef.current)return;try{const cropped=paint(document.createElement('canvas'),imageRef.current,adjustments,crop);const ratio=cropped.width/cropped.height;let rendered=cropped;if(outputSize!=='original'){const shortSide=Number(outputSize),width=Math.max(1,Math.round(ratio>=1?shortSide*ratio:shortSide)),height=Math.max(1,Math.round(ratio>=1?shortSide:shortSide/ratio));rendered=document.createElement('canvas');rendered.width=width;rendered.height=height;const ctx=rendered.getContext('2d');if(!ctx)throw new Error('Não foi possível preparar o tamanho de saída.');ctx.drawImage(cropped,0,0,width,height);}const mime=format==='image/png'?'image/png':format;const src=rendered.toDataURL(mime,mime==='image/png'?undefined:quality/100);onApply({src,originalSrc:source,adjustments:{...adjustments},crop:{...crop},format:mime,width:rendered.width,height:rendered.height});}catch(e){setError(e instanceof Error?e.message:'Falha ao exportar. Tente outro formato de imagem.');}};
 const setRatio=(ratio:CropRatio)=>updateCrop({...crop,ratio});
 const pointerDown=(event:PointerEvent<HTMLCanvasElement>)=>{if(tab!=='crop')return;event.currentTarget.setPointerCapture(event.pointerId);dragOrigin.current={x:event.clientX,y:event.clientY,cx:crop.x,cy:crop.y,moved:false};cropRef.current=crop;setDragging(true);};
 const pointerMove=(event:PointerEvent<HTMLCanvasElement>)=>{if(!dragOrigin.current)return;const bounds=event.currentTarget.getBoundingClientRect(),d=dragOrigin.current,dx=event.clientX-d.x,dy=event.clientY-d.y;if(Math.abs(dx)+Math.abs(dy)>1)d.moved=true;const next={...cropRef.current,x:clamp(d.cx+dx/bounds.width,-1,1),y:clamp(d.cy+dy/bounds.height,-1,1)};cropRef.current=next;setCrop(next);};
 const finishPan=()=>{const drag=dragOrigin.current;dragOrigin.current=null;setDragging(false);if(!drag?.moved)return;const next:Snapshot={adjustments:{...adjustments},crop:{...cropRef.current}};setHistory(h=>[...h.slice(0,historyIndex+1),next].slice(-60));setHistoryIndex(i=>Math.min(i+1,59));};
 const control=(key:keyof PhotoAjustes,label:string,min:number,max:number)=><label className="ps-slider" key={key}><span className="ps-slider-label">{label}<output>{adjustments[key]}</output></span><input aria-label={label} type="range" min={min} max={max} value={adjustments[key]} onChange={e=>updateAdjustment(key,Number(e.target.value))}/><span className="ps-range-ends"><span>{min}</span><span>{max}</span></span></label>;

 return <div className="ps-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="ps-modal" role="dialog" aria-modal="true" aria-labelledby="ps-title">
  <header className="ps-header"><div className="ps-brand"><span className="ps-mark"><Aperture size={19}/></span><div><h1 id="ps-title">Laboratório de fotografia</h1><p>{fileName}</p></div></div><div className="ps-history"><button type="button" aria-label="Desfazer" title="Desfazer" disabled={historyIndex<=0} onClick={()=>travel(historyIndex-1)}><Undo2 size={17}/></button><button type="button" aria-label="Refazer" title="Refazer" disabled={historyIndex>=history.length-1} onClick={()=>travel(historyIndex+1)}><Redo2 size={17}/></button><button type="button" className="ps-restore" onClick={()=>{setAjustes(BASE);cropRef.current=CROP;setCrop(CROP);pushHistory({adjustments:BASE,crop:CROP});}}>Restaurar</button><button type="button" className="ps-close" aria-label="Fechar editor de fotografia" onClick={onClose}><X size={19}/></button></div></header>
  <div className="ps-layout"><main className="ps-workspace"><div className="ps-toolbar"><div className="ps-tabs" role="tablist" aria-label="Ferramentas de edição"><button type="button" role="tab" aria-selected={tab==='adjust'} onClick={()=>setTab('adjust')}><Aperture size={16}/> Ajustes</button><button type="button" role="tab" aria-selected={tab==='crop'} onClick={()=>setTab('crop')}><Crop size={16}/> Recorte e rotação</button></div><button type="button" className={`ps-compare ${before?'active':''}`} aria-pressed={before} onClick={()=>setBefore(v=>!v)}><ArrowLeftRight size={16}/>{before?'Original':'Comparar'}</button></div>
   <div className="ps-preview-area" ref={previewRef}><div className="ps-preview-frame">{!loaded&&<div className="ps-loading">Carregando original…</div>}<canvas ref={canvasRef} aria-label={before?'Prévia da foto original':'Prévia da foto editada'} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={finishPan} onPointerCancel={finishPan} style={{cursor:tab==='crop'?(dragging?'grabbing':'grab'):'default'}}/></div><span className="ps-preview-caption">{before?'Original':'Prévia editada'}{tab==='crop'?' · arraste para reenquadrar':''}</span></div>
   <footer className="ps-bottom"><span>O original permanece intacto até você aplicar.</span><div><button type="button" className="ps-cancel" onClick={onClose}>Cancelar</button><button type="button" className="ps-apply" onClick={exportImage}><Check size={17}/> Aplicar foto</button></div></footer>
  </main><aside className="ps-panel">{tab==='adjust'?<><div className="ps-panel-heading"><div><h2>Ajustes</h2><p>Ajuste luz, cor e acabamento.</p></div></div><div className="ps-presets"><h3>Predefinições</h3><div className="ps-preset-grid">{PRESETS.map(p=><button type="button" key={p.name} onClick={()=>applyPreset(p)}>{p.name}</button>)}{customPredefinições.map((p,i)=><button type="button" key={`${p.name}-${i}`} onClick={()=>applyPreset(p)}>{p.name}</button>)}</div><div className="ps-save-preset"><input aria-label="Nome da predefinição" placeholder="Nome do visual" value={customName} onChange={e=>setCustomName(e.target.value)} maxLength={32}/><button type="button" disabled={!customName.trim()} onClick={savePreset}>Salvar</button></div></div><div className="ps-controls">{GROUPS.map(group=><section className="ps-group" key={group.title}><h3>{group.title}</h3>{group.controls.map(c=>control(c.key,c.label,c.min,c.max))}</section>)}<p className="ps-note">Curvas, máscaras locais e retoque por IA exigem um serviço de edição externo e não estão disponíveis nesta versão.</p></div></>:<><div className="ps-panel-heading"><div><h2>Recorte e exportação</h2><p>Escolha um formato e ajuste o enquadramento.</p></div></div><div className="ps-crop-tools"><h3>Proporção</h3><div className="ps-ratios">{(['free','1:1','4:5','16:9','9:16'] as CropRatio[]).map(r=><button type="button" className={crop.ratio===r?'selected':''} key={r} onClick={()=>setRatio(r)}>{r==='free'?'Original':r}</button>)}</div><label className="ps-slider"><span className="ps-slider-label">Zoom <output>{crop.zoom.toFixed(2)}×</output></span><input aria-label="Zoom do recorte" type="range" min="1" max="3" step="0.01" value={crop.zoom} onChange={e=>updateCrop({...crop,zoom:Number(e.target.value)})}/></label><div className="ps-transform-row"><button type="button" onClick={()=>updateCrop({...crop,rotation:(crop.rotation-90+360)%360})}><RotateCcw size={16}/> Girar para a esquerda</button><button type="button" onClick={()=>updateCrop({...crop,rotation:(crop.rotation+90)%360})}><RotateCw size={16}/> Girar para a direita</button></div><label className="ps-slider"><span className="ps-slider-label">Endireitar <output>{crop.rotation}°</output></span><input aria-label="Endireitar a foto" type="range" min="0" max="360" step="0.5" value={crop.rotation} onChange={e=>updateCrop({...crop,rotation:Number(e.target.value)})}/></label><div className="ps-transform-row"><button type="button" aria-pressed={crop.flipX} onClick={()=>updateCrop({...crop,flipX:!crop.flipX})}><FlipHorizontal size={16}/> Espelhar horizontalmente</button><button type="button" aria-pressed={crop.flipY} onClick={()=>updateCrop({...crop,flipY:!crop.flipY})}><FlipVertical size={16}/> Espelhar verticalmente</button></div><p className="ps-note">Arraste a foto na prévia para reposicioná-la dentro do recorte.</p><h3>Exportar</h3><label className="ps-select-label">Formato<select aria-label="Formato de exportação" value={format} onChange={e=>setFormat(e.target.value as PhotoEditResult['format'])}><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select><ChevronDown size={15}/></label>{format!=='image/png'&&<label className="ps-slider"><span className="ps-slider-label">Qualidade <output>{quality}%</output></span><input aria-label="Qualidade de exportação" type="range" min="40" max="100" value={quality} onChange={e=>setQuality(Number(e.target.value))}/></label>}<label className="ps-select-label">Tamanho<select aria-label="Resolução do arquivo exportado" value={outputSize} onChange={e=>setOutputSize(e.target.value as typeof outputSize)}><option value="original">Manter resolução original</option><option value="1080">Padrão para redes · lado menor 1080 px</option><option value="2048">Alta qualidade · lado menor 2048 px</option></select><ChevronDown size={15}/></label><p className="ps-dimensions">A proporção escolhida define a dimensão de saída; exemplos: 4:5 → 1080 × 1350 px e 9:16 → 1080 × 1920 px.</p></div></>}</aside></div>
  <img ref={imageRef} src={source} alt="" className="ps-source-image" onLoad={()=>{setError('');setLoaded(true);}} onError={()=>{setLoaded(false);setError('Não foi possível carregar esta imagem. Verifique o arquivo ou escolha outra foto.');}}/>{error&&<div className="ps-error" role="alert">{error}<button type="button" aria-label="Fechar mensagem de erro" onClick={()=>setError('')}><X size={15}/></button></div>}
 </section></div>;
}
