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
var _ = require('underscore');
var path = require('path');
var napidocs = require('../../napidocs');

var navigation_compare_function = function(lhs_item, rhs_item)
{
  var order = 0;
  // files before directories
  if (lhs_item.type === napidocs.TYPE.FILE &&
      rhs_item.type === napidocs.TYPE.DIRECTORY)
  {
    order = -1;
  }
  else if (lhs_item.type === napidocs.TYPE.DIRECTORY &&
            rhs_item.type === napidocs.TYPE.FILE)
  {
    order = 1;
  }
  else
  {
    order = lhs_item.name.localeCompare(rhs_item.name);
  }
  return order;
};

var create_navigation_markup = function(selected_item, data, _parent_path, accumulator)
{
  var parent_path = _parent_path || '/';
  var sink = accumulator || [];

  var resources = _.reduce(data,
                          function (memo, value, name) {
                            if ([napidocs.TYPE.DIRECTORY, napidocs.TYPE.FILE].indexOf(data[name].type) >= 0)
                            {
                              memo.push(value);
                            }
                            return memo;
                          },
                          []);
  resources = resources.sort(navigation_compare_function);
  resources.forEach(function (eachResourceObject) {
    var active = (eachResourceObject === selected_item) ? 'active' : '';

    if (eachResourceObject.type === napidocs.TYPE.DIRECTORY)
    {
      var resource_path = path.join(parent_path, eachResourceObject.name);
      var dir_text = util.format('<li class="nav-header %s">%s</li>',
                              active,
                              resource_path);
      sink.push(dir_text);
      create_navigation_markup(selected_item, eachResourceObject, resource_path, sink);
    }
    else if (eachResourceObject.type === napidocs.TYPE.FILE)
    {
      var link_path = path.join(parent_path, eachResourceObject.output_name);
      var file_text = util.format('<li class="%s"><a href="%s">%s</a></li>',
                              active,
                              link_path,
                              eachResourceObject.base_name);
      sink.push(file_text);
    }
  });
  return sink;
};

module.exports = function(asset_obj, parent_obj, all_data)
{
  return create_navigation_markup(asset_obj, all_data).join('');
};