import React,{useState} from "react";
import{createRoot}from"react-dom/client";
import JSZip from"jszip";
import"./style.css";

const starter={
  "README.md":"# UNORON AI\nAutonomous software builder.",
  "index.html":"<!doctype html><html><body><h1>UNORON AI</h1></body></html>"
};

function App(){
  const[files,setFiles]=useState(starter);
  const[prompt,setPrompt]=useState("");
  const[mode,setMode]=useState("build");
  const[log,setLog]=useState(["System ready."]);
  const[busy,setBusy]=useState(false);
  const[sel,setSel]=useState("index.html");
  const[preview,setPreview]=useState("");
  const[version,setVersion]=useState("4.1.0");

  async function run(){
    if(!prompt.trim())return;

    setBusy(true);
    setLog(x=>[...x,"▶ "+prompt]);

    try{
      const r=await fetch("/api/agent",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({prompt,mode,files,version})
      });

      const d=await r.json();

      if(!r.ok)throw Error(d.error||"Agent failed");

      if(d.files)setFiles(d.files);
      if(d.preview)setPreview(d.preview);
      if(d.version)setVersion(d.version);

      setLog(x=>[...x,...(d.log||[])]);

    }catch(e){
      setLog(x=>[...x,"✗ "+e.message]);
    }finally{
      setBusy(false);
    }
  }

  async function zip(){
    const z=new JSZip();

    Object.entries(files).forEach(
      ([n,c])=>z.file(n,c)
    );

    z.file(
      "UNORON_VERSION.json",
      JSON.stringify({
        version,
        createdAt:new Date().toISOString()
      },null,2)
    );

    const b=await z.generateAsync({type:"blob"});
    const a=document.createElement("a");

    a.href=URL.createObjectURL(b);
    a.download=`UNORON-${version}.zip`;
    a.click();
  }

  return (
    <>
      <header>
        <strong>UNORON AI</strong>
        <span>Self-Development Engine • Gemini</span>
        <i>v{version}</i>
      </header>

      <main>
        <aside>
          <h2>Command</h2>

          <textarea
            value={prompt}
            onChange={e=>setPrompt(e.target.value)}
            placeholder="Build anything, fix anything, or say: Upgrade yourself..."
          />

          <select
            value={mode}
            onChange={e=>setMode(e.target.value)}
          >
            <option value="build">Build Project</option>
            <option value="fix">Fix / Improve</option>
            <option value="self-upgrade">SELF UPGRADE</option>
            <option value="test">Test & Audit</option>
          </select>

          <button onClick={run} disabled={busy}>
            {busy?"Working...":"Run UNORON"}
          </button>

          <button className="alt" onClick={zip}>
            Export ZIP
          </button>

          <h3>Agent log</h3>

          <pre>
            {log.slice(-20).join("\n")}
          </pre>
        </aside>

        <section>
          <div className="bar">Files</div>

          <div className="files">
            {Object.keys(files).map(n=>(
              <button
                key={n}
                className={n===sel?"on":""}
                onClick={()=>setSel(n)}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="panes">
            <div>
              <div className="bar">{sel}</div>

              <textarea
                className="code"
                value={files[sel]||""}
                onChange={e=>
                  setFiles({
                    ...files,
                    [sel]:e.target.value
                  })
                }
              />
            </div>

            <div>
              <div className="bar">Preview</div>

              {preview ? (
                <iframe
                  title="preview"
                  srcDoc={preview}
                />
              ) : (
                <div className="empty">
                  No preview yet
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer>
        Gemini-powered candidate generation.
        External CI/health checks should be used before automatic promotion.
      </footer>
    </>
  );
}

createRoot(
  document.getElementById("root")
).render(<App/>);
