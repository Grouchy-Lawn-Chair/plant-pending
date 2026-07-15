import { useEffect } from 'react';
import type { GardenPlan, GardenZone, PlacedPlant } from './types/plant';

const CURRENT_PLAN_KEY='garden-planner-current';
const DRIFT_GAP_KEY='plant-pending-drift-gap-feet';
const PLANT_COLOR_KEY='plant-pending-species-colors';
const SPECIES_PALETTE=['#D54E27','#A3DECF','#A073C2','#DDE985','#59A5CB','#E8B85C','#B26175','#6CA47F','#88778F','#F6DA7B','#79C7A5','#D76F4C','#8B6FAF','#94B797','#C98A5F','#7FAEBC','#DFA3A3','#B8C96F','#6E8F73','#94AA75'];

type HookNode={memoizedState?:unknown;queue?:{dispatch?:(value:unknown)=>void}|null;next?:HookNode|null};
type FiberNode={child?:FiberNode|null;sibling?:FiberNode|null;return?:FiberNode|null;memoizedProps?:Record<string,unknown>|null;pendingProps?:Record<string,unknown>|null;memoizedState?:HookNode|null};
type Point={x:number;y:number};
type SpeciesColorMap=Record<string,string>;

function setInputValue(input:HTMLInputElement,value:number){
  const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
  setter?.call(input,String(value));
  input.dispatchEvent(new Event('input',{bubbles:true}));
  input.dispatchEvent(new Event('change',{bubbles:true}));
}
function mixInputFor(card:HTMLElement){
  const label=[...card.querySelectorAll('label')].find(item=>item.textContent?.trim().startsWith('Mix %'));
  return label?.querySelector<HTMLInputElement>('input[type="number"]')||null;
}
function readPlan():GardenPlan|null{try{const raw=localStorage.getItem(CURRENT_PLAN_KEY);return raw?JSON.parse(raw)as GardenPlan:null;}catch{return null;}}
function readSpeciesColors():SpeciesColorMap{try{const raw=localStorage.getItem(PLANT_COLOR_KEY);return raw?JSON.parse(raw)as SpeciesColorMap:{};}catch{return {};}}
function writeSpeciesColors(colors:SpeciesColorMap){localStorage.setItem(PLANT_COLOR_KEY,JSON.stringify(colors));}
function findFiber(element:Element|null):FiberNode|null{let current=element;while(current){const key=Object.keys(current).find(name=>name.startsWith('__reactFiber$'));if(key)return(current as unknown as Record<string,FiberNode>)[key]||null;current=current.parentElement;}return null;}
function rootOf(start:FiberNode|null){let root=start;if(!root)return null;while(root.return)root=root.return;return root;}
function findCallback(start:FiberNode|null,name:string):((plan:GardenPlan)=>void)|null{const root=rootOf(start);if(!root)return null;const stack=[root],seen=new Set<FiberNode>();while(stack.length){const fiber=stack.pop()!;if(seen.has(fiber))continue;seen.add(fiber);const callback=fiber.memoizedProps?.[name]??fiber.pendingProps?.[name];if(typeof callback==='function')return callback as(plan:GardenPlan)=>void;if(fiber.sibling)stack.push(fiber.sibling);if(fiber.child)stack.push(fiber.child);}return null;}
function applyPlan(plan:GardenPlan){const host=document.querySelector<HTMLElement>('[data-recipe-react-host]')||document.getElementById('root');const callback=findCallback(findFiber(host),'onImportPlan')||findCallback(findFiber(host),'onLoadPlan');if(!callback)return false;callback(plan);localStorage.setItem(CURRENT_PLAN_KEY,JSON.stringify(plan));return true;}
function pointInPolygon(point:Point,polygon:Point[]){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a.y>point.y)!==(b.y>point.y)&&point.x<((b.x-a.x)*(point.y-a.y))/((b.y-a.y)||1e-9)+a.x)inside=!inside;}return inside;}
function driftId(plant:PlacedPlant){return plant.notes?.match(/\[drift:([^\]]+)\]/)?.[1]||null;}
function hash01(text:string){let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return((hash>>>0)%10000)/10000;}

function ensureSpeciesColors(plan:GardenPlan){
  const colors=readSpeciesColors();
  const orderedIds:number[]=[];
  for(const item of plan.placedPlants||[]){if(item.itemType==='rock'||orderedIds.includes(item.plantId))continue;orderedIds.push(item.plantId);}
  let mapChanged=false;
  orderedIds.forEach((plantId,index)=>{const key=String(plantId);if(!colors[key]){colors[key]=SPECIES_PALETTE[index%SPECIES_PALETTE.length];mapChanged=true;}});
  if(mapChanged)writeSpeciesColors(colors);
  let planChanged=false;
  const placedPlants=(plan.placedPlants||[]).map(item=>{
    if(item.itemType==='rock')return item;
    const color=colors[String(item.plantId)];
    if(!color||item.customColor===color)return item;
    planChanged=true;
    return{...item,customColor:color};
  });
  return planChanged?{...plan,placedPlants,updatedAt:new Date().toISOString()}:plan;
}

function separateDrifts(plan:GardenPlan,gapFeet:number){
  if(gapFeet<=0)return plan;
  const ppf=plan.scalePixelsPerFoot||20;
  const plants=(plan.placedPlants||[]).map(item=>({...item}));
  const zones=new Map((plan.zones||[]).map(zone=>[zone.id,zone]));
  const groups=new Map<string,PlacedPlant[]>();
  for(const plant of plants){
    if(plant.itemType==='rock'||!plant.notes?.includes('[mergeable]'))continue;
    const id=driftId(plant);if(!id)continue;
    const key=`${plant.zone}|${plant.plantId}|${id}`;
    const members=groups.get(key)||[];members.push(plant);groups.set(key,members);
  }
  const bySpecies=new Map<string,Array<{key:string;members:PlacedPlant[]}>>();
  for(const[key,members]of groups){if(members.length<2)continue;const first=members[0];const speciesKey=`${first.zone}|${first.plantId}`;const list=bySpecies.get(speciesKey)||[];list.push({key,members});bySpecies.set(speciesKey,list);}
  const positionById=new Map(plants.map(item=>[item.instanceId,item]));
  let changed=false;
  for(const groupList of bySpecies.values()){
    if(groupList.length<2)continue;
    for(let pass=0;pass<10;pass++){
      for(let i=0;i<groupList.length;i++)for(let j=i+1;j<groupList.length;j++){
        const a=groupList[i],b=groupList[j];
        const center=(members:PlacedPlant[])=>members.reduce((sum,item)=>({x:sum.x+item.x/members.length,y:sum.y+item.y/members.length}),{x:0,y:0});
        const ca=center(a.members),cb=center(b.members);
        const envelope=(members:PlacedPlant[],c:Point)=>Math.max(...members.map(item=>Math.hypot(item.x-c.x,item.y-c.y)+Math.max(5,((item.displayWidthFt||2)*ppf)/2)));
        const ra=envelope(a.members,ca),rb=envelope(b.members,cb);
        const dx=cb.x-ca.x,dy=cb.y-ca.y,d=Math.hypot(dx,dy)||1;
        const wiggle=.72+hash01(`${a.key}|${b.key}`)*.56;
        const target=ra+rb+gapFeet*ppf*wiggle;
        if(d>=target)continue;
        const push=(target-d)*.34,ux=dx/d,uy=dy/d;
        const zone=zones.get(a.members[0].zone||'');
        if(!zone)continue;
        const move=(members:PlacedPlant[],mx:number,my:number)=>members.every(item=>pointInPolygon({x:item.x+mx,y:item.y+my},zone.points));
        const ax=-ux*push,ay=-uy*push,bx=ux*push,by=uy*push;
        if(move(a.members,ax,ay)){a.members.forEach(item=>{item.x+=ax;item.y+=ay;});changed=true;}
        if(move(b.members,bx,by)){b.members.forEach(item=>{item.x+=bx;item.y+=by;});changed=true;}
      }
    }
  }
  if(!changed)return plan;
  return{...plan,placedPlants:(plan.placedPlants||[]).map(item=>positionById.get(item.instanceId)||item),updatedAt:new Date().toISOString()};
}

function installDriftGapControl(host:HTMLElement){
  if(host.querySelector('[data-drift-gap-control]'))return;
  const wrapper=document.createElement('div');wrapper.dataset.driftGapControl='true';wrapper.className='mt-3 rounded-xl border border-violet-500/30 bg-slate-950/45 p-2 text-slate-100';
  const value=Math.max(0,Number(localStorage.getItem(DRIFT_GAP_KEY))||0);
  wrapper.innerHTML=`<label class="block text-xs">Space between drifts <span class="text-slate-400">(feet, with natural wiggle)</span><input data-drift-gap-input type="number" min="0" max="20" step="0.5" value="${value}" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white" /></label><div class="mt-1 text-[10px] text-violet-300">0 = let drifts mingle. 3 = aim for a walkable-ish gap, plus or minus some botanical freelancing.</div>`;
  const buttons=[...host.querySelectorAll('button')];const advanced=buttons.find(button=>/advanced physics/i.test(button.textContent||''));advanced?.parentElement?.insertBefore(wrapper,advanced);
  wrapper.querySelector<HTMLInputElement>('[data-drift-gap-input]')?.addEventListener('change',event=>localStorage.setItem(DRIFT_GAP_KEY,String(Math.max(0,Number((event.target as HTMLInputElement).value)||0))));
}

export default function RecipeUiCorrections(){
  useEffect(()=>{
    let balancing=false;
    let colorBefore:GardenPlan|null=null;
    let driftTimer=0;
    let normalizeTimer=0;
    let lastGenerationSignature='';

    const rebalance=(changed:HTMLInputElement)=>{
      if(balancing)return;
      const host=changed.closest<HTMLElement>('[data-recipe-react-host]');
      const card=changed.closest<HTMLElement>('div.rounded-xl');
      if(!host||!card||mixInputFor(card)!==changed)return;
      const cards=[...host.querySelectorAll<HTMLElement>('div.rounded-xl')];
      const enabled=cards.filter(item=>item.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked);
      const entries=enabled.map(item=>({input:mixInputFor(item),card:item})).filter((item):item is {input:HTMLInputElement;card:HTMLElement}=>Boolean(item.input));
      if(entries.length<2)return;
      const selected=Math.max(0,Math.min(100,Math.round(Number(changed.value)||0)));
      const others=entries.filter(item=>item.input!==changed),remaining=100-selected;
      const oldTotal=others.reduce((sum,item)=>sum+Math.max(0,Number(item.input.value)||0),0);
      let assigned=0;balancing=true;
      others.forEach((item,index)=>{const next=index===others.length-1?remaining-assigned:Math.max(0,Math.round(oldTotal>0?remaining*((Number(item.input.value)||0)/oldTotal):remaining/others.length));assigned+=next;setInputValue(item.input,next);});
      if(Number(changed.value)!==selected)setInputValue(changed,selected);balancing=false;
    };

    const syncColorSwatch=(input:HTMLInputElement)=>{
      const row=input.parentElement;if(!row)return;const swatch=[...row.querySelectorAll<HTMLElement>('div')].find(item=>item.classList.contains('rounded-full'));if(swatch){swatch.style.backgroundColor=input.value;swatch.title='Current color for every instance of this plant';}
    };

    const captureAndPropagateColor=(reset=false)=>{
      const before=colorBefore;let attempts=0;
      const retry=window.setInterval(()=>{
        attempts++;
        const current=readPlan();
        if(!before||!current){window.clearInterval(retry);return;}
        const oldById=new Map(before.placedPlants.map(item=>[item.instanceId,item]));
        const changed=current.placedPlants.find(item=>oldById.has(item.instanceId)&&oldById.get(item.instanceId)?.customColor!==item.customColor);
        if(!changed){if(attempts>24)window.clearInterval(retry);return;}
        window.clearInterval(retry);
        const colors=readSpeciesColors();
        const key=String(changed.plantId);
        if(reset||!changed.customColor)delete colors[key];else colors[key]=changed.customColor;
        writeSpeciesColors(colors);
        const fallback=colors[key]||SPECIES_PALETTE[Math.max(0,[...new Set(current.placedPlants.filter(item=>item.itemType!=='rock').map(item=>item.plantId))].indexOf(changed.plantId))%SPECIES_PALETTE.length];
        if(!colors[key]){colors[key]=fallback;writeSpeciesColors(colors);}
        const next={...current,placedPlants:current.placedPlants.map(item=>item.itemType!=='rock'&&item.plantId===changed.plantId?{...item,customColor:fallback}:item),updatedAt:new Date().toISOString()};
        applyPlan(next);
      },80);
    };

    const normalizeCurrentPlan=()=>{
      const plan=readPlan();if(!plan)return;
      const normalized=ensureSpeciesColors(plan);
      if(normalized!==plan)applyPlan(normalized);
    };

    const onPointerDown=(event:Event)=>{const target=event.target;if(target instanceof HTMLInputElement&&target.type==='color')colorBefore=readPlan();};
    const onInput=(event:Event)=>{const target=event.target;if(target instanceof HTMLInputElement&&target.type==='color')syncColorSwatch(target);};
    const onChange=(event:Event)=>{const target=event.target;if(target instanceof HTMLInputElement){if(target.type==='number')rebalance(target);if(target.type==='color'){syncColorSwatch(target);captureAndPropagateColor(false);}}};
    const onClick=(event:Event)=>{const button=(event.target as Element|null)?.closest<HTMLButtonElement>('button');if(!button)return;if(button.textContent?.trim()==='Reset'&&button.closest('div')?.parentElement?.textContent?.includes('Symbol color')){colorBefore=readPlan();window.setTimeout(()=>captureAndPropagateColor(true),0);}};

    const polish=()=>{
      document.querySelectorAll<HTMLInputElement>('input[type="color"]').forEach(input=>{if(input.closest('div')?.parentElement?.textContent?.includes('Symbol color'))syncColorSwatch(input);});
      document.querySelectorAll<HTMLButtonElement>('button').forEach(button=>{if(button.textContent?.trim()==='Delete'&&button.closest('aside'))button.className='flex-1 px-3 py-2 text-xs font-bold bg-red-600 hover:bg-red-500 text-white border border-red-400 rounded-lg shadow-sm';});
      document.querySelectorAll<HTMLElement>('[data-recipe-react-host]').forEach(installDriftGapControl);
      const plan=readPlan();if(!plan)return;
      const generated=plan.placedPlants.filter(item=>item.instanceId.startsWith('recipe-run-'));
      const signature=generated.map(item=>item.instanceId).sort().join('|');
      if(signature&&signature!==lastGenerationSignature){
        lastGenerationSignature=signature;
        window.clearTimeout(normalizeTimer);
        normalizeTimer=window.setTimeout(normalizeCurrentPlan,250);
        window.clearTimeout(driftTimer);
        driftTimer=window.setTimeout(()=>{const fresh=readPlan();const gap=Math.max(0,Number(localStorage.getItem(DRIFT_GAP_KEY))||0);if(fresh&&gap>0){const spaced=separateDrifts(fresh,gap);if(spaced!==fresh)applyPlan(spaced);}},1800);
      }
    };

    const observer=new MutationObserver(polish);observer.observe(document.body,{childList:true,subtree:true});
    const timer=window.setInterval(polish,500);polish();normalizeCurrentPlan();
    document.addEventListener('pointerdown',onPointerDown,true);document.addEventListener('input',onInput,true);document.addEventListener('change',onChange,true);document.addEventListener('click',onClick,true);
    return()=>{observer.disconnect();window.clearInterval(timer);window.clearTimeout(driftTimer);window.clearTimeout(normalizeTimer);document.removeEventListener('pointerdown',onPointerDown,true);document.removeEventListener('input',onInput,true);document.removeEventListener('change',onChange,true);document.removeEventListener('click',onClick,true);};
  },[]);
  return null;
}
