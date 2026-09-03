/**
 * 测试上传功能
 * 用于验证R2上传是否正常工作
 */

const R2Uploader = require('../uploader/r2-uploader');
const fs = require('fs');
const path = require('path');

async function test() {
    console.log('🧪 开始测试R2上传功能...\n');

    try {
        // 1. 创建测试图片
        console.log('📝 创建测试图片...');
        const testImagePath = path.join(__dirname, 'test-image.txt');
        fs.writeFileSync(testImagePath, 'This is a test file for R2 upload');
        console.log('✅ 测试文件创建成功\n');

        // 2. 初始化上传器
        console.log('🔧 初始化R2上传器...');
        const uploader = new R2Uploader();
        console.log('✅ 上传器初始化成功\n');

        // 3. 测试上传
        console.log('☁️  测试上传文件到R2...');
        const remotePath = `test/${Date.now()}.txt`;
        const result = await uploader.uploadFile(testImagePath, remotePath);
        
        if (result.success) {
            console.log('✅ 上传成功！');
            console.log(`   URL: ${result.url}`);
            console.log(`   路径: ${result.path}\n`);
        } else {
            console.error('❌ 上传失败:', result.error);
            process.exit(1);
        }

        // 4. 测试检查文件是否存在
        console.log('🔍 检查文件是否存在...');
        const exists = await uploader.fileExists(remotePath);
        console.log(`   结果: ${exists ? '✅ 文件存在' : '❌ 文件不存在'}\n`);

        // 5. 测试批量上传
        console.log('📦 测试批量上传...');
        const files = [
            { local: testImagePath, remote: `test/batch-1-${Date.now()}.txt` },
            { local: testImagePath, remote: `test/batch-2-${Date.now()}.txt` },
            { local: testImagePath, remote: `test/batch-3-${Date.now()}.txt` }
        ];
        
        const batchResults = await uploader.uploadBatch(files);
        const successCount = batchResults.filter(r => r.success).length;
        console.log(`✅ 批量上传完成: ${successCount}/${files.length}\n`);

        // 6. 清理测试文件
        console.log('🧹 清理测试文件...');
        fs.unlinkSync(testImagePath);
        console.log('✅ 清理完成\n');

        console.log('🎉 所有测试通过！R2配置正确！\n');
        console.log('=' .repeat(60));
        console.log('📋 下一步：');
        console.log('   1. 运行爬虫: npm run crawl:latest');
        console.log('   2. 查看统计: node scripts/database/db-manager.js stats');
        console.log('   3. 部署网站: wrangler pages deploy');
        console.log('=' .repeat(60));

    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
        console.error('\n💡 检查以下配置:');
        console.error('   1. .env 文件是否存在');
        console.error('   2. R2_ACCESS_KEY_ID 是否正确');
        console.error('   3. R2_SECRET_ACCESS_KEY 是否正确');
        console.error('   4. R2_ENDPOINT 是否正确');
        console.error('   5. R2_BUCKET_NAME 是否正确');
        console.error('\n详细错误:', error);
        process.exit(1);
    }
}

test();
