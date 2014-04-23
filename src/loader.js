angular.module('hyperagent').factory('hyperLoader', ['$q', '$http', function ($q, $http) {

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
