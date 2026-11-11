//! Thin local host for the existing question page and the running app/editor.
//! Choice rendering, answers, agent waits, editing and acceptance stay upstream.
mod cli;
use crate::util::Env;
use impeccable_common::http::{read_request_deadline, send_response, Request, Response};
use serde_json::{json, Value};
use std::{net::{TcpListener,TcpStream},path::{Path,PathBuf},sync::{Arc,Mutex,atomic::{AtomicBool,AtomicUsize,Ordering}},time::Duration};
pub use cli::run;

struct Host {root:PathBuf,token:String,port:u16,env:Env,metadata:Mutex<Value>,stopped:AtomicBool,connections:AtomicUsize}
fn read_json(path:impl AsRef<Path>)->Option<Value>{serde_json::from_slice(&std::fs::read(path).ok()?).ok()}
fn persist(host:&Host,value:&Value)->Result<(),String>{impeccable_common::fsx::write_atomic(host.root.join("workspace.json"),serde_json::to_string_pretty(value).unwrap().as_bytes()).map_err(|e|e.to_string())}
fn ok(v:Value)->Response{Response::new(200).json(&v)}
fn local_url(url:&str)->bool{impeccable_context::workspace_bridge::local_url(url)}
fn serve(root:&Path,port:u16,env:&Env)->Result<(),String>{
    // Keep the private host connection stable across a normal restart, so an
    // existing native question wait can reconnect without replacing its page.
    let connection=read_json(root.join("connection.json")).unwrap_or(Value::Null);
    let port=connection["port"].as_u64().filter(|p|*p>0&&*p<=65435).map(|p|p as u16).unwrap_or(port);
    let listener=(port..port.saturating_add(100)).find_map(|p|TcpListener::bind(("127.0.0.1",p)).ok()).ok_or("No workspace port available")?;
    let port=listener.local_addr().map_err(|e|e.to_string())?.port();listener.set_nonblocking(true).map_err(|e|e.to_string())?;
    let metadata=read_json(root.join("workspace.json")).filter(Value::is_object).unwrap_or(json!({"view":"choices"}));
    let token=connection["token"].as_str().filter(|s|!s.is_empty()).map(String::from).unwrap_or_else(crate::random::random_uuid);
    let host=Arc::new(Host{root:root.into(),token,port,env:env.clone(),metadata:Mutex::new(metadata),stopped:AtomicBool::new(false),connections:AtomicUsize::new(0)});
    let record=json!({"protocol":1,"pid":std::process::id(),"port":port,"token":host.token});
    impeccable_common::fsx::write_atomic(root.join("connection.json"),serde_json::to_string(&record).unwrap().as_bytes()).map_err(|e|e.to_string())?;
    impeccable_common::fsx::write_atomic(root.join("server.json"),serde_json::to_string(&record).unwrap().as_bytes()).map_err(|e|e.to_string())?;
    while !host.stopped.load(Ordering::SeqCst){match listener.accept(){Ok((stream,_))=>{let _=stream.set_nonblocking(false);host.connections.fetch_add(1,Ordering::SeqCst);let host=host.clone();std::thread::spawn(move||connection(stream,host));},Err(e) if e.kind()==std::io::ErrorKind::WouldBlock=>std::thread::sleep(Duration::from_millis(20)),Err(e)=>return Err(e.to_string())}}
    drop(listener);
    for _ in 0..100 {if host.connections.load(Ordering::SeqCst)==0{break}std::thread::sleep(Duration::from_millis(20));}
    let _=std::fs::remove_file(root.join("server.json"));Ok(())
}
fn connection(mut stream:TcpStream,host:Arc<Host>){
    struct Active<'a>(&'a AtomicUsize);impl Drop for Active<'_>{fn drop(&mut self){self.0.fetch_sub(1,Ordering::SeqCst);}}let _active=Active(&host.connections);
    let Some(req)=read_request_deadline(&stream,1024*1024,Duration::from_secs(10))else{return};
    let origin=format!("http://127.0.0.1:{}",host.port);let authority=format!("127.0.0.1:{}",host.port);
    let native=req.path=="/native-choices";
    let response=if req.header("host")!=Some(authority.as_str())||req.header("origin").map(|o|o!=origin).unwrap_or(false){Response::new(403).json(&json!({"error":"Use this workspace's loopback origin"}))}
    else if req.method=="GET"&&req.path=="/health"{ok(json!({"service":"congo-workspace","protocol":1}))}
    else if req.method=="GET"&&req.path=="/favicon.ico"{Response::new(204)}
    else if req.method=="POST"&&req.path=="/heartbeat"{Response::new(204)}
    else if req.method=="GET"&&["/","/workspace.js","/workspace.css","/native.css","/native-choices"].contains(&req.path.as_str()){asset(&req.path)}
    else if req.header("authorization")!=Some(format!("Bearer {}",host.token).as_str()){Response::new(401).json(&json!({"error":"Unauthorized"}))}
    else if req.body_truncated{Response::new(413).text("Request too large")}
    else{route(&req,&host).unwrap_or_else(|e|Response::new(409).json(&json!({"error":e})))};
    // Only the original, trusted empty question page needs its existing inline
    // script. The parent adapter and library use external scripts, with no eval.
    let policy=if native{"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src https: data:; frame-ancestors 'self'; base-uri 'none'"}else{"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src https: data:; frame-src http://127.0.0.1:* http://localhost:* https://127.0.0.1:* https://localhost:*; frame-ancestors 'none'; base-uri 'none'"};
    send_response(&mut stream,&[],&response.header("Cache-Control","no-store").header("Referrer-Policy","no-referrer").header("Content-Security-Policy",policy));
}
fn asset(path:&str)->Response{
    if path=="/native-choices"{return Response::new(200).header("Content-Type","text/html; charset=utf-8").text(&impeccable_context::serve_question::workspace_empty_page());}
    let (mime,body)=match path{
        "/workspace.js"=>("text/javascript",include_str!("assets/host.js")),
        "/workspace.css"=>("text/css",include_str!("assets/host.css")),
        "/native.css"=>{let p=impeccable_context::question_page::PAGE;let css=p.split_once("<style>").and_then(|(_,s)|s.split_once("</style>")).map(|(s,_)|s).unwrap_or("");return Response::new(200).header("Content-Type","text/css; charset=utf-8").text(&css.replace("@media (prefers-color-scheme: dark)","@media all"));},
        _=>("text/html",include_str!("assets/host.html")),
    };Response::new(200).header("Content-Type",&format!("{mime}; charset=utf-8")).text(body)
}
fn route(req:&Request,host:&Host)->Result<Response,String>{
    if req.method=="GET"&&req.path=="/api/ping"{return Ok(ok(json!({"protocol":1})));}
    if req.method=="GET"&&req.path=="/api/library"{return library(req);}
    let mut state=host.metadata.lock().unwrap_or_else(|e|e.into_inner());
    if req.method=="GET"&&req.path=="/api/status"{
        let waiter=state["waiting"]==true&&state["agentPid"].as_i64().map(impeccable_common::proc::pid_reachable).unwrap_or(false);
        let live=state["target"].as_str().and_then(|p|crate::paths::read_live_server_info(p,&host.env)).and_then(|(s,_)|Some((s.port?,s.token?))).and_then(|(port,token)|crate::server::fetch_status(port,&token));
        let listening=waiter||live.as_ref().map(|s|s["agentPolling"]==true).unwrap_or(false);
        let reachable=state["devUrl"].as_str().map(|url|match ureq::AgentBuilder::new().timeout(Duration::from_millis(700)).redirects(0).build().head(url).call(){Ok(_)=>true,Err(ureq::Error::Status(code,_))=>code<500,Err(_)=>false}).unwrap_or(false);
        return Ok(ok(json!({"protocol":1,"view":state["view"],"choicesUrl":state["choicesUrl"],"devUrl":state["devUrl"],"appReachable":reachable,"target":state["target"],"provider":state["provider"],"agentListening":listening,"live":live,"workingArea":host.root.join("previews")})));
    }
    if req.method!="POST"{return Ok(Response::new(404).text("Not found"));}
    let body:Value=serde_json::from_slice(&req.body).map_err(|e|e.to_string())?;
    match req.path.as_str(){
        "/api/view"=>{let v=body["view"].as_str().ok_or("Missing view")?;if !["choices","live-app"].contains(&v){return Err("Unknown view".into());}state["view"]=json!(v);}
        "/api/attach"=>{if let Some(url)=body["devUrl"].as_str(){if !local_url(url){return Err("Use a loopback app URL".into());}state["devUrl"]=json!(url);}if let Some(target)=body["target"].as_str(){if !Path::new(target).is_dir(){return Err("Project directory not found".into());}state["target"]=json!(target);}if let Some(provider)=body["provider"].as_str(){state["provider"]=json!(provider);}}
        "/api/choices"=>{let url=body["url"].as_str().ok_or("Missing native Choices URL")?;if !local_url(url){return Err("Native Choices must run on loopback".into());}state["choicesUrl"]=json!(url);state["questionKey"]=body["key"].clone();state["waiting"]=json!(false);state["view"]=json!("choices");}
        "/api/agent"=>{if body["key"]==state["questionKey"]&&(body["waiting"]==true||body["pid"]==state["agentPid"]){state["agentPid"]=body["pid"].clone();state["waiting"]=body["waiting"].clone();}}
        "/api/try"=>{
            let waiting=state["waiting"]==true&&state["agentPid"].as_i64().map(impeccable_common::proc::pid_reachable).unwrap_or(false);
            let item=&body["item"];let id=item["id"].as_str().ok_or("Missing library item")?;
            let steer=format!("Try Congo {}@{} for the current request. Retrieve the relevant source through Congo's existing authorized CLI/MCP path, adapt it into a working choice, preserve source pins and notices, and update this same Choices round. Ask missing context in our existing chat. Reference metadata: {}",id,item["version"].as_str().unwrap_or("current"),item);
            // Reuse the original question answer/re-roll path. The existing
            // --wait receives this steer and --update refreshes the same page.
            if waiting {
                let base=state["choicesUrl"].as_str().ok_or("No active Choices round")?.split('?').next().unwrap_or("").trim_end_matches('/');
                let key=state["questionKey"].as_str().ok_or("No active Choices key")?;
                ureq::post(&format!("{base}/answer?key={}",crate::util::encode_uri_component(key))).send_json(json!({"optionId":"reroll","steer":steer})).map_err(|e|e.to_string())?;
            } else {
                // The original global live-page chat already accepts
                // selection-free steer requests. Reuse that exact event path.
                let target=state["target"].as_str().ok_or("Continue in your existing AI chat and attach its app or resume Choices first.")?;
                let (server,_)=crate::paths::read_live_server_info(target,&host.env).ok_or("No active app/AI connection; resume your existing chat first.")?;
                let port=server.port.ok_or("Invalid live server")?;let token=server.token.ok_or("Invalid live server")?;
                if crate::server::fetch_status(port,&token).map(|s|s["agentPolling"]!=true).unwrap_or(true){return Err("Your AI is not listening; resume the existing live poll first.".into());}
                ureq::post(&format!("http://127.0.0.1:{port}/events")).send_json(json!({"token":token,"id":crate::random::random_uuid(),"type":"steer","message":format!("Use the separate Redesign skill and open Choices directly for this library request. {steer}")})).map_err(|e|e.to_string())?;
            }
            state["view"]=json!("choices");
        }
        "/api/stop"=>host.stopped.store(true,Ordering::SeqCst),
        _=>return Ok(Response::new(404).text("Not found")),
    }
    persist(host,&state)?;Ok(ok(json!({"ok":true})))
}
fn library(req:&Request)->Result<Response,String>{
    let kind=req.query_get("kind").unwrap_or("screen");if !["screen","template","handbook"].contains(&kind){return Err("Choose screens, templates or handbooks".into());}
    let offset=req.query_get("offset").unwrap_or("0").parse::<u64>().map_err(|_|"Invalid offset")?;
    let query=crate::util::encode_uri_component(req.query_get("query").unwrap_or(""));
    let url=if kind=="screen"{format!("https://buildwithcongo.com/api/screens?q={query}&limit=20&offset={offset}")}else{format!("https://buildwithcongo.com/api/library-search?view=resources&kind={kind}&q={query}&limit=20&offset={offset}")};
    let response=ureq::AgentBuilder::new().timeout(Duration::from_secs(12)).build().get(&url).call().map_err(|e|e.to_string())?;
    Ok(ok(response.into_json().map_err(|e|e.to_string())?))
}
