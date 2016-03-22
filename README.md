# 基于依赖表的静态资源管理的gulp插件

！！功能还在完善中，一下只是大概的使用方法

[![NPM](https://nodei.co/npm/swd-res-manage.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/swd-res-manage/)

## 基本配置

``` js
var swd = require('swd-res-manage');
var resourceMap = {
    res: {},
    pkg: {},
    package: (function() {
        var index = 0, prefix = 'p';
        return {
            get: function() { return prefix + index; },
            next: function() { return prefix + (++index); }
        };
    }())
};
var concatOpt = {
    path: 'common/bundle.js',
    fileType: 'js'
};
var jsModTemplate = function(opts) {
    return 'define(\'' + opts.file.modId + '\', function(require, exports, module){<%= contents %>\r\n});\r\n';
};
```

## 构建js

``` js
gulp.task("buildCommonJs", function() {
    return gulp.src(['common/**/*.js'])
        .pipe(swd.buildJs(resourceMap))
        .pipe(plugins.wrap(jsModTemplate))
        .pipe(plugins.uglify())
        .pipe(swd.concatStart(resourceMap, concatOpt))
        .pipe(plugins.concat('common/bundle.js', {newLine: ';'}))
        .pipe(swd.concatEnd(resourceMap, concatOpt))
        .pipe(gulp.dest('dest/common'));
});

```

## 构建css

``` js
gulp.task("buildCommonCss", function() {
    return gulp.src(['/common/**/*.css'])
        .pipe(swd.buildCssStart(resourceMap))
        .pipe(plugins.less())
        .pipe(plugins.rename(function(path) {
            path.extname = '.css';
        }))
        //.pipe(plugins.cleanCss())
        .pipe(swd.buildCssEnd(resourceMap))
        .pipe(gulp.dest('dest/common'));
});
```