---
title: hexo+github建站之近期文章
date: 2019-08-30 16:48:37
categories: Hexo
tags:
  - 近期文章
---

增加近期文章显示，直接修改主题`sidebar.swig`文件即可。
<!--more-->
## sidebar文件

在`layout/_macro/sidebar.swig`文件`if theme.links`前加入以下代码

```json
{% if theme.recent_posts %}
  <div class="links-of-blogroll motion-element {{ "links-of-blogroll-" + theme.recent_posts_layout  }}">
   <div class="links-of-blogroll-title">
     <!-- modify icon to fire by szw -->
     <i class="fa fa-history fa-{{ theme.recent_posts_icon | lower }}" aria-hidden="true"></i>
     {{ theme.recent_posts_title }}
   </div>
   <ul class="links-of-blogroll-list">
     {% set posts = site.posts.sort('-date') %}
     {% for post in posts.slice('0', '5') %}
       <li>
         <a href="{{ url_for(post.path) }}" title="{{ post.title }}" target="_blank">{{ post.title }}</a>
       </li>
     {% endfor %}
   </ul>
  /div>
 {% endif %}
```

## 主题配置

在主题配置文件 `_config.yml` 中新增3个变量

```json
recent_posts: true
recent_posts_title: 近期文章
recent_posts_layout: block
```

## 效果验证

```shell
# hexo clean; hexo g; hexo s
```
