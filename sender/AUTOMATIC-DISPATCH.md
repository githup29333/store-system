# Automatic order dispatch

## Normal operation

- The scheduled GitHub Actions workflow checks every five minutes.
- The configured time is interpreted in `Africa/Tripoli` (Libya local time), defaulting to `15:00`.
- Once enabled and after the configured time, completed `pending` delivery rows created after `enabled_at` are converted into two XLSX files and sent individually.
- Each email is addressed only to active recipients whose `recipients.hotel` matches the delivery hotel.
- Missing prices remain visible in the cost workbook. The priced total excludes lines without a price.
- Combined `ALL` rows are excluded from outbound mail.

## Dashboard controls

In the dashboard's **الإرسال** section:

1. Use **اختبار البريد** to send one test email to the configured `TEST_TO` address (or `SMTP_USER` fallback). It uses a previously sent order with both stored XLSX files.
2. Refresh the dashboard after the test workflow finishes. The successful test timestamp is stored in `app_secrets.auto_send_config`.
3. Enable automatic sending and choose a daily time. The first activation timestamp prevents older pending orders from being swept into the automatic queue.
4. **تشغيل الإرسال الآن** dispatches pending completed orders immediately. Per-order **موافقة وإرسال** and selected-order sending remain available.

## Workflow modes

- `auto`: scheduled processing; only prepares new pending orders after the configured local time, but still sends already-approved manual orders.
- `manual`: prepares pending completed orders immediately, then sends the approved queue.
- `send`: sends only orders already prepared and approved.
- `test`: sends one test email with two existing, validated XLSX attachments; it does not send pending orders.

## Safety

- Both attachments must exist, be non-empty XLSX files, and pass the ZIP signature check before an email is sent.
- Workbook generation failure marks the delivery failed; it never sends one attachment alone.
- An interrupted/ambiguous SMTP attempt is marked failed for mailbox verification rather than automatically retried, reducing duplicate emails.
- The workflow uses the service-role key and SMTP credentials only from GitHub Actions secrets. Never add these values to source files.
