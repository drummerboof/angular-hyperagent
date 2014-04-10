'use strict';

describe('hyperLoader', function () {

    var hyperLoader,
        $httpBackend;

    beforeEach(module('hyperagent'));

    beforeEach(inject(function (_hyperLoader_, _$httpBackend_) {
        hyperLoader = _hyperLoader_;
        $httpBackend = _$httpBackend_;
    }));

    it('should call $http with the correct arguments', function () {
        $httpBackend.expectGET('/test', {
            'Accept': 'application/hal+json, application/json, */*; q=0.01',
            'X-Requested-With': 'XMLHttpRequest',
            test: 'value'
        }).respond({});

        hyperLoader({
            url: '/test',
            headers: {
                test: 'value'
            }
        });

        $httpBackend.flush();
    });

});