const net = require('net');

const tests = [
  {
    name: 'PostgreSQL (Neon)',
    host: 'ep-flat-haze-aijugpbg-pooler.c-4.us-east-1.aws.neon.tech',
    port: 5432
  },
  {
    name: 'Redis #1',
    host: 'redis-18158.c14.us-east-1-2.ec2.cloud.redislabs.com',
    port: 18158
  },
  {
    name: 'Redis #2 (Session)',
    host: 'redis-13102.c17.us-east-1-4.ec2.cloud.redislabs.com',
    port: 13102
  }
];

async function testConnection(test, timeout = 10000) {
  return new Promise((resolve) => {
    console.log(`\nTesting: ${test.name}`);
    console.log(`Host: ${test.host}:${test.port}`);
    
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      console.log(`✗ FAILED - Connection timeout (${timeout}ms)`);
      resolve(false);
    }, timeout);

    socket.on('connect', () => {
      clearTimeout(timer);
      console.log(`✓ SUCCESS - Connection established!`);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      console.log(`✗ FAILED - ${err.message}`);
      resolve(false);
    });

    socket.connect(test.port, test.host);
  });
}

async function runTests() {
  console.log('========================================');
  console.log('Testing Database and Redis Connections');
  console.log('========================================');
  
  const results = [];
  
  for (const test of tests) {
    const success = await testConnection(test);
    results.push({ name: test.name, success });
  }
  
  console.log('\n========================================');
  console.log('Summary');
  console.log('========================================');
  
  results.forEach(r => {
    const status = r.success ? '✓' : '✗';
    console.log(`${status} ${r.name}`);
  });
  
  const allSuccess = results.every(r => r.success);
  console.log('\n========================================');
  console.log(allSuccess ? 'All connections successful!' : 'Some connections failed!');
  console.log('========================================');
  
  process.exit(allSuccess ? 0 : 1);
}

runTests().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
