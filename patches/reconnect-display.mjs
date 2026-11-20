// Version-scoped display fix. Run with no args to stage; --apply to deploy;
// --restore to restore the exact originals (only while patched hashes match).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import ts from '/usr/local/lib/node_modules/typescript/lib/typescript.js'

export const install = '/usr/local/lib/node_modules/@deepseek-ai/dsh'
const here = path.dirname(fileURLToPath(import.meta.url))
const stage = path.join(here, 'staged')
const backup = path.join(here, 'originals')
const manifestPath = path.join(here, 'deployment.json')
const pkgRoot = path.join(install, 'node_modules/@deepseek-ai')
export const readingKeys = ['sessionStats', 'tokenUsage', 'contextPressure', 'contextBreakdown', 'queryBalanceCost']
const enabled = `typeof document !== 'undefined' && typeof window !== 'undefined' && document.querySelector('style[data-plugin-css="dsh-mobile-lite-styles"]') !== null && window.matchMedia('(max-width: 1023px) and (pointer: coarse)').matches`
const hash = text => crypto.createHash('sha256').update(text).digest('hex')
const parse = (file,text) => ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:file.endsWith('.ts')?ts.ScriptKind.TS:ts.ScriptKind.JS)
function walk(node, fn) { fn(node); ts.forEachChild(node, child => walk(child,fn)) }
function find(root,predicate) { const nodes=[]; walk(root,n=>{if(predicate(n))nodes.push(n)}); if(nodes.length!==1)throw Error('Expected one AST match, got '+nodes.length); return nodes[0] }
function named(root,name) {return find(root,n=>(ts.isClassExpression(n)||ts.isClassDeclaration(n)||ts.isFunctionDeclaration(n))&&(n.name?.text===name||(ts.isVariableDeclaration(n.parent)&&n.parent.name.getText()===name)))}
function rewrite(text, edits) {let last=text.length+1;for(const [start,end,value] of edits.sort((a,b)=>b[0]-a[0])){if(end>last)throw Error('Overlapping edits');text=text.slice(0,start)+value+text.slice(end);last=start}return text}
function replaceIds(text, names) {for(const [a,b] of Object.entries(names))text=text.replace(new RegExp('\\b'+a+'\\b','g'),b);return text}
const plans = []
function plan(pkg,rel,transform){const target=path.join(pkgRoot,pkg,rel);const original=path.join(backup,pkg,rel);const text=fs.readFileSync(fs.existsSync(manifestPath)&&fs.existsSync(original)?original:target,'utf8');const result=transform(text,target);if(result===text)throw Error('No change: '+target);const parsed=parse(target,result);if(parsed.parseDiagnostics.length)throw Error('Parse failure: '+target);plans.push({target,text,result,relative:path.join(pkg,rel)})}

function projection(text,file){const source=parse(file,text), cls=named(source,'ProjectionValueStore'), js=file.endsWith('.js'), edits=[]
  const member=name=>find(cls,n=>ts.isMethodDeclaration(n)&&n.name.getText(source)===name)
  const end=cls.members.end
  const typed=js?'':': Map<string, unknown>'
  edits.push([end,end,`\n  // Previous readings are display-only: authority and watermarks still reset.\n  privatePlaceholderDshDisplay${typed} = new Map();\n  dshDisplayFaces = new Map();\n  dshRecovering = false;\n  dshRecoveryFace = {getSnapshot: () => this.dshRecovering, subscribe: listener => this.anyNotifier.subscribe(listener)};\n  recoveryFaceOf() { return this.dshRecoveryFace; }\n  clearDisplayReadings() {\n    const keys = [...this.privatePlaceholderDshDisplay.keys()];\n    this.privatePlaceholderDshDisplay.clear(); this.dshRecovering = false;\n    for (const key of keys) this.changed(key); this.anyNotifier.markDirty();\n  }\n  displayFaceOf(key${js?'':': string'}) {\n    if (!${JSON.stringify(readingKeys)}.includes(key)) return this.faceOf(key);\n    let face = this.dshDisplayFaces.get(key);\n    if (face === undefined) {\n      const live = this.faceOf(key);\n      face = {subscribe: live.subscribe, getSnapshot: () => {\n        const row = this.rows.get(key);\n        return row?.kind === 'sequenced' || !this.privatePlaceholderDshDisplay.has(key)\n          ? row?.value : this.privatePlaceholderDshDisplay.get(key);\n      }};\n      this.dshDisplayFaces.set(key, face);\n    }\n    return face;\n  }\n`])
  const clear=member('clear')
  edits.push([clear.getStart(source),clear.end,`clear(retainDisplay = false) {\n    const keep = retainDisplay && (${enabled});\n    this.dshRecovering = keep;\n    this.anyNotifier.markDirty();\n    const notify = new Set([...this.rows.keys(), ...this.privatePlaceholderDshDisplay.keys()]);\n    if (keep) {\n      for (const [key,row] of this.rows) {\n        if (${JSON.stringify(readingKeys)}.includes(key) && row.kind === 'sequenced') this.privatePlaceholderDshDisplay.set(key,row.value);\n      }\n    } else this.privatePlaceholderDshDisplay.clear();\n    this.rows.clear();\n    for (const key of notify) this.changed(key);\n  }`])
  const apply=member('apply');const set=find(apply,n=>ts.isExpressionStatement(n)&&n.expression.getText(source).startsWith('this.rows.set('))
  edits.push([set.getStart(source),set.getStart(source),'this.privatePlaceholderDshDisplay.delete(key);\n'])
  const seed=member('seed');edits.push([seed.body.end-1,seed.body.end-1,`\nthis.dshRecovering = false; this.anyNotifier.markDirty();\nfor (const key of this.privatePlaceholderDshDisplay.keys()) {\n  if (!Object.hasOwn(baseline.values,key)) {this.privatePlaceholderDshDisplay.delete(key);this.changed(key);}\n}\n`])
  return rewrite(text,edits).replaceAll('privatePlaceholderDshDisplay','dshDisplayReadings')
}
function manager(text,file){const source=parse(file,text),cls=named(source,'SessionManager');const method=find(cls,n=>ts.isMethodDeclaration(n)&&n.name.getText(source)==='handleConnected');const call=find(method,n=>ts.isCallExpression(n)&&n.expression.getText(source)==='store.clear');const migration=find(cls,n=>ts.isCallExpression(n)&&n.expression.getText(source)==='store.applyCached'&&n.arguments[0]?.getText(source)==='value.values');return rewrite(text,[[call.getStart(source),call.end,'store.clear(true)'],[migration.getStart(source),migration.getStart(source),'store.clearDisplayReadings(); ']])}
function model(text,file){const source=parse(file,text), fn=named(source,'ModelSelect'),js=file.endsWith('.js'),edits=[]
  const busy=find(fn,n=>ts.isVariableDeclaration(n)&&n.name.getText(source)==='busy')
  const last=`const dshLastReading = ${js?'react.useRef(null)':'useRef<{owner: unknown; choice: typeof currentChoice; effort: typeof effortLabel} | null>(null)'};\nif (dshLastReading.current?.owner !== directory) dshLastReading.current = null;\nif (state.status === 'ready') dshLastReading.current = currentChoice === undefined ? null : {owner:directory,choice:currentChoice,effort:effortLabel};\nconst dshRetained = (${enabled}) && currentChoice === undefined && (state.status === "loading" || state.status === 'error') ? dshLastReading.current : null;\nconst dshDisplayChoice = dshRetained?.choice ?? currentChoice;\nconst dshDisplayEffort = dshRetained === null ? effortLabel : dshRetained.effort;\n${js?'react.useEffect':'useEffect'}(() => {if (dshRetained !== null && state.status === "loading") setOpen(false)},[dshRetained, state.status]);\n`
  edits.push([busy.parent.parent.end,busy.parent.parent.end,'\n// Keep only this session directory\'s trigger reading during recovery.\n'+last])
  for(const name of ['waiting','modelLabel','triggerLabel','triggerAria']){const decl=find(fn,n=>ts.isVariableDeclaration(n)&&n.name.getText(source)===name);edits.push([decl.initializer.getStart(source),decl.initializer.end,replaceIds(decl.initializer.getText(source),{currentChoice:'dshDisplayChoice',effortLabel:'dshDisplayEffort'})])}
  if(js){
    const trigger=find(fn,n=>ts.isObjectLiteralExpression(n)&&n.properties.some(p=>ts.isPropertyAssignment(p)&&p.name.getText(source)==='title'&&p.initializer.getText(source)==='triggerLabel'))
    const disabled=find(trigger,n=>ts.isPropertyAssignment(n)&&n.name.getText(source)==='disabled');edits.push([disabled.initializer.getStart(source),disabled.initializer.end,'locked || (dshRetained !== null && state.status === "loading")'])
    const busyProp=find(trigger,n=>ts.isPropertyAssignment(n)&&n.name.getText(source)==='"aria-busy"');edits.push([busyProp.initializer.getStart(source),busyProp.initializer.end,'busy || (dshRetained !== null && state.status === "loading")'])
    for(const suffix of ['triggerLabel','triggerEffort']){const obj=find(trigger,n=>ts.isObjectLiteralExpression(n)&&n.properties.some(p=>ts.isPropertyAssignment(p)&&p.name.getText(source)==='className'&&p.initializer.getText(source).endsWith('.'+suffix)));const child=find(obj,n=>ts.isPropertyAssignment(n)&&n.name.getText(source)==='children');edits.push([child.initializer.getStart(source),child.initializer.end,replaceIds(child.initializer.getText(source),{currentChoice:'dshDisplayChoice',effortLabel:'dshDisplayEffort'})]);if(suffix==='triggerEffort'){const and=obj.parent.parent; /* condition edited below using binary expression */}}
    const effortCond=find(trigger,n=>ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken&&n.left.getText(source).startsWith('effortLabel')&&n.right.getText(source).includes('.triggerEffort'));edits.push([effortCond.left.getStart(source),effortCond.left.end,replaceIds(effortCond.left.getText(source),{effortLabel:'dshDisplayEffort'})])
  }else{
    const trigger=find(fn,n=>ts.isJsxOpeningElement(n)&&n.tagName.getText(source)==='button'&&n.attributes.properties.some(p=>ts.isJsxAttribute(p)&&p.name.getText(source)==='title'&&p.initializer?.getText(source)==='{triggerLabel}'))
    for(const attr of trigger.attributes.properties){if(ts.isJsxAttribute(attr)&&['disabled','aria-busy'].includes(attr.name.getText(source))){const expr=attr.initializer.expression;edits.push([expr.getStart(source),expr.end,attr.name.getText(source)==='disabled'?'locked || (dshRetained !== null && state.status === "loading")':'busy || (dshRetained !== null && state.status === "loading")'])}}
    const triggerElement=trigger.parent
    walk(triggerElement,n=>{if(ts.isJsxExpression(n)&&n.expression&&ts.isJsxElement(n.parent)){const content=n.expression.getText(source);if(content.includes("'trigger', true")||content.includes('css.triggerEffort'))edits.push([n.expression.getStart(source),n.expression.end,replaceIds(content,{currentChoice:'dshDisplayChoice',effortLabel:'dshDisplayEffort'})])}})
  }
  return rewrite(text,edits)
}
function permission(text,file){const source=parse(file,text),fn=named(source,'PermissionSelect'),js=file.endsWith('.js'),edits=[]
  const params=fn.parameters[0].name;edits.push([params.getStart(source)+1,params.getStart(source)+1,'sessionId, usePermissionRecovery, '])
  if(!js){const imp=find(source,n=>ts.isImportDeclaration(n)&&n.moduleSpecifier.text==='react'&&n.importClause?.namedBindings&&!n.importClause.isTypeOnly);edits.push([imp.importClause.namedBindings.end-1,imp.importClause.namedBindings.end-1,', useRef ']);const property=find(source,n=>ts.isPropertySignature(n)&&n.name.getText(source)==='permissionCatalog');edits.push([property.end,property.end,'\n    permissionRecovery: HostObservable<boolean>\n'])}
  const ack=find(fn,n=>ts.isVariableDeclaration(n)&&n.name.getText(source).includes('acknowledged'))
  edits.push([ack.parent.parent.end,ack.parent.parent.end,`\n// Keep the last confirmed trigger, never old menu choices or active permission state.\nconst dshLastPermission = ${js?'react.useRef(null)':'useRef<{owner: unknown; selection: NonNullable<typeof selection>; catalog: NonNullable<typeof catalog>} | null>(null)'};\nconst dshProjectionRecovering = usePermissionRecovery(value => value);\nif (dshLastPermission.current?.owner !== sessionId) dshLastPermission.current = null;\nif (selection !== undefined && catalog !== null) dshLastPermission.current = {owner:sessionId,selection,catalog};\nelse if (catalog !== null && !dshProjectionRecovering) dshLastPermission.current = null;\nconst dshRetained = (${enabled}) && (catalog === null || dshProjectionRecovering) && (selection === undefined || catalog === null) ? dshLastPermission.current : null;\nconst dshDisplaySelection = selection ?? dshRetained?.selection;\nconst dshDisplayCatalog = catalog ?? dshRetained?.catalog;\n`])
  const early=find(fn,n=>ts.isIfStatement(n)&&n.expression.getText(source).includes('selection')&&n.expression.getText(source).includes('catalog')&&ts.isReturnStatement(n.thenStatement)&&n.thenStatement.expression?.kind===ts.SyntaxKind.NullKeyword)
  edits.push([early.expression.getStart(source),early.expression.end,'dshDisplaySelection === undefined || dshDisplayCatalog == null'])
  for(const name of ['currentValue','current','items']){const decl=find(fn,n=>ts.isVariableDeclaration(n)&&n.name.getText(source)===name);edits.push([decl.initializer.getStart(source),decl.initializer.end,replaceIds(decl.initializer.getText(source),{selection:'dshDisplaySelection',catalog:'dshDisplayCatalog'})])}
  const choose=find(fn,n=>ts.isVariableDeclaration(n)&&n.name.getText(source)==='choose');edits.push([choose.initializer.body.getStart(source)+1,choose.initializer.body.getStart(source)+1,'if (dshRetained !== null || selection === undefined || catalog === null) return;'])
  const submit=find(fn,n=>ts.isVariableDeclaration(n)&&n.name.getText(source)==='submit');edits.push([submit.initializer.body.getStart(source)+1,submit.initializer.body.getStart(source)+1,'if (dshRetained !== null || selection === undefined || catalog === null) return;'])
  const optimistic=find(fn,n=>ts.isVariableDeclaration(n)&&n.name.getText(source)==='currentValue');const original=edits.find(e=>e[0]===optimistic.initializer.getStart(source));original[2]='dshRetained !== null ? dshRetained.selection.currentValue : ('+original[2]+')';
  if(js){
    const anchor=find(fn,n=>ts.isObjectLiteralExpression(n)&&n.properties.some(p=>ts.isPropertyAssignment(p)&&p.name.getText(source)==='className'&&p.initializer.getText(source).endsWith('.trigger')))
    const disabled=find(anchor,n=>ts.isPropertyAssignment(n)&&n.name.getText(source)==='disabled');edits.push([disabled.initializer.getStart(source),disabled.initializer.end,'locked || busy || dshRetained !== null'])
    const menu=anchor.parent.parent.parent.parent
    const menuOpen=find(menu,n=>ts.isShorthandPropertyAssignment(n)&&n.name.text==='open');edits.push([menuOpen.getStart(source),menuOpen.end,'open: open && dshRetained === null'])
    const confirm=find(fn,n=>ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken&&n.left.getText(source)==='confirmation!==null');edits.push([confirm.left.getStart(source),confirm.left.end,'confirmation !== null && dshRetained === null'])
  }else{
    const menu=find(fn,n=>ts.isJsxSelfClosingElement(n)&&n.tagName.getText(source)==='Menu');const op=find(menu,n=>ts.isJsxAttribute(n)&&n.name.getText(source)==='open');edits.push([op.initializer.expression.getStart(source),op.initializer.expression.end,'open && dshRetained === null'])
    const dis=find(fn,n=>ts.isJsxAttribute(n)&&n.name.getText(source)==='disabled'&&n.initializer.getText(source)==='{locked || busy}');edits.push([dis.initializer.expression.getStart(source),dis.initializer.expression.end,'locked || busy || dshRetained !== null'])
    const confirm=find(fn,n=>ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken&&n.left.getText(source)==='confirmation !== null');edits.push([confirm.left.getStart(source),confirm.left.end,'confirmation !== null && dshRetained === null'])
  }
  return rewrite(text,edits)
}

function permissionInjection(text,file){
  const source=parse(file,text), js=file.endsWith('.js');
  const prop=find(source,n=>ts.isPropertyAssignment(n)&&n.name.getText(source)==='permissionCatalog'&&n.initializer.getText(source)==='catalog.store');
  const typed=js?'':' as { recoveryFaceOf?: () => {getSnapshot: () => boolean; subscribe: (listener: () => void) => () => void} } | undefined';
  return rewrite(text,[[prop.end,prop.end,`, permissionRecovery: (sessions.binding(sessionId)?.session.projections${typed})?.recoveryFaceOf?.() ?? {getSnapshot: () => false, subscribe: () => () => {}}`]]);
}

export function buildPlan(){
  if(plans.length)return plans
  plan('dsh-api-session-controller','src/client/sessions/projection-store.ts',projection)
  plan('dsh-api-session-controller','src/client/sessions/manager.ts',manager)
  plan('dsh-api-session-controller','lib/client.js',(text,file)=>manager(projection(text,file),file))
  for(const [pkg,file,fn] of [['dsh-client-ui-model-selection','ModelSelect.tsx',model],['dsh-client-ui-permission-presets','PermissionSelect.tsx',permission]]){
    plan(pkg,'src/client/'+file,fn);plan(pkg,'lib/client.js',pkg==='dsh-client-ui-permission-presets'?(text,file)=>permissionInjection(fn(text,file),file):fn)
  }
  plan('dsh-client-ui-permission-presets','src/client/index.ts',permissionInjection)
  for(const rel of ['src/client/index.ts','lib/client.js'])plan('dsh-client-ui-session',rel,(text,file)=>{
    const source=parse(file,text);const call=find(source,n=>ts.isCallExpression(n)&&n.expression.getText(source)==='binding.session.projections.faceOf');
    // Only the UI adapter uses retained readings; all business faces stay authoritative.
    return rewrite(text,[[call.getStart(source),call.end,`(binding.session.projections${rel.endsWith('.ts')?' as typeof binding.session.projections & { displayFaceOf?: (key: string) => ReturnType<typeof binding.session.projections.faceOf> }':''}).displayFaceOf?.(key) ?? binding.session.projections.faceOf(key)`]])
  })
  return plans
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const mode=process.argv[2]
  if(mode==='--restore'){
    const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'))
    for(const entry of manifest.files)if(hash(fs.readFileSync(entry.target))!==entry.after)throw Error('Changed since deployment: '+entry.target)
    for(const entry of manifest.files)fs.copyFileSync(path.join(backup,entry.relative),entry.target)
    console.log('Restored exact originals; refresh the existing page.');process.exit(0)
  }
  const version=JSON.parse(fs.readFileSync(path.join(install,'package.json'),'utf8')).version
  if(version!=='0.2.2-rc.5')throw Error('Patch requires DSH 0.2.2-rc.5, found '+version)
  if(fs.existsSync(manifestPath)){
    const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'))
    if(manifest.files.every(e=>hash(fs.readFileSync(e.target))===e.after)){console.log('Already applied; no files changed.');process.exit(0)}
    throw Error('Deployment record exists; review installed hashes before reapplying')
  }
  const changes=buildPlan()
  for(const item of changes){const dest=path.join(stage,item.relative);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,item.result)}
  if(mode==='--apply'){
    for(const item of changes)if(hash(fs.readFileSync(item.target))!==hash(item.text))throw Error('Concurrent change: '+item.target)
    for(const item of changes){const dest=path.join(backup,item.relative);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,item.text)}
    const manifest={version,createdAt:new Date().toISOString(),files:changes.map(({target,relative,text,result})=>({target,relative,before:hash(text),after:hash(result)}))}
    fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n')
    for(const item of changes)fs.writeFileSync(item.target,item.result)
    console.log('Applied '+changes.length+' files, including four browser bundles; refresh the existing page.')
  }else console.log('Staged '+changes.length+' files. Installation unchanged.')
}
