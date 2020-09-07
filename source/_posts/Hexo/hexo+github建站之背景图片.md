---
title: hexo+github建站之背景图片
date: 2019-08-25 14:28:37
categories: Hexo
tags:
  - 背景图片
---

## 互联网图片
<!--more-->
修改`themes/next/source/css/_custom/custom.styl`为以下格式

```json
// Custom styles.

body {
    background:url(https://source.unsplash.com/random/1600x900);
    background-repeat: no-repeat;
    background-attachment:fixed;
    background-position:50% 50%;
    background-size: cover;
}
```

- background:url：每次图片加载时的地址。

- background-repeat：若果背景图片不能全屏，那么是否平铺显示，充满屏幕。
- background-attachment：背景是否随着网页上下滚动而滚动，fixed为固定。
- background-size：图片展示大小。

这里调用了 [Unsplash](https://unsplash.com/) 的 API, 随机选用该网站的高清美图作为博客背景. 该网站所有图片都是免费商用的, 所以无须担心侵权问题;网站 API 还有很多有趣的玩法, 参见: [Documentation](https://source.unsplash.com/)。



添加完成之后，有点小瑕疵，博客主体不透明，无法完全看到背景。在`custom.styl`文件中再加入一段即可

```json
.main-inner {
     background: #fff;
     opacity: 0.9;
}
```

- `opacity` 指定了对应元素的透明度, 这里是 “0.8”, 可以按需更改。

## 本地图片

博客每次加载互联网图片，可能会影响博客加载速度，可以将加载互联网图片改为加载本地图片。

```json
// Custom styles.

body {
    background:url(/images/background/background.jpg);
    background-repeat: no-repeat;
    background-attachment:fixed;
    background-position:50% 50%;
    background-size: cover;
}
```



## 背景对搜索的影响

如果我们在主题配置文件中启用了搜索功能，那么就不能简单粗暴地直接将整个页面都设置透明度，这会导致搜索框失效，无法正常使用。原因是因为搜索框是通过jQuery临时添加的，如果整个页面都设置了透明度，会导致搜索框的`z-index`失效而无法触发点击事件。

将搜索框的父元素设置为白色透明的，而其他页面元素则直接设置透明度，如下：

```json
.header-inner {
   background: rgba(255, 255, 255, 0.9) !important;
}
```



## 优秀资料

[添加背景图片轮播](https://blog.csdn.net/lewky_liu/article/details/81149140)

[为 Hexo 主题 next 添加图片背景](https://blog.diqigan.cn/posts/add-background-picture-for-next.html)