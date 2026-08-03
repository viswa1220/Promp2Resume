const fs=require('fs');
for(const line of fs.readFileSync('.env','utf8').split('\n')){
  const m=line.match(/^([A-Z_]+)="?(.*?)"?$/); if(m) process.env[m[1]]=m[2];
}
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRaw`select 1 as ok`
  .then(r => { console.log('DB CONNECT OK:', JSON.stringify(r)); process.exit(0); })
  .catch(e => { console.log('DB ERROR:', String(e.message).split('\n')[0]); process.exit(1); });
