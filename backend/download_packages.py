import subprocess
import os

def download_packages():
    # 创建packages目录
    if not os.path.exists('packages'):
        os.makedirs('packages')
    
    # 从requirements.txt读取依赖
    with open('requirements.txt', 'r') as f:
        packages = f.read().splitlines()
    
    # 下载每个包
    for package in packages:
        cmd = f'pip download {package} -d packages'
        subprocess.run(cmd, shell=True)

if __name__ == '__main__':
    download_packages() 