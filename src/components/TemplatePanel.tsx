import {useState} from 'react';
import type {Envelope} from '../protocol';
import {extractDefinition,exportTemplate,parseBounded,exportSchema,librarySchema,type Library,type LibraryBridge,type LibraryRequest,type TemplateRevision} from '../templates';
import {defaultTheme,defaultLayout,type Theme,type Layout} from '../theme';

export function TemplatePanel({view,bridge,theme,layout,onPreview}:{view:Envelope;bridge?:LibraryBridge;theme:Theme;layout:Layout;onPreview:(theme:Theme,layout:Layout)=>void}){
  const [library,setLibrary]=useState<Library>(),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const [selected,setSelected]=useState(''),[version,setVersion]=useState(1),[name,setName]=useState(''),[confirmDelete,setConfirmDelete]=useState(false);
  const [definition,setDefinition]=useState(()=>extractDefinition(view));
  const [imported,setImported]=useState<ReturnType<typeof exportTemplate>>();
  const template=library?.templates.find(t=>t.id===selected),revision=template?.versions.find(v=>v.version===version);
  const changed=JSON.stringify({theme,layout})!==JSON.stringify({theme:view.presentation?.theme??defaultTheme,layout:view.presentation?.layout??defaultLayout});
  async function run(request:LibraryRequest,success:string){
    if(!bridge){setError('Personal library is unavailable in this preview. Open a native DSH conversation.');return;}
    setBusy(true);setError('');setMessage('');
    try{const next=librarySchema.parse(await bridge(request));setLibrary(next);setMessage(success);return next;}
    catch(e){setError(e instanceof Error?e.message:'Could not save. Reload the library to check its state.');}
    finally{setBusy(false);}
  }
  function load(v:TemplateRevision,id:string){setSelected(id);setVersion(v.version);setName(v.name);setDefinition(v.definition);setConfirmDelete(false);onPreview(v.theme,v.layout);setMessage('Preview loaded. Historical content and its saved appearance are unchanged.');}
  async function save(copy:boolean){
    if(!library)return;
    const next=await run({action:'save',expectedRevision:library.revision,name,definition,theme,layout,...(!copy&&selected?{id:selected}:{})},'Saved to your private DSH profile.');
    if(next){const t=copy?next.templates.at(-1):next.templates.find(t=>t.id===selected);if(t){setSelected(t.id);setVersion(t.head);}}
  }
  function download(){if(!revision)return;const blob=new Blob([JSON.stringify(exportTemplate(revision),null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`semantic-template-v${revision.version}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('Exported the saved version. Unsaved preview changes are not included.');}
  const instruction=template&&revision?`Use my DSH Semantic UI template ${JSON.stringify(revision.name)} (templateId ${template.id}, templateVersion ${revision.version}). Inspect it with action=template, then render using only the new data I provide. Ask for missing facts; do not reuse old data. New data: `:'';
  return <details className="template-panel" onToggle={e=>{if(e.currentTarget.open&&!library&&!busy)void run({action:'list'},'Library loaded.');}}>
    <summary>Templates & appearance</summary>
    <p className="meta">Private to this DSH profile. Save reusable fields and style; supply fresh facts next time. Historical messages keep their original snapshot.</p>
    {error?<p role="alert" className="status-error">{error}</p>:null}<p role="status" aria-live="polite">{busy?'Saving or loading…':message}</p>
    <fieldset disabled={busy}><legend>Preview appearance</legend>
      <label>Color mode <select aria-label="Color mode" value={theme.mode} onChange={e=>onPreview({...theme,mode:e.target.value as Theme['mode']},layout)}><option value="light">Light</option><option value="dark">Dark</option></select></label>
      <label>Palette <select aria-label="Palette" value={theme.palette} onChange={e=>onPreview({...theme,palette:e.target.value as Theme['palette']},layout)}><option value="ocean">Ocean</option><option value="forest">Forest</option><option value="berry">Berry</option></select></label>
      <label>Typeface <select aria-label="Typeface" value={theme.font} onChange={e=>onPreview({...theme,font:e.target.value as Theme['font']},layout)}><option value="system">System</option><option value="serif">Serif</option><option value="mono">Monospace</option></select></label>
      <label>Density <select aria-label="Density" value={theme.density} onChange={e=>onPreview({...theme,density:e.target.value as Theme['density']},layout)}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
      <label>Text size <select aria-label="Text size" value={theme.textSize} onChange={e=>onPreview({...theme,textSize:e.target.value as Theme['textSize']},layout)}><option value="standard">Standard</option><option value="large">Large</option></select></label>
      {definition.component==='ArchitectureExplorer'?<label>Graph direction <select aria-label="Graph direction" value={layout.direction} onChange={e=>onPreview(theme,{direction:e.target.value as Layout['direction']})}><option value="auto">Responsive</option><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></label>:null}
      <div className="toolbar"><button onClick={()=>onPreview(view.presentation?.theme??defaultTheme,view.presentation?.layout??defaultLayout)}>Reset to saved appearance</button><button disabled={!library} onClick={()=>library&&void run({action:'default',expectedRevision:library.revision,theme},'Default saved for future renders. Existing history is unchanged.')}>Use theme for future views</button></div>
      {changed?<p className="preview-note">Appearance preview · reload restores this message’s saved theme. Save a template or default to reuse it.</p>:null}
    </fieldset>
    <fieldset disabled={busy||!library}><legend>Personal templates</legend>
      <label>Saved template <select aria-label="Saved template" value={selected} onChange={e=>{const id=e.target.value,t=library?.templates.find(t=>t.id===id);if(t)load(t.versions.find(v=>v.version===t.head)!,id);else{setSelected('');setName('');setDefinition(extractDefinition(view));setConfirmDelete(false);}}}><option value="">New from this view</option>{library?.templates.map(t=><option value={t.id} key={t.id}>{t.versions.find(v=>v.version===t.head)?.name} · v{t.head}</option>)}</select></label>
      {template?<label>Version <select aria-label="Template version" value={version} onChange={e=>load(template.versions.find(v=>v.version===Number(e.target.value))!,template.id)}>{template.versions.map(v=><option key={v.version} value={v.version}>v{v.version}{v.version===template.head?' · current':''} · {v.name}</option>)}</select></label>:null}
      <label>Template name <input aria-label="Template name" maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>
      <details className="contract-preview"><summary>Review what will be saved</summary><p>Component, field IDs and labels, units, types, theme and graph layout. Field names can still be private: review before sharing. No title, summary, observations, row values, nodes, options, evidence, condition values, rules or conclusions.</p><pre>{JSON.stringify({name,definition,theme,layout},null,2)}</pre></details>
      <div className="toolbar"><button disabled={!name.trim()} onClick={()=>void save(true)}>Save as new template</button><button disabled={!selected||!name.trim()} onClick={()=>void save(false)}>Save new version</button><button onClick={()=>void run({action:'list'},'Library refreshed. Select a saved version to load it.')}>Reload library</button></div>
      {template&&revision?<><div className="toolbar"><button disabled={version===template.head} onClick={()=>library&&void run({action:'restore',id:template.id,version,expectedRevision:library.revision},`v${version} is now current. Other versions and historical messages are preserved.`)}>Make this version current</button><button onClick={download}>Export saved version</button><button onClick={()=>setConfirmDelete(true)}>Delete template</button></div>
        {confirmDelete?<div role="group" aria-label="Confirm template deletion"><p>Delete this template and its library versions? Historical views retain their snapshot. Export first if you want to reuse it later.</p><button onClick={async()=>{if(library&&await run({action:'delete',id:template.id,expectedRevision:library.revision},'Template deleted. Historical views remain readable.')){setSelected('');setName('');setDefinition(extractDefinition(view));setConfirmDelete(false);}}}>Confirm delete</button> <button onClick={()=>setConfirmDelete(false)}>Cancel deletion</button></div>:null}
        <label className="reuse-instruction">Reuse with new data <textarea aria-label="Reuse instruction" readOnly value={instruction} rows={4}/></label><button onClick={async()=>{try{await navigator.clipboard.writeText(instruction);setMessage('Copied. Paste into a new request and add fresh data.');}catch{setError('Clipboard unavailable. Select and copy the instruction above.');}}}>Copy reuse instruction</button>
      </>:null}
      <label>Import template file <input aria-label="Import template file" type="file" accept="application/json,.json" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';setImported(undefined);setError('');if(!file)return;try{if(file.size>131072)throw Error('Import exceeds 128 KiB.');setImported(parseBounded(exportSchema,JSON.parse(await file.text())));}catch(err){setError(err instanceof Error?err.message:'Invalid template file.');}}}/></label>
      {imported?<div><p>Import “{imported.template.name}” as a new template. Existing templates will not be overwritten.</p><details><summary>Review imported fields</summary><pre>{JSON.stringify(imported,null,2)}</pre></details><button onClick={async()=>{if(library&&await run({action:'import',document:imported,expectedRevision:library.revision},'Imported as a new template.'))setImported(undefined);}}>Import as new template</button> <button onClick={()=>setImported(undefined)}>Cancel import</button></div>:null}
    </fieldset>
  </details>;
}
