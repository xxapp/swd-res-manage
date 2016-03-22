var gutil = require('gulp-util');
var PluginError = gutil.PluginError;
var path = require('path');
var detective = require('detective');
var through = require('through2');
var _ = require('lodash');
var util = require('./lib/util');

var PLUGIN_NAME = 'swd';
// 标准化构建配置
function optsResolve (opts) {
    if (opts.resolve) {
        // 标准化路径，以便之后的路径判断
        _.forEach(opts.resolve, function (n, i) {
            opts.resolve[i] = util.normalizePath(path.resolve(opts.dirname, n));
        });
    }
}

/**
 * 构建JS代码
 * @param {Object} opts 构建配置
 * @param {String} opts.dirname 项目根目录
 * @param {Object} opts.resourceMap 资源依赖表对象
 * @param {Object} opts.resolve 短名映射表
 * @param {String} opts.dest 构建目标目录
 */
exports.buildJs = function (opts) {
    // 对配置进行清洗
    optsResolve(opts);
    
    var resourceMap = opts.resourceMap;
    
    return through.obj(function (file, enc, cb) {
        if (file.isNull()) {
            return cb(null, file);
        }
        if (file.isStream()) {
            this.emit('error', new PluginError(PLUGIN_NAME, 'Streams are not supported!'));
            return cb();
        }
        
        if (file.isBuffer()) {
            // 资源标识
            var uri = util.normalizePath(path.resolve(file.path));
            // 资源引用id
            var id = '';
            // 依赖列表，使用node-detective插件，目前只能分析js中的require和require.loadCss
            var deps = detective(file.contents);

            // 先找是否存在配置好的资源短名
            _.forEach(opts.resolve, function (n, i) {
                if (n === uri) {
                    id = i;
                    return false;
                }
            });
            
            // 将uri转为构建目标路径相对项目根目录的绝对路径
            uri = util.normalizePath(path.relative(opts.dirname, uri));
            // 如果没匹配到资源短名就使用简化的uri作为id
            if (!id) {
                // 没有找到短名就把uri作为id,并把js后缀去掉
                id = util.simplifyModId(uri);
            }

            // 将id记录在file实例对象上，以便之后的wrap过程使用
            file.modId = id;
            
            // 组装资源信息
            resourceMap.res[id] = {
                uri: uri,
                deps: deps
            }
        }
        
        // 将控制权交给管道中下一个gulp插件
        this.push(file);
        
        // 完成回调
        cb();
    });
};

exports.buildHtml = function(opts) {
    return through.obj(function (file, enc, cb) {
        this.push(file);
        cb();
    });
};

/**
 * 构建CSS代码开始
 * 收集模块id
 * @param opts 同buildJs
 */
exports.buildCssStart = function(opts) {
    // 对配置进行清洗
    optsResolve(opts);

    var resourceMap = opts.resourceMap;

    return through.obj(function (file, enc, cb) {
        if (file.isNull()) {
            return cb(null, file);
        }
        if (file.isStream()) {
            this.emit('error', new PluginError(PLUGIN_NAME, 'Streams are not supported!'));
            return cb();
        }

        if (file.isBuffer()) {
            // 资源标识
            var uri = util.normalizePath(path.resolve(file.path));
            // 资源引用id
            var id = '';

            // 先找是否存在配置好的资源短名
            _.forEach(opts.resolve, function (n, i) {
                if (n === uri) {
                    id = i;
                    return false;
                }
            });

            // 将uri转为构建目标路径相对项目根目录的绝对路径
            uri = util.normalizePath(path.relative(opts.dirname, uri));
            // 如果没匹配到资源短名就使用uri
            if (!id) {
                // 没有找到短名就把uri作为id,并把js后缀去掉
                id = uri;
            }

            // 将id记录在file实例对象上
            file.modId = id;
        }

        // 将控制权交给管道中下一个gulp插件
        this.push(file);

        // 完成回调
        cb();
    });
};

/**
 * 构建CSS代码完成
 * 补充对应模块id的uri
 * @param opts 同buildJs
 */
exports.buildCssEnd = function(opts) {
    // 对配置进行清洗
    optsResolve(opts);

    var resourceMap = opts.resourceMap;

    return through.obj(function (file, enc, cb) {
        if (file.isNull()) {
            return cb(null, file);
        }
        if (file.isStream()) {
            this.emit('error', new PluginError(PLUGIN_NAME, 'Streams are not supported!'));
            return cb();
        }

        if (file.isBuffer()) {
            // 资源标识
            var uri = util.normalizePath(path.resolve(file.path));

            // 将uri转为构建目标路径相对项目根目录的绝对路径
            uri = util.normalizePath(path.relative(opts.dirname, uri));

            // 组装资源信息
            resourceMap.res[file.modId] = {
                uri: uri,
                type: 'css',
                deps: []
            }
        }

        // 将控制权交给管道中下一个gulp插件
        this.push(file);

        // 完成回调
        cb();
    });
};


// TODO: 存在合并文件任务的情况下，所有涉及合并的任务必须按顺序执行，否则会出错
// TODO: 打包标识使用uid就另当别论了

// TODO: 打包目前不支持css，因为只实现了js文件的资源依赖收集，引用路径都做了处理。
// TODO: css文件的资源依赖（主要是图片）还没完成，如果强行及进行打包会造成图片的路径请求错误
// TODO: 还有一个重要的阻碍，应该也是业界的一个难题。如何控制css的打包顺序，来让样式表现正常（即和打包前表现一致）
/**
 * 构建：文件合并开始
 * 处理合并前的资源信息收集和位置标记
 * @param opts 同buildJs
 * @param concatOpt 文件合并选项
 * @param concatOpt.path 合并后文件的路径（带文件名）
 * @param concatOpt.fileType 合并后文件类型
 */
exports.concatStart = function(opts, concatOpt) {
    // 对配置进行清洗
    optsResolve(opts);

    var resourceMap = opts.resourceMap;

    return through.obj(function (file, enc, cb) {
        if (file.isNull()) {
            return cb(null, file);
        }
        if (file.isStream()) {
            this.emit('error', new PluginError(PLUGIN_NAME, 'Streams are not supported!'));
            return cb();
        }

        if (file.isBuffer()) {
            // 标记资源位置
            resourceMap.res[file.modId]['pkg'] = resourceMap.package.get();
        }

        // 将控制权交给管道中下一个gulp插件
        this.push(file);

        // 完成回调
        cb();
    });
};

/**
 * 构建：文件合并完成
 * 根据concatStart收集到的资源信息和合并配置生成合并后的配置
 * @param opts 同buildJs
 * @param concatOpt 文件合并选项
 * @param concatOpt.path 合并后文件的路径（带文件名）
 * @param concatOpt.fileType 合并后文件类型
 */
exports.concatEnd = function(opts, concatOpt) {
    // 对配置进行清洗
    optsResolve(opts);

    var resourceMap = opts.resourceMap;

    return through.obj(function (file, enc, cb) {
        if (file.isNull()) {
            return cb(null, file);
        }
        if (file.isStream()) {
            this.emit('error', new PluginError(PLUGIN_NAME, 'Streams are not supported!'));
            return cb();
        }

        if (file.isBuffer()) {
        }

        // 将控制权交给管道中下一个gulp插件
        this.push(file);

        // 完成回调
        cb();
    }, function (cb) {
        // 收集合并进来的的资源信息并根据合并配置concatOpt生成合并后的配置
        var pkg = resourceMap.pkg;
        pkg[resourceMap.package.get()] = {
            uri: concatOpt.path,
            has: [],
            type: concatOpt.fileType
        };
        resourceMap.package.next();
        cb();
    });
};