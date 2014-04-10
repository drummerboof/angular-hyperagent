'use strict';

describe('hyperLoader', function () {

    var hyperLoader,
        $httpBackend,
        $httpSpy;

    beforeEach(module('hyperagent'));

    beforeEach(module(function ($provide) {
        $httpSpy = jasmine.createSpy('$httpSpy');
        $provide.decorator('$http', function ($delegate) {
            return $httpSpy.and.callFake($delegate);
        });
    }));

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

    it('should default method to GET', function () {

        hyperLoader({
            url: '/test',
            headers: {
                test: 'value'
            }
        });
        console.log($httpSpy.calls.argsFor(0));

        expect($httpSpy.calls.argsFor(0)[0].method).toBe('GET');
    });

});