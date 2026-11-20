import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from '/usr/local/lib/node_modules/typescript/lib/typescript.js'
import { buildPlan, readingKeys } from './reconnect-display.mjs'
const plans = buildPlan()
let checks = 0
function check(name,fn){fn();checks++;console.log('PASS '+name)}
function ast(text){return ts.createSourceFile('test.js',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS)}
function nodes(root,predicate){const out=[];function walk(n){if(predicate(n))out.push(n);ts.forEachChild(n,walk)}walk(root);return out}
function definition(text,name){const root=ast(text);const found=nodes(root,n=>(ts.isClassExpression(n)||ts.isClassDeclaration(n)||ts.isFunctionDeclaration(n))&&(n.name?.text===name||(ts.isVariableDeclaration(n.parent)&&n.parent.name.getText(root)===name)));assert.equal(found.length,1);return found[0].getText(root)}
const context = () => ({Notifier:class{subscribe=()=>()=>{};markDirty(){}},document:{querySelector:()=>({})},window:{matchMedia:()=>({matches:true})}})
for(const [label,program] of [
  ['source', ts.transpile(plans.find(p=>p.relative.endsWith('sessions/projection-store.ts')).result,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS})],
  ['bundle',plans.find(p=>p.relative==='dsh-api-session-controller/lib/client.js').result],
]){
  const code=definition(program,'ProjectionValueStore').replaceAll('notifier_ts_1.Notifier','Notifier')
  const scope=vm.createContext(context())
  const Store=vm.runInContext('('+code+')',scope)
  check(label+': first load has no invented readings',()=>{const s=new Store();assert.equal(s.displayFaceOf('tokenUsage').getSnapshot(),undefined)})
  check(label+': reconnect retains all five display readings only',()=>{const s=new Store();for(const k of readingKeys)s.apply(k,{k},100);s.apply('permissions',{currentValue:'danger-full-access'},100);s.clear(true);for(const k of readingKeys){assert.equal(s.displayFaceOf(k).getSnapshot().k,k);assert.equal(s.faceOf(k).getSnapshot(),undefined);assert.equal(s.get(k),undefined);assert.equal(s.seqOf(k),undefined)}assert.equal(s.displayFaceOf('permissions').getSnapshot(),undefined);assert.equal(Object.keys(s.values()).length,0)})
  check(label+': lower new-generation sequence directly replaces display',()=>{const s=new Store();s.apply('tokenUsage',{n:100},100);s.clear(true);s.apply('tokenUsage',{n:101},2);assert.equal(s.displayFaceOf('tokenUsage').getSnapshot().n,101);assert.equal(s.seqOf('tokenUsage'),2)})
  check(label+': repeated reconnect retains previous display',()=>{const s=new Store();s.apply('tokenUsage',{n:100},100);s.clear(true);s.clear(true);assert.equal(s.displayFaceOf('tokenUsage').getSnapshot().n,100)})
  check(label+': authoritative empty baseline removes old readings',()=>{const s=new Store();s.apply('tokenUsage',{n:100},100);s.clear(true);s.seed({values:{},asOfSeq:1});assert.equal(s.displayFaceOf('tokenUsage').getSnapshot(),undefined)})
  check(label+': authoritative null uses ordinary clear',()=>{const s=new Store();s.apply('tokenUsage',{n:100},100);s.clear(true);s.clear();assert.equal(s.displayFaceOf('tokenUsage').getSnapshot(),undefined)})
  check(label+': cached checkpoint cannot regress last connected display',()=>{const s=new Store();s.apply('tokenUsage',{n:100},100);s.clear(true);s.applyCached({tokenUsage:{n:50}});assert.equal(s.displayFaceOf('tokenUsage').getSnapshot().n,100);s.seed({values:{tokenUsage:{n:101}},asOfSeq:1});assert.equal(s.displayFaceOf('tokenUsage').getSnapshot().n,101)})
  check(label+': different sessions never share display',()=>{const a=new Store(),b=new Store();a.apply('tokenUsage',{n:100},100);a.clear(true);assert.equal(b.displayFaceOf('tokenUsage').getSnapshot(),undefined)})
  check(label+': desktop/plugin-disabled preserve original behavior',()=>{scope.window.matchMedia=()=>({matches:false});const s=new Store();s.apply('tokenUsage',{n:100},100);s.clear(true);assert.equal(s.displayFaceOf('tokenUsage').getSnapshot(),undefined);scope.window.matchMedia=()=>({matches:true})})
}
// Execute just the pure retention decisions extracted from each real candidate;
// these checks do not render or simulate the browser UI.
function decision(pkg, name, marker, end, refName, input, memory){
 const code=definition(plans.find(p=>p.relative===pkg+'/lib/client.js').result,name)
 const from=code.indexOf(marker),to=code.indexOf(end,from)
 assert(from>=0&&to>from)
 const ref=memory??{current:null}
 const ctx=vm.createContext({...context(),...input,react:{useRef:()=>ref},usePermissionRecovery:fn=>fn(input.phase==='loading')})
 const snippet=code.slice(from,to).replace(/\(0,\s*$/,'');
 const result=vm.runInContext(snippet+`;({retained:dshRetained,${refName}})`,ctx)
 return {ref,result}
}
check('model: keeps name and effort only for same directory while loading',()=>{const directory={};const ready=decision('dsh-client-ui-model-selection','ModelSelect','const dshLastReading','react.useEffect','choice:dshDisplayChoice,effort:dshDisplayEffort',{directory,currentChoice:{model:{name:'GPT'}},effortLabel:'High',state:{status:'ready'}});const retry=decision('dsh-client-ui-model-selection','ModelSelect','const dshLastReading','react.useEffect','choice:dshDisplayChoice,effort:dshDisplayEffort',{directory,currentChoice:undefined,effortLabel:undefined,state:{status:'loading'}},ready.ref);assert.equal(retry.result.choice.model.name,'GPT');assert.equal(retry.result.effort,'High');const other=decision('dsh-client-ui-model-selection','ModelSelect','const dshLastReading','react.useEffect','choice:dshDisplayChoice',{directory:{},currentChoice:undefined,effortLabel:undefined,state:{status:'loading'}},ready.ref);assert.equal(other.result.choice,undefined)})
check('permission: retains disabled display through catalog and projection reload',()=>{const ready=decision('dsh-client-ui-permission-presets','PermissionSelect','const dshLastPermission','react.useEffect','selection:dshDisplaySelection,catalog:dshDisplayCatalog',{sessionId:'a',phase:'ready',selection:{currentValue:'danger-full-access'},catalog:{options:[]}});const retry=decision('dsh-client-ui-permission-presets','PermissionSelect','const dshLastPermission','react.useEffect','selection:dshDisplaySelection',{sessionId:'a',phase:'loading',selection:undefined,catalog:null},ready.ref);assert.equal(retry.result.selection.currentValue,'danger-full-access');assert.notEqual(retry.result.retained,null);const absent=decision('dsh-client-ui-permission-presets','PermissionSelect','const dshLastPermission','react.useEffect','selection:dshDisplaySelection',{sessionId:'a',phase:'ready',selection:undefined,catalog:{options:[]}},ready.ref);assert.equal(absent.result.selection,undefined)})
check('all candidate browser bundles compile without execution',()=>{for(const p of plans.filter(p=>p.relative.endsWith('.js')))new vm.Script(p.result,{filename:p.relative})})
check('all source changes transpile without syntax diagnostics',()=>{for(const p of plans.filter(p=>/\.tsx?$/.test(p.relative))){const out=ts.transpileModule(p.result,{fileName:p.relative,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}});assert.equal(out.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,p.relative)}})
console.log(`${checks} checks passed`)
