import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { MathText } from '../src/MathText';
import data from '../src/data/questions.json';
import type { Question } from '../src/types';
const questions=data as Question[];
const issues:string[]=[];
if(questions.length!==80)issues.push('Expected 80 questions');
if(new Set(questions.map(q=>q.problem_id)).size!==19)issues.push('Expected 19 parent problems');
for(const q of questions){
  if(!q.answer||!q.question||!q.key_points.length)issues.push(q.qid+': missing content');
  for(const f of [...q.figures,...q.answer_figures])if(!fs.existsSync(path.join('public',f.file)))issues.push(q.qid+': '+f.file+' missing');
  for(const value of [q.context,q.question,q.answer,...q.key_points,...q.figures.map(f=>f.caption||''),...q.answer_figures.map(f=>f.caption||'')]){
    const html=renderToStaticMarkup(createElement(MathText,{text:value}));
    if(html.includes('katex-error'))issues.push(q.qid+': math render error');
  }
}
if(issues.length){console.error(issues);process.exit(1)}
console.log('Content verified: 80 questions, 19 problem groups, all math and figures.');
