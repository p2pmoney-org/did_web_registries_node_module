class DidWebCredentialVerifier {

	static async getRegistryServerForDid(did_web) {
		const WebRegistryServer = require('./web-registry-server.js');

		let parts = did_web.split(':')
		let domain = parts[2];
		let registrar_url = 'https://' + domain;

		let _temp_web_registry_server = await WebRegistryServer.getObject({rest_server_url: registrar_url});

		let registries_config = await _temp_web_registry_server.rest_get( '/.well-known/registries-configuration').catch(err => {});

		if (!registries_config && parts[3]) {
			// try with root_path
			let root_path = parts[3];
			
			registrar_url = 'https://' + domain + '/' + root_path;

			_temp_web_registry_server = await WebRegistryServer.getObject({rest_server_url: registrar_url});

			registries_config = await _temp_web_registry_server.rest_get( '/.well-known/registries-configuration');
		}

		let did_registrar_rest_url = registries_config.api_endpoint;


		let web_env = {rest_server_url: did_registrar_rest_url};
		let web_registry_server = WebRegistryServer.getObject(web_env);

		return web_registry_server;
	}

	static hash256(str) {
		const CryptoJS = require('crypto-js');

		let hash   = CryptoJS.SHA256(str);
		let buffer = Buffer.from(hash.toString(CryptoJS.enc.Hex), 'hex');

		return buffer.toString('hex');
	}

	static 	getDidDomain(did) {
		let parts = did.split(':')
		let domain = parts[2];

		return domain;
	}

	static async getDidPath(did) {
		if (!did)
		return;

		let path;

		// ask the registrar if we can contact it
		let web_registry_server	= await DidWebCredentialVerifier.getRegistryServerForDid(did).catch(err => {});

		if (web_registry_server) {
			let did_document_details = await web_registry_server.did_registry_did_document_details(did);

			path = (did_document_details ? did_document_details.path : null);

			if (path)
			return path;
		}

		// or we assyme there is not /root_path
		let trail = did.substring(8);

		// remove domain
		let index = trail.indexOf(':');

		if (index > 0)
		trail = trail.substring(index);
		else
		trail = ':'; // this is the domain root

		path = trail.replaceAll(':', '/');

		return path;
	}

	static isDidWebDid(did) {
		return (did && did.startsWith('did:web') ? true : false);
	}

	static async getConnectionRawCertificate(rest_server_url) {
		const WebCertificate = require('./web-certificate.js');
		let webcertificate = WebCertificate.getObject(rest_server_url);
		let certificate = await webcertificate.get();

		return certificate;

	}

	static async _getCredentialRevokationStatus(web_registry_server, issuer_did, credential_hash) {
		let revokation_status = 0;

		let did_web_domain = DidWebCredentialVerifier.getDidDomain(issuer_did);
		let issuer_did_path = await DidWebCredentialVerifier.getDidPath(issuer_did);

		let history = await web_registry_server.issuer_credential_status_history(credential_hash, did_web_domain);

		if (history && history.items) {

			if (history.items.length > 0) {
				revokation_status = -1;
				
				for (var i = 0; i < history.items.length; i++) {
					let item = history.items[i];
	
					if (issuer_did_path.startsWith(item.path)) {
						// has authority to change status
						revokation_status = (item.credential_status & 1 ? -1 : 1);
						break;
					}
				}
			}
			else
			revokation_status = -1;
		}
		else
		revokation_status = 0;

		return revokation_status;
	}

	static async getCredentialRevokationStatus(issuer_did, credential_hash) {
		let web_registry_server	= await DidWebCredentialVerifier.getRegistryServerForDid(issuer_did).catch(err => {});

		return DidWebCredentialVerifier._getCredentialRevokationStatus(web_registry_server, issuer_did, credential_hash);
	}

	static async getCredentialVerificationCard(vc_jwt) {
		let vc_verification = {};

		const jsontokens = require('jsontokens');


		let vc_obj = await jsontokens.decodeToken(vc_jwt);

		let issuer_did = vc_obj.payload.iss;

		let web_registry_server	= await DidWebCredentialVerifier.getRegistryServerForDid(issuer_did).catch(err => {});


		// check that issuer's identifier exists on the registry
		let did_document = await web_registry_server.did_registry_did_document(issuer_did);

		if (did_document) {
			let did_path = await this.getDidPath(issuer_did);
			let did_parts = did_path.split('/');

			vc_verification.is_did_registered = 1;

			// check that issuer is a registered issuer
			let trusted_issuer = await web_registry_server.trusted_issuers_registry_issuer(issuer_did);

			if (trusted_issuer)
			vc_verification.is_did_trusted_issuer = 1;
			else
			vc_verification.is_did_trusted_issuer = -1;

			vc_verification.TI = {identity: {}};

			vc_verification.TI.is_valid = (trusted_issuer ? 1 : -1);

			vc_verification.TI.identity.name = (did_parts.length > 1 ? did_parts[did_parts.length - 1] : '');

			// get status and identity elements of RootTAO
			vc_verification.RootTAO = {identity: {}};

			let web_registrar_rest_api_endpoint = web_registry_server.web_env.rest_server_url;
			vc_verification.RootTAO.identity.raw_certificate = await DidWebCredentialVerifier.getConnectionRawCertificate(web_registrar_rest_api_endpoint).catch(err => {});

			if (vc_verification.RootTAO.identity.raw_certificate) {
				vc_verification.RootTAO.is_valid = 1;
				vc_verification.RootTAO.identity.name = vc_verification.RootTAO.identity.raw_certificate.subject.CN;
			}
			else {
				vc_verification.RootTAO.is_valid = 0;
			}


			// get status and identity elements of TAO
			vc_verification.TAO = {identity: {}};

			vc_verification.TAO.identity.name = (did_parts.length > 2 ? did_parts[did_parts.length - 2] : '');

			vc_verification.TAO.is_valid = 1;

			// 5 - VC validity status (e.g. not revoked nor suspended)

			// check that credential is signed with a published public key
			vc_verification.is_credential_signing_publicly_confirmed = 0;

			if (did_document.verificationMethod) {
				let kid = vc_obj.header.kid;
				vc_verification.is_credential_signing_publicly_confirmed = -1;

				for (var i = 0; i < did_document.verificationMethod.length; i++) {
					if (did_document.verificationMethod[i].id == kid) {
						vc_verification.is_credential_signing_publicly_confirmed = 1;
						break;
					}
				}
			}

			// check that credential has not been revoked
			let credential_hash = DidWebCredentialVerifier.hash256(vc_jwt);
			vc_verification.is_credential_revoked = await DidWebCredentialVerifier._getCredentialRevokationStatus(web_registry_server, issuer_did, credential_hash);
		}
		else {
			vc_verification.is_did_registered = -1;
			vc_verification.is_did_trusted_issuer = -1;
			vc_verification.is_credential_revoked = 0;
		}

		return vc_verification;
	}

}

 
module.exports = DidWebCredentialVerifier;