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

var util = require('util');
var path = require('path');
var package_js = require('./package.json');
var fs = require('fs');
var _ = require('underscore');
var COMMAND_DIR = path.join(__dirname, 'lib', 'commands');

/*****************************************************************************/
// Privates
/*****************************************************************************/
var _command_list = function ()
{
  var command_names = fs.readdirSync(COMMAND_DIR);
  var names = _.reduce(command_names,
                       function (memo, name) {
                        var command_path = path.join(COMMAND_DIR, name);
                        var stats = fs.lstatSync(command_path);
                        if (stats.isFile())
                        {
                          var command_name = name.split('.');
                          memo.push(command_name[0]);
                        }
                        return memo;
                       },
                       []);
  return names;
};

var on_command = function(command_name, additional_arguments)
{
  try
  {
    var command = null;
    console.log('-------------------------------------------------------------------------------');
    console.log(util.format('Welcome to NapiDocs (%s)', package_js.version));
    console.log('-------------------------------------------------------------------------------');
    try
    {
      var command_path = path.join(COMMAND_DIR, command_name);
      command = require(command_path);
    }
    catch (err)
    {
      if (!command_name)
      {
        throw new Error("Please provide a command name argument");
      }
      else
      {
        var msg = util.format("Unsupported command: %s.  Recognized commands: %s",
                              command_name,
                              _command_list().join(','));
        throw new Error(msg);
      }
    }
    // Run it
    var optimist = require('optimist')(additional_arguments);
    command.options(optimist);
    var parsed_args = optimist.argv;

    var on_command_exit = function(error, results)
    {
      if (error)
      {
        console.error(error);
      }
      else if (results)
      {
        console.log(results);
      }
      process.exit(error ? 1 : 0);
    };
    command.run(parsed_args, on_command_exit);
  }
  catch (e)
  {
    console.error(e);
  }
};

/*****************************************************************************/
// Main
/*****************************************************************************/

// Catch everything
process.on('uncaughtException', function (err) {
  console.error(err);
  process.exit(1);
});

// First is node
// Second is this script
var all_args = process.argv.slice(2);
var command_name = all_args.shift();

// Then run the command
on_command(command_name, all_args);
