import https from 'https';

function check(urlPath, label) {
  return new Promise((resolve) => {
    https.get('https://shoreline-api-production.up.railway.app' + urlPath, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          path: urlPath,
          label,
          status: res.statusCode,
          hasMarketingContent: data.includes('Two Ways to Use Shoreline'),
          hasStaffLogin: data.includes('/app/login'),
          hasAppRoot: data.includes('<div id="root"></div>'),
          preview: data.slice(0, 150).replace(/\n/g, ' ')
        });
      });
    }).on('error', err => resolve({ path: urlPath, label, error: err.message }));
  });
}

async function run() {
  console.log('Testing Railway Unified Deployment...');
  const paths = [
    { path: '/', label: 'Marketing Root' },
    { path: '/pricing', label: 'Pricing Page' },
    { path: '/demo/', label: 'Public Demo Sandbox' },
    { path: '/app/', label: 'Gatekept SaaS Platform' },
    { path: '/api/health', label: 'REST API Health' },
    { path: '/api/ready', label: 'Database Health' }
  ];

  for (const item of paths) {
    const res = await check(item.path, item.label);
    console.log(JSON.stringify(res, null, 2));
  }
}

run();
