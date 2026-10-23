import {mount} from '../src/island';
import {examples} from '../fixtures/examples';
const mounted=mount(document.querySelector('#view')!,{turn:1,view:examples[0]});
examples.forEach(view=>{const b=document.createElement('button');b.textContent=view.payload.title;b.onclick=()=>mounted.update({turn:1,view});document.querySelector('#examples')!.append(b);});
