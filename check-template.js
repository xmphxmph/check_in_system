const fs = require('fs');
const { compile } = require('@vue/compiler-dom');
const html = fs.readFileSync(__dirname + '/public/index.html', 'utf8');
const appStart = html.indexOf('<div id="app">');
const scriptStart = html.indexOf('<script src=');
const tpl = html.slice(appStart, scriptStart);
const errors = [];
compile(tpl, { mode: 'function', onError: (e) => errors.push(e.message) });
console.log(errors.length ? '模板编译失败: ' + errors.join('; ') : '模板编译 OK');
