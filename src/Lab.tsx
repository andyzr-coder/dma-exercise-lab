import GroupA from './labs/GroupA';
import GroupC from './labs/GroupC';
import GroupB from './labs/GroupB';
export default function Lab({problemId,partLabel}:{problemId:string;partLabel:string}) {
  if(['T1-P1','T1-P2','T1-P3','T2-P1','T3-P1','T3-P3','T3-P4'].includes(problemId))return <GroupA problemId={problemId} partLabel={partLabel}/>;
  if(['T5-P1','T7-P1','T8-P1','T9-P1','T10-P2','T10-P3'].includes(problemId))return <GroupC problemId={problemId} partLabel={partLabel}/>;
  return <GroupB problemId={problemId} partLabel={partLabel}/>;
}
