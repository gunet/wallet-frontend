import React, { useEffect, useState } from 'react';
import { BiSolidCategoryAlt, BiSolidUserCircle, BiWorld, BiSolidInstitution } from 'react-icons/bi';
import { AiFillCalendar } from 'react-icons/ai';
import { RiPassExpiredFill } from 'react-icons/ri';
import { MdTitle, MdGrade, MdOutlineNumbers, MdPlace } from 'react-icons/md';
import { GiLevelEndFlag } from 'react-icons/gi';
import { formatDate } from '../../functions/DateFormat';
import { parseCredential } from '../../functions/parseCredential';

const getFieldIcon = (fieldName) => {
	switch (fieldName) {
		case 'type':
			return <BiSolidCategoryAlt size={25} className="inline mr-1" />;
		case 'expdate':
			return <RiPassExpiredFill size={25} className="inline mr-1" />;
		case 'dateOfBirth':
			return <AiFillCalendar size={25} className="inline mr-1" />;
		case 'id':
			return <MdOutlineNumbers size={25} className="inline mr-1" />;
		case 'familyName':
		case 'firstName':
			return <BiSolidUserCircle size={25} className="inline mr-1" />;
		case 'diplomaTitle':
			return <MdTitle size={25} className="inline mr-1" />;
		case 'eqfLevel':
			return <GiLevelEndFlag size={25} className="inline mr-1" />;
		case 'grade':
			return <MdGrade size={25} className="inline mr-1" />;
		case 'country':
			return <BiWorld size={25} className="inline mr-1" />;
		case 'institution':
			return <BiSolidInstitution size={25} className="inline mr-1" />;
		case 'place':
			return <MdPlace size={25} className="inline mr-1" />;
		default:
			return null;
	}
};

const renderRow = (fieldName, label, fieldValue) => {
	if (fieldValue) {
		return (
			<tr className="text-left">
				<td className="font-bold text-primary dark:text-primary-light py-2 px-2 rounded-l-xl">
					<div className="flex md:flex-row flex-col items-left">
						{getFieldIcon(fieldName)}
						<span className="md:ml-1 flex items-center">{label}:</span>
					</div>
				</td>
				<td className="text-gray-700 dark:text-white py-2 px-2 rounded-r-xl">{fieldValue}</td>
			</tr>
		);
	} else {
		return null;
	}
};

const CredentialInfo = ({ credential, mainClassName = "text-xs sm:text-sm md:text-base pt-5 pr-2 w-full" }) => {

	const [parsedCredential, setParsedCredential] = useState(null);

	useEffect(() => {
		parseCredential(credential).then((c) => {
			setParsedCredential(c);
		});
	}, [credential]);

	useEffect(() => {
		parseCredential(credential).then((c) => {
			setParsedCredential(c);
		});
	}, [credential]);

	return (
		<div className={mainClassName}>
			<table className="lg:w-4/5">
				<tbody className="divide-y-4 divide-transparent">
					{parsedCredential && (
						<>

							{renderRow('expdate', 'Valid From', parsedCredential.validFrom && formatDate(parsedCredential.validFrom))}
							{renderRow('expdate', 'Expiration', parsedCredential.expirationDate && formatDate(parsedCredential.expirationDate))}

							{renderRow('familyName', 'Family Name', parsedCredential.credentialSubject.family_name)}
							{renderRow('firstName', 'Given Name', parsedCredential.credentialSubject.given_name)}
							{renderRow('id', 'Personal ID', parsedCredential.type.includes('urn:credential:vid') && parsedCredential.credentialSubject.personal_identifier)}
							{renderRow('dateOfBirth', 'Birthday', parsedCredential.credentialSubject.dateOfBirth)}
							{renderRow('dateOfBirth', 'Birthday', parsedCredential.credentialSubject?.birth_date && new Date(parsedCredential.credentialSubject?.birth_date).toDateString())}

							{renderRow('id', 'SSN', parsedCredential.credentialSubject.social_security_pin)}
							{renderRow('id', 'Document ID', parsedCredential.credentialSubject?.pda1_document_id ?? parsedCredential.credentialSubject?.ehic_card_identification_number ?? undefined )}

							{renderRow('id', 'ID Competent Institution', parsedCredential.credentialSubject.ehic_institution_id)}
							{renderRow('institution', 'Name Competent Institution', parsedCredential.credentialSubject.ehic_institution_name)}
							{renderRow('country', 'Country Competent Institution', parsedCredential.credentialSubject.ehic_institution_country_code)}

							{renderRow('id', 'MS Legislation', parsedCredential.pda1_member_state)}
							{renderRow('familyName', 'Employer Name', parsedCredential.credentialSubject.pda1_name)}
							{renderRow('country', 'Employer Country', parsedCredential.credentialSubject.pda1_employer_country_code)}
							{renderRow('place', 'Place of Work', parsedCredential.credentialSubject.pda1_pow_company_name)}
							{renderRow('place', 'Town', parsedCredential.credentialSubject.pda1_pow_employer_town)}
							{renderRow('place', 'Postal Code', parsedCredential.credentialSubject.pda1_pow_employer_postal_code)}
							{renderRow('country', 'Country', parsedCredential.credentialSubject.pda1_pow_employer_country_code)}

							{renderRow('id', 'Revocation ID', parsedCredential.credentialStatus && parsedCredential?.credentialStatus?.id?.split('#')[1])}
						</>
					)}
				</tbody>
			</table>
		</div>
	);
};

export default CredentialInfo;
