/**
 * 单次同步脚本 - 用于测试或手动触发
 */

const { syncMaterials } = require('./auto-sync');

console.log('开始单次同步...\n');

syncMaterials()
    .then(() => {
        console.log('\n同步完成，程序退出');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n同步失败:', error);
        process.exit(1);
    });
