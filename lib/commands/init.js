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
var fs = require('fs');
var util = require('util');
var async = require('async');
var rimraf = require('rimraf');
var path = require('path');
var ncp = require('ncp');
var mkdirp = require('mkdirp');
var CONSTANTS = require('../CONSTANTS');

/*****************************************************************************/
// Privates
/*****************************************************************************/

/*****************************************************************************/
// Exports
/*****************************************************************************/

module.exports.options  = function(optimist_instance)
{
  optimist_instance.usage('Create a new NapiDocs site');

  // Target
  optimist_instance
          .demand('t')
          .alias('t', 'target')
          .describe('t', "Target directory for new site");

  // Force
  optimist_instance
          .boolean('f')
          .alias('f', 'force')
          .describe('f', "Forcibly overwrite the contents of the target directory");
};

module.exports.run = function(parsed_options, completion_callback)
{
  var series_tasks = [];
  var target_path = path.resolve(parsed_options.t);

  // 1. Verify the output directory
  series_tasks.push(function (series_callback)
  {
    try
    {
      var fs_stats = fs.statSync(parsed_options.t);
      if (!parsed_options.f)
      {
        var msg = util.format("Path %s exists.  Provide `-f/--force` to overwrite.",
                              parsed_options.t);
        series_callback(new Error(msg));
      }
      else if (fs_stats.isFile())
      {
        fs.unlink(parsed_options.t, series_callback);
      }
      else
      {
        // Delete it
        rimraf(parsed_options.t, series_callback);
      }
    }
    catch (e)
    {
      // No directory, create the root
      series_callback(null);
    }
  });

  // 2 - Create the output_docs_directory
  series_tasks.push(function (series_callback) {
    mkdirp(parsed_options.t, series_callback);
  });

  // 3 - Copy the dummy resources there
  series_tasks.push(function (series_callback) {
    var resource_path = path.join(__dirname, '..', 'resources', 'init');
    ncp.ncp(resource_path, parsed_options.t, series_callback);
  });

  // 4 - Copy the CONSTANTS.js file to the plugins
  // directory s.t. they can require() the input
  // for type-aware branching
  series_tasks.push(function (series_callback) {
    var constants_path = path.join(__dirname, '..', 'CONSTANTS.js');
    var plugins_directory = path.join(parsed_options.t, CONSTANTS.DIRECTORY.PLUGINS);
    var constants_dest = path.join(plugins_directory, 'CONSTANTS.js');
    ncp.ncp(constants_path, constants_dest, series_callback);
  });

  // Build the documentation
  series_tasks.push(function (series_callback) {
    var build_options = {
      s: parsed_options.t
    };
    var build_command = require('./build');
    build_command.run(build_options, series_callback);
  });

  var terminus = function(error /*, results */)
  {
    console.log("Initialized NapiDocs directory: " + parsed_options.t);
    var command = util.format('node napidocs.js preview -s %s', parsed_options.t);
    console.log(util.format('Run `%s` to preview the site'), command);
    completion_callback(error, '');
  };
  async.series(series_tasks, terminus);
};