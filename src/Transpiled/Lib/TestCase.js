
/**
 * this class is supposed to be used same way as the PHPUnit TestCase
 * class - extend it and implement the getTestMapping() in each your test class
 */

let {jsExport} = require("../../Debug.js");

let php = require('../php.js');

let findStrMismatch = (a, b) => {
	for (let i = 0; i < Math.max(a.length, b.length); ++i) {
		if (a[i] !== b[i]) {
			return i;
		}
	}
	return 0;
};

let describeMismatch = (expected, infix, actual, msg = '') => {
	let explanation = '';
	if (typeof expected === 'string' && typeof actual === 'string') {
		let mismatchAt = findStrMismatch(expected, actual);
		explanation += '\n'
			+ ' expected ...' + JSON.stringify(expected.slice(mismatchAt, mismatchAt + 50))
			+ ' actual ...' + JSON.stringify(actual.slice(mismatchAt, mismatchAt + 50))
			;
	}
	return 'Failed asserting that expected value \n' +
		(jsExport(expected) + '').slice(0, 600) + '\n' + infix + ' actual \n' +
		(jsExport(actual) + '').slice(0, 600) + explanation + '\n' + msg;
};

class TestCase
{
	constructor() {
		/** @type {function(ITestEvent)} */
		this.log = (e) => { throw new Error('Please define test event logger'); };
	}

	_ok() {
		process.stdout.write('.');
		this.log({type: 'ok'});
		return true;
	}

	_err(msg) {
		process.stdout.write('E');
		throw new Error(msg);
		this.log({type: 'error', msg: msg});
		return false;
	}

	assertArrayElementsSubsetInternal(expectation, reality, message = '', noExtraIndexes = false) {
		let $key, $value;
		if (php.is_array(expectation) && php.is_array(reality)) {
			for ([$key, $value] of Object.entries(expectation)) {
				if ($value !== undefined) {
					this.assertArrayHasKey($key, reality, message);
				}
				this.assertArrayElementsSubsetInternal($value, reality[$key], message+'['+$key+']', noExtraIndexes);
			}
			if (noExtraIndexes && Array.isArray(expectation)) {
				this.assertLessThanOrEqual(php.count(expectation), php.count(reality), message+' actual list is longer than expected');
			}
		} else {
			if (php.is_array(expectation) && !php.is_array(reality)) {
				message += ' (actual is not array/obj)';
			} else if (!php.is_array(expectation) && php.is_array(reality)) {
				message += ' (expected is not array/obj)';
			}
			this.assertSame(expectation, reality, message);
		}
	}

	/**
	 * @deprecated - prefer assertSubTree()
	 *
	 * Asserts arraySubset, but more verbosily
	 *
	 * @param bool $noExtraIndexes - checks number of elements in non-associative
	 * arrays - useful if you need to test that empty array is returned for example
	 *
	 * @param  string  $message
	 * @throws PHPUnit_Framework_AssertionFailedError
	 */
	assertArrayElementsSubset(expectation, reality, message = '', noExtraIndexes = false)  {
		try {
			return this.assertArrayElementsSubsetInternal(expectation, reality, message, noExtraIndexes);
		} catch (exc) {
			let args = process.argv.slice(process.execArgv.length + 2);
			if (args.includes('debug')) {
				console.log('\n$reality\n', JSON.stringify(reality));
			}
			throw exc;
		}
	}

	assertSubTree(expectedSubTree, actualTree, message = '')  {
		return this.assertArrayElementsSubset(expectedSubTree, actualTree, message, true);
	}

	assertSame(expected, actual, msg) {
		// there is no difference between undefined and null in php, so should not be here
		expected = expected === undefined ? null : expected;
		actual = actual === undefined ? null : actual;
		if (expected === actual) {
			return this._ok();
		} else {
			let fullMsg = describeMismatch(expected, 'is identical to', actual, msg);
			return this._err(fullMsg);
		}
	}

	assertEmpty(value, msg) {
		if (php.empty(value)) {
			return this._ok();
		} else {
			return this._err('Failed asserting that value is empty - ' + msg);
		}
	}

	assertEquals(expected, actual, msg) {
		if (php.equals(expected, actual)) {
			return this._ok();
		} else {
			let fullMsg = describeMismatch(expected, 'equals', actual, msg);
			return this._err(fullMsg);
		}
	}

	assertArrayHasKey(key, assoc, msg) {
		if (key in assoc) {
			return this._ok();
		} else {
			return this._err('Failed asserting that array has the key ' + key + '\n' + msg);
		}
	}

	assertLessThanOrEqual(expected, actual, msg) {
		if (actual <= expected) {
			return this._ok();
		} else {
			let fullMsg = 'Failed asserting that actual ' +
				actual + ' is <= than expected ' + expected + '\n' + msg;
			return this._err(fullMsg);
		}
	}

	/**
	 * @abstract
	 * @template T
	 * @return {[function(): T[], function(T)][]} - array of tuples: first element - data
	 *  provider function, second - testing function that throws exception on error
	 */
	getTestMapping() {
		throw new Error('Please, redefine abstract getTestMapping() in your Unit Test class');
	}

	// ew, I lost the point while writing this, so it's now
	// messed up with both exceptions and logging... sorry
	async getTests() {
		let tests = [];
		for (let [provide, test] of this.getTestMapping()) {
			let testCases = await provide.call(this);
			let moreTests = testCases.map((dataset, i) => async () => {
				let testEvents = [];
				this.log = (e) => testEvents.push(e);
				try {
					await test.call(this, ...dataset);
				} catch (exc) {
					let stack = (exc || {}).stack;
					let msg = ((exc || {}).message || exc) +
						(stack ? '\n' + stack : ' - ' + JSON.stringify(exc));
					testEvents.push({type: 'error', msg: msg});
				}
				this.log = (e) => { throw new Error('Please define test event logger'); };
				let title = ((dataset || [])[0] || {}).title || '';
				return testEvents.every(e => e.type === 'ok') ? null :
					'\n' + (title ? '# ' + title + '\n' : '') + 'dataset ' + this.constructor.name + '.' + test.name + ' #' + i + ' ' + testEvents
						.filter(e => e.type === 'error').map((e) => e.msg).join('\n');
			});
			tests.push(...moreTests);
		}
		return tests;
	}
}

module.exports = TestCase;
