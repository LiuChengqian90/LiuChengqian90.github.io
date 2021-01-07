---
title: hexo+github建站之评论
date: 2017-10-20 18:34:23
categories: Hexo
tags:
 - 评论
---

hexo搭建的博客下，有多种评论系统可供选择：Disqus、多说和友言等。
<!--more-->
## Valine

[Valine](https://valine.js.org/)是基于Leancloud的评论系统，无需额外注册账号，无后端，Next可完美适配（最新的Next删除的Valine，不过之前的[Next](https://github.com/theme-next/hexo-theme-next)代码库可以）。

### 注册 LeanCloud

[LeanCloud官网登录入口](https://leancloud.cn/dashboard/login.html#/signin)

1. 注册登陆后，访问控制台，**创建应用，选择开发版**

2. 创建好之后就生成了 `App ID` 和 `App Key`，之后再设置 -> 应用keys也可以查到

3. 点击存储，查看是否有`Comment`和 `Counter`，没有则创建，权限设为无限制

4. 然后点击设置 > 安全中心 ,将除了数据存储的服务全部关闭。

5. 配置Next主题`_config.yaml`文件

   ```yaml
   # Valine
   # For more information: https://valine.js.org, https://github.com/xCss/Valine
   valine:
     enable: true
     appid:  # Your leancloud application appid
     appkey:  # Your leancloud application appkey
     notify: false # Mail notifier
     verify: false # Verification code
     placeholder: Just go go # Comment box placeholder
     avatar: mm # Gravatar style
     guest_info: nick,mail,link # Custom comment header
     pageSize: 10 # Pagination size
     language: # Language, available values: en, zh-cn
     visitor: false # Article reading statistic
     comment_count: true # If false, comment count will only be displayed in post page, not in home page
     recordIP: false # Whether to record the commenter IP
     serverURLs: # When the custom domain name is enabled, fill it in here (it will be detected automatically by default, no need to fill in)
     #post_meta_order: 0
   ```



### 其他设置

[Valine](https://valine.js.org/)支持头像配置、邮件提醒、多语言支持、文章阅读量统计及自定义表情。



#### 指定文章（页面）评论功能是否开启

在 Hexo 博客中，评论的功能是在所有页面都默认开启的，但是有的时候我们在页面上不需要显示评论功能，例如分类，标记页面我们并不需要评论功能。

我们可以在 Front-matter 中通过`comments`属性设置true或false控制该页面或者是文章的评论功能是否打开，如我设置标签页面的评论功能关闭：

```yaml
title: 标签
date: 2019-07-18 15:16:50
type: "tags"
comments: false
```



#### 自定义头像

[头像配置](https://valine.js.org/avatar.html)



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