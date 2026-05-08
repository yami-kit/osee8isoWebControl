# OSEE GoStream Duet 8 ISO Web 控制台

OSEE GoStream Duet 8 ISO 导播台的三端 Web 控制系统，支持 PC 浏览器、Android 手机、ESP8266 三种方式控制导播台。

> ⚠️ **兼容性说明**: 本项目目前仅适配 **OSEE GoStream Duet 8 ISO** 导播台，导播台固件版本：GoStream Duet 8 ISO Firmware v2.1.0，其他 OSEE 型号未测试，协议可能存在差异，不保证兼容。

## 功能特性

- **通道切换**: PGM/PVW 1-8路输入 + MP1/MP2/M-SRC
- **转场控制**: CUT 硬切
- **录制控制**: REC / ISO REC / STOP
- **推流控制**: 3组独立推流 (URL/Key/Enable/GO LIVE)
- **状态联动**: 设备状态实时反馈到界面
- **断线重连**: 自动重连机制

## 三端架构

```
┌─────────────┐   ┌──────────────┐   ┌──────────────┐
│  PC 浏览器   │   │  Android App │   │  手机/平板    │
│  (WebSocket) │   │  (TCP直连)    │   │  (WebSocket) │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                  │
       ▼                  │                  ▼
┌──────────────┐          │          ┌──────────────┐
│  Node.js     │          │          │   ESP8266    │
│  服务器      │          │          │   WiFi控制器 │
└──────┬───────┘          │          └──────┬───────┘
       │                  │                  │
       └──────────┬───────┴──────────────────┘
                  ▼
         ┌──────────────┐
         │  OSEE 导播台  │
         │  TCP :19010  │
         └──────────────┘
```

| 端               | 通信方式                                 | 适用场景              |
| --------------- | ------------------------------------ | ----------------- |
| **服务器端**        | 浏览器 → WebSocket → Node.js → TCP → 设备 | PC 使用，功能最全        |
| **Android App** | App 内 TCP 插件直连设备                     | 手机使用，无需中间服务器      |
| **ESP8266**     | 浏览器 → WebSocket → ESP8266 → TCP → 设备 | 便携式，ESP8266 直连路由器 |

## 项目结构

```
├── server/                  # Node.js 服务器端源码
│   ├── server.js            # Express + WebSocket 主服务
│   ├── connection.js        # TCP 连接管理器
│   ├── config.js            # 设备/命令/通道配置
│   ├── protocol.js          # OSEE 协议引擎
│   ├── package.json         # 依赖
│   └── public/              # Web 前端
│       ├── index.html
│       ├── app.js
│       └── style.css
│
├── android/                 # Android App 源码 (Capacitor)
│   ├── capacitor.config.json
│   ├── package.json
│   ├── app/
│   │   ├── build.gradle
│   │   └── src/main/
│   │       ├── AndroidManifest.xml
│   │       ├── java/com/osee/switcher/MainActivity.java
│   │       └── res/
│   └── www/                 # App 前端 (内嵌Protocol引擎)
│       ├── index.html
│       ├── app.js
│       └── style.css
│
├── esp8266/                 # ESP8266 嵌入式固件源码
│   ├── esp8266.ino          # Arduino 主程序
│   ├── config.h/cpp         # 配置和命令定义
│   ├── protocol.h/cpp       # CRC-16/MODBUS 协议引擎
│   ├── tcp_client.h/cpp     # TCP 客户端
│   ├── wifi_manager.h/cpp   # WiFi AP 配网管理
│   ├── web_server.h/cpp     # HTTP + WebSocket 服务
│   ├── flash.py             # 一键编译烧录脚本
│   └── data/                # LittleFS 前端文件
│       ├── index.html
│       ├── app.js
│       └── style.css
│
├── hex_commands_reference.md # OSEE 协议 Hex 命令参考
│
└── release/                 # 预编译发布文件
    ├── osee-switcher-server.zip  # 服务器端 (解压后 npm install 即可运行)
    ├── esp8266-firmware.zip      # ESP8266 固件 (含固件bin + 文件系统bin)
    └── osee-switcher-release.apk        # Android APK (直接安装)
```

***

## 快速开始

### 1. 服务器端 (Node.js)

#### 环境要求

- **Node.js** 16+ (推荐 18+ LTS)
- npm (随 Node.js 一起安装)

> 💡 如果你还没有安装 Node.js，请前往 <https://nodejs.org> 下载安装 LTS 版本。

#### 安装与运行

1. 从 [Release](../../releases) 下载 `osee-switcher-server.zip`
2. 解压到任意目录
3. 打开终端（命令行），进入解压目录：

```bash
npm install
node server.js
```

1. 浏览器访问 `http://localhost:3000`
2. 在页面中输入导播台 IP 地址，点击连接即可控制

#### 从源码运行

```bash
cd server
npm install
node server.js
```

***

### 2. Android App

#### 方式一：直接安装 APK（推荐）

从 [Release](../../releases) 下载 `osee-switcher-release.apk`，安装到 Android 手机即可使用。

打开 App 后输入导播台 IP 地址，App 通过 Capacitor TCP 插件直接连接设备，无需中间服务器。

#### 方式二：从源码编译

##### 环境要求

| 工具              | 版本            | 说明                                                                                           |
| --------------- | ------------- | -------------------------------------------------------------------------------------------- |
| **Node.js**     | 16+           | [下载](https://nodejs.org)                                                                     |
| **JDK**         | 17            | [下载](https://adoptium.net/)，注意必须是 JDK 17，其他版本可能不兼容                                           |
| **Android SDK** | compileSdk 34 | 通过 Android Studio 安装，或单独下载 [Android SDK](https://developer.android.com/studio#command-tools) |
| **Gradle**      | 8.x           | 项目自带 gradlew 脚本，无需单独安装                                                                       |

> 💡 推荐安装 [Android Studio](https://developer.android.com/studio)，它会自动配置 JDK 和 Android SDK。

##### 环境变量配置

编译前请确保以下环境变量已正确设置：

```bash
# ANDROID_HOME: Android SDK 路径
# Windows 示例:
set ANDROID_HOME=C:\Users\你的用户名\AppData\Local\Android\Sdk

# JAVA_HOME: JDK 17 路径
# Windows 示例:
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.x-hotspot
```

##### 编译步骤

```bash
# 1. 进入 android 目录
cd android

# 2. 安装 Node.js 依赖
npm install

# 3. 同步 Capacitor 资源 (将 www/ 复制到 Android 项目)
npx cap sync android

# 4. 编译 Release APK
cd android
./gradlew assembleRelease
```

编译完成后 APK 位于 `android/app/build/outputs/apk/release/app-release.apk`

> ⚠️ 从源码编译需要自行生成签名密钥 (keystore)，并修改 `app/build.gradle` 中的签名配置。
> 生成密钥: `keytool -genkey -v -keystore osee-release.keystore -alias osee -keyalg RSA -keysize 2048 -validity 10000`

***

### 3. ESP8266

#### 为什么有两个 bin 文件？

ESP8266 使用 **4M1M Flash 布局**，即总共 4MB Flash 中，1MB 分配给 LittleFS 文件系统：

| bin 文件                 | 烧录地址       | 大小      | 说明                        |
| ---------------------- | ---------- | ------- | ------------------------- |
| `esp8266-firmware.bin` | `0x0`      | \~390KB | 固件主程序（Arduino 编译输出）       |
| `littlefs.bin`         | `0x300000` | \~1MB   | LittleFS 文件系统镜像（Web 前端文件） |

**4M1M 布局说明**：

```
0x000000 ─────────┐
                  │ 固件程序区 (~384KB)
0x060000 ─────────┤
                  │ 保留 / EEPROM / SPIFFS
0x300000 ─────────┤
                  │ LittleFS 文件系统 (1MB)
                  │ 存储 index.html, app.js, style.css
0x3FB000 ─────────┤
                  │ Flash 最后 5KB (系统保留)
0x400000 ─────────┘
```

- **4M** = 4MB 总 Flash 大小
- **1M** = 1MB 分配给文件系统
- LittleFS 存储了 Web 控制界面的 HTML/JS/CSS 文件
- 如果只烧录固件不烧录文件系统，访问网页会显示 "FS not found"

#### 方式一：使用预编译固件烧录（推荐）

> 💡 此方式**不需要**安装 Arduino CLI 或 mklittlefs，只需要 Python + esptool 即可烧录预编译好的固件。

##### 环境要求

| 工具              | 版本        | 说明                                      |
| --------------- | --------- | --------------------------------------- |
| **Python**      | 3.7+      | [下载](https://www.python.org/downloads/) |
| **esptool**     | 4.x       | `pip install esptool`                   |
| **pyserial**    | 3.x       | `pip install pyserial`                  |
| **ESP8266 开发板** | 4MB Flash | NodeMCU v2/v3 或类似开发板                    |
| **USB 数据线**     | -         | 需支持数据传输（非纯充电线）                          |

```bash
pip install esptool pyserial
```

##### 查看串口

烧录前需要确认 ESP8266 的串口号：

```bash
# Windows: 在设备管理器中查看 "端口(COM和LPT)" 下的串口号
# Linux/Mac:
ls /dev/ttyUSB* /dev/tty.SLAB_USBtoUART*
```

##### 烧录步骤

1. 从 [Release](../../releases) 下载 `esp8266-firmware.zip` 并解压，得到两个文件：
   - `esp8266-firmware.bin` — 固件主程序
   - `littlefs.bin` — LittleFS 文件系统镜像
2. 将 ESP8266 通过 USB 连接电脑
3. 执行以下命令（将 `COM3` 替换为你的实际串口）：

```bash
# 擦除 Flash（首次烧录建议执行）
esptool.py --chip esp8266 --port COM3 --baud 115200 erase_flash

# 烧录固件（地址 0x0）
esptool.py --chip esp8266 --port COM3 --baud 115200 write_flash 0x0 esp8266-firmware.bin

# 烧录文件系统（地址 0x300000，必须烧录，否则网页无法访问）
esptool.py --chip esp8266 --port COM3 --baud 115200 write_flash 0x300000 littlefs.bin
```

> 💡 **串口说明**: Windows 为 `COM3`、`COM4` 等；Linux 为 `/dev/ttyUSB0`；Mac 为 `/dev/tty.SLAB_USBtoUART` 或 `/dev/tty.usbserial-xxx`。Linux/Mac 可能需要 `sudo` 权限。
>
> ⚠️ **两个 bin 文件都必须烧录**，缺一不可。只烧录固件不烧录文件系统，访问网页会显示 "FS not found"。

#### 方式二：使用 flash.py 一键编译烧录

> 💡 此方式会从源码编译固件并自动烧录，需要完整的编译环境。

##### 环境要求

| 工具               | 版本     | 说明                                                                 |
| ---------------- | ------ | ------------------------------------------------------------------ |
| **Python**       | 3.7+   | [下载](https://www.python.org/downloads/)                            |
| **esptool**      | 4.x    | `pip install esptool`                                              |
| **pyserial**     | 3.x    | `pip install pyserial`                                             |
| **Arduino CLI**  | 0.35+  | [安装文档](https://arduino.github.io/arduino-cli/latest/installation/) |
| **ESP8266 Core** | 3.1.2+ | `arduino-cli core install esp8266:esp8266`                         |
| **WebSockets**   | 2.7.x  | `arduino-cli lib install WebSockets`                               |
| **mklittlefs**   | -      | 随 ESP8266 Core 自动安装                                                |

```bash
# 1. 安装 Python 依赖
pip install esptool pyserial

# 2. 安装 Arduino CLI
# Windows: 从 https://arduino.github.io/arduino-cli/latest/installation/ 下载
# Mac:     brew install arduino-cli
# Linux:   curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh

# 3. 安装 ESP8266 开发板支持
arduino-cli core install esp8266:esp8266

# 4. 安装 WebSockets 库
arduino-cli lib install WebSockets
```

> ⚠️ flash.py 会自动检测 arduino-cli、mklittlefs 和串口。如果检测失败，请将 arduino-cli 添加到 PATH 环境变量，或通过命令行参数指定串口。

##### 一键烧录

```bash
cd esp8266
python flash.py              # 自动检测串口
python flash.py COM5         # 指定串口 (Windows)
python flash.py /dev/ttyUSB0 # 指定串口 (Linux)
```

flash.py 会自动完成：编译固件 → 构建 LittleFS → 烧录固件 → 烧录文件系统

#### 方式三：Arduino IDE 编译烧录

> 💡 此方式适合不熟悉命令行的用户，通过 Arduino IDE 图形界面操作。

##### 环境要求

| 工具                  | 版本         | 说明                                                                     |
| ------------------- | ---------- | ---------------------------------------------------------------------- |
| **Arduino IDE**     | 1.8+ 或 2.x | [下载](https://www.arduino.cc/en/software)                               |
| **ESP8266 Core**    | 3.1.2+     | 通过开发板管理器安装                                                             |
| **WebSockets**      | 2.7.x      | 通过库管理器安装 (by Markus Sattler)                                           |
| **LittleFS Plugin** | -          | [下载](https://github.com/earlephilhower/arduino-esp8266littlefs-plugin) |

##### 步骤

1. 打开 Arduino IDE，进入 **文件 → 首选项**，在"附加开发板管理器网址"中添加：
   ```
   http://arduino.esp8266.com/stable/package_esp8266com_index.json
   ```
2. 进入 **工具 → 开发板 → 开发板管理器**，搜索 `esp8266` 并安装
3. 进入 **工具 → 管理库**，搜索 `WebSockets` 并安装 (by Markus Sattler)
4. 打开 `esp8266/esp8266.ino`
5. 配置开发板参数：
   - **开发板**: NodeMCU 1.0 (ESP-12E Module)
   - **Flash Size**: **4MB (FS:1MB OTA:\~1019KB)** ← 必须选择 4M1M
   - **上传速度**: 115200
   - **端口**: 选择对应的 COM 端口
6. 点击 **上传** 按钮编译并烧录固件
7. 烧录 LittleFS 文件系统：
   - 安装 [Arduino LittleFS Upload Tool](https://github.com/earlephilhower/arduino-esp8266littlefs-plugin)
   - 在 Arduino IDE 中选择 **工具 → ESP8266 LittleFS Data Upload**

> ⚠️ **必须选择 4M1M 布局**，否则文件系统无法正常工作。Flash Size 选项中选 "4MB (FS:1MB OTA:\~1019KB)"。

#### ESP8266 使用流程

1. ESP8266 上电后创建 WiFi 热点: `OSEE-Ctrl` (密码: `12345678`)
2. 手机连接 `OSEE-Ctrl`，浏览器访问 `http://192.168.4.1`
3. 在配网页面选择路由器 WiFi 并输入密码
4. 连接成功后页面显示设备 IP，8秒后自动切换模式
5. 手机连回路由器 WiFi，访问 ESP8266 的 IP 地址
6. 输入导播台 IP，点击连接即可控制

#### 串口命令 (115200 baud)

| 命令             | 说明          |
| -------------- | ----------- |
| `WIFI:SSID:密码` | 配置 WiFi 并重启 |
| `RESET`        | 重置 WiFi 配置  |
| `INFO`         | 查看当前状态      |

#### WiFi 断开自动配网

- 启动时 WiFi 连接失败 → 自动进入 AP 配网模式
- 运行时 WiFi 断开超过 30 秒 → 自动进入 AP 配网模式

***

## OSEE 通信协议

详细的协议参考文档请查看 [hex\_commands\_reference.md](hex_commands_reference.md)。

导播台使用 TCP 协议，端口 **19010**。

### 帧结构

```
[EB A6] [LEN_HI:LEN_LO] [00] [JSON] [0A] [CRC_LO:CRC_HI]
```

| 字段        | 长度 | 说明                     |
| --------- | -- | ---------------------- |
| Magic     | 2  | 固定 `EB A6`             |
| Length    | 2  | 大端序 = JSON字节数(含0a) + 2 |
| Separator | 1  | `00`                   |
| JSON      | N  | UTF-8 编码命令             |
| LF        | 1  | `0A`                   |
| CRC       | 2  | CRC-16/MODBUS, 低字节在前   |

### 连接流程

1. TCP 连接设备:19010
2. 发送 `0x00` 初始化
3. 发送 `pcTimeSecs set` 时间同步
4. 发送握手查询 (version/deviceId/deviceName 等)
5. 启动 500ms 心跳 (`audioMeter get`)

***

## 技术栈

| 端       | 技术                                          |
| ------- | ------------------------------------------- |
| 服务器     | Node.js, Express, ws (WebSocket)            |
| Android | Capacitor, capacitor-tcp-socket             |
| ESP8266 | Arduino ESP8266, LittleFS, WebSocketsServer |
| 前端      | 原生 HTML/CSS/JS, WebSocket                   |

## 硬件要求

- OSEE GoStream Duet 8 ISO 导播台（固件版本：GoStream Duet 8 ISO Firmware v2.1.0）
- ESP8266 NodeMCU (4MB Flash) - 仅 ESP8266 端需要
- 所有设备需在同一局域网

***

## 免责声明

**本项目仅供学习和测试使用。**

本项目的控制对象为专业导播台设备，在生产环境中使用涉及音视频信号切换、录制、推流等关键操作。由于本项目为非官方实现，可能存在以下风险：

- 切换操作可能导致画面中断或黑场
- 录制控制可能导致录制文件损坏或丢失
- 推流操作可能导致直播中断
- 网络延迟或断连可能导致操作不可达
- 协议实现可能与设备固件存在兼容性问题

**在任何生产环境（包括但不限于直播活动、节目录制、商业活动等）中使用本项目所产生的一切事故、损失和责任，均由使用者自行承担，作者不承担任何责任。**

请确保在正式使用前进行充分的测试，并始终准备官方控制方式作为备用方案。
