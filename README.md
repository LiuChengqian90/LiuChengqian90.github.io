# LiuChengqian90.github.io
Centos 安装 npm

```shell
# yum list | grep epel  //安装搜索结果源
# yum install -y nodejs
```

一、关于搭建的流程

1. 创建仓库，liuchengqian90.github.io
2. 创建两个分支：master 与 hexo；
3. 设置hexo为默认分支（因为我们只需要手动管理这个分支上的Hexo网站文件）；
4. 使用git clone git@github.com:LiuChengqian90/LiuChengqian90.github.io.git 拷贝仓库；
5. 在本地 LiuChengqian90.github.io 文件夹下通过Git bash或者CMD依次执行 npm install hexo、npm install hexo-cli、hexo init、npm install 和 npm install hexo-deployer-git（此时当前分支应显示为hexo）;
6. 修改_config.yml中的deploy参数，分支应为master；
7. 依次执行git add .、git commit -m "..."、git push origin hexo提交网站相关的文件；
8. 执行hexo g -d生成网站并部署到GitHub上。

这样一来，在GitHub上的 LiuChengqian90.github.io 仓库就有两个分支，一个hexo分支用来存放网站的原始文件，一个master分支用来存放生成的静态网页。

二、关于日常的改动流程
在本地对博客进行修改（添加新博文、修改样式等等）后，通过下面的流程进行管理。

1. 依次执行hexo clean;rm -rf .deploy_git;git add -A; git commit -m "backup to git"; git push origin hexo指令将改动推送到GitHub（此时当前分支应为hexo）；
2. 然后才执行hexo g -d发布网站到master分支上。

虽然两个过程顺序调转一般不会有问题，不过逻辑上这样的顺序是绝对没问题的（例如突然死机要重装了，悲催....的情况，调转顺序就有问题了）。

三、本地资料丢失后的流程
当重装电脑之后，或者想在其他电脑上修改博客，可以使用下列步骤：

1. 使用 git clone git@github.com:LiuChengqian90/LiuChengqian90.github.io.git 拷贝仓库（默认分支为hexo）；
2. 在本地新拷贝的 LiuChengqian90.github.io 文件夹下通过Git bash依次执行下列指令：npm install hexo; npm install hexo-cli; npm install; npm install hexo-deployer-git（记得，不需要hexo init这条指令）。

参考资料：

[知乎参考](https://www.zhihu.com/question/21193762)

 export HEXO_ALGOLIA_INDEXING_KEY=d6766fc778aa1a2b67445c7a40b5dc75
hexo clean;hexo g;hexo algolia;gulp;hexo d

github Personal access tokens
e39e0ca5bdc8e495647278128a5063692d0ceaf0
