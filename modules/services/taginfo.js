import _ from 'lodash';
import { qsString } from '../util/index';

var taginfo = {},
    endpoint = 'https://taginfo.openstreetmap.org/api/4/',
    tag_sorts = {
        point: 'count_nodes',
        vertex: 'count_nodes',
        area: 'count_ways',
        line: 'count_ways'
    },
    tag_filters = {
        point: 'nodes',
        vertex: 'nodes',
        area: 'ways',
        line: 'ways'
    };


function sets(parameters, n, o) {
    if (parameters.geometry && o[parameters.geometry]) {
        parameters[n] = o[parameters.geometry];
    }
    return parameters;
}

function setFilter(parameters) {
    return sets(parameters, 'filter', tag_filters);
}

function setSort(parameters) {
    return sets(parameters, 'sortname', tag_sorts);
}

function clean(parameters) {
    return _.omit(parameters, 'geometry', 'debounce');
}

function filterKeys(type) {
    var count_type = type ? 'count_' + type : 'count_all';
    return function(d) {
        return parseFloat(d[count_type]) > 2500 || d.in_wiki;
    };
}

function filterMultikeys() {
    return function(d) {
        return (d.key.match(/:/g) || []).length === 1;  // exactly one ':'
    };
}

function filterValues(allowUpperCase) {
    return function(d) {
        if (d.value.match(/[;,]/) !== null) return false;  // exclude some punctuation
        if (!allowUpperCase && d.value.match(/[A-Z*]/) !== null) return false;  // exclude uppercase letters
        return parseFloat(d.fraction) > 0.0 || d.in_wiki;
    };
}

function valKey(d) {
    return {
        value: d.key,
        title: d.key
    };
}

function valKeyDescription(d) {
    return {
        value: d.value,
        title: d.description || d.value
    };
}

// sort keys with ':' lower than keys without ':'
function sortKeys(a, b) {
    return (a.key.indexOf(':') === -1 && b.key.indexOf(':') !== -1) ? -1
        : (a.key.indexOf(':') !== -1 && b.key.indexOf(':') === -1) ? 1
        : 0;
}

var debounced = _.debounce(d3.json, 100, true);

function request(url, debounce, callback) {
    var cache = taginfo.cache;

    if (cache[url]) {
        callback(null, cache[url]);
    } else if (debounce) {
        debounced(url, done);
    } else {
        d3.json(url, done);
    }

    function done(err, data) {
        if (!err) cache[url] = data;
        callback(err, data);
    }
}

export function init() {
    taginfo.keys = function(parameters, callback) {
        var debounce = parameters.debounce;
        parameters = clean(setSort(parameters));
        request(endpoint + 'keys/all?' +
            qsString(_.extend({
                rp: 10,
                sortname: 'count_all',
                sortorder: 'desc',
                page: 1
            }, parameters)), debounce, function(err, d) {
                if (err) return callback(err);
                var f = filterKeys(parameters.filter);
                callback(null, d.data.filter(f).sort(sortKeys).map(valKey));
            });
    };

    taginfo.multikeys = function(parameters, callback) {
        var debounce = parameters.debounce;
        parameters = clean(setSort(parameters));
        request(endpoint + 'keys/all?' +
            qsString(_.extend({
                rp: 25,
                sortname: 'count_all',
                sortorder: 'desc',
                page: 1
            }, parameters)), debounce, function(err, d) {
                if (err) return callback(err);
                var f = filterMultikeys();
                callback(null, d.data.filter(f).map(valKey));
            });
    };

    taginfo.values = function(parameters, callback) {
        var debounce = parameters.debounce;
        parameters = clean(setSort(setFilter(parameters)));
        request(endpoint + 'key/values?' +
            qsString(_.extend({
                rp: 25,
                sortname: 'count_all',
                sortorder: 'desc',
                page: 1
            }, parameters)), debounce, function(err, d) {
                if (err) return callback(err);
                var f = filterValues(parameters.key === 'cycle_network' || parameters.key === 'network');
                callback(null, d.data.filter(f).map(valKeyDescription));
            });
    };

    taginfo.docs = function(parameters, callback) {
        var debounce = parameters.debounce;
        parameters = clean(setSort(parameters));

        var path = 'key/wiki_pages?';
        if (parameters.value) path = 'tag/wiki_pages?';
        else if (parameters.rtype) path = 'relation/wiki_pages?';

        request(endpoint + path + qsString(parameters), debounce, function(err, d) {
            if (err) return callback(err);
            callback(null, d.data);
        });
    };

    taginfo.endpoint = function(_) {
        if (!arguments.length) return endpoint;
        endpoint = _;
        return taginfo;
    };

    taginfo.reset = function() {
        taginfo.cache = {};
        return taginfo;
    };


    if (!taginfo.cache) {
        taginfo.reset();
    }

    return taginfo;
}
