import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignments, buildBdd, tautology1, tautology2, shared1, shared2, lutFunction, decompose,
  multipleCover, matches, minimize, fsmTable, fsmGroup, minFsmTable, fsmEncoded,
  simulateLatch, defaultLatchEvents, parseSequence, sequentialTrace, sequenceGuarantee,
  shortestSequential,
} from '../src/labs/groupBEngine.ts';
import type { Bit, SeqState } from '../src/labs/groupBEngine.ts';

test('T4P3 both source tautologies reduce to terminal 1; shared roots retain independent meanings', () => {
  assert(assignments(4).every(a => tautology1(a) === 1));
  assert(assignments(5).every(a => tautology2(a) === 1));
  for (const fn of [tautology1, tautology2]) {
    const n = fn === tautology1 ? 4 : 5;
    const result = buildBdd([fn], n, Array.from({ length: n }, (_, i) => i));
    assert.deepEqual(result.roots, [1]); assert.equal(result.nodes.length, 0);
  }
  const graph = buildBdd([shared1, shared2], 4, [0, 1, 2, 3]);
  const evaluate = (root: number, a: Bit[]): number => {
    if (root < 2) return root;
    const node = graph.nodes.find(n => n.id === root)!;
    return evaluate(a[node.variable] ? node.high : node.low, a);
  };
  for (const a of assignments(4)) {
    assert.equal(evaluate(graph.roots[0], a), shared1(a));
    assert.equal(evaluate(graph.roots[1], a), shared2(a));
  }
  assert.equal(graph.nodes.length, 5);
});
test('T4P4 specified BDD orders, fixed three-class cut, and true two-LUT alternative', () => {
  assert.equal(buildBdd([lutFunction], 5, [0, 4, 2, 1, 3]).nodes.length, 9);
  assert.equal(buildBdd([lutFunction], 5, [1, 3, 4, 0, 2]).nodes.length, 10);
  const fixed = decompose(lutFunction, 5, [1, 3, 4]);
  assert.equal(fixed.classes.length, 3); assert.equal(fixed.r, 2); assert(fixed.feasible);
  assert.deepEqual(fixed.classes.map(c => c.boundWords), [['000', '100', '101'], ['001', '110'], ['010', '011', '111']]);
  const global = decompose(lutFunction, 5, [1, 2, 3, 4]);
  assert.equal(global.classes.length, 2); assert.equal(global.r + 1, 2); assert(global.feasible);
  assert.equal(decompose(lutFunction, 5, [1, 3]).feasible, false);
  for (let v = 0; v < 5; v++) assert(assignments(5).some(a => {
    const flipped = [...a]; flipped[v] = (1 - a[v]) as Bit; return lutFunction(a) !== lutFunction(flipped);
  }), 'each input is essential, excluding a single LUT');
});
test('DC minimization stays correct on every care point while allowing arbitrary code permutations', () => {
  const d = decompose(lutFunction, 5, [1, 3, 4]);
  for (const codes of [[3, 2, 0], [0, 1, 2], [2, 0, 1]]) {
    const on: number[] = [], dc: number[] = [];
    assignments(4).forEach((a, index) => {
      const code = a[0] * 2 + a[1], classId = codes.indexOf(code);
      if (classId < 0) dc.push(index);
      else if (d.classes[classId].values[a[2] * 2 + a[3]]) on.push(index);
    });
    for (const dontCare of [[], dc]) {
      const result = minimize(4, on, dontCare);
      for (const [i, a] of assignments(4).entries()) if (!dontCare.includes(i))
        assert.equal(result.words.some(w => matches(w, a)), on.includes(i));
    }
  }
});
test('T4P6 exact weighted shared cover reaches 10/15/15 and covers all output/minterm columns', () => {
  for (const [name, cost, independent] of [['f', 10, 10], ['g', 15, 16], ['h', 15, 18]] as const) {
    const d = multipleCover(name);
    assert.equal(d.optimal.cost, cost);
    assert.equal(d.original.reduce((sum, w) => sum + [...w].filter(c => c !== '*').length, 0), independent);
    const cover = d.rows.filter(r => d.optimal.words.includes(r.word)).reduce((m, r) => m | r.mask, 0n);
    assert.equal(cover & d.required, d.required);
    const shared = d.rows.filter(r => r.outputs?.length === 2);
    assert.deepEqual(shared.map(r => r.word), [name === 'f' ? '010' : name === 'g' ? '1*01' : '100*']);
  }
});
test('T4P5 every original transition commutes with quotient mapping; both encodings implement same machine', () => {
  for (let state = 0; state < 7; state++) for (const input of [0, 1] as Bit[]) {
    const [next, output] = fsmTable[state][input], [qNext, qOutput] = minFsmTable[fsmGroup[state]][input];
    assert.equal(fsmGroup[next], qNext); assert.equal(output, qOutput);
  }
  for (let group = 0; group < 4; group++) for (const x of [0, 1] as Bit[]) {
    const result = fsmEncoded(group, x), [s1, s2] = [...result.current].map(Number);
    assert.equal(result.next, [Number(!s1 && s2), Number(!s1 && !s2 || x && !s1)].join(''));
    assert.equal(result.y, Number(!x && s1 && s2));
    const hand = fsmEncoded(group, x, true), [a, b] = [...hand.current].map(Number);
    assert.equal(hand.next, [Number(!a && !b || !b && x), Number(a && !b)].join(''));
  }
});
test('T5P2 simultaneous gate events and two feedback transitions reproduce full source waveform', () => {
  const frames = simulateLatch(defaultLatchEvents);
  const edges = (signal: string) => frames.filter(f => f.changed.includes(signal as never)).map(f => f.time);
  assert.deepEqual(edges('Dn'), [70, 170]); assert.deepEqual(edges('R'), [30, 80, 210]);
  assert.deepEqual(edges('S'), [70, 130]); assert.deepEqual(edges('Q'), [80, 230]);
  assert.deepEqual(edges('Qn'), [90, 220]);
  assert.equal(frames.find(f => f.time === 70)?.values.R, 0);
  assert.equal(frames.find(f => f.time === 70)?.values.S, 0);
  assert.equal(frames.find(f => f.time === 80)?.values.Q, 1);
  assert.equal(frames.find(f => f.time === 80)?.values.Qn, 1);
  const closed = simulateLatch([{ time: 30, signal: 'D', value: 1 }]);
  assert(closed.every(f => f.values.Q === 0), 'closed latch holds data');
});
test('T11P1 source sequences detect persistent faults for every common initial state and every X assignment', () => {
  for (const [stuck, text, count] of [[0, '0X 0X X1', 3], [1, '0X XX 1X 0X X1', 5]] as const) {
    const parsed = parseSequence(text); assert.equal(parsed.error, '');
    const result = sequenceGuarantee(parsed.cubes, stuck);
    assert(result.guaranteed); assert(result.finalGuaranteed); assert.equal(result.failed, 0);
    assert.equal(shortestSequential(stuck)?.frames, count);
    for (const initial of assignments(2)) {
      const inputs = parsed.cubes.map(c => [...c].map(v => v === 'X' ? 0 : Number(v)) as SeqState);
      const trace = sequentialTrace(inputs, initial as SeqState, stuck);
      assert(trace.at(-1)!.detected);
      assert(trace.every(t => t.faulty.z3 === stuck), 'fault remains in all frames');
    }
  }
  assert(!sequenceGuarantee(['1X', '0X', 'X1'], 1).guaranteed, 'unprepared initial state is not a guaranteed test');
  assert(parseSequence('010').error);
});
