import subprocess
import os
import sys

log_file = '/Users/yanqian/Desktop/练习项目/fit/ssh-check.log'

env = os.environ.copy()
for key in list(env.keys()):
    if key.startswith('SAFE_RM_'):
        del env[key]

try:
    result = subprocess.run(
        ['ssh', '-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=10',
         'root@39.96.67.113', 'echo SSH_OK && ls /var/www/ && cat /etc/nginx/sites-enabled/* 2>/dev/null | head -50'],
        env=env,
        capture_output=True,
        text=True,
        timeout=30
    )
    output = f"Exit code: {result.returncode}\n\nSTDOUT:\n{result.stdout}\n\nSTDERR:\n{result.stderr}"
    with open(log_file, 'w') as f:
        f.write(output)
    print(f"Done. Exit code: {result.returncode}")
except Exception as e:
    with open(log_file, 'w') as f:
        f.write(f"Error: {str(e)}")
    print(f"Error: {str(e)}")