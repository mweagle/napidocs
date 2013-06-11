## Changes

### 0.0.6
* Upgrade dependencies in package.json
* Require Node 0.10.10 in package.json definition

### 0.0.5
* Use `path.resolve` to avoid plugin load failures when using relative paths

### 0.0.4

* BREAKING CHANGE: Updated plugin signature to `(url_prefix, asset_obj, parent_obj, all_data)` so that plugins can create links have access to the optional user-supplied URL prefix.
* Add `-p/--prefix` command line argument to `build` command
  * This option allows you to customize the URL prefix used for the generated pages
  * Defaults to '/'
  * If you provide this value, you will likely need to also customize the `/template/api.html` file in your documentation directory.  This template has references to the 'static' resources associated with your documentation.

### 0.0.3

* Handle plugin _underscore_ references by copying underscore.js to the `{docs}/plugins/lib` directory.
* Output list of supported commands if supplied command cannot be resolved.

### 0.0.2

* Support *index.md* files for subdirectories.
  * Child directories at depth > 2 can optionally include an *index.md* file for content that should be linked to the directory itself.
* Include [FontAwesome](http://fortawesome.github.com/Font-Awesome/) for additional styling options

### 0.0.1

* Initial release