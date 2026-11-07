'use strict';

const {
  deterministicResearchAnswer
} = require('../../lib/assistant/universal-orchestrator');

describe('person lookup verified-source boundary', () => {
  test('renders only sources that actually supported the verified identity', () => {
    const result = {
      verified_identity: {
        verification_state: 'VERIFIED',
        supporting_sources: [
          'https://www.britannica.com/biography/Hosni-Mubarak',
          'https://www.presidency.eg/en/%D8%A7%D9%84%D8%B1%D8%A4%D8%B3%D8%A7%D8%A1-%D8%A7%D9%84%D8%B3%D8%A7%D8%A8%D9%82%D9%88%D9%86/%D9%85%D8%AD%D9%85%D8%AF-%D8%AD%D8%B3%D9%86%D9%8A-%D9%85%D8%A8%D8%A7%D8%B1%D9%83/'
        ]
      },
      verification: {
        sources: [
          {
            title:'Hosni Mubarak',
            url:'https://www.britannica.com/biography/Hosni-Mubarak',
            publisher:'britannica.com',
            text:'Hosni Mubarak was an Egyptian military officer and politician.'
          },
          {
            title:'محمد حسني مبارك',
            url:'https://www.presidency.eg/en/%D8%A7%D9%84%D8%B1%D8%A4%D8%B3%D8%A7%D8%A1-%D8%A7%D9%84%D8%B3%D8%A7%D8%A8%D9%82%D9%88%D9%86/%D9%85%D8%AD%D9%85%D8%AF-%D8%AD%D8%B3%D9%86%D9%8A-%D9%85%D8%A8%D8%A7%D8%B1%D9%83/',
            publisher:'presidency.eg',
            text:'محمد حسني مبارك رئيس جمهورية مصر العربية الأسبق.'
          }
        ]
      },
      search: {
        result: {
          results: [
            {
              title:'ياسر طلال الزهراني',
              url:'https://ar.wikipedia.org/wiki/%D9%8A%D8%A7%D8%B3%D8%B1_%D8%B7%D9%84%D8%A7%D9%84_%D8%A7%D9%84%D8%B2%D9%87%D8%B1%D8%A7%D9%86%D9%8A',
              snippet:'ياسر طلال الزهراني مواطن سعودي...'
            }
          ]
        }
      }
    };

    const answer = deterministicResearchAnswer(
      'من هو حسني مبارك؟',
      result,
      { intent:'person_lookup', entity:{ person_entity_frame:buildPersonEntityFrame('حسني مبارك') } }
    );

    expect(answer).toContain('Hosni Mubarak');
    expect(answer).toContain('presidency.eg');
    expect(answer).not.toContain('ياسر طلال الزهراني');
    expect(answer).not.toContain('ar.wikipedia.org');
  });

  test('counts Wikipedia language subdomains as one publisher for person answers', () => {
    const result = {
      verified_identity: {
        verification_state:'VERIFIED',
        supporting_sources:[
          'https://ar.wikipedia.org/wiki/%D8%AD%D8%B3%D9%86%D9%8A_%D9%85%D8%A8%D8%A7%D8%B1%D9%83',
          'https://en.wikipedia.org/wiki/Hosni_Mubarak'
        ]
      },
      verification: {
        sources: [
          {
            title:'حسني مبارك',
            url:'https://ar.wikipedia.org/wiki/%D8%AD%D8%B3%D9%86%D9%8A_%D9%85%D8%A8%D8%A7%D8%B1%D9%83',
            publisher:'wikipedia.org',
            text:'حسني مبارك سياسي وعسكري مصري.'
          },
          {
            title:'Hosni Mubarak',
            url:'https://en.wikipedia.org/wiki/Hosni_Mubarak',
            publisher:'wikipedia.org',
            text:'Hosni Mubarak was an Egyptian politician.'
          }
        ]
      }
    };

    expect(deterministicResearchAnswer(
      'من هو حسني مبارك؟',
      result,
      { intent:'person_lookup', entity:{ person_entity_frame:buildPersonEntityFrame('حسني مبارك') } }
    )).toBe('لم أجد مصادر مستقلة كافية لتقديم تعريف موثق.');
  });
  test('rejects unrelated verified-source rows and raw MediaWiki markup at final answer boundary', () => {
    const plan = {
      intent:'person_lookup',
      entity:{
        person_entity_frame: buildPersonEntityFrame('الدكتور طلال حسن الزهراني')
      }
    };

    const result = {
      verified_identity:{
        verification_state:'VERIFIED',
        supporting_sources:[
          'https://ar.wikipedia.org/wiki/محمد_ولد_الغزواني',
          'https://example.org/other'
        ]
      },
      verification:{
        sources:[
          {
            title:'محمد ولد الغزواني - ويكيبيديا',
            url:'https://ar.wikipedia.org/wiki/محمد_ولد_الغزواني',
            text:'محمد ولد الغزواني - ويكيبيديا {{\"wt\":\"الحاكم\"}} <br> [[2019]]'
          },
          {
            title:'مصدر آخر',
            url:'https://example.org/other',
            text:'محمد ولد الغزواني سياسي موريتاني.'
          }
        ]
      }
    };

    expect(deterministicResearchAnswer(
      'من هو الدكتور طلال حسن الزهراني؟',
      result,
      plan
    )).toBe('لم أجد مصادر مستقلة كافية لتقديم تعريف موثق.');
  });

});
