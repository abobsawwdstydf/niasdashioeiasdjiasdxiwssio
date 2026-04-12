#!/bin/bash
# === NEXO SMTP CLIENT — FULL DEPLOY SCRIPT ===
# Запускается на сервере
set -e
D="$HOME/nexo-smtp-client"
mkdir -p "$D/src" "$D/public" "$D/data" "$D/logs"
cd "$D"

echo "🚀 NEXO SMTP Client — Deploy на сервере"
echo "========================================"
echo ""

# ─── 1. package.json ───
echo "📦 Создание package.json..."
cat > package.json << 'PKEOF'
{"name":"nexo-smtp-client","version":"1.0.0","main":"src/index.js","scripts":{"start":"node src/index.js"},"dependencies":{"express":"^4.18.2","express-session":"^1.17.3","bcryptjs":"^2.4.3","ws":"^8.16.0","nodemailer":"^6.9.7","better-sqlite3":"^9.2.2"}}
PKEOF

# ─── 2. Node modules ───
echo "📦 Установка зависимостей (это может занять минуту)..."
npm install --production 2>&1 | tail -5
echo "✅ Зависимости установлены"
echo ""

# ─── 3. .env ───
if [ ! -f .env ]; then
  cat > .env << 'ENVEOF'
SERVER_URL=wss://your-server.com
TUNNEL_TOKEN=sk_live_xxxxx
PANEL_PORT=3000
ENVEOF
  echo "⚠️  .env создан — отредактируй!"
  echo "   nano ~/nexo-smtp-client/.env"
fi
echo ""

# ─── 4. src/db.js ───
echo "📝 Создание файлов..."
cat > src/db.js << 'DBEOF'
const Database=require('better-sqlite3'),path=require('path'),fs=require('fs');
const DATA_DIR=path.join(__dirname,'..','data');
if(!fs.existsSync(DATA_DIR))fs.mkdirSync(DATA_DIR,{recursive:true});
let db;
function initDB(){
  db=new Database(path.join(DATA_DIR,'smtp-client.db'));
  db.pragma('journal_mode = WAL');
  db.exec(`CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS smtp_accounts(id TEXT PRIMARY KEY,host TEXT NOT NULL,port INTEGER NOT NULL,secure INTEGER DEFAULT 1,user TEXT NOT NULL,password TEXT NOT NULL,from_name TEXT,from_email TEXT,daily_limit INTEGER DEFAULT 0,priority INTEGER DEFAULT 1,active INTEGER DEFAULT 1,sent_today INTEGER DEFAULT 0,sent_total INTEGER DEFAULT 0,last_error TEXT,created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.exec(`CREATE TABLE IF NOT EXISTS send_logs(id INTEGER PRIMARY KEY AUTOINCREMENT,timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,task_id TEXT,to_email TEXT,subject TEXT,smtp_account_id TEXT,status TEXT,error TEXT,message_id TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS daily_stats(date TEXT PRIMARY KEY,total_sent INTEGER DEFAULT 0,total_failed INTEGER DEFAULT 0)`);
  console.log('  ✅ SQLite готова');
}
function getDB(){if(!db)initDB();return db;}
module.exports={getDB,initDB};
DBEOF

# ─── 5. src/settings.js ───
cat > src/settings.js << 'SETEOF'
const{getDB}=require('./db');
const D={panelPort:'3000',adminUsername:'',adminPasswordHash:'',serverUrl:'',tunnelToken:'',theme:'dark',language:'ru',setupComplete:'0'};
function loadSettings(){
  const db=getDB(),r=db.prepare('SELECT key,value FROM settings').all(),s={...D};
  for(const x of r)s[x.key]=x.value;
  s.panelPort=parseInt(s.panelPort)||3000;s.setupComplete=s.setupComplete==='1';
  return s;
}
function saveSettings(u){
  const db=getDB(),st=db.prepare('INSERT OR REPLACE INTO settings(key,value)VALUES(?,?)'),
  tx=db.transaction(e=>{for(const[k,v]of e)st.run(k,String(v))});
  tx(Object.entries(u));
}
module.exports={loadSettings,saveSettings};
SETEOF

# ─── 6. src/tunnel.js ───
cat > src/tunnel.js << 'TNEOF'
const WebSocket=require('ws'),{sendEmailViaSMTP}=require('./smtp-engine'),{getDB}=require('./db');
let ws=null,isConnected=false,reconnectTimer=null,pingTimer=null,hbTimeout=null;
global.tunnelStatus={connected:false,lastActivity:null,pendingTasks:0,error:null};

function connect(settings){
  if(reconnectTimer){clearTimeout(reconnectTimer);reconnectTimer=null;}
  const url=settings.serverUrl.replace('http','ws').replace('https','wss');
  const tp=url.includes('/tunnel')?url:url+'/tunnel';
  console.log('🔗 Подключение: '+tp);
  try{ws=new WebSocket(tp,{headers:{'X-Tunnel-Token':settings.tunnelToken}});}
  catch(e){console.error('❌ '+e.message);scheduleReconnect(settings);return;}

  ws.on('open',()=>{
    console.log('✅ Туннель подключён');isConnected=true;
    global.tunnelStatus={connected:true,lastActivity:new Date().toISOString(),pendingTasks:0,error:null};
    ws.send(JSON.stringify({type:'auth',token:settings.tunnelToken}));
    startHB(settings);
  });

  ws.on('message',d=>{
    global.tunnelStatus.lastActivity=new Date().toISOString();
    try{handleMsg(JSON.parse(d.toString()),settings);}catch(e){}
  });

  ws.on('close',()=>{
    console.log('🔌 Отключён');isConnected=false;
    global.tunnelStatus={connected:false,lastActivity:global.tunnelStatus.lastActivity,pendingTasks:0,error:'Отключено'};
    stopHB();scheduleReconnect(settings);
  });

  ws.on('error',e=>{global.tunnelStatus.error=e.message;});
}

function handleMsg(m,s){
  if(m.type==='authenticated'){console.log('🔑 Auth OK');ws.send(JSON.stringify({type:'ready'}));}
  else if(m.type==='pong'){if(hbTimeout){clearTimeout(hbTimeout);hbTimeout=null;}}
  else if(m.type==='send-email')handleEmail(m);
}

async function handleEmail(m){
  const{taskId,data}=m;
  console.log('📧 '+taskId+': '+(data?.to||'?'));
  try{
    const r=await sendEmailViaSMTP(data);
    if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({taskId,result:{success:true,messageId:r.messageId}}));
    log(taskId,data?.to,data?.subject,'success',null,r.messageId);
  }catch(e){
    if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({taskId,result:{success:false,error:e.message}}));
    log(taskId,data?.to,data?.subject,'failed',e.message,null);
  }
}

function startHB(s){
  stopHB();
  pingTimer=setInterval(()=>{
    if(ws?.readyState===WebSocket.OPEN){
      ws.send(JSON.stringify({type:'ping'}));
      hbTimeout=setTimeout(()=>{console.warn('⚠️ HB timeout');ws.close();},10000);
    }
  },30000);
}
function stopHB(){
  if(pingTimer){clearInterval(pingTimer);pingTimer=null;}
  if(hbTimeout){clearTimeout(hbTimeout);hbTimeout=null;}
}
function scheduleReconnect(s){
  if(reconnectTimer)return;
  reconnectTimer=setTimeout(()=>{console.log('🔄 Переподключение...');connect(s);},5000);
}

function log(tid,to,sub,st,err,mid){
  try{
    const db=getDB();
    db.prepare('INSERT INTO send_logs(task_id,to_email,subject,status,error,message_id)VALUES(?,?,?,?,?,?)')
      .run(tid||null,to||null,sub||null,st,err||null,mid||null);
    const td=new Date().toISOString().split('T')[0],
          ex=db.prepare('SELECT*FROM daily_stats WHERE date=?').get(td);
    if(ex) db.prepare('UPDATE daily_stats SET total_'+(st==='success'?'sent':'failed')+'=total_'+(st==='success'?'sent':'failed')+'+1 WHERE date=?').run(td);
    else db.prepare('INSERT INTO daily_stats(date,total_sent,total_failed)VALUES(?,?,?)').run(td,st==='success'?1:0,st==='failed'?1:0);
  }catch(e){}
}

function startTunnel(settings){connect(settings);}
function getTunnelStatus(){return{...global.tunnelStatus};}
function restartTunnel(settings){
  if(ws){ws.removeAllListeners();ws.close();ws=null;}
  isConnected=false;stopHB();connect(settings);
}
module.exports={startTunnel,getTunnelStatus,restartTunnel};
TNEOF

# ─── 7. src/smtp-engine.js ───
cat > src/smtp-engine.js << 'SMEOF'
const nodemailer=require('nodemailer'),{getDB}=require('./db'),transporters=new Map();

async function sendEmailViaSMTP(data){
  const db=getDB(),{to,subject,html,fromName}=data;
  const accounts=db.prepare('SELECT*FROM smtp_accounts WHERE active=1 ORDER BY priority ASC,sent_today ASC').all();
  if(!accounts.length)throw new Error('Нет SMTP аккаунтов');
  let lastErr;
  for(const a of accounts){
    if(a.daily_limit>0&&a.sent_today>=a.daily_limit)continue;
    try{
      let tr=transporters.get(a.id);
      if(!tr){
        tr=nodemailer.createTransport({host:a.host,port:a.port,secure:a.secure===1,auth:{user:a.user,pass:a.password},tls:{rejectUnauthorized:false}});
        transporters.set(a.id,tr);
      }
      const r=await tr.sendMail({
        from:fromName?'"'+fromName+'" <'+(a.from_email||a.user)+'>':(a.from_email||a.user),
        to,subject,html:html||'',
        text:html?html.replace(/<[^>]*>/g,'').substring(0,200):''
      });
      db.prepare('UPDATE smtp_accounts SET sent_today=sent_today+1,sent_total=sent_total+1,last_error=NULL WHERE id=?').run(a.id);
      return{success:true,messageId:r.messageId,accountId:a.id};
    }catch(e){
      lastErr=e.message;
      db.prepare('UPDATE smtp_accounts SET last_error=? WHERE id=?').run(e.message.substring(0,500),a.id);
      transporters.delete(a.id);
    }
  }
  throw new Error('Все SMTP отказали: '+lastErr);
}

async function testSMTPAccount(a){
  const tr=nodemailer.createTransport({host:a.host,port:a.port,secure:a.secure===1||a.port===465,auth:{user:a.user,pass:a.password},tls:{rejectUnauthorized:false}});
  try{await tr.verify();return{success:true,message:'OK'};}catch(e){return{success:false,message:e.message};}
}

setInterval(()=>{const n=new Date();if(n.getHours()===0&&n.getMinutes()===0){getDB().prepare('UPDATE smtp_accounts SET sent_today=0').run();console.log('📊 Счётчики сброшены');}},60000);
module.exports={sendEmailViaSMTP,testSMTPAccount};
SMEOF

# ─── 8. src/web-panel.js ───
cat > src/web-panel.js << 'WPEOF'
const express=require('express'),session=require('express-session'),bcrypt=require('bcryptjs'),path=require('path'),
      {getDB}=require('./db'),{loadSettings,saveSettings}=require('./settings'),
      {getTunnelStatus,restartTunnel}=require('./tunnel'),{testSMTPAccount}=require('./smtp-engine'),crypto=require('crypto');

function startWebPanel(settings){
  const app=express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname,'..','public')));
  app.use(session({secret:crypto.randomBytes(32).toString('hex'),resave:false,saveUninitialized:false,cookie:{maxAge:86400000}}));

  function requireAuth(req,res,next){if(!settings.setupComplete)return next();if(req.session.authenticated)return next();res.status(401).json({error:'Не авторизован'});}

  app.post('/api/auth/login',(req,res)=>{
    const{username,password}=req.body;
    if(username===settings.adminUsername&&bcrypt.compareSync(password,settings.adminPasswordHash)){
      req.session.authenticated=true;res.json({ok:true});
    }else res.status(401).json({error:'Неверно'});
  });
  app.post('/api/auth/logout',(req,res)=>{req.session.destroy();res.json({ok:true});});
  app.get('/api/auth/status',(req,res)=>res.json({setupComplete:settings.setupComplete,authenticated:!!req.session.authenticated}));

  app.post('/api/setup',(req,res)=>{
    if(settings.setupComplete){res.status(400).json({error:'Уже настроено'});return;}
    const{username,password}=req.body;
    if(!username||!password||password.length<4){res.status(400).json({error:'Минимум 4 символа'});return;}
    saveSettings({adminUsername:username,adminPasswordHash:bcrypt.hashSync(password,10),setupComplete:'1'});
    req.session.authenticated=true;Object.assign(settings,loadSettings());res.json({ok:true});
  });

  app.use(requireAuth);

  app.get('/api/stats',(req,res)=>{
    const db=getDB(),today=new Date().toISOString().split('T')[0];
    const ts=db.prepare('SELECT*FROM daily_stats WHERE date=?').get(today)||{total_sent:0,total_failed:0};
    const total=db.prepare('SELECT COALESCE(SUM(total_sent),0)as total_sent,COALESCE(SUM(total_failed),0)as total_failed FROM daily_stats').get();
    res.json({today:ts,total,queue:0});
  });

  app.get('/api/logs',(req,res)=>{
    const db=getDB(),{status,limit=50,offset=0}=req.query;
    let q='SELECT*FROM send_logs',p=[];
    if(status){q+=' WHERE status=?';p.push(status);}
    q+=' ORDER BY timestamp DESC LIMIT ? OFFSET ?';p.push(parseInt(limit),parseInt(offset));
    const logs=db.prepare(q).all(...p);
    res.json({logs,total:db.prepare('SELECT COUNT(*)as count FROM send_logs').get().count});
  });

  app.get('/api/smtp-accounts',(req,res)=>{
    const db=getDB();
    res.json(db.prepare('SELECT id,host,port,secure,user,from_name,from_email,daily_limit,priority,active,sent_today,sent_total,last_error,created_at FROM smtp_accounts ORDER BY priority ASC').all());
  });

  app.post('/api/smtp-accounts',(req,res)=>{
    const db=getDB(),{host,port,secure,user,password,from_name,from_email,daily_limit,priority}=req.body;
    if(!host||!port||!user||!password){res.status(400).json({error:'host,port,user,password обязательны'});return;}
    const id=crypto.randomUUID();
    db.prepare('INSERT INTO smtp_accounts(id,host,port,secure,user,password,from_name,from_email,daily_limit,priority)VALUES(?,?,?,?,?,?,?,?,?,?)')
      .run(id,host,parseInt(port),secure?1:0,user,password,from_name||'',from_email||user,parseInt(daily_limit)||0,parseInt(priority)||1);
    res.json({ok:true,id});
  });

  app.put('/api/smtp-accounts/:id',(req,res)=>{
    const db=getDB(),u=[],p=[];
    if(req.body.active!==undefined){u.push('active=?');p.push(req.body.active?1:0);}
    if(req.body.priority!==undefined){u.push('priority=?');p.push(parseInt(req.body.priority));}
    if(req.body.daily_limit!==undefined){u.push('daily_limit=?');p.push(parseInt(req.body.daily_limit));}
    if(!u.length){res.status(400).json({error:'Нет полей'});return;}
    p.push(req.params.id);
    db.prepare('UPDATE smtp_accounts SET '+u.join(', ')+' WHERE id=?').run(...p);
    res.json({ok:true});
  });

  app.delete('/api/smtp-accounts/:id',(req,res)=>{
    const db=getDB();db.prepare('DELETE FROM smtp_accounts WHERE id=?').run(req.params.id);res.json({ok:true});
  });

  app.post('/api/smtp-accounts/:id/test',async(req,res)=>{
    const db=getDB(),acc=db.prepare('SELECT*FROM smtp_accounts WHERE id=?').get(req.params.id);
    if(!acc){res.status(404).json({error:'Не найден'});return;}
    res.json(await testSMTPAccount(acc));
  });

  app.get('/api/tunnel',(req,res)=>res.json(getTunnelStatus()));
  app.post('/api/tunnel/restart',(req,res)=>{restartTunnel(loadSettings());res.json({ok:true});});
  app.post('/api/tunnel/test',(req,res)=>{const s=getTunnelStatus();res.json({ok:s.connected,message:s.connected?'Подключён':'Не подключён',status:s});});

  app.get('/api/settings',(req,res)=>{
    const s=loadSettings();
    res.json({panelPort:s.panelPort,serverUrl:s.serverUrl,tunnelToken:s.tunnelToken?'****'+s.tunnelToken.slice(-4):'',theme:s.theme,language:s.language,autoStart:s.autoStart,adminUsername:s.adminUsername});
  });

  app.post('/api/settings',(req,res)=>{
    const u={};
    if(req.body.serverUrl!==undefined)u.serverUrl=req.body.serverUrl;
    if(req.body.tunnelToken!==undefined&&req.body.tunnelToken!=='****')u.tunnelToken=req.body.tunnelToken;
    if(req.body.theme!==undefined)u.theme=req.body.theme;
    if(req.body.adminUsername!==undefined)u.adminUsername=req.body.adminUsername;
    if(req.body.adminPassword&&req.body.adminPassword.length>=4)u.adminPasswordHash=bcrypt.hashSync(req.body.adminPassword,10);
    saveSettings(u);Object.assign(settings,loadSettings());res.json({ok:true});
  });

  app.get('/api/diagnostics',(req,res)=>{
    const os=require('os'),db=getDB();
    res.json({os:os.type()+' '+os.release(),nodeVersion:process.version,uptime:Math.floor(process.uptime()),
      cpuUsage:os.loadavg(),freeMemory:os.freemem(),totalMemory:os.totalmem(),
      smtpAccounts:db.prepare('SELECT COUNT(*)as count FROM smtp_accounts').get().count,
      activeSMTP:db.prepare('SELECT COUNT(*)as count FROM smtp_accounts WHERE active=1').get().count,
      tunnelStatus:getTunnelStatus()});
  });

  app.listen(settings.panelPort,'0.0.0.0',()=>{
    console.log('🌐 Панель: http://0.0.0.0:'+settings.panelPort);
    console.log('   Локально: http://localhost:'+settings.panelPort);
  });
}
module.exports={startWebPanel};
WPEOF

# ─── 9. src/index.js ───
cat > src/index.js << 'IDXEOF'
const{startWebPanel}=require('./web-panel'),{startTunnel}=require('./tunnel'),{initDB}=require('./db'),{loadSettings}=require('./settings');
require('dotenv').config({path:'.env'});

async function main(){
  console.log('🚀 NEXO SMTP Client v1.0');
  console.log('─────────────────────────');
  initDB();console.log('✅ База данных готова');
  const s=loadSettings();
  if(process.env.PANEL_PORT)s.panelPort=parseInt(process.env.PANEL_PORT);
  if(process.env.SERVER_URL)s.serverUrl=process.env.SERVER_URL;
  if(process.env.TUNNEL_TOKEN)s.tunnelToken=process.env.TUNNEL_TOKEN;
  console.log('📡 Панель: http://0.0.0.0:'+s.panelPort);
  startWebPanel(s);
  if(s.serverUrl&&s.tunnelToken){startTunnel(s);}else{console.log('⏳ Туннель не настроен');}
}
main().catch(e=>{console.error('❌ Fatal:',e);process.exit(1);});
IDXEOF

echo "✅ Все файлы созданы"
echo ""

# ─── 10. HTML панель (public/index.html) ───
echo "📝 Копирование веб-панели..."
# HTML будет скопирован через scp отдельно
echo "⚠️  HTML нужно скопировать отдельно через scp"

echo ""
echo "════════════════════════════════════════════"
echo "  ✅ ФАЙЛЫ СОЗДАНЫ!"
echo "════════════════════════════════════════════"
echo ""
echo "Далее:"
echo "  1. Скопируй public/index.html:"
echo "     scp public/index.html nexo-smtp@SERVER:~/nexo-smtp-client/public/"
echo "  2. Отредактируй .env:"
echo "     nano ~/nexo-smtp-client/.env"
echo "  3. Запусти:"
echo "     cd ~/nexo-smtp-client && node src/index.js"
echo ""
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo "📡 Панель будет на: http://${IP:-localhost}:3000"
