import { useEffect, useState } from 'react';

import * as api from '../api';


function useCheckURL(urlToCheck) {
	const isLoggedIn = api.isLoggedIn();
	const [isValidURL, setIsValidURL] = useState(null);
	const [showPopup, setShowPopup] = useState(false);
	const [selectedValue, setSelectedValue] = useState(null);
	const [conformantCredentialsMap, setConformantCredentialsMap] = useState(null);

	useEffect(() => {

		async function handleAuthorizationRequest(url) {

			try {
				const response = await api.post(
					"/presentation/handle/authorization/request",
					{ authorization_request: url },
				);

				console.log("handleAuthorizationRequest:", response.data.redirect_to);

				if(response.statusText==="OK"){
					console.log(response.data);
					const { conformantCredentialsMap, verifierDomainName, redirect_to } = response.data;
					console.log(conformantCredentialsMap, verifierDomainName, redirect_to);
					if (redirect_to) {
						window.location.href = redirect_to; // Navigate to the redirect URL
					}else{
						console.log('need action');

						setConformantCredentialsMap(conformantCredentialsMap.VID);
						setShowPopup(true);

					}

					return true;
				}else{
					return false;
				}
			} catch (e) {
				console.log("Failed handleAuthorizationRequest:", e);
				return false;
			}

		};

		async function handleAuthorizationResponse(url) {
			try {
				const response = await api.post(
					"/issuance/handle/authorization/response",
					{ authorization_response_url: url },
				);
				console.log("handleAuthorizationResponse:", response);
				return true;

			} catch (e) {
				console.log("Failed handleAuthorizationResponse:", e);
				return false;
			}
		}

		if (urlToCheck && isLoggedIn && window.location.pathname==="/cb") {
			(async () => {
				const isRequestHandled = await handleAuthorizationRequest(urlToCheck);
				const isResponseHandled = await handleAuthorizationResponse(urlToCheck);


				if (isRequestHandled || isResponseHandled) {
					setIsValidURL(true);
				} else {
					setIsValidURL(false);
				}

			})();
		}
	}, [urlToCheck, isLoggedIn]);

	useEffect(() => {
		if (selectedValue) {
			console.log(selectedValue);

			api.post("/presentation/generate/authorization/response",
			{ verifiable_credentials_map: {title: "VC Selection",selectedValue} },
		).then(success => {
			console.log(success);
			const { redirect_to } = success.data;
			window.location.href = redirect_to; // Navigate to the redirect URL

		}).catch(e => {
			console.error("Failed to generate authorization response")
			console.error(e.response.data);
		});

		}
	}, [selectedValue]);

	return { isValidURL, showPopup, setShowPopup, setSelectedValue, conformantCredentialsMap };
}

export default useCheckURL;