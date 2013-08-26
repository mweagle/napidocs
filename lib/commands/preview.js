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
var http = require('http');
var util = require('util');
var path = require('path');
var fs = require('fs');
var node_static = require('node-static');
var CONSTANTS = require('../CONSTANTS');
var build_command = require('./build');

/*****************************************************************************/
// Privates
/*****************************************************************************/

var server_instance = null;

var reload_server = function(docs_output_path, port)
{
  var reload_timeout_id = null;

  var reload = function()
  {
    console.log('Reloading site files: ' + docs_output_path);
    var url = util.format('http://localhost:%d', port);
    console.log('Documentation available at: ' + url);
    var file = new node_static.Server(docs_output_path, { cache: false });
    server_instance = http.createServer(function (request, response) {
      request.on('end', function () {
          //
          // Serve files!
          //
          file.serve(request, response, function (err /*, result*/) {
            if (err)
            {
              console.error(request.url + ' - ' + util.inspect(err));
            }
          });
      }).resume();
    }).listen(port);
  };

  if (server_instance)
  {
    server_instance.close();
    server_instance = null;
    if (reload_timeout_id)
    {
      clearTimeout(reload_timeout_id);
    }
    reload_timeout_id = setTimeout(reload, 333);
  }
  else
  {
    reload();
  }
};

/*****************************************************************************/
// Exports
/*****************************************************************************/

module.exports.options  = function(optimist_instance)
{
  optimist_instance.usage('Preview a NapiDocs site');

  // Source
  optimist_instance
          .demand('s')
          .alias('s', 'source')
          .describe('s', "Source directory (eg, parent directory of /docs)");

  // Output
  optimist_instance
          .alias('p', 'port')
          .default(9696)
          .describe('p', "Alternative HTTP preview server port.  Defaults to 9696");

};

module.exports.run = function(parsed_options /*, completion_callback */)
{
  // Watch the /docs directory.  When it changes, run the
  // build command to generate the updated output
  var source_directory = path.resolve(parsed_options.s);
  var docs_directory = path.join(source_directory, CONSTANTS.DIRECTORY.DOCS);
  var output_directory = path.join(source_directory, CONSTANTS.DIRECTORY.BUILD);

  var port = parsed_options.p || 9696;

  // Rebuild the site on source input changes
  console.log("Watching source diretory: " + docs_directory);
  fs.watchFile(docs_directory, function (/*curr, prev */) {
    var on_build_complete = function(err /*, result */)
    {
      if (err)
      {
        console.error(err);
      }
      else
      {
        console.log("Site rebuilt");
      }
    };
    build_command.run(parsed_options, on_build_complete);
  });

  // Load it up
  fs.watch(docs_directory, function () {
    console.log("Docs changed.  Reloading");
    reload_server(output_directory, port);
  });
  build_command.run(parsed_options, function (/*err, results*/) {
    reload_server(output_directory, port);
  });
};