import { useEffect } from 'react';

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

export default function RecipeUiCorrections(){
  useEffect(()=>{
    let balancing=false;
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
      const others=entries.filter(item=>item.input!==changed);
      const remaining=100-selected;
      const oldTotal=others.reduce((sum,item)=>sum+Math.max(0,Number(item.input.value)||0),0);
      let assigned=0;
      balancing=true;
      others.forEach((item,index)=>{
        const next=index===others.length-1
          ? remaining-assigned
          : Math.max(0,Math.round(oldTotal>0?remaining*((Number(item.input.value)||0)/oldTotal):remaining/others.length));
        assigned+=next;
        setInputValue(item.input,next);
      });
      if(Number(changed.value)!==selected)setInputValue(changed,selected);
      balancing=false;
    };
    const onChange=(event:Event)=>{const target=event.target;if(target instanceof HTMLInputElement&&target.type==='number')rebalance(target);};
    document.addEventListener('change',onChange,true);
    return()=>document.removeEventListener('change',onChange,true);
  },[]);
  return null;
}
