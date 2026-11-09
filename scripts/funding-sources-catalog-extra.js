/**
 * Additional licensed banks, development funds, crowdfunding and pan-Arab DFIs
 * sourced from central-bank registers and official agency lists (2025–2026).
 */
'use strict';

module.exports = {
  banks: [
    // SA — remaining SAMA digital + 24 foreign branches
    ['fs-sa-vision', 'بنك فيجن', 'Vision Bank', 'SA', 'https://www.visionbank.sa'],
    ['fs-sa-ez', 'آيزي بنك', 'EZ Bank', 'SA', 'https://www.ezbank.sa'],
    ['fs-sa-nbb', 'بنك البحرين الوطني — السعودية', 'National Bank of Bahrain — KSA', 'SA', 'https://www.nbbonline.com'],
    ['fs-sa-boc', 'بنك الصين — السعودية', 'Bank of China — KSA', 'SA', 'https://www.bankofchina.com'],
    ['fs-sa-icbc', 'البنك الصناعي والتجاري الصيني — السعودية', 'ICBC — KSA', 'SA', 'https://www.icbc.com.cn'],
    ['fs-sa-misr', 'بنك مصر — السعودية', 'Banque Misr — KSA', 'SA', 'https://www.banquemisr.com'],
    ['fs-sa-nbe-br', 'البنك الأهلي المصري — السعودية', 'National Bank of Egypt — KSA', 'SA', 'https://www.nbe.com.eg'],
    ['fs-sa-bnp', 'بي إن بي باريبا — السعودية', 'BNP Paribas — KSA', 'SA', 'https://www.bnpparibas.com'],
    ['fs-sa-db', 'دويتشه بنك — السعودية', 'Deutsche Bank — KSA', 'SA', 'https://www.db.com'],
    ['fs-sa-bsi', 'بنك شريعة إندونيسيا — السعودية', 'Bank Syariah Indonesia — KSA', 'SA', 'https://www.bankbsi.co.id'],
    ['fs-sa-nbi', 'المصرف الأهلي العراقي — السعودية', 'National Bank of Iraq — KSA', 'SA', 'https://www.nbi.iq'],
    ['fs-sa-tbi', 'المصرف العراقي للتجارة — السعودية', 'Trade Bank of Iraq — KSA', 'SA', 'https://www.tbiraq.com'],
    ['fs-sa-mufg', 'بنك إم يو إف جي — السعودية', 'MUFG Bank — KSA', 'SA', 'https://www.bk.mufg.jp'],
    ['fs-sa-boj', 'بنك الأردن — السعودية', 'Bank of Jordan — KSA', 'SA', 'https://www.bankofjordan.com'],
    ['fs-sa-nbk', 'بنك الكويت الوطني — السعودية', 'National Bank of Kuwait — KSA', 'SA', 'https://www.nbk.com'],
    ['fs-sa-muscat', 'بنك مسقط — السعودية', 'Bank Muscat — KSA', 'SA', 'https://www.bankmuscat.com'],
    ['fs-sa-sohar', 'صحار الدولي — السعودية', 'Sohar International — KSA', 'SA', 'https://www.soharinternational.com'],
    ['fs-sa-nbp', 'بنك باكستان الوطني — السعودية', 'National Bank of Pakistan — KSA', 'SA', 'https://www.nbp.com.pk'],
    ['fs-sa-qnb', 'بنك قطر الوطني — السعودية', 'Qatar National Bank — KSA', 'SA', 'https://www.qnb.com'],
    ['fs-sa-ubs', 'يو بي إس — السعودية', 'UBS — KSA', 'SA', 'https://www.ubs.com'],
    ['fs-sa-ziraat', 'بنك زراعات — السعودية', 'Ziraat Bank — KSA', 'SA', 'https://www.ziraatbank.com.tr'],
    ['fs-sa-adcb', 'بنك أبوظبي التجاري — السعودية', 'ADCB — KSA', 'SA', 'https://www.adcb.com'],
    ['fs-sa-enbd', 'بنك الإمارات دبي الوطني — السعودية', 'Emirates NBD — KSA', 'SA', 'https://www.emiratesnbd.com'],
    ['fs-sa-fab', 'بنك أبوظبي الأول — السعودية', 'FAB — KSA', 'SA', 'https://www.bankfab.com'],
    ['fs-sa-sc', 'ستاندرد تشارترد — السعودية', 'Standard Chartered — KSA', 'SA', 'https://www.sc.com'],
    ['fs-sa-jpm', 'جي بي مورغان — السعودية', 'J.P. Morgan — KSA', 'SA', 'https://www.jpmorgan.com'],

    // AE — remaining CBUAE national banks + major foreign retail
    ['fs-ae-sharjah', 'بنك الشارقة', 'Bank of Sharjah', 'AE', 'https://www.bankofsharjah.com'],
    ['fs-ae-sib', 'مصرف الشارقة الإسلامي', 'Sharjah Islamic Bank', 'AE', 'https://www.sib.ae'],
    ['fs-ae-uab', 'البنك العربي المتحد', 'United Arab Bank', 'AE', 'https://www.uab.ae'],
    ['fs-ae-invest', 'بنك الاستثمار', 'Invest Bank', 'AE', 'https://www.investbank.ae'],
    ['fs-ae-hilal', 'مصرف الهلال', 'Al Hilal Bank', 'AE', 'https://www.alhilalbank.ae'],
    ['fs-ae-uaq', 'بنك أم القيوين الوطني', 'National Bank of Umm Al Quwain', 'AE', 'https://www.nbq.ae'],
    ['fs-ae-fujairah', 'بنك الفجيرة الوطني', 'National Bank of Fujairah', 'AE', 'https://www.nbf.ae'],
    ['fs-ae-cbi', 'البنك التجاري الدولي', 'Commercial Bank International', 'AE', 'https://www.cbiuae.com'],
    ['fs-ae-ajman', 'مصرف عجمان', 'Ajman Bank', 'AE', 'https://www.ajmanbank.ae'],
    ['fs-ae-masraf', 'المصرف العربي للاستثمار والتجارة الخارجية', 'Al Masraf', 'AE', 'https://www.almasraf.ae'],
    ['fs-ae-maryah', 'بنك المارية المحلي', 'Al Maryah Community Bank', 'AE', 'https://www.amcbank.ae'],
    ['fs-ae-eib', 'بنك الإمارات للاستثمار', 'Emirates Investment Bank', 'AE', 'https://www.eibnow.com'],
    ['fs-ae-hsbc', 'إتش إس بي سي الشرق الأوسط', 'HSBC Bank Middle East', 'AE', 'https://www.hsbc.ae'],
    ['fs-ae-sc', 'ستاندرد تشارترد', 'Standard Chartered UAE', 'AE', 'https://www.sc.com/ae'],
    ['fs-ae-citi', 'سيتي بنك', 'Citibank UAE', 'AE', 'https://www.citibank.ae'],
    ['fs-ae-arab', 'البنك العربي — الإمارات', 'Arab Bank UAE', 'AE', 'https://www.arabbank.ae'],
    ['fs-ae-nbo', 'البنك الوطني العماني — الإمارات', 'National Bank of Oman — UAE', 'AE', 'https://www.nbo.om'],
    ['fs-ae-doha', 'بنك الدوحة — الإمارات', 'Doha Bank — UAE', 'AE', 'https://www.dohabank.com'],
    ['fs-ae-zand', 'زاند بنك', 'Zand Bank', 'AE', 'https://www.zand.ae'],
    ['fs-ae-ruya', 'مصرف رؤيا المحلي الإسلامي', 'Ruya Community Islamic Bank', 'AE', 'https://www.ruyabank.ae'],
    ['fs-ae-reem', 'بنك ريم المحلي', 'Reem Community Bank', 'AE', 'https://www.reembank.ae'],
    ['fs-ae-hbl', 'حبيب بنك', 'Habib Bank Limited UAE', 'AE', 'https://www.hbl.com'],
    ['fs-ae-ubl', 'يونایتد بنك', 'United Bank Limited UAE', 'AE', 'https://www.ubldirect.com'],
    ['fs-ae-saderat', 'بنك صادرات إيران', 'Bank Saderat Iran UAE', 'AE', 'https://www.bsi.ir'],
    ['fs-ae-abk', 'البنك الأهلي الكويتي — الإمارات', 'Al Ahli Bank of Kuwait UAE', 'AE', 'https://www.ahliunited.com'],
    ['fs-ae-melli', 'بنك ملي إيران', 'Bank Melli Iran UAE', 'AE', 'https://www.bmi.ir'],
    ['fs-ae-aaib', 'البنك العربي الأفريقي الدولي — الإمارات', 'Arab African International Bank UAE', 'AE', 'https://www.aaib.com'],
    ['fs-ae-misr', 'بنك مصر — الإمارات', 'Banque Misr UAE', 'AE', 'https://www.banquemisr.com'],
    ['fs-ae-bnp', 'بي إن بي باريبا — الإمارات', 'BNP Paribas UAE', 'AE', 'https://mea.bnpparibas.com'],
    ['fs-ae-khaliji', 'الخليجي فرنسا', 'Al Khaliji France UAE', 'AE', 'https://www.qnb.com'],
    ['fs-ae-rafidain', 'مصرف الرافدين — الإمارات', 'Rafidain Bank UAE', 'AE', 'https://www.rafidain-bank.iq'],
    ['fs-ae-baroda', 'بنك بارودا', 'Bank of Baroda UAE', 'AE', 'https://www.bankofbaroda.in'],
    ['fs-ae-janata', 'جناتا بنك', 'Janata Bank UAE', 'AE', 'https://www.janatabank-bd.com'],
    ['fs-ae-hbz', 'حبيب بنك زيورخ', 'Habib Bank AG Zurich UAE', 'AE', 'https://www.habibbank.com'],
    ['fs-ae-banorient', 'بنك بانوريان فرنسا', 'Banque Banorient France UAE', 'AE', 'https://www.banorient.fr'],
    ['fs-ae-cacib', 'كريدي أجريكول للتمويل والاستثمار', 'Crédit Agricole CIB UAE', 'AE', 'https://www.ca-cib.com'],
    ['fs-ae-nilein', 'بنك النيلين — الإمارات', 'El Nilein Bank UAE', 'AE', 'https://www.elnileinbank.com'],
    ['fs-ae-nbb', 'بنك البحرين الوطني — الإمارات', 'National Bank of Bahrain UAE', 'AE', 'https://www.nbbonline.com'],
    ['fs-ae-snb', 'البنك الأهلي السعودي — الإمارات', 'Saudi National Bank UAE', 'AE', 'https://www.alahli.com'],
    ['fs-ae-nbk', 'بنك الكويت الوطني — الإمارات', 'National Bank of Kuwait UAE', 'AE', 'https://www.nbk.com'],
    ['fs-ae-icbc', 'البنك الصناعي والتجاري الصيني — الإمارات', 'ICBC UAE', 'AE', 'https://www.icbc.com.cn'],
    ['fs-ae-db', 'دويتشه بنك — الإمارات', 'Deutsche Bank UAE', 'AE', 'https://www.db.com'],
    ['fs-ae-hana', 'كي إي بي هانا بنك', 'KEB Hana Bank UAE', 'AE', 'https://www.kebhana.com'],
    ['fs-ae-barclays', 'باركليز — الإمارات', 'Barclays UAE', 'AE', 'https://www.barclays.com'],
    ['fs-ae-boc', 'بنك الصين — الإمارات', 'Bank of China UAE', 'AE', 'https://www.bankofchina.com'],
    ['fs-ae-gib', 'بنك الخليج الدولي — الإمارات', 'Gulf International Bank UAE', 'AE', 'https://www.gib.com'],
    ['fs-ae-mcb', 'إم سي بي بنك', 'MCB Bank UAE', 'AE', 'https://www.mcb.com.pk'],
    ['fs-ae-intesa', 'إنتيزا سان باولو', 'Intesa Sanpaolo UAE', 'AE', 'https://www.intesasanpaolo.com'],
    ['fs-ae-abc-cn', 'البنك الزراعي الصيني', 'Agricultural Bank of China UAE', 'AE', 'https://www.abchina.com'],
    ['fs-ae-alfalah', 'بنك الفلاح', 'Bank Alfalah UAE', 'AE', 'https://www.bankalfalah.com'],
    ['fs-ae-bok', 'بي أو كي إنترناشيونال', 'BOK International Bank UAE', 'AE', 'https://www.bok.ae'],
    ['fs-ae-idb', 'مصرف التنمية الدولي — الإمارات', 'International Development Bank UAE', 'AE', 'https://www.idb.iq'],
    ['fs-ae-iib', 'المصرف الإسلامي العراقي للاستثمار والتنمية', 'Iraqi Islamic Bank UAE', 'AE', 'https://www.iraqiislamicb.com'],

    // EG — remaining CBE-registered banks
    ['fs-eg-eal', 'البنك العقاري المصري العربي', 'Egyptian Arab Land Bank', 'EG', 'https://www.aqaribank.com.eg'],
    ['fs-eg-idb', 'بنك التنمية الصناعية', 'Industrial Development Bank', 'EG', 'https://www.idb.com.eg'],
    ['fs-eg-united', 'المصرف المتحد', 'The United Bank', 'EG', 'https://www.theubeg.com'],
    ['fs-eg-midbank', 'ميدبنك', 'MIDBank', 'EG', 'https://www.midbank.com.eg'],
    ['fs-eg-awb', 'التجاري وفا بنك مصر', 'Attijariwafa Bank Egypt', 'EG', 'https://www.attijariwafabank.com.eg'],
    ['fs-eg-saib', 'بنك الشركة المصرفية العربية الدولية', 'SAIB Bank', 'EG', 'https://www.saib.com.eg'],
    ['fs-eg-cae', 'كريدي أجريكول مصر', 'Crédit Agricole Egypt', 'EG', 'https://www.ca-egypt.com'],
    ['fs-eg-enbd', 'الإمارات دبي الوطني مصر', 'Emirates NBD Egypt', 'EG', 'https://www.emiratesnbd.com.eg'],
    ['fs-eg-scb', 'بنك قناة السويس', 'Suez Canal Bank', 'EG', 'https://www.scbank.com.eg'],
    ['fs-eg-aib', 'بنك الاستثمار العربي', 'Arab Investment Bank', 'EG', 'https://www.aib.com.eg'],
    ['fs-eg-abk', 'البنك الأهلي الكويتي — مصر', 'Al Ahli Bank of Kuwait Egypt', 'EG', 'https://www.abkegypt.com'],
    ['fs-eg-hdb', 'بنك التعمير والإسكان', 'Housing and Development Bank', 'EG', 'https://www.hdb-egy.com'],
    ['fs-eg-baraka', 'بنك البركة مصر', 'Al Baraka Bank Egypt', 'EG', 'https://www.albaraka-bank.com.eg'],
    ['fs-eg-nbk', 'بنك الكويت الوطني — مصر', 'NBK Egypt', 'EG', 'https://www.nbk.com.eg'],
    ['fs-eg-adib', 'أبوظبي الإسلامي — مصر', 'ADIB Egypt', 'EG', 'https://www.adib.eg'],
    ['fs-eg-adcb', 'أبوظبي التجاري — مصر', 'ADCB Egypt', 'EG', 'https://www.adcb.com.eg'],
    ['fs-eg-egb', 'البنك المصري الخليجي', 'Egyptian Gulf Bank', 'EG', 'https://www.eg-bank.com'],
    ['fs-eg-aaib', 'البنك العربي الأفريقي الدولي', 'Arab African International Bank', 'EG', 'https://www.aaib.com'],
    ['fs-eg-hsbc', 'إتش إس بي سي مصر', 'HSBC Egypt', 'EG', 'https://www.hsbc.com.eg'],
    ['fs-eg-abc', 'بنك ABC مصر', 'Bank ABC Egypt', 'EG', 'https://www.bank-abc.com'],
    ['fs-eg-aib2', 'المصرف العربي الدولي', 'Arab International Bank', 'EG', 'https://www.aibegypt.com'],
    ['fs-eg-fab', 'أبوظبي الأول — مصر', 'FAB Egypt', 'EG', 'https://www.bankfab.com'],
    ['fs-eg-citi', 'سيتي بنك مصر', 'Citibank Egypt', 'EG', 'https://www.citibank.com.eg'],
    ['fs-eg-arab', 'البنك العربي — مصر', 'Arab Bank Egypt', 'EG', 'https://www.arabbank.com.eg'],
    ['fs-eg-mashreq', 'المشرق — مصر', 'Mashreq Egypt', 'EG', 'https://www.mashreqbank.com'],
    ['fs-eg-nxt', 'بنك نكست', 'BANK NXT', 'EG', 'https://www.banknxt.com'],
    ['fs-eg-kfh', 'بيت التمويل الكويتي — مصر', 'KFH Egypt', 'EG', 'https://www.kfh.com.eg'],
    ['fs-eg-nbg', 'البنك الأهلي اليوناني — مصر', 'National Bank of Greece Egypt', 'EG', 'https://www.nbg.gr'],

    // JO — remaining CBJ commercial, Islamic, foreign, digital
    ['fs-jo-abc', 'بنك ABC الأردن', 'Bank ABC Jordan', 'JO', 'https://www.bank-abc.com'],
    ['fs-jo-jcb', 'البنك التجاري الأردني', 'Jordan Commercial Bank', 'JO', 'https://www.jcbank.com.jo'],
    ['fs-jo-jkb', 'البنك الأردني الكويتي', 'Jordan Kuwait Bank', 'JO', 'https://www.jkb.com'],
    ['fs-jo-ajib', 'بنك الاستثمار العربي الأردني', 'Arab Jordan Investment Bank', 'JO', 'https://www.ajib.com'],
    ['fs-jo-invest', 'بنك الاستثمار', 'INVESTBANK', 'JO', 'https://www.investbank.jo'],
    ['fs-jo-iiab', 'البنك العربي الإسلامي الدولي', 'Islamic International Arab Bank', 'JO', 'https://www.iiabank.com.jo'],
    ['fs-jo-sc', 'ستاندرد تشارترد — الأردن', 'Standard Chartered Jordan', 'JO', 'https://www.sc.com/jo'],
    ['fs-jo-citi', 'سيتي بنك — الأردن', 'Citibank Jordan', 'JO', 'https://www.citibank.com'],
    ['fs-jo-rafidain', 'مصرف الرافدين — الأردن', 'Rafidain Bank Jordan', 'JO', 'https://www.rafidain-bank.iq'],
    ['fs-jo-nbk', 'بنك الكويت الوطني — الأردن', 'NBK Jordan', 'JO', 'https://www.nbk.com'],
    ['fs-jo-audi', 'بنك عودة — الأردن', 'Bank Audi Jordan', 'JO', 'https://www.bankaudi.com'],
    ['fs-jo-rajhi', 'مصرف الراجحي — الأردن', 'Al Rajhi Bank Jordan', 'JO', 'https://www.alrajhibank.com.jo'],
    ['fs-jo-blink', 'بنك بلينك', 'Blink', 'JO', 'https://theblink.com'],

    // KW — remaining local + foreign branches
    ['fs-kw-cbk', 'البنك التجاري الكويتي', 'Commercial Bank of Kuwait', 'KW', 'https://www.cbk.com'],
    ['fs-kw-kib', 'بنك الكويت الدولي', 'Kuwait International Bank', 'KW', 'https://www.kib.com.kw'],
    ['fs-kw-bbk', 'بنك البحرين والكويت — الكويت', 'BBK Kuwait', 'KW', 'https://www.bbkonline.com'],
    ['fs-kw-bnp', 'بي إن بي باريبا — الكويت', 'BNP Paribas Kuwait', 'KW', 'https://www.bnpparibas.com'],
    ['fs-kw-hsbc', 'إتش إس بي سي — الكويت', 'HSBC Kuwait', 'KW', 'https://www.business.hsbc.com.kw'],
    ['fs-kw-fab', 'أبوظبي الأول — الكويت', 'FAB Kuwait', 'KW', 'https://www.bankfab.com'],
    ['fs-kw-citi', 'سيتي بنك — الكويت', 'Citibank Kuwait', 'KW', 'https://www.citigroup.com'],
    ['fs-kw-qnb', 'بنك قطر الوطني — الكويت', 'QNB Kuwait', 'KW', 'https://www.qnb.com'],
    ['fs-kw-doha', 'بنك الدوحة — الكويت', 'Doha Bank Kuwait', 'KW', 'https://kw.dohabank.com'],
    ['fs-kw-mashreq', 'المشرق — الكويت', 'Mashreq Kuwait', 'KW', 'https://www.mashreqbank.com'],
    ['fs-kw-rajhi', 'مصرف الراجحي — الكويت', 'Al Rajhi Bank Kuwait', 'KW', 'https://www.alrajhibank.com.kw'],
    ['fs-kw-muscat', 'بنك مسقط — الكويت', 'Bank Muscat Kuwait', 'KW', 'https://www.bankmuscat.com'],
    ['fs-kw-icbc', 'البنك الصناعي والتجاري الصيني — الكويت', 'ICBC Kuwait', 'KW', 'https://www.icbc.com.cn'],

    // QA — remaining local + foreign
    ['fs-qa-ahli', 'الأهلي بنك', 'Ahli Bank Qatar', 'QA', 'https://www.ahlibank.com.qa'],
    ['fs-qa-arab', 'البنك العربي — قطر', 'Arab Bank Qatar', 'QA', 'https://www.arabbank.com.qa'],
    ['fs-qa-mashreq', 'المشرق — قطر', 'Mashreq Qatar', 'QA', 'https://www.mashreqbank.com'],
    ['fs-qa-hsbc', 'إتش إس بي سي — قطر', 'HSBC Qatar', 'QA', 'https://www.hsbc.com.qa'],
    ['fs-qa-bnp', 'بي إن بي باريبا — قطر', 'BNP Paribas Qatar', 'QA', 'https://mea.bnpparibas.com'],
    ['fs-qa-saderat', 'بنك صادرات إيران — قطر', 'Bank Saderat Iran Qatar', 'QA', 'https://www.bsi.ir'],
    ['fs-qa-ubl', 'يونايتد بنك — قطر', 'United Bank Limited Qatar', 'QA', 'https://www.ubldirect.com'],
    ['fs-qa-sc', 'ستاندرد تشارترد — قطر', 'Standard Chartered Qatar', 'QA', 'https://www.sc.com/qa'],

    // BH — remaining local retail/Islamic/development
    ['fs-bh-salam', 'بنك السلام', 'Al Salam Bank', 'BH', 'https://www.alsalambank.com'],
    ['fs-bh-ithmaar', 'بنك الإثمار', 'Ithmaar Bank', 'BH', 'https://www.ithmaarbank.com'],
    ['fs-bh-baraka', 'البركة الإسلامي', 'Al Baraka Islamic Bank', 'BH', 'https://www.albaraka.bh'],
    ['fs-bh-khaleeji', 'الخليجي بنك', 'Khaleeji Bank', 'BH', 'https://www.khcbonline.com'],
    ['fs-bh-abc', 'بنك ABC البحرين', 'Bank ABC Bahrain', 'BH', 'https://www.bank-abc.com'],
    ['fs-bh-gib', 'بنك الخليج الدولي', 'Gulf International Bank', 'BH', 'https://www.gib.com'],
    ['fs-bh-eskan', 'بنك الإسكان', 'Eskan Bank', 'BH', 'https://www.eskanbank.com'],
    ['fs-bh-arab', 'البنك العربي — البحرين', 'Arab Bank Bahrain', 'BH', 'https://www.arabbank.bh'],
    ['fs-bh-hsbc', 'إتش إس بي سي — البحرين', 'HSBC Bahrain', 'BH', 'https://www.hsbc.com.bh'],
    ['fs-bh-sc', 'ستاندرد تشارترد — البحرين', 'Standard Chartered Bahrain', 'BH', 'https://www.sc.com/bh'],
    ['fs-bh-citi', 'سيتي بنك — البحرين', 'Citibank Bahrain', 'BH', 'https://www.citibank.com.bh'],
    ['fs-bh-nbk', 'بنك الكويت الوطني — البحرين', 'NBK Bahrain', 'BH', 'https://www.nbk.com'],
    ['fs-bh-fab', 'أبوظبي الأول — البحرين', 'FAB Bahrain', 'BH', 'https://www.bankfab.com'],
    ['fs-bh-snb', 'البنك الأهلي السعودي — البحرين', 'SNB Bahrain', 'BH', 'https://www.alahli.com'],

    // OM — remaining CBO foreign + housing
    ['fs-om-housing', 'بنك الإسكان العماني', 'Oman Housing Bank', 'OM', 'https://www.ohb.co.om'],
    ['fs-om-izz', 'بنك العز الإسلامي', 'Alizz Islamic Bank', 'OM', 'https://www.alizzislamic.com'],
    ['fs-om-sc', 'ستاندرد تشارترد — عُمان', 'Standard Chartered Oman', 'OM', 'https://www.sc.com'],
    ['fs-om-fab', 'أبوظبي الأول — عُمان', 'FAB Oman', 'OM', 'https://www.bankfab.com'],
    ['fs-om-mashreq', 'المشرق — عُمان', 'Mashreq Oman', 'OM', 'https://www.mashreqbank.com'],
    ['fs-om-hsbc', 'إتش إس بي سي الشرق الأوسط — فرع عُمان', 'HSBC Bank Middle East — Oman Branch', 'OM', 'https://www.business.hsbc.om'],
    ['fs-om-qnb', 'بنك قطر الوطني — عُمان', 'QNB Oman', 'OM', 'https://www.qnb.com'],
    ['fs-om-beirut', 'بنك بيروت — عُمان', 'Bank of Beirut Oman', 'OM', 'https://www.bankofbeirut.com'],
    ['fs-om-gib', 'بنك الخليج الدولي — عُمان', 'GIB Oman', 'OM', 'https://www.gib.com'],

    // MA — remaining BAM commercial + participatory
    ['fs-ma-barid', 'البريد بنك', 'Al Barid Bank', 'MA', 'https://www.albaridbank.ma'],
    ['fs-ma-cdm', 'القرض العقاري والسياحي', 'Crédit du Maroc', 'MA', 'https://www.creditdumaroc.ma'],
    ['fs-ma-sg', 'الشركة العامة المغربية للأبناك', 'Société Générale Morocco', 'MA', 'https://www.sgmaroc.com'],
    ['fs-ma-cfg', 'CFG بنك', 'CFG Bank', 'MA', 'https://www.cfgbank.com'],
    ['fs-ma-assafa', 'بنك الصفاء', 'Bank Assafa', 'MA', 'https://www.bankassafa.ma'],
    ['fs-ma-umnia', 'أمنية بنك', 'Umnia Bank', 'MA', 'https://www.umniabank.ma'],
    ['fs-ma-yousr', 'بنك اليسر', 'Bank Al Yousr', 'MA', 'https://www.bankalyousr.ma'],
    ['fs-ma-akhdar', 'الأخضر بنك', 'Al Akhdar Bank', 'MA', 'https://www.alakhdarbank.ma'],
    ['fs-ma-bti', 'بنك التمويل والإنماء', 'Bank Al-Tamweel wa Al-Inma', 'MA', 'https://www.btibank.ma'],
    ['fs-ma-arab', 'البنك العربي — المغرب', 'Arab Bank Morocco', 'MA', 'https://www.arabbank.ma'],
    ['fs-ma-citi', 'سيتي بنك المغرب', 'Citibank Morocco', 'MA', 'https://www.citibank.com'],

    // TN — remaining BCT commercial banks
    ['fs-tn-bna', 'البنك الوطني الفلاحي', 'Banque Nationale Agricole', 'TN', 'https://www.bna.com.tn'],
    ['fs-tn-atb', 'البنك العربي لتونس', 'Arab Tunisian Bank', 'TN', 'https://www.atb.com.tn'],
    ['fs-tn-attijari', 'التجاري بنك', 'Attijari Bank Tunisia', 'TN', 'https://www.attijaribank.com.tn'],
    ['fs-tn-uib', 'الاتحاد الدولي للبنوك', 'UIB', 'TN', 'https://www.uib.com.tn'],
    ['fs-tn-ubci', 'الاتحاد البنكي للتجارة والصناعة', 'UBCI', 'TN', 'https://www.ubci.tn'],
    ['fs-tn-bh', 'بنك الإسكان', 'BH Bank', 'TN', 'https://www.bh.com.tn'],
    ['fs-tn-zitouna', 'بنك الزيتونة', 'Banque Zitouna', 'TN', 'https://www.banquezitouna.com'],
    ['fs-tn-baraka', 'بنك البركة تونس', 'Al Baraka Bank Tunisia', 'TN', 'https://www.albarakabank.com.tn'],
    ['fs-tn-qnb', 'QNB تونس', 'QNB Tunisia', 'TN', 'https://www.qnb.com.tn'],
    ['fs-tn-abc', 'بنك ABC تونس', 'Bank ABC Tunisia', 'TN', 'https://www.bank-abc.com'],
    ['fs-tn-btk', 'البنك التونسي الكويتي', 'BTK', 'TN', 'https://www.btk.com.tn'],
    ['fs-tn-bte', 'بنك تونس والإمارات', 'BTE', 'TN', 'https://www.bte.com.tn'],
    ['fs-tn-tsb', 'البنك التونسي السعودي', 'Tunisian Saudi Bank', 'TN', 'https://www.tsb.com.tn'],
    ['fs-tn-wifak', 'بنك الوفاق الدولي', 'Wifak International Bank', 'TN', 'https://www.wifakbank.com'],
    ['fs-tn-btl', 'البنك التونسي الليبي', 'Banque Tuniso-Libyenne', 'TN', 'https://www.btl.com.tn'],
    ['fs-tn-citi', 'سيتي بنك تونس', 'Citibank Tunisia', 'TN', 'https://www.citibank.com'],

    // DZ — remaining Bank of Algeria list
    ['fs-dz-bnh', 'البنك الوطني للإسكان', 'Banque Nationale de l’Habitat', 'DZ', 'https://www.bnh.dz'],
    ['fs-dz-baraka', 'بنك البركة الجزائر', 'Al Baraka Algeria', 'DZ', 'https://www.albaraka-bank.dz'],
    ['fs-dz-abc', 'بنك ABC الجزائر', 'Bank ABC Algeria', 'DZ', 'https://www.bank-abc.com'],
    ['fs-dz-sg', 'سوسيتيه جنرال الجزائر', 'Société Générale Algeria', 'DZ', 'https://www.societegenerale.dz'],
    ['fs-dz-bnp', 'بي إن بي باريبا الجزائر', 'BNP Paribas El Djazaïr', 'DZ', 'https://www.bnpparibas.dz'],
    ['fs-dz-natixis', 'ناتيكسيس الجزائر', 'Natixis Algérie', 'DZ', 'https://www.natixis.dz'],
    ['fs-dz-citi', 'سيتي بنك الجزائر', 'Citibank Algeria', 'DZ', 'https://www.citibank.com'],
    ['fs-dz-arab', 'البنك العربي — الجزائر', 'Arab Bank Algeria', 'DZ', 'https://www.arabbank.dz'],
    ['fs-dz-agb', 'بنك الخليج الجزائر', 'Gulf Bank Algeria', 'DZ', 'https://www.agb.dz'],
    ['fs-dz-hbtf', 'بنك الإسكان — الجزائر', 'HBTF Algeria', 'DZ', 'https://www.hbtf.dz'],
    ['fs-dz-fransa', 'فرنسبنك الجزائر', 'Fransabank El Djazaïr', 'DZ', 'https://www.fransabank.dz'],
    ['fs-dz-salam', 'بنك السلام الجزائر', 'Al Salam Bank Algeria', 'DZ', 'https://www.alsalamalgeria.com'],
    ['fs-dz-hsbc', 'إتش إس بي سي الجزائر', 'HSBC Algeria', 'DZ', 'https://www.hsbc.dz'],

    // IQ — remaining state-owned + major private
    ['fs-iq-agri', 'المصرف الزراعي التعاوني', 'Agricultural Cooperative Bank of Iraq', 'IQ', 'https://www.agriculturalbank.gov.iq'],
    ['fs-iq-ind', 'المصرف الصناعي', 'Industrial Bank of Iraq', 'IQ', 'https://www.industrialbank.gov.iq'],
    ['fs-iq-reb', 'المصرف العقاري', 'Real Estate Bank of Iraq', 'IQ', 'https://www.reb.iq'],
    ['fs-iq-cbiq', 'المصرف التجاري العراقي', 'Commercial Bank of Iraq', 'IQ', 'https://www.cbiraq.iq'],
    ['fs-iq-ibi', 'المصرف العراقي للاستثمار', 'Investment Bank of Iraq', 'IQ', 'https://www.ibi.iq'],
    ['fs-iq-gulf', 'مصرف الخليج التجاري', 'Gulf Commercial Bank', 'IQ', 'https://www.gulfbank.com.iq'],
    ['fs-iq-ashur', 'مصرف آشور الدولي', 'Ashur International Bank', 'IQ', 'https://www.ashurbank.iq'],
    ['fs-iq-north', 'المصرف الأهلي العراقي', 'National Bank of Iraq', 'IQ', 'https://www.nbi.iq'],
    ['fs-iq-idb', 'مصرف التنمية الدولي', 'International Development Bank', 'IQ', 'https://www.idb.iq'],
    ['fs-iq-kib', 'مصرف كوردستان الدولي', 'Kurdistan International Bank', 'IQ', 'https://www.kibid.com'],
    ['fs-iq-arab', 'البنك العربي — العراق', 'Arab Bank Iraq', 'IQ', 'https://www.arabbank.iq'],
    ['fs-iq-byblos', 'بيبلوس — العراق', 'Byblos Bank Iraq', 'IQ', 'https://www.byblosbank.iq'],
    ['fs-iq-ziraat', 'زراعات — العراق', 'Ziraat Bank Iraq', 'IQ', 'https://www.ziraatbank.com.iq'],

    // LB — remaining BCCL major banks
    ['fs-lb-blf', 'بنك لبنان والفرنسي', 'Banque Libano-Française', 'LB', 'https://www.eblf.com'],
    ['fs-lb-sgbl', 'سوسيتيه جنرال لبنان', 'SGBL', 'LB', 'https://www.sgbl.com.lb'],
    ['fs-lb-fransa', 'فرنسبنك', 'Fransabank', 'LB', 'https://www.fransabank.com'],
    ['fs-lb-med', 'بنك ميد', 'BankMed', 'LB', 'https://www.bankmed.com.lb'],
    ['fs-lb-cl', 'الاعتماد اللبناني', 'Crédit Libanais', 'LB', 'https://www.creditlibanais.com.lb'],
    ['fs-lb-bbac', 'بنك بيروت والبلاد العربية', 'BBAC', 'LB', 'https://www.bbac.com.lb'],
    ['fs-lb-fnb', 'البنك الوطني الأول', 'First National Bank Lebanon', 'LB', 'https://www.fnb.com.lb'],
    ['fs-lb-ibl', 'بنك IBL', 'IBL Bank', 'LB', 'https://www.ibl.com.lb'],
    ['fs-lb-saradar', 'بنك سردار', 'Saradar Bank', 'LB', 'https://www.saradarbank.com'],
    ['fs-lb-arab', 'البنك العربي — لبنان', 'Arab Bank Lebanon', 'LB', 'https://www.arabbank.com.lb'],
    ['fs-lb-nbk', 'بنك الكويت الوطني — لبنان', 'NBK Lebanon', 'LB', 'https://www.nbk.com'],
    ['fs-lb-citi', 'سيتي بنك — لبنان', 'Citibank Lebanon', 'LB', 'https://www.citibank.com'],

    // LY — remaining CBL commercial
    ['fs-ly-nab', 'مصرف شمال أفريقيا', 'North Africa Bank', 'LY', 'https://www.nab.ly'],
    ['fs-ly-aman', 'مصرف الأمان', 'Aman Bank', 'LY', 'https://www.aman-bank.com'],
    ['fs-ly-lfb', 'المصرف الليبي الخارجي', 'Libyan Foreign Bank', 'LY', 'https://www.lfb.ly'],
    ['fs-ly-atib', 'مصرف السراي', 'Assaray Trade and Investment Bank', 'LY', 'https://www.atib.ly'],
    ['fs-ly-ubci', 'المصرف المتحد للتجارة والاستثمار', 'UBCI Libya', 'LY', 'https://www.ubci-libya.com'],
    ['fs-ly-alwaha', 'مصرف الواحة', 'Alwaha Bank', 'LY', 'https://www.alwahabank.ly'],
    ['fs-ly-nuran', 'مصرف نوران', 'Nuran Bank', 'LY', 'https://www.nub.ly'],
    ['fs-ly-fab', 'الخليج الأول الليبي', 'First Gulf Libyan Bank', 'LY', 'https://www.bankfab.com'],

    // SD — remaining CBOS operating banks
    ['fs-sd-agri', 'البنك الزراعي السوداني', 'Agricultural Bank of Sudan', 'SD', 'https://www.abs.sd'],
    ['fs-sd-idb', 'بنك التنمية الصناعية', 'Industrial Development Bank Sudan', 'SD', 'https://www.idb.sd'],
    ['fs-sd-edb', 'بنك تنمية الصادرات', 'Export Development Bank Sudan', 'SD', 'https://www.edb.sd'],
    ['fs-sd-ssdb', 'بنك الادخار والتنمية الاجتماعية', 'Savings and Social Development Bank', 'SD', 'https://www.ssdb.sd'],
    ['fs-sd-nilein', 'بنك النيلين', 'El Nilein Bank', 'SD', 'https://www.elnileinbank.com'],
    ['fs-sd-sib', 'البنك الإسلامي السوداني', 'Sudanese Islamic Bank', 'SD', 'https://www.sib.sd'],
    ['fs-sd-baraka', 'بنك البركة السودان', 'Al Baraka Sudan', 'SD', 'https://www.albaraka.com.sd'],
    ['fs-sd-salam', 'بنك السلام السودان', 'Al Salam Bank Sudan', 'SD', 'https://www.alsalambank.com'],
    ['fs-sd-qnb', 'QNB السودان', 'QNB Sudan', 'SD', 'https://www.qnb.com'],
    ['fs-sd-tadamon', 'بنك التضامن الإسلامي', 'Tadamon Islamic Bank', 'SD', 'https://www.tadamonbank.com'],
    ['fs-sd-nbe', 'البنك الأهلي المصري — الخرطوم', 'NBE Khartoum', 'SD', 'https://www.nbe.com.eg'],
    ['fs-sd-family', 'بنك الأسرة', 'Family Bank Sudan', 'SD', 'https://www.familybank.sd'],
    ['fs-sd-blue', 'بنك النيل الأزرق المشرق', 'Blue Nile Mashreq Bank', 'SD', 'https://www.bluenilebank.com'],

    // YE — remaining CBY licensed banks
    ['fs-ye-nby', 'البنك الأهلي اليمني', 'National Bank of Yemen', 'YE', 'https://www.nbyemen.com'],
    ['fs-ye-arab', 'البنك العربي — اليمن', 'Arab Bank Yemen', 'YE', 'https://www.arabbank.com'],
    ['fs-ye-iby', 'بنك اليمن الدولي', 'International Bank of Yemen', 'YE', 'https://www.ibyemen.com'],
    ['fs-ye-ykb', 'بنك اليمن والكويت', 'Yemen Kuwait Bank', 'YE', 'https://www.yk-bank.com'],
    ['fs-ye-ycb', 'البنك اليمني التجاري', 'Yemen Commercial Bank', 'YE', 'https://www.ycb.com.ye'],
    ['fs-ye-saba', 'بنك سبأ الإسلامي', 'Saba Islamic Bank', 'YE', 'https://www.sababank.com'],
    ['fs-ye-ygb', 'بنك اليمن والخليج', 'Yemen Gulf Bank', 'YE', 'https://www.yg-bank.com'],
    ['fs-ye-shamil', 'مصرف اليمن البحرين الشامل', 'Shamil Bank of Yemen & Bahrain', 'YE', 'https://www.sbyb.net'],
    ['fs-ye-qnb', 'QNB اليمن', 'QNB Yemen', 'YE', 'https://www.qnb.com'],
    ['fs-ye-amal', 'بنك الأمل للتمويل الأصغر', 'Al-Amal Microfinance Bank', 'YE', 'https://www.alamalbank.com'],
    ['fs-ye-kuraimi', 'بنك الكريمي الإسلامي للتمويل الأصغر', 'Al-Kuraimi Islamic Microfinance Bank', 'YE', 'https://alkuraimi.com'],
    ['fs-ye-hadhramout', 'بنك حضرموت التجاري', 'Hadhramout Commercial Bank', 'YE', 'https://www.hadhramoutbank.com'],

    // PS — remaining PMA licensed
    ['fs-ps-pib-isl', 'البنك الإسلامي الفلسطيني', 'Palestine Islamic Bank', 'PS', 'https://www.islamicbank.ps'],
    ['fs-ps-tnb', 'البنك الوطني', 'The National Bank Palestine', 'PS', 'https://www.tnb.ps'],
    ['fs-ps-safa', 'بنك الصفا', 'Safa Bank', 'PS', 'https://www.safabank.ps'],
    ['fs-ps-arab', 'البنك العربي — فلسطين', 'Arab Bank Palestine', 'PS', 'https://www.arabbank.ps'],
    ['fs-ps-cab', 'بنك القاهرة عمان — فلسطين', 'Cairo Amman Bank Palestine', 'PS', 'https://www.cab.ps'],
    ['fs-ps-boj', 'بنك الأردن — فلسطين', 'Bank of Jordan Palestine', 'PS', 'https://www.bankofjordan.com'],
    ['fs-ps-hbtf', 'بنك الإسكان — فلسطين', 'HBTF Palestine', 'PS', 'https://www.hbtf.com'],
    ['fs-ps-ahli', 'الأهلي الأردني — فلسطين', 'Jordan Ahli Bank Palestine', 'PS', 'https://www.ahli.com'],
    ['fs-ps-jkb', 'الأردني الكويتي — فلسطين', 'Jordan Kuwait Bank Palestine', 'PS', 'https://www.jkb.com'],
    ['fs-ps-eal', 'العقاري المصري العربي — فلسطين', 'Egyptian Arab Land Bank Palestine', 'PS', 'https://www.ealbank.ps'],

    // SY — remaining CBS March 2026 list
    ['fs-sy-ind', 'المصرف الصناعي', 'Industrial Bank Syria', 'SY', 'https://www.industrialbank.gov.sy'],
    ['fs-sy-agri', 'المصرف الزراعي التعاوني', 'Agricultural Cooperative Bank Syria', 'SY', 'https://www.agrobank.gov.sy'],
    ['fs-sy-pcb', 'مصرف التسليف الشعبي', 'Popular Credit Bank', 'SY', 'https://www.pcb.gov.sy'],
    ['fs-sy-reb', 'المصرف العقاري', 'Real Estate Bank Syria', 'SY', 'https://www.reb.gov.sy'],
    ['fs-sy-save', 'مصرف التوفير', 'Saving Bank Syria', 'SY', 'https://www.savingsbank.gov.sy'],
    ['fs-sy-bemo', 'بنك بيمو السعودي الفرنسي', 'Bank BEMO Saudi Fransi', 'SY', 'https://www.bbsfbank.com'],
    ['fs-sy-bso', 'بنك سورية والمهجر', 'Bank of Syria & Overseas', 'SY', 'https://www.bso.com.sy'],
    ['fs-sy-ibtf', 'المصرف الدولي للتجارة والتمويل', 'IBTF Syria', 'SY', 'https://www.ibtf.com.sy'],
    ['fs-sy-arab', 'البنك العربي — سورية', 'Arab Bank Syria', 'SY', 'https://www.arabbank.com.sy'],
    ['fs-sy-siib', 'سورية الدولي الإسلامي', 'Syria International Islamic Bank', 'SY', 'https://www.siib.sy'],
    ['fs-sy-boj', 'بنك الأردن — سورية', 'Bank of Jordan Syria', 'SY', 'https://www.bankofjordan.com'],
    ['fs-sy-fransa', 'فرنسبنك سورية', 'Fransabank Syria', 'SY', 'https://www.fransabanksyria.com'],
    ['fs-sy-sharq', 'بنك الشرق', 'Bank Al-Sharq', 'SY', 'https://www.bankalsharq.com'],
    ['fs-sy-sgb', 'بنك سورية والخليج', 'Syria Gulf Bank', 'SY', 'https://www.sgbsyria.com'],

    // MR, SO, DJ, KM remaining
    ['fs-mr-bam', 'البنك العربي الموريتاني', 'BAMIS', 'MR', 'https://www.bamis.mr'],
    ['fs-mr-bim', 'البنك الإسلامي الموريتاني', 'Banque Islamique de Mauritanie', 'MR', 'https://www.bim.mr'],
    ['fs-mr-sg', 'الشركة العامة موريتانيا', 'Société Générale Mauritania', 'MR', 'https://www.sg.mr'],
    ['fs-so-amal', 'بنك أمل', 'Amal Bank Somalia', 'SO', 'https://www.amalbank.so'],
    ['fs-so-salaam', 'بنك سلام الصومالي', 'Salaam Somali Bank', 'SO', 'https://www.salaambank.so'],
    ['fs-so-ibs', 'بنك الصومال الدولي', 'International Bank of Somalia', 'SO', 'https://www.ibsbank.so'],
    ['fs-dj-saba', 'بنك سبأ — جيبوتي', 'Saba Islamic Bank Djibouti', 'DJ', 'https://www.sababank.com'],
    ['fs-dj-cac', 'بنك CAC جيبوتي', 'CAC International Bank Djibouti', 'DJ', 'https://www.cacbank.com'],
    ['fs-dj-exim', 'إكسيم بنك جيبوتي', 'Exim Bank Djibouti', 'DJ', 'https://www.eximbank.com'],
    ['fs-km-bic', 'البنك الاتحادي لجزر القمر', 'Banque pour l’Industrie et le Commerce', 'KM', 'https://www.bic.km'],
    ['fs-km-snps', 'السنابس بنك', 'SNPSF Comoros', 'KM', 'https://www.snpsf.com']
  ],

  programs: [
    ['fs-sa-exim', 'بنك التصدير والاستيراد السعودي', 'Saudi EXIM Bank', 'SA', 'https://saexim.gov.sa', {
      type: 'government_program', sector: 'trade,industry',
      description_ar: 'تمويل وضمان الصادرات السعودية غير النفطية.',
      description_en: 'Financing and guaranteeing Saudi non-oil exports.'
    }],
    ['fs-sa-sfd', 'الصندوق السعودي للتنمية', 'Saudi Fund for Development', 'SA', 'https://www.sfd.gov.sa', {
      type: 'fund',
      description_ar: 'يموّل مشاريع تنموية في الدول النامية بما فيها دول عربية، ويمنح تمويلاً وضمانات للصادرات.',
      description_en: 'Finances development projects in developing countries, including Arab states, and supports Saudi exports.'
    }],
    ['fs-sa-cdf', 'صندوق التنمية الثقافي', 'Cultural Development Fund', 'SA', 'https://www.cdf.gov.sa', {
      type: 'fund', sector: 'creative_economy,media_content',
      description_ar: 'تمويل الاستثمار في الأنشطة الثقافية والإبداعية.',
      description_en: 'Financing investment in cultural and creative activity.'
    }],
    ['fs-sa-eif', 'صندوق الفعاليات الاستثماري', 'Events Investment Fund', 'SA', 'https://www.eif.gov.sa', {
      type: 'fund', sector: 'entertainment_sports,tourism',
      description_ar: 'استثمار وتمويل قطاع الفعاليات والترفيه والرياضة.',
      description_en: 'Investment and financing for events, entertainment and sports.'
    }],
    ['fs-sa-nif', 'صندوق البنية التحتية الوطني', 'National Infrastructure Fund', 'SA', 'https://www.nif.gov.sa', {
      type: 'fund', sector: 'infrastructure,construction',
      description_ar: 'تمكين وتمويل مشاريع البنية التحتية الاستراتيجية.',
      description_en: 'Enabling and financing strategic infrastructure projects.'
    }],
    ['fs-sa-manafa', 'منافع للتمويل الجماعي بالدين', 'Manafa', 'SA', 'https://manafa.sa', {
      type: 'fund',
      description_ar: 'منصة تمويل جماعي بالدين مرخّصة من ساما لتمويل المنشآت.',
      description_en: 'SAMA-licensed debt crowdfunding platform for enterprises.',
      financing_type: 'loan'
    }],
    ['fs-sa-lendo', 'ليندو', 'Lendo', 'SA', 'https://www.lendo.sa', {
      type: 'fund',
      description_ar: 'منصة تمويل جماعي بالدين للمنشآت الصغيرة والمتوسطة.',
      description_en: 'Debt crowdfunding platform for SMEs.',
      financing_type: 'loan'
    }],
    ['fs-eg-abe-idb', 'جهاز تنمية المشروعات — نافذة البنوك', 'MSMEDA bank window', 'EG', 'https://www.msmeda.org.eg', {
      type: 'government_program',
      description_ar: 'تمويل عبر شبكة فروع البنوك الشريكة للجهاز على مستوى المحافظات.',
      description_en: 'MSMEDA financing delivered through partner bank branches nationwide.'
    }],
    ['fs-sa-nayifat', 'نايفات للتمويل', 'Nayifat Finance', 'SA', 'https://www.nayifat.com', {
      type: 'fund', financing_type: 'loan',
      description_ar: 'شركة تمويل مرخّصة من ساما للمنشآت والأفراد.',
      description_en: 'SAMA-licensed finance company for enterprises and consumers.'
    }],
    ['fs-sa-alj', 'عبد اللطيف جميل المتحدة للتمويل', 'Abdul Latif Jameel United Finance', 'SA', 'https://www.alj.com', {
      type: 'fund', financing_type: 'loan',
      description_ar: 'تمويل استهلاكي وتمويل منشآت وأصول إنتاجية مرخّص من ساما.',
      description_en: 'SAMA-licensed consumer, SME and productive-asset finance.'
    }],
    ['fs-sa-amlak', 'أملاك العالمية', 'Amlak International Finance', 'SA', 'https://www.amlak.com.sa', {
      type: 'fund', sector: 'real_estate', financing_type: 'loan',
      description_ar: 'تمويل عقاري ومنشآت مرخّص من ساما.',
      description_en: 'SAMA-licensed real-estate and SME finance.'
    }],
    ['fs-sa-emkan', 'إمكان للتمويل', 'Emkan Finance', 'SA', 'https://www.emkanfinance.com.sa', {
      type: 'fund', financing_type: 'loan',
      description_ar: 'شركة تمويل تابعة لمصرف الراجحي مرخّصة من ساما.',
      description_en: 'Al Rajhi-owned finance company licensed by SAMA.'
    }],
    ['fs-sa-aloula', 'تمويل الأولى', 'Tamweel Aloula', 'SA', 'https://www.aloula.com.sa', {
      type: 'fund', financing_type: 'loan',
      description_ar: 'تمويل المنشآت والأفراد والأصول مرخّص من ساما.',
      description_en: 'SAMA-licensed SME, consumer and asset finance.'
    }],
    ['fs-sa-aljabr', 'الجبر للتمويل', 'Aljabr Finance', 'SA', 'https://www.aljabrfinance.com', {
      type: 'fund', financing_type: 'loan',
      description_ar: 'تمويل مركبات ومنشآت وأصول مرخّص من ساما.',
      description_en: 'SAMA-licensed vehicle, SME and asset finance.'
    }],
    ['fs-sa-sahl', 'سهل للتمويل', 'Sahl Finance', 'SA', 'https://www.sahl.com.sa', {
      type: 'fund', financing_type: 'loan',
      description_ar: 'تمويل عقاري ومنشآت مرخّص من ساما.',
      description_en: 'SAMA-licensed real-estate and SME finance.'
    }],
    ['fs-sa-bidaya', 'بداية للتمويل العقاري', 'Bidaya Home Finance', 'SA', 'https://www.bidaya.com.sa', {
      type: 'fund', sector: 'real_estate', financing_type: 'loan',
      description_ar: 'شركة تمويل عقاري مرخّصة من ساما.',
      description_en: 'SAMA-licensed home-finance company.'
    }],
    ['fs-sa-src', 'الشركة السعودية لإعادة التمويل العقاري', 'Saudi Real Estate Refinance Company', 'SA', 'https://www.src.com.sa', {
      type: 'fund', sector: 'real_estate', financing_type: 'loan',
      description_ar: 'إعادة تمويل المحافظ العقارية لدعم سوق الإسكان.',
      description_en: 'Refinances mortgage portfolios to support the housing market.'
    }],
    ['fs-sa-alyusr', 'اليسر للإيجار والتمويل', 'Al Yusr Leasing and Financing', 'SA', 'https://www.alyusr.com.sa', {
      type: 'fund', financing_type: 'loan',
      description_ar: 'تمويل تأجيري ومنشآت مرخّص من ساما.',
      description_en: 'SAMA-licensed leasing and enterprise finance.'
    }],
    ['fs-sa-orix', 'أوركس السعودية', 'Saudi ORIX', 'SA', 'https://www.saudiorix.com.sa', {
      type: 'fund', financing_type: 'loan',
      description_ar: 'تمويل تأجيري للأصول والمنشآت مرخّص من ساما.',
      description_en: 'SAMA-licensed leasing finance for assets and enterprises.'
    }],
    ['fs-kw-kfund', 'الصندوق الكويتي للتنمية الاقتصادية العربية', 'Kuwait Fund for Arab Economic Development', 'KW', 'https://www.kuwait-fund.org', {
      type: 'fund',
      description_ar: 'يموّل مشاريع تنموية في الدول العربية والنامية بقروض ميسّرة ومنح.',
      description_en: 'Concessional loans and grants for development projects in Arab and developing countries.'
    }],
    ['fs-ae-adfd', 'صندوق أبوظبي للتنمية', 'Abu Dhabi Fund for Development', 'AE', 'https://www.adfd.ae', {
      type: 'fund',
      description_ar: 'قروض ميسّرة وتمويل صادرات واستثمارات تنموية، بما في ذلك القطاع الخاص الإماراتي.',
      description_en: 'Concessional loans, export finance and development investment, including UAE private-sector support.'
    }],
    ['fs-qa-qffd', 'صندوق قطر للتنمية', 'Qatar Fund for Development', 'QA', 'https://www.qatarfund.org.qa', {
      type: 'fund',
      description_ar: 'الذراع التنموي لدولة قطر لتمويل المشاريع الإنسانية والتنموية.',
      description_en: 'Qatar’s development arm financing humanitarian and development projects.'
    }],
    ['fs-ps-pif', 'صندوق الاستثمار الفلسطيني', 'Palestine Investment Fund', 'PS', 'https://www.pif.ps', {
      type: 'fund', financing_type: 'equity',
      description_ar: 'الصندوق السيادي الفلسطيني يستثمر في قطاعات إنتاجية داخل فلسطين.',
      description_en: 'Palestine’s sovereign fund investing in productive sectors inside Palestine.'
    }],
    ['fs-ye-smeps', 'جهاز تنمية المنشآت الصغيرة والأصغر', 'SMEPS Yemen', 'YE', 'https://smeps.org.ye', {
      type: 'government_program',
      description_ar: 'تمكين وتمويل المنشآت الصغيرة والأصغر في اليمن.',
      description_en: 'Enablement and finance for micro and small enterprises in Yemen.'
    }],
    ['fs-tn-sotugar', 'الشركة التونسية للضمان', 'SOTUGAR', 'TN', 'https://www.sotugar.com.tn', {
      type: 'government_program', financing_type: 'guarantee',
      description_ar: 'ضمان قروض المؤسسات الصغرى والمتوسطة لدى البنوك التونسية.',
      description_en: 'Credit guarantees for Tunisian SMEs through partner banks.'
    }],
    ['fs-sa-hrdf', 'صندوق تنمية الموارد البشرية — هدف', 'HRDF (Hadaf)', 'SA', 'https://www.hrdf.org.sa', {
      type: 'government_program', financing_type: 'grant',
      description_ar: 'دعم حكومي لتوظيف السعوديين وتدريب الكوادر داخل المنشآت عبر برامج هدف.',
      description_en: 'Government wage and training support for Saudisation inside enterprises via Hadaf programmes.'
    }],
    ['fs-sa-exports', 'هيئة تنمية الصادرات السعودية', 'Saudi Exports', 'SA', 'https://www.saudiexports.sa', {
      type: 'government_program', sector: 'trade', financing_type: 'grant',
      description_ar: 'حوافز مالية وتدريبية لتسجيل المنتجات والمشاركة في المعارض ودعم تصدير المنشآت.',
      description_en: 'Financial and training incentives for product registration, trade fairs and SME export support.'
    }],
    ['fs-ae-nsme', 'البرنامج الوطني للمنشآت الصغيرة والمتوسطة', 'National SME Programme', 'AE', 'https://www.uaesme.ae', {
      type: 'government_program',
      description_ar: 'البرنامج الاتحادي لتمكين المنشآت الإماراتية عبر التمويل والمشتريات الحكومية والتدريب.',
      description_en: 'Federal programme enabling Emirati SMEs through finance, government procurement and training.'
    }],
    ['fs-ae-ruwad', 'مؤسسة الشارقة لدعم الريادة — روّاد', 'Sharjah Ruwad', 'AE', 'https://www.ruwad.ae', {
      type: 'government_program',
      description_ar: 'جهة حكومة الشارقة لدعم وترخيص وتمويل رواد الأعمال والمنشآت الصغيرة.',
      description_en: 'Sharjah government establishment supporting, licensing and financing entrepreneurs and SMEs.'
    }],
    ['fs-qa-dhameen', 'برنامج الضمين — بنك قطر للتنمية', 'QDB Al-Dhameen', 'QA', 'https://www.qdb.qa', {
      type: 'government_program', financing_type: 'guarantee',
      description_ar: 'برنامج ضمان حكومي يسهّل حصول الشركات القطرية على تمويل البنوك.',
      description_en: 'Government guarantee programme helping Qatari companies obtain bank finance.'
    }],
    ['fs-jo-acc', 'مؤسسة الإقراض الزراعي', 'Agricultural Credit Corporation', 'JO', 'https://www.acc.gov.jo', {
      type: 'government_program', sector: 'agriculture,food_manufacturing',
      description_ar: 'مؤسسة حكومية تقدّم قروضاً زراعية للمزارعين والمنشآت الزراعية في الأردن.',
      description_en: 'Government corporation providing farm and agribusiness loans in Jordan.'
    }],
    ['fs-jo-def', 'صندوق التنمية والتشغيل', 'Development and Employment Fund', 'JO', 'https://www.def.gov.jo', {
      type: 'government_program',
      description_ar: 'صندوق حكومي لتمويل المشاريع الصغيرة ومشاريع التشغيل الذاتي في المحافظات.',
      description_en: 'Government fund financing small projects and self-employment across Jordanian governorates.'
    }],
    ['fs-ma-intelaka', 'برنامج انطلاقة', 'Intelaka', 'MA', 'https://www.intelaka.ma', {
      type: 'government_program',
      description_ar: 'برنامج تمويل حكومي ميسر للمقاولات الصغيرة جداً والصغيرة عبر البنوك المغربية.',
      description_en: 'Government concessional finance programme for VSMEs and SMEs through Moroccan banks.'
    }],
    ['fs-dz-angem', 'الوكالة الوطنية لتسيير القرض المصغر', 'ANGEM', 'DZ', 'https://www.angem.dz', {
      type: 'government_program',
      description_ar: 'وكالة حكومية لتمويل المشاريع المصغرة عبر القرض المصغر والتمويل الثلاثي مع البنوك.',
      description_en: 'Government agency financing micro-projects through microcredit and triangular bank finance.'
    }],
    ['fs-dz-fgar', 'صندوق ضمان قروض المؤسسات الصغيرة والمتوسطة', 'FGAR', 'DZ', 'https://www.fgar.dz', {
      type: 'government_program', financing_type: 'guarantee',
      description_ar: 'صندوق حكومي لضمان قروض إنشاء وتوسعة المؤسسات الصغيرة والمتوسطة الجزائرية.',
      description_en: 'Government fund guaranteeing bank loans for Algerian SME creation and expansion.'
    }],
    ['fs-iq-cbi-sme', 'مبادرة البنك المركزي العراقي لتمويل المشاريع', 'CBI SME financing initiative', 'IQ', 'https://cbi.iq', {
      type: 'government_program',
      description_ar: 'مبادرة تمويل حكومية عبر البنك المركزي والبنوك المشاركة لدعم المشاريع الصغيرة والمتوسطة.',
      description_en: 'Central Bank of Iraq initiative channelling SME finance through participating banks.'
    }],
    ['fs-ps-estidama', 'برنامج استدامة — سلطة النقد الفلسطينية', 'PMA Estidama', 'PS', 'https://www.pma.ps', {
      type: 'government_program',
      description_ar: 'برنامج سلطة النقد لتيسير تمويل المنشآت الفلسطينية عبر البنوك بأسعار مدعومة.',
      description_en: 'Palestine Monetary Authority programme easing SME finance through banks on supported terms.'
    }],
    ['fs-ye-sfd', 'الصندوق الاجتماعي للتنمية — اليمن', 'Social Fund for Development Yemen', 'YE', 'https://www.sfd-yemen.org', {
      type: 'government_program',
      description_ar: 'صندوق حكومي يموّل التنمية المحلية والتمويل الأصغر والمشاريع المجتمعية في اليمن.',
      description_en: 'Government fund financing local development, microfinance and community projects in Yemen.'
    }]
  ],
  retiredIds: [
    'fs-eg-audi',
    'fs-eg-aub',
    'fs-jo-eal'
  ],

  regional: [
    ['fs-reg-isdb', 'البنك الإسلامي للتنمية', 'Islamic Development Bank', 'https://www.isdb.org', {
      description_ar: 'بنك تنمية متعدد الأطراف من مجموعة البنك الإسلامي للتنمية يموّل البنية والمشاريع العامة والخاصة بصيغ متوافقة مع الشريعة في 57 دولة عضواً.',
      description_en: 'Multilateral development bank in the IsDB Group financing public and private projects on Sharia-compliant terms in 57 member countries.',
      eligibility_ar: 'حكومات وشركات في الدول الأعضاء، بما فيها الدول العربية الأعضاء في البنك.',
      eligibility_en: 'Governments and companies in member countries, including Arab IsDB members.',
      hq_ar: 'جدة، السعودية',
      hq_en: 'Jeddah, Saudi Arabia',
      presence_ar: '57 دولة عضواً في آسيا وأفريقيا وأوروبا، وتشمل معظم الدول العربية.',
      presence_en: '57 member countries across Asia, Africa and Europe, including most Arab states.',
      offices_ar: 'مراكز إقليمية: جدة، القاهرة، الرباط، أنقرة، أبوجا، ألماتي، داكار، دكا، جاكرتا، كمبالا. مركز تميز في كوالالمبور.',
      offices_en: 'Regional hubs: Jeddah, Cairo, Rabat, Ankara, Abuja, Almaty, Dakar, Dhaka, Jakarta, Kampala. Centre of excellence in Kuala Lumpur.'
    }],
    ['fs-reg-icd', 'المؤسسة الإسلامية لتنمية القطاع الخاص', 'ICD', 'https://icd-ps.org', {
      type: 'fund', financing_type: 'equity',
      description_ar: 'ذراع القطاع الخاص لمجموعة البنك الإسلامي للتنمية: تموّل الشركات عبر مساهمات وتمويل إسلامي وخطوط للبنوك.',
      description_en: 'Private-sector arm of the IsDB Group, financing companies through equity, Islamic finance and lines to banks.',
      eligibility_ar: 'شركات خاصة وبنوك في الدول الأعضاء في مجموعة البنك الإسلامي للتنمية.',
      eligibility_en: 'Private companies and banks in IsDB Group member countries.',
      hq_ar: 'جدة، السعودية',
      hq_en: 'Jeddah, Saudi Arabia',
      presence_ar: 'الدول الأعضاء في مجموعة البنك الإسلامي للتنمية، ومنها الدول العربية الأعضاء.',
      presence_en: 'IsDB Group member countries, including Arab members.',
      offices_ar: 'المقر في جدة، وتعمل عبر شبكة المجموعة في القاهرة والرباط ومكاتب إقليمية أخرى.',
      offices_en: 'Headquarters in Jeddah; operates through the Group network including Cairo, Rabat and other regional hubs.'
    }],
    ['fs-reg-itfc', 'المؤسسة الدولية الإسلامية لتمويل التجارة', 'ITFC', 'https://www.itfc-idb.org', {
      sector: 'trade',
      description_ar: 'تموّل التجارة للدول الأعضاء عبر اعتمادات وخطوط للبنوك وتمويل مباشر للمستوردين والمصدرين.',
      description_en: 'Finances member-country trade through bank lines, credits and direct importer/exporter finance.',
      eligibility_ar: 'بنوك وشركات تجارة في الدول الأعضاء، بما فيها الدول العربية الأعضاء.',
      eligibility_en: 'Banks and trading companies in member countries, including Arab members.',
      hq_ar: 'جدة، السعودية',
      hq_en: 'Jeddah, Saudi Arabia',
      presence_ar: 'دول أعضاء مجموعة البنك الإسلامي للتنمية.',
      presence_en: 'IsDB Group member countries.',
      offices_ar: 'جدة، القاهرة (التجمع الخامس)، الرباط (حي الرياض)، إسطنبول، داكار، دكا، جاكرتا.',
      offices_en: 'Jeddah, Cairo (New Cairo), Rabat (Hay Riad), Istanbul, Dakar, Dhaka, Jakarta.'
    }],
    ['fs-reg-iciec', 'المؤسسة الإسلامية لتأمين الاستثمار وائتمان الصادرات', 'ICIEC', 'https://iciec.isdb.org', {
      financing_type: 'guarantee',
      description_ar: 'تأمّن ائتمان الصادرات والاستثمار ضد المخاطر التجارية والسياسية للدول الأعضاء ومصدّريها.',
      description_en: 'Insures export credit and investment against commercial and political risk for member countries and their exporters.',
      eligibility_ar: 'مصدرون ومستثمرون ومؤسسات مالية في الدول الأعضاء أو المتجهة إليها.',
      eligibility_en: 'Exporters, investors and financial institutions in or into member countries.',
      hq_ar: 'جدة، السعودية',
      hq_en: 'Jeddah, Saudi Arabia',
      presence_ar: 'الدول الأعضاء في المؤسسة، ومنها دول عربية.',
      presence_en: 'ICIEC member countries, including Arab states.',
      offices_ar: 'جدة، الرياض (مركز المملكة)، القاهرة، دبي (الخليج التجاري)، الرباط، إسطنبول، داكار، دكا، جاكرتا، ألماتي.',
      offices_en: 'Jeddah, Riyadh (Kingdom Centre), Cairo, Dubai (Business Bay), Rabat, Istanbul, Dakar, Dhaka, Jakarta, Almaty.'
    }],
    ['fs-reg-afesd', 'الصندوق العربي للإنماء الاقتصادي والاجتماعي', 'Arab Fund for Economic and Social Development', 'https://www.arabfund.org', {
      description_ar: 'مؤسسة مالية عربية تموّل مشاريع البنية والتنمية الاقتصادية والاجتماعية، مع أولوية للمشاريع العربية المشتركة.',
      description_en: 'Arab financial institution financing infrastructure and economic and social development, with priority for joint Arab projects.',
      eligibility_ar: 'حكومات ومشاريع عامة وخاصة في الدول الأعضاء في جامعة الدول العربية.',
      eligibility_en: 'Governments and public or private projects in League of Arab States members.',
      hq_ar: 'الشويخ، الكويت',
      hq_en: 'Shuwaikh, Kuwait',
      presence_ar: 'الدول العربية الأعضاء في الصندوق (دول جامعة الدول العربية).',
      presence_en: 'Arab member states of the Fund (League of Arab States).',
      offices_ar: 'المقر في الشويخ — شارع المطار، الكويت. التمويل يُدار من المقر دون شبكة فروع تجارية.',
      offices_en: 'Headquarters on Airport Street, Shuwaikh, Kuwait. Financing is run from HQ; no retail branch network.'
    }],
    ['fs-reg-amf', 'صندوق النقد العربي', 'Arab Monetary Fund', 'https://www.amf.org.ae', {
      description_ar: 'يموّل موازين مدفوعات الدول العربية ويدعم الإصلاحات النقدية وتطوير الأسواق المالية والتجارة البينية.',
      description_en: 'Finances Arab balance-of-payments needs and supports monetary reform, financial markets and intra-Arab trade.',
      eligibility_ar: 'الدول العربية الأعضاء (22 دولة) ومؤسساتها المالية وفق برامج الصندوق.',
      eligibility_en: 'The 22 Arab member states and their financial institutions, subject to Fund programmes.',
      hq_ar: 'أبوظبي، الإمارات',
      hq_en: 'Abu Dhabi, UAE',
      presence_ar: 'الدول العربية الأعضاء الاثنتان والعشرون.',
      presence_en: 'All 22 Arab member countries.',
      offices_ar: 'المقر في أبوظبي. لا فروع تجارية؛ التعامل مع وزارات المالية والبنوك المركزية.',
      offices_en: 'Headquarters in Abu Dhabi. No retail branches; counterparties are ministries of finance and central banks.'
    }],
    ['fs-reg-agfund', 'أجفند', 'AGFUND', 'https://agfund.org', {
      description_ar: 'مؤسسة تنموية خليجية تموّل برامج التنمية البشرية والتمويل الأصغر، خاصة النساء والأطفال، بالشراكة مع منظمات أممية ومحلية.',
      description_en: 'Gulf development institution funding human-development and microfinance programmes, especially for women and children, with UN and local partners.',
      eligibility_ar: 'برامج ومؤسسات تمويل أصغر وتنمية بشرية في الدول العربية والنامية.',
      eligibility_en: 'Microfinance and human-development programmes in Arab and developing countries.',
      hq_ar: 'الرياض، السعودية',
      hq_en: 'Riyadh, Saudi Arabia',
      presence_ar: 'دول عربية ونامية عبر شركاء محليين، وليس عبر فروع إقراض مباشرة.',
      presence_en: 'Arab and developing countries through local partners, not a direct lending branch network.',
      offices_ar: 'المقر في الرياض.',
      offices_en: 'Headquarters in Riyadh.'
    }],
    ['fs-reg-badea', 'المصرف العربي للتنمية الاقتصادية في أفريقيا', 'BADEA', 'https://www.badea.org', {
      description_ar: 'يموّل التنمية في الدول الأفريقية غير العربية ويدعم التجارة العربية الأفريقية بتمويل من دول الجامعة العربية.',
      description_en: 'Finances development in non-Arab African states and Arab-African trade, funded by League of Arab States members.',
      eligibility_ar: 'مشاريع في أفريقيا غير العربية، وتمويل تجارة يشمل دولاً عربية أفريقية وفق سياسات المصرف.',
      eligibility_en: 'Projects in non-Arab Africa, plus trade finance involving African Arab states under BADEA policies.',
      hq_ar: 'الخرطوم (مقر دائم) — والرياض مقراً مؤقتاً',
      hq_en: 'Khartoum (permanent HQ) — Riyadh as temporary HQ',
      presence_ar: 'دول الجامعة العربية كمساهمين، ودول أفريقيا جنوب الصحراء كمستفيدين أساسيين.',
      presence_en: 'League of Arab States as shareholders; sub-Saharan Africa as core beneficiaries.',
      offices_ar: 'المقر الدائم: شارع عبد الرحمن المهدي، الخرطوم. المقر المؤقت: برج الأميرية، العليا، الرياض.',
      offices_en: 'Permanent HQ: Abdel Rahman El Mahdi Street, Khartoum. Temporary HQ: Al-Amiriya Tower, Olaya, Riyadh.'
    }],
    ['fs-reg-apicorp', 'ابيكورب', 'APICORP', 'https://www.apicorp.org', {
      sector: 'energy,industry',
      description_ar: 'شركة مالية متعددة الأطراف لأوابك تموّل مشاريع الطاقة والصناعة والتجارة المرتبطة بهما في الدول العربية الأعضاء.',
      description_en: 'OAPEC multilateral financier of energy, industry and related trade projects in Arab member states.',
      eligibility_ar: 'مشاريع طاقة وصناعة في الدول العربية الأعضاء في أوابك وشركائها.',
      eligibility_en: 'Energy and industry projects in OAPEC Arab member states and partners.',
      hq_ar: 'الدمام، السعودية',
      hq_en: 'Dammam, Saudi Arabia',
      presence_ar: 'الدول العربية الأعضاء في أوابك (السعودية، الكويت، الإمارات، قطر، العراق، ليبيا، الجزائر، البحرين، مصر، سوريا).',
      presence_en: 'OAPEC Arab members (Saudi Arabia, Kuwait, UAE, Qatar, Iraq, Libya, Algeria, Bahrain, Egypt, Syria).',
      offices_ar: 'المقر في الدمام. ليست شبكة فروع تجزئة.',
      offices_en: 'Headquarters in Dammam. Not a retail branch network.'
    }],
    ['fs-reg-opec', 'صندوق أوبك للتنمية الدولية', 'OPEC Fund', 'https://opecfund.org', {
      description_ar: 'صندوق تنمية متعدد الأطراف يموّل البنية والمشاريع الخاصة في الدول النامية، ومنها دول عربية غير أعضاء في أوبك.',
      description_en: 'Multilateral development fund financing infrastructure and private projects in developing countries, including non-OPEC Arab states.',
      eligibility_ar: 'حكومات وشركات في الدول النامية المؤهلة، بما فيها دول عربية.',
      eligibility_en: 'Governments and companies in eligible developing countries, including Arab states.',
      hq_ar: 'فيينا، النمسا',
      hq_en: 'Vienna, Austria',
      presence_ar: 'دول نامية حول العالم ومنها دول عربية؛ لا فروع تجارية عربية.',
      presence_en: 'Developing countries worldwide, including Arab states; no Arab retail offices.',
      offices_ar: 'المقر في فيينا فقط.',
      offices_en: 'Headquarters in Vienna only.'
    }],
    ['fs-reg-ifc', 'مؤسسة التمويل الدولية', 'IFC', 'https://www.ifc.org', {
      type: 'fund', financing_type: 'equity',
      description_ar: 'ذراع القطاع الخاص لمجموعة البنك الدولي: قروض ومساهمات وضمانات للشركات والبنوك في الأسواق الناشئة.',
      description_en: 'World Bank Group private-sector arm providing loans, equity and guarantees to companies and banks in emerging markets.',
      eligibility_ar: 'شركات خاصة وبنوك في الدول العربية التي تعمل فيها مجموعة البنك الدولي.',
      eligibility_en: 'Private companies and banks in Arab countries where the World Bank Group operates.',
      hq_ar: 'واشنطن، الولايات المتحدة',
      hq_en: 'Washington, D.C., United States',
      presence_ar: 'معظم الدول العربية عبر نوافذ مجموعة البنك الدولي.',
      presence_en: 'Most Arab countries through World Bank Group country windows.',
      offices_ar: 'مركز الشرق الأوسط في القاهرة (أبراج نايل سيتي). حضور قطري عبر مكاتب المجموعة في الرياض والرباط وتونس وعمّان وبيروت ورام الله.',
      offices_en: 'MENA hub in Cairo (Nile City Towers). Country presence via Group offices in Riyadh, Rabat, Tunis, Amman, Beirut and Ramallah.'
    }],
    ['fs-reg-ebrd', 'البنك الأوروبي لإعادة الإعمار والتنمية', 'EBRD', 'https://www.ebrd.com', {
      description_ar: 'يموّل القطاع الخاص والبنية في اقتصادات التحول، ومن بينها مصر والأردن والمغرب وتونس ولبنان وفلسطين.',
      description_en: 'Finances private-sector and infrastructure projects in transition economies, including Egypt, Jordan, Morocco, Tunisia, Lebanon and Palestine.',
      eligibility_ar: 'شركات ومشاريع في دول عمليات البنك، وليست كل الدول العربية ضمن نطاقه.',
      eligibility_en: 'Companies and projects in EBRD countries of operation — not all Arab states are in scope.',
      hq_ar: 'لندن، المملكة المتحدة',
      hq_en: 'London, United Kingdom',
      presence_ar: 'في المنطقة العربية: مصر، الأردن، المغرب، تونس، لبنان، فلسطين. ليس في دول الخليج كدول عمليات كاملة.',
      presence_en: 'In the Arab region: Egypt, Jordan, Morocco, Tunisia, Lebanon, Palestine. GCC states are not full countries of operation.',
      offices_ar: 'مكاتب مقيمة: القاهرة، عمّان، الدار البيضاء، تونس.',
      offices_en: 'Resident offices: Cairo, Amman, Casablanca, Tunis.'
    }],
    ['fs-reg-afrexim', 'أفريكسيم بنك', 'Afreximbank', 'https://www.afreximbank.com', {
      sector: 'trade',
      description_ar: 'بنك تجارة أفريقي يموّل التجارة داخل أفريقيا ومع الخارج، ويشمل الدول العربية الأفريقية الأعضاء.',
      description_en: 'African trade bank financing intra- and extra-African trade, including African Arab member states.',
      eligibility_ar: 'بنوك ومصدّرون ومستوردون في الدول الأفريقية الأعضاء، ومنها مصر والمغرب وتونس والجزائر والسودان وموريتانيا وجيبوتي والصومال وجزر القمر.',
      eligibility_en: 'Banks, exporters and importers in African member states, including Egypt, Morocco, Tunisia, Algeria, Sudan, Mauritania, Djibouti, Somalia and Comoros.',
      hq_ar: 'مصر الجديدة، القاهرة، مصر',
      hq_en: 'Heliopolis, Cairo, Egypt',
      presence_ar: 'دول أفريقيا الأعضاء؛ الدول العربية المشمولة هي الأفريقية منها فقط.',
      presence_en: 'African member states; covered Arab states are the African ones only.',
      offices_ar: 'المقر: 72 شارع المعهد الاشتراكي، مصر الجديدة، القاهرة. مكاتب إقليمية: أبوجا، هراري، أبيدجان، كمبالا، ياوندي، بربادوس.',
      offices_en: 'HQ: 72 El-Maahad El-Eshteraky Street, Heliopolis, Cairo. Regional offices: Abuja, Harare, Abidjan, Kampala, Yaoundé, Barbados.'
    }],
    ['fs-reg-eib', 'بنك الاستثمار الأوروبي', 'European Investment Bank', 'https://www.eib.org', {
      description_ar: 'ذراع الإقراض للاتحاد الأوروبي يموّل مشاريع في دول الجوار الجنوبي العربية المتوسطية إضافة إلى عملياته الأوروبية.',
      description_en: 'EU lending arm financing projects in the southern neighbourhood, including Mediterranean Arab states, plus its EU operations.',
      eligibility_ar: 'مشاريع في مصر والأردن والمغرب وتونس ولبنان وفلسطين وفق تفويض الجوار، وليست كل الدول العربية.',
      eligibility_en: 'Projects in Egypt, Jordan, Morocco, Tunisia, Lebanon and Palestine under the neighbourhood mandate — not all Arab states.',
      hq_ar: 'لوكسمبورغ',
      hq_en: 'Luxembourg',
      presence_ar: 'في المنطقة العربية: دول الجوار الجنوبي المتوسطي (مصر، الأردن، المغرب، تونس، لبنان، فلسطين).',
      presence_en: 'In the Arab region: southern Mediterranean neighbours (Egypt, Jordan, Morocco, Tunisia, Lebanon, Palestine).',
      offices_ar: 'المقر في لوكسمبورغ. مكتب خارجي للمنطقة في القاهرة.',
      offices_en: 'Headquarters in Luxembourg. External office for the region in Cairo.'
    }],
    ['fs-reg-dhaman', 'المؤسسة العربية لضمان الاستثمار وائتمان الصادرات', 'Dhaman', 'https://www.dhaman.org', {
      financing_type: 'guarantee',
      description_ar: 'مؤسسة عربية متعددة الأطراف تؤمّن الاستثمار ضد المخاطر السياسية وائتمان الصادرات ضد المخاطر التجارية في الدول العربية.',
      description_en: 'Multilateral Arab insurer of investment against political risk and export credit against commercial risk in Arab states.',
      eligibility_ar: 'مستثمرون ومصدّرون ومؤسسات مالية في الدول العربية الأعضاء أو المتجهة إليها.',
      eligibility_en: 'Investors, exporters and financial institutions in or into Arab member countries.',
      hq_ar: 'الصفاة، الكويت',
      hq_en: 'Safat, Kuwait',
      presence_ar: 'الدول العربية الأعضاء في المؤسسة.',
      presence_en: 'Arab member countries of the corporation.',
      offices_ar: 'المقر في الكويت. مكتب إقليمي في الرياض.',
      offices_en: 'Headquarters in Kuwait. Regional office in Riyadh.'
    }],
    ['fs-reg-atfp', 'برنامج تمويل التجارة العربية', 'Arab Trade Finance Program', 'https://atfp.org.ae', {
      sector: 'trade',
      description_ar: 'برنامج مشترك لصندوق النقد العربي والصندوق العربي يموّل التجارة العربية البينية عبر خطوط للبنوك المعتمدة.',
      description_en: 'Joint AMF–Arab Fund programme financing intra-Arab trade through lines to accredited banks.',
      eligibility_ar: 'بنوك معتمدة ومصدّرون/مستوردون عرب لسلع ذات منشأ عربي.',
      eligibility_en: 'Accredited banks and Arab exporters/importers of goods of Arab origin.',
      hq_ar: 'أبوظبي، الإمارات',
      hq_en: 'Abu Dhabi, UAE',
      presence_ar: 'الدول العربية عبر البنوك المساهمة والمعتمدة، وليس عبر فروع للأفراد.',
      presence_en: 'Arab countries through shareholder and accredited banks, not a retail branch network.',
      offices_ar: 'المقر في أبوظبي.',
      offices_en: 'Headquarters in Abu Dhabi.'
    }],
    ['fs-reg-aaaid', 'الهيئة العربية للاستثمار والإنماء الزراعي', 'AAAID', 'https://www.aaaid.org', {
      sector: 'agriculture,food_manufacturing', financing_type: 'equity',
      description_ar: 'هيئة عربية تستثمر في الشركات والمشاريع الزراعية والغذائية لتعزيز الأمن الغذائي في الدول المساهمة.',
      description_en: 'Arab authority investing in agribusiness companies and projects to strengthen food security in shareholder states.',
      eligibility_ar: 'مشاريع زراعية وغذائية في الدول العربية المساهمة (19 دولة).',
      eligibility_en: 'Agricultural and food projects in the 19 Arab shareholder states.',
      hq_ar: 'الخرطوم، السودان',
      hq_en: 'Khartoum, Sudan',
      presence_ar: 'الدول العربية المساهمة؛ الاستثمارات في مزارع وشركات داخل تلك الدول.',
      presence_en: 'Arab shareholder states; investments sit in farms and companies inside those countries.',
      offices_ar: 'المقر في الخرطوم. مكتب في دبي (الروية).',
      offices_en: 'Headquarters in Khartoum. Office in Dubai (Al Rowaiyah).'
    }],
    ['fs-reg-wb', 'البنك الدولي', 'World Bank', 'https://www.worldbank.org', {
      description_ar: 'يموّل الحكومات ومشاريع التنمية، ويموّل القطاع الخاص عبر مؤسسات المجموعة، من خلال مكاتب قطرية في عواصم عربية.',
      description_en: 'Finances governments and development projects, and the private sector through Group institutions, via country offices in Arab capitals.',
      eligibility_ar: 'حكومات ومشاريع وفق نافذة كل دولة عربية تتعامل مع البنك.',
      eligibility_en: 'Governments and projects under each Arab country window that works with the Bank.',
      hq_ar: 'واشنطن، الولايات المتحدة',
      hq_en: 'Washington, D.C., United States',
      presence_ar: 'معظم الدول العربية عبر مكاتب أو برامج قطرية.',
      presence_en: 'Most Arab countries through country offices or programmes.',
      offices_ar: 'مكاتب قطرية مؤكدة تشمل: القاهرة، الرياض، الرباط، تونس، عمّان، بيروت، رام الله، الكويت.',
      offices_en: 'Confirmed country offices include Cairo, Riyadh, Rabat, Tunis, Amman, Beirut, Ramallah and Kuwait.'
    }],
    ['fs-reg-afdb', 'البنك الأفريقي للتنمية', 'African Development Bank', 'https://www.afdb.org', {
      description_ar: 'يموّل التنمية والقطاع الخاص في الدول الأفريقية الأعضاء، ومنها الدول العربية في أفريقيا.',
      description_en: 'Finances development and the private sector in African member countries, including African Arab states.',
      eligibility_ar: 'حكومات وشركات في الدول الأفريقية الأعضاء: مصر، المغرب، تونس، الجزائر، السودان، موريتانيا، جيبوتي، الصومال، جزر القمر.',
      eligibility_en: 'Governments and companies in African members: Egypt, Morocco, Tunisia, Algeria, Sudan, Mauritania, Djibouti, Somalia, Comoros.',
      hq_ar: 'أبيدجان، كوت ديفوار',
      hq_en: 'Abidjan, Côte d’Ivoire',
      presence_ar: 'الدول الأفريقية الأعضاء فقط؛ دول الخليج والمشرق غير الأفريقية خارج نطاق الإقراض الاعتيادي.',
      presence_en: 'African member states only; non-African Gulf and Levant states are outside ordinary lending.',
      offices_ar: 'مكتب مصر في القاهرة (المعادي الجديدة). حضور شمال أفريقيا عبر مكاتب الرباط وتونس.',
      offices_en: 'Egypt country office in Cairo (New Maadi). North Africa presence via Rabat and Tunis offices.'
    }],
    ['fs-reg-isfd', 'صندوق التضامن الإسلامي للتنمية', 'Islamic Solidarity Fund for Development', 'https://isfd.isdb.org', {
      description_ar: 'صندوق مكافحة الفقر داخل مجموعة البنك الإسلامي للتنمية يقدّم تمويلاً ميسّراً وبرامج تنمية بشرية في الدول الأعضاء الأشد حاجة.',
      description_en: 'Poverty-reduction fund of the IsDB Group providing concessional finance and human-development programmes in the neediest member countries.',
      eligibility_ar: 'دول أعضاء منخفضة الدخل وبرامج مكافحة الفقر عبر نافذة البنك الإسلامي للتنمية.',
      eligibility_en: 'Low-income member countries and poverty programmes through the IsDB window.',
      hq_ar: 'جدة، السعودية',
      hq_en: 'Jeddah, Saudi Arabia',
      presence_ar: 'الدول الأعضاء الأشد حاجة في مجموعة البنك الإسلامي للتنمية، ومنها دول عربية منخفضة الدخل.',
      presence_en: 'The neediest IsDB Group members, including low-income Arab states.',
      offices_ar: 'يُدار من مقر المجموعة في جدة وليس له فروع مستقلة.',
      offices_en: 'Administered from the Group headquarters in Jeddah; no separate branch network.'
    }]
  ]
};
