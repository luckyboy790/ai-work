import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||process.argv[2]||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.md':'text/plain; charset=utf-8'};
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  let name=decodeURIComponent(url.pathname);
  if(name==='/')name='/index.html';
  const p=path.resolve(root,'.'+name);
  if(!p.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
  if(!(await stat(p)).isFile())throw new Error('not file');
  res.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(await readFile(p));
 }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('未找到文件。请确认项目完整；依赖缺失时执行 npm ci && npm run vendor。');}
}).listen(port,'0.0.0.0',()=>console.log(`\n三体 · 文明回声\n本机：http://localhost:${port}\n触摸设备：同一局域网访问 http://<本机IP>:${port}\nCtrl+C 停止服务。\n`)).on('error',err=>{console.error(err.message);process.exitCode=1});
