import { useMemo, useState } from 'react';
import { MathText } from '../MathText';
import {
  assignments, bit, bitsText, buildBdd, tautology1, tautology2, shared1, shared2,
  lutFunction, decompose, minimize, sopTex, cubeTex, multipleCover, matches,
  fsmTable, fsmGroup, fsmPartitions, minFsmTable, fsmEncoded,
  simulateLatch, latchSignals, parseSequence, sequentialTrace, sequenceGuarantee,
  shortestSequential, pairSymbol,
} from './groupBEngine';
import type { Bdd, Bit, BoolFunction, LatchFrame, LatchSignal, SeqState, SeqValues } from './groupBEngine';

const names = ['x', 'y', 'z', 'w', 'v'];
const blue = '#245c9b', green = '#18735d', amber = '#b77917', red = '#b43e42';
const svgStyle = { width: '100%', minWidth: 420, display: 'block' } as const;
const displayMath = (tex: string) => '$' + tex + '$';
const labelWord = (code: number, n: number) => code.toString(2).padStart(n, '0');
function BitChoice({ label, value, change }: { label: string; value: Bit; change: (value: Bit) => void }) {
  return <div className="control"><span>{label}</span>{([0, 1] as Bit[]).map(b =>
    <button type="button" key={b} className={'bit-button' + (value === b ? ' active' : '')}
      aria-pressed={value === b} onClick={() => change(b)}>{b}</button>)}</div>;
}
function BddDiagram({ bdd, variables, roots, cut }: { bdd: Bdd; variables: string[]; roots: string[]; cut?: number }) {
  const height = bdd.nodes.length ? Math.max(210, 115 + 74 * bdd.order.length) : 160;
  const terminals = [0, 1].filter(v => bdd.roots.includes(v) || bdd.nodes.some(n => n.low === v || n.high === v));
  const positions = new Map<number, [number, number]>(terminals.map((v, i) =>
    [v, [620 * (i + 1) / (terminals.length + 1), height - 35]]));
  bdd.order.forEach((v, level) => {
    const row = bdd.nodes.filter(n => n.variable === v);
    row.forEach((node, i) => positions.set(node.id, [620 * (i + 1) / (row.length + 1), 70 + 74 * level]));
  });
  return <div className="table-wrap"><svg viewBox={'0 0 620 ' + height} style={svgStyle} role="img" aria-label="按当前变量顺序及余因子构造的约简有序决策图">
    <title>ROBDD：蓝色实线是1分支，灰色虚线是0分支</title>
    {cut !== undefined && cut < bdd.order.length && <g>
      <line x1="10" x2="610" y1={33 + cut * 74} y2={33 + cut * 74} stroke={amber} strokeDasharray="5 5" />
      <text x="15" y={27 + cut * 74} fill={amber} fontSize="12">bound ↑ / free ↓</text>
    </g>}
    {bdd.nodes.flatMap(node => ([['0', node.low], ['1', node.high]] as const).map(([label, child]) => {
      const a = positions.get(node.id)!, b = positions.get(child)!;
      return <g key={node.id + '-' + label}><line x1={a[0]} y1={a[1] + 16} x2={b[0]} y2={b[1] - 16}
        stroke={label === '1' ? blue : '#8994a2'} strokeWidth="1.5" strokeDasharray={label === '0' ? '5 4' : undefined} />
        <text x={a[0] + (b[0] - a[0]) * .27 + 4} y={a[1] + (b[1] - a[1]) * .27} fontSize="12" fill={label === '1' ? blue : '#667'}>{label}</text></g>;
    }))}
    {bdd.roots.map((root, i) => {
      const p = positions.get(root)!, x = 620 * (i + 1) / (bdd.roots.length + 1);
      return <g key={i}><text x={x} y="18" textAnchor="middle" fill={blue} fontSize="14">{roots[i]}</text>
        <line x1={x} y1="24" x2={p[0]} y2={p[1] - 19} stroke={blue} strokeWidth="1.4" /></g>;
    })}
    {bdd.nodes.map(node => {
      const p = positions.get(node.id)!;
      return <g key={node.id}><circle cx={p[0]} cy={p[1]} r="19" fill="white" stroke={blue} strokeWidth="1.6" />
        <text x={p[0]} y={p[1] + 5} textAnchor="middle" fontSize="14" fill="#253752">{variables[node.variable]}</text></g>;
    })}
    {terminals.map(v => { const p = positions.get(v)!; return <g key={v}>
      <rect x={p[0] - 19} y={p[1] - 17} width="38" height="34" rx="5" fill={v ? '#e4f4ec' : '#eef1f5'} stroke={v ? green : '#8994a2'} />
      <text x={p[0]} y={p[1] + 5} textAnchor="middle" fontSize="16">{v}</text></g>; })}
  </svg></div>;
}
function CubeDiagram({ n, on, covered = on }: { n: number; on: number[]; covered?: number[] }) {
  const all = assignments(n), positions = new Map<number, [number, number]>();
  for (let weight = 0; weight <= n; weight++) {
    const row = all.flatMap((a, i) => a.reduce<number>((s, b) => s + b, 0) === weight ? [i] : []);
    row.forEach((index, i) => positions.set(index, [620 * (i + 1) / (row.length + 1), 35 + (n - weight) * 62]));
  }
  return <div className="table-wrap"><svg viewBox={'0 0 620 ' + (n * 62 + 75)} style={svgStyle} role="img" aria-label="布尔立方图，绿色已覆盖、橙色未覆盖的on-set、灰色off-set">
    <title>绿色已覆盖，橙色未覆盖的 on-set，灰色 off-set；边连接只差一位的顶点</title>
    {all.flatMap((a, i) => a.flatMap((b, v) => {
      if (b) return []; const j = i + 2 ** (n - v - 1), p = positions.get(i)!, q = positions.get(j)!;
      return [<line key={i + '-' + j} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="#c9d2dc" />];
    }))}
    {all.map((a, i) => { const p = positions.get(i)!, yes = on.includes(i), hit = covered.includes(i);
      return <g key={i}><rect x={p[0] - 25} y={p[1] - 13} width="50" height="26" rx="5"
        fill={yes ? hit ? '#def2e7' : '#fff0cf' : '#f5f6f8'} stroke={yes ? hit ? green : amber : '#c9d2dc'} />
        <text x={p[0]} y={p[1] + 5} textAnchor="middle" fontFamily="monospace" fontSize="13">{bitsText(a)}</text></g>;
    })}
  </svg></div>;
}
const p3Guides: Record<string, string> = {
  a: '先展开共识推导，再改变余因子条件：每种输入都为1才是恒真。',
  b: '固定变量得到余因子。观察两后继相同的节点怎样全部消失。',
  c: '绿色顶点构成 on-set；本题四维立方体的16个顶点全部被覆盖。',
  d: '切到f₂，依次固定v=0、w=1。这里直接计算较小余因子，验证单极性缩减。',
  e: '对f₂先固定v=0、w=1，再用共识与约简图交叉检查。',
  f: '共享图保留两个根。改变变量顺序，比较共享节点数和两个输出的真值。',
  g: '切到共享双输出，操作四个输入，观察三个AND与两个OR如何共用中间项。',
};
function TautologyLab({ part }: { part: string }) {
  const [mode, setMode] = useState(['d', 'e'].includes(part) ? 'f2' : ['f', 'g'].includes(part) ? 'shared' : 'f1');
  const [orderIndex, setOrderIndex] = useState(0), [fixed, setFixed] = useState<Record<number, string>>({});
  const [input, setInput] = useState<Bit[]>([1, 0, 1, 1]), [proof, setProof] = useState(0);
  const fn: BoolFunction[] = mode === 'f1' ? [tautology1] : mode === 'f2' ? [tautology2] : [shared1, shared2];
  const n = mode === 'f2' ? 5 : 4, labels = mode === 'shared' ? ['h₁=v', 'h₂=u'] : [mode === 'f1' ? 'f₁' : 'f₂'];
  const fixedBits: Record<number, Bit> = {};
  Object.entries(fixed).forEach(([i, value]) => { if (value !== 'X') fixedBits[Number(i)] = Number(value) as Bit; });
  const order = orderIndex === 0 ? Array.from({ length: n }, (_, i) => i) : n === 5 ? [4, 3, 0, 1, 2] : [0, 3, 1, 2];
  const graph = buildBdd(fn, n, order, fixedBits);
  const truth = assignments(n).filter(a => Object.entries(fixedBits).every(([i, value]) => a[Number(i)] === value));
  const proofSteps = mode === 'f2' ? [
    String.raw`xy,\ \overline y\overline z\Rightarrow x\overline z`,
    String.raw`x\overline z,\ xz\Rightarrow x`,
    String.raw`\overline x\overline y,\ yz\Rightarrow\overline xz`,
    String.raw`\overline xz,\ \overline x\overline z\Rightarrow\overline x`,
    String.raw`x,\ \overline x\Rightarrow1`,
  ] : [
    String.raw`xy,\ \overline xyz\overline w\Rightarrow yz\overline w`,
    String.raw`\overline x\overline y,\ x\overline yz\overline w\Rightarrow\overline yz\overline w`,
    String.raw`yz\overline w,\ \overline yz\overline w\Rightarrow z\overline w`,
    String.raw`\text{同理生成 }\overline zw`,
    String.raw`zw,\ z\overline w\Rightarrow z;\quad \overline z\overline w,\ \overline zw\Rightarrow\overline z`,
    String.raw`z,\ \overline z\Rightarrow1`,
  ];
  return <section className="lab-panel">
    <p className="lab-intro">{p3Guides[part] || p3Guides.b}</p>
    <div className="controls"><label className="control">函数
      <select value={mode} onChange={e => { setMode(e.target.value); setFixed({}); setProof(0); }}>
        <option value="f1">f₁：四变量恒真</option><option value="f2">f₂：五变量恒真</option><option value="shared">h₁、h₂：共享双输出</option>
      </select></label>
      <label className="control">变量顺序<select value={orderIndex} onChange={e => setOrderIndex(Number(e.target.value))}>
        <option value="0">{names.slice(0, n).join(' → ')}</option><option value="1">{n === 5 ? 'v → w → x → y → z' : 'x → w → y → z'}</option>
      </select></label><button onClick={() => setFixed({})}>释放全部变量</button>
    </div>
    <div className="controls">{names.slice(0, n).map((name, i) => <label className="control" key={name}>{name} 的余因子
      <select value={fixed[i] ?? 'X'} onChange={e => setFixed({ ...fixed, [i]: e.target.value })}>
        <option value="X">自由</option><option value="0">固定0</option><option value="1">固定1</option>
      </select></label>)}</div>
    <div className="result">保留 {truth.length} 种输入 · {graph.nodes.length} 个非终端节点 · {fn.map((f, i) => labels[i] + ' 的1个数：' + truth.filter(a => f(a)).length).join('；')}</div>
    {part === 'c' && n === 4 ? <CubeDiagram n={4} on={assignments(4).flatMap((a, i) => fn[0](a) ? [i] : [])} /> :
      <BddDiagram bdd={graph} variables={names} roots={labels} />}
    <p className="notice">实线蓝边=1，虚线灰边=0。恒真图约简后只有终端1；跳过变量说明函数不依赖该变量。</p>
    {['a', 'e'].includes(part) && mode !== 'shared' && <div className="result">
      <div className="controls"><button onClick={() => setProof(Math.max(0, proof - 1))}>上一步共识</button>
        <span>{Math.min(proof, proofSteps.length - 1) + 1} / {proofSteps.length}</span>
        <button onClick={() => setProof(Math.min(proofSteps.length - 1, proof + 1))}>下一步共识</button></div>
      <MathText text={displayMath(proofSteps[Math.min(proof, proofSteps.length - 1)])} />
      {mode === 'f2' && <p>此推导针对 v=0、w=1 后的 g(x,y,z)，不是省略了前置条件。</p>}
    </div>}
    {mode === 'shared' && <div>
      <div className="controls">{names.slice(0, 4).map((name, i) => <BitChoice key={name} label={name} value={input[i]}
        change={v => setInput(input.map((old, k) => k === i ? v : old))} />)}</div>
      <div className="table-wrap"><svg viewBox="0 0 620 205" style={svgStyle} role="img" aria-label="共享双输出二输入门电路，显示实时逻辑值">
        <path d="M150 60 H270 M210 60 V140 H445 M150 150 H200 V180 H420 V160 H445 M200 150 V105 H420 V70 H445 M400 60 H445"
          fill="none" stroke={blue} strokeWidth="2" />
        <circle cx="210" cy="60" r="3" fill={blue} /><circle cx="200" cy="150" r="3" fill={blue} />
        {[
          [85, 60, 'AND(x,w)', bit(input[0] && input[3])],
          [85, 150, 'AND(z,w)', bit(input[2] && input[3])],
          [335, 60, 'AND(p,y)', bit(input[0] && input[1] && input[3])],
          [510, 60, 'OR(r,q) = v', shared1(input)],
          [510, 150, 'OR(p,q) = u', shared2(input)],
        ].map(([x, y, text, value], i) => <g key={i}>
          <rect x={Number(x) - 65} y={Number(y) - 23} width="130" height="46" rx="8" fill={value ? '#def2e7' : '#edf1f5'} stroke={blue} />
          <text x={Number(x)} y={Number(y) - 3} fontSize="12" textAnchor="middle">{text}</text>
          <text x={Number(x)} y={Number(y) + 15} fontSize="14" textAnchor="middle">{value}</text></g>)}
        <text x="225" y="45" fill={blue} fontSize="12">p</text><text x="225" y="178" fill={blue} fontSize="12">q</text>
      </svg></div>
      <MathText text={String.raw`$p=xw,\ q=zw,\ r=py;\quad v=r+q,\ u=p+q.$ 五个门均为二输入门。`} />
    </div>}
    <details><summary>查看当前余因子的完整真值表</summary><div className="table-wrap"><table><thead><tr>
      <th>{names.slice(0, n).join('')}</th>{labels.map(l => <th key={l}>{l}</th>)}</tr></thead><tbody>
      {truth.map(a => <tr key={bitsText(a)}><td className="mono">{bitsText(a)}</td>{fn.map((f, i) => <td key={i}>{f(a)}</td>)}</tr>)}
    </tbody></table></div></details>
  </section>;
}

const cutOptions = [
  { label: '课堂：bound x₂,x₄,x₅ / free x₁,x₃', bound: [1, 3, 4] },
  { label: '两LUT：bound x₂,x₃,x₄,x₅ / free x₁', bound: [1, 2, 3, 4] },
  { label: '检查不合格切分：bound x₂,x₄', bound: [1, 3] },
  { label: '检查不合格切分：bound x₂', bound: [1] },
  { label: '另一种切分：bound x₂,x₄,x₅,x₁', bound: [1, 3, 4, 0] },
];
function LutLab({ part }: { part: string }) {
  const [cut, setCut] = useState(0), [codes, setCodes] = useState([3, 2, 0]);
  const [dc, setDc] = useState(part.includes('beta') || part.includes('β'));
  const [order, setOrder] = useState(0);
  const d = useMemo(() => decompose(lutFunction, 5, cutOptions[cut].bound), [cut]);
  const gNames = [...Array.from({ length: d.r }, (_, i) => 'z_' + (i + 1)), ...d.free.map(i => 'x_' + (i + 1))];
  const boundNames = d.bound.map(i => 'x_' + (i + 1)), codeCount = 2 ** d.r;
  const gRows = assignments(d.r + d.free.length).map((a, index) => {
    const code = parseInt(a.slice(0, d.r).join('') || '0', 2), classId = codes.indexOf(code);
    const freeIndex = parseInt(a.slice(d.r).join('') || '0', 2);
    return { bits: a, index, value: classId < 0 ? null : d.classes[classId].values[freeIndex] };
  });
  const on = gRows.filter(r => r.value === 1).map(r => r.index), unused = gRows.filter(r => r.value === null).map(r => r.index);
  const minimized = d.feasible ? minimize(gNames.length, on, dc ? unused : []) : null;
  const changeCut = (next: number) => {
    setCut(next); const nextD = decompose(lutFunction, 5, cutOptions[next].bound);
    setCodes(next === 0 ? [3, 2, 0] : nextD.classes.map((_, i) => i));
  };
  const graphOrder = part === 'a' ? order === 0 ? [0, 4, 2, 1, 3] : [1, 3, 4, 0, 2] : [...d.bound, ...d.free];
  const graph = buildBdd([lutFunction], 5, graphOrder);
  return <section className="lab-panel">
    <p className="lab-intro">{part === 'a' ? '切换原题的两种顺序，观察ROBDD的9/10个节点；下方继续用切分实验探索LUT映射。' :
      part === 'b' ? '比较课堂固定分区的3个LUT与全局可行的2个LUT。前级、末级输入限制都必须满足。' :
      part === 'c' ? '按余因子分等价类，再修改各类编码；交换编码会同步改变h和g。' :
      '先关闭DC：不可达编码补0。再打开DC，比较真正重新最小化得到的表达式和文字数。'}</p>
    {part === 'a' && <label className="control">原题变量顺序<select value={order} onChange={e => setOrder(Number(e.target.value))}>
      <option value="0">x₁ → x₅ → x₃ → x₂ → x₄</option><option value="1">x₂ → x₄ → x₅ → x₁ → x₃</option>
    </select></label>}
    <label className="control">绑定／自由变量划分<select value={cut} onChange={e => changeCut(Number(e.target.value))}>
      {cutOptions.map((c, i) => <option key={i} value={i}>{c.label}</option>)}</select></label>
    <div className="lab-grid">
      <div className="stat"><strong>{d.classes.length}</strong> 不同余因子</div>
      <div className="stat"><strong>{d.r}</strong> 最少编码位</div>
      <div className="stat"><strong>{d.r + d.free.length}</strong> 末级输入数</div>
      <div className="stat"><strong>{d.feasible ? d.r + 1 : '不可行'}</strong> 此结构的LUT数</div>
    </div>
    <p className="notice">{d.feasible ? '前级每个输出一只LUT，后级一只LUT。' : '末级输入超过4，不能把这个合成函数装入一个4-LUT。'}
      本题 f=x₁+F(x₂,x₃,x₄,x₅)，选择“两LUT”方案可达到全局最小2；固定free={'{x₁,x₃}'}时为3。</p>
    <p>当前图有 {graph.nodes.length} 个非终端节点。</p>
    <BddDiagram bdd={graph} variables={['x₁', 'x₂', 'x₃', 'x₄', 'x₅']} roots={['f']} cut={part === 'a' ? undefined : d.bound.length} />
    <div className="table-wrap"><table><thead><tr><th>等价类</th><th>bound输入字</th><th>free余因子</th><th>编码，可交换</th></tr></thead><tbody>
      {d.classes.map((c, i) => <tr key={i}><td>C{i + 1}</td><td className="mono">{c.boundWords.join(', ')}</td>
        <td><MathText text={displayMath(sopTex(minimize(d.free.length, c.values.flatMap((v, k) => v ? [k] : [])).words, d.free.map(v => 'x_' + (v + 1))))} /></td>
        <td><select aria-label={'C' + (i + 1) + '编码'} value={codes[i]} onChange={e => {
          const value = Number(e.target.value), occupied = codes.indexOf(value), next = [...codes];
          if (occupied >= 0) next[occupied] = next[i]; next[i] = value; setCodes(next);
        }}>{Array.from({ length: codeCount }, (_, value) => <option key={value} value={value}>{labelWord(value, d.r)}</option>)}</select></td></tr>)}
    </tbody></table></div>
    <p>绑定字位序：{boundNames.join(', ')}；余因子输入位序：{d.free.map(i => 'x' + (i + 1)).join(', ')}。
      未用编码：{Array.from({ length: codeCount }, (_, i) => i).filter(i => !codes.includes(i)).map(i => labelWord(i, d.r)).join(', ') || '无'}。</p>
    {Array.from({ length: d.r }, (_, i) => {
      const hOn = d.rows.flatMap((row, index) => codes[row.classId] >> (d.r - i - 1) & 1 ? [index] : []);
      return <MathText key={i} text={displayMath('z_' + (i + 1) + '=' + sopTex(minimize(d.bound.length, hOn).words, boundNames))} />;
    })}
    <label className="control"><input type="checkbox" checked={dc} onChange={e => setDc(e.target.checked)} />把未用编码作为 don’t-care（关闭时补0）</label>
    {minimized && <div className="result"><MathText text={displayMath('g=' + sopTex(minimized.words, gNames))} />
      <span>合成函数最少 {minimized.cost} 个文字；由当前编码与DC设置重新求解。</span></div>}
    <details><summary>查看合成函数完整真值表</summary><div className="table-wrap"><table><thead><tr><th>{gNames.join(', ')}</th><th>g</th></tr></thead><tbody>
      {gRows.map(r => <tr key={r.index}><td className="mono">{bitsText(r.bits)}</td><td>{r.value === null ? dc ? 'DC' : '0（不可达补值）' : r.value}</td></tr>)}
    </tbody></table></div></details>
  </section>;
}

function FsmLab({ part }: { part: string }) {
  const [state, setState] = useState(0), [reduced, setReduced] = useState(0), [input, setInput] = useState<Bit>(0);
  const [stage, setStage] = useState(part === 'b' ? 1 : 3), [hand, setHand] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const groupLabels = ['A', 'B', 'C', 'D'], encoded = fsmEncoded(reduced, input, hand);
  const run = () => {
    const [next, y] = fsmTable[state][input], [qNext, qY] = minFsmTable[reduced][input];
    setHistory([...history, 'S' + state + ' / ' + groupLabels[reduced] + '：x=' + input + ' → S' + next + ' / ' + groupLabels[qNext] + '，y=' + y + '（简化机=' + qY + '）'].slice(-12));
    setState(next); setReduced(qNext);
  };
  const pos = [[85, 65], [85, 225], [320, 65], [320, 225]];
  return <section className="lab-panel"><p className="lab-intro">{
    ({ a: '读出每个状态在x=0/1时的下一状态与当前输出。步进时同步运行原机与最小机。',
      b: '从输出等价开始，逐轮检查后继所属的类，直到四个稳定等价类。',
      c: '操作输入并沿最小状态图移动，核对原机和最小机的输出相同。',
      d: '切换正式答案与手写笔记编码，观察状态位与逻辑方程同步改变。',
      e: '每次“时钟步进”把组合逻辑z装入状态寄存器；输出由现态与输入实时决定。',
    } as Record<string, string>)[part]}</p>
    <div className="controls"><label className="control">从原状态开始<select value={state} onChange={e => {
      const s = Number(e.target.value); setState(s); setReduced(fsmGroup[s]); setHistory([]);
    }}>{fsmTable.map((_, i) => <option value={i} key={i}>S{i}</option>)}</select></label>
      <BitChoice label="当前输入 x" value={input} change={setInput} /><button onClick={run}>时钟步进 →</button>
      <button onClick={() => { setState(0); setReduced(0); setHistory([]); }}>复位到S₀</button></div>
    <div className="result">现态 S{state} ↔ {groupLabels[reduced]}（{encoded.current}）；
      当前输出 y={fsmTable[state][input][1]}；下一状态寄存器输入 z={encoded.next}。
      {fsmGroup[state] === reduced ? ' 原机与最小机一致。' : ' 状态不一致。'}</div>
    <div className="table-wrap"><svg viewBox="0 0 460 290" style={svgStyle} role="img" aria-label="最小Mealy状态图，绿色表示当前状态">
      <defs><marker id="b-fsm-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill={blue} /></marker></defs>
      {['M114 65 H290', 'M85 195 V96', 'M295 80 Q170 120 106 201', 'M320 95 V195', 'M296 220 Q205 232 104 86'].map((path, i) =>
        <path key={i} d={path} fill="none" stroke={blue} strokeWidth="1.7" markerEnd="url(#b-fsm-arrow)" />)}
      <text x="184" y="49" fontSize="13">0/0, 1/0</text><text x="10" y="150" fontSize="13">0/0, 1/0</text>
      <text x="193" y="137" fontSize="13">0/0</text><text x="335" y="150" fontSize="13">1/0</text>
      <text x="193" y="248" fontSize="13">0/1, 1/0</text>
      {pos.map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="29" fill={i === reduced ? '#cdeedf' : '#fff'} stroke={i === reduced ? green : blue} strokeWidth="2" />
        <text x={x} y={y + 5} textAnchor="middle" fontSize="18">{groupLabels[i]}</text></g>)}
    </svg></div>
    <div className="controls"><label className="control">划分细化轮次<select value={stage} onChange={e => setStage(Number(e.target.value))}>
      <option value="0">未区分</option><option value="1">1：同输入下输出相同</option><option value="2">2：比较后继的输出等价类</option><option value="3">3：稳定的四类</option>
    </select></label><label className="control"><input type="checkbox" checked={hand} onChange={e => setHand(e.target.checked)} />使用手写编码（B/C互换）</label></div>
    <div className="result">{fsmPartitions[stage].map(g => '{' + g.map(s => 'S' + s).join(', ') + '}').join('　')}</div>
    <div className="table-wrap"><table><thead><tr><th>原状态</th><th>x=0 下一状态/y</th><th>x=1 下一状态/y</th><th>当前划分类</th><th>最小机编码</th></tr></thead><tbody>
      {fsmTable.map((row, s) => <tr key={s} style={s === state ? { background: '#e7f5ee' } : undefined}><td>S{s}</td>
        {row.map(([next, y], i) => <td key={i}>S{next}/{y}</td>)}<td>{fsmPartitions[stage].findIndex(g => g.includes(s)) + 1}</td>
        <td>{groupLabels[fsmGroup[s]]}={fsmEncoded(fsmGroup[s], 0, hand).current}</td></tr>)}
    </tbody></table></div>
    <MathText text={hand ? String.raw`$z_1=\overline{s_1}\overline{s_2}+x\overline{s_2},\quad z_2=s_1\overline{s_2},\quad y=\overline x s_1s_2$` :
      String.raw`$z_1=\overline{s_1}s_2,\quad z_2=\overline{s_1}\overline{s_2}+x\overline{s_1},\quad y=\overline x s_1s_2$`} />
    <p className="notice">时钟更新：s(t+1)=z(t)。原机和最小机分别执行转移，逐步核对；切换编码只改位表示，不改行为。</p>
    {history.length > 0 && <ol>{history.map((line, i) => <li key={i}>{line}</li>)}</ol>}
  </section>;
}

function MultiOutputLab({ part }: { part: string }) {
  const [pair, setPair] = useState('f');
  const d = useMemo(() => multipleCover(pair), [pair]);
  const [selected, setSelected] = useState<string[]>(d.original), [input, setInput] = useState<Bit[]>([0, 0, 0, 0]);
  const rows = d.rows.filter(r => selected.includes(r.word)), cost = rows.reduce((sum, r) => sum + r.literals, 0);
  const mask = rows.reduce((m, r) => m | r.mask, 0n), complete = (mask & d.required) === d.required;
  const covered = [0, 1].map(output => d.columns.flatMap((col, i) => col.output === output && (mask & 1n << BigInt(i)) ? [col.point] : []));
  const outputs = [0, 1].map(output => bit(rows.some(r => r.outputs?.includes(output) && matches(r.word, input))));
  const diagramHeight = Math.max(150, 45 * rows.length + 50);
  return <section className="lab-panel">
    <p className="lab-intro">{({ a: '找到能同时接到两个输出的乘积项；它必须落在两函数on-set的交集。',
      b: '候选表枚举了单输出全部素蕴含项及交集素蕴含项；同一个项只出现一行。',
      c: '勾选覆盖项，实际计算每个输出尚未覆盖的点与全电路文字成本。',
      d: '比较三个函数对共享前后的成本，再操作输入查看所选乘积项构成的电路。',
    } as Record<string, string>)[part]}</p>
    <div className="controls"><label className="control">函数对<select value={pair} onChange={e => {
      setPair(e.target.value); setSelected(multipleCover(e.target.value).original);
    }}><option value="f">f₁,f₂（三变量）</option><option value="g">g₁,g₂（四变量）</option><option value="h">h₁,h₂（四变量）</option></select></label>
      <button onClick={() => setSelected(d.original)}>原题独立 MinSOP</button>
      <button onClick={() => setSelected(d.optimal.words)}>求全局最小共享覆盖</button>
      <button onClick={() => setSelected([])}>清空重新选</button>
    </div>
    <div className="result">{complete ? '覆盖完整' : '还有未覆盖的on-set点'} · 当前 {cost} 个文字 · 精确最小成本 {d.optimal.cost}。
      共享项只计算一次；每一行默认连接到它能够合法覆盖的全部输出。</div>
    <div className="table-wrap"><table><thead><tr><th>选择</th><th>立方体</th><th>乘积项</th><th>文字数</th><th>可接输出</th></tr></thead><tbody>
      {d.rows.map(r => <tr key={r.word} style={selected.includes(r.word) ? { background: '#e7f5ee' } : undefined}>
        <td><input type="checkbox" aria-label={'选择立方体 ' + r.word} checked={selected.includes(r.word)}
          onChange={e => setSelected(e.target.checked ? [...selected, r.word] : selected.filter(w => w !== r.word))} /></td>
        <td className="mono">{r.word}</td><td><MathText text={displayMath(cubeTex(r.word, names))} /></td>
        <td>{r.literals}</td><td>{r.outputs?.map(o => pair + (o + 1)).join('、')}{r.outputs?.length === 2 ? '（共享）' : ''}</td></tr>)}
    </tbody></table></div>
    <div className="lab-grid">{[0, 1].map(o => <div key={o}><strong>{pair}{o + 1}：{covered[o].length}/{d.on[o].length} 点已覆盖</strong>
      <CubeDiagram n={d.n} on={d.on[o]} covered={covered[o]} /></div>)}</div>
    <p className="notice">绿色=已覆盖，橙色=尚未覆盖的on-set，灰色=off-set。共享f项不省文字；g节省1个，h节省3个。</p>
    <div className="controls">{names.slice(0, d.n).map((name, i) => <BitChoice key={name} label={name} value={input[i]}
      change={v => setInput(input.map((old, j) => j === i ? v : old))} />)}</div>
    <div className="table-wrap"><svg viewBox={'0 0 620 ' + diagramHeight} style={svgStyle} role="img" aria-label="当前覆盖构成的双输出AND-OR电路">
      <title>当前覆盖的双输出电路；只有勾选的乘积项被实现</title>
      {rows.flatMap((r, i) => r.outputs?.map(o => <line key={r.word + '-' + o}
        x1="235" y1={30 + i * 45} x2="465" y2={diagramHeight * (o + 1) / 3}
        stroke={matches(r.word, input) ? green : '#b5bec8'} strokeWidth={matches(r.word, input) ? 2.4 : 1.2} />))}
      {rows.map((r, i) => <g key={r.word}><rect x="35" y={10 + i * 45} width="200" height="37" rx="6" stroke={blue}
        fill={matches(r.word, input) ? '#d7f0e1' : '#f2f4f7'} />
        <text x="135" y={34 + i * 45} textAnchor="middle" fontFamily="monospace" fontSize="14">AND {r.word} = {Number(matches(r.word, input))}</text></g>)}
      {[0, 1].map(o => <g key={o}><rect x="465" y={diagramHeight * (o + 1) / 3 - 19} width="130" height="38" rx="8"
        fill={outputs[o] ? '#d7f0e1' : '#f2f4f7'} stroke={blue} />
        <text x="530" y={diagramHeight * (o + 1) / 3 + 5} textAnchor="middle" fontSize="15">OR → {pair}{o + 1}={outputs[o]}</text></g>)}
    </svg></div>
    <p>立方体位序：{names.slice(0, d.n).join(', ')}。无连接的OR输出约定为0；覆盖不完整时，画出的是当前尝试电路。</p>
  </section>;
}

const signalLabel: Record<LatchSignal, string> = { D: 'D', C: 'C', Dn: 'Dₙ', R: 'R̄', S: 'S̄', Qn: 'Qₙ', Q: 'Q' };
function LatchWaveform({ frames, time }: { frames: LatchFrame[]; time: number }) {
  const x = (t: number) => 65 + t * 2.48;
  return <div className="table-wrap"><svg viewBox="0 0 740 450" style={{ ...svgStyle, minWidth: 640 }} role="img" aria-label="当前输入和传播延迟下的D锁存器完整波形">
    <title>横轴时间，R与S上横线表示低有效控制端</title>
    {Array.from({ length: 14 }, (_, i) => i * 20).map(t => <g key={t}>
      <line x1={x(t)} x2={x(t)} y1="30" y2="425" stroke="#e1e6ed" />
      <text x={x(t)} y="20" fontSize="11" textAnchor="middle">{t}</text></g>)}
    {latchSignals.map((signal, index) => {
      const baseline = 72 + 54 * index, high = baseline - 22;
      let value = frames[0].values[signal], path = 'M' + x(0) + ' ' + (value ? high : baseline);
      for (const frame of frames.slice(1)) if (frame.changed.includes(signal)) {
        path += ' H' + x(frame.time) + ' V' + (frame.values[signal] ? high : baseline); value = frame.values[signal];
      }
      path += ' H' + x(260);
      return <g key={signal}><text x="10" y={baseline - 5} fontSize="15">{signalLabel[signal]}</text>
        <text x="43" y={high + 3} fontSize="10">1</text><text x="43" y={baseline + 3} fontSize="10">0</text>
        <path d={path} stroke={index < 2 ? '#5d6976' : blue} strokeWidth="2" fill="none" /></g>;
    })}
    <line x1={x(time)} x2={x(time)} y1="25" y2="425" stroke={red} strokeWidth="1.7" />
    <text x={Math.min(680, x(time) + 5)} y="443" fill={red} fontSize="12">t={time}</text>
  </svg></div>;
}
function LatchLab({ part }: { part: string }) {
  const [rise, setRise] = useState(60), [fall, setFall] = useState(160), [close, setClose] = useState(120);
  const [reopen, setReopen] = useState(200), [delay, setDelay] = useState(10), [time, setTime] = useState(0);
  const frames = useMemo(() => simulateLatch([
    { time: 20, signal: 'C', value: 1 }, { time: rise, signal: 'D', value: 1 },
    { time: close, signal: 'C', value: 0 }, { time: fall, signal: 'D', value: 0 },
    { time: reopen, signal: 'C', value: 1 },
  ], delay), [rise, fall, close, reopen, delay]);
  const current = frames.filter(f => f.time <= time).at(-1)!;
  const selection = (label: string, value: number, setter: (v: number) => void, options: number[]) =>
    <label className="control">{label}<select value={value} onChange={e => setter(Number(e.target.value))}>
      {options.map(v => <option value={v} key={v}>{v}</option>)}</select></label>;
  return <section className="lab-panel">
    <p className="lab-intro">{part === 'a' ? '改变C关闭与重新打开的时间，观察D在透明期被传递，在保持期被阻断。' :
      '从初态Q=0,Qₙ=1开始，按下一事件逐步推进。原题应得到Q在80上升、230下降。'}</p>
    <div className="controls">
      {selection('D上升时间', rise, setRise, [40, 60, 80, 100])}
      {selection('D下降时间', fall, setFall, [140, 160, 180])}
      {selection('C关闭时间', close, setClose, [80, 120, 160])}
      {selection('C重新开启', reopen, setReopen, [180, 200, 220])}
      {selection('每门延迟', delay, setDelay, [5, 10, 20])}
      <button onClick={() => { setRise(60); setFall(160); setClose(120); setReopen(200); setDelay(10); setTime(0); }}>恢复原题</button>
    </div>
    <div className="controls"><button onClick={() => setTime(0)}>回到t=0</button>
      <button onClick={() => setTime(frames.find(f => f.time > time)?.time ?? 260)}>下一事件 →</button>
      <label className="control">观察时间 {time}<input type="range" min="0" max="260" step="1" value={time} onChange={e => setTime(Number(e.target.value))} /></label>
    </div>
    <div className="result">t={time}：{latchSignals.map(s => signalLabel[s] + '=' + current.values[s]).join('，')}。
      C={current.values.C}：{current.values.C ? '透明，输出仍需等待传播延迟' : '保持'}。</div>
    <LatchWaveform frames={frames} time={time} />
    <MathText text={String.raw`$D_n=\overline D,\quad\overline R=\overline{D_nC},\quad\overline S=\overline{DC},\quad Q_n=\overline{\overline RQ},\quad Q=\overline{\overline SQ_n}.$`} />
    <p className="notice">使用传输延迟事件仿真：同一时刻的输入事件一起生效，再求受影响门的输出，经过门延迟执行。稳态互补不等于瞬间互补；原题70–80时R̄、S̄同时为0，80–90时Q、Qₙ同时为1。</p>
    <details open={part === 'b'}><summary>实际事件表（无变化的事务不计为事件）</summary><div className="table-wrap"><table><thead><tr>
      <th>时间</th><th>本时刻变化</th>{latchSignals.map(s => <th key={s}>{signalLabel[s]}</th>)}</tr></thead><tbody>
      {frames.map(f => <tr key={f.time} style={f.time === current.time ? { background: '#e7f5ee' } : undefined}>
        <td>{f.time}</td><td>{f.changed.map(s => signalLabel[s] + '→' + f.values[s]).join(', ') || '稳定初态'}</td>
        {latchSignals.map(s => <td key={s}>{f.values[s]}</td>)}</tr>)}
    </tbody></table></div></details>
  </section>;
}

function SequentialCircuit({ good, faulty, input }: { good: SeqValues; faulty: SeqValues; input: SeqState }) {
  const label = (signal: keyof SeqValues) => signal + '=' + good[signal] + '/' + faulty[signal] + ' (' + pairSymbol(good[signal], faulty[signal]) + ')';
  const color = (signal: keyof SeqValues) => good[signal] === faulty[signal] ? blue : red;
  return <div className="table-wrap"><svg viewBox="0 0 650 350" style={svgStyle} role="img" aria-label="原题两触发器电路；信号标签依次为正常值/故障值">
    <title>永久故障只在z3，所有时间帧持续生效；两触发器同时更新</title>
    <path d="M35 145 H150 M70 145 V245 H150 M230 140 H280 M345 140 H365 M445 140 H525 M230 260 H285 M365 260 H385 V195 H265 V160 H280 M475 140 V60 H180 V117 M475 140 V320 H180 V282 M35 25 H550 V115"
      fill="none" stroke="#8b99a9" strokeWidth="1.8" />
    <text x="12" y="135" fontSize="13">x₁={input[0]}</text><text x="12" y="18" fontSize="13">x₂={input[1]}</text>
    {[[150, 117, 80, 'AND'], [280, 117, 65, 'OR'], [150, 237, 80, 'NAND'], [525, 117, 75, 'AND']].map(([x, y, w, name], i) =>
      <g key={i}><rect x={Number(x)} y={Number(y)} width={Number(w)} height="45" rx="9" fill="#f1f5fa" stroke={blue} />
        <text x={Number(x) + Number(w) / 2} y={Number(y) + 28} textAnchor="middle" fontSize="13">{name}</text></g>)}
    <g><rect x="365" y="110" width="80" height="60" rx="6" fill="#e1edf9" stroke={blue} />
      <text x="405" y="132" textAnchor="middle">FF₁</text><text x="405" y="155" textAnchor="middle" fill={color('s1')}>{pairSymbol(good.s1, faulty.s1)}</text></g>
    <g><rect x="285" y="230" width="80" height="60" rx="6" fill="#e1edf9" stroke={blue} />
      <text x="325" y="252" textAnchor="middle">FF₂</text><text x="325" y="275" textAnchor="middle" fill={color('s2')}>{pairSymbol(good.s2, faulty.s2)}</text></g>
    <text x="195" y="100" fontSize="12" fill={color('z1')}>{label('z1')}</text>
    <text x="300" y="190" fontSize="12" fill={color('z2')}>{label('z2')}</text>
    <text x="180" y="220" fontSize="12" fill={color('z3')}>{label('z3')}</text>
    <text x="450" y="100" fontSize="12" fill={color('s1')}>{label('s1')}</text>
    <text x="380" y="280" fontSize="12" fill={color('s2')}>{label('s2')}</text>
    <text x="540" y="190" fontSize="13" fill={color('y')}>{label('y')}</text>
    <text x="285" y="345" fontSize="12" fill={amber}>同步时钟：两FF同时装入上一帧的z₂、z₃</text>
  </svg></div>;
}
function SequentialLab({ part }: { part: string }) {
  const initialFault = part.includes('ii') ? 1 : 0;
  const [fault, setFault] = useState<Bit>(initialFault);
  const [sequence, setSequence] = useState(initialFault ? '0X XX 1X 0X X1' : '0X 0X X1');
  const [initial, setInitial] = useState(0), [xValue, setXValue] = useState<Bit>(0), [frame, setFrame] = useState(0);
  const parsed = parseSequence(sequence), cubes = parsed.cubes;
  const inputs = cubes.map(c => [...c].map(v => v === 'X' ? xValue : Number(v)) as SeqState);
  const trace = sequentialTrace(inputs, assignments(2)[initial] as SeqState, fault);
  const selectedFrame = Math.min(frame, Math.max(0, trace.length - 1)), current = trace[selectedFrame];
  const guarantee = sequenceGuarantee(cubes, fault), shortest = useMemo(() => shortestSequential(fault), [fault]);
  const setSource = (f: Bit) => { setFault(f); setSequence(f ? '0X XX 1X 0X X1' : '0X 0X X1'); setFrame(0); };
  return <section className="lab-panel">
    <p className="lab-intro">{part.startsWith('a') ? '正常/故障电路从相同初态开始，分别逐拍演算。可任意修改序列，再检查是否保证所有初态和X取值都检测。' :
      '红色差异用D或D̄表示。观察激励如何先进入FF₂，再进入FF₁，最终经x₂=1到输出。'}</p>
    <div className="controls"><label className="control">永久故障<select value={fault} onChange={e => setSource(Number(e.target.value) as Bit)}>
      <option value="0">z₃/0</option><option value="1">z₃/1</option></select></label>
      <label className="control">共同初态 s₁s₂<select value={initial} onChange={e => { setInitial(Number(e.target.value)); setFrame(0); }}>
        {assignments(2).map((s, i) => <option key={i} value={i}>{bitsText(s)}</option>)}</select></label>
      <BitChoice label="图中所有X取值" value={xValue} change={setXValue} />
    </div>
    <label className="control">输入序列：每帧两位 x₁x₂，空格隔开
      <input className="mono" value={sequence} onChange={e => { setSequence(e.target.value); setFrame(0); }} aria-label="输入测试序列" /></label>
    <div className="controls"><button onClick={() => setSource(fault)}>装入原题最短序列</button>
      <button disabled={cubes.length < 2} onClick={() => { setSequence(cubes.slice(1).join(' ')); setFrame(0); }}>删掉首帧试试</button>
      <button onClick={() => { setSequence(fault ? '1X 0X X1' : '0X X1'); setFrame(0); }}>尝试少准备／少传播</button></div>
    {parsed.error ? <p className="notice" role="alert">{parsed.error}</p> : <>
      <div className="result">{guarantee.guaranteed ? '保证检测' : '不能保证检测'}：在 {guarantee.total} 条“共同初态 × X展开”轨迹中，
        {guarantee.failed} 条始终未在输出观察到差异。{guarantee.finalGuaranteed ? '最后一帧也全部可见。' : ''}</div>
      <p className="notice">下面的图只展示当前初态和统一X取值的一条轨迹；上面的保证性检查覆盖所有4种共同初态，并独立展开每一个X。</p>
      <div className="controls"><button disabled={selectedFrame === 0} onClick={() => setFrame(selectedFrame - 1)}>上一帧</button>
        <span>第 {selectedFrame + 1}/{trace.length} 帧 · 已经过 {selectedFrame} 次同步状态更新</span>
        <button disabled={selectedFrame === trace.length - 1} onClick={() => setFrame(selectedFrame + 1)}>下一时钟帧 →</button></div>
      {current && <><SequentialCircuit good={current.good} faulty={current.faulty} input={current.input} />
        <div className="result">输出 y：正常 {current.good.y} / 故障 {current.faulty.y} →
          {current.detected ? '检测到故障，' + pairSymbol(current.good.y, current.faulty.y) : '当前帧尚无输出差异'}。</div></>}
      <div className="table-wrap"><table><thead><tr><th>帧</th><th>x₁x₂</th><th>正常 s₁s₂</th><th>故障 s₁s₂</th><th>z₃ 正/故</th><th>y 正/故</th><th>检测</th></tr></thead><tbody>
        {trace.map(t => <tr key={t.frame} style={t.frame === selectedFrame ? { background: '#e7f5ee' } : undefined}
          onClick={() => setFrame(t.frame)}><td><button onClick={() => setFrame(t.frame)} aria-label={'查看第' + (t.frame + 1) + '帧'}>{t.frame + 1}</button></td>
          <td className="mono">{cubes[t.frame]} → {bitsText(t.input)}</td><td className="mono">{t.good.s1}{t.good.s2}</td>
          <td className="mono">{t.faulty.s1}{t.faulty.s2}</td><td>{t.good.z3}/{t.faulty.z3}</td><td>{t.good.y}/{t.faulty.y}</td><td>{t.detected ? '✓' : '—'}</td></tr>)}
      </tbody></table></div>
    </>}
    <MathText text={String.raw`$z_1=x_1s_1,\ z_2=z_1+s_2,\ z_3=\overline{x_1s_1},\ y=s_1x_2;\quad s_1^{t+1}=z_2^t,\ s_2^{t+1}=z_3^t.$`} />
    <p className="notice">穷举最短性检查：z₃/{fault} 至少 {shortest?.frames} 个输入帧（含最终观察帧），也就是 {(shortest?.frames ?? 1) - 1} 次状态更新。
      {fault ? '先用两帧保证s₁=1，再激励NAND输出0，再跨两级FF传播。' : 'x₁=0激励后，差异必须跨FF₂、FF₁两级。'}
      检查已排除全部更短的x₁序列；x₂恒为1可最大化观测且不影响状态。</p>
  </section>;
}

export default function GroupB({ problemId, partLabel }: { problemId: string; partLabel: string }) {
  const key = problemId + '-' + partLabel;
  if (problemId === 'T4-P3') return <TautologyLab key={key} part={partLabel} />;
  if (problemId === 'T4-P4') return <LutLab key={key} part={partLabel} />;
  if (problemId === 'T4-P5') return <FsmLab key={key} part={partLabel} />;
  if (problemId === 'T4-P6') return <MultiOutputLab key={key} part={partLabel} />;
  if (problemId === 'T5-P2') return <LatchLab key={key} part={partLabel} />;
  if (problemId === 'T11-P1') return <SequentialLab key={key} part={partLabel} />;
  return <p className="notice">本题未匹配到B组实验。</p>;
}
