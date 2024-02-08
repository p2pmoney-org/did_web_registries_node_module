/**
 * @author P2PMoney.org
 * @name @p2pmoney-org/did_web_registries
 * @homepage http://www.p2pmoney.org/
 * @license MIT
 */
  
 const DidWebCredentialVerifier = require('./imports/includes/did-web-credential-verifier.js');
 const WebRegistryServer = require('./imports/includes/web-registry-server.js');

class DidWebRegistries {

	static async getConnectionRawCertificate(rest_server_url) {
		return DidWebCredentialVerfier.getConnectionRawCertificate(rest_server_url);
	}
	
	static async getCredentialVerificationCard(vc_jwt) {
		return DidWebCredentialVerfier.getCredentialVerificationCard(vc_jwt);
	}

	static async getCredentialRevokationStatus(issuer_did, credential_hash) {
		return DidWebCredentialVerfier.getCredentialRevokationStatus(issuer_did, credential_hash);
	}

	static async getDidPath(did) {
		return DidWebCredentialVerfier.getDidPath(did);
	}


	static async getRegistryServerForDid(did_web) {
		return DidWebCredentialVerfier.getRegistryServerForDid(did_web);
	}

	static getWebRegistryServer(web_env) {
		return WebRegistryServer.getObject(web_env);
	}
};

module.exports = DidWebRegistries;

module.exports.WebRegistryServer = WebRegistryServer;
module.exports.DidWebCredentialVerfier = DidWebCredentialVerifier;