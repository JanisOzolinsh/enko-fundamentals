
const {getExcData} = require('../Utils/Misc.js');
const DynUtils = require('../Dyn/DynUtils.js');

let getRqBody = req => {
	let rqBody = req.body;
	if (Object.keys(rqBody).length === 0) {
		let querystring = require('querystring');
		let queryStr = req.url.split('?')[1] || '';
		rqBody = querystring.parse(queryStr);
	}
	return rqBody;
};

/**
 * this function maps HTTP request to an action that returns promise of a json data
 *
 * @param {function} httpAction - an action that returns a promise wrapping the json data for response
 * @return {function} - the function to pass as second argument to app.post() where app is 'express' lib instance
 */
let toHandleHttp = (httpAction) => (req, res) => {
	let rqBody = getRqBody(req);
	let rqTakenMs = Date.now();
	return Promise.resolve()
		.then(() => httpAction({rqBody, routeParams: req.params}))
		.catch(exc => {
			let excData = getExcData(exc);
			if (typeof excData === 'string') {
				excData = new Error('HTTP action failed - ' + excData);
			}
			excData.httpStatusCode = exc.httpStatusCode || 520;
			return Promise.reject(excData);
		})
		.then(result => {
			res.setHeader('Content-Type', 'application/json');
			res.status(200);
			let isObj = Object(result) === Object(result);
			let withMeta = !isObj ? result : Object.assign({
				rqTakenMs: rqTakenMs,
				rsSentMs: Date.now(),
				process: DynUtils.descrProc(),
			}, result);
			res.send(JSON.stringify(withMeta));
		})
		.catch(exc => {
			exc = exc || 'Empty error ' + exc;
			res.status(exc.httpStatusCode || 500);
			res.setHeader('Content-Type', 'application/json');
			let error;
			if (exc.message) {
				// in AbstractClient error message is not string sometimes
				error = typeof exc.message === 'string' ? exc.message
					: 'data-message: ' + JSON.stringify(exc.message);
			} else {
				error = (exc + '').replace(/^Error: /, '');
			}
			let data = (exc.data || {}).passToClient ? exc.data : null;
			res.send(JSON.stringify({error: error, payload: data}));
			return Promise.reject(exc);
		});
};

exports.getRqBody = getRqBody;
exports.toHandleHttp = toHandleHttp;
