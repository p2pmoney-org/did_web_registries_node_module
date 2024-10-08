### Installation
```
npm install @p2pmoney-org/did_web_registries
```
### Verififying a did:web jwt credential

If you have the jwt token of a credential issued by a did:web registered on a site running a [p2pmoney/did_web_registries_svc](https://hub.docker.com/r/p2pmoney/did_web_registries_svc) container, you can get a verification card structure with the following code:

```
const DidWebRegistries = require('@p2pmoney-org/did_web_registries');

const displayFlag = (flag) => {
	switch(flag) {
		case -1:
			return 'No';
		case 0:
			return 'Don\'t Know';
		case 1:
			return 'Yes';
	}

};

let vc_jwt = 'eyJhbGciOiJ...du2Gqcg';
let card = await DidWebRegistries.getCredentialVerificationCard(vc_jwt);

if (card) {

	console.log('is credential publicly signed: ' + displayFlag(card.is_credential_signing_publicly_confirmed));
	console.log('has credential been revoked: ' + displayFlag(card.is_credential_revoked));


	console.log('is issuer registered: ' + displayFlag(card.is_did_registered));
	console.log('is issuer a trusted_issuer: ' + displayFlag(card.is_did_trusted_issuer));

	console.log('RootTAO https identity: ' + card.RootTAO.identity.name);
	console.log('RootTAO https site: ' + card.RootTAO.identity.identity.link);
	console.log('RootTAO is valid: ' + displayFlag(card.RootTAO.is_trusted));

}
```