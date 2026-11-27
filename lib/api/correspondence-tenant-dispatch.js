'use strict';

// Preflight only. No provider API, mail sending, database access or OAuth here.
// The server must authorize the actor and fetch mailbox/recipients from the
// selected tenant's data before invoking this function.
const { createHash } = require('node:crypto');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

function reject(reason, status = 400) {
  const error = new Error(reason);
  error.status = status;
  throw error;
}

function emailAddress(raw) {
  if (typeof raw !== 'string') reject('Email must be a single address');
  const value = raw.trim().toLowerCase();
  if (value.length > 320 || !EMAIL.test(value) || /[\r\n]/.test(value)) {
    reject('Invalid or multiple recipient addresses');
  }
  return value;
}

function tenantUuid(raw) {
  if (typeof raw !== 'string' || !UUID.test(raw)) reject('Invalid tenant identifier');
  return raw.toLowerCase();
}

function buildTenantDispatchPlan(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) reject('Invalid dispatch request');
  const tenantId = tenantUuid(input.tenantId);
  // Permission must come from a server-side authenticated membership check,
  // never from a flag supplied by a browser or a destination address.
  if (input.authorization !== 'verified-server-side') reject('Tenant authorization is required', 403);
  if (!input.mailbox || typeof input.mailbox !== 'object') reject('Verified tenant mailbox is required', 409);
  if (tenantUuid(input.mailbox.tenantId) !== tenantId) reject('Mailbox belongs to another tenant', 403);
  if (input.mailbox.verified !== true || input.mailbox.enabled !== true) reject('Tenant mailbox is not verified and enabled', 409);
  const from = emailAddress(input.mailbox.address);
  if (!Array.isArray(input.recipients) || input.recipients.length < 1 || input.recipients.length > 5000) {
    reject('A bounded recipient list is required');
  }
  if (typeof input.documentId !== 'string' || !UUID.test(input.documentId)) reject('Issued document identifier is required');
  if (typeof input.issuedHash !== 'string' || !/^[a-f0-9]{64}$/i.test(input.issuedHash)) reject('Issued document hash is required');
  if (typeof input.subject !== 'string' || !input.subject.trim() || /[\r\n]/.test(input.subject) || input.subject.length > 200) {
    reject('Invalid message subject');
  }
  if (input.cc !== undefined || input.bcc !== undefined || input.replyTo !== undefined || input.to !== undefined || input.from !== undefined) {
    reject('Recipients and sender must be resolved from tenant-scoped records');
  }

  const seen = new Set();
  const jobs = input.recipients.map((recipient) => {
    if (!recipient || typeof recipient !== 'object' || Array.isArray(recipient)) reject('Invalid tenant contact');
    if (tenantUuid(recipient.tenantId) !== tenantId) reject('Contact belongs to another tenant', 403);
    if (typeof recipient.id !== 'string' || !UUID.test(recipient.id)) reject('Contact identifier is required');
    if (recipient.status !== 'active' || recipient.canEmail !== true) reject('Contact is not authorized for this delivery', 403);
    const to = emailAddress(recipient.email);
    if (seen.has(to)) reject('Duplicate recipient address in batch');
    seen.add(to);
    const idempotencyKey = createHash('sha256').update(
      [tenantId, input.mailbox.id || from, input.documentId.toLowerCase(), input.issuedHash.toLowerCase(), recipient.id.toLowerCase(), to].join(':')
    ).digest('hex');
    return Object.freeze({
      tenantId, mailboxId: input.mailbox.id || null,
      documentId: input.documentId.toLowerCase(),
      recipientId: recipient.id.toLowerCase(),
      from, to, subject: input.subject.trim(), idempotencyKey
    });
  });
  return Object.freeze({ tenantId, count: jobs.length, jobs: Object.freeze(jobs) });
}

module.exports = { buildTenantDispatchPlan, emailAddress };
