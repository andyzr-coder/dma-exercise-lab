import fs from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import Lab from '../src/Lab';
import questions from '../src/data/questions.json';
const report:{qid:string;problem:string;controls:number;ok:boolean}[]=[];
for(const q of questions){
  const html=renderToStaticMarkup(createElement(Lab,{problemId:q.problem_id,partLabel:q.label}));
  const controls=(html.match(/<(?:button|input|select)\b/g)||[]).length;
  const ok=controls>0&&!html.includes('katex-error')&&!html.includes('本地构建')&&!html.includes('未匹配');
  report.push({qid:q.qid,problem:q.problem_id,controls,ok});
}
fs.mkdirSync('.qa',{recursive:true});fs.writeFileSync('.qa/lab-coverage.json',JSON.stringify(report,null,2));
const errors=report.filter(r=>!r.ok);
if(errors.length){console.error(errors);process.exit(1)}
console.log('All 80 exercise labs render with interactive controls and valid math.');
