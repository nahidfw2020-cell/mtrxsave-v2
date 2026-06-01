module.exports = {
  apps: [{
    name: 'mtrxsave-backend',
    script: 'server.js',
    cwd: __dirname + '/..',
    instances: 'max',
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '700M',
    env: {
      NODE_ENV: 'production',
    },
    out_file: '/var/log/mtrxsave/out.log',
    error_file: '/var/log/mtrxsave/err.log',
    merge_logs: true,
    time: true,
  }],
};
