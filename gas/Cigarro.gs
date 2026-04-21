/**
 * Cigarro — Bank email bridge for Apps Script.
 *
 * Runs in the tenant's own Google account. When Convex POSTs to this
 * web app, it searches Gmail for recent unprocessed bank emails from
 * configured senders, returns them as JSON, and labels them so they're
 * excluded from subsequent queries.
 *
 * Setup (see onboarding doc for full steps):
 *   1. Script Properties (File → Project Settings → Script Properties):
 *      - CONVEX_SECRET            a long random string the tenant pastes into
 *                                 Admin → Payment Settings → Apps Script secret
 *      - CONVEX_INGEST_URL        (optional) if set, script can also push to
 *                                 Convex directly on cron. Otherwise pull-only.
 *      - BANK_SENDERS             CSV of allowed From: domains/addresses.
 *                                 Defaults to "@hdfcbank.bank.in,@hdfcbank.net".
 *
 *   2. Deploy as Web App:
 *      - Execute as: Me (the tenant's account)
 *      - Who has access: Anyone
 *      - Copy the /exec URL into Admin → Payment Settings.
 */

var LABEL_NAME = 'convex-sent';
var DEFAULT_SENDERS = '@hdfcbank.bank.in,@hdfcbank.net,alerts@hdfcbank';

/**
 * Convex calls this endpoint. Body: { orgId, since, limit, reason }.
 * Auth: Authorization: Bearer <CONVEX_SECRET>.
 */
function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var expected = props.getProperty('CONVEX_SECRET');
    if (!expected) return json_({ ok: false, error: 'not_configured' }, 500);

    // Apps Script doPost doesn't expose headers directly; the token is
    // passed as a query string OR as a body field. Support both.
    var presented = '';
    if (e && e.parameter && e.parameter.auth) presented = e.parameter.auth;
    if (!presented && e && e.postData && e.postData.contents) {
      try {
        var parsed = JSON.parse(e.postData.contents);
        if (parsed && parsed.auth) presented = parsed.auth;
      } catch (_) {}
    }
    if (!safeEquals_(presented, expected))
      return json_({ ok: false, error: 'unauthorized' }, 401);

    var body = {};
    try {
      body = JSON.parse(e.postData.contents || '{}');
    } catch (_) {}
    var limit = Math.min(Number(body.limit || 20), 50);
    var sinceMs = Number(body.since || (Date.now() - 60 * 60 * 1000));

    // Convex can pass the sender list in the payload. If present, it takes
    // precedence over the local BANK_SENDERS script property.
    var senders = null;
    if (Array.isArray(body.senders) && body.senders.length > 0) {
      senders = body.senders
        .map(function (s) { return String(s).trim(); })
        .filter(function (s) { return s.length > 0; });
    }

    var includeLabeled = body.includeLabeled === true;
    var peek = body.peek === true;

    // Peek mode: return the most recent N inbox messages regardless of
    // sender / label / time. Purely for diagnostics — proves GAS can read
    // your Gmail at all.
    if (peek) {
      var peekBundle = peekInbox_(Math.min(Number(body.limit || 3), 10));
      return json_({
        ok: true,
        emails: peekBundle.emails,
        count: peekBundle.emails.length,
        peek: true,
        debug: { query: peekBundle.query, totalInspected: peekBundle.emails.length },
      });
    }

    var bundle = collectEmails_(limit, sinceMs, senders, includeLabeled);
    return json_({
      ok: true,
      emails: bundle.emails,
      count: bundle.emails.length,
      debug: {
        query: bundle.query,
        threadsMatched: bundle.threadsMatched,
        messagesInspected: bundle.messagesInspected,
        messagesReturned: bundle.emails.length,
        filteredBecauseLabeled: bundle.filteredLabeled,
        filteredBecauseOutsideWindow: bundle.filteredOutsideWindow,
        sendersUsed: bundle.sendersUsed,
        includeLabeled: includeLabeled,
      },
    });
  } catch (err) {
    return json_({ ok: false, error: 'exception', message: String(err) }, 500);
  }
}

/** Manual GET for sanity-checking deployment. Returns a pong + config flag. */
function doGet() {
  var props = PropertiesService.getScriptProperties();
  var configured = !!props.getProperty('CONVEX_SECRET');
  return json_({ ok: true, pong: true, configured: configured });
}

/**
 * Search Gmail for allowed-sender messages that aren't yet labeled
 * as processed, extract the parts Convex needs, label them, return bundle.
 */
function peekInbox_(limit) {
  var query = 'in:inbox';
  var threads = GmailApp.search(query, 0, limit);
  var emails = [];
  for (var i = 0; i < threads.length && emails.length < limit; i++) {
    var msgs = threads[i].getMessages();
    // Show only the most recent message of each thread
    var m = msgs[msgs.length - 1];
    emails.push({
      messageId: m.getId(),
      from: extractAddress_(m.getFrom()),
      fromRaw: m.getFrom(),
      to: extractAddress_(m.getTo()),
      subject: m.getSubject() || '',
      snippet: (m.getPlainBody() || '').slice(0, 200),
      receivedAt: m.getDate().getTime(),
    });
  }
  return { emails: emails, query: query };
}

function collectEmails_(limit, sinceMs, overrideSenders, includeLabeled) {
  var label = getOrCreateLabel_(LABEL_NAME);
  // Gmail's newer_than is relative to now (not to sinceMs). Use a 7-day window
  // as a broad safety net; we still filter per-message by sinceMs below.
  var newerThan = ' newer_than:7d';

  var rawSenders = (overrideSenders && overrideSenders.length > 0)
    ? overrideSenders
    : getSenderList_();
  // Strip leading '@' — Gmail's `from:` operator does domain matching on
  // the bare domain; a leading '@' can cause the query to not match.
  var senders = rawSenders.map(function (s) {
    return s.replace(/^@/, '');
  });
  var fromClause = senders
    .map(function (s) {
      return 'from:' + s;
    })
    .join(' OR ');
  var labelExclusion = includeLabeled ? '' : ' -label:' + LABEL_NAME;
  var query = '(' + fromClause + ')' + labelExclusion + newerThan;

  var threads = GmailApp.search(query, 0, Math.max(limit, 50));
  var emails = [];
  var filteredLabeled = 0;
  var filteredOutsideWindow = 0;
  var messagesInspected = 0;

  for (var i = 0; i < threads.length && emails.length < limit; i++) {
    var msgs = threads[i].getMessages();
    for (var j = 0; j < msgs.length && emails.length < limit; j++) {
      messagesInspected++;
      var m = msgs[j];

      // Per-message window check
      if (m.getDate().getTime() < sinceMs) {
        filteredOutsideWindow++;
        continue;
      }

      emails.push({
        messageId: m.getId(),
        from: extractAddress_(m.getFrom()),
        to: extractAddress_(m.getTo()) || extractAddress_(m.getReplyTo()),
        subject: m.getSubject() || '',
        textBody: safe_(m.getPlainBody()),
        htmlBody: safe_(m.getBody()),
        receivedAt: m.getDate().getTime(),
      });
    }
    // Mark the whole thread processed (labels apply thread-level in Gmail).
    threads[i].addLabel(label);
  }

  return {
    emails: emails,
    query: query,
    threadsMatched: threads.length,
    messagesInspected: messagesInspected,
    filteredLabeled: filteredLabeled,
    filteredOutsideWindow: filteredOutsideWindow,
    sendersUsed: senders,
  };
}

/**
 * Optional: periodic internal sweep (installable time-trigger, 30 min).
 * Not required if Convex is driving via doPost. Left here for tenants who
 * want the GAS side to push emails on its own schedule.
 */
function internalSweep() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('CONVEX_INGEST_URL');
  var secret = props.getProperty('CONVEX_SECRET');
  if (!url || !secret) return;
  var bundle = collectEmails_(20, Date.now() - 24 * 60 * 60 * 1000);
  if (bundle.emails.length === 0) return;

  // Push each individually; Convex dedups by messageId anyway.
  for (var i = 0; i < bundle.emails.length; i++) {
    var em = bundle.emails[i];
    try {
      UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + secret },
        payload: JSON.stringify(em),
        muteHttpExceptions: true,
      });
    } catch (err) {
      // Next sweep will retry via label-based dedup
    }
  }
}

// ---------- Helpers ----------

function getOrCreateLabel_(name) {
  var label = GmailApp.getUserLabelByName(name);
  if (label) return label;
  return GmailApp.createLabel(name);
}

function getSenderList_() {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('BANK_SENDERS') || DEFAULT_SENDERS;
  return raw
    .split(',')
    .map(function (s) {
      return s.trim();
    })
    .filter(function (s) {
      return s.length > 0;
    });
}

function extractAddress_(field) {
  if (!field) return '';
  var m = String(field).match(/[\w.+\-]+@[\w.\-]+/);
  return m ? m[0].toLowerCase() : '';
}

function safe_(s) {
  if (!s) return '';
  // Cap at ~100KB to keep payload sane.
  var MAX = 100 * 1024;
  return s.length > MAX ? s.slice(0, MAX) : s;
}

function safeEquals_(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function json_(obj, status) {
  var out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}
