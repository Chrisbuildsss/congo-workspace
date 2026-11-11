//! Optional host notification for the unchanged native question workflow.
use serde_json::{json,Value};
use std::{path::Path,time::Duration};
pub fn local_url(url:&str)->bool{
    let Some(rest)=url.strip_prefix("http://").or_else(||url.strip_prefix("https://"))else{return false};
    let authority=rest.split(['/', '?', '#']).next().unwrap_or("");let (host,port)=authority.split_once(':').map(|(h,p)|(h,Some(p))).unwrap_or((authority,None));
    !url.contains(['\r','\n','\\'])&&["127.0.0.1","localhost"].contains(&host)&&port.map(|p|p.parse::<u16>().map(|p|p>0).unwrap_or(false)).unwrap_or(true)
}
fn notify(host:&str,route:&str,body:Value)->Result<(),String>{
    if !local_url(host){return Err("Workspace host must be loopback".into());}
    let (base,token)=host.split_once('#').ok_or("Workspace URL has no connection token")?;
    ureq::AgentBuilder::new().timeout(Duration::from_secs(2)).redirects(0).build().post(&format!("{}{route}",base.trim_end_matches('/'))).set("Authorization",&format!("Bearer {token}")).send_json(body).map(|_|()).map_err(|e|e.to_string())
}
fn connection_file(qdir:&str,key:&str)->std::path::PathBuf{Path::new(qdir).join(format!("{key}.workspace.json"))}
pub fn attach(host:&str,question_url:&str,qdir:&str,key:&str)->Result<(),String>{
    notify(host,"/api/choices",json!({"url":question_url,"key":key}))?;
    impeccable_common::fsx::write_atomic(connection_file(qdir,key),serde_json::to_string(&json!({"url":host})).unwrap().as_bytes()).map_err(|e|e.to_string())
}
pub struct Wait {host:String,key:String}
impl Wait{
    pub fn for_question(qdir:&str,key:&str)->Option<Self>{
        let v:Value=serde_json::from_slice(&std::fs::read(connection_file(qdir,key)).ok()?).ok()?;
        let host=v["url"].as_str()?.to_string();
        notify(&host,"/api/agent",json!({"key":key,"pid":std::process::id(),"waiting":true})).ok()?;
        Some(Self{host,key:key.into()})
    }
}
impl Drop for Wait{fn drop(&mut self){let _=notify(&self.host,"/api/agent",json!({"key":self.key,"pid":std::process::id(),"waiting":false}));}}

/// A workspace-native question gets its own hidden Windows console so a
/// piped agent command returns instead of retaining its parent's pipe handles.
#[cfg(windows)]
pub fn spawn_question(exe:&str,cwd:&str,args:&[String],_log:&str)->std::io::Result<()> {
    use std::process::{Command,Stdio};
    let quoted:Vec<String>=args.iter().map(|arg|{let mut out=String::from("\"");let mut slashes=0;for c in arg.chars(){if c=='\\'{slashes+=1;continue;}if c=='"'{out.push_str(&"\\".repeat(slashes*2+1));}else{out.push_str(&"\\".repeat(slashes));}out.push(c);slashes=0;}out.push_str(&"\\".repeat(slashes*2));out.push('"');out}).collect();
    let mut command=Command::new("powershell.exe");
    command.args(["-NoProfile","-NonInteractive","-Command","$ErrorActionPreference='Stop'; $nativeArgs=ConvertFrom-Json -InputObject $env:CONGO_NATIVE_ARGS; Start-Process -FilePath $env:CONGO_NATIVE_EXE -ArgumentList ($nativeArgs -join ' ') -WorkingDirectory $env:CONGO_NATIVE_CWD -WindowStyle Hidden | Out-Null"])
        .env("CONGO_NATIVE_EXE",exe).env("CONGO_NATIVE_CWD",cwd).env("CONGO_NATIVE_ARGS",serde_json::to_string(&quoted).unwrap()).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    impeccable_common::proc::hide_window(&mut command);
    if command.status()?.success(){Ok(())}else{Err(std::io::Error::other("Could not start native Choices in its hidden console"))}
}

#[cfg(test)]mod tests{use super::*;#[test]fn only_local_hosts(){assert!(local_url("http://127.0.0.1:8450/#token"));assert!(local_url("http://localhost:9000/?key=x"));for s in ["javascript:alert(1)","http://localhost.evil/","http://localhost:80@evil/","https://example.com/"]{assert!(!local_url(s),"{s}");}}}
