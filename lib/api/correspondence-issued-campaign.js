'use strict';

// Pure, deny-by-default campaign gate. Never sends mail, changes issued
// correspondence or accepts authorization claims from a browser.
const { buildTenantDispatchPlan } = require('./correspondence-tenant-dispatch');

function denied(message, status = 409) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function buildIssuedCampaignPlan(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) denied('Invalid campaign input', 400);
  if (input.authorization !== 'verified-server-side') denied('Server-side authorization required', 403);
  if (input.sendApproved !== true) denied('Explicit campaign sending approval required', 403);
  if (typeof input.campaignId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(input.campaignId)) {
    denied('Campaign identifier required', 400);
  }
  if (!Array.isArray(input.letters) || input.letters.length < 1 || input.letters.length > 250) {
    denied('Campaign must contain between 1 and 250 separately issued letters', 400);
  }
  const seenDocuments = new Set();
  const seenRecipients = new Set();
  const jobs = [];
  for (const letter of input.letters) {
    if (!letter || typeof letter !== 'object' || Array.isArray(letter)) denied('Invalid letter', 400);
    if (letter.status !== 'issued' || letter.artifactVerified !== true ||
        letter.issueState !== 'active' || letter.hasApprovedStamp !== true ||
        letter.hasVerificationQr !== true) {
      denied('Each letter must be issued, stamped and bound to a verified PDF and QR');
    }
    if (!letter.recipient || letter.documentRecipientId !== letter.recipient.id ||
        String(letter.documentRecipientEmail || '').trim().toLowerCase() !==
          String(letter.recipient.email || '').trim().toLowerCase()) {
      denied('Issued letter recipient does not match the authorized contact', 403);
    }
    const plan = buildTenantDispatchPlan({
      tenantId: input.tenantId,
      authorization: input.authorization,
      mailbox: input.mailbox,
      recipients: [letter.recipient],
      documentId: letter.documentId,
      issuedHash: letter.issuedHash,
      subject: letter.subject
    });
    const job = plan.jobs[0];
    if (seenDocuments.has(job.documentId)) denied('One issued document cannot be reused for multiple recipients');
    if (seenRecipients.has(job.to)) denied('Duplicate campaign recipient address');
    seenDocuments.add(job.documentId);
    seenRecipients.add(job.to);
    jobs.push(Object.freeze({ ...job, campaignId: input.campaignId.toLowerCase() }));
  }
  return Object.freeze({ campaignId: input.campaignId.toLowerCase(), tenantId: jobs[0].tenantId,
    count: jobs.length, jobs: Object.freeze(jobs) });
}

module.exports = { buildIssuedCampaignPlan };
