import{useI18n}from'../i18n';
import {useState} from 'react';
import type {Envelope} from '../protocol';
import {extractDefinition,exportTemplate,parseBounded,exportSchema,librarySchema,type Library,type LibraryBridge,type LibraryRequest,type TemplateRevision} from '../templates';
import {defaultTheme,defaultLayout,type Theme,type Layout} from '../theme';

export function TemplatePanel({view,bridge,theme,layout,onPreview}:{view:Envelope;bridge?:LibraryBridge;theme:Theme;layout:Layout;onPreview:(theme:Theme,layout:Layout)=>void}){
 const {t,locale}=useI18n();
  const [library,setLibrary]=useState<Library>(),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const [selected,setSelected]=useState(''),[version,setVersion]=useState(1),[name,setName]=useState(''),[confirmDelete,setConfirmDelete]=useState(false);
  const [definition,setDefinition]=useState(()=>extractDefinition(view));
  const [imported,setImported]=useState<ReturnType<typeof exportTemplate>>();
  const template=library?.templates.find(t=>t.id===selected),revision=template?.versions.find(v=>v.version===version);
  const changed=JSON.stringify({theme,layout})!==JSON.stringify({theme:view.presentation?.theme??defaultTheme,layout:view.presentation?.layout??defaultLayout});
  async function run(request:LibraryRequest,success:string){
    if(!bridge){setError(t("Personal library is unavailable in this preview. Open a native DSH conversation."));return;}
    setBusy(true);setError('');setMessage('');
    try{const next=librarySchema.parse(await bridge(request));setLibrary(next);setMessage(success);return next;}
    catch(e){setError(e instanceof Error?e.message:t("Could not save. Reload the library to check its state."));}
    finally{setBusy(false);}
  }
  function load(v:TemplateRevision,id:string){setSelected(id);setVersion(v.version);setName(v.name);setDefinition(v.definition);setConfirmDelete(false);onPreview(v.theme,v.layout);setMessage(t("Preview loaded. Historical content and its saved appearance are unchanged."));}
  async function save(copy:boolean){
    if(!library)return;
    const next=await run({action:'save',expectedRevision:library.revision,name,definition,theme,layout,...(!copy&&selected?{id:selected}:{})},t("Saved to your private DSH profile."));
    if(next){const t=copy?next.templates.at(-1):next.templates.find(t=>t.id===selected);if(t){setSelected(t.id);setVersion(t.head);}}
  }
  function download(){if(!revision)return;const blob=new Blob([JSON.stringify(exportTemplate(revision),null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`semantic-template-v${revision.version}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage(t("Exported the saved version. Unsaved preview changes are not included."));}
  const instruction=template&&revision?(locale==='zh-CN'?`请使用我的 DSH Semantic UI 模板${JSON.stringify(revision.name)}（templateId ${template.id}，templateVersion ${revision.version}）。先通过 action=template 查看字段合同，再仅用我提供的新数据生成。缺少事实时请询问，不复用旧数据。新数据：`:`Use my DSH Semantic UI template ${JSON.stringify(revision.name)} (templateId ${template.id}, templateVersion ${revision.version}). Inspect it with action=template, then render using only the new data I provide. Ask for missing facts; do not reuse old data. New data: `):'';
  return <details className="template-panel" onToggle={e=>{if(e.currentTarget.open&&!library&&!busy)void run({action:'list'},t("Library loaded."));}}>
    <summary>{t("Templates & appearance")}</summary>
    <p className="meta">{t("Private to this DSH profile. Save reusable fields and style; supply fresh facts next time. Historical messages keep their original snapshot.")}</p>
    {error?<p role="alert" className="status-error">{t(error)}</p>:null}<p role="status" aria-live="polite">{busy?t("Saving or loading…"):t(message)}</p>
    <fieldset disabled={busy}><legend>{t("Preview appearance")}</legend>
      <label>{t("Color mode")} <select aria-label={t("Color mode")} value={theme.mode} onChange={e=>onPreview({...theme,mode:e.target.value as Theme['mode']},layout)}><option value="light">{t("Light")}</option><option value="dark">{t("Dark")}</option></select></label>
      <label>{t("Palette")} <select aria-label={t("Palette")} value={theme.palette} onChange={e=>onPreview({...theme,palette:e.target.value as Theme['palette']},layout)}><option value="ocean">{t("Ocean")}</option><option value="forest">{t("Forest")}</option><option value="berry">{t("Berry")}</option></select></label>
      <label>{t("Typeface")} <select aria-label={t("Typeface")} value={theme.font} onChange={e=>onPreview({...theme,font:e.target.value as Theme['font']},layout)}><option value="system">{t("System")}</option><option value="serif">{t("Serif")}</option><option value="mono">{t("Monospace")}</option></select></label>
      <label>{t("Density")} <select aria-label={t("Density")} value={theme.density} onChange={e=>onPreview({...theme,density:e.target.value as Theme['density']},layout)}><option value="comfortable">{t("Comfortable")}</option><option value="compact">{t("Compact")}</option></select></label>
      <label>{t("Text size")} <select aria-label={t("Text size")} value={theme.textSize} onChange={e=>onPreview({...theme,textSize:e.target.value as Theme['textSize']},layout)}><option value="standard">{t("Standard")}</option><option value="large">{t("Large")}</option></select></label>
      {definition.component==='ArchitectureExplorer'?<label>{t("Graph direction")} <select aria-label={t("Graph direction")} value={layout.direction} onChange={e=>onPreview(theme,{direction:e.target.value as Layout['direction']})}><option value="auto">{t("Responsive")}</option><option value="horizontal">{t("Horizontal")}</option><option value="vertical">{t("Vertical")}</option></select></label>:null}
      <div className="toolbar"><button onClick={()=>onPreview(view.presentation?.theme??defaultTheme,view.presentation?.layout??defaultLayout)}>{t("Reset to saved appearance")}</button><button disabled={!library} onClick={()=>library&&void run({action:'default',expectedRevision:library.revision,theme},t("Default saved for future renders. Existing history is unchanged."))}>{t("Use theme for future views")}</button></div>
      {changed?<p className="preview-note">{t("Appearance preview · reload restores this message’s saved theme. Save a template or default to reuse it.")}</p>:null}
    </fieldset>
    <fieldset disabled={busy||!library}><legend>{t("Personal templates")}</legend>
      <label>{t("Saved template")} <select aria-label={t("Saved template")} value={selected} onChange={e=>{const id=e.target.value,t=library?.templates.find(t=>t.id===id);if(t)load(t.versions.find(v=>v.version===t.head)!,id);else{setSelected('');setName('');setDefinition(extractDefinition(view));setConfirmDelete(false);}}}><option value="">{t("New from this view")}</option>{library?.templates.map(t=><option value={t.id} key={t.id}>{t.versions.find(v=>v.version===t.head)?.name} · v{t.head}</option>)}</select></label>
      {template?<label>{t("Version")} <select aria-label={t("Template version")} value={version} onChange={e=>load(template.versions.find(v=>v.version===Number(e.target.value))!,template.id)}>{template.versions.map(v=><option key={v.version} value={v.version}>v{v.version}{v.version===template.head?(locale==='zh-CN'?' · 当前':' · current'):''} · {v.name}</option>)}</select></label>:null}
      <label>{t("Template name")} <input aria-label={t("Template name")} maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>
      <details className="contract-preview"><summary>{t("Review what will be saved")}</summary><p>{t("Component, field IDs and labels, units, types, theme and graph layout. Field names can still be private: review before sharing. No title, summary, observations, row values, nodes, options, evidence, condition values, rules or conclusions.")}</p><pre>{JSON.stringify({name,definition,theme,layout},null,2)}</pre></details>
      <div className="toolbar"><button disabled={!name.trim()} onClick={()=>void save(true)}>{t("Save as new template")}</button><button disabled={!selected||!name.trim()} onClick={()=>void save(false)}>{t("Save new version")}</button><button onClick={()=>void run({action:'list'},t("Library refreshed. Select a saved version to load it."))}>{t("Reload library")}</button></div>
      {template&&revision?<><div className="toolbar"><button disabled={version===template.head} onClick={()=>library&&void run({action:'restore',id:template.id,version,expectedRevision:library.revision},locale==='zh-CN'?`v${version}已设为当前版本，其他版本和历史消息仍保留。`:`v${version} is now current. Other versions and historical messages are preserved.`)}>{t("Make this version current")}</button><button onClick={download}>{t("Export saved version")}</button><button onClick={()=>setConfirmDelete(true)}>{t("Delete template")}</button></div>
        {confirmDelete?<div role="group" aria-label={t("Confirm template deletion")}><p>{t("Delete this template and its library versions? Historical views retain their snapshot. Export first if you want to reuse it later.")}</p><button onClick={async()=>{if(library&&await run({action:'delete',id:template.id,expectedRevision:library.revision},t("Template deleted. Historical views remain readable."))){setSelected('');setName('');setDefinition(extractDefinition(view));setConfirmDelete(false);}}}>{t("Confirm delete")}</button> <button onClick={()=>setConfirmDelete(false)}>{t("Cancel deletion")}</button></div>:null}
        <label className="reuse-instruction">{t("Reuse with new data")} <textarea aria-label={t("Reuse instruction")} readOnly value={instruction} rows={4}/></label><button onClick={async()=>{try{await navigator.clipboard.writeText(instruction);setMessage(t("Copied. Paste into a new request and add fresh data."));}catch{setError(t("Clipboard unavailable. Select and copy the instruction above."));}}}>{t("Copy reuse instruction")}</button>
      </>:null}
      <label>{t("Import template file")} <input aria-label={t("Import template file")} type="file" accept="application/json,.json" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';setImported(undefined);setError('');if(!file)return;try{if(file.size>131072)throw Error(t("Import exceeds 128 KiB."));setImported(parseBounded(exportSchema,JSON.parse(await file.text())));}catch(err){setError(err instanceof Error?err.message:t("Invalid template file."));}}}/></label>
      {imported?<div><p>{t("Import “")}{imported.template.name}{t("” as a new template. Existing templates will not be overwritten.")}</p><details><summary>{t("Review imported fields")}</summary><pre>{JSON.stringify(imported,null,2)}</pre></details><button onClick={async()=>{if(library&&await run({action:'import',document:imported,expectedRevision:library.revision},t("Imported as a new template.")))setImported(undefined);}}>{t("Import as new template")}</button> <button onClick={()=>setImported(undefined)}>{t("Cancel import")}</button></div>:null}
    </fieldset>
  </details>;
}
