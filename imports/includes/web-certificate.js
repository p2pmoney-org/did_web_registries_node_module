class WebCertificate {
	constructor(url) {
		this.path = url.substring(8);
		this.domain = this.path.substring(0, this.path.indexOf('/'));
	}

	isEmpty(object) {
		for (var prop in object) {
			if (object.hasOwnProperty(prop)) return false;
		}

		return true;
	}

	getExecutionEnvironment() {
		if ( typeof window !== 'undefined' && window ) {
			// if we are in browser (or react-native) and not node js
			return 'browser';
		}
		else if (typeof global !== 'undefined') {
			// node js
			return  'nodejs';
		}
		else {
			return  'unkown';
		}
	}

	pemEncode(str, n) {
		var ret = [];

		for (var i = 1; i <= str.length; i++) {
			ret.push(str[i - 1]);
			var mod = i % n;

			if (mod === 0) {
			ret.push('\n');
			}
		}

		var returnString = `-----BEGIN CERTIFICATE-----\n${ret.join('')}\n-----END CERTIFICATE-----`;

		return returnString;
	}

	getOptions(url, port, protocol) {
		return {
			hostname: url,
			agent: false,
			rejectUnauthorized: false,
			ciphers: 'ALL',
			port,
			protocol
		};
	}

	validateUrl(url) {
		if (url.length <= 0 || typeof url !== 'string') {
			throw Error('A valid URL is required');
		}
	}

	handleRequest(options, detailed = false, resolve, reject) {
		var https = require('https');
		var exec_env = this.getExecutionEnvironment();

		return https.get(options, (res) => {
			var certificate;
			
			if (exec_env === 'browser')
			certificate = null; // no method yet to get certificate from javascript in browser (2024.08.26)
			else
			certificate = res.socket.getPeerCertificate(detailed);

			if (certificate === null || this.isEmpty(certificate)) {
				reject({ message: 'The website did not provide a certificate' });
			} else {
			if (certificate.raw) {
				certificate.pemEncoded = this.pemEncode(certificate.raw.toString('base64'), 64);
			}
				resolve(certificate);
			}
		});
	}

	async get(timeout, port, protocol, detailed) {
		let url = this.domain;

		this.validateUrl(url);

		port = port || 443;
		protocol = protocol || 'https:';

		var options = this.getOptions(url, port, protocol);

		return new Promise((resolve, reject) => {
			var req = this.handleRequest(options, detailed, resolve, reject);

			if (timeout) {
			req.setTimeout(timeout, function() {
				reject({ message: 'Request timed out.' });
				req.abort();
			});
			}

			req.on('error', function(e) {
			reject(e);
			});

			req.end();
		});
	}

	// static
	static getObject(url) {
		return new WebCertificate(url);
	}

}

module.exports = WebCertificate;