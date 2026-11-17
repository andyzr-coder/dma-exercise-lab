export type Figure = {file:string;caption?:string;width_mm?:number};
export type Question = {
  id:string; qid:string; number:number; problem_id:string; tutorial:number; problem:string;
  title:string; label:string; context:string; question:string; answer:string;
  key_points:string[]; sources:string[]; figures:Figure[]; answer_figures:Figure[];
  lab_kind:string; notes?:string[]|string;
};
