## Resources

If [Level 3](http://martinfowler.com/articles/richardsonMaturityModel.html)
[HATEOS](http://en.wikipedia.org/wiki/HATEOAS) is an aspirational goal
for your service, then resources are probably pretty important to you.

Note that the the `/items/{item_id}` resource uses a
[URL Template](http://www.mnot.net/javascript/url_template/) pattern
to emphasize your clients that they need to substitute a value.

This README is often a good place to put common service information such
as:

  * ETags
  * Authentication
  * Rate Throttling
  * etc.