import { plantRecipes, type RecipeLayer } from './plantRecipes';

export type RecipePhysicsRole=RecipeLayer;
export interface RecipePhysicsProfile{role:RecipePhysicsRole;frontAttraction:number;backAttraction:number;clumpStrength:number;edgeAttraction:number;repetition:string}

const layerDefaults:Record<RecipeLayer,Omit<RecipePhysicsProfile,'role'>>={
  front:{frontAttraction:0.9,backAttraction:0.05,clumpStrength:0.8,edgeAttraction:0.65,repetition:'edge-clumps'},
  middle:{frontAttraction:0.4,backAttraction:0.35,clumpStrength:0.8,edgeAttraction:0.15,repetition:'clumps'},
  back:{frontAttraction:0.05,backAttraction:0.9,clumpStrength:0.5,edgeAttraction:0.55,repetition:'anchors'},
  accent:{frontAttraction:0.15,backAttraction:0.45,clumpStrength:0.2,edgeAttraction:0.05,repetition:'spaced'},
};

function repetitionFor(pattern:string,role:RecipeLayer):string{
  if(pattern.includes('container'))return role==='accent'?'thriller':role==='front'?'spiller':'filler';
  if(pattern.includes('hedge'))return role==='back'?'hedge':role==='front'?'deep-ribbon':role==='middle'?'tight-matrix':'spaced-masses';
  if(pattern.includes('linear')||pattern.includes('pathway')||pattern.includes('driveway'))return role==='front'?'ribbon':role==='back'?'row':'paired-clumps';
  if(pattern.includes('formal')||pattern.includes('symmetry')||pattern.includes('potager'))return role==='accent'?'paired-anchors':role==='front'?'formal-ribbon':'repeated-blocks';
  if(pattern.includes('meadow')||pattern.includes('drift'))return role==='accent'?'isolated':role==='back'?'drifts':role==='front'?'waves':'matrix';
  if(pattern.includes('desert')||pattern.includes('scatter'))return role==='accent'?'isolated':'open-clumps';
  if(pattern.includes('ring'))return role==='front'?'inner-ribbon':role==='back'?'outer-anchors':'ring-clumps';
  return role==='front'?'ribbon':role==='back'?'anchors':role==='accent'?'spaced':'clumps';
}

export function getRecipePhysicsProfile(key:string):RecipePhysicsProfile|undefined{
  const split=key.lastIndexOf(':');if(split<0)return undefined;const recipeId=key.slice(0,split);const plantId=key.slice(split+1);const recipe=plantRecipes.find(item=>item.id===recipeId);const plant=recipe?.plants.find(item=>item.greenAcresPlantId===plantId);if(!recipe||!plant)return undefined;
  const base=layerDefaults[plant.layer];const repetition=repetitionFor(recipe.pattern,plant.layer);let edgeAttraction=base.edgeAttraction;let clumpStrength=plant.clump;
  if(/hedge|row|ribbon|edge|spiller/.test(repetition))edgeAttraction=Math.max(edgeAttraction,0.85);
  if(/isolated|anchor|spaced|thriller/.test(repetition))clumpStrength=Math.min(clumpStrength,0.25);
  if(/matrix|mass|clump|wave|filler/.test(repetition))clumpStrength=Math.max(clumpStrength,0.75);
  return{role:plant.layer,frontAttraction:base.frontAttraction,backAttraction:base.backAttraction,clumpStrength,edgeAttraction,repetition};
}

export const recipePhysicsProfileCount=plantRecipes.reduce((sum,recipe)=>sum+recipe.plants.length,0);
