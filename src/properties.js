angular.module('hyperagent').factory('HyperProperties', [function () {

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

        var skipped = ['_links', '_embedded'];
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
}]);