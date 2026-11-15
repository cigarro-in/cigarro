// MacroDroid macro export (.macro, JSON) for the store's SMS relay.
// Structure copied from a working export: IncomingSMSTrigger (any number) ->
// HttpRequestAction POST. The body is text/plain "{sms_number}\n{sms_message}"
// (first line sender, rest message) so quotes or newlines in an SMS can never
// break the request, unlike a hand-written JSON template.
//
// m_GUID / m_SIGUID are Java longs. They are written as raw 64-bit integers
// (BigInt text) because a JS number would lose precision.

export const MACRO_NAME = "Cigarro payments";
export const MACRO_FILENAME = "cigarro-payments.macro";
/** MacroDroid magic text: sender number and full message. */
export const MACRO_BODY = "{sms_number}\n{sms_message}";

function randomLong(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  // Interpret as signed 64-bit, like Java's long.
  if (n >= 1n << 63n) n -= 1n << 64n;
  return n.toString();
}

/** Returns the .macro file text with `webhookUrl` injected and fresh ids. */
export function buildMacroFile(webhookUrl: string, now: number = Date.now()): string {
  const ids = { macro: randomLong(), action: randomLong(), trigger: randomLong() };
  const doc = {
    globalVariables: [],
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
      m_GUID: "__GUID_MACRO__",
      m_actionList: [
        {
          requestConfig: {
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
            urlToOpen: webhookUrl,
            useAllFilesAccess: false,
            useLocalFileUri: false,
            useStaticContentBodyFile: true,
          },
          disableLogging: false,
          m_SIGUID: "__GUID_ACTION__",
          m_classType: "HttpRequestAction",
          m_constraintList: [],
          m_isDisabled: false,
          m_isOrCondition: false,
        },
      ],
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
          m_SIGUID: "__GUID_TRIGGER__",
          m_classType: "IncomingSMSTrigger",
          m_constraintList: [],
          m_isDisabled: false,
          m_isOrCondition: false,
        },
      ],
    },
    macroExportVersion: 1,
  };
  return JSON.stringify(doc, null, 2)
    .replace('"__GUID_MACRO__"', ids.macro)
    .replace('"__GUID_ACTION__"', ids.action)
    .replace('"__GUID_TRIGGER__"', ids.trigger);
}
