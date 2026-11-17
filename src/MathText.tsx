import katex from 'katex';
import { Fragment } from 'react';

function clean(text:string) {
  return text.replace(/\\(?:begingroup|endgroup|small)\b/g,'').replace(/\\setlength\{\\tabcolsep\}\{[^}]*\}/g,'').replace(/\\(?:begin|end)\{center\}/g,'').trim();
}
function Inline({text}:{text:string}) {
  const tokens=text.split(/(\\\[[\s\S]*?\\\]|\$[^$]*\$)/g);
  return <>{tokens.map((t,i)=> {
    const display=t.startsWith('\\['), math=display||t.startsWith('$');
    if(math){const source=t.slice(display?2:1,display?-2:-1).replace(/@\{\\qquad\}/g,''); return <span key={i} className={display?'math-display':'math-inline'} dangerouslySetInnerHTML={{__html:katex.renderToString(source,{displayMode:display,throwOnError:false,strict:'ignore',trust:false})}}/>;}
    return <Fragment key={i}>{t}</Fragment>;
  })}</>;
}
export function MathText({text}:{text:string}) {
  const pieces=clean(text).split(/(\\begin\{tabular\}\{[^}]*\}[\s\S]*?\\end\{tabular\})/g);
  return <div className="math-text">{pieces.map((p,i)=>{
    if(!p.startsWith('\\begin{tabular}'))return <div className="prose-lines" key={i}><Inline text={p}/></div>;
    const rows=p.replace(/^\\begin\{tabular\}\{[^}]*\}/,'').replace(/\\end\{tabular\}$/,'').replace(/\\hline/g,'').split(/\\\\/).map(r=>r.trim()).filter(Boolean);
    return <div key={i} className="table-wrap"><table><tbody>{rows.map((row,j)=><tr key={j}>{row.split('&').map((cell,k)=>j===0?<th key={k}><Inline text={cell.trim()}/></th>:<td key={k}><Inline text={cell.trim()}/></td>)}</tr>)}</tbody></table></div>;
  })}</div>;
}
