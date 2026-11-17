export type Cube = string;
export const inputs = (n: number) => Array.from({length: 2 ** n}, (_, i) => i.toString(2).padStart(n, '0'));
export const covers = (cube: Cube, bits: string) => cube.length === bits.length && [...cube].every((v, i) => v === '*' || v === bits[i]);
export const evaluate = (cover: Cube[], bits: string) => Number(cover.some(c => covers(c, bits)));
export const dimension = (cube: Cube) => [...cube].filter(x => x === '*').length;
export const literalCount = (cover: Cube[]) => cover.reduce((n, c) => n + c.length - dimension(c), 0);
export const coveredPoints = (cover: Cube[], n: number) => inputs(n).filter(x => evaluate(cover, x));
export function compareCover(candidate: Cube[], reference: Cube[], n: number) {
  const missing = inputs(n).filter(x => evaluate(reference, x) && !evaluate(candidate, x));
  const extra = inputs(n).filter(x => !evaluate(reference, x) && evaluate(candidate, x));
  return {equal: missing.length === 0 && extra.length === 0, missing, extra};
}
export function parseCover(text: string, n: number): {cover: Cube[]; error: string} {
  const terms = text.trim().split(/[\s,，;；]+/).filter(Boolean).map(x => x.replace(/[-×∗]/g, '*'));
  const invalid = terms.find(x => x.length !== n || /[^01*]/.test(x));
  return invalid ? {cover: [], error: `“${invalid}”不是 ${n} 位的 0/1/* 字符串。`} : {cover: [...new Set(terms)], error: ''};
}
export const absorbs = (a: Cube, b: Cube) => a.length === b.length && [...a].every((v, i) => v === '*' || v === b[i]);
export const absorb = (cs: Cube[]) => [...new Set(cs)].filter(c => !cs.some(d => d !== c && absorbs(d, c))).sort();
export function quineMerge(a: Cube, b: Cube): Cube | null {
  if (a.length !== b.length) return null;
  const diffs = [...a].flatMap((x, i) => x !== b[i] ? [i] : []);
  if (diffs.length !== 1 || a[diffs[0]] === '*' || b[diffs[0]] === '*') return null;
  return a.slice(0, diffs[0]) + '*' + a.slice(diffs[0] + 1);
}
export function consensus(a: Cube, b: Cube): Cube | null {
  if (a.length !== b.length) return null;
  const conflicts = [...a].flatMap((v, i) => v !== '*' && b[i] !== '*' && v !== b[i] ? [i] : []);
  if (conflicts.length !== 1) return null;
  return [...a].map((v, i) => i === conflicts[0] ? '*' : v === '*' ? b[i] : v).join('');
}
export function resolutionRound(cs: Cube[]) {
  const generated: {a: Cube; b: Cube; result: Cube}[] = [];
  cs.forEach((a, i) => cs.slice(i + 1).forEach(b => {const c = consensus(a, b); if (c && !cs.includes(c)) generated.push({a, b, result: c});}));
  return {generated, cover: absorb([...cs, ...generated.map(x => x.result)])};
}
export function resolutionClosure(cs: Cube[]) {
  let current = absorb(cs); const layers = [current];
  for (let i = 0; i < 100; i++) {
    const next = resolutionRound(current).cover;
    if (JSON.stringify(next) === JSON.stringify(current)) return layers;
    layers.push(next); current = next;
  }
  throw new Error('Resolution did not converge.');
}
export function allPrimes(reference: Cube[], n: number) {
  let candidates = [''];
  for (let i = 0; i < n; i++) candidates = candidates.flatMap(c => ['0','1','*'].map(v => c + v));
  return absorb(candidates.filter(c => inputs(n).every(x => !covers(c, x) || evaluate(reference, x))));
}
export function minimumCovers(primes: Cube[], reference: Cube[], n: number) {
  const valid: Cube[][] = []; let bestTerms = Infinity, bestLiterals = Infinity;
  for (let mask = 0; mask < 2 ** primes.length; mask++) {
    const cs = primes.filter((_, i) => mask & 2 ** i); if (cs.length > bestTerms) continue;
    if (!compareCover(cs, reference, n).equal) continue;
    const literals = literalCount(cs);
    if (cs.length < bestTerms || literals < bestLiterals) {bestTerms = cs.length; bestLiterals = literals; valid.length = 0;}
    if (cs.length === bestTerms && literals === bestLiterals) valid.push(cs);
  }
  return valid;
}
export function quineSteps(reference: Cube[], n: number) {
  let current = coveredPoints(reference, n); const layers: Cube[][] = [current], primes: Cube[] = [];
  for (;;) {
    const used = new Set<Cube>(), next = new Set<Cube>();
    current.forEach((a, i) => current.slice(i + 1).forEach(b => {const c = quineMerge(a, b); if (c) {used.add(a); used.add(b); next.add(c);}}));
    primes.push(...current.filter(c => !used.has(c)));
    if (!next.size) return {layers, primes: [...new Set(primes)]};
    current = [...next].sort(); layers.push(current);
  }
}
export function cubeTex(c: Cube, variables: string[]) {
  return [...c].map((v, i) => v === '*' ? '' : v === '0' ? `\\overline{${variables[i]}}` : variables[i]).join('') || '1';
}
export const sopTex = (cs: Cube[], variables: string[]) => cs.length ? cs.map(c => cubeTex(c, variables)).join('+') : '0';

export type BddNode = {id: number; variable: number; low: number; high: number};
export type Bdd = {root: number; nodes: BddNode[]; variables: string[]; reduced: boolean};
export function buildBdd(cover: Cube[], variables: string[], order: number[], complement = false, reduced = true): Bdd {
  const nodes: BddNode[] = [], unique = new Map<string, number>();
  const walk = (depth: number, bits: string[]): number => {
    if (depth === order.length) return evaluate(cover, bits.join('')) ^ Number(complement);
    const v = order[depth]; const lowBits = [...bits], highBits = [...bits]; lowBits[v] = '0'; highBits[v] = '1';
    const low = walk(depth + 1, lowBits), high = walk(depth + 1, highBits);
    if (reduced && low === high) return low;
    const key = `${v},${low},${high}`;
    if (reduced && unique.has(key)) return unique.get(key)!;
    const id = nodes.length + 2; nodes.push({id, variable: v, low, high}); unique.set(key, id); return id;
  };
  const root = walk(0, variables.map(() => '0')); return {root, nodes, variables, reduced};
}
export function bddTrace(bdd: Bdd, bits: string) {
  const path: {id: number; value: string; next: number}[] = []; let id = bdd.root;
  while (id > 1) {const node = bdd.nodes.find(n => n.id === id)!; const value = bits[node.variable], next = value === '0' ? node.low : node.high; path.push({id,value,next}); id = next;}
  return {path, output: id};
}
export function bddPaths(bdd: Bdd, terminal: 0 | 1) {
  const paths: Cube[] = [];
  const walk = (id: number, cube: string[]) => {
    if (id < 2) {if (id === terminal) paths.push(cube.join('')); return;}
    const node = bdd.nodes.find(n => n.id === id)!;
    for (const value of ['0','1']) {const next = [...cube]; next[node.variable] = value; walk(value === '0' ? node.low : node.high, next);}
  };
  walk(bdd.root, bdd.variables.map(() => '*')); return paths;
}
export function posFromComplement(cs: Cube[], variables: string[]) {
  if (!cs.length) return {tex: '1', expanded: [variables.map(() => '*').join('')]};
  if (cs.some(c => dimension(c) === c.length)) return {tex: '0', expanded: []};
  const clauses = cs.map(c => [...c].flatMap((v, i) => v === '*' ? [] : [{index:i, value:v === '0' ? '1' : '0'}]));
  let terms = [variables.map(() => '*').join('')];
  for (const clause of clauses) terms = absorb(terms.flatMap(c => clause.flatMap(lit => {
    if (c[lit.index] !== '*' && c[lit.index] !== lit.value) return [];
    return [c.slice(0,lit.index)+lit.value+c.slice(lit.index+1)];
  })));
  const tex = clauses.map(ls => '(' + ls.map(l => l.value === '1' ? variables[l.index] : `\\overline{${variables[l.index]}}`).join('+') + ')').join('');
  return {tex, expanded: terms};
}
export const referenceT2 = ['0000','0001','1000','0011','0101','0111','1110','1111'];
export const primesT2 = ['000*','*000','*111','111*','0**1'];
export const resolutionExamples: Record<string, Cube[]> = {
  f1: ['*111','1110','00*1','0*01','*000'],
  f2: ['*111','111*','0110','1*00','000*'],
  f3: ['0*11','*101','00*1','100*','1*00'],
  f4: ['11*','*11','00*','*00'],
};
export const referenceT1P3 = ['000','010','100','110','111'];
export const referenceHeuristic = ['01*','111','000'];
export const groupACoverage: Record<string, string[]> = {
  'T1-P1':['a','b','c','d','e','g'], 'T1-P2':['c'], 'T1-P3':['a','b','c','d'],
  'T2-P1':['a','b','c','d','e'], 'T3-P1':['a','b'], 'T3-P3':['任务'], 'T3-P4':['a','b','c','d','e','f'],
};
