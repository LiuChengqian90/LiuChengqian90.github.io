var gulp = require('gulp');
var minifycss = require('gulp-minify-css'); //css文件压缩
var uglify = require('gulp-uglify');        //js压缩
var htmlmin = require('gulp-htmlmin');      //html压缩
var htmlclean = require('gulp-htmlclean');  //html清理
var imagemin = require('gulp-imagemin');    //图片压缩
 
// 压缩html
gulp.task('minify-html', async function() {
    await gulp.src('./public/**/*.html')
        .pipe(htmlclean())
        .pipe(htmlmin({
            removeComments: true,
            minifyJS: true,
            minifyCSS: true,
            minifyURLs: true,
        }))
        .pipe(gulp.dest('./public'))
});

// 压缩css
gulp.task('minify-css', async function() {
    await gulp.src('./public/**/*.css')
        .pipe(minifycss({
            compatibility: 'ie8'
        }))
        .pipe(gulp.dest('./public'));
});

// 压缩js
gulp.task('minify-js', async function() {
    await gulp.src('./public/js/**/*.js')
        .pipe(uglify())
        .pipe(gulp.dest('./public'));
});

// 压缩图片
gulp.task('minify-images', async function() {
    await gulp.src('./public/images/**/*.*')
        .pipe(imagemin(
        [imagemin.gifsicle({'optimizationLevel': 3}), 
        imagemin.jpegtran({'progressive': true}), 
        imagemin.optipng({'optimizationLevel': 7}), 
        imagemin.svgo()],
        {'verbose': true}))
        .pipe(gulp.dest('./public/images'))
});

// 默认任务
//gulp.task('default', [
//    'minify-html','minify-css','minify-js','minify-images'
//]);

//gulp.task('default', gulp.parallel('minify-html', 'minify-css', 'minify-js', 'minify-images'
//));

gulp.task('default', gulp.parallel('minify-html', 'minify-css', 'minify-js', 'minify-images'), done => {
    done();
});
