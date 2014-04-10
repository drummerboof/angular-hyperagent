'use strict';

describe('HyperProperties', function () {

    var HyperProperties;

    beforeEach(module('hyperagent'));

    beforeEach(inject(function (_HyperProperties_) {
        HyperProperties = _HyperProperties_;
    }));

    it('should expose properties', function () {
        var props = new HyperProperties({
            title: 'hello world',
            a_list: [1, 2, 3]
        });

        expect(props.title).toEqual('hello world');
        expect(props.a_list).toEqual([1, 2, 3]);
    });

    it('should ignore _link, _embedded properties', function () {
        var props = new HyperProperties({
            _links: 'do not touch',
            _embed: 'ignore me',
            title: 'hello world'
        });

        expect(props._links).toBe(undefined);
        expect(props._embedded).toBe(undefined);
        expect(props.title).toEqual('hello world');
    });
});
