module.exports = {
  apps: [
    {
      name: "cacarejar",
      script: "dist/index.js",
      cwd: "/var/www/cacarejar",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3020,
      },
      env_file: "/var/www/cacarejar/.env",
      out_file: "/var/log/pm2/cacarejar-out.log",
      error_file: "/var/log/pm2/cacarejar-err.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
