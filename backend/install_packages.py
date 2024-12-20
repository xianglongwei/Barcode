import subprocess
import os

def install_packages():
    # 安装下载的包
    cmd = 'pip install --no-index --find-links packages -r requirements.txt'
    subprocess.run(cmd, shell=True)

if __name__ == '__main__':
    install_packages() 