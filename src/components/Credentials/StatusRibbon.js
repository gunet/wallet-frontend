// StatusRibbon.js
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseCredential } from '../../functions/parseCredential';
import axios from 'axios';

const StatusRibbon = ({ credential }) => {
	const { t } = useTranslation();

	const [credentialStatus, setCredentialStatus] = useState(null);

	const [parsedCredential, setParsedCredential] = useState(null);

	const CheckExpired = (expDate) => {
		const today = new Date();
		const expirationDate = new Date(expDate);
		return expirationDate < today;
	};

	const CheckRevoked = async () => {
		if (!parsedCredential.credentialStatus) {
			return false;
		}
		const [crlListURL, id] = parsedCredential.credentialStatus.id.split('#');
		if (crlListURL && id && typeof crlListURL != 'string' || typeof id != 'string') {
			return false;
		}

		const crlResult = await axios.get(crlListURL);
		const { crl } = crlResult.data;

		const crlRecord = crl.filter((record) => record.id == id)[0];
		if (!crlRecord) {
			console.log("Could not get crl record for this credential");
			return false;
		}
		return (crlRecord && crlRecord.revocation_date != null);
	};

	useEffect(() => {
		parseCredential(credential).then((c) => {
			setParsedCredential(c);
		});
	}, [credential]);

	useEffect(() => {
		if (parsedCredential != null) {
			CheckRevoked().then((revocationStatus) => {
				console.log("status = ", revocationStatus)
				if (revocationStatus == true) {
					setCredentialStatus('revoked');
				}
				else if (CheckExpired(parsedCredential.expirationDate)) {
					setCredentialStatus('expired');
				}
			});
		}
	}, [parsedCredential]);


	if (parsedCredential && credentialStatus && credentialStatus == 'revoked') {
		return (
			<>
				{
					<div className={`absolute bottom-0 right-0 text-white text-xs py-1 px-3 rounded-tl-lg border-t border-l border-white ${credentialStatus == 'revoked' && 'bg-red-500'}`}>
						{ t('statusRibbon.revoked') }
					</div>
				}
			</>
		);
	}
	else if (parsedCredential && credentialStatus && credentialStatus == 'expired') {
		return (
			<>
				{
					<div className={`absolute bottom-0 right-0 text-white text-xs py-1 px-3 rounded-tl-lg border-t border-l border-white ${credentialStatus == 'expired' && 'bg-orange-500'}`}>
						{ t('statusRibbon.expired') }
					</div>
				}
			</>
		);
	}
};

export default StatusRibbon;
