export type Progress = Record<string,{done?:boolean;note?:string;flag?:boolean}>;
const key='dma-exercise-progress-v1';
export function readProgress():Progress {try{return JSON.parse(localStorage.getItem(key)||'{}')}catch{return {}}}
export function saveProgress(data:Progress){try{localStorage.setItem(key,JSON.stringify(data));return true}catch{return false}}
