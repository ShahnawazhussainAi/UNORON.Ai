import OpenAI from "openai";
import {Octokit} from "@octokit/rest";

const SYSTEM=`You are UNORON AI, an autonomous software-development agent.
Return ONLY JSON: {"files":{},"preview":"","version":"","log":[],"commitMessage":""}.
For build: create a runnable project from the user's requirements.
For fix: preserve existing behavior and fix requested issues.
For test: inspect supplied files and report only checks actually performed by this function.
For self-upgrade: improve UNORON source files themselves. Preserve versioning, secrets protection, authentication boundaries and rollback controls. Do not claim code was executed when it was not.
Never put secrets/API keys in browser code. Keep useful existing files.`;

function staticChecks(files){
 const names=Object.keys(files||{}), logs=[`Candidate contains ${names.length} file(s).`];
 if(names.includes("package.json"))logs.push("✓ package.json syntax file present");
 if(names.some(x=>x==="index.html"))logs.push("✓ index.html present");
 return logs;
}
async function commitToGithub(files,message){
 const token=Netlify.env.get("GITHUB_TOKEN"),owner=Netlify.env.get("GITHUB_OWNER"),repo=Netlify.env.get("GITHUB_REPO"),branch=Netlify.env.get("GITHUB_BRANCH")||"main";
 if(!token||!owner||!repo)return {ok:false,reason:"GitHub credentials not configured; candidate remains uncommitted."};
 const gh=new Octokit({auth:token});
 const ref=await gh.git.getRef({owner,repo,ref:`heads/${branch}`});
 const treeBase=await gh.git.getCommit({owner,repo,commit_sha:ref.data.object.sha});
 const blobs=[];
 for(const[path,content]of Object.entries(files)){const b=await gh.git.createBlob({owner,repo,content:Buffer.from(String(content)).toString("base64"),encoding:"base64"});blobs.push({path,mode:"100644",type:"blob",sha:b.data.sha});}
 const tree=await gh.git.createTree({owner,repo,base_tree:treeBase.data.tree.sha,tree:blobs});
 const commit=await gh.git.createCommit({owner,repo,message,tree:tree.data.sha,parents:[ref.data.object.sha]});
 await gh.git.updateRef({owner,repo,ref:`heads/${branch}`,sha:commit.data.sha,force:false});
 return {ok:true,sha:commit.data.sha};
}
export default async req=>{
 if(req.method!=="POST")return new Response("Method not allowed",{status:405});
 try{
  const body=await req.json(),{prompt,mode="build",files={},version="4.0.0"}=body;
  if(!prompt)return Response.json({error:"Prompt required"},{status:400});
  const client=new OpenAI();
  const r=await client.chat.completions.create({model:Netlify.env.get("UNORON_MODEL")||"gpt-4o-mini",temperature:.15,response_format:{type:"json_object"},messages:[{role:"system",content:SYSTEM},{role:"user",content:JSON.stringify({prompt,mode,version,files})}]});
  const out=JSON.parse(r.choices[0].message.content||"{}");out.files=out.files||files;out.version=out.version||version;out.log=[...(out.log||[]),...staticChecks(out.files)];
  if(!out.preview&&out.files["index.html"])out.preview=out.files["index.html"];
  if(mode==="self-upgrade"&&Netlify.env.get("ENABLE_SELF_COMMIT")==="true"){
   const result=await commitToGithub(out.files,out.commitMessage||`UNORON upgrade ${out.version}`);
   out.log.push(result.ok?`✓ Candidate committed: ${result.sha}`:`• ${result.reason}`);
  } else if(mode==="self-upgrade") out.log.push("• Self-upgrade candidate generated. Configure GitHub + CI before automatic promotion.");
  return Response.json(out);
 }catch(e){return Response.json({error:e?.message||"Agent error"},{status:500})}
};