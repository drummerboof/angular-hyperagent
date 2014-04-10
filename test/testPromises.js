describe('Test p', function () {
   var $q, $rootScope;

    beforeEach(module('hyperagent'));

    beforeEach(inject(function (_$q_, _$rootScope_) {
        $q = _$q_;
        $rootScope = _$rootScope_;
    }));

    it('should do stuff', function (done) {
       var deferred1 = $q.defer();

       var a = function () {
           return deferred1.promise;
       };

        a().then(function (v) {
            console.log(arguments);
            expect(v).toBe(5);
            done();
        });

        deferred1.resolve(5);
        $rootScope.$apply();
    });

    it('should do chained stuff', function () {
        var deferred1 = $q.defer(),
            deferred2 = $q.defer();

        var a = function () {
            return deferred1.promise;
        };

        var b = function () {
            return deferred2.promise;
        }

        a().then(function (v) {
            expect(v).toBe(5);
            return b();
        }).then(function (v) {
            expect(v).toBe(9);
//            done();
        });

        deferred1.resolve(5);
        deferred2.resolve(7);

        $rootScope.$apply();
    });
});