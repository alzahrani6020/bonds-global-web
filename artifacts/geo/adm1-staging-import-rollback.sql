-- Bonds Global ADM1 staging import package
-- IMPORTANT: This file is designed for a NON-PRODUCTION staging database.
-- It ends with ROLLBACK by default. Do not replace ROLLBACK with COMMIT until
-- all verification queries pass in a staging environment.
--
-- Source candidates: 232 strict CONFIRMED links only.
-- Alias-review and unresolved rows are intentionally excluded.

begin;

create temporary table _adm1_geonames_candidate (
  admin_area_id uuid not null,
  country_code text not null,
  source_admin_code text not null,
  source_id text not null,
  confidence smallint not null
) on commit drop;

insert into _adm1_geonames_candidate
(admin_area_id,country_code,source_admin_code,source_id,confidence)
values
('61c85305-3efd-4b4e-9a56-368a56b5dae5'::uuid,'AE','AE.07','290595',100),
('7822979a-b02b-4e65-9faa-44fcb370080b'::uuid,'AE','AE.05','291075',100),
('2d6e0df0-9834-4591-b197-df41389f05dd'::uuid,'AE','AE.03','292224',100),
('1f0c5dda-d459-4aed-bbbe-a4fcf5924b03'::uuid,'AE','AE.06','292673',100),
('10e7a731-a757-4704-b5db-20ad181907a1'::uuid,'AE','AE.04','292879',100),
('f393789e-9b45-497b-8e1f-f1ff78299187'::uuid,'AE','AE.02','292933',100),
('c401facc-34ba-4f53-8e48-52e7a8c20eff'::uuid,'AE','AE.01','292969',100),
('85d7c843-e140-4545-aa6d-81c445dfed2f'::uuid,'BH','BH.15','290333',100),
('856ba385-c4d8-4a31-bb59-2731273b4b74'::uuid,'BH','BH.17','7090972',100),
('07836ec5-c180-4b64-9eda-a8eb0cf9e7be'::uuid,'BH','BH.19','7090974',100),
('779fb11f-c8d1-40f6-b924-ad49de89a58a'::uuid,'DJ','DJ.05','220781',100),
('588ec319-e751-4ba9-a63a-f723c8bc80dc'::uuid,'DJ','DJ.04','221525',100),
('30d6b22f-21b2-4eab-af22-8766bc840920'::uuid,'DJ','DJ.07','223818',100),
('c9bb2a6c-1102-4936-b066-23d704486aa1'::uuid,'DJ','DJ.06','223889',100),
('ad5a01cc-f524-42ef-8b0d-229ba5502f76'::uuid,'DJ','DJ.01','225282',100),
('ce641522-2276-482b-afe2-6fd3df2c1693'::uuid,'DJ','DJ.08','449265',100),
('50ae5701-6ee5-4d79-9c6d-d23efdc86dc1'::uuid,'DZ','DZ.15','2475683',100),
('d73a5a8e-3329-4074-89c5-b6ee0c42b26e'::uuid,'DZ','DZ.14','2475741',100),
('5d390098-d320-4693-bc14-5684fb2e86bc'::uuid,'DZ','DZ.56','2475858',100),
('3d4b2f71-2e7a-4901-893a-63a33360fc6a'::uuid,'DZ','DZ.55','2476027',100),
('46bacf2b-fbb0-40c6-b560-8038cf3a8d5d'::uuid,'DZ','DZ.54','2476302',100),
('ac1ecbf8-8980-4fbf-b96e-6aeb048c9850'::uuid,'DZ','DZ.13','2476893',100),
('0b46f891-0b7b-49c3-ae11-449e3a465268'::uuid,'DZ','DZ.53','2478217',100),
('da6f9e6a-bc89-48c9-bf75-38ba780d25e2'::uuid,'DZ','DZ.52','2479213',100),
('9a04a0ad-c913-439a-be4b-adf43113a6b6'::uuid,'DZ','DZ.31','2479532',100),
('c49f09d5-40f6-4bac-902a-308a6e0d0f96'::uuid,'DZ','DZ.30','2481001',100),
('a96dfcf4-551d-40f4-a7ce-8084d0d5fea8'::uuid,'DZ','DZ.12','2481696',100),
('5d5f03d4-3e1c-4f94-bb8b-a8726e0c4251'::uuid,'DZ','DZ.10','2482557',100),
('60794348-fd9b-4ddb-acad-036fd3bb8726'::uuid,'DZ','DZ.51','2483666',100),
('afa4ae64-5b2b-4441-982d-347519e92457'::uuid,'DZ','DZ.29','2484618',100),
('1e987bee-27d1-47cb-a1db-1a9136672044'::uuid,'DZ','DZ.50','2485794',100),
('f80601a1-11f3-431a-9d12-c30c084511be'::uuid,'DZ','DZ.09','2485920',100),
('c66cf61e-b359-4a96-8045-bb2d64d9434d'::uuid,'DZ','DZ.49','2486512',100),
('63084902-f1bf-4981-8de5-e6e73e439499'::uuid,'DZ','DZ.27','2486682',100),
('bc0ca0f3-3436-42dd-9e89-f2adf8ca5071'::uuid,'DZ','DZ.07','2487130',100),
('b646b5c2-8589-479d-a205-5ebad2d6810d'::uuid,'DZ','DZ.48','2487449',100),
('29bcd83f-7d07-414c-a54f-ed3afcd4bd7b'::uuid,'DZ','DZ.06','2488831',100),
('850aa9b0-9bfa-4862-8873-58f14cc615bf'::uuid,'DZ','DZ.26','2490095',100),
('ccdd1ee7-a20c-46ea-9e20-80aad709ca3e'::uuid,'DZ','DZ.47','2491887',100),
('bb419571-be5d-4444-8504-4c5e873f1d5b'::uuid,'DZ','DZ.24','2492910',100),
('89621e1c-0d06-4dca-8512-0ef1108384c8'::uuid,'DZ','DZ.46','2493455',100),
('0654d986-2945-46b9-9e9a-f5a6057f981c'::uuid,'DZ','DZ.23','2495659',100),
('a0f02ea2-9256-4777-8b6a-e0b4d2d2a5f6'::uuid,'DZ','DZ.45','2496045',100),
('fa75a450-aefa-4657-89da-e0397158c047'::uuid,'DZ','DZ.44','2497322',100),
('949dcc64-d299-4d67-a45f-af1278add963'::uuid,'DZ','DZ.43','2497406',100),
('fc35e26e-985e-41bd-a446-12d5f54d962d'::uuid,'DZ','DZ.22','2500013',100),
('c8ecbb76-8b5d-4bbd-9f0b-fc077f94f61b'::uuid,'DZ','DZ.04','2501147',100),
('7fb1cb45-a6f5-4c23-8312-58597ed64282'::uuid,'DZ','DZ.41','2501296',100),
('03596f71-c519-4d74-8d01-4b469b1d7862'::uuid,'DZ','DZ.40','2502638',100),
('ced345d9-b744-4067-855f-cda8556cdfc8'::uuid,'DZ','DZ.39','2503699',100),
('2fc31184-1e92-49ff-81ec-e42622a20541'::uuid,'DZ','DZ.19','2503822',100),
('31e30b5d-859b-44e2-a8f3-609acd5f8de7'::uuid,'DZ','DZ.18','2505325',100),
('dc5db144-bc24-483b-bf19-d7f60fb1ec26'::uuid,'DZ','DZ.03','2505569',100),
('6168579e-e13e-4e60-843c-a0913d872a63'::uuid,'DZ','DZ.37','2506994',100),
('130f57d2-da6b-4971-a5f0-7f54e442e222'::uuid,'DZ','DZ.01','2507475',100),
('deb4e4a2-4a02-4001-95b4-3293a0c4fbea'::uuid,'DZ','DZ.36','2507899',100),
('2868f71a-7842-40c5-acb3-da5b0c7d7bca'::uuid,'DZ','DZ.35','2508226',100),
('587ba9cb-aec7-4106-aff5-29327e5bfb21'::uuid,'DZ','DZ.34','2508807',100),
('a6cd82eb-0932-4563-9716-ae4437d31d94'::uuid,'EG','EG.24','347794',100),
('13db60f9-7fd2-40ba-b670-a7960e1cd110'::uuid,'EG','EG.27','349401',100),
('3646b692-a8e0-4de5-be11-3297977dbfbf'::uuid,'EG','EG.23','350546',100),
('ca596ddc-e2e1-4933-b5fd-de5bd5dad52d'::uuid,'EG','EG.21','354500',100),
('392f2565-3033-4964-9744-20065cb73d61'::uuid,'EG','EG.26','355182',100),
('95a6b5a5-25ea-42c8-9e0b-a9253075d42c'::uuid,'EG','EG.20','358044',100),
('8c2eebba-1d3d-4644-a9ed-49e1016026c2'::uuid,'EG','EG.19','358617',100),
('bc6151da-d59b-4fe9-a679-5919e6f0a4cc'::uuid,'EG','EG.16','359787',100),
('c53dc34a-4765-4995-81e9-348aad55d7a4'::uuid,'EG','EG.15','359797',100),
('7ea1f738-2210-42a7-96f4-d0d8766dfcdd'::uuid,'EG','EG.14','360016',100),
('e5f6a710-232a-4ee8-a189-57d0263c3de8'::uuid,'EG','EG.13','360483',100),
('00bbb1ef-e1e2-4866-8167-9b6d7f4bcc84'::uuid,'EG','EG.12','360621',100),
('2db76966-c417-4c8c-a446-846830f44c39'::uuid,'EG','EG.11','360631',100),
('770a0a01-87c4-472c-898e-f997a830f746'::uuid,'EG','EG.10','360688',100),
('5d886f69-7d64-4b8d-8b89-aaae1cdc9b8c'::uuid,'EG','EG.09','360689',100),
('5345a21f-d6bb-472b-af6c-00988e386e8f'::uuid,'EG','EG.08','360997',100),
('4ac23eea-3ee0-49b6-a5ee-0d0817e856c1'::uuid,'EG','EG.07','361056',100),
('9af89472-8ea9-4987-a034-c02e7656c019'::uuid,'EG','EG.06','361059',100),
('04aa2188-57e0-480a-bcc2-f86e1300714c'::uuid,'EG','EG.05','361294',100),
('49f27ca5-ca5b-433e-a668-f1696acbb671'::uuid,'EG','EG.04','361323',100),
('bc9cbb73-e75e-452b-907a-1299566ffd04'::uuid,'EG','EG.03','361370',100),
('74905726-49aa-4c95-9e6f-24ad2d681295'::uuid,'EG','EG.02','361468',100),
('887fb86c-6759-4a65-b142-2f73d7e7dd41'::uuid,'EG','EG.01','361849',100),
('853d0b6f-afae-4c73-b040-ec44e17b5e8c'::uuid,'EG','EG.28','7603259',100),
('b4296a5e-046f-43d2-9fdd-18c03dc2a1c1'::uuid,'IQ','IQ.02','89341',100),
('1aba48cf-a4d4-4694-8b70-63c904f8b822'::uuid,'IQ','IQ.16','89693',100),
('1e7ab091-9f0d-4afc-bb83-0e89cffd7982'::uuid,'IQ','IQ.15','92877',100),
('bdbb3fc4-f4df-4fcf-8add-95e960c52917'::uuid,'IQ','IQ.14','93540',100),
('601f1a89-4cab-4260-841c-344d63002c41'::uuid,'IQ','IQ.12','94823',100),
('99818f2d-33d2-45b2-9447-665f48ecb16a'::uuid,'IQ','IQ.11','95445',100),
('c290a763-77d7-4d01-b9ac-04e230ccdbbe'::uuid,'IQ','IQ.10','96965',100),
('cac6683e-f0ca-4d54-868e-6db6cef993fe'::uuid,'IQ','IQ.09','97019',100),
('12f61fd4-73f0-4b87-ba3c-8fab02ceba3e'::uuid,'IQ','IQ.08','97270',100),
('616e0381-3606-403a-b55a-e0d3ea688c11'::uuid,'IQ','IQ.07','98180',100),
('89000a54-0739-4777-a8ae-5f1b1344291a'::uuid,'IQ','IQ.06','98227',100),
('b8a48ee4-c0e2-4249-a41c-e7c77324011c'::uuid,'IQ','IQ.13','98410',100),
('3fb1dcb3-16ae-497b-918f-2bfcba7be100'::uuid,'IQ','IQ.05','98465',100),
('3bcbaa6e-042a-42e6-bbf5-767e3a5d94c6'::uuid,'IQ','IQ.03','99032',100),
('4f342e9e-f470-4bad-9f38-39119e995ec7'::uuid,'IQ','IQ.01','99592',100),
('202e0988-ba4c-42e5-9d30-3be74287d783'::uuid,'JO','JO.19','248380',100),
('41676795-221c-4e72-bcae-d68b517a3def'::uuid,'JO','JO.18','248944',100),
('8822431e-7270-44d9-ba06-a849d47b5921'::uuid,'JO','JO.17','250092',100),
('263e4383-ecaa-4ff5-9388-b8cc2af66ee3'::uuid,'JO','JO.16','250439',100),
('4d5d684a-b270-4136-af42-d727d46c6c80'::uuid,'JO','JO.15','250583',100),
('5b6b7104-8e6d-4a6a-a270-f74a9ab07e08'::uuid,'JO','JO.09','250625',100),
('125cd351-d815-4a43-8584-2b4534b7a80c'::uuid,'JO','JO.02','250751',100),
('95d43986-93ff-4ad8-90ac-d4319898b722'::uuid,'JO','JO.20','443120',100),
('4171f33b-fab6-430d-ac82-f98bbd26ae62'::uuid,'JO','JO.22','443121',100),
('1c73ba68-e7cc-48f5-ae1e-08d75705872b'::uuid,'JO','JO.21','443122',100),
('f0e66051-2559-42af-8412-61a95cc499d4'::uuid,'JO','JO.23','443123',100),
('4b689b71-d359-4432-b611-23db1b854bcd'::uuid,'KM','KM.03','921780',100),
('89b1bdae-fd62-43d4-8a6e-1d16e79d28fe'::uuid,'KM','KM.02','921882',100),
('983d84a5-041d-494b-bbe9-c02306db2156'::uuid,'KM','KM.01','922001',100),
('1cab5832-7044-4f23-963b-bcce4ef3ff16'::uuid,'KW','KW.08','285628',100),
('8949df88-4a62-4e9d-bf32-8b5c8baaa5df'::uuid,'LB','LB.05','273607',100),
('63deb247-fda0-4e9b-ab5c-e353b7a451ae'::uuid,'LB','LB.04','276780',100),
('dd33351f-628c-46f8-88fd-208e7098dd2e'::uuid,'LB','LB.06','279894',100),
('e55680b9-7c90-4796-bf74-eae70ac9dd03'::uuid,'LB','LB.08','280282',100),
('ced7e17f-2f09-4bb7-8306-c1c005672e8f'::uuid,'LB','LB.07','444191',100),
('5e12b7c1-828a-42ed-882b-b3feefe76927'::uuid,'LB','LB.10','6201370',100),
('dbf7b255-92d9-4cdf-a9ad-4a48fa5bbea8'::uuid,'LB','LB.11','6201371',100),
('e102e8e5-4028-427f-80ac-4b1436e6c283'::uuid,'LY','LY.63','443289',100),
('311ae42e-6833-44fc-9ee8-8f79e832a134'::uuid,'LY','LY.77','2210245',100),
('422a8d76-b864-4da1-998e-ff008bad78d0'::uuid,'LY','LY.75','2212774',100),
('360a2098-3bcc-4d05-9e47-bf48bcaf4728'::uuid,'LY','LY.73','2214602',100),
('da052acd-d0f0-4cb6-8992-e414b78b9868'::uuid,'LY','LY.71','2217350',100),
('e6542ad1-d3ca-48ef-9e86-617be2f2b63c'::uuid,'MA','MA.01','11281874',100),
('38283d13-f60c-4a98-b2e6-77ae1a3b19bd'::uuid,'MA','MA.02','11281875',100),
('c743a869-3d12-4e94-8759-40aceb7b560d'::uuid,'MA','MA.03','11281876',100),
('c4f133af-aac3-4bd6-9fcd-a4c18b966f8f'::uuid,'MA','MA.04','11281877',100),
('7ee9612f-c426-483e-8ae5-c0c0fdfd2b3d'::uuid,'MA','MA.05','11281878',100),
('b07bca68-cd57-497e-9944-d8635d51e27e'::uuid,'MA','MA.06','11281879',100),
('037934e5-ef83-44b5-9150-4a65d8e156fb'::uuid,'MA','MA.08','11281881',100),
('f387ae81-3fc5-42c7-b5f5-38c5e0404067'::uuid,'MA','MA.09','11281882',100),
('e579bfde-44cd-4191-9b48-957f3312b656'::uuid,'MA','MA.10','11281884',100),
('63e46028-ed2f-4fe0-8043-81f0e8335489'::uuid,'MA','MA.11','11281885',100),
('ad2b80b4-8625-40b3-965b-3a4a8aa6771b'::uuid,'MA','MA.12','11281886',100),
('e95b1084-ef93-46d6-b41c-d7835d08828d'::uuid,'MR','MR.06','2375742',100),
('87b66841-e787-466f-acb1-397c44977779'::uuid,'MR','MR.09','2376551',100),
('3f2583e0-984c-4956-ac39-2d9f862f5c10'::uuid,'MR','MR.12','2378903',100),
('e9f5da71-632c-4bf7-a97f-05e5017c6579'::uuid,'MR','MR.02','2379024',100),
('660a3396-a5ff-4916-bde9-347c00a9f17b'::uuid,'MR','MR.10','2379216',100),
('eaabb15e-678e-4742-baf6-b1cae3c3f08e'::uuid,'MR','MR.04','2379384',100),
('56811bbf-9fc6-4b8c-be78-77a45ee89306'::uuid,'MR','MR.08','2380426',100),
('199f241d-b59e-436b-ba31-8b17cd6db6e2'::uuid,'MR','MR.05','2380635',100),
('cba0e86f-1b8a-4171-88f6-d89deb85ac69'::uuid,'MR','MR.03','2381344',100),
('fd3a35ac-e8fb-48aa-9e07-437d1194c0bc'::uuid,'MR','MR.07','2381972',100),
('32eff638-ee54-4f85-ab18-273eaac9f9d6'::uuid,'OM','OM.01','411735',100),
('ac316bb5-25a5-4ac8-9e3c-39777c084184'::uuid,'OM','OM.02','411736',100),
('5f97e1d4-1e37-4d69-b0a4-f6a4a8cfa315'::uuid,'OM','OM.09','411739',100),
('9d2f2676-9825-412a-a338-1dc4438df11c'::uuid,'OM','OM.06','411740',100),
('8b8b593b-1b9e-410c-a4b3-19565568d380'::uuid,'OM','OM.07','411741',100),
('a877465f-7359-4ba6-a15f-17b10cfa5e2d'::uuid,'OM','OM.08','411742',100),
('ed39b4e2-28a4-4be5-9423-f91e00d7965b'::uuid,'OM','OM.10','7110710',100),
('e3d5d16f-e8d5-493d-9013-fe7f10824d3c'::uuid,'OM','OM.11','8394434',100),
('9d772bf7-4ed3-4e03-a0c0-2c19730f7440'::uuid,'QA','QA.09','389467',100),
('66f9f185-7f92-43f6-aae6-fcbe7c3c2e69'::uuid,'QA','QA.10','389472',100),
('61035639-141b-4339-bd27-69be576de55f'::uuid,'QA','QA.13','8030540',100),
('2f12f69a-c432-4de6-a76b-152bff7e8b64'::uuid,'QA','QA.14','11777514',100),
('5b789920-4fde-442f-8f24-329365effa8f'::uuid,'SA','SA.19','101627',100),
('ef01d39a-7a5b-4adf-8478-312db0216851'::uuid,'SA','SA.16','103628',100),
('d3535d8f-88db-4e69-8f66-4a8a3b23804e'::uuid,'SA','SA.17','105298',100),
('5f6ea7de-80ec-42d1-8ce6-388b448d7e51'::uuid,'SA','SA.13','106280',100),
('701d1d0e-c046-4153-bcb4-5ea425da2f50'::uuid,'SA','SA.11','108179',100),
('ca83aad4-ff95-440f-a373-30386d2cce98'::uuid,'SA','SA.06','108241',100),
('16b750f0-9e8d-443f-96d8-29d8d19cea5f'::uuid,'SA','SA.10','108411',100),
('8de9e074-087d-44ba-8a54-96ee02e7707a'::uuid,'SA','SA.20','109470',100),
('3198500a-b294-4b52-a6c1-777036dce963'::uuid,'SA','SA.15','109579',100),
('50dc6972-a7e6-4c39-a966-740a7d4cef15'::uuid,'SD','SD.43','378389',100),
('32556b7f-595a-4057-b5f2-96c9b0616d61'::uuid,'SD','SD.29','379253',100),
('fd723770-de46-4f53-8bb2-7ea839a09c8d'::uuid,'SD','SD.36','408646',100),
('6b656e2e-6b99-4cb3-9dfa-9dc60faebe7c'::uuid,'SD','SD.39','408649',100),
('e843f375-f7d5-4e97-a4bf-749f99fcf9b8'::uuid,'SD','SD.41','408653',100),
('cc70426c-2875-4cad-904f-d13b0dbb1d06'::uuid,'SD','SD.42','408654',100),
('63c330fb-db88-4118-bcda-4ae5121ad1ea'::uuid,'SD','SD.62','408659',100),
('43daacce-3db0-4445-adff-73efe343db07'::uuid,'SD','SD.52','408663',100),
('0c168fe4-61f5-436a-9dbd-dd0117d815bc'::uuid,'SD','SD.53','408664',100),
('490dc231-dcad-4f67-8453-25be67404860'::uuid,'SD','SD.56','408667',100),
('268be7b5-feb2-4a9f-9f81-98e7893bb82e'::uuid,'SD','SD.58','408669',100),
('304cafdb-c022-47f9-86b9-eea522d504c1'::uuid,'SD','SD.61','8394436',100),
('926cc68d-4870-4516-aff3-74c4273e27db'::uuid,'SO','SO.19','51230',100),
('9346b72e-7a7d-48fc-9606-760201c94e8a'::uuid,'SO','SO.12','52187',100),
('196088fd-d65c-432a-8bd6-a662bd8493c2'::uuid,'SO','SO.10','53707',100),
('3aff5145-037f-4324-80a4-b6553a337bb1'::uuid,'SO','SO.06','58802',100),
('c6af5951-4b4f-4cda-ae6a-74b867b0b219'::uuid,'SO','SO.02','64833',100),
('bc152861-049b-4004-96e4-d64a962d32fe'::uuid,'SO','SO.22','6268947',100),
('07145664-a8ef-44bc-a4f6-0152660763da'::uuid,'SY','SY.14','163342',100),
('e541f2a9-93c1-4764-ac4b-dba5de642a92'::uuid,'SY','SY.13','167541',100),
('1b8f0f2a-b9ad-44bd-b9d6-d4cc8e9fc1e4'::uuid,'SY','SY.12','169387',100),
('3050292f-92fa-4c5e-8bb5-f7f5bcea9840'::uuid,'SY','SY.11','169575',100),
('1790c8cc-5a06-4031-a411-dcc4ab0d8010'::uuid,'SY','SY.10','170015',100),
('f50b2466-314a-4a90-a891-5745a1c94995'::uuid,'SY','SY.09','170062',100),
('7cef89a0-aca5-4e8c-bee4-ecdfae3f47cb'::uuid,'SY','SY.08','170652',100),
('a3095d20-71c3-47d3-8890-17e6eb806a06'::uuid,'SY','SY.07','170792',100),
('7fea34ef-b080-46bc-a6f0-914b56f9365b'::uuid,'SY','SY.06','170903',100),
('4d94e5d9-b0a0-49b8-8c28-7d9c805be7a8'::uuid,'SY','SY.04','172957',100),
('f8f52bf6-e488-4450-a321-5dc91a76e393'::uuid,'SY','SY.03','173336',100),
('b3689014-4208-41b5-b778-834fea993220'::uuid,'SY','SY.02','173578',100),
('68a9dcaa-04bb-4c25-841b-7b12b06c312f'::uuid,'SY','SY.01','173813',100),
('0a8c5de4-7169-4a2a-bf85-a44bc5b883c2'::uuid,'TN','TN.37','2464038',100),
('e19deca3-906e-449c-b54a-89ddbb65a0c1'::uuid,'TN','TN.36','2464464',100),
('961675ef-e448-4836-afc6-77d84b90fa7c'::uuid,'TN','TN.35','2464645',100),
('7708bf3f-b3f4-4cc9-a5ff-b01a67329535'::uuid,'TN','TN.34','2464698',100),
('13fd7e41-bc3f-497b-8d03-932c33b0d1ba'::uuid,'TN','TN.23','2464912',100),
('e1e7ce15-9574-4d8d-b2b6-85edf4580cdf'::uuid,'TN','TN.22','2465027',100),
('357b02e2-8752-455f-8366-d86b3e5bbafd'::uuid,'TN','TN.33','2465837',100),
('e3476375-1210-40b1-9dab-6e2c2f53ce6c'::uuid,'TN','TN.32','2467450',100),
('d79a02c4-9700-4a91-b7f0-96ab47faf1c9'::uuid,'TN','TN.31','2468014',100),
('713a045d-855a-4337-bc2f-c7ff61e102cd'::uuid,'TN','TN.30','2468351',100),
('a061b792-b68a-4a55-905c-2f06bbe7de49'::uuid,'TN','TN.19','2468576',100),
('922d1609-f344-4305-9112-6592b5cf0df5'::uuid,'TN','TN.28','2469470',100),
('58d1b153-1e22-4e1c-924f-36791c3c1d58'::uuid,'TN','TN.06','2470085',100),
('9027b908-bad8-487d-9d3f-0d49df081c70'::uuid,'TN','TN.27','2472477',100),
('936a80ee-36f3-40cc-ac74-f76c7c92d949'::uuid,'TN','TN.18','2472699',100),
('274e5c1e-50b8-4dfe-88df-48f80bf5b604'::uuid,'TN','TN.17','2472770',100),
('24ef5c2c-82fe-445c-a3cb-564d6429e81d'::uuid,'TN','TN.38','2473245',100),
('6a887f53-a5f5-4968-9213-6e0da1e56e79'::uuid,'TN','TN.03','2473451',100),
('96b057ba-d914-48ba-90b1-9617bd89d6fc'::uuid,'TN','TN.16','2473495',100),
('0149031c-100b-4155-b507-6840f9527a35'::uuid,'TN','TN.15','2473574',100),
('781bbe4a-0a48-40b2-bf33-7015b9d3ab9b'::uuid,'TN','TN.39','6201192',100),
('5859d3d7-f6d6-4c71-b590-2153a2d79a03'::uuid,'YE','YE.05','70935',100),
('56c176a4-e0c4-4239-bf9e-1f0745580629'::uuid,'YE','YE.16','71132',100),
('e4c7aa7f-2ece-4957-8e5d-c28975cf21f3'::uuid,'YE','YE.27','71532',100),
('e09baeb1-f2c3-487e-b67d-964f6ef958b4'::uuid,'YE','YE.14','72966',100),
('4c277629-483b-48fb-8f5e-dfa99af68c1e'::uuid,'YE','YE.10','73200',100),
('c1886b7f-f039-4336-8bc7-6937a011dd53'::uuid,'YE','YE.21','74222',100),
('22e7b9dd-bde0-4934-8dd4-67a669cb0b26'::uuid,'YE','YE.11','76183',100),
('a52ef264-ddfc-45ab-9c16-94b7bf446529'::uuid,'YE','YE.03','78985',100),
('3ef9226a-a365-4a14-80a2-2f0cf7d8474c'::uuid,'YE','YE.20','79838',100),
('70a33011-2059-4efc-bd93-cecac186ca7d'::uuid,'YE','YE.02','80412',100),
('aec6740c-a23f-4336-89b0-22fb3ba8ea35'::uuid,'YE','YE.01','80425',100),
('2c6144bb-135e-452d-ba25-a969c0aef670'::uuid,'YE','YE.22','6201195',100),
('5c36cd6d-6ffd-49b5-9d3d-a9074ef16352'::uuid,'YE','YE.23','6201196',100),
('361d7b7d-8444-4aee-895d-fbeac95f6a7b'::uuid,'YE','YE.24','6201197',100);

-- Preflight: must return 232 / 232 / 0 / 0.
select
  count(*) as candidate_rows,
  count(*) filter (where a.id is not null) as valid_admin_areas,
  count(*) filter (
    where exists (
      select 1 from public.geo_admin_area_source_links l
      where l.source_code='geonames'
        and l.country_code=c.country_code
        and l.admin_level=1
        and l.source_admin_code=c.source_admin_code
    )
  ) as admin_code_collisions,
  count(*) filter (
    where exists (
      select 1 from public.geo_admin_area_source_links l
      where l.source_code='geonames'
        and l.source_id=c.source_id
    )
  ) as source_id_collisions
from _adm1_geonames_candidate c
left join public.geo_admin_areas a
  on a.id=c.admin_area_id
 and a.country_code=c.country_code
 and a.admin_level=1;

-- Staging-only write. The transaction is rolled back at the end of this file.
insert into public.geo_admin_area_source_links (
  id,
  admin_area_id,
  source_code,
  country_code,
  admin_level,
  source_admin_code,
  source_id,
  confidence,
  metadata
)
select
  nextval('public.geo_admin_area_source_links_id_seq'),
  c.admin_area_id,
  'geonames',
  c.country_code,
  1,
  c.source_admin_code,
  c.source_id,
  c.confidence,
  jsonb_build_object(
    'match_basis','unique_normalized_name',
    'import_package','adm1-staging-import-2026-10-20'
  )
from _adm1_geonames_candidate c
where not exists (
  select 1
  from public.geo_admin_area_source_links l
  where (l.source_code='geonames'
     and l.country_code=c.country_code
     and l.admin_level=1
     and l.source_admin_code=c.source_admin_code)
     or (l.source_code='geonames' and l.source_id=c.source_id)
);

-- Post-insert staging verification inside the transaction.
select count(*) as staged_geonames_links
from public.geo_admin_area_source_links
where source_code='geonames'
  and source_id in (select source_id from _adm1_geonames_candidate);

-- Safety default: no persistent changes.
rollback;
