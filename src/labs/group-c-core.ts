export type Bit = 0 | 1;
export type Tri = Bit | 'X';
export type Op = 'AND' | 'OR' | 'NAND' | 'NOR' | 'XOR' | 'NOT' | 'BUF';
export interface NodeDef { name:string; op:Op; ins:string[] }
export interface Network { inputs:string[]; nodes:NodeDef[]; output:string; }
export interface Fault { node:string; stuck:Bit; }
export const bit=(x:number|boolean):Bit=>x?1:0;
export const inv=(x:Bit):Bit=>x?0:1;
export function op(kind:Op,values:Bit[]):Bit {
  switch(kind) {
    case 'AND': return bit(values.every(Boolean));
    case 'OR': return bit(values.some(Boolean));
    case 'NAND': return bit(!values.every(Boolean));
    case 'NOR': return bit(!values.some(Boolean));
    case 'XOR': return bit(values.reduce<number>((n,x)=>n^x,0));
    case 'NOT': return inv(values[0]);
    case 'BUF': return values[0];
  }
}
export const mux:Network={inputs:['x','b','a'],output:'y',nodes:[
  {name:'c',op:'BUF',ins:['x']},{name:'d',op:'BUF',ins:['x']},
  {name:'e',op:'BUF',ins:['d']},{name:'f',op:'BUF',ins:['d']},
  {name:'g',op:'NAND',ins:['a','c']},{name:'h',op:'NAND',ins:['e','f']},
  {name:'i',op:'NAND',ins:['b','h']},{name:'y',op:'NAND',ins:['g','i']},
]};
export const muxOrder=['a','b','x','c','d','e','f','g','h','i','y'];
export const nor:Network={inputs:['x4','x3','x2','x1'],output:'y',nodes:[
  {name:'z1',op:'NOT',ins:['x2']},{name:'z2',op:'NOR',ins:['x1','z1']},
  {name:'z3',op:'NOR',ins:['x3','x4']},{name:'z4',op:'NOR',ins:['z2','z3']},
  {name:'y',op:'NOT',ins:['z4']},
]};
export const sim:Network={inputs:['a','b','c','d'],output:'y',nodes:[
  {name:'b1',op:'BUF',ins:['b']},{name:'b2',op:'BUF',ins:['b']},
  {name:'e',op:'OR',ins:['a','b1']},{name:'e1',op:'BUF',ins:['e']},{name:'e2',op:'BUF',ins:['e']},
  {name:'f',op:'NOT',ins:['b2']},{name:'g',op:'AND',ins:['e2','c']},
  {name:'h',op:'AND',ins:['f','d']},{name:'i',op:'OR',ins:['g','h']},{name:'y',op:'AND',ins:['e1','i']},
]};
export const simOrder=['a','b','b1','b2','c','d','e','e1','e2','f','g','h','i','y'];
export const dCircuit:Network={inputs:['a','b','c'],output:'y',nodes:[
  {name:'d',op:'AND',ins:['a','b']},{name:'e',op:'AND',ins:['b','c']},
  {name:'f',op:'AND',ins:['d','e']},{name:'g',op:'NAND',ins:['e','c']},{name:'y',op:'XOR',ins:['f','g']},
]};
export const learning:Network={inputs:['a','b','c','d','e','f'],output:'n',nodes:[
  {name:'g',op:'NOR',ins:['a','b']},{name:'k',op:'NAND',ins:['g','b']},
  {name:'h',op:'OR',ins:['c','e']},{name:'i',op:'OR',ins:['c','d','e']},
  {name:'j',op:'OR',ins:['e','f']},{name:'l',op:'AND',ins:['h','i']},
  {name:'m',op:'AND',ins:['k','h']},{name:'n',op:'OR',ins:['m','l','j']},
]};
export function names(net:Network):string[] {return [...net.inputs,...net.nodes.map(n=>n.name)];}
export function vector(net:Network,n:number):Record<string,Bit> {
  return Object.fromEntries(net.inputs.map((name,i)=>[name,bit((n>>(net.inputs.length-1-i))&1)]));
}
export function evaluate(net:Network,inputs:Record<string,Bit>,fault?:Fault):Record<string,Bit> {
  const state:Record<string,Bit>={};
  for(const name of net.inputs) state[name]=fault?.node===name?fault.stuck:inputs[name];
  for(const n of net.nodes) state[n.name]=fault?.node===n.name?fault.stuck:op(n.op,n.ins.map(i=>state[i]));
  return state;
}
export const allFaults=(order:string[]):Fault[]=>order.flatMap(node=>[0,1].map(stuck=>({node,stuck:stuck as Bit})));
export const faultKey=(f:Fault)=>f.node+'/'+f.stuck;
export function difference(net:Network,inputs:Record<string,Bit>,node:string):Bit {
  return bit(evaluate(net,inputs,{node,stuck:0})[net.output]!==evaluate(net,inputs,{node,stuck:1})[net.output]);
}
export function propagationTrace(net:Network,inputs:Record<string,Bit>,fault:Fault) {
  const state=evaluate(net,inputs),records:{node:string;before:Bit;after:Bit;changed:boolean;cause:string}[]=[];
  const before=state[fault.node];state[fault.node]=fault.stuck;
  records.push({node:fault.node,before,after:fault.stuck,changed:before!==fault.stuck,cause:'故障注入'});
  const queue=new Set<string>();
  const enqueue=(source:string)=>net.nodes.filter(n=>n.ins.includes(source)).forEach(n=>queue.add(n.name));
  if(before!==fault.stuck)enqueue(fault.node);
  while(queue.size) {
    const node=net.nodes.find(n=>queue.has(n.name))!;queue.delete(node.name);
    const before=state[node.name],after=node.name===fault.node?fault.stuck:op(node.op,node.ins.map(k=>state[k]));
    state[node.name]=after;records.push({node:node.name,before,after,changed:before!==after,cause:node.op+'('+node.ins.map(k=>k+'='+state[k]).join(', ')+')'});
    if(before!==after)enqueue(node.name);
  }
  return {records,state};
}
export function matrix(net:Network,order:string[]) {
  const faults=allFaults(order);
  return Array.from({length:2**net.inputs.length},(_,n)=>{
    const input=vector(net,n),good=evaluate(net,input);
    const outputs=faults.map(f=>evaluate(net,input,f)[net.output]);
    return {n,input,good,outputs,cover:outputs.map(v=>bit(v!==good[net.output]))};
  });
}
export const muxMatrix=matrix(mux,muxOrder);
export function equivalenceGroups() {
  const groups=new Map<string,number[]>();
  for(let i=0;i<22;i++) {const key=muxMatrix.map(r=>r.cover[i]).join('');groups.set(key,[...(groups.get(key)||[]),i]);}
  return [...groups.entries()].map(([signature,columns])=>({signature,columns,detectable:signature.includes('1')}));
}
export const representativeColumns=equivalenceGroups().filter(g=>g.detectable).map(g=>g.columns[0]).sort((a,b)=>a-b);
export function coverage(selected:number[],columns=representativeColumns) {
  return columns.filter(c=>selected.some(row=>muxMatrix[row].cover[c]));
}
export function greedyNext(selected:number[],columns=representativeColumns) {
  const covered=coverage(selected,columns),remaining=columns.filter(c=>!covered.includes(c));
  const scores=Array.from({length:8},(_,n)=>({n,count:selected.includes(n)?0:remaining.filter(c=>muxMatrix[n].cover[c]).length}));
  const best=[...scores].sort((a,b)=>b.count-a.count||a.n-b.n)[0];
  return {scores,best:best.count?best.n:null,remaining};
}
export function minimumCovers():number[][] {
  const valid:number[][]=[];
  for(let mask=0;mask<256;mask++) {
    const selected=Array.from({length:8},(_,i)=>i).filter(i=>(mask>>i)&1);
    if(coverage(selected).length===representativeColumns.length)valid.push(selected);
  }
  const min=Math.min(...valid.map(v=>v.length));
  return valid.filter(v=>v.length===min);
}
export function anfCoefficients(values:Bit[]):Bit[] {
  const result=[...values],count=Math.log2(values.length);
  for(let b=0;b<count;b++)for(let mask=0;mask<values.length;mask++)if(mask&(1<<b))result[mask]=bit(result[mask]^result[mask^(1<<b)]);
  return result;
}
export function anfEvaluate(coefficients:Bit[],mask:number):Bit {
  return bit(coefficients.reduce<number>((v,c,m)=>v^(c&&((mask&m)===m)?1:0),0));
}
export function dValue(good:Bit,bad:Bit):string {return good===bad?String(good):good?'D':'D̅';}
export type DSymbol='0'|'1'|'D'|'D̅';
export function solveDConstraints(net:Network,fault:Fault,constraints:Record<string,DSymbol>):number[] {
  return Array.from({length:2**net.inputs.length},(_,n)=>n).filter(n=>{
    const input=vector(net,n),good=evaluate(net,input),bad=evaluate(net,input,fault);
    return Object.entries(constraints).every(([node,value])=>dValue(good[node],bad[node])===value);
  });
}
export function ternaryNand(a:Tri,b:Tri):Tri {
  const results=new Set((a==='X'?[0,1]:[a]).flatMap(x=>(b==='X'?[0,1]:[b]).map(y=>Number(!(x&&y)))));
  return results.size===1?[...results][0] as Bit:'X';
}
export function latchSteady(r:Bit,s:Bit,previous:Bit) {
  if(!r&&!s)return {q:1 as Bit,qn:1 as Bit,valid:false,mode:'禁止输入：释放到11后不能保证状态'};
  const q:Bit=!s?1:!r?0:previous;
  return {q,qn:inv(q),valid:true,mode:!s?'置位':!r?'复位':'保持'};
}
export interface Delays {a:number;b:number;w1:number;w2:number;w3:number;w4:number;w5:number;w6:number}
export const defaultDelays:Delays={a:1,b:2,w1:0,w2:0,w3:0,w4:0,w5:0,w6:0};
export interface LatchEvent {node:string;value:Bit;generated:number;time:number;sequence:number}
export interface LatchRow {time:number;events:LatchEvent[];scheduled:LatchEvent[];state:Record<string,Bit>}
export function latchSimulate(delays:Delays,initial:Bit=0,signal:'r'|'s'='s',value:Bit=0,at=1):LatchRow[] {
  const d=Object.fromEntries(Object.entries(delays).map(([k,v])=>[k,Math.max(0,Math.floor(v))])) as unknown as Delays;
  const state:Record<string,Bit>={r:1,s:1,ra:1,sb:1,fa:initial,fb:inv(initial),A:inv(initial),B:initial,Qn:inv(initial),Q:initial};
  let sequence=0;
  const queue:LatchEvent[]=[{node:signal,value,generated:0,time:at,sequence:sequence++}];
  const rows:LatchRow[]=[{time:0,events:[],scheduled:[{...queue[0]}],state:{...state}}];
  let guard=0;
  while(queue.length&&guard++<500) {
    queue.sort((a,b)=>a.time-b.time||a.sequence-b.sequence);
    const time=queue[0].time,events:LatchEvent[]=[],scheduled:LatchEvent[]=[];
    const schedule=(node:string,value:Bit,delay:number)=>{
      if(state[node]===value&&!queue.some(e=>e.node===node&&e.value!==value))return;
      const e={node,value,generated:time,time:time+delay,sequence:sequence++};queue.push(e);scheduled.push(e);
    };
    while(queue.some(e=>e.time===time)&&guard++<500) {
      queue.sort((a,b)=>a.time-b.time||a.sequence-b.sequence);
      const event=queue.shift()!;
      if(state[event.node]===event.value)continue;
      state[event.node]=event.value;events.push(event);
      switch(event.node) {
        case 'r':schedule('ra',state.r,d.w1);break;
        case 's':schedule('sb',state.s,d.w2);break;
        case 'ra':case 'fa':schedule('A',op('NAND',[state.ra,state.fa]),d.a);break;
        case 'sb':case 'fb':schedule('B',op('NAND',[state.sb,state.fb]),d.b);break;
        case 'A':schedule('Qn',state.A,d.w3);schedule('fb',state.A,d.w6);break;
        case 'B':schedule('Q',state.B,d.w4);schedule('fa',state.B,d.w5);break;
      }
    }
    if(events.length)rows.push({time,events,scheduled,state:{...state}});
  }
  return rows;
}
export const partCoverage:Record<string,string[]>={'T5-P1':['a','b','c','d','e'],'T7-P1':['a','b','c','d','e','f','g'],'T8-P1':['a','b','c','d','e','f'],'T9-P1':['a','b','c','d','e'],'T10-P2':['a','b','c','d'],'T10-P3':['d1']};
