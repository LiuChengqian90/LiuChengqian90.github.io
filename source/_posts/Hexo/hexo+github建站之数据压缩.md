---
title: hexo+github建站之数据压缩
date: 2019-08-25 15:50:37
categories: Hexo
tags:
  - gulp
  - hexo-all-minifier
---

随着博客的文章、图片越来越多，博客加载速度越来越慢，本文介绍两种可以对特定文件进行压缩的插件。
<!--more-->
## GULP

[gulp.js](https://www.gulpjs.com.cn/) 是一种基于流的，代码优于配置的新一代构建工具。

### 插件安装

如果你先前将 gulp 安装到全局环境中了，请执行 `npm rm --global gulp` 将 gulp 删除再继续以下操作。

```shell
# npm install -g gulp-cli
```

在博客的根目录安装压缩静态文件要用的依赖包

```shell
# npm install gulp --save
# npm install gulp-htmlclean gulp-htmlmin gulp-clean-css gulp-uglify gulp-imagemin --save
# npm install gulp-babel babel-preset-env babel-preset-mobx --save
# npm install -D @babel/core @babel/preset-react @babel/preset-env --save
```



### 文件配置

在博客的根目录创建文件 `gulpfile.js`

```json
let gulp = require('gulp')
let cleanCSS = require('gulp-clean-css')
let htmlmin = require('gulp-htmlmin')
let htmlclean = require('gulp-htmlclean')
let babel = require('gulp-babel') /* 转换为es2015 */
let uglify = require('gulp-uglify')
let imagemin = require('gulp-imagemin')

// 设置根目录
const root = './public'

// 匹配模式， **/*代表匹配所有目录下的所有文件
const pattern = '**/*'

// 压缩html
gulp.task('minify-html', function() {
  return gulp
    // 匹配所有 .html结尾的文件
    .src(`${root}/${pattern}.html`)
    .pipe(htmlclean())
    .pipe(
      htmlmin({
        removeComments: true,
        minifyJS: true,
        minifyCSS: true,
        minifyURLs: true
      })
    )
    .pipe(gulp.dest('./public'))
})

// 压缩css
gulp.task('minify-css', function() {
  return gulp
    // 匹配所有 .css结尾的文件
    .src(`${root}/${pattern}.css`)
    .pipe(
      cleanCSS({
        compatibility: 'ie8'
      })
    )
    .pipe(gulp.dest('./public'))
})

// 压缩js
gulp.task('minify-js', function() {
  return gulp
    // 匹配所有 .js结尾的文件
    .src(`${root}/${pattern}.js`)
    .pipe(
      babel({
        //presets: ['env']
        presets: ['@babel/preset-env']
      })
    )
    .pipe(uglify())
    .pipe(gulp.dest('./public'))
})

// 压缩图片
gulp.task('minify-images', function() {
  return gulp
    // 匹配public/images目录下的所有文件
    .src(`${root}/images/${pattern}`)
    .pipe(
      imagemin(
        [
          imagemin.gifsicle({ optimizationLevel: 3 }),
          imagemin.jpegtran({ progressive: true }),
          imagemin.optipng({ optimizationLevel: 7 }),
          imagemin.svgo()
        ],
        { verbose: true }
      )
    )
    .pipe(gulp.dest('./public/images'))
})

gulp.task('default', gulp.series('minify-html', 'minify-css', 'minify-js'))
```



### 部署

```shell
# hexo clean; hexo g; gulp; hexo d
```



## hexo-all-minifier

[Hexo-all-minifier](https://github.com/chenzhutian/hexo-all-minifier)也是专为Hexo设计的小型化、优化型插件。

### 插件安装

在博客根目录下安装

```shell
# npm install hexo-all-minifier --save
```

### 文件配置

在博客根目录下的`_config.yml`文件中加上如下字段：

```json
all_minifier: true
```



如果想进一步控制插件，可在文件中加入以下字段：

```json
html_minifier:
  enable: true
  ignore_error: false
  exclude:

css_minifier:
  enable: true
  exclude:
    - '*.min.css'

js_minifier:
  enable: true
  mangle: true
  output:
  compress:
  exclude:
    - '*.min.js'

image_minifier:
  enable: true
  interlaced: false
  multipass: false
  optimizationLevel: 2
  pngquant: false
  progressive: false
```



`hexo g` 生产博文的时候就会自动压缩 HTML、JS、图片。