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

/*****************************************************************************/
// Privates
/*****************************************************************************/
var http = require('http');
var util = require('util');
var fs = require('fs');
var node_static = require('node-static');

var server_instance = null;
var site_path = '/Users/mweagle/stormcloud/napidocs/.out';

var rebind_server = function(static_path)
{
  console.log('Reloading static files: ' + static_path);
  if (server_instance)
  {
    server_instance.close();
  }
  var file = new(node_static.Server)(static_path, { cache: false });
  server_instance = http.createServer(function (request, response) {
    request.addListener('end', function () {
        //
        // Serve files!
        //
        file.serve(request, response, function (err /*, result*/) {
          if (err)
          {
            console.error(request.url + ' - ' + util.inspect(err));
          }
        });
    });
  }).listen(9696);
};

/*****************************************************************************/
// Exports
/*****************************************************************************/

module.exports.options  = function(optimist_instance)
{
  optimist_instance.usage('Create a new napidocs site');

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

rebind_server(site_path);
fs.watchFile(site_path, function (curr, prev) {
  rebind_server(site_path);
});

