/**
 * PM2 Ecosystem Configuration
 * 
 * This file configures PM2 to run both the backend API server and Next.js frontend.
 * 
 * Usage:
 *   pm2 start ecosystem.config.js        # Start both services
 *   pm2 stop ecosystem.config.js        # Stop both services
 *   pm2 restart ecosystem.config.js      # Restart both services
 *   pm2 logs                            # View logs from both services
 *   pm2 status                          # Check status of both services
 *   pm2 save                            # Save current process list
 *   pm2 startup                         # Setup PM2 to start on system boot
 */

module.exports = {
  apps: [
    {
      name: 'reseller-backend',
      script: 'node',
      args: 'dist/index.js',
      cwd: process.cwd(),
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000
    },
    {
      name: 'reseller-frontend',
      script: 'npm',
      args: 'run start:next',
      cwd: process.cwd(),
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000
    }
  ]
};

