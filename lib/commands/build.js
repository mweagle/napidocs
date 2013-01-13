// Copyright (c) 2012 Matt Weagle (mweagle@gmail.com)

// Permission is hereby granted, free of charge, to
// any person obtaining a copy of this software and
// associated documentation files (the "Software"),
// to deal in the Software without restriction,
// including without limitation the rights to use,
// copy, modify, merge, publish, distribute, sublicense,
// and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so,
// subject to the following conditions:

// The above copyright notice and this permission
// notice shall be included in all copies or substantial
// portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
// ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
// TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
// PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
// SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
// CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
// IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE

var util = require('util');
var fs = require('fs');
var ncp = require('ncp');
var _ = require('underscore');
var path = require('path');
var async = require('async');
var robotskirt = require('robotskirt');
var renderer = new robotskirt.HtmlRenderer();
var parser = new robotskirt.Markdown(renderer,
                                      [robotskirt.EXT_TABLES,
                                      robotskirt.EXT_AUTOLINK]);
var rimraf = require('rimraf');
var CONSTANTS = require('../CONSTANTS');

/*****************************************************************************/
// Privates
/*****************************************************************************/

// Custom object that represents a non-Markdown
// resource that just needs to be copied to the
// target location
var FileResource = function(path)
{
  this.path = path;
};
FileResource.prototype.name = "File Resource";

/**
 * Is the given filename a Markdown file?
 * @param  {String}  filename Filename to check
 * @return {Boolean}          Is filename a Markdown file?
 */
var is_markdown_file = function(filename)
{
  return (filename &&
          filename.search(/(\.md|\.mdown|\.markdown)/) >= 0);
};

var new_napidoc_asset_visitor = function(asset_path, accumulator)
{
  return function napidoc_visitor(callback)
  {
    var asset_name = asset_path.split(path.sep).pop();
    var base_name = asset_name.split('.').shift();
    var waterfall_tasks = [];

    // Type
    waterfall_tasks.push(function (waterfall_callback) {
      fs.stat(asset_path, waterfall_callback);
    });

    // Directory/File branch
    waterfall_tasks.push(function (fsStats, waterfall_callback) {

      if (fsStats.isDirectory())
      {
        accumulator[asset_name] = {type: CONSTANTS.ITEM_TYPE.DIRECTORY,
                                  name: asset_name,
                                  base_name: base_name};
        build_napidocs_context(asset_path,
                              accumulator[asset_name],
                              waterfall_callback);
      }
      else if (is_markdown_file(asset_name))
      {
        fs.readFile(asset_path, 'utf-8', waterfall_callback);
      }
      else
      {
        // Just keep a reference to the file
        process.nextTick(function () {
          waterfall_callback(null, new FileResource(asset_path));
        });
      }
    });
    // accumulate it
    waterfall_tasks.push(function (obj_or_string, waterfall_callback) {
      if (_.isString(obj_or_string))
      {
        // If it's a markdown file we'll try to parse it...
        accumulator[asset_name] = {
          type: CONSTANTS.ITEM_TYPE.FILE,
          name: asset_name,
          base_name: base_name,
          output_name: util.format('%s.html', base_name),
          raw: obj_or_string,
          parsed: parser.render(obj_or_string)
        };
      }
      else if (obj_or_string instanceof FileResource)
      {
        accumulator[asset_name] = {
          type: CONSTANTS.ITEM_TYPE.RESOURCE,
          path: obj_or_string.path
        };
      }
      process.nextTick(function () {
        waterfall_callback();
      });
    });
    async.waterfall(waterfall_tasks, callback);
  };
};

var walk_napidoc_tree = function(compiled_template,
                                  plugins,
                                  depth_data,
                                  parent_data,
                                  all_data,
                                  output_directory,
                                  callback)
{
  var async_queue = async.queue(function (task_action, callback)
  {
    try
    {
      task_action(callback);
    }
    catch (e)
    {
      console.error(e);
      callback(e, null);
    }
  },
  8);

  // Done
  async_queue.drain = function()
  {
    callback(null, null);
  };

  /////////////////////////////////////////////////////////////////////////////
  // Handle the files
  if (depth_data)
  {
    _.each(depth_data, function (data, name) {
      var series_tasks = [];
      var file_name_parts = name.split('.');

      if (data.type === CONSTANTS.ITEM_TYPE.FILE)
      {
        var html_name = util.format('%s.html', file_name_parts[0]);
        var file_path = path.join(output_directory, html_name);

        // 1 - Pump the object through the templates
        series_tasks.push(function write_markup(series_callback) {
          var template_params = {};
          _.each(plugins, function (plugin_function, name) {
            template_params[name] = plugin_function(data, depth_data, all_data);
          });
          try
          {
            var expanded = compiled_template(template_params);
            fs.writeFile(file_path, expanded, 'utf-8', series_callback);
          }
          catch (e)
          {
            console.error(e);
            series_callback(e, null);
          }
        });
      }
      else if (data.type === CONSTANTS.ITEM_TYPE.DIRECTORY)
      {
        var directory_path = path.join(output_directory, name);
        // 1 - Create the output directory
        series_tasks.push(function create_directory(series_callback) {
          fs.mkdir(directory_path, series_callback);
        });

        // 2 - Recurse
        series_tasks.push(function walk_subtree(series_callback) {
          walk_napidoc_tree(compiled_template,
                            plugins,
                            data,
                            depth_data,
                            all_data,
                            directory_path,
                            series_callback);
        });
      }
      else if (data.type === CONSTANTS.ITEM_TYPE.RESOURCE)
      {
        // Just copy it to the destination
        series_tasks.push(function copy_resource(series_callback) {
          var target_name = data.path.split(path.sep).pop();
          var target_path = path.join(output_directory, target_name);
          ncp.ncp(data.path, target_path, series_callback);
        });
      }
      else
      {
        series_tasks.push(function (series_callback) {
          series_callback(new Error('Unsupported item type: ' +  file_path));
        });
      }
      async_queue.push(series_tasks);
    });
  }
};
/**
 * Build the napidocs intermediate document
 * @param  {String}   input_directory The directory whose contents should be accumulated
 * @param  {Object}   context         The napidoc context to which the directory contents should
 *                                    be appended
 * @param  {Function} callback        Callback(err, result) to invoke on completion
 * @return {Undefined}                Undefined
 */
var build_napidocs_context = function(input_directory, context, callback)
{
  context = context || {};

  var on_directory_read = function(error, files)
  {
    if (error)
    {
      callback(error);
    }
    else
    {
      var parallel_tasks = [];
      files.forEach(function (eachItem) {
        var full_path = path.join(input_directory, eachItem);
        parallel_tasks.push(new_napidoc_asset_visitor(full_path, context));
      });
      var terminus = function(error /*, results */)
      {
        callback(error, error ? null : context);
      };
      async.parallel(parallel_tasks, terminus);
    }
  };
  fs.readdir(input_directory, on_directory_read);
};

/**
 * Build the output
 * @param  {Object}   context          napidocs context object
 * @param  {String}   source_directory napidocs document source directory
 * @param  {String}   output_directory The built output directory
 * @param  {Function} callback         The fn(er, result) callback to invoke on completion
 * @return {Undefined}                 Undefined
 */
var build_output = function(context, source_directory, output_directory, callback)
{
  var plugin_directory = path.join(source_directory,
                                              CONSTANTS.DIRECTORY.PLUGINS);
  var static_resources_directory = path.join(source_directory,
                                              CONSTANTS.DIRECTORY.STATIC);
  var api_template_path = path.join(source_directory,
                                    CONSTANTS.DIRECTORY.TEMPLATE,
                                    CONSTANTS.FILE.TEMPLATE);

  var series_tasks = [];
  // 1 - Remove directory
  series_tasks.push(function rmdir(series_callback) {
    rimraf(output_directory, series_callback);
  });

  // 2 - Create output directory
  series_tasks.push(function rmdir(series_callback) {
    fs.mkdir(output_directory, series_callback);
  });

  // 3 - Walk the tree
  series_tasks.push(function walk_tree(series_callback) {
    var auto_tasks = {};
    var static_output_path = path.join(output_directory,
                                        CONSTANTS.DIRECTORY.STATIC);

    // Copy the static assets to the output directory
    auto_tasks.static_output_directory = function(auto_callback)
    {
      fs.mkdir(static_output_path, auto_callback);
    };
    auto_tasks.copy_static_resources = ['static_output_directory',
                                        function(auto_callback)
                                        {
                                          ncp.ncp(static_resources_directory,
                                                  static_output_path,
                                                  auto_callback);
                                        }];

    // a - load the plugins
    auto_tasks.list_plugins = function(auto_callback) {
      fs.readdir(plugin_directory, auto_callback);
    };

    // a1 - load the template
    auto_tasks.load_html_template = function(auto_callback) {
      fs.readFile(api_template_path,
                  'utf-8',
                  auto_callback);
    };

    // b - load the plugin functions
    auto_tasks.load_plugins = ['list_plugins',
                                function(auto_callback, auto_context)
                                {
                                  var plugins = {};
                                  auto_context.list_plugins.forEach(function (eachPluginFileName) {
                                    try
                                    {
                                      var file_name_parts = eachPluginFileName.split('.');
                                      var plugin_module = require(path.join(plugin_directory, eachPluginFileName));
                                      // Handle the case where additional plugins don't
                                      // export a single transformation function
                                      if (_.isFunction(plugin_module))
                                      {
                                        console.log("Loading plugin: "+ file_name_parts[0]);
                                        plugins[file_name_parts[0]] = plugin_module;
                                      }
                                    }
                                    catch (e)
                                    {
                                      console.error(e);
                                    }
                                  });
                                  auto_callback(null, plugins);
                                }];

    // b1 - compile the template
    auto_tasks.compile_template = ['load_html_template',
                                    function(auto_callback, auto_context)
                                    {
                                      var compiled = _.template(auto_context.load_html_template);
                                      auto_callback(null, compiled);
                                    }];

    // c - walk the tree with the plugins
    auto_tasks.walk_tree = ['load_plugins',
                            'compile_template',
                            function (auto_callback, auto_context)
                            {
                              walk_napidoc_tree(auto_context.compile_template,
                                                auto_context.load_plugins,
                                                context,
                                                null,
                                                context,
                                                output_directory,
                                                auto_callback);
                            }];

    // Run it
    async.auto(auto_tasks, series_callback);
  });
  async.series(series_tasks, callback);
};

/*****************************************************************************/
// Exports
/*****************************************************************************/

module.exports.options  = function(optimist_instance)
{
  optimist_instance.usage('Build a static NapiDocs site');

  // Source
  optimist_instance
          .demand('s')
          .alias('s', 'source')
          .describe('s', "Source directory (eg, parent directory of /docs)");

  // Output
  optimist_instance
          .string('o')
          .alias('o', 'output')
          .describe('o', "Alternative output directory.  Defaults to " +
                          CONSTANTS.DIRECTORY.BUILD);

  // Dump context?
  optimist_instance
          .boolean('d')
          .alias('d', 'dump')
          .default(false)
          .describe('d', "Dump the context object to STDOUT");
};


module.exports.run = function(parsed_options, completion_callback)
{
  var waterfall_tasks = [];

  var docs_directory = path.join(parsed_options.s, CONSTANTS.DIRECTORY.DOCS);
  var output_directory = parsed_options.o ?
                          parsed_options.o :
                          path.join(parsed_options.s, CONSTANTS.DIRECTORY.BUILD);

  // Build the context object
  waterfall_tasks.push(function (waterfall_callback) {
    build_napidocs_context(docs_directory, {}, waterfall_callback);
  });

  // Dump the context?
  waterfall_tasks.push(function (napidocs_context, waterfall_callback) {
    if (parsed_options.d)
    {
      console.log('Context Object');
      console.log(JSON.stringify(napidocs_context, null, '\t'));
    }
    process.nextTick(function () {
      waterfall_callback(null, napidocs_context);
    });
  });

  // Build the output
  waterfall_tasks.push(function (napidocs_context, waterfall_callback) {
    build_output(napidocs_context, parsed_options.s, output_directory, waterfall_callback);
  });

  var terminus = function(error /*, result */)
  {
    var msg = error ? null : util.format("Built documentation: " + output_directory);
    completion_callback(error, msg);
  };
  async.waterfall(waterfall_tasks, terminus);
};