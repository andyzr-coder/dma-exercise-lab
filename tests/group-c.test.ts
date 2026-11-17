import test from 'node:test';
import assert from 'node:assert/strict';
import {type Bit,type Fault,type Delays,bit,mux,muxOrder,nor,sim,simOrder,dCircuit,learning,vector,evaluate,allFaults,matrix,muxMatrix,difference,propagationTrace,equivalenceGroups,representativeColumns,minimumCovers,coverage,greedyNext,anfCoefficients,anfEvaluate,dValue,solveDConstraints,ternaryNand,latchSteady,latchSimulate,defaultDelays,partCoverage} from '../src/labs/group-c-core';

// Independent scalar oracles: no engine gate operators or network descriptions.
function muxOracle(n:number,fault?:Fault) {
  const put=(name:string,value:number)=>fault?.node===name?fault.stuck:value;
  const x=put('x',(n>>2)&1),b=put('b',(n>>1)&1),a=put('a',n&1);
  const c=put('c',x),d=put('d',x),e=put('e',d),f=put('f',d);
  const g=put('g',1-a*c),h=put('h',1-e*f),i=put('i',1-b*h);
  return put('y',1-g*i);
}
function simOracle(n:number,fault?:Fault) {
  const v:Record<string,number>={};
  const set=(name:string,value:number)=>v[name]=fault?.node===name?fault.stuck:value;
  set('a',(n>>3)&1);set('b',(n>>2)&1);set('c',(n>>1)&1);set('d',n&1);
  set('b1',v.b);set('b2',v.b);set('e',v.a||v.b1);set('e1',v.e);set('e2',v.e);
  set('f',1-v.b2);set('g',v.e2*v.c);set('h',v.f*v.d);
  set('i',v.g||v.h);set('y',v.e1*v.i);
  return v;
}
function norOracle(n:number,fault?:Fault) {
  const put=(name:string,value:number)=>fault?.node===name?fault.stuck:value;
  const x1=put('x1',n&1),x2=put('x2',(n>>1)&1),x3=put('x3',(n>>2)&1),x4=put('x4',(n>>3)&1);
  const z1=put('z1',1-x2),z2=put('z2',Number(!(x1||z1))),z3=put('z3',Number(!(x3||x4)));
  const z4=put('z4',Number(!(z2||z3)));
  return put('y',1-z4);
}

test('Group C exposes all six source problems and 28 lettered parts',()=>{
  assert.equal(Object.keys(partCoverage).length,6);
  assert.equal(Object.values(partCoverage).flat().length,28);
  assert.deepEqual(partCoverage['T10-P3'],['d1']);
  assert.deepEqual(partCoverage['T9-P1'],['a','b','c','d','e']);
});

test('T7 mux: all 8 × 22 fault-matrix cells match independent scalar oracle',()=>{
  const faults=allFaults(muxOrder);
  assert.deepEqual(muxMatrix.map(r=>r.good.y),[0,0,1,1,0,1,0,1]);
  for(let n=0;n<8;n++)for(let c=0;c<22;c++) {
    const expected=muxOracle(n,faults[c]);
    assert.equal(muxMatrix[n].outputs[c],expected,'t'+n+' f'+(c+1));
    assert.equal(muxMatrix[n].cover[c],Number(expected!==muxOracle(n)));
  }
});

test('T7 collapsed classes, four exact minimum covers, all 256 CNF assignments and greedy path',()=>{
  assert.deepEqual(equivalenceGroups().filter(g=>g.columns.length>1).map(g=>g.columns.map(c=>c+1)),[[1,7,16],[3,10,17,20],[9,11,13,18],[12,14],[15,19,22]]);
  assert.deepEqual(representativeColumns.map(c=>c+1),[1,2,3,4,5,6,8,9,15,21]);
  assert.deepEqual(minimumCovers().map(v=>v.join(',')).sort(),['1,2,5,6','1,2,6,7','1,3,5,6','1,3,6,7']);
  for(let mask=0;mask<256;mask++){
    const chosen=Array.from({length:8},(_,n)=>n).filter(n=>mask&(1<<n));
    const has=(n:number)=>chosen.includes(n);
    assert.equal(coverage(chosen).length===10,has(1)&&has(6)&&(has(5)||has(7))&&(has(2)||has(3)));
  }
  const chosen:number[]=[];
  for(let i=0;i<4;i++){const next=greedyNext(chosen);assert.notEqual(next.best,null);chosen.push(next.best!);}
  assert.deepEqual(chosen,[1,5,6,2]);assert.equal(greedyNext(chosen).best,null);
});

test('T8 NOR: complete 16 × 18 fault matrix and all node derivatives',()=>{
  const order=['x1','x2','x3','x4','z1','z2','z3','z4','y'];
  for(let n=0;n<16;n++){
    const ip=vector(nor,n),x1=ip.x1,x2=ip.x2,x3=ip.x3,x4=ip.x4;
    assert.equal(evaluate(nor,ip).y,Number((!x1&&x2)||(!x3&&!x4)));
    for(const fault of allFaults(order))assert.equal(evaluate(nor,ip,fault).y,norOracle(n,fault));
    const expected:Record<string,number>={z1:Number(!x1&&(x3||x4)),z2:Number(!!(x3||x4)),z3:Number(x1||!x2),z4:1,x1:Number(x2&&(x3||x4)),x2:Number(!x1&&(x3||x4)),x3:Number(!x4&&(x1||!x2)),x4:Number(!x3&&(x1||!x2))};
    for(const [node,value] of Object.entries(expected))assert.equal(difference(nor,ip,node),value,'t'+n+' '+node);
  }
  const detect=(node:string,stuck:Bit)=>Array.from({length:16},(_,n)=>n).filter(n=>norOracle(n)!==norOracle(n,{node,stuck}));
  assert.deepEqual(detect('z1',0),[4,8,12]);
  assert.deepEqual(detect('z1',1),[6,10,14]);
  assert.deepEqual(detect('z3',0),[0,1,3]);
  assert.deepEqual(detect('z3',1),[4,5,7,8,9,11,12,13,15]);
});

test('ANF coefficients and reconstruction are exact for every four-variable Boolean function',()=>{
  // 65,536 functions × 16 assignments: verifies transform beyond this particular circuit.
  for(let f=0;f<65536;f++){
    const values=Array.from({length:16},(_,n)=>((f>>n)&1) as Bit),coeffs=anfCoefficients(values);
    for(let n=0;n<16;n++)assert.equal(anfEvaluate(coeffs,n),values[n]);
  }
  const values=Array.from({length:16},(_,n)=>norOracle(n) as Bit);
  assert.deepEqual(anfCoefficients(values).map((c,m)=>c?m:-1).filter(m=>m>=0),[0,4,6,7,8,10,11,12,14,15]);
});

test('T9 full 16 × 28 injected-fault matrix and event-driven propagation match separate oracle',()=>{
  const table=matrix(sim,simOrder);
  for(let n=0;n<16;n++)for(const fault of allFaults(simOrder)){
    const v=vector(sim,n),expected=simOracle(n,fault),actual=evaluate(sim,v,fault);
    for(const node of simOrder)assert.equal(actual[node],expected[node],'t'+n+' '+fault.node+'/'+fault.stuck+' node='+node);
    assert.deepEqual(propagationTrace(sim,v,fault).state,actual);
    const c=allFaults(simOrder).findIndex(f=>f.node===fault.node&&f.stuck===fault.stuck);
    assert.equal(table[n].outputs[c],expected.y);
  }
  const ip=vector(sim,13),good=evaluate(sim,ip);
  assert.deepEqual(simOrder.map(n=>good[n]),[1,1,1,1,0,1,1,1,1,0,0,0,0,0]);
  assert.deepEqual(simOrder.filter(n=>difference(sim,ip,n)),['b','b2','c','f','g','h','i','y']);
  assert.deepEqual(allFaults(simOrder).filter(f=>evaluate(sim,ip,f).y!==good.y).map(f=>f.node+'/'+f.stuck),['b/0','b2/0','c/1','f/1','g/1','h/1','i/1','y/1']);
  assert.deepEqual(propagationTrace(sim,ip,{node:'b',stuck:0}).records.filter(r=>r.changed).map(r=>r.node),['b','b1','b2','f','h','i','y']);
  assert.equal(propagationTrace(sim,ip,{node:'e',stuck:0}).state.y,0);
});

test('T5 latch truth table and complete ternary NAND truth table',()=>{
  assert.deepEqual(([0,1,'X'] as const).flatMap(a=>([0,1,'X'] as const).map(b=>ternaryNand(a,b))),[1,1,1,1,0,'X',1,'X','X']);
  for(const q of [0,1] as const){
    assert.equal(latchSteady(1,1,q).q,q);
    assert.equal(latchSteady(0,1,q).q,0);
    assert.equal(latchSteady(1,0,q).q,1);
    assert.equal(latchSteady(0,0,q).valid,false);
    for(const r of [0,1] as const)for(const s of [0,1] as const)assert.equal(latchSteady(r,s,q).q,Number(!s||!!(r*q)));
  }
});

test('T5 source waveform executes at 1, 3, 4 and both output transitions match independent delay sums',()=>{
  const original=latchSimulate(defaultDelays);
  assert.deepEqual(original.map(r=>r.time),[0,1,3,4]);
  assert.deepEqual(original.map(r=>[r.state.Q,r.state.Qn]),[[0,1],[0,1],[1,1],[1,0]]);
  const keys=['a','b','w1','w2','w3','w4','w5','w6'] as const;
  // All 256 zero/one delay assignments, both set and reset: simultaneous zero-delay cases included.
  for(let mask=0;mask<256;mask++){
    const d=Object.fromEntries(keys.map((key,i)=>[key,(mask>>i)&1])) as unknown as Delays;
    for(const initial of [0,1] as const){
      const rows=latchSimulate(d,initial,initial?'r':'s');
      const transition=(node:string)=>rows.find(r=>r.events.some(e=>e.node===node))?.time;
      const expectedQ=initial?1+d.w1+d.a+d.w6+d.b+d.w4:1+d.w2+d.b+d.w4;
      const expectedQn=initial?1+d.w1+d.a+d.w3:1+d.w2+d.b+d.w5+d.a+d.w3;
      assert.equal(transition('Q'),expectedQ,'Q mask='+mask+' init='+initial);
      assert.equal(transition('Qn'),expectedQn,'Qn mask='+mask+' init='+initial);
      assert.equal(rows.at(-1)!.state.Q,1-initial);
    }
  }
});

test('T10 D search validates all eight assignments, two test vectors and reconvergent cancellation',()=>{
  const detects=(node:string)=>Array.from({length:8},(_,n)=>n).filter(n=>{const ip=vector(dCircuit,n);return evaluate(dCircuit,ip).y!==evaluate(dCircuit,ip,{node,stuck:0}).y;});
  assert.deepEqual(detects('a'),[7]);assert.deepEqual(detects('e'),[3]);
  const ip=vector(dCircuit,7),good=evaluate(dCircuit,ip),faulty=evaluate(dCircuit,ip,{node:'e',stuck:0});
  assert.equal(dValue(good.f,faulty.f),'D');assert.equal(dValue(good.g,faulty.g),'D̅');
  assert.equal(good.y,faulty.y);assert.equal(good.y,1);
  assert.equal(dValue(0,0),'0');assert.equal(dValue(1,1),'1');
});

test('T10 local f/0 test cube has exactly eight tests and its free variables are genuinely free',()=>{
  const detected:number[]=[];
  for(let n=0;n<64;n++){
    const ip=vector(learning,n),good=evaluate(learning,ip),faulty=evaluate(learning,ip,{node:'f',stuck:0});
    assert.equal(good.g,Number(!(ip.a||ip.b)));assert.equal(good.k,1);
    assert.equal(good.n,Number(!!(ip.c||ip.e||ip.f)));
    const expected=!ip.c&&!ip.e&&!!ip.f;
    assert.equal(good.n!==faulty.n,expected);
    if(expected)detected.push(n);
  }
  assert.equal(detected.length,8);assert.deepEqual(detected,[1,5,17,21,33,37,49,53]);
});

test('D constraint verifier rejects both optional conflicts and restores candidates after backtracking',()=>{
  const eFault:Fault={node:'e',stuck:0};
  assert.deepEqual(solveDConstraints(dCircuit,eFault,{e:'D',b:'1',c:'1'}),[3,7]);
  assert.deepEqual(solveDConstraints(dCircuit,eFault,{e:'D',b:'1',c:'1',g:'D̅',f:'1'}),[]);
  assert.deepEqual(solveDConstraints(dCircuit,eFault,{e:'D',b:'1',c:'1',g:'D̅',f:'0'}),[3]);
  const fFault:Fault={node:'f',stuck:0};
  const base={f:'D',e:'0',j:'D',m:'0',l:'0'} as const;
  assert.deepEqual(solveDConstraints(learning,fFault,{...base,h:'1'}),[]);
  assert.deepEqual(solveDConstraints(learning,fFault,{...base,h:'0'}),[1,5,17,21,33,37,49,53]);
});
