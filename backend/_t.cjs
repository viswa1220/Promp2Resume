const fs=require('fs');
for(const line of fs.readFileSync('.env','utf8').split('\n')){const m=line.match(/^([A-Z_]+)="?(.*?)"?$/);if(m)process.env[m[1]]=m[2];}
const { PrismaClient } = require('@prisma/client');
new PrismaClient().$queryRaw`select 1`.then(()=>{console.log('OK');process.exit(0)}).catch(e=>{console.log('FULL:',e.message);process.exit(1)});
