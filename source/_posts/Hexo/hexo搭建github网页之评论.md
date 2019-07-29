---
title: hexo搭建github网页之评论
date: 2017-10-20 18:34:23
categories: Hexo
tags:
 - 评论
---

hexo搭建的博客下，有多种评论系统可供选择：Disqus、多说和友言等。

## 畅言

## Valine

## Gitment

### OAuth Application

OAuth Application是一种认证机制，可参考[简述 OAuth 2.0 的运作流程](http://www.barretlee.com/blog/2016/01/10/oauth2-introduce/)。

使用gitmen第一步就是需要注册一个新的 [OAuth Application](https://github.com/settings/applications/new)。

- Application name，可以随便填写。
- Homepage URL，网站主页，可以填写github给的网址（以io结尾）。
- Application description，应用描述，可不填。
- Authorization callback URL，应用调用返回页。可和 Homepage URL一样，最好填写私有网址。

注册之后得到一个 client ID 和一个 client secret，这两个是之后要用到的值。也可以通过以下方式查询

```
github settings -->> Developer settings -->> OAuth Apps
```

### gitment配置

gitment创作者列出的[配置方法](https://imsun.net/posts/gitment-introduction/)比较简单，本文以next主题为例进行详细介绍。

1. 配置主题配置文件。

   在主题配置文件\_config.yaml中添加以下代码

   ```
   # Gitment
   # Introduction: https://imsun.net/posts/gitment-introduction/
   gitment:
     enable: true
     githubID: your github name
     repo: your repository name
     ClientID: --
     ClientSecret: --
     lazy: true
   ```

   - githubID，github 账号的 name。配置id不生效，会报错。获取方式，之前的文章已经介绍。
   - repo，仓库名，用来存放评论。gitment以github issues为基础，所以此仓库可以是属性为public的任意仓库。
   - ClientID、ClientSecret，OAuth Application相关。
   - lazy，懒加载。进入文章后，评论全部显示（false）或者仅显示一个按钮（true）。

2. 懒加载按钮显示设置

   主题languages是一些文字的各种语言版本。在en.yml文件中添加

   ```yaml
   gitmentbutton: Show comments from Gitment
   ```

   在zh-Hans.yml文件中添加

   ```yaml
   gitmentbutton: 显示 Gitment 评论
   ```

   其他语言课根据个人需求进行配置。

3. 按钮事件

   在主题layout/_partials/comments.swig文件中添加代码，以使文件最后类似

   ```swift
   {% elseif theme.valine.appid and theme.valine.appkey %}
         <div id="vcomments"></div>
       {% elseif theme.gitment.enable %}
          {% if theme.gitment.lazy %}
            <div onclick="ShowGitment()" id="gitment-display-button">{{ __('gitmentbutton') }}</div>
            <div id="gitment-container" style="display:none"></div>
          {% else %}
            <div id="gitment-container"></div>
          {% endif %}	
       {% endif %}
     </div>
   {% endif %}
   ```

   文件中增加了“elseif theme.gitment.enable” 事件域。

4. 增加对应页面生成JS代码

   在主题layout/_third-party/comments/目录中添加文件gitment.swig，内容为

   ```swift
   {% if theme.gitment.enable %}
      {% set owner = theme.gitment.githubID %}
      {% set repo = theme.gitment.repo %}
      {% set cid = theme.gitment.ClientID %}
      {% set cs = theme.gitment.ClientSecret %}
      <link rel="stylesheet" href="https://imsun.github.io/gitment/style/default.css">
      <script src="https://imsun.github.io/gitment/dist/gitment.browser.js"></script>
      {% if not theme.gitment.lazy %}
          <script type="text/javascript">
              var gitment = new Gitment({
                  id: window.location.pathname, 
                  owner: '{{owner}}',
                  repo: '{{repo}}',
                  oauth: {
                      client_id: '{{cid}}',
                      client_secret: '{{cs}}',
                  }});
              gitment.render('gitment-container');
          </script>
      {% else %}
          <script type="text/javascript">
              function ShowGitment(){
                  document.getElementById("gitment-display-button").style.display = "none";
                  document.getElementById("gitment-container").style.display = "block";
                  var gitment = new Gitment({
                      id: window.location.pathname, 
                       owner: '{{owner}}',
                       repo: '{{repo}}',
                       oauth: {
                           client_id: '{{cid}}',
                           client_secret: '{{cs}}',
                   }});
                  gitment.render('gitment-container');
              }
          </script>
      {% endif %}
   {% endif %}
   ```

   文件中使用了两个线上文件，可以把路径复制，在浏览器（谷歌可用）中打开来查看。

   添加完文件后，在同目录index.swig文件中添加

   ```js
   {% include 'gitment.swig' %}
   ```

   以引入新创建的文件。

5. 设置CSS样式

   在主题source/css/_common/components/third-party/目录下添加gitment.styl文件，设置button的样式

   ```css
   #gitment-display-button{
        display: inline-block;
        padding: 0 15px;
        color: #0a9caf;
        cursor: pointer;
        font-size: 14px;
        border: 1px solid #0a9caf;
        border-radius: 4px;
    }
    #gitment-display-button:hover{
        color: #fff;
        background: #0a9caf;
    }
   ```

   在目录third-party.styl中添加

   ```css
   @import "gitment";
   ```

   以引入新创建的文件。

至此，评论配置完成。

### 调试点

1. 文件中空格、结尾空行最好保持不变。

2. 本地只能调试是否有页面错误，其他功能最好线上调试。

3. 调试引用的线上js代码时，可以下载到本地进行修改。代码引用本地修改后的文件。例如替换为

   ```js
   src="{{ url_for(theme.js) }}/src/test.js
   ```

   test.js为下载到本地加入调试信息的文件。

4. 最易出错的地方应该是字段置换错误（layout/_third-party/comments/gitment.swig文件调用js时，字段已经置换）。可进入浏览器调试模式（F12）进行调试。

### 问题

1. redirect_uri_mismatch

   一般为 Authorization callback URL 设置错误。设置为自己的网站首页，例如"https://chengqian90.com/"。

2. 初始化评论时，Error: Validation Failed

   更改gitment.swig  文件中gitment ID。

   ```shell
   function renderGitment(){
           var gitment = new {{CommentsClass}}({
   -           id: window.location.pathname,
   +           id: '{{ page.date }}',
               owner: '{{ theme.gitment.github_user }}',
               repo: '{{ theme.gitment.github_repo }}',
               ……
   ```