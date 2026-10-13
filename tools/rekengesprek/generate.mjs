#!/usr/bin/env node
/**
 * Generates two small QTI 3 packages with the same mini-lesson (½ + ¼ in four steps), taken from the
 * Leercheck Breuken "Rekengesprek" demo. They show two ways to make a test adaptive:
 *
 *   public/rekengesprek          adaptivity in the TEST: every question is its own item,
 *                                qti-branch-rule skips "even dieper kijken" when a step is solved straight away
 *   public/rekengesprek-adaptief adaptivity in the ITEM: every step is one adaptive="true" item that
 *                                walks through main question -> even dieper kijken -> retry by itself
 *
 * Texts are copied from the demo's RG_STAPPEN so the feedback matches 1:1.
 *
 *   node tools/rekengesprek/generate.mjs
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_TEST = join(root, 'public/rekengesprek');
const OUT_ITEM = join(root, 'public/rekengesprek-adaptief');

// ---------------------------------------------------------------- helpers
const fr = (t, n) => `<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mn>${t}</mn><mn>${n}</mn></mfrac></math>`;
const img = (file, alt) => `<p><img src="resources/${file}" alt="${alt}" /></p>`;
const label = (text, sub) => `<p class="qti-well"><strong>${text}</strong>${sub ? ` · ${sub}` : ''}</p>`;
const bv = (type, value) => `<qti-base-value base-type="${type}">${value}</qti-base-value>`;
const v = id => `<qti-variable identifier="${id}" />`;
const set = (id, type, value) => `<qti-set-outcome-value identifier="${id}">${bv(type, value)}</qti-set-outcome-value>`;
const setFb = value => set('FEEDBACK', 'identifier', value);
const setFbs = (...values) => `<qti-set-outcome-value identifier="FEEDBACK"><qti-multiple>${values.map(x => bv('identifier', x)).join('')}</qti-multiple></qti-set-outcome-value>`;
const memberOf = (id, values) => `<qti-member>${v(id)}<qti-multiple>${values.map(x => bv('identifier', x)).join('')}</qti-multiple></qti-member>`;
const matchCorrect = id => `<qti-match>${v(id)}<qti-correct identifier="${id}" /></qti-match>`;
const fbBlock = (identifier, cls, html) =>
  `<qti-feedback-block identifier="${identifier}" outcome-identifier="FEEDBACK" show-hide="show" class="${cls}">
      <qti-content-body>${html}</qti-content-body>
    </qti-feedback-block>`;
const p = html => `<p>${html}</p>`;
const letter = i => String.fromCharCode(65 + i);
const choices = (opts, indent) => opts.map((o, i) => `<qti-simple-choice identifier="${letter(i)}">${o}</qti-simple-choice>`).join(`\n${indent}`);
const responseDecl = (id, ans) => `<qti-response-declaration identifier="${id}" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>${letter(ans)}</qti-value></qti-correct-response>
  </qti-response-declaration>`;

const scoreDecls = `<qti-outcome-declaration identifier="SCORE" base-type="float" cardinality="single">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-outcome-declaration identifier="MAXSCORE" base-type="float" cardinality="single">
    <qti-default-value><qti-value>1</qti-value></qti-default-value>
  </qti-outcome-declaration>`;

const item = ({ id, title, adaptive = false, declarations, body, processing }) => `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqtiasi_v3p0 https://purl.imsglobal.org/spec/qti/v3p0/schema/xsd/imsqti_asiv3p0_v1p0.xsd"
  identifier="${id}" title="${title}" adaptive="${adaptive}" time-dependent="false" xml:lang="nl-NL">
  ${declarations}
  <qti-item-body>
    ${body}
  </qti-item-body>
  <qti-response-processing>
    ${processing}
  </qti-response-processing>
</qti-assessment-item>
`;

/**
 * Multiple choice question with one correct answer.
 * Feedback: GOED / GOED_ALT (an also-accepted answer with its own message) / FOUT.
 */
function choiceItem({ id, title, heading, sub, prompt, fig, opts, ans, alsoOk = [], ok, okAlt, fout }) {
  const alt = alsoOk.map(letter);
  const processing = `<qti-response-condition>
      <qti-response-if>
        ${matchCorrect('RESPONSE')}
        ${set('SCORE', 'float', 1)}
        ${setFb('GOED')}
      </qti-response-if>${alt
        .map(
          a => `
      <qti-response-else-if>
        <qti-match>${v('RESPONSE')}${bv('identifier', a)}</qti-match>
        ${set('SCORE', 'float', 1)}
        ${setFb('GOED_ALT')}
      </qti-response-else-if>`
        )
        .join('')}
      <qti-response-else>
        ${setFb('FOUT')}
      </qti-response-else>
    </qti-response-condition>`;
  return item({
    id,
    title,
    declarations: `${responseDecl('RESPONSE', ans)}
  ${scoreDecls}
  <qti-outcome-declaration identifier="FEEDBACK" base-type="identifier" cardinality="single" />`,
    body: `${label(heading, sub)}
    ${fig ?? ''}
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1" min-choices="1">
      <qti-prompt>${prompt}</qti-prompt>
      ${choices(opts, '      ')}
    </qti-choice-interaction>
    ${fbBlock('GOED', 'qti-feedback-correct', p(ok))}
    ${okAlt ? fbBlock('GOED_ALT', 'qti-feedback-correct', p(okAlt)) : ''}
    ${fbBlock('FOUT', 'qti-feedback-incorrect', p(fout))}`,
    processing
  });
}

// ---------------------------------------------------------------- figures (port of the demo's strookC)
const C_HALF = '#7cd3ea', C_KWART = '#f6b93b', C_SOM = '#84ee4f', C_GRIJS = '#dfe3e7';
const strookRow = (y, lbl, colors) => {
  const w = 240, h = 34, cell = w / colors.length;
  const cells = colors
    .map((c, i) => `<rect x="${(90 + i * cell).toFixed(1)}" y="${y}" width="${cell.toFixed(1)}" height="${h}" fill="${c || '#fff'}" stroke="#7a8794" stroke-width="1.5"/>`)
    .join('');
  return `<text x="80" y="${y + 23}" text-anchor="end" font-family="sans-serif" font-size="16" fill="#1f2a37">${lbl}</text>${cells}`;
};
const strook = (n, d, color) => Array.from({ length: d }, (_, i) => (i < n ? color : null));
const figure = rows => {
  const height = rows.length * 46 + 4;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="${height}" viewBox="0 0 340 ${height}">${rows
    .map((r, i) => strookRow(4 + i * 46, r.label, r.colors))
    .join('')}</svg>\n`;
};
const FIGURES = {
  'noemer.svg': [{ label: 'halven', colors: strook(2, 2, C_GRIJS) }, { label: 'kwarten', colors: strook(4, 4, C_GRIJS) }],
  'omzetten.svg': [{ label: '1/2', colors: strook(1, 2, C_HALF) }, { label: '2/4', colors: strook(2, 4, C_HALF) }],
  'optellen.svg': [
    { label: '2/4', colors: strook(2, 4, C_HALF) },
    { label: '1/4', colors: strook(1, 4, C_KWART) },
    { label: '3/4', colors: [C_HALF, C_HALF, C_KWART, null] }
  ],
  'controle.svg': [{ label: '3/4', colors: strook(3, 4, C_SOM) }, { label: '1 hele', colors: strook(4, 4, C_GRIJS) }]
};
const FIG = {
  NOEMER: img('noemer.svg', 'Een strook in halven en een strook in kwarten'),
  OMZETTEN: img('omzetten.svg', 'Een halve is evenveel als twee kwarten'),
  OPTELLEN: img('optellen.svg', 'Twee kwarten plus een kwart is drie kwarten'),
  CONTROLE: img('controle.svg', 'Drie kwart naast een hele strook')
};

// The sum as a picture, for the hotspot items: ½ + ¼ = ?  (numerators at y 30-90, denominators at y 110-170)
const SOM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200" font-family="sans-serif" font-size="56" fill="#1f2a37" text-anchor="middle">
<text x="80" y="80">1</text><line x1="50" y1="100" x2="110" y2="100" stroke="#1f2a37" stroke-width="5"/><text x="80" y="160">2</text>
<text x="160" y="120">+</text>
<text x="240" y="80">1</text><line x1="210" y1="100" x2="270" y2="100" stroke="#1f2a37" stroke-width="5"/><text x="240" y="160">4</text>
<text x="320" y="120">=</text><text x="370" y="120">?</text>
</svg>
`;
const HOTSPOTS = { A_T: '50,30,110,92', A_N: '50,108,110,172', B_T: '210,30,270,92', B_N: '210,108,270,172' };

function hotspotItem({ id, title, prompt, ans, ok, fout }) {
  return item({
    id,
    title,
    declarations: `<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>${ans}</qti-value></qti-correct-response>
  </qti-response-declaration>
  ${scoreDecls}
  <qti-outcome-declaration identifier="FEEDBACK" base-type="identifier" cardinality="single" />`,
    body: `${label('Verkennen', 'de som lezen')}
    <qti-hotspot-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-prompt>${prompt}</qti-prompt>
      <img src="resources/som.svg" width="400" height="200" alt="De som: een half plus een kwart is vraagteken" />
      ${Object.entries(HOTSPOTS)
        .map(([hid, coords]) => `<qti-hotspot-choice identifier="${hid}" shape="rect" coords="${coords}" aria-label="${hid.endsWith('T') ? 'teller' : 'noemer'} van ${hid.startsWith('A') ? 'een half' : 'een kwart'}" />`)
        .join('\n      ')}
    </qti-hotspot-interaction>
    ${fbBlock('GOED', 'qti-feedback-correct', p(ok))}
    ${fbBlock('FOUT', 'qti-feedback-hint', p(fout))}`,
    processing: `<qti-response-condition>
      <qti-response-if>
        ${matchCorrect('RESPONSE')}
        ${set('SCORE', 'float', 1)}
        ${setFb('GOED')}
      </qti-response-if>
      <qti-response-else>
        ${setFb('FOUT')}
      </qti-response-else>
    </qti-response-condition>`
  });
}

// ---------------------------------------------------------------- intro: rekendagboek + teller/noemer (in both demos)
const MOODS = [['BLIJ', '😄', 'Blij'], ['OKE', '🙂', 'Oké'], ['TWIJFEL', '😐', 'Twijfel'], ['SPANNEND', '😳', 'Spannend'], ['ZWAAR', '😫', 'Zwaar']];
const BEGELEID_MOODS = ['TWIJFEL', 'SPANNEND', 'ZWAAR'];
const KAARTJES = ['Ik durf hulp te vragen', 'Ik geef snel op', 'Ik vind breuken lastig', 'Ik werk graag met tekeningen', 'Ik reken graag uit mijn hoofd', 'Ik word onrustig van de timer'];

// MODE = BEGELEID for a learner who feels unsure; the test-adaptive demo uses it to show the tussenvragen.
const DAGBOEK = item({
  id: 'DAGBOEK',
  title: 'Mijn rekendagboek',
  declarations: `<qti-response-declaration identifier="GEVOEL" cardinality="single" base-type="identifier" />
  <qti-response-declaration identifier="VERTROUWEN" cardinality="single" base-type="integer">
    <qti-default-value><qti-value>3</qti-value></qti-default-value>
  </qti-response-declaration>
  <qti-response-declaration identifier="KAARTJES" cardinality="multiple" base-type="identifier" />
  <qti-outcome-declaration identifier="FEEDBACK" base-type="identifier" cardinality="single" />
  <qti-outcome-declaration identifier="MODE" base-type="identifier" cardinality="single">
    <qti-default-value><qti-value>ZELFSTANDIG</qti-value></qti-default-value>
  </qti-outcome-declaration>`,
  body: `${label('📓 Mijn rekendagboek')}
    <qti-choice-interaction response-identifier="GEVOEL" max-choices="1" min-choices="1" class="qti-orientation-horizontal">
      <qti-prompt>Voordat we gaan rekenen: hoe voel jij je vandaag bij rekenen?</qti-prompt>
      ${MOODS.map(([mid, emoji, txt]) => `<qti-simple-choice identifier="${mid}">${emoji} ${txt}</qti-simple-choice>`).join('\n      ')}
    </qti-choice-interaction>
    <qti-slider-interaction response-identifier="VERTROUWEN" lower-bound="1" upper-bound="5" step="1" step-label="true">
      <qti-prompt>Hoeveel vertrouwen heb je in breuken? (1 = nog onzeker, 5 = heel zeker)</qti-prompt>
    </qti-slider-interaction>
    <qti-choice-interaction response-identifier="KAARTJES" max-choices="0" min-choices="0">
      <qti-prompt>Welke kaartjes passen bij jou?</qti-prompt>
      ${KAARTJES.map((k, i) => `<qti-simple-choice identifier="K${i + 1}">${k}</qti-simple-choice>`).join('\n      ')}
    </qti-choice-interaction>
    ${fbBlock('DANK', 'qti-feedback-correct', p('Dank je wel! Dan gaan we nu samen rekenen.'))}`,
  processing: `${setFb('DANK')}
    <qti-response-condition>
      <qti-response-if>
        ${memberOf('GEVOEL', BEGELEID_MOODS)}
        ${set('MODE', 'identifier', 'BEGELEID')}
      </qti-response-if>
    </qti-response-condition>`
});

const TELLER = hotspotItem({
  id: 'TELLER',
  title: 'Teller aanwijzen',
  prompt: `Kijk goed naar de som. Klik op de <strong>teller</strong> van ${fr(1, 2)}.`,
  ans: 'A_T',
  ok: 'Ja! De teller staat bóven de streep en vertelt hoeveel stukjes je hebt: 1 stukje.',
  fout: 'Dat is hem niet. De teller staat <strong>bóven</strong> de breukstreep. Probeer het nog eens.'
});
const NOEMER = hotspotItem({
  id: 'NOEMER',
  title: 'Noemer aanwijzen',
  prompt: `Klik nu op de <strong>noemer</strong> van ${fr(1, 4)}.`,
  ans: 'B_N',
  ok: 'Precies! De noemer staat onder de streep en vertelt hoe groot de stukjes zijn: kwarten.',
  fout: 'Dat is hem niet. De noemer staat <strong>onder</strong> de breukstreep. Probeer het nog eens.'
});

const NO_SKIP = '<qti-item-session-control max-attempts="1" show-feedback="true" allow-skipping="false" />';
const UNLIMITED = '<qti-item-session-control max-attempts="0" show-feedback="true" />';
const ref = (id, inner = [], category) => {
  const open = `<qti-assessment-item-ref identifier="${id}" href="${id}.xml"${category ? ` category="${category}"` : ''}`;
  return inner.length ? `${open}>\n        ${inner.join('\n        ')}\n      </qti-assessment-item-ref>` : `${open} />`;
};
const introItems = [{ id: 'DAGBOEK', xml: DAGBOEK }, { id: 'TELLER', xml: TELLER }, { id: 'NOEMER', xml: NOEMER }];
const introRefs = [ref('DAGBOEK', [NO_SKIP], 'unscored'), ref('TELLER', [UNLIMITED]), ref('NOEMER', [UNLIMITED])];

// ---------------------------------------------------------------- the four steps (RG_STAPPEN)
// Every step: (tussenvraag, guided learners only) -> main question; wrong -> "even dieper kijken" -> retry -> uitleg.
const STAPPEN = [
  {
    key: 'S1', titel: 'Gelijknamig maken',
    tussen: { q: 'Kijk eerst naar de noemers: 2 en 4. Zijn die gelijk?', opts: ['Ja', 'Nee'], ans: 1,
      ok: 'Klopt, 2 en 4 zijn verschillend. Daarom zoeken we eerst een noemer die voor allebei werkt.',
      fout: 'Kijk nog eens goed: onder de streep staat bij de ene breuk een 2 en bij de andere een 4. Die zijn niet gelijk, dus zoeken we eerst een noemer die voor allebei werkt.' },
    main: { q: `Welke noemer kun je voor ${fr(1, 2)} én ${fr(1, 4)} gebruiken?`, opts: ['4', '6', '8'], ans: 0, alsoOk: [2],
      ok: 'Ja! 4 zit in de tafel van 2 én in de tafel van 4. Dus 4 kun je voor allebei gebruiken.',
      okAlt: '8 kan ook: 8 zit in de tafel van 2 én van 4. Maar 4 is de kleinste, en daarmee blijft de som het makkelijkst. We rekenen verder met 4.' },
    verdieping: [
      { q: 'Even terug: hoeveel halven passen er in 1 hele?', opts: ['2', '3', '4'], ans: 0, note: '1 hele = 2 halven.', fig: FIG.NOEMER },
      { q: 'Is 4 een veelvoud van 2? Kijk naar de tafel van 2: 2, 4, 6, 8…', opts: ['Ja', 'Nee'], ans: 0, note: "4 zit in de tafel van 2 én in de tafel van 4. Zo'n getal kun je als noemer voor allebei gebruiken." }
    ],
    uitleg: 'Zoek een getal dat in de tafel van 2 én in de tafel van 4 zit. Het kleinste is <strong>4</strong>. (8 kan ook, maar dan wordt het rekenen lastiger; 6 zit niet in de tafel van 4.)'
  },
  {
    key: 'S2', titel: `${fr(1, 2)} omzetten`, titelTxt: '1/2 omzetten',
    tussen: { q: 'Van noemer 2 naar noemer 4: wat doe je met de 2?', opts: ['Keer 2', 'Keer 3', 'Plus 2'], ans: 0,
      ok: 'Precies: 2 × 2 = 4. En wat je met de noemer doet, doe je ook met de teller.',
      fout: 'Van 2 naar 4 is keer 2 (2 × 2 = 4). En wat je met de noemer doet, doe je straks ook met de teller.' },
    main: { q: `Hoeveel is ${fr(1, 2)} met noemer 4?`, opts: [fr(1, 4), fr(2, 4), fr(3, 4)], ans: 1,
      ok: `Ja! Teller én noemer keer 2: ${fr(1, 2)} = ${fr(2, 4)}. De breuk blijft evenveel waard.` },
    verdieping: [
      { q: 'Kijk naar de stroken. Hoeveel kwarten passen er in een halve?', opts: ['1', '2', '3'], ans: 1, note: 'Een halve is evenveel als 2 kwarten.', fig: FIG.OMZETTEN },
      { q: 'Van 2 naar 4 is keer 2. Wat doe je dan met de teller 1?', opts: ['Ook keer 2', 'Niets', 'Plus 2'], ans: 0, note: 'Teller én noemer keer hetzelfde getal: dan blijft de breuk evenveel waard.' }
    ],
    uitleg: `Teller en noemer allebei keer 2: ${fr(1, 2)} = ${fr(2, 4)}. Kijk maar naar de strook: een halve is precies 2 kwarten.`
  },
  {
    key: 'S3', titel: 'Optellen',
    tussen: { q: 'Welke som reken je nu uit?', opts: [`${fr(2, 4)} + ${fr(1, 4)}`, `${fr(1, 2)} + ${fr(1, 4)}`, `${fr(2, 4)} + ${fr(2, 4)}`], ans: 0,
      ok: 'Ja: de som is nu gelijknamig, met noemer 4 bij allebei.',
      fout: `We hebben ${fr(1, 2)} net omgezet naar ${fr(2, 4)}. De som is dus ${fr(2, 4)} + ${fr(1, 4)}: allebei kwarten.` },
    main: { q: `Hoeveel is ${fr(2, 4)} + ${fr(1, 4)}?`, opts: [fr(3, 8), fr(3, 4), fr(2, 8)], ans: 1,
      ok: 'Goed zo! 2 kwarten + 1 kwart = 3 kwarten. De noemer blijft 4.' },
    verdieping: [
      { q: 'Wat gebeurt er met de noemer als je gelijknamige breuken optelt?', opts: ['Die blijft hetzelfde', 'Die tel je op', 'Die verdubbelt'], ans: 0, note: 'De stukjes blijven even groot, dus de noemer verandert niet.' },
      { q: '2 vierde + 1 vierde = hoeveel vierden?', opts: ['2', '3', '4'], ans: 1, note: `2 stukjes + 1 stukje = 3 stukjes van een kwart: ${fr(3, 4)}.`, fig: FIG.OPTELLEN }
    ],
    uitleg: `Bij gelijknamige breuken tel je alleen de tellers op: 2 + 1 = 3. De noemer blijft 4, want de stukjes blijven kwarten. Dus ${fr(3, 4)}.`
  },
  {
    key: 'S4', titel: 'Antwoord controleren',
    tussen: { q: 'Is er een getal groter dan 1 waar je 3 én 4 allebei door kunt delen?', opts: ['Ja', 'Nee'], ans: 1,
      ok: 'Klopt: 3 en 4 hebben geen gemeenschappelijke deler. Dan kun je de breuk niet vereenvoudigen.',
      fout: 'Probeer maar: 2 past niet in 3, en 3 past niet in 4. Er is geen getal waar je allebei door kunt delen.' },
    main: { q: `Kun je ${fr(3, 4)} nog verder vereenvoudigen?`, opts: [`Nee, ${fr(3, 4)} is al het eenvoudigst`, `Ja, dat wordt ${fr(1, 2)}`, `Ja, dat wordt ${fr(6, 8)}`], ans: 0,
      ok: 'Precies! 3 en 4 kun je niet allebei door hetzelfde getal delen. Het antwoord is klaar: Sam en Noor hebben samen ¾ meter lint.' },
    verdieping: [
      { q: `Is ${fr(3, 4)} meer of minder dan 1 hele?`, opts: ['Minder', 'Meer', 'Precies 1'], ans: 0, note: '3 van de 4 stukjes: dat is minder dan 1 hele. Logisch: een halve meter en een kwart meter is samen minder dan een meter.', fig: FIG.CONTROLE }
    ],
    uitleg: `${fr(3, 4)} is al zo eenvoudig mogelijk: 3 en 4 kun je niet allebei door hetzelfde getal delen. (${fr(6, 8)} is evenveel, maar niet eenvoudiger; ${fr(1, 2)} is minder dan ${fr(3, 4)}.)`
  }
];
const heading = (st, k) => `Stap ${k + 1} · ${st.titel}`;
const plainTitle = (st, k) => `Stap ${k + 1} · ${st.titelTxt ?? st.titel}`;
const TERUG = 'We gaan even een stapje terug om te kijken waar het spaak loopt.';
const goedeAntwoord = st => `<strong>Het goede antwoord is: ${st.main.opts[st.main.ans]}.</strong> ${st.uitleg}`;

// ---------------------------------------------------------------- shared test parts
const testXml = ({ identifier, title, comment, refs, mainScores }) => `<?xml version="1.0" encoding="UTF-8"?>
<!--
${comment}
  Generated by tools/rekengesprek/generate.mjs.
-->
<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqtiasi_v3p0 https://purl.imsglobal.org/spec/qti/v3p0/schema/xsd/imsqti_asiv3p0_v1p0.xsd"
  identifier="${identifier}" title="${title}">
  <qti-outcome-declaration identifier="SCORE" base-type="float" cardinality="single">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-outcome-declaration identifier="MAXSCORE" base-type="float" cardinality="single">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-outcome-declaration identifier="PERCENTAGE" base-type="float" cardinality="single">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-outcome-declaration identifier="DIRECT" base-type="float" cardinality="single">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-outcome-declaration identifier="FEEDBACK" base-type="identifier" cardinality="single" />

  <qti-test-part identifier="GESPREK" navigation-mode="linear" submission-mode="individual">
    <qti-item-session-control max-attempts="1" show-feedback="true" />
    <qti-assessment-section identifier="SOM" title="Samen door één som" visible="true">
      <qti-rubric-block use="instructions" view="candidate" class="qti-rubric-discretionary-placement">
        <qti-content-body>
          <p><strong>De som van dit gesprek:</strong> ${fr(1, 2)} + ${fr(1, 4)} = ?</p>
          <p>Voor de versiering van de klas knipt Sam een halve meter lint af en Noor een kwart meter. Hoeveel meter lint hebben ze samen?</p>
        </qti-content-body>
      </qti-rubric-block>
      ${refs.join('\n      ')}
    </qti-assessment-section>
  </qti-test-part>

  <qti-outcome-processing>
    <qti-set-outcome-value identifier="SCORE">
      <qti-sum><qti-test-variables variable-identifier="SCORE" /></qti-sum>
    </qti-set-outcome-value>
    <qti-set-outcome-value identifier="MAXSCORE">
      <!-- every scored item is worth 1 point: count the items this candidate was shown, so items a branch rule
           or pre-condition passed over do not count against them (the rekendagboek is not scored) -->
      <qti-number-presented exclude-category="unscored" />
    </qti-set-outcome-value>
    <qti-set-outcome-value identifier="PERCENTAGE">
      <qti-product>
        <qti-divide>${v('SCORE')}${v('MAXSCORE')}</qti-divide>
        ${bv('float', 100)}
      </qti-product>
    </qti-set-outcome-value>
    <!-- steps solved straight away, read from the item sessions with the item prefix -->
    <qti-set-outcome-value identifier="DIRECT">
      <qti-sum>${mainScores.map(id => v(`${id}.SCORE`)).join('')}</qti-sum>
    </qti-set-outcome-value>
    <qti-outcome-condition>
      <qti-outcome-if>
        <qti-gte>${v('DIRECT')}${bv('float', 4)}</qti-gte>
        ${setFb('ZELFSTANDIG')}
      </qti-outcome-if>
      <qti-outcome-else-if>
        <qti-gte>${v('DIRECT')}${bv('float', 2)}</qti-gte>
        ${setFb('OP_WEG')}
      </qti-outcome-else-if>
      <qti-outcome-else>
        ${setFb('BEGELEIDING')}
      </qti-outcome-else>
    </qti-outcome-condition>
  </qti-outcome-processing>

  <qti-test-feedback identifier="ZELFSTANDIG" outcome-identifier="FEEDBACK" show-hide="show" access="atEnd">
    <qti-content-body>Alle vier de stappen in één keer goed. Je kunt breuken met verschillende noemers zelfstandig optellen.</qti-content-body>
  </qti-test-feedback>
  <qti-test-feedback identifier="OP_WEG" outcome-identifier="FEEDBACK" show-hide="show" access="atEnd">
    <qti-content-body>Een deel van de stappen ging meteen goed, bij de andere hielp het om even dieper te kijken. Oefen die stappen nog eens met stroken.</qti-content-body>
  </qti-test-feedback>
  <qti-test-feedback identifier="BEGELEIDING" outcome-identifier="FEEDBACK" show-hide="show" access="atEnd">
    <qti-content-body>De meeste stappen gingen nog niet in één keer. Dat is niet erg: we oefenen samen verder met stroken en tekeningen.</qti-content-body>
  </qti-test-feedback>
</qti-assessment-test>
`;

// ---------------------------------------------------------------- 1. adaptivity in the TEST
// Per step: TUSSEN, MAIN, V1 (, V2), RETRY as separate plain items.
// A pre-condition shows TUSSEN only to guided learners (DAGBOEK.MODE); a branch rule on MAIN jumps to the next step when it was right.
const stepItems = STAPPEN.flatMap((st, k) => [
  {
    id: `${st.key}_TUSSEN`,
    xml: choiceItem({ id: `${st.key}_TUSSEN`, title: `${plainTitle(st, k)} · tussenvraag`, heading: heading(st, k), sub: 'tussenvraag', prompt: st.tussen.q, opts: st.tussen.opts, ans: st.tussen.ans, ok: st.tussen.ok, fout: st.tussen.fout })
  },
  {
    id: `${st.key}_MAIN`,
    xml: choiceItem({ id: `${st.key}_MAIN`, title: plainTitle(st, k), heading: heading(st, k), prompt: st.main.q, opts: st.main.opts, ans: st.main.ans, alsoOk: st.main.alsoOk, ok: st.main.ok, okAlt: st.main.okAlt, fout: TERUG })
  },
  ...st.verdieping.map((vd, i) => ({
    id: `${st.key}_V${i + 1}`,
    xml: choiceItem({ id: `${st.key}_V${i + 1}`, title: `${plainTitle(st, k)} · even dieper kijken ${i + 1}`, heading: heading(st, k), sub: `even dieper kijken (${i + 1}/${st.verdieping.length})`, fig: vd.fig, prompt: vd.q, opts: vd.opts, ans: vd.ans, ok: vd.note, fout: `Het goede antwoord is <strong>${vd.opts[vd.ans]}</strong>. ${vd.note}` })
  })),
  {
    id: `${st.key}_RETRY`,
    xml: choiceItem({ id: `${st.key}_RETRY`, title: `${plainTitle(st, k)} · nog een poging`, heading: heading(st, k), sub: 'probeer het nog eens', prompt: st.main.q, opts: st.main.opts, ans: st.main.ans, alsoOk: st.main.alsoOk, ok: st.main.ok, okAlt: st.main.okAlt, fout: goedeAntwoord(st) })
  }
]);

const testItems = [...introItems, ...stepItems];

const stepRefs = stepItems.map(({ id }) => {
  if (id.endsWith('_TUSSEN'))
    return ref(id, [`<qti-pre-condition><qti-match>${v('DAGBOEK.MODE')}${bv('identifier', 'BEGELEID')}</qti-match></qti-pre-condition>`]);
  if (!id.endsWith('_MAIN')) return ref(id);
  // a jump to the next TUSSEN whose pre-condition is false moves on to that step's MAIN
  const k = STAPPEN.findIndex(st => id === `${st.key}_MAIN`);
  const target = STAPPEN[k + 1] ? `${STAPPEN[k + 1].key}_TUSSEN` : 'EXIT_TEST';
  return ref(id, [`<qti-branch-rule target="${target}"><qti-gte>${v(`${id}.SCORE`)}${bv('float', 1)}</qti-gte></qti-branch-rule>`]);
});

const TEST_ADAPTIVE_TEST = testXml({
  identifier: 'rekengesprek-test',
  title: 'Rekengesprek: adaptief via de toets',
  comment: `  Adaptivity in the TEST. Every question is a plain, non-adaptive item.
  - qti-pre-condition on S<n>_TUSSEN: only shown when the rekendagboek set DAGBOEK.MODE = BEGELEID
    (mood twijfel / spannend / zwaar). Conditions read earlier item outcomes with the item prefix.
  - qti-branch-rule on S<n>_MAIN: right -> jump to the next step (last step: EXIT_TEST), skipping
    "even dieper kijken" (S<n>_V*) and the retry (S<n>_RETRY). Wrong -> the next items in order.
  - qti-item-session-control: 1 attempt, unlimited for pointing at teller / noemer.
  Compare public/rekengesprek-adaptief, where the step flow lives inside one adaptive item per step.`,
  refs: [...introRefs, ...stepRefs],
  mainScores: STAPPEN.map(st => `${st.key}_MAIN`)
});

// ---------------------------------------------------------------- 2. adaptivity in the ITEM
// One adaptive item per step. FASE (MAIN -> VERDIEPING -> RETRY) drives which feedback blocks, and so which
// interactions, are shown on the next attempt; completionStatus = completed ends the item.
// Interactions inside qti-feedback-block are allowed for adaptive items only (QTI 3).
function adaptiveItem(st, k) {
  const id = `${st.key}_ADAPTIEF`;
  const goed = [st.main.ans, ...(st.main.alsoOk ?? [])].map(letter);
  const alt = (st.main.alsoOk ?? []).map(letter);
  const vds = st.verdieping.map((vd, i) => ({ ...vd, rid: `R_V${i + 1}` }));
  const altFeedback = alt.length
    ? `
            <qti-response-condition>
              <qti-response-if>
                ${memberOf('RESPONSE', alt)}
                ${setFbs('GOED_ALT')}
              </qti-response-if>
            </qti-response-condition>`
    : '';
  return item({
    id,
    title: `${plainTitle(st, k)} (adaptief item)`,
    adaptive: true,
    declarations: `${responseDecl('RESPONSE', st.main.ans)}
  ${vds.map(vd => responseDecl(vd.rid, vd.ans)).join('\n  ')}
  ${responseDecl('R_RETRY', st.main.ans)}
  ${scoreDecls}
  <qti-outcome-declaration identifier="FEEDBACK" base-type="identifier" cardinality="multiple" />
  <qti-outcome-declaration identifier="FASE" base-type="identifier" cardinality="single">
    <qti-default-value><qti-value>MAIN</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-outcome-declaration identifier="RESULT" base-type="identifier" cardinality="single" />`,
    body: `${label(heading(st, k), 'één adaptief item')}
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-prompt>${st.main.q}</qti-prompt>
      ${choices(st.main.opts, '      ')}
    </qti-choice-interaction>
    ${fbBlock('GOED', 'qti-feedback-correct', p(st.main.ok))}
    ${st.main.okAlt ? fbBlock('GOED_ALT', 'qti-feedback-correct', p(st.main.okAlt)) : ''}
    <qti-feedback-block identifier="VERDIEPING" outcome-identifier="FEEDBACK" show-hide="show" class="qti-feedback-hint">
      <qti-content-body>
        <p>${TERUG} <strong>Even dieper kijken:</strong></p>
        ${vds
          .map(
            vd => `${vd.fig ?? ''}
        <qti-choice-interaction response-identifier="${vd.rid}" max-choices="1">
          <qti-prompt>${vd.q}</qti-prompt>
          ${choices(vd.opts, '          ')}
        </qti-choice-interaction>`
          )
          .join('\n        ')}
      </qti-content-body>
    </qti-feedback-block>
    ${fbBlock('V_UITLEG', 'qti-feedback-info', p(vds.map(vd => vd.note).join(' ')))}
    <qti-feedback-block identifier="RETRY" outcome-identifier="FEEDBACK" show-hide="show" class="qti-feedback-hint">
      <qti-content-body>
        <qti-choice-interaction response-identifier="R_RETRY" max-choices="1">
          <qti-prompt>Probeer het nog eens. ${st.main.q}</qti-prompt>
          ${choices(st.main.opts, '          ')}
        </qti-choice-interaction>
      </qti-content-body>
    </qti-feedback-block>
    ${fbBlock('RETRY_GOED', 'qti-feedback-correct', p(st.main.ok))}
    ${fbBlock('RETRY_FOUT', 'qti-feedback-incorrect', p(goedeAntwoord(st)))}`,
    processing: `<qti-response-condition>
      <!-- attempt 1: the main question -->
      <qti-response-if>
        <qti-match>${v('FASE')}${bv('identifier', 'MAIN')}</qti-match>
        <qti-response-condition>
          <qti-response-if>
            ${memberOf('RESPONSE', goed)}
            ${set('SCORE', 'float', 1)}
            ${set('RESULT', 'identifier', 'DIRECT')}
            ${setFbs('GOED')}${altFeedback}
            ${set('completionStatus', 'identifier', 'completed')}
          </qti-response-if>
          <qti-response-else>
            ${set('FASE', 'identifier', 'VERDIEPING')}
            ${setFbs('VERDIEPING')}
          </qti-response-else>
        </qti-response-condition>
      </qti-response-if>
      <!-- attempt 2: "even dieper kijken", then offer the retry -->
      <qti-response-else-if>
        <qti-match>${v('FASE')}${bv('identifier', 'VERDIEPING')}</qti-match>
        ${set('FASE', 'identifier', 'RETRY')}
        ${setFbs('VERDIEPING', 'V_UITLEG', 'RETRY')}
      </qti-response-else-if>
      <!-- attempt 3: the retry decides -->
      <qti-response-else>
        <qti-response-condition>
          <qti-response-if>
            ${memberOf('R_RETRY', goed)}
            ${set('RESULT', 'identifier', 'VERDIEPING')}
            ${setFbs('RETRY', 'RETRY_GOED')}
          </qti-response-if>
          <qti-response-else>
            ${set('RESULT', 'identifier', 'UITLEG')}
            ${setFbs('RETRY', 'RETRY_FOUT')}
          </qti-response-else>
        </qti-response-condition>
        ${set('completionStatus', 'identifier', 'completed')}
      </qti-response-else>
    </qti-response-condition>`
  });
}

const adaptiveItems = STAPPEN.map((st, k) => ({ id: `${st.key}_ADAPTIEF`, xml: adaptiveItem(st, k) }));
const itemItems = [...introItems, ...adaptiveItems];

const ITEM_ADAPTIVE_TEST = testXml({
  identifier: 'rekengesprek-adaptief',
  title: 'Rekengesprek: adaptief binnen het item',
  comment: `  Adaptivity in the ITEM. One adaptive="true" item per step, in plain linear order; the test has no
  pre-conditions or branch rules. Inside each item the FASE outcome walks main question -> even dieper
  kijken -> retry over several attempts and sets completionStatus = completed at the end. SCORE is 1 only
  when the main question was right straight away, so DIRECT means the same as in public/rekengesprek.
  No tussenvragen: response processing only sees the item's own variables, so an item cannot read
  DAGBOEK.MODE. Choosing per learner which content to show needs the test.`,
  refs: [...introRefs, ...adaptiveItems.map(({ id }) => ref(id))],
  mainScores: adaptiveItems.map(({ id }) => id)
});

// ---------------------------------------------------------------- write
const manifest = (identifier, ids) => `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="${identifier}">
  <metadata>
    <schema>QTI Package</schema>
    <schemaversion>3.0.0</schemaversion>
  </metadata>
  <organizations/>
  <resources>
    <resource identifier="test" type="imsqti_test_xmlv3p0" href="AssessmentTest.xml">
      <file href="AssessmentTest.xml"/>
${ids.map(id => `      <dependency identifierref="${id}"/>`).join('\n')}
    </resource>
${ids.map(id => `    <resource identifier="${id}" type="imsqti_item_xmlv3p0" href="${id}.xml"><file href="${id}.xml"/></resource>`).join('\n')}
  </resources>
</manifest>
`;

const resources = {
  'resources/som.svg': SOM_SVG,
  ...Object.fromEntries(Object.entries(FIGURES).map(([name, rows]) => [`resources/${name}`, figure(rows)]))
};

function writePackage(dir, manifestId, test, items) {
  const files = {
    'imsmanifest.xml': manifest(manifestId, items.map(x => x.id)),
    'AssessmentTest.xml': test,
    'items.json': JSON.stringify(items.map(({ id, xml }) => ({ identifier: id, title: xml.match(/ title="([^"]*)"/)[1] })), null, 2) + '\n',
    ...Object.fromEntries(items.map(({ id, xml }) => [`${id}.xml`, xml])),
    ...resources
  };
  rmSync(dir, { recursive: true, force: true });
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
}

writePackage(OUT_TEST, 'MANIFEST_REKENGESPREK', TEST_ADAPTIVE_TEST, testItems);
writePackage(OUT_ITEM, 'MANIFEST_REKENGESPREK_ADAPTIEF', ITEM_ADAPTIVE_TEST, itemItems);

console.log(`rekengesprek (adaptief via de toets): ${testItems.length} items, rekengesprek-adaptief (adaptief binnen het item): ${itemItems.length} items`);
