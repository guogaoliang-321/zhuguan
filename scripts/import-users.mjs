import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const { pinyin } = require('pinyin-pro');
const { Pool } = require('pg');
const { PrismaClient } = require('../src/generated/prisma/index.js');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: 'postgresql://guogaoliang@localhost:5432/zhuguan?schema=public' });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ROLE_MAP = { '管理员': 'ADMIN', '项目负责人': 'PROJECT_LEAD', '普通员工': 'MEMBER' };

async function run() {
  const wb = XLSX.readFile('/Users/guogaoliang/Downloads/筑管用户导入_医疗健康部.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1);

  const existing = await prisma.user.findMany({ select: { username: true, name: true } });
  const existingUsernames = new Set(existing.map(u => u.username));
  const existingNames = new Set(existing.map(u => u.name));

  const results = [];

  for (const row of rows) {
    const [name, phone, idNumber, roleStr, specialty, remark] = row.map(v => String(v ?? '').trim());
    if (!name) continue;
    if (existingNames.has(name)) {
      results.push({ name, status: '跳过（已存在）' });
      continue;
    }

    let base = pinyin(name, { toneType: 'none', separator: '' }).toLowerCase().replace(/\s/g, '');
    let username = base, n = 2;
    while (existingUsernames.has(username)) username = base + (n++);
    existingUsernames.add(username);

    const rawPwd = idNumber.length >= 8 ? idNumber.slice(-8) : '12345678';
    const password = await bcrypt.hash(rawPwd, 10);
    const role = ROLE_MAP[roleStr] || 'MEMBER';

    try {
      await prisma.user.create({
        data: {
          username,
          password,
          name,
          role,
          phone: phone || null,
          idNumber: idNumber || null,
          specialty: specialty || null,
          position: remark || null,
        },
      });
      results.push({ name, username, password: rawPwd, status: '✅' });
    } catch (e) {
      results.push({ name, username, status: '❌ ' + e.message.split('\n')[0] });
    }
  }

  console.log('\n导入结果：');
  results.forEach(r =>
    console.log(`  ${r.status}  ${r.name}  用户名:${r.username || '-'}  初始密码:${r.password || '-'}`)
  );
  const ok = results.filter(r => r.status.startsWith('✅')).length;
  const skip = results.filter(r => r.status.includes('跳过')).length;
  const fail = results.filter(r => r.status.startsWith('❌')).length;
  console.log(`\n汇总：成功 ${ok}  跳过 ${skip}  失败 ${fail}`);

  await prisma.$disconnect();
  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
