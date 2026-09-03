/**
 * D1 数据库连接测试脚本
 * 测试数据库表是否创建成功
 */

require('dotenv').config();
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const DATABASE_NAME = 'lottery-materials-db';

async function testDatabase() {
  console.log('🚀 开始测试 D1 数据库连接...\n');
  
  try {
    // 测试1: 列出所有表
    console.log('📋 测试1: 列出所有数据表...');
    const { stdout: tables } = await execPromise(
      `npx wrangler d1 execute ${DATABASE_NAME} --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"`
    );
    console.log(tables);
    
    // 测试2: 查询 lottery_results 表结构
    console.log('\n📋 测试2: 查询 lottery_results 表结构...');
    const { stdout: schema1 } = await execPromise(
      `npx wrangler d1 execute ${DATABASE_NAME} --remote --command="PRAGMA table_info(lottery_results)"`
    );
    console.log(schema1);
    
    // 测试3: 查询 materials 表结构
    console.log('\n📋 测试3: 查询 materials 表结构...');
    const { stdout: schema2 } = await execPromise(
      `npx wrangler d1 execute ${DATABASE_NAME} --remote --command="PRAGMA table_info(materials)"`
    );
    console.log(schema2);
    
    // 测试4: 插入测试数据
    console.log('\n📋 测试4: 插入测试数据...');
    const testDate = new Date().toISOString().split('T')[0];
    const { stdout: insert } = await execPromise(
      `npx wrangler d1 execute ${DATABASE_NAME} --remote --command="INSERT INTO lottery_results (lottery_type, period, year, draw_date, numbers) VALUES ('hongkong', 1, 2026, '${testDate}', '[1,2,3,4,5,6,7]')"`
    );
    console.log('✅ 测试数据插入成功');
    
    // 测试5: 查询测试数据
    console.log('\n📋 测试5: 查询测试数据...');
    const { stdout: select } = await execPromise(
      `npx wrangler d1 execute ${DATABASE_NAME} --remote --command="SELECT * FROM lottery_results LIMIT 1"`
    );
    console.log(select);
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 数据库测试完成！所有功能正常！');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    if (error.stderr) {
      console.error('详细错误:', error.stderr);
    }
  }
}

testDatabase();
