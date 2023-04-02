# pixiv-previewer

**inspired by [VoiceLinks](https://greasyfork.org/scripts/456743)**



## Intro

油猴脚本。

扫描页面，捕获形如 `pid:99276527` 的 Text，将其高亮，且：

- mouseover：预览
- mouseout：隐藏预览
- click：跳转到对应 pixiv 页面
- double click：下载图片

> 实际的捕获规则更宽松一些：正则`RegExp("pid[^0-9]?([0-9]{6,9})", "gi")`



![pixiv-previewer](pixiv-previewer.gif)

（上图的关键字捕获规则是旧版的，图片懒得改了）



## NOTE

- 脚本仅为个人方便使用，请不要把此工具用作爬虫。
- 部分网站限制比较严格（如 github.com），会触发 securitypolicyviolation，此时预览功能失效。但是可正常跳转和下载。



## License

MIT

