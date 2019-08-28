---
title: Linux Namespace简介
date: 2017-12-11 15:30:14
categories: Linux内核
tags:
  - namespace
typora-root-url: ../../../source
---

Tips:系统环境为 Ubuntu 16.04，centos系统在namespace支持方面有些问题。

Namespace(命名空间)是一种纯软件方式的资源隔离方案，是Linux Container的基础，也是Docker实现的基础之一。

Linux内核中提供了6种namespace隔离的系统调用，由带有CLONE_NEW*标志的clone()所创建。这些标志如下表所示：

| Namespace | 系统调用参数        | 值          | 隔离内容                                     |
| --------- | ------------- | ---------- | ---------------------------------------- |
| Mount     | CLONE_NEWNS   | 0x00020000 | 挂载点（文件系统）。 mount namespace是第一个namespace且当时没有人想到会将这套机制扩展到其它的子系统， 等它成了API， 由于兼容性问题，也不能改名了。 |
| UTS       | CLONE_NEWUTS  | 0x04000000 | 主机名与域名。 影响setdomainname()、sethostname()这类接口。 |
| IPC       | CLONE_NEWIPC  | 0x08000000 | 信号量、消息队列和共享内存等进程间通信机制。                   |
| User      | CLONE_NEWUSER | 0x10000000 | 用户和用户组。                                  |
| PID       | CLONE_NEWPID  | 0x20000000 | 进程编号。                                    |
| Network   | CLONE_NEWNET  | 0x40000000 | 网络设备、网络栈、端口等。                            |

Linux内核实现namespace的主要目的就是为了实现轻量级虚拟化（容器）服务。在同一个namespace下的进程可以感知彼此的变化，而对外界的进程一无所知。这样就可以让容器中的进程产生错觉，仿佛自己置身于一个独立的系统环境中，以此达到独立和隔离的目的。

## 调用namespace的API

namespace的API包括clone()、setns()以及unshare()，还有/proc下的部分文件。为了确定隔离的到底是哪种namespace，在使用这些API时，通常需要指定以下六个常数的一个或多个，通过'|'（位或）操作来实现。

### CLONE()

clone()在内核实现函数为do_fork()，形式如下：

```c
#include <sched.h>
int clone(int (*fn)(void *), void *child_stack, int flags, void *arg, ...);
```

- 参数child_func传入子进程运行的程序主函数。
- 参数child_stack传入子进程使用的栈空间。
- 参数flags表示使用哪些CLONE_*标志位。
- 参数args则可用于传入用户参数。

在内核实现函数为do_fork()，形式如下：

```c
long do_fork(unsigned long clone_flags,
	      unsigned long stack_start,
	      unsigned long stack_size,
	      int __user *parent_tidptr,
	      int __user *child_tidptr)
```

'clone_flags' 即可赋值为上面提到的标志。

### PROC文件

从3.8版本的内核开始，用户就可以在`/proc/[pid]/ns`文件下看到指向不同namespace号的文件，效果如下所示：

```shell
# ls -al /proc/$$/ns 	<<-- $$ 表示当前进程的PID
total 0
dr-x--x--x 2 root root 0 Dec 11 16:39 .
dr-xr-xr-x 9 root root 0 Dec 11 16:22 ..
lrwxrwxrwx 1 root root 0 Dec 11 16:39 ipc -> ipc:[4026531839]
lrwxrwxrwx 1 root root 0 Dec 11 16:39 mnt -> mnt:[4026531840]
lrwxrwxrwx 1 root root 0 Dec 11 16:39 net -> net:[4026531956]
lrwxrwxrwx 1 root root 0 Dec 11 16:39 pid -> pid:[4026531836]
lrwxrwxrwx 1 root root 0 Dec 11 16:39 user -> user:[4026531837]
lrwxrwxrwx 1 root root 0 Dec 11 16:39 uts -> uts:[4026531838]
```

其下面的文件依次表示每个namespace, 例如user就表示user namespace。所有文件均为符号链接, 链接指向\$namespace:[$namespace-inode-number]，前半部份为namespace的名称，后半部份的数字表示这个namespace的inode number。因此，如果两个进程指向的namespace inode number相同，就说明他们在同一个namespace下，否则则在不同namespace里面。

该链接指向的文件比较特殊，它不能直接访问，事实上指向的文件存放在被称为”nsfs”的文件系统中，该文件系统用户不可见。可以用stat()看到指向文件的inode信息：

```shell
# stat -L /proc/$$/ns/net
  File: ‘/proc/927/ns/net’
  Size: 0               Blocks: 0          IO Block: 1024   regular empty file
Device: 3h/3d   Inode: 4026531956  Links: 1
Access: (0444/-r--r--r--)  Uid: (    0/    root)   Gid: (    0/    root)
Access: 2017-12-11 16:51:16.531134197 +0800
Modify: 2017-12-11 16:51:16.531134197 +0800
Change: 2017-12-11 16:51:16.531134197 +0800
 Birth: -
```

### SETNS()

加入一个已经存在的namespace中以通过setns() 系统调用来完成。它的原型如下：

```c
int setns(int fd, int nstype);
/*
fd表示我们要加入的namespace的文件描述符。
nstype让调用者可以去检查fd指向的namespace类型是否符合我们实际的要求。如果填0表示不检查。
*/
```

util-linux包里提供了nsenter命令，其提供了一种方式将新创建的进程运行在指定的namespace里面，它的实现很简单，就是通过命令行指定要进入的namespace的file，然后利用setns()指当前的进程放到指定的namespace里面，再clone()运行指定的执行文件。我们可以用strace来看看它的运行情况：

```shell
# strace nsenter -t 27242 -i -m -n -p -u /bin/bash
execve("/usr/bin/nsenter", ["nsenter", "-t", "27242", "-i", "-m", "-n", "-p", "-u", "/bin/bash"], [/* 21 vars */]) = 0
…………
…………
pen("/proc/27242/ns/ipc", O_RDONLY)    = 3
open("/proc/27242/ns/uts", O_RDONLY)    = 4
open("/proc/27242/ns/net", O_RDONLY)    = 5
open("/proc/27242/ns/pid", O_RDONLY)    = 6
open("/proc/27242/ns/mnt", O_RDONLY)    = 7
setns(3, CLONE_NEWIPC)                  = 0
close(3)                                = 0
setns(4, CLONE_NEWUTS)                  = 0
close(4)                                = 0
setns(5, CLONE_NEWNET)                  = 0
close(5)                                = 0
setns(6, CLONE_NEWPID)                  = 0
close(6)                                = 0
setns(7, CLONE_NEWNS)                   = 0
close(7)                                = 0
clone(child_stack=0, flags=CLONE_CHILD_CLEARTID|CLONE_CHILD_SETTID|SIGCHLD, child_tidptr=0x7f4deb1faad0) = 4968
```

nsenter先获得target进程(-t参数指定)所在的namespace的文件, 然后再调用setns()将当前所在的进程加入到对应的namespace里面, 最后再clone()运行我们指定的二进制文件。

### UNSHARE()

unshare()系统调用用于将当前进程和所在的namespace分离并且加入到新创建的namespace之中。unshare()运行在原先的进程上，不需要启动一个新进程，使用方法如下

```c
int unshare(int flags);
```

Linux中自带的unshare命令，就是通过unshare()系统调用实现的。

## UTS namespace

UTS namespace提供了主机名和域名的隔离，这样每个容器就可以拥有了独立的主机名和域名，在网络上可以被视作一个独立的节点而非宿主机上的一个进程。

编译并运行以下程序：

```c
#define _GNU_SOURCE
#include <sys/types.h>
#include <sys/wait.h>
#include <stdio.h>
#include <sched.h>
#include <signal.h>
#include <unistd.h>
 
/* 定义一个给 clone 用的栈，栈大小1M */
#define STACK_SIZE (1024 * 1024)
static char container_stack[STACK_SIZE];
 
char* const container_args[] = {
    "/bin/bash",
    NULL
};
 
int container_main(void* arg)
{
    printf("Container - inside the container!\n");
    /* 直接执行一个shell，以便我们观察这个进程空间里的资源是否被隔离了 */
    execv(container_args[0], container_args); 
    return 1;
}
 
int main()
{
    printf("Parent - start a container!\n");
    /* 调用clone函数，其中传出一个函数，还有一个栈空间的（为什么传尾指针，因为栈是反着的） */
    int container_pid = clone(container_main, container_stack+STACK_SIZE, SIGCHLD, NULL);
    /* 等待子进程结束 */
    waitpid(container_pid, NULL, 0);
    printf("Parent - container stopped!\n");
    return 0;
}
```

执行结果为：

```shell
root@ubuntu:~# gcc uts.c ; ./a.out
Parent - start a container!
Container - inside the container!
root@ubuntu:~# 
root@ubuntu:~# exit
exit
Parent - container stopped!
root@ubuntu:~# 
```

加入UTS隔离。

```c
//[...]
int child_main(void* arg) {
  printf("Container - inside the container!\n");
    /* 直接执行一个shell，以便我们观察这个进程空间里的资源是否被隔离了 */	
	sethostname("container",10); /* 设置hostname */	
    execv(container_args[0], container_args); 
    return 1;
}

int main() {
//[...]
/*启用CLONE_NEWUTS Namespace隔离 */
int container_pid = clone(container_main, container_stack+STACK_SIZE, 
            CLONE_NEWUTS | SIGCHLD, NULL); 
//[...]
}
```

运行结果为：

```shell
root@ubuntu:~# gcc uts.c ; ./a.out
Parent - start a container!
Container - inside the container!
root@container:~# hostname
container
root@container:~# exit
exit
Parent - container stopped!
```

不加CLONE_NEWUTS参数运行上述代码，发现主机名也变了，输入exit以后主机名也会变回来，似乎没什么区别。实际上不加CLONE_NEWUTS参数进行隔离而使用sethostname已经把宿主机的主机名改掉了。你看到exit退出后还原只是因为bash只在刚登录的时候读取一次UTS，当你重新登陆或者使用uname命令进行查看时，就会发现产生了变化。

## IPC namespace

进程间通信采用的方法包括常见的信号量、消息队列和共享内存。对不在原namespace中的进程来说，之间的通信，实际上是具有相同'PID namespace'中的进程间通信，因此需要一个唯一的标识符来进行区别。申请IPC资源就申请了这样一个全局唯一的32位ID，所以IPC namespace中实际上包含了系统IPC标识符以及实现POSIX消息队列的文件系统。在同一个IPC namespace下的进程彼此可见，而与其他的IPC namespace下的进程则互相不可见。

修改上面的代码：

```c
//[...]
int container_pid = clone(container_main, container_stack+STACK_SIZE, 
            CLONE_NEWUTS | CLONE_NEWIPC | SIGCHLD, NULL);
//[...]
```

在shell中使用'ipcmk -Q'命令创建一个message queue，并使用'ipcs -q'查看已经开启的message queue。

```shell
root@ubuntu:~# ipcmk -Q
Message queue id: 0
root@ubuntu:~# ipcs -q

------ Message Queues --------
key        msqid      owner      perms      used-bytes   messages    
0x875028f6 0          root       644        0            0           
```

编译并运行修改后的程序：

```shell
root@ubuntu:~# gcc uts.c ; ./a.out 
Parent - start a container!
Container - inside the container!
root@container:~# ipcs -q

------ Message Queues --------
key        msqid      owner      perms      used-bytes   messages    

root@container:~# exit
exit
Parent - container stopped!
```

上面的结果显示中可以发现，已经找不到原先声明的message queue，实现了IPC的隔离。

## PID namespace

![PID Namespace](/images/Linux-Namespace/PID-Namespace.png)

PID namespace隔离非常实用，它对进程PID重新标号，即两个不同namespace下的进程可以有同一个PID。每个PID namespace都有自己的计数程序。内核为所有的PID namespace维护了一个树状结构，最顶层的是系统初始时创建的，我们称之为root namespace。它创建的新PID namespace就称之为child namespace（树的子节点），而原先的PID namespace就是新创建的PID namespace的parent namespace（树的父节点）。通过这种方式，不同的PID namespaces会形成一个等级体系。所属的父节点可以看到子节点中的进程，并可以通过信号量等方式对子节点中的进程产生影响。反过来，子节点不能看到父节点PID namespace中的任何内容。由此产生如下结论。

- 每个PID namespace中的第一个进程“PID 1“，都会像传统Linux中的init进程一样拥有特权，起特殊作用。
- 一个namespace中的进程，不可能通过kill或ptrace影响父节点或者兄弟节点中的进程，因为其他节点的PID在这个namespace中没有任何意义。
- 如果你在新的PID namespace中重新挂载/proc文件系统，会发现其下只显示同属一个PID namespace中的其他进程。
- 在root namespace中可以看到所有的进程，并且递归包含所有子节点中的进程。

修改上文的代码，加入PID namespace的标识位：

```c
//[...]
int child_pid = clone(child_main, child_stack+STACK_SIZE,
          CLONE_NEWUTS | CLONE_NEWPID | SIGCHLD, NULL); 
//[...]
```

运行结果如下：

```shell
root@ubuntu:~# echo $$ 
894
root@ubuntu:~# gcc uts.c ; ./a.out ;
Parent - start a container!
Container - inside the container!
root@container:~# echo $$							<<<--- shell 程序的PID已经改变
1
root@container:~# exit
exit
Parent - container stopped!
```

在子进程的shell中执行了`ps aux`/`top`之类的命令，发现还是可以看到所有父进程的PID，那是因为还没有对文件系统进行隔离，`ps`/`top`之类的命令调用的是真实系统下的`/proc`文件内容，看到的自然是所有的进程。

此外，与其他的namespace不同的是，为了实现一个稳定安全的隔离空间（例如，容器），PID namespace还需要进行一些额外的工作才能确保其中的进程运行顺利。

- PID NAMESPACE中的INIT进程

  当我们新建一个PID namespace时，默认启动的进程PID为1。在传统的UNIX系统中，PID为1的进程是init，地位非常特殊。它作为所有进程的父进程，维护一张进程表，不断检查进程的状态，一旦有某个子进程因为程序错误成为了“孤儿”进程，init就会负责回收资源并结束这个子进程。所以在实现的容器中，启动的第一个进程也需要实现类似init的功能，维护所有后续启动进程的运行状态。

  PID namespace维护这样一个树状结构，非常有利于系统的资源监控与回收。

- 信号量与INIT进程

  PID namespace中的init进程如此特殊，自然内核也为它赋予了特权——信号量屏蔽。如果init中没有处理某个信号量的代码逻辑，那么与init在同一个PID namespace下的进程（即使有超级权限）发送给它的该信号量都会被屏蔽。这个功能的主要作用是防止init进程被误杀。

  父节点中的进程发送的信号量，如果不是SIGKILL（销毁进程）或SIGSTOP（暂停进程）也会被忽略。但如果发送SIGKILL或SIGSTOP，子节点的init会强制执行（无法通过代码捕捉进行特殊处理），也就是说父节点中的进程有权终止子节点中的进程。

  一旦init进程被销毁，同一PID namespace中的其他进程也会随之接收到SIGKILL信号量而被销毁。理论上，该PID namespace自然也就不复存在了。但是如果/proc/[pid]/ns/pid处于被挂载或者打开状态，namespace就会被保留下来。然而，保留下来的namespace无法通过setns()或者fork()创建进程，所以实际上并没有什么作用。

- 挂载PROC文件系统

  如果你在新的PID namespace中使用ps命令查看，看到的还是所有的进程，因为与PID直接相关的/proc文件系统（procfs）没有挂载到与原/proc不同的位置。所以如果你只想看到PID namespace本身应该看到的进程，需要重新挂载/proc，命令如下：

  ```shell
  root@Changed Name:~# mount -t proc proc /proc
  root@Changed Name:~# ps aux
  USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
  root         1  0.0  0.0 115388  2024 pts/0    S    19:49   0:00 /bin/bash
  root        13  0.0  0.0 151064  1800 pts/0    R+   19:49   0:00 ps aux
  ```

  可以看到实际的PID namespace就只有两个进程在运行。

  **注意**：因为此时我们没有进行mount namespace的隔离，所以这一步操作实际上已经影响了 root namespace的文件系统，当你退出新建的PID namespace以后再执行`ps a`就会发现出错，再次执行`mount -t proc proc /proc`可以修复错误。

- UNSHARE()和SETNS()

  unshare()允许用户在原有进程中建立namespace进行隔离。但是创建了PID namespace后，原先unshare()调用者进程并不进入新的PID namespace，接下来创建的子进程才会进入新的namespace，这个子进程也就随之成为新namespace中的init进程。

  类似的，调用setns()创建新PID namespace时，调用者进程也不进入新的PID namespace，而是随后创建的子进程进入。

  这样设计是因为调用getpid()函数得到的PID是根据调用者所在的PID namespace而决定返回哪个PID，进入新的PID namespace会导致PID产生变化。而对用户态的程序和库函数来说，他们都认为进程的PID是一个常量，PID的变化会引起这些进程崩溃。

  **换句话说，一旦程序进程创建以后，那么它的PID namespace的关系就确定下来了，进程不会变更他们对应的PID namespace。**

## Mount namespaces

Mount namespace通过隔离文件系统挂载点对隔离文件系统提供支持，它是历史上第一个Linux namespace，所以它的标识位比较特殊，就是CLONE_NEWNS。隔离后，不同mount namespace中的文件结构发生变化也互不影响。可以通过/proc/[pid]/mounts查看到所有挂载在当前namespace中的文件系统，还可以通过/proc/[pid]/mountstats看到mount namespace中文件设备的统计信息，包括挂载文件的名字、文件系统类型、挂载位置等等。

进程在创建mount namespace时，会把当前的文件结构复制给新的namespace。新namespace中的所有mount操作都只影响自身的文件系统，而对外界不会产生任何影响。这样做非常严格地实现了隔离，但是某些情况可能并不适用。比如父节点namespace中的进程挂载了一张CD-ROM，这时子节点namespace拷贝的目录结构就无法自动挂载上这张CD-ROM，因为这种操作会影响到父节点的文件系统。

2006 年引入的挂载传播（mount propagation）解决了这个问题，挂载传播定义了挂载对象（mount object）之间的关系，系统用这些关系决定任何挂载对象中的挂载事件如何传播到其他挂载对象参考自：http://www.ibm.com/developerworks/library/l-mount-namespaces/。 所谓传播事件，是指由一个挂载对象的状态变化导致的其它挂载对象的挂载与解除挂载动作的事件。

- 共享关系（share relationship）。如果两个挂载对象具有共享关系，那么一个挂载对象中的挂载事件会传播到另一个挂载对象，反之亦然。
- 从属关系（slave relationship）。如果两个挂载对象形成从属关系，那么一个挂载对象中的挂载事件会传播到另一个挂载对象，但是反过来不行；在这种关系中，从属对象是事件的接收者。

一个挂载状态可能为如下的其中一种：

- 共享挂载（shared）
- 从属挂载（slave）
- 共享/从属挂载（shared and slave）
- 私有挂载（private）
- 不可绑定挂载（unbindable）

传播事件的挂载对象称为共享挂载（shared mount）；接收传播事件的挂载对象称为从属挂载（slave mount）。既不传播也不接收传播事件的挂载对象称为私有挂载（private mount）。另一种特殊的挂载对象称为不可绑定的挂载（unbindable mount），它们与私有挂载相似，但是不允许执行绑定挂载，即创建mount namespace时这块文件对象不可被复制。

![mount各类挂载状态示意图](/images/Linux-Namespace/mount各类挂载状态示意图.png)

共享挂载的应用场景非常明显，就是为了文件数据的共享所必须存在的一种挂载方式；从属挂载更大的意义在于某些“只读”场景；私有挂载其实就是纯粹的隔离，作为一个独立的个体而存在；不可绑定挂载则有助于防止没有必要的文件拷贝，如某个用户数据目录，当根目录被递归式的复制时，用户目录无论从隐私还是实际用途考虑都需要有一个不可被复制的选项。

默认情况下，所有挂载都是私有的。

```shell
/*设置为共享挂载。从共享挂载克隆的挂载对象也是共享的挂载；它们相互传播挂载事件。*/
# mount --make-shared <mount-object>
/*设置为从属挂载。从从属挂载克隆的挂载对象也是从属的挂载，它也从属于原来的从属挂载的主挂载对象。*/
# mount --make-slave <shared-mount-object>
/*将一个从属挂载对象设置为共享/从属挂载，可以执行如下命令或者将其移动到一个共享挂载对象下。*/
# mount --make-shared <slave-mount-object>
/*把修改过的挂载对象重新标记为私有的。*/
# mount --make-private <mount-object>
/*将挂载对象标记为不可绑定的。*/
# mount --make-unbindable <mount-object>
```

这些设置都可以递归式地应用到所有子目录中，可搜索到相关的命令进行深入。

修改上面的代码：

```c
//[...]
int container_main(void* arg)
  //[...]
  system("mount -t proc proc /proc");
  execv(container_args[0], container_args);
//[...]
int child_pid = clone(child_main, child_stack+STACK_SIZE, 
                      CLONE_NEWUTS | CLONE_NEWPID | CLONE_NEWNS | SIGCHLD, NULL);
//[...]
```

在子namespace中，能看到挂载，而在父空间中无挂载。在父空间执行'mount -t proc proc /proc'即可恢复。

## Network namespace

Network namespace主要提供了关于网络资源的隔离，包括网络设备、IPv4和IPv6协议栈、IP路由表、防火墙、/proc/net目录、/sys/class/net目录、端口（socket）等等。一个物理的网络设备最多存在在一个network namespace中，你可以通过创建veth pair（虚拟网络设备对：有两端，类似管道，如果数据从一端传入另一端也能接收到，反之亦然）在不同的network namespace间创建通道，以此达到通信的目的。

一般情况下，物理网络设备都分配在最初的root namespace中。但是如果你有多块物理网卡，也可以把其中一块或多块分配给新创建的network namespace。需要注意的是，当新创建的network namespace被释放时（所有内部的进程都终止并且namespace文件没有被挂载或打开），在这个namespace中的物理网卡会返回到root namespace而非创建该进程的父进程所在的network namespace。

为了使新创建的namespace与外部进行网络通信，经典做法就是创建一个veth pair，一端放置在新的namespace中，一端放在另一个namespace中连接物理网络设备，再通过网桥把别的设备连接进来或者进行路由转发，以此网络实现通信的目的。

对network namespace的使用其实就是在创建的时候添加`CLONE_NEWNET`标识位。可以通过命令行工具`ip`创建network namespace。

```shell
# ip netns add <network namespace name>	// 创建net namespace
# ip netns [list]							// 显示当前所有net namespace
# ip netns delete <network namespace name>	// 删除net namespace
# ip netns exec <network namespace name> <command>	// 在net namespace中执行命令
当然，你也可以进入net namespace
# ip netns exec <network namespace name> bash
之后可以在其中执行命令
```

下面开始执行如下命令：

```shell
# ip netns add test_ns
# ip netns exec test_ns ip addr
1: lo: <LOOPBACK> mtu 65536 qdisc noop state DOWN qlen 1
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
```

当`ip`命令工具创建一个network namespace时，会默认创建一个回环设备（loopback interface：`lo`），并在`/var/run/netns`目录下绑定一个挂载点，这就保证了就算network namespace中没有进程在运行也不会被释放，也给系统管理员对新创建的network namespace进行配置提供了充足的时间。

在新创建的namespace中，lo接口状态是'DOWN'的，因此，第一个任务应该是把它启动。

```shell
# ip netns exec test_ns ip link set dev lo up
# ip netns exec test_ns ip addr
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN qlen 1
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
# ip link add veth0 type veth peer name veth1
# ip link set veth1 netns test_ns
# ip netns exec test_ns ifconfig veth1 10.1.1.1/24 up
# ifconfig veth0 10.1.1.2/24 up
```

通过ping命令进行测试：

```shell
# ping 10.1.1.1
PING 10.1.1.1 (10.1.1.1) 56(84) bytes of data.
64 bytes from 10.1.1.1: icmp_seq=1 ttl=64 time=0.048 ms
……
[root@pro4-node ~]# ip netns exec test_ns ping 10.1.1.2
PING 10.1.1.2 (10.1.1.2) 56(84) bytes of data.
64 bytes from 10.1.1.2: icmp_seq=1 ttl=64 time=0.040 ms
………
```

通信正常。

net namespace实现了在同一设备内部虚拟出多个网络设备，极大利用了现有设备性能。

## User namespaces

User namespace主要隔离了安全相关的标识符（identifiers）和属性（attributes），包括用户ID、用户组ID、root目录、[key](http://man7.org/linux/man-pages/man2/keyctl.2.html)（指密钥）以及[特殊权限](http://man7.org/linux/man-pages/man7/capabilities.7.html)。说得通俗一点，一个普通用户的进程通过`clone()`创建的新进程在新user namespace中可以拥有不同的用户和用户组。

User namespace是目前的六个namespace中最后一个支持的，并且直到Linux内核3.8版本的时候还未完全实现（还有部分文件系统不支持）。因为user namespace实际上并不算完全成熟，很多发行版担心安全问题，在编译内核的时候并未开启`USER_NS`。所以在进行接下来的代码实验时，请确保你系统的Linux内核版本高于3.8并且内核编译时开启了`USER_NS`。

Linux中，特权用户的user ID就是0，演示的最终我们将看到user ID非0的进程启动user namespace后user ID可以变为0。使用user namespace的方法跟别的namespace相同，即调用`clone()`或`unshare()`时加入`CLONE_NEWUSER`标识位。为了看到用户[权限(Capabilities)](http://man7.org/linux/man-pages/man7/capabilities.7.html)，可能还需要安装一下`libcap-dev`包。

头文件以调用`Capabilities`包。

```c
#include <sys/capability.h>
```

在子进程函数中加入`geteuid()`和`getegid()`得到namespace内部的user ID，其次通过`cap_get_proc()`得到当前进程的用户拥有的权限，并通过`cap_to_text（）`输出。

```c
int child_main(void* args) {
        printf("在子进程中!\n");
        cap_t caps;
        printf("eUID = %ld;  eGID = %ld;  ",
                        (long) geteuid(), (long) getegid());
        caps = cap_get_proc();
        printf("capabilities: %s\n", cap_to_text(caps, NULL));
        execv(child_args[0], child_args);
        return 1;
}
```

在主函数的`clone()`调用中加入`CLONE_NEWUSER `标识符。

```c
//[...]
int child_pid = clone(child_main, child_stack+STACK_SIZE, CLONE_NEWUSER | SIGCHLD, NULL);
//[...]
```

```shell
#当前的user id 和 group id
stack@ubuntu:~$ id
uid=1000(stack) gid=1000(stack) groups=1000(stack)
#非root 用户
stack@ubuntu:~$ ./uts 
程序开始: 
在子进程中!
eUID = 65534;  eGID = 65534;  capabilities: = cap_chown,cap_dac_override,cap_dac_read_search,cap_fowner,cap_fsetid,cap_kill,cap_setgid,cap_setuid,cap_setpcap,cap_linux_immutable,cap_net_bind_service,cap_net_broadcast,cap_net_admin,cap_net_raw,cap_ipc_lock,cap_ipc_owner,cap_sys_module,cap_sys_rawio,cap_sys_chroot,cap_sys_ptrace,cap_sys_pacct,cap_sys_admin,cap_sys_boot,cap_sys_nice,cap_sys_resource,cap_sys_time,cap_sys_tty_config,cap_mknod,cap_lease,cap_audit_write,cap_audit_control,cap_setfcap,cap_mac_override,cap_mac_admin,cap_syslog,cap_wake_alarm,cap_block_suspend,37+ep
nobody@ubuntu:~$ 
```

- user namespace被创建后，第一个进程被赋予了该namespace中的全部权限，这样这个init进程就可以完成所有必要的初始化工作，而不会因权限不足而出现错误。
- namespace内部看到的UID和GID已经与外部不同了，默认显示为65534，表示尚未与外部namespace用户映射。需要对user namespace内部的这个初始user和其外部namespace某个用户建立映射，这样可以保证当涉及到一些对外部namespace的操作时，系统可以检验其权限（比如发送一个信号量或操作某个文件）。同样用户组也要建立映射。
- 还有一点虽然不能从输出中看出来，但是值得注意。用户在新namespace中有全部权限，但是在创建它的父namespace中不含任何权限。就算调用和创建它的进程有全部权限也是如此。所以哪怕是root用户调用了clone()在user namespace中创建出的新用户在外部也没有任何权限。
- user namespace的创建其实是一个层层嵌套的树状结构。最上层的根节点就是root namespace，新创建的每个user namespace都有一个父节点user namespace以及零个或多个子节点user namespace，这一点与PID namespace非常相似。

接下来我们就要进行用户绑定（映射）操作，通过在`/proc/[pid]/uid_map`和`/proc/[pid]/gid_map`两个文件中写入对应的绑定信息可以实现这一点，格式如下：

```shell
ID-inside-ns   ID-outside-ns   length
```

写这两个文件需要注意以下几点。

- 这两个文件只允许由拥有该user namespace中`CAP_SETUID`和`CAP_SETGID`权限的进程**写入一次，但可以一次写多条，并且最多只能5条，不允许修改。**
- 写入的进程必须是该user namespace的父namespace或者子namespace。
- 第一个字段`ID-inside-ns`表示新建的user namespace中对应的user/group ID，第二个字段`ID-outside-ns`表示namespace外部映射的user/group ID。最后一个字段表示映射范围，通常填1，表示只映射一个，如果填大于1的值，则按顺序建立一一映射。

```c
#define _GNU_SOURCE
#include <sys/types.h>
#include <sys/wait.h>
#include <stdio.h>
#include <stdlib.h>
#include <sched.h>
#include <signal.h>
#include <unistd.h>
#include <sys/capability.h>

#define STACK_SIZE (1024 * 1024)

static char child_stack[STACK_SIZE];
char* const child_args[] = {
  "/bin/bash",
  NULL
};

int pipefd[2];

void set_map(char* file, int inside_id, int outside_id, int len) {
    FILE* mapfd = fopen(file, "w+");
    if (NULL == mapfd) {
        printf("open file [%s] error.\n",file);
        return;
    }
    fprintf(mapfd, "%d %d %d", inside_id, outside_id, len);
    fclose(mapfd);
}

void set_uid_map(pid_t pid, int inside_id, int outside_id, int len) {
    char file[256];
    sprintf(file, "/proc/%d/uid_map", pid);
    set_map(file, inside_id, outside_id, len);
}
 
void set_gid_map(pid_t pid, int inside_id, int outside_id, int len) {
    char file[256];
    sprintf(file, "/proc/%d/gid_map", pid);
    set_map(file, inside_id, outside_id, len);
}


int child_main(void* args) {
    printf("在子进程中!\n");
    printf("eUID = %ld;  eGID = %ld, UID=%ld, GID=%ld\n",
               (long) geteuid(), (long) getegid(), (long) getuid(), (long) getgid());

    /* 等待父进程通知后再往下执行（进程间的同步） */
    char ch;
    close(pipefd[1]);
    read(pipefd[0], &ch, 1);
    execv(child_args[0], child_args);
    return 1;
}

int main() {
  const int gid=getgid(), uid=getuid();
  printf("程序开始: \n");
  printf("Parent: eUID = %ld;  eGID = %ld, UID=%ld, GID=%ld\n",
            (long) geteuid(), (long) getegid(), (long) getuid(), (long) getgid());

  pipe(pipefd);
  int child_pid = clone(child_main, child_stack+STACK_SIZE, CLONE_NEWUSER | SIGCHLD, NULL);

  set_uid_map(child_pid, 0, uid, 1);
  set_gid_map(child_pid, 0, gid, 1);

  /* 通知子进程 */
  close(pipefd[1]);
  waitpid(child_pid, NULL, 0);
  printf("已退出\n");
  return 0;
}
```

编译并运行后即可看到user已经变成了`root`。

```shell
stack@ubuntu:~$ gcc userns.c -Wall -lcap -o userns && ./userns
程序开始: 
Parent: eUID = 1000;  eGID = 1000, UID=1000, GID=1000
在子进程中!
eUID = 0;  eGID = 65534, UID=0, GID=65534
root@ubuntu:~# id
uid=0(root) gid=65534(nogroup) groups=65534(nogroup)
root@ubuntu:~# 
```

gid一直没有变过来，调试发现文件已经创建且写入函数返回值正确，这个问题有时间再调试吧。

至此，关于几个namespace的介绍已简单完成。

## Linux源码分析

基于kernel 3.10.105分析。

以上的实例大多基于`clone`来创建新的namespace，因此对namespace的分析基本就是分析`clone`函数有关namespace的部分。内核中`clone`实际也是调用的`do_fork`。

直接进入`copy_process`分析。

```C
static struct task_struct *copy_process(unsigned long clone_flags,
					unsigned long stack_start,
					unsigned long stack_size,
					int __user *child_tidptr,
					struct pid *pid,
					int trace)
{
  	int retval;
	struct task_struct *p;
	……
    retval = -ENOMEM;
	p = dup_task_struct(current);
  	……
    /*CLONE_NEWUSER 相关*/
	retval = copy_creds(p, clone_flags);
	if (retval < 0)
		goto bad_fork_free;
	……
    /*另外5个 namespace flag*/
	retval = copy_namespaces(clone_flags, p);
	if (retval)
		goto bad_fork_cleanup_mm;
  	……
}
```

### copy_creds

`copy_creds`的作用是复制或创建凭证信息。

```c
int copy_creds(struct task_struct *p, unsigned long clone_flags)
{
	struct cred *new;
	int ret;
	……
    /*以current为模块，创建新的cred*/
	new = prepare_creds();
	if (!new)
		return -ENOMEM;

	if (clone_flags & CLONE_NEWUSER) {
		ret = create_user_ns(new);
		if (ret < 0)
			goto error_put;
	}
  	……
}
```

```c
int create_user_ns(struct cred *new)
{
  	/*parent_ns 为父进程的user namespace(一路copy)*/
	struct user_namespace *ns, *parent_ns = new->user_ns;
	kuid_t owner = new->euid;
	kgid_t group = new->egid;
	int ret;

	if (parent_ns->level > 32)
		return -EUSERS;

	/*判断当前进程文件系统和命名空间的 挂载点、根目录项对象是否相同。相同返回0*/
	if (current_chrooted())
		return -EPERM;
	/*创建者需要在父用户名空间中进行映射，否则我们将无法合理地告知创建user_namespace的用户空间。*/
	if (!kuid_has_mapping(parent_ns, owner) ||
	    !kgid_has_mapping(parent_ns, group))
		return -EPERM;
  	/*slab层快速获取user namespace空间*/
	ns = kmem_cache_zalloc(user_ns_cachep, GFP_KERNEL);
	if (!ns)
		return -ENOMEM;
	/*分配INODE number*/
	ret = proc_alloc_inum(&ns->proc_inum);
	if (ret) {
		kmem_cache_free(user_ns_cachep, ns);
		return ret;
	}
	/*初始化ns数据*/
	atomic_set(&ns->count, 1);
	/* Leave the new->user_ns reference with the new user namespace. */
	ns->parent = parent_ns;
	ns->level = parent_ns->level + 1;
	ns->owner = owner;
	ns->group = group;

	/* Inherit USERNS_SETGROUPS_ALLOWED from our parent */
	mutex_lock(&userns_state_mutex);
	ns->flags = parent_ns->flags;
	mutex_unlock(&userns_state_mutex);
	/*使用与init相同的功能*/
	set_cred_user_ns(new, ns);
	/*更新挂载规则*/
	update_mnt_policy(ns);
	return 0;
}
```

### copy_namespaces

核心结构`nsproxy`

```c
struct nsproxy {
	atomic_t count;
	struct uts_namespace *uts_ns;
	struct ipc_namespace *ipc_ns;
	struct mnt_namespace *mnt_ns;
	struct pid_namespace *pid_ns;
	struct net 	     *net_ns;
};
```

```c
int copy_namespaces(unsigned long flags, struct task_struct *tsk)
{
	struct nsproxy *old_ns = tsk->nsproxy;
  	/*获取任务的客观上下文。
  	task_struct 中有两个上下文(context)：
  		real_cred，客观上下文，当其他一些任务试图影响这个部分的时候，就会使用这些部分。
  		cred，主观上下文，一般在任务作用于另一个对象时使用，是文件，任务，键或其他。
  	通常，这两个指针相同。具体细节可参考 struct cred结构(include/linux/cred.h)*/
	struct user_namespace *user_ns = task_cred_xxx(tsk, user_ns);
	struct nsproxy *new_ns;
	int err = 0;

	if (!old_ns)
		return 0;
	/*inc计数*/
	get_nsproxy(old_ns);

	if (!(flags & (CLONE_NEWNS | CLONE_NEWUTS | CLONE_NEWIPC |
				CLONE_NEWPID | CLONE_NEWNET)))
		return 0;

	if (!ns_capable(user_ns, CAP_SYS_ADMIN)) {
		err = -EPERM;
		goto out;
	}

	/* CLONE_NEWIPC，旧的IPC namespace中的信号量无法访问；
	   但是，CLONE_SYSVSEM 会共享父级信号量。 
	 */
	if ((flags & CLONE_NEWIPC) && (flags & CLONE_SYSVSEM)) {
		err = -EINVAL;
		goto out;
	}
	/*为进程创建新的相关namespace*/
	new_ns = create_new_namespaces(flags, tsk, user_ns, tsk->fs);
	if (IS_ERR(new_ns)) {
		err = PTR_ERR(new_ns);
		goto out;
	}
	tsk->nsproxy = new_ns;

out:
	put_nsproxy(old_ns);
	return err;
}
```

```c
/*nsproxy 结构主要分配函数*/
static struct nsproxy *create_new_namespaces(unsigned long flags,
	struct task_struct *tsk, struct user_namespace *user_ns,
	struct fs_struct *new_fs)
{
	struct nsproxy *new_nsp;
	int err;
	/*从slab层分配空间*/
	new_nsp = create_nsproxy();
	if (!new_nsp)
		return ERR_PTR(-ENOMEM);
	/*MNT namespace 拷贝（分配、初始化）*/
	new_nsp->mnt_ns = copy_mnt_ns(flags, tsk->nsproxy->mnt_ns, user_ns, new_fs);
	if (IS_ERR(new_nsp->mnt_ns)) {
		err = PTR_ERR(new_nsp->mnt_ns);
		goto out_ns;
	}
  	/*UTS namespace 拷贝（分配、初始化）*/
	new_nsp->uts_ns = copy_utsname(flags, user_ns, tsk->nsproxy->uts_ns);
	if (IS_ERR(new_nsp->uts_ns)) {
		err = PTR_ERR(new_nsp->uts_ns);
		goto out_uts;
	}
	/*IPC namespace 拷贝（分配、初始化）*/
	new_nsp->ipc_ns = copy_ipcs(flags, user_ns, tsk->nsproxy->ipc_ns);
	if (IS_ERR(new_nsp->ipc_ns)) {
		err = PTR_ERR(new_nsp->ipc_ns);
		goto out_ipc;
	}
	/*PID namespace 拷贝（分配、初始化）*/
	new_nsp->pid_ns = copy_pid_ns(flags, user_ns, tsk->nsproxy->pid_ns);
	if (IS_ERR(new_nsp->pid_ns)) {
		err = PTR_ERR(new_nsp->pid_ns);
		goto out_pid;
	}
	/*NET namespace 拷贝（分配、初始化）*/
	new_nsp->net_ns = copy_net_ns(flags, user_ns, tsk->nsproxy->net_ns);
	if (IS_ERR(new_nsp->net_ns)) {
		err = PTR_ERR(new_nsp->net_ns);
		goto out_net;
	}
	return new_nsp;
  	……
}
```

#### copy_mnt_ns

```c
struct mnt_namespace *copy_mnt_ns(unsigned long flags, struct mnt_namespace *ns,
		struct user_namespace *user_ns, struct fs_struct *new_fs)
{
	struct mnt_namespace *new_ns;

	BUG_ON(!ns);
  	/*原子增计数*/
	get_mnt_ns(ns);

	if (!(flags & CLONE_NEWNS))
		return ns;

	new_ns = dup_mnt_ns(ns, user_ns, new_fs);
	/*原子减计数*/
	put_mnt_ns(ns);
	return new_ns;
}
```

```c
/*分配一个新的名称空间结构，并使用从传入的任务结构的名称空间复制的内容填充它。*/
static struct mnt_namespace *dup_mnt_ns(struct mnt_namespace *mnt_ns,
		struct user_namespace *user_ns, struct fs_struct *fs)
{
	struct mnt_namespace *new_ns;
	struct vfsmount *rootmnt = NULL, *pwdmnt = NULL;
	struct mount *p, *q;
	struct mount *old = mnt_ns->root;
	struct mount *new;
	int copy_flags;
	/*分配新的mnt_namespace并进行初始化*/
	new_ns = alloc_mnt_ns(user_ns);
	if (IS_ERR(new_ns))
		return new_ns;
	/*加锁读写信号量namespace_sem*/
	namespace_lock();
	/* 复制mnt树形拓扑 */
	copy_flags = CL_COPY_ALL | CL_EXPIRE;
	if (user_ns != mnt_ns->user_ns)
		copy_flags |= CL_SHARED_TO_SLAVE | CL_UNPRIVILEGED;
  	/*主要函数，暂不分析。TBD*/
	new = copy_tree(old, old->mnt.mnt_root, copy_flags);
	if (IS_ERR(new)) {
		namespace_unlock();
		free_mnt_ns(new_ns);
		return ERR_CAST(new);
	}
	new_ns->root = new;
	br_write_lock(&vfsmount_lock);
	list_add_tail(&new_ns->list, &new->mnt_list);
	br_write_unlock(&vfsmount_lock);

	/*切换tsk-> fs - > *元素并将新的vfsmount标记为属于新的命名空间。 
	我们已经获得了私有的fs_struct，所以不需要tsk-> fs-> lock。
	 */
	p = old;
	q = new;
	while (p) {
		q->mnt_ns = new_ns;
		if (fs) {
			if (&p->mnt == fs->root.mnt) {
				fs->root.mnt = mntget(&q->mnt);
				rootmnt = &p->mnt;
			}
			if (&p->mnt == fs->pwd.mnt) {
				fs->pwd.mnt = mntget(&q->mnt);
				pwdmnt = &p->mnt;
			}
		}
		p = next_mnt(p, old);
		q = next_mnt(q, new);
	}
	namespace_unlock();

	if (rootmnt)
		mntput(rootmnt);
	if (pwdmnt)
		mntput(pwdmnt);

	return new_ns;
}
```

#### copy_utsname

```c
struct uts_namespace *copy_utsname(unsigned long flags,
	struct user_namespace *user_ns, struct uts_namespace *old_ns)
{
	struct uts_namespace *new_ns;

	BUG_ON(!old_ns);
	get_uts_ns(old_ns);

	if (!(flags & CLONE_NEWUTS))
		return old_ns;

	new_ns = clone_uts_ns(user_ns, old_ns);

	put_uts_ns(old_ns);
	return new_ns;
}
```

```c
static struct uts_namespace *clone_uts_ns(struct user_namespace *user_ns,
					  struct uts_namespace *old_ns)
{
	struct uts_namespace *ns;
	int err;
	/*分配空间*/
	ns = create_uts_ns();
	if (!ns)
		return ERR_PTR(-ENOMEM);
	/*分配新的inode number*/
	err = proc_alloc_inum(&ns->proc_inum);
	if (err) {
		kfree(ns);
		return ERR_PTR(err);
	}

	down_read(&uts_sem);
	memcpy(&ns->name, &old_ns->name, sizeof(ns->name));
	ns->user_ns = get_user_ns(user_ns);
	up_read(&uts_sem);
	return ns;
}
```

#### copy_ipcs

```c
struct ipc_namespace *copy_ipcs(unsigned long flags,
	struct user_namespace *user_ns, struct ipc_namespace *ns)
{
	if (!(flags & CLONE_NEWIPC))
		return get_ipc_ns(ns);
	return create_ipc_ns(user_ns, ns);
}
```

```c

static struct ipc_namespace *create_ipc_ns(struct user_namespace *user_ns,
					   struct ipc_namespace *old_ns)
{
	struct ipc_namespace *ns;
	int err;

	ns = kmalloc(sizeof(struct ipc_namespace), GFP_KERNEL);
	if (ns == NULL)
		return ERR_PTR(-ENOMEM);

	err = proc_alloc_inum(&ns->proc_inum);
	if (err) {
		kfree(ns);
		return ERR_PTR(err);
	}

	atomic_set(&ns->count, 1);
  	/*消息队列初始化*/
	err = mq_init_ns(ns);
	if (err) {
		proc_free_inum(ns->proc_inum);
		kfree(ns);
		return ERR_PTR(err);
	}
	atomic_inc(&nr_ipc_ns);
	/*信号量初始化*/
	sem_init_ns(ns);
  	/*信号初始化？TBD*/
	msg_init_ns(ns);
  	/*共享内存初始化*/
	shm_init_ns(ns);

	/*IPC 创建通知*/
	ipcns_notify(IPCNS_CREATED);
	register_ipcns_notifier(ns);

	ns->user_ns = get_user_ns(user_ns);
	return ns;
}
```

#### copy_pid_ns

```c
struct pid_namespace *copy_pid_ns(unsigned long flags,
	struct user_namespace *user_ns, struct pid_namespace *old_ns)
{
	if (!(flags & CLONE_NEWPID))
		return get_pid_ns(old_ns);
  	/*当前pid namespace不是old_ns（之前copy的current），可能已经发生了进程切换*/
	if (task_active_pid_ns(current) != old_ns)
		return ERR_PTR(-EINVAL);
	return create_pid_namespace(user_ns, old_ns);
}
```

```c
static struct pid_namespace *create_pid_namespace(struct user_namespace *user_ns,
	struct pid_namespace *parent_pid_ns)
{
	struct pid_namespace *ns;
	unsigned int level = parent_pid_ns->level + 1;
	int i;
	int err;

	if (level > MAX_PID_NS_LEVEL) {
		err = -EINVAL;
		goto out;
	}

	err = -ENOMEM;
	ns = kmem_cache_zalloc(pid_ns_cachep, GFP_KERNEL);
	if (ns == NULL)
		goto out;

	ns->pidmap[0].page = kzalloc(PAGE_SIZE, GFP_KERNEL);
	if (!ns->pidmap[0].page)
		goto out_free;

	ns->pid_cachep = create_pid_cachep(level + 1);
	if (ns->pid_cachep == NULL)
		goto out_free_map;

	err = proc_alloc_inum(&ns->proc_inum);
	if (err)
		goto out_free_map;

	kref_init(&ns->kref);
	ns->level = level;
	ns->parent = get_pid_ns(parent_pid_ns);
	ns->user_ns = get_user_ns(user_ns);
	ns->nr_hashed = PIDNS_HASH_ADDING;
	INIT_WORK(&ns->proc_work, proc_cleanup_work);

	set_bit(0, ns->pidmap[0].page);
	atomic_set(&ns->pidmap[0].nr_free, BITS_PER_PAGE - 1);

	for (i = 1; i < PIDMAP_ENTRIES; i++)
		atomic_set(&ns->pidmap[i].nr_free, BITS_PER_PAGE);

	return ns;

out_free_map:
	kfree(ns->pidmap[0].page);
out_free:
	kmem_cache_free(pid_ns_cachep, ns);
out:
	return ERR_PTR(err);
}
```

#### copy_net_ns

```C
struct net *copy_net_ns(unsigned long flags,
			struct user_namespace *user_ns, struct net *old_net)
{
	struct net *net;
	int rv;

	if (!(flags & CLONE_NEWNET))
		return get_net(old_net);
	/*分配新的net结构*/
	net = net_alloc();
	if (!net)
		return ERR_PTR(-ENOMEM);

	get_user_ns(user_ns);

	mutex_lock(&net_mutex);
	rv = setup_net(net, user_ns);
	if (rv == 0) {
		rtnl_lock();
		list_add_tail_rcu(&net->list, &net_namespace_list);
		rtnl_unlock();
	}
	mutex_unlock(&net_mutex);
	if (rv < 0) {
		put_user_ns(user_ns);
		net_drop_ns(net);
		return ERR_PTR(rv);
	}
	return net;
}
```



## 参考资料

[DOCKER背后的内核知识——NAMESPACE资源隔离](http://www.sel.zju.edu.cn/?p=556)

[Linux Kernel Namespace实现: namespace API介绍](http://blog.csdn.net/sdulibh/article/details/51698653)

[Linux Namespace和Cgroup](https://segmentfault.com/a/1190000009732550)

[DOCKER基础技术：LINUX NAMESPACE（上）](https://coolshell.cn/articles/17010.html)

[DOCKER基础技术：LINUX NAMESPACE（下）](https://coolshell.cn/articles/17029.html)

[how to find out namespace of a particular process?](https://unix.stackexchange.com/questions/113530/how-to-find-out-namespace-of-a-particular-process)