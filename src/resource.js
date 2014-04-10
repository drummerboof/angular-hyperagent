angular.module('hyperagent').factory('HyperResource', ['hyperLoader', 'HyperCurieStore', 'HyperProperties', 'HyperLazyResource', '$q', '$log', function (hyperLoader, HyperCurieStore, HyperProperties, HyperLazyResource, $q) {

    function Resource(args) {
        if (Object(args) === args) {
            this._options = args;
        } else {
            this._options = { url: args };
        }

        // Create empty attributes by default.
        this.props = new HyperProperties({});
        this.embedded = {};
        this.links = {};
        this.curies = new HyperCurieStore();

        // Set up default loadHooks
        this._loadHooks = [
            this._loadLinks,
            this._loadEmbedded,
            this._loadProperties
        ];
        // TODO: loadHooks

        this.loaded = false;
    }

    Resource.factory = function (Cls) {
        return function (object, options) {
            return new Cls(object, options);
        };
    };

    /**
     * Fetch the resource from server at the resource's URL using the `loadAjax`
     * module. By default the following instance options are passed to the AJAX
     * function:
     *
     * - headers
     * - username
     * - password
     * - url (not directly set by the user)
     *
     * In addition, all options from `options.ajax` of the Resource instance are
     * mixed in.
     *
     * Parameters:
     * - options:
     *   - force: defaults to false, whether to force a new request if the result is
     *   cached, i. e this resource is already marked as `loaded`.
     *   - ajax: optional hash of options to override the Resource AJAX options.
     *
     * Returns a promise on the this Resource instance.
     */
    Resource.prototype.fetch = function fetch(options) {
        options = _.defaults(options || {}, { force: false });

        if (this.loaded && !options.force) {
            // Could use Q sugar here, but that would break compatibility with other
            // Promise/A+ implementations.
            var deferred = $q.defer();
            deferred.resolve(this);
            return deferred.promise;
        }

        // Pick only AJAX-relevant options.
        var ajaxOptions = _.pick(this._options, 'headers', 'username', 'password', 'url');
        if (this._options.ajax) {
            _.extend(ajaxOptions, this._options.ajax);
        }
        if (options.ajax) {
            _.extend(ajaxOptions, options.ajax);
        }

        if (this.method) {
            ajaxOptions.method = this.method;
        }

        return hyperLoader(ajaxOptions).then(angular.bind(this, function _ajaxThen(response) {
            this._load(response.data);
            this.loaded = true;

            // Return the agent back.
            return this;
        }));
    };

    Resource.prototype.url = function url() {
        return this._options.url;
    };

    /**
     * Creates a new link resource identified by the given `rel` and expands the link
     * template if params are provided.
     *
     * Arguments:
     *  - rel: The rel of the link.
     *  - params: Optional parameters to expand the link if it is a templated link.
     */
    Resource.prototype.link = function link(rel, params) {
        var _link = this.links[rel];
        if (params) {
            _link.expand(params);
        }

        return _link;
    };

    /**
     * Loads the Resource.links resources on creation of the object.
     */
    Resource.prototype._loadLinks = function _loadLinks(object) {
        // HAL actually defines this as OPTIONAL
        if (object._links) {
            if (object._links.curies) {
                this._loadCuries(object._links.curies);
                // Don't expose these through the normal link interface.
                delete object._links.curies;
            }

            // Don't access through this.links to avoid triggering recursions
            if (object._links.self) {
                this._navigateUrl(object._links.self.href);
            }

            this.links = new HyperLazyResource(this, object._links, {
                factory: Resource.factory(LinkResource),
                curies: this.curies
            });
        }
    };

    /**
     * Loads the Resource.embedded resources on creation of the object.
     */
    Resource.prototype._loadEmbedded = function _loadEmbedded(object) {
        if (object._embedded) {
            this.embedded = new HyperLazyResource(this, object._embedded, {
                factory: Resource.factory(EmbeddedResource),
                curies: this.curies
            });
        }
    };


    /**
     * Loads the Resource.props resources on creation of the object.
     */
    Resource.prototype._loadProperties = function _loadProperties(object) {
        // Must come after _loadCuries
        this.props = new HyperProperties(object, {
            curies: this.curies,
            original: this.props
        });
    };

    Resource.prototype._load = function _load(object) {
        this._loadHooks.forEach(function (hook) {
            hook.bind(this)(object);
        }.bind(this));
    };

    /**
     * Saves a list of curies to the local curie store.
     */
    Resource.prototype._loadCuries = function _loadCuries(curies) {
        if (!Array.isArray(curies)) {
            console.warn('Expected `curies` to be an array, got instead: ', curies);
            return;
        }

        curies.forEach(function (value) {
            if (!value.templated) {
                console.warn('CURIE links should always be marked as templated: ', value);
            }

            this.curies.register(value.name, value.href);
        }.bind(this));
    };

    Resource.resolveUrl = function _resolveUrl(oldUrl, newUrl) {
        if (!newUrl) {
            throw new Error('Expected absolute or relative URL, but got: ' + newUrl);
        }

        var uri = new URI(newUrl);
        if (uri.is('absolute')) {
            // Replace the current url if it's absolute
            return uri.normalize().toString();
        } else if (newUrl[0] === '/') {
            return (new URI(oldUrl)).resource(newUrl).normalize().toString();
        } else {
            return new URI([oldUrl, newUrl].join('/')).normalize().toString();
        }
    };

    /**
     * Updates the internal URL to the new, relative change. This is not an
     * idempotent function.
     *
     * Returns a boolean indicating whether the navigation changed the previously
     * used URL or not.
     */
    Resource.prototype._navigateUrl = function _navigateUrl(value) {
        var newUrl = Resource.resolveUrl(this._options.url, value);
        if (newUrl !== this._options.url) {
            this._options.url = newUrl;
            return true;
        }

        return false;
    };

    function LinkResource(object, options) {
        // Inherit from Resource
        Resource.call(this, options);

        // Store href for later expansion in case it's a templated URI.
        this.href = object.href;
        this.templated = object.templated;
        this.method = object.method;

        // The href is OPTIONAL, even for links.
        if (!this.href) {
            console.warn('Link object did not provide an `href`: ', object);
        } else if (!this.templated) {
            this._navigateUrl(this.href);
        }

        this._load(object);
    }

    _.extend(LinkResource.prototype, Resource.prototype);

    LinkResource.prototype.expand = function (params) {
        if (!this.templated) {
            console.log('Trying to expand non-templated LinkResource: ', this);
        }

        var url = (new URI.expand(this.href, params)).toString();

        // If expansion triggered a URL change, consider the current data stale.
        if (this._navigateUrl(url)) {
            this.loaded = false;
        }
    };

    LinkResource.prototype.toString = function () {
        return 'LinkResource(url="' + this.url() + '")';
    };

    function EmbeddedResource(object, options) {
        // Inherit from Resource
        Resource.call(this, options);

        this._load(object);

        // Embedded resources are always considered as loaded.
        this.loaded = true;
    }

    _.extend(EmbeddedResource.prototype, Resource.prototype);

    return Resource;
}]);