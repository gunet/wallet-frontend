import React, { useEffect, useState } from 'react';
import { BiSolidCategoryAlt, BiSolidUserCircle } from 'react-icons/bi';
import { AiFillCalendar } from 'react-icons/ai';
import { RiPassExpiredFill } from 'react-icons/ri';
import { MdTitle, MdGrade, MdOutlineNumbers } from 'react-icons/md';
import { GiLevelEndFlag } from 'react-icons/gi';
import { formatDate } from '../../functions/DateFormat';
import { parseCredential } from '../../functions/parseCredential';

const getFieldIcon = (fieldName) => {
	switch (fieldName) {
		case 'type':
			return <BiSolidCategoryAlt size={25} className="inline mr-1 mb-1" />;
		case 'expdate':
			return <RiPassExpiredFill size={25} className="inline mr-1 mb-1" />;
		case 'dateOfBirth':
			return <AiFillCalendar size={25} className="inline mr-1 mb-1" />;
		case 'id':
			return <MdOutlineNumbers size={25} className="inline mr-1 mb-1" />
		case 'familyName':
		case 'firstName':
			return <BiSolidUserCircle size={25} className="inline mr-1 mb-1" />;
		case 'diplomaTitle':
			return <MdTitle size={25} className="inline mr-1 mb-1" />;
		case 'eqfLevel':
			return <GiLevelEndFlag size={25} className="inline mr-1 mb-1" />;
		case 'grade':
			return <MdGrade size={25} className="inline mr-1 mb-1" />;
		default:
			return null;
	}
};

const renderRow = (fieldName, label, fieldValue) => {
	if (fieldValue) {
		return (
			<tr className="text-left text-xs sm:text-sm md:text-base">
				<td className="font-bold text-custom-blue py-2 px-2 rounded-l-xl">
					<div className="flex md:flex-row flex-col items-left">
						{getFieldIcon(fieldName)}
						<span className="md:ml-1">{label}:</span>
					</div>
				</td>
				<td className="py-2 px-2 rounded-r-xl">{fieldValue}</td>
			</tr>
		);
	} else {
		return null;
	}
};

const CredentialInfo = ({ credential, mainClassName = "pt-5 pr-2 w-full" }) => {

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
							{renderRow('expdate', 'Expiration', formatDate(parsedCredential.expirationDate))}
							{renderRow('familyName', 'Family Name', parsedCredential.credentialSubject.familyName)}
							{renderRow('firstName', 'First Name', parsedCredential.credentialSubject.firstName)}
							{renderRow('id', 'Personal ID', parsedCredential.credentialSubject.personalIdentifier)}
							{renderRow('dateOfBirth', 'Birthday', parsedCredential.credentialSubject.dateOfBirth)}
							{renderRow('dateOfBirth', 'Birthday', parsedCredential.credentialSubject.birthdate)}
							{renderRow('diplomaTitle', 'Title', parsedCredential.credentialSubject.diplomaTitle)}
							{renderRow('eqfLevel', 'EQF', parsedCredential.credentialSubject.eqfLevel)}
							{renderRow('grade', 'Grade', parsedCredential.credentialSubject.grade)}
							{renderRow('id', 'SSN', parsedCredential.credentialSubject.socialSecurityIdentification?.ssn)}
							{renderRow('id', 'Document ID', parsedCredential.credentialSubject.documentId)}
						</>
					)}
				</tbody>
			</table>
		</div>
	);
};

export default CredentialInfo;
