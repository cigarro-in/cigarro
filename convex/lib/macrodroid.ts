// MacroDroid macro export (.macro, JSON) for the store's SMS relay.
// Base structure copied from a working export: IncomingSMSTrigger (any number)
// -> HttpRequestAction POST. The body is text/plain "{sms_number}\n{sms_message}"
// (first line sender, rest message) so quotes or newlines in an SMS can never
// break the request, unlike a hand-written JSON template.
//
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
// Checked field by field against a real MacroDroid export (Sms.macro, which has a
// live token and is not copied here). Every HttpRequestAction requestConfig key,
// its defaults, the action keys and the IncomingSMSTrigger match. Deliberate
// difference: contentType is text/plain, not the export's application/json,
// because {sms_message} is not JSON-escaped by MacroDroid and an SMS with a quote
// or newline would break a JSON body.
// NOT in the export (best guesses, marked GUESS below; check by importing):
// globalVariables entries and their secure flag, the If / EndIf / Set Variable
// action shapes, saveResponseType 2 (save to variable), and the variable-name fields.
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

  // GUESS: global variable shape (m_type, m_isSecure, m_value as string).
  const variable = (name: string, type: string, value: string, secure: boolean) => ({
    m_GUID: gid(),
    m_name: name,
    m_type: type,
    m_value: value,
    m_isSecure: secure,
  });

  // GUESS: If clause shape. Condition compares a variable to a literal value.
  const ifVar = (name: string, value: string) => ({
    m_classType: "IfAction",
    disableLogging: false,
    m_SIGUID: gid(),
    m_constraintList: [
      {
        m_classType: "VariableConstraint",
        m_GUID: gid(),
        m_variableName: name,
        m_comparison: "=",
        m_value: value,
        m_isDisabled: false,
        m_isOrCondition: false,
        m_constraintList: [],
      },
    ],
    m_isDisabled: false,
    m_isOrCondition: false,
  });

  // GUESS: end-of-If marker.
  const endIf = () => ({
    m_classType: "EndIfAction",
    disableLogging: false,
    m_SIGUID: gid(),
    m_constraintList: [],
    m_isDisabled: false,
    m_isOrCondition: false,
  });

  // GUESS: Set Variable action shape.
  const setVar = (name: string, value: string) => ({
    m_classType: "SetVariableAction",
    disableLogging: false,
    m_SIGUID: gid(),
    m_variableName: name,
    m_value: value,
    m_constraintList: [],
    m_isDisabled: false,
    m_isOrCondition: false,
  });

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
    variable(VAR_KEY, "string", "", true), // GUESS: m_isSecure = MacroDroid secure variable
    variable(VAR_READY, "boolean", "false", false),
    variable(VAR_CLAIM_CODE, "integer", "0", false),
  ];

  const actions = [
    // Not ready yet: claim once with the setup code.
    ifVar(VAR_READY, "false"),
    httpAction(
      requestConfig(claimUrl, {
        contentBodyText: "",
        blockNextAction: true, // wait for the response before the next action
        // Export: saveResponseType 0 = don't save. 2 = save to a variable is a GUESS.
        saveResponseType: 2,
        saveResponseVariableName: VAR_KEY, // GUESS: name field not in export
        saveReturnCodeToVariable: true,
        saveReturnCodeVariableName: VAR_CLAIM_CODE, // GUESS
      }),
    ),
    ifVar(VAR_CLAIM_CODE, "200"),
    setVar(VAR_READY, "true"),
    endIf(),
    endIf(),
    // Ready: relay each bank SMS with the claimed key.
    ifVar(VAR_READY, "true"),
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
