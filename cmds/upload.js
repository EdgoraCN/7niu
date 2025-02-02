/**
 * upload new files
 * @author ydr.me
 * @create 2015-11-06 18:18
 */


'use strict';

var dato = require('ydr-utils').dato;
var debug = require('ydr-utils').debug;
var qiniu = require('ydr-utils').qiniu;
var howdo = require('howdo');
var Progress = require('progress');

var parseConfig = require('../utils/parse-config.js');
var parseCache = require('../utils/parse-cache.js');
var upload = require('../utils/upload.js');
var banner = require('./banner.js');

module.exports = function (options) {
    banner();

    // 1. parse config
    var configs = parseConfig({
        srcDirname: options.srcDirname,
        accessKey: options.accessKey,
        secretKey: options.secretKey,
        bucket:  options.bucket
    });
    
    
    qiniu.config({
        accessKey: configs.accessKey,
        secretKey: configs.secretKey,
        bucket: configs.bucket,
        dirname: configs.destDirname,
        mimeLimit: '*'
    });

    // 2. parse cache
    var matchCache = parseCache.get(configs.uploadFiles, {
        srcDirname: options.srcDirname
    });
    var willUploadFiles = [];

    dato.each(configs.uploadFiles, function (index, file) {
        if (!matchCache[index]) {
            willUploadFiles.push(file);
        }
    });

    // 3. upload queue
    var willUploadLength = willUploadFiles.length;
    var willUploadGroup = [];
    while (willUploadFiles.length) {
        willUploadGroup.push(willUploadFiles.splice(0, configs.parallel));
    }
    var startTime = Date.now();
    var progress;

    howdo
        .each(willUploadGroup, function (i, group, next) {
            howdo
                .each(group, function (j, file, done) {
                    upload(file, configs, function (err) {
                        if (err) {
                            return done(err);
                        }

                        if(!progress){
                            progress = new Progress('[:bar]  :current/' + willUploadLength + '  剩余：:etas', {
                                complete: '=',
                                incomplete: ' ',
                                width: 70,
                                total: willUploadLength
                            });
                        }

                        parseCache.set(file, {
                            srcDirname: options.srcDirname
                        });
                        progress.tick(1);
                        done();
                    });
                })
                .together(next);
        })
        .follow()
        .try(function () {
            console.log();
            debug.success('upload files', willUploadLength);
            debug.success('upload success', 'past ' + (Date.now() - startTime) + 'ms');
        })
        .catch(function (err) {
            console.log();
            debug.error('upload file', err.file);
            debug.error('upload error', err.message);
        });
};



