'use strict';

describe('HyperLazyResource', function () {

    var HyperLazyResource,
        HyperResource;

    beforeEach(module('hyperagent'));

    beforeEach(inject(function (_HyperLazyResource_, _HyperResource_) {
        HyperLazyResource = _HyperLazyResource_;
        HyperResource = _HyperResource_;
    }));

    it('should create resources on access', function () {
        var lazy = new HyperLazyResource({
            url: 'https://example.com'
        }, { foo: { bar: 'baz' } });
        expect(lazy.foo.props.bar).toEqual('baz');
    });

    it('should allow custom factory method', function () {
        var parent = new HyperLazyResource({
            url: 'http://example.com'
        });
        var lazy = new HyperLazyResource(parent, {
            foo: {}
        }, {
            factory: function (object, options) {
                var resource = new HyperResource(options);
                resource._load(object);
                resource.omfg = true;
                return resource;
            }
        });

        expect(lazy.foo.omfg).toBe(true);
    });

    it('should set sub-resource urls', function () {
        var parent = new HyperResource({ url: 'http://example.com/' });
        var lazy = new HyperLazyResource(parent, {
            foo: {
                _links: {
                    self: { href: 'http://example.com/foo/' }
                },
                title: 'bar'
            }
        });

        expect(lazy.foo.props.title).toEqual('bar');
        expect(parent.url()).toEqual('http://example.com/');
        expect(lazy.foo.url()).toEqual('http://example.com/foo/');
    });
});
