#!/usr/bin/env node
// =============================================================================
// Bulk Re-Kategorisierung - 308 Docs via classify-backtest v2.0 (apply=true)
// 2026-02-10
// =============================================================================

const SUPABASE_URL = "https://rsmjgdujlpnydbsfuiek.supabase.co";
const INTERNAL_API_KEY = "wNzMEZJRoUBnyb8JxiMUwEi7rDlxcUMTzAlYkkW2SE040w98gna3x1MmrPpC3qeX";
const BATCH_SIZE = 20;
const DELAY_MS = 3000; // 3s between batches

const ALL_IDS = [
  "456b1b2c-b93f-4e7b-b84c-0879edf9146e","bb84d5e0-5039-4a32-828a-948b4e2a2fd0","828e0d7b-ac02-485f-a6e1-c7aa5106653c","ea52830e-bf30-4c11-bd0e-6280ecc7e358","2ef16d34-96e9-40b5-86eb-3b0b2373c8af","025347ad-8daa-4417-9609-808fae3e86c0","fb8d3556-bf46-4350-af01-75c9660716e3","008f4152-c00f-4d99-a7f7-083057ba3743","0b757f98-69b5-4fef-a75a-7cdeacf37b4f","822a74bb-7519-4e7a-bf77-7d262828b3fc",
  "127ea160-537e-4b25-b853-af87c45e204b","18ee8ba1-afbc-4250-9ae9-1d2f06533e0f","9c7b7340-28c0-4a29-b4b5-d1146c4decbc","b7b3cb54-1dbc-4218-a331-bf82be8c1499","0eae43ef-7f3e-4801-8b43-ae4e68e208af","c263fc42-50c0-4307-bafb-99bbe8d64a35","7d0686fd-6c64-4d44-b164-52f5ab2e828a","ccd3608e-eb95-4df0-89f3-50bf2c28eac4","6499f3d7-ea72-45a2-91a1-8e8197c0f0c8","a8ddd7ff-1b7e-49ea-bd8c-2f16e7b7e8dd",
  "b639122c-9ebb-4ed6-9425-9b6ba7bebf4d","91ff72f0-6923-42d1-8f4f-49b76125d854","4ff3d121-bc98-41c8-b454-c904e292aad5","9ec5e670-bdd6-4fba-95cd-3d9be72395c6","9ee7cdef-73e1-453f-a443-68362712778f","a5665d9d-8070-4de4-86d7-c41df28e8452","fc922d09-06e0-47e9-abb7-d25407e9a87b","123c00d0-0c2e-40be-bb93-b25ef4bccea8","6281e6db-6434-49cd-80e4-7379748370b2","154f4043-b613-44fc-b42b-cf3e3e02cc18",
  "2d32c770-b22f-48cf-a5e7-ea34f82483fc","1481f1e9-698b-4425-96a2-1f9d20efb858","5b620d2f-c50f-466b-b634-21a7f68043f0","fcb89b4e-6677-4b48-a4ca-61e64148ebb1","a3d0d07f-4e73-4ca9-8cf2-8c92fe6d530d","e425ed8f-6700-45aa-aa6c-4925e8616ced","75973d49-a400-48bc-a34e-23470712933d","55397a1d-f923-4781-9726-26d8ad773f9d","014958e2-6298-4078-9d4c-fa278adb25e6","0de30ed2-fb4b-4e45-ac4d-8fd23952bd99",
  "0e50af86-6dd4-4f58-b0e5-3aa78c92be80","91dcdc3d-147d-478a-80ab-10d057ea5304","e1294b5c-30f4-4cf7-bd7f-ef0a35fe26a1","1fd0b607-d90c-4b62-84d2-01a4d980eda2","fdec98e5-93a0-48b0-90dd-671e44426e88","7b58e364-6ee6-4607-bf34-6e25e1c8c922","f890e390-91da-4a7b-b0f9-296d69f45816","0e341290-0fd0-411f-aa10-095aa0196aa5","553672f3-89d0-45a4-9d39-493d84cf8626","11edd9e0-ec18-4cd1-b298-d51334a71286",
  "6d426f6e-df1e-4df5-8c74-3185e90fcfa1","46d17ff7-4c1e-42e2-b114-bcd38264d32c","ebd4588f-5f22-4771-a4c4-9d1b9a7a5dd7","f9d06851-c988-423a-8123-d43d3b30a25b","efa4a2ea-f98f-4e68-ab23-6a98c580aa44","e704e89b-b89a-45f9-9488-39b93d1046fa","62a27e73-b982-4b1b-89c0-6db14f4c6709","ba9c3c17-a941-4dab-8673-29c27494184f","2a34fa85-529e-4fe7-82b9-0e3360aa5590","93b2fed9-6b0f-4020-ae79-3ac10324c4cd",
  "78f70912-8313-46e0-82c2-09991ae8db02","08202ea0-c830-4677-9aff-2845954df9fd","16e30706-e37d-43b3-8893-c0983ae45222","748060d6-888d-4421-8a17-72160afaee9b","88c07ebd-ed77-4ef3-b8dc-607a65cbec2a","eca4684c-06b7-4ba4-ba29-aa14b26d5d97","bef2d448-3fc4-4b9e-8ee7-b4c11c5bbf91","11ba53ea-a717-474e-ac0e-e9a5694e2f6d","50d3d614-89a9-4376-8a9b-e5c37c1e653d","2385733f-3aec-400c-8274-a44adc530996",
  "9dc62441-c151-4dd0-aced-7a5144d85efa","a8a38dac-ff5f-468f-8e19-0867b4095ea1","4e214d08-8965-467a-b129-d6afe4953a02","814559d6-2804-4d95-a505-51b8df690d1c","9fb35c41-1b24-4e86-a56b-e871887358b7","c4bc68ae-9870-41e0-b32d-ed049505be84","c6434141-f70d-48fd-9c2b-0cef1175ea9a","c52dfe81-9b10-4e3e-b3eb-0f892e902ff5","98f29397-f93c-45ac-bc91-d676aa449d6b","a64f1f79-b8a1-4e21-a5a7-acfe9341ef07",
  "b363a6ae-a17b-468b-9237-796e767d0e8d","bef00b48-eaa4-4b4b-a2f0-f53757a5e2e5","f605dd72-7500-448f-98f4-a00d2d99b89a","c1e01278-9179-44e2-987b-a24fc15f92cb","f9557ff5-041a-4562-a4b2-f7b5759ddc07","85a287e1-2842-48ba-81b8-0ff10616ae5e","76548274-e206-4b0e-bd38-52fc0f13033f","cb8b7a7b-9335-4c4a-8bee-857709673890","20754443-746b-431f-b1c8-c27bc80afbdf","0e3a81ae-c89b-4b33-a9d9-fed63cb43de4",
  "955ca0f6-f26e-4a72-8d5f-6682324a2fd3","bc5e995d-c11c-4178-8876-55d602b3fff2","b00557a0-2a8a-4ffc-bca8-e48e762ebb57","eae03844-e2af-47ae-8426-f26b4e6e1447","8e90034a-5960-4b9d-a005-18ab5e7c3c2f","93146e0e-63e2-4858-9b6f-7b3a3526c9da","44160f6f-ddf8-403d-9bd0-d529a3063c6e","d9a63076-9cc3-409c-ae09-dca0d77206f7","8011e8bb-d459-4f01-b9ad-6d6eee3319f5","6ff9ab28-84ec-46e5-93d7-f49bbf7f5872",
  "b3f7fb6a-e2ea-4da2-b835-65e2d249703b","5408eeb4-022b-4a5e-ab52-d5be08c07492","f9fb25f0-8586-43bb-9a0b-b3a1ef6acdb5","88357c8b-3dc7-41b0-92b6-e39f76aa439e","a8531c6c-ba65-4bc9-afba-81bc651129d1","35448475-bbfe-4995-99cc-418c48eddcde","ff54f453-85ec-45a9-ae0a-76def2d4f7cc","79938e57-91a9-4f99-9b90-a2705b18d50a","f48752d0-c973-4492-a990-4f0aaee70b38","c1c8e157-a237-465d-9e5a-ad365f52273b",
  "0aba18be-2790-46c5-9ab4-22dcb979d551","4d5e49f4-d106-4eb3-b773-277ff28c397e","101803fc-7374-43dd-8ca2-adb4e79f1d06","880a79c2-ae0e-4317-b810-d96735df9190","e289d714-c2f6-4ebe-9fa1-08637a5b5789","5da760f1-d689-4185-9594-e7024cc0d00c","9476a386-3cd4-4dbe-a210-3512ccdf5e87","ff20b66a-faeb-4671-a6bb-5c1c74077807","bc78af23-59c9-4da5-828a-918249ae4b49","43ce32df-9e87-4c21-bdab-899f530c0a5c",
  "c690c53b-8d8d-4987-ad72-788a103639ef","2cae7f3e-4525-453b-b21b-dfd15c970686","e1126846-530f-46d2-8beb-56618f51fb45","d2775a52-ff73-4b4c-8c7b-8157d3380900","4508e974-bccf-4248-9fff-fbc4ace6af5e","32cf998f-1f70-422a-a7f3-dc2128f4ea8a","77e09284-92b6-416e-b983-39c0c885f49e","da62e728-4284-4446-b347-e72aa31c8989","4567e35d-7590-4d18-abd4-0f76fca0b4b0","f4f5539a-c640-4893-b219-e7c97fe4fddd",
  "30d3a1e6-4c22-49d2-b33e-e609cf30dbcc","dd0386ef-7882-456e-b6b6-ebcca210ae50","745e66cf-e6ad-43d7-b919-866a561dc387","f07db92f-66c7-43b7-9b76-7c0151e4759a","9efae1f1-3606-4e17-83e9-2a4efffda4cb","80d5c7ff-35e8-4597-a534-325a5f87b0aa","912ca6aa-d6bb-4692-832d-d3b071580019","9321ebb5-349f-419d-ac43-21f635705c53","305480b3-f1ae-4a2f-b98d-98ee50554c75","4239f137-8bf4-4462-9263-1a2eb8bc56f2",
  "9c254651-bb83-4680-bdb1-599cd1bf2b30","26e86f42-2e46-48db-931a-8bc791b36ed4","62943708-e954-4c92-b416-bbbdc0aa3284","d5267167-560a-4fff-9682-04824a513285","36754951-a4bc-4bde-96d3-cd44212514da","f59fc2d5-7fc3-4e54-b718-81c04ddc1365","69694e43-c610-4eaf-9f7c-add72a013fa2","15932bfb-938f-45e3-a75d-4a5ea6f3b1d7","3787d430-2075-44f6-ac18-229312b95bb8","e4fcce7e-5cbb-4ae3-ae0d-0506475ce413",
  "15e64a7e-667e-4332-b2d6-2b2074df9258","e81fbb32-1a8f-44e5-8046-3718db115ec6","929fe9cc-b94f-4ce8-a9ba-81f0a33b4c21","f6321b3a-6dfb-4f47-8813-58dbbedd262c","8bc44f29-7de9-4396-a2a0-9543e22d8c52","94c065fc-cca2-4140-a60c-11de7084fbc6","389f452c-a2f9-4c3d-a5e1-6bb80159587d","4e270ee3-2d9b-4a33-96e2-7dd5b1629037","73588d88-cdd9-4b08-a49c-e0f03e2f1a9b","b5799137-dcdc-4cc6-8ac8-9ff4c89c376b",
  "705ea69f-3b18-4650-96c7-98f70ea737eb","8b25425a-4b8a-4f50-96b5-a73297027f66","c979d447-20bd-4118-9d3c-4e3cb3e709ba","b12cf27e-f858-4dc8-b17e-62d61198fd3a","3a896af5-53ef-484d-95b2-d57c7396f89a","a332bc30-80c2-4d80-94eb-3fb84cc7c0a5","77d0bb6e-92b9-4fd4-a750-538a250f00c6","d8f58d09-5562-45bd-874c-0c0e55b028ca","707d4e22-8ba8-418a-8218-bf0f0861aa48","3278b5bc-9caa-4207-ae4d-820518fc6f96",
  "6d6a6b68-5aeb-434f-8853-c9c82477498f","99e086f6-da94-4aac-9000-8105448c1a9f","8cf494ad-93e6-40a4-aee4-9b6c461e959d","c2a873b4-de9f-4ad7-abaa-0b1bc76c0db2","c03ed345-958d-4cdf-a376-5e3ac45d0e30","7585ede8-5804-4335-a8a3-fb49bdd7062f","3a339751-1db6-4e32-9ead-7f5698f5ef16","7bbe92ec-ffe3-4d82-809b-1a6d6cc339d0","d13ae3f8-829a-4572-bf2c-329c0abea801","e6acff07-5fec-4d76-a952-b3100ffe4190",
  "93ab7fbe-991a-4768-a731-504fc4096f3d","6228229d-8355-4c37-939e-2038c53eaf7d","ceee8aa4-aa2b-4edf-8ffe-1255dc4f4353","8021beb1-f7f6-4743-9fb5-bb1e349756ee","41d272a7-06ef-4e36-b8ed-468cf72e8793","8f118ba7-7acb-4afd-a7ee-ae3d449ba2fb","39f18fab-064f-43cd-b5c2-23bef713381d","68f3fbb0-c08d-42ee-88d1-05688bcea827","135a7b66-49ea-4917-96c1-d949e74b3c08","5ad33edd-8d0d-48bd-8ae6-01a347018880",
  "5c1fea94-caee-4470-a001-6e0acbd88caf","8cfa09fa-8631-407e-b1be-e2686983bcc6","a7cb9840-4b47-4b76-8adc-7e28a799aef5","cfe459df-b1b2-4713-862c-20880618855b","019c661f-4963-48bb-a775-abaf68aa3b4b","ca9713fa-67e9-42ac-bf4d-5fc9d8a30c77","157b9e35-d1dc-45c6-bad2-5f2cf2778b9b","f7e2a694-271f-4f55-a1f8-f71e9a890956","bf12e90b-9482-4634-ae76-799ea13b59e9","df003633-88d1-4f4a-b438-19dc43ce417f",
  "d5511141-94c2-4cd7-869d-9499d76739de","38d5dfb0-1a0e-438d-9931-840305d89d98","7610c022-6440-4c7a-9e2a-4f7f5f20f4b3","32ed348c-649a-464e-a423-68ab2217a612","973339f2-8b8e-4753-8a02-7604e42b340c","ca0dcbe8-1d64-4e09-bf43-c8fe373d8b1b","1dc6f032-5896-4e4e-a646-31abf907c067","9ce4a462-90ad-4718-96de-bc5a9f3221ba","4fbae4f9-8545-4d38-9f3e-181d6e0b018b","1eb02fc6-45c3-4bb0-86da-b21db853a7c2",
  "e8312f59-4e50-44e2-8d56-65f7fbdf8391","4f110b20-dee5-480e-9c55-0f53adabc0e7","ac47e842-5bba-461a-9fb1-2cbf1654c993","024a8ad9-31ea-4c4c-9eb5-105efc54403f","78a383c2-c16d-420e-964d-253e8e00349d","af09b893-5780-42a0-b83d-52fc1c075818","0526f452-1987-4655-a2fe-a6fc45b66ee1","6a20a3e7-14ab-4998-891f-3d45df3a7d0d","6dbe2dba-e6be-488c-9aa4-314fa1ace128","8c1d06eb-faa1-4e39-8288-fa09bc676a11",
  "b8465d85-eb1e-41e2-a2af-679bffece370","6c924506-31c1-4039-a6f3-6d607349b48f","c2538174-8282-4083-a995-deda3548e79f","cd2496a6-ef39-4379-bde5-f683cc8b0b2d","942cbfea-acda-40f9-97af-375e62a0883c","ce11a9de-7eaf-439b-a4fa-99ee95e7f12b","0ed96340-b2d6-42db-a56e-316be1701a63","75b30ba4-72f9-4acb-9e1a-5a10b82aa4e2","707eed38-1201-45a2-b60b-f3e4eb9e56bb","6b7d5a10-5c0f-43f4-a8b1-b928dfc4c679",
  "54b00de1-0891-4a27-9fb1-c205f8c965b6","acfd464a-7e37-49ab-9e5a-64527b92ee2f","050b34b6-5619-45a4-9366-953d5654ec20","5de297a5-63de-4299-b47d-47a531a567a4","fd51f701-e907-4cc1-aaf7-04801dcc355d","fcf9c887-5009-4b66-b082-1d8971650d78","63221434-e648-48ff-b4eb-0ae623109bed","ee58aca2-51de-4604-a574-97bb252b4ae4","da982de0-1b02-44ec-9944-20306aa00749","6eec72ef-71d0-4b7b-b3f6-7b7b2ce5196a",
  "c10afbec-9788-48ee-a1de-64a5c094fc6a","89fdc7b7-d0a2-4398-a4df-64842b128a81","d6a4dda9-9b94-404d-8059-b259de9844ef","46340987-858b-4123-a9f1-90f6d159489c","3d450bf2-6d5d-41d3-8f84-d8d49fbd1dae","e772372f-2dea-4d08-9577-16daaf192102","32345b9d-fd47-41da-a51b-c1bf108c5488","66b17d2e-167f-4bdd-a3a4-a021ff6b4465","839ab632-8d31-4645-bc2d-f3e6db1a8df2","615dff01-d5a0-4e5a-8ecf-e1cfc56f5c42",
  "81800def-baff-4936-be08-c01237fc6b3e","e81587d2-7c12-40ea-b901-634dc88b7392","a437304a-37b5-474e-8ded-bddfd8145bee","4b7d1787-52d9-4f87-9c0e-a072755f8a2e","c458eed6-c47f-4ad5-bdae-62002352265e","5c7fcf15-f39d-4be9-9533-bf926f46b042","c3c5e1c8-88c7-46db-9f7c-5bef748b5f5b","b52bc1c0-9516-4a1c-a153-834bfb561294","05706ee2-5d61-4b5c-8fc6-730ad02480d2","953466a2-6297-4fe3-b40b-82ae5f5bc6e4",
  "18f78a47-8304-4822-a741-97ee2ebcfc78","fd9777a6-37e8-4a96-bb63-e54319c3fa8b","120a9f4c-78b6-48a3-ace9-7e3120ec3bb7","bafe034d-c7c3-431e-a45c-1762c544ccc8","ae8a4fa1-57dc-44fc-84b4-3cab6480ccfc","f2472842-21d4-48d8-a840-ecf83830537e","3fd2f831-ad91-4bb6-9489-888a6a9bca68","43cca128-5204-4eb8-a032-42ac5317ce35","2d5060b4-ac28-4e35-af74-a17c3b7df6b4","5d109317-6572-4cbe-8568-d075f9a0a4ba",
  "529df18d-160a-4bf7-b344-eb13081e569b","77d78be7-ca30-4ca0-9988-1db72e0dc263","caf75820-0f54-4a25-94b7-d7ebb7d0ca19","173be0e3-fbe6-4526-a1a8-281399d391a8","8590ab59-1bf4-4bcd-81d7-1b834c3cdb63","f80b445b-4c28-493b-9cd1-0a49d36dd6f9","30ff0c2e-06cb-489a-bca2-3e17236ef97a","c973f2e9-1830-4415-9243-4cb695429547","8f1538f4-7607-4d51-9a93-fa3876793c2f","85e82640-b7ed-47ac-9b26-2a3dccfedc3e",
  "d5585f60-cc9b-427e-806f-5d3ee86f6e7b","d5443426-07c3-4321-9698-e0961b5af6bb","1b4cd43f-b685-4b10-b0b0-7e6942552f5d","23e72784-f4cc-4628-91ee-4a4f7110c1b7","6bd4247e-4307-44dc-8ba1-c0fe1376baf3","5137a9f1-6a8d-4c75-8ea2-9848f8a27ed6","294fc4fe-702c-408f-bdeb-6df1c466d164","504d8295-5528-4093-a25f-8fcdeaff7c21","abce01f0-2774-4cec-bff1-f3763d0eacbb","2be28126-5bb4-44f2-b7bd-57d76759b583",
  "9d75158d-4b75-4a09-9870-839187587a59","a15d6c4f-620f-4ecb-88e2-cdf49ab59661","8cc5fb62-03a1-4cf2-8e3e-691277f33c5a","957b4873-0641-493c-b685-ec2dc9fdc300","82da5371-af29-4973-a187-6bd3ec300ef5","6b21c301-17d6-46b0-8457-71fc2e48af16","66d42e2e-e8ea-4dab-812b-ded18cbca1be","849ebd48-2a0a-4ae6-b09d-a7943a4980d3","27771880-209d-49f6-aaa8-4fb927f29bb4","68b53e78-d01c-4032-af70-9e50f6c5547f",
  "fea1dc49-209b-472a-a45b-15930b39cb03","da20f8e2-fc58-4d48-ba11-26ff51fbc7c9","81b373e0-b02b-4876-8d6a-be1e56d5dacd","c99ba716-1833-4ad8-8b88-0c8379b712e9","7041cc96-9ca1-4370-9612-bfa091891fcc","7057d62a-52be-4bab-9e62-ce909997979a","a2e6a5f3-9cb5-407d-bb4c-72245988ac49","19170933-a39a-48aa-bb52-1d74c8ccd3f9"
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runBatch(batchNum, ids) {
  const url = `${SUPABASE_URL}/functions/v1/classify-backtest`;
  const body = { doc_ids: ids, apply: true };

  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": INTERNAL_API_KEY,
      },
      body: JSON.stringify(body),
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Batch ${batchNum}] FEHLER ${res.status} nach ${elapsed}s: ${errText.substring(0, 200)}`);
      return { batch: batchNum, status: "error", httpStatus: res.status, elapsed };
    }

    const data = await res.json();
    const { summary, changes } = data;
    console.log(`[Batch ${batchNum}] OK (${elapsed}s) - ${summary.total} Docs, ${summary.changed} geaendert, ${summary.applied} applied`);

    if (changes && Object.keys(changes).length > 0) {
      for (const [change, count] of Object.entries(changes)) {
        console.log(`  ${change}: ${count}x`);
      }
    }

    return { batch: batchNum, status: "ok", summary, changes, elapsed };
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.error(`[Batch ${batchNum}] EXCEPTION nach ${elapsed}s: ${err.message}`);
    return { batch: batchNum, status: "exception", error: err.message, elapsed };
  }
}

async function main() {
  const totalDocs = ALL_IDS.length;
  const totalBatches = Math.ceil(totalDocs / BATCH_SIZE);

  console.log(`\n=== BULK RE-KATEGORISIERUNG ===`);
  console.log(`Docs: ${totalDocs}, Batches: ${totalBatches}, BatchSize: ${BATCH_SIZE}, Apply: TRUE`);
  console.log(`Start: ${new Date().toISOString()}\n`);

  const allResults = [];
  let totalChanged = 0;
  let totalApplied = 0;
  let totalProcessed = 0;
  let totalErrors = 0;
  const allChanges = {};

  for (let i = 0; i < totalBatches; i++) {
    const batchIds = ALL_IDS.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
    const result = await runBatch(i + 1, batchIds);
    allResults.push(result);

    if (result.status === "ok" && result.summary) {
      totalProcessed += result.summary.total;
      totalChanged += result.summary.changed;
      totalApplied += result.summary.applied;
      // Merge changes
      if (result.changes) {
        for (const [k, v] of Object.entries(result.changes)) {
          allChanges[k] = (allChanges[k] || 0) + v;
        }
      }
    } else {
      totalErrors++;
    }

    // Progress
    const pct = (((i + 1) / totalBatches) * 100).toFixed(0);
    console.log(`--- Progress: ${pct}% (${i + 1}/${totalBatches}) ---\n`);

    // Delay between batches (except last)
    if (i < totalBatches - 1) {
      await sleep(DELAY_MS);
    }
  }

  // Final summary
  console.log(`\n========================================`);
  console.log(`ERGEBNIS BULK RE-KATEGORISIERUNG`);
  console.log(`========================================`);
  console.log(`Processed: ${totalProcessed}/${totalDocs}`);
  console.log(`Changed:   ${totalChanged}`);
  console.log(`Applied:   ${totalApplied}`);
  console.log(`Errors:    ${totalErrors} Batches`);
  console.log(`\nAenderungen nach Typ:`);
  const sortedChanges = Object.entries(allChanges).sort((a, b) => b[1] - a[1]);
  for (const [change, count] of sortedChanges) {
    console.log(`  ${change}: ${count}x`);
  }
  console.log(`\nEnde: ${new Date().toISOString()}`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
