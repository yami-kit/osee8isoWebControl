"""
OSEE ESP8266 一键编译烧录脚本

使用前请确保已安装以下环境:
  1. Python 3.7+ + esptool + pyserial
     pip install esptool pyserial
  2. Arduino CLI + ESP8266 开发板支持 (仅编译时需要)
     arduino-cli core install esp8266:esp8266
  3. WebSockets Arduino 库 (仅编译时需要)
     arduino-cli lib install WebSockets
  4. mklittlefs (随 ESP8266 Arduino 开发板自动安装)

脚本会自动检测以下工具路径 (无需手动配置):
  - arduino-cli: PATH 环境变量 → LOCALAPPDATA/Arduino/arduino-cli.exe
  - mklittlefs:  LOCALAPPDATA/Arduino15/packages/esp8266/tools/mklittlefs/
  - 串口:        自动扫描 CH340/CP210 等常见 USB-Serial 芯片

如果自动检测失败, 可通过以下方式手动指定:
  - 串口: python flash.py COM5        (命令行参数)
  - arduino-cli / mklittlefs: 添加到 PATH 环境变量

Flash 布局: 4M1M (4MB 总容量, 1MB LittleFS 文件系统)
  - 固件烧录地址: 0x0
  - 文件系统烧录地址: 0x300000
  - 文件系统大小: 1024000 bytes (1MB)
"""

import sys
import os
import serial
import esptool
import subprocess
import shutil
import platform

original_reconfigure = serial.Serial._reconfigure_port

def patched_reconfigure(self, *args, **kwargs):
    try:
        original_reconfigure(self, *args, **kwargs)
    except Exception:
        pass

serial.Serial._reconfigure_port = patched_reconfigure

SKETCH_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SKETCH_DIR, 'data')
LITTLEFS_BIN = os.path.join(SKETCH_DIR, 'littlefs.bin')
FS_ADDR = '0x300000'
FS_SIZE = 1024000

def find_port():
    if len(sys.argv) > 1:
        return sys.argv[1]
    from serial.tools import list_ports
    ports = list(list_ports.comports())
    for p in ports:
        desc = p.description or ''
        if 'CH340' in desc or 'CP210' in desc or 'USB2.0-Serial' in desc or 'USB Serial' in desc:
            return p.device
    if ports:
        print(f"[WARN] 未识别到常见USB-Serial芯片, 使用第一个串口: {ports[0].device}")
        print(f"       如需指定串口, 请运行: python flash.py COMx")
        return ports[0].device
    print("[ERROR] 未找到任何串口设备, 请检查ESP8266是否已连接")
    print("        也可手动指定: python flash.py COM3")
    sys.exit(1)

def find_arduino_cli():
    path = shutil.which('arduino-cli')
    if path:
        return path
    if platform.system() == 'Windows':
        local = os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Arduino', 'arduino-cli.exe')
        if os.path.exists(local):
            return local
        home = os.path.join(os.path.expanduser('~'), 'Documents', 'Arduino', 'arduino-cli.exe')
        if os.path.exists(home):
            return home
    print("[ERROR] 找不到 arduino-cli, 请安装后添加到 PATH 环境变量")
    print("        安装方法: https://arduino.github.io/arduino-cli/latest/installation/")
    sys.exit(1)

def find_mklittlefs():
    if platform.system() == 'Windows':
        base = os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Arduino15', 'packages', 'esp8266', 'tools', 'mklittlefs')
        if os.path.exists(base):
            versions = sorted(os.listdir(base), reverse=True)
            for v in versions:
                exe = os.path.join(base, v, 'mklittlefs.exe')
                if os.path.exists(exe):
                    return exe
    path = shutil.which('mklittlefs')
    if path:
        return path
    print("[ERROR] 找不到 mklittlefs, 请先安装 ESP8266 Arduino 开发板支持:")
    print("        arduino-cli core install esp8266:esp8266")
    sys.exit(1)

def find_firmware():
    if platform.system() == 'Windows':
        search_dir = os.path.join(os.environ.get('LOCALAPPDATA', ''), 'arduino', 'sketches')
        if not os.path.exists(search_dir):
            search_dir = os.path.join(os.environ.get('USERPROFILE', ''), 'AppData', 'Local', 'arduino', 'sketches')
    else:
        search_dir = '/tmp/arduino-sketches'
        if not os.path.exists(search_dir):
            search_dir = os.path.join(os.path.expanduser('~'), '.arduino', 'sketches')

    if not os.path.exists(search_dir):
        return None

    newest_bin = None
    newest_time = 0

    for root, dirs, files in os.walk(search_dir):
        for f in files:
            if f == 'esp8266.ino.bin':
                full_path = os.path.join(root, f)
                mtime = os.path.getmtime(full_path)
                if mtime > newest_time:
                    newest_time = mtime
                    newest_bin = full_path

    return newest_bin

def compile_firmware():
    arduino_cli = find_arduino_cli()
    print(f"[1/5] 编译固件 (arduino-cli: {arduino_cli})...")
    result = subprocess.run(
        [arduino_cli, 'compile', '--fqbn', 'esp8266:esp8266:nodemcuv2:eesz=4M1M', SKETCH_DIR],
        capture_output=True, text=True, encoding='utf-8', errors='replace'
    )

    if result.returncode != 0:
        print("编译失败!")
        print(result.stdout)
        print(result.stderr)
        sys.exit(1)

    print("编译成功!")

def build_filesystem():
    mklittlefs = find_mklittlefs()
    print(f"[2/5] 构建LittleFS文件系统 (mklittlefs: {mklittlefs})...")
    if not os.path.exists(DATA_DIR):
        print("data目录不存在!")
        sys.exit(1)

    result = subprocess.run(
        [mklittlefs, '-c', DATA_DIR, '-p', '256', '-b', '8192', '-s', str(FS_SIZE), LITTLEFS_BIN],
        capture_output=True, text=True, encoding='utf-8', errors='replace'
    )

    if result.returncode != 0:
        print("构建文件系统失败!")
        print(result.stderr)
        sys.exit(1)

    print("文件系统构建成功!")

def flash_firmware(port, baud):
    firmware = find_firmware()
    if not firmware:
        print("找不到编译后的固件文件!")
        sys.exit(1)

    print(f"[3/5] 找到固件: {firmware}")
    print(f"[4/5] 烧录固件到 {port} ...")

    sys.argv = ['esptool.py', '--chip', 'esp8266', '--port', port, '--baud', str(baud),
                'write_flash', '0x0', firmware]

    try:
        esptool.main()
    except SystemExit as e:
        if e.code != 0 and e.code is not None:
            print(f"烧录失败, 退出码: {e.code}")
            sys.exit(e.code)

    print("固件烧录成功!")

def flash_filesystem(port, baud):
    if not os.path.exists(LITTLEFS_BIN):
        print("LittleFS镜像不存在!")
        sys.exit(1)

    print(f"[5/5] 烧录文件系统到 {port} @ {FS_ADDR} ...")

    sys.argv = ['esptool.py', '--chip', 'esp8266', '--port', port, '--baud', str(baud),
                'write_flash', FS_ADDR, LITTLEFS_BIN]

    try:
        esptool.main()
    except SystemExit as e:
        if e.code != 0 and e.code is not None:
            print(f"文件系统烧录失败, 退出码: {e.code}")
            sys.exit(e.code)

    print("文件系统烧录成功!")

if __name__ == '__main__':
    port = find_port()
    baud = 115200
    print(f"使用串口: {port}")
    print(f"固件目录: {SKETCH_DIR}")
    compile_firmware()
    build_filesystem()
    flash_firmware(port, baud)
    flash_filesystem(port, baud)
    print("\n全部完成! ESP8266已准备就绪。")
    print("1. 手机连接WiFi: OSEE-Ctrl (密码: 12345678)")
    print("2. 浏览器访问: http://192.168.4.1")
    print("3. 配置路由器WiFi后，访问ESP8266在路由器的IP即可使用")
