/**
 * Safe HTML escaping and transactional email template generation for VowPilot.
 * Prevents HTML/XSS injection while strictly enforcing data privacy:
 * Only relevant event logistics and quote details are presented to the vendor.
 * Sensitive overall budget, financial line items, or private guest rosters are NEVER included.
 */

export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface VendorEmailContext {
  eventName: string;
  eventDate?: string;
  guestCount?: number;
  recipientName: string;
  coordinatorName: string;
  coordinatorEmail: string;
  quoteReference?: string;
  quotedAmount?: number;
  currency?: string;
}

export function generateVendorClarificationTemplate(
  bodyText: string,
  context: VendorEmailContext
): { html: string; text: string } {
  const safeEventName = escapeHtml(context.eventName);
  const safeRecipientName = escapeHtml(context.recipientName);
  const safeCoordinatorName = escapeHtml(context.coordinatorName);
  const safeCoordinatorEmail = escapeHtml(context.coordinatorEmail);
  const safeBodyText = escapeHtml(bodyText).replace(/\n/g, '<br />');

  const eventDateDisplay = context.eventDate
    ? new Date(context.eventDate).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Date to be confirmed';

  const guestCountDisplay = context.guestCount ? `${context.guestCount} guests` : 'Not finalized';

  const quoteInfo = context.quotedAmount
    ? `<div style="background-color: #FAF8F5; border: 1px solid #E6DFD5; border-radius: 6px; padding: 12px; margin: 16px 0; font-size: 13px;">
         <strong style="color: #A2421D;">Quotation Reference:</strong> ${escapeHtml(context.quoteReference || 'Active Proposal')} &bull;
         <strong>Amount:</strong> ${context.currency || 'INR'} ${(context.quotedAmount / 100).toLocaleString()}
       </div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clarification Regarding ${safeEventName}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1C1917; background-color: #FAF8F5; margin: 0; padding: 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E6DFD5; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <!-- Header -->
    <tr>
      <td style="background-color: #A2421D; padding: 20px 24px; text-align: left;">
        <span style="color: #FFFFFF; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">VowPilot</span>
        <span style="color: #F8D9CE; font-size: 12px; margin-left: 8px; text-transform: uppercase; letter-spacing: 1px;">Vendor Coordination</span>
      </td>
    </tr>

    <!-- Logistics Banner -->
    <tr>
      <td style="background-color: #FAF0EB; padding: 12px 24px; border-bottom: 1px solid #F3CEBE; font-size: 12px; color: #863414;">
        <strong>Event:</strong> ${safeEventName} &bull;
        <strong>Target Date:</strong> ${escapeHtml(eventDateDisplay)} &bull;
        <strong>Estimated Guests:</strong> ${escapeHtml(guestCountDisplay)}
      </td>
    </tr>

    <!-- Main Message Body -->
    <tr>
      <td style="padding: 24px;">
        <p style="margin-top: 0; font-size: 14px; color: #44403C;">Dear <strong>${safeRecipientName}</strong>,</p>

        <div style="font-size: 14px; color: #1C1917; line-height: 1.6; margin: 16px 0;">
          ${safeBodyText}
        </div>

        ${quoteInfo}

        <p style="font-size: 13px; color: #57534E; margin-bottom: 0;">
          Please reply directly to this message to reach the event coordinator, or contact <strong>${safeCoordinatorName}</strong> at <a href="mailto:${safeCoordinatorEmail}" style="color: #A2421D; text-decoration: none;">${safeCoordinatorEmail}</a>.
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #F5F2ED; padding: 16px 24px; font-size: 11px; color: #78716C; border-top: 1px solid #E6DFD5; text-align: center;">
        Sent securely via VowPilot Event Coordination Platform &bull; Privacy Protected
        <br />
        This email contains only information authorized for vendor clarification. Unrelated financial records and attendee details are not shared.
      </td>
    </tr>
  </table>
</body>
</html>`;

  const plainText = `VowPilot Vendor Coordination: ${context.eventName}
============================================================
Target Date: ${eventDateDisplay} | Estimated Guests: ${guestCountDisplay}
${context.quotedAmount ? `Quotation Ref: ${context.quoteReference || 'Active Proposal'} (${context.currency || 'INR'} ${(context.quotedAmount / 100).toLocaleString()})\n` : ''}
Dear ${context.recipientName},

${bodyText}

------------------------------------------------------------
Coordinator: ${context.coordinatorName} (${context.coordinatorEmail})
Please reply directly to this email to coordinate with the planner.
Sent via VowPilot Event Coordination Platform.
`;

  return { html, text: plainText };
}
