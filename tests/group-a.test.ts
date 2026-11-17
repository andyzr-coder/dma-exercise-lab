import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import GroupA from '../src/labs/GroupA';
import {
  absorb, allPrimes, bddPaths, bddTrace, buildBdd, compareCover, consensus,
  coveredPoints, covers, cubeTex, groupACoverage, inputs, literalCount,
  minimumCovers, parseCover, posFromComplement, primesT2, quineMerge,
  quineSteps, referenceHeuristic, referenceT1P3, referenceT2,
  resolutionClosure, resolutionExamples, sopTex,
} from '../src/labs/groupACore';

const sorted = (xs:string[]) => [...xs].sort();
const names = ['x','y','z','w'];
const allCubes = (n:number):string[] => n ? allCubes(n-1).flatMap(s=>['0','1','*'].map(c=>s+c)) : [''];
const perms = (xs:number[]):number[][] => xs.length ? xs.flatMap(x=>perms(xs.filter(y=>y!==x)).map(p=>[x,...p])) : [[]];

test('all original four-variable and three-variable functions match independent Boolean expressions',()=>{
  const direct:Record<string,(x:boolean,y:boolean,z:boolean,w:boolean)=>boolean>={
    f1:(x,y,z,w)=>(y&&z&&w)||(x&&y&&z&&!w)||(!x&&!y&&w)||(!x&&!z&&w)||(!y&&!z&&!w),
    f2:(x,y,z,w)=>(y&&z&&w)||(x&&y&&z)||(!x&&y&&z&&!w)||(x&&!z&&!w)||(!x&&!y&&!z),
    f3:(x,y,z,w)=>(!x&&z&&w)||(y&&!z&&w)||(!x&&!y&&w)||(x&&!y&&!z)||(x&&!z&&!w),
    f4:(x,y,z)=>(x&&y)||(y&&z)||(!x&&!y)||(!y&&!z),
  };
  for(const [name,cs] of Object.entries(resolutionExamples)) for(const bits of inputs(cs[0].length)) {
    const [x,y,z,w]=[...bits].map(v=>v==='1');
    assert.equal(evaluateDirect(cs,bits),Number(direct[name](x,y,z,w)),`${name}(${bits})`);
  }
  for(const bits of inputs(3)) {
    const [x,y,z]=[...bits].map(v=>v==='1');
    assert.equal(evaluateDirect(referenceT1P3,bits),Number(!z||(x&&y)));
    assert.equal(evaluateDirect(referenceHeuristic,bits),Number((!x&&y)||(x&&y&&z)||(!x&&!y&&!z)));
  }
  assert.deepEqual(coveredPoints(referenceT2,4).map(x=>parseInt(x,2)),[0,1,3,5,7,8,14,15]);
});

// Independent point-set oracle: no implementation helper is used here.
function evaluateDirect(cs:string[],bits:string) {
  return Number(cs.some(c=>Array.from({length:bits.length},(_,i)=>c[i]==='*'||c[i]===bits[i]).every(Boolean)));
}

test('Quine union and consensus implication hold for every pair of all 81 four-variable cubes',()=>{
  const cubes=allCubes(4);
  for(const a of cubes) for(const b of cubes) {
    const merged=quineMerge(a,b),term=consensus(a,b);
    for(const bits of inputs(4)) {
      const original=evaluateDirect([a,b],bits);
      if(merged)assert.equal(evaluateDirect([merged],bits),original,`${a}+${b} -> ${merged} @ ${bits}`);
      if(term)assert.equal(evaluateDirect([a,b,term],bits),original,`${a},${b} consensus ${term} @ ${bits}`);
    }
  }
  assert.equal(quineMerge('0*0','00*'),null);
  assert.equal(consensus('00','11'),null);
  assert.equal(consensus('0*','11'),'*1');
});

test('all 256 three-variable functions: Quine and resolution both produce precisely the maximal implicants',()=>{
  const minterms=inputs(3);
  for(let mask=0;mask<256;mask++) {
    const on=minterms.filter((_,i)=>mask&(1<<i));
    const primes=allPrimes(on,3);
    assert.deepEqual(sorted(quineSteps(on,3).primes),primes,`Quine mask=${mask}`);
    const layers=resolutionClosure(on);
    assert.deepEqual(layers.at(-1),primes,`resolution mask=${mask}`);
    for(const layer of layers)assert.equal(compareCover(layer,on,3).equal,true);
    // Check maximality independently: each fixed-literal deletion must cover an off-set point.
    for(const p of primes)for(let i=0;i<3;i++)if(p[i]!=='*') {
      const larger=p.slice(0,i)+'*'+p.slice(i+1);
      assert.ok(minterms.some(s=>evaluateDirect([larger],s)&&!evaluateDirect(on,s)));
    }
  }
});

test('worked CompSOPs, Quine layers, essentials, and unique minimum match workbook answers',()=>{
  const expected:Record<string,string[]>={
    f1:['*000','*111','0**1','000*','111*'],
    f2:['*000','*11*','000*','1*00','11*0'],
    f3:['**01','0**1','1*0*'],
    f4:['*00','*11','0*1','00*','1*0','11*'],
  };
  for(const [name,cs] of Object.entries(resolutionExamples)) {
    assert.deepEqual(allPrimes(cs,cs[0].length),sorted(expected[name]));
    assert.deepEqual(resolutionClosure(cs).at(-1),sorted(expected[name]));
  }
  const steps=quineSteps(referenceT2,4);
  assert.deepEqual(steps.layers.map(l=>l.length),[8,8,1]);
  assert.deepEqual(sorted(steps.primes),sorted(primesT2));
  const minimum=minimumCovers(primesT2,referenceT2,4);
  assert.equal(minimum.length,1);
  assert.deepEqual(sorted(minimum[0]),sorted(['*000','111*','0**1']));
  assert.equal(literalCount(minimum[0]),8);
  assert.equal(literalCount(referenceT2)-literalCount(minimum[0]),24);
  const essential=primesT2.filter(p=>inputs(4).some(s=>covers(p,s)&&primesT2.filter(q=>covers(q,s)).length===1));
  assert.deepEqual(sorted(essential),sorted(minimum[0]));
  assert.equal(compareCover(['0*0','1*0','11*'],referenceT1P3,3).equal,true);
  assert.equal(compareCover(['**0','11*'],referenceT1P3,3).equal,true);
});

test('heuristic legal expansion/removal path preserves all 8 inputs; illegal expansion returns exact witness',()=>{
  const path=[referenceHeuristic,['01*','*11','000'],['01*','*11','0*0'],['*11','0*0']];
  assert.deepEqual(path.map(literalCount),[8,7,6,4]);
  for(const cs of path)assert.equal(compareCover(cs,referenceHeuristic,3).equal,true);
  const bad=compareCover(['01*','11*','000'],referenceHeuristic,3);
  assert.deepEqual(bad,{equal:false,missing:[],extra:['110']});
  const missing=compareCover(['01*','111'],referenceHeuristic,3);
  assert.deepEqual(missing.missing,['000']);
  const optimal=minimumCovers(allPrimes(referenceHeuristic,3),referenceHeuristic,3);
  assert.ok(optimal.every(cs=>cs.length===2&&literalCount(cs)===4));
});

test('all 256 three-variable functions and all 6 variable orders: BDDs, complements and path cubes match all inputs',()=>{
  const minterms=inputs(3);
  for(let mask=0;mask<256;mask++)for(const order of perms([0,1,2]))for(const complement of [false,true]) {
    const on=minterms.filter((_,i)=>mask&(1<<i));
    const bdd=buildBdd(on,names.slice(0,3),order,complement);
    const paths=bddPaths(bdd,1);
    for(const bits of minterms) {
      const expected=evaluateDirect(on,bits)^Number(complement);
      assert.equal(bddTrace(bdd,bits).output,expected);
      assert.equal(evaluateDirect(paths,bits),expected);
    }
    assert.equal(new Set(bdd.nodes.map(n=>`${n.variable},${n.low},${n.high}`)).size,bdd.nodes.length);
    assert.ok(bdd.nodes.every(n=>n.low!==n.high));
  }
});

test('specific ROBDD orders, deleted y, full trees, terminal swaps and POS expansions match the exercise',()=>{
  for(const name of ['f3','f4']) {
    const cs=resolutionExamples[name],n=cs[0].length,order=name==='f3'?[1,0,2,3]:[0,1,2];
    for(const reduced of [true,false])for(const complement of [false,true]) {
      const bdd=buildBdd(cs,names.slice(0,n),order,complement,reduced);
      for(const bits of inputs(n))assert.equal(bddTrace(bdd,bits).output,evaluateDirect(cs,bits)^Number(complement));
      if(!reduced)assert.equal(bdd.nodes.length,2**n-1);
      if(reduced&&name==='f3')assert.ok(bdd.nodes.every(node=>node.variable!==1));
      if(reduced&&name==='f4')assert.equal(bdd.nodes.length,5);
    }
    const complement=buildBdd(cs,names.slice(0,n),order,true),paths=bddPaths(complement,1);
    assert.equal(paths.length,2);
    const pos=posFromComplement(paths,names.slice(0,n));
    assert.equal(compareCover(pos.expanded,cs,n).equal,true);
    assert.deepEqual(sorted(pos.expanded),allPrimes(cs,n));
    assert.equal(compareCover(posFromComplement(paths.slice(0,1),names.slice(0,n)).expanded,cs,n).equal,false);
  }
  assert.deepEqual(sorted(bddPaths(buildBdd(resolutionExamples.f3,names,[1,0,2,3],true),1)),['0**0','1*1*']);
});

test('De Morgan conversion handles empty and constant covers, and every pair of four-variable cubes',()=>{
  const examples=[[],['****'],...allCubes(4).flatMap((a,i,cs)=>cs.slice(i).map(b=>[a,b]))];
  for(const cs of examples) {
    const result=posFromComplement(cs,names);
    for(const bits of inputs(4))assert.equal(evaluateDirect(result.expanded,bits),1-evaluateDirect(cs,bits));
  }
});

test('parser, absorption, mathematical formatting and counterexample sets respect declared variable order',()=>{
  assert.deepEqual(parseCover('0*1， 1-0; 0*1',3),{cover:['0*1','1*0'],error:''});
  assert.ok(parseCover('10q',3).error);
  assert.ok(parseCover('01',3).error);
  assert.deepEqual(parseCover('',3),{cover:[],error:''});
  assert.deepEqual(absorb(['000','0*0','0*0','1*1']),['0*0','1*1']);
  assert.equal(cubeTex('01*0',names),String.raw`\overline{x}y\overline{w}`);
  assert.equal(sopTex([],names),'0');
  assert.equal(compareCover(['1110'],referenceT2,4).missing.includes('1111'),true);
});

test('25 real question parts render an interactive lab and valid KaTeX, with no omitted or invented parts',()=>{
  const questions=JSON.parse(readFileSync(new URL('../src/data/questions.json',import.meta.url),'utf8')) as {id:string}[];
  const actual=questions.map(q=>q.id).filter(id=>Object.keys(groupACoverage).some(p=>id.startsWith(p+'-')));
  const expected=Object.entries(groupACoverage).flatMap(([id,parts])=>parts.map(p=>id+'-'+p));
  assert.equal(expected.length,25);
  assert.deepEqual(sorted(actual),sorted(expected));
  let mathCount=0;
  for(const [problemId,parts] of Object.entries(groupACoverage))for(const partLabel of parts) {
    const html=renderToStaticMarkup(React.createElement(GroupA,{problemId,partLabel}));
    assert.match(html,/交互实验/);
    assert.match(html,/<(?:button|input|select|textarea)\b/);
    assert.doesNotMatch(html,/katex-error|此实验未匹配/);
    assert.doesNotMatch(html,/[\x00-\x08\x0b\x0c\x0e-\x1f]/);
    mathCount+=(html.match(/class="katex"/g)||[]).length;
  }
  assert.ok(mathCount>20,`rendered formula count=${mathCount}`);
});
