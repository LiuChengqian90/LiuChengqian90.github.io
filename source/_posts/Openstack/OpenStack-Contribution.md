---
title: 如何向OpenStack社区贡献代码
date: 2018-12-30 09:23:27
categories: OpenStack
tags:
  - neutron
  - OpenStack
---

## Launchpad注册

Launchpad 是 OpenStack 用来托管其所有项目的位置。

请访问 [Launchpad 登录页面](https://launchpad.net/+login)，使用您的电子邮件地址进行注册，并为自己选择一个便于记忆的 Launchpad ID。然后访问 https://launchpad.net/~*LaunchpadID*，使用该页上的说明上传您的 SSH 公钥（用哪个本地环境进行开发就上传哪个 SSH公钥，可上传多个）。

例如，我的 Launchpad id 是 liuchengqian90，因此我将访问 https://launchpad.net/~liuchengqian90。

![launchpad](/images/OpenStack-Contribution/launchpad.png)

## gerrit-review配置

OpenStack 应用了一个代码评审过程来保证代码质量。

请访问 [OpenStack 代码审查](https://review.openstack.org/) 页面，并使用您的 Launchpad 帐户进行登录。然后访问 <https://review.openstack.org/#/settings/ssh-keys> 并上传您的 SSH 公钥。

第一个红框是个人信息，包含 username(一串数字)、email等信息。

第二个红框是SSH公钥。

![git-review-online](/images/OpenStack-Contribution/git-review-online.png)

## 签署CLA协议

1. 请加入 [OpenStack Foundation](https://www.openstack.org/join/)（如果您尚未加入）。使用您计划用于贡献代码的电子邮件地址。[foundation profile](https://www.openstack.org/profile/) 中的主要电子邮件地址需要与您稍后在 Gerrit 联系信息中设置的首选电子邮件相匹配。
2. 请访问 [Code Review](https://review.openstack.org/) 页面。单击位于该页面右上角的 **Sign In** 链接。使用您的 Launchpad ID 登录 Launchpad。
3. 除非您是美国政府雇员（参见以下内容），否则请同意 [Individual Contributor License Agreement](https://review.openstack.org/#/settings/agreements) 并提供联系信息。您的所有姓名和电子邮件地址都是公开的。如果需要的话，可以稍后 [更新](https://review.openstack.org/#/settings/contact) 此联系信息，但确保主要电子邮件地址始终与为您的 OpenStack Foundation 会员身份设置的电子邮件地址相匹配。
4. 加入 [OpenStack Contributors](https://launchpad.net/~openstack-cla/+join) 组。需要以会员身份提交代码更改。

如果您以个人贡献者的身份工作，那么执行上述步骤就足够了。如果您代表公司或美国政府工作，那么您可能需要关注其他一些内部审批过程，这些过程因公司而异。有关的详细信息，请参阅 [贡献者许可协议](https://wiki.openstack.org/wiki/HowToContribute#Contributors_License_Agreement)。

## 本地环境配置

### 需要安装的工具包

(for centos 7.x)

```shell
# yum install -y python-devel python34-devel python-pip
# pip install tox
```

### git 配置

```shell
# git config --global user.name 'YourName'
# git config --global user.email example@example.com
```

这个是本地所有代码库的全局配置，如果您用多个账号进行不同的开发，您可以设置 local 环境变量，不过local设置需要在本地clone的代码库中，例如，

```shell
# git clone https://github.com/openstack/neutron.git
# cd neutron
# git config user.name 'YourName'				//local 是默认的，可以不用特意注明
# git config user.email example@example.com
# git config -l  //查看已有配置
```

### git-review 配置

安装

```shell
# yum install -y git-review
```

进入本地代码库并进行review设置

```shell
# cd neutron
# git review -s
```

注意 username 是 https://review.openstack.org/#/settings/ 的一串数字。

在进行git-review设置试，经常遇到的ERROR包含下面的字符

```
We don't know where your gerrit is. Please manually create a remote named "gerrit" and try again.
```

需要进行以下操作：

- 手动添加节点gerrit节点

  ```shell
  # git remote add gerrit ssh://<username>@review.openstack.org:29418/openstack/neutron.git
  ```

- 如果还有错误

  ```
  ssh: Could not resolve hostname review.openstack.org: Name or service not known
  fatal: Could not read from remote repository.
  ```

  这是因为在国内OpenStack社区gerrit的29418端口被墙，所以可以使用https/http来完成git reiview。

  - 登录review.openstack.org，然后在Settings -> HTTP Password里，生成一个HTTP密码，应该是一个大小写加数字的随机字符串。

  - 通过以下命令把SSH修改成HTTPS(或HTTP)访问

    ```shell
    # git remote set-url gerrit https://username:http-password@review.openstack.org/openstack/neutron.git
    ```

## OpenStack流程演示

1. report bug

   - 访问 <https://launchpad.net/neutron>。

   - 单击 **Report a bug**，然后输入概要信息和所需的信息。

   - 单击 **Submit bug report** 按钮。此 bug 具有一个链接：https://bugs.launchpad.net/neutron/+bug/1810025 和一个 bug 号：1810025。

   - 在 **Assigned to** 列中将这个 bug 分配给你自己。

2. 创建本地分支

   ```shell
   # cd neutron
   # git checkout master
   # git pull
   # git checkout -b Bug1810025
   ```

3. 在分支 Bug1810025 中修改 keystone 代码。

4. 将该代码提交给 Gerrit：

   - 运行 `git commit -a` 命令。

   - 输入一些注释。

     第一段应该是一句话的简介；

     第二段可以是详细说明（可选）；

     如果此分支修复一个 bug 或一个蓝图，则添加 Fixes Bug1810025 或 Blueprint XXXX 作为最后一段。

     ```
     Implements: blueprint BLUEPRINT
     
     Closes-Bug: #123456
     
     Partial-Bug: #123456
     
     Related-Bug: #123456
     ```

     通过这些字段来标识自己工作相关的bug或者blueprint，一旦注明，CI系统会自动将你的commit和相同ID的bug对应起来。

   - 运行 `git review`。

5. 检查是否已经成功提交

   1. 转到 [https://review.openstack.org](https://review.openstack.org/) 并使用您的 Launchpad 帐户登录。
   2. 从顶部水平导航器中，单击 **My > Changes**，然后您可以找到您已提交的修补程序。



针对几种情况进行二次提交：

1. 修改注释 或 根据意见进行修改

   ```shell
   # git add -A
   # git commit -–amend  //不要运行 git commit -a，否则会有多个注释提交给 Gerrit。
   # git review
   ```

2. 其他开发环境下载此次修改并修改提交

   每个提交都有一个review number号， https://review.openstack.org/#/c/review-number/。

   ```shell
   # cd neutron
   # git review -d review-number //把patch给check out，然后就可以编辑了
   # git commit -A
   # git commit --amend
   # git review
   ```

## 优秀资料

[向 OpenStack 贡献您的代码](https://www.ibm.com/developerworks/cn/cloud/library/cl-contributecode-openstack/)

[OpenStack提交代码的review流程](https://www.cnblogs.com/Security-Darren/p/4383838.html)

[Git Review提交代码失败的解决方法](https://blog.csdn.net/agileclipse/article/details/38980419)