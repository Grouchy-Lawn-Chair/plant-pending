(() => {
  const CURRENT_PLAN_KEY = 'garden-planner-current';
  const TOAST_KEY = 'plant-pending-recipe-toast';

  const recipes = [
    { id:'gardenia-provencal-courtyard', name:'A Contemporary Provencal Courtyard', plants:[[811,'Deer Grass',55,'back',48],[860,'Fruity Germander',45,'front',30]] },
    { id:'gardenia-soft-autumn-colors', name:'Soft Autumn Colors', plants:[[506,"Sedum 'Autumn Fire'",35,'front',24],[781,"Coast Rosemary 'Blue Gem'",35,'back',48],[343,'Silver Carpet',30,'front',24]] },
    { id:'gardenia-brilliant-summer-border', name:'Brilliant Summer Border', plants:[[729,"Bottlebrush 'Little John'",30,'back',36],[285,'Bright Lights Horizon Sunset African Daisy',45,'middle',24],[792,"Cordyline 'Electric Pink'",25,'accent',36]] },
    { id:'gardenia-successful-marriage', name:'A Successful Marriage', plants:[[399,'Northern Lights Tufted Hair Grass',45,'middle',24],[860,'Fruity Germander',30,'front',30],[277,'Blue Fescue',25,'front',18]] },
    { id:'gardenia-mediterranean-border', name:'A Pretty Mediterranean Border Idea', plants:[[860,'Fruity Germander',16,'front',30],[937,"Lily of the Nile 'Storm Cloud'",14,'back',36],[277,'Blue Fescue',14,'front',18],[285,'Bright Lights Horizon Sunset African Daisy',14,'front',24],[729,"Bottlebrush 'Little John'",14,'accent',36],[781,"Coast Rosemary 'Blue Gem'",14,'back',48],[312,"Coreopsis 'Nana'",14,'middle',24]] },
    { id:'gardenia-backyard-retreat', name:'Backyard Retreat with Achillea, Festuca and Grasses', plants:[[574,"Yarrow 'Little Moonshine'",35,'middle',24],[277,'Blue Fescue',30,'front',18],[399,'Northern Lights Tufted Hair Grass',35,'back',24]] },
    { id:'gardenia-desert-pollinator', name:'Native Desert Pollinator Garden', plants:[[444,"Lomandra 'Lime Tuff'",20,'accent',36],[729,"Bottlebrush 'Little John'",25,'back',36],[399,'Northern Lights Tufted Hair Grass',30,'middle',24],[312,"Coreopsis 'Nana'",25,'front',24]] },
    { id:'gardenia-butterfly-friendly', name:'Butterfly-Friendly Garden Design', plants:[[312,"Coreopsis 'Nana'",25,'front',24],[781,"Coast Rosemary 'Blue Gem'",20,'back',48],[370,"Feather Reed Grass 'Karl Foerster'",15,'back',30],[506,"Sedum 'Autumn Fire'",20,'middle',24],[277,'Blue Fescue',20,'front',18]] },
    { id:'gardenia-grasses-sage', name:'A Fabulous Planting Idea with Grasses and Sage', plants:[[399,'Northern Lights Tufted Hair Grass',60,'middle',24],[781,"Coast Rosemary 'Blue Gem'",40,'back',48]] },
    { id:'gardenia-salvia-caradonna', name:"Salvia 'Caradonna' Plant Profile", plants:[[781,"Coast Rosemary 'Blue Gem'",100,'middle',48]] },
    { id:'gardenia-summer-fall-border', name:'Summer-to-Fall Perennial Border', plants:[[729,"Bottlebrush 'Little John'",20,'accent',36],[781,"Coast Rosemary 'Blue Gem'",20,'back',48],[285,'Bright Lights Horizon Sunset African Daisy',20,'middle',24],[277,'Blue Fescue',20,'front',18],[374,'Firehouse Verbena',20,'front',30]] },
    { id:'elegant-privacy-hedge-border', name:'Elegant Privacy Hedge Border', plants:[[475,'Rose Sea Thrift',30,'front',12],[683,"Hydrangea 'Little Lime Punch'",30,'middle',48],[912,'Eau de Parfum Blush Rose',25,'accent',48],[657,"Emerald Green Arborvitae 'Smaragd'",15,'back',48]] },
    { id:'modern-meadow', name:'Modern Meadow', plants:[[399,'Northern Lights Tufted Hair Grass',28,'back',24],[311,'Butterfly Weed',22,'middle',24],[781,"Coast Rosemary 'Blue Gem'",20,'middle',48],[312,"Coreopsis 'Nana'",30,'front',24]] },
    { id:'hummingbird-oasis', name:'Hummingbird Oasis', plants:[[749,"Rose of Sharon 'Blue Chiffon'",22,'back',48],[412,'Lantana',17,'middle',36],[374,'Firehouse Verbena',31,'front',30],[781,"Coast Rosemary 'Blue Gem'",30,'middle',48]] },
    { id:'fire-pit', name:'Fire Pit', plants:[[721,'Dwarf Korean Lilac',12,'accent',48],[312,"Coreopsis 'Nana'",28,'middle',24],[662,"Dwarf Yaupon Holly 'Schillings'",14,'back',36],[506,"Sedum 'Autumn Fire'",12,'front',24],[860,'Fruity Germander',24,'middle',30],[277,'Blue Fescue',10,'front',18]] },
    { id:'fenceline-flow', name:'Fenceline Flow', plants:[[525,'Hosta',28,'middle',36],[37,'Japanese Maple',20,'accent',72],[384,'Japanese Sedge',27,'front',24],[371,'Coral Bells',25,'front',21]] },
    { id:'delightful-drought-tolerant', name:'Delightful and Drought-Tolerant', plants:[[94,'Chaste Tree',18,'back',60],[399,'Northern Lights Tufted Hair Grass',30,'middle',24],[312,"Coreopsis 'Nana'",24,'middle',24],[860,'Fruity Germander',28,'front',30]] }
  ];

  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const randomFor = seed => { let value = seed >>> 0; return () => { value += 0x6D2B79F5; let t=value; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; };
  const inside = (p, poly) => { let hit=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<((b.x-a.x)*(p.y-a.y))/((b.y-a.y)||1e-9)+a.x)hit=!hit;} return hit; };
  const area = points => Math.abs(points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a.x*b.y-b.x*a.y;},0))/2;
  const distanceToSegment=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len));return Math.hypot(p.x-(a.x+dx*t),p.y-(a.y+dy*t));};
  const edgeDistance=(p,zone,indexes)=>!indexes?.length?Infinity:Math.min(...indexes.map(i=>distanceToSegment(p,zone.points[i],zone.points[(i+1)%zone.points.length])));
  const polygonEdgeDistance=(p,poly)=>Math.min(...poly.map((a,i)=>distanceToSegment(p,a,poly[(i+1)%poly.length])));

  function generate(plan, zone, recipe) {
    const ppf=plan.scalePixelsPerFoot||20, seed=zone.plantingSeed||Math.floor(Math.random()*99999), rand=randomFor(seed+recipe.id.length*97);
    const bounds={minX:Math.min(...zone.points.map(p=>p.x)),maxX:Math.max(...zone.points.map(p=>p.x)),minY:Math.min(...zone.points.map(p=>p.y)),maxY:Math.max(...zone.points.map(p=>p.y))};
    const avg=recipe.plants.reduce((s,p)=>s+p[4]*p[2],0)/recipe.plants.reduce((s,p)=>s+p[2],0), density=Math.max(10,Math.min(100,zone.density||50))/100;
    const target=Math.max(recipe.plants.length,Math.min(140,Math.round((area(zone.points)/Math.max(180,(avg/12*ppf)**2*.58))*(.45+density*1.15))));
    const counts=recipe.plants.map(p=>Math.max(1,Math.round(target*p[2]/100))); while(counts.reduce((a,b)=>a+b,0)>target){const i=counts.findIndex(c=>c>1);if(i<0)break;counts[i]--;}
    const exclusions=(plan.zones||[]).filter(z=>z.zoneType==='exclusion'&&z.points?.length>=3), generated=[];
    const ordered=recipe.plants.flatMap((p,i)=>Array.from({length:counts[i]},()=>p)).sort((a,b)=>({back:0,accent:1,middle:2,front:3}[a[3]]-({back:0,accent:1,middle:2,front:3}[b[3]])));
    for(const item of ordered){const radius=Math.max(6,(item[4]/12*ppf)/2);let best=null;for(let a=0;a<500;a++){const p={x:bounds.minX+rand()*(bounds.maxX-bounds.minX),y:bounds.minY+rand()*(bounds.maxY-bounds.minY)};if(!inside(p,zone.points)||polygonEdgeDistance(p,zone.points)<radius*.38||exclusions.some(z=>inside(p,z.points)))continue;const nearest=generated.reduce((m,q)=>Math.min(m,Math.hypot(p.x-q.x,p.y-q.y)-(q._r+radius)),Infinity);const spacing=nearest<-Math.min(radius,16)?10000:nearest<0?Math.abs(nearest)*8:0;const front=edgeDistance(p,zone,zone.edgeRoles?.front),back=edgeDistance(p,zone,zone.edgeRoles?.back);let layer=0;if(item[3]==='front')layer=Number.isFinite(front)?front:bounds.maxY-p.y;else if(item[3]==='back')layer=Number.isFinite(back)?back:p.y-bounds.minY;else if(item[3]==='middle')layer=Number.isFinite(front)&&Number.isFinite(back)?Math.abs(front-back):Math.abs(p.y-(bounds.minY+bounds.maxY)/2);const score=layer+spacing+rand()*8;if(!best||score<best.score)best={p,score};if(score<8)break;}if(best)generated.push({instanceId:uid(),plantId:item[0],x:best.p.x,y:best.p.y,zone:zone.id,notes:`Recipe: ${recipe.name}`,displayMode:'symbol',customColor:null,itemType:'plant',rotationDeg:Math.round(rand()*359),_r:radius});}
    return generated.map(({_r,...p})=>p);
  }

  function toast(message){const el=document.createElement('div');el.style.cssText='position:fixed;right:24px;bottom:24px;z-index:9999;max-width:420px;padding:14px 16px;border:1px solid #34d399;background:#052e2b;color:#d1fae5;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.35);font:600 13px/1.4 Inter,Arial,sans-serif';el.textContent=message;document.body.append(el);setTimeout(()=>el.remove(),6500);}

  function injectPanel(){
    const dialogs=[...document.querySelectorAll('div')].filter(el=>el.textContent?.includes('Zone settings')&&el.textContent?.includes('Planting type'));
    const modal=dialogs.sort((a,b)=>a.querySelectorAll('*').length-b.querySelectorAll('*').length)[0];
    if(!modal||modal.querySelector('#pp-recipe-zone-panel'))return;
    const plantingLabel=[...modal.querySelectorAll('label')].find(el=>el.textContent.trim()==='Planting type');
    const plantingCard=plantingLabel?.closest('div.rounded-2xl');
    const content=plantingCard?.parentElement;
    if(!plantingCard||!content)return;

    const panel=document.createElement('section');panel.id='pp-recipe-zone-panel';panel.style.cssText='border:1px solid rgba(167,139,250,.48);background:rgba(76,29,149,.18);border-radius:16px;padding:14px;color:#f8fafc';
    panel.innerHTML=`<div style="font-size:10px;text-transform:uppercase;letter-spacing:.17em;color:#c4b5fd;font-weight:800">Plant recipe</div><div style="margin-top:4px;font-size:14px;font-weight:800">Choose a recipe</div><label style="display:block;margin-top:12px;font-size:11px;color:#cbd5e1">Recipe<select id="pp-recipe-select" style="display:block;width:100%;margin-top:5px;border:1px solid #475569;background:#0f172a;color:white;border-radius:10px;padding:9px"></select></label><div id="pp-recipe-plants" style="margin-top:10px;font-size:11px;line-height:1.5;color:#cbd5e1"></div><button id="pp-generate-recipe" type="button" style="width:100%;margin-top:12px;border:0;background:#7c3aed;color:white;border-radius:12px;padding:11px;font-weight:800;cursor:pointer">Generate recipe</button><div style="margin-top:8px;font-size:10px;color:#a5b4fc">Uses reviewed Green Acres plants, recipe percentages, the zone seed, and marked front/back edges. Plants remain editable.</div>`;
    content.insertBefore(panel,plantingCard);
    const select=panel.querySelector('#pp-recipe-select'),plantList=panel.querySelector('#pp-recipe-plants');select.innerHTML=recipes.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
    const render=()=>{const r=recipes.find(x=>x.id===select.value);plantList.textContent=r?r.plants.map(p=>`${p[1]} ${p[2]}%`).join(' · '):'';};select.addEventListener('change',render);render();
    panel.querySelector('#pp-generate-recipe').addEventListener('click',()=>{const chosen=recipes.find(r=>r.id===select.value),raw=localStorage.getItem(CURRENT_PLAN_KEY);if(!chosen||!raw)return toast('Make one change to the plan, then try again.');let plan;try{plan=JSON.parse(raw);}catch{return toast('The current plan could not be read.');}const zoneName=modal.querySelector('h3')?.textContent.trim(),zone=(plan.zones||[]).find(z=>z.name===zoneName);if(!zone)return toast('The selected zone could not be found.');const groupId=`recipe-${chosen.id}`,group={id:groupId,name:`Recipe · ${chosen.name}`,notes:'Reviewed recipe',plantIds:[...new Set(chosen.plants.map(p=>p[0]))]};plan.plantingGroups=[...(plan.plantingGroups||[]).filter(g=>g.id!==groupId),group];Object.assign(zone,{plantingGroupId:groupId,plantingGroupName:group.name,plantingRecipeId:chosen.id,plantingRecipeName:chosen.name,layoutMode:'fill',plantingType:'flowerBed',plantVariety:'low',plantingSeed:zone.plantingSeed||Math.floor(Math.random()*99999)});const generated=generate(plan,zone,chosen);plan.placedPlants=[...(plan.placedPlants||[]).filter(p=>p.zone!==zone.id||p.itemType==='rock'),...generated];localStorage.setItem(CURRENT_PLAN_KEY,JSON.stringify(plan));sessionStorage.setItem(TOAST_KEY,`${chosen.name} generated in ${zone.name}: ${generated.length} editable plants.`);location.reload();});
  }

  const saved=sessionStorage.getItem(TOAST_KEY);if(saved){sessionStorage.removeItem(TOAST_KEY);setTimeout(()=>toast(saved),900);}new MutationObserver(injectPanel).observe(document.documentElement,{childList:true,subtree:true});setInterval(injectPanel,300);
})();
