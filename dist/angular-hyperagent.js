angular.module('hyperagent', []);
;angular.module('hyperagent').factory('HyperCurieStore', [function () {

    /**
     * A simple data storage to register and expand CURIES:
     * http://www.w3.org/TR/curie/
     */
    function CurieStore() {
        this._store = {};
    }

    CurieStore.prototype.register = function register(key, value) {
        this._store[key] = URITemplate(value);
    };

    CurieStore._split = function (value) {
        var index = value.indexOf(':');
        var curie = value.substring(0, index);
        var ref = value.substring(index + 1);

        if (value === -1 || value === (value.length - 1)) {
            return null;
        }

        return [curie, ref];
    };

    /**
     * Boolean if the store is empty.
     */
    CurieStore.prototype.empty = function empty() {
        return Object.keys(this._store).length === 0;
    };

    /**
     * Expands a CURIE value or returns the value back if it cannot be
     * expanded.
     */
    CurieStore.prototype.expand = function expand(value) {
        var template;
        var curie = CurieStore._split(value);

        if (!curie) {
            return value;
        }

        template = this._store[curie[0]];
        if (template === undefined) {
            return value;
        }

        return template.expand({ rel: curie[1] });
    };

    /**
     * A boolean indicator whether a value can (probably) be expanded.
     */
    CurieStore.prototype.canExpand = function canExpand(value) {
        var curie = CurieStore._split(value);

        if (!curie) {
            return false;
        }

        return this._store[curie[0]] !== undefined;
    };

    return CurieStore;
}]);


;angular.module('hyperagent').factory('HyperLazyResource', ['$injector', function ($injector) {

    /**
     * Wrap a resource inside a lazy container that loads all properties of the
     * given `object` on access in a Resource.
     *
     * Arguments:
     *  - parentResource: the parent resource the new lazy one inherits its options
     *    from
     *  - object: the object to wrap
     *  - options: optional options
     *    - factory: A function taking a the object and the options to wrap inside a
     *      Resource.
     */
    function LazyResource(parentResource, object, options) {
        this._parent = parentResource;
        this._options = _.defaults(options || {}, {
            factory: function (object, options) {
                var Resource = $injector.get('HyperResource');
                var resource = new Resource(options);
                resource._load(object);

                return resource;
            }
        });

        // Set _parent and _options to not be enumerable, to allow easy looping over
        // all entries.
        Object.defineProperties(this, {
            _parent: {
                enumerable: false
            },
            _options: {
                enumerable: false
            }
        });

        _.each(object, angular.bind(this, function (obj, key) {
            if (Array.isArray(obj)) {
                this._setLazyArray(key, obj, true);
            } else {
                this._setLazyObject(key, obj, true);
            }
        }));

        // Again for curies
        var curies = this._options.curies;
        if (curies && !curies.empty()) {
            _.each(object, angular.bind(this, function (obj, key) {
                if (curies.canExpand(key)) {
                    var expanded = curies.expand(key);

                    if (Array.isArray(obj)) {
                        this._setLazyArray(expanded, obj, false);
                    } else {
                        this._setLazyObject(expanded, obj, false);
                    }
                }
            }));
        }
    }

    LazyResource.prototype._setLazyObject = function _setLazy(key, object, enumerable) {
        // Define a lazy getter for the resource.
        Object.defineProperty(this, key, {
            enumerable: enumerable,
            get: this._makeGetter(object)
        });
    };

    LazyResource.prototype._setLazyArray = function _setLazy(key, array, enumerable) {
        // Define a lazy getter for the resource that contains the array.
        Object.defineProperty(this, key, {
            enumerable: enumerable,
            get: function () {
                return array.map(angular.bind(this, function (object) {
                    return this._makeGetter(object)();
                }));
            }
        });
    };

    LazyResource.prototype._makeGetter = function _makeGetter(object) {
        var parent = this._parent;
        var options = this._options;
        var instance;

        return function () {
            if (instance === undefined || options.skipCache) {
                instance = new options.factory(object, _.clone(parent._options));
            }
            return instance;
        };
    };

    return LazyResource;
}]);
;angular.module('hyperagent').factory('hyperLoader', ['$q', '$http', function ($q, $http) {

    function loadAjax (options) {
        var httpOptions = angular.copy(options);

        httpOptions.headers = _.extend(httpOptions.headers || {}, {
            'Accept': 'application/hal+json, application/json, */*; q=0.01'
        });

        httpOptions.method = httpOptions.method || 'GET';

        return $http(httpOptions);
    }

    return loadAjax;
}]);
;angular.module('hyperagent').factory('HyperProperties', [function () {

    function Properties(response, options) {

        // TODO: This function is too large. Let's figure out if we could instead build
        // one large object for defineProperties first and call on that in the end
        // and if that would make the code cleaner.
        options = options || {};
        if (Object(response) !== response) {
            throw new Error('The Properties argument must be an object.');
        }
        // Overwrite the response object with the original properties if provided.
        _.defaults(response, options.original || {});

        var skipped = ['_links', '_embedded', '_warnings'];
        Object.keys(response).forEach(angular.bind(this, function (key) {
            if (!_.contains(skipped, key)) {
                this[key] = response[key];
            }
        }));

        // Set up curies
        var curies = options.curies;
        if (!curies) {
            return;
        }

        Object.keys(this).forEach(angular.bind(this, function (key) {
            if (curies.canExpand(key)) {
                Object.defineProperty(this, curies.expand(key), {
                    enumerable: true,
                    value: this[key]
                });
            }
        }));
    }

    return Properties;
}]);;angular.module('hyperagent').factory('HyperResource', ['hyperLoader', 'HyperCurieStore', 'HyperProperties', 'HyperLazyResource', '$q', '$log', function (hyperLoader, HyperCurieStore, HyperProperties, HyperLazyResource, $q) {

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
        this.warnings = {};
        this.curies = new HyperCurieStore();

        // Set up default loadHooks
        this._loadHooks = [
            this._loadLinks,
            this._loadEmbedded,
            this._loadProperties,
            this._loadWarnings
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
    /**
     * Refresh the resource from server at the resource's URL using the self link
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
     *   - force: defaults to true, whether to force a new request if the result is
     *   cached, i. e this resource is already marked as `loaded`.
     *   - ajax: optional hash of options to override the Resource AJAX options.
     *
     * Returns a promise on the this Resource instance.
     */
    Resource.prototype.refresh = function refresh(options) {
        options = _.defaults(options || {}, { force: true });
        return this.fetch(options);
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
     * Return the warnings associated with the given rel name. Warnings are a way to identify
     * why a given link is not present in the resource.
     *
     * @param rel
     * @returns {Array}
     */
    Resource.prototype.linkWarnings = function (rel) {
        var warnings = [];
        if (!this.hasLink(rel)) {
            warnings = _.has(this.warnings, rel) ? _.keys(this.warnings[rel]) : ['unknownLinkError'];
        }
        return warnings;
    };

    /**
     * Return true if this resource contains the link identified by the given rel. False otherwise
     *
     * @param rel
     * @returns {Boolean}
     */
    Resource.prototype.hasLink = function hasLink(rel) {
        return _.has(this.links, rel);
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
                curies: this.curies,
                skipCache: true
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

    /**
     * Loads warnings from the response
     *
     * @param object
     * @private
     */
    Resource.prototype._loadWarnings = function _loadWarnings(object) {
        if (_.has(object, '_warnings')) {
            this.warnings = _.isArray(object._warnings) ? object._warnings[0] : object._warnings;
        }
    };

    Resource.prototype._load = function _load(object) {
        this._loadHooks.forEach(_.bind(function (hook) {
            _.bind(hook, this)(object);
        }, this));
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
