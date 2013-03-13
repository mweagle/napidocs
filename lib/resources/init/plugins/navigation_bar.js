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
var _ = require('./lib/underscore');
var path = require('path');
var CONSTANTS = require('./CONSTANTS');
var RE_INDEX_HTML = /index/gi;

var navigation_compare_function = function(lhs_item, rhs_item)
{
  var order = 0;
  // files before directories
  if (lhs_item.type === CONSTANTS.ITEM_TYPE.FILE &&
      rhs_item.type === CONSTANTS.ITEM_TYPE.DIRECTORY)
  {
    order = -1;
  }
  else if (lhs_item.type === CONSTANTS.ITEM_TYPE.DIRECTORY &&
            rhs_item.type === CONSTANTS.ITEM_TYPE.FILE)
  {
    order = 1;
  }
  else
  {
    order = lhs_item.name.localeCompare(rhs_item.name);
  }
  return order;
};

var sorted_toc_resources = function(data)
{
  var resources = _.reduce(data,
                          function (memo, value, name) {
                            if ([CONSTANTS.ITEM_TYPE.DIRECTORY, CONSTANTS.ITEM_TYPE.FILE].indexOf(data[name].type) >= 0)
                            {
                              memo.push(value);
                            }
                            return memo;
                          },
                          []);
  return resources.sort(navigation_compare_function);
};

var filename_to_display_name = function(name)
{
  return name.replace(/[\-\/:]/, '/');
};

var create_navigation_markup = function(selected_item,
                                        data,
                                        _link_prefix,
                                        _display_prefix,
                                        accumulator)
{
  var parent_link_path = _link_prefix || '/';
  var parent_display_path = _display_prefix || '/';
  var sink = accumulator || [];

  var resources = sorted_toc_resources(data);

  // If there is a parent directory and an index.html file,
  // track that s.t. we can append the link object
  var parent_directory_index_entry = (sink.length > 0) ? (sink.length-1) : null;

  // Group the files, directories
  var groups = _.groupBy(resources, 'type');

  if (groups[CONSTANTS.ITEM_TYPE.FILE])
  {
    sink.push('<ul class="nav nav-pills">');
    groups[CONSTANTS.ITEM_TYPE.FILE].forEach(function (eachResourceObject) {
      var active = (eachResourceObject === selected_item) ? 'active' : '';
      var file_link_path = path.join(parent_link_path, eachResourceObject.output_name);

      if (eachResourceObject.base_name.match(RE_INDEX_HTML) &&
          parent_directory_index_entry)
      {
        var parent_html = sink[parent_directory_index_entry];
        parent_html = util.format("<a href='%s' class='%s'>%s</a>",
                                  file_link_path,
                                  active,
                                  parent_html);
        sink[parent_directory_index_entry] = parent_html;
      }
      else
      {
        var display_name = filename_to_display_name(eachResourceObject.base_name);
        var file_text = util.format('<li class="%s"><a href="%s">%s</a></li>',
                                active,
                                file_link_path,
                                display_name);
        sink.push(file_text);
      }
    });
    sink.push('</ul>');
  }

  if (groups[CONSTANTS.ITEM_TYPE.DIRECTORY])
  {
    groups[CONSTANTS.ITEM_TYPE.DIRECTORY].forEach(function (eachResourceObject) {
      var active = (eachResourceObject === selected_item) ? 'active' : '';

      var directory_link_path = path.join(parent_link_path, eachResourceObject.name);
      var resource_display_name = path.join(parent_display_path, eachResourceObject.name);

      var dir_text = util.format('<li class="nav-header %s">%s</li>',
                              active,
                              resource_display_name);

      sink.push(dir_text);
      create_navigation_markup(selected_item,
                              eachResourceObject,
                              directory_link_path,
                              resource_display_name,
                              sink);
    });
  }
  return sink;
};

module.exports = function(url_prefix, asset_obj, parent_obj, all_data)
{
  // Find all the immediate children and create those links...
  var immediate_directories = [];

  var toc = [];
  var sorted = sorted_toc_resources(all_data);
  sorted.forEach(function (eachResourceObject) {
    if (eachResourceObject.type === CONSTANTS.ITEM_TYPE.FILE)
    {
      var active = (eachResourceObject === asset_obj) ? 'active' : '';
      var link_path = util.format('%s%s', url_prefix, eachResourceObject.output_name);
      var display_name = filename_to_display_name(eachResourceObject.base_name);
      var file_text = util.format('<li class="%s"><a href="%s">%s</a></li>',
                              active,
                              link_path,
                              display_name);
      toc.push(file_text);
    }
    else if (eachResourceObject.type === CONSTANTS.ITEM_TYPE.DIRECTORY)
    {
      immediate_directories.push(eachResourceObject);
    }
  });

  // Then the resources
  immediate_directories.forEach(function (eachDirectoryObject) {
    toc.push(util.format('<li><h4>%s</h4></li>',
                          eachDirectoryObject.name));
    create_navigation_markup(asset_obj,
                              eachDirectoryObject,
                              url_prefix + eachDirectoryObject.name,
                              null,
                              toc);
  });
  return toc.join('');
};