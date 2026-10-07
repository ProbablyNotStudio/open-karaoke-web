import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.mid':'audio/midi','.wav':'audio/wav'};
http.createServer((req,res)=>{try{const decoded=decodeURIComponent(req.url.split('?')[0]);const target=path.resolve(root,'.'+decoded);if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}const file=fs.statSync(target).isDirectory()?path.join(target,'index.html'):target;res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');fs.createReadStream(file).pipe(res);}catch{res.writeHead(404);res.end('Not found');}}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
