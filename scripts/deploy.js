/**
 * 部署脚本 - 将更新后的资料上传到服务器
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

// ============ 配置区域 ============
const DEPLOY_CONFIG = {
    // 部署方式: 'ftp' | 'sftp' | 'rsync' | 'git'
    method: 'git',
    
    // Git配置
    git: {
        branch: 'main',
        commitMessage: '自动更新资料'
    },
    
    // FTP配置（如果使用FTP）
    ftp: {
        host: 'your-ftp-host.com',
        user: 'username',
        password: 'password',
        remotePath: '/public_html'
    }
};

/**
 * Git部署
 */
async function deployViaGit() {
    console.log('[部署] 使用Git部署...');
    
    try {
        // 添加所有变更
        await execPromise('git add data/ assets/images/gallery/');
        console.log('  ✓ 已添加变更文件');
        
        // 提交
        const commitMsg = `${DEPLOY_CONFIG.git.commitMessage} - ${new Date().toLocaleString()}`;
        await execPromise(`git commit -m "${commitMsg}"`);
        console.log('  ✓ 已提交变更');
        
        // 推送
        await execPromise(`git push origin ${DEPLOY_CONFIG.git.branch}`);
        console.log('  ✓ 已推送到远程仓库');
        
        console.log('[部署] Git部署完成！');
        return true;
    } catch (error) {
        if (error.message.includes('nothing to commit')) {
            console.log('[部署] 没有需要提交的变更');
            return true;
        }
        console.error('[部署] 失败:', error.message);
        return false;
    }
}

/**
 * FTP部署（示例）
 */
async function deployViaFTP() {
    console.log('[部署] FTP部署功能待实现...');
    // TODO: 实现FTP上传逻辑
    return false;
}

/**
 * 主部署函数
 */
async function deploy() {
    console.log('\n========================================');
    console.log('   开始部署');
    console.log('========================================\n');
    
    let success = false;
    
    switch (DEPLOY_CONFIG.method) {
        case 'git':
            success = await deployViaGit();
            break;
        case 'ftp':
            success = await deployViaFTP();
            break;
        default:
            console.error(`不支持的部署方式: ${DEPLOY_CONFIG.method}`);
    }
    
    if (success) {
        console.log('\n[部署] ✓ 部署成功！');
    } else {
        console.log('\n[部署] ✗ 部署失败');
    }
    
    return success;
}

// 如果直接运行
if (require.main === module) {
    deploy()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { deploy };
