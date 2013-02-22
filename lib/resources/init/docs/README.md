<div class='hero-unit'>

<h1>NapiDocs</h1>

REST Documentation Generator
<br />
Would you use a REST-style service without human-friendly documentation?
<p />
<img src='/cop-out-nope.gif'>
</div>


## What is it?

NapiDocs is a set of [Node.js](http://nodejs.org/) command line scripts
that transform a directory of Markdown files and supporting resources
into a static HTML site pages documenting a REST-style service.

## What's Included?

* [Twitter Bootstrap](http://twitter.github.com/bootstrap)
* [Alternative Bootswatch Themes](http://bootswatch.com/)
* [Highlight.js](http://softwaremaniacs.org/soft/highlight/en/)

## Documentation Workflow

Before you begin iterating on your documentation, you'll need to:

  * `git clone https://github.com/mweagle/napidocs.git ~/napidocs`
  * cd ~/napidocs
  * `npm install`

Then you can start to write your documentation:

1. Initialize an empty NapiDocs directory: `node napidocs.js init -t ~/NapiDocs"`
  * This will create the following directory structure:
      * `/_static`: Static resources (CSS, JS) that will be copied to the target output
      * `/build`: The built output that should be statically hosted.
      * `/docs`: The tree of Markdown files that comprise your service's documentation.
      * `/plugins`: Plugins used to transform the internal documentation tree to HTML output.  Plugins are referenced in the `/template/api.html` file.
      * `/template`: Includes the `api.html` file that is used to generate each documentation page.
2. Preview the documentation: `node napidocs.js preview -s ~/NapiDocs`
  * This will build the documentation and start a local [static file-server](https://github.com/cloudhead/node-static) to serve up the pages on port 9696.  The port can be overriden using the `-p/--port` command line argument
3. Update the the documentation inputs:
  * Update `/template/api.html`:
      * Change the _head/meta_ elements for your service
      * Change the template markup
      * Optionally change the CSS style
      * Optionally change the [highlights.js style](http://softwaremaniacs.org/media/soft/highlight/test.html) reference
  * All immediate `/docs` child directories are transformed into Group headers in the sidebar.  Delete any immediate directories that don't apply to your service.
  * Like the [Hero Unit](http://twitter.github.com/bootstrap/components.html#typography) at the top of this page, you can reference Twitter Bootstrap styles in your Markdown.
4. Repeat steps 2 and 3 as needed
5. Build the site: `node napidocs.js build --source ~/NapiDocs`
6. Host the documentation (`~/NapiDocs/build`) on a static server.
  * For example, a version of this documentation is hosted on [S3](http://napidocs.s3-website-us-west-2.amazonaws.com/README.html)

## Custom Plugins

If you want to customize the output, you can write a custom plugin and reference it in `/template/api.html`.  For example:

    <ul class="nav nav-list">
      <%= my_custom_plugin %>
    </ul>

will instruct NapiDocs to look for `~/NapiDocs/plugins/my_custom_plugin.js`
in the documentation directory.

Plugins must export a single function:

    /**
     * Return HTML for the given asset object
     * @param  {Object} asset_obj  The current asset being rendered (Markdown or directory)
     * @param  {Object} parent_obj The parent asset of asset_obj, may be null/empty
     * @param  {Object} all_data   The entire accumulated internal documentation representation
     * @return {String}            HTML content
     */
    module.exports = function(asset_obj, parent_obj, all_data)
    {
      // Return HTML string
    }

The [internal representation](./dump.json) is visible by providing the `-d/--dump` command line
option to the `node napidocs.js build` command.
