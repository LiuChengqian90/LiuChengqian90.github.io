---
title: hexo+github建站之搜索引擎收录
date: 2017-10-20 18:33:54
categories: Hexo
tags:
  - 搜索引擎
typora-root-url: ../../../source
---

## 确认收录

确认网站是否被某搜索引擎收录的方法为，在其搜索框输入

```shell
site:website_url
```

例如：在百度搜索引擎上确认baidu.com是否被收录

```
site:baidu.com
```

## 站点验证

验证此站点是否归你所有。

### 谷歌验证

进入 [谷歌搜索引擎站点验证](https://www.google.com/webmasters/tools/home?hl=zh-CN)，验证流程比较智能，输入网址之后，登录域名提供商，谷歌会自动添加一条 TXT记录，之后即可完成验证。

![谷歌TXT记录.png](/images/hexo搭建github/谷歌TXT记录.png)

**对于阿里云DNS，需要将解析线路设置为“默认”**。

### 百度验证

进入[站点管理](http://zhanzhang.baidu.com/site/index)，添加网站，最后会提供验证方式。

- 文件验证

  下载验证文件，将其放置于所配置域名的根目录下。

- HTML标签验证

  将给出的一段代码发在网站首页的HTML代码的<head>标签与</head>标签之间。

- CNAME验证

  将 baidu_key.site_url 使用CNAME解析到zz.baidu.com。baidu_key为搜索引擎自动分配，site_url为需要验证的网址。

如果是购买的域名，建议用CNAME验证。但是CNAME验证有些问题，描述不正确。应该是将提供的一串字符（website_url之前的部分）解析到提供的网址。

之后即可验证成功。

## 站点地图

站点地图是一个页面，上面放置了网站上需要搜索引擎抓取的所有页面的链接。网站地图可以方便搜索引擎蜘蛛抓取网站页面，通过抓取网站页面，清晰了解网站的架构，为搜索引擎蜘蛛指路，增加网站重要内容页面的收录。

1. 安装hexo插件获得站点地图功能

   ```shell
   # npm install hexo-generator-sitemap --save
   # npm install hexo-generator-baidu-sitemap --save
   ```

2. 在全局配置文件中增加如下配置

   ```yaml
   # 自动生成sitemap
   sitemap: 
     path: sitemap.xml
   baidusitemap: 
     path: baidusitemap.xml
   ```

3. 生成静态文件及部署

   ```shell
   # hexo g
   ```

   之后public目录下，sitemap.xml和baidusitemap.xml这两个文件就是生成的站点地图。可以看一下，其中的列出了网站中所有的文章链接。由于百度屏蔽了github，所以最好购买一个域名。更改地图url，可以更改全局配置文件“url”字段。

   ```shell
   # hexo d
   ```

   部署至线上。之后可以通过访问 your_site_url/sitemap.xml 和 your_site_url/baidusitemap.xml来确定是否存在站点地图。

### 谷歌收录

将生成的sitemap.xml提交到[谷歌站长](https://www.google.com/webmasters/tools)。

```
“抓取”	-->>	“站点地图”	-->>	“添加站点地图”
```

### 百度收录

百度提供如下方式对站点进行收录。

#### 自动提交

- 主动推送

  实时推送，通过百度引擎提供的目录格式进行推送。

- 自动推送

  将百度引擎提供的一段JS代码插入到网站页面中，安装完成后即可实现链接自动推送功能。

  如果用的主题是“next”，在主题配置文件中设置 “baidu_push” 为 “True”即可，不用做其他更改。

- sitemap

  提交站点地图。

#### 手动提交

这个应该是最费事的方式，估计…没人会用。

## 蜘蛛协议

在站点`source`目录下创建`robots.txt`文件。

```json
User-agent: *
Allow: /
Allow: /archives/
Allow: /tags/
Allow: /about/

Disallow: /vendors/
Disallow: /js/
Disallow: /css/
Disallow: /fonts/
Disallow: /vendors/
Disallow: /fancybox/

Sitemap: https://chengqian90.com/search.xml
Sitemap: https://chengqian90.com/sitemap.xml
Sitemap: https://chengqian90.com/baidusitemap.xml
```

robots文件格式请参考 [robots.txt文件的格式](https://ziyuan.baidu.com/college/courseinfo?id=267&page=12#h2_article_title30)。

## 优秀资料

[github+hexo提交到百度谷歌搜索引擎](http://www.jianshu.com/p/7e1166eb412a)

[使用 Hexo 搭建博客的深度优化与定制](https://github.com/heytxz/test/issues/20)