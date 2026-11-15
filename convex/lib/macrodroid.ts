// MacroDroid macro export (.macro, JSON) for the store's SMS relay.
// Claim flow (no store token in the file):
// - The file carries a one-time setup code in the claim URL, never the token.
// - Global variables: cigarro_key (string, secure), cigarro_ready (boolean),
//   cigarro_claim_code (integer).
// - While cigarro_ready is false, the macro POSTs the claim URL, blocks the next
//   action, saves the response body into cigarro_key and the HTTP status into
//   cigarro_claim_code. On 200 it sets cigarro_ready to true.
// - While cigarro_ready is true, each SMS is POSTed to the receive URL with
//   {v=cigarro_key} as the token. The same run relays the SMS that set it up.
//
// Field names and type codes were checked against real MacroDroid exports and the
// decompiled app source (Mohsenabn78/macro-reverse-engineering, ee9255b).
// Deliberate difference from the exports: contentType is text/plain, not
// application/json, because {sms_message} is not JSON-escaped by MacroDroid.
// Items still not confirmed by importing into MacroDroid: the isSecure flag on
// globals (present in exports, meaning not confirmed) and the exact If/Else/EndIf
// behaviour when nested.
//
// m_GUID / m_SIGUID are Java longs. They are written as raw 64-bit integers
// (BigInt text) because a JS number would lose precision.

export const MACRO_NAME = "Cigarro payments";
export const MACRO_FILENAME = "cigarro-payments.macro";
/** MacroDroid magic text: sender number and full message. */
export const MACRO_BODY = "{sms_number}\n{sms_message}";

export const VAR_KEY = "cigarro_key";
export const VAR_READY = "cigarro_ready";
export const VAR_CLAIM_CODE = "cigarro_claim_code";

// MacroDroidVariable.TYPE_* in the decompiled source (common/MacroDroidVariable.java).
const TYPE_BOOLEAN = 0;
const TYPE_INTEGER = 1;
const TYPE_STRING = 2;
// HttpRequestConfig.SAVE_RESPONSE_VARIABLE (action/HttpRequestConfig.java).
const SAVE_RESPONSE_VARIABLE = 1;

function randomLong(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  // Interpret as signed 64-bit, like Java's long.
  if (n >= 1n << 63n) n -= 1n << 64n;
  return n.toString();
}

/** Base HttpRequestAction config, copied from the working export. */
function requestConfig(url: string, overrides: Record<string, unknown> = {}) {
  return {
    allFilesAccessPath: "",
    allowAnyCertificate: false,
    basicAuthEnabled: false,
    basicAuthPassword: "",
    basicAuthUsername: "",
    blockNextAction: false,
    clientCertEnabled: false,
    clientCertKeyStoreDisplayName: "",
    clientCertKeyStoreUri: "",
    clientCertPassword: "",
    contentBodyDynamicFileName: "",
    contentBodyFileDisplayName: "",
    contentBodyFileUri: "",
    contentBodyFolderDisplayName: "",
    contentBodyFolderUri: "",
    contentBodySource: 0,
    contentBodyText: MACRO_BODY,
    contentType: "text/plain",
    followRedirects: true,
    headerParams: [],
    localFileUri: "",
    maxTotalDurationSeconds: 3600,
    prettifyJson: false,
    proxyEnabled: false,
    proxyHost: "",
    proxyPort: 8080,
    proxyType: 0,
    queryParams: [],
    requestTimeOutSeconds: 30,
    requestType: 1, // POST
    saveResponseAllFilesAccessPath: "",
    saveResponseFileName: "",
    saveResponseFolderPathDisplayName: "",
    saveResponseFolderPathUri: "",
    saveResponseType: 0,
    saveResponseUseAllFilesAccess: false,
    saveReturnCodeToVariable: false,
    saveReturnHeadersToVariable: false,
    urlToOpen: url,
    useAllFilesAccess: false,
    useLocalFileUri: false,
    useStaticContentBodyFile: true,
    ...overrides,
  };
}

/** Returns the .macro file text with the one-time claim code injected. */
export function buildMacroFile(siteUrl: string, claimCode: string, now: number = Date.now()): string {
  const base = siteUrl.replace(/\/$/, "");
  const claimUrl = `${base}/claimSmsRelay/${claimCode}`;
  const receiveUrl = `${base}/receiveBankSms/{v=${VAR_KEY}}`;

  // Each GUID placeholder is replaced by a unique 64-bit id after stringify.
  let n = 0;
  const gid = () => `__GUID_${n++}__`;

  // Variable object, same shape as globalVariables entries and as the variable
  // references inside actions and constraints (real exports). Values are the
  // defaults; the macro sets them at runtime.
  const variable = (name: string, type: number, secure = false) => ({
    description: "",
    dictionary: { entries: [], isArray: false, variableType: 4, type: "Dictionary" },
    isActionBlockWorkingVar: false,
    isLocalVar: false,
    isSecure: secure,
    m_booleanValue: false,
    m_decimalValue: 0,
    m_intValue: 0,
    m_name: name,
    m_stringValue: "",
    m_type: type,
    supportsInput: false,
    supportsOutput: true,
  });

  // If Variable [op] value. Lives in the If action's own m_constraintList.
  // Equality is the default: m_intLessThan / m_intGreaterThan / m_intNotEqual stay false.
  const variableCondition = (name: string, type: number, value: { bool?: boolean; int?: number }) => ({
    checkCase: false,
    dictionaryKeys: { keys: [] },
    dictionaryType: 1,
    enableRegex: false,
    m_booleanValue: value.bool ?? false,
    m_doubleValue: 0,
    m_intCompareVariable: false,
    m_intGreaterThan: false,
    m_intLessThan: false,
    m_intNotEqual: false,
    m_intValue: value.int ?? 0,
    m_otherValueToCompare: variable(name, type),
    m_stringComparisonType: 0,
    m_stringEqual: true,
    m_variable: variable(name, type),
    m_SIGUID: gid(),
    m_classType: "MacroDroidVariableConstraint",
    m_constraintList: [],
    m_isDisabled: false,
    m_isOrCondition: false,
  });

  // If action (class IfConditionAction, not IfAction). Condition goes in m_constraintList.
  const ifAction = (condition: ReturnType<typeof variableCondition>) => ({
    childrenCollapsed: false,
    dontLogIfConditionIsFalse: false,
    m_SIGUID: gid(),
    m_classType: "IfConditionAction",
    m_constraintList: [condition],
    m_isDisabled: false,
    m_isOrCondition: false,
  });

  // End of an If block. Real export: only the base action fields.
  const endIf = () => ({
    m_SIGUID: gid(),
    m_classType: "EndIfAction",
    m_constraintList: [],
    m_isDisabled: false,
    m_isOrCondition: false,
  });

  // Set Variable. The value field used depends on the variable type:
  // boolean -> m_newBooleanValue, integer -> m_newIntValue (decompiled SetVariableAction).
  // m_expression is null for a literal value (the export uses it only for expressions).
  const setVar = (name: string, type: number, value: boolean | number) => ({
    booleanDictionaryKeys: { keys: [] },
    dictionaryKeys: [],
    dictionaryOrArrayType: -1,
    existingManualKeyType: 0,
    m_booleanInvert: false,
    m_darkMode: -1,
    m_doubleRandomMax: 0,
    m_doubleRandomMin: 0,
    m_expression: null,
    m_falseLabel: "",
    m_intExpression: false,
    m_intRandom: false,
    m_intRandomMax: 0,
    m_intRandomMin: 0,
    m_intValueDecrement: false,
    m_intValueIncrement: false,
    m_newBooleanValue: type === TYPE_BOOLEAN ? Boolean(value) : false,
    m_newDoubleValue: 0,
    m_newIntValue: type === TYPE_INTEGER ? Number(value) : 0,
    m_trueLabel: "",
    m_userPrompt: false,
    m_userPromptEmptyAtStart: false,
    m_userPromptPassword: false,
    m_userPromptShowCancel: true,
    m_userPromptStopAfterCancel: true,
    m_variable: variable(name, type),
    m_SIGUID: gid(),
    m_classType: "SetVariableAction",
    m_constraintList: [],
    m_isDisabled: false,
    m_isOrCondition: false,
  });

  // HTTP request action. Keys and defaults from the real export's requestConfig.
  const httpAction = (config: ReturnType<typeof requestConfig>) => ({
    requestConfig: config,
    disableLogging: false,
    m_SIGUID: gid(),
    m_classType: "HttpRequestAction",
    m_constraintList: [],
    m_isDisabled: false,
    m_isOrCondition: false,
  });

  const globals = [
    variable(VAR_KEY, TYPE_STRING, true),
    variable(VAR_READY, TYPE_BOOLEAN),
    variable(VAR_CLAIM_CODE, TYPE_INTEGER),
  ];

  const actions = [
    // Not ready yet: claim once with the setup code.
    ifAction(variableCondition(VAR_READY, TYPE_BOOLEAN, { bool: false })),
    httpAction(
      requestConfig(claimUrl, {
        contentBodyText: "",
        blockNextAction: true, // wait for the response before the next action
        saveResponseType: SAVE_RESPONSE_VARIABLE,
        responseVariableName: VAR_KEY,
        saveReturnCodeToVariable: true,
        returnCodeVariableName: VAR_CLAIM_CODE,
      }),
    ),
    ifAction(variableCondition(VAR_CLAIM_CODE, TYPE_INTEGER, { int: 200 })),
    setVar(VAR_READY, TYPE_BOOLEAN, true),
    endIf(),
    endIf(),
    // Ready: relay each bank SMS with the claimed key.
    ifAction(variableCondition(VAR_READY, TYPE_BOOLEAN, { bool: true })),
    httpAction(requestConfig(receiveUrl)),
    endIf(),
  ];

  const doc = {
    globalVariables: globals,
    macro: {
      aiGenerated: 0,
      breakpoints: [],
      disabledTimestamp: 0,
      exportedActionBlocks: [],
      exportedSharedScenes: [],
      forceEvenIfNotEnabledTimestamp: 0,
      isActionBlock: false,
      isExtra: false,
      isFavourite: false,
      lastEditedTimestamp: now,
      localVariableSeparators: [],
      localVariables: [],
      localVarsAlphabetical: true,
      loggingLevel: 0,
      m_GUID: gid(),
      m_actionList: actions,
      m_category: "Cigarro",
      m_completed: true,
      m_constraintList: [],
      m_description: "Sends bank SMS to Cigarro so UPI payments confirm automatically.",
      m_descriptionOpen: false,
      m_enabled: true,
      m_excludeLog: false,
      m_headingColor: 0,
      m_isOrCondition: false,
      m_name: MACRO_NAME,
      m_triggerList: [
        {
          enableRegex: false,
          enableRegexPhoneNumber: false,
          ignoreCase: true,
          isExcludeContact: false,
          m_exactMatch: false,
          m_excludes: false,
          m_groupIdList: [],
          m_groupNameList: [],
          m_option: 3, // any number
          m_smsContent: "",
          m_smsFromList: [],
          m_smsNumberExclude: false,
          subscriptionId: -1,
          disableLogging: false,
          m_SIGUID: gid(),
          m_classType: "IncomingSMSTrigger",
          m_constraintList: [],
          m_isDisabled: false,
          m_isOrCondition: false,
        },
      ],
    },
    macroExportVersion: 1,
  };

  const ids: string[] = Array.from({ length: n }, () => randomLong());
  return JSON.stringify(doc, null, 2).replace(/"__GUID_(\d+)__"/g, (_, i: string) => ids[Number(i)]);
}
