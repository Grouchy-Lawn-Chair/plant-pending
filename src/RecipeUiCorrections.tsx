import { useEffect } from 'react';
import type { GardenPlan, PlacedPlant, Plant } from './types/plant';

const CURRENT_PLAN_KEY='garden-planner-current';
const DRIFT_GAP_KEY='plant-pending-drift-gap-feet';

type FiberNode={child?:FiberNode|null;sibling?:FiberNode|null;return?:FiberNode|null;memoizedProps?:Record<string,unknown>|null;pendingProps?:Record<string,unknown>|null};
type SelectionContext={selectedInstanceId:string;placedPlants:PlacedPlant[];plants:Plant[];onUpdatePlacedPlant:(instanceId:string,updates:Partial<PlacedPlant>)=>void};

function setInputValue(input:HTMLInputElement,value:number){const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter?.call(input,String(value));input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
function mixInputFor(card:HTMLElement){const label=[...card.querySelectorAll('label')].find(item=>item.textContent?.trim().startsWith('Mix %'));return label?.querySelector<HTMLInputElement>('input[type="number"]')||null;}
function readPlan():GardenPlan|null{try{const raw=localStorage.getItem(CURRENT_PLAN_KEY);return raw?JSON.parse(raw)as GardenPlan:null;}catch{return null;}}
function findFiber(element:Element|null):FiberNode|null{let current=element;while(current){const key=Object.keys(current).find(name=>name.startsWith('__reactFiber$'));if(key)return(current as unknown as Record<string,FiberNode>)[key]||null;current=current.parentElement;}return null;}
function rootOf(start:FiberNode|null){let root=start;if(!root)return null;while(root.return)root=root.return;return root;}
function findFunction(start:FiberNode|null,name:string):Function|null{const root=rootOf(start);if(!root)return null;const stack=[root],seen=new Set<FiberNode>();while(stack.length){const fiber=stack.pop()!;if(seen.has(fiber))continue;seen.add(fiber);const callback=fiber.memoizedProps?.[name]??fiber.pendingProps?.[name];if(typeof callback==='function')return callback as Function;if(fiber.sibling)stack.push(fiber.sibling);if(fiber.child)stack.push(fiber.child);}return null;}
function applyPlan(plan:GardenPlan){const host=document.querySelector<HTMLElement>('[data-recipe-react-host]')||document.getElementById('root');const callback=findFunction(findFiber(host),'onImportPlan')||findFunction(findFiber(host),'onLoadPlan');if(!callback)return false;callback(plan);localStorage.setItem(CURRENT_PLAN_KEY,JSON.stringify(plan));return true;}
function driftId(plant:PlacedPlant){return plant.notes?.match(/\[drift:([^\]]+)\]/)?.[1]||null;}
function hash01(text:string){let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return((hash>>>0)%10000)/10000;}

function findSelectionContext():SelectionContext|null{
  const aside=document.querySelector('aside');
  const root=rootOf(findFiber(aside));
  if(!root)return null;
  const stack=[root],seen=new Set<FiberNode>();
  while(stack.length){
    const fiber=stack.pop()!;
    if(seen.has(fiber))continue;
    seen.add(fiber);
    const props=fiber.memoizedProps??fiber.pendingProps;
    if(props&&typeof props.selectedInstanceId==='string'&&Array.isArray(props.placedPlants)&&Array.isArray(props.plants)&&typeof props.onUpdatePlacedPlant==='function'){
      return{selectedInstanceId:props.selectedInstanceId,placedPlants:props.placedPlants as PlacedPlant[],plants:props.plants as Plant[],onUpdatePlacedPlant:props.onUpdatePlacedPlant as SelectionContext['onUpdatePlacedPlant']};
    }
    if(fiber.sibling)stack.push(fiber.sibling);
    if(fiber.child)stack.push(fiber.child);
  }
  return null;
}

function isRedTipPhotinia(plant:Plant){
  const identity=`${plant.commonName||''} ${plant.botanicalName||''} ${plant.greenAcresProductName||''} ${plant.greenAcresBotanicalName||''}`.toLowerCase();
  return identity.includes('red tip photinia')||identity.includes('red-tip photinia')||(identity.includes('photinia')&&identity.includes('fraseri'));
}

function correctPhotiniaCategory(plants:Plant[]){
  plants.forEach(plant=>{if(isRedTipPhotinia(plant)&&plant.category!=='Shrub')plant.category='Shrub';});
}

function installMaintainedWidthControl(){
  const context=findSelectionContext();
  if(!context)return;
  correctPhotiniaCategory(context.plants);
  const selected=context.placedPlants.find(item=>item.instanceId===context.selectedInstanceId);
  if(!selected||selected.itemType==='rock')return;
  const plant=context.plants.find(item=>item.id===selected.plantId);
  if(!plant)return;
  const inspector=document.querySelector<HTMLElement>('aside .inspector-dark');
  if(!inspector)return;
  const selectionHeading=[...inspector.querySelectorAll('h3')].find(item=>item.textContent?.trim()==='Selection');
  const panel=selectionHeading?.parentElement;
  if(!panel)return;
  let wrapper=panel.querySelector<HTMLElement>('[data-maintained-width-control]');
  if(wrapper?.dataset.instanceId===selected.instanceId)return;
  wrapper?.remove();
  wrapper=document.createElement('div');
  wrapper.dataset.maintainedWidthControl='true';
  wrapper.dataset.instanceId=selected.instanceId;
  wrapper.className='rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3';
  const natural=Math.max(.25,plant.matureWidthFt||2);
  const maintained=Math.max(.25,selected.displayWidthFt||natural);
  wrapper.innerHTML=`<div class="flex items-center justify-between gap-2"><label class="text-xs font-bold text-emerald-200">Maintained width</label><button data-reset-maintained-width type="button" class="text-[11px] text-emerald-300 hover:underline">Use mature width</button></div><div class="mt-2 flex items-center gap-2"><input data-maintained-width-input type="number" min="0.25" max="100" step="0.25" value="${maintained}" class="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white"/><span class="text-xs text-slate-400">ft</span></div><div data-maintained-width-summary class="mt-1 text-[11px] text-slate-300">Shown as ${maintained} ft (${Math.round(maintained*12)} in). Natural mature width: ${natural} ft.</div><div class="mt-1 text-[10px] leading-4 text-slate-500">Use the size you plan to maintain by pruning. Example: enter 2 ft for a hedge kept at 24 inches wide.</div>`;
  const colorLabel=[...panel.querySelectorAll('label')].find(item=>item.textContent?.trim()==='Symbol color');
  const colorBlock=colorLabel?.parentElement;
  if(colorBlock)panel.insertBefore(wrapper,colorBlock);else panel.appendChild(wrapper);
  const input=wrapper.querySelector<HTMLInputElement>('[data-maintained-width-input]')!;
  const summary=wrapper.querySelector<HTMLElement>('[data-maintained-width-summary]')!;
  const commit=()=>{const value=Math.max(.25,Number(input.value)||natural);input.value=String(value);summary.textContent=`Shown as ${value} ft (${Math.round(value*12)} in). Natural mature width: ${natural} ft.`;context.onUpdatePlacedPlant(selected.instanceId,{displayWidthFt:value});};
  input.addEventListener('change',commit);
  wrapper.querySelector<HTMLButtonElement>('[data-reset-maintained-width]')?.addEventListener('click',()=>{input.value=String(natural);summary.textContent=`Shown as ${natural} ft (${Math.round(natural*12)} in). Natural mature width: ${natural} ft.`;context.onUpdatePlacedPlant(selected.instanceId,{displayWidthFt:undefined});});
}

function pruneDriftGaps(plan:GardenPlan,gapFeet:number){
  if(gapFeet<=0)return plan;
  const ppf=plan.scalePixelsPerFoot||20;
  const groups=new Map<string,PlacedPlant[]>();
  for(const plant of plan.placedPlants||[]){if(plant.itemType==='rock'||!plant.notes?.includes('[mergeable]'))continue;const id=driftId(plant);if(!id)continue;const key=`${plant.zone}|${plant.plantId}|${id}`;const list=groups.get(key)||[];list.push(plant);groups.set(key,list);}
  const bySpecies=new Map<string,Array<{key:string;members:PlacedPlant[]}>>();
  for(const[key,members]of groups){if(members.length<2)continue;const first=members[0];const species=`${first.zone}|${first.plantId}`;const list=bySpecies.get(species)||[];list.push({key,members:[...members]});bySpecies.set(species,list);}
  const removed=new Set<string>();
  const center=(members:PlacedPlant[])=>members.reduce((sum,item)=>({x:sum.x+item.x/members.length,y:sum.y+item.y/members.length}),{x:0,y:0});
  const radius=(item:PlacedPlant)=>Math.max(5,((item.displayWidthFt||2)*ppf)/2);
  for(const groupList of bySpecies.values()){
    for(let pass=0;pass<6;pass++)for(let i=0;i<groupList.length;i++)for(let j=i+1;j<groupList.length;j++){
      const a=groupList[i],b=groupList[j];if(a.members.length<2||b.members.length<2)continue;
      const ca=center(a.members),cb=center(b.members),dx=cb.x-ca.x,dy=cb.y-ca.y,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d;
      const projection=(item:PlacedPlant)=>item.x*ux+item.y*uy;
      const centerProjection=(point:{x:number;y:number})=>point.x*ux+point.y*uy;
      const target=gapFeet*ppf*(.78+hash01(`${a.key}|${b.key}`)*.44);
      let edgeA=Math.max(...a.members.map(item=>projection(item)+radius(item)));
      let edgeB=Math.min(...b.members.map(item=>projection(item)-radius(item)));
      while(edgeB-edgeA<target&&(a.members.length>2||b.members.length>2)){
        const faceA=[...a.members].sort((x,y)=>(projection(y)+radius(y))-(projection(x)+radius(x)))[0];
        const faceB=[...b.members].sort((x,y)=>(projection(x)-radius(x))-(projection(y)-radius(y)))[0];
        const protrusionA=edgeA-centerProjection(center(a.members));
        const protrusionB=centerProjection(center(b.members))-edgeB;
        if((protrusionA>=protrusionB&&a.members.length>2)||b.members.length<=2){removed.add(faceA.instanceId);a.members=a.members.filter(item=>item.instanceId!==faceA.instanceId);}else{removed.add(faceB.instanceId);b.members=b.members.filter(item=>item.instanceId!==faceB.instanceId);}
        edgeA=Math.max(...a.members.map(item=>projection(item)+radius(item)));edgeB=Math.min(...b.members.map(item=>projection(item)-radius(item)));
      }
    }
  }
  if(!removed.size)return plan;
  return{...plan,placedPlants:(plan.placedPlants||[]).filter(item=>!removed.has(item.instanceId)),updatedAt:new Date().toISOString()};
}

function installDriftGapControl(host:HTMLElement){if(host.querySelector('[data-drift-gap-control]'))return;const wrapper=document.createElement('div');wrapper.dataset.driftGapControl='true';wrapper.className='mt-3 rounded-xl border border-violet-500/30 bg-slate-950/45 p-2 text-slate-100';const value=Math.max(0,Number(localStorage.getItem(DRIFT_GAP_KEY))||0);wrapper.innerHTML=`<label class="block text-xs">Space between drifts <span class="text-slate-400">(feet, plants are pruned to make the opening)</span><input data-drift-gap-input type="number" min="0" max="20" step="0.5" value="${value}" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white" /></label><div class="mt-1 text-[10px] text-violet-300">0 = let drifts mingle. Higher values remove edge plants instead of shoving whole groups into a botanical traffic pileup.</div>`;const buttons=[...host.querySelectorAll('button')];const advanced=buttons.find(button=>/advanced physics/i.test(button.textContent||''));advanced?.parentElement?.insertBefore(wrapper,advanced);wrapper.querySelector<HTMLInputElement>('[data-drift-gap-input]')?.addEventListener('change',event=>localStorage.setItem(DRIFT_GAP_KEY,String(Math.max(0,Number((event.target as HTMLInputElement).value)||0))));}

export default function RecipeUiCorrections(){
  useEffect(()=>{
    let balancing=false,driftTimer=0,lastGenerationSignature='';
    const rebalance=(changed:HTMLInputElement)=>{if(balancing)return;const host=changed.closest<HTMLElement>('[data-recipe-react-host]'),card=changed.closest<HTMLElement>('div.rounded-xl');if(!host||!card||mixInputFor(card)!==changed)return;const cards=[...host.querySelectorAll<HTMLElement>('div.rounded-xl')],enabled=cards.filter(item=>item.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked),entries=enabled.map(item=>mixInputFor(item)).filter((item):item is HTMLInputElement=>Boolean(item));if(entries.length<2)return;const selected=Math.max(0,Math.min(100,Math.round(Number(changed.value)||0))),others=entries.filter(item=>item!==changed),remaining=100-selected,oldTotal=others.reduce((sum,item)=>sum+Math.max(0,Number(item.value)||0),0);let assigned=0;balancing=true;others.forEach((item,index)=>{const next=index===others.length-1?remaining-assigned:Math.max(0,Math.round(oldTotal>0?remaining*((Number(item.value)||0)/oldTotal):remaining/others.length));assigned+=next;setInputValue(item,next);});if(Number(changed.value)!==selected)setInputValue(changed,selected);balancing=false;};
    const onChange=(event:Event)=>{const target=event.target;if(target instanceof HTMLInputElement&&target.type==='number')rebalance(target);};
    const polish=()=>{document.querySelectorAll<HTMLButtonElement>('button').forEach(button=>{if(button.textContent?.trim()==='Delete'&&button.closest('aside'))button.className='flex-1 px-3 py-2 text-xs font-bold bg-red-600 hover:bg-red-500 text-white border border-red-400 rounded-lg shadow-sm';});document.querySelectorAll<HTMLElement>('[data-recipe-react-host]').forEach(installDriftGapControl);installMaintainedWidthControl();const plan=readPlan();if(!plan)return;const generated=(plan.placedPlants||[]).filter(item=>item.instanceId.startsWith('recipe-run-')),signature=generated.map(item=>item.instanceId).sort().join('|');if(!signature||signature===lastGenerationSignature)return;lastGenerationSignature=signature;window.clearTimeout(driftTimer);driftTimer=window.setTimeout(()=>{const fresh=readPlan(),gap=Math.max(0,Number(localStorage.getItem(DRIFT_GAP_KEY))||0);if(fresh&&gap>0){const pruned=pruneDriftGaps(fresh,gap);if(pruned!==fresh)applyPlan(pruned);}},1800);};
    const observer=new MutationObserver(polish);observer.observe(document.body,{childList:true,subtree:true});const timer=window.setInterval(polish,150);polish();document.addEventListener('change',onChange,false);return()=>{observer.disconnect();window.clearInterval(timer);window.clearTimeout(driftTimer);document.removeEventListener('change',onChange,false);};
  },[]);
  return null;
}
