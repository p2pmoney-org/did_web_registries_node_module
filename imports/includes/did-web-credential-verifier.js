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

	static getDidDomain(did) {
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

		// or we assume this is not /root_path
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

	static async getDidTAO(did) {
		if (!did)
		return;

		let did_domain = DidWebCredentialVerifier.getDidDomain(did);
		let did_path = await DidWebCredentialVerifier.getDidPath(did);

		let index = did_path.lastIndexOf('/');

		if (index > 0) {
			let tao_path = did_path.substring(0, index);
			return 'did:web:' + did_domain + tao_path.replaceAll('/', ':');
		}
		else
		return 'did:web:' + did_domain; // TAO is RootTAO
	}

	static async getDidRootTAO(did) {
		if (!did)
		return;

		let did_domain = DidWebCredentialVerifier.getDidDomain(did);

		return 'did:web:' + did_domain;
	}
	

	static async getConnectionRawCertificate(rest_server_url) {
		const WebCertificate = require('./web-certificate.js');
		let webcertificate = WebCertificate.getObject(rest_server_url);
		let certificate = await webcertificate.get();

		return certificate;

	}

	static getIssuerRights(trusted_issuer) {
		let rights = 3;

		let attributes = (trusted_issuer && trusted_issuer.attributes ? trusted_issuer.attributes : []);

		for (var i = 0; i < attributes.length; i++) {
			let attribute = attributes[i];

			switch(attribute.issuerType) {
				case 'TI': {
					rights |= 4;
				}
				break;
	
				case 'TAO': {
					rights |= 8;
				}
				break;
		
				case 'RootTAO': {
					rights |= 16;
				}
				break;
			
				default:
					break;
			}			
		}

		return rights;
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

	static async getIssuerVerificationCard(issuer_did) {
		let issuer_verification = {issuer_did};

		// check that issuer's identifier exists on the registry
		let web_registry_server	= await DidWebCredentialVerifier.getRegistryServerForDid(issuer_did).catch(err => {});

		let did_document = await web_registry_server.did_registry_did_document(issuer_did);

		if (did_document) {
			let did_domain = DidWebCredentialVerifier.getDidDomain(issuer_did);
			let did_path = await DidWebCredentialVerifier.getDidPath(issuer_did);
			let did_parts = (did_path.length > 1 ? did_path.split('/') : []);

			issuer_verification.is_did_registered = 1;

			// check that issuer is a registered issuer
			let trusted_issuer = await web_registry_server.trusted_issuers_registry_issuer(issuer_did).catch(err => {});

			if (trusted_issuer) {
				let ti_rights = DidWebCredentialVerifier.getIssuerRights(trusted_issuer);
				if ((ti_rights & 7) == 7)
				issuer_verification.is_did_trusted_issuer = 1;
				else
				issuer_verification.is_did_trusted_issuer = -1;
			}
			else
			issuer_verification.is_did_trusted_issuer = -1;

			issuer_verification.TI = {identity: {}};

			issuer_verification.TI.is_trusted = (issuer_verification.is_did_trusted_issuer ? 1 : -1);

			issuer_verification.TI.identity.name = (did_parts.length > 1 ? did_parts[did_parts.length - 1] : did_domain);

			// get status and identity elements of RootTAO
			let root_tao_did = await DidWebCredentialVerifier.getDidRootTAO(issuer_did);

			issuer_verification.RootTAO = {identity: {}};

			let web_registrar_rest_api_endpoint = web_registry_server.web_env.rest_server_url;
			issuer_verification.RootTAO.identity.raw_certificate = await DidWebCredentialVerifier.getConnectionRawCertificate(web_registrar_rest_api_endpoint).catch(err => {});

			if (issuer_verification.RootTAO.identity.raw_certificate) {
				issuer_verification.RootTAO.is_trusted = 1;

				issuer_verification.RootTAO.identity.name = issuer_verification.RootTAO.identity.raw_certificate.subject.CN;

				if (issuer_verification.RootTAO.identity.raw_certificate.subject.O)
				issuer_verification.RootTAO.identity.organization = issuer_verification.RootTAO.identity.raw_certificate.subject.O;

				if (issuer_verification.RootTAO.identity.raw_certificate.subject.OU)
				issuer_verification.RootTAO.identity.organization_unit = issuer_verification.RootTAO.identity.raw_certificate.subject.OU;

				issuer_verification.RootTAO.identity.is_valid_from = issuer_verification.RootTAO.identity.raw_certificate.valid_from;
				issuer_verification.RootTAO.identity.is_valid_to = issuer_verification.RootTAO.identity.raw_certificate.valid_to;

				let web_domain = issuer_verification.RootTAO.identity.raw_certificate.subject.CN;
				if (web_domain.startsWith('*.')) {
					// wild card
					web_domain = web_domain.slice(2);
				}

				issuer_verification.RootTAO.identity.link = 'https://' + web_domain;
			}
			else {
				issuer_verification.RootTAO.is_trusted = 0;
			}


			// get status and identity elements of TAO
			issuer_verification.TAO = {identity: {}};

			issuer_verification.TAO.identity.name = (did_parts.length > 2 ? did_parts[did_parts.length - 2] : did_domain);

			let tao_did = await DidWebCredentialVerifier.getDidTAO(issuer_did);
			let trusted_tao = await web_registry_server.trusted_issuers_registry_issuer(tao_did).catch(err => {});

			if (trusted_tao && trusted_tao.attributes) {
				let tao_rights = DidWebCredentialVerifier.getIssuerRights(trusted_tao);
				if ((tao_rights & 11) == 11)
				issuer_verification.TAO.is_trusted = 1;
				else
				issuer_verification.TAO.is_trusted = -1;
			}
			else {
				issuer_verification.TAO.is_trusted = -1;
			}

		}
		else {
			issuer_verification.is_did_registered = -1;
			issuer_verification.is_did_trusted_issuer = -1;
		}

		return issuer_verification;
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
			let did_domain = DidWebCredentialVerifier.getDidDomain(issuer_did);
			let did_path = await DidWebCredentialVerifier.getDidPath(issuer_did);
			let did_parts = (did_path.length > 1 ? did_path.split('/') : []);

			vc_verification.is_did_registered = 1;

			// check that issuer is a registered issuer
			let trusted_issuer = await web_registry_server.trusted_issuers_registry_issuer(issuer_did).catch(err => {});

			if (trusted_issuer) {
				let ti_rights = DidWebCredentialVerifier.getIssuerRights(trusted_issuer);
				if ((ti_rights & 7) == 7)
				vc_verification.is_did_trusted_issuer = 1;
				else
				vc_verification.is_did_trusted_issuer = -1;
			}
			else
			vc_verification.is_did_trusted_issuer = -1;

			vc_verification.TI = {identity: {}};

			vc_verification.TI.is_trusted = (vc_verification.is_did_trusted_issuer ? 1 : -1);

			vc_verification.TI.identity.name = (did_parts.length > 1 ? did_parts[did_parts.length - 1] : did_domain);

			// get status and identity elements of RootTAO
			let root_tao_did = await DidWebCredentialVerifier.getDidRootTAO(issuer_did);

			vc_verification.RootTAO = {identity: {}};

			let web_registrar_rest_api_endpoint = web_registry_server.web_env.rest_server_url;
			vc_verification.RootTAO.identity.raw_certificate = await DidWebCredentialVerifier.getConnectionRawCertificate(web_registrar_rest_api_endpoint).catch(err => {});

			if (vc_verification.RootTAO.identity.raw_certificate) {
				vc_verification.RootTAO.is_trusted = 1;

				vc_verification.RootTAO.identity.name = vc_verification.RootTAO.identity.raw_certificate.subject.CN;

				if (vc_verification.RootTAO.identity.raw_certificate.subject.O)
				vc_verification.RootTAO.identity.organization = vc_verification.RootTAO.identity.raw_certificate.subject.O;

				if (vc_verification.RootTAO.identity.raw_certificate.subject.OU)
				vc_verification.RootTAO.identity.organization_unit = vc_verification.RootTAO.identity.raw_certificate.subject.OU;

				vc_verification.RootTAO.identity.is_valid_from = vc_verification.RootTAO.identity.raw_certificate.valid_from;
				vc_verification.RootTAO.identity.is_valid_to = vc_verification.RootTAO.identity.raw_certificate.valid_to;

				let web_domain = vc_verification.RootTAO.identity.raw_certificate.subject.CN;
				if (web_domain.startsWith('*.')) {
					// wild card
					web_domain = web_domain.slice(2);
				}

				vc_verification.RootTAO.identity.link = 'https://' + web_domain;
			}
			else {
				vc_verification.RootTAO.is_trusted = 0;
			}


			// get status and identity elements of TAO
			vc_verification.TAO = {identity: {}};

			vc_verification.TAO.identity.name = (did_parts.length > 2 ? did_parts[did_parts.length - 2] : did_domain);

			let tao_did = await DidWebCredentialVerifier.getDidTAO(issuer_did);
			let trusted_tao = await web_registry_server.trusted_issuers_registry_issuer(tao_did).catch(err => {});

			if (trusted_tao && trusted_tao.attributes) {
				let tao_rights = DidWebCredentialVerifier.getIssuerRights(trusted_tao);
				if ((tao_rights & 11) == 11)
				vc_verification.TAO.is_trusted = 1;
				else
				vc_verification.TAO.is_trusted = -1;
			}
			else {
				vc_verification.TAO.is_trusted = -1;
			}

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