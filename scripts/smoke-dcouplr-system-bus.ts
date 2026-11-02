// Exercise the exact production engine against configured application bus contracts.
import {createHash} from "node:crypto";
import {existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from "node:fs";
import {join,resolve} from "node:path";
import {tmpdir} from "node:os";
import {strictEqual,ok} from "node:assert";
import {runNative} from "./smoke-native-command.ts";
import {smokeBinary} from "./smoke-binary.ts";
import PIN from "../packs/dcouplr/upstream-pin.json" with {type:"json"};

const source=process.env.PREGATE_DCOUPLR_SOURCE;
if (!source) throw new Error("Set PREGATE_DCOUPLR_SOURCE to the integrity-pinned extracted package directory.");
const bytes=readFileSync(join(resolve(source),"dist/index.mjs"));
strictEqual(createHash("sha256").update(bytes).digest("hex"),PIN.files["dist/index.mjs"]);
const area=mkdtempSync(join(tmpdir(),"pregate-system-bus-fitness-"));
const root=join(area,"repo"),binary=smokeBinary();
const env={...process.env,HOME:join(area,"home"),XDG_DATA_HOME:join(area,"data"),XDG_STATE_HOME:join(area,"state"),CI:"1",PREGATE_UNATTENDED_APPROVAL:"1"};
const fixture=join(import.meta.dir,"../docs/examples/dcouplr-system-bus");
const command=(args:string[])=>runNative({binary,args,cwd:root,env});
try {
  for(const name of ["src","quality","vendor"])mkdirSync(join(root,name),{recursive:true});
  writeFileSync(join(root,"vendor/dcouplr.mjs"),bytes);
  const application=readFileSync(join(fixture,"src/delivery.mjs.fixture"),"utf8").replace("from 'dcouplr'","from '../vendor/dcouplr.mjs'");
  const applicationPath=join(root,"src/delivery.mjs"),verifierPath=join(root,"quality/verify.mjs");
  writeFileSync(applicationPath,application);
  writeFileSync(verifierPath,readFileSync(join(fixture,"quality/verify.mjs.fixture")));
  const initialized=command(["init","--yes","--preset","integrity-only"]);
  strictEqual(initialized.exitCode,0,initialized.stderr.toString());
  const presetPath=join(root,".pregate/preset.json"),preset=JSON.parse(readFileSync(presetPath,"utf8"));
  const inputs=["quality/verify.mjs","vendor/dcouplr.mjs"];
  const fingerprint=command(["fitness","fingerprint",...inputs]);
  strictEqual(fingerprint.exitCode,0,fingerprint.stderr.toString());
  const id="DCP-FACTORY-RUNTIME-005";
  const request=join(root,".pregate/system-bus-request.json");
  writeFileSync(request,JSON.stringify({why:"Owned test: verify actual custom event/message bus callers; keep every core and factory requirement active. This is not actual user consent.",patch:[
    {op:"test",path:"/sources",value:preset.sources},
    {op:"replace",path:"/sources",value:[...preset.sources,{kind:"library",ns:"dcouplr",version:"1.26.0"}]},
    {op:"replace",path:"/methodologies",value:[...preset.methodologies,"dcouplr/factory-runtime"]},
    {op:Object.hasOwn(preset,"fitness")?"replace":"add",path:"/fitness",value:{...preset.fitness,[id]:{
      command:[process.execPath,"quality/verify.mjs"],inputs,verificationHash:fingerprint.stdout.toString().trim(),timeoutMs:2000,
      rationale:"Assert actual custom bus completion, direct/broadcast routing, all-listener failure causes, background error callbacks and repeated subscription-ID disposal. Does not verify durable delivery, cancellation, capacity or a real consumer.",
    }}},
    {op:Object.hasOwn(preset,"overrides")?"replace":"add",path:"/overrides",value:{...preset.overrides,[`dcouplr/${id}`]:{enforcement:"enforce",note:"Owned test's reviewed custom bus assertion; other obligations remain visible."}}},
  ]}));
  const adopted=command(["preset","apply",request,"--yes"]);
  strictEqual(adopted.exitCode,0,adopted.stdout.toString()+adopted.stderr.toString());
  const lock=JSON.parse(readFileSync(join(root,".pregate/pregate.lock.json"),"utf8"));
  strictEqual(lock.rules.filter((r:{integrity:boolean;enforcement:string})=>r.integrity&&r.enforcement==="enforce").length,68);
  strictEqual(command(["check","--all"]).exitCode,1,"A new binding must not invent fresh evidence");
  strictEqual(command(["fitness","run",id]).exitCode,0,"The actual configured adapters must pass");
  strictEqual(command(["check","--all"]).exitCode,0);
  const observed=[];
  const mutations=[
    ...["event","message"].flatMap(kind=>{
      const field=kind==="event"?"eventType":"to";
      return [
        {kind:`${kind} completion`,from:"return completed;",to:`if (routingField === '${field}') return undefined; return completed;`},
        {kind:`${kind} disposal`,from:"unsubscribe(delegate) {",to:`unsubscribe(delegate) { if (routingField === '${field}') return;`},
      ];
    }),
    {kind:"broadcast routing",from:"routingField === 'to' && value.to === BROADCAST_PEER",to:"false"},
    {kind:"direct routing",from:": (listeners.get(value[routingField]) ?? [])",to:": (value[routingField] === 'PROBE' ? [...(listeners.get('PROBE') ?? []), ...(listeners.get('OTHER') ?? [])] : (listeners.get(value[routingField]) ?? []))"},
    {kind:"failure aggregation",from:"throw Object.assign(new Error(`${errors.length} listener(s) failed`), { errors })",to:"throw errors[0]"},
    {kind:"background error policy",from:"onError?.(error, value)",to:"undefined"},
  ];
  for(const mutation of mutations){
    ok(application.includes(mutation.from),`Missing negative control anchor: ${mutation.kind}`);
    writeFileSync(applicationPath,application.replace(mutation.from,mutation.to));
    strictEqual(command(["fitness","status"]).exitCode,1,"A caller edit must make prior evidence stale");
    const failed=command(["fitness","run",id]);
    strictEqual(failed.exitCode,1,failed.stdout.toString()+failed.stderr.toString());
    strictEqual(command(["check","--all"]).exitCode,1,"The actual broken bus must block");
    const audit=JSON.parse(command(["audit","--json"]).stdout.toString());
    const requirement=audit.fitness.find((r:{requirement:string})=>r.requirement===id);
    strictEqual(requirement.status,"fail",`${mutation.kind}: ${JSON.stringify(requirement)}\n${failed.stdout}\n${failed.stderr}`);
    observed.push({kind:mutation.kind,failedVerifierExit:failed.exitCode,checkDenied:true,auditStatus:requirement.status});
    writeFileSync(applicationPath,application);
    strictEqual(command(["fitness","run",id]).exitCode,0);
    strictEqual(command(["check","--all"]).exitCode,0);
  }
  const state=JSON.parse(command(["fitness","status","--json"]).stdout.toString());
  strictEqual(state.requirements.filter((r:{status:string})=>r.status==="pass").length,1);
  strictEqual(state.requirements.filter((r:{status:string})=>r.status==="unverified").length,71);
  writeFileSync(verifierPath,"import {writeFileSync} from 'node:fs'; writeFileSync('unreviewed-executed.txt','bypass');\n");
  const tampered=command(["fitness","run",id]);
  strictEqual(tampered.exitCode,1);
  ok(tampered.stdout.toString().includes("nothing executed"));
  strictEqual(existsSync(join(root,"unreviewed-executed.txt")),false);
  console.log(JSON.stringify({engineSha256:createHash("sha256").update(readFileSync(binary)).digest("hex"),upstreamSha256:PIN.files["dist/index.mjs"],coreRules:68,requirement:id,observed,repairPasses:observed.length,unverified:71,unreviewedVerifierRefused:true,limits:"Owned configured buses and callers; controller CLI approval, not actual user consent or independent consumer calibration. No durable delivery, cancellation or capacity proof; other requirements remain unverified."}));
} finally {rmSync(area,{recursive:true,force:true});}
