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
// DEALINGS IN THE Software

/*
1. Parse the input
2. Options:
  - Create new site
  - Rebuild site
  - Live site preview based on fs.events
3. Rebuild site:
  - Build up intermediate structure
  - Recursively traverse structure, for each item in the intermediate
    representation invoke the plugins
  - Expand the template for the given file
  - Output the results
  - Done!
 */
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

var TYPE = {
  DIRECTORY: 'directory',
  FILE: 'file',
  RESOURCE: 'resource'
};

// Object encapsulating resource type
var FileResource = function(path)
{
  this.path = path;
};
FileResource.prototype.name = "File Resource";

var is_markdown_file = function(filename)
{
  return (filename &&
          filename.search(/(\.md|\.mdown|\.markdown)/) >= 0);
};

/*****************************************************************************/
// Exports
/*****************************************************************************/
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
        accumulator[asset_name] = {type: TYPE.DIRECTORY,
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
          type: TYPE.FILE,
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
          type: TYPE.RESOURCE,
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

      if (data.type === TYPE.FILE)
      {
        var html_name = util.format('%s.html', file_name_parts[0]);
        var file_path = path.join(output_directory, html_name);

        // 1 - Write the HTML data to the given filename
        // TODO - pass the object through the plugin to get the
        // template expansion
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
      else if (data.type === TYPE.DIRECTORY)
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
      else if (data.type === TYPE.RESOURCE)
      {
        // Just copy it to the destination
        series_tasks.push(function copy_resource(series_callback) {
          var target_name = data.path.split(path.sep).pop();
          var target_path = path.join(output_directory, target_name);
          ncp.ncp(data.path, target_path, series_callback);
        });
      }
      async_queue.push(series_tasks);
    });
  }
};

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

var on_exit = function(error, result)
{
  if (error)
  {
    console.error(error);
  }
  else
  {
    console.log("DONE");
  }
  process.exit(1);
};

var on_data = function(error, data)
{
  var output_dir = '/Users/mweagle/stormcloud/napidocs/.out';
  var plugin_dir = '/Users/mweagle/stormcloud/napidocs/lib/plugins';

  if (data)
  {
    var series_tasks = [];
    // 1 - Remove directory
    series_tasks.push(function rmdir(series_callback) {
      rimraf(output_dir, series_callback);
    });

    // 2 - Create output directory
    series_tasks.push(function rmdir(series_callback) {
      fs.mkdir(output_dir, series_callback);
    });

    // 3 - Walk the tree
    series_tasks.push(function walk_tree(series_callback) {
      var auto_tasks = {};
      var static_output_path = path.join(output_dir, '_static');

      // Copy the static assets to the output directory
      auto_tasks.static_output_directory = function(auto_callback)
      {
        fs.mkdir(static_output_path, auto_callback);
      };
      auto_tasks.copy_static_resources = ['static_output_directory'];
      auto_tasks.copy_static_resources.push(function(auto_callback /*, auto_context */) {
                                              var static_input_path = path.join(__dirname, 'lib', '_static');
                                              ncp.ncp(static_input_path,
                                                      static_output_path,
                                                      auto_callback);
                                            });

      // a - load the plugins
      auto_tasks.list_plugins = function(auto_callback) {
        fs.readdir(plugin_dir, auto_callback);
      };

      // a1 - load the template
      auto_tasks.load_html_template = function(auto_callback) {
        var template_path = path.join(__dirname, 'lib', '_templates', 'api.html');
        fs.readFile(template_path,
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
                                        plugins[file_name_parts[0]] = require(path.join(plugin_dir, eachPluginFileName));
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
                                console.log(JSON.stringify(data, '', "  "));
                                walk_napidoc_tree(auto_context.compile_template,
                                                  auto_context.load_plugins,
                                                  data,
                                                  null,
                                                  data,
                                                  output_dir,
                                                  auto_callback);
                              }];

      // Run it
      async.auto(auto_tasks, series_callback);
    });
    async.series(series_tasks, on_exit);
  }
};
build_napidocs_context('/Users/mweagle/stormcloud/napidocs/lib/actions/_resources/resources', null, on_data);


module.exports.TYPE = TYPE;