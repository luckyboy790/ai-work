# 本地代码依赖

此交付包包含全部项目源码，但**没有预装 Three.js**。制作环境无法联网下载代码依赖，因此它不是首次解压即可离线使用的包。

在项目根目录执行：

```sh
npm ci
npm run vendor
```

`tools-vendor.mjs` 会验证已安装版本必须是 `0.180.0`，然后将以下文件复制到此目录：

- `three.module.js`
- `three.core.js`
- `THREE-LICENSE.txt`

之后运行网页不再请求 CDN。不要只复制 `three.module.js`：r180 同时需要它相邻的 `three.core.js`。代码依赖采用其上游许可证；程序化图像、几何和声音不依赖任何外部素材。
