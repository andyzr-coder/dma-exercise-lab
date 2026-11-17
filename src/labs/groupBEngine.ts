export type Bit = 0 | 1;
export type BoolFunction = (bits: Bit[]) => Bit;
export const bit = (v: unknown): Bit => v ? 1 : 0;
export const assignments = (n: number): Bit[][] =>
  Array.from({ length: 2 ** n }, (_, value) => Array.from({ length: n }, (_, i) => ((value >> (n - i - 1)) & 1) as Bit));
export const bitsText = (bits: readonly Bit[]) => bits.join('');
export const tautology1: BoolFunction = ([x, y, z, w]) => bit(
  x && y || !x && !y || z && w || !z && !w ||
  x && !y && z && !w || x && !y && !z && w ||
  !x && y && z && !w || !x && y && !z && w);
export const tautology2: BoolFunction = ([x, y, z, w, v]) => bit(
  !x && z && v || y && !w && v || !x && z && !w || y && !z && !w ||
  x && y || !x && !y || x && z || !x && !z || y && z || !y && !z);
export const shared1: BoolFunction = ([x, y, z, w]) => bit(x && y && w || z && w);
export const shared2: BoolFunction = ([x, , z, w]) => bit(x && w || z && w);
export const lutFunction: BoolFunction = ([x1, x2, x3, x4, x5]) => bit(
  x2 && x3 && !x4 || x2 && !x3 && x4 && !x5 ||
  !x2 && !x3 && !x4 && x5 || x3 && !x4 && !x5 || x1);
export interface BddNode { id: number; variable: number; low: number; high: number }
export interface Bdd { roots: number[]; nodes: BddNode[]; order: number[] }
export function buildBdd(functions: BoolFunction[], n: number, order: number[], fixed: Record<number, Bit> = {}): Bdd {
  const used = order.filter(v => fixed[v] === undefined);
  const unique = new Map<string, number>(); const nodes: BddNode[] = [];
  const recurse = (fn: BoolFunction, level: number, values: Bit[]): number => {
    if (level === used.length) return fn(values);
    const variable = used[level], lowValues = [...values], highValues = [...values];
    lowValues[variable] = 0; highValues[variable] = 1;
    const low = recurse(fn, level + 1, lowValues), high = recurse(fn, level + 1, highValues);
    if (low === high) return low;
    const key = [variable, low, high].join(':');
    const known = unique.get(key); if (known !== undefined) return known;
    const id = nodes.length + 2;
    nodes.push({ id, variable, low, high }); unique.set(key, id); return id;
  };
  const values = Array<Bit>(n).fill(0);
  Object.entries(fixed).forEach(([v, value]) => values[Number(v)] = value);
  return { roots: functions.map(fn => recurse(fn, 0, values)), nodes, order: used };
}
export interface DecompositionClass { signature: string; boundWords: string[]; values: Bit[] }
export function decompose(fn: BoolFunction, n: number, bound: number[]) {
  const free = Array.from({ length: n }, (_, i) => i).filter(i => !bound.includes(i));
  const classes: DecompositionClass[] = [];
  const rows = assignments(bound.length).map(a => {
    const values = assignments(free.length).map(u => {
      const input = Array<Bit>(n).fill(0);
      bound.forEach((v, i) => input[v] = a[i]); free.forEach((v, i) => input[v] = u[i]); return fn(input);
    });
    const signature = bitsText(values);
    let classId = classes.findIndex(c => c.signature === signature);
    if (classId < 0) { classId = classes.length; classes.push({ signature, boundWords: [], values }); }
    classes[classId].boundWords.push(bitsText(a)); return { bound: a, classId };
  });
  const r = Math.ceil(Math.log2(classes.length));
  return { bound, free, classes, rows, r, feasible: bound.length <= 4 && r + free.length <= 4 };
}
export interface Cube { word: string; covers: number[]; literals: number }
export const matches = (word: string, bits: readonly Bit[]) => [...word].every((v, i) => v === '*' || Number(v) === bits[i]);
export function primeCubes(n: number, on: number[], dc: number[] = []): Cube[] {
  if (!on.length) return [];
  const allowed = new Set([...on, ...dc]), onSet = new Set(on), all = assignments(n);
  let words = [''];
  for (let i = 0; i < n; i++) words = words.flatMap(w => ['0', '1', '*'].map(c => w + c));
  const implicants = words.map(word => ({
    word, covers: all.flatMap((a, i) => matches(word, a) ? [i] : []),
    literals: [...word].filter(c => c !== '*').length,
  })).filter(c => c.covers.every(i => allowed.has(i)) && c.covers.some(i => onSet.has(i)));
  const byWord = new Set(implicants.map(c => c.word));
  return implicants.filter(c => ![...c.word].some((v, i) =>
    v !== '*' && byWord.has(c.word.slice(0, i) + '*' + c.word.slice(i + 1))));
}
export interface CoverRow { word: string; literals: number; mask: bigint; outputs?: number[] }
export function minimumCover(rows: CoverRow[], required: bigint): { cost: number; words: string[] } {
  if (!required) return { cost: 0, words: [] };
  let best = Infinity, bestWords: string[] = [];
  const memo = new Map<bigint, number>();
  const search = (remaining: bigint, cost: number, selected: string[]) => {
    if (!remaining) { if (cost < best || cost === best && selected.length < bestWords.length) { best = cost; bestWords = selected; } return; }
    if (cost > best || (memo.get(remaining) ?? Infinity) < cost) return;
    memo.set(remaining, cost);
    let target = 1n; while (!(target & remaining)) target <<= 1n;
    const options = rows.filter(r => r.mask & target).sort((a, b) => a.literals - b.literals);
    for (const row of options) search(remaining & ~row.mask, cost + row.literals, [...selected, row.word]);
  };
  search(required, 0, []); return { cost: best, words: bestWords };
}
export function minimize(n: number, on: number[], dc: number[] = []) {
  const required = on.reduce((m, i) => m | 1n << BigInt(i), 0n);
  return minimumCover(primeCubes(n, on, dc).map(c => ({
    ...c, mask: c.covers.reduce((m, i) => m | 1n << BigInt(i), 0n),
  })), required);
}
export function cubeTex(word: string, names: string[]): string {
  return [...word].flatMap((v, i) => v === '*' ? [] : [v === '1' ? names[i] : '\\overline{' + names[i] + '}']).join('') || '1';
}
export const sopTex = (words: string[], names: string[]) => words.map(w => cubeTex(w, names)).join('+') || '0';
export const multiPairs: Record<string, { n: number; functions: BoolFunction[]; original: string[] }> = {
  f: { n: 3, functions: [
    ([x, y, z]) => bit(!x && !z || x && y && z),
    ([x, y, z]) => bit(!y && z || !x && y && !z),
  ], original: ['0*0', '111', '*01', '010'] },
  g: { n: 4, functions: [
    ([x, y, z, w]) => bit(x && y && !w || x && !z || !y && !z && !w),
    ([x, y, z, w]) => bit(y && z && w || x && w || x && !y && z),
  ], original: ['11*0', '1*0*', '*000', '*111', '1**1', '101*'] },
  h: { n: 4, functions: [
    ([x, y, z, w]) => bit(x && !y && !w || x && y && z || x && !z && w),
    ([x, y, z, w]) => bit(!y && !z && !w || x && !y && w || !x && !y && z),
  ], original: ['10*0', '111*', '1*01', '*000', '10*1', '001*'] },
};
export function multipleCover(pair: string) {
  const { n, functions, original } = multiPairs[pair];
  const all = assignments(n), on = functions.map(fn => all.flatMap((a, i) => fn(a) ? [i] : []));
  const intersection = on[0].filter(i => on[1].includes(i));
  const candidates = new Map<string, Cube>();
  [...on, intersection].forEach(points => primeCubes(n, points).forEach(c => candidates.set(c.word, c)));
  const columns = on.flatMap((points, output) => points.map(point => ({ output, point })));
  const rows: CoverRow[] = [...candidates.values()].map(c => {
    const outputs = on.flatMap((points, output) => c.covers.every(i => points.includes(i)) ? [output] : []);
    const mask = columns.reduce((mask, col, i) => outputs.includes(col.output) && c.covers.includes(col.point) ? mask | 1n << BigInt(i) : mask, 0n);
    return { word: c.word, literals: c.literals, mask, outputs };
  });
  const required = (1n << BigInt(columns.length)) - 1n;
  return { n, on, intersection, columns, rows, original, required, optimal: minimumCover(rows, required) };
}
export const fsmTable: [number, Bit][][] = [
  [[1, 0], [2, 0]], [[3, 0], [4, 0]], [[5, 0], [6, 0]],
  [[0, 0], [0, 0]], [[0, 1], [0, 0]], [[0, 0], [0, 0]], [[0, 1], [0, 0]],
];
export const fsmGroup = [0, 2, 2, 1, 3, 1, 3];
export const fsmPartitions = [
  [[0, 1, 2, 3, 4, 5, 6]], [[0, 1, 2, 3, 5], [4, 6]],
  [[0, 3, 5], [1, 2], [4, 6]], [[0], [3, 5], [1, 2], [4, 6]],
];
export const minFsmTable: [number, Bit][][] = [
  [[2, 0], [2, 0]], [[0, 0], [0, 0]], [[1, 0], [3, 0]], [[0, 1], [0, 0]],
];
export function fsmEncoded(group: number, input: Bit, handwritten = false) {
  const codes = handwritten ? ['00', '01', '10', '11'] : ['00', '10', '01', '11'];
  const [next, y] = minFsmTable[group][input];
  return { current: codes[group], next: codes[next], y };
}
export type LatchSignal = 'D' | 'C' | 'Dn' | 'R' | 'S' | 'Qn' | 'Q';
export const latchSignals: LatchSignal[] = ['D', 'C', 'Dn', 'R', 'S', 'Qn', 'Q'];
export type LatchValues = Record<LatchSignal, Bit>;
export interface LatchEvent { time: number; signal: LatchSignal; value: Bit }
export interface LatchFrame { time: number; values: LatchValues; changed: LatchSignal[] }
export const defaultLatchEvents: LatchEvent[] = [
  { time: 20, signal: 'C', value: 1 }, { time: 60, signal: 'D', value: 1 },
  { time: 120, signal: 'C', value: 0 }, { time: 160, signal: 'D', value: 0 },
  { time: 200, signal: 'C', value: 1 },
];
export function simulateLatch(inputEvents: LatchEvent[], delay = 10, end = 260): LatchFrame[] {
  if (delay <= 0) throw new Error('门延迟必须为正');
  const values: LatchValues = { D: 0, C: 0, Dn: 1, R: 1, S: 1, Qn: 1, Q: 0 };
  const gates: { output: LatchSignal; inputs: LatchSignal[]; evaluate: () => Bit }[] = [
    { output: 'Dn', inputs: ['D'], evaluate: () => bit(!values.D) },
    { output: 'R', inputs: ['Dn', 'C'], evaluate: () => bit(!(values.Dn && values.C)) },
    { output: 'S', inputs: ['D', 'C'], evaluate: () => bit(!(values.D && values.C)) },
    { output: 'Qn', inputs: ['R', 'Q'], evaluate: () => bit(!(values.R && values.Q)) },
    { output: 'Q', inputs: ['S', 'Qn'], evaluate: () => bit(!(values.S && values.Qn)) },
  ];
  const queue = inputEvents.map(e => ({ ...e }));
  const frames: LatchFrame[] = [{ time: 0, values: { ...values }, changed: [] }];
  // Transport delay: every changed gate input schedules the evaluated output.
  // Unchanged output transactions execute silently without further events.
  while (queue.length) {
    queue.sort((a, b) => a.time - b.time);
    const time = queue[0].time; if (time > end) break;
    const batch = queue.filter(e => e.time === time); queue.splice(0, batch.length);
    const changed: LatchSignal[] = [];
    for (const e of batch) if (values[e.signal] !== e.value) { values[e.signal] = e.value; changed.push(e.signal); }
    if (!changed.length) continue;
    frames.push({ time, values: { ...values }, changed });
    for (const gate of gates) if (gate.inputs.some(s => changed.includes(s)))
      queue.push({ time: time + delay, signal: gate.output, value: gate.evaluate() });
  }
  return frames;
}
export type SeqState = [Bit, Bit];
export interface SeqValues { s1: Bit; s2: Bit; z1: Bit; z2: Bit; z3: Bit; y: Bit }
export function seqValues(state: SeqState, input: SeqState, stuck: Bit | null = null): SeqValues {
  const [s1, s2] = state, [x1, x2] = input;
  const z1 = bit(x1 && s1);
  return { s1, s2, z1, z2: bit(z1 || s2), z3: stuck === null ? bit(!z1) : stuck, y: bit(s1 && x2) };
}
export function sequentialTrace(inputs: SeqState[], initial: SeqState, stuck: Bit) {
  let goodState: SeqState = [...initial], badState: SeqState = [...initial];
  return inputs.map((input, frame) => {
    const good = seqValues(goodState, input), faulty = seqValues(badState, input, stuck);
    goodState = [good.z2, good.z3]; badState = [faulty.z2, faulty.z3];
    return { frame, input, good, faulty, detected: good.y !== faulty.y };
  });
}
export function parseSequence(text: string): { cubes: string[]; error: string } {
  const cubes = text.trim().toUpperCase().split(/[\s,;]+/).filter(Boolean);
  if (!cubes.length) return { cubes: [], error: '至少输入一帧，例如 0X。' };
  if (cubes.length > 12) return { cubes: [], error: '本实验最多 12 帧。' };
  if (cubes.some(c => !/^[01X]{2}$/.test(c))) return { cubes: [], error: '每帧恰好两位，顺序 x₁x₂；仅用 0、1、X。' };
  return { cubes, error: '' };
}
export function sequenceGuarantee(cubes: string[], stuck: Bit) {
  type Branch = { good: SeqState; bad: SeqState; seen: boolean; count: number };
  let branches: Branch[] = assignments(2).map(s => ({ good: s as SeqState, bad: s as SeqState, seen: false, count: 1 }));
  let finalFailed = 0;
  for (const cube of cubes) {
    const possible = assignments(2).filter(a => [...cube].every((v, i) => v === 'X' || Number(v) === a[i]));
    const merged = new Map<string, Branch>(); finalFailed = 0;
    for (const branch of branches) for (const input of possible) {
      const good = seqValues(branch.good, input as SeqState), bad = seqValues(branch.bad, input as SeqState, stuck);
      const detected = good.y !== bad.y, seen = branch.seen || detected;
      if (!detected) finalFailed += branch.count;
      const next: Branch = { good: [good.z2, good.z3], bad: [bad.z2, bad.z3], seen, count: branch.count };
      const key = [...next.good, ...next.bad, Number(seen)].join(''), prior = merged.get(key);
      if (prior) prior.count += next.count; else merged.set(key, next);
    }
    branches = [...merged.values()];
  }
  const total = branches.reduce((sum, b) => sum + b.count, 0);
  const failed = branches.filter(b => !b.seen).reduce((sum, b) => sum + b.count, 0);
  return { total, failed, guaranteed: cubes.length > 0 && failed === 0, finalGuaranteed: cubes.length > 0 && finalFailed === 0 };
}
export function shortestSequential(stuck: Bit, max = 6) {
  // x2 has no state feedback; holding it at 1 maximizes observability.
  // Exhaustive x1 enumeration therefore rules out every shorter sequence.
  for (let frames = 1; frames <= max; frames++) for (const xs of assignments(frames)) {
    const cubes = xs.map(x => String(x) + '1');
    if (sequenceGuarantee(cubes, stuck).guaranteed) return { frames, cubes };
  }
  return null;
}
export const pairSymbol = (good: Bit, faulty: Bit) => good === faulty ? String(good) : good ? 'D' : 'D̄';
