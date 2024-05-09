import * as jose from "jose";
import { JWK, SignJWT } from "jose";
import { base58btc } from 'multiformats/bases/base58';
import { varint } from 'multiformats';
import * as KeyDidResolver from 'key-did-resolver'
import { Resolver } from 'did-resolver'
import { v4 as uuidv4 } from "uuid";
import * as util from '@cef-ebsi/key-did-resolver/dist/util.js';
import { SignVerifiablePresentationJWT } from "@wwwallet/ssi-sdk";

import { verifiablePresentationSchemaURL } from "../constants";
import { jsonParseTaggedBinary, jsonStringifyTaggedBinary, toBase64Url } from "../util";


const DID_KEY_VERSION = process.env.REACT_APP_DID_KEY_VERSION;
const keyDidResolver = KeyDidResolver.getResolver();
const didResolver = new Resolver(keyDidResolver);


export type EncryptedContainerKeys = {
	passwordKey?: PasswordKeyInfo;
	prfKeys: WebauthnPrfEncryptionKeyInfo[];
}
export type EncryptedContainer = EncryptedContainerKeys & {
	jwe: string;
}

// Values from OWASP password guidelines https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#pbkdf2
const pbkdfHash: HashAlgorithmIdentifier = "SHA-256";
const pbkdfIterations: number = 600000;

export type WrappedKeyInfo = {
	wrappedKey: Uint8Array,
	unwrapAlgo: "AES-KW",
	unwrappedKeyAlgo: KeyAlgorithm,
}

type PasswordKeyInfo = {
	mainKey: WrappedKeyInfo,
	pbkdf2Params: Pbkdf2Params;
}

export type WebauthnPrfSaltInfo = {
	credentialId: Uint8Array,
	prfSalt: Uint8Array,
}

export type WebauthnPrfEncryptionKeyInfo = WebauthnPrfSaltInfo & {
	mainKey: WrappedKeyInfo,
	hkdfSalt: Uint8Array,
	hkdfInfo: Uint8Array,
}

type PrfExtensionInput = { eval: { first: BufferSource } } | { evalByCredential: PrfEvalByCredential };
type PrfEvalByCredential = { [credentialId: string]: { first: BufferSource } };
type PrfExtensionOutput = { enabled: boolean, results?: { first?: ArrayBuffer } };

export type PublicData = {
	publicKey: JWK,
	did: string,
	alg: string,
	verificationMethod: string,
}

export type PrivateData = PublicData & {
	wrappedPrivateKey: WrappedPrivateKey,
}

type WrappedPrivateKey = {
	privateKey: BufferSource,
	aesGcmParams: AesGcmParams,
	unwrappedKeyAlgo: EcKeyImportParams,
}


async function createMainKey(wrappingKey: CryptoKey): Promise<WrappedKeyInfo> {
	const mainKey = await crypto.subtle.generateKey(
		{ name: "AES-GCM", length: 256 },
		true,
		["encrypt"],
	);
	return await wrapKey(wrappingKey, mainKey);
}

async function createSessionKey(): Promise<[CryptoKey, ArrayBuffer]> {
	const sessionKey = await crypto.subtle.generateKey(
		{ name: "AES-GCM", length: 256 },
		true,
		["encrypt", "wrapKey"],
	);
	const exportedSessionKey = await crypto.subtle.exportKey(
		"raw",
		sessionKey,
	);
	return [sessionKey, exportedSessionKey];
}

async function importSessionKey(exportedSessionKey: BufferSource): Promise<CryptoKey> {
	return await crypto.subtle.importKey(
		"raw",
		exportedSessionKey,
		"AES-GCM",
		false,
		["decrypt", "unwrapKey"],
	);
}

export async function openPrivateData(exportedSessionKey: BufferSource, privateDataJwe: string): Promise<[PrivateData, CryptoKey]> {
	const sessionKey = await importSessionKey(exportedSessionKey);
	const privateData = jsonParseTaggedBinary(
		new TextDecoder().decode(
			(await jose.compactDecrypt(privateDataJwe, sessionKey)).plaintext
		));
	return [privateData, sessionKey];
}

async function wrapKey(wrappingKey: CryptoKey, keyToWrap: CryptoKey): Promise<WrappedKeyInfo> {
	const wrapAlgo = "AES-KW";
	const wrappedKey = new Uint8Array(await crypto.subtle.wrapKey(
		"raw",
		keyToWrap,
		wrappingKey,
		wrapAlgo,
	));

	return {
		unwrappedKeyAlgo: keyToWrap.algorithm,
		unwrapAlgo: wrapAlgo,
		wrappedKey,
	};
}

async function unwrapKey(wrappingKey: CryptoKey, keyInfo: WrappedKeyInfo, extractable: boolean = false): Promise<CryptoKey> {
	return await crypto.subtle.unwrapKey(
		"raw",
		keyInfo.wrappedKey,
		wrappingKey,
		keyInfo.unwrapAlgo,
		keyInfo.unwrappedKeyAlgo,
		extractable,
		["encrypt", "decrypt", "wrapKey", "unwrapKey"],
	);
}

async function rewrapKey(wrappedKey: WrappedKeyInfo, unwrappingKey: CryptoKey, wrappingKey: CryptoKey): Promise<WrappedKeyInfo> {
	const unwrappedKey = await unwrapKey(unwrappingKey, wrappedKey, true);
	return await wrapKey(wrappingKey, unwrappedKey);
}

async function unwrapPrivateKey(wrappedPrivateKey: WrappedPrivateKey, wrappingKey: CryptoKey, extractable: boolean = false): Promise<CryptoKey> {
	return await crypto.subtle.unwrapKey(
		"jwk",
		wrappedPrivateKey.privateKey,
		wrappingKey,
		wrappedPrivateKey.aesGcmParams,
		wrappedPrivateKey.unwrappedKeyAlgo,
		extractable,
		["sign"],
	);
};

async function wrapPrivateKey(privateKey: CryptoKey, wrappingKey: CryptoKey): Promise<WrappedPrivateKey> {
	const privateKeyAesGcmParams: AesGcmParams = {
		name: "AES-GCM",
		iv: crypto.getRandomValues(new Uint8Array(96 / 8)),
		additionalData: new Uint8Array([]),
		tagLength: 128,
	};
	return {
		privateKey: await crypto.subtle.wrapKey("jwk", privateKey, wrappingKey, privateKeyAesGcmParams),
		aesGcmParams: privateKeyAesGcmParams,
		unwrappedKeyAlgo: { name: "ECDSA", namedCurve: "P-256" },
	};
};

async function encryptPrivateData(privateData: PrivateData, encryptionKey: CryptoKey): Promise<string> {
	const cleartext = new TextEncoder().encode(jsonStringifyTaggedBinary(privateData));
	return await new jose.CompactEncrypt(cleartext)
		.setProtectedHeader({ alg: "A256GCMKW", enc: "A256GCM" })
		.encrypt(encryptionKey);
};

async function decryptPrivateData(privateDataJwe: string, encryptionKey: CryptoKey): Promise<PrivateData> {
	return jsonParseTaggedBinary(
		new TextDecoder().decode(
			(await jose.compactDecrypt(privateDataJwe, encryptionKey)).plaintext
		));
};

async function reencryptPrivateData(privateDataJwe: string, fromKey: CryptoKey, toKey: CryptoKey): Promise<string> {
	const privateData = await decryptPrivateData(privateDataJwe, fromKey);
	const privateKey = await unwrapPrivateKey(privateData.wrappedPrivateKey, fromKey, true);
	privateData.wrappedPrivateKey = await wrapPrivateKey(privateKey, toKey);
	return await encryptPrivateData(privateData, toKey);
}

async function derivePasswordKey(password: string, pbkdf2Params: Pbkdf2Params): Promise<CryptoKey> {
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveKey"],
	);

	return await crypto.subtle.deriveKey(
		pbkdf2Params,
		keyMaterial,
		{ name: "AES-KW", length: 256 },
		true,
		["wrapKey", "unwrapKey"],
	);
};

async function derivePrfKey(prfOutput: BufferSource, hkdfSalt: BufferSource, hkdfInfo: BufferSource): Promise<CryptoKey> {
	const hkdfKey = await crypto.subtle.importKey(
		"raw",
		prfOutput,
		"HKDF",
		false,
		["deriveKey"],
	);

	return await crypto.subtle.deriveKey(
		{ name: "HKDF", hash: "SHA-256", salt: hkdfSalt, info: hkdfInfo },
		hkdfKey,
		{ name: "AES-KW", length: 256 },
		true,
		["wrapKey", "unwrapKey"],
	);
}

function makeRegistrationPrfExtensionInputs(credential: PublicKeyCredential, prfSalt: BufferSource): {
	allowCredentials: PublicKeyCredentialDescriptor[],
	prfInput: PrfExtensionInput,
} {
	return {
		allowCredentials: [{ type: "public-key", id: credential.rawId }],
		prfInput: { eval: { first: prfSalt } },
	};
}

export function makeAssertionPrfExtensionInputs(prfKeys: WebauthnPrfSaltInfo[]): {
	allowCredentials: PublicKeyCredentialDescriptor[],
	prfInput: PrfExtensionInput,
} {
	return {
		allowCredentials: prfKeys.map(
			(keyInfo: WebauthnPrfSaltInfo) => ({
				type: "public-key",
				id: keyInfo.credentialId,
			})
		),
		prfInput: {
			evalByCredential: prfKeys.reduce(
				(result: { [credentialId: string]: { first: BufferSource } }, keyInfo: WebauthnPrfSaltInfo) => {
					result[toBase64Url(keyInfo.credentialId)] = { first: keyInfo.prfSalt };
					return result;
				},
				{},
			),
		}
	};
}

async function getPrfOutput(
	credential: PublicKeyCredential | null,
	rpId: string,
	prfInputs: { allowCredentials?: PublicKeyCredentialDescriptor[], prfInput: PrfExtensionInput },
	promptForRetry: () => Promise<boolean>,
): Promise<[ArrayBuffer, PublicKeyCredential]> {
	const clientExtensionOutputs = credential?.getClientExtensionResults() as { prf?: PrfExtensionOutput } | null;
	const canRetry = !clientExtensionOutputs?.prf || clientExtensionOutputs?.prf?.enabled;

	if (credential && clientExtensionOutputs?.prf?.results?.first) {
		return [clientExtensionOutputs?.prf?.results?.first, credential];

	} else if (canRetry) {
		if (await promptForRetry()) {
			try {
				const retryCred = await navigator.credentials.get({
					publicKey: {
						rpId,
						challenge: crypto.getRandomValues(new Uint8Array(32)),
						allowCredentials: prfInputs?.allowCredentials,
						extensions: { prf: prfInputs.prfInput } as AuthenticationExtensionsClientInputs,
					},
				}) as PublicKeyCredential;
				return await getPrfOutput(retryCred, rpId, prfInputs, async () => false);
			} catch (err) {
				if (err instanceof DOMException && err.name === "NotAllowedError") {
					throw { errorId: "prf_retry_failed", credential };
				} else {
					throw { errorId: "failed" };
				}
			}

		} else {
			throw { errorId: "canceled" };
		}

	} else {
		throw { errorId: "prf_not_supported" };
	}
}

async function createPrfKey(
	credential: PublicKeyCredential,
	prfSalt: Uint8Array,
	rpId: string,
	[wrappedMainKey, unwrappingKey]: [WrappedKeyInfo, CryptoKey] | [null, null],
	promptForPrfRetry: () => Promise<boolean>,
): Promise<[CryptoKey, WebauthnPrfEncryptionKeyInfo]> {
	const [prfOutput,] = await getPrfOutput(
		credential,
		rpId,
		makeRegistrationPrfExtensionInputs(credential, prfSalt),
		promptForPrfRetry,
	);
	const hkdfSalt = crypto.getRandomValues(new Uint8Array(32));
	const hkdfInfo = new TextEncoder().encode("eDiplomas PRF");
	const prfKey = await derivePrfKey(prfOutput, hkdfSalt, hkdfInfo);
	const mainKey = wrappedMainKey
		? await rewrapKey(wrappedMainKey, unwrappingKey, prfKey)
		: await createMainKey(prfKey);
	const keyInfo: WebauthnPrfEncryptionKeyInfo = {
		mainKey,
		credentialId: new Uint8Array(credential.rawId),
		prfSalt,
		hkdfSalt,
		hkdfInfo,
	};
	return [prfKey, keyInfo];
}

export async function getPrfKey(
	privateData: EncryptedContainer,
	credential: PublicKeyCredential | null,
	rpId: string,
	promptForPrfRetry: () => Promise<boolean>,
): Promise<[CryptoKey, WebauthnPrfEncryptionKeyInfo]> {
	const [prfOutput, prfCredential] = await getPrfOutput(
		credential,
		rpId,
		makeAssertionPrfExtensionInputs(privateData.prfKeys),
		promptForPrfRetry,
	);
	const keyInfo = privateData.prfKeys.find(keyInfo => toBase64Url(keyInfo.credentialId) === prfCredential.id);
	if (keyInfo === undefined) {
		throw new Error("PRF key not found");
	}
	return [await derivePrfKey(prfOutput, keyInfo.hkdfSalt, keyInfo.hkdfInfo), keyInfo];
}

export async function addPrf(
	privateData: EncryptedContainer,
	credential: PublicKeyCredential,
	rpId: string,
	existingPrfKey: CryptoKey,
	wrappedMainKey: WrappedKeyInfo,
	promptForPrfRetry: () => Promise<boolean>,
): Promise<EncryptedContainer> {
	const prfSalt = crypto.getRandomValues(new Uint8Array(32))
	const [, keyInfo] = await createPrfKey(credential, prfSalt, rpId, [wrappedMainKey, existingPrfKey], promptForPrfRetry);
	return {
		...privateData,
		prfKeys: [
			...privateData.prfKeys,
			keyInfo,
		],
	};
}

export function deletePrf(privateData: EncryptedContainer, credentialId: Uint8Array): EncryptedContainer {
	return {
		...privateData,
		prfKeys: privateData.prfKeys.filter((keyInfo) => (
			toBase64Url(keyInfo.credentialId) !== toBase64Url(credentialId)
		)),
	};
}

export type UnlockSuccess = {
	exportedSessionKey: ArrayBuffer,
	privateDataCache: EncryptedContainer,
	privateDataJwe: string,
}
export async function unlock(mainKey: CryptoKey, privateData: EncryptedContainer): Promise<UnlockSuccess> {
	const [sessionKey, exportedSessionKey] = await createSessionKey();
	const reencryptedPrivateData = await reencryptPrivateData(privateData.jwe, mainKey, sessionKey);
	return {
		exportedSessionKey,
		privateDataCache: privateData,
		privateDataJwe: reencryptedPrivateData,
	};
}

export async function unlockPassword(privateData: EncryptedContainer, password: string): Promise<UnlockSuccess> {
	const keyInfo = privateData.passwordKey;
	if (keyInfo === undefined) {
		throw new Error("Password key not found");
	}
	const passwordKey = await derivePasswordKey(password, keyInfo.pbkdf2Params);
	return await unlock(await unwrapKey(passwordKey, keyInfo.mainKey), privateData);
};

export async function unlockPrf(
	privateData: EncryptedContainer,
	credential: PublicKeyCredential,
	rpId: string,
	promptForPrfRetry: () => Promise<boolean>,
): Promise<UnlockSuccess> {
	const [prfKey, keyInfo] = await getPrfKey(privateData, credential, rpId, promptForPrfRetry);
	return await unlock(await unwrapKey(prfKey, keyInfo.mainKey), privateData);
}

export async function init(
	wrappedMainKey: WrappedKeyInfo,
	wrappingKey: CryptoKey,
	keyInfo: { passwordKey?: PasswordKeyInfo, prfKeys: WebauthnPrfEncryptionKeyInfo[] },
): Promise<{ mainKey: CryptoKey, publicData: PublicData, privateData: EncryptedContainer }> {
	const mainKey = await unwrapKey(wrappingKey, wrappedMainKey);

	const { publicData, privateDataJwe } = await createWallet(mainKey);
	const privateData: EncryptedContainer = {
		...keyInfo,
		jwe: privateDataJwe,
	};

	return {
		mainKey,
		publicData,
		privateData,
	};
}

export async function initPassword(password: string): Promise<[WrappedKeyInfo, CryptoKey, EncryptedContainerKeys]> {
	const pbkdf2Params: Pbkdf2Params = {
		name: "PBKDF2",
		hash: pbkdfHash,
		iterations: pbkdfIterations,
		salt: crypto.getRandomValues(new Uint8Array(32)),
	};
	const passwordKey = await derivePasswordKey(password, pbkdf2Params);
	const wrappedMainKey = await createMainKey(passwordKey);
	const passwordKeyInfo = {
		mainKey: wrappedMainKey,
		pbkdf2Params,
	};

	return [wrappedMainKey, passwordKey, { passwordKey: passwordKeyInfo, prfKeys: [] }];
}

export async function initPrf(
	credential: PublicKeyCredential,
	prfSalt: Uint8Array,
	rpId: string,
	promptForPrfRetry: () => Promise<boolean>,
): Promise<[WrappedKeyInfo, CryptoKey, EncryptedContainerKeys]> {
	const [prfKey, keyInfo] = await createPrfKey(credential, prfSalt, rpId, [null, null], promptForPrfRetry);
	return [keyInfo.mainKey, prfKey, { prfKeys: [keyInfo] }];
}

async function compressPublicKey(uncompressedRawPublicKey: Uint8Array): Promise<Uint8Array> {
	// Check if the uncompressed public key has the correct length
	if (uncompressedRawPublicKey.length !== 65 || uncompressedRawPublicKey[0] !== 0x04) {
		throw new Error('Invalid uncompressed public key format');
	}

	// Get the x-coordinate
	const x = uncompressedRawPublicKey.subarray(1, 33) as any;
	const y = uncompressedRawPublicKey.subarray(33, 65) as any;
	// Determine the parity (odd or even) from the last byte
	const parity = y % 2 === 0 ? 0x02 : 0x03;

	// Create the compressed public key by concatenating the x-coordinate and the parity byte
	const compressedPublicKey = new Uint8Array([parity, ...x]);

	return compressedPublicKey;
}

async function createW3CDID(publicKey: CryptoKey): Promise<{ didKeyString: string }> {
	const rawPublicKey = new Uint8Array(await crypto.subtle.exportKey("raw", publicKey));
	const compressedPublicKeyBytes = await compressPublicKey(rawPublicKey)
	// Concatenate keyType and publicKey Uint8Arrays
	const multicodecPublicKey = new Uint8Array(2 + compressedPublicKeyBytes.length);
	varint.encodeTo(0x1200, multicodecPublicKey, 0);

	multicodecPublicKey.set(compressedPublicKeyBytes, 2);

	// Base58-btc encode the multicodec public key
	const base58EncodedPublicKey = base58btc.encode(multicodecPublicKey);

	// Construct the did:key string
	const didKeyString = `did:key:${base58EncodedPublicKey}`;

	const doc = await didResolver.resolve(didKeyString);
	if (doc.didDocument == null) {
		throw new Error("Failed to resolve the generated DID");
	}
	return { didKeyString };
}

async function createWallet(mainKey: CryptoKey): Promise<{ publicData: PublicData, privateDataJwe: string }> {
	const jwtAlg = "ES256";
	const signatureAlgorithmFamily = "ECDSA";
	const namedCurve = "P-256";

	const { publicKey, privateKey } = await crypto.subtle.generateKey(
		{ name: signatureAlgorithmFamily, namedCurve: namedCurve },
		true,
		['sign', 'verify']
	);

	const publicKeyJWK: JWK = await crypto.subtle.exportKey("jwk", publicKey) as JWK;

	let did = null;
	if (DID_KEY_VERSION === "p256-pub") {
		const { didKeyString } = await createW3CDID(publicKey);
		did = didKeyString;
	}
	else if (DID_KEY_VERSION === "jwk_jcs-pub") {
		did = util.createDid(publicKeyJWK as JWK);
	}
	else {
		throw new Error("Application was not configured with a correct DID_KEY_VERSION");
	}
	const wrappedPrivateKey: WrappedPrivateKey = await wrapPrivateKey(privateKey, mainKey);

	const publicData = {
		publicKey: publicKeyJWK,
		did: did,
		alg: jwtAlg,
		verificationMethod: did + "#" + did.split(':')[2]
	};
	const privateData: PrivateData = {
		...publicData,
		wrappedPrivateKey,
	}
	const privateDataJwe = await encryptPrivateData(privateData, mainKey);

	return {
		publicData,
		privateDataJwe,
	};
};

export async function createIdToken([privateData, sessionKey]: [PrivateData, CryptoKey], nonce: string, audience: string): Promise<{ id_token: string; }> {
	const { alg, did, wrappedPrivateKey } = privateData;
	const privateKey = await unwrapPrivateKey(wrappedPrivateKey, sessionKey);
	const jws = await new SignJWT({ nonce: nonce })
		.setProtectedHeader({
			alg,
			typ: "JWT",
			kid: did + "#" + did.split(":")[2],
		})
		.setSubject(did)
		.setIssuer(did)
		.setExpirationTime('1m')
		.setAudience(audience)
		.setIssuedAt()
		.sign(privateKey);

	return { id_token: jws };
}

export async function signJwtPresentation([privateData, sessionKey]: [PrivateData, CryptoKey], nonce: string, audience: string, verifiableCredentials: any[]): Promise<{ vpjwt: string }> {
	const { alg, did, wrappedPrivateKey } = privateData;
	const privateKey = await unwrapPrivateKey(wrappedPrivateKey, sessionKey);

	const jws = await new SignVerifiablePresentationJWT()
		.setProtectedHeader({
			alg,
			typ: "JWT",
			kid: did + "#" + did.split(":")[2],
		})
		.setVerifiableCredential(verifiableCredentials)
		.setContext(["https://www.w3.org/2018/credentials/v1"])
		.setType(["VerifiablePresentation"])
		.setAudience(audience)
		.setCredentialSchema(
			verifiablePresentationSchemaURL,
			"FullJsonSchemaValidator2021")
		.setIssuer(did)
		.setSubject(did)
		.setHolder(did)
		.setJti(`urn:id:${uuidv4()}`)
		.setNonce(nonce)
		.setIssuedAt()
		.setExpirationTime('1m')
		.sign(privateKey);
	return { vpjwt: jws };
}

export async function generateOpenid4vciProof([privateData, sessionKey]: [PrivateData, CryptoKey], nonce: string, audience: string): Promise<{ proof_jwt: string }> {
	const { alg, did, wrappedPrivateKey } = privateData;
	const privateKey = await unwrapPrivateKey(wrappedPrivateKey, sessionKey);
	const header = {
		alg,
		typ: "openid4vci-proof+jwt",
		kid: did + "#" + did.split(":")[2]
	};

	const jws = await new SignJWT({ nonce: nonce })
		.setProtectedHeader(header)
		.setIssuedAt()
		.setIssuer(did)
		.setAudience(audience)
		.setExpirationTime('1m')
		.sign(privateKey);
	return { proof_jwt: jws };
}
