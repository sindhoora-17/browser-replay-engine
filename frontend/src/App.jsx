import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity, AlertCircle, ArrowDownRight, ArrowRight, Check, CheckCircle2,
  ChevronRight, CircleHelp, Clock3, Code2, ExternalLink, FileCode2,
  Home, Menu, Play, RefreshCw, Search, ShieldCheck, X
} from 'lucide-react';
import { getCapabilities, getRuns, getRun, startRun, health, normalizeStatus } from './api';

const NAV = [
  ['overview', 'Overview', Home],
  ['recordings', 'Capabilities', FileCode2],
  ['replays', 'Replay runs', Activity],
  ['policies', 'Guardrails', ShieldCheck],
  ['analytics', 'Analytics', Code2],
];
const formatDate = value => value ? new Date(value).toLocaleString(undefined, {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : '—';
const duration = r => r?.started_at && r?.finished_at ? ((new Date(r.finished_at) - new Date(r.started_at)) / 1000).toFixed(1) + 's' : '—';
const human = s => String(s || '').replaceAll('_', ' ');
const variants = {success:'good',business_outcome:'neutral',failure:'bad',running:'running',escalated:'warning'};
const spring = {type:'spring', stiffness:320, damping:30};

function Logo() {
  // One intentional mascot reference, used only as the product mark.
  return <div className="logo-mark" aria-label="Replay Mochi cat logo" role="img">
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M8 17 10 8 18 12M32 17 30 8 22 12" stroke="#9E7399" strokeWidth="2" strokeLinejoin="round" fill="#FFF9FB"/>
      <rect x="6" y="12" width="28" height="22" rx="11" fill="#FFF9FB" stroke="#9E7399" strokeWidth="2"/>
      <circle cx="15" cy="23" r="1.5" fill="#715A71"/><circle cx="25" cy="23" r="1.5" fill="#715A71"/>
      <path d="m18 27 2 1 2-1m-2 1v2m0 0q-2 2-4 0m4 0q2 2 4 0" stroke="#A6789D" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <ellipse cx="11" cy="27" rx="3" ry="2" fill="#F5C1D8"/><ellipse cx="29" cy="27" rx="3" ry="2" fill="#F5C1D8"/>
    </svg>
  </div>;
}
function Status({value}) {
  return <span className={'status '+(variants[value] || 'neutral')}>
    <span className="status-dot"/>{normalizeStatus(value || 'unknown')}
  </span>;
}
function Panel({children,className=''}) {return <section className={'panel '+className}>{children}</section>}
function SectionHeading({title,subtitle,action}) {return <div className="section-heading"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>}
function Empty({title='Nothing here yet',description,action}) {
  return <div className="empty-state"><span className="empty-symbol"><FileCode2 size={22} strokeWidth={1.5}/></span><strong>{title}</strong><p>{description}</p>{action}</div>;
}
function RunRow({run,onClick,selected=false}) {
  return <button className={'data-row run-row'+(selected?' selected':'')} onClick={onClick}>
    <span className="row-icon"><Activity size={17} strokeWidth={1.8}/></span>
    <span className="row-info"><strong>{run.capability_id.split('/').pop()?.replace('.json','').replaceAll('_',' ')}</strong><small>{run.id} · {formatDate(run.started_at)}</small></span>
    <span className="row-duration">{duration(run)}</span>
    <Status value={run.status}/>
    <ChevronRight className="row-chevron" size={16}/>
  </button>;
}
function EventRow({event,index}) {
  return <div className="event-row"><span className="event-index">{String(index+1).padStart(2,'0')}</span><div><strong>{human(event.event)}</strong><p>{event.intent || event.action || event.step_id || event.reason || 'Replay engine event'}</p></div><span className="event-step">{event.step_id || ''}</span></div>;
}
function Stat({label,value,detail}) {return <div className="stat"><span className="stat-label">{label}</span><strong>{value}</strong><small>{detail}</small></div>}

export default function App() {
  const [page,setPage] = useState('overview');
  const [mobile,setMobile] = useState(false);
  const [capabilities,setCapabilities] = useState([]);
  const [runs,setRuns] = useState([]);
  const [selected,setSelected] = useState(null);
  const [selectedRun,setSelectedRun] = useState(null);
  const [online,setOnline] = useState(false);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [member,setMember] = useState('10001');
  const [capId,setCapId] = useState('');
  const [allowDraft,setAllowDraft] = useState(true);
  const [modal,setModal] = useState(false);
  const [query,setQuery] = useState('');

  async function refresh() {
    try {
      const [h,c,r] = await Promise.all([health(),getCapabilities(),getRuns()]);
      setOnline(h.ok);setCapabilities(c.items);setRuns(r.items);
      setCapId(current => current || c.items[0]?.id || '');
      setError('');
    } catch (e) {setOnline(false);setError(e.message);}
  }
  useEffect(() => {refresh();const timer=setInterval(refresh,3000);return()=>clearInterval(timer)},[]);
  useEffect(() => {
    if(!selected) return;
    getRun(selected).then(setSelectedRun).catch(()=>{});
  },[selected,runs]);

  const latest=runs[0];
  const completed=runs.filter(r=>r.status!=='running');
  const successful=runs.filter(r=>r.status==='success');
  const failed=runs.filter(r=>r.status==='failure');
  const filtered=useMemo(()=>capabilities.filter(c=>(c.name+' '+c.id+' '+c.description).toLowerCase().includes(query.toLowerCase())),[query,capabilities]);
  const currentCap=capabilities.find(c=>c.id===capId);
  const title=NAV.find(([id])=>id===page)?.[1] || 'Overview';

  function selectRun(run) {setSelected(run.id);setPage('replays');setMobile(false)}
  async function launch() {
    setBusy(true);
    try {
      const result=await startRun({capability_id:capId,member_id:member,allow_draft:allowDraft});
      setModal(false);setPage('replays');setSelected(result.id);await refresh();
    } catch(e) {setError(e.message)}
    finally {setBusy(false)}
  }

  const launchButton = <button className="primary-button" disabled={!online || !capabilities.length} onClick={()=>setModal(true)}><Play size={15} fill="currentColor"/> New replay</button>;
  return <div className="shell">
    <aside className={'sidebar'+(mobile?' open':'')}>
      <div className="brand"><Logo/><div><strong>Replay Mochi</strong><span>Browser Replay Engine</span></div><button className="close-mobile icon-button" onClick={()=>setMobile(false)} aria-label="Close navigation"><X size={18}/></button></div>
      <div className="nav-title">WORKSPACE</div>
      <nav>{NAV.map(([id,label,Icon])=><button key={id} className={'nav-link'+(id===page?' active':'')} onClick={()=>{setPage(id);setMobile(false)}}><Icon size={17} strokeWidth={1.9}/>{label}</button>)}</nav>
      <div className="sidebar-footer"><span className={'connection-dot '+(online?'connected':'')}/><span>{online?'Local engine connected':'Engine disconnected'}</span><button className="icon-button" onClick={refresh} title="Refresh connection" aria-label="Refresh connection"><RefreshCw size={14}/></button></div>
    </aside>
    {mobile&&<button className="overlay" onClick={()=>setMobile(false)} aria-label="Close navigation"/>}
    <div className="content-shell">
      <header className="topbar">
        <div className="breadcrumbs"><button onClick={()=>setMobile(true)} aria-label="Open navigation" className="mobile-menu icon-button"><Menu size={20}/></button><span>Workspace</span><ChevronRight size={14}/><strong>{title}</strong></div>
        <div className="top-actions"><span className={'connection-pill '+(online?'ok':'down')}><i/>{online?'Connected':'Offline'}</span><button className="icon-button refresh" onClick={refresh} title="Refresh" aria-label="Refresh data"><RefreshCw size={16}/></button></div>
      </header>
      <main className="workspace">
        <div className="page-heading"><div><span className="eyebrow">BROWSER REPLAY ENGINE</span><h1>{page==='overview'?'Overview':title}</h1><p>{page==='overview'?'A quieter place to run, inspect and troubleshoot browser workflows.':{recordings:'Browse the verified capability files available to replay.',replays:'Inspect execution history and individual replay events.',policies:'Safety checks enforced by your Python replay engine.',analytics:'A simple view of the runs from this API session.'}[page]}</p></div>{(page==='overview'||page==='replays')&&launchButton}</div>
        {error&&<div className="notice error"><AlertCircle size={17}/><span>{error}</span><button className="icon-button" onClick={refresh}><RefreshCw size={15}/></button></div>}
        <AnimatePresence mode="wait"><motion.div key={page} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4}} transition={{duration:.2}}>
          {page==='overview'&&<>
            <div className="stats-panel"><Stat label="Total runs" value={runs.length} detail="This API session"/><Stat label="Successful" value={successful.length} detail="Completed without errors"/><Stat label="Failed" value={failed.length} detail="Need attention"/><Stat label="Available capabilities" value={capabilities.length} detail="Loaded from repository"/></div>
            <div className="main-columns">
              <Panel><SectionHeading title="Recent activity" subtitle="Your latest replay executions" action={<button className="text-button" onClick={()=>setPage('replays')}>View all <ArrowRight size={15}/></button>}/><div className="data-list">{runs.length?runs.slice(0,6).map(r=><RunRow run={r} key={r.id} onClick={()=>selectRun(r)}/>):<Empty title="No replays yet" description="Start a replay to see its status and results here." action={launchButton}/>}</div></Panel>
              <div className="side-panels">
                <Panel className="quick-start"><SectionHeading title="Quick start" subtitle="Run your first saved workflow"/><div className="quick-step"><span>1</span><div><strong>Select a capability</strong><p>Choose an existing artifact from your project.</p></div></div><div className="quick-step"><span>2</span><div><strong>Run against the test app</strong><p>The Python engine handles the browser actions.</p></div></div><div className="quick-step"><span>3</span><div><strong>Review the outcome</strong><p>Inspect real execution events and failures.</p></div></div><button className="secondary-button" onClick={()=>setPage('recordings')}>Browse capabilities <ArrowRight size={15}/></button></Panel>
                <Panel className="latest-panel"><SectionHeading title="Latest run"/>{latest?<><div className="latest-status"><Status value={latest.status}/><span>{formatDate(latest.started_at)}</span></div><strong className="latest-title">{latest.capability_id.replace('.json','').split('/').pop()?.replaceAll('_',' ')}</strong><button className="text-button" onClick={()=>selectRun(latest)}>Inspect run <ArrowRight size={15}/></button></>:<p className="soft-message">No runs recorded yet.</p>}</Panel>
              </div>
            </div>
          </>}
          {page==='recordings'&&<>
            <Panel className="table-panel"><div className="toolbar"><div><strong>Capability library</strong><span>{filtered.length} {filtered.length===1?'capability':'capabilities'}</span></div><label className="search-field"><Search size={16}/><input placeholder="Search capabilities" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>{filtered.length?filtered.map(c=><div className="capability-row" key={c.id}><div className="capability-icon"><FileCode2 size={20}/></div><div className="capability-info"><strong>{c.name}</strong><span>{c.description}</span><small>{c.id} · {c.steps} steps · {c.target}</small></div><div className="capability-action"><span className={'approval '+(c.approval_state==='approved'?'approved':'draft')}>{c.approval_state}</span><button className="secondary-button" onClick={()=>{setCapId(c.id);setModal(true)}}>Replay <ArrowRight size={14}/></button></div></div>):<Empty title="No matching capabilities" description="Try another search term."/>}</Panel>
          </>}
          {page==='replays'&&<div className="runs-columns"><Panel className="runs-list-panel"><SectionHeading title="Run history" subtitle={runs.length+' runs this session'}/>{runs.length?<div className="data-list">{runs.map(r=><RunRow key={r.id} run={r} selected={selected===r.id} onClick={()=>setSelected(r.id)}/>)}</div>:<Empty title="No runs yet" description="Your replay executions will appear here." action={launchButton}/>}</Panel><Panel className="run-detail"><SectionHeading title="Run details" subtitle={selectedRun?.id||'Choose a run to inspect'}/>{selectedRun?<><div className="run-meta"><Status value={selectedRun.status}/><span>{duration(selectedRun)}</span><span>{formatDate(selectedRun.started_at)}</span></div><strong className="detail-capability">{selectedRun.capability_id}</strong>{selectedRun.outcome_code&&<div className="notice">Outcome: {selectedRun.outcome_code}</div>}{selectedRun.error&&<div className="notice error"><AlertCircle size={16}/>{selectedRun.error.code}: {selectedRun.error.message}</div>}<div className="detail-divider"/><h3>Execution events</h3><div className="event-list">{selectedRun.events?.length?selectedRun.events.map((e,i)=><EventRow key={i} event={e} index={i}/>):<p className="soft-message">{selectedRun.status==='running'?'Execution in progress…':'No events available for this run.'}</p>}</div></>:<Empty title="Select a replay" description="Click an item from the run history to see what happened."/>}</Panel></div>}
          {page==='policies'&&<><div className="notice calm-notice"><ShieldCheck size={17}/>These controls are enforced by the existing Python policy engine. They cannot be switched off from the dashboard.</div><Panel className="table-panel"><SectionHeading title="Active protections" subtitle="Backend-controlled guardrails"/>{[['Approved navigation','Only configured origins and path prefixes are permitted.'],['Action verification','Navigation, clicks, fills and reads are checked before execution.'],['Target verification','The target page is fingerprinted before actions proceed.'],['Sensitive data redaction','Configured fields are redacted from persisted evidence.']].map(([name,description])=><div className="policy-row" key={name}><span className="policy-icon"><ShieldCheck size={17}/></span><div><strong>{name}</strong><p>{description}</p></div><span className="enforced"><Check size={13}/> Enforced</span></div>)}</Panel></>}
          {page==='analytics'&&<><div className="stats-panel"><Stat label="Total" value={runs.length} detail="This API session"/><Stat label="Successful" value={successful.length} detail="Passed"/><Stat label="Other outcomes" value={runs.filter(r=>r.status==='business_outcome').length} detail="Expected business results"/><Stat label="Failed" value={failed.length} detail="Unsuccessful executions"/></div><Panel><SectionHeading title="Outcomes" subtitle="Distribution of completed replay statuses"/>{completed.length?<div className="outcomes">{[['Successful',successful.length,'success'],['Business outcomes',runs.filter(r=>r.status==='business_outcome').length,'business'],['Failed',failed.length,'failure'],['Escalated',runs.filter(r=>r.status==='escalated').length,'escalated']].map(([label,value,kind])=><div className="outcome" key={label}><span>{label}</span><div className="meter"><span className={kind} style={{width:(value/completed.length*100)+'%'}}/></div><strong>{value}</strong></div>)}</div>:<Empty title="Not enough data" description="Complete a replay to see the outcomes breakdown."/>}</Panel></>}
        </motion.div></AnimatePresence>
        <footer>Replay Mochi <span>Local development dashboard · Powered by Browser Replay Engine</span></footer>
      </main>
    </div>
    {modal&&<div className="modal-backdrop" onMouseDown={()=>setModal(false)}><motion.div className="dialog" initial={{opacity:0,scale:.97,y:8}} animate={{opacity:1,scale:1,y:0}} transition={spring} onMouseDown={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Start replay"><div className="dialog-header"><div><h2>Start a replay</h2><p>Run an existing capability against the local test app.</p></div><button className="icon-button" onClick={()=>setModal(false)} aria-label="Close dialog"><X size={19}/></button></div><label className="field">Capability<select value={capId} onChange={e=>setCapId(e.target.value)}>{capabilities.map(c=><option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}</select></label><label className="field">Member ID<input value={member} maxLength={80} onChange={e=>setMember(e.target.value)}/></label><label className="draft-field"><input type="checkbox" checked={allowDraft} onChange={e=>setAllowDraft(e.target.checked)}/> Allow draft artifact for local testing</label><p className="dialog-help">The synthetic target app must be running on port 5000. Backend policy checks remain active.</p><div className="dialog-actions"><button className="secondary-button" onClick={()=>setModal(false)}>Cancel</button><button className="primary-button" disabled={busy||!currentCap||!member} onClick={launch}><Play size={15}/>{busy?'Starting…':'Start replay'}</button></div></motion.div></div>}
  </div>;
}
