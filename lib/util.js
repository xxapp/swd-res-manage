var path = require('path');

// 统一使用'/'来做路径分隔符
module.exports.normalizePath = function (uri) {
    return uri.split(path.sep).join('/');
}

// 自动处理模块标识
module.exports.simplifyModId = function (id) {
    var folder = path.dirname(id);//.replace('js', '');
    var file = path.basename(id, '.js');
    return this.normalizePath(path.join(folder, file));
}