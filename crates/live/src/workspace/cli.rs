use super::{local_url,read_json,serve};
use impeccable_common::Io;
use serde_json::{json,Value};
use std::{path::{Path,PathBuf},process::{Command,Stdio},time::{Duration,Instant}};
fn arg(args:&[String],name:&str)->Option<String>{let key=format!("--{name}");args.iter().position(|s|s==&key).and_then(|i|args.get(i+1)).filter(|s|!s.starts_with("--")).cloned().or_else(||args.iter().find_map(|s|s.strip_prefix(&format!("{key}=")).map(String::from)))}
fn root(io:&Io)->PathBuf{if let Some(p)=io.env.get("CONGO_WORKSPACE_HOME"){PathBuf::from(p)}else if let Some(p)=io.env.get("LOCALAPPDATA"){Path::new(p).join("Congo/workspace")}else{PathBuf::from(io.env.get("XDG_DATA_HOME").cloned().unwrap_or_else(||io.home().unwrap_or_default().join(".local/share").to_string_lossy().into())).join("congo/workspace")}}
fn request(record:&Value,route:&str,body:Option<&Value>)->Result<Value,String>{
    let port=record["port"].as_u64().filter(|p|*p>0&&*p<=65535).ok_or("Invalid workspace port")?;
    let token=record["token"].as_str().ok_or("Invalid workspace token")?;let url=format!("http://127.0.0.1:{port}{route}");
    let agent=ureq::AgentBuilder::new().timeout(Duration::from_secs(5)).redirects(0).build();let auth=format!("Bearer {token}");
    let response=if let Some(body)=body{agent.post(&url).set("Authorization",&auth).send_json(body.clone())}else{agent.get(&url).set("Authorization",&auth).call()};
    match response{Ok(r)=>r.into_json().map_err(|e|e.to_string()),Err(ureq::Error::Status(_,r))=>Err(r.into_json::<Value>().ok().and_then(|v|v["error"].as_str().map(String::from)).unwrap_or("Workspace request failed".into())),Err(e)=>Err(e.to_string())}
}
fn alive(root:&Path)->Option<Value>{let record=read_json(root.join("server.json"))?;if request(&record,"/api/ping",None).ok()?["protocol"]==1{Some(record)}else{None}}
fn ensure(root:&Path,port:u16,env:&crate::util::Env)->Result<Value,String>{
    std::fs::create_dir_all(root).map_err(|e|e.to_string())?;
    crate::source_lock::with_source_lock("workspace-launch","workspace",root.to_str().ok_or("Invalid workspace path")?,env,15000.0,||start(root,port)).map_err(|e|e.message)?
}
fn start(root:&Path,port:u16)->Result<Value,String>{
    std::fs::create_dir_all(root).map_err(|e|e.to_string())?;
    if let Some(record)=alive(root){return Ok(record)}
    let exe=std::env::current_exe().map_err(|e|e.to_string())?;
    #[cfg(windows)]{
        let mut launcher=Command::new("powershell.exe");launcher.args(["-NoProfile","-NonInteractive","-Command","$ErrorActionPreference='Stop'; Start-Process -FilePath $env:CONGO_WORKSPACE_EXE -ArgumentList @('workspace','serve','--port',$env:CONGO_WORKSPACE_PORT) -WindowStyle Hidden | Out-Null"]).env("CONGO_WORKSPACE_EXE",&exe).env("CONGO_WORKSPACE_PORT",port.to_string()).env("CONGO_WORKSPACE_HOME",root).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());impeccable_common::proc::hide_window(&mut launcher);if !launcher.status().map_err(|e|e.to_string())?.success(){return Err("Could not start local workspace".into());}
    }
    #[cfg(not(windows))]{let mut child=Command::new(exe);child.args(["workspace","serve","--port",&port.to_string()]).env("CONGO_WORKSPACE_HOME",root).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());impeccable_common::proc::detach(&mut child);child.spawn().map_err(|e|e.to_string())?;}
    let until=Instant::now()+Duration::from_secs(12);while Instant::now()<until{if let Some(record)=alive(root){return Ok(record)}std::thread::sleep(Duration::from_millis(50));}Err("Workspace did not become ready".into())
}
pub fn run(args:&[String],io:&mut Io)->i32{
    if args.iter().any(|s|s=="--probe"){io.out("{\"service\":\"congo-workspace\",\"protocol\":1}\n");return 0}
    if args.iter().any(|s|s=="--help"){io.out("impeccable workspace [--view choices|live-app] [--target PATH] [--dev-url URL] [--no-browser]\n  attach --provider TOOL --target PATH [--dev-url URL]\n  status | stop\nChoices and editing use the existing serve-question and live commands.\n");return 0}
    match execute(args,io){Ok(value)=>{io.out(&format!("{}\n",serde_json::to_string_pretty(&value).unwrap()));0},Err(error)=>{io.err(&format!("workspace: {error}\n"));1}}
}
fn execute(args:&[String],io:&mut Io)->Result<Value,String>{
    let root=root(io);let command=args.first().filter(|s|!s.starts_with('-')).map(String::as_str).unwrap_or("open");
    if command=="serve"{std::fs::create_dir_all(&root).map_err(|e|e.to_string())?;serve(&root,arg(args,"port").and_then(|s|s.parse().ok()).unwrap_or(8450),&io.env)?;return Ok(json!({"stopped":true}));}
    if ["status","stop"].contains(&command){let empty=json!({});return match alive(&root){Some(record)=>request(&record,if command=="stop"{"/api/stop"}else{"/api/status"},if command=="stop"{Some(&empty)}else{None}),None=>Ok(json!({"running":false,"agentListening":false}))};}
    let record=ensure(&root,arg(args,"port").and_then(|s|s.parse().ok()).unwrap_or(8450),&io.env)?;
    if command=="attach"||arg(args,"target").is_some()||arg(args,"dev-url").is_some(){let dev=arg(args,"dev-url");if dev.as_deref().map(|u|!local_url(u)).unwrap_or(false){return Err("Use a loopback app URL".into());}request(&record,"/api/attach",Some(&json!({"target":arg(args,"target"),"devUrl":dev,"provider":arg(args,"provider")})))?;}
    if let Some(view)=arg(args,"view"){request(&record,"/api/view",Some(&json!({"view":view})))?;}
    if !["open","attach"].contains(&command){return Err(format!("Unknown workspace operation: {command}"));}
    let url=format!("http://127.0.0.1:{}/#{}",record["port"],record["token"].as_str().unwrap());
    if command=="open"&&!args.iter().any(|s|s=="--no-browser"){crate::browser_open::open_url(&url,io.cwd.to_str().unwrap_or("."),&io.env)?;}
    Ok(json!({"url":url,"pid":record["pid"],"workingArea":root.join("previews"),"state":request(&record,"/api/status",None)?}))
}
