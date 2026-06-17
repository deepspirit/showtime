// 完整测试脚本
import fs from 'fs';
import sharp from 'sharp';

async function runTest() {
  console.log('=== 完整测试图片拼接 API ===\n');
  
  // 创建测试目录
  if (!fs.existsSync('./test-images')) {
    fs.mkdirSync('./test-images');
  }
  
  // 创建测试图片
  console.log('1. 创建测试图片...');
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1'];
  for (let i = 1; i <= 3; i++) {
    const buffer = await sharp({
      create: {
        width: 200,
        height: 150,
        channels: 3,
        background: colors[i-1]
      }
    })
    .png()
    .toBuffer();
    
    fs.writeFileSync(`./test-images/test-${i}.png`, buffer);
    console.log(`   创建 test-${i}.png: 200x150px`);
  }
  
  console.log('\n2. 测试后端API (直接访问 3001 端口)...');
  const { spawn } = await import('child_process');
  
  const testDirect = spawn('curl', [
    '-s',
    '-X', 'POST',
    'http://localhost:3001/api/stitch',
    '-F', 'images=@./test-images/test-1.png',
    '-F', 'images=@./test-images/test-2.png',
    '-F', 'images=@./test-images/test-3.png'
  ]);
  
  testDirect.stdout.on('data', (data) => {
    const result = JSON.parse(data.toString());
    console.log('   响应:', result.success ? '成功' : '失败');
    if (result.success) {
      console.log('   输出尺寸:', result.stats.outputWidth + 'x' + result.stats.outputHeight);
    }
  });
  
  testDirect.on('close', async () => {
    console.log('\n3. 测试前端代理 (通过 5173 端口)...');
    
    const testProxy = spawn('curl', [
      '-v',
      '-X', 'POST',
      'http://localhost:5173/api/stitch',
      '-F', 'images=@./test-images/test-1.png',
      '-F', 'images=@./test-images/test-2.png',
      '-F', 'images=@./test-images/test-3.png'
    ]);
    
    testProxy.stdout.on('data', (data) => {
      try {
        const result = JSON.parse(data.toString());
        console.log('   响应:', result.success ? '成功' : '失败');
        if (result.success) {
          console.log('   输出尺寸:', result.stats.outputWidth + 'x' + result.stats.outputHeight);
        }
      } catch {
        console.log('   响应不是JSON:', data.toString().substring(0, 100));
      }
    });
    
    testProxy.stderr.on('data', (data) => {
      console.log('   错误/日志:', data.toString());
    });
    
    testProxy.on('close', () => {
      fs.rmSync('./test-images', { recursive: true });
      console.log('\n测试完成');
    });
  });
}

runTest().catch(console.error);