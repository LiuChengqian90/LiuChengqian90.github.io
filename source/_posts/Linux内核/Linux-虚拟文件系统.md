---
title: Linux 虚拟文件系统
date: 2017-11-22 20:09:46
categories: Linux内核
tags:
  - Linux
  - 文件系统
---

虚拟文件系统（VFS）作为内核子系统，为用户空间程序提供了文件和文件系统相关的接口。系统中所有文件系统不但依赖VFS共存，而且也依靠VFS系统协同工作。

VFS把各种不同的文件系统**抽象**后采用统一的方式进行操作。为了支持多文件系统，VFS提供了一个通用文件系统模型，该模型囊括了任何文件系统的常用功能集和行为。其定义了所有文件系统都支持的、基本的、概念上的接口和数据结构。

## Unix 文件系统

Unix使用了四种和文件系统相关的传统抽象概念：**文件、目录项、索引节点和安装节点（mount point）**。

从本质上讲，文件系统是特殊的数据分层存储结构，它包含文件、目录和相关的控制信息。在Unix中，文件系统被安装在一个特定的安装点上，该安装点在全局层次结构中被称作命名空间（Linux 将层次化概念引入到单个进程中，每个进程都指定一个唯一的命名空间。因为每个进程都会继承父进程的命名空间，所以所有进程往往都只有一个命名空间），所有已安装文件系统都作为根文件系统树的枝叶出现在系统中。

文件其实可以做一个有序字节串，第一个字节是文件的头，最后一个字节是文件的尾。每一个文件为了便于系统和用户识别，都被分配了一个便于理解的名字。

**文件通过目录组织起来**。文件目录好比一个文件夹，用来容纳相关文件。目录可以嵌套（包含其他目录），形成文件路径。路径中每一部分都被称作目录条目，统称为目录项（“/tmp/log/system”，根目录/，目录tmp、log和文件system都是目录条目）。在Unix中，**目录属于普通文件**。由于VFS把目录当做文件对待，所以可以对目录执行和文件相同的操作。

Unix系统将文件的**相关信息**和**文件本身**这两个概念加以区分，例如控制权限、大小、创建时间等信息。文件相关信息，也被称作文件的元数据，被存储在一个单独的数据结构——**索引节点**（inode，index node的缩写）。

这些信息和文件系统的控制信息密切相关，**文件系统的控制信息存储在超级块**——一种包含文件系统信息的数据结构。有时，把这些收集起来的信息称为**文件系统数据元**，它集单独文件信息和文件系统的信息于一身。

## VFS对象及其数据结构

VFS其实采用的是面向对象的设计思路，使用一组数据结构来代表通用文件对象。因为内核纯粹使用C代码实现，没有直接利用面向对象的语言，所以内核中的数据结构都使用C语言的结构体实现，而这些结构体包含数据的同时也包含操作这些数据的函数指针，其中的操作函数由具体文件系统实现。

VFS中有四个主要的对象类型，它们分别是：

- **超级块对象**，它代表一个具体的已安装文件系统。
- **索引节点对象**，它代表一个具体文件。
- **目录项对象**，它代表一个目录项，是路径的一个组成部分。
- **文件对象**，它代表由进程打开的文件。

注意，因为VFS将目录作为一个文件来处理，所以不存在目录对象。换句话说，目录项不同于目录，但目录却是另一种形式的文件。

每个主要对象中都包含一个**操作对象**，这些操作对象描述了内核针对主要对象可以使用的方法：

- **super_operations** 对象，其中包括内核针对特定文件系统所能调用的方法，比如write_inode()和sysc_fs()等方法。
- **inode_operations** 对象，其中包括内核针对特定文件所能调用的方法，比如create()和link()等方法。
- **dentry_operations** 对象，其中包括内核针对特定目录所能调用的方法，比如d_compare()和d_delete()等方法。
- **file_operations** 对象，其中包括进程针对己打开文件所能调用的方法，比如read()和write()等方法。


操作对象作为一个结构体指针来实现，此结构体中包含指向操作其父对象的函数指针。对于其中许多方法来说，可以继承使用VFS提供的通用函数，如果通用函数提供的基本功能无法满足需要，那么就必须使用实际文件系统的独有方法填充这些函数指针，使其指向文件系统实例。

再次提醒，我们这里所说的对象就是指结构体。

VFS使用了大量结构体对象，它所包括的对象远远多于上面提到的这几种主要对象。比如每个注册的文件系统都由file_system_type结构体来表示，它描述了文件系统及其性能；另外，每一个安装点也都用vfsmount结构体表示，它包含的是安装点的相关信息，如位置和安装标志等。

之后介绍两个与进程相关的结构体，它们描述了文件系统以及和进程相关的文件，分别是fs_struct结构体和file结构体。

## 超级块对象

各种文件系统都必须实现超级块对象，该对象用于存储文件系统的信息，通常对应于存放在磁盘特定扇区中的文件系统超级块或文件系统控制块。对于并非基于磁盘的文件系统（如基于内存的文件系统，比如sysfs），它们会在使用时创建超级块并将其保存到内存中。

超级块对象由super_block结构体表示

```c
struct super_block {
	struct list_head	s_list;		/*指向所有超级块的链表*/
	dev_t			s_dev;		/*设备标识符*/
	unsigned char		s_dirt;	/*修改标志*/
	unsigned char		s_blocksize_bits;	/*以位为单位的块大小*/
	unsigned long		s_blocksize;	/*以字节为单位的块大小*/
	loff_t			s_maxbytes;	/*文件大小上限*/
	struct file_system_type	*s_type;	/*文件系统类型*/
	const struct super_operations	*s_op;	/*超级块方法*/
	const struct dquot_operations	*dq_op;	/*磁盘限额方法*/
	const struct quotactl_ops	*s_qcop;	/*限额控制方法*/
	const struct export_operations *s_export_op;	/*导出方法*/
	unsigned long		s_flags;	/*挂载标志*/
	unsigned long		s_magic;	/*文件系统的幻数*/
	struct dentry		*s_root;	/*目录挂载点*/
	struct rw_semaphore	s_umount;	/*卸载信号量*/
	struct mutex		s_lock;	/*超级块信号量*/
	int			s_count;	/*超级块引用计数*/
	atomic_t		s_active;	/*活动引用计数*/
#ifdef CONFIG_SECURITY
	void                    *s_security;	/*安全模块*/
#endif
	const struct xattr_handler **s_xattr;	/*扩展的属性操作*/

	struct list_head	s_inodes;	/*索引节点对象列表*/
	struct hlist_head	s_anon;		/*匿名目录项*/
	struct list_head	s_files;	/*被分配的文件链表*/
	/* s_dentry_lru and s_nr_dentry_unused are protected by dcache_lock */
	struct list_head	s_dentry_lru;	/*未被使用目录项链表*/
	int			s_nr_dentry_unused;	/*链表中未使用目录项的数目*/

	struct block_device	*s_bdev;	/*相关的块设备*/
	struct backing_dev_info *s_bdi;	/*块设备信息*/
	struct mtd_info		*s_mtd;	/*存储磁盘信息*/
	struct list_head	s_instances;	/*该类型文件系统*/
	struct quota_info	s_dquot;	/*限额相关选项*/

	int			s_frozen;	/*frozen标志*/
	wait_queue_head_t	s_wait_unfrozen;	/*冻结的等待队列*/

	char s_id[32];				/*文本名*/
	void 			*s_fs_info;	/*文件系统特殊信息*/
	fmode_t			s_mode;	/*安装权限*/

	/* Granularity of c/m/atime in ns. Cannot be worse than a second */
	u32		   s_time_gran;	/*时间戳粒度*/
	/*
	 * The next field is for VFS *only*. No filesystems have any business
	 * even looking at it. You had been warned.
	 */
	struct mutex s_vfs_rename_mutex;	/*重命名信号量*/
	/*
	 * Filesystem subtype.  If non-empty the filesystem type field
	 * in /proc/mounts will be "type.subtype"
	 */
	char *s_subtype;	/*子类型名称*/
	/*
	 * Saved mount options for lazy filesystems using
	 * generic_show_options()
	 */
	char *s_options;	/*已安装选项*/
};
```

创建、管理和撤销超级块对象的代码位于文件<fs/super.c&gt;中。超级块对象通过alloc_super()函数创建并初始化。在文件系统安装时，文件系统会调用该函数以便从磁盘读取文件系统超级块，并将其信息填充到内存中的超级块对象中。

### 超级块操作

超级块对象中最重要的一个域是s_op，它指向超级块的操作函数表。

```c
struct super_operations {
  	/*在给定的超级块下创建和初始化一个新的索引节点对象*/
   	struct inode *(*alloc_inode)(struct super_block *sb);
  	/*释放给定的索引节点对象*/
	void (*destroy_inode)(struct inode *);
  	/*VFS在索引节点被修改（脏）时会调用此函数。日志文件系统（如ext3/ext4）执行该函数进行日志更新*/
   	void (*dirty_inode) (struct inode *);
  	/*用于将给定的索引节点写入磁盘，wbc表示写入时的控制信息*/
	int (*write_inode) (struct inode *, struct writeback_control *wbc);
  	/*最后一个索引节点的引用被释放后，VFS调用该函数*/
	void (*drop_inode) (struct inode *);
  	/*用于从磁盘上删除给定的索引节点对象*/
	void (*delete_inode) (struct inode *);
  	/*卸载文件系统时由VFS调用，用来释放超级块。s_lock进行保护*/
	void (*put_super) (struct super_block *);
  	/*用给定的超级块更新磁盘上的超级块。VFS通过此函数对内存中的超级块和磁盘中的超级块进行同步。s_lock进行保护*/
	void (*write_super) (struct super_block *);
  	/*使文件系统的数据元与磁盘上的文件系统同步。wait指定操作是否同步。*/
	int (*sync_fs)(struct super_block *sb, int wait);
  	/*禁止对文件系统做改变，之后使用给定的超级块更新磁盘上的超级块。LVM（逻辑卷标管理）会调用该函数*/
	int (*freeze_fs) (struct super_block *);
  	/*解除锁定*/
	int (*unfreeze_fs) (struct super_block *);
  	/*获取目录项对象状态信息*/
	int (*statfs) (struct dentry *, struct kstatfs *);
  	/*指定新的安装选项重新安装文件系统时，VFS调用此函数。s_lock进行保护*/
	int (*remount_fs) (struct super_block *, int *, char *);
  	/*释放索引节点，并清空包含相关数据的所有页面*/
	void (*clear_inode) (struct inode *);
  	/*VFS调用该函数中断安装操作。网络文件系统使用，如NFS*/
	void (*umount_begin) (struct super_block *);
	int (*show_options)(struct seq_file *, struct vfsmount *);
  	int (*show_stats)(struct seq_file *, struct vfsmount *);
#ifdef CONFIG_QUOTA
	ssize_t (*quota_read)(struct super_block *, int, char *, size_t, loff_t);
	ssize_t (*quota_write)(struct super_block *, int, const char *, size_t, loff_t);
#endif
	int (*bdev_try_to_free_page)(struct super_block*, struct page*, gfp_t);
};
```

该结构体中的每一项都是一个指向超级块操作函数的指针，超级块操作函数执行**文件系统和索引节点的底层操作**。其中的函数都是由VFS在进程上下文调用。除了dirty_inode()其他函数在必要时都可以阻塞。

## 索引节点对象

**索引节点对象包含了内核在操作文件或目录时需要的全部信息**。对于Unix风格的文件系统来说，这些信息可以从磁盘索引节点直接读入。没有索引节点的文件系统通常将文件的描述信息作为文件的一部分来存放。这些文件系统与Unix风格的文件系统不同，没有将数据与控制信息分开存放。有些现代文件系统使用数据库来存储文件的数据。不管哪种情况、采用哪种方式，索引节点对象必须在内存中创建，以便于文件系统使用。

索引节点对象由inode结构体表示

```c
struct inode {
	struct hlist_node	i_hash;	/*散列表*/
	struct list_head	i_list;		/*索引节点链表*/
	struct list_head	i_sb_list;	/*超级块链表*/
	struct list_head	i_dentry;	/*目录项链表*/
	unsigned long		i_ino;	/*索引号*/
	atomic_t		i_count;	/*引用计数*/
	unsigned int		i_nlink;	/*硬链接数*/
	uid_t			i_uid;	/*使用者 ID*/
	gid_t			i_gid;	/*组 ID*/
	dev_t			i_rdev;	/*实际设备标识符*/
	unsigned int		i_blkbits;	/*以位为单位的块大小*/
	u64			i_version;	/*版本号*/
	loff_t			i_size;	/*以字节为单位的块大小*/
#ifdef __NEED_I_SIZE_ORDERED
	seqcount_t		i_size_seqcount;	/*对i_size进行串行计数*/
#endif
	struct timespec		i_atime;	/*最后访问时间*/
	struct timespec		i_mtime;	/*最后修改时间*/
	struct timespec		i_ctime;	/*创建时间*/
	blkcnt_t		i_blocks;	/*文件的块数*/
	unsigned short          i_bytes;	/*文件的字节数*/
	umode_t			i_mode;	/*访问权限*/
	spinlock_t		i_lock;	/*自旋锁 i_blocks, i_bytes, maybe i_size */
	struct mutex		i_mutex;	/*互斥体*/
	struct rw_semaphore	i_alloc_sem;	/*信号量*/
	const struct inode_operations	*i_op;	/*索引节点操作表*/
	const struct file_operations	*i_fop;	/*缺省的索引节点操作 former ->i_op->default_file_ops */
	struct super_block	*i_sb;	/*相关的超级块*/
	struct file_lock	*i_flock;	/*文件锁链表*/
	struct address_space	*i_mapping;	/*相关的地址映射*/
	struct address_space	i_data;	/*设备地址映射*/
#ifdef CONFIG_QUOTA
	struct dquot		*i_dquot[MAXQUOTAS];	/*索引节点的磁盘限制*/
#endif
	struct list_head	i_devices;	/*块设备链表*/
	union {
		struct pipe_inode_info	*i_pipe;	/*管道信息*/
		struct block_device	*i_bdev;	/*块设备驱动*/
		struct cdev		*i_cdev;	/*字符设备驱动*/
	};
	__u32			i_generation;	/**/
#ifdef CONFIG_FSNOTIFY
	__u32			i_fsnotify_mask; /*目录通知掩码 all events this inode cares about */
	struct hlist_head	i_fsnotify_mark_entries; /* fsnotify mark entries */
#endif

#ifdef CONFIG_INOTIFY
	struct list_head	inotify_watches; /*索引节点通知监测链表 watches on this inode */
	struct mutex		inotify_mutex;	/*protects the watches list */
#endif

	unsigned long		i_state;	/*状态*/
	unsigned long		dirtied_when;	/*第一次弄脏数据的时间 jiffies of first dirtying */
	unsigned int		i_flags;	/*文件系统标志*/
	atomic_t		i_writecount;	/*写者计数*/
#ifdef CONFIG_SECURITY
	void			*i_security;	/*安全模块*/
#endif
#ifdef CONFIG_FS_POSIX_ACL
	struct posix_acl	*i_acl;
	struct posix_acl	*i_default_acl;
#endif
	void			*i_private; /*fs私有指针 fs or device private pointer */
};
```

一个索引节点代表文件系统中(索引节点仅当文件被访问时，才在内存中创建)的一个文件，它也可以是设备或管道这样的特殊文件。因此索引节点结构体中有一些和特殊文件相关的项，比如i_pipe项就指向一个代表有名管道的数据结构，i_bdev指向块设备结构体，i_cdev指向字符设备结构体。这三个指针被存放在一个公用体中，因为一个给定的索引节点每次只能表示三者之一(或三者均不)。

有时，某些文件系统可能并不能完整地包含索引节点结构体要求的所有信息。举个例子，有的文件系统可能并不记录文件的访问时间，这时，该文件系统就可以在实现中选择任意合适的办法来解决这个问题。它可以在i_atime中存储0，或者让i_atime等于i_mtime,或者只在内存中更新i_atime而不将其写回磁盘，或者由文件系统的实现者来决定。

### 索引节点操作

```c
struct inode_operations {
  	/*VFS通过系统调用create()和open()来调用该函数，从而为dentry对象创建一个新的索引节点*/
	int (*create) (struct inode *,struct dentry *,int, struct nameidata *);
  	/*在特定目录中寻找索引节点，该索引节点要对应于dentry中给出的文件名*/
	struct dentry * (*lookup) (struct inode *,struct dentry *, struct nameidata *);
  	/*被系统调用link()调用，用来创建硬连接。名称由最后一个参数指定，连接对象是inode目录中当一个参数（目录项）所代表的文件*/
	int (*link) (struct dentry *,struct inode *,struct dentry *);
  	/*系统调用unlink调用*/
	int (*unlink) (struct inode *,struct dentry *);
  	/*系统调用symlink，创建符号连接（软连接）*/
	int (*symlink) (struct inode *,struct dentry *,const char *);
  	/*系统调用mkdir()调用，创建一个新目录*/
	int (*mkdir) (struct inode *,struct dentry *,int);
  	/*系统调用rmdir()调用，删除一个目录*/
	int (*rmdir) (struct inode *,struct dentry *);
  	/*系统调用mknod()调用，创建特殊文件（设备文件、命名管道或套接字）*/
	int (*mknod) (struct inode *,struct dentry *,int,dev_t);
  	/*VFS调用该函数来移动文件。前两个参数是旧路径，后两个是新路径*/
	int (*rename) (struct inode *, struct dentry *,
			struct inode *, struct dentry *);
  	/*系统调用readlink()调用，拷贝数据到特定的缓冲buffer（char *）中。数据来自dentry指定的符号连接，大小为int*/
	int (*readlink) (struct dentry *, char __user *,int);
  	/*VFS调用，从一个符号连接查找它指向的索引节点。由dentry指向的连接被解析，其结果存放在nameidata结构体中*/
	void * (*follow_link) (struct dentry *, struct nameidata *);
  	/*follow_link调用之后，VFS调用put_link进行清除工作*/
	void (*put_link) (struct dentry *, struct nameidata *, void *);
  	/*VFS调用，修改文件的大小。调用前inode的i_size必须设置为预期的大小*/
	void (*truncate) (struct inode *);
  	/*检查给定的inode所代表的文件是否允许特定的访问模式。允许返回零，否则返回负值的错误码。*/
	int (*permission) (struct inode *, int);
	int (*check_acl)(struct inode *, int);
  	/*notify_change()调用，在修改索引节点后，通知发生了“改变事件”*/
	int (*setattr) (struct dentry *, struct iattr *);
  	/*通知索引节点需要从磁盘中更新时，VFS会调用该函数。扩展属性允许key/value这样的一对值与文件相关联*/
	int (*getattr) (struct vfsmount *mnt, struct dentry *, struct kstat *);
  	/*VFS调用，给dentry指定的文件设置扩展属性。属性名为第二个参数，值为第三个参数*/
	int (*setxattr) (struct dentry *, const char *,const void *,size_t,int);
  	/*VFS调用，获取给定文件的扩展属性（第二个参数）对应的数值*/
	ssize_t (*getxattr) (struct dentry *, const char *, void *, size_t);
  	/*将特定文件的所有属性列表拷贝到一个缓冲列表中*/
	ssize_t (*listxattr) (struct dentry *, char *, size_t);
  	/*从给定文件中删除指定的属性*/
	int (*removexattr) (struct dentry *, const char *);
	void (*truncate_range)(struct inode *, loff_t, loff_t);
	long (*fallocate)(struct inode *inode, int mode, loff_t offset,
			  loff_t len);
	int (*fiemap)(struct inode *, struct fiemap_extent_info *, u64 start,
		      u64 len);
};
```

## 目录项对象

VFS把目录当作文件对待，所以在路径/bin/vi中，bin和vi都属于文件——bin是特殊的目录文件而vi是一个普通文件，**路径中的每个组成部分都由一个索引节点对象表示**。虽然它们可以统一由索引节点表示，但是VFS经常需要执行目录相关的操作，比如路径名查找等。路径名查找需要解析路径中的每一个组成部分，不但要确保它有效，而且还需要再进一步寻找路径中的下一个部分。

**为了方便查找操作，VFS引入了目录项的概念**。每个dentry代表路径中的一个特定部分。对前一个例子来说，/、bin和vi，都属于目录项对象。前两个是目录，最后一个是普通文件。必须明确一点:在路径中(包括普通文件在内)，每一个部分都是目录项对象。解析一个路径并遍历其分量绝非简单的演练，它是耗时的、常规的字符串比较过程，执行耗时、代码繁琐。目录项对象的引入使得这个过程更加简单。

目录项也可包括安装点。在路径/mnt/cdorm/foo中，构成元素/、mnt、cdorm和foo都属于目录项对象。VFS在执行目录操作时(如果需要的话)会现场创建目录项对象。

目录项对象由dentry结构体表示，定义在文件<linux/dcache.h&gt;中。

```c
struct dentry {
	atomic_t d_count;	/*使用计数*/
	unsigned int d_flags;		/*目录项标识 protected by d_lock */
	spinlock_t d_lock;		/*单目录项锁 per dentry lock */
	int d_mounted;	/*是否挂载*/
	struct inode *d_inode;		/*相关联的索引节点 Where the name belongs to - NULL is	 * negative */
	/*
	 * The next three fields are touched by __d_lookup.  Place them here
	 * so they all fit in a cache line.
	 */
	struct hlist_node d_hash;	/*散列表 lookup hash list */
	struct dentry *d_parent;	/*父目录的目录项对象 parent directory */
	struct qstr d_name;	/*目录项名称*/
	struct list_head d_lru;		/*未使用的链表 LRU list */
	/*
	 * d_child and d_rcu can share memory
	 */
	union {
		struct list_head d_child;	/*目录项内部形成的链表 child of parent list */
	 	struct rcu_head d_rcu;	/*rcu加锁*/
	} d_u;
	struct list_head d_subdirs;	/*子目录链表 our children */
	struct list_head d_alias;	/*索引节点别名链表 inode alias list */
	unsigned long d_time;		/*重置时间 used by d_revalidate */
	const struct dentry_operations *d_op;	/*目录项操作指针*/
	struct super_block *d_sb;	/*文件的超级块 The root of the dentry tree */
	void *d_fsdata;			/*文件系统特有数据 fs-specific data */
	unsigned char d_iname[DNAME_INLINE_LEN_MIN];	/*短文件名 small names */
};
```

与前面的两个对象不同，目录项对象没有对应的磁盘数据结构，VFS根据字符串形式的路径名现场创建它。而且由于目录项对象并非真正保存在磁盘上，所以目录项结构体没有是非被修改的标志。

### 目录项状态

目录项对象有三种有效状态：**被使用、未被使用和负状态**。

一个被使用的目录项对应一个有效的索引节点(即d_inode指向相应的索引节点)并且表明该对象存在一个或多个使用者(即d_count为正值)。一个目录项处于被使用状态，意味着它正被VFS使用并且指向有效的数据，因此不能被丢弃。

一个未被使用的目录项对应一个有效的索引节点，但是应指明VFS当前并未使用它(d_count为0)。该目录项对象仍然指向一个有效对象，而且被保留在缓存中以便需要时再使用它。由于该目录项不会过早地被撤销，所以以后再需要它时，不必重新创建，与未缓存的目录项相比，这样使路径查找更迅速。但如果要回收内存的话，可以撤销未使用的目录项。

一个负状态的目录项（无效目录项）。没有对应的有效索引节点（d_inode为NULL），因为索引节点已被删除了，或路径不再正确了，但是目录项仍然保留，以便快速解析以后的路径查询。

目录项对象释放后也可以保存到slab对象缓存中去。此时，任何VFS或文件系统代码都没有指向该目录项对象的有效引用。

### 目录项缓存

如果VFS层遍历路径名中所有的元素并将它们逐个地解析成目录项对象，还要到达最深层目录，将是一件非常费力的工作，会浪费大量的时间。所以内核将目录项对象缓存在**目录项缓存(简称dcache**)中。

目录项缓存包括两个主要部分：

- “被使用的”目录项链表。该链表通过索引节点对象中的i_dentry项连接相关的索引节点，因为一个给定的索引节点可能有多个链接，所以就可能有多个目录项对象，因此用一个链表来连接它们。
- “最近被使用的”双向链表。该链表含有未被使用的和负状态的日录项对象。由于该链总是在头部插入目录项，所以链头节点的数据总比链尾的数据要新。当内核必须通过删除节点项回收内存时，会从链尾删除节点项，因为尾部的节点最旧，所以它们在近期内再次被使用的可能性最小。

散列表和相应的散列函数用来快速地将给定路径解析为相关目录项对象。

散列表由数组dentry_hashtable表示，其中每一个元素都是一个指向具有相同键值的目录项对象链表的指针。数组的大小取决于系统中物理内存的大小。

实际的散列值由d_hash()函数计算，它是内核提供给文件系统的唯一的一个散列函数。

查找散列表要通过d_lookup()函数，如果该函数在dcache中发现了与其相匹配的目录项对象，则匹配的对象被返回；否则，返回NULL。

而**dcache在一定意义上也提供对索引节点的缓存**，也就是**icache**。和目录项对象相关的索引节点对象不会被释放，因为目录项会让相关索引节点的使用计数为正，这样就可以确保索引节点留在内存中。只要目录项被缓存，其相应的索引节点也就被缓存了。

因为文件访问呈现空间和时间的局部性，所以对目录项和索引节点进行缓存非常有益。文件访问有时间上的局部性，是因为程序可能会一次又一次地访问相同的文件。因此，当一个文件被访问时，所缓存的相关目录项和索引节点不久被命中的概率较高。文件访问具有空间的局部性是因为程序可能在同一个目录下访问多个文件，因此一个文件对应的目录项缓存后极有可能被命中，因为相关的文件可能在下次又被使用。

### 目录项操作

dentry_operations结构体指明了VFS操作目录项的所有方法。

```c
struct dentry_operations {
  	/*判断目录对象是否有效。VFS从dcache中使用一个目录项时，会调用该函数。大部分文件系统将该方法置为NULL，因为它们认为dcache中的目录项对象总是有效的*/
	int (*d_revalidate)(struct dentry *, struct nameidata *);
  	/*为目录项生成散列值*/
	int (*d_hash) (struct dentry *, struct qstr *);
  	/*比较后两个参数的文件名。VFS默认操作，仅仅作字符串比较。对有些文件系统，如FAT，简单的字符串比较不能满足其需要。因为FAT文件系统不区分大小写，所以需要实现一种不区分大小写的字符串比较函数。dcache_lock锁保护*/
	int (*d_compare) (struct dentry *, struct qstr *, struct qstr *);
  	/*目录项对象的d_count为0时，VFS调用该函数。需要dcache_lock和目录项的d_lock同时保护*/
	int (*d_delete)(struct dentry *);
  	/*释放目录项对象*/
	void (*d_release)(struct dentry *);
  	/*目录项对象丢失了其相关的索引节点时（磁盘索引节点被删除了），VFS调用该函数。默认情况下，VFS会调用iput()函数释放索引节点。如果文件系统重载了该函数，那么除了执行此文件系统特殊的工作外，还必须调用iput()函数*/
	void (*d_iput)(struct dentry *, struct inode *);
	char *(*d_dname)(struct dentry *, char *, int);
};
```

## 文件对象

VFS的最后一个主要对象是文件对象。**文件对象表示进程已打开的文件**。如果站在用户角度来看待VFS，文件对象会首先进人我们的视野。进程直接处理的是文件，而不是超级块、索引节点或目录项。

文件对象是已打开的文件在内存中的表示。该对象(不是物理文件)由相应的open()系统调用创建，由close()系统调用撤销，所有这些文件相关的调用实际上都是文件操作表中定义的方法。因为多个进程可以同时打开和操作同一个文件，所以同一个文件也可能存在多个对应的文件对象。文件对象仅仅在进程观点上代表已打开文件，它反过来指向目录项对象(反过来指向索引节点)，其实只有目录项对象才表示已打开的实际文件。**虽然一个文件对应的文件对象不是唯一的，但对应的索引节点和目录项对象无疑是唯一的。**

文件对象由fi1e结构体表示，定义在文件<linux/fs.h中。

```c
struct file {
	/*
	 * fu_list becomes invalid after file_free is called and queued via
	 * fu_rcuhead for RCU freeing
	 */
	union {
		struct list_head	fu_list;	/*文件对象链表*/
		struct rcu_head 	fu_rcuhead;	/*释放之后的RCU链表*/
	} f_u;
	struct path		f_path;	/*包含目录项*/
#define f_dentry	f_path.dentry
#define f_vfsmnt	f_path.mnt
	const struct file_operations	*f_op;	/*文件对象操作表*/
	spinlock_t		f_lock;  /*文件锁 f_ep_links, f_flags, no IRQ */
	atomic_long_t		f_count;	/*文件对象的使用计数*/
	unsigned int 		f_flags;	/*打开文件时指定的标志*/
	fmode_t			f_mode;	/*文件的访问模式*/
	loff_t			f_pos;	/*文件当前位移量（文件指针）*/
	struct fown_struct	f_owner;	/*owner通过消耗进行异步I/O数据的传送*/
	const struct cred	*f_cred;	/*文件的信任状*/
	struct file_ra_state	f_ra;	/*预读状态*/
	u64			f_version;	/*版本号*/
#ifdef CONFIG_SECURITY
	void			*f_security;	/*安全模块*/
#endif
	/* needed for tty driver, and maybe others */
	void			*private_data;	/*tty设备驱动的钩子*/
#ifdef CONFIG_EPOLL
	/* Used by fs/eventpoll.c to link all the hooks to this file */
	struct list_head	f_ep_links;	/*事件池链表*/
#endif /* #ifdef CONFIG_EPOLL */
	struct address_space	*f_mapping;	/*页缓存映射*/
#ifdef CONFIG_DEBUG_WRITECOUNT
	unsigned long f_mnt_write_state;	/*调试状态*/
#endif
};
```

文件对象也没有对应的磁盘数据，所以在结构体中没有代表其对象是否被修改、是否需要写会磁盘的标志。文件对象通过f_dentry指向相关的目录项对象，目录项对象会指向相关的索引节点，索引节点会记录文件是否被修改。

### 文件操作

```c
struct file_operations {
	struct module *owner;
  	/*更新偏移量指针*/
	loff_t (*llseek) (struct file *, loff_t, int);
  	/*从给定的loff_t偏移处读取size_t字节的数据到__user中，同时更新文件指针*/
	ssize_t (*read) (struct file *, char __user *, size_t, loff_t *);
  	/*从给你的__user中取出size_t字节的数据，写入给定文件的loff_t偏移处，同时更新文件指针*/
	ssize_t (*write) (struct file *, const char __user *, size_t, loff_t *);
  	/*从kiocb描述的文件里，以同步方式读取long字节的数据到 iovec中*/
	ssize_t (*aio_read) (struct kiocb *, const struct iovec *, unsigned long, loff_t);
  	/*以同步方式从给定的iovec中取出long字节数据，写入由kiocb描述的文件中*/
	ssize_t (*aio_write) (struct kiocb *, const struct iovec *, unsigned long, loff_t);
  	/*返回目录列表中的下一个目录*/
	int (*readdir) (struct file *, void *, filldir_t);
  	/*该函数睡眠等待给定文件活动。由系统调用poll()调用它*/
	unsigned int (*poll) (struct file *, struct poll_table_struct *);
  	/*该函数用来给设备发送命令参数对。当文件是一个被打开的设备节点时，可以通过它进行设置操作*/
	int (*ioctl) (struct inode *, struct file *, unsigned int, unsigned long);
  	/*与ioctl有类似的功能，只不过不需要调用者持有BKL。*/
	long (*unlocked_ioctl) (struct file *, unsigned int, unsigned long);
  	/*ioctl可移植变种*/
	long (*compat_ioctl) (struct file *, unsigned int, unsigned long);
  	/*将给定的文件映射到指定的地址空间上。*/
	int (*mmap) (struct file *, struct vm_area_struct *);
  	/*创建新的文件对象，并将它和相应的索引节点对象关联起来。*/
	int (*open) (struct inode *, struct file *);
  	/*打开的文件计数减少时，该函数被VFS调用*/
	int (*flush) (struct file *, fl_owner_t id);
  	/*文件的最后一个引用被注销时调用*/
	int (*release) (struct inode *, struct file *);
  	/*给定文件的所有缓存数据写会磁盘*/
	int (*fsync) (struct file *, int datasync);
  	/*将kiocb描述的文件所有缓存数据写回到磁盘*/
	int (*aio_fsync) (struct kiocb *, int datasync);
  	/*打开或关闭异步I/O的通告信号*/
	int (*fasync) (int, struct file *, int);
  	/*给指定文件上锁*/
	int (*lock) (struct file *, int, struct file_lock *);
  	/*从一个文件向另一个文件发送数据*/
	ssize_t (*sendpage) (struct file *, struct page *, int, size_t, loff_t *, int);
  	/*获取未使用的地址空间来映射给定的文件*/
	unsigned long (*get_unmapped_area)(struct file *, unsigned long, unsigned long, unsigned long, unsigned long);
  	/*检查传递给fcntl()系统调用的flags的有效性。*/
	int (*check_flags)(int);
  	/**/
	int (*flock) (struct file *, int, struct file_lock *);
  	/**/
	ssize_t (*splice_write)(struct pipe_inode_info *, struct file *, loff_t *, size_t, unsigned int);
  	/**/
	ssize_t (*splice_read)(struct file *, loff_t *, struct pipe_inode_info *, size_t, unsigned int);
  	/**/
	int (*setlease)(struct file *, long, struct file_lock **);
};
```

## 和文件系统相关的数据结构

内核还使用了另外一些标准数据结构来管理文件系统的其他相关数据。第一个对象是file_system_type，用来描述各种特定文件系统类型，比如ext3、ext4或UDF。第二个结构体是vfsmount，用来描述一个安装文件系统的实例。

因为Linux支持众多不同的文件系统，所以内核必须由一个特殊的结构来描述每种文件系统的功能和行为。file_system_type结构体被定义在<linux/fs.h&gt;

```c
struct file_system_type {
	const char *name;	/*文件系统的名字*/
	int fs_flags;	/*文件系统类型标志*/
  	/*从磁盘读取超级块。安装文件系统时，在内存中组装超级块对象*/
	int (*get_sb) (struct file_system_type *, int,
		       const char *, void *, struct vfsmount *);
	/*终止访问超级块*/
  	void (*kill_sb) (struct super_block *);
  	/*文件系统模块*/
	struct module *owner;
  	/*下一个文件系统类型*/
	struct file_system_type * next;
  	/*超级块对象链表*/
	struct list_head fs_supers;
  	/*以下字段运行时使锁生效*/
	struct lock_class_key s_lock_key;
	struct lock_class_key s_umount_key;
	struct lock_class_key s_vfs_rename_key;

	struct lock_class_key i_lock_key;
	struct lock_class_key i_mutex_key;
	struct lock_class_key i_mutex_dir_key;
	struct lock_class_key i_alloc_sem_key;
};
```

当文件系统被实际安装时，将有有个vfsmount结构体在安装点被创建。该结构体用来代表文件系统的的实例——代表一个安装点。

vfsmount结构被定义在<linux/mount.h&gt;中

```c
struct vfsmount {
	struct list_head mnt_hash;	/*散列表*/
	struct vfsmount *mnt_parent;	/*父文件系统 fs we are mounted on */
	struct dentry *mnt_mountpoint;	/*安装点的目录项 dentry of mountpoint */
	struct dentry *mnt_root;	/*该文件系统的根目录项 root of the mounted tree */
	struct super_block *mnt_sb;	/*该文件系统的超级块 pointer to superblock */
	struct list_head mnt_mounts;	/*子文件系统链表 list of children, anchored here */
	struct list_head mnt_child;	/*子文件系统链表 and going through their mnt_child */
	int mnt_flags;	/*安装标志*/
	/* 4 bytes hole on 64bits arches */
	const char *mnt_devname;	/*设备文件名 Name of device e.g. /dev/dsk/hda1 */
	struct list_head mnt_list;	/*描述符链表*/
	struct list_head mnt_expire;	/*在到期链表中的入口 link in fs-specific expiry list */
	struct list_head mnt_share;	/*共享安装链表中的入口 circular list of shared mounts */
	struct list_head mnt_slave_list;/*从安装节点链表 list of slave mounts */
	struct list_head mnt_slave;	/*从安装链表中的入口 slave list entry */
	struct vfsmount *mnt_master;	/*从安装链表的主人 slave is on master->mnt_slave_list */
	struct mnt_namespace *mnt_ns;	/*相关的命名空间 containing namespace */
	int mnt_id;			/*安装标识符 mount identifier */
	int mnt_group_id;		/*组标识符 peer group identifier */
	/*
	 * We put mnt_count & mnt_expiry_mark at the end of struct vfsmount
	 * to let these frequently modified fields in a separate cache line
	 * (so that reads of mnt_flags wont ping-pong on SMP machines)
	 */
	atomic_t mnt_count;	/*使用计数*/
	int mnt_expiry_mark;		/*如果标记为到期，则值为真 true if marked for expiry */
	int mnt_pinned;	/*“钉住”进程计数*/
	int mnt_ghosts;	/*“镜像引用计数”*/
#ifdef CONFIG_SMP
	int __percpu *mnt_writers;
#else
	int mnt_writers;	/*写者引用计数*/
#endif
};
```

理清文件系统和所有其他安装点间的关系，是维护所有安装点链表中最复杂的工作。所以，vfsmount结构体中维护的各种链表就是为了能够跟踪这些关联信息。

vfsmount结构还保存了在安装时指定的标志信息，该信息存储在mnt_flages域中。

| 标志         | 描述                             |
| ---------- | ------------------------------ |
| MNT_NOSUID | 禁止该文件系统的可执行文件设置setuid和setgid标志 |
| MNT_MODEV  | 禁止访问该文件系统上的设备文件                |
| MNT_NOEXEC | 禁止执行该文件系统上的可执行文件               |

## 和进程相关的数据结构

系统中的每一个进程都有自己的一组打开的文件。有三个数据结构将VFS层和系统的进程紧密联系在一起，它们分别是：**file_struct**、**fs_struct**和namespace结构体。

file_struct结构体定义在<linux/fdtable.h&gt;中。该结构体由进程描述符中的files目录项指向。所有与单个进程（pre-process）**相关的信息**（如打开的文件及文件描述符）都包含在其中

```c
struct files_struct {
  /*
   * read mostly part
   */
	atomic_t count;	/*使用计数*/
	struct fdtable *fdt;	/*指向其他fd表的指针*/
	struct fdtable fdtab;	/*基fd表*/
  /*
   * written part on a separate cache line in SMP
   */
	spinlock_t file_lock ____cacheline_aligned_in_smp;	/*单个文件的锁*/
	int next_fd;	/*缓存下一个可用的fd*/
	struct embedded_fd_set close_on_exec_init;	/*exec()时关闭的文件描述符表*/
	struct embedded_fd_set open_fds_init;	/*打开的文件描述符链表*/
	struct file * fd_array[NR_OPEN_DEFAULT];	/*缺省的文件对象数组*/
};
```

**fd_array数组指针指向已打开的文件对象**。因为NR_OPEN_DEFAULT等于BITS_PER_LONG，在64位机器体系结构中这个宏的值为64，所以该数组可以容纳64个文件对象。如果一个进程所打开的文件对象超过64个，内核将分配一个新数组，井且将fdt指针指向它。所以对适当数量的文件对象的访问会执行得很快，因为它是对静态数组进行的操作：如果一个进程打开的文件数量过多，那么内核就需要建立新数组。所以如果系统中有大量的进程都要打开超过64个文件，为了优化性能，管理员可以适当增大NR_OPEN_DEFAULT的预定义值。

和进程相关的第二个结构体是fs_struct。结构由进程描述符的fs域指向。它**包含文件系统和进程相关的信息**，定义在文件<linux/fs_struct.h&gt;中

```c
struct fs_struct {
	int users;	/*用户数目*/
	rwlock_t lock;	/*保护该结构的锁*/
	int umask;	/*掩码*/
	int in_exec;	/*当前正在执行的文件*/
	struct path root, pwd;	/*根目录和当前目录的路径*/
};
```

最后一个相关结构体是namespace结构体，它定义在文件<linux/mnt_namespace&gt;中，由进程描述符中的mnt_namespace域指向（现在应该是nsproxy，待确定）。

```c
struct mnt_namespace {
	atomic_t		count;	/*引用计数*/
	struct vfsmount *	root;	/*根目录安装节点对象*/
	struct list_head	list;	/*安装点链表*/
	wait_queue_head_t poll;	/*轮询的等待队列*/
	int event;	/*事件计数*/
};
```

list域是连接已安装文件系统的双向链表，它包含的元素组成了全体命名空间。

上述这些数据结构都是通过进程描述符连接起来的。对多数进程来说，它们的描述符都指向唯一的file_struct和fs_struct结构体。但是，对于那些使用克隆标志CLONE_FILLS或CLOINE_FS创建的进程，会共享这两个结构体。

namespace结构体的使用方法却和前两种结构体完全不同，默认情况下，所有的进程共享同样的命名空间(也就是，它们都从相同的挂载表中看到同一个文件系统层次结构)。只有在进行clone()操作时使用CLONE_NEWS标志，才会给进程一个唯一的命名空间结构体的拷贝。因为大多数进程不提供这个标志，所有进程都继承其父进程的命名空间。因此，在大多数系统上只有一个命名空间，不过，CLONE_NEWS标志可以使这一功能失效。

## 文件系统数据结构体总结

超级块是对一个文件系统的描述；索引节点是对一个文件**物理属性**的描述；而目录项是对一个文件**逻辑属性**的描述。除此之外，文件与进程之间的关系是由另外的数据结构来描述的。一个进程所处的位置是由fs_struct来描述的，而一个进程（或用户）打开的文件是由files_struct来描述的，而整个系统所打开的文件是由file结构来描述。

每个文件除了有一个索引节点inode数据结构外，还有一个目录项dentry数据结构。dentry 结构中有个d_inode指针指向相应的inode结构。

dentry结构代表的是逻辑意义上的文件，所描述的是文件逻辑上的属性，因此，目录项对象在磁盘上并没有对应的映像；而inode结构代表的是物理意义上的文件，记录的是物理上的属性，一个索引节点对象可能对应多个目录项对象。

各个结构关系图如下：![VFS各结构体关系](/images/Linux 虚拟文件系统/VFS结构关系.jpg)



参考：

[超级块对象、索引节点对象、文件对象及目录项对象的数据结构](http://blog.csdn.net/melong100/article/details/6401861)

[文件系统中的对象总结及对目录项对象的重点理解](http://blog.csdn.net/abo8888882006/article/details/5362677)

