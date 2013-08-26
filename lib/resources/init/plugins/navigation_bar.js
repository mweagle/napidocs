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
var open_panel_entry = function(title, active, link_target, depth)
{
  var lines = [];
  var text = link_target ?
              util.format('<em><a href="%s">%s%s%s</a></em>',
                            link_target,
                            active ? '<strong>' : '',
                            title,
                            active ? '</strong>' : '') :
              title;

  if (!depth || depth <= 0)
  {
    lines.push(util.format('<h4>%s</h4>', text));
  }
  else
  {
    lines.push('<div class="panel panel-default">');
    lines.push(util.format('<div class="panel-heading"><h5 class="panel-title">%s</h5></div>',
                            text));
    lines.push('<div class="panel-body">');
  }
  return lines.join('');
};

var close_panel_entry = function(depth)
{
  return (!depth || depth <= 0) ?
          '' :
          '</div></div>';
};

var create_navigation_markup = function(selected_item,
                                        data,
                                        _link_prefix,
                                        _display_prefix,
                                        accumulator,
                                        depth)
{
  var immediate_child = (!depth || depth <= 0);
  var parent_link_path = _link_prefix || '/';
  var parent_display_path = _display_prefix || '/';
  var sink = accumulator || [];

  var resources = sorted_toc_resources(data);

  // Group the files, directories
  var groups = _.groupBy(resources, 'type');

  // First figure out if there is an index.html that we're supposed
  // to use for the panel heading
  var files = groups[CONSTANTS.ITEM_TYPE.FILE] || [];
  var directory_resource_object = _.find(files || [], function (eachResourceObject) {
    return eachResourceObject.base_name.match(RE_INDEX_HTML);
  });

  // If this immediate children, then just go with a header
  var block_close = null;
  var panel_display_name = immediate_child ? data.base_name : parent_display_path;
  if (immediate_child)
  {
    if (directory_resource_object)
    {
      var file_link_path = path.join(parent_link_path,
                                      directory_resource_object.output_name);
      sink.push(util.format('<h4><a href="%s">%s</a></h4>\n'),
                  file_link_path,
                  panel_display_name);
    }
    else
    {
      sink.push(util.format('<h4>%s</h4>\n',
                panel_display_name));
    }
  }
  else
  {
    var file_link = directory_resource_object ?
                          path.join(parent_link_path, directory_resource_object.output_name) :
                          null;
    var active = (directory_resource_object === selected_item);
    sink.push(open_panel_entry(panel_display_name, active, file_link, depth));
  }
  block_close = close_panel_entry.bind(this, depth);

  // Then dump all the files into a breadcrumb viewer
  var child_files = directory_resource_object ? _.without(files, directory_resource_object) : files;
  if (!_.isEmpty(child_files))
  {
    sink.push('<ol class="breadcrumb">');
    files.forEach(function(eachFileObject) {
      if (eachFileObject !== directory_resource_object)
      {
        var active = (eachFileObject === selected_item);
        var file_link_path = path.join(parent_link_path,
                                      eachFileObject.output_name);
        sink.push(util.format('<li>%s<a href="%s">%s</a>%s</li>',
                    active ? '<strong>' : '',
                    file_link_path,
                    eachFileObject.base_name,
                    active ? '</strong>' : ''));
      }
    });
    sink.push('</ol>');
  }
  if (block_close)
  {
    sink.push(block_close());
  }


  // Directory listings
  var directories = groups[CONSTANTS.ITEM_TYPE.DIRECTORY] || [];
  directories.forEach(function (eachDirectoryObject) {
    var directory_link_path = path.join(parent_link_path, eachDirectoryObject.name);
    var resource_display_name = path.join(parent_display_path, eachDirectoryObject.name);
    create_navigation_markup(selected_item,
                              eachDirectoryObject,
                              directory_link_path,
                              resource_display_name,
                              sink,
                              depth + 1);
  });
  return sink;
};

module.exports = function(url_prefix, asset_obj, parent_obj, all_data)
{
  var toc = [];
  toc.push('<div class="well sidebar-nav">');
  toc.push('<ul class="nav">');

  // Find all the immediate children and create those links...
  var immediate_child_directories = [];

  var sorted = sorted_toc_resources(all_data);
  sorted.forEach(function (eachResourceObject) {
    if (eachResourceObject.type === CONSTANTS.ITEM_TYPE.FILE)
    {
      var active = (eachResourceObject === asset_obj);
      var link_path = util.format('%s%s', url_prefix, eachResourceObject.output_name);
      var display_name = filename_to_display_name(eachResourceObject.base_name);
      var file_text = util.format('<li><a href="%s">%s%s%s</a></li>',
                              link_path,
                              active ? '<strong>' : '',
                              display_name,
                              active ? '</strong>' : '');
      toc.push(file_text);
    }
    else if (eachResourceObject.type === CONSTANTS.ITEM_TYPE.DIRECTORY)
    {
      immediate_child_directories.push(eachResourceObject);
    }
  });

  // Then the resources
  immediate_child_directories.forEach(function (eachDirectoryObject) {
    create_navigation_markup(asset_obj,
                              eachDirectoryObject,
                              url_prefix + eachDirectoryObject.name,
                              null,
                              toc,
                              0);
  });
  toc.push('</ul>');
  toc.push('</div>');

  return toc.join('');
};