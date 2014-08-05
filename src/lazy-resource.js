angular.module('hyperagent').factory('HyperLazyResource', ['$injector', function ($injector) {

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
        var cache = null;
        Object.defineProperty(this, key, {
            enumerable: enumerable,
            get: function () {
                if (cache === null) {
                    cache = array.map(angular.bind(this, function (object) {
                        return this._makeGetter(object)();
                    }));
                }

                return cache;
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
