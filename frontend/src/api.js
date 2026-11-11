export async function api(path, options={}){const response=await fetch('/api'+path,{headers:{'Content-Type':'application/json'},...options});let data;try{data=await response.json()}catch{throw Error('Backend is unavailable or returned invalid JSON')}if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:'Request failed');return data}
export const getCapabilities=()=>api('/capabilities');
export const getRuns=()=>api('/runs');
export const getRun=id=>api('/runs/'+encodeURIComponent(id));
export const startRun=body=>api('/replays',{method:'POST',body:JSON.stringify(body)});
export const health=()=>api('/health');
export function normalizeStatus(status){return {success:'Passed',business_outcome:'Recovered',failure:'Failed',escalated:'Escalated',running:'Running'}[status]||status}
