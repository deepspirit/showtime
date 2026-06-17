// 测试脚本 - 创建测试图片并验证API
import fs from 'fs';
import sharp from 'sharp';

async function runTest() {
  console.log('=== 开始测试图片拼接 API ===\n');
  
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
    console.log(`   创建 test-${i}.png: 200x150px, 颜色: ${colors[i-1]}`);
  }
  
  console.log('\n2. 测试拼接API...');
  const { spawn } = await import('child_process');
  const curl = spawn('curl', [
    '-s',
    '-X', 'POST',
    'http://localhost:3001/api/stitch',
    '-F', 'images=@./test-images/test-1.png',
    '-F', 'images=@./test-images/test-2.png',
    '-F', 'images=@./test-images/test-3.png'
  ]);
  
  curl.stdout.on('data', (data) => {
    const result = JSON.parse(data.toString());
    console.log('   响应:', result);
    if (result.success) {
      console.log('\n✅ API测试成功!');
      console.log('   输出文件:', result.filename);
      console.log('   下载路径:', result.path);
      console.log('   统计信息:', JSON.stringify(result.stats));
    } else {
      console.log('\n❌ API测试失败:', result.error);
    }
  });
  
  curl.stderr.on('data', (data) => {
    console.log('   错误:', data.toString());
  });
  
  curl.on('close', (code) => {
    // 清理测试文件
    fs.rmSync('./test-images', { recursive: true });
    console.log('\n测试完成');
  });
}

runTest().catch(console.error);