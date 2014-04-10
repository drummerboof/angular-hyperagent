angular.module('hyperagent').factory('hyperLoader', ['$q', '$http', function ($q, $http) {

    function loadAjax (options) {
        var httpOptions = angular.copy(options);

        httpOptions.headers = _.extend(httpOptions.headers || {}, {
            'Accept': 'application/hal+json, application/json, */*; q=0.01',
            'X-Requested-With': 'XMLHttpRequest'
        });

        return $http(httpOptions);
    }

    return loadAjax;
}]);
