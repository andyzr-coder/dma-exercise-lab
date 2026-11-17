export type Progress = Record<string,{done?:boolean;note?:string;flag?:boolean}>;
const key='dma-exercise-progress-v1';
export function readProgress():Progress {
  try {
    const parsed=JSON.parse(localStorage.getItem(key)||'{}');
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return {};
    const result:Progress={};
    for(const [id,value] of Object.entries(parsed)){
      if(!/^Q\d{3}$/.test(id)||!value||typeof value!=='object')continue;
      const record=value as Record<string,unknown>;
      result[id]={done:record.done===true,flag:record.flag===true,note:typeof record.note==='string'?record.note:''};
    }
    return result;
  } catch {return {}}
}
export function saveProgress(data:Progress){try{localStorage.setItem(key,JSON.stringify(data));return true}catch{return false}}
