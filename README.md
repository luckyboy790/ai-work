[README.md](https://github.com/user-attachments/files/32562498/README.md)
# Three-Body Interactive Web · 三体与诗词交互网页作品集

探索三体宇宙、星际漫游与中国古典诗词的 **7 个浏览器交互作品**。包含交互叙事、三维场景和文明模拟，使用 HTML、CSS、JavaScript 与 Three.js 构建。

Seven browser-based interactive experiences inspired by the Three-Body universe, space exploration, and classical Chinese poetry. Includes interactive storytelling, 3D scenes, and a civilization simulation.

## 在线体验 · Live demos

| 作品 | 在线体验 | 源码目录 |
| --- | --- | --- |
| 三体·宇宙记忆 | [打开网页](https://threebody.aihome.cyou/) | [universe-memory](./universe-memory/) |
| 末日战役 · 一键清屏录制版 | [打开网页](https://threebody.aihome.cyou/doomsday/) | [doomsday](./doomsday/) |
| 三体·文明回声 | [打开网页](https://threebody.aihome.cyou/echo/) | [echo](./echo/) |
| 诗境·六首诗词 | [打开网页](https://www.aihome.cyou/poetry/) | [poetry](./poetry/) |
| 太平洋一号·永夜浮城 | [打开网页](https://threebody.aihome.cyou/pacific/) | [pacific](./pacific/) |
| 三体·无声证词 v1.1 | [打开网页](https://threebody.aihome.cyou/silent-testimony/) | [silent-testimony](./silent-testimony/) |
| 星间漫游 | [打开网页](https://www.aihome.cyou/star-roaming/) | [star-roaming](./star-roaming/) |

## 项目结构

每个作品使用独立目录，入口均为 `index.html`。六个作品以单 HTML 文件交付；《文明回声》包含独立脚本、样式和本地 Three.js 依赖。

## 本地运行 · Run locally

安装 Python 3 后，在仓库根目录执行：

```sh
python -m http.server 8000
```

打开 `http://localhost:8000/`，选择作品目录，例如 `http://localhost:8000/echo/`。

推荐通过本地 HTTP 服务预览，避免直接打开文件时的浏览器模块加载限制。《文明回声》需要支持 **WebGL 2** 的浏览器；渲染速度取决于设备性能。

### 文明回声开发与测试

发布文件已包含 Three.js 0.180.0，无需安装依赖即可通过上述 HTTP 服务预览。重新准备依赖或运行逻辑测试时，使用 Node.js 18 或以上版本：

```sh
cd echo
npm ci
npm run vendor
npm test
npm start
```

开发服务默认地址为 `http://localhost:4173/`。模拟规则与验证范围见 [模型说明](./echo/docs/MODEL.md) 和 [验证说明](./echo/docs/VALIDATION.md)。

## 部署

使用 Nginx 等静态网站服务即可托管。保留各作品目录结构，尤其是 `echo/src/` 和 `echo/vendor/`，并确保 JavaScript 文件以正确的 MIME 类型返回。

本仓库收录网页源码及运行资源，不包含现有服务器的登录凭据或运维配置。上表链接指向独立部署的网站；向 GitHub 提交代码不会自动更新这些网站。

## 许可与第三方依赖

《文明回声》的许可范围见 [echo/LICENSE](./echo/LICENSE)，Three.js 许可见 [THREE-LICENSE.txt](./echo/vendor/THREE-LICENSE.txt)。其他作品未统一声明开源许可，请勿将上述许可自动套用于整个仓库。涉及的文学作品名称与相关权利归各自权利人所有。
