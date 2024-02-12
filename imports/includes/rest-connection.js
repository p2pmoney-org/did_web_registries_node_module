class RestConnection  {
	constructor(rest_server_url, rest_server_api_path) {
		this.rest_server_url = rest_server_url;
		this.rest_server_api_path = rest_server_api_path;
		
		this.header = Object.create(null);

		this.content_type = null;

	}
	
	getRestCallUrl() {
		var rest_server_url = this.rest_server_url;
		var rest_server_api_path = this.rest_server_api_path;
		
		return rest_server_url + (rest_server_api_path ? rest_server_api_path : '');
	}
	
	__isValidURL(url) {
		var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
					'((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
					'((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
					'(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
					'(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
					'(\\#[-a-z\\d_]*)?$','i'); // fragment locator
				
		return !!pattern.test(url);
	}
	
	_isReady() {
		var resturl = this.getRestCallUrl();
		
		return this.__isValidURL(resturl);
	}

	getContentType() {
		return this.content_type;
	}

	setContentType(content_type) {
		this.content_type = content_type;
	}

	getHeader() {
		return this.header;
	}
	
	addToHeader(keyvalue) {
		this.header[keyvalue.key] = keyvalue.value;
	}
	
	_setRequestHeader(xhttp) {
		if (this.content_type)
			xhttp.setRequestHeader("Content-Type", this.content_type);
		else
			xhttp.setRequestHeader("Content-Type", "application/json"); // note: XMLHttpRequest in nodejs requires exact case

		for (var key in this.header) {
			xhttp.setRequestHeader(key, this.header[key]);
		}
	}
	_getXMLHttpRequestClass() {
		const XMLHttpRequest = require("xmlhttprequest");
		;
		if (typeof XMLHttpRequest !== 'undefined' && XMLHttpRequest && XMLHttpRequest.XMLHttpRequest ) {
			return XMLHttpRequest.XMLHttpRequest;
		}
		else if (typeof window !== 'undefined' && window ) {
			// normally (browser or react native), XMLHttpRequest should be directly accessible
			if (typeof window.XMLHttpRequest !== 'undefined')
				return window.XMLHttpRequest;
			else if ( (typeof window.simplestore !== 'undefined')
					&& (typeof window.simplestore.XMLHttpRequest !== 'undefined'))
					return window.simplestore.XMLHttpRequest;
		}
		else if ((typeof global !== 'undefined') && (typeof global.simplestore !== 'undefined')
				&& (typeof global.simplestore.XMLHttpRequest !== 'undefined')) {
			return global.simplestore.XMLHttpRequest;
		}
		else {
			throw 'can not find XMLHttpRequest class!!!';
		}
	}
	
	_createXMLHttpRequest(method, resource) {
		var _XMLHttpRequest = this._getXMLHttpRequestClass()
		var xhttp = new _XMLHttpRequest();
		
		var rest_call_url = this.getRestCallUrl();
		var resource_url = rest_call_url + resource;
		
		// allow Set-Cookie for CORS calls
		//xhttp.withCredentials = true;
		
		xhttp.open(method, resource_url, true);

		this._setRequestHeader(xhttp);
		
		return xhttp;
	}
	
	_processResponseText(xhttp, callback) {
    	if (callback) {
	    	var jsonresponse;
	    	
	    	try {
		    	jsonresponse = JSON.parse(xhttp.responseText);
	    	}
	    	catch(e) {
	    		console.log('rest answer is not json compliant');
	    	}
	    	
	    	if (jsonresponse) {
	    		if (jsonresponse['status']) {
	    			// primus compliant
			    	if (jsonresponse['status'] == '1') {
			    		console.log('RestConnection.rest_post response is ' + JSON.stringify(jsonresponse));
			    		callback(null, jsonresponse);
			    	}
			    	else  {
			    		callback((jsonresponse['error'] ? jsonresponse['error'] : 'unknown error'), null);
			    	}
	    			
	    		}
	    		else {
	    			callback(null, jsonresponse);
	    		}
	    		
	    	}
	    	else {
	    		// copy plain text
	    		jsonresponse = xhttp.responseText;
	    		
	    		callback(null, jsonresponse);
	    	}
	    	
		    		    		
    	}
	}
	
	async rest_get_async(resource) {
		return new Promise( (resolve, reject) => {
			this.rest_get(resource, function (err, res) {
				if (err) {reject(err);}	else {resolve(res);}
			});
		});
	}
	
	rest_get(resource, callback) {
		var self = this;
	    
		var xhttp = this._createXMLHttpRequest("GET", resource);
	    
	    xhttp.send();
	    
	    xhttp.onload = function(e) {
		    if (xhttp.status == 200) {
			    //console.log('response text is ' + xhttp.responseText);
		    	self._processResponseText(xhttp, callback);
		    }
		    else {
				let err = (xhttp.statusText && xhttp.statusText.length ? xhttp.statusText : xhttp.responseText);
		    	if (callback)
		    		callback(err, null);	
			}
	    	
	    };
	    
	    xhttp.onerror = function (e) {
			let err = (xhttp.statusText && xhttp.statusText.length ? xhttp.statusText : xhttp.responseText);
			console.log('rest error is ' + err);
			
	    	if (callback)
	    		callback(err, null);	
	    };
	    
	}

	async rest_post_async(resource, postdata) {
		return new Promise( (resolve, reject) => {
			this.rest_post(resource, postdata, function (err, res) {
				if (err) {reject(err);}	else {resolve(res);}
			});
		});
	}
	
	rest_post(resource, postdata, callback) {
		var self = this;
	    
		var xhttp = this._createXMLHttpRequest("POST", resource);
	    
		if (typeof postdata === 'string' || postdata instanceof String)
		xhttp.send(postdata);
		else
		xhttp.send(JSON.stringify(postdata));
	
	    xhttp.onload = function(e) {
		    if (xhttp.status == 200) {
			    //console.log('response text is ' + xhttp.responseText);
		    	self._processResponseText(xhttp, callback);
		    }
		    else {
				let err = (xhttp.statusText && xhttp.statusText.length ? xhttp.statusText : xhttp.responseText);
		    	if (callback)
		    		callback(err, null);	
			}
	    	
	    };
	    
	    xhttp.onerror = function (e) {
			let err = (xhttp.statusText && xhttp.statusText.length ? xhttp.statusText : xhttp.responseText);
			console.log('rest error is ' + err);
		
	    	if (callback)
	    		callback(err, null);	
	    };
	    
	}

	async rest_put_async(resource, postdata) {
		return new Promise( (resolve, reject) => {
			this.rest_put(resource, postdata, function (err, res) {
				if (err) {reject(err);}	else {resolve(res);}
			});
		});
	}
	
	rest_put(resource, postdata, callback) {
		var self = this;
		
		var xhttp = this._createXMLHttpRequest("PUT", resource);
		
		xhttp.send(JSON.stringify(postdata));
		
		xhttp.onload = function(e) {
			if ((xhttp.status == 200) ||  (xhttp.status == 201)){
		    	self._processResponseText(xhttp, callback);
			}
			else {
				let err = (xhttp.statusText && xhttp.statusText.length ? xhttp.statusText : xhttp.responseText);
				console.log('rest error is ' + err);

				if (callback)
					callback(err, null);	
			}
			
		};
		
		xhttp.onerror = function (e) {
			let err = (xhttp.statusText && xhttp.statusText.length ? xhttp.statusText : xhttp.responseText);
			console.log('rest error is ' + err);
			
			if (callback)
				callback(err, null);	
		};
		
	}
	
	async rest_delete_async(resource) {
		return new Promise( (resolve, reject) => {
			this.rest_delete(resource, function (err, res) {
				if (err) {reject(err);}	else {resolve(res);}
			});
		});
	}
	
	rest_delete(resource, callback) {
		var self = this;
		
		var xhttp = this._createXMLHttpRequest("DELETE", resource);
		
		xhttp.send();
		
		xhttp.onload = function(e) {
			if (xhttp.status == 200) {
		    	self._processResponseText(xhttp, callback);
			}
			else {
				let err = (xhttp.statusText && xhttp.statusText.length ? xhttp.statusText : xhttp.responseText);
				console.log('rest error is ' + err);

				if (callback)
					callback(err, null);	
			}
			
		};
		
		xhttp.onerror = function (e) {
			let err = (xhttp.statusText && xhttp.statusText.length ? xhttp.statusText : xhttp.responseText);
			console.log('rest error is ' + err);
			
			if (callback)
				callback(err, null);	
		};
		
	}
}

module.exports = RestConnection;