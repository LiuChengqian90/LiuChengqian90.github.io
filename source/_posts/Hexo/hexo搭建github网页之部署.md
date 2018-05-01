---
title: hexo搭建github网页之部署
date: 2017-10-19 14:11:27
categories: Hexo
tags:
  - 部署
---

此网页基于hexo和github，在搭建过程中及之后遇到许多问题，特此在这进行一下总结，以免其他人遇到相关问题。

```
操作系统： Centos 7
```

## github仓库

### 创建项目

创建一个项目，项目名为： **github的用户名.github.io**，github页面默认以此命名方式提供。

```shell
创建项目流程：右上角头像 -->> Your profile -->> Repositories -->> "New" 按钮。

查看github用户名流程：右上角头像 -->> settings，Name 即是。
```

### 项目设置

开启”GitHub Pages“功能，github会自动创建一个页面。创建的页面地址在设置页面上也会显示，“Your site is published at” 之后即是。

```shell
进入创建的项目：右上角头像 -->> Your profile ，选择上一步创建的项目进入。

项目设置：settings -->> GitHub Pages，开启。
```

### 高级设置

这一步是对页面代码进行备份，防止更换环境时“从头再来”。

在上面创建的项目中创建一个分支，分支名为“hexo”（分支名随意，此为方便起见）。

```shell
项目页面会看到当前分支名，点击会有输入框，此输入框有创建功能。
```

设置“hexo”分支为默认分支。

```shell
项目页面 -->> “branches” 
```

至此，项目存在两个分支：

- master，用来存放静态页面，即hexo部署。
- hexo，用来存放网页的原始文件。

## hexo环境

**前提：**需要安装npm，可参看其GitHub源码README.md，根据不同系统选择不同命令。

```shell
# sudo yum install -y epel-release
# sudo yum install -y nodejs npm
```

源码安装可参考 [**此处**](http://frontenddev.org/article/ali-cloud-ecs-use-result-1-use-yum-to-install-nodejs-npm-environment.html)，也可参考[**官网**](https://github.com/nodesource/distributions)安装方式。若遇到权限问题，可参考 [**此处**](https://docs.npmjs.com/getting-started/fixing-npm-permissions)。

### 全局安装hexo-cli指令。

```shell
# npm install hexo-cli -g
```

之后可查看hexo命令版本。

```shell
# hexo -v 
```

### 初始化hexo。

将上面创建的项目拉取到本地。git clone 命令。进入拉到本地的项目目录。

```shell
# hexo init
```

之后可以利用hexo进行本地调试。生成静态网页，命令如下

```shell
# hexo g
```

创建进程，模拟网页服务器，命令如下

```shell
# hexo s
```

根据提供的网址即可访问。"localhost" 可改为centos IP地址。

### hexo配置github

前提：本地环境可以提交代码，即需要配置好ssh key 、GitHub user name和email。

打开hexo全局设置文件“_config.yml”，配置“deploy”部分。

```shell
deploy:
  type: git
  repository: 创建的github项目地址，即git clone时，后接的地址
  branch: master
```

deploy是hexo部署页面时，静态网页提交的代码仓库及分支。

页面的标题、描述、作者和语言等都可以在此文件中修改，文件不大，可仔细看一下各字段功能含义。

安装插件：

```shell
# npm install hexo-deployer-git --save
```

此插件可保证成功部署到github。

### 调试部署

```shell
# hexo new 'hello hexo'
```

创建的文件默认放置在`source_posts`目录下。可编辑文件，添加一些内容或不修改。

```shell
# hexo g
# hexo d
```

选项“d” 即部署。部署之后可能需要等待几分钟，然后再次查看github提供的网页，即可看到已经存在自己的提交。

## 主题

hexo所有主题放置在themes文件夹下。默认主题为“landscape”，界面比较简单。

在hexo配置文件中，“theme”即是修改主题的字段。[**hexo主题**](https://hexo.io/themes/)列出了hexo支持的所有主题。下面以最流行的next主题为例。

[**Next官网**](http://theme-next.iissnan.com/)提供了hexo使用方面的文档。

**注意：**

- 下载的源码需放置在“theme/next”目录下，可参考默认主题。

- git clone下载的最新主题源码，需要将主题源码中.git文件夹改名，并将修改记录在一个文件中以防自己遗忘。

  改名是因为本地源码需要进行备份，主题存在.git会与自己的项目目录下的.git冲突。

  当需要更新主题时，可以将其改回，更新之后再次更改即可。

修改完主题后可在本地调试，调试没问题之后进行部署。

## 环境更换

### 正常修改流程：

部署

```shell
# hexo clean; hexo g; hexo d
```

备份

```shell
# hexo clean; git add -A; git commit -m "backup to git"; git push origin hexo
```

### 环境更换的重新操作

- 下载项目源码。
- 配置git基本环境。
- 安装nodejs和npm。
- 安装hexo-cli即可。

**注意：**不在需要初始化。初始化是创建一些必要文件，而这些文件都已经备份。