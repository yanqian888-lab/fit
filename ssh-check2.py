import os
import sys

log_file = '/Users/yanqian/Desktop/练习项目/fit/ssh-check.log'

# Step 1: Test basic file write
try:
    with open(log_file, 'w') as f:
        f.write('Step 1: File write test OK\n')
    sys.stdout.write('Step 1 OK\n')
    sys.stdout.flush()
except Exception as e:
    sys.stdout.write(f'Step 1 FAILED: {e}\n')
    sys.stdout.flush()
    sys.exit(1)

# Step 2: Run SSH command with output redirect
ret = os.system(f'ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@39.96.67.113 "echo SSH_OK && ls /var/www/" >> {log_file} 2>&1')

with open(log_file, 'a') as f:
    f.write(f'\nStep 2: SSH exit code = {ret}\n')

sys.stdout.write(f'Done. SSH exit code: {ret}\n')
sys.stdout.flush()