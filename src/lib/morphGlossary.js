/**
 * Grammar term glossary for the morphology detail popup.
 * Used in KjvReader's word-info strip when the user taps a morphology value.
 *
 * Lookup: getMorphDef(label, value, lang)
 *   label — the row label, e.g. "Stem", "Aspect", "Tense", "Mood"
 *   value — the displayed value, e.g. "Qal", "Perfect", "Indicative"
 *   lang  — 'hebrew' | 'greek'
 */

/* ── Hebrew ──────────────────────────────────────────────────────────── */

const HEB_POS = {
  'Verb':     'A word expressing action or a state of being. Hebrew verbs encode stem (binyan), aspect, person, gender, and number in a single inflected form.',
  'Noun':     'A word naming a person, place, thing, or concept. Hebrew nouns inflect for gender (masculine/feminine), number (singular/plural/dual), and state (absolute/construct/determined).',
  'Adj':      'Adjective — a word that attributes a quality to a noun. It agrees with the noun it modifies in gender and number.',
  'Conj':     'Conjunction — a word connecting clauses or words. The most common is the prefix וְ ("and"), which can carry several nuances depending on context.',
  'Adv':      'Adverb — a word that modifies a verb, adjective, or other adverb, expressing manner, degree, or circumstance.',
  'Prep':     'Preposition — a word showing the spatial, temporal, or logical relationship between a noun and the rest of the clause (e.g. בְּ "in," לְ "to/for," מִן "from").',
  'Pron':     'Pronoun — a word that stands in place of a noun. Hebrew has personal, demonstrative, and relative pronouns.',
  'Suffix':   'Pronominal suffix — a short ending attached to a noun, verb, or preposition to indicate possession ("his," "her," "their") or to mark an object ("him," "them").',
  'Particle': 'An indeclinable function word serving a grammatical role: definite article הַ, negative particle לֹא, the marker of the definite direct object אֵת, interrogative הֲ, etc.',
}

const HEB_STEMS = {
  'Qal':       'The basic, simple active stem — the most common binyan. Expresses the fundamental meaning of the root with no added nuance of intensity or causation (e.g. כָּתַב "he wrote").',
  'Niphal':    'The simple passive or reflexive stem — often the passive of the Qal (e.g. "it was written"), but can also express middle/reflexive action ("he presented himself," "they devoted themselves").',
  'Piel':      'The intensive active stem — intensifies, repeats, or produces the state expressed by the root. Can be factitive (causing a state: "declare righteous") or denominative (deriving from a noun). E.g. דִּבֶּר "he spoke" (intensive of דבר).',
  'Pual':      'The intensive passive stem — the passive counterpart of the Piel. E.g. "was declared righteous," "was intensively done."',
  'Hiphil':    'The causative active stem — the subject causes someone else to perform the Qal action (e.g. "he caused to hear," "he made to see," "he led out"). Often introduces a new actor into the action.',
  'Hophal':    'The causative passive stem — the passive of the Hiphil. The subject is caused to perform the action (e.g. "he was brought," "it was caused to see").',
  'Hithpael':  'The intensive reflexive stem — the subject performs the Piel action upon or for itself. Common for prayer (התפלל "he prayed"), reflexive action, or feigning a state (e.g. "he pretended to be sick"). Also used reciprocally ("they encouraged each other").',
  'Polel':     'A variant of the Piel for biconsonantal (hollow) or geminate roots whose Piel forms are irregular. Same intensive-active meaning as the Piel.',
  'Polal':     'The passive of the Polel. Same meaning as the Pual but for hollow or geminate roots.',
  'Hithpolel': 'The reflexive of the Polel — same nuance as the Hithpael, used with hollow or geminate roots.',
  'Poel':      'Another variant intensive active stem used with certain root types. Functionally equivalent to the Piel.',
  'Poal':      'The passive counterpart of the Poel. Functionally equivalent to the Pual.',
}

const HEB_ASPECTS = {
  'Perfect':       'Expresses action viewed as completed or as a whole — the "snapshot" aspect. In past narrative: completed past action ("he wrote"). In prophecy: sometimes a confident future ("the prophetic perfect"). Also used for states and stative verbs.',
  'Imperfect':     'Expresses action viewed as ongoing, repeated, or not yet complete — the most versatile aspect. Can express present action, habitual action, future action, or possibility, depending on context.',
  'Consec. Impf':  'Waw-Consecutive Imperfect (וַיִּכְתֹּב) — an imperfect prefixed with וַ that carries past narrative meaning. The standard way Hebrew tells story: "and he did… and he said… and he went…" despite being grammatically imperfect.',
  'Seq. Imperfect':'Sequential Imperfect — an imperfect following in narrative or discourse sequence, closely related to the waw-consecutive construction.',
  'Cohortative':   'A first-person volitional form expressing strong desire, determination, or self-exhortation ("Let me go!," "I will surely…," "Let us…"). Typically first-person only; often ends in ה—.',
  'Jussive':       'A volitional form expressing wish, permission, or mild command in 2nd or 3rd person ("Let him do…," "May she…"). Often a shortened form of the imperfect. "Let there be light" (יְהִי אֹור) is a jussive.',
  'Imperative':    'The direct command form — "Go!," "Hear!," "Write!" — always 2nd person. Hebrew imperatives distinguish gender (masculine/feminine) and number (singular/plural).',
  'Participle':    'A verbal adjective expressing ongoing or continuous action. Active participle: "one who writes," "the writing one" — often used for professions, habitual actions, or imminent future. In Hebrew, the participle frequently serves as the predicate: "he is writing."',
  'Pass. Participle':'Passive participle — expresses a state resulting from completed action: "written," "spoken," "blessed." Describes the condition the subject is left in after the action. Often used predicatively or attributively.',
  'Inf. Absolute': 'Infinitive Absolute — an indeclinable verbal form that cannot take pronominal suffixes. Used to intensify a finite verb ("he will surely die" — מֹות יָמוּת), in a series of actions, or to replace an imperative.',
  'Inf. Construct':'Infinitive Construct — the Hebrew verbal noun. It can take pronominal suffixes as its subject or object, and is governed by prepositions. Equivalent to English "to write," "in writing," "when he came," "for the sake of doing." Very common in Hebrew prose.',
}

const HEB_GENDER = {
  'Masculine': 'Grammatically masculine. Hebrew nouns, pronouns, adjectives, and verb forms are marked for gender. Note that grammatical gender does not always correspond to natural gender.',
  'Feminine':  'Grammatically feminine. Feminine nouns often end in ה— or ת—, though many feminine nouns have no distinctive ending.',
  'Both':      'Common gender — the word can function as either masculine or feminine, or its gender is not specified by the form.',
}

const HEB_NUMBER = {
  'Singular': 'Referring to one person, thing, or entity.',
  'Plural':   'Referring to more than one. Hebrew uses the plural not only for quantity but also for majesty or intensity (the "plural of majesty" — e.g. אֱלֹהִים is grammatically plural but refers to the one God).',
  'Dual':     'Referring to exactly two — used for naturally paired body parts (eyes, ears, hands, feet), time divisions (two years), and other paired items. The dual ending is ַיִם—.',
}

const HEB_STATE = {
  'Absolute':   'The independent, freestanding form of the noun — not linked to a following noun. Used when the noun stands on its own or with an adjective, article, or prepositional phrase.',
  'Construct':  'The "of" form — a noun in construct is linked directly to a following noun (its "genitive") without an intervening article: "word of the LORD" (דְּבַר יְהוָה). The construct noun loses its accent and may shorten.',
  'Determined': 'The definite state — the noun is marked as definite, typically by the definite article הַ or by a pronominal suffix (which makes it inherently definite).',
}

/* ── Greek ───────────────────────────────────────────────────────────── */

const GRK_POS = {
  'Noun':          'A word naming a person, place, thing, or concept. Greek nouns decline for case (nominative, genitive, dative, accusative, vocative), number (singular/plural), and gender (masculine, feminine, neuter).',
  'Verb':          'A word expressing action or state of being. Greek verbs are richly inflected for tense (aspect + time), voice (active/middle/passive), mood (indicative/subjunctive/optative/imperative/infinitive/participle), person, and number.',
  'Article':       'The definite article ὁ/ἡ/τό ("the") — Greek has no indefinite article. It agrees with the noun it modifies in case, number, and gender. Its presence or absence is often theologically and grammatically significant.',
  'Adj':           'Adjective — modifies a noun and must agree with it in case, number, and gender. Can be attributive ("the good word"), predicative ("the word is good"), or substantival ("the good one").',
  'Pron':          'Pronoun — a word standing in for a noun. Includes personal pronouns (ἐγώ, σύ), which are often dropped since the verb ending already encodes person.',
  'Rel. Pron':     'Relative Pronoun — introduces a relative clause describing a noun: "who," "which," "that" (ὅς, ἥ, ὅ). Agrees with its antecedent in gender and number but takes the case required by its own clause.',
  'Recip. Pron':   'Reciprocal Pronoun — "one another," "each other" (ἀλλήλων). Always plural; used when the action is mutual between subjects.',
  'Dem. Pron':     'Demonstrative Pronoun — "this" (οὗτος) or "that" (ἐκεῖνος). Agrees with its noun in case, number, and gender. When used predicatively it functions as an adjective; when used alone it is a pronoun.',
  'Correl. Pron':  'Correlative Pronoun — a paired pronoun or adjective used in comparison (e.g. "as many as…," "such as…"). Correlates two parts of a sentence.',
  'Interrog. Pron':'Interrogative Pronoun — "who?" or "what?" (τίς, τί). Distinguished from the indefinite pronoun only by accent.',
  'Indef. Pron':   'Indefinite Pronoun — "someone," "something," "a certain one" (τις, τι — unaccented). Refers to an unspecified person or thing.',
  'Refl. Pron':    'Reflexive Pronoun — "himself," "herself," "itself," "themselves" (ἑαυτοῦ, ἑαυτῆς). Refers back to the subject of the clause.',
  'Adverb':        'An indeclinable word modifying a verb, adjective, or other adverb. Expresses time, place, manner, or degree (e.g. εὐθύς "immediately," πάλιν "again," ἐκεῖ "there").',
  'Conj':          'Conjunction — a word connecting words, phrases, or clauses. Common examples: καί ("and," "also"), δέ ("but," "and"), ἀλλά ("but"), γάρ ("for," "because"), ὅτι ("that," "because").',
  'Conditional':   'A particle introducing a conditional clause. εἰ introduces 1st/2nd/4th class conditions (real, contrary-to-fact, remote); ἐάν introduces 3rd class conditions (probable/possible future).',
  'Particle':      'An indeclinable function word that adds logical or discourse nuance. Examples: μέν (anticipatory contrast), οὖν ("therefore," "so"), ἄν (makes statements contingent), γέ (emphatic), νή (affirmation).',
  'Prep':          'Preposition — governs a noun in a particular case to show spatial, temporal, or abstract relationship. Many Greek prepositions take different meanings with different cases (e.g. διά + genitive = "through"; διά + accusative = "on account of").',
  'Interjection':  'An exclamatory expression. Examples: ἰδού ("behold!," "look!"), ἄγε ("come!"), οὐαί ("woe!"). Grammatically independent from the sentence.',
  'Correl/Interrog': 'A word that functions as both a correlative and interrogative pronoun depending on context.',
  'Adv':           'Adverb — an indeclinable word modifying a verb, adjective, or other adverb.',
}

const GRK_CASE = {
  'Nominative': 'The subject case — the noun performing the action of the verb, or the subject complement after a linking verb ("The Word was God" — θεὸς ἦν ὁ λόγος).',
  'Genitive':   'The "of" case — primarily indicates possession, origin, or relationship ("the grace of God," "faith of/in Christ"). Also used after many Greek prepositions, and for the partitive ("some of the bread") and ablative ("separation from").',
  'Dative':     'The indirect object case — the recipient of an action ("he gave it to him"). Also used for means/instrument ("by faith"), manner ("with joy"), location ("in the city"), time ("on that day"), and after certain verbs and prepositions.',
  'Accusative': 'The direct object case — the noun receiving the action of the verb ("he loved the world"). Also used after many prepositions, and to express duration, extent, or direction.',
  'Vocative':   'The direct address case — used when speaking directly to someone or something ("Lord!," "O men of Israel!"). Often identical to the nominative except in 2nd declension masculine nouns.',
  'Locative':   'The case of location ("in," "at," "among"). In Koine Greek this function is largely merged into the dative case; some grammarians distinguish it for clarity.',
}

const GRK_TENSE = {
  'Present':      'Expresses ongoing, continuous, or repeated action — in the indicative mood, typically in present time. "He is writing," "he writes (habitually)." Outside the indicative, the present indicates ongoing aspect rather than present time.',
  'Imperfect':    'Expresses ongoing or repeated past action — "he was writing," "he kept saying." Only found in the indicative mood. Closely related to the present stem but set in past time.',
  'Future':       'Expresses anticipated future action — "he will write," "he will be written." Often used for promises, commands, and prophecy.',
  'Aorist':       'Views the action as a simple whole event without specifying its duration — the "point of action." In the indicative it typically denotes past action ("he wrote," "he believed"). Outside the indicative it denotes simple aspect. The most common narrative past tense in Greek.',
  '2nd Aorist':   'An aorist formed from an alternative, often older stem (e.g. ἐλθεῖν rather than ἔρχεσθαι). Same meaning as the 1st Aorist — simply an irregular form that must be memorized.',
  'Perfect':      'Expresses a past action whose results continue into the present — "he has written (and it remains written)." In the indicative it denotes a completed past act with present ongoing effect. Theologically significant for statements like "it is written" (γέγραπται).',
  '2nd Perfect':  'A perfect formed from an alternate stem — same meaning as the perfect, different morphological form (e.g. οἶδα "I know / I have come to know").',
  'Pluperfect':   'A past action whose results were in place at a still-earlier point in the past — "he had written." Rare in the New Testament; emphasizes the state resulting from a prior act as seen from a past vantage point.',
  'Future Perfect':'A future action whose results will be complete and in place — "he will have written." Extremely rare in the NT; limited to a handful of passages.',
}

const GRK_VOICE = {
  'Active':         'The subject performs the action: "He loved." The most straightforward voice — agent acts on object.',
  'Middle':         'The subject acts in relation to itself or for its own benefit — a nuance of self-involvement or reflexivity. "He chose for himself," "he washed himself," "she departed." Not always easily distinguished from the active in translation.',
  'Passive':        'The subject receives the action of an outside agent: "He was loved," "they were healed." When the agent is expressed, it typically appears in the genitive (ὑπό + genitive = "by").',
  'Middle/Passive': 'Some tense-forms (especially aorist and future) have distinct middle and passive endings; others share the same form. When a form could be either middle or passive, it is labeled "Middle/Passive" and context determines meaning.',
  'Deponent':       'A verb that uses middle or passive forms but carries active meaning. It is not truly reflexive or passive — Greek simply preserved only the middle/passive forms for these verbs (e.g. ἔρχομαι "I come/go," πορεύομαι "I journey").',
}

const GRK_MOOD = {
  'Indicative':  'The mood of fact and assertion — states something as real or actual. The primary narrative and teaching mood: "He came," "I tell you," "God is faithful."',
  'Subjunctive': 'The mood of probability, contingency, and purpose — presents the action as possible or projected. Used in purpose clauses ("in order that"), conditional clauses ("if/when"), prohibitions with μή, and deliberative questions.',
  'Optative':    'The mood of wish or remote possibility — "May it be!," "Would that…" Expresses what the speaker wishes were true or considers only remotely possible. Growing rare by NT times; most famous usage: μὴ γένοιτο ("God forbid!," "May it never be!").',
  'Infinitive':  'A verbal noun — not a finite mood but a non-finite verbal form: "to write," "to love." Can function as a subject ("to believe is to trust"), object, or purpose clause. Retains the tense/aspect of the verb but does not inflect for person or number.',
  'Participle':  'A verbal adjective — combines the properties of a verb (tense, voice) and an adjective (case, number, gender). "Writing," "having written," "being written." Can be attributive ("the man writing"), circumstantial ("while writing"), or substantival ("the one who writes").',
  'Imperative':  'The mood of direct command: "Write!," "Believe!," "Do not be afraid!" Present imperative typically commands ongoing action; aorist imperative a single decisive act. 2nd person is most common; 3rd person imperative exists ("Let him come," "Let there be…").',
}

const GRK_NUMBER = {
  'Singular': 'Referring to one person, thing, or entity.',
  'Plural':   'Referring to more than one. Note: in Greek, neuter plural subjects often take a singular verb.',
}

const GRK_GENDER = {
  'Masculine': 'Grammatically masculine. Grammatical gender is a property of the noun\'s form and does not always correspond to natural gender (e.g. πνεῦμα "spirit" is neuter).',
  'Feminine':  'Grammatically feminine. Many abstract nouns and many nouns for natural females are grammatically feminine.',
  'Neuter':    'Grammatically neuter. Neuter nouns have identical nominative and accusative forms. Many neuter nouns refer to things, concepts, or abstractions — though not exclusively.',
}

const GRK_PERSON = {
  '1st': 'First person — "I" (singular) or "we" (plural). The speaker or group including the speaker.',
  '2nd': 'Second person — "you" (singular) or "you all/you" (plural). The person(s) being addressed.',
  '3rd': 'Third person — "he," "she," "it" (singular) or "they" (plural). The person(s) or thing(s) being spoken about.',
}

const HEB_PERSON = GRK_PERSON

/* ── Main lookup ─────────────────────────────────────────────────────── */

/**
 * Returns { term, definition } or null if no entry found.
 * @param {string} label  — row label, e.g. "Stem", "Aspect", "Tense", "Mood", "Part of Speech"
 * @param {string} value  — displayed value, e.g. "Qal", "Perfect", "Indicative"
 * @param {'hebrew'|'greek'} lang
 */
export function getMorphDef(label, value, lang) {
  if (!value) return null
  let def = null

  if (lang === 'hebrew') {
    if (label === 'Part of Speech') def = HEB_POS[value]
    else if (label === 'Stem')      def = HEB_STEMS[value]
    else if (label === 'Aspect')    def = HEB_ASPECTS[value]
    else if (label === 'Gender')    def = HEB_GENDER[value]
    else if (label === 'Number')    def = HEB_NUMBER[value]
    else if (label === 'State')     def = HEB_STATE[value]
    else if (label === 'Person')    def = HEB_PERSON[value]
  } else {
    if (label === 'Part of Speech') def = GRK_POS[value]
    else if (label === 'Case')      def = GRK_CASE[value]
    else if (label === 'Tense')     def = GRK_TENSE[value]
    else if (label === 'Voice')     def = GRK_VOICE[value]
    else if (label === 'Mood')      def = GRK_MOOD[value]
    else if (label === 'Number')    def = GRK_NUMBER[value]
    else if (label === 'Gender')    def = GRK_GENDER[value]
    else if (label === 'Person')    def = GRK_PERSON[value]
  }

  if (!def) return null
  return { term: value, label, definition: def }
}
