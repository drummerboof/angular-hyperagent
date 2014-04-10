'use strict';

describe('Hyperagent Integration Test', function () {
    var HyperResource,
        $httpBackend,
        fixtures,
        $httpSpy;

    beforeEach(module('hyperagent'));

    beforeEach(module(function ($provide) {
        $httpSpy = jasmine.createSpy('$httpSpy');
        $provide.decorator('$http', function ($delegate) {
            return $httpSpy.and.callFake($delegate);
        });
    }));

    beforeEach(inject(function (_HyperResource_, _$httpBackend_, _fixtures_) {
        HyperResource = _HyperResource_;
        $httpBackend = _$httpBackend_;
        fixtures = _fixtures_;
    }));

    it('should successfully parse a sample response', function (done) {

        $httpBackend.expectGET('https://example.com').respond(fixtures.fullDoc);

        var agent = new HyperResource('https://example.com');

        expect($httpSpy).not.toHaveBeenCalled();

        agent.fetch().then(function (result) {
            expect(agent).toBe(result);
            expect(agent.props.welcome).toBe('Welcome to a haltalk server.');
            expect(agent.embedded['ht:post'].length).toBe(2);
            expect(agent.embedded['ht:post'][0].props.content).toBe('having fun w/ the HAL Talk explorer');
            expect($httpSpy).toHaveBeenCalledWith({
                url: 'https://example.com',
                headers: {
                    'Accept': 'application/hal+json, application/json, */*; q=0.01',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                method: 'GET'
            });
            done();
        });

        $httpBackend.flush();
    });

    it('should fetch a linked resource on demand', function (done) {

        $httpBackend.expectGET('http://haltalk.herokuapp.com/').respond(fixtures.fullDoc);
        $httpBackend.expectGET('http://haltalk.herokuapp.com/posts/4ff8b9b52e95950002000004').respond(fixtures.subDoc);

        var agent = new HyperResource('http://haltalk.herokuapp.com/');

        expect($httpSpy).not.toHaveBeenCalled();

        agent.fetch().then(function () {
            return agent.embedded['ht:post'][0].fetch({ force: true });
        }).then(function (post) {
            expect($httpSpy.calls.count()).toBe(2);
            expect(post.props.content).toBe('having fun w/ the HAL Talk explorer');
            expect(post.url()).toBe('http://haltalk.herokuapp.com' + post.links.self.props.href);
            expect(post.links['ht:author'].props.title).toBe('Mike Amundsen');
            done();
        });

        $httpBackend.flush();
    });

    it('should fetch the same resource only once', function (done) {

        $httpBackend.expectGET('http://haltalk.herokuapp.com/').respond(fixtures.fullDoc);

        var agent = new HyperResource('http://haltalk.herokuapp.com/');

        expect($httpSpy).not.toHaveBeenCalled();

        agent.fetch().then(function (agent) {
            expect($httpSpy).toHaveBeenCalled();
            return agent.fetch();
        }.bind(this)).then(function (agent) {
            expect($httpSpy.calls.count()).toBe(1);
            expect(agent.embedded['ht:post'][0].props.content).toBe('having fun w/ the HAL Talk explorer');
            done();
        });

        $httpBackend.flush();
    });

    it('should fetch the same resource again if forced', function (done) {

        $httpBackend.whenGET('http://haltalk.herokuapp.com/').respond(fixtures.fullDoc);

        var agent = new HyperResource('http://haltalk.herokuapp.com/');
        expect($httpSpy).not.toHaveBeenCalled();

        agent.fetch().then(function () {
            expect($httpSpy).toHaveBeenCalled();
            return agent.fetch({ force: true });
        }).then(function () {
            expect($httpSpy.calls.count()).toBe(2);
            done();
        });

        $httpBackend.flush();
    });

    // The link is not expanding properly in this test...
    it('should load templated links twice for different params', function (done) {

        $httpBackend.expectGET('http://haltalk.herokuapp.com/').respond(fixtures.fullDoc);
        $httpBackend.expectGET('http://haltalk.herokuapp.com/users/passy').respond(fixtures.fullDoc);
        $httpBackend.expectGET('http://haltalk.herokuapp.com/users/mike').respond(fixtures.fullDoc);

        var agent = new HyperResource('http://haltalk.herokuapp.com/');
        expect($httpSpy).not.toHaveBeenCalled();

        agent.fetch().then(function () {
            expect($httpSpy.calls.count()).toBe(1);
            return agent.link('ht:me', { name: 'passy' }).fetch();
        }).then(function () {
            expect($httpSpy.calls.count()).toBe(2);
            return agent.link('ht:me', { name: 'mike' }).fetch();
        }).then(function () {
            expect($httpSpy.calls.count()).toBe(3);
            done();
        });

        $httpBackend.flush();
    });

    it('should not keep stale data from templated links', function (done) {
        $httpBackend.expectGET('http://haltalk.herokuapp.com/').respond(fixtures.fullDoc);
        $httpBackend.expectGET('http://haltalk.herokuapp.com/users/passy').respond(JSON.stringify({ title: 'passy' }));
        $httpBackend.expectGET('http://haltalk.herokuapp.com/users/mike').respond(JSON.stringify({ title: 'mike' }));

        var agent = new HyperResource('http://haltalk.herokuapp.com/');

        agent.fetch().then(function () {
            return agent.link('ht:me', { name: 'passy' }).fetch();
        }).then(function () {
            expect(agent.link('ht:me', { name: 'passy' }).props.title).toBe('passy');
            return agent.link('ht:me', { name: 'mike' }).fetch();
        }).then(function () {
            expect(agent.link('ht:me', { name: 'mike' }).props.title).toBe('mike');
            done();
        });

        $httpBackend.flush();
    });

    it('should use the method specified in a link if given', function () {
        $httpBackend.expectGET('http://haltalk.herokuapp.com/').respond(fixtures.fullDoc);
        $httpBackend.expectPOST('http://haltalk.herokuapp.com/something').respond(JSON.stringify({ prop: 'value' }));

        var agent = new HyperResource('http://haltalk.herokuapp.com/');

        agent.fetch().then(function () {
            return agent.link('ht:do-something').fetch();
        }).then(function () {
            expect(agent.link('ht:do-something').props.prop).toBe('value');
        });

        $httpBackend.flush();
    });
});
