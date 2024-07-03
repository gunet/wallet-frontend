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
			return <MdOutlineNumbers size={25} className="inline mr-1" />
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
	}, []);

	return (
		<div className={mainClassName}>
			<table className="lg:w-4/5">
				<tbody className="divide-y-4 divide-transparent">
					{parsedCredential && (
						<>
							{renderRow('expdate', 'Valid From', parsedCredential.credentialSubject?.validityPeriod?.startingDate && formatDate(parsedCredential.credentialSubject?.validityPeriod?.startingDate))}
							{renderRow('expdate', 'Expiration', parsedCredential.credentialSubject?.validityPeriod?.endingDate && formatDate(parsedCredential.credentialSubject?.validityPeriod?.endingDate))}


							{renderRow('expdate', 'Valid From', parsedCredential.credentialSubject?.decisionOnApplicableLegislation?.validityPeriod?.startingDate && formatDate(parsedCredential.credentialSubject?.decisionOnApplicableLegislation?.validityPeriod?.startingDate))}
							{renderRow('expdate', 'Expiration', parsedCredential.credentialSubject?.decisionOnApplicableLegislation?.validityPeriod?.endingDate && formatDate(parsedCredential.credentialSubject?.decisionOnApplicableLegislation?.validityPeriod?.endingDate))}


							{renderRow('familyName', 'Family Name', parsedCredential.credentialSubject.familyName)}
							{renderRow('firstName', 'First Name', parsedCredential.credentialSubject.firstName)}
							{renderRow('id', 'Personal ID', parsedCredential.credentialSubject.personalIdentifier)}
							{renderRow('dateOfBirth', 'Birthday', parsedCredential.credentialSubject.dateOfBirth)}
							{renderRow('dateOfBirth', 'Birthday', parsedCredential.credentialSubject.birthdate)}

							{renderRow('id', 'SSN', parsedCredential.credentialSubject.socialSecurityIdentification?.ssn)}
							{renderRow('id', 'Document ID', parsedCredential.credentialSubject.documentId)}
							{renderRow('id', 'ID Competent Institution', parsedCredential.credentialSubject.competentInstitution?.competentInstitutionId)}
							{renderRow('institution', 'Name Competent Institution', parsedCredential.credentialSubject.competentInstitution?.competentInstitutionName)}
							{renderRow('country', 'Country Competent Institution', parsedCredential.credentialSubject.competentInstitution?.competentInstitutionCountryCode)}

							{renderRow('id', 'MS Legislation', parsedCredential.credentialSubject.decisionOnApplicableLegislation?.decisionOnMSWhoseLegislationApplies.memberStateWhoseLegislationIsToBeApplied)}
							{renderRow('familyName', 'Employer Name', parsedCredential.credentialSubject.employer?.name)}
							{renderRow('country', 'Employer Country', parsedCredential.credentialSubject.employer?.countryCode)}
							{renderRow('place', 'Place of Work', parsedCredential.credentialSubject.placeOfWork?.companyName)}
							{renderRow('place', 'Town', parsedCredential.credentialSubject.placeOfWork?.town)}
							{renderRow('place', 'Postal Code', parsedCredential.credentialSubject.placeOfWork?.postalCode)}
							{renderRow('country', 'Country', parsedCredential.credentialSubject.placeOfWork?.countryCode)}
						
							{renderRow('id', 'Revocation ID', parsedCredential.credentialStatus.id?.split('#')[1])}
						</>
					)}
				</tbody>
			</table>
		</div>
	);
};

export default CredentialInfo;
