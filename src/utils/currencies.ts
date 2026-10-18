/**
 * Every currency a tier can be priced in. PRD section 11.2, FP-16 section 6.2.
 *
 * The circulating ISO 4217 currencies, one per country that issues its own,
 * sorted by code so the native select's type-ahead finds "JPY" by typing "J".
 * Fund codes (CLF, UYI), precious metals (XAU), and withdrawn codes (HRK, BGN,
 * ANG, ZWL) are left out: none of them is something a buyer pays a plan in.
 *
 * ## The exponent is what the gateways count in
 *
 * `exponent` is the number of decimal places a price in that currency may
 * have, which is also how many digits of `amountMinor` sit after the point.
 * It follows ISO 4217, with one deliberate exception: MGA is zero-decimal here
 * because Stripe charges it that way and the ariary has no coin in use below
 * one. ISK and UGX are zero-decimal in both ISO and here; Stripe still wants
 * them sent as two-decimal values, and the backend's Stripe adapter does that
 * scaling so nothing on this side has to know.
 *
 * Mirrored in `memberframe-backend/src/lib/currencies.ts`. The two lists must
 * hold the same codes, or the server refuses a tier the plugin let through.
 */

/** An ISO 4217 code from `CURRENCIES`. A string, so a stored record never fails to type. */
export type CurrencyCode = string;

export interface CurrencyInfo {
  code: CurrencyCode;
  name: string;
  /** Decimal places a price may have. 0 for JPY, 2 for USD, 3 for KWD. */
  exponent: 0 | 2 | 3;
}

const ZERO_DECIMAL = new Set([
  "BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV",
  "XAF", "XOF", "XPF",
]);

const THREE_DECIMAL = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);

const NAMES: ReadonlyArray<readonly [CurrencyCode, string]> = [
  ["AED", "UAE dirham"],
  ["AFN", "Afghan afghani"],
  ["ALL", "Albanian lek"],
  ["AMD", "Armenian dram"],
  ["AOA", "Angolan kwanza"],
  ["ARS", "Argentine peso"],
  ["AUD", "Australian dollar"],
  ["AWG", "Aruban florin"],
  ["AZN", "Azerbaijani manat"],
  ["BAM", "Bosnian convertible mark"],
  ["BBD", "Barbadian dollar"],
  ["BDT", "Bangladeshi taka"],
  ["BHD", "Bahraini dinar"],
  ["BIF", "Burundian franc"],
  ["BMD", "Bermudian dollar"],
  ["BND", "Brunei dollar"],
  ["BOB", "Bolivian boliviano"],
  ["BRL", "Brazilian real"],
  ["BSD", "Bahamian dollar"],
  ["BTN", "Bhutanese ngultrum"],
  ["BWP", "Botswana pula"],
  ["BYN", "Belarusian ruble"],
  ["BZD", "Belize dollar"],
  ["CAD", "Canadian dollar"],
  ["CDF", "Congolese franc"],
  ["CHF", "Swiss franc"],
  ["CLP", "Chilean peso"],
  ["CNY", "Chinese yuan"],
  ["COP", "Colombian peso"],
  ["CRC", "Costa Rican colón"],
  ["CUP", "Cuban peso"],
  ["CVE", "Cape Verdean escudo"],
  ["CZK", "Czech koruna"],
  ["DJF", "Djiboutian franc"],
  ["DKK", "Danish krone"],
  ["DOP", "Dominican peso"],
  ["DZD", "Algerian dinar"],
  ["EGP", "Egyptian pound"],
  ["ERN", "Eritrean nakfa"],
  ["ETB", "Ethiopian birr"],
  ["EUR", "Euro"],
  ["FJD", "Fijian dollar"],
  ["FKP", "Falkland Islands pound"],
  ["GBP", "Pound sterling"],
  ["GEL", "Georgian lari"],
  ["GHS", "Ghanaian cedi"],
  ["GIP", "Gibraltar pound"],
  ["GMD", "Gambian dalasi"],
  ["GNF", "Guinean franc"],
  ["GTQ", "Guatemalan quetzal"],
  ["GYD", "Guyanese dollar"],
  ["HKD", "Hong Kong dollar"],
  ["HNL", "Honduran lempira"],
  ["HTG", "Haitian gourde"],
  ["HUF", "Hungarian forint"],
  ["IDR", "Indonesian rupiah"],
  ["ILS", "Israeli new shekel"],
  ["INR", "Indian rupee"],
  ["IQD", "Iraqi dinar"],
  ["IRR", "Iranian rial"],
  ["ISK", "Icelandic króna"],
  ["JMD", "Jamaican dollar"],
  ["JOD", "Jordanian dinar"],
  ["JPY", "Japanese yen"],
  ["KES", "Kenyan shilling"],
  ["KGS", "Kyrgyzstani som"],
  ["KHR", "Cambodian riel"],
  ["KMF", "Comorian franc"],
  ["KPW", "North Korean won"],
  ["KRW", "South Korean won"],
  ["KWD", "Kuwaiti dinar"],
  ["KYD", "Cayman Islands dollar"],
  ["KZT", "Kazakhstani tenge"],
  ["LAK", "Lao kip"],
  ["LBP", "Lebanese pound"],
  ["LKR", "Sri Lankan rupee"],
  ["LRD", "Liberian dollar"],
  ["LSL", "Lesotho loti"],
  ["LYD", "Libyan dinar"],
  ["MAD", "Moroccan dirham"],
  ["MDL", "Moldovan leu"],
  ["MGA", "Malagasy ariary"],
  ["MKD", "Macedonian denar"],
  ["MMK", "Myanmar kyat"],
  ["MNT", "Mongolian tögrög"],
  ["MOP", "Macanese pataca"],
  ["MRU", "Mauritanian ouguiya"],
  ["MUR", "Mauritian rupee"],
  ["MVR", "Maldivian rufiyaa"],
  ["MWK", "Malawian kwacha"],
  ["MXN", "Mexican peso"],
  ["MYR", "Malaysian ringgit"],
  ["MZN", "Mozambican metical"],
  ["NAD", "Namibian dollar"],
  ["NGN", "Nigerian naira"],
  ["NIO", "Nicaraguan córdoba"],
  ["NOK", "Norwegian krone"],
  ["NPR", "Nepalese rupee"],
  ["NZD", "New Zealand dollar"],
  ["OMR", "Omani rial"],
  ["PAB", "Panamanian balboa"],
  ["PEN", "Peruvian sol"],
  ["PGK", "Papua New Guinean kina"],
  ["PHP", "Philippine peso"],
  ["PKR", "Pakistani rupee"],
  ["PLN", "Polish złoty"],
  ["PYG", "Paraguayan guaraní"],
  ["QAR", "Qatari riyal"],
  ["RON", "Romanian leu"],
  ["RSD", "Serbian dinar"],
  ["RUB", "Russian ruble"],
  ["RWF", "Rwandan franc"],
  ["SAR", "Saudi riyal"],
  ["SBD", "Solomon Islands dollar"],
  ["SCR", "Seychellois rupee"],
  ["SDG", "Sudanese pound"],
  ["SEK", "Swedish krona"],
  ["SGD", "Singapore dollar"],
  ["SHP", "Saint Helena pound"],
  ["SLE", "Sierra Leonean leone"],
  ["SOS", "Somali shilling"],
  ["SRD", "Surinamese dollar"],
  ["SSP", "South Sudanese pound"],
  ["STN", "São Tomé and Príncipe dobra"],
  ["SVC", "Salvadoran colón"],
  ["SYP", "Syrian pound"],
  ["SZL", "Swazi lilangeni"],
  ["THB", "Thai baht"],
  ["TJS", "Tajikistani somoni"],
  ["TMT", "Turkmenistani manat"],
  ["TND", "Tunisian dinar"],
  ["TOP", "Tongan pa'anga"],
  ["TRY", "Turkish lira"],
  ["TTD", "Trinidad and Tobago dollar"],
  ["TWD", "New Taiwan dollar"],
  ["TZS", "Tanzanian shilling"],
  ["UAH", "Ukrainian hryvnia"],
  ["UGX", "Ugandan shilling"],
  ["USD", "US dollar"],
  ["UYU", "Uruguayan peso"],
  ["UZS", "Uzbekistani som"],
  ["VES", "Venezuelan bolívar"],
  ["VND", "Vietnamese dong"],
  ["VUV", "Vanuatu vatu"],
  ["WST", "Samoan tala"],
  ["XAF", "Central African CFA franc"],
  ["XCD", "East Caribbean dollar"],
  ["XCG", "Caribbean guilder"],
  ["XOF", "West African CFA franc"],
  ["XPF", "CFP franc"],
  ["YER", "Yemeni rial"],
  ["ZAR", "South African rand"],
  ["ZMW", "Zambian kwacha"],
  ["ZWG", "Zimbabwe Gold"],
];

export const CURRENCIES: ReadonlyArray<CurrencyInfo> = NAMES.map(([code, name]) => ({
  code,
  name,
  exponent: ZERO_DECIMAL.has(code) ? 0 : THREE_DECIMAL.has(code) ? 3 : 2,
}));

const BY_CODE = new Map(CURRENCIES.map((currency) => [currency.code, currency]));

/** The select options, "JPY, Japanese yen", code first so type-ahead works on it. */
export const CURRENCY_OPTIONS: ReadonlyArray<{ value: CurrencyCode; label: string }> = CURRENCIES.map(
  (currency) => ({ value: currency.code, label: `${currency.code}, ${currency.name}` })
);

export function isCurrencyCode(code: string): boolean {
  return BY_CODE.has(code);
}

/**
 * Decimal places for this currency. An unknown code, which only a record
 * written before this list existed could hold, falls back to two: that is what
 * every currency stored before then had.
 */
export function currencyExponent(code: CurrencyCode): number {
  return BY_CODE.get(code)?.exponent ?? 2;
}
