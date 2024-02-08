class WebRegistryServer {
	constructor(web_env) {
		this.web_env = web_env;

		this.rest_connection = null;
	}

	getRestConnection() {
		if (this.rest_connection)
			return this.rest_connection;

		const RestConnection = require('./rest-connection.js');

		this.rest_connection = new RestConnection(this.web_env.rest_server_url);
		
		return this.rest_connection;
	}

	async rest_get(resource) {
		var rest_connection = this.getRestConnection();
		
		return new Promise((resolve, reject) => { 
			rest_connection.rest_get(resource, (err, res) => {
				if (err) reject(err); else resolve(res);
			});
		});
	}
	
	async rest_post(resource, postdata) {
		var rest_connection = this.getRestConnection();
		
		return new Promise((resolve, reject) => {
			rest_connection.rest_post(resource, postdata, (err, res) => {
				if (err) reject(err); else resolve(res);
			});
		});
	}

	async rest_put(resource, postdata) {
		var rest_connection = this.getRestConnection();
		
		return new Promise((resolve, reject) => {
			rest_connection.rest_put(resource, postdata, (err, res) => {
				if (err) reject(err); else resolve(res);
			});
		});
	}


	// API

	//
	// configurations
	async openid_configuration() {
		var resource = "/.well-known/openid-configuration";

		var res = await this.rest_get(resource);

		return res;
	}

	async registries_configuration() {
		var resource = "/.well-known/registries-configuration";

		var res = await this.rest_get(resource);

		return res;
	}

	//
	// authorization
/* 	async authorization_authorize(scope) {
		var resource = "/authorization/authentication-requests";

		var postdata = {scope};

		var res = await this.rest_post(resource, postdata);

		return res;
	}

	async authorization_siop_sessions(grant_type, code, id_token) {
		var resource = "/authorization/siop-sessions";

		var postdata = {grant_type, code, id_token};

		var res = await this.rest_post(resource, postdata);

		return res;
	} */



	//
	// registry functions
	//

	//
	// identifiers

	// did & documents
	async did_registry_identifiers(pageafter, pagesize, did_web_domain) {
		var resource = "/did/identifiers";

		if ((typeof pageafter !== 'undefined') || (typeof pagesize !== 'undefined')) resource += '?';

		resource += (typeof pageafter !== 'undefined' ? 'page[after]=' + pageafter : '');
		resource += (typeof pagesize !== 'undefined'  ? '&page[size]=' + pagesize : '');
		resource += (typeof did_web_domain !== 'undefined'  ? '&domain=' + did_web_domain : '');

		var res = await this.rest_get(resource);

		return res;
	}

	async did_registry_did_document(did) {
		var resource = "/did/identifiers";
		
		resource += "/" + encodeURI(did);

		var res = await this.rest_get(resource);

		return res;
	}

	async did_registry_did_document_details(did) {
		var resource = "/did/identifiers";
		
		resource += "/" + encodeURI(did) + "/details";

		var res = await this.rest_get(resource);

		return res;
	}

	//
	// attributes
	async did_registry_identifier_attributes(did) {
		var resource = "/did/identifiers";
		
		resource += "/" + encodeURI(did) + "/attributes";

		var res = await this.rest_get(resource);

		return res;
	}

	async did_registry_identifier_attribute_add(did, attribute_string, attribute_signature, algorithm_string) {
		var resource = "/did/identifiers";
		
		resource += "/" + encodeURI(did) + "/attribute/add";

		var postdata = {did, attribute: attribute_string, attribute_signature, algorithm: algorithm_string};

		var res = await this.rest_post(resource, postdata);

		return res;
	}

	//
	// trust chain
	async did_trust_chain(did) {
		var resource = "/did/trust_chain";
		
		resource += "/" + encodeURI(did);

		var res = await this.rest_get(resource);

		return res;
	}


	//
	// trusted issuers registry
	async trusted_issuers_registry_issuers(pageafter, pagesize, did_web_domain) {
		var resource = "/did/issuers";

		if ((typeof pageafter !== 'undefined') || (typeof pagesize !== 'undefined')) resource += '?';

		resource += (typeof pageafter !== 'undefined' ? 'page[after]=' + pageafter : '');
		resource += (typeof pagesize ? '&page[size]=' + pagesize : '');
		resource += (typeof did_web_domain !== 'undefined'  ? '&domain=' + did_web_domain : '');

		var res = await this.rest_get(resource);

		return res;
	}

	async trusted_issuers_registry_issuer(did) {
		var resource = "/did/issuers";

		resource += "/" + encodeURI(did);

		var res = await this.rest_get(resource);

		return res;
	}



	//
	// credentials
	async issuer_credential_status_history(credential_hash, did_web_domain) {
		var resource = "/issuer/credential/status/history";
		
		var postdata = {credential_hash, domain: did_web_domain};

		var res = await this.rest_post(resource, postdata);

		return res;
	}

	async issuer_credential_status_modifications_list(credential_hash, modifier_did) {
		var resource = "/issuer/credential/status/modifications/list";
		
		var postdata = {credential_hash, modifier_did};

		var res = await this.rest_post(resource, postdata);

		return res;
	}



	// static
	static getObject(web_env) {

		let web_registry_server =  new WebRegistryServer(web_env);

		return web_registry_server;
	}
}

 
module.exports = WebRegistryServer;