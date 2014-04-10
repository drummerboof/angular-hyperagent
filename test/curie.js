'use strict';

describe('HyperCurieStore', function () {

    var curieStore;

    beforeEach(module('hyperagent'));

    beforeEach(inject(function (HyperCurieStore) {
        curieStore = new HyperCurieStore();
    }));

    it('stores and expands curies', function () {
        curieStore.register('wiki', 'http://en.wikipedia.org/wiki/{rel}');
        var url = curieStore.expand('wiki:Eierlegende_Wollmilchsau');
        expect(url).toEqual('http://en.wikipedia.org/wiki/Eierlegende_Wollmilchsau');
    });

    it('canExpand', function () {
        curieStore.register('wiki', 'http://en.wikipedia.org/wiki/');
        expect(curieStore.canExpand('wiki:Eierlegende_Wollmilchsau')).toBe(true);
        expect(curieStore.canExpand('foo:Eierlegende_Wollmilchsau')).toBe(false);
    });

    it('expand returns the untouch value if cannot expand', function () {
        var value = 'wiki:autobahn';
        expect(curieStore.expand(value)).toEqual(value);
    });

    it('is empty by default', function () {
        expect(curieStore.empty()).toBe(true);
    });

    it('is not empty if used', function () {
        curieStore.register('wiki', 'http://en.wikipedia.org/wiki/');
        expect(curieStore.empty()).toBe(false);
    });
});
