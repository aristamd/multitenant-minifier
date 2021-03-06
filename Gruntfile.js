/*
 * multitenant-minifier
 *
 * Copyright (c) 2015 AristaMD
 * Licensed under the MIT license.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var async = require('async');
var glob = require('glob');

module.exports = function (config, grunt) {

    var self = this;

    /**
     * Get all the tenants identified by distinct directories in the given src path
     *
     * @param  {String} srcPath directory containing tenant specific files
     * @return {Array} array of Strings
     */
    this.getTenants = function (srcPath) {

        function filter(file) {
            return fs.statSync(path.join(srcPath, file)).isDirectory();
        }

        if (fs.existsSync(srcPath)) {
            var results = fs.readdirSync(srcPath).filter(filter);
            return results;
        } else {
            return [];
        }
    };
    this.tenants = this.getTenants(config.src + config.tenants + '/');

    /**
     * Get all the files in a given directory
     *
     * @param  {String} dir directory to inspect
     * @param  {Array} fileList list of files to add to
     * @return {Array} list of files
     */
    function getFiles(dir, fileList) {
        if (!fileList) {
            console.log("Variable 'fileList' is undefined or NULL.");
            return;
        }
        var files = fs.readdirSync(dir);
        for (var i in files) {
            if (!files.hasOwnProperty(i)) continue;
            var name = dir + '/' + files[i];
            if (fs.statSync(name).isDirectory()) {
                getFiles(name, fileList);
            } else {
                fileList.push(name);
            }
        }
    };

    // Why is this here... can we not just set it in the declaration above?
    this.getFiles = getFiles;

    /**
     * Get all the js files for a given module. Assumes modules are located in
     * /js directory
     *
     * @param  {String} module name of the module (directory) to inspect
     * @param  {String} element name of kind of entity in module to include (such as service, directive, etc...)
     * @param  {String} src path tho look for the files
     * @return {Array<String>}
     */
    this.getModuleFiles = function (module, element, src) {
        var options = {
            'cwd': src + module
        };
        return glob.sync('js/' + element + '/*.js', options);
    };

    /**
     * Get all the html files for a given module.
     *
     * @param  {String} module name of the module (directory) to inspect
     * @param  {String} src path tho look for the files
     * @return {Array<String>}
     */
    this.getModuleViews = function (module, src) {
        var options = {
            'cwd': src + module
        };
        return glob.sync('tpl/*.html', options);
    };

    /**
     * Return a list of files that should not be included for a given module??
     *
     * @param  {[type]} files  [description]
     * @param  {[type]} src    [description]
     * @param  {[type]} module [description]
     * @return {[type]}        [description]
     */
    this.getDeniedFilesForModule = function (files, src, module) {
        var deniedFiles = [];
        var fileName = null;
        for (var i in files) {
            deniedFiles.push('!' + src + module + '/' + files[i]);
        }
        return deniedFiles;
    };

    /**
     * [getTenantFilesForModule description]
     * @param  {[type]} files  [description]
     * @param  {[type]} src    [description]
     * @param  {[type]} tenant [description]
     * @param  {[type]} module [description]
     * @return {[type]}        [description]
     */
    this.getTenantFilesForModule = function (files, src, tenant, module) {
        var tenantFiles = [];
        var fileName = null;
        for (var i in files) {
            tenantFiles.push(src + tenant + '/' + module + '/' + files[i]);
        }
        return tenantFiles;
    };

    this.getConcatFiles = function (modules, elements, src, dest, tenantsPath) {

        function getElementPatterns(path, elements, module, srcPath, tenant) {
            var src = [];
            var element = null;
            var tenantFiles = null;
            var deniedFiles = null;
            for (var i in elements) {
                element = elements[i];
                src.push(path + element + '/**/*.js');
                if (tenant) {
                    tenantFiles = self.getModuleFiles(module, element, config.src + config.tenants + '/' + tenant + '/');
                    deniedFiles = self.getDeniedFilesForModule(tenantFiles, srcPath, module);
                    tenantFiles = self.getTenantFilesForModule(tenantFiles, config.src + config.tenants + '/', tenant, module);
                    src = src.concat(deniedFiles, tenantFiles);
                }
            }

            src.push(path + '*.js');
            return src;
        }

        function getModulesFiles(destPath, srcPath, modules, elements, tenant) {
            var files = [];
            if (config.tasks && config.tasks.concat) {
                for (var taskIndex in config.tasks.concat) {
                    var task = config.tasks.concat[taskIndex];
                    if (task) {
                        files.push({
                            dest: destPath + task.file,
                            src: task.src
                        });
                    }
                }
            }
            var module = null;
            for (var i in modules) {
                module = modules[i];
                var moduleFiles = {
                    dest: tenant ? config.dest + config.tenants + '/' + tenant + '/merged/' + module + '.merged' : destPath + module + '.merged',
                    src: getElementPatterns(srcPath + module + '/js/', elements, module, srcPath, tenant)
                };
                files.push(moduleFiles);
            }
            return files;
        }

        var files = getModulesFiles(dest + 'merged/', src, modules, elements, tenantsPath);

        var tenants = self.tenants;

        var tenant = null;
        for (var i in tenants) {
            tenant = tenants[i];
            files = files.concat(getModulesFiles(dest + 'merged/', src, modules, elements, tenant));
        }

        return files;
    };

    this.getUglifyFiles = function () {
        var files = [{
            expand: true,
            cwd: config.dest + 'merged',
            src: '**/*.merged',
            dest: config.dest + 'js',
            ext: '.js',
            extDot: 'first'
        }];

        var tenants = self.tenants;

        var tenant = null;
        for (var i in tenants) {
            tenant = tenants[i];
            files.push({
                expand: true,
                cwd: config.dest + config.tenants + '/' + tenant + '/merged',
                src: '**/*.merged',
                dest: config.dest + config.tenants + '/' + tenant + '/js',
                ext: '.js',
                extDot: 'first'
            });
        }

        return files;
    };

    this.getRecessFiles = function (modules, srcPath, destPath) {

        function getTenantFiles(tenant) {
            var tenantFiles = [];
            for (var i in modules) {
                module = modules[i];
                files.push(srcPath + config.tenants + '/' + tenant + '/' + module + '/css/*.css');
            }
            return tenantFiles;
        }


        var files = [];
        var module = null;
        var configs = [];
        var config = {};

        for (var i in modules) {
            module = modules[i];
            files.push(srcPath + module + '/css/*.css');
        }

        config[destPath + 'css/style.css'] = files;
        config[destPath + 'css/vendor.css'] = srcPath + 'vendor/css/*.css';
        configs.push(config);

        var tenantsFiles = [];

        var tenants = self.tenants;
        var tenant = null;
        for (var i in tenants) {
            tenant = tenants[i];
            config = {};
            var tFiles = getTenantFiles(tenant);
            if (tFiles.length > 0) {
                config[destPath + config.tenants + '/' + tenant + '/css/style.css'] = tFiles;
                configs.push(config);
            }
        }

        return configs;

    };

    this.getCopyFiles = function () {
        var files = [
            {
                expand: true,
                cwd: config.src,
                src: ['**/*.eot', '**/*.svg', '**/*.ttf', '**/*.woff', '**/*.woff2'],
                dest: config.dest + 'fonts/',
                flatten: true
            },
            {
                expand: true,
                cwd: config.src,
                src: ['**/*.jpg', '**/*.png', '**/*.gif'],
                dest: config.dest + 'img/',
                flatten: true
            },
            {
                src: [config.src + '.htaccess'],
                dest: config.dest + '.htaccess'
            },
            {
                src: [config.src + 'listener.html'],
                dest: config.dest + 'listener.html'
            },
            {
		expand: true,
		cwd: config.src + '/acunetix/',
                src: ['*.txt'],
                dest: config.dest
            },
            {
                expand: true,
                cwd: config.src + '/vendor/css',
                src: ['*.png', '*.gif'],
                dest: config.dest + 'css/',
                flatten: true
            },
            {
                expand: true,
                cwd: config.src + '/i18n',
                src: ['*.json'],
                dest: config.dest + 'i18n/',
                flatten: true
            }
        ];

        var tenants = self.tenants;

        var tenant = null;
        for (var i in tenants) {
            tenant = tenants[i];
            files.push(
                {
                    expand: true,
                    cwd: config.src + config.tenants + '/' + tenant + '/',
                    src: ['**/*.eot', '**/*.svg', '**/*.ttf', '**/*.woff'],
                    dest: config.dest + config.tenants + '/' + tenant + '/fonts/',
                    flatten: true
                }
            );
            files.push({
                expand: true,
                cwd: config.src + config.tenants + '/' + tenant + '/',
                src: ['**/*.jpg', '**/*.png', '**/*.gif'],
                dest: config.dest + config.tenants + '/' + tenant + '/img/',
                flatten: true
            });
            files.push({
                expand: true,
                cwd: config.src + config.tenants + '/' + tenant + '/i18n',
                src: ['*.json'],
                dest: config.dest + config.tenants + '/' + tenant + '/i18n/',
                flatten: true
            });
        }

        return files;
    };

    this.getCleanGrooming = function () {
        var paths = [config.dest + 'merged/*'];

        var tenants = self.tenants;
        var tenant = null;
        for (var i in tenants) {
            tenant = tenants[i];
            paths.push(config.dest + config.tenants + '/' + tenant + '/merged/*');
        }
        return paths;
    };

    this.getJadeFiles = function () {
        var files = {
            "dist/index.html": [
                "src/tpl/index.jade"
            ],
            "dist/listener.html": [
                "src/tpl/listener.jade"
            ]
        };
        var tenants = self.tenants;
        var tenant = null;
        for (var i in tenants) {
            tenant = tenants[i];
            files[config.dest + config.tenants + '/' + tenant + '/index.html'] = "src/tpl/index.jade"
        }
        return files;
    };

    this.getNgTemplateFiles = function () {

        var files = [];
        var src = [];
        var modules = config.modules;

        for (var i in modules) {
            module = modules[i];
            src.push(module + '/' + '**/*.html');
        }

        files.push({
            cwd: config.src,
            src: src,
            dest: config.dest + 'js/templates.js'
        });

        var tenants = self.tenants;
        var tenant = null;
        for (var i in tenants) {
            tenant = tenants[i];
            src = [];
            for (var i in modules) {
                module = modules[i];
                src.push(module + '/' + '**/*.html');
                var tenantViews = self.getModuleViews(module, config.src + config.tenants + '/' + tenant + '/');
                for (var j in tenantViews) {
                    var view = tenantViews[i];
                    src.push('!' + module + '/' + view);
                    src.push(config.tenants + '/' + tenant + '/' + module + '/' + view);
                }
            }

            files.push({
                cwd: config.src,
                src: src,
                dest: config.dest + config.tenants + '/' + tenant + '/js/templates.js'
            });
        }

        return files;
    };

    this.getReplaceFiles = function () {
        var files = [
            {
                src: [config.dest + 'index.html'],
                dest: config.dest + 'index.html'
            },
            {
                src: [config.dest + 'listener.html'],
                dest: config.dest + 'listener.html'
            },
            {expand: true, src: ['*.js'], dest: config.dest + 'js/', cwd: config.dest + 'js/'},
            {
                expand: true,
                cwd: config.dest + 'css',
                src: ['*.css'],
                dest: config.dest + 'css/'
            }
        ];

        var tenants = self.tenants;
        var tenant = null;
        for (var i in tenants) {
            tenant = tenants[i];
            files.push({
                expand: true, src: ['*.js'],
                dest: config.dest + config.tenants + '/' + tenant + '/js/',
                cwd: config.dest + config.tenants + '/' + tenant + '/js/'
            });
            files.push(
                {
                    expand: true,
                    cwd: config.dest + config.tenants + '/' + tenant + '/css',
                    src: ['*.css'],
                    dest: config.dest + config.tenants + '/' + tenant + '/css/'
                }
            );
            files.push(
                {
                    src: config.dest + config.tenants + '/' + tenant + '/index.html',
                    dest: config.dest + config.tenants + '/' + tenant + '/index.html'
                }
            );
        }

        return files;
    };

    /**
     * Locates all the localication json files for the 'app' and tenant namespaces
     *
     * @return {Object} object with the structure { dest: [src,src] }
     */
    this.getLanguageFiles = function(){
        var files = {};
        var src = [];
        var tenants = self.tenants;

        // get a list of known modules and create a regex pattern
        var modules = '+(' + config.modules.join('|') + ')';

        for (var i in config.languages) {

            var lang = config.languages[i];

            // Get all language files for the top level 'app' namespace
            var appLanguageFiles = glob.sync( config.src + '/'+modules+'/**/i18n/'+lang+'.json');

            for (var j in config.locales) {
                var locale = lang + '_' + config.locales[j];

                // Get all language files for the top level 'app' namespace
                var appLocaleFiles = glob.sync( config.src + '/'+modules+'/**/i18n/'+locale+'.json');

                // Add the base namespace files to the list of all files
                files[config.src + 'i18n/'+locale+'.json'] = appLanguageFiles.concat(appLocaleFiles);

                // Loop through each tenant adding an entry for each
                for (var i in tenants) {
                    var tenantLanguageSources = config.src + config.tenants + '/' + tenants[i] + '/'+modules+'/**/i18n/'+lang+'.json';
                    var tenantLanguageFiles = glob.sync(tenantLanguageSources);

                    var tenantLocaleSources = config.src + config.tenants + '/' + tenants[i] + '/'+modules+'/**/i18n/'+locale+'.json';
                    var tenantLocaleFiles = glob.sync(tenantLocaleSources);

                    // A simple concat of the arrays base + tenant is sufficient
                    // since the merge-json library takes care of overwriting
                    // identically named attributes
                    var tenantDest = config.src + config.tenants + '/' + tenants[i] + '/i18n/'+locale+'.json';
                    files[tenantDest] = appLanguageFiles.concat(appLocaleFiles.concat(tenantLanguageFiles.concat(tenantLocaleFiles)));
                }
            }
        }

        return files;
    }

    this.getTemplateFiles = function (){
        var files = [];
        var path = config.dest + config.tenants+ '/';
        var tenants = self.tenants;
        for (var i in tenants) {
            files.push( {src: path + tenants[i] + '/js/templates.js',
                dest: path + tenants[i] + '/js/templates.js' } );
        }

        return files;
    };

    this.getConfig = function () {
        config.concatFiles = self.getConcatFiles(config.modules, config.elements, config.src, config.dest);
        config.uglifyFiles = self.getUglifyFiles();
        config.recessFiles = self.getRecessFiles(config.modules, config.src, config.dest);
        config.copyFiles = self.getCopyFiles();
        config.cleanGroomingFiles = self.getCleanGrooming();
        config.jadeFiles = self.getJadeFiles();
        config.ngTemplateFiles = self.getNgTemplateFiles();
        config.replaceFiles = self.getReplaceFiles();
        config.languageFiles = self.getLanguageFiles();
        config.templateFiles = self.getTemplateFiles();
        return config;
    }

    return this.getConfig();
};
